/**
 * Per-event claim and delivery tracking for the LINE webhook (table line_webhook_events).
 *
 *   processing  claimed by one request, reply being built (side effects: quote, admin push)
 *   sending     reply text cached, delivery in flight
 *   built       delivery failed; the cached text is resent on redelivery, the reply is never rebuilt
 *   replied     delivered; later redeliveries are skipped
 *
 * The claim is an INSERT … ON CONFLICT DO NOTHING (createMany + skipDuplicates), so of two concurrent
 * deliveries exactly one builds the reply. If the table is unavailable the event is handled as before
 * (fail-open) so a customer inquiry is never blocked by the dedupe store.
 */

export const STALE_CLAIM_MS = 2 * 60 * 1000;
/** Sent when a claim went stale mid-build: side effects may have happened, so the reply is not rebuilt. */
export const STALE_CLAIM_REPLY = "已收到您的訊息，客服會盡快回覆您，謝謝。";

type Row = { status: string; replyText: string | null; claimedAt: Date | null };
export type WebhookEventStore = {
  createMany(args: { data: { webhookEventId: string; status: string; claimedAt: Date }[]; skipDuplicates: true }): Promise<{ count: number }>;
  findUnique(args: { where: { webhookEventId: string } }): Promise<Row | null>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
};

export type Claim =
  | { kind: "build" }
  | { kind: "resend"; replyText: string }
  | { kind: "skip"; reason: "replied" | "in_progress" }
  | { kind: "untracked" };

export async function claimEvent(store: WebhookEventStore, webhookEventId: string, now = new Date()): Promise<Claim> {
  if (!webhookEventId) return { kind: "untracked" };
  const inserted = await store.createMany({ data: [{ webhookEventId, status: "processing", claimedAt: now }], skipDuplicates: true });
  if (inserted.count === 1) return { kind: "build" };

  const row = await store.findUnique({ where: { webhookEventId } });
  if (!row) return { kind: "skip", reason: "in_progress" };
  if (row.status === "replied") return { kind: "skip", reason: "replied" };

  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const take = (from: string, extra: Record<string, unknown> = {}) =>
    store.updateMany({ where: { webhookEventId, status: from, ...extra }, data: { status: "sending", claimedAt: now } });

  if (row.status === "built" && row.replyText) {
    return (await take("built")).count === 1 ? { kind: "resend", replyText: row.replyText } : { kind: "skip", reason: "in_progress" };
  }
  const stale = !row.claimedAt || row.claimedAt < staleBefore;
  if (row.status === "sending" && stale && row.replyText) {
    return (await take("sending", { OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] })).count === 1
      ? { kind: "resend", replyText: row.replyText }
      : { kind: "skip", reason: "in_progress" };
  }
  if (row.status === "processing" && stale) {
    const taken = await store.updateMany({
      where: { webhookEventId, status: "processing", OR: [{ claimedAt: null }, { claimedAt: { lt: staleBefore } }] },
      data: { status: "sending", claimedAt: now, replyText: STALE_CLAIM_REPLY },
    });
    return taken.count === 1 ? { kind: "resend", replyText: STALE_CLAIM_REPLY } : { kind: "skip", reason: "in_progress" };
  }
  return { kind: "skip", reason: "in_progress" };
}

/** Reply built: cache it before sending so a failed delivery never triggers a rebuild. */
export async function recordBuilt(store: WebhookEventStore, webhookEventId: string, replyText: string) {
  await store.updateMany({ where: { webhookEventId, status: "processing" }, data: { status: "sending", replyText } });
}

// Both accept "processing" too: if recordBuilt failed transiently, the row must still reach a final
// state instead of later looking like a stale claim (which would send an extra acknowledgement).
const OPEN_STATES = { in: ["processing", "sending"] };

export async function markDelivered(store: WebhookEventStore, webhookEventId: string) {
  await store.updateMany({ where: { webhookEventId, status: OPEN_STATES }, data: { status: "replied", replyText: null } });
}

/** The reply text is written again here so a redelivery can resend it even if recordBuilt had failed. */
export async function markDeliveryFailed(store: WebhookEventStore, webhookEventId: string, replyText: string) {
  await store.updateMany({ where: { webhookEventId, status: OPEN_STATES }, data: { status: "built", replyText } });
}

/** Building threw: release the claim so LINE's redelivery can try again. */
export async function releaseClaim(store: WebhookEventStore, webhookEventId: string) {
  await store.deleteMany({ where: { webhookEventId, status: "processing" } });
}
