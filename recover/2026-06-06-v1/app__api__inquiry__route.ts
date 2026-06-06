import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

type InquiryStatus = "New" | "Quoted" | "Confirmed" | "Cancelled";

type InquiryRecord = {
  id: string;
  name: string;
  phone: string;
  line_id: string;
  trip_type: string;
  start_date: string;
  pickup_location: string;
  destination: string;
  passenger_count: number;
  preferred_vehicle: string[];
  special_requests: string;
  status: InquiryStatus;
  created_at: string;
  updated_at?: string;
};

type AuditRecord = {
  id: string;
  user_id: string;
  action: string;
  inquiry_id: string;
  ip: string;
  created_at: string;
};

type Store = {
  inquiries: InquiryRecord[];
  audit: AuditRecord[];
  rate: Map<string, { count: number; resetAt: number }>;
};

const STATUSES: InquiryStatus[] = ["New", "Quoted", "Confirmed", "Cancelled"];
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;

const globalStore = globalThis as typeof globalThis & {
  __fuyunInquiryStore?: Store;
};

const store: Store =
  globalStore.__fuyunInquiryStore ||
  (globalStore.__fuyunInquiryStore = {
    inquiries: [
      {
        id: "iq-seed-1",
        name: "王小旅",
        phone: "0912345678",
        line_id: "fuyun-test",
        trip_type: "Multi-day Tour",
        start_date: "2026-06-12T09:00",
        pickup_location: "台北車站",
        destination: "宜蘭太平山二日遊",
        passenger_count: 38,
        preferred_vehicle: ["43-seat Big Bus"],
        special_requests: "需要協助安排午餐餐廳，並確認大型行李放置空間。",
        status: "New",
        created_at: "2026-05-25T10:00:00.000Z",
      },
    ],
    audit: [],
    rate: new Map(),
  });

function clean(value: unknown, limit = 600) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => clean(item, 80)).filter(Boolean) : [];
}

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(request: Request) {
  const key = clientIp(request);
  const now = Date.now();
  const current = store.rate.get(key);

  if (!current || current.resetAt < now) {
    store.rate.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  current.count += 1;
  return current.count <= RATE_LIMIT;
}

function addAudit(request: Request, action: string, inquiryId: string) {
  store.audit.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    user_id: clean(request.headers.get("x-fuyun-user") || "platform-admin", 120),
    action,
    inquiry_id: inquiryId,
    ip: clientIp(request),
    created_at: new Date().toISOString(),
  });
  store.audit = store.audit.slice(0, 250);
}

function maskPhone(phone: string) {
  const value = clean(phone);
  if (value.length <= 4) return "****";
  return `${value.slice(0, 3)}****${value.slice(-3)}`;
}

function publicInquiry(item: InquiryRecord, reveal = false) {
  return {
    ...item,
    phone_masked: maskPhone(item.phone),
    phone: reveal ? item.phone : maskPhone(item.phone),
  };
}

async function sendNotificationEmail(inquiry: InquiryRecord) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.INQUIRY_TO_EMAIL || user;
  const from = process.env.INQUIRY_FROM_EMAIL || user;

  if (!host || !user || !pass || !to || !from) return;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const text = [
    `${SITE.name}新詢價`,
    "",
    `姓名：${inquiry.name}`,
    `電話：${inquiry.phone}`,
    `LINE：${inquiry.line_id || "未填"}`,
    `行程類型：${inquiry.trip_type}`,
    `出發時間：${inquiry.start_date}`,
    `人數：${inquiry.passenger_count}`,
    `車型：${inquiry.preferred_vehicle.join("、") || "未選"}`,
    `路線：${inquiry.pickup_location} → ${inquiry.destination}`,
    "",
    "特殊需求：",
    inquiry.special_requests || "未填",
  ].join("\n");

  await transporter.sendMail({
    from,
    to,
    subject: `${SITE.name}新詢價：${inquiry.name}`,
    text,
    replyTo: from,
  });
}

export async function GET(request: Request) {
  addAudit(request, "READ_INQUIRIES", "");
  return NextResponse.json({
    success: true,
    inquiries: store.inquiries.map((item) => publicInquiry(item, true)),
    audit: store.audit,
    source: process.env.MONGODB_URI ? "mongodb-ready" : "server-store",
  });
}

export async function POST(request: Request) {
  if (!checkRateLimit(request)) {
    return NextResponse.json({ success: false, message: "請稍後再送出詢價。" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const inquiry: InquiryRecord = {
      id: clean(body.id, 80) || `iq-${Date.now()}`,
      name: clean(body.name, 120),
      phone: clean(body.phone, 80),
      line_id: clean(body.line_id, 120),
      trip_type: clean(body.trip_type, 80),
      start_date: clean(body.start_date || body.date, 80),
      pickup_location: clean(body.pickup_location, 160),
      destination: clean(body.destination, 240),
      passenger_count: Number(body.passenger_count || body.passengers || 0),
      preferred_vehicle: cleanArray(body.preferred_vehicle),
      special_requests: clean(body.special_requests || body.note, 1200),
      status: "New",
      created_at: new Date().toISOString(),
    };

    if (!inquiry.name || !inquiry.phone || !inquiry.start_date) {
      return NextResponse.json(
        { success: false, message: "請填寫姓名、電話與出發日期。" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(inquiry.passenger_count) || inquiry.passenger_count < 1) {
      return NextResponse.json({ success: false, message: "請填寫正確旅客人數。" }, { status: 400 });
    }

    store.inquiries.unshift(inquiry);
    store.inquiries = store.inquiries.slice(0, 500);
    addAudit(request, "CREATE_INQUIRY", inquiry.id);

    try {
      await sendNotificationEmail(inquiry);
    } catch {
      addAudit(request, "EMAIL_FAILED", inquiry.id);
    }

    return NextResponse.json({
      success: true,
      message: "Inquiry received",
      inquiry: publicInquiry(inquiry, true),
    });
  } catch {
    return NextResponse.json({ success: false, message: "資料送出失敗。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = clean(body.id, 80);
    const index = store.inquiries.findIndex((item) => item.id === id);

    if (index < 0) {
      return NextResponse.json({ success: false, message: "找不到詢價資料。" }, { status: 404 });
    }

    const current = store.inquiries[index];
    const status = clean(body.status, 40) as InquiryStatus;
    const next: InquiryRecord = {
      ...current,
      name: clean(body.name, 120) || current.name,
      phone: clean(body.phone, 80) || current.phone,
      line_id: clean(body.line_id, 120),
      trip_type: clean(body.trip_type, 80) || current.trip_type,
      start_date: clean(body.start_date, 80) || current.start_date,
      pickup_location: clean(body.pickup_location, 160) || current.pickup_location,
      destination: clean(body.destination, 240) || current.destination,
      passenger_count: Number(body.passenger_count || current.passenger_count),
      preferred_vehicle: cleanArray(body.preferred_vehicle),
      special_requests: clean(body.special_requests, 1200),
      status: STATUSES.includes(status) ? status : current.status,
      updated_at: new Date().toISOString(),
    };

    store.inquiries[index] = next;
    addAudit(request, "UPDATE_INQUIRY", id);

    return NextResponse.json({
      success: true,
      inquiry: publicInquiry(next, true),
      audit: store.audit,
    });
  } catch {
    return NextResponse.json({ success: false, message: "更新失敗。" }, { status: 500 });
  }
}
