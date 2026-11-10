import { savedFleetFare } from "@/lib/fleetFareInput";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { buildFleetQuoteDraft, reviewItems, vehicleFees, type FleetQuoteDraft, type ReviewItem } from "@/lib/fleetQuoteDraft";
import { prisma } from "@/lib/prisma";

export class CharterOrderUnavailableError extends Error {
  constructor() {
    super("訂單表尚未建立。請由獲授權人員套用正式遷移，這次沒有寫入。");
    this.name = "CharterOrderUnavailableError";
  }
}

class OrderWriteRolledBack extends Error {
  constructor() {
    super("報價狀態沒有一起更新");
    this.name = "OrderWriteRolledBack";
  }
}

type QuoteRow = {
  id: string;
  lineUserId: string;
  pickup: string | null;
  destination: string | null;
  remark: string | null;
  recommendedVehicle: string | null;
  passengerCount: number | null;
  quoteOptions?: unknown;
};

export type StaffDecision = {
  key?: unknown;
  decision?: unknown;
  amountTwd?: unknown;
  quantity?: unknown;
  reason?: unknown;
};

type ConvertHooks = {
  afterLock?: (tx: Prisma.TransactionClient) => Promise<void>;
  beforeQuoteUpdate?: (tx: Prisma.TransactionClient) => Promise<void>;
};

const STAFF_PRICED = "staff_priced";
const PENDING = "pending_confirmation";

export function quoteFingerprint(quote: Pick<QuoteRow, "pickup" | "destination" | "remark" | "recommendedVehicle" | "passengerCount" | "quoteOptions">) {
  return createHash("sha256").update(JSON.stringify({
    pickup: quote.pickup || "",
    destination: quote.destination || "",
    remark: quote.remark || "",
    recommendedVehicle: quote.recommendedVehicle || "",
    passengerCount: quote.passengerCount,
    ...savedFleetFare(quote),
  })).digest("hex");
}

function draftFor(quote: QuoteRow) {
  return buildFleetQuoteDraft({
    pickup: quote.pickup,
    destination: quote.destination,
    remark: quote.remark,
    vehicleHint: quote.recommendedVehicle,
    passengerCount: quote.passengerCount,
    ...savedFleetFare(quote),
  });
}

function unavailable(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2010")) return true;
  const message = error instanceof Error ? error.message : "";
  return /charter_orders/.test(message) && /does not exist|不存在/.test(message);
}

