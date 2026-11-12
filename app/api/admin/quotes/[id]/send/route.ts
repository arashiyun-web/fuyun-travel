import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { pushLineText } from "@/lib/lineApi";
import { sendQuoteGuarded } from "@/lib/quoteOrderWrites";
import { sendBlock } from "@/lib/quoteSendGuard";
import { adminStaffStrings } from "@/lib/quoteStaffText";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();

  // v12: row lock + order guard (ORDER_PENDING / STAFF_PRICED / any order → 409, nothing pushed); the status
  // write is conditional and LINE is pushed only after it matched (lib/quoteOrderWrites.ts).
  const result = await sendQuoteGuarded(params.id, (quote) => {
    if (!quote.quoteDraftText) return { ok: false, status: 400, error: "正式報價內容不可為空" };
    // Unreviewed auto drafts and internal wording (參考行情／自動預生成) never reach the customer.
    // v7: also compared against everything the admin list and detail page show for this row.
    const blocked = sendBlock(quote, adminStaffStrings(quote));
    return blocked ? { ok: false, status: blocked.status, code: blocked.code, error: blocked.error } : null;
  }, (quote) => pushLineText(quote.lineUserId, quote.quoteDraftText as string));
  if (!result.ok) {
    return NextResponse.json({ success: false, ...(result.code ? { code: result.code } : {}), error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, quote: result.quote });
}
