import { confirmedVehicleRate, type FleetRateId } from "@/lib/fleetCatalog";
import { BUS_DRIVER_FEE, busRangeRow, type BusRouteClass, type BusSeat } from "@/lib/busRangeTable";
import { classifyKnowledgeRoute, formatRange, LARGE_GROUP_MIN } from "@/lib/quoteKnowledge";

/**
 * Customer-facing RANGE quotes (老闆 2026-11-11 14:56：「報給客人的時候是用範圍報價，不是直接定價！
 * 確認客人需求之後再轉給真人客服」). Pure; no network, env or DB access. Never returns a single
 * fixed price: every number reaches the customer as a low～high pair.
 *
 * Sources
 * - 大巴：單一資料表 lib/busRangeTable.ts。雙北／台北市區一日與半日依老闆 15:05 參考表（平日／假日分列，
 *   日期不明顯示平日範圍並註明假日略高；33/34 座三排另列）；桃竹、中彰鹿來回、南部長程、山區沿用知識庫。
 *   沒有涵蓋的路線不給數字（專人報價）。司機服務費另列一行（BUS_DRIVER_FEE），不併入範圍。
 *   一日環島不受理，建議二～四日（round_taiwan_rules.yaml）。
 * - 九人座賓士、中巴：依下列優先順序（SMALL_VEHICLE_PRECEDENCE），第一個有結果的就用：
 *   1. 明確表列（SMALL_RANGE_TABLE）：九人座 雙北／台北一日 NT$6,500～7,500、中巴 雙北一日 NT$9,000～11,000
 *      （老闆 14:56 附的同業行情：賓士 VITO 6,500–7,500、中巴 9,000–11,000）。表列永遠優先，
 *      即使 quoteBook 有同一路線的公司價（九人座 台北一日 7,000）也不會改用 +15% 規則。
 *   2. quoteBook 規則：沒有表列、但 lib/fleetCatalog.ts quoteBook 有確認價的路線（目前是「台北至九份 10 小時」：
 *      九人座 7,000、中巴 9,000），區間 = 價 ～ 價 × 1.15 進位到 500（quoteBookRange）。
 *   3. 其他：不給數字，專人報價。
 *   路線判斷（smallRoute）：目的地含「九份」→ 台北至九份；出發與目的都在雙北 → 雙北一日；其餘無路線。
 */

export type RangeVehicle = "van" | "midibus" | "bus";

export type CustomerRange = {
  vehicle: RangeVehicle | null;
  vehicleLabel: string | null;
  low: number | null;
  high: number | null;
  /** Short route label for the customer, e.g. 「雙北一日」 or 「台北到台中、彰化、鹿港來回」. */
  routeLabel: string | null;
  mountainAddon: boolean;
  /** Big bus only: which band was used (null = no day-specific data or no number). */
  dayType: DayType | null;
  /** Big bus: weekday band shown because the date is unknown and the table has a higher holiday band. */
  holidayHigher: boolean;
  seatLabel: string | null;
  note: string | null;
  blocked: string | null;
  alternatives: string[];
  /** Where the numbers come from (staff-only; never shown to the customer). */
  source: string | null;
};

export type DayType = "weekday" | "holiday";

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * Day type from the customer's date text (2026-12-20, 2026/12/20, 12/20, 12月20日). Without a year
 * the next such date on or after `now` (Asia/Taipei) is used; callers that have the row pass its
 * created_at as `now` (yearBaseOf). Saturday/Sunday = 假日. National
 * holidays are not known here, so a weekday answer says staff confirm holidays.
 */
/**
 * v9: base date for reading a trip date without a year: the inquiry's created_at, so an 8/7 asked on
 * 2026-06-25 stays 2026-08-07 when the draft is (re)generated later. Missing or invalid created_at
 * keeps the previous behaviour (`fallback`, normally now).
 */
export function yearBaseOf(createdAt: Date | string | null | undefined, fallback: Date = new Date()) {
  if (createdAt == null || createdAt === "") return fallback;
  const at = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return Number.isFinite(at.getTime()) ? at : fallback;
}

