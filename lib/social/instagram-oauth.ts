import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";

export const INSTAGRAM_OAUTH_STATE_COOKIE = "fuyun_instagram_oauth_state";
export const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

const MAX_CODE_LENGTH = 4096;
const TOKEN_SLOT = "default";

/**
 * Where the encrypted token lives.
 *   INSTAGRAM_LOGIN_TOKEN_STORE unset or "database" → Neon table instagram_login_tokens (durable,
 *     shared by every serverless instance; requires DATABASE_URL).
 *   "file:<path>" → local file, for isolated single-host tests only; refused on Vercel.
 * Any other value, or a present-but-malformed value, is a configuration error.
 */
export type TokenStoreLocation = { kind: "database" } | { kind: "file"; path: string };

export type InstagramOAuthConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  stateSecret: Buffer;
  tokenEncryptionKey: Buffer;
  tokenStore: TokenStoreLocation;
};

/** Accepts either a resolved location or (tests, legacy) an explicit file path. */
type TokenStoreRef = { tokenStore?: TokenStoreLocation; tokenStorePath?: string };

export type InstagramStoredToken = {
  accountId: string;
  accessToken: string;
  obtainedAt: string;
  expiresAt: string;
  scopes: string[];
};

export type InstagramTokenExchangeResult = InstagramStoredToken;

export type InstagramOAuthErrorKind = "configuration" | "csrf" | "provider" | "storage" | "input";

export class InstagramOAuthError extends Error {
  readonly kind: InstagramOAuthErrorKind;

  constructor(kind: InstagramOAuthErrorKind) {
    super(`Instagram OAuth: ${kind}`);
    this.name = "InstagramOAuthError";
    this.kind = kind;
  }
}

function required(env: Record<string, string | undefined>, key: string) {
  const value = env[key]?.trim() || "";
  if (!value || /[\r\n]/.test(value)) throw new InstagramOAuthError("configuration");
  return value;
}

export function numericId(value: string) {
  return /^[0-9]{1,32}$/.test(value);
}

export function publicHttpsRedirect(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || url.port ||
      !host.includes(".") || host.includes(":") || /^[0-9.]+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return false;
    return url.href === value;
  } catch {
    return false;
  }
}

export function decodeKey(value: string, expectedBytes: number) {
  const compact = value.trim();
  let key: Buffer;
  if (/^[0-9a-fA-F]+$/.test(compact) && compact.length === expectedBytes * 2) {
    key = Buffer.from(compact, "hex");
  } else if (/^[A-Za-z0-9+/=_-]+$/.test(compact)) {
    key = Buffer.from(compact.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } else {
    throw new InstagramOAuthError("configuration");
  }
  if (key.length !== expectedBytes) throw new InstagramOAuthError("configuration");
  return key;
}

/** Resolve the token store; the same rules are used by insta-diag. */
export function resolveTokenStore(env: Record<string, string | undefined>): TokenStoreLocation {
  const raw = env.INSTAGRAM_LOGIN_TOKEN_STORE;
  if (raw === undefined || raw.trim() === "database") {
    const db = env.DATABASE_URL?.trim() || "";
    if (!db || db.includes("replace-with-existing")) throw new InstagramOAuthError("configuration");
    return { kind: "database" };
  }
  const value = raw.trim();
  if (!value || /[\r\n]/.test(value) || !value.startsWith("file:")) throw new InstagramOAuthError("configuration");
  if (env.VERCEL) throw new InstagramOAuthError("configuration");
  const filePath = value.slice("file:".length);
  if (!filePath) throw new InstagramOAuthError("configuration");
  return { kind: "file", path: path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath) };
}

function storeOf(ref: TokenStoreRef): TokenStoreLocation {
  if (ref.tokenStore) return ref.tokenStore;
  if (ref.tokenStorePath) return { kind: "file", path: ref.tokenStorePath };
  throw new InstagramOAuthError("configuration");
}

export function readInstagramOAuthConfig(env: Record<string, string | undefined> = process.env): InstagramOAuthConfig {
  const appId = required(env, "INSTAGRAM_LOGIN_APP_ID");
  const appSecret = required(env, "INSTAGRAM_LOGIN_APP_SECRET");
  const redirectUri = required(env, "INSTAGRAM_LOGIN_REDIRECT_URI");
  const stateSecret = decodeKey(required(env, "INSTAGRAM_LOGIN_STATE_SECRET"), 32);
  const tokenEncryptionKey = decodeKey(required(env, "INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY"), 32);
  if (!numericId(appId) || !publicHttpsRedirect(redirectUri)) throw new InstagramOAuthError("configuration");
  return { appId, appSecret, redirectUri, stateSecret, tokenEncryptionKey, tokenStore: resolveTokenStore(env) };
}

function readTokenStoreKey(env: Record<string, string | undefined> = process.env) {
  const raw = env.INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return { key: decodeKey(raw, 32), tokenStore: resolveTokenStore(env) };
}

