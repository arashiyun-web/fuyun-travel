// Atomic claim of LINE webhook events against a real Postgres (PR #33 review P1).
// Usage: DATABASE_URL=postgresql://...local isolated... node --test scripts/line-webhook-claim.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("REFUSED: DATABASE_URL must be an isolated local database");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const { prisma } = jiti(path.join(root, "lib/prisma.ts"));
const events = jiti(path.join(root, "lib/line/webhookEvents.ts"));
const store = prisma.lineWebhookEvent;
const PARALLEL = 10;
const cleanup = () => store.deleteMany({ where: { webhookEventId: { startsWith: "01CLAIMTEST" } } });

after(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("control: the previous count-then-insert check lets several parallel deliveries build", async () => {
  await cleanup();
  const id = "01CLAIMTESTOLD";
  const builds = await Promise.all(Array.from({ length: PARALLEL }, async () => {
    const seen = (await store.count({ where: { webhookEventId: id } })) > 0;
    if (seen) return 0;
    await new Promise((r) => setTimeout(r, 20)); // buildReply runs here (quote, admin push)
    await store.createMany({ data: [{ webhookEventId: id }], skipDuplicates: true });
    return 1;
  }));
  assert.ok(builds.reduce((a, b) => a + b, 0) > 1, "race not reproduced; control is inconclusive");
});

test("claimEvent: of 10 parallel deliveries exactly one builds, the rest skip", async () => {
  await cleanup();
  const claims = await Promise.all(Array.from({ length: PARALLEL }, () => events.claimEvent(store, "01CLAIMTESTNEW")));
  assert.equal(claims.filter((c) => c.kind === "build").length, 1);
  assert.equal(claims.filter((c) => c.kind === "skip").length, PARALLEL - 1);
});

test("a failed delivery is resent by exactly one of several parallel redeliveries", async () => {
  await cleanup();
  const id = "01CLAIMTESTRESEND";
  assert.equal((await events.claimEvent(store, id)).kind, "build");
  await events.recordBuilt(store, id, "cached reply");
  await events.markDeliveryFailed(store, id, "cached reply");
  const claims = await Promise.all(Array.from({ length: PARALLEL }, () => events.claimEvent(store, id)));
  const resends = claims.filter((c) => c.kind === "resend");
  assert.equal(resends.length, 1);
  assert.equal(resends[0].replyText, "cached reply");
});

test("rows written before the delivery columns existed count as replied", async () => {
  await cleanup();
  await prisma.$executeRawUnsafe(`INSERT INTO "line_webhook_events" ("webhook_event_id") VALUES ('01CLAIMTESTLEGACY')`);
  assert.deepEqual(await events.claimEvent(store, "01CLAIMTESTLEGACY"), { kind: "skip", reason: "replied" });
});

test("review MEDIUM: recordBuilt failed but the reply went out → final state, no stale acknowledgement later", async () => {
  await cleanup();
  const delivered = "01CLAIMTESTNORECORD1";
  assert.equal((await events.claimEvent(store, delivered)).kind, "build");
  // recordBuilt skipped (transient DB error); delivery succeeded
  await events.markDelivered(store, delivered);
  const later = new Date(Date.now() + 10 * 60 * 1000); // well past the stale window
  assert.deepEqual(await events.claimEvent(store, delivered, later), { kind: "skip", reason: "replied" });

  const failed = "01CLAIMTESTNORECORD2";
  assert.equal((await events.claimEvent(store, failed)).kind, "build");
  // recordBuilt skipped; delivery failed → the text is still cached for redelivery
  await events.markDeliveryFailed(store, failed, "real reply");
  const again = await events.claimEvent(store, failed, later);
  assert.deepEqual(again, { kind: "resend", replyText: "real reply" });
});

test("a build that threw releases the claim so a redelivery can build again", async () => {
  await cleanup();
  const id = "01CLAIMTESTRELEASE";
  assert.equal((await events.claimEvent(store, id)).kind, "build");
  await events.releaseClaim(store, id);
  assert.equal((await events.claimEvent(store, id)).kind, "build");
});
