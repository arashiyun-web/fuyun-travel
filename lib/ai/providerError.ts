/** Sanitize upstream copywriter errors for logs and safe API fields. Never include keys or prompts. */

export type SanitizedProviderError = {
  provider_status: number | null;
  provider_error_type: string | null;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function redactSecrets(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9]{10,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._\-+=/]+/gi, "Bearer [REDACTED]")
    .replace(/x-api-key["'\s:=]+[^\s"'\\]+/gi, "x-api-key=[REDACTED]")
    .replace(/api[_-]?key["'\s:=]+[^\s"'\\]+/gi, "api_key=[REDACTED]")
    .replace(/\b[0-9a-fA-F]{32,}\b/g, "[REDACTED]");
}

function asStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function asType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeProviderError(err: unknown): SanitizedProviderError {
  const rec = isRecord(err) ? err : {};
  const nested = isRecord(rec.error) ? rec.error : null;
  const inner = nested && isRecord(nested.error) ? nested.error : null;
  const response = isRecord(rec.response) ? rec.response : null;

  const provider_status =
    asStatus(rec.status) ?? asStatus(rec.statusCode) ?? asStatus(response?.status) ?? null;

  const provider_error_type =
    asType(inner?.type) ??
    (asType(nested?.type) && nested?.type !== "error" ? asType(nested?.type) : null) ??
    asType(rec.type) ??
    null;

  const rawMessage = err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
  return {
    provider_status,
    provider_error_type,
    message: redactSecrets(rawMessage).slice(0, 300),
  };
}
