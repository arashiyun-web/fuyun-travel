import { BUS_DRIVER_FEE, busRangeRow } from "@/lib/busRangeTable";

/**
 * LINE 客服知識庫的大巴行情（報價機器人），移植自 backend/knowledge_base 與 backend/app/pricing_rules.py。
 * 只給「參考行情」，永遠不是確定金額，不寫進 CharterOrder，也不送給客人。
 * 每個數字與文字的來源檔都寫在旁邊；不得在這裡新增來源檔沒有的數字。
 */

export type KnowledgeRouteClass =
  | "taipei_city_short"
  | "taipei_to_taoyuan_hsinchu"
  | "taipei_to_taichung_changhua_lukang_round_trip"
  | "taipei_to_south_long"
  | "mountain"
  | "uncovered";

export type KnowledgeRange = { low: number; high: number; label: string; source: string };

/** 大巴範圍來自單一資料表 lib/busRangeTable.ts（台北市區短程改用老闆 15:05 參考表的 43 座平日一日範圍）。 */
function tableRange(route: Parameters<typeof busRangeRow>[0]): KnowledgeRange {
  const row = busRangeRow(route);
  if (!row) throw new Error(`bus range table has no row for ${route}`);
  const seat = row.seatLabel ? ` ${row.seatLabel}` : "";
  const holiday = row.holiday ? `平日；假日 ${row.holiday.low.toLocaleString("en-US")}～${row.holiday.high.toLocaleString("en-US")}` : "";
  return { low: row.weekday.low, high: row.weekday.high, label: `${row.label}${seat}${holiday ? ` ${holiday}` : ""}`, source: row.source };
}
const RANGES: Record<Exclude<KnowledgeRouteClass, "mountain" | "uncovered">, KnowledgeRange> = {
  taipei_city_short: tableRange("taipei_city_day"),
  taipei_to_taoyuan_hsinchu: tableRange("taipei_to_taoyuan_hsinchu"),
  taipei_to_taichung_changhua_lukang_round_trip: tableRange("taipei_to_taichung_changhua_lukang_round_trip"),
  taipei_to_south_long: tableRange("taipei_to_south_long"),
};

/** Every knowledge-base bus range; the send guard refuses any of these low/high pairs in outgoing text. */
export const KNOWLEDGE_RANGES: ReadonlyArray<{ low: number; high: number }> = Object.values(RANGES).map(({ low, high }) => ({ low, high }));

/** Prefix on every staff-only knowledge-base line and summary; the send guard refuses it. */
export const STAFF_PREFIX = "參考行情";

/** 地名清單來源：backend/app/pricing_rules.py */
// pricing_rules.py NORTHERN_ORIGINS
const NORTHERN = ["樹林", "板橋", "新北", "台北", "臺北", "雙北"];
// pricing_rules.py NEAR_DESTINATIONS
const NEAR = ["桃園", "新竹"];
// pricing_rules.py CENTRAL_DESTINATIONS 的中部部分（嘉義以南依 pricing_matrix.yaml 改列南部長程）
const CENTRAL = ["苗栗", "台中", "臺中", "彰化", "鹿港", "雲林", "雲林縣"];
// pricing_rules.py CENTRAL_DESTINATIONS 的南部部分；pricing_rules.py 歸 16~22k，與 pricing_matrix.yaml 不一致，以 yaml 的 taipei_to_south_long 為準
const SOUTH = ["嘉義", "嘉義縣", "嘉義市", "台南", "臺南", "高雄", "屏東"];
// pricing_rules.py MOUNTAIN_DESTINATIONS
const MOUNTAIN = ["日月潭", "清境", "合歡山", "阿里山", "山區"];

/** 來源：backend/knowledge_base/pricing_matrix.yaml mountain_addon "日月潭、清境、山區另加價" */
const MOUNTAIN_ADDON = "日月潭、清境、山區另加價";

