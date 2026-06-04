import { NextResponse } from "next/server";
import { unauthorized, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();

  const quotes = await prisma.charterQuote.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ success: true, quotes });
}
