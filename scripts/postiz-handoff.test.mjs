import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
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
  const approved = { status: "approved", approvedBy: "operations-owner", approvedAt: new Date().toISOString() };
  const pending = await handoff.handoffApprovedPiece({ contentId: "content-1", platform: "instagram", caption: "還沒核准", approval: { status: "pending", approvedBy: null, approvedAt: null } }, store);
  assert.equal(pending.ok, false);
  assert.equal(pending.state, "refused");
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
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    throw new Error("native publisher was called");
  };
  const native = await shared.executeJob(job("facebook_page"), "live", { markSubmission: async () => {}, publicImageUrls: async () => ["https://cdn.example/a.jpg"] });
  global.fetch = originalFetch;
  assert.equal(calls.length, 0);
  assert.equal(native.status, "manual_required");
  assert.match(native.error, /原生 worker 不發這篇/);

  delete process.env.POSTIZ_API_KEY;
  const missing = await handoff.handoffApprovedPiece({ contentId: "content-2", platform: "x", caption: "另一篇", approval: approved }, handoff.memoryHandoffStore());
  assert.equal(missing.ok, false);
  assert.equal(missing.state, "未完成");
  assert.match(missing.error, /POSTIZ_API_KEY/);
  assert.equal(posts.length, 1);
  const report = JSON.stringify(health.publishingHealth());
  assert.equal(report.includes(apiKey), false);
  assert.match(report, /"outlet":"postiz"/);
  server.close();
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
  assert.equal(failed.error.includes(apiKey), false);
  const retried = await handoff.handoffApprovedPiece({ contentId: "content-err", platform: "x", caption: "文案", approval: approved }, store);
  assert.equal(retried.duplicate, true);
  assert.equal(hits, 1);

  process.env.POSTIZ_API_URL = `http://127.0.0.1:${hanging.address().port}`;
  const timed = await handoff.handoffApprovedPiece({ contentId: "content-timeout", platform: "facebook_page", caption: "文案", approval: approved }, handoff.memoryHandoffStore(), { timeoutMs: 30 });
  assert.equal(timed.ok, false);
  assert.match(timed.error, /逾時/);
  assert.equal(timed.error.includes(apiKey), false);
  failing.close();
  hanging.close();
});
