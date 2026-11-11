import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { ARCHIVED_STATUS, PENDING_STATUS } from "@/lib/content-sync/listManage";

export const dynamic = "force-dynamic";

// 從「本週待選清單」移除或還原一則項目（軟刪除）。
// 移除：status pending → archived，資料保留；sourcePostId 也保留，所以每週拉取不會把它重新拉回來。
// 還原：status archived → pending。
// 首頁「這裡真好玩」的卡片（FeaturedSpot）完全不動：已經上首頁的照舊顯示。
export async function POST(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  let body: { id?: unknown; restore?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 格式錯誤" }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  const restore = body.restore === true;

  const item = await prisma.contentSyncItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "找不到這個項目" }, { status: 404 });

  if (restore) {
    if (item.status !== ARCHIVED_STATUS) {
      return NextResponse.json({ error: "這則沒有被移除，不需要還原" }, { status: 409 });
    }
    const updated = await prisma.contentSyncItem.update({ where: { id }, data: { status: PENDING_STATUS } });
    return NextResponse.json({ success: true, item: updated });
  }

  if (item.status === ARCHIVED_STATUS) {
    return NextResponse.json({ success: true, alreadyArchived: true, item });
  }
  if (item.status !== PENDING_STATUS) {
    return NextResponse.json({ error: "只能移除清單中待處理的項目" }, { status: 409 });
  }
  const updated = await prisma.contentSyncItem.update({ where: { id }, data: { status: ARCHIVED_STATUS } });
  return NextResponse.json({ success: true, item: updated });
}
