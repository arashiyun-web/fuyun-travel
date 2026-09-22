import { createHmac, timingSafeEqual } from "crypto";

const ADMIN_USERNAME = "arashiyun6866";
const ADMIN_PASSWORD = "y12345678";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function secret() {
  return process.env.JWT_SECRET || "FuYunSecure8888";
}

function base64url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function validateAdminCredentials(username: unknown, password: unknown) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function createAdminToken() {
  const payload = base64url(
    JSON.stringify({
      username: ADMIN_USERNAME,
      role: "Admin",
      exp: Date.now() + TOKEN_TTL_MS,
    }),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(authHeader: string | null) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.role !== "Admin" || decoded.exp < Date.now()) return null;
    return { username: String(decoded.username), role: "Admin" };
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

function sameOriginMutation(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
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
  return sameOriginMutation(request) ? user : null;
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") === true,
    path: "/",
    maxAge: Math.floor(TOKEN_TTL_MS / 1000),
  };
}