export function dayTypeOf(date: string | null | undefined, now = new Date()): { dayType: DayType; label: string } | null {
  const value = (date || "").normalize("NFKC");
  const full = value.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  const short = value.match(/(?<!\d)(\d{1,2})\s*[/月]\s*(\d{1,2})\s*[日號]?/);
  let year: number, month: number, day: number;
  const today = new Date(now.getTime() + 8 * 3600e3);
  if (full) [year, month, day] = [Number(full[1]), Number(full[2]), Number(full[3])];
  else if (short) {
    [month, day] = [Number(short[1]), Number(short[2])];
    year = today.getUTCFullYear();
    const candidate = Date.UTC(year, month - 1, day);
    if (candidate < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) year += 1;
  } else return null;
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null;
  const weekday = at.getUTCDay();
  return { dayType: weekday === 0 || weekday === 6 ? "holiday" : "weekday", label: `${month}/${day}（週${WEEKDAY_NAMES[weekday]}）` };
}

function money(value: number) {
  return `NT$${value.toLocaleString("en-US")}`;
}

/** Separate big-bus line, never folded into the range (老闆 15:04). */
export function busDriverFeeLine(date: string | null | undefined, now = new Date()) {
  const day = dayTypeOf(date, now);
  if (!day) return `司機服務費另計：平日 ${money(BUS_DRIVER_FEE.weekday)}、假日 ${money(BUS_DRIVER_FEE.holiday)}`;
  if (day.dayType === "holiday") return `司機服務費另計：${day.label}為假日，${money(BUS_DRIVER_FEE.holiday)}`;
  return `司機服務費另計：${day.label}為平日，${money(BUS_DRIVER_FEE.weekday)}（如遇國定假日以假日 ${money(BUS_DRIVER_FEE.holiday)} 計）`;
}

function busRoute(pickup: string, destination: string, remark: string): BusRouteClass | null {
  if (has(destination, MOUNTAIN)) return classifyKnowledgeRoute(pickup, destination) === "mountain" ? "mountain" : null;
  if (isTaipeiDay(pickup, destination)) return /半日|半天|4\s*小時|四小時|4h/i.test(`${destination} ${remark}`) ? "taipei_half_day" : "taipei_city_day";
  const kb = classifyKnowledgeRoute(pickup, destination);
  if (kb === "taipei_city_short") return /半日|半天|4\s*小時|四小時|4h/i.test(`${destination} ${remark}`) ? "taipei_half_day" : "taipei_city_day";
  if (kb === "uncovered") return null;
  return kb;
}

function busSeat(hint: string, people: number | null): BusSeat {
  if (people != null && people > 34) return "43";
  return /3[34]\s*人?座|三排/.test(hint) ? "33" : "43";
}

export const VAN_TAIPEI_DAY = { low: 6500, high: 7500 } as const;
export const MIDIBUS_TAIPEI_DAY = { low: 9000, high: 11000 } as const;

export type SmallRoute = "taipei_day" | "taipei_jiufen";
type SmallVehicle = Exclude<RangeVehicle, "bus">;
const PEER_SOURCE = "老闆 2026-11-11 同業行情（賓士 VITO 6,500–7,500／中巴 9,000–11,000）";
/** Explicit rows for 九人座／中巴. A row here always wins over the quoteBook +15% rule. */
export const SMALL_RANGE_TABLE: ReadonlyArray<{ vehicle: SmallVehicle; route: SmallRoute; low: number; high: number; label: string; source: string }> = [
  { vehicle: "van", route: "taipei_day", ...VAN_TAIPEI_DAY, label: "雙北一日", source: PEER_SOURCE },
  { vehicle: "midibus", route: "taipei_day", ...MIDIBUS_TAIPEI_DAY, label: "雙北一日", source: PEER_SOURCE },
];
const SMALL_ROUTE_RATE: Record<SmallRoute, { rateId: FleetRateId; label: string }> = {
  taipei_day: { rateId: "taipei-day-10h", label: "雙北一日" },
  taipei_jiufen: { rateId: "taipei-jiufen-10h", label: "台北至九份（10 小時）" },
};
const SMALL_SLUG: Record<SmallVehicle, "mercedes-van" | "toyota-midibus"> = { van: "mercedes-van", midibus: "toyota-midibus" };
/** Order in which a 九人座／中巴 range is resolved; documented in the header. */
export const SMALL_VEHICLE_PRECEDENCE = ["explicitRow", "quoteBookPlus15", "staffQuote"] as const;

