// Generates a new admin password, scrypt salt/hash and JWT signing secret.
// Values are written only to a protected file outside the repository and never printed.
//
//   node scripts/provision-admin-credentials.mjs --username <admin-username> [--out <dir>]
//
// Output directory defaults to %USERPROFILE%\.fuyun-secrets (Windows ACL restricted to the
// current user) or ~/.fuyun-secrets (mode 0700). Two files are written:
//   admin-login.txt       username + password for the owner to sign in (keep private)
//   admin-auth.env        ADMIN_USERNAME / ADMIN_PASSWORD_SALT / ADMIN_PASSWORD_HASH / JWT_SECRET
//                         to load into Vercel env or .env.local
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const PASSWORD_LENGTH = 20;

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function randomPassword() {
  const bytes = randomBytes(PASSWORD_LENGTH * 2);
  let out = "";
  for (const byte of bytes) {
    // Rejection sampling keeps the distribution uniform over the alphabet.
    if (byte >= Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length) continue;
    out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
    if (out.length === PASSWORD_LENGTH) return out;
  }
  return randomPassword();
}

function protectDirectory(dir) {
  if (process.platform === "win32") {
    const user = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
    execFileSync("icacls", [dir, "/inheritance:r", "/grant:r", `${user}:(OI)(CI)F`, "SYSTEM:(OI)(CI)F"], { stdio: "ignore" });
  } else {
    chmodSync(dir, 0o700);
  }
}

const username = arg("username")?.trim();
if (!username) throw new Error("請以 --username 指定管理員帳號");
const outDir = path.resolve(arg("out") || path.join(os.homedir(), ".fuyun-secrets"));
const loginFile = path.join(outDir, "admin-login.txt");
const envFile = path.join(outDir, "admin-auth.env");
if (existsSync(envFile) && !process.argv.includes("--force")) {
  throw new Error(`${envFile} 已存在；確認要重新產生時加 --force（會讓現有密碼與 session 失效）`);
}

mkdirSync(outDir, { recursive: true });
protectDirectory(outDir);

const password = randomPassword();
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const jwtSecret = randomBytes(48).toString("base64url");
const createdAt = new Date().toISOString();

writeFileSync(
  envFile,
  [
    `# generated ${createdAt} by scripts/provision-admin-credentials.mjs`,
    `ADMIN_USERNAME=${username}`,
    `ADMIN_PASSWORD_SALT=${salt}`,
    `ADMIN_PASSWORD_HASH=${hash}`,
    `JWT_SECRET=${jwtSecret}`,
    "",
  ].join("\n"),
  { encoding: "utf8", mode: 0o600 },
);
writeFileSync(
  loginFile,
  [`管理員登入（${createdAt} 產生，請勿轉貼到聊天或文件）`, `帳號: ${username}`, `密碼: ${password}`, ""].join("\n"),
  { encoding: "utf8", mode: 0o600 },
);

console.log(`已產生管理員憑證（未輸出任何值）：\n  ${envFile}\n  ${loginFile}`);
