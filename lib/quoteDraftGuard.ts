/**
 * v11: shared state guards for writes that replace a quote's draft (regenerateLegacy, legacy-restore).
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
