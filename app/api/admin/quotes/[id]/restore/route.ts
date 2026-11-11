import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { restoreQuote } from "@/lib/quoteArchive";

export const dynamic = "force-dynamic";

/** Puts an archived quote back to the status it had before removal. Nothing is sent. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  try {
    const result = await restoreQuote(params.id);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error, sendsToCustomer: false }, { status: result.status });
    return NextResponse.json({ success: true, quoteStatus: result.quoteStatus, changed: result.changed, sendsToCustomer: false });
  } catch (error) {
    console.error("quote restore failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return NextResponse.json({ success: false, error: "還原失敗", sendsToCustomer: false }, { status: 500 });
  }
}
