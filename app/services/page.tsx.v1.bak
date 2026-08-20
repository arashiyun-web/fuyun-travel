import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { serviceItems } from "@/lib/siteContent";

export const metadata: Metadata = pageMeta({
  title: "服務項目",
  description: "浮雲輕鬆遊提供遊覽車包車、中巴包車、九人座包車、機場接送、校外教學、企業旅遊與客製化行程。",
  path: "/services",
});

export default function ServicesPage() {
  return (
    <>
      <h1>服務項目</h1>
      <p className="lead">依人數、路線、季節與預算，安排合適車型與台灣旅遊動線。</p>
      <section className="card-grid">
        {serviceItems.map((service) => {
          const Icon = service.icon;
          return (
            <Link className="card" href={`/services/${service.slug}`} key={service.slug}>
              <Icon size={28} />
              <h3>{service.title}</h3>
              <p>{service.summary}</p>
            </Link>
          );
        })}
      </section>
    </>
  );
}
