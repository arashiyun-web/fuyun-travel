// v12: (1) multi-day trip dates (10/16 ~ 17, 10/16-10/17, 10/16〜17, 10月16-17日, full-width) read their year from
// created_at like a single date, label both ends with the right weekdays, and say 「含週末」 with the per-day driver
// fee when any day is a Saturday or Sunday; unparseable text keeps the v11 wording. (2) 「送出給 LINE」 and
// 「依已核對車資產生草稿」 use the order guard of lib/quoteDraftGuard.ts (ORDER_PENDING, STAFF_PRICED, any order → 409)
// under the row lock and again in the conditional UPDATE; the detail page hides both buttons. (3) PATCH runs
// under the row lock with a status allowlist. Dates, places and ids here are fictional. Nothing is sent: LINE is
// an in-memory double; Prisma is test-support/quote-db-mock.cjs and the real orders code creates the orders.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
const { createQuoteDb, clone } = require('./test-support/quote-db-mock.cjs');

const store = createQuoteDb();
const { db } = store;
mock('@/lib/prisma', { prisma: store.prisma });
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => true, verifyAdminRequest: () => true, unauthorized: () => Response.json({ success: false }, { status: 401 }) });
const pushed = [];
let pushFails = false;
mock('@/lib/lineApi', { pushLineText: async (to, text) => { if (pushFails) throw new Error('LINE Push API failed: 500'); pushed.push({ to, text }); } });

const { dayTypeOf, busDriverFeeLine, yearBaseOf, TRIP_RANGE_MAX_DAYS } = load('lib/quoteRange.ts');
const { buildQuotePrefill, quoteEstimate } = load('lib/quotePrefill.ts');
const { convertConfirmedQuote, priceStaffOrder, readOrderForQuote, quoteFingerprint } = load('lib/charterOrder.ts');
const guard = load('lib/quoteDraftGuard.ts');
const { sendQuoteGuarded, fleetDraftGuarded, STALE_ERROR } = load('lib/quoteOrderWrites.ts');
const sendRoute = load('app/api/admin/quotes/[id]/send/route.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');
const patchRoute = load('app/api/admin/quotes/[id]/route.ts');

// ---------- 1. multi-day trip dates ----------
const CREATED = new Date('2026-07-03T02:00:00Z'); // fictional inquiry time; 2026-10-16 is a Friday, 10-17 a Saturday
const LATER = new Date('2026-11-12T01:00:00Z'); // a regenerate run after the trip date
const RANGE_FORMS = ['10/16 ~ 17', '10/16~17', '10/16-17', '10/16 - 17', '10/16-10/17', '10/16 ~ 10/17', '10/16〜17', '10/16～17', '10/16–17', '10/16 至 17', '10/16到17',
  '10月16-17日', '10月16日~17日', '10月16日-10月17日', '10月16~17號', '10/16(五)~17(六)', '10/16（五）～10/17（六）', '10/16-17 2天1夜',
  '１０／１６～１７', '１０/１６ ~ １７', '１０月１６－１７日', '１０月１６日～１０月１７日', '2026/10/16-17', '2026-10-16~17', '2026/10/16-2026/10/17'];

test('range forms: start year from created_at, both ends labelled, weekend → 含週末 and holiday band', () => {
  for (const form of RANGE_FORMS) {
    const day = dayTypeOf(form, yearBaseOf(CREATED, LATER));
    assert.deepEqual(day, { dayType: 'holiday', label: '10/16（週五）～10/17（週六）', days: 2, weekend: true }, form);
    assert.equal(busDriverFeeLine(form, CREATED), '司機服務費另計（每日計）：10/16（週五）～10/17（週六）含週末，平日 NT$2,500、週末及國定假日 NT$3,500', form);
  }
  // The start weekday is the single-date weekday for the same created_at (never a different year).
  assert.equal(dayTypeOf('10/16', CREATED).label, '10/16（週五）');
  // The v11 shape of the bug: the same text read without created_at after the date lands on next year's Saturday.
  assert.equal(dayTypeOf('10/16 ~ 17', LATER).label, '10/16（週六）～10/17（週日）');
});

