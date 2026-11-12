// v9: invisible-character folding in the send guard, the fixed 「需要訂金」 staff line on rows without
// stored hints, trip-date year read from created_at, and the explicit regenerateLegacy prefill opt-in.
// Prisma and LINE are mocked; nothing is sent.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
const { routeTx } = require('./test-support/route-prisma.cjs');

const root = path.resolve(__dirname, '..');
let rows = [];
let orders = [];
const clone = (v) => (v == null ? v : structuredClone(v));
const matches = (row, where = {}) => {
  for (const [key, cond] of Object.entries(where || {})) {
    if (key === 'AND') { if (!cond.every((part) => matches(row, part))) return false; continue; }
    if (key === 'OR') { if (!cond.some((part) => matches(row, part))) return false; continue; }
    const value = row[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if (cond.in && !cond.in.includes(value)) return false;
      if (cond.notIn && cond.notIn.includes(value)) return false;
    } else if (value !== cond) return false;
  }
  return true;
};
const writes = [];
mock('@/lib/prisma', { prisma: routeTx({ // v12: send / draft / PATCH run in a transaction (route-prisma.cjs)
  charterQuote: {
    findUnique: async ({ where }) => clone(rows.find((r) => r.id === where.id) || null),
    findMany: async ({ where, take } = {}) => clone(rows.filter((r) => matches(r, where)).slice(0, take || 100)),
    update: async ({ where, data }) => { writes.push(where.id); return clone(Object.assign(rows.find((r) => r.id === where.id), clone(data))); },
    updateMany: async ({ where, data }) => { const hit = rows.filter((r) => matches(r, where)); for (const r of hit) { writes.push(r.id); Object.assign(r, clone(data)); } return { count: hit.length }; },
  },
  charterOrder: {
    findMany: async ({ where }) => clone(orders.filter((o) => where.quoteId.in.includes(o.quoteId))),
    findUnique: async ({ where }) => clone(orders.find((o) => o.quoteId === where.quoteId) || null),
  },
}) });
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => true, verifyAdminRequest: () => true, unauthorized: () => Response.json({}, { status: 401 }) });
const pushed = [];
mock('@/lib/lineApi', { pushLineText: async (to, text) => { pushed.push(text); } });

const guard = load('lib/quoteSendGuard.ts');
const { dayTypeOf, busDriverFeeLine, yearBaseOf } = load('lib/quoteRange.ts');
const { buildQuotePrefill, quoteEstimate } = load('lib/quotePrefill.ts');
const { panelLines } = load('lib/quotePanelText.ts');
const { FLEET_DRAFT_STAFF_HINTS } = load('lib/fleetQuoteDraft.ts');
const { fleetQuoteRecord } = load('lib/fleetCatalog.ts');
const sendRoute = load('app/api/admin/quotes/[id]/send/route.ts');
const patchRoute = load('app/api/admin/quotes/[id]/route.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');
const prefillRoute = load('app/api/admin/quotes/prefill/route.ts');

