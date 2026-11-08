"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

type ReviewItem = { key: string; label: string; kind: string };
type Decision = { decision: "" | "amount" | "not_applicable"; amount: string; reason: string };
type OrderView = {
  status: string;
  baseAmountTwd: number;
  totalAmountTwd: number | null;
  stale: boolean;
  items: ReviewItem[];
};

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

export default function QuoteEditPage({ params }: { params: { id: string } }) {
  // Authenticated by the HttpOnly admin session cookie (same-origin fetch); no token in the URL.
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [orderView, setOrderView] = useState<OrderView | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [totalInput, setTotalInput] = useState("");

  async function loadQuote() {
    const response = await fetch(`/api/admin/quotes/${params.id}`, { cache: "no-store" });
    const data = await response.json();
    if (response.status === 401) throw new Error("請先在 /admin 登入管理員");
    if (!response.ok || !data.success) throw new Error(data.error || "讀取失敗");
    setQuote(data.quote);
  }

  async function saveQuote() {
    if (!quote) return;
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/quotes/${params.id}`, {
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

  async function fillCheckedFare() {
    if (!quote) return;
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/quotes/${params.id}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleHint: quote.recommendedVehicle || "" }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "草稿產生失敗");
    setQuote(data.quote);
    setMessage("已寫入後台草稿，尚未送給客人。待確認項目留在草稿裡，沒有猜成總價。");
  }

  async function loadOrder() {
    const response = await fetch(`/api/admin/quotes/${params.id}/order`, { cache: "no-store" });
    const data = await response.json();
    if (response.status === 404) {
      setOrderView(null);
      return;
    }
    if (!response.ok || !data.success) throw new Error(data.error || "訂單讀取失敗");
    setOrderView({
      status: data.order.status,
      baseAmountTwd: data.baseAmountTwd,
      totalAmountTwd: data.totalAmountTwd,
      stale: Boolean(data.stale),
      items: data.items || [],
    });
    setDecisions((current) => {
      const next = { ...current };
      for (const item of data.items || []) {
        if (!next[item.key]) next[item.key] = { decision: "", amount: "", reason: "" };
      }
      return next;
    });
  }

  async function makeOrder() {
    if (!quote || orderBusy) return;
    setOrderBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/quotes/${params.id}/order`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "轉成訂單失敗");
      setMessage(data.created ? "已記下待確認訂單。這只是基本車資，不是總價，也還沒送給客人。" : "這筆報價已經有待確認訂單，沒有再新增一筆。");
      await loadQuote();
      await loadOrder();
    } finally {
      setOrderBusy(false);
    }
  }

  async function saveStaffPrice() {
    if (!orderView || pricingBusy || orderView.stale || orderView.status === "staff_priced") return;
    setPricingBusy(true);
    setMessage("");
    setError("");
    try {
      const items = orderView.items.map((item) => {
        const decision = decisions[item.key] || { decision: "", amount: "", reason: "" };
        return {
          key: item.key,
          decision: decision.decision,
          amountTwd: decision.decision === "amount" && decision.amount.trim() !== "" ? Number(decision.amount) : undefined,
          reason: decision.reason,
        };
      });
      const response = await fetch(`/api/admin/quotes/${params.id}/order/staff-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, totalAmountTwd: totalInput.trim() === "" ? undefined : Number(totalInput) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "內部核定失敗");
      setMessage(data.updated ? "已存成內部核定。這不是客人已同意，也不是已付款，沒有送出訊息。" : "這筆訂單已經內部核定，金額沒有再改。");
      await loadOrder();
      await loadQuote();
    } finally {
      setPricingBusy(false);
    }
  }

  async function sendQuote() {
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/quotes/${params.id}/send`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "送出失敗");
    setQuote(data.quote);
    trackEvent("quote_sent", { quote_id: params.id });
    setMessage("已送出正式報價給 LINE 使用者。");
  }

  useEffect(() => {
    loadQuote().then(() => loadOrder()).catch((err) => setError(err instanceof Error ? err.message : "讀取失敗"));
  }, []);

  if (error && !quote) return <div className="p-6 text-red-300">{error}</div>;
  if (!quote) return <div className="p-6 text-slate-300">讀取中...</div>;

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
        <Link href="/admin/quotes" className="text-xs text-amber-400">返回詢價清單</Link>
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
            <button onClick={() => fillCheckedFare().catch((err) => setError(err instanceof Error ? err.message : "草稿產生失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300">依已核對車資產生草稿</button>
            <button type="button" disabled={orderBusy} onClick={() => makeOrder().catch((err) => setError(err instanceof Error ? err.message : "轉成訂單失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50">記下待確認訂單</button>
            <button onClick={() => saveQuote().catch((err) => setError(err instanceof Error ? err.message : "儲存失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300">儲存正式報價</button>
            <button onClick={() => sendQuote().catch((err) => setError(err instanceof Error ? err.message : "送出失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-white bg-emerald-600 hover:bg-emerald-500">送出給 LINE</button>
          </div>
        </div>
      </div>

      {orderView ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-medium text-amber-400">內部核定</h2>
          <p className="text-xs text-slate-500">狀態：{orderView.status === "staff_priced" ? "內部已核定。這不是客人已同意，也不是已付款。" : "待確認。尚未內部核定。"} 基本車資 {orderView.baseAmountTwd} 元。總價 {orderView.totalAmountTwd == null ? "尚未填入" : `${orderView.totalAmountTwd} 元`}。不會送出訊息，也不會改已核對的車資表。</p>
          {orderView.stale ? <p className="text-sm text-amber-300">報價已變更，不能用這份訂單核定。請先處理版本衝突。</p> : null}
          {orderView.items.map((item) => {
            const decision = decisions[item.key] || { decision: "", amount: "", reason: "" };
            return (
              <div key={item.key} className="border border-slate-800 rounded-xl p-3 space-y-2">
                <p className="text-sm text-slate-200">{item.label}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  <label><input type="radio" name={item.key} checked={decision.decision === "amount"} onChange={() => setDecisions({ ...decisions, [item.key]: { ...decision, decision: "amount" } })} /> 填入金額</label>
                  <label><input type="radio" name={item.key} checked={decision.decision === "not_applicable"} onChange={() => setDecisions({ ...decisions, [item.key]: { ...decision, decision: "not_applicable" } })} /> 本趟不適用</label>
                </div>
                {decision.decision === "amount" ? <input value={decision.amount} onChange={(event) => setDecisions({ ...decisions, [item.key]: { ...decision, amount: event.target.value } })} placeholder="整數金額" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200" /> : null}
                {decision.decision === "not_applicable" ? <input value={decision.reason} onChange={(event) => setDecisions({ ...decisions, [item.key]: { ...decision, reason: event.target.value } })} placeholder="原因，空白不算" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200" /> : null}
              </div>
            );
          })}
          <label className="block text-xs text-slate-400">人員填入的總價（基本車資加附加費）</label>
          <input value={totalInput} onChange={(event) => setTotalInput(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200" />
          <button type="button" disabled={pricingBusy || orderView.stale || orderView.status === "staff_priced"} onClick={() => saveStaffPrice().catch((err) => setError(err instanceof Error ? err.message : "內部核定失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50">儲存內部核定</button>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="text-sm text-slate-200 mt-1">{value || "未填"}</p></div>;
}
