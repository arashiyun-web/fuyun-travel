import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuotePrefill, needsPrefill } from "@/lib/quotePrefill";
import { autoDraftOf, draftFingerprint } from "@/lib/quoteSendGuard";
import { isUntouchedLegacyV5Draft } from "@/lib/legacyFleetDraftV5";
import { DRAFT_LOCKED_STATUSES, ORDER_LOCK_ERROR, draftReplaceBlock, isOrderStatus, orderLocked } from "@/lib/quoteDraftGuard";

/**
 * Soft removal for LINE quotes. Rows are never deleted: quoteStatus becomes ARCHIVED and the
 * previous status is kept in quoteOptions.archive so it can be restored. Quotes that already
 * have a CharterOrder (or are in the order flow) cannot be archived.
 */

export const ARCHIVED = "ARCHIVED";
export const QUOTE_PAGE_SIZE = 20;

/** Customer requirements complete; waiting for a human (v6 range-quote handoff). Listed first. */
export const HANDOFF = "HANDOFF";

export type QuoteTab = "handoff" | "pending" | "sent" | "archived";
export const QUOTE_TABS: Array<{ key: QuoteTab; label: string }> = [
  { key: "handoff", label: "待真人客服" },
  { key: "pending", label: "待處理" },
  { key: "sent", label: "已報價（送出）" },
  { key: "archived", label: "已移除" },
];

export function quoteTab(value: unknown): QuoteTab {
  return value === "sent" || value === "archived" || value === "handoff" ? value : "pending";
}

export function tabWhere(tab: QuoteTab): Prisma.CharterQuoteWhereInput {
  if (tab === "archived") return { quoteStatus: ARCHIVED };
  if (tab === "sent") return { quoteStatus: { in: ["SENT", "CONFIRMED"] } };
  if (tab === "handoff") return { quoteStatus: HANDOFF };
  return { quoteStatus: { notIn: [ARCHIVED, "SENT", "CONFIRMED", HANDOFF] } };
}

/** Rows staff still work on (待真人客服 + 待處理). Used by the batch prefill. */
export function openWhere(): Prisma.CharterQuoteWhereInput {
  return { quoteStatus: { notIn: [ARCHIVED, "SENT", "CONFIRMED"] } };
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function missingOrderTable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2010")) return true;
  const message = error instanceof Error ? error.message : "";
  return /charter_orders/.test(message) && /does not exist|不存在/.test(message);
}

export async function hasOrder(tx: Prisma.TransactionClient, quoteId: string) {
  try {
    return Boolean(await tx.charterOrder.findUnique({ where: { quoteId }, select: { id: true } }));
  } catch (error) {
    if (missingOrderTable(error)) return false;
    throw error;
  }
}

/** Quote ids among `ids` that already have an order. Missing order table means none. */
export async function quoteIdsWithOrders(ids: string[]) {
  if (!ids.length) return new Set<string>();
  try {
    const rows = await prisma.charterOrder.findMany({ where: { quoteId: { in: ids } }, select: { quoteId: true } });
    return new Set(rows.map((row) => row.quoteId));
  } catch (error) {
    if (missingOrderTable(error)) return new Set<string>();
    throw error;
  }
}

export type ArchiveResult =
  | { ok: true; status: 200; quoteStatus: string; changed: boolean }
  | { ok: false; status: 404 | 409; error: string };

