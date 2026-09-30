import { createHmac, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

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

/** Async scrypt so a login attempt never blocks the event loop for other requests. */
export async function validateAdminCredentials(username: unknown, password: unknown): Promise<boolean> {
  const configuredUsername = adminUsername();
  const salt = process.env.ADMIN_PASSWORD_SALT?.trim() || "";
  const encodedHash = process.env.ADMIN_PASSWORD_HASH?.trim() || "";
  if (!configuredUsername || !salt || !encodedHash) return false;
  if (typeof username !== "string" || typeof password !== "string" || !password) return false;
  // Mobile autofill/keyboards may add surrounding spaces to the username; the password is compared exactly.
  if (username.trim() !== configuredUsername) return false;

  try {
    const expected = Buffer.from(encodedHash, "hex");
    if (expected.length === 0) return false;
    const actual = await scryptAsync(password, salt, expected.length);
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
  // Fail closed: removing any admin setting (e.g. to disable admin access) also revokes issued sessions.
  if (!isAdminAuthConfigured()) return null;

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

export const ADMIN_COOKIE_NAME = "fuyun_admin_session";

function cookieToken(cookieHeader: string | null) {
  const cookies = cookieHeader?.split(";").map((item) => item.trim()) || [];
  const entry = cookies.find((item) => item.startsWith(`${ADMIN_COOKIE_NAME}=`));
  if (!entry) return "";
  try {
    return decodeURIComponent(entry.slice(ADMIN_COOKIE_NAME.length + 1));
  } catch {
    return "";
  }
}

export function verifyAdminRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization : null;
  return verifyAdminToken(bearer || `Bearer ${cookieToken(request.headers.get("cookie"))}`);
}

/**
 * Origin the client actually addressed. Next.js may rebuild request.url with an internal host
 * (e.g. localhost), so prefer the proxy/host headers (set by Vercel; not settable by other pages).
 */
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(/:$/, "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function isSameOriginRequest(request: Request) {
  const expectedOrigin = requestOrigin(request);
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === expectedOrigin;
  } catch {
    return false;
  }
}

/**
 * Cookie-authenticated state changes require a same-origin signal. Bearer
 * callers (the local worker or an explicitly configured automation) are already
 * separated from browser cookies and may call without Origin/Referer.
 */
export function verifyAdminMutationRequest(request: Request) {
  const user = verifyAdminRequest(request);
  if (!user) return null;
  if (request.headers.get("authorization")?.startsWith("Bearer ")) return user;
  return isSameOriginRequest(request) ? user : null;
}

/** Secure follows the actual request scheme (x-forwarded-proto behind Vercel's proxy). */
export function adminCookieOptions(request?: Request) {
  const forwarded = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const https = request ? forwarded === "https" || new URL(request.url).protocol === "https:" : process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") === true;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: https,
    path: "/",
    maxAge: Math.floor(TOKEN_TTL_MS / 1000),
  };
}

