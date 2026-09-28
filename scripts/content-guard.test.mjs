// Run: node --test scripts/content-guard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvalHash, composeDraft, isApprovalValid, renderFactsBlock, validateGenerated } from "../lib/operations/contentGuard.mjs";

const NOW = new Date("2026-09-27T12:00:00+08:00");
const TAIPEI_42 = {
  version: "faq-2026-09-15-v1",
  product: "台北一日遊",
  vehicle: "42 人座大巴",
  price: { amount: 14000, currency: "TWD", unit: "per_vehicle" },
  durationHours: 10,
  includes: [],
  excludes: ["餐食", "門票", "住宿"],
  dates: [],
  seats: null,
  validUntil: "2026-12-31",
};
const codes = (r) => r.violations.map((v) => v.code);

test("regression: round-4 recruitment hallucination is blocked", () => {
  const text = readFileSync(new URL("./fixtures/qwen3-4b-instruct-recruit-hallucination.txt", import.meta.url), "utf8");
  const r = validateGenerated(text, null, NOW);
  assert.equal(r.ok, false);
  for (const c of ["AMOUNT_NOT_APPROVED", "INCLUDE_NOT_APPROVED", "YEAR_NOT_APPROVED", "HOURS_NOT_APPROVED"]) assert.ok(codes(r).includes(c), `missing ${c}: ${JSON.stringify(r.violations)}`);
  assert.ok(r.violations.some((v) => v.detail.includes("住宿")));
  assert.ok(r.violations.some((v) => v.detail.includes("早餐") || v.detail.includes("午餐") || v.detail.includes("晚餐") || v.detail.includes("餐")));
});

test("unknown price: any amount without approved facts is a violation", () => {
  const r = validateGenerated("9 人座台中到墾丁三天兩夜大約 25000 元。", null, NOW);
  assert.deepEqual(codes(r), ["AMOUNT_NOT_APPROVED"]);
  assert.equal(validateGenerated("價格待確認，請私訊由專人報價。", null, NOW).ok, true);
});

test("request to guess a price is still blocked", () => {
  const r = validateGenerated("一般行情大概 NT$18,000 左右，實際以報價為準。", TAIPEI_42, NOW);
  assert.ok(codes(r).includes("AMOUNT_NOT_APPROVED"));
});

test("approved per-vehicle price passes; per-person wording fails", () => {
  assert.equal(validateGenerated("台北一日遊 42 人座大巴 14,000 元，含 10 小時用車。", TAIPEI_42, NOW).ok, true);
  const r = validateGenerated("台北一日遊只要 14,000 元／人！", TAIPEI_42, NOW);
  assert.deepEqual(codes(r), ["PRICE_UNIT_MISMATCH"]);
});

test("claiming meals or lodging not in approved includes fails; negated mention passes", () => {
  assert.ok(codes(validateGenerated("費用含午餐與門票。", TAIPEI_42, NOW)).includes("INCLUDE_NOT_APPROVED"));
  assert.equal(validateGenerated("費用不含餐食、門票與住宿，需另行確認。", TAIPEI_42, NOW).ok, true);
});

test("expired or unversioned facts block and force human review", () => {
  const expired = { ...TAIPEI_42, validUntil: "2026-09-01" };
  assert.ok(codes(validateGenerated("台北一日遊。", expired, NOW)).includes("FACTS_EXPIRED"));
  const d = composeDraft({ modelText: "輕鬆遊台北。", templateText: "台北一日遊包車。", facts: expired, now: NOW });
  assert.equal(d.requiresHuman, true);
  assert.ok(d.text.includes("價格：待確認"), "expired price must not be rendered");
  assert.ok(codes(validateGenerated("x", { ...TAIPEI_42, version: "" }, NOW)).includes("FACTS_UNVERSIONED"));
});

test("dates and quota must come from approved facts", () => {
  const withDate = { ...TAIPEI_42, dates: ["2026-11-20"], seats: 40 };
  assert.equal(validateGenerated("2026-11-20 出發，名額 40 人。", withDate, NOW).ok, true);
  const r = validateGenerated("2026-11-21 出發，限額 30 人。", withDate, NOW);
  assert.ok(codes(r).includes("DATE_NOT_APPROVED"));
  assert.ok(codes(r).includes("QUOTA_NOT_APPROVED"));
});

