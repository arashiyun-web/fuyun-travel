export const companyConfig = {
  siteUrl: "https://fuyuntravel.com",
  brandName: "浮雲輕鬆遊",
  travelAgencyName: "雲驛旅行社有限公司",
  transportCompanyName: "雲陞通運有限公司",
  founder: "雲惠民",
  taxId: "60675708",
  agencyType: "甲種旅行社",
  agencyRegistrationNo: "882200",
  qualityAssuranceNo: "北2760",
  performanceBondProvider: "旺旺友聯產物保險",
  performanceBondAmount: "1500萬元",
  phone: "02-2685-1666",
  fax: "02-2685-1528",
  email: "yunyi6866@gmail.com",
  address: "新北市板橋區大觀路三段160巷20號6樓",
  contactPerson: "蔡宛融",
  facebookSource: "小羽旅遊趣",
  facebookUrl: "https://www.facebook.com/share/g/1NPbXN8THD/",
  ogImage: "/hero-bus-sunny.png",
  geo: {
    latitude: 25.0065,
    longitude: 121.448,
    region: "TW-NWT",
  },
  services: [
    "遊覽車包車",
    "中巴包車",
    "九人座包車",
    "機場接送",
    "校外教學",
    "企業旅遊",
    "客製化行程",
  ],
} as const;

export const envConfig = {
  lineOaUrl: process.env.NEXT_PUBLIC_LINE_OA_URL ?? "",
  legacyLineUrl: process.env.NEXT_PUBLIC_LINE_URL ?? "",
  travelImportApiKey: process.env.TRAVEL_IMPORT_API_KEY ?? "",
  indexNowKey: process.env.INDEXNOW_KEY ?? "",
  gx10ApiUrl: process.env.GX10_AI_API_URL ?? "",
  gx10ApiKey: process.env.GX10_AI_API_KEY ?? "",
  gx10Model: process.env.GX10_MODEL ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
} as const;

export function getLineOaUrl() {
  return envConfig.lineOaUrl || envConfig.legacyLineUrl;
}
