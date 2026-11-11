// Local throwaway Postgres (embedded, 127.0.0.1:55440, db fuyun_v10_test) — NOT production. Real routes:
// POST /api/admin/quotes/prefill {regenerateLegacy} and POST /api/admin/quotes/[id]/legacy-restore, real
// lib/quoteArchive + PrismaClient. Untouched legacy texts are produced by the ORIGINAL v5 generator from a
// separate e42ac37 worktree (not the frozen copy). LINE (lib/lineApi) and global fetch are counting spies.
const path = require('path'); const [root, v5root] = process.argv.slice(2); process.chdir(root);
const loader = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
const db = new PrismaClient();
const hooks = { findMany: null, findUnique: null };
const delegate = new Proxy({}, { get: (_, k) => (k === 'findMany' || k === 'findUnique') ? async (a) => { const r = await db.charterQuote[k](a); if (hooks[k]) { const h = hooks[k]; hooks[k] = null; await h(r); } return r; } : db.charterQuote[k].bind(db.charterQuote) });
loader.mock('@/lib/prisma', { prisma: new Proxy({}, { get: (_, k) => k === 'charterQuote' ? delegate : (typeof db[k] === 'function' ? db[k].bind(db) : db[k]) }) });
const realAuth = loader.load('lib/adminQuoteAuth.ts'); let authed = false;
loader.mock('@/lib/adminQuoteAuth', { ...realAuth, verifyAdminMutation: (r) => authed || realAuth.verifyAdminMutation(r), verifyAdminRequest: (r) => authed || realAuth.verifyAdminRequest(r) });
const lineCalls = []; loader.mock('@/lib/lineApi', new Proxy({}, { get: (_, k) => async () => { lineCalls.push(String(k)); } }));
const fetchCalls = []; globalThis.fetch = async (u) => { fetchCalls.push(String(u)); throw new Error('network disabled'); };
const prefillRoute = loader.load('app/api/admin/quotes/prefill/route.ts');
const restoreRoute = loader.load('app/api/admin/quotes/[id]/legacy-restore/route.ts');
const { buildQuotePrefill } = loader.load('lib/quotePrefill.ts');
const { sendBlock } = loader.load('lib/quoteSendGuard.ts');
// original v5 generator (e42ac37), loaded in isolation after the v10 modules are cached
const v5 = require(path.join(v5root, 'scripts/test-support/step2-load-ts.cjs')).load('lib/fleetQuoteDraft.ts').buildFleetQuoteDraft;
const v5text = (row) => v5({ pickup: row.pickup, destination: row.destination, remark: row.remark, vehicleHint: row.recommendedVehicle, passengerCount: row.passengerCount, hours: row.quoteOptions?.fleetFare?.hours ?? null, rateId: row.quoteOptions?.fleetFare?.rateId ?? null }).text;
const req = (url, body, headers = {}) => new Request(`https://fuyuntravel.test${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const prefill = async (body, headers) => { const r = await prefillRoute.POST(req('/api/admin/quotes/prefill', body, headers)); return { status: r.status, body: await r.json() }; };
const restore = async (id, headers) => { const r = await restoreRoute.POST(req(`/api/admin/quotes/${id}/legacy-restore`, undefined, headers), { params: { id } }); const b = await r.json(); return { status: r.status, success: b.success, changed: b.changed, error: b.error || null }; };
const snap = async () => JSON.stringify(await db.charterQuote.findMany({ orderBy: { id: 'asc' } }));
const get = (id) => db.charterQuote.findUnique({ where: { id } });
const out = { steps: [] }; const step = (name, data) => { out.steps.push({ name, ...data }); };
const CREATED = new Date('2026-06-25T02:00:00Z');
(async () => {
  await db.charterOrder.deleteMany({}); await db.charterQuote.deleteMany({});
  const fleet = (rateId, hours) => ({ fleetFare: { rateId, hours, source: { pickup: '台北車站', destination: '九份', remark: '無行李 來回' }, version: 1 } });
  const van = { lineUserId: 'U-test', createdAt: CREATED, tripDate: '8/7', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回', recommendedVehicle: '九人座賓士小車' };
  const gm = { lineUserId: 'U-test', createdAt: new Date('2026-08-20T03:15:00.000Z'), tripDate: '10/18', passengerCount: 35, pickup: '板橋', destination: '宜蘭', remark: '無', recommendedVehicle: '', quoteOptions: { fleetFare: { hours: null, rateId: null, source: { pickup: '板橋', remark: '無', destination: '宜蘭' }, version: 1 }, legacyOptions: [] } };
  const mk = (base, opts) => { const row = { ...base, quoteOptions: opts ?? base.quoteOptions }; return { ...row, quoteDraftText: v5text(row) }; };
  const untouched = mk(van, fleet('taipei-jiufen-10h', 10));
  const R = {
    A_untouched_v5: { ...untouched, quoteStatus: 'new' },
    A2_untouched_gm_shape: { ...mk(gm), quoteStatus: 'new' },
    B_v9_case_7am_hotel: { ...untouched, quoteStatus: 'new', quoteDraftText: untouched.quoteDraftText + '\n（人員補充）客人要求 7:00 在飯店門口接，回程送到松山機場，已與客人電話確認。' },
    B2_one_char_edit: { ...untouched, quoteStatus: 'new', quoteDraftText: untouched.quoteDraftText.replace('九份', '九分') },
    B3_trailing_newline: { ...untouched, quoteStatus: 'new', quoteDraftText: untouched.quoteDraftText + '\n' },
    B4_vehicle_changed_after: { ...untouched, recommendedVehicle: 'TOYOTA 中巴', quoteStatus: 'new' },
    B5_fabricated_prefix_only: { ...untouched, quoteStatus: 'new', quoteDraftText: '【後台報價草稿】\n人員自己寫的內容' },
    C_status_DRAFT: { ...untouched, quoteStatus: 'DRAFT' },
    D_sent: { ...untouched, quoteStatus: 'new', sentAt: new Date('2026-07-01T00:00:00Z') },
    E_with_order: { ...untouched, quoteStatus: 'new' },
    F_race_staff_save: { ...untouched, quoteStatus: 'new' },
  };
  for (const [id, d] of Object.entries(R)) await db.charterQuote.create({ data: { id, ...d } });
  await db.charterOrder.create({ data: { id: 'ord-E', quoteId: 'E_with_order', lineUid: 'U-test', baseAmountTwd: 7000, vehicleLabel: 'van', routeLabel: 'x', quoteFingerprint: 'f' } });
  const ids = Object.keys(R).filter((k) => k !== 'F_race_staff_save');
  // 1. unauthenticated, both routes
  const s0 = await snap();
  for (const [l, h] of [['無 cookie', {}], ['假 Bearer', { authorization: 'Bearer x' }], ['偽造 cookie', { cookie: 'admin_session=forged' }]]) {
    step(`未登入 prefill ${l}`, (await prefill({ regenerateLegacy: true, ids }, h)));
    step(`未登入 legacy-restore ${l}`, await restore('A_untouched_v5', h));
  }
  step('未登入後 DB 不變', { unchanged: (await snap()) === s0 });
  authed = true;
  // 2. flag / ids validation
  for (const [l, b] of [['"true" 字串', { regenerateLegacy: 'true', ids }], ['1', { regenerateLegacy: 1, ids }], ['false＋ids', { regenerateLegacy: false, ids }], ['只有 ids', { ids }], ['"true" 無 ids', { regenerateLegacy: 'true' }], ['ids 缺', { regenerateLegacy: true }], ['ids 空', { regenerateLegacy: true, ids: [] }], ['51 筆', { regenerateLegacy: true, ids: Array.from({ length: 51 }, (_, i) => 'x' + i) }], ['50 筆（上限內，皆不存在）', { regenerateLegacy: true, ids: Array.from({ length: 50 }, (_, i) => 'x' + i), dryRun: true }], ['非字串', { regenerateLegacy: true, ids: [1] }], ['SQL 字元', { regenerateLegacy: true, ids: ["a' OR 1=1"] }]]) {
    const r = await prefill(b); step(`驗證 ${l}`, { status: r.status, error: r.body.error || null, generated: r.body.generated ? r.body.generated.length : undefined });
  }
  step('驗證後 DB 不變', { unchanged: (await snap()) === s0 });
  // 3. dryRun
  const dry = await prefill({ regenerateLegacy: true, ids, dryRun: true }); step('dryRun', { status: dry.status, generated: dry.body.generated, skipped: dry.body.skipped, dbUnchanged: (await snap()) === s0 });
  // 4. run + idempotent
  const run1 = await prefill({ regenerateLegacy: true, ids }); const s1 = await snap(); step('第 1 次', { generated: run1.body.generated, skipped: run1.body.skipped });
  for (const id of ['A_untouched_v5', 'A2_untouched_gm_shape', 'B_v9_case_7am_hotel']) { const r = await get(id); const o = r.quoteOptions || {}; step(`列 ${id}`, { textChanged: r.quoteDraftText !== R[id].quoteDraftText, legacyDraftEqualsOld: o.legacyDraft ? o.legacyDraft.text === R[id].quoteDraftText : null, kind: o.legacyDraft?.kind, regenerated: o.regenerated || null, keys: Object.keys(o).sort(), status: r.quoteStatus, sendGuard: sendBlock({ quoteDraftText: r.quoteDraftText, quoteOptions: r.quoteOptions })?.code || null, head: r.quoteDraftText.split('\n')[0] }); }
  const run2 = await prefill({ regenerateLegacy: true, ids }); step('第 2 次（冪等）', { generated: run2.body.generated, dbUnchanged: (await snap()) === s1 });
  // 5. regenerate race: staff saves between read and write
  hooks.findMany = async () => { await db.charterQuote.update({ where: { id: 'F_race_staff_save' }, data: { quoteDraftText: R.F_race_staff_save.quoteDraftText + '\n人員同時存檔' } }); };
  const rF = await prefill({ regenerateLegacy: true, ids: ['F_race_staff_save'] }); step('regenerate 競態', { skipped: rF.body.skipped, staffKept: (await get('F_race_staff_save')).quoteDraftText.endsWith('人員同時存檔') });
  // 6. legacy-restore
  const A = R.A_untouched_v5;
  const r1 = await restore('A_untouched_v5'); const a1 = await get('A_untouched_v5');
  step('restore A', { ...r1, textEqualsLegacyDraft: a1.quoteDraftText === a1.quoteOptions.legacyDraft.text, textEqualsOriginal: a1.quoteDraftText === A.quoteDraftText, recommendedVehicleBack: a1.recommendedVehicle === A.recommendedVehicle, regeneratedCleared: a1.quoteOptions.regenerated === undefined, autoDraftRemoved: a1.quoteOptions.autoDraft === undefined, fleetFareKept: JSON.stringify(a1.quoteOptions.fleetFare) === JSON.stringify(A.quoteOptions.fleetFare), legacyDraftKept: typeof a1.quoteOptions.legacyDraft?.text === 'string', status: a1.quoteStatus });
  const sA = await snap(); const r2 = await restore('A_untouched_v5'); step('restore A 再按（冪等）', { ...r2, dbUnchanged: (await snap()) === sA });
  step('restore 不存在', await restore('nope'));
  step('restore 沒有 legacyDraft', await restore('C_status_DRAFT'));
  // status / sent refusals: copy the regenerated A2 row into several states
  const base = await get('A2_untouched_gm_shape');
  const variants = { SENT: { quoteStatus: 'SENT' }, CONFIRMED: { quoteStatus: 'CONFIRMED' }, ARCHIVED: { quoteStatus: 'ARCHIVED' }, sentAt: { sentAt: new Date() }, ORDER_PENDING: { quoteStatus: 'ORDER_PENDING' }, STAFF_PRICED: { quoteStatus: 'STAFF_PRICED' }, HANDOFF: { quoteStatus: 'HANDOFF' }, DRAFT: { quoteStatus: 'DRAFT' } };
  for (const [k, v] of Object.entries(variants)) {
    const id = `S_${k}`; const { id: _i, ...rest } = base; await db.charterQuote.create({ data: { ...rest, id, ...v } });
    if (k === 'ORDER_PENDING' || k === 'STAFF_PRICED') await db.charterOrder.create({ data: { id: `ord-${k}`, quoteId: id, lineUid: 'U-test', baseAmountTwd: 9000, vehicleLabel: 'bus', routeLabel: 'x', quoteFingerprint: 'f' } });
    const before = (await get(id)).quoteDraftText; const r = await restore(id); step(`restore 狀態 ${k}`, { ...r, textChanged: (await get(id)).quoteDraftText !== before });
  }
  // restore race: staff saves between restore's read and write
  { const { id: _i, ...rest } = base; await db.charterQuote.create({ data: { ...rest, id: 'T_restore_race' } }); }
  hooks.findUnique = async () => { await db.charterQuote.update({ where: { id: 'T_restore_race' }, data: { quoteDraftText: '人員剛存的新內容' } }); };
  const rT = await restore('T_restore_race'); step('restore 競態', { ...rT, staffKept: (await get('T_restore_race')).quoteDraftText === '人員剛存的新內容' });
  // sequential: staff edited the regenerated draft and saved, then presses restore (confirm dialog in UI)
  { const { id: _i, ...rest } = base; await db.charterQuote.create({ data: { ...rest, id: 'U_edit_then_restore', quoteDraftText: base.quoteDraftText + '\n人員在重產後的補充' } }); }
  const rU = await restore('U_edit_then_restore'); const u = await get('U_edit_then_restore');
  step('重產後人員改過再按還原（依確認框設計會取代）', { ...rU, staffEditStillStored: JSON.stringify(u).includes('人員在重產後的補充') });
  out.lineCalls = lineCalls; out.fetchCalls = fetchCalls;
  console.log(JSON.stringify(out, null, 2)); await db.$disconnect();
})().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
