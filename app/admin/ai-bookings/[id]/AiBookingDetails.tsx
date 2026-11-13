"use client";

import { useCallback, useEffect, useState } from "react";

type ReviewStatus = "pending_review" | "confirmed" | "rejected";
type Booking = {
  id: string; bookingNumber: string; contactName: string; phone: string; email: string | null;
  date: string; endDate: string | null; time: string; pickup: string; destination: string;
  passengerCount: number; vehicle: string | null; notes: string | null; quoteRange: unknown;
  status: ReviewStatus; isTest: boolean; notificationStatus: string;
  notificationAttempts: number; notificationLastError: string | null;
};
const reviewLabels: Record<ReviewStatus, string> = { pending_review: "待審核", confirmed: "已確認", rejected: "已拒絕" };
const deliveryLabels: Record<string, string> = { pending: "通知處理中", sent: "通知已送達", failed: "通知未送達" };
const buttonClass = "rounded-lg border border-slate-700 px-4 py-2 text-sm text-amber-300 disabled:opacity-50";
async function bookingRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.error || "AI 訂單操作失敗，請稍後重試。");
  return body as T;
}

export default function AiBookingDetails({ id }: { id: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [status, setStatus] = useState<ReviewStatus>("pending_review");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const url = `/api/admin/ai-bookings/${encodeURIComponent(id)}`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const body = await bookingRequest<{ booking: Booking }>(url, { signal });
    if (!signal?.aborted) { setBooking(body.booking); setStatus(body.booking.status); }
  }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "AI 訂單讀取失敗。");
    });
    return () => controller.abort();
  }, [refresh]);

  async function saveStatus() {
    if (busy || !booking) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const body = await bookingRequest<{ booking: Booking }>(url, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      setBooking(body.booking); setStatus(body.booking.status); setMessage("審核狀態已儲存。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "狀態儲存失敗。");
    } finally { setBusy(false); }
  }
  async function retryNotification() {
    if (busy || !booking) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const body = await bookingRequest<{ notificationStatus: string }>(`${url}/retry-notification`, { method: "POST" });
      setMessage(body.notificationStatus === "sent" ? "通知已送達。"
        : body.notificationStatus === "pending" ? "通知處理中，請稍後重新整理。" : "通知未送達，請檢查通知設定後重送。");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通知未送達，請稍後重送。");
    } finally { setBusy(false); }
  }

  const fields = booking ? [
    ['聯絡人', booking.contactName], ['電話', booking.phone], ['Email', booking.email || '未填'],
    ['日期與時間', `${booking.date}${booking.endDate ? ` ～ ${booking.endDate}` : ''} ${booking.time}`],
    ['路線', `${booking.pickup} → ${booking.destination}`], ['人數與車型', `${booking.passengerCount} 人／${booking.vehicle || '未指定'}`],
  ] : [];
  return <div className="space-y-5">
    {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p> : null}
    {message ? <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">{message}</p> : null}
    {booking ? <>
      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="break-all text-xl font-bold text-amber-400">{booking.bookingNumber}</h1>
        {booking.isTest ? <p className="text-sm text-sky-300">測試單</p> : null}
        <p className="text-sm text-slate-400">此需求須由專人聯絡旅客，確認車輛與價格後另行提供正式報價。</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {fields.map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
          <div className="sm:col-span-2"><dt className="text-slate-500">備註</dt><dd className="mt-1 whitespace-pre-wrap break-words">{booking.notes || "未填"}</dd></div>
        </dl>
        {booking.quoteRange ? <div><h2 className="text-sm text-slate-500">代理提供的參考範圍</h2>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(booking.quoteRange, null, 2)}</pre>
        </div> : null}
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <label htmlFor="booking-status" className="block text-sm text-slate-300">審核狀態</label>
        <div className="flex flex-wrap gap-3">
          <select id="booking-status" disabled={busy} value={status} onChange={event => setStatus(event.target.value as ReviewStatus)}
            className="rounded-lg border border-slate-700 bg-slate-950 p-2">
            {(Object.keys(reviewLabels) as ReviewStatus[]).map(value => <option key={value} value={value}>{reviewLabels[value]}</option>)}
          </select>
          <button type="button" disabled={busy || status === booking.status} onClick={() => void saveStatus()} className={buttonClass}>{busy ? "處理中…" : "儲存狀態"}</button>
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className={booking.notificationStatus === "failed" ? "font-bold text-red-300" : "font-bold text-slate-300"}>LINE：{deliveryLabels[booking.notificationStatus] || "通知未送達"}</h2>
        <p className="text-sm text-slate-400">已嘗試 {booking.notificationAttempts} 次。{booking.notificationLastError || ""}</p>
        {booking.notificationStatus !== "sent" ? <button type="button" disabled={busy} onClick={() => void retryNotification()} className={buttonClass}>{busy ? "處理中…" : "重送通知"}</button> : null}
      </section>
    </> : error ? null : <p className="p-6 text-slate-400">讀取中…</p>}
  </div>;
}
