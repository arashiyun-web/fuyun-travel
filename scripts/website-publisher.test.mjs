// Run: node --test scripts/website-publisher.test.mjs
// Website publishing of an approved operations job (lib/operations/websitePublisher.ts): deterministic slug,
// approved text kept verbatim, permanent image URLs served only for published articles, idempotent retries,
// and "published" only after the public page and every image were read back. No network, no DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const wp = jiti("@/lib/operations/websitePublisher");
const shared = jiti("@/lib/operations/shared");

const sha = (b) => createHash("sha256").update(b).digest("hex");
const img1 = Buffer.from("image-one");
const img2 = Buffer.from("image-two");
const input = {
  contentId: "FUYUN-20260929-ABCD1234",
  jobId: "FUYUN-20260929-ABCD1234:website:v1",
  title: "阿里山日出 & 奮起湖",
  type: "招生",
  tripDate: "2030-11-20",
  caption: "# 阿里山日出 & 奮起湖\n\n第一天上山看日出。\n第二天走奮起湖老街。\n\n出遊／預定出發日期：2030-11-20\n詢價請提供內容編號：FUYUN-20260929-ABCD1234",
  approvalHash: "a".repeat(64),
  images: [
    { key: "operations/FUYUN-20260929-ABCD1234/image-1.jpg", sha256: sha(img1), contentType: "image/jpeg", alt: "日出" },
    { key: "operations/FUYUN-20260929-ABCD1234/image-2.png", sha256: sha(img2), contentType: "image/png", alt: "老街" },
  ],
};

/** In-memory article table + a fake public site that renders like /travel/[slug] (React-escaped text). */
function fakeSite({ breakImage = false, dropBody = false } = {}) {
  const articles = new Map();
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  let upserts = 0;
  const deps = {
    siteUrl: "https://fuyuntravel.com",
    upsertPublishedArticle: async (data) => {
      upserts += 1;
      const existing = articles.get(data.slug);
      if (existing && existing.seoJson.operations.contentId !== data.seoJson.operations.contentId) throw new Error("slug owned by other content");
      const row = { id: existing?.id || `art_${articles.size + 1}`, ...data, status: "published", publishedAt: existing?.publishedAt || new Date() };
      articles.set(data.slug, row);
      return { id: row.id, slug: row.slug, status: row.status };
    },
    fetchText: async (url) => {
      const slug = new URL(url).pathname.split("/").pop();
      const a = articles.get(slug);
      if (!a || a.status !== "published") return { status: 404, text: "" };
      const imgs = a.seoJson.operations.images.map((_, i) => `<img src="/travel-media/${slug}/${i + 1}">`).join("");
      return { status: 200, text: `<h1>${esc(a.title)}</h1>${dropBody ? "" : `<p>${esc(a.content)}</p>`}${imgs}` };
    },
    fetchBytes: async (url) => {
      const [, , slug, n] = new URL(url).pathname.split("/");
      const a = articles.get(slug);
      if (!a || a.status !== "published") return { status: 404, body: Buffer.alloc(0) };
      const ref = a.seoJson.operations.images[Number(n) - 1];
      const body = ref.key.endsWith("1.jpg") ? img1 : img2;
      return { status: 200, body: breakImage && n === "2" ? Buffer.from("tampered") : body };
    },
  };
  return { deps, articles, upserts: () => upserts };
}

