const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
const db = new PGlite();
// Exercise the actual parameterized reminder SQL against memory PostgreSQL only.
mock('@/lib/prisma', { prisma: { $executeRaw: async (strings, ...values) => {
  const sql = strings.reduce((out, part, i) => out + (i ? `$${i}` : '') + part, '');
  return (await db.query(sql, values)).affectedRows;
} } });
const reminder = load('lib/operations/fridayReminder.ts');
test('reminder migration is additive, repeatable, unique by date and compatible with actual claim/release SQL', async (t) => {
  try {
    const sql = fs.readFileSync('prisma/migrations/202611110001_friday_reminder_sends/migration.sql', 'utf8');
    await db.exec(sql);
    await db.query('INSERT INTO friday_reminder_sends (reminder_date) VALUES ($1)', ['2026-11-06']);
    await db.exec(sql);
    await assert.rejects(db.query('INSERT INTO friday_reminder_sends (reminder_date) VALUES ($1)', ['2026-11-06']), /duplicate key/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM friday_reminder_sends')).rows[0].n, 1);
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-12T17:00:00Z') });
    Object.assign(process.env, { FRIDAY_TELEGRAM_REMIND_ENABLED: 'true', TELEGRAM_BOT_TOKEN: 'fixture-bot-token', TELEGRAM_BOSS_CHAT_ID: '123456789' });
    let calls = 0;
    global.fetch = async () => { calls++; throw new Error('mock transport failure'); };
    assert.deepEqual(await reminder.sendFridayHighlightsReminder(), { sent: false, reason: 'delivery_failed' });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM friday_reminder_sends')).rows[0].n, 1);
    global.fetch = async () => { calls++; return Response.json({ ok: true }); };
    assert.deepEqual(await reminder.sendFridayHighlightsReminder(), { sent: true });
    assert.deepEqual(await reminder.sendFridayHighlightsReminder(), { sent: false, reason: 'already_sent' });
    assert.equal(calls, 2);
    const rows = (await db.query('SELECT reminder_date, created_at IS NOT NULL AS has_created_at FROM friday_reminder_sends ORDER BY reminder_date')).rows;
    assert.deepEqual(rows, [{ reminder_date: '2026-11-06', has_created_at: true }, { reminder_date: '2026-11-13', has_created_at: true }]);
  } finally { await db.close(); }
});
