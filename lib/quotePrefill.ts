import { confirmedVehicleRate, fleetQuoteRecord, type FleetRateId } from "@/lib/fleetCatalog";
import { savedFleetFare } from "@/lib/fleetFareInput";
import { buildFleetQuoteDraft, type FleetQuoteDraft } from "@/lib/fleetQuoteDraft";
import { draftFingerprint } from "@/lib/quoteSendGuard";
import { knowledgeDraftLines, knowledgeQuote, knowledgeSummary, LARGE_GROUP_MIN, LARGE_GROUP_VEHICLE, STAFF_PREFIX } from "@/lib/quoteKnowledge";

/**
 * Staff-side quote pre-generation. Small vehicles with fleet rates use the same fleet rate table
 * (buildFleetQuoteDraft) as the admin "依已核對車資產生草稿" button and order conversion; buses and
 * vehicles without a fleet rate get the LINE knowledge-base reference range (lib/quoteKnowledge.ts). Never sends anything to the customer:
 * the result is only written to quoteDraftText / quoteOptions / recommendedVehicle. Reference ranges,
 * 待補 and the internal note stay in quoteOptions.autoDraft; quoteDraftText is customer wording only.
 * The route plan and hours are never inferred from customer text, so an automatic draft never
 * authorizes a fare; it lists what staff still has to fill in.
 */

export const AUTO_DRAFT_VERSION = 1 as const;

export type PrefillSource = {
  tripDate?: string | null;
  passengerCount?: number | null;
  pickup?: string | null;
  destination?: string | null;
  remark?: string | null;
  recommendedVehicle?: string | null;
  quoteOptions?: unknown;
};

export type AutoDraftMeta = {
  version: typeof AUTO_DRAFT_VERSION;
  engine: "fleetQuoteDraft" | "knowledgeBase";
  trigger: "line-webhook" | "backfill";
  generatedAt: string;
  vehicleLabel: string | null;
  /** Vehicle was picked from the head count, not named by the customer; staff confirm it. */
  vehicleByCount: boolean;
  missing: string[];
  /** Staff-only one-line reference (knowledge-base range or fleet-table line). Never in quoteDraftText. */
  reference: string | null;
  /** Knowledge-base range of this row (staff-only); the send guard refuses it in any format. */
  range: { low: number; high: number } | null;
  staffNote: string;
  /** Staff-only detail lines (range, 待補, warnings, notes). Never in quoteDraftText. */
  staffLines: string[];
  /** false until staff edit and save the draft; 「送出給 LINE」 returns 409 while false. */
  staffReviewed: boolean;
  reviewedAt?: string;
  textFingerprint: string;
  sendsToCustomer: false;
};

export type QuotePrefill = {
  quoteDraftText: string;
  recommendedVehicle: string;
  quoteOptions: Record<string, unknown>;
  missing: string[];
  sendsToCustomer: false;
};

export type QuoteEstimate = {
  amountTwd: number | null;
  missing: string[];
  references: string[];
  /** Knowledge-base (報價機器人) reference line for buses or vehicles without a fleet rate. Never an amount. */
  summary: string | null;
};

const COACH_LABEL = "42 人座大巴";
const COACH_PATTERN = /42\s*人座|42\s*座|四十二人座|遊覽車|大巴/;
const ROUTES: FleetRateId[] = ["taipei-day-10h", "taipei-jiufen-10h"];

function text(value: unknown) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  return cleaned === "無" ? "" : cleaned;
}

