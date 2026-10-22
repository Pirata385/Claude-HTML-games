// A climb up the Xenospire: run state, floors, opponents (who draft their own
// powers), the Loom between floors, saving and the persistent codex/records.
(function (XS) {
  'use strict';

  const VERSION = 1;
  const DIFFICULTY = [0.72, 1, 1.22];

  // Power specs are stored as { seed, floor, tier } and regenerated on demand.
  const powerOf = (spec) => XS.Power.generate(spec.seed, spec.floor, { tier: spec.tier, reinforced: spec.reinforced });
  const specOf = (def, extra) => Object.assign({ seed: def.seed, floor: def.floor, tier: def.tier }, extra || {});

  function newRun(seed) {
    seed = seed >>> 0;
    const rng = new XS.RNG(XS.hash(seed, 'themes'));
    const themeOrder = rng.shuffle(XS.Arena.THEMES.map((_, i) => i));
    return {
      v: VERSION, seed, floor: 1, phase: 'arrival', arrivalRoll: 0, rerolls: 3,
      genomeSeed: null, hpFrac: 1, powers: [], draftRound: 0,
      themeOrder, stats: { kos: 0, dmg: 0, voxels: 0, falls: 0, time: 0, casts: {} }, cleared: [], started: Date.now(),
    };
  }

  function arrivalOptions(run) {
    return [0, 1, 2].map((i) => XS.hash(run.seed, 'arrival', run.arrivalRoll, i));
  }

  // Three distinct-form offers for one draft round.
  function offers(seedParts, floor, opts = {}) {
    const out = [];
    const forms = new Set();
    for (let k = 0; out.length < 3 && k < 30; k++) {
      const seed = XS.hash(...seedParts, k);
      const tier = opts.maxTier != null ? Math.min(opts.maxTier, XS.Power.tierFor(seed, floor)) : XS.Power.tierFor(seed, floor);
      const def = XS.Power.generate(seed, floor, { tier });
      if (forms.has(def.form) && k < 20) continue;
      forms.add(def.form);
      out.push(def);
    }
    return out;
  }

  const draftOptions = (run) => offers([run.seed, 'draft', run.draftRound], 1, { maxTier: 1 });
  // The Loom after floor n weaves powers at the budget of floor n + 1.
  const loomOptions = (run) => offers([run.seed, 'loom', run.floor], run.floor + 1);

  function floorType(floor) {
    if (floor % 10 === 0) return 'guardian';
    if (floor % 5 === 0) return 'melee';
    return 'duel';
  }

  // Everything needed to stage a floor; deterministic from the run seed.
  function floorPlan(run, difficulty = 1) {
    const floor = run.floor;
    const type = floorType(floor);
    const theme = XS.Arena.THEMES[run.themeOrder[(floor - 1) % run.themeOrder.length]];
    const rng = new XS.RNG(XS.hash(run.seed, 'floor', floor));
    const nFoes = type === 'melee' ? (floor < 15 ? 2 : 3) : 1;
    const early = floor <= 2 ? 0.85 : 1;
    const opponents = [];
    for (let i = 0; i < nFoes; i++) {
      const gseed = XS.hash(run.seed, 'foe', floor, i);
      const genome = XS.Creature.generate(gseed, type === 'guardian' ? { size: 1.45 } : {});
      const rounds = type === 'guardian' ? 4 : 3;
      const picks = [], drafts = [];
      for (let r = 0; r < rounds; r++) {
        const offer = offers([run.seed, 'foedraft', floor, i, r], floor, { maxTier: type === 'guardian' && r === 0 ? 3 : undefined });
        if (type === 'guardian' && r === 0 && !offer.some((d) => d.tier === 3)) offer[0] = XS.Power.generate(offer[0].seed, floor, { tier: 3 });
        let best = offer[0], bs = -Infinity;
        const prng = new XS.RNG(XS.hash(gseed, 'pick', r));
        for (const d of offer) {
          const s = XS.Power.draftScore(d, genome.personality, picks) * (genome.personality === 'caotico' ? prng.range(0.5, 1.5) : 1);
          if (s > bs) { bs = s; best = d; }
        }
        picks.push(best);
        drafts.push({ offer, pick: best });
      }
      opponents.push({
        genomeSeed: gseed, genome, powers: picks, drafts,
        hpMult: (1 + 0.06 * (floor - 1)) * early * (type === 'guardian' ? 3 : type === 'melee' ? 0.8 : 1),
        sizeMult: 1, dmgMult: type === 'guardian' ? 1.1 : 1,
        skill: XS.clamp((0.3 + floor * 0.025) * (DIFFICULTY[difficulty] || 1), 0.15, 1.1),
        guardian: type === 'guardian',
      });
    }
    const foe = opponents[0];
    const line = XS.Lore.floorIntro(rng, type, {
      n: floor, foe: foe.genome.name, world: foe.genome.bio.world, likes: foe.genome.bio.likes, motive: foe.genome.bio.motive, theme: theme.name,
    });
    return { floor, type, theme, arenaSeed: XS.hash(run.seed, 'arena', floor), opponents, line };
  }

  // Build the Battle for a floor.
  function stageBattle(run, plan, settings = {}) {
    const n = 1 + plan.opponents.length;
    const arena = XS.Arena.generate(plan.arenaSeed, plan.floor, { fighters: n, theme: plan.theme, big: plan.type !== 'duel' });
    const player = XS.Creature.generate(run.genomeSeed);
    const playerHpMult = 1 + 0.04 * (plan.floor - 1);
    const fighters = [{
      genome: player, powers: run.powers.map(powerOf), team: 0, isPlayer: true,
      hpMult: playerHpMult, hp: Math.round(player.stats.maxHp * playerHpMult * run.hpFrac),
      dmgMult: settings.difficulty === 0 ? 1.15 : 1,
    }];
    plan.opponents.forEach((o, i) => fighters.push({
      genome: o.genome, powers: o.powers, team: plan.type === 'melee' ? i + 1 : 1, hpMult: o.hpMult, dmgMult: o.dmgMult * (settings.difficulty === 0 ? 0.8 : settings.difficulty === 2 ? 1.12 : 1),
    }));
    const battle = new XS.Battle({ arena, seed: run.seed, floor: plan.floor, fighters });
    battle.fighters.forEach((f, i) => {
      if (i === 0) return;
      const o = plan.opponents[i - 1];
      f.ai = new XS.AI(f, { skill: o.skill, salt: plan.floor });
      if (o.guardian) { f.guardian = true; f.name = XS.t('guardian', { n: plan.floor }); }
    });
    return battle;
  }

  // After a won floor: fold stats in, heal a bit, advance.
  function recordVictory(run, battle) {
    const p = battle.player;
    run.stats.kos += p.stats.kos;
    run.stats.dmg += Math.round(p.stats.dmg);
    run.stats.voxels += p.stats.voxels;
    run.stats.falls += p.stats.falls;
    run.stats.time += battle.time;
    p.stats.casts.forEach((n, i) => {
      const spec = run.powers[i];
      if (!spec || !n) return;
      const key = spec.seed + ':' + spec.tier;
      run.stats.casts[key] = (run.stats.casts[key] || 0) + n;
    });
    run.cleared.push({ floor: run.floor, time: Math.round(battle.time) });
    run.hpFrac = Math.min(1, p.hp / p.maxHp + 0.35);
    run.phase = 'loom';
  }

  function favoritePower(run) {
    let best = null, bn = 0;
    for (const [k, n] of Object.entries(run.stats.casts)) if (n > bn) { bn = n; best = k; }
    if (!best) return null;
    const [seed, tier] = best.split(':').map(Number);
    const spec = run.powers.find((p) => p.seed === seed && p.tier === tier) || { seed, floor: run.floor, tier };
    return { def: powerOf(spec), casts: bn };
  }

  // ---------------------------------------------------------- persistence
  const saveRun = (run) => XS.store.save('run', run);
  const loadRun = () => {
    const r = XS.store.load('run', null);
    return r && r.v === VERSION && r.seed != null ? r : null;
  };
  const clearRun = () => XS.store.remove('run');

  function meta() {
    return Object.assign({ best: 0, runs: [], beings: [], powers: [], totalKos: 0, totalVoxels: 0, introSeen: false, tutorialDone: false }, XS.store.load('meta', {}));
  }
  function saveMeta(m) { XS.store.save('meta', m); }
  function remember(m, kind, entry, cap = 120) {
    const list = m[kind];
    const key = JSON.stringify(entry);
    if (list.some((e) => JSON.stringify(e) === key)) return;
    list.unshift(entry);
    if (list.length > cap) list.length = cap;
  }
  function endRun(run, foeName) {
    const m = meta();
    const g = XS.Creature.generate(run.genomeSeed);
    const reached = run.floor;
    const newRecord = reached > m.best;
    m.best = Math.max(m.best, reached);
    m.totalKos += run.stats.kos;
    m.totalVoxels += run.stats.voxels;
    const rng = new XS.RNG(XS.hash(run.seed, 'epitaph', reached));
    const epitaph = XS.Lore.epitaph(rng, { name: g.name, n: reached, foe: foeName || 'um desconhecido', world: g.bio.world, likes: g.bio.likes });
    m.runs.unshift({ seed: run.seed, floor: reached, being: run.genomeSeed, name: g.name, date: Date.now(), epitaph });
    if (m.runs.length > 30) m.runs.length = 30;
    saveMeta(m);
    clearRun();
    return { newRecord, best: m.best, epitaph };
  }

  XS.Run = {
    newRun, arrivalOptions, draftOptions, loomOptions, floorPlan, floorType, stageBattle, recordVictory, favoritePower,
    powerOf, specOf, saveRun, loadRun, clearRun, meta, saveMeta, remember, endRun, DIFFICULTY,
  };
})(globalThis.XS = globalThis.XS || {});
