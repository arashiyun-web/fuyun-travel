// Local production server only. Run after npm run build in a credential-free environment.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const port = 3117;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
let output = '';
child.stdout.on('data', data => { output += data; });
child.stderr.on('data', data => { output += data; });
const checks = [];
async function check(path, status, options) {
  const response = await fetch(base + path, options);
  assert.equal(response.status, status, `${options?.method || 'GET'} ${path}`);
  checks.push(`${options?.method || 'GET'} ${path}: ${status}`);
  return response;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Local server stopped before becoming ready');
    try { await fetch(base + '/openapi.json'); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, 'local production server is ready');
  const openapi = await check('/openapi.json', 200); assert.equal((await openapi.json()).openapi, '3.1.0');
  const catalog = await check('/.well-known/api-catalog', 200);
  assert.match(catalog.headers.get('Content-Type'), /^application\/linkset\+json/);
  assert.equal((await catalog.json()).linkset.length, 3);
  const head = await check('/.well-known/api-catalog', 200, { method: 'HEAD' }); assert.match(head.headers.get('Link'), /rel="api-catalog"/);
  const card = await check('/.well-known/mcp/server-card.json', 200); assert.equal((await card.json()).transport.url, 'https://fuyuntravel.com/api/mcp');
  await check('/.well-known/assetlinks.json', 200);
  for (const path of ['quote', 'availability', 'bookings']) await check('/api/public/v1/' + path, 401, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  for (const method of ['GET', 'POST', 'DELETE']) await check('/api/mcp', 401, { method, ...(method === 'POST' ? { body: '{}' } : {}) });
  for (const path of ['/api/admin/api-keys', '/api/admin/ai-bookings', '/api/admin/ai-bookings/fixture']) await check(path, 401);
  for (const path of ['/api/admin/api-keys', '/api/admin/api-keys/fixture/disable', '/api/admin/ai-bookings/fixture/retry-notification']) await check(path, 401, { method: 'POST' });
  await check('/api/admin/ai-bookings/fixture', 401, { method: 'PATCH' });
  for (const path of ['/admin/api-keys', '/admin/ai-bookings', '/admin/ai-bookings/fixture']) {
    const page = await check(path, 200); assert.match(await page.text(), /登入管理員/);
  }
  console.log(checks.join('\n'));
  console.log(`${checks.length} local production HTTP checks passed`);
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
  writeFileSync(new URL('../../codex-evidence/task2-next-start.log', import.meta.url), output);
}
