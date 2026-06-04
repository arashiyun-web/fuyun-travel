import { NextResponse } from "next/server";
import { unauthorized, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { pushLineText } from "@/lib/lineApi";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminRequest(request)) return unauthorized();

  const quote = await prisma.charterQuote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  if (!quote.quoteDraftText) return NextResponse.json({ success: false, error: "正式報價內容不可為空" }, { status: 400 });

  await pushLineText(quote.lineUserId, quote.quoteDraftText);
  const updated = await prisma.charterQuote.update({
    where: { id: params.id },
    data: { quoteStatus: "SENT", sentAt: new Date() },
  });

  return NextResponse.json({ success: true, quote: updated });
}
