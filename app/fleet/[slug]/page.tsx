import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { findContentItem, fleetItems } from "@/lib/siteContent";
import { SITE, pageMeta } from "@/lib/site";

type FleetDetailPageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return fleetItems.map((item) => ({ slug: item.slug }));
}

export function generateMetadata({ params }: FleetDetailPageProps) {
  const vehicle = findContentItem(fleetItems, params.slug);
  if (!vehicle) return pageMeta({ title: "車隊介紹", path: "/fleet" });
  return pageMeta({
    title: vehicle.title,
    description: vehicle.summary,
    path: `/fleet/${vehicle.slug}`,
  });
}

export default function FleetDetailPage({ params }: FleetDetailPageProps) {
  const vehicle = findContentItem(fleetItems, params.slug);

  if (!vehicle) {
    notFound();
  }

  const Icon = vehicle.icon;

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      <SiteHeader active="fleet" />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/fleet" className="text-sm font-bold text-[#b89b5e] hover:text-[#242424]">
          返回車隊介紹
        </Link>
        <article className="mt-6 overflow-hidden rounded-md border border-[#d8ccb2] bg-white shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
          <img src="/hero-bus-sunny.png" alt={`${SITE.name} ${vehicle.title}`} className="h-72 w-full object-cover" />
          <div className="p-8">
            <Icon className="text-[#b89b5e]" size={42} />
            <p className="mt-6 text-sm font-bold tracking-[0.25em] text-[#b89b5e]">FLEET</p>
            <h1 className="mt-4 text-4xl font-black">{vehicle.title}</h1>
            <p className="mt-5 text-lg font-bold leading-9 text-[#555]">{vehicle.summary}</p>
            <div className="mt-8 rounded-md bg-[#fffaf0] p-6 ring-1 ring-[#d8ccb2]">
              <p className="leading-9 text-[#4b463d]">{vehicle.detail}</p>
            </div>
            <Link
              href="/contact/inquiry"
              className="mt-8 inline-flex rounded-md bg-[#2f2f2f] px-5 py-3 font-black text-white transition hover:bg-[#b89b5e] hover:text-[#242424]"
            >
              詢問適合車型
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
