import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HANDLER_VERSION = "line-intent-router-v3-20260615";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const ENTRY_KEYWORDS = new Set(["包車", "租車", "遊覽車", "訂車", "詢價", "立即報價", "?", "？"]);
const OFFICIAL_QUOTE_KEYWORDS = ["我要正式報價", "正式報價", "報價", "給我正式報價", "客服報價"];
const ACKNOWLEDGEMENT_KEYWORDS = new Set(["好", "收到", "謝謝"]);
const PLACES = [
  "桃園機場",
  "松山機場",
  "雲林縣",
  "嘉義縣",
  "嘉義市",
  "樹林",
  "鹿港",
  "台北",
  "臺北",
  "新北",
  "板橋",
  "桃園",
  "苗栗",
  "台中",
  "臺中",
  "彰化",
  "雲林",
  "嘉義",
  "台南",
  "臺南",
  "高雄",
  "屏東",
  "宜蘭",
  "花蓮",
];

type QuoteFields = {
  date?: string;
  people?: number | null;
  origin?: string;
  destination?: string;
  note?: string;
};

type QuoteSession = QuoteFields & {
  state: "COLLECTING" | "QUOTED" | "OFFICIAL_QUOTE_FLOW";
  updatedAt: number;
};

const sessions = new Map<string, QuoteSession>();

function verifySignature(body: string, signature: string, secret: string) {
  const digest = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function clean(value: unknown, limit = 500) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, limit);
}

function fieldValue(text: string, label: string) {
  const labels = "日期|人數|出發地|目的地|備註";
  const match = text.match(new RegExp(`${label}\\s*[:：]\\s*(.*?)(?=\\s*(?:${labels})\\s*[:：]|$)`, "s"));
  return match?.[1]?.trim() || "";
}

function parsePeople(text: string) {
  const labeled = text.match(/人數\s*[:：]\s*(\d{1,3})/);
  if (labeled) return Number(labeled[1]);
  const natural = text.match(/(\d{1,3})\s*(人|位)/);
  return natural ? Number(natural[1]) : null;
}

function parseDate(text: string) {
  const labeled = fieldValue(text, "日期");
  if (labeled) return labeled;
  return text.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}[日號]?/)?.[0] || "";
}

