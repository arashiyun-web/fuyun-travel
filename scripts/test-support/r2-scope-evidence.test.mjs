// Run: node --test scripts/test-support/r2-scope-evidence.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyS3Error, expectRefused, classifyAnonymousGet, classifyPublicEntry, evaluateTokenPolicy, sha256Hex } from "./r2-scope-evidence.mjs";

const s3Err = (name, status) => Object.assign(new Error(name), { name, $metadata: { httpStatusCode: status } });
const netErr = (code) => Object.assign(new TypeError("fetch failed"), { cause: { code } });

test("only 403 AccessDenied counts as a refusal", async () => {
  assert.deepEqual((await expectRefused(() => Promise.reject(s3Err("AccessDenied", 403)))).outcome, "refused");
  assert.equal((await expectRefused(() => Promise.resolve({}))).outcome, "allowed");
});

test("NoSuchBucket is inconclusive, not a scope PASS", async () => {
  const r = await expectRefused(() => Promise.reject(s3Err("NoSuchBucket", 404)));
  assert.equal(r.outcome, "inconclusive");
  assert.equal(r.kind, "no_such_bucket");
});

test("timeouts are inconclusive (SDK TimeoutError and a hung call)", async () => {
  assert.equal((await expectRefused(() => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })))).kind, "timeout");
  const hung = await expectRefused(() => new Promise(() => {}), { timeoutMs: 20 });
  assert.equal(hung.outcome, "inconclusive");
  assert.equal(hung.kind, "timeout");
});

test("connection errors are inconclusive", async () => {
  for (const code of ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"]) {
    const r = await expectRefused(() => Promise.reject(netErr(code)));
    assert.equal(r.outcome, "inconclusive", code);
    assert.equal(r.kind, "network", code);
  }
});

test("credential errors are inconclusive (a wrong key is not a scoped key)", async () => {
  for (const [name, status] of [["InvalidAccessKeyId", 403], ["SignatureDoesNotMatch", 403], ["Unauthorized", 401]]) {
    const r = await expectRefused(() => Promise.reject(s3Err(name, status)));
    assert.equal(r.outcome, "inconclusive", name);
    assert.equal(r.kind, "auth_error", name);
  }
});

test("AccessDenied without a 403 status is not trusted", () => {
  assert.equal(classifyS3Error(s3Err("AccessDenied", undefined)).kind, "other");
});

test("anonymous GET: exact R2 signature-required answer is refused; others are not", () => {
  const xml = (c, m) => `<?xml version="1.0"?><Error><Code>${c}</Code><Message>${m}</Message></Error>`;
  assert.equal(classifyAnonymousGet(400, xml("InvalidArgument", "Authorization")).outcome, "refused");
  assert.equal(classifyAnonymousGet(403, xml("AccessDenied", "Access Denied")).outcome, "refused");
  assert.equal(classifyAnonymousGet(200, "data").outcome, "readable");
  assert.equal(classifyAnonymousGet(404, xml("NoSuchBucket", "x")).outcome, "inconclusive");
  assert.equal(classifyAnonymousGet(400, xml("InvalidRequest", "other")).outcome, "inconclusive");
  assert.equal(classifyAnonymousGet(502, "").outcome, "inconclusive");
});

test("public entry closed only when both management answers say so", () => {
  const dev = "Public access via the r2.dev URL is disabled.";
  const dom = "There are no custom domains connected to this bucket.";
  assert.equal(classifyPublicEntry(dev, dom).closed, true);
  assert.equal(classifyPublicEntry("Public access via the r2.dev URL is enabled.", dom).closed, false);
  assert.equal(classifyPublicEntry(dev, "example.com  active").closed, false);
  assert.equal(classifyPublicEntry("", "").closed, false);
});

const ACCT = "a".repeat(32);
const KEY = "b".repeat(32);
const BUCKET = "fuyun-ops-pr33-e2e";
const token = (over = {}) => ({
  id: KEY,
  status: "active",
  policies: [{ effect: "allow", permission_groups: [{ name: "Workers R2 Storage Bucket Item Write" }, { name: "Workers R2 Storage Bucket Item Read" }], resources: { [`com.cloudflare.edge.r2.bucket.${ACCT}_default_${BUCKET}`]: "*" } }],
  ...over,
});
const want = { accessKeyId: KEY, accountId: ACCT, bucket: BUCKET };

test("token policy: Object Read & Write on exactly this bucket is scoped", () => {
  const r = evaluateTokenPolicy(token(), want);
  assert.equal(r.scoped, true, r.problems.join("; "));
  const { id, ...rest } = token();
  assert.equal(evaluateTokenPolicy({ ...rest, id_sha256: sha256Hex(id) }, want).scoped, true, "hashed id evidence");
  assert.equal(evaluateTokenPolicy({ ...rest, id_sha256: sha256Hex("x") }, want).scoped, false, "hashed id mismatch");
});

test("token policy: all-buckets, account-wide, other bucket, extra permission, wrong id, inactive are not scoped", () => {
  const withRes = (resources) => token({ policies: [{ ...token().policies[0], resources }] });
  const cases = {
    "all buckets": withRes({ [`com.cloudflare.api.account.${ACCT}`]: { "com.cloudflare.edge.r2.bucket.*": "*" } }),
    "account-wide": withRes({ [`com.cloudflare.api.account.${ACCT}`]: "*" }),
    "other bucket": withRes({ [`com.cloudflare.edge.r2.bucket.${ACCT}_default_other`]: "*" }),
    "two buckets": withRes({ [`com.cloudflare.edge.r2.bucket.${ACCT}_default_${BUCKET}`]: "*", [`com.cloudflare.edge.r2.bucket.${ACCT}_default_other`]: "*" }),
    "admin permission": token({ policies: [{ ...token().policies[0], permission_groups: [...token().policies[0].permission_groups, { name: "Workers R2 Storage Write" }] }] }),
    "read only": token({ policies: [{ ...token().policies[0], permission_groups: [{ name: "Workers R2 Storage Bucket Item Read" }] }] }),
    "wrong id": token({ id: "c".repeat(32) }),
    inactive: token({ status: "disabled" }),
    "deny effect": token({ policies: [{ ...token().policies[0], effect: "deny" }] }),
  };
  for (const [name, t] of Object.entries(cases)) assert.equal(evaluateTokenPolicy(t, want).scoped, false, name);
  assert.equal(evaluateTokenPolicy(null, want).scoped, false);
});