const NOW = new Date('2026-11-11T07:00:00Z');
let n = 0;
const seed = (src, extra = {}) => {
  const p = buildQuotePrefill({ quoteOptions: [], ...src }, 'line-webhook', NOW);
  const row = { id: `v9-${++n}`, lineUserId: 'U-mock', quoteStatus: 'new', sentAt: null, ...src, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions, ...extra };
  rows.push(row);
  return row;
};
const get = (id) => rows.find((r) => r.id === id);
const send = async (id) => { const b = pushed.length; const r = await sendRoute.POST(new Request('http://x/s', { method: 'POST' }), { params: { id } }); return { status: r.status, code: (await r.json()).code || null, pushed: pushed.length - b }; };
const save = async (id, text) => (await patchRoute.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: text, quoteStatus: 'DRAFT' }) }), { params: { id } })).status;
const button = async (id, rateId = 'taipei-jiufen-10h') => (await draftRoute.POST(new Request('http://x/d', { method: 'POST', body: JSON.stringify({ rateId, hours: 10 }) }), { params: { id } })).json();
const prefill = async (body) => { const r = await prefillRoute.POST(new Request('http://x/prefill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; };

const VAN = { tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' };
const BUS = { tripDate: '2026-12-20', passengerCount: 40, pickup: '台北', destination: '台中', remark: '' };
const DEPOSIT = '需要訂金。金額與取消規則未定。';

// ---- 1. reviewer v8 batch (pinned; v12: Prisma double wrapped in routeTx(), two lines, cases unchanged) ----
test('reviewer v8 batch (pinned copy): all 39 soft-hyphen/LRM/variation-selector cases (36 leaked in v8) and the legacy deposit line now 409', () => {
  const file = path.join(__dirname, 'test-support/review/v8-new-proof.cjs');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), '107e5297af62e807c800eee4073a0468762357996c17bdea4293ffe0fcf9a66f');
  const r = spawnSync(process.execPath, [file, root], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  const dir = process.env.QUOTES_REVIEW_EVIDENCE_DIR;
  if (dir) fs.writeFileSync(path.join(dir, 'v8-new-proof.v9.json'), JSON.stringify(out, null, 2));
  // 13 strings × 3 characters = 39 (the reviewer counted 36 leaking at v8; all 39 are checked here).
  const invisible = out.bypass.filter((c) => /U\+00AD|U\+200E|U\+FE0F/.test(c.label));
  assert.equal(invisible.length, 39);
  for (const c of invisible) assert.equal(c.status, 409, c.label);
  const punct = out.bypass.filter((c) => /句號改逗號|刪句讀/.test(c.label) && /按鈕提示[13]/.test(c.label));
  assert.equal(punct.length, 4);
  for (const c of punct) assert.equal(c.status, 409, c.label);
  // Left: only half-sentence rewrites (12 cases in v8, out of scope as rewriting, not pasting).
  for (const c of out.bypass.filter((x) => x.status !== 409)) assert.match(c.label, /只貼後半/);
  for (const t of out.tamper) {
    if (t.hint === '(原樣草稿)') assert.equal(t.status, 200, t.label);
    else assert.equal(t.status, 409, `${t.label}｜${t.hint}`);
  }
  assert.equal(out.invariant.length, 224);
  assert.deepEqual(out.summary.invariantNot200, []);
});

// ---- 1b. broader invisible set ----
const INVISIBLES = {
  'U+00AD': '\u00ad', 'U+034F CGJ': '\u034f', 'U+061C ALM': '\u061c', 'U+115F': '\u115f', 'U+1160': '\u1160', 'U+17B4': '\u17b4', 'U+180B': '\u180b', 'U+180E': '\u180e',
  'U+200B': '\u200b', 'U+200C': '\u200c', 'U+200D': '\u200d', 'U+200E': '\u200e', 'U+200F': '\u200f',
  'U+202A': '\u202a', 'U+202B': '\u202b', 'U+202C': '\u202c', 'U+202D': '\u202d', 'U+202E': '\u202e',
  'U+2060': '\u2060', 'U+2061': '\u2061', 'U+2062': '\u2062', 'U+2063': '\u2063', 'U+2064': '\u2064',
  'U+2066': '\u2066', 'U+2067': '\u2067', 'U+2068': '\u2068', 'U+2069': '\u2069', 'U+206A': '\u206a', 'U+206F': '\u206f',
  'U+2800': '\u2800', 'U+3164': '\u3164', 'U+FE00': '\ufe00', 'U+FE0E': '\ufe0e', 'U+FE0F': '\ufe0f', 'U+FEFF': '\ufeff', 'U+FFA0': '\uffa0',
  'U+E0001 tag': '\u{e0001}', 'U+E0041 tag': '\u{e0041}', 'U+E007F tag': '\u{e007f}', 'U+E0100': '\u{e0100}', 'U+E01EF': '\u{e01ef}',
  'U+0301 combining': '\u0301', 'U+20DD enclosing': '\u20dd', 'LRM+RLM+ZWSP mix': '\u200e\u200f\u200b',
};
const interleave = (s, ch) => Array.from(s).join(ch);
const fullWidth = (s) => s.replace(/[0-9A-Za-z$,:|]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));

test('broader invisible set: every staff string × every invisible char (interleaved, once in the middle, full-width + invisible) → 409', async () => {
  const probeB = seed(BUS); const strings = [quoteEstimate(probeB).summary, ...panelLines(probeB.quoteOptions)]; rows.pop();
  const probeV = seed(VAN); const hints = (await button(probeV.id)).staffHints; rows.pop();
  assert.ok(hints.includes(DEPOSIT));
  let total = 0;
  for (const [name, ch] of Object.entries(INVISIBLES)) {
    for (const [src, list, viaButton] of [[BUS, strings, false], [VAN, hints, true]]) for (const s of list) {
      const mid = Math.floor(Array.from(s).length / 2);
      for (const v of [interleave(s, ch), Array.from(s).map((c, i) => (i === mid ? ch + c : c)).join(''), interleave(fullWidth(s), ch)]) {
        const r = seed(src); if (viaButton) await button(r.id);
        await save(r.id, `${get(r.id).quoteDraftText}\n${v}`);
        const x = await send(r.id);
        assert.equal(x.status, 409, `${name}: ${JSON.stringify(v.slice(0, 40))}`);
        assert.equal(x.pushed, 0);
        total += 1;
      }
    }
  }
  assert.ok(total >= 1500, `ran ${total}`);
});

test('markers with invisible characters inside are found; compactForMatch drops every invisible char', () => {
  for (const ch of Object.values(INVISIBLES)) {
    assert.deepEqual(guard.forbiddenMarkersIn(`報價 參${ch}考${ch}行${ch}情 x`), ['參考行情']);
    assert.equal(guard.compactForMatch(interleave('待補', ch)), '待補');
    assert.equal(guard.sendBlock({ quoteDraftText: interleave('自動預生成', ch), quoteOptions: {} }).code, 'FORBIDDEN_MARKER');
  }
  assert.equal(guard.compactForMatch('1\u00ad6,\u200e000'), '16000');
  assert.ok(guard.amountsIn('NT$1\u00ad6,0\ufe0f00～2\u200e2,000').has(16000));
  assert.equal(guard.containsKnowledgeRange('1\u00ad6,000～2\u2060\u{e0100}2,000'), true);
});

// ---- 2. fixed deposit line ----
test('the 「需要訂金」 line is refused on rows without quoteOptions.fleetFare.staffHints', async () => {
  for (const options of [{}, [], null, { fleetFare: {} }, { fleetFare: { staffHints: [] } }, { fleetFare: { staffHints: 'x' } }, { autoDraft: { staffLines: [] } }]) {
    for (const v of [DEPOSIT, `您好\n${DEPOSIT}\n謝謝`, '需要訂金，金額與取消規則未定', '需要訂金金額與取消規則未定', '需 要 訂 金 。 金額與取消規則未定 。', fullWidth(DEPOSIT), interleave(DEPOSIT, '\u00ad'), '需要訂金!金額與取消規則未定?']) {
      const b = guard.sendBlock({ quoteDraftText: v, quoteOptions: options });
      assert.ok(b && b.status === 409 && b.code === 'STAFF_LINE', `${JSON.stringify(options)} ${v}`);
    }
    for (const hint of FLEET_DRAFT_STAFF_HINTS) assert.equal(guard.sendBlock({ quoteDraftText: `x\n${hint.replace(/。/g, '')}`, quoteOptions: options }).status, 409, hint);
  }
  // Old row through the real routes: a v5-era row (no staffHints) with the line pasted.
  const old = seed(VAN); await button(old.id);
  delete get(old.id).quoteOptions.fleetFare.staffHints;
  assert.equal((await send(old.id)).status, 200, 'old row draft unchanged still sends');
  const r = seed(VAN); await button(r.id); delete get(r.id).quoteOptions.fleetFare;
  await save(r.id, `${get(r.id).quoteDraftText}\n${DEPOSIT}`);
  assert.deepEqual(await send(r.id), { status: 409, code: 'STAFF_LINE', pushed: 0 });
  // The catalog still carries the exact line this constant guards.
  assert.ok(fleetQuoteRecord('mercedes-van').conditions.includes(DEPOSIT));
  assert.ok(guard.FIXED_STAFF_LINES.includes(DEPOSIT));
});

test('legit customer wording around deposits and emoji still sends', () => {
  for (const s of ['確認行程後需要訂金，金額由專人告知。', '需要訂金嗎？專人會說明。', '取消規則由專人說明', '感謝您❤️ 期待為您服務 👍🏻', 'Café 行程確認', '初步行情：台北到台中來回 NT$16,000～22,000']) {
    assert.equal(guard.sendBlock({ quoteDraftText: s, quoteOptions: {} }), null, s);
  }
});

// ---- 3. year from created_at ----
test('trip date without a year is read from created_at (Asia/Taipei), not today', () => {
  const today = new Date('2026-11-12T00:00:00Z');
  const d1 = dayTypeOf('8/7', yearBaseOf('2026-06-25T03:00:00Z', today));
  assert.deepEqual(d1, { dayType: 'weekday', label: '8/7（週五）' });
  assert.deepEqual(dayTypeOf('9/18', yearBaseOf(new Date('2026-06-28T03:00:00Z'), today)), { dayType: 'weekday', label: '9/18（週五）' });
  assert.deepEqual(dayTypeOf('8月7日', yearBaseOf('2026-06-25T03:00:00Z', today)), { dayType: 'weekday', label: '8/7（週五）' });
  // Missing / invalid created_at keeps the old behaviour (next 8/7 after today = 2027-08-07, Saturday).
  for (const missing of [undefined, null, '', 'not-a-date']) assert.deepEqual(dayTypeOf('8/7', yearBaseOf(missing, today)), { dayType: 'holiday', label: '8/7（週六）' });
  // Taipei day boundary: 2026-08-06 16:30Z is 8/7 00:30 in Taipei → same day counts; 8/7 16:30Z is 8/8 → next year.
  assert.equal(dayTypeOf('8/7', yearBaseOf('2026-08-06T16:30:00Z', today)).dayType, 'weekday');
  assert.equal(dayTypeOf('8/7', yearBaseOf('2026-08-07T16:30:00Z', today)).dayType, 'holiday');
  // A full date ignores created_at.
  assert.equal(dayTypeOf('2027-08-07', yearBaseOf('2026-06-25T03:00:00Z', today)).dayType, 'holiday');
  assert.equal(busDriverFeeLine('8/7', yearBaseOf('2026-06-25T03:00:00Z', today)), '司機服務費另計：8/7（週五）為平日，NT$2,500（如遇國定假日以假日 NT$3,500 計）');
});

test('prefill, list summary and the fleet button use created_at: 8/7 (2026-06-25) and 9/18 (2026-06-28) are weekday drafts', async () => {
  const later = new Date('2026-11-12T00:00:00Z');
  for (const [tripDate, createdAt, label] of [['8/7', new Date('2026-06-25T02:00:00Z'), '8/7（週五）'], ['9/18', new Date('2026-06-28T02:00:00Z'), '9/18（週五）']]) {
    const src = { tripDate, createdAt, passengerCount: 40, pickup: '台北', destination: '台北市區', remark: '無行李 單程', quoteOptions: [] };
    const p = buildQuotePrefill(src, 'backfill', later);
    assert.match(p.quoteDraftText, new RegExp(`初步行情：.*${label.replace(/[()（）]/g, '.')}平日 NT\\$9,500～11,000`));
    assert.ok(p.quoteDraftText.includes(`司機服務費另計：${label}為平日，NT$2,500`));
    assert.equal(/假日，NT\$3,500|10,500～12,000/.test(p.quoteDraftText), false);
    assert.deepEqual([p.quoteOptions.autoDraft.customerRange.low, p.quoteOptions.autoDraft.customerRange.high], [9500, 11000]);
    assert.equal(p.quoteOptions.autoDraft.generatedAt, later.toISOString(), 'generatedAt stays the real time');
    assert.match(quoteEstimate(src).summary, /客人範圍 9,500～11,000/);
    // Same row without created_at keeps the old reading (today → next year, Saturday → holiday band).
    const old = buildQuotePrefill({ ...src, createdAt: undefined }, 'backfill', later);
    assert.match(old.quoteDraftText, /假日 NT\$10,500～12,000/);
    // 「依已核對車資產生草稿」 on the stored row reads the year from created_at too.
    const row = { id: `v9-${++n}`, lineUserId: 'U', quoteStatus: 'new', sentAt: null, ...src, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions };
    rows.push(row);
    await button(row.id, 'taipei-day-10h');
    assert.ok(get(row.id).quoteDraftText.includes(`司機服務費另計：${label}為平日，NT$2,500`));
    assert.equal((await send(row.id)).status, 200);
  }
});


// ---- 救火員 v9 review scripts, pinned. v9-new-proof.cjs: v12 wraps its Prisma double in routeTx() (two lines).
// v9-year-proof.cjs and v9-regenerate-db-proof.cjs differ only in their trip-date constants (now the fictional 8/7,
// same created_at; boundary timestamps shifted by the same 7 days; weekdays unchanged), see the handoff notes. ----
const V9_REVIEW = {
  'v9-new-proof.cjs': '9c519e0a912de2ed539cd04e0627cc75423a0cf08455aa9e52d661ae1c19b83e',
  'v9-year-proof.cjs': '4211fa31b83b2870227ff43089c655c86b08f46ea99ee5a97a64f522dd060e6b',
  // Needs a throwaway local PostgreSQL (DATABASE_URL); run by hand, not in the offline suite. Pinned here.
  'v9-regenerate-db-proof.cjs': 'a9d2fc85011345df3517303be0c2d005021cdaffc5dc2b3c209fb3b2b0c17ab7',
};
function runReview(name) {
  const file = path.join(__dirname, 'test-support/review', name);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), V9_REVIEW[name], `${name} is the pinned reviewer copy`);
  if (name.includes('-db-')) return null;
  const r = spawnSync(process.execPath, [file, root], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  const dir = process.env.QUOTES_REVIEW_EVIDENCE_DIR;
  if (dir) fs.writeFileSync(path.join(dir, name.replace(/\.cjs$/, '.v10.json')), JSON.stringify(out, null, 2));
  return out;
}

test('reviewer v9 batch (pinned copy): 280 bypass variants 409, 30 emoji/combining legit texts 200', () => {
  const out = runReview('v9-new-proof.cjs');
  assert.equal(out.summary.bypass, 280);
  assert.deepEqual(out.summary.bypassNot409, []);
  assert.equal(out.summary.legit, 30);
  assert.deepEqual(out.summary.legitNot200, []);
});

test('reviewer v9 year set (pinned copy, dates swapped): 12/12, fallbacks and the 2,500 fee line', () => {
  const out = runReview('v9-year-proof.cjs');
  assert.equal(out.summary.cases, 12);
  assert.equal(out.summary.ok, 12);
  assert.deepEqual(out.summary.bad, []);
  assert.equal(out.summary.fallbacksOk, true);
  assert.equal(out.summary.fee2500, true);
  runReview('v9-regenerate-db-proof.cjs');
});
