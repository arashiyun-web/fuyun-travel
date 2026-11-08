"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Member = {
  id: string;
  name: string;
  memberLevel: string;
  orderCount: number;
  quoteCount: number;
  createdAt: string;
};

export default function AdminMembersPage() {
  const [rows, setRows] = useState<Member[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/members", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error(data.error || "請先到 /admin 登入管理員。");
        if (!response.ok || !data.success) throw new Error(data.error || "會員讀取失敗，不是沒有資料。");
        setRows(data.members || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "會員讀取失敗，不是沒有資料。"));
  }, []);

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
        <Link href="/admin" className="text-xs text-amber-400">返回後台</Link>
        <h1 className="text-xl font-bold text-amber-400">會員</h1>
        <p className="text-xs text-slate-500">只讀現有 LINE 會員。沒有獨立訂單表。2026-10-19 已移除派車單，因為裡面有司機個資與誤收的客人訊息，這裡不重建。</p>
      </div>
      {error ? <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error} {error.includes("登入") ? <Link href="/admin" className="underline">前往登入</Link> : null}</div> : null}
      {rows === null && !error ? <div className="p-8 text-center text-xs text-slate-500">讀取中，還沒確認有沒有會員。</div> : null}
      {rows ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {rows.map((member) => (
            <div key={member.id} className="px-4 py-3 border-b border-slate-800 text-sm">
              <p className="text-slate-200">{member.name} · {member.memberLevel}</p>
              <p className="text-xs text-slate-500">會員裡的訂單筆數 {member.orderCount}，報價筆數 {member.quoteCount}。沒有金額，也不會發送。</p>
            </div>
          ))}
          {rows.length === 0 ? <div className="p-8 text-center text-xs text-slate-600">目前沒有會員資料。</div> : null}
        </div>
      ) : null}
    </div>
  );
}
