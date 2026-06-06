import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { travelArticles } from "@/lib/travelContent";

export const metadata: Metadata = pageMeta({
  title: "熱門旅遊內容",
  description: "小羽旅遊趣與 Facebook Auto Sync 預留的熱門旅遊內容聚合頁。",
  path: "/featured-trips",
});

const socialStats = [
  { slug: "taiwan-charter-travel-guide", likes: 128, comments: 18, shares: 9 },
  { slug: "alishan-sunrise-charter", likes: 96, comments: 11, shares: 7 },
  { slug: "airport-transfer-group-guide", likes: 74, comments: 8, shares: 5 },
  { slug: "school-trip-charter-safety", likes: 68, comments: 6, shares: 4 },
];

export default function FeaturedTripsPage() {
  const ranked = socialStats
    .map((stat) => ({
      ...stat,
      article: travelArticles.find((article) => article.slug === stat.slug),
      score: stat.likes + stat.comments * 2 + stat.shares * 3,
    }))
    .filter((item) => item.article)
    .sort((a, b) => b.score - a.score);

  return (
    <>
      <h1>熱門旅遊內容</h1>
      <p className="lead">第一版以站內內容與社群互動欄位示範，未來可串接 Facebook Graph API 同步貼文、圖片、影片、按讚數、留言數與分享數。</p>
      <section className="card-grid">
        {ranked.map((item) => (
          <article className="card" key={item.slug}>
            <p className="lead">熱門分數 {item.score}｜讚 {item.likes}｜留言 {item.comments}｜分享 {item.shares}</p>
            <h3>{item.article?.title}</h3>
            <p>{item.article?.description}</p>
            <Link href={`/travel/${item.slug}`}>閱讀內容</Link>
          </article>
        ))}
      </section>
    </>
  );
}
