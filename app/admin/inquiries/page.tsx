"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STATUS_LABELS = { New: "新詢價", Quoted: "已報價", Confirmed: "已確認", Cancelled: "已取消" } as const;
type InquiryStatus = keyof typeof STATUS_LABELS;

type Inquiry = {
  id: string;
  status: InquiryStatus;
  name: string;
  start_date: string;
  pickup_location: string;
  destination: string;
  passenger_count: number;
  preferred_vehicle: string[];
  special_requests: string;
};

const LOGIN_MESSAGE = "請先到 /admin 登入管理員。";

export default function AdminInquiriesPage() {
  const [rows, setRows] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/inquiry", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error(data.error || data.message || LOGIN_MESSAGE);
        if (!response.ok || !data.success) throw new Error(data.message || data.error || "詢價讀取失敗，不是沒有資料。");
        setRows(data.inquiries || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "詢價讀取失敗，不是沒有資料。"));
  }, []);

  async function preview(row: Inquiry) {
    setError("");
    const response = await fetch(`/api/admin/inquiries/${row.id}/draft`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error(data.error || LOGIN_MESSAGE);
    if (!response.ok || !data.success) throw new Error(data.message || data.error || "草稿產生失敗");
    setDrafts((current) => ({ ...current, [row.id]: data.draft.text }));
  }

  async function updateStatus(row: Inquiry, status: InquiryStatus) {
    setError("");
    setUpdating((current) => ({ ...current, [row.id]: true }));
    try {
      const response = await fetch("/api/inquiry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error(data.error || LOGIN_MESSAGE);
      if (!response.ok || !data.success) throw new Error(data.message || data.error || "狀態更新失敗");
      setRows((current) => current?.map((item) => item.id === row.id ? data.inquiry : item) || []);
    } finally {
      setUpdating((current) => ({ ...current, [row.id]: false }));
    }
  }

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <Link href="/admin" className="text-xs text-amber-400">返回後台</Link>
        <h1 className="text-xl font-bold text-amber-400 mt-1">網站詢價</h1>
        <p className="text-xs text-slate-500 mt-2">依已核對車資產生草稿，只顯示在這裡，不會寄出或傳到 LINE。</p>
      </div>
      {error ? (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          {error}{error.includes("/admin") ? null : ""} {error.includes("登入") ? <Link href="/admin" className="underline">前往登入</Link> : null}
        </div>
      ) : null}
      {rows === null && !error ? <div className="p-8 text-center text-xs text-slate-500">讀取中，還沒確認有沒有詢價。</div> : null}
      <div className="space-y-3">
        {(rows || []).map((row) => (
          <div key={row.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-slate-200">{row.name} · {row.start_date || "未填日期"} · {row.passenger_count} 人</p>
            <p className="text-xs text-slate-400">{row.pickup_location || "未填"} → {row.destination || "未填"} · {row.preferred_vehicle.join("、") || "未指定車型"}</p>
            <label className="flex items-center gap-3 text-xs text-slate-300">
              詢價狀態
              <select aria-label={`${row.name} 的詢價狀態`} value={row.status} disabled={updating[row.id]} onChange={(event) => updateStatus(row, event.target.value as InquiryStatus).catch((err) => setError(err instanceof Error ? err.message : "狀態更新失敗"))} className="bg-slate-950 border border-slate-800 rounded p-2 disabled:opacity-50">
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {updating[row.id] ? "儲存中…" : STATUS_LABELS[row.status]}
            </label>
            <button type="button" onClick={() => preview(row).catch((err) => setError(err instanceof Error ? err.message : "草稿產生失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300">產生車資草稿</button>
            {drafts[row.id] ? <pre className="whitespace-pre-wrap text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded p-3">{drafts[row.id]}</pre> : null}
          </div>
        ))}
        {rows && rows.length === 0 ? <div className="p-8 text-center text-xs text-slate-600">目前沒有網站詢價。</div> : null}
      </div>
    </div>
  );
}
