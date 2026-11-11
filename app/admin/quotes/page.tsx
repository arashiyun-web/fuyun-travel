import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSessionTokenFromCookies } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";
import { QUOTE_PAGE_SIZE, QUOTE_TABS, quoteIdsWithOrders, quoteTab, tabWhere, type QuoteTab } from "@/lib/quoteArchive";
import { quoteEstimate } from "@/lib/quotePrefill";
import { autoDraftNeedsReview } from "@/lib/quoteSendGuard";
import { QuoteArchiveButton, QuotePrefillButton } from "./QuoteActions";

export const dynamic = "force-dynamic";

type Quote = {
  id: string;
  tripDate: string | null;
  passengerCount: number | null;
  pickup: string | null;
  destination: string | null;
  remark: string | null;
  recommendedVehicle: string | null;
  quoteDraftText: string | null;
  quoteOptions: unknown;
  quoteStatus: string;
};

type SearchParams = { admin_token?: string; legacy?: string; tab?: string; page?: string };

const STATUS_LABELS: Record<string, string> = {
  new: "新詢價",
  DRAFT: "草稿",
  SENT: "已送出",
  CONFIRMED: "已確認",
  ORDER_PENDING: "待確認訂單",
  STAFF_PRICED: "內部已核定",
  ARCHIVED: "已移除",
};

function pageHref(tab: QuoteTab, page: number) {
  return `/admin/quotes?tab=${tab}${page > 1 ? `&page=${page}` : ""}`;
}

function EstimateCell({ quote }: { quote: Quote }) {
  if (!quote.quoteDraftText) return <span className="text-xs text-slate-600">未產生</span>;
  return (
    <span className="block">
      <EstimateText quote={quote} />
      {autoDraftNeedsReview(quote.quoteOptions) ? <span className="block text-[11px] text-red-300">自動草稿，人員改寫儲存後才能送出</span> : null}
    </span>
  );
}

/** Staff-only column. Reference ranges and 待補 come from quoteOptions/knowledge base, never from the customer text. */
function EstimateText({ quote }: { quote: Quote }) {
  const estimate = quoteEstimate(quote);
  if (estimate.amountTwd != null) {
    return <span className="font-mono text-amber-300">NT${estimate.amountTwd.toLocaleString("en-US")}<span className="block text-[11px] font-sans text-slate-500">基本車資，非總價</span></span>;
  }
  if (estimate.summary) {
    return <span className="text-xs text-amber-300">{estimate.summary}<span className="block text-[11px] text-slate-500">知識庫參考行情，非確定金額</span></span>;
  }
  return (
    <span className="text-xs">
      <span className="text-amber-300">參考行情｜待補：{estimate.missing.join("、") || "人員核對"}</span>
      {estimate.references.length ? <span className="block text-[11px] text-slate-500">參考行情 車隊表 {estimate.references[0]}</span> : null}
    </span>
  );
}

