"use client";

import { useEffect, useState } from "react";
import { deriveTitleFromSummary } from "@/lib/content-sync/deriveTitle";

type SyncItem = {
  id: string;
  sourceType: string;
  authorName: string | null;
  summary: string;
  postUrl: string | null;
  postedAt: string | null;
  batchLabel: string;
  status: string;
  createdAt: string;
  rawPayload: { full_picture?: string } | null;
};

function itemPhotoUrl(item: SyncItem) {
  return item.rawPayload?.full_picture || "";
}

type AuthorizedMember = {
  id: string;
  displayName: string;
  fbIdentifier: string | null;
  note: string | null;
};

type ListTab = "pending" | "featured" | "archived";
type TabCounts = Record<ListTab, number>;

const LIST_TABS: Array<{ key: ListTab; label: string }> = [
  { key: "pending", label: "待處理" },
  { key: "featured", label: "已上首頁" },
  { key: "archived", label: "已移除" },
];

const PAGE_SIZE = 10;

const ARCHIVE_CONFIRM_TEXT =
  "確定要把這則從清單移除嗎？\n\n" +
  "・只會從這份清單移除，資料不會刪掉，之後可以在「已移除」分頁還原。\n" +
  "・已經上首頁的卡片會照舊留在首頁，不受影響。";

