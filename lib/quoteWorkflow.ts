export type QuoteDraft = {
  tripDate?: string;
  passengerCount?: number;
  pickup?: string;
  destination?: string;
  remark?: string;
};

export type QuoteOption = {
  vehicle: string;
  estimate: string;
  note: string;
};

export function cleanText(value: unknown, limit = 500) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function nextQuoteQuestion(state: string) {
  switch (state) {
    case "trip_date":
      return "請輸入出車日期，例如：2026-06-10";
    case "passenger_count":
      return "請輸入乘車人數，例如：8";
    case "pickup":
      return "請輸入出發地，例如：板橋";
    case "destination":
      return "請輸入目的地，例如：宜蘭";
    case "remark":
      return "請輸入備註，例如：無、需要兒童座椅、行李較多。";
    default:
      return "請輸入「包車」開始詢價。";
  }
}

export function recommendedVehicle(passengerCount = 0) {
  if (passengerCount <= 8) return "九人座";
  if (passengerCount <= 20) return "中巴";
  if (passengerCount <= 43) return "43座";
  return "遊覽車";
}

function estimate(base: number, passengerCount = 0) {
  const groupFactor = passengerCount > 40 ? 3500 : passengerCount > 20 ? 2500 : passengerCount > 8 ? 1500 : 0;
  return `NT$ ${Number(base + groupFactor).toLocaleString("zh-TW")} 起`;
}

export function buildQuoteOptions(draft: QuoteDraft): QuoteOption[] {
  const passengers = draft.passengerCount || 0;
  return [
    { vehicle: "九人座", estimate: estimate(6500, passengers), note: passengers <= 8 ? "建議方案" : "人數可能不足，需拆車或改大車" },
    { vehicle: "中巴", estimate: estimate(12000, passengers), note: passengers <= 20 ? "團體舒適方案" : "人數較多時需確認座位" },
    { vehicle: "43座", estimate: estimate(18000, passengers), note: passengers <= 43 ? "大型團體方案" : "超過 43 人需另派車" },
    { vehicle: "遊覽車", estimate: estimate(22000, passengers), note: "適合校外教學、公司團體與大型活動" },
  ];
}

export function buildQuoteDraftText(draft: QuoteDraft) {
  const options = buildQuoteOptions(draft);
  const recommended = recommendedVehicle(draft.passengerCount || 0);
  return [
    "浮雲輕鬆遊正式報價草稿",
    "",
    `出車日期：${draft.tripDate || "未填"}`,
    `人數：${draft.passengerCount || "未填"}`,
    `出發地：${draft.pickup || "未填"}`,
    `目的地：${draft.destination || "未填"}`,
    `備註：${draft.remark || "無"}`,
    "",
    "AI 估價方案：",
    ...options.map((item) => `- ${item.vehicle}：${item.estimate}（${item.note}）`),
    "",
    `建議車型：${recommended}`,
    "",
    "以上為 AI 初步估價，正式價格仍需依日期、路線、車輛調度與實際需求由真人客服確認。",
  ].join("\n");
}

export function publicQuoteSummary(draft: QuoteDraft) {
  const options = buildQuoteOptions(draft);
  return [
    "已收到您的包車詢價，以下為 AI 初步估價：",
    "",
    ...options.map((item) => `${item.vehicle}：${item.estimate}`),
    "",
    `建議車型：${recommendedVehicle(draft.passengerCount || 0)}`,
    "真人客服會再確認路線與車輛後提供正式報價。",
  ].join("\n");
}
