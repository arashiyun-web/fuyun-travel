import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
test('generated OpenAPI is deterministic, 3.1, authenticated and describes all four operations', async () => {
  assert.ok(existsSync('scripts/ai-api-openapi.mjs'), 'OpenAPI generator must exist');
  const check = spawnSync(process.execPath, ['scripts/ai-api-openapi.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const doc = JSON.parse(readFileSync('public/openapi.json', 'utf8'));
  assert.equal(doc.openapi, '3.1.0');
  assert.ok(doc.paths['/api/public/v1/bookings'].post.responses['200']);
  assert.equal(doc.paths['/api/public/v1/bookings'].post.responses['201'], undefined);
  assert.equal(doc.components.securitySchemes.bearerAuth.scheme, 'bearer');
  assert.deepEqual(Object.values(doc.paths).map(p => p.post.operationId).sort(), ['check_availability','create_booking','get_booking_status','get_quote']);
  assert.equal(doc.components.schemas.create_bookingInput.properties.passenger_count.maximum, 60);
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const validateTime = new Ajv2020().compile(doc.components.schemas.create_bookingInput.properties.time);
  assert.equal(validateTime('09:00'), true);
  assert.equal(validateTime('29:00'), false);
  assert.equal(validateTime('09:00\u0000'), false);
  const { buildOpenApi, checkOpenApi } = await import('./ai-api-openapi.mjs');
  assert.equal(checkOpenApi('{}'), false, 'drift must be rejected');
  assert.deepEqual(buildOpenApi(), doc);
});

test('OpenAPI 3.1 validates with Redocly structural and reference checks', async () => {
  const { createConfig, lintFromString } = await import('@redocly/openapi-core');
  const config = await createConfig({ rules: { struct: 'error', 'no-unresolved-refs': 'error' } });
  const problems = await lintFromString({ source: readFileSync('public/openapi.json', 'utf8'), absoluteRef: new URL('../public/openapi.json', import.meta.url).pathname, config });
  assert.deepEqual(problems, []);
});
