import type { AuditEvent } from './audit';
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pushLineText } from "@/lib/lineApi";
import { UUID_PATTERN, uuidV5 } from "@/lib/lineRetryKey";

const USER_ID = /^U[0-9a-fA-F]{32}$/;
const LEASE_MS = 30_000;
const RETRY_DELAYS = [100, 300];
const DELIVERY_FAILURE = "通知未送達，請檢查通知設定後重送。";
const RECIPIENT_FAILURE = "通知未送達：未設定有效個人收件人。";

type NotificationBooking = {
  id: string;
  bookingNumber: string;
  date: string | Date;
  endDate: string | Date | null;
  time: string;
  pickup: string;
  destination: string;
  passengerCount: number;
  vehicle: string | null;
  contactName: string;
  phone: string;
};
type Delivery = {
  recipient: string;
  text: string;
  retryKey: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
};
type NotifyOptions = { sleep?: (milliseconds: number) => Promise<void> };

/** Configuration is a staff-only allowlist: individual IDs, no groups or rooms. */
export function lineAdminRecipients(primary?: string, fallback?: string): string[] {
  const configured = primary?.trim() || fallback || "";
  const recipients = new Set<string>();
  for (const entry of configured.split(",")) {
    const id = entry.trim();
    if (USER_ID.test(id)) recipients.add(`U${id.slice(1).toLowerCase()}`);
    if (recipients.size === 2) break;
  }
  return Array.from(recipients);
}

function singleLine(value: string, limit = 100) {
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, limit);
}
function tripDate(value: string | Date) {
  return value instanceof Date
    ? value.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })
    : singleLine(value, 20);
}

function adminBookingLink(id: string): string {
  const configured = process.env.AI_BOOKING_ADMIN_BASE_URL ?? '';
  let base = 'https://fuyuntravel.com';
  if (configured.startsWith('https://') && !/\s/.test(configured)) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) base = url.origin;
    } catch { /* Invalid configuration uses the fixed public HTTPS origin. */ }
  }
  return base + '/admin/ai-bookings/' + encodeURIComponent(id);
}
async function notificationAudit(event: Omit<AuditEvent, 'eventType'>) {
  try { await prisma.aiApiAuditLog.create({ data: { id: randomUUID(), eventType: 'notification', ...event } }); }
  catch { /* Delivery/audit errors never leak credentials or fail a saved booking. */ }
}

export function bookingNotificationText(booking: NotificationBooking): string {
  const period = booking.endDate ? `${tripDate(booking.date)} ～ ${tripDate(booking.endDate)}` : tripDate(booking.date);
  return [
    `AI 待確認訂單：${singleLine(booking.bookingNumber, 50)}`,
    `日期：${period} ${singleLine(booking.time, 10)}`,
    `路線：${singleLine(booking.pickup)} → ${singleLine(booking.destination)}`,
    `人數：${booking.passengerCount}`,
    `車型：${singleLine(booking.vehicle || "未指定", 60)}`,
    `聯絡人：${singleLine(booking.contactName, 60)}`,
    `電話末三碼：${booking.phone.replace(/\D/g, "").slice(-3)}`,
    adminBookingLink(booking.id),
  ].join("\n");
}

export function bookingNotificationRetryKey(namespace: string, recipient: string): string {
  return uuidV5(`fuyun-ai-booking-notify\n${recipient}`, namespace);
}

/** null permits initialization; malformed stored data fails closed without sending. */
function readDeliveries(value: unknown): Delivery[] | null {
  if (value == null || (Array.isArray(value) && value.length === 0)) return null;
  if (!Array.isArray(value) || value.length > 2) return [];
  const deliveries: Delivery[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const saved = item as Record<string, unknown>;
    if (typeof saved.recipient !== "string" || !USER_ID.test(saved.recipient) ||
        typeof saved.text !== "string" || !saved.text || saved.text.length > 4500 ||
        typeof saved.retryKey !== "string" || !UUID_PATTERN.test(saved.retryKey) ||
        (saved.status !== "pending" && saved.status !== "sent" && saved.status !== "failed") ||
        typeof saved.attempts !== "number" || !Number.isSafeInteger(saved.attempts) || saved.attempts < 0) return [];
    const normalized = saved.recipient.toLowerCase();
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    deliveries.push({ recipient: saved.recipient, text: saved.text, retryKey: saved.retryKey,
      status: saved.status, attempts: saved.attempts });
  }
  return deliveries;
}

