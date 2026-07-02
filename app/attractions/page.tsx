import type { Metadata } from "next";
import TravelExploreCard from "@/components/TravelExploreCard";
import { explorePageMeta } from "@/lib/travelExplore";
import { attractionEntries } from "@/src/data/attractions";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = explorePageMeta({
  title: "台灣熱門景點探索",
  description: "探索九份、野柳、淡水、日月潭、阿里山、清境與更多台灣包車景點。",
  path: "/attractions",
});

export default function AttractionsPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "景點探索", item: absoluteUrl("/attractions") },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "台灣熱門景點探索",
      itemListElement: attractionEntries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: entry.name,
        url: absoluteUrl(`/attractions/${entry.slug}`),
      })),
    },
  ];

  return (
    <div className="travel-explore-shell knowledge-hub">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="knowledge-hub__hero">
        <p className="travel-section__eyebrow">ATTRACTION ENGINE</p>
        <h1>台灣景點探索</h1>
        <span>用地區、停留時間與旅遊對象，快速找到適合的包車景點。</span>
      </header>
      <section className="travel-explore-section" aria-label="台灣景點">
        <div className="travel-visual-grid">
          {attractionEntries.map((entry) => (
            <TravelExploreCard
              key={entry.slug}
              href={`/attractions/${entry.slug}`}
              image={entry.coverImage}
              title={entry.name}
              description={entry.description}
              meta={`${entry.city}・${entry.stayDuration}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
