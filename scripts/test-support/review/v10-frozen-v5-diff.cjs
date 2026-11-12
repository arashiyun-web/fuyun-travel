// Differential check: frozen lib/legacyFleetDraftV5.ts legacyV5FleetDraftText (v10) vs the original
// buildFleetQuoteDraft(...).text at e42ac37 (separate worktree), over the full input grid. Pure; no I/O.
const path = require('path');
const [V10, V5] = process.argv.slice(2);
function loadFrom(root, file) {
  const id = require.resolve(path.join(root, 'scripts/test-support/step2-load-ts.cjs'));
  delete require.cache[id];
  for (const k of Object.keys(require.cache)) if (k.includes('/lib/')) delete require.cache[k];
  return require(id).load(file);
}
const frozen = loadFrom(V10, 'lib/legacyFleetDraftV5.ts').legacyV5FleetDraftText;
const original = loadFrom(V5, 'lib/fleetQuoteDraft.ts').buildFleetQuoteDraft;
const hints = ['', '賓士', '九人座', '小車', 'Mercedes', '中巴', 'TOYOTA', '賓士 中巴', '42人座', '遊覽車', '大巴', '四十二人座', '42 座', '九人座 大巴'];
const remarks = ['', '無', '接機 班機 23點', '住宿 過夜', '晚上 22:00', '兒童 安全座椅', '機場 送機 兒童 住宿 凌晨', '一日遊'];
const counts = [null, 0, 1, 5, 8, 9, 10, 15, 20, 21, 42, 3.5, -1];
const hours = [null, 0, 6, 8, 10, 12, 24, 10.5, '10', 'x'];
const rates = [null, 'taipei-day-10h', 'taipei-jiufen-10h', 'bogus', ''];
const places = [['', ''], ['台北', '九份'], [' 板橋 ', '宜蘭'], ['桃園機場', '台北']];
let total = 0, same = 0; const diffs = [];
for (const vehicleHint of hints) for (const remark of remarks) for (const passengerCount of counts) for (const h of hours) for (const rateId of rates) for (const [pickup, destination] of places) {
  const input = { pickup, destination, remark, vehicleHint, passengerCount, hours: h, rateId };
  const a = frozen(input); const b = original(input).text; total++;
  if (a === b) same++; else if (diffs.length < 5) diffs.push({ input, frozen: a, original: b });
}
console.log(JSON.stringify({ total, same, differ: total - same, diffs }, null, 2));
