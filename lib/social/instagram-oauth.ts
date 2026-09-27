import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";

export const INSTAGRAM_OAUTH_STATE_COOKIE = "fuyun_instagram_oauth_state";
export const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

const DEFAULT_TOKEN_STORE = "data/operations/instagram-login-token.enc.json";
const MAX_CODE_LENGTH = 4096;

export type InstagramOAuthConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  stateSecret: Buffer;
  tokenEncryptionKey: Buffer;
  tokenStorePath: string;
};

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

function resolveTokenStorePath(env: Record<string, string | undefined>) {
  const configured = env.INSTAGRAM_LOGIN_TOKEN_STORE?.trim() || DEFAULT_TOKEN_STORE;
  if (/[\r\n]/.test(configured)) throw new InstagramOAuthError("configuration");
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

export function readInstagramOAuthConfig(env: Record<string, string | undefined> = process.env): InstagramOAuthConfig {
  const appId = required(env, "INSTAGRAM_LOGIN_APP_ID");
  const appSecret = required(env, "INSTAGRAM_LOGIN_APP_SECRET");
  const redirectUri = required(env, "INSTAGRAM_LOGIN_REDIRECT_URI");
  const stateSecret = decodeKey(required(env, "INSTAGRAM_LOGIN_STATE_SECRET"), 32);
  const tokenEncryptionKey = decodeKey(required(env, "INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY"), 32);
  if (!numericId(appId) || !publicHttpsRedirect(redirectUri)) throw new InstagramOAuthError("configuration");
  return { appId, appSecret, redirectUri, stateSecret, tokenEncryptionKey, tokenStorePath: resolveTokenStorePath(env) };
}

function readTokenStoreKey(env: Record<string, string | undefined> = process.env) {
  const raw = env.INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return { key: decodeKey(raw, 32), tokenStorePath: resolveTokenStorePath(env) };
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

async function jsonBody(response: Response) {
  const value: unknown = await response.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InstagramOAuthError("provider");
  return value as Record<string, unknown>;
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
  if (!shortResponse.ok || !validToken(shortBody.access_token) || !validAccountId(String(shortBody.user_id ?? ""))) {
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
    accountId: validAccountId(String(longBody.user_id ?? "")) ? String(longBody.user_id) : String(shortBody.user_id),
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

export async function saveInstagramLoginToken(config: Pick<InstagramOAuthConfig, "tokenEncryptionKey" | "tokenStorePath">, token: InstagramStoredToken) {
  if (!validAccountId(token.accountId) || !validToken(token.accessToken)) throw new InstagramOAuthError("input");
  const directory = path.dirname(config.tokenStorePath);
  await mkdir(directory, { recursive: true }).catch(() => { throw new InstagramOAuthError("storage"); });
  const temporary = `${config.tokenStorePath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, encryptToken(token, config.tokenEncryptionKey), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await rename(temporary, config.tokenStorePath);
  } catch {
    await unlink(temporary).catch(() => undefined);
    throw new InstagramOAuthError("storage");
  }
}

export async function readInstagramLoginToken(config: Pick<InstagramOAuthConfig, "tokenEncryptionKey" | "tokenStorePath">) {
  let serialized: string;
  try {
    serialized = await readFile(config.tokenStorePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw new InstagramOAuthError("storage");
  }
  const token = decryptToken(serialized, config.tokenEncryptionKey);
  if (Date.parse(token.expiresAt) <= Date.now()) return null;
  return token;
}

export async function readStoredInstagramLoginTokenFromEnvironment(env: Record<string, string | undefined> = process.env) {
  const store = readTokenStoreKey(env);
  if (!store) return null;
  return readInstagramLoginToken({ tokenEncryptionKey: store.key, tokenStorePath: store.tokenStorePath });
}

export async function clearInstagramLoginToken(config: Pick<InstagramOAuthConfig, "tokenStorePath">) {
  try {
    await unlink(config.tokenStorePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return false;
    throw new InstagramOAuthError("storage");
  }
}

export async function clearStoredInstagramLoginTokenFromEnvironment(env: Record<string, string | undefined> = process.env) {
  const store = readTokenStoreKey(env);
  if (!store) return false;
  return clearInstagramLoginToken({ tokenStorePath: store.tokenStorePath });
}
