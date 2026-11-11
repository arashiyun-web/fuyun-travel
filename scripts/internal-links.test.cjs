const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const load = createRequire(path.join(root, 'package.json'))('jiti')(__filename, {
  alias: { '@': root },
  interopDefault: true,
});

const { SITEMAP_PATHS, SITE_ORIGIN, canonicalizeSitePath, findBestPage, formatInternalPagesForPrompt, isSitemapPath, toCanonicalUrl } = load(path.join(root, 'lib/content-factory/internalPages.ts'));
const { resolveInternalHref, rewriteGeneratedContent, rewriteTextLinks } = load(path.join(root, 'lib/content-factory/rewriteInternalLinks.ts'));
const { normalizeGeneratedContent } = load(path.join(root, 'lib/content-factory/output.ts'));
const { buildSystemPrompt, buildUserMessage } = load(path.join(root, 'lib/content-factory/systemPrompt.ts'));

const LINE = 'https://line.me/R/ti/p/@954fyicw';

function sample(overrides = {}) {
  return {
    meta: { trip_title: '測試', generated_keywords: { primary: [], secondary: [], long_tail: [] }, missing_fields: [], internal_links: [] },
    geo_summary: '摘要',
    seo_article: { h1: '標題', body_markdown: '正文內容', faq: [] },
    facebook: { body: 'FB 文案', info_table: { 行程名稱: '', 天數: '', 適合族群: '', 季節特色: '' } },
    instagram: { caption: 'IG 文案', hashtags: [] },
    x: { body: '' },
    line_oa: 'LINE 文案',
    edm: { subject: '主旨', body: '信件' },
    extras: { gmb_short: '', ai_qa_block: [], ab_test: { fb: [], ig: [] } },
    json_ld: '{}',
    ...overrides,
  };
}

test('sitemap snapshot has 107 paths including locale variants', () => {
  assert.equal(SITEMAP_PATHS.size, 107);
  assert.equal(isSitemapPath('/charter-bus/taipei'), true);
  assert.equal(isSitemapPath('/charter/taipei'), false);
  assert.equal(isSitemapPath('/itineraries/1'), true);
});

test('canonicalize treats placeholders and same-site hosts', () => {
  assert.equal(canonicalizeSitePath('#').kind, 'placeholder');
  assert.equal(canonicalizeSitePath('').kind, 'placeholder');
  assert.equal(canonicalizeSitePath('待補連結').kind, 'placeholder');
  assert.equal(canonicalizeSitePath('#section').kind, 'placeholder');
  assert.deepEqual(canonicalizeSitePath('/charter-bus/taipei/'), { kind: 'internal', path: '/charter-bus/taipei' });
  assert.deepEqual(canonicalizeSitePath('https://www.fuyuntravel.com/service/day-tour'), { kind: 'internal', path: '/service/day-tour' });
  assert.deepEqual(canonicalizeSitePath('https://yunsun.com.tw/about'), { kind: 'internal', path: '/about' });
  assert.equal(canonicalizeSitePath(LINE).kind, 'external');
});

test('resolves official draft placeholders to existing pages', () => {
  const taipei = resolveInternalHref('#', '台北包車一日遊推薦');
  assert.equal(taipei.action, 'replace');
  assert.equal(taipei.href, toCanonicalUrl('/charter-bus/taipei'));

  const pending = resolveInternalHref('待補連結', '公司行號員工旅遊包車');
  assert.equal(pending.action, 'replace');
  assert.ok(['/service/corporate-trip', '/services/business-charter'].includes(pending.href.replace(SITE_ORIGIN, '')));

  const spring = resolveInternalHref('#', '更多溫泉景點包車方案');
  assert.equal(spring.action, 'replace');
  assert.equal(spring.href, toCanonicalUrl('/itineraries/1'));
});

test('keeps valid sitemap links and external line links', () => {
  const keep = resolveInternalHref('https://fuyuntravel.com/attractions/jiufen', '九份');
  assert.equal(keep.action, 'keep');
  assert.equal(keep.href, toCanonicalUrl('/attractions/jiufen'));
  const line = resolveInternalHref(LINE, '加入LINE');
  assert.equal(line.action, 'keep');
  assert.equal(line.href, LINE);
});

