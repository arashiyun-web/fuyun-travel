import Link from "next/link";
import { notFound } from "next/navigation";
import { findMoneyPage, moneyPages } from "@/lib/growthPages";
import { pageMeta } from "@/lib/site";
import { generateFaq } from "@/lib/seo/generateFaq";
import { faqSchema, serviceSchema } from "@/lib/seo/generateSchema";

type Props = {
  params: { slug: string };
};

export function generateStaticParams() {
  return moneyPages.map((page) => ({ slug: page.slug }));
}

export function generateMetadata({ params }: Props) {
  const page = findMoneyPage(params.slug);
  if (!page) return pageMeta({ title: "包車服務", path: "/service" });
  return pageMeta({
    title: page.title,
    description: page.description,
    path: `/service/${page.slug}`,
  });
}

export default function MoneyServicePage({ params }: Props) {
  const page = findMoneyPage(params.slug);
  if (!page) notFound();

  const faq = generateFaq(page.title, "包車服務");
  const jsonLd = [
    serviceSchema({ name: page.title, description: page.description, path: `/service/${page.slug}` }),
    faqSchema(faq),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1>{page.title}</h1>
      <p className="lead">{page.description}</p>

      <section className="card-grid">
        <div className="card">
          <h3>服務重點</h3>
          <p>{page.keyword} 會依日期、路線、人數、車型、停靠點與服務時間提供正式報價。</p>
        </div>
        <div className="card">
          <h3>LINE CTA</h3>
          <p>LINE OA 未設定時不產生假連結；正式設定後可直接導入客服流程。</p>
        </div>
        <div className="card">
          <h3>立即報價 CTA</h3>
          <p>填寫需求後，客服可依資料建立詢價與後續 LINE CRM 追蹤。</p>
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
