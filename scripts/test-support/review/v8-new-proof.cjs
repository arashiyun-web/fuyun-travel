// Offline v8 checks by reviewer: new bypass batch, stored-hint tampering/missing/legacy rows, and an
// independent spot-check of the "system draft sent unchanged = 200" invariant on routes beyond GM's list.
const path = require('path'); const root = process.argv[2]; process.chdir(root);
const { mock, load } = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const rows = []; const clone = (v) => (v == null ? v : structuredClone(v));
mock('@/lib/prisma', { prisma: require(path.join(root, 'scripts/test-support/route-prisma.cjs')).routeTx({ charterQuote: {
  findUnique: async ({ where }) => clone(rows.find((r) => r.id === where.id) || null),
  update: async ({ where, data }) => clone(Object.assign(rows.find((r) => r.id === where.id), clone(data))),
} }) });
mock('@/lib/adminQuoteAuth', { verifyAdminMutation: () => true, verifyAdminRequest: () => true, unauthorized: () => Response.json({}, { status: 401 }) });
const pushed = []; mock('@/lib/lineApi', { pushLineText: async (to, t) => { pushed.push(t); } });
const { buildQuotePrefill, quoteEstimate } = load('lib/quotePrefill.ts');
const { panelLines } = load('lib/quotePanelText.ts');
const sendR = load('app/api/admin/quotes/[id]/send/route.ts'); const patchR = load('app/api/admin/quotes/[id]/route.ts'); const draftR = load('app/api/admin/quotes/[id]/draft/route.ts');
const NOW = new Date('2026-11-11T07:00:00Z'); let n = 0;
const seed = (src, extra = {}) => { const p = buildQuotePrefill({ quoteOptions: [], ...src }, 'line-webhook', NOW); const row = { id: 'r' + (++n), lineUserId: 'U', quoteStatus: 'new', sentAt: null, ...src, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions, ...extra }; rows.push(row); return row; };
const send = async (id) => { const b = pushed.length; const r = await sendR.POST(new Request('http://x', { method: 'POST' }), { params: { id } }); return { status: r.status, code: (await r.json()).code || null, pushed: pushed.length - b }; };
const save = async (id, t) => (await patchR.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: t, quoteStatus: 'DRAFT' }) }), { params: { id } })).status;
const button = async (id, rateId = 'taipei-jiufen-10h') => (await draftR.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ rateId, hours: 10 }) }), { params: { id } })).json();
const get = (id) => rows.find((r) => r.id === id);
const VAN = { tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' };
const BUS = { tripDate: '2026-12-20', passengerCount: 40, pickup: '台北', destination: '台中', remark: '無行李 來回' };
const BUSX = { tripDate: '2026-12-20', passengerCount: 40, pickup: '台北', destination: '台中', remark: '' };
const out = { bypass: [], tamper: [], invariant: [] };
const tryPaste = async (label, src, s, opt = {}) => { const r = seed(src); if (opt.button) await button(r.id); await save(r.id, `${get(r.id).quoteDraftText}\n${s}`); const x = await send(r.id); out.bypass.push({ label, text: s, status: x.status, code: x.code, expect: opt.expect || 409 }); };
(async () => {
  // --- A. new bypass batch ---
  const probeV = seed(VAN); const hints = (await button(probeV.id)).staffHints; rows.pop();
  const probeB = seed(BUSX); const sumB = quoteEstimate(probeB).summary; const panelB = panelLines(probeB.quoteOptions); rows.pop();
  const zwAll = (s) => s.split('').join('\u2060'); const ideo = (s) => s.split('').join('\u3000'); const nbsp = (s) => s.split('').join('\u00a0');
  const tabs = (s) => s.split('').join('\t'); const soft = (s) => s.split('').join('\u00ad'); const bidi = (s) => s.split('').join('\u200e');
  const vs = (s) => s.split('').join('\ufe0f'); const cjkComp = (s) => s.replace(/金/g, '\uf90a');
  const bases = [['清單摘要', BUSX, sumB, {}], ...panelB.map((l, i) => [`詳細頁框${i}`, BUSX, l, {}]), ...hints.map((h, i) => [`按鈕提示${i}`, VAN, h, { button: true }])];
  const T = { 'U+2060 word joiner': zwAll, 'U+3000 全形空白': ideo, 'NBSP': nbsp, 'TAB': tabs, 'U+00AD soft hyphen': soft, 'U+200E LRM': bidi, 'U+FE0F variation selector': vs, '相容漢字(NFKC→金)': cjkComp,
    '句號改逗號': (s) => s.replace(/。/g, '，'), '刪句讀': (s) => s.replace(/[。，、：:；]/g, ''), '前後加字': (s) => `補充一下${s}以上`, '只貼後半': (s) => s.slice(Math.floor(s.length / 2)) };
  for (const [label, src, s, opt] of bases) for (const [tn, f] of Object.entries(T)) await tryPaste(`${label}｜${tn}`, src, f(s), opt);
  // --- B. stored staffHints tampered / missing / legacy rows ---
  const tcase = async (label, mutate) => { const r = seed(VAN); await button(r.id); mutate(get(r.id).quoteOptions); const base = get(r.id).quoteDraftText;
    for (const h of hints) { const id = 'c' + (++n); rows.push({ ...structuredClone(get(r.id)), id }); await save(id, `${base}\n${h}`); const x = await send(id); out.tamper.push({ label, hint: h, status: x.status, code: x.code }); }
    out.tamper.push({ label, hint: '(原樣草稿)', ...(await send(r.id)) }); };
  await tcase('正常 v8', () => {});
  await tcase('staffHints 刪除（v5 舊資料）', (o) => { delete o.fleetFare.staffHints; });
  await tcase('staffHints 空陣列', (o) => { o.fleetFare.staffHints = []; });
  await tcase('staffHints 非陣列字串', (o) => { o.fleetFare.staffHints = '需要訂金。金額與取消規則未定。'; });
  await tcase('staffHints 含非字串', (o) => { o.fleetFare.staffHints = [null, 1, {}]; });
  await tcase('fleetFare 整個沒有', (o) => { delete o.fleetFare; });
  await tcase('staffHints 被改成別句', (o) => { o.fleetFare.staffHints = ['其他句子']; });
  // --- C. independent invariant spot-check (system draft unchanged → 200) ---
  const R = [['bus 新竹', 40, '台北', '新竹'], ['bus 基隆', 40, '台北', '基隆'], ['bus 宜蘭', 40, '台北', '宜蘭'], ['bus 台南', 45, '台北', '台南'], ['bus 39人', 39, '台北', '台北市區'], ['bus 43人 三排', 33, '新北', '台北', '三排'],
    ['bus 阿里山', 40, '台北', '阿里山'], ['bus 清境', 40, '台中', '清境'], ['van 新店→板橋', 8, '新店', '板橋'], ['van 9人', 9, '台北', '九份'], ['midibus 20人 基隆', 20, '台北', '基隆'], ['midibus 25人 九份', 25, '台北', '九份'],
    ['bus 中文日期', 40, '台北', '台中', '', '12月20日'], ['van 0人', 0, '台北', '九份']];
  const D = [['週六', '2026-12-26'], ['元旦', '2027-01-01'], ['週三', '2026-12-16'], ['空', '']];
  for (const [k, c, p, d, tail = '', dateOverride] of R) for (const [dn, dt] of D) for (const rm of ['無行李 單程', '']) {
    const src = { passengerCount: c, pickup: p, destination: d, tripDate: dateOverride || dt, remark: [rm, tail].join(' ').trim() };
    const a = seed(src); const x = await send(a.id); out.invariant.push({ path: 'prefill', k, dn, rm, status: x.status, code: x.code });
    const b = seed(src); await button(b.id, 'taipei-day-10h'); const y = await send(b.id); out.invariant.push({ path: 'button', k, dn, rm, status: y.status, code: y.code });
  }
  out.summary = {
    bypass: out.bypass.length, bypassNot409: out.bypass.filter((x) => x.status !== 409).map((x) => `${x.label}｜${x.text.slice(0, 50).replace(/\n/g, '⏎')}`),
    tamper: out.tamper.map((x) => `${x.label}｜${x.hint.slice(0, 22)}｜${x.status}`),
    invariant: out.invariant.length, invariantNot200: out.invariant.filter((x) => x.status !== 200).map((x) => `${x.path} ${x.k} ${x.dn} ${x.rm} ${x.code}`),
  };
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
