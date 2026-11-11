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
const MULTILINGUAL_PATHS = ['/', ...ENTRY_PATHS];
const NESTED_LOCALE = new RegExp(`^/(${LOCALES.join('|')})/.+`);
const HREFLANG_KEYS = ['zh', 'zh-Hant', 'en', 'ja', 'ko', 'ms', 'vi', 'th', 'x-default'];

const pathOf = (url) => new URL(url).pathname;
const meta = (pagePath) => site.pageMeta({ title: 't', path: pagePath });
const urlsOf = (metadata) => [metadata.alternates.canonical, ...Object.values(metadata.alternates.languages ?? {})];

function expectedLanguages() {
  const languages = {};
  for (const entry of site.LOCALE_ENTRIES) languages[entry.hreflang] = `${ORIGIN}${entry.path}`;
  languages['x-default'] = `${ORIGIN}/`;
  return languages;
}

function collectPageFiles(dir, acc = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) collectPageFiles(full, acc);
    else if (item.name === 'page.tsx' && !item.name.startsWith('_')) acc.push(full);
  }
  return acc;
}

function routeFromPageFile(file) {
  const rel = path.relative(path.join(root, 'app'), path.dirname(file)).replace(/\\/g, '/');
  if (rel === '') return '/';
  const segments = rel.split('/').filter((seg) => !seg.startsWith('(') || !seg.endsWith(')'));
  return '/' + segments.join('/');
}

function isBackupPage(file) {
  return path.basename(file).startsWith('_') || file.includes('/_');
}

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

test('Chinese-only pages have self canonical and no hreflang or x-default', () => {
  const pages = ['/about', '/highlights', '/fleet', '/fleet/mercedes-van', '/services', '/contact/inquiry', '/travel/some-article', '/charter-bus/taipei', '/download', '/privacy', '/reviews'];
  for (const pagePath of pages) {
    const metadata = meta(pagePath);
    const self = `${ORIGIN}${pagePath}`;
    assert.equal(metadata.alternates.canonical, self);
    assert.equal(metadata.alternates.languages, undefined, `${pagePath} should not emit languages`);
    assert.equal('x-default' in (metadata.alternates.languages ?? {}), false);
    for (const url of urlsOf(metadata)) assert.doesNotMatch(pathOf(url), NESTED_LOCALE, `${pagePath} -> ${url}`);
  }
  const all = (pagePath) => urlsOf(meta(pagePath)).join(' ');
  assert.equal(all('/about').includes('/en/about'), false);
  assert.equal(all('/highlights').includes('/ja/highlights'), false);
  assert.equal(all('/fleet').includes('/zh-tw/fleet'), false);
});

test('locale entries list each other, never locale + path', () => {
  const allowed = new Set(MULTILINGUAL_PATHS);
  const expected = expectedLanguages();
  assert.deepEqual(meta('/en').alternates.languages, expected);
  assert.deepEqual(site.LOCALE_ENTRY_LANGUAGES, expected);
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
  assert.deepEqual(Object.keys(expected).sort(), [...HREFLANG_KEYS].sort());
  assert.deepEqual(Object.values(expected).map(pathOf).filter((value) => value !== '/').sort(), [...ENTRY_PATHS].sort());
});

