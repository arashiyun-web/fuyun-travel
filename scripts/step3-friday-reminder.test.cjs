const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
process.env.CRON_SECRET = 'synthetic-friday-cron';
process.env.OPERATIONS_CRON_TOKEN = 'synthetic-friday-worker';
let reminder, route;
try { reminder = load('lib/operations/fridayReminder.ts'); route = load('app/api/ops/friday-highlights-reminder/route.ts'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const config = { FRIDAY_TELEGRAM_REMIND_ENABLED: 'true', TELEGRAM_BOT_TOKEN: 'fixture-bot-token', TELEGRAM_BOSS_CHAT_ID: '123456789' }; // synthetic private fixture, never a real identity
let calls;
beforeEach(() => {
  for (const k of Object.keys(config)) delete process.env[k];
  calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
});
const request = (bearer, method = 'GET') => new Request('http://localhost/api/ops/friday-highlights-reminder', { method, headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
test('friday cron rejects unauthorized requests before any delivery', async () => {
  assert.ok(route, 'reminder route must exist');
  Object.assign(process.env, config);
  for (const bearer of [undefined,'wrong']) assert.equal((await route.GET(request(bearer))).status, 401);
  assert.equal(calls.length, 0);
});
test('disabled exactTrue variants skip successfully with complete synthetic channels', async () => {
  assert.ok(route, 'reminder route must exist');
  for (const flag of [undefined,'false','TRUE','1','yes',' true ','true ']) {
    Object.assign(process.env, config);
    if (flag === undefined) delete process.env.FRIDAY_TELEGRAM_REMIND_ENABLED; else process.env.FRIDAY_TELEGRAM_REMIND_ENABLED = flag;
    const r = await route.GET(request('synthetic-friday-cron'));
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { sent: false, reason: 'disabled' });
  }
  assert.equal(calls.length, 0);
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
  assert.equal(calls.length, 0);
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
