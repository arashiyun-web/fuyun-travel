/**
 * contentGuard.mjs — deterministic fact guard for generated marketing / FAQ text.
 *
 * The local model may only rewrite descriptive wording. Every operational fact
 * (price, currency, pricing unit, included items, dates, seats/quota, hours) comes
 * from a versioned ApprovedFacts record and is rendered by code. Generated text is
 * checked against that record; anything unverifiable is a violation and the caller
 * must fall back to the template or send the draft to a human.
 *
 * Pure functions only (no I/O) so both the Next.js app and the worker can use it.
 */
import { createHash } from "node:crypto";

/** Items whose inclusion is an operational promise. */
export const INCLUDABLE_ITEMS = ["住宿", "早餐", "午餐", "晚餐", "餐食", "餐", "門票", "保險", "導遊", "領隊", "停車費", "過路費", "油資", "司機小費"];
const UNIT_LABEL = { per_vehicle: "每車", per_person: "每人" };
/** Well-known destinations; a mention outside the approved stops counts as a new itinerary fact. */
export const KNOWN_PLACES = ["九份", "十分", "平溪", "野柳", "淡水", "北投", "陽明山", "金瓜石", "士林夜市", "信義", "大安森林公園", "故宮", "101", "烏來", "宜蘭", "礁溪", "太魯閣", "花蓮", "日月潭", "清境", "合歡山", "阿里山", "奮起湖", "墾丁", "高雄", "台南", "鹿港", "溪頭", "三峽", "鶯歌", "大溪", "小琉球", "澎湖", "金門", "馬祖", "綠島", "蘭嶼"];
const REFUSAL_RE = /抱歉|無法提供|不能提供|無法協助|作為(?:一個)?\s*AI|I can(?:no|')t/i;
const DEFAULT_MAX_CHARS = 160;

const AMOUNT_RE = /(?:NT\$|TWD|\$)\s*([\d][\d,]*)|([\d][\d,]*)\s*(?:元|塊|TWD)/g;
const PER_PERSON_RE = /每人|每位|\/\s*人|／\s*人|一人|人頭/;
const ISO_DATE_RE = /\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/g;
const YEAR_RE = /\b(20\d{2})\s*年/g;
const HOURS_RE = /(\d+)\s*(?:小時|hr|hours?)/gi;
const HEADCOUNT_RE = /(?:名額|限額|限)\s*(\d+)\s*(?:人|名|位)?|(\d+)\s*(?:人|名|位)\s*(?:成團|名額|滿團)/g;
const INCLUDE_CUE_RE = /(?:含|包含|包括|附|提供|✅)\s*[:：]?\s*([^\n。；;]{0,40})/g;
const NEGATION_RE = /不含|未含|不包含|不包括|另計|自理|需另行|需另外|皆未包含|未包含/;

const toInt = (s) => Number(String(s).replace(/,/g, ""));

/** Deterministic, code-rendered facts block. Missing fields are rendered as 待確認. */
export function renderFactsBlock(facts) {
  if (!facts) return "價格：待確認（請私訊由專人報價）\n名額：待確認\n出發日期：待確認\n費用包含：待確認";
  const price = facts.price
    ? `${facts.price.amount.toLocaleString("en-US")} 元（${UNIT_LABEL[facts.price.unit]}${facts.durationHours ? `，含 ${facts.durationHours} 小時用車` : ""}）`
    : "待確認（請私訊由專人報價）";
  return [
    `價格：${price}`,
    `名額：${facts.seats ?? "待確認"}`,
    `出發日期：${facts.dates?.length ? facts.dates.join("、") : "待確認"}`,
    `費用包含：${facts.includes?.length ? facts.includes.join("、") : "待確認"}`,
    facts.excludes?.length ? `費用不含：${facts.excludes.join("、")}` : null,
    `（資料版本 ${facts.version}）`,
  ].filter(Boolean).join("\n");
}

function factsProblems(facts, now) {
  if (!facts) return [];
  const out = [];
  if (!facts.version) out.push({ code: "FACTS_UNVERSIONED", detail: "核准資料缺版本" });
  if (facts.validUntil && Date.parse(facts.validUntil) < now.getTime()) out.push({ code: "FACTS_EXPIRED", detail: `核准資料已過期（${facts.validUntil}）` });
  if (facts.price && !UNIT_LABEL[facts.price.unit]) out.push({ code: "FACTS_PRICE_UNIT_MISSING", detail: "價格缺計價單位" });
  return out;
}

function checkAmounts(text, facts, v) {
  const allowed = facts?.price ? [facts.price.amount] : [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const amount = toInt(m[1] ?? m[2]);
    if (!allowed.includes(amount)) v.push({ code: "AMOUNT_NOT_APPROVED", detail: `金額 ${amount} 不在核准資料` });
    else {
      const window = text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12);
      if (facts.price.unit === "per_vehicle" && PER_PERSON_RE.test(window)) v.push({ code: "PRICE_UNIT_MISMATCH", detail: "核准為每車價，輸出寫成每人" });
      if (facts.price.unit === "per_person" && /每車|包車價|整車/.test(window)) v.push({ code: "PRICE_UNIT_MISMATCH", detail: "核准為每人價，輸出寫成每車" });
    }
  }
}

