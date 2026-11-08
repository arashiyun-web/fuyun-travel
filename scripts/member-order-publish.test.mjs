import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, scryptSync, createHmac } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = "fuyun_member_order";
const dbUser = "fuyun_member";
const dbPassword = "fuyun_member_only";
const databaseUrl = `postgresql://${dbUser}:${dbPassword}@127.0.0.1:5432/${database}`;
const requireFromHere = createRequire(import.meta.url);
const jiti = requireFromHere("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });

function psql(sql) {
  execFileSync("sudo", ["-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
}

test("LINE identity creates one member, and a confirmed quote becomes one passenger order", { timeout: 180000 }, async () => {
  const lineUsersSql = readFileSync(path.join(root, "prisma/migrations/202611080001_add_line_users/migration.sql"), "utf8");
  const orderSql = readFileSync(path.join(root, "prisma/pending/202611080002_charter_orders.sql"), "utf8");
  assert.equal(/CREATE TABLE[\s\S]*IF NOT EXISTS/.test(lineUsersSql), false);
  assert.equal(orderSql.includes("dispatch_orders"), false);
  assert.equal(orderSql.includes("driver_name"), false);
  assert.equal(orderSql.includes("license_plate"), false);
  assert.equal(readFileSync(path.join(root, "app/api/admin/quotes/[id]/order/route.ts"), "utf8").includes("pushLineText"), false);

  psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`);
  psql(`DROP DATABASE IF EXISTS ${database};`);
  psql(`DROP USER IF EXISTS ${dbUser};`);
  psql(`CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}' LOGIN;`);
  psql(`CREATE DATABASE ${database} OWNER ${dbUser};`);
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
    execFileSync("psql", ["-h", "127.0.0.1", "-U", dbUser, "-d", database, "-v", "ON_ERROR_STOP=1", "-f", path.join(root, "prisma/pending/202611080002_charter_orders.sql")], {
      env: { ...process.env, PGPASSWORD: dbPassword },
      stdio: "pipe",
    });
    process.env.DATABASE_URL = databaseUrl;
    process.env.LINE_CHANNEL_SECRET = "synthetic-channel-secret-for-member-test";
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "synthetic-access-token";
    process.env.LINE_GROUP_RELAY_URL = "http://127.0.0.1:9/line-relay-mock";
    delete process.env.LINE_ADMIN_USER_ID;
    delete process.env.ADMIN_LINE_USER_ID;
    const calls = [];
    global.fetch = async (url) => {
      const host = new URL(String(url)).host;
      calls.push(host);
      if (host !== "api.line.me" && !host.startsWith("127.0.0.1")) throw new Error(`unexpected external call ${host}`);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };

    const members = jiti("@/lib/members/lineMember");
    assert.equal(members.lineMemberUid({ type: "group", userId: "Ugroupmember000000000000000000" }), "");
    assert.equal(members.lineMemberUid({ type: "user", userId: "Udm000000000000000000000000000" }), "Udm000000000000000000000000000");

    const route = jiti("@/app/api/line/webhook/route.ts");
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const sign = (body) => createHmac("sha256", process.env.LINE_CHANNEL_SECRET).update(body).digest("base64");
    const post = (body) => route.POST(new Request("http://127.0.0.1/api/line/webhook", { method: "POST", headers: { "x-line-signature": sign(body) }, body }));
    const follow = (id) => JSON.stringify({ destination: "Udest", events: [{ type: "follow", webhookEventId: id, replyToken: "r", source: { type: "user", userId: "Udm000000000000000000000000000" } }] });
    assert.equal((await post(follow("01MEMBERFOLLOW1"))).status, 200);
    assert.equal((await post(follow("01MEMBERFOLLOW2"))).status, 200);
    const message = JSON.stringify({ destination: "Udest", events: [{ type: "message", webhookEventId: "01MEMBERMSG1", replyToken: "r2", source: { type: "user", userId: "Udm000000000000000000000000000" }, message: { type: "text", text: "你好" } }] });
    assert.equal((await post(message)).status, 200);
    const group = JSON.stringify({ destination: "Udest", events: [{ type: "message", webhookEventId: "01MEMBERGROUP1", replyToken: "r3", source: { type: "group", groupId: "Cgroup", userId: "Ugroupmember000000000000000000" }, message: { type: "text", text: "群組" } }] });
    assert.equal((await post(group)).status, 200);
    const unsigned = await route.POST(new Request("http://127.0.0.1/api/line/webhook", { method: "POST", body: follow("01MEMBERNOSIG") }));
    assert.equal(unsigned.status, 403);

    const rows = await prisma.lineUser.findMany();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].lineUid, "Udm000000000000000000000000000");
    assert.equal(rows[0].name, null);
    assert.equal(rows[0].phone, null);
    assert.equal(rows[0].email, null);
    assert.equal(calls.includes("gx10-worker-02.tailde7162.ts.net"), false);

    const salt = randomBytes(16).toString("hex");
    const password = "member-order-pass";
    process.env.ADMIN_USERNAME = "member-admin";
    process.env.ADMIN_PASSWORD_SALT = salt;
    process.env.ADMIN_PASSWORD_HASH = scryptSync(password, salt, 64).toString("hex");
    process.env.JWT_SECRET = "isolated-member-order-secret-32chars";
    const auth = jiti("@/lib/adminAuth");
    const token = auth.createAdminToken();
    const memberApi = jiti("@/app/api/admin/members/route.ts");
    const hidden = await memberApi.GET(new Request("http://127.0.0.1/api/admin/members"));
    assert.equal(hidden.status, 401);
    const visible = await memberApi.GET(new Request("http://127.0.0.1/api/admin/members", { headers: { authorization: `Bearer ${token}` } }));
    const visibleBody = await visible.json();
    assert.equal(visible.status, 200);
    assert.equal(visibleBody.members.length, 1);
    assert.equal(JSON.stringify(visibleBody).includes("0912"), false);

    const quote = await prisma.charterQuote.create({
      data: { lineUserId: "Udm000000000000000000000000000", pickup: "台北車站", destination: "九份", passengerCount: 6, remark: "10小時", recommendedVehicle: "賓士小車" },
    });
    const refused = await prisma.charterQuote.create({
      data: { lineUserId: "Udm000000000000000000000000000", pickup: "高雄經台北", destination: "九份", passengerCount: 6, remark: "10小時", recommendedVehicle: "賓士小車" },
    });
    const orderRoute = jiti("@/app/api/admin/quotes/[id]/order/route.ts");
    const callOrder = (id) => orderRoute.POST(new Request(`http://127.0.0.1/api/admin/quotes/${id}/order`, { method: "POST", headers: { authorization: `Bearer ${token}` } }), { params: { id } });
    const denied = await orderRoute.POST(new Request("http://127.0.0.1/api/admin/quotes/x/order", { method: "POST" }), { params: { id: quote.id } });
    assert.equal(denied.status, 401);
    const created = await callOrder(quote.id);
    const createdBody = await created.json();
    assert.equal(created.status, 200);
    assert.equal(createdBody.created, true);
    assert.equal(createdBody.order.baseAmountTwd, 7000);
    assert.equal(createdBody.order.totalAmountTwd, null);
    assert.equal(createdBody.order.status, "pending_confirmation");
    assert.equal(createdBody.sendsToCustomer, false);
    const confirmBase = await orderRoute.POST(new Request(`http://127.0.0.1/api/admin/quotes/${quote.id}/order`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ confirmCompleteQuote: true, totalAmountTwd: 7000 }),
    }), { params: { id: quote.id } });
    const confirmBaseBody = await confirmBase.json();
    assert.equal(confirmBase.status, 409);
    assert.match(confirmBaseBody.error, /訂金|總價|確認/);
    assert.equal((await prisma.charterOrder.findUnique({ where: { quoteId: quote.id } })).status, "pending_confirmation");
    const again = await callOrder(quote.id);
    const againBody = await again.json();
    assert.equal(again.status, 200);
    assert.equal(againBody.created, false);
    assert.equal(againBody.order.id, createdBody.order.id);
    assert.equal(await prisma.charterOrder.count(), 1);
    const blocked = await callOrder(refused.id);
    const blockedBody = await blocked.json();
    assert.equal(blocked.status, 409);
    assert.equal(await prisma.charterOrder.count(), 1);

    const vanTen = await prisma.charterQuote.create({
      data: { lineUserId: "Udm000000000000000000000000000", pickup: "台北車站", destination: "九份", passengerCount: 10, remark: "10小時", recommendedVehicle: "賓士小車" },
    });
    const vanTenOrder = await callOrder(vanTen.id);
    assert.equal(vanTenOrder.status, 409);
    assert.equal(await prisma.charterOrder.count({ where: { quoteId: vanTen.id } }), 0);

    const midibus = await prisma.charterQuote.create({
      data: { lineUserId: "Udm000000000000000000000000000", pickup: "台北", destination: "九份", passengerCount: 12, remark: "10小時", recommendedVehicle: "中巴" },
    });
    const midibusConfirm = await orderRoute.POST(new Request(`http://127.0.0.1/api/admin/quotes/${midibus.id}/order`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ confirmCompleteQuote: true, totalAmountTwd: 12000 }),
    }), { params: { id: midibus.id } });
    const midibusConfirmBody = await midibusConfirm.json();
    assert.equal(midibusConfirm.status, 409);
    assert.match(midibusConfirmBody.error, /餐|停車|稅/);
    assert.equal(await prisma.charterOrder.count({ where: { quoteId: midibus.id } }), 0);
    const midibusPending = await callOrder(midibus.id);
    const midibusPendingBody = await midibusPending.json();
    assert.equal(midibusPending.status, 200);
    assert.equal(midibusPendingBody.order.status, "pending_confirmation");
    assert.equal(midibusPendingBody.order.baseAmountTwd, 9000);
    assert.equal(midibusPendingBody.order.totalAmountTwd, null);

    const parallelQuote = await prisma.charterQuote.create({
      data: { lineUserId: "Udm000000000000000000000000000", pickup: "台北車站", destination: "九份", passengerCount: 6, remark: "10小時", recommendedVehicle: "賓士小車" },
    });
    const ordersLib = jiti("@/lib/charterOrder");
    const [first, second] = await Promise.all([
      ordersLib.convertConfirmedQuote(parallelQuote.id),
      ordersLib.convertConfirmedQuote(parallelQuote.id),
    ]);
    assert.equal(first.ok && second.ok, true);
    assert.equal(first.order.id, second.order.id);
    assert.equal([first.created, second.created].filter(Boolean).length, 1);
    assert.equal(await prisma.charterOrder.count({ where: { quoteId: parallelQuote.id } }), 1);

    const rollbackQuote = await prisma.charterQuote.create({
      data: { lineUserId: "Udm000000000000000000000000000", pickup: "台北車站", destination: "九份", passengerCount: 6, remark: "10小時", recommendedVehicle: "賓士小車" },
    });
    const rolled = await ordersLib.convertConfirmedQuote(rollbackQuote.id, {}, {
      beforeQuoteUpdate: async (tx) => { await tx.charterQuote.delete({ where: { id: rollbackQuote.id } }); },
    });
    assert.equal(rolled.ok, false);
    assert.equal(rolled.status, 409);
    assert.equal(await prisma.charterOrder.count({ where: { quoteId: rollbackQuote.id } }), 0);
    assert.ok(await prisma.charterQuote.findUnique({ where: { id: rollbackQuote.id } }));
    await prisma.$disconnect();
    await assertPublishFlow();
  } finally {
    psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`);
    psql(`DROP DATABASE IF EXISTS ${database};`);
    psql(`DROP USER IF EXISTS ${dbUser};`);
  }
});

async function assertPublishFlow() {
  const dir = mkdtempSync(path.join(tmpdir(), "fuyun-publish-"));
  process.env.OPERATIONS_PERSISTENCE_MODE = "file";
  process.env.OPERATIONS_DATA_DIR = dir;
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "false";
  delete process.env.VERCEL;
  process.env.GEMINI_API_KEY = "gemini-test-key";
  process.env.GEMINI_MODEL = "gemini-test-model";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_MODEL_NAME;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.FACEBOOK_ACCESS_TOKEN;
  delete process.env.X_ACCESS_TOKEN;
  delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const hosts = [];
  global.fetch = async (url) => {
    const host = new URL(String(url)).host;
    hosts.push(host);
    if (host !== "generativelanguage.googleapis.com") throw new Error(`unexpected external call ${host}`);
    const caption = JSON.stringify({ website: "官網一句", facebook_group: "社團一句", facebook_page: "粉專一句", instagram: "IG一句", x: "X一句" });
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: caption }] } }] }) };
  };
  const salt = randomBytes(16).toString("hex");
  process.env.ADMIN_USERNAME = "publish-admin";
  process.env.ADMIN_PASSWORD_SALT = salt;
  process.env.ADMIN_PASSWORD_HASH = scryptSync("publish-pass", salt, 64).toString("hex");
  process.env.JWT_SECRET = "isolated-publish-flow-secret-32ch";
  const auth = jiti("@/lib/adminAuth");
  const generate = jiti("@/app/api/social/generate/route.ts");
  const store = jiti("@/lib/operations/store");
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const response = await generate.POST(new Request("http://127.0.0.1/api/social/generate", {
    method: "POST",
    headers: { authorization: `Bearer ${auth.createAdminToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ text: "九份半日", location: "九份", imageBase64: png }),
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.approvalStatus, "pending");
  assert.equal(body.publishBlocked, true);
  const pending = await store.getContentRecord(body.operationsContentId);
  assert.equal(pending.approval.status, "pending");
  assert.equal(pending.platforms.website.status, "pending_approval");
  await assert.rejects(() => store.approveContent(body.operationsContentId, "someone-else"), /老闆核准/);
  const approved = await store.approveContent(body.operationsContentId, "operations-owner", null, true);
  assert.equal(approved.approval.status, "approved");
  assert.equal(approved.platforms.x.status, "queued");

  const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const scheduled = await store.createContentDraft({
    title: "排程測試",
    type: "回顧",
    tripDate: "2030-11-20",
    body: "排程測試正文",
    selectedPlatforms: ["website"],
    images: [{ dataUrl: png, originalName: "dot.png" }],
    captions: { website: "稍後再發" },
  });
  await store.approveContent(scheduled.id, "operations-owner", later, true);
  const waiting = await store.getContentRecord(scheduled.id);
  assert.equal(waiting.platforms.website.status, "scheduled");

  const dry = await store.runDueJobs();
  assert.equal(dry.some((item) => String(item.job?.jobId || "").startsWith(scheduled.id)), false);
  assert.equal(dry.every((item) => item.status !== "published"), true);
  const afterDry = await store.getContentRecord(body.operationsContentId);
  assert.equal(afterDry.platforms.website.status, "dry_run_verified");
  const forced = await store.runDueJobs("live");
  assert.equal(forced.every((item) => item.status !== "published"), true);
  const afterForced = await store.getContentRecord(body.operationsContentId);
  assert.equal(afterForced.platforms.website.status, "manual_required");
  assert.equal(hosts.every((host) => host === "generativelanguage.googleapis.com"), true);
}
