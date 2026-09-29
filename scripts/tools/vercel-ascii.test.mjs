// Run: node --test scripts/tools/vercel-ascii.test.mjs   (Windows; launches new PowerShell processes)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { asciiHostname, isVercelCli } = require("./vercel-ascii-hostname.cjs");
const PRELOAD = path.join(here, "vercel-ascii-hostname.cjs");
const LAUNCHER = path.join(here, "vercel-ascii.ps1");
const realHost = os.hostname();
const isWindows = process.platform === "win32";

// Prints the hostname as seen through both CJS and an ESM named import.
const PROBE = `import { hostname } from "node:os"; import { createRequire } from "node:module";
const cjs = createRequire(import.meta.url)("node:os").hostname();
process.stdout.write(JSON.stringify({ esm: hostname(), cjs }));`;

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vercel ascii test "));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const requireOpt = (p) => `--require "${p.replace(/\\/g, "/")}"`;
const probeAt = (file) => {
  const r = spawnSync(process.execPath, [file], { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: requireOpt(PRELOAD) } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const ps = (args, env = {}) => spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", ...args], { encoding: "utf8", env: { ...process.env, ...env } });

test("asciiHostname keeps ASCII names and maps non-ASCII ones to a stable ASCII label", () => {
  assert.equal(asciiHostname("build-01"), "build-01");
  const mapped = asciiHostname("雲阿民");
  assert.match(mapped, /^host-[0-9a-f]{8}$/);
  assert.equal(asciiHostname("雲阿民"), mapped);
  assert.notEqual(asciiHostname("另一台"), mapped);
});

test("isVercelCli matches only the Vercel CLI entry point", () => {
  assert.ok(isVercelCli("C:\\Users\\x\\AppData\\Roaming\\npm\\node_modules\\vercel\\dist\\vc.js"));
  assert.ok(isVercelCli("/usr/lib/node_modules/vercel/dist/vc.js"));
  assert.ok(!isVercelCli("C:\\repo\\scripts\\operations-preview-e2e.mjs"));
  assert.ok(!isVercelCli(undefined));
});

test("inside a vercel/dist/vc.js process the hostname is ASCII for CJS and ESM imports", () => withTempDir((dir) => {
  const dist = path.join(dir, "vercel", "dist");
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, "package.json"), '{"type":"module"}');
  writeFileSync(path.join(dist, "vc.js"), PROBE);
  const out = probeAt(path.join(dist, "vc.js"));
  assert.match(out.esm, /^[\x21-\x7E]+$/);
  assert.equal(out.cjs, out.esm);
  assert.equal(out.esm, asciiHostname(realHost));
}));

test("any other Node process keeps the real hostname", () => withTempDir((dir) => {
  const file = path.join(dir, "other.mjs");
  writeFileSync(file, PROBE);
  assert.deepEqual(probeAt(file), { esm: realHost, cjs: realHost });
}));

test("the real hostname of this machine is non-ASCII (the case being fixed)", { skip: /^[\x21-\x7E]+$/.test(realHost) && "hostname is ASCII here" }, () => {
  assert.notEqual(asciiHostname(realHost), realHost);
});

test("launcher: keeps an existing NODE_OPTIONS, adds the preload once, returns the exit code", { skip: !isWindows }, () => {
  const script = "const o=process.env.NODE_OPTIONS||'';console.log(JSON.stringify({o,n:(o.match(/vercel-ascii-hostname/g)||[]).length}));process.exit(7)";
  const r = ps(["-File", LAUNCHER, "--exec", process.execPath, "-e", script], { NODE_OPTIONS: "--max-old-space-size=512" });
  assert.equal(r.status, 7, r.stderr);
  const out = JSON.parse(r.stdout.trim());
  assert.ok(out.o.startsWith("--max-old-space-size=512 "), out.o);
  assert.equal(out.n, 1);
  const nested = ps(["-File", LAUNCHER, "--exec", "powershell", "-NoProfile", "-File", LAUNCHER, "--exec", process.execPath, "-e", script]);
  assert.equal(JSON.parse(nested.stdout.trim()).n, 1, "no duplicate --require when nested");
});

test("launcher: restores NODE_OPTIONS in the calling PowerShell session (set and unset)", { skip: !isWindows }, () => {
  const q = LAUNCHER.replace(/'/g, "''");
  const cmd = `$env:NODE_OPTIONS='--trace-warnings'; & '${q}' --exec '${process.execPath}' -e 'process.exit(0)' | Out-Null; "set=[$env:NODE_OPTIONS]"; Remove-Item Env:NODE_OPTIONS; & '${q}' --exec '${process.execPath}' -e 'process.exit(0)' | Out-Null; "unset=[$(Test-Path Env:NODE_OPTIONS)]"`;
  const r = ps(["-Command", cmd], { NODE_OPTIONS: "" });
  assert.match(r.stdout, /set=\[--trace-warnings\]/, r.stdout + r.stderr);
  assert.match(r.stdout, /unset=\[False\]/, r.stdout + r.stderr);
});

test("launcher: works from a path with spaces and passes arguments with spaces intact", { skip: !isWindows }, () => withTempDir((dir) => {
  copyFileSync(LAUNCHER, path.join(dir, "vercel-ascii.ps1"));
  copyFileSync(PRELOAD, path.join(dir, "vercel-ascii-hostname.cjs"));
  const r = ps(["-File", path.join(dir, "vercel-ascii.ps1"), "--exec", process.execPath, "-e", "console.log(JSON.stringify(process.argv.slice(1)));require('node:fs').statSync(process.env.NODE_OPTIONS.split('--require ')[1].replace(/\\x22/g,''))", "a b", "c"]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout.trim()), ["a b", "c"]);
}));

test("launcher: usage errors exit 2", { skip: !isWindows }, () => {
  assert.equal(ps(["-File", LAUNCHER, "--exec"]).status, 2);
  assert.equal(ps(["-File", LAUNCHER, "--exec", "Get-ChildItem"]).status, 2, "cmdlets are refused (no reliable exit code)");
});

// PR #33 release: `--exec node <script>` (exactly one argument after the command) passed only the
// first character of the script path, because $rest[2..2] is a string, not an array.
test("launcher: a single argument after the command is passed whole", { skip: !isWindows }, () => withTempDir((dir) => {
  const script = path.join(dir, "one-arg.mjs");
  writeFileSync(script, "console.log('ran ' + process.argv.length)");
  const r = ps(["-File", LAUNCHER, "--exec", process.execPath, script]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ran 2/);
}));
