// economy.js — what things are worth: creature values, the BFC, the arenas with their daily
// cards, opponents and bosses, and the sideshow. Everything is derived from the save's seed and
// day, so a card looks the same however often you open it. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, hashStr } = RB.core;
  const ST = () => RB.state;

  const TIER_VALUE = [0, 15, 60, 135, 240, 380];
  // Market value of a creature.
  function value(c) {
    const P = ST().pheno(c);
    const sp = RB.species.SPECIES, t1 = sp[P.species.id].tier, t2 = sp[P.species.second].tier;
    const base = P.species.pure ? TIER_VALUE[t1] : (TIER_VALUE[t1] + TIER_VALUE[t2]) / 2 * 1.25;
    const r = P.rate, stat = (r.power + r.speed + r.tough + r.stamina + r.guts) / 500;
    const ageF = P.stage === 'chick' ? 0.5 : P.stage === 'young' ? 0.8 : P.stage === 'elder' ? 0.4 : 1;
    const v = base * (0.6 + 0.9 * stat) * (1 + 0.35 * P.odd.length) * Math.min(2.5, 1 + 0.08 * c.wins) * ageF * (c.hp < 1 ? 0.8 : 1);
    return Math.max(3, Math.round(v));
  }

  // ---- BFC: Brazil's Fried Chicken
  const BFC_SPECIES = ['chicken', 'duck', 'goose', 'turkey', 'quail', 'pheasant', 'gull', 'bantam'];
  function bfcSpecial(S) {
    const r = new Rng((S.seed ^ Math.imul(S.day, 2654435761) ^ 0xbfc) >>> 0);
    if (r.chance(0.55)) { const id = r.pick(BFC_SPECIES), s = RB.species.SPECIES[id]; return { kind: 'species', id, label: RB.species.nameOf(s, 'F') }; }
    const wc = r.int(1, 4);
    return { kind: 'class', id: wc, label: RB.pheno.WEIGHT_CLASSES[wc][0] + 'weights' };
  }
  function bfcIsSpecial(S, c) {
    const sp = bfcSpecial(S), P = ST().pheno(c);
    return sp.kind === 'species' ? P.species.id === sp.id : P.weightClass === sp.id;
  }
  // What BFC pays: by the kilo, never much of what the bird is really worth. pickup = the coop box.
  function bfcPrice(S, c, pickup) {
    const P = ST().pheno(c);
    let p = Math.min(P.weightKg * 3, value(c) * 0.4);
    if (bfcIsSpecial(S, c)) p *= 2;
    if (pickup) p *= 0.8;
    return Math.max(2, Math.round(p));
  }

  // ---- arenas
  const ARENAS = [
    { id: 'backyard', name: 'Backyard Pit', tier: 0, modes: ['pit'], classes: [1, 2, 3], fee: 15, purse: 70, need: 3, betCap: 100,
      boss: { trainer: 'Old Bira', bird: 'Sete Facas', mix: ['gamecock', 'gamecock'], wc: 3, purse: 400, gear: null } },
    { id: 'county', name: 'County Ring', tier: 1, modes: ['pit', 'push'], classes: [2, 3, 4], fee: 50, purse: 220, need: 4, betCap: 400,
      boss: { trainer: 'Dona Zefa', bird: 'Tempestade', mix: ['goose', 'swan'], wc: 4, purse: 1400, gear: 'scarf', mode: 'push' } },
    { id: 'city', name: 'City Arena', tier: 2, modes: ['pit', 'push', 'aerial'], classes: [3, 4, 5], fee: 150, purse: 650, need: 4, betCap: 1200,
      boss: { trainer: 'Dr. Quill', bird: 'Bisturi', mix: ['eagle', 'secretary'], wc: 4, purse: 4000, gear: 'helmet' } },
    { id: 'cellar', name: 'The Cellar', tier: 3, modes: ['pit', 'push'], classes: [6], fee: 400, purse: 1700, need: 5, betCap: 3000, night: true,
      boss: { trainer: 'The Butcher', bird: 'Machado', mix: ['cassowary', 'cassowary'], wc: 6, purse: 9000, gear: 'spurs' } },
    { id: 'grand', name: 'Grand Ring', tier: 4, modes: ['pit'], classes: [4, 5, 6], fee: 1000, purse: 4500, need: 5, betCap: 8000,
      boss: { trainer: 'Madame Plume', bird: 'Imperatriz', mix: ['terror', 'cassowary'], wc: 6, purse: 25000, gear: 'spurs', final: true } },
  ];
  const ARENA = {};
  for (const a of ARENAS) ARENA[a.id] = a;
  const TRAINERS = ['Tonho', 'Dona Cida', 'Juca', 'Neide', 'Chico', 'Lurdes', 'Tiao', 'Dirce', 'Zeca', 'Marlene', 'Biu', 'Socorro', 'Nando', 'Jurema', 'Raimundo', 'Ivete', 'Gil', 'Odete'];

  // Which weight class each species normally fights in.
  let classCache = null;
  function speciesByClass() {
    if (classCache) return classCache;
    classCache = RB.pheno.WEIGHT_CLASSES.map(() => []);
    const r = new Rng(77);
    for (const id of RB.species.IDS) {
      const s = RB.species.SPECIES[id];
      if (s.person || s.extinct) continue;
      const P = RB.pheno.express(RB.genome.fromTargets(s.t, s.sw, r, { sex: 'M', variation: 0 }));
      classCache[P.weightClass].push(id);
    }
    return classCache;
  }
  const leagueOf = (S, id) => (S.league[id] = S.league[id] || { wins: 0, boss: false });
  function arenaOpen(S, arena) { return arena.tier === 0 || leagueOf(S, ARENAS[arena.tier - 1].id).boss; }

  // A rough fighting score, used to pick the better of a few random opponents.
  function fightScore(P) { const r = P.rate; return r.power * 1.4 + r.tough + r.speed * 0.5 + r.stamina * 0.6 + r.guts * 0.8 + r.fury * 0.5; }
  function bestOf(n, make) {
    let best = null, bs = -1;
    for (let i = 0; i < n; i++) { const P = make(); const s = fightScore(P); if (s > bs) { bs = s; best = P; } }
    return best;
  }
  const trainOf = (tier) => ({ muscle: 0.03 * tier, reflex: 0.03 * tier, lungs: 0.03 * tier, courage: 0.05 * tier });

  // An opponent for a weight class at an arena tier: the pick of a few birds, with some training.
  function makeOpponent(seed, wc, tier, open) {
    const r = new Rng(seed);
    const byClass = speciesByClass();
    let pool = byClass[wc].slice();
    if (open) pool = byClass[4].concat(byClass[5], byClass[6]);
    if (!pool.length) pool = byClass[Math.max(0, wc - 1)].concat(byClass[Math.min(6, wc + 1)]);
    const maxTier = 2 + tier;
    const usable = pool.filter((id) => RB.species.SPECIES[id].tier <= maxTier);
    const id = r.pick(usable.length ? usable : pool);
    const train = trainOf(tier);
    const P = bestOf(1 + tier * 2, () => RB.pheno.express(RB.species.make(id, r, { sex: r.chance(0.8) ? 'M' : 'F', sport: 0.02 * tier }), { train }));
    return { P, name: r.pick(ST().BIRD_NAMES), trainer: r.pick(TRAINERS) };
  }
  function makeBoss(S, arena) {
    const b = arena.boss, r = new Rng((S.seed ^ hashStr(arena.id)) >>> 0);
    const train = { muscle: 0.12, reflex: 0.12, lungs: 0.12, courage: 0.15 };
    const P = bestOf(10, () => {
      let g;
      if (b.mix[0] === b.mix[1]) g = RB.species.make(b.mix[0], r, { sex: 'M', sport: 0 });
      else g = RB.genome.breed(RB.species.make(b.mix[0], r, { sex: 'F', sport: 0 }), RB.species.make(b.mix[1], r, { sex: 'M', sport: 0 }), r, { mutRate: 0 });
      if (b.final) { g.sex = 'M'; RB.genome.setGeneBases(g, RB.genome.TRAITS.gigas.genes[0], [3, 3, 3, 3], 'both'); }
      return RB.pheno.express(g, { train });
    });
    return { P, name: b.bird, trainer: b.trainer, gear: b.gear ? { [b.gear]: true } : {}, boss: true };
  }

  // Today's three bouts at an arena (plus the boss once you have enough wins).
  function cards(S, arena) {
    const base = (S.seed ^ Math.imul(S.day, 40503) ^ hashStr(arena.id)) >>> 0;
    const r = new Rng(base), list = [];
    for (let i = 0; i < 3; i++) {
      const wc = r.pick(arena.classes), mode = r.pick(arena.modes), open = arena.id === 'cellar';
      const k = 0.8 + 0.2 * i + r.range(0, 0.25);
      list.push({ key: arena.id + ':' + S.day + ':' + i, i, wc, mode, open, fee: Math.round(arena.fee * k / 5) * 5, purse: Math.round(arena.purse * k / 5) * 5, seed: (base + i * 7919) >>> 0, tier: arena.tier });
    }
    const lg = leagueOf(S, arena.id);
    if (lg.wins >= arena.need && !lg.boss) {
      list.push({ key: arena.id + ':boss', i: 3, wc: arena.boss.wc, mode: arena.boss.mode || 'pit', open: arena.boss.wc >= 6, fee: arena.fee * 2, purse: arena.boss.purse, boss: true, tier: arena.tier });
    }
    return list;
  }
  function opponentFor(S, arena, card) { return card.boss ? makeBoss(S, arena) : makeOpponent(card.seed, card.wc, card.tier, card.open); }
  // Two strangers to watch and bet on. There are always two on the card at every arena: as soon as
  // one is fought, the next pair takes its slot. n counts the bouts already fought in that slot.
  function exhibition(S, arena, slot) {
    const done = ((S.exh || {})[arena.id] || [0, 0])[slot || 0], n = done * 2 + (slot || 0);
    const base = (S.seed ^ Math.imul(S.day, 9973) ^ hashStr(arena.id + 'x') ^ Math.imul(n + 1, 40503)) >>> 0, r = new Rng(base);
    const wc = r.pick(arena.classes), mode = r.pick(arena.modes), open = arena.id === 'cellar';
    return { key: arena.id + ':' + S.day + ':x' + n, slot: slot || 0, wc, mode, a: makeOpponent(base + 1, wc, arena.tier, open), b: makeOpponent(base + 2, wc, arena.tier, open), seed: base };
  }
  function exhibitionDone(S, arenaId, slot) {
    S.exh = S.exh || {};
    const e = (S.exh[arenaId] = S.exh[arenaId] || [0, 0]);
    e[slot]++;
  }
  // May this creature enter this bout? Returns '' or the reason.
  function canEnter(S, c, card) {
    const P = ST().pheno(c);
    if (!ST().isAdult(c)) return 'Too young.';
    if (c.rest > 0) return 'Still dazed.';
    if (c.bouts >= 2) return 'Fought twice today.';
    if (c.person && card.tier < 3) return 'Only the Cellar takes people.';
    if (!card.open && P.weightClass > card.wc) return 'Too heavy for ' + RB.pheno.WEIGHT_CLASSES[card.wc][0] + 'weight.';
    return '';
  }
  // The bookie's line: a cautious man, he pulls every estimate a quarter of the way back to even
  // and takes no cut. Backing a clear favourite therefore pays a little better than it should.
  const bookieLine = (p) => clamp(0.5 + (p - 0.5) * 0.75, 0.06, 0.94);
  // Payout multiplier (winnings per dollar staked) for a bet on a side the sims give chance p.
  const odds = (p) => 1 / bookieLine(p) - 1;

  // ---- sideshow
  const SHOWS = [
    { id: 'dash', name: 'The Dash', desc: 'First across the line.', fee: 30, prize: 150 },
    { id: 'hop', name: 'High Hop', desc: 'Highest jump wins.', fee: 30, prize: 150 },
    { id: 'pageant', name: 'Pageant', desc: 'The judges like what they like.', fee: 40, prize: 220 },
  ];
  // How fast, how high, how pretty. Deterministic scores; a little luck is added by the caller.
  function dashTime(P) { return 600 / Math.max(20, P.speedMax) / (0.8 + 0.2 * P.lungs); }
  function hopHeight(P) { const v = P.jumpV + (P.canFly ? 2.2 : 1) * P.flapV; return v * v / 2800 / Math.max(8, P.TD) * 10; }
  function pageantScore(P, taste) {
    const t = P.t;
    let s = 20 * t.sat + 12 * Math.min(2, t.tailLen) * (0.5 + t.tailFan) + 14 * t.crest + 12 * t.sheen + 8 * P.comb + (P.pattern !== 'solid' ? 8 : 0) + 6 * P.odd.length;
    if (taste === 'big') s += 10 * Math.min(2.5, P.S); else if (taste === 'tiny') s += 14 / Math.max(0.4, P.S); else if (taste === 'bright') s += 20 * t.sat * t.lit; else if (taste === 'odd') s += 14 * P.odd.length;
    return s;
  }
  function showOfDay(S) {
    const r = new Rng((S.seed ^ Math.imul(S.day, 31337)) >>> 0);
    return { taste: r.pick(['big', 'tiny', 'bright', 'odd']), seed: r.int(1, 1e9) };
  }

  RB.economy = { value, bfcSpecial, bfcIsSpecial, bfcPrice, ARENAS, ARENA, TRAINERS, speciesByClass, leagueOf, arenaOpen, makeOpponent, makeBoss, cards, opponentFor, exhibition, exhibitionDone,
    canEnter, odds, bookieLine, fightScore, SHOWS, dashTime, hopHeight, pageantScore, showOfDay };
})();
