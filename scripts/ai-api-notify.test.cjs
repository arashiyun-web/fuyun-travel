const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { load, mock } = require('./test-support/step2-load-ts.cjs');

const staff = ['1', '2', '3'].map(digit => 'U' + digit.repeat(32));
const copy = value => structuredClone(value);
let row, pushes, changes, push;
function matches(where) {
  if (where.id !== row.id) return false;
  if ('notificationClaim' in where && where.notificationClaim !== row.notificationClaim) return false;
  return !where.OR || where.OR.some(condition => condition.notificationClaim === null
    ? row.notificationClaim === null
    : row.notificationClaimExpiresAt !== null && row.notificationClaimExpiresAt <= condition.notificationClaimExpiresAt.lte);
}
mock('@/lib/prisma', { prisma: { aiBooking: {
  findUnique: async ({ where }) => where.id === row.id ? copy(row) : null,
  updateMany: async ({ where, data }) => {
    if (!matches(where)) return { count: 0 };
    Object.assign(row, copy(data)); changes.push(copy(data)); return { count: 1 };
  },
} } });
mock('@/lib/lineApi', { pushLineText: async (to, text, options) => {
  // A crash after this boundary must leave a recoverable, identical retry payload.
  assert.ok(row.notificationDeliveries?.some(delivery => delivery.recipient === to && delivery.text === text && delivery.retryKey === options.retryKey));
  pushes.push({ to, text, ...options }); return push(to);
} });
const { notifyBooking, lineAdminRecipients, bookingNotificationText, bookingNotificationRetryKey } = load('lib/aiApi/notify.ts');
const noDelay = { sleep: async () => {} };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  row = { id: 'booking-1', bookingNumber: 'FY-TEST-20991201-ABCD', contactName: '離線旅客', phone: '0912345678',
    date: '2099-12-04', endDate: null, time: '09:00', pickup: '台北車站', destination: '九份', passengerCount: 12,
    vehicle: '中巴', notificationRetryKey: 'ec500ad8-61ef-4d3b-97d4-986127d522e5', notificationDeliveries: null,
    notificationStatus: 'pending', notificationAttempts: 0, notificationLastError: null,
    notificationClaim: null, notificationClaimExpiresAt: null };
  pushes = []; changes = []; push = async () => ({ result: 'accepted' });
  delete process.env.LINE_ADMIN_USER_ID; delete process.env.ADMIN_LINE_USER_ID;
});
afterEach(() => { delete process.env.LINE_ADMIN_USER_ID; delete process.env.ADMIN_LINE_USER_ID; });

test('staff parsing filters C/R and invalid IDs, deduplicates case-insensitively and caps at two', () => {
  const lower = 'U' + 'a'.repeat(32), upper = 'U' + 'A'.repeat(32);
  assert.deepEqual(lineAdminRecipients(`C${'4'.repeat(32)},${lower},${upper},R${'5'.repeat(32)},bad,${staff[1]},${staff[2]}`), [lower, staff[1]]);
  assert.deepEqual(lineAdminRecipients(' ', staff[1]), [staff[1]]);
  assert.deepEqual(lineAdminRecipients('Ushort', staff[1]), []);
});

test('notification summary includes required trip data and masks all but the phone suffix', () => {
  row.endDate = '2099-12-05'; row.contactName = '離線\n旅客';
  const text = bookingNotificationText(row);
  for (const value of [row.bookingNumber, row.date, row.endDate, '09:00', '台北車站 → 九份', '12', '中巴', '離線 旅客', '678', '/admin/ai-bookings/booking-1']) assert.ok(text.includes(value), value);
  assert.equal(text.includes(row.phone), false);
});

test('no valid individual recipient persists a visible failure and makes no push', async () => {
  process.env.LINE_ADMIN_USER_ID = 'C' + '4'.repeat(32);
  const result = await notifyBooking(row.id, noDelay);
  assert.deepEqual(result, { notificationStatus: 'failed', notificationAttempts: 0 });
  assert.match(row.notificationLastError, /通知未送達/); assert.deepEqual(pushes, []);
  assert.equal(row.notificationClaim, null);
});

