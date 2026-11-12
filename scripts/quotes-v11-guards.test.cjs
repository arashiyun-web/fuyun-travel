// v11: regenerateLegacy and legacy-restore use the 「移除」 order guard (ORDER_PENDING, STAFF_PRICED, any order)
// plus sent / confirmed / removed, under the row lock and again in the conditional UPDATE. A blocked restore is
// 409 and leaves the order fingerprint unchanged. Restore first saves the current draft in
// quoteOptions.restoreHistory. Prisma is an in-memory double (test-support/quote-db-mock.cjs); the real
// orders code (lib/charterOrder.ts) creates and prices the orders. LINE is mocked; nothing is sent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
const { createQuoteDb, clone } = require('./test-support/quote-db-mock.cjs');

const store = createQuoteDb();
const { db } = store;
mock('@/lib/prisma', { prisma: store.prisma });
let loggedIn = true;
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => loggedIn, verifyAdminRequest: () => loggedIn, unauthorized: () => Response.json({ success: false }, { status: 401 }) });
const pushed = [];
mock('@/lib/lineApi', { pushLineText: async (to, text) => { pushed.push(text); } });

const { legacyV5DraftForRow } = load('lib/legacyFleetDraftV5.ts');
const { regenerateLegacyDrafts, restoreLegacyDraft, archiveQuote, RESTORE_HISTORY_MAX } = load('lib/quoteArchive.ts');
const { convertConfirmedQuote, priceStaffOrder, readOrderForQuote, quoteFingerprint } = load('lib/charterOrder.ts');
const { draftReplaceBlock, DRAFT_LOCKED_STATUSES, ORDER_LOCK_ERROR } = load('lib/quoteDraftGuard.ts');
const { legacyDraftView } = load('lib/quotePanelText.ts');
const restoreRoute = load('app/api/admin/quotes/[id]/legacy-restore/route.ts');
const prefillRoute = load('app/api/admin/quotes/prefill/route.ts');
const patchRoute = load('app/api/admin/quotes/[id]/route.ts');

const restore = async (id) => { const r = await restoreRoute.POST(new Request(`http://x/${id}/legacy-restore`, { method: 'POST' }), { params: { id } }); return { status: r.status, body: await r.json() }; };
const regenerate = async (ids, dryRun = false) => { const r = await prefillRoute.POST(new Request('http://x/prefill', { method: 'POST', body: JSON.stringify({ regenerateLegacy: true, ids, dryRun }) })); return (await r.json()); };
const save = async (id, body) => (await patchRoute.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify(body) }), { params: { id } })).status;
const get = (id) => db.rows.find((r) => r.id === id);
const orderOf = (id) => db.orders.find((o) => o.quoteId === id);

const CREATED = new Date('2026-05-12T02:00:00Z');
const VAN = { tripDate: '11/20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無', recommendedVehicle: '九人座賓士小車' };
/** An untouched old-format (v5 button) draft with a checked route, so an order can be created from it. */
const v5Van = (id, extra = {}) => {
  const row = { lineUserId: 'U-mock', quoteStatus: 'new', sentAt: null, createdAt: CREATED, ...VAN, id };
  row.quoteOptions = { legacyOptions: [], fleetFare: { version: 1, rateId: 'taipei-jiufen-10h', hours: 10, source: { pickup: row.pickup, destination: row.destination, remark: row.remark } } };
  row.quoteDraftText = legacyV5DraftForRow(row);
  return Object.assign(row, extra);
};
const reset = (list) => { db.rows.length = 0; db.rows.push(...list); db.orders.length = 0; db.writes.length = 0; db.ordersTable = true; };
const regenerated = async (id) => { const r = await regenerate([id]); assert.deepEqual(r.generated, [id], JSON.stringify(r)); };
const makeOrder = async (id) => { const r = await convertConfirmedQuote(id); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(get(id).quoteStatus, 'ORDER_PENDING'); };
const staffPrice = async (id) => {
  const view = await readOrderForQuote(id);
  const items = view.items.map((item) => ({ key: item.key, decision: 'not_applicable', reason: '測試不適用' }));
  const r = await priceStaffOrder(id, { items, totalAmountTwd: view.order.baseAmountTwd });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(get(id).quoteStatus, 'STAFF_PRICED');
};
/** Order exists and its fingerprint still matches the row (not stale), before and after. */
const orderIntact = async (id, fingerprintBefore) => {
  const order = orderOf(id);
  assert.equal(order.quoteFingerprint, fingerprintBefore, 'order fingerprint unchanged');
  assert.equal(quoteFingerprint(get(id)), fingerprintBefore, 'row still matches the order');
  assert.equal((await readOrderForQuote(id)).stale, false);
};

