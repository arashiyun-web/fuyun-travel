"use client";
import type { FormEvent, RefObject } from 'react';
import type { UIMessage } from 'ai';
import { ChatIcon, type IconName } from './icons';
import { COPY, LANGUAGES } from './copy';
import type { MobileLayout } from './layout';
import { partyDetails, type ChatIssue, type Contacts, type Locale, type Summary } from './viewModel';

export type PanelActions = {
  close: () => void; toggleMenu: () => void; locale: (value: Locale) => void; input: (value: string) => void;
  submit: (event: FormEvent) => void; stop: () => void; retry: () => void; confirm: () => void;
  chip: (text: string) => void;
};
export type PanelProps = {
  locale: Locale; messages: UIMessage[]; busy: boolean; input: string; issue: ChatIssue | null;
  mobileLayout?: MobileLayout; modal?: boolean; menuOpen: boolean; summary: Summary | null; summaryRead: boolean; contacts: Contacts; actions: PanelActions; typingPhase?: number;
  historyRef: RefObject<HTMLDivElement>; inputRef: RefObject<HTMLTextAreaElement>; closeRef: RefObject<HTMLButtonElement>;
  summaryStartRef: RefObject<HTMLSpanElement>; summaryEndRef: RefObject<HTMLSpanElement>; languageRef?: RefObject<HTMLButtonElement>;
};
type Copy = typeof COPY['zh-TW'];
type Output = {
  kind?: string; notice?: string; status?: number | string; retry_after?: number;
  booking_number?: string;
  quote?: { low?: number | null; high?: number | null; price_available?: boolean; vehicle?: string | null };
};
function ContactStrip({ c, contacts, compact = false }: {
  c: Copy; contacts: Contacts; compact?: boolean;
}) {
  return <nav className={compact ? 'fy-act' : 'fy-contacts'} aria-label={c.contactLabel}>
    <a data-contact="line" className="fy-contact fy-line" href={contacts.line}
      target="_blank" rel="noopener noreferrer" aria-label={c.contacts[0]}><ChatIcon name="line" /><span>{c.contacts[0]}</span></a>
  </nav>;
}
function Who({ c }: { c: Copy }) { return <div className="fy-who"><span className="fy-mini" aria-hidden="true">浮</span>{c.bot}</div>; }
function IssueCard({ issue, props }: { issue: ChatIssue; props: PanelProps }) {
  const c = COPY[props.locale];
  const warn = issue.kind === 'limited' || issue.kind === 'tooLong';
  const title = issue.kind === 'limited' ? c.limitedTitle : issue.kind === 'tooLong' ? c.longTitle : issue.kind === 'network' ? c.networkTitle : c.pausedTitle;
  const body = issue.kind === 'limited' ? c.limitedBody : issue.kind === 'tooLong' ? c.longBody : issue.kind === 'network' ? c.networkBody : c.pausedBody;
  const icon: IconName = issue.kind === 'limited' ? 'clock' : issue.kind === 'tooLong' ? 'text-long' : issue.kind === 'network' ? 'wifi-off' : 'pause';
  return <section className={'fy-alert' + (warn ? ' fy-warn' : '')} role="alert">
    <h4><ChatIcon name={icon} />{title}</h4><p>{body}</p>
    {issue.kind === 'limited' && issue.retryAfter ? <p>{c.retryPrefix}{issue.retryAfter}{c.retrySuffix}</p> : null}
    {issue.kind === 'network' ? <button className="fy-retry" type="button" disabled={props.busy} onClick={props.actions.retry}><ChatIcon name="retry" />{c.retry}</button> : null}
    <ContactStrip c={c} contacts={props.contacts} compact />
  </section>;
}
function Notice({ text }: { text: string }) { return <div className="fy-notice"><ChatIcon name="info" /><span>{text}</span></div>; }
function ToolCard({ output, input, props }: { output: Output; input: unknown; props: PanelProps }) {
  const c = COPY[props.locale];
  if (output.kind === 'error') return <IssueCard props={props} issue={{ kind: output.status === 429 ? 'limited' : output.status === 400 ? 'tooLong' : 'paused', retryAfter: output.retry_after }} />;
  if (typeof output.notice !== 'string') return null;
  const trip = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  if (output.kind === 'quote') {
    const quote = output.quote;
    const low = quote?.low, high = quote?.high;
    const hasEndpoints = typeof low === 'number' && typeof high === 'number';
    const price = hasEndpoints && low >= high ? '專人報價'
      : quote?.price_available && hasEndpoints ? 'NT$ ' + low.toLocaleString('en-US') + ' – ' + high.toLocaleString('en-US') : c.staff;
    const rows: Array<[string, unknown]> = [[c.date, trip.date], [c.pickup, trip.pickup], [c.destination, trip.destination], [c.people, partyDetails(trip, props.locale)]];
    return <article className="fy-card" data-tool-card="quote">
      <div className="fy-card-head"><b>{c.quote}</b><span className="fy-tag fy-pend">{c.staffConfirm}</span></div>
      <div className="fy-card-body">
        {quote?.vehicle ? <div className="fy-vehicle">{c.vehicle}<b>{quote.vehicle}</b></div> : null}
        <div className={'fy-price' + (!quote?.price_available ? ' fy-staff' : '')}>
          {price}
        </div>
        <dl className="fy-kv">{rows.filter(([, value]) => typeof value === 'string' || typeof value === 'number').map(([label, value]) => <div className="fy-kv-row" key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}
          <div className="fy-kv-row"><dt>{c.availability}</dt><dd className="fy-pc">{c.pendingAvailability}</dd></div>
        </dl>
        <Notice text={output.notice} />
      </div>
    </article>;
  }
  if (output.kind === 'booking') return <article className="fy-card" data-tool-card="booking">
    <div className="fy-card-head"><b>{c.booking}</b><span className="fy-tag fy-pend"><ChatIcon name="hourglass" />{c.pendingBooking}</span></div>
    <div className="fy-card-body"><div className="fy-vehicle">{c.number}</div><p className="fy-booking-number">{output.booking_number}</p>
      <dl className="fy-kv"><div className="fy-kv-row"><dt>{c.availability}</dt><dd className="fy-pc">{c.pendingAvailability}</dd></div><div className="fy-kv-row"><dt>{c.payment}</dt><dd>{c.unpaid}</dd></div></dl>
      <Notice text={output.notice} /><ol className="fy-steps">{c.steps.map((text, index) => <li key={text}><span>{index + 1}</span>{text}</li>)}</ol>
    </div>
  </article>;
  return <article className="fy-card" data-tool-card="availability"><div className="fy-card-head"><b>{c.pendingAvailability}</b></div><div className="fy-card-body"><Notice text={output.notice} /></div></article>;
}
function SummaryCard({ summary, props }: { summary: Summary; props: PanelProps }) {
  const c = COPY[props.locale];
  const rows = summary.rows.filter(([label]) => !/^(?:車況|车况|availability)$/i.test(label.trim()))
    .map(([label, value]) => [/車型|车型|vehicle/i.test(label) ? c.vehicle : label, value]);
  if (summary.vehicle) rows.push([c.vehicle, summary.vehicle]);
  return <article className="fy-card" data-order-summary>
    <span className="fy-review-marker" ref={props.summaryStartRef} aria-hidden="true" />
    <div className="fy-card-head"><b>{c.summary}</b><span className="fy-tag">{c.unsent}</span></div>
    <div className="fy-card-body">{summary.rows.length >= 5
      ? <dl className="fy-kv">{rows.map(([label, value], index) => <div className="fy-kv-row" key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      : <p className="fy-summary-raw">{summary.text}</p>}
      <dl className="fy-kv"><div className="fy-kv-row"><dt>{c.availability}</dt><dd className="fy-pc">{c.pendingAvailability}</dd></div></dl>
    </div>
    <span className="fy-review-marker" ref={props.summaryEndRef} aria-hidden="true" />
  </article>;
}
export function ChatPanel(props: PanelProps) {
  const { locale, messages, busy, input, issue, summary, summaryRead, actions } = props;
  const c = COPY[locale];
  const count = Array.from(input).length;
  const hasQuote = messages.some(m => m.parts.some(p => 'output' in p && p.output && typeof p.output === 'object' && 'kind' in p.output && p.output.kind === 'quote'));
  return <section className="fy-panel" id="ai-chat-panel" role="dialog" aria-modal={props.modal || undefined} aria-label={c.title}>
    {props.mobileLayout === 'panel' ? <div className="fy-handle" aria-hidden="true"><span /></div> : null}
    <header className="fy-header">
      <div className="fy-avatar" aria-hidden="true">浮<span className="fy-dot" /></div>
      <div className="fy-brand"><strong>{c.title}</strong><span>{c.subtitle}</span></div>
      <button ref={props.languageRef} type="button" className={'fy-lang' + (props.menuOpen ? ' fy-on' : '')} aria-label={c.language}
        aria-haspopup="listbox" aria-expanded={props.menuOpen} aria-controls="ai-chat-languages" onClick={actions.toggleMenu}>
        <ChatIcon name="globe" /><span>{c.langShort}</span><ChatIcon name="chevron-down" className="fy-small-chevron" />
      </button>
      <button ref={props.closeRef} type="button" className="fy-ibtn" aria-label={c.close} onClick={actions.close}><ChatIcon name="chevron-down" /></button>
    </header>
    <ContactStrip c={c} contacts={props.contacts} />
    <div className="fy-body-wrap">
      <div className="fy-body" ref={props.historyRef} role="log" aria-live="polite" aria-relevant="additions text" aria-busy={busy}>
        <div className="fy-thread" data-welcome={messages.length === 0}>
          {messages.length === 0 ? <><span className="fy-day">{c.today}</span><Who c={c} /><p className="fy-message fy-bot">{c.welcome}</p>
            <div className="fy-chips">{c.chips.map(text => <button type="button" className="fy-chip" key={text} disabled={busy} onClick={() => actions.chip(text)}>{text}</button>)}</div></> : null}
          {messages.map(message => {
            if (!message.parts.some(p => p.type === 'text' ? !!p.text.trim() : 'output' in p && !!p.output)) return null;
            const firstText = message.parts.findIndex(p => p.type === 'text' && !!p.text.trim());
            return <div className="fy-message-group" key={message.id}>
              {message.role === 'assistant' ? <Who c={c} /> : null}
              {message.parts.map((part, index) => {
                if (part.type === 'text' && !part.text.trim()) return null;
                if (part.type === 'text') return summary?.messageId === message.id
                  ? index === firstText ? <SummaryCard key={index} summary={summary} props={props} /> : null
                  : <p className={'fy-message ' + (message.role === 'user' ? 'fy-user' : 'fy-bot')} key={index}>{part.text}</p>;
                if (!('output' in part) || !part.output || typeof part.output !== 'object') return null;
                return <ToolCard key={index} output={part.output as Output} input={'input' in part ? part.input : undefined} props={props} />;
              })}
            </div>;
          })}
          {busy ? <div className="fy-message-group"><Who c={c} /><div className="fy-message fy-bot fy-typing" role="status">
            <span className="fy-typing-dots" aria-hidden="true">{[0, 1, 2].map(index => <i key={index} style={{ opacity: props.typingPhase === index ? 1 : .35, transform: props.typingPhase === index ? 'translateY(-2px)' : 'none' }} />)}</span><span>{c.typing}</span>
          </div></div> : null}
          {hasQuote && !busy && !summary && !issue ? <div className="fy-chips">{c.quoteChips.map(text => <button className="fy-chip" type="button" key={text} onClick={() => actions.chip(text)}>{text}</button>)}</div> : null}
          {issue ? <IssueCard issue={issue} props={props} /> : null}
        </div>
      </div>
      {props.menuOpen ? <button type="button" className="fy-scrim" aria-label={c.closeMenu} onClick={actions.toggleMenu} /> : null}
    </div>
    <form className="fy-footer" onSubmit={actions.submit}>
      <button type="button" className={'fy-confirm ' + (summary && summaryRead && !busy ? 'fy-on' : 'fy-off')} disabled={busy || !summary || !summaryRead} onClick={actions.confirm}>
        {c.confirm}{!summary || !summaryRead ? <small>{c.confirmHint}</small> : null}
      </button>
      <label htmlFor="ai-chat-input" className="fy-sr-only">{c.input}</label>
      <div className="fy-input-wrap">
        <textarea ref={props.inputRef} id="ai-chat-input" rows={1} maxLength={4000} value={input} placeholder={c.input} aria-invalid={count > 1000 || undefined}
          aria-describedby="ai-chat-meta ai-chat-count" onChange={event => actions.input(event.target.value)} />
        {busy ? <button className="fy-send fy-stop" type="button" aria-label={c.stop} onClick={actions.stop}><ChatIcon name="stop" /></button>
          : <button className={'fy-send' + (!input.trim() || count > 1000 ? ' fy-off' : '')} type="submit" aria-label={c.send} disabled={!input.trim() || count > 1000}><ChatIcon name="send" /></button>}
      </div>
      <div className="fy-meta"><span id="ai-chat-meta">{busy ? c.stopping : c.meta}</span><span id="ai-chat-count" aria-label={c.counter} className={count > 1000 ? 'fy-over' : undefined}>{count}/1000</span></div>
    </form>
    {props.menuOpen ? <div className="fy-menu" role="listbox" id="ai-chat-languages" aria-label={c.language}>
      <div className="fy-menu-heading">{c.language}</div>
      {LANGUAGES.map(language => <button type="button" className={'fy-option' + (locale === language.value ? ' fy-on' : '')} key={language.value}
        role="option" aria-label={language.label} aria-selected={locale === language.value} onClick={() => actions.locale(language.value)}>
        <span>{language.label}{language.detail ? <small>{language.detail}</small> : null}</span>{locale === language.value ? <span className="fy-current">{c.current}</span> : null}
      </button>)}
      <div className="fy-menu-footer">{c.languageHelp}</div>
    </div> : null}
  </section>;
}
