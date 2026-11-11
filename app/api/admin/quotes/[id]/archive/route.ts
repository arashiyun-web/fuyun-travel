import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { archiveQuote } from "@/lib/quoteArchive";

export const dynamic = "force-dynamic";

/** Soft removal only: status becomes ARCHIVED, nothing is deleted or sent. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  try {
    const result = await archiveQuote(params.id);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error, sendsToCustomer: false }, { status: result.status });
    return NextResponse.json({ success: true, quoteStatus: result.quoteStatus, changed: result.changed, sendsToCustomer: false });
  } catch (error) {
    console.error("quote archive failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return NextResponse.json({ success: false, error: "移除失敗", sendsToCustomer: false }, { status: 500 });
  }
}
