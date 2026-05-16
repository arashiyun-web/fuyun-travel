import {
  BriefcaseBusiness,
  BusFront,
  Car,
  CheckCircle2,
  Earth,
  Luggage,
  Map,
  MessageCircle,
  Phone,
  Plane,
  Route,
  Send,
  Users
} from "lucide-react";
import InquiryForm from "@/components/InquiryForm";

const lineUrl = process.env.NEXT_PUBLIC_LINE_URL || "https://line.me/R/ti/p/@yourlineid";
const phone = process.env.NEXT_PUBLIC_PHONE || "0906528185";

const services = [
  {
    title: "企業包車",
    text: "企業活動、員工旅遊、重要賓客接待，提供穩定車隊與專業調度。",
    icon: BriefcaseBusiness
  },
  {
    title: "商務接送",
    text: "主管行程、商務會議、飯店與展場接駁，重視準時與接待品質。",
    icon: Users
  },
  {
    title: "機場接送",
    text: "桃園、松山及各地機場接送，依行李、人數與班機時間安排車型。",
    icon: Plane
  },
  {
    title: "台灣環島",
    text: "多日旅遊、家庭旅程、深度台灣路線，可依節奏客製行程。",
    icon: Earth
  },
  {
    title: "陸客自由行",
    text: "商務考察、私人旅遊、景點接送，安排舒適且彈性的移動服務。",
    icon: Map
  }
];

const vehicles = [
  {
    title: "大型遊覽車",
    text: "適合企業旅遊、大型團體、環島多日行程與活動接駁。",
    icon: BusFront
  },
  {
    title: "中巴",
    text: "適合中小型團體、長輩旅遊、社團活動與精緻一日遊。",
    icon: Route
  },
  {
    title: "九人座",
    text: "適合家庭旅遊、商務接待、小團包車與機場接送。",
    icon: Car
  }
];

const highlights = [
  "合法旅行社與通運車隊整合",
  "企業接待與客製行程規劃",
  "車型依人數、行李與路線安排",
  "適合商務、小團、家庭與多日旅遊"
];

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "雲驛旅行社｜浮雲輕旅",
    areaServed: "Taiwan",
    telephone: phone,
    description: "台灣專業包車旅遊服務，提供企業接待、機場接送、環島旅遊與客製行程。"
  };

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#242424]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-[#f7f3ea]/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="text-sm font-black tracking-wide text-[#2b2b2b]">
            雲驛旅行社
            <span className="block text-xs font-medium tracking-[0.22em] text-[#b89b5e]">
              浮雲輕旅
            </span>
          </a>
          <div className="hidden items-center gap-8 text-sm font-semibold text-[#3d3d3d] md:flex">
            <a href="#services" className="transition hover:text-[#b89b5e]">服務</a>
            <a href="#vehicles" className="transition hover:text-[#b89b5e]">車型</a>
            <a href="#contact" className="transition hover:text-[#b89b5e]">聯絡</a>
          </div>
          <a
            href="#contact"
            className="rounded-md bg-[#2f2f2f] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#b89b5e]"
          >
            立即詢價
          </a>
        </nav>
      </header>

      <section
        id="top"
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-16 text-center text-white"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=2400&q=88')"
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[#1f1f1f]/48" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1f1f1f]/90 to-transparent" />

        <div className="relative mx-auto flex max-w-5xl flex-col items-center">
          <p className="text-sm font-semibold tracking-[0.32em] text-[#d9c38f] sm:text-base">
            雲驛旅行社｜浮雲輕旅
          </p>
          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl lg:text-7xl">
            專業包車旅遊服務
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-white/88 sm:text-2xl">
            企業接待｜機場接送｜環島旅遊｜客製行程
          </p>
          <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="#contact"
              className="inline-flex h-14 items-center justify-center rounded-md bg-[#c8ad72] px-8 text-base font-black text-[#242424] shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition hover:bg-[#d6bd83]"
            >
              立即詢價
            </a>
            <a
              href={lineUrl}
              className="inline-flex h-14 items-center justify-center rounded-md border border-white/35 bg-white/12 px-8 text-base font-black text-white backdrop-blur transition hover:bg-white/22"
            >
              加入 LINE
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f3ea] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-bold tracking-[0.22em] text-[#b89b5e]">
              ABOUT
            </p>
            <h2 className="mt-4 text-3xl font-black leading-tight text-[#242424] sm:text-5xl">
              旅行社規劃，車隊執行。
            </h2>
          </div>
          <div className="grid gap-5">
            <p className="text-lg leading-9 text-[#555]">
              雲驛旅行社｜浮雲輕旅提供高品質台灣包車旅遊服務，整合企業接待、機場接送、環島旅遊與客製行程，讓每一趟移動都穩定、舒適、體面。
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
            <p className="text-sm font-bold tracking-[0.22em] text-[#d9c38f]">
              SERVICE
            </p>
            <h2 className="mt-4 text-3xl font-black sm:text-5xl">服務項目</h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-md bg-white/12 md:grid-cols-2 lg:grid-cols-5">
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
              <p className="text-sm font-bold tracking-[0.22em] text-[#b89b5e]">
                FLEET
              </p>
              <h2 className="mt-4 text-3xl font-black text-[#242424] sm:text-5xl">
                車型介紹
              </h2>
            </div>
            <p className="max-w-xl leading-8 text-[#666]">
              依人數、行李、路線長度與接待規格安排車型。
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {vehicles.map((vehicle) => {
              const Icon = vehicle.icon;
              return (
                <article key={vehicle.title} className="rounded-md border border-[#d8ccb2] bg-[#fffaf0] p-7 transition hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(47,47,47,0.12)]">
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
            <p className="text-sm font-bold tracking-[0.22em] text-[#d9c38f]">
              CONTACT
            </p>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
              告訴我們您的行程需求。
            </h2>
            <p className="mt-5 leading-8 text-white/72">
              可先提供日期、人數、出發地、目的地與用車時間。若還沒有完整行程，也可由我們協助規劃。
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
              <div className="flex items-start gap-3 rounded-md border border-white/12 bg-white/6 p-4 text-white/74">
                <Luggage className="mt-1 shrink-0 text-[#d9c38f]" size={20} />
                <p className="leading-7">企業接待、機場接送、環島旅遊、客製行程皆可詢問。</p>
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
          <p className="font-semibold text-white">雲驛旅行社｜浮雲輕旅</p>
          <p>企業接待｜機場接送｜環島旅遊｜客製行程</p>
        </div>
      </footer>
    </main>
  );
}
