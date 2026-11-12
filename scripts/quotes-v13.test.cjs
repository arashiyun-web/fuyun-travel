// v13: X-Line-Retry-Key, LINE push outcomes and timeout, PATCH vehicle guard (pure parts and page source).
// Network: only the fake LINE server on 127.0.0.1 (scripts/test-support/fake-line-server.cjs). The route-level
// proof on a local PostgreSQL is scripts/test-support/quotes-v13-send-db-proof.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
const { createFakeLine, UUID } = require('./test-support/fake-line-server.cjs');

mock('@/lib/prisma', { prisma: {} });
const { uuidV5, quoteSendRetryKey, QUOTE_SEND_NAMESPACE, UUID_PATTERN } = load('lib/lineRetryKey.ts');
const line = load('lib/lineApi.ts');
const writes = load('lib/quoteOrderWrites.ts');
const guard = load('lib/quoteDraftGuard.ts');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('UUIDv5 matches RFC 9562 / Python uuid5 vectors; the quote key is a version-5 UUID', () => {
  assert.equal(uuidV5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '886313e1-3b8a-5372-9b90-0c9aee199e5d');
  assert.equal(uuidV5('abc', QUOTE_SEND_NAMESPACE), '3c285c5f-c6c7-51d5-b232-102d5b3fae53');
  const key = quoteSendRetryKey('q1', 'U1', '您好，報價 NT$7,000');
  assert.match(key, UUID_PATTERN); assert.match(key, UUID); assert.equal(key[14], '5');
});

test('S02 key is deterministic per quote + recipient + exact pushed text', () => {
  const k = quoteSendRetryKey('q1', 'U1', 'A');
  assert.equal(quoteSendRetryKey('q1', 'U1', 'A'), k);
  assert.notEqual(quoteSendRetryKey('q1', 'U1', 'A '), k, 'any text change → new key');
  assert.notEqual(quoteSendRetryKey('q1', 'U2', 'A'), k, 'recipient change → new key');
  assert.notEqual(quoteSendRetryKey('q2', 'U1', 'A'), k, 'other quote → new key');
  const long = 'x'.repeat(4500);
  assert.equal(quoteSendRetryKey('q1', 'U1', long + 'tail'), quoteSendRetryKey('q1', 'U1', long), 'hash of what LINE receives (4,500 chars)');
});

test('timeout budget: fetch ≤ 8 s, below the 20 s transaction with a 3 s margin', () => {
  assert.equal(writes.PUSH_TIMEOUT_MS, 8000);
  assert.equal(writes.SEND_TX.timeout, 20000);
  assert.ok(writes.PUSH_TIMEOUT_MS + writes.PUSH_TX_MARGIN_MS < writes.SEND_TX.timeout);
  assert.equal(writes.SEND_UNCERTAIN_ERROR, guard.SEND_UNCERTAIN_HINT);
  assert.match(guard.SEND_UNCERTAIN_HINT, /可能已送達，請先確認 LINE 再重送/);
});

test('pushLineText with a retry key: accepted, duplicate (409 + x-line-accepted-request-id), 4xx/429/5xx/409-without-header/reset/timeout', async () => {
  const fake = await createFakeLine().start(); const restore = fake.install();
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'offline-fake-token';
  try {
    const key = quoteSendRetryKey('q1', 'U1', 'hello');
    const first = await line.pushLineText('U1', 'hello', { retryKey: key, timeoutMs: 2000 });
    assert.equal(first.result, 'accepted'); assert.ok(first.requestId);
    assert.equal(fake.requests[0].key, key); assert.equal(fake.requests[0].auth, 'Bearer offline-fake-token');
    const again = await line.pushLineText('U1', 'hello', { retryKey: key, timeoutMs: 2000 });
    assert.equal(again.result, 'duplicate'); assert.equal(again.acceptedRequestId, first.requestId);
    assert.equal(fake.deliveries.length, 1, 'same key → delivered once');
    const kind = async (p, k = quoteSendRetryKey('q', 'U', String(Math.random())), ms = 2000) => { fake.plan(p); try { await line.pushLineText('U', 'x', { retryKey: k, timeoutMs: ms }); return 'ok'; } catch (e) { assert.ok(e instanceof line.LinePushError, String(e)); return `${e.kind}:${e.status}`; } };
    assert.equal(await kind({ status: 400 }), 'rejected:400');
    assert.equal(await kind({ status: 401 }), 'rejected:401');
    assert.equal(await kind({ status: 403 }), 'rejected:403');
    assert.equal(await kind({ status: 429 }), 'rate_limited:429');
    assert.equal(await kind({ status: 500 }), 'uncertain:500');
    assert.equal(await kind({ status: 503 }), 'uncertain:503');
    assert.equal(await kind({ noAcceptedHeader: true }, key), 'uncertain:409', '409 without x-line-accepted-request-id is not proof of delivery');
    assert.equal(await kind({ destroy: true }), 'uncertain:null');
    const t0 = Date.now();
    assert.equal(await kind({ delayMs: 3000 }, undefined, 500), 'uncertain:null');
    assert.ok(Date.now() - t0 < 2500, 'aborted by the fetch timeout');
    assert.equal(fake.deliveries.length, 2, 'the delayed one was delivered (LINE accepted it), the rejected ones not');
    assert.deepEqual(fake.state.violations, []);
  } finally { restore(); await fake.stop(); delete process.env.LINE_CHANNEL_ACCESS_TOKEN; }
});