/** 加註項目。來源：老闆 15:04 司機服務費（取代 driver_tip）/ pricing_matrix.yaml driver_meal / work_hours，quote_rules.yaml price_components */
export const KNOWLEDGE_NOTES = [
  `司機服務費另計：平日 NT$${BUS_DRIVER_FEE.weekday.toLocaleString("en-US")}、假日 NT$${BUS_DRIVER_FEE.holiday.toLocaleString("en-US")}`, // 老闆 2026-11-11 15:04（取代 pricing_matrix.yaml driver_tip 舊的司機小費）
  "司機誤餐費 NT$250／餐", // pricing_matrix.yaml driver_meal
  "工時計算不含空車回送", // pricing_matrix.yaml work_hours
  "發票 5%", // quote_rules.yaml price_components
  "過路費", // quote_rules.yaml price_components
  "停車費", // quote_rules.yaml price_components
];

/** 缺任一欄位不得正式報價。來源：quote_rules.yaml missing_fields */
export const KNOWLEDGE_REQUIRED_FIELDS = ["日期", "出發地", "目的地", "行李件數", "單程或來回"];

/** 來源：bus_rules.yaml large_group_vehicle / vehicle_44_45_bus.yaml rule */
export const LARGE_GROUP_MIN = 39;
export const LARGE_GROUP_VEHICLE = "43座以上遊覽車／44～45座大巴";

/** 來源：round_taiwan_rules.yaml */
const ROUND_TAIWAN_BLOCKED = ["一天環島", "一日環島", "單日環島"]; // blocked_keywords
const ROUND_TAIWAN_REASON = "環島約950-1000公里；法規每日駕車10小時、每日總工時12小時"; // distance + legal_limits
const ROUND_TAIWAN_ALTERNATIVES = ["二日環島", "三日環島", "四日深度環島"]; // alternatives

/** 來源：bus_rules.yaml luggage_limit_44_45；觸發條件來源：luggage_guardrail.yaml trigger（42人以上且每人攜帶28吋行李） */
const LUGGAGE_MIN_PEOPLE = 42;
const LUGGAGE_WARNING = "42人以上且每人攜帶28吋行李時，44~45座大巴約可放置35件左右28吋行李，可能無法全部裝載。建議增派行李車、增派接駁車或升級大型車輛。";

export type KnowledgeInput = {
  tripDate?: string | null;
  pickup?: string | null;
  destination?: string | null;
  remark?: string | null;
  passengerCount?: number | null;
};

export type KnowledgeQuote = {
  routeClass: KnowledgeRouteClass;
  range: KnowledgeRange | null;
  mountainAddon: string | null;
  blocked: string | null;
  alternatives: string[];
  missing: string[];
  warnings: string[];
  notes: string[];
  /** Always null: a knowledge-base range is never a confirmed amount. */
  amountTwd: null;
  sendsToCustomer: false;
};

