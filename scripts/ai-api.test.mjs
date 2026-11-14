// Real public/MCP boundaries and production SQL on an isolated, in-memory PostgreSQL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
const { load, mock } = require('./test-support/step2-load-ts.cjs');
const root = process.cwd();
let activeService;
mock('@/lib/aiApi/runtime', { aiApi: new Proxy({}, { get: (_, key) => activeService[key].bind(activeService) }) });
const token = 'fyk_' + 'a'.repeat(43); // synthetic fixture, never a real key
const trip = { pickup: '台北車站', destination: '台北市區一日', date: '2099-12-04', passenger_count: 30, vehicle: '大巴' };
const booking = { ...trip, contact_name: '離線測試', phone: '0912345678', time: '09:00' };
const request = (body, auth = token, extra = {}) => new Request('http://localhost/api/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...extra }, body: JSON.stringify(body)
});
async function fixture(name = 'TEST-offline') {
  assert.ok(existsSync(root + '/lib/aiApi/service.ts'), 'shared AI service must be implemented');
  const { AiApiService } = load('lib/aiApi/service.ts');
  const { createAiStore } = load('lib/aiApi/store.ts');
  const pg = new PGlite();
  await pg.exec(readFileSync(root + '/prisma/migrations/202611130001_ai_api/migration.sql', 'utf8'));
  if (existsSync(root + '/prisma/migrations/202611140001_ai_confirm_flow/migration.sql')) await pg.exec(readFileSync(root + '/prisma/migrations/202611140001_ai_confirm_flow/migration.sql', 'utf8'));
  let statements = 0;
  const adapter = (client) => ({ query: async (sql, values = []) => { statements++; return (await client.query(sql, values)).rows; },
    transaction: (fn) => client.transaction(tx => fn(adapter(tx))) });
  let now = new Date('2099-12-01T00:00:00Z');
  await pg.query('INSERT INTO api_keys (id,key_hash,key_prefix,name) VALUES ($1,$2,$3,$4)', ['key-1', createHash('sha256').update(token).digest('hex'), 'fyk_aaaa', name]);
  const database = adapter(pg);
  const store = createAiStore(database);
  let notices = 0;
  const service = new AiApiService(store, async () => { notices++; }, () => now);
  activeService = service;
  const routes = ['quote', 'availability', 'bookings'].map(p => load(`app/api/public/v1/${p}/route.ts`));
  const mcp = load('app/api/mcp/route.ts');
  return { pg, service, store, database, routes, mcp, notices: () => notices, statements: () => statements, time: value => { now = new Date(value); } };
}

for (const [index, name] of ['get_quote', 'check_availability', 'create_booking'].entries()) {
  test(`${name}: real public API rejects absent/invalid/disabled keys and returns 200/400/429`, async () => {
    const f = await fixture();
    try {
      const route = f.routes[index]; const body = index === 2 ? booking : trip;
      assert.equal((await route.POST(request(body, null))).status, 401);
      assert.equal((await route.POST(request(body, 'fyk_' + 'b'.repeat(43)))).status, 401);
      const ok = await route.POST(request(body)); assert.equal(ok.status, 200);
      const value = await ok.json();
      if (index === 0) { assert.equal(value.low, 9500); assert.equal(value.high, 11000); assert.equal(value.requires_human_confirmation, true); }
      if (index === 1) assert.equal(value.status, 'pending_human_confirmation');
      if (index === 2) { assert.match(value.booking_number, /^FY-TEST-20991201-[A-Z0-9]{4}$/); assert.equal(value.status, 'pending'); }
      for (const invalid of [{ passenger_count: 0 }, { passenger_count: 61 }, { date: '2000-01-01' }, { date: '2099-02-30' }, ...(index === 2 ? [{ phone: 'abc' }] : [])]) {
        const res = await route.POST(request({ ...body, ...invalid })); assert.equal(res.status, 400);
        assert.ok((await res.json()).issues.some(issue => issue.path.length > 0));
      }
      await f.pg.query("UPDATE api_keys SET disabled_at=now() WHERE id='key-1'");
      assert.equal((await route.POST(request(body))).status, 401);
      await f.pg.query("UPDATE api_keys SET disabled_at=NULL WHERE id='key-1'");
      await f.pg.query("UPDATE api_rate_counters SET count=30 WHERE scope='minute'");
      const limited = await route.POST(request(body)); assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('Retry-After')) > 0);
    } finally { await f.pg.close(); }
  });
  test(`${name}: official stateless MCP handles 401/200/400/429 and exposes shared results`, async () => {
    const f = await fixture();
    const call = (args, auth = token) => f.mcp.POST(request({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, auth, { Accept: 'application/json, text/event-stream' }));
    try {
      const body = index === 2 ? booking : trip;
      assert.equal((await call(body, null)).status, 401);
      const ok = await call(body); assert.equal(ok.status, 200);
      const value = await ok.json(); assert.equal(value.result.isError ?? false, false);
      const result = JSON.parse(value.result.content[0].text);
      if (index === 0) assert.equal(result.low, 9500);
      if (index === 1) assert.equal(result.status, 'pending_human_confirmation');
      if (index === 2) assert.equal(result.status, 'pending');
      assert.equal((await call({ ...body, passenger_count: 0 })).status, 400);
      assert.equal((await call({ ...body, date: '1990-01-01' })).status, 400);
      await f.pg.query("UPDATE api_rate_counters SET count=30 WHERE scope='minute'");
      const limited = await call(body); assert.equal(limited.status, 429); assert.ok(limited.headers.get('Retry-After'));
    } finally { await f.pg.close(); }
  });
}

