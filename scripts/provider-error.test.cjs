const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./test-support/step2-load-ts.cjs');
const { sanitizeProviderError, redactSecrets } = load('lib/ai/providerError.ts');

test('redacts key-like strings', () => {
  const raw = 'status 401 invalid x-api-key sk-ant-api03-FAKESECRET_a1b2c3d4e5f6g7h8i9j0 Bearer abcdefghijklmnop';
  const out = redactSecrets(raw);
  assert.equal(out.includes('sk-ant-'), false);
  assert.equal(out.includes('abcdefghijklmnop'), false);
  assert.match(out, /\[REDACTED\]/);
  assert.match(out, /Bearer \[REDACTED\]/);
});

test('reads Anthropic-shaped errors and keeps fields safe', () => {
  const err = new Error('model not found claude-old-99 sk-ant-api03-FAKESECRET_k1l2m3n4o5p6q7r8s9t0');
  err.status = 404;
  err.error = { type: 'error', error: { type: 'not_found_error', message: 'model: claude-old-99' } };
  const sanitized = sanitizeProviderError(err);
  assert.equal(sanitized.provider_status, 404);
  assert.equal(sanitized.provider_error_type, 'not_found_error');
  assert.equal(sanitized.message.includes('sk-ant-'), false);
  assert.match(sanitized.message, /\[REDACTED\]/);
  assert.match(sanitized.message, /model not found/);
});

test('unknown errors yield null status fields and no throw', () => {
  const sanitized = sanitizeProviderError(undefined);
  assert.equal(sanitized.provider_status, null);
  assert.equal(sanitized.provider_error_type, null);
  assert.equal(typeof sanitized.message, 'string');
});
