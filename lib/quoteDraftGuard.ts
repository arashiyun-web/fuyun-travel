/**
 * v11: shared state guards for writes that replace a quote's draft (regenerateLegacy, legacy-restore).
 * v12: also 「送出給 LINE」, 「依已核對車資產生草稿」 and the status of 「儲存正式報價」 (orderActionBlock,
 * statusChangeBlock).
 * Plain data only (no Prisma) so the admin detail page uses exactly the same rules to hide its buttons.
 *
 * The order part is the 「移除」 guard (archiveQuote): a row in the order flow (ORDER_PENDING, STAFF_PRICED)
 * or with any CharterOrder is never changed, because the order's quoteFingerprint is checked against the
 * row (lib/charterOrder.ts) and a changed row would make the order stale.
 */

export const ORDER_STATUSES: readonly string[] = ["ORDER_PENDING", "STAFF_PRICED"];
/** Sent to the customer, confirmed or removed: the draft is history and is never replaced. */
export const CLOSED_STATUSES: readonly string[] = ["SENT", "CONFIRMED", "ARCHIVED"];
/** Every status in which a draft replacement is refused (also used in the conditional UPDATE). */
export const DRAFT_LOCKED_STATUSES: readonly string[] = [...CLOSED_STATUSES, ...ORDER_STATUSES];

export const ORDER_LOCK_ERROR = "這筆詢價已經建立訂單，不能還原舊草稿。";
export const CLOSED_LOCK_ERROR = "這筆詢價已送出或已移除，不能還原舊草稿。";

export function isOrderStatus(status: unknown) {
  return typeof status === "string" && ORDER_STATUSES.indexOf(status) >= 0;
}

/** The 「移除」 guard: in the order flow or has an order. */
export function orderLocked(status: unknown, hasOrder: boolean) {
  return isOrderStatus(status) || hasOrder;
}

/**
 * Why the draft of this row may not be replaced, or null. `hasOrder` is whether a CharterOrder exists for the
 * row; pass true while unknown (the page does this before its order lookup finished).
 */
export function draftReplaceBlock(quote: { quoteStatus?: unknown; sentAt?: unknown }, hasOrder: boolean): string | null {
  if (orderLocked(quote.quoteStatus, hasOrder)) return ORDER_LOCK_ERROR;
  if ((typeof quote.quoteStatus === "string" && CLOSED_STATUSES.indexOf(quote.quoteStatus) >= 0) || quote.sentAt != null) return CLOSED_LOCK_ERROR;
  return null;
}

export const ORDER_SEND_ERROR = "這筆詢價已經建立訂單，不能再送出報價。";
export const ORDER_DRAFT_ERROR = "這筆詢價已經建立訂單，不能再產生草稿。";
export const ORDER_STATUS_ERROR = "這筆詢價已經建立訂單，狀態不能用儲存修改。";
export const ARCHIVE_STATUS_ERROR = "移除或還原請用清單上的按鈕。";
export const STATUS_NOT_ALLOWED_ERROR = "狀態只能改成 new、DRAFT 或 HANDOFF；送出、確認與訂單狀態由對應按鈕設定。";

/** v12: statuses staff may set with 「儲存正式報價」 (PATCH). Keeping the current status is always allowed. */
export const STAFF_SETTABLE_STATUSES: readonly string[] = ["new", "DRAFT", "HANDOFF"];

/**
 * v12: why 「送出給 LINE」 or 「依已核對車資產生草稿」 is refused for this row, or null. Only the order part of the
 * 「移除」 guard: ORDER_PENDING, STAFF_PRICED or any CharterOrder (pass true while unknown). Sent rows can be
 * re-sent and re-drafted as before.
 */
export function orderActionBlock(quote: { quoteStatus?: unknown }, hasOrder: boolean, action: "send" | "draft"): string | null {
  if (!orderLocked(quote.quoteStatus, hasOrder)) return null;
  return action === "send" ? ORDER_SEND_ERROR : ORDER_DRAFT_ERROR;
}

/**
 * v12: status allowlist for PATCH. Unchanged status: always fine. ARCHIVED in or out: only through
 * 移除／還原. A row in the order flow or with an order keeps its status. Otherwise only new, DRAFT, HANDOFF.
 */
export function statusChangeBlock(current: unknown, requested: string, hasOrder: boolean): string | null {
  if (requested === current) return null;
  if (requested === "ARCHIVED" || current === "ARCHIVED") return ARCHIVE_STATUS_ERROR;
  if (orderLocked(current, hasOrder)) return ORDER_STATUS_ERROR;
  if (STAFF_SETTABLE_STATUSES.indexOf(requested) < 0) return STATUS_NOT_ALLOWED_ERROR;
  return null;
}