test('idempotency serializes concurrent replay, expires after 24h, counts only new bookings per hour', async () => {
  const f = await fixture();
  try {
    const send = () => f.routes[2].POST(request(booking, token, { 'Idempotency-Key': 'fixture-idempotency' }));
    const values = await Promise.all(Array.from({ length: 5 }, async () => (await send()).json()));
    assert.equal(new Set(values.map(v => v.booking_number)).size, 1);
    assert.equal(values.filter(v => v.replay).length, 4); assert.equal(f.notices(), 1);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM ai_bookings')).rows[0].n, 1);
    f.time('2099-12-02T00:00:00Z');
    const fresh = await (await send()).json(); assert.equal(fresh.replay, false); assert.notEqual(fresh.booking_number, values[0].booking_number);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM ai_bookings')).rows[0].n, 2);
    await f.pg.query("UPDATE api_rate_counters SET count=20 WHERE scope='booking_hour'");
    const limit = await f.routes[2].POST(request(booking)); assert.equal(limit.status, 429);
    assert.equal((await send()).status, 200, 'replay needs no new booking-hour quota');
  } finally { await f.pg.close(); }
});

test('two independent service instances share minute/day limits and Taipei day rollover', async () => {
  const f = await fixture();
  try {
    const { AiApiService } = load('lib/aiApi/service.ts');
    const { createAiStore } = load('lib/aiApi/store.ts');
    const another = new AiApiService(createAiStore(f.database), async () => {}, () => new Date('2099-12-01T00:00:00Z'));
    await f.service.authorize(request(trip));
    await another.authorize(request(trip));
    assert.equal((await f.pg.query("SELECT count FROM api_rate_counters WHERE scope='minute'")).rows[0].count, 2);
    await f.pg.query("UPDATE api_rate_counters SET count=1000 WHERE scope='day'");
    await assert.rejects(() => another.authorize(request(trip)), e => e.status === 429 && e.retryAfter === 57600);
    f.time('2099-12-01T16:00:00Z');
    assert.ok(await f.service.authorize(request(trip)), 'Taipei midnight opens a new daily bucket');
  } finally { await f.pg.close(); }
});

