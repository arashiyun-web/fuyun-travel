import type { Operation } from './schema.mjs';
export type AuditEvent = {
  eventType: 'tool_call' | 'status_change' | 'notification';
  channel: 'rest' | 'mcp' | 'admin' | 'system';
  tool?: Operation; apiKeyId?: string; bookingId?: string;
  outcome: string; httpStatus?: number; durationMs?: number;
  fromStatus?: string; toStatus?: string; actor?: string;
  detail?: { operation?: Operation; replay?: boolean; verification?: 'query_code' | 'phone_last4'; issue_count?: number; recipient_count?: number; reason?: string };
  requestId?: string;
};
export type CallContext = { bookingId?: string };

/** Never copy arbitrary input fields or exception messages into the audit log. */
export function toolDetail(operation: Operation | undefined, input: unknown, result: unknown, issueCount?: number): AuditEvent['detail'] {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const output = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  return { ...(operation ? { operation } : {}),
    ...(operation === 'get_booking_status' ? { verification: typeof source.query_code === 'string' ? 'query_code' as const : 'phone_last4' as const } : {}),
    ...(typeof output.replay === 'boolean' ? { replay: output.replay } : {}),
    ...(issueCount !== undefined ? { issue_count: issueCount } : {}) };
}
