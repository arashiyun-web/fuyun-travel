const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const load = createRequire(path.join(root, 'package.json'))('jiti')(__filename, {
  alias: { '@': root },
  interopDefault: true,
});

const {
  DRAFT_IMAGE_LIMIT,
  applyDraftImagesToContent,
  fleetPhotoAlt,
  insertDraftImagesIntoMarkdown,
  listFleetVehiclesForDrafts,
  planDraftImages,
  resolveFleetVehicle,
  toAbsoluteSiteUrl,
} = load(path.join(root, 'lib/content-factory/draftImages.ts'));
const { isPublicDraftImage } = load(path.join(root, 'lib/content-factory/sources.ts'));
const { SITE_ORIGIN } = load(path.join(root, 'lib/content-factory/internalPages.ts'));

const COACH = `${SITE_ORIGIN}/fleet/coach-42-exterior.webp`;
const COACH_A = `${SITE_ORIGIN}/fleet/coach-42-interior-a.webp`;
const COACH_B = `${SITE_ORIGIN}/fleet/coach-42-interior-b.webp`;
const VAN = `${SITE_ORIGIN}/fleet/mercedes-van-exterior.webp`;
const MIDIBUS = `${SITE_ORIGIN}/fleet/toyota-midibus-side.webp`;

function slugsWithPhotos() {
  return listFleetVehiclesForDrafts().filter((item) => item.photos.length).map((item) => item.slug).sort();
}

test('catalog photos are read from fleetItems and fleetCatalog, not hardcoded paths', () => {
  const list = listFleetVehiclesForDrafts();
  const slugs = list.map((item) => item.slug);
  assert.ok(slugs.includes('coach-42'));
  assert.ok(slugs.includes('mercedes-van'));
  assert.ok(slugs.includes('toyota-midibus'));
  assert.ok(slugs.includes('man'));
  assert.ok(slugs.includes('scania-k400'));
  assert.ok(slugs.includes('scania-k380'));
  assert.ok(slugs.includes('hino'));
  assert.ok(slugs.includes('daewoo'));
  const coach = list.find((item) => item.slug === 'coach-42');
  const man = list.find((item) => item.slug === 'man');
  assert.ok(coach.photos.every((photo) => photo.includes('/fleet/coach-42-')));
  assert.deepEqual(man.photos, []);
  assert.deepEqual(slugsWithPhotos(), ['coach-42', 'mercedes-van', 'toyota-midibus']);
});

test('isPublicDraftImage allows first-party /fleet/ paths and rejects traversal', () => {
  assert.equal(isPublicDraftImage('/fleet/coach-42-exterior.webp'), true);
  assert.equal(isPublicDraftImage('/images/fixture.jpg'), true);
  assert.equal(isPublicDraftImage('https://fuyuntravel.com/fleet/coach-42-exterior.webp'), true);
  assert.equal(isPublicDraftImage('/fleet/../secret.webp'), false);
  assert.equal(isPublicDraftImage('/api/internal'), false);
});

test('resolves a unique vehicle from seat count or model name', () => {
  assert.equal(resolveFleetVehicle({ trip_title: '台北出發陽明山一日包車 40 人' }).slug, 'coach-42');
  assert.equal(resolveFleetVehicle({ user_notes: '42 人座遊覽車包車' }).slug, 'coach-42');
  assert.equal(resolveFleetVehicle({ additional_info: '大巴' }).slug, 'coach-42');
  assert.equal(resolveFleetVehicle({ trip_title: '九人座賓士一日遊', user_notes: '9 人' }).slug, 'mercedes-van');
  assert.equal(resolveFleetVehicle({ user_notes: '小巴、賓士接送' }).slug, 'mercedes-van');
  assert.equal(resolveFleetVehicle({ user_notes: '中巴 20 人公司旅遊' }).slug, 'toyota-midibus');
  assert.equal(resolveFleetVehicle({ additional_info: 'TOYOTA 中巴' }).slug, 'toyota-midibus');
});

