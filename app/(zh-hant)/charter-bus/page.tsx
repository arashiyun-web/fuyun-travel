import type { Metadata } from "next";
import GeoPage from "@/components/GeoPage";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "charter" as Parameters<typeof geoContent>[0];
const LOCALE = "zh-Hant";
const CANONICAL = "https://fuyuntravel.com/charter-bus";
const TITLE = "包車旅遊｜台灣全境包車、機場接送與現場學習 | 浮雲輕鬆遊";
const DESCRIPTION = "浮雲輕鬆遊台灣全境包車：九人座、中巴、遊覽車，合法車隊15輛、專業駕駛20位，30分鐘內回覆。";
const BRAND = "浮雲輕鬆遊（Fuyun Travel）";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: geoAlternates(SECTION, "zh-Hant"),
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
};

export default function Page() {
  const content = geoContent(SECTION, LOCALE);
  const schema = buildGeoSchema({
    locale: "zh-Hant",
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