test('range wording: all weekdays, weekend only, month and year boundaries; single dates unchanged', () => {
  assert.deepEqual(dayTypeOf('10/13-14', CREATED), { dayType: 'weekday', label: '10/13（週二）～10/14（週三）', days: 2, weekend: false });
  assert.equal(busDriverFeeLine('10/13-14', CREATED), '司機服務費另計（每日計）：10/13（週二）～10/14（週三）皆為平日，每日 NT$2,500（如遇國定假日，該日以假日 NT$3,500 計）');
  assert.deepEqual(dayTypeOf('10/17~18', CREATED), { dayType: 'holiday', label: '10/17（週六）～10/18（週日）', days: 2, weekend: true });
  assert.deepEqual(dayTypeOf('9/30~10/2', CREATED), { dayType: 'weekday', label: '9/30（週三）～10/2（週五）', days: 3, weekend: false });
  assert.deepEqual(dayTypeOf('12/30~1/2', CREATED), { dayType: 'holiday', label: '12/30（週三）～1/2（週六）', days: 4, weekend: true });
  assert.equal(dayTypeOf('10/1-14', CREATED).days, TRIP_RANGE_MAX_DAYS);
  // Single dates: exactly the v11 objects and wording (no range fields).
  assert.deepEqual(dayTypeOf('10/16', CREATED), { dayType: 'weekday', label: '10/16（週五）' });
  assert.deepEqual(dayTypeOf('2026-10-17', CREATED), { dayType: 'holiday', label: '10/17（週六）' });
  assert.equal(busDriverFeeLine('10/16', CREATED), '司機服務費另計：10/16（週五）為平日，NT$2,500（如遇國定假日以假日 NT$3,500 計）');
  assert.equal(busDriverFeeLine('10/17', CREATED), '司機服務費另計：10/17（週六）為假日，NT$3,500');
});

test('unparseable or implausible ranges fall back to the v11 behaviour (start date only, or no date)', () => {
  const single = { dayType: 'weekday', label: '10/16（週五）' };
  for (const form of ['10/16、17', '10/16,17', '10/16 17', '10/16-15', '10/16~2', '10/16-30', '10/16-17人', '10/16 - 10:00', '10/16-3天', '10/16~17.5', '10/16 兩天一夜', '10/16 8-17點']) {
    assert.deepEqual(dayTypeOf(form, CREATED), single, form);
    assert.equal(busDriverFeeLine(form, CREATED), busDriverFeeLine('10/16', CREATED), form);
  }
  for (const form of ['10.16-17', '1016-1017', '十月十六', '', null, '10/32-33']) {
    assert.equal(dayTypeOf(form, CREATED), null, String(form));
    assert.equal(busDriverFeeLine(form, CREATED), '司機服務費另計：平日 NT$2,500、假日 NT$3,500', String(form));
  }
});

const BUS = { passengerCount: 40, pickup: '台北', destination: '台北市區', remark: '無行李 來回', quoteOptions: [] };
test('prefill (regenerate path), list summary and fleet button: range draft uses created_at and the 含週末 wording', async () => {
  const p = buildQuotePrefill({ ...BUS, tripDate: '10/16 ~ 17', createdAt: CREATED }, 'backfill', LATER);
  const lines = p.quoteDraftText.split('\n');
  assert.ok(lines.includes('司機服務費另計（每日計）：10/16（週五）～10/17（週六）含週末，平日 NT$2,500、週末及國定假日 NT$3,500'), p.quoteDraftText);
  assert.ok(lines.some((l) => l.startsWith('初步行情：') && l.includes('10/16（週五）～10/17（週六）含週末，假日 NT$')), p.quoteDraftText);
  assert.ok(!/週六）為假日|10\/16（週六）/.test(p.quoteDraftText));
  const weekday = buildQuotePrefill({ ...BUS, tripDate: '10/13-14', createdAt: CREATED }, 'backfill', LATER).quoteDraftText;
  assert.ok(weekday.includes('10/13（週二）～10/14（週三）皆為平日 NT$'), weekday);
  // The customer text passes the send guard unchanged (system-generated wording only).
  reset([{ id: 'b1', lineUserId: 'U-mock', quoteStatus: 'new', sentAt: null, createdAt: CREATED, tripDate: '10/16 ~ 17', ...BUS, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions }]);
  assert.equal(quoteEstimate(get('b1')).summary.includes('客人範圍'), true);
  assert.equal((await send('b1')).status, 200);
  assert.equal(pushed.at(-1).text, p.quoteDraftText);
});

