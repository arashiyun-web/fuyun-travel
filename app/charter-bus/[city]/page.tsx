import Link from "next/link";
import { notFound } from "next/navigation";
import { findLocationPage, locationPages } from "@/lib/growthPages";
import { pageMeta, organizationJsonLd } from "@/lib/site";
import { generateFaq } from "@/lib/seo/generateFaq";
import { faqSchema, serviceSchema } from "@/lib/seo/generateSchema";

type Props = {
  params: { city: string };
};

export function generateStaticParams() {
  return locationPages.map((page) => ({ city: page.slug }));
}

export function generateMetadata({ params }: Props) {
  const page = findLocationPage(params.city);
  if (!page) return pageMeta({ title: "地區包車服務", path: "/charter-bus" });
  return pageMeta({
    title: page.title,
    description: page.description,
    path: `/charter-bus/${page.slug}`,
  });
}

export default function CharterBusLocationPage({ params }: Props) {
  const page = findLocationPage(params.city);
  if (!page) notFound();

  const faq = generateFaq(page.title, "地區包車");
  const jsonLd = [
    organizationJsonLd(),
    serviceSchema({ name: page.title, description: page.description, path: `/charter-bus/${page.slug}` }),
    faqSchema(faq),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1>{page.title}</h1>
      <p className="lead">{page.description}</p>

      <section className="card-grid">
        <div className="card">
          <h3>{page.keyword}</h3>
          <p>{page.city}出發可安排遊覽車、中巴或九人座，依人數、停靠點、行李與行程時間評估。</p>
        </div>
        <div className="card">
          <h3>LocalBusiness Schema</h3>
          <p>本頁已加入旅行社與地區服務結構化資料，支援 Local SEO。</p>
        </div>
        <div className="card">
          <h3>立即詢價</h3>
          <p>提供日期、人數、上車點與目的地，可快速評估車型與報價。</p>
          <Link href="/contact/inquiry">立即報價</Link>
        </div>
      </section>

      <section>
        <h2>FAQ</h2>
        {faq.map((item) => (
          <div className="card" key={item.question}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </section>
    </>
  );
}
