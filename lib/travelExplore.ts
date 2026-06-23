import type { Metadata } from "next";
import { absoluteUrl, organizationJsonLd, pageMeta } from "@/lib/site";

// SEO/GEO schema types are declared per record so future CMS data can enable them explicitly.
export type TravelSchemaType =
  | "Article"
  | "BreadcrumbList"
  | "TouristAttraction"
  | "TravelAgency"
  | "FAQPage"
  | "TouristTrip";

export type RelatedLink = {
  href: string;
  label: string;
};

// Shared fields keep metadata, imagery, schemas, and internal links consistent across content types.
export type ExploreContentBase = {
  title: string;
  description: string;
  slug: string;
  coverImage: string;
  schema: TravelSchemaType[];
  relatedLinks: RelatedLink[];
};

export type Attraction = ExploreContentBase & {
  kind: "attraction";
  location: string;
};

export type Route = ExploreContentBase & {
  kind: "route";
  origin: string;
  destination: string;
};

export type SchoolTrip = ExploreContentBase & {
  kind: "schoolTrip";
  location: string;
  suitableFor: string;
};

export type Article = ExploreContentBase & {
  kind: "article";
  category: string;
  publishedAt: string;
};

export type ExploreContent = Attraction | Route | SchoolTrip | Article;

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=82`;

export const attractions: Attraction[] = [
  {
    kind: "attraction",
    slug: "jiufen",
    title: "九份",
    description: "穿梭山城老街，在燈籠、茶館與海景之間感受懷舊風情。",
    location: "新北市瑞芳區",
    coverImage: image("photo-1495567720989-cebdbdd97913"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [
      { href: "/charter-routes/taipei-jiufen", label: "台北到九份包車" },
      { href: "/knowledge", label: "景點攻略" },
    ],
  },
  {
    kind: "attraction",
    slug: "sun-moon-lake",
    title: "日月潭",
    description: "以湖光山色、環湖景觀與悠閒節奏，安排舒適的中台灣旅程。",
    location: "南投縣魚池鄉",
    coverImage: image("photo-1501785888041-af3ef285b470"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [
      { href: "/charter-routes/taipei-sun-moon-lake", label: "台北到日月潭包車" },
      { href: "/knowledge", label: "行程攻略" },
    ],
  },
  {
    kind: "attraction",
    slug: "alishan",
    title: "阿里山",
    description: "走進雲海、森林鐵路與日出景觀，探索高山旅行的經典魅力。",
    location: "嘉義縣阿里山鄉",
    coverImage: image("photo-1464822759023-fed622ff2c3b"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [
      { href: "/charter-routes/taipei-alishan", label: "台北到阿里山包車" },
      { href: "/travel/alishan-sunrise-charter", label: "阿里山日出攻略" },
    ],
  },
  {
    kind: "attraction",
    slug: "cingjing-farm",
    title: "清境農場",
    description: "在高山草原、綿羊步道與開闊景色中享受親子慢旅行。",
    location: "南投縣仁愛鄉",
    coverImage: image("photo-1500530855697-b586d89ba3ee"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [
      { href: "/charter-routes/taipei-cingjing", label: "雙北到清境包車" },
      { href: "/knowledge", label: "包車攻略" },
    ],
  },
  {
    kind: "attraction",
    slug: "kenting",
    title: "墾丁",
    description: "沿著南國海岸探索沙灘、夕陽與熱帶風景。",
    location: "屏東縣恆春鎮",
    coverImage: image("photo-1507525428034-b723cf961d3e"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [
      { href: "/knowledge", label: "行程攻略" },
      { href: "/contact/inquiry", label: "詢問墾丁包車" },
    ],
  },
  {
    kind: "attraction",
    slug: "taroko",
    title: "太魯閣",
    description: "欣賞峽谷、溪流與壯麗岩壁，出發前請先確認園區開放資訊。",
    location: "花蓮縣秀林鄉",
    coverImage: image("photo-1469474968028-56623f02e42e"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [
      { href: "/knowledge", label: "景點攻略" },
      { href: "/contact/inquiry", label: "詢問花蓮包車" },
    ],
  },
];

export const charterRoutes: Route[] = [
  {
    kind: "route",
    slug: "taipei-jiufen",
    title: "台北 → 九份",
    description: "適合半日或一日安排，可彈性搭配十分、金瓜石等東北角景點。",
    origin: "台北",
    destination: "九份",
    coverImage: image("photo-1518005020951-eccb494ad742"),
    schema: ["TouristTrip", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/attractions/jiufen", label: "探索九份" }],
  },
  {
    kind: "route",
    slug: "taipei-yehliu",
    title: "台北 → 野柳",
    description: "北海岸經典路線，適合搭配金山、基隆或九份彈性規劃。",
    origin: "台北",
    destination: "野柳",
    coverImage: image("photo-1497436072909-f5e4be1713c0"),
    schema: ["TouristTrip", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/knowledge", label: "包車攻略" }],
  },
  {
    kind: "route",
    slug: "taipei-sun-moon-lake",
    title: "台北 → 日月潭",
    description: "跨區長途包車，以舒適休息點與充裕停留時間為規劃重點。",
    origin: "台北",
    destination: "日月潭",
    coverImage: image("photo-1476514525535-07fb3b4ae5f1"),
    schema: ["TouristTrip", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/attractions/sun-moon-lake", label: "探索日月潭" }],
  },
  {
    kind: "route",
    slug: "taipei-alishan",
    title: "台北 → 阿里山",
    description: "適合多日行程，依日出、住宿與同行成員調整移動節奏。",
    origin: "台北",
    destination: "阿里山",
    coverImage: image("photo-1441974231531-c6227db76b6e"),
    schema: ["TouristTrip", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/attractions/alishan", label: "探索阿里山" }],
  },
  {
    kind: "route",
    slug: "taoyuan-airport-jiufen",
    title: "桃園機場 → 九份",
    description: "入境後直達山城，規劃時需一併確認航班、行李與抵達時間。",
    origin: "桃園機場",
    destination: "九份",
    coverImage: image("photo-1436491865332-7a61a109cc05"),
    schema: ["TouristTrip", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [
      { href: "/attractions/jiufen", label: "探索九份" },
      { href: "/travel/airport-transfer-group-guide", label: "機場接送攻略" },
    ],
  },
  {
    kind: "route",
    slug: "taipei-cingjing",
    title: "雙北 → 清境",
    description: "以山區車程、休息點與住宿銜接為核心的中部高山路線。",
    origin: "雙北",
    destination: "清境",
    coverImage: image("photo-1500534623283-312aade485b7"),
    schema: ["TouristTrip", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/attractions/cingjing-farm", label: "探索清境農場" }],
  },
];

export const schoolTrips: SchoolTrip[] = [
  {
    kind: "schoolTrip",
    slug: "flying-cow-ranch",
    title: "飛牛牧場",
    description: "結合動物觀察、乳品體驗與戶外學習的自然教育場域。",
    location: "苗栗縣通霄鎮",
    suitableFor: "幼兒園、國小",
    coverImage: image("photo-1500595046743-cd271d694d30"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/travel/school-trip-charter-safety", label: "校外教學安全清單" }],
  },
  {
    kind: "schoolTrip",
    slug: "leofoo-village",
    title: "六福村",
    description: "主題樂園與動物園區兼具，適合大型團體分組活動。",
    location: "新竹縣關西鎮",
    suitableFor: "國小、國中、高中",
    coverImage: image("photo-1513883049090-d0b7439799bf"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/contact/inquiry", label: "詢問校外教學包車" }],
  },
  {
    kind: "schoolTrip",
    slug: "national-palace-museum",
    title: "故宮博物院",
    description: "透過典藏文物延伸歷史、藝術與文化課程。",
    location: "台北市士林區",
    suitableFor: "國小、國中、高中",
    coverImage: image("photo-1564399579883-451a5d44ec08"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/knowledge", label: "校外教學攻略" }],
  },
  {
    kind: "schoolTrip",
    slug: "green-world",
    title: "綠世界",
    description: "以生態園區串連動植物觀察、環境教育與戶外探索。",
    location: "新竹縣北埔鄉",
    suitableFor: "幼兒園、國小、國中",
    coverImage: image("photo-1441974231531-c6227db76b6e"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/contact/inquiry", label: "詢問校外教學包車" }],
  },
  {
    kind: "schoolTrip",
    slug: "little-ding-dong-science-park",
    title: "小叮噹科學園區",
    description: "透過互動設施認識自然科學，適合寓教於樂的一日活動。",
    location: "新竹縣新豐鄉",
    suitableFor: "國小、國中",
    coverImage: image("photo-1532094349884-543bc11b234d"),
    schema: ["TouristAttraction", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/knowledge", label: "校外教學攻略" }],
  },
];

// Placeholder records are intentionally limited to three until the external travel feed is authorized.
export const latestTripArticles: Article[] = [
  {
    kind: "article",
    slug: "north-coast-day-trip",
    title: "北海岸一日旅行紀錄",
    description: "從海岸風景到山城散步，收藏團體旅行中的自然片刻。",
    category: "小羽旅遊趣",
    publishedAt: "2026-06-18",
    coverImage: image("photo-1500530855697-b586d89ba3ee"),
    schema: ["Article", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/travel", label: "旅遊探索中心" }],
  },
  {
    kind: "article",
    slug: "sun-moon-lake-group-trip",
    title: "日月潭團體慢旅行",
    description: "在湖景、遊船與在地風味之間，保留剛好的旅行節奏。",
    category: "小羽旅遊趣",
    publishedAt: "2026-06-12",
    coverImage: image("photo-1501785888041-af3ef285b470"),
    schema: ["Article", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/attractions/sun-moon-lake", label: "探索日月潭" }],
  },
  {
    kind: "article",
    slug: "alishan-forest-moments",
    title: "阿里山森林旅行片段",
    description: "沿著森林步道與晨光前進，記錄高山團體旅行的風景。",
    category: "小羽旅遊趣",
    publishedAt: "2026-06-08",
    coverImage: image("photo-1464822759023-fed622ff2c3b"),
    schema: ["Article", "BreadcrumbList", "TravelAgency"],
    relatedLinks: [{ href: "/attractions/alishan", label: "探索阿里山" }],
  },
];

export const knowledgeCategories = [
  "包車攻略",
  "景點攻略",
  "行程攻略",
  "校外教學攻略",
  "機場接送攻略",
  "FAQ",
] as const;

// Exploration pages are currently Chinese-only, so they must not advertise missing locale URLs.
export function explorePageMeta(args: Parameters<typeof pageMeta>[0]): Metadata {
  const metadata = pageMeta(args);
  return {
    ...metadata,
    alternates: { canonical: absoluteUrl(args.path ?? "/") },
  };
}

export function findAttraction(slug: string) {
  return attractions.find((item) => item.slug === slug);
}

export function findCharterRoute(slug: string) {
  return charterRoutes.find((item) => item.slug === slug);
}

export function findSchoolTrip(slug: string) {
  return schoolTrips.find((item) => item.slug === slug);
}

// Detail pages share concise JSON-LD builders to avoid schema drift.
export function buildExploreSchemas(
  item: Attraction | Route | SchoolTrip,
  path: string,
  parentName: string,
  parentPath: string,
) {
  const primaryType = item.kind === "route" ? "TouristTrip" : "TouristAttraction";
  const schemas: object[] = [];

  if (item.schema.includes(primaryType)) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": primaryType,
      name: item.title,
      description: item.description,
      image: item.coverImage,
      url: absoluteUrl(path),
      ...(item.kind === "route"
        ? {
            itinerary: `${item.origin} 至 ${item.destination}`,
            touristType: "團體旅客、家庭旅客",
          }
        : { address: item.location }),
    });
  }

  if (item.schema.includes("BreadcrumbList")) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: parentName, item: absoluteUrl(parentPath) },
        { "@type": "ListItem", position: 3, name: item.title, item: absoluteUrl(path) },
      ],
    });
  }

  if (item.schema.includes("TravelAgency")) {
    schemas.push(organizationJsonLd());
  }

  return schemas;
}
