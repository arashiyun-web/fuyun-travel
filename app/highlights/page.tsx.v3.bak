import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { getPublishedFeaturedSpots } from "@/lib/content-sync/getFeaturedSpots";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "這裡真好玩",
  description: "浮雲輕鬆遊真實走過的行程分享，完整列表。",
  path: "/highlights",
});

export default async function HighlightsPage() {
  const spots = await getPublishedFeaturedSpots();

  return (
    <>
      <div className="highlights-hero">
        <div className="highlights-hero__content">
          <h1>這裡真好玩</h1>
          <p className="lead">浮雲輕鬆遊真實走過的行程分享，完整列表。</p>
        </div>
      </div>

      {spots.length === 0 ? (
        <p className="lead" style={{ padding: "24px 0" }}>
          這裡真好玩專區準備中，敬請期待。
        </p>
      ) : (
        <div className="spot-list">
          {spots.map((spot) => {
            const photos = spot.photoUrls.length > 0
              ? spot.photoUrls
              : spot.photoUrl
                ? [spot.photoUrl]
                : [];

            return (
              <article className="spot-article" key={spot.id}>
                {photos.length > 0 ? (
                  <div className="spot-article__photos">
                    {photos.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt={spot.title} />
                    ))}
                  </div>
                ) : null}
                <h3>{spot.title}</h3>
                <p className="spot-article__text">{spot.description}</p>
                {spot.sourceUrl ? (
                  <p className="spot-article__source">
                    <a href={spot.sourceUrl} target="_blank" rel="noopener noreferrer">
                      查看原始貼文 →
                    </a>
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
