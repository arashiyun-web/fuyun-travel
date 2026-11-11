import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import {
  LIST_PAGE_SIZE,
  MAX_LIST_PAGE_SIZE,
  legacyStatusWhere,
  pageWindow,
  parseListTab,
  parsePositiveInt,
  tabWhere,
  uniqueIds,
} from "@/lib/content-sync/listManage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = verifyAdminToken(request.headers.get("authorization"));
  if (!authResult) return NextResponse.json({ error: "未授權" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tabParam = searchParams.get("tab");

  // 舊版查詢（沒有 tab）：照舊用 ?status=，但 status=all 不再包含已移除的項目。
  if (!tabParam) {
    const status = searchParams.get("status") || "pending";
    const items = await prisma.contentSyncItem.findMany({
      where: legacyStatusWhere(status),
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, items });
  }

  // 分頁籤 + 伺服器端分頁：清單變長時一次只回一頁。
  const tab = parseListTab(tabParam);
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE);
  const requestedPage = parsePositiveInt(searchParams.get("page"), 1);

  const spots = await prisma.featuredSpot.findMany({
    where: { sourceItemId: { not: null } },
    select: { sourceItemId: true },
  });
  const featuredItemIds = uniqueIds(spots.map((s: { sourceItemId: string | null }) => s.sourceItemId));

  const [pendingCount, featuredCount, archivedCount] = await Promise.all([
    prisma.contentSyncItem.count({ where: tabWhere("pending", featuredItemIds) }),
    prisma.contentSyncItem.count({ where: tabWhere("featured", featuredItemIds) }),
    prisma.contentSyncItem.count({ where: tabWhere("archived", featuredItemIds) }),
  ]);
  const counts = { pending: pendingCount, featured: featuredCount, archived: archivedCount };
  const total = counts[tab];
  const { page, totalPages, skip, take } = pageWindow(total, requestedPage, pageSize);

  const items = await prisma.contentSyncItem.findMany({
    where: tabWhere(tab, featuredItemIds),
    orderBy: tab === "archived" ? [{ updatedAt: "desc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "asc" }],
    skip,
    take,
  });

  return NextResponse.json({ success: true, tab, items, counts, total, page, pageSize, totalPages });
}
