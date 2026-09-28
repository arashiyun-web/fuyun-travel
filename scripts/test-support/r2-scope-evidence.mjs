// Evidence helpers for the R2 runtime credential. Four facts are kept separate and never stand in for
// one another: object read/write works, anonymous S3 read is refused, public entry points are off
// (r2.dev + custom domains, from the management API), and the token policy is limited to one bucket.
// A failed S3 call only counts as a refusal when R2 answered 403 AccessDenied; NoSuchBucket, auth
// errors, network failures and timeouts are inconclusive.

import { createHash } from "node:crypto";

export const sha256Hex = (v) => createHash("sha256").update(String(v)).digest("hex");

const NETWORK_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);
const AUTH_NAMES = new Set(["InvalidAccessKeyId", "SignatureDoesNotMatch", "InvalidToken", "ExpiredToken", "Unauthorized"]);

export function classifyS3Error(err) {
  const name = err?.name || err?.Code || "";
  const status = err?.$metadata?.httpStatusCode;
  const code = err?.code || err?.cause?.code || "";
  if (name === "TimeoutError" || name === "AbortError" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") return { kind: "timeout", name, status, code };
  if (NETWORK_CODES.has(code) || (name === "TypeError" && /fetch failed/i.test(err?.message || ""))) return { kind: "network", name, status, code };
  if (name === "NoSuchBucket" || status === 404) return { kind: "no_such_bucket", name, status, code };
  if (AUTH_NAMES.has(name) || status === 401) return { kind: "auth_error", name, status, code };
  if (name === "AccessDenied" && status === 403) return { kind: "access_denied", name, status, code };
  return { kind: "other", name, status, code };
}

// Runs an S3 call that is expected to be refused. "refused" only for a 403 AccessDenied answer.
export async function expectRefused(send, { timeoutMs = 15000 } = {}) {
  const timeout = new Promise((_, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("probe timed out"), { name: "TimeoutError" })), timeoutMs);
    t.unref?.();
  });
  try {
    await Promise.race([send(), timeout]);
    return { outcome: "allowed" };
  } catch (err) {
    const c = classifyS3Error(err);
    return { outcome: c.kind === "access_denied" ? "refused" : "inconclusive", ...c };
  }
}

// Unsigned (anonymous) GET against the S3 endpoint. R2 answers 400 InvalidArgument "Authorization" for
// any bucket, existing or not (observed 2026-09-28), so "refused" only says the S3 API demands a
// signature. It does not show the bucket is private — that is the management-API check.
export function classifyAnonymousGet(status, bodyText = "") {
  const code = (bodyText.match(/<Code>([^<]+)<\/Code>/) || [])[1] || "";
  const message = (bodyText.match(/<Message>([^<]+)<\/Message>/) || [])[1] || "";
  if (status === 200) return { outcome: "readable", status, code };
  if (status === 400 && code === "InvalidArgument" && /^Authorization/.test(message)) return { outcome: "refused", status, code };
  if ((status === 401 || status === 403) && /^(AccessDenied|Unauthorized)$/.test(code)) return { outcome: "refused", status, code };
  return { outcome: "inconclusive", status, code };
}

// Management-API evidence from `wrangler r2 bucket dev-url get` and `r2 bucket domain list` output.
export function classifyPublicEntry(devUrlOutput, domainListOutput) {
  const devUrlDisabled = /Public access via the r2\.dev URL is disabled\./.test(devUrlOutput);
  const noCustomDomains = /There are no custom domains connected to this bucket\./.test(domainListOutput);
  return { devUrlDisabled, noCustomDomains, closed: devUrlDisabled && noCustomDomains };
}

const READ = "Workers R2 Storage Bucket Item Read";
const WRITE = "Workers R2 Storage Bucket Item Write";

// Evaluates a Cloudflare API token (the R2 Access Key ID is the token id) against the expected scope:
// Object Read & Write, allow-only, a single resource naming exactly this bucket, no wildcard.
export function evaluateTokenPolicy(token, { accessKeyId, accountId, bucket }) {
  const problems = [];
  // Saved evidence carries only id_sha256 so the Access Key ID never lands in a file or log.
  const idMatches = !!token && (token.id ? token.id === accessKeyId : token.id_sha256 === sha256Hex(accessKeyId));
  if (!idMatches) problems.push("token id does not match the runtime Access Key ID");
  if (token?.status !== "active") problems.push(`token status ${token?.status}`);
  const policies = token?.policies || [];
  if (policies.length === 0) problems.push("no policies");
  const perms = new Set();
  const resources = new Set();
  for (const p of policies) {
    if (p.effect !== "allow") problems.push(`policy effect ${p.effect}`);
    for (const g of p.permission_groups || []) perms.add(g.name);
    for (const [k, v] of Object.entries(p.resources || {})) {
      if (typeof v === "object") problems.push(`nested resource ${k}`);
      if (v !== "*") problems.push(`resource ${k} not "*"`);
      resources.add(k);
    }
  }
  const unexpected = [...perms].filter((n) => n !== READ && n !== WRITE);
  if (unexpected.length) problems.push(`unexpected permissions: ${unexpected.join(", ")}`);
  if (!perms.has(READ) || !perms.has(WRITE)) problems.push("not Object Read & Write");
  const expected = `com.cloudflare.edge.r2.bucket.${accountId}_default_${bucket}`;
  if (resources.size !== 1 || !resources.has(expected)) problems.push(`resources ${[...resources].join(", ") || "(none)"} ≠ ${expected}`);
  if ([...resources].some((r) => r.includes("*") || /^com\.cloudflare\.api\.account\./.test(r))) problems.push("account-wide or wildcard resource");
  return { scoped: problems.length === 0, problems, permissions: [...perms].sort(), resources: [...resources].sort() };
}
