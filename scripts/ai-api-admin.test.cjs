const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { load, mock } = require('./test-support/step2-load-ts.cjs');

// Only authentication, persistence and LINE are replaced; route/view code is real.
let state;
const copy = value => structuredClone(value);
function record(action, args) {
  state.calls.push({ action, args: copy(args) });
  if (state.dbError) throw new Error('fixture-private-database-detail');
}
mock('@/lib/adminQuoteAuth', {
  verifyAdminRequest: () => state.read,
  verifyAdminMutation: () => state.mutate,
  unauthorized: () => Response.json({ success: false }, { status: 401 }),
});
const prismaFixture = {
  aiApiAuditLog: {
    create: async args => { record('audit.create',args); assert.equal(state.inTransaction,true); if(state.auditError)throw Error('audit failure');state.audits.push(copy(args.data));return args.data; },
    findMany: async args => {record('audit.list',args);return copy(state.audits.slice(-50).reverse());},
  },
  $transaction: async fn => { record('transaction.begin',{});const saved=copy(state.booking),logs=copy(state.audits);state.inTransaction=true;try { const value=await fn(prismaFixture);record('transaction.commit',{});return value;} catch(e){state.booking=saved;state.audits=logs;record('transaction.rollback',{});throw e;}finally{state.inTransaction=false;} },
  apiKey: {
    findMany: async args => { record('keys.list', args); return copy(state.keys); },
    findUnique: async args => { record('keys.get', args); return copy(state.keys.find(row => row.id === args.where.id) ?? null); },
    create: async args => {
      record('keys.create', args);
      const row = { id: 'new-key', ...args.data, createdAt: new Date(), disabledAt: null, lastUsedAt: null };
      state.keys.push(row); return copy(row);
    },
    update: async args => {
      record('keys.update', args);
      const row = state.keys.find(row => row.id === args.where.id);
      Object.assign(row, args.data); return copy(row);
    },
  },
  apiRateCounter: { findMany: async args => { record('counters.list', args); return copy(state.counters); } },
  aiBooking: {
    findMany: async args => { record('bookings.list', args); return [copy(state.booking)]; },
    findUnique: async args => { record('bookings.get', args); return args.where.id === state.booking.id ? copy(state.booking) : null; },
    updateMany: async args => {
      record('bookings.update', args);
      assert.equal(state.inTransaction,true);
      if(state.conflict || state.booking.id!==args.where.id || state.booking.status!==args.where.status)return {count:0};
      Object.assign(state.booking,args.data);return {count:1};
    },
  },
};
mock('@/lib/prisma', { prisma: prismaFixture });
mock('@/lib/aiApi/notify', { notifyStaffStatus: async row => {state.statusNotified.push(row.id);if(state.notifyError)throw Error('notify failure');}, notifyBooking: async id => {
  state.notified.push(id);
  if (state.notifyError) throw new Error('fixture-private-notification-detail');
  return state.notifyResult;
} });
const keys = load('app/api/admin/api-keys/route.ts');
const disable = load('app/api/admin/api-keys/[id]/disable/route.ts');
const list = load('app/api/admin/ai-bookings/route.ts');
const details = load('app/api/admin/ai-bookings/[id]/route.ts');
const retry = load('app/api/admin/ai-bookings/[id]/retry-notification/route.ts');
const params = id => ({ params: { id } });
const request = (method = 'GET', body) => new Request('http://localhost/api/admin/fixture', {
  method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
});
const operations = () => [
  () => keys.GET(request()), () => keys.POST(request('POST', { name: 'TEST-fixture' })),
  () => disable.POST(request('POST'), params('key-1')), () => list.GET(request()),
  () => details.GET(request(), params('booking-1')),
  () => details.PATCH(request('PATCH', { status: 'confirmed' }), params('booking-1')),
  () => retry.POST(request('POST'), params('booking-1')),
];
beforeEach(() => {
  state = { audits:[], statusNotified:[], inTransaction:false, read: true, mutate: true, calls: [], notified: [], dbError: false, notifyError: false,
    notifyResult: { notificationStatus: 'failed', notificationAttempts: 3 },
    keys: [{ id: 'key-1', name: 'TEST-fixture', keyHash: 'fixture-private-hash', keyPrefix: 'fyk_fixture',
      createdAt: new Date('2026-11-13T00:00:00Z'), disabledAt: null, lastUsedAt: null }],
    counters: [{ apiKeyId: 'key-1', scope: 'minute', count: 2 }, { apiKeyId: 'key-1', scope: 'day', count: 7 }],
    booking: { id: 'booking-1', bookingNumber: 'FY-TEST-20991201-ABCD', apiKeyId: 'key-1',
      contactName: '離線旅客', phone: '0912345678', email: null, date: '2099-12-04', endDate: null,
      time: '09:00', pickup: '台北車站', destination: '九份', passengerCount: 12, vehicle: '中巴',
      notes: null, quoteRange: null, status: 'pending_review', isTest: true,
      notificationStatus: 'failed', notificationAttempts: 3, notificationLastError: '通知未送達',
      notificationRetryKey: 'private-retry-namespace', notificationDeliveries: [{ recipient: 'private-recipient' }],
      idempotencyKey: 'private-idempotency', createdAt: new Date(), updatedAt: new Date() },
  };
});