// ---------- 2. send and fleet draft under the order guard ----------
const CREATED2 = new Date('2026-10-01T02:00:00Z');
const VAN = { passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回', tripDate: '11/20' };
const get = (id) => db.rows.find((r) => r.id === id);
const orderOf = (id) => db.orders.find((o) => o.quoteId === id);
const reset = (rows) => { db.rows.length = 0; db.rows.push(...rows); db.orders.length = 0; db.writes.length = 0; db.sql.length = 0; db.ordersTable = true; pushFails = false; };
const vanRow = (id, extra = {}) => {
  const p = buildQuotePrefill({ ...VAN, createdAt: CREATED2, quoteOptions: [] }, 'line-webhook', CREATED2);
  return { id, lineUserId: 'U-mock', quoteStatus: 'new', sentAt: null, createdAt: CREATED2, ...VAN, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions, ...extra };
};
const send = async (id) => { const before = pushed.length; const r = await sendRoute.POST(new Request('http://x/s', { method: 'POST' }), { params: { id } }); return { status: r.status, body: await r.json(), pushed: pushed.length - before }; };
const button = async (id, body = { rateId: 'taipei-jiufen-10h', hours: 10 }) => { const r = await draftRoute.POST(new Request('http://x/d', { method: 'POST', body: JSON.stringify(body) }), { params: { id } }); return { status: r.status, body: await r.json() }; };
const save = async (id, body) => { const r = await patchRoute.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify(body) }), { params: { id } }); return { status: r.status, body: await r.json() }; };
const makeOrder = async (id) => { const r = await convertConfirmedQuote(id); assert.equal(r.ok, true, JSON.stringify(r)); };
const staffPrice = async (id) => {
  const view = await readOrderForQuote(id);
  const r = await priceStaffOrder(id, { items: view.items.map((item) => ({ key: item.key, decision: 'not_applicable', reason: '測試不適用' })), totalAmountTwd: view.order.baseAmountTwd });
  assert.equal(r.ok, true, JSON.stringify(r));
};
const ORDER_CASES = {
  ORDER_PENDING: async (id) => { await makeOrder(id); assert.equal(get(id).quoteStatus, 'ORDER_PENDING'); },
  STAFF_PRICED: async (id) => { await makeOrder(id); await staffPrice(id); assert.equal(get(id).quoteStatus, 'STAFF_PRICED'); },
  'order + status new (old data)': async (id) => { await makeOrder(id); get(id).quoteStatus = 'new'; },
  'order + SENT (old data)': async (id) => { await makeOrder(id); Object.assign(get(id), { quoteStatus: 'SENT', sentAt: new Date('2026-10-05T00:00:00Z') }); },
  'ORDER_PENDING without order row': async (id) => { get(id).quoteStatus = 'ORDER_PENDING'; },
  'STAFF_PRICED without order row': async (id) => { get(id).quoteStatus = 'STAFF_PRICED'; },
};

test('送出給 LINE: every order state → 409, nothing pushed, row and order fingerprint unchanged', async () => {
  for (const [name, setup] of Object.entries(ORDER_CASES)) {
    reset([vanRow('s1')]);
    assert.equal((await button('s1')).status, 200, name);
    await setup('s1');
    const before = clone(db.rows); const fp = orderOf('s1') && orderOf('s1').quoteFingerprint;
    db.writes.length = 0; db.sql.length = 0;
    const r = await send('s1');
    assert.equal(r.status, 409, name); assert.equal(r.body.error, guard.ORDER_SEND_ERROR, name); assert.equal(r.pushed, 0, name);
    assert.deepEqual(db.rows, before, `${name}: row unchanged`); assert.deepEqual(db.writes, [], name); assert.deepEqual(db.sql, [], `${name}: refused before the UPDATE`);
    if (fp) { assert.equal(quoteFingerprint(get('s1')), fp); assert.equal((await readOrderForQuote('s1')).stale, false, name); }
  }
});

