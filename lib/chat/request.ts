import { z } from 'zod';
import type { UIMessage } from 'ai';
import { AiApiError } from '@/lib/aiApi/errors';
const envelope = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  locale: z.enum(['zh-TW', 'zh-CN', 'en']).default('zh-TW'),
  messages: z.array(z.strictObject({
    id: z.string().min(1).max(128), role: z.enum(['user', 'assistant']),
    parts: z.array(z.strictObject({ type: z.literal('text'), text: z.string() })).min(1).max(20),
  })).min(1).max(30),
});
export async function parseChatRequest(request: Request) {
  if (Number(request.headers.get('Content-Length')) > 32768) throw new AiApiError(413, 'Message too long');
  const reader = request.body?.getReader();
  if (!reader) throw new AiApiError(400, 'Invalid request');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 32768) { await reader.cancel().catch(() => {}); throw new AiApiError(413, 'Message too long'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  let raw: unknown;
  try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AiApiError(400, 'Invalid request'); }
  const parsed = envelope.safeParse(raw);
  if (!parsed.success) throw new AiApiError(400, 'Invalid conversation');
  for (const message of parsed.data.messages) {
    if (Array.from(message.parts.map(p => p.text).join('')).length > 1000) throw new AiApiError(413, 'Message too long');
  }
  if (parsed.data.messages.at(-1)?.role !== 'user') throw new AiApiError(400, 'A user message is required');
  return { ...parsed.data, messages: parsed.data.messages as UIMessage[] };
}
