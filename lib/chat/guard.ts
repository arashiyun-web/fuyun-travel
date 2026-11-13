import type { UIMessage } from 'ai';
import type { ChatBooking, ChatLocale } from './schema';
import { QUOTE_NOTICES } from './systemPrompt';
export function replyLocale(text: string, fallback: ChatLocale): ChatLocale {
  if (/[请车价认这为预费络联单较辆]/.test(text)) return 'zh-CN';
  if (/[請車價認這為預費絡聯單較輛]/.test(text)) return 'zh-TW';
  if (!/[\u3400-\u9fff]/.test(text) && /[a-z]{2}/i.test(text)) return 'en';
  return fallback;
}
const textOf = (message?: UIMessage) => message?.parts.filter(p => p.type === 'text').map(p => p.text).join('') || '';
export const isConfirmation = (text: string) => /^(?:我確認|我确认|確認|确认|確認預訂|确认预订|我確認以上訂單|我确认以上订单|I confirm|I confirm the booking|Confirm booking|Yes, I confirm)[。.!！\s]*$/i.test(text.trim());
export function customerConfirmed(messages: UIMessage[], input: ChatBooking) {
  if (!isConfirmation(textOf(messages.at(-1)))) return false;
  const summary = textOf(messages.slice(0, -1).findLast(m => m.role === 'assistant'));
  return [input.contact_name, input.contact_id || input.phone, input.contact_channel, input.trip.pickup, input.trip.destination,
    input.trip.date, input.time, String(input.trip.passenger_count), String(input.luggage_count)].every(value => value && summary.includes(value));
}
const fallback = {
  'zh-TW': '車輛與最終價格須由專人確認。請透過官方 LINE 聯絡浮雲輕鬆遊專人，或先提供行程資料讓我協助。',
  'zh-CN': '车辆与最终价格须由专人确认。请通过官方 LINE 联系浮云轻松游专人，或先提供行程资料让我协助。',
  en: 'Our staff must confirm availability and the final price. Please contact Fuyun Travel via our official LINE, or share your trip details.',
};

const currency = '(?:NT\\$|TWD|NTD|新台[幣币]|台[幣币]|\\$)';
const moneyLabel = `(?:${currency}|價格|价格|報價|报价|單價|单价|總價|总价|價錢|价钱|費用|费用|總額|总额|\\b(?:price|fare|cost|fee))`;
const amountModifier = '(?:[:：=]|是|為|为|大約|大约|約|约|大概|預估|预估|估計|估计|落在|介於|介于|will\\s+be|would\\s+be|is|about|around|approximately|roughly|estimated\\s+at|from|between)';
const moneyBefore = new RegExp(`${moneyLabel}\\s*(?:${amountModifier}\\s*)*(?:${currency})?\\s*$`, 'i');
const moneyAfter = new RegExp(`^\\s*(?:元|${currency})`, 'i');
const rangeBetween = new RegExp(`^\\s*(?:元|${currency})?\\s*(?:[-–—～~]|至|到|to)\\s*(?:${currency})?\\s*$`, 'i');
const countAfter = /^\s*(?:多|餘|余|左右|以上|以下)?\s*(?:人|位|件|輛|辆|台|座|年|月|日|天|小時|小时|分鐘|分钟|秒|公里|公尺|公分|米|吋|寸|passengers?\b|people\b|guests?\b|adults?\b|children\b|bags?\b|hours?\b|minutes?\b|days?\b|km\b|kg\b)/i;

function amountValue(raw: string) {
  if (/^\d/.test(raw)) return Number(raw.replace(/[,k]/gi, '')) * (/k$/i.test(raw) ? 1000 : 1);
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 萬: 10000, 万: 10000, 億: 100000000, 亿: 100000000 };
  const [whole, fraction = ''] = raw.split(/[點点]/);
  let total = 0, section = 0, digit = 0;
  for (const char of whole) {
    if (char in digits) digit = digits[char];
    else if (units[char] < 10000) { section += (digit || 1) * units[char]; digit = 0; }
    else { total += (section + digit || 1) * units[char]; section = 0; digit = 0; }
  }
  return total + section + digit + (fraction ? Number(`0.${Array.from(fraction, char => digits[char]).join('')}`) : 0);
}

