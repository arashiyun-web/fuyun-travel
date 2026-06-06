import {
  BriefcaseBusiness,
  BusFront,
  Car,
  Map,
  MessageCircle,
  Phone,
  Plane,
  Route,
  Send,
  Users,
  type LucideIcon
} from "lucide-react";

export type ContentItem = {
  slug: string;
  title: string;
  summary: string;
  detail: string;
  icon: LucideIcon;
};

export const serviceItems: ContentItem[] = [
  {
    slug: "business-charter",
    title: "企業包車接待",
    summary: "會議、活動、貴賓接待與員工旅遊，依照集合點與時程規劃車輛調度。",
    detail:
      "適合公司旅遊、商務參訪、活動接駁與貴賓接待。我們會先確認人數、集合點、停靠點與時間，再安排合適車型與動線，讓整趟交通更穩定。",
    icon: BriefcaseBusiness
  },
  {
    slug: "family-group",
    title: "家庭好友小團",
    summary: "適合家族旅遊、好友出遊與銀髮族慢遊，行程彈性、節奏更舒適。",
    detail:
      "小團包車可以依照旅客狀態調整節奏，減少轉車與等候時間。適合親子、長輩同行、好友聚會或想避開制式團體行程的旅客。",
    icon: Users
  },
  {
    slug: "airport-transfer",
    title: "機場接送",
    summary: "往返機場、飯店與景點，協助安排多人行李與班機時間銜接。",
    detail:
      "依照班機時間、行李數量與旅客人數安排車型，適合家庭出國、企業接待、團體返台與飯店接送，讓移動流程更輕鬆。",
    icon: Plane
  },
  {
    slug: "custom-tour",
    title: "客製包車旅遊",
    summary: "依照天數、預算與偏好規劃台灣各地景點、餐食與住宿動線。",
    detail:
      "如果你有想去的景點，我們可以協助整理成順路行程；如果還沒有想法，也能依照自然、慢遊、美食、親子或季節活動安排方向。",
    icon: Map
  }
];

export const fleetItems: ContentItem[] = [
  {
    slug: "coach",
    title: "大型遊覽車",
    summary: "適合公司旅遊、團體活動與多日行程，空間舒適、乘坐穩定。",
    detail:
      "大型遊覽車適合多人團體、公司活動與跨縣市旅遊。座位數多、行李空間充足，適合需要統一接送和長距離移動的旅客。",
    icon: BusFront
  },
  {
    slug: "midibus",
    title: "中型巴士",
    summary: "適合中小型團體與景點接駁，在乘坐舒適與動線彈性間取得平衡。",
    detail:
      "中型巴士適合 10 至 25 人左右的團體，能兼顧乘坐空間與路線彈性，適合家庭團、員工小旅行與景區接駁。",
    icon: Route
  },
  {
    slug: "van",
    title: "小型商務車",
    summary: "適合商務接待、家庭小團與機場接送，保有隱私與高機動性。",
    detail:
      "小型商務車適合少人數、高機動需求的旅程，例如機場接送、商務會議、私人旅遊或長輩同行的小團出遊。",
    icon: Car
  }
];

export const contactItems: ContentItem[] = [
  {
    slug: "inquiry",
    title: "填寫詢價表單",
    summary: "留下出發日期、人數、地點與需求，由專人回覆建議車型與報價。",
    detail:
      "若你還在規劃階段，建議先填寫詢價表單。我們會依照出發地、目的地、人數、日期與停留時間，協助整理可行方案。",
    icon: Send
  },
  {
    slug: "line",
    title: "LINE 快速聯繫",
    summary: "適合已經有大致行程或想先詢問車型、日期、價格的人。",
    detail:
      "LINE 適合快速討論行程、傳送景點清單或確認日期。如果需要正式報價，仍建議補上出發地、人數與用車時間。",
    icon: MessageCircle
  },
  {
    slug: "phone",
    title: "電話聯絡",
    summary: "適合即將出發、臨時接送或需要快速確認可否派車的需求。",
    detail:
      "電話聯絡適合較即時的安排，例如機場接送、臨時包車或活動接駁。請先準備出發地、目的地、日期與人數。",
    icon: Phone
  }
];

export function findContentItem(items: ContentItem[], slug: string) {
  return items.find((item) => item.slug === slug);
}
