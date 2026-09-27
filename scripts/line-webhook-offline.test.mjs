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
globalThis.fetch = async (url, init) => {
  outbound.push({ url: String(url), body: String(init?.body || "") });
  return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
};

const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true }); // jiti v1
const route = jiti(path.join(root, "app/api/line/webhook/route.ts"));
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
const textEvent = (id, text, redelivery = false) => ({ type: "message", webhookEventId: id, deliveryContext: { isRedelivery: redelivery }, replyToken: `synthetic-reply-${id}`, source: { type: "user", userId }, timestamp: Date.now(), message: { id: `m-${id}`, type: "text", text } });

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
const failing = { count: async () => { throw new Error("relation does not exist"); }, createMany: async () => { throw new Error("relation does not exist"); } };
Object.defineProperty(prisma, "lineWebhookEvent", { value: failing, configurable: true });
const beforeFailOpen = outbound.length;
const foBody = JSON.stringify({ destination: "Usynthetic", events: [textEvent("01SYNTHFAILOPEN", "包車")] });
const fo = await call(foBody, sign(foBody));
Object.defineProperty(prisma, "lineWebhookEvent", { value: realModel, configurable: true });
chk("dedupe table unavailable → message still answered (fail-open)", fo.status === 200 && outbound.length - beforeFailOpen === 1, `${fo.status} calls=${outbound.length - beforeFailOpen}`);

await prisma.charterQuote.deleteMany({ where: { lineUserId: userId } });
await prisma.lineWebhookEvent.deleteMany({ where: { webhookEventId: { startsWith: "01SYNTH" } } });
await prisma.lineSession.deleteMany({ where: { userId } }).catch(() => {});
console.log(res.join("\n"));
await prisma.$disconnect();
