import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MockLanguageModelV4, convertArrayToReadableStream } from 'ai/test';
import { fixture, trip, booking, now, feature, load } from './fixtures.mjs';
const require = createRequire(import.meta.url);
const { mock } = require('../test-support/step2-load-ts.cjs');
let notificationRow;
let pushCount = 0;
mock('@/lib/prisma', { prisma: { aiBooking: {
  findUnique: async () => structuredClone(notificationRow),
  updateMany: async ({ where, data }) => {
    if (where.notificationClaim && where.notificationClaim !== notificationRow.notificationClaim) return { count: 0 };
    Object.assign(notificationRow, structuredClone(data)); return { count: 1 };
  },
} } });
mock('@/lib/lineApi', { pushLineText: async () => { pushCount++; throw Error('External delivery is forbidden in offline tests'); } });
function stream(toolName, input, text = '') {
  return { stream: convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] }, { type: 'response-metadata', modelId: 'gpt-4o-mini-offline-snapshot' },
    ...(toolName ? [{ type: 'tool-call', toolCallId: 'acceptance', toolName, input: JSON.stringify(input) }] : []),
    ...(text ? [{ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: text }, { type: 'text-end', id: 't' }] : []),
    { type: 'finish', usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } }, finishReason: { unified: toolName ? 'tool-calls' : 'stop' } },
  ]) };
}
async function result(POST, locale, messages) {
  const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ id: 'acceptance-' + locale, locale, messages }) }));
  assert.equal(response.status, 200);
  return (await response.text()).split('\n').filter(x => x.startsWith('data: ') && x !== 'data: [DONE]').map(x => JSON.parse(x.slice(6)));
}
const user = text => ({ id: 'u', role: 'user', parts: [{ type: 'text', text }] });
for (const locale of ['zh-CN', 'en']) test('acceptance ' + (locale === 'zh-CN' ? '(a) simplified Chinese quote and full disclaimer' : '(b) English 4 passengers/6 luggage upgrades to van with full disclaimer'), async () => {
  const f = await fixture();
  try {
    const { QUOTE_NOTICES } = load('lib/chat/systemPrompt.ts');
    const input = locale === 'en' ? { ...trip, passenger_count: 4, vehicle: 'van' } : trip;
    const text = locale === 'en' ? 'With 4 passengers and 6 suitcases, I recommend a nine-seat van. ' : '参考范围报价如下。';
    const model = new MockLanguageModelV4({ doStream: [stream('get_quote', input), stream(null, null, text + QUOTE_NOTICES[locale])] });
    const { createChatHandler } = feature('lib/chat/handler.ts');
    const POST = createChatHandler({ modelName: () => 'offline-configured-model', apiKey: () => 'offline', model: () => model, aiApi: f.api, store: f.store, notify: async () => {}, now: () => now });
    const events = await result(POST, locale, [user(locale === 'en' ? 'Quote Taipei to Jiufen on 2099-12-04, 4 adults and 6 suitcases.' : '请问2099-12-04台北到九份，6人4件行李多少钱？')]);
    const card = events.find(e => e.type === 'tool-output-available').output;
    assert.equal(card.notice, QUOTE_NOTICES[locale]);
    assert.match(card.quote.vehicle, /九人座/);
    assert.ok(events.some(e => e.type === 'text-delta' && e.delta.includes(QUOTE_NOTICES[locale])));
    const rows = (await f.pg.query("SELECT source,prompt_version,model_id,outcome FROM ai_tool_events WHERE source='web_chat'")).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].model_id, 'gpt-4o-mini-offline-snapshot');
    assert.equal(rows[0].outcome, 'ok');
  } finally { await f.pg.close(); }
});
test('acceptance (c) real notifier without recipients marks undelivered; test request is retained and rejected', async () => {
  const f = await fixture();
  try {
    const created = await f.store.createBooking('e'.repeat(64), 'notification-acceptance', booking, now, f.quote);
    notificationRow = { id: created.booking.id, bookingNumber: created.booking.booking_number, date: booking.trip.date, endDate: null,
      time: booking.time, pickup: booking.trip.pickup, destination: booking.trip.destination, passengerCount: booking.trip.passenger_count,
      vehicle: booking.trip.vehicle, contactName: booking.contact_name, phone: null, notificationClaim: null, notificationClaimExpiresAt: null,
      notificationStatus: 'pending', notificationAttempts: 0, notificationRetryKey: 'ec500ad8-61ef-4d3b-97d4-986127d522e5', notificationDeliveries: null };
    const { notifyBooking } = load('lib/aiApi/notify.ts');
    const delivery = await notifyBooking(created.booking.id, { sleep: async () => {} });
    assert.equal(delivery.notificationStatus, 'failed'); assert.match(notificationRow.notificationLastError, /通知未送達/);
    assert.equal(pushCount, 0);
    await f.pg.query("UPDATE ai_bookings SET notification_status='failed', notification_last_error='通知未送達',status='rejected' WHERE id=$1", [created.booking.id]);
    const row = (await f.pg.query('SELECT status,is_test,notification_status FROM ai_bookings WHERE id=$1', [created.booking.id])).rows[0];
    assert.deepEqual(row, { status: 'rejected', is_test: true, notification_status: 'failed' });
  } finally { await f.pg.close(); }
});
