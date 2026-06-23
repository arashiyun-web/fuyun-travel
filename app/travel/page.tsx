import type { Metadata } from "next";
import Link from "next/link";
import TravelExploreCard from "@/components/TravelExploreCard";
import {
  attractions,
  charterRoutes,
  explorePageMeta,
  schoolTrips,
} from "@/lib/travelExplore";

export const metadata: Metadata = explorePageMeta({
  title: "旅遊探索中心",
  description: "探索台灣熱門景點、包車路線與校外教學靈感，從圖片快速找到下一趟旅程。",
  path: "/travel",
});

// The exploration center favors visual discovery while deeper SEO content remains one level below.
export default function TravelPage() {
  return (
    <div className="travel-explore-shell travel-home">
      <header className="travel-explore-hero travel-explore-hero--home">
        <div className="travel-explore-hero__content">
          <p>TRAVEL INSPIRATION</p>
          <h1>探索台灣旅遊靈感</h1>
          <span>熱門景點、包車行程、校外教學與旅遊攻略</span>
          <div className="travel-hero__chips" aria-label="快速導覽">
            <a href="#attractions-title">熱門景點</a>
            <a href="#routes-title">包車路線</a>
            <a href="#school-title">校外教學</a>
          </div>
        </div>
      </header>

      <section className="travel-explore-section" aria-labelledby="attractions-title">
        <div className="travel-section-heading">
          <div>
            <p className="travel-section__eyebrow">DESTINATIONS</p>
            <h2 id="attractions-title">熱門景點探索</h2>
          </div>
          <p>從一張風景開始，找到下一個想停留的地方。</p>
        </div>
        <div className="travel-visual-grid travel-visual-grid--featured">
          {attractions.map((item) => (
            <TravelExploreCard
              key={item.slug}
              href={'/attractions/' + item.slug}
              image={item.coverImage}
              title={item.title}
              description={item.description}
              meta={item.location}
            />
          ))}
        </div>
      </section>

      <section className="travel-explore-section" aria-labelledby="routes-title">
        <div className="travel-section-heading">
          <div>
            <p className="travel-section__eyebrow">CHARTER ROUTES</p>
            <h2 id="routes-title">熱門包車路線</h2>
          </div>
          <p>清楚的起點與目的地，讓團體移動更容易開始。</p>
        </div>
        <div className="travel-visual-grid">
          {charterRoutes.map((item) => (
            <TravelExploreCard
              key={item.slug}
              href={'/charter-routes/' + item.slug}
              image={item.coverImage}
              title={item.title}
              description={item.description}
              meta={item.origin + ' 出發'}
            />
          ))}
        </div>
      </section>

      <section className="travel-explore-section" aria-labelledby="school-title">
        <div className="travel-section-heading">
          <div>
            <p className="travel-section__eyebrow">SCHOOL TRIPS</p>
            <h2 id="school-title">校外教學推薦</h2>
          </div>
          <p>兼顧學習主題、活動節奏與團體移動的推薦場域。</p>
        </div>
        <div className="travel-visual-grid">
          {schoolTrips.map((item) => (
            <TravelExploreCard
              key={item.slug}
              href={'/school-trips/' + item.slug}
              image={item.coverImage}
              title={item.title}
              description={item.description}
              meta={item.suitableFor}
            />
          ))}
        </div>
      </section>

      <section className="travel-planner-entry travel-planner-entry--compact" aria-labelledby="planner-title">
        <div className="travel-planner-entry__copy">
          <p className="travel-section__eyebrow">AI TRIP PLANNER</p>
          <h2 id="planner-title">從條件開始，找到適合的行程方向</h2>
          <p>輸入基本旅遊條件，前往行程規劃入口。</p>
        </div>
        <Link className="travel-planner-entry__button" href="/travel-planner">
          開始規劃
        </Link>
      </section>
    </div>
  );
}
