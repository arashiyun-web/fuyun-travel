import { busDriverFeeLine, MIDIBUS_TERMS_NOTE, CUSTOMER_REQUIRED_FIELDS, customerRange, dayTypeOf, rangeText, SURCHARGE_NOTE, vehicleNote, type CustomerField } from "@/lib/quoteRange";

/**
 * Customer wording for the LINE range-quote conversation and the staff range draft. Pure.
 * Follows the existing 小幫手 bot (app/api/line/webhook, backend/app/quote_formatter.py): a 初步行情
 * range, what is still needed, and 真人客服／專人 for the formal quote. Never a single fixed price and
 * never staff-only wording (待補、知識庫、內部參考 …).
 */

export type ConversationFields = {
  date?: string | null;
  people?: number | null;
  origin?: string | null;
  destination?: string | null;
  note?: string | null;
  luggage?: string | null;
  tripType?: string | null;
  vehicle?: string | null;
};

const QUESTIONS: Record<CustomerField, string> = {
  日期: "用車日期（例如 12/20）",
  出發地: "出發地",
  目的地: "目的地",
  人數: "乘車人數",
  行李件數: "行李件數（例如 每人一件 28 吋，或 無行李）",
  單程或來回: "單程或來回",
};

export const HANDOFF_REPLY = "已收到您完整的需求，專人會盡快與您聯繫，確認行程後提供正式報價。";
export const HANDOFF_REPEAT_REPLY = "您的需求已轉給專人，專人會盡快與您聯繫；如需補充，請直接留言，專人會一併確認。";

function clean(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "無" ? "" : text;
}

/** Luggage answer from free text: 「2 件行李」「行李 3 件」「每人一件28吋」「無行李」「不用放行李」. */
export function parseLuggage(text: string) {
  const value = text.normalize("NFKC");
  if (/無行李|沒有行李|不帶行李|沒行李|不用放行李|行李\s*[:：]?\s*(?:無|0\s*件)/.test(value)) return "無行李";
  const labeled = value.match(/行李(?:件數)?\s*[:：]\s*([^\s，,。；;]+)/);
  if (labeled) return labeled[1];
  const count = value.match(/(\d{1,3})\s*(?:件|個|箱)\s*(?:大?行李|行李箱)?/);
  if (count && /行李|件|箱/.test(value)) return `${count[1]} 件`;
  const each = value.match(/每人\s*[一1]\s*(?:件|個|箱)[^\s，,。]*/);
  if (each) return each[0];
  if (/行李/.test(value) && /\d+\s*吋/.test(value)) return value.match(/[^\s，,。]*\d+\s*吋[^\s，,。]*/)?.[0] || "已提供";
  return "";
}

export function parseTripType(text: string) {
  if (/來回|去回|往返|雙程/.test(text)) return "來回";
  if (/單程|單趟|只去|送到就好/.test(text)) return "單程";
  return "";
}

export function missingFields(fields: ConversationFields): CustomerField[] {
  const have: Record<CustomerField, boolean> = {
    日期: Boolean(clean(fields.date)),
    出發地: Boolean(clean(fields.origin)),
    目的地: Boolean(clean(fields.destination)),
    人數: typeof fields.people === "number" && fields.people > 0,
    行李件數: Boolean(clean(fields.luggage)),
    單程或來回: Boolean(clean(fields.tripType)),
  };
  return CUSTOMER_REQUIRED_FIELDS.filter((field) => !have[field]);
}

function rangeFor(fields: ConversationFields, now: Date) {
  return customerRange({
    date: fields.date,
    passengerCount: fields.people ?? null,
    pickup: fields.origin,
    destination: fields.destination,
    remark: [clean(fields.note), clean(fields.tripType), clean(fields.luggage)].filter(Boolean).join(" "),
    recommendedVehicle: fields.vehicle,
  }, now);
}

/** Range lines shared by the LINE reply and the staff draft. */
export function rangeLines(fields: ConversationFields, now = new Date()) {
  const range = rangeFor(fields, now);
  const lines: string[] = [];
  if (range.blocked) {
    lines.push(range.blocked, `建議改為：${range.alternatives.join("、")}，專人可協助規劃。`);
    return { range, lines };
  }
  const vehicle = vehicleNote(range.vehicle, fields.people ?? null);
  if (range.seatLabel) lines.push(`建議車型：大巴（${range.seatLabel}）`);
  else if (vehicle) lines.push(`建議車型：${vehicle}`);
  const price = rangeText(range);
  if (price) {
    const day = range.dayType ? dayTypeOf(fields.date, now) : null;
    // v12: a multi-day range that touches a weekend says so (假日 band); it never names one weekday for all days.
    const dayWord = day && day.days ? (day.weekend ? "含週末，假日" : "皆為平日") : range.dayType === "holiday" ? "假日" : "平日";
    const dayLabel = day ? `，${day.label}${dayWord}` : range.holidayHigher ? "，平日" : "";
    lines.push(`初步行情：${range.routeLabel ? `${range.routeLabel}${dayLabel} ` : ""}${price}`);
    if (range.holidayHigher) lines.push("假日價格略高，確認日期後提供假日範圍。");
    if (range.note) lines.push(range.note);
    lines.push("這是範圍報價，不是確定金額。");
  } else if (!range.vehicle) {
    lines.push("初步行情：提供乘車人數後即可估算範圍。");
  } else if (clean(fields.origin) && clean(fields.destination)) {
    lines.push("這段路線的費用會由專人報價。");
  } else {
    lines.push("初步行情：提供出發地與目的地後即可估算範圍。");
  }
  if (range.vehicle === "bus") lines.push(busDriverFeeLine(fields.date, now));
  if (range.vehicle === "midibus" && price) lines.push(MIDIBUS_TERMS_NOTE);
  lines.push(SURCHARGE_NOTE);
  return { range, lines };
}

function questionLines(missing: CustomerField[]) {
  if (!missing.length) return [];
  return ["", "為了確認您的需求，請再提供：", ...missing.map((field) => `・${QUESTIONS[field]}`)];
}

/** LINE reply while collecting: range (when possible) + one question per missing field. */
export function rangeReply(fields: ConversationFields, now = new Date()) {
  const { lines } = rangeLines(fields, now);
  const route = clean(fields.origin) || clean(fields.destination) ? [`行程：${clean(fields.origin) || "未提供"} → ${clean(fields.destination) || "未提供"}`] : [];
  return [
    "您好，我是小幫手。",
    "",
    "依您目前提供的資料：",
    ...route,
    ...lines,
    ...questionLines(missingFields(fields)),
    "",
    "資料齊全後，會由專人確認並提供正式報價。",
  ].join("\n");
}

/** Customer-safe staff draft (quoteDraftText): same range wording, ready to send after review. */
export function rangeDraftText(fields: ConversationFields, now = new Date()) {
  const { lines } = rangeLines(fields, now);
  const missing = missingFields(fields);
  return [
    "您好，感謝您的包車詢價。以下是目前收到的行程資料：",
    "",
    `出發：${clean(fields.origin) || "未提供"}`,
    `目的：${clean(fields.destination) || "未提供"}`,
    `人數：${fields.people || "未提供"}`,
    `日期：${clean(fields.date) || "未提供"}`,
    `行李：${clean(fields.luggage) || "未提供"}`,
    `單程或來回：${clean(fields.tripType) || "未提供"}`,
    `備註：${clean(fields.note) || "無"}`,
    "",
    ...lines,
    ...questionLines(missing),
    "",
    "正式報價會由專人確認行程細節後提供。",
  ].join("\n").slice(0, 4500);
}
