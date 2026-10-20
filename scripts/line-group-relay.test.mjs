// Offline check of the group relay (lib/line/groupRelay.ts) through the LINE webhook route.
// Every outbound fetch is intercepted; a fake Vercel request context captures waitUntil.
// Needs an isolated DATABASE_URL (the DM case touches the dedupe/session tables with synthetic data).
// Usage: DATABASE_URL=postgresql://...isolated... node scripts/line-group-relay.test.mjs
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
const RELAY = "https://relay.invalid/api/line/events/ingest";
process.env.LINE_CHANNEL_SECRET = SECRET;
process.env.LINE_CHANNEL_ACCESS_TOKEN = "synthetic-access-token";
delete process.env.LINE_ADMIN_USER_ID;
delete process.env.ADMIN_LINE_USER_ID;

const outbound = [];
let relayDelayMs = 0;
globalThis.fetch = async (url, init) => {
  const call = { url: String(url), body: String(init?.body || ""), headers: init?.headers || {}, signal: init?.signal };
  outbound.push(call);
  if (call.url === RELAY && relayDelayMs) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, relayDelayMs);
      init?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(init.signal.reason); });
    });
  }
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
};
const waited = [];
globalThis[Symbol.for("@vercel/request-context")] = { get: () => ({ waitUntil: (p) => waited.push(p) }) };

const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const route = jiti(path.join(root, "app/api/line/webhook/route.ts"));
const { prisma } = jiti(path.join(root, "lib/prisma.ts"));

