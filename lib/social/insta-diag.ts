/**
 * Server-side diagnostics for the Instagram login configuration.
 *
 * Design constraints (Owner requirement, 2026-09-22):
 *  - Reuse the SAME validation rules the runtime actually uses
 *    (`numericId` / `publicHttpsRedirect` / `decodeKey` — the exact functions
 *    `readInstagramOAuthConfig` calls per field). Do NOT invent a second
 *    source of truth. The goal is to tell the Owner WHICH field is blocking,
 *    without leaking anything.
 *  - Log field NAME + status only: MISSING / INVALID / PASS /
 *    UNEXPECTED_EXCEPTION. Never log the value, a prefix, a hash, or a stack.
 *  - Distinguish non-configuration (unexpected) exceptions so a real bug is
 *    not misread as a bad env value.
 *
 * Returns a plain, safely-serialisable shape (used by the server for logging,
 * and by the candidate test harness for assertions). It is NOT returned to
 * the HTTP client, and it never contains secret material.
 */
import {
  numericId,
  publicHttpsRedirect,
  decodeKey,
  InstagramOAuthError,
  inspectInstagramLoginToken,
  resolveTokenStore,
} from "./instagram-oauth.ts";

export type InstaDiagStatus = "MISSING" | "INVALID" | "PASS" | "UNEXPECTED_EXCEPTION";

export type InstaFieldDiag = {
  field: string;
  status: InstaDiagStatus;
  note?: string;
};

export type InstaDiagResult = {
  overall: "PASS" | "FAIL" | "UNEXPECTED_EXCEPTION";
  fields: InstaFieldDiag[];
  /** true when at least one required field is not PASS (or an exception fired) */
  blocked: boolean;
};

const REQUIRED_FIELDS = [
  "INSTAGRAM_LOGIN_APP_ID",
  "INSTAGRAM_LOGIN_APP_SECRET",
  "INSTAGRAM_LOGIN_REDIRECT_URI",
  "INSTAGRAM_LOGIN_STATE_SECRET",
  "INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY",
] as const;

// Mirrors the exact trim + no-CR/LF behaviour of `required()` in the core
// module. Returns null when the value is absent, empty, or has embedded
// line-breaks (the core module treats all of these as configuration errors).
function cleaned(env: Record<string, string | undefined>, key: string): string | null {
  const raw = env[key];
  if (raw === undefined) return null;
  const value = raw.trim();
  if (!value || /[\r\n]/.test(value)) return null;
  return value;
}

function classifyBoolean(
  field: string,
  value: string | null,
  validate: (value: string) => boolean,
  noteIfPass?: string,
): InstaFieldDiag {
  if (value === null) return { field, status: "MISSING" };
  try {
    return validate(value)
      ? { field, status: "PASS", note: noteIfPass }
      : { field, status: "INVALID" };
  } catch {
    // A validator throwing something other than its documented error type is
    // NOT a configuration problem — surface it as UNEXPECTED_EXCEPTION.
    return { field, status: "UNEXPECTED_EXCEPTION" };
  }
}

function classifyKey(field: string, value: string | null, expectedBytes: number): InstaFieldDiag {
  if (value === null) return { field, status: "MISSING" };
  try {
    decodeKey(value, expectedBytes);
    return { field, status: "PASS" };
  } catch (e) {
    // decodeKey reports a bad key as InstagramOAuthError("configuration").
    if (e instanceof InstagramOAuthError) return { field, status: "INVALID" };
    return { field, status: "UNEXPECTED_EXCEPTION" };
  }
}

/**
 * Diagnose all five required variables (plus the optional token-store) using
 * the core module's own validators. Safe to call with arbitrary env input —
 * it never throws and never returns secret material.
 */
