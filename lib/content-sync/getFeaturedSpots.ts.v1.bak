import { prisma } from "@/lib/prisma";

// 共用查詢邏輯，首頁精選預告（有 limit）跟 /highlights 完整列表（無 limit）
// 都用這支，確保兩邊資料來源與排序邏輯一致，不是各自兜一份。
export async function getPublishedFeaturedSpots(limit?: number) {
  const allSpots = await prisma.featuredSpot.findMany({
    where: { status: "published" },
  });

  // 依「貼文實際發文時間」排序，沒有 postedAt 的退而用 createdAt。用 JS
  // 排序而不是 SQL ORDER BY，因為 Postgres 對 NULL 排序的預設行為不是
  // 「退而用另一個欄位」，這樣明確用 postedAt ?? createdAt 比較不會出錯。
  const sorted = allSpots.sort((a, b) => {
    const aTime = (a.postedAt ?? a.createdAt).getTime();
    const bTime = (b.postedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });

  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}
