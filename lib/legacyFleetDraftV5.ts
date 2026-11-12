/**
 * Frozen copy of the v5 「依已核對車資產生草稿」 generator (lib/fleetQuoteDraft.ts buildFleetQuoteDraft at
 * 93867fa…e42ac37, used in production from PR #54 until PR #66 / 16dc6826). It produced the old-format
 * staff drafts that start with 「【後台報價草稿】」. Pure; reads only the fleet catalog (lib/fleetCatalog.ts,
 * unchanged for these fields since e42ac37). Used by regenerateLegacy to tell an untouched old draft from
 * one staff edited: only text that equals this function's output for the row's own data is replaced.
 */
import { confirmedVehicleRate, fleetQuoteRecord, type FleetRateId } from "@/lib/fleetCatalog";
import { isFareHours, isFleetRateId } from "@/lib/fleetQuoteDraft";
import { savedFleetFare } from "@/lib/fleetFareInput";

export type LegacyV5DraftInput = {
  pickup?: string | null;
  destination?: string | null;
  remark?: string | null;
  vehicleHint?: string | null;
  passengerCount?: number | null;
  hours?: number | null;
  rateId?: FleetRateId | null;
};

type CapacityState = "clear" | "pending" | "over" | "not_applicable";

function capacityFor(slug: string, count: number | null): CapacityState {
  if (slug === "mercedes-van") {
    if (count == null) return "pending";
    if (count > 9) return "over";
    if (count === 9) return "pending";
    if (count >= 1 && count <= 8) return "clear";
    return "pending";
  }
  if (slug === "toyota-midibus") {
    if (count == null) return "pending";
    if (count > 20) return "over";
    if (count >= 1 && count <= 20) return "clear";
    return "pending";
  }
  return "pending";
}

const VEHICLES = [
  { slug: "mercedes-van", label: "九人座賓士小車", hints: ["賓士", "九人座", "小車", "mercedes"] },
  { slug: "toyota-midibus", label: "TOYOTA 中巴", hints: ["中巴", "toyota"] },
] as const;

function explicitCoach(value: string) {
  return /42\s*人座|42\s*座|四十二人座|遊覽車|大巴/.test(value);
}

function matchedVehicle(hint: string) {
  const text = hint.toLowerCase();
  if (explicitCoach(hint)) return [];
  return VEHICLES.filter((vehicle) => vehicle.hints.some((item) => text.includes(item.toLowerCase())));
}


function tripContext(text: string) {
  return {
    airport: /機場|航廈|接機|送機|班機/.test(text),
    overnight: /住宿|過夜|多日|隔夜|不能當天/.test(text),
    night: /23\s*點|晚上|夜間|凌晨|22:00|22點/.test(text),
    child: /兒童|安全座椅|孩/.test(text),
  };
}

function termApplies(line: string, route: FleetRateId | null, context: ReturnType<typeof tripContext>) {
  if (/各 7000|用車 10 小時 9000/.test(line)) return false;
  if (/舉牌|航廈|接機|送機|班機/.test(line)) return context.airport;
  if (/住宿/.test(line)) return context.overnight;
  if (/23 點|22:00/.test(line)) return context.night;
  if (/兒童/.test(line)) return context.child;
  if (/一日遊價格未提供/.test(line)) return route === "taipei-day-10h";
  return true;
}

function isPending(line: string) {
  return /未定|未提供|未知|不是單一固定價/.test(line);
}

