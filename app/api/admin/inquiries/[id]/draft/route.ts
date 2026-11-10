import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { buildFleetQuoteDraft } from "@/lib/fleetQuoteDraft";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Returns a staff draft. Does not store it, send LINE, or send email. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const inquiry = await prisma.inquiry.findUnique({ where: { id: params.id } });
  if (!inquiry) return NextResponse.json({ success: false, error: "Inquiry not found" }, { status: 404 });
  const draft = buildFleetQuoteDraft({
    pickup: inquiry.pickupLocation,
    destination: inquiry.destination,
    remark: inquiry.specialRequests,
    vehicleHint: inquiry.preferredVehicle.join(" "),
    passengerCount: inquiry.passengerCount,
  });
  return NextResponse.json({ success: true, draft, sendsToCustomer: false });
}
