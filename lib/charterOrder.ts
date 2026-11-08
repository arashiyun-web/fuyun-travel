import { Prisma } from "@prisma/client";
import { buildFleetQuoteDraft } from "@/lib/fleetQuoteDraft";
import { prisma } from "@/lib/prisma";

export class CharterOrderUnavailableError extends Error {
  constructor() {
    super("訂單表尚未建立。正式遷移還在待審，這次沒有寫入。");
    this.name = "CharterOrderUnavailableError";
  }
}

/** Turns one confirmed quote into one passenger charter order. Does not send LINE or email. */
export async function convertConfirmedQuote(quoteId: string) {
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
    return { ok: false as const, status: 409, error: "這筆報價沒有可確認車資，不能轉成旅客訂單。" };
  }
  try {
    const existing = await prisma.charterOrder.findUnique({ where: { quoteId } });
    if (existing) return { ok: true as const, order: existing, created: false, sendsToCustomer: false as const };
    const order = await prisma.charterOrder.create({
      data: {
        quoteId,
        lineUid: quote.lineUserId,
        amountTwd: draft.amountTwd,
        vehicleLabel: draft.vehicleLabel,
        routeLabel: `${quote.pickup || "未填"} → ${quote.destination || "未填"}`,
        status: "confirmed",
      },
    });
    await prisma.charterQuote.update({ where: { id: quoteId }, data: { quoteStatus: "ORDERED" } });
    return { ok: true as const, order, created: true, sendsToCustomer: false as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2010")) {
      throw new CharterOrderUnavailableError();
    }
    const message = error instanceof Error ? error.message : "";
    if (/charter_orders/.test(message) && /does not exist|不存在/.test(message)) throw new CharterOrderUnavailableError();
    throw error;
  }
}
