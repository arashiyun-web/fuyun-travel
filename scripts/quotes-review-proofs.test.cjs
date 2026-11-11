// The reviewer's own proof scripts, run UNCHANGED (byte-identical copies in scripts/test-support/review/,
// sha256 checked below): v6 point-7 87 cases and the v7 extra set (621 paste variants, complete-row
// sends, fleet-button hints, legit texts). Each runs in a child process against this checkout.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const SCRIPTS = {
  'v6-87case-proof.cjs': 'b7bcf981a5895583e1cea4ebda82f95dd5a98f755fdaf8eee19598604dca02ae',
  'v7-extra-proof.cjs': '45fdac8acc06457f4f39435f1fdc44e3bb6ebc0a2b2d153e5349be1c93b6077c',
};
function run(name) {
  const file = path.join(__dirname, 'test-support/review', name);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), SCRIPTS[name], `${name} is the reviewer's file unchanged`);
  const r = spawnSync(process.execPath, [file, root], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  const dir = process.env.QUOTES_REVIEW_EVIDENCE_DIR;
  if (dir) fs.writeFileSync(path.join(dir, name.replace(/\.cjs$/, '.v8.json')), JSON.stringify(out, null, 2));
  return out;
}

test('reviewer v6 87 cases (unchanged script): all as expected', () => {
  const out = run('v6-87case-proof.cjs');
  assert.equal(out.cases.length, 87);
  assert.deepEqual(out.summary.unexpected, []);
  for (const d of out.autoDrafts) {
    assert.equal(d.internalInText, false, d.key);
    assert.equal(d.sendUnedited.status, 200, `${d.key} unedited draft sends`);
    assert.equal(d.sendUnedited.pushedInternal, false, d.key);
  }
  assert.equal(out.fleetButton.internalInText, false);
  assert.equal(out.fleetButton.single7000InText, false);
  assert.equal(out.fleetButton.send.status, 200);
});

test('reviewer v7 extra set (unchanged script): 621/621 variants 409, complete rows 200, legit 200', () => {
  const out = run('v7-extra-proof.cjs');
  assert.deepEqual(out.summary.completeRowsUneditedNot200, [], '7a: complete big-bus drafts send unchanged');
  assert.equal(out.summary.bypassCases, 621);
  assert.equal(out.summary.bypassBlocked, 621);
  assert.deepEqual(out.summary.bypassLeaks, []);
  assert.equal(out.summary.legitCases, 14);
  assert.deepEqual(out.summary.legitFalseBlocks, []);
  assert.equal(out.summary.fleetButtonSendAsIs.status, 200);
  // 7b: the 9 variants of the pending hint that leaked in v7.
  const hint = out.bypass.filter((c) => c.key === 'van九份 按鈕後' && c.text.replace(/[\s\u200b]/g, '').includes('需要訂金'));
  assert.equal(hint.length, 9);
  for (const c of hint) assert.equal(c.status, 409, `${c.variant}: ${c.text}`);
});

// ---- v8 own tests: stored button hints, amount-only fragments, and the 200 invariant ----
const { mock, load } = require('./test-support/step2-load-ts.cjs');
const rows = [];
const clone = (v) => (v == null ? v : structuredClone(v));
mock('@/lib/prisma', { prisma: { charterQuote: {
  findUnique: async ({ where }) => clone(rows.find((r) => r.id === where.id) || null),
  update: async ({ where, data }) => clone(Object.assign(rows.find((r) => r.id === where.id), clone(data))),
} } });
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => true, verifyAdminRequest: () => true, unauthorized: () => Response.json({}, { status: 401 }) });
const pushed = [];
mock('@/lib/lineApi', { pushLineText: async (to, text) => { pushed.push(text); } });
const { buildQuotePrefill } = load('lib/quotePrefill.ts');
const guard = load('lib/quoteSendGuard.ts');
const sendRoute = load('app/api/admin/quotes/[id]/send/route.ts');
const patchRoute = load('app/api/admin/quotes/[id]/route.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');
const NOW = new Date('2026-11-11T07:00:00Z');
let n = 0;
const seed = (src, extra = {}) => {
  const p = buildQuotePrefill({ quoteOptions: [], ...src }, 'line-webhook', NOW);
  const row = { id: `inv-${++n}`, lineUserId: 'U-mock', quoteStatus: 'new', sentAt: null, ...src, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions, ...extra };
  rows.push(row);
  return row;
};
const send = async (id) => { const r = await sendRoute.POST(new Request('http://x/s', { method: 'POST' }), { params: { id } }); return { status: r.status, code: (await r.json()).code || null }; };
const save = async (id, text) => (await patchRoute.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: text, quoteStatus: 'DRAFT' }) }), { params: { id } })).status;
const button = async (id, rateId) => (await draftRoute.POST(new Request('http://x/d', { method: 'POST', body: JSON.stringify({ rateId, hours: 10 }) }), { params: { id } })).json();

test('7a: a stripped staff fragment that is only an amount is not compared; the labelled line still is', () => {
  for (const s of ['16000~22000', 'nt$16000~22000', '7000元', '1.6萬～2.2萬', '9500~11000｜']) assert.equal(guard.isAmountOnly(guard.compactForMatch(s)), true, s);
  for (const s of ['待補:行李件數', '一日環島不受理', '車隊表九人座7000元', '客人範圍16000~22000']) assert.equal(guard.isAmountOnly(guard.compactForMatch(s)), false, s);
  const meta = { autoDraft: { reference: '參考行情 16,000～22,000', staffLines: ['參考行情 NT$16,000～22,000'] } };
  assert.equal(guard.sendBlock({ quoteDraftText: '初步行情：台北到台中 NT$16,000～22,000', quoteOptions: meta }), null);
  assert.equal(guard.sendBlock({ quoteDraftText: '您好\n參考行情 16,000～22,000', quoteOptions: meta }).status, 409);
  assert.equal(guard.sendBlock({ quoteDraftText: 'x 一日環島不受理，建議二～四日', quoteOptions: {} }, ['參考行情：一日環島不受理，建議二～四日']).code, 'STAFF_LINE');
});

