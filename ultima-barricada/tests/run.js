#!/usr/bin/env node
// Dependency-free test runner. Loads the simulation scripts (the same files the browser
// loads) into a Node vm context, then runs every tests/*.test.js inside that context.
//   node tests/run.js            run all tests
//   node tests/run.js mapgen     run only files whose name contains "mapgen"
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SIM_FILES = [
  'js/core/rng.js', 'js/core/util.js', 'js/data/defs.js',
  'js/sim/world.js', 'js/sim/mapgen.js', 'js/sim/path.js', 'js/sim/spatial.js',
  'js/sim/economy.js', 'js/sim/buildings.js', 'js/sim/combat.js', 'js/sim/units.js',
  'js/sim/zombies.js', 'js/sim/waves.js', 'js/sim/explore.js', 'js/sim/objectives.js', 'js/sim/game.js',
  'tests/bot.js',
];

function createContext() {
  const tests = [];
  const ctx = vm.createContext({ console, assert, test: (name, fn) => tests.push({ name, fn }) });
  for (const f of SIM_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return { ctx, tests };
}

function main() {
  const filter = process.argv[2] || '';
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js') && f.includes(filter)).sort();
  let pass = 0, fail = 0;
  const t0 = Date.now();
  for (const file of files) {
    const { ctx, tests } = createContext();
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), ctx, { filename: 'tests/' + file });
    for (const t of tests) {
      const start = Date.now();
      try {
        t.fn();
        pass++;
        console.log(`  ok   ${file} › ${t.name} (${Date.now() - start} ms)`);
      } catch (e) {
        fail++;
        console.log(`  FAIL ${file} › ${t.name}\n       ${(e && e.stack) || e}`);
      }
    }
  }
  console.log(`\n${pass} passed, ${fail} failed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(fail ? 1 : 0);
}

if (require.main === module) main();
module.exports = { createContext, SIM_FILES };