export function diagnoseInstaLoginConfig(
  env: Record<string, string | undefined> = process.env,
): InstaDiagResult {
  const fields: InstaFieldDiag[] = [];

  fields.push(
    classifyBoolean("INSTAGRAM_LOGIN_APP_ID", cleaned(env, "INSTAGRAM_LOGIN_APP_ID"), (v) => numericId(v)),
  );

  const appSecret = cleaned(env, "INSTAGRAM_LOGIN_APP_SECRET");
  // Core rule: `required()` only checks non-empty + no embedded CR/LF at this
  // stage (truthiness is NOT verified against the provider). So PASS here
  // means "shape accepted", not "secret is correct".
  fields.push({
    field: "INSTAGRAM_LOGIN_APP_SECRET",
    status: appSecret === null ? "MISSING" : "PASS",
    note: appSecret === null ? undefined : "shape-only; not verified against provider",
  });

  fields.push(
    classifyBoolean("INSTAGRAM_LOGIN_REDIRECT_URI", cleaned(env, "INSTAGRAM_LOGIN_REDIRECT_URI"), (v) => publicHttpsRedirect(v)),
  );

  fields.push(classifyKey("INSTAGRAM_LOGIN_STATE_SECRET", cleaned(env, "INSTAGRAM_LOGIN_STATE_SECRET"), 32));
  fields.push(classifyKey("INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY", cleaned(env, "INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY"), 32));

  // Token store: validated with the runtime's own resolver. Unset means the durable
  // database store (needs DATABASE_URL); a present-but-malformed value, a missing database,
  // or a file store on Vercel is INVALID — it would make the OAuth routes fail at runtime.
  const tokenStoreRaw = env.INSTAGRAM_LOGIN_TOKEN_STORE;
  try {
    const store = resolveTokenStore(env);
    fields.push({
      field: "INSTAGRAM_LOGIN_TOKEN_STORE",
      status: "PASS",
      note: store.kind === "database" ? (tokenStoreRaw === undefined ? "default: database" : "database") : "file (local tests only)",
    });
  } catch (e) {
    fields.push({
      field: "INSTAGRAM_LOGIN_TOKEN_STORE",
      status: e instanceof InstagramOAuthError ? "INVALID" : "UNEXPECTED_EXCEPTION",
      note: tokenStoreRaw === undefined ? "database store needs DATABASE_URL" : "present but invalid (use \"database\" or file:<path> off Vercel)",
    });
  }

  const unexpected = fields.some((f) => f.status === "UNEXPECTED_EXCEPTION");
  const requiredOk = [...REQUIRED_FIELDS, "INSTAGRAM_LOGIN_TOKEN_STORE"].every((name) =>
    fields.find((f) => f.field === name)?.status === "PASS",
  );

  const overall: InstaDiagResult["overall"] = unexpected
    ? "UNEXPECTED_EXCEPTION"
    : requiredOk
      ? "PASS"
      : "FAIL";

  return { overall, fields, blocked: overall !== "PASS" };
}

/**
 * Compact, log-safe one-line summary. Contains field NAMES and statuses only,
 * never values. Intended for server-side audit logs.
 */
export function summariseInstaDiag(result: InstaDiagResult): string {
  const parts = result.fields.map((f) => `${f.field}=${f.status}`);
  return `INSTAGRAM_LOGIN_CONFIG overall=${result.overall} :: ${parts.join(" ")}`;
}

/**
 * Rate-limited, log-safe emit for the 503 (config-blocked) path.
 * - Logs the fixed event name + per-field NAME/STATUS only (never values,
 *   prefixes, hashes, cookies, codes, URLs, or exception objects).
 * - Throttled per-process so a burst of requests cannot flood the log.
 * - Returns the summary line for test assertions; returns null when throttled.
 */
const DIAG_LOG_INTERVAL_MS = 60_000;
let __lastDiagLogAtMs = 0;

export function logInstaDiagnostic(
  env: Record<string, string | undefined> = process.env,
  nowMs: number = Date.now(),
  force: boolean = false,
): string | null {
  const line = summariseInstaDiag(diagnoseInstaLoginConfig(env));
  if (!force && nowMs - __lastDiagLogAtMs < DIAG_LOG_INTERVAL_MS) return null;
  __lastDiagLogAtMs = nowMs;
  // Fixed event name + machine-safe single line. No secret material.
  console.log(`[insta-diag] ${line}`);
  return line;
}

export type InstaAuthorizationState =
  | "CONFIG_INCOMPLETE" // one or more settings MISSING/INVALID (see fields)
  | "STORAGE_UNAVAILABLE" // settings pass but the token store cannot be read
  | "NOT_AUTHORIZED" // store reachable, no token saved yet → owner must complete OAuth once
  | "EXPIRED" // a token was saved but is past its expiry → re-authorize
  | "AUTHORIZED"; // decryptable, unexpired token present (not a publish permission check)

/**
 * Runtime authorization state. Never returns token material; the account id is
 * reported only as "present" so logs and responses stay non-identifying.
 */
export async function diagnoseInstagramAuthorization(
  env: Record<string, string | undefined> = process.env,
): Promise<{ state: InstaAuthorizationState; config: InstaDiagResult; expiresAt?: string }> {
  const config = diagnoseInstaLoginConfig(env);
  if (config.blocked) return { state: "CONFIG_INCOMPLETE", config };
  try {
    const key = decodeKey(env.INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY!.trim(), 32);
    const inspected = await inspectInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: resolveTokenStore(env) });
    if (inspected.status === "valid") return { state: "AUTHORIZED", config, expiresAt: inspected.expiresAt };
    if (inspected.status === "expired") return { state: "EXPIRED", config, expiresAt: inspected.expiresAt };
    return { state: "NOT_AUTHORIZED", config };
  } catch {
    return { state: "STORAGE_UNAVAILABLE", config };
  }
}