test('S28 pushLineText without options is unchanged: no retry key, no timeout, any non-2xx throws a plain Error', async () => {
  const fake = await createFakeLine().start(); const restore = fake.install();
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'offline-fake-token';
  try {
    assert.equal(await line.pushLineText('U9', 'staff note'), undefined);
    assert.equal(fake.requests[0].key, null);
    fake.plan({ status: 500 });
    await assert.rejects(() => line.pushLineText('U9', 'n'), (e) => !(e instanceof line.LinePushError) && /^LINE Push API failed: 500 /.test(e.message));
  } finally { restore(); await fake.stop(); delete process.env.LINE_CHANNEL_ACCESS_TOKEN; }
  // Only the send route passes options; every other caller (webhook, staff notifications) is untouched.
  const callers = ['app', 'lib'].flatMap(function walk(dir) { return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []); })
    .filter((f) => /pushLineText\(/.test(read(f)) && f !== path.join('lib', 'lineApi.ts'));
  for (const f of callers) {
    const withKey = /pushLineText\([^)]*retryKey/.test(read(f).replace(/\n/g, ' '));
    assert.equal(withKey, f === path.join('app', 'api', 'admin', 'quotes', '[id]', 'send', 'route.ts'), f);
  }
  assert.ok(callers.includes(path.join('app', 'api', 'admin', 'quotes', '[id]', 'send', 'route.ts')));
  assert.doesNotMatch(read('lib/lineApi.ts').split('export async function replyLineText')[1].split('\n}\n')[0], /Retry-Key|signal/);
});

test('S24/S25 vehicleChangeBlock: rows with an order or in the order flow keep their recommended vehicle', () => {
  const E = guard.ORDER_VEHICLE_ERROR;
  for (const status of ['new', 'DRAFT', 'HANDOFF', 'SENT', 'CONFIRMED', 'ARCHIVED', 'ORDER_PENDING', 'STAFF_PRICED']) {
    for (const hasOrder of [false, true]) {
      const locked = hasOrder || status === 'ORDER_PENDING' || status === 'STAFF_PRICED';
      assert.equal(guard.vehicleChangeBlock({ quoteStatus: status, recommendedVehicle: '九人座' }, '中巴', hasOrder), locked ? E : null, `${status}/${hasOrder}`);
      assert.equal(guard.vehicleChangeBlock({ quoteStatus: status, recommendedVehicle: '九人座' }, ' 九人座 ', hasOrder), null, 'same vehicle (as stored) is fine');
    }
  }
  assert.equal(guard.vehicleChangeBlock({ quoteStatus: 'ORDER_PENDING', recommendedVehicle: null }, '', false), null, 'null and "" are the same');
  assert.equal(guard.vehicleChangeBlock({ quoteStatus: 'ORDER_PENDING', recommendedVehicle: null }, '中巴', false), E);
  assert.equal(guard.vehicleChangeBlock({ quoteStatus: 'ORDER_PENDING', recommendedVehicle: '中巴' }, '', false), E, 'clearing it is a change');
});

test('S29 detail page: send button disabled while sending, uncertain hint, alreadyDelivered message, vehicle read-only with an order', () => {
  const page = read('app/admin/quotes/[id]/page.tsx');
  assert.ok(page.includes('const [sendBusy, setSendBusy] = useState(false);'));
  assert.ok(page.includes('if (sendBusy) return;'));
  assert.ok(page.includes('disabled={quote.quoteStatus === "ARCHIVED" || sendBusy}'));
  assert.ok(page.includes('} catch {\n        throw new Error(SEND_UNCERTAIN_HINT);\n      }'), 'no answer / unreadable answer → hint');
  assert.ok(page.includes('if (data.code === "LINE_UNCERTAIN") throw new Error(data.error || SEND_UNCERTAIN_HINT);'));
  assert.ok(page.includes('if (response.status >= 500 && !data.code) throw new Error(SEND_UNCERTAIN_HINT);'));
  assert.ok(page.includes('data.alreadyDelivered ?'));
  assert.ok(page.includes('const vehicleLocked = orderLocked(quote.quoteStatus, orderUnknownOrPresent);'));
  assert.ok(page.includes('readOnly={vehicleLocked}'));
  assert.ok(page.includes('setSendBusy(false);'));
});
