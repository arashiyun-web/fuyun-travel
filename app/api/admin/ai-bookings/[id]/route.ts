import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";
import { BOOKING_SELECT, adminBookingView } from "../view";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };
type Context = { params: { id: string } };

export async function GET(request: Request, { params }: Context) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const row = await prisma.aiBooking.findUnique({ where: { id: params.id }, select: BOOKING_SELECT });
    return row ? NextResponse.json({ success: true, booking: adminBookingView(row) }, { headers: HEADERS })
      : NextResponse.json({ success: false, error: "找不到 AI 訂單。" }, { status: 404, headers: HEADERS });
  } catch {
    return NextResponse.json({ success: false, error: "AI 訂單讀取失敗，請稍後重試。" }, { status: 503, headers: HEADERS });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  if (!verifyAdminMutation(request)) return unauthorized();
  const body: unknown = await request.json().catch(() => null);
  const status = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 && "status" in body
    ? body.status : null;
  if (status !== "pending_review" && status !== "confirmed" && status !== "rejected") {
    return NextResponse.json({ success: false, error: "status：只接受 pending_review、confirmed、rejected。" }, { status: 400, headers: HEADERS });
  }
  try {
    const existing = await prisma.aiBooking.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: "找不到 AI 訂單。" }, { status: 404, headers: HEADERS });
    const row = await prisma.aiBooking.update({ where: { id: params.id }, data: { status }, select: BOOKING_SELECT });
    return NextResponse.json({ success: true, booking: adminBookingView(row) }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ success: false, error: "AI 訂單狀態儲存失敗，請稍後重試。" }, { status: 503, headers: HEADERS });
  }
}
