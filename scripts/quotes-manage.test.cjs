// Admin /admin/quotes management: soft removal, restore, order protection, staff-only
// pre-generated drafts (LINE webhook + batch backfill). Prisma and LINE are mocked; nothing is sent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { mock, load } = require('./test-support/step2-load-ts.cjs');

let rows;
let orders;
let sessions;
let created;
const clone = (value) => (value == null ? value : structuredClone(value));
const matches = (row, where = {}) => {
  if (!where) return true;
  if (where.AND) return where.AND.every((part) => matches(row, part));
  if (where.OR) { if (!where.OR.some((part) => matches(row, part))) return false; }
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR') continue;
    const value = row[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      if (cond.in && !cond.in.includes(value)) return false;
      if (cond.notIn && cond.notIn.includes(value)) return false;
    } else if (value !== cond) return false;
  }
  return true;
};
const charterQuote = {
  findUnique: async ({ where }) => clone(rows.find((row) => row.id === where.id) || null),
  findMany: async ({ where, take } = {}) => clone(rows.filter((row) => matches(row, where)).slice(0, take || 100)),
  count: async ({ where } = {}) => rows.filter((row) => matches(row, where)).length,
  update: async ({ where, data }) => { const row = rows.find((item) => item.id === where.id); Object.assign(row, clone(data)); return clone(row); },
  updateMany: async ({ where, data }) => {
    const hit = rows.filter((row) => matches(row, where));
    for (const row of hit) Object.assign(row, clone(data));
    return { count: hit.length };
  },
  create: async ({ data }) => { created = { id: 'new-quote', ...clone(data) }; rows.push(created); return clone(created); },
};
const charterOrder = {
  findUnique: async ({ where }) => clone(orders.find((order) => order.quoteId === where.quoteId) || null),
  findMany: async ({ where }) => clone(orders.filter((order) => where.quoteId.in.includes(order.quoteId))),
  create: async () => { throw new Error('order create must not run in these tests'); },
};
const tx = { $queryRaw: async (_strings, id) => (rows.some((row) => row.id === id) ? [{ id }] : []), charterQuote, charterOrder };
const lineSession = {
  findUnique: async ({ where }) => clone(sessions[where.userId] || null),
  upsert: async ({ where, create }) => { sessions[where.userId] = clone(create); return create; },
};
mock('@/lib/prisma', { prisma: { ...tx, lineSession, $transaction: async (fn) => fn(tx) } });
let loggedIn = true;
mock('@/lib/adminQuoteAuth', {
  verifyAdminMutation: () => loggedIn,
  verifyAdminRequest: () => loggedIn,
  unauthorized: () => Response.json({ success: false }, { status: 401 }),
});
mock('@/lib/line/groupRelay', { relayGroupEvents: () => {} });
mock('@/lib/line/webhookEvents', {
  claimEvent: async () => ({ kind: 'untracked' }),
  markDelivered: async () => {}, markDeliveryFailed: async () => {}, recordBuilt: async () => {}, releaseClaim: async () => {},
});
mock('@/lib/members/lineMember', { lineMemberUid: () => null, rememberLineMember: async () => {} });
const pushed = [];
mock('@/lib/lineApi', { pushLineText: async (...args) => { pushed.push(args); } });

const archiveRoute = load('app/api/admin/quotes/[id]/archive/route.ts');
const restoreRoute = load('app/api/admin/quotes/[id]/restore/route.ts');
const prefillRoute = load('app/api/admin/quotes/prefill/route.ts');
const sendRoute = load('app/api/admin/quotes/[id]/send/route.ts');
const patchRoute = load('app/api/admin/quotes/[id]/route.ts');
const { convertConfirmedQuote } = load('lib/charterOrder.ts');
const { buildQuotePrefill, quoteEstimate, vehicleForCount } = load('lib/quotePrefill.ts');
const { tabWhere } = load('lib/quoteArchive.ts');

