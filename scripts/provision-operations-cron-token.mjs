import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env.local");
const original = await readFile(envPath, "utf8");
const keyPattern = /^(\s*(?:export\s+)?OPERATIONS_CRON_TOKEN=)([^\r\n]*)(\r?\n|$)/m;
const existing = original.match(keyPattern);
if (existing?.[2]?.trim()) {
  console.log(JSON.stringify({ updated: false, tokenConfigured: true, envPath, tokenPrinted: false }));
  process.exit(0);
}

const token = randomBytes(32).toString("base64url");
const next = existing
  ? original.replace(keyPattern, `$1${token}$3`)
  : `${original.replace(/\s*$/, "")}\r\nOPERATIONS_CRON_TOKEN=${token}\r\n`;
const tempPath = `${envPath}.${process.pid}.tmp`;
await writeFile(tempPath, next, { encoding: "utf8", flag: "wx" });
await rename(tempPath, envPath);
console.log(JSON.stringify({ updated: true, tokenConfigured: true, envPath, tokenPrinted: false, existingValuesPreserved: true }));
