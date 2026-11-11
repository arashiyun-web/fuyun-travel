// v6 range quotes (老闆 2026-11-11 14:56 範圍報價、確認需求後轉真人客服; 15:04 大巴司機服務費; 15:05 大巴參考表).
// Offline: Prisma (incl. the webhook dedupe table), LINE and member/relay modules are in-memory doubles;
// every LINE call is intercepted. Runs the real range modules and the real webhook route.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { mock, load } = require('./test-support/step2-load-ts.cjs');

// ---- in-memory Prisma ----
const db = { sessions: {}, quotes: [], events: {} };
const clone = (v) => (v == null ? v : structuredClone(v));
const statusMatch = (value, cond) => (cond == null ? true : typeof cond === 'object' ? cond.in.includes(value) : value === cond);
const claimedMatch = (row, or) => !or || or.some((c) => (c.claimedAt === null ? row.claimedAt == null : row.claimedAt && row.claimedAt < c.claimedAt.lt));
const lineWebhookEvent = {
  createMany: async ({ data }) => { const [d] = data; if (db.events[d.webhookEventId]) return { count: 0 }; db.events[d.webhookEventId] = { ...d, replyText: null }; return { count: 1 }; },
  findUnique: async ({ where }) => clone(db.events[where.webhookEventId] || null),
  updateMany: async ({ where, data }) => {
    const row = db.events[where.webhookEventId];
    if (!row || !statusMatch(row.status, where.status) || !claimedMatch(row, where.OR)) return { count: 0 };
    Object.assign(row, data); return { count: 1 };
  },
  deleteMany: async ({ where }) => { const row = db.events[where.webhookEventId]; if (row && statusMatch(row.status, where.status)) { delete db.events[where.webhookEventId]; return { count: 1 }; } return { count: 0 }; },
};
const lineSession = {
  findUnique: async ({ where }) => clone(db.sessions[where.userId] || null),
  upsert: async ({ where, update, create }) => { db.sessions[where.userId] = db.sessions[where.userId] ? { ...db.sessions[where.userId], ...clone(update) } : clone(create); return clone(db.sessions[where.userId]); },
  delete: async ({ where }) => { const row = db.sessions[where.userId]; delete db.sessions[where.userId]; return row; },
};
const charterQuote = { create: async ({ data }) => { const row = { id: `quote-${db.quotes.length + 1}`, ...clone(data) }; db.quotes.push(row); return clone(row); } };
mock('@/lib/prisma', { prisma: { lineWebhookEvent, lineSession, charterQuote } });
mock('@/lib/line/groupRelay', { relayGroupEvents: () => {} });
mock('@/lib/members/lineMember', { lineMemberUid: () => '', rememberLineMember: async () => ({ status: 'ignored' }) });

const R = load('lib/quoteRange.ts');
const C = load('lib/quoteConversation.ts');
const { BUS_RANGE_TABLE, BUS_DRIVER_FEE } = load('lib/busRangeTable.ts');
const NOW = new Date('2026-11-11T07:00:00Z'); // 15:00 Asia/Taipei
const reply = (f) => C.rangeReply(f, NOW);
const samples = {};

// ---- 範圍：每種車型 ----
test('range: 九人座賓士 雙北一日 NT$6,500～7,500, never the single fleet price', () => {
  const text = reply({ people: 6, origin: '台北車站', destination: '台北市區' });
  samples.van = text;
  assert.match(text, /建議車型：九人座賓士\n初步行情：雙北一日 NT\$6,500～7,500\n這是範圍報價，不是確定金額。/);
  assert.match(text, /假日、夜間、山區或超時可能加價；實際金額由專人確認行程後提供。/);
  assert.equal(/7,?000\s*元|司機服務費/.test(text), false);
});

test('range: 中巴 雙北一日 NT$9,000～11,000 with the midibus site terms', () => {
  const text = reply({ people: 15, origin: '板橋', destination: '淡水', date: '2026-12-20' });
  samples.midibus = text;
  assert.match(text, /初步行情：雙北一日 NT\$9,000～11,000/);
  assert.match(text, /中巴費用不含稅金，停車費實報實銷，超時另計。/);
  assert.equal(/司機服務費/.test(text), false, 'driver service fee is big-bus only');
});

