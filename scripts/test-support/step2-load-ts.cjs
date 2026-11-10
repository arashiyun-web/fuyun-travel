// Load real TypeScript modules, replacing only external boundaries in route tests.
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
const doubles = new Map();
Module._resolveFilename = function (name, parent, ...args) {
  const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : name;
  try { return originalResolve.call(this, target, parent, ...args); } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return originalResolve.call(this, target + '.mjs', parent, ...args);
  }
};
Module._load = function (name, parent, ...args) {
  if (doubles.has(name)) return doubles.get(name);
  return originalLoad.call(this, name, parent, ...args);
};
Module._extensions['.ts'] = function (mod, filename) {
  const source = require('node:fs').readFileSync(filename, 'utf8');
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
module.exports = { mock: (name, value) => doubles.set(name, value), load: (name) => require(path.join(root, name)) };