export async function archiveQuote(quoteId: string): Promise<ArchiveResult> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM charter_quotes WHERE id = ${quoteId} FOR UPDATE`;
    if (!locked.length) return { ok: false as const, status: 404 as const, error: "找不到這筆詢價" };
    const quote = await tx.charterQuote.findUnique({ where: { id: quoteId } });
    if (!quote) return { ok: false as const, status: 404 as const, error: "找不到這筆詢價" };
    if (quote.quoteStatus === ARCHIVED) return { ok: true as const, status: 200 as const, quoteStatus: ARCHIVED, changed: false };
    if (isOrderStatus(quote.quoteStatus) || await hasOrder(tx, quoteId)) {
      return { ok: false as const, status: 409 as const, error: "這筆詢價已經建立訂單，不能移除。" };
    }
    const options = Array.isArray(quote.quoteOptions)
      ? (quote.quoteOptions.length ? { legacyOptions: quote.quoteOptions } : {})
      : { ...object(quote.quoteOptions) };
    const data = {
      ...options,
      archive: { previousStatus: quote.quoteStatus, archivedAt: new Date().toISOString() },
    };
    const updated = await tx.charterQuote.updateMany({
      where: { id: quoteId, quoteStatus: quote.quoteStatus },
      data: { quoteStatus: ARCHIVED, quoteOptions: data as Prisma.InputJsonObject },
    });
    if (updated.count !== 1) return { ok: false as const, status: 409 as const, error: "狀態剛被改過，請重新整理後再試。" };
    return { ok: true as const, status: 200 as const, quoteStatus: ARCHIVED, changed: true };
  });
}

export async function restoreQuote(quoteId: string): Promise<ArchiveResult> {
  const quote = await prisma.charterQuote.findUnique({ where: { id: quoteId } });
  if (!quote) return { ok: false, status: 404, error: "找不到這筆詢價" };
  if (quote.quoteStatus !== ARCHIVED) return { ok: true, status: 200, quoteStatus: quote.quoteStatus, changed: false };
  const options = { ...object(quote.quoteOptions) };
  const archive = object(options.archive);
  delete options.archive;
  const previous = typeof archive.previousStatus === "string" && archive.previousStatus && archive.previousStatus !== ARCHIVED
    ? archive.previousStatus.slice(0, 40)
    : "DRAFT";
  const updated = await prisma.charterQuote.updateMany({
    where: { id: quoteId, quoteStatus: ARCHIVED },
    data: { quoteStatus: previous, quoteOptions: options as Prisma.InputJsonObject },
  });
  if (updated.count !== 1) return { ok: false, status: 409, error: "狀態剛被改過，請重新整理後再試。" };
  return { ok: true, status: 200, quoteStatus: previous, changed: true };
}

/**
 * Fills drafts for inquiries that never got one. Only quoteDraftText, quoteOptions and an empty
 * recommendedVehicle are written; status is unchanged. Re-running skips rows that now have a draft.
 */
export async function backfillQuoteDrafts(options: { dryRun?: boolean; limit?: number } = {}) {
  const limit = Math.min(Math.max(Math.floor(options.limit || 100), 1), 200);
  const rows = await prisma.charterQuote.findMany({
    where: { AND: [openWhere(), { OR: [{ quoteDraftText: null }, { quoteDraftText: "" }] }] },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const withOrders = await quoteIdsWithOrders(rows.map((row) => row.id));
  const generated: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const row of rows) {
    if (!needsPrefill(row)) { skipped.push({ id: row.id, reason: "已有草稿" }); continue; }
    if (withOrders.has(row.id)) { skipped.push({ id: row.id, reason: "已有訂單" }); continue; }
    if (options.dryRun) { generated.push(row.id); continue; }
    const prefill = buildQuotePrefill(row, "backfill");
    const updated = await prisma.charterQuote.updateMany({
      where: { id: row.id, quoteStatus: row.quoteStatus, OR: [{ quoteDraftText: null }, { quoteDraftText: "" }] },
      data: {
        quoteDraftText: prefill.quoteDraftText,
        quoteOptions: prefill.quoteOptions as Prisma.InputJsonObject,
        recommendedVehicle: prefill.recommendedVehicle,
      },
    });
    if (updated.count === 1) generated.push(row.id);
    else skipped.push({ id: row.id, reason: "同時被改過" });
  }
  return { generated, skipped, dryRun: Boolean(options.dryRun), sendsToCustomer: false as const };
}

/** v5-style staff draft (「依已核對車資產生草稿」 before v6). Such text is never sendable as is. */
export const LEGACY_DRAFT_PREFIX = "【後台報價草稿】";
export const REGENERATE_MAX_IDS = 50;
export const LEGACY_MAYBE_EDITED = "舊格式但可能已被人員修改";

export function isLegacyDraftRow(row: { quoteStatus?: string | null; sentAt?: Date | string | null; quoteDraftText?: string | null }) {
  return row.quoteStatus === "new" && row.sentAt == null && typeof row.quoteDraftText === "string" && row.quoteDraftText.trimStart().startsWith(LEGACY_DRAFT_PREFIX);
}

/**
 * True when the stored draft is still exactly what automatic prefill (v6+ buildQuotePrefill: LINE webhook or
 * batch prefill) wrote: quoteOptions.autoDraft from the rangeQuote engine, not marked staff-reviewed, and
 * its textFingerprint equals the fingerprint of the current text. Any staff edit (PATCH sets staffReviewed
 * and changes the text) or the fleet button (rewrites the text, not the fingerprint) makes this false.
 */
export function isUneditedAutoDraft(row: { quoteDraftText?: string | null; quoteOptions?: unknown }) {
  const meta = autoDraftOf(row.quoteOptions);
  if (!meta || meta.engine !== "rangeQuote" || meta.staffReviewed === true) return false;
  // 「依已核對車資產生草稿」 is a staff action (it stores fleetFare); such a draft is never replaced here.
  if (object(row.quoteOptions).fleetFare !== undefined) return false;
  if (typeof meta.textFingerprint !== "string" || typeof row.quoteDraftText !== "string" || !row.quoteDraftText.trim()) return false;
  return draftFingerprint(row.quoteDraftText) === meta.textFingerprint;
}

/** Valid id list for regenerateLegacy, or null. Explicit ids only; never "all rows". */
export function regenerateIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length || value.length > REGENERATE_MAX_IDS) return null;
  if (!value.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id))) return null;
  return Array.from(new Set(value as string[]));
}

export type QuoteRow = NonNullable<Awaited<ReturnType<typeof prisma.charterQuote.findUnique>>>;

/** Test seam only (like ConvertHooks in charterOrder.ts): runs inside the transaction right before the UPDATE. */
export type DraftWriteHooks = { beforeWrite?: (tx: Prisma.TransactionClient, quoteId: string) => Promise<void> };

/** Bookkeeping keys that live beside a draft and are never part of a saved draft snapshot. */
const BOOKKEEPING_KEYS = ["legacyDraft", "regenerated", "restoreHistory"];
export const RESTORE_HISTORY_MAX = 20;

function optionsObject(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return value.length ? { legacyOptions: value } : {};
  return { ...object(value) };
}

function snapshotOptions(value: unknown) {
  const out = optionsObject(value);
  for (const key of BOOKKEEPING_KEYS) delete out[key];
  return out;
}

export async function orderTablePresent(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ present: boolean }>>`SELECT to_regclass('charter_orders') IS NOT NULL AS present`;
  return Boolean(rows[0] && rows[0].present);
}

/** Row lock shared with archiveQuote and convertConfirmedQuote (order creation), then a fresh read. */
export async function lockRow(tx: Prisma.TransactionClient, quoteId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM charter_quotes WHERE id = ${quoteId} FOR UPDATE`;
  if (!locked.length) return null;
  return tx.charterQuote.findUnique({ where: { id: quoteId } });
}