test('does not mix vehicle types when more than one type is mentioned', () => {
  assert.equal(resolveFleetVehicle({ user_notes: '九人座或中巴都可以' }), null);
  assert.equal(resolveFleetVehicle({ trip_title: '大巴與賓士皆可', user_notes: '40 人或 9 人' }), null);
  assert.equal(resolveFleetVehicle({ user_notes: '小巴和中巴' }), null);
  const plan = planDraftImages({
    input: { user_notes: '九人座或中巴都可以' },
    sourceImages: ['https://images.example.invalid/spot.jpg'],
  });
  assert.equal(plan.fleet, null);
  assert.deepEqual(plan.fleetImages, []);
  assert.deepEqual(plan.image_urls, ['https://images.example.invalid/spot.jpg']);
  assert.doesNotMatch(plan.image_urls.join(' '), /mercedes-van|toyota-midibus|coach-42/);
});

test('does not attach fleet photos when the vehicle cannot be uniquely resolved', () => {
  assert.equal(resolveFleetVehicle({ user_notes: '台北出發陽明山一日包車，賞芒草、泡溫泉' }), null);
  assert.equal(resolveFleetVehicle({ user_notes: '團體旅遊包車' }), null);
  assert.equal(resolveFleetVehicle({ user_notes: '遊覽車' }), null);
  assert.equal(resolveFleetVehicle({ user_notes: '25 人團體出遊' }), null);
  const plan = planDraftImages({ input: { trip_title: '手動行程', user_notes: '公開行程素材' } });
  assert.equal(plan.fleet, null);
  assert.deepEqual(plan.image_urls, []);
  assert.equal(plan.cover_image_url, '');
});

test('vehicles without photos are not replaced by another type', () => {
  for (const notes of ['MAN 遊覽車', 'Scania K400', 'K380 包車', 'Hino', 'Daewoo']) {
    const match = resolveFleetVehicle({ user_notes: notes });
    assert.ok(match, `expected a unique match for ${notes}`);
    assert.notEqual(match.slug, 'coach-42');
    assert.deepEqual(match.photos, []);
    const plan = planDraftImages({
      input: { user_notes: notes },
      sourceImages: ['https://images.example.invalid/spot.jpg'],
    });
    assert.equal(plan.fleet.slug, match.slug);
    assert.deepEqual(plan.fleetImages, []);
    assert.deepEqual(plan.image_urls, ['https://images.example.invalid/spot.jpg']);
    assert.equal(plan.cover_image_url, 'https://images.example.invalid/spot.jpg');
    assert.doesNotMatch(plan.image_urls.join(' '), /coach-42|mercedes-van|toyota-midibus/);
  }
});

test('spot photos come first, then 2-3 photos from a single fleet type, with a cap and dedupe', () => {
  const spots = [];
  for (let i = 0; i < 19; i++) spots.push(`https://images.example.invalid/spot-${i}.jpg`);
  const plan = planDraftImages({
    input: { trip_title: '42 人座大巴賞楓' },
    sourceImages: spots.concat([
      '/fleet/coach-42-exterior.webp',
      'https://fuyuntravel.com/fleet/coach-42-exterior.webp',
    ]),
  });
  assert.equal(plan.fleet.slug, 'coach-42');
  assert.equal(plan.image_urls.length, DRAFT_IMAGE_LIMIT);
  assert.deepEqual(plan.image_urls.slice(0, 19), spots);
  assert.equal(plan.image_urls[19], COACH);
  assert.equal(plan.cover_image_url, spots[0]);
  assert.ok(plan.fleetImages.length >= 2 && plan.fleetImages.length <= 3);
  assert.ok(plan.fleetImages.every((url) => url.startsWith(`${SITE_ORIGIN}/fleet/coach-42-`)));
  assert.equal(plan.image_urls.filter((url) => url.includes('/fleet/')).length, 1);
  assert.doesNotMatch(plan.image_urls.join(' '), /mercedes-van|toyota-midibus/);
});

test('manual input without photos still gets fleet cover when a unique type is known', () => {
  const plan = planDraftImages({
    input: { trip_title: '台北出發陽明山一日包車 40 人', user_notes: '賞芒草、泡溫泉' },
  });
  assert.equal(plan.fleet.slug, 'coach-42');
  assert.deepEqual(plan.image_urls, [COACH, COACH_A, COACH_B]);
  assert.equal(plan.cover_image_url, COACH);
  assert.equal(plan.spotImages.length, 0);
});

