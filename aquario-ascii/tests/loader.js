// Água-Tinta — Node loader for the pure modules (owner A).
// Parses index.html, keeps the <script src> entries under js/core|data|logic and evaluates them in order in a
// fresh vm context whose global object is also `window`. localStorage is in memory; document is absent.
// The context has its own Math/Date/JSON/Intl intrinsics (host objects are not injected to avoid realm mixing).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PURE = /^js\/(core|data|logic)\//;

function scriptList(all) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return all ? out : out.filter((s) => PURE.test(s));
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] || null,
    get length() { return m.size; },
    _map: m,
  };
}

// load(opts?) → { AQ, window, globals: string[] (globals added by the scripts), scripts, context }
// opts: { console, filter: (src) → bool, now: () → ms (overrides AQ.util.now after core loads) }
function load(opts) {
  const o = opts || {};
  const sandbox = { console: o.console || console };
  sandbox.window = sandbox;
  sandbox.localStorage = memoryStorage();
  const context = vm.createContext(sandbox);
  const before = new Set(Object.getOwnPropertyNames(sandbox));
  let scripts = scriptList(false);
  if (o.filter) scripts = scripts.filter(o.filter);
  for (const rel of scripts) {
    const file = path.join(ROOT, rel);
    const code = fs.readFileSync(file, 'utf8');
    vm.runInContext(code, context, { filename: file });
    if (o.now && rel === 'js/core/util.js') sandbox.AQ.util.now = o.now;
  }
  const globals = Object.getOwnPropertyNames(sandbox).filter((k) => !before.has(k));
  return { AQ: sandbox.AQ, window: sandbox, globals, scripts, context };
}

module.exports = { load, scriptList, memoryStorage, ROOT };