/** v12: the 「no order」 part of every guarded UPDATE (omitted only where charter_orders does not exist). */
export function noOrderSql(ordersTable: boolean) {
  return ordersTable ? Prisma.sql` AND NOT EXISTS (SELECT 1 FROM charter_orders o WHERE o.quote_id = q.id)` : Prisma.empty;
}

export function jsonParam(value: unknown) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

/**
 * v11: the only write used by regenerateLegacy and legacy-restore (v12: and, with `scope.locked` =
 * ORDER_STATUSES and `scope.unsentOnly` = false, the fleet draft button). The state guard is repeated in the
 * UPDATE itself: it changes the row only while it is exactly as read (status, draft text, recommended vehicle
 * and quote_options), its status is none of `scope.locked` (default DRAFT_LOCKED_STATUSES), sent_at is null
 * (unless unsentOnly is false) and no charter_orders row exists for it. Returns the number of rows written.
 */
export async function guardedDraftWrite(
  tx: Prisma.TransactionClient,
  expected: QuoteRow,
  data: { quoteDraftText: string; recommendedVehicle: string | null; quoteOptions: Record<string, unknown> },
  ordersTable: boolean,
  scope: { locked: readonly string[]; unsentOnly: boolean } = { locked: DRAFT_LOCKED_STATUSES, unsentOnly: true },
) {
  const noOrder = noOrderSql(ordersTable);
  const unsent = scope.unsentOnly ? Prisma.sql`
      AND q.sent_at IS NULL` : Prisma.empty;
  const query = Prisma.sql`UPDATE charter_quotes AS q
    SET quote_draft_text = ${data.quoteDraftText}, recommended_vehicle = ${data.recommendedVehicle}, quote_options = CAST(${JSON.stringify(data.quoteOptions)} AS jsonb)
    WHERE q.id = ${expected.id}
      AND q.quote_status = ${expected.quoteStatus}
      AND q.quote_status NOT IN (${Prisma.join(scope.locked.slice())})${unsent}
      AND q.quote_draft_text IS NOT DISTINCT FROM ${expected.quoteDraftText}
      AND q.recommended_vehicle IS NOT DISTINCT FROM ${expected.recommendedVehicle}
      AND q.quote_options IS NOT DISTINCT FROM CAST(${jsonParam(expected.quoteOptions)} AS jsonb)${noOrder}`;
  return tx.$executeRaw(query);
}