test('quote parity executes the real admin rangeLines path and list estimate with the admin parameter mapping', async () => {
  const f = await fixture();
  try {
    // /admin/quotes/page.tsx EstimateText calls quoteEstimate(source).
    // quoteEstimate -> rangeSummary -> customerRange maps tripDate/passengerCount/pickup/
    // destination/remark/recommendedVehicle using yearBaseOf(source.createdAt).
    // The existing draft route calls rangeDraftText -> rangeLines -> rangeFor -> customerRange.
    // Neither path is mocked or rewritten for this comparison.
    const { quoteEstimate } = load('lib/quotePrefill.ts');
    const { rangeLines, rangeDraftText, parseTripType, parseLuggage } = load('lib/quoteConversation.ts');
    const { yearBaseOf, dayTypeOf } = load('lib/quoteRange.ts');
    const cases = [
      { label: 'weekday', input: trip, low: 9500, high: 11000, day: 'weekday', vehicle: '大巴' },
      { label: 'Saturday', input: { ...trip, date: '2099-12-05' }, low: 10500, high: 12000, day: 'holiday', vehicle: '大巴' },
      { label: 'short range touching weekend', input: { ...trip, end_date: '2099-12-05' }, low: 10500, high: 12000, day: 'holiday', vehicle: '大巴' },
      { label: 'weekday-only range', input: { ...trip, date: '2099-12-07', end_date: '2099-12-09' }, low: 9500, high: 11000, day: 'weekday', vehicle: '大巴' },
      { label: 'midibus', input: { ...trip, passenger_count: 12, vehicle: '中巴' }, low: 9000, high: 11000, day: 'weekday', vehicle: '中巴' },
      { label: 'van alias', input: { ...trip, passenger_count: 6, vehicle: 'van', destination: '九份' }, low: 7000, high: 8500, day: 'weekday', vehicle: '九人座賓士' },
      { label: 'vehicle inferred by count', input: { ...trip, vehicle: undefined }, low: 9500, high: 11000, day: 'weekday', vehicle: '大巴' },
      { label: 'unknown route only', input: { ...trip, pickup: '未知出發地', destination: '未知目的地' }, low: null, high: null, day: 'weekday', vehicle: '大巴' },
    ];
    for (const item of cases) {
      const input = item.input;
      const aliases = { bus: '大巴', midibus: '中巴', van: '九人座' };
      const source = {
        tripDate: input.end_date ? `${input.date} ~ ${input.end_date}` : input.date,
        passengerCount: input.passenger_count, pickup: input.pickup, destination: input.destination,
        remark: input.notes || '', recommendedVehicle: aliases[input.vehicle] || input.vehicle,
        createdAt: new Date('2099-12-01T00:00:00Z'),
      };
      const base = yearBaseOf(source.createdAt);
      const fields = { date: source.tripDate, people: source.passengerCount, origin: source.pickup,
        destination: source.destination, note: source.remark, vehicle: source.recommendedVehicle,
        tripType: parseTripType(source.remark), luggage: parseLuggage(source.remark) };
      const admin = rangeLines(fields, base).range;
      const estimate = quoteEstimate(source);
      const draftText = rangeDraftText(fields, base);
      const response = await f.routes[0].POST(request(input));
      assert.equal(response.status, 200, item.label);
      const actual = await response.json();
      assert.deepEqual([actual.low, actual.high, actual.day_type, actual.vehicle],
        [item.low, item.high, item.day, item.vehicle], item.label + ': literal fixture');
      assert.deepEqual([actual.low, actual.high, actual.day_type, actual.vehicle],
        [admin.low, admin.high, dayTypeOf(source.tripDate, base).dayType, admin.vehicleLabel], item.label + ': actual admin range path');
      assert.equal(actual.price_available, admin.low !== null && admin.high !== null, item.label);
      if (admin.low !== null) {
        const pair = `${admin.low.toLocaleString('en-US')}～${admin.high.toLocaleString('en-US')}`;
        assert.ok(estimate.summary.includes(pair), item.label + ': /admin/quotes list estimate');
        assert.ok(draftText.includes(pair), item.label + ': admin draft range');
      } else assert.match(estimate.summary, /待專人報價/);
      assert.equal(actual.driver_fee.included, false);
    }
  } finally { await f.pg.close(); }
});

test('unrecognized vehicle preference alone gets no API price; existing admin still infers by count', async () => {
  const f = await fixture();
  try {
    const { rangeLines } = load('lib/quoteConversation.ts');
    const input = { ...trip, vehicle: '未知車型' };
    const admin = rangeLines({ date: input.date, people: input.passenger_count,
      origin: input.pickup, destination: input.destination, vehicle: input.vehicle }, new Date('2099-12-01T00:00:00Z')).range;
    const response = await f.routes[0].POST(request(input));
    assert.equal(response.status, 200);
    const actual = await response.json();
    assert.deepEqual([actual.low, actual.high, actual.price_available], [null, null, false]);
    assert.match(actual.pricing_note, /將由專人報價/);
    // This is a documented contract difference, not a parity pass hidden by an unknown route.
    assert.deepEqual([admin.low, admin.high, admin.vehicleLabel], [9500, 11000, '大巴']);
  } finally { await f.pg.close(); }
});

test('unsupported long ranges use existing dayTypeOf without inventing a holiday band', async () => {
  const f = await fixture();
  try {
    const { dayTypeOf } = load('lib/quoteRange.ts');
    const input = { ...trip, end_date: '2099-12-25' };
    const date = `${input.date} ~ ${input.end_date}`;
    const response = await f.routes[0].POST(request(input));
    const actual = await response.json();
    assert.equal(response.status, 200); assert.equal(actual.price_available, false);
    assert.equal(dayTypeOf(date, new Date('2099-12-01T00:00:00Z')).dayType, 'weekday');
    assert.equal(actual.day_type, 'weekday');
  } finally { await f.pg.close(); }
});

test('notification failure preserves a new booking and marks failed; plain key has normal number', async () => {
  const f = await fixture('partner');
  try {
    const { AiApiService } = load('lib/aiApi/service.ts');
    const service = new AiApiService(f.store, async () => { throw new Error('private upstream detail'); }, () => new Date('2099-12-01T00:00:00Z'));
    const identity = await service.authorize(request(booking));
    const value = await service.execute('create_booking', booking, identity, null);
    assert.match(value.booking_number, /^FY-20991201-[A-Z0-9]{4}$/);
    const row = (await f.pg.query('SELECT notification_status,is_test,notification_last_error FROM ai_bookings')).rows[0];
    assert.equal(row.notification_status, 'failed'); assert.equal(row.is_test, false);
    assert.doesNotMatch(row.notification_last_error, /private/);
  } finally { await f.pg.close(); }
});