function checkDates(text, facts, v) {
  const approved = new Set((facts?.dates ?? []).map((d) => d.replace(/\//g, "-")));
  for (const m of text.matchAll(ISO_DATE_RE)) {
    const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    if (!approved.has(iso)) v.push({ code: "DATE_NOT_APPROVED", detail: `日期 ${iso} 不在核准資料` });
  }
  const approvedYears = new Set([...approved].map((d) => d.slice(0, 4)));
  for (const m of text.matchAll(YEAR_RE)) {
    if (!approvedYears.has(m[1])) v.push({ code: "YEAR_NOT_APPROVED", detail: `年份 ${m[1]} 不在核准資料` });
  }
}

function checkCounts(text, facts, v) {
  for (const m of text.matchAll(HOURS_RE)) {
    if (toInt(m[1]) !== facts?.durationHours) v.push({ code: "HOURS_NOT_APPROVED", detail: `時數 ${m[1]} 不在核准資料` });
  }
  for (const m of text.matchAll(HEADCOUNT_RE)) {
    const n = toInt(m[1] ?? m[2]);
    if (n !== facts?.seats) v.push({ code: "QUOTA_NOT_APPROVED", detail: `名額 ${n} 不在核准資料` });
  }
}

function checkIncludes(text, facts, v) {
  const includes = new Set(facts?.includes ?? []);
  for (const m of text.matchAll(INCLUDE_CUE_RE)) {
    const clause = m[0];
    const before = text.slice(Math.max(0, m.index - 6), m.index);
    if (NEGATION_RE.test(clause) || NEGATION_RE.test(before)) continue;
    for (const item of INCLUDABLE_ITEMS) {
      if (clause.includes(item) && ![...includes].some((inc) => inc.includes(item) || item.includes(inc))) {
        v.push({ code: "INCLUDE_NOT_APPROVED", detail: `宣稱包含「${item}」但核准資料未列` });
      }
    }
  }
}

/**
 * Validate generated text against approved facts.
 * @returns {{ ok: boolean, violations: {code: string, detail: string}[] }}
 */
export function validateGenerated(text, facts, now = new Date(), { allowedPlaces = null, maxChars = null } = {}) {
  const violations = [...factsProblems(facts, now)];
  if (REFUSAL_RE.test(text)) violations.push({ code: "MODEL_REFUSAL", detail: "模型拒答或輸出道歉語" });
  if (maxChars && [...text.trim()].length > maxChars) violations.push({ code: "TOO_LONG", detail: `超過 ${maxChars} 字` });
  if (allowedPlaces) {
    for (const place of KNOWN_PLACES) {
      if (text.includes(place) && !allowedPlaces.some((p) => p.includes(place) || place.includes(p))) violations.push({ code: "PLACE_NOT_APPROVED", detail: `提到未核准地點「${place}」` });
    }
  }
  checkAmounts(text, facts, violations);
  checkDates(text, facts, violations);
  checkCounts(text, facts, violations);
  checkIncludes(text, facts, violations);
  const seen = new Set();
  const unique = violations.filter((x) => (seen.has(x.code + x.detail) ? false : seen.add(x.code + x.detail)));
  return { ok: unique.length === 0, violations: unique };
}

/**
 * Compose the publishable draft: model-written description (only if it passes the
 * guard) followed by the code-rendered facts block. Falls back to the template
 * description when the model text fails; the draft is never auto-approved.
 */
export function composeDraft({ modelText, templateText, facts, now = new Date(), allowedPlaces = [], maxChars = DEFAULT_MAX_CHARS }) {
  const check = validateGenerated(modelText ?? "", facts, now, { allowedPlaces, maxChars });
  const blockingFacts = check.violations.some((x) => x.code.startsWith("FACTS_"));
  const description = check.ok ? modelText.trim() : templateText.trim();
  return {
    text: `${description}\n\n${renderFactsBlock(blockingFacts ? null : facts)}`,
    source: check.ok ? "model" : "template_fallback",
    violations: check.violations,
    requiresHuman: blockingFacts || !check.ok,
    status: "pending_approval",
  };
}

/** Hash that binds an approval to the exact text, images, target and facts version. */
export function approvalHash({ text, imageSha256s = [], platform, account, factsVersion }) {
  const canonical = JSON.stringify({ text: text.normalize("NFC"), imageSha256s: [...imageSha256s].sort(), platform, account, factsVersion: factsVersion ?? null });
  return createHash("sha256").update(canonical).digest("hex");
}

export function isApprovalValid(approval, current) {
  return Boolean(approval?.hash) && approval.hash === approvalHash(current);
}
