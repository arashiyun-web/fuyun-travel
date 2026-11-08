import { Prisma } from "@prisma/client";
import { buildFleetQuoteDraft, orderConfirmationBlock } from "@/lib/fleetQuoteDraft";
import { prisma } from "@/lib/prisma";

export class CharterOrderUnavailableError extends Error {
  constructor() {
    super("訂單表尚未建立。正式遷移還在待審，這次沒有寫入。");
    this.name = "CharterOrderUnavailableError";
  }
}

class OrderWriteRolledBack extends Error {
  constructor() {
    super("報價狀態沒有一起更新");
    this.name = "OrderWriteRolledBack";
  }
}

type ConvertInput = {
  confirmCompleteQuote?: boolean;
  totalAmountTwd?: unknown;
};

type ConvertHooks = {
  beforeQuoteUpdate?: (tx: Prisma.TransactionClient) => Promise<void>;
};

/** Records a passenger order from a quote. Base fare is not a confirmed total, and nothing is sent. */
export async function convertConfirmedQuote(quoteId: string, input: ConvertInput = {}, hooks?: ConvertHooks) {
  const quote = await prisma.charterQuote.findUnique({ where: { id: quoteId } });
  if (!quote) return { ok: false as const, status: 404, error: "找不到報價" };
  const draft = buildFleetQuoteDraft({
    pickup: quote.pickup,
    destination: quote.destination,
    remark: quote.remark,
    vehicleHint: quote.recommendedVehicle,
    passengerCount: quote.passengerCount,
  });
  if (draft.amountTwd == null || !draft.vehicleLabel) {
    return { ok: false as const, status: 409, error: "這筆報價沒有可沿用的基本車資，不能建立訂單。" };
  }
  const wantConfirmed = input.confirmCompleteQuote === true;
  const blocked = orderConfirmationBlock(draft);
  if (wantConfirmed) {
    if (blocked) return { ok: false as const, status: 409, error: blocked };
    if (typeof input.totalAmountTwd !== "number" || !Number.isInteger(input.totalAmountTwd) || input.totalAmountTwd <= 0) {
      return { ok: false as const, status: 409, error: "完整總價要由人員另填整數，不能直接把基本車資當成總價。" };
    }
  }
  const status = wantConfirmed ? "confirmed" : "pending_confirmation";
  const totalAmountTwd = wantConfirmed ? (input.totalAmountTwd as number) : null;
  const quoteStatus = wantConfirmed ? "CUSTOMER_CONFIRMED" : "ORDER_PENDING";
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM charter_quotes WHERE id = ${quoteId} FOR UPDATE`;
      if (!locked.length) return { missing: true as const };
      const existing = await tx.charterOrder.findUnique({ where: { quoteId } });
      if (existing) {
        if (wantConfirmed && existing.status !== "confirmed") {
          return { refused: blocked || "待確認訂單不能直接改成客人已確認。" };
        }
        return { order: existing, created: false as const };
      }
      const order = await tx.charterOrder.create({
        data: {
          quoteId,
          lineUid: quote.lineUserId,
          baseAmountTwd: draft.amountTwd as number,
          totalAmountTwd,
          vehicleLabel: draft.vehicleLabel as string,
          routeLabel: `${quote.pickup || "未填"} → ${quote.destination || "未填"}`,
          status,
        },
      });
      if (hooks?.beforeQuoteUpdate) await hooks.beforeQuoteUpdate(tx);
      const updated = await tx.charterQuote.updateMany({ where: { id: quoteId }, data: { quoteStatus } });
      if (updated.count !== 1) throw new OrderWriteRolledBack();
      return { order, created: true as const };
    });
    if ("missing" in outcome) return { ok: false as const, status: 404, error: "找不到報價" };
    if ("refused" in outcome) return { ok: false as const, status: 409, error: outcome.refused, sendsToCustomer: false as const };
    return { ok: true as const, order: outcome.order, created: outcome.created, sendsToCustomer: false as const };
  } catch (error) {
    if (error instanceof OrderWriteRolledBack) {
      return { ok: false as const, status: 409, error: "報價狀態沒有一起更新，訂單沒有留下。", sendsToCustomer: false as const };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.charterOrder.findUnique({ where: { quoteId } });
      if (existing) return { ok: true as const, order: existing, created: false, sendsToCustomer: false as const };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2010")) {
      throw new CharterOrderUnavailableError();
    }
    const message = error instanceof Error ? error.message : "";
    if (/charter_orders/.test(message) && /does not exist|不存在/.test(message)) throw new CharterOrderUnavailableError();
    throw error;
  }
}
