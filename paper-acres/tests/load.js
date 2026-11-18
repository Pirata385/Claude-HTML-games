'use strict';
// Loads game source files (classic scripts sharing the global PA namespace) into this Node process.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const loaded = new Set();
function load(...rel) {
  for (const r of rel) {
    if (loaded.has(r)) continue;
    const file = path.join(ROOT, r);
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    loaded.add(r);
  }
  return globalThis.PA;
}
module.exports = { load, ROOT };
