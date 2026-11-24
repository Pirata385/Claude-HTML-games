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
    const r = P.base, stat = (r.power + r.speed + r.tough + r.stamina + r.guts) / 500; // (the old even scale: phenotype.js)
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
  // modes: each arena's twist (see fight.js TWISTS): nobody falls out of a ring any more
  const ARENAS = [
    { id: 'backyard', name: 'Backyard Pit', tier: 0, modes: ['grain'], classes: [1, 2, 3], fee: 15, purse: 70, need: 3, betCap: 300,
      boss: { trainer: 'Old Bira', bird: 'Sete Facas', mix: ['gamecock', 'gamecock'], wc: 3, purse: 400, gear: null } },
    { id: 'county', name: 'County Ring', tier: 1, modes: ['mud'], classes: [2, 3, 4], fee: 50, purse: 220, need: 4, betCap: 1000,
      boss: { trainer: 'Dona Zefa', bird: 'Tempestade', mix: ['goose', 'swan'], wc: 4, purse: 1400, gear: 'scarf' } },
    { id: 'city', name: 'City Arena', tier: 2, modes: ['wind'], classes: [3, 4, 5], fee: 150, purse: 650, need: 4, betCap: 3000,
      boss: { trainer: 'Dr. Quill', bird: 'Bisturi', mix: ['eagle', 'secretary'], wc: 4, purse: 4000, gear: 'helmet' } },
    { id: 'cellar', name: 'The Cellar', tier: 3, modes: ['dark'], classes: [6], fee: 400, purse: 1700, need: 5, betCap: 8000, night: true,
      boss: { trainer: 'The Butcher', bird: 'Machado', mix: ['cassowary', 'cassowary'], wc: 6, purse: 9000, gear: 'spurs' } },
    { id: 'grand', name: 'Grand Ring', tier: 4, modes: ['rounds'], classes: [4, 5, 6], fee: 1000, purse: 4500, need: 5, betCap: 20000,
      boss: { trainer: 'Madame Plume', bird: 'Imperatriz', mix: ['terror', 'cassowary'], wc: 6, purse: 25000, gear: 'spurs', final: true } },
  ];
  const ARENA = {};
  for (const a of ARENAS) ARENA[a.id] = a;
  // Arenas out on the islands of the open sea register themselves here when their island is found.
  function addArena(a) { if (!ARENA[a.id]) ARENA[a.id] = a; return ARENA[a.id]; }
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
  // Ever champion here (the title may since have passed to someone new).
  const everWon = (S, id) => { const lg = leagueOf(S, id); return !!(lg.boss || lg.ever); };
  // Every arena is open from the start, except the last: the Grand Ring only takes a bird whose
  // trainer has been champion of every other arena.
  function arenaOpen(S, arena) { return !arena.boss.final || !!S.sandbox || ARENAS.every((a) => a === arena || everWon(S, a.id)); }
  // Who holds the title you would fight for: the arena's own boss, or, once your champion has
  // retired or left you, whoever claimed it after (one new champion each time: gen 1, 2, ...).
  const EPITHETS = ['the Younger', 'Sharp-Spur', 'the Comet', 'Iron-Beak', 'from Down the River', 'the Challenger', 'Two-Bets', 'the Quiet', 'Long-Shadow', 'the Upstart'];
  function bossOf(S, arena) {
    const gen = leagueOf(S, arena.id).gen || 0;
    if (!gen) return arena.boss;
    const r = new Rng((S.seed ^ hashStr(arena.id + ':champion:' + gen)) >>> 0), sex = r.chance(0.5) ? 'M' : 'F';
    return Object.assign({}, arena.boss, { trainer: RB.npc.randomName(r, sex) + ' ' + r.pick(EPITHETS), bird: r.pick(ST().BIRD_NAMES), purse: Math.round(arena.boss.purse * (1 + 0.1 * Math.min(gen, 5))), gen });
  }

  // A rough fighting score, used to pick the better of a few random opponents.
  function fightScore(P) { const r = P.base; return r.power * 1.4 + r.tough + r.speed * 0.5 + r.stamina * 0.6 + r.guts * 0.8 + r.fury * 0.5; }
  function bestOf(n, make) {
    let best = null, bs = -1;
    for (let i = 0; i < n; i++) { const P = make(); const s = fightScore(P); if (s > bs) { bs = s; best = P; } }
    return best;
  }
  const trainOf = (tier) => ({ muscle: 0.03 * tier, reflex: 0.03 * tier, lungs: 0.03 * tier, courage: 0.05 * tier });

  // An opponent for a weight class at an arena tier: the pick of a few birds, with some training.
  // An opponent for a weight class at an arena tier: the pick of a few birds that make the weight,
  // with some training. Nothing common reaches Titanweight, so those are heavy runners grown to the
  // largest size their genes allow.
  const TITANS = ['ostrich', 'emu', 'cassowary'];
  function makeOpponent(seed, wc, tier, open) {
    const r = new Rng(seed);
    const byClass = speciesByClass(), titan = !open && wc === 6;
    let pool = open ? byClass[4].concat(byClass[5], byClass[6]) : titan ? TITANS.slice() : byClass[wc].slice();
    if (!pool.length) pool = byClass[Math.max(0, wc - 1)].concat(byClass[Math.min(6, wc + 1)]);
    const maxTier = 2 + tier;
    const usable = pool.filter((id) => RB.species.SPECIES[id].tier <= maxTier);
    const id = r.pick(usable.length ? usable : pool), sp = RB.species.SPECIES[id];
    const train = trainOf(tier);
    const make = () => {
      const sex = r.chance(0.8) ? 'M' : 'F';
      const g = titan ? RB.genome.fromTargets(Object.assign({}, sp.t, { size: 2.7, bone: 1.3 }), sp.sw, r, { sex, colorVar: sp.cv === undefined ? 0.045 : sp.cv })
        : RB.species.make(id, r, { sex, sport: 0.02 * tier });
      return RB.pheno.express(g, { train });
    };
    let best = null, bs = -1, fallback = null;
    const want = 1 + tier * 2;
    for (let got = 0, tries = 0; got < want && tries < want + 12; tries++) {
      const P = make();
      if (!open && P.weightClass > wc) { if (!fallback || P.weightKg < fallback.weightKg) fallback = P; continue; }
      got++;
      const sc = fightScore(P);
      if (sc > bs) { bs = sc; best = P; }
    }
    return { P: best || fallback, name: r.pick(ST().BIRD_NAMES), trainer: r.pick(TRAINERS) };
  }
  function makeBoss(S, arena) {
    const b = bossOf(S, arena), r = new Rng((S.seed ^ hashStr(arena.id) ^ Math.imul(b.gen || 0, 2654435761)) >>> 0);
    const train = b.gen ? { muscle: 0.15, reflex: 0.15, lungs: 0.15, courage: 0.15 } : { muscle: 0.12, reflex: 0.12, lungs: 0.12, courage: 0.15 }; // a new champion comes in hungry
    const P = bestOf(10, () => {
      let g;
      if (b.mix[0] === b.mix[1]) g = RB.species.make(b.mix[0], r, { sex: 'M', sport: 0 });
      else g = RB.genome.breed(RB.species.make(b.mix[0], r, { sex: 'F', sport: 0 }), RB.species.make(b.mix[1], r, { sex: 'M', sport: 0 }), r, { mutRate: 0 });
      if (b.final) { g.sex = 'M'; RB.genome.setGeneBases(g, RB.genome.TRAITS.gigas.genes[0], [3, 3, 3, 3], 'both'); }
      return RB.pheno.express(g, { train });
    });
    return { P, name: b.bird, trainer: b.trainer, gear: b.gear ? { [b.gear]: true } : {}, boss: true };
  }

  // Today's bouts at an arena: one in every weight class, from Gnat to Titan, so any bird you own
  // has a fight to pick (plus the boss once you have enough wins). Heavier classes pay a little more.
  function cards(S, arena) {
    const base = (S.seed ^ Math.imul(S.day, 40503) ^ hashStr(arena.id)) >>> 0;
    const r = new Rng(base), list = [];
    for (let wc = 0; wc < RB.pheno.WEIGHT_CLASSES.length; wc++) {
      const mode = r.pick(arena.modes), k = 0.85 + 0.05 * wc + r.range(0, 0.2);
      list.push({ key: arena.id + ':' + S.day + ':w' + wc, i: wc, wc, mode, open: false, fee: Math.round(arena.fee * k / 5) * 5, purse: Math.round(arena.purse * k / 5) * 5, seed: (base + wc * 7919) >>> 0, tier: arena.tier });
    }
    const lg = leagueOf(S, arena.id);
    if (lg.wins >= arena.need && !lg.boss) {
      const b = bossOf(S, arena);
      list.push({ key: arena.id + ':boss' + (b.gen ? ':' + b.gen : ''), i: list.length, wc: b.wc, mode: b.mode || arena.modes[0], open: b.wc >= 6, fee: arena.fee * 2, purse: b.purse, boss: true, tier: arena.tier });
    }
    return list;
  }
  // Opponents are worked out once per card and kept: the lobby draws them every frame.
  const oppCache = new Map();
  function cached(key, make) {
    let v = oppCache.get(key);
    if (!v) { if (oppCache.size > 200) oppCache.clear(); v = make(); oppCache.set(key, v); }
    return v;
  }
  function opponentFor(S, arena, card) {
    return cached(S.seed + ':' + card.key + (card.boss ? '' : ':' + card.seed), () => (card.boss ? makeBoss(S, arena) : makeOpponent(card.seed, card.wc, card.tier, card.open)));
  }
  // Two strangers to watch and bet on. There are always two on the card at every arena: as soon as
  // one is fought, the next pair takes its slot. n counts the bouts already fought in that slot.
  function exhibition(S, arena, slot) {
    const done = ((S.exh || {})[arena.id] || [0, 0])[slot || 0], n = done * 2 + (slot || 0);
    const base = (S.seed ^ Math.imul(S.day, 9973) ^ hashStr(arena.id + 'x') ^ Math.imul(n + 1, 40503)) >>> 0, r = new Rng(base);
    const wc = r.pick(arena.classes), mode = r.pick(arena.modes), open = arena.id === 'cellar';
    const key = arena.id + ':' + S.day + ':x' + n;
    return cached(S.seed + ':' + key + ':' + base, () => ({ key, slot: slot || 0, wc, mode, a: makeOpponent(base + 1, wc, arena.tier, open), b: makeOpponent(base + 2, wc, arena.tier, open), seed: base }));
  }
  function exhibitionDone(S, arenaId, slot) {
    S.exh = S.exh || {};
    const e = (S.exh[arenaId] = S.exh[arenaId] || [0, 0]);
    e[slot]++;
  }
  // May this creature enter this bout? Returns '' or the reason.
  function canEnter(S, c, card) {
    const P = ST().pheno(c);
    if (ST().isRetired(c)) return 'Retired: too old to fight.';
    if (!ST().isAdult(c)) return 'Too young.';
    if (c.rest > 0) return 'Still dazed.';
    if (c.tired) return 'Worn out: a tonic, or tomorrow.';
    if (c.person && card.tier < 3) return 'Only the Cellar takes people.';
    if (!card.open && P.weightClass > card.wc) return 'Too heavy for ' + RB.pheno.WEIGHT_CLASSES[card.wc][0] + 'weight.';
    return '';
  }
  // Betting. The house reads the two fighters' numbers (fightScore, and how hurt they are) and pays
  // by its guess at each side's chance: the favourite pays little, an even bout about double, the
  // underdog up to four times the stake. It pays a little over the odds, so a good eye still comes
  // out ahead over time, but no longer by much. (It used to pay three times the stake on any winner,
  // and backing the favourite of every exhibition, which you can watch all day, made a fortune.)
  const BET_RETURN = 3; // the most an older build paid; kept for older callers
  const BET_EDGE = 1.2, BET_MIN = 1.2, BET_MAX = 4, BET_SPREAD = 35;
  // The house's guess at the chance that A beats B (hpA, hpB: health left, 0..1).
  function winChance(PA, PB, hpA, hpB) {
    const sa = fightScore(PA) * (0.6 + 0.4 * (hpA === undefined ? 1 : hpA)), sb = fightScore(PB) * (0.6 + 0.4 * (hpB === undefined ? 1 : hpB));
    return 1 / (1 + Math.exp(-(sa - sb) / BET_SPREAD));
  }
  // What a winning bet on a side with chance p pays back, stake included (to one decimal).
  const betReturn = (p) => Math.round(clamp(BET_EDGE / Math.max(0.01, p), BET_MIN, BET_MAX) * 10) / 10;
  // The cheapest entry to a bout anywhere: lose a bet and fall below it, and it is time to muck out.
  const minEntry = () => Math.min(...ARENAS.map((a) => Math.round(a.fee * 0.85 / 5) * 5));
  // Settle a bet once the bout is over (the stake was paid when it was placed). A lost bet that leaves
  // too little for any entry fee sends you to muck out the henhouse (common.checkBroke). Returns the payout.
  function settleBet(S, bet, winner) {
    if (!bet || !(bet.amount > 0)) return 0;
    if (bet.side === winner) { const pay = Math.round(bet.amount * (1 + bet.mult)); S.money += pay; S.stats.earned += pay - bet.amount; return pay; }
    if (S.money < minEntry()) S.mustMuck = true;
    return 0;
  }

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

  RB.economy = { everWon, bossOf, addArena, value, bfcSpecial, bfcIsSpecial, bfcPrice, ARENAS, ARENA, TRAINERS, speciesByClass, leagueOf, arenaOpen, makeOpponent, makeBoss, cards, opponentFor, exhibition, exhibitionDone,
    canEnter, BET_RETURN, winChance, betReturn, minEntry, settleBet, fightScore, SHOWS, dashTime, hopHeight, pageantScore, showOfDay };
})();
