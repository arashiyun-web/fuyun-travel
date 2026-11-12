// v10: regenerateLegacy replaces an old-format draft only when it is byte for byte the v5 button output
// for the row's own data; anything else is 「舊格式但可能已被人員修改」. Unedited v8 auto drafts are still
// regenerated. legacyDraft is shown read-only and restored with one admin POST. regenerateLegacy must be
// the boolean true whenever ids are given. Prisma and LINE are mocked; nothing is sent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mock, load } = require('./test-support/step2-load-ts.cjs');

const { createQuoteDb, clone } = require('./test-support/quote-db-mock.cjs');
const store = createQuoteDb();
const { db } = store;
let rows = db.rows;
const orders = db.orders;
const writes = db.writes;
const setRows = (list) => { db.rows.length = 0; db.rows.push(...list); rows = db.rows; };
mock('@/lib/prisma', { prisma: store.prisma });
let loggedIn = true;
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => loggedIn, verifyAdminRequest: () => loggedIn, unauthorized: () => Response.json({ success: false }, { status: 401 }) });
const pushed = [];
mock('@/lib/lineApi', { pushLineText: async (to, text) => { pushed.push(text); } });

const { buildQuotePrefill } = load('lib/quotePrefill.ts');
const { legacyV5DraftForRow, isUntouchedLegacyV5Draft } = load('lib/legacyFleetDraftV5.ts');
const { legacyDraftView } = load('lib/quotePanelText.ts');
const { LEGACY_MAYBE_EDITED } = load('lib/quoteArchive.ts');
const { forbiddenMarkersIn } = load('lib/quoteSendGuard.ts');
const prefillRoute = load('app/api/admin/quotes/prefill/route.ts');
const restoreRoute = load('app/api/admin/quotes/[id]/legacy-restore/route.ts');
const sendRoute = load('app/api/admin/quotes/[id]/send/route.ts');
const patchRoute = load('app/api/admin/quotes/[id]/route.ts');
// Fictional row; its draft is the original e42ac37 v5 generator output (see the fixture's _note).
const REAL = require('./fixtures/legacy-v5-draft-sample.json');

const prefill = async (body, raw) => { const r = await prefillRoute.POST(new Request('http://x/prefill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw !== undefined ? raw : JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
const restore = async (id) => { const r = await restoreRoute.POST(new Request(`http://x/${id}/legacy-restore`, { method: 'POST' }), { params: { id } }); return { status: r.status, body: await r.json() }; };
const send = async (id) => { const r = await sendRoute.POST(new Request('http://x/s', { method: 'POST' }), { params: { id } }); return r.status; };
const save = async (id, text, status = 'new') => (await patchRoute.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: text, quoteStatus: status }) }), { params: { id } })).status;
const get = (id) => rows.find((r) => r.id === id);

