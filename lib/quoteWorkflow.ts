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

export function recommendedVehicle(passengerCount = 0) {
  if (passengerCount >= 32) return "43座以上遊覽車 / 44-45座大巴";
  return "依人數推薦最適合車型。";
}

function quoteFormatter(vehicle: string) {
  return [
    "【AI 初步行情參考】",
    "",
    "車型：",
    vehicle || "依人數推薦最適合車型。",
    "",
    "初步行情：",
    "NT$11,000 ~ NT$12,500 起",
    "",
    "價格成分說明：",
    "- 車資",
    "- 發票5%",
    "- 過路費",
    "- 停車費",
    "- 司機小費1000~2000（司機小費 NT$1,000~2,000 / 天）",
    "- 司機誤餐費250/餐（若未隨團用餐，每餐 NT$250）",
    "- 工時計算不含空車回送",
    "",
    "提醒：",
    "此為 AI 初步行情，正式報價需由真人客服確認日期、路線、車輛與調度狀況。",
  ].join("\n");
}

export function buildQuoteOptions(draft: QuoteDraft): QuoteOption[] {
  const passengers = draft.passengerCount || 0;
  return [{ vehicle: recommendedVehicle(passengers), estimate: "NT$11,000 ~ NT$12,500 起", note: "AI 初步行情參考" }];
}

export function buildQuoteDraftText(draft: QuoteDraft) {
  const recommended = recommendedVehicle(draft.passengerCount || 0);
  return [
    "浮雲旅遊 AI 初步行情草稿",
    "",
    "出車日期：" + (draft.tripDate || "未填"),
    "人數：" + (draft.passengerCount || "未填"),
    "出發地：" + (draft.pickup || "未填"),
    "目的地：" + (draft.destination || "未填"),
    "備註：" + (draft.remark || "無"),
    "",
    quoteFormatter(recommended),
  ].join("\n");
}

export function publicQuoteSummary(draft: QuoteDraft) {
  return quoteFormatter(recommendedVehicle(draft.passengerCount || 0));
}
