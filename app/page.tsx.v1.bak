import type { Metadata } from "next";
import Link from "next/link";
import { SITE, organizationJsonLd } from "@/lib/site";
import HomeHeroV2 from "@/components/HomeHero_v2";

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
  { href: "/ai-test", label: "AI旅遊顧問（測試版）" },
];

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />

      <div className="home-page">
        <header className="home-nav" aria-label="浮雲輕鬆遊網站導覽">
          <Link className="home-brand home-brand--xl" href="/">
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
            <a className="home-nav__login" href="/platform/index.html?v=official-member-register-v1#login">
              平台登入
            </a>
          </div>
        </header>

        <HomeHeroV2 />
      </div>
    </>
  );
}
