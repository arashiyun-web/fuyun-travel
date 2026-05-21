import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { contactItems } from "@/lib/siteContent";

export const metadata = {
  title: "聯絡方式"
};

export default function ContactPage() {
  const lineUrl = process.env.NEXT_PUBLIC_LINE_URL || "https://line.me/R/ti/p/@yourlineid";
  const phone = process.env.NEXT_PUBLIC_PHONE || "0906528185";

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      <SiteHeader active="contact" />
      <section className="relative overflow-hidden bg-[#2f2f2f]">
        <img src="/hero-bus-sunny.png" alt="浮雲旅遊車輛" className="h-[360px] w-full object-cover opacity-75" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />
        <div className="absolute left-1/2 top-16 w-full max-w-7xl -translate-x-1/2 px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold tracking-[0.25em] text-[#ffe600]">第二層｜聯絡方式</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">
            選擇聯絡方式後，進入第三層填寫需求
          </h1>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        {contactItems.map((item) => {
          const Icon = item.icon;
          const href =
            item.slug === "line" ? lineUrl : item.slug === "phone" ? `tel:${phone}` : "/contact/inquiry";
          const isExternal = item.slug === "line";

          return (
            <Link
              key={item.slug}
              href={href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noreferrer" : undefined}
              className="rounded-md border border-[#d8ccb2] bg-white p-7 shadow-[0_18px_45px_rgba(48,39,24,0.12)] transition hover:-translate-y-1"
            >
              <Icon className="text-[#b89b5e]" size={34} />
              <h2 className="mt-6 text-2xl font-black">{item.title}</h2>
              <p className="mt-4 leading-8 text-[#666]">{item.summary}</p>
              <p className="mt-5 text-sm font-black text-[#b89b5e]">
                {item.slug === "inquiry" ? "進入第三層表單" : "立即聯絡"}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