function pageNumbers(current: number, total: number) {
  const pages: number[] = [];
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  for (let p = start; p <= end; p += 1) pages.push(p);
  return pages;
}

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
  const [featureFormId, setFeatureFormId] = useState<string | null>(null);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [featurePhotoUrl, setFeaturePhotoUrl] = useState("");
  const [featureSubmitting, setFeatureSubmitting] = useState(false);
  const [featureMsg, setFeatureMsg] = useState<Record<string, string>>({});
  const [featuredItemIds, setFeaturedItemIds] = useState<Set<string>>(new Set());
  const [featureAllSubmitting, setFeatureAllSubmitting] = useState(false);
  const [featureAllMsg, setFeatureAllMsg] = useState("");
  const [listTab, setListTab] = useState<ListTab>("pending");
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listCounts, setListCounts] = useState<TabCounts>({ pending: 0, featured: 0, archived: 0 });
  const [listMsg, setListMsg] = useState("");
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("admin_token") || "");
  }, []);

  async function loadItems(t = token, tab = listTab, page = listPage) {
    if (!t) return;
    const res = await fetch(`/api/content-sync/items?tab=${tab}&page=${page}&pageSize=${PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.success) {
      setItems(data.items);
      if (data.counts) setListCounts(data.counts);
      if (typeof data.totalPages === "number") setListTotalPages(data.totalPages);
      if (typeof data.page === "number" && data.page !== page) setListPage(data.page);
    }
  }

  function switchTab(tab: ListTab) {
    setListTab(tab);
    setListPage(1);
    setListMsg("");
  }

  function goToPage(page: number) {
    setListPage(Math.min(Math.max(1, page), listTotalPages));
  }

  async function archiveItem(item: SyncItem, restore = false) {
    if (!restore && !window.confirm(ARCHIVE_CONFIRM_TEXT)) return;
    setArchivingId(item.id);
    setListMsg("");
    try {
      const res = await fetch("/api/content-sync/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(restore ? { id: item.id, restore: true } : { id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setListMsg(data.error || (restore ? "還原失敗" : "移除失敗"));
      } else {
        setListMsg(restore ? "已還原到「待處理」" : "已移除，可在「已移除」分頁還原");
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        loadItems();
      }
    } catch (error) {
      setListMsg(String(error));
    } finally {
      setArchivingId(null);
    }
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

  async function loadFeaturedStatus(t = token) {
    if (!t) return;
    const res = await fetch("/api/featured-spots", {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.success) {
      setFeaturedItemIds(
        new Set(
          data.spots
            .map((s: { sourceItemId: string | null }) => s.sourceItemId)
            .filter((id: string | null): id is string => !!id),
        ),
      );
    }
  }

  useEffect(() => {
    if (token) {
      loadMembers(token);
      loadFeaturedStatus(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) loadItems(token, listTab, listPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, listTab, listPage]);

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

  function openFeatureForm(item: SyncItem) {
    setFeatureFormId(item.id);
    // 自動帶入標題，讓「確認發布」不用等老闆手動打字才會解除 disabled——
    // 這是先前「按鈕按不下去」的根因，標題欄位還是可以再手動編輯。
    setFeatureTitle(deriveTitleFromSummary(item.summary));
    setFeatureDescription(item.summary);
    setFeaturePhotoUrl(itemPhotoUrl(item));
    setFeatureMsg((prev) => ({ ...prev, [item.id]: "" }));
  }

  function cancelFeatureForm() {
    setFeatureFormId(null);
  }

  async function confirmFeature(item: SyncItem) {
    if (!featureTitle.trim() || !featureDescription.trim()) return;
    setFeatureSubmitting(true);
    try {
      const res = await fetch("/api/featured-spots", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: featureTitle.trim(),
          description: featureDescription.trim(),
          photoUrl: featurePhotoUrl.trim() || undefined,
          sourceUrl: item.postUrl || undefined,
          sourceItemId: item.id,
          postedAt: item.postedAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeatureMsg((prev) => ({ ...prev, [item.id]: data.error || "確認失敗" }));
      } else {
        setFeatureMsg((prev) => ({ ...prev, [item.id]: "已上首頁「這裡真好玩」區塊" }));
        setFeatureFormId(null);
        setFeaturedItemIds((prev) => new Set(prev).add(item.id));
        loadItems();
      }
    } catch (error) {
      setFeatureMsg((prev) => ({ ...prev, [item.id]: String(error) }));
    } finally {
      setFeatureSubmitting(false);
    }
  }

  async function featureAll() {
    setFeatureAllSubmitting(true);
    setFeatureAllMsg("");
    try {
      const res = await fetch("/api/content-sync/feature-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setFeatureAllMsg(data.error || "批次確認失敗");
      } else {
        setFeatureAllMsg(data.needsApproval ? `已發布 ${data.created} 則。另有 ${data.needsApproval} 則尚未在營運後台核准，沒有上首頁。` : `已發布 ${data.created} 則到首頁，略過 ${data.skipped} 則（無照片或已處理過）`);
        loadFeaturedStatus();
        loadItems();
      }
    } catch (error) {
      setFeatureAllMsg(String(error));
    } finally {
      setFeatureAllSubmitting(false);
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
    <div id="content-sync-top" className="min-h-[calc(100vh-160px)] text-slate-100 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href="/admin"
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-all"
        >
          ← 回後台首頁
        </a>
        <a
          href="/"
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-all"
        >
          回官網首頁
        </a>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider">weekly content sync</p>
        <h1 className="text-xl font-bold text-amber-400 mt-1">社群內容同步清單</h1>
        <p className="text-xs text-slate-500 mt-2">
          每週彙整粉專「小羽旅遊趣」新貼文，勾選要生成草稿的項目——勾選送出才會進入內容工廠審核佇列，不會自動發布。
          每則項目也可以獨立按「確認上首頁」，直接發布到首頁「這裡真好玩」區塊，跟生成草稿是兩件互不影響的事。
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
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-base font-medium text-slate-200">本週待選清單</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={featureAll}
              disabled={featureAllSubmitting}
              className="px-3 py-1.5 rounded-lg text-xs border border-sky-500/40 text-sky-300 hover:border-sky-400 hover:text-sky-200 transition-all disabled:opacity-50"
            >
              {featureAllSubmitting ? "發布中…" : "全部確認上首頁"}
            </button>
            <button
              type="button"
              onClick={pullNow}
              disabled={pulling}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-all disabled:opacity-50"
            >
              {pulling ? "拉取中…" : "立即拉取粉專貼文"}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          「全部確認上首頁」只會發布有照片、還沒個別處理過的項目，標題自動從摘要生成，直接發布不用逐則確認。
        </p>
        {featureAllMsg ? <p className="text-xs text-slate-400 mb-4">{featureAllMsg}</p> : null}
        {pullMsg ? <p className="text-xs text-slate-400 mb-4">{pullMsg}</p> : null}

        <div className="flex gap-2 mb-4 flex-wrap" role="tablist" aria-label="清單分類">
          {LIST_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={listTab === t.key}
              onClick={() => switchTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                listTab === t.key
                  ? "border-amber-500/60 text-amber-300 bg-amber-500/10"
                  : "border-slate-700 text-slate-400 hover:border-amber-500/60 hover:text-amber-300"
              }`}
            >
              {t.label}（{listCounts[t.key]}）
            </button>
          ))}
        </div>
        {listTab === "archived" ? (
          <p className="text-xs text-slate-500 mb-4">已移除的項目資料都還在，按「還原」會回到「待處理」。每週拉取不會把已移除的貼文重新加回來。</p>
        ) : null}
        {listMsg ? <p className="text-xs text-slate-400 mb-4">{listMsg}</p> : null}

        {items.length === 0 ? (
          <p className="text-xs text-slate-600 py-8 text-center">
            {listTab === "archived" ? "目前沒有已移除的項目" : listTab === "featured" ? "目前沒有已上首頁的項目" : "目前沒有待選項目"}
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {items.map((item) => {
              const src = SOURCE_LABELS[item.sourceType] || SOURCE_LABELS.manual;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700"
                >
                  {listTab !== "archived" ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1"
                      aria-label="選取送出產生草稿"
                    />
                  ) : null}
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

                    <div className="mt-2">
                      {listTab === "archived" ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {featuredItemIds.has(item.id) ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] border border-emerald-500/40 text-emerald-300">
                              ✓ 首頁卡片照舊保留
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => archiveItem(item, true)}
                            disabled={archivingId === item.id}
                            className="px-3 py-1 rounded-lg text-[11px] border border-amber-500/40 text-amber-300 hover:border-amber-400 hover:text-amber-200 transition-all disabled:opacity-50"
                          >
                            {archivingId === item.id ? "還原中…" : "還原"}
                          </button>
                        </div>
                      ) : featuredItemIds.has(item.id) ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] border border-emerald-500/40 text-emerald-300">
                          ✓ 已上首頁
                        </span>
                      ) : featureFormId === item.id ? (
                        <div className="space-y-2 bg-slate-900 border border-slate-800 rounded-lg p-3">
                          <input
                            value={featureTitle}
                            onChange={(e) => setFeatureTitle(e.target.value)}
                            placeholder="標題／地點（例如：內洞、蝴蝶谷）"
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                          <textarea
                            value={featureDescription}
                            onChange={(e) => setFeatureDescription(e.target.value)}
                            rows={2}
                            placeholder="一句話說明"
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                          {featurePhotoUrl ? (
                            <div>
                              <p className="text-[11px] text-slate-500 mb-1">
                                將沿用原貼文照片，確認發布代表你同意使用這張照片：
                              </p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={featurePhotoUrl}
                                alt="原貼文照片預覽"
                                className="max-h-40 rounded border border-slate-800"
                              />
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500">
                              這則貼文沒有留存照片，將以純文字卡片上首頁。
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => confirmFeature(item)}
                              disabled={featureSubmitting || !featureTitle.trim() || !featureDescription.trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 disabled:opacity-50"
                            >
                              {featureSubmitting ? "送出中…" : "確認發布"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelFeatureForm}
                              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-400 hover:border-slate-600"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openFeatureForm(item)}
                          className="px-3 py-1 rounded-lg text-[11px] border border-sky-500/40 text-sky-300 hover:border-sky-400 hover:text-sky-200 transition-all"
                        >
                          確認上首頁
                        </button>
                      )}
                      {listTab !== "archived" && featureFormId !== item.id ? (
                        <button
                          type="button"
                          onClick={() => archiveItem(item)}
                          disabled={archivingId === item.id}
                          className="ml-2 px-3 py-1 rounded-lg text-[11px] border border-red-500/40 text-red-400 hover:border-red-400 hover:text-red-300 transition-all disabled:opacity-50"
                        >
                          {archivingId === item.id ? "移除中…" : "移除"}
                        </button>
                      ) : null}
                      {featureMsg[item.id] ? (
                        <p className="text-[11px] text-slate-400 mt-1">{featureMsg[item.id]}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {listTotalPages > 1 ? (
          <div className="flex items-center justify-center gap-1 mb-4 flex-wrap" aria-label="分頁">
            <button
              type="button"
              onClick={() => goToPage(listPage - 1)}
              disabled={listPage <= 1}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-all disabled:opacity-40"
            >
              上一頁
            </button>
            {pageNumbers(listPage, listTotalPages).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => goToPage(p)}
                aria-current={p === listPage ? "page" : undefined}
                className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs border transition-all ${
                  p === listPage
                    ? "border-amber-500/60 text-amber-300 bg-amber-500/10"
                    : "border-slate-700 text-slate-400 hover:border-amber-500/60 hover:text-amber-300"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goToPage(listPage + 1)}
              disabled={listPage >= listTotalPages}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-all disabled:opacity-40"
            >
              下一頁
            </button>
            <span className="text-[11px] text-slate-500 ml-2">
              第 {listPage} / {listTotalPages} 頁
            </span>
          </div>
        ) : null}

        {listTab !== "archived" ? (
          <button
            type="button"
            onClick={submitSelected}
            disabled={submitting || selectedIds.size === 0}
            className="px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all disabled:opacity-50"
          >
            {submitting ? "送出中…" : `送出勾選項目產生草稿（${selectedIds.size}）`}
          </button>
        ) : null}
        {submitMsg ? <p className="text-xs text-slate-400 mt-3">{submitMsg}</p> : null}
        <div className="mt-6 text-right">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-300 hover:border-amber-500/60 hover:text-amber-300 transition-all"
          >
            ↑ 回頂端
          </button>
        </div>
      </div>
    </div>
  );
}
