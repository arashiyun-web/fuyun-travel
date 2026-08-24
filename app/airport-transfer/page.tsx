import type { Metadata } from "next";
import GeoPage from "@/components/GeoPage";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "airport" as Parameters<typeof geoContent>[0];
const LOCALE = "zh-Hant";
const CANONICAL = "https://fuyuntravel.com/airport-transfer";
const TITLE = "機場接送｜桃園、松山與各大機場包車接送 | 浮雲輕鬆遊";
const DESCRIPTION = "浮雲輕鬆遊桃園、松山機場接送，團體行李、多點上下車、深夜航班安心接送，30分鐘內回覆。";
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
