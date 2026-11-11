/** Canonical public site origin used when rewriting generated internal links. */
export const SITE_ORIGIN = "https://fuyuntravel.com";

const ALT_HOSTS = new Set([
  "fuyuntravel.com",
  "www.fuyuntravel.com",
  "yunsun.com.tw",
  "www.yunsun.com.tw",
]);

export type InternalPage = {
  path: string;
  title: string;
  keywords: string[];
};

/** A compact subset offered to the model. Post-processing still uses the full catalog. */
const PROMPT_PATHS = [
  "/services",
  "/services/coach-charter",
  "/services/midibus-charter",
  "/services/van-charter",
  "/services/airport-transfer",
  "/services/school-trip",
  "/services/business-charter",
  "/services/custom-tour",
  "/charter-bus/taipei",
  "/charter-bus/new-taipei",
  "/charter-bus/taoyuan",
  "/charter-bus/hsinchu",
  "/charter-bus/taichung",
  "/charter-bus/tainan",
  "/charter-bus/kaohsiung",
  "/service/day-tour",
  "/service/corporate-trip",
  "/service/school-trip",
  "/service/airport-transfer",
  "/service/bus-charter",
  "/service/nine-seater",
  "/service/price",
  "/attractions",
  "/charter-routes",
  "/knowledge",
  "/itineraries",
  "/itineraries/1",
  "/itineraries/2",
  "/itineraries/3",
  "/contact/inquiry",
  "/fleet",
] as const;

const STATIC_PAGES: InternalPage[] = [
  { path: "/", title: "浮雲輕鬆遊官網首頁", keywords: ["官網", "首頁"] },
  { path: "/about", title: "關於我們", keywords: ["關於", "公司介紹", "旅行社"] },
  { path: "/services", title: "服務項目", keywords: ["服務", "包車服務"] },
  { path: "/fleet", title: "車隊介紹", keywords: ["車隊", "車輛", "車型"] },
  { path: "/travel", title: "旅遊探索中心", keywords: ["旅遊內容"] },
  { path: "/knowledge", title: "台灣旅遊知識庫", keywords: ["知識庫", "攻略"] },
  { path: "/attractions", title: "台灣熱門景點探索", keywords: ["景點", "熱門景點"] },
  { path: "/charter-routes", title: "台灣熱門包車路線", keywords: ["包車路線", "路線"] },
  { path: "/travel-planner", title: "AI 行程規劃入口", keywords: ["行程規劃"] },
  { path: "/itineraries", title: "精選行程", keywords: ["精選行程", "行程"] },
  { path: "/reviews", title: "旅客評價", keywords: ["評價", "心得"] },
  { path: "/featured-trips", title: "熱門旅遊內容", keywords: ["熱門旅遊"] },
  { path: "/highlights", title: "這裡真好玩", keywords: ["亮點"] },
  { path: "/ai-trip-planner", title: "AI行程規劃", keywords: ["AI規劃"] },
  { path: "/contact", title: "聯絡我們", keywords: ["聯絡", "聯繫"] },
  { path: "/contact/inquiry", title: "立即報價", keywords: ["詢價", "報價", "預約"] },
  { path: "/download", title: "下載 App", keywords: ["App", "下載"] },
  { path: "/privacy", title: "隱私權政策", keywords: ["隱私"] },
];

const SERVICE_PAGES: InternalPage[] = [
  { path: "/services/coach-charter", title: "遊覽車包車", keywords: ["遊覽車", "大巴", "團體包車"] },
  { path: "/services/midibus-charter", title: "中巴包車", keywords: ["中巴"] },
  { path: "/services/van-charter", title: "九人座包車", keywords: ["九人座", "私人包車"] },
  { path: "/services/airport-transfer", title: "機場接送", keywords: ["機場", "接送", "桃園機場", "松山機場"] },
  { path: "/services/school-trip", title: "校外教學", keywords: ["校外教學", "畢業旅行", "學校包車"] },
  { path: "/services/business-charter", title: "企業旅遊", keywords: ["企業旅遊", "員工旅遊", "公司旅遊", "行號", "會議接駁"] },
  { path: "/services/custom-tour", title: "客製化行程", keywords: ["客製", "客製化"] },
];