/**
 * v9–v11, explicit opt-in only (POST /api/admin/quotes/prefill {regenerateLegacy:true, ids:[…]}): rebuilds the
 * range draft for the listed rows that hold an old 「【後台報價草稿】…」 text that is byte for byte the v5
 * button output for the row's own data, or an unedited automatic prefill draft (isUneditedAutoDraft).
 * Same order guard as 「移除」: rows in ORDER_PENDING / STAFF_PRICED or with an order are skipped, and so are
 * rows not in status 'new' or with sent_at. The check is repeated under the row lock and in the UPDATE
 * itself (guardedDraftWrite), so an order created meanwhile is never overwritten.
 * The replaced text, recommended vehicle and options are kept in quoteOptions.legacyDraft (the first one is
 * never overwritten). Status and sent_at are unchanged. Nothing is sent to anyone.
 */
export async function regenerateLegacyDrafts(options: { ids: string[]; dryRun?: boolean }, hooks?: DraftWriteHooks) {
  const ids = options.ids;
  const rows = await prisma.charterQuote.findMany({ where: { id: { in: ids } } });
  const withOrders = await quoteIdsWithOrders(rows.map((row) => row.id));
  const generated: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  for (const id of ids) {
    const row = rows.find((item) => item.id === id);
    if (!row) { skipped.push({ id, reason: "找不到" }); continue; }
    if (orderLocked(row.quoteStatus, withOrders.has(row.id))) { skipped.push({ id, reason: "已有訂單" }); continue; }
    if (row.quoteStatus !== "new") { skipped.push({ id, reason: "狀態不是 new" }); continue; }
    if (row.sentAt != null) { skipped.push({ id, reason: "已送出過" }); continue; }
    // v10: an old-format draft is replaced only when it is byte for byte what the v5 button produced for
    // this row's own data; anything else may carry staff additions and is left alone.
    const legacy = isLegacyDraftRow(row);
    if (legacy && !isUntouchedLegacyV5Draft(row)) { skipped.push({ id, reason: LEGACY_MAYBE_EDITED }); continue; }
    if (!legacy && !isUneditedAutoDraft(row)) { skipped.push({ id, reason: "草稿不是舊格式或已被人員修改" }); continue; }
    const now = new Date();
    const prefill = buildQuotePrefill(row, "backfill", now);
    // Already the current draft (e.g. a second run): nothing to change, and the first legacyDraft stays.
    if (prefill.quoteDraftText === row.quoteDraftText) { skipped.push({ id, reason: "已是最新草稿" }); continue; }
    if (options.dryRun) { generated.push(row.id); continue; }
    const previous = optionsObject(row.quoteOptions);
    const kept = object(previous.legacyDraft);
    const kind = legacy ? "legacyV5" : "autoDraft";
    const legacyDraft = typeof kept.text === "string" ? kept : {
      text: row.quoteDraftText,
      kind,
      replacedAt: now.toISOString(),
      recommendedVehicle: row.recommendedVehicle,
      quoteOptions: snapshotOptions(row.quoteOptions),
    };
    const quoteOptions = { ...prefill.quoteOptions, legacyDraft, regenerated: { at: now.toISOString(), kind } };
    const reason = await prisma.$transaction(async (tx) => {
      const ordersTable = await orderTablePresent(tx);
      const locked = await lockRow(tx, row.id);
      if (!locked) return "找不到";
      if (orderLocked(locked.quoteStatus, ordersTable && await hasOrder(tx, row.id))) return "已有訂單";
      if (hooks?.beforeWrite) await hooks.beforeWrite(tx, row.id);
      const count = await guardedDraftWrite(tx, row, {
        quoteDraftText: prefill.quoteDraftText,
        recommendedVehicle: prefill.recommendedVehicle,
        quoteOptions,
      }, ordersTable);
      if (count === 1) return null;
      return ordersTable && await hasOrder(tx, row.id) ? "已有訂單" : "同時被改過";
    });
    if (reason) skipped.push({ id: row.id, reason });
    else generated.push(row.id);
  }
  return { generated, skipped, dryRun: Boolean(options.dryRun), regenerateLegacy: true as const, sendsToCustomer: false as const };
}

