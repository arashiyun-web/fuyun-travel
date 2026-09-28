// ADMIN_ACCESS_TOKEN rotation for the PR #33 release (the old value once appeared in URLs).
// Values live only in %USERPROFILE%\.fuyun-secrets\admin-access-token.env (ACL: current user + SYSTEM),
// go to Vercel through stdin and are never printed.
//
//   node scripts/ops/rotate-admin-access-token.mjs prepare   # generate NEXT value (no platform change)
//   node scripts/ops/rotate-admin-access-token.mjs apply     # set Production ADMIN_ACCESS_TOKEN=NEXT (same release as #33)
//   node scripts/ops/rotate-admin-access-token.mjs verify <https://site>  # after the deployment carrying it is live
//
// verify uses a quote id that does not exist, so an accepted token yields 404 and no customer data:
//   new value in header → 404, old value in header → 401, value in ?admin_token= → 401.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readCallers } from "./admin-token-callers.mjs";

const FILE = path.join(process.env.USERPROFILE, ".fuyun-secrets", "admin-access-token.env");
const SCOPE = ["--scope", "arashiyun-s-projects", "--project", "fuyun-travel"];
const PROBE_ID = "rotation-check-nonexistent-quote";
const read = () => (existsSync(FILE) ? Object.fromEntries(readFileSync(FILE, "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {});
const write = (o) => writeFileSync(FILE, "# ADMIN_ACCESS_TOKEN rotation state. Not in Git.\n" + Object.entries(o).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
const fp = (v) => createHash("sha256").update(v).digest("hex").slice(0, 10);
const vercel = (args, input) => spawnSync("vercel", [...args, ...SCOPE], { shell: true, encoding: "utf8", input });

const [,, cmd, site] = process.argv;
const state = read();
if (cmd === "prepare") {
  if (state.NEXT) {
    console.log(`NEXT already prepared (fp ${fp(state.NEXT)}); not regenerated`);
  } else {
    write({ ...state, NEXT: randomBytes(32).toString("base64url"), PREPARED_AT: new Date().toISOString() });
    console.log(`NEXT prepared (fp ${fp(read().NEXT)}). Nothing changed on Vercel.`);
  }
} else if (cmd === "apply") {
  if (!state.NEXT) throw new Error("run prepare first");
  // Blocking: GX10/Hermes callers must be confirmed by whoever checked them (see admin-token-callers.mjs).
  const callers = readCallers();
  if (!callers.ok) {
    console.error(`REFUSED: ADMIN_ACCESS_TOKEN callers not confirmed — ${callers.problems.join("; ")}`);
    process.exit(3);
  }
  vercel(["env", "rm", "ADMIN_ACCESS_TOKEN", "production", "--yes"]);
  const r = vercel(["env", "add", "ADMIN_ACCESS_TOKEN", "production"], state.NEXT);
  if (r.status !== 0) throw new Error("vercel env add failed: " + (r.stderr || "").slice(0, 200));
  write({ ...state, APPLIED_AT: new Date().toISOString() });
  console.log(`Production ADMIN_ACCESS_TOKEN set to NEXT (fp ${fp(state.NEXT)}). Takes effect with the next Production deployment.`);
} else if (cmd === "verify") {
  if (!/^https:\/\//.test(site || "") || !state.NEXT) throw new Error("usage: verify <https://site> (after apply)");
  const status = async (url, token) => (await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, redirect: "manual" })).status;
  const base = site.replace(/\/$/, "");
  const results = {
    newHeader: await status(`${base}/api/admin/quotes/${PROBE_ID}`, state.NEXT),
    newInQuery: await status(`${base}/api/admin/quotes/${PROBE_ID}?admin_token=${encodeURIComponent(state.NEXT)}`),
    ...(state.PREVIOUS ? { previousHeader: await status(`${base}/api/admin/quotes/${PROBE_ID}`, state.PREVIOUS) } : {}),
  };
  const ok = results.newHeader === 404 && results.newInQuery === 401 && (!state.PREVIOUS || results.previousHeader === 401);
  console.log(`${ok ? "PASS" : "FAIL"} rotation verify ${JSON.stringify(results)} (expected newHeader=404, newInQuery=401, previousHeader=401)`);
  process.exit(ok ? 0 : 1);
} else {
  console.error("usage: rotate-admin-access-token.mjs prepare|apply|verify <site>");
  process.exit(2);
}