export function smallRoute(pickup: string, destination: string): SmallRoute | null {
  if (!pickup || !destination || has(destination, MOUNTAIN)) return null;
  if (destination.includes("九份") && has(pickup, TAIPEI_AREA)) return "taipei_jiufen";
  if (isTaipeiDay(pickup, destination)) return "taipei_day";
  return null;
}

/** 九人座／中巴: explicit row → quoteBook +15% → null (專人報價). */
export function smallVehicleRange(vehicle: SmallVehicle, route: SmallRoute | null) {
  if (!route) return null;
  const row = SMALL_RANGE_TABLE.find((item) => item.vehicle === vehicle && item.route === route);
  if (row) return { low: row.low, high: row.high, routeLabel: row.label, source: row.source, rule: "explicitRow" as const };
  const { rateId, label } = SMALL_ROUTE_RATE[route];
  const book = quoteBookRange(SMALL_SLUG[vehicle], rateId);
  if (book) return { ...book, routeLabel: label, source: `fleetCatalog quoteBook ${SMALL_SLUG[vehicle]} ${rateId}（價 ～ +15% 進位到 500）`, rule: "quoteBookPlus15" as const };
  return null;
}
/**
 * 「未含稅、停車費實報實銷、超時另計」只用在有站上條款支持的車型：中巴（fleetCatalog quoteBook
 * toyota-midibus 與 charterFaq 中巴：不含停車費、過夜停車費（實報實銷）、稅金；台北新北超時另計）。
 * 九人座含停車費、大巴沒有這類條款，所以不加，只留 SURCHARGE_NOTE。不自行判定營業稅。
 */
export const MIDIBUS_TERMS_NOTE = "中巴費用不含稅金，停車費實報實銷，超時另計。";

export const SURCHARGE_NOTE = "假日、夜間、山區或超時可能加價；實際金額由專人確認行程後提供。";
/** quote_rules.yaml missing_fields + 人數. Order is the order the customer is asked. */
export const CUSTOMER_REQUIRED_FIELDS = ["日期", "出發地", "目的地", "人數", "行李件數", "單程或來回"] as const;
export type CustomerField = (typeof CUSTOMER_REQUIRED_FIELDS)[number];

const VEHICLE_LABELS: Record<RangeVehicle, string> = { van: "九人座賓士", midibus: "中巴", bus: "大巴" };
const TAIPEI_AREA = [
  "雙北", "台北", "臺北", "新北", "板橋", "樹林", "三重", "新莊", "中和", "永和", "土城", "三峽", "鶯歌", "蘆洲", "五股", "泰山",
  "林口", "汐止", "淡水", "北投", "士林", "內湖", "南港", "信義", "大安", "中山", "萬華", "松山", "文山", "深坑", "石碇", "坪林",
  "烏來", "新店", "瑞芳", "九份", "金瓜石", "平溪", "十分", "猴硐", "金山", "萬里", "野柳", "八里", "三芝", "石門", "貢寮",
];
const MOUNTAIN = ["日月潭", "清境", "合歡山", "阿里山", "山區"];
const ROUND_TAIWAN_BLOCKED = ["一天環島", "一日環島", "單日環島"];

function clean(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "無" ? "" : text;
}

