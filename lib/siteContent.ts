import {
  BriefcaseBusiness,
  BusFront,
  Car,
  GraduationCap,
  Landmark,
  Map,
  MessageCircle,
  Phone,
  Plane,
  Route,
  Send,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ContentItem = {
  slug: string;
  title: string;
  summary: string;
  detail: string;
  icon: LucideIcon;
  keywords?: string[];
};

export const serviceItems: ContentItem[] = [
  {
    slug: "coach-charter",
    title: "遊覽車包車",
    summary: "適合校外教學、企業旅遊、進香團與大型團體，安排安全舒適的台灣包車動線。",
    detail:
      "浮雲輕鬆遊協助團體確認人數、上車地點、停靠點與行李需求，安排合適車型與司機服務，降低團體移動時的溝通成本。",
    icon: BusFront,
    keywords: ["遊覽車包車", "台灣包車", "團體旅遊"],
  },
  {
    slug: "midibus-charter",
    title: "中巴包車",
    summary: "適合小型公司旅遊、家庭聚會、銀髮旅遊與短天數行程，機動性高。",
    detail:
      "中巴車型適合 10 到 25 人團體，能兼顧車內舒適度與城市道路彈性，常用於一日遊、兩日遊與跨縣市接駁。",
    icon: Route,
    keywords: ["中巴包車", "家庭旅遊", "銀髮旅遊"],
  },
  {
    slug: "van-charter",
    title: "九人座包車",
    summary: "適合家庭、好友、外賓接待與機場接送，保留私人彈性與行程節奏。",
    detail:
      "九人座包車可依旅客航班、飯店、景點與餐廳安排彈性停靠，適合重視隱私與效率的小團體。",
    icon: Car,
    keywords: ["九人座包車", "機場接送", "私人包車"],
  },
  {
    slug: "airport-transfer",
    title: "機場接送",
    summary: "桃園、松山與各大機場接送服務，支援團體行李與多點上下車。",
    detail:
      "依航班時間、行李量與旅客人數規劃車型，提供清楚的接送時間與聯絡窗口，讓抵達與返程更安心。",
    icon: Plane,
    keywords: ["機場接送", "桃園機場包車", "松山機場接送"],
  },
  {
    slug: "school-trip",
    title: "校外教學",
    summary: "支援學校戶外教學、畢旅、社團活動與安全接駁，重視安全與準點。",
    detail:
      "協助學校依年級、人數、景點與集合地點規劃車輛，並保留行前確認、緊急聯絡與保險資料。",
    icon: GraduationCap,
    keywords: ["校外教學", "畢業旅行", "學校包車"],
  },
  {
    slug: "business-charter",
    title: "企業旅遊",
    summary: "企業員旅、會議接駁、客戶參訪與獎勵旅遊，兼顧形象與流程。",
    detail:
      "企業用車可配合活動流程、飯店會場、分車名單與臨時調度，讓行政窗口更容易管理全程。",
    icon: BriefcaseBusiness,
    keywords: ["企業旅遊", "員工旅遊", "會議接駁"],
  },
  {
    slug: "custom-tour",
    title: "客製化行程",
    summary: "依季節、預算、旅客組成與目的地，規劃賞花、美食、景點與深度旅遊。",
    detail:
      "從景點順路性、餐廳停留、車程時間到長輩與兒童需求，提供適合團體節奏的客製化建議。",
    icon: Map,
    keywords: ["客製化行程", "台灣旅遊", "包車旅遊"],
  },
];

export const fleetItems: ContentItem[] = [
  {
    slug: "man",
    title: "MAN 遊覽車",
    summary: "適合企業旅遊、校外教學與長途團體行程，重視穩定性與乘坐舒適。",
    detail:
      "MAN 車型常用於中大型團體旅遊，適合跨縣市移動、長天數行程與需要良好乘坐品質的團體。",
    icon: BusFront,
    keywords: ["MAN", "遊覽車包車"],
  },
  {
    slug: "scania-k400",
    title: "Scania K400",
    summary: "高規格遊覽車選項，適合長途旅遊、企業接待與高舒適度需求。",
    detail:
      "Scania K400 以穩定與舒適為主要特色，適合長時間車程、山線景點與重視旅客體驗的行程。",
    icon: ShieldCheck,
    keywords: ["Scania K400", "高級遊覽車"],
  },
  {
    slug: "scania-k380",
    title: "Scania K380",
    summary: "兼具效率與舒適的團體車型，適合校外教學、賞花與國內旅遊。",
    detail:
      "Scania K380 適合多數中大型團體用車情境，可配合一日遊、兩日遊與多點式行程安排。",
    icon: BusFront,
    keywords: ["Scania K380", "團體包車"],
  },
  {
    slug: "hino",
    title: "Hino",
    summary: "台灣常見車隊主力，適合穩定接送、短中程旅遊與日常團體活動。",
    detail:
      "Hino 車型維修與調度彈性高，適合企業活動、學校接送與一般國內旅遊行程。",
    icon: Route,
    keywords: ["Hino", "遊覽車"],
  },
  {
    slug: "daewoo",
    title: "Daewoo",
    summary: "適合多元團體行程的車隊選項，可依人數與路線搭配安排。",
    detail:
      "Daewoo 車型可支援日常旅遊、接駁與包車活動，搭配車隊調度滿足不同團體需求。",
    icon: BusFront,
    keywords: ["Daewoo", "包車旅遊"],
  },
];

export const contactItems: ContentItem[] = [
  {
    slug: "inquiry",
    title: "立即報價",
    summary: "留下日期、人數、上車地點與目的地，客服協助確認車型與初步報價。",
    detail: "詢價資料會進入站內 API 架構，未來可銜接 LINE AI 客服、CRM 與成交追蹤。",
    icon: Send,
  },
  {
    slug: "line",
    title: "LINE AI客服",
    summary: "預留 LINE OA webhook 與 RAG 架構，可回覆包車、旅遊與常見問題。",
    detail: "第一版提供 webhook 入口與結構化回覆，後續可接 GX10、Qdrant、Ollama 或 OpenAI。",
    icon: MessageCircle,
  },
  {
    slug: "phone",
    title: "電話直撥",
    summary: "需要快速確認車輛、日期或緊急調度時，可直接電話聯絡。",
    detail: "電話聯絡會保留在浮動工具列與聯絡頁，方便桌機與手機使用者快速觸達。",
    icon: Phone,
  },
  {
    slug: "company",
    title: "公司資料",
    summary: "統編、品保會員、履約保證與地址公開呈現，增加信任感。",
    detail: "公司資訊會同步進入 LocalBusiness 與 TravelAgency 結構化資料。",
    icon: Landmark,
  },
];

export function findContentItem(items: ContentItem[], slug: string) {
  return items.find((item) => item.slug === slug);
}
