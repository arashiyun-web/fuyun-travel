// Offline: year inference for yearless trip dates from created_at (Asia/Taipei), cross-year, leap day, no created_at.
const path = require('path'); const root = process.argv[2]; process.chdir(root);
const { load } = require(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
const { dayTypeOf, yearBaseOf, busDriverFeeLine } = load('lib/quoteRange.ts');
const { buildQuotePrefill } = load('lib/quotePrefill.ts');
const wk = (y, m, d) => '日一二三四五六'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
const C = [
  ['8/7 建 2026-06-25（台北）', '8/7', '2026-06-25T02:00:00Z', '8/7（週五）', 'weekday'],
  ['8/7 建 2026-08-07 00:30 台北（UTC 前一天）', '8/7', '2026-08-06T16:30:00Z', '8/7（週五）', 'weekday'],
  ['8/7 建 2026-08-07 23:59 台北', '8/7', '2026-08-07T15:59:00Z', '8/7（週五）', 'weekday'],
  ['8/7 建 2026-08-08 00:01 台北 → 2027', '8/7', '2026-08-07T16:01:00Z', `8/7（週${wk(2027, 8, 7)}）`, 'holiday'],
  ['12 月建、1 月出發 1/3 → 2027-01-03', '1/3', '2026-12-20T03:00:00Z', `1/3（週${wk(2027, 1, 3)}）`, 'holiday'],
  ['12/31 16:30Z（台北 1/1）→ 12/31 是 2027', '12/31', '2026-12-31T16:30:00Z', `12/31（週${wk(2027, 12, 31)}）`, 'weekday'],
  ['12/31 15:30Z（台北 12/31 23:30）→ 2026', '12/31', '2026-12-31T15:30:00Z', `12/31（週${wk(2026, 12, 31)}）`, 'weekday'],
  ['1月5日 中文寫法 建 2026-12-28', '1月5日', '2026-12-28T03:00:00Z', `1/5（週${wk(2027, 1, 5)}）`, 'weekday'],
  ['閏日 2/29 建 2027-12-01 → 2028-02-29', '2/29', '2027-12-01T03:00:00Z', `2/29（週${wk(2028, 2, 29)}）`, 'weekday'],
  ['閏日 2/29 建 2028-01-10 → 2028-02-29', '2/29', '2028-01-10T03:00:00Z', `2/29（週${wk(2028, 2, 29)}）`, 'weekday'],
  ['閏日 2/29 建 2026-06-25（非閏年）→ 無法判斷', '2/29', '2026-06-25T03:00:00Z', null, null],
  ['完整年份 2026-08-07 不受 created_at 影響', '2026-08-07', '2030-01-01T00:00:00Z', '8/7（週五）', 'weekday'],
];
const rows = C.map(([name, date, created, label, type]) => {
  const d = dayTypeOf(date, yearBaseOf(created));
  return { name, date, created, got: d, ok: (d ? d.label : null) === label && (d ? d.dayType : null) === type };
});
// yearBaseOf fallbacks
const fb = new Date('2026-11-12T00:00:00Z');
const fallbacks = [[null], [undefined], [''], ['not-a-date'], [new Date('x')]].map(([v]) => ({ input: String(v), usesFallback: yearBaseOf(v, fb) === fb }));
// 8/7 bus draft generated from row created 2026-06-25, regenerated "now" 2026-11-12 → fee 2,500 weekday
const src = { tripDate: '8/7', passengerCount: 40, pickup: '台北', destination: '台中', remark: '無行李 來回', createdAt: new Date('2026-06-25T02:00:00Z') };
const p = buildQuotePrefill({ quoteOptions: [], ...src }, 'backfill', new Date('2026-11-12T00:00:00Z'));
const noCreated = buildQuotePrefill({ quoteOptions: [], ...src, createdAt: null }, 'backfill', new Date('2026-11-12T00:00:00Z'));
const out = { cases: rows, fallbacks, feeLine: busDriverFeeLine('8/7', yearBaseOf(src.createdAt)),
  draftWithCreatedAt: p.quoteDraftText.split('\n').filter((l) => /8\/7|司機/.test(l)),
  draftWithoutCreatedAt_now20261112: noCreated.quoteDraftText.split('\n').filter((l) => /8\/7|司機/.test(l)) };
out.summary = { cases: rows.length, ok: rows.filter((r) => r.ok).length, bad: rows.filter((r) => !r.ok).map((r) => `${r.name}: ${JSON.stringify(r.got)}`), fallbacksOk: fallbacks.every((f) => f.usesFallback),
  fee2500: /8\/7（週五）為平日，NT\$2,500/.test(p.quoteDraftText) };
console.log(JSON.stringify(out, null, 2));
