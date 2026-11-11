// /admin/content-sync 清單管理：移除（軟刪除）、還原、分頁籤、分頁，以及已移除項目不會被其他流程撈回來。
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock, load } = require('./test-support/step2-load-ts.cjs');

process.env.ADMIN_USERNAME = 'mock-admin';
process.env.ADMIN_PASSWORD_SALT = 'mock-salt';
process.env.ADMIN_PASSWORD_HASH = 'ab'.repeat(64);
process.env.JWT_SECRET = 'synthetic-content-sync-signing-secret-32chars';
const { createAdminToken } = load('lib/adminAuth.ts');
const token = createAdminToken();

let rows, spots, created, fetchCalls, approved;
function matchValue(actual, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    if ('not' in cond && actual === cond.not) return false;
    if ('in' in cond && !cond.in.includes(actual)) return false;
    if ('notIn' in cond && cond.notIn.includes(actual)) return false;
    return true;
  }
  return actual === cond;
}
function matches(row, where = {}) { return Object.keys(where).every((k) => matchValue(row[k], where[k])); }
function sortRows(list, orderBy) {
  const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).map((o) => Object.entries(o)[0]);
  return list.slice().sort((a, b) => {
    for (const [k, dir] of keys) {
      const x = a[k] instanceof Date ? a[k].getTime() : a[k], y = b[k] instanceof Date ? b[k].getTime() : b[k];
      if (x === y) continue;
      return (x < y ? -1 : 1) * (dir === 'desc' ? -1 : 1);
    }
    return 0;
  });
}
let clock = 0;
const prisma = {
  contentSyncItem: {
    findMany: async ({ where, orderBy, skip = 0, take } = {}) => {
      const list = sortRows(rows.filter((r) => matches(r, where)), orderBy);
      return list.slice(skip, take === undefined ? undefined : skip + take).map((r) => ({ ...r }));
    },
    count: async ({ where } = {}) => rows.filter((r) => matches(r, where)).length,
    findUnique: async ({ where }) => {
      const key = Object.keys(where)[0];
      const r = rows.find((x) => x[key] === where[key]);
      return r ? { ...r } : null;
    },
    update: async ({ where, data }) => {
      const r = rows.find((x) => x.id === where.id);
      if (!r) throw new Error('not found');
      Object.assign(r, data, { updatedAt: new Date(Date.UTC(2026, 10, 11) + ++clock * 1000) });
      return { ...r };
    },
    create: async ({ data }) => {
      if (data.sourcePostId && rows.some((r) => r.sourcePostId === data.sourcePostId)) throw new Error('Unique constraint failed on sourcePostId');
      const r = { id: 'new-' + rows.length, selected: false, contentDraftId: null, createdAt: new Date(), updatedAt: new Date(), ...data };
      rows.push(r); created.push(r);
      return { ...r };
    },
  },
  featuredSpot: {
    findMany: async ({ where } = {}) => spots.filter((s) => !where || !where.sourceItemId || s.sourceItemId !== null).map((s) => ({ ...s })),
    create: async ({ data }) => { const s = { id: 'spot-' + spots.length, ...data }; spots.push(s); return s; },
  },
};
mock('@/lib/prisma', { prisma });
mock('@/lib/operations/store', { ownerHasApprovedCopy: async () => approved });
mock('@/lib/content-sync/summarize', { summarizePostOneLiner: async (m) => m.slice(0, 20) });
let pagePosts = [];
mock('@/lib/content-sync/facebookGraph', { fetchRecentPagePosts: async () => ({ configured: true, posts: pagePosts }) });
global.fetch = async () => { fetchCalls++; throw new Error('unexpected fetch'); };

const items = load('app/api/content-sync/items/route.ts');
const archive = load('app/api/content-sync/archive/route.ts');
const featureAll = load('app/api/content-sync/feature-all/route.ts');
const weeklyPull = load('app/api/content-sync/weekly-pull/route.ts');
const manualSubmit = load('app/api/content-sync/manual-submit/route.ts');
const select = load('app/api/content-sync/select/route.ts');
const featuredSpots = load('app/api/featured-spots/route.ts');
const manage = load('lib/content-sync/listManage.ts');

