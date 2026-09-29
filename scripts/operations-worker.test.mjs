// Run: node --test scripts/operations-worker.test.mjs
// Lock takeover rules and one-shot exit codes of scripts/operations-worker.mjs (PR #33 review).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync, utimesSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), "operations-worker.mjs");
const dir = mkdtempSync(path.join(os.tmpdir(), "ops-worker-test-"));
const emptyEnv = path.join(dir, "empty.env");
writeFileSync(emptyEnv, "");
// Keep the imported module from reading the project's .env.local.
process.env.OPERATIONS_WORKER_ENV_FILE = emptyEnv;
const worker = await import(new URL("./operations-worker.mjs", import.meta.url));
const MIN = 60 * 1000;

let server;
let port;
before(async () => {
  server = createServer((req, res) => {
    const auth = req.headers.authorization || "";
    res.writeHead(auth === "Bearer good-token" ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: auth === "Bearer good-token", results: [] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

test("lockIsTakeable: live holder with an old creation time but fresh heartbeat is kept", () => {
  const now = Date.now();
  assert.equal(worker.lockIsTakeable({ mtimeMs: now - 30_000, pidAlive: true, now, staleMs: 10 * MIN }), false);
  assert.equal(worker.lockIsTakeable({ mtimeMs: now - 11 * MIN, pidAlive: true, now, staleMs: 10 * MIN }), true, "heartbeat stopped");
  assert.equal(worker.lockIsTakeable({ mtimeMs: now, pidAlive: false, now, staleMs: 10 * MIN }), true, "holder process gone");
});

test("acquireLock refuses a live worker's lock created 11 minutes ago (review scenario) and leaves it intact", async () => {
  const lock = path.join(dir, "live.lock");
  const holder = `${process.pid}:${Date.now() - 11 * MIN}:holder`;
  writeFileSync(lock, holder); // mtime = now, as the holder's heartbeat keeps it
  await assert.rejects(worker.acquireLock(lock), /另一個 operations worker 已在執行/);
  assert.equal(readFileSync(lock, "utf8"), holder);
});

test("acquireLock takes over a dead holder's lock and a lock whose heartbeat stopped", async () => {
  const dead = path.join(dir, "dead.lock");
  writeFileSync(dead, "999999:1:dead"); // pid 999999 is not running
  const t1 = await worker.acquireLock(dead);
  assert.equal(readFileSync(dead, "utf8"), t1);
  const hung = path.join(dir, "hung.lock");
  writeFileSync(hung, `${process.pid}:${Date.now()}:hung`);
  const old = (Date.now() - 11 * MIN) / 1000;
  utimesSync(hung, old, old);
  const t2 = await worker.acquireLock(hung);
  assert.equal(readFileSync(hung, "utf8"), t2);
});

test("refresh and release only touch a lock this process still owns", async () => {
  const lock = path.join(dir, "owned.lock");
  const mine = await worker.acquireLock(lock);
  writeFileSync(lock, "4242:1:someone-else"); // lock was taken over meanwhile
  const old = (Date.now() - 5 * MIN) / 1000;
  utimesSync(lock, old, old);
  assert.equal(await worker.refreshLock(lock, mine), false);
  assert.ok(Date.now() - statSync(lock).mtimeMs > 4 * MIN, "foreign lock mtime unchanged");
  await worker.releaseLock(lock, mine);
  assert.equal(existsSync(lock), true, "foreign lock not deleted");
  writeFileSync(lock, mine);
  assert.equal(await worker.refreshLock(lock, mine), true);
  await worker.releaseLock(lock, mine);
  assert.equal(existsSync(lock), false);
});

// Async spawn: a synchronous spawn would block this process, and with it the stub server.
function runWorker(extra) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WORKER], {
      env: { ...process.env, OPERATIONS_WORKER_ENV_FILE: emptyEnv, OPERATIONS_WORKER_LOCK: path.join(dir, `run-${Math.random()}.lock`), OPERATIONS_WORKER_MODE: "", ...extra },
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), 30_000);
    child.on("close", (status) => { clearTimeout(timer); resolve({ status, stderr }); });
  });
}

test("one-shot exit code: 0 on success, 1 on HTTP error or connection failure (review P2)", async () => {
  assert.equal((await runWorker({ OPERATIONS_AGENT_BASE_URL: `http://127.0.0.1:${port}`, OPERATIONS_CRON_TOKEN: "good-token" })).status, 0);
  const denied = await runWorker({ OPERATIONS_AGENT_BASE_URL: `http://127.0.0.1:${port}`, OPERATIONS_CRON_TOKEN: "wrong-token" });
  assert.equal(denied.status, 1, denied.stderr);
  const refused = await runWorker({ OPERATIONS_AGENT_BASE_URL: "http://127.0.0.1:1", OPERATIONS_CRON_TOKEN: "good-token" });
  assert.equal(refused.status, 1, refused.stderr);
});

test("a second worker exits 1 while a live worker holds the lock", async () => {
  const lock = path.join(dir, "held.lock");
  writeFileSync(lock, `${process.pid}:${Date.now() - 11 * MIN}:holder`);
  const r = await runWorker({ OPERATIONS_AGENT_BASE_URL: `http://127.0.0.1:${port}`, OPERATIONS_CRON_TOKEN: "good-token", OPERATIONS_WORKER_LOCK: lock });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /另一個 operations worker 已在執行/);
  assert.ok(existsSync(lock));
});
