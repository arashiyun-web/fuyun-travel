import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "車型介紹",
  description: "大型遊覽車、中型巴士與小型商務車，依團體人數與行程需求提供合適車款。",
  path: "/fleet",
});

const fleet = [
  { href: "/fleet/coach", title: "大型遊覽車", desc: "適合公司旅遊、團體活動與多日行程，空間舒適、乘坐穩定。" },
  { href: "/fleet/midibus", title: "中型巴士", desc: "適合中小型團體與景點接駁，在乘坐舒適與動線彈性間取得平衡。" },
  { href: "/fleet/van", title: "小型商務車", desc: "適合商務接待、家庭小團與機場接送，保有隱私與高機動性。" },
];

export default function FleetPage() {
  return (
    <>
      <h1>車型介紹</h1>
      <p className="lead">選擇車型，查看詳細車款說明。</p>
      <section className="card-grid">
        {fleet.map((vehicle) => (
          <Link className="card" href={vehicle.href} key={vehicle.href}>
            <h3>{vehicle.title}</h3>
            <p>{vehicle.desc}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
