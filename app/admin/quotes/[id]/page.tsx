"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { savedFleetFare } from "@/lib/fleetFareInput";
import { trackEvent } from "@/lib/analytics";
import { SEND_UNCERTAIN_HINT, draftReplaceBlock, orderActionBlock, orderLocked } from "@/lib/quoteDraftGuard";
import { legacyDraftView, panelLines } from "@/lib/quotePanelText";
import { QuoteArchiveButton } from "../QuoteActions";

type ReviewItem = { key: string; label: string; role: string; unitAmountTwd: number | null; quantityLabel: string | null; minAmountTwd?: number | null; maxAmountTwd?: number | null; source: string };
type Decision = { decision: "" | "amount" | "not_applicable"; amount: string; quantity: string; reason: string };
type OrderView = {
  status: string;
  baseAmountTwd: number;
  totalAmountTwd: number | null;
  stale: boolean;
  items: ReviewItem[];
  included: { id: string; label: string; source: string }[];
  terms: { id: string; label: string; source: string }[];
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
  quoteOptions?: unknown;
  quoteStatus: string;
  sentAt: string | null;
};

export default function QuoteEditPage({ params }: { params: { id: string } }) {
  // Authenticated by the HttpOnly admin session cookie (same-origin fetch); no token in the URL.
  const [quote, setQuote] = useState<Quote | null>(null);
  const [rateId, setRateId] = useState("");
  const [hours, setHours] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [orderView, setOrderView] = useState<OrderView | null>(null);
  // v11: restore stays hidden until the order lookup finished and found no order.
  const [orderChecked, setOrderChecked] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [totalInput, setTotalInput] = useState("");

  async function loadQuote() {
    const response = await fetch(`/api/admin/quotes/${params.id}`, { cache: "no-store" });
    const data = await response.json();
    if (response.status === 401) throw new Error("請先在 /admin 登入管理員");
    if (!response.ok || !data.success) throw new Error(data.error || "讀取失敗");
    setQuote(data.quote);
    const fare = savedFleetFare(data.quote);
    setRateId(fare.rateId || "");
    setHours(fare.hours == null ? "" : String(fare.hours));
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
      body: JSON.stringify({ vehicleHint: quote.recommendedVehicle || "", rateId: rateId || null, hours: hours === "" ? null : Number(hours) }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "草稿產生失敗");
    setQuote(data.quote);
    const hints = Array.isArray(data.staffHints) ? data.staffHints.filter((item: unknown): item is string => typeof item === "string") : [];
    setMessage(["已寫入後台草稿，尚未送給客人。待確認項目留在草稿裡，沒有猜成總價。", ...hints].join(" "));
    await loadOrder();
  }

  async function loadOrder() {
    const response = await fetch(`/api/admin/quotes/${params.id}/order`, { cache: "no-store" });
    const data = await response.json();
    // 404: no order. v12: 503 means charter_orders does not exist on this database, so there is no order either
    // (the server guards treat a missing table the same way).
    if (response.status === 404 || response.status === 503) {
      setOrderView(null);
      setOrderChecked(true);
      return;
    }
    if (!response.ok || !data.success) throw new Error(data.error || "訂單讀取失敗");
    setOrderView({
      status: data.order.status,
      baseAmountTwd: data.baseAmountTwd,
      totalAmountTwd: data.totalAmountTwd,
      stale: Boolean(data.stale),
      items: data.items || [],
      included: data.included || [],
      terms: data.terms || [],
    });
    setOrderChecked(true);
    setDecisions((current) => {
      const next = { ...current };
      for (const item of data.items || []) {
        if (!next[item.key]) next[item.key] = { decision: "", amount: "", quantity: "", reason: "" };
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
        const decision = decisions[item.key] || { decision: "", amount: "", quantity: "", reason: "" };
        if (decision.decision === "amount" && typeof item.minAmountTwd === "number" && typeof item.maxAmountTwd === "number") {
          const amount = Number(decision.amount);
          if (!Number.isInteger(amount) || amount < item.minAmountTwd || amount > item.maxAmountTwd) {
            throw new Error(`「${item.label}」已核對是 ${item.minAmountTwd}–${item.maxAmountTwd} 元，不能填這個範圍以外。`);
          }
        }
        return {
          key: item.key,
          decision: decision.decision,
          amountTwd: decision.decision === "amount" && decision.amount.trim() !== "" ? Number(decision.amount) : undefined,
          quantity: decision.decision === "amount" && decision.quantity.trim() !== "" ? Number(decision.quantity) : undefined,
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

  async function restoreLegacy() {
    if (!quote) return;
    if (!window.confirm("把正式報價內容換回重新產生前的舊草稿？已儲存的內容會先另存在還原紀錄；編輯框裡尚未儲存的修改不會保留，請先按儲存。")) return;
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/quotes/${params.id}/legacy-restore`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "還原失敗");
    if (data.quote) setQuote(data.quote);
    setMessage(data.changed ? "已還原成舊草稿，尚未送給客人。" : "已經是舊草稿，沒有變更。");
  }

  async function sendQuote() {
    if (sendBusy) return;
    setSendBusy(true);
    setMessage("");
    setError("");
    try {
      // v13: once the request has left the browser, a missing or unreadable answer means LINE may already have
      // delivered it; the server answers LINE_UNCERTAIN in the same case. A retry of the same content within
      // 24 h is not delivered twice (X-Line-Retry-Key), but staff should look at LINE first.
      let response: Response;
      let data: { success?: boolean; error?: string; code?: string; quote?: Quote; alreadyDelivered?: boolean };
      try {
        response = await fetch(`/api/admin/quotes/${params.id}/send`, { method: "POST" });
        data = await response.json();
      } catch {
        throw new Error(SEND_UNCERTAIN_HINT);
      }
      if (!response.ok || !data.success) {
        if (data.code === "LINE_UNCERTAIN") throw new Error(data.error || SEND_UNCERTAIN_HINT);
        if (response.status >= 500 && !data.code) throw new Error(SEND_UNCERTAIN_HINT);
        throw new Error(data.error || "送出失敗");
      }
      if (data.quote) setQuote(data.quote);
      trackEvent("quote_sent", { quote_id: params.id });
      setMessage(data.alreadyDelivered ? "LINE 回覆這份內容先前已送達（24 小時內同內容不重複送出），這次沒有再送，已記為已送出。" : "已送出正式報價給 LINE 使用者。");
    } finally {
      setSendBusy(false);
    }
  }

  useEffect(() => {
    loadQuote().then(() => loadOrder()).catch((err) => setError(err instanceof Error ? err.message : "讀取失敗"));
  }, []);

  if (error && !quote) return <div className="p-6 text-red-300">{error}</div>;
  if (!quote) return <div className="p-6 text-slate-300">讀取中...</div>;
  // v12: 「依已核對車資產生草稿」 and 「送出給 LINE」 use the same order guard as the server (409 there); hidden
  // for ORDER_PENDING / STAFF_PRICED or an order, and until the order lookup has answered.
  const orderUnknownOrPresent = !orderChecked || Boolean(orderView);
  const draftBlock = orderActionBlock(quote, orderUnknownOrPresent, "draft");
  // v13: the server refuses a different recommended vehicle on these rows (409); read-only here as well.
  const vehicleLocked = orderLocked(quote.quoteStatus, orderUnknownOrPresent);
  const sendBlocked = orderActionBlock(quote, orderUnknownOrPresent, "send");

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
        <Link href="/admin/quotes" className="text-xs text-amber-400">返回詢價清單</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-amber-400">編輯正式報價</h1>
          <QuoteArchiveButton id={quote.id} archived={quote.quoteStatus === "ARCHIVED"} locked={Boolean(orderView) || quote.quoteStatus === "ORDER_PENDING" || quote.quoteStatus === "STAFF_PRICED"} onDone={(status) => { setQuote({ ...quote, quoteStatus: status }); setMessage(status === "ARCHIVED" ? "已移除，可在清單的「已移除」分頁還原。" : "已還原。"); }} />
        </div>
        {quote.quoteStatus === "ARCHIVED" ? <p className="text-xs text-red-300">這筆詢價已移除，不能送出或建立訂單；按「還原」可放回清單。</p> : null}
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
          <input value={quote.recommendedVehicle || ""} readOnly={vehicleLocked} onChange={(event) => setQuote({ ...quote, recommendedVehicle: event.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200 focus:outline-none focus:border-amber-500" />
          {orderChecked && vehicleLocked ? <p className="text-xs text-slate-500">已建立訂單，建議車型不能修改。</p> : null}

          <p className="text-xs text-slate-400">請先核對整趟行程符合單點方案，再明選路線與時數。備註不會自動決定基本車資。</p>
          <label className="block text-xs text-slate-400" htmlFor="checked-route">已核對路線</label>
          <select id="checked-route" value={rateId} onChange={(event) => setRateId(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200">
            <option value="">尚未核對</option>
            <option value="taipei-day-10h">台北一日單點方案</option>
            <option value="taipei-jiufen-10h">台北至九份單點方案</option>
          </select>
          <label className="block text-xs text-slate-400" htmlFor="checked-hours">用車時數</label>
          <input id="checked-hours" type="number" min="1" step="1" value={hours} onChange={(event) => setHours(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200" />

          <AutoDraftPanel options={quote.quoteOptions} />
          <LegacyDraftPanel options={quote.quoteOptions} restoreBlock={draftReplaceBlock(quote, !orderChecked || Boolean(orderView))} onRestore={() => restoreLegacy().catch((err) => setError(err instanceof Error ? err.message : "還原失敗"))} />
          <label className="block text-xs text-slate-400">正式報價內容（會原樣送給客人）</label>
          <textarea value={quote.quoteDraftText || ""} onChange={(event) => setQuote({ ...quote, quoteDraftText: event.target.value })} rows={16} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-200 font-mono text-sm focus:outline-none focus:border-amber-500" />

          <div className="flex flex-wrap gap-3">
            {draftBlock ? null : <button onClick={() => fillCheckedFare().catch((err) => setError(err instanceof Error ? err.message : "草稿產生失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300">依已核對車資產生草稿</button>}
            <button type="button" disabled={orderBusy} onClick={() => makeOrder().catch((err) => setError(err instanceof Error ? err.message : "轉成訂單失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50">記下待確認訂單</button>
            <button onClick={() => saveQuote().catch((err) => setError(err instanceof Error ? err.message : "儲存失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300">儲存正式報價</button>
            {sendBlocked ? null : <button type="button" disabled={quote.quoteStatus === "ARCHIVED" || sendBusy} onClick={() => sendQuote().catch((err) => setError(err instanceof Error ? err.message : "送出失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50">{sendBusy ? "送出中…" : "送出給 LINE"}</button>}
          </div>
          {orderChecked && sendBlocked ? <p className="text-xs text-slate-500">{sendBlocked}「依已核對車資產生草稿」也已停用。</p> : null}
        </div>
      </div>

      {orderView ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-medium text-amber-400">內部核定</h2>
          <p className="text-xs text-slate-500">狀態：{orderView.status === "staff_priced" ? "內部已核定。這不是客人已同意，也不是已付款。" : "待確認。尚未內部核定。"} 基本車資 {orderView.baseAmountTwd} 元。車資總價 {orderView.totalAmountTwd == null ? "尚未填入" : `${orderView.totalAmountTwd} 元`}。訂金不計入總價。不會送出訊息，也不會改已核對的車資表。</p>
          {orderView.included.length ? <p className="text-xs text-slate-400">已含在基本車資、不另加：{orderView.included.map((item) => item.label).join("、")}</p> : null}
          {orderView.terms.length ? <p className="text-xs text-slate-400">條款，不是加價：{orderView.terms.map((item) => item.label).join("、")}</p> : null}
          {orderView.stale ? <p className="text-sm text-amber-300">報價已變更，不能用這份訂單核定。請先處理版本衝突。</p> : null}
          {orderView.items.map((item) => {
            const decision = decisions[item.key] || { decision: "", amount: "", quantity: "", reason: "" };
            return (
              <div key={item.key} className="border border-slate-800 rounded-xl p-3 space-y-2">
                <p className="text-sm text-slate-200">{item.label}{item.role === "payment" ? "（訂金，不計入車資總額）" : ""}</p>
                <p className="text-xs text-slate-500">{item.source}{item.unitAmountTwd != null ? ` 已知每${item.quantityLabel} ${item.unitAmountTwd} 元。` : typeof item.minAmountTwd === "number" && typeof item.maxAmountTwd === "number" ? ` 已核對範圍 ${item.minAmountTwd}–${item.maxAmountTwd} 元。` : " 沒有固定單價，不自動帶入。"}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  <label><input type="radio" name={item.key} checked={decision.decision === "amount"} onChange={() => setDecisions({ ...decisions, [item.key]: { ...decision, decision: "amount" } })} /> {item.role === "payment" ? "記下訂金" : "填入金額"}</label>
                  <label><input type="radio" name={item.key} checked={decision.decision === "not_applicable"} onChange={() => setDecisions({ ...decisions, [item.key]: { ...decision, decision: "not_applicable" } })} /> 本趟不適用</label>
                </div>
                {decision.decision === "amount" && item.quantityLabel ? <input value={decision.quantity} onChange={(event) => setDecisions({ ...decisions, [item.key]: { ...decision, quantity: event.target.value } })} placeholder={`${item.quantityLabel}數`} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200" /> : null}
                {decision.decision === "amount" ? <input type="number" min={typeof item.minAmountTwd === "number" ? item.minAmountTwd : 0} max={typeof item.maxAmountTwd === "number" ? item.maxAmountTwd : undefined} value={decision.amount} onChange={(event) => setDecisions({ ...decisions, [item.key]: { ...decision, amount: event.target.value } })} placeholder={typeof item.minAmountTwd === "number" && typeof item.maxAmountTwd === "number" ? `${item.minAmountTwd}–${item.maxAmountTwd}` : "整數金額"} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200" /> : null}
                {decision.decision === "not_applicable" ? <input value={decision.reason} onChange={(event) => setDecisions({ ...decisions, [item.key]: { ...decision, reason: event.target.value } })} placeholder="具體原因，空白不算" className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200" /> : null}
              </div>
            );
          })}
          <label className="block text-xs text-slate-400">人員填入的車資總價（基本車資加附加費，不含訂金）</label>
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

/** Staff-only notes from the auto draft (reference range, 待補, internal note). Never sent to the customer. */
function AutoDraftPanel({ options }: { options: unknown }) {
  const lines = panelLines(options);
  if (!lines) return null;
  const [title, ...rest] = lines;
  const last = rest.pop();
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1 text-xs text-slate-300">
      <p className="font-bold text-amber-300">{title}</p>
      {rest.map((line, index) => <p key={index}>{line}</p>)}
      <p className="text-emerald-300">{last}</p>
    </div>
  );
}

/** v10: read-only copy of the draft that regenerateLegacy replaced, with a one-click restore. Admin only. */
function LegacyDraftPanel({ options, restoreBlock, onRestore }: { options: unknown; restoreBlock: string | null; onRestore: () => void }) {
  const view = legacyDraftView(options);
  if (!view) return null;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 space-y-2 text-xs text-slate-300">
      <p className="font-bold text-slate-200">重新產生前的舊草稿（唯讀{view.replacedAt ? `，${new Date(view.replacedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })} 被取代` : ""}）</p>
      <pre className="whitespace-pre-wrap font-mono text-slate-400 max-h-64 overflow-auto">{view.text}</pre>
      {view.historyCount ? <p className="text-slate-500">還原前的版本已保存 {view.historyCount} 份（quoteOptions.restoreHistory）。</p> : null}
      {view.regenerated && restoreBlock ? <p className="text-slate-500">{restoreBlock}</p> : null}
      {view.regenerated && !restoreBlock ? (
        <button type="button" onClick={onRestore} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-slate-300 hover:bg-slate-200">還原成舊草稿</button>
      ) : null}
      {!view.regenerated ? <p className="text-slate-500">目前沒有重新產生的草稿可還原。</p> : null}
    </div>
  );
}
