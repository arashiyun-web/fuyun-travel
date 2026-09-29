// Run: node --test scripts/ops/release-phase.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePhase, migrationChecks, backupChecks, envCheck, exitCodeFor, NEW_MIGRATIONS } from "./release-phase.mjs";

const statuses = (checks) => checks.map(([s]) => s);

test("phase is required and must be pre-release or pre-deploy", () => {
  assert.equal(parsePhase(["node", "x", "--phase", "pre-release"]), "pre-release");
  assert.equal(parsePhase(["node", "x", "--bucket", "b", "--phase", "pre-deploy"]), "pre-deploy");
  assert.throws(() => parsePhase(["node", "x"]), /--phase/);
  assert.throws(() => parsePhase(["node", "x", "--phase", "post-deploy"]), /--phase/);
  assert.throws(() => parsePhase(["node", "x", "--phase"]), /--phase/);
});

test("pre-release: 10 baseline migrations and no new ones → PASS", () => {
  assert.deepEqual(statuses(migrationChecks("pre-release", { done: 10, unfinished: 0, newer: "" })), ["PASS", "PASS"]);
});

test("pre-release: new migrations already applied → FAIL", () => {
  assert.ok(migrationChecks("pre-release", { done: 13, unfinished: 0, newer: NEW_MIGRATIONS.join(",") }).some(([s]) => s === "FAIL"));
});

test("pre-deploy: exactly 13 finished, the three new ones applied → PASS (review: old preflight failed here after step 4)", () => {
  assert.deepEqual(statuses(migrationChecks("pre-deploy", { done: 13, unfinished: 0, newer: NEW_MIGRATIONS.join(",") })), ["PASS", "PASS"]);
});

test("pre-deploy: not yet migrated, partial, unfinished or unexpected migration → FAIL", () => {
  const fails = (m) => migrationChecks("pre-deploy", m).some(([s]) => s === "FAIL");
  assert.ok(fails({ done: 10, unfinished: 0, newer: "" }));
  assert.ok(fails({ done: 12, unfinished: 0, newer: NEW_MIGRATIONS.slice(0, 2).join(",") }));
  assert.ok(fails({ done: 12, unfinished: 1, newer: NEW_MIGRATIONS.join(",") }));
  assert.ok(fails({ done: 14, unfinished: 0, newer: [...NEW_MIGRATIONS, "202609300001_unexpected"].join(",") }));
});

test("backup: PENDING before the release window, real check before deploy", () => {
  assert.deepEqual(statuses(backupChecks("pre-release", null)), ["PENDING"]);
  assert.deepEqual(statuses(backupChecks("pre-deploy", null)), ["FAIL"]);
  assert.deepEqual(statuses(backupChecks("pre-deploy", { file: "neon-prod-x.dump", ageH: 1, want: "ab", got: "ab" })), ["PASS", "PASS"]);
  assert.deepEqual(statuses(backupChecks("pre-deploy", { file: "neon-prod-x.dump", ageH: 30, want: "ab", got: "cd" })), ["FAIL", "FAIL"]);
});

test("Production env names: missing is PENDING before step 5, FAIL before deploy", () => {
  assert.equal(envCheck("pre-release", ["R2_BUCKET_NAME"])[0], "PENDING");
  assert.equal(envCheck("pre-deploy", ["R2_BUCKET_NAME"])[0], "FAIL");
  assert.equal(envCheck("pre-deploy", [])[0], "PASS");
});

test("exit code: PENDING allowed only in pre-release; FAIL/UNVERIFIED always block", () => {
  assert.equal(exitCodeFor("pre-release", ["PASS a", "PENDING b"]), 0);
  assert.equal(exitCodeFor("pre-deploy", ["PASS a", "PENDING b"]), 1);
  assert.equal(exitCodeFor("pre-release", ["PASS a", "UNVERIFIED b"]), 1);
  assert.equal(exitCodeFor("pre-release", ["FAIL a"]), 1);
  assert.equal(exitCodeFor("pre-deploy", ["PASS a", "PASS b"]), 0);
  assert.equal(exitCodeFor("pre-deploy", []), 1);
});
