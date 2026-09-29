// Run: node --test scripts/inquiry-auth.test.mjs
// Regression guard for /api/inquiry: GET returned every inquiry (unmasked phone, LINE id) and PATCH
// changed any inquiry without authentication. The admin handlers must reject before touching the DB;
// POST stays public (the /contact/inquiry form).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app/api/inquiry/route.ts", import.meta.url), "utf8");
const firstStatement = (method) => {
  const m = src.match(new RegExp(`export async function ${method}\\(request: Request\\) \\{\\s*([^\\n]+)`));
  assert.ok(m, `${method} handler not found`);
  return m[1].trim();
};

test("GET /api/inquiry checks admin auth before anything else", () => {
  assert.equal(firstStatement("GET"), "if (!verifyAdminRequest(request)) return unauthorized();");
});

test("PATCH /api/inquiry checks admin mutation auth (same-origin cookie or bearer) first", () => {
  assert.equal(firstStatement("PATCH"), "if (!verifyAdminMutation(request)) return unauthorized();");
});

test("POST /api/inquiry stays public for the inquiry form", () => {
  assert.doesNotMatch(firstStatement("POST"), /verifyAdmin/);
});

test("guards come from the shared admin auth module", () => {
  assert.match(src, /import \{ unauthorized, verifyAdminMutation, verifyAdminRequest \} from "@\/lib\/adminQuoteAuth";/);
});
