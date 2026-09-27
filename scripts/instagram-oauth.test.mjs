import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  buildInstagramAuthorizationUrl,
  createInstagramOAuthState,
  exchangeInstagramAuthorizationCode,
  readInstagramLoginToken,
  saveInstagramLoginToken,
  verifyInstagramOAuthState,
} from "../lib/social/instagram-oauth.ts";

const stateSecret = Buffer.alloc(32, 7);

test("OAuth state is bound to the HttpOnly cookie and rejects tampering", () => {
  const created = createInstagramOAuthState({ stateSecret });
  assert.equal(created.state, created.cookieValue);
  assert.equal(verifyInstagramOAuthState(created.state, created.cookieValue, { stateSecret }), true);
  assert.throws(() => verifyInstagramOAuthState(`${created.state}x`, created.cookieValue, { stateSecret }), /Instagram OAuth: csrf/);
  assert.throws(() => verifyInstagramOAuthState(created.state, null, { stateSecret }), /Instagram OAuth: csrf/);
});

test("authorization URL contains only public OAuth parameters", () => {
  const url = buildInstagramAuthorizationUrl({ appId: "1711848906785861", redirectUri: "https://fuyuntravel.com/api/social/instagram/oauth/callback" }, "safe-state");
  assert.equal(new URL(url).hostname, "www.instagram.com");
  assert.equal(new URL(url).searchParams.get("client_id"), "1711848906785861");
  assert.equal(new URL(url).searchParams.get("response_type"), "code");
  assert.match(new URL(url).searchParams.get("scope") || "", /instagram_business_content_publish/);
  assert.ok(!url.includes("app-secret"));
});

test("official code exchange uses server-side secret and stores long-lived result shape", async () => {
  const calls = [];
  const transport = async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) return new Response(JSON.stringify({ access_token: "short-token", user_id: "123456" }), { status: 200 });
    return new Response(JSON.stringify({ access_token: "long-token", user_id: "123456", expires_in: 5184000 }), { status: 200 });
  };
  const result = await exchangeInstagramAuthorizationCode({
    appId: "1711848906785861",
    appSecret: "app-secret",
    redirectUri: "https://fuyuntravel.com/api/social/instagram/oauth/callback",
  }, "authorization-code", transport);
  assert.equal(result.accountId, "123456");
  assert.equal(result.accessToken, "long-token");
  assert.ok(Date.parse(result.expiresAt) > Date.now());
  assert.equal(calls.length, 2);
  assert.match(String(calls[0].init.body), /client_secret=app-secret/);
  assert.ok(!String(calls[0].url).includes("authorization-code"));
});

test("token store encrypts at rest and expired credentials are not returned", async () => {
  const temp = await mkdtemp(path.join(process.cwd(), ".tmp-instagram-oauth-"));
  const tokenPath = path.join(temp, "token.enc.json");
  const config = { tokenEncryptionKey: Buffer.alloc(32, 9), tokenStorePath: tokenPath };
  try {
    const token = { accountId: "123456", accessToken: "long-token", obtainedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), scopes: ["instagram_business_basic"] };
    await saveInstagramLoginToken(config, token);
    const raw = await readFile(tokenPath, "utf8");
    assert.ok(!raw.includes(token.accessToken));
    assert.deepEqual(await readInstagramLoginToken(config), token);
    const expired = { ...token, expiresAt: new Date(Date.now() - 1_000).toISOString() };
    await saveInstagramLoginToken(config, expired);
    assert.equal(await readInstagramLoginToken(config), null);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