test('home pageMeta and app/page.tsx both expose the same 9 language alternates', () => {
  const home = site.pageMeta({ title: 't' });
  const expected = expectedLanguages();
  assert.equal(home.alternates.canonical, `${ORIGIN}/`);
  assert.deepEqual(home.alternates.languages, expected);
  assert.deepEqual(home.alternates.languages, meta('/en').alternates.languages);
  assert.deepEqual(site.languageAlternates('/'), expected);
  assert.equal(Object.keys(expected).length, 9);
  assert.equal(expected['x-default'], `${ORIGIN}/`);
  const src = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
  assert.match(src, /canonical:\s*SITE\.url/);
  assert.match(src, /languages:\s*languageAlternates\(\s*["']\/["']\s*\)/);
  assert.equal(src.includes('languageAlternates("/")') || /languageAlternates\(\s*"\/"\s*\)/.test(src), true);
  assert.deepEqual(meta('/en/').alternates.languages, expected);
  assert.equal(meta('/about/').alternates.languages, undefined);
});

test('/download page metadata is self-canonical and has no hreflang', () => {
  const metadata = meta('/download');
  assert.equal(metadata.alternates.canonical, `${ORIGIN}/download`);
  assert.equal(metadata.alternates.languages, undefined);
  const src = fs.readFileSync(path.join(root, 'app/download/page.tsx'), 'utf8');
  assert.match(src, /canonical:\s*absoluteUrl\(\s*["']\/download["']\s*\)/);
  assert.equal(/languages\s*:/.test(src), false, 'download page must not set languages');
});

test('explorePageMeta still emits canonical only', () => {
  const metadata = explorePageMeta({ title: 't', path: '/knowledge' });
  assert.deepEqual(metadata.alternates, { canonical: `${ORIGIN}/knowledge` });
});

test('x-default follows the multilingual vs Chinese-only rule across all routes', async () => {
  const pageFiles = collectPageFiles(path.join(root, 'app')).filter((file) => !isBackupPage(file) && !file.includes(`${path.sep}admin${path.sep}`));
  const fileRoutes = pageFiles.map((file) => ({ file: path.relative(root, file), route: routeFromPageFile(file) }));
  const sitemapEntries = await sitemap();
  const sitemapPaths = sitemapEntries.map((entry) => pathOf(entry.url));
  const concreteRoutes = [...new Set([
    ...fileRoutes.map((row) => row.route).filter((route) => !route.includes('[')),
    ...sitemapPaths,
    '/download',
    '/ai-test',
  ])].sort();

  const report = [];
  for (const route of concreteRoutes) {
    const multilingual = site.isMultilingualEntry(route);
    const languages = site.languageAlternates(route);
    const metadata = meta(route);
    if (multilingual) {
      assert.equal(languages['x-default'], `${ORIGIN}/`, `${route} x-default`);
      assert.deepEqual(metadata.alternates.languages, expectedLanguages(), `${route} languages`);
      assert.equal(Object.keys(languages).length, 9, `${route} should have 9 alternates`);
      report.push({ route, kind: 'multilingual', xDefault: '/', alternateCount: 9 });
    } else {
      assert.equal(languages, undefined, `${route} should have no language alternates`);
      assert.equal(metadata.alternates.languages, undefined, `${route} pageMeta languages`);
      assert.equal(metadata.alternates.canonical, route === '/' ? `${ORIGIN}/` : `${ORIGIN}${route}`);
      report.push({ route, kind: 'chinese-only', xDefault: null, alternateCount: 0 });
    }
  }

  const multilingualCount = report.filter((row) => row.kind === 'multilingual').length;
  const chineseOnlyCount = report.filter((row) => row.kind === 'chinese-only').length;
  assert.equal(multilingualCount, MULTILINGUAL_PATHS.length, `expected ${MULTILINGUAL_PATHS.length} multilingual routes`);
  assert.equal(chineseOnlyCount > 0, true);

  // Every page.tsx must follow the same rule: locale/home use the shared helper;
  // explore pages stay canonical-only; other custom pages must not invent self-only hreflang.
  const classifications = [];
  for (const { file, route } of fileRoutes) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    const usesExplore = /explorePageMeta\s*\(/.test(src);
    const usesPageMeta = /pageMeta\s*\(/.test(src);
    const hasLanguages = /languages\s*:/.test(src);
    const hasXDefault = /x-default/.test(src);
    const isHome = route === '/';
    const isDownload = route === '/download';
    const multilingual = site.isMultilingualEntry(route);
    if (isHome) {
      assert.equal(hasLanguages, true, 'home page must set language alternates');
      assert.match(src, /languageAlternates\(\s*["']\/["']\s*\)/);
    } else if (isDownload) {
      assert.match(src, /absoluteUrl\(\s*["']\/download["']\s*\)/);
      assert.equal(hasLanguages, false);
      assert.equal(hasXDefault, false);
    } else if (usesExplore) {
      assert.equal(hasLanguages, false, `${file} explore page should not set languages`);
      assert.equal(hasXDefault, false, `${file} explore page should not set x-default`);
    } else if (usesPageMeta) {
      if (multilingual) {
        assert.equal(site.isMultilingualEntry(route), true);
      } else {
        assert.equal(site.languageAlternates(route), undefined, `${file} path ${route}`);
      }
    } else if (hasLanguages || hasXDefault) {
      assert.equal(multilingual, true, `${file} custom hreflang on a Chinese-only route`);
    }
    classifications.push({ file, route, usesExplore, usesPageMeta, multilingual });
  }

  assert.equal(classifications.some((row) => row.route === '/'), true);
  assert.equal(classifications.some((row) => row.route === '/download'), true);
  // Keep the enumeration visible in assertion output if counts drift.
  assert.ok(report.length >= MULTILINGUAL_PATHS.length + 8, `enumerated ${report.length} routes`);
});

test('sitemap lists /highlights and no missing locale sub-paths', async () => {
  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  const paths = urls.map(pathOf);
  for (const url of urls) assert.equal(url.startsWith(`${ORIGIN}/`), true, url);
  assert.equal(urls.filter((url) => url === `${ORIGIN}/highlights`).length, 1);
  assert.equal(paths.includes('/ai-test'), false);
  for (const sitemapPath of paths) assert.doesNotMatch(sitemapPath, NESTED_LOCALE);
  for (const expected of ['/', '/about', '/fleet', '/download', ...ENTRY_PATHS]) assert.equal(paths.includes(expected), true, expected);
  assert.equal(new Set(urls).size, urls.length, 'duplicate sitemap url');
});
