#!/usr/bin/env node
// Água-Tinta — pacing simulation (owner D, §8.5, §15.11). Not a test: prints a report.
// A simple bot plays 3 h of real time on the real pure modules (AQ.game, AQ.world, AQ.spawn, AQ.aquarium…):
// one fishing attempt every 45 s in the newest unlocked water, keeps the best fish, sells the rest, feeds and
// collects the till, finds bottles, and buys the cheapest required upgrade (zone gear first, then the aquarium).
// Fights are not simulated (see the fight section of balance-report.js); landing odds come from the gear tier gap.
//   node aquario-ascii/tests/balance-pacing.js [seeds=5] [minutes=180]
'use strict';
const loader = require('./loader');

const TARGETS = [ // [key, label, minutes]
  ['firstBuy', 'first purchase', 3],
  ['catch5', '~5 catches', 3],
  ['rod2hook2', 'Anzol II / Vara II', 8],
  ['firstU', 'first uncommon', 8],
  ['recife', 'Recife', 12],
  ['cap20', 'tank capacity 20', 20],
  ['firstR', 'first rare', 20],
  ['tank2', '2nd tank', 30],
  ['kelp', 'Kelp', 35],
  ['line3', 'Linha III', 50],
  ['reel3', 'Molinete III', 50],
  ['bred', 'first breeding', 50],
  ['mar', 'Mar Aberto', 70],
  ['line4', 'Linha IV', 90],
  ['hook4', 'Anzol IV', 90],
  ['stars3', '★3', 90],
  ['tank3', '3rd tank', 90],
  ['abismo', 'Abismo', 115],
  ['line5', 'Linha V', 140],
  ['lantern2', 'Lanterna II', 140],
  ['stars4', '★4', 140],
  ['ending', 'Lula-Tinteira, ending', 165]
];
const SALE_TARGET = { baia: 25, recife: 72, kelp: 115, mar: 270, abismo: 360 };
const CATCH_SEC = 45;
const quiet = { log() {}, warn() {}, error() {}, info() {}, table() {} };

