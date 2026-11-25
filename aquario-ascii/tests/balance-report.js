#!/usr/bin/env node
// Água-Tinta — balance report (not a test). Usage: node aquario-ascii/tests/balance-report.js [seeds=100] [species,…]
// Fights section (owner C): autopilot land rate and median fight time per species × gear tier (recommended − 1,
// recommended, recommended + 1), plus the "always reel, rod 0" and "never reel" baselines at the recommended tier.
// Pacing section (owner D): tests/balance-pacing.js, required below when it exists.
'use strict';
const fs = require('fs');
const path = require('path');
const loader = require('./loader');
const TF = require('./test-fight');

const SEEDS = +(process.argv[2] || 100);
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function lpad(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }

function stats(AQ, sp, tier, policy, n) {
  let landed = 0; const times = []; const fails = {};
  for (let s = 0; s < n; s++) {
    const r = TF.runFight(AQ, sp, tier, s, policy);
    if (r.result === 'landed') { landed++; times.push(r.sec); } else fails[r.result] = (fails[r.result] || 0) + 1;
  }
  return { rate: landed / n, med: TF.median(times), fails };
}
function cell(st) {
  const m = isNaN(st.med) ? '   -  ' : lpad(st.med.toFixed(1), 5) + 's';
  return lpad(Math.round(st.rate * 100) + '%', 4) + ' ' + m;
}
function failStr(f) {
  return Object.keys(f).sort((a, b) => f[b] - f[a]).map((k) => k + ' ' + f[k]).join(', ');
}

function fights() {
  const { AQ } = loader.load();
  const list = TF.speciesList(AQ).filter((s) => !ONLY || ONLY.has(s.id));
  console.log('== Fights (autopilot, ' + SEEDS + ' seeds; bosses up to 300 s, others 120 s) ==');
  console.log(pad('species', 11) + pad('R', 2) + pad('style', 11) + 'gT | ' + pad('tier−1', 12) + pad('recommended', 12) +
    pad('tier+1', 12) + '| always-reel  never | autopilot failures at gT');
  const byR = { C: [], U: [], R: [], L: [] };
  for (const sp of list) {
    const gT = sp.gearTier;
    const below = gT > 1 ? stats(AQ, sp, gT - 1, 'auto', Math.max(20, SEEDS >> 1)) : null;
    const rec = stats(AQ, sp, gT, 'auto', SEEDS);
    const above = gT < 5 ? stats(AQ, sp, gT + 1, 'auto', Math.max(20, SEEDS >> 1)) : null;
    const always = stats(AQ, sp, gT, 'always', Math.max(20, SEEDS >> 1));
    const never = stats(AQ, sp, gT, 'never', 10);
    byR[sp.rarity].push(rec.med);
    console.log(pad(sp.id, 11) + pad(sp.rarity, 2) + pad(sp.fight.style, 11) + lpad(gT, 2) + ' | ' +
      pad(below ? cell(below) : '    n/a', 12) + pad(cell(rec), 12) + pad(above ? cell(above) : '    n/a', 12) + '| ' +
      pad(lpad(Math.round((1 - always.rate) * 100) + '% fail', 10), 13) + lpad(Math.round(never.rate * 100) + '%', 4) +
      '  | ' + failStr(rec.fails));
  }
  console.log('\nMedian of per-species medians by rarity (targets C 6–20, U 10–35, R 18–60, L 35–180 s):');
  for (const r of ['C', 'U', 'R', 'L']) {
    const m = TF.median(byR[r].filter((x) => !isNaN(x)));
    console.log('  ' + r + ': ' + (isNaN(m) ? '-' : m.toFixed(1) + ' s'));
  }
}

fights();

const pacing = path.join(__dirname, 'balance-pacing.js');
if (fs.existsSync(pacing)) {
  console.log('');
  const mod = require(pacing);
  if (typeof mod === 'function') mod();
  else if (mod && typeof mod.run === 'function') mod.run();
}