export function createInstagramOAuthState(config: Pick<InstagramOAuthConfig, "stateSecret">) {
  const nonce = randomBytes(32).toString("base64url");
  const signature = createHmac("sha256", config.stateSecret).update(nonce).digest("base64url");
  const state = `${nonce}.${signature}`;
  return { state, cookieValue: state };
}

export function verifyInstagramOAuthState(
  state: string | null | undefined,
  cookieValue: string | null | undefined,
  config: Pick<InstagramOAuthConfig, "stateSecret">,
) {
  if (!state || !cookieValue || state !== cookieValue) throw new InstagramOAuthError("csrf");
  const [nonce, signature] = state.split(".");
  if (!nonce || !signature || nonce.length < 32 || signature.length < 32) throw new InstagramOAuthError("csrf");
  const expected = createHmac("sha256", config.stateSecret).update(nonce).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new InstagramOAuthError("csrf");
  return true;
}

export function buildInstagramAuthorizationUrl(config: Pick<InstagramOAuthConfig, "appId" | "redirectUri">, state: string) {
  if (!state || /[\r\n]/.test(state)) throw new InstagramOAuthError("input");
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_OAUTH_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.href;
}

function validToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 && !/[\r\n]/.test(value);
}

function validAccountId(value: unknown): value is string {
  return typeof value === "string" && numericId(value);
}

/**
 * Parse a provider JSON body without losing precision in `user_id`.
 * Instagram account IDs can exceed Number.MAX_SAFE_INTEGER and may arrive as JSON numbers;
 * the reviver takes the original source text (Node >= 22 exposes context.source).
 * If that is unavailable and the number is not a safe integer, the value is rejected
 * rather than stored with rounded digits.
 */
export function parseProviderJson(text: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text, function reviver(key, parsed, context?: { source?: string }) {
      if (key === "user_id" && typeof parsed === "number") {
        if (context?.source && /^[0-9]{1,32}$/.test(context.source)) return context.source;
        const match = /"user_id"\s*:\s*([0-9]{1,32})\b/.exec(text);
        if (match) return match[1];
        return Number.isSafeInteger(parsed) ? String(parsed) : null;
      }
      return parsed;
    });
  } catch {
    throw new InstagramOAuthError("provider");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InstagramOAuthError("provider");
  return value as Record<string, unknown>;
}

async function jsonBody(response: Response) {
  const text = await response.text().catch(() => "");
  return parseProviderJson(text);
}

function accountIdOf(body: Record<string, unknown>) {
  const value = body.user_id;
  return typeof value === "string" && numericId(value) ? value : null;
}

function providerRequestInit(body: URLSearchParams): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  };
}

export async function exchangeInstagramAuthorizationCode(
  config: Pick<InstagramOAuthConfig, "appId" | "appSecret" | "redirectUri">,
  code: string,
  transport: typeof fetch = fetch,
) {
  if (!code || code.length > MAX_CODE_LENGTH || /[\r\n]/.test(code)) throw new InstagramOAuthError("input");
  let shortResponse: Response;
  let shortBody: Record<string, unknown>;
  try {
    const body = new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    });
    shortResponse = await transport("https://api.instagram.com/oauth/access_token", providerRequestInit(body));
    shortBody = await jsonBody(shortResponse);
  } catch (error) {
    if (error instanceof InstagramOAuthError) throw error;
    throw new InstagramOAuthError("provider");
  }
  const shortAccountId = accountIdOf(shortBody);
  if (!shortResponse.ok || !validToken(shortBody.access_token) || !shortAccountId) {
    throw new InstagramOAuthError("provider");
  }

  let longResponse: Response;
  let longBody: Record<string, unknown>;
  try {
    const url = new URL("https://graph.instagram.com/access_token");
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", config.appSecret);
    url.searchParams.set("access_token", String(shortBody.access_token));
    longResponse = await transport(url.href, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    longBody = await jsonBody(longResponse);
  } catch (error) {
    if (error instanceof InstagramOAuthError) throw error;
    throw new InstagramOAuthError("provider");
  }
  const expiresIn = Number(longBody.expires_in);
  if (!longResponse.ok || !validToken(longBody.access_token) || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new InstagramOAuthError("provider");
  }
  const obtainedAt = new Date().toISOString();
  return {
    accountId: accountIdOf(longBody) ?? shortAccountId,
    accessToken: String(longBody.access_token),
    obtainedAt,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scopes: [...INSTAGRAM_OAUTH_SCOPES],
  } satisfies InstagramTokenExchangeResult;
}

function encryptToken(token: InstagramStoredToken, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(token), "utf8"), cipher.final()]);
  return JSON.stringify({
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: encrypted.toString("base64url"),
  });
}

function decodeBase64(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new InstagramOAuthError("storage");
  return Buffer.from(value, "base64url");
}

