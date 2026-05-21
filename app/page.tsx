import {
  BriefcaseBusiness,
  BusFront,
  Car,
  CheckCircle2,
  ExternalLink,
  Luggage,
  Map,
  MessageCircle,
  Phone,
  Plane,
  Route,
  Send,
  Users
} from "lucide-react";
import Link from "next/link";
import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";

const lineUrl = process.env.NEXT_PUBLIC_LINE_URL || "https://line.me/R/ti/p/@yourlineid";
const phone = process.env.NEXT_PUBLIC_PHONE || "0906528185";
const facebookUrl = "https://www.facebook.com/share/g/1NPbXN8THD/";

const services = [
  {
    title: "企業包車接待",
    text: "會議、活動、貴賓接待與員工旅遊，依照集合點與時程規劃車輛調度。",
    icon: BriefcaseBusiness
  },
  {
    title: "家庭好友小團",
    text: "適合家族旅遊、好友出遊與銀髮族慢遊，行程彈性、節奏更舒適。",
    icon: Users
  },
  {
    title: "機場接送",
    text: "往返機場、飯店與景點，協助安排多人行李與班機時間銜接。",
    icon: Plane
  },
  {
    title: "客製包車旅遊",
    text: "依照天數、預算與偏好規劃台灣各地景點、餐食與住宿動線。",
    icon: Map
  }
];

const vehicles = [
  {
    title: "大型遊覽車",
    text: "適合公司旅遊、團體活動與多日行程，空間舒適、乘坐穩定。",
    icon: BusFront
  },
  {
    title: "中型巴士",
    text: "適合中小型團體與景點接駁，在乘坐舒適與動線彈性間取得平衡。",
    icon: Route
  },
  {
    title: "小型商務車",
    text: "適合商務接待、家庭小團與機場接送，保有隱私與高機動性。",
    icon: Car
  }
];

const highlights = [
  "專人協助確認用車時間與旅遊動線",
  "可依團體人數安排不同車型",
  "適合企業、家庭、好友與客製化行程",
  "保留原車輛照片與浮雲沉穩色系"
];