/** The v5 generator, verbatim except that it returns only the text. */
export function legacyV5FleetDraftText(input: LegacyV5DraftInput): string {
  const pickup = (input.pickup || "").trim();
  const destination = (input.destination || "").trim();
  const remark = (input.remark || "").trim();
  const hint = `${input.vehicleHint || ""} ${remark}`;
  const coach = explicitCoach(hint);
  const count = typeof input.passengerCount === "number" && Number.isInteger(input.passengerCount) ? input.passengerCount : null;
  const vehicles = coach ? [] : matchedVehicle(hint);
  const route = isFleetRateId(input.rateId) ? input.rateId : null;
  const hours = isFareHours(input.hours) ? input.hours : null;
  const vehicle = vehicles.length === 1 ? vehicles[0] : null;
  const capacity: CapacityState = vehicle ? capacityFor(vehicle.slug, count) : "not_applicable";
  const context = tripContext(`${pickup} ${destination} ${remark}`);
  const blocked = coach || !route;
  const record = vehicle && !blocked ? fleetQuoteRecord(vehicle.slug) : null;
  const applicable = (record?.conditions || []).filter((line) => termApplies(line, route, context));
  const known = applicable.filter((line) => !isPending(line));
  const pending = applicable.filter((line) => isPending(line));
  if (vehicle?.slug === "mercedes-van" && capacity === "pending") {
    pending.unshift(count === 9
      ? "人數 9。九人座是否包含司機未確認，不把 9 人當成已經可載。"
      : "未填人數，或人數不在已能確定的範圍。九人座是否包含司機未確認，不猜可載 9 人。");
  }
  if (vehicle?.slug === "toyota-midibus" && capacity === "pending") {
    pending.unshift("未填人數，不能核對是否超過中巴最多 20 位乘客。");
  }
  if (capacity === "over") {
    pending.unshift(vehicle?.slug === "mercedes-van"
      ? "人數超過九個座位。九人座是否包含司機未確認，也不把超過 9 的人數當成可載。"
      : "人數超過中巴最多 20 位乘客。沒有已核對的更大車資，不改顯示小車價格。");
  }

  let amount: number | null = null;
  let fareLine = "基本車資：沒有可確認金額。";
  if (coach) {
    fareLine = "已指明 42 人座。沒有已核對車資，不改顯示小車或中巴價格。";
  } else if (!route) {
    fareLine = "尚未由人員明選已核對的單點路線（台北一日，或台北至九份）。自由文本、多點或跨區行程不自動套用車資。";
  } else if (capacity === "over") {
    fareLine = pending[0] || "人數超過已知座位，不確認基本車資。";
  } else if (capacity === "pending") {
    fareLine = "人數邊界還沒核對，不確認基本車資。";
  } else if (!vehicle) {
    const lines = vehicles.length === 0
      ? ["未指定單一車型，不選定小車或中巴價格。"]
      : VEHICLES.map((item) => {
          const itemCapacity = capacityFor(item.slug, count);
          if (hours !== 10) return `${item.label}：時數不是 10 小時，不套用`;
          if (itemCapacity !== "clear") return `${item.label}：人數未核對到可載範圍，不套用`;
          const value = confirmedVehicleRate(item.slug, route);
          return `${item.label}：${value === null ? "待確認" : `基本車資 ${value} 元，尚未替你選定，也不是總價`}`;
        });
    fareLine = lines.join("\n");
  } else if (hours === null) {
    const reference = confirmedVehicleRate(vehicle.slug, route);
    const label = record?.rates.find((rate) => rate.id === route)?.label || route;
    fareLine = reference === null
      ? `${label}：沒有已核對金額。未填時數，不能確認。`
      : `未填時數，不能確認金額。10 小時方案僅供參考：${label} ${reference} 元。這不是可確認金額。`;
  } else if (hours !== 10) {
    fareLine = `時數 ${hours} 小時，不是已核對的 10 小時，不套用該車資。`;
  } else {
    const value = confirmedVehicleRate(vehicle.slug, route);
    const label = record?.rates.find((rate) => rate.id === route)?.label || route;
    if (value === null) fareLine = `${label}：待確認`;
    else {
      amount = value;
      fareLine = `${label}：基本車資 ${value} 元。這不是總價。`;
    }
  }

  const hoursNote = hours === null ? "時數：未填。只能把 10 小時方案當參考。" : hours === 10 ? "時數：10 小時。" : `時數：${hours} 小時。`;
  const conditionTitle = amount === null ? "參考或本趟適用的已知條件" : "已知條件";
  const text = [
    "【後台報價草稿】尚未送給客人。",
    "",
    `出發：${pickup || "未填"}`,
    `目的：${destination || "未填"}`,
    `人數：${input.passengerCount || "未填"}`,
    `車型：${vehicle?.label || (coach ? "42 人座" : "未指定")}`,
    hoursNote,
    "",
    "車資",
    fareLine,
    amount === null ? "目前沒有可確認的基本車資，也沒有總價。" : "上面是基本車資，不是總價。附加費沒有加進去，也還沒變成客人已確認的訂單。",
    "",
    conditionTitle,
    ...(known.length ? known.map((line) => `- ${line}`) : ["- 沒有要列入的已知條件。"]),
    "",
    "待確認",
    ...(pending.length ? pending.map((line) => `- ${line}`) : ["- 沒有要列入的待確認項目。"]),
    "",
    "請人員核對後再決定是否送出。本按鈕不會自動傳送。",
  ].join("\n");

  return text;
}

type LegacyRow = {
  pickup?: string | null;
  destination?: string | null;
  remark?: string | null;
  recommendedVehicle?: string | null;
  passengerCount?: number | null;
  quoteOptions?: unknown;
};

/**
 * The v5 button text for this row from its own stored data: the v5 page sent vehicleHint = the 建議車型
 * box (recommendedVehicle) and the route stored rateId/hours in quoteOptions.fleetFare, then saved
 * recommendedVehicle = the matched vehicle label (so the stored value reproduces the same vehicle).
 */
export function legacyV5DraftForRow(row: LegacyRow): string {
  const fare = savedFleetFare(row);
  return legacyV5FleetDraftText({
    pickup: row.pickup,
    destination: row.destination,
    remark: row.remark,
    vehicleHint: row.recommendedVehicle,
    passengerCount: row.passengerCount,
    hours: fare.hours,
    rateId: fare.rateId,
  });
}

/** True only when the stored text is exactly (byte for byte) what the v5 button produced for this row. */
export function isUntouchedLegacyV5Draft(row: LegacyRow & { quoteDraftText?: string | null }) {
  return typeof row.quoteDraftText === "string" && row.quoteDraftText === legacyV5DraftForRow(row);
}
