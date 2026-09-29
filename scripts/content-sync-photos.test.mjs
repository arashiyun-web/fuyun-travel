// Run: node --test scripts/content-sync-photos.test.mjs
// Every photo of a synced/submitted post must survive into /highlights (lib/content-sync/photos.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const photos = jiti("@/lib/content-sync/photos");

test("collects explicit images, full_picture and Facebook attachment/sub-attachment images, deduplicated in order", () => {
  const raw = {
    images: ["https://fuyuntravel.com/images/featured-spots/a.png", "https://fuyuntravel.com/images/featured-spots/b.png"],
    full_picture: "https://fuyuntravel.com/images/featured-spots/a.png",
    attachments: { data: [{ media: { image: { src: "https://scontent.example/c.jpg" } }, subattachments: { data: [{ media: { image: { src: "https://scontent.example/d.jpg" } } }, { media: { image: { src: "https://scontent.example/c.jpg" } } }] } }] },
  };
  assert.deepEqual(photos.collectPhotoUrls(raw), [
    "https://fuyuntravel.com/images/featured-spots/a.png",
    "https://fuyuntravel.com/images/featured-spots/b.png",
    "https://scontent.example/c.jpg",
    "https://scontent.example/d.jpg",
  ]);
});

test("a legacy single full_picture still works; empty or odd payloads give no photos", () => {
  assert.deepEqual(photos.collectPhotoUrls({ full_picture: "https://x.example/p.jpg" }), ["https://x.example/p.jpg"]);
  assert.deepEqual(photos.collectPhotoUrls(null), []);
  assert.deepEqual(photos.collectPhotoUrls({ attachments: "nope", images: [1, null] }), []);
});

test("only https URLs or site image paths are kept, at most 10", () => {
  const list = ["javascript:alert(1)", "http://insecure.example/x.jpg", "/images/featured-spots/ok.png", "https://ok.example/y.jpg", "data:image/png;base64,AAA", "//evil.example/z.jpg", "/api/secret"];
  assert.deepEqual(photos.cleanPhotoUrls(list), ["/images/featured-spots/ok.png", "https://ok.example/y.jpg"]);
  assert.equal(photos.cleanPhotoUrls(Array.from({ length: 15 }, (_, i) => `https://ok.example/${i}.jpg`)).length, 10);
});

test("merges an admin-chosen cover with the source post's other photos (cover first, no duplicates)", () => {
  const source = { images: ["https://a.example/1.jpg", "https://a.example/2.jpg", "https://a.example/3.jpg"] };
  assert.deepEqual(photos.mergePhotoUrls("https://a.example/2.jpg", [], source), ["https://a.example/2.jpg", "https://a.example/1.jpg", "https://a.example/3.jpg"]);
  assert.deepEqual(photos.mergePhotoUrls(undefined, ["https://b.example/x.jpg"], null), ["https://b.example/x.jpg"]);
});

test("source URL must be https (Facebook or the site); anything else is dropped", () => {
  assert.equal(photos.cleanSourceUrl("https://www.facebook.com/groups/2875144269218828/posts/1"), "https://www.facebook.com/groups/2875144269218828/posts/1");
  assert.equal(photos.cleanSourceUrl("javascript:alert(1)"), null);
  assert.equal(photos.cleanSourceUrl("http://www.facebook.com/x"), null);
  assert.equal(photos.cleanSourceUrl(""), null);
});
