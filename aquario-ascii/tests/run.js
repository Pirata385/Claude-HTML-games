#!/usr/bin/env node
// Água-Tinta — test harness (owner A). Usage: node aquario-ascii/tests/run.js [name-filter ...]
// Discovers tests/test-*.js. Each exports function (T) { T.test(name, fn) } (fn may return a Promise).
// T: test, eq (deep), ok, near(a, b, eps), throws(fn, re?), load() (this file's context), load({fresh:true}),
//    state() (fresh defaults), loader (the module). Exits non-zero on any failure.
'use strict';
const fs = require('fs');
const path = require('path');
const loader = require('./loader');

const filters = process.argv.slice(2);
const files = fs.readdirSync(__dirname)
  .filter((f) => /^test-.*\.js$/.test(f))
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
  .sort();

function fmt(v) {
  try { return JSON.stringify(v, (k, x) => (x === Infinity ? 'Infinity' : x)); } catch (e) { return String(v); }
}

// Deep equality across realms (vm context objects vs host objects). Returns null or a path describing the diff.
function diff(a, b, p) {
  if (a === b) return null;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return (p || '(root)') + ': ' + fmt(a) + ' !== ' + fmt(b);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return (p || '(root)') + ': array vs object';
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    a = Array.from(a); b = Array.from(b);
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k)) return (p ? p + '.' : '') + k + ': missing on right';
  for (const k of kb) if (!Object.prototype.hasOwnProperty.call(a, k)) return (p ? p + '.' : '') + k + ': missing on left';
  for (const k of ka) {
    const d = diff(a[k], b[k], (p ? p + '.' : '') + k);
    if (d) return d;
  }
  return null;
}

class AssertError extends Error {}

function makeT(file, tests) {
  let ctx = null;
  const T = {
    loader,
    test(name, fn) { tests.push({ name, fn }); },
    eq(a, b, msg) {
      const d = diff(a, b, '');
      if (d) throw new AssertError((msg ? msg + ' — ' : '') + 'not deep-equal: ' + d);
    },
    ok(v, msg) { if (!v) throw new AssertError(msg || 'expected truthy, got ' + fmt(v)); },
    near(a, b, eps, msg) {
      const e = eps === undefined ? 1e-9 : eps;
      if (!(Math.abs(a - b) <= e)) throw new AssertError((msg ? msg + ' — ' : '') + a + ' not within ' + e + ' of ' + b);
    },
    throws(fn, re, msg) {
      let threw = false, err;
      try { fn(); } catch (e) { threw = true; err = e; }
      if (!threw) throw new AssertError(msg || 'expected a throw');
      if (re && !re.test(String(err && err.message))) throw new AssertError((msg ? msg + ' — ' : '') + 'error ' + String(err && err.message) + ' does not match ' + re);
    },
    load(opts) {
      if (opts && opts.fresh) return loader.load(opts);
      if (!ctx) ctx = loader.load(opts);
      return ctx;
    },
    state() { return T.load().AQ.store.defaults(); },
  };
  return T;
}

async function main() {
  let pass = 0, fail = 0;
  const t0 = Date.now();
  for (const f of files) {
    const tests = [];
    let mod;
    try {
      mod = require(path.join(__dirname, f));
      const fn = typeof mod === 'function' ? mod : (mod && (mod.default || mod.run));
      if (typeof fn !== 'function') throw new Error('does not export function (T)');
      fn(makeT(f, tests));
    } catch (e) {
      fail++;
      console.log('✗ ' + f + ' failed to load: ' + (e && e.stack || e));
      continue;
    }
    // Shared T per file; tests registered above all use it.
    let filePass = 0, fileFail = 0;
    for (const t of tests) {
      try {
        const r = t.fn();
        if (r && typeof r.then === 'function') await r;
        filePass++;
      } catch (e) {
        fileFail++;
        console.log('  ✗ ' + f + ' › ' + t.name + '\n      ' + (e instanceof AssertError ? e.message : (e && e.stack || e)));
      }
    }
    pass += filePass; fail += fileFail;
    console.log((fileFail ? '✗ ' : '✓ ') + f + '  ' + filePass + '/' + (filePass + fileFail));
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + files.length + ' files (' + (Date.now() - t0) + ' ms)');
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