test('anonymous admin calls stop before persistence, request parsing or LINE', async () => {
  state.read = false; state.mutate = false;
  for (const run of operations()) assert.equal((await run()).status, 401);
  assert.deepEqual(state.calls, []); assert.deepEqual(state.notified, []);
});

test('failed same-origin mutation verification blocks every admin write', async () => {
  state.mutate = false;
  for (const index of [1, 2, 5, 6]) assert.equal((await operations()[index]()).status, 401);
  assert.deepEqual(state.calls, []); assert.deepEqual(state.notified, []);
});

test('key creation returns one uncached plaintext and stores its complete SHA256 only', async () => {
  const response = await keys.POST(request('POST', { name: ' TEST-local ' }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.match(body.plaintextKey, /^fyk_[A-Za-z0-9_-]{43}$/);
  const saved = state.keys.at(-1);
  assert.equal(saved.name, 'TEST-local');
  assert.equal(saved.keyHash, createHash('sha256').update(body.plaintextKey).digest('hex'));
  assert.equal(saved.keyPrefix, body.plaintextKey.slice(0, 12));
  assert.equal(JSON.stringify(saved).includes(body.plaintextKey), false);
  assert.equal(body.key.keyHash, undefined);
  const listing = await keys.GET(request());
  assert.equal(listing.headers.get('cache-control'), 'no-store');
  const text = await listing.text();
  for (const hidden of [body.plaintextKey, saved.keyHash, 'fixture-private-hash']) assert.equal(text.includes(hidden), false);
});

test('usage is read from shared minute and Taipei-day counters with zero defaults', async () => {
  state.keys.push({ ...state.keys[0], id: 'unused' });
  const response = await keys.GET(request());
  const body = await response.json();
  assert.deepEqual(body.keys.map(row => row.usage), [{ minute: 2, day: 7 }, { minute: 0, day: 0 }]);
  const query = state.calls.find(call => call.action === 'counters.list').args;
  assert.deepEqual(query.where.apiKeyId.in, ['key-1', 'unused']);
  const minute = query.where.OR.find(row => row.scope === 'minute').windowStart;
  const day = query.where.OR.find(row => row.scope === 'day').windowStart;
  assert.equal(minute.getUTCSeconds(), 0); assert.equal(minute.getUTCMilliseconds(), 0);
  assert.equal(day.getUTCHours(), 16); assert.equal(day.getUTCMinutes(), 0);
  assert.ok(Date.now() - day.getTime() >= 0 && Date.now() - day.getTime() < 86400000);
});

test('an empty key registry remains empty and skips counter reads', async () => {
  state.keys = [];
  assert.deepEqual((await (await keys.GET(request())).json()).keys, []);
  assert.equal(state.calls.some(call => call.action === 'counters.list'), false);
});

test('invalid names and malformed JSON cannot create keys', async () => {
  for (const body of [null, [], {}, { name: '' }, { name: 'x'.repeat(101) }, { name: 'bad\u0000name' }, { name: 'bad\nname' }, { name: 'valid', keyHash: 'injected' }]) {
    assert.equal((await keys.POST(request('POST', body))).status, 400);
  }
  assert.equal((await keys.POST(new Request('http://localhost/api/admin/api-keys', { method: 'POST', body: '{' }))).status, 400);
  assert.equal(state.calls.some(call => call.action === 'keys.create'), false);
});

test('disable retains a key and its first disabled timestamp; missing key is 404', async () => {
  assert.equal((await disable.POST(request('POST'), params('key-1'))).status, 200);
  const first = state.keys[0].disabledAt.toISOString();
  assert.equal((await disable.POST(request('POST'), params('key-1'))).status, 200);
  assert.equal(state.keys.length, 1); assert.equal(state.keys[0].disabledAt.toISOString(), first);
  assert.equal(state.calls.filter(call => call.action === 'keys.update').length, 1);
  assert.equal((await disable.POST(request('POST'), params('missing'))).status, 404);
});

test('booking views expose review data while withholding key, idempotency and LINE internals', async () => {
  for (const response of [await list.GET(request()), await details.GET(request(), params('booking-1'))]) {
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); const row = body.booking ?? body.bookings[0];
    assert.equal(row.isTest, true); assert.equal(row.notificationStatus, 'failed'); assert.equal(row.contactName, '離線旅客');
    for (const field of ['apiKeyId', 'idempotencyKey', 'notificationRetryKey', 'notificationDeliveries']) assert.equal(field in row, false);
  }
  const query = state.calls.find(call => call.action === 'bookings.list').args;
  assert.equal(query.take, 100); assert.deepEqual(query.orderBy, { createdAt: 'desc' });
  assert.equal((await details.GET(request(), params('missing'))).status, 404);
});

test('review accepts only four staff statuses and preserves other booking fields', async () => {
  for (const body of [null, [], {}, { status: 'paid' }, { status: null }, { status: ['confirmed'] }, { status: 'confirmed', phone: 'injected' }]) {
    assert.equal((await details.PATCH(request('PATCH', body), params('booking-1'))).status, 400);
  }
  assert.equal(state.calls.some(call => call.action === 'bookings.update'), false);
  for (const status of ['pending_review', 'confirmed', 'rejected', 'cancelled']) {
    assert.equal((await details.PATCH(request('PATCH', { status }), params('booking-1'))).status, 200);
    assert.equal(state.booking.status, status);
  }
  for (const call of state.calls.filter(call => call.action === 'bookings.update')) assert.deepEqual(Object.keys(call.args.data).sort(), ['status','statusChangedAt','statusChangedBy'].sort());
  assert.equal(state.booking.phone, '0912345678'); assert.deepEqual(state.notified, []);
  assert.equal((await details.PATCH(request('PATCH', { status: 'rejected' }), params('missing'))).status, 404);
});

test('manual retry targets only the selected existing booking and returns its delivery state', async () => {
  const response = await retry.POST(request('POST'), params('booking-1'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notificationStatus, 'failed');
  assert.deepEqual(state.notified, ['booking-1']);
  assert.equal((await retry.POST(request('POST'), params('missing'))).status, 404);
  assert.deepEqual(state.notified, ['booking-1']);
});

test('every admin storage failure is uncached and excludes private exception details', async () => {
  state.dbError = true;
  for (const run of operations()) {
    const response = await run();
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.text()).includes('fixture-private'), false);
  }
});

