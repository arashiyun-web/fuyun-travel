import { prisma } from "@/lib/prisma";

export type AiIntent = "charter" | "price" | "order" | "recommend" | "general";

const charterKeywords = ["包車", "遊覽車", "來回", "單程", "接送", "機場", "行李", "人數", "幾人", "39人"];
const priceKeywords = ["多少錢", "費用", "價格", "團費", "元"];
const orderKeywords = ["後面", "下一站", "順序", "行程：", "→"];
const recommendKeywords = ["推薦", "想看", "櫻花", "溫泉"];

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function detectAiIntent(query: string, reply = ""): AiIntent {
  const text = `${query} ${reply}`;

  if (includesAny(text, charterKeywords)) return "charter";
  if (includesAny(text, priceKeywords)) return "price";
  if (includesAny(text, orderKeywords)) return "order";
  if (includesAny(text, recommendKeywords)) return "recommend";
  return "general";
}

export function extractPeopleCount(query: string) {
  const match = query.match(/(\d+)\s*(人|位)/);
  return match ? Number(match[1]) : null;
}

export function extractLuggageCount(query: string) {
  const match = query.match(/(\d+)\s*(件|個|箱)\s*行李|行李\s*(\d+)\s*(件|個|箱)/);
  if (!match) return null;
  return Number(match[1] || match[3]);
}

export function extractEstimatedPrice(reply: string) {
  const match = reply.match(/(\d[\d,]*)\s*元/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

export function extractRoute(query: string, reply: string) {
  const routeMatch = reply.match(/([^\n。]+→[^\n。]+)/);
  if (routeMatch) return routeMatch[1].trim();

  const fromToMatch = query.match(/(.+?)(到|去)(.+?)(來回|單程|多少錢|費用|$)/);
  if (!fromToMatch) return null;
  return `${fromToMatch[1].trim()} → ${fromToMatch[3].trim()}`;
}

export async function recordAiConversation(input: {
  sessionId?: string | null;
  source: string;
  userId?: string | null;
  query: string;
  reply: string;
  intent?: AiIntent;
  status?: string;
}) {
  const intent = input.intent || detectAiIntent(input.query, input.reply);

  return prisma.aiConversation.create({
    data: {
      sessionId: input.sessionId || null,
      source: input.source,
      userId: input.userId || null,
      query: input.query,
      intent,
      reply: input.reply,
      route: extractRoute(input.query, input.reply),
      peopleCount: extractPeopleCount(input.query),
      luggageCount: extractLuggageCount(input.query),
      estimatedPrice: extractEstimatedPrice(input.reply),
      status: input.status || "answered",
    },
  });
}
