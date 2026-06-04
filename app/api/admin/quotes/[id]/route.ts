import { NextResponse } from "next/server";
import { unauthorized, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/quoteWorkflow";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  const quote = await prisma.charterQuote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ success: true, quote });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const quote = await prisma.charterQuote.update({
    where: { id: params.id },
    data: {
      recommendedVehicle: cleanText(body.recommendedVehicle, 120),
      quoteDraftText: cleanText(body.quoteDraftText, 4500),
      quoteStatus: cleanText(body.quoteStatus || "DRAFT", 40),
    },
  });
  return NextResponse.json({ success: true, quote });
}