/** Acquire one shared lease for initial delivery and every manual retry. */
export async function notifyBooking(id: string, options: NotifyOptions = {}) {
  const owner = randomUUID();
  const now = new Date();
  const acquired = await prisma.aiBooking.updateMany({
    where: { id, OR: [{ notificationClaim: null }, { notificationClaimExpiresAt: { lte: now } }] },
    data: { notificationClaim: owner, notificationClaimExpiresAt: new Date(now.getTime() + LEASE_MS) },
  });
  if (acquired.count === 0) {
    return prisma.aiBooking.findUnique({ where: { id }, select: { notificationStatus: true, notificationAttempts: true } })
      .then(current => current ? { notificationStatus: current.notificationStatus, notificationAttempts: current.notificationAttempts } : null);
  }
  try {
    return await deliver(id, owner, options);
  } catch (error) {
    await notificationAudit({ channel: 'system', bookingId: id, outcome: 'failed', detail: { recipient_count: 0, reason: 'notification delivery failed' } });
    throw error;
  } finally {
    // An expired worker may release only its own lease, never a replacement worker's.
    await prisma.aiBooking.updateMany({ where: { id, notificationClaim: owner },
      data: { notificationClaim: null, notificationClaimExpiresAt: null } }).catch(() => {});
  }
}

async function deliver(id: string, owner: string, options: NotifyOptions) {
  const booking = await prisma.aiBooking.findUnique({ where: { id } });
  if (!booking) return null;
  const saved = readDeliveries(booking.notificationDeliveries);
  const text = bookingNotificationText(booking);
  const configured = lineAdminRecipients(process.env.LINE_ADMIN_USER_ID, process.env.ADMIN_LINE_USER_ID);
  const missingRecipient = configured.length === 0;
  const deliveries: Delivery[] = saved ?? configured
    .map(recipient => ({ recipient, text, retryKey: bookingNotificationRetryKey(booking.notificationRetryKey, recipient),
      status: "pending", attempts: 0 }));
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds)));

  async function persist() {
    const notificationStatus = missingRecipient || deliveries.length === 0 ? "failed"
      : deliveries.some(item => item.status === "pending") ? "pending"
      : deliveries.every(item => item.status === "sent") ? "sent" : "failed";
    const notificationAttempts = deliveries.reduce((total, item) => total + item.attempts, 0);
    const notificationLastError = notificationStatus === "failed"
      ? missingRecipient || deliveries.length === 0 ? RECIPIENT_FAILURE : DELIVERY_FAILURE : null;
    const written = await prisma.aiBooking.updateMany({ where: { id, notificationClaim: owner }, data: {
      notificationStatus, notificationAttempts, notificationLastError,
      notificationDeliveries: deliveries as unknown as Prisma.InputJsonValue,
      notificationClaimExpiresAt: new Date(Date.now() + LEASE_MS),
    } });
    if (written.count === 0) throw new Error("Notification lease no longer owned");
    return { notificationStatus, notificationAttempts };
  }

  // Save recipients and the exact LINE payload before crossing the network boundary.
  await persist();
  if (missingRecipient) {
    await notificationAudit({ channel: 'system', bookingId: id, outcome: 'skipped',
      detail: { recipient_count: 0, reason: 'notification skipped: missing recipient' } });
    return persist();
  }
  for (const item of deliveries) {
    if (item.status === "sent") continue;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0) await sleep(RETRY_DELAYS[attempt - 1]);
      item.attempts += 1;
      item.status = "pending";
      await persist();
      try {
        await pushLineText(item.recipient, item.text, { retryKey: item.retryKey, timeoutMs: 1500 });
        item.status = "sent";
      } catch {
        // Upstream errors can contain credentials or private payloads; keep only fixed messages.
        item.status = "failed";
      }
      await persist();
      if (item.status === "sent") break;
    }
  }
  const result = await persist();
  await notificationAudit({ channel: 'system', bookingId: id, outcome: result.notificationStatus,
    detail: { recipient_count: deliveries.length } });
  return result;
}

/** Post-commit staff-only status notice; never contacts customers or external agents. */
export async function notifyStaffStatus(booking: { id: string; bookingNumber: string; status: string }, actor: string) {
  const labels: Record<string, string> = { confirmed: '專人已確認', rejected: '已婉拒', cancelled: '已取消' };
  if (!Object.hasOwn(labels, booking.status)) return;
  const common = { channel: 'admin' as const, bookingId: booking.id, actor };
  if (process.env.AI_BOOKING_STATUS_NOTIFY !== '1') {
    await notificationAudit({ ...common, outcome: 'disabled', detail: { recipient_count: 0 } });
    return;
  }
  const recipients = lineAdminRecipients(process.env.LINE_ADMIN_USER_ID, process.env.ADMIN_LINE_USER_ID);
  if (recipients.length === 0) {
    await notificationAudit({ ...common, outcome: 'skipped', detail: { recipient_count: 0, reason: 'notification skipped: missing recipient' } });
    return;
  }
  const text = 'AI 訂單 ' + singleLine(booking.bookingNumber, 50) + ' 狀態已更新為：' + labels[booking.status] + '（' + singleLine(actor, 100) + '）\n' + adminBookingLink(booking.id);
  const results = await Promise.allSettled(recipients.map(recipient => pushLineText(recipient, text, { retryKey: randomUUID(), timeoutMs: 1500 })));
  await notificationAudit({ ...common, outcome: results.every(result => result.status === 'fulfilled') ? 'sent' : 'failed',
    detail: { recipient_count: recipients.length } });
}