test('retry failures are safe and a booking that disappears during retry returns 404', async () => {
  state.notifyError = true;
  const failed = await retry.POST(request('POST'), params('booking-1'));
  assert.equal(failed.status, 503); assert.equal(failed.headers.get('cache-control'), 'no-store');
  assert.equal((await failed.text()).includes('fixture-private'), false);
  state.notifyError = false; state.notifyResult = null;
  const missing = await retry.POST(request('POST'), params('booking-1'));
  assert.equal(missing.status, 404); assert.equal(missing.headers.get('cache-control'), 'no-store');
});


test('staff updates use a compare-and-swap and atomic audit, same state never rewrites', async()=>{
  const response=await details.PATCH(request('PATCH',{status:'confirmed'}),params('booking-1'));
  assert.equal(response.status,200);assert.equal(state.booking.statusChangedBy,'staff');assert.ok(state.booking.statusChangedAt instanceof Date);
  const update=state.calls.find(c=>c.action==='bookings.update');assert.deepEqual(update.args.where,{id:'booking-1',status:'pending_review'});
  assert.equal(state.audits.length,1);assert.deepEqual([state.audits[0].eventType,state.audits[0].fromStatus,state.audits[0].toStatus,state.audits[0].actor],['status_change','pending_review','confirmed','staff']);
  const first=state.booking.statusChangedAt.toISOString();
  assert.equal((await details.PATCH(request('PATCH',{status:'confirmed'}),params('booking-1'))).status,200);
  assert.equal(state.audits.length,1);assert.equal(state.booking.statusChangedAt.toISOString(),first);assert.equal(state.statusNotified.length,1);
});
test('staff losing an optimistic race gets 409, no audit and no notification',async()=>{
  state.conflict=true;
  assert.equal((await details.PATCH(request('PATCH',{status:'confirmed'}),params('booking-1'))).status,409);
  assert.equal(state.booking.status,'pending_review');assert.equal(state.audits.length,0);assert.equal(state.statusNotified.length,0);
});
test('staff audit failure rolls back status but post-commit notification failure cannot roll it back',async()=>{
  state.auditError=true;
  assert.equal((await details.PATCH(request('PATCH',{status:'confirmed'}),params('booking-1'))).status,503);assert.equal(state.booking.status,'pending_review');
  state.auditError=false;state.notifyError=true;
  assert.equal((await details.PATCH(request('PATCH',{status:'cancelled'}),params('booking-1'))).status,200);assert.equal(state.booking.status,'cancelled');assert.equal(state.audits.length,1);
});
test('audit endpoint requires admin read auth and returns only last 50 safe display fields',async()=>{
  const audit=load('app/api/admin/ai-bookings/[id]/audit/route.ts');
  state.read=false;assert.equal((await audit.GET(request(),params('booking-1'))).status,401);assert.equal(state.calls.length,0);
  state.read=true;state.audits=Array.from({length:60},(_,i)=>({createdAt:new Date(2000+i),eventType:'status_change',outcome:'success',fromStatus:'pending_review',toStatus:'confirmed',actor:'staff',detail:{secret:'hidden'},apiKeyId:'hidden',id:String(i)}));
  const response=await audit.GET(request(),params('booking-1'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const rows=(await response.json()).audits;assert.equal(rows.length,50);
  for(const row of rows)assert.deepEqual(Object.keys(row).sort(),['createdAt','eventType','outcome','fromStatus','toStatus','actor'].sort());
  assert.equal(state.calls.find(c=>c.action==='audit.list').args.take,50);
  assert.equal((await audit.GET(request(),params('missing'))).status,404);
});