test('legacy-restore: ORDER_PENDING, STAFF_PRICED, order with status put back to new, sent, confirmed, removed → 409, nothing written, order fingerprint unchanged', async () => {
  const cases = {
    ORDER_PENDING: async (id) => { await makeOrder(id); },
    STAFF_PRICED: async (id) => { await makeOrder(id); await staffPrice(id); },
    'order + status edited back to new': async (id) => { await makeOrder(id); assert.equal(await save(id, { quoteStatus: 'new', quoteDraftText: get(id).quoteDraftText, recommendedVehicle: get(id).recommendedVehicle }), 200); assert.equal(get(id).quoteStatus, 'new'); },
    'order + DRAFT': async (id) => { await makeOrder(id); get(id).quoteStatus = 'DRAFT'; },
    'order + HANDOFF': async (id) => { await makeOrder(id); get(id).quoteStatus = 'HANDOFF'; },
    SENT: async (id) => { Object.assign(get(id), { quoteStatus: 'SENT', sentAt: new Date('2026-11-01T00:00:00Z') }); },
    CONFIRMED: async (id) => { Object.assign(get(id), { quoteStatus: 'CONFIRMED', sentAt: new Date('2026-11-01T00:00:00Z') }); },
    'removed (ARCHIVED)': async (id) => { assert.equal((await archiveQuote(id)).status, 200); assert.equal(get(id).quoteStatus, 'ARCHIVED'); },
    'new but sent_at set': async (id) => { get(id).sentAt = new Date('2026-11-01T00:00:00Z'); },
  };
  for (const [name, setup] of Object.entries(cases)) {
    reset([v5Van('r1')]);
    await regenerated('r1');
    await setup('r1');
    const before = clone(db.rows);
    const fp = orderOf('r1') ? orderOf('r1').quoteFingerprint : null;
    db.writes.length = 0; db.sql.length = 0;
    const r = await restore('r1');
    assert.equal(r.status, 409, name);
    assert.equal(r.body.success, false, name);
    if (orderOf('r1')) assert.equal(r.body.error, ORDER_LOCK_ERROR, name);
    assert.deepEqual(db.rows, before, `${name}: row unchanged`);
    assert.deepEqual(db.writes, [], name);
    assert.deepEqual(db.sql, [], `${name}: refused before any UPDATE`);
    if (fp) await orderIntact('r1', fp);
    // Same answer as 「移除」 for every order case.
    if (orderOf('r1') && get('r1').quoteStatus !== 'ARCHIVED') assert.equal((await archiveQuote('r1')).status, 409, `${name}: 移除 also refuses`);
  }
  assert.deepEqual(pushed, []);
});

