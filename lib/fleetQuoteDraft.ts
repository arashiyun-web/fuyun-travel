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
  sendsToCustomer: false;
};

const VEHICLES = [
  { slug: "mercedes-van", label: "九人座賓士小車", hints: ["賓士", "九人座", "小車", "mercedes"] },
  { slug: "toyota-midibus", label: "TOYOTA 中巴", hints: ["中巴", "toyota"] },
] as const;

function norm(value: string) {
  return value.replace(/臺/g, "台").replace(/\s+/g, "");
}

function matchedVehicle(hint: string) {
  const text = hint.toLowerCase();
  return VEHICLES.filter((vehicle) => vehicle.hints.some((item) => text.includes(item.toLowerCase())));
}

function matchedRoute(pickup: string, destination: string): FleetRateId | null {
  const from = norm(pickup);
  const to = norm(destination);
  if (!from || !to) return null;
  if (to.includes("九份") && from.includes("台北")) return "taipei-jiufen-10h";
  if (from.includes("台北") && !to.includes("九份") && (to.includes("台北") || to.includes("一日"))) return "taipei-day-10h";
  return null;
}

function statedHours(input: QuoteDraftInput) {
  if (typeof input.hours === "number" && Number.isFinite(input.hours)) return input.hours;
  const match = `${input.remark || ""}`.match(/(\d+)\s*小時/);
  return match ? Number(match[1]) : null;
}

function pendingFor(slug: string) {
  if (slug === "mercedes-van") {
    return [
      "訂金金額：待確認",
      "兒童安全座椅是否收費：待確認",
      "晚上 23 點後加價金額：待確認",
      "超時是否發生：待確認。若發生，已核對為半小時 300 元、1 小時 500 元；不足該段如何進位未寫死，不自動加總",
    ];
  }
  return [
    "台北一日遊車資：待確認",
    "22:00–06:30 加價為 500–2000 元區間，是否適用：待確認，不自動加總",
    "司機住宿補貼：待確認",
    "停車費、門票、接駁、稅金：不含在車資內，實報實銷或待確認",
  ];
}

/** Staff draft only. Does not send LINE or email. Unknown fees stay pending and are not guessed into the fare. */
export function buildFleetQuoteDraft(input: QuoteDraftInput): FleetQuoteDraft {
  const pickup = (input.pickup || "").trim();
  const destination = (input.destination || "").trim();
  const hint = `${input.vehicleHint || ""} ${input.remark || ""}`;
  const vehicles = matchedVehicle(hint);
  const route = matchedRoute(pickup, destination);
  const hours = statedHours(input);
  const hoursNote = hours === null ? "未填時數，先對照已核對的 10 小時方案。" : hours === 10 ? "時數 10 小時，與已核對方案相同。" : `時數 ${hours} 小時，不是已核對的 10 小時，不套用該車資。`;
  const useRate = hours === null || hours === 10;
  const vehicle = vehicles.length === 1 ? vehicles[0] : null;
  const pending = [...(vehicle ? pendingFor(vehicle.slug) : ["未指定單一車型，請由人員選擇後再決定是否送出。"])];
  if (!route) pending.unshift("這條路線沒有已核對車資。");

  let amount: number | null = null;
  let fareLine = "已核對車資：待確認";
  if (vehicle && route && useRate) {
    amount = confirmedVehicleRate(vehicle.slug, route);
    const record = fleetQuoteRecord(vehicle.slug);
    const label = record?.rates.find((rate) => rate.id === route)?.label || route;
    fareLine = amount === null ? `${label}：待確認` : `${label}：${amount} 元`;
  } else if (!vehicle && route && useRate) {
    fareLine = VEHICLES.map((item) => {
      const value = confirmedVehicleRate(item.slug, route);
      return `${item.label}：${value === null ? "待確認" : `${value} 元`}`;
    }).join("\n");
  }

  const text = [
    "【後台報價草稿】尚未送給客人。",
    "",
    `出發：${pickup || "未填"}`,
    `目的：${destination || "未填"}`,
    `人數：${input.passengerCount || "未填"}`,
    `車型：${vehicle?.label || "未指定"}`,
    hoursNote,
    "",
    "車資",
    fareLine,
    "此車資不是總價，附加費沒有加進去。",
    "",
    "待確認",
    ...pending.map((line) => `- ${line}`),
    "",
    "請人員核對後再決定是否送出。本按鈕不會自動傳送。",
  ].join("\n");

  return { text, vehicleSlug: vehicle?.slug || null, vehicleLabel: vehicle?.label || null, amountTwd: amount, pending, sendsToCustomer: false };
}
