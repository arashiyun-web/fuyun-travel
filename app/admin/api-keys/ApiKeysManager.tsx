"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type KeyRow = {
  id: string; name: string; keyPrefix: string; createdAt: string;
  disabledAt: string | null; lastUsedAt: string | null;
  usage: { minute: number; day: number };
};
const buttonClass = "rounded-lg border border-slate-700 px-3 py-2 text-sm text-amber-300 disabled:opacity-50";
const timeLabel = (value: string | null) => value
  ? new Date(value).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : "尚未使用";

async function keyRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", credentials: "same-origin", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw new Error(body?.error || "金鑰操作失敗，請稍後重試。");
  return body as T;
}

export default function ApiKeysManager() {
  const [rows, setRows] = useState<KeyRow[] | null>(null);
  const [name, setName] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const body = await keyRequest<{ keys: KeyRow[] }>("/api/admin/api-keys", { signal });
    if (!signal?.aborted) setRows(body.keys);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch(() => {
      if (!controller.signal.aborted) setError("金鑰讀取失敗，請重新整理後重試。");
    });
    return () => controller.abort();
  }, [refresh]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true); setError(""); setPlaintext("");
    try {
      const body = await keyRequest<{ plaintextKey: string }>("/api/admin/api-keys", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      setPlaintext(body.plaintextKey); setName("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "金鑰建立失敗。");
    } finally { setBusy(false); }
  }
  async function disable(id: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await keyRequest(`/api/admin/api-keys/${encodeURIComponent(id)}/disable`, { method: "POST" });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "金鑰停用失敗。");
    } finally { setBusy(false); }
  }

  return <div className="space-y-5">
    {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</p> : null}
    <form onSubmit={create} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <label htmlFor="api-key-name" className="block text-sm text-slate-300">金鑰名稱</label>
      <div className="flex flex-wrap gap-3">
        <input id="api-key-name" required maxLength={100} autoComplete="off" value={name}
          onChange={event => setName(event.target.value)} placeholder="外部 AI 代理名稱"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 p-2" />
        <button type="submit" disabled={busy || !name.trim()} className={buttonClass}>{busy ? "處理中…" : "產生金鑰"}</button>
      </div>
      <p className="text-xs text-slate-400">每分鐘 30 次、台北時間每日 1,000 次；每小時最多建立 20 張新單。</p>
    </form>
    {plaintext ? <section className="space-y-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-6">
      <label htmlFor="created-api-key" className="block font-bold text-amber-300">請立即安全保存；隱藏或離開後無法再次查看明碼。</label>
      <textarea id="created-api-key" readOnly rows={2} value={plaintext} autoComplete="off" spellCheck={false}
        className="w-full rounded-lg border border-amber-500/30 bg-slate-950 p-3 font-mono text-sm" />
      <button type="button" onClick={() => setPlaintext("")} className={buttonClass}>已保存，隱藏明碼</button>
    </section> : null}
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">已核發的 AI API 金鑰與使用量</caption>
        <thead className="text-xs text-slate-400"><tr>
          {['名稱／前綴', '狀態', '最後使用（台北）', '本分鐘／今日', '操作'].map(label => <th scope="col" key={label} className="p-4">{label}</th>)}
        </tr></thead>
        <tbody>{rows?.map(row => <tr key={row.id} className="border-t border-slate-800">
          <td className="p-4">{row.name}<span className="mt-1 block font-mono text-xs text-slate-500">{row.keyPrefix}…</span></td>
          <td className="p-4">{row.disabledAt ? "已停用" : "可使用"}</td>
          <td className="p-4">{timeLabel(row.lastUsedAt)}</td>
          <td className="p-4 font-mono">{row.usage.minute} / 30 · {row.usage.day} / 1,000</td>
          <td className="p-4">{row.disabledAt ? <span className="text-xs text-slate-500">保留紀錄</span>
            : <button type="button" disabled={busy} onClick={() => void disable(row.id)} className={buttonClass}>停用</button>}</td>
        </tr>)}</tbody>
      </table>
      {rows === null ? !error ? <p className="p-6 text-slate-400">讀取中…</p> : null
        : rows.length === 0 ? <p className="p-6 text-slate-400">尚未核發任何金鑰。</p> : null}
    </div>
  </div>;
}
