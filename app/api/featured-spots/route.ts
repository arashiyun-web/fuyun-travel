import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { cleanSourceUrl, mergePhotoUrls } from "@/lib/content-sync/photos";
import { ownerHasApprovedCopy } from "@/lib/operations/store";

export const dynamic = "force-dynamic";

// 給 /admin/content-sync 用：列出所有 FeaturedSpot 的 sourceItemId/status，
// 讓畫面知道哪些 ContentSyncItem 已經上過首頁，避免老闆搞不清楚哪些已發布。
export async function GET(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const spots = await prisma.featuredSpot.findMany({
    select: { id: true, sourceItemId: true, status: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, spots });
}

// 確認上首頁只發布已經在 /admin/operations 核准過的同一則標題與說明。
export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: {
    title: string;
    description: string;
    photoUrl?: string;
    photoUrls?: string[];
    sourceUrl?: string;
    sourceItemId?: string;
    postedAt?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "缺少標題/地點" }, { status: 400 });
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "缺少說明文字" }, { status: 400 });
  }
  if (!(await ownerHasApprovedCopy(body.title, body.description))) {
    return NextResponse.json({ error: "文案必須先在 /admin/operations 由老闆核准，才能發布。" }, { status: 409 });
  }

  let postedAt: Date | null = null;
  if (body.postedAt?.trim()) {
    const parsed = new Date(body.postedAt.trim());
    if (!Number.isNaN(parsed.getTime())) postedAt = parsed;
  }

  // Keep every photo: the chosen cover first, then any given photos, then the rest of the source post's
  // photos, so a single-photo form never drops the others. The source link falls back to the post URL.
  const sourceItemId = body.sourceItemId?.trim() || null;
  const sourceItem = sourceItemId ? await prisma.contentSyncItem.findUnique({ where: { id: sourceItemId } }) : null;
  const photoUrls = mergePhotoUrls(body.photoUrl, Array.isArray(body.photoUrls) ? body.photoUrls : [], sourceItem?.rawPayload ?? null);

  const spot = await prisma.featuredSpot.create({
    data: {
      title: body.title.trim(),
      description: body.description.trim(),
      photoUrl: photoUrls[0] ?? null,
      photoUrls,
      sourceUrl: cleanSourceUrl(body.sourceUrl) ?? cleanSourceUrl(sourceItem?.postUrl),
      sourceItemId,
      postedAt,
      status: "published",
    },
  });

  return NextResponse.json({ success: true, spot });
}
