import Link from "next/link";

export const dynamic = "force-dynamic";

type Quote = {
  id: string;
  lineUserId: string;
  tripDate: string | null;
  passengerCount: number | null;
  pickup: string | null;
  destination: string | null;
  recommendedVehicle: string | null;
  quoteStatus: string;
  createdAt: string;
};

async function loadQuotes(adminToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fuyuntravel.com";
  const response = await fetch(`${baseUrl}/api/admin/quotes?admin_token=${encodeURIComponent(adminToken)}`, { cache: "no-store" });
  if (!response.ok) return [] as Quote[];
  const data = await response.json();
  return Array.isArray(data.quotes) ? (data.quotes as Quote[]) : [];
}

export default async function QuotesPage({ searchParams }: { searchParams: { admin_token?: string } }) {
  const adminToken = searchParams.admin_token || "";
  const quotes = adminToken ? await loadQuotes(adminToken) : [];

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-xs text-slate-500 uppercase tracking-wider">official quote workflow</p>
        <h1 className="text-xl font-bold text-amber-400 mt-1">LINE 詢價清單</h1>
        <p className="text-xs text-slate-500 mt-2">查看 LINE AI 客服收進來的包車詢價，編輯正式報價後送回 LINE 使用者。</p>
      </div>

      {!adminToken ? (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">缺少 admin_token。</div>
      ) : null}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-6 gap-3 px-4 py-3 text-xs text-slate-500 border-b border-slate-800">
          <span>日期</span><span>路線</span><span>人數</span><span>建議車型</span><span>狀態</span><span>操作</span>
        </div>
        {quotes.map((quote) => (
          <div key={quote.id} className="grid grid-cols-6 gap-3 px-4 py-3 text-sm border-b border-slate-800 last:border-b-0 items-center">
            <span className="text-slate-300">{quote.tripDate || "未填"}</span>
            <span className="text-slate-300">{quote.pickup || "未填"} → {quote.destination || "未填"}</span>
            <span className="font-mono text-amber-300">{quote.passengerCount || "-"}</span>
            <span>{quote.recommendedVehicle || "未產生"}</span>
            <span className="text-xs px-2 py-1 rounded bg-slate-950 border border-slate-800 w-fit">{quote.quoteStatus}</span>
            <Link className="text-amber-400 hover:text-amber-300 text-xs font-bold" href={`/admin/quotes/${quote.id}?admin_token=${encodeURIComponent(adminToken)}`}>編輯報價</Link>
          </div>
        ))}
        {quotes.length === 0 ? <div className="p-8 text-center text-xs text-slate-600">目前沒有詢價資料。</div> : null}
      </div>
    </div>
  );
}
