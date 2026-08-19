import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  const items = await prisma.contentSyncItem.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, items });
}
