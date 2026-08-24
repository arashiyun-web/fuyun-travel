import type { Metadata } from "next";
import GeoPage from "@/components/GeoPage";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "jiufen" as Parameters<typeof geoContent>[0];
const LOCALE = "zh-Hant";
const CANONICAL = "https://fuyuntravel.com/blog/taipei-jiufen-charter";
const TITLE = "台北到九份包車｜一日來回、價格與時間規劃 | 浮雲輕鬆遊";
const DESCRIPTION = "台北到九份包車一日來回：含停車、導覽、多點順遊，價格透明，30分鐘內回覆報價。";
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
