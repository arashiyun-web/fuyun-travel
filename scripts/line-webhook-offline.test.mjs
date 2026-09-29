// Offline check of the LINE webhook: signature verification, event filtering and redelivery handling.
// Loads app/api/line/webhook/route.ts in-process with jiti. Every outbound fetch (LINE reply/push) is
// intercepted, so nothing reaches LINE. Needs an isolated DATABASE_URL (synthetic data only).
// Usage: DATABASE_URL=postgresql://...isolated... node scripts/line-webhook-offline.test.mjs
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) {
  console.error("REFUSED: DATABASE_URL must be an isolated local database");
  process.exit(3);
}
const SECRET = "synthetic-channel-secret-for-offline-test";
process.env.LINE_CHANNEL_SECRET = SECRET;
process.env.LINE_CHANNEL_ACCESS_TOKEN = "synthetic-access-token";
process.env.LINE_ADMIN_USER_ID = "Usyntheticadmin00000000000000000"; // push is intercepted below
delete process.env.ADMIN_LINE_USER_ID;

const outbound = [];
let failNextReply = false;
globalThis.fetch = async (url, init) => {
  outbound.push({ url: String(url), body: String(init?.body || "") });
  if (failNextReply && String(url).includes("/message/reply")) {
    failNextReply = false;
    return new Response(JSON.stringify({ message: "synthetic failure" }), { status: 500, headers: { "content-type": "application/json" } });
  }
  return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
};

const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true }); // jiti v1
// LINE_ROUTE_PATH lets the same checks run against an older copy of the route (regression proof).
const route = jiti(process.env.LINE_ROUTE_PATH || path.join(root, "app/api/line/webhook/route.ts"));
const { prisma } = jiti(path.join(root, "lib/prisma.ts"));

const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const sign = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("base64");
async function call(body, signature) {
  try {
    const r = await route.POST(new Request("http://localhost/api/line/webhook", { method: "POST", headers: signature === null ? {} : { "x-line-signature": signature }, body }));
    return { status: r.status, json: await r.json().catch(() => ({})) };
  } catch (error) {
    return { status: "threw", error: String(error?.message || error).slice(0, 80) };
  }
}
const userId = "Usynthetic0000000000000000000000";
const textEvent = (id, text, redelivery = false, user = userId) => ({ type: "message", webhookEventId: id, deliveryContext: { isRedelivery: redelivery }, replyToken: `synthetic-reply-${id}`, source: { type: "user", userId: user }, timestamp: Date.now(), message: { id: `m-${id}`, type: "text", text } });
const bodyOf = (...events) => JSON.stringify({ destination: "Usynthetic", events });
const pushes = () => outbound.filter((o) => o.url.includes("/message/push")).length;
const replyTexts = () => outbound.filter((o) => o.url.includes("/message/reply")).map((o) => JSON.parse(o.body).messages[0].text);
const DETAILS = "日期:2030/11/20 人數:10 出發地:台北 目的地:宜蘭 備註:合成測試";
/** Same order as a real customer: 包車 starts the session, then the trip details. */
async function startQuote(user, tag) {
  for (const [suffix, text] of [["ENTRY", "包車"], ["DETAILS", DETAILS]]) {
    const b = bodyOf(textEvent(`01SYNTH${tag}${suffix}`, text, false, user));
    await call(b, sign(b));
  }
}

const followBody = JSON.stringify({ destination: "Usynthetic", events: [{ type: "follow", webhookEventId: "01SYNTHFOLLOW", deliveryContext: { isRedelivery: false }, replyToken: "r", source: { type: "user", userId } }] });
chk("missing signature → 403", (await call(followBody, null)).status === 403);
const good = sign(followBody);
const flipped = good.slice(0, -2) + (good.at(-2) === "A" ? "B" : "A") + good.at(-1);
chk("wrong signature (same length) → 403", (await call(followBody, flipped)).status === 403);
const shortSig = await call(followBody, "abc");
chk("wrong-length signature → 403 (not an exception)", shortSig.status === 403, JSON.stringify(shortSig.status === "threw" ? shortSig.error : shortSig.status));
const follow = await call(followBody, good);
chk("valid signature, non-text event → 200, nothing sent", follow.status === 200 && follow.json.replied === 0 && outbound.length === 0, `${follow.status} replied=${follow.json.replied}`);
const badJson = "{not json";
const bj = await call(badJson, sign(badJson));
chk("valid signature, malformed JSON → 400 (not an exception)", bj.status === 400, String(bj.status === "threw" ? bj.error : bj.status));

