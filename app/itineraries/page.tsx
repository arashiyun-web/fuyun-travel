"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { formatMoney, toursData } from "@/lib/tours";

const dayFilters = ["2天", "3天", "4天"];
const regionFilters = ["東部", "南部", "中部", "離島"];

function getDayLabel(days: number) {
  return days >= 4 ? "4天" : `${days}天`;
}

export default function ItinerariesPage() {
  const [keyword, setKeyword] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);

  const filteredTours = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return toursData.filter((tour) => {
      const text = `${tour.title} ${tour.summary} ${tour.region} ${tour.tags.join(" ")}`.toLowerCase();

      return (
        (normalizedKeyword === "" || text.includes(normalizedKeyword)) &&
        (days.length === 0 || days.includes(getDayLabel(tour.days))) &&
        (regions.length === 0 || regions.includes(tour.region))
      );
    });
  }, [days, keyword, regions]);

  function toggleValue(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function clearFilters() {
    setKeyword("");
    setDays([]);
    setRegions([]);
  }

  return (
    <main className="min-h-screen bg-[#f7f3ea] pb-16 pt-16 text-[#242424]">
      <SiteHeader active="itineraries" />

      <section className="relative overflow-hidden bg-[#2f2f2f]">
        <img src="/hero-bus-sunny.png" alt="浮雲旅遊車輛" className="h-[390px] w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
        <div className="absolute left-1/2 top-16 w-full max-w-7xl -translate-x-1/2 px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-bold tracking-[0.25em] text-[#ffe600]">
            第二層｜行程瀏覽
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">
            先看行程圖片，再進入報名選位
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/85">
            保留浮雲原本的沉穩車旅風格。這一層只做瀏覽與篩選，點擊圖片或查看詳情後，才進到第三層選位頁。
          </p>
        </div>
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[270px_1fr] lg:px-8">
        <aside className="h-fit rounded-md border border-[#d8ccb2] bg-white p-6 shadow-[0_18px_45px_rgba(48,39,24,0.12)]">
          <h2 className="text-xl font-black">篩選行程</h2>
          <div className="mt-6 space-y-6">
            <label className="block">
              <span className="text-sm font-bold text-[#6d5c3b]">關鍵字</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                type="search"
                placeholder="輸入地名、主題"
                className="mt-2 h-11 w-full rounded-md border border-[#d8ccb2] px-3 text-sm outline-none focus:border-[#b89b5e]"
              />
            </label>

            <div>
              <p className="mb-3 text-sm font-bold text-[#6d5c3b]">天數</p>
              {dayFilters.map((value) => (
                <label key={value} className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={days.includes(value)}
                    onChange={() => toggleValue(value, days, setDays)}
                    className="accent-[#b89b5e]"
                  />
                  {value === "4天" ? "4天以上" : value}
                </label>
              ))}
            </div>

            <div>
              <p className="mb-3 text-sm font-bold text-[#6d5c3b]">區域</p>
              {regionFilters.map((value) => (
                <label key={value} className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={regions.includes(value)}
                    onChange={() => toggleValue(value, regions, setRegions)}
                    className="accent-[#b89b5e]"
                  />
                  {value}
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-md border border-[#d8ccb2] px-4 py-2.5 text-sm font-bold text-[#4b463d] hover:bg-[#fffaf0]"
            >
              清除篩選
            </button>
          </div>
        </aside>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-[#b89b5e]">ITINERARY</p>
              <h2 className="text-3xl font-black">精選行程</h2>
            </div>
            <p className="text-sm font-bold text-[#6d5c3b]">{filteredTours.length} 個行程</p>
          </div>

          {filteredTours.length ? (
            <div className="grid gap-6 md:grid-cols-2">
              {filteredTours.map((tour) => (
                <article
                  key={tour.id}
                  className="overflow-hidden rounded-md border border-[#d8ccb2] bg-white transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(48,39,24,0.16)]"
                >
                  <Link href={`/itineraries/${tour.id}`} className="block">
                    <div className="flex aspect-[16/10] items-center justify-center bg-[url('/hero-bus-sunny.png')] bg-cover bg-center">
                      <div className="rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white backdrop-blur">
                        {tour.region}｜{tour.days}天
                      </div>
                    </div>
                  </Link>
                  <div className="p-5">
                    <p className="text-sm font-bold text-[#b89b5e]">{tour.departureDate} 出發</p>
                    <h3 className="mt-2 min-h-14 text-lg font-black leading-7 text-[#242424]">{tour.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tour.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#fffaf0] px-2.5 py-1 text-xs font-bold text-[#80683b] ring-1 ring-[#d8ccb2]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 min-h-20 text-sm leading-6 text-[#666]">{tour.summary}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-[#d8ccb2] pt-4">
                      <p className="text-xl font-black text-[#b26b2f]">
                        {formatMoney(tour.price)}
                        <span className="text-sm"> /人</span>
                      </p>
                      <Link
                        href={`/itineraries/${tour.id}`}
                        className="rounded-md bg-[#2f2f2f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#b89b5e] hover:text-[#242424]"
                      >
                        查看詳情
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-[#d8ccb2] bg-white p-12 text-center font-bold text-[#6d5c3b]">
              目前沒有符合條件的行程
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
