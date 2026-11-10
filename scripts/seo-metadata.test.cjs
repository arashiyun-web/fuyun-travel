// Run: node --test scripts/seo-metadata.test.cjs
// hreflang 與 sitemap 只能列出實際存在的網址。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mock, load } = require('./test-support/step2-load-ts.cjs');

// sitemap 的已發布文章來自資料庫；這裡只驗靜態清單，不連資料庫。
mock('@/lib/dynamicTravelArticles', { listPublishedTravelArticles: async () => [] });

const root = path.resolve(__dirname, '..');
const site = load('lib/site.ts');
const { explorePageMeta } = load('lib/travelExplore.ts');
const sitemap = load('app/sitemap.ts').default;

const ORIGIN = site.SITE.url;
const LOCALES = ['zh', 'zh-tw', 'en', 'ja', 'ko', 'ms', 'vi', 'th'];
const ENTRY_PATHS = LOCALES.map((locale) => `/${locale}`);
const NESTED_LOCALE = new RegExp(`^/(${LOCALES.join('|')})/.+`);

const pathOf = (url) => new URL(url).pathname;
const meta = (pagePath) => site.pageMeta({ title: 't', path: pagePath });
const urlsOf = (metadata) => [metadata.alternates.canonical, ...Object.values(metadata.alternates.languages ?? {})];

test('site origin is the https production domain', () => {
  assert.match(ORIGIN, /^https:\/\/[^/]+$/);
});

test('every locale entry in lib/site.ts is a real app/<locale>/page.tsx with no nested routes', () => {
  assert.deepEqual([...site.LOCALE_ENTRY_PATHS].sort(), [...ENTRY_PATHS].sort());
  for (const entryPath of site.LOCALE_ENTRY_PATHS) {
    const dir = path.join(root, 'app', entryPath.slice(1));
    assert.equal(fs.existsSync(path.join(dir, 'page.tsx')), true, `${entryPath} has no page.tsx`);
    const nested = fs.readdirSync(dir, { withFileTypes: true }).filter((item) => item.isDirectory());
    assert.deepEqual(nested, [], `${entryPath} unexpectedly has nested routes`);
  }
  const hreflangs = site.LOCALE_ENTRIES.map((entry) => entry.hreflang);
  assert.equal(new Set(hreflangs).size, hreflangs.length, 'duplicate hreflang key');
  assert.equal(hreflangs.filter((value) => value === 'zh-Hant').length, 1);
});

test('Chinese-only pages advertise only themselves', () => {
  const pages = ['/about', '/highlights', '/fleet', '/fleet/mercedes-van', '/services', '/contact/inquiry', '/travel/some-article', '/charter-bus/taipei'];
  for (const pagePath of pages) {
    const metadata = meta(pagePath);
    const self = `${ORIGIN}${pagePath}`;
    assert.equal(metadata.alternates.canonical, self);
    assert.deepEqual(metadata.alternates.languages, { 'zh-Hant': self, 'x-default': self });
    for (const url of urlsOf(metadata)) assert.doesNotMatch(pathOf(url), NESTED_LOCALE, `${pagePath} -> ${url}`);
  }
  const all = (pagePath) => urlsOf(meta(pagePath)).join(' ');
  assert.equal(all('/about').includes('/en/about'), false);
  assert.equal(all('/highlights').includes('/ja/highlights'), false);
  assert.equal(all('/fleet').includes('/zh-tw/fleet'), false);
});

test('locale entries list each other, never locale + path', () => {
  const allowed = new Set(['/', ...ENTRY_PATHS]);
  const expected = meta('/en').alternates.languages;
  for (const entryPath of ENTRY_PATHS) {
    const metadata = meta(entryPath);
    assert.equal(metadata.alternates.canonical, `${ORIGIN}${entryPath}`);
    assert.deepEqual(metadata.alternates.languages, expected, `${entryPath} alternates differ from /en`);
    const languagePaths = Object.values(metadata.alternates.languages).map(pathOf);
    for (const languagePath of languagePaths) assert.equal(allowed.has(languagePath), true, `${entryPath} -> ${languagePath}`);
    assert.equal(languagePaths.includes(entryPath), true, `${entryPath} does not list itself`);
  }
  assert.equal(expected['x-default'], `${ORIGIN}/`);
  assert.equal(expected['zh-Hant'], `${ORIGIN}/zh-tw`);
  assert.equal(expected.en, `${ORIGIN}/en`);
  const enUrls = urlsOf(meta('/en')).join(' ');
  assert.equal(enUrls.includes('/en/en'), false);
  assert.equal(enUrls.includes('/zh-tw/en'), false);
  // 入口清單裡的 8 個網址都要被列到。
  assert.deepEqual(Object.values(expected).map(pathOf).filter((value) => value !== '/').sort(), [...ENTRY_PATHS].sort());
});

test('home path shares the locale-entry alternates; trailing slash does not change the result', () => {
  const home = site.pageMeta({ title: 't' });
  assert.equal(home.alternates.canonical, `${ORIGIN}/`);
  assert.deepEqual(home.alternates.languages, meta('/en').alternates.languages);
  assert.deepEqual(meta('/en/').alternates.languages, meta('/en').alternates.languages);
  assert.deepEqual(Object.keys(meta('/about/').alternates.languages), ['zh-Hant', 'x-default']);
});

test('explorePageMeta still emits canonical only', () => {
  const metadata = explorePageMeta({ title: 't', path: '/knowledge' });
  assert.deepEqual(metadata.alternates, { canonical: `${ORIGIN}/knowledge` });
});

test('sitemap lists /highlights and no missing locale sub-paths', async () => {
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  const paths = urls.map(pathOf);
  for (const url of urls) assert.equal(url.startsWith(`${ORIGIN}/`), true, url);
  assert.equal(urls.filter((url) => url === `${ORIGIN}/highlights`).length, 1);
  assert.equal(paths.includes('/ai-test'), false);
  for (const sitemapPath of paths) assert.doesNotMatch(sitemapPath, NESTED_LOCALE);
  for (const expected of ['/', '/about', '/fleet', ...ENTRY_PATHS]) assert.equal(paths.includes(expected), true, expected);
  assert.equal(new Set(urls).size, urls.length, 'duplicate sitemap url');
});