function has(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

/** Explicit vehicle words win; otherwise by head count (≤8 九人座, 9–20 中巴, 21+ 大巴). */
export function rangeVehicle(input: { passengerCount?: number | null; remark?: string | null; recommendedVehicle?: string | null }): RangeVehicle | null {
  const hint = `${clean(input.recommendedVehicle)} ${clean(input.remark)}`;
  if (/大巴|遊覽車|4[2-5]\s*人?座|四十/.test(hint)) return "bus";
  if (/中巴|toyota|coaster/i.test(hint)) return "midibus";
  if (/九人座|9\s*人座|賓士|vito|小車/i.test(hint)) return "van";
  const count = typeof input.passengerCount === "number" && input.passengerCount > 0 ? input.passengerCount : null;
  if (count == null) return null;
  if (count <= 8) return "van";
  if (count <= 20) return "midibus";
  return "bus";
}

export function isTaipeiDay(pickup: string, destination: string) {
  return Boolean(pickup && destination) && has(pickup, TAIPEI_AREA) && has(destination, TAIPEI_AREA) && !has(destination, MOUNTAIN);
}

/** quoteBook price as the low end, +15% rounded up to the next 500 as the high end. */
export function quoteBookRange(slug: "mercedes-van" | "toyota-midibus", rateId: FleetRateId) {
  const amount = confirmedVehicleRate(slug, rateId);
  if (amount == null) return null;
  return { low: amount, high: Math.ceil((amount * 1.15) / 500) * 500 };
}

function roundTaiwan(all: string): Pick<CustomerRange, "blocked" | "alternatives"> | null {
  if (!has(all, ROUND_TAIWAN_BLOCKED)) return null;
  return {
    blocked: "一日環島無法安排：環島約 950～1000 公里，超過法規每日駕車 10 小時、每日總工時 12 小時的限制。",
    alternatives: ["二日環島", "三日環島", "四日深度環島"],
  };
}

export function customerRange(input: { passengerCount?: number | null; pickup?: string | null; destination?: string | null; remark?: string | null; recommendedVehicle?: string | null; date?: string | null }, now = new Date()): CustomerRange {
  const pickup = clean(input.pickup);
  const destination = clean(input.destination);
  const remark = clean(input.remark);
  const vehicle = rangeVehicle(input);
  const base: CustomerRange = { vehicle, vehicleLabel: vehicle ? VEHICLE_LABELS[vehicle] : null, low: null, high: null, routeLabel: null, mountainAddon: false, dayType: null, holidayHigher: false, seatLabel: null, note: null, blocked: null, alternatives: [], source: null };
  const blocked = roundTaiwan(`${pickup} ${destination} ${remark}`);
  if (blocked) return { ...base, ...blocked, source: "round_taiwan_rules.yaml" };
  if (!vehicle || !pickup || !destination) return base;
  if (vehicle === "bus") {
    const route = busRoute(pickup, destination, remark);
    const row = route ? busRangeRow(route, busSeat(`${clean(input.recommendedVehicle)} ${remark}`, input.passengerCount ?? null)) : null;
    if (!row) return { ...base, source: "busRangeTable（未涵蓋）" };
    const day = dayTypeOf(input.date, now);
    const band = row.holiday && day?.dayType === "holiday" ? row.holiday : row.weekday;
    return {
      ...base,
      low: band.low,
      high: band.high,
      routeLabel: row.label,
      mountainAddon: row.route === "mountain",
      dayType: row.holiday ? (day?.dayType === "holiday" ? "holiday" : day ? "weekday" : null) : null,
      holidayHigher: Boolean(row.holiday) && !day,
      seatLabel: row.seatLabel,
      note: row.route === "mountain" ? null : row.note || null,
      source: row.source,
    };
  }
  const small = smallVehicleRange(vehicle, smallRoute(pickup, destination));
  if (small) return { ...base, low: small.low, high: small.high, routeLabel: small.routeLabel, source: small.source };
  return { ...base, source: "沒有表列也沒有 quoteBook 價（專人報價）" };
}

export function rangeText(range: Pick<CustomerRange, "low" | "high" | "mountainAddon">) {
  if (range.low == null || range.high == null) return null;
  return `NT$${formatRange({ low: range.low, high: range.high, label: "", source: "" })}${range.mountainAddon ? " 起，山區另加價" : ""}`;
}

/** Big-bus seat note kept from bus_rules.yaml (39+ only 43–45 座). */
export function vehicleNote(vehicle: RangeVehicle | null, count: number | null) {
  if (vehicle === "bus" && count != null && count >= LARGE_GROUP_MIN) return "43 座以上遊覽車／44～45 座大巴";
  return vehicle ? VEHICLE_LABELS[vehicle] : null;
}
