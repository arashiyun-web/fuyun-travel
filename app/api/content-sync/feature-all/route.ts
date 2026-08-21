import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { deriveTitleFromSummary } from "@/lib/content-sync/deriveTitle";

export const dynamic = "force-dynamic";

// 老闆按「全部確認上首頁」時呼叫：把「本週待選清單」裡有照片、且還沒
// 個別建立過 FeaturedSpot 的項目，一次全部發布。跟單則的
// POST /api/featured-spots 走同一套邏輯（直接 published，不另外審核），
// 只是批次跑，也不改動 ContentSyncItem.status。
export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const items = await prisma.contentSyncItem.findMany({ where: { status: "pending" } });

  const existing = await prisma.featuredSpot.findMany({
    where: { sourceItemId: { not: null } },
    select: { sourceItemId: true },
  });
  const alreadyFeatured = new Set(existing.map((s) => s.sourceItemId));

  const eligible = items.filter((item) => {
    const photo = (item.rawPayload as { full_picture?: string } | null)?.full_picture;
    return !!photo && !alreadyFeatured.has(item.id);
  });

  const created = [];
  for (const item of eligible) {
    const photo = (item.rawPayload as { full_picture?: string } | null)?.full_picture || null;
    const spot = await prisma.featuredSpot.create({
      data: {
        title: deriveTitleFromSummary(item.summary),
        description: item.summary,
        photoUrl: photo,
        sourceUrl: item.postUrl,
        sourceItemId: item.id,
        postedAt: item.postedAt,
        status: "published",
      },
    });
    created.push(spot);
  }

  return NextResponse.json({ success: true, created: created.length, skipped: items.length - eligible.length, spots: created });
}