test('依已核對車資產生草稿: every order state → 409, nothing written, order not made stale', async () => {
  for (const [name, setup] of Object.entries(ORDER_CASES)) {
    reset([vanRow('d1')]);
    assert.equal((await button('d1')).status, 200, name);
    await setup('d1');
    const before = clone(db.rows); const fp = orderOf('d1') && orderOf('d1').quoteFingerprint;
    db.writes.length = 0; db.sql.length = 0;
    for (const body of [{ rateId: 'taipei-jiufen-10h', hours: 9 }, { rateId: null, hours: null, vehicleHint: '中巴' }, {}]) {
      const r = await button('d1', body);
      assert.equal(r.status, 409, name); assert.equal(r.body.error, guard.ORDER_DRAFT_ERROR, name);
    }
    assert.deepEqual(db.rows, before, `${name}: row unchanged`); assert.deepEqual(db.writes, [], name); assert.deepEqual(db.sql, [], name);
    if (fp) { assert.equal(quoteFingerprint(get('d1')), fp); assert.equal((await readOrderForQuote('d1')).stale, false, name); }
  }
  assert.equal(pushed.length >= 0, true);
});

test('order created inside the lock window (right before the UPDATE): conditional UPDATE matches 0 rows → 409, nothing pushed or written', async () => {
  for (const kind of ['send', 'draft']) {
    // (a) the real order code runs: order row + ORDER_PENDING.  (b) only an order row appears (status unchanged):
    // the NOT EXISTS clause alone refuses.  (c) only the status changes to STAFF_PRICED: NOT IN alone refuses.
    for (const variant of ['convert', 'order-row-only', 'status-only']) {
      reset([vanRow('w1')]);
      assert.equal((await button('w1')).status, 200);
      const pushedBefore = pushed.length; db.sql.length = 0; db.writes.length = 0;
      const beforeWrite = async (tx, id) => {
        if (variant === 'convert') { const made = await convertConfirmedQuote(id); assert.equal(made.ok, true); }
        else if (variant === 'order-row-only') db.orders.push({ id: 'o-x', quoteId: id, quoteFingerprint: 'f', status: 'pending_confirmation' });
        else get(id).quoteStatus = 'STAFF_PRICED';
      };
      const snapshot = clone(get('w1'));
      const r = kind === 'send'
        ? await sendQuoteGuarded('w1', () => null, async () => { pushed.push({ to: 'x', text: 'must not happen' }); }, { beforeWrite })
        : await fleetDraftGuarded('w1', (q) => ({ data: { quoteDraftText: 'new text', recommendedVehicle: q.recommendedVehicle, quoteOptions: { replaced: true } }, extra: {} }), { beforeWrite });
      assert.equal(r.ok, false, `${kind}/${variant}`); assert.equal(r.status, 409, `${kind}/${variant}`);
      assert.equal(r.error, variant === 'status-only' ? STALE_ERROR : (kind === 'send' ? guard.ORDER_SEND_ERROR : guard.ORDER_DRAFT_ERROR), `${kind}/${variant}`);
      assert.equal(db.sql.length, 1, `${kind}/${variant}: the UPDATE ran and matched 0 rows`);
      assert.equal(pushed.length, pushedBefore, `${kind}/${variant}: nothing pushed`);
      assert.equal(get('w1').quoteDraftText, snapshot.quoteDraftText); assert.deepEqual(get('w1').quoteOptions, snapshot.quoteOptions);
      assert.equal(get('w1').sentAt, null);
    }
  }
});

test('send and fleet draft without an order: as before (200, SENT + sent_at, one push; sent rows can be re-drafted and re-sent); ARCHIVED, 404, 400 unchanged', async () => {
  reset([vanRow('n1')]);
  const b = await button('n1');
  assert.equal(b.status, 200); assert.equal(b.body.amountTwd, 7000); assert.equal(b.body.sendsToCustomer, false); assert.ok(Array.isArray(b.body.staffHints));
  assert.deepEqual(Object.keys(b.body), ['success', 'quote', 'pending', 'amountTwd', 'staffHints', 'sendsToCustomer']);
  const text = get('n1').quoteDraftText;
  const r = await send('n1');
  assert.equal(r.status, 200); assert.equal(r.pushed, 1); assert.equal(pushed.at(-1).text, text); assert.equal(pushed.at(-1).to, 'U-mock');
  assert.equal(get('n1').quoteStatus, 'SENT'); assert.ok(get('n1').sentAt instanceof Date);
  assert.deepEqual(Object.keys(r.body), ['success', 'quote']); assert.equal(r.body.quote.quoteStatus, 'SENT');
  assert.equal((await button('n1', { rateId: 'taipei-jiufen-10h', hours: 10 })).status, 200, 'SENT row: fleet draft still allowed (unchanged)');
  assert.equal((await send('n1')).status, 200, 'SENT row: re-send still allowed (unchanged)');
  // Unchanged refusals.
  reset([vanRow('a1', { quoteStatus: 'ARCHIVED' }), vanRow('e1', { quoteDraftText: '' })]);
  assert.deepEqual((await send('a1')).body, { success: false, error: '這筆詢價已移除，請先還原再送出。' });
  assert.equal((await send('e1')).status, 400);
  assert.equal((await send('missing')).status, 404); assert.equal((await button('missing')).status, 404);
  assert.equal((await button('a1', { hours: 0 })).status, 400);
  // A failing LINE push propagates (route 500 as before); in PostgreSQL the transaction rolls the status back
  // (proved in the local Postgres route test).
  reset([vanRow('f1')]); pushFails = true;
  await assert.rejects(() => sendRoute.POST(new Request('http://x/s', { method: 'POST' }), { params: { id: 'f1' } }), /LINE Push API failed/);
  pushFails = false;
});

