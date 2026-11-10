import { NextResponse } from "next/server";
import { unauthorized, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function historyCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

/** Read-only member inventory. Does not send LINE or create orders. */
export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();
  try {
    const members = await prisma.lineUser.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({
      success: true,
      orderTable: false,
      members: members.map((member) => ({
        id: member.id,
        name: member.name || "未填姓名",
        memberLevel: member.memberLevel || "未分級",
        orderCount: historyCount(member.orderHistory),
        quoteCount: historyCount(member.quoteHistory),
        createdAt: member.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ success: false, error: "會員讀取失敗，不是沒有資料。" }, { status: 503 });
  }
}
