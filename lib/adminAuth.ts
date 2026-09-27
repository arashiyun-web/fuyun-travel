import { createHmac, scryptSync, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;
/**
 * Token format version. Tokens issued before the 2026-09-27 hardening carry no
 * version claim and are rejected even if the signing key were somehow unchanged.
 */
const TOKEN_VERSION = 2;

export class AdminAuthNotConfiguredError extends Error {
  constructor() {
    super("管理員安全設定未完成");
    this.name = "AdminAuthNotConfiguredError";
  }
}

function adminUsername() {
  return process.env.ADMIN_USERNAME?.trim() || "";
}

function signingSecret() {
  const value = process.env.JWT_SECRET?.trim() || "";
  return value.length >= MIN_SECRET_LENGTH ? value : null;
}

export function isAdminAuthConfigured() {
  return Boolean(
    adminUsername() &&
      signingSecret() &&
      process.env.ADMIN_PASSWORD_SALT?.trim() &&
      process.env.ADMIN_PASSWORD_HASH?.trim(),
  );
}

function base64url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  const secret = signingSecret();
  return secret ? createHmac("sha256", secret).update(payload).digest("base64url") : null;
}

export function validateAdminCredentials(username: unknown, password: unknown) {
  const configuredUsername = adminUsername();
  const salt = process.env.ADMIN_PASSWORD_SALT?.trim() || "";
  const encodedHash = process.env.ADMIN_PASSWORD_HASH?.trim() || "";
  if (!configuredUsername || !salt || !encodedHash) return false;
  if (typeof username !== "string" || typeof password !== "string" || !password) return false;
  if (username !== configuredUsername) return false;

  try {
    const expected = Buffer.from(encodedHash, "hex");
    if (expected.length === 0) return false;
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createAdminToken() {
  const username = adminUsername();
  if (!username || !signingSecret()) throw new AdminAuthNotConfiguredError();
  const payload = base64url(
    JSON.stringify({
      v: TOKEN_VERSION,
      username,
      role: "Admin",
      exp: Date.now() + TOKEN_TTL_MS,
    }),
  );
  const signature = sign(payload);
  if (!signature) throw new AdminAuthNotConfiguredError();
  return `${payload}.${signature}`;
}

export function verifyAdminToken(authHeader: string | null) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = sign(payload);
  if (!expected) return null;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      decoded.v !== TOKEN_VERSION ||
      decoded.role !== "Admin" ||
      typeof decoded.username !== "string" ||
      decoded.username !== adminUsername() ||
      typeof decoded.exp !== "number" ||
      !Number.isFinite(decoded.exp) ||
      decoded.exp <= Date.now()
    ) {
      return null;
    }
    return { username: decoded.username, role: "Admin" as const };
  } catch {
    return null;
  }
}