const STAFF_LINE = '7:00 飯店接、回程送松山機場，已電話確認';
const CREATED = new Date('2026-06-25T02:00:00Z');
const fleetFare = (row, rateId, hours) => ({ version: 1, rateId, hours, source: { pickup: row.pickup || '', destination: row.destination || '', remark: row.remark || '' } });
/** A row whose draft is what the v5 button wrote (vehicleHint = recommendedVehicle, fare stored in fleetFare). */
const v5Row = (id, data, rateId = null, hours = null, extra = {}) => {
  const row = { lineUserId: 'U-mock', quoteStatus: 'new', sentAt: null, createdAt: CREATED, recommendedVehicle: '', ...data, id };
  row.quoteOptions = { legacyOptions: [], fleetFare: fleetFare(row, rateId, hours) };
  row.quoteDraftText = legacyV5DraftForRow(row);
  return { ...row, ...extra };
};
const VAN = { tripDate: '8/7', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無', recommendedVehicle: '九人座賓士小車' };
const BUS = { tripDate: '8/7', passengerCount: 40, pickup: '台北', destination: '台北市區', remark: '無行李 單程' };
const v8Row = (id) => {
  const p = buildQuotePrefill({ ...BUS, quoteOptions: [] }, 'backfill', new Date('2026-11-11T07:58:59Z'));
  return { ...BUS, id, lineUserId: 'U-mock', quoteStatus: 'new', sentAt: null, createdAt: CREATED, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions };
};

const EDITS = {
  '人員補一行（救火員案例）': (t) => `${t}\n${STAFF_LINE}`,
  '人員補在中間': (t) => t.replace('\n\n車資\n', `\n${STAFF_LINE}\n\n車資\n`),
  '行尾多一個空白': (t) => `${t} `,
  '中間多一個空白': (t) => t.replace('出發：', '出發： '),
  '多一個空行': (t) => t.replace('\n\n車資', '\n\n\n車資'),
  'CRLF 換行': (t) => t.replace(/\n/g, '\r\n'),
  '全形空白': (t) => t.replace('人數：', '人數：\u3000'),
  'tab': (t) => t.replace('目的：', '目的：\t'),
  '句號改逗號': (t) => t.replace('尚未送給客人。', '尚未送給客人，'),
  '刪一個句號': (t) => t.replace('本按鈕不會自動傳送。', '本按鈕不會自動傳送'),
  '全形標點改半形': (t) => t.replace('出發：', '出發:'),
  '前面多空行': (t) => `\n${t}`,
  '改人數': (t) => t.replace('人數：', '人數：約'),
};

test('the frozen v5 generator reproduces a stored v5 draft (fixture from the original e42ac37 generator) byte for byte (eligible)', () => {
  assert.equal(legacyV5DraftForRow(REAL), REAL.quoteDraftText);
  assert.equal(isUntouchedLegacyV5Draft(REAL), true);
  for (const [name, edit] of Object.entries(EDITS)) assert.equal(isUntouchedLegacyV5Draft({ ...REAL, quoteDraftText: edit(REAL.quoteDraftText) }), false, name);
});

test('old-format + staff line / whitespace / punctuation edits are skipped as 「舊格式但可能已被人員修改」, dry run lists them as skipped', async () => {
  const ids = [];
  setRows([]);
  for (const [i, [name, edit]] of Object.entries(EDITS).entries()) {
    for (const [src, rate, hours] of [[REAL, null, null], [VAN, 'taipei-jiufen-10h', 10]]) {
      const base = src === REAL ? { ...clone(REAL), id: `e${i}-real`, lineUserId: 'U-mock' } : v5Row(`e${i}-van`, VAN, rate, hours);
      const edited = edit(base.quoteDraftText);
      assert.notEqual(edited, base.quoteDraftText, `${name} changes the text`);
      base.quoteDraftText = edited;
      base.name = name;
      db.rows.push(base); ids.push(base.id);
    }
  }
  orders.length = 0;
  const before = clone(db.rows);
  writes.length = 0;
  for (const dryRun of [true, false]) {
    const r = await prefill({ regenerateLegacy: true, ids, dryRun });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.generated, [], `dryRun=${dryRun}`);
    assert.equal(r.body.skipped.length, ids.length);
    for (const s of r.body.skipped) assert.equal(s.reason, LEGACY_MAYBE_EDITED, `${s.id} ${get(s.id).name}`);
  }
  assert.equal(LEGACY_MAYBE_EDITED, '舊格式但可能已被人員修改');
  assert.deepEqual(writes, []); assert.deepEqual(db.rows, before);
});

test('untouched old-format drafts (real row + v5 van with route) and an unedited v8 auto draft are regenerated; edited ones are not', async () => {
  const van = v5Row('van-v5', VAN, 'taipei-jiufen-10h', 10);
  assert.match(van.quoteDraftText, /基本車資 7000 元/);
  const vanEdited = v5Row('van-v5-edited', VAN, 'taipei-jiufen-10h', 10); vanEdited.quoteDraftText += `\n${STAFF_LINE}`;
  const v8 = v8Row('v8-auto');
  const v8Edited = v8Row('v8-edited');
  setRows([{ ...clone(REAL), lineUserId: 'U-mock' }, van, vanEdited, v8, v8Edited]);
  orders.length = 0;
  assert.equal(await save('v8-edited', `${v8Edited.quoteDraftText}\n${STAFF_LINE}`), 200);
  const keep = clone([get('van-v5-edited'), get('v8-edited')]);
  const ids = [REAL.id, 'van-v5', 'van-v5-edited', 'v8-auto', 'v8-edited'];
  writes.length = 0;
  const dry = await prefill({ regenerateLegacy: true, ids, dryRun: true });
  assert.deepEqual(dry.body.generated, [REAL.id, 'van-v5', 'v8-auto']);
  assert.deepEqual(Object.fromEntries(dry.body.skipped.map((s) => [s.id, s.reason])), { 'van-v5-edited': LEGACY_MAYBE_EDITED, 'v8-edited': '草稿不是舊格式或已被人員修改' });
  assert.deepEqual(writes, []);
  const run = await prefill({ regenerateLegacy: true, ids });
  assert.deepEqual(run.body.generated, [REAL.id, 'van-v5', 'v8-auto']);
  assert.deepEqual([get('van-v5-edited'), get('v8-edited')], keep, 'edited drafts byte-identical');
  const real = get(REAL.id);
  assert.equal(real.quoteDraftText.startsWith('【後台報價草稿】'), false);
  assert.equal(forbiddenMarkersIn(real.quoteDraftText).length, 0);
  assert.equal(real.quoteOptions.legacyDraft.text, REAL.quoteDraftText);
  assert.equal(real.quoteOptions.legacyDraft.kind, 'legacyV5');
  assert.equal(real.quoteOptions.regenerated.kind, 'legacyV5');
  assert.deepEqual(real.quoteOptions.fleetFare, REAL.quoteOptions.fleetFare);
  assert.ok(real.quoteDraftText.includes('10/18'));
  assert.equal(get('v8-auto').quoteOptions.legacyDraft.kind, 'autoDraft');
  assert.ok(get('v8-auto').quoteDraftText.includes('8/7（週五）為平日，NT$2,500'));
  assert.deepEqual(pushed, []);
});