test('precedence: explicit row wins over quoteBook; quoteBook +15% only where no row (九份 10h)', () => {
  assert.deepEqual(R.SMALL_VEHICLE_PRECEDENCE, ['explicitRow', 'quoteBookPlus15', 'staffQuote']);
  // 九人座 台北一日 has a quoteBook price (7,000 → 7,000～8,500) but the explicit row wins.
  assert.deepEqual(R.quoteBookRange('mercedes-van', 'taipei-day-10h'), { low: 7000, high: 8500 });
  for (const [origin, destination] of [['台北', '台北'], ['台北車站', '台北市區'], ['板橋', '淡水'], ['雙北', '新北']]) {
    const v = R.customerRange({ passengerCount: 6, pickup: origin, destination }, NOW);
    assert.deepEqual([v.low, v.high, v.routeLabel], [6500, 7500, '雙北一日'], `${origin}→${destination}`);
    const m = R.customerRange({ passengerCount: 15, pickup: origin, destination }, NOW);
    assert.deepEqual([m.low, m.high, m.routeLabel], [9000, 11000, '雙北一日'], `中巴 ${origin}→${destination}`);
  }
  assert.equal(R.smallVehicleRange('van', 'taipei_day').rule, 'explicitRow');
  assert.equal(R.smallVehicleRange('midibus', 'taipei_day').rule, 'explicitRow');
  // 九份: no explicit row → quoteBook +15%.
  const v = R.customerRange({ passengerCount: 6, pickup: '台北車站', destination: '九份' }, NOW);
  assert.deepEqual([v.low, v.high, v.routeLabel], [7000, 8500, '台北至九份（10 小時）']);
  const m = R.customerRange({ passengerCount: 15, pickup: '台北', destination: '九份' }, NOW);
  assert.deepEqual([m.low, m.high, m.routeLabel], [9000, 10500, '台北至九份（10 小時）']);
  assert.equal(R.smallVehicleRange('van', 'taipei_jiufen').rule, 'quoteBookPlus15');
  samples.vanJiufen = reply({ people: 6, origin: '台北車站', destination: '九份' });
  assert.match(samples.vanJiufen, /初步行情：台北至九份（10 小時） NT\$7,000～8,500/);
  // Neither → no number.
  assert.equal(R.customerRange({ passengerCount: 6, pickup: '台北', destination: '台中' }, NOW).low, null);
  assert.equal(R.smallVehicleRange('van', null), null);
});

test('range: van/midibus quoteBook rule = price low, +15% rounded up to 500 high', () => {
  assert.deepEqual(R.quoteBookRange('mercedes-van', 'taipei-day-10h'), { low: 7000, high: 8500 });
  assert.deepEqual(R.quoteBookRange('toyota-midibus', 'taipei-jiufen-10h'), { low: 9000, high: 10500 });
  const outside = reply({ people: 6, origin: '台北', destination: '台中' });
  assert.match(outside, /這段路線的費用會由專人報價。/);
  assert.equal(/NT\$\d/.test(outside), false, 'no number outside the table');
});

test('bus table: one data table, every row has a source, 15:05 rows exactly as decided', () => {
  for (const row of BUS_RANGE_TABLE) assert.ok(row.source && row.source.length > 4, row.route);
  const find = (route, seat) => BUS_RANGE_TABLE.find((r) => r.route === route && r.seat === seat);
  assert.deepEqual([find('taipei_city_day', '43').weekday, find('taipei_city_day', '43').holiday], [{ low: 9500, high: 11000 }, { low: 10500, high: 12000 }]);
  assert.deepEqual([find('taipei_city_day', '33').weekday, find('taipei_city_day', '33').holiday], [{ low: 10000, high: 13000 }, null]);
  assert.deepEqual([find('taipei_half_day', '43').weekday, find('taipei_half_day', '43').holiday], [{ low: 7500, high: 9000 }, { low: 8500, high: 10000 }]);
  assert.deepEqual(find('taipei_to_taoyuan_hsinchu', null).weekday, { low: 12500, high: 15000 });
  assert.deepEqual(find('taipei_to_taichung_changhua_lukang_round_trip', null).weekday, { low: 16000, high: 22000 });
  assert.deepEqual(find('taipei_to_south_long', null).weekday, { low: 24000, high: 35000 });
  assert.deepEqual(find('mountain', null).weekday, { low: 16000, high: 22000 });
  const { knowledgeQuote } = load('lib/quoteKnowledge.ts');
  assert.equal(knowledgeQuote({ pickup: '台北', destination: '台北' }).range.low, 9500, 'staff KB reference reads the same table');
});

