// Day/night cycle and hordes: dusk warning with the attack directions, night spawns sized by
// a growing budget, and the dawn upkeep that scores the night.
(function (UB) {
  'use strict';
  const { TIME, ZOMBIES, DIFFICULTY, BUILDINGS } = UB.DEF;

  function phaseLen(S, phase) {
    if (phase === 'day') return S.day === 1 ? TIME.DAY1 : TIME.DAY;
    return phase === 'dusk' ? TIME.DUSK : TIME.NIGHT;
  }
  const isNight = (S) => S.clock.phase === 'night' || (S.clock.phase === 'dusk' && S.clock.t > TIME.DUSK * 0.6);

  // 0 (dark) .. 1 (full day) for lighting, accuracy and the renderer's colour grading.
  function daylight(S) {
    const c = S.clock;
    if (c.phase === 'day') {
      const L = phaseLen(S, 'day');
      if (c.t < 20) return 0.35 + 0.65 * (c.t / 20);
      if (c.t > L - 25) return 0.75 + 0.25 * ((L - c.t) / 25);
      return 1;
    }
    if (c.phase === 'dusk') return 0.75 - 0.6 * (c.t / TIME.DUSK);
    return 0.15;
  }
  // Clock time shown in the HUD: day 06:00–18:00, dusk 18:00–19:30, night 19:30–06:00.
  function clockHours(S) {
    const c = S.clock, L = phaseLen(S, c.phase), f = c.t / L;
    if (c.phase === 'day') return 6 + 12 * f;
    if (c.phase === 'dusk') return 18 + 1.5 * f;
    return (19.5 + 10.5 * f) % 24;
  }

  function budget(night, difficulty) {
    const d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    let b = (8 + 6 * night + 0.6 * Math.pow(night, 1.6)) * d.horde;
    if (night % 5 === 0) b *= 1.25;
    return b;
  }
  const WEIGHTS = { walker: 10, runner: 4, crawler: 3, bloater: 2, brute: 1.2, spitter: 1.5, leaper: 1.3, toxic: 1.2, screamer: 0.8, armored: 2 };
  function compose(S, night) {
    let b = UB.Waves.budget(night, S.difficulty);
    const list = [];
    if (night % 5 === 0 && night >= ZOMBIES.colossus.from) for (let k = 0; k < Math.floor(night / 10); k++) { list.push('colossus'); b -= ZOMBIES.colossus.cost * 0.5; }
    const pairs = Object.keys(WEIGHTS).filter((t) => ZOMBIES[t].from <= night).map((t) => [t, WEIGHTS[t]]);
    let guard = 0;
    while (b >= 1 && guard++ < 2000) {
      const t = S.rng.weighted(pairs);
      if (ZOMBIES[t].cost > b + 0.5) { if (b >= 1) { list.push('walker'); b -= 1; } continue; }
      list.push(t);
      b -= ZOMBIES[t].cost;
    }
    return list;
  }

  function startDusk(S) {
    const night = S.day;
    const dirs = night <= 3 ? 1 : night <= 9 ? 2 : 3;
    const hq = UB.World.hq(S);
    // Favour spawn points that are not too close to each other.
    const pool = S.rng.shuffle(S.spawns.slice());
    const chosen = [];
    for (const sp of pool) {
      if (chosen.length >= dirs) break;
      if (chosen.some((c) => c.side === sp.side) && pool.length > dirs * 2) continue;
      chosen.push(sp);
    }
    while (chosen.length < dirs && pool.length) chosen.push(pool[chosen.length % pool.length]);
    const queue = compose(S, night);
    S.horde = { night, spawns: chosen.map((c) => ({ x: c.x, y: c.y, side: c.side })), queue, timer: 0, total: queue.length };
    const sides = [...new Set(chosen.map((c) => c.side))];
    UB.Game.msg(S, night % 5 === 0 ? 'msg.hordeBlood' : 'msg.horde', { n: queue.length, sides }, 'bad', chosen[0] && chosen[0].x, chosen[0] && chosen[0].y);
    // Workers come out to defend unless their building keeps a night shift; they return at dawn.
    for (const b of S.buildings) {
      if (b.dead || b.nightShift || !BUILDINGS[b.type].levels[0].workers) continue;
      for (const id of b.workers.slice()) {
        const u = UB.World.get(S, id);
        if (!u) continue;
        UB.Units.leaveBuilding(S, u);
        u.order = null;
        u.shift = b.id;
      }
    }
    const out = S.units.filter((u) => !u.dead && !u.inside && !UB.World.inTerritory(S, u.x, u.y)).length;
    if (out) UB.Game.msg(S, 'msg.outside', { n: out }, 'warn');
    UB.Game.fx(S, { t: 'alarm' });
    if (hq) UB.Path.updateFlow(S, true);
  }

  function spawnTick(S, dt) {
    const h = S.horde;
    if (!h || !h.queue.length) return;
    h.timer -= dt;
    if (h.timer > 0) return;
    h.timer = S.rng.range(1.6, 3.2);
    const group = Math.min(h.queue.length, S.rng.int(3, 6) + Math.floor(h.night / 4));
    for (let k = 0; k < group; k++) {
      if (S.zombies.length >= UB.DEF.BAL.maxZombies) break;
      const sp = h.spawns[(h.queue.length + k) % h.spawns.length];
      const type = h.queue.shift();
      const x = Math.min(S.map.w - 0.5, Math.max(0.5, sp.x + 0.5 + S.rng.range(-1.2, 1.2)));
      const y = Math.min(S.map.h - 0.5, Math.max(0.5, sp.y + 0.5 + S.rng.range(-1.2, 1.2)));
      const i = UB.World.idx(S, Math.floor(x), Math.floor(y));
      const z = UB.Zombies.spawn(S, type, S._blockZ[i] ? sp.x + 0.5 : x, S._blockZ[i] ? sp.y + 0.5 : y, { state: 'horde' });
      if (ZOMBIES[type].boss) UB.Game.msg(S, 'msg.colossusComing', null, 'bad', z.x, z.y);
    }
  }

  function dawn(S) {
    S.nights++;
    S.day++;
    S.horde = null;
    const lines = UB.Eco.dawn(S);
    UB.Explore.dawn(S);
    UB.Game.msg(S, 'msg.dawn', { day: S.day, nights: S.nights }, 'good');
    for (const l of lines) UB.Game.msg(S, l.k, l.p, 'warn');
    UB.Game.fx(S, { t: 'dawn' });
    for (const u of S.units) {
      if (!u.shift) continue;
      const b = UB.World.get(S, u.shift);
      u.shift = 0;
      if (b && !b.dead && !u.dead && !u.order && b.workers.length < UB.Buildings.slots(b)) {
        if (u.inside) UB.Units.leaveBuilding(S, u);
        UB.Units.order(S, u, { type: 'work', id: b.id });
      }
    }
    S._autosave = true;
  }

  function tick(S, dt) {
    const c = S.clock;
    if (S.tutorial && c.phase === 'day') return; // the first-run tutorial holds the day clock
    c.t += dt;
    if (c.phase === 'night') spawnTick(S, dt);
    if (c.t < phaseLen(S, c.phase)) return;
    c.t = 0;
    if (c.phase === 'day') { c.phase = 'dusk'; startDusk(S); }
    else if (c.phase === 'dusk') { c.phase = 'night'; if (S.horde) S.horde.timer = 0; }
    else { c.phase = 'day'; dawn(S); }
  }

  // Skip ahead to the next dusk (the "end day early" button).
  function skipToDusk(S) {
    if (S.clock.phase !== 'day') return false;
    S.clock.t = phaseLen(S, 'day') - 0.01;
    return true;
  }

  UB.Waves = { tick, isNight, daylight, clockHours, budget, compose, phaseLen, skipToDusk };
})(globalThis.UB = globalThis.UB || {});
