// Run: node --test scripts/instagram-oauth-store.test.mjs
// Database cases run only when IG_TEST_DATABASE_URL points at an isolated Postgres with the
// operations migration applied (never production).
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  clearInstagramLoginToken,
  exchangeInstagramAuthorizationCode,
  inspectInstagramLoginToken,
  parseProviderJson,
  readInstagramLoginToken,
  resolveTokenStore,
  saveInstagramLoginToken,
} from "../lib/social/instagram-oauth.ts";
import { diagnoseInstaLoginConfig, diagnoseInstagramAuthorization } from "../lib/social/insta-diag.ts";

const key = Buffer.alloc(32, 9);
const BIG_ID = "17841400000000000123"; // > Number.MAX_SAFE_INTEGER
const token = (overrides = {}) => ({ accountId: BIG_ID, accessToken: "long-token-value", obtainedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(), scopes: ["instagram_business_basic"], ...overrides });

test("user_id larger than MAX_SAFE_INTEGER survives as the exact digit string", async () => {
  assert.ok(Number(BIG_ID) > Number.MAX_SAFE_INTEGER);
  assert.equal(parseProviderJson(`{"access_token":"t","user_id":${BIG_ID}}`).user_id, BIG_ID);
  assert.equal(parseProviderJson(`{"user_id":"${BIG_ID}"}`).user_id, BIG_ID);
  assert.notEqual(String(JSON.parse(`{"user_id":${BIG_ID}}`).user_id), BIG_ID, "plain JSON.parse would have rounded it");
  const transport = async (url) => url.includes("oauth/access_token")
    ? new Response(`{"access_token":"short","user_id":${BIG_ID},"permissions":["instagram_business_basic"]}`, { status: 200 })
    : new Response(`{"access_token":"long","token_type":"bearer","expires_in":5184000,"user_id":${BIG_ID}}`, { status: 200 });
  const result = await exchangeInstagramAuthorizationCode({ appId: "1711848906785861", appSecret: "s", redirectUri: "https://fuyuntravel.com/api/social/instagram/oauth/callback" }, "code", transport);
  assert.equal(result.accountId, BIG_ID);
});

test("malformed provider JSON is a provider error, not a crash", () => {
  assert.throws(() => parseProviderJson("not json"), /provider/);
  assert.throws(() => parseProviderJson("[1,2]"), /provider/);
});

test("token store resolution: database by default, file only off Vercel, malformed values rejected", () => {
  assert.deepEqual(resolveTokenStore({ DATABASE_URL: "postgresql://x" }), { kind: "database" });
  assert.deepEqual(resolveTokenStore({ DATABASE_URL: "postgresql://x", INSTAGRAM_LOGIN_TOKEN_STORE: "database" }), { kind: "database" });
  assert.throws(() => resolveTokenStore({}), /configuration/);
  assert.throws(() => resolveTokenStore({ INSTAGRAM_LOGIN_TOKEN_STORE: "   " }), /configuration/);
  assert.throws(() => resolveTokenStore({ INSTAGRAM_LOGIN_TOKEN_STORE: "data/token.json" }), /configuration/);
  assert.throws(() => resolveTokenStore({ INSTAGRAM_LOGIN_TOKEN_STORE: "file:/tmp/t\nx" }), /configuration/);
  assert.throws(() => resolveTokenStore({ INSTAGRAM_LOGIN_TOKEN_STORE: "file:/tmp/t.json", VERCEL: "1" }), /configuration/);
  assert.equal(resolveTokenStore({ INSTAGRAM_LOGIN_TOKEN_STORE: "file:/tmp/t.json" }).kind, "file");
});

