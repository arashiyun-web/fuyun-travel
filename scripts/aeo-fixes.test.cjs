// Run: node --test scripts/aeo-fixes.test.cjs
// AEO 2026-11-13：服務頁答案先行、/service → /services 301、sitemap 固定日期、前台不出現內部施工用語。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mock, load } = require('./test-support/step2-load-ts.cjs');

mock('@/lib/dynamicTravelArticles', {
  listPublishedTravelArticles: async () => [
    { slug: 'old-article', publishDate: '2026-06-06' },
    { slug: 'future-article', publishDate: '2026-12-01' },
  ],
});

const root = path.resolve(__dirname, '..');
const sitemap = load('app/sitemap.ts').default;
const { moneyPages } = load('lib/growthPages.ts');
const { serviceItems } = load('lib/siteContent.ts');
const pricing = load('lib/servicePricing.ts');
const { charterFaq } = load('lib/charterFaq.ts');
const { confirmedVehicleRate } = load('lib/fleetCatalog.ts');

const nonSpaceLength = (text) => text.replace(/\s/g, '').length;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('sitemap lists only canonical /services pages and fixed content dates', async () => {
  const before = Date.now();
  const first = await sitemap();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = await sitemap();
  const paths = first.map((entry) => new URL(entry.url).pathname);
  assert.equal(paths.some((p) => p === '/service' || p.startsWith('/service/')), false, 'no /service/* in sitemap');
  assert.equal(paths.includes('/services/price'), true);
  for (const item of serviceItems) assert.equal(paths.includes(`/services/${item.slug}`), true, item.slug);
  assert.deepEqual(second.map((e) => e.lastModified.toISOString()), first.map((e) => e.lastModified.toISOString()), 'stable between requests');
  for (const entry of first) {
    const at = entry.lastModified;
    assert.ok(at instanceof Date && !Number.isNaN(at.getTime()), entry.url);
    assert.ok(Math.abs(before - at.getTime()) > 60 * 60 * 1000, `${entry.url} lastModified must not be the request time`);
    assert.equal(at.toISOString().slice(11), '16:00:00.000Z', `${entry.url} is a Taipei calendar date`);
  }
  const byPath = Object.fromEntries(first.map((e) => [new URL(e.url).pathname, e.lastModified.toISOString().slice(0, 10)]));
  assert.equal(byPath['/travel/old-article'], '2026-11-12', 'template date wins over an older publish date (Taipei 2026-11-13)');
  assert.equal(byPath['/travel/future-article'], '2026-11-30', 'a later publish date wins (Taipei 2026-12-01)');
});

test('every old /service/* page 301s to an existing canonical /services page', async () => {
  const config = (await import(path.join(root, 'next.config.mjs'))).default;
  const redirects = await config.redirects();
  const canonical = new Set(['/services', '/services/price', ...serviceItems.map((item) => `/services/${item.slug}`)]);
  for (const page of moneyPages) {
    const rule = redirects.find((r) => r.source === `/service/${page.slug}`);
    assert.ok(rule, page.slug);
    assert.equal(rule.statusCode, 301, page.slug);
    assert.equal(canonical.has(rule.destination), true, `${page.slug} → ${rule.destination}`);
  }
  const bare = redirects.find((r) => r.source === '/service');
  assert.equal(bare.statusCode, 301);
  assert.equal(bare.destination, '/services');
  assert.equal(redirects.find((r) => r.source === '/platform').statusCode, 302, 'existing /platform rule untouched');
});

test('each /services page has a 40–60 character direct answer and FAQ', () => {
  for (const item of serviceItems) {
    const answer = pricing.findServiceAnswer(item.slug);
    assert.ok(answer, item.slug);
    const n = nonSpaceLength(answer.answer);
    assert.ok(n >= 40 && n <= 60, `${item.slug} answer length ${n}`);
    assert.ok(answer.faq.length >= 4, item.slug);
  }
  const n = nonSpaceLength(pricing.priceAnswer);
  assert.ok(n >= 40 && n <= 60, `price answer length ${n}`);
});

test('prices come only from existing confirmed sources; midibus has no number', () => {
  const coachFaq = charterFaq.find((g) => g.vehicle === '42 人座大巴').items[0].answer;
  const vanFaq = charterFaq.find((g) => g.vehicle === '九人座（賓士）').items[0].answer;
  assert.match(coachFaq, /14000 元 \/ 10 小時/);
  assert.match(vanFaq, /7000 元 \/ 10 小時/);
  assert.equal(confirmedVehicleRate('mercedes-van', 'taipei-day-10h'), 7000);
  assert.equal(pricing.vehiclePrice('coach-42').taipeiDayTwd, 14000);
  assert.equal(pricing.vehiclePrice('van-9').taipeiDayTwd, 7000);
  assert.equal(pricing.vehiclePrice('midibus').taipeiDayTwd, null, 'charterFaq 9500 vs fleetCatalog 9000 conflict: no number');
  assert.equal(pricing.dayPriceText(pricing.vehiclePrice('midibus')), pricing.LINE_QUOTE_TEXT);
  const all = JSON.stringify([pricing.serviceAnswers, pricing.priceFaq, pricing.priceAnswer, pricing.vehiclePrices]);
  assert.doesNotMatch(all, /9,?500|9,?000|undefined|NaN|half hour/);
  const amounts = [...all.matchAll(/(\d{1,2},?\d{3}) 元/g)].map((m) => Number(m[1].replace(',', '')));
  const allowed = new Set([14000, 7000, 1500, 2000]);
  for (const amount of amounts) assert.equal(allowed.has(amount), true, `unexpected amount ${amount}`);
});

test('service JSON-LD: WebPage with dateModified, Service with TWD Offers, FAQPage', () => {
  const coach = pricing.findServiceAnswer('coach-charter');
  const [page, faq] = pricing.serviceAnswerJsonLd({ name: '遊覽車包車', description: coach.answer, path: '/services/coach-charter', vehicles: coach.vehicles, faq: coach.faq });
  assert.equal(page['@type'], 'WebPage');
  assert.match(page.dateModified, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(page.mainEntity['@type'], 'Service');
  assert.deepEqual(page.mainEntity.offers.map((o) => [o['@type'], o.price, o.priceCurrency]), [['Offer', 14000, 'TWD']]);
  assert.equal(faq['@type'], 'FAQPage');
  assert.equal(faq.mainEntity.length, coach.faq.length);
  const midi = pricing.findServiceAnswer('midibus-charter');
  const [midiPage] = pricing.serviceAnswerJsonLd({ name: '中巴包車', description: midi.answer, path: '/services/midibus-charter', vehicles: midi.vehicles, faq: midi.faq });
  assert.equal(midiPage.mainEntity.offers, undefined, 'no Offer without a confirmed price');
});

test('public page sources no longer show internal build wording', () => {
  const files = [
    'app/charter-bus/[city]/page.tsx',
    'app/travel/[slug]/page.tsx',
    'app/reviews/page.tsx',
    'app/featured-trips/page.tsx',
    'app/services/[slug]/page.tsx',
    'app/services/price/page.tsx',
  ];
  const banned = /LINE OA 未設定|LINE CTA|LocalBusiness Schema|WebMCP tool|<h3>Canonical|GEO 推薦|ChatGPT|未來可串接|Review Schema|Local SEO/;
  for (const file of files) assert.doesNotMatch(read(file), banned, file);
  const tool = read('components/WebMCPQuoteTool.tsx');
  const jsx = tool.slice(tool.indexOf('return ('));
  assert.doesNotMatch(jsx, /WebMCP tool|ChatGPT|Codex|agentic|AI 可直接調用/);
});
