import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { backfillQuoteDrafts, regenerateIds, regenerateLegacyDrafts } from "@/lib/quoteArchive";

export const dynamic = "force-dynamic";

/**
 * Batch-fills staff drafts for inquiries without one. Draft fields only; never calls LINE.
 * v9: {regenerateLegacy:true, ids:[…]} rebuilds old-format drafts of those rows only (regenerateLegacyDrafts).
 */
export async function POST(request: Request) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  // v10: regenerateLegacy must be a boolean, and ids are accepted only together with regenerateLegacy:true,
  // so a mistyped call ("true", 1, missing flag) never falls through to the batch prefill.
  const hasFlag = Boolean(body) && typeof body === "object" && "regenerateLegacy" in body;
  const hasIds = Boolean(body) && typeof body === "object" && "ids" in body;
  if ((hasFlag && typeof body.regenerateLegacy !== "boolean") || (hasIds && body.regenerateLegacy !== true)) {
    return NextResponse.json({ success: false, error: "regenerateLegacy 必須是 true（布林值）並同時列出 ids。", sendsToCustomer: false }, { status: 400 });
  }
  // v9: explicit opt-in to rebuild old 「【後台報價草稿】」 drafts for the listed ids only.
  if (body && body.regenerateLegacy === true) {
    const ids = regenerateIds(body.ids);
    if (!ids) return NextResponse.json({ success: false, error: "請列出要重新產生的詢價 id（1～50 筆）。", sendsToCustomer: false }, { status: 400 });
    try {
      const result = await regenerateLegacyDrafts({ ids, dryRun: body.dryRun === true });
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error("quote legacy regenerate failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
      return NextResponse.json({ success: false, error: "重新產生失敗", sendsToCustomer: false }, { status: 500 });
    }
  }
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
