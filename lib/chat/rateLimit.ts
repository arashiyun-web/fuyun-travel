import { createHash } from 'crypto';
import { AiApiError } from '@/lib/aiApi/errors';
import type { SqlDatabase } from '@/lib/aiApi/store';
export function ipSubject(headers: Headers) {
  return createHash('sha256').update(headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown').digest('hex');
}
export type Limit = { subject: string; scope: string; limit: number; start: Date; end: Date };
export function limitsFor(subject: string, kind: 'request' | 'booking', now: Date): Limit[] {
  const bucket = (scope: string, limit: number, size: number, target = subject) => {
    const offset = size === 86400000 ? 28800000 : 0;
    const start = Math.floor((now.getTime() + offset) / size) * size - offset;
    return { subject: target, scope, limit, start: new Date(start), end: new Date(start + size) };
  };
  return kind === 'request'
    ? [bucket('request_minute', 10, 60000), bucket('request_day', 100, 86400000), bucket('site_day', 2000, 86400000, 'site')]
    : [bucket('booking_hour', 3, 3600000), bucket('booking_day', 10, 86400000)];
}
export function limited(limit: Limit, now: Date): never {
  throw new AiApiError(429, 'Rate limit exceeded', Math.max(1, Math.ceil((limit.end.getTime() - now.getTime()) / 1000)));
}
export class MemoryRateLimiter {
  private counts = new Map<string, { count: number; end: number }>();
  private key(v: Limit) { return v.subject + ':' + v.scope + ':' + v.start.getTime(); }
  check(limits: Limit[], now: Date) {
    this.counts.forEach((value, key) => { if (value.end <= now.getTime()) this.counts.delete(key); });
    for (const value of limits) if ((this.counts.get(this.key(value))?.count ?? 0) >= value.limit) limited(value, now);
    if (this.counts.size > 50000) throw new AiApiError(503, 'Service temporarily unavailable');
  }
  release(limits: Limit[]) {
    for (const value of limits) {
      const current = this.counts.get(this.key(value));
      if (current) current.count = Math.max(0, current.count - 1);
    }
  }
  consume(limits: Limit[], now: Date) {
    this.check(limits, now);
    for (const value of limits) {
      const key = this.key(value);
      this.counts.set(key, { count: (this.counts.get(key)?.count ?? 0) + 1, end: value.end.getTime() });
    }
  }
}
export async function consumeLimits(db: SqlDatabase, limits: Limit[], now: Date) {
  for (const value of limits) {
    const [row] = await db.query<{ count: number }>('INSERT INTO chat_rate_counters (subject,scope,window_start,count,expires_at) VALUES ($1,$2,$3,1,$4) ON CONFLICT (subject,scope,window_start) DO UPDATE SET count=chat_rate_counters.count+1 WHERE chat_rate_counters.count < $5 RETURNING count',
      [value.subject, value.scope, value.start, value.end, value.limit]);
    if (!row) limited(value, now);
  }
}
