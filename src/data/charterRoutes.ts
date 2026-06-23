import type { KnowledgeFaq, KnowledgeLink } from "@/src/data/knowledge";

export type CharterRouteEntry = {
  slug: string;
  title: string;
  origin: string;
  destination: string;
  routeType: string;
  description: string;
  estimatedDuration: string;
  suitableFor: string[];
  priceFactors: string[];
  recommendedStops: string[];
  relatedAttractions: KnowledgeLink[];
  relatedKnowledge: KnowledgeLink[];
  faq: KnowledgeFaq[];
  coverImage: string;
  updatedAt: string;
  legacySlugs?: string[];
};

export const routePriceNotice =
  "實際價格依日期、人數、車型、工時、行李與停靠點調整，可由浮雲小幫手快速初估。";

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=82`;

const commonFaq = (title: string): KnowledgeFaq[] => [
  {
    question: `${title}如何估價？`,
    answer: routePriceNotice,
  },
  {
    question: "可以臨時增加停靠點嗎？",
    answer: "可依當日工時、路況與車輛條件評估，建議在出發前先確認完整行程。",
  },
];

export const charterRouteEntries: CharterRouteEntry[] = [
  {
    slug: "taipei-jiufen",
    title: "台北到九份包車",
    origin: "台北",
    destination: "九份",
    routeType: "景點接送／一日包車",
    description: "適合半日往返或搭配十分、金瓜石的東北角一日行程。",
    estimatedDuration: "半日約 5–6 小時；多點一日約 8–10 小時",
    suitableFor: ["家庭旅遊", "海外旅客", "親友小團體"],
    priceFactors: ["車型與人數", "服務時數", "假日交通", "是否增加十分或金瓜石"],
    recommendedStops: ["九份老街", "金瓜石", "十分老街"],
    relatedAttractions: [{ href: "/attractions/jiufen", label: "九份老街" }],
    relatedKnowledge: [
      { href: "/knowledge/taipei-to-jiufen-charter-price", label: "台北到九份包車多少錢" },
      { href: "/knowledge/jiufen-old-street-travel-guide", label: "九份老街攻略" },
    ],
    faq: commonFaq("台北到九份包車"),
    coverImage: image("photo-1518005020951-eccb494ad742"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taipei-yehliu",
    title: "台北到野柳包車",
    origin: "台北",
    destination: "野柳",
    routeType: "北海岸半日／一日包車",
    description: "可單點往返，也可搭配金山、基隆或九份形成北海岸完整行程。",
    estimatedDuration: "半日約 5–6 小時；多點一日約 8–10 小時",
    suitableFor: ["親子家庭", "銀髮旅客", "海外自由行"],
    priceFactors: ["出發區域", "停靠點數", "車型", "總服務時間"],
    recommendedStops: ["野柳地質公園", "金山老街", "基隆港區"],
    relatedAttractions: [
      { href: "/attractions/yehliu", label: "野柳地質公園" },
      { href: "/attractions/jiufen", label: "九份老街" },
    ],
    relatedKnowledge: [
      { href: "/knowledge/taipei-to-yehliu-charter", label: "台北到野柳包車推薦" },
      { href: "/knowledge/jiufen-shifen-yehliu-day-trip", label: "九份十分野柳一日遊" },
    ],
    faq: commonFaq("台北到野柳包車"),
    coverImage: image("photo-1497436072909-f5e4be1713c0"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taipei-tamsui",
    title: "台北到淡水包車",
    origin: "台北",
    destination: "淡水",
    routeType: "市郊半日包車",
    description: "適合河岸、老街與漁人碼頭慢遊，可搭配故宮或北投。",
    estimatedDuration: "約 5–8 小時",
    suitableFor: ["家庭旅遊", "銀髮旅客", "外賓接待"],
    priceFactors: ["台北上車位置", "停留時間", "是否加入市區景點", "車型"],
    recommendedStops: ["淡水老街", "漁人碼頭", "故宮博物院"],
    relatedAttractions: [
      { href: "/attractions/tamsui", label: "淡水老街" },
      { href: "/attractions/national-palace-museum", label: "故宮博物院" },
    ],
    relatedKnowledge: [{ href: "/knowledge/taiwan-round-island-eight-days", label: "台灣行程安排原則" }],
    faq: commonFaq("台北到淡水包車"),
    coverImage: image("photo-1500530855697-b586d89ba3ee"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taoyuan-airport-jiufen",
    title: "桃園機場到九份接送",
    origin: "桃園機場",
    destination: "九份",
    routeType: "機場接送",
    description: "入境後直達九份，規劃時需同時確認航班、通關時間、行李與住宿位置。",
    estimatedDuration: "正常路況約 1.5–2 小時，不含通關等候",
    suitableFor: ["海外家庭", "攜帶大型行李旅客", "自由行小團體"],
    priceFactors: ["航班抵達時間", "等候時間", "行李數量", "車型與住宿位置"],
    recommendedStops: ["桃園機場航廈", "九份住宿", "九份老街"],
    relatedAttractions: [{ href: "/attractions/jiufen", label: "九份老街" }],
    relatedKnowledge: [{ href: "/knowledge/taoyuan-airport-to-jiufen-transfer", label: "桃園機場到九份接送攻略" }],
    faq: commonFaq("桃園機場到九份接送"),
    coverImage: image("photo-1436491865332-7a61a109cc05"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "shulin-sun-moon-lake",
    legacySlugs: ["taipei-sun-moon-lake"],
    title: "樹林到日月潭包車",
    origin: "樹林",
    destination: "日月潭",
    routeType: "跨區長途包車",
    description: "適合家庭、公司與中大型團體，二日以上較能兼顧休息與湖區體驗。",
    estimatedDuration: "單程約 3–4 小時；建議 2 天以上",
    suitableFor: ["新北出發家庭", "公司旅遊", "中大型團體"],
    priceFactors: ["車型與行李", "單日或跨夜", "司機住宿", "環湖停靠點"],
    recommendedStops: ["國道休息站", "向山遊客中心", "伊達邵"],
    relatedAttractions: [{ href: "/attractions/sun-moon-lake", label: "日月潭" }],
    relatedKnowledge: [
      { href: "/knowledge/shulin-to-sun-moon-lake-charter-cost", label: "樹林到日月潭包車費用" },
      { href: "/knowledge/sun-moon-lake-day-trip-guide", label: "日月潭一日遊攻略" },
    ],
    faq: commonFaq("樹林到日月潭包車"),
    coverImage: image("photo-1476514525535-07fb3b4ae5f1"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "banqiao-alishan",
    legacySlugs: ["taipei-alishan"],
    title: "板橋到阿里山包車",
    origin: "板橋",
    destination: "阿里山",
    routeType: "跨區多日包車",
    description: "長途山區路線，建議以二至三天安排住宿、森林遊樂區與日出。",
    estimatedDuration: "單程約 4.5–6 小時；建議 2–3 天",
    suitableFor: ["家庭旅遊", "攝影團體", "企業小團"],
    priceFactors: ["跨夜天數", "車型", "司機住宿", "日出接駁與停靠點"],
    recommendedStops: ["中途休息站", "阿里山森林遊樂區", "住宿區域"],
    relatedAttractions: [{ href: "/attractions/alishan", label: "阿里山" }],
    relatedKnowledge: [{ href: "/knowledge/alishan-two-day-trip-guide", label: "阿里山二天兩夜攻略" }],
    faq: commonFaq("板橋到阿里山包車"),
    coverImage: image("photo-1441974231531-c6227db76b6e"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taipei-cingjing",
    title: "台北到清境包車",
    origin: "台北",
    destination: "清境",
    routeType: "跨區山區包車",
    description: "需考量長途與山路，適合搭配日月潭安排三天兩夜。",
    estimatedDuration: "單程約 3.5–5 小時；建議 2–3 天",
    suitableFor: ["親子家庭", "銀髮旅客", "多日小團體"],
    priceFactors: ["跨夜天數", "車型與行李", "住宿位置", "山區停靠點"],
    recommendedStops: ["國道休息站", "清境農場", "住宿區域"],
    relatedAttractions: [
      { href: "/attractions/cingjing", label: "清境農場" },
      { href: "/attractions/sun-moon-lake", label: "日月潭" },
    ],
    relatedKnowledge: [{ href: "/knowledge/sun-moon-lake-cingjing-three-days", label: "日月潭清境三天兩夜" }],
    faq: commonFaq("台北到清境包車"),
    coverImage: image("photo-1500534623283-312aade485b7"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taipei-taichung",
    title: "台北到台中包車",
    origin: "台北",
    destination: "台中",
    routeType: "城際接送／一日包車",
    description: "適合商務、家庭與多人城際移動，可依需求銜接台中市區景點。",
    estimatedDuration: "單程約 2–3 小時",
    suitableFor: ["家庭與親友團", "商務接待", "攜帶行李旅客"],
    priceFactors: ["上車地點", "單程或當日用車", "行李量", "台中停靠點"],
    recommendedStops: ["台中車站周邊", "市區飯店", "依需求安排景點"],
    relatedAttractions: [{ href: "/attractions/sun-moon-lake", label: "延伸前往日月潭" }],
    relatedKnowledge: [{ href: "/knowledge/sun-moon-lake-day-trip-guide", label: "日月潭行程參考" }],
    faq: commonFaq("台北到台中包車"),
    coverImage: image("photo-1449824913935-59a10b8d2000"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taipei-hualien",
    title: "台北到花蓮包車",
    origin: "台北",
    destination: "花蓮",
    routeType: "東部城際／多日包車",
    description: "需依道路與天候資訊規劃，適合多日行程並保留彈性。",
    estimatedDuration: "依道路與停靠安排，建議多日規劃",
    suitableFor: ["家庭旅遊", "攝影團體", "攜帶行李旅客"],
    priceFactors: ["道路與行程時間", "跨夜天數", "車型", "花蓮停靠點"],
    recommendedStops: ["依官方道路資訊安排", "花蓮市區", "住宿地點"],
    relatedAttractions: [{ href: "/attractions/taroko", label: "太魯閣" }],
    relatedKnowledge: [{ href: "/knowledge/taiwan-round-island-eight-days", label: "台灣環島八天七夜" }],
    faq: commonFaq("台北到花蓮包車"),
    coverImage: image("photo-1469474968028-56623f02e42e"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taipei-kenting",
    title: "台北到墾丁包車",
    origin: "台北",
    destination: "墾丁",
    routeType: "南北長途多日包車",
    description: "南北長途路線不適合當日往返，建議納入南部住宿或環島行程。",
    estimatedDuration: "單程約 5–7 小時以上；建議 3 天以上",
    suitableFor: ["多日家庭旅遊", "海外團體", "環島行程"],
    priceFactors: ["總天數與里程", "車型與行李", "司機住宿", "南部停靠點"],
    recommendedStops: ["中途休息站", "高雄或台南", "恆春與墾丁住宿"],
    relatedAttractions: [{ href: "/attractions/kenting", label: "墾丁" }],
    relatedKnowledge: [{ href: "/knowledge/taiwan-round-island-eight-days", label: "台灣環島八天七夜" }],
    faq: commonFaq("台北到墾丁包車"),
    coverImage: image("photo-1507525428034-b723cf961d3e"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "new-taipei-school-trip-liufu-village",
    title: "新北校外教學到六福村遊覽車",
    origin: "新北市",
    destination: "六福村",
    routeType: "校外教學遊覽車",
    description: "以分車名單、老師窗口、集合位置與返程點名為核心的學校團體接送。",
    estimatedDuration: "通常安排完整一日",
    suitableFor: ["國小", "國中", "高中與畢業旅行"],
    priceFactors: ["學校位置", "車輛數", "服務時數", "多校區或額外接送"],
    recommendedStops: ["學校集合點", "六福村遊覽車停車區", "指定返校位置"],
    relatedAttractions: [{ href: "/attractions/liufu-village", label: "六福村主題遊樂園" }],
    relatedKnowledge: [{ href: "/knowledge/leofoo-village-school-trip-bus", label: "六福村校外教學遊覽車攻略" }],
    faq: commonFaq("新北到六福村校外教學"),
    coverImage: image("photo-1513883049090-d0b7439799bf"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "shulin-school-trip-flying-cow",
    title: "樹林校外教學到飛牛牧場遊覽車",
    origin: "樹林",
    destination: "飛牛牧場",
    routeType: "校外教學遊覽車",
    description: "適合幼兒園與國小團體，需配合牧場活動時段安排出發與返校。",
    estimatedDuration: "通常安排完整一日",
    suitableFor: ["幼兒園", "國小", "親子校外活動"],
    priceFactors: ["學生與老師人數", "車輛數", "服務時間", "額外接送點"],
    recommendedStops: ["樹林校園集合點", "國道休息站", "飛牛牧場停車區"],
    relatedAttractions: [{ href: "/attractions/flying-cow-ranch", label: "飛牛牧場" }],
    relatedKnowledge: [{ href: "/knowledge/flying-cow-ranch-school-trip-charter", label: "飛牛牧場校外教學包車" }],
    faq: commonFaq("樹林到飛牛牧場校外教學"),
    coverImage: image("photo-1500595046743-cd271d694d30"),
    updatedAt: "2026-06-23",
  },
];

function routeText(entry: CharterRouteEntry) {
  return [
    entry.title,
    entry.origin,
    entry.destination,
    entry.routeType,
    entry.description,
    entry.estimatedDuration,
    ...entry.suitableFor,
    ...entry.priceFactors,
    ...entry.recommendedStops,
  ].join(" ").toLocaleLowerCase("zh-Hant");
}

function matchesKeyword(text: string, keyword: string) {
  const normalized = keyword.trim().toLocaleLowerCase("zh-Hant");
  if (!normalized) return false;
  const tokens = normalized.split(/[\s,，、/]+/).filter(Boolean);
  return text.replace(/\s+/g, "").includes(normalized.replace(/[\s,，、/]+/g, ""))
    || tokens.every((token) => text.includes(token));
}

export function getRouteBySlug(slug: string) {
  return charterRouteEntries.find((entry) =>
    entry.slug === slug || entry.legacySlugs?.includes(slug));
}

export function getRoutesByOrigin(origin: string) {
  return charterRouteEntries.filter((entry) => entry.origin === origin);
}

export function getRoutesByDestination(destination: string) {
  return charterRouteEntries.filter((entry) => entry.destination === destination);
}

export function searchRoutesByKeyword(keyword: string) {
  const compactQuery = keyword.trim().toLocaleLowerCase("zh-Hant").replace(/[\s,，、/]+/g, "");
  return charterRouteEntries.filter((entry) => {
    const phrases = [entry.title, `${entry.origin}到${entry.destination}`, entry.destination]
      .map((phrase) => phrase.toLocaleLowerCase("zh-Hant").replace(/\s+/g, ""));
    return matchesKeyword(routeText(entry), keyword)
      || phrases.some((phrase) => compactQuery.includes(phrase));
  });
}