test('legacyDraft restore: admin POST sets the draft back, clears the regenerated marker, is idempotent', async () => {
  const v8 = v8Row('v8-r');
  setRows([{ ...clone(REAL), lineUserId: 'U-mock' }, v8, v5Row('never', VAN, 'taipei-jiufen-10h', 10)]);
  orders.length = 0;
  const originalAuto = clone(v8.quoteOptions.autoDraft);
  await prefill({ regenerateLegacy: true, ids: [REAL.id, 'v8-r'] });
  assert.deepEqual(legacyDraftView(get(REAL.id).quoteOptions), { text: REAL.quoteDraftText, replacedAt: get(REAL.id).quoteOptions.legacyDraft.replacedAt, regenerated: true, historyCount: 0 });
  loggedIn = false;
  const before = clone(db.rows);
  assert.equal((await restore(REAL.id)).status, 401);
  assert.deepEqual(db.rows, before);
  loggedIn = true;
  const r1 = await restore(REAL.id);
  assert.equal(r1.status, 200); assert.equal(r1.body.changed, true); assert.equal(r1.body.sendsToCustomer, false);
  const real = get(REAL.id);
  assert.equal(real.quoteDraftText, REAL.quoteDraftText);
  assert.equal(real.recommendedVehicle, REAL.recommendedVehicle);
  assert.equal(real.quoteOptions.regenerated, undefined);
  assert.equal(real.quoteOptions.autoDraft, undefined, 'v5 rows had no autoDraft');
  assert.equal(real.quoteOptions.legacyDraft.text, REAL.quoteDraftText, 'legacyDraft kept');
  assert.deepEqual({ ...real.quoteOptions, legacyDraft: undefined, restoreHistory: undefined }, { ...REAL.quoteOptions, legacyDraft: undefined, restoreHistory: undefined }, 'options back to the original');
  assert.equal(real.quoteOptions.restoreHistory.length, 1, 'the regenerated draft is kept in restoreHistory');
  assert.equal(real.quoteStatus, 'new'); assert.equal(real.sentAt, null);
  assert.equal(legacyDraftView(real.quoteOptions).regenerated, false);
  writes.length = 0;
  const r2 = await restore(REAL.id);
  assert.equal(r2.status, 200); assert.equal(r2.body.changed, false); assert.deepEqual(writes, [], 'idempotent');
  // v8 auto draft: the original text and autoDraft come back (so it is an unedited auto draft again).
  const r3 = await restore('v8-r');
  assert.equal(r3.body.changed, true);
  assert.equal(get('v8-r').quoteDraftText, v8.quoteDraftText);
  assert.deepEqual(get('v8-r').quoteOptions.autoDraft, originalAuto);
  // Restored old-format text is still refused by the send guard (marker), so restore never makes it sendable.
  assert.equal(await send(REAL.id), 409);
  // No legacyDraft → 409; unknown id → 404; sent row → 409.
  assert.equal((await restore('never')).status, 409);
  assert.equal((await restore('missing')).status, 404);
  get('v8-r').quoteStatus = 'SENT';
  assert.equal((await restore('v8-r')).status, 409);
  assert.deepEqual(pushed, []);
});

test('regenerateLegacy must be the boolean true: "true", 1, false+ids, ids without flag → 400; default prefill unchanged', async () => {
  setRows([{ ...clone(REAL), lineUserId: 'U-mock' }, { id: 'empty', lineUserId: 'U', quoteStatus: 'new', sentAt: null, createdAt: CREATED, tripDate: '', passengerCount: 6, pickup: '台北', destination: '九份', remark: '無', recommendedVehicle: '', quoteDraftText: '', quoteOptions: [] }]);
  orders.length = 0;
  const before = clone(db.rows);
  writes.length = 0;
  for (const body of [
    { regenerateLegacy: 'true', ids: [REAL.id] }, { regenerateLegacy: 'true', ids: [REAL.id], dryRun: true }, { regenerateLegacy: 'true' },
    { regenerateLegacy: 1, ids: [REAL.id] }, { regenerateLegacy: null, ids: [REAL.id] }, { regenerateLegacy: {}, ids: [REAL.id] },
    { regenerateLegacy: false, ids: [REAL.id] }, { ids: [REAL.id] }, { ids: [] }, { regenerateLegacy: 'false' },
  ]) {
    const r = await prefill(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.sendsToCustomer, false);
  }
  assert.deepEqual(writes, []); assert.deepEqual(db.rows, before);
  for (const body of [{}, { dryRun: true }, { regenerateLegacy: false }, { regenerateLegacy: false, dryRun: true }]) {
    const r = await prefill(body);
    assert.equal(r.status, 200, JSON.stringify(body));
    assert.equal(r.body.regenerateLegacy, undefined);
  }
  assert.equal((await prefill(undefined, 'not json')).status, 200, 'unreadable body = default path as before');
  assert.deepEqual([...new Set(writes)], ['empty']);
  assert.equal(get(REAL.id).quoteDraftText, REAL.quoteDraftText);
});
