// Survivors: creation, contextual orders, autonomous behaviour (target selection, combat,
// building, repairing, garrisoning towers), gathering, looting, buildings they work in,
// healing and infection.
(function (UB) {
  'use strict';
  const { ROLES, WEAPONS, RANKS, BUILDINGS, FEATURE, F, BAL, POIS, FIRST_NAMES, LAST_NAMES } = UB.DEF;
  const W = UB.World;
  const THINK = 3;

  const facingOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3);

  function makeName(S) {
    const used = new Set(S.units.map((u) => u.name));
    for (let t = 0; t < 30; t++) {
      const n = `${S.rng.pick(FIRST_NAMES)} ${S.rng.pick(LAST_NAMES)}`;
      if (!used.has(n)) return n;
    }
    return `${S.rng.pick(FIRST_NAMES)} ${S.units.length + 1}`;
  }

  function create(S, role, x, y, opts) {
    opts = opts || {};
    const R = ROLES[role];
    const weapon = opts.weapon || R.weapon;
    const id = W.nextId(S);
    const u = {
      id, kind: 'unit', name: opts.name || makeName(S), role, weapon,
      x, y, hp: R.hp, maxHp: R.hp, ammo: WEAPONS[weapon].melee ? 0 : BAL.pocketAmmo,
      xp: 0, rank: 0, kills: 0, facing: 1, order: null, path: null, pathI: 0, destKey: null,
      target: 0, cd: 0, carry: null, pack: {}, inside: 0, insideRole: '', hidden: false,
      infected: -1, starving: 0, busyT: 0, task: null, taskT: 0, autoG: false, squad: 0,
      think: id % THINK, dead: false, moving: false, shootT: -9, hitT: -9, joined: S.day,
    };
    S.units.push(u);
    W.register(S, u);
    return u;
  }

  // ---- helpers ----------------------------------------------------------------------
  const weaponOf = (u) => (u.ammo > 0 || WEAPONS[u.weapon].melee ? WEAPONS[u.weapon] : WEAPONS.bat);
  const ranged = (u) => !weaponOf(u).melee;
  function packTotal(u) { let t = 0; for (const k in u.pack) t += u.pack[k]; return t; }
  function rectOf(e) { return { x0: e.tx, y0: e.ty, x1: e.tx + e.w - 1, y1: e.ty + e.h - 1 }; }
  function distToRect(x, y, r) {
    const dx = x < r.x0 ? r.x0 - x : x > r.x1 + 1 ? x - (r.x1 + 1) : 0;
    const dy = y < r.y0 ? r.y0 - y : y > r.y1 + 1 ? y - (r.y1 + 1) : 0;
    return Math.hypot(dx, dy);
  }
  function inCover(S, u) {
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (W.inb(S, tx + dx, ty + dy) && S._struct[W.idx(S, tx + dx, ty + dy)]) return true;
    }
    return false;
  }
  function speedOf(S, u) {
    let s = ROLES[u.role].speed;
    if (u.starving) s *= 0.75;
    if (u.infected >= 0) s *= 0.9;
    const i = W.idx(S, Math.floor(u.x), Math.floor(u.y));
    return s / W.costU(S, i) || s;
  }
  function checkRank(S, u) {
    while (u.rank < RANKS.length - 1 && u.xp >= RANKS[u.rank + 1].xp) {
      u.rank++;
      const gain = RANKS[u.rank].hp - RANKS[u.rank - 1].hp;
      u.maxHp += gain; u.hp += gain;
      UB.Game.msg(S, 'msg.promoted', { name: u.name, r: u.rank }, 'good', u.x, u.y);
    }
  }

  // ---- path following -----------------------------------------------------------------
  // Requests a path only when the destination changes; the queue serves it within a tick or two.
  function goTo(S, u, goal) {
    const key = goal.rect ? `r${goal.rect.x0},${goal.rect.y0},${goal.rect.x1},${goal.rect.y1}` : `${Math.floor(goal.x)},${Math.floor(goal.y)},${goal.range || 0}`;
    if (u.destKey === key) {
      if (u.pathFail || u.pathQueued) return;
      if (u.path && u.pathI < u.path.length) return;
      // The path ended short of the goal (partial path): retry a couple of times, then give up.
      if ((u.retry = (u.retry || 0) + 1) > 2) { u.pathFail = true; return; }
    } else u.retry = 0;
    u.destKey = key;
    u.path = null;
    u.pathFail = false;
    UB.Path.request(S, u, Object.assign({ limit: 9000, partial: true }, goal));
  }
  function stop(u) { u.path = null; u.destKey = null; u.pathFail = false; }
  const pathDone = (u) => !u.path || u.pathI >= u.path.length;

  function step(S, u, dt) {
    u.moving = false;
    if (!u.path || u.pathI >= u.path.length) return;
    const N = S.map.w;
    const i = u.path[u.pathI];
    if (S._blockU[i]) { u.destKey = null; u.path = null; return; }
    const tx = (i % N) + 0.5, ty = ((i / N) | 0) + 0.5;
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    const sp = speedOf(S, u) * dt;
    if (d <= sp) { u.x = tx; u.y = ty; u.pathI++; }
    else { u.x += (dx / d) * sp; u.y += (dy / d) * sp; }
    u.moving = true;
    if (S.time - u.shootT > 0.4) u.facing = facingOf(dx, dy);
  }
  // Skip waypoints that can be reached in a straight line (smoother diagonal walking).
  function smooth(S, u) {
    if (!u.path) return;
    const N = S.map.w;
    for (let k = 0; k < 2 && u.pathI + 1 < u.path.length; k++) {
      const j = u.path[u.pathI + 1];
      if (UB.Path.lineClear(S, u.x, u.y, (j % N) + 0.5, ((j / N) | 0) + 0.5, false)) u.pathI++;
      else break;
    }
  }

  // ---- buildings ----------------------------------------------------------------------
  function enterBuilding(S, u, b, role) {
    const list = role === 'garrison' ? b.garrison : role === 'patient' ? b.patients : b.workers;
    if (list.length >= UB.Buildings.slots(b)) return false;
    deposit(S, u);
    list.push(u.id);
    u.inside = b.id; u.insideRole = role; u.hidden = true;
    u.x = b.tx + b.w / 2; u.y = b.ty + b.h / 2;
    stop(u);
    u.target = 0;
    return true;
  }
  function leaveBuilding(S, u) {
    if (!u.inside) return;
    const b = W.get(S, u.inside);
    if (b) {
      b.garrison = b.garrison.filter((id) => id !== u.id);
      b.workers = b.workers.filter((id) => id !== u.id);
      b.patients = b.patients.filter((id) => id !== u.id);
      const p = W.nearestOpen(S, b.tx + b.w / 2, b.ty + b.h, false, Math.max(b.w, b.h) + 3);
      if (p) { u.x = p.x + 0.5; u.y = p.y + 0.5; }
    }
    u.inside = 0; u.insideRole = ''; u.hidden = false; u.autoG = false;
  }
  function nearestBuilding(S, u, pred) {
    let best = null, bd = Infinity;
    for (const b of S.buildings) {
      if (b.dead || !pred(b)) continue;
      const d = UB.U.dist2(u.x, u.y, b.tx + b.w / 2, b.ty + b.h / 2);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  const isStorage = (b) => b.built >= 1 && (b.type === 'hq' || b.type === 'depot');
  function deposit(S, u) {
    if (u.carry) { UB.Eco.add(S, u.carry.res, u.carry.amt); u.carry = null; }
    let got = 0;
    for (const k in u.pack) { got += u.pack[k]; UB.Eco.add(S, k, u.pack[k]); }
    if (got) UB.Game.fx(S, { t: 'deposit', x: u.x, y: u.y });
    u.pack = {};
  }

  // ---- orders ---------------------------------------------------------------------------
  // Gives an order; leaving buildings when the order needs the survivor outside.
  function order(S, u, o) {
    if (u.dead) return;
    if (u.inside && !(o && (o.type === 'garrison' || o.type === 'work' || o.type === 'patient') && o.id === u.inside)) leaveBuilding(S, u);
    u.order = o;
    u.task = null;
    u.target = 0;
    u.busyT = 0;
    u.lootP = 0;
    u.searching = false;
    u.working = null;
    u.autoG = false;
    stop(u);
  }

  // ---- targeting --------------------------------------------------------------------------
  function findTarget(S, u, radius) {
    const cur = u.target ? W.get(S, u.target) : null;
    if (cur && !cur.dead && cur.kind === 'zom' && UB.U.dist(u.x, u.y, cur.x, cur.y) <= radius) return cur;
    let best = null, bd = Infinity;
    S._zgrid.query(u.x, u.y, radius, (z, d2) => {
      if (z.dead) return false;
      // Prefer zombies that are attacking someone or something.
      const score = d2 * (z.state === 'chase' || z.state === 'attackS' ? 0.6 : 1);
      if (score < bd) { bd = score; best = z; }
      return false;
    });
    return best;
  }
  function tryAttack(S, u, t, moving) {
    if (!t || t.dead || u.cd > 0) return false;
    const w = weaponOf(u);
    const tx = t.kind === 'poi' ? t.tx + t.w / 2 : t.x, ty = t.kind === 'poi' ? t.ty + t.h / 2 : t.y;
    const reach = t.kind === 'poi' ? w.range + Math.max(t.w, t.h) / 2 : w.range;
    if (UB.U.dist(u.x, u.y, tx, ty) > reach + 0.1) return false;
    return UB.Combat.attack(S, u, t, moving);
  }
  // Engage: stand and shoot when in range, close in otherwise (bounded by a leash).
  function fight(S, u, t, leashX, leashY, leash) {
    const w = weaponOf(u);
    const reach = w.range;
    const d = UB.U.dist(u.x, u.y, t.x, t.y);
    u.target = t.id;
    if (d <= reach) { stop(u); return; }
    if (leash && UB.U.dist(t.x, t.y, leashX, leashY) > leash) { u.target = 0; return; }
    goTo(S, u, { x: t.x, y: t.y, range: Math.max(0.9, reach - 0.5), limit: 1500 });
  }

  // ---- autonomous base work -------------------------------------------------------------------
  function busyOn(S, type, id, except) {
    let n = 0;
    for (const o of S.units) if (o !== except && !o.dead && ((o.task && o.task.type === type && o.task.id === id) || (o.order && o.order.type === type && o.order.id === id))) n++;
    return n;
  }
  function autoTask(S, u) {
    const night = UB.Waves.isNight(S);
    if ((u.infected >= 0 || u.hp < u.maxHp * 0.45) && !u.starving) {
      const inf = nearestBuilding(S, u, (b) => b.built >= 1 && b.type === 'infirmary' && b.patients.length < UB.Buildings.slots(b));
      if (inf) return { type: 'patient', id: inf.id };
    }
    if (night && ranged(u)) {
      const free = (b) => b.garrison.length + busyOn(S, 'garrison', b.id, u) < UB.Buildings.slots(b);
      const t = nearestBuilding(S, u, (b) => b.built >= 1 && b.type === 'tower' && free(b)) || nearestBuilding(S, u, (b) => b.type === 'hq' && free(b));
      if (t) return { type: 'garrison', id: t.id, auto: true };
    }
    const bp = nearestBuilding(S, u, (b) => b.built < 1 && busyOn(S, 'build', b.id, u) < (b.w > 1 ? 3 : 2));
    if (bp) return { type: 'build', id: bp.id };
    if (S.autoRepair) {
      const dmg = nearestBuilding(S, u, (b) => b.built >= 1 && b.hp < b.maxHp * (b.type === 'hq' ? 0.95 : 0.7) && W.inTerritory(S, b.tx, b.ty) && busyOn(S, 'repair', b.id, u) < (b.type === 'hq' ? 2 : 1));
      if (dmg && (dmg.type === 'hq' || UB.Eco.can(S, { wood: 1 }))) return { type: 'repair', id: dmg.id };
    }
    return null;
  }

  // ---- per-order behaviour ------------------------------------------------------------------
  function think(S, u) {
    u.working = null;
    smooth(S, u);
    // Medics heal and treat bites around them.
    if (u.role === 'medic') medic(S, u);
    // Resupply ammunition from the stockpile while inside the territory.
    if (!WEAPONS[u.weapon].melee && u.ammo < BAL.pocketAmmo && S.res.ammo > 0 && W.inTerritory(S, u.x, u.y)) {
      const take = Math.min(BAL.pocketAmmo - u.ammo, 3, S.res.ammo);
      u.ammo += take; S.res.ammo -= take;
    }
    const o = u.order;
    if (!o) return thinkAuto(S, u);
    switch (o.type) {
      case 'move': case 'return': {
        // Run and gun: shoot what is in range without stopping.
        const t = ranged(u) ? findTarget(S, u, weaponOf(u).range) : null;
        u.target = t ? t.id : 0;
        if (o.type === 'return') {
          const hq = W.hq(S);
          if (!hq) { u.order = null; return; }
          if (distToRect(u.x, u.y, rectOf(hq)) < 2.2) { deposit(S, u); u.order = null; stop(u); return; }
          goTo(S, u, { rect: rectOf(hq) });
          return;
        }
        goTo(S, u, { x: o.x, y: o.y });
        if (u.pathFail || (pathDone(u) && !u.pathQueued && u.path)) {
          if (u.pathFail && UB.U.dist(u.x, u.y, o.x, o.y) > 1.5) UB.Game.msg(S, 'msg.cantReach', { name: u.name }, 'warn', u.x, u.y);
          u.order = { type: 'hold', x: u.x, y: u.y };
          stop(u);
        }
        return;
      }
      case 'amove': {
        const t = findTarget(S, u, ranged(u) ? weaponOf(u).range + 0.5 : 4);
        if (t) { fight(S, u, t, u.x, u.y, 0); return; }
        u.target = 0;
        goTo(S, u, { x: o.x, y: o.y });
        if (u.pathFail || (pathDone(u) && !u.pathQueued && u.path)) { u.order = { type: 'hold', x: u.x, y: u.y }; stop(u); }
        return;
      }
      case 'hold': {
        const t = findTarget(S, u, ranged(u) ? weaponOf(u).range : 3);
        if (t) { fight(S, u, t, o.x, o.y, ranged(u) ? 0 : 4); return; }
        u.target = 0;
        if (UB.U.dist(u.x, u.y, o.x, o.y) > 1.2) goTo(S, u, { x: o.x, y: o.y });
        return;
      }
      case 'attack': {
        const t = W.get(S, o.id);
        if (!t || t.dead) { u.order = { type: 'hold', x: u.x, y: u.y }; u.target = 0; return; }
        u.target = t.id;
        if (t.kind === 'poi') {
          const reach = weaponOf(u).range + Math.max(t.w, t.h) / 2;
          if (UB.U.dist(u.x, u.y, t.tx + t.w / 2, t.ty + t.h / 2) <= reach) { stop(u); return; }
          goTo(S, u, { rect: rectOf(t) });
          return;
        }
        if (UB.U.dist(u.x, u.y, t.x, t.y) <= weaponOf(u).range) { stop(u); return; }
        goTo(S, u, { x: t.x, y: t.y, range: Math.max(0.9, weaponOf(u).range - 0.5), limit: 3000 });
        return;
      }
      case 'gather': return thinkGather(S, u, o);
      case 'loot': return thinkLoot(S, u, o);
      case 'garrison': case 'work': case 'patient': return thinkEnter(S, u, o, false);
      case 'build': case 'repair': return thinkBuild(S, u, o, false);
      default: u.order = null;
    }
  }

  function thinkAuto(S, u) {
    const hq = W.hq(S);
    const home = W.inTerritory(S, u.x, u.y);
    // Defend: engage zombies nearby (ranged units within range+2, melee within 4).
    const t = findTarget(S, u, ranged(u) ? weaponOf(u).range + 2 : 4);
    if (t && (!home || !hq || UB.U.dist(t.x, t.y, hq.tx + 1.5, hq.ty + 1.5) < UB.World.territory(S) + 4)) {
      fight(S, u, t, u.x, u.y, 0);
      return;
    }
    u.target = 0;
    if (!home) {
      // Outside the base with nothing to do: hold position.
      u.order = { type: 'hold', x: u.x, y: u.y };
      return;
    }
    if (u.task) {
      const tk = u.task;
      if (tk.type === 'build' || tk.type === 'repair') { if (thinkBuild(S, u, tk, true)) return; }
      else if (tk.type === 'garrison' || tk.type === 'patient') { if (thinkEnter(S, u, tk, true)) return; }
      else if (tk.type === 'idle') {
        if (pathDone(u) && !u.pathQueued) u.task = null;
        else { goTo(S, u, { x: tk.x, y: tk.y }); return; }
      }
      u.task = null;
    }
    if (S.tick < u.taskT) return;
    u.taskT = S.tick + 20;
    if (packTotal(u) || u.carry) {
      if (hq && distToRect(u.x, u.y, rectOf(hq)) > 2.2) { goTo(S, u, { rect: rectOf(hq) }); return; }
      deposit(S, u);
    }
    u.task = autoTask(S, u);
    if (!u.task && hq) {
      const d = UB.U.dist(u.x, u.y, hq.tx + 1.5, hq.ty + 1.5);
      if (d > 6 || S.rng.chance(0.08)) {
        const a = S.rng.range(0, Math.PI * 2), r = S.rng.range(2.6, 5);
        const p = W.nearestOpen(S, hq.tx + 1.5 + Math.cos(a) * r, hq.ty + 1.5 + Math.sin(a) * r, false, 3);
        if (p) { u.task = { type: 'idle', x: p.x + 0.5, y: p.y + 0.5 }; goTo(S, u, { x: p.x + 0.5, y: p.y + 0.5 }); }
      }
    }
  }

  // Returns true while the task is still in progress.
  function thinkBuild(S, u, o, isTask) {
    const b = W.get(S, o.id);
    const finished = !b || b.dead || (o.type === 'build' ? b.built >= 1 : b.hp >= b.maxHp);
    if (finished) { if (!isTask) u.order = null; return false; }
    if (!isTask) {
      const t = findTarget(S, u, 2.5);
      if (t) { fight(S, u, t, u.x, u.y, 3); return true; }
    }
    u.target = 0;
    if (distToRect(u.x, u.y, rectOf(b)) <= 1.6) { stop(u); u.working = o; return true; }
    goTo(S, u, { rect: rectOf(b) });
    if (u.pathFail) { if (!isTask) { UB.Game.msg(S, 'msg.noAccessSite', { name: u.name }, 'warn', u.x, u.y); u.order = null; } return false; }
    return true;
  }

  function thinkEnter(S, u, o, isTask) {
    const b = W.get(S, o.id);
    const role = o.type;
    if (!b || b.dead || b.built < 1) { if (!isTask) u.order = null; return false; }
    if (u.inside === b.id) return true;
    if (distToRect(u.x, u.y, rectOf(b)) <= 1.6) {
      if (enterBuilding(S, u, b, role)) {
        u.autoG = !!o.auto;
        if (isTask) u.task = null;
        else u.order = null;
        return true;
      }
      if (!isTask) { UB.Game.msg(S, 'msg.noSlots', { b: b.type }, 'warn', u.x, u.y); u.order = { type: 'hold', x: u.x, y: u.y }; }
      return false;
    }
    goTo(S, u, { rect: rectOf(b) });
    if (u.pathFail) { if (!isTask) u.order = null; return false; }
    return true;
  }

  function thinkGather(S, u, o) {
    const N = S.map.w;
    if (o.phase === 'deposit') {
      const st = nearestBuilding(S, u, isStorage);
      if (!st) { u.order = null; return; }
      if (distToRect(u.x, u.y, rectOf(st)) <= 1.8) {
        deposit(S, u);
        if (o.finish) { u.order = null; return; }
        o.phase = 'go';
        stop(u);
      } else { goTo(S, u, { rect: rectOf(st) }); return; }
    }
    const t = findTarget(S, u, ranged(u) ? weaponOf(u).range : 2.5);
    if (t) { fight(S, u, t, u.x, u.y, 4); return; }
    u.target = 0;
    let i = o.y * N + o.x;
    const f = FEATURE[S.map.feature[i]];
    if (f && f.pickup) {
      if (Math.floor(u.x) === o.x && Math.floor(u.y) === o.y) { UB.Explore.pickupCrate(S, u, i); u.order = { type: 'return' }; return; }
      goTo(S, u, { x: o.x + 0.5, y: o.y + 0.5 });
      if (u.pathFail) u.order = null;
      return;
    }
    if (!f || f.res !== o.res || !S.map.famt[i]) {
      const next = findNode(S, o.x, o.y, o.res, 8);
      if (next < 0) {
        if (u.carry || packTotal(u)) { o.phase = 'deposit'; o.finish = true; return; }
        u.order = null; return;
      }
      o.x = next % N; o.y = (next / N) | 0; i = next;
      stop(u);
    }
    const rect = { x0: o.x, y0: o.y, x1: o.x, y1: o.y };
    if (distToRect(u.x, u.y, rect) <= 1.5) { stop(u); u.working = o; return; }
    goTo(S, u, { rect });
    if (u.pathFail) { u.order = null; UB.Game.msg(S, 'msg.cantReachRes', { name: u.name }, 'warn', u.x, u.y); }
  }
  function findNode(S, x, y, res, r) {
    const N = S.map.w;
    let best = -1, bd = Infinity;
    for (let yy = Math.max(0, y - r); yy <= Math.min(N - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(N - 1, x + r); xx++) {
      const i = yy * N + xx;
      const f = FEATURE[S.map.feature[i]];
      if (!f || f.res !== res || !S.map.famt[i] || !S.map.explored[i]) continue;
      const d = (xx - x) ** 2 + (yy - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function thinkLoot(S, u, o) {
    const p = W.get(S, o.id);
    if (!p || p.dead || p.searchesLeft <= 0) {
      if (packTotal(u)) u.order = { type: 'return' };
      else u.order = { type: 'hold', x: u.x, y: u.y };
      u.searching = false;
      return;
    }
    const t = findTarget(S, u, ranged(u) ? weaponOf(u).range : 2.5);
    if (t) { u.searching = false; fight(S, u, t, p.ex + 0.5, p.ey + 0.5, 6); return; }
    u.target = 0;
    if (UB.U.dist(u.x, u.y, p.ex + 0.5, p.ey + 0.5) <= 1.3) { stop(u); u.searching = true; u.working = o; return; }
    u.searching = false;
    goTo(S, u, { x: p.ex + 0.5, y: p.ey + 0.5, range: 1 });
    if (u.pathFail) { u.order = null; UB.Game.msg(S, 'msg.noEntrance', { name: u.name }, 'warn', u.x, u.y); }
  }

  function medic(S, u) {
    if (u.inside) return;
    const heal = ROLES.medic.heal * THINK * UB.DEF.TIME.TICK;
    S._ugrid.query(u.x, u.y, 3, (a) => {
      if (a.dead) return false;
      if (a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + heal);
      if (a.infected >= 0 && UB.U.dist(a.x, a.y, u.x, u.y) < 2.2) {
        const home = W.inTerritory(S, u.x, u.y);
        if (home && S.res.meds >= 1) S.res.meds -= 1;
        else if (u.pack.meds >= 1) u.pack.meds -= 1;
        else return false;
        a.infected = -1;
        UB.Game.msg(S, a === u ? 'msg.treatedSelf' : 'msg.treatedOther', { name: u.name, other: a.name }, 'good', a.x, a.y);
      }
      return false;
    });
  }

  // Timed work done every tick next to a target (building, repairing, gathering, searching).
  function work(S, u, dt) {
    const o = u.working;
    if (!o || u.target) return;
    const R = ROLES[u.role];
    const mm = UB.Eco.moraleMul(S);
    if (o.type === 'build') {
      const b = W.get(S, o.id);
      if (b && !b.dead) { UB.Buildings.addBuild(S, b, BAL.buildRate * R.build * mm * dt); u.workT = S.time; u.facing = facingOf(b.tx + b.w / 2 - u.x, b.ty + b.h / 2 - u.y); }
    } else if (o.type === 'repair') {
      const b = W.get(S, o.id);
      if (b && !b.dead) {
        u.workT = S.time;
        u.facing = facingOf(b.tx + b.w / 2 - u.x, b.ty + b.h / 2 - u.y);
        if (!UB.Buildings.repair(S, b, BAL.repairRate * R.build * mm * dt)) {
          if (S.tick - (S._repMsgT || -9999) > 300) { S._repMsgT = S.tick; UB.Game.msg(S, 'msg.noRepairRes', null, 'warn', b.tx, b.ty); }
          if (u.order === o) u.order = null;
          if (u.task === o) u.task = null;
        }
      }
    } else if (o.type === 'gather') {
      const N = S.map.w, i = o.y * N + o.x;
      const f = FEATURE[S.map.feature[i]];
      if (!f || !S.map.famt[i]) return;
      u.workT = S.time;
      u.facing = facingOf(o.x + 0.5 - u.x, o.y + 0.5 - u.y);
      if (u.carry && u.carry.res !== f.res) { o.phase = 'deposit'; return; }
      u.busyT += dt * f.rate * R.gather * mm;
      while (u.busyT >= 1) {
        u.busyT -= 1;
        u.carry = u.carry || { res: f.res, amt: 0 };
        u.carry.amt++;
        S.map.famt[i]--;
        if (S.map.famt[i] <= 0) {
          if (f.bonus) { const amt = S.rng.int(f.bonus[1], f.bonus[2]); u.pack[f.bonus[0]] = (u.pack[f.bonus[0]] || 0) + amt; }
          UB.Game.fx(S, { t: 'fell', x: o.x + 0.5, y: o.y + 0.5, f: S.map.feature[i] });
          W.setFeature(S, o.x, o.y, F.NONE, 0);
          break;
        }
        if (u.carry.amt >= BAL.carryCap) { o.phase = 'deposit'; break; }
      }
    } else if (o.type === 'loot') {
      const p = W.get(S, o.id);
      if (!p || p.searchesLeft <= 0) return;
      u.workT = S.time;
      u.busyT += dt * R.loot * mm;
      u.lootP = u.busyT / POIS[p.type].time;
      if (u.busyT >= POIS[p.type].time) {
        u.busyT = 0; u.lootP = 0;
        UB.Explore.searchComplete(S, p, u);
        if (packTotal(u) >= BAL.backpackCap) { u.order = { type: 'return' }; u.searching = false; UB.Game.msg(S, 'msg.packFull', { name: u.name }, 'info', u.x, u.y); }
      }
    }
  }

  function tickInside(S, u, dt) {
    const b = W.get(S, u.inside);
    if (!b || b.dead) { leaveBuilding(S, u); return; }
    if (u.insideRole === 'garrison') {
      if (u.autoG && !UB.Waves.isNight(S) && S.clock.phase === 'day' && S.clock.t > 5) { leaveBuilding(S, u); u.order = null; return; }
      if (!WEAPONS[u.weapon].melee && u.ammo < BAL.pocketAmmo && S.res.ammo > 0 && (S.tick + u.think) % THINK === 0) {
        const take = Math.min(BAL.pocketAmmo - u.ammo, 2, S.res.ammo);
        u.ammo += take; S.res.ammo -= take;
      }
      if (!ranged(u)) return;
      const range = weaponOf(u).range + UB.Buildings.lvl(b).range;
      if ((S.tick + u.think) % THINK === 0) {
        const t = findTarget(S, u, range);
        u.target = t ? t.id : 0;
      }
      const t = u.target ? W.get(S, u.target) : null;
      if (t && !t.dead && u.cd <= 0 && UB.U.dist(u.x, u.y, t.x, t.y) <= range) {
        // Shoot from the platform: temporarily extend the weapon's reach.
        UB.Combat.attack(S, u, t, false);
      }
    } else if (u.insideRole === 'patient') {
      if (u.hp >= u.maxHp && u.infected < 0) { leaveBuilding(S, u); u.order = null; }
    }
  }

  function tick(S, dt) {
    for (const u of S.units) {
      if (u.dead) continue;
      u.cd -= dt;
      if (u.infected >= 0) {
        u.infected -= dt;
        if (u.infected <= 0) { u.infected = 0; UB.Combat.killUnit(S, u, { k: 'cause.infection' }); continue; }
      }
      if (u.starving && u.hp > u.maxHp * 0.75) u.hp = u.maxHp * 0.75;
      if (u.inside) { tickInside(S, u, dt); continue; }
      if ((S.tick + u.think) % THINK === 0) think(S, u);
      if (u.dead) continue;
      const t = u.target ? W.get(S, u.target) : null;
      if (t && !t.dead) tryAttack(S, u, t, u.moving);
      else if (t) u.target = 0;
      work(S, u, dt);
      step(S, u, dt);
    }
  }

  function equip(S, u, weapon) {
    if (u.weapon === weapon) return { ok: false, reason: 'reason.alreadyEquipped' };
    if (weapon !== 'pistol' && weapon !== 'bat' && !(S.armory[weapon] > 0)) return { ok: false, reason: 'reason.noWeapon' };
    if (weapon !== 'pistol' && weapon !== 'bat') S.armory[weapon]--;
    if (u.weapon === 'shotgun' || u.weapon === 'rifle') S.armory[u.weapon] = (S.armory[u.weapon] || 0) + 1;
    u.weapon = weapon;
    if (WEAPONS[weapon].melee) { S.res.ammo += u.ammo; u.ammo = 0; }
    return { ok: true };
  }

  UB.Units = { create, order, tick, facingOf, checkRank, inCover, leaveBuilding, enterBuilding, deposit, packTotal, rectOf, distToRect, equip, weaponOf, findNode, THINK };
})(globalThis.UB = globalThis.UB || {});
