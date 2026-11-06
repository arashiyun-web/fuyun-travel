import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { deriveTitleFromSummary } from "@/lib/content-sync/deriveTitle";
import { cleanSourceUrl, collectPhotoUrls } from "@/lib/content-sync/photos";
import { ownerHasApprovedCopy } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

// 老闆按「全部確認上首頁」時呼叫。文案必須先在 /admin/operations 核准
// （標題與說明逐字相同，且有老闆核准事件），這裡才寫入 published。
export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const items = await prisma.contentSyncItem.findMany({ where: { status: "pending" } });

  const existing = await prisma.featuredSpot.findMany({
    where: { sourceItemId: { not: null } },
    select: { sourceItemId: true },
  });
  const alreadyFeatured = new Set(existing.map((s) => s.sourceItemId));

  const eligible = items.filter((item) => collectPhotoUrls(item.rawPayload).length > 0 && !alreadyFeatured.has(item.id));

  const created = [];
  let needsApproval = 0;
  for (const item of eligible) {
    const photoUrls = collectPhotoUrls(item.rawPayload);
    const title = deriveTitleFromSummary(item.summary);
    const description = item.summary;
    if (!(await ownerHasApprovedCopy(title, description))) {
      needsApproval += 1;
      continue;
    }
    const spot = await prisma.featuredSpot.create({
      data: {
        title,
        description: item.summary,
        photoUrl: photoUrls[0] ?? null,
        photoUrls,
        sourceUrl: cleanSourceUrl(item.postUrl),
        sourceItemId: item.id,
        postedAt: item.postedAt,
        status: "published",
      },
    });
    created.push(spot);
  }

  if (!created.length && needsApproval > 0) {
    return NextResponse.json({ success: false, error: `有 ${needsApproval} 則文案尚未在 /admin/operations 核准，沒有發布。`, needsApproval }, { status: 409 });
  }
  return NextResponse.json({ success: true, created: created.length, skipped: items.length - eligible.length, needsApproval, spots: created });
}