test('MCP initializes and lists exactly four tools; GET/DELETE still require a key', async () => {
  const f = await fixture();
  try {
    for (const method of ['GET', 'DELETE']) assert.equal((await f.mcp[method](new Request('http://localhost/api/mcp', { method }))).status, 401);
    for (const method of ['initialize', 'tools/list']) {
      const response = await f.mcp.POST(request({ jsonrpc: '2.0', id: 5, method, ...(method === 'initialize' ? { params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'offline', version: '1' } } } : {}) }, token, { Accept: 'application/json, text/event-stream' }));
      assert.equal(response.status, 200); const body = await response.json();
      if (method === 'tools/list') { assert.deepEqual(body.result.tools.map(t => t.name).sort(), ['check_availability', 'create_booking', 'get_booking_status', 'get_quote']); assert.equal(body.result.tools.find(t=>t.name==='get_booking_status').annotations.readOnlyHint,true); }
      else assert.equal(body.result.serverInfo.name, 'fuyun-travel');
    }
    for(const method of ['GET','DELETE']) assert.equal((await f.mcp[method](new Request('http://localhost/api/mcp',{method,headers:{Authorization:'Bearer '+token}}))).status,405);
    assert.equal((await f.pg.query("SELECT count(*)::int n FROM ai_api_audit_logs WHERE http_status=503")).rows[0].n,0,'unsupported HTTP methods must not be audited as a service failure');
  } finally { await f.pg.close(); }
});

test('range dates and unknown vehicle preferences preserve human confirmation; quote errors identify fields', async () => {
  const f = await fixture();
  try {
    const quote = async body => { const res = await f.routes[0].POST(request(body)); return [res.status, await res.json()]; };
    const [status, unknown] = await quote({ ...trip, vehicle: '未知車型' });
    assert.equal(status, 200); assert.equal(unknown.price_available, false); assert.equal(unknown.low, null);
    const [, mixed] = await quote({ ...trip, end_date: '2099-12-05' });
    assert.equal(mixed.day_type, 'holiday'); assert.equal(mixed.low, 10500); assert.equal(mixed.high, 12000);
    assert.equal(mixed.driver_fee.amount, null, 'mixed dates must not imply the holiday fee applies every day');
    const [invalidStatus, invalid] = await quote({ ...trip, end_date: '2099-12-03' });
    assert.equal(invalidStatus, 400); assert.deepEqual(invalid.issues[0].path, ['end_date']);
    const [, long] = await quote({ ...trip, end_date: '2099-12-25' });
    assert.equal(long.price_available, false, 'unsupported long quote ranges need staff pricing');
    assert.equal((await f.routes[1].POST(request({ ...trip, end_date: '2099-12-25' }))).status, 200);
    const invalidJson = new Request('http://localhost/api/public/v1/quote', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{' });
    assert.equal((await f.routes[0].POST(invalidJson)).status, 400);
  } finally { await f.pg.close(); }
});

test('MCP booking replay uses the same HTTP idempotency header and enforces the booking-hour limit', async () => {
  const f = await fixture();
  try {
    const call = key => f.mcp.POST(request({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'create_booking', arguments: booking } }, token, { Accept: 'application/json, text/event-stream', ...(key ? { 'Idempotency-Key': key } : {}) }));
    const first = await (await call('mcp-idempotency')).json();
    const replay = await (await call('mcp-idempotency')).json();
    assert.equal(JSON.parse(replay.result.content[0].text).replay, true);
    assert.equal(JSON.parse(first.result.content[0].text).booking_number, JSON.parse(replay.result.content[0].text).booking_number);
    assert.equal(f.notices(), 1);
    await f.pg.query("UPDATE api_rate_counters SET count=20 WHERE scope='booking_hour'");
    const limited = await call(); assert.equal(limited.status, 429); assert.ok(limited.headers.get('Retry-After'));
    await f.pg.query("UPDATE api_keys SET disabled_at=now() WHERE id='key-1'");
    assert.equal((await call()).status, 401);
  } finally { await f.pg.close(); }
});

test('official MCP client negotiates stateless transport, lists tools and calls the shared quote', async () => {
  const f = await fixture();
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'offline-acceptance-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    fetch: (url, init) => { const req = new Request(url, init); return f.mcp[req.method](req); },
  });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['check_availability', 'create_booking', 'get_booking_status', 'get_quote']);
    const result = await client.callTool({ name: 'get_quote', arguments: trip });
    const quote = JSON.parse(result.content[0].text); assert.equal(quote.low, 9500); assert.equal(quote.high, 11000);
    assert.equal(quote.requires_human_confirmation, true);
  } finally { await client.close(); await f.pg.close(); }
});