function uniquePlacesInOrder(text: string) {
  const places = PLACES
    .map((place) => ({ place, index: text.indexOf(place) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index || b.place.length - a.place.length);

  const result: string[] = [];
  for (const item of places) {
    if (!result.some((place) => place.includes(item.place) || item.place.includes(place))) {
      result.push(item.place);
    }
  }
  return result;
}

function parseRoute(text: string) {
  let origin = fieldValue(text, "出發地");
  let destination = fieldValue(text, "目的地");

  if (!origin || !destination) {
    const toMatch = text.match(/([^\s，,。]+?)\s*(到|至|→|->)\s*([^\s，,。]+)/);
    if (toMatch) {
      origin ||= toMatch[1].trim();
      destination ||= toMatch[3].trim();
    }
  }

  if (!origin || !destination) {
    const fromMatch = text.match(/([^\s，,。]+?)\s*出發\s*([^\s，,。]+)?/);
    if (fromMatch) origin ||= fromMatch[1].trim();
  }

  if (!origin || !destination) {
    const places = uniquePlacesInOrder(text);
    if (places.length >= 2) {
      origin ||= places[0];
      destination ||= places[1];
    } else if (origin && places.length >= 1 && places[0] !== origin) {
      destination ||= places[0];
    } else if (!origin && !destination && places.length === 1) {
      destination = places[0];
    }
  }

  return { origin, destination };
}

function parseQuote(text: string): QuoteFields {
  const route = parseRoute(text);
  const note = fieldValue(text, "備註") || (/(無行李|行李|行李箱|背包|兒童座椅|無)/.test(text) ? text.match(/無行李|行李多|需要兒童座椅|無/)?.[0] || "已提供" : "");

  return {
    date: parseDate(text),
    people: parsePeople(text),
    origin: route.origin,
    destination: route.destination,
    note,
  };
}

function missingReply(parsed: QuoteFields) {
  const lines: string[] = [];
  if (!parsed.date) lines.push("請補充日期。");
  if (!parsed.people) lines.push("請補充乘車人數。");
  if (!parsed.origin) lines.push("請補充出發地。");
  if (!parsed.destination) lines.push("請補充目的地。");
  return lines.join("\n");
}

function helperReply() {
  return [
    "您好，我是小幫手，有什麼我能為您服務。",
    "",
    "請直接輸入：",
    "日期：",
    "人數：",
    "出發地：",
    "目的地：",
  ].join("\n");
}

function isNorthernOrigin(origin: string) {
  return ["樹林", "板橋", "新北", "台北", "臺北", "雙北"].some((keyword) => origin.includes(keyword));
}

function isCentralSouth(destination: string) {
  return ["苗栗", "台中", "臺中", "彰化", "鹿港", "雲林", "雲林縣", "嘉義", "台南", "臺南", "高雄", "屏東"].some((keyword) =>
    destination.includes(keyword),
  );
}

function quotePrice(parsed: QuoteFields) {
  if ((parsed.people || 0) >= 20 && isNorthernOrigin(parsed.origin || "") && isCentralSouth(parsed.destination || "")) {
    return "NT$16,000～22,000 起";
  }
  if ((parsed.people || 0) >= 20) return "NT$11,000～12,500 起";
  return "NT$12,000～18,000 起";
}

function quoteReply(parsed: QuoteFields) {
  return [
    "您好，我是小幫手。",
    "",
    "以下為初步行情：",
    "",
    "初步行情：",
    quotePrice(parsed),
    "",
    "實際價格仍需依日期、",
    "停靠點、",
    "行李量、",
    "車輛調度確認。",
    "",
    "如需正式報價，",
    "真人客服將協助確認。",
    "",
    "如需正式報價請回覆：",
    "",
    "【我要正式報價】",
  ].join("\n");
}

type Intent = "charter" | "airport" | "travel" | "school" | "customer_service" | "general";

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function classifyIntent(text: string): Intent {
  if (hasAny(text, ["機場接送", "桃園機場", "松山機場", "高鐵接送", "接機", "送機"])) return "airport";
  if (hasAny(text, ["國旅", "國內旅遊", "一日遊", "二日遊", "三日遊", "旅遊"])) return "travel";
  if (hasAny(text, ["校外教學", "畢業旅行", "戶外教學", "學校包車"])) return "school";
  if (hasAny(text, ["客服", "真人客服", "聯絡客服", "找人"])) return "customer_service";
  if (hasAny(text, ["包車", "租車", "遊覽車", "報價", "訂車"])) return "charter";
  return "general";
}

function isOfficialQuoteRequest(text: string) {
  return OFFICIAL_QUOTE_KEYWORDS.includes(text.trim());
}

function quotedAckReply() {
  return ["感謝您的詢問。", "", "如需正式報價：", "", "請回覆：", "", "【我要正式報價】"].join("\n");
}

function officialQuoteMissingReply() {
  return ["請先提供完整包車資訊：", "", "日期：", "人數：", "出發地：", "目的地：", "", "完成初步行情後，即可建立正式報價。"].join("\n");
}

function officialQuoteCreatedReply() {
  return ["已收到您的正式報價需求。", "", "真人客服將依日期、路線、人數與車輛調度確認正式報價，並儘速與您聯繫。"].join("\n");
}

function intentReply(intent: Intent) {
  if (intent === "customer_service") {
    return ["您好，真人客服將協助您。", "", "公司電話：", "02-2685-1666", "", "LINE客服將儘速與您聯繫。"].join("\n");
  }
  if (intent === "airport") {
    return ["您好，請提供：", "", "日期：", "航班：", "人數：", "上車地點：", "機場：", "", "收到後立即估價。"].join("\n");
  }
  if (intent === "travel") {
    return ["您好，請提供：", "", "日期：", "人數：", "想去地區：", "", "例如：", "", "宜蘭", "花蓮", "台中", "阿里山", "日月潭"].join("\n");
  }
  if (intent === "school") {
    return ["您好，請提供：", "", "學校名稱：", "日期：", "學生人數：", "老師人數：", "目的地："].join("\n");
  }
  return "";
}

function draftFromJson(value: unknown): QuoteFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const draft = value as Record<string, unknown>;
  return {
    date: typeof draft.date === "string" ? draft.date : undefined,
    people: typeof draft.people === "number" ? draft.people : null,
    origin: typeof draft.origin === "string" ? draft.origin : undefined,
    destination: typeof draft.destination === "string" ? draft.destination : undefined,
    note: typeof draft.note === "string" ? draft.note : undefined,
  };
}

function mergeFields(current: QuoteFields, parsed: QuoteFields): QuoteFields {
  const merged: QuoteFields = { ...current };
  if (parsed.date) merged.date = parsed.date;
  if (parsed.people) merged.people = parsed.people;
  if (parsed.origin) merged.origin = parsed.origin;
  if (parsed.destination) merged.destination = parsed.destination;
  if (parsed.note) merged.note = parsed.note;
  merged.note ||= "無";
  return merged;
}

async function mergeSession(userId: string, parsed: QuoteFields) {
  try {
    const current = await prisma.lineSession.findUnique({ where: { userId } });
    const merged = mergeFields(draftFromJson(current?.draftJson), parsed);
    await prisma.lineSession.upsert({
      where: { userId },
      update: { state: "COLLECTING", draftJson: merged },
      create: { userId, state: "COLLECTING", draftJson: merged },
    });
    sessions.set(userId, { ...merged, state: "COLLECTING", updatedAt: Date.now() });
    return merged;
  } catch (error) {
    console.error("line-webhook session merge db failed", { handlerVersion: HANDLER_VERSION, userId, error });
    const current = sessions.get(userId);
    const merged = mergeFields(current || {}, parsed);
    sessions.set(userId, { ...merged, state: "COLLECTING", updatedAt: Date.now() });
    return merged;
  }
}

async function clearSession(userId: string) {
  sessions.delete(userId);
  if (!userId) return;
  try {
    await prisma.lineSession.delete({ where: { userId } }).catch(() => null);
  } catch (error) {
    console.error("line-webhook session clear db failed", { handlerVersion: HANDLER_VERSION, userId, error });
  }
}

async function startCharterSession(userId: string) {
  if (!userId) return;
  sessions.set(userId, { state: "COLLECTING", updatedAt: Date.now(), note: "無" });
  try {
    await prisma.lineSession.upsert({
      where: { userId },
      update: { state: "COLLECTING", draftJson: { note: "無" } },
      create: { userId, state: "COLLECTING", draftJson: { note: "無" } },
    });
  } catch (error) {
    console.error("line-webhook session start db failed", { handlerVersion: HANDLER_VERSION, userId, error });
  }
}

async function completeSession(userId: string, merged: QuoteFields) {
  sessions.set(userId, { ...merged, state: "QUOTED", updatedAt: Date.now() });
  if (!userId) return;
  try {
    await prisma.lineSession.upsert({
      where: { userId },
      update: { state: "QUOTED", draftJson: merged },
      create: { userId, state: "QUOTED", draftJson: merged },
    });
  } catch (error) {
    console.error("line-webhook session complete db failed", { handlerVersion: HANDLER_VERSION, userId, error });
  }
}

async function getSession(userId: string) {
  if (!userId) return null;
  try {
    const session = await prisma.lineSession.findUnique({ where: { userId } });
    if (session) return { state: session.state, draft: draftFromJson(session.draftJson) };
  } catch (error) {
    console.error("line-webhook session read db failed", { handlerVersion: HANDLER_VERSION, userId, error });
  }
  const cached = sessions.get(userId);
  return cached ? { state: cached.state, draft: draftFromJson(cached) } : null;
}

async function notifyAdminQuote(quote: { id: string }, fields: QuoteFields, userId: string) {
  const adminUserId = process.env.LINE_ADMIN_USER_ID || process.env.ADMIN_LINE_USER_ID || "";
  if (!adminUserId) {
    console.warn("line-webhook admin notify skipped: missing LINE_ADMIN_USER_ID", { handlerVersion: HANDLER_VERSION, quoteId: quote.id });
    return;
  }

  const text = [
    "【新詢價通知】",
    "",
    `日期：${fields.date || ""}`,
    `人數：${fields.people || ""}`,
    `出發地：${fields.origin || ""}`,
    `目的地：${fields.destination || ""}`,
    `備註：${fields.note || "無"}`,
    "",
    `LINE UID：${userId}`,
    `案件編號：${quote.id}`,
    `建立時間：${new Date().toISOString()}`,
  ].join("\n");

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: adminUserId, messages: [{ type: "text", text }] }),
  });

  console.info("line-webhook admin notify", { handlerVersion: HANDLER_VERSION, quoteId: quote.id, status: response.status, ok: response.ok });
}

