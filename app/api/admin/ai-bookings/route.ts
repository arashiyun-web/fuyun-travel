import { NextResponse } from "next/server";
import { unauthorized, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";
import { BOOKING_SELECT, adminBookingView } from "./view";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const rows = await prisma.aiBooking.findMany({ select: BOOKING_SELECT, take: 100, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, bookings: rows.map(adminBookingView) }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ success: false, error: "AI 訂單讀取失敗，請稍後重試。" }, { status: 503, headers: HEADERS });
  }
}