test('7b: fleet-button hints are stored at button time and every one is refused at send', async () => {
  const row = seed({ tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' });
  const body = await button(row.id, 'taipei-jiufen-10h');
  const stored = rows.find((r) => r.id === row.id).quoteOptions.fleetFare.staffHints;
  assert.deepEqual(stored, body.staffHints, 'stored == returned');
  assert.ok(stored.includes('需要訂金。金額與取消規則未定。'));
  assert.equal((await send(row.id)).status, 200, 'button draft sends unchanged');
  for (const hint of stored) {
    const r = seed({ tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' });
    await button(r.id, 'taipei-jiufen-10h');
    const draft = rows.find((x) => x.id === r.id).quoteDraftText;
    await save(r.id, `${draft}\n${hint}`);
    assert.equal((await send(r.id)).status, 409, hint);
  }
});

// Every generator path: vehicle × route row × weekday/holiday/unknown date × complete/incomplete.
const ROUTES = [
  ['bus 雙北一日 43座', { passengerCount: 40, pickup: '台北', destination: '台北市區' }],
  ['bus 雙北一日 33/34座', { passengerCount: 30, pickup: '台北', destination: '新北', remarkTail: '三排' }],
  ['bus 雙北半日', { passengerCount: 40, pickup: '台北', destination: '士林', remarkTail: '半日' }],
  ['bus 桃竹', { passengerCount: 40, pickup: '台北', destination: '桃園' }],
  ['bus 中彰鹿來回', { passengerCount: 40, pickup: '台北', destination: '台中' }],
  ['bus 南部長程', { passengerCount: 40, pickup: '板橋', destination: '高雄' }],
  ['bus 山區', { passengerCount: 30, pickup: '樹林', destination: '日月潭' }],
  ['bus 未涵蓋', { passengerCount: 42, pickup: '樹林', destination: '花蓮' }],
  ['bus 一日環島', { passengerCount: 30, pickup: '台北', destination: '一日環島' }],
  ['van 雙北一日', { passengerCount: 6, pickup: '台北車站', destination: '台北101' }],
  ['van 九份', { passengerCount: 6, pickup: '台北車站', destination: '九份' }],
  ['van 雙北以外', { passengerCount: 6, pickup: '台北', destination: '台中' }],
  ['midibus 雙北一日', { passengerCount: 15, pickup: '板橋', destination: '淡水' }],
  ['midibus 九份', { passengerCount: 15, pickup: '台北', destination: '九份' }],
  ['midibus 雙北以外', { passengerCount: 15, pickup: '台北', destination: '台中' }],
  ['no vehicle (人數未知)', { passengerCount: null, pickup: '台北', destination: '九份' }],
];
const DATES = [['weekday', '2026-12-18'], ['holiday', '2026-12-20'], ['unknown', '']];
const FIELDS = [['complete', '無行李 來回'], ['incomplete', '無']];
const invariant = [];

test('invariant: every system-generated customer draft sent unchanged returns 200', async () => {
  for (const [route, r] of ROUTES) for (const [dayName, date] of DATES) for (const [fieldName, remark] of FIELDS) {
    const { remarkTail, ...src } = r;
    const source = { ...src, tripDate: date, remark: [remark === '無' ? '' : remark, remarkTail || ''].join(' ').trim() || '無' };
    // path 1: prefill (LINE webhook createQuoteRow, batch prefill and backfill all use buildQuotePrefill)
    const a = seed(source);
    const ra = await send(a.id);
    invariant.push({ path: 'prefill', route, date: dayName, fields: fieldName, status: ra.status, code: ra.code });
    assert.equal(ra.status, 200, `prefill ${route} ${dayName} ${fieldName}: ${ra.code}`);
    // path 2: the same row as a 待真人客服 handoff row
    const b = seed(source, { quoteStatus: 'HANDOFF' });
    b.quoteOptions = { ...b.quoteOptions, handoff: { status: 'pending_human', trigger: 'range-conversation', at: NOW.toISOString(), sendsToCustomer: false } };
    const rb = await send(b.id);
    invariant.push({ path: 'handoff', route, date: dayName, fields: fieldName, status: rb.status, code: rb.code });
    assert.equal(rb.status, 200, `handoff ${route} ${dayName} ${fieldName}: ${rb.code}`);
    // path 3: 「依已核對車資產生草稿」 for every fleet rate
    for (const rateId of ['taipei-day-10h', 'taipei-jiufen-10h']) {
      const c = seed(source);
      const d = await button(c.id, rateId);
      assert.equal(d.success, true);
      const rc = await send(c.id);
      invariant.push({ path: `button ${rateId}`, route, date: dayName, fields: fieldName, status: rc.status, code: rc.code });
      assert.equal(rc.status, 200, `button ${rateId} ${route} ${dayName} ${fieldName}: ${rc.code}`);
    }
  }
  assert.equal(invariant.length, ROUTES.length * DATES.length * FIELDS.length * 4);
  const out = process.env.QUOTES_INVARIANT_EVIDENCE;
  if (out) fs.writeFileSync(out, JSON.stringify({ total: invariant.length, not200: invariant.filter((x) => x.status !== 200), cases: invariant }, null, 2));
});
