import type { Metadata } from "next";
import TravelExploreCard from "@/components/TravelExploreCard";
import { explorePageMeta } from "@/lib/travelExplore";
import { charterRouteEntries } from "@/src/data/charterRoutes";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = explorePageMeta({
  title: "台灣熱門包車路線",
  description: "探索台北、桃園機場、新北出發的景點接送、長途包車與校外教學路線。",
  path: "/charter-routes",
});

export default function CharterRoutesPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "包車路線", item: absoluteUrl("/charter-routes") },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "台灣熱門包車路線",
      itemListElement: charterRouteEntries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: entry.title,
        url: absoluteUrl(`/charter-routes/${entry.slug}`),
      })),
    },
  ];

  return (
    <div className="travel-explore-shell knowledge-hub">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="knowledge-hub__hero">
        <p className="travel-section__eyebrow">ROUTE ENGINE</p>
        <h1>熱門包車路線</h1>
        <span>先選起點與目的地，再依人數、天數與停靠點評估合適車型。</span>
      </header>
      <section className="travel-explore-section" aria-label="包車路線">
        <div className="travel-visual-grid">
          {charterRouteEntries.map((entry) => (
            <TravelExploreCard key={entry.slug} href={`/charter-routes/${entry.slug}`} image={entry.coverImage} title={entry.title} description={entry.description} meta={entry.routeType} />
          ))}
        </div>
      </section>
    </div>
  );
}
