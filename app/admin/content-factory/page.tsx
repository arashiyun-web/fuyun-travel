"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ContentFactory.module.css";
import { applyChannelEdits, editableChannelText } from "@/lib/content-factory/editor";
import type { ContentFactoryInput, GeneratedContent } from "@/lib/content-factory/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type InputMode = "brief" | "fb";

interface PublishedSource {
  id: string;
  title: string;
  description: string;
  image_urls: string[];
  cover_image_url: string;
}

interface UploadedImage {
  url: string;
  isCover: boolean;
}

// ─── Channel definitions ──────────────────────────────────────────────────────

const CHANNELS = [
  { key: "geo_summary",  label: "GEO 精華摘要" },
  { key: "seo_article",  label: "SEO 長文" },
  { key: "facebook",     label: "Facebook 貼文" },
  { key: "instagram",    label: "Instagram" },
  { key: "x",            label: "X" },
  { key: "line_oa",      label: "LINE OA 推播" },
  { key: "edm",          label: "EDM 電子報" },
  { key: "extras",       label: "加值內容" },
  { key: "json_ld",      label: "JSON-LD Schema" },
] as const;

type ChannelKey = typeof CHANNELS[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function channelText(content: GeneratedContent, key: ChannelKey): string {
  switch (key) {
    case "geo_summary":
      return content.geo_summary || "";
    case "seo_article":
      return [
        `# ${content.seo_article?.h1 || ""}`,
        "",
        content.seo_article?.body_markdown || "",
        "",
        "---",
        "**FAQ**",
        ...(content.seo_article?.faq || []).map((f) => `Q: ${f.q}\nA: ${f.a}`),
      ].join("\n");
    case "facebook":
      return [
        content.facebook?.body || "",
        "",
        "【行程資訊】",
        ...Object.entries(content.facebook?.info_table || {}).map(([k, v]) => `${k}：${v}`),
      ].join("\n");
    case "instagram":
      return [
        content.instagram?.caption || "",
        "",
        (content.instagram?.hashtags || []).join(" "),
      ].join("\n");
    case "x":
      return content.x?.body || "";
    case "line_oa":
      return content.line_oa || "";
    case "edm":
      return `主旨：${content.edm?.subject || ""}\n\n${content.edm?.body || ""}`;
    case "extras":
      return [
        `【Google 商家短評】\n${content.extras?.gmb_short || ""}`,
        "",
        `【AI 問答】\n${(content.extras?.ai_qa_block || []).map((x) => `Q: ${x.q}\nA: ${x.a}`).join("\n")}`,
        "",
        `【A/B 測試 — FB】\nA: ${content.extras?.ab_test?.fb?.[0] || ""}\nB: ${content.extras?.ab_test?.fb?.[1] || ""}`,
        "",
        `【A/B 測試 — IG】\nA: ${content.extras?.ab_test?.ig?.[0] || ""}\nB: ${content.extras?.ab_test?.ig?.[1] || ""}`,
      ].join("\n");
    case "json_ld":
      return content.json_ld || "";
    default:
      return "";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContentFactoryPage() {
  const [token, setToken] = useState("");
  const [sources, setSources] = useState<PublishedSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [mode, setMode] = useState<InputMode>("brief");

  // 簡述模式欄位
  const [briefTitle, setBriefTitle] = useState("");
  const [briefDesc, setBriefDesc] = useState("");

  // FB 原文模式
  const [fbText, setFbText] = useState("");

  // 選填欄位
  const [days, setDays] = useState("");
  const [season, setSeason] = useState("");
  const [price, setPrice] = useState("");
  const [audience, setAudience] = useState("");

  // 圖片
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 生成狀態
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genRaw, setGenRaw] = useState("");

  // 生成結果
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [resultInput, setResultInput] = useState<ContentFactoryInput | null>(null);
  const [editedChannels, setEditedChannels] = useState<Partial<Record<ChannelKey, string>>>({});
  const [activeChannel, setActiveChannel] = useState<ChannelKey>("geo_summary");

  // 儲存草稿
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("admin_token") || "";
    setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch("/api/content-factory/sources", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "素材載入失敗");
        setSources(data.sources || []);
      })
      .catch((error) => { if (!controller.signal.aborted) setSourceError(error instanceof Error ? error.message : "素材載入失敗"); });
    return () => controller.abort();
  }, [token]);

  // ── Image upload ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setUploadError("");
    const urls: string[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("image", file);
      try {
        const res = await fetch("/api/content-factory/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "圖片上傳失敗");
        urls.push(data.url);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "圖片上傳失敗");
      }
    }
    setImages((prev) => {
      const next = [...prev];
      for (const url of urls) {
        const isCover = next.length === 0;
        next.push({ url, isCover });
      }
      return next;
    });
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setCover(url: string) {
    setImages((prev) => prev.map((img) => ({ ...img, isCover: img.url === url })));
  }

  function removeImage(url: string) {
    setImages((prev) => {
      const next = prev.filter((img) => img.url !== url);
      if (next.length > 0 && !next.some((img) => img.isCover)) {
        next[0] = { ...next[0], isCover: true };
      }
      return next;
    });
  }

  const coverUrl = images.find((img) => img.isCover)?.url || "";
  const hasCover = !!coverUrl;

  // ── Generate ──────────────────────────────────────────────────────────────

  async function handleGenerate(featuredSpotId?: string) {
    setGenError("");
    setGenRaw("");
    setResult(null);
    setSavedId("");
    setSaveError("");
    setSaveWarning("");

    const userNotes = mode === "fb" ? fbText : briefDesc;
    if (!featuredSpotId && !userNotes.trim()) {
      setGenError("請先輸入行程描述或 FB 原文。");
      return;
    }

    const payload: Partial<ContentFactoryInput> = featuredSpotId ? { featured_spot_id: featuredSpotId } : {
      trip_title: mode === "brief" ? briefTitle : "",
      days,
      season,
      price,
      spots: [],
      user_notes: userNotes,
      target_audience: audience,
      additional_info: "",
      image_urls: images.map((img) => img.url),
      cover_image_url: coverUrl,
    };

    setGenerating(true);
    try {
      const res = await fetch("/api/content-factory/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setGenError(data.error || "生成失敗");
        setGenRaw(data.raw || "");
        return;
      }
      setResult(data.generated as GeneratedContent);
      setResultInput(data.input as ContentFactoryInput);
      setSavedId(data.draftId);
      setSaveWarning("文案已存為草稿，請人工檢查各平台內容。");
      setEditedChannels({});
      setActiveChannel("geo_summary");
    } catch (err) {
      setGenError(String(err));
    } finally {
      setGenerating(false);
    }
  }

  // ── Channel edit ──────────────────────────────────────────────────────────

  function getChannelValue(key: ChannelKey): string {
    if (editedChannels[key] !== undefined) return editedChannels[key]!;
    return result ? editableChannelText(result, key) : "";
  }

  function handleChannelEdit(key: ChannelKey, value: string) {
    setEditedChannels((prev) => ({ ...prev, [key]: value }));
    setSavedId("");
  }

  async function copyChannel(key: ChannelKey) {
    try {
      if (result) await navigator.clipboard.writeText(channelText(applyChannelEdits(result, editedChannels), key));
    } catch {
      // clipboard not available
    }
  }

  // ── Save draft ────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!result || !resultInput) return;
    setSaving(true);
    setSaveError("");
    setSaveWarning("");
    try {
      const res = await fetch("/api/content-factory/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ input: resultInput, output: applyChannelEdits(result, editedChannels) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveError(data.error || "儲存失敗");
        return;
      }
      setSavedId(data.draft?.id || "saved");
      if (data.warning) setSaveWarning(data.warning);
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Auth guard ────────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-160px)] flex items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-sm">請先登入管理後台。</p>
          <a href="/admin" className="text-amber-400 hover:text-amber-300 text-sm font-bold">
            前往登入 →
          </a>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-160px)] text-slate-100 space-y-6 pb-12">

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <p className="text-xs text-slate-500 uppercase tracking-wider">content factory</p>
        <h1 className="text-xl font-bold text-amber-400 mt-1">AI 內容工廠</h1>
        <p className="text-xs text-slate-500 mt-2">
          上傳照片 + 輸入簡述或貼上 FB 原文 → 一次產出六大渠道草稿 → 人工審核後發布。
          AI 絕不自動發布，所有產出皆為草稿。
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">輸入來源</h2>

        <div className="space-y-3">
          <label htmlFor="featured-source" className="text-xs text-slate-400 block">選一篇已發布的「這裡真好玩」</label>
          <select id="featured-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)} disabled={generating}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200">
            <option value="">請選擇素材</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
          </select>
          {sourceError && <p role="alert" className="text-xs text-red-400">{sourceError}</p>}
          {!sourceError && sources.length === 0 && <p className="text-xs text-slate-500">目前沒有可選素材，可使用下方行程簡述。</p>}
          {sources.filter((source) => source.id === sourceId).map((source) => (
            <div key={source.id} className="space-y-2">
              <p className="text-xs text-slate-400 whitespace-pre-wrap">{source.description}</p>
              <div className="flex gap-2 flex-wrap">
                {/* Existing authorized image hosts vary; keep the source URL without an optimization fetch. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {source.image_urls.map((url) => <img key={url} src={url} alt={`${source.title} 素材`} width={96} height={72} className="object-cover rounded-lg" />)}
              </div>
              {!source.image_urls.length && <p className="text-xs text-yellow-500">素材沒有可用的公開圖片；文案仍可存為草稿。</p>}
            </div>
          ))}
          <button type="button" onClick={() => handleGenerate(sourceId)} disabled={!sourceId || generating}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-50">
            {generating ? "AI 生成中…" : "一鍵生成各平台草稿"}
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {(["brief", "fb"] as InputMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all ${
                mode === m
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {m === "brief" ? "簡述模式" : "FB 原文模式"}
            </button>
          ))}
        </div>

        {/* Text inputs */}
        {mode === "brief" ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">行程標題</label>
              <input
                type="text"
                value={briefTitle}
                onChange={(e) => setBriefTitle(e.target.value)}
                placeholder="例：大溪龍潭油桐花一日遊"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">行程簡述</label>
              <textarea
                value={briefDesc}
                onChange={(e) => setBriefDesc(e.target.value)}
                rows={5}
                placeholder="例：4-5月桐花季，賞桐花走步道吃老街小吃，適合長輩與親子家庭，大溪老街午餐，龍潭大池漫步。"
                className={`${styles.channelTextarea} w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500`}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-slate-400 block mb-1">貼上 FB 原文</label>
            <textarea
              value={fbText}
              onChange={(e) => setFbText(e.target.value)}
              rows={10}
              placeholder="將整篇 Facebook 貼文貼於此處，AI 將自動解析行程資訊…"
              className={`${styles.channelTextarea} w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500`}
            />
          </div>
        )}

        {/* Optional fields */}
        <div>
          <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">選填欄位（可讓 AI 跳過解析、直接使用）</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "天數", value: days, set: setDays, placeholder: "例：一日遊" },
              { label: "季節", value: season, set: setSeason, placeholder: "例：4-5月桐花季" },
              { label: "價格（空白→LINE詢價）", value: price, set: setPrice, placeholder: "例：1800" },
              { label: "適合族群", value: audience, set: setAudience, placeholder: "例：長輩、親子" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="text-xs text-slate-400 block mb-1">{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Image upload */}
        <div>
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">照片上傳</p>
          <div
            className={`${styles.uploadZone} border border-dashed border-slate-700 rounded-xl p-5 text-center cursor-pointer`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploading ? (
              <p className="text-xs text-amber-400">上傳中…</p>
            ) : (
              <p className="text-xs text-slate-500">
                點擊選取照片（支援多張，JPG / PNG / WebP，上限 10 MB/張）
              </p>
            )}
          </div>

          {uploadError && <p role="alert" className="text-xs text-red-400 mt-2">{uploadError}</p>}
          {!hasCover && images.length === 0 && (
            <p className="text-xs text-yellow-500 mt-2">
              ⚠ 未上傳封面圖片 — 草稿可儲存，但不可進入 ready 狀態。
            </p>
          )}

          {images.length > 0 && (
            <div className={styles.thumbnailGrid}>
              {images.map((img) => (
                <div
                  key={img.url}
                  className={`${styles.thumbnail} ${img.isCover ? styles.thumbnailCover : ""}`}
                  onClick={() => setCover(img.url)}
                  title="點擊設為封面"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className={styles.thumbnailImg} />
                  {img.isCover && <span className={styles.coverBadge}>封面</span>}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={(e) => { e.stopPropagation(); removeImage(img.url); }}
                    title="移除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Generate button */}
        <div className="flex items-center gap-4 pt-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={generating}
            className="px-6 py-3 rounded-xl text-sm font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "AI 生成中…" : "生成草稿"}
          </button>
          {generating ? (
            <p className="text-xs text-slate-400">
              AI 文案生成中，預計等待約 <span className="text-amber-400 font-medium">1–2 分鐘</span>，請勿關閉頁面。
            </p>
          ) : !price ? (
            <p className="text-xs text-slate-500">價格未填 → CTA 自動導向 LINE 詢價</p>
          ) : null}
        </div>

        {genError && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs space-y-1">
            <p>{genError}</p>
            {genRaw && (
              <details>
                <summary className="cursor-pointer text-slate-500">查看原始回傳</summary>
                <pre className="mt-2 text-slate-400 whitespace-pre-wrap break-all text-xs">{genRaw}</pre>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Result Section */}
      {result && (
        <div className={`${styles.resultFadeIn} bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">生成結果</p>
              <h2 className="text-base font-bold text-amber-400 mt-0.5">
                {result.meta?.trip_title || "未命名行程"}
              </h2>
              {result.meta?.missing_fields?.length > 0 && (
                <p className="text-xs text-yellow-500 mt-1">
                  ⚠ 待補欄位：{result.meta.missing_fields.join("、")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {savedId ? (
                <span className="text-xs text-emerald-400 font-bold">
                  ✓ 已存草稿 {savedId}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 transition-all disabled:opacity-50"
                >
                  {saving ? "儲存中…" : "存為草稿"}
                </button>
              )}
            </div>
          </div>

          {saveError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs">
              {saveError}
            </div>
          )}
          {saveWarning && (
            <div className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-xs">
              ⚠ {saveWarning}
            </div>
          )}

          {/* Keywords */}
          {result.meta?.generated_keywords && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">關鍵字</p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {result.meta.generated_keywords.primary?.map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">{k}</span>
                ))}
                {result.meta.generated_keywords.secondary?.map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">{k}</span>
                ))}
                {result.meta.generated_keywords.long_tail?.map((k) => (
                  <span key={k} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* Channel tabs */}
          <div className="overflow-x-auto flex gap-2 pb-1">
            {CHANNELS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveChannel(key)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeChannel === key
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Active channel content */}
          {CHANNELS.map(({ key, label }) =>
            activeChannel === key ? (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-medium">{label}</p>
                  <button
                    type="button"
                    onClick={() => copyChannel(key)}
                    className="text-xs text-slate-500 hover:text-amber-400 transition-colors px-2 py-1 rounded border border-slate-800 hover:border-amber-500/40"
                  >
                    複製
                  </button>
                </div>
                <p className="text-xs text-slate-500">編輯主文；複製時保留原有資訊表、FAQ、標籤與主旨。加值內容可編輯商家短評。</p>
                <textarea
                  value={getChannelValue(key)}
                  onChange={(e) => handleChannelEdit(key, e.target.value)}
                  className={`${styles.channelTextarea} w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500`}
                  rows={key === "seo_article" ? 20 : key === "edm" ? 16 : 10}
                />
              </div>
            ) : null,
          )}

          {/* Reminder: no publish button */}
          <p className="text-xs text-slate-600 text-center pt-2">
            草稿已儲存後，請至審核佇列由人工確認後再發布。本工具不提供直接發布功能。
          </p>
        </div>
      )}
    </div>
  );
}
