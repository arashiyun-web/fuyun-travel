import type { ChatLocale } from './chat/schema';
export function chatLocale(pathname: string, browserLanguage = ''): ChatLocale {
  if (/^\/en(?:\/|$)/i.test(pathname)) return 'en';
  if (/^\/zh-cn(?:\/|$)/i.test(pathname)) return 'zh-CN';
  if (/^en/i.test(browserLanguage)) return 'en';
  if (/^zh-(?:cn|sg|hans)/i.test(browserLanguage)) return 'zh-CN';
  return 'zh-TW';
}
// Legacy widget settings cannot replace the company's official contact account.
export function resolveChatContacts(_values: { line?: string; whatsapp?: string; wechat?: string } = {}) {
  return { line: 'https://line.me/R/ti/p/@954fyicw' };
}
export const chatContacts = resolveChatContacts();
