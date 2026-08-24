import type { Metadata } from "next";
import Link from "next/link";
import { explorePageMeta } from "@/lib/travelExplore";

export const metadata: Metadata = explorePageMeta({
  title: "AI 行程規劃入口",
  description: "輸入出發地、旅遊天數與人數，準備建立適合團體的台灣旅遊行程。",
  path: "/travel-planner",
});

type TravelPlannerPageProps = {
  searchParams: {
    origin?: string;
    days?: string;
    people?: string;
  };
};

// This release provides the planner UI only; no AI, database, or quote workflow is invoked.
export default function TravelPlannerPage({ searchParams }: TravelPlannerPageProps) {
  const selectedDays = ["1", "2", "3", "4"].includes(searchParams.days || "")
    ? searchParams.days
    : "1";

  return (
    <div className="travel-explore-shell travel-planner-page">
      <header>
        <p className="travel-section__eyebrow">AI TRIP PLANNER</p>
        <h1>開始規劃你的台灣行程</h1>
        <span>先留下基本條件。AI 建議功能將於下一階段安全串接。</span>
      </header>

      {/* Values stay visible on this entry page; no AI, API, or quote workflow is called. */}
      <form className="travel-planner-page__form">
        <label>
          <span>出發地</span>
          <input name="origin" defaultValue={searchParams.origin} placeholder="例如：台北、桃園機場" />
        </label>
        <label>
          <span>天數</span>
          <select name="days" defaultValue={selectedDays}>
            <option value="1">1 天</option>
            <option value="2">2 天</option>
            <option value="3">3 天</option>
            <option value="4">4 天以上</option>
          </select>
        </label>
        <label>
          <span>人數</span>
          <input name="people" defaultValue={searchParams.people} inputMode="numeric" placeholder="例如：8" />
        </label>
        <button type="button" disabled aria-describedby="planner-status">
          AI 規劃功能準備中
        </button>
        <p id="planner-status">你的條件已保留在本頁。本階段僅建立入口，不送出資料或呼叫 AI。</p>
      </form>

      <div className="travel-planner-page__links">
        <Link href="/travel">返回旅遊探索中心</Link>
        <Link href="/contact/inquiry">需要人工協助規劃？立即詢問</Link>
      </div>
    </div>
  );
}
