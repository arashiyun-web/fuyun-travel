export type Tour = {
  id: number;
  title: string;
  departureDate: string;
  tags: string[];
  summary: string;
  price: number;
  days: number;
  region: "北部" | "中部" | "南部" | "東部";
};

export const toursData: Tour[] = [
  {
    id: 1,
    title: "陽明山繡球花與北投溫泉一日遊",
    departureDate: "2026/04/16",
    tags: ["賞花", "家庭旅遊"],
    summary: "適合家庭與銀髮族的北部賞花行程，安排低負擔步行、午餐與溫泉停留。",
    price: 6950,
    days: 1,
    region: "北部",
  },
  {
    id: 2,
    title: "阿里山日出與奮起湖三日遊",
    departureDate: "2026/05/07",
    tags: ["景點", "企業旅遊"],
    summary: "串連阿里山森林鐵道、日出、茶園與奮起湖老街，適合企業員旅與親友團。",
    price: 7900,
    days: 3,
    region: "中部",
  },
  {
    id: 3,
    title: "台南美食古都包車二日遊",
    departureDate: "2026/06/14",
    tags: ["美食", "包車旅遊"],
    summary: "以府城小吃、古蹟散策與安平夕陽為主軸，適合小團體九人座或中巴包車。",
    price: 6300,
    days: 2,
    region: "南部",
  },
  {
    id: 4,
    title: "太平山見晴懷古步道三日遊",
    departureDate: "2026/08/16",
    tags: ["景點", "銀髮旅遊"],
    summary: "安排太平山森林、見晴步道與宜蘭在地美食，行程節奏舒適不趕路。",
    price: 9200,
    days: 3,
    region: "北部",
  },
  {
    id: 5,
    title: "花蓮縱谷山海四日遊",
    departureDate: "2026/08/02",
    tags: ["景點", "企業旅遊"],
    summary: "從太魯閣、七星潭到縱谷田園，適合企業獎勵旅遊與多日包車。",
    price: 12800,
    days: 4,
    region: "東部",
  },
  {
    id: 6,
    title: "日月潭九族賞櫻三日遊",
    departureDate: "2026/09/12",
    tags: ["賞花", "旅遊攻略"],
    summary: "結合日月潭環湖、九族文化村與季節賞櫻，適合家庭與團體包車。",
    price: 9800,
    days: 3,
    region: "中部",
  },
];

export function formatMoney(value: number) {
  return `NT$ ${value.toLocaleString("zh-TW")}`;
}

export function findTourById(id: string | number) {
  return toursData.find((tour) => tour.id === Number(id));
}
