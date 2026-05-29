import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "精選行程",
  description: "梅花湖、老七佳部落、日月潭、花蓮海岸山脈、澎湖跳島、阿里山等精選行程，瀏覽後即可報名選位。",
  path: "/itineraries",
});

const itineraries = [
  { id: 1, area: "東部", days: "2天", date: "2026/04/16", title: "梅花湖甜甜行瓏山林療癒二日遊", tag: "自然探秘放鬆慢遊", desc: "漫步梅花湖畔，安排輕鬆餐食與舒適住宿，適合家族與好友慢慢出發。", price: "NT$ 6,950" },
  { id: 2, area: "南部", days: "3天", date: "2026/05/07", title: "南國慢旅老七佳部落三日遊", tag: "自然探秘體驗小旅行", desc: "深入屏東山海線，拜訪部落文化與在地餐桌，安排舒適專車銜接。", price: "NT$ 7,900" },
  { id: 3, area: "中部", days: "2天", date: "2026/06/14", title: "日月潭森林鐵道湖光二日遊", tag: "自然探秘放鬆慢遊", desc: "搭配湖畔景觀、森林步道與下午茶，以輕鬆節奏走進中台灣。", price: "NT$ 6,300" },
  { id: 4, area: "東部", days: "3天", date: "2026/08/16", title: "花蓮海岸山脈深呼吸三日遊", tag: "放鬆慢遊季節限定", desc: "串連海岸線、牧場與山谷景觀，適合想遠離城市、慢下來的人。", price: "NT$ 9,200" },
  { id: 5, area: "離島", days: "4天", date: "2026/08/02", title: "澎湖跳島藍海花火四日遊", tag: "季節限定體驗小旅行", desc: "安排跳島、海景咖啡與花火節夜晚，打造夏季限定離島旅程。", price: "NT$ 12,800" },
  { id: 6, area: "中部", days: "3天", date: "2026/09/12", title: "阿里山雲海小火車三日遊", tag: "自然探秘季節限定", desc: "從山林步道到日出雲海，搭配專車與小火車體驗經典山城風景。", price: "NT$ 9,800" },
];

export default function ItinerariesPage() {
  return (
    <>
      <h1>精選行程</h1>
      <p className="lead">瀏覽下方精選行程，點選「查看詳情」即可進入報名選位。</p>
      <section className="card-grid">
        {itineraries.map((itinerary) => (
          <div className="card" key={itinerary.id}>
            <p className="lead">{itinerary.area}｜{itinerary.days}　{itinerary.date} 出發</p>
            <h3>{itinerary.title}</h3>
            <p className="lead">{itinerary.tag}</p>
            <p>{itinerary.desc}</p>
            <p className="price">{itinerary.price} /人</p>
            <Link href={`/itineraries/${itinerary.id}`}>查看詳情</Link>
          </div>
        ))}
      </section>
    </>
  );
}