function staffMustConfirm(text: string) {
  if (/(?:不需|不須|不须|無須|无需|無需|不必|不用).{0,8}(?:專人|专人|人工|客服).{0,8}確認|(?:不需|不须|无需|不必|不用).{0,8}(?:专人|人工|客服).{0,8}确认|(?:no|without).{0,20}(?:staff|human|team).{0,20}confirmation|(?:not|never|doesn't|don't).{0,20}(?:need|require)/i.test(text)) return false;
  return /(?:須|需|待|由|须)(?:由|經|经)?(?:專人|专人|人工|客服)(?:再|進一步|进一步|最終|最终|最後|最后)?(?:確認|确认)|(?:staff|team|human)\s+(?:must|will|needs? to|have to)\s+confirm|(?:must|needs? to|has to|will)\s+be\s+confirmed\s+by\s+(?:our\s+)?(?:staff|team|human)|(?:subject to|pending|requires?)\s+(?:our\s+)?(?:staff|team|human)\s+confirmation/i.test(text);
}

function safePrices(text: string, prices: Set<number>) {
  // Only the complete server notice may state the fixed driver fees. Extra amounts
  // outside it still go through the same range and authorization checks.
  let remainder = text;
  for (const notice of Object.values(QUOTE_NOTICES)) remainder = remainder.split(notice).join(' ');
  const amounts = Array.from(remainder.matchAll(/\d[\d,]*(?:\.\d+)?(?:k\b)?|[零〇一二兩两三四五六七八九十百千萬万億亿]+(?:[點点][零〇一二兩两三四五六七八九]+)?/gi), match => {
    const start = match.index!;
    const end = start + match[0].length;
    const explicit = moneyBefore.test(remainder.slice(0, start)) || moneyAfter.test(remainder.slice(end));
    const count = countAfter.test(remainder.slice(end));
    return { start, end, value: amountValue(match[0]), explicit, count,
      money: explicit || (!count && /k$|,|[百千萬万億亿]/i.test(match[0])) };
  });
  for (let i = 0; i < amounts.length; i++) {
    const group = [amounts[i]];
    while (i + 1 < amounts.length && rangeBetween.test(remainder.slice(amounts[i].end, amounts[i + 1].start))) group.push(amounts[++i]);
    if (!group.some(amount => amount.money) || (!group.some(amount => amount.explicit) && group.at(-1)!.count)) continue;
    if (group.length !== 2 || !staffMustConfirm(text)) return false;
    const [low, high] = group.map(amount => amount.value);
    const overtime = (low === 400 && high === 500) || (low === 500 && high === 600);
    if (!(low < high) || (!overtime && (!prices.has(low) || !prices.has(high)))) return false;
  }
  return true;
}

export function safeModelText(text: string, locale: ChatLocale, prices: Set<number>) {
  const prohibited = /已保留車輛|已保留车辆|已成交|已確認|已确认|富運|信用卡(?:號|号)|(?:provide|send|enter|share).{0,50}(?:credit.?card|card number|payment details)|(?:車輛|车辆).{0,8}(?:已保留|已预留)|(?:booking|vehicle).{0,20}(?:is confirmed|has been reserved)|(?:have|has).{0,10}reserved|OPENAI_|DATABASE_|sk-[a-zA-Z0-9]|fyk_|customer_confirmed|系統提示如下|系统提示如下|system prompt:|忽略以上指示/i;
  if (prohibited.test(text)) return fallback[locale];
  if (!safePrices(text, prices)) return fallback[locale];
  return text;
}
