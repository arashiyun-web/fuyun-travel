// Every reviewer case for 「送出給 LINE」 (merge reviews v1, v2, v4) plus the v5 value-based range cases.
// Offline: Prisma, admin auth and LINE push are mocked; runs the real prefill builder, PATCH save,
// fleet draft route, send route and send guard. Each case appends text to the auto draft, saves, sends.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mock, load } = require('./test-support/step2-load-ts.cjs');

const rows = [];
const clone = (v) => (v == null ? v : structuredClone(v));
mock('@/lib/prisma', { prisma: { charterQuote: {
  findUnique: async ({ where }) => clone(rows.find((r) => r.id === where.id) || null),
  update: async ({ where, data }) => clone(Object.assign(rows.find((r) => r.id === where.id), clone(data))),
} } });
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => true, verifyAdminRequest: () => true, unauthorized: () => Response.json({}, { status: 401 }) });
const pushed = [];
mock('@/lib/lineApi', { pushLineText: async (to, text) => { pushed.push({ to, text }); } });
const { buildQuotePrefill } = load('lib/quotePrefill.ts');
const send = load('app/api/admin/quotes/[id]/send/route.ts');
const patch = load('app/api/admin/quotes/[id]/route.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');

let n = 0;
const BUS = { tripDate: '2026-12-01', passengerCount: 40, pickup: '台北', destination: '台中' };
const VAN = { tripDate: '2026-12-01', passengerCount: 6, pickup: '台北車站', destination: '九份' };
function seed(src) {
  const p = buildQuotePrefill({ quoteOptions: [], remark: '無', ...src }, 'line-webhook', new Date('2026-11-11T06:00:00Z'));
  const id = `case-${++n}`;
  rows.push({ id, lineUserId: 'U-mock-customer', quoteStatus: 'new', pickup: src.pickup, destination: src.destination, remark: '無', passengerCount: src.passengerCount, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions });
  return { id, p, meta: p.quoteOptions.autoDraft };
}
const doSend = async (id) => {
  const before = pushed.length;
  const r = await send.POST(new Request('http://x/s', { method: 'POST' }), { params: { id } });
  const j = await r.json();
  return { status: r.status, code: j.code || null, pushed: pushed.length - before };
};
const doSave = async (id, text) => (await patch.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: text, quoteStatus: 'DRAFT' }) }), { params: { id } })).status;
const fleetDraft = async (id) => (await draftRoute.POST(new Request('http://x/d', { method: 'POST', body: JSON.stringify({ rateId: 'taipei-jiufen-10h', hours: 10 }) }), { params: { id } }));

const results = [];
const add = (s) => (b) => `${b}\n${s}`;
const metaOf = (src) => { const { meta } = seed(src); rows.pop(); return meta; };
const busMeta = metaOf(BUS);
const vanMeta = metaOf(VAN);
const ref = busMeta.reference;
const mid = Math.floor(ref.length / 2);
const bar = ref.indexOf('｜');

