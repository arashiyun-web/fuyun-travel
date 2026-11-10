import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSessionTokenFromCookies } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Quote = {
  id: string;
  tripDate: string | null;
  passengerCount: number | null;
  pickup: string | null;
  destination: string | null;
  recommendedVehicle: string | null;
  quoteStatus: string;
};

export default async function QuotesPage({ searchParams }: { searchParams: { admin_token?: string; legacy?: string } }) {
  if (searchParams.admin_token) redirect("/admin/quotes?legacy=1");
  const legacyLink = searchParams.legacy === "1";
  const sessionToken = adminSessionTokenFromCookies();
  let quotes: Quote[] | null = null;
  let loadError = "";
  if (sessionToken) {
    try {
      quotes = await prisma.charterQuote.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          tripDate: true,
          passengerCount: true,
          pickup: true,
          destination: true,
          recommendedVehicle: true,
          quoteStatus: true,
        },
      });
    } catch {
      loadError = "報價讀取失敗，不是沒有資料。";
    }
  }

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-xs text-slate-500 uppercase tracking-wider">official quote workflow</p>
        <h1 className="text-xl font-bold text-amber-400 mt-1">LINE 詢價清單</h1>
        <p className="text-xs text-slate-500 mt-2">查看 LINE AI 客服收進來的包車詢價。草稿存在這裡，送出仍要另外按按鈕。</p>
      </div>

      {!sessionToken ? (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">請先到 <Link href="/admin" className="underline">/admin</Link> 登入管理員。{legacyLink ? "舊的 admin_token 連結格式已停用，連結中的代碼不會再被使用。" : ""}</div>
      ) : null}
      {loadError ? <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{loadError}</div> : null}

      {quotes ? (
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
              <Link className="text-amber-400 hover:text-amber-300 text-xs font-bold" href={`/admin/quotes/${quote.id}`}>編輯報價</Link>
            </div>
          ))}
          {quotes.length === 0 ? <div className="p-8 text-center text-xs text-slate-600">目前沒有詢價資料。</div> : null}
        </div>
      ) : null}
    </div>
  );
}
