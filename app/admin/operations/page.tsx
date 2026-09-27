"use client";

import { useEffect, useState } from "react";
import styles from "./Operations.module.css";
import type { ContentRecord, OperationsPlatform } from "@/lib/operations/types";

const platformLabels: Record<OperationsPlatform, string> = {
  website: "官網預覽",
  facebook_group: "Facebook 社團",
  instagram: "Instagram",
};

function todayTaipei() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("讀取圖片失敗"));
    reader.readAsDataURL(file);
  });
}

export default function OperationsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [contents, setContents] = useState<ContentRecord[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"招生" | "回顧">("招生");
  const [tripDate, setTripDate] = useState(todayTaipei());
  const [body, setBody] = useState("");
  const [platforms, setPlatforms] = useState<OperationsPlatform[]>(["website", "facebook_group", "instagram"]);
  const [images, setImages] = useState<{ dataUrl: string; originalName: string }[]>([]);
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [manualResults, setManualResults] = useState<Record<string, { externalId: string; postUrl: string }>>({});

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "請求失敗");
    return data as { contents?: ContentRecord[]; content?: ContentRecord; results?: unknown[]; error?: string };
  }

  async function load() {
    if (!authenticated) return;
    try {
      const data = await request("/api/operations/content", { headers: {} });
      setContents(data.contents || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "讀取營運草稿失敗");
    }
  }

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("未登入");
        setAuthenticated(true);
      })
      .catch(() => { window.location.href = "/admin"; });
  }, []);

  useEffect(() => {
    void load();
    // load is intentionally called after the token is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  async function selectImages(event: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(event.target.files || []);
    if (files.length > 6) {
      setError("最多選擇 6 張圖片");
      return;
    }
    try {
      const next = [];
      for (const file of files) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("只接受 JPEG、PNG 或 WebP");
        if (file.size > 8 * 1024 * 1024) throw new Error("單張圖片不可超過 8 MB");
        next.push({ dataUrl: await fileToDataUrl(file), originalName: file.name });
      }
      if (next.reduce((total, item) => total + Math.ceil(item.dataUrl.length * 0.75), 0) > 20 * 1024 * 1024) {
        throw new Error("全部圖片不可超過 20 MB");
      }
      setImages(next);
    } catch (selectionError) {
      setImages([]);
      setError(selectionError instanceof Error ? selectionError.message : "圖片讀取失敗");
    }
  }

  function togglePlatform(platform: OperationsPlatform) {
    setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);
  }

  async function createDraft() {
    setBusy(true); setError(""); setMessage("");
    try {
      await request("/api/operations/content", { method: "POST", body: JSON.stringify({ title, type, tripDate, body, selectedPlatforms: platforms, images }) });
      setMessage("草稿已保存，三個平台版本已生成；目前尚未對外發布。");
      setTitle(""); setBody(""); setImages([]); setSchedule("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "草稿保存失敗");
    } finally { setBusy(false); }
  }

  async function approve(content: ContentRecord) {
    setBusy(true); setError(""); setMessage("");
    try {
      const scheduledAt = schedule ? new Date(`${schedule}:00+08:00`).toISOString() : undefined;
      await request(`/api/operations/content/${encodeURIComponent(content.id)}/approve`, { method: "POST", body: JSON.stringify({ scheduledAt }) });
      setMessage(`${content.id} 已核准；每個平台都有獨立工作與去重識別碼。`);
      await load();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "核准失敗");
    } finally { setBusy(false); }
  }

  async function dryRun(jobId: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await request(`/api/operations/jobs/${encodeURIComponent(jobId)}/run`, { method: "POST", body: JSON.stringify({ mode: "dry-run" }) });
      setMessage("乾跑完成：已驗證 adapter、工作鎖與去重流程，未發出公開貼文。");
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "工作執行失敗");
    } finally { setBusy(false); }
  }

  async function processDue() {
    setBusy(true); setError(""); setMessage("");
    try {
      await request("/api/operations/process-due", { method: "POST", body: "{}" });
      setMessage("已處理到期工作；預設為乾跑，不會向公開平台發送內容。");
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "排程處理失敗");
    } finally { setBusy(false); }
  }

  async function saveManualResult(jobId: string) {
    const value = manualResults[jobId] || { externalId: "", postUrl: "" };
    setBusy(true); setError(""); setMessage("");
    try {
      await request(`/api/operations/jobs/${encodeURIComponent(jobId)}/manual-result`, { method: "POST", body: JSON.stringify(value) });
      setMessage("Facebook 社團外部 ID／網址已回填；請再開啟連結人工核對，系統不把回填本身當成自動發布成功。");
      await load();
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : "人工回填失敗");
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a href="/admin" className={styles.back}>返回管理首頁</a>
          <p className={styles.eyebrow}>8940 OPERATIONS · ASIA/TAIPEI</p>
          <h1 className={styles.title}>浮雲營運作業</h1>
          <p className={styles.subtitle}>手機一次收件、逐平台預覽、老闆核准後才進入發布工作。</p>
        </div>
        <button type="button" className={styles.secondary} onClick={() => void processDue()} disabled={busy}>處理到期工作</button>
      </header>

      <section className={styles.panel} aria-label="行程發布收件">
        <h2 className={styles.panelTitle}>行程發布收件</h2>
        <p className={styles.notice}>價格、名額、集合時間與服務承諾只會照你輸入的內容帶出；系統不自行猜測。Facebook 這裡鎖定「社團」手動核對路徑，不套用粉專 API。</p>
        <div className={styles.grid}>
          <label className={styles.field}><span className={styles.label}>標題</span><input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：阿里山日出包車行程" /></label>
          <label className={styles.field}><span className={styles.label}>內容類型</span><select className={styles.select} value={type} onChange={(event) => setType(event.target.value as "招生" | "回顧")}><option value="招生">行程招生</option><option value="回顧">出遊回顧</option></select></label>
          <label className={styles.field}><span className={styles.label}>實際出遊／預定出發日期</span><input className={styles.input} type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} /></label>
          <div className={styles.field}><span className={styles.label}>發布平台</span><div className={styles.checks}>{(Object.keys(platformLabels) as OperationsPlatform[]).map((platform) => <label key={platform} className={styles.check}><input type="checkbox" checked={platforms.includes(platform)} onChange={() => togglePlatform(platform)} />{platformLabels[platform]}</label>)}</div></div>
          <label className={`${styles.field} ${styles.fieldWide}`}><span className={styles.label}>行程文字／正式資料</span><textarea className={styles.textarea} value={body} onChange={(event) => setBody(event.target.value)} placeholder="貼上已確認的路線、日期、價格、名額與注意事項；招生與回顧請分開寫。" /></label>
          <label className={`${styles.field} ${styles.fieldWide}`}><span className={styles.label}>照片（可多選，Android 可直接拍照）</span><input className={styles.input} type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" onChange={(event) => void selectImages(event)} /><span className={styles.hint}>最多 6 張；單張 8 MB、總量 20 MB。原始檔會留在 8940 的營運資料夾。</span></label>
        </div>
        {images.length ? <div className={styles.photos}>{images.map((image) => <img key={image.originalName} src={image.dataUrl} alt={image.originalName} className={styles.photo} />)}</div> : null}
        <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => void createDraft()} disabled={busy || !authenticated}>保存草稿並生成三版</button></div>
        {message ? <p className={styles.message}>{message}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>

      <section className={styles.panel} aria-label="草稿與發布結果">
        <h2 className={styles.panelTitle}>草稿、核准與逐平台結果</h2>
        <p className={styles.notice}>「乾跑」只驗證本機流程，不代表公開平台已發布。正式官網、Facebook 社團與 Instagram 的對外驗證會分開顯示。</p>
        {!contents.length ? <p className={styles.empty}>尚無營運草稿。</p> : contents.map((content) => (
          <article key={content.id} className={styles.record}>
            <div className={styles.recordTop}><div><h3 className={styles.recordTitle}>{content.title}</h3><span className={styles.meta}>{content.id} · {content.type} · 日期 {content.tripDate} · 圖片 {content.images.length} 張</span></div><span className={styles.badge}>{content.status}／核准：{content.approval.status}</span></div>
            <div className={styles.platformGrid}>{content.selectedPlatforms.map((platform) => { const job = content.platforms[platform]; const manual = manualResults[job.jobId] || { externalId: job.externalId || "", postUrl: job.postUrl || "" }; return <div key={platform} className={styles.platform}><div className={styles.platformName}>{platformLabels[platform]}</div><div className={styles.status}>狀態：{job.status}<br />嘗試：{job.attempts} · 驗證：{job.verification}<br />Job：{job.jobId}</div><pre className={styles.caption}>{job.caption}</pre><div className={styles.platformActions}>{content.approval.status === "approved" ? <button type="button" className={styles.smallButton} onClick={() => void dryRun(job.jobId)} disabled={busy}>乾跑此平台</button> : null}{job.lastError ? <span className={styles.status}>{job.lastError}</span> : null}</div>{platform === "facebook_group" && content.approval.status === "approved" ? <div className={styles.field}><span className={styles.label}>人工貼文回填（完成後開啟網址核對）</span><input className={styles.input} value={manual.externalId} onChange={(event) => setManualResults((current) => ({ ...current, [job.jobId]: { ...manual, externalId: event.target.value } }))} placeholder="Facebook 外部 ID" /><input className={styles.input} value={manual.postUrl} onChange={(event) => setManualResults((current) => ({ ...current, [job.jobId]: { ...manual, postUrl: event.target.value } }))} placeholder="https://www.facebook.com/..." /><button type="button" className={styles.smallButton} onClick={() => void saveManualResult(job.jobId)} disabled={busy}>保存人工回填</button>{job.postUrl ? <a className={styles.hint} href={job.postUrl} target="_blank" rel="noreferrer">開啟已回填貼文</a> : null}</div> : null}</div>; })}</div>
            {content.approval.status !== "approved" ? <div className={styles.actions}><label className={styles.field}><span className={styles.label}>核准後排程（選填，台北時間）</span><input className={styles.input} type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label><button type="button" className={styles.primary} onClick={() => void approve(content)} disabled={busy}>核准此版本</button></div> : <span className={styles.hint}>已核准版本不可原地覆寫；修改請建立新版本草稿。</span>}
          </article>
        ))}
      </section>
    </main>
  );
}
