const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
let row;
let order;
const tx = {
  $queryRaw: async () => [{ id: row.id }],
  charterQuote: {
    findUnique: async () => structuredClone(row),
    update: async ({ data }) => (row = { ...row, ...structuredClone(data) }),
    updateMany: async ({ data }) => { row = { ...row, ...data }; return { count: 1 }; },
  },
  charterOrder: {
    findUnique: async () => order,
    create: async ({ data }) => (order = { id: 'order-fixture', ...structuredClone(data) }),
  },
};
mock('@/lib/prisma', { prisma: { ...tx, $transaction: async (fn) => fn(tx) } });
let loggedIn = true;
mock('@/lib/adminQuoteAuth', {
  verifyAdminMutation: () => loggedIn,
  verifyAdminRequest: () => loggedIn,
  unauthorized: () => Response.json({ success: false }, { status: 401 }),
});
const { buildFleetQuoteDraft } = load('lib/fleetQuoteDraft.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');
const readRoute = load('app/api/admin/quotes/[id]/route.ts');
const { convertConfirmedQuote, readOrderForQuote } = load('lib/charterOrder.ts');
const base = { pickup: '台北車站', destination: '九份', vehicleHint: '賓士', passengerCount: 6 };
const post = (body) => draftRoute.POST(new Request('http://localhost/api/admin/quotes/q/draft', { method: 'POST', body: JSON.stringify(body) }), { params: { id: 'q' } });
const reset = () => { loggedIn = true; order = null; row = { id: 'q', lineUserId: 'mock-user', ...base, recommendedVehicle: '賓士', remark: '', quoteOptions: { unrelated: 'preserve' } }; };

test('F2: negated hours and airport multi-stop text never authorize catalog fare', () => {
  for (const input of [
    { ...base, remark: '不是 10 小時' },
    { ...base, destination: '台北市區再去機場', remark: '先到市區再去機場、不是 10 小時' },
    { ...base, remark: '10小時但不去九份' },
    { ...base, hours: 10, remark: '先去市區再去機場' },
  ]) assert.equal(buildFleetQuoteDraft(input).amountTwd, null);
});
test('F2: staff-selected single-route ten hours retains correct fare', () => {
  assert.equal(buildFleetQuoteDraft({ ...base, rateId: 'taipei-jiufen-10h', hours: 10 }).amountTwd, 7000);
  for (const hours of [null, 0, -10, 10.5, '10', NaN, Infinity]) {
    assert.equal(buildFleetQuoteDraft({ ...base, rateId: 'taipei-jiufen-10h', hours, remark: '10小時' }).amountTwd, null);
  }
  assert.equal(buildFleetQuoteDraft({ ...base, rateId: 'unknown', hours: 10 }).amountTwd, null);
});
test('F3: draft → API reread → convert uses persisted inputs and ignores edited prose', async () => {
  reset();
  const response = await post({ rateId: 'taipei-jiufen-10h', hours: 10 });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).amountTwd, 7000);
  assert.equal(row.quoteOptions.unrelated, 'preserve');
  assert.equal(row.quoteOptions.fleetFare.hours, 10);
  assert.equal(row.quoteOptions.fleetFare.rateId, 'taipei-jiufen-10h');
  const reread = await readRoute.GET(new Request('http://localhost/api/admin/quotes/q'), { params: { id: 'q' } });
  assert.equal((await reread.json()).quote.quoteOptions.fleetFare.hours, 10);
  row.quoteDraftText = 'edited text says 1 元';
  const saved = await post({});
  assert.equal((await saved.json()).amountTwd, 7000);
  const converted = await convertConfirmedQuote('q');
  assert.equal(converted.ok, true);
  assert.equal(converted.order.baseAmountTwd, 7000);
  assert.equal((await readOrderForQuote('q')).stale, false);
  await post({ hours: 9 });
  assert.equal((await readOrderForQuote('q')).stale, true);
  assert.equal((await convertConfirmedQuote('q')).status, 409);
});
test('F3: changed itinerary invalidates selection; malformed overrides cannot reuse it', async () => {
  reset();
  await post({ rateId: 'taipei-jiufen-10h', hours: 10 });
  row.remark = '先去機場再去九份';
  assert.equal((await convertConfirmedQuote('q')).status, 409);
  assert.equal((await (await post({})).json()).amountTwd, null);
  for (const body of [{ hours: '10' }, { hours: 0 }, { hours: 1.5 }, { rateId: 'unknown', hours: 10 }, null, []]) {
    assert.equal((await post(body)).status, 400);
  }
});
test('F3: unauthorized staff draft never writes', async () => {
  reset(); loggedIn = false;
  assert.equal((await post({ rateId: 'taipei-jiufen-10h', hours: 10 })).status, 401);
  assert.equal(row.quoteOptions.fleetFare, undefined);
});
