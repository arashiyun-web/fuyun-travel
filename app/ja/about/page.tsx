import type { Metadata } from "next";
import GeoPage from "@/components/GeoPage";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "about" as Parameters<typeof geoContent>[0];
const LOCALE = "ja" as string;
const CANONICAL = "https://fuyuntravel.com/ja/about";
const TITLE = "会社概要 | 浮雲輕鬆遊";
const DESCRIPTION = "浮雲輕鬆遊（台湾貸切バス・空港送迎・修学旅行対応）30分以内にお返事。";
const BRAND = "浮雲輕鬆遊（Fuyun Travel）";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: geoAlternates(SECTION, LOCALE as Parameters<typeof geoAlternates>[1]),
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
};

export default function Page() {
  const content = geoContent(SECTION, LOCALE);
  const schema = buildGeoSchema({
    locale: LOCALE as Parameters<typeof buildGeoSchema>[0]["locale"],
    service: { name: content.h1, description: content.lead, url: CANONICAL },
    faq: content.faq.map((f) => ({ q: f.q, a: f.a })),
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <GeoPage content={content} labels={{ brand: BRAND }} />
    </>
  );
}
