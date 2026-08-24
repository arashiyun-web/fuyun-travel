import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import { explorePageMeta } from "@/lib/travelExplore";
import LineButton from "@/components/LineButton";
import { attractionEntries, getAttractionBySlug, type AttractionEntry } from "@/src/data/attractions";

type AttractionPageProps = { params: { slug: string } };
export const dynamicParams = false;

export function generateStaticParams() {
  return attractionEntries.flatMap((entry) => [entry.slug, ...(entry.legacySlugs ?? [])].map((slug) => ({ slug })));
}

export function generateMetadata({ params }: AttractionPageProps): Metadata {
  const entry = getAttractionBySlug(params.slug);
  if (!entry) return explorePageMeta({ title: "找不到景點", path: "/attractions" });
  return explorePageMeta({
    title: `${entry.name}旅遊攻略`,
    description: entry.description,
    path: `/attractions/${entry.slug}`,
    image: entry.coverImage,
  });
}

function attractionSchemas(entry: AttractionEntry) {
  const path = `/attractions/${entry.slug}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      name: entry.name,
      description: entry.description,
      image: entry.coverImage,
      url: absoluteUrl(path),
      address: { "@type": "PostalAddress", addressLocality: entry.city, addressCountry: "TW" },
      touristType: entry.suitableFor,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "景點探索", item: absoluteUrl("/attractions") },
        { "@type": "ListItem", position: 3, name: entry.name, item: absoluteUrl(path) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: entry.faq.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return <section className="knowledge-decision-card"><h2>{title}</h2><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}

export default function AttractionPage({ params }: AttractionPageProps) {
  const entry = getAttractionBySlug(params.slug);
  if (!entry) notFound();
  const responsiveImage = (width: number) => entry.coverImage.replace(/([?&])w=\d+/, `$1w=${width}`);

  return (
    <article className="travel-explore-shell knowledge-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(attractionSchemas(entry)) }} />
      <nav className="travel-breadcrumb" aria-label="麵包屑">
        <Link href="/">首頁</Link><span aria-hidden="true">/</span>
        <Link href="/attractions">景點探索</Link><span aria-hidden="true">/</span><span>{entry.name}</span>
      </nav>
      <header className="travel-detail__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.coverImage}
          srcSet={`${responsiveImage(720)} 720w, ${responsiveImage(1200)} 1200w, ${responsiveImage(1400)} 1400w`}
          sizes="(max-width: 680px) calc(100vw - 24px), calc(100vw - 40px)"
          alt={`${entry.name}景點`}
          width={1400}
          height={820}
          fetchPriority="high"
        />
        <span className="travel-detail__shade" aria-hidden="true" />
        <div className="travel-detail__heading"><p>{entry.city}・{entry.region}</p><h1>{entry.name}</h1><span>{entry.description}</span></div>
      </header>

      <section className="travel-detail__summary" aria-labelledby="attraction-overview">
        <div><p className="travel-section__eyebrow">ATTRACTION OVERVIEW</p><h2 id="attraction-overview">景點摘要</h2><p>{entry.description}</p></div>
        <dl>
          <div><dt>建議停留</dt><dd>{entry.stayDuration}</dd></div>
          <div><dt>最佳季節</dt><dd>{entry.bestSeason}</dd></div>
          <div><dt>所在區域</dt><dd>{entry.city}・{entry.region}</dd></div>
        </dl>
      </section>

      <div className="knowledge-decision-grid">
        <ListCard title="適合族群" items={entry.suitableFor} />
        <ListCard title="景點亮點" items={entry.highlights} />
      </div>

      <section className="knowledge-related" aria-labelledby="attraction-related">
        <div><p className="travel-section__eyebrow">PLAN NEXT</p><h2 id="attraction-related">附近景點、推薦路線與攻略</h2></div>
        <div>{[...entry.nearbyAttractions, ...entry.recommendedRoutes, ...entry.relatedKnowledge].map((link) => <Link href={link.href} key={`${link.href}-${link.label}`}>{link.label}<span>→</span></Link>)}</div>
      </section>

      <section className="knowledge-faq" aria-labelledby="attraction-faq">
        <div><p className="travel-section__eyebrow">FAQ</p><h2 id="attraction-faq">常見問題</h2></div>
        <div>{entry.faq.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <section className="knowledge-cta">
        <div><p className="travel-section__eyebrow">FUYUN TRAVEL</p><h2>想把 {entry.name} 排進行程？讓浮雲小幫手協助規劃包車。</h2></div>
        <div className="knowledge-cta__actions"><Link className="knowledge-cta__quote" href="/contact/inquiry">規劃包車行程</Link><LineButton className="knowledge-cta__line" source="article">加入 LINE</LineButton></div>
      </section>
    </article>
  );
}
