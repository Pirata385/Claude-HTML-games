#!/usr/bin/env node
// Balance runs: scripted players play many nights on several seeds and the results are summed up
// per scenario (nights survived, deaths and their causes, kills by zombie type and by source,
// how much the newer structures and zombies matter).
//   node tests/balance.js [nights] [seeds] [out.json]
// Scenarios: "classic" (strong bot, hordes without the newer zombie types), "strong" (strong bot,
// all zombies) and "modern" (bot that also uses the newer structures), on normal and hard.
'use strict';
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const NIGHTS = process.argv[2] === '--worker' ? 0 : +(process.argv[2] || 20);
const SEEDS = (process.argv[3] || 'aurora-1,cinza-2,farol-3,brasa-4').split(',');
const OUT = process.argv[4];
const SCENARIOS = [
  { name: 'classic', bot: 'strong', diff: 'normal', noNewZombies: true },
  { name: 'strong', bot: 'strong', diff: 'normal' },
  { name: 'modern', bot: 'modern', diff: 'normal' },
  { name: 'strong-hard', bot: 'strong', diff: 'hard' },
  { name: 'modern-hard', bot: 'modern', diff: 'hard' },
];
const NEW_ZOMBIES = ['crawler', 'leaper', 'toxic'];

// ---- worker: plays one game -------------------------------------------------------------------
function play(job) {
  const { createContext } = require('./run.js');
  const { ctx } = createContext();
  const UB = ctx.UB;
  if (job.noNewZombies) for (const t of NEW_ZOMBIES) UB.DEF.ZOMBIES[t].from = 999;
  const S = UB.Game.newGame({ seed: job.seed, difficulty: job.diff });
  if (job.noNewZombies) for (const z of S.zombies) if (NEW_ZOMBIES.includes(z.type)) z.type = 'walker';
  const r = {
    seed: job.seed, scenario: job.name, nights: 0, over: null, score: 0,
    killsByType: {}, killsBySource: { survivors: 0, turret: 0, flamer: 0, mine: 0, spikes: 0, other: 0 },
    deaths: {}, leaps: 0, minesFired: 0, flames: 0, clouds: 0, poisonDamage: 0, perNight: [], built: {},
  };
  // Attribute kills: structures call UB.Combat.hurtZombie / explode from outside combat.js.
  const C = UB.Combat;
  const hz = C.hurtZombie;
  C.hurtZombie = function (S2, z, dmg, src, pierce) {
    const was = z.dead;
    hz.apply(this, arguments);
    if (!was && z.dead && !src) {
      const k = pierce ? 'flamer' : dmg >= 5 ? 'turret' : 'spikes';
      r.killsBySource[k]++;
    }
  };
  const ex = C.explode;
  C.explode = function (S2, x, y, rad, dmg, src, opts) {
    const before = S2.stats.kills;
    ex.apply(this, arguments);
    if (opts && opts.structures === false) { r.minesFired++; r.killsBySource.mine += S2.stats.kills - before; }
  };
  const hu = C.hurtUnit;
  C.hurtUnit = function (S2, u, dmg, z, ranged, cause) {
    if (cause && cause.k === 'cause.poison') r.poisonDamage += dmg;
    return hu.apply(this, arguments);
  };
  const bot = UB.Bot[job.bot];
  let lastNights = 0, deaths0 = 0, kills0 = 0;
  const t0 = Date.now();
  const maxTicks = (job.nights + 1) * 7600;
  for (let t = 0; t < maxTicks && !S.over && S.nights < job.nights; t++) {
    bot(S);
    UB.Game.tick(S);
    for (const e of S.fx) {
      if (e.t === 'zdie') r.killsByType[e.type] = (r.killsByType[e.type] || 0) + 1;
      else if (e.t === 'leap') r.leaps++;
      else if (e.t === 'flame') r.flames++;
      else if (e.t === 'cloud') r.clouds++;
    }
    S.fx.length = 0;
    if (S.nights !== lastNights) {
      lastNights = S.nights;
      const hq = UB.World.hq(S);
      const count = (t2) => S.buildings.filter((b) => b.type === t2 && b.built >= 1).length;
      r.perNight.push({
        night: S.nights, alive: S.units.length, deaths: S.stats.deaths - deaths0, kills: S.stats.kills - kills0,
        hq: hq ? Math.round((hq.hp / hq.maxHp) * 100) : 0, morale: Math.round(S.morale),
        food: S.res.food, ammo: S.res.ammo, fuel: S.res.fuel, meds: S.res.meds, wood: S.res.wood, scrap: S.res.scrap,
        walls: count('wall') + count('gate'), mines: count('mine'), flamers: count('flamer'), turrets: count('turret'),
      });
      deaths0 = S.stats.deaths; kills0 = S.stats.kills;
    }
  }
  r.nights = S.nights;
  r.over = S.over || null;
  r.score = S.finalScore || UB.Game.score(S);
  r.killsBySource.survivors = 0;
  const attributed = Object.values(r.killsBySource).reduce((a, b) => a + b, 0);
  r.killsBySource.other = 0;
  r.killsBySource.survivors = Math.max(0, S.stats.kills - attributed);
  for (const m of S.memorial) {
    const k = m.cause.k === 'cause.zombie' ? 'zombie:' + m.cause.p.z : m.cause.k.replace('cause.', '');
    r.deaths[k] = (r.deaths[k] || 0) + 1;
  }
  for (const b of S.buildings) r.built[b.type] = (r.built[b.type] || 0) + 1;
  r.unlocked = Object.keys(S.unlocked);
  r.recruits = S.stats.recruits;
  r.seconds = Math.round((Date.now() - t0) / 1000);
  return r;
}

