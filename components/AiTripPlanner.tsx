"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PlannerInput = {
  from: string;
  date: string;
  budget: string;
  people: string;
  ageGroup: string;
  days: string;
};

const initialInput: PlannerInput = {
  from: "板橋",
  date: "",
  budget: "每人 3000-8000",
  people: "12",
  ageGroup: "家庭與長輩",
  days: "2",
};

export default function AiTripPlanner() {
  const [input, setInput] = useState(initialInput);

  const result = useMemo(() => {
    const people = Number(input.people || 0);
    const days = Number(input.days || 1);
    const vehicle = people <= 8 ? "九人座" : people <= 25 ? "中巴" : "遊覽車";
    const cost = vehicle === "九人座" ? "NT$ 8,000-18,000" : vehicle === "中巴" ? "NT$ 16,000-35,000" : "NT$ 28,000-65,000";

    return {
      vehicle,
      cost,
      attractions: ["九份老街", "十分瀑布", "平溪放天燈"],
      restaurants: ["團體合菜餐廳", "在地小吃停靠點"],
      hotels: days >= 2 ? ["新北或宜蘭交通便利飯店"] : ["一日遊可不安排住宿"],
      note: `依 ${input.from || "出發地"} 出發、${people || "未填"} 人、${days || 1} 天與 ${input.ageGroup || "旅客"} 需求，建議以 ${vehicle} 先估價。`,
    };
  }, [input]);

  function update(key: keyof PlannerInput, value: string) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="card-grid">
      <form className="card">
        <h3>AI 行程條件</h3>
        <label className="field">
          <span>出發地</span>
          <input value={input.from} onChange={(event) => update("from", event.target.value)} />
        </label>
        <label className="field">
          <span>日期</span>
          <input type="date" value={input.date} onChange={(event) => update("date", event.target.value)} />
        </label>
        <label className="field">
          <span>預算</span>
          <input value={input.budget} onChange={(event) => update("budget", event.target.value)} />
        </label>
        <label className="field">
          <span>人數</span>
          <input type="number" min={1} value={input.people} onChange={(event) => update("people", event.target.value)} />
        </label>
        <label className="field">
          <span>年齡層</span>
          <input value={input.ageGroup} onChange={(event) => update("ageGroup", event.target.value)} />
        </label>
        <label className="field">
          <span>旅遊天數</span>
          <input type="number" min={1} value={input.days} onChange={(event) => update("days", event.target.value)} />
        </label>
      </form>

      <section className="card">
        <h3>AI 輸出</h3>
        <p>{result.note}</p>
        <p>推薦車型：{result.vehicle}</p>
        <p>預估費用區間：{result.cost}</p>
        <p>景點：{result.attractions.join("、")}</p>
        <p>餐廳：{result.restaurants.join("、")}</p>
        <p>住宿：{result.hotels.join("、")}</p>
        <Link className="btn btn-primary" href="/contact/inquiry">
          立即詢價
        </Link>
      </section>
    </div>
  );
}
