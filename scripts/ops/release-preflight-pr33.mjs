// Read-only preflight for the PR #33 production release (runbook: docs/handoff-webmcp-20260923/
// RELEASE-RUNBOOK-PR33.md). Changes nothing: the production DB is read in a read-only transaction,
// Vercel env is listed by name only, R2 through the management API. Prints no secrets.
//   powershell -NoProfile -File scripts\tools\vercel-ascii.ps1 --exec node scripts/ops/release-preflight-pr33.mjs [--bucket fuyun-ops-production]
// Exit 0 only when every check is PASS. Nothing is skippable: unconfirmed GX10/Hermes callers, an R2 key
// not scoped to the production bucket, or missing Production env names are FAILs that block the release.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { readCallers } from "./admin-token-callers.mjs";

const HOME = process.env.USERPROFILE;
const SECRETS = path.join(HOME, ".fuyun-secrets");
const PSQL = path.join(HOME, ".fuyun-tools", "pgsql-17", "pgsql", "bin", "psql.exe");
const BACKUPS = process.env.FUYUN_BACKUPS || path.join(HOME, "Documents", "Codex", "FuyunBackups");
const TEST_BUCKET = "fuyun-ops-pr33-e2e";
const NEW_MIGRATIONS = ["202609280001_add_operations_tables", "202609280002_add_line_webhook_events", "202609290001_line_webhook_event_delivery"];
const BASELINE_MIGRATIONS = 10;
const BACKUP_MAX_AGE_H = 24;
const REQUIRED_PROD_ENV = ["OPERATIONS_PERSISTENCE_MODE", "OPERATIONS_CRON_TOKEN", "OPERATIONS_LIVE_PUBLISH_ENABLED", "ADMIN_ACCESS_TOKEN", "R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
const bucketArg = process.argv.indexOf("--bucket");
const PROD_BUCKET = bucketArg > 0 ? process.argv[bucketArg + 1] : "";

const res = [];
const put = (s, n, d = "") => res.push(`${s} ${n}${d ? " — " + d : ""}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const readEnv = (f) => (existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {});
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" && /^(npx|vercel)$/.test(cmd), ...opts });

// 1. Source: clean tree, LF migrations identical to the git blobs (Prisma checksums the bytes).
const head = sh("git", ["rev-parse", "HEAD"]).stdout.trim();
put(sh("git", ["status", "--porcelain"]).stdout.trim() === "" ? "PASS" : "FAIL", "git working tree clean", `HEAD ${head}`);
for (const m of NEW_MIGRATIONS) {
  const p = `prisma/migrations/${m}/migration.sql`;
  const blob = sh("git", ["cat-file", "blob", `HEAD:${p}`], { encoding: "buffer" }).stdout;
  const file = existsSync(p) ? readFileSync(p) : Buffer.alloc(0);
  put(blob.length && sha(blob) === sha(file) && !file.includes("\r\n") ? "PASS" : "FAIL", `${m}: working file is LF and equals the git blob`, `sha256 ${sha(file).slice(0, 12)}`);
}

// 2. Production DB (read-only): baseline history intact, new migrations not yet applied.
const prod = readEnv(path.join(SECRETS, "neon-prod.env")).DATABASE_URL;
if (!prod || !existsSync(PSQL)) put("UNVERIFIED", "production migration state", "neon-prod.env or psql missing");
else {
  const u = new URL(prod);
  const env = { ...process.env, PGHOST: u.hostname, PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1), PGSSLMODE: "require", PGOPTIONS: "-c default_transaction_read_only=on" };
  const q = (s) => sh(PSQL, ["-Atc", s], { env });
  const r = q("select count(*) filter (where finished_at is not null and rolled_back_at is null), count(*) filter (where finished_at is null), string_agg(migration_name, ',') filter (where migration_name >= '20260928') from _prisma_migrations");
  if (r.status !== 0) put("FAIL", "production _prisma_migrations readable", (r.stderr || "").replace(/postgres(ql)?:\/\/\S+/g, "<url>").slice(0, 200));
  else {
    const [done, unfinished, newer] = r.stdout.trim().split("|");
    put(Number(done) === BASELINE_MIGRATIONS && Number(unfinished) === 0 ? "PASS" : "FAIL", "production has the 10 baseline migrations, none unfinished", `finished=${done} unfinished=${unfinished}`);
    put(!newer ? "PASS" : "FAIL", "202609280001/0002 and 202609290001 not yet applied in production", newer || "none");
  }
  const ro = q("show default_transaction_read_only");
  put(ro.stdout.trim() === "on" ? "PASS" : "FAIL", "preflight DB session was read-only");
}

// 3. Fresh backup with a matching SHA256SUMS entry.
let newest = null;
if (existsSync(BACKUPS)) for (const d of readdirSync(BACKUPS)) {
  const dir = path.join(BACKUPS, d);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir).filter((n) => /^neon-prod-.*\.dump$/.test(n))) {
    const st = statSync(path.join(dir, f));
    if (!newest || st.mtimeMs > newest.mtime) newest = { dir, f, mtime: st.mtimeMs };
  }
}
if (!newest) put("FAIL", "production backup present", `no neon-prod-*.dump under ${BACKUPS}`);
else {
  const ageH = (Date.now() - newest.mtime) / 36e5;
  const sums = path.join(newest.dir, "SHA256SUMS");
  const want = existsSync(sums) ? (readFileSync(sums, "utf8").split(/\r?\n/).find((l) => l.includes(newest.f)) || "").split(/\s+/)[0] : "";
  const got = sha(readFileSync(path.join(newest.dir, newest.f)));
  put(ageH <= BACKUP_MAX_AGE_H ? "PASS" : "FAIL", `backup newer than ${BACKUP_MAX_AGE_H} h`, `${newest.f}, ${ageH.toFixed(1)} h old`);
  put(want && want === got ? "PASS" : "FAIL", "backup matches its SHA256SUMS entry", want ? got.slice(0, 12) : "no SHA256SUMS entry");
}

// 4. Production env: names present with a Production target (values are never read).
const ls = sh("vercel", ["env", "ls", "production", "--scope", "arashiyun-s-projects", "--project", "fuyun-travel"]);
if (ls.status !== 0) put("FAIL", "Vercel Production env listable", "run through scripts/tools/vercel-ascii.ps1 --exec");
else {
  const names = new Set(ls.stdout.split(/\r?\n/).filter((l) => /^\s+[A-Z][A-Z0-9_]+\s/.test(l) && /Production/.test(l)).map((l) => l.trim().split(/\s+/)[0]));
  const missing = REQUIRED_PROD_ENV.filter((n) => !names.has(n));
  put(missing.length === 0 ? "PASS" : "FAIL", "Production env has the operations/R2/admin names", missing.length ? `missing: ${missing.join(", ")}` : `${REQUIRED_PROD_ENV.length} present`);
}

// 5. Production R2: own bucket, own key scoped to it (policy first), public entry off, synthetic
//    object round trip, and no reach into the Preview test bucket — delegated to r2-precheck.mjs.
const preview = readEnv(path.join(SECRETS, "preview-e2e.env"));
const release = readEnv(path.join(SECRETS, "production-release.env"));
if (!release.R2_ACCESS_KEY_ID || !release.R2_BUCKET_NAME) put("FAIL", "production R2 settings saved in production-release.env", "run save-r2-credentials.ps1 -Target production; add R2_ACCOUNT_ID/R2_BUCKET_NAME");
else {
  if (PROD_BUCKET && PROD_BUCKET !== release.R2_BUCKET_NAME) put("FAIL", "--bucket matches production-release.env R2_BUCKET_NAME", `${PROD_BUCKET} ≠ ${release.R2_BUCKET_NAME}`);
  put(release.R2_BUCKET_NAME !== TEST_BUCKET ? "PASS" : "FAIL", "production bucket is not the test bucket", release.R2_BUCKET_NAME);
  put(release.R2_ACCESS_KEY_ID !== preview.R2_ACCESS_KEY_ID ? "PASS" : "FAIL", "production key differs from the Preview test key");
  const pc = sh(process.execPath, [path.join("scripts", "test-support", "r2-precheck.mjs"), "--target", "production"]);
  for (const line of pc.stdout.split(/\r?\n/).filter((l) => /^(PASS|FAIL|UNVERIFIED|SKIPPED) /.test(l))) {
    const [status, ...rest] = line.split(" ");
    put(status === "PASS" ? "PASS" : "FAIL", `r2 ${rest.join(" ")}`);
  }
  if (pc.status !== 0 && !/^(FAIL|UNVERIFIED|SKIPPED) /m.test(pc.stdout)) put("FAIL", "r2-precheck --target production ran", (pc.stderr || "").slice(0, 200));
}

// 6. ADMIN_ACCESS_TOKEN rotation and callers. Unconfirmed GX10/Hermes callers block the release.
put(readEnv(path.join(SECRETS, "admin-access-token.env")).NEXT ? "PASS" : "FAIL", "rotation value prepared (admin-access-token.env NEXT)");
const callers = readCallers();
put(callers.ok ? "PASS" : "FAIL", "BLOCKING: GX10/Hermes callers of ADMIN_ACCESS_TOKEN confirmed", callers.ok ? "record complete" : callers.problems.join("; "));

// 7. State that must stay unchanged until after the release.
const task = sh("powershell", ["-NoProfile", "-Command", "(Get-ScheduledTask -TaskName 'Fuyun-Operations-Worker' -ErrorAction SilentlyContinue).State"]).stdout.trim();
put(task === "Disabled" ? "PASS" : "FAIL", "production worker task still Disabled", task || "not found");
const dep = sh("gh", ["api", "repos/arashiyun-web/fuyun-travel/deployments?environment=Production&per_page=1", "--jq", ".[0].sha"]).stdout.trim();
put(dep.startsWith("ceee1b5") ? "PASS" : "FAIL", "production still on rollback baseline ceee1b5 before merge", dep.slice(0, 7));

console.log(res.join("\n"));
process.exit(res.every((l) => l.startsWith("PASS")) ? 0 : 1);
