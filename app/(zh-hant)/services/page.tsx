import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, absoluteUrl, organizationJsonLd, pageMeta } from "@/lib/site";
import { serviceSchema } from "@/lib/seo/generateSchema";
import { serviceItems } from "@/lib/siteContent";

export const metadata: Metadata = pageMeta({
  title: "服務項目",
  description: "浮雲輕鬆遊提供遊覽車包車、中巴包車、九人座包車、機場接送、校外教學、企業旅遊與客製化行程。",
  path: "/services",
});

function servicesJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: absoluteUrl("/services"),
    itemListElement: serviceItems.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: serviceSchema({
        name: service.title,
        description: service.summary,
        path: `/services/${service.slug}`,
      }),
    })),
  };
}

export default function ServicesPage() {
  const jsonLd = [organizationJsonLd(), servicesJsonLd()];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1>服務項目</h1>
      <p className="lead">
        依人數、路線、季節與預算，安排合適車型與台灣旅遊動線。車隊規模達 {COMPANY.fleetSize} 輛遊覽車，在職專業駕駛約{" "}
        {COMPANY.driverCount} 位，可依團體大小彈性調度。
      </p>
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