test("file store: encrypted at rest, expiry reported, clear works", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ig-store-"));
  const store = { kind: "file", path: path.join(dir, "token.enc.json") };
  try {
    assert.equal((await inspectInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store })).status, "absent");
    await saveInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store }, token());
    const raw = await readFile(store.path, "utf8");
    assert.ok(!raw.includes("long-token-value") && !raw.includes(BIG_ID), "token and account id are not stored in clear");
    assert.equal((await readInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store })).accountId, BIG_ID);
    await saveInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store }, token({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    assert.equal((await inspectInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store })).status, "expired");
    assert.equal(await readInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store }), null);
    assert.equal(await clearInstagramLoginToken({ tokenStore: store }), true);
    assert.equal((await inspectInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store })).status, "absent");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const baseEnv = (extra) => ({
  INSTAGRAM_LOGIN_APP_ID: "1711848906785861",
  INSTAGRAM_LOGIN_APP_SECRET: "app-secret",
  INSTAGRAM_LOGIN_REDIRECT_URI: "https://fuyuntravel.com/api/social/instagram/oauth/callback",
  INSTAGRAM_LOGIN_STATE_SECRET: Buffer.alloc(32, 7).toString("hex"),
  INSTAGRAM_LOGIN_TOKEN_ENCRYPTION_KEY: key.toString("hex"),
  ...extra,
});

test("diagnostics: present-but-invalid token store is INVALID, not PASS", () => {
  const status = (env) => diagnoseInstaLoginConfig(env).fields.find((f) => f.field === "INSTAGRAM_LOGIN_TOKEN_STORE");
  assert.equal(status(baseEnv({ DATABASE_URL: "postgresql://x" })).status, "PASS");
  assert.equal(status(baseEnv({})).status, "INVALID");
  assert.equal(status(baseEnv({ INSTAGRAM_LOGIN_TOKEN_STORE: "bad\npath" })).status, "INVALID");
  assert.equal(status(baseEnv({ INSTAGRAM_LOGIN_TOKEN_STORE: "file:/tmp/x", VERCEL: "1" })).status, "INVALID");
  assert.equal(diagnoseInstaLoginConfig(baseEnv({})).overall, "FAIL");
  const serialized = JSON.stringify(diagnoseInstaLoginConfig(baseEnv({ DATABASE_URL: "postgresql://x" })));
  assert.ok(!serialized.includes("app-secret") && !serialized.includes(key.toString("hex")), "diagnostic never contains values");
});

test("authorization state: CONFIG_INCOMPLETE → NOT_AUTHORIZED → AUTHORIZED → EXPIRED → STORAGE_UNAVAILABLE", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ig-diag-"));
  const file = path.join(dir, "token.enc.json");
  const env = baseEnv({ INSTAGRAM_LOGIN_TOKEN_STORE: `file:${file}` });
  const store = { kind: "file", path: file };
  try {
    assert.equal((await diagnoseInstagramAuthorization(baseEnv({ INSTAGRAM_LOGIN_APP_ID: undefined }))).state, "CONFIG_INCOMPLETE");
    assert.equal((await diagnoseInstagramAuthorization(env)).state, "NOT_AUTHORIZED");
    await saveInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store }, token());
    const ok = await diagnoseInstagramAuthorization(env);
    assert.equal(ok.state, "AUTHORIZED");
    assert.ok(!JSON.stringify(ok).includes("long-token-value") && !JSON.stringify(ok).includes(BIG_ID));
    await saveInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store }, token({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    assert.equal((await diagnoseInstagramAuthorization(env)).state, "EXPIRED");
    await writeFile(file, "corrupted", "utf8");
    assert.equal((await diagnoseInstagramAuthorization(env)).state, "STORAGE_UNAVAILABLE");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("database store: shared durable token, encrypted column, clear", { skip: !process.env.IG_TEST_DATABASE_URL }, async () => {
  process.env.DATABASE_URL = process.env.IG_TEST_DATABASE_URL;
  const store = { kind: "database" };
  await clearInstagramLoginToken({ tokenStore: store });
  assert.equal((await inspectInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store })).status, "absent");
  await saveInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store }, token());
  const { prisma } = await import("../lib/prisma.ts");
  const row = await prisma.instagramLoginToken.findUnique({ where: { slot: "default" } });
  assert.equal(row.accountId, BIG_ID);
  assert.ok(!row.encrypted.includes("long-token-value"), "access token is not stored in clear");
  assert.equal((await readInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store })).accessToken, "long-token-value");
  assert.equal(await clearInstagramLoginToken({ tokenStore: store }), true);
  assert.equal((await inspectInstagramLoginToken({ tokenEncryptionKey: key, tokenStore: store })).status, "absent");
  await prisma.$disconnect();
});
