// Offline v7 extra point-7 checks: new bypass variants (full-width, spaces, newlines, zero-width,
// comma/number variants, partial pastes), fleet-button hints, and false blocks on complete rows.
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
const { panelLines } = load('lib/quotePanelText.ts');
const send = load('app/api/admin/quotes/[id]/send/route.ts');
const patch = load('app/api/admin/quotes/[id]/route.ts');
const draftRoute = load('app/api/admin/quotes/[id]/draft/route.ts');
let n = 0;
const SRC = {
  bus台中完整: { tripDate: '2026-12-20', passengerCount: 40, pickup: '台北', destination: '台中', remark: '行李每人一件28吋 來回' },
  bus市區完整: { tripDate: '2026-12-18', passengerCount: 40, pickup: '台北', destination: '台北市區', remark: '無行李 單程' },
  bus南部完整: { tripDate: '2026-12-20', passengerCount: 40, pickup: '板橋', destination: '高雄', remark: '無行李 來回' },
  bus花蓮: { tripDate: '2026-12-20', passengerCount: 42, pickup: '樹林', destination: '花蓮', remark: '無行李 單程' },
  van雙北: { tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '台北101', remark: '無行李 來回' },
  van九份: { tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' },
  中巴淡水: { tripDate: '2026-12-20', passengerCount: 15, pickup: '板橋', destination: '淡水', remark: '無行李 單程' },
};
function seed(key) { const src = SRC[key]; const p = buildQuotePrefill({ quoteOptions: [], ...src }, 'line-webhook', new Date('2026-11-11T07:00:00Z')); const id = 'q' + (++n);
  rows.push({ id, lineUserId: 'U-mock', quoteStatus: 'new', pickup: src.pickup, destination: src.destination, remark: src.remark, passengerCount: src.passengerCount, tripDate: src.tripDate, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions }); return { id, p, meta: p.quoteOptions.autoDraft, row: rows[rows.length - 1] }; }
const doSend = async (id) => { const b = pushed.length; const r = await send.POST(new Request('http://x/s', { method: 'POST' }), { params: { id } }); const j = await r.json(); return { status: r.status, code: j.code || null, pushed: pushed.length - b }; };
const doSave = async (id, t) => (await patch.PATCH(new Request('http://x/p', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: t, quoteStatus: 'DRAFT' }) }), { params: { id } })).status;
const out = { completeRowsUnedited: [], bypass: [], legit: [] };
const fw = (s) => s.replace(/[0-9A-Za-z$,:|]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
const variants = (s) => ({
  原樣: s, 全形: fw(s), 字間空白: s.split('').join(' '), 換行切開: s.replace(/(.{3})/g, '$1\n'), 零寬字元: s.split('').join('\u200b'),
  去逗號: s.replace(/,/g, ''), 逗號改全形句點: s.replace(/,/g, '．'), 前後加字: `請參考：${s}，謝謝`, 去前綴: s.replace(/^參考行情[｜:：\s]*/, ''),
});
(async () => {
  // A. complete rows: unedited auto draft must be sendable (range allowed; no false block)
  for (const key of Object.keys(SRC)) { const { id, p, meta } = seed(key); const r = await doSend(id); out.completeRowsUnedited.push({ key, status: r.status, code: r.code, reference: meta.reference, rangeLine: (p.quoteDraftText.match(/初步行情：.*/) || [''])[0] }); }
  // B. bypass: every admin string shown for the row × 9 variants (expect 409)
  for (const key of Object.keys(SRC)) {
    const probe = seed(key); rows.pop();
    const strings = new Map();
    const est = quoteEstimate(probe.row); if (est.summary) strings.set('清單摘要', est.summary);
    (est.references || []).forEach((r, i) => strings.set(`清單車隊表參考${i}`, `參考行情 車隊表 ${r}`));
    (panelLines(probe.row.quoteOptions) || []).forEach((l, i) => strings.set(`詳細頁內部框${i}`, l));
    for (const [label, s] of strings) for (const [vn, v] of Object.entries(variants(s))) {
      const { id, p } = seed(key); await doSave(id, `${p.quoteDraftText}\n${v}`); const r = await doSend(id);
      out.bypass.push({ key, label, variant: vn, text: v.slice(0, 90), status: r.status, code: r.code, ok: r.status === 409 });
    }
  }
  // C. fleet button hints pasted (after pressing 依已核對車資產生草稿) × variants
  { const { meta } = seed('van九份'); rows.pop();
    const { id: id0 } = seed('van九份'); const d = await (await draftRoute.POST(new Request('http://x/d', { method: 'POST', body: JSON.stringify({ rateId: 'taipei-jiufen-10h', hours: 10 }) }), { params: { id: id0 } })).json();
    out.fleetButtonSendAsIs = await doSend(id0);
    for (const [i, h] of d.staffHints.entries()) for (const [vn, v] of Object.entries(variants(h))) {
      const { id } = seed('van九份'); await draftRoute.POST(new Request('http://x/d', { method: 'POST', body: JSON.stringify({ rateId: 'taipei-jiufen-10h', hours: 10 }) }), { params: { id } });
      const base = rows.find((r) => r.id === id).quoteDraftText; await doSave(id, `${base}\n${v}`); const r = await doSend(id);
      out.bypass.push({ key: 'van九份 按鈕後', label: `staffHints[${i}]`, variant: vn, text: v.slice(0, 90), status: r.status, code: r.code, ok: r.status === 409 });
    } }
  // D. legit (expect 200)
  for (const s of ['初步行情：台北到台中來回 NT$16,000～22,000', '費用約 NT$16,000～22,000，實際金額由專人確認', '報價 NT$18,000（含稅）', '建議參考九人座方案，費用 7000 元', '司機服務費另計：平日 NT$2,500、假日 NT$3,500', '參考您的需求，建議 43 座大巴', '這段路線由專人報價，請稍候'])
    for (const key of ['bus台中完整', 'van九份']) { const { id, p } = seed(key); await doSave(id, `${p.quoteDraftText}\n${s}`); const r = await doSend(id); out.legit.push({ key, text: s, status: r.status, code: r.code, ok: r.status === 200 }); }
  out.summary = {
    completeRowsUneditedNot200: out.completeRowsUnedited.filter((x) => x.status !== 200).map((x) => `${x.key} ${x.status} ${x.code}`),
    bypassCases: out.bypass.length, bypassBlocked: out.bypass.filter((x) => x.ok).length,
    bypassLeaks: out.bypass.filter((x) => !x.ok).map((x) => `${x.key}｜${x.label}｜${x.variant}｜${x.text}`),
    legitCases: out.legit.length, legitFalseBlocks: out.legit.filter((x) => !x.ok).map((x) => `${x.key}｜${x.text}｜${x.code}`),
    fleetButtonSendAsIs: out.fleetButtonSendAsIs,
  };
  console.log(JSON.stringify(out, null, 2));
})();
