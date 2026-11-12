// v10–v11 route proof on a THROWAWAY local PostgreSQL (DATABASE_URL must point at 127.0.0.1/localhost; refuses
// anything else). Real PrismaClient, real POST /api/admin/quotes/prefill and /api/admin/quotes/[id]/legacy-restore,
// real lib/quoteArchive and the frozen v5 generator. Real adminQuoteAuth for the 401 checks (run with no admin
// env), a switch for authorized runs. LINE and fetch are spies. Prints JSON; exit 1 on any failed check.
// v11: the order flow through the real order / staff-price / PATCH / archive routes, and real concurrent
// transactions (row lock shared with order creation; an order committed by another connection right before the
// conditional UPDATE).
// usage: DATABASE_URL=postgresql://postgres@127.0.0.1:55441/fuyun_v10_test node scripts/test-support/quotes-legacy-db-proof.cjs <root>
const path = require('path'); const root = path.resolve(process.argv[2] || '.'); process.chdir(root);
if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL || '')) { console.error('refusing: DATABASE_URL is not a local throwaway database'); process.exit(2); }
const { mock, load } = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
const db = new PrismaClient();
let hook = null;
const quoteDelegate = new Proxy({}, { get: (_, k) => k === 'findMany' ? async (a) => { const r = await db.charterQuote.findMany(a); if (hook) { const h = hook; hook = null; await h(r); } return r; } : db.charterQuote[k].bind(db.charterQuote) });
mock('@/lib/prisma', { prisma: new Proxy({}, { get: (_, k) => k === 'charterQuote' ? quoteDelegate : (typeof db[k] === 'function' ? db[k].bind(db) : db[k]) }) });
const realAuth = load('lib/adminQuoteAuth.ts');
let authed = false;
mock('@/lib/adminQuoteAuth', { ...realAuth, verifyAdminMutation: (r) => authed || realAuth.verifyAdminMutation(r), verifyAdminRequest: (r) => authed || realAuth.verifyAdminRequest(r) });
const lineCalls = []; mock('@/lib/lineApi', new Proxy({}, { get: (_, k) => async () => { lineCalls.push(String(k)); } }));
const fetchCalls = []; globalThis.fetch = async (u) => { fetchCalls.push(String(u)); throw new Error('network disabled'); };
const { buildQuotePrefill } = load('lib/quotePrefill.ts');
const { legacyV5DraftForRow } = load('lib/legacyFleetDraftV5.ts');
const prefillRoute = load('app/api/admin/quotes/prefill/route.ts');
const restoreRoute = load('app/api/admin/quotes/[id]/legacy-restore/route.ts');
const REAL = require(path.join(root, 'scripts/fixtures/legacy-v5-draft-sample.json'));
const orderRoute = load('app/api/admin/quotes/[id]/order/route.ts');
const staffPriceRoute = load('app/api/admin/quotes/[id]/order/staff-price/route.ts');
const quoteRoute = load('app/api/admin/quotes/[id]/route.ts');
const archiveRoute = load('app/api/admin/quotes/[id]/archive/route.ts');
const { regenerateLegacyDrafts, restoreLegacyDraft } = load('lib/quoteArchive.ts');
const { convertConfirmedQuote, quoteFingerprint } = load('lib/charterOrder.ts');
const other = new PrismaClient(); // a second connection pool, for writes by "someone else"
const call = async (handler, url, id, body, method = 'POST') => { const r = await handler(new Request(`https://fuyun.test${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), { params: { id } }); return { status: r.status, body: await r.json() }; };
const makeOrder = (id) => call(orderRoute.POST, `/api/admin/quotes/${id}/order`, id);
const readOrder = (id) => call(orderRoute.GET, `/api/admin/quotes/${id}/order`, id, undefined, 'GET');
const patch = (id, body) => call(quoteRoute.PATCH, `/api/admin/quotes/${id}`, id, body, 'PATCH');
const archive = (id) => call(archiveRoute.POST, `/api/admin/quotes/${id}/archive`, id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (body, headers = {}) => { const r = await prefillRoute.POST(new Request('https://fuyun.test/api/admin/quotes/prefill', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
const restore = async (id) => { const r = await restoreRoute.POST(new Request(`https://fuyun.test/api/admin/quotes/${id}/legacy-restore`, { method: 'POST' }), { params: { id } }); return { status: r.status, body: await r.json() }; };
const snapshot = async () => JSON.stringify(await db.charterQuote.findMany({ orderBy: { id: 'asc' } }));
const row = (id) => db.charterQuote.findUnique({ where: { id } });
const checks = []; const check = (name, ok, detail) => { checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }); };
const STAFF = '7:00 飯店接、回程送松山機場，已電話確認';
const CREATED = new Date('2026-06-25T02:00:00Z');
const VAN = { tripDate: '8/7', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無', recommendedVehicle: '九人座賓士小車' };
const BUS = { tripDate: '8/7', passengerCount: 40, pickup: '台北', destination: '台北市區', remark: '無行李 單程' };
const v5 = (id, edit = (t) => t) => { const r = { id, lineUserId: 'U-test', quoteStatus: 'new', createdAt: CREATED, ...VAN, quoteOptions: { legacyOptions: [], fleetFare: { version: 1, rateId: 'taipei-jiufen-10h', hours: 10, source: { pickup: VAN.pickup, destination: VAN.destination, remark: VAN.remark } } } }; r.quoteDraftText = edit(legacyV5DraftForRow(r)); return r; };
(async () => {
  await db.charterOrder.deleteMany({}); await db.charterQuote.deleteMany({}); // throwaway local DB only
  const wrong = buildQuotePrefill({ ...BUS, quoteOptions: [] }, 'backfill', new Date('2026-11-11T07:58:59Z'));
  const R = [
    { ...REAL, _note: undefined, lineUserId: 'U-test', createdAt: new Date(REAL.createdAt) },
    v5('V5_exact'),
    v5('V5_staff_line', (t) => `${t}\n${STAFF}`),
    v5('V5_trailing_space', (t) => `${t} `),
    v5('V5_extra_blank_line', (t) => t.replace('\n\n車資', '\n\n\n車資')),
    v5('V5_comma', (t) => t.replace('尚未送給客人。', '尚未送給客人，')),
    v5('V5_race_staff_save'),
    v5('V5_race_archive'),
    v5('V5_with_order'),
    { id: 'V8_wrong_year', lineUserId: 'U-test', quoteStatus: 'new', createdAt: CREATED, ...BUS, recommendedVehicle: wrong.recommendedVehicle, quoteDraftText: wrong.quoteDraftText, quoteOptions: wrong.quoteOptions },
    { id: 'V8_staff_reviewed', lineUserId: 'U-test', quoteStatus: 'new', createdAt: CREATED, ...BUS, recommendedVehicle: wrong.recommendedVehicle, quoteDraftText: `${wrong.quoteDraftText}\n${STAFF}`, quoteOptions: { ...wrong.quoteOptions, autoDraft: { ...wrong.quoteOptions.autoDraft, staffReviewed: true } } },
  ];
  for (const r of R) { const { _note, ...data } = r; await db.charterQuote.create({ data }); }
  await db.charterOrder.create({ data: { id: 'ord1', quoteId: 'V5_with_order', lineUid: 'U-test', baseAmountTwd: 7000, vehicleLabel: 'van', routeLabel: 'x', quoteFingerprint: 'f' } });
  const main = [REAL.id, 'V5_exact', 'V5_staff_line', 'V5_trailing_space', 'V5_extra_blank_line', 'V5_comma', 'V5_with_order', 'V8_wrong_year', 'V8_staff_reviewed'];
  const s0 = await snapshot();
  // 1. auth
  for (const h of [{}, { authorization: 'Bearer abc' }, { cookie: 'admin_session=forged' }]) check(`prefill 未登入 ${JSON.stringify(h)} → 401`, (await post({ regenerateLegacy: true, ids: main }, h)).status === 401);
  check('legacy-restore 未登入 → 401', (await restore(REAL.id)).status === 401);
  check('未登入後 DB 不變', (await snapshot()) === s0);
  authed = true;
  // 2. flag must be boolean true when ids are given
  for (const body of [{ regenerateLegacy: 'true', ids: main }, { regenerateLegacy: 'true', ids: main, dryRun: true }, { regenerateLegacy: 1, ids: main }, { regenerateLegacy: false, ids: main }, { ids: main }, { regenerateLegacy: 'true' }]) {
    const r = await post(body); check(`400 ${JSON.stringify(body).slice(0, 60)}`, r.status === 400, r.body.error);
  }
  check('400 之後 DB 不變', (await snapshot()) === s0);
  // 3. dry run
  const expectGen = [REAL.id, 'V5_exact', 'V8_wrong_year'];
  const expectSkip = { V5_staff_line: '舊格式但可能已被人員修改', V5_trailing_space: '舊格式但可能已被人員修改', V5_extra_blank_line: '舊格式但可能已被人員修改', V5_comma: '舊格式但可能已被人員修改', V5_with_order: '已有訂單', V8_staff_reviewed: '草稿不是舊格式或已被人員修改' };
  const dry = await post({ regenerateLegacy: true, ids: main, dryRun: true });
  check('dryRun generated = sample + V5_exact + V8_wrong_year', JSON.stringify(dry.body.generated) === JSON.stringify(expectGen), dry.body.generated);
  check('dryRun skipped reasons', JSON.stringify(Object.fromEntries(dry.body.skipped.map((s) => [s.id, s.reason]))) === JSON.stringify(expectSkip), dry.body.skipped);
  check('dryRun DB 不變', (await snapshot()) === s0);
  // 4. real run
  const run = await post({ regenerateLegacy: true, ids: main });
  check('real run generated', JSON.stringify(run.body.generated) === JSON.stringify(expectGen), run.body.generated);
  for (const id of Object.keys(expectSkip)) { const before = R.find((r) => r.id === id); const now = await row(id); check(`${id} 文字逐位元未變`, now.quoteDraftText === before.quoteDraftText); }
  const real = await row(REAL.id);
  check('sample 已重產（無舊前綴、legacyDraft=原文、regenerated 標記）', !real.quoteDraftText.startsWith('【後台報價草稿】') && real.quoteOptions.legacyDraft.text === REAL.quoteDraftText && real.quoteOptions.regenerated.kind === 'legacyV5');
  const v8 = await row('V8_wrong_year');
  check('V8 錯年 → 8/7（週五）平日 NT$2,500', v8.quoteDraftText.includes('8/7（週五）為平日，NT$2,500'));
  const s1 = await snapshot();
  const again = await post({ regenerateLegacy: true, ids: main });
  check('第 2 次 generated=[] 且 DB 不變', again.body.generated.length === 0 && (await snapshot()) === s1);
  // 5. races on real v5 drafts
  hook = async () => { await db.charterQuote.update({ where: { id: 'V5_race_staff_save' }, data: { quoteDraftText: (await row('V5_race_staff_save')).quoteDraftText + `\n${STAFF}` } }); };
  const rs = await post({ regenerateLegacy: true, ids: ['V5_race_staff_save'] });
  const rsRow = await row('V5_race_staff_save');
  check('競態：讀取後人員存檔 → 同時被改過，人員文字保留', rs.body.skipped[0]?.reason === '同時被改過' && rsRow.quoteDraftText.endsWith(STAFF) && !rsRow.quoteOptions.legacyDraft, rs.body);
  hook = async () => { await db.charterQuote.update({ where: { id: 'V5_race_archive' }, data: { quoteStatus: 'ARCHIVED' } }); };
  const ra = await post({ regenerateLegacy: true, ids: ['V5_race_archive'] });
  const raRow = await row('V5_race_archive');
  check('競態：讀取後被移除 → 同時被改過，未寫入', ra.body.skipped[0]?.reason === '同時被改過' && raRow.quoteDraftText.startsWith('【後台報價草稿】'), ra.body);
  // 6. restore
  const r1 = await restore(REAL.id);
  const restored = await row(REAL.id);
  check('還原：200 changed:true，文字回到原文，regenerated 清除，autoDraft 移除，legacyDraft 保留，重產版存入 restoreHistory', r1.status === 200 && r1.body.changed === true && restored.quoteDraftText === REAL.quoteDraftText && restored.quoteOptions.regenerated === undefined && restored.quoteOptions.autoDraft === undefined && restored.quoteOptions.legacyDraft.text === REAL.quoteDraftText && restored.quoteStatus === 'new' && restored.sentAt === null && restored.quoteOptions.restoreHistory.length === 1 && restored.quoteOptions.restoreHistory[0].quoteDraftText === real.quoteDraftText);
  const s2 = await snapshot();
  const r2 = await restore(REAL.id);
  check('還原冪等：changed:false 且 DB 不變', r2.status === 200 && r2.body.changed === false && (await snapshot()) === s2);
  const r3 = await restore('V8_wrong_year'); const v8back = await row('V8_wrong_year');
  check('V8 還原：原文與原 autoDraft 回來', r3.body.changed === true && v8back.quoteDraftText === wrong.quoteDraftText && require('util').isDeepStrictEqual(v8back.quoteOptions.autoDraft, wrong.quoteOptions.autoDraft));
  check('還原沒有 legacyDraft 的列 → 409', (await restore('V5_staff_line')).status === 409);
  check('還原不存在的 id → 404', (await restore('nope')).status === 404);
  // 7. v11 order flow through the real routes
  const V = (id) => v5(id);
  for (const id of ['O_pending', 'O_priced', 'O_new_with_order', 'O_sent', 'O_confirmed', 'O_archived', 'O_sent_at', 'O_lock_wait', 'O_other_conn', 'O_restore_first', 'R_other_conn', 'H_history']) { const { _note, ...data } = V(id); await db.charterQuote.create({ data }); }
  const regenIds = ['O_pending', 'O_priced', 'O_new_with_order', 'O_sent', 'O_confirmed', 'O_archived', 'O_sent_at', 'O_lock_wait', 'O_other_conn', 'O_restore_first', 'H_history'];
  const rg = await post({ regenerateLegacy: true, ids: regenIds });
  check('v11 準備：11 列重產', rg.body.generated.length === regenIds.length, rg.body);
  const fp = {};
  const mo = await makeOrder('O_pending'); check('重產後建立訂單（真 /order 路由）→ ORDER_PENDING', mo.status === 200 && (await row('O_pending')).quoteStatus === 'ORDER_PENDING', mo.body);
  fp.O_pending = (await db.charterOrder.findUnique({ where: { quoteId: 'O_pending' } })).quoteFingerprint;
  await makeOrder('O_priced');
  const ov = await readOrder('O_priced');
  const sp = await call(staffPriceRoute.POST, '/api/admin/quotes/O_priced/order/staff-price', 'O_priced', { items: ov.body.items.map((i) => ({ key: i.key, decision: 'not_applicable', reason: '測試不適用' })), totalAmountTwd: ov.body.baseAmountTwd });
  check('內部核定（真 staff-price 路由）→ STAFF_PRICED', sp.status === 200 && (await row('O_priced')).quoteStatus === 'STAFF_PRICED', sp.body);
  fp.O_priced = (await db.charterOrder.findUnique({ where: { quoteId: 'O_priced' } })).quoteFingerprint;
  await makeOrder('O_new_with_order');
  const back = await row('O_new_with_order');
  const pb = await patch('O_new_with_order', { quoteStatus: 'new', quoteDraftText: back.quoteDraftText, recommendedVehicle: back.recommendedVehicle });
  check('有訂單但人員用 PATCH 把狀態改回 new', pb.status === 200 && (await row('O_new_with_order')).quoteStatus === 'new');
  fp.O_new_with_order = (await db.charterOrder.findUnique({ where: { quoteId: 'O_new_with_order' } })).quoteFingerprint;
  await db.charterQuote.update({ where: { id: 'O_sent' }, data: { quoteStatus: 'SENT', sentAt: new Date() } });
  await db.charterQuote.update({ where: { id: 'O_confirmed' }, data: { quoteStatus: 'CONFIRMED', sentAt: new Date() } });
  check('移除（真 archive 路由）', (await archive('O_archived')).status === 200 && (await row('O_archived')).quoteStatus === 'ARCHIVED');
  await db.charterQuote.update({ where: { id: 'O_sent_at' }, data: { sentAt: new Date() } });
  for (const id of ['O_pending', 'O_priced', 'O_new_with_order', 'O_sent', 'O_confirmed', 'O_archived', 'O_sent_at']) {
    const before = JSON.stringify(await row(id));
    const r = await restore(id);
    const order = await db.charterOrder.findUnique({ where: { quoteId: id } });
    const ro = order ? await readOrder(id) : null;
    check(`還原 ${id} → 409，列不變${order ? '，訂單指紋不變、未過期' : ''}`, r.status === 409 && JSON.stringify(await row(id)) === before && (!order || (order.quoteFingerprint === fp[id] && quoteFingerprint(await row(id)) === fp[id] && ro.body.stale === false)), { status: r.status, error: r.body.error });
    if (order && (await row(id)).quoteStatus !== 'ARCHIVED') check(`${id}：「移除」同樣 409`, (await archive(id)).status === 409);
  }
  // regenerate under the same states → skipped, nothing written (rows put back to an untouched v5 draft first)
  for (const id of ['O_pending', 'O_priced', 'O_new_with_order', 'O_sent', 'O_confirmed', 'O_archived', 'O_sent_at']) {
    const cur = await row(id);
    await db.charterQuote.update({ where: { id }, data: { quoteDraftText: v5(id).quoteDraftText, recommendedVehicle: v5(id).recommendedVehicle, quoteOptions: v5(id).quoteOptions } });
    const before = JSON.stringify(await row(id));
    const order = await db.charterOrder.findUnique({ where: { quoteId: id } });
    const r = await post({ regenerateLegacy: true, ids: [id] });
    check(`重產 ${id} → 略過（${r.body.skipped[0]?.reason}），列不變`, r.body.generated.length === 0 && JSON.stringify(await row(id)) === before && (!order || r.body.skipped[0].reason === '已有訂單'), r.body);
    void cur;
  }
  // 7b. real concurrency: order creation holds the row lock; restore waits, then sees the order → 409
  let release; const gate = new Promise((r) => { release = r; }); let locked; const lockedP = new Promise((r) => { locked = r; });
  const orderP = convertConfirmedQuote('O_lock_wait', { afterLock: async () => { locked(); await gate; } });
  await lockedP;
  let restoreDone = false;
  const restoreP = restore('O_lock_wait').then((r) => { restoreDone = true; return r; });
  await sleep(400);
  check('並行：建立訂單持有列鎖時，還原在等鎖', restoreDone === false);
  release();
  const [ordered, rw] = await Promise.all([orderP, restoreP]);
  const lwOrder = await db.charterOrder.findUnique({ where: { quoteId: 'O_lock_wait' } });
  check('並行：訂單先成立 → 還原 409，訂單指紋不變、未過期', ordered.ok === true && rw.status === 409 && lwOrder.quoteFingerprint === quoteFingerprint(await row('O_lock_wait')) && (await readOrder('O_lock_wait')).body.stale === false, { rw: rw.body });
  // 7c. an order committed by another connection right before the UPDATE (status still new): the WHERE refuses
  const beforeOther = JSON.stringify(await row('O_other_conn'));
  const rc = await restoreLegacyDraft('O_other_conn', { beforeWrite: async (tx, id) => {
    const cur = await other.charterQuote.findUnique({ where: { id } });
    await other.charterOrder.create({ data: { id: 'ord-other', quoteId: id, lineUid: 'U-test', baseAmountTwd: 7000, vehicleLabel: 'van', routeLabel: 'x', quoteFingerprint: quoteFingerprint(cur) } });
  } });
  check('並行（另一連線在 UPDATE 前寫入訂單、狀態仍 new）→ 還原 409，列不變，訂單指紋相符', rc.status === 409 && JSON.stringify(await row('O_other_conn')) === beforeOther && (await db.charterOrder.findUnique({ where: { quoteId: 'O_other_conn' } })).quoteFingerprint === quoteFingerprint(await row('O_other_conn')), rc);
  await db.charterQuote.update({ where: { id: 'R_other_conn' }, data: {} });
  const beforeR = JSON.stringify(await row('R_other_conn'));
  const gc = await regenerateLegacyDrafts({ ids: ['R_other_conn'] }, { beforeWrite: async (tx, id) => {
    const cur = await other.charterQuote.findUnique({ where: { id } });
    await other.charterOrder.create({ data: { id: 'ord-other-r', quoteId: id, lineUid: 'U-test', baseAmountTwd: 7000, vehicleLabel: 'van', routeLabel: 'x', quoteFingerprint: quoteFingerprint(cur) } });
  } });
  check('並行（另一連線在 UPDATE 前寫入訂單）→ 重產略過「已有訂單」，列不變', gc.skipped[0]?.reason === '已有訂單' && JSON.stringify(await row('R_other_conn')) === beforeR, gc);
  // 7d. restore first (holds the lock), order creation waits and is then built on the restored row (not stale)
  let rel2; const gate2 = new Promise((r) => { rel2 = r; }); let in2; const in2P = new Promise((r) => { in2 = r; });
  const restore2P = restoreLegacyDraft('O_restore_first', { beforeWrite: async () => { in2(); await gate2; } });
  await in2P;
  let orderDone = false;
  const order2P = convertConfirmedQuote('O_restore_first').then((r) => { orderDone = true; return r; });
  await sleep(400);
  check('並行：還原持有列鎖時，建立訂單在等鎖', orderDone === false);
  rel2();
  const [rr, oo] = await Promise.all([restore2P, order2P]);
  check('並行：還原先完成 → 訂單建立在還原後的內容上，未過期', rr.ok === true && rr.changed === true && oo.ok === true && (await readOrder('O_restore_first')).body.stale === false && (await row('O_restore_first')).quoteDraftText.startsWith('【後台報價草稿】'));
  check('並行：之後再按還原 → 409（已有訂單）', (await restore('O_restore_first')).status === 409);
  // 7e. staff edit after regenerate is kept in restoreHistory; restore twice idempotent
  const h0 = await row('H_history');
  const STAFF_TEXT = `${h0.quoteDraftText}\n${STAFF}`;
  check('重產後人員修改（真 PATCH）', (await patch('H_history', { quoteStatus: 'new', quoteDraftText: STAFF_TEXT, recommendedVehicle: '中型巴士' })).status === 200);
  const hr = await restore('H_history'); const h1 = await row('H_history');
  const hist = h1.quoteOptions.restoreHistory || [];
  check('還原後人員版本在 restoreHistory（文字、車型、時間）', hr.status === 200 && hist.length === 1 && hist[0].quoteDraftText === STAFF_TEXT && hist[0].recommendedVehicle === '中型巴士' && !Number.isNaN(Date.parse(hist[0].savedAt)) && h1.quoteDraftText === v5('H_history').quoteDraftText);
  const sH = await snapshot();
  const hr2 = await restore('H_history');
  check('再按還原：changed:false，DB 不變', hr2.status === 200 && hr2.body.changed === false && (await snapshot()) === sH);
  // 7f. staff saves (another connection) while restore holds the row lock: the save waits, then lands on top of
  // the restored row; nothing is lost (the regenerated draft is in restoreHistory, the staff text is current).
  { const { _note, ...data } = v5('S_save_during_restore'); await db.charterQuote.create({ data }); }
  await post({ regenerateLegacy: true, ids: ['S_save_during_restore'] });
  const regenText = (await row('S_save_during_restore')).quoteDraftText;
  let rel3; const gate3 = new Promise((r) => { rel3 = r; }); let in3; const in3P = new Promise((r) => { in3 = r; });
  const restore3P = restoreLegacyDraft('S_save_during_restore', { beforeWrite: async () => { in3(); await gate3; } });
  await in3P;
  let saveDone = false;
  const saveP = other.charterQuote.update({ where: { id: 'S_save_during_restore' }, data: { quoteDraftText: '人員剛存的新內容' } }).then(() => { saveDone = true; });
  await sleep(400);
  check('並行：還原持有列鎖時，人員存檔在等鎖', saveDone === false);
  rel3();
  const [r3x] = await Promise.all([restore3P, saveP]);
  const s3 = await row('S_save_during_restore');
  check('並行：還原後人員存檔生效（人員文字保留），重產版在 restoreHistory', r3x.ok === true && s3.quoteDraftText === '人員剛存的新內容' && s3.quoteOptions.restoreHistory[0].quoteDraftText === regenText);
  check('LINE 0 次、fetch 0 次', lineCalls.length === 0 && fetchCalls.length === 0, { lineCalls, fetchCalls });
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ checks, summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.map((c) => c.name) } }, null, 2));
  await db.$disconnect(); await other.$disconnect();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
