// Reproducible offline suite. Environment is allowlisted, credential files and external sockets denied.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd();
const excluded = new Map([
  ['admin-session-flow.test.mjs', 'requires PostgreSQL, next start and destructive DB recreation'],
  ['member-order-publish.test.mjs', 'requires sudo/PostgreSQL and destructive DB recreation'],
  ['line-group-relay.test.mjs', 'requires isolated PostgreSQL'],
  ['line-webhook-claim.test.mjs', 'requires isolated PostgreSQL'],
  ['line-webhook-offline.test.mjs', 'requires isolated PostgreSQL'],
  ['operations-intake-cleanup.test.mjs', 'requires isolated PostgreSQL'],
  ['tools/vercel-ascii.test.mjs', 'requires Windows PowerShell'],
]);
const files = [];
for (const dir of ['scripts', 'scripts/ops', 'scripts/test-support', 'scripts/ai-chat']) {
  for (const file of readdirSync(dir).sort()) {
    if (!/\.test\.(mjs|cjs)$/.test(file)) continue;
    if (excluded.has(file)) continue;
    files.push(`${dir}/${file}`);
  }
}
console.log('Excluded integration/platform suites:', JSON.stringify(Object.fromEntries(excluded)));
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=1', ...files], {
  cwd: root, stdio: 'inherit',
  env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, NODE_OPTIONS: `--require ${path.join(root, 'scripts/test-support/step2-offline-guard.cjs')}`, JITI_FS_CACHE: '0', XDG_CACHE_HOME: '/tmp/fuyun-step2-test-cache', TMPDIR: '/tmp' },
});
process.exit(result.status ?? 1);
