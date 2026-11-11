import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildQuotePrefill, needsPrefill } from "@/lib/quotePrefill";

/**
 * Soft removal for LINE quotes. Rows are never deleted: quoteStatus becomes ARCHIVED and the
 * previous status is kept in quoteOptions.archive so it can be restored. Quotes that already
 * have a CharterOrder (or are in the order flow) cannot be archived.
 */

export const ARCHIVED = "ARCHIVED";
const ORDER_STATUSES = ["ORDER_PENDING", "STAFF_PRICED"];
export const QUOTE_PAGE_SIZE = 20;

export type QuoteTab = "pending" | "sent" | "archived";
export const QUOTE_TABS: Array<{ key: QuoteTab; label: string }> = [
  { key: "pending", label: "待處理" },
  { key: "sent", label: "已報價（送出）" },
  { key: "archived", label: "已移除" },
];

export function quoteTab(value: unknown): QuoteTab {
  return value === "sent" || value === "archived" ? value : "pending";
}

export function tabWhere(tab: QuoteTab): Prisma.CharterQuoteWhereInput {
  if (tab === "archived") return { quoteStatus: ARCHIVED };
  if (tab === "sent") return { quoteStatus: { in: ["SENT", "CONFIRMED"] } };
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

async function hasOrder(tx: Prisma.TransactionClient, quoteId: string) {
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
    if (ORDER_STATUSES.indexOf(quote.quoteStatus) >= 0 || await hasOrder(tx, quoteId)) {
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
    where: { AND: [tabWhere("pending"), { OR: [{ quoteDraftText: null }, { quoteDraftText: "" }] }] },
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
