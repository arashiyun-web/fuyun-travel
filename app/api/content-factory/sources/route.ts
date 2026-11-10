import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { featuredSpotSource } from "@/lib/content-factory/sources";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!verifyAdminToken(request.headers.get("authorization"))) return NextResponse.json({ error: "未授權" }, { status: 401 });
  try {
    const spots = await prisma.featuredSpot.findMany({
      where: { status: "published" },
      select: { id: true, title: true, description: true, photoUrl: true, photoUrls: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ sources: spots.map(featuredSpotSource) });
  } catch {
    return NextResponse.json({ error: "素材暫時無法讀取，請稍後重試。" }, { status: 503 });
  }
}