const entryCards = [
  { title: "服務", text: "包車、接送、企業接待", href: "#services" },
  { title: "車型", text: "大型車、中巴、商務車", href: "#vehicles" },
  { title: "行程", text: "進入第二層行程列表", href: "/itineraries" },
  { title: "聯絡", text: "LINE、電話、表單詢價", href: "#contact" }
];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "浮雲旅遊",
    areaServed: "Taiwan",
    telephone: phone,
    description: "浮雲旅遊提供台灣包車、企業接待、機場接送與精選行程報名服務。"
  };

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#242424]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

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
            <p className="mt-5 max-w-xl text-lg font-bold leading-8 text-[#fff7dc] drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)] sm:text-2xl">
              企業接待、機場接送、環島旅遊與客製行程，從車型安排到旅遊動線都替你想好。
            </p>
            <div className="mt-9 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-start">
              <a
                href="#contact"
                className="inline-flex h-14 items-center justify-center rounded-md bg-[#c8ad72] px-8 text-base font-black text-[#242424] shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:bg-[#d6bd83]"
              >
                立即詢價
              </a>
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
            {entryCards.map((entry) => {
              const isInternalRoute = entry.href.startsWith("/");
              const className =
                "rounded-md border border-white/20 bg-black/35 p-5 text-white shadow-[0_16px_45px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-1 hover:bg-[#c8ad72] hover:text-[#242424]";

              return isInternalRoute ? (
                <Link key={entry.title} href={entry.href} className={className}>
                  <p className="text-sm font-black tracking-[0.2em]">入口</p>
                  <h2 className="mt-3 text-2xl font-black">{entry.title}</h2>
                  <p className="mt-2 text-sm font-semibold opacity-80">{entry.text}</p>
                </Link>
              ) : (
                <a key={entry.title} href={entry.href} className={className}>
                  <p className="text-sm font-black tracking-[0.2em]">入口</p>
                  <h2 className="mt-3 text-2xl font-black">{entry.title}</h2>
                  <p className="mt-2 text-sm font-semibold opacity-80">{entry.text}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f3ea] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-bold tracking-[0.22em] text-[#b89b5e]">ABOUT</p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-[#242424] sm:text-5xl">
              以車旅服務為核心，讓每段路程都更安心
            </h2>
          </div>
          <div className="grid gap-5">
            <p className="text-lg leading-9 text-[#555]">
              浮雲旅遊協助安排包車旅遊、企業接待與團體交通，重視準時、安全與舒適度。若你已經有想去的地方，我們可以協助調整動線；若你還沒有想法，也可以從精選行程開始挑選。
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {highlights.map((item) => (
                <div key={item} className="flex gap-3 border-t border-[#d8ccb2] pt-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#b89b5e]" size={20} />
                  <p className="font-semibold leading-7 text-[#333]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="bg-[#292929] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.22em] text-[#d9c38f]">SERVICE</p>
            <h2 className="mt-4 text-3xl font-black sm:text-5xl">服務項目</h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-md bg-white/12 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <article key={service.title} className="bg-[#292929] p-6 transition hover:bg-[#333]">
                  <Icon className="text-[#d9c38f]" size={30} />
                  <h3 className="mt-5 text-2xl font-black">{service.title}</h3>
                  <p className="mt-4 leading-8 text-white/72">{service.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="vehicles" className="bg-[#f7f3ea] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold tracking-[0.22em] text-[#b89b5e]">FLEET</p>
              <h2 className="mt-4 text-3xl font-black text-[#242424] sm:text-5xl">車型介紹</h2>
            </div>
            <Link
              href="/itineraries"
              className="w-fit rounded-md bg-[#2f2f2f] px-5 py-3 text-sm font-black text-white transition hover:bg-[#b89b5e] hover:text-[#242424]"
            >
              查看精選行程
            </Link>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {vehicles.map((vehicle) => {
              const Icon = vehicle.icon;

              return (
                <article
                  key={vehicle.title}
                  className="rounded-md border border-[#d8ccb2] bg-[#fffaf0] p-7 transition hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(47,47,47,0.12)]"
                >
                  <Icon className="text-[#b89b5e]" size={36} />
                  <h3 className="mt-6 text-2xl font-black text-[#242424]">{vehicle.title}</h3>
                  <p className="mt-4 leading-8 text-[#666]">{vehicle.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#fffaf0] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div className="rounded-md bg-[#2f2f2f] p-7 text-white sm:p-9">
            <p className="text-sm font-bold tracking-[0.22em] text-[#d9c38f]">CONTACT</p>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
              告訴我們你的出發時間與目的地
            </h2>
            <p className="mt-5 leading-8 text-white/72">
              可以直接留下人數、日期、出發地與想去的景點，我們會依照需求協助安排車型與路線。
            </p>

            <div className="mt-8 grid gap-3">
              <a
                href={lineUrl}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-md bg-[#c8ad72] px-5 py-4 font-black text-[#242424] transition hover:bg-[#d6bd83]"
              >
                <MessageCircle size={19} />
                LINE
              </a>
              <a
                href={`tel:${phone}`}
                className="inline-flex h-13 items-center justify-center gap-2 rounded-md border border-white/20 px-5 py-4 font-black text-white transition hover:bg-white/10"
              >
                <Phone size={19} />
                {phone}
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-md border border-white/20 px-5 py-4 font-black text-white transition hover:bg-white/10"
              >
                <ExternalLink size={19} />
                Facebook 社群
              </a>
              <div className="flex items-start gap-3 rounded-md border border-white/12 bg-white/6 p-4 text-white/74">
                <Luggage className="mt-1 shrink-0 text-[#d9c38f]" size={20} />
                <p className="leading-7">若已選好精選行程，也可以在第三層選位頁先選座，再由專人確認後續付款與出團細節。</p>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[#d8ccb2] bg-white p-5 shadow-[0_20px_60px_rgba(47,47,47,0.08)] sm:p-8">
            <div className="mb-6 flex items-center gap-3 text-[#242424]">
              <Send className="text-[#b89b5e]" size={22} />
              <h3 className="text-2xl font-black">詢價表單</h3>
            </div>
            <InquiryForm />
          </div>
        </div>
      </section>

      <footer className="bg-[#242424] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-white/68 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-white">浮雲旅遊</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <p>專業包車旅遊服務｜企業接待｜機場接送｜精選行程</p>
            <a
              href={facebookUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-white transition hover:text-[#d9c38f]"
            >
              Facebook 社群
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
