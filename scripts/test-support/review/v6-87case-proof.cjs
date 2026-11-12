// Offline v6 point-7 proof. Mocks Prisma, admin auth and LINE push; runs real prefill, PATCH save,
// fleet draft route, send route and send guard. Records 409/200 per case.
const path = require('path');
const root = process.argv[2]; process.chdir(root);
const { mock, load } = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const rows = []; const clone = (v) => (v == null ? v : structuredClone(v));
mock('@/lib/prisma', { prisma: require(path.join(root, 'scripts/test-support/route-prisma.cjs')).routeTx({ charterQuote: {
  findUnique: async ({ where }) => clone(rows.find((r) => r.id === where.id) || null),
  update: async ({ where, data }) => clone(Object.assign(rows.find((r) => r.id === where.id), clone(data))),
} }) });
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => true, verifyAdminRequest: () => true, unauthorized: () => Response.json({}, { status: 401 }) });
const pushed = []; mock('@/lib/lineApi', { pushLineText: async (to, text) => { pushed.push(text); } });
const { buildQuotePrefill, quoteEstimate } = load('lib/quotePrefill.ts');
const send = load('app/api/admin/quotes/[id]/send/route.ts');
const patch = load('app/api/admin/quotes/[id]/route.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');
const INTERNAL = /參考行情|自動預生成|待補|知識庫|pricing_matrix|quote_rules|後台報價草稿|內部|待人工|行情表未涵蓋|車隊表參考|客人範圍|staff/i;
let n = 0;
const SRC = {
  bus台中: { tripDate: '2026-12-20', passengerCount: 40, pickup: '台北', destination: '台中', remark: '每人一件28吋 來回' },
  bus市區缺欄: { tripDate: '', passengerCount: 40, pickup: '台北', destination: '台北市區', remark: '無' },
  bus花蓮: { tripDate: '2026-12-20', passengerCount: 42, pickup: '樹林', destination: '花蓮', remark: '無行李 單程' },
  bus環島: { tripDate: '2026-12-01', passengerCount: 30, pickup: '台北', destination: '一日環島', remark: '無' },
  van九份: { tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' },
  中巴淡水: { tripDate: '2026-12-20', passengerCount: 15, pickup: '板橋', destination: '淡水', remark: '無' },
};
function seed(key) { const src = SRC[key]; const p = buildQuotePrefill({ quoteOptions: [], ...src }, 'line-webhook', new Date('2026-11-11T07:00:00Z')); const id = 'q' + (++n);
  rows.push({ id, lineUserId: 'U-mock', quoteStatus: 'new', pickup: src.pickup, destination: src.destination, remark: src.remark, passengerCount: src.passengerCount, tripDate: src.tripDate, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions }); return { id, p, meta: p.quoteOptions.autoDraft, row: rows[rows.length - 1] }; }
const doSend = async (id) => { const b = pushed.length; const r = await send.POST(new Request('http://x/s', { method: 'POST' }), { params: { id } }); const j = await r.json(); return { status: r.status, code: j.code || null, pushed: pushed.length - b, pushedText: pushed.length > b ? pushed[pushed.length - 1] : null }; };
const doSave = async (id, t) => (await patch.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: t, quoteStatus: 'DRAFT' }) }), { params: { id } })).status;
const out = { autoDrafts: [], cases: [] };
(async () => {
  // 1. auto drafts: content, internal words, and send unedited (now allowed by design)
  for (const key of Object.keys(SRC)) { const { id, p, meta, row } = seed(key); const r = await doSend(id);
    out.autoDrafts.push({ key, internalInText: INTERNAL.test(p.quoteDraftText), sendUnedited: { status: r.status, code: r.code, pushedInternal: r.pushedText ? INTERNAL.test(r.pushedText) : null }, text: p.quoteDraftText, reference: meta.reference, estimateSummary: quoteEstimate(row).summary, staffLines: meta.staffLines, staffNote: meta.staffNote }); }
  // 2. copy/paste of internal strings into the text (expect 409) and range-only (expect 200)
  const trial = async (key, name, mk, expect) => { const { id, p, meta, row } = seed(key); const t = mk(p.quoteDraftText, meta, row); const save = await doSave(id, t); const r = await doSend(id);
    out.cases.push({ key, name, expect, save, status: r.status, code: r.code, ok: r.status === expect, appended: t.slice(p.quoteDraftText.length).trim().slice(0, 120), pushedInternal: r.pushedText ? INTERNAL.test(r.pushedText) : null }); };
  for (const key of Object.keys(SRC)) {
    await trial(key, 'staffNote', (b, m) => `${b}\n${m.staffNote}`, 409);
    await trial(key, 'staffNote 去「參考行情｜」前綴', (b, m) => `${b}\n${m.staffNote.replace(/^參考行情｜/, '')}`, 409);
    const { meta: m0, row: r0 } = seed(key); rows.pop();
    for (const [i, line] of m0.staffLines.entries()) {
      await trial(key, `staffLines[${i}]`, (b) => `${b}\n${line}`, 409);
      await trial(key, `staffLines[${i}] 去前綴`, (b) => `${b}\n${line.replace(/^參考行情[｜\s]*/, '')}`, 409);
    }
    if (m0.reference) { await trial(key, 'autoDraft.reference', (b) => `${b}\n${m0.reference}`, 409); await trial(key, 'autoDraft.reference 去前綴', (b) => `${b}\n${m0.reference.replace(/^參考行情[：:｜\s]*/, '')}`, 409); }
    const est = quoteEstimate(r0).summary;
    if (est) { await trial(key, `清單摘要 estimate.summary: ${est}`, (b) => `${b}\n${est}`, 409); await trial(key, '清單摘要 去前綴', (b) => `${b}\n${est.replace(/^參考行情[：:｜\s]*/, '')}`, 409); }
  }
  // 3. legit: range prices and normal quotes (expect 200)
  for (const s of ['初步行情：台北到台中來回 NT$16,000～22,000', '約 1.6萬～2.2萬，實際金額由專人確認', '報價 NT$18,000（含稅）', '建議參考九人座方案，費用 7000 元', '司機服務費另計：平日 NT$2,500、假日 NT$3,500'])
    await trial('bus台中', `legit: ${s}`, (b) => `${b}\n${s}`, 200);
  // 4. fleet draft button: text clean, single fixed price only in staffHints
  { const { id } = seed('van九份'); const d = await (await draftRoute.POST(new Request('http://x/d', { method: 'POST', body: JSON.stringify({ rateId: 'taipei-jiufen-10h', hours: 10 }) }), { params: { id } })).json();
    const r = await doSend(id); out.fleetButton = { text: d.quote.quoteDraftText, internalInText: INTERNAL.test(d.quote.quoteDraftText), single7000InText: /7,?000\s*元/.test(d.quote.quoteDraftText), staffHints: d.staffHints, send: { status: r.status, code: r.code } }; }
  out.summary = { cases: out.cases.length, asExpected: out.cases.filter((c) => c.ok).length, unexpected: out.cases.filter((c) => !c.ok).map((c) => `${c.key}｜${c.name}｜${c.status}`) };
  console.log(JSON.stringify(out, null, 2));
})();