const MONEY_PAGES: InternalPage[] = [
  { path: "/service/school-trip", title: "校外教學遊覽車", keywords: ["校外教學", "畢業旅行", "學校"] },
  { path: "/service/corporate-trip", title: "企業旅遊包車", keywords: ["企業旅遊", "員工旅遊", "公司", "行號", "企業"] },
  { path: "/service/airport-transfer", title: "機場接送", keywords: ["機場接送", "機場", "桃園機場", "松山機場"] },
  { path: "/service/price", title: "遊覽車價格", keywords: ["價格", "費用", "報價"] },
  { path: "/service/day-tour", title: "一日遊包車", keywords: ["一日遊", "一日包車"] },
  { path: "/service/bus-charter", title: "遊覽車包車", keywords: ["遊覽車包車", "遊覽車"] },
  { path: "/service/nine-seater", title: "九人座包車", keywords: ["九人座"] },
];

const CITY_PAGES: InternalPage[] = [
  { path: "/charter-bus/taipei", title: "台北遊覽車包車", keywords: ["台北", "臺北"] },
  { path: "/charter-bus/new-taipei", title: "新北遊覽車出租", keywords: ["新北", "板橋"] },
  { path: "/charter-bus/taoyuan", title: "桃園機場接送", keywords: ["桃園", "桃園機場"] },
  { path: "/charter-bus/hsinchu", title: "竹科企業旅遊", keywords: ["新竹", "竹科"] },
  { path: "/charter-bus/taichung", title: "台中包車旅遊", keywords: ["台中", "臺中"] },
  { path: "/charter-bus/tainan", title: "台南包車旅遊", keywords: ["台南", "臺南"] },
  { path: "/charter-bus/kaohsiung", title: "高雄遊覽車出租", keywords: ["高雄"] },
];

const ATTRACTION_PAGES: InternalPage[] = [
  { path: "/attractions/jiufen", title: "九份老街", keywords: ["九份"] },
  { path: "/attractions/yehliu", title: "野柳地質公園", keywords: ["野柳"] },
  { path: "/attractions/tamsui", title: "淡水老街", keywords: ["淡水"] },
  { path: "/attractions/sun-moon-lake", title: "日月潭", keywords: ["日月潭"] },
  { path: "/attractions/alishan", title: "阿里山", keywords: ["阿里山"] },
  { path: "/attractions/cingjing", title: "清境農場", keywords: ["清境"] },
  { path: "/attractions/kenting", title: "墾丁", keywords: ["墾丁"] },
  { path: "/attractions/taroko", title: "太魯閣", keywords: ["太魯閣", "花蓮"] },
  { path: "/attractions/liufu-village", title: "六福村主題遊樂園", keywords: ["六福村"] },
  { path: "/attractions/flying-cow-ranch", title: "飛牛牧場", keywords: ["飛牛牧場"] },
  { path: "/attractions/national-palace-museum", title: "故宮博物院", keywords: ["故宮"] },
  { path: "/attractions/leofoo-resort", title: "關西六福莊", keywords: ["六福莊"] },
];

