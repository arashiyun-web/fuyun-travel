import { NextResponse } from "next/server";
import { unauthorized, verifyAdminRequest } from "@/lib/adminQuoteAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function topEntries(entries: Array<string | null>, limit = 8) {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    const key = String(entry || "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function keywordEntries(queries: string[]) {
  const stopWords = new Set(["多少錢", "費用", "想看", "後面", "是什麼", "行程", "推薦", "請問"]);
  const words: string[] = [];

  for (const query of queries) {
    const compact = query.replace(/[，。！？、,.!?]/g, " ");
    for (const word of compact.split(/\s+/)) {
      const value = word.trim();
      if (!value || value.length < 2 || stopWords.has(value)) continue;
      words.push(value);
    }
  }

  return topEntries(words);
}

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) return unauthorized();

  const now = new Date();
  const today = startOfDay(now);
  const month = startOfMonth(now);

  const [todayQuotes, todayInquiries, monthQuotes, monthInquiries, aiConversations, quotes] = await Promise.all([
    prisma.charterQuote.count({ where: { createdAt: { gte: today } } }),
    prisma.inquiry.count({ where: { createdAt: { gte: today } } }),
    prisma.charterQuote.count({ where: { createdAt: { gte: month } } }),
    prisma.inquiry.count({ where: { createdAt: { gte: month } } }),
    prisma.aiConversation.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.charterQuote.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  const quoteCount = quotes.length;
  const quoteSentCount = quotes.filter((quote) => quote.quoteStatus === "SENT").length;
  const quoteConfirmedCount = quotes.filter((quote) => quote.quoteStatus === "CONFIRMED").length;
  const aiQuoteRequests = aiConversations.filter((item) => item.intent === "charter").length;
  const aiPriceViews = aiConversations.filter((item) => item.estimatedPrice !== null).length;

  return NextResponse.json({
    success: true,
    metrics: {
      todayInquiryCount: todayQuotes + todayInquiries,
      monthInquiryCount: monthQuotes + monthInquiries,
      aiUsageCount: aiConversations.length,
      lineClickRate: null,
      inquiryConversionRate: aiConversations.length ? Number(((aiQuoteRequests / aiConversations.length) * 100).toFixed(1)) : 0,
      quoteSentRate: quoteCount ? Number(((quoteSentCount / quoteCount) * 100).toFixed(1)) : 0,
      dealRate: quoteCount ? Number(((quoteConfirmedCount / quoteCount) * 100).toFixed(1)) : 0,
      aiPriceViewCount: aiPriceViews,
    },
    topRoutes: topEntries([
      ...quotes.map((quote) => `${quote.pickup || "未填"} → ${quote.destination || "未填"}`),
      ...aiConversations.map((item) => item.route),
    ]),
    topKeywords: keywordEntries(aiConversations.map((item) => item.query)),
    topDates: topEntries(quotes.map((quote) => quote.tripDate)),
  });
}