test('bus 43座 雙北一日: 平日 9,500～11,000 / 假日 10,500～12,000 by date; unknown date = weekday band + 假日略高', () => {
  const weekday = reply({ people: 40, origin: '台北', destination: '台北市區', date: '2026-12-18' });
  const holiday = reply({ people: 40, origin: '台北', destination: '台北市區', date: '2026-12-20' });
  const unknown = reply({ people: 40, origin: '板橋', destination: '淡水' });
  Object.assign(samples, { bus43Weekday: weekday, bus43Holiday: holiday, bus43NoDate: unknown });
  assert.match(weekday, /初步行情：雙北／台北市區一日（10 小時），12\/18（週五）平日 NT\$9,500～11,000/);
  assert.match(holiday, /初步行情：雙北／台北市區一日（10 小時），12\/20（週日）假日 NT\$10,500～12,000/);
  assert.match(unknown, /初步行情：雙北／台北市區一日（10 小時），平日 NT\$9,500～11,000\n假日價格略高/);
  for (const t of [weekday, holiday, unknown]) assert.match(t, /建議車型：大巴（43 座四排）/);
});

test('bus 33/34座三排 NT$10,000～13,000 with the wider-seat note; 半日 4h 43座 bands', () => {
  const three = reply({ people: 30, origin: '台北', destination: '新北', note: '想要三排座' });
  samples.bus33 = three;
  assert.match(three, /建議車型：大巴（33／34 座三排）/);
  assert.match(three, /NT\$10,000～13,000\n三排椅較寬，價格可能較高。/);
  assert.match(reply({ people: 40, origin: '台北', destination: '士林', note: '半日', date: '2026-12-16' }), /雙北半日（4 小時），12\/16（週三）平日 NT\$7,500～9,000/);
  assert.match(reply({ people: 40, origin: '台北', destination: '士林', note: '半天', date: '2026-12-19' }), /雙北半日（4 小時），12\/19（週六）假日 NT\$8,500～10,000/);
  assert.match(reply({ people: 40, origin: '台北', destination: '士林', note: '4小時' }), /雙北半日（4 小時），平日 NT\$7,500～9,000\n假日價格略高/);
  assert.match(reply({ people: 40, origin: '台北', destination: '新北', note: '三排' }), /43 座四排/, 'over 34 people cannot use the 33/34 seat bus');
});

test('bus other routes keep knowledge-base ranges; mountain add-on; uncovered = 專人報價; one-day round-Taiwan refused', () => {
  assert.match(reply({ people: 40, origin: '台北', destination: '台中', date: '2026-12-20' }), /台北到台中、彰化、鹿港來回 NT\$16,000～22,000\n/);
  assert.match(reply({ people: 40, origin: '台北', destination: '桃園' }), /台北到桃園、新竹 NT\$12,500～15,000/);
  assert.match(reply({ people: 40, origin: '板橋', destination: '高雄' }), /台北到南部長程 NT\$24,000～35,000/);
  assert.match(reply({ people: 30, origin: '樹林', destination: '日月潭' }), /NT\$16,000～22,000 起，山區另加價/);
  const uncovered = reply({ people: 42, origin: '樹林', destination: '花蓮' });
  assert.match(uncovered, /這段路線的費用會由專人報價。/);
  assert.equal(/NT\$\d{1,3},\d{3}～/.test(uncovered), false);
  const rt = reply({ people: 30, origin: '台北', destination: '一日環島' });
  assert.match(rt, /一日環島無法安排/);
  assert.match(rt, /二日環島、三日環島、四日深度環島/);
  assert.equal(/NT\$/.test(rt), false);
});

