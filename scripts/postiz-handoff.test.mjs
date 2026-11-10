import { describe, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function job(platform) {
  const now = new Date().toISOString();
  return {
    platform,
    caption: "核准後的句子",
    imageUrl: null,
    status: "queued",
    jobId: `job-${platform}`,
    idempotencyKey: `idem-${platform}`,
    attempts: 0,
    scheduledAt: null,
    createdAt: now,
    updatedAt: now,
    lockedUntil: null,
    externalId: null,
    postUrl: null,
    lastError: null,
    verification: "not_tested",
    adapter: platform === "x" ? "x_oauth1" : platform === "instagram" ? "instagram_login_v2" : "facebook_page",
  };
}

describe("postiz handoff", { concurrency: false }, () => {
test("Postiz drafts only approved content once, and the native worker stays quiet", async () => {
  const posts = [];
  const server = await listen(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    posts.push({ authorization: request.headers.authorization, type: body.type, path: request.url });
    if (body.fail) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: `failed ${request.headers.authorization}` }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify([{ postId: "draft-1", integration: "integration-1" }]));
  });
  const address = server.address();
  const apiKey = "postiz-test-key-should-not-leak";
  process.env.PUBLISH_OUTLET = "postiz";
  process.env.POSTIZ_API_URL = `http://127.0.0.1:${address.port}`;
  process.env.POSTIZ_API_KEY = apiKey;
  process.env.POSTIZ_FACEBOOK_INTEGRATION_ID = "fb-integration";
  process.env.POSTIZ_INSTAGRAM_INTEGRATION_ID = "ig-integration";
  process.env.POSTIZ_X_INTEGRATION_ID = "x-integration";
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "true";
  process.env.FACEBOOK_PAGE_ID = "page";
  process.env.FACEBOOK_ACCESS_TOKEN = "page-token";
  const handoff = jiti("@/lib/postiz/handoff");
  const shared = jiti("@/lib/operations/shared");
  const health = jiti("@/lib/admin/publishingHealth");
  const store = handoff.memoryHandoffStore();
  const originalFetch = global.fetch;
  try {
  const approved = { status: "approved", approvedBy: "operations-owner", approvedAt: new Date().toISOString() };
  const pending = await handoff.handoffApprovedPiece({ contentId: "content-1", platform: "instagram", caption: "還沒核准", approval: { status: "pending", approvedBy: null, approvedAt: null } }, store);
  assert.equal(pending.ok, false);
  assert.equal(pending.state, "未完成");
  assert.match(pending.error, /尚未由老闆核准/);
  assert.equal(posts.length, 0);

  const [first, second] = await Promise.all([
    handoff.handoffApprovedPiece({ contentId: "content-1", platform: "instagram", caption: "核准文案", imageUrl: "https://cdn.example/a.jpg", approval: approved }, store),
    handoff.handoffApprovedPiece({ contentId: "content-1", platform: "instagram", caption: "核准文案", imageUrl: "https://cdn.example/a.jpg", approval: approved }, store),
  ]);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].type, "draft");
  assert.equal(posts[0].path, "/public/v1/posts");
  assert.equal(posts[0].authorization, apiKey);
  assert.equal([first.sent, second.sent].filter(Boolean).length, 1);
  assert.equal(first.postizPostId || second.postizPostId, "draft-1");
  const again = await handoff.handoffApprovedPiece({ contentId: "content-1", platform: "instagram", caption: "核准文案", approval: approved }, store);
  assert.equal(again.duplicate, true);
  assert.equal(posts.length, 1);

  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    throw new Error("native publisher was called");
  };
  const native = await shared.executeJob(job("facebook_page"), "live", { markSubmission: async () => {}, publicImageUrls: async () => ["https://cdn.example/a.jpg"] });
  assert.equal(calls.length, 0);
  assert.equal(native.status, "manual_required");
  assert.match(native.error, /未完成/);
  assert.notEqual(native.status, "published");

  delete process.env.POSTIZ_API_KEY;
  const missing = await handoff.handoffApprovedPiece({ contentId: "content-2", platform: "x", caption: "另一篇", approval: approved }, handoff.memoryHandoffStore());
  assert.equal(missing.ok, false);
  assert.equal(missing.state, "未完成");
  assert.match(missing.error, /POSTIZ_API_KEY/);
  assert.equal(posts.length, 1);
  const report = JSON.stringify(health.publishingHealth());
  assert.equal(report.includes(apiKey), false);
  assert.match(report, /"outlet":"postiz"/);
  } finally {
    global.fetch = originalFetch;
    server.close();
  }
});

