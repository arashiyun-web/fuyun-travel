export type Tour = {
  id: number;
  title: string;
  departureDate: string;
  tags: string[];
  summary: string;
  price: number;
  days: number;
  region: "東部" | "南部" | "中部" | "離島";
};

export const toursData: Tour[] = [
  {
    id: 1,
    title: "梅花湖甜甜行瓏山林療癒二日遊",
    departureDate: "2026/04/16",
    tags: ["自然探秘", "放鬆慢遊"],
    summary: "漫步梅花湖畔，安排輕鬆餐食與舒適住宿，適合家族與好友慢慢出發。",
    price: 6950,
    days: 2,
    region: "東部"
  },
  {
    id: 2,
    title: "南國慢旅老七佳部落三日遊",
    departureDate: "2026/05/07",
    tags: ["自然探秘", "體驗小旅行"],
    summary: "深入屏東山海線，拜訪部落文化與在地餐桌，安排舒適專車銜接。",
    price: 7900,
    days: 3,
    region: "南部"
  },
  {
    id: 3,
    title: "日月潭森林鐵道湖光二日遊",
    departureDate: "2026/06/14",
    tags: ["自然探秘", "放鬆慢遊"],
    summary: "搭配湖畔景觀、森林步道與下午茶，以輕鬆節奏走進中台灣。",
    price: 6300,
    days: 2,
    region: "中部"
  },
  {
    id: 4,
    title: "花蓮海岸山脈深呼吸三日遊",
    departureDate: "2026/08/16",
    tags: ["放鬆慢遊", "季節限定"],
    summary: "串連海岸線、牧場與山谷景觀，適合想遠離城市、慢下來的人。",
    price: 9200,
    days: 3,
    region: "東部"
  },
  {
    id: 5,
    title: "澎湖跳島藍海花火四日遊",
    departureDate: "2026/08/02",
    tags: ["季節限定", "體驗小旅行"],
    summary: "安排跳島、海景咖啡與花火節夜晚，打造夏季限定離島旅程。",
    price: 12800,
    days: 4,
    region: "離島"
  },
  {
    id: 6,
    title: "阿里山雲海小火車三日遊",
    departureDate: "2026/09/12",
    tags: ["自然探秘", "季節限定"],
    summary: "從山林步道到日出雲海，搭配專車與小火車體驗經典山城風景。",
    price: 9800,
    days: 3,
    region: "中部"
  }
];

export function formatMoney(value: number) {
  return `NT$ ${value.toLocaleString("zh-TW")}`;
}

export function findTourById(id: string | number) {
  return toursData.find((tour) => tour.id === Number(id));
}
