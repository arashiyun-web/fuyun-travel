const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
process.env.CRON_SECRET = 'synthetic-friday-cron';
process.env.OPERATIONS_CRON_TOKEN = 'synthetic-friday-worker';
// All persistence is an in-memory mock; no route HTTP requests or external delivery.
let claims, dbCalls, failClaim, failRelease;
mock('@/lib/prisma', { prisma: {
  $executeRaw: async (strings, date) => {
    const sql = strings.join('?');
    dbCalls.push({ sql, date });
    if (sql.includes('INSERT')) {
      if (failClaim) throw new Error('private-db-error');
      assert.match(sql, /ON CONFLICT.*DO NOTHING/s);
      if (claims.has(date)) return 0;
      claims.add(date); return 1;
    }
    assert.match(sql, /DELETE FROM friday_reminder_sends/);
    if (failRelease) throw new Error('private-release-error');
    return claims.delete(date) ? 1 : 0;
  },
} });
let reminder, route;
try { reminder = load('lib/operations/fridayReminder.ts'); route = load('app/api/ops/friday-highlights-reminder/route.ts'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const config = { FRIDAY_TELEGRAM_REMIND_ENABLED: 'true', TELEGRAM_BOT_TOKEN: 'fixture-bot-token', TELEGRAM_BOSS_CHAT_ID: '123456789' }; // synthetic private fixture, never a real identity
let calls;
beforeEach(() => {
  for (const k of Object.keys(config)) delete process.env[k];
  calls = []; claims = new Set(); dbCalls = []; failClaim = failRelease = false;
  global.fetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
});
const request = (bearer, method = 'GET') => new Request('http://localhost/api/ops/friday-highlights-reminder', { method, headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
test('friday cron rejects unauthorized requests before any delivery', async () => {
  assert.ok(route, 'reminder route must exist');
  Object.assign(process.env, config);
  for (const bearer of [undefined,'wrong']) assert.equal((await route.GET(request(bearer))).status, 401);
  assert.equal(calls.length, 0); assert.equal(dbCalls.length, 0);
});
test('disabled exactTrue variants skip successfully with complete synthetic channels', async () => {
  assert.ok(route, 'reminder route must exist');
  for (const flag of [undefined,'false','TRUE','1','yes',' true ','true ']) {
    Object.assign(process.env, config);
    if (flag === undefined) delete process.env.FRIDAY_TELEGRAM_REMIND_ENABLED; else process.env.FRIDAY_TELEGRAM_REMIND_ENABLED = flag;
    const r = await route.GET(request('synthetic-friday-cron'));
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { sent: false, reason: 'disabled' });
  }
  assert.equal(calls.length, 0); assert.equal(dbCalls.length, 0);
});
test('enabled missing channels and nonprivate/list recipients skip without throwing or delivery', async () => {
  assert.ok(route, 'reminder route must exist');
  for (const missing of ['TELEGRAM_BOT_TOKEN','TELEGRAM_BOSS_CHAT_ID']) {
    Object.assign(process.env, config); delete process.env[missing];
    const r = await route.GET(request('synthetic-friday-cron'));
    assert.equal(r.status, 200); assert.equal((await r.json()).sent, false);
  }
  for (const id of ['-100123456','0','123,456','123 456','@channel','1e10','123\n456']) {
    Object.assign(process.env, config, { TELEGRAM_BOSS_CHAT_ID: id });
    const r = await route.GET(request('synthetic-friday-cron'));
    assert.equal(r.status, 200); assert.equal((await r.json()).reason, 'invalid_private_recipient');
  }
  assert.equal(calls.length, 0); assert.equal(dbCalls.length, 0);
});
test('enabled worker sends once to configured synthetic private recipient with fixed reminder text only', async () => {
  assert.ok(route, 'reminder route must exist');
  Object.assign(process.env, config);
  const r = await route.POST(request('synthetic-friday-worker','POST'));
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { sent: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/botfixture-bot-token/sendMessage');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { chat_id: '123456789', text: '該整理小羽旅遊趣新貼文、送待審' });
  assert.ok(calls[0].init.signal);
});
test('Telegram transport, non-2xx and ok:false errors return sanitized failures for cron visibility', async () => {
  assert.ok(route, 'reminder route must exist');
  Object.assign(process.env, config);
  for (const sender of [async () => { throw new Error('private-bot-error'); }, async () => new Response('private-bot-error',{status:500}), async () => new Response(JSON.stringify({ok:false,description:'private-bot-error'})), async () => new Response('not-json')]) {
    global.fetch = sender;
    const r = await route.GET(request('synthetic-friday-cron'));
    assert.equal(r.status, 502); assert.deepEqual(await r.json(), { sent: false, reason: 'delivery_failed' });
  }
});
test('cron configuration retains both previous jobs and adds Friday 09:00 Taipei only', () => {
  const crons = JSON.parse(require('node:fs').readFileSync('vercel.json','utf8')).crons;
  assert.deepEqual(crons, [
    {path:'/api/operations/process-due',schedule:'0 6 * * 2,4'},
    {path:'/api/content-sync/weekly-pull',schedule:'0 4 * * *'},
    {path:'/api/ops/friday-highlights-reminder',schedule:'0 1 * * 5'},
  ]);
});

test('two authorized invocations on one Taipei day send once and return HTTP 200 already_sent', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T17:00:00Z') });
  Object.assign(process.env, config);
  const first = await route.GET(request('synthetic-friday-cron'));
  const second = await route.POST(request('synthetic-friday-worker', 'POST'));
  assert.equal(first.status, 200); assert.deepEqual(await first.json(), { sent: true });
  assert.equal(second.status, 200); assert.deepEqual(await second.json(), { sent: false, reason: 'already_sent' });
  assert.equal(calls.length, 1); assert.deepEqual([...claims], ['2026-11-13']);
});
test('concurrent authorized invocations acquire one date atomically before delivery', async () => {
  Object.assign(process.env, config);
  const responses = await Promise.all(Array.from({ length: 8 }, () => route.GET(request('synthetic-friday-cron'))));
  const results = await Promise.all(responses.map((r) => { assert.equal(r.status, 200); return r.json(); }));
  assert.equal(results.filter((r) => r.sent).length, 1);
  assert.equal(results.filter((r) => r.reason === 'already_sent').length, 7);
  assert.equal(calls.length, 1); assert.equal(claims.size, 1);
});
test('UTC midnight stays on the same Taipei date, while Taipei midnight allows a new send', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T23:59:00Z') });
  Object.assign(process.env, config);
  assert.deepEqual(await (await route.GET(request('synthetic-friday-cron'))).json(), { sent: true });
  assert.deepEqual([...claims], ['2026-11-13']); // UTC is still Nov 12
  t.mock.timers.setTime(new Date('2026-11-13T00:01:00Z').getTime());
  assert.deepEqual(await (await route.GET(request('synthetic-friday-cron'))).json(), { sent: false, reason: 'already_sent' });
  t.mock.timers.setTime(new Date('2026-11-13T16:00:00Z').getTime());
  assert.deepEqual(await (await route.GET(request('synthetic-friday-cron'))).json(), { sent: true });
  assert.deepEqual([...claims], ['2026-11-13', '2026-11-14']); // UTC still Nov 13
  assert.equal(calls.length, 2);
});
test('all Telegram failure forms release the claimed date and allow same-day retry', async () => {
  Object.assign(process.env, config);
  for (const sender of [
    async () => { throw new Error('private-transport-error'); },
    async () => new Response('private-body', { status: 500 }),
    async () => Response.json({ ok: false }),
    async () => new Response('not-json'),
  ]) {
    global.fetch = sender;
    const failed = await route.GET(request('synthetic-friday-cron'));
    assert.equal(failed.status, 502); assert.deepEqual(await failed.json(), { sent: false, reason: 'delivery_failed' });
    assert.equal(claims.size, 0);
  }
  global.fetch = async () => { calls.push('retry'); return Response.json({ ok: true }); };
  assert.deepEqual(await (await route.GET(request('synthetic-friday-cron'))).json(), { sent: true });
  assert.equal(calls.length, 1); assert.equal(claims.size, 1);
});
test('database claim failure does not deliver or release an unowned date, and returns sanitized 502', async () => {
  Object.assign(process.env, config); failClaim = true;
  const r = await route.GET(request('synthetic-friday-cron'));
  assert.equal(r.status, 502); assert.deepEqual(await r.json(), { sent: false, reason: 'delivery_failed' });
  assert.equal(calls.length, 0); assert.equal(dbCalls.length, 1); assert.equal(claims.size, 0);
});
test('release failure stays sanitized and keeps the date claimed to fail closed', async () => {
  Object.assign(process.env, config); failRelease = true;
  global.fetch = async () => { calls.push('failed'); throw new Error('private-delivery-error'); };
  const r = await route.GET(request('synthetic-friday-cron'));
  assert.equal(r.status, 502); assert.deepEqual(await r.json(), { sent: false, reason: 'delivery_failed' });
  assert.deepEqual(await (await route.GET(request('synthetic-friday-cron'))).json(), { sent: false, reason: 'already_sent' });
  assert.equal(calls.length, 1); assert.equal(claims.size, 1);
});
