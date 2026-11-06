import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const spots = jiti("@/lib/content-sync/featuredSpotApproval");

test("only a draft with the exact approved title and body is published to highlights", () => {
  const title = "九份";
  const body = "老街與山城夜景。";
  const exact = spots.featuredDraftPublishWhere(title, body);
  assert.deepEqual(exact, { status: "draft", title, description: body });
  assert.notDeepEqual(spots.featuredDraftPublishWhere(`${title} `, body), exact);
  assert.notDeepEqual(spots.featuredDraftPublishWhere(title, `${body}\n`), exact);
  assert.equal(spots.featuredDraftPublishWhere("", body), null);
  assert.equal(spots.featuredDraftPublishWhere(title, ""), null);
});

test("withdrawing approval unpublishes that exact card and nothing else", () => {
  const title = "九份";
  const body = "老街與山城夜景。";
  const exact = spots.featuredSpotUnpublishWhere(title, body);
  assert.deepEqual(exact, { status: "published", title, description: body });
  assert.notDeepEqual(spots.featuredSpotUnpublishWhere("九份夜景", body), exact);
  assert.notEqual(spots.featuredDraftPublishWhere(title, body).status, exact.status);
});

test("highlights follow approval immediately; social and travel stay behind the live switch", () => {
  const helper = readFileSync(path.join(root, "lib/content-sync/featuredSpotApproval.ts"), "utf8");
  const store = readFileSync(path.join(root, "lib/operations/dbStore.ts"), "utf8");
  const execute = readFileSync(path.join(root, "lib/operations/shared.ts"), "utf8");
  const due = readFileSync(path.join(root, "app/api/operations/process-due/route.ts"), "utf8");
  assert.equal(helper.includes("OPERATIONS_LIVE_PUBLISH_ENABLED"), false);
  assert.match(store, /publishApprovedFeaturedDrafts\(title, body\)/);
  assert.match(store, /unpublishFeaturedSpots\(copy\.title, copy\.body\)/);
  assert.equal(due.includes("publishApprovedFeaturedDrafts"), false);
  assert.match(execute, /OPERATIONS_LIVE_PUBLISH_ENABLED !== "true"/);
});
