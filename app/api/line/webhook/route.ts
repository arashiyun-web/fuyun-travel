import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type LineEvent = {
  type?: string;
  replyToken?: string;
  message?: {
    type?: string;
    text?: string;
  };
};

const LINE_REPLY_API = "https://api.line.me/v2/bot/message/reply";

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildReply(text: string) {
  const message = normalizeText(text);

  if (!message || message === "選單" || message === "menu" || message === "功能") {
    return [
      "浮雲輕鬆遊 AI 客服選單：",
      "1. 包車詢價",
      "2. 國內旅遊",
      "3. 校外教學",
      "4. 機場接送",
      "",
      "請直接輸入項目名稱或數字。",
    ].join("\n");
  }

  if (message.includes("1") || message.includes("包車") || message.includes("詢價") || message.includes("報價")) {
    return "包車詢價需要確認出發日期、上下車地點、人數、行李數、用車時間與車型需求。請直接留下這些資訊，真人客服會協助確認正式報價。";
  }

  if (message.includes("2") || message.includes("國內") || message.includes("旅遊") || message.includes("行程")) {
    return "國內旅遊可協助規劃一日遊、多日遊與客製化行程。請提供出發日期、出發地、目的地、人數與預計天數。";
  }

  if (message.includes("3") || message.includes("校外") || message.includes("教學") || message.includes("學校")) {
    return "校外教學可協助安排遊覽車、路線與團體交通需求。請提供學校名稱、日期、人數、上下車地點與目的地。";
  }

  if (message.includes("4") || message.includes("機場") || message.includes("接送") || message.includes("桃園機場") || message.includes("松山機場")) {
    return "機場接送請提供接送日期時間、機場航廈、上車或下車地址、人數、行李數與航班資訊，我們會協助確認車型與報價。";
  }

  return [
    "您好，這裡是浮雲輕鬆遊 AI 客服。",
    "目前可協助：包車詢價、國內旅遊、校外教學、機場接送。",
    "請輸入「選單」查看完整選項。",
  ].join("\n");
}

async function replyToLine(replyToken: string, text: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }

  const response = await fetch(LINE_REPLY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "text",
          text: text.slice(0, 4500),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`LINE Reply API failed: ${response.status} ${errorText}`);
  }
}

async function handleEvent(event: LineEvent) {
  if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) {
    return;
  }

  const reply = buildReply(event.message.text || "");
  await replyToLine(event.replyToken, reply);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "line-webhook",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? (body.events as LineEvent[]) : [];

    await Promise.all(events.map((event) => handleEvent(event)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json({ ok: false, error: "LINE webhook failed" }, { status: 500 });
  }
}