// ---- 司機服務費 ----
test('driver service fee: separate line, weekday/holiday picked by date and named, both shown when unknown', () => {
  assert.equal(R.busDriverFeeLine(null, NOW), '司機服務費另計：平日 NT$2,500、假日 NT$3,500');
  assert.equal(R.busDriverFeeLine('2026-12-20', NOW), '司機服務費另計：12/20（週日）為假日，NT$3,500');
  assert.equal(R.busDriverFeeLine('12/19', NOW), '司機服務費另計：12/19（週六）為假日，NT$3,500');
  assert.equal(R.busDriverFeeLine('12月18日', NOW), '司機服務費另計：12/18（週五）為平日，NT$2,500（如遇國定假日以假日 NT$3,500 計）');
  assert.equal(R.busDriverFeeLine('1/4', NOW), '司機服務費另計：1/4（週一）為平日，NT$2,500（如遇國定假日以假日 NT$3,500 計）', 'past month/day rolls to next year (2027-01-04)');
  assert.equal(R.busDriverFeeLine('2/30', NOW), '司機服務費另計：平日 NT$2,500、假日 NT$3,500', 'invalid date = unknown');
  assert.equal(R.busDriverFeeLine('下週', NOW), '司機服務費另計：平日 NT$2,500、假日 NT$3,500');
  assert.deepEqual({ weekday: BUS_DRIVER_FEE.weekday, holiday: BUS_DRIVER_FEE.holiday }, { weekday: 2500, holiday: 3500 });
  const text = reply({ people: 40, origin: '台北', destination: '台北市區', date: '2026-12-20' });
  const lines = text.split('\n');
  const rangeLine = lines.find((l) => l.startsWith('初步行情：'));
  assert.equal(/2,500|3,500/.test(rangeLine), false, 'fee is not folded into the range line');
  assert.equal(lines.filter((l) => l.startsWith('司機服務費另計')).length, 1);
  for (const f of [{ people: 40, origin: '台北', destination: '台中' }, { people: 42, origin: '樹林', destination: '花蓮' }, { people: 30, origin: '樹林', destination: '日月潭' }]) {
    assert.match(reply(f), /司機服務費另計：/, 'every big-bus range reply carries the fee line');
  }
  assert.equal(/司機小費|1,000～2,000|1,000~2,000/.test(Object.values(samples).join('\n') + text), false, 'no old driver-tip wording');
});

test('surcharge wording: no invented tax status for bus or van; generic line on every range reply', () => {
  for (const t of [samples.van, samples.bus43Weekday, samples.bus43Holiday]) {
    assert.match(t, /假日、夜間、山區或超時可能加價；實際金額由專人確認行程後提供。/);
    assert.equal(/營業稅|未含稅|不含稅金|實報實銷/.test(t), false);
  }
});

// ---- 缺欄位提問 ----
test('missing-field questions follow quote_rules (日期、出發地、目的地、人數、行李件數、單程或來回)', () => {
  assert.deepEqual(C.missingFields({}), ['日期', '出發地', '目的地', '人數', '行李件數', '單程或來回']);
  const text = reply({ origin: '台北' });
  for (const q of ['・用車日期（例如 12/20）', '・目的地', '・乘車人數', '・行李件數（例如 每人一件 28 吋，或 無行李）', '・單程或來回']) assert.ok(text.includes(q), q);
  assert.equal(text.includes('・出發地'), false);
  assert.deepEqual(C.missingFields({ date: '12/20', origin: '台北', destination: '台中', people: 40, luggage: '無行李', tripType: '來回' }), []);
  assert.equal(C.parseLuggage('每人一件28吋'), '每人一件28吋');
  assert.equal(C.parseLuggage('沒有行李'), '無行李');
  assert.equal(C.parseTripType('我們來回'), '來回');
  assert.equal(C.parseTripType('單程就好'), '單程');
});

