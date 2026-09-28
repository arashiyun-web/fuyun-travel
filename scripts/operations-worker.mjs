import { realpathSync } from "node:fs";
import { mkdir, open, readFile, stat, unlink, utimes } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadLocalEnvironment() {
  // A service run points OPERATIONS_WORKER_ENV_FILE at a protected config file; development
  // runs fall back to the project's .env.local / .env. Existing process env always wins.
  const explicit = process.env.OPERATIONS_WORKER_ENV_FILE;
  const files = explicit ? [explicit] : [path.join(projectRoot, ".env.local"), path.join(projectRoot, ".env")];
  for (const filePath of files) {
    let contents;
    try {
      contents = await readFile(filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    for (const line of contents.split(/\r?\n/)) {
      const match = line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1);
        }
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, "").trim();
      }
      process.env[match[1]] = value;
    }
  }
}

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

await loadLocalEnvironment();

const baseUrl = (process.env.OPERATIONS_AGENT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const token = process.env.OPERATIONS_CRON_TOKEN || "";
// Only for protected Vercel Preview deployments (isolated E2E); production custom domains need none.
const protectionBypass = process.env.OPERATIONS_AGENT_PROTECTION_BYPASS || "";
const baseIsLoopback = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseUrl);
if (!baseUrl.startsWith("https://") && !baseIsLoopback) {
  console.error("OPERATIONS_AGENT_BASE_URL must be https (or loopback http); refusing to send credentials in clear text");
  process.exit(2);
}
const loopMode = process.argv.includes("--loop") || process.env.OPERATIONS_WORKER_MODE === "loop";
const intervalMs = Math.max(10_000, Number(process.env.OPERATIONS_WORKER_INTERVAL_MS || 60_000));
const dataDir = resolveProjectPath(process.env.OPERATIONS_DATA_DIR || "data/operations");
const lockPath = resolveProjectPath(process.env.OPERATIONS_WORKER_LOCK || path.join(dataDir, "worker.lock"));
const staleLockMs = 10 * 60 * 1000;
let stopping = false;
let lockHeartbeat;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

/**
 * A held lock may be taken over only when its heartbeat (file mtime, refreshed while the holder runs)
 * has stopped for staleMs, or its process is gone. The creation time written into the file is not
 * used: a long-running loop worker keeps an old creation time while it is alive.
 */
export function lockIsTakeable({ mtimeMs, pidAlive, now = Date.now(), staleMs = staleLockMs }) {
  return now - mtimeMs > staleMs || !pidAlive;
}

/** Returns the lock token (file contents) this process owns. */
export async function acquireLock(file = lockPath) {
  await mkdir(path.dirname(file), { recursive: true });
  const ownToken = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  try {
    const handle = await open(file, "wx");
    await handle.writeFile(ownToken, "utf8");
    await handle.close();
    return ownToken;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    try {
      const contents = await readFile(file, "utf8");
      const lockStat = await stat(file);
      if (lockIsTakeable({ mtimeMs: lockStat.mtimeMs, pidAlive: processAlive(Number(contents.split(":")[0])) })) {
        await unlink(file);
        return acquireLock(file);
      }
    } catch (readError) {
      if (readError?.code === "ENOENT") return acquireLock(file);
      throw readError;
    }
    throw new Error("另一個 operations worker 已在執行");
  }
}

/** Touch or delete the lock only while it still carries this process's token. */
async function ownsLock(file, ownToken) {
  try {
    return (await readFile(file, "utf8")) === ownToken;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function refreshLock(file, ownToken) {
  try {
    if (!(await ownsLock(file, ownToken))) return false;
    const timestamp = new Date();
    await utimes(file, timestamp, timestamp);
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("operations worker lock refresh failed");
    return false;
  }
}

export async function releaseLock(file, ownToken) {
  if (await ownsLock(file, ownToken)) await unlink(file).catch(() => undefined);
}

async function runOnce() {
  try {
    const response = await fetch(`${baseUrl}/api/operations/process-due`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(protectionBypass ? { "x-vercel-protection-bypass": protectionBypass } : {}),
      },
      body: "{}",
      signal: AbortSignal.timeout(120_000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`operations worker failed: HTTP ${response.status}`);
      return false;
    }
    console.log(`operations worker completed: ${Array.isArray(data.results) ? data.results.length : 0} job(s)`);
    return true;
  } catch (error) {
    console.error(`operations worker unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  if (!token) {
    console.error("OPERATIONS_CRON_TOKEN is required");
    process.exitCode = 2;
    return;
  }
  let ownToken;
  try {
    ownToken = await acquireLock();
    lockHeartbeat = setInterval(() => { void refreshLock(lockPath, ownToken); }, Math.min(60_000, Math.floor(staleLockMs / 3)));
    lockHeartbeat.unref?.();
    process.on("SIGINT", () => { stopping = true; });
    process.on("SIGTERM", () => { stopping = true; });
    do {
      const ok = await runOnce();
      // One-shot runs (scheduled task) report failure through the exit code; loop mode keeps retrying.
      if (!loopMode && !ok) process.exitCode = 1;
      if (loopMode && !stopping) await sleep(intervalMs);
    } while (loopMode && !stopping);
  } catch (error) {
    console.error(`operations worker stopped: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    if (lockHeartbeat) clearInterval(lockHeartbeat);
    if (ownToken) await releaseLock(lockPath, ownToken);
  }
}

// Run only when executed directly (tests import the lock helpers). Real paths, because Windows may
// hand over an 8.3 short name in argv while import.meta.url carries the long one.
function isEntryPoint() {
  if (!process.argv[1]) return false;
  const norm = (p) => (process.platform === "win32" ? realpathSync(p).toLowerCase() : realpathSync(p));
  try {
    return norm(path.resolve(process.argv[1])) === norm(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) await main();
