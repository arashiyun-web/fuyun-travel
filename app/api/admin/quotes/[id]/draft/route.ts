import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { savedFleetFare, withFleetFare } from "@/lib/fleetFareInput";
import { buildFleetQuoteDraft, isFareHours, isFleetRateId } from "@/lib/fleetQuoteDraft";
import { fleetDraftGuarded } from "@/lib/quoteOrderWrites";
import { parseLuggage, parseTripType, rangeDraftText } from "@/lib/quoteConversation";
import { yearBaseOf } from "@/lib/quoteRange";
import { fleetDraftHints, withStoredHints } from "@/lib/quoteStaffText";

export const dynamic = "force-dynamic";

/**
 * Writes a staff draft only. Does not call LINE or email. v6: the draft body is the customer RANGE
 * quote; the fleet-table base fare (a single fixed price) stays staff-side in fleetFare and the
 * response (amountTwd, staffHints), never in quoteDraftText.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  // v12: built from the row read under the row lock; ORDER_PENDING / STAFF_PRICED / any order → 409 and the
  // conditional UPDATE writes nothing if the row changed or an order appeared (lib/quoteOrderWrites.ts).
  const result = await fleetDraftGuarded(params.id, (quote) => {
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        ("hours" in body && body.hours !== null && !isFareHours(body.hours)) ||
        ("rateId" in body && body.rateId !== null && !isFleetRateId(body.rateId))) {
      return { ok: false, status: 400, error: "請明選有效路線，時數須為正整數。" };
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
    const vehicle = draft.vehicleLabel || (typeof body.vehicleHint === "string" ? body.vehicleHint : "") || quote.recommendedVehicle;
    const remark = quote.remark && quote.remark !== "無" ? quote.remark : "";
    const customerText = rangeDraftText({
      date: quote.tripDate,
      people: quote.passengerCount,
      origin: quote.pickup,
      destination: quote.destination,
      note: remark,
      luggage: parseLuggage(remark),
      tripType: parseTripType(remark),
      vehicle,
    }, yearBaseOf(quote.createdAt));
    const staffHints = fleetDraftHints(draft);
    return {
      data: {
        quoteDraftText: customerText,
        // v8: the hints shown to staff are stored, so the send guard compares exactly what staff saw.
        quoteOptions: withStoredHints(withFleetFare(quote, { rateId, hours }), staffHints) as Record<string, unknown>,
        recommendedVehicle: draft.vehicleLabel || quote.recommendedVehicle,
      },
      extra: { pending: draft.pending, amountTwd: draft.amountTwd, staffHints },
    };
  });
  if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, quote: result.quote, ...result.extra, sendsToCustomer: false });
}
