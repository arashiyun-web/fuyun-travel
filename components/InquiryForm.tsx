"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";

type FormState = "idle" | "sending" | "success" | "error";

export default function InquiryForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/inquiry", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData.entries())),
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (response.ok) {
      setState("success");
      setMessage("詢價已送出，我們會盡快與您聯繫。");
      form.reset();
      return;
    }

    setState("error");
    setMessage("送出失敗，請改用 LINE 或電話聯繫。");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#333]">
          姓名
          <input
            name="name"
            required
            className="h-12 rounded-md border border-[#d8ccb2] bg-white px-4 text-base font-normal outline-none transition focus:border-[#b89b5e] focus:ring-4 focus:ring-[#eadfca]"
            placeholder="請輸入姓名"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#333]">
          電話
          <input
            name="phone"
            required
            inputMode="tel"
            className="h-12 rounded-md border border-[#d8ccb2] bg-white px-4 text-base font-normal outline-none transition focus:border-[#b89b5e] focus:ring-4 focus:ring-[#eadfca]"
            placeholder="請輸入手機或市話"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#333]">
          出發日期
          <input
            name="date"
            type="date"
            className="h-12 rounded-md border border-[#d8ccb2] bg-white px-4 text-base font-normal outline-none transition focus:border-[#b89b5e] focus:ring-4 focus:ring-[#eadfca]"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#333]">
          人數
          <input
            name="passengers"
            inputMode="numeric"
            className="h-12 rounded-md border border-[#d8ccb2] bg-white px-4 text-base font-normal outline-none transition focus:border-[#b89b5e] focus:ring-4 focus:ring-[#eadfca]"
            placeholder="例：8人 / 20人 / 40人"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-[#333]">
        需求類型
        <select
          name="service"
          className="h-12 rounded-md border border-[#d8ccb2] bg-white px-4 text-base font-normal outline-none transition focus:border-[#b89b5e] focus:ring-4 focus:ring-[#eadfca]"
          defaultValue="台灣包車旅遊"
        >
          <option>台灣包車旅遊</option>
          <option>企業包車</option>
          <option>商務接待</option>
          <option>客製旅遊</option>
          <option>小團高品質</option>
          <option>企業交通車</option>
          <option>機場接送</option>
          <option>團體一日遊</option>
          <option>多日旅遊行程</option>
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#333]">
        行程與備註
        <textarea
          name="note"
          rows={5}
          className="rounded-md border border-[#d8ccb2] bg-white px-4 py-3 text-base font-normal outline-none transition focus:border-[#b89b5e] focus:ring-4 focus:ring-[#eadfca]"
          placeholder="請留下出發地、目的地、用車時間、是否需要代排行程"
        />
      </label>

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#c8ad72] px-5 font-bold text-[#242424] transition hover:bg-[#d6bd83] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Send size={18} />
        {state === "sending" ? "送出中" : "送出詢價"}
      </button>

      {message ? (
        <p
          className={`rounded-md px-4 py-3 text-sm font-semibold ${
            state === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

