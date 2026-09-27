// Run: node --test scripts/admin-auth.test.mjs   (Node >= 23.6 strips TS types natively)
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes, scryptSync } from "node:crypto";

const auth = await import("../lib/adminAuth.ts");

const USER = "owner-test";
const PASSWORD = "correct horse battery staple";
const SECRET = randomBytes(32).toString("hex");

function configure() {
  const salt = randomBytes(16).toString("hex");
  process.env.ADMIN_USERNAME = USER;
  process.env.ADMIN_PASSWORD_SALT = salt;
  process.env.ADMIN_PASSWORD_HASH = scryptSync(PASSWORD, salt, 64).toString("hex");
  process.env.JWT_SECRET = SECRET;
}

function forge(payloadObject, key) {
  const payload = Buffer.from(JSON.stringify(payloadObject)).toString("base64url");
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return `Bearer ${payload}.${sig}`;
}

beforeEach(() => {
  for (const key of ["ADMIN_USERNAME", "ADMIN_PASSWORD_SALT", "ADMIN_PASSWORD_HASH", "JWT_SECRET"]) delete process.env[key];
});

test("rejects every login when admin settings are missing", async () => {
  assert.equal(auth.isAdminAuthConfigured(), false);
  assert.equal(await auth.validateAdminCredentials(USER, PASSWORD), false);
  assert.equal(await auth.validateAdminCredentials("", ""), false);
  assert.throws(() => auth.createAdminToken(), auth.AdminAuthNotConfiguredError);
});

test("accepts only the configured username and hashed password", async () => {
  configure();
  assert.equal(await auth.validateAdminCredentials(USER, PASSWORD), true);
  assert.equal(await auth.validateAdminCredentials(USER, "wrong-password"), false);
  assert.equal(await auth.validateAdminCredentials("someone-else", PASSWORD), false);
  assert.equal(await auth.validateAdminCredentials(USER, undefined), false);
});

test("rejects a short signing secret instead of falling back", () => {
  configure();
  process.env.JWT_SECRET = "too-short";
  assert.equal(auth.isAdminAuthConfigured(), false);
  assert.throws(() => auth.createAdminToken(), auth.AdminAuthNotConfiguredError);
});

test("issued token verifies; tampered token does not", () => {
  configure();
  const token = auth.createAdminToken();
  assert.deepEqual(auth.verifyAdminToken(`Bearer ${token}`), { username: USER, role: "Admin" });
  const [payload, sig] = token.split(".");
  assert.equal(auth.verifyAdminToken(`Bearer ${payload}.${sig.slice(0, -2)}xx`), null);
  assert.equal(auth.verifyAdminToken(token), null, "missing Bearer prefix");
  assert.equal(auth.verifyAdminToken(null), null);
});

test("rejects legacy tokens without the version claim even with the current key", () => {
  configure();
  const legacy = forge({ username: USER, role: "Admin", exp: Date.now() + 60_000 }, SECRET);
  assert.equal(auth.verifyAdminToken(legacy), null);
});

test("rejects tokens signed with any other key (e.g. the old exposed fallback)", () => {
  configure();
  const oldKeySigned = forge({ v: 2, username: USER, role: "Admin", exp: Date.now() + 60_000 }, "some-old-leaked-key");
  assert.equal(auth.verifyAdminToken(oldKeySigned), null);
});

test("tokens stop verifying after the signing secret is rotated", () => {
  configure();
  const token = auth.createAdminToken();
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  assert.equal(auth.verifyAdminToken(`Bearer ${token}`), null);
});

test("rejects expired tokens and tokens for a different username", () => {
  configure();
  assert.equal(auth.verifyAdminToken(forge({ v: 2, username: USER, role: "Admin", exp: Date.now() - 1 }, SECRET)), null);
  assert.equal(auth.verifyAdminToken(forge({ v: 2, username: "other", role: "Admin", exp: Date.now() + 60_000 }, SECRET)), null);
});

const COOKIE = auth.ADMIN_COOKIE_NAME;
const req = (headers, url = "https://fuyuntravel.com/api/x") => new Request(url, { method: "POST", headers });

test("cookie session: valid token accepted, old-key or legacy token rejected", () => {
  configure();
  const token = auth.createAdminToken();
  assert.deepEqual(auth.verifyAdminRequest(req({ cookie: `${COOKIE}=${encodeURIComponent(token)}` })), { username: USER, role: "Admin" });
  const oldKey = forge({ v: 2, username: USER, role: "Admin", exp: Date.now() + 60_000 }, "some-old-leaked-key").slice(7);
  assert.equal(auth.verifyAdminRequest(req({ cookie: `${COOKIE}=${oldKey}` })), null);
  const legacy = forge({ username: USER, role: "Admin", exp: Date.now() + 60_000 }, SECRET).slice(7);
  assert.equal(auth.verifyAdminRequest(req({ cookie: `${COOKIE}=${legacy}` })), null);
  assert.equal(auth.verifyAdminRequest(req({})), null);
});

test("cookie session is rejected when admin settings are missing", () => {
  configure();
  const token = auth.createAdminToken();
  delete process.env.JWT_SECRET;
  assert.equal(auth.verifyAdminRequest(req({ cookie: `${COOKIE}=${token}` })), null);
});

test("cookie-authenticated mutation requires same origin; bearer does not", () => {
  configure();
  const token = auth.createAdminToken();
  const cookie = `${COOKIE}=${token}`;
  assert.ok(auth.verifyAdminMutationRequest(req({ cookie, origin: "https://fuyuntravel.com" })));
  assert.equal(auth.verifyAdminMutationRequest(req({ cookie, origin: "https://evil.example" })), null);
  assert.equal(auth.verifyAdminMutationRequest(req({ cookie })), null);
  assert.ok(auth.verifyAdminMutationRequest(req({ authorization: `Bearer ${token}` })));
});

test("sessions are revoked when any admin setting is removed (fail closed)", async () => {
  configure();
  const token = auth.createAdminToken();
  assert.ok(auth.verifyAdminToken(`Bearer ${token}`));
  delete process.env.ADMIN_PASSWORD_HASH;
  assert.equal(auth.verifyAdminToken(`Bearer ${token}`), null);
  configure();
  delete process.env.ADMIN_PASSWORD_SALT;
  assert.equal(auth.verifyAdminRequest(req({ cookie: `${COOKIE}=${token}` })), null);
});

test("same-origin check uses the addressed host (Host / x-forwarded-host), not an internal request.url host", () => {
  const internal = (headers) => new Request("http://localhost:3000/api/x", { method: "POST", headers });
  assert.equal(auth.isSameOriginRequest(internal({ host: "127.0.0.1:3260", origin: "http://127.0.0.1:3260" })), true);
  assert.equal(auth.isSameOriginRequest(internal({ host: "fuyuntravel.com", "x-forwarded-host": "fuyuntravel.com", "x-forwarded-proto": "https", origin: "https://fuyuntravel.com" })), true);
  assert.equal(auth.isSameOriginRequest(internal({ host: "fuyuntravel.com", "x-forwarded-proto": "https", origin: "https://evil.example" })), false);
  assert.equal(auth.isSameOriginRequest(internal({ host: "fuyuntravel.com", "x-forwarded-proto": "https", origin: "http://fuyuntravel.com" })), false);
  assert.equal(auth.isSameOriginRequest(internal({ host: "fuyuntravel.com" })), false);
});
