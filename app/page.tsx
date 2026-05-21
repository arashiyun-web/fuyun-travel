import { ExternalLink } from "lucide-react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const facebookUrl = "https://www.facebook.com/share/g/1NPbXN8THD/";

const entryCards = [
  { title: "服務", text: "包車、接送、企業接待", href: "/services" },
  { title: "車型", text: "大型車、中巴、商務車", href: "/fleet" },
  { title: "行程", text: "精選旅遊、報名選位", href: "/itineraries" },
  { title: "聯絡", text: "LINE、電話、表單詢價", href: "/contact" }
];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "浮雲旅遊",
    areaServed: "Taiwan",
    telephone: "0906528185",
    description: "浮雲旅遊提供台灣包車、企業接待、機場接送與精選行程報名服務。"
  };

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#242424]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader active="home" />

      <section
        id="top"
        className="relative flex min-h-screen items-start justify-start overflow-hidden px-4 pb-12 pt-24 text-left text-white sm:px-8 lg:px-14"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-bus-sunny.png')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#1f1f1f]/36" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1f1f1f]/72 via-[#1f1f1f]/18 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1f1f1f]/90 to-transparent" />

        <div className="relative flex min-h-[calc(100vh-6rem)] w-full flex-col justify-between">
          <div className="mt-10 flex max-w-2xl flex-col items-start sm:mt-14 lg:mt-16">
            <p className="text-sm font-black tracking-[0.32em] text-[#ffe4a3] drop-shadow-[0_3px_12px_rgba(0,0,0,0.75)] sm:text-base">
              浮雲旅遊｜專業包車旅遊服務
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight text-[#ffe600] drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)] sm:text-6xl lg:text-7xl">
              專業包車旅遊服務
            </h1>
            <div className="mt-9 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-start">
              <Link
                href="/contact/inquiry"
                className="inline-flex h-14 items-center justify-center rounded-md bg-[#c8ad72] px-8 text-base font-black text-[#242424] shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:bg-[#d6bd83]"
              >
                立即詢價
              </Link>
              <Link
                href="/itineraries"
                className="inline-flex h-14 items-center justify-center rounded-md border border-white/35 bg-white/12 px-8 text-base font-black text-white backdrop-blur transition hover:bg-white/22"
              >
                查看行程
              </Link>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-md border border-white/35 bg-white/12 px-8 text-base font-black text-white backdrop-blur transition hover:bg-white/22"
              >
                Facebook
                <ExternalLink size={18} />
              </a>
            </div>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {entryCards.map((entry) => (
              <Link
                key={entry.title}
                href={entry.href}
                className="rounded-md border border-white/20 bg-black/35 p-5 text-white shadow-[0_16px_45px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-1 hover:bg-[#c8ad72] hover:text-[#242424]"
              >
                <h2 className="text-2xl font-black">{entry.title}</h2>
                <p className="mt-2 text-sm font-semibold opacity-80">{entry.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
