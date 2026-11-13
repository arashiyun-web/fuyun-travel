import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { notifyBooking } from "@/lib/aiApi/notify";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const HEADERS = { "Cache-Control": "no-store" };
const missing = () => NextResponse.json({ success: false, error: "找不到 AI 訂單。" }, { status: 404, headers: HEADERS });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  try {
    const booking = await prisma.aiBooking.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!booking) return missing();
    const result = await notifyBooking(booking.id);
    if (!result) return missing();
    return NextResponse.json({ success: true,
      notificationStatus: result.notificationStatus, notificationAttempts: result.notificationAttempts,
    }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ success: false, error: "通知未送達，請稍後重送。" }, { status: 503, headers: HEADERS });
  }
}
