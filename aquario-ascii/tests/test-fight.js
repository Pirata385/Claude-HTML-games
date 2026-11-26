// Água-Tinta — fight model tests (owner C). §4.7–4.8 and §15.11.
// Iterates over every species in AQ.species; species B has not published yet are filled in from the §6.2
// fixture table below so the model is always exercised for all 42.
'use strict';

// ---------------------------------------------------------------- fixtures (§6.2 / §5.1 / §8.2)
// id zone rarity size style P stam V d0 d1 hookMin gearTier
const ROWS = `
manjuba baia C XS shaker .60 5 5 0 .45 1 1
tainha baia C S jumper .80 8 6 0 .3 1 1
siri baia C S deadweight .75 6 3 .88 1 1 1
camarao baia C XS drifter .40 4 4 .6 1 1 1
baiacu baia U S inflater 1.00 10 5 .3 .8 1 1
arraia baia U M puller 1.05 11 5 .85 1 2 1
agulha baia U S runner 1.05 9 9 0 .15 1 1
cavalo baia R XS drifter .40 5 2 .5 .9 1 1
ermitao baia R S deadweight .90 9 2 .95 1 1 1
tipografo baia L M shaker 1.60 20 8 .2 .6 2 2
palhaco recife C XS shaker .80 6 5 .45 .85 1 2
cirurgiao recife C S runner 1.10 10 8 .2 .6 1 2
papagaio recife U M puller 1.30 13 6 .3 .9 2 2
moreia recife U M burrower 1.45 14 7 .7 1 2 2
lagosta recife U M deadweight 1.30 13 3 .85 1 2 2
leao recife R S shaker 1.45 15 4 .4 .9 1 2
polvo recife R M inker 1.60 18 8 .8 1 2 2
sargo kelp C S puller 1.15 8 6 .2 .7 1 3
cavalinha kelp C S runner 1.25 8 10 0 .5 1 3
lula kelp U S inker 1.55 12 10 .2 .6 1 3
escorpiao kelp U S burrower 1.55 12 6 .75 1 1 3
congro kelp U M diver 1.70 15 8 .7 1 2 3
garoupa kelp R L burrower 2.00 24 8 .6 1 3 3
aranha kelp R M deadweight 1.80 18 2 .9 1 2 3
aguaviva mar C S drifter .55 6 2 0 .6 1 4
voador mar U S jumper 1.40 10 11 0 .15 1 4
dourado mar U L jumper 2.00 22 11 0 .3 3 4
atum mar U L runner 2.30 22 13 .2 .7 3 4
caravela mar R S drifter .60 6 2 0 .06 1 4
lua mar R L deadweight 2.20 26 3 0 .3 3 4
manta mar R XL puller 2.40 28 7 .1 .5 4 4
martelo mar R L runner 2.50 28 12 .3 .9 3 4
marlim mar L XL boss 2.90 70 15 .1 .5 4 5
machado abismo C XS shaker 1.40 7 6 0 .45 1 5
vibora abismo U S runner 2.40 14 11 .2 .7 1 5
isopode abismo U M deadweight 2.30 16 2 .95 1 2 5
diabo abismo R S puller 2.60 18 4 .6 1 1 5
vampira abismo R S inker 2.50 16 7 .4 .9 1 5
atolla abismo R M drifter .70 9 2 .3 .8 2 5
pelicano abismo R L diver 2.60 20 9 .5 1 3 5
celacanto abismo L L boss 3.10 45 7 .85 1 3 5
tinteira abismo L XXL boss 3.40 60 12 .9 1 4 5`;
const SPECIAL = {
  camarao: { tear: 0.6 }, cavalo: { tear: 0.5 }, aguaviva: { tear: 0.5 }, caravela: { tear: 0.35 },
  atolla: { tear: 0.45, alarm: true }, baiacu: { inflateAt: 0.7 }, arraia: { grip: true }, polvo: { grip: true, inkChance: 0.4 },
  ermitao: { grip: true }, aranha: { grip: true }, lagosta: { grip: true }, isopode: { roll: true },
  lula: { inkChance: 0.5 }, vampira: { inkChance: 0.5, glowInk: true }, tipografo: { scramble: true }
};
const TELL = { C: 0.7, U: 0.55, R: 0.45, L: 0.4 };
const ZONES = { baia: 70, recife: 100, kelp: 140, mar: 220, abismo: 320 };

