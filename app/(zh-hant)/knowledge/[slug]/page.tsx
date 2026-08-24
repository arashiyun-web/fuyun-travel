import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LineButton from "@/components/LineButton";
import { absoluteUrl, COMPANY } from "@/lib/site";
import { explorePageMeta } from "@/lib/travelExplore";
import { getAttractionBySlug } from "@/src/data/attractions";
import {
  getKnowledgeBySlug,
  knowledgeEntries,
  type KnowledgeEntry,
} from "@/src/data/knowledge";

type KnowledgeDetailPageProps = { params: { slug: string } };

// Only curated knowledge records are valid; unknown slugs must return a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return knowledgeEntries.map((entry) => ({ slug: entry.slug }));
}

export function generateMetadata({ params }: KnowledgeDetailPageProps): Metadata {
  const entry = getKnowledgeBySlug(params.slug);
  if (!entry) return explorePageMeta({ title: "找不到知識內容", path: "/knowledge" });
  return explorePageMeta({
    title: entry.title,
    description: entry.description,
    path: `/knowledge/${entry.slug}`,
    image: knowledgeImage(entry),
    type: "article",
  });
}

function knowledgeImage(entry: KnowledgeEntry) {
  const attractionPath = entry.relatedAttractions.find((link) => link.href.startsWith("/attractions/"));
  const attractionSlug = attractionPath?.href.split("/").filter(Boolean).pop();
  return (attractionSlug ? getAttractionBySlug(attractionSlug)?.coverImage : undefined) ?? "/hero-bus-sunny.png";
}

function knowledgeSchemas(entry: KnowledgeEntry) {
  const path = `/knowledge/${entry.slug}`;
  const image = knowledgeImage(entry);
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "旅遊知識庫", item: absoluteUrl("/knowledge") },
        { "@type": "ListItem", position: 3, name: entry.title, item: absoluteUrl(path) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: entry.title,
      description: entry.description,
      image: image.startsWith("/") ? absoluteUrl(image) : image,
      dateModified: entry.updatedAt,
      datePublished: entry.updatedAt,
      mainEntityOfPage: absoluteUrl(path),
      author: { "@type": "Organization", name: COMPANY.companyName },
      publisher: { "@type": "Organization", name: COMPANY.siteName },
      keywords: entry.keywords,
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

function DecisionCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="knowledge-decision-card">
      <h2>{title}</h2>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

// Knowledge details use decision cards instead of a long-form blog layout.
export default function KnowledgeDetailPage({ params }: KnowledgeDetailPageProps) {
  const entry = getKnowledgeBySlug(params.slug);
  if (!entry) notFound();
  const image = knowledgeImage(entry);
  const responsiveImage = (width: number) => image.replace(/([?&])w=\d+/, `$1w=${width}`);

  return (
    <article className="travel-explore-shell knowledge-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(knowledgeSchemas(entry)) }} />

      <nav className="travel-breadcrumb" aria-label="麵包屑">
        <Link href="/">首頁</Link><span aria-hidden="true">/</span>
        <Link href="/knowledge">旅遊知識庫</Link><span aria-hidden="true">/</span>
        <span>{entry.title}</span>
      </nav>

      <header className="knowledge-detail__hero">
        <p className="travel-section__eyebrow">{entry.category}</p>
        <h1>{entry.title}</h1>
        <p>{entry.summary}</p>
        {/* The visible image matches Article Schema and remains responsive on mobile. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          srcSet={`${responsiveImage(640)} 640w, ${responsiveImage(960)} 960w, ${responsiveImage(1400)} 1400w`}
          sizes="(max-width: 760px) calc(100vw - 32px), 960px"
          alt={`${entry.title}旅遊資訊`}
          width={960}
          height={540}
          loading="eager"
          style={{ width: "100%", height: "auto", objectFit: "cover", borderRadius: 16, marginTop: 28 }}
        />
        <div className="knowledge-detail__keywords" aria-label="關鍵字">
          {entry.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
        </div>
      </header>

      <section className="knowledge-highlights" aria-labelledby="highlights-title">
        <p className="travel-section__eyebrow">QUICK ANSWER</p>
        <h2 id="highlights-title">先看重點</h2>
        <ul>{entry.keyPoints.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>

      <div className="knowledge-decision-grid">
        <DecisionCard title="這篇適合誰" items={entry.suitableFor} />
        <DecisionCard title="建議怎麼安排" items={entry.content.arrangement} />
        <DecisionCard title="費用影響因素" items={entry.content.costFactors} />
        <DecisionCard title="注意事項" items={entry.content.cautions} />
      </div>

      <section className="knowledge-faq" aria-labelledby="faq-title">
        <div><p className="travel-section__eyebrow">FAQ</p><h2 id="faq-title">常見問題</h2></div>
        <div>
          {entry.faq.map((faq) => (
            <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>
          ))}
        </div>
      </section>

      {entry.relatedRoutes.length > 0 || entry.relatedAttractions.length > 0 ? (
        <section className="knowledge-related" aria-labelledby="related-title">
          <div><p className="travel-section__eyebrow">RELATED LINKS</p><h2 id="related-title">相關包車路線與景點</h2></div>
          <div>
            {[...entry.relatedRoutes, ...entry.relatedAttractions].map((link) => (
              <Link href={link.href} key={`${link.href}-${link.label}`}>{link.label}<span aria-hidden="true">→</span></Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="knowledge-cta" aria-labelledby="knowledge-cta-title">
        <div>
          <p className="travel-section__eyebrow">FUYUN TRAVEL</p>
          <h2 id="knowledge-cta-title">需要安排包車？讓浮雲小幫手協助您快速評估。</h2>
        </div>
        <div className="knowledge-cta__actions">
          <Link className="knowledge-cta__quote" href="/contact/inquiry">立即詢價</Link>
          <LineButton className="knowledge-cta__line" source="article">加入 LINE</LineButton>
        </div>
      </section>
    </article>
  );
}