export type LegacyRestoreResult =
  | { ok: true; status: 200; changed: boolean; quote: QuoteRow | null }
  | { ok: false; status: 404 | 409; error: string };

/**
 * v10–v11: one-click restore of quoteOptions.legacyDraft (what regenerateLegacy replaced): draft text,
 * recommended vehicle and options go back to the saved snapshot and quoteOptions.regenerated is cleared;
 * legacyDraft is kept.
 * - Same guard as 「移除」 plus sent/closed rows (draftReplaceBlock): ORDER_PENDING, STAFF_PRICED, any order,
 *   SENT, CONFIRMED, ARCHIVED or sent_at → 409 and nothing is written (the order fingerprint cannot change).
 *   Checked under the row lock that order creation also takes, and again in the UPDATE (guardedDraftWrite).
 * - The current draft (including staff edits made after regeneration) is first appended to
 *   quoteOptions.restoreHistory with a timestamp; earlier entries are never overwritten (max 20, then 409).
 * - Idempotent: without the regenerated marker nothing is changed (changed:false).
 * Writes the draft only; nothing is sent.
 */
export async function restoreLegacyDraft(quoteId: string, hooks?: DraftWriteHooks): Promise<LegacyRestoreResult> {
  return prisma.$transaction(async (tx): Promise<LegacyRestoreResult> => {
    const ordersTable = await orderTablePresent(tx);
    const quote = await lockRow(tx, quoteId);
    if (!quote) return { ok: false, status: 404, error: "找不到這筆詢價" };
    const options = optionsObject(quote.quoteOptions);
    const legacy = object(options.legacyDraft);
    if (typeof legacy.text !== "string") return { ok: false, status: 409, error: "這筆詢價沒有可還原的舊草稿。" };
    const blocked = draftReplaceBlock(quote, ordersTable && await hasOrder(tx, quoteId));
    if (blocked) return { ok: false, status: 409, error: blocked };
    if (options.regenerated === undefined) return { ok: true, status: 200, changed: false, quote };
    const history = Array.isArray(options.restoreHistory) ? options.restoreHistory : [];
    if (history.length >= RESTORE_HISTORY_MAX) {
      return { ok: false, status: 409, error: `還原前的版本已保存 ${RESTORE_HISTORY_MAX} 份，不再自動覆蓋。請先人工整理。` };
    }
    const savedAt = new Date().toISOString();
    const entry = {
      savedAt,
      quoteStatus: quote.quoteStatus,
      quoteDraftText: quote.quoteDraftText,
      recommendedVehicle: quote.recommendedVehicle,
      quoteOptions: snapshotOptions(quote.quoteOptions),
    };
    let base: Record<string, unknown>;
    if (legacy.quoteOptions !== null && typeof legacy.quoteOptions === "object" && !Array.isArray(legacy.quoteOptions)) {
      base = { ...(legacy.quoteOptions as Record<string, unknown>) };
    } else {
      // legacyDraft without an options snapshot: keep the current options, put the previous autoDraft back.
      base = snapshotOptions(quote.quoteOptions);
      const previousAuto = object(legacy.autoDraft);
      if (Object.keys(previousAuto).length) base.autoDraft = previousAuto;
      else delete base.autoDraft;
    }
    const next = { ...base, legacyDraft: legacy, restoreHistory: [...history, entry] };
    if (hooks?.beforeWrite) await hooks.beforeWrite(tx, quoteId);
    const count = await guardedDraftWrite(tx, quote, {
      quoteDraftText: legacy.text,
      recommendedVehicle: typeof legacy.recommendedVehicle === "string" || legacy.recommendedVehicle === null ? legacy.recommendedVehicle as string | null : quote.recommendedVehicle,
      quoteOptions: next,
    }, ordersTable);
    if (count !== 1) {
      if (ordersTable && await hasOrder(tx, quoteId)) return { ok: false, status: 409, error: ORDER_LOCK_ERROR };
      return { ok: false, status: 409, error: "狀態剛被改過，請重新整理後再試。" };
    }
    return { ok: true, status: 200, changed: true, quote: await tx.charterQuote.findUnique({ where: { id: quoteId } }) };
  });
}
