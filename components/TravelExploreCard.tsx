import Link from "next/link";
import type { Attraction, Route, SchoolTrip } from "@/lib/travelExplore";

type TravelExploreCardProps = {
  href?: string;
  image: string;
  title: string;
  description: string;
  meta?: string;
  priority?: boolean;
};

// This visual-first card is shared by every exploration section to keep density controlled.
export default function TravelExploreCard({
  href,
  image,
  title,
  description,
  meta,
  priority = false,
}: TravelExploreCardProps) {
  // Unsplash width parameters provide responsive candidates without adding image infrastructure.
  const responsiveSource = (width: number) => image.replace(/([?&])w=\d+/, '$1w=' + width);
  const imageAlt = meta ? title + '，' + meta : title;

  const content = (
    <>
      <span className="travel-explore-card__media">
        {/* Native images allow the existing app to use curated remote imagery without changing global image config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="travel-explore-card__image"
          src={image}
          srcSet={responsiveSource(480) + ' 480w, ' + responsiveSource(800) + ' 800w, ' + responsiveSource(1200) + ' 1200w'}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1400px) 33vw, 25vw"
          alt={imageAlt}
          width={720}
          height={540}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
        <span className="travel-explore-card__shade" aria-hidden="true" />
        {meta ? <span className="travel-explore-card__meta">{meta}</span> : null}
      </span>
      <span className="travel-explore-card__content">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </>
  );

  return href ? (
    <Link className="travel-explore-card" href={href}>
      {content}
    </Link>
  ) : (
    <article className="travel-explore-card">{content}</article>
  );
}

type ExploreDetailPageProps = {
  item: Attraction | Route | SchoolTrip;
  parentName: string;
  parentPath: string;
  jsonLd: object[];
};

// Detail pages share this concise visual layout without adding a second component file.
export function ExploreDetailPage({
  item,
  parentName,
  parentPath,
  jsonLd,
}: ExploreDetailPageProps) {
  const responsiveSource = (width: number) =>
    item.coverImage.replace(/([?&])w=\d+/, '$1w=' + width);
  const facts = item.kind === 'route'
    ? [
        { label: '出發地', value: item.origin },
        { label: '目的地', value: item.destination },
      ]
    : [
        { label: '地點', value: item.location },
        ...(item.kind === 'schoolTrip'
          ? [{ label: '適合對象', value: item.suitableFor }]
          : []),
      ];

  return (
    <div className="travel-explore-shell travel-detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="travel-breadcrumb" aria-label="麵包屑">
        <Link href="/">首頁</Link>
        <span aria-hidden="true">/</span>
        <Link href={parentPath}>{parentName}</Link>
        <span aria-hidden="true">/</span>
        <span>{item.title}</span>
      </nav>

      <header className="travel-detail__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.coverImage}
          srcSet={responsiveSource(720) + ' 720w, ' + responsiveSource(1200) + ' 1200w, ' + responsiveSource(1800) + ' 1800w'}
          sizes="(max-width: 680px) calc(100vw - 24px), calc(100vw - 40px)"
          alt={item.title + '，' + item.description}
          width={1400}
          height={820}
          fetchPriority="high"
        />
        <span className="travel-detail__shade" aria-hidden="true" />
        <div className="travel-detail__heading">
          <p>{parentName}</p>
          <h1>{item.title}</h1>
          <span>{item.description}</span>
        </div>
      </header>

      <section className="travel-detail__summary" aria-labelledby="planning-title">
        <div>
          <p className="travel-section__eyebrow">TRIP OVERVIEW</p>
          <h2 id="planning-title">探索重點</h2>
          <p>{item.description}</p>
        </div>
        <dl>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="travel-related" aria-labelledby="related-title">
        <div>
          <p className="travel-section__eyebrow">NEXT STEP</p>
          <h2 id="related-title">繼續規劃</h2>
        </div>
        <div className="travel-related__links">
          {item.relatedLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
          <Link href="/travel-planner">
            開始規劃行程
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
