import type { Metadata } from "next";
import GeoHomeContent from "@/components/GeoHomeContent";
import { geoContent } from "@/lib/geo/content";
import { geoAlternates } from "@/lib/geo/locales";
import { buildGeoSchema } from "@/lib/geo/schema";

const SECTION = "home" as Parameters<typeof geoContent>[0];
const LOCALE = "ko" as string;
const CANONICAL = "https://fuyuntravel.com/ko";
const TITLE = "대만 차터버스·공항 송영 | 浮雲輕鬆遊";
const DESCRIPTION = "浮雲輕鬆遊 — 대만 차터버스·공항 송영·현장학습·기업 투어. 30분 이내 답변.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: geoAlternates(SECTION, LOCALE as Parameters<typeof geoAlternates>[1]),
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
};

const LABELS = {
  brand: "浮雲輕鬆遊 (Fuyun Travel)",
  quote: "견적 신청",
  phone: "전화 문의",
  trust: "자격과 보장",
  updated: "2026년 최신",
  faqTitle: "자주 묻는 질문",
  trustBadges: ["30분 이내 답변", "합법 여행사 및 코치운송회사", "가족·학교·기업 투어 모두 가능"],
  features: [
    { title: "차터버스", text: "현장학습, 기업 여행, 대형 단체" },
    { title: "공항 송영", text: "픽업/드롭오프, 다지점, 수하물 지원" },
    { title: "여행 가이드", text: "최신 가이드, 인기 루트, 차터 상담" },
    { title: "빠른 견적", text: "일정·인원·루트 빠른 견적" },
    { title: "하이라이트", text: "실제 다녀온 코스의 사진과 이야기" },
  ],
};

export default function HomeKoPage() {
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
