import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { CharterOrderUnavailableError, convertConfirmedQuote } from "@/lib/charterOrder";

export const dynamic = "force-dynamic";

/** Staff action only. Does not call LINE, email, or dispatch. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    const result = await convertConfirmedQuote(params.id, {
      confirmCompleteQuote: body.confirmCompleteQuote === true,
      totalAmountTwd: body.totalAmountTwd,
    });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error, sendsToCustomer: false }, { status: result.status });
    return NextResponse.json({ success: true, order: result.order, created: result.created, sendsToCustomer: false });
  } catch (error) {
    if (error instanceof CharterOrderUnavailableError) {
      return NextResponse.json({ success: false, error: error.message, sendsToCustomer: false }, { status: 503 });
    }
    console.error("charter order convert failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return NextResponse.json({ success: false, error: "轉成訂單失敗", sendsToCustomer: false }, { status: 500 });
  }
}
