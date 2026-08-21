import { prisma } from "@/lib/prisma";

// 首頁像部落格一樣有篇數上限，不是無限往下疊加。這是「首頁顯示」的上限，
// 不是刪除資料——FeaturedSpot 記錄全部保留在資料庫，只是首頁只渲染最新
// N 筆。之後若要做「查看全部」頁面列出所有已發布項目，可以直接複用這支
// 元件的查詢邏輯，只是拿掉這個 slice。
const HOMEPAGE_LIMIT = 8;

export default async function FeaturedSpots() {
  const allSpots = await prisma.featuredSpot.findMany({
    where: { status: "published" },
  });

  // 依「貼文實際發文時間」排序，沒有 postedAt 的（例如老闆手動輸入、
  // 沒有原貼文可對應的項目）退而用 createdAt，這樣比純用 createdAt 更
  // 準確反映內容新舊。用 JS 排序而不是 SQL ORDER BY，因為 Postgres 對
  // NULL 排序的預設行為不是「退而用另一個欄位」，這裡明確用
  // postedAt ?? createdAt 這個邏輯排序比較不會出錯。
  const spots = allSpots
    .sort((a, b) => {
      const aTime = (a.postedAt ?? a.createdAt).getTime();
      const bTime = (b.postedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    })
    .slice(0, HOMEPAGE_LIMIT);

  return (
    <section className="page" aria-label="這裡真好玩">
      <h2>這裡真好玩</h2>
      <p className="lead">浮雲輕鬆遊真實走過的行程分享。</p>

      {spots.length === 0 ? (
        <p className="lead" style={{ padding: "24px 0" }}>
          這裡真好玩專區準備中，敬請期待。
        </p>
      ) : (
        <div className="card-grid">
          {spots.map((spot) => (
            <div className="card" key={spot.id}>
              {spot.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spot.photoUrl}
                  alt={spot.title}
                  style={{ width: "100%", borderRadius: 8, marginBottom: 12, display: "block" }}
                />
              ) : null}
              <h3>{spot.title}</h3>
              <p>{spot.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