test('legacy-restore: an order created concurrently (inside the same lock window) is caught by the conditional UPDATE → 409, fingerprint unchanged', async () => {
  // (a) real order creation runs right before the UPDATE: status → ORDER_PENDING + order row.
  reset([v5Van('c1')]);
  await regenerated('c1');
  db.sql.length = 0;
  const r = await restoreLegacyDraft('c1', { beforeWrite: async (tx, id) => { const made = await convertConfirmedQuote(id); assert.equal(made.ok, true); } });
  assert.equal(r.status, 409); assert.equal(r.error, ORDER_LOCK_ERROR);
  const fp = orderOf('c1').quoteFingerprint;
  assert.equal(db.sql.length, 1, 'the UPDATE ran and matched 0 rows');
  await orderIntact('c1', fp);
  assert.notEqual(get('c1').quoteOptions.regenerated, undefined, 'still the regenerated draft');
  // (b) only an order row appears (status still new): the NOT EXISTS clause alone refuses the write.
  reset([v5Van('c2')]);
  await regenerated('c2');
  const before = clone(get('c2'));
  const r2 = await restoreLegacyDraft('c2', { beforeWrite: async (tx, id) => {
    const row = await tx.charterQuote.findUnique({ where: { id } });
    await tx.charterOrder.create({ data: { quoteId: id, lineUid: 'U-mock', baseAmountTwd: 7000, totalAmountTwd: null, vehicleLabel: 'x', routeLabel: 'x', quoteFingerprint: quoteFingerprint(row), status: 'pending_confirmation' } });
  } });
  assert.equal(r2.status, 409); assert.equal(r2.error, ORDER_LOCK_ERROR);
  assert.deepEqual(get('c2'), before);
  assert.equal(orderOf('c2').quoteFingerprint, quoteFingerprint(get('c2')));
  assert.match(db.sql.at(-1), /NOT EXISTS \(SELECT 1 FROM charter_orders o WHERE o\.quote_id = q\.id\)/);
  // (c) status flipped to a locked one without an order: the NOT IN clause refuses the write.
  for (const status of DRAFT_LOCKED_STATUSES) {
    reset([v5Van('c3')]);
    await regenerated('c3');
    const r3 = await restoreLegacyDraft('c3', { beforeWrite: async (tx, id) => { db.rows.find((x) => x.id === id).quoteStatus = status; } });
    assert.equal(r3.status, 409, status);
    assert.notEqual(get('c3').quoteOptions.regenerated, undefined, status);
  }
});

test('regenerateLegacy: same states are skipped (dry run and real run), also when the order appears after the first read or inside the lock window', async () => {
  const states = {
    ORDER_PENDING: async (id) => { await makeOrder(id); },
    STAFF_PRICED: async (id) => { await makeOrder(id); await staffPrice(id); },
    'order + status new': async (id) => { await makeOrder(id); get(id).quoteStatus = 'new'; },
    SENT: async (id) => { Object.assign(get(id), { quoteStatus: 'SENT', sentAt: new Date('2026-11-01T00:00:00Z') }); },
    CONFIRMED: async (id) => { Object.assign(get(id), { quoteStatus: 'CONFIRMED', sentAt: new Date('2026-11-01T00:00:00Z') }); },
    ARCHIVED: async (id) => { assert.equal((await archiveQuote(id)).status, 200); },
    'new but sent_at set': async (id) => { get(id).sentAt = new Date('2026-11-01T00:00:00Z'); },
  };
  for (const [name, setup] of Object.entries(states)) {
    reset([v5Van('g1')]);
    await setup('g1');
    const before = clone(db.rows);
    const fp = orderOf('g1') ? orderOf('g1').quoteFingerprint : null;
    db.writes.length = 0;
    for (const dryRun of [true, false]) {
      const r = await regenerate(['g1'], dryRun);
      assert.deepEqual(r.generated, [], `${name} dryRun=${dryRun}`);
      assert.equal(r.skipped.length, 1);
      if (orderOf('g1')) assert.equal(r.skipped[0].reason, '已有訂單', name);
    }
    assert.deepEqual(db.rows, before, name); assert.deepEqual(db.writes, [], name);
    if (fp) await orderIntact('g1', fp);
  }
  // Order created after the unlocked first read: the check under the lock catches it.
  reset([v5Van('g2')]);
  const realFindMany = store.prisma.charterOrder.findMany;
  store.prisma.charterOrder.findMany = async () => [];
  await makeOrder('g2'); get('g2').quoteStatus = 'new';
  const beforeG2 = clone(get('g2'));
  try {
    const r = await regenerate(['g2']);
    assert.deepEqual(r.skipped, [{ id: 'g2', reason: '已有訂單' }]);
  } finally { store.prisma.charterOrder.findMany = realFindMany; }
  assert.deepEqual(get('g2'), beforeG2);
  // Order created inside the lock window (right before the UPDATE): the conditional UPDATE refuses.
  reset([v5Van('g3')]);
  const r3 = await regenerateLegacyDrafts({ ids: ['g3'] }, { beforeWrite: async (tx, id) => { const made = await convertConfirmedQuote(id); assert.equal(made.ok, true); } });
  assert.deepEqual(r3.skipped, [{ id: 'g3', reason: '已有訂單' }]);
  await orderIntact('g3', orderOf('g3').quoteFingerprint);
  assert.ok(get('g3').quoteDraftText.startsWith('【後台報價草稿】'), 'old draft kept');
  reset([v5Van('g4')]);
  const r4 = await regenerateLegacyDrafts({ ids: ['g4'] }, { beforeWrite: async (tx, id) => {
    const row = await tx.charterQuote.findUnique({ where: { id } });
    await tx.charterOrder.create({ data: { quoteId: id, lineUid: 'U-mock', baseAmountTwd: 7000, totalAmountTwd: null, vehicleLabel: 'x', routeLabel: 'x', quoteFingerprint: quoteFingerprint(row), status: 'pending_confirmation' } });
  } });
  assert.deepEqual(r4.skipped, [{ id: 'g4', reason: '已有訂單' }]);
  assert.equal(orderOf('g4').quoteFingerprint, quoteFingerprint(get('g4')));
  // Without an order table the write still works (no NOT EXISTS clause), as the rest of the archive code does.
  reset([v5Van('g5')]);
  db.ordersTable = false;
  db.sql.length = 0;
  const r5 = await regenerateLegacyDrafts({ ids: ['g5'] });
  assert.deepEqual(r5.generated, ['g5']);
  assert.doesNotMatch(db.sql[0], /charter_orders/);
  assert.deepEqual(pushed, []);
});