test('each new booking reaches at most two individuals once with per-person UUIDv5 keys', async () => {
  process.env.LINE_ADMIN_USER_ID = `${staff[0]},${staff[0]},C${'4'.repeat(32)},${staff[1]},${staff[2]}`;
  assert.equal((await notifyBooking(row.id, noDelay)).notificationStatus, 'sent');
  assert.deepEqual(pushes.map(call => call.to), staff.slice(0, 2));
  assert.equal(row.notificationAttempts, 2); assert.equal(row.notificationLastError, null);
  for (const call of pushes) {
    assert.match(call.retryKey, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.equal(call.timeoutMs, 1500);
  }
  assert.notEqual(pushes[0].retryKey, pushes[1].retryKey);
  await notifyBooking(row.id, noDelay);
  assert.equal(pushes.length, 2, 'sent recipients are skipped on manual retry');
});

test('failure makes three bounded attempts with stable payload/key and safe persisted error', async () => {
  process.env.ADMIN_LINE_USER_ID = staff[0];
  push = async () => { throw new Error('fixture-private-upstream'); };
  const delays = [];
  const result = await notifyBooking(row.id, { sleep: async ms => delays.push(ms) });
  assert.equal(result.notificationStatus, 'failed'); assert.equal(result.notificationAttempts, 3);
  assert.equal(pushes.length, 3); assert.deepEqual(delays, [100, 300]);
  assert.equal(new Set(pushes.map(call => call.text)).size, 1);
  assert.equal(new Set(pushes.map(call => call.retryKey)).size, 1);
  assert.equal(row.notificationDeliveries[0].status, 'failed');
  assert.match(row.notificationLastError, /通知未送達/);
  assert.equal(JSON.stringify(changes).includes('fixture-private'), false);
});

test('manual retry keeps the original recipients, exact text and key after config or row changes', async () => {
  process.env.LINE_ADMIN_USER_ID = staff.slice(0, 2).join(',');
  push = async to => { if (to === staff[1]) throw new Error('fixture failure'); };
  await notifyBooking(row.id, noDelay);
  const original = pushes.find(call => call.to === staff[1]);
  process.env.LINE_ADMIN_USER_ID = staff[2]; row.contactName = '已修改'; row.pickup = '已修改';
  push = async () => ({ result: 'accepted' });
  await notifyBooking(row.id, noDelay);
  assert.deepEqual(pushes.filter(call => call.to === staff[1]).at(-1), original);
  assert.equal(pushes.filter(call => call.to === staff[0]).length, 1);
  assert.equal(pushes.some(call => call.to === staff[2]), false);
  assert.equal(row.notificationAttempts, 5); assert.equal(row.notificationStatus, 'sent');
});

test('invalid saved deliveries fail closed and cannot send to groups or more than two recipients', async () => {
  process.env.LINE_ADMIN_USER_ID = staff[0];
  const delivery = recipient => ({ recipient, text: 'saved fixture', retryKey: bookingNotificationRetryKey(row.notificationRetryKey, recipient), status: 'pending', attempts: 0 });
  for (const saved of [[delivery('C' + '4'.repeat(32))], staff.map(delivery), [delivery(staff[0]), delivery(staff[0])], [{ ...delivery(staff[0]), attempts: -1 }]]) {
    row.notificationDeliveries = saved;
    assert.equal((await notifyBooking(row.id, noDelay)).notificationStatus, 'failed');
    assert.deepEqual(pushes, []);
  }
});

test('missing booking cannot acquire a lease or push', async () => {
  assert.equal(await notifyBooking('missing', noDelay), null); assert.deepEqual(pushes, []);
});

test('concurrent notifier and manual retry share one lease and never duplicate pushes', async () => {
  process.env.LINE_ADMIN_USER_ID = staff[0];
  const entered = deferred(), release = deferred();
  push = async () => { entered.resolve(); await release.promise; throw new Error('fixture timeout'); };
  const initial = notifyBooking(row.id, noDelay);
  await entered.promise;
  const concurrent = await notifyBooking(row.id, noDelay);
  const count = pushes.length;
  release.resolve(); await initial;
  assert.equal(count, 1); assert.equal(concurrent.notificationStatus, 'pending');
  assert.equal(row.notificationStatus, 'failed'); assert.equal(row.notificationClaim, null);
  push = async () => ({ result: 'accepted' });
  await notifyBooking(row.id, noDelay); assert.equal(pushes.length, 4);
});

test('a stale worker cannot persist or release a replacement owner claim', async () => {
  process.env.LINE_ADMIN_USER_ID = staff[0];
  const entered = deferred(), release = deferred();
  push = async () => { entered.resolve(); await release.promise; throw new Error('fixture timeout'); };
  const initial = notifyBooking(row.id, noDelay);
  await entered.promise;
  row.notificationClaim = 'replacement'; row.notificationClaimExpiresAt = new Date(Date.now() + 60000);
  row.notificationStatus = 'sent'; row.notificationDeliveries[0].status = 'sent';
  release.resolve(); await assert.rejects(initial, /lease/i);
  assert.equal(row.notificationStatus, 'sent'); assert.equal(row.notificationClaim, 'replacement');
});

test('an expired lease is recoverable with the same deterministic recipient key', async () => {
  process.env.LINE_ADMIN_USER_ID = staff[0];
  row.notificationClaim = 'abandoned'; row.notificationClaimExpiresAt = new Date(Date.now() - 1);
  assert.equal((await notifyBooking(row.id, noDelay)).notificationStatus, 'sent');
  assert.equal(pushes[0].retryKey, bookingNotificationRetryKey(row.notificationRetryKey, staff[0]));
  assert.equal(row.notificationClaim, null);
});
