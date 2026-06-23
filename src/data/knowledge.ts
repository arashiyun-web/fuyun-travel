export const knowledgeCategories = [
  "包車攻略",
  "景點攻略",
  "行程攻略",
  "校外教學攻略",
  "機場接送攻略",
  "FAQ",
] as const;

export type KnowledgeCategory = (typeof knowledgeCategories)[number];

export type KnowledgeLink = {
  href: string;
  label: string;
};

export type KnowledgeFaq = {
  question: string;
  answer: string;
};

export type KnowledgeContent = {
  highlights: string[];
  audience: string[];
  arrangement: string[];
  costFactors: string[];
  cautions: string[];
};

type KnowledgeSourceEntry = {
  id: string;
  slug: string;
  category: KnowledgeCategory;
  title: string;
  description: string;
  keywords: string[];
  content: KnowledgeContent;
  relatedRoutes: KnowledgeLink[];
  relatedAttractions: KnowledgeLink[];
  relatedFaqs: KnowledgeFaq[];
  updatedAt: string;
};

export type KnowledgeEntry = KnowledgeSourceEntry & {
  summary: string;
  keyPoints: string[];
  suitableFor: string[];
  faq: KnowledgeFaq[];
};

// Knowledge records are deliberately concise and decision-oriented for travelers, search, and AI retrieval.
const knowledgeSourceEntries: KnowledgeSourceEntry[] = [
  {
    id: "charter-taipei-jiufen-price",
    slug: "taipei-to-jiufen-charter-price",
    category: "包車攻略",
    title: "台北到九份包車多少錢",
    description: "台北到九份包車費用會依車型、服務時間、停靠點與日期調整，適合先用行程條件快速估價。",
    keywords: ["台北到九份包車", "九份包車價格", "九份一日遊", "九份九人座"],
    content: {
      highlights: ["單純台北往返九份可安排半日", "搭配十分或金瓜石通常以一日車程估算", "人數與行李量會影響車型"],
      audience: ["家庭旅遊", "海外旅客", "不便轉乘大眾運輸的同行者"],
      arrangement: ["先確認上車地點與日期", "決定是否加入十分、金瓜石或基隆", "預留老街步行及回程塞車時間"],
      costFactors: ["九人座、中巴或遊覽車", "平日、假日與連假", "服務時數與額外停靠點", "深夜或跨日需求"],
      cautions: ["九份假日交通容易壅塞", "大型車需確認上下車位置", "報價應以完整日期與行程為準"],
    },
    relatedRoutes: [{ href: "/charter-routes/taipei-jiufen", label: "台北到九份包車路線" }],
    relatedAttractions: [{ href: "/attractions/jiufen", label: "九份景點探索" }],
    relatedFaqs: [
      { question: "台北到九份包車可以只安排半天嗎？", answer: "可以，若只停留九份並從台北往返，通常可先以半日需求評估。" },
      { question: "九份包車費用包含停車費嗎？", answer: "各行程條件不同，詢價時應確認停車、過路與超時費用的計算方式。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "charter-taipei-yehliu",
    slug: "taipei-to-yehliu-charter",
    category: "包車攻略",
    title: "台北到野柳包車推薦",
    description: "台北到野柳適合搭配金山、基隆或九份，包車可減少北海岸轉乘並保留彈性停留時間。",
    keywords: ["台北到野柳包車", "野柳包車推薦", "北海岸一日遊", "野柳九份包車"],
    content: {
      highlights: ["野柳單點適合半日", "北海岸多點行程建議安排一日", "包車可依天候調整順序"],
      audience: ["親子家庭", "銀髮旅客", "海外自由行團體"],
      arrangement: ["上午避開人潮前往野柳", "視需求搭配金山老街或基隆", "若加入九份應控制每站停留時間"],
      costFactors: ["出發區域", "景點數量", "車型與乘客數", "總服務時間"],
      cautions: ["海岸風勢與天候變化大", "假日停車與入園時間需預留", "跨區多點不可只用單程距離估價"],
    },
    relatedRoutes: [{ href: "/charter-routes/taipei-yehliu", label: "台北到野柳包車路線" }],
    relatedAttractions: [{ href: "/attractions/jiufen", label: "延伸探索九份" }],
    relatedFaqs: [
      { question: "野柳和九份可以排同一天嗎？", answer: "可以，建議安排完整一日並控制各站停留時間，避免回程過晚。" },
      { question: "下雨天還適合去野柳嗎？", answer: "需視風雨與園區公告調整，包車行程可準備基隆或室內景點作替代。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "charter-shulin-sun-moon-lake",
    slug: "shulin-to-sun-moon-lake-charter-cost",
    category: "包車攻略",
    title: "樹林到日月潭包車費用",
    description: "樹林到日月潭屬跨區長途路線，費用主要受車型、服務時數、住宿與回程方式影響。",
    keywords: ["樹林到日月潭包車", "日月潭包車費用", "新北日月潭包車", "日月潭遊覽車"],
    content: {
      highlights: ["單日往返車程較長", "二日以上較能兼顧休息與遊湖", "團體需依人數與行李選車"],
      audience: ["新北出發家庭", "公司旅遊", "中大型團體"],
      arrangement: ["確認單日往返或住宿", "安排國道休息點", "選擇遊湖、向山或伊達邵等主要停靠"],
      costFactors: ["車型與座位數", "單日或跨夜", "司機住宿與停車", "景點接駁與超時"],
      cautions: ["不建議把單日景點排得過滿", "跨夜需提前確認司機住宿", "大型活動期間房價與交通會影響安排"],
    },
    relatedRoutes: [{ href: "/charter-routes/taipei-sun-moon-lake", label: "北部到日月潭路線" }],
    relatedAttractions: [{ href: "/attractions/sun-moon-lake", label: "日月潭景點探索" }],
    relatedFaqs: [
      { question: "樹林到日月潭適合當天來回嗎？", answer: "可以，但乘車時間長；有長輩或孩童時，通常建議至少安排二日。" },
      { question: "跨夜包車如何計價？", answer: "除服務時數與里程外，通常還需確認司機住宿、停車及隔日用車時間。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "attraction-jiufen-guide",
    slug: "jiufen-old-street-travel-guide",
    category: "景點攻略",
    title: "九份老街旅遊攻略",
    description: "九份老街適合安排二至三小時，重點是避開尖峰、選好上下車點並預留階梯步行時間。",
    keywords: ["九份老街攻略", "九份交通", "九份包車", "九份停留時間"],
    content: {
      highlights: ["老街、茶館與山海景觀集中", "傍晚燈籠亮起後氛圍不同", "主要動線包含較多階梯"],
      audience: ["首次到訪旅客", "攝影旅客", "家庭與海外親友團"],
      arrangement: ["平日或上午較容易避開人潮", "預留二至三小時散步", "可與金瓜石或十分組成一日"],
      costFactors: ["是否採包車接送", "同行人數與車型", "是否增加周邊景點"],
      cautions: ["雨天石階濕滑", "長輩需評估步行量", "假日上下車點可能交通管制"],
    },
    relatedRoutes: [{ href: "/charter-routes/taipei-jiufen", label: "台北到九份包車" }],
    relatedAttractions: [{ href: "/attractions/jiufen", label: "九份探索頁" }],
    relatedFaqs: [
      { question: "九份老街建議停留多久？", answer: "一般建議二至三小時；若要喝茶、拍夜景，可再增加停留時間。" },
      { question: "九份適合帶長輩嗎？", answer: "可以，但需降低階梯路段，並選擇較方便的上下車位置與休息點。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "attraction-sun-moon-lake-day-trip",
    slug: "sun-moon-lake-day-trip-guide",
    category: "景點攻略",
    title: "日月潭一日遊攻略",
    description: "日月潭一日遊應聚焦二至三個主要區域，避免環湖景點全塞進同一天。",
    keywords: ["日月潭一日遊", "日月潭攻略", "日月潭包車", "日月潭行程"],
    content: {
      highlights: ["向山、伊達邵與遊湖是常見主軸", "環湖距離不短", "不同碼頭與停車點需計算移動時間"],
      audience: ["家庭旅遊", "公司團體", "中部短程旅客"],
      arrangement: ["上午向山或文武廟", "中午安排伊達邵用餐", "下午依時間選擇遊船或環湖景點"],
      costFactors: ["出發城市", "車型", "遊船與門票", "停靠點數量"],
      cautions: ["連假環湖道路壅塞", "遊船受天候影響", "北部出發不宜同日再塞入清境"],
    },
    relatedRoutes: [{ href: "/charter-routes/taipei-sun-moon-lake", label: "台北到日月潭包車" }],
    relatedAttractions: [{ href: "/attractions/sun-moon-lake", label: "日月潭探索頁" }],
    relatedFaqs: [
      { question: "日月潭一天可以玩完嗎？", answer: "可以走訪主要景點，但建議聚焦二至三區，不追求完整環湖。" },
      { question: "日月潭需要包車嗎？", answer: "多人、帶長輩或需銜接住宿時，包車能減少轉乘並提升時間彈性。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "attraction-alishan-two-days",
    slug: "alishan-two-day-trip-guide",
    category: "景點攻略",
    title: "阿里山二天兩夜攻略",
    description: "阿里山二天兩夜可以前一晚抵達住宿，再用兩天安排日出、森林遊樂區與下山動線。",
    keywords: ["阿里山二天兩夜", "阿里山攻略", "阿里山日出", "阿里山包車"],
    content: {
      highlights: ["住宿位置會影響日出安排", "山區日夜溫差明顯", "森林步道需依體力選擇"],
      audience: ["家庭旅客", "攝影團體", "希望降低長途疲勞的旅客"],
      arrangement: ["前一晚抵達園區或鄰近住宿", "第一天安排森林步道與園區景點", "第二天視天候看日出後下山"],
      costFactors: ["出發地與車型", "跨夜服務", "住宿區域", "日出接駁需求"],
      cautions: ["日出不保證可見", "旺季住宿需提早預訂", "容易暈車者需預留休息"],
    },
    relatedRoutes: [{ href: "/charter-routes/taipei-alishan", label: "台北到阿里山包車" }],
    relatedAttractions: [{ href: "/attractions/alishan", label: "阿里山探索頁" }],
    relatedFaqs: [
      { question: "阿里山二天兩夜如何計算？", answer: "可以前一晚抵達住宿，接續兩個完整旅遊日，降低北部長途移動壓力。" },
      { question: "一定要住園區內嗎？", answer: "不一定，但住宿位置會影響隔日日出接駁與出發時間。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "itinerary-jiufen-shifen-yehliu",
    slug: "jiufen-shifen-yehliu-day-trip",
    category: "行程攻略",
    title: "九份十分野柳一日遊",
    description: "九份、十分、野柳可組成北海岸與東北角一日線，關鍵是移動順序與每站停留時間。",
    keywords: ["九份十分野柳一日遊", "北海岸包車", "十分九份包車", "野柳九份行程"],
    content: {
      highlights: ["三站可在一天完成", "順序應依出發地與人潮調整", "包車比多次轉乘更適合團體"],
      audience: ["海外旅客", "親友團", "第一次探索北台灣的家庭"],
      arrangement: ["上午野柳避開午後人潮", "中段前往十分放天燈", "傍晚九份散步後返回台北"],
      costFactors: ["上車地點", "車型", "服務時間", "臨時增加停靠點"],
      cautions: ["三站不宜再加入過多景點", "假日九份回程易塞車", "放天燈與戶外景點受天候影響"],
    },
    relatedRoutes: [
      { href: "/charter-routes/taipei-yehliu", label: "台北到野柳" },
      { href: "/charter-routes/taipei-jiufen", label: "台北到九份" },
    ],
    relatedAttractions: [{ href: "/attractions/jiufen", label: "九份景點探索" }],
    relatedFaqs: [
      { question: "九份十分野柳一日遊需要幾小時？", answer: "通常應預留完整一日，約八至十小時並依交通調整。" },
      { question: "行程順序固定嗎？", answer: "不固定，應依上車位置、天候、人潮與希望看到的九份時段調整。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "itinerary-sun-moon-lake-cingjing",
    slug: "sun-moon-lake-cingjing-three-days",
    category: "行程攻略",
    title: "日月潭清境三天兩夜",
    description: "日月潭與清境三天兩夜可兼顧湖區、高山與休息，適合家庭及團體採包車移動。",
    keywords: ["日月潭清境三天兩夜", "清境包車", "日月潭清境行程", "南投三日遊"],
    content: {
      highlights: ["湖區與高山各安排一晚較舒適", "山路行程不宜每天過早過晚", "可依季節調整農場與步道"],
      audience: ["親子家庭", "銀髮旅客", "公司小團體"],
      arrangement: ["第一天抵達日月潭", "第二天遊湖後前往清境", "第三天農場或步道後返程"],
      costFactors: ["出發地", "跨夜車輛服務", "車型與行李", "司機住宿安排"],
      cautions: ["清境山區晚間溫度較低", "住宿地點影響行車時間", "連假需提早確認房況與車輛"],
    },
    relatedRoutes: [
      { href: "/charter-routes/taipei-sun-moon-lake", label: "台北到日月潭" },
      { href: "/charter-routes/taipei-cingjing", label: "雙北到清境" },
    ],
    relatedAttractions: [
      { href: "/attractions/sun-moon-lake", label: "日月潭探索" },
      { href: "/attractions/cingjing-farm", label: "清境農場探索" },
    ],
    relatedFaqs: [
      { question: "日月潭和清境住哪裡比較好？", answer: "三天兩夜可各住一晚，減少來回山路並保留兩地體驗。" },
      { question: "適合帶長輩嗎？", answer: "適合，但應降低步行量、選擇電梯住宿並避免過密行程。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "itinerary-taiwan-eight-days",
    slug: "taiwan-round-island-eight-days",
    category: "行程攻略",
    title: "台灣環島八天七夜",
    description: "八天七夜環島應先決定必去區域，再以住宿動線控制每日車程，避免只追求景點數量。",
    keywords: ["台灣環島八天七夜", "環島包車", "台灣八日遊", "外賓環島行程"],
    content: {
      highlights: ["八天可完成主要城市環線", "每日建議保留一個核心體驗", "車型需考慮八天行李空間"],
      audience: ["海外家庭", "外賓接待", "企業與親友團"],
      arrangement: ["先選順時針或逆時針", "確認東部道路與住宿", "每天控制長途移動與景點比例"],
      costFactors: ["總里程與天數", "車型與行李", "司機住宿", "偏遠地區與特殊接駁"],
      cautions: ["不可忽略洗衣與休息時間", "東部行程需確認道路資訊", "景點過多會降低實際體驗品質"],
    },
    relatedRoutes: [
      { href: "/charter-routes/taipei-sun-moon-lake", label: "台北到日月潭" },
      { href: "/charter-routes/taipei-alishan", label: "台北到阿里山" },
    ],
    relatedAttractions: [
      { href: "/attractions/sun-moon-lake", label: "日月潭" },
      { href: "/attractions/alishan", label: "阿里山" },
      { href: "/attractions/kenting", label: "墾丁" },
    ],
    relatedFaqs: [
      { question: "八天環島會不會太趕？", answer: "若集中主要區域並控制每日景點數量，八天可行；深度旅遊則建議增加天數。" },
      { question: "環島包車要選多大的車？", answer: "除人數外需計算每人的大型行李，長途旅程應保留舒適座位與行李空間。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "school-trip-flying-cow-ranch",
    slug: "flying-cow-ranch-school-trip-charter",
    category: "校外教學攻略",
    title: "飛牛牧場校外教學包車",
    description: "飛牛牧場適合幼兒園與國小自然體驗，包車規劃需先確認分車、活動時段與上下車安全。",
    keywords: ["飛牛牧場校外教學", "飛牛牧場包車", "校外教學遊覽車", "苗栗校外教學"],
    content: {
      highlights: ["動物與乳品體驗適合低年齡學生", "大型團體需提前預約活動", "分車與點名流程應事先建立"],
      audience: ["幼兒園", "國小", "親子團體"],
      arrangement: ["確認學生、老師與家長人數", "依課程時段安排抵達", "建立分車名單與緊急聯絡流程"],
      costFactors: ["車輛數與座位", "學校所在地", "活動時數", "停車與額外接送點"],
      cautions: ["須保留上下車安全空間", "雨備與餐食需提前確認", "車輛資料與保險文件應留存"],
    },
    relatedRoutes: [{ href: "/charter-routes/shulin-school-trip-flying-cow", label: "樹林到飛牛牧場校外教學路線" }],
    relatedAttractions: [{ href: "/attractions/flying-cow-ranch", label: "飛牛牧場景點頁" }],
    relatedFaqs: [
      { question: "飛牛牧場校外教學要提前多久訂車？", answer: "平日建議至少提前數週，畢旅與校外教學旺季應更早確認。" },
      { question: "學校包車需要準備什麼？", answer: "應提供日期、校址、人數、目的地、分車需求、帶隊窗口與預估行程。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "school-trip-leofoo-village",
    slug: "leofoo-village-school-trip-bus",
    category: "校外教學攻略",
    title: "六福村校外教學遊覽車",
    description: "六福村校外教學適合大型團體，遊覽車安排重點是分車名單、集合位置與閉園前返程時間。",
    keywords: ["六福村校外教學", "六福村遊覽車", "校外教學包車", "畢業旅行六福村"],
    content: {
      highlights: ["適合國小至高中團體", "大型停車與集合仍需明確分區", "返程時間需考量樂園散場"],
      audience: ["國小", "國中", "高中與畢業旅行"],
      arrangement: ["依班級或年級分車", "設定老師與司機聯絡窗口", "公告集合點、時間與逾時處理"],
      costFactors: ["遊覽車數量", "學校出發地", "服務時數", "是否多點接送"],
      cautions: ["不可只依報名人數壓縮座位", "需確認學生緊急聯絡資料", "散場時應預留點名與步行時間"],
    },
    relatedRoutes: [{ href: "/charter-routes/new-taipei-school-trip-liufu-village", label: "新北到六福村校外教學路線" }],
    relatedAttractions: [{ href: "/attractions/liufu-village", label: "六福村景點頁" }],
    relatedFaqs: [
      { question: "六福村校外教學適合幾人一車？", answer: "應依合法車輛座位與隨隊老師配置安排，不可超載。" },
      { question: "可以多個校區接送嗎？", answer: "可以，但需提前提供地址、人數與時間，以確認車程及報價。" },
    ],
    updatedAt: "2026-06-23",
  },
  {
    id: "airport-taoyuan-jiufen",
    slug: "taoyuan-airport-to-jiufen-transfer",
    category: "機場接送攻略",
    title: "桃園機場到九份接送攻略",
    description: "桃園機場到九份接送需同時考量航班、通關、行李、車型與山城抵達時間。",
    keywords: ["桃園機場到九份", "機場接送九份", "九份機場包車", "桃園機場包車"],
    content: {
      highlights: ["不能只依乘客人數選車", "航班延誤與通關時間需留彈性", "大型行李會壓縮九人座空間"],
      audience: ["海外家庭", "自由行小團體", "攜帶大型行李旅客"],
      arrangement: ["提供航班編號與抵達日期", "確認大型行李及兒童座椅", "決定直達九份或途中停靠"],
      costFactors: ["抵達航廈與時間", "乘客及行李數", "車型", "等候、夜間與額外停靠"],
      cautions: ["紅眼班機應提前確認調度", "九份住宿可能位於車輛不易抵達處", "入境延誤的等候規則需先確認"],
    },
    relatedRoutes: [{ href: "/charter-routes/taoyuan-airport-jiufen", label: "桃園機場到九份路線" }],
    relatedAttractions: [{ href: "/attractions/jiufen", label: "九份景點探索" }],
    relatedFaqs: [
      { question: "桃園機場到九份需要多久？", answer: "正常路況通常需約一個半小時以上，仍應依時段與當日交通預留彈性。" },
      { question: "航班延誤怎麼處理？", answer: "詢價時應確認航班追蹤、免費等候時間及超時費用規則。" },
    ],
    updatedAt: "2026-06-23",
  },
];

// Normalized aliases satisfy the long-term engine contract while preserving existing content consumers.
export const knowledgeEntries: KnowledgeEntry[] = knowledgeSourceEntries.map((entry) => ({
  ...entry,
  summary: entry.description,
  keyPoints: entry.content.highlights,
  suitableFor: entry.content.audience,
  faq: entry.relatedFaqs,
}));

function searchableText(entry: KnowledgeEntry) {
  return [
    entry.title,
    entry.description,
    entry.category,
    ...entry.keywords,
    ...entry.content.highlights,
    ...entry.content.audience,
    ...entry.content.arrangement,
    ...entry.content.costFactors,
    ...entry.content.cautions,
    ...entry.relatedFaqs.flatMap((faq) => [faq.question, faq.answer]),
  ]
    .join(" ")
    .toLocaleLowerCase("zh-Hant");
}

// AI客服可直接 import；此函式只查詢本地資料，不呼叫模型或外部服務。
export function getKnowledgeByKeyword(keyword: string): KnowledgeEntry[] {
  const normalized = keyword.trim().toLocaleLowerCase("zh-Hant");
  if (!normalized) return [];
  const tokens = normalized.split(/[\s,，、/]+/).filter(Boolean);
  const compactQuery = normalized.replace(/[\s,，、/]+/g, "");

  return knowledgeEntries.filter((entry) => {
    const text = searchableText(entry);
    const compactText = text.replace(/\s+/g, "");
    const phrases = [entry.title, ...entry.keywords]
      .map((phrase) => phrase.toLocaleLowerCase("zh-Hant").replace(/\s+/g, ""));
    return compactText.includes(compactQuery)
      || phrases.some((phrase) => compactQuery.includes(phrase))
      || tokens.every((token) => text.includes(token));
  });
}

export function getKnowledgeByCategory(category: KnowledgeCategory | string): KnowledgeEntry[] {
  return knowledgeEntries.filter((entry) => entry.category === category);
}

export function getKnowledgeBySlug(slug: string): KnowledgeEntry | undefined {
  return knowledgeEntries.find((entry) => entry.slug === slug);
}
