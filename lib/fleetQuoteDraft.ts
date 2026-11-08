import { confirmedVehicleRate, fleetQuoteRecord, type FleetRateId } from "@/lib/fleetCatalog";

export type QuoteDraftInput = {
  pickup?: string | null;
  destination?: string | null;
  remark?: string | null;
  vehicleHint?: string | null;
  passengerCount?: number | null;
  hours?: number | null;
};

export type FleetQuoteDraft = {
  text: string;
  vehicleSlug: string | null;
  vehicleLabel: string | null;
  amountTwd: number | null;
  pending: string[];
  known: string[];
  sendsToCustomer: false;
};

const VEHICLES = [
  { slug: "mercedes-van", label: "九人座賓士小車", hints: ["賓士", "九人座", "小車", "mercedes"] },
  { slug: "toyota-midibus", label: "TOYOTA 中巴", hints: ["中巴", "toyota"] },
] as const;

const OTHER_PLACES = ["高雄", "台中", "台南", "新竹", "桃園", "基隆", "宜蘭", "花蓮", "台東", "嘉義", "彰化", "苗栗", "南投", "屏東", "新北", "墾丁", "澎湖", "金門", "馬祖", "野柳", "金瓜石", "十分", "平溪", "陰陽海", "東北角", "淡水", "北投", "陽明山", "阿里山", "日月潭", "清境"];

function norm(value: string) {
  return value.replace(/臺/g, "台").replace(/\s+/g, "");
}

function hasMultiStop(value: string) {
  return value.includes("經") || value.includes("多點") || value.includes("沿途") || value.includes("順路") || /[、，,/／]/.test(value) || /和|與|及/.test(value);
}

function otherPlaces(value: string) {
  return OTHER_PLACES.filter((place) => value.includes(place));
}

function explicitCoach(value: string) {
  return /42\s*人座|42\s*座|四十二人座|遊覽車|大巴/.test(value);
}

function matchedVehicle(hint: string) {
  const text = hint.toLowerCase();
  if (explicitCoach(hint)) return [];
  return VEHICLES.filter((vehicle) => vehicle.hints.some((item) => text.includes(item.toLowerCase())));
}

/** A confirmed fare is only a single Taipei origin and one checked destination. */
function matchedRoute(pickup: string, destination: string, remark: string): FleetRateId | null {
  const from = norm(pickup);
  const to = norm(destination);
  const whole = norm(`${pickup}${destination}${remark}`);
  if (!from || !to) return null;
  if (whole.includes("經") || whole.includes("多點") || from.includes("沿途") || to.includes("沿途")) return null;
  if (hasMultiStop(from) || hasMultiStop(to)) return null;
  if (otherPlaces(from).length || otherPlaces(to).length || otherPlaces(norm(remark)).length) return null;
  const taipeiOrigin = from.includes("台北");
  if (!taipeiOrigin) return null;
  if (to.includes("九份") && !to.includes("台北")) return "taipei-jiufen-10h";
  if (!to.includes("九份") && (to.includes("台北") || to.includes("一日"))) return "taipei-day-10h";
  return null;
}

function statedHours(input: QuoteDraftInput) {
  if (typeof input.hours === "number" && Number.isFinite(input.hours)) return input.hours;
  const match = `${input.remark || ""}`.match(/(\d+)\s*小時/);
  return match ? Number(match[1]) : null;
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

/** Staff draft only. Does not send LINE or email. Unknown fees stay pending and are not guessed into the fare. */
export function buildFleetQuoteDraft(input: QuoteDraftInput): FleetQuoteDraft {
  const pickup = (input.pickup || "").trim();
  const destination = (input.destination || "").trim();
  const remark = (input.remark || "").trim();
  const hint = `${input.vehicleHint || ""} ${remark}`;
  const coach = explicitCoach(hint);
  const overloaded = typeof input.passengerCount === "number" && input.passengerCount > 20;
  const vehicles = coach || overloaded ? [] : matchedVehicle(hint);
  const route = matchedRoute(pickup, destination, remark);
  const hours = statedHours(input);
  const vehicle = vehicles.length === 1 ? vehicles[0] : null;
  const context = tripContext(`${pickup} ${destination} ${remark}`);
  const blocked = coach || overloaded || !route;
  const record = vehicle && !blocked ? fleetQuoteRecord(vehicle.slug) : null;
  const applicable = (record?.conditions || []).filter((line) => termApplies(line, route, context));
  const known = applicable.filter((line) => !isPending(line));
  const pending = applicable.filter((line) => isPending(line));

  let amount: number | null = null;
  let fareLine = "已核對車資：沒有可確認金額。";
  if (coach) {
    fareLine = "已指明 42 人座。沒有已核對車資，不改顯示小車或中巴價格。";
  } else if (overloaded) {
    fareLine = "人數超過中巴最多 20 位乘客。沒有已核對的更大車資，不改顯示小車價格。";
  } else if (!route) {
    fareLine = "這不是已核對的台北單點行程（台北一日，或台北至九份）。多點、經由其他縣市或跨區長途都不套用車資。";
  } else if (!vehicle) {
    const lines = vehicles.length === 0
      ? ["未指定單一車型，不選定小車或中巴價格。"]
      : VEHICLES.map((item) => {
          const value = hours === 10 ? confirmedVehicleRate(item.slug, route) : null;
          const shown = hours === 10 ? (value === null ? "待確認" : `${value} 元，尚未替你選定`) : "時數不是 10 小時，不套用";
          return `${item.label}：${shown}`;
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
      fareLine = `${label}：${value} 元`;
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
    amount === null ? "目前沒有可確認車資。" : "這筆車資可確認。附加費沒有加進去。",
    "",
    conditionTitle,
    ...(known.length ? known.map((line) => `- ${line}`) : ["- 沒有要列入的已知條件。"]),
    "",
    "待確認",
    ...(pending.length ? pending.map((line) => `- ${line}`) : ["- 沒有要列入的待確認項目。"]),
    "",
    "請人員核對後再決定是否送出。本按鈕不會自動傳送。",
  ].join("\n");

  return {
    text,
    vehicleSlug: vehicle?.slug || null,
    vehicleLabel: vehicle?.label || null,
    amountTwd: amount,
    pending,
    known,
    sendsToCustomer: false,
  };
}