const ROUTE_PAGES: InternalPage[] = [
  { path: "/charter-routes/taipei-jiufen", title: "台北到九份包車", keywords: ["台北到九份", "九份包車"] },
  { path: "/charter-routes/taipei-yehliu", title: "台北到野柳包車", keywords: ["台北到野柳", "野柳包車"] },
  { path: "/charter-routes/taipei-tamsui", title: "台北到淡水包車", keywords: ["台北到淡水", "淡水包車"] },
  { path: "/charter-routes/taoyuan-airport-jiufen", title: "桃園機場到九份接送", keywords: ["桃園機場到九份"] },
  { path: "/charter-routes/shulin-sun-moon-lake", title: "樹林到日月潭包車", keywords: ["樹林到日月潭"] },
  { path: "/charter-routes/banqiao-alishan", title: "板橋到阿里山包車", keywords: ["板橋到阿里山"] },
  { path: "/charter-routes/taipei-cingjing", title: "台北到清境包車", keywords: ["台北到清境"] },
  { path: "/charter-routes/taipei-taichung", title: "台北到台中包車", keywords: ["台北到台中"] },
  { path: "/charter-routes/taipei-hualien", title: "台北到花蓮包車", keywords: ["台北到花蓮"] },
  { path: "/charter-routes/taipei-kenting", title: "台北到墾丁包車", keywords: ["台北到墾丁"] },
  { path: "/charter-routes/new-taipei-school-trip-liufu-village", title: "新北校外教學到六福村遊覽車", keywords: ["新北校外教學", "六福村遊覽車"] },
  { path: "/charter-routes/shulin-school-trip-flying-cow", title: "樹林校外教學到飛牛牧場遊覽車", keywords: ["樹林校外教學", "飛牛牧場遊覽車"] },
];

const KNOWLEDGE_PAGES: InternalPage[] = [
  { path: "/knowledge/taipei-to-jiufen-charter-price", title: "台北到九份包車多少錢", keywords: ["九份包車多少錢"] },
  { path: "/knowledge/taipei-to-yehliu-charter", title: "台北到野柳包車推薦", keywords: ["野柳包車推薦"] },
  { path: "/knowledge/shulin-to-sun-moon-lake-charter-cost", title: "樹林到日月潭包車費用", keywords: ["日月潭包車費用"] },
  { path: "/knowledge/jiufen-old-street-travel-guide", title: "九份老街旅遊攻略", keywords: ["九份攻略"] },
  { path: "/knowledge/sun-moon-lake-day-trip-guide", title: "日月潭一日遊攻略", keywords: ["日月潭一日遊"] },
  { path: "/knowledge/alishan-two-day-trip-guide", title: "阿里山二天兩夜攻略", keywords: ["阿里山二天"] },
  { path: "/knowledge/jiufen-shifen-yehliu-day-trip", title: "九份十分野柳一日遊", keywords: ["九份十分野柳", "十分"] },
  { path: "/knowledge/sun-moon-lake-cingjing-three-days", title: "日月潭清境三天兩夜", keywords: ["日月潭清境"] },
  { path: "/knowledge/taiwan-round-island-eight-days", title: "台灣環島八天七夜", keywords: ["環島"] },
  { path: "/knowledge/flying-cow-ranch-school-trip-charter", title: "飛牛牧場校外教學包車", keywords: ["飛牛牧場校外教學"] },
  { path: "/knowledge/leofoo-village-school-trip-bus", title: "六福村校外教學遊覽車", keywords: ["六福村校外教學"] },
  { path: "/knowledge/taoyuan-airport-to-jiufen-transfer", title: "桃園機場到九份接送攻略", keywords: ["機場到九份"] },
];

const TRAVEL_PAGES: InternalPage[] = [
  { path: "/travel/taiwan-charter-travel-guide", title: "台灣包車旅遊怎麼規劃？家庭、企業與銀髮族行程建議", keywords: ["包車旅遊怎麼規劃"] },
  { path: "/travel/alishan-sunrise-charter", title: "阿里山日出包車攻略：車型、出發時間與長輩友善安排", keywords: ["阿里山日出"] },
  { path: "/travel/airport-transfer-group-guide", title: "團體機場接送怎麼安排？行李、人數與多點接送注意事項", keywords: ["團體機場接送"] },
  { path: "/travel/school-trip-charter-safety", title: "校外教學包車安全清單：學校出發前要確認什麼？", keywords: ["校外教學安全"] },
  { path: "/travel/group-charter-quote-checklist-20260621", title: "團體包車詢價清單", keywords: ["詢價清單", "團體包車"] },
];

