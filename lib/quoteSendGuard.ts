/**
 * Guards for 「送出給 LINE」. Auto-generated drafts (quoteOptions.autoDraft) must be edited and
 * saved by staff before they can be sent, and no outgoing text may carry the knowledge-base
 * reference wording or the internal auto-draft note. Pure; no network, env or DB access.
 */

import { KNOWLEDGE_RANGES } from "@/lib/quoteKnowledge";

/**
 * Staff-only wording. Any outgoing text containing one (after NFKC full/half-width folding and
 * whitespace removal) is rejected.
 */
export const CUSTOMER_FORBIDDEN_MARKERS = [
  "參考行情", "自動預生成", "待補", "內部參考", "待人工", "行情表未涵蓋", "後台報價草稿",
  "知識庫", "pricing_matrix", "quote_rules",
] as const;

/**
 * 「參考」 at a line start (or after whitespace) or right after 「｜」, followed by a number, NT$ or a vehicle name: the
 * shape of an admin summary line. Mid-sentence 「建議參考九人座方案」 is not matched.
 */
const SUMMARY_SHAPE = /(?:^|\n|\|)參考(?:行情)?\n?[:|]?\n?(?:nt\$|\$|\d|九人座|賓士|toyota|中巴|42人座|43座|44|大巴|車隊表)/;