/** Creates a pending passenger order from the quote row locked in this transaction. Nothing is sent. */
export async function convertConfirmedQuote(quoteId: string, hooks?: ConvertHooks) {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM charter_quotes WHERE id = ${quoteId} FOR UPDATE`;
      if (!locked.length) return { missing: true as const };
      if (hooks?.afterLock) await hooks.afterLock(tx);
      const quote = await tx.charterQuote.findUnique({ where: { id: quoteId } });
      if (!quote) return { missing: true as const };
      const draft = draftFor(quote);
      if (draft.amountTwd == null || !draft.vehicleLabel) {
        return { refused: "這筆報價沒有可沿用的基本車資，不能建立訂單。" };
      }
      const fingerprint = quoteFingerprint(quote);
      const existing = await tx.charterOrder.findUnique({ where: { quoteId } });
      if (existing) {
        if (existing.quoteFingerprint !== fingerprint) {
          return { conflict: "報價在訂單建立後已變更，不能用舊的基本車資繼續。" };
        }
        return { order: existing, created: false as const, items: reviewItems(draft) };
      }
      const order = await tx.charterOrder.create({
        data: {
          quoteId,
          lineUid: quote.lineUserId,
          baseAmountTwd: draft.amountTwd,
          totalAmountTwd: null,
          vehicleLabel: draft.vehicleLabel,
          routeLabel: `${quote.pickup || "未填"} → ${quote.destination || "未填"}`,
          quoteFingerprint: fingerprint,
          status: PENDING,
        },
      });
      if (hooks?.beforeQuoteUpdate) await hooks.beforeQuoteUpdate(tx);
      const updated = await tx.charterQuote.updateMany({ where: { id: quoteId }, data: { quoteStatus: "ORDER_PENDING" } });
      if (updated.count !== 1) throw new OrderWriteRolledBack();
      return { order, created: true as const, items: reviewItems(draft) };
    });
    if ("missing" in outcome) return { ok: false as const, status: 404, error: "找不到報價", sendsToCustomer: false as const };
    if ("refused" in outcome) return { ok: false as const, status: 409, error: outcome.refused, sendsToCustomer: false as const };
    if ("conflict" in outcome) return { ok: false as const, status: 409, error: outcome.conflict, sendsToCustomer: false as const };
    return { ok: true as const, order: outcome.order, created: outcome.created, items: outcome.items, sendsToCustomer: false as const };
  } catch (error) {
    if (error instanceof OrderWriteRolledBack) {
      return { ok: false as const, status: 409, error: "報價狀態沒有一起更新，訂單沒有留下。", sendsToCustomer: false as const };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.charterOrder.findUnique({ where: { quoteId } });
      if (existing) {
        const quote = await prisma.charterQuote.findUnique({ where: { id: quoteId } });
        return { ok: true as const, order: existing, created: false, items: quote ? reviewItems(draftFor(quote)) : [], sendsToCustomer: false as const };
      }
    }
    if (unavailable(error)) throw new CharterOrderUnavailableError();
    throw error;
  }
}

export function describeOrder(order: { baseAmountTwd: number; totalAmountTwd: number | null; status: string }, draft: FleetQuoteDraft) {
  return {
    baseAmountTwd: order.baseAmountTwd,
    items: reviewItems(draft),
    status: order.status,
    totalAmountTwd: order.totalAmountTwd,
    customerAccepted: false as const,
    paid: false as const,
    sendsToCustomer: false as const,
  };
}

function pricedAmount(item: ReviewItem, decision: StaffDecision): number | string {
  if (typeof decision.amountTwd !== "number" || !Number.isInteger(decision.amountTwd) || decision.amountTwd < 0) {
    return `「${item.label}」要由人員填入零或正整數，空白不算。`;
  }
  if (item.unitAmountTwd != null && item.quantityLabel) {
    if (typeof decision.quantity !== "number" || !Number.isInteger(decision.quantity) || decision.quantity < 1) {
      return `「${item.label}」要填${item.quantityLabel}數。不自行假設晚數、餐數或小時。`;
    }
    const expected = item.unitAmountTwd * decision.quantity;
    if (decision.amountTwd !== expected) return `「${item.label}」已知每${item.quantityLabel} ${item.unitAmountTwd} 元，金額必須是 ${expected}。`;
  }
  if (typeof item.minAmountTwd === "number" && typeof item.maxAmountTwd === "number" && (decision.amountTwd < item.minAmountTwd || decision.amountTwd > item.maxAmountTwd)) {
    return `「${item.label}」已核對是 ${item.minAmountTwd}–${item.maxAmountTwd} 元，不能填這個範圍以外。`;
  }
  return decision.amountTwd;
}

function cleanReason(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value.trim()) return trimmed;
  return trimmed;
}

/** Saves an internal staff total. Does not mean the guest agreed or paid, and does not send anything. */
export async function priceStaffOrder(quoteId: string, input: { items?: unknown; totalAmountTwd?: unknown }, hooks?: ConvertHooks) {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM charter_quotes WHERE id = ${quoteId} FOR UPDATE`;
      if (!locked.length) return { missing: true as const };
      const quote = await tx.charterQuote.findUnique({ where: { id: quoteId } });
      if (!quote) return { missing: true as const };
      const order = await tx.charterOrder.findUnique({ where: { quoteId } });
      if (!order) return { refused: "還沒有待確認訂單。" };
      if (order.status === STAFF_PRICED) return { order, updated: false as const };
      if (order.quoteFingerprint !== quoteFingerprint(quote)) {
        return { conflict: "報價已變更。請依最新資料重新核對，不能用舊條件核定。" };
      }
      const draft = draftFor(quote);
      if (draft.amountTwd == null || draft.amountTwd !== order.baseAmountTwd) {
        return { conflict: "鎖內的基本車資和訂單不一致，不能核定。" };
      }
      const required = reviewItems(draft);
      const decisions = Array.isArray(input.items) ? input.items as StaffDecision[] : [];
      const byKey = new Map<string, StaffDecision>();
      for (const decision of decisions) {
        if (typeof decision?.key !== "string" || byKey.has(decision.key)) return { refused: "每個待確認項目只能核定一次。" };
        byKey.set(decision.key, decision);
      }
      if (decisions.length !== required.length) return { refused: "還有未處理的條件，不能核定。" };
      const stored: Array<{ key: string; label: string; role: string; decision: "amount" | "not_applicable"; amountTwd: number | null; quantity: number | null; reason: string | null }> = [];
      let surcharge = 0;
      let depositAmountTwd: number | null = null;
      for (const item of required) {
        const decision = byKey.get(item.key);
        if (!decision) return { refused: `尚未處理：${item.label}` };
        if (decision.decision === "amount") {
          const priced = pricedAmount(item, decision);
          if (typeof priced !== "number") return { refused: priced };
          if (item.role === "payment") depositAmountTwd = priced;
          else surcharge += priced;
          const quantity = item.quantityLabel && item.unitAmountTwd != null ? decision.quantity as number : null;
          stored.push({ key: item.key, label: item.label, role: item.role, decision: "amount", amountTwd: priced, quantity, reason: null });
        } else if (decision.decision === "not_applicable") {
          const reason = cleanReason(decision.reason);
          if (reason.length < 2) return { refused: `「${item.label}」標成不適用時，要寫下具體原因。空白不算。` };
          stored.push({ key: item.key, label: item.label, role: item.role, decision: "not_applicable", amountTwd: null, quantity: null, reason });
        } else {
          return { refused: `「${item.label}」還沒選擇填金額或不適用。` };
        }
      }
      if (typeof input.totalAmountTwd !== "number" || !Number.isInteger(input.totalAmountTwd)) {
        return { refused: "總價要由人員填入整數。" };
      }
      const expected = order.baseAmountTwd + surcharge;
      if (input.totalAmountTwd !== expected) {
        return { refused: `總價必須等於基本車資 ${order.baseAmountTwd} 加影響總價的附加費 ${surcharge}。訂金不計入。` };
      }
      const updated = await tx.charterOrder.updateMany({
        where: { id: order.id, status: PENDING, quoteFingerprint: order.quoteFingerprint },
        data: {
          status: STAFF_PRICED,
          totalAmountTwd: expected,
          reviewJson: { items: stored, baseAmountTwd: order.baseAmountTwd, surchargeTwd: surcharge, depositAmountTwd, totalAmountTwd: expected, customerAccepted: false, paid: false },
        },
      });
      if (updated.count !== 1) throw new OrderWriteRolledBack();
      if (hooks?.beforeQuoteUpdate) await hooks.beforeQuoteUpdate(tx);
      const quoteUpdated = await tx.charterQuote.updateMany({ where: { id: quoteId }, data: { quoteStatus: "STAFF_PRICED" } });
      if (quoteUpdated.count !== 1) throw new OrderWriteRolledBack();
      const saved = await tx.charterOrder.findUnique({ where: { id: order.id } });
      return { order: saved, updated: true as const };
    });
    if ("missing" in outcome) return { ok: false as const, status: 404, error: "找不到報價", sendsToCustomer: false as const };
    if ("refused" in outcome) return { ok: false as const, status: 409, error: outcome.refused, sendsToCustomer: false as const };
    if ("conflict" in outcome) return { ok: false as const, status: 409, error: outcome.conflict, sendsToCustomer: false as const };
    return { ok: true as const, order: outcome.order, updated: outcome.updated, sendsToCustomer: false as const, customerAccepted: false as const, paid: false as const };
  } catch (error) {
    if (error instanceof OrderWriteRolledBack) {
      return { ok: false as const, status: 409, error: "核定沒有完整寫入，金額沒有改掉。", sendsToCustomer: false as const };
    }
    if (unavailable(error)) throw new CharterOrderUnavailableError();
    throw error;
  }
}

export async function readOrderForQuote(quoteId: string) {
  const quote = await prisma.charterQuote.findUnique({ where: { id: quoteId } });
  if (!quote) return { ok: false as const, status: 404, error: "找不到報價" };
  const order = await prisma.charterOrder.findUnique({ where: { quoteId } });
  if (!order) return { ok: false as const, status: 404, error: "還沒有待確認訂單。" };
  const draft = draftFor(quote);
  return {
    ok: true as const,
    order,
    draft,
    items: reviewItems(draft),
    included: vehicleFees(draft.vehicleSlug).filter((fee) => fee.role === "included"),
    terms: vehicleFees(draft.vehicleSlug).filter((fee) => fee.role === "term"),
    stale: order.quoteFingerprint !== quoteFingerprint(quote),
    customerAccepted: false as const,
    paid: false as const,
    sendsToCustomer: false as const,
  };
}
