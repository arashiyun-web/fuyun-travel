"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Inquiry = {
  id: string;
  name: string;
  start_date: string;
  pickup_location: string;
  destination: string;
  passenger_count: number;
  preferred_vehicle: string[];
  special_requests: string;
};

export default function AdminInquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/inquiry", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || data.error || "讀取失敗");
        setRows(data.inquiries || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "讀取失敗"));
  }, []);

  async function preview(row: Inquiry) {
    setError("");
    const response = await fetch(`/api/admin/inquiries/${row.id}/draft`, { method: "POST" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || data.error || "草稿產生失敗");
    setDrafts((current) => ({ ...current, [row.id]: data.draft.text }));
  }

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <Link href="/admin" className="text-xs text-amber-400">返回後台</Link>
        <h1 className="text-xl font-bold text-amber-400 mt-1">網站詢價</h1>
        <p className="text-xs text-slate-500 mt-2">依已核對車資產生草稿，只顯示在這裡，不會寄出或傳到 LINE。</p>
      </div>
      {error ? <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div> : null}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-slate-200">{row.name} · {row.start_date || "未填日期"} · {row.passenger_count} 人</p>
            <p className="text-xs text-slate-400">{row.pickup_location || "未填"} → {row.destination || "未填"} · {row.preferred_vehicle.join("、") || "未指定車型"}</p>
            <button type="button" onClick={() => preview(row).catch((err) => setError(err instanceof Error ? err.message : "草稿產生失敗"))} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300">產生車資草稿</button>
            {drafts[row.id] ? <pre className="whitespace-pre-wrap text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded p-3">{drafts[row.id]}</pre> : null}
          </div>
        ))}
        {rows.length === 0 && !error ? <div className="p-8 text-center text-xs text-slate-600">目前沒有網站詢價。</div> : null}
      </div>
    </div>
  );
}