test('maps a non-existent path by relevance and strips unknown topics', () => {
  const mapped = resolveInternalHref('/charter/taipei', '台北包車');
  assert.equal(mapped.action, 'replace');
  assert.equal(mapped.href, toCanonicalUrl('/charter-bus/taipei'));

  const stripped = resolveInternalHref('#', '北極極光自助簽證教學');
  assert.equal(stripped.action, 'strip');
});

test('rewrites markdown placeholders and never leaves hash links', () => {
  const text = '想了解更多[台北包車一日遊推薦](#)或規劃[公司行號員工旅遊包車](待補連結)，也可看[不存在的北極行程](#)。官方：https://line.me/R/ti/p/@954fyicw';
  const out = rewriteTextLinks(text);
  assert.equal(out.includes('(#'), false);
  assert.equal(out.includes('待補連結'), false);
  assert.match(out, /\[台北包車一日遊推薦\]\(https:\/\/fuyuntravel\.com\/charter-bus\/taipei\)/);
  assert.match(out, /\[公司行號員工旅遊包車\]\(https:\/\/fuyuntravel\.com\/service\/(corporate-trip|business-charter)|\/services\/business-charter\)/);
  assert.match(out, /不存在的北極行程/);
  assert.equal(out.includes('[不存在的北極行程]'), false);
  assert.equal(out.includes(LINE), true);
});

test('normalizeGeneratedContent rewrites body and internal_links', () => {
  const generated = normalizeGeneratedContent({
    ...sample(),
    meta: {
      trip_title: '陽明山',
      generated_keywords: { primary: [], secondary: [], long_tail: [] },
      missing_fields: [],
      internal_links: [
        { anchor: '台北包車一日遊推薦', target: '待補連結' },
        { anchor: '公司行號員工旅遊包車', target: '#' },
      ],
    },
    seo_article: {
      h1: '陽明山一日包車',
      body_markdown: '想了解更多[台北包車一日遊推薦](待補連結)或規劃[公司行號員工旅遊包車](#)。也可參考[更多溫泉景點包車方案]()。',
      faq: [{ q: '還有別的嗎？', a: '可看[九份老街](/attractions/missing-jiufen)。' }],
    },
  });
  const body = generated.seo_article.body_markdown;
  assert.equal(body.includes('(#'), false);
  assert.equal(body.includes('待補連結'), false);
  assert.match(body, /https:\/\/fuyuntravel\.com\/charter-bus\/taipei/);
  assert.match(body, /https:\/\/fuyuntravel\.com\/itineraries\/1/);
  assert.match(generated.seo_article.faq[0].a, /https:\/\/fuyuntravel\.com\/attractions\/jiufen/);
  assert.ok(generated.meta.internal_links.length >= 2);
  for (const link of generated.meta.internal_links) {
    assert.ok(link.target.startsWith(SITE_ORIGIN), link.target);
    const path = link.target === SITE_ORIGIN + '/' ? '/' : link.target.slice(SITE_ORIGIN.length);
    assert.equal(isSitemapPath(path), true, link.target);
  }
});

test('prompt lists compact real paths and stays modest in size', () => {
  const prompt = buildSystemPrompt(LINE);
  const listed = formatInternalPagesForPrompt();
  assert.ok(listed.includes('/charter-bus/taipei 台北遊覽車包車'));
  assert.ok(listed.includes('/itineraries/1 陽明山繡球花與北投溫泉一日遊'));
  assert.ok(prompt.includes(listed));
  assert.equal(prompt.includes('標「待補連結」'), false);
  assert.ok(prompt.includes('禁止井號佔位'));
  // Previous prompt was 3659 characters. Keep the addition well under a few kilobytes.
  assert.ok(prompt.length < 3659 + 2500, `prompt grew too much: ${prompt.length}`);
  const input = buildUserMessage({
    trip_title: '【測試】一鍵生成驗收',
    days: '',
    season: '',
    price: '',
    spots: ['測試用：台北出發陽明山', '一日包車，賞芒草、泡溫泉'],
    user_notes: '測試用：台北出發陽明山一日包車，賞芒草、泡溫泉，請勿發布。',
    target_audience: '',
    additional_info: '',
    image_urls: [],
    cover_image_url: '',
  });
  assert.ok(input.includes('陽明山'));
});

test('rewriteGeneratedContent leaves untouched prose unchanged', () => {
  const original = sample();
  const rewritten = rewriteGeneratedContent(original);
  assert.deepEqual(rewritten.seo_article, original.seo_article);
  assert.equal(rewritten.facebook.body, original.facebook.body);
});
