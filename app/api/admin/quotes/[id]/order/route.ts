import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { CharterOrderUnavailableError, convertConfirmedQuote, readOrderForQuote } from "@/lib/charterOrder";

export const dynamic = "force-dynamic";

function failed(error: unknown) {
  if (error instanceof CharterOrderUnavailableError) {
    return NextResponse.json({ success: false, error: error.message, sendsToCustomer: false }, { status: 503 });
  }
  console.error("charter order failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
  return NextResponse.json({ success: false, error: "訂單處理失敗", sendsToCustomer: false }, { status: 500 });
}

/** Staff action only. Does not call LINE, email, or dispatch. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  try {
    const result = await convertConfirmedQuote(params.id);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error, sendsToCustomer: false }, { status: result.status });
    return NextResponse.json({ success: true, order: result.order, items: result.items, created: result.created, sendsToCustomer: false, customerAccepted: false, paid: false });
  } catch (error) {
    return failed(error);
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const result = await readOrderForQuote(params.id);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error, sendsToCustomer: false }, { status: result.status });
    return NextResponse.json({
      success: true,
      order: result.order,
      items: result.items,
      stale: result.stale,
      baseAmountTwd: result.order.baseAmountTwd,
      totalAmountTwd: result.order.totalAmountTwd,
      customerAccepted: false,
      paid: false,
      sendsToCustomer: false,
    });
  } catch (error) {
    return failed(error);
  }
}
