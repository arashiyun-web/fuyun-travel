/**
 * webmcp-tool.mjs — WebMCP imperative tool「get_quote」的定義 + 執行邏輯（純 JS，Node/瀏覽器通用）
 *
 * 抽出來的原因：component 只做 2 件事（useEffect 註冊 + 人類表單 UI），
 * 但「tool 是什麼、agent 調用它會得到什麼」應該能單獨被 Node 測到。
 * 抽出後：scripts/harness-webmcp.mjs 用 mock document.modelContext 真跑
 * registerTool → getTools → executeTool 三段，等同 agentic 瀏覽器的調用路徑。
 *
 * 注意：runGetQuote 是同步純函式（無 fetch/無 side-effect），回傳
 * {ok, message, lineUrl, mailtoUrl, errors?}。
 */

import { validateQuote, buildQuoteMessage, buildLineUrl, buildMailto, LINE_OA_CODE } from "./webmcp-quote-utils.mjs";

const WEBMCP_TOOL = {
  name: "get_quote",
  description:
    "浮雲輕鬆遊包車報價請求（draft-only，零金流）。收集 5 欄：出發地、目的地、日期(YYYY-MM-DD)、人數(1-60)、(可選)行李/備註/聯絡。回傳 LINE 預填連結（官方帳號 " + LINE_OA_CODE + "），客人在手機 LINE 確認後自行送出；不自動發送。",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "出發地（城市或地址），例：台北、桃園機場" },
      to: { type: "string", description: "目的地（城市或地址），例：阿里山、太魯閣" },
      date: { type: "string", description: "預計用車日期，格式 YYYY-MM-DD" },
      party: { type: "number", description: "乘客人數（整數 1-60）" },
      luggage: { type: "string", description: "(可選)行李件數" },
      notes: { type: "string", description: "(可選)備註/特殊需求" },
      contactName: { type: "string", description: "(可選)聯絡人姓名" },
      contactPhone: { type: "string", description: "(可選)聯絡電話" },
    },
    required: ["from", "to", "date", "party"],
  },
};

// 純執行函式（供 tool execute + 人類表單 + harness 共用）
function runGetQuote(args) {
  const v = validateQuote(args);
  if (!v.ok) {
    return { ok: false, error: "quote 需完整欄位", errors: v.errors };
  }
  const message = buildQuoteMessage(args);
  return {
    ok: true,
    message,
    lineUrl: buildLineUrl(message),
    mailtoUrl: buildMailto(message),
    next: [
      "1. 在手機開啟 lineUrl → LINE 會把內文帶入 " + LINE_OA_CODE + " 的輸入框，確認後自行按送出（電腦版 LINE 不支援預填，請複製內文）",
      "2. 浮雲會回覆正式報價 + 可用車款 + 備註建議",
      "3. 若無 LINE，用 mailtoUrl 兜底",
    ],
  };
}

// 實際掛進 document.modelContext 的 tool（execute 包上 runGetQuote）
export function buildWebMCPTool() {
  return { ...WEBMCP_TOOL, execute: (args) => runGetQuote(args) };
}

export { WEBMCP_TOOL, runGetQuote };
