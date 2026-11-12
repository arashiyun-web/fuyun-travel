// v12 route proof on a THROWAWAY local PostgreSQL (DATABASE_URL must point at 127.0.0.1/localhost; refuses
// anything else). Real PrismaClient and the real routes: POST /[id]/send, POST /[id]/draft (fleet button),
// PATCH /[id], POST /[id]/order, POST /[id]/order/staff-price, POST /prefill (regenerateLegacy). Real adminQuoteAuth
// for the 401 checks (no admin env), a switch for authorized runs. LINE push is a spy (can be slowed down or made
// to fail); fetch is disabled. A second PrismaClient plays "someone else". Fictional data only.
// Prints JSON; exit 1 on any failed check.
// usage: DATABASE_URL=postgresql://postgres@127.0.0.1:55442/fuyun_v12_test node scripts/test-support/quotes-v12-db-proof.cjs <root>
const path = require('path'); const root = path.resolve(process.argv[2] || '.'); process.chdir(root);
if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL || '')) { console.error('refusing: DATABASE_URL is not a local throwaway database'); process.exit(2); }
const { mock, load } = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
const db = new PrismaClient();
const other = new PrismaClient();
mock('@/lib/prisma', { prisma: db });
const realAuth = load('lib/adminQuoteAuth.ts');
let authed = false;
mock('@/lib/adminQuoteAuth', { ...realAuth, verifyAdminMutation: (r) => authed || realAuth.verifyAdminMutation(r), verifyAdminRequest: (r) => authed || realAuth.verifyAdminRequest(r) });
const pushes = []; let pushDelay = 0; let pushFail = false; let duringPush = null;
mock('@/lib/lineApi', new Proxy({}, { get: (_, k) => async (to, text) => {
  if (k !== 'pushLineText') { pushes.push({ k: String(k) }); return; }
  if (duringPush) { const f = duringPush; duringPush = null; await f(); }
  if (pushDelay) await new Promise((r) => setTimeout(r, pushDelay));
  if (pushFail) throw new Error('LINE Push API failed: 500 (spy)');
  pushes.push({ to, text });
} }));
const fetchCalls = []; globalThis.fetch = async (u) => { fetchCalls.push(String(u)); throw new Error('network disabled'); };
const { buildQuotePrefill } = load('lib/quotePrefill.ts');
const { quoteFingerprint, convertConfirmedQuote } = load('lib/charterOrder.ts');
const { sendQuoteGuarded, fleetDraftGuarded } = load('lib/quoteOrderWrites.ts');
const guard = load('lib/quoteDraftGuard.ts');
const sendRoute = load('app/api/admin/quotes/[id]/send/route.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');
const quoteRoute = load('app/api/admin/quotes/[id]/route.ts');
const orderRoute = load('app/api/admin/quotes/[id]/order/route.ts');
const staffPriceRoute = load('app/api/admin/quotes/[id]/order/staff-price/route.ts');
const prefillRoute = load('app/api/admin/quotes/prefill/route.ts');
const call = async (handler, url, id, body, method = 'POST') => { const r = await handler(new Request(`https://fuyun.test${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), { params: { id } }); return { status: r.status, body: await r.json() }; };
const send = (id) => call(sendRoute.POST, `/api/admin/quotes/${id}/send`, id);
const button = (id, body = { rateId: 'taipei-jiufen-10h', hours: 10 }) => call(draftRoute.POST, `/api/admin/quotes/${id}/draft`, id, body);
const patch = (id, body) => call(quoteRoute.PATCH, `/api/admin/quotes/${id}`, id, body, 'PATCH');
const makeOrder = (id) => call(orderRoute.POST, `/api/admin/quotes/${id}/order`, id);
const readOrder = (id) => call(orderRoute.GET, `/api/admin/quotes/${id}/order`, id, undefined, 'GET');
const regenerate = async (ids) => { const r = await prefillRoute.POST(new Request('https://fuyun.test/api/admin/quotes/prefill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ regenerateLegacy: true, ids }) })); return { status: r.status, body: await r.json() }; };
const row = (id) => db.charterQuote.findUnique({ where: { id } });
const order = (id) => db.charterOrder.findUnique({ where: { quoteId: id } });
const snap = async (id) => JSON.stringify(await row(id));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = []; const check = (name, ok, detail) => { checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) }); };

const CREATED = new Date('2026-07-03T02:00:00Z'); // fictional; 2026-10-16 is a Friday, 10-17 a Saturday
const LATER = new Date('2026-11-12T01:00:00Z');
const VAN = { tripDate: '11/20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' };
const BUS = { passengerCount: 40, pickup: '台北', destination: '台北市區', remark: '無行李 來回' };
const vanRow = (id, extra = {}) => { const p = buildQuotePrefill({ ...VAN, createdAt: CREATED, quoteOptions: [] }, 'line-webhook', CREATED); return { id, lineUserId: 'U-test', quoteStatus: 'new', createdAt: CREATED, ...VAN, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions, ...extra }; };
const create = (data) => db.charterQuote.create({ data });
const lockBy = (client, id, during) => client.$transaction(async (tx) => { await tx.$queryRaw`SELECT id FROM charter_quotes WHERE id = ${id} FOR UPDATE`; await during(tx); }, { timeout: 20000 });

(async () => {
  await db.charterOrder.deleteMany({}); await db.charterQuote.deleteMany({}); // throwaway local DB only
  const tz = await db.$queryRaw`SELECT current_setting('TimeZone') AS tz`;
  check(`session TimeZone is not UTC (${tz[0].tz}), so the sent_at conversion is exercised`, tz[0].tz !== 'UTC' && tz[0].tz !== 'Etc/UTC');

  // ---- 0. auth ----
  await create(vanRow('A_auth'));
  const a0 = await snap('A_auth');
  check('未登入 send → 401', (await send('A_auth')).status === 401);
  check('未登入 draft → 401', (await button('A_auth')).status === 401);
  check('未登入 PATCH → 401', (await patch('A_auth', { quoteStatus: 'new', quoteDraftText: 'x' })).status === 401);
  check('未登入後列不變、沒有推播', (await snap('A_auth')) === a0 && pushes.length === 0);
  authed = true;

  // ---- 1. range date through regenerateLegacy (real route): wrong-year auto draft → created_at year ----
  const wrong = buildQuotePrefill({ ...BUS, tripDate: '10/16 ~ 17', quoteOptions: [] }, 'backfill', LATER); // built without created_at, after the date
  check('準備：沒有 created_at 時的舊草稿 = 2027 的週六起（v11 實際錯誤的形狀）', wrong.quoteDraftText.includes('10/16（週六）'));
  await create({ id: 'D_range', lineUserId: 'U-test', quoteStatus: 'new', createdAt: CREATED, ...BUS, tripDate: '10/16 ~ 17', recommendedVehicle: wrong.recommendedVehicle, quoteDraftText: wrong.quoteDraftText, quoteOptions: wrong.quoteOptions });
  for (const [i, form] of ['10/16-10/17', '10/16〜17', '10月16-17日', '１０／１６～１７'].entries()) {
    const w = buildQuotePrefill({ ...BUS, tripDate: form, quoteOptions: [] }, 'backfill', LATER);
    await create({ id: `D_form${i}`, lineUserId: 'U-test', quoteStatus: 'new', createdAt: CREATED, ...BUS, tripDate: form, recommendedVehicle: w.recommendedVehicle, quoteDraftText: w.quoteDraftText, quoteOptions: w.quoteOptions });
  }
  const ids = ['D_range', 'D_form0', 'D_form1', 'D_form2', 'D_form3'];
  const rg = await regenerate(ids);
  check('regenerateLegacy（真路由）5 列都重產', rg.status === 200 && JSON.stringify(rg.body.generated) === JSON.stringify(ids), rg.body);
  for (const id of ids) {
    const t = (await row(id)).quoteDraftText;
    check(`${id}：10/16（週五）～10/17（週六）含週末，每日計的司機服務費`, t.includes('司機服務費另計（每日計）：10/16（週五）～10/17（週六）含週末，平日 NT$2,500、週末及國定假日 NT$3,500') && t.includes('10/16（週五）～10/17（週六）含週末，假日 NT$') && !t.includes('10/16（週六）'), t.split('\n').filter((l) => /10\//.test(l)));
  }
  const ds = await send('D_range');
  check('重產後的範圍草稿可直接送出（送出守衛不擋系統文字）', ds.status === 200 && pushes.at(-1).text === (await row('D_range')).quoteDraftText && (await row('D_range')).quoteStatus === 'SENT', ds.body);
  const sentAt = (await row('D_range')).sentAt;
  check('sent_at 是送出當下（UTC 正確，與 JS 時間差 < 60 秒）', sentAt instanceof Date && Math.abs(sentAt.getTime() - Date.now()) < 60000, sentAt);

  // ---- 2. order states through the real routes: send and fleet button → 409 ----
  const states = ['S_pending', 'S_priced', 'S_order_new', 'S_order_sent', 'S_pending_no_order'];
  for (const id of states) { await create(vanRow(id)); const b = await button(id); check(`${id} 準備：車資按鈕 200（金額 7000）`, b.status === 200 && b.body.amountTwd === 7000, b.body); }
  for (const id of ['S_pending', 'S_priced', 'S_order_new', 'S_order_sent']) { const o = await makeOrder(id); check(`${id}：建立訂單（真 /order）`, o.status === 200 && (await row(id)).quoteStatus === 'ORDER_PENDING', o.body); }
  const ov = await readOrder('S_priced');
  const sp = await call(staffPriceRoute.POST, '/api/admin/quotes/S_priced/order/staff-price', 'S_priced', { items: ov.body.items.map((i) => ({ key: i.key, decision: 'not_applicable', reason: '測試不適用' })), totalAmountTwd: ov.body.baseAmountTwd });
  check('S_priced：內部核定（真 staff-price）→ STAFF_PRICED', sp.status === 200 && (await row('S_priced')).quoteStatus === 'STAFF_PRICED', sp.body);
  await db.charterQuote.update({ where: { id: 'S_order_new' }, data: { quoteStatus: 'new' } }); // old data
  await db.charterQuote.update({ where: { id: 'S_order_sent' }, data: { quoteStatus: 'SENT', sentAt: new Date() } }); // old data
  await db.charterQuote.update({ where: { id: 'S_pending_no_order' }, data: { quoteStatus: 'ORDER_PENDING' } });
  for (const id of states) {
    const before = await snap(id); const o = await order(id); const p0 = pushes.length;
    const s = await send(id);
    const d1 = await button(id, { rateId: 'taipei-jiufen-10h', hours: 9 });
    const d2 = await button(id, { vehicleHint: '中巴', rateId: null, hours: null });
    const after = await snap(id);
    const stale = o ? (await readOrder(id)).body.stale : null;
    check(`${id}（${JSON.parse(before).quoteStatus}${o ? '，有訂單' : '，無訂單列'}）：送出 409、車資按鈕 409 ×2，沒有推播，列逐位元不變${o ? '，訂單指紋相符、未過期' : ''}`,
      s.status === 409 && s.body.error === guard.ORDER_SEND_ERROR && d1.status === 409 && d1.body.error === guard.ORDER_DRAFT_ERROR && d2.status === 409 && pushes.length === p0 && after === before && (!o || (o.quoteFingerprint === quoteFingerprint(await row(id)) && stale === false)),
      { send: s.body.error, d1: d1.body.error, d2: d2.body.error, stale });
  }

  // ---- 3. real concurrency ----
  // 3a. order creation holds the row lock (order row + ORDER_PENDING); send / fleet button wait, then 409.
  for (const kind of ['send', 'draft']) {
    const id = `C_lock_${kind}`; await create(vanRow(id)); await button(id);
    let release; const gate = new Promise((r) => { release = r; }); let locked; const lockedP = new Promise((r) => { locked = r; });
    const orderP = convertConfirmedQuote(id, { afterLock: async () => { locked(); await gate; } });
    await lockedP;
    let done = false; const p0 = pushes.length;
    const actP = (kind === 'send' ? send(id) : button(id, { rateId: 'taipei-jiufen-10h', hours: 9 })).then((r) => { done = true; return r; });
    await sleep(400);
    check(`並行 ${kind}：建立訂單持有列鎖時，${kind} 在等鎖`, done === false);
    release();
    const [ordered, r] = await Promise.all([orderP, actP]);
    const o = await order(id);
    check(`並行 ${kind}：訂單先成立 → ${kind} 409，沒有推播，訂單指紋相符、未過期`, ordered.ok && r.status === 409 && pushes.length === p0 && o.quoteFingerprint === quoteFingerprint(await row(id)) && (await readOrder(id)).body.stale === false && (await row(id)).quoteStatus === 'ORDER_PENDING', r.body);
  }
  // 3b. send holds the lock while LINE is pushed (slow push); order creation waits and then sees a SENT row.
  {
    const id = 'C_send_first'; await create(vanRow(id)); await button(id);
    pushDelay = 600; let orderDone = false; let orderP;
    duringPush = async () => { orderP = makeOrder(id).then((r) => { orderDone = true; return r; }); await sleep(300); check('並行：送出持有列鎖（推播中），建立訂單在等鎖', orderDone === false); };
    const s = await send(id); pushDelay = 0;
    const o = await orderP; const ro = await row(id); const ord = await order(id);
    check('並行：送出先完成（SENT）→ 之後才建立訂單，訂單取自已送出的列、指紋相符', s.status === 200 && o.status === 200 && ord && ord.quoteFingerprint === quoteFingerprint(ro) && ro.sentAt != null && ro.quoteStatus === 'ORDER_PENDING', { s: s.status, o: o.body.error });
  }
  // 3c. another connection commits an order row right before the UPDATE (status still new, it takes no lock):
  //     the conditional UPDATE's NOT EXISTS refuses → 409, nothing pushed / written.
  for (const kind of ['send', 'draft']) {
    const id = `C_other_${kind}`; await create(vanRow(id)); await button(id);
    const before = await snap(id); const p0 = pushes.length;
    const beforeWrite = async (tx, qid) => { const cur = await other.charterQuote.findUnique({ where: { id: qid } }); await other.charterOrder.create({ data: { id: `ord-${qid}`, quoteId: qid, lineUid: 'U-test', baseAmountTwd: 7000, vehicleLabel: 'van', routeLabel: 'x', quoteFingerprint: quoteFingerprint(cur) } }); };
    const r = kind === 'send'
      ? await sendQuoteGuarded(id, () => null, async () => { pushes.push({ to: 'x', text: 'must not happen' }); }, { beforeWrite })
      : await fleetDraftGuarded(id, (q) => ({ data: { quoteDraftText: 'replaced', recommendedVehicle: q.recommendedVehicle, quoteOptions: { replaced: true } }, extra: {} }), { beforeWrite });
    check(`並行（另一連線在 UPDATE 前寫入訂單、狀態仍 new）→ ${kind} 409，沒有推播，列不變`, r.status === 409 && r.error === (kind === 'send' ? guard.ORDER_SEND_ERROR : guard.ORDER_DRAFT_ERROR) && pushes.length === p0 && (await snap(id)) === before, r);
  }
  // 3d. status becomes STAFF_PRICED right before the UPDATE (no order row): NOT IN refuses.
  for (const kind of ['send', 'draft']) {
    const id = `C_status_${kind}`; await create(vanRow(id)); await button(id);
    const p0 = pushes.length;
    const beforeWrite = async (tx, qid) => { await tx.charterQuote.update({ where: { id: qid }, data: { quoteStatus: 'STAFF_PRICED' } }); };
    const r = kind === 'send'
      ? await sendQuoteGuarded(id, () => null, async () => { pushes.push({ to: 'x', text: 'must not happen' }); }, { beforeWrite })
      : await fleetDraftGuarded(id, (q) => ({ data: { quoteDraftText: 'replaced', recommendedVehicle: q.recommendedVehicle, quoteOptions: { replaced: true } }, extra: {} }), { beforeWrite });
    const cur = await row(id);
    check(`UPDATE 前狀態變成 STAFF_PRICED → ${kind} 409，沒有推播，文字未被覆蓋`, r.status === 409 && pushes.length === p0 && cur.quoteDraftText !== 'replaced' && cur.sentAt === null, r);
  }

  // ---- 4. a failed LINE push rolls the status back ----
  {
    const id = 'F_push_fail'; await create(vanRow(id)); await button(id);
    const before = await snap(id); pushFail = true; let threw = false;
    try { await send(id); } catch (e) { threw = /LINE Push API failed/.test(e.message); }
    pushFail = false;
    check('推播失敗 → 路由丟出錯誤（同 v11 的 500），交易回滾：狀態與 sent_at 未變', threw && (await snap(id)) === before);
    const again = await send(id);
    check('之後重送 → 200，SENT', again.status === 200 && (await row(id)).quoteStatus === 'SENT');
  }
  // ---- 5. without an order: unchanged behaviour ----
  {
    const id = 'N_plain'; await create(vanRow(id));
    const b = await button(id); const t = (await row(id)).quoteDraftText;
    const s = await send(id);
    check('無訂單：車資按鈕 200，送出 200，推一次且內容等於草稿', b.status === 200 && s.status === 200 && pushes.at(-1).text === t);
    check('已送出的列：車資按鈕與重送仍可用（不變）', (await button(id)).status === 200 && (await send(id)).status === 200);
    await db.charterQuote.update({ where: { id }, data: { quoteStatus: 'ARCHIVED' } });
    check('ARCHIVED：送出 409（原訊息）', (await send(id)).body.error === '這筆詢價已移除，請先還原再送出。');
    check('不存在：送出 404、按鈕 404、PATCH 404', (await send('nope')).status === 404 && (await button('nope')).status === 404 && (await patch('nope', { quoteStatus: 'new' })).status === 404);
  }

  // ---- 6. PATCH: lock and status allowlist ----
  {
    const id = 'P_lock'; await create(vanRow(id));
    let patchDone = false; let patchP;
    await lockBy(other, id, async (tx) => {
      patchP = patch(id, { quoteStatus: 'new', quoteDraftText: '人員修改後的內容', recommendedVehicle: '九人座賓士小車' }).then((r) => { patchDone = true; return r; });
      await sleep(400);
      check('PATCH：另一連線持有列鎖（例如還原進行中）時，PATCH 在等鎖', patchDone === false);
      const cur = await tx.charterQuote.findUnique({ where: { id } });
      await tx.charterQuote.update({ where: { id }, data: { quoteOptions: { ...cur.quoteOptions, restoreHistory: [{ savedAt: '2026-11-12T00:00:00.000Z', quoteDraftText: 'saved' }] } } });
    });
    const r = await patchP; const cur = await row(id);
    check('PATCH：鎖放開後才讀 options → 另一連線寫入的 restoreHistory 保留，人員文字寫入', r.status === 200 && cur.quoteDraftText === '人員修改後的內容' && Array.isArray(cur.quoteOptions.restoreHistory) && cur.quoteOptions.restoreHistory.length === 1, cur.quoteOptions.restoreHistory);
    const mk = async (pid, status) => { await create(vanRow(pid, { quoteStatus: status })); return (await row(pid)); };
    const body = (q, s) => ({ quoteStatus: s, quoteDraftText: q.quoteDraftText, recommendedVehicle: q.recommendedVehicle });
    let q = await mk('P_new', 'new');
    check('PATCH new → SENT 409（沒有 sent_at 的 SENT 不再可能）', (await patch('P_new', body(q, 'SENT'))).status === 409 && (await row('P_new')).quoteStatus === 'new');
    check('PATCH new → ORDER_PENDING 409', (await patch('P_new', body(q, 'ORDER_PENDING'))).status === 409);
    check('PATCH new → 任意字串 409', (await patch('P_new', body(q, 'whatever'))).status === 409);
    check('PATCH new → HANDOFF 200', (await patch('P_new', body(q, 'HANDOFF'))).status === 200 && (await row('P_new')).quoteStatus === 'HANDOFF');
    check('PATCH HANDOFF → DRAFT 200', (await patch('P_new', body(q, 'DRAFT'))).status === 200);
    q = await row('S_pending');
    check('PATCH ORDER_PENDING → new 409（訂單列不能改狀態）', (await patch('S_pending', body(q, 'new'))).status === 409 && (await row('S_pending')).quoteStatus === 'ORDER_PENDING');
    check('PATCH ORDER_PENDING 保持原狀態 → 200（照舊）', (await patch('S_pending', body(q, 'ORDER_PENDING'))).status === 200);
    q = await row('S_order_new');
    check('PATCH 有訂單但狀態 new → HANDOFF 409', (await patch('S_order_new', body(q, 'HANDOFF'))).status === 409);
  }
  const summary = { checks: checks.length, failed: checks.filter((c) => !c.ok).length, linePushes: pushes.length, otherLineCalls: pushes.filter((p) => p.k).length, fetchCalls: fetchCalls.length };
  console.log(JSON.stringify({ checks, summary }, null, 2));
  await db.$disconnect(); await other.$disconnect();
  process.exit(summary.failed || fetchCalls.length ? 1 : 0);
})().catch(async (e) => { console.error(e); await db.$disconnect(); await other.$disconnect(); process.exit(1); });
