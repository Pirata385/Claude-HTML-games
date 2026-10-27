// Game orchestrator: new games, the fixed-step tick, the command API used by every input
// method (mouse, keyboard, touch, tests), scoring and save/load.
(function (UB) {
  'use strict';
  const { BAL, DIFFICULTY, TIME, RES, POIS, FEATURE, BUILDINGS } = UB.DEF;
  const W = UB.World;
  const VERSION = 1;

  function fx(S, e) {
    S.fx.push(e);
    if (S.fx.length > 4000) S.fx.splice(0, 2000);
  }
  function msg(S, text, kind, x, y) {
    const m = { text, kind: kind || 'info', x, y, t: S.time, day: S.day, id: (S.msgSeq = (S.msgSeq || 0) + 1) };
    S.log.push(m);
    if (S.log.length > 80) S.log.shift();
    fx(S, { t: 'msg', m });
  }

  function initTransient(S) {
    const N = S.map.w;
    S._zgrid = new UB.Spatial.Grid(N, 2);
    S._ugrid = new UB.Spatial.Grid(N, 2);
    S._zgrid.rebuild(S.zombies);
    S._ugrid.rebuild(S.units);
    S.fx = S.fx || [];
    S.log = S.log || [];
  }

  function newGame(opts) {
    opts = opts || {};
    const seed = String(opts.seed !== undefined && opts.seed !== '' ? opts.seed : Math.floor(Math.random() * 1e9));
    const difficulty = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
    const diff = DIFFICULTY[difficulty];
    const res = {};
    for (const k of RES) res[k] = Math.round(BAL.startRes[k] * diff.start);
    const S = {
      version: VERSION, seed, difficulty, tick: 0, time: 0, day: 1, nights: 0,
      clock: { phase: 'day', t: 25 }, weather: 'clear',
      map: W.createMap(BAL.mapSize), units: [], zombies: [], buildings: [], pois: [], spawns: [], base: null,
      nextId: 1, res, morale: BAL.moraleStart, armory: { shotgun: 0, rifle: 0 }, unlocked: {},
      stats: { kills: 0, loots: 0, nests: 0, deaths: 0, built: 0, recruits: 0, shots: 0, discovered: 0 },
      memorial: [], proj: [], horde: null, drops: {}, pathQ: [], autoRepair: true, over: null,
      power: { supply: 0, demand: 0, used: 0 }, squads: { 1: [], 2: [], 3: [], 4: [] }, hqId: 0, dropMark: null, msgSeq: 0, tips: {},
      fx: [], log: [],
    };
    S.rng = new UB.Rng(UB.hashStr('play|' + seed));
    W.rebuild(S);
    initTransient(S);
    UB.MapGen.generate(S);
    const hq = UB.Buildings.create(S, 'hq', S.base.x - 1, S.base.y - 1, { built: true });
    S.hqId = hq.id;
    const offs = [[-1, 3], [1, 3], [3, 0], [-3, 0], [0, -3]];
    BAL.startRoles.forEach((role, k) => {
      const o = offs[k % offs.length];
      const p = W.nearestOpen(S, S.base.x + o[0], S.base.y + o[1], false, 5);
      UB.Units.create(S, role, p.x + 0.5, p.y + 0.5);
    });
    W.rebuild(S);
    initTransient(S);
    UB.Buildings.computeLights(S);
    UB.Eco.updatePower(S);
    UB.Path.updateFlow(S, true);
    UB.Explore.vision(S);
    msg(S, 'Dia 1. Reúna recursos, construa defesas e prepare-se: a primeira horda chega ao anoitecer.', 'info');
    return S;
  }

  function finalize(S) {
    if (S.finalScore) return;
    S.finalScore = score(S);
    msg(S, S.over === 'hq' ? 'Fim de jogo: o QG foi destruído.' : 'Fim de jogo: não restou ninguém.', 'bad');
    fx(S, { t: 'gameover' });
  }

  function tick(S) {
    if (S.over) { finalize(S); return; }
    const dt = TIME.TICK;
    S.tick++;
    S.time += dt;
    S._zgrid.rebuild(S.zombies);
    S._ugrid.rebuild(S.units);
    UB.Waves.tick(S, dt);
    UB.Path.updateFlow(S);
    UB.Path.process(S, 9000);
    UB.Units.tick(S, dt);
    UB.Zombies.tick(S, dt);
    UB.Combat.tickProjectiles(S, dt);
    UB.Buildings.tick(S, dt);
    UB.Eco.tick(S, dt);
    UB.Explore.tick(S, dt);
    cleanup(S);
    if (!S.over && !S.units.some((u) => !u.dead)) S.over = 'dead';
    if (S.over) finalize(S);
  }

  function cleanup(S) {
    const purge = (list) => {
      let any = false;
      for (const e of list) if (e.dead) { any = true; W.unregister(S, e); }
      return any ? list.filter((e) => !e.dead) : list;
    };
    if (S.zombies.some((z) => z.dead)) S.zombies = purge(S.zombies);
    if (S.units.some((u) => u.dead)) {
      S.units = purge(S.units);
      for (const k in S.squads) S.squads[k] = S.squads[k].filter((id) => W.get(S, id));
    }
    if (S.buildings.some((b) => b.dead)) S.buildings = purge(S.buildings);
    if (S.pois.some((p) => p.dead)) S.pois = purge(S.pois);
  }

  function score(S) {
    const sc = BAL.score;
    const alive = S.units.filter((u) => !u.dead).length;
    return S.nights * sc.night + S.stats.kills * sc.kill + S.stats.loots * sc.loot + (S.stats.nests || 0) * sc.nest + alive * sc.alive;
  }

  // Free tiles around (x, y) for a group move, closest first.
  function formation(S, x, y, n) {
    const out = [];
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let r = 0; r <= 6 && out.length < n; r++) {
      const ring = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (!W.inb(S, tx, ty)) continue;
        const i = W.idx(S, tx, ty);
        if (S._blockU[i]) continue;
        ring.push({ x: tx + 0.5, y: ty + 0.5, d: dx * dx + dy * dy });
      }
      ring.sort((a, b) => a.d - b.d);
      for (const p of ring) { if (out.length < n) out.push(p); }
    }
    return out;
  }

  const unitsOf = (S, ids) => (ids || []).map((id) => W.get(S, id)).filter((u) => u && !u.dead && u.kind === 'unit');

  // Every player action goes through here. Returns {ok, reason?}.
  function command(S, c) {
    if (S.over) return { ok: false, reason: 'Fim de jogo' };
    const us = unitsOf(S, c.ids);
    switch (c.type) {
      case 'move': case 'amove': {
        if (!us.length) return { ok: false };
        const slots = formation(S, c.x, c.y, us.length);
        if (!slots.length) return { ok: false, reason: 'Local inacessível' };
        const left = us.slice();
        for (const s of slots) {
          let bi = 0, bd = Infinity;
          left.forEach((u, k) => { const d = UB.U.dist2(u.x, u.y, s.x, s.y); if (d < bd) { bd = d; bi = k; } });
          const u = left.splice(bi, 1)[0];
          UB.Units.order(S, u, { type: c.type, x: s.x, y: s.y });
        }
        for (const u of left) UB.Units.order(S, u, { type: c.type, x: c.x, y: c.y });
        return { ok: true };
      }
      case 'attack': {
        const t = W.get(S, c.id);
        if (!t || t.dead) return { ok: false };
        for (const u of us) UB.Units.order(S, u, { type: 'attack', id: t.id });
        return { ok: true };
      }
      case 'gather': {
        const i = W.idx(S, c.x, c.y);
        const f = FEATURE[S.map.feature[i]];
        if (!f || (!f.res && !f.pickup)) return { ok: false, reason: 'Nada para coletar' };
        for (const u of us) UB.Units.order(S, u, { type: 'gather', x: c.x, y: c.y, res: f.res, phase: 'go' });
        return { ok: true };
      }
      case 'loot': {
        const p = W.get(S, c.id);
        if (!p || p.dead) return { ok: false };
        if (POIS[p.type].nest) return command(S, { type: 'attack', ids: c.ids, id: p.id });
        if (p.searchesLeft <= 0) return { ok: false, reason: 'Já foi esgotado' };
        for (const u of us) UB.Units.order(S, u, { type: 'loot', id: p.id });
        return { ok: true };
      }
      case 'garrison': case 'work': case 'patient': {
        const b = W.get(S, c.id);
        if (!b || b.dead || b.built < 1) return { ok: false, reason: 'Construção indisponível' };
        const role = c.type;
        const list = role === 'garrison' ? b.garrison : role === 'patient' ? b.patients : b.workers;
        let free = UB.Buildings.slots(b) - list.length;
        if (free <= 0) return { ok: false, reason: 'Sem vagas' };
        for (const u of us) {
          if (free <= 0) break;
          if (u.inside === b.id) continue;
          UB.Units.order(S, u, { type: role, id: b.id });
          free--;
        }
        return { ok: true };
      }
      case 'build': {
        const r = UB.Buildings.place(S, c.build, c.x, c.y);
        return r.ok ? { ok: true, id: r.b.id } : r;
      }
      case 'buildLine': return UB.Buildings.placeLine(S, c.build, c.x0, c.y0, c.x1, c.y1);
      case 'demolish': {
        const b = W.get(S, c.id);
        if (!b || b.kind !== 'bld') return { ok: false };
        return UB.Buildings.demolish(S, b);
      }
      case 'upgrade': {
        const b = W.get(S, c.id);
        if (!b || b.kind !== 'bld') return { ok: false };
        return UB.Buildings.upgrade(S, b);
      }
      case 'repair': {
        const b = W.get(S, c.id);
        if (!b || b.kind !== 'bld') return { ok: false };
        let workers = us;
        if (!workers.length) {
          // Send the two closest free survivors in the base.
          workers = S.units.filter((u) => !u.dead && !u.inside && !u.order && W.inTerritory(S, u.x, u.y))
            .sort((a, z) => UB.U.dist2(a.x, a.y, b.tx, b.ty) - UB.U.dist2(z.x, z.y, b.tx, b.ty)).slice(0, 2);
        }
        if (!workers.length) return { ok: false, reason: 'Ninguém disponível na base' };
        for (const u of workers) UB.Units.order(S, u, { type: b.built < 1 ? 'build' : 'repair', id: b.id });
        return { ok: true };
      }
      case 'toggle': {
        const b = W.get(S, c.id);
        if (!b || b.kind !== 'bld') return { ok: false };
        b.on = !b.on;
        UB.Eco.updatePower(S);
        return { ok: true };
      }
      case 'craft': {
        const b = W.get(S, c.id);
        if (!b) return { ok: false };
        return UB.Buildings.craft(S, b, c.item);
      }
      case 'equip': {
        const u = W.get(S, c.id);
        if (!u || u.kind !== 'unit') return { ok: false };
        return UB.Units.equip(S, u, c.weapon);
      }
      case 'hold': for (const u of us) UB.Units.order(S, u, { type: 'hold', x: u.x, y: u.y }); return { ok: true };
      case 'return': for (const u of us) UB.Units.order(S, u, { type: 'return' }); return { ok: true };
      case 'release': for (const u of us) UB.Units.order(S, u, null); return { ok: true };
      case 'evict': {
        const b = W.get(S, c.id);
        if (!b || b.kind !== 'bld') return { ok: false };
        for (const id of [...b.garrison, ...b.workers, ...b.patients]) { const u = W.get(S, id); if (u) UB.Units.order(S, u, null); }
        return { ok: true };
      }
      case 'squad': {
        const n = c.n;
        for (const k in S.squads) S.squads[k] = S.squads[k].filter((id) => !c.ids.includes(id));
        S.squads[n] = us.map((u) => u.id);
        for (const u of us) u.squad = n;
        return { ok: true };
      }
      case 'autoRepair': S.autoRepair = !!c.value; return { ok: true };
      case 'nightShift': {
        const b = W.get(S, c.id);
        if (!b || b.kind !== 'bld') return { ok: false };
        b.nightShift = !b.nightShift;
        return { ok: true };
      }
      case 'skipDay': return { ok: UB.Waves.skipToDusk(S) };
      default: return { ok: false, reason: 'Comando desconhecido' };
    }
  }

  // ---- save / load ------------------------------------------------------------------
  function serialize(S) {
    const out = {};
    for (const k in S) {
      if (k[0] === '_' || k === 'fx' || k === 'log' || k === 'rng' || k === 'map') continue;
      out[k] = S[k];
    }
    out.rngS = S.rng.s;
    out.map = { w: S.map.w, h: S.map.h };
    for (const k of ['terrain', 'feature', 'famt', 'explored']) out.map[k] = UB.U.packArray(S.map[k]);
    out.log = S.log.slice(-20);
    // Units point their "working" field at their order or task; store which one.
    return JSON.stringify(out, function (key, value) {
      if (key[0] === '_') return undefined; // render/interp caches on entities
      if (key === 'working') return value ? (value === this.order ? 'o' : value === this.task ? 't' : null) : null;
      return value;
    });
  }
  function deserialize(str) {
    const o = typeof str === 'string' ? JSON.parse(str) : str;
    if (!o || o.version !== VERSION) throw new Error('Save incompatível com esta versão.');
    const S = o;
    const m = o.map;
    S.map = { w: m.w, h: m.h };
    for (const k of ['terrain', 'feature', 'famt', 'explored']) S.map[k] = UB.U.unpackArray(m[k]);
    S.rng = new UB.Rng(1);
    S.rng.s = o.rngS >>> 0;
    delete S.rngS;
    S.fx = [];
    S.log = o.log || [];
    for (const u of S.units) u.working = u.working === 'o' ? u.order : u.working === 't' ? u.task : null;
    W.rebuild(S);
    initTransient(S);
    UB.Buildings.computeLights(S);
    UB.Eco.updatePower(S);
    UB.Path.updateFlow(S, true);
    UB.Explore.vision(S);
    return S;
  }

  UB.Game = { VERSION, newGame, tick, command, serialize, deserialize, score, msg, fx, formation, initTransient };
})(globalThis.UB = globalThis.UB || {});
