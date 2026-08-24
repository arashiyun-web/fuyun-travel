import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { fleetItems } from "@/lib/siteContent";

export const metadata: Metadata = pageMeta({
  title: "車隊介紹",
  description: "MAN、Scania K400、Scania K380、Hino、Daewoo 等車型介紹，支援遊覽車包車、企業旅遊與校外教學。",
  path: "/fleet",
});

export default function FleetPage() {
  return (
    <>
      <h1>車隊介紹</h1>
      <p className="lead">建立每一種車型的獨立 SEO 頁面，讓旅客能依行程需求了解適合車款。</p>
      <section className="card-grid">
        {fleetItems.map((vehicle) => {
          const Icon = vehicle.icon;
          return (
            <Link className="card" href={`/fleet/${vehicle.slug}`} key={vehicle.slug}>
              <Icon size={28} />
              <h3>{vehicle.title}</h3>
              <p>{vehicle.summary}</p>
            </Link>
          );
        })}
      </section>
    </>
  );
}
