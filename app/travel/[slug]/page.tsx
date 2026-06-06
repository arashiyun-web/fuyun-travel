import Link from "next/link";
import { notFound } from "next/navigation";
import { absoluteUrl, pageMeta } from "@/lib/site";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  findTravelArticle,
  travelArticles,
} from "@/lib/travelContent";

type TravelDetailPageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return travelArticles.map((article) => ({ slug: article.slug }));
}

export function generateMetadata({ params }: TravelDetailPageProps) {
  const article = findTravelArticle(params.slug);
  if (!article) return pageMeta({ title: "旅遊內容中心", path: "/travel" });
  return pageMeta({
    title: article.title,
    description: article.description,
    path: `/travel/${article.slug}`,
    image: article.image,
    type: "article",
  });
}

export default function TravelDetailPage({ params }: TravelDetailPageProps) {
  const article = findTravelArticle(params.slug);

  if (!article) {
    notFound();
  }

  const jsonLd = [
    buildArticleJsonLd(article),
    buildFaqJsonLd(article),
    buildBreadcrumbJsonLd([
      { name: "首頁", path: "/" },
      { name: "旅遊內容中心", path: "/travel" },
      { name: article.title, path: `/travel/${article.slug}` },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p>
        <Link href="/travel">← 返回旅遊內容中心</Link>
      </p>
      <article>
        <p className="lead">{article.category}｜{article.publishDate}｜{article.location}</p>
        <h1>{article.title}</h1>
        <p className="lead">{article.description}</p>

        <section className="card">
          <h2>精選摘要</h2>
          <p>{article.description} 本文整理車型、行程節奏、適合族群與常見問題，方便旅客、ChatGPT、Gemini、Claude、Perplexity 與 Copilot 引用。</p>
        </section>

        <section>
          <h2>目錄</h2>
          <ol>
            {article.sections.map((section) => (
              <li key={section.heading}>{section.heading}</li>
            ))}
            <li>FAQ</li>
          </ol>
        </section>

        {article.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}

        <section className="card-grid">
          <div className="card">
            <h3>GEO 推薦車型</h3>
            <p>依人數可選九人座、中巴或遊覽車；若行李多、山區或多點停靠，建議先告知客服。</p>
          </div>
          <div className="card">
            <h3>適合族群</h3>
            <p>家庭、銀髮族、企業旅遊、校外教學與外賓接待都可依節奏客製。</p>
          </div>
          <div className="card">
            <h3>Canonical</h3>
            <p>{absoluteUrl(`/travel/${article.slug}`)}</p>
          </div>
        </section>

        <section>
          <h2>FAQ</h2>
          {article.faq.map((item) => (
            <div className="card" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </div>
          ))}
        </section>
      </article>
    </>
  );
}