/** Lines shorter than this are not matched by containment (too generic); markers still apply. */
const MIN_LINE_MATCH = 6;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Same folding as cleanText() in the PATCH route (drops <>, collapses whitespace), so an unchanged save matches. */
function normalize(text: string) {
  return text.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

/** FNV-1a 32-bit over the normalized text; only used to tell whether staff changed the draft. */
export function draftFingerprint(text: string) {
  let hash = 0x811c9dc5;
  for (const char of normalize(text)) {
    const code = char.codePointAt(0) || 0;
    hash ^= code;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** NFKC (full→half width), lower case, no whitespace or zero-width chars, no thousands commas. */
export function compactForMatch(text: string | null | undefined) {
  return (text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u200b-\u200d\u2060\ufeff]+/g, "")
    .replace(/(\d)[,.](?=\d{3}(?!\d))/g, "$1");
}

/**
 * NFKC + lower case, every whitespace run turned into a line break. The PATCH save folds newlines
 * into spaces, so a space is treated as a line start for the summary-shape rule.
 */
function linesForMatch(text: string | null | undefined) {
  return (text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200d\u2060\ufeff]+/g, "")
    .replace(/\s+/g, "\n");
}

export function forbiddenMarkersIn(text: string | null | undefined) {
  const value = compactForMatch(text);
  const found: string[] = CUSTOMER_FORBIDDEN_MARKERS.filter((marker) => value.includes(compactForMatch(marker)));
  if (SUMMARY_SHAPE.test(linesForMatch(text))) found.push("參考摘要");
  return found;
}

const CHINESE_DIGITS: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const SMALL_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const NUMBER_RUN = /(?:\d+(?:\.\d+)?|[零〇一二兩两三四五六七八九十百千萬万])(?:\d+(?:\.\d+)?|[零〇一二兩两三四五六七八九十百千萬万]|(?<=\d)k)*/g;

/**
 * Value of one run of Arabic digits, Chinese numerals and 十/百/千/萬/k, e.g. 16000, 1.6萬, 1萬6,
 * 2萬2, 一萬六千, 兩萬兩千, 16k. 「1萬6」 is read colloquially as 16000 (a bare digit after 萬 is thousands).
 */
function runValue(run: string) {
  const tokens = run.match(/\d+(?:\.\d+)?|[^\d.]/g) || [];
  let total = 0;
  let section = 0;
  let current: number | null = null;
  let currentDigits = 0;
  let afterWan = false;
  let lastWasUnit = false;
  for (const token of tokens) {
    if (/^\d/.test(token)) {
      current = parseFloat(token);
      currentDigits = token.replace(/\..*/, "").length;
      lastWasUnit = false;
    } else if (token in CHINESE_DIGITS) {
      current = CHINESE_DIGITS[token];
      currentDigits = 1;
      lastWasUnit = false;
    } else if (token in SMALL_UNITS) {
      section += (current ?? 1) * SMALL_UNITS[token];
      current = null;
      lastWasUnit = true;
    } else if (token === "k") {
      section += (current ?? 0) * 1000;
      current = null;
      lastWasUnit = true;
    } else if (token === "萬" || token === "万") {
      total += (section + (current ?? (section ? 0 : 1))) * 10000;
      section = 0;
      current = null;
      afterWan = true;
      lastWasUnit = true;
    }
  }
  if (current != null) {
    // 「1萬6」「2萬2」「一萬六」: a bare short number right after 萬 fills the next places (6 → 6000).
    if (afterWan && !lastWasUnit && section === 0 && currentDigits < 4 && Number.isInteger(current)) section += current * 10 ** (4 - currentDigits);
    else section += current;
  }
  return Math.round(total + section);
}

function amountsOf(prepared: string) {
  const out = new Set<number>();
  const runs = Array.from(prepared.matchAll(NUMBER_RUN));
  runs.forEach((match, index) => {
    const value = runValue(match[0]);
    if (Number.isFinite(value) && value > 0) out.add(value);
    // Shared unit: 「1.6~2.2萬」「16~22k」 — a bare number just before a 萬/k amount takes the same unit.
    const next = runs[index + 1];
    if (!next || /[萬万k千]/.test(match[0])) return;
    const gap = prepared.slice((match.index || 0) + match[0].length, next.index || 0);
    const unit = /[萬万]$/.test(next[0]) ? 10000 : /k$/.test(next[0]) ? 1000 : null;
    if (unit && gap.length <= 3 && /^\d+(?:\.\d+)?$/.test(match[0])) out.add(Math.round(parseFloat(match[0]) * unit));
  });
  return out;
}

/**
 * Every amount in the text. Read twice — with whitespace removed (catches 「1 6, 0 0 0」) and with
 * whitespace as a separator (catches 「16000 22000」) — and the union is returned.
 */
export function amountsIn(text: string | null | undefined) {
  const folded = (text || "").normalize("NFKC").toLowerCase();
  const dropCommas = (value: string) => value.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  const joined = dropCommas(folded.replace(/[\s\u200b-\u200d\u2060\ufeff]+/g, ""));
  const spaced = dropCommas(folded.replace(/(\d)[^\S\n]+,|,[^\S\n]+(?=\d)/g, "$1,").replace(/[\u200b-\u200d\u2060\ufeff]+/g, ""));
  return new Set([...Array.from(amountsOf(joined)), ...Array.from(amountsOf(spaced))]);
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * True when one text carries both the low and the high of a knowledge-base bus range (this row's or
 * any in the table), whatever sits between them. A single amount (e.g. exactly 16,000) passes.
 */
export function containsKnowledgeRange(text: string | null | undefined, rowRange?: unknown) {
  const amounts = amountsIn(text);
  const row = object(rowRange);
  const low = number(row?.low);
  const high = number(row?.high);
  const ranges = low && high ? [{ low, high }, ...KNOWLEDGE_RANGES] : KNOWLEDGE_RANGES;
  return ranges.some((range) => amounts.has(range.low) && amounts.has(range.high));
}

/** Staff-only strings stored with the row (summary, detail lines, note), each with and without the 參考行情 prefix. */
function staffStrings(meta: Record<string, unknown> | null) {
  if (!meta) return [];
  const raw = [meta.reference, meta.staffNote, ...(Array.isArray(meta.staffLines) ? meta.staffLines : [])]
    .filter((item): item is string => typeof item === "string");
  const out = new Set<string>();
  for (const item of raw) {
    for (const variant of [item, item.replace(/^參考行情[｜|:：\s]*/, "")]) {
      const compact = compactForMatch(variant);
      if (compact.length >= MIN_LINE_MATCH) out.add(compact);
    }
  }
  return Array.from(out);
}

export function autoDraftOf(options: unknown) {
  return object(object(options)?.autoDraft);
}

/** True while an auto-generated draft has not been edited and saved by staff. */
export function autoDraftNeedsReview(options: unknown) {
  const meta = autoDraftOf(options);
  return Boolean(meta) && meta?.staffReviewed !== true;
}

export type SendBlock = {
  status: 409;
  code: "AUTO_DRAFT_UNREVIEWED" | "FORBIDDEN_MARKER" | "KNOWLEDGE_RANGE" | "STAFF_LINE";
  error: string;
  markers?: string[];
};

/**
 * Server-side check before 「送出給 LINE」. Refuses: an unreviewed auto draft; internal markers;
 * any knowledge-base range (row or table, any format); any staff-only line of this row.
 * A single staff-chosen amount (e.g. NT$18,000) or a fleet-table price written by staff passes.
 */
export function sendBlock(quote: { quoteDraftText?: string | null; quoteOptions?: unknown }): SendBlock | null {
  const meta = autoDraftOf(quote.quoteOptions);
  if (meta && meta.staffReviewed !== true) {
    return { status: 409, code: "AUTO_DRAFT_UNREVIEWED", error: "這是系統自動產生的草稿，請先改寫成正式報價並按「儲存」，才能送出給客人。" };
  }
  const markers = forbiddenMarkersIn(quote.quoteDraftText);
  if (markers.length) {
    return { status: 409, code: "FORBIDDEN_MARKER", error: `報價內容含有內部用字（${markers.join("、")}），請刪除後再送出。`, markers };
  }
  if (containsKnowledgeRange(quote.quoteDraftText, meta?.range)) {
    return { status: 409, code: "KNOWLEDGE_RANGE", error: "報價內容含有知識庫參考行情區間，請改成人員確認的金額後再送出。" };
  }
  const text = compactForMatch(quote.quoteDraftText);
  if (staffStrings(meta).some((line) => text.includes(line))) {
    return { status: 409, code: "STAFF_LINE", error: "報價內容含有後台內部參考的文字，請刪除後再送出。" };
  }
  return null;
}

/**
 * Called when staff save the draft. If the saved text differs from what was auto-generated, the
 * auto draft counts as staff-reviewed. Returns null when quoteOptions does not need to change.
 */
export function reviewOnSave(options: unknown, savedText: string | null | undefined, now = new Date()) {
  const meta = autoDraftOf(options);
  if (!meta || meta.staffReviewed === true) return null;
  const text = normalize(savedText || "");
  if (!text || draftFingerprint(text) === meta.textFingerprint) return null;
  return { ...(object(options) || {}), autoDraft: { ...meta, staffReviewed: true, reviewedAt: now.toISOString() } };
}
