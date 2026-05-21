import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { findContentItem, serviceItems } from "@/lib/siteContent";

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
  return { title: service ? service.title : "服務內容" };
}

export default function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const service = findContentItem(serviceItems, params.slug);

  if (!service) {
    notFound();
  }

  const Icon = service.icon;

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      <SiteHeader active="services" />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/services" className="text-sm font-bold text-[#b89b5e] hover:text-[#242424]">
          返回服務分類
        </Link>
        <article className="mt-6 rounded-md border border-[#d8ccb2] bg-white p-8 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
          <Icon className="text-[#b89b5e]" size={42} />
          <p className="mt-6 text-sm font-bold tracking-[0.25em] text-[#b89b5e]">第三層｜服務內容</p>
          <h1 className="mt-4 text-4xl font-black">{service.title}</h1>
          <p className="mt-5 text-lg font-bold leading-9 text-[#555]">{service.summary}</p>
          <div className="mt-8 rounded-md bg-[#fffaf0] p-6 ring-1 ring-[#d8ccb2]">
            <p className="leading-9 text-[#4b463d]">{service.detail}</p>
          </div>
          <Link
            href="/contact/inquiry"
            className="mt-8 inline-flex rounded-md bg-[#2f2f2f] px-5 py-3 font-black text-white transition hover:bg-[#b89b5e] hover:text-[#242424]"
          >
            針對此服務詢價
          </Link>
        </article>
      </section>
    </main>
  );
}