const before = outbound.length;
const quotesBefore = await prisma.charterQuote.count({ where: { lineUserId: userId } });
const msgBody = JSON.stringify({ destination: "Usynthetic", events: [textEvent("01SYNTHMSG1", "包車")] });
const m1 = await call(msgBody, sign(msgBody));
chk("valid text message → 200 and exactly one reply call (intercepted)", m1.status === 200 && outbound.length - before === 1 && outbound.at(-1).url.includes("/message/reply"), `${m1.status} calls=${outbound.length - before}`);

const detailsBody = JSON.stringify({ destination: "Usynthetic", events: [textEvent("01SYNTHDETAILS", "日期:2030/11/20 人數:10 出發地:台北 目的地:宜蘭 備註:合成測試")] });
await call(detailsBody, sign(detailsBody));
const officialBody = (id, redelivery) => JSON.stringify({ destination: "Usynthetic", events: [textEvent(id, "我要正式報價", redelivery)] });
await call(officialBody("01SYNTHQUOTE", false), sign(officialBody("01SYNTHQUOTE", false)));
const afterFirst = await prisma.charterQuote.count({ where: { lineUserId: userId } });
const pushesFirst = outbound.filter((o) => o.url.includes("/message/push")).length;
await call(officialBody("01SYNTHQUOTE", true), sign(officialBody("01SYNTHQUOTE", true)));
const afterRedelivery = await prisma.charterQuote.count({ where: { lineUserId: userId } });
const pushesAfter = outbound.filter((o) => o.url.includes("/message/push")).length;
chk("first 我要正式報價 creates one quote and one admin push (intercepted)", afterFirst === quotesBefore + 1 && pushesFirst === 1, `quotes ${quotesBefore}→${afterFirst}, pushes ${pushesFirst}`);
chk("redelivered event (same webhookEventId, isRedelivery=true) creates no second quote / push", afterRedelivery === afterFirst && pushesAfter === pushesFirst, `quotes ${quotesBefore}→${afterFirst}→${afterRedelivery}, pushes ${pushesFirst}→${pushesAfter}`);

// Dedupe table unavailable (e.g. code deployed before the migration) → the inquiry is still answered.
const realModel = prisma.lineWebhookEvent;
const boom = async () => { throw new Error("relation does not exist"); };
const failing = { count: boom, createMany: boom, findUnique: boom, updateMany: boom, deleteMany: boom };
Object.defineProperty(prisma, "lineWebhookEvent", { value: failing, configurable: true });
const beforeFailOpen = outbound.length;
const foBody = JSON.stringify({ destination: "Usynthetic", events: [textEvent("01SYNTHFAILOPEN", "包車")] });
const fo = await call(foBody, sign(foBody));
Object.defineProperty(prisma, "lineWebhookEvent", { value: realModel, configurable: true });
chk("dedupe table unavailable → message still answered (fail-open)", fo.status === 200 && outbound.length - beforeFailOpen === 1, `${fo.status} calls=${outbound.length - beforeFailOpen}`);

// ---- PR #33 review P1: the same event delivered concurrently → one quote, one admin push ----
const userC = "Usyntheticconcurrent000000000000";
await startQuote(userC, "C");
const qC0 = await prisma.charterQuote.count({ where: { lineUserId: userC } });
const pC0 = pushes();
const concurrentBody = bodyOf(textEvent("01SYNTHCQUOTE", "我要正式報價", false, userC));
const [c1, c2] = await Promise.all([call(concurrentBody, sign(concurrentBody)), call(concurrentBody, sign(concurrentBody))]);
const qC1 = await prisma.charterQuote.count({ where: { lineUserId: userC } });
chk("concurrent deliveries of one event → exactly one quote and one admin push", qC1 === qC0 + 1 && pushes() === pC0 + 1, `status ${c1.status}/${c2.status}, quotes ${qC0}→${qC1}, pushes ${pC0}→${pushes()}`);
chk("concurrent deliveries → one builds and replies, the other skips", c1.json.replied + c2.json.replied === 1 && c1.json.skippedRedelivery + c2.json.skippedRedelivery === 1, JSON.stringify([c1.json, c2.json].map((j) => ({ r: j.replied, s: j.skippedRedelivery }))));