test('restore after a staff edit keeps the staff version in restoreHistory; earlier saves are never overwritten; history cap → 409', async () => {
  reset([v5Van('h1')]);
  const original = clone(get('h1'));
  await regenerated('h1');
  const regeneratedText = get('h1').quoteDraftText;
  const STAFF = `${regeneratedText}\n7:00 飯店接、回程送松山機場，已電話確認`;
  assert.equal(await save('h1', { quoteStatus: 'new', quoteDraftText: STAFF, recommendedVehicle: '中型巴士' }), 200);
  const staffOptions = clone(get('h1').quoteOptions);
  const r = await restore('h1');
  assert.equal(r.status, 200); assert.equal(r.body.changed, true);
  const row = get('h1');
  assert.equal(row.quoteDraftText, original.quoteDraftText);
  assert.equal(row.recommendedVehicle, original.recommendedVehicle);
  assert.deepEqual({ ...row.quoteOptions, legacyDraft: undefined, restoreHistory: undefined }, { ...original.quoteOptions, legacyDraft: undefined, restoreHistory: undefined });
  assert.equal(row.quoteOptions.regenerated, undefined);
  const h = row.quoteOptions.restoreHistory;
  assert.equal(h.length, 1);
  assert.equal(h[0].quoteDraftText, STAFF, 'staff edit saved');
  assert.equal(h[0].recommendedVehicle, '中型巴士');
  assert.equal(h[0].quoteStatus, 'new');
  assert.ok(!Number.isNaN(Date.parse(h[0].savedAt)));
  const staffSnapshot = Object.fromEntries(Object.entries(staffOptions).filter(([k]) => !['legacyDraft', 'regenerated', 'restoreHistory'].includes(k)));
  assert.deepEqual(h[0].quoteOptions, staffSnapshot, 'staff options saved (bookkeeping keys aside)');
  assert.equal(h[0].quoteOptions.autoDraft.staffReviewed, true, 'the saved copy is the staff-reviewed one');
  assert.equal(legacyDraftView(row.quoteOptions).historyCount, 1);
  // Second cycle: regenerate again, edit again, restore again → history grows, first entry byte-identical.
  const first = clone(h[0]);
  await regenerated('h1');
  assert.equal(get('h1').quoteOptions.restoreHistory.length, 1, 'regenerate keeps the history');
  assert.equal(await save('h1', { quoteStatus: 'new', quoteDraftText: `${get('h1').quoteDraftText}\n第二次人員修改`, recommendedVehicle: '九人座賓士小車' }), 200);
  assert.equal((await restore('h1')).status, 200);
  const h2 = get('h1').quoteOptions.restoreHistory;
  assert.equal(h2.length, 2);
  assert.deepEqual(h2[0], first);
  assert.ok(h2[1].quoteDraftText.endsWith('第二次人員修改'));
  assert.equal(get('h1').quoteOptions.legacyDraft.text, original.quoteDraftText, 'first legacyDraft never overwritten');
  // Cap: a full history refuses the restore instead of dropping a save.
  await regenerated('h1');
  get('h1').quoteOptions.restoreHistory = Array.from({ length: RESTORE_HISTORY_MAX }, (_, i) => ({ savedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, quoteDraftText: `v${i}` }));
  const before = clone(get('h1'));
  const capped = await restore('h1');
  assert.equal(capped.status, 409);
  assert.deepEqual(get('h1'), before);
});

