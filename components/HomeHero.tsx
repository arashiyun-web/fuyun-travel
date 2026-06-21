import Link from "next/link";
import { COMPANY } from "@/lib/site";

const featureItems = [
  { href: "/services/coach-charter", title: "遊覽車包車", text: "校外教學、企業旅遊、大型團體" },
  { href: "/services/airport-transfer", title: "機場接送", text: "航班接送、多點上下車、行李安排" },
  { href: "/travel", title: "旅遊攻略", text: "最新旅遊內容、熱門行程與包車建議" },
  { href: "/contact/inquiry", title: "立即報價", text: "日期、人數、路線快速評估" },
];

export default function HomeHero() {
  return (
    <section className="home-hero" aria-label="台灣包車旅遊服務">
      <div className="home-hero__content">
        <p className="home-eyebrow">{COMPANY.companyName}｜{COMPANY.fleetCompanyName}</p>
        <h1>台灣包車旅遊</h1>
        <div className="home-hero__actions">
          <Link className="home-btn home-btn--gold" href="/contact/inquiry">
            立即報價
          </Link>
          <Link className="home-btn home-btn--glass" href="/travel">
            旅遊攻略
          </Link>
          <a className="home-btn home-btn--glass" href={COMPANY.facebookUrl} target="_blank" rel="noreferrer">
            Facebook
          </a>
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