const auth = (extra = {}) => ({ authorization: `Bearer ${token}`, ...extra });
const get = (qs, ok = true) => items.GET(new Request('http://localhost/api/content-sync/items' + qs, { headers: ok ? auth() : {} }));
const post = (route, body, headers = auth({ 'content-type': 'application/json' })) => route.POST(new Request('http://localhost/x', { method: 'POST', headers, body: JSON.stringify(body) }));

function row(i, extra = {}) {
  return { id: `item-${String(i).padStart(2, '0')}`, sourcePostId: `fb-${i}`, sourceType: 'page_official', authorName: null, summary: `貼文 ${i} 的摘要內容`, postUrl: null, postedAt: null, batchLabel: '2026-W46', rawPayload: { full_picture: `https://img.example.invalid/${i}.jpg` }, selected: false, status: 'pending', contentDraftId: null, createdAt: new Date(Date.UTC(2026, 10, 1) + i * 60000), updatedAt: new Date(Date.UTC(2026, 10, 1)), ...extra };
}

beforeEach(() => {
  rows = []; for (let i = 1; i <= 23; i++) rows.push(row(i));
  rows.push(row(30, { status: 'draft_generated' }));
  spots = [{ id: 'spot-a', sourceItemId: 'item-01', status: 'published', title: 'a' }, { id: 'spot-b', sourceItemId: 'item-02', status: 'published', title: 'b' }, { id: 'spot-c', sourceItemId: null, status: 'published', title: 'c' }];
  created = []; fetchCalls = 0; approved = true; pagePosts = []; clock = 0;
});

test('unauthenticated archive, restore and paged list requests are rejected with 401 and change nothing', async () => {
  const before = JSON.stringify(rows);
  assert.equal((await post(archive, { id: 'item-05' }, { 'content-type': 'application/json' })).status, 401);
  assert.equal((await post(archive, { id: 'item-05', restore: true }, { 'content-type': 'application/json', authorization: 'Bearer forged.token' })).status, 401);
  assert.equal((await get('?tab=pending', false)).status, 401);
  assert.equal(JSON.stringify(rows), before);
});

test('archive is a soft delete; featured card is untouched; restore returns it to pending', async () => {
  const r = await post(archive, { id: 'item-01' });
  assert.equal(r.status, 200);
  const stored = rows.find((x) => x.id === 'item-01');
  assert.equal(stored.status, 'archived');
  assert.equal(stored.summary, '貼文 1 的摘要內容');
  assert.equal(rows.length, 24, 'row still exists');
  assert.deepEqual(spots.find((s) => s.id === 'spot-a'), { id: 'spot-a', sourceItemId: 'item-01', status: 'published', title: 'a' });
  const again = await post(archive, { id: 'item-01' });
  assert.equal(again.status, 200); assert.equal((await again.json()).alreadyArchived, true);
  const back = await post(archive, { id: 'item-01', restore: true });
  assert.equal(back.status, 200);
  assert.equal(rows.find((x) => x.id === 'item-01').status, 'pending');
});

test('archive validates input and refuses non-list items', async () => {
  assert.equal((await post(archive, {})).status, 400);
  assert.equal((await archive.POST(new Request('http://localhost/x', { method: 'POST', headers: auth(), body: '{' }))).status, 400);
  assert.equal((await post(archive, { id: 'missing' })).status, 404);
  assert.equal((await post(archive, { id: 'item-30' })).status, 409, 'draft_generated is not in the list');
  assert.equal((await post(archive, { id: 'item-05', restore: true })).status, 409, 'cannot restore a non-archived item');
  assert.equal(rows.find((x) => x.id === 'item-30').status, 'draft_generated');
});

