import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";
import { patchQuoteGuarded } from "@/lib/quoteOrderWrites";
import { cleanText } from "@/lib/quoteWorkflow";
import { reviewOnSave } from "@/lib/quoteSendGuard";

export const dynamic = "force-dynamic";

/** Like cleanText, but keeps line breaks so a saved multi-line range quote reaches LINE as written. */
function cleanDraftText(value: unknown, limit: number) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  const quote = await prisma.charterQuote.findUnique({ where: { id: params.id } });
  if (!quote) return NextResponse.json({ success: false, error: "Quote not found" }, { status: 404 });
  return NextResponse.json({ success: true, quote });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const requested = cleanText(body.quoteStatus || "DRAFT", 40);
  const quoteDraftText = cleanDraftText(body.quoteDraftText, 4500);
  // v12: under the row lock (options are read after a restore/regenerate in progress, not before) and with the
  // status allowlist: removal and restore go through /archive and /restore so the previous status is kept;
  // order-flow rows keep their status; otherwise only new, DRAFT or HANDOFF (lib/quoteDraftGuard.ts).
  const result = await patchQuoteGuarded(params.id, requested, (current) => {
    // Saving an edited auto draft marks it staff-reviewed so it can be sent; unchanged text stays blocked.
    const reviewed = reviewOnSave(current.quoteOptions, quoteDraftText);
    return {
      recommendedVehicle: cleanText(body.recommendedVehicle, 120),
      quoteDraftText,
      quoteStatus: requested,
      ...(reviewed ? { quoteOptions: reviewed as Prisma.InputJsonObject } : {}),
    };
  });
  if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, quote: result.quote });
}
