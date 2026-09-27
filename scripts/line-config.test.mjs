// Run: node --test scripts/line-config.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LINE_OA_ID, lineOaIdFromUrl, lineOaMessageUrl, lineProfileUrl } from "../lib/config/line.mjs";

test("parses the LINE ID from the site's configured URL forms", () => {
  assert.equal(lineOaIdFromUrl("https://line.me/R/ti/p/@954fyicw"), "@954fyicw");
  assert.equal(lineOaIdFromUrl("https://line.me/R/ti/p/%40954fyicw"), "@954fyicw");
  assert.equal(lineOaIdFromUrl("https://line.me/ti/p/@954fyicw?from=page"), "@954fyicw");
  assert.equal(lineOaIdFromUrl("https://line.me/R/oaMessage/%40954fyicw/?hi"), "@954fyicw");
  assert.equal(lineOaIdFromUrl(""), null);
  assert.equal(lineOaIdFromUrl("https://example.com/@954fyicw"), null);
  assert.equal(lineOaIdFromUrl("https://line.me/R/ti/p/@<script>"), null);
});

test("default account is the one the public site links to", () => {
  assert.equal(DEFAULT_LINE_OA_ID, "@954fyicw");
});

test("oaMessage URL encodes the ID and the text exactly once", () => {
  const url = lineOaMessageUrl("你好 & #1\n第二行", "@954fyicw");
  assert.ok(url.startsWith("https://line.me/R/oaMessage/%40954fyicw/?"));
  const u = new URL(url);
  assert.equal(decodeURIComponent(u.search.slice(1)), "你好 & #1\n第二行");
  assert.equal(u.hash, "");
  assert.equal(lineOaMessageUrl("  ", "@954fyicw"), lineProfileUrl("@954fyicw"));
});