const FIXTURES = ROWS.trim().split('\n').map((line) => {
  const p = line.trim().split(/\s+/);
  const id = p[0];
  return {
    id, zones: [p[1]], rarity: p[2], size: p[3], hookMin: +p[10], gearTier: +p[11],
    fight: { style: p[4], power: +p[5], stamina: +p[6], speed: +p[7], tell: TELL[p[2]], special: SPECIAL[id] || {} },
    depth: [+p[8], +p[9]],
  };
});

const GEAR_TABLE = {
  rod: { cast: [26, 34, 44, 56, 70], window: [0, 0.05, 0.10, 0.15, 0.20], St: [0.55, 0.65, 0.75, 0.88, 1.0] },
  line: { Ls: [1.0, 1.25, 1.55, 1.9, 2.3], maxLen: [90, 130, 180, 250, 360], snapGrace: [0.25, 0.30, 0.35, 0.40, 0.45] },
  reel: { reelSpeed: [7, 9, 11, 13, 16], riseRate: [7, 6.5, 6, 5.5, 5] },
  hook: { hookClass: [1, 2, 3, 4], H: [0, 0.25, 0.5, 0.75] },
};

// gearFor(AQ, tier, hookTier?) → economy.gear() shape. Uses D's AQ.economy.gear when it is real.
function gearFor(AQ, tier, hookTier) {
  const t = Math.max(1, Math.min(5, tier)), h = Math.max(1, Math.min(4, hookTier || Math.min(4, t)));
  if (AQ && AQ.economy && AQ.store) {
    try {
      const st = AQ.store.defaults();
      st.player.gear = { rod: t, line: t, reel: t, hook: h, lantern: 0, boat: 5 };
      const g = AQ.economy.gear(st);
      if (g && g.Ls > 0 && g.maxLen > 0 && g.reelSpeed > 0) return g;
    } catch (e) { /* fall back */ }
  }
  const G = GEAR_TABLE;
  return {
    cast: G.rod.cast[t - 1], window: G.rod.window[t - 1], St: G.rod.St[t - 1],
    Ls: G.line.Ls[t - 1], maxLen: G.line.maxLen[t - 1], snapGrace: G.line.snapGrace[t - 1],
    reelSpeed: G.reel.reelSpeed[t - 1], riseRate: G.reel.riseRate[t - 1],
    hookClass: G.hook.hookClass[h - 1], H: G.hook.H[h - 1], lantern: 0,
  };
}

// Species list: B's data where published (with a fight block), fixtures for the rest.
function speciesList(AQ) {
  const out = [];
  const have = {};
  const list = (AQ.species && AQ.species.list) || [];
  for (const s of list) if (s && s.fight && s.fight.style) { out.push(s); have[s.id] = 1; }
  for (const f of FIXTURES) if (!have[f.id]) out.push(f);
  return out;
}

function zoneOf(AQ, sp) {
  const zid = (sp.zones && sp.zones[0]) || 'baia';
  const z = AQ.zones && AQ.zones.get && AQ.zones.get(zid);
  return {
    id: zid, depth: (z && z.depth) || ZONES[zid] || 100,
    fp: (z && z.floorProfile) || { base: 0.92, amp: zid === 'abismo' ? 0.08 : 0.06, freq: 0.05 },
  };
}

function specimenFor(AQ, sp, rng) {
  if (AQ.spawn && AQ.spawn.rollSpecimen && AQ.species && AQ.species.get && AQ.species.get(sp.id)) {
    try {
      const s = AQ.spawn.rollSpecimen(sp.id, { phase: 'dia', weather: 'limpo', bait: 'minhoca', luck: 0 }, rng);
      if (s && typeof s.q === 'number') return s;
    } catch (e) { /* fall back */ }
  }
  return { sp: sp.id, q: Math.pow(rng.next(), 1.6) };
}