if (process.argv[2] === '--worker') {
  process.on('message', (job) => { process.send(play(job)); process.exit(0); });
  return;
}

// ---- main: run every scenario × seed in parallel and summarize ------------------------------------
async function main() {
  const jobs = [];
  for (const sc of SCENARIOS) for (const seed of SEEDS) jobs.push(Object.assign({ seed, nights: NIGHTS }, sc));
  const results = [];
  const width = Math.max(1, require('os').cpus().length);
  let next = 0;
  const runOne = () => new Promise((ok) => {
    const job = jobs[next++];
    const w = fork(__filename, ['--worker']);
    w.on('message', (r) => { results.push(r); process.stderr.write(`  ${r.scenario} ${r.seed}: ${r.nights} nights${r.over ? ' (' + r.over + ')' : ''} in ${r.seconds}s\n`); });
    w.on('exit', ok);
    w.send(job);
  });
  const lanes = Array.from({ length: Math.min(width, jobs.length) }, async () => { while (next < jobs.length) await runOne(); });
  await Promise.all(lanes);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  // Summary per scenario.
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  for (const sc of SCENARIOS) {
    const rs = results.filter((r) => r.scenario === sc.name);
    const sum = (f) => rs.reduce((a, r) => a + f(r), 0);
    const merge = (f) => { const o = {}; for (const r of rs) for (const [k, v] of Object.entries(f(r))) o[k] = (o[k] || 0) + v; return o; };
    console.log(`\n== ${sc.name} (${sc.bot}, ${sc.diff}${sc.noNewZombies ? ', no new zombies' : ''}) ==`);
    console.log(`nights: ${rs.map((r) => r.nights + (r.over ? '†' : '')).join(' ')}  avg ${avg(rs.map((r) => r.nights)).toFixed(1)}  score avg ${Math.round(avg(rs.map((r) => r.score)))}`);
    console.log('deaths:', JSON.stringify(merge((r) => r.deaths)));
    console.log('kills by source:', JSON.stringify(merge((r) => r.killsBySource)));
    console.log('kills by type:', JSON.stringify(merge((r) => r.killsByType)));
    console.log(`leaps ${sum((r) => r.leaps)}  clouds ${sum((r) => r.clouds)}  poison dmg ${Math.round(sum((r) => r.poisonDamage))}  mines fired ${sum((r) => r.minesFired)}  flame bursts ${sum((r) => r.flames)}`);
    console.log('unlocked:', JSON.stringify(merge((r) => Object.fromEntries(r.unlocked.map((k) => [k, 1])))));
    console.log('buildings at end:', JSON.stringify(merge((r) => r.built)));
    // Night-by-night averages for a few checkpoints.
    for (const n of [5, 10, 15, 20]) {
      const ns = rs.map((r) => r.perNight.find((p) => p.night === n)).filter(Boolean);
      if (!ns.length) continue;
      const a = (k) => Math.round(avg(ns.map((p) => p[k])));
      console.log(`  night ${n} (${ns.length} games): alive ${a('alive')} deaths ${avg(ns.map((p) => p.deaths)).toFixed(1)} hq ${a('hq')}% morale ${a('morale')} food ${a('food')} ammo ${a('ammo')} fuel ${a('fuel')} meds ${a('meds')} walls ${a('walls')} mines ${a('mines')} flamers ${a('flamers')}`);
    }
  }
}
main();
