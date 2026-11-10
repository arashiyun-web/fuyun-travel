import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { savedFleetFare, withFleetFare } from "@/lib/fleetFareInput";
import { buildFleetQuoteDraft, isFareHours, isFleetRateId } from "@/lib/fleetQuoteDraft";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Writes a staff draft only. Does not call LINE or email. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const quote = await prisma.charterQuote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      ("hours" in body && body.hours !== null && !isFareHours(body.hours)) ||
      ("rateId" in body && body.rateId !== null && !isFleetRateId(body.rateId))) {
    return NextResponse.json({ success: false, error: "請明選有效路線，時數須為正整數。" }, { status: 400 });
  }
  const saved = savedFleetFare(quote);
  const hours = "hours" in body ? body.hours : saved.hours;
  const rateId = "rateId" in body ? body.rateId : saved.rateId;
  const draft = buildFleetQuoteDraft({
    pickup: quote.pickup,
    destination: quote.destination,
    remark: quote.remark,
    vehicleHint: typeof body.vehicleHint === "string" && body.vehicleHint.trim() ? body.vehicleHint : quote.recommendedVehicle,
    passengerCount: quote.passengerCount,
    hours,
    rateId,
  });
  const updated = await prisma.charterQuote.update({
    where: { id: params.id },
    data: {
      quoteDraftText: draft.text,
      quoteOptions: withFleetFare(quote, { rateId, hours }) as Prisma.InputJsonObject,
      recommendedVehicle: draft.vehicleLabel || quote.recommendedVehicle,
    },
  });
  return NextResponse.json({ success: true, quote: updated, pending: draft.pending, amountTwd: draft.amountTwd, sendsToCustomer: false });
}
