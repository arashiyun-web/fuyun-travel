import type { Metadata } from "next";
import AiTripPlanner from "@/components/AiTripPlanner";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "AI行程規劃",
  description: "輸入出發地、日期、預算、人數、年齡層與旅遊天數，自動產生景點、行程、餐廳、住宿、推薦車型與費用區間。",
  path: "/ai-trip-planner",
});

export default function AiTripPlannerPage() {
  return (
    <>
      <h1>AI行程規劃</h1>
      <p className="lead">第一版使用 Template Mode，未來可依 GX10 Local AI、OpenAI、Template Mode 的順序切換 Provider。</p>
      <AiTripPlanner />
    </>
  );
}
