import { NextResponse } from "next/server";
import { detectAiIntent, recordAiConversation } from "@/lib/ai-conversation";

export const dynamic = "force-dynamic";

const quoteKeywords = ["包車", "遊覽車", "來回", "單程", "接送", "機場", "行李", "人數", "幾人", "39人"];

function cleanMessage(value: unknown) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function cleanMeta(value: unknown, limit = 160) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function includesAny(message: string, keywords: string[]) {
  return keywords.some((keyword) => message.includes(keyword));
}

function getReply(message: string) {
  if (includesAny(message, quoteKeywords)) {
    return "此需求屬於包車報價，不能用行程團費估算。\n請提供日期、人數、出發地、目的地、單程或來回、行李數量。\n客服會協助確認正式報價。";
  }

  if (message.includes("恩愛農場")) {
    return "桃園復興行程：恩愛農場 → 北橫之星 → 巴陵橋。\n費用：車資+保險+便當+門票 799 元。";
  }

  if (message.includes("太平山")) {
    return "宜蘭行程：太平山國家森林風景區 → 見晴懷古步道 → 鳩之澤溫泉。\n費用：車資+保險 400 元。";
  }

  if (message.includes("鹿港")) {
    return "彰化行程：鹿港三輪車遊 →\n台灣優格餅乾學院 →\n彰化扇形車站 →\n忠權3D社區 →\n北極宮 →\n台塑生醫\n\n費用：599 元";
  }

  if (message.includes("鼻頭角") && message.includes("後面")) {
    return "鼻頭角步道後一站是象鼻岩。";
  }

  if (message.includes("櫻花")) {
    return "推薦賞櫻：\n三芝天元宮\n武陵農場\n恩愛農場";
  }

  if (message.includes("溫泉")) {
    return "推薦溫泉：\n鳩之澤溫泉\n關子嶺泥漿溫泉";
  }

  return "很抱歉，目前沒有找到相關行程。";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = cleanMessage(body.message);
  const reply = getReply(message);
  const intent = detectAiIntent(message, reply);

  try {
    await recordAiConversation({
      sessionId: cleanMeta(body.sessionId) || null,
      source: cleanMeta(body.source) || "ai-test",
      userId: cleanMeta(body.userId) || null,
      query: message,
      intent,
      reply,
    });
  } catch (error) {
    console.error("Failed to record AI conversation", error);
  }

  return NextResponse.json({
    reply,
    intent,
  });
}
