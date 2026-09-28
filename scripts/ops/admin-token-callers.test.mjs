// Run: node --test scripts/ops/admin-token-callers.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkCallers, readCallers } from "./admin-token-callers.mjs";

const caller = (over = {}) => ({ checked: true, checkedBy: "operator", checkedAt: "2026-09-29T01:00:00Z", method: "grep ADMIN_ACCESS_TOKEN|admin_token in scripts and crontab", usesAdminAccessToken: false, usesQueryParam: false, readyForNewValue: true, ...over });

test("complete confirmation for GX10 and Hermes passes", () => {
  assert.equal(checkCallers({ gx10: caller(), hermes: caller() }).ok, true);
  assert.equal(checkCallers({ gx10: caller({ usesAdminAccessToken: true }), hermes: caller() }).ok, true);
});

test("missing record or a missing caller blocks", () => {
  assert.equal(checkCallers(null).ok, false);
  assert.equal(checkCallers({}).ok, false);
  assert.equal(checkCallers({ gx10: caller() }).ok, false, "hermes missing");
  assert.equal(checkCallers({ hermes: caller() }).ok, false, "gx10 missing");
});

test("incomplete or unsafe entries block", () => {
  const cases = {
    "not checked": caller({ checked: false }),
    "checked as string": caller({ checked: "yes" }),
    "no checker": caller({ checkedBy: " " }),
    "no method": caller({ method: "" }),
    "bad date": caller({ checkedAt: "soon" }),
    "unknown usage": caller({ usesAdminAccessToken: undefined }),
    "query param": caller({ usesQueryParam: true }),
    "query param unknown": caller({ usesQueryParam: undefined }),
    "uses token, not ready": caller({ usesAdminAccessToken: true, readyForNewValue: false }),
  };
  for (const [name, c] of Object.entries(cases)) assert.equal(checkCallers({ gx10: c, hermes: caller() }).ok, false, name);
});

test("readCallers: absent or malformed file blocks", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "callers-"));
  try {
    assert.equal(readCallers(path.join(dir, "none.json")).ok, false);
    writeFileSync(path.join(dir, "bad.json"), "{not json");
    assert.equal(readCallers(path.join(dir, "bad.json")).ok, false);
    writeFileSync(path.join(dir, "ok.json"), JSON.stringify({ gx10: caller(), hermes: caller() }));
    assert.equal(readCallers(path.join(dir, "ok.json")).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
