"use client";

import Link from "next/link";
import type { GeoSectionContent } from "@/lib/geo/content/home";

export interface GeoHomeLabels {
  brand?: string;
  quote?: string;
  phone?: string;
  trust?: string;
  updated?: string;
  faqTitle?: string;
  /** Hero trust badges (3 items). Falls back to zh-Hant. */
  trustBadges?: string[];
  /** Hero 5 feature cards. Falls back to zh-Hant. */
  features?: { title: string; text: string }[];
}

const ZH_FEATURES = [
  { title: "遊覽車包車", text: "校外教學、企業旅遊、大型團體" },
  { title: "機場接送", text: "航班接送、多點上下車、行李安排" },
  { title: "旅遊攻略", text: "最新旅遊內容、熱門行程與包車建議" },
  { title: "立即詢價", text: "日期、人數、路線快速評估" },
  { title: "這裡真好玩", text: "真實走過的行程分享與照片，點進來看更多。" },
];
const FEATURE_HREFS = [
  "/services/coach-charter",
  "/services/airport-transfer",
  "/travel",
  "/contact/inquiry?utm_content=hero",
  "/highlights",
];
const ZH_TRUST = [
  "30分鐘內回覆",
  "合法旅行社與遊覽車公司",
  "企業、學校、家族旅遊皆可安排",
];

export default function GeoHomeContent({
  content,
  labels = {},
}: {
  content: GeoSectionContent;
  labels?: GeoHomeLabels;
}) {
  const L = {
    brand: labels.brand ?? "浮雲輕鬆遊",
    quote: labels.quote ?? "立即詢價",
    phone: labels.phone ?? "電話直撥",
    trust: labels.trust ?? "信任與資質",
    updated: labels.updated ?? "2026 年最新",
    faqTitle: labels.faqTitle ?? "常見問題",
  };
  const feats =
    labels.features && labels.features.length === 5
      ? labels.features
      : ZH_FEATURES;
  const trust =
    labels.trustBadges && labels.trustBadges.length === 3
      ? labels.trustBadges
      : ZH_TRUST;

  return (
    <>
      {/* Hero — reuses the exact same visual language as the zh-Hant home (HomeHeroV2) */}
      <section className="home-hero" aria-label="Taiwan charter travel hero">
        <div className="home-hero__content">
          <p className="home-eyebrow">{L.brand}</p>
          <h1 className="home-hero__title-v2">{content.h1}</h1>
          <ul className="home-hero__trust-v2" aria-label="service-guarantee">
            {trust.map((b) => (
              <li key={b}>
                <span className="home-hero__trust-check-v2" aria-hidden="true">✓</span>
                {b}
              </li>
            ))}
          </ul>
          <div className="home-hero__actions">
            <a
              className="home-btn home-btn--line-v2"
              href="https://line.me/R/ti/p/@954fyicw"
              target="_blank"
              rel="noopener noreferrer"
            >
              LINE立即報價
            </a>
            <Link className="home-btn home-btn--glass" href="/contact/inquiry?utm_content=hero">
              {L.quote}
            </Link>
          </div>
        </div>
        <div className="home-feature-grid" aria-label="core-services">
          {feats.map((f, i) => (
            <Link className="home-feature-card" key={i} href={FEATURE_HREFS[i]}>
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Body — same GeoPage content sections (BLUF + FAQ + trust block) */}
      <div className="geo-page min-h-screen bg-[#f7f3ea] pb-16 pt-10 text-[#2b2b2b]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="geo-lead mt-2 rounded-md bg-[#fffaf0] p-5 text-base font-semibold leading-8 ring-1 ring-[#e3d6b8] sm:text-lg">
            {content.lead}
          </p>

          {content.sections.map((sec, i) => (
            <section key={i} className="mt-10">
              <h2 className="text-xl font-bold">{sec.heading}</h2>
              {sec.steps ? (
                <ol className="mt-4 list-decimal space-y-2 pl-5 leading-8">
                  {sec.steps.map((s, j) => (
                    <li key={j}>{s}</li>
                  ))}
                </ol>
              ) : null}
              {sec.bullets ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 leading-8">
                  {sec.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {sec.body?.map((p, j) => (
                <p key={j} className="mt-3 leading-8">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <section className="mt-10 rounded-md bg-white p-6 ring-1 ring-[#d8ccb2]">
            <h3 className="text-lg font-bold">{L.faqTitle}</h3>
            <dl className="mt-4 space-y-4">
              {content.faq.map((f, i) => (
                <div key={i}>
                  <dt className="font-bold">{f.q}</dt>
                  <dd className="mt-1 leading-8">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-8 rounded-md bg-[#fffaf0] p-6 ring-1 ring-[#e3d6b8]">
            <h3 className="text-lg font-bold">
              {L.trust}{" "}
              <span className="text-sm font-medium text-[#8a7a5a]">（{L.updated}）</span>
            </h3>
            <ul className="mt-3 grid gap-2 text-sm leading-7 sm:grid-cols-2">
              <li>甲種旅行社 882200</li>
              <li>品保會員 北2760 · 統一編號 60675708</li>
              <li>履約保證 旺旺友聯產物保險 新臺幣 1,500 萬元</li>
              <li>自有車隊 15 輛 · 在職駕駛約 20 位</li>
              <li>電話 02-2685-1666 · 信箱 yunyi6866@gmail.com</li>
              <li>{L.brand}</li>
            </ul>
          </section>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/contact/inquiry"
              className="inline-flex rounded-md bg-[#2f2f2f] px-5 py-3 font-bold text-white transition hover:bg-[#b89b5e]"
            >
              {L.quote}
            </Link>
            <a
              href="tel:0226851666"
              className="inline-flex rounded-md border border-[#d8c9aa] bg-white px-5 py-3 font-bold text-[#242424] transition hover:bg-white"
            >
              {L.phone}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