test('the guarded UPDATEs carry the guard in SQL (status NOT IN the order statuses, NOT EXISTS order, row as read)', async () => {
  reset([vanRow('q1')]);
  assert.equal((await button('q1')).status, 200);
  const draftSql = db.sql.at(-1).replace(/\s+/g, ' ');
  assert.match(draftSql, /AND q\.quote_status NOT IN \(\?,\?\)/);
  assert.match(draftSql, /NOT EXISTS \(SELECT 1 FROM charter_orders o WHERE o\.quote_id = q\.id\)/);
  assert.doesNotMatch(draftSql, /sent_at IS NULL/, 'sent rows may still be re-drafted');
  assert.equal((await send('q1')).status, 200);
  const sendSql = db.sql.at(-1).replace(/\s+/g, ' ');
  assert.match(sendSql, /^UPDATE charter_quotes AS q SET quote_status = 'SENT', sent_at = CAST\(\? AS timestamptz\) AT TIME ZONE 'UTC' WHERE q\.id = \? AND q\.quote_status = \? AND q\.quote_status NOT IN \(\?,\?\) AND q\.quote_draft_text IS NOT DISTINCT FROM \? AND q\.quote_options IS NOT DISTINCT FROM CAST\(\? AS jsonb\) AND NOT EXISTS/);
  assert.deepEqual(guard.ORDER_STATUSES.slice(), ['ORDER_PENDING', 'STAFF_PRICED']);
  // Without a charter_orders table (old databases) there is no order: both actions work as before.
  reset([vanRow('t1')]); db.ordersTable = false;
  assert.equal((await button('t1')).status, 200); assert.equal((await send('t1')).status, 200);
  assert.doesNotMatch(db.sql.at(-1), /charter_orders/);
});

// ---------- 3. PATCH: status allowlist and lock ----------
test('PATCH status allowlist: keep the current status always; new/DRAFT/HANDOFF otherwise; never into SENT/CONFIRMED/order/ARCHIVED; order rows keep their status', async () => {
  const body = (row, quoteStatus) => ({ quoteStatus, quoteDraftText: row.quoteDraftText, recommendedVehicle: row.recommendedVehicle });
  const ALL = ['new', 'DRAFT', 'HANDOFF', 'SENT', 'CONFIRMED', 'ORDER_PENDING', 'STAFF_PRICED', 'ARCHIVED', 'whatever'];
  for (const from of ['new', 'DRAFT', 'HANDOFF', 'SENT', 'CONFIRMED']) {
    for (const to of ALL) {
      reset([vanRow('p1', { quoteStatus: from })]);
      const r = await save('p1', body(get('p1'), to));
      const ok = to === from || ['new', 'DRAFT', 'HANDOFF'].includes(to);
      assert.equal(r.status, ok ? 200 : 409, `${from} → ${to}`);
      assert.equal(get('p1').quoteStatus, ok ? to : from, `${from} → ${to}`);
      if (!ok) assert.equal(r.body.error, to === 'ARCHIVED' ? guard.ARCHIVE_STATUS_ERROR : guard.STATUS_NOT_ALLOWED_ERROR);
    }
  }
  for (const [name, setup] of Object.entries(ORDER_CASES)) {
    reset([vanRow('p2')]);
    assert.equal((await button('p2')).status, 200);
    await setup('p2');
    const status = get('p2').quoteStatus;
    for (const to of ALL.filter((s) => s !== status)) {
      const r = await save('p2', body(get('p2'), to));
      assert.equal(r.status, 409, `${name}: ${status} → ${to}`);
      assert.equal(get('p2').quoteStatus, status);
    }
    // Saving with the unchanged status works as before (the order's stale check still covers text-only edits).
    assert.equal((await save('p2', body(get('p2'), status))).status, 200, name);
  }
  // ARCHIVED rows: only through 移除／還原 (unchanged message); keeping ARCHIVED is allowed as before.
  reset([vanRow('p3', { quoteStatus: 'ARCHIVED' })]);
  assert.equal((await save('p3', body(get('p3'), 'new'))).body.error, '移除或還原請用清單上的按鈕。');
  assert.equal((await save('p3', body(get('p3'), 'ARCHIVED'))).status, 200);
  // Omitted quoteStatus still means DRAFT (unchanged default).
  reset([vanRow('p4')]);
  assert.equal((await save('p4', { quoteDraftText: get('p4').quoteDraftText })).status, 200);
  assert.equal(get('p4').quoteStatus, 'DRAFT');
  assert.equal((await save('missing', { quoteStatus: 'new' })).status, 404);
});

