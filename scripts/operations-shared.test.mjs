// Run: node --test scripts/operations-shared.test.mjs
// Job lifecycle rules in lib/operations/shared.ts (PR #33 review: dry-run state, retry backoff,
// Instagram container polling/resume, approval bound to the publishing account). No network, no DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
delete process.env.INSTAGRAM_LOGIN_ACCOUNT_ID;
delete process.env.INSTAGRAM_LOGIN_TOKEN_STORE;
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const shared = jiti(path.join(root, "lib/operations/shared.ts"));

test("dry run is not terminal: claimable, due again for a live run, not due for another dry run", () => {
  assert.ok(shared.CLAIMABLE_STATUSES.includes("dry_run_verified"));
  assert.ok(shared.dueStatusesFor("live").includes("dry_run_verified"));
  assert.ok(!shared.dueStatusesFor("dry-run").includes("dry_run_verified"));
  assert.equal(shared.aggregateContentStatus(["dry_run_verified", "dry_run_verified"], "approved"), "approved", "dry run does not complete content");
  assert.equal(shared.aggregateContentStatus(["published", "published"], "approved"), "completed");
  assert.equal(shared.aggregateContentStatus(["published", "dry_run_verified"], "approved"), "partial");
});

test("awaiting_auth is parked (not auto-due); retryable_failed is due only after its backoff", () => {
  for (const mode of ["dry-run", "live"]) assert.ok(!shared.dueStatusesFor(mode).includes("awaiting_auth"), mode);
  assert.ok(shared.CLAIMABLE_STATUSES.includes("awaiting_auth"), "an operator can still run it explicitly");
  const now = Date.UTC(2026, 8, 29);
  const fail = { status: "retryable_failed", error: "rejected" };
  const delays = [1, 2, 3, 4].map((attempts) => shared.nextAttemptPlan(fail, attempts, now).scheduledAt.getTime() - now);
  assert.deepEqual(delays, [5, 10, 20, 40].map((m) => m * 60 * 1000));
  const final = shared.nextAttemptPlan(fail, shared.MAX_AUTO_ATTEMPTS, now);
  assert.equal(final.status, "manual_required");
  assert.equal(final.scheduledAt, null);
  assert.equal(shared.nextAttemptPlan({ status: "published" }, 1, now).scheduledAt, undefined, "other results leave scheduledAt alone");
});

function fakeClient({ statuses, accountId = "17841400000000001" }) {
  const calls = { created: 0, carousel: 0, status: 0, publish: 0 };
  return {
    calls,
    client: {
      accountId,
      async createImageContainer() { calls.created += 1; return { containerId: `c${calls.created}` }; },
      async createCarouselContainer() { calls.carousel += 1; return { containerId: "carousel1" }; },
      async getContainerStatus() { calls.status += 1; return { status: statuses[Math.min(calls.status - 1, statuses.length - 1)] }; },
      async publishContainer() { calls.publish += 1; return { mediaId: "m1" }; },
      async verifyPublishedMedia() { return { postUrl: "https://www.instagram.com/p/x/" }; },
    },
  };
}

function igJob(submission) {
  return { platform: "instagram", caption: "cap", status: "processing", jobId: "J:instagram:v1", adapter: "instagram_login_v2", attempts: 1, submission: submission ?? { phase: "not_started", containerIds: [], carouselContainerId: null, publishIntentAt: null, submittedAt: null } };
}

function deps(fake, extra = {}) {
  const marks = [];
  return {
    marks,
    value: {
      markSubmission: async (patch) => { marks.push(patch); },
      instagramImageUrls: async () => ["https://r2.example/presigned-1.jpg"],
      instagramClient: async () => fake.client,
      sleep: async () => {},
      approvedInstagramAccount: "17841400000000001",
      ...extra,
    },
  };
}

test("Instagram container still IN_PROGRESS after polling → retryable, container kept, nothing published", async () => {
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "true";
  const fake = fakeClient({ statuses: ["IN_PROGRESS"] });
  const d = deps(fake);
  const job = igJob();
  const result = await shared.executeJob(job, "live", d.value);
  assert.equal(result.status, "retryable_failed");
  assert.equal(fake.calls.status, shared.CONTAINER_POLL_ATTEMPTS);
  assert.equal(fake.calls.publish, 0);
  assert.equal(job.submission.phase, "container_created");
  assert.deepEqual(job.submission.containerIds, ["c1"]);
});