const res = [];
const chk = (n, ok, d = "") => res.push(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`);
const sign = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("base64");
const post = (body, signature) => route.POST(new Request("http://localhost/api/line/webhook", { method: "POST", headers: { "x-line-signature": signature }, body }));
const ev = (id, source, text = "【線路測試】") => ({ type: "message", webhookEventId: id, deliveryContext: { isRedelivery: false }, replyToken: `synthetic-reply-${id}`, source, timestamp: Date.now(), message: { id: `m-${id}`, type: "text", text } });
const group = { type: "group", groupId: "Csyntheticgroup", userId: "Usyntheticmember000000000000000" };
const room = { type: "room", roomId: "Rsyntheticroom", userId: "Usyntheticmember000000000000000" };
const dmUser = "Usyntheticrelaydm000000000000000";
const bodyOf = (...events) => JSON.stringify({ destination: "Usynthetic", events });
const relays = () => outbound.filter((o) => o.url === RELAY);
const settle = async () => { await Promise.allSettled(waited.splice(0)); };

// 1. group text, relay URL set → 200, no LINE reply, exactly one relay with the raw body and signature
process.env.LINE_GROUP_RELAY_URL = RELAY;
const gBody = bodyOf(ev("01SYNTHRELAYG1", group));
const gSig = sign(gBody);
const g = await post(gBody, gSig);
const handedOff = waited.length;
await settle();
const r1 = relays().at(-1);
chk("group event → 200, no reply to group", g.status === 200 && !outbound.some((o) => o.url.includes("/message/reply")), String(g.status));
chk("group event → one relay, body byte-identical, signature unchanged", relays().length === 1 && r1.body === gBody && r1.headers["x-line-signature"] === gSig);
chk("relay fetch has an abort signal (1.5 s timeout)", r1?.signal instanceof AbortSignal);
chk("relay is handed to waitUntil", handedOff === 1, `waitUntil calls=${handedOff}`);

// 2. room event and non-text group event (image) are relayed too; the receiver decides what to keep
const imgEvent = { ...ev("01SYNTHRELAYIMG", group), message: { id: "m-img", type: "image" } };
for (const [name, body] of [["room event", bodyOf(ev("01SYNTHRELAYR1", room))], ["group image event", bodyOf(imgEvent)]]) {
  const before = relays().length;
  const r = await post(body, sign(body));
  await settle();
  chk(`${name} → 200 and relayed`, r.status === 200 && relays().length === before + 1);
}

// 3. DM only → not relayed, still answered as before
let before = relays().length;
const dmBody = bodyOf(ev("01SYNTHRELAYDM1", { type: "user", userId: dmUser }, "包車"));
const dm = await post(dmBody, sign(dmBody));
await settle();
chk("DM → not relayed, reply sent as before", dm.status === 200 && relays().length === before && outbound.at(-1).url.includes("/message/reply"), String(dm.status));

// 4. invalid signature / malformed JSON → nothing relayed
before = relays().length;
const bad = await post(gBody, sign(gBody + "x"));
const bj = await post("{not json", sign("{not json"));
await settle();
chk("invalid signature → 403, not relayed", bad.status === 403 && relays().length === before);
chk("malformed JSON → 400, not relayed", bj.status === 400 && relays().length === before);

// 5. relay URL unset → the built-in receiver URL (Owner 2026-10-20), raw body and signature unchanged
delete process.env.LINE_GROUP_RELAY_URL;
const { DEFAULT_RELAY_URL } = jiti(path.join(root, "lib/line/groupRelay.ts"));
const toDefault = () => outbound.filter((o) => o.url === DEFAULT_RELAY_URL);
const unset = await post(gBody, gSig);
await settle();
const d1 = toDefault().at(-1);
chk("LINE_GROUP_RELAY_URL unset → 200, relayed to built-in URL", unset.status === 200 && toDefault().length === 1 && d1.body === gBody && d1.headers["x-line-signature"] === gSig);
chk("built-in URL is the second machine's Funnel ingest path", DEFAULT_RELAY_URL === "https://gx10-worker-02.tailde7162.ts.net/api/line/events/ingest");
const dmUnset = await post(dmBody, sign(dmBody));
await settle();
chk("LINE_GROUP_RELAY_URL unset, DM → not relayed", dmUnset.status === 200 && toDefault().length === 1);
process.env.LINE_GROUP_RELAY_URL = RELAY;

// 6. receiver hangs → response does not wait for it; the relay aborts at ~1.5 s with no retry
relayDelayMs = 10_000;
before = relays().length;
const t0 = Date.now();
const slow = await post(gBody, gSig);
const respondedMs = Date.now() - t0;
const t1 = Date.now();
await settle();
const abortedMs = Date.now() - t1;
chk("hanging receiver → webhook still answers immediately", slow.status === 200 && respondedMs < 500, `${respondedMs} ms`);
chk("hanging receiver → aborted near 1.5 s, one attempt only", abortedMs >= 1300 && abortedMs < 2500 && relays().length === before + 1, `${abortedMs} ms, attempts=${relays().length - before}`);
relayDelayMs = 0;

// 7. receiver down (fetch throws) → webhook unaffected
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { if (String(url) === RELAY) throw new TypeError("fetch failed"); return realFetch(url, init); };
const down = await post(gBody, gSig);
const downSettled = await Promise.allSettled(waited.splice(0));
chk("receiver down → 200, relay error swallowed", down.status === 200 && downSettled.every((s) => s.status === "fulfilled"));
globalThis.fetch = realFetch;

// 8. mixed batch (DM + group) → relayed once and the DM still answered
before = relays().length;
const repliesBefore = outbound.filter((o) => o.url.includes("/message/reply")).length;
const mixed = bodyOf(ev("01SYNTHRELAYMIXDM", { type: "user", userId: dmUser }, "包車"), ev("01SYNTHRELAYMIXG", group));
const mx = await post(mixed, sign(mixed));
await settle();
chk("mixed batch → relayed once, DM answered once", mx.status === 200 && relays().length === before + 1 && outbound.filter((o) => o.url.includes("/message/reply")).length === repliesBefore + 1);

await prisma.lineWebhookEvent.deleteMany({ where: { webhookEventId: { startsWith: "01SYNTHRELAY" } } }).catch(() => {});
await prisma.lineSession.deleteMany({ where: { userId: dmUser } }).catch(() => {});
await prisma.charterQuote.deleteMany({ where: { lineUserId: dmUser } }).catch(() => {});
console.log(res.join("\n"));
await prisma.$disconnect();
process.exitCode = res.some((l) => l.startsWith("FAIL")) ? 1 : 0;