const SCHOOL_TRIP_PAGES: InternalPage[] = [
  { path: "/school-trips/flying-cow-ranch", title: "飛牛牧場校外教學", keywords: ["飛牛牧場"] },
  { path: "/school-trips/leofoo-village", title: "六福村校外教學", keywords: ["六福村"] },
  { path: "/school-trips/national-palace-museum", title: "故宮博物院校外教學", keywords: ["故宮"] },
  { path: "/school-trips/green-world", title: "綠世界校外教學", keywords: ["綠世界"] },
  { path: "/school-trips/little-ding-dong-science-park", title: "小叮噹科學園區校外教學", keywords: ["小叮噹"] },
];

const FLEET_PAGES: InternalPage[] = [
  { path: "/fleet/coach-42", title: "42 人座大巴（雲陞遊覽車）", keywords: ["42人座", "大巴"] },
  { path: "/fleet/man", title: "MAN 遊覽車", keywords: ["MAN"] },
  { path: "/fleet/scania-k400", title: "Scania K400", keywords: ["Scania K400"] },
  { path: "/fleet/scania-k380", title: "Scania K380", keywords: ["Scania K380"] },
  { path: "/fleet/hino", title: "Hino", keywords: ["Hino"] },
  { path: "/fleet/daewoo", title: "Daewoo", keywords: ["Daewoo"] },
  { path: "/fleet/mercedes-van", title: "賓士九人座", keywords: ["賓士", "Mercedes"] },
  { path: "/fleet/toyota-midibus", title: "TOYOTA 中巴", keywords: ["TOYOTA", "豐田中巴"] },
];

const ITINERARY_PAGES: InternalPage[] = [
  { path: "/itineraries/1", title: "陽明山繡球花與北投溫泉一日遊", keywords: ["陽明山", "北投", "溫泉", "繡球花", "芒草"] },
  { path: "/itineraries/2", title: "阿里山日出與奮起湖三日遊", keywords: ["阿里山日出", "奮起湖"] },
  { path: "/itineraries/3", title: "台南美食古都包車二日遊", keywords: ["台南美食", "古都"] },
  { path: "/itineraries/4", title: "太平山見晴懷古步道三日遊", keywords: ["太平山", "見晴"] },
  { path: "/itineraries/5", title: "花蓮縱谷山海四日遊", keywords: ["花蓮縱谷"] },
  { path: "/itineraries/6", title: "日月潭九族賞櫻三日遊", keywords: ["九族", "賞櫻"] },
];

const LOCALE_PATHS = ["/zh", "/zh-tw", "/en", "/ja", "/ko", "/ms", "/vi", "/th"];
const LOCALE_PAGES: InternalPage[] = LOCALE_PATHS.map((path) => ({
  path,
  title: path.slice(1),
  keywords: [],
}));

const ALL_PAGES: InternalPage[] = [
  ...STATIC_PAGES,
  ...SERVICE_PAGES,
  ...MONEY_PAGES,
  ...CITY_PAGES,
  ...ATTRACTION_PAGES,
  ...ROUTE_PAGES,
  ...KNOWLEDGE_PAGES,
  ...TRAVEL_PAGES,
  ...SCHOOL_TRIP_PAGES,
  ...FLEET_PAGES,
  ...ITINERARY_PAGES,
  ...LOCALE_PAGES,
];

const PAGE_BY_PATH = new Map(ALL_PAGES.map((page) => [page.path, page]));

/** Snapshot of the production sitemap paths. Locale variants are valid but not used as replacements. */
export const SITEMAP_PATHS = new Set(ALL_PAGES.map((page) => page.path));

const MATCHABLE_PAGES = ALL_PAGES.filter((page) => !LOCALE_PATHS.includes(page.path));

const STOP_TERMS = new Set([
  "推薦", "方案", "更多", "相關", "了解", "連結", "頁面", "官方", "我們", "以及",
  "這個", "一個", "可以", "行程", "旅遊", "台灣", "臺灣", "輕鬆遊", "浮雲",
  "文章", "內容", "這裡", "那裡", "請洽", "立即",
]);

