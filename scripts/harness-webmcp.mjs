/**
 * scripts/harness-webmcp.mjs — 模擬 WebMCP agent 調用路徑
 *
 * 這台 Linux 沒有 Chrome，跑不了真实瀏覽器 + flag 的 getTools()/executeTool()。
 * 這個 harness 用 mock document.modelContext 真跑：
 *   Step 1: registerTool(tool)   ← component useEffect 會做的事
 *   Step 2: getTools()           ← agent 發現 tool（schema 檢查）
 *   Step 3: executeTool(name, args) ← agent 調用 tool
 * 三段全用 lib/webmcp-tool.mjs 的真實邏輯（不是我寫的另一份），
 * 等同「把 component 的執行路徑抽出來在 Node 真跑」。
 *
 * 執行：node scripts/harness-webmcp.mjs
 * 預期：全部 PASS、exit 0
 */

import { buildWebMCPTool } from "../lib/webmcp-tool.mjs";
import { LINE_OA_CODE } from "../lib/webmcp-quote-utils.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else      { failed++; console.error(`  FAIL  ${name}  — ${detail}`); }
}

// ---- mock document.modelContext（等同 WebMCP spec 的浏览器 API 表面）----
const registeredTools = new Map();
const globalThis_ = globalThis;
// eslint-disable-next-line no-undef
globalThis_.document = {
  modelContext: {
    registerTool(tool) {
      if (!tool?.name || !tool?.description || !tool?.inputSchema || typeof tool?.execute !== "function") {
        throw new Error("registerTool: tool 需有 name/description/inputSchema/execute");
      }
      if (registeredTools.has(tool.name)) registeredTools.set(tool.name, tool); // 允許重註冊（component StrictMode 雙掛）
      else registeredTools.set(tool.name, tool);
      console.log(`  [mock] registerTool ← ${tool.name}`);
    },
    getTools: () => Array.from(registeredTools.values()).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    executeTool(name, args) {
      const t = registeredTools.get(name);
      if (!t) throw new Error(`tool ${name} 未註冊`);
      return t.execute(args);
    },
  },
};

console.log("=== Step 1: registerTool（component 的 useEffect 會做的事）===");
const tool = buildWebMCPTool();
{
  const doc = globalThis_.document;
  try {
    doc.modelContext.registerTool(tool);
    check("registerTool 成功", true);
  } catch (e) {
    check("registerTool 成功", false, e.message);
  }
}

console.log("\n=== Step 2: getTools（agent 發現 tool + schema 檢查）===");
{
  const tools = globalThis_.document.modelContext.getTools();
  check("getTools 返回 ≥1", tools.length >= 1, `len=${tools.length}`);
  const t = tools.find((x) => x.name === "get_quote");
  check("tool name = get_quote", t?.name === "get_quote", JSON.stringify(t?.name));
  check("tool description 非空", t && t.description.length > 10);
  check("inputSchema.type = object", t?.inputSchema?.type === "object");
  const required = t?.inputSchema?.required ?? [];
  check("required 含 from/to/date/party", ["from", "to", "date", "party"].every((r) => required.includes(r)), JSON.stringify(required));
  check("inputSchema.properties 非空", t?.inputSchema?.properties && Object.keys(t.inputSchema.properties).length > 0);
}

console.log("\n=== Step 3: executeTool(name, args)（agent 調用）===");
{
  // 3a: 正常路徑
  const r = globalThis_.document.modelContext.executeTool("get_quote", {
    from: "台北", to: "阿里山", date: "2026-09-05", party: 12, luggage: "3 件", contactName: "黃先生", contactPhone: "0912345678",
  });
  check("ok=true", r.ok === true, JSON.stringify(r));
  check("message 非空", r.message && r.message.includes("台北"));
  check("message 含 12 人", r.message.includes("12 人"));
  check("lineUrl 指向 @fuyuntravel", r.lineUrl.includes(LINE_OA_CODE), r.lineUrl);
  check("lineUrl 含 prefill 編碼", r.lineUrl.includes("text=") && decodeURIComponent(r.lineUrl.split("text=")[1]).includes("台北"));
  check("mailtoUrl fallback", r.mailtoUrl.startsWith("mailto:"), r.mailtoUrl);
  check("next 指引非空", Array.isArray(r.next) && r.next.length >= 1);

  // 3b: 缺欄位
  const bad = globalThis_.document.modelContext.executeTool("get_quote", { from: "台北" });
  check("缺欄 → ok=false", bad.ok === false, JSON.stringify(bad));
  check("缺欄 → errors 非空", Array.isArray(bad.errors) && bad.errors.length > 0);
  check("缺欄 → 無 lineUrl", typeof bad.lineUrl === "undefined");

  // 3c: 不存在日期
  const bad2 = globalThis_.document.modelContext.executeTool("get_quote", { from: "台北", to: "阿里山", date: "2026-02-30", party: 12 });
  check("不存在日期 → ok=false", bad2.ok === false);
  check("不存在日期 → errors 提到 date", (bad2.errors || []).join(" ").includes("date"));

  // 3d: party 越界
  const bad3 = globalThis_.document.modelContext.executeTool("get_quote", { from: "台北", to: "阿里山", date: "2026-09-05", party: 9999 });
  check("party=9999 → ok=false", bad3.ok === false);

  // 3e: 未註冊 tool
  let threw = false;
  try { globalThis_.document.modelContext.executeTool("not_exist", {}); } catch { threw = true; }
  check("未註冊 tool → 拋錯（agent 會收到 error，不靜默）", threw);
}

console.log("\n=== Step 4: 重複註冊（React StrictMode 雙掛不 crash）===");
{
  let threw = false;
  try { globalThis_.document.modelContext.registerTool(buildWebMCPTool()); } catch (e) { threw = true; console.error(e.message); }
  check("重複註冊不拋錯", !threw);
  const tools = globalThis_.document.modelContext.getTools();
  const count = tools.filter((t) => t.name === "get_quote").length;
  check("重複註冊後仍只有 1 個 get_quote", count === 1, `count=${count}`);
}

console.log(`\n========== HARNESS ==========`);
console.log(`PASS: ${passed}   FAIL: ${failed}`);
if (failed > 0) {
  console.error("✗ harness 失敗 — 上 production 前不可通過");
  process.exit(1);
}
console.log("✓ WebMCP agent-call path all green");
