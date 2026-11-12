import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { restoreLegacyDraft } from "@/lib/quoteArchive";

export const dynamic = "force-dynamic";

/**
 * Puts the draft replaced by regenerateLegacy back (quoteOptions.legacyDraft). Admin only; never calls LINE.
 * v11: 409 for rows with an order, in the order flow, sent, confirmed or removed (same guard as 「移除」).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  let result;
  try {
    result = await restoreLegacyDraft(params.id);
  } catch (error) {
    console.error("quote legacy restore failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return NextResponse.json({ success: false, error: "還原失敗，沒有變更。", sendsToCustomer: false }, { status: 500 });
  }
  if (!result.ok) return NextResponse.json({ success: false, error: result.error, sendsToCustomer: false }, { status: result.status });
  return NextResponse.json({ success: true, changed: result.changed, quote: result.quote, sendsToCustomer: false });
}
