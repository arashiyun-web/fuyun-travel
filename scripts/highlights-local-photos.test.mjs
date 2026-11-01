// Run: node --test scripts/highlights-local-photos.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createRequire(import.meta.url)("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const photos = jiti("@/lib/content-sync/highlightsLocalPhotos");

const CARDS = [
  ["https://www.facebook.com/share/p/1dYpVHcB9L", 16, "/images/featured-spots/shitoushan-quanhua.webp"],
  ["https://www.facebook.com/share/p/19TLpfUWso", 12, "/images/featured-spots/daxi-jiucaihua.webp"],
  ["https://www.facebook.com/share/p/19UQ5TA1Do", 14, "/images/featured-spots/taiwan-design-expo.webp"],
  ["https://www.facebook.com/share/p/18YVA2Fj6n/", 10, "/images/featured-spots/toucheng-beiguan.webp"],
  ["https://www.facebook.com/share/p/1EmMcYm1yx/", 18, "/images/featured-spots/hsinchu-persimmon.webp"],
  ["https://www.facebook.com/share/p/19Ux8r6Epz/", 13, "/images/featured-spots/jiaoxi-wufengqi.webp"],
  ["https://www.facebook.com/share/p/1GPkUrqjnd/", 16, "/images/featured-spots/beipu-cold-spring.webp"],
  ["https://www.facebook.com/share/p/19VY97BbQP/", 16, "/images/featured-spots/luodong-forestry.webp"],
  ["https://www.facebook.com/share/p/1EniYST3Ci/", 15, "/images/featured-spots/hsinchu-military-village.webp"],
];

test("nine source links resolve to the committed webp sets, ignoring www, slash and query", () => {
  for (const [url, count, cover] of CARDS) {
    const list = photos.localPhotosForSource(url);
    assert.equal(list.length, count, url);
    assert.equal(list[0], cover);
    const withQuery = url.replace(/\/?$/, "") + "?ref=share";
    assert.deepEqual(photos.localPhotosForSource(withQuery), list);
    const bare = url.replace("https://www.", "http://");
    assert.deepEqual(photos.localPhotosForSource(bare), list);
  }
  assert.equal(photos.localPhotosForSource("https://www.facebook.com/share/p/1dypvhcb9l"), null);
  assert.equal(photos.localPhotosForSource("https://fuyuntravel.com/images/featured-spots/cihu-trail.png"), null);
  assert.equal(photos.localPhotosForSource(null), null);
});

test("every mapped file exists, is webp, and stays within 1600px", async () => {
  const seen = new Set();
  for (const [url] of CARDS) {
    for (const publicPath of photos.localPhotosForSource(url)) {
      assert.equal(seen.has(publicPath), false, publicPath);
      seen.add(publicPath);
      const file = path.join(root, "public", publicPath);
      assert.equal(fs.existsSync(file), true, publicPath);
      const meta = await sharp(file).metadata();
      assert.equal(meta.format, "webp");
      assert.ok(meta.width > 0 && meta.width <= 1600, publicPath);
      assert.ok(meta.height > 0 && meta.height <= 1600, publicPath);
    }
  }
  assert.equal(seen.size, 130);
});
