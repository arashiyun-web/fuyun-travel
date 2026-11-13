"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type BookingRow = {
  source: string; contactChannel: string; contactId: string | null; luggageCount: number | null;
  id: string; bookingNumber: string; date: string; endDate: string | null;
  pickup: string; destination: string; passengerCount: number; vehicle: string | null;
  status: string; isTest: boolean; notificationStatus: string;
};
const reviewLabels: Record<string, string> = { pending_review: "待審核", confirmed: "已確認", rejected: "已拒絕" };
const deliveryLabels: Record<string, string> = { pending: "通知處理中", sent: "通知已送達", failed: "通知未送達" };

export default function AiBookingList() {
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/ai-bookings", { cache: "no-store", credentials: "same-origin", signal });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) throw new Error(body?.error || "AI 訂單讀取失敗。");
      if (!signal?.aborted) setRows(body.bookings);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "AI 訂單讀取失敗。");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return <div className="space-y-4">
    {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p> : null}
    <button type="button" disabled={loading} onClick={() => void refresh()}
      className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-amber-300 disabled:opacity-50">{loading ? "讀取中…" : "重新整理"}</button>
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">最近 100 筆 AI 待確認訂單</caption>
        <thead className="text-xs text-slate-400"><tr>
          {['單號', '來源／聯絡', '日期', '路線', '人數／車型', '審核', 'LINE 通知'].map(label => <th key={label} scope="col" className="p-4">{label}</th>)}
        </tr></thead>
        <tbody>{rows?.map(row => <tr key={row.id} className="border-t border-slate-800">
          <td className="p-4"><Link href={`/admin/ai-bookings/${encodeURIComponent(row.id)}`} className="font-mono text-amber-300 underline">{row.bookingNumber}</Link>
            {row.isTest ? <span className="mt-1 block text-xs text-sky-300">測試單</span> : null}</td>
          <td className="p-4">{row.source === "web_chat" ? "網頁客服" : "API"}<br />{row.contactChannel || "phone"}：{row.contactId || "—"}<br />行李 {row.luggageCount ?? "未填"} 件</td>
          <td className="p-4">{row.date}{row.endDate ? ` ～ ${row.endDate}` : ""}</td>
          <td className="p-4">{row.pickup} → {row.destination}</td>
          <td className="p-4">{row.passengerCount} 人／{row.vehicle || "未指定"}</td>
          <td className="p-4">{reviewLabels[row.status] || row.status}</td>
          <td className={row.notificationStatus === "failed" ? "p-4 text-red-300" : "p-4 text-slate-400"}>{deliveryLabels[row.notificationStatus] || "通知未送達"}</td>
        </tr>)}</tbody>
      </table>
      {rows === null ? !error ? <p className="p-6 text-slate-400">讀取中…</p> : null
        : rows.length === 0 ? <p className="p-6 text-slate-400">目前沒有 AI 訂單。</p> : null}
    </div>
  </div>;
}
