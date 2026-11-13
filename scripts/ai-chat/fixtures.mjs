import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
const { load } = require('../test-support/step2-load-ts.cjs');
const root = process.cwd();
function feature(file) { assert.ok(existsSync(root + '/' + file), file + ' must be implemented'); return load(file); }
const now = new Date('2099-12-01T00:00:00Z');
export const trip = { pickup: '台北車站', destination: '九份', date: '2099-12-04', passenger_count: 6, vehicle: 'van' };
export const booking = { trip, contact_name: '離線旅客', contact_channel: 'wechat', contact_id: 'offline_guest', time: '09:00', luggage_count: 4, customer_confirmed: true };
export async function fixture() {
  const { createChatStore } = feature('lib/chat/store.ts');
  const pg = new PGlite();
  await pg.exec(readFileSync(root + '/prisma/migrations/202611130001_ai_api/migration.sql', 'utf8'));
  assert.ok(existsSync(root + '/prisma/migrations/202611130002_ai_chat_widget/migration.sql'));
  await pg.exec(readFileSync(root + '/prisma/migrations/202611130002_ai_chat_widget/migration.sql', 'utf8'));
  const adapter = client => ({
    query: async (sql, values = []) => (await client.query(sql, values)).rows,
    transaction: fn => client.transaction(tx => fn(adapter(tx))),
  });
  const db = adapter(pg);
  const { MemoryRateLimiter } = feature('lib/chat/rateLimit.ts');
  const memory = new MemoryRateLimiter();
  const store = createChatStore(db, memory, () => 'preview');
  const { AiApiService } = load('lib/aiApi/service.ts');
  const { createAiStore } = load('lib/aiApi/store.ts');
  const api = new AiApiService(createAiStore(db), async () => {}, () => now);
  return { pg, db, memory, store, api, quote: () => api.execute('get_quote', trip, { id: 'unused', name: 'web_chat' }, null, { record: false }) };
}

export { now, feature, load, root };
