"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY } from "@/lib/site";
import { getAttribution, trackEvent } from "@/lib/analytics";

const SERVICE_TYPES = [
  "遊覽車包車",
  "中巴包車",
  "九人座包車",
  "機場接送",
  "校外教學",
  "企業旅遊",
  "國內旅遊",
  "客製化行程",
];

const PHONE_RE = /^09\d{2}-?\d{3}-?\d{3}$|^0\d{1,2}-?\d{6,8}$/;

export default function InquiryForm() {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!PHONE_RE.test(phone.trim())) {
      setError("請輸入可聯絡的手機或市話，例如 0912-345-678 或 02-2685-1666。");
      return;
    }

    if (!consent) {
      setError("送出前請先同意隱私權政策與個人資料使用說明。");
      return;
    }

    setSending(true);

    try {
      const formData = new FormData(e.currentTarget);
      const attribution = getAttribution();
      const response = await fetch("/api/inquiry", {
        method: "POST",
        body: JSON.stringify({
          ...Object.fromEntries(formData.entries()),
          phone: phone.trim(),
          source_page: attribution.sourcePage,
          referer: attribution.referer,
          utm_source: attribution.utmSource,
          utm_medium: attribution.utmMedium,
          utm_campaign: attribution.utmCampaign,
          utm_term: attribution.utmTerm,
          utm_content: attribution.utmContent,
          keyword: attribution.keyword,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        setError("詢價送出失敗，請稍後再試，或改用 LINE / 電話聯絡。");
        return;
      }

      trackEvent("quote_submitted", {
        source_page: attribution.sourcePage,
        utm_source: attribution.utmSource,
        utm_campaign: attribution.utmCampaign,
        keyword: attribution.keyword,
      });

      e.currentTarget.reset();
      setPhone("");
      setConsent(false);
      setSubmitted(true);
    } catch {
      setError("網路連線異常，請稍後再試，或改用 LINE / 電話聯絡。");
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div className="form-success" role="status">
        已收到詢價需求，浮雲客服會依日期、人數與路線協助確認車型與報價。
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
        <span>LINE ID</span>
        <input type="text" name="line_id" placeholder="可選填" />
      </label>

      <label className="field">
        <span>出發日期</span>
        <input type="date" name="date" required />
      </label>

      <label className="field">
        <span>上車地點</span>
        <input type="text" name="pickup_location" placeholder="例如：板橋車站" />
      </label>

      <label className="field">
        <span>目的地</span>
        <input type="text" name="destination" placeholder="例如：阿里山、日月潭" />
      </label>

      <label className="field">
        <span>人數</span>
        <input type="number" name="passengers" min={1} inputMode="numeric" required />
      </label>

      <label className="field">
        <span>服務類型</span>
        <select name="trip_type" defaultValue={SERVICE_TYPES[0]}>
          {SERVICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>行程需求</span>
        <textarea name="note" rows={4} placeholder="可填寫停靠點、行李、長輩/孩童需求或預算。" />
      </label>

      <p className="privacy-notice">
        送出後，{COMPANY.companyName} 僅會將資料用於回覆詢價、車輛安排與服務聯繫。請先閱讀{" "}
        <Link href="/privacy">隱私權政策</Link>。
      </p>

      <label className="consent">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>我同意提供上述資料供 {COMPANY.companyName} 聯絡與報價使用。</span>
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={!consent || sending}>
        {sending ? "送出中..." : "送出詢價"}
      </button>
    </form>
  );
}
