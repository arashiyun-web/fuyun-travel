import type { Metadata } from "next";
import GeoHomeContent from "@/components/GeoHomeContent";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "home" as Parameters<typeof geoContent>[0];
const LOCALE = "zh" as string;
const CANONICAL = "https://fuyuntravel.com/zh";
const TITLE = "浮雲輕鬆遊｜繁體中文";
const DESCRIPTION = "浮雲輕鬆遊繁體中文入口。台灣包車旅遊、機場接送、校外教學與企業旅遊。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: geoAlternates(SECTION, "zh-Hant"),
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
};

// 沿用 zh-Hant 預設文案（與繁中首頁一致）
export default function HomeZhPage() {
  const content = geoContent(SECTION, "zh-Hant");
  const schema = buildGeoSchema({
    locale: "zh-Hant" as Parameters<typeof buildGeoSchema>[0]["locale"],
    service: { name: content.h1, description: content.lead, url: CANONICAL },
    faq: content.faq.map((f) => ({ q: f.q, a: f.a })),
  });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <GeoHomeContent content={content} />
    </>
  );
}