const CASES = [
  // v1 review: 40 人 台北→台中 manual send
  ['v1', '40 人台北→台中 自動草稿直接送出', BUS, null, 409],
  // v2/v4 group A (9)
  ['A', 'unedited auto draft (bus)', BUS, null, 409],
  ['A', 'whitespace-only save', BUS, (b) => ` ${b.replace(/\n/g, '\n\n')}   `, 409],
  ['A', 'paste all staffLines', BUS, (b, m) => `${b}\n${m.staffLines.join('\n')}`, 409],
  ['A', 'paste staffNote', BUS, (b, m) => `${m.staffNote}\n${b}`, 409],
  ['A', 'staff-typed price NT$18,000 (bus)', BUS, add('報價：NT$18,000（含稅）'), 200],
  ['A', 'fleet draft button then send w/o save', VAN, 'fleet-no-save', 409],
  ['A', 'paste list summary (autoDraft.reference)', BUS, (b, m) => `${b}\n${m.reference}`, 409],
  ['A', 'unedited auto draft (van)', VAN, null, 409],
  ['A', 'paste van fleet summary', VAN, (b, m) => `${b}\n${m.reference}`, 409],
  // v4 group B (required bypasses)
  ['B', 'full-width digits １６，０００～２２，０００', BUS, add('費用約１６，０００～２２，０００'), 409],
  ['B', 'full-width tilde 16,000～22,000', BUS, add('費用 16,000～22,000'), 409],
  ['B', 'wave dash 16,000〜22,000', BUS, add('費用 16,000〜22,000'), 409],
  ['B', 'spaces inside numbers', BUS, add('費用 1 6, 0 0 0 ~ 2 2 , 000'), 409],
  ['B', 'no commas 16000-22000 元', BUS, add('費用 16000-22000 元'), 409],
  ['B', 'bare range only', BUS, add('16,000～22,000'), 409],
  ['B', 'NT$16,000 – NT$22,000', BUS, add('NT$16,000 – NT$22,000'), 409],
  ['B', '約 16000 至 22000', BUS, add('約 16000 至 22000'), 409],
  ['B', '16000 到 22000 元之間', BUS, add('大約 16000 到 22000 元之間'), 409],
  ['B', '1.6萬～2.2萬', BUS, add('約 1.6萬～2.2萬'), 409],
  ['B', '16k-22k', BUS, add('16k-22k'), 409],
  ['B', 'other KB range 24,000～35,000', BUS, add('南部 24,000～35,000'), 409],
  ['B', 'list summary without 參考行情 prefix', BUS, (b, m) => `${b}\n${m.reference.replace(/^參考行情\s*/, '')}`, 409],
  ['B', 'one staffLine (range line)', BUS, (b, m) => `${b}\n${m.staffLines.find((l) => /\d/.test(l))}`, 409],
  ...busMeta.staffLines.map((line, i) => ['B', `staffLine[${i}] alone`, BUS, add(line), 409]),
  ['B', `summary first half: ${ref.slice(0, mid)}`, BUS, add(ref.slice(0, mid)), 409],
  ['B', `summary second half: ${ref.slice(mid)}`, BUS, add(ref.slice(mid)), 409],
  ...(bar > 0 ? [
    ['B', `summary before ｜: ${ref.slice(0, bar)}`, BUS, add(ref.slice(0, bar)), 409],
    ['B', `summary after ｜: ${ref.slice(bar + 1)}`, BUS, add(ref.slice(bar + 1)), 409],
  ] : []),
  ['B', `van fleet summary w/o prefix: ${vanMeta.reference.replace(/^參考行情\s*/, '')}`, VAN, add(vanMeta.reference.replace(/^參考行情\s*/, '')), 409],
  // v4 group C (reworded; value-based matching)
  ...['1萬6～2萬2', '一萬六千至兩萬兩千元', '16000/22000', '16000 或 22000', '最低 16000、最高 22000', '16000起，最多22000', '16,000 ~~ 22,000', '16000~2.2萬']
    .map((s) => ['C', s, BUS, add(s), 409]),
  // v5 extra value-based probes
  ...['兩萬兩千～一萬六千', '16000\n22000', '16000 22000', '低標16000；高標22000', '1萬6千-2萬2千', '16K~22K', '11000、12500', '2萬4～3萬5', '12.5k-15k', '待補']
    .map((s) => ['E', s.replace(/\n/g, '⏎'), BUS, add(s), 409]),
  // v4 group D (legit, must send)
  ['D', 'NT$18,000 bus', BUS, add('報價：NT$18,000（含稅、過路費）'), 200],
  ['D', '九人座 7000 元', VAN, add('九人座賓士 台北一日 7000 元'), 200],
  ['D', 'normal 參考 sentence', BUS, add('行程可參考您提供的路線，報價 NT$18,000。'), 200],
  ['D', 'single amount equal to range low', BUS, add('報價 NT$16,000（含稅）'), 200],
  ['D', 'NT$18,000 full-width', BUS, add('報價 ＮＴ＄１８，０００'), 200],
  ['D', '參考 + vehicle in normal sentence', VAN, add('建議參考九人座方案，費用 7000 元'), 200],
  ['D', 'two staff prices (deposit/total)', BUS, add('總價 NT$18,000，訂金 NT$5,000'), 200],
  // v5: fleet draft button output saved as-is sends without deleting any line
  ['F', 'fleet draft button → save → send (no lines deleted)', VAN, 'fleet-save', 200],
  ['F', 'single amount equal to range high NT$22,000', BUS, add('報價 NT$22,000（含稅）'), 200],
  ['F', 'single amount 兩萬兩千元', BUS, add('報價兩萬兩千元（含稅）'), 200],
];

for (const [group, name, src, mk, expect] of CASES) {
  test(`[${group}] ${name} → ${expect}`, async () => {
    const { id, p, meta } = seed(src);
    let save = null;
    let draftText = null;
    if (mk === 'fleet-no-save' || mk === 'fleet-save') {
      const d = await fleetDraft(id);
      assert.equal(d.status, 200);
      const body = await d.json();
      draftText = body.quote.quoteDraftText;
      assert.equal(/後台報價草稿|尚未送給客人|請人員核對|本按鈕/.test(draftText), false, 'fleet draft body has no internal line');
      assert.ok(body.staffHints.length > 0, 'internal hint is returned for the UI instead');
      if (mk === 'fleet-save') save = await doSave(id, draftText);
    } else if (typeof mk === 'function') {
      save = await doSave(id, mk(p.quoteDraftText, meta));
    }
    const r = await doSend(id);
    results.push({ group, name, expect, save, ...r, ok: r.status === expect });
    assert.equal(r.status, expect, `${name}: got ${r.status} ${r.code}`);
    assert.equal(r.pushed, expect === 200 ? 1 : 0);
  });
}

test('case table written to evidence', () => {
  const out = process.env.QUOTES_CASES_EVIDENCE;
  if (out) require('node:fs').writeFileSync(out, JSON.stringify({ total: results.length, failed: results.filter((r) => !r.ok).length, results }, null, 2));
  assert.equal(results.filter((r) => !r.ok).length, 0);
  assert.ok(results.length >= 50);
});