function count(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Known seat limits only: van 1-8 clear (9 depends on the driver seat), midibus up to 20, coach 42. */
export function vehicleForCount(passengers: number | null): string | null {
  if (passengers == null) return null;
  if (passengers <= 8) return "九人座賓士小車";
  if (passengers <= 20) return "TOYOTA 中巴";
  if (passengers < LARGE_GROUP_MIN) return COACH_LABEL;
  return LARGE_GROUP_VEHICLE; // bus_rules.yaml: 39人以上只推薦43座以上遊覽車或44~45座大巴

}

function draftFor(source: PrefillSource, vehicleHint: string | null, fare: { rateId: FleetRateId | null; hours: number | null }) {
  return buildFleetQuoteDraft({
    pickup: source.pickup,
    destination: source.destination,
    remark: text(source.remark),
    vehicleHint,
    passengerCount: count(source.passengerCount),
    rateId: fare.rateId,
    hours: fare.hours,
  });
}

/** Explicit vehicle in the saved label or remark wins; otherwise pick by passenger count. */
function resolveVehicle(source: PrefillSource, fare: { rateId: FleetRateId | null; hours: number | null }) {
  const saved = text(source.recommendedVehicle);
  const explicit = draftFor(source, saved || null, fare);
  const hint = `${saved} ${text(source.remark)}`;
  if (explicit.vehicleLabel) return { draft: explicit, label: explicit.vehicleLabel };
  if (COACH_PATTERN.test(hint)) return { draft: explicit, label: saved || COACH_LABEL };
  if (saved) return { draft: explicit, label: saved };
  const byCount = vehicleForCount(count(source.passengerCount));
  if (!byCount) return { draft: explicit, label: null };
  const draft = draftFor(source, byCount, fare);
  return { draft, label: draft.vehicleLabel || byCount };
}

function slugFor(label: string | null) {
  if (!label) return null;
  if (/九人座|賓士|小車/.test(label)) return "mercedes-van";
  if (/中巴|toyota/i.test(label)) return "toyota-midibus";
  return null;
}

function referenceLines(label: string | null) {
  const slug = slugFor(label);
  if (!slug) return [];
  const record = fleetQuoteRecord(slug);
  return ROUTES.map((id) => {
    const amount = confirmedVehicleRate(slug, id);
    const rate = record?.rates.find((item) => item.id === id);
    return amount == null ? null : `${label} ${rate?.label || id} ${amount} 元`;
  }).filter((line): line is string => Boolean(line));
}

function missingFor(source: PrefillSource, draft: FleetQuoteDraft, label: string | null, fare: { rateId: FleetRateId | null; hours: number | null }) {
  const missing: string[] = [];
  if (!text(source.tripDate)) missing.push("日期");
  if (count(source.passengerCount) == null) missing.push("人數");
  if (!text(source.pickup)) missing.push("出發地");
  if (!text(source.destination)) missing.push("目的地");
  if (!label) missing.push("車型");
  if (!fare.rateId) missing.push("路線方案");
  if (fare.hours == null) missing.push("時數");
  if (missing.length === 0 && draft.amountTwd == null) missing.push(label === COACH_LABEL ? "大巴車資" : "人數與車型核對");
  return missing;
}

/** Small vehicles with fleet rates use the fleet table; buses and unknown vehicles use the knowledge base. */
function usesKnowledge(label: string | null) {
  return slugFor(label) === null;
}

function knowledgeFor(source: PrefillSource) {
  return knowledgeQuote({
    tripDate: source.tripDate,
    pickup: source.pickup,
    destination: source.destination,
    remark: source.remark,
    passengerCount: count(source.passengerCount),
  });
}

/** Read-only estimate for the list column. Uses the saved staff fare when there is one. */
export function quoteEstimate(source: PrefillSource): QuoteEstimate {
  const fare = savedFleetFare(source);
  const { draft, label } = resolveVehicle(source, fare);
  if (draft.amountTwd == null && usesKnowledge(label)) {
    const knowledge = knowledgeFor(source);
    return { amountTwd: null, missing: knowledge.missing, references: [], summary: knowledgeSummary(knowledge) };
  }
  return {
    amountTwd: draft.amountTwd,
    missing: draft.amountTwd == null ? missingFor(source, draft, label, fare) : [],
    references: draft.amountTwd == null ? referenceLines(label) : [],
    summary: null,
  };
}

/** Internal note shown to staff only (admin list/detail). Never part of quoteDraftText. */
export const AUTO_DRAFT_STAFF_NOTE = "參考行情｜【自動預生成草稿】LINE 詢價進來時由系統產生，尚未送給客人。請改寫成正式報價並儲存後才能送出。";

/** Drops the fleet draft's own staff-only first and last lines so the body is customer text only. */
function customerFleetText(text: string) {
  const lines = text.split("\n");
  while (lines.length && (/^【後台報價草稿】/.test(lines[0]) || lines[0].trim() === "")) lines.shift();
  while (lines.length && (/^請人員核對後再決定是否送出/.test(lines[lines.length - 1]) || lines[lines.length - 1].trim() === "")) lines.pop();
  return lines.join("\n");
}

/**
 * Builds the staff-only draft for a new or never-generated inquiry. Pure; writes nothing.
 * quoteDraftText holds customer-facing wording only: no knowledge-base range, no 待補 list and no
 * internal note. Those live in quoteOptions.autoDraft for the admin screens. The draft is marked
 * staffReviewed:false so 「送出給 LINE」 refuses it until staff edit and save it.
 */
export function buildQuotePrefill(source: PrefillSource, trigger: AutoDraftMeta["trigger"], now = new Date()): QuotePrefill {
  const fare = { rateId: null, hours: null };
  const { draft, label } = resolveVehicle(source, fare);
  const knowledge = usesKnowledge(label) ? knowledgeFor(source) : null;
  const missing = knowledge ? knowledge.missing : missingFor(source, draft, label, fare);
  const references = referenceLines(label);
  const quoteDraftText = (knowledge ? [
    "您好，感謝您的包車詢價。以下是目前收到的行程資料：",
    "",
    `出發：${text(source.pickup) || "未填"}`,
    `目的：${text(source.destination) || "未填"}`,
    `人數：${count(source.passengerCount) || "未填"}`,
    `日期：${text(source.tripDate) || "未填"}`,
    `建議車型：${label || "待確認"}`,
    `備註：${text(source.remark) || "無"}`,
    "",
    "正式報價會由專人確認行程細節後提供。",
  ].join("\n") : customerFleetText(draft.text)).slice(0, 4500);
  const staffLines = knowledge ? knowledgeDraftLines(knowledge) : [
    `${STAFF_PREFIX}｜待補：${missing.length ? missing.join("、") : "無"}`,
    references.length ? `${STAFF_PREFIX}｜車隊表參考（人員選定路線與時數後才成立）：${references.join("；")}` : `${STAFF_PREFIX}｜車隊表參考：沒有已核對的車資可參考。`,
  ];
  const existing = source.quoteOptions;
  const options: Record<string, unknown> = Array.isArray(existing)
    ? existing.length ? { legacyOptions: existing } : {}
    : { ...object(existing) };
  const meta: AutoDraftMeta = {
    version: AUTO_DRAFT_VERSION,
    engine: knowledge ? "knowledgeBase" : "fleetQuoteDraft",
    trigger,
    generatedAt: now.toISOString(),
    vehicleLabel: label,
    vehicleByCount: Boolean(label) && !text(source.recommendedVehicle),
    missing,
    reference: knowledge ? knowledgeSummary(knowledge) : references.length ? `${STAFF_PREFIX} 車隊表 ${references[0]}` : null,
    range: knowledge?.range ? { low: knowledge.range.low, high: knowledge.range.high } : null,
    staffNote: AUTO_DRAFT_STAFF_NOTE,
    staffLines,
    staffReviewed: false,
    textFingerprint: draftFingerprint(quoteDraftText),
    sendsToCustomer: false,
  };
  options.autoDraft = meta;
  return {
    quoteDraftText,
    recommendedVehicle: text(source.recommendedVehicle) || label || "",
    quoteOptions: options,
    missing,
    sendsToCustomer: false,
  };
}

export function needsPrefill(row: { quoteDraftText?: string | null; quoteStatus?: string | null }) {
  return !text(row.quoteDraftText) && !["ARCHIVED", "SENT", "CONFIRMED"].includes(row.quoteStatus || "");
}
