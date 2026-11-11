import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { pushLineText } from "@/lib/lineApi";
import { prisma } from "@/lib/prisma";
import { sendBlock } from "@/lib/quoteSendGuard";
import { adminStaffStrings } from "@/lib/quoteStaffText";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();

  const quote = await prisma.charterQuote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  if (quote.quoteStatus === "ARCHIVED") return NextResponse.json({ success: false, error: "這筆詢價已移除，請先還原再送出。" }, { status: 409 });
  if (!quote.quoteDraftText) return NextResponse.json({ success: false, error: "正式報價內容不可為空" }, { status: 400 });
  // Unreviewed auto drafts and internal wording (參考行情／自動預生成) never reach the customer.
  // v7: also compared against everything the admin list and detail page show for this row.
  const blocked = sendBlock(quote, adminStaffStrings(quote));
  if (blocked) return NextResponse.json({ success: false, code: blocked.code, error: blocked.error }, { status: blocked.status });

  await pushLineText(quote.lineUserId, quote.quoteDraftText);
  const updated = await prisma.charterQuote.update({
    where: { id: params.id },
    data: { quoteStatus: "SENT", sentAt: new Date() },
  });

  return NextResponse.json({ success: true, quote: updated });
}
