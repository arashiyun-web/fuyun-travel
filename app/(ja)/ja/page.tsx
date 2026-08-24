import type { Metadata } from "next";
import GeoHomeContent from "@/components/GeoHomeContent";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "home" as Parameters<typeof geoContent>[0];
const LOCALE = "ja" as string;
const CANONICAL = "https://fuyuntravel.com/ja";
const TITLE = "台湾 貸切バス・空港送迎・観光バス | 浮雲輕鬆遊";
const DESCRIPTION = "浮雲輕鬆遊 — 台湾の貸切バス・空港送迎・校外学習・企業ツアー。30分以内にご返信。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: geoAlternates(SECTION, LOCALE as Parameters<typeof geoAlternates>[1]),
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
};

const LABELS = {
  brand: "浮雲輕鬆遊（Fuyun Travel）",
  quote: "見積もり依頼",
  phone: "電話で問い合わせ",
  trust: "許可・資格",
  updated: "2026年最新",
  faqTitle: "よくある質問",
  trustBadges: [
    "30分以内にご返信",
    "認定旅行会社とバス会社",
    "ファミリー・学校・企業ツアー対応",
  ],
  features: [
    { title: "貸切バス", text: "校外学習、企業旅行、大規模団体" },
    { title: "空港送迎", text: "送迎、複数拠点、手荷物支援" },
    { title: "旅行ガイド", text: "最新ガイド、人気ルート、貸切アドバイス" },
    { title: "即日見積もり", text: "日付・人数・ルートで簡易見積" },
    { title: "ハイライト", text: "実際に走ったルートの写真とエピソード" },
  ],
};

export default function HomeJaPage() {
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