function simulate(seed, minutes) {
  const clock = { t: 1.75e12 };
  const { AQ } = loader.load({ now: () => clock.t, console: quiet });
  AQ.store.load();
  const s = AQ.state, G = AQ.game, E = AQ.ENUM;
  s.meta.seed = AQ.rng.hash('pacing:' + seed);
  s.world.rng = AQ.rng.hash('world:' + seed);
  s.meta.lastActive = clock.t;
  G.check();
  const rng = AQ.rng.create('bot:' + seed);
  const DUR = minutes * 60;
  const out = { at: {}, sales: {}, income: { sell: 0, till: 0, reward: 0, bottle: 0 }, early: { sell: 0, till: 0 }, late: { sell: 0, till: 0 }, catches: 0, attempts: 0 };
  let sec = 0;
  const mark = (k) => { if (out.at[k] === undefined) out.at[k] = sec / 60; };
  const inc = (src, v) => {
    out.income[src] += v;
    if (sec < 30 * 60 && out.early[src] !== undefined) out.early[src] += v;
    if (sec >= DUR - 60 * 60 && out.late[src] !== undefined) out.late[src] += v;
  };
  AQ.events.on('wallet:changed', (p) => { if (p.reason === 'reward' && p.dCoins > 0) inc('reward', p.dCoins); });
  AQ.events.on('shop:bought', () => mark('firstBuy'));
  AQ.events.on('aquarium:bred', () => mark('bred'));
  AQ.events.on('zone:unlocked', (p) => mark(p.zone));
  AQ.events.on('stars:changed', (p) => { if (p.stars >= 3) mark('stars3'); if (p.stars >= 4) mark('stars4'); });
  AQ.events.on('ending:start', () => mark('ending'));

  const items = AQ.items, eco = AQ.economy, aq = AQ.aquarium;
  const gear = () => eco.gear(s);
  const zoneNow = () => { const z = s.progress.zones; return z[z.length - 1]; };
  const caught = (id) => !!(s.bestiary[id] && s.bestiary[id].caught > 0);
  const nonLeg = (zone) => AQ.species.inZone(zone).filter((x) => x.rarity !== 'L');

  function ctxFor(zone, bait) {
    const w = AQ.world.now(s);
    return { phase: w.phase, weather: w.weather, bait, luck: G.luck(zone), lantern: gear().lanternTier, frenzy: false, zone };
  }
  function ownedBaits() { return E.BAITS.filter((b) => G.ownsBait(b)); }
  function bestBait(zone) {
    let best = 'massa', bs = -1;
    for (const b of ownedBaits()) {
      if (b === 'perola') continue;
      const tab = AQ.spawn.table(zone, ctxFor(zone, b));
      let sc = 0;
      for (const r of tab) { const sp = AQ.species.get(r.id); sc += r.w * (caught(r.id) ? 1 : 5) * Math.sqrt(sp.value); }
      if (sc > bs) { bs = sc; best = b; }
    }
    return best;
  }
  function landP(sp) {
    const g = gear();
    if (g.hookClass < sp.hookMin) return 0.08;
    const eff = (g.tiers.rod + g.tiers.line + g.tiers.reel) / 3;
    const gap = Math.max(0, sp.gearTier - eff);
    const rar = { C: 0, U: 0.04, R: 0.1, L: 0.15 }[sp.rarity] || 0;
    return Math.max(0.05, Math.min(0.95, 0.92 - 0.3 * gap - rar));
  }
  function reach(sp, zone) { return sp.depth[0] * AQ.zones.get(zone).depth <= gear().maxLen; }

  function appealOf(x) {
    const sp = AQ.species.get(x.sp);
    return Math.pow(sp.value, 0.75) * (0.8 + 0.5 * (x.q || 0.5)) * (x.dense ? 3 : 1) * (x.bred ? 0.7 : 1);
  }
  function decide(spec) {
    const sp = AQ.species.get(spec.sp);
    if (sp.keep === false) return { choice: 'release' };
    const info = G.catchInfo(spec);
    const inAq = s.aquarium.fish.some((f) => f.sp === spec.sp);
    const per = appealOf(spec) / aq.sizeCost(spec.sp);
    if (info.canKeep) {
      const tk = G.tankById(info.tankId), u = aq.tankUsage(tk, s);
      if (!inAq || u.used / u.cap < 0.6 || per > worstPer(tk.id).per) return { choice: 'keep', tankId: info.tankId };
      return { choice: 'sell' };
    }
    if (!info.keepable) return { choice: 'sell' };
    // replace the worst fish (per capacity unit) if this one is clearly better
    let best = null;
    for (const tk of s.aquarium.tanks) {
      const w = worstPer(tk.id);
      if (!w.fish) continue;
      const u = aq.tankUsage(tk, s);
      if (u.used - aq.sizeCost(w.fish.sp) + aq.sizeCost(spec.sp) > u.cap) continue;
      if (per > w.per * 1.25 && (!best || w.per < best.per)) best = { per: w.per, fish: w.fish, tankId: tk.id };
    }
    if (best) { inc('sell', G.sellFish(best.fish.uid)); return { choice: 'keep', tankId: best.tankId }; }
    return { choice: 'sell' };
  }
  function worstPer(tankId) {
    let w = { per: Infinity, fish: null };
    for (const f of s.aquarium.fish) {
      if (f.tank !== tankId || f.growth < 1) continue;
      const p = appealOf(f) / aq.sizeCost(f.sp);
      if (p < w.per) w = { per: p, fish: f };
    }
    return w;
  }

  function attempt() {
    out.attempts++;
    const zone = zoneNow();
    let bait = bestBait(zone), id = null;
    // legendaries: use the bait that makes one ready (perola, papel, jig, colher)
    for (const b of ownedBaits()) {
      const ctx = ctxFor(zone, b), leg = AQ.spawn.legendaryReady(zone, ctx);
      if (leg && (!caught(leg) || leg === 'tinteira')) { bait = b; if (rng.chance(0.6)) id = leg; break; }
    }
    G.equipBait(bait);
    const ctx = ctxFor(zone, bait);
    for (let k = 0; !id && k < 3; k++) {
      const pick = AQ.spawn.pick(zone, ctx, rng);
      if (pick && reach(AQ.species.get(pick), zone)) id = pick;
    }
    G.consumeBait();
    if (!id) return;
    const sp = AQ.species.get(id);
    if (!rng.chance(landP(sp))) return;
    const spec = AQ.spawn.rollSpecimen(id, ctx, rng);
    const d = decide(spec);
    const r = G.resolveCatch(spec, d);
    out.catches++;
    if (out.catches >= 5) mark('catch5');
    if (sp.rarity === 'U') mark('firstU');
    if (sp.rarity === 'R') mark('firstR');
    const z = sp.zones[0];
    (out.sales[z] || (out.sales[z] = { n: 0, v: 0 })).n++;
    out.sales[z].v += r.value;
    if (r.choice === 'sell') inc('sell', r.value);
  }

  function required() {
    const want = [], g = s.player.gear;
    const nz = AQ.progress.nextZone(s);
    if (nz) {
      const req = AQ.progress.ZONE_REQ[nz];
      if (g.boat < req.boat) want.push('boat');
      if (req.gear) for (const slot in req.gear) if (g[slot] < req.gear[slot]) want.push(slot);
    }
    const zone = zoneNow(), list = nonLeg(zone);
    const T = Math.max.apply(null, list.map((x) => x.gearTier));
    const H = Math.max.apply(null, list.map((x) => x.hookMin));
    const depthNeed = Math.max.apply(null, list.map((x) => x.depth[0])) * AQ.zones.get(zone).depth;
    for (const slot of ['rod', 'line', 'reel']) if (g[slot] < T) want.push(slot);
    if (g.hook < H) want.push('hook');
    if (gear().maxLen < depthNeed) want.push('line');
    if (zone === 'abismo' && g.lantern < 2) want.push('lantern'); // celacanto: "Leve uma lanterna forte"
    if (zone === 'abismo' && g.line < 5) want.push('line');
    return want.filter((id, i) => want.indexOf(id) === i && eco.priceOf(id, s) && eco.requirementsMet(id, s).ok);
  }
  function optional() {
    const want = [];
    for (const tk of s.aquarium.tanks) {
      const u = aq.tankUsage(tk, s);
      if (u.used / u.cap >= 0.75 && eco.priceOf('tankcap', s, { tankId: tk.id })) want.push(['tankcap', { tankId: tk.id }]);
      if (u.bioload > u.filterCap && eco.priceOf('filter', s, { tankId: tk.id })) want.push(['filter', { tankId: tk.id }]);
    }
    const allFull = s.aquarium.tanks.every((tk) => { const u = aq.tankUsage(tk, s); return tk.cap >= 2 && u.used / u.cap >= 0.75; });
    if (allFull && eco.priceOf('tank', s)) want.push(['tank', null]);
    // decor: fill empty slots with the best affordable decor; one oyster per tank
    for (const tk of s.aquarium.tanks) {
      const empty = tk.decor.indexOf(null);
      if (empty < 0) continue;
      const ids = E.DECOR.filter((d) => eco.requirementsMet(d, s).ok && (d !== 'ostra' || !aq.hasOyster(tk)) && !(s.player.decor[d] > 0));
      ids.sort((a, b) => items.DECOR[b].attract - items.DECOR[a].attract);
      if (ids.length) want.push([ids[0], null, tk.id, empty]);
    }
    return want;
  }
  function tryBuy(id, opts) {
    const r = G.buy(id, opts || undefined);
    if (!r.ok) return false;
    const g = s.player.gear;
    if (g.rod >= 2 || g.hook >= 2) mark('rod2hook2');
    if (g.line >= 3) mark('line3');
    if (g.reel >= 3) mark('reel3');
    if (g.line >= 4) mark('line4');
    if (g.hook >= 4) mark('hook4');
    if (g.line >= 5) mark('line5');
    if (g.lantern >= 2) mark('lantern2');
    if (s.aquarium.tanks.some((t) => t.cap >= 2)) mark('cap20');
    if (s.aquarium.tanks.length >= 2) mark('tank2');
    if (s.aquarium.tanks.length >= 3) mark('tank3');
    return true;
  }
  function maintain() {
    for (const tk of s.aquarium.tanks) if (tk.food < 0.35 && s.aquarium.fish.some((f) => f.tank === tk.id)) G.feedTank(tk.id);
    if (s.aquarium.till >= 25) inc('till', G.collectTill());
    // place owned decor
    for (const tk of s.aquarium.tanks) {
      for (let i = 0; i < tk.decor.length; i++) {
        if (tk.decor[i]) continue;
        const d = E.DECOR.find((x) => s.player.decor[x] > 0 && (x !== 'ostra' || !aq.hasOyster(tk)));
        if (d) G.placeDecor(tk.id, i, d);
      }
    }
    // baits and lures
    const zone = zoneNow();
    const packs = ['bait_minhoca', 'bait_camarao'].concat(s.progress.zones.indexOf('recife') >= 0 ? ['bait_lula'] : [], s.progress.zones.indexOf('mar') >= 0 ? ['bait_luminosa'] : []);
    for (const id of packs) {
      const it = items.get(id);
      if ((s.player.baits[it.bait] || 0) < 3 && s.player.coins > 6 * it.price.coins) tryBuy(id);
    }
    if (!s.player.lures.colher && s.player.coins > 1200) tryBuy('lure_colher');
    if (!s.player.lures.jig && s.progress.zones.indexOf('kelp') >= 0 && s.player.coins > 4000) tryBuy('lure_jig');
    if (zone === 'abismo' && s.player.unlocks.perola && s.player.baits.perola < 1) tryBuy('bait_perola');
    if (s.player.unlocks.papel && s.player.baits.papel < 1 && !caught('tipografo')) tryBuy('bait_papel');
    // upgrades: the cheapest required item; aquarium items only when they do not starve the required ones
    let guard = 0;
    while (guard++ < 6) {
      const req = required().map((id) => [id, null, eco.priceOf(id, s).coins]).sort((a, b) => a[2] - b[2]);
      const need = req.length ? req[0][2] : 0;
      if (req.length && s.player.coins >= need) { if (tryBuy(req[0][0])) continue; }
      const opt = optional().map((o) => [o[0], o[1], eco.priceOf(o[0], s, o[1] || undefined)]).filter((o) => o[2] && !o[2].pearls || (o[2] && o[2].pearls <= s.player.pearls && !o[2].coins))
        .sort((a, b) => a[2].coins - b[2].coins);
      let bought = false;
      for (const o of opt) {
        if (s.player.coins - o[2].coins >= 0.6 * need && s.player.pearls >= (o[2].pearls || 0)) { if (tryBuy(o[0], o[1])) { bought = true; break; } }
      }
      if (!bought) break;
    }
  }

  let nextCatch = 20, nextBottle = 300 + rng.int(180), nextEmpty = 0;
  for (sec = 0; sec < DUR; sec++) {
    clock.t += 1000;
    AQ.world.tick(s, 1);
    G.tick(1);
    s.meta.playSec++;
    if (sec >= nextCatch) { attempt(); nextCatch = sec + CATCH_SEC; }
    if (sec >= nextBottle) {
      nextBottle = sec + 300 + rng.int(180);
      if (rng.chance(0.5)) {
        if (!G.allMessagesFound()) G.foundMessage();
        else if (sec >= nextEmpty) { inc('bottle', G.bottleCoins(zoneNow())); nextEmpty = sec + 900; }
      }
    }
    if (sec % 20 === 0) maintain();
  }
  out.final = {
    coins: s.player.coins, pearls: s.player.pearls, gear: Object.assign({}, s.player.gear), tanks: s.aquarium.tanks.length,
    fish: s.aquarium.fish.length, stars: s.progress.stars, attraction: Math.round(aq.attraction(s)),
    income: +eco.incomePerMinute(s).toFixed(1), zones: s.progress.zones.slice(), goals: Object.keys(s.progress.goalsDone).length,
    species: AQ.progress.completion(s).caught
  };
  return out;
}