test("Postiz errors and timeouts do not leak the key or retry a failed send", async () => {
  const apiKey = "secret-postiz-key";
  let hits = 0;
  const failing = await listen(async (request, response) => {
    hits += 1;
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: `nope ${request.headers.authorization}` }));
  });
  const hanging = await listen(() => {});
  process.env.PUBLISH_OUTLET = "postiz";
  process.env.POSTIZ_API_KEY = apiKey;
  process.env.POSTIZ_FACEBOOK_INTEGRATION_ID = "fb";
  process.env.POSTIZ_INSTAGRAM_INTEGRATION_ID = "ig";
  process.env.POSTIZ_X_INTEGRATION_ID = "x";
  const handoff = jiti("@/lib/postiz/handoff");
  const approved = { status: "approved", approvedBy: "operations-owner", approvedAt: "2026-11-10T00:00:00.000Z" };
  const store = handoff.memoryHandoffStore();
  process.env.POSTIZ_API_URL = `http://127.0.0.1:${failing.address().port}`;
  const failed = await handoff.handoffApprovedPiece({ contentId: "content-err", platform: "x", caption: "文案", approval: approved }, store);
  assert.equal(failed.ok, false);
  assert.equal(failed.state, "未完成");
  assert.equal(failed.error.includes(apiKey), false);
  const retried = await handoff.handoffApprovedPiece({ contentId: "content-err", platform: "x", caption: "文案", approval: approved }, store);
  assert.equal(retried.duplicate, true);
  assert.equal(retried.state, "未完成");
  assert.equal(hits, 1);

  process.env.POSTIZ_API_URL = `http://127.0.0.1:${hanging.address().port}`;
  const timeoutStore = handoff.memoryHandoffStore();
  const timed = await handoff.handoffApprovedPiece({ contentId: "content-timeout", platform: "facebook_page", caption: "文案", approval: approved }, timeoutStore, { timeoutMs: 30 });
  assert.equal(timed.ok, false);
  assert.equal(timed.state, "需要人工確認");
  assert.match(timed.error, /逾時/);
  assert.equal(timed.error.includes(apiKey), false);
  const timedAgain = await handoff.handoffApprovedPiece({ contentId: "content-timeout", platform: "facebook_page", caption: "文案", approval: approved }, timeoutStore, { timeoutMs: 30 });
  assert.equal(timedAgain.state, "需要人工確認");
  assert.equal(timedAgain.sent, false);
  failing.close();
  hanging.close();
});

