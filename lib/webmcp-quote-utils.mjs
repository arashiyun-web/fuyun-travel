/**
 * webmcp-quote-utils.mjs — 純邏輯模組（Node + 瀏覽器通用，零外部依賴）
 *
 * 被使用方：
 *  1. components/WebMCPQuoteTool.tsx — WebMCP imperative tool get_quote + 人類表單
 *  2. scripts/test-webmcp-quote.mjs  — Node 單元測試（Node 直接 import）
 *
 * 浮雲報價模型（見 Qdrant fuyun-travel/pricing.md + solo_company_ops skill）：
 *  「報價需確認日期 / 人數 / 行李 / 出發地 / 目的地 / 停留點 / 用車時間 / 跨日」
 *  **不做** 自動計價（無硬數字來源，不得憑記憶造價）。
 *  **只做** 欄位校驗 + 產出草稿 + 一鍵 LINE 深連結（零金流，human-in-the-loop）。
 */

import { LINE_OA_ID, lineOaMessageUrl, lineProfileUrl } from "./config/line.mjs";

// 與官網 LINE 按鈕同一來源（lib/config/line.mjs）
export const LINE_OA_CODE = LINE_OA_ID;
export const LINE_BASE = lineProfileUrl(LINE_OA_CODE);
export const FALLBACK_EMAIL = "yunyi6866@gmail.com";

function phoneOk(s) {
  const t = String(s || "").trim();
  if (!t) return null;
  if (!/^[+0-9][0-9\-\s]{5,19}$/.test(t)) return null;
  return t.replace(/[^\d+]/g, "");
}
/** Today in the business timezone (Asia/Taipei) as YYYY-MM-DD. */
export function todayInTaipei(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function dayOk(s) {
  const t = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [ys, ms, ds] = t.split("-").map(Number);
  const d = Date.UTC(ys, ms - 1, ds);
  if (isNaN(d)) return null;
  // round-trip 存在性驗證：JS Date 會把 2026-02-30 rollover 成 3/2。
  // 組回去若 y/m/d 與原值不符 → 該日期不存在 → 拒絕。
  const y = new Date(d).getUTCFullYear();
  const mm = new Date(d).getUTCMonth() + 1;
  const dd = new Date(d).getUTCDate();
  if (y !== ys || mm !== ms || dd !== ds) return null;
  if (y < 2020 || y > 2120) return null;
  return t;
}
function partyOk(s) {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 60) return null;
  return n;
}
function textOk(s, max = 160) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (t.length > max) return null; // 校驗函式：過長即拒絕（不靜默截斷）
  return t;
}

/**
 * 校驗 + 正規化報價請求。回傳 { ok, errors, normalized }
 * errors 為字串陣列；ok=true 時 errors 為空。
 */
export function validateQuote({ from, to, date, party } = {}, { today = todayInTaipei() } = {}) {
  const errors = [];
  const nf = textOk(from, 80);
  const nt = textOk(to, 80);
  const validDay = dayOk(date);
  // ISO YYYY-MM-DD strings compare correctly as text.
  const nd = validDay && validDay >= today ? validDay : null;
  const np = partyOk(party);
  if (!nf) errors.push("from 為空或過長（需 1-80 字）");
  if (!nt) errors.push("to 為空或過長（需 1-80 字）");
  if (!validDay) errors.push("date 需為 YYYY-MM-DD 且該日期存在");
  else if (!nd) errors.push(`date 不可早於今天（${today}，台灣時間）`);
  if (!np) errors.push("party 需為 1-60 的整數");
  return { ok: errors.length === 0, errors, normalized: { from: nf, to: nt, date: nd, party: np } };
}

/** 產出草稿內文（送 LINE / 或 mailto 兜底） */
export function buildQuoteMessage({ from, to, date, party, luggage, notes, contactName, contactPhone } = {}) {
  const v = { from: textOk(from, 80) ?? "", to: textOk(to, 80) ?? "", date: dayOk(date) ?? "", party: partyOk(party) };
  const lines = [
    "【浮雲包車報價請求】",
    `出發地: ${v.from}`,
    `目的地: ${v.to}`,
    `日期: ${v.date}`,
    `人數: ${v.party == null ? "" : v.party + " 人"}`,
  ];
  const l = luggage == null ? "" : String(luggage).trim();
  if (l) lines.push(`行李件數: ${l.slice(0, 20)}`);
  const n = notes == null ? "" : String(notes).trim();
  if (n) lines.push(`備註: ${n.slice(0, 160)}`);
  lines.push("---");
  lines.push(`聯絡人: ${contactName ? String(contactName).trim().slice(0, 40) : "(未填)"}  ${phoneOk(contactPhone) || ""}`);
  return lines.join("\n");
}

/** LINE 官方 oaMessage 預填連結（僅 iOS/Android LINE 支援；空訊息回官方帳號頁） */
export function buildLineUrl(message) {
  return lineOaMessageUrl(message, LINE_OA_CODE);
}

/** mailto 兜底（LINE 未開啟或使用者無 LINE） */
export function buildMailto(message, subject = "浮雲包車報價請求") {
  const m = String(message ?? "").trim();
  return `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(m)}`;
}
