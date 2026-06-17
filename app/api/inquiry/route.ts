import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
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
  source_page?: string;
  referer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  keyword?: string;
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

function toPublicRecord(item: {
  id: string;
  customerName: string;
  phone: string;
  lineId: string | null;
  tripType: string;
  startDate: Date | null;
  pickupLocation: string | null;
  destination: string | null;
  passengerCount: number;
  preferredVehicle: string[];
  specialRequests: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sourcePage: string | null;
  referer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  keyword: string | null;
}): InquiryRecord {
  return {
    id: item.id,
    name: item.customerName,
    phone: item.phone,
    line_id: item.lineId || "",
    trip_type: item.tripType,
    start_date: item.startDate ? item.startDate.toISOString().slice(0, 10) : "",
    pickup_location: item.pickupLocation || "",
    destination: item.destination || "",
    passenger_count: item.passengerCount,
    preferred_vehicle: item.preferredVehicle,
    special_requests: item.specialRequests || "",
    status: item.status as InquiryStatus,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
    source_page: item.sourcePage || "",
    referer: item.referer || "",
    utm_source: item.utmSource || "",
    utm_medium: item.utmMedium || "",
    utm_campaign: item.utmCampaign || "",
    utm_term: item.utmTerm || "",
    utm_content: item.utmContent || "",
    keyword: item.keyword || "",
  };
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
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
    `${SITE.name} 新詢價`,
    "",
    `姓名：${inquiry.name}`,
    `電話：${inquiry.phone}`,
    `LINE：${inquiry.line_id || "未填"}`,
    `服務：${inquiry.trip_type}`,
    `日期：${inquiry.start_date}`,
    `人數：${inquiry.passenger_count}`,
    `車型：${inquiry.preferred_vehicle.join("、") || "未指定"}`,
    `路線：${inquiry.pickup_location} → ${inquiry.destination}`,
    `來源頁：${inquiry.source_page || "未記錄"}`,
    `UTM：${inquiry.utm_source || ""} ${inquiry.utm_medium || ""} ${inquiry.utm_campaign || ""}`.trim(),
    `關鍵字：${inquiry.keyword || "未記錄"}`,
    "",
    "備註：",
    inquiry.special_requests || "未填",
  ].join("\n");

  await transporter.sendMail({
    from,
    to,
    subject: `${SITE.name} 新詢價：${inquiry.name}`,
    text,
    replyTo: from,
  });
}

export async function GET(request: Request) {
  addAudit(request, "READ_INQUIRIES", "");
  const inquiries = await prisma.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 500 });

  return NextResponse.json({
    success: true,
    inquiries: inquiries.map((item) => publicInquiry(toPublicRecord(item), true)),
    audit: store.audit,
    source: "postgresql",
  });
}

export async function POST(request: Request) {
  if (!checkRateLimit(request)) {
    return NextResponse.json({ success: false, message: "送出太頻繁，請稍後再試。" }, { status: 429 });
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
      source_page: clean(body.source_page, 240),
      referer: clean(body.referer, 400),
      utm_source: clean(body.utm_source, 120),
      utm_medium: clean(body.utm_medium, 120),
      utm_campaign: clean(body.utm_campaign, 160),
      utm_term: clean(body.utm_term, 160),
      utm_content: clean(body.utm_content, 160),
      keyword: clean(body.keyword, 160),
    };

    if (!inquiry.name || !inquiry.phone || !inquiry.start_date) {
      return NextResponse.json(
        { success: false, message: "請填寫姓名、電話與出發日期。" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(inquiry.passenger_count) || inquiry.passenger_count < 1) {
      return NextResponse.json({ success: false, message: "請填寫正確人數。" }, { status: 400 });
    }

    const created = await prisma.inquiry.create({
      data: {
        id: inquiry.id,
        customerName: inquiry.name,
        phone: inquiry.phone,
        lineId: inquiry.line_id || null,
        tripType: inquiry.trip_type,
        startDate: parseDate(inquiry.start_date),
        pickupLocation: inquiry.pickup_location || null,
        destination: inquiry.destination || null,
        passengerCount: inquiry.passenger_count,
        preferredVehicle: inquiry.preferred_vehicle,
        specialRequests: inquiry.special_requests || null,
        source: inquiry.utm_source || inquiry.source_page || null,
        sourcePage: inquiry.source_page || null,
        referer: inquiry.referer || null,
        utmSource: inquiry.utm_source || null,
        utmMedium: inquiry.utm_medium || null,
        utmCampaign: inquiry.utm_campaign || null,
        utmTerm: inquiry.utm_term || null,
        utmContent: inquiry.utm_content || null,
        keyword: inquiry.keyword || null,
        status: "New",
      },
    });

    addAudit(request, "CREATE_INQUIRY", created.id);

    try {
      await sendNotificationEmail(toPublicRecord(created));
    } catch {
      addAudit(request, "EMAIL_FAILED", created.id);
    }

    return NextResponse.json({
      success: true,
      message: "Inquiry received",
      inquiry: publicInquiry(toPublicRecord(created), true),
    });
  } catch {
    return NextResponse.json({ success: false, message: "資料解析失敗。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = clean(body.id, 80);
    const status = clean(body.status, 40) as InquiryStatus;

    const current = await prisma.inquiry.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ success: false, message: "找不到詢價資料。" }, { status: 404 });
    }

    const updated = await prisma.inquiry.update({
      where: { id },
      data: {
        customerName: clean(body.name, 120) || current.customerName,
        phone: clean(body.phone, 80) || current.phone,
        lineId: clean(body.line_id, 120) || current.lineId,
        tripType: clean(body.trip_type, 80) || current.tripType,
        startDate: parseDate(clean(body.start_date, 80)) || current.startDate,
        pickupLocation: clean(body.pickup_location, 160) || current.pickupLocation,
        destination: clean(body.destination, 240) || current.destination,
        passengerCount: Number(body.passenger_count || current.passengerCount),
        preferredVehicle: cleanArray(body.preferred_vehicle).length ? cleanArray(body.preferred_vehicle) : current.preferredVehicle,
        specialRequests: clean(body.special_requests, 1200) || current.specialRequests,
        status: STATUSES.includes(status) ? status : (current.status as InquiryStatus),
      },
    });

    addAudit(request, "UPDATE_INQUIRY", id);

    return NextResponse.json({
      success: true,
      inquiry: publicInquiry(toPublicRecord(updated), true),
    });
  } catch {
    return NextResponse.json({ success: false, message: "更新失敗。" }, { status: 500 });
  }
}
