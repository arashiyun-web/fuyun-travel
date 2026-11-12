// v13 route proof on a THROWAWAY local PostgreSQL with a fake LINE server (scripts/test-support/fake-line-server.cjs).
// Real PrismaClient, real routes (POST /[id]/send, PATCH /[id]), real row locks and real convertConfirmedQuote;
// the real pushLineText talks HTTP to the fake LINE on 127.0.0.1 (https://api.line.me is rewritten there, every
// other fetch is refused). "deliveries" = messages the customer would actually see. Fictional data only.
// usage: DATABASE_URL=postgresql://postgres@127.0.0.1:55443/fuyun_v13_test node scripts/test-support/quotes-v13-send-db-proof.cjs <root> [--compare-v12] [--quick]
//   <root> = the code under test. --compare-v12 runs only (a), (b) and the double click (for the v12 code c83e71c2).
const path = require('path');
const root = path.resolve(process.argv[2] || '.');
const compareV12 = process.argv.includes('--compare-v12');
const quick = process.argv.includes('--quick');
if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL || '')) { console.error('refusing: DATABASE_URL is not a local throwaway database'); process.exit(2); }
const { createFakeLine } = require(path.join(__dirname, 'fake-line-server.cjs'));
process.chdir(root);
const { mock, load } = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let slowNextRead = 0;
const base = new PrismaClient();
// A slow DB after the push (S05): the first charterQuote read after LINE accepted waits `slowNextRead` ms.
const db = base.$extends({ query: { charterQuote: { async findUnique({ args, query }) { if (slowNextRead) { const ms = slowNextRead; slowNextRead = 0; await sleep(ms); } return query(args); } } } });
const other = new PrismaClient();
mock('@/lib/prisma', { prisma: db });
const realAuth = load('lib/adminQuoteAuth.ts');
let authed = true;
mock('@/lib/adminQuoteAuth', { ...realAuth, verifyAdminMutation: (r) => authed || realAuth.verifyAdminMutation(r), verifyAdminRequest: (r) => authed || realAuth.verifyAdminRequest(r) });
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'fake-local-token-not-real';
const fake = createFakeLine();
const sendRoute = load('app/api/admin/quotes/[id]/send/route.ts');
const itemRoute = load('app/api/admin/quotes/[id]/route.ts');
const { convertConfirmedQuote, quoteFingerprint } = load('lib/charterOrder.ts');
let retryKey = null; try { retryKey = load('lib/lineRetryKey.ts').quoteSendRetryKey; } catch {}