function fakePostizTable() {
  const rows = new Map();
  let chain = Promise.resolve();
  let uniqueConflicts = 0;
  const { Prisma } = jiti("@prisma/client");
  const client = {
    postizHandoff: {
      create({ data }) {
        const run = chain.then(() => {
          const exists = [...rows.values()].some((row) => row.idempotencyKey === data.idempotencyKey || (row.contentId === data.contentId && row.platform === data.platform));
          if (exists) {
            uniqueConflicts += 1;
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
          }
          const row = { ...data, postizPostId: null, lastError: null, updatedAt: new Date() };
          rows.set(data.idempotencyKey, row);
          return row;
        });
        chain = run.then(() => undefined, () => undefined);
        return run;
      },
      async findUnique({ where }) {
        if (where.idempotencyKey) return rows.get(where.idempotencyKey) || null;
        const pair = where.contentId_platform;
        if (!pair) return null;
        return [...rows.values()].find((row) => row.contentId === pair.contentId && row.platform === pair.platform) || null;
      },
      async updateMany({ where, data }) {
        const row = rows.get(where.idempotencyKey);
        if (!row || (where.status && row.status !== where.status)) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    },
  };
  return { client, rows, uniqueConflicts: () => uniqueConflicts };
}

test("Prisma handoff store sends one Postiz draft under P2002 and does not retry a stuck sending row", async () => {
  const posts = [];
  const server = await listen(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    posts.push({ path: request.url, type: body.type, content: body.posts?.[0]?.value?.[0]?.content, authorization: request.headers.authorization });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify([{ postId: `draft-${posts.length}`, integration: "integration-1" }]));
  });
  const previous = {
    PUBLISH_OUTLET: process.env.PUBLISH_OUTLET,
    POSTIZ_API_URL: process.env.POSTIZ_API_URL,
    POSTIZ_API_KEY: process.env.POSTIZ_API_KEY,
    POSTIZ_FACEBOOK_INTEGRATION_ID: process.env.POSTIZ_FACEBOOK_INTEGRATION_ID,
    POSTIZ_INSTAGRAM_INTEGRATION_ID: process.env.POSTIZ_INSTAGRAM_INTEGRATION_ID,
    POSTIZ_X_INTEGRATION_ID: process.env.POSTIZ_X_INTEGRATION_ID,
    OPERATIONS_LIVE_PUBLISH_ENABLED: process.env.OPERATIONS_LIVE_PUBLISH_ENABLED,
  };
  const apiKey = "db-store-key-must-stay-hidden";
  process.env.PUBLISH_OUTLET = "postiz";
  process.env.POSTIZ_API_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.POSTIZ_API_KEY = apiKey;
  process.env.POSTIZ_FACEBOOK_INTEGRATION_ID = "fb";
  process.env.POSTIZ_INSTAGRAM_INTEGRATION_ID = "ig";
  process.env.POSTIZ_X_INTEGRATION_ID = "x";
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "false";
  process.env.FACEBOOK_PAGE_ID = "page";
  process.env.FACEBOOK_ACCESS_TOKEN = "page-token";
  const handoff = jiti("@/lib/postiz/handoff");
  const db = jiti("@/lib/postiz/dbStore");
  const shared = jiti("@/lib/operations/shared");
  const table = fakePostizTable();
  const store = db.prismaHandoffStore(table.client);
  const approved = { status: "approved", approvedBy: "operations-owner", approvedAt: "2026-11-11T00:00:00.000Z" };
  const nativeCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    const target = String(url);
    nativeCalls.push(target);
    if (!target.includes("/public/v1/posts")) throw new Error(`native publisher was called: ${target}`);
    return originalFetch(url, init);
  };
  try {
    const drafted = await shared.executeJob(job("instagram"), "dry-run", {
      markSubmission: async () => { throw new Error("native submission must not be recorded"); },
      instagramImageUrls: async () => { throw new Error("native instagram lookup must not run"); },
      publicImageUrls: async () => ["https://cdn.example/a.jpg"],
      postizContent: { contentId: "content-worker", approval: approved },
      handoffStore: store,
    });
    assert.equal(drafted.status, "postiz_draft");
    assert.match(drafted.error, /已建立 Postiz 草稿/);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].type, "draft");
    assert.equal(nativeCalls.length, 1);
    assert.equal(table.rows.get("content-worker:instagram").status, "draft_created");

    const [first, second] = await Promise.all([
      handoff.handoffApprovedPiece({ contentId: "content-race", platform: "x", caption: "並發文案", approval: approved }, store),
      handoff.handoffApprovedPiece({ contentId: "content-race", platform: "x", caption: "並發文案", approval: approved }, store),
    ]);
    const racePosts = posts.filter((post) => post.content === "並發文案");
    assert.equal(racePosts.length, 1);
    assert.equal(table.uniqueConflicts() >= 1, true);
    assert.equal([first, second].filter((result) => result.sent).length, 1);
    assert.equal([first, second].some((result) => result.duplicate), true);
    assert.equal(JSON.stringify([first, second]).includes(apiKey), false);

    table.rows.set("content-stuck:facebook_page", {
      idempotencyKey: "content-stuck:facebook_page",
      contentId: "content-stuck",
      platform: "facebook_page",
      status: "sending",
      postizPostId: null,
      lastError: null,
      updatedAt: new Date(Date.now() - 60_000),
    });
    const beforeStuck = posts.length;
    const stuck = await handoff.handoffApprovedPiece({ contentId: "content-stuck", platform: "facebook_page", caption: "卡住", approval: approved }, store);
    const stuckAgain = await handoff.handoffApprovedPiece({ contentId: "content-stuck", platform: "facebook_page", caption: "卡住", approval: approved }, store);
    assert.equal(stuck.state, "需要人工確認");
    assert.equal(stuck.sent, false);
    assert.equal(stuckAgain.state, "需要人工確認");
    assert.equal(stuckAgain.sent, false);
    assert.equal(posts.length, beforeStuck);
    assert.equal(table.rows.get("content-stuck:facebook_page").status, "needs_manual_confirmation");

    const { Prisma } = jiti("@prisma/client");
    const missingTable = db.prismaHandoffStore({
      postizHandoff: {
        create() { throw new Prisma.PrismaClientKnownRequestError("table missing", { code: "P2021", clientVersion: "test" }); },
        async findUnique() { return null; },
        async updateMany() { return { count: 0 }; },
      },
    });
    const beforeMissing = posts.length;
    const missing = await shared.executeJob(job("x"), "dry-run", {
      markSubmission: async () => {},
      postizContent: { contentId: "content-no-table", approval: approved },
      handoffStore: missingTable,
    });
    assert.equal(missing.status, "queued");
    assert.match(missing.error, /未完成/);
    assert.match(missing.error, /交接表尚未建立/);
    assert.notEqual(missing.status, "published");
    assert.notEqual(missing.status, "postiz_draft");
    assert.equal(posts.length, beforeMissing);

    delete process.env.POSTIZ_API_KEY;
    const beforeUnset = posts.length;
    const unset = await shared.executeJob(job("facebook_page"), "dry-run", {
      markSubmission: async () => {},
      postizContent: { contentId: "content-unset", approval: approved },
      handoffStore: store,
    });
    assert.equal(unset.status, "queued");
    assert.match(unset.error, /未完成/);
    assert.match(unset.error, /POSTIZ_API_KEY/);
    assert.equal(posts.length, beforeUnset);
    assert.equal(JSON.stringify(unset).includes(apiKey), false);

    const workerSource = readFileSync(path.join(root, "lib/operations/shared.ts"), "utf8");
    const databaseSource = readFileSync(path.join(root, "lib/operations/dbStore.ts"), "utf8");
    const fileSource = readFileSync(path.join(root, "lib/operations/store.ts"), "utf8");
    assert.match(workerSource, /defaultHandoffStore\(\)/);
    assert.equal(workerSource.includes("memoryHandoffStore"), false);
    assert.match(databaseSource, /postizContent/);
    assert.match(fileSource, /postizContent/);
    assert.equal(databaseSource.includes("memoryHandoffStore"), false);
    assert.equal(fileSource.includes("memoryHandoffStore"), false);
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    server.close();
  }
});
});
