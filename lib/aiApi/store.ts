import type { ToolEvent } from './events';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { taipeiDate, validateInput, type BookingInput } from './schema.mjs';
import { AiApiError } from './errors';
export type Identity = { id: string; name: string };
export type BookingRecord = { id: string; booking_number: string; status: 'pending_review' | 'confirmed' | 'rejected'; is_test: boolean };
export interface SqlDatabase {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (db: SqlDatabase) => Promise<T>): Promise<T>;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function windowOf(scope: string, now: Date) {
  const size = scope === 'minute' ? 60000 : scope === 'booking_hour' ? 3600000 : 86400000;
  const offset = scope === 'day' ? 8 * 3600000 : 0;
  const start = Math.floor((now.getTime() + offset) / size) * size - offset;
  return { start: new Date(start), end: new Date(start + size) };
}
async function consume(db: SqlDatabase, id: string, scope: string, limit: number, now: Date) {
  const window = windowOf(scope, now);
  const [row] = await db.query<{ count: number }>(`INSERT INTO api_rate_counters (api_key_id,scope,window_start,count,expires_at)
    VALUES ($1,$2,$3,1,$4) ON CONFLICT (api_key_id,scope,window_start)
    DO UPDATE SET count=api_rate_counters.count+1 RETURNING count`, [id, scope, window.start, window.end]);
  if (row.count > limit) throw new AiApiError(429, 'Rate limit exceeded', Math.max(1, Math.ceil((window.end.getTime() - now.getTime()) / 1000)));
}
export function createAiStore(db: SqlDatabase) {
  return {
    async recordToolEvent(event: ToolEvent) {
      const { id, created_at, source, tool, outcome, latency_ms, prompt_version, model_id, subject, booking_id, input_digest, error_code } = event;
      await db.query("INSERT INTO ai_tool_events (id,created_at,source,tool,outcome,latency_ms,prompt_version,model_id,subject,booking_id,input_digest,error_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [id,created_at,source,tool,outcome,latency_ms,prompt_version,model_id,subject,booking_id,input_digest,error_code]);
    },

    async authorize(key: string, now: Date): Promise<Identity> {
      return db.transaction(async tx => {
        const [identity] = await tx.query<Identity>('SELECT id,name FROM api_keys WHERE key_hash=$1 AND disabled_at IS NULL FOR UPDATE', [hash(key)]);
        if (!identity) throw new AiApiError(401, 'Invalid or disabled API key');
        try {
          await consume(tx, identity.id, 'minute', 30, now);
          await consume(tx, identity.id, 'day', 1000, now);
        } catch (error) { if (error instanceof AiApiError) error.subject = identity.id; throw error; }
        await tx.query('UPDATE api_keys SET last_used_at=$2 WHERE id=$1', [identity.id, now]);
        return identity;
      });
    },
    async createBooking(identity: Identity, input: BookingInput, idempotency: string | null, now: Date): Promise<{ booking: BookingRecord; replay: boolean }> {
      return db.transaction(async tx => {
        const [active] = await tx.query<Identity>('SELECT id,name FROM api_keys WHERE id=$1 AND disabled_at IS NULL FOR UPDATE', [identity.id]);
        if (!active) throw new AiApiError(401, 'Invalid or disabled API key');
        const keyHash = idempotency ? hash(idempotency) : null;
        if (keyHash) {
          await tx.query('UPDATE ai_bookings SET idempotency_key=NULL WHERE api_key_id=$1 AND idempotency_key=$2 AND idempotency_expires_at <= $3', [identity.id, keyHash, now]);
          const [existing] = await tx.query<BookingRecord>('SELECT id,booking_number,status,is_test FROM ai_bookings WHERE api_key_id=$1 AND idempotency_key=$2 AND idempotency_expires_at > $3', [identity.id, keyHash, now]);
          if (existing) return { booking: existing, replay: true };
        }
        // Dynamic date validation belongs after a valid replay lookup: midnight cannot invalidate a 24h replay.
        const validated = validateInput('create_booking', input, now);
        if (!validated.success) throw new AiApiError(400, 'Invalid input', undefined, validated.error.issues.map(i => ({ path: i.path, message: i.message })));
        await consume(tx, identity.id, 'booking_hour', 20, now);
        const test = active.name.startsWith('TEST-');
        for (let attempt = 0; attempt < 8; attempt++) {
          const number = `FY-${test ? 'TEST-' : ''}${taipeiDate(now).replace(/-/g, '')}-${randomInt(36 ** 4).toString(36).toUpperCase().padStart(4, '0')}`;
          const [booking] = await tx.query<BookingRecord>(`INSERT INTO ai_bookings
            (id,booking_number,api_key_id,contact_name,phone,email,date,end_date,time,pickup,destination,passenger_count,vehicle,notes,quote_range,is_test,idempotency_key,idempotency_expires_at,notification_retry_key,created_at,updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,$20,$20)
            ON CONFLICT (booking_number) DO NOTHING RETURNING id,booking_number,status,is_test`,
          [randomUUID(), number, identity.id, input.contact_name, input.phone, input.email ?? null, input.date, input.end_date ?? null, input.time,
            input.pickup, input.destination, input.passenger_count, input.vehicle ?? null, input.notes ?? null,
            input.quote_range ? JSON.stringify(input.quote_range) : null, test, keyHash, keyHash ? new Date(now.getTime() + 86400000) : null, randomUUID(), now]);
          if (booking) return { booking, replay: false };
        }
        throw new AiApiError(503, 'Could not allocate a booking number; please retry');
      });
    },
    async notificationFailed(id: string) {
      await db.query("UPDATE ai_bookings SET notification_status='failed',notification_last_error='通知未送達',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND notification_status <> 'sent' AND (notification_claim IS NULL OR notification_claim_expires_at <= CURRENT_TIMESTAMP)", [id]);
    },
  };
}
export type AiStore = ReturnType<typeof createAiStore>;
