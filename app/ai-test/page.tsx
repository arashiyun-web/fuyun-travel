"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getAttribution, trackEvent } from "@/lib/analytics";

const examples = [
  "恩愛農場多少錢",
  "太平山費用",
  "鼻頭角步道後面是什麼",
  "想看櫻花",
  "39人樹林到鹿港來回多少錢",
];

function getReplyText(data: unknown) {
  if (!data || typeof data !== "object") return "";

  const record = data as Record<string, unknown>;
  const candidates = [record.reply, record.answer, record.message, record.content, record.text];
  const value = candidates.find((item) => typeof item === "string" && item.trim());

  return typeof value === "string" ? value : "";
}

export default function AiTestPage() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const lineUrl = process.env.NEXT_PUBLIC_LINE_OA_URL || process.env.NEXT_PUBLIC_LINE_URL || "";

  async function submitQuestion(nextMessage?: string) {
    const question = (nextMessage ?? message).trim();

    if (!question || isLoading) return;

    const sessionId = localStorage.getItem("ai_chat_session_id") || crypto.randomUUID();
    localStorage.setItem("ai_chat_session_id", sessionId);
    const attribution = getAttribution();

    trackEvent("ai_chat_started", {
      query: question,
      session_id: sessionId,
      source_page: attribution.sourcePage,
      utm_source: attribution.utmSource,
      utm_campaign: attribution.utmCampaign,
      keyword: attribution.keyword,
    });

    setMessage(question);
    setReply("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: question,
          sessionId,
          source: "ai-test",
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error("AI test request failed");
      }

      const nextReply = getReplyText(data);
      const replyResult = nextReply || "系統暫時無法回覆，請稍後再試。";

      const intent = typeof data.intent === "string" ? data.intent : "general";

      if (intent === "charter") {
        trackEvent("ai_quote_requested", { query: question, session_id: sessionId, source_page: attribution.sourcePage });
      }

      if (intent === "price") {
        trackEvent("ai_price_viewed", { query: question, session_id: sessionId, source_page: attribution.sourcePage });
      }

      setReply(replyResult);
    } catch {
      setError("系統暫時無法回覆，請稍後再試。");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 text-sm font-bold text-neutral-100 transition hover:bg-white/10 hover:no-underline"
          >
            返回首頁
          </Link>
        </div>

        <section className="rounded-lg border border-yellow-300/30 bg-yellow-300/10 p-5 text-neutral-100 shadow-xl shadow-black/20 sm:p-6">
          <h2 className="m-0 text-xl font-black text-yellow-200">⚠️ 測試版聲明</h2>
          <p className="mt-3 text-base text-neutral-200">本功能目前為測試版。</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-black text-neutral-100">可查詢：</p>
              <ul className="m-0 list-none space-y-1 p-0 text-sm text-neutral-300">
                <li>✓ 行程推薦</li>
                <li>✓ 景點順序</li>
                <li>✓ 行程費用</li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-black text-neutral-100">以下需求仍由真人客服確認：</p>
              <ul className="m-0 list-none space-y-1 p-0 text-sm text-neutral-300">
                <li>✓ 包車報價</li>
                <li>✓ 客製行程</li>
                <li>✓ 學校校外教學</li>
                <li>✓ 企業包車</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-neutral-900/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <p className="mb-3 text-sm font-bold tracking-[0.22em] text-yellow-300">FUYUN AI TEST</p>
          <h1 className="m-0 text-3xl font-black leading-tight text-yellow-200 sm:text-4xl">
            浮雲輕鬆遊 AI 行程客服測試版
          </h1>
          <p className="mt-4 max-w-2xl text-base text-neutral-300 sm:text-lg">
            可測試行程費用、景點順序、推薦行程。包車報價會轉由正式客服確認。
          </p>
        </section>

        <section className="rounded-lg border border-white/10 bg-neutral-900 p-5 shadow-xl shadow-black/20 sm:p-6">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-bold text-neutral-200" htmlFor="ai-test-message">
              請輸入行程問題
            </label>
            <textarea
              id="ai-test-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="例如：恩愛農場多少錢、鼻頭角步道後面是什麼、想看櫻花"
              rows={4}
              className="min-h-32 w-full resize-y rounded-md border border-white/10 bg-neutral-950 px-4 py-3 text-base text-neutral-100 outline-none transition placeholder:text-neutral-500 focus:border-yellow-300 focus:ring-2 focus:ring-yellow-300/20"
            />
            <button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-yellow-300 px-6 text-base font-black text-neutral-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
            >
              送出詢問
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                disabled={isLoading}
                onClick={() => void submitQuestion(example)}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-neutral-200 transition hover:border-yellow-300/70 hover:bg-yellow-300/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-40 rounded-lg border border-white/10 bg-neutral-900 p-5 shadow-xl shadow-black/20 sm:p-6">
          <h2 className="m-0 text-lg font-black text-neutral-100">AI 回覆</h2>
          <div className="mt-4 whitespace-pre-wrap rounded-md border border-white/10 bg-neutral-950 p-4 text-base text-neutral-200">
            {isLoading && "查詢中..."}
            {!isLoading && error}
            {!isLoading && !error && reply}
            {!isLoading && !error && !reply && <span className="text-neutral-500">送出問題後，回覆會顯示在這裡。</span>}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-neutral-950/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl justify-center">
          {lineUrl ? (
            <a
              href={lineUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent("line_click", { source: "pricing" })}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#06c755] px-5 text-base font-black text-white transition hover:bg-[#05b64d] hover:no-underline sm:w-auto sm:min-w-80"
            >
              加入 LINE 官方帳號立即詢問
            </a>
          ) : (
            <div className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-white/10 bg-neutral-800 px-5 text-center text-base font-bold text-neutral-300 sm:w-auto sm:min-w-80">
              LINE 官方帳號尚未設定
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
