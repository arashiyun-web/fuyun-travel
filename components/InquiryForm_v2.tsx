"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY } from "@/lib/site";
import { getAttribution, trackEvent } from "@/lib/analytics";

export default function InquiryFormV2() {
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

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
        <span>出發日期</span>
        <input type="date" name="date" required />
      </label>

      <label className="field">
        <span>人數</span>
        <input type="number" name="passengers" min={1} inputMode="numeric" required />
      </label>

      <label className="field">
        <span>出發地</span>
        <input type="text" name="pickup_location" placeholder="例如：板橋車站" required />
      </label>

      <label className="field">
        <span>目的地</span>
        <input type="text" name="destination" placeholder="例如：阿里山、日月潭" required />
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
