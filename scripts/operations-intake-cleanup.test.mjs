// Intake object cleanup in lib/operations/dbStore.ts (PR #33 review P2), against a real local Postgres.
// The object store is replaced by an in-memory fake so every upload/delete is observable.
// Usage: DATABASE_URL=postgresql://...local isolated, migrated... node --test scripts/operations-intake-cleanup.test.mjs
import { test, after } from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL || "")) throw new Error("REFUSED: DATABASE_URL must be an isolated local database");
const require = createRequire(import.meta.url);

const objects = new Map();
const hooks = { beforePut: async () => {}, failOnPut: 0 };
let puts = 0;
const fakeObjectStore = {
  PRESIGNED_URL_TTL_SECONDS: 900,
  objectStoreConfigured: () => true,
  async putObject(key, body) {
    puts += 1;
    await hooks.beforePut(puts);
    if (hooks.failOnPut && puts === hooks.failOnPut) throw new Error("synthetic upload failure");
    objects.set(key, body);
    return { key, sha256: require("node:crypto").createHash("sha256").update(body).digest("hex"), bytes: body.length };
  },
  async deleteObjects(keys) { for (const key of keys) objects.delete(key); return []; },
  async getObject() { throw new Error("not used"); },
  async presignGet() { return "https://example.invalid/presigned"; },
};
const objectStorePath = path.join(root, "lib/operations/objectStore.ts");
const fake = new Module(objectStorePath);
fake.filename = objectStorePath;
fake.loaded = true;
fake.exports = fakeObjectStore;
require.cache[objectStorePath] = fake;

const jiti = require("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true, requireCache: true });
// OPS_DBSTORE_PATH runs the same checks against an older copy (regression proof).
const db = jiti(process.env.OPS_DBSTORE_PATH || path.join(root, "lib/operations/dbStore.ts"));
const shared = jiti(path.join(root, "lib/operations/shared.ts"));
const { prisma } = jiti(path.join(root, "lib/prisma.ts"));

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const input = (title) => ({ title, type: "招生", tripDate: "2030-11-20", body: "合成測試內容。", selectedPlatforms: ["website", "instagram"], images: [{ dataUrl: PNG, originalName: "a.png" }, { dataUrl: PNG, originalName: "b.png" }] });
const reset = () => { objects.clear(); puts = 0; hooks.beforePut = async () => {}; hooks.failOnPut = 0; };
async function cleanDb() {
  const ids = (await prisma.operationsContent.findMany({ where: { title: { startsWith: "cleanup-test" } }, select: { id: true } })).map((c) => c.id);
  await prisma.operationsEvent.deleteMany({ where: { contentId: { in: ids } } });
  await prisma.operationsJob.deleteMany({ where: { contentId: { in: ids } } });
  await prisma.operationsContent.deleteMany({ where: { id: { in: ids } } });
}
after(async () => { await cleanDb(); await prisma.$disconnect(); });

test("the fake object store is the one dbStore uses", async () => {
  reset();
  await cleanDb();
  const record = await db.createContentDraft(input("cleanup-test wiring"));
  assert.equal(objects.size, 4, "2 originals + 2 Instagram JPEGs");
  assert.ok([...objects.keys()].every((k) => k.startsWith(`operations/${record.id}/`)));
});

test("losing a concurrent intake: the loser's uploads are deleted, the winner's are kept", async () => {
  reset();
  await cleanDb();
  const data = input("cleanup-test race");
  const { fingerprint } = shared.prepareIntake(data);
  const winnerId = "FUYUN-20300101-WINNER01";
  hooks.beforePut = async (n) => {
    if (n !== 1) return;
    // A concurrent identical intake commits first (after this request passed its "existing" check).
    await prisma.operationsContent.create({ data: { id: winnerId, contentFingerprint: fingerprint, title: data.title, type: data.type, tripDate: data.tripDate, body: data.body, images: [], selectedPlatforms: data.selectedPlatforms, status: "pending_approval" } });
    objects.set(`operations/${winnerId}/image-1.png`, Buffer.from("winner"));
  };
  const record = await db.createContentDraft(data);
  assert.equal(record.id, winnerId, "returns the winning record");
  assert.deepEqual([...objects.keys()], [`operations/${winnerId}/image-1.png`], "only the winner's object remains");
});

test("an upload failing midway deletes what was already uploaded, including the failed key", async () => {
  reset();
  await cleanDb();
  hooks.failOnPut = 3;
  await assert.rejects(db.createContentDraft(input("cleanup-test failure")), /synthetic upload failure/);
  assert.equal(objects.size, 0);
  assert.equal(await prisma.operationsContent.count({ where: { title: "cleanup-test failure" } }), 0);
});