function has(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function clean(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "無" ? "" : text;
}

/**
 * Origin must be in NORTHERN; destination decides the class. A destination the table does not
 * name (e.g. 花蓮) is "uncovered" — pricing_rules.py would default it to taipei_short; we do not.
 */
export function classifyKnowledgeRoute(pickup: string, destination: string): KnowledgeRouteClass {
  if (!has(pickup, NORTHERN) || !destination) return "uncovered";
  if (has(destination, MOUNTAIN)) return "mountain";
  if (has(destination, SOUTH)) return "taipei_to_south_long";
  if (has(destination, CENTRAL)) return "taipei_to_taichung_changhua_lukang_round_trip";
  if (has(destination, NEAR)) return "taipei_to_taoyuan_hsinchu";
  if (has(destination, NORTHERN)) return "taipei_city_short";
  return "uncovered";
}

function luggageGiven(remark: string) {
  return /行李|背包|行李箱/.test(remark);
}

function tripTypeGiven(remark: string) {
  return /來回|單程|去回|往返/.test(remark);
}

export function knowledgeQuote(input: KnowledgeInput): KnowledgeQuote {
  const pickup = clean(input.pickup);
  const destination = clean(input.destination);
  const remark = clean(input.remark);
  const all = `${pickup} ${destination} ${remark}`;
  const people = typeof input.passengerCount === "number" && Number.isInteger(input.passengerCount) ? input.passengerCount : null;
  const missing: string[] = [];
  if (!clean(input.tripDate)) missing.push("日期");
  if (people == null) missing.push("人數");
  if (!pickup) missing.push("出發地");
  if (!destination) missing.push("目的地");
  if (!luggageGiven(remark)) missing.push("行李件數");
  if (!tripTypeGiven(remark)) missing.push("單程或來回");

  const warnings: string[] = [];
  if (people != null && people >= LUGGAGE_MIN_PEOPLE && /28\s*吋/.test(all)) warnings.push(LUGGAGE_WARNING);

  if (has(all, ROUND_TAIWAN_BLOCKED)) {
    return {
      routeClass: "uncovered", range: null, mountainAddon: null,
      blocked: `一日環島不受理：${ROUND_TAIWAN_REASON}。`,
      alternatives: ROUND_TAIWAN_ALTERNATIVES.slice(),
      missing, warnings, notes: KNOWLEDGE_NOTES.slice(), amountTwd: null, sendsToCustomer: false,
    };
  }

  const routeClass = classifyKnowledgeRoute(pickup, destination);
  // 山區：pricing_rules.py quote_range 的 mountain 分支回 "NT$16,000~22,000 起，山區另加價"（數字同 pricing_matrix.yaml 中部來回）
  const range = routeClass === "uncovered" ? null
    : routeClass === "mountain" ? { ...tableRange("mountain"), label: "台北到山區，基準依 pricing_rules.py 山區分支，另加價" }
    : RANGES[routeClass];
  return {
    routeClass,
    range,
    mountainAddon: routeClass === "mountain" ? MOUNTAIN_ADDON : null,
    blocked: null,
    alternatives: [],
    missing,
    warnings,
    notes: KNOWLEDGE_NOTES.slice(),
    amountTwd: null,
    sendsToCustomer: false,
  };
}

export function formatRange(range: KnowledgeRange) {
  return `${range.low.toLocaleString("en-US")}～${range.high.toLocaleString("en-US")}`;
}

/** One-line column summary, e.g. 「參考行情 16,000～22,000｜待補：行李件數」. Always starts with 參考行情. */
export function knowledgeSummary(quote: KnowledgeQuote) {
  const tail = quote.missing.length ? `｜待補：${quote.missing.join("、")}` : "";
  if (quote.blocked) return `${STAFF_PREFIX}：一日環島不受理，建議${quote.alternatives.join("／")}${tail}`;
  if (!quote.range) return `${STAFF_PREFIX}：行情表未涵蓋，待人工${tail}`;
  return `${STAFF_PREFIX} ${formatRange(quote.range)}${quote.mountainAddon ? "＋山區加價" : ""}${tail}`;
}

/** Draft lines for staff. Range is labelled as a reference and never as a confirmed price. */
export function knowledgeDraftLines(quote: KnowledgeQuote) {
  const lines: string[] = [];
  if (quote.blocked) {
    lines.push(quote.blocked, `建議改為：${quote.alternatives.join("、")}（round_taiwan_rules.yaml）`);
  } else if (quote.range) {
    lines.push(`參考行情 NT$${formatRange(quote.range)}（大巴範圍表：${quote.range.label}；來源 ${quote.range.source}）。這不是確定金額。`);
    if (quote.mountainAddon) lines.push(`山區：${quote.mountainAddon}（pricing_matrix.yaml mountain_addon）`);
  } else {
    lines.push("行情表未涵蓋，待人工（知識庫 pricing_matrix 沒有這條路線，不套用其他路線行情）。");
  }
  lines.push(`待補：${quote.missing.length ? quote.missing.join("、") : "無"}${quote.missing.length ? "（quote_rules：缺任一項不給正式價）" : ""}`);
  for (const warning of quote.warnings) lines.push(`行李警示：${warning}`);
  lines.push(`加註：${quote.notes.join("、")}`);
  return lines.map((line) => (line.startsWith(STAFF_PREFIX) ? line : `${STAFF_PREFIX}｜${line}`));
}
