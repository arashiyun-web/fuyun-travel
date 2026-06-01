import type { Metadata } from "next";
import Link from "next/link";
import { SITE, COMPANY } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE.defaultTitle },
  description: SITE.defaultDescription,
  alternates: { canonical: SITE.url },
  openGraph: {
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    url: SITE.url,
    siteName: SITE.name,
    locale: "zh_TW",
    type: "website",
    images: [SITE.ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    images: [SITE.ogImage],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: COMPANY.companyName,
  alternateName: COMPANY.siteName,
  url: SITE.url,
  telephone: COMPANY.phone,
  email: COMPANY.email,
  faxNumber: COMPANY.fax,
  address: {
    "@type": "PostalAddress",
    streetAddress: COMPANY.address,
    addressCountry: "TW",
  },
  areaServed: "Taiwan",
  serviceType: ["台灣包車旅遊", "企業接待", "機場接送", "客製化行程規劃"],
};

const navItems = [
  { href: "/services", label: "服務" },
  { href: "/fleet", label: "車型" },
  { href: "/itineraries", label: "行程" },
  { href: "/contact", label: "聯絡" },
];

const featureItems = [
  { href: "/services", title: "服務", text: "包車、接送、企業接待" },
  { href: "/fleet", title: "車型", text: "大型車、中巴、商務車" },
  { href: "/itineraries", title: "行程", text: "精選旅遊、報名選位" },
  { href: "/contact", title: "聯絡", text: "LINE、電話、表單詢價" },
];

const facebookUrl = "https://www.facebook.com/share/g/1NPbXN8THD/";

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="home-page">
        <header className="home-nav" aria-label="浮雲旅遊首頁導覽">
          <Link className="home-brand" href="/">
            <strong>浮雲旅遊</strong>
            <span>專業包車旅遊服務</span>
          </Link>

          <nav className="home-nav__links" aria-label="主要選單">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="home-nav__actions">
            <Link className="home-nav__quote" href="/contact/inquiry">
              立即詢價
            </Link>
            <a className="home-nav__login" href="/platform/index.html?v=official-member-register-v1#login">
              登入/註冊
            </a>
          </div>
        </header>

        <section className="home-hero" aria-label="專業包車旅遊服務">
          <div className="home-hero__content">
            <p className="home-eyebrow">浮雲旅遊｜專業包車旅遊服務</p>
            <h1>專業包車旅遊服務</h1>
            <div className="home-hero__actions">
              <Link className="home-btn home-btn--gold" href="/contact/inquiry">
                立即詢價
              </Link>
              <Link className="home-btn home-btn--glass" href="/itineraries">
                查看行程
              </Link>
              <a
                className="home-btn home-btn--glass"
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
              >
                Facebook ↗
              </a>
            </div>
          </div>

          <div className="home-feature-grid" aria-label="浮雲旅遊服務入口">
            {featureItems.map((item) => (
              <Link className="home-feature-card" key={item.href} href={item.href}>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
