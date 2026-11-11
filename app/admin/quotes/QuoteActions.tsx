"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const ARCHIVE_CONFIRM_TEXT =
  "確定要把這筆詢價從清單移除嗎？\n\n" +
  "・資料不會刪掉，之後可以在「已移除」分頁還原。\n" +
  "・不會傳任何訊息給客人。";

async function post(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error("請先在 /admin 登入管理員");
  if (!response.ok || !data.success) throw new Error(data.error || "操作失敗");
  return data;
}

/** 移除 / 還原 for one quote. Removal asks first; quotes with an order show a locked label instead. */
export function QuoteArchiveButton({ id, archived, locked, onDone }: { id: string; archived: boolean; locked?: boolean; onDone?: (status: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (locked && !archived) return <span className="text-xs text-slate-600" title="已建立訂單的詢價不能移除">有訂單，不能移除</span>;

  async function run() {
    if (busy) return;
    if (!archived && !window.confirm(ARCHIVE_CONFIRM_TEXT)) return;
    setBusy(true);
    setError("");
    try {
      const data = await post(`/api/admin/quotes/${id}/${archived ? "restore" : "archive"}`);
      if (onDone) onDone(data.quoteStatus);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={run} className={archived ? "text-xs font-bold text-amber-400 hover:text-amber-300 disabled:opacity-50" : "text-xs font-bold text-red-300 hover:text-red-200 disabled:opacity-50"}>
        {busy ? "處理中…" : archived ? "還原" : "移除"}
      </button>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </span>
  );
}

/** Fills staff drafts for inquiries that never got one. Never sends anything. */
export function QuotePrefillButton({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run() {
    if (busy || pendingCount === 0) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const data = await post("/api/admin/quotes/prefill", {});
      setMessage(`已補產生 ${data.generated.length} 筆草稿，沒有送給客人。`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "補生成失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy || pendingCount === 0} onClick={run} className="px-4 py-2 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50">
        {busy ? "產生中…" : `批次補生成報價草稿（${pendingCount}）`}
      </button>
      {message ? <span className="text-xs text-emerald-300">{message}</span> : null}
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </div>
  );
}