test('MCP accepts the addressed origin behind the Next reverse proxy and rejects hostile origins', async () => {
  const f = await fixture();
  try {
    const call = origin => f.mcp.POST(new Request('http://internal-next:3000/api/mcp', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
        Origin: origin, 'X-Forwarded-Host': 'fuyuntravel.com', 'X-Forwarded-Proto': 'https', Host: 'fuyuntravel.com' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }));
    assert.equal((await call('https://fuyuntravel.com')).status, 200);
    assert.equal((await call('https://hostile.example')).status, 403);
  } finally { await f.pg.close(); }
});

test('PostgreSQL-incompatible NUL input returns field-specific 400 for REST and MCP without creating a booking', async () => {
  const f = await fixture();
  try {
    const res = await f.routes[2].POST(request({ ...booking, contact_name: '旅客\u0000姓名' }));
    assert.equal(res.status, 400); assert.deepEqual((await res.json()).issues[0].path, ['contact_name']);
    const quote = await (await f.routes[0].POST(request(trip))).json();
    quote.note = '參考\u0000價格';
    const nested = await f.mcp.POST(request({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_booking', arguments: { ...booking, quote_range: quote } } }, token, { Accept: 'application/json, text/event-stream' }));
    assert.equal(nested.status, 400); assert.deepEqual((await nested.json()).issues[0].path, ['quote_range', 'note']);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM ai_bookings')).rows[0].n, 0);
  } finally { await f.pg.close(); }
});

test('fallback notification failure cannot overwrite sent status or an active notification lease', async () => {
  const f = await fixture();
  try {
    await f.routes[2].POST(request(booking));
    const row = (await f.pg.query('SELECT id FROM ai_bookings')).rows[0];
    await f.pg.query("UPDATE ai_bookings SET notification_status='sent' WHERE id=$1", [row.id]);
    await f.store.notificationFailed(row.id);
    assert.equal((await f.pg.query('SELECT notification_status FROM ai_bookings')).rows[0].notification_status, 'sent');
    await f.pg.query("UPDATE ai_bookings SET notification_status='pending',notification_claim='active-worker',notification_claim_expires_at=CURRENT_TIMESTAMP+INTERVAL '30 seconds' WHERE id=$1", [row.id]);
    await f.store.notificationFailed(row.id);
    assert.equal((await f.pg.query('SELECT notification_status FROM ai_bookings')).rows[0].notification_status, 'pending');
  } finally { await f.pg.close(); }
});

test('a booking replay across Taipei midnight returns the existing order even when its trip date has passed', async () => {
  const f = await fixture();
  try {
    f.time('2099-12-01T15:59:00Z');
    const body = { ...booking, date: '2099-12-01', end_date: '2099-12-02' };
    const send = () => f.routes[2].POST(request(body, token, { 'Idempotency-Key': 'across-midnight' }));
    const first = await send(); assert.equal(first.status, 200); const created = await first.json();
    f.time('2099-12-01T16:01:00Z');
    const again = await send(); assert.equal(again.status, 200); const replay = await again.json();
    assert.equal(replay.replay, true); assert.equal(replay.booking_number, created.booking_number);
    const mcp = await f.mcp.POST(request({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_booking', arguments: body } }, token, { Accept: 'application/json, text/event-stream', 'Idempotency-Key': 'across-midnight' }));
    assert.equal(mcp.status, 200); assert.equal(JSON.parse((await mcp.json()).result.content[0].text).replay, true);
    assert.equal((await f.routes[2].POST(request(body, token, { 'Idempotency-Key': 'new-after-midnight' }))).status, 400, 'new requests must still reject past dates');
    assert.equal(f.notices(), 1);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM ai_bookings')).rows[0].n, 1);
  } finally { await f.pg.close(); }
});


test('query code is shown once, stored only as hash and hidden on replay', async () => {
  const f = await fixture();
  try {
    const send = () => f.routes[2].POST(request(booking, token, { 'Idempotency-Key': 'query-once' }));
    const first = await (await send()).json();
    assert.match(first.query_code, /^fyq_[A-Za-z0-9_-]{43}$/);
    assert.equal(first.query_code_note, '請妥善保存，僅此一次顯示；遺失可用單號＋電話末四碼查詢');
    const row = (await f.pg.query('SELECT * FROM ai_bookings')).rows[0];
    assert.equal(row.query_code_hash, createHash('sha256').update(first.query_code).digest('hex'));
    assert.equal(JSON.stringify(row).includes(first.query_code), false);
    const replay = await (await send()).json();
    assert.equal(replay.query_code, null); assert.equal(replay.query_code_note, first.query_code_note);
  } finally { await f.pg.close(); }
});

const statusKeys = ['booking_number','status','status_label','is_test','created_at','status_updated_at','trip','requires_human_confirmation','disclaimer','disclaimer_en'].sort();
const noMatch = { error: 'No matching booking for the supplied booking number and verification' };
function assertStatusOnly(value) {
  assert.deepEqual(Object.keys(value).sort(), statusKeys);
  assert.deepEqual(Object.keys(value.trip).sort(), ['date','end_date','time','passenger_count','vehicle'].sort());
  for (const field of ['contact_name','phone','email','pickup','destination','notes','quote_range','id','notification_status','query_code','query_code_hash','api_key_id']) {
    assert.equal(field in value, false, field); assert.equal(field in value.trip, false, field);
  }
  assert.equal(value.requires_human_confirmation, true);
}
function statusCalls(f) {
  assert.ok(existsSync(root + '/app/api/public/v1/bookings/status/route.ts'), 'status POST route exists');
  const route = load('app/api/public/v1/bookings/status/route.ts');
  return [
    async (body, auth = token) => route.POST(request(body, auth)),
    async (body, auth = token) => f.mcp.POST(request({ jsonrpc:'2.0',id:12,method:'tools/call',params:{name:'get_booking_status',arguments:body}}, auth, { Accept:'application/json, text/event-stream' })),
  ];
}
const statusValue = async (response, index) => { const body = await response.json(); return index ? JSON.parse(body.result.content[0].text) : body; };
test('REST and MCP status share strict verification and a non-PII whitelist for all four states', async () => {
  const f = await fixture();
  try {
    const created = await (await f.routes[2].POST(request(booking))).json();
    const calls = statusCalls(f);
    for (const [internal, publicStatus, label] of [['pending_review','pending','待專人確認'],['confirmed','confirmed_by_staff','專人已確認'],['rejected','rejected','已婉拒'],['cancelled','cancelled','已取消']]) {
      await f.pg.query('UPDATE ai_bookings SET status=$1,status_changed_at=$2 WHERE booking_number=$3', [internal,new Date('2099-12-01T01:00:00Z'),created.booking_number]);
      for (const [index, call] of calls.entries()) {
        const response = await call({ booking_number:created.booking_number,query_code:created.query_code }); assert.equal(response.status,200);
        const value = await statusValue(response,index); assertStatusOnly(value);
        assert.equal(value.status,publicStatus); assert.equal(value.status_label,label); assert.equal(value.status_updated_at,'2099-12-01T01:00:00.000Z');
        assert.equal(value.disclaimer.includes('車況與價格一律待專人確認'),true);
        assert.equal(value.disclaimer.includes('本接口不處理付款'),internal === 'confirmed');
      }
    }
    for(const [index,call] of calls.entries()) {
      const response=await call({booking_number:created.booking_number,phone_last4:'5678'});assert.equal(response.status,200);assertStatusOnly(await statusValue(response,index));
      assert.equal((await call({booking_number:created.booking_number,phone_last4:'5678'},null)).status,401);
      for(const verification of [{phone_last4:'123'},{phone_last4:'abcd'},{phone_last4:'5678',query_code:created.query_code},{phone_last4:'5678',status:'confirmed'}]) assert.equal((await call({booking_number:created.booking_number,...verification})).status,400);
    }
  } finally { await f.pg.close(); }
});
test('wrong code, unknown number, foreign key and wrong phone give identical 404 bodies in REST and MCP', async () => {
  const f=await fixture();
  try {
    const created=await (await f.routes[2].POST(request(booking))).json();
    const token2='fyk_'+'b'.repeat(43);
    await f.pg.query('INSERT INTO api_keys (id,key_hash,key_prefix,name) VALUES ($1,$2,$3,$4)',['key-2',createHash('sha256').update(token2).digest('hex'),'fyk_bbbb','TEST-other']);
    const queryCounts=[];
    for(const call of statusCalls(f)) {
      for(const [body,auth] of [
        [{booking_number:created.booking_number,query_code:'fyq_'+'x'.repeat(43)},token],
        [{booking_number:'FY-TEST-20991201-ZZZZ',query_code:created.query_code},token],
        [{booking_number:created.booking_number,query_code:created.query_code},token2],
        [{booking_number:created.booking_number,phone_last4:'0000'},token],
        [{booking_number:created.booking_number,query_code:'incorrect'},token],
        [{booking_number:'does-not-exist',query_code:created.query_code},token],
      ]) {const before=f.statements();const response=await call(body,auth);queryCounts.push(f.statements()-before);assert.equal(response.status,404);assert.deepEqual(await response.json(),noMatch);}
    }
    assert.equal(new Set(queryCounts).size,1,'all failed verifications use the same number of DB statements');
  } finally { await f.pg.close(); }
});
test('status failure quota persists across 404 transactions; 11th failure is 429 and success is not counted', async () => {
  const f=await fixture();
  try {
    const created=await (await f.routes[2].POST(request({...booking,phone:'+886 (912) 345-678'}))).json();
    const [rest,mcp]=statusCalls(f);
    const good={booking_number:created.booking_number,phone_last4:'5678'};
    assert.equal((await rest(good)).status,200);
    assert.equal((await f.pg.query("SELECT count(*)::int n FROM api_rate_counters WHERE scope='status_fail_hour'")).rows[0].n,0);
    for(let n=0;n<10;n++)assert.equal((await (n%2?mcp:rest)({...good,phone_last4:'0000'})).status,404);
    const limited=await rest({...good,phone_last4:'0000'});assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'3600');
    assert.equal((await mcp(good)).status,200,'correct verification does not consume failure quota');
    f.time('2099-12-01T01:00:00Z');assert.equal((await rest({...good,phone_last4:'0000'})).status,404);
  } finally {await f.pg.close();}
});
test('status minute quota is 20 across both channels and service instances, with minute reset', async () => {
  const f=await fixture();
  try {
    const created=await (await f.routes[2].POST(request(booking))).json();
    const calls=statusCalls(f);const body={booking_number:created.booking_number,query_code:created.query_code};
    for(let n=0;n<20;n++)assert.equal((await calls[n%2](body)).status,200);
    const response=await calls[0](body);assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');
    const {AiApiService}=load('lib/aiApi/service.ts');const {createAiStore}=load('lib/aiApi/store.ts');
    const another=new AiApiService(createAiStore(f.database),async()=>{},()=>new Date('2099-12-01T00:00:00Z'));
    await assert.rejects(()=>another.authorize(request(body),'get_booking_status'),error=>error.status===429);
    f.time('2099-12-01T00:01:00Z');assert.equal((await calls[1](body)).status,200);
  } finally {await f.pg.close();}
});
test('tool audit captures 401/400/404/429 and replay without recording any input, credentials or PII', async () => {
  const f=await fixture();
  try {
    const created=await (await f.routes[2].POST(request(booking,token,{'Idempotency-Key':'audit-replay'}))).json();
    await f.routes[2].POST(request(booking,token,{'Idempotency-Key':'audit-replay'}));
    const [rest,mcp]=statusCalls(f);const good={booking_number:created.booking_number,query_code:created.query_code};
    for(const call of [rest,mcp]) {
      await call(good,null);await call({...good,phone_last4:'5678'});await call({...good,query_code:'fyq_'+'z'.repeat(43)});
      await call(good);
    }
    await f.pg.query("UPDATE api_rate_counters SET count=20 WHERE scope='status_minute'");await rest(good);await mcp(good);
    const logs=(await f.pg.query("SELECT * FROM ai_api_audit_logs WHERE event_type='tool_call' ORDER BY created_at")).rows;
    assert.equal(logs.length,12);assert.ok(logs.some(l=>l.detail.replay === true));
    for(const channel of ['rest','mcp']) for(const status of [200,400,401,404,429]) assert.ok(logs.some(l=>l.channel===channel&&l.http_status===status),channel+status);
    assert.ok(logs.filter(l=>l.http_status===401).every(l=>l.api_key_id===null));
    const serialized=JSON.stringify(logs);
    for(const secret of [token,created.query_code,booking.phone,booking.contact_name,booking.pickup,booking.destination,'5678','audit-replay'])assert.equal(serialized.includes(secret),false,secret);
    assert.ok(logs.every(l=>l.duration_ms>=0&&typeof l.request_id==='string'));
    await f.pg.exec('DROP TABLE ai_api_audit_logs');
    assert.equal((await f.routes[0].POST(request(trip))).status,200,'audit failure must not fail API');
  } finally {await f.pg.close();}
});
test('external AI cannot inject confirmed status through create or status in either channel', async()=>{
  const f=await fixture();try {
    assert.equal((await f.routes[2].POST(request({...booking,status:'confirmed'}))).status,400);
    const created=await (await f.routes[2].POST(request(booking))).json();
    for(const call of statusCalls(f))assert.equal((await call({booking_number:created.booking_number,phone_last4:'5678',status:'confirmed'})).status,400);
    const response=await f.mcp.POST(request({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_booking',arguments:{...booking,status:'confirmed'}}},token,{Accept:'application/json, text/event-stream'}));assert.equal(response.status,400);
    assert.deepEqual((await f.pg.query('SELECT status FROM ai_bookings')).rows.map(r=>r.status),['pending_review']);
  } finally {await f.pg.close();}
});


test('incremental migration preserves existing bookings, adds safe constraints/FKs and rollback refuses cancelled data',async()=>{
  const pg=new PGlite();
  try {
    await pg.exec(readFileSync(root+'/prisma/migrations/202611130001_ai_api/migration.sql','utf8'));
    await pg.query('INSERT INTO api_keys(id,key_hash,key_prefix,name) VALUES ($1,$2,$3,$4)',['legacy-key','a'.repeat(64),'fyk_fixture','TEST-legacy']);
    await pg.exec("INSERT INTO ai_bookings(id,booking_number,api_key_id,contact_name,phone,date,time,pickup,destination,passenger_count,notification_retry_key) VALUES ('legacy','FY-TEST-20991201-AAAA','legacy-key','fixture','0912345678','2099-12-04','09:00','fixture','fixture',2,'fixture')");
    const before=(await pg.query('SELECT * FROM ai_bookings')).rows[0];
    await pg.exec(readFileSync(root+'/prisma/migrations/202611140001_ai_confirm_flow/migration.sql','utf8'));
    const after=(await pg.query('SELECT * FROM ai_bookings')).rows[0];
    for(const key of Object.keys(before))assert.deepEqual(after[key],before[key]);
    assert.equal(after.query_code_hash,null);assert.equal(after.status_changed_at,null);assert.equal(after.status_changed_by,null);
    await assert.rejects(()=>pg.exec("UPDATE ai_bookings SET query_code_hash='plaintext'"));
    await assert.rejects(()=>pg.exec("UPDATE ai_bookings SET status='paid'"));
    await pg.exec("INSERT INTO ai_api_audit_logs(id,event_type,channel,api_key_id,booking_id,outcome) VALUES ('audit','status_change','admin','legacy-key','legacy','success')");
    await assert.rejects(()=>pg.exec("DELETE FROM ai_bookings WHERE id='legacy'"));
    await assert.rejects(()=>pg.exec("UPDATE ai_api_audit_logs SET event_type='body'"));
    await pg.exec("UPDATE ai_bookings SET status='cancelled'");
    const rollback=readFileSync(root+'/prisma/migrations/202611140001_ai_confirm_flow/rollback.sql.txt','utf8');
    await assert.rejects(()=>pg.exec(rollback),/cancelled bookings/);await pg.exec('ROLLBACK');
    assert.equal((await pg.query('SELECT status FROM ai_bookings')).rows[0].status,'cancelled');
    await pg.exec("UPDATE ai_bookings SET status='pending_review'");await pg.exec(rollback);
    assert.equal((await pg.query('SELECT id,status FROM ai_bookings')).rows[0].id,'legacy');
    await assert.rejects(()=>pg.exec("UPDATE ai_bookings SET status='cancelled'"));
  } finally {await pg.close();}
});
test('legacy bookings without a query hash remain accessible through phone suffix only',async()=>{
  const f=await fixture();try{
    const created=await (await f.routes[2].POST(request(booking))).json();
    await f.pg.exec('UPDATE ai_bookings SET query_code_hash=NULL');
    const [rest]=statusCalls(f);
    const phone=await rest({booking_number:created.booking_number,phone_last4:'5678'});assert.equal(phone.status,200);const value=await phone.json();assert.equal(value.status_updated_at,value.created_at);
    for(const query_code of [created.query_code,'']) { const code=await rest({booking_number:created.booking_number,query_code});assert.equal(code.status,404);assert.deepEqual(await code.json(),noMatch); }
  }finally{await f.pg.close();}
});


test('a key revoked after authorization still yields a 401 audit with null api_key_id',async()=>{
  const f=await fixture();try{
    const create=f.store.createBooking.bind(f.store);
    f.store.createBooking=async(...args)=>{await f.pg.exec("UPDATE api_keys SET disabled_at=now() WHERE id='key-1'");return create(...args);};
    const response=await f.routes[2].POST(request(booking));assert.equal(response.status,401);
    const log=(await f.pg.query("SELECT api_key_id FROM ai_api_audit_logs WHERE http_status=401")).rows;
    assert.deepEqual(log,[{api_key_id:null}]);
  }finally{await f.pg.close();}
});


test('status minute quota also counts malformed authenticated REST and MCP attempts',async()=>{
  const f=await fixture();try{
    const calls=statusCalls(f);
    for(let n=0;n<20;n++) assert.equal((await calls[n%2]({phone_last4:'bad'})).status,400);
    const response=await calls[0]({phone_last4:'bad'});assert.equal(response.status,429);assert.equal(response.headers.get('Retry-After'),'60');
  }finally{await f.pg.close();}
});
