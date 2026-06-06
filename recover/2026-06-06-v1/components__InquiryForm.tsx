"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY } from "@/lib/site";

const SERVICE_TYPES = [
  "台灣包車旅遊",
  "企業包車",
  "商務接待",
  "客製旅遊",
  "小團高品質",
  "企業交通車",
  "機場接送",
  "團體一日遊",
  "多日旅遊行程",
];

// 台灣手機基本驗證：09 開頭，共 10 碼，允許中間有一個「-」
const PHONE_RE = /^09\d{2}-?\d{3}-?\d{3}$/;

export default function InquiryForm() {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // 四、手機欄位基本驗證
    if (!PHONE_RE.test(phone.trim())) {
      setError("請輸入正確的手機號碼（例如 0912-345-678）。");
      return;
    }

    // 一、未勾選同意不得送出
    if (!consent) {
      setError("請先勾選並同意《隱私權政策》後再送出。");
      return;
    }

    setSending(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch("/api/inquiry", {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(formData.entries()),
          phone: phone.trim(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        setError("送出失敗，請稍後再試或改用 LINE、電話聯繫。");
        return;
      }

      e.currentTarget.reset();
      setPhone("");
      setConsent(false);
      setSubmitted(true);
    } catch {
      setError("暫時無法送出，請稍後再試或改用 LINE、電話聯繫。");
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    // 送出成功訊息
    return (
      <div className="form-success" role="status">
        我們已收到您的需求，將由專人與您聯繫。
      </div>
    );
  }

  return (
    <form className="inquiry-form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span>姓名</span>
        <input type="text" name="name" autoComplete="name" required />
      </label>

      <label className="field">
        <span>電話</span>
        <input
          type="tel"
          name="phone"
          inputMode="tel"
          placeholder="0912-345-678"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>出發日期</span>
        <input type="date" name="date" required />
      </label>

      <label className="field">
        <span>人數</span>
        <input type="number" name="passengers" min={1} inputMode="numeric" required />
      </label>

      <label className="field">
        <span>需求類型</span>
        <select name="trip_type" defaultValue={SERVICE_TYPES[0]}>
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>行程與備註</span>
        <textarea name="note" rows={4} />
      </label>

      {/* 三、表單旁簡短個資告知 */}
      <p className="privacy-notice">
        本表單僅為旅遊詢價與客服聯繫目的蒐集您的姓名、電話等資料， 詳見{" "}
        <Link href="/privacy">《隱私權政策》</Link>。
      </p>

      {/* 一、送出前必勾同意 */}
      <label className="consent">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          我已閱讀並同意《隱私權政策》，並同意{COMPANY.companyName}為旅遊詢價與客服聯繫目的蒐集、處理及利用本人資料。
        </span>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={!consent || sending}>
        {sending ? "送出中" : "送出詢價"}
      </button>
    </form>
  );
}
