const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
const db = new PGlite();
let failRead = false, failWrite = false, llmCalls = [], responseText, providerMissing, externalCalls = 0;
const published = { id: 'published-spot', title: '九份山城', description: '已公開且授權的散步素材', photoUrl: 'https://images.example.invalid/cover.jpg', photoUrls: ['/images/fixture.jpg', 'http://unsafe.invalid/a.jpg', 'data:image/png;base64,AA==', '//unsafe.invalid/a.jpg'], status: 'published' };
const hidden = { ...published, id: 'hidden-spot', status: 'draft' };
let spots;
process.env.ADMIN_USERNAME = 'mock-admin';
process.env.ADMIN_PASSWORD_SALT = 'mock-salt';
process.env.ADMIN_PASSWORD_HASH = 'ab'.repeat(64);
process.env.JWT_SECRET = 'synthetic-step3-signing-secret-at-least-32chars';
const { createAdminToken } = load('lib/adminAuth.ts');
const token = createAdminToken();
const copy = load('lib/ai/copywriter.ts');
mock('@/lib/ai/copywriter', { ...copy, generateCopy: async (input) => {
  llmCalls.push(input);
  if (providerMissing) return copy.generateCopy(input); // real provider selection, with no configured pairs
  return responseText;
} });
mock('@/lib/prisma', { prisma: {
  featuredSpot: {
    findMany: async ({ where }) => { if (failRead) throw new Error('private-source-error'); return spots.filter((s) => s.status === where.status); },
    findFirst: async ({ where }) => { if (failRead) throw new Error('private-source-error'); return spots.find((s) => s.id === where.id && s.status === where.status) || null; },
  },
  contentDraft: {
    create: async ({ data }) => {
      if (failWrite) throw new Error('private-db-error');
      const id = 'draft-' + require('node:crypto').randomUUID();
      await db.query('INSERT INTO content_drafts (id, trip_title, input_json, output_json, image_urls, cover_image_url, status, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())', [id,data.tripTitle,JSON.stringify(data.inputJson),JSON.stringify(data.outputJson),data.imageUrls,data.coverImageUrl,data.status]);
      return { id, ...data };
    },
    findMany: async () => (await db.query('SELECT id, input_json AS "inputJson", output_json AS "outputJson", status, created_at AS "createdAt" FROM content_drafts ORDER BY created_at DESC')).rows,
  },
} });
mock('@/lib/operations/store', { createContentDraft: async () => { throw new Error('one-click must not enter operations publication'); } });
global.fetch = async () => { externalCalls++; throw new Error('unexpected external fetch'); };
const generate = load('app/api/content-factory/generate/route.ts');
const save = load('app/api/content-factory/save/route.ts');
let sources;
try { sources = load('app/api/content-factory/sources/route.ts'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const request = (body, auth = true) => new Request('http://localhost/api/content-factory/generate', { method: 'POST', headers: auth ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
const validOutput = { meta: { trip_title: '九份山城', generated_keywords: { primary: [], secondary: [], long_tail: [] }, missing_fields: [], internal_links: [] }, geo_summary: '生成摘要', seo_article: { h1: '九份一日', body_markdown: '生成網站文案', faq: [] }, facebook: { body: '生成 FB 文案', info_table: {} }, instagram: { caption: '生成 IG 文案', hashtags: [] }, line_oa: '生成 LINE 草稿', edm: { subject: '旅遊趣', body: '信件草稿' }, extras: { gmb_short: '', ai_qa_block: [], ab_test: { fb: [], ig: [] } }, json_ld: { '@type': 'TouristTrip', offers: { price: 999 } } };
before(async () => {
  await db.exec(`CREATE TABLE content_drafts (id TEXT PRIMARY KEY, trip_title TEXT NOT NULL, input_json JSONB NOT NULL, output_json JSONB NOT NULL, image_urls TEXT[] NOT NULL, cover_image_url TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL);`);
});
after(async () => db.close());
beforeEach(() => {
  spots = [structuredClone(published), structuredClone(hidden)]; failRead = failWrite = providerMissing = false; externalCalls = 0; llmCalls = []; responseText = JSON.stringify(validOutput);
  for (const key of ['GEMINI_API_KEY','GEMINI_MODEL','ANTHROPIC_API_KEY','AI_MODEL_NAME','OPENAI_API_KEY','OPENAI_MODEL']) delete process.env[key];
});
async function count() { return (await db.query('SELECT count(*)::int AS n FROM content_drafts')).rows[0].n; }
test('admin list provides only published canonical material and public image URLs', async () => {
  assert.ok(sources, 'source listing route must exist');
  assert.equal((await sources.GET(new Request('http://localhost'))).status, 401);
  const r = await sources.GET(new Request('http://localhost', { headers: { authorization: `Bearer ${token}` } }));
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.deepEqual(data.sources, [{ id: 'published-spot', title: '九份山城', description: '已公開且授權的散步素材', image_urls: ['https://images.example.invalid/cover.jpg','/images/fixture.jpg'], cover_image_url: 'https://images.example.invalid/cover.jpg' }]);
});
test('selected source generates and persists SQL draft; returned id reads back all platform content and existing images', async () => {
  const r = await generate.POST(request({ featured_spot_id: 'published-spot', trip_title: 'forged', user_notes: 'forged', image_urls: ['https://forged.invalid/a'] }));
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.success, true); assert.ok(data.draftId);
  const row = (await db.query('SELECT * FROM content_drafts WHERE id=$1', [data.draftId])).rows[0];
  assert.equal(row.status, 'draft'); assert.equal(row.trip_title, '九份山城');
  assert.equal(row.input_json.user_notes, '已公開且授權的散步素材');
  assert.equal(row.input_json.featured_spot_id, 'published-spot');
  assert.deepEqual(row.image_urls, ['https://images.example.invalid/cover.jpg','/images/fixture.jpg']);
  assert.equal(row.cover_image_url, 'https://images.example.invalid/cover.jpg');
  assert.equal(row.output_json.facebook.body, '生成 FB 文案');
  assert.equal(row.output_json.instagram.caption, '生成 IG 文案');
  assert.equal(row.output_json.x.body, '生成 FB 文案');
  assert.equal(row.output_json.seo_article.body_markdown, '生成網站文案');
  assert.equal(JSON.parse(row.output_json.json_ld).offers, undefined);
  assert.match(llmCalls[0].user, /已公開且授權的散步素材/); assert.doesNotMatch(llmCalls[0].user, /forged/);
  const readback = await save.GET(new Request('http://localhost', { headers: { authorization: `Bearer ${token}` } }));
  assert.equal((await readback.json()).drafts.find((d) => d.id === data.draftId).status, 'draft');
  assert.equal(externalCalls, 0);
});
test('withdrawn, unpublished and unknown sources never generate or persist', async () => {
  const n = await count();
  spots[0].status = 'draft';
  for (const id of ['published-spot','hidden-spot','missing']) assert.equal((await generate.POST(request({ featured_spot_id: id }))).status, 404);
  assert.equal(llmCalls.length, 0); assert.equal(await count(), n);
});
test('missing real provider returns 503 and leaves SQL unchanged, never stores original text as generated', async () => {
  providerMissing = true; const n = await count();
  const r = await generate.POST(request({ featured_spot_id: 'published-spot' }));
  assert.equal(r.status, 503); assert.match((await r.json()).error, /ANTHROPIC_API_KEY/);
  assert.equal(await count(), n); assert.equal(externalCalls, 0);
});
test('malformed body and empty material are 400; unauthenticated input is 401', async () => {
  const n = await count();
  assert.equal((await generate.POST(request({ featured_spot_id: 'published-spot' }, false))).status, 401);
  for (const body of [null, [], {}, { featured_spot_id: 2 }, { featured_spot_id: '' }, { user_notes: 2 }, { user_notes: '   ' }, { user_notes: 'text', spots: 3 }]) assert.equal((await generate.POST(request(body))).status, 400);
  assert.equal(llmCalls.length, 0); assert.equal(await count(), n);
});
test('provider malformed JSON or missing platform fields fails before persist, without raw model text', async () => {
  const n = await count();
  for (const raw of ['private-llm-output', 'null', '[]', '{}', JSON.stringify({ ...validOutput, facebook: { body: '' } }), JSON.stringify({ ...validOutput, instagram: { caption: 22 } })]) {
    responseText = raw;
    const r = await generate.POST(request({ featured_spot_id: 'published-spot' }));
    assert.equal(r.status, 502); assert.equal((await r.text()).includes('private-llm-output'), false);
  }
  assert.equal(await count(), n);
});
test('source query and persistence failures are controlled 503, never success or private error echo', async () => {
  const n = await count();
  failRead = true;
  let r = await generate.POST(request({ featured_spot_id: 'published-spot' }));
  assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /private-source-error/);
  failRead = false; failWrite = true;
  r = await generate.POST(request({ featured_spot_id: 'published-spot' }));
  assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /private-db-error|success":true/);
  assert.equal(await count(), n);
});
for (const { name, input, expectedCover } of [
  { name: 'explicit empty cover stays empty despite an HTTPS image', input: { cover_image_url: '', image_urls: ['https://images.example.invalid/member.jpg'] }, expectedCover: '' },
  { name: 'omitted cover falls back to the first image', input: { image_urls: ['https://images.example.invalid/member.jpg'] }, expectedCover: 'https://images.example.invalid/member.jpg' },
  { name: 'null cover falls back to the first image', input: { cover_image_url: null, image_urls: ['https://images.example.invalid/member.jpg'] }, expectedCover: 'https://images.example.invalid/member.jpg' },
  { name: 'explicit nonempty cover wins over the first image', input: { cover_image_url: 'https://images.example.invalid/authorized.jpg', image_urls: ['https://images.example.invalid/member.jpg'] }, expectedCover: 'https://images.example.invalid/authorized.jpg' },
  { name: 'omitted cover without images becomes empty', input: {}, expectedCover: '' },
  { name: 'null cover without images becomes empty', input: { cover_image_url: null, image_urls: [] }, expectedCover: '' },
]) {
  test(`manual generation: ${name} in response, SQL columns and saved input`, async () => {
    const r = await generate.POST(request({ user_notes: '素材僅供重新撰寫，照片未授權作封面', ...input }));
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.input.cover_image_url, expectedCover);
    const row = (await db.query('SELECT * FROM content_drafts WHERE id=$1', [data.draftId])).rows[0];
    assert.equal(row.cover_image_url, expectedCover);
    assert.equal(row.input_json.cover_image_url, expectedCover);
    assert.deepEqual(row.image_urls, input.image_urls || []);
    assert.equal(row.status, 'draft');
    const readback = await save.GET(new Request('http://localhost', { headers: { authorization: `Bearer ${token}` } }));
    assert.equal(readback.status, 200);
    assert.equal((await readback.json()).drafts.find((draft) => draft.id === data.draftId).input.cover_image_url, expectedCover);
    assert.equal(externalCalls, 0);
  });
}

test('manual trip generation still persists draft and rejects unsafe image paths', async () => {
  const r = await generate.POST(request({ user_notes: '公開行程素材', trip_title: '手動行程', image_urls: ['/images/fixture.jpg'], cover_image_url: '/images/fixture.jpg' }));
  assert.equal(r.status, 200); const data = await r.json(); assert.ok(data.draftId);
  const n = await count();
  for (const image of ['http://unsafe.invalid/image.jpg','data:image/jpeg;base64,AA==','//evil.invalid/x','/../private','/api/internal','https://user:pass@example.invalid/x']) {
    assert.equal((await generate.POST(request({ user_notes: '素材', image_urls: [image] }))).status, 400);
  }
  assert.equal(await count(), n); assert.equal(externalCalls, 0);
});

test('invalid model collection fields are rejected before persistence so result rendering cannot crash', async () => {
  const n = await count();
  for (const changes of [
    { meta: { ...validOutput.meta, missing_fields: 'bad' } },
    { meta: { ...validOutput.meta, generated_keywords: { primary: 'bad' } } },
    { instagram: { caption: 'IG', hashtags: 'bad' } },
    { seo_article: { h1: 'title', body_markdown: 'body', faq: 'bad' } },
    { seo_article: { h1: 'title', body_markdown: 'body', faq: [null] } },
    { extras: { gmb_short: '', ai_qa_block: [null], ab_test: { fb: [], ig: [] } } },
    { extras: { gmb_short: '', ai_qa_block: [], ab_test: { fb: 'bad', ig: [] } } },
    { edm: { subject: 99, body: 'body' } },
  ]) {
    responseText = JSON.stringify({ ...validOutput, ...changes });
    const r = await generate.POST(request({ featured_spot_id: 'published-spot' }));
    assert.equal(r.status, 502);
  }
  assert.equal(await count(), n);
});

test('minimal valid platform response normalizes omitted optional result fields and X fallback', async () => {
  responseText = JSON.stringify({ facebook: { body: 'FB' }, instagram: { caption: 'IG' }, seo_article: { body_markdown: 'Web' } });
  const r = await generate.POST(request({ featured_spot_id: 'published-spot' }));
  assert.equal(r.status, 200);
  const { generated } = await r.json();
  assert.deepEqual(generated.meta.generated_keywords.primary, []);
  assert.deepEqual(generated.meta.missing_fields, []);
  assert.deepEqual(generated.instagram.hashtags, []);
  assert.deepEqual(generated.seo_article.faq, []);
  assert.equal(generated.x.body, 'FB');
});

test('new-image upload stays fail-closed without an authorized public storage URL', async () => {
  let uploads = 0;
  mock('@/lib/storage/r2', { uploadToR2: async () => { uploads++; throw new Error('unexpected storage request'); } });
  const upload = load('app/api/content-factory/upload/route.ts');
  const r = await upload.POST(new Request('http://localhost/api/content-factory/upload', { method:'POST', headers: {authorization:`Bearer ${token}`} }));
  assert.equal(r.status, 503); const data = await r.json();
  assert.match(data.error, /待核/); assert.equal(data.url, undefined); assert.equal(uploads, 0);
});
