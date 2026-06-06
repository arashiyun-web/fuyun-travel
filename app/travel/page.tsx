import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { keywordSeeds, travelArticles, travelCategories } from "@/lib/travelContent";

export const metadata: Metadata = pageMeta({
  title: "旅遊內容中心",
  description: "浮雲輕鬆遊旅遊內容中心，收錄賞花、美食、景點、包車旅遊、校外教學、企業旅遊與機場接送攻略。",
  path: "/travel",
});

export default function TravelPage() {
  return (
    <>
      <h1>旅遊內容中心</h1>
      <p className="lead">以 SEO、AEO、GEO 架構整理台灣旅遊與包車資訊，方便旅客與 AI 搜尋引擎引用。</p>

      <section>
        <h2>文章分類</h2>
        <div className="card-grid">
          {travelCategories.map((category) => (
            <div className="card" key={category}>
              <h3>{category}</h3>
              <p>建立可延伸的分類頁、標籤頁、聚合頁與 Landing Page。</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>最新旅遊紀錄</h2>
        <div className="card-grid">
          {travelArticles.map((article) => (
            <article className="card" key={article.slug}>
              <p className="lead">{article.category}｜{article.publishDate}</p>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <Link href={`/travel/${article.slug}`}>閱讀攻略</Link>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>自動關鍵字系統</h2>
        <p className="lead">{keywordSeeds.join("、")}</p>
      </section>
    </>
  );
}