// ---- Webhook：feature flag、轉真人、冪等 ----
const SECRET = 'synthetic-secret';
process.env.LINE_CHANNEL_SECRET = SECRET;
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'synthetic-token';
process.env.LINE_ADMIN_USER_ID = 'U-staff';
const outbound = [];
let failReplies = 0;
global.fetch = async (url, init) => {
  outbound.push({ url: String(url), body: JSON.parse(String(init && init.body || '{}')) });
  if (failReplies > 0 && String(url).includes('/reply')) { failReplies -= 1; return new Response('{}', { status: 500 }); }
  return new Response('{}', { status: 200 });
};
const route = load('app/api/line/webhook/route.ts');
let seq = 0;
async function inbound(user, text, { id, redelivery = false } = {}) {
  const eventId = id || `01EV${++seq}`;
  const body = JSON.stringify({ destination: 'U-bot', events: [{ type: 'message', webhookEventId: eventId, deliveryContext: { isRedelivery: redelivery }, replyToken: `rt-${eventId}`, source: { type: 'user', userId: user }, message: { type: 'text', text } }] });
  const signature = crypto.createHmac('sha256', SECRET).update(body).digest('base64');
  const before = outbound.length;
  const res = await route.POST(new Request('http://localhost/api/line/webhook', { method: 'POST', headers: { 'x-line-signature': signature }, body }));
  const calls = outbound.slice(before);
  return {
    eventId, status: res.status,
    replies: calls.filter((c) => c.url.endsWith('/message/reply')).map((c) => c.body.messages[0].text),
    customerPushes: calls.filter((c) => c.url.endsWith('/message/push') && c.body.to === user).length,
    staffPushes: calls.filter((c) => c.url.endsWith('/message/push') && c.body.to === 'U-staff').length,
  };
}
const handoffSequence = [];

test('flag OFF (default): existing replies unchanged, zero customer pushes, range text only saved as the staff draft', async () => {
  delete process.env.LINE_AUTO_RANGE_REPLY;
  const u = 'U-flag-off';
  const steps = [
    await inbound(u, '包車'),
    await inbound(u, '日期：2026-12-20 人數：40 出發地：台北 目的地：台北市區'),
    await inbound(u, '我要正式報價'),
  ];
  for (const s of steps) { assert.equal(s.status, 200); assert.equal(s.replies.length, 1); assert.equal(s.customerPushes, 0); }
  assert.match(steps[0].replies[0], /^您好，我是小幫手，有什麼我能為您服務。/);
  assert.match(steps[1].replies[0], /以下為初步行情：[\s\S]*NT\$11,000～12,500 起[\s\S]*【我要正式報價】/, 'pre-v6 reply text');
  assert.match(steps[2].replies[0], /^已收到您的正式報價需求。/);
  const row = db.quotes.find((q) => q.lineUserId === u);
  assert.ok(row);
  assert.match(row.quoteDraftText, /初步行情：雙北／台北市區一日（10 小時），12\/20（週日）假日 NT\$10,500～12,000/);
  assert.match(row.quoteDraftText, /司機服務費另計：12\/20（週日）為假日，NT\$3,500/);
  assert.equal(steps.some((s) => s.replies[0].includes('10,500')), false, 'the range draft is not replied to the customer');
  assert.equal(row.quoteOptions.autoDraft.sendsToCustomer, false);
});