function decryptToken(serialized: string, key: Buffer): InstagramStoredToken {
  try {
    const envelope: unknown = JSON.parse(serialized);
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error();
    const item = envelope as Record<string, unknown>;
    if (item.version !== 1 || item.algorithm !== "aes-256-gcm") throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, decodeBase64(item.iv));
    decipher.setAuthTag(decodeBase64(item.tag));
    const clear = Buffer.concat([decipher.update(decodeBase64(item.ciphertext)), decipher.final()]);
    const value: unknown = JSON.parse(clear.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    const token = value as Record<string, unknown>;
    if (!validAccountId(token.accountId) || !validToken(token.accessToken) ||
      typeof token.obtainedAt !== "string" || typeof token.expiresAt !== "string" ||
      !Array.isArray(token.scopes) || token.scopes.some((scope) => typeof scope !== "string")) throw new Error();
    return {
      accountId: token.accountId,
      accessToken: token.accessToken,
      obtainedAt: token.obtainedAt,
      expiresAt: token.expiresAt,
      scopes: token.scopes,
    };
  } catch {
    throw new InstagramOAuthError("storage");
  }
}

async function tokenTable() {
  try {
    const { prisma } = await import("../prisma.ts");
    return prisma.instagramLoginToken;
  } catch {
    throw new InstagramOAuthError("storage");
  }
}

export async function saveInstagramLoginToken(config: TokenStoreRef & { tokenEncryptionKey: Buffer }, token: InstagramStoredToken) {
  if (!validAccountId(token.accountId) || !validToken(token.accessToken)) throw new InstagramOAuthError("input");
  const store = storeOf(config);
  const encrypted = encryptToken(token, config.tokenEncryptionKey);
  if (store.kind === "database") {
    const table = await tokenTable();
    try {
      await table.upsert({
        where: { slot: TOKEN_SLOT },
        create: { slot: TOKEN_SLOT, encrypted, accountId: token.accountId, expiresAt: new Date(token.expiresAt) },
        update: { encrypted, accountId: token.accountId, expiresAt: new Date(token.expiresAt) },
      });
    } catch {
      throw new InstagramOAuthError("storage");
    }
    return;
  }
  await mkdir(path.dirname(store.path), { recursive: true }).catch(() => { throw new InstagramOAuthError("storage"); });
  const temporary = `${store.path}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, encrypted, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, store.path);
  } catch {
    await unlink(temporary).catch(() => undefined);
    throw new InstagramOAuthError("storage");
  }
}

/** Token status without exposing the token: absent / expired / valid. Throws "storage" when unreadable. */
export async function inspectInstagramLoginToken(config: TokenStoreRef & { tokenEncryptionKey: Buffer }) {
  const token = await readRawInstagramLoginToken(config);
  if (!token) return { status: "absent" as const };
  if (Date.parse(token.expiresAt) <= Date.now()) return { status: "expired" as const, expiresAt: token.expiresAt };
  return { status: "valid" as const, expiresAt: token.expiresAt };
}

/** Returns the decrypted token, or null when absent or expired. Throws "storage" when unreadable. */
export async function readInstagramLoginToken(config: TokenStoreRef & { tokenEncryptionKey: Buffer }) {
  const token = await readRawInstagramLoginToken(config);
  if (!token || Date.parse(token.expiresAt) <= Date.now()) return null;
  return token;
}

async function readRawInstagramLoginToken(config: TokenStoreRef & { tokenEncryptionKey: Buffer }) {
  const store = storeOf(config);
  let serialized: string | null;
  if (store.kind === "database") {
    const table = await tokenTable();
    try {
      serialized = (await table.findUnique({ where: { slot: TOKEN_SLOT } }))?.encrypted ?? null;
    } catch {
      throw new InstagramOAuthError("storage");
    }
  } else {
    try {
      serialized = await readFile(store.path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
      throw new InstagramOAuthError("storage");
    }
  }
  if (!serialized) return null;
  return decryptToken(serialized, config.tokenEncryptionKey);
}

export async function readStoredInstagramLoginTokenFromEnvironment(env: Record<string, string | undefined> = process.env) {
  const store = readTokenStoreKey(env);
  if (!store) return null;
  return readInstagramLoginToken({ tokenEncryptionKey: store.key, tokenStore: store.tokenStore });
}

export async function clearInstagramLoginToken(config: TokenStoreRef) {
  const store = storeOf(config);
  if (store.kind === "database") {
    const table = await tokenTable();
    try {
      return (await table.deleteMany({ where: { slot: TOKEN_SLOT } })).count > 0;
    } catch {
      throw new InstagramOAuthError("storage");
    }
  }
  try {
    await unlink(store.path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return false;
    throw new InstagramOAuthError("storage");
  }
}

export async function clearStoredInstagramLoginTokenFromEnvironment(env: Record<string, string | undefined> = process.env) {
  const store = readTokenStoreKey(env);
  if (!store) return false;
  return clearInstagramLoginToken({ tokenStore: store.tokenStore });
}
