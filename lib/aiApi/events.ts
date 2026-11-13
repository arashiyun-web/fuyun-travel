import { createHash, randomUUID } from 'crypto';
export type ToolEvent = {
  id: string; created_at: string; source: 'api' | 'mcp' | 'web_chat';
  tool: 'get_quote' | 'check_availability' | 'create_booking';
  outcome: 'ok' | 'invalid' | 'limited' | 'error'; latency_ms: number;
  prompt_version: string | null; model_id: string | null; subject: string | null;
  booking_id: string | null; input_digest: string; error_code: string | null;
};
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalized(v)]));
  return typeof value === 'string' ? value.trim().normalize('NFC') : value;
}
export function inputDigest(value: unknown) { return createHash('sha256').update(JSON.stringify(normalized(value)) ?? 'null').digest('hex'); }
export function toolEvent(data: Omit<ToolEvent, 'id' | 'created_at' | 'input_digest'>, input: unknown): ToolEvent {
  return { id: randomUUID(), created_at: new Date().toISOString(), ...data, input_digest: inputDigest(input) };
}
export async function emitToolEvent(event: ToolEvent, write: (event: ToolEvent) => Promise<unknown>, log: (line: string) => void = console.info) {
  const { id, created_at, source, tool, outcome, latency_ms, prompt_version, model_id, subject, booking_id, input_digest, error_code } = event;
  const safe = { id, created_at, source, tool, outcome, latency_ms, prompt_version, model_id, subject, booking_id, input_digest, error_code };
  try { log(JSON.stringify(safe)); } catch {}
  try { await write(safe); } catch { /* Never affect the primary operation. */ }
}
