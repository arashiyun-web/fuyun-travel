// Run: node --test scripts/ops/migrate-status.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateMigrateStatus } from "./migrate-status.mjs";

const EXPECTED = ["202609280001_add_operations_tables", "202609280002_add_line_webhook_events"];
const pendingOut = (names) => `12 migrations found in prisma/migrations\n\nFollowing migrations have not yet been applied:\n${names.join("\n")}\n\nTo apply migrations in development run prisma migrate dev.`;

test("up to date → ok", () => {
  assert.equal(evaluateMigrateStatus({ status: 0, stdout: "Database schema is up to date!" }, EXPECTED).ok, true);
});

test("exit 1 with exactly the expected pending migrations → ok", () => {
  const r = evaluateMigrateStatus({ status: 1, stdout: pendingOut(EXPECTED) }, EXPECTED);
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual(r.pending.sort(), EXPECTED);
});

test("unreachable database, bad URL, missing prisma → not ok (review: status was never checked)", () => {
  assert.equal(evaluateMigrateStatus({ status: 1, stdout: "", stderr: "Error: P1001: Can't reach database server" }, EXPECTED).ok, false);
  assert.equal(evaluateMigrateStatus({ status: 1, stdout: "", stderr: "Error: P1000: Authentication failed" }, EXPECTED).ok, false);
  assert.equal(evaluateMigrateStatus({ status: 1, stdout: "", stderr: "'prisma' is not recognized" }, EXPECTED).ok, false);
  assert.equal(evaluateMigrateStatus({ status: null, stdout: "", stderr: "" }, EXPECTED).ok, false);
});

test("failed migration, extra or missing pending migration → not ok", () => {
  assert.equal(evaluateMigrateStatus({ status: 1, stdout: `Following migration have failed:\n${EXPECTED[0]}` }, EXPECTED).ok, false);
  assert.equal(evaluateMigrateStatus({ status: 1, stdout: pendingOut([...EXPECTED, "202609300001_unexpected"]) }, EXPECTED).ok, false);
  assert.equal(evaluateMigrateStatus({ status: 1, stdout: pendingOut([EXPECTED[0]]) }, EXPECTED).ok, false);
  assert.equal(evaluateMigrateStatus({ status: 0, stdout: "something else" }, EXPECTED).ok, false);
});