// Builds a fight like the scene would: hook somewhere in the species' depth band, floor + covers.
function setupFight(AQ, sp, tier, seed, opts) {
  const o = opts || {};
  const rng = AQ.rng.create('fight:' + sp.id + ':' + tier + ':' + seed);
  const z = zoneOf(AQ, sp);
  const hookTier = o.hookTier || Math.max(sp.hookMin || 1, Math.min(4, tier));
  const gear = o.gear || gearFor(AQ, tier, hookTier);
  const fpf = z.fp, U = AQ.util;
  const floorY = (x) => z.depth * (fpf.base + fpf.amp * (U.fbm2(x * fpf.freq, 3.7) * 2 - 1));
  const side = rng.next() < 0.5 ? -1 : 1;
  const x = side * (6 + rng.next() * ((gear.cast || 26) - 6)) * 0.8;
  const d = sp.depth[0] + rng.next() * (sp.depth[1] - sp.depth[0]);
  const y = Math.min(z.depth * d, floorY(x) - 1);
  // covers: a rock every ~22 u along the floor
  const covers = [];
  for (let cx = -110; cx <= 110; cx += 22) {
    const fy = floorY(cx);
    covers.push({ x0: cx - 2, y0: fy - 4, x1: cx + 2, y1: fy, kind: 'rock' });
  }
  const spec = specimenFor(AQ, sp, rng);
  const fs = AQ.fight.create(sp, spec, gear, { rng, start: { x, y }, floorY, covers, viewCols: 80, script: o.script });
  return { fs, gear, spec };
}

// policy: 'auto' | 'always' (reel, rod 0) | 'never' | fn(fs) → {reel, rod}
function runFight(AQ, sp, tier, seed, policy, opts) {
  const o = opts || {};
  const { fs } = setupFight(AQ, sp, tier, seed, o);
  const maxT = o.maxT || (sp.fight.style === 'boss' ? 300 : 120);
  const inp = { reel: false, rod: 0 };
  const log = o.log ? [] : null;
  const steps = Math.round(maxT * 60);
  let Tmin = Infinity, Tmax = -Infinity, sBad = 0, phases = [];
  for (let i = 0; i < steps; i++) {
    if (policy === 'auto') AQ.fight.autopilot(fs, inp);
    else if (policy === 'always') { inp.reel = true; inp.rod = 0; }
    else if (policy === 'never') { inp.reel = false; inp.rod = 0; }
    else { const r = policy(fs, i); inp.reel = r.reel; inp.rod = r.rod; }
    const S0 = fs.S;
    const ev = AQ.fight.step(fs, inp, 1 / 60);
    if (fs.T < Tmin) Tmin = fs.T;
    if (fs.T > Tmax) Tmax = fs.T;
    if (fs.S > S0 + 1e-12 && !(fs.T < AQ.fight.CONST.SLACK)) sBad++;
    for (const e of ev) {
      if (log) log.push(JSON.stringify(e) + '@' + i);
      if (e.type === 'phase') phases.push({ phase: e.phase, S: fs.S });
      if (e.type === 'end') return { result: e.result, sec: (i + 1) / 60, Tmin, Tmax, sBad, phases, log, fs };
    }
  }
  return { result: 'timeout', sec: maxT, Tmin, Tmax, sBad, phases, log, fs };
}

function median(a) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

