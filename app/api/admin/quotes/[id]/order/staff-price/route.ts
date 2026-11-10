import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { CharterOrderUnavailableError, priceStaffOrder } from "@/lib/charterOrder";

export const dynamic = "force-dynamic";

/** Internal staff total only. Does not notify the guest or change the catalog rates. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    const result = await priceStaffOrder(params.id, { items: body.items, totalAmountTwd: body.totalAmountTwd });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error, sendsToCustomer: false, customerAccepted: false, paid: false }, { status: result.status });
    return NextResponse.json({
      success: true,
      order: result.order,
      updated: result.updated,
      sendsToCustomer: false,
      customerAccepted: false,
      paid: false,
    });
  } catch (error) {
    if (error instanceof CharterOrderUnavailableError) {
      return NextResponse.json({ success: false, error: error.message, sendsToCustomer: false }, { status: 503 });
    }
    console.error("staff price failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return NextResponse.json({ success: false, error: "內部核定失敗", sendsToCustomer: false }, { status: 500 });
  }
}