test('restore twice is idempotent; 401 / 404 / no legacyDraft unchanged', async () => {
  reset([v5Van('i1'), v5Van('never')]);
  await regenerated('i1');
  loggedIn = false;
  const before0 = clone(db.rows);
  assert.equal((await restore('i1')).status, 401);
  assert.deepEqual(db.rows, before0);
  loggedIn = true;
  const r1 = await restore('i1');
  assert.equal(r1.status, 200); assert.equal(r1.body.changed, true);
  const after1 = clone(db.rows);
  db.writes.length = 0; db.sql.length = 0;
  const r2 = await restore('i1');
  assert.equal(r2.status, 200); assert.equal(r2.body.changed, false);
  assert.deepEqual(db.rows, after1); assert.deepEqual(db.writes, []); assert.deepEqual(db.sql, []);
  // Staff edits after a restore are not touched by a repeated restore either.
  assert.equal(await save('i1', { quoteStatus: 'new', quoteDraftText: '人員重寫的內容', recommendedVehicle: '' }), 200);
  const edited = clone(get('i1'));
  const r3 = await restore('i1');
  assert.equal(r3.body.changed, false);
  assert.deepEqual(get('i1'), edited);
  assert.equal((await restore('missing')).status, 404);
  assert.equal((await restore('never')).status, 409);
});

test('detail page: restore button hidden for every locked state and until the order lookup finished (same rule as the API)', () => {
  const free = { quoteStatus: 'new', sentAt: null };
  assert.equal(draftReplaceBlock(free, false), null);
  for (const status of ['new', 'DRAFT', 'HANDOFF']) assert.equal(draftReplaceBlock({ quoteStatus: status, sentAt: null }, false), null, status);
  for (const status of ['ORDER_PENDING', 'STAFF_PRICED', 'SENT', 'CONFIRMED', 'ARCHIVED']) assert.notEqual(draftReplaceBlock({ quoteStatus: status, sentAt: null }, false), null, status);
  assert.notEqual(draftReplaceBlock(free, true), null, 'order present / not yet known');
  assert.notEqual(draftReplaceBlock({ quoteStatus: 'new', sentAt: '2026-11-01T00:00:00Z' }, false), null, 'sent_at');
  const page = fs.readFileSync(path.join(__dirname, '../app/admin/quotes/[id]/page.tsx'), 'utf8');
  assert.ok(page.includes('restoreBlock={draftReplaceBlock(quote, !orderChecked || Boolean(orderView))}'));
  assert.ok(page.includes('{view.regenerated && !restoreBlock ? ('), 'button only without a block');
  assert.equal((page.match(/還原成舊草稿<\/button>/g) || []).length, 1);
  assert.ok(/setOrderView\(null\);\n\s+setOrderChecked\(true\);/.test(page), 'checked only after the 404 (no order) answer');
});

// ---- 救火員 v10 review scripts, pinned. They need a throwaway local PostgreSQL or the e42ac37 worktree, so they
// run by hand (see the handoff notes), not in the offline suite. v10-regenerate-restore-db-proof.cjs differs from
// the reviewer's original in two lines only: its sample row (`gm`) now uses the fictional fixture values, and its
// van row's trip date is the fictional 8/7;
// v10-frozen-v5-diff.cjs likewise in one line (one place pair of its input grid).
const crypto = require('node:crypto');
const V10_REVIEW = {
  'v10-regenerate-restore-db-proof.cjs': '520d67179c0cabbe14f879251aad0287a0bb520c2e71621024b2a84d67f1bda9',
  'v10-restore-order-stale.cjs': '30a0d50509e086df18b9a70cc12fc9318ee47536c6b77677f1bc0176d1d5b23e',
  'v10-frozen-v5-diff.cjs': '3d99f8b63efa927dee4ec1343b4e459bdd0158915d6fc1ccc706cfa220ecd1d5',
};
test('reviewer v10 scripts are pinned', () => {
  for (const [name, sha] of Object.entries(V10_REVIEW)) {
    const file = path.join(__dirname, 'test-support/review', name);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), sha, name);
  }
});