test("resume: the next attempt reuses the created container and publishes once it is FINISHED", async () => {
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "true";
  const fake = fakeClient({ statuses: ["IN_PROGRESS", "FINISHED"] });
  const job = igJob({ phase: "container_created", containerIds: ["c-existing"], carouselContainerId: null, publishIntentAt: null, submittedAt: null });
  const result = await shared.executeJob(job, "live", deps(fake).value);
  assert.equal(result.status, "published");
  assert.equal(fake.calls.created, 0, "no new container");
  assert.equal(fake.calls.publish, 1);
});

test("container ERROR stays a reconciliation case (never auto-resent)", async () => {
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "true";
  const fake = fakeClient({ statuses: ["ERROR"] });
  const result = await shared.executeJob(igJob(), "live", deps(fake).value);
  assert.equal(result.status, "submitted_pending_verification");
  assert.equal(fake.calls.publish, 0);
});

test("publishing to an account other than the approved one is refused before any container is created", async () => {
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "true";
  const fake = fakeClient({ statuses: ["FINISHED"], accountId: "17841499999999999" });
  const result = await shared.executeJob(igJob(), "live", deps(fake).value);
  assert.equal(result.status, "awaiting_auth");
  assert.equal(fake.calls.created, 0);
});

test("approval hash binds the Instagram account; another account yields another hash", () => {
  const job = { caption: "cap", platform: "instagram" };
  const a = shared.jobApprovalHash(["s1"], job, { instagram: "17841400000000001" });
  const b = shared.jobApprovalHash(["s1"], job, { instagram: "17841499999999999" });
  assert.notEqual(a, b);
  assert.equal(shared.jobApprovalHash(["s1"], { caption: "cap", platform: "website" }, { instagram: "x" }), shared.jobApprovalHash(["s1"], { caption: "cap", platform: "website" }, { instagram: "y" }), "other platforms unaffected");
});

test("resolveInstagramAccountId prefers the explicit env and otherwise uses the stored OAuth token account", async () => {
  process.env.INSTAGRAM_LOGIN_ACCOUNT_ID = "17841400000000001";
  assert.equal(await shared.resolveInstagramAccountId(), "17841400000000001");
  delete process.env.INSTAGRAM_LOGIN_ACCOUNT_ID;
  assert.equal(await shared.resolveInstagramAccountId(), "", "no env and no token store → unset");
  assert.deepEqual(await shared.resolveApprovalAccounts(), { instagram: "unset" });

  // The review case: credentials come only from the OAuth store (no INSTAGRAM_LOGIN_ACCOUNT_ID).
  const dir = mkdtempSync(path.join(os.tmpdir(), "ig-store-"));
  const key = randomBytes(32);
  const oauth = jiti(path.join(root, "lib/social/instagram-oauth.ts"));
  const store = { kind: "file", path: path.join(dir, "token.json") };
  const save = (accountId) => oauth.saveInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store }, { accountId, accessToken: "synthetic", obtainedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(), scopes: ["instagram_business_basic"] });
  process.env.INSTAGRAM_LOGIN_TOKEN_STORE = `file:${store.path}`;
  process.env.INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY = key.toString("base64");
  try {
    await save("17841400000000001");
    const first = await shared.resolveApprovalAccounts();
    assert.deepEqual(first, { instagram: "17841400000000001" });
    await save("17841499999999999"); // re-authorized with a different account
    const second = await shared.resolveApprovalAccounts();
    assert.deepEqual(second, { instagram: "17841499999999999" });
    const job = { caption: "cap", platform: "instagram" };
    assert.notEqual(shared.jobApprovalHash(["s1"], job, first), shared.jobApprovalHash(["s1"], job, second), "earlier approval no longer matches");
  } finally {
    delete process.env.INSTAGRAM_LOGIN_TOKEN_STORE;
    delete process.env.INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY;
    rmSync(dir, { recursive: true, force: true });
  }
});
