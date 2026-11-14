import { randomUUID } from 'node:crypto';
import { verifyAdminRequest as adminIdentity } from '@/lib/adminAuth';
import { AiApiError } from '@/lib/aiApi/errors';
import { notifyStaffStatus } from '@/lib/aiApi/notify';
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
  if (status !== "pending_review" && status !== "confirmed" && status !== "rejected" && status !== "cancelled") {
    return NextResponse.json({ success: false, error: "status：只接受 pending_review、confirmed、rejected、cancelled。" }, { status: 400, headers: HEADERS });
  }
  try {
    const actor = adminIdentity(request)?.username || 'staff';
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.aiBooking.findUnique({ where: { id: params.id }, select: BOOKING_SELECT });
      if (!existing) return { row: null, changed: false };
      if (existing.status === status) return { row: existing, changed: false };
      const changedAt = new Date();
      const changed = await tx.aiBooking.updateMany({ where: { id: params.id, status: existing.status },
        data: { status, statusChangedAt: changedAt, statusChangedBy: actor } });
      if (changed.count !== 1) throw new AiApiError(409, '狀態已由其他專人更新，請重新整理。');
      // Mandatory status audit shares the transaction; audit failure rolls back the status.
      await tx.aiApiAuditLog.create({ data: { id: randomUUID(), createdAt: changedAt,
        eventType: 'status_change', channel: 'admin', bookingId: params.id,
        outcome: 'success', fromStatus: existing.status, toStatus: status, actor } });
      const row = await tx.aiBooking.findUnique({ where: { id: params.id }, select: BOOKING_SELECT });
      return { row, changed: true };
    });
    if (!result.row) return NextResponse.json({ success: false, error: "找不到 AI 訂單。" }, { status: 404, headers: HEADERS });
    if (result.changed && status !== 'pending_review') await notifyStaffStatus(result.row, actor).catch(() => {});
    return NextResponse.json({ success: true, booking: adminBookingView(result.row) }, { headers: HEADERS });
  } catch (error) {
    if (error instanceof AiApiError && error.status === 409) return NextResponse.json({ success: false, error: error.message }, { status: 409, headers: HEADERS });
    return NextResponse.json({ success: false, error: "AI 訂單狀態儲存失敗，請稍後重試。" }, { status: 503, headers: HEADERS });
  }
}
