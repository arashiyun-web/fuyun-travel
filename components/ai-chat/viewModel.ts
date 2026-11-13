import type { CSSProperties } from 'react';
import type { UIMessage } from 'ai';
export type Locale = 'zh-TW' | 'zh-CN' | 'en';
export type ContactName = 'line' | 'whatsapp' | 'wechat' | 'phone';
export type Contacts = { line: string | null; whatsapp: string | null; wechat: string | null; phone: string };
export type ChatIssue = { kind: 'paused' | 'limited' | 'tooLong' | 'network'; retryAfter?: number };
export type ContactHint = { channel: ContactName; message: string } | null;
export type Summary = { messageId: string; text: string; rows: Array<[string, string]>; vehicle?: string };
export function latestSummary(messages: UIMessage[]): Summary | null {
  const last = messages.at(-1);
  if (!last || last.role !== 'assistant' || last.parts.some(p => 'output' in p && p.output && typeof p.output === 'object' && 'kind' in p.output && p.output.kind === 'booking')) return null;
  const text = last.parts.filter(p => p.type === 'text').map(p => p.text).join('\n');
  const plain = text.replace(/\s+/g, ' ');
  if (!/訂單摘要|订单摘要|order summary|booking summary/i.test(plain) ||
      !/\d{4}-\d{2}-\d{2}/.test(plain) || !/\d{2}:\d{2}/.test(plain) ||
      !/phone|line|whatsapp|wechat/i.test(plain) ||
      !/\d+\s*(?:人|位|adults|people|passengers)|(?:人數|人数|passengers|party)\s*[:：]?\s*\d+/i.test(plain) ||
      !/(?:行李|luggage|bags|suitcases).{0,20}\d+|\d+\s*(?:件|bags|suitcases)/i.test(plain) ||
      !/→|上車.*下車|上车.*下车|pick.?up.*drop.?off/i.test(plain)) return null;
  const rows: Array<[string, string]> = [];
  for (const line of text.split('\n')) {
    const match = /^\s*(?:[-*•]\s*)?([^:：]{1,22})[:：]\s*(.+?)\s*$/.exec(line);
    if (match && /聯絡|联系|上車|上车|下車|下车|日期|時間|时间|人數|人数|行李|車型|车型|contact|name|pick|drop|date|time|passenger|party|luggage|bags|vehicle/i.test(match[1])) rows.push([match[1], match[2]]);
  }
  let vehicle: string | undefined;
  if (!rows.some(([label]) => /車型|车型|vehicle/i.test(label))) {
    const part = messages.flatMap(message => message.parts).reverse().find(part =>
      'output' in part && part.output && typeof part.output === 'object' && 'kind' in part.output && part.output.kind === 'quote');
    if (part && 'input' in part && part.input && typeof part.input === 'object' && 'output' in part) {
      const trip = part.input as Record<string, unknown>;
      const result = part.output as { quote?: { vehicle?: unknown } };
      const row = (label: RegExp) => rows.find(([name]) => label.test(name))?.[1] || '';
      const party = /^(\d+)\s*(?:人|位|people|passengers?)$/i.exec(row(/人數|人数|passengers|party/i));
      const matches = (value: unknown, label: RegExp) => typeof value === 'string' && !!value && row(label).includes(value);
      if (party && Number(party[1]) === trip.passenger_count && matches(trip.date, /日期|date/i) &&
          matches(trip.pickup, /上車|上车|pick.?up/i) && matches(trip.destination, /下車|下车|drop.?off/i) &&
          typeof result.quote?.vehicle === 'string') vehicle = result.quote.vehicle;
    }
  }
  return { messageId: last.id, text, rows, ...(vehicle ? { vehicle } : {}) };
}
// passenger_count is the total party size, including children (quoteSchema).
// Never relabel this total as adults or derive counts from free-form notes.
export function partyDetails(trip: Record<string, unknown>, locale: Locale): string | undefined {
  const count = trip.passenger_count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) return undefined;
  const people = locale === 'en' ? `${count} passenger${count === 1 ? '' : 's'}` : `${count} 人`;
  const bags = trip.luggage_count;
  if (typeof bags !== 'number' || !Number.isInteger(bags) || bags < 0) return people;
  return people + (locale === 'en' ? ` · ${bags} bag${bags === 1 ? '' : 's'}` : `・行李 ${bags} 件`);
}
export function phoneHref(phone: string) { return 'tel:' + phone.replace(/[^\d+]/g, ''); }
export function retrySeconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}
export function responseIssue(status: number, retryAfter?: number): ChatIssue {
  return { kind: status === 429 ? 'limited' : status === 400 || status === 413 ? 'tooLong' : 'paused', ...(retryAfter ? { retryAfter } : {}) };
}
export class ChatHttpError extends Error {
  constructor(public issue: ChatIssue) { super(issue.kind); }
}
export function viewportVariables(viewport: { height: number; offsetTop: number }): CSSProperties {
  return { '--fy-viewport-height': Math.max(1, Math.round(viewport.height)) + 'px',
    '--fy-viewport-top': Math.max(0, Math.round(viewport.offsetTop)) + 'px' } as CSSProperties;
}
export function lockBodyScroll(body: Pick<HTMLElement, 'style'> & Partial<Pick<HTMLElement, 'getAttribute' | 'removeAttribute'>>, view: { scrollY: number; scrollTo: (x: number, y: number) => void }) {
  const hadStyle = body.getAttribute?.('style') !== null;
  const properties = ['overflow', 'position', 'top', 'left', 'right', 'width'];
  const saved = properties.map(name => ({ name, value: body.style.getPropertyValue(name), priority: body.style.getPropertyPriority(name) }));
  const y = view.scrollY;
  const next = ['hidden', 'fixed', '-' + y + 'px', '0px', '0px', '100%'];
  properties.forEach((name, index) => body.style.setProperty(name, next[index]));
  return () => {
    saved.forEach(({ name, value, priority }) => value ? body.style.setProperty(name, value, priority) : body.style.removeProperty(name));
    // Read the serialized attribute after CSSOM removals before removing it.
    if (!hadStyle && body.getAttribute?.('style') === '') body.removeAttribute?.('style');
    view.scrollTo(0, y);
  };
}