test('flag ON: one reply per inbound, range + questions until complete, then 待真人客服 and one handoff line', async () => {
  process.env.LINE_AUTO_RANGE_REPLY = 'on';
  const u = 'U-flag-on';
  const quotesBefore = db.quotes.length;
  const msgs = ['包車', '日期：2026-12-20 人數：40 出發地：台北 目的地：台北市區', '無行李，來回', '請問什麼時候會聯絡我？'];
  for (const text of msgs) {
    const r = await inbound(u, text);
    handoffSequence.push({ customer: text, reply: r.replies[0], replies: r.replies.length, customerPushes: r.customerPushes, staffPushes: r.staffPushes, quoteRows: db.quotes.length - quotesBefore });
    assert.equal(r.status, 200);
    assert.equal(r.replies.length, 1, `exactly one reply for: ${text}`);
    assert.equal(r.customerPushes, 0);
  }
  const [entry, ranged, done, after] = handoffSequence;
  assert.match(entry.reply, /^您好，我是小幫手/);
  assert.match(ranged.reply, /12\/20（週日）假日 NT\$10,500～12,000/);
  assert.match(ranged.reply, /司機服務費另計：12\/20（週日）為假日，NT\$3,500/);
  assert.match(ranged.reply, /・行李件數[\s\S]*・單程或來回/);
  assert.equal(ranged.quoteRows, 0, 'no row until the needs are complete');
  assert.equal(done.reply, C.HANDOFF_REPLY);
  assert.equal(done.quoteRows, 1);
  assert.equal(done.staffPushes, 1, 'staff notification only');
  assert.equal(after.reply, C.HANDOFF_REPEAT_REPLY);
  assert.equal(after.quoteRows, 1);
  const row = db.quotes[quotesBefore];
  assert.equal(row.quoteStatus, 'HANDOFF');
  assert.equal(row.quoteOptions.handoff.status, 'pending_human');
  assert.equal(row.quoteOptions.handoff.sendsToCustomer, false);
  assert.match(row.quoteDraftText, /NT\$10,500～12,000/);
  for (const s of handoffSequence) assert.equal(/待補|內部參考|待人工|行情表未涵蓋|後台報價草稿|自動預生成|知識庫|pricing_matrix|quote_rules|參考行情/.test(s.reply), false);
});

test('flag ON: webhook redelivery is idempotent (no second reply, row or staff push); failed reply is resent, not rebuilt', async () => {
  process.env.LINE_AUTO_RANGE_REPLY = '1';
  const u = 'U-redelivery';
  await inbound(u, '包車');
  await inbound(u, '日期：2026-12-18 人數：40 出發地：台北 目的地：台北市區');
  const rows = db.quotes.length;
  const first = await inbound(u, '無行李，單程', { id: '01EVDUP' });
  assert.equal(first.replies.length, 1);
  assert.equal(db.quotes.length, rows + 1);
  const again = await inbound(u, '無行李，單程', { id: '01EVDUP', redelivery: true });
  assert.deepEqual([again.replies.length, again.customerPushes, again.staffPushes, db.quotes.length], [0, 0, 0, rows + 1]);
  failReplies = 1;
  const failed = await inbound(u, '還有一位老人家', { id: '01EVFAIL' });
  assert.equal(failed.status, 500);
  const resent = await inbound(u, '還有一位老人家', { id: '01EVFAIL', redelivery: true });
  assert.deepEqual(resent.replies, failed.replies, 'same cached text');
  assert.equal(db.quotes.length, rows + 1);
  const third = await inbound(u, '還有一位老人家', { id: '01EVFAIL', redelivery: true });
  assert.equal(third.replies.length, 0);
  delete process.env.LINE_AUTO_RANGE_REPLY;
});

test('flag values: only 1/true/on enable; anything else keeps the old replies', async () => {
  for (const value of ['', '0', 'off', 'yes', 'TRUE ']) {
    process.env.LINE_AUTO_RANGE_REPLY = value;
    const u = `U-flag-${value || 'empty'}`;
    await inbound(u, '包車');
    const r = await inbound(u, '日期：2026-12-18 人數：40 出發地：台北 目的地：台北市區');
    if (value === 'TRUE ') assert.match(r.replies[0], /平日 NT\$9,500～11,000/, '"TRUE " (trimmed, case-insensitive) enables');
    else assert.match(r.replies[0], /NT\$11,000～12,500 起/, `"${value}" keeps the old reply`);
  }
  delete process.env.LINE_AUTO_RANGE_REPLY;
});

test('samples written to evidence', () => {
  const out = process.env.QUOTES_RANGE_EVIDENCE;
  if (out) require('node:fs').writeFileSync(out, JSON.stringify({ now: NOW.toISOString(), samples, handoffSequence }, null, 2));
  assert.ok(Object.keys(samples).length >= 6);
});
