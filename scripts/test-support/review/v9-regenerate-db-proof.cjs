// Local throwaway Postgres (embedded, 127.0.0.1:55439, db fuyun_v9_test) — NOT production. Exercises
// POST /api/admin/quotes/prefill {regenerateLegacy} with the real route, real lib/quoteArchive and a real
// PrismaClient. Auth: the real adminQuoteAuth for unauthenticated checks (no admin env set), a switch for
// the authorized runs. LINE (lib/lineApi) and global fetch are spies; any call is counted.
const path = require('path'); const root = process.argv[2]; process.chdir(root);
const { mock, load } = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
const db = new PrismaClient();
let hook = null; // async (rowsJustRead) => void, runs between findMany and the updates (race simulation)
const quoteDelegate = new Proxy({}, { get: (_, k) => k === 'findMany' ? async (a) => { const r = await db.charterQuote.findMany(a); if (hook) { const h = hook; hook = null; await h(r); } return r; } : db.charterQuote[k].bind(db.charterQuote) });
mock('@/lib/prisma', { prisma: new Proxy({}, { get: (_, k) => k === 'charterQuote' ? quoteDelegate : (typeof db[k] === 'function' ? db[k].bind(db) : db[k]) }) });
const realAuth = load('lib/adminQuoteAuth.ts');
let authed = false;
mock('@/lib/adminQuoteAuth', { ...realAuth, verifyAdminMutation: (r) => authed || realAuth.verifyAdminMutation(r), verifyAdminRequest: (r) => authed || realAuth.verifyAdminRequest(r) });
const lineCalls = []; mock('@/lib/lineApi', new Proxy({}, { get: (_, k) => async (...a) => { lineCalls.push(String(k)); } }));
const fetchCalls = []; globalThis.fetch = async (u) => { fetchCalls.push(String(u)); throw new Error('network disabled in test'); };
const { buildQuotePrefill } = load('lib/quotePrefill.ts');
const { sendBlock } = load('lib/quoteSendGuard.ts');
const route = load('app/api/admin/quotes/prefill/route.ts');
const post = async (body, headers = {}) => { const r = await route.POST(new Request('https://fuyuntravel.test/api/admin/quotes/prefill', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };
const snapshot = async () => JSON.stringify(await db.charterQuote.findMany({ orderBy: { id: 'asc' } }));
const CREATED = new Date('2026-06-25T02:00:00Z');
const LEGACY = '【後台報價草稿】\n九人座賓士小車 台北至九份，用車 10 小時\n基本車資 7000 元\n日期：8/7\n請人員核對後再決定是否送出。本按鈕不會自動傳送。';
const busSrc = { tripDate: '8/7', passengerCount: 40, pickup: '台北', destination: '台中', remark: '無行李 來回' };
const vanSrc = { tripDate: '8/7', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' };
const out = { steps: [] }; const step = (name, data) => { out.steps.push({ name, ...data }); };
(async () => {
  await db.charterOrder.deleteMany({}); await db.charterQuote.deleteMany({}); // throwaway local test DB only
  const wrongYear = buildQuotePrefill({ quoteOptions: [], ...busSrc }, 'line-webhook', new Date('2026-11-11T07:00:00Z')); // v8 bug: 8/7 read as 2027 (Sat)
  const fresh = buildQuotePrefill({ quoteOptions: [], ...busSrc, createdAt: CREATED }, 'line-webhook', CREATED);
  const edited = buildQuotePrefill({ quoteOptions: [], ...busSrc }, 'line-webhook', new Date('2026-11-11T07:00:00Z'));
  const base = { lineUserId: 'U-test', createdAt: CREATED, recommendedVehicle: '' };
  const R = {
    A_legacy_untouched: { ...base, ...vanSrc, quoteStatus: 'new', quoteDraftText: LEGACY, quoteOptions: { fleetFare: { rateId: 'taipei-jiufen-10h', hours: 10 } } },
    B_legacy_staff_edited_kept_prefix: { ...base, ...vanSrc, quoteStatus: 'new', quoteDraftText: LEGACY + '\n（人員補充）客人要求 7:00 在飯店門口接，回程送到松山機場，已與客人電話確認。', quoteOptions: { fleetFare: { rateId: 'taipei-jiufen-10h', hours: 10 } } },
    C_auto_wrong_year: { ...base, ...busSrc, quoteStatus: 'new', quoteDraftText: wrongYear.quoteDraftText, quoteOptions: wrongYear.quoteOptions },
    D_auto_already_current: { ...base, ...busSrc, quoteStatus: 'new', quoteDraftText: fresh.quoteDraftText, quoteOptions: fresh.quoteOptions },
    E_auto_staff_reviewed: { ...base, ...busSrc, quoteStatus: 'new', quoteDraftText: edited.quoteDraftText + '\n人員改過', quoteOptions: { ...edited.quoteOptions, autoDraft: { ...edited.quoteOptions.autoDraft, staffReviewed: true } } },
    F_auto_with_fleet_button: { ...base, ...busSrc, quoteStatus: 'new', quoteDraftText: wrongYear.quoteDraftText, quoteOptions: { ...wrongYear.quoteOptions, fleetFare: { rateId: 'taipei-day-10h', hours: 10 } } },
    G_legacy_status_DRAFT: { ...base, ...vanSrc, quoteStatus: 'DRAFT', quoteDraftText: LEGACY, quoteOptions: {} },
    H_legacy_sent: { ...base, ...vanSrc, quoteStatus: 'new', sentAt: new Date('2026-07-01T00:00:00Z'), quoteDraftText: LEGACY, quoteOptions: {} },
    I_legacy_with_order: { ...base, ...vanSrc, quoteStatus: 'new', quoteDraftText: LEGACY, quoteOptions: {} },
    J_legacy_archived: { ...base, ...vanSrc, quoteStatus: 'ARCHIVED', quoteDraftText: LEGACY, quoteOptions: { archive: { previousStatus: 'new' } } },
    K_handoff: { ...base, ...busSrc, quoteStatus: 'HANDOFF', quoteDraftText: wrongYear.quoteDraftText, quoteOptions: wrongYear.quoteOptions },
    L_legacy_not_in_ids: { ...base, ...vanSrc, quoteStatus: 'new', quoteDraftText: LEGACY, quoteOptions: {} },
    M_plain_staff_text: { ...base, ...busSrc, quoteStatus: 'new', quoteDraftText: '您好，台北到台中來回報價 NT$18,000。', quoteOptions: {} },
    N_race_target: { ...base, ...vanSrc, quoteStatus: 'new', quoteDraftText: LEGACY, quoteOptions: {} },
    O_race_archive: { ...base, ...vanSrc, quoteStatus: 'new', quoteDraftText: LEGACY, quoteOptions: {} },
  };
  for (const [id, data] of Object.entries(R)) await db.charterQuote.create({ data: { id, ...data } });
  await db.charterOrder.create({ data: { id: 'ord1', quoteId: 'I_legacy_with_order', lineUid: 'U-test', baseAmountTwd: 7000, vehicleLabel: 'van', routeLabel: 'x', quoteFingerprint: 'f' } });
  const ids = Object.keys(R).filter((k) => !k.startsWith('L_') && !k.startsWith('N_') && !k.startsWith('O_'));
  // 1. unauthenticated (real auth, no admin env): no cookie, bogus bearer, empty bearer, fake cookie
  const s0 = await snapshot();
  for (const [label, h] of [['無 cookie', {}], ['假 Bearer', { authorization: 'Bearer abc' }], ['空 Bearer', { authorization: 'Bearer ' }], ['假 admin cookie', { cookie: 'admin_session=forged.jwt.value' }]]) {
    const r = await post({ regenerateLegacy: true, ids }, h); step(`未登入 ${label}`, { status: r.status, body: r.body });
  }
  step('未登入後 DB 不變', { unchanged: (await snapshot()) === s0 });
  authed = true;
  // 2. id validation
  for (const [label, body] of [['ids 缺', { regenerateLegacy: true }], ['ids 空陣列', { regenerateLegacy: true, ids: [] }], ['ids 51 筆', { regenerateLegacy: true, ids: Array.from({ length: 51 }, (_, i) => 'x' + i) }], ['ids 含非字串', { regenerateLegacy: true, ids: ['A_legacy_untouched', 1] }], ['ids 含空白/SQL', { regenerateLegacy: true, ids: ["A' OR 1=1 --"] }], ['ids="all"', { regenerateLegacy: true, ids: 'all' }]]) {
    const r = await post(body); step(`驗證 ${label}`, { status: r.status, body: r.body });
  }
  step('驗證後 DB 不變', { unchanged: (await snapshot()) === s0 });
  // 3. dryRun
  const dry = await post({ regenerateLegacy: true, ids, dryRun: true }); step('dryRun', { status: dry.status, body: dry.body, dbUnchanged: (await snapshot()) === s0 });
  // 4. real run
  const run1 = await post({ regenerateLegacy: true, ids: [...ids, ids[0]] }); const s1 = await snapshot();
  step('第 1 次執行', { status: run1.status, body: run1.body });
  const after = Object.fromEntries((await db.charterQuote.findMany()).map((r) => [r.id, r]));
  const view = (id) => { const r = after[id]; const o = r.quoteOptions || {}; return { status: r.quoteStatus, sentAt: r.sentAt, textHead: (r.quoteDraftText || '').split('\n').slice(0, 2).join(' / '), feeLine: (r.quoteDraftText || '').split('\n').find((l) => l.startsWith('司機')) || null, legacyDraftKept: o.legacyDraft ? o.legacyDraft.text === R[id].quoteDraftText : null, keptKeys: Object.keys(o).sort(), sendGuard: sendBlock({ quoteDraftText: r.quoteDraftText, quoteOptions: r.quoteOptions }) }; };
  step('結果逐列', { rows: Object.fromEntries(Object.keys(R).map((id) => [id, view(id)])) });
  // 5. idempotent second run
  const run2 = await post({ regenerateLegacy: true, ids }); step('第 2 次執行（冪等）', { status: run2.status, body: run2.body, dbUnchanged: (await snapshot()) === s1 });
  // 6. races: staff saves N between read and write; O archived between read and write
  hook = async () => { await db.charterQuote.update({ where: { id: 'N_race_target' }, data: { quoteDraftText: LEGACY + '\n人員同時編輯' } }); };
  const rN = await post({ regenerateLegacy: true, ids: ['N_race_target'] }); const nRow = await db.charterQuote.findUnique({ where: { id: 'N_race_target' } });
  step('競態：讀取後人員同時存檔', { body: rN.body, finalTextKeepsStaffEdit: nRow.quoteDraftText.endsWith('人員同時編輯'), legacyDraft: (nRow.quoteOptions || {}).legacyDraft || null });
  hook = async () => { await db.charterQuote.update({ where: { id: 'O_race_archive' }, data: { quoteStatus: 'ARCHIVED' } }); };
  const rO = await post({ regenerateLegacy: true, ids: ['O_race_archive'] }); const oRow = await db.charterQuote.findUnique({ where: { id: 'O_race_archive' } });
  step('競態：讀取後被移除', { body: rO.body, status: oRow.quoteStatus, textUnchanged: oRow.quoteDraftText === LEGACY });
  hook = async () => { await db.charterOrder.create({ data: { id: 'ord2', quoteId: 'L_legacy_not_in_ids', lineUid: 'U-test', baseAmountTwd: 7000, vehicleLabel: 'van', routeLabel: 'x', quoteFingerprint: 'f' } }); };
  const rL = await post({ regenerateLegacy: true, ids: ['L_legacy_not_in_ids'] }); const lRow = await db.charterQuote.findUnique({ where: { id: 'L_legacy_not_in_ids' } });
  step('競態：讀取後（訂單檢查前）建立訂單', { body: rL.body, textChanged: lRow.quoteDraftText !== LEGACY });
  // 7. regenerateLegacy not === true falls to the existing batch prefill path
  const s7 = await snapshot(); const rs = await post({ regenerateLegacy: 'true', ids: ['A_legacy_untouched'], dryRun: true });
  step('regenerateLegacy:"true"（字串）走既有 batch prefill（dryRun）', { status: rs.status, body: rs.body, dbUnchanged: (await snapshot()) === s7 });
  out.lineCalls = lineCalls; out.fetchCalls = fetchCalls;
  console.log(JSON.stringify(out, null, 2));
  await db.$disconnect();
})().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
