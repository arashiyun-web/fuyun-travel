import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { guardedDraftWrite, hasOrder, jsonParam, lockRow, noOrderSql, orderTablePresent, type DraftWriteHooks, type QuoteRow } from "@/lib/quoteArchive";
import { ORDER_STATUSES, SEND_UNCERTAIN_HINT, orderActionBlock, orderLocked, statusChangeBlock, vehicleChangeBlock } from "@/lib/quoteDraftGuard";

/**
 * v12: 「送出給 LINE」, 「依已核對車資產生草稿」 and 「儲存正式報價」 under the same row lock that order creation
 * (convertConfirmedQuote), 移除, regenerateLegacy and legacy-restore take. Each one
 * - reads the row after `SELECT … FOR UPDATE`, so an order created meanwhile is seen (convertConfirmedQuote
 *   waits for the lock, or this waits for it);
 * - refuses rows in ORDER_PENDING / STAFF_PRICED or with a CharterOrder (lib/quoteDraftGuard.ts) with 409;
 * - repeats that guard in the UPDATE itself (status not in ORDER_STATUSES, NOT EXISTS charter_orders, row
 *   unchanged since the read), so nothing is written when the guard no longer holds.
 */

export type GuardFailure = { ok: false; status: number; error: string; code?: string };
export const STALE_ERROR = "狀態剛被改過，請重新整理後再試。";

/** LINE push runs inside the transaction; allow it time before Prisma rolls back. */
export const SEND_TX = { maxWait: 10000, timeout: 20000 };
/** v13: the LINE fetch never runs longer than this … */
export const PUSH_TIMEOUT_MS = 8000;
/** … nor closer than this to the transaction timeout (time left for the status write and the commit) … */
export const PUSH_TX_MARGIN_MS = 3000;
/** … and is not started at all when less than this would be left (then nothing was sent: 503). */
export const PUSH_MIN_MS = 2000;

/** v13: shown whenever the push started but the outcome is not known (the customer may already have it). */
export const SEND_UNCERTAIN_ERROR = SEND_UNCERTAIN_HINT;
export const SEND_REJECTED_ERROR = "LINE 拒絕這次送出，未送達。請檢查內容或客人的 LINE 狀態，直接重送不會成功。";
export const SEND_RATE_LIMIT_ERROR = "LINE 暫時限制送出次數，這次未送達，請稍後再送。";
export const SEND_BUSY_ERROR = "系統忙碌，這次沒有送出，請稍後再按一次。";

/** Result of the push function given to sendQuoteGuarded. `void` (older doubles) counts as accepted. */
export type SendPushOutcome = { result: "accepted" | "duplicate"; requestId?: string | null; acceptedRequestId?: string | null } | void;
export type SendHooks = DraftWriteHooks & { afterPush?: (tx: Prisma.TransactionClient, quoteId: string) => Promise<void>; now?: () => number };
export type SendResult = { ok: true; quote: QuoteRow | null; alreadyDelivered: boolean; acceptedRequestId: string | null } | GuardFailure;

/** Thrown inside the transaction to roll it back when there is not enough time left to push. */
class NotEnoughTime extends Error {}

/** Order presence read after the row lock (charter_orders may be absent on old databases: then no order). */
async function orderAfterLock(tx: Prisma.TransactionClient, quoteId: string, ordersTable: boolean) {
  return ordersTable && await hasOrder(tx, quoteId);
}

function pushFailure(error: unknown): GuardFailure {
  const kind = error && typeof error === "object" && "kind" in error ? (error as { kind?: unknown }).kind : null;
  if (kind === "rejected") return { ok: false, status: 502, code: "LINE_REJECTED", error: SEND_REJECTED_ERROR };
  if (kind === "rate_limited") return { ok: false, status: 503, code: "LINE_RATE_LIMIT", error: SEND_RATE_LIMIT_ERROR };
  return { ok: false, status: 500, code: "LINE_UNCERTAIN", error: SEND_UNCERTAIN_ERROR };
}

