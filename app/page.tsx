import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, SITE, organizationJsonLd } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE.defaultTitle },
  description: SITE.defaultDescription,
  alternates: { canonical: SITE.url },
  openGraph: {
    title: SITE.defaultTitle,
    description: SITE.defaultDescription,
    url: SITE.url,
    siteName: SITE.name,
    locale: SITE.locale,
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

const navItems = [
  { href: "/about", label: "關於" },
  { href: "/fleet", label: "車隊" },
  { href: "/travel", label: "旅遊" },
  { href: "/contact", label: "聯絡" },
];

const featureItems = [
  { href: "/services/coach-charter", title: "遊覽車包車", text: "校外教學、企業旅遊、大型團體" },
  { href: "/services/airport-transfer", title: "機場接送", text: "航班接送、多點上下車、行李安排" },
  { href: "/travel", title: "旅遊攻略", text: "最新旅遊內容、熱門行程與包車建議" },
  { href: "/contact/inquiry", title: "立即報價", text: "日期、人數、路線快速評估" },
];

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />

      <div className="home-page">
        <header className="home-nav" aria-label="浮雲輕鬆遊網站導覽">
          <Link className="home-brand" href="/">
            <strong>{SITE.name}</strong>
            <span>台灣包車旅遊</span>
          </Link>

          <nav className="home-nav__links" aria-label="主要導覽">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="home-nav__actions">
            <Link className="home-nav__quote" href="/contact/inquiry">
              立即報價
            </Link>
            <a className="home-nav__login" href="/platform/index.html?v=official-member-register-v1#login">
              平台登入
            </a>
          </div>
        </header>

        <section className="home-hero" aria-label="台灣包車旅遊服務">
          <div className="home-hero__content">
            <p className="home-eyebrow">{COMPANY.companyName}｜{COMPANY.fleetCompanyName}</p>
            <h1>台灣包車旅遊</h1>
            <div className="home-hero__actions">
              <Link className="home-btn home-btn--gold" href="/contact/inquiry">
                立即報價
              </Link>
              <Link className="home-btn home-btn--glass" href="/travel">
                旅遊攻略
              </Link>
              <a className="home-btn home-btn--glass" href={COMPANY.facebookUrl} target="_blank" rel="noreferrer">
                Facebook
              </a>
            </div>
          </div>

          <div className="home-feature-grid" aria-label="核心服務">
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
