import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { buildFleetQuoteDraft } from "@/lib/fleetQuoteDraft";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Writes a staff draft only. Does not call LINE or email. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const quote = await prisma.charterQuote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const hours = typeof body.hours === "number" ? body.hours : null;
  const draft = buildFleetQuoteDraft({
    pickup: quote.pickup,
    destination: quote.destination,
    remark: quote.remark,
    vehicleHint: typeof body.vehicleHint === "string" && body.vehicleHint.trim() ? body.vehicleHint : quote.recommendedVehicle,
    passengerCount: quote.passengerCount,
    hours,
  });
  const updated = await prisma.charterQuote.update({
    where: { id: params.id },
    data: {
      quoteDraftText: draft.text,
      recommendedVehicle: draft.vehicleLabel || quote.recommendedVehicle,
    },
  });
  return NextResponse.json({ success: true, quote: updated, pending: draft.pending, amountTwd: draft.amountTwd, sendsToCustomer: false });
}
