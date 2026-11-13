import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import LineButton from "@/components/LineButton";
import { findContentItem, serviceItems } from "@/lib/siteContent";
import { pageMeta } from "@/lib/site";
import {
  SERVICE_PAGES_UPDATED,
  dayPriceText,
  findServiceAnswer,
  serviceAnswerJsonLd,
  vehiclePrice,
} from "@/lib/servicePricing";

type ServiceDetailPageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return serviceItems.map((item) => ({ slug: item.slug }));
}

export function generateMetadata({ params }: ServiceDetailPageProps) {
  const service = findContentItem(serviceItems, params.slug);
  if (!service) return pageMeta({ title: "服務項目", path: "/services" });
  const answer = findServiceAnswer(service.slug);
  return pageMeta({
    title: service.title,
    description: answer?.answer || service.summary,
    path: `/services/${service.slug}`,
  });
}

export default function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const service = findContentItem(serviceItems, params.slug);

  if (!service) {
    notFound();
  }

  const Icon = service.icon;
  const answer = findServiceAnswer(service.slug);
  const path = `/services/${service.slug}`;
  const jsonLd = answer
    ? serviceAnswerJsonLd({ name: service.title, description: answer.answer, path, vehicles: answer.vehicles, faq: answer.faq })
    : null;

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <SiteHeader active="services" />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/services" className="text-sm font-bold text-[#b89b5e] hover:text-[#242424]">
          返回服務項目
        </Link>
        <article className="mt-6 rounded-md border border-[#d8ccb2] bg-white p-8 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
          <Icon className="text-[#b89b5e]" size={42} />
          <p className="mt-6 text-sm font-bold tracking-[0.25em] text-[#b89b5e]">SERVICE</p>
          <h1 className="mt-4 text-4xl font-black">{service.title}</h1>
          {answer ? (
            <>
              <p className="mt-5 text-lg font-bold leading-9 text-[#242424]">{answer.answer}</p>
              <p className="mt-2 text-sm text-[#555]">
                最後更新：<time dateTime={SERVICE_PAGES_UPDATED}>{SERVICE_PAGES_UPDATED}</time>
              </p>
              <div className="mt-6 rounded-md bg-[#fffaf0] p-6 ring-1 ring-[#d8ccb2]">
                <h2 className="text-xl font-black">價格參考</h2>
                <ul className="mt-3 space-y-2 leading-8 text-[#4b463d]">
                  {answer.vehicles.map(vehiclePrice).map((row) => (
                    <li key={row.id}>
                      <Link href={row.fleetPath} className="font-bold text-[#242424] hover:text-[#b89b5e]">
                        {row.vehicle}
                      </Link>
                      ：台北一日遊 {dayPriceText(row)}；{row.overtime}。
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-[#555]">
                  完整車型、超時與加價規定請見 <Link href="/services/price" className="font-bold text-[#b89b5e] hover:text-[#242424]">包車價目表</Link>。
                </p>
              </div>
            </>
          ) : null}
          <p className="mt-5 text-lg font-bold leading-9 text-[#555]">{service.summary}</p>
          <div className="mt-8 rounded-md bg-[#fffaf0] p-6 ring-1 ring-[#d8ccb2]">
            <p className="leading-9 text-[#4b463d]">{service.detail}</p>
          </div>
          {answer ? (
            <section className="mt-8">
              <h2 className="text-2xl font-black">常見問題</h2>
              <dl className="mt-4 space-y-4">
                {answer.faq.map((item) => (
                  <div key={item.question} className="rounded-md bg-[#fffaf0] p-5 ring-1 ring-[#d8ccb2]">
                    <dt className="font-bold">問：{item.question}</dt>
                    <dd className="mt-1 leading-8 text-[#4b463d]">答：{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/contact/inquiry"
              className="inline-flex rounded-md bg-[#2f2f2f] px-5 py-3 font-black text-white transition hover:bg-[#b89b5e] hover:text-[#242424]"
            >
              取得報價
            </Link>
            <LineButton source="pricing">LINE 詢價</LineButton>
          </div>
        </article>
      </section>
    </main>
  );
}