const call = async (fn) => { const t0 = Date.now(); try { const r = await fn(); const b = await r.json().catch(() => ({ unreadable: true })); return { status: r.status, code: b.code || null, error: b.error || null, alreadyDelivered: b.alreadyDelivered, ms: Date.now() - t0 }; } catch (e) { return { status: 'threw', error: String(e && e.message || e).split('\n').filter(Boolean).slice(-1)[0].slice(0, 160), ms: Date.now() - t0 }; } };
const send = (id) => call(() => sendRoute.POST(new Request(`https://fuyun.test/api/admin/quotes/${id}/send`, { method: 'POST' }), { params: { id } }));
const patch = (id, body) => call(() => itemRoute.PATCH(new Request(`https://fuyun.test/api/admin/quotes/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: { id } }));
const get = (id) => other.charterQuote.findUnique({ where: { id } });
const TEXT = '您好，九人座台北車站往返九份一日，車資 NT$7,000，含司機。';
const ROW = { lineUserId: 'U-fake-customer', tripDate: '7/31', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回', recommendedVehicle: '九人座賓士小車', quoteStatus: 'DRAFT', quoteDraftText: TEXT, quoteOptions: { fleetFare: { rateId: 'taipei-jiufen-10h', hours: 10, source: { pickup: '台北車站', destination: '九份', remark: '無行李 來回' }, version: 1 } } };
const mk = (id, extra = {}) => db.charterQuote.create({ data: { id, ...ROW, ...extra } });
const killTxSessions = async () => { const rows = await other.$queryRawUnsafe(`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND state LIKE 'idle in transaction%' AND pid <> pg_backend_pid()`); for (const r of rows) await other.$queryRawUnsafe(`SELECT pg_terminate_backend(${r.pid})`); return rows.length; };
const results = []; let failed = 0;
const scenario = async (id, title, fn) => {
  fake.reset(); slowNextRead = 0; authed = true;
  const t0 = Date.now();
  let data; let checks = [];
  try { const out = await fn((name, ok, detail) => checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) })); data = out; } catch (e) { checks.push({ name: 'no exception', ok: false, detail: String(e && e.stack || e).slice(0, 400) }); }
  const pass = checks.every((c) => c.ok);
  if (!pass) failed++;
  const entry = { id, title, pass, ms: Date.now() - t0, lineRequests: fake.requests.length, deliveries: fake.deliveries.length, checks, data };
  results.push(entry);
  console.error(`${pass ? 'PASS' : 'FAIL'} ${id} ${title} (deliveries ${entry.deliveries}, LINE requests ${entry.lineRequests}, ${entry.ms} ms)`);
  for (const c of checks) if (!c.ok) console.error('   ✖', c.name, JSON.stringify(c.detail));
};
const state = async (id) => { const r = await get(id); return { status: r.quoteStatus, sentAt: r.sentAt ? r.sentAt.toISOString() : null, vehicle: r.recommendedVehicle, text: r.quoteDraftText }; };

(async () => {
  await fake.start(); const restoreFetch = fake.install();
  await db.charterOrder.deleteMany({}); await db.charterQuote.deleteMany({});

  // (a) LINE accepted, then the transaction's DB session dies before commit.
  await scenario(compareV12 ? 'V12-a' : 'S03', '(a) LINE 已接受、之後 commit 失敗（DB 連線被切斷）→ 員工重送', async (check) => {
    await mk('s03'); fake.state.onDeliver = async () => { fake.state.onDeliver = null; await killTxSessions(); };
    const first = await send('s03'); await sleep(300); const mid = await state('s03');
    const retry = await send('s03'); const fin = await state('s03');
    if (!compareV12) {
      check('first: 500 LINE_UNCERTAIN with the hint', first.status === 500 && first.code === 'LINE_UNCERTAIN' && /可能已送達，請先確認 LINE 再重送/.test(first.error), first);
      check('row not SENT after the failure', mid.status === 'DRAFT' && mid.sentAt === null, mid);
      check('retry: 200, alreadyDelivered (LINE 409 accepted)', retry.status === 200 && retry.alreadyDelivered === true, retry);
      check('final SENT', fin.status === 'SENT' && fin.sentAt, fin);
      check('customer received exactly 1', fake.deliveries.length === 1, fake.deliveries.length);
      check('both requests carried the same key', fake.requests.length === 2 && fake.requests[0].key && fake.requests[0].key === fake.requests[1].key, fake.requests.map((r) => r.key));
    }
    return { first, mid, retry, fin, deliveries: fake.deliveries.length, keys: fake.requests.map((r) => r.key) };
  });

  // (b) LINE slow.
  if (!quick) {
    await scenario(compareV12 ? 'V12-b' : 'S04', compareV12 ? '(b) LINE 21 秒才回（超過交易 20 秒）→ 員工重送' : '(b1) LINE 已接受但 25 秒才回 → fetch 8 秒逾時 → 員工重送', async (check) => {
      await mk('s04'); fake.plan({ delayMs: compareV12 ? 21000 : 25000 });
      const first = await send('s04'); const mid = await state('s04');
      const retry = await send('s04'); const fin = await state('s04');
      if (!compareV12) {
        check('first ends by the fetch timeout (≈8 s), 500 LINE_UNCERTAIN', first.status === 500 && first.code === 'LINE_UNCERTAIN' && first.ms >= 7500 && first.ms < 12000, first);
        check('row not SENT', mid.status === 'DRAFT' && mid.sentAt === null, mid);
        check('retry 200 alreadyDelivered', retry.status === 200 && retry.alreadyDelivered === true, retry);
        check('final SENT', fin.status === 'SENT', fin);
        check('customer received exactly 1', fake.deliveries.length === 1, fake.deliveries.length);
      }
      return { first, mid, retry, fin, deliveries: fake.deliveries.length };
    });
  }

  if (!compareV12 && !quick) {
    await scenario('S05', '(b2) LINE 已接受後 DB 變慢，交易超過 20 秒逾時回滾 → 員工重送', async (check) => {
      await mk('s05'); fake.state.onDeliver = async () => { fake.state.onDeliver = null; slowNextRead = 21000; };
      const first = await send('s05'); await sleep(500); const mid = await state('s05');
      const retry = await send('s05'); const fin = await state('s05');
      check('first: transaction timed out after the push → 500 LINE_UNCERTAIN', first.status === 500 && first.code === 'LINE_UNCERTAIN' && first.ms >= 20000, first);
      check('row not SENT', mid.status === 'DRAFT' && mid.sentAt === null, mid);
      check('retry 200 alreadyDelivered', retry.status === 200 && retry.alreadyDelivered === true, retry);
      check('final SENT', fin.status === 'SENT', fin);
      check('customer received exactly 1', fake.deliveries.length === 1, fake.deliveries.length);
      return { first, mid, retry, fin, deliveries: fake.deliveries.length };
    });
  }

  await scenario(compareV12 ? 'V12-dc' : 'S14', '連按兩次送出（兩個請求同時）', async (check) => {
    await mk('s14'); fake.plan({ delayMs: 300 });
    const [a, b] = await Promise.all([send('s14'), sleep(50).then(() => send('s14'))]);
    const fin = await state('s14');
    if (!compareV12) {
      check('both 200', a.status === 200 && b.status === 200, { a, b });
      check('second one was the duplicate', a.alreadyDelivered === false && b.alreadyDelivered === true, { a, b });
      check('customer received exactly 1', fake.deliveries.length === 1, fake.deliveries.length);
      check('SENT', fin.status === 'SENT', fin);
    }
    return { a, b, fin, deliveries: fake.deliveries.length };
  });

  if (compareV12) return finish(restoreFetch);

  await scenario('S01', '一般送出', async (check) => {
    await mk('s01'); const r = await send('s01'); const fin = await state('s01');
    check('200, not duplicate', r.status === 200 && r.alreadyDelivered === false, r);
    check('SENT + sent_at', fin.status === 'SENT' && fin.sentAt, fin);
    check('1 delivery with the exact text', fake.deliveries.length === 1 && fake.deliveries[0].text === TEXT && fake.deliveries[0].to === ROW.lineUserId);
    check('X-Line-Retry-Key = UUIDv5(quote id, user, text)', fake.requests[0].key === retryKey('s01', ROW.lineUserId, TEXT), fake.requests[0].key);
    return { r, fin, key: fake.requests[0].key };
  });

  await scenario('S07', '等列鎖 16 秒後剩餘時間不足 → 不推送 503，之後重送', async (check) => {
    await mk('s07');
    const holder = other.$transaction(async (t) => { await t.$queryRaw`SELECT id FROM charter_quotes WHERE id = 's07' FOR UPDATE`; await sleep(16000); }, { timeout: 30000, maxWait: 5000 });
    await sleep(300);
    const first = await send('s07'); await holder; const mid = await state('s07');
    check('503 LINE_NOT_SENT', first.status === 503 && first.code === 'LINE_NOT_SENT', first);
    check('no LINE request', fake.requests.length === 0, fake.requests.length);
    check('row unchanged', mid.status === 'DRAFT' && mid.sentAt === null, mid);
    const retry = await send('s07');
    check('retry 200, 1 delivery', retry.status === 200 && fake.deliveries.length === 1, retry);
    return { first, mid, retry };
  });

  await scenario('S08', 'LINE 500（未送達）→ 重送', async (check) => {
    await mk('s08'); fake.plan({ status: 500 });
    const first = await send('s08'); const mid = await state('s08'); const retry = await send('s08');
    check('500 LINE_UNCERTAIN', first.status === 500 && first.code === 'LINE_UNCERTAIN', first);
    check('rolled back', mid.status === 'DRAFT' && mid.sentAt === null, mid);
    check('retry 200 delivered, total 1', retry.status === 200 && retry.alreadyDelivered === false && fake.deliveries.length === 1, retry);
    return { first, mid, retry };
  });

  await scenario('S09', 'LINE 500 但其實已送達 → 重送', async (check) => {
    await mk('s09'); fake.plan({ status: 500, deliver: true });
    const first = await send('s09'); const retry = await send('s09'); const fin = await state('s09');
    check('first 500 LINE_UNCERTAIN', first.status === 500 && first.code === 'LINE_UNCERTAIN', first);
    check('retry 200 alreadyDelivered, total 1', retry.status === 200 && retry.alreadyDelivered === true && fake.deliveries.length === 1, retry);
    check('SENT', fin.status === 'SENT', fin);
    return { first, retry, fin };
  });

  await scenario('S10', 'LINE 400 / 401 / 403 → 未送達、回滾', async (check) => {
    const out = {};
    for (const code of [400, 401, 403]) {
      await mk(`s10-${code}`); fake.plan({ status: code });
      const r = await send(`s10-${code}`); const s = await state(`s10-${code}`); out[code] = { r, s };
      check(`${code}: 502 LINE_REJECTED`, r.status === 502 && r.code === 'LINE_REJECTED' && /未送達/.test(r.error), r);
      check(`${code}: rolled back`, s.status === 'DRAFT' && s.sentAt === null, s);
    }
    check('0 deliveries', fake.deliveries.length === 0);
    return out;
  });

  await scenario('S11', 'LINE 429 → 未送達，稍後重送', async (check) => {
    await mk('s11'); fake.plan({ status: 429 });
    const first = await send('s11'); const mid = await state('s11'); const retry = await send('s11');
    check('503 LINE_RATE_LIMIT', first.status === 503 && first.code === 'LINE_RATE_LIMIT', first);
    check('rolled back', mid.status === 'DRAFT', mid);
    check('retry 200, total 1', retry.status === 200 && fake.deliveries.length === 1, retry);
    return { first, retry };
  });

  await scenario('S12', '網路錯誤（連線被重置 / 拒絕連線）→ 重送', async (check) => {
    await mk('s12a'); fake.plan({ destroy: true });
    const a1 = await send('s12a'); const a2 = await send('s12a');
    await mk('s12b'); fake.state.refuseNext = true;
    const b1 = await send('s12b'); const b2 = await send('s12b');
    check('reset: 500 LINE_UNCERTAIN then 200', a1.status === 500 && a1.code === 'LINE_UNCERTAIN' && a2.status === 200, { a1, a2 });
    check('refused: 500 LINE_UNCERTAIN then 200', b1.status === 500 && b1.code === 'LINE_UNCERTAIN' && b2.status === 200, { b1, b2 });
    check('2 deliveries (one per quote)', fake.deliveries.length === 2, fake.deliveries.length);
    return { a1, a2, b1, b2 };
  });

  await scenario('S13', '409 但沒有 x-line-accepted-request-id → 不當成已送達', async (check) => {
    await mk('s13'); await send('s13');
    await other.charterQuote.update({ where: { id: 's13' }, data: { quoteStatus: 'DRAFT', sentAt: null } });
    fake.plan({ noAcceptedHeader: true });
    const r = await send('s13'); const s = await state('s13');
    check('500 LINE_UNCERTAIN', r.status === 500 && r.code === 'LINE_UNCERTAIN', r);
    check('not marked SENT', s.status === 'DRAFT' && s.sentAt === null, s);
    check('1 delivery (the first send)', fake.deliveries.length === 1);
    return { r, s };
  });

  await scenario('S15', '已 SENT 的列 24 小時內同內容再送 → 不重複、sent_at 保留', async (check) => {
    await mk('s15'); await send('s15'); const before = await state('s15'); await sleep(50);
    const again = await send('s15'); const after = await state('s15');
    check('200 alreadyDelivered', again.status === 200 && again.alreadyDelivered === true, again);
    check('sent_at kept', before.sentAt === after.sentAt && after.status === 'SENT', { before, after });
    check('1 delivery', fake.deliveries.length === 1);
    return { before, again, after };
  });

  await scenario('S16', '不確定失敗後員工改了內容再送 → 新內容會送出（設計如此）', async (check) => {
    await mk('s16'); fake.plan({ status: 500, deliver: true });
    const first = await send('s16');
    const edited = TEXT + '（含過路費）';
    const p = await patch('s16', { quoteDraftText: edited, recommendedVehicle: ROW.recommendedVehicle, quoteStatus: 'DRAFT' });
    const second = await send('s16');
    check('first uncertain', first.code === 'LINE_UNCERTAIN', first);
    check('patch 200', p.status === 200, p);
    check('edited send 200, new delivery', second.status === 200 && second.alreadyDelivered === false, second);
    check('2 deliveries: original + edited (different content)', fake.deliveries.length === 2 && fake.deliveries[1].text === edited, fake.deliveries.map((d) => d.text));
    check('different keys', fake.requests[0].key !== fake.requests[1].key);
    return { first, p, second };
  });

  await scenario('S17', '改了又改回完全相同內容再送 → 同 key，不重複', async (check) => {
    await mk('s17'); fake.plan({ status: 500, deliver: true });
    await send('s17');
    await patch('s17', { quoteDraftText: TEXT + 'X', recommendedVehicle: ROW.recommendedVehicle, quoteStatus: 'DRAFT' });
    await patch('s17', { quoteDraftText: TEXT, recommendedVehicle: ROW.recommendedVehicle, quoteStatus: 'DRAFT' });
    const r = await send('s17'); const s = await state('s17');
    check('200 alreadyDelivered', r.status === 200 && r.alreadyDelivered === true, r);
    check('SENT', s.status === 'SENT', s);
    check('1 delivery', fake.deliveries.length === 1);
    return { r, s };
  });

  await scenario('S18', '24 小時界線：不確定失敗後超過 24 小時才重送 → LINE 已忘記 key，會再送一次', async (check) => {
    await mk('s18'); fake.plan({ status: 500, deliver: true });
    const first = await send('s18'); fake.advance(24 * 60 * 60 * 1000 + 1000);
    const late = await send('s18'); fake.advance(-(24 * 60 * 60 * 1000 + 1000));
    check('first uncertain', first.code === 'LINE_UNCERTAIN', first);
    check('after 24 h: 200 delivered again (not a duplicate for LINE)', late.status === 200 && late.alreadyDelivered === false, late);
    check('2 deliveries (documented boundary)', fake.deliveries.length === 2);
    return { first, late };
  });

  await scenario('S19', '舊資料：v13 前已 SENT（沒用過 key）與舊 DRAFT（quote_options 為 null）', async (check) => {
    await mk('s19-sent', { quoteStatus: 'SENT', sentAt: new Date('2026-11-01T02:00:00Z') });
    await mk('s19-draft', { quoteOptions: undefined });
    const a = await send('s19-sent'); const b = await send('s19-draft');
    check('old SENT row: 200, delivered once (the old send had no key)', a.status === 200 && a.alreadyDelivered === false, a);
    check('old DRAFT row: 200', b.status === 200, b);
    check('2 deliveries', fake.deliveries.length === 2);
    return { a, b };
  });

  await scenario('S20', '收件人換了（line_user_id 不同）→ 新 key、送給新收件人', async (check) => {
    await mk('s20'); fake.plan({ status: 500, deliver: true });
    await send('s20');
    await other.charterQuote.update({ where: { id: 's20' }, data: { lineUserId: 'U-fake-other' } });
    const r = await send('s20');
    check('200 delivered', r.status === 200 && r.alreadyDelivered === false, r);
    check('deliveries: old user then new user', fake.deliveries.length === 2 && fake.deliveries[1].to === 'U-fake-other', fake.deliveries.map((d) => d.to));
    return { r };
  });

  await scenario('S21', '訂單狀態：ORDER_PENDING / STAFF_PRICED / 已有訂單 → 409，不打 LINE', async (check) => {
    await mk('s21-op', { quoteStatus: 'ORDER_PENDING' }); await mk('s21-sp', { quoteStatus: 'STAFF_PRICED' }); await mk('s21-o');
    const conv = await convertConfirmedQuote('s21-o');
    const out = { conv: conv.ok, op: await send('s21-op'), sp: await send('s21-sp'), o: await send('s21-o') };
    check('order created', conv.ok, conv);
    check('all 409', out.op.status === 409 && out.sp.status === 409 && out.o.status === 409, out);
    check('0 LINE requests', fake.requests.length === 0);
    return out;
  });

  await scenario('S22', '送出 vs 建訂單 真併發', async (check) => {
    const rounds = quick ? 4 : 30; const bad = []; let sends200 = 0;
    for (const mode of ['send-first', 'convert-first']) for (let i = 0; i < rounds; i++) {
      const id = `s22-${mode}-${i}`; await mk(id); fake.plan({ delayMs: 150 }); const before = fake.deliveries.length;
      const s = mode === 'send-first' ? send(id) : sleep(Math.floor(Math.random() * 20)).then(() => send(id));
      const c = mode === 'send-first' ? sleep(Math.floor(Math.random() * 60)).then(() => convertConfirmedQuote(id)) : convertConfirmedQuote(id);
      const [sr, cr] = await Promise.all([s, c]);
      const row = await get(id); const order = await other.charterOrder.findUnique({ where: { quoteId: id } }); const delivered = fake.deliveries.length - before;
      if (sr.status === 200) sends200++;
      const ok = (sr.status === 200 ? delivered === 1 && row.quoteStatus !== 'DRAFT' : delivered === 0 && sr.status === 409)
        && (!order || order.quoteFingerprint === quoteFingerprint(row));
      if (!ok) bad.push({ id, sr, cr: { ok: cr.ok, error: cr.error || null }, status: row.quoteStatus, delivered, order: Boolean(order) });
      fake.state.plans.length = 0;
    }
    check('0 inconsistent rounds', bad.length === 0, bad.slice(0, 5));
    return { rounds: rounds * 2, sends200, bad: bad.length };
  });

  await scenario('S23', '既有防護：內部用字 / 空內容 / 已移除 / 未登入 → 不打 LINE', async (check) => {
    await mk('s23-int', { quoteDraftText: '【自動預生成草稿】尚未送給客人。' }); await mk('s23-empty', { quoteDraftText: '' }); await mk('s23-arc', { quoteStatus: 'ARCHIVED' }); await mk('s23-auth');
    const out = { internal: await send('s23-int'), empty: await send('s23-empty'), archived: await send('s23-arc') };
    authed = false; out.unauth = await send('s23-auth'); authed = true;
    check('409 / 400 / 409 / 401', out.internal.status === 409 && out.empty.status === 400 && out.archived.status === 409 && out.unauth.status === 401, out);
    check('0 LINE requests', fake.requests.length === 0);
    return out;
  });

  await scenario('S24', 'PATCH：已有訂單的列改 recommended_vehicle → 409，列與訂單指紋不變', async (check) => {
    await mk('s24'); const conv = await convertConfirmedQuote('s24'); const before = await get('s24');
    const r = await patch('s24', { quoteDraftText: '人員改字', recommendedVehicle: '中巴', quoteStatus: before.quoteStatus });
    const after = await get('s24'); const order = await other.charterOrder.findUnique({ where: { quoteId: 's24' } });
    check('order created', conv.ok);
    check('409 with the vehicle message', r.status === 409 && /建議車型/.test(r.error), r);
    check('row unchanged', JSON.stringify(before) === JSON.stringify(after));
    check('fingerprint still matches', order.quoteFingerprint === quoteFingerprint(after));
    // ORDER_PENDING without an order row (status only) is refused too.
    await mk('s24-st', { quoteStatus: 'ORDER_PENDING' });
    const r2 = await patch('s24-st', { quoteDraftText: TEXT, recommendedVehicle: '中巴', quoteStatus: 'ORDER_PENDING' });
    check('ORDER_PENDING status row: 409', r2.status === 409, r2);
    return { r, r2, status: before.quoteStatus };
  });

  await scenario('S25', 'PATCH：已有訂單的列、車型相同（含 null 與空字串）→ 200，車型與 quote_options 不變', async (check) => {
    const auto = { ...ROW.quoteOptions, autoDraft: { engine: 'rangeQuote', staffReviewed: false, customerBody: TEXT } };
    await mk('s25', { quoteOptions: auto }); await convertConfirmedQuote('s25'); const before = await get('s25');
    const r = await patch('s25', { quoteDraftText: '人員補一句', recommendedVehicle: ` ${ROW.recommendedVehicle} `, quoteStatus: before.quoteStatus });
    const after = await get('s25'); const order = await other.charterOrder.findUnique({ where: { quoteId: 's25' } });
    check('200', r.status === 200, r);
    check('text saved', after.quoteDraftText === '人員補一句');
    check('vehicle and quote_options unchanged', after.recommendedVehicle === before.recommendedVehicle && JSON.stringify(after.quoteOptions) === JSON.stringify(before.quoteOptions), { before: before.quoteOptions, after: after.quoteOptions });
    check('fingerprint still matches', order && order.quoteFingerprint === quoteFingerprint(after));
    await mk('s25-null', { recommendedVehicle: null, quoteStatus: 'ORDER_PENDING' });
    const r2 = await patch('s25-null', { quoteDraftText: TEXT, recommendedVehicle: '', quoteStatus: 'ORDER_PENDING' });
    const n = await get('s25-null');
    check('null vehicle + "" → 200, stays null', r2.status === 200 && n.recommendedVehicle === null, { r2, v: n.recommendedVehicle });
    return { r, r2 };
  });

  await scenario('S26', 'PATCH：沒有訂單的列改車型 → 200（照舊）', async (check) => {
    await mk('s26'); const r = await patch('s26', { quoteDraftText: TEXT, recommendedVehicle: '中巴', quoteStatus: 'DRAFT' }); const s = await state('s26');
    check('200 and saved', r.status === 200 && s.vehicle === '中巴', { r, s });
    return { r };
  });

  await scenario('S27', 'PATCH 改車型 vs 建訂單 真併發 → 0 個過期訂單', async (check) => {
    const rounds = quick ? 4 : 30; const bad = []; const tally = {};
    for (const mode of ['patch-first', 'convert-first']) for (let i = 0; i < rounds; i++) {
      const id = `s27-${mode}-${i}`; await mk(id);
      const p = () => patch(id, { quoteDraftText: TEXT, recommendedVehicle: '中巴', quoteStatus: 'DRAFT' });
      const [pr, cr] = mode === 'patch-first'
        ? await Promise.all([p(), sleep(Math.floor(Math.random() * 30)).then(() => convertConfirmedQuote(id))])
        : (await Promise.all([convertConfirmedQuote(id), sleep(Math.floor(Math.random() * 30)).then(p)])).reverse();
      const row = await get(id); const order = await other.charterOrder.findUnique({ where: { quoteId: id } });
      tally[`${mode}:${pr.status}/${cr.ok ? 'order' : 'no-order'}`] = (tally[`${mode}:${pr.status}/${cr.ok ? 'order' : 'no-order'}`] || 0) + 1;
      if (order && order.quoteFingerprint !== quoteFingerprint(row)) bad.push({ id, pr, vehicle: row.recommendedVehicle });
    }
    check('0 stale orders', bad.length === 0, bad.slice(0, 5));
    return { rounds: rounds * 2, tally, stale: bad.length };
  });

  return finish(restoreFetch);
})().catch(async (e) => { console.error(e); process.exitCode = 1; await fake.stop().catch(() => {}); await base.$disconnect(); await other.$disconnect(); });

async function finish(restoreFetch) {
  restoreFetch();
  const out = { root, compareV12, quick, at: new Date().toISOString(), failedScenarios: failed, fetchViolations: fake.state.violations, scenarios: results };
  if (fake.state.violations.length) { out.failedScenarios++; console.error('FAIL fetch outside the fake LINE:', fake.state.violations); }
  console.log(JSON.stringify(out, null, 2));
  await fake.stop(); await base.$disconnect(); await other.$disconnect();
  process.exitCode = out.failedScenarios ? 1 : 0;
}
