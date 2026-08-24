import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { formatMoney, toursData } from "@/lib/tours";

export const metadata: Metadata = pageMeta({
  title: "精選行程",
  description: "台灣包車旅遊精選行程，包含賞花、美食、景點、企業旅遊與銀髮旅遊。",
  path: "/itineraries",
});

export default function ItinerariesPage() {
  return (
    <>
      <h1>精選行程</h1>
      <p className="lead">可作為包車旅遊的參考範本，實際內容會依人數、季節與預算調整。</p>
      <section className="card-grid">
        {toursData.map((itinerary) => (
          <div className="card" key={itinerary.id}>
            <p className="lead">
              {itinerary.region}｜{itinerary.days} 日｜{itinerary.departureDate}
            </p>
            <h3>{itinerary.title}</h3>
            <p className="lead">{itinerary.tags.join("、")}</p>
            <p>{itinerary.summary}</p>
            <p className="price">{formatMoney(itinerary.price)} / 人</p>
            <Link href={`/itineraries/${itinerary.id}`}>查看座位預覽</Link>
          </div>
        ))}
      </section>
    </>
  );
}
