import type { Metadata } from "next";
import GeoHomeContent from "@/components/GeoHomeContent";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "home" as Parameters<typeof geoContent>[0];
const LOCALE = "zh-cn" as string;
const CANONICAL = "https://fuyuntravel.com/zh-cn";
const TITLE = "台湾包车、机场接送、游览车 | 浮云轻松游";
const DESCRIPTION = "浮云轻松游 — 台湾包车、机场接送、校外教学、企业旅游，30分钟内回复。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: geoAlternates(SECTION, LOCALE as Parameters<typeof geoAlternates>[1]),
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
};

const LABELS = {
  brand: "浮云轻松游｜浮雲輕鬆遊",
  quote: "立即询价",
  phone: "电话直达",
  trust: "资质与保障",
  updated: "2026年最新",
  faqTitle: "常见问题",
  trustBadges: ["30分钟内回复", "合法旅行社与游览车公司", "企业、学校、家族旅游均可安排"],
  features: [
    { title: "游览车包车", text: "校外教学、企业旅游、大型团体" },
    { title: "机场接送", text: "航班接送、多点上下车、行李安排" },
    { title: "旅游攻略", text: "最新攻略、热门行程与包车建议" },
    { title: "快速报价", text: "日期、人数、路线快速评估" },
    { title: "这里真好玩", text: "真实走过的行程分享与照片，点进来看更多" },
  ],
};

export default function HomeZhcnPage() {
  const content = geoContent(SECTION, LOCALE);
  const schema = buildGeoSchema({
    locale: LOCALE as Parameters<typeof buildGeoSchema>[0]["locale"],
    service: { name: content.h1, description: content.lead, url: CANONICAL },
    faq: content.faq.map((f) => ({ q: f.q, a: f.a })),
  });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <GeoHomeContent content={content} labels={LABELS} />
    </>
  );
}
