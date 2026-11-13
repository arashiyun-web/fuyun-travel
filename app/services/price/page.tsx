import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import LineButton from "@/components/LineButton";
import { pageMeta } from "@/lib/site";
import {
  SERVICE_PAGES_UPDATED,
  dayPriceText,
  priceAnswer,
  priceFaq,
  serviceAnswerJsonLd,
  vehiclePrices,
} from "@/lib/servicePricing";

const PATH = "/services/price";

export const metadata: Metadata = pageMeta({
  title: "包車價格與遊覽車價目表",
  description: priceAnswer,
  path: PATH,
});

const columns: Array<{ key: "day" | "includes" | "excludes" | "overtime" | "night" | "airportSign" | "driverLodging" | "luggage"; label: string }> = [
  { key: "day", label: "台北一日遊" },
  { key: "includes", label: "費用包含" },
  { key: "excludes", label: "費用不含" },
  { key: "overtime", label: "超時" },
  { key: "night", label: "夜間用車" },
  { key: "airportSign", label: "機場舉牌" },
  { key: "driverLodging", label: "司機食宿" },
  { key: "luggage", label: "行李" },
];

export default function ServicePricePage() {
  const jsonLd = serviceAnswerJsonLd({
    name: "包車價格與遊覽車價目表",
    description: priceAnswer,
    path: PATH,
    vehicles: vehiclePrices.map((row) => row.id),
    faq: priceFaq,
  });

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader active="services" />
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <Link href="/services" className="text-sm font-bold text-[#b89b5e] hover:text-[#242424]">
          返回服務項目
        </Link>
        <article className="mt-6 rounded-md border border-[#d8ccb2] bg-white p-8 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
          <BadgeDollarSign className="text-[#b89b5e]" size={42} />
          <p className="mt-6 text-sm font-bold tracking-[0.25em] text-[#b89b5e]">PRICE</p>
          <h1 className="mt-4 text-4xl font-black">包車價格與遊覽車價目表</h1>
          <p className="mt-5 text-lg font-bold leading-9 text-[#242424]">{priceAnswer}</p>
          <p className="mt-2 text-sm text-[#555]">
            最後更新：<time dateTime={SERVICE_PAGES_UPDATED}>{SERVICE_PAGES_UPDATED}</time>
          </p>

          <div className="mt-8 overflow-x-auto rounded-md ring-1 ring-[#d8ccb2]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="bg-[#fffaf0] p-4 text-left font-black">各車型價目表（新台幣）</caption>
              <thead className="bg-[#fffaf0] text-[#4b463d]">
                <tr>
                  <th scope="col" className="p-3">項目</th>
                  {vehiclePrices.map((row) => (
                    <th scope="col" className="p-3" key={row.id}>
                      <Link href={row.fleetPath} className="font-black text-[#242424] hover:text-[#b89b5e]">{row.vehicle}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns.map((column) => (
                  <tr key={column.key} className="border-t border-[#d8ccb2] align-top">
                    <th scope="row" className="p-3 font-bold">{column.label}</th>
                    {vehiclePrices.map((row) => (
                      <td className="p-3 leading-7 text-[#4b463d]" key={row.id}>
                        {column.key === "day" ? dayPriceText(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-[#555]">
            實際車資依日期、路線、停靠點與用車時間確認；表內沒有寫金額的項目，{" "}
            請洽 LINE 詢價，由專人報價。
          </p>

          <section className="mt-8">
            <h2 className="text-2xl font-black">常見問題</h2>
            <dl className="mt-4 space-y-4">
              {priceFaq.map((item) => (
                <div key={item.question} className="rounded-md bg-[#fffaf0] p-5 ring-1 ring-[#d8ccb2]">
                  <dt className="font-bold">問：{item.question}</dt>
                  <dd className="mt-1 leading-8 text-[#4b463d]">答：{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/contact/inquiry"
              className="inline-flex rounded-md bg-[#2f2f2f] px-5 py-3 font-black text-white transition hover:bg-[#b89b5e] hover:text-[#242424]"
            >
              取得報價
            </Link>
            <LineButton source="pricing">LINE 詢價</LineButton>
          </div>
        </article>
      </section>
    </main>
  );
}