test("slug is deterministic per content and valid for /travel", () => {
  assert.equal(wp.websiteSlug("FUYUN-20260929-ABCD1234"), "trip-fuyun-20260929-abcd1234");
  assert.match(wp.websiteSlug("FUYUN-20260929-ABCD1234"), /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test("article body is the approved caption, only the duplicated title heading removed", () => {
  const body = wp.websiteArticleBody(input.caption, input.title);
  assert.equal(body, input.caption.split("\n").slice(2).join("\n"));
  assert.equal(wp.websiteArticleBody("no heading\ntext", "T"), "no heading\ntext");
});

test("publish writes one article with the approved text and permanent image paths, then verifies the public page", async () => {
  const site = fakeSite();
  const r = await wp.publishWebsiteArticle(input, site.deps);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.url, "https://fuyuntravel.com/travel/trip-fuyun-20260929-abcd1234");
  const a = site.articles.get("trip-fuyun-20260929-abcd1234");
  assert.equal(a.title, input.title);
  assert.equal(a.content, wp.websiteArticleBody(input.caption, input.title));
  assert.deepEqual(a.seoJson.operations.images.map((i) => i.sha256), input.images.map((i) => i.sha256));
  assert.equal(a.seoJson.operations.approvalHash, input.approvalHash);
  assert.deepEqual(r.imageUrls, ["https://fuyuntravel.com/travel-media/trip-fuyun-20260929-abcd1234/1", "https://fuyuntravel.com/travel-media/trip-fuyun-20260929-abcd1234/2"]);
});

test("retrying the same job reuses the same article (no duplicate)", async () => {
  const site = fakeSite();
  const a = await wp.publishWebsiteArticle(input, site.deps);
  const b = await wp.publishWebsiteArticle(input, site.deps);
  assert.equal(a.articleId, b.articleId);
  assert.equal(site.articles.size, 1);
});

test("not published when the public page lacks the approved text", async () => {
  const r = await wp.publishWebsiteArticle(input, fakeSite({ dropBody: true }).deps);
  assert.equal(r.ok, false);
  assert.match(r.reason, /內文|text/);
});

test("not published when a public image does not match the approved bytes", async () => {
  const r = await wp.publishWebsiteArticle(input, fakeSite({ breakImage: true }).deps);
  assert.equal(r.ok, false);
  assert.match(r.reason, /圖片|image/);
});

test("refuses a slug owned by other content", async () => {
  const site = fakeSite();
  await wp.publishWebsiteArticle(input, site.deps);
  const r = await wp.publishWebsiteArticle({ ...input, contentId: "OTHER", jobId: "OTHER:website:v1" }, { ...site.deps, upsertPublishedArticle: async (d) => site.deps.upsertPublishedArticle({ ...d, slug: "trip-fuyun-20260929-abcd1234" }) });
  assert.equal(r.ok, false);
});

test("public image lookup serves only listed images of published articles", () => {
  const article = { status: "published", seoJson: { operations: { images: input.images } } };
  assert.deepEqual(wp.publicImageRef(article, "1"), input.images[0]);
  assert.equal(wp.publicImageRef(article, "3"), null);
  assert.equal(wp.publicImageRef(article, "0"), null);
  assert.equal(wp.publicImageRef(article, "1x"), null);
  assert.equal(wp.publicImageRef({ ...article, status: "unpublished" }, "1"), null);
  assert.equal(wp.publicImageRef({ status: "published", seoJson: {} }, "1"), null);
});

test("executeJob: website publishes through the publisher in live mode and reports URL + article id", async () => {
  const prev = process.env.OPERATIONS_LIVE_PUBLISH_ENABLED;
  process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = "true";
  try {
    const job = { platform: "website", adapter: "website_article", caption: input.caption, factCheck: { ok: true } };
    const ok = await shared.executeJob(job, "live", { markSubmission: async () => {}, instagramImageUrls: async () => [], publishWebsite: async () => ({ ok: true, articleId: "art_1", url: "https://fuyuntravel.com/travel/x", imageUrls: [] }) });
    assert.deepEqual([ok.status, ok.externalId, ok.postUrl, ok.verification], ["published", "art_1", "https://fuyuntravel.com/travel/x", "verified"]);
    const failed = await shared.executeJob(job, "live", { markSubmission: async () => {}, instagramImageUrls: async () => [], publishWebsite: async () => ({ ok: false, reason: "公開頁尚未讀到內文" }) });
    assert.equal(failed.status, "retryable_failed");
    const none = await shared.executeJob(job, "live", { markSubmission: async () => {}, instagramImageUrls: async () => [] });
    assert.equal(none.status, "manual_required");
    const dry = await shared.executeJob(job, "dry-run", { markSubmission: async () => {}, instagramImageUrls: async () => [], publishWebsite: async () => { throw new Error("must not publish in dry run"); } });
    assert.equal(dry.status, "dry_run_verified");
  } finally {
    if (prev === undefined) delete process.env.OPERATIONS_LIVE_PUBLISH_ENABLED; else process.env.OPERATIONS_LIVE_PUBLISH_ENABLED = prev;
  }
});
