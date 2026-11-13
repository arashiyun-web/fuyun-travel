"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { chatContacts, chatLocale } from '@/lib/chatContacts';
import type { ChatLocale } from '@/lib/chat/schema';

const copy = {
  'zh-TW': { launch: 'AI 旅遊管家', title: '浮雲輕鬆遊 · AI 旅遊管家', close: '收合', welcome: '您好！想去哪裡走走？請告訴我日期、人數及行李件數，我會協助您查詢參考價格。', input: '輸入您的旅遊需求', send: '傳送', stop: '停止', pending: '聯絡方式設定中', copied: '已複製微信 ID', failedCopy: '無法複製，微信 ID：', contact: '也可以使用下方 LINE、WhatsApp 或微信聯絡我們。', unavailable: '客服暫時無法使用。', limited: '目前詢問較多，請稍後再試。', tooLong: '訊息或對話較長，請縮短內容。', quote: 'AI 參考範圍', staff: '將由專人報價', booking: '待審核需求單', availability: '車況待專人確認', confirm: '我確認', confirmHint: '已核對上方完整訂單摘要後，可按此確認', language: '介面語言' },
  'zh-CN': { launch: 'AI 旅游管家', title: '浮雲輕鬆遊 · AI 旅游管家', close: '收起', welcome: '您好！想去哪里走走？请告诉我日期、人数及行李件数，我会协助您查询参考价格。', input: '输入您的旅游需求', send: '发送', stop: '停止', pending: '联系方式设置中', copied: '已复制微信 ID', failedCopy: '无法复制，微信 ID：', contact: '也可以使用下方 LINE、WhatsApp 或微信联系我们。', unavailable: '客服暂时无法使用。', limited: '目前咨询较多，请稍后再试。', tooLong: '消息或对话较长，请缩短内容。', quote: 'AI 参考范围', staff: '将由专人报价', booking: '待审核需求单', availability: '车况待专人确认', confirm: '我确认', confirmHint: '核对上方完整订单摘要后，可点击确认', language: '界面语言' },
  en: { launch: 'AI travel concierge', title: 'Fuyun Travel · AI concierge', close: 'Close', welcome: 'Hello! Where would you like to go? Share your date, adults/children and luggage count so I can help with a reference quote.', input: 'Tell us about your trip', send: 'Send', stop: 'Stop', pending: 'Contact details are being configured', copied: 'WeChat ID copied', failedCopy: 'Could not copy. WeChat ID: ', contact: 'You can also reach us using LINE, WhatsApp or WeChat below.', unavailable: 'Chat is temporarily unavailable.', limited: 'We have received many requests. Please try again later.', tooLong: 'Your message or conversation is too long. Please shorten it.', quote: 'AI reference range', staff: 'Our staff will provide a quote', booking: 'Pending-review request', availability: 'Availability awaits staff confirmation', confirm: 'I confirm', confirmHint: 'Confirm only after reviewing all details in the order summary above', language: 'Interface language' },
};
type Card = { kind?: string; notice?: string; status?: string | number; booking_number?: string; quote?: { low?: number | null; high?: number | null; price_available?: boolean } };
export default function AIChatWidget() {
  const pathname = usePathname() || '/';
  const [locale, setLocale] = useState<ChatLocale>(() => chatLocale(pathname));
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [issue, setIssue] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const c = copy[locale];
  useEffect(() => { setLocale(chatLocale(pathname, navigator.language)); }, [pathname]);
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    fetch: async (url, init) => {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(String(response.status));
      return response;
    },
    prepareSendMessagesRequest: ({ id, messages }) => ({ body: {
      id, locale,
      messages: messages.map(message => ({ id: message.id, role: message.role,
        parts: message.parts.filter(part => part.type === 'text').map(part => ({ type: 'text' as const, text: part.text })),
      })).filter(message => message.parts.length > 0),
    } }),
  }), [locale]);
  const { messages, sendMessage, status, stop } = useChat({ transport, onError: error => {
    setIssue(error.message === '429' ? 429 : /^(400|413)$/.test(error.message) ? 413 : 503);
  } });
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => { if (open) field.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (history.current) history.current.scrollTop = history.current.scrollHeight; }, [messages, open]);
  function close() { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  async function send(text: string) {
    if (busy || !text.trim()) return;
    if (Array.from(text).length > 1000) { setIssue(413); return; }
    setIssue(null); setHint(''); setInput('');
    await sendMessage({ text: text.trim() });
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(input); }
  async function copyWechat() {
    if (!chatContacts.wechat) { setHint(c.pending); return; }
    try { await navigator.clipboard.writeText(chatContacts.wechat); setHint(c.copied); }
    catch { setHint(c.failedCopy + chatContacts.wechat); }
  }
  return <div data-ai-chat-widget lang={locale === 'zh-TW' ? 'zh-Hant' : locale === 'zh-CN' ? 'zh-Hans' : 'en'}
    onKeyDown={event => { if (event.key === 'Escape') close(); }}>
    <style dangerouslySetInnerHTML={{ __html: styles }} />
    <button ref={trigger} type="button" className="chat-launch" aria-expanded={open} aria-controls="ai-chat-panel" hidden={open} onClick={() => setOpen(true)}>{c.launch}</button>
    {open ? <section id="ai-chat-panel" role="dialog" aria-label={c.title} className="chat-panel">
      <header><strong>{c.title}</strong><button type="button" onClick={close} aria-label={c.close}>×</button></header>
      <label className="chat-language">{c.language}<select value={locale} onChange={event => { setLocale(event.target.value as ChatLocale); setHint(''); }}>
        <option value="zh-TW">繁體中文</option><option value="zh-CN">简体中文</option><option value="en">English</option>
      </select></label>
      <div ref={history} className="chat-history" role="log" aria-live="polite" aria-relevant="additions text">
        <p>{c.welcome}</p>
        {messages.map(message => <div key={message.id} className={message.role === 'user' ? 'chat-message chat-user' : 'chat-message'}>
          {message.parts.map((part, index) => {
            if (part.type === 'text') return <p key={index}>{part.text}</p>;
            const card = 'output' in part ? part.output as Card : null;
            if (!card || typeof card !== 'object') return null;
            if (card.kind === 'error') return <p role="alert" key={index}>{card.status === 429 ? c.limited : card.status === 400 ? c.confirmHint : c.unavailable} {c.contact}</p>;
            if (typeof card.notice !== 'string') return null;
            return <article key={index} className="chat-card">
              <strong>{card.kind === 'quote' ? c.quote : card.kind === 'booking' ? c.booking : c.availability}</strong>
              {card.kind === 'quote' ? <p>{card.quote?.price_available && typeof card.quote.low === 'number' && typeof card.quote.high === 'number'
                ? 'NT$' + card.quote.low.toLocaleString() + '–' + card.quote.high.toLocaleString() : c.staff}</p> : null}
              {card.booking_number ? <p><code>{card.booking_number}</code></p> : null}
              <p>{card.notice}</p>
            </article>;
          })}
        </div>)}
      </div>
      {issue ? <p className="chat-feedback" role="alert">{issue === 429 ? c.limited : issue === 413 ? c.tooLong : c.unavailable} {c.contact}</p> : null}
      <form onSubmit={submit}><label htmlFor="ai-chat-input" className="chat-input-label">{c.input}</label>
        <textarea ref={field} id="ai-chat-input" value={input} maxLength={2000} rows={2} onChange={event => setInput(event.target.value)} />
        <div className="chat-actions"><small>{Array.from(input).length}/1000</small>
          {busy ? <button type="button" onClick={() => void stop()}>{c.stop}</button> : <button type="submit" disabled={!input.trim()}>{c.send}</button>}
        </div>
        <button type="button" className="chat-confirm" title={c.confirmHint} disabled={busy || messages.length < 2} onClick={() => void send(c.confirm)}>{c.confirm}</button>
      </form>
      <nav aria-label={c.contact} className="chat-contacts">
        {chatContacts.line ? <a href={chatContacts.line} target="_blank" rel="noopener noreferrer">LINE</a> : <button type="button" aria-disabled="true" onClick={() => setHint(c.pending)}>LINE</button>}
        {chatContacts.whatsapp ? <a href={chatContacts.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a> : <button type="button" aria-disabled="true" onClick={() => setHint(c.pending)}>WhatsApp</button>}
        <button type="button" aria-disabled={!chatContacts.wechat} onClick={() => void copyWechat()}>WeChat 微信</button>
      </nav>
      <p className="chat-hint" role="status">{hint || (!chatContacts.line && !chatContacts.whatsapp && !chatContacts.wechat ? c.pending : '')}</p>
    </section> : null}
  </div>;
}
const styles = [
  '[data-ai-chat-widget]{position:fixed;right:100px;bottom:20px;z-index:40;max-width:calc(100vw - 32px);color:#f5f5f5;font:14px/1.5 system-ui,sans-serif;pointer-events:none}',
  '[data-ai-chat-widget] *{box-sizing:border-box}',
  '[data-ai-chat-widget] button,[data-ai-chat-widget] a,[data-ai-chat-widget] select,[data-ai-chat-widget] textarea{font:inherit}',
  '[data-ai-chat-widget] button,[data-ai-chat-widget] a{pointer-events:auto;cursor:pointer;border:1px solid #857143;border-radius:10px;padding:8px 12px;background:#30302c;color:#f8e6b0;text-decoration:none}',
  '[data-ai-chat-widget] button:disabled{opacity:.5;cursor:default}',
  '[data-ai-chat-widget] button[aria-disabled=true]{opacity:.7}',
  '[data-ai-chat-widget] .chat-launch{min-height:48px;box-shadow:0 4px 16px #0005}',
  '[data-ai-chat-widget] [hidden]{display:none}',
  '[data-ai-chat-widget] .chat-panel{pointer-events:auto;width:350px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 40px);display:flex;flex-direction:column;border:1px solid #857143;border-radius:16px;background:#252525;box-shadow:0 8px 32px #0006;overflow:hidden}',
  '[data-ai-chat-widget] header{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px}',
  '[data-ai-chat-widget] header button{font-size:22px;padding:2px 12px}',
  '[data-ai-chat-widget] .chat-language{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 8px;font-size:12px}',
  '[data-ai-chat-widget] select{background:#30302c;color:#fff;border:1px solid #777;border-radius:6px;padding:4px}',
  '[data-ai-chat-widget] .chat-history{height:270px;min-height:60px;overflow:auto;overscroll-behavior:contain;padding:12px;background:#202020}',
  '[data-ai-chat-widget] p{margin:0 0 8px;white-space:pre-wrap;overflow-wrap:anywhere}',
  '[data-ai-chat-widget] .chat-message{margin:12px 0;padding:8px;border-radius:10px;background:#303030}',
  '[data-ai-chat-widget] .chat-user{background:#3b392f}',
  '[data-ai-chat-widget] .chat-card{padding:10px;border:1px solid #a08b55;border-radius:8px;margin:8px 0}',
  '[data-ai-chat-widget] form{padding:10px 12px}',
  '[data-ai-chat-widget] .chat-input-label{display:block;font-size:12px;margin-bottom:4px}',
  '[data-ai-chat-widget] textarea{width:100%;resize:vertical;max-height:90px;background:#161616;color:#fff;border:1px solid #777;border-radius:8px;padding:8px}',
  '[data-ai-chat-widget] .chat-actions{display:flex;justify-content:space-between;align-items:center;gap:8px}',
  '[data-ai-chat-widget] .chat-confirm{font-size:12px;margin-top:4px}',
  '[data-ai-chat-widget] .chat-contacts{display:flex;gap:5px;padding:0 10px}',
  '[data-ai-chat-widget] .chat-contacts>*{flex:1;text-align:center;padding:6px 3px;font-size:12px}',
  '[data-ai-chat-widget] .chat-feedback,[data-ai-chat-widget] .chat-hint{padding:4px 12px;font-size:12px;margin:0}',
  '[data-ai-chat-widget] :focus-visible{outline:2px solid #f8e6b0;outline-offset:2px}',
  '@media(max-width:767px){[data-ai-chat-widget]{right:16px;bottom:160px}[data-ai-chat-widget] .chat-panel{max-height:calc(100dvh - 176px)}[data-ai-chat-widget] .chat-history{height:230px}}',
].join('\n');
