import type { KnowledgeFaq, KnowledgeLink } from "@/src/data/knowledge";
import { getAttractionImage } from "@/lib/attractionImages";

export type AttractionEntry = {
  slug: string;
  name: string;
  city: string;
  region: string;
  description: string;
  bestSeason: string;
  stayDuration: string;
  suitableFor: string[];
  highlights: string[];
  nearbyAttractions: KnowledgeLink[];
  recommendedRoutes: KnowledgeLink[];
  relatedKnowledge: KnowledgeLink[];
  faq: KnowledgeFaq[];
  coverImage: string;
  updatedAt: string;
  legacySlugs?: string[];
};


// Curated local records are the canonical source for attraction pages and future AI retrieval.
export const attractionEntries: AttractionEntry[] = [
  {
    slug: "jiufen",
    name: "九份老街",
    city: "新北市",
    region: "北部",
    description: "山城老街、茶館與海景交織，適合搭配十分、金瓜石或野柳安排北台灣一日旅程。",
    bestSeason: "全年；秋冬較有山城氛圍，雨季需備雨具",
    stayDuration: "2–3 小時",
    suitableFor: ["首次來台旅客", "家庭旅遊", "攝影與文化散步"],
    highlights: ["老街階梯與燈籠街景", "山海景觀與茶館", "可串連十分、金瓜石"],
    nearbyAttractions: [
      { href: "/attractions/yehliu", label: "野柳地質公園" },
      { href: "/attractions/tamsui", label: "淡水老街" },
    ],
    recommendedRoutes: [
      { href: "/charter-routes/taipei-jiufen", label: "台北到九份包車" },
      { href: "/charter-routes/taoyuan-airport-jiufen", label: "桃園機場到九份接送" },
    ],
    relatedKnowledge: [
      { href: "/knowledge/jiufen-old-street-travel-guide", label: "九份老街旅遊攻略" },
      { href: "/knowledge/taipei-to-jiufen-charter-price", label: "台北到九份包車費用因素" },
    ],
    faq: [
      { question: "九份老街建議停留多久？", answer: "一般建議二至三小時；若安排喝茶或夜景可再增加時間。" },
      { question: "九份適合長輩嗎？", answer: "可以，但階梯較多，應降低步行量並選擇方便的上下車點。" },
    ],
    coverImage: getAttractionImage("jiufen"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "yehliu",
    name: "野柳地質公園",
    city: "新北市",
    region: "北部",
    description: "北海岸代表性地質景觀，以海蝕地形與濱海步道為主，適合安排半日或北海岸一日遊。",
    bestSeason: "全年；春秋較舒適，冬季注意東北季風",
    stayDuration: "1.5–2.5 小時",
    suitableFor: ["親子自然教育", "海外旅客", "地景攝影"],
    highlights: ["海蝕地形", "女王頭等代表景觀", "北海岸濱海視野"],
    nearbyAttractions: [
      { href: "/attractions/jiufen", label: "九份老街" },
      { href: "/attractions/tamsui", label: "淡水老街" },
    ],
    recommendedRoutes: [{ href: "/charter-routes/taipei-yehliu", label: "台北到野柳包車" }],
    relatedKnowledge: [
      { href: "/knowledge/taipei-to-yehliu-charter", label: "台北到野柳包車推薦" },
      { href: "/knowledge/jiufen-shifen-yehliu-day-trip", label: "九份十分野柳一日遊" },
    ],
    faq: [
      { question: "野柳下雨天可以參觀嗎？", answer: "需依風雨與園區公告判斷，濱海步道濕滑時應調整行程。" },
      { question: "野柳和九份能排同一天嗎？", answer: "可以，建議預留完整一日並控制各站停留時間。" },
    ],
    coverImage: getAttractionImage("yehliu"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "tamsui",
    name: "淡水老街",
    city: "新北市",
    region: "北部",
    description: "河岸散步、老街小吃與夕陽景觀集中，適合半日慢遊或搭配北投、八里。",
    bestSeason: "全年；秋冬夕陽與河岸散步較舒適",
    stayDuration: "2–4 小時",
    suitableFor: ["家庭旅遊", "銀髮旅客", "輕鬆散步行程"],
    highlights: ["淡水河岸夕陽", "老街與歷史街區", "可延伸漁人碼頭"],
    nearbyAttractions: [
      { href: "/attractions/national-palace-museum", label: "故宮博物院" },
      { href: "/attractions/yehliu", label: "野柳地質公園" },
    ],
    recommendedRoutes: [{ href: "/charter-routes/taipei-tamsui", label: "台北到淡水包車" }],
    relatedKnowledge: [{ href: "/knowledge/taipei-to-yehliu-charter", label: "北海岸包車安排參考" }],
    faq: [
      { question: "淡水適合安排半天嗎？", answer: "適合，老街、河岸與漁人碼頭可依停留時間彈性取捨。" },
      { question: "淡水什麼時候最適合看夕陽？", answer: "日落時間依季節不同，建議出發前確認當日日落與天候。" },
    ],
    coverImage: getAttractionImage("tamsui"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "sun-moon-lake",
    name: "日月潭",
    city: "南投縣",
    region: "中部",
    description: "湖景、遊船與環湖景點構成中台灣代表行程，適合一日至二日的舒適旅行。",
    bestSeason: "全年；春秋氣候較舒適",
    stayDuration: "半日至 1 天",
    suitableFor: ["家庭旅遊", "銀髮旅客", "公司團體"],
    highlights: ["向山與湖景步道", "伊達邵與遊船", "環湖景觀"],
    nearbyAttractions: [{ href: "/attractions/cingjing", label: "清境農場" }],
    recommendedRoutes: [{ href: "/charter-routes/shulin-sun-moon-lake", label: "樹林到日月潭包車" }],
    relatedKnowledge: [
      { href: "/knowledge/sun-moon-lake-day-trip-guide", label: "日月潭一日遊攻略" },
      { href: "/knowledge/sun-moon-lake-cingjing-three-days", label: "日月潭清境三天兩夜" },
    ],
    faq: [
      { question: "日月潭一天夠嗎？", answer: "可走訪主要區域，但建議聚焦二至三個核心景點。" },
      { question: "日月潭適合與清境一起排嗎？", answer: "適合安排二至三天，避免同日往返造成車程過長。" },
    ],
    coverImage: getAttractionImage("sunMoonLake"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "alishan",
    name: "阿里山",
    city: "嘉義縣",
    region: "南部",
    description: "森林鐵路、步道、雲海與日出是主要體驗，建議至少安排二日並保留天候彈性。",
    bestSeason: "全年；春季賞花、秋冬雲海機會較高",
    stayDuration: "1–2 天",
    suitableFor: ["自然旅遊", "攝影旅客", "家庭與小團體"],
    highlights: ["森林遊樂區", "日出與雲海", "森林鐵路"],
    nearbyAttractions: [{ href: "/attractions/sun-moon-lake", label: "日月潭" }],
    recommendedRoutes: [{ href: "/charter-routes/banqiao-alishan", label: "板橋到阿里山包車" }],
    relatedKnowledge: [{ href: "/knowledge/alishan-two-day-trip-guide", label: "阿里山二天兩夜攻略" }],
    faq: [
      { question: "阿里山適合一日來回嗎？", answer: "從北部出發不建議，二日以上較能兼顧安全與體驗。" },
      { question: "阿里山一定看得到日出嗎？", answer: "無法保證，應依天候調整並準備替代行程。" },
    ],
    coverImage: getAttractionImage("alishan"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "cingjing",
    legacySlugs: ["cingjing-farm"],
    name: "清境農場",
    city: "南投縣",
    region: "中部",
    description: "高山草原、綿羊互動與開闊山景適合親子慢遊，可與日月潭組成三天兩夜。",
    bestSeason: "全年；春秋舒適，冬季注意低溫",
    stayDuration: "半日至 1 天",
    suitableFor: ["親子家庭", "銀髮旅客", "團體旅遊"],
    highlights: ["青青草原", "高山景觀", "親子動物體驗"],
    nearbyAttractions: [{ href: "/attractions/sun-moon-lake", label: "日月潭" }],
    recommendedRoutes: [{ href: "/charter-routes/taipei-cingjing", label: "台北到清境包車" }],
    relatedKnowledge: [{ href: "/knowledge/sun-moon-lake-cingjing-three-days", label: "日月潭清境三天兩夜" }],
    faq: [
      { question: "清境適合帶長輩嗎？", answer: "可以，但需降低坡道步行量並注意高山溫差。" },
      { question: "清境與日月潭如何安排？", answer: "建議三天兩夜各住一晚，減少山路往返。" },
    ],
    coverImage: getAttractionImage("cingjing"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "kenting",
    name: "墾丁",
    city: "屏東縣",
    region: "南部",
    description: "南國海岸、沙灘與恆春半島景點分散，包車適合家庭及多點海岸行程。",
    bestSeason: "全年；春秋較舒適，夏季注意高溫與颱風",
    stayDuration: "1–3 天",
    suitableFor: ["家庭旅遊", "海岸攝影", "多日團體旅行"],
    highlights: ["南國海岸線", "恆春古城", "夕陽與海景"],
    nearbyAttractions: [{ href: "/attractions/alishan", label: "阿里山" }],
    recommendedRoutes: [{ href: "/charter-routes/taipei-kenting", label: "台北到墾丁包車" }],
    relatedKnowledge: [{ href: "/knowledge/taiwan-round-island-eight-days", label: "台灣環島八天七夜" }],
    faq: [
      { question: "墾丁適合從台北當天來回嗎？", answer: "不適合，建議安排多日並在南部住宿。" },
      { question: "墾丁包車有什麼優勢？", answer: "景點分散，包車可減少轉乘並依天候調整海岸停靠。" },
    ],
    coverImage: getAttractionImage("kenting"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "taroko",
    name: "太魯閣",
    city: "花蓮縣",
    region: "東部",
    description: "峽谷與山岳景觀具代表性；行程規劃前必須確認官方道路、步道與園區開放資訊。",
    bestSeason: "依官方開放與天候資訊安排",
    stayDuration: "半日至 1 天",
    suitableFor: ["自然景觀旅客", "攝影團體", "花蓮多日行程"],
    highlights: ["峽谷地形", "山岳與溪谷景觀", "花蓮自然旅行"],
    nearbyAttractions: [{ href: "/attractions/sun-moon-lake", label: "日月潭" }],
    recommendedRoutes: [{ href: "/charter-routes/taipei-hualien", label: "台北到花蓮包車" }],
    relatedKnowledge: [{ href: "/knowledge/taiwan-round-island-eight-days", label: "台灣環島行程規劃" }],
    faq: [
      { question: "太魯閣目前可以安排嗎？", answer: "開放狀態可能變動，出發前必須以主管機關最新公告為準。" },
      { question: "台北到花蓮適合包車嗎？", answer: "多人或攜帶行李時可評估，並需依道路與行程時間安排。" },
    ],
    coverImage: getAttractionImage("taroko"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "liufu-village",
    name: "六福村主題遊樂園",
    city: "新竹縣",
    region: "北部",
    description: "主題樂園與動物園區適合家庭、校外教學與畢業旅行，團體需明確安排集合點。",
    bestSeason: "全年；避開極端高溫與大型連假",
    stayDuration: "半日至 1 天",
    suitableFor: ["親子家庭", "國小至高中", "畢業旅行"],
    highlights: ["主題遊樂設施", "動物園區", "大型團體活動"],
    nearbyAttractions: [
      { href: "/attractions/leofoo-resort", label: "六福莊" },
      { href: "/attractions/national-palace-museum", label: "故宮博物院" },
    ],
    recommendedRoutes: [{ href: "/charter-routes/new-taipei-school-trip-liufu-village", label: "新北到六福村校外教學" }],
    relatedKnowledge: [{ href: "/knowledge/leofoo-village-school-trip-bus", label: "六福村校外教學遊覽車" }],
    faq: [
      { question: "六福村校外教學要安排多久？", answer: "通常安排完整一日，並預留點名、集合與散場時間。" },
      { question: "大型團體需要注意什麼？", answer: "需先建立分車名單、帶隊窗口及清楚的集合規則。" },
    ],
    coverImage: getAttractionImage("liufuVillage"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "flying-cow-ranch",
    name: "飛牛牧場",
    city: "苗栗縣",
    region: "中部",
    description: "動物觀察、乳品與戶外體驗適合幼兒園、國小及親子團體。",
    bestSeason: "全年；春秋戶外活動較舒適",
    stayDuration: "半日至 1 天",
    suitableFor: ["幼兒園", "國小", "親子家庭"],
    highlights: ["牧場動物互動", "乳品體驗", "自然教育"],
    nearbyAttractions: [{ href: "/attractions/liufu-village", label: "六福村" }],
    recommendedRoutes: [{ href: "/charter-routes/shulin-school-trip-flying-cow", label: "樹林到飛牛牧場校外教學" }],
    relatedKnowledge: [{ href: "/knowledge/flying-cow-ranch-school-trip-charter", label: "飛牛牧場校外教學包車" }],
    faq: [
      { question: "飛牛牧場適合哪個年齡層？", answer: "幼兒園與國小最常見，也適合親子自然體驗。" },
      { question: "校外教學需要提前預約嗎？", answer: "大型團體與體驗課程通常需提前確認園方安排。" },
    ],
    coverImage: getAttractionImage("flyingCowRanch"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "national-palace-museum",
    name: "故宮博物院",
    city: "台北市",
    region: "北部",
    description: "以典藏文物連結歷史、藝術與文化教育，適合雨天備案、外賓接待及校外教學。",
    bestSeason: "全年",
    stayDuration: "2–4 小時",
    suitableFor: ["外賓接待", "國小至高中", "文化藝術旅客"],
    highlights: ["中華文物典藏", "室內文化行程", "適合導覽與課程延伸"],
    nearbyAttractions: [
      { href: "/attractions/tamsui", label: "淡水老街" },
      { href: "/attractions/yehliu", label: "野柳地質公園" },
    ],
    recommendedRoutes: [{ href: "/charter-routes/taipei-tamsui", label: "台北市區與淡水包車" }],
    relatedKnowledge: [{ href: "/knowledge/taiwan-round-island-eight-days", label: "外賓台灣行程規劃" }],
    faq: [
      { question: "故宮適合校外教學嗎？", answer: "適合，建議依年齡設定導覽主題並控制參觀時間。" },
      { question: "故宮可以和淡水排同一天嗎？", answer: "可以，建議上午故宮、下午淡水並預留市區交通時間。" },
    ],
    coverImage: getAttractionImage("nationalPalaceMuseum"),
    updatedAt: "2026-06-23",
  },
  {
    slug: "leofoo-resort",
    name: "關西六福莊",
    city: "新竹縣",
    region: "北部",
    description: "以動物主題住宿與親子體驗為特色，適合搭配六福村安排二天一夜。",
    bestSeason: "全年；假日與旺季需提前確認住宿",
    stayDuration: "1–2 天",
    suitableFor: ["親子家庭", "企業家庭日", "小型團體"],
    highlights: ["動物主題住宿", "親子體驗", "可銜接六福村"],
    nearbyAttractions: [{ href: "/attractions/liufu-village", label: "六福村主題遊樂園" }],
    recommendedRoutes: [{ href: "/charter-routes/new-taipei-school-trip-liufu-village", label: "新北到六福村區域包車" }],
    relatedKnowledge: [{ href: "/knowledge/leofoo-village-school-trip-bus", label: "六福村團體交通攻略" }],
    faq: [
      { question: "六福莊和六福村可以一起安排嗎？", answer: "可以，適合二天一夜親子行程，並需提前確認住宿與入園安排。" },
      { question: "大型遊覽車可以接送嗎？", answer: "可依團體人數評估，需先確認上下車、停車與行李需求。" },
    ],
    coverImage: getAttractionImage("liufuVillage"),
    updatedAt: "2026-06-23",
  },
];

function attractionText(entry: AttractionEntry) {
  return [
    entry.name,
    entry.city,
    entry.region,
    entry.description,
    entry.bestSeason,
    ...entry.suitableFor,
    ...entry.highlights,
    ...entry.faq.flatMap((item) => [item.question, item.answer]),
  ].join(" ").toLocaleLowerCase("zh-Hant");
}

function matchesKeyword(text: string, keyword: string) {
  const normalized = keyword.trim().toLocaleLowerCase("zh-Hant");
  if (!normalized) return false;
  const tokens = normalized.split(/[\s,，、/]+/).filter(Boolean);
  const compactQuery = normalized.replace(/[\s,，、/]+/g, "");
  return text.replace(/\s+/g, "").includes(compactQuery)
    || tokens.every((token) => text.includes(token));
}

export function getAttractionBySlug(slug: string) {
  return attractionEntries.find((entry) =>
    entry.slug === slug || entry.legacySlugs?.includes(slug));
}

export function getAttractionsByCity(city: string) {
  return attractionEntries.filter((entry) => entry.city === city);
}

export function getAttractionsByRegion(region: string) {
  return attractionEntries.filter((entry) => entry.region === region);
}

export function searchAttractionsByKeyword(keyword: string) {
  const compactQuery = keyword.trim().toLocaleLowerCase("zh-Hant").replace(/[\s,，、/]+/g, "");
  return attractionEntries.filter((entry) =>
    matchesKeyword(attractionText(entry), keyword)
    || compactQuery.includes(entry.name.toLocaleLowerCase("zh-Hant").replace(/\s+/g, "")));
}
