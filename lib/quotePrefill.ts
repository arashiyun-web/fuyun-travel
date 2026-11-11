import { confirmedVehicleRate, fleetQuoteRecord, type FleetRateId } from "@/lib/fleetCatalog";
import { savedFleetFare } from "@/lib/fleetFareInput";
import { buildFleetQuoteDraft } from "@/lib/fleetQuoteDraft";
import { draftFingerprint } from "@/lib/quoteSendGuard";
import { missingFields, parseLuggage, parseTripType, rangeDraftText } from "@/lib/quoteConversation";
import { customerRange } from "@/lib/quoteRange";
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

export const AUTO_DRAFT_VERSION = 2 as const;

export type PrefillSource = {
  tripDate?: string | null;
  passengerCount?: number | null;
  pickup?: string | null;
  destination?: string | null;
  remark?: string | null;
  recommendedVehicle?: string | null;
  quoteOptions?: unknown;
  /** Collected by the LINE conversation; otherwise read from the remark. */
  luggage?: string | null;
  tripType?: string | null;
};

export type AutoDraftMeta = {
  version: typeof AUTO_DRAFT_VERSION;
  engine: "rangeQuote";
  /** Staff reference source behind the staff lines: fleet table or knowledge base. */
  staffSource: "fleetQuoteDraft" | "knowledgeBase";
  /** The customer-facing range written into quoteDraftText (null = 專人報價, no number). */
  customerRange: { vehicle: string | null; low: number | null; high: number | null; routeLabel: string | null; source: string | null };
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

function conversationFields(source: PrefillSource) {
  const remark = text(source.remark);
  return {
    date: text(source.tripDate),
    people: count(source.passengerCount),
    origin: text(source.pickup),
    destination: text(source.destination),
    note: remark,
    luggage: text(source.luggage) || parseLuggage(remark),
    tripType: text(source.tripType) || parseTripType(remark),
    vehicle: text(source.recommendedVehicle),
  };
}

function rangeSummary(source: PrefillSource) {
  const fields = conversationFields(source);
  const range = customerRange({ passengerCount: fields.people, pickup: fields.origin, destination: fields.destination, remark: [fields.note, fields.tripType].join(" "), recommendedVehicle: fields.vehicle, date: fields.date });
  const missing = missingFields(fields);
  const tail = missing.length ? `｜待補：${missing.join("、")}` : "";
  if (range.blocked) return { missing, summary: `${STAFF_PREFIX}：一日環島不受理，建議二～四日${tail}` };
  if (range.low == null || range.high == null) return { missing, summary: `${STAFF_PREFIX}：客人範圍待專人報價${tail}` };
  return { missing, summary: `${STAFF_PREFIX} 客人範圍 ${range.low.toLocaleString("en-US")}～${range.high.toLocaleString("en-US")}${range.mountainAddon ? "＋山區加價" : ""}${tail}` };
}

/** Read-only estimate for the list column (staff only). A staff-confirmed fleet fare shows as the base fare. */
export function quoteEstimate(source: PrefillSource): QuoteEstimate {
  const fare = savedFleetFare(source);
  const { draft, label } = resolveVehicle(source, fare);
  const { missing, summary } = rangeSummary(source);
  if (draft.amountTwd != null) return { amountTwd: draft.amountTwd, missing: [], references: [], summary };
  return { amountTwd: null, missing, references: usesKnowledge(label) ? [] : referenceLines(label), summary };
}

/** Internal note shown to staff only (admin list/detail). Never part of quoteDraftText. */
export const AUTO_DRAFT_STAFF_NOTE = "參考行情｜【自動預生成草稿】LINE 詢價進來時由系統產生的範圍報價草稿，尚未送給客人；送出前請專人確認行程。";

/**
 * Builds the draft for a new or never-generated inquiry. Pure; writes nothing.
 * quoteDraftText is the customer-safe RANGE quote (lib/quoteConversation.ts rangeDraftText): a
 * low～high range per vehicle type, the surcharge note and the questions still open — never a single
 * fixed price and never staff wording. Staff references (knowledge-base lines, fleet-table prices,
 * 待補) live only in quoteOptions.autoDraft.
 */
export function buildQuotePrefill(source: PrefillSource, trigger: AutoDraftMeta["trigger"], now = new Date()): QuotePrefill {
  const fare = { rateId: null, hours: null };
  const { label } = resolveVehicle(source, fare);
  const knowledge = usesKnowledge(label) ? knowledgeFor(source) : null;
  const fields = conversationFields(source);
  const missing = missingFields(fields);
  const references = referenceLines(label);
  const range = customerRange({ passengerCount: fields.people, pickup: fields.origin, destination: fields.destination, remark: [fields.note, fields.tripType].join(" "), recommendedVehicle: fields.vehicle, date: fields.date }, now);
  const quoteDraftText = rangeDraftText(fields, now);
  const staffLines = knowledge ? knowledgeDraftLines(knowledge) : [
    `${STAFF_PREFIX}｜待補：${missing.length ? missing.join("、") : "無"}`,
    references.length ? `${STAFF_PREFIX}｜車隊表參考（人員選定路線與時數後才成立）：${references.join("；")}` : `${STAFF_PREFIX}｜車隊表參考：沒有已核對的車資可參考。`,
  ];
  staffLines.push(`${STAFF_PREFIX}｜客人範圍來源：${range.source || "資料不足，未給數字"}`);
  const existing = source.quoteOptions;
  const options: Record<string, unknown> = Array.isArray(existing)
    ? existing.length ? { legacyOptions: existing } : {}
    : { ...object(existing) };
  const meta: AutoDraftMeta = {
    version: AUTO_DRAFT_VERSION,
    engine: "rangeQuote",
    staffSource: knowledge ? "knowledgeBase" : "fleetQuoteDraft",
    customerRange: { vehicle: range.vehicle, low: range.low, high: range.high, routeLabel: range.routeLabel, source: range.source },
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