test('explicit empty cover stays empty even when fleet photos are attached', () => {
  const plan = planDraftImages({
    input: { user_notes: '九人座賓士家庭旅遊' },
    coverImageUrl: '',
  });
  assert.equal(plan.fleet.slug, 'mercedes-van');
  assert.ok(plan.image_urls.length >= 2);
  assert.equal(plan.cover_image_url, '');
  assert.equal(plan.image_urls[0], VAN);
});

test('manual input with no usable fleet photos leaves the cover empty', () => {
  const none = planDraftImages({ input: { user_notes: '素材僅供重新撰寫，照片未授權作封面' } });
  assert.equal(none.cover_image_url, '');
  assert.deepEqual(none.image_urls, []);
  const man = planDraftImages({ input: { user_notes: 'MAN 遊覽車企業旅遊' } });
  assert.equal(man.fleet.slug, 'man');
  assert.equal(man.cover_image_url, '');
  assert.deepEqual(man.image_urls, []);
});

test('article markdown inserts spot then fleet photos as absolute https URLs without lengthening the prompt path', () => {
  const plan = planDraftImages({
    input: { user_notes: '中巴 18 人公司旅遊' },
    sourceImages: ['https://images.example.invalid/temple.jpg', '/images/spot-b.jpg'],
    spotTitle: '桃園威天宮',
  });
  assert.equal(plan.fleet.slug, 'toyota-midibus');
  const body = insertDraftImagesIntoMarkdown(
    '想要安排一趟台北近郊小旅行嗎？\n\n行程會經過風景區，並保留彈性休息時間。\n\n回程前再安排晚餐。',
    plan,
  );
  assert.match(body, /^想要安排一趟台北近郊小旅行嗎？\n\n!\[桃園威天宮實拍\]\(https:\/\/images\.example\.invalid\/temple\.jpg\)/);
  assert.match(body, /!\[TOYOTA 中巴車側\]\(https:\/\/fuyuntravel\.com\/fleet\/toyota-midibus-side\.webp\)/);
  assert.doesNotMatch(body, /\(#\)/);
  assert.doesNotMatch(body, /!\[.*\]\(\/fleet\//);
  assert.equal(plan.image_urls[0], 'https://images.example.invalid/temple.jpg');
  assert.ok(plan.image_urls.indexOf(`${SITE_ORIGIN}/images/spot-b.jpg`) !== -1 || plan.image_urls.indexOf('/images/spot-b.jpg') !== -1);
});

test('applyDraftImagesToContent only rewrites the article body and skips URLs already present', () => {
  const plan = planDraftImages({
    input: { user_notes: '42 人座大巴' },
    sourceImages: ['https://images.example.invalid/cover.jpg'],
    spotTitle: '陽明山',
  });
  const existing = `開頭介紹\n\n![陽明山實拍](https://images.example.invalid/cover.jpg)\n\n中段內文`;
  const output = applyDraftImagesToContent({
    meta: { trip_title: '測', generated_keywords: { primary: [], secondary: [], long_tail: [] }, missing_fields: [], internal_links: [] },
    geo_summary: '摘要',
    seo_article: { h1: '標題', body_markdown: existing, faq: [] },
    facebook: { body: 'FB', info_table: { 行程名稱: '', 天數: '', 適合族群: '', 季節特色: '' } },
    instagram: { caption: 'IG', hashtags: [] },
    line_oa: 'LINE',
    edm: { subject: '主旨', body: '信件' },
    extras: { gmb_short: '', ai_qa_block: [], ab_test: { fb: [], ig: [] } },
    json_ld: '{}',
  }, plan);
  assert.equal(output.facebook.body, 'FB');
  const matches = output.seo_article.body_markdown.match(/!\[[^\]]*\]\([^)]+\)/g) || [];
  const coverMentions = matches.filter((item) => item.indexOf('https://images.example.invalid/cover.jpg') !== -1);
  assert.equal(coverMentions.length, 1);
  assert.match(output.seo_article.body_markdown, /!\[42 人座大巴（雲陞遊覽車）外觀\]\(https:\/\/fuyuntravel\.com\/fleet\/coach-42-exterior\.webp\)/);
  assert.equal(toAbsoluteSiteUrl('/fleet/coach-42-exterior.webp'), COACH);
  assert.equal(fleetPhotoAlt('42 人座大巴（雲陞遊覽車）', COACH), '42 人座大巴（雲陞遊覽車）外觀');
});