test('PATCH reads quoteOptions under the row lock (fresh read inside the transaction, so a restore committed before keeps its history)', async () => {
  reset([vanRow('l1')]);
  const order = [];
  const tx0 = store.prisma.$transaction;
  store.prisma.$transaction = (fn) => tx0((t) => fn({ ...t, $queryRaw: async (strings, ...values) => { if (/FOR UPDATE/.test(strings.join('?'))) order.push('lock'); return t.$queryRaw(strings, ...values); } }));
  const find0 = store.prisma.charterQuote.findUnique;
  store.prisma.charterQuote.findUnique = async (args) => { order.push('read'); return find0(args); };
  try {
    get('l1').quoteOptions = { ...get('l1').quoteOptions, restoreHistory: [{ savedAt: '2026-11-01T00:00:00.000Z', quoteDraftText: 'x' }] };
    assert.equal((await save('l1', { quoteStatus: 'new', quoteDraftText: `${get('l1').quoteDraftText}\n補充` })).status, 200);
  } finally { store.prisma.$transaction = tx0; store.prisma.charterQuote.findUnique = find0; }
  assert.deepEqual(order.slice(0, 2), ['lock', 'read'], 'the row is read only after FOR UPDATE');
  assert.equal(get('l1').quoteOptions.restoreHistory.length, 1, 'history kept');
});

// ---------- UI ----------
test('detail page: send and fleet-draft buttons hidden for order states and until the order lookup answered (same rule as the API)', () => {
  const page = fs.readFileSync(path.join(__dirname, '../app/admin/quotes/[id]/page.tsx'), 'utf8');
  assert.ok(page.includes('const orderUnknownOrPresent = !orderChecked || Boolean(orderView);'));
  assert.ok(page.includes('const draftBlock = orderActionBlock(quote, orderUnknownOrPresent, "draft");'));
  assert.ok(page.includes('const sendBlocked = orderActionBlock(quote, orderUnknownOrPresent, "send");'));
  assert.ok(page.includes('{draftBlock ? null : <button onClick={() => fillCheckedFare()'));
  assert.ok(page.includes('{sendBlocked ? null : <button disabled={quote.quoteStatus === "ARCHIVED"} onClick={() => sendQuote()'));
  assert.equal((page.match(/依已核對車資產生草稿<\/button>/g) || []).length, 1);
  assert.equal((page.match(/送出給 LINE<\/button>/g) || []).length, 1);
  // The page rule equals the API rule for every status × order presence.
  for (const status of ['new', 'DRAFT', 'HANDOFF', 'SENT', 'CONFIRMED', 'ARCHIVED', 'ORDER_PENDING', 'STAFF_PRICED']) {
    for (const hasOrder of [false, true]) {
      const blocked = guard.orderActionBlock({ quoteStatus: status }, hasOrder, 'send');
      assert.equal(Boolean(blocked), hasOrder || status === 'ORDER_PENDING' || status === 'STAFF_PRICED', `${status}/${hasOrder}`);
      assert.equal(Boolean(guard.orderActionBlock({ quoteStatus: status }, hasOrder, 'draft')), Boolean(blocked));
    }
  }
  assert.equal(guard.orderActionBlock({ quoteStatus: 'new' }, true, 'send'), guard.ORDER_SEND_ERROR);
});
