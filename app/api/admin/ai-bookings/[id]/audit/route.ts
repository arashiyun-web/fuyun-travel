import { NextResponse } from 'next/server';
import { unauthorized, verifyAdminRequest } from '@/lib/adminQuoteAuth';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const booking = await prisma.aiBooking.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!booking) return NextResponse.json({ success: false, error: '找不到 AI 訂單。' }, { status: 404, headers });
    const logs = await prisma.aiApiAuditLog.findMany({ where: { bookingId: params.id }, take: 50,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true, eventType: true, outcome: true, fromStatus: true, toStatus: true, actor: true } });
    const audits = logs.map(({ createdAt, eventType, outcome, fromStatus, toStatus, actor }) => ({ createdAt, eventType, outcome, fromStatus, toStatus, actor }));
    return NextResponse.json({ success: true, audits }, { headers });
  } catch {
    return NextResponse.json({ success: false, error: '紀錄讀取失敗，請稍後重試。' }, { status: 503, headers });
  }
}
