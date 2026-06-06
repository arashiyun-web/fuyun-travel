export type LocationPage = {
  slug: string;
  city: string;
  title: string;
  keyword: string;
  description: string;
};

export type MoneyPage = {
  slug: string;
  title: string;
  keyword: string;
  description: string;
};

export const locationPages: LocationPage[] = [
  {
    slug: "taipei",
    city: "台北",
    title: "台北遊覽車包車",
    keyword: "台北遊覽車包車",
    description: "台北出發的遊覽車、中巴、九人座包車，適合企業旅遊、校外教學與家庭包車。",
  },
  {
    slug: "new-taipei",
    city: "新北",
    title: "新北遊覽車出租",
    keyword: "新北遊覽車出租",
    description: "新北與板橋地區包車旅遊、機場接送、校外教學與企業旅遊車輛安排。",
  },
  {
    slug: "taoyuan",
    city: "桃園",
    title: "桃園機場接送",
    keyword: "桃園機場接送",
    description: "桃園機場團體接送、九人座接送、中巴與遊覽車接駁安排。",
  },
  {
    slug: "hsinchu",
    city: "新竹",
    title: "竹科企業旅遊",
    keyword: "竹科企業旅遊",
    description: "新竹與竹科企業旅遊、會議接駁、員工旅遊與客戶參訪包車。",
  },
  {
    slug: "taichung",
    city: "台中",
    title: "台中包車旅遊",
    keyword: "台中包車旅遊",
    description: "台中出發中部景點包車旅遊，適合家庭、銀髮族與企業團體。",
  },
  {
    slug: "tainan",
    city: "台南",
    title: "台南包車旅遊",
    keyword: "台南包車旅遊",
    description: "台南美食與古蹟包車路線，支援九人座、中巴與遊覽車。",
  },
  {
    slug: "kaohsiung",
    city: "高雄",
    title: "高雄遊覽車出租",
    keyword: "高雄遊覽車出租",
    description: "高雄團體包車、企業旅遊、學校活動與南部景點接駁。",
  },
];

export const moneyPages: MoneyPage[] = [
  {
    slug: "school-trip",
    title: "校外教學遊覽車",
    keyword: "校外教學遊覽車",
    description: "學校校外教學、畢業旅行與社團活動遊覽車包車說明。",
  },
  {
    slug: "corporate-trip",
    title: "企業旅遊包車",
    keyword: "企業旅遊包車",
    description: "企業員旅、會議接駁、客戶參訪與獎勵旅遊包車服務。",
  },
  {
    slug: "airport-transfer",
    title: "機場接送",
    keyword: "機場接送",
    description: "桃園機場、松山機場與團體旅客機場接送安排。",
  },
  {
    slug: "price",
    title: "遊覽車價格",
    keyword: "遊覽車價格",
    description: "包車價格會依日期、車型、路線、停靠點與服務時間評估。",
  },
  {
    slug: "day-tour",
    title: "一日遊包車",
    keyword: "一日遊包車",
    description: "台灣一日遊包車路線建議，適合家庭、朋友與企業小團體。",
  },
  {
    slug: "bus-charter",
    title: "遊覽車包車",
    keyword: "遊覽車包車",
    description: "大型團體、學校、企業與進香團遊覽車包車服務。",
  },
  {
    slug: "nine-seater",
    title: "九人座包車",
    keyword: "九人座包車",
    description: "私人旅遊、機場接送、外賓接待與家庭旅遊九人座包車。",
  },
];

export function findLocationPage(slug: string) {
  return locationPages.find((page) => page.slug === slug);
}

export function findMoneyPage(slug: string) {
  return moneyPages.find((page) => page.slug === slug);
}