// ---- PR #33 review P2: reply delivery fails → 500, cached reply resent on redelivery, nothing rebuilt ----
const userF = "Usyntheticreplyfail0000000000000";
await startQuote(userF, "F");
const qF0 = await prisma.charterQuote.count({ where: { lineUserId: userF } });
const pF0 = pushes();
failNextReply = true;
const failBody = bodyOf(textEvent("01SYNTHFQUOTE", "我要正式報價", false, userF));
const f1 = await call(failBody, sign(failBody));
const firstText = replyTexts().at(-1);
const rowAfterFail = await prisma.lineWebhookEvent.findUnique({ where: { webhookEventId: "01SYNTHFQUOTE" } }).catch(() => null);
chk("failed reply → HTTP 500 so LINE redelivers; reply kept for resend", f1.status === 500 && rowAfterFail?.status === "built", `${f1.status} row=${rowAfterFail?.status}`);
const redeliverBody = bodyOf(textEvent("01SYNTHFQUOTE", "我要正式報價", true, userF));
const f2 = await call(redeliverBody, sign(redeliverBody));
const qF2 = await prisma.charterQuote.count({ where: { lineUserId: userF } });
const rowAfterResend = await prisma.lineWebhookEvent.findUnique({ where: { webhookEventId: "01SYNTHFQUOTE" } }).catch(() => null);
chk("redelivery after failed reply → same reply resent, no second quote or push", f2.status === 200 && f2.json.resent === 1 && replyTexts().at(-1) === firstText && qF2 === qF0 + 1 && pushes() === pF0 + 1, `${f2.status} resent=${f2.json.resent} quotes ${qF0}→${qF2} pushes ${pF0}→${pushes()}`);
chk("delivered event is final: cached reply cleared, later redelivery skipped", rowAfterResend?.status === "replied" && rowAfterResend?.replyText === null && (await call(redeliverBody, sign(redeliverBody))).json.skippedRedelivery === 1);

// ---- stale claim (crash while building): no rebuild, a neutral acknowledgement is sent ----
const userS = "Usyntheticstaleclaim000000000000";
await prisma.lineWebhookEvent.createMany({ data: [{ webhookEventId: "01SYNTHSTALE", status: "processing", claimedAt: new Date(Date.now() - 10 * 60 * 1000) }], skipDuplicates: true }).catch(() => null);
const qS0 = await prisma.charterQuote.count({ where: { lineUserId: userS } });
const staleBody = bodyOf(textEvent("01SYNTHSTALE", "我要正式報價", true, userS));
const s1 = await call(staleBody, sign(staleBody));
chk("stale in-progress claim → acknowledgement reply, no quote rebuilt", s1.status === 200 && /已收到您的訊息/.test(replyTexts().at(-1) || "") && (await prisma.charterQuote.count({ where: { lineUserId: userS } })) === qS0, `${s1.status} reply=${(replyTexts().at(-1) || "").slice(0, 12)}`);

for (const u of [userC, userF, userS]) {
  await prisma.charterQuote.deleteMany({ where: { lineUserId: u } });
  await prisma.lineSession.deleteMany({ where: { userId: u } }).catch(() => {});
}
await prisma.charterQuote.deleteMany({ where: { lineUserId: userId } });
await prisma.lineWebhookEvent.deleteMany({ where: { webhookEventId: { startsWith: "01SYNTH" } } });
await prisma.lineSession.deleteMany({ where: { userId } }).catch(() => {});
console.log(res.join("\n"));
await prisma.$disconnect();
process.exitCode = res.some((l) => l.startsWith("FAIL")) ? 1 : 0;
