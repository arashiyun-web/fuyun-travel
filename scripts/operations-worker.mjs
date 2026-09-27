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

async function acquireLock() {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await open(lockPath, "wx");
    await handle.writeFile(`${process.pid}:${Date.now()}`, "utf8");
    return handle;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    try {
      const contents = await readFile(lockPath, "utf8");
      const [pidText] = contents.split(":");
      const lockAt = Number(contents.split(":").at(-1));
      const lockStat = await stat(lockPath);
      const stale = (Number.isFinite(lockAt) && Date.now() - lockAt > staleLockMs) || Date.now() - lockStat.mtimeMs > staleLockMs;
      // A lock left by a crashed worker is taken over at once instead of blocking restarts
      // until it goes stale (process.kill(pid, 0) only checks existence).
      if (stale || !processAlive(Number(pidText))) {
        await unlink(lockPath);
        return acquireLock();
      }
    } catch (readError) {
      if (readError?.code === "ENOENT") return acquireLock();
      throw readError;
    }
    throw new Error("另一個 operations worker 已在執行");
  }
}

async function runOnce() {
  try {
    const response = await fetch(`${baseUrl}/api/operations/process-due`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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

async function refreshLock() {
  try {
    const timestamp = new Date();
    await utimes(lockPath, timestamp, timestamp);
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("operations worker lock refresh failed");
  }
}

if (!token) {
  console.error("OPERATIONS_CRON_TOKEN is required");
  process.exitCode = 2;
} else {
  let lockHandle;
  try {
    lockHandle = await acquireLock();
    lockHeartbeat = setInterval(() => { void refreshLock(); }, Math.min(60_000, Math.floor(staleLockMs / 3)));
    lockHeartbeat.unref?.();
    process.on("SIGINT", () => { stopping = true; });
    process.on("SIGTERM", () => { stopping = true; });
    do {
      await runOnce();
      if (loopMode && !stopping) await sleep(intervalMs);
    } while (loopMode && !stopping);
  } catch (error) {
    console.error(`operations worker stopped: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    if (lockHeartbeat) clearInterval(lockHeartbeat);
    if (lockHandle) {
      await lockHandle.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }
}
