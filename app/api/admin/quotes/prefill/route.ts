import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { backfillQuoteDrafts } from "@/lib/quoteArchive";

export const dynamic = "force-dynamic";

/** Batch-fills staff drafts for inquiries without one. Draft fields only; never calls LINE. */
export async function POST(request: Request) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  try {
    const result = await backfillQuoteDrafts({
      dryRun: Boolean(body && body.dryRun === true),
      limit: body && typeof body.limit === "number" ? body.limit : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("quote prefill failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return NextResponse.json({ success: false, error: "補生成失敗", sendsToCustomer: false }, { status: 500 });
  }
}