/**
 * Sends quoteDraftText of the locked row with `push` and sets status SENT and sent_at, both inside one
 * transaction: the status write is conditional (same row as read, not in the order flow, no order), and the
 * push happens only after it matched. A failed push rolls the status back. `check` runs the existing send
 * guards (empty text, sendBlock) on the locked row.
 *
 * v13: `push` gets a time budget (≤ PUSH_TIMEOUT_MS and ≥ PUSH_TX_MARGIN_MS before the transaction timeout) and
 * is expected to send with a deterministic X-Line-Retry-Key, so a retry after any unknown outcome is not
 * delivered twice. Outcomes:
 * - accepted → SENT; duplicate (LINE: already accepted within 24 h) → also SENT, the customer has it; if the
 *   row was already SENT its sent_at is kept.
 * - push failed: rejected 502 / rate limited 503 (not delivered) or uncertain 500; status rolled back.
 * - anything failing after the push started (commit, connection, transaction timeout): 500 uncertain.
 * - not enough time left before the push: 503, nothing sent, nothing written.
 */
export async function sendQuoteGuarded(
  quoteId: string,
  check: (quote: QuoteRow) => GuardFailure | null,
  push: (quote: QuoteRow, budget: { timeoutMs: number }) => Promise<SendPushOutcome>,
  hooks?: SendHooks,
): Promise<SendResult> {
  const now = hooks?.now ?? Date.now;
  let pushStarted = false;
  let pushError: unknown = null;
  try {
    return await prisma.$transaction(async (tx): Promise<SendResult> => {
      const txStart = now();
      const ordersTable = await orderTablePresent(tx);
      const quote = await lockRow(tx, quoteId);
      if (!quote) return { ok: false, status: 404, error: "Quote not found" };
      if (quote.quoteStatus === "ARCHIVED") return { ok: false, status: 409, error: "這筆詢價已移除，請先還原再送出。" };
      const blockedByOrder = orderActionBlock(quote, await orderAfterLock(tx, quoteId, ordersTable), "send");
      if (blockedByOrder) return { ok: false, status: 409, error: blockedByOrder };
      const blocked = check(quote);
      if (blocked) return blocked;
      if (hooks?.beforeWrite) await hooks.beforeWrite(tx, quoteId);
      if (SEND_TX.timeout - (now() - txStart) - PUSH_TX_MARGIN_MS < PUSH_MIN_MS) return { ok: false, status: 503, code: "LINE_NOT_SENT", error: SEND_BUSY_ERROR };
      const sentAt = new Date().toISOString();
      const count = await tx.$executeRaw(Prisma.sql`UPDATE charter_quotes AS q
      SET quote_status = 'SENT', sent_at = CAST(${sentAt} AS timestamptz) AT TIME ZONE 'UTC'
      WHERE q.id = ${quote.id}
        AND q.quote_status = ${quote.quoteStatus}
        AND q.quote_status NOT IN (${Prisma.join(ORDER_STATUSES.slice())})
        AND q.quote_draft_text IS NOT DISTINCT FROM ${quote.quoteDraftText}
        AND q.quote_options IS NOT DISTINCT FROM CAST(${jsonParam(quote.quoteOptions)} AS jsonb)${noOrderSql(ordersTable)}`);
      if (count !== 1) {
        return { ok: false, status: 409, error: await orderAfterLock(tx, quoteId, ordersTable) ? orderActionBlock(quote, true, "send") as string : STALE_ERROR };
      }
      const timeoutMs = Math.min(PUSH_TIMEOUT_MS, SEND_TX.timeout - (now() - txStart) - PUSH_TX_MARGIN_MS);
      if (timeoutMs < PUSH_MIN_MS) throw new NotEnoughTime();
      pushStarted = true;
      let outcome: SendPushOutcome;
      try {
        outcome = await push(quote, { timeoutMs });
      } catch (error) {
        pushError = error;
        throw error;
      }
      const duplicate = Boolean(outcome && outcome.result === "duplicate");
      if (duplicate && quote.quoteStatus === "SENT" && quote.sentAt != null) {
        // Already sent and LINE says the customer has this exact content: keep the original send time.
        const keep = new Date(quote.sentAt).toISOString();
        await tx.$executeRaw(Prisma.sql`UPDATE charter_quotes SET sent_at = CAST(${keep} AS timestamptz) AT TIME ZONE 'UTC' WHERE id = ${quote.id}`);
      }
      if (hooks?.afterPush) await hooks.afterPush(tx, quoteId);
      return {
        ok: true,
        quote: await tx.charterQuote.findUnique({ where: { id: quoteId } }),
        alreadyDelivered: duplicate,
        acceptedRequestId: outcome ? outcome.acceptedRequestId ?? outcome.requestId ?? null : null,
      };
    }, SEND_TX);
  } catch (error) {
    if (error instanceof NotEnoughTime) return { ok: false, status: 503, code: "LINE_NOT_SENT", error: SEND_BUSY_ERROR };
    if (!pushStarted) throw error;
    // The push failed (pushError), or it may have been accepted and then the commit / connection / transaction
    // timeout failed: the status is rolled back; a retry uses the same retry key.
    return pushFailure(pushError ?? error);
  }
}

