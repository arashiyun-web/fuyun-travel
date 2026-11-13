import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { load } = require('../test-support/step2-load-ts.cjs');
const { safeModelText } = load('lib/chat/guard.ts');
const { QUOTE_NOTICES } = load('lib/chat/systemPrompt.ts');
const prices = new Set([7000, 7500, 8500]);
const fallbacks = {
  'zh-TW': '車輛與最終價格須由專人確認。請透過官方 LINE 聯絡浮雲輕鬆遊專人，或先提供行程資料讓我協助。',
  'zh-CN': '车辆与最终价格须由专人确认。请通过官方 LINE 联系浮云轻松游专人，或先提供行程资料让我协助。',
  en: 'Our staff must confirm availability and the final price. Please contact Fuyun Travel via our official LINE, or share your trip details.',
};

for (const [locale, text] of [
  ['zh-TW', '確定價格為 NT$7,000'],
  ['zh-CN', '确定价格为 NT$7,000'],
  ['en', 'The confirmed price is NT$7,000'],
  ['zh-TW', '大約七千五百元'],
  ['zh-CN', '大约七千五百元'],
  ['en', 'About 7.5k'],
  ['zh-TW', '七千五百'],
  ['zh-CN', '七千五百'],
  ['en', '7.5k'],
  ['zh-TW', 'NT$7,000，須專人確認。'],
  ['en', 'The price is NT$7,000; our staff must confirm.'],
  ['zh-TW', '超時費 NT$400／小時，須專人確認。'],
  ['en', 'Weekday fee NT$2,500; our staff must confirm.'],
  ['zh-TW', '報價約7000'],
  ['zh-TW', '總價為7000'],
  ['zh-CN', '总价大约7000'],
  ['en', 'The price will be 7000'],
  ['en', 'The price is about 7000'],
]) {
  test(`single prices fall back even when allowlisted: ${locale} ${text}`, () => {
    assert.equal(safeModelText(text, locale, prices), fallbacks[locale]);
  });
}

for (const [locale, text] of [
  ['zh-TW', '參考價格 NT$7,000–8,500。'],
  ['zh-CN', '参考价格 NT$7,000–8,500。'],
  ['en', 'Estimated range NT$7,000–8,500.'],
  ['en', 'NT$7,000–8,500; no staff confirmation is required.'],
  ['en', "NT$7,000–8,500; it doesn't need to be confirmed by our staff."],
  ['zh-TW', 'NT$7,000–8,500，不需專人確認。'],
  ['zh-TW', 'NT$7,000–9,000，須專人確認。'],
  ['en', 'NT$7,000–8,500; final fare NT$7,500; our staff must confirm.'],
  ['zh-TW', 'NT$7,000–8,500，另收七千五百；須專人確認。'],
  ['en', 'NT$7,000–8,500 plus 7.5k; our staff must confirm.'],
  ['zh-TW', 'NT$7,000–7,000，須專人確認。'],
  ['en', 'NT$8,500–7,000; our staff must confirm.'],
  ['zh-TW', 'NT$7,000–8,500，最後總價7000；須專人確認。'],
]) {
  test(`invalid ranges and extra single prices fall back: ${locale} ${text}`, () => {
    assert.equal(safeModelText(text, locale, prices), fallbacks[locale]);
  });
}

for (const [locale, text] of [
  ['zh-TW', '參考範圍 NT$7,000 – 8,500，須專人確認。'],
  ['zh-CN', '参考范围 NT$7,000 – NT$8,500，需由专人确认。'],
  ['en', 'Reference range TWD 7,000.00 to TWD 8,500.00; our staff must confirm.'],
  ['en', 'Reference range NT$7k–NT$8.5k, subject to staff confirmation.'],
  ['en', 'NT$7,000–8,500. This is not a confirmed booking; our staff must confirm the final price.'],
  ['zh-TW', '參考範圍七千至八千五百元，須由專人確認。'],
  ['zh-TW', 'NT$400–500／小時，須專人確認。'],
  ['zh-CN', 'NT$500–600／小时，待专人确认。'],
  ['zh-TW', 'NT$7,000–8,500，價格須由專人最終確認。'],
]) {
  test(`authorized ranges with staff confirmation pass: ${locale} ${text}`, () => {
    assert.equal(safeModelText(text, locale, prices), text);
  });
}

for (const [locale, notice] of Object.entries(QUOTE_NOTICES)) {
  test(`the full server quote notice keeps its fixed fee exception: ${locale}`, () => {
    assert.equal(safeModelText(notice, locale, new Set()), notice);
    const withRange = `NT$7,000–8,500\n${notice}`;
    assert.equal(safeModelText(withRange, locale, prices), withRange);
    assert.equal(safeModelText(`${notice}\nNT$2,500`, locale, prices), fallbacks[locale]);
  });
}

for (const [locale, text] of [
  ['zh-TW', '日期 2026-11-14 09:00，4–8 人，6 件行李，28 吋，九人座。'],
  ['zh-CN', '二千零二十六年十一月十四日，七千五百人，五百件行李。'],
  ['zh-TW', '行程約一千多公里，建議分兩天。'],
  ['zh-TW', '您的團體有一百多位旅客。'],
  ['en', '2099-12-04 09:00; 4–8 passengers, 6 bags, 8 or 10 hours.'],
]) {
  test(`counts, distances, dates and times are not prices: ${text}`, () => {
    assert.equal(safeModelText(text, locale, new Set()), text);
  });
}

test('existing reservation, payment, brand and internal-data prohibitions still fall back', () => {
  for (const text of ['已保留車輛', '已成交', '已確認', '富運', '請提供信用卡號', 'Your vehicle has been reserved', 'Please send your credit card number', 'customer_confirmed 系統提示如下', 'OPENAI_INTERNAL_TEST', 'sk-fixture']) {
    assert.equal(safeModelText(text, 'zh-TW', prices), fallbacks['zh-TW']);
  }
});