test('tabs count and paginate server-side, 10 per page', async () => {
  await post(archive, { id: 'item-03' });
  await post(archive, { id: 'item-02' }); // featured AND archived -> only in archived tab
  let data = await (await get('?tab=pending')).json();
  assert.deepEqual(data.counts, { pending: 20, featured: 1, archived: 2 });
  assert.equal(data.page, 1); assert.equal(data.pageSize, 10); assert.equal(data.totalPages, 2);
  assert.equal(data.items.length, 10);
  assert.equal(data.items[0].id, 'item-23', 'newest first');
  data = await (await get('?tab=pending&page=2')).json();
  assert.equal(data.items.length, 10); assert.equal(data.items[9].id, 'item-04');
  data = await (await get('?tab=pending&page=99')).json();
  assert.equal(data.page, 2, 'page is clamped');
  const seen = new Set();
  for (const p of [1, 2]) for (const it of (await (await get(`?tab=pending&page=${p}`)).json()).items) { assert.equal(it.status, 'pending'); assert.ok(!['item-01', 'item-02', 'item-03'].includes(it.id)); seen.add(it.id); }
  assert.equal(seen.size, 20);
  data = await (await get('?tab=featured')).json();
  assert.deepEqual(data.items.map((x) => x.id), ['item-01']);
  data = await (await get('?tab=archived')).json();
  assert.deepEqual(data.items.map((x) => x.id), ['item-02', 'item-03'], 'most recently archived first');
  assert.equal(data.totalPages, 1);
  data = await (await get('?tab=bogus&pageSize=500')).json();
  assert.equal(data.tab, 'pending'); assert.equal(data.pageSize, 50);
});

test('legacy list queries exclude archived items, including status=all', async () => {
  await post(archive, { id: 'item-07' });
  for (const qs of ['', '?status=pending', '?status=all']) {
    const data = await (await get(qs)).json();
    assert.ok(!data.items.some((x) => x.id === 'item-07' || x.status === 'archived'), qs);
  }
});

test('feature-all never publishes archived items', async () => {
  for (let i = 3; i <= 23; i++) await post(archive, { id: `item-${String(i).padStart(2, '0')}` });
  const r = await featureAll.POST(new Request('http://localhost/x', { method: 'POST', headers: auth() }));
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.created, 0, 'only item-01/02 are pending and both are already featured');
  assert.ok(!spots.some((s) => /^item-(0[3-9]|1\d|2[0-3])$/.test(s.sourceItemId || '')));
});

test('archived items cannot be drafted or featured until restored', async () => {
  await post(archive, { id: 'item-09' });
  const sel = await (await post(select, { itemIds: ['item-09'] })).json();
  assert.equal(sel.results[0].success, false);
  assert.equal(fetchCalls, 0);
  const fs = await post(featuredSpots, { title: 't', description: 'd', sourceItemId: 'item-09' });
  assert.equal(fs.status, 409);
  assert.ok(!spots.some((s) => s.sourceItemId === 'item-09'));
  assert.equal(rows.find((x) => x.id === 'item-09').status, 'archived');
});

test('weekly-pull and manual-submit do not resurrect archived posts (sourcePostId stays unique)', async () => {
  await post(archive, { id: 'item-04' });
  pagePosts = [{ id: 'fb-4', message: '同一則貼文重新出現', permalink_url: 'https://facebook.example.invalid/4' }, { id: 'fb-99', message: '全新貼文', permalink_url: 'https://facebook.example.invalid/99' }];
  const r = await weeklyPull.POST(new Request('http://localhost/x', { method: 'POST', headers: auth() }));
  const data = await r.json();
  assert.equal(data.created, 1); assert.equal(data.skipped, 1);
  assert.deepEqual(created.map((x) => x.sourcePostId), ['fb-99']);
  assert.equal(rows.filter((x) => x.sourcePostId === 'fb-4').length, 1);
  assert.equal(rows.find((x) => x.id === 'item-04').status, 'archived');
  const m = await (await post(manualSubmit, { summary: '手動再貼一次', sourceType: 'group_official', sourcePostId: 'fb-4' })).json();
  assert.equal(m.skipped, true);
  assert.equal(rows.find((x) => x.id === 'item-04').status, 'archived');
  const list = await (await get('?tab=pending')).json();
  assert.ok(!list.items.some((x) => x.sourcePostId === 'fb-4'));
  assert.equal(list.counts.archived, 1);
});

test('helper rules', () => {
  assert.deepEqual(manage.pageWindow(0, 3, 10), { page: 1, totalPages: 1, skip: 0, take: 10 });
  assert.deepEqual(manage.pageWindow(21, 3, 10), { page: 3, totalPages: 3, skip: 20, take: 10 });
  assert.deepEqual(manage.uniqueIds(['a', null, 'a', 'b', undefined]), ['a', 'b']);
  assert.equal(manage.parsePositiveInt('-3', 1), 1);
  assert.equal(manage.parsePositiveInt('abc', 10), 10);
});
