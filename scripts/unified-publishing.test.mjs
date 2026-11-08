import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });

test("copy provider prefers Gemini, then Anthropic, then OpenAI, and refuses when none is complete", () => {
  const copy = jiti("@/lib/ai/copywriter");
  const keys = ["GEMINI_API_KEY", "GEMINI_MODEL", "ANTHROPIC_API_KEY", "AI_MODEL_NAME", "OPENAI_API_KEY", "OPENAI_MODEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  process.env.ANTHROPIC_API_KEY = "anthropic-test";
  process.env.AI_MODEL_NAME = "claude-test";
  process.env.OPENAI_API_KEY = "openai-test";
  process.env.OPENAI_MODEL = "gpt-test";
  assert.equal(copy.selectedCopyProvider(), "anthropic");
  process.env.GEMINI_API_KEY = "gemini-test";
  process.env.GEMINI_MODEL = "gemini-model";
  assert.equal(copy.selectedCopyProvider(), "gemini");
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_MODEL_NAME;
  assert.equal(copy.selectedCopyProvider(), "openai");
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  assert.throws(() => copy.selectedCopyProvider(), /GEMINI_API_KEY/);
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("X OAuth 1.0a header is signed with the user token and does not echo secrets in the clear", () => {
  const oauth = jiti("@/lib/social/xOauth");
  const header = oauth.buildOauth1Header("POST", "https://api.twitter.com/2/tweets", {
    apiKey: "consumer-key",
    apiSecret: "consumer-secret",
    accessToken: "user-token",
    accessSecret: "user-secret",
  });
  assert.match(header, /^OAuth /);
  assert.match(header, /oauth_signature="/);
  assert.match(header, /oauth_token="user-token"/);
  assert.doesNotMatch(header, /consumer-secret/);
  assert.doesNotMatch(header, /user-secret/);
  const source = readFileSync(path.join(root, "lib/social/xOauth.ts"), "utf8");
  assert.equal(source.includes("X_BEARER_TOKEN"), false);
  assert.match(source, /X_ACCESS_TOKEN/);
});

test("worker auth accepts CRON_SECRET and OPERATIONS_CRON_TOKEN, and rejects a wrong bearer", () => {
  const auth = jiti("@/lib/operations/auth");
  const previous = { OPERATIONS_CRON_TOKEN: process.env.OPERATIONS_CRON_TOKEN, CRON_SECRET: process.env.CRON_SECRET };
  process.env.OPERATIONS_CRON_TOKEN = "ops-token";
  process.env.CRON_SECRET = "cron-token";
  const call = (token) => auth.verifyOperationsWorkerRequest(new Request("http://local/api/operations/process-due", { headers: { authorization: `Bearer ${token}` } }));
  assert.equal(call("ops-token"), true);
  assert.equal(call("cron-token"), true);
  assert.equal(call("nope"), false);
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("health report is booleans and names only", () => {
  const health = jiti("@/lib/admin/publishingHealth");
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_MODEL_NAME;
  process.env.OPENAI_API_KEY = "secret-value";
  process.env.OPENAI_MODEL = "gpt-test";
  process.env.X_BEARER_TOKEN = "bearer-secret";
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "false";
  process.env.GEMINI_API_KEY = "false";
  process.env.GEMINI_MODEL = "false";
  const report = health.publishingHealth();
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("secret-value"), false);
  assert.equal(serialized.includes("bearer-secret"), false);
  assert.equal(report.scheduler.livePublish, false);
  assert.equal(report.copywriting.selected, "openai");
  assert.deepEqual(report.copywriting.missing, []);
  assert.equal(report.copywriting.functionalCheck, "not_tested");
  assert.equal(report.copywriting.authorizationCheck, "not_tested");
  assert.equal(report.x.authorizationCheck, "not_tested");
  assert.match(serialized, /"name":"OPENAI_API_KEY","set":true/);
  assert.match(serialized, /"name":"GEMINI_API_KEY","set":false/);
  assert.match(serialized, /"notUsed":\["X_BEARER_TOKEN"\]/);
  assert.match(serialized, /"optional":\["R2_ENDPOINT"\]/);
  delete process.env.X_BEARER_TOKEN;
  delete process.env.OPERATIONS_LIVE_PUBLISH_ENABLED;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});
