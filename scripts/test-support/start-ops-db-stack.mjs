// Start the isolated operations test stack: S3 mock + four `next start` instances.
// All state lives under <workDir>; nothing points at production.
// Usage: node scripts/test-support/start-ops-db-stack.mjs <workDir> <databaseUrl>
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const [,, workDir, databaseUrl] = process.argv;
mkdirSync(workDir, { recursive: true });
const root = process.cwd();
const secDir = path.join(workDir, "sec");
execFileSync(process.execPath, ["scripts/provision-admin-credentials.mjs", "--username", "ops-db-test", "--out", secDir, "--force"], { stdio: "ignore" });
const adminEnv = Object.fromEntries(readFileSync(path.join(secDir, "admin-auth.env"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const cron = randomBytes(24).toString("hex");
writeFileSync(path.join(workDir, "cron"), cron);

const s3 = { R2_ACCOUNT_ID: "local-test", R2_ACCESS_KEY_ID: "test-access", R2_SECRET_ACCESS_KEY: "test-secret", R2_BUCKET_NAME: "ops-test", R2_ENDPOINT: "http://127.0.0.1:9100" };
const base = { ...process.env, ...adminEnv, OPERATIONS_CRON_TOKEN: cron, NODE_ENV: "production" };
for (const k of ["OPERATIONS_PERSISTENCE_MODE", "OPERATIONS_DATA_DIR", "VERCEL", "OPERATIONS_LIVE_PUBLISH_ENABLED", "INSTAGRAM_LOGIN_ACCESS_TOKEN"]) delete base[k];

const pids = {};
function start(name, args, env) {
  const log = openSync(path.join(workDir, `${name}.log`), "a");
  const child = spawn(process.execPath, args, { cwd: root, env, detached: true, stdio: ["ignore", log, log], windowsHide: true });
  child.unref();
  pids[name] = child.pid;
}
start("s3", ["scripts/test-support/s3-mock.mjs", "9100", path.join(workDir, "s3-data")], base);
const next = (port) => ["node_modules/next/dist/bin/next", "start", "-p", String(port)];
start("A", next(3250), { ...base, ...s3, DATABASE_URL: databaseUrl, OPERATIONS_PERSISTENCE_MODE: "database", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3250" });
start("B", next(3251), { ...base, ...s3, DATABASE_URL: databaseUrl, OPERATIONS_PERSISTENCE_MODE: "database", NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3251" });
start("C", next(3252), { ...base, DATABASE_URL: databaseUrl, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3252" });
start("D", next(3253), { ...base, DATABASE_URL: databaseUrl, VERCEL: "1", OPERATIONS_PERSISTENCE_MODE: "file", OPERATIONS_DATA_DIR: path.join(workDir, "should-not-be-used"), NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3253" });
writeFileSync(path.join(workDir, "pids.json"), JSON.stringify(pids, null, 2));
console.log(JSON.stringify(pids));