const req = (url, body) => new Request(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const archive = (id) => archiveRoute.POST(req(`/api/admin/quotes/${id}/archive`), { params: { id } });
const restore = (id) => restoreRoute.POST(req(`/api/admin/quotes/${id}/restore`), { params: { id } });
const backfill = (body = {}) => prefillRoute.POST(req('/api/admin/quotes/prefill', body));
const base = { lineUserId: 'U-mock', lineName: null, tripDate: '2026-12-01', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無', sentAt: null, createdAt: new Date('2026-11-01') };
const reset = () => {
  loggedIn = true;
  orders = [];
  sessions = {};
  created = null;
  pushed.length = 0;
  rows = [
    { ...base, id: 'q-new', recommendedVehicle: '', quoteOptions: [], quoteDraftText: '', quoteStatus: 'new' },
    { ...base, id: 'q-draft', recommendedVehicle: '43座', quoteOptions: [{ vehicle: 'x' }], quoteDraftText: 'old draft', quoteStatus: 'DRAFT' },
    { ...base, id: 'q-order', recommendedVehicle: '九人座賓士小車', quoteOptions: {}, quoteDraftText: 'd', quoteStatus: 'DRAFT' },
    { ...base, id: 'q-pending-order', recommendedVehicle: '九人座賓士小車', quoteOptions: {}, quoteDraftText: 'd', quoteStatus: 'ORDER_PENDING' },
  ];
  orders = [{ id: 'o1', quoteId: 'q-order' }];
};
const row = (id) => rows.find((item) => item.id === id);
const staffText = (prefill) => prefill.quoteOptions.autoDraft.staffLines.join('\n');

test('archive is soft, keeps the row and data, and restore returns the previous status', async () => {
  reset();
  const response = await archive('q-draft');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.sendsToCustomer, false);
  assert.equal(row('q-draft').quoteStatus, 'ARCHIVED');
  assert.equal(row('q-draft').quoteDraftText, 'old draft');
  assert.deepEqual(row('q-draft').quoteOptions.legacyOptions, [{ vehicle: 'x' }]);
  assert.equal(row('q-draft').quoteOptions.archive.previousStatus, 'DRAFT');
  assert.equal(rows.length, 4);
  assert.equal((await (await archive('q-draft')).json()).changed, false, 'second archive is a no-op');
  const restored = await restore('q-draft');
  assert.equal(restored.status, 200);
  assert.equal(row('q-draft').quoteStatus, 'DRAFT');
  assert.equal(row('q-draft').quoteOptions.archive, undefined);
  assert.deepEqual(row('q-draft').quoteOptions.legacyOptions, [{ vehicle: 'x' }]);
  await archive('q-new');
  await restore('q-new');
  assert.equal(row('q-new').quoteStatus, 'new');
  assert.equal(pushed.length, 0);
});

test('tabs: archived rows leave 待處理 and appear under 已移除', async () => {
  reset();
  await archive('q-new');
  const inTab = (tab) => rows.filter((item) => require('node:util').isDeepStrictEqual(true, (() => {
    const where = tabWhere(tab);
    const status = where.quoteStatus;
    if (typeof status === 'string') return item.quoteStatus === status;
    if (status.in) return status.in.includes(item.quoteStatus);
    return !status.notIn.includes(item.quoteStatus);
  })())).map((item) => item.id);
  assert.deepEqual(inTab('archived'), ['q-new']);
  assert.equal(inTab('pending').includes('q-new'), false);
  rows.push({ ...base, id: 'q-sent', quoteStatus: 'SENT', quoteDraftText: 'x', quoteOptions: {} });
  assert.deepEqual(inTab('sent'), ['q-sent']);
});

test('quotes with an order cannot be removed', async () => {
  reset();
  for (const id of ['q-order', 'q-pending-order']) {
    const response = await archive(id);
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /訂單/);
  }
  assert.equal(row('q-order').quoteStatus, 'DRAFT');
  assert.equal(row('q-pending-order').quoteStatus, 'ORDER_PENDING');
  assert.equal((await archive('missing')).status, 404);
});

test('archived quotes cannot be sent, ordered, or flipped through PATCH', async () => {
  reset();
  await archive('q-draft');
  const sent = await sendRoute.POST(req('/api/admin/quotes/q-draft/send'), { params: { id: 'q-draft' } });
  assert.equal(sent.status, 409);
  assert.equal(pushed.length, 0);
  const converted = await convertConfirmedQuote('q-draft');
  assert.equal(converted.ok, false);
  assert.match(converted.error, /已移除/);
  const patch = (id, quoteStatus) => patchRoute.PATCH(new Request(`http://localhost/api/admin/quotes/${id}`, { method: 'PATCH', body: JSON.stringify({ quoteStatus, quoteDraftText: 'x' }) }), { params: { id } });
  assert.equal((await patch('q-draft', 'DRAFT')).status, 409);
  assert.equal((await patch('q-new', 'ARCHIVED')).status, 409);
  assert.equal((await patch('q-draft', 'ARCHIVED')).status, 200, 'editing an archived draft keeps it archived');
  assert.equal(row('q-draft').quoteStatus, 'ARCHIVED');
});

test('401 without an admin session on archive, restore and batch prefill', async () => {
  reset();
  loggedIn = false;
  assert.equal((await archive('q-draft')).status, 401);
  assert.equal((await restore('q-draft')).status, 401);
  assert.equal((await backfill()).status, 401);
  assert.equal(row('q-draft').quoteStatus, 'DRAFT');
  assert.equal(row('q-new').quoteDraftText, '');
});

