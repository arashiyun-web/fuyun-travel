import type { Metadata } from "next";
import GeoPage from "@/components/GeoPage";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "charter" as Parameters<typeof geoContent>[0];
const LOCALE = "ko" as string;
const CANONICAL = "https://fuyuntravel.com/ko/charter-bus";
const TITLE = "차터버스 | 浮雲輕鬆遊";
const DESCRIPTION = "浮雲輕鬆遊 대만 차터버스·공항 송영·현장학습, 30분 이내 답변.";
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
