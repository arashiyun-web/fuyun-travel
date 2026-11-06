import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const gate = jiti("@/lib/operations/approvalGate");

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !name.endsWith(".test.mjs")) files.push(full);
  }
  return files;
}

test("only the operations owner action counts as approval", () => {
  assert.equal(gate.hasExplicitOwnerApproval({ status: "pending", approvedBy: null, approvedAt: null }), false);
  assert.equal(gate.hasExplicitOwnerApproval({ status: "approved", approvedBy: "cron", approvedAt: "2026-11-06T00:00:00.000Z" }), false);
  assert.equal(gate.hasExplicitOwnerApproval({ status: "approved", approvedBy: "operations-owner", approvedAt: null }), false);
  assert.equal(gate.hasExplicitOwnerApproval({ status: "approved", approvedBy: gate.OPERATIONS_OWNER_APPROVER, approvedAt: "2026-11-06T06:00:00.000Z" }), true);
  assert.equal(gate.hasOwnerApprovalEvent([{ type: "content_created", contentId: "c1" }], "c1"), false);
  assert.equal(gate.hasOwnerApprovalEvent([{ type: "content_approved", contentId: "c1" }], "c1"), true);
});

test("editing copy after approval returns every unsent job to pending review", () => {
  const content = {
    approval: { status: "approved", approvedAt: "2026-11-06T06:00:00.000Z", approvedBy: "operations-owner" },
    status: "approved",
    selectedPlatforms: ["website", "facebook_page"],
    platforms: {
      website: { caption: "原文", status: "queued", approvalHash: "abc", lastError: null },
      facebook_page: { caption: "原文粉專", status: "published", approvalHash: "def", lastError: null },
    },
  };
  const same = gate.reviseCaptionsAfterApproval(structuredClone(content), { website: "原文", facebook_page: "原文粉專" });
  assert.equal(same.reset, false);
  assert.equal(same.captionUpdated, false);

  const edited = structuredClone(content);
  const result = gate.reviseCaptionsAfterApproval(edited, { website: "改過的文案", facebook_page: "原文粉專" });
  assert.equal(result.reset, true);
  assert.equal(edited.approval.status, "pending");
  assert.equal(edited.approval.approvedBy, null);
  assert.equal(edited.status, "pending_approval");
  assert.equal(edited.platforms.website.caption, "改過的文案");
  assert.equal(edited.platforms.website.status, "pending_approval");
  assert.equal(edited.platforms.website.approvalHash, null);
  assert.equal(edited.platforms.facebook_page.status, "published");
  assert.equal(edited.platforms.facebook_page.caption, "原文粉專");
});

test("generate, distribute, content-sync, cron and the worker never approve or publish on their own", () => {
  const callers = [];
  const approvalWriters = [];
  for (const file of [...walk(path.join(root, "app")), ...walk(path.join(root, "lib")), ...walk(path.join(root, "scripts"))]) {
    const text = readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    if (text.includes("approveContent(") && !relative.startsWith(`lib${path.sep}operations${path.sep}`) && !relative.startsWith("lib/operations/")) {
      callers.push(relative);
    }
    if (/approvalStatus:\s*["']approved["']/.test(text) && !relative.includes(`${path.sep}operations${path.sep}`) && !relative.includes("/operations/")) {
      approvalWriters.push(relative);
    }
  }
  assert.deepEqual(callers, [path.join("app", "api", "operations", "content", "[id]", "approve", "route.ts")]);
  assert.deepEqual(approvalWriters, []);

  const featureAll = readFileSync(path.join(root, "app/api/content-sync/feature-all/route.ts"), "utf8");
  const featured = readFileSync(path.join(root, "app/api/featured-spots/route.ts"), "utf8");
  const select = readFileSync(path.join(root, "app/api/content-sync/select/route.ts"), "utf8");
  const factory = readFileSync(path.join(root, "app/api/content-factory/generate/route.ts"), "utf8");
  const save = readFileSync(path.join(root, "app/api/content-factory/save/route.ts"), "utf8");
  const social = readFileSync(path.join(root, "app/api/social/publish/route.ts"), "utf8");
  const due = readFileSync(path.join(root, "app/api/operations/process-due/route.ts"), "utf8");
  const worker = readFileSync(path.join(root, "scripts/operations-worker.mjs"), "utf8");
  assert.ok(featureAll.indexOf("ownerHasApprovedCopy") < featureAll.indexOf('status: "published"'));
  assert.ok(featured.indexOf("ownerHasApprovedCopy") < featured.indexOf('status: "published"'));
  assert.equal(select.includes("approveContent"), false);
  assert.equal(select.includes('status: "published"'), false);
  assert.equal(factory.includes("approveContent"), false);
  assert.equal(save.includes('status: "published"'), false);
  assert.match(save, /不能標成已核准或已發布/);
  assert.match(social, /410/);
  assert.equal(due.includes("approveContent"), false);
  assert.equal(worker.includes("approveContent"), false);
  assert.match(readFileSync(path.join(root, "lib/operations/dbStore.ts"), "utf8"), /approvedBy: OPERATIONS_OWNER_APPROVER/);
});
