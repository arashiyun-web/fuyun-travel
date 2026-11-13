import { convertToModelMessages, createUIMessageStreamResponse, stepCountIs, streamText, tool, type LanguageModel, type UIMessageChunk } from 'ai';
import { AiApiError, errorResponse } from '@/lib/aiApi/errors';
import type { AiApiService } from '@/lib/aiApi/service';
import { quoteSchema, availabilitySchema, type Operation } from '@/lib/aiApi/schema.mjs';
import { emitToolEvent, toolEvent, type ToolEvent } from '@/lib/aiApi/events';
import { chatBookingSchema } from './schema';
import { parseChatRequest } from './request';
import { ipSubject } from './rateLimit';
import { customerConfirmed, isConfirmation, safeModelText, replyLocale } from './guard';
import { CHAT_SYSTEM_PROMPT, QUOTE_NOTICES, BOOKING_NOTICES, PROMPT_VERSION } from './systemPrompt';
import type { ChatStore } from './store';
type Dependencies = { apiKey: () => string | undefined; modelName: () => string | undefined; model: (name: string) => LanguageModel; store: ChatStore; aiApi: AiApiService; notify: (id: string) => Promise<unknown>; now?: () => Date };
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}
function redactSecret(value: string) {
  return value
    .replace(/sk-[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/fyk_[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]');
}
function logChatStreamError({ error }: { error: unknown }) {
  const rec = asRecord(error) || {};
  const cause = asRecord(rec.cause);
  const data = asRecord(rec.data);
  const inner = asRecord(data?.error) || asRecord(rec.error);
  const status = rec.status ?? rec.statusCode ?? cause?.status ?? cause?.statusCode ?? inner?.status;
  const code = inner?.code ?? rec.code ?? cause?.code;
  const type = (typeof inner?.type === 'string' && inner.type) || (error instanceof Error ? error.name : typeof error);
  const rawMessage = inner?.message ?? rec.message ?? cause?.message ?? (error instanceof Error ? error.message : '');
  const message = redactSecret(String(rawMessage ?? '')).slice(0, 500);
  console.error('chat.stream', { type, status: status ?? null, code: code ?? null, message });
}
export function createChatHandler(deps: Dependencies) {
  return async function POST(request: Request) {
    let releasePending: (() => Promise<void>) | undefined;
    try {
      const body = await parseChatRequest(request);
      const modelName = deps.modelName?.()?.trim();
      if (!deps.apiKey()?.trim() || !modelName) throw new AiApiError(503, 'Service temporarily unavailable. Please use the contact buttons.');
      const now = deps.now?.() || new Date();
      const subject = ipSubject(request.headers);
      const latest = body.messages.at(-1)?.parts.filter(p => p.type === 'text').map(p => p.text).join('') || '';
      body.locale = replyLocale(latest, body.locale);
      await deps.store.admit(subject, now);
      const reserved = isConfirmation(latest);
      if (reserved) await deps.store.reserveBooking(subject, now);
      let bookingCommitted = false; let bookingAttempted = false; let reservationClosing = false;
      let activeBooking: ReturnType<ChatStore['createBooking']> | undefined;
      let reservationCleanup: Promise<void> | undefined;
      const settleReservation = () => {
        if (!reservationCleanup) {
          reservationClosing = true;
          reservationCleanup = (async () => {
            await activeBooking?.catch(() => undefined);
            if (reserved && !bookingCommitted) await deps.store.releaseBooking(subject, now).catch(() => {});
          })();
        }
        return reservationCleanup;
      };
      releasePending = settleReservation;
      const seen = new Set<string>();
      const pending: ToolEvent[] = [];
      const prices = new Set<number>();
      const identity = { id: 'web_chat', name: 'web_chat' };
      const observe = (name: Operation, input: unknown, started: number, status: number, bookingId: string | null = null) => {
        pending.push(toolEvent({ source: 'web_chat', tool: name, outcome: status === 200 ? 'ok' : status === 429 ? 'limited' : status === 400 ? 'invalid' : 'error',
          latency_ms: Math.max(0, Date.now() - started), prompt_version: PROMPT_VERSION, model_id: null,
          subject, booking_id: bookingId, error_code: status === 200 ? null : String(status) }, input));
      };
      const run = async (name: Operation, input: unknown, callId: string, fn: () => Promise<Record<string, unknown>>) => {
        seen.add(callId); const started = Date.now();
        try {
          const output = await fn();
          const bookingId = typeof output._bookingId === 'string' ? output._bookingId : null;
          delete output._bookingId;
          observe(name, input, started, 200, bookingId); return output;
        } catch (error) {
          const status = error instanceof AiApiError ? error.status : 503;
          observe(name, input, started, status);
          return { kind: 'error', status, retry_after: error instanceof AiApiError ? error.retryAfter : undefined,
            message: status === 400 ? 'Please review the order summary and explicitly confirm before booking.' : 'Please use the contact buttons or try again later.' };
        }
      };
      const tools = {
        get_quote: tool({ description: 'Get the unchanged reference quote from the shared service; staff must confirm. Choose van for 5–8 passengers or heavy luggage; five-seat prices may be unavailable.',
          inputSchema: quoteSchema, execute: (input, options) => run('get_quote', input, options.toolCallId, async () => {
            const quote = await deps.aiApi.execute('get_quote', input, identity, null, { record: false });
            if ('low' in quote && typeof quote.low === 'number') prices.add(quote.low);
            if ('high' in quote && typeof quote.high === 'number') prices.add(quote.high);
            return { kind: 'quote', quote, notice: QUOTE_NOTICES[body.locale] };
          }) }),
        check_availability: tool({ description: 'Always pending_human_confirmation; no live inventory or reservation.', inputSchema: availabilitySchema,
          execute: (input, options) => run('check_availability', input, options.toolCallId, async () => ({
            ...await deps.aiApi.execute('check_availability', input, identity, null, { record: false }), kind: 'availability',
            notice: body.locale === 'en' ? 'Availability is pending human confirmation.' : body.locale === 'zh-CN' ? '车况待专人确认。' : '車況待專人確認。',
          })) }),
        create_booking: tool({ description: 'Create pending_review only after showing the exact trip/contact summary, then receiving 我確認 / 我确认 / I confirm. Never reserve vehicles or take payment.',
          inputSchema: chatBookingSchema, execute: (input, options) => run('create_booking', input, options.toolCallId, async () => {
            if (!reserved || reservationClosing || bookingAttempted || !customerConfirmed(body.messages, input)) throw new AiApiError(400, 'Explicit confirmation required');
            bookingAttempted = true;
            activeBooking = deps.store.createBooking(subject, body.id, input, now,
              () => deps.aiApi.execute('get_quote', input.trip, identity, null, { record: false }), true).then(result => {
                if (!result.replay) bookingCommitted = true;
                return result;
              });
            const result = await activeBooking;
            if (!result.replay) {
              try { await deps.notify(result.booking.id); } catch { await deps.store.notificationFailed(result.booking.id).catch(() => {}); }
            }
            return { kind: 'booking', booking_number: result.booking.booking_number, status: result.booking.status, is_test: result.booking.is_test,
              replay: result.replay, notice: BOOKING_NOTICES[body.locale], _bookingId: result.booking.id };
          }) }),
      };
      const flush = async (modelId: string | null) => {
        for (const event of pending.splice(0)) await emitToolEvent({ ...event, model_id: modelId }, deps.store.recordToolEvent);
      };
      const result = streamText({
        model: deps.model(modelName), system: CHAT_SYSTEM_PROMPT + '\nInterface language: ' + body.locale,
        messages: await convertToModelMessages(body.messages.slice(-20)),
        tools, maxOutputTokens: 800, stopWhen: stepCountIs(5), maxRetries: 0, abortSignal: request.signal,
        onError: logChatStreamError,
        onStepEnd: async event => {
          for (const call of event.toolCalls) if (Object.hasOwn(tools, call.toolName) && !seen.has(call.toolCallId)) {
            seen.add(call.toolCallId); observe(call.toolName as Operation, call.input, Date.now(), 400);
          }
          await flush(event.response.modelId || null);
        },
        onAbort: async () => { await flush(null); await settleReservation(); },
      });
      // Buffer each text block until its end so prohibited text split over deltas cannot leak.
      const buffered = new Map<string, string>();
      const guarded = result.toUIMessageStream({ sendReasoning: false, onError: () => 'Service temporarily unavailable. Please use the contact buttons.' })
        .pipeThrough(new TransformStream<UIMessageChunk, UIMessageChunk>({
          transform(chunk, controller) {
            if (chunk.type === 'text-delta') { buffered.set(chunk.id, (buffered.get(chunk.id) || '') + chunk.delta); return; }
            if (chunk.type === 'text-end') {
              const text = safeModelText(buffered.get(chunk.id) || '', body.locale, prices); buffered.delete(chunk.id);
              if (text) controller.enqueue({ type: 'text-delta', id: chunk.id, delta: text });
            }
            controller.enqueue(chunk);
          },
          async flush() { await flush(null); await settleReservation(); },
        }));
      return createUIMessageStreamResponse({ stream: guarded, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) { await releasePending?.(); return errorResponse(error); }
  };
}
