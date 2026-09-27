"use client";

/**
 * WebMCPQuoteTool.tsx — 浮雲 WebMCP 試點（get_quote）
 *
 * 本 component 只做 2 件事：
 *  1. 註冊 WebMCP imperative tool（definition + 執行邏輯全在 lib/webmcp-tool.mjs）
 *  2. 顯示一個「報價請求」人類表單（同一套 runGetQuote 純邏輯）
 *
 * WebMCP imperative API（2026-08-27 Chromium 149 實測）：
 *  navigator.modelContext.registerTool({name, description, inputSchema, execute})（同步）
 *  navigator.modelContext.getTools() → Promise<Array<{name,description,inputSchema(string)}>）
 *  executeTool 不存在於頁面 API — 執行端走 agent（DevTools/瀏覽器後端），
 *  工具 function 本身必須同步回值（probe 實測）。
 * 安全紅線：本 tool 只做「校驗 + 產草稿 + LINE 深連結」，零金流、human-in-the-loop，
 *  符合 SOUL 規則（金流一律先 Owner 一次確認；WebMCP tool 絕不直接下單）。
 *
 * 回退：git 還原 charter-bus/[city]/page.tsx + 刪 components/WebMCPQuoteTool.tsx
 *       + 刪 lib/webmcp-{quote-utils,tool}.{mjs,d.ts} + scripts/harness-webmcp.mjs 即可全撤。
 */

import { useEffect } from "react";
import { buildWebMCPTool, runGetQuote } from "@/lib/webmcp-tool";
import { LINE_OA_CODE } from "@/lib/webmcp-quote-utils";

export interface QuoteResult {
  ok: boolean;
  error?: string;
  errors?: string[];
  message?: string;
  lineUrl?: string;
  mailtoUrl?: string;
  next?: string[];
}

type Fields = {
  from: string;
  to: string;
  date: string;
  party: string;
  luggage: string;
  notes: string;
  contactName: string;
  contactPhone: string;
};

const INITIAL: Fields = {
  from: "",
  to: "",
  date: "",
  party: "12",
  luggage: "",
  notes: "",
  contactName: "",
  contactPhone: "",
};

// module-level 鎖：React StrictMode/HMR 會雙掛 useEffect，
// navigator.modelContext 重註冊同 name 會丟 InvalidStateError。
// 同步 Set 先占位 → async 檢查/註冊，保證同頁只註冊一次。
const registering = new Set<string>();

function useRegisterWebMCPTool() {
  useEffect(() => {
    const KEY = "get_quote";
    if (registering.has(KEY)) return;
    // WebMCP imperative API — 2026-08-27 Chromium 149 實測：
    //  navigator.modelContext（不是 document.modelContext）
    //  registerTool 同步；getTools() 回傳 Promise
    const nav = (globalThis as any).navigator;
    const ctx = nav?.modelContext;
    if (!ctx || typeof ctx.registerTool !== "function") return; // flag 未開 / SSR
    registering.add(KEY);
    (async () => {
      try {
        const existing = (ctx.getTools ? await ctx.getTools() : []) as Array<{ name?: string }>;
        if (existing.some((t) => t?.name === KEY)) return;
        ctx.registerTool(buildWebMCPTool());
        console.log("[WebMCP] get_quote registered on navigator.modelContext");
      } catch (e) {
        console.warn("[WebMCP] 註冊跳過（可能已存在或環境不支援）:", e);
      }
    })();
  }, []);
}

export default function WebMCPQuoteTool() {
  useRegisterWebMCPTool();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const get = (n: string): string => {
      const el = form.elements.namedItem(n);
      // namedItem 回傳 RadioNodeList | Element；本表單全是單值 input，safe cast
      return (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.value ?? "";
    };
    const args: Record<string, unknown> = {
      from: get("from"),
      to: get("to"),
      date: get("date"),
      party: Number(get("party") || 0),
      luggage: get("luggage"),
      notes: get("notes"),
      contactName: get("contactName"),
      contactPhone: get("contactPhone"),
    };
    const r = runGetQuote(args);
    const out = form.querySelector("#webmcp-quote-output") as HTMLElement | null;
    if (!out) return;
    if (r.ok) {
      out.textContent = `✅ 草稿已建立\n\n${r.message}\n\nLINE: ${r.lineUrl}\nmailto: ${r.mailtoUrl}\n\n下一步：\n${(r.next ?? []).join("\n")}`;
    } else {
      out.textContent = `❌ 欄位不完整\n\n${(r.errors ?? []).join("\n")}`;
    }
    out.hidden = false;
  }

  return (
    <section className="card webmcp-quote-tool" aria-label="包車報價請求">
      <h3>包車報價請求（AI 可直接調用 / 人類可手動填）</h3>
      <p>
        此表單同時是一個 <code>WebMCP tool</code>（experimental, origin-trial）。
        客人的 ChatGPT / Codex / 任何 agentic 瀏覽器可直接呼叫 <code>get_quote</code>，
        不用靠模擬點擊表單。人可直接在下面手動填——同一套邏輯。
      </p>

      <form onSubmit={onSubmit} noValidate>
        <div className="form-row">
          <label>出發地 <input name="from" required aria-label="出發地" placeholder="例：台北" /></label>
          <label>目的地 <input name="to" required aria-label="目的地" placeholder="例：阿里山" /></label>
        </div>
        <div className="form-row">
          <label>日期 <input name="date" type="date" required aria-label="日期" /></label>
          <label>人數 <input name="party" type="number" min={1} max={60} required defaultValue="12" aria-label="人數" /></label>
        </div>
        <div className="form-row">
          <label>行李件數(可選) <input name="luggage" aria-label="行李件數" placeholder="例：3 件" /></label>
          <label>聯絡人(可選) <input name="contactName" aria-label="聯絡人" placeholder="黃先生" /></label>
        </div>
        <div className="form-row">
          <label>電話(可選) <input name="contactPhone" inputMode="tel" aria-label="電話" placeholder="0912345678" /></label>
          <label>備註(可選) <input name="notes" aria-label="備註" placeholder="例：含午餐" /></label>
        </div>
        <button type="submit">送出報價請求（產生 LINE 深連結）</button>
        <pre id="webmcp-quote-output" hidden className="quote-result" aria-live="polite"></pre>
      </form>
    </section>
  );
}
