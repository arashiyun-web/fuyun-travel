import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSessionTokenFromCookies } from "@/lib/adminSession";

export const dynamic = "force-dynamic";

type TopEntry = {
  label: string;
  count: number;
};

type AnalyticsData = {
  success: boolean;
  metrics: {
    todayInquiryCount: number;
    monthInquiryCount: number;
    aiUsageCount: number;
    lineClickRate: number | null;
    inquiryConversionRate: number;
    quoteSentRate: number;
    dealRate: number;
    aiPriceViewCount: number;
  };
  topRoutes: TopEntry[];
  topKeywords: TopEntry[];
  topDates: TopEntry[];
};

async function loadAnalytics(sessionToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fuyuntravel.com";
  const response = await fetch(`${baseUrl}/api/admin/analytics`, { cache: "no-store", headers: { Authorization: `Bearer ${sessionToken}` } });
  if (!response.ok) return null;
  return (await response.json()) as AnalyticsData;
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: { admin_token?: string; legacy?: string } }) {
  // Old bookmarks carried the access token in the URL: drop it from the address bar at once.
  if (searchParams.admin_token) redirect("/admin/analytics?legacy=1");
  const legacyLink = searchParams.legacy === "1";
  const sessionToken = adminSessionTokenFromCookies();
  const data = sessionToken ? await loadAnalytics(sessionToken) : null;

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <Link href="/admin/quotes" className="text-xs text-amber-400">返回詢價清單</Link>
        <p className="text-xs text-slate-500 uppercase tracking-wider mt-3">operational analytics</p>
        <h1 className="text-xl font-bold text-amber-400 mt-1">AI 客服與詢價營運分析</h1>
        <p className="text-xs text-slate-500 mt-2">讀取 PostgreSQL 真實紀錄；LINE 點擊率以 GA4/PostHog funnel 為準。</p>
      </div>

      {!sessionToken ? <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">請先在 <Link href="/admin" className="underline">/admin</Link> 登入管理員。{legacyLink ? " 舊的 admin_token 連結格式已停用，連結中的代碼不會再被使用。" : ""}</div> : null}
      {sessionToken && !data ? <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">讀取 analytics 失敗。</div> : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Metric label="今日詢價數" value={String(data.metrics.todayInquiryCount)} />
            <Metric label="本月詢價數" value={String(data.metrics.monthInquiryCount)} />
            <Metric label="AI 使用次數" value={String(data.metrics.aiUsageCount)} />
            <Metric label="AI 價格瀏覽" value={String(data.metrics.aiPriceViewCount)} />
            <Metric label="LINE 點擊率" value={data.metrics.lineClickRate === null ? "GA4/PostHog" : `${data.metrics.lineClickRate}%`} />
            <Metric label="詢價轉換率" value={`${data.metrics.inquiryConversionRate}%`} />
            <Metric label="報價送出率" value={`${data.metrics.quoteSentRate}%`} />
            <Metric label="成交率" value={`${data.metrics.dealRate}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TopList title="熱門路線" items={data.topRoutes} />
            <TopList title="熱門關鍵字" items={data.topKeywords} />
            <TopList title="熱門日期" items={data.topDates} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-mono font-bold text-amber-400">{value}</p>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: TopEntry[] }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="text-base font-bold text-slate-200">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 border-b border-slate-800 pb-2 last:border-b-0">
            <span className="text-sm text-slate-300 truncate">{item.label}</span>
            <span className="text-xs font-mono text-amber-300">{item.count}</span>
          </div>
        )) : <p className="text-xs text-slate-600">尚無資料。</p>}
      </div>
    </section>
  );
}