async function createOfficialQuote(userId: string) {
  const session = await getSession(userId);
  const fields = mergeFields(session?.draft || {}, {});
  const missing = missingReply(fields);
  if (!userId || missing) return null;

  const quote = await prisma.charterQuote.create({
    data: {
      lineUserId: userId,
      lineName: null,
      tripDate: fields.date,
      passengerCount: fields.people || null,
      pickup: fields.origin,
      destination: fields.destination,
      remark: fields.note || "無",
      recommendedVehicle: "",
      quoteOptions: [],
      quoteDraftText: "",
      quoteStatus: "new",
    },
  });

  await prisma.lineSession.upsert({
    where: { userId },
    update: { state: "OFFICIAL_QUOTE_FLOW", draftJson: { ...fields, officialQuoteId: quote.id } },
    create: { userId, state: "OFFICIAL_QUOTE_FLOW", draftJson: { ...fields, officialQuoteId: quote.id } },
  });
  sessions.set(userId, { ...fields, state: "OFFICIAL_QUOTE_FLOW", updatedAt: Date.now() });
  await notifyAdminQuote({ id: quote.id }, fields, userId);
  return quote;
}

async function handleOfficialQuote(userId: string) {
  const quote = await createOfficialQuote(userId);
  return quote ? officialQuoteCreatedReply() : officialQuoteMissingReply();
}

