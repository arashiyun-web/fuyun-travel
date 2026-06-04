"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Quote = {
  id: string;
  tripDate: string | null;
  passengerCount: number | null;
  pickup: string | null;
  destination: string | null;
  remark: string | null;
  recommendedVehicle: string | null;
  quoteDraftText: string | null;
  quoteStatus: string;
  sentAt: string | null;
};

export default function QuoteEditPage({ params, searchParams }: { params: { id: string }; searchParams: { admin_token?: string } }) {
  const adminToken = searchParams.admin_token || "";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadQuote() {
    const response = await fetch(`/api/admin/quotes/${params.id}?admin_token=${encodeURIComponent(adminToken)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "讀取失敗");
    setQuote(data.quote);
  }

  async function saveQuote() {
    if (!quote) return;
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/quotes/${params.id}?admin_token=${encodeURIComponent(adminToken)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendedVehicle: quote.recommendedVehicle,
        quoteDraftText: quote.quoteDraftText,
        quoteStatus: quote.quoteStatus,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "儲存失敗");
    setQuote(data.quote);
    setMessage("已儲存正式報價。");
  }

  async function sendQuote() {
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/quotes/${params.id}/send?admin_token=${encodeURIComponent(adminToken)}`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "送出失敗");
    setQuote(data.quote);
    setMessage("已送出正式報價給 LINE 使用者。");
  }

  useEffect(() => {
    loadQuote().catch((err) => setError(err instanceof Error ? err.message : "讀取失敗"));
  }, []);

  if (!adminToken) return <div className="p-6 text-red-300">缺少 admin_token。</div>;
  if (error && !quote) return <div className="p-6 text-red-300">{error}</div>;
  if (!quote) return <div className="p-6 text-slate-300">讀取中...</div>;

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
        <Link href={`/admin/quotes?admin_token=${encodeURIComponent(adminToken)}`} className="text-xs text-amber-400">返回詢價清單</Link>
        <h1 className="text-xl font-bold text-amber-400">編輯正式報價</h1>
        <p className="text-xs text-slate-500">{quote.pickup || "未填"} → {quote.destination || "未填"} / {quote.passengerCount || "-"} 人 / {quote.tripDate || "未填日期"}</p>
      </div>

      {message ? <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">{message}</div> : null}
      {error ? <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div> : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-medium text-slate-200">詢價資料</h2>
          <Info label="出車日期" value={quote.tripDate} />
          <Info label="人數" value={quote.passengerCount ? String(quote.passengerCount) : null} />
          <Info label="出發地" value={quote.pickup} />
          <Info label="目的地" value={quote.destination} />
          <Info label="備註" value={quote.remark} />
          <Info label="狀態" value={quote.quoteStatus} />
          <Info label="送出時間" value={quote.sentAt} />
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <label className="block text-xs text-slate-400">建議車型</label>
          <input value={quote.recommendedVehicle || ""} onChange={(event) => setQuote({ ...quote, recommendedVehicle: event.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200 focus:outline-none focus:border-amber-500" />

          <label className="block text-xs text-slate-400">正式報價內容</label>
          <textarea value={quote.quoteDraftText || ""} onChange={(event) => setQuote({ ...quote, quoteDraftText: event.target.value })} rows={16} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200 font-mono text-sm focus:outline-none focus:border-amber-500" />

          <div className="flex flex-wrap gap-3">
            <button onClick={() => saveQuote().catch((err) => setError(err instanceof Error ? err.message : "儲存失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300">儲存正式報價</button>
            <button onClick={() => sendQuote().catch((err) => setError(err instanceof Error ? err.message : "送出失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-white bg-emerald-600 hover:bg-emerald-500">送出給 LINE</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="text-sm text-slate-200 mt-1">{value || "未填"}</p></div>;
}