export type FleetDraftWrite = {
  data: { quoteDraftText: string; recommendedVehicle: string | null; quoteOptions: Record<string, unknown> };
  extra: Record<string, unknown>;
};

/**
 * 「依已核對車資產生草稿」: `build` makes the new draft from the locked row (or a 400); written with the
 * conditional UPDATE (guardedDraftWrite, locked = ORDER_STATUSES; sent rows may still be re-drafted as before).
 */
export async function fleetDraftGuarded(
  quoteId: string,
  build: (quote: QuoteRow) => FleetDraftWrite | GuardFailure,
  hooks?: DraftWriteHooks,
): Promise<{ ok: true; quote: QuoteRow | null; extra: Record<string, unknown> } | GuardFailure> {
  return prisma.$transaction(async (tx): Promise<{ ok: true; quote: QuoteRow | null; extra: Record<string, unknown> } | GuardFailure> => {
    const ordersTable = await orderTablePresent(tx);
    const quote = await lockRow(tx, quoteId);
    if (!quote) return { ok: false, status: 404, error: "Quote not found" };
    const built = build(quote);
    if ("ok" in built) return built;
    const blocked = orderActionBlock(quote, await orderAfterLock(tx, quoteId, ordersTable), "draft");
    if (blocked) return { ok: false, status: 409, error: blocked };
    if (hooks?.beforeWrite) await hooks.beforeWrite(tx, quoteId);
    const count = await guardedDraftWrite(tx, quote, built.data, ordersTable, { locked: ORDER_STATUSES, unsentOnly: false });
    if (count !== 1) {
      return { ok: false, status: 409, error: await orderAfterLock(tx, quoteId, ordersTable) ? orderActionBlock(quote, true, "draft") as string : STALE_ERROR };
    }
    return { ok: true, quote: await tx.charterQuote.findUnique({ where: { id: quoteId } }), extra: built.extra };
  });
}

/**
 * 「儲存正式報價」 (PATCH), v12: read-modify-write under the row lock (a restore or regenerate in between can no
 * longer be overwritten by options read before it), and the status allowlist (statusChangeBlock). Draft text
 * and recommended vehicle are saved as before.
 *
 * v13: on a row in the order flow or with an order (looked up under the same lock), a different
 * recommended_vehicle is refused with 409 (vehicleChangeBlock), and neither recommended_vehicle nor
 * quote_options is written, so the order's quoteFingerprint cannot go stale through this route. `build` gets
 * `ordered` to leave them out.
 */
export async function patchQuoteGuarded(
  quoteId: string,
  requested: string,
  requestedVehicle: string,
  build: (current: QuoteRow, ordered: boolean) => Prisma.CharterQuoteUpdateInput,
): Promise<{ ok: true; quote: QuoteRow } | GuardFailure> {
  return prisma.$transaction(async (tx): Promise<{ ok: true; quote: QuoteRow } | GuardFailure> => {
    const ordersTable = await orderTablePresent(tx);
    const current = await lockRow(tx, quoteId);
    if (!current) return { ok: false, status: 404, error: "Quote not found" };
    const withOrder = await orderAfterLock(tx, quoteId, ordersTable);
    const blocked = statusChangeBlock(current.quoteStatus, requested, withOrder);
    if (blocked) return { ok: false, status: 409, error: blocked };
    const vehicleBlocked = vehicleChangeBlock(current, requestedVehicle, withOrder);
    if (vehicleBlocked) return { ok: false, status: 409, error: vehicleBlocked };
    const ordered = orderLocked(current.quoteStatus, withOrder);
    const data = build(current, ordered);
    if (ordered) {
      delete data.recommendedVehicle;
      delete data.quoteOptions;
    }
    const quote = await tx.charterQuote.update({ where: { id: quoteId }, data });
    return { ok: true, quote };
  });
}
