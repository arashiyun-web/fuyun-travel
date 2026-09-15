import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, absoluteUrl, organizationJsonLd, pageMeta } from "@/lib/site";
import { serviceSchema } from "@/lib/seo/generateSchema";
import { serviceItems } from "@/lib/siteContent";
import { charterFaqPageSchema, vehicleSchema } from "@/lib/seo/generateSchema";
import { charterFaq } from "@/lib/charterFaq";
import { fleetItems } from "@/lib/siteContent";

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
  const jsonLd = [
    organizationJsonLd(),
    servicesJsonLd(),
    vehicleSchema({
      name: "42 人座大巴（雲陞遊覽車）",
      description:
        "42 人座高規格遊覽車，LED 照明、航空座椅、多喇叭音響；台北一日遊 14000 元 / 10 小時。",
      path: "/fleet/coach-42",
      seats: "42",
    }),
    charterFaqPageSchema(charterFaq),
  ];

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

      <section className="mt-10">
        <h2>車型專區</h2>
        <div className="card-grid">
          {fleetItems.map((vehicle) => {
            const Icon = vehicle.icon;
            const photo = vehicle.photos?.[0];
            return (
              <Link className="card" href={`/fleet/${vehicle.slug}`} key={vehicle.slug}>
                {photo ? (
                  <img
                    src={photo}
                    alt={vehicle.title}
                    className="mb-3 h-36 w-full rounded object-cover"
                  />
                ) : (
                  <Icon size={28} />
                )}
                <h3>{vehicle.title}</h3>
                <p>{vehicle.summary}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2>包車常見問題</h2>
        {charterFaq.map((group) => (
          <div className="card mb-4" key={group.vehicle}>
            <h3>【{group.vehicle}】</h3>
            <dl>
              {group.items.map((item) => (
                <div className="mb-3" key={item.question}>
                  <dt className="font-bold">問：{item.question}</dt>
                  <dd className="mt-1">答：{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </>
  );
}
