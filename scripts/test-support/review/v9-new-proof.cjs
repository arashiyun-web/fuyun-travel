// Offline v9 checks: new bypass batch (other Cf, combining marks, NFKC compatibility chars, full/half punctuation)
// and false-block checks for customer text with emoji (ZWJ / VS16 / keycap / skin tone) and combining characters.
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
const seed = (src) => { const p = buildQuotePrefill({ quoteOptions: [], ...src }, 'line-webhook', NOW); const row = { id: 'r' + (++n), lineUserId: 'U', quoteStatus: 'new', sentAt: null, ...src, recommendedVehicle: p.recommendedVehicle, quoteDraftText: p.quoteDraftText, quoteOptions: p.quoteOptions }; rows.push(row); return row; };
const send = async (id) => { const r = await sendR.POST(new Request('http://x', { method: 'POST' }), { params: { id } }); return { status: r.status, code: (await r.json()).code || null }; };
const save = async (id, t) => (await patchR.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ quoteDraftText: t, quoteStatus: 'new' }) }), { params: { id } })).status;
const button = async (id) => (await draftR.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ rateId: 'taipei-jiufen-10h', hours: 10 }) }), { params: { id } })).json();
const get = (id) => rows.find((r) => r.id === id);
const VAN = { tripDate: '2026-12-20', passengerCount: 6, pickup: '台北車站', destination: '九份', remark: '無行李 來回' };
const BUS = { tripDate: '2026-12-20', passengerCount: 40, pickup: '台北', destination: '台中', remark: '無行李 來回' };
const BUSX = { tripDate: '2026-12-20', passengerCount: 40, pickup: '台北', destination: '台中', remark: '' };
const out = { bypass: [], legit: [] };
const paste = async (bucket, label, src, s, opt = {}) => { const r = seed(src); if (opt.button) await button(r.id); await save(r.id, `${get(r.id).quoteDraftText}\n${s}`); const x = await send(r.id); out[bucket].push({ label, text: s, status: x.status, code: x.code }); };
const inter = (ch) => (s) => Array.from(s).join(ch);
(async () => {
  const pv = seed(VAN); const hints = (await button(pv.id)).staffHints; rows.pop();
  const pb = seed(BUSX); const sum = quoteEstimate(pb).summary; const panel = panelLines(pb.quoteOptions); rows.pop();
  const bases = [['清單摘要', BUSX, sum, {}], ['詳細頁框1', BUSX, panel[1], {}], ['詳細頁框4', BUSX, panel[4], {}], ...hints.map((h, i) => [`按鈕提示${i}`, VAN, h, { button: true }]),
    ['標記 參考行情', BUS, '參考行情', {}], ['標記 內部核定', BUS, '內部核定', {}], ['標記 待專人報價', BUS, '待專人報價', {}]];
  const T = {
    'U+061C ALM': inter('\u061c'), 'U+180E MVS': inter('\u180e'), 'U+2061 函數應用': inter('\u2061'), 'U+2063 不可見分隔': inter('\u2063'), 'U+206A–206F 舊格式': inter('\u206b'),
    'U+202E RLO 包住': (s) => `\u202e${s}\u202c`, 'U+2066 LRI 包住': (s) => `\u2066${s}\u2069`, 'U+E0020 tag 字元': inter('\u{e0020}'), 'U+E0100 異體選擇符補充': inter('\u{e0100}'), 'U+034F CGJ': inter('\u034f'),
    'U+3164 韓文填充': inter('\u3164'), 'U+2800 點字空白': inter('\u2800'), 'U+115F 韓文填充': inter('\u115f'), 'U+FFA0 半形韓文填充': inter('\uffa0'),
    '組合 U+0301 尖音': inter('\u0301'), '組合 U+0332 底線': inter('\u0332'), '組合 U+20DD 圈': inter('\u20dd'), '組合 U+3099 濁點': inter('\u3099'), '組合 U+0336 刪除線': inter('\u0336'),
    'NFKC 康熙部首（人→⼈ 等）': (s) => s.replace(/人/g, '\u2f08').replace(/金/g, '\u2fa6').replace(/行/g, '\u2f8f'), 'NFKC 相容漢字': (s) => s.replace(/金/g, '\uf90a').replace(/行/g, '\ufa08'),
    'NFKC 圈數字/全形數字': (s) => s.replace(/1/g, '\uff11').replace(/0/g, '\uff10'), 'NFKC 上標數字': (s) => s.replace(/2/g, '\u00b2'),
    '全形→半形標點': (s) => s.replace(/，/g, ',').replace(/。/g, '.').replace(/：/g, ':').replace(/｜/g, '|').replace(/（/g, '(').replace(/）/g, ')'),
    '半形→全形標點': (s) => s.replace(/,/g, '，').replace(/:/g, '：').replace(/\|/g, '｜').replace(/\(/g, '（').replace(/\)/g, '）'),
    '標點改其他符號': (s) => s.replace(/[，。、：:｜|]/g, '・'), '標點全刪': (s) => s.replace(/[\p{P}\p{S}]/gu, ''),
    '組合：全形空白＋LRM＋標點改': (s) => Array.from(s.replace(/[，。]/g, '、')).join('\u3000\u200e'),
  };
  for (const [label, src, s, opt] of bases) for (const [tn, f] of Object.entries(T)) await paste('bypass', `${label}｜${tn}`, src, f(s), opt);
  // false-block: customer wording with emoji / combining chars, on complete bus + van rows
  const L = ['謝謝您的詢問 🙏😊', '全家出遊 👨‍👩‍👧‍👦 祝旅途愉快 ❤️', '行程確認 ✅ 出發前一天再聯繫 ☎️', '1️⃣ 台北出發 2️⃣ 台中 3️⃣ 鹿港', '👍🏻👍🏽 司機很準時', '🏳️‍🌈 🇹🇼 歡迎搭乘',
    'Café 與 Pokémon（組合字 e\u0301）', 'ｶﾞｲﾄﾞ 半形片假名、ガイド（か+\u3099）', '韓國客人 김민준 님 환영합니다', 'Nguyễn Văn An 越南文', '費用約 NT$16,000～22,000 ✨ 實際由專人確認 🙂',
    '金額與取消規則請參考附件 📎', '需要訂金嗎？由專人說明 💬', '感謝 🙇‍♀️🙇‍♂️ 我們會盡快回覆', '早鳥優惠 🎉🎊 名額有限'];
  for (const s of L) for (const [k, src] of [['bus台中完整', BUS], ['van九份', VAN]]) await paste('legit', `${k}`, src, s);
  out.summary = { bypass: out.bypass.length, bypassNot409: out.bypass.filter((x) => x.status !== 409).map((x) => `${x.label}｜${x.text.slice(0, 40)}`),
    legit: out.legit.length, legitNot200: out.legit.filter((x) => x.status !== 200).map((x) => `${x.label}｜${x.text}｜${x.code}`) };
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
