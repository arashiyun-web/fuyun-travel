const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mock, load } = require('./test-support/step2-load-ts.cjs');
let stored, events, lineCalls, emailCalls, logs, failLine, failEmail, failDatabase;
const dates = { createdAt: new Date('2026-11-11'), updatedAt: new Date('2026-11-11') };
mock('@/lib/prisma', { prisma: { inquiry: {
  create: async ({ data }) => { if (failDatabase) throw new Error('private-database-fixture'); events.push('stored'); return stored = { ...data, ...dates }; },
  findUnique: async () => stored,
  update: async ({ data }) => stored = { ...stored, ...data },
} } });
mock('@/lib/lineApi', { pushLineText: async (id, text) => {
  events.push('line'); lineCalls.push({ id, text });
  if (failLine && id === 'mock-line-one') throw new Error('should-not-appear-in-logs');
} });
mock('nodemailer', { createTransport: () => ({ sendMail: async (mail) => {
  emailCalls.push(mail);
  if (failEmail && mail.to === 'one@example.invalid') throw new Error('should-not-appear-in-logs');
} }) });
const channelKeys = ['INQUIRY_NOTIFY_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'INQUIRY_TO_EMAIL', 'INQUIRY_FROM_EMAIL', 'LINE_ADMIN_USER_ID', 'ADMIN_LINE_USER_ID', 'LINE_CHANNEL_ACCESS_TOKEN'];
const mockConfig = {
  SMTP_HOST: 'smtp.example.invalid', SMTP_USER: 'mock-sender@example.invalid', SMTP_PASS: 'mock-only',
  INQUIRY_FROM_EMAIL: 'sender@example.invalid', INQUIRY_TO_EMAIL: ' one@example.invalid, two@example.invalid,one@example.invalid, ',
  LINE_ADMIN_USER_ID: ' mock-line-one, mock-line-two,mock-line-one, ', LINE_CHANNEL_ACCESS_TOKEN: 'mock-only',
};
process.env.ADMIN_USERNAME = 'mock-admin';
process.env.ADMIN_PASSWORD_SALT = 'mock-salt';
process.env.ADMIN_PASSWORD_HASH = 'ab'.repeat(64);
process.env.JWT_SECRET = 'synthetic-test-session-signing-key-32chars';
const { createAdminToken, ADMIN_COOKIE_NAME } = load('lib/adminAuth.ts');
const token = createAdminToken();
// Import with every channel unset: no import-time requirement or exception.
for (const key of channelKeys) delete process.env[key];
const route = load('app/api/inquiry/route.ts');
const payload = { name: 'synthetic inquiry', phone: '0900000000', start_date: '2026-12-01', passenger_count: 4, trip_type: '包車', pickup_location: '台北', destination: '九份' };
let seq = 0;
const request = (method, data, headers = {}) => new Request('http://localhost/api/inquiry', {
  method, headers: { 'x-forwarded-for': `test-${seq++}`, ...headers }, body: JSON.stringify(data),
});
async function scenario(config, fn) {
  for (const key of channelKeys) delete process.env[key];
  Object.assign(process.env, config); // Synthetic, in-process fixtures only. No .env or external settings.
  stored = null; events = []; lineCalls = []; emailCalls = []; logs = []; failLine = false; failEmail = false; failDatabase = false;
  const logger = console.error;
  console.error = (...args) => logs.push(args);
  try { await fn(); } finally { console.error = logger; }
}
async function submit() {
  const r = await route.POST(request('POST', payload));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).success, true);
  assert.equal(stored.status, 'New');
}
test('disabled exactTrue variants suppress all pre/post sends even with complete channels', async () => {
  for (const value of [undefined, 'false', 'TRUE', '1', 'yes', ' true ', 'true ']) {
    await scenario({ ...mockConfig, ...(value === undefined ? {} : { INQUIRY_NOTIFY_ENABLED: value }) }, async () => {
      await submit(); assert.equal(emailCalls.length, 0); assert.equal(lineCalls.length, 0);
    });
  }
});
test('enabled without channels persists successfully and logs only presence booleans', async () => {
  await scenario({ INQUIRY_NOTIFY_ENABLED: 'true' }, async () => {
    await submit(); assert.equal(emailCalls.length, 0); assert.equal(lineCalls.length, 0);
    for (const [, detail] of logs) for (const value of Object.values(detail || {})) assert.equal(typeof value, 'boolean');
  });
});
test('enabled sends once to each email and each LINE recipient in each pre/post stage', async () => {
  await scenario({ ...mockConfig, INQUIRY_NOTIFY_ENABLED: 'true' }, async () => {
    await submit();
    assert.deepEqual(emailCalls.map((c) => c.to).sort(), ['one@example.invalid', 'two@example.invalid']);
    for (const id of ['mock-line-one', 'mock-line-two']) {
      const messages = lineCalls.filter((c) => c.id === id);
      assert.equal(messages.length, 2);
      assert.equal(messages.filter((c) => c.text.includes('備援')).length, 1);
      assert.equal(messages.filter((c) => c.text.includes('已存入系統】')).length, 1);
    }
    assert.deepEqual(events, ['line', 'line', 'stored', 'line', 'line']);
  });
});
test('legacy LINE recipient list works; missing channel token skips LINE', async () => {
  await scenario({ ...mockConfig, INQUIRY_NOTIFY_ENABLED: 'true', LINE_ADMIN_USER_ID: '', ADMIN_LINE_USER_ID: 'mock-line-one,mock-line-two' }, async () => {
    await submit(); assert.equal(lineCalls.length, 4);
  });
  await scenario({ ...mockConfig, INQUIRY_NOTIFY_ENABLED: 'true', LINE_CHANNEL_ACCESS_TOKEN: '' }, async () => {
    await submit(); assert.equal(lineCalls.length, 0); assert.equal(emailCalls.length, 2);
  });
});
test('recipient failures do not block remaining recipients or inquiry success; error contents stay private', async () => {
  await scenario({ ...mockConfig, INQUIRY_NOTIFY_ENABLED: 'true' }, async () => {
    failLine = true; failEmail = true;
    await submit();
    assert.equal(lineCalls.filter((c) => c.id === 'mock-line-two').length, 2);
    assert.equal(emailCalls.filter((c) => c.to === 'two@example.invalid').length, 1);
    assert.equal(JSON.stringify(logs).includes('should-not-appear-in-logs'), false);
  });
});
test('authenticated status persists New → Quoted → Confirmed and Cancelled; rejects anonymous/cross-origin', async () => {
  await scenario({}, async () => {
    await submit();
    for (const status of ['Quoted', 'Confirmed', 'Cancelled']) {
      const r = await route.PATCH(request('PATCH', { id: stored.id, status }, { authorization: `Bearer ${token}` }));
      assert.equal(r.status, 200); assert.equal((await r.json()).inquiry.status, status); assert.equal(stored.status, status);
    }
    assert.equal((await route.PATCH(request('PATCH', { id: stored.id, status: 'New' }))).status, 401);
    assert.equal((await route.PATCH(request('PATCH', { id: stored.id, status: 'Cancelled' }, { cookie: `${ADMIN_COOKIE_NAME}=${token}`, origin: 'http://localhost' }))).status, 200);
    assert.equal((await route.PATCH(request('PATCH', { id: stored.id, status: 'New' }, { cookie: `${ADMIN_COOKIE_NAME}=${token}`, origin: 'http://evil.invalid' }))).status, 401);
    assert.equal(stored.status, 'Cancelled');
  });
});

test('database failure logs do not expose raw exception contents', async () => {
  await scenario({ ...mockConfig, INQUIRY_NOTIFY_ENABLED: 'true' }, async () => {
    failDatabase = true;
    const r = await route.POST(request('POST', payload));
    assert.equal(r.status, 500);
    assert.equal(lineCalls.length, 2); // independent fallback already reached both staff
    assert.equal(emailCalls.length, 0);
    assert.equal(require('node:util').inspect(logs).includes('private-database-fixture'), false);
  });
});
