import type { ChatLocale } from './chat/schema';
export function chatLocale(pathname: string, browserLanguage = ''): ChatLocale {
  if (/^\/en(?:\/|$)/i.test(pathname)) return 'en';
  if (/^\/zh-cn(?:\/|$)/i.test(pathname)) return 'zh-CN';
  if (/^en/i.test(browserLanguage)) return 'en';
  if (/^zh-(?:cn|sg|hans)/i.test(browserLanguage)) return 'zh-CN';
  return 'zh-TW';
}
export function resolveChatContacts(values: { line?: string; whatsapp?: string; wechat?: string }) {
  let line: string | null = null;
  try {
    const url = new URL(values.line || '');
    if (url.protocol === 'https:' && ['line.me', 'lin.ee', 'www.line.me'].includes(url.hostname) && !url.username && !url.password && url.pathname !== '/') line = url.href;
  } catch {}
  const number = (values.whatsapp || '').replace(/[+\s()-]/g, '');
  const id = (values.wechat || '').trim();
  return { line, whatsapp: /^[1-9]\d{6,14}$/.test(number) ? 'https://wa.me/' + number : null,
    wechat: /^[A-Za-z][A-Za-z0-9_-]{5,19}$/.test(id) && !/placeholder|pending|example/i.test(id) ? id : null };
}
export const chatContacts = resolveChatContacts({
  line: process.env.NEXT_PUBLIC_CHAT_LINE_URL,
  whatsapp: process.env.NEXT_PUBLIC_CHAT_WHATSAPP_NUMBER,
  wechat: process.env.NEXT_PUBLIC_CHAT_WECHAT_ID,
});
