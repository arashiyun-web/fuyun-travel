"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { chatContacts, chatLocale } from '@/lib/chatContacts';
import { ChatPanel } from './ai-chat/ChatPanel';
import { ChatIcon } from './ai-chat/icons';
import { COPY, LAUNCHER_LABEL } from './ai-chat/copy';
import { WIDGET_STYLES } from './ai-chat/styles';
import { resolveMobileLayout } from './ai-chat/layout';
import { ChatHttpError, latestSummary, lockBodyScroll, responseIssue, retrySeconds, viewportVariables,
  type ChatIssue, type Locale } from './ai-chat/viewModel';

export default function AIChatWidget() {
  const pathname = usePathname() || '/';
  const [locale, setLocale] = useState<Locale>(() => chatLocale(pathname));
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [input, setInput] = useState('');
  const [issue, setIssue] = useState<ChatIssue | null>(null);
  const [viewport, setViewport] = useState<CSSProperties>({});
  const [typingPhase, setTypingPhase] = useState(0);
  const [reviewed, setReviewed] = useState('');
  const [consumed, setConsumed] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const languageButton = useRef<HTMLButtonElement>(null);
  const summaryStart = useRef<HTMLSpanElement>(null);
  const summaryEnd = useRef<HTMLSpanElement>(null);
  const scrolledSummary = useRef('');
  const confirmedSummary = useRef('');
  const c = COPY[locale];
  const mobileLayout = resolveMobileLayout(process.env.NEXT_PUBLIC_CHAT_MOBILE_LAYOUT);
  useEffect(() => { setLocale(chatLocale(pathname, navigator.language)); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(max-width:767px)');
    const change = () => setMobile(media.matches);
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    fetch: async (url, init) => {
      let response: Response;
      try { response = await fetch(url, init); }
      catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        const failure: ChatIssue = { kind: 'network' }; setIssue(failure); throw new ChatHttpError(failure);
      }
      if (!response.ok) {
        const failure = responseIssue(response.status, retrySeconds(response.headers.get('Retry-After')));
        setIssue(failure); throw new ChatHttpError(failure);
      }
      return response;
    },
    prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, locale,
      messages: messages.map(message => ({ id: message.id, role: message.role,
        parts: message.parts.filter(part => part.type === 'text').map(part => ({ type: 'text' as const, text: part.text })),
      })).filter(message => message.parts.length > 0),
    } }),
  }), [locale]);
  const { messages, sendMessage, regenerate, status, stop } = useChat({
    transport, onError: error => {
      if (error.name === 'AbortError') return;
      setIssue(previous => error instanceof ChatHttpError ? error.issue : previous || { kind: /Service temporarily unavailable/i.test(error.message) ? 'paused' : 'network' });
    },
  });
  const busy = status === 'submitted' || status === 'streaming';
  const summary = useMemo(() => latestSummary(messages), [messages]);
  const summaryKey = summary ? summary.messageId + '\n' + summary.text : '';
  const summaryRead = !!summaryKey && reviewed === summaryKey && consumed !== summaryKey;
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open || !mobile) { setViewport({}); return; }
    const unlock = lockBodyScroll(document.body, window);
    const visual = window.visualViewport;
    const update = () => setViewport(viewportVariables(visual || { height: window.innerHeight, offsetTop: 0 }));
    update(); visual?.addEventListener('resize', update); visual?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      visual?.removeEventListener('resize', update); visual?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update); unlock();
    };
  }, [open, mobile]);
  useEffect(() => {
    const element = field.current;
    if (element) {
      element.style.height = 'auto';
      const overflowing = element.scrollHeight > 120;
      element.toggleAttribute('data-overflow', overflowing);
      const size = getComputedStyle(element);
      const line = parseFloat(size.lineHeight);
      const padding = parseFloat(size.paddingTop) + parseFloat(size.paddingBottom);
      // Keep whole lines visible when the textarea reaches its height limit.
      const limit = Math.floor((120 - padding) / line) * line + padding;
      element.style.height = Math.min(overflowing ? limit : 120, element.scrollHeight) + 'px';
    }
  }, [input, open]);
  useEffect(() => {
    const element = history.current;
    if (!open || !element) return;
    if (issue || !summary) { element.scrollTop = element.scrollHeight; return; }
    if (!busy && scrolledSummary.current !== summaryKey && summaryStart.current) {
      element.scrollTop += summaryStart.current.getBoundingClientRect().top - element.getBoundingClientRect().top - 8;
      scrolledSummary.current = summaryKey;
    }
  }, [messages, open, issue, summary, summaryKey, busy]);
  useEffect(() => {
    const element = history.current;
    if (!open || busy || !summaryKey || !element || !summaryStart.current || !summaryEnd.current) return;
    let sawStart = false;
    const check = () => {
      const bounds = element.getBoundingClientRect();
      const start = summaryStart.current?.getBoundingClientRect();
      const end = summaryEnd.current?.getBoundingClientRect();
      if (start && start.top >= bounds.top && start.bottom <= bounds.bottom) sawStart = true;
      if (sawStart && end && end.top >= bounds.top && end.bottom <= bounds.bottom) setReviewed(summaryKey);
    };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(check, { root: element, threshold: 1 }) : null;
    observer?.observe(summaryStart.current); observer?.observe(summaryEnd.current);
    element.addEventListener('scroll', check, { passive: true }); check();
    return () => { observer?.disconnect(); element.removeEventListener('scroll', check); };
  }, [open, busy, summaryKey]);
  useEffect(() => {
    if (!busy) return;
    const media = window.matchMedia('(prefers-reduced-motion:reduce)');
    let timer: number | undefined;
    const update = () => {
      if (timer !== undefined) window.clearInterval(timer);
      if (!media.matches) timer = window.setInterval(() => setTypingPhase(value => (value + 1) % 3), 380);
      else setTypingPhase(0);
    };
    update(); media.addEventListener('change', update);
    return () => { if (timer !== undefined) window.clearInterval(timer); media.removeEventListener('change', update); };
  }, [busy]);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-ai-chat-widget] .fy-menu,[data-ai-chat-widget] .fy-lang')) setMenuOpen(false);
    };
    root.current?.querySelector<HTMLButtonElement>('[role=option][aria-selected=true]')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [menuOpen]);
  function close() {
    setOpen(false); setMenuOpen(false); setReviewed(''); scrolledSummary.current = '';
    window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }
  async function send(text: string) {
    if (busy || !text.trim()) return;
    if (Array.from(text).length > 1000) { setIssue({ kind: 'tooLong' }); return; }
    setIssue(null); setMenuOpen(false); setInput('');
    await sendMessage({ text: text.trim() });
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(input); }
  function confirm() {
    if (!summaryRead || busy || confirmedSummary.current === summaryKey) return;
    confirmedSummary.current = summaryKey; setConsumed(summaryKey); void send(c.confirmToken);
  }
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); if (menuOpen) { setMenuOpen(false); languageButton.current?.focus(); } else close(); return; }
    if (menuOpen && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const options = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role=option]') || []);
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
      event.preventDefault(); options[index]?.focus(); return;
    }
    if (open && mobile && event.key === 'Tab') {
      const elements = Array.from(root.current?.querySelectorAll<HTMLElement>('.fy-panel button:not([disabled]),.fy-panel a[href],.fy-panel textarea') || []).filter(e => e.getClientRects().length > 0);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  return <div ref={root} data-ai-chat-widget data-mobile-layout={mobileLayout} data-open={open} lang={locale === 'zh-TW' ? 'zh-Hant' : locale === 'zh-CN' ? 'zh-Hans' : 'en'}
    style={viewport} onKeyDown={keydown} onFocusCapture={event => { if (event.target instanceof HTMLTextAreaElement) setMenuOpen(false); }}>
    <style dangerouslySetInnerHTML={{ __html: WIDGET_STYLES }} />
    <button ref={trigger} type="button" className="fy-launch" hidden={open} aria-label={c.open} aria-expanded={open} aria-controls="ai-chat-panel"
      aria-describedby="ai-chat-launcher-tip" onClick={() => setOpen(true)}>
      <span className="fy-ic"><ChatIcon name="chat" /><span className="fy-dot" /></span>
      <span><b>{locale === 'en' ? c.bot : LAUNCHER_LABEL}</b><small>{locale === 'en' ? '24/7 · 繁中 / 简中 / EN' : '24 小時・繁中 / 简中 / EN'}</small></span>
      <span className="fy-tooltip" role="tooltip" id="ai-chat-launcher-tip">{c.open}</span>
    </button>
    {open && mobileLayout === 'panel' ? <button type="button" className="fy-backdrop" tabIndex={-1} aria-label={c.close} onClick={close} /> : null}
    {open ? <ChatPanel mobileLayout={mobileLayout} locale={locale} messages={messages} busy={busy} input={input} issue={issue} menuOpen={menuOpen}
      summary={summary} summaryRead={summaryRead} contacts={chatContacts} modal={mobile} typingPhase={typingPhase}
      historyRef={history} inputRef={field} closeRef={closeButton} languageRef={languageButton} summaryStartRef={summaryStart} summaryEndRef={summaryEnd}
      actions={{ close, toggleMenu: () => { setMenuOpen(value => !value); },
        locale: value => { setLocale(value); setMenuOpen(false); languageButton.current?.focus({ preventScroll: true }); },
        input: value => { setInput(value); if (Array.from(value).length > 1000) setIssue({ kind: 'tooLong' }); else if (issue?.kind === 'tooLong') setIssue(null); },
        submit, stop: () => { setIssue(null); void stop(); },
        retry: () => { if (!busy) { setIssue(null); void regenerate(); } },
        confirm, chip: text => { void send(text); },
      }} /> : null}
  </div>;
}
