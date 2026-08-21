import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 老闆在 /admin/content-sync 對某則 ContentSyncItem 按「確認上首頁」時呼叫。
// 這個點擊動作本身就代表內容與版權都已經過老闆確認，直接以 published 狀態
// 寫入，不另外審核。跟 ContentSyncItem 的「生成草稿」流程（/select）完全
// 獨立，不會改動 ContentSyncItem 的 status。
export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: {
    title: string;
    description: string;
    photoUrl?: string;
    sourceUrl?: string;
    sourceItemId?: string;
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

  const spot = await prisma.featuredSpot.create({
    data: {
      title: body.title.trim(),
      description: body.description.trim(),
      photoUrl: body.photoUrl?.trim() || null,
      sourceUrl: body.sourceUrl?.trim() || null,
      sourceItemId: body.sourceItemId?.trim() || null,
      status: "published",
    },
  });

  return NextResponse.json({ success: true, spot });
}
