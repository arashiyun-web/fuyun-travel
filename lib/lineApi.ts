const LINE_REPLY_API = "https://api.line.me/v2/bot/message/reply";
const LINE_PUSH_API = "https://api.line.me/v2/bot/message/push";

function accessToken() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  return token;
}

export async function replyLineText(replyToken: string, text: string) {
  const response = await fetch(LINE_REPLY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 4500) }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`LINE Reply API failed: ${response.status} ${errorText}`);
  }
}

/**
 * v13: how a push that was sent with an X-Line-Retry-Key ended (only returned when `options` are given).
 * "accepted": LINE accepted this request (2xx). "duplicate": LINE answered 409 with x-line-accepted-request-id,
 * i.e. an earlier request with the same key was already accepted within 24 h, so the customer already has it
 * (https://developers.line.biz/en/docs/messaging-api/retrying-api-request/).
 */
export type LinePushOutcome = { result: "accepted" | "duplicate"; requestId: string | null; acceptedRequestId: string | null };

/**
 * v13: a push that failed. `kind`:
 * - "uncertain": 5xx, timeout, network error, or a 409 that does not say it was accepted. LINE may or may not
 *   have delivered it; only a retry with the same key is safe.
 * - "rate_limited": 429, not accepted.
 * - "rejected": any other 4xx, not accepted; retrying the same request does not help.
 */
export class LinePushError extends Error {
  readonly kind: "uncertain" | "rate_limited" | "rejected";
  readonly status: number | null;
  constructor(message: string, kind: "uncertain" | "rate_limited" | "rejected", status: number | null) {
    super(message);
    this.name = "LinePushError";
    this.kind = kind;
    this.status = status;
  }
}

export type PushOptions = { retryKey: string; timeoutMs: number };

/**
 * Push one text message. Without `options` it behaves exactly as before v13 (no retry key, no timeout, throws
 * on any non-2xx). With `options` (the quote send button only): X-Line-Retry-Key, a fetch timeout, a 409
 * "already accepted" reported as delivered, and failures thrown as LinePushError.
 */
export async function pushLineText(to: string, text: string): Promise<void>;
export async function pushLineText(to: string, text: string, options: PushOptions): Promise<LinePushOutcome>;
export async function pushLineText(to: string, text: string, options?: PushOptions): Promise<void | LinePushOutcome> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken()}`,
  };
  const body = JSON.stringify({
    to,
    messages: [{ type: "text", text: text.slice(0, 4500) }],
  });
  if (!options) {
    const response = await fetch(LINE_PUSH_API, { method: "POST", headers, body });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`LINE Push API failed: ${response.status} ${errorText}`);
    }
    return;
  }

  headers["X-Line-Retry-Key"] = options.retryKey;
  let response: Response;
  try {
    response = await fetch(LINE_PUSH_API, { method: "POST", headers, body, signal: AbortSignal.timeout(options.timeoutMs) });
  } catch (error) {
    // Timeout or network failure: the request may have reached LINE.
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new LinePushError(`LINE Push API failed: no response (${reason})`, "uncertain", null);
  }
  const requestId = response.headers.get("x-line-request-id");
  if (response.ok) {
    await response.text().catch(() => "");
    return { result: "accepted", requestId, acceptedRequestId: requestId };
  }
  const errorText = await response.text().catch(() => "");
  const acceptedRequestId = response.headers.get("x-line-accepted-request-id");
  if (response.status === 409 && acceptedRequestId) return { result: "duplicate", requestId, acceptedRequestId };
  const kind = response.status === 429 ? "rate_limited" : response.status >= 400 && response.status < 500 && response.status !== 409 ? "rejected" : "uncertain";
  throw new LinePushError(`LINE Push API failed: ${response.status} ${errorText}`, kind, response.status);
}
