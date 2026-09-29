// Production migration for the PR #33 release (runbook step 2). Guards, then `prisma migrate status`;
// `migrate deploy` only with --apply and the approved commit SHA. Run from a clean LF checkout
// (git -c core.autocrlf=false clone …): Prisma checksums the migration bytes, and a CRLF copy would not
// match the 10 recorded checksums. Uses the owner role on the direct (unpooled) endpoint from the
// ACL-protected neon-prod.env; the URL stays in this process's env. Prints no secrets.
//   node scripts/ops/migrate-production-pr33.mjs --sha <approved sha>            # guards + status only
//   node scripts/ops/migrate-production-pr33.mjs --sha <approved sha> --apply    # deploy (release window)
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { evaluateMigrateStatus } from "./migrate-status.mjs";

const OWNER_ROLE = "neondb_owner";
const PROD_ENDPOINT = "ep-proud-wildflower-ao4d38ll";
const EXPECTED_NEW = ["202609280001_add_operations_tables", "202609280002_add_line_webhook_events", "202609290001_line_webhook_event_delivery"];
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ""; };
const apply = process.argv.includes("--apply");
const approved = arg("--sha");
const fail = (m) => { console.error(`REFUSED: ${m}`); process.exit(3); };
const git = (a) => spawnSync("git", a, { encoding: "utf8" }).stdout.trim();

if (!/^[0-9a-f]{40}$/.test(approved)) fail("--sha <full approved commit sha> is required");
if (git(["rev-parse", "HEAD"]) !== approved) fail("HEAD is not the approved commit");
if (git(["status", "--porcelain"]) !== "") fail("working tree not clean");
if (git(["config", "core.autocrlf"]) === "true") fail("core.autocrlf=true in this checkout; use a clone made with -c core.autocrlf=false");
for (const d of readdirSync("prisma/migrations").filter((n) => /^\d/.test(n))) {
  const p = `prisma/migrations/${d}/migration.sql`;
  if (existsSync(p) && readFileSync(p).includes("\r\n")) fail(`${p} has CRLF line endings`);
}
for (const m of EXPECTED_NEW) if (!existsSync(`prisma/migrations/${m}/migration.sql`)) fail(`missing ${m}`);

const env = Object.fromEntries(readFileSync(path.join(process.env.USERPROFILE, ".fuyun-secrets", "neon-prod.env"), "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const url = new URL(env.DATABASE_URL_UNPOOLED || "");
if (decodeURIComponent(url.username) !== OWNER_ROLE) fail(`DDL must run as ${OWNER_ROLE}`);
if (url.hostname.split(".")[0] !== PROD_ENDPOINT) fail("not the production direct endpoint");

const prisma = (cmd) => spawnSync("npx", ["prisma", "migrate", cmd], { encoding: "utf8", shell: process.platform === "win32", env: { ...process.env, DATABASE_URL: url.toString() } });
const scrub = (s) => (s || "").replace(/postgres(ql)?:\/\/\S+/g, "<url>");
const status = prisma("status");
console.log(scrub(status.stdout).trim().split("\n").slice(-8).join("\n"));
const checked = evaluateMigrateStatus({ status: status.status, stdout: status.stdout, stderr: status.stderr }, EXPECTED_NEW);
if (!checked.ok) {
  console.error(`REFUSED: ${checked.reason}`);
  console.error(scrub(status.stderr).slice(0, 600));
  process.exit(3);
}
if (!apply) {
  console.log(`guards PASS; ${checked.reason}: ${checked.pending.join(", ") || "none"}. Re-run with --apply in the release window.`);
  process.exit(0);
}
const deploy = prisma("deploy");
console.log(scrub(deploy.stdout).trim());
if (deploy.status !== 0) { console.error(scrub(deploy.stderr).slice(0, 600)); process.exit(1); }
const after = prisma("status");
console.log(/Database schema is up to date/.test(after.stdout) ? "migrate deploy done; schema up to date" : "CHECK: status after deploy is not up to date");
process.exit(after.status === 0 ? 0 : 1);
