#!/usr/bin/env node
// Balance runs: scripted players play many nights on several seeds and the results are summed up
// per scenario (nights survived, deaths and their causes, kills by zombie type and by source,
// how much the newer structures and zombies matter).
//   node tests/balance.js [nights] [seeds] [out.json]
// Full games: "classic" (strong bot, hordes without the newer zombie types), "strong" (strong bot,
// all zombies) and "modern" (bot that also uses the newer structures), on normal and hard.
// Sieges isolate the night fights from the economy: a ready walled base with 8 survivors and
// supplies topped up every dawn faces nights 1..N back to back ("siege-classic" without the newer
// zombies, "siege" with them, "siege-new" also defended by landmines and flamethrowers).
//   node tests/balance.js 20 seeds out.json siege     only the sieges
'use strict';
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

const NIGHTS = process.argv[2] === '--worker' ? 0 : +(process.argv[2] || 20);
const SEEDS = (process.argv[3] || 'aurora-1,cinza-2,farol-3,brasa-4').split(',');
const OUT = process.argv[4];
const ONLY = process.argv[5] || '';
const ALL = [
  { name: 'classic', bot: 'strong', diff: 'normal', noNewZombies: true },
  { name: 'strong', bot: 'strong', diff: 'normal' },
  { name: 'modern', bot: 'modern', diff: 'normal' },
  { name: 'strong-hard', bot: 'strong', diff: 'hard' },
  { name: 'modern-hard', bot: 'modern', diff: 'hard' },
  { name: 'siege-classic', siege: true, diff: 'normal', noNewZombies: true },
  { name: 'siege', siege: true, diff: 'normal' },
  { name: 'siege-new', siege: true, diff: 'normal', newDefense: true },
];
const SCENARIOS = ALL.filter((s) => s.name.startsWith(ONLY));