test('prefill uses the fleet rate table, never authorizes a fare from customer text, and lists what is missing', () => {
  assert.equal(vehicleForCount(6), '九人座賓士小車');
  assert.equal(vehicleForCount(9), 'TOYOTA 中巴');
  assert.equal(vehicleForCount(20), 'TOYOTA 中巴');
  assert.equal(vehicleForCount(30), '42 人座大巴');
  assert.equal(vehicleForCount(38), '42 人座大巴');
  assert.equal(vehicleForCount(39), '43座以上遊覽車／44～45座大巴', 'bus_rules.yaml: 39+ only big bus');
  const full = buildQuotePrefill({ ...base, remark: '10小時 台北到九份' }, 'backfill', new Date('2026-11-11T05:00:00Z'));
  assert.equal(full.sendsToCustomer, false);
  assert.equal(full.recommendedVehicle, '九人座賓士小車');
  assert.deepEqual(full.missing, ['路線方案', '時數']);
  assert.equal(/尚未送給客人|後台報價草稿|請人員核對/.test(full.quoteDraftText), false, 'no internal note in customer text');
  assert.match(full.quoteDraftText, /^出發：台北車站/);
  assert.match(staffText(full), /待補：路線方案、時數/);
  assert.match(staffText(full), /7000 元/, 'catalog reference is shown to staff only');
  assert.equal(full.quoteOptions.autoDraft.staffReviewed, false);
  assert.equal(full.quoteOptions.autoDraft.engine, 'fleetQuoteDraft');
  assert.equal(full.quoteOptions.autoDraft.sendsToCustomer, false);
  assert.equal(full.quoteOptions.fleetFare, undefined, 'no staff fare selection is invented');
  assert.equal(quoteEstimate({ ...base, quoteOptions: full.quoteOptions }).amountTwd, null);
  const sparse = buildQuotePrefill({ tripDate: '', passengerCount: null, pickup: '台北', destination: '', remark: '無' }, 'line-webhook');
  assert.deepEqual(sparse.missing, ['日期', '人數', '目的地', '行李件數', '單程或來回']);
  assert.equal(sparse.recommendedVehicle, '');
  assert.match(staffText(sparse), /行情表未涵蓋，待人工/);
  assert.match(staffText(sparse), /待補：日期、人數、目的地、行李件數、單程或來回/);
  assert.equal(/待補|行情表|待人工/.test(sparse.quoteDraftText), false);
  const explicit = buildQuotePrefill({ ...base, passengerCount: 6, remark: '想坐中巴' }, 'backfill');
  assert.equal(explicit.recommendedVehicle, 'TOYOTA 中巴', 'explicit vehicle in the remark wins over the head count');
});

test('estimate column shows the fare only after staff picks route and hours', () => {
  const quote = { ...base, recommendedVehicle: '九人座賓士小車', remark: '無' };
  const staff = { ...quote, quoteOptions: { fleetFare: { version: 1, rateId: 'taipei-jiufen-10h', hours: 10, source: { pickup: base.pickup, destination: base.destination, remark: '無' } } } };
  assert.equal(quoteEstimate(staff).amountTwd, 7000);
  assert.deepEqual(quoteEstimate(staff).missing, []);
  assert.deepEqual(quoteEstimate({ ...quote, quoteOptions: [] }).missing, ['路線方案', '時數']);
});

test('batch backfill fills only never-generated rows, writes draft fields only, and is idempotent', async () => {
  reset();
  rows.push({ ...base, id: 'q-new-archived', recommendedVehicle: '', quoteOptions: [], quoteDraftText: '', quoteStatus: 'ARCHIVED' });
  rows.push({ ...base, id: 'q-new-ordered', recommendedVehicle: '', quoteOptions: [], quoteDraftText: null, quoteStatus: 'new' });
  orders.push({ id: 'o2', quoteId: 'q-new-ordered' });
  const before = clone(rows);
  const dry = await (await backfill({ dryRun: true })).json();
  assert.deepEqual(dry.generated, ['q-new']);
  assert.deepEqual(rows, before, 'dry run writes nothing');
  const first = await (await backfill()).json();
  assert.equal(first.sendsToCustomer, false);
  assert.deepEqual(first.generated, ['q-new']);
  assert.deepEqual(first.skipped, [{ id: 'q-new-ordered', reason: '已有訂單' }]);
  const filled = row('q-new');
  assert.equal(filled.quoteStatus, 'new', 'status is not changed');
  assert.equal(filled.recommendedVehicle, '九人座賓士小車');
  assert.equal(filled.quoteDraftText.includes('自動預生成'), false);
  assert.match(filled.quoteOptions.autoDraft.staffNote, /自動預生成草稿/);
  assert.equal(filled.quoteOptions.autoDraft.trigger, 'backfill');
  for (const id of ['q-draft', 'q-new-archived', 'q-order']) assert.deepEqual(row(id), before.find((item) => item.id === id));
  const snapshot = clone(rows);
  const second = await (await backfill()).json();
  assert.deepEqual(second.generated, []);
  assert.deepEqual(rows, snapshot, 'second run changes nothing');
  assert.equal(pushed.length, 0);
});

