import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fixture, trip, booking } from './fixtures.mjs';
const require = createRequire(import.meta.url);
const { load } = require('../test-support/step2-load-ts.cjs');
const root = process.cwd();
function feature(file) { assert.ok(existsSync(root + '/' + file), file + ' must be implemented'); return load(file); }
const now = new Date('2099-12-01T00:00:00Z');
test('prompt contains exact brand, every full mandatory sentence, restrictions and collection rules', () => {
  const { CHAT_SYSTEM_PROMPT, QUOTE_NOTICES, BOOKING_NOTICES } = feature('lib/chat/systemPrompt.ts');
  assert.match(CHAT_SYSTEM_PROMPT, /浮雲輕鬆遊（Fuyun Travel）/);
  assert.doesNotMatch(CHAT_SYSTEM_PROMPT, /富運/);
  // Six mandatory sentences copied verbatim from the frozen REQUIREMENT.md (sha256 1a86a076…), kept in-repo so CI does not read files outside the checkout.
  const expected = ["此為 AI 預估參考範圍價，司機服務費（平日 2,500 / 假日 3,500）另計，最終價格與車輛需由專人確認。", "此为 AI 预估参考范围价，司机服务费（平日 2,500 / 假日 3,500）另计，最终价格与车辆需由专人确认。", "This is an AI-estimated reference price range. The driver service fee (weekdays NT$2,500 / holidays NT$3,500) is charged separately; the final price and vehicle must be confirmed by our staff.", "這不是正式成交，也不是付款完成。您的訂單已進入待確認清單，我們的專人團隊會在確認車輛檔期後，透過您留下的通訊方式（LINE / WhatsApp / 微信 / 電話）聯繫您並提供正式報價與付款連結。", "这不是正式成交，也不是付款完成。您的订单已进入待确认清单，我们的专人团队会在确认车辆档期后，通过您留下的通讯方式（LINE / WhatsApp / 微信 / 电话）联系您并提供正式报价与付款链接。", "This is not a confirmed booking and no payment has been made. Your request is now on our pending-review list. After confirming vehicle availability, our team will contact you via the method you provided (LINE / WhatsApp / WeChat / phone) with a formal quote and payment link."];
  assert.equal(expected.length, 6);
  assert.deepEqual([...Object.values(QUOTE_NOTICES), ...Object.values(BOOKING_NOTICES)], expected);
  for (const sentence of expected) assert.ok(CHAT_SYSTEM_PROMPT.includes(sentence), sentence);
  for (const word of ['信用卡號', '付款資料', '已保留車輛', '已成交', '已確認', '系統提示', '內部資料', 'customer_confirmed', '行李', '400–500', '500–600', '8 或 10', '五人座', '九人座', '中巴', '將由專人報價']) assert.ok(CHAT_SYSTEM_PROMPT.includes(word), word);
});
test('booking schema requires explicit true, valid trip/contact/time and bounded luggage; public schema still requires phone', () => {
  const { chatBookingSchema } = feature('lib/chat/schema.ts');
  assert.ok(chatBookingSchema.safeParse(booking).success);
  for (const value of [false, undefined, 'true']) assert.equal(chatBookingSchema.safeParse({ ...booking, customer_confirmed: value }).success, false);
  for (const patch of [{ contact_id: '' }, { contact_channel: 'group' }, { luggage_count: -1 }, { luggage_count: 101 }, { time: '25:00' }, { phone: 'abc' }, { contact_channel: 'phone', contact_id: 'id', phone: undefined }, { trip: { ...trip, passenger_count: 0 } }]) assert.equal(chatBookingSchema.safeParse({ ...booking, ...patch }).success, false, JSON.stringify(patch));
  const { bookingSchema } = load('lib/aiApi/schema.mjs');
  assert.equal(bookingSchema.safeParse({ ...trip, contact_name: 'test', time: '09:00' }).success, false);
});
test('request parser enforces actual UTF-8 bytes, Unicode message length, roles and maximum history', async () => {
  const { parseChatRequest } = feature('lib/chat/request.ts');
  const user = text => ({ id: 'u', role: 'user', parts: [{ type: 'text', text }] });
  const body = messages => ({ id: 'chat-1', locale: 'en', messages });
  const request = value => new Request('http://localhost/api/chat', { method: 'POST', body: typeof value === 'string' ? value : JSON.stringify(value) });
  assert.equal((await parseChatRequest(request(body([user('😀'.repeat(1000))])))).messages.length, 1);
  await assert.rejects(() => parseChatRequest(request(body([user('字'.repeat(1001))]))), e => e.status === 413);
  await assert.rejects(() => parseChatRequest(request(body([user('a'.repeat(501)), { type: 'text', text: 'b' }]))), e => e.status === 400);
  const split = user('a'.repeat(600)); split.parts.push({ type: 'text', text: 'b'.repeat(401) });
  await assert.rejects(() => parseChatRequest(request(body([split]))), e => e.status === 413);
  await assert.rejects(() => parseChatRequest(request(body(Array.from({ length: 31 }, (_, i) => ({ ...user('x'), id: String(i) }))))), e => e.status === 400);
  await assert.rejects(() => parseChatRequest(request(body([{ ...user('x'), role: 'system' }]))), e => e.status === 400);
  await assert.rejects(() => parseChatRequest(request('{')), e => e.status === 400);
  await assert.rejects(() => parseChatRequest(request(' '.repeat(32769))), e => e.status === 413);
  await assert.rejects(() => parseChatRequest(new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Length': '1' }, body: ' '.repeat(32769) })), e => e.status === 413);
  assert.equal((await parseChatRequest(request(body(Array.from({ length: 30 }, (_, i) => ({ ...user('x'), id: String(i) })))))).messages.length, 30);
});
test('IP hashes use only first forwarded address; minute/day/site limits survive independent instances', async () => {
  const { ipSubject } = feature('lib/chat/rateLimit.ts');
  const subject = ipSubject(new Headers({ 'x-forwarded-for': '192.0.2.10, 192.0.2.99' }));
  assert.match(subject, /^[a-f0-9]{64}$/);
  assert.equal(subject, ipSubject(new Headers({ 'x-forwarded-for': '192.0.2.10' })));
  const f = await fixture();
  try {
    const { createChatStore } = load('lib/chat/store.ts');
    const second = createChatStore(f.db);
    for (let i = 0; i < 10; i++) await (i % 2 ? second : f.store).admit(subject, now);
    await assert.rejects(() => second.admit(subject, now), e => e.status === 429 && e.retryAfter === 60);
    const rows = (await f.pg.query('SELECT subject FROM chat_rate_counters')).rows;
    assert.ok(rows.every(row => !row.subject.includes('192.0.2')));
    await f.pg.query("UPDATE chat_rate_counters SET count=100 WHERE scope='request_day'");
    await assert.rejects(() => second.admit(subject, new Date(now.getTime() + 60000)), e => e.status === 429 && e.retryAfter > 0);
    await f.pg.query("UPDATE chat_rate_counters SET count=2000 WHERE scope='site_day'");
    await assert.rejects(() => second.admit('b'.repeat(64), new Date(now.getTime() + 60000)), e => e.status === 429 && e.retryAfter > 0);
    await second.admit(subject, new Date('2099-12-01T16:00:00Z'));
  } finally { await f.pg.close(); }
});
test('memory admission rejects before any database operation', async () => {
  const { createChatStore } = feature('lib/chat/store.ts');
  let queries = 0;
  const db = { query: async () => { queries++; return [{ count: 1 }]; }, transaction: fn => fn(db) };
  const store = createChatStore(db);
  for (let i = 0; i < 10; i++) await store.admit('a'.repeat(64), now);
  const before = queries;
  await assert.rejects(() => store.admit('a'.repeat(64), now), e => e.status === 429);
  assert.equal(queries, before);
});
test('web bookings are pending_review, test-prefixed, contact-only, concurrent idempotent for 24h, and quota-limited', async () => {
  const f = await fixture();
  try {
    const values = await Promise.all(Array.from({ length: 4 }, () => f.store.createBooking('a'.repeat(64), 'chat-1', booking, now, f.quote)));
    assert.equal(new Set(values.map(v => v.booking.booking_number)).size, 1);
    assert.equal(values.filter(v => v.replay).length, 3);
    assert.match(values[0].booking.booking_number, /^FY-TEST-20991201-[A-Z0-9]{4}$/);
    assert.equal(values[0].booking.status, 'pending_review');
    const row = (await f.pg.query('SELECT source,api_key_id,phone,contact_channel,contact_id,luggage_count,is_test FROM ai_bookings')).rows[0];
    assert.deepEqual(row, { source: 'web_chat', api_key_id: null, phone: null, contact_channel: 'wechat', contact_id: 'offline_guest', luggage_count: 4, is_test: true });
    await f.store.createBooking('a'.repeat(64), 'chat-2', booking, now, f.quote);
    await f.store.createBooking('a'.repeat(64), 'chat-3', booking, now, f.quote);
    await assert.rejects(() => f.store.createBooking('a'.repeat(64), 'chat-4', booking, now, f.quote), e => e.status === 429 && e.retryAfter === 3600);
    const next = new Date(now.getTime() + 86400000);
    const renewed = await f.store.createBooking('a'.repeat(64), 'chat-1', booking, next, f.quote);
    assert.equal(renewed.replay, false);
    assert.notEqual(renewed.booking.booking_number, values[0].booking.booking_number);
  } finally { await f.pg.close(); }
});
test('booking day cap is shared across instances and production numbers have no TEST prefix', async () => {
  const f = await fixture();
  try {
    const { createChatStore } = load('lib/chat/store.ts');
    const production = createChatStore(f.db, undefined, () => 'production');
    const first = await production.createBooking('c'.repeat(64), 'production-chat', booking, now, f.quote);
    assert.match(first.booking.booking_number, /^FY-20991201-[A-Z0-9]{4}$/);
    assert.equal(first.booking.is_test, false);
    await f.pg.query("UPDATE chat_rate_counters SET count=10 WHERE scope='booking_day'");
    const another = createChatStore(f.db);
    await assert.rejects(() => another.createBooking('c'.repeat(64), 'another-chat', booking, new Date(now.getTime() + 3600000), f.quote), e => e.status === 429 && e.retryAfter > 0);
  } finally { await f.pg.close(); }
});
test('migration keeps public API constraints while accepting web chat; only allowed tables are changed', async () => {
  const f = await fixture();
  try {
    const sql = readFileSync(root + '/prisma/migrations/202611130002_ai_chat_widget/migration.sql', 'utf8');
    assert.doesNotMatch(sql, /\b(?:DROP TABLE|DELETE FROM|TRUNCATE)\b/i);
    const altered = [...sql.matchAll(/ALTER TABLE\s+"?(\w+)/gi)].map(m => m[1]);
    assert.ok(altered.length > 0 && altered.every(t => t === 'ai_bookings'));
    await f.store.createBooking('d'.repeat(64), 'constraints', booking, now, f.quote);
    for (const sql of [
      "UPDATE ai_bookings SET luggage_count=101",
      "UPDATE ai_bookings SET source='other'",
      "UPDATE ai_bookings SET source='api'",
      "UPDATE ai_bookings SET phone=NULL,contact_id=NULL",
      "UPDATE ai_bookings SET contact_channel='group'",
    ]) await assert.rejects(() => f.pg.query(sql));
    await f.pg.query("UPDATE ai_bookings SET status='rejected'");
    assert.equal((await f.pg.query('SELECT status FROM ai_bookings')).rows[0].status, 'rejected');
  } finally { await f.pg.close(); }
});
