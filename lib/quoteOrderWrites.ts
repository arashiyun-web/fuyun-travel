import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { guardedDraftWrite, hasOrder, jsonParam, lockRow, noOrderSql, orderTablePresent, type DraftWriteHooks, type QuoteRow } from "@/lib/quoteArchive";
import { ORDER_STATUSES, orderActionBlock, statusChangeBlock } from "@/lib/quoteDraftGuard";

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
const SEND_TX = { maxWait: 10000, timeout: 20000 };

/** Order presence read after the row lock (charter_orders may be absent on old databases: then no order). */
async function orderAfterLock(tx: Prisma.TransactionClient, quoteId: string, ordersTable: boolean) {
  return ordersTable && await hasOrder(tx, quoteId);
}

/**
 * Sends quoteDraftText of the locked row with `push` and sets status SENT and sent_at, both inside one
 * transaction: the status write is conditional (same row as read, not in the order flow, no order), and the
 * push happens only after it matched. A failed push rolls the status back. `check` runs the existing send
 * guards (empty text, sendBlock) on the locked row.
 */
export async function sendQuoteGuarded(
  quoteId: string,
  check: (quote: QuoteRow) => GuardFailure | null,
  push: (quote: QuoteRow) => Promise<void>,
  hooks?: DraftWriteHooks,
): Promise<{ ok: true; quote: QuoteRow | null } | GuardFailure> {
  return prisma.$transaction(async (tx): Promise<{ ok: true; quote: QuoteRow | null } | GuardFailure> => {
    const ordersTable = await orderTablePresent(tx);
    const quote = await lockRow(tx, quoteId);
    if (!quote) return { ok: false, status: 404, error: "Quote not found" };
    if (quote.quoteStatus === "ARCHIVED") return { ok: false, status: 409, error: "這筆詢價已移除，請先還原再送出。" };
    const blockedByOrder = orderActionBlock(quote, await orderAfterLock(tx, quoteId, ordersTable), "send");
    if (blockedByOrder) return { ok: false, status: 409, error: blockedByOrder };
    const blocked = check(quote);
    if (blocked) return blocked;
    if (hooks?.beforeWrite) await hooks.beforeWrite(tx, quoteId);
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
    await push(quote);
    return { ok: true, quote: await tx.charterQuote.findUnique({ where: { id: quoteId } }) };
  }, SEND_TX);
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
 */
export async function patchQuoteGuarded(
  quoteId: string,
  requested: string,
  build: (current: QuoteRow) => Prisma.CharterQuoteUpdateInput,
): Promise<{ ok: true; quote: QuoteRow } | GuardFailure> {
  return prisma.$transaction(async (tx): Promise<{ ok: true; quote: QuoteRow } | GuardFailure> => {
    const ordersTable = await orderTablePresent(tx);
    const current = await lockRow(tx, quoteId);
    if (!current) return { ok: false, status: 404, error: "Quote not found" };
    const changing = requested !== current.quoteStatus;
    const blocked = statusChangeBlock(current.quoteStatus, requested, changing && await orderAfterLock(tx, quoteId, ordersTable));
    if (blocked) return { ok: false, status: 409, error: blocked };
    const quote = await tx.charterQuote.update({ where: { id: quoteId }, data: build(current) });
    return { ok: true, quote };
  });
}