test('LINE webhook pre-generates a staff draft on the new quote and never pushes it', async () => {
  reset();
  process.env.LINE_CHANNEL_SECRET = 'test-secret';
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
  delete process.env.LINE_ADMIN_USER_ID;
  delete process.env.ADMIN_LINE_USER_ID;
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url: String(url), body: String(init && init.body || '') }); return new Response('{}', { status: 200 }); };
  try {
    const route = load('app/api/line/webhook/route.ts');
    const send = async (text) => {
      const body = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', webhookEventId: 'e1', source: { type: 'user', userId: 'U-customer' }, message: { type: 'text', text } }] });
      const signature = crypto.createHmac('sha256', 'test-secret').update(body).digest('base64');
      return route.POST(new Request('http://localhost/api/line/webhook', { method: 'POST', headers: { 'x-line-signature': signature }, body }));
    };
    sessions['U-customer'] = { userId: 'U-customer', state: 'QUOTED', draftJson: { date: '2026-12-01', people: 6, origin: '台北車站', destination: '九份', note: '無' } };
    const response = await send('我要正式報價');
    assert.equal(response.status, 200);
    assert.ok(created, 'quote row created');
    assert.equal(created.quoteStatus, 'new');
    assert.equal(created.recommendedVehicle, '九人座賓士小車');
    assert.ok(created.quoteDraftText.length > 0);
    assert.equal(created.quoteDraftText.includes('自動預生成'), false);
    assert.equal(created.quoteOptions.autoDraft.staffReviewed, false);
    assert.equal(created.quoteOptions.autoDraft.trigger, 'line-webhook');
    assert.equal(created.quoteOptions.autoDraft.sendsToCustomer, false);
    assert.equal(calls.length, 1, 'only the normal LINE reply');
    assert.equal(calls[0].url, 'https://api.line.me/v2/bot/message/reply');
    assert.equal(calls.some((call) => /push/.test(call.url)), false);
    assert.equal(calls[0].body.includes('自動預生成'), false, 'the draft is not in the customer reply');
    assert.equal(/7000|7,000/.test(calls[0].body), false, 'no price in the customer reply');

    // With the existing staff notification configured, the push goes to staff only and carries no draft.
    process.env.LINE_ADMIN_USER_ID = 'U-staff';
    calls.length = 0;
    created = null;
    sessions['U-customer'] = { userId: 'U-customer', state: 'QUOTED', draftJson: { date: '2026-12-02', people: 30, origin: '台北', destination: '台中', note: '無' } };
    await send('我要正式報價');
    assert.equal(created.recommendedVehicle, '42 人座大巴');
    const pushes = calls.filter((call) => /push/.test(call.url));
    assert.equal(pushes.length, 1);
    assert.equal(JSON.parse(pushes[0].body).to, 'U-staff');
    assert.equal(pushes[0].body.includes('自動預生成'), false);
    assert.equal(calls.some((call) => /push/.test(call.url) && JSON.parse(call.body).to === 'U-customer'), false);
  } finally {
    global.fetch = realFetch;
    delete process.env.LINE_ADMIN_USER_ID;
  }
});

// ---- 知識庫行情（報價機器人）：大巴或沒有車隊費率時 ----
const { knowledgeQuote, classifyKnowledgeRoute } = load('lib/quoteKnowledge.ts');
const kb = { lineUserId: 'U', tripDate: '2026-12-05', remark: '無' };
const firstLines = (prefill) => ({ body: prefill.quoteDraftText.split('\n').slice(0, 3), staff: prefill.quoteOptions.autoDraft.staffLines.slice(0, 2) });
const drafts = {};
const record = (name, prefill) => { drafts[name] = firstLines(prefill); return prefill; };

test('KB: 樹林→花蓮 42 人 is not in the table, so it is marked uncovered (no forced range)', () => {
  assert.equal(classifyKnowledgeRoute('樹林', '花蓮'), 'uncovered');
  const p = record('樹林→花蓮 42 人', buildQuotePrefill({ ...kb, pickup: '樹林', destination: '花蓮', passengerCount: 42 }, 'backfill'));
  assert.equal(p.recommendedVehicle, '43座以上遊覽車／44～45座大巴');
  assert.equal(p.quoteOptions.autoDraft.engine, 'knowledgeBase');
  assert.match(staffText(p), /行情表未涵蓋，待人工/);
  assert.equal(/參考行情 NT\$/.test(staffText(p) + p.quoteDraftText), false, 'no range for an uncovered route');
  const e = quoteEstimate({ ...kb, pickup: '樹林', destination: '花蓮', passengerCount: 42, recommendedVehicle: p.recommendedVehicle });
  assert.equal(e.amountTwd, null);
  assert.equal(e.summary, '參考行情：行情表未涵蓋，待人工｜待補：行李件數、單程或來回');
});

test('KB: 樹林→台中 30 人 gets the central round-trip reference 16,000～22,000 and pending fields', () => {
  const p = record('樹林→台中 30 人', buildQuotePrefill({ ...kb, pickup: '樹林', destination: '台中', passengerCount: 30 }, 'backfill'));
  assert.equal(p.recommendedVehicle, '42 人座大巴');
  assert.match(staffText(p), /參考行情 NT\$16,000～22,000（知識庫 pricing_matrix/);
  assert.match(staffText(p), /這不是確定金額/);
  assert.match(staffText(p), /待補：行李件數、單程或來回/);
  assert.match(staffText(p), /司機小費 NT\$1,000～2,000／天、司機誤餐費 NT\$250／餐、工時計算不含空車回送、發票 5%、過路費、停車費/);
  const e = quoteEstimate({ ...kb, pickup: '樹林', destination: '台中', passengerCount: 30, recommendedVehicle: '42 人座大巴' });
  assert.equal(e.summary, '參考行情 16,000～22,000｜待補：行李件數、單程或來回');
  assert.equal(e.amountTwd, null);
  const full = quoteEstimate({ ...kb, pickup: '樹林', destination: '台中', passengerCount: 30, recommendedVehicle: '42 人座大巴', remark: '來回，每人一件行李' });
  assert.equal(full.summary, '參考行情 16,000～22,000');
});

