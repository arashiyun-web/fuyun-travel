import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/quoteWorkflow";
import { reviewOnSave } from "@/lib/quoteSendGuard";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  const quote = await prisma.charterQuote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ success: true, quote });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const current = await prisma.charterQuote.findUnique({ where: { id: params.id }, select: { quoteStatus: true, quoteOptions: true } });
  if (!current) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  const requested = cleanText(body.quoteStatus || "DRAFT", 40);
  // Removal and restore go through /archive and /restore so the previous status is kept.
  if ((requested === "ARCHIVED") !== (current.quoteStatus === "ARCHIVED")) {
    return NextResponse.json({ success: false, error: "移除或還原請用清單上的按鈕。" }, { status: 409 });
  }
  const quoteDraftText = cleanText(body.quoteDraftText, 4500);
  // Saving an edited auto draft marks it staff-reviewed so it can be sent; unchanged text stays blocked.
  const reviewed = reviewOnSave(current.quoteOptions, quoteDraftText);
  const quote = await prisma.charterQuote.update({
    where: { id: params.id },
    data: {
      recommendedVehicle: cleanText(body.recommendedVehicle, 120),
      quoteDraftText,
      quoteStatus: requested,
      ...(reviewed ? { quoteOptions: reviewed as Prisma.InputJsonObject } : {}),
    },
  });
  return NextResponse.json({ success: true, quote });
}
