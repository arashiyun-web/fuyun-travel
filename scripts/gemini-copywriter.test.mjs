import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const copy = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true })("@/lib/ai/copywriter");

function useGemini() {
  process.env.GEMINI_API_KEY = "gemini-test-key";
  process.env.GEMINI_MODEL = "gemini-test-model";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_MODEL_NAME;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
}

test("Gemini returns text, rejects errors and empty bodies, and times out", async () => {
  useGemini();
  const ok = await copy.generateCopy({ user: "寫一句" }, {
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers["x-goog-api-key"], "gemini-test-key");
      assert.equal(String(_url).includes("gemini-test-key"), false);
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "九份半天" }] } }] }) };
    },
  });
  assert.equal(ok, "九份半天");

  await assert.rejects(() => copy.generateCopy({ user: "寫一句" }, {
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "模型不存在 gemini-test-key" } }) }),
  }), (error) => {
    assert.equal(error.message.includes("gemini-test-key"), false);
    assert.match(error.message, /Gemini 回應 400/);
    return true;
  });

  await assert.rejects(() => copy.generateCopy({ user: "寫一句" }, {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "   " }] } }] }) }),
  }), /沒有回傳內容/);

  await assert.rejects(() => copy.generateCopy({ user: "寫一句" }, {
    timeoutMs: 5,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
  }), /逾時/);
});