test('KB: 樹林→日月潭 is mountain: base from pricing_rules.py plus 山區另加價', () => {
  const p = record('樹林→日月潭', buildQuotePrefill({ ...kb, pickup: '樹林', destination: '日月潭', passengerCount: 30 }, 'backfill'));
  assert.match(staffText(p), /參考行情 NT\$16,000～22,000/);
  assert.match(staffText(p), /日月潭、清境、山區另加價/);
  assert.equal(quoteEstimate({ ...kb, pickup: '樹林', destination: '日月潭', passengerCount: 30, recommendedVehicle: '42 人座大巴' }).summary, '參考行情 16,000～22,000＋山區加價｜待補：行李件數、單程或來回');
});

test('KB: south long-haul follows pricing_matrix.yaml (24,000～35,000), not pricing_rules.py', () => {
  for (const city of ['嘉義', '台南', '高雄', '屏東']) assert.equal(classifyKnowledgeRoute('台北', city), 'taipei_to_south_long');
  assert.equal(knowledgeQuote({ pickup: '板橋', destination: '高雄' }).range.low, 24000);
  assert.equal(knowledgeQuote({ pickup: '板橋', destination: '高雄' }).range.high, 35000);
  assert.equal(classifyKnowledgeRoute('台北', '桃園'), 'taipei_to_taoyuan_hsinchu');
  assert.equal(classifyKnowledgeRoute('台北', '台北'), 'taipei_city_short');
  assert.equal(classifyKnowledgeRoute('台中', '台北'), 'uncovered', 'origin outside the northern list is not guessed');
});

test('KB: one-day round-Taiwan is blocked with 2–4 day alternatives and no price', () => {
  const p = record('一日環島', buildQuotePrefill({ ...kb, pickup: '台北', destination: '一日環島', passengerCount: 30 }, 'backfill'));
  assert.match(staffText(p), /一日環島不受理：環島約950-1000公里；法規每日駕車10小時、每日總工時12小時/);
  assert.match(staffText(p), /二日環島、三日環島、四日深度環島/);
  assert.equal(/參考行情 NT\$/.test(staffText(p) + p.quoteDraftText), false);
});

test('KB: 42 people with 28-inch luggage adds the luggage warning', () => {
  const p = record('42 人＋28 吋行李', buildQuotePrefill({ ...kb, pickup: '台北', destination: '桃園', passengerCount: 42, remark: '單程，每人一個28吋行李' }, 'backfill'));
  assert.match(staffText(p), /參考行情 NT\$12,500～15,000/);
  assert.match(staffText(p), /行李警示：42人以上且每人攜帶28吋行李時，44~45座大巴約可放置35件左右28吋行李/);
  assert.match(staffText(p), /待補：無/);
  assert.equal(knowledgeQuote({ pickup: '台北', destination: '桃園', passengerCount: 41, remark: '28吋' }).warnings.length, 0);
});

test('KB: reference ranges never become amounts or order prices', async () => {
  reset();
  rows.push({ ...base, id: 'q-bus', pickup: '樹林', destination: '台中', passengerCount: 30, recommendedVehicle: '42 人座大巴', quoteOptions: {}, quoteDraftText: 'x', quoteStatus: 'DRAFT' });
  assert.equal(quoteEstimate(row('q-bus')).amountTwd, null);
  const converted = await convertConfirmedQuote('q-bus');
  assert.equal(converted.ok, false, 'no CharterOrder from a knowledge-base range');
  assert.equal(knowledgeQuote({ pickup: '樹林', destination: '台中' }).amountTwd, null);
  // small vehicles with fleet rates still use the fleet table
  assert.equal(buildQuotePrefill({ ...base }, 'backfill').quoteOptions.autoDraft.engine, 'fleetQuoteDraft');
});

test('KB: draft first lines (written to evidence)', () => {
  const out = process.env.QUOTES_KB_EVIDENCE;
  if (out) require('node:fs').writeFileSync(out, JSON.stringify(drafts, null, 2));
  assert.equal(Object.keys(drafts).length, 5);
});