export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  if (searchParams.admin_token) redirect("/admin/quotes?legacy=1");
  const legacyLink = searchParams.legacy === "1";
  const tab = quoteTab(searchParams.tab);
  const requestedPage = Math.max(1, Math.floor(Number(searchParams.page) || 1));
  const sessionToken = adminSessionTokenFromCookies();
  let quotes: Quote[] | null = null;
  let counts: Record<QuoteTab, number> = { pending: 0, sent: 0, archived: 0 };
  let ungenerated = 0;
  let page = 1;
  let totalPages = 1;
  let ordered = new Set<string>();
  let loadError = "";
  if (sessionToken) {
    try {
      const [pending, sent, archived, missingDrafts] = await Promise.all([
        prisma.charterQuote.count({ where: tabWhere("pending") }),
        prisma.charterQuote.count({ where: tabWhere("sent") }),
        prisma.charterQuote.count({ where: tabWhere("archived") }),
        prisma.charterQuote.count({ where: { AND: [tabWhere("pending"), { OR: [{ quoteDraftText: null }, { quoteDraftText: "" }] }] } }),
      ]);
      counts = { pending, sent, archived };
      ungenerated = missingDrafts;
      totalPages = Math.max(1, Math.ceil(counts[tab] / QUOTE_PAGE_SIZE));
      page = Math.min(requestedPage, totalPages);
      quotes = await prisma.charterQuote.findMany({
        where: tabWhere(tab),
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * QUOTE_PAGE_SIZE,
        take: QUOTE_PAGE_SIZE,
        select: {
          id: true,
          tripDate: true,
          passengerCount: true,
          pickup: true,
          destination: true,
          remark: true,
          recommendedVehicle: true,
          quoteDraftText: true,
          quoteOptions: true,
          quoteStatus: true,
        },
      });
      ordered = await quoteIdsWithOrders(quotes.map((quote) => quote.id));
    } catch {
      loadError = "報價讀取失敗，不是沒有資料。";
    }
  }

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <Link href="/admin" className="inline-block text-xs text-amber-400 hover:text-amber-300">← 回後台首頁</Link>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-xs text-slate-500 uppercase tracking-wider">official quote workflow</p>
        <h1 className="text-xl font-bold text-amber-400 mt-1">LINE 詢價清單</h1>
        <p className="text-xs text-slate-500 mt-2">查看 LINE AI 客服收進來的包車詢價。新詢價進來時會依車隊費率表或知識庫行情自動產生報價草稿，草稿只存在這裡；參考行情只在後台顯示，自動草稿要人員改寫儲存後才能送出。</p>
      </div>

      {!sessionToken ? (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">請先到 <Link href="/admin" className="underline">/admin</Link> 登入管理員。{legacyLink ? "舊的 admin_token 連結格式已停用，連結中的代碼不會再被使用。" : ""}</div>
      ) : null}
      {loadError ? <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{loadError}</div> : null}

      {quotes ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {QUOTE_TABS.map((item) => (
                <Link key={item.key} href={pageHref(item.key, 1)} className={item.key === tab
                  ? "px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400"
                  : "px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-900 border border-slate-800 hover:border-amber-500"}>
                  {item.label}（{counts[item.key]}）
                </Link>
              ))}
            </div>
            {tab === "pending" ? <QuotePrefillButton pendingCount={ungenerated} /> : null}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-7 gap-3 px-4 py-3 text-xs text-slate-500 border-b border-slate-800">
              <span>日期</span><span>路線</span><span>人數</span><span>建議車型</span><span>報價草稿</span><span>狀態</span><span>操作</span>
            </div>
            {quotes.map((quote) => (
              <div key={quote.id} className="grid grid-cols-7 gap-3 px-4 py-3 text-sm border-b border-slate-800 last:border-b-0 items-center">
                <span className="text-slate-300">{quote.tripDate || "未填"}</span>
                <span className="text-slate-300">{quote.pickup || "未填"} → {quote.destination || "未填"}</span>
                <span className="font-mono text-amber-300">{quote.passengerCount || "-"}</span>
                <span>{quote.recommendedVehicle || "未產生"}</span>
                <EstimateCell quote={quote} />
                <span className="text-xs px-2 py-1 rounded bg-slate-950 border border-slate-800 w-fit">{STATUS_LABELS[quote.quoteStatus] || quote.quoteStatus}</span>
                <span className="flex flex-wrap items-center gap-3">
                  <Link className="text-amber-400 hover:text-amber-300 text-xs font-bold" href={`/admin/quotes/${quote.id}`}>編輯報價</Link>
                  <QuoteArchiveButton id={quote.id} archived={quote.quoteStatus === "ARCHIVED"} locked={ordered.has(quote.id) || quote.quoteStatus === "ORDER_PENDING" || quote.quoteStatus === "STAFF_PRICED"} />
                </span>
              </div>
            ))}
            {quotes.length === 0 ? <div className="p-8 text-center text-xs text-slate-600">這個分頁目前沒有詢價。</div> : null}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>第 {page} / {totalPages} 頁，每頁 {QUOTE_PAGE_SIZE} 則</span>
            <span className="flex gap-2">
              {page > 1
                ? <Link href={pageHref(tab, page - 1)} className="px-3 py-1 rounded-lg border border-slate-800 hover:border-amber-500 text-slate-300">上一頁</Link>
                : <span className="px-3 py-1 rounded-lg border border-slate-900 text-slate-700">上一頁</span>}
              {page < totalPages
                ? <Link href={pageHref(tab, page + 1)} className="px-3 py-1 rounded-lg border border-slate-800 hover:border-amber-500 text-slate-300">下一頁</Link>
                : <span className="px-3 py-1 rounded-lg border border-slate-900 text-slate-700">下一頁</span>}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
