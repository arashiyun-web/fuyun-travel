import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LineButton from "@/components/LineButton";
import { absoluteUrl, COMPANY, organizationJsonLd } from "@/lib/site";
import { explorePageMeta } from "@/lib/travelExplore";
import { charterRouteEntries, getRouteBySlug, routePriceNotice, type CharterRouteEntry } from "@/src/data/charterRoutes";

type RoutePageProps = { params: { slug: string } };
export const dynamicParams = false;

export function generateStaticParams() {
  return charterRouteEntries.flatMap((entry) => [entry.slug, ...(entry.legacySlugs ?? [])].map((slug) => ({ slug })));
}

export function generateMetadata({ params }: RoutePageProps): Metadata {
  const entry = getRouteBySlug(params.slug);
  if (!entry) return explorePageMeta({ title: "找不到包車路線", path: "/charter-routes" });
  return explorePageMeta({ title: entry.title, description: entry.description, path: `/charter-routes/${entry.slug}`, image: entry.coverImage, type: "article" });
}

function routeSchemas(entry: CharterRouteEntry) {
  const path = `/charter-routes/${entry.slug}`;
  return [
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "包車路線", item: absoluteUrl("/charter-routes") },
        { "@type": "ListItem", position: 3, name: entry.title, item: absoluteUrl(path) },
      ],
    },
    {
      "@context": "https://schema.org", "@type": "Article", headline: entry.title,
      description: entry.description, image: entry.coverImage, datePublished: entry.updatedAt,
      dateModified: entry.updatedAt, mainEntityOfPage: absoluteUrl(path), about: [entry.origin, entry.destination, entry.routeType],
      author: { "@type": "Organization", name: COMPANY.companyName },
      publisher: { "@type": "Organization", name: COMPANY.siteName },
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: entry.faq.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })),
    },
    organizationJsonLd(),
  ];
}

function RouteCard({ title, items }: { title: string; items: string[] }) {
  return <section className="knowledge-decision-card"><h2>{title}</h2><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}

export default function CharterRoutePage({ params }: RoutePageProps) {
  const entry = getRouteBySlug(params.slug);
  if (!entry) notFound();
  const responsiveImage = (width: number) => entry.coverImage.replace(/([?&])w=\d+/, `$1w=${width}`);

  return (
    <article className="travel-explore-shell knowledge-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(routeSchemas(entry)) }} />
      <nav className="travel-breadcrumb" aria-label="麵包屑"><Link href="/">首頁</Link><span aria-hidden="true">/</span><Link href="/charter-routes">包車路線</Link><span aria-hidden="true">/</span><span>{entry.title}</span></nav>
      <header className="travel-detail__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.coverImage}
          srcSet={`${responsiveImage(720)} 720w, ${responsiveImage(1200)} 1200w, ${responsiveImage(1400)} 1400w`}
          sizes="(max-width: 680px) calc(100vw - 24px), calc(100vw - 40px)"
          alt={entry.title}
          width={1400}
          height={820}
          fetchPriority="high"
        />
        <span className="travel-detail__shade" aria-hidden="true" />
        <div className="travel-detail__heading"><p>{entry.routeType}</p><h1>{entry.title}</h1><span>{entry.description}</span></div>
      </header>

      <section className="travel-detail__summary" aria-labelledby="route-overview">
        <div><p className="travel-section__eyebrow">ROUTE OVERVIEW</p><h2 id="route-overview">行程時間與路線建議</h2><p>{entry.description}</p></div>
        <dl><div><dt>出發地</dt><dd>{entry.origin}</dd></div><div><dt>目的地</dt><dd>{entry.destination}</dd></div><div><dt>建議時間</dt><dd>{entry.estimatedDuration}</dd></div></dl>
      </section>

      <div className="knowledge-decision-grid">
        <RouteCard title="適合誰" items={entry.suitableFor} />
        <RouteCard title="費用影響因素" items={[...entry.priceFactors, routePriceNotice]} />
        <RouteCard title="推薦停靠點" items={entry.recommendedStops} />
      </div>

      <section className="knowledge-related" aria-labelledby="route-related">
        <div><p className="travel-section__eyebrow">RELATED CONTENT</p><h2 id="route-related">相關景點與知識庫</h2></div>
        <div>{[...entry.relatedAttractions, ...entry.relatedKnowledge].map((link) => <Link href={link.href} key={`${link.href}-${link.label}`}>{link.label}<span>→</span></Link>)}</div>
      </section>

      <section className="knowledge-faq" aria-labelledby="route-faq">
        <div><p className="travel-section__eyebrow">FAQ</p><h2 id="route-faq">常見問題</h2></div>
        <div>{entry.faq.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <section className="knowledge-cta">
        <div><p className="travel-section__eyebrow">FUYUN TRAVEL</p><h2>需要安排包車？讓浮雲小幫手協助您快速評估。</h2></div>
        <div className="knowledge-cta__actions"><Link className="knowledge-cta__quote" href="/contact/inquiry">立即詢價</Link><LineButton className="knowledge-cta__line" source="article">加入 LINE</LineButton></div>
      </section>
    </article>
  );
}