// ---- 送出守門：知識庫區間、待補與內部說明永遠不會送到客人 ----
const { sendBlock, forbiddenMarkersIn, reviewOnSave } = load('lib/quoteSendGuard.ts');
const sendQuote = (id) => sendRoute.POST(req(`/api/admin/quotes/${id}/send`), { params: { id } });
const patchQuote = (id, body) => patchRoute.PATCH(new Request(`http://localhost/api/admin/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), { params: { id } });
const FORBIDDEN_IN_BODY = /參考行情|自動預生成|16,000|22,000|待補|行情表|待人工|尚未送給客人|知識庫|pricing_matrix/;
const sendEvidence = {};

test('guard: 40 人 台北→台中 untouched auto draft is refused with 409 and nothing is pushed', async () => {
  reset();
  const prefill = buildQuotePrefill({ ...base, pickup: '台北', destination: '台中', passengerCount: 40 }, 'backfill');
  assert.equal(prefill.recommendedVehicle, '43座以上遊覽車／44～45座大巴');
  assert.equal(FORBIDDEN_IN_BODY.test(prefill.quoteDraftText), false, 'customer body has no range, 待補 or internal note');
  assert.match(staffText(prefill), /參考行情 NT\$16,000～22,000/, 'range is kept for staff in quoteOptions');
  rows.push({ ...base, id: 'q-kb', pickup: '台北', destination: '台中', passengerCount: 40, quoteStatus: 'new', ...prefill });
  const before = clone(row('q-kb'));
  const response = await sendQuote('q-kb');
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.code, 'AUTO_DRAFT_UNREVIEWED');
  assert.equal(pushed.length, 0);
  assert.deepEqual(row('q-kb'), before, 'status and sentAt unchanged');
  // Saving the same generated text does not count as review.
  assert.equal((await patchQuote('q-kb', { recommendedVehicle: before.recommendedVehicle, quoteDraftText: before.quoteDraftText, quoteStatus: 'new' })).status, 200);
  assert.equal(row('q-kb').quoteOptions.autoDraft.staffReviewed, false);
  assert.equal((await sendQuote('q-kb')).status, 409);
  assert.equal(pushed.length, 0);
  sendEvidence.untouched = { status: response.status, body, pushedCount: pushed.length, customerBody: prefill.quoteDraftText, staffLines: prefill.quoteOptions.autoDraft.staffLines };
});

test('guard: after staff edit and save, the draft sends OK with exactly the edited text', async () => {
  reset();
  const prefill = buildQuotePrefill({ ...base, pickup: '台北', destination: '台中', passengerCount: 40 }, 'backfill');
  rows.push({ ...base, id: 'q-kb', pickup: '台北', destination: '台中', passengerCount: 40, quoteStatus: 'new', ...prefill });
  const edited = '您好，台北到台中來回 44 座大巴，報價 NT$20,000（含稅，不含司機小費）。';
  const saved = await patchQuote('q-kb', { recommendedVehicle: prefill.recommendedVehicle, quoteDraftText: edited, quoteStatus: 'DRAFT' });
  assert.equal(saved.status, 200);
  const meta = row('q-kb').quoteOptions.autoDraft;
  assert.equal(meta.staffReviewed, true);
  assert.ok(meta.reviewedAt);
  assert.equal(meta.engine, 'knowledgeBase', 'other metadata is kept');
  const response = await sendQuote('q-kb');
  assert.equal(response.status, 200);
  assert.deepEqual(pushed, [['U-mock', edited]]);
  assert.equal(row('q-kb').quoteStatus, 'SENT');
  sendEvidence.edited = { status: response.status, pushed: clone(pushed) };
});

test('guard: any outgoing text with 參考行情 or 自動預生成 is rejected, even on legacy rows', async () => {
  reset();
  assert.deepEqual(forbiddenMarkersIn('參考行情 NT$16,000～22,000'), ['參考行情', '參考摘要']);
  assert.deepEqual(forbiddenMarkersIn('【自動預生成草稿】x'), ['自動預生成']);
  assert.deepEqual(forbiddenMarkersIn('正式報價 NT$20,000'), []);
  rows.push({ ...base, id: 'q-legacy-ref', quoteOptions: [], quoteDraftText: '您好，參考行情 NT$16,000～22,000', quoteStatus: 'DRAFT' });
  rows.push({ ...base, id: 'q-legacy-note', quoteOptions: {}, quoteDraftText: '【自動預生成草稿】尚未送給客人。', quoteStatus: 'DRAFT' });
  for (const id of ['q-legacy-ref', 'q-legacy-note']) {
    const response = await sendQuote(id);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'FORBIDDEN_MARKER');
  }
  // Reviewed auto draft whose saved text still carries a marker is also refused.
  const prefill = buildQuotePrefill({ ...base, pickup: '台北', destination: '台中', passengerCount: 40 }, 'backfill');
  rows.push({ ...base, id: 'q-kb', quoteStatus: 'new', ...prefill });
  await patchQuote('q-kb', { quoteDraftText: '參考行情 NT$16,000～22,000', quoteStatus: 'DRAFT' });
  assert.equal(row('q-kb').quoteOptions.autoDraft.staffReviewed, true);
  const response = await sendQuote('q-kb');
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'FORBIDDEN_MARKER');
  assert.equal(pushed.length, 0);
  // Legacy draft without markers keeps the old behaviour.
  assert.equal((await sendQuote('q-draft')).status, 200);
  assert.deepEqual(pushed, [['U-mock', 'old draft']]);
  assert.equal(sendBlock({ quoteDraftText: 'ok', quoteOptions: { autoDraft: { staffReviewed: true } } }), null);
  assert.equal(reviewOnSave({}, 'x'), null, 'rows without autoDraft are untouched');
  sendEvidence.markers = { legacyRef: 409, legacyNote: 409, reviewedWithMarker: 409, cleanLegacy: 200 };
});

test('guard: fleet-table drafts keep the company price but no internal note, and still need review', async () => {
  reset();
  const prefill = buildQuotePrefill({ ...base, recommendedVehicle: '九人座賓士小車', remark: '無' }, 'backfill');
  assert.equal(prefill.quoteOptions.autoDraft.engine, 'fleetQuoteDraft');
  assert.equal(FORBIDDEN_IN_BODY.test(prefill.quoteDraftText), false);
  assert.match(prefill.quoteDraftText, /車型：九人座賓士小車/);
  rows.push({ ...base, id: 'q-van', quoteStatus: 'new', ...prefill });
  assert.equal((await sendQuote('q-van')).status, 409);
  assert.equal(pushed.length, 0);
});

test('guard: batch prefill stays idempotent and never writes a range or note into quoteDraftText', async () => {
  reset();
  rows.push({ ...base, id: 'q-bus-new', pickup: '樹林', destination: '台中', passengerCount: 40, recommendedVehicle: '', quoteOptions: [], quoteDraftText: '', quoteStatus: 'new' });
  rows.push({ ...base, id: 'q-hualien-new', pickup: '樹林', destination: '花蓮', passengerCount: 42, recommendedVehicle: '', quoteOptions: [], quoteDraftText: null, quoteStatus: 'new' });
  const first = await (await backfill()).json();
  assert.deepEqual(first.generated.sort(), ['q-bus-new', 'q-hualien-new', 'q-new']);
  for (const id of first.generated) {
    assert.equal(FORBIDDEN_IN_BODY.test(row(id).quoteDraftText), false, `${id} body is customer-only`);
    assert.equal(row(id).quoteOptions.autoDraft.staffReviewed, false);
  }
  assert.match(row('q-bus-new').quoteOptions.autoDraft.reference, /^參考行情 16,000～22,000/);
  const snapshot = clone(rows);
  assert.deepEqual((await (await backfill()).json()).generated, []);
  assert.deepEqual(rows, snapshot);
  assert.equal(pushed.length, 0);
  const out = process.env.QUOTES_SEND_EVIDENCE;
  if (out) require('node:fs').writeFileSync(out, JSON.stringify({ ...sendEvidence, batch: { generated: first.generated, secondRunGenerated: [], pushedCount: pushed.length } }, null, 2));
});

// ---- v4：貼上後台摘要、只貼區間數字、只寫「待補」都擋；人員自己的單一金額與車隊價照常可送 ----
const { containsKnowledgeRange, compactForMatch } = load('lib/quoteSendGuard.ts');
const bypassEvidence = {};
async function reviewedRow(id, source, text) {
  const prefill = buildQuotePrefill(source, 'backfill');
  rows.push({ ...base, ...source, id, quoteStatus: 'new', ...prefill });
  const saved = await patchQuote(id, { recommendedVehicle: prefill.recommendedVehicle, quoteDraftText: text, quoteStatus: 'DRAFT' });
  assert.equal(saved.status, 200);
  assert.equal(row(id).quoteOptions.autoDraft.staffReviewed, true, `${id} counts as edited`);
  const response = await sendQuote(id);
  const body = await response.json();
  return { status: response.status, code: body.code || null, pushed: pushed.length };
}
const busSource = { pickup: '台北', destination: '台中', passengerCount: 40, remark: '無' };
const vanSource = { pickup: '台北車站', destination: '九份', passengerCount: 6, recommendedVehicle: '九人座賓士小車', remark: '無' };

test('v4: every admin summary and staff line starts with 參考行情', () => {
  const bus = buildQuotePrefill(busSource, 'backfill').quoteOptions.autoDraft;
  const van = buildQuotePrefill(vanSource, 'backfill').quoteOptions.autoDraft;
  for (const meta of [bus, van]) {
    assert.match(meta.reference, /^參考行情/);
    assert.match(meta.staffNote, /^參考行情/);
    for (const line of meta.staffLines) assert.match(line, /^參考行情/, line);
  }
  assert.deepEqual(bus.range, { low: 16000, high: 22000 });
  assert.match(van.reference, /^參考行情 車隊表 九人座賓士小車 .* 7000 元$/);
  assert.match(quoteEstimate({ ...base, pickup: '樹林', destination: '花蓮', passengerCount: 42 }).summary, /^參考行情：行情表未涵蓋/);
  assert.match(quoteEstimate({ ...base, pickup: '台北', destination: '一日環島', passengerCount: 30 }).summary, /^參考行情：一日環島不受理/);
});

test('v4: pasting the list summary (bus) is 409 and nothing is pushed', async () => {
  reset();
  const summary = buildQuotePrefill(busSource, 'backfill').quoteOptions.autoDraft.reference;
  const cases = {
    current: `您好，${summary}`,
    reviewerOldFormat: '您好，參考 16,000～22,000｜待補：行李件數、單程或來回',
    withoutPrefix: summary.replace(/^參考行情\s*/, ''),
  };
  for (const [name, text] of Object.entries(cases)) {
    const result = await reviewedRow(`q-sum-${name}`, busSource, text);
    assert.equal(result.status, 409, name);
    bypassEvidence[`busSummary_${name}`] = result;
  }
  assert.equal(pushed.length, 0);
});

test('v4: pasting the fleet summary is 409, in current and old display formats (line start / after ｜)', async () => {
  reset();
  const meta = buildQuotePrefill(vanSource, 'backfill').quoteOptions.autoDraft;
  const fleetLine = meta.reference.replace(/^參考行情 車隊表 /, '');
  const cases = {
    current: meta.reference,
    reviewerOldFormatLineStart: `\n參考 ${fleetLine}`,
    afterBar: `｜參考 ${fleetLine}`,
    staffLineFull: meta.staffLines[1],
    staffLineNoPrefix: meta.staffLines[1].replace(/^參考行情｜/, ''),
  };
  for (const [name, text] of Object.entries(cases)) {
    const result = await reviewedRow(`q-fleet-${name}`, vanSource, `您好，${text}`);
    assert.equal(result.status, 409, name);
    bypassEvidence[`fleetSummary_${name}`] = result;
  }
  assert.equal(pushed.length, 0);
});

test('v4: range numbers alone are 409 in every format, for this row and any table range', async () => {
  reset();
  const formats = [
    '16000~22000', '16,000～22,000', '16,000-22,000', '16,000–22,000', '16000—22000', 'NT$16,000～NT$22,000',
    '16,000元~22,000元', '１６，０００～２２，０００', '16 000 ~ 22 000', '16,000至22,000', '1.6萬～2.2萬', '1.6~2.2萬', '16k-22k',
    '大約 NT$ 16,000 ~ 22,000 元', '11,000～12,500', '24000-35000', '12,500~15,000',
  ];
  bypassEvidence.rangeFormats = {};
  for (const [index, text] of formats.entries()) {
    assert.equal(containsKnowledgeRange(text, { low: 16000, high: 22000 }), true, text);
    const result = await reviewedRow(`q-range-${index}`, busSource, `您好，台北到台中 44 座大巴，${text}。`);
    assert.equal(result.status, 409, text);
    assert.equal(result.code, 'KNOWLEDGE_RANGE', text);
    bypassEvidence.rangeFormats[text] = result.status;
  }
  assert.equal(containsKnowledgeRange('NT$18,000'), false);
  assert.equal(containsKnowledgeRange('司機小費 NT$1,000～2,000／天'), false, 'tip guidance is not a bus range');
  assert.equal(compactForMatch('１６，０００　～　２２，０００'), '16000~22000');
  assert.equal(pushed.length, 0);
});

test('v4: 待補 alone and every internal marker are 409', async () => {
  reset();
  const texts = ['您好，待補', '您好，待補：行李件數', '內部參考', '待人工', '行情表未涵蓋', '參考行情', '自動預生成', '後台報價草稿', '待　補', '知識庫'];
  bypassEvidence.markers = {};
  for (const [index, text] of texts.entries()) {
    const result = await reviewedRow(`q-mark-${index}`, busSource, text);
    assert.equal(result.status, 409, text);
    assert.equal(result.code, 'FORBIDDEN_MARKER', text);
    bypassEvidence.markers[text] = result.status;
  }
  assert.equal(pushed.length, 0);
});

test('v4: legitimate staff quotes send 200 — bus with one chosen amount, fleet with the company price', async () => {
  reset();
  const busText = '您好，台北到台中來回，44 座大巴一台，報價 NT$18,000（含稅，不含司機小費、過路費、停車費）。';
  const bus = await reviewedRow('q-legit-bus', busSource, busText);
  assert.equal(bus.status, 200);
  const vanDraft = buildQuotePrefill(vanSource, 'backfill').quoteDraftText;
  const vanText = `${vanDraft}\n\n報價：九人座賓士小車 台北至九份 10 小時，基本車資 NT$7,000。`;
  const van = await reviewedRow('q-legit-van', vanSource, vanText);
  assert.equal(van.status, 200);
  const vanShort = await reviewedRow('q-legit-van2', vanSource, '您好，九人座賓士小車台北一日 10 小時包車 7000 元，含司機。');
  assert.equal(vanShort.status, 200);
  assert.equal(pushed.length, 3);
  assert.equal(pushed[0][1], cleanSaved(busText));
  bypassEvidence.legitimate = { bus, van, vanShort, pushedTexts: pushed.map((item) => item[1]) };
  const out = process.env.QUOTES_BYPASS_EVIDENCE;
  if (out) require('node:fs').writeFileSync(out, JSON.stringify(bypassEvidence, null, 2));
});
function cleanSaved(text) { return text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim(); }
