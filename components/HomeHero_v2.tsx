"use client";

import Link from "next/link";
import { COMPANY, LINE_URL } from "@/lib/site";
import { trackCtaClick } from "@/lib/analytics";

const featureItems = [
  { href: "/services/coach-charter", title: "遊覽車包車", text: "校外教學、企業旅遊、大型團體" },
  { href: "/services/airport-transfer", title: "機場接送", text: "航班接送、多點上下車、行李安排" },
  { href: "/travel", title: "旅遊攻略", text: "最新旅遊內容、熱門行程與包車建議" },
  { href: "/contact/inquiry", title: "立即報價", text: "日期、人數、路線快速評估" },
];

const trustBadges = [
  "30分鐘內回覆",
  "合法旅行社與遊覽車公司",
  "企業、學校、家族旅遊皆可安排",
];

export default function HomeHeroV2() {
  const lineHref = LINE_URL || "/contact";

  return (
    <section className="home-hero" aria-label="台灣包車旅遊服務">
      <div className="home-hero__content">
        <p className="home-eyebrow">{COMPANY.companyName}｜{COMPANY.fleetCompanyName}</p>
        <h1 className="home-hero__title-v2">全台包車旅遊｜遊覽車出租｜機場接送</h1>

        <ul className="home-hero__trust-v2" aria-label="服務保證">
          {trustBadges.map((badge) => (
            <li key={badge}>
              <span className="home-hero__trust-check-v2" aria-hidden="true">✓</span>
              {badge}
            </li>
          ))}
        </ul>

        <div className="home-hero__actions">
          <a
            className="home-btn home-btn--line-v2"
            href={lineHref}
            target={LINE_URL ? "_blank" : undefined}
            rel={LINE_URL ? "noopener noreferrer" : undefined}
            onClick={() => trackCtaClick({ cta_location: "hero_line" })}
          >
            LINE立即報價
          </a>
          <Link
            className="home-btn home-btn--gold"
            href="/contact/inquiry?utm_content=hero"
            onClick={() => trackCtaClick({ cta_location: "hero_inquiry" })}
          >
            立即詢價
          </Link>
        </div>
      </div>

      <div className="home-feature-grid" aria-label="核心服務">
        {featureItems.map((item) => (
          <Link className="home-feature-card" key={item.href} href={item.href}>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
