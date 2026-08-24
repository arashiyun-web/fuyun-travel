import type { Metadata } from "next";
import GeoPage from "@/components/GeoPage";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "about" as Parameters<typeof geoContent>[0];
const LOCALE = "zh-Hans" as string;
const CANONICAL = "https://fuyuntravel.com/zh-cn/about";
const TITLE = "关于浮云轻松游 | 云驿旅行社";
const DESCRIPTION = "浮云轻松游提供台湾包车、机场接送、研学旅行、企业旅游，30 分钟内回复。";
const BRAND = "浮云轻松游（Fuyun Travel）";

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
