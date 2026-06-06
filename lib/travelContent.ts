import { absoluteUrl, COMPANY, SITE } from "@/lib/site";

export type TravelCategory =
  | "賞花"
  | "美食"
  | "景點"
  | "包車旅遊"
  | "校外教學"
  | "企業旅遊"
  | "銀髮旅遊"
  | "機場接送"
  | "旅遊攻略";

export type TravelArticle = {
  slug: string;
  title: string;
  description: string;
  publishDate: string;
  category: TravelCategory;
  tags: string[];
  location: string;
  image: string;
  sections: Array<{ heading: string; body: string }>;
  faq: Array<{ question: string; answer: string }>;
  geo?: { latitude: number; longitude: number };
};

export const travelCategories: TravelCategory[] = [
  "賞花",
  "美食",
  "景點",
  "包車旅遊",
  "校外教學",
  "企業旅遊",
  "銀髮旅遊",
  "機場接送",
  "旅遊攻略",
];

export const keywordSeeds = [
  "台灣包車",
  "遊覽車包車",
  "機場接送",
  "校外教學",
  "企業旅遊",
  "台灣旅遊",
  "賞櫻",
  "賞楓",
  "繡球花",
  "阿里山",
  "日月潭",
  "九份",
  "十分",
  "太平山",
  "武陵農場",
];

export const travelArticles: TravelArticle[] = [
  {
    slug: "taiwan-charter-travel-guide",
    title: "台灣包車旅遊怎麼規劃？家庭、企業與銀髮族行程建議",
    description: "整理台灣包車旅遊常見情境、車型選擇、行程節奏與詢價前應準備的資料。",
    publishDate: "2026-06-06",
    category: "包車旅遊",
    tags: ["台灣包車", "九人座包車", "遊覽車包車", "旅遊攻略"],
    location: "台灣",
    image: "/hero-bus-sunny.png",
    sections: [
      {
        heading: "先確認旅客組成",
        body: "家庭旅遊、企業員旅、校外教學與銀髮旅遊的節奏不同，建議先確認人數、年齡層、行李量與是否需要低步行量安排。",
      },
      {
        heading: "依人數選擇車型",
        body: "九人座適合私人彈性，中巴適合小型團體，遊覽車適合校外教學、企業旅遊與大型團體。若有山區、飯店巷弄或多點上下車，也應提前說明。",
      },
      {
        heading: "詢價前準備資料",
        body: "建議提供日期、出發時間、上車地點、目的地、預估人數、停靠點、是否需代訂餐廳或門票，以及是否有長輩、孩童或行李需求。",
      },
    ],
    faq: [
      {
        question: "台灣包車旅遊要提前多久詢價？",
        answer: "平日建議至少提前 7 到 14 天，連假、賞花季與畢旅旺季建議更早確認。",
      },
      {
        question: "可以只提供大概行程先估價嗎？",
        answer: "可以。先提供日期、人數、上車地點與主要目的地，就能協助初步評估車型與費用區間。",
      },
    ],
  },
  {
    slug: "alishan-sunrise-charter",
    title: "阿里山日出包車攻略：車型、出發時間與長輩友善安排",
    description: "阿里山日出行程的包車安排重點，包含車程、休息點、長輩友善與企業旅遊建議。",
    publishDate: "2026-06-05",
    category: "景點",
    tags: ["阿里山", "包車旅遊", "銀髮旅遊"],
    location: "嘉義阿里山",
    image: "/hero-bus-sunny.png",
    geo: { latitude: 23.5086, longitude: 120.805 },
    sections: [
      {
        heading: "行程節奏要留白",
        body: "阿里山車程較長，適合安排中途休息、用餐與拍照時間，避免把景點排得過滿。",
      },
      {
        heading: "車型選擇建議",
        body: "家庭與小團體可選九人座或中巴，企業與大型團體則建議遊覽車，並提前確認停車與集合位置。",
      },
    ],
    faq: [
      {
        question: "阿里山日出適合銀髮族嗎？",
        answer: "可以，但建議降低步行量、安排保暖提醒，並預留休息與用餐時間。",
      },
      {
        question: "阿里山包車需要幾天？",
        answer: "若要看日出並兼顧舒適度，通常建議 2 到 3 天。",
      },
    ],
  },
  {
    slug: "airport-transfer-group-guide",
    title: "團體機場接送怎麼安排？行李、人數與多點接送注意事項",
    description: "整理桃園機場與松山機場團體接送的車型、人數、行李與多點上下車安排。",
    publishDate: "2026-06-04",
    category: "機場接送",
    tags: ["機場接送", "桃園機場", "團體接送"],
    location: "桃園機場",
    image: "/hero-bus-sunny.png",
    sections: [
      {
        heading: "先估算行李空間",
        body: "機場接送不能只看人數，還要確認大型行李、登機箱、嬰兒車與器材箱數量。",
      },
      {
        heading: "多點上下車要提前排序",
        body: "若有多個飯店或集合點，建議提前排序停靠點，避免繞路造成時間壓力。",
      },
    ],
    faq: [
      {
        question: "團體機場接送可以多點下車嗎？",
        answer: "可以，但需先提供地址與人數，方便安排車程與報價。",
      },
      {
        question: "紅眼班機也可以接送嗎？",
        answer: "可依車隊調度安排，建議提前確認航班時間與集合地點。",
      },
    ],
  },
  {
    slug: "school-trip-charter-safety",
    title: "校外教學包車安全清單：學校出發前要確認什麼？",
    description: "校外教學與畢業旅行包車前，學校行政窗口可使用的安全與資料確認清單。",
    publishDate: "2026-06-03",
    category: "校外教學",
    tags: ["校外教學", "遊覽車包車", "安全"],
    location: "台灣",
    image: "/hero-bus-sunny.png",
    sections: [
      {
        heading: "確認人數與分車名單",
        body: "學校活動建議先建立分車名單、帶隊老師聯絡資料與緊急聯絡流程。",
      },
      {
        heading: "保留保險與公司資訊",
        body: "品保會員、履約保證、公司資料與車輛資訊可放入行前資料，增加家長信任感。",
      },
    ],
    faq: [
      {
        question: "校外教學包車需要提供哪些資料？",
        answer: "通常需要日期、學校地址、人數、目的地、分車需求、帶隊老師聯絡方式與預估行程。",
      },
      {
        question: "可以配合學校臨時調整停靠點嗎？",
        answer: "可視車程與安全條件調整，建議由單一窗口統一通知。",
      },
    ],
  },
];

export function findTravelArticle(slug: string) {
  return travelArticles.find((article) => article.slug === slug);
}

export function buildArticleJsonLd(article: TravelArticle) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    image: absoluteUrl(article.image),
    datePublished: article.publishDate,
    author: {
      "@type": "Organization",
      name: COMPANY.companyName,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
    },
    mainEntityOfPage: absoluteUrl(`/travel/${article.slug}`),
    about: article.tags,
  };
}

export function buildFaqJsonLd(article: TravelArticle) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
