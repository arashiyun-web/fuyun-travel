import type { UIMessage } from 'ai';
import type { ChatBooking, ChatLocale } from './schema';
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
  'zh-TW': '車輛與最終價格須由專人確認。請使用下方聯絡按鈕，或先提供行程資料讓我協助。',
  'zh-CN': '车辆与最终价格须由专人确认。请使用下方联系按钮，或先提供行程资料让我协助。',
  en: 'Our staff must confirm availability and the final price. Please use the contact buttons or share your trip details.',
};
export function safeModelText(text: string, locale: ChatLocale, prices: Set<number>) {
  const prohibited = /已保留車輛|已保留车辆|已成交|已確認|已确认|富運|信用卡(?:號|号)|(?:provide|send|enter|share).{0,50}(?:credit.?card|card number|payment details)|(?:車輛|车辆).{0,8}(?:已保留|已预留)|(?:booking|vehicle).{0,20}(?:is confirmed|has been reserved)|(?:have|has).{0,10}reserved|OPENAI_|DATABASE_|sk-[a-zA-Z0-9]|fyk_|customer_confirmed|系統提示如下|系统提示如下|system prompt:|忽略以上指示/i;
  if (prohibited.test(text)) return fallback[locale];
  const pricePattern = /(?:NT\$|TWD|NTD|台幣|台币|新台幣|\$|價格|价格|報價|报价|price|fare|cost)\s*(?:是|為|为|:|is|=)?\s*(\d[\d,]*(?:\s*[-–～~]\s*\d[\d,]*)?)|(\d[\d,]*(?:\s*[-–～~]\s*\d[\d,]*)?)\s*(?:元|台幣|台币|TWD|NTD)/gi;
  const amounts = Array.from(text.matchAll(pricePattern)).flatMap(m => (m[1] || m[2]).split(/[-–～~]/).map(v => Number(v.replace(/[,\s]/g, ''))));
  if (amounts.some(n => !prices.has(n) && ![400, 500, 600, 2500, 3500].includes(n))) return fallback[locale];
  return text;
}
