import { NextResponse } from "next/server";
import { unauthorized, verifyAdminMutation } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: Request, context: { params: { id: string } }) {
  if (!verifyAdminMutation(request)) return unauthorized();
  try {
    const key = await prisma.apiKey.findUnique({ where: { id: context.params.id }, select: { id: true, disabledAt: true } });
    if (key === null) return NextResponse.json({ success: false, error: "找不到金鑰。" }, { status: 404, headers: HEADERS });
    const disabledAt = key.disabledAt ?? new Date();
    if (key.disabledAt === null) {
      await prisma.apiKey.update({ where: { id: key.id }, data: { disabledAt } });
    }
    return NextResponse.json({ success: true, id: key.id, disabledAt }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ success: false, error: "金鑰停用失敗，請稍後重試。" }, { status: 503, headers: HEADERS });
  }
}