// A ready base: HQ level 3, a ring of walls with a gate on each side, four towers, eight survivors.
const SUPPLY = { food: 200, wood: 200, scrap: 200, ammo: 300, fuel: 60, meds: 10 };
function fortify(UB, S, job) {
  const W = UB.World, B = UB.Buildings;
  for (const z of S.zombies) z.dead = true;
  const hq = W.hq(S);
  for (const k in SUPPLY) S.res[k] = 9999;
  UB.Buildings.upgrade(S, hq); UB.Buildings.upgrade(S, hq);
  const cx = hq.tx + 1, cy = hq.ty + 1, R = 7;
  const done = (r) => { if (r && r.b) B.addBuild(S, r.b, 1e6); };
  for (const [x0, y0, x1, y1] of [[cx - R, cy - R, cx + R, cy - R], [cx + R, cy - R, cx + R, cy + R], [cx + R, cy + R, cx - R, cy + R], [cx - R, cy + R, cx - R, cy - R]]) {
    for (const [x, y] of B.lineTiles(x0, y0, x1, y1)) {
      const gate = x === cx || y === cy;
      if (B.canPlace(S, gate ? 'gate' : 'wall', x, y).ok) done(B.place(S, gate ? 'gate' : 'wall', x, y));
    }
  }
  for (const [x, y] of [[cx - 4, cy - 4], [cx + 4, cy - 4], [cx - 4, cy + 4], [cx + 4, cy + 4]]) {
    const p = B.canPlace(S, 'tower', x, y).ok ? { x, y } : UB.Bot.spotFor(S, 'tower', 3, 5);
    if (p) done(B.place(S, 'tower', p.x, p.y));
  }
  const roles = ['soldier', 'scout', 'engineer', 'medic'];
  for (let k = 0; k < 4; k++) { const p = W.nearestOpen(S, cx + 1, cy + 3, false, 4); UB.Units.create(S, roles[k], p.x + 0.5, p.y + 0.5); }
  for (const b of S.buildings) if (b.type === 'shelter') B.addBuild(S, b, 1e6);
  for (const t of ['shelter', 'shelter', 'garden', 'workshop', 'depot']) { const p = UB.Bot.spotFor(S, t, 2, 6); if (p) done(B.place(S, t, p.x, p.y)); }
  if (job.newDefense) {
    S.unlocked.bp_flamer = true;
    for (const [x, y] of [[cx, cy - 5], [cx, cy + 5], [cx - 5, cy], [cx + 5, cy]]) if (B.canPlace(S, 'flamer', x, y).ok) done(B.place(S, 'flamer', x, y));
  }
  UB.Path.updateFlow(S, true);
  UB.Eco.updatePower(S);
  for (const k in SUPPLY) S.res[k] = 0;
  topUp(UB, S, job);
}
// Dawn: supplies back to the reference level; landmines re-laid in front of the gates.
function topUp(UB, S, job) {
  for (const k in SUPPLY) S.res[k] = Math.max(S.res[k], Math.min(SUPPLY[k], UB.Eco.cap(S)));
  if (!job.newDefense) return;
  const hq = UB.World.hq(S), cx = hq.tx + 1, cy = hq.ty + 1;
  for (const [x, y] of [[cx, cy - 9], [cx, cy + 9], [cx - 9, cy], [cx + 9, cy], [cx + 1, cy - 9], [cx - 1, cy + 9], [cx - 9, cy + 1], [cx + 9, cy - 1]]) {
    if (UB.Buildings.canPlace(S, 'mine', x, y).ok) { const r = UB.Buildings.place(S, 'mine', x, y); if (r.ok) UB.Buildings.addBuild(S, r.b, 1e6); }
  }
}
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
  if (job.siege) fortify(UB, S, job);
  const bot = job.siege ? (S2) => {
    if (S2.clock.phase === 'day') { if (S2.clock.t < UB.Waves.phaseLen(S2, 'day') - 30) S2.clock.t = UB.Waves.phaseLen(S2, 'day') - 30; }
  } : UB.Bot[job.bot];
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
      if (job.siege) topUp(UB, S, job);
      const hq = UB.World.hq(S);
      const count = (t2) => S.buildings.filter((b) => b.type === t2 && b.built >= 1).length;
      r.perNight.push({
        night: S.nights, alive: S.units.length, deaths: S.stats.deaths - deaths0, kills: S.stats.kills - kills0,
        hq: hq ? Math.round((hq.hp / hq.maxHp) * 100) : 0, morale: Math.round(S.morale),
        food: S.res.food, ammo: S.res.ammo, fuel: S.res.fuel, meds: S.res.meds, wood: S.res.wood, scrap: S.res.scrap,
        walls: count('wall') + count('gate'), wallHp: Math.round(100 * S.buildings.filter((b) => b.type === 'wall' || b.type === 'gate').reduce((a, b) => a + b.hp / b.maxHp, 0) / Math.max(1, count('wall') + count('gate'))), mines: count('mine'), flamers: count('flamer'), turrets: count('turret'),
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
    console.log(`\n== ${sc.name} (${sc.bot || 'siege'}, ${sc.diff}${sc.noNewZombies ? ', no new zombies' : ''}) ==`);
    console.log(`nights: ${rs.map((r) => r.nights + (r.over ? '†' : '')).join(' ')}  avg ${avg(rs.map((r) => r.nights)).toFixed(1)}  score avg ${Math.round(avg(rs.map((r) => r.score)))}`);
    console.log('deaths:', JSON.stringify(merge((r) => r.deaths)));
    console.log('kills by source:', JSON.stringify(merge((r) => r.killsBySource)));
    console.log('kills by type:', JSON.stringify(merge((r) => r.killsByType)));
    console.log(`leaps ${sum((r) => r.leaps)}  clouds ${sum((r) => r.clouds)}  poison dmg ${Math.round(sum((r) => r.poisonDamage))}  mines fired ${sum((r) => r.minesFired)}  flame bursts ${sum((r) => r.flames)}`);
    console.log('unlocked:', JSON.stringify(merge((r) => Object.fromEntries(r.unlocked.map((k) => [k, 1])))));
    console.log('buildings at end:', JSON.stringify(merge((r) => r.built)));
    // Night-by-night averages for a few checkpoints.
    for (const n of sc.siege ? [3, 6, 9, 12, 15, 18, 20] : [5, 10, 15, 20]) {
      const ns = rs.map((r) => r.perNight.find((p) => p.night === n)).filter(Boolean);
      if (!ns.length) continue;
      const a = (k) => Math.round(avg(ns.map((p) => p[k])));
      console.log(`  night ${n} (${ns.length} games): wallHp ${a('wallHp')}% alive ${a('alive')} deaths ${avg(ns.map((p) => p.deaths)).toFixed(1)} hq ${a('hq')}% morale ${a('morale')} food ${a('food')} ammo ${a('ammo')} fuel ${a('fuel')} meds ${a('meds')} walls ${a('walls')} mines ${a('mines')} flamers ${a('flamers')}`);
    }
  }
}
main();