function median(a) { const b = a.filter((x) => x !== undefined).sort((x, y) => x - y); if (!b.length) return undefined; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
function fmt(m) { if (m === undefined) return '  -  '; const h = Math.floor(m / 60), mm = Math.round(m % 60); return h + ':' + (mm < 10 ? '0' : '') + mm; }

function run(opts) {
  const o = opts || {};
  const seeds = o.seeds || 5, minutes = o.minutes || 180;
  const runs = [];
  for (let i = 0; i < seeds; i++) runs.push(simulate(i + 1, minutes));
  const log = o.log || console.log;
  log('== Pacing simulation (D): ' + seeds + ' bots × ' + minutes + ' min, one attempt every ' + CATCH_SEC + ' s ==');
  log('milestone                    target   median  (min–max, reached n/' + seeds + ')');
  const rows = [];
  for (const [k, label, tgt] of TARGETS) {
    const v = runs.map((r) => r.at[k]);
    const got = v.filter((x) => x !== undefined);
    const med = median(v);
    rows.push({ k, label, tgt, med, n: got.length });
    const mn = got.length ? Math.min.apply(null, got) : undefined, mx = got.length ? Math.max.apply(null, got) : undefined;
    log('  ' + (label + '                            ').slice(0, 26) + ' ' + fmt(tgt).padStart(6) + '   ' + fmt(med).padStart(6) + '  (' + fmt(mn) + '–' + fmt(mx) + ', ' + got.length + '/' + seeds + ')');
  }
  log('average sale value per catch (all catches, sold or kept):');
  for (const z of AQ_ZONES) {
    const n = runs.reduce((a, r) => a + (r.sales[z] ? r.sales[z].n : 0), 0), v = runs.reduce((a, r) => a + (r.sales[z] ? r.sales[z].v : 0), 0);
    log('  ' + (z + '        ').slice(0, 8) + ' target $' + SALE_TARGET[z] + '   sim $' + (n ? Math.round(v / n) : '-') + '   (' + n + ' catches)');
  }
  const share = (sel) => { const a = runs.reduce((x, r) => x + r[sel].till, 0), b = runs.reduce((x, r) => x + r[sel].sell, 0); return a + b ? Math.round(100 * a / (a + b)) + '%' : '-'; };
  log('aquarium (till) share of sell+till income: first 30 min ' + share('early') + ' (target ≈15%), last 60 min ' + share('late') + ' (target 30–45%)');
  const f = runs[0].final;
  log('bot #1 at the end: ' + JSON.stringify(f));
  return { runs, rows };
}
const AQ_ZONES = ['baia', 'recife', 'kelp', 'mar', 'abismo'];

module.exports = run;
module.exports.run = run;
module.exports.simulate = simulate;
module.exports.TARGETS = TARGETS;

if (require.main === module) {
  const seeds = parseInt(process.argv[2], 10) || 5;
  const minutes = parseInt(process.argv[3], 10) || 180;
  run({ seeds, minutes });
}
