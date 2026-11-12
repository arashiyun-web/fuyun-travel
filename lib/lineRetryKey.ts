import { createHash } from "crypto";

/**
 * v13: X-Line-Retry-Key for 「送出給 LINE」 without a schema change.
 *
 * key = UUIDv5(QUOTE_SEND_NAMESPACE, quote id + LINE user id + SHA-256 of the exact text pushed)
 *
 * Same quote, same recipient and same content always give the same key, so any retry of a send whose outcome is
 * unknown (5xx, timeout, commit failed after LINE accepted) is answered by LINE with 409 "already accepted"
 * instead of a second message. LINE keeps a key for 24 hours after the first request; after that the same key
 * is delivered again. Changing the text or the recipient gives a new key (LINE requires identical retries).
 */
export const QUOTE_SEND_NAMESPACE = "6f1d3c52-8e4a-5b7e-9c0d-2a4b6e8f1a3c";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** RFC 9562 UUID version 5 (SHA-1, name-based). */
export function uuidV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  if (ns.length !== 16) throw new Error("invalid namespace UUID");
  const hash = createHash("sha1").update(ns).update(Buffer.from(name, "utf8")).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The text LINE receives (pushLineText sends at most 4,500 characters). */
export function pushedText(text: string) {
  return text.slice(0, 4500);
}

export function quoteSendRetryKey(quoteId: string, lineUserId: string, text: string): string {
  const contentHash = createHash("sha256").update(pushedText(text), "utf8").digest("hex");
  return uuidV5(`fuyun-quote-send\n${quoteId}\n${lineUserId}\n${contentHash}`, QUOTE_SEND_NAMESPACE);
}
