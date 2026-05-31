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