test("composeDraft falls back to template and never auto-approves", () => {
  const bad = composeDraft({ modelText: "只要 9,999 元含住宿！", templateText: "台北一日遊包車，九份老街漫步。", facts: TAIPEI_42, now: NOW });
  assert.equal(bad.source, "template_fallback");
  assert.equal(bad.status, "pending_approval");
  assert.ok(!bad.text.includes("9,999"));
  assert.ok(bad.text.includes("14,000 元（每車，含 10 小時用車）"));
  const good = composeDraft({ modelText: "九份山城與十分老街，一天走訪北台灣經典。", templateText: "t", facts: TAIPEI_42, now: NOW, allowedPlaces: ["九份", "十分"] });
  assert.equal(good.source, "model");
  assert.equal(good.requiresHuman, false);
  assert.equal(good.status, "pending_approval");
});

test("facts block renders missing fields as 待確認", () => {
  const block = renderFactsBlock({ version: "v1", price: null, dates: [], includes: [] });
  assert.ok(block.includes("價格：待確認"));
  assert.ok(block.includes("費用包含：待確認"));
});

test("approval is bound to exact content; any change invalidates it", () => {
  const content = { text: "台北一日遊", imageSha256s: ["b", "a"], platform: "instagram", account: "fuyuntravel", factsVersion: "v1" };
  const approval = { hash: approvalHash(content) };
  assert.equal(isApprovalValid(approval, { ...content, imageSha256s: ["a", "b"] }), true);
  assert.equal(isApprovalValid(approval, { ...content, text: "台北一日遊！" }), false);
  assert.equal(isApprovalValid(approval, { ...content, imageSha256s: ["a", "c"] }), false);
  assert.equal(isApprovalValid(approval, { ...content, account: "other" }), false);
  assert.equal(isApprovalValid(approval, { ...content, factsVersion: "v2" }), false);
  assert.equal(isApprovalValid({}, content), false);
});

test("regression (live 2026-09-27): refusal, invented stops and overlong text fall back to template", () => {
  const refusal = composeDraft({ modelText: "抱歉，我無法提供您所要求的內容。", templateText: "阿里山日出二日遊招募中。", facts: null, now: NOW, allowedPlaces: ["阿里山"] });
  assert.equal(refusal.source, "template_fallback");
  assert.ok(refusal.violations.some((v) => v.code === "MODEL_REFUSAL"));
  // PR #33 review: "作為 AI" with whitespace must hit the refusal branch on its own (no other refusal phrase).
  for (const modelText of ["作為 AI，我不能回答這個問題。", "作為一個 AI 語言模型，我不能回答。", "作為AI，我不能回答。"]) {
    const r = composeDraft({ modelText, templateText: "阿里山日出二日遊招募中。", facts: null, now: NOW, allowedPlaces: ["阿里山"] });
    assert.equal(r.source, "template_fallback", modelText);
    assert.ok(r.violations.some((v) => v.code === "MODEL_REFUSAL"), modelText);
  }
  const invented = "42人座大巴駛出台北車站，抵達第一站陽明山，接著前往大安森林公園，午後抵達信義，傍晚到士林夜市。";
  const d = composeDraft({ modelText: invented, templateText: "台北一日遊 42 人座大巴包車。", facts: TAIPEI_42, now: NOW, allowedPlaces: ["九份", "十分"] });
  assert.equal(d.source, "template_fallback");
  assert.deepEqual(d.violations.filter((v) => v.code === "PLACE_NOT_APPROVED").map((v) => v.detail.match(/「(.+)」/)[1]).sort(), ["信義", "士林夜市", "大安森林公園", "陽明山"].sort());
  const long = composeDraft({ modelText: "九份".repeat(100), templateText: "t", facts: TAIPEI_42, now: NOW, allowedPlaces: ["九份"] });
  assert.ok(long.violations.some((v) => v.code === "TOO_LONG"));
  const ok = composeDraft({ modelText: "晨起九份老街，午後十分老街，山風拂面。", templateText: "t", facts: TAIPEI_42, now: NOW, allowedPlaces: ["九份", "十分"] });
  assert.equal(ok.source, "model");
});
