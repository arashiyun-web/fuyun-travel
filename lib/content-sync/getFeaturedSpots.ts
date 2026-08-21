import { prisma } from "@/lib/prisma";

// /highlights 完整列表用。依「貼文實際發文時間」排序，沒有 postedAt 的
// 退而用 createdAt。用 JS 排序而不是 SQL ORDER BY，因為 Postgres 對 NULL
// 排序的預設行為不是「退而用另一個欄位」，這樣明確用 postedAt ?? createdAt
// 比較不會出錯。
export async function getPublishedFeaturedSpots() {
  const allSpots = await prisma.featuredSpot.findMany({
    where: { status: "published" },
  });

  return allSpots.sort((a, b) => {
    const aTime = (a.postedAt ?? a.createdAt).getTime();
    const bTime = (b.postedAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}