const SLUG_SYNONYMS: Record<string, string[]> = {
  taipei: ["台北", "臺北"],
  "new-taipei": ["新北"],
  taoyuan: ["桃園"],
  hsinchu: ["新竹", "竹科"],
  taichung: ["台中", "臺中"],
  tainan: ["台南", "臺南"],
  kaohsiung: ["高雄"],
  jiufen: ["九份"],
  yehliu: ["野柳"],
  tamsui: ["淡水"],
  "sun-moon-lake": ["日月潭"],
  alishan: ["阿里山"],
  cingjing: ["清境"],
  kenting: ["墾丁"],
  taroko: ["太魯閣"],
  hualien: ["花蓮"],
  shulin: ["樹林"],
  banqiao: ["板橋"],
  "liufu-village": ["六福村"],
  "leofoo-village": ["六福村"],
  "leofoo-resort": ["六福莊"],
  "flying-cow": ["飛牛牧場"],
  "flying-cow-ranch": ["飛牛牧場"],
  "national-palace-museum": ["故宮"],
  "green-world": ["綠世界"],
  "little-ding-dong-science-park": ["小叮噹"],
  "airport-transfer": ["機場接送", "機場"],
  "day-tour": ["一日遊", "一日包車"],
  "bus-charter": ["遊覽車包車", "遊覽車"],
  "coach-charter": ["遊覽車包車", "遊覽車"],
  "nine-seater": ["九人座"],
  "van-charter": ["九人座"],
  "midibus-charter": ["中巴"],
  "corporate-trip": ["企業旅遊", "員工旅遊"],
  "business-charter": ["企業旅遊", "員工旅遊"],
  "school-trip": ["校外教學"],
  "custom-tour": ["客製化"],
  charter: ["包車"],
  "charter-bus": ["包車"],
  "charter-routes": ["包車路線"],
  attractions: ["景點"],
  knowledge: ["攻略", "知識庫"],
  itineraries: ["精選行程"],
  inquiry: ["詢價", "報價"],
  price: ["價格", "費用"],
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function pageSearchText(page: InternalPage): string {
  return [page.path, page.title, ...page.keywords].join(" ");
}

function termsFromText(text: string): string[] {
  const terms: string[] = [];
  const normalized = text.replace(/[臺台]/g, (ch) => (ch === "臺" ? "台" : ch));
  const seen = new Set<string>();
  const add = (term: string) => {
    const value = term.trim();
    if (value.length < 2 || seen.has(value) || STOP_TERMS.has(value)) return;
    seen.add(value);
    terms.push(value);
  };

  for (const synonyms of Object.values(SLUG_SYNONYMS)) {
    for (const word of synonyms) add(word);
  }
  for (const page of MATCHABLE_PAGES) {
    add(page.title);
    for (const word of page.keywords) add(word);
  }

  const found: string[] = [];
  for (const term of terms.sort((a, b) => b.length - a.length)) {
    if (normalized.includes(term) || text.includes(term)) found.push(term);
  }
  for (const slug of normalized.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []) {
    add(slug);
    found.push(slug);
    for (const word of SLUG_SYNONYMS[slug] || []) found.push(word);
  }
  return unique(found);
}

const PLACE_TERMS = new Set([
  "台北", "臺北", "新北", "桃園", "新竹", "竹科", "台中", "臺中", "台南", "臺南", "高雄",
  "板橋", "樹林", "九份", "野柳", "淡水", "十分", "金瓜石", "陽明山", "北投", "溫泉",
  "日月潭", "阿里山", "清境", "墾丁", "太魯閣", "花蓮", "六福村", "六福莊", "飛牛牧場",
  "故宮", "綠世界", "小叮噹", "奮起湖", "太平山", "九族",
]);

function termWeight(term: string): number {
  if (STOP_TERMS.has(term)) return 0;
  if (PLACE_TERMS.has(term)) return 18;
  if (term.length >= 4) return term.length * 3;
  if (term.length === 3) return 8;
  if (/^[a-z0-9-]+$/.test(term)) return 2;
  return 5;
}

export function isSitemapPath(path: string): boolean {
  return SITEMAP_PATHS.has(path);
}

export function canonicalizeSitePath(href: string): { kind: "external" | "internal" | "placeholder"; path?: string } {
  const raw = href.trim();
  if (!raw || raw === "#" || raw === "待補連結" || raw === "待補" || raw === "待填") {
    return { kind: "placeholder" };
  }
  if (/^(javascript:|about:blank|void\()/i.test(raw)) return { kind: "placeholder" };
  if (/^#/.test(raw)) return { kind: "placeholder" };

  let url: URL | null = null;
  if (/^[a-zA-Z][a-zA-Z+\-.]*:/.test(raw)) {
    try {
      url = new URL(raw);
    } catch {
      return { kind: "placeholder" };
    }
  } else if (raw.startsWith("//")) {
    try {
      url = new URL(`https:${raw}`);
    } catch {
      return { kind: "placeholder" };
    }
  } else if (raw.startsWith("/")) {
    try {
      url = new URL(raw, SITE_ORIGIN);
    } catch {
      return { kind: "placeholder" };
    }
  } else if (/^(www\.)?(fuyuntravel\.com|yunsun\.com\.tw)\b/i.test(raw)) {
    try {
      url = new URL(`https://${raw}`);
    } catch {
      return { kind: "placeholder" };
    }
  } else {
    // Bare words such as 待補連結 already handled; other non-URLs are placeholders.
    return { kind: "placeholder" };
  }

  if (!ALT_HOSTS.has(url.hostname.toLowerCase())) return { kind: "external" };
  let path = decodeURIComponent(url.pathname || "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  return { kind: "internal", path };
}

export function toCanonicalUrl(path: string): string {
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

function pagePlaces(page: InternalPage): string[] {
  const haystack = page.title + " " + page.keywords.join(" ");
  return Array.from(PLACE_TERMS).filter((term) => haystack.includes(term));
}

function pageHasTerm(page: InternalPage, term: string): boolean {
  const haystack = pageSearchText(page);
  return (
    haystack.includes(term) ||
    page.title.includes(term) ||
    page.keywords.some((word) => word.includes(term) || term.includes(word)) ||
    (SLUG_SYNONYMS[term] || []).some((word) => haystack.includes(word))
  );
}

export function findBestPage(query: string, options?: { exclude?: Set<string> }): InternalPage | null {
  const terms = termsFromText(query);
  if (!terms.length) return null;
  const queryPlaceSet = new Set(terms.filter((term) => PLACE_TERMS.has(term)));
  let best: { page: InternalPage; score: number } | null = null;
  for (const page of MATCHABLE_PAGES) {
    if (options?.exclude?.has(page.path)) continue;
    let raw = 0;
    let distinctive = false;
    let matched = 0;
    for (const term of terms) {
      if (!pageHasTerm(page, term)) continue;
      const inTitle = page.title.includes(term) || page.keywords.some((word) => word.includes(term));
      raw += inTitle ? termWeight(term) * 2 : termWeight(term);
      matched += 1;
      if (!STOP_TERMS.has(term) && term.length >= 2 && !["包車", "遊覽車", "出租"].includes(term)) {
        distinctive = true;
      }
    }
    if (!distinctive || raw < 8) continue;
    const extraPlaces = pagePlaces(page).filter((term) => !queryPlaceSet.has(term)).length;
    const score = raw * (matched / (matched + extraPlaces));
    const tighter = best && score === best.score && page.path.length < best.page.path.length;
    if (!best || score > best.score || tighter) best = { page, score };
  }
  return best?.page ?? null;
}

export function formatInternalPagesForPrompt(): string {
  return PROMPT_PATHS.map((path) => {
    const page = PAGE_BY_PATH.get(path);
    return page ? `${page.path} ${page.title}` : path;
  }).join("\n");
}

export function getInternalPage(path: string): InternalPage | undefined {
  return PAGE_BY_PATH.get(path);
}

export const internalPageCount = ALL_PAGES.length;
