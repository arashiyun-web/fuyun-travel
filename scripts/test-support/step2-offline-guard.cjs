// Applied to tests and subprocesses: no production credential files or external sockets.
const fs = require('node:fs');
const path = require('node:path');
function check(file) {
  const base = path.basename(String(file));
  if (base === '.env' || base.startsWith('.env.') || base === 'auth.json') throw new Error('Offline guard: credential file access refused');
}
for (const name of ['readFileSync', 'readFile', 'openSync', 'open']) {
  const original = fs[name];
  fs[name] = function (file, ...args) { check(file); return original.call(this, file, ...args); };
}
for (const name of ['readFile', 'open']) {
  const original = fs.promises[name];
  fs.promises[name] = async function (file, ...args) { check(file); return original.call(this, file, ...args); };
}
const net = require('node:net');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const opts = args[0];
  const host = typeof opts === 'object' ? opts.host || opts.hostname || (Array.isArray(opts) ? opts[0]?.host : undefined) : args[1];
  if (host && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Offline guard: external network refused');
  return connect.apply(this, args);
};
