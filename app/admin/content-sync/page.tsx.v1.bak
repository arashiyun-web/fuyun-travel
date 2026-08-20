"use client";

import { useEffect, useState } from "react";

type SyncItem = {
  id: string;
  sourceType: string;
  authorName: string | null;
  summary: string;
  postUrl: string | null;
  batchLabel: string;
  status: string;
  createdAt: string;
};

type AuthorizedMember = {
  id: string;
  displayName: string;
  fbIdentifier: string | null;
  note: string | null;
};

const SOURCE_LABELS: Record<string, { label: string; badge: string }> = {
  page_official: { label: "粉專官方", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  group_official: { label: "社團官方帳號", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  group_whitelist: { label: "社團已授權成員", badge: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  group_other: { label: "非授權成員・僅供選題參考", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  manual: { label: "手動提交", badge: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

export default function ContentSyncPage() {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<SyncItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<AuthorizedMember[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberNote, setNewMemberNote] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualSourceType, setManualSourceType] = useState("group_whitelist");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualMsg, setManualMsg] = useState("");

  useEffect(() => {
    setToken(localStorage.getItem("admin_token") || "");
  }, []);

  async function loadItems(t = token) {
    if (!t) return;
    const res = await fetch("/api/content-sync/items?status=pending", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.success) setItems(data.items);
  }

  async function loadMembers(t = token) {
    if (!t) return;
    const res = await fetch("/api/content-sync/authorized-members", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.success) setMembers(data.members);
  }

  useEffect(() => {
    if (token) {
      loadItems(token);
      loadMembers(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pullNow() {
    setPulling(true);
    setPullMsg("");
    try {
      const res = await fetch("/api/content-sync/weekly-pull", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setPullMsg(`${data.error || "拉取失敗"}${data.hint ? `　${data.hint}` : ""}`);
      } else {
        setPullMsg(`本批 ${data.batchLabel}：新增 ${data.created} 則，略過重複 ${data.skipped} 則`);
        loadItems();
      }
    } catch (error) {
      setPullMsg(String(error));
    } finally {
      setPulling(false);
    }
  }

  async function submitSelected() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const res = await fetch("/api/content-sync/select", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitMsg(data.error || "送出失敗");
      } else {
        const failed = data.results.filter((r: { success: boolean }) => !r.success);
        setSubmitMsg(
          failed.length
            ? `完成，但有 ${failed.length} 則失敗：${failed.map((f: { error?: string }) => f.error).join("；")}`
            : `已送出 ${data.results.length} 則到內容工廠審核佇列`,
        );
        setSelectedIds(new Set());
        loadItems();
      }
    } catch (error) {
      setSubmitMsg(String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function addMember() {
    if (!newMemberName.trim()) return;
    const res = await fetch("/api/content-sync/authorized-members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ displayName: newMemberName.trim(), note: newMemberNote.trim() }),
    });
    if (res.ok) {
      setNewMemberName("");
      setNewMemberNote("");
      loadMembers();
    }
  }

  async function removeMember(id: string) {
    await fetch(`/api/content-sync/authorized-members?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadMembers();
  }

  async function submitManual() {
    if (!manualSummary.trim()) return;
    setManualMsg("");
    const res = await fetch("/api/content-sync/manual-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        summary: manualSummary.trim(),
        sourceType: manualSourceType,
        authorName: manualAuthor.trim() || undefined,
        postUrl: manualUrl.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setManualMsg(data.error || "提交失敗");
    } else {
      setManualMsg("已加入本週清單");
      setManualSummary("");
      setManualAuthor("");
      setManualUrl("");
      loadItems();
    }
  }

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-160px)] flex items-center justify-center text-slate-100">
        <div className="text-sm text-slate-400">
          請先到 <a href="/admin" className="text-amber-400 underline">/admin</a> 登入。
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-8 max-w-5xl mx-auto">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider">weekly content sync</p>
        <h1 className="text-xl font-bold text-amber-400 mt-1">社群內容同步清單</h1>
        <p className="text-xs text-slate-500 mt-2">
          每週彙整粉專「小羽旅遊趣」新貼文，勾選要生成草稿的項目——勾選送出才會進入內容工廠審核佇列，不會自動發布。
        </p>
      </div>

      {/* 已授權社團成員白名單 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-medium text-slate-200 mb-1">已授權社團成員白名單</h2>
        <p className="text-xs text-slate-500 mb-4">
          社團貼文目前無法透過 Facebook API 自動讀取（Meta 平台政策限制），需要用下方「手動提交」加入清單。
          這份名單只是給你標註「這則貼文的作者是不是已經取得同意的成員」時參考，不會自動比對。
        </p>
        <div className="space-y-2 mb-4">
          {members.length === 0 ? (
            <p className="text-xs text-slate-600">尚未新增任何成員</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
                <div>
                  <span className="text-sm text-slate-200">{m.displayName}</span>
                  {m.note ? <span className="text-xs text-slate-500 ml-2">{m.note}</span> : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  移除
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="FB 顯示名稱"
            className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
          <input
            value={newMemberNote}
            onChange={(e) => setNewMemberNote(e.target.value)}
            placeholder="備註（例如：岳父）"
            className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={addMember}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300"
          >
            新增
          </button>
        </div>
      </div>

      {/* 手動提交社團貼文 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-base font-medium text-slate-200 mb-1">手動加入社團貼文</h2>
        <p className="text-xs text-slate-500 mb-4">Graph API 讀不到社團，這裡是備援：貼上內容並自己標註來源身份。</p>
        <div className="space-y-3">
          <textarea
            value={manualSummary}
            onChange={(e) => setManualSummary(e.target.value)}
            placeholder="貼文內容或行程重點"
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={manualSourceType}
              onChange={(e) => setManualSourceType(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200"
            >
              <option value="group_official">社團官方帳號（老闆／小羽本人）</option>
              <option value="group_whitelist">社團已授權成員</option>
              <option value="group_other">社團其他成員（僅供選題參考）</option>
            </select>
            <input
              value={manualAuthor}
              onChange={(e) => setManualAuthor(e.target.value)}
              placeholder="發文者名稱（選填）"
              className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <input
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="貼文連結（選填）"
              className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="button"
            onClick={submitManual}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300"
          >
            加入本週清單
          </button>
          {manualMsg ? <p className="text-xs text-slate-400">{manualMsg}</p> : null}
        </div>
      </div>

      {/* 本週待選清單 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="text-base font-medium text-slate-200">本週待選清單</h2>
          <button
            type="button"
            onClick={pullNow}
            disabled={pulling}
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-all disabled:opacity-50"
          >
            {pulling ? "拉取中…" : "立即拉取粉專貼文"}
          </button>
        </div>
        {pullMsg ? <p className="text-xs text-slate-400 mb-4">{pullMsg}</p> : null}

        {items.length === 0 ? (
          <p className="text-xs text-slate-600 py-8 text-center">目前沒有待選項目</p>
        ) : (
          <div className="space-y-2 mb-4">
            {items.map((item) => {
              const src = SOURCE_LABELS[item.sourceType] || SOURCE_LABELS.manual;
              return (
                <label
                  key={item.id}
                  className="flex items-start gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 cursor-pointer hover:border-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${src.badge}`}>{src.label}</span>
                      {item.authorName ? <span className="text-xs text-slate-500">{item.authorName}</span> : null}
                      <span className="text-[10px] text-slate-600">{item.batchLabel}</span>
                    </div>
                    <p className="text-sm text-slate-200">{item.summary}</p>
                    {item.postUrl ? (
                      <a href={item.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:underline">
                        查看原貼文
                      </a>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={submitSelected}
          disabled={submitting || selectedIds.size === 0}
          className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all disabled:opacity-50"
        >
          {submitting ? "送出中…" : `送出勾選項目產生草稿（${selectedIds.size}）`}
        </button>
        {submitMsg ? <p className="text-xs text-slate-400 mt-3">{submitMsg}</p> : null}
      </div>
    </div>
  );
}
