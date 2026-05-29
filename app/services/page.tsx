import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "服務項目",
  description: "企業包車接待、家庭好友小團、機場接送與客製包車旅遊，依集合點與時程彈性規劃。",
  path: "/services",
});

const services = [
  { href: "/services/business-charter", title: "企業包車接待", desc: "會議、活動、貴賓接待與員工旅遊，依集合點與時程規劃車輛調度。" },
  { href: "/services/family-group", title: "家庭好友小團", desc: "適合家族旅遊、好友出遊與銀髮族慢遊，行程彈性、節奏更舒適。" },
  { href: "/services/airport-transfer", title: "機場接送", desc: "往返機場、飯店與景點，協助安排多人行李與班機時間銜接。" },
  { href: "/services/custom-tour", title: "客製包車旅遊", desc: "依天數、預算與偏好規劃台灣各地景點、餐食與住宿動線。" },
];

export default function ServicesPage() {
  return (
    <>
      <h1>服務項目</h1>
      <p className="lead">選擇您需要的服務，查看完整方案。</p>
      <section className="card-grid">
        {services.map((service) => (
          <Link className="card" href={service.href} key={service.href}>
            <h3>{service.title}</h3>
            <p>{service.desc}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
