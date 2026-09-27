/**
 * scripts/test-webmcp-quote.mjs — Node 單元測試
 * 執行：`cd /home/arashiyun/fuyun-travel && node scripts/test-webmcp-quote.mjs`
 * 預期：全 PASS、exit 0；任一 FAIL → exit 1
 */
import {
  validateQuote,
  buildQuoteMessage,
  buildLineUrl,
  buildMailto,
  LINE_OA_CODE,
  LINE_BASE,
  FALLBACK_EMAIL,
} from "../lib/webmcp-quote-utils.mjs";

let passed = 0, failed = 0;
function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else      { failed++; console.error(`  FAIL  ${name}  — ${detail}`); }
}
function section(title) { console.log(`\n=== ${title} ===`); }

// -------- 常數 --------
section("constants");
check("LINE_OA_CODE", LINE_OA_CODE === "@fuyuntravel", `got ${LINE_OA_CODE}`);
check("LINE_BASE prefix", LINE_BASE.startsWith("https://line.me/R/ti/p/@fuyuntravel"), `got ${LINE_BASE}`);
check("FALLBACK_EMAIL", /^yunyi6866@gmail\.com$/.test(FALLBACK_EMAIL), `got ${FALLBACK_EMAIL}`);

// -------- validateQuote --------
section("validateQuote");
{
  const r = validateQuote({ from: "台北", to: "阿里山", date: "2026-09-05", party: 12 });
  check("valid 台北→阿里山 2026-09-05 12人", r.ok === true && r.normalized.party === 12, JSON.stringify(r));
  check("valid normalized.from", r.normalized.from === "台北");
  check("valid normalized.date", r.normalized.date === "2026-09-05");
}
{
  const r = validateQuote({ party: 12 });
  check("missing from/to/date → !ok", r.ok === false && r.errors.length >= 3, JSON.stringify(r.errors));
}
{
  const r = validateQuote({ from: "台北", to: "阿里山", date: "2026-09-05", party: 0 });
  check("party=0 → !ok", r.ok === false && /party/.test(r.errors.join(" ")), JSON.stringify(r.errors));
}
{
  const r = validateQuote({ from: "台北", to: "阿里山", date: "2026-09-05", party: 61 });
  check("party=61 → !ok", r.ok === false, JSON.stringify(r.errors));
}
{
  const r = validateQuote({ from: "台北", to: "阿里山", date: "abc", party: 12 });
  check("date=abc → !ok", r.ok === false && /date/.test(r.errors.join(" ")), JSON.stringify(r.errors));
}
{
  const r = validateQuote({ from: "台北", to: "阿里山", date: "2026-02-30", party: 12 });
  // 2026-02-30 不存在
  check("date=2026-02-30 (不存在) → !ok", r.ok === false, JSON.stringify(r.errors));
}
{
  const r = validateQuote({ from: "台北", to: "阿里山", date: "1900-01-01", party: 12 });
  check("date=1900 → !ok", r.ok === false, JSON.stringify(r.errors));
}
{
  const long = "x".repeat(200);
  const r = validateQuote({ from: long, to: "阿里山", date: "2026-09-05", party: 12 });
  check("from 過長 → !ok", r.ok === false, "");
}
{
  const r = validateQuote({ from: "  台北  ", to: "  阿里山  ", date: " 2026-09-05 ", party: "12" });
  check("whitespace trim + 字串轉數字", r.ok === true && r.normalized.from === "台北" && r.normalized.party === 12, JSON.stringify(r.normalized));
}
{
  const r = validateQuote({ from: "", to: "阿里山", date: "2026-09-05", party: 12 });
  check("from=空字串 → !ok", r.ok === false && /from/.test(r.errors.join(" ")), JSON.stringify(r.errors));
}

// -------- buildQuoteMessage --------
section("buildQuoteMessage");
{
  const msg = buildQuoteMessage({
    from: "台北", to: "阿里山", date: "2026-09-05", party: 12,
    luggage: "3 件", notes: "含午餐",
    contactName: "黃先生", contactPhone: "0912345678",
  });
  check("msg header", msg.startsWith("【浮雲包車報價請求】"), msg.slice(0, 60));
  check("msg 出發地", msg.includes("出發地: 台北"));
  check("msg 目的地", msg.includes("目的地: 阿里山"));
  check("msg 日期", msg.includes("日期: 2026-09-05"));
  check("msg 人數", msg.includes("人數: 12 人"));
  check("msg 行李", msg.includes("行李件數: 3 件"));
  check("msg 備註", msg.includes("備註: 含午餐"));
  check("msg 聯絡人", msg.includes("黃先生"));
  check("msg 電話", msg.includes("0912345678"));
}
{
  // 缺欄位 → 不 crash，欄位留空
  const msg = buildQuoteMessage({ from: "台北", to: "阿里山", date: "2026-09-05", party: 12 });
  check("空行李不出現", !msg.includes("行李件數"), "");
  check("空備註不出現", !msg.includes("備註:"), "");
  check("缺聯絡人 fallback", msg.includes("(未填)"));
}
{
  {
    const big = "x".repeat(200);
    const r = validateQuote({ from: big, to: "阿里山", date: "2026-09-05", party: 12 });
    check("from 過長 → !ok（校驗嚴格，不靜默截斷）", r.ok === false && /from/.test(r.errors.join(" ")), JSON.stringify(r.errors));
  }
  {
    const big = "x".repeat(500);
    const msg = buildQuoteMessage({ from: big, to: "阿里山", date: "2026-09-05", party: 12, notes: big });
    // 過長欄位 → buildQuoteMessage 中 textOk 回 null → 顯示為空
    check("過長 from → 顯示為空", msg.includes("出發地: \n"), JSON.stringify(msg.slice(0, 60)));
    check("過長 notes 截到 ≤160", !msg.includes("x".repeat(161)), "");
  }
}

// -------- buildLineUrl --------
section("buildLineUrl");
{
  const msg = "測試訊息 123";
  const url = buildLineUrl(msg);
  check("LINE url 前綴", url.startsWith(LINE_BASE + "?text="), url);
  check("LINE url 編碼", decodeURIComponent(url.slice(LINE_BASE.length + 6)) === msg, url);
}
{
  const url = buildLineUrl("");
  check("空訊息 → 純 base", url === LINE_BASE, url);
}
{
  const url = buildLineUrl(null);
  check("null → 純 base", url === LINE_BASE, url);
}
{
  const url = buildLineUrl("a&b=c#d?e");
  check("特殊字元不破坏 url", ["&", "=", "#", "?"].every(c => !url.includes(`?text=a&b=${c}`) || url.includes(`text=a%26b%3D`)) , url);
}

// -------- buildMailto --------
section("buildMailto");
{
  const url = buildMailto("msg", "sub");
  check("mailto prefix", url.startsWith(`mailto:${FALLBACK_EMAIL}?`), url);
  check("mailto subject 編碼", url.includes(`subject=${encodeURIComponent("sub")}`), url);
  check("mailto body 編碼", url.includes(`body=${encodeURIComponent("msg")}`), url);
}

// ======== 總結 ========
console.log(`\n========== RESULT ==========`);
console.log(`PASS: ${passed}   FAIL: ${failed}`);
if (failed > 0) {
  console.error("\n✗ 有失敗測試 — 不可上 production");
  process.exit(1);
}
console.log("✓ All tests passed");
