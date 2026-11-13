import { createHash, randomInt, randomUUID } from 'crypto';
import { AiApiError } from '@/lib/aiApi/errors';
import { createAiStore, type SqlDatabase, type BookingRecord } from '@/lib/aiApi/store';
import { taipeiDate, validateInput } from '@/lib/aiApi/schema.mjs';
import { inputDigest } from '@/lib/aiApi/events';
import { chatBookingSchema, type ChatBooking } from './schema';
import { MemoryRateLimiter, limitsFor, consumeLimits, limited } from './rateLimit';
export function createChatStore(db: SqlDatabase, memory = new MemoryRateLimiter(), environment = () => process.env.VERCEL_ENV) {
  const base = createAiStore(db);
  return {
    notificationFailed: base.notificationFailed, recordToolEvent: base.recordToolEvent,
    async admit(subject: string, now: Date) {
      const limits = limitsFor(subject, 'request', now);
      memory.consume(limits, now);
      await db.transaction(tx => consumeLimits(tx, limits, now));
    },
    async reserveBooking(subject: string, now: Date) {
      const limits = limitsFor(subject, 'booking', now);
      memory.consume(limits, now);
      try { await db.transaction(tx => consumeLimits(tx, limits, now)); }
      catch (error) { memory.release(limits); throw error; }
    },
    async releaseBooking(subject: string, now: Date) {
      const limits = limitsFor(subject, 'booking', now);
      await db.transaction(async tx => {
        for (const value of limits) await tx.query('UPDATE chat_rate_counters SET count=GREATEST(0,count-1) WHERE subject=$1 AND scope=$2 AND window_start=$3', [value.subject, value.scope, value.start]);
      });
      memory.release(limits);
    },
    async bookingCapacity(subject: string, now: Date) {
      const limits = limitsFor(subject, 'booking', now); memory.check(limits, now);
      for (const value of limits) {
        const [row] = await db.query<{ count: number }>('SELECT count FROM chat_rate_counters WHERE subject=$1 AND scope=$2 AND window_start=$3', [value.subject, value.scope, value.start]);
        if (row && row.count >= value.limit) limited(value, now);
      }
    },
    async createBooking(subject: string, conversation: string, raw: ChatBooking, now: Date, referenceQuote: () => Promise<unknown>, reserved = false) {
      const input = chatBookingSchema.parse(raw);
      const key = createHash('sha256').update(conversation + '\n' + inputDigest(input)).digest('hex');
      const limits = limitsFor(subject, 'booking', now);
      const result = await db.transaction(async tx => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
        const [existing] = await tx.query<BookingRecord>("SELECT id,booking_number,status,is_test FROM ai_bookings WHERE source='web_chat' AND idempotency_key=$1 AND idempotency_expires_at > $2", [key, now]);
        if (existing) return { booking: existing, replay: true };
        if (!reserved) memory.check(limits, now);
        const valid = validateInput('get_quote', input.trip, now);
        if (!valid.success) throw new AiApiError(400, 'Invalid trip date');
        if (!reserved) await consumeLimits(tx, limits, now);
        const quote = await referenceQuote();
        await tx.query("UPDATE ai_bookings SET idempotency_key=NULL WHERE source='web_chat' AND idempotency_key=$1 AND idempotency_expires_at <= $2", [key, now]);
        const test = environment() !== 'production';
        for (let attempt = 0; attempt < 8; attempt++) {
          const number = 'FY-' + (test ? 'TEST-' : '') + taipeiDate(now).replace(/-/g, '') + '-' + randomInt(36 ** 4).toString(36).toUpperCase().padStart(4, '0');
          const sql = "INSERT INTO ai_bookings (id,booking_number,api_key_id,source,contact_name,phone,contact_channel,contact_id,luggage_count,date,end_date,time,pickup,destination,passenger_count,vehicle,notes,quote_range,status,is_test,idempotency_key,idempotency_expires_at,notification_retry_key,created_at,updated_at) VALUES ($1,$2,NULL,'web_chat',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,'pending_review',$17,$18,$19,$20,$21,$21) ON CONFLICT (booking_number) DO NOTHING RETURNING id,booking_number,status,is_test";
          const [booking] = await tx.query<BookingRecord>(sql, [randomUUID(), number, input.contact_name, input.phone || null, input.contact_channel, input.contact_id || null, input.luggage_count,
            input.trip.date, input.trip.end_date || null, input.time, input.trip.pickup, input.trip.destination, input.trip.passenger_count,
            input.trip.vehicle || null, input.trip.notes || null, JSON.stringify(quote), test, key, new Date(now.getTime() + 86400000), randomUUID(), now]);
          if (booking) return { booking, replay: false };
        }
        throw new AiApiError(503, 'Please retry later');
      });
      if (!result.replay && !reserved) memory.consume(limits, now);
      return result;
    },
  };
}
export type ChatStore = ReturnType<typeof createChatStore>;