module.exports = function (T) {
  const SEEDS = 100;
  const cache = {};
  function autoStats(AQ, sp) {
    if (cache[sp.id]) return cache[sp.id];
    let landed = 0; const times = [];
    let Tmin = Infinity, Tmax = -Infinity, sBad = 0;
    const fails = {};
    for (let s = 0; s < SEEDS; s++) {
      const r = runFight(AQ, sp, sp.gearTier, s, 'auto');
      if (r.result === 'landed') { landed++; times.push(r.sec); } else fails[r.result] = (fails[r.result] || 0) + 1;
      Tmin = Math.min(Tmin, r.Tmin); Tmax = Math.max(Tmax, r.Tmax); sBad += r.sBad;
    }
    return (cache[sp.id] = { landed, times, med: median(times), Tmin, Tmax, sBad, fails });
  }

  T.test('fight contract shape (§15.5)', () => {
    const { AQ } = T.load();
    T.ok(AQ.fight.CONST.ZONE_LO === 0.35 && AQ.fight.CONST.SLIP_CHANCE === 0.15, 'CONST values');
    T.ok(AQ.fight.PULL_MUL.inflate === 1.6 && AQ.fight.PULL_MUL.roll === 0.15, 'PULL_MUL values');
    for (const st of AQ.ENUM.FIGHT) T.ok(AQ.fight.STYLES[st], 'style ' + st);
    const sp = FIXTURES[0];
    const { fs } = setupFight(AQ, sp, 1, 1);
    for (const k of 't state next tellKind dirX x y L T S fray airborne inflated phase result species specimen'.split(' ')) {
      T.ok(k in fs, 'FightState.' + k);
    }
    const a = AQ.fight.autopilot(fs);
    T.ok(typeof a.reel === 'boolean' && typeof a.rod === 'number', 'autopilot shape');
    T.ok(Array.isArray(AQ.fight.step(fs, a)), 'step returns events');
  });

  T.test('autopilot with recommended gear lands >= 90% for every species (bosses within 300 s)', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const sp of speciesList(AQ)) {
      const st = autoStats(AQ, sp);
      if (st.landed < 90) bad.push(sp.id + ' ' + st.landed + '% ' + JSON.stringify(st.fails));
    }
    T.eq(bad, [], 'species below 90%');
  });

  T.test('median fight time per rarity: C 6–20, U 10–35, R 18–60, L 35–180 s', () => {
    const { AQ } = T.load();
    const by = { C: [], U: [], R: [], L: [] };
    for (const sp of speciesList(AQ)) by[sp.rarity].push(...autoStats(AQ, sp).times);
    const RANGE = { C: [6, 20], U: [10, 35], R: [18, 60], L: [35, 180] };
    for (const r of Object.keys(RANGE)) {
      const m = median(by[r]);
      T.ok(m >= RANGE[r][0] && m <= RANGE[r][1], 'rarity ' + r + ' median ' + m.toFixed(1) + ' s');
    }
  });

  T.test('"always reel, rod 0" fails >= 40% for runners, jumpers and bosses with P/Ls >= 1.15', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const sp of speciesList(AQ)) {
      const style = sp.fight.style;
      if (!(style === 'runner' || style === 'jumper' || style === 'boss')) continue;
      const g = gearFor(AQ, sp.gearTier);
      if (sp.fight.power / g.Ls < 1.15) continue;
      let fail = 0;
      for (let s = 0; s < 50; s++) if (runFight(AQ, sp, sp.gearTier, s, 'always').result !== 'landed') fail++;
      if (fail < 20) bad.push(sp.id + ' fails ' + (fail * 2) + '%');
    }
    T.eq(bad, []);
  });

  T.test('"never reel" never lands', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const sp of speciesList(AQ)) {
      for (let s = 0; s < 5; s++) if (runFight(AQ, sp, sp.gearTier, s, 'never').result === 'landed') bad.push(sp.id);
    }
    T.eq(bad, []);
  });

  T.test('drifters with tear < .5: "always reel" tears >= 70%', () => {
    const { AQ } = T.load();
    const bad = [];
    for (const sp of speciesList(AQ)) {
      const tear = sp.fight.special && sp.fight.special.tear;
      if (sp.fight.style !== 'drifter' || !(tear < 0.5)) continue;
      let torn = 0;
      for (let s = 0; s < 50; s++) if (runFight(AQ, sp, sp.gearTier, s, 'always').result === 'tear') torn++;
      if (torn < 35) bad.push(sp.id + ' tears ' + (torn * 2) + '%');
    }
    T.eq(bad, []);
  });

  T.test('T stays in [0, 1.6]; S only rises while T < SLACK', () => {
    const { AQ } = T.load();
    for (const sp of speciesList(AQ)) {
      const st = autoStats(AQ, sp);
      T.ok(st.Tmin >= 0 && st.Tmax <= 1.6, sp.id + ' T range ' + st.Tmin + '..' + st.Tmax);
      T.eq(st.sBad, 0, sp.id + ' stamina rose while T >= SLACK');
      const r = runFight(AQ, sp, sp.gearTier, 7, 'always');
      T.ok(r.Tmin >= 0 && r.Tmax <= 1.6, sp.id + ' (always) T range');
      T.eq(r.sBad, 0, sp.id + ' (always) stamina');
    }
  });

  T.test('same seed and inputs → identical event log', () => {
    const { AQ } = T.load();
    for (const sp of speciesList(AQ)) {
      const a = runFight(AQ, sp, sp.gearTier, 3, 'auto', { log: true });
      const b = runFight(AQ, sp, sp.gearTier, 3, 'auto', { log: true });
      T.eq(a.log, b.log, sp.id);
      T.ok(a.log.length > 1, sp.id + ' has events');
    }
  });

  T.test('boss phases fire at S .66 and .33', () => {
    const { AQ } = T.load();
    for (const sp of speciesList(AQ)) {
      if (sp.fight.style !== 'boss') continue;
      const r = runFight(AQ, sp, sp.gearTier, 1, 'auto');
      T.eq(r.phases.map((p) => p.phase), [1, 2], sp.id + ' phases');
      T.ok(r.phases[0].S <= 0.66 && r.phases[0].S > 0.64, sp.id + ' phase 1 at ' + r.phases[0].S);
      T.ok(r.phases[1].S <= 0.33 && r.phases[1].S > 0.31, sp.id + ' phase 2 at ' + r.phases[1].S);
    }
  });

  T.test('every escape reason is reachable', () => {
    const { AQ } = T.load();
    const F = (id) => speciesList(AQ).find((s) => s.id === id);
    const seen = {};
    const tryIt = (sp, tier, policy, n, opts) => {
      for (let s = 0; s < (n || 20); s++) { const r = runFight(AQ, sp, tier, s, policy, opts); seen[r.result] = 1; }
    };
    tryIt(F('agulha'), 1, 'always');                                     // snap
    tryIt(F('manjuba'), 1, (fs) => ({ reel: fs.state !== 'shake' && fs.t < 1.5, rod: 0 })); // slack
    tryIt(F('tainha'), 1, 'always');                                     // thrown
    tryIt(F('caravela'), 4, 'always');                                   // tear
    tryIt(F('moreia'), 2, (fs) => ({ reel: fs.state !== 'burrow' && fs.T < 0.5, rod: 0 })); // fray
    tryIt(F('celacanto'), 1, 'auto', 5);                                 // spooled (line too short)
    tryIt(F('siri'), 1, 'never', 3);                                     // loose
    tryIt(F('arraia'), 1, 'auto', 40, { hookTier: 1 });                  // slip (hook too small)
    for (const r of AQ.ENUM.ESCAPE) T.ok(seen[r], 'escape ' + r + ' reached (seen: ' + Object.keys(seen) + ')');
  });

  T.test('tutorial script: no escape, scripted run with a tell', () => {
    const { AQ } = T.load();
    const sp = FIXTURES[0];
    let ranTell = false;
    const r = runFight(AQ, sp, 1, 1, (fs) => {
      if (fs.state === 'tell' && fs.next === 'run' && fs.t > 3.9) ranTell = true;
      return { reel: false, rod: 0 };
    }, { script: { power: 0.35, stamina: 4, runs: [{ at: 4, dir: -1 }], noEscape: true }, maxT: 30 });
    T.eq(r.result, 'timeout', 'never escapes even when ignored');
    T.ok(ranTell, 'scripted run announced by a tell');
    const r2 = runFight(AQ, sp, 1, 1, 'auto', { script: { power: 0.35, stamina: 4, runs: [4], noEscape: true } });
    T.eq(r2.result, 'landed');
  });
};

module.exports.FIXTURES = FIXTURES;
module.exports.GEAR_TABLE = GEAR_TABLE;
module.exports.gearFor = gearFor;
module.exports.speciesList = speciesList;
module.exports.setupFight = setupFight;
module.exports.runFight = runFight;
module.exports.median = median;