async function buildReply(text: string, userId: string) {
  const message = clean(text);

  if (isOfficialQuoteRequest(message)) {
    return handleOfficialQuote(userId);
  }

  if (ENTRY_KEYWORDS.has(message)) {
    await startCharterSession(userId);
    return helperReply();
  }

  const session = await getSession(userId);
  const sessionState = session?.state || "";

  const intent = classifyIntent(message);
  if (sessionState === "QUOTED" && intent !== "charter" && message !== "價格") {
    return quotedAckReply();
  }

  if (intent !== "charter" && sessionState !== "COLLECTING") {
    const nonCharterReply = intentReply(intent);
    if (nonCharterReply) {
      await clearSession(userId);
      return nonCharterReply;
    }
    return "您好，請問需要包車、機場接送、國旅、校外教學，或真人客服協助？";
  }

  const parsed = parseQuote(message);
  const merged = userId ? await mergeSession(userId, parsed) : { ...parsed, note: parsed.note || "無" };
  const missing = missingReply(merged);
  if (missing) return missing;

  if (userId) await completeSession(userId, merged);
  return quoteReply(merged);
}

async function replyToLine(replyToken: string, replyText: string, accessToken: string) {
  const response = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: replyText.slice(0, 4500) }],
    }),
  });

  console.info("line-webhook reply api", {
    handlerVersion: HANDLER_VERSION,
    status: response.status,
    ok: response.ok,
  });

  return response;
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") || "";

  if (!channelSecret || !accessToken) {
    console.error("line-webhook missing env", { handlerVersion: HANDLER_VERSION });
    return NextResponse.json({ ok: false, error: "LINE env is not configured" }, { status: 500 });
  }

  if (!signature || !verifySignature(body, signature, channelSecret)) {
    console.warn("line-webhook invalid signature", { handlerVersion: HANDLER_VERSION });
    return NextResponse.json({ ok: false, error: "Invalid LINE signature" }, { status: 403 });
  }

  const payload = JSON.parse(body) as { events?: Array<Record<string, any>> };
  let replied = 0;

  for (const event of payload.events || []) {
    const message = event.message as { type?: string; text?: string } | undefined;
    if (event.type !== "message" || message?.type !== "text" || !message.text || !event.replyToken) continue;

    const userId = clean((event.source as { userId?: string } | undefined)?.userId, 160);
    const replyText = await buildReply(message.text, userId);

    console.info("line-webhook event", {
      handlerVersion: HANDLER_VERSION,
      userId,
      messageText: message.text,
      replyText,
    });

    const response = await replyToLine(String(event.replyToken), replyText, accessToken);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("line-webhook reply failed", {
        handlerVersion: HANDLER_VERSION,
        userId,
        status: response.status,
        errorText,
      });
    }
    replied += 1;
  }

  return NextResponse.json({ ok: true, replied, handlerVersion: HANDLER_VERSION });
}
