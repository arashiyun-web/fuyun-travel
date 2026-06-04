import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushLineText, replyLineText } from "@/lib/lineApi";
import {
  buildQuoteDraftText,
  buildQuoteOptions,
  cleanText,
  nextQuoteQuestion,
  publicQuoteSummary,
  recommendedVehicle,
  type QuoteDraft,
} from "@/lib/quoteWorkflow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: {
    userId?: string;
  };
  message?: {
    type?: string;
    text?: string;
  };
};

const MENU = [
  "浮雲輕鬆遊 AI 客服選單：",
  "1. 包車詢價（輸入：包車）",
  "2. 國內旅遊（輸入：國旅）",
  "3. 校外教學（輸入：校外教學）",
  "4. 機場接送（輸入：機場接送）",
  "5. 客服人員（輸入：客服）",
].join("\n");

function verifySignature(body: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) throw new Error("LINE_CHANNEL_SECRET is not configured");
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalize(value: unknown) {
  return cleanText(value, 120).toLowerCase();
}

async function startQuote(userId: string) {
  await prisma.lineSession.upsert({
    where: { userId },
    update: { state: "trip_date", draftJson: {} },
    create: { userId, state: "trip_date", draftJson: {} },
  });
  return "開始包車詢價。\n" + nextQuoteQuestion("trip_date");
}

async function continueQuote(userId: string, text: string) {
  const session = await prisma.lineSession.findUnique({ where: { userId } });
  if (!session) return null;

  const draft = ((session.draftJson || {}) as QuoteDraft) || {};
  const value = cleanText(text, 500);
  let nextState = "";

  if (session.state === "trip_date") {
    draft.tripDate = value;
    nextState = "passenger_count";
  } else if (session.state === "passenger_count") {
    const count = Number(value.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(count) || count < 1) return "請輸入正確人數，例如：8";
    draft.passengerCount = count;
    nextState = "pickup";
  } else if (session.state === "pickup") {
    draft.pickup = value;
    nextState = "destination";
  } else if (session.state === "destination") {
    draft.destination = value;
    nextState = "remark";
  } else if (session.state === "remark") {
    draft.remark = value || "無";

    const quoteDraftText = buildQuoteDraftText(draft);
    await prisma.charterQuote.create({
      data: {
        lineUserId: userId,
        lineName: null,
        tripDate: draft.tripDate,
        passengerCount: draft.passengerCount,
        pickup: draft.pickup,
        destination: draft.destination,
        remark: draft.remark,
        recommendedVehicle: recommendedVehicle(draft.passengerCount || 0),
        quoteOptions: JSON.parse(JSON.stringify(buildQuoteOptions(draft))),
        quoteDraftText,
        quoteStatus: "DRAFT",
      },
    });
    await prisma.lineSession.delete({ where: { userId } }).catch(() => null);
    return publicQuoteSummary(draft);
  } else {
    await prisma.lineSession.delete({ where: { userId } }).catch(() => null);
    return null;
  }

  await prisma.lineSession.update({ where: { userId }, data: { state: nextState, draftJson: JSON.parse(JSON.stringify(draft)) } });
  return nextQuoteQuestion(nextState);
}

async function latestQuoteSummary(userId: string) {
  const quote = await prisma.charterQuote.findFirst({
    where: { lineUserId: userId },
    orderBy: { createdAt: "desc" },
  });

  if (!quote) {
    return "目前沒有上一筆包車估價，請先輸入「包車」開始詢價。";
  }

  const options = Array.isArray(quote.quoteOptions) ? (quote.quoteOptions as { vehicle?: string; estimate?: string }[]) : [];
  if (options.length === 0) {
    return publicQuoteSummary({
      tripDate: quote.tripDate ?? undefined,
      passengerCount: quote.passengerCount ?? undefined,
      pickup: quote.pickup ?? undefined,
      destination: quote.destination ?? undefined,
      remark: quote.remark ?? undefined,
    });
  }

  return [
    "以下為上一筆包車初步估價：",
    "",
    ...options.map((item) => `${item.vehicle || "車型"}：${item.estimate || "待確認"}`),
    "",
    `建議車型：${quote.recommendedVehicle || recommendedVehicle(quote.passengerCount || 0)}`,
    "真人客服會再確認路線與車輛後提供正式報價。",
  ].join("\n");
}

async function handleText(userId: string, text: string) {
  const message = normalize(text);

  if (["選單", "menu", "功能"].includes(message)) return MENU;
  if (message === "價格" || message === "報價") return latestQuoteSummary(userId);
  if (message.includes("包車") || message === "1") return startQuote(userId);

  const inProgress = await continueQuote(userId, text);
  if (inProgress) return inProgress;

  if (message.includes("國旅") || message.includes("國內") || message === "2") {
    return "國內旅遊可協助規劃一日遊、多日遊與客製化行程。請提供出發日期、出發地、目的地、人數與預計天數，客服會協助安排。";
  }
  if (message.includes("校外") || message.includes("教學") || message === "3") {
    return "校外教學請提供學校名稱、日期、人數、上下車地點與目的地，我們會協助安排車輛與路線。";
  }
  if (message.includes("機場") || message.includes("接送") || message === "4") {
    return "機場接送請提供日期時間、機場航廈、上下車地址、人數、行李數與航班資訊。";
  }
  if (message.includes("客服") || message === "5") {
    return "已收到客服需求。請留下姓名、電話與問題，真人客服會盡快協助。";
  }
  return MENU;
}

async function handleEvent(event: LineEvent) {
  try {
    if (event.type !== "message" || event.message?.type !== "text" || !event.source?.userId) return;
    const userId = event.source.userId;
    const replyToken = event.replyToken || "";
    const reply = await handleText(userId, event.message.text || "");

    if (!replyToken) {
      await pushLineText(userId, reply).catch((error) => {
        console.error("LINE push fallback failed:", error);
      });
      return;
    }

    try {
      await replyLineText(replyToken, reply);
    } catch (error) {
      console.error("LINE reply failed, fallback to push:", error);
      await pushLineText(userId, reply).catch((pushError) => {
        console.error("LINE push fallback failed:", pushError);
      });
    }
  } catch (error) {
    console.error("LINE event handling failed:", error);
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    if (!verifySignature(bodyText, request.headers.get("x-line-signature"))) {
      return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 401 });
    }

    const body = JSON.parse(bodyText || "{}");
    const events = Array.isArray(body.events) ? (body.events as LineEvent[]) : [];
    await Promise.all(events.map((event) => handleEvent(event)));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json({ ok: false, error: "LINE webhook failed" }, { status: 500 });
  }
}
