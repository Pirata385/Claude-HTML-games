// One fight on one floor: fighters, power objects, telegraphs, damage rules,
// falls, KOs and the end condition. Pure logic; renderers and audio listen to
// `battle.events`.
(function (XS) {
  'use strict';

  const SUDDEN_DEATH_AT = 100; // seconds; the arena then starts crumbling from the rim

  class Battle {
    // spec: { arena, seed, floor, fighters: [{ genome, powers, team, isPlayer, hpMult, hp, dmgMult, sizeMult, name }] }
    constructor(spec) {
      this.arena = spec.arena;
      this.world = spec.arena.world;
      this.floor = spec.floor || 1;
      this.rng = new XS.RNG(XS.hash(spec.seed || 1, this.floor, 'battle'));
      this.events = new XS.Emitter();
      this.time = 0;
      this.objects = [];
      this.telegraphs = [];
      this.scheduled = [];
      this.over = false;
      this.endT = 0;
      this.winnerTeam = null;
      this.hitstop = 0;
      this.suddenDeath = false;
      this.crumbleT = 0;
      this.crumbleR = 0;
      this.elementMats = {};
      this.fighters = spec.fighters.map((o, i) => {
        const s = this.arena.spawns[i % this.arena.spawns.length];
        const c = this.arena.center;
        return new XS.Fighter(Object.assign({ id: i, x: s.x, y: s.y, z: s.z, facing: Math.atan2(c.y - s.y, c.x - s.x) }, o));
      });
      const basicScale = 1 + 0.05 * (this.floor - 1);
      for (const f of this.fighters) f.basic.def.damage = Math.round(f.basic.def.damage * basicScale);
      this.world.events.on('break', (e) => { if (e.source && e.source.stats) e.source.stats.voxels++; });
      this.world.events.on('blast', (e) => this.events.emit('explosion', { x: e.x, y: e.y, z: e.z, r: e.r, ramp: ['#5a1a08', '#e0601a', '#ffb040', '#fff0b0'], terrain: true, el: 'plasma' }));
    }

    get player() { return this.fighters.find((f) => f.isPlayer) || null; }
    alive() { return this.fighters.filter((f) => f.alive); }
    enemiesOf(f) { return this.fighters.filter((e) => e.alive && e.team !== f.team); }
    turrets() { return this.objects.filter((o) => o.kind === 'turret'); }

    nearestEnemy(f, x = f.x, y = f.y, maxDist = Infinity, exclude = null) {
      let best = null, bd = maxDist;
      for (const e of this.fighters) {
        if (!e.alive || e.team === f.team || (exclude && exclude.has(e.id))) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    schedule(delay, fn) { this.scheduled.push({ t: this.time + delay, fn }); }

    telegraph(t) {
      t.age = 0;
      this.telegraphs.push(t);
      return t;
    }

    // Temporary voxel material for a given element (walls, crystals).
    elementMat(el) {
      if (!this.elementMats[el]) {
        const E = XS.Power.ELEMENTS[el] || XS.Power.ELEMENTS.crystal;
        this.elementMats[el] = this.world.addMaterial({ kind: 'summoned', color: E.ramp[2], key: 'el-' + el });
      }
      return this.elementMats[el];
    }

    // ------------------------------------------------------------- damage
    // opts: { src, def, kx, ky, kb, element, dot, tag, noKnock, ignoreInv, mult }
    damage(target, amount, opts = {}) {
      if (!target.alive) return 0;
      if (target.inv > 0 && !opts.dot && !opts.ignoreInv) return 0;
      const src = opts.src && opts.src.alive !== undefined ? opts.src : null;
      let amt = amount * XS.Status.damageTakenMult(target) * (src ? src.dmgMult * XS.Status.damageDealtMult(src) : 1) * (opts.mult || 1);
      if (target.st.shield > 0 && !opts.ignoreInv) {
        const absorbed = Math.min(target.st.shield, amt);
        target.st.shield -= absorbed;
        amt -= absorbed;
      }
      amt = Math.max(0, amt);
      const dealt = Math.min(amt, Math.max(0, target.hp)); // overkill doesn't count
      target.hp -= amt;
      target.stats.taken += dealt;
      if (src && src !== target) {
        src.stats.dmg += dealt;
        target.lastHitBy = src;
        target.lastHitT = this.time;
      }
      const def = opts.def;
      // Knockback.
      if (opts.kb && !opts.noKnock) {
        const l = Math.hypot(opts.kx || 0, opts.ky || 0) || 1;
        const stagger = def && def.status && def.status.includes('stagger') ? 1.8 : 1;
        const k = (opts.kb * stagger * target.g.stats.knockTaken * (target.st.heavy > 0 ? 0.6 : 1)) / target.mass;
        target.kx += ((opts.kx || 0) / l) * k * 1.8;
        target.ky += ((opts.ky || 0) / l) * k * 1.8;
        if (k > 6 && target.grounded) { target.vz = Math.min(6, k * 0.35); target.grounded = false; }
      }
      // Statuses and life steal.
      if (def && def.status && !opts.dot) for (const s of def.status) XS.Status.apply(this, target, s, amount, src);
      if (src && amt > 0 && !opts.dot) {
        let steal = 0;
        if (def && def.mods && def.mods.includes('vampiric')) steal += 0.3;
        if (src.st.lifesteal > 0) steal += 0.3;
        if (steal) this.heal(src, amt * steal);
      }
      if (target.rig && amt > 0 && !opts.dot) target.rig.hurt(opts.kx || 0, opts.ky || 0);
      this.events.emit('hit', { target, amount: amt, src, def, dot: !!opts.dot, tag: opts.tag, x: target.x, y: target.y, z: target.z + target.height * 0.6 });
      if (amt >= 14 && !opts.dot) this.hitstop = Math.max(this.hitstop, Math.min(0.09, 0.03 + amt / 600));
      if (target.hp <= 0) this.ko(target, src || (this.time - target.lastHitT < 6 ? target.lastHitBy : null));
      // The Guardian's fury phase.
      if (target.guardian && !target.enraged && target.hp < target.maxHp * 0.5 && target.alive) {
        target.enraged = true;
        target.dmgMult *= 1.25;
        this.events.emit('enrage', { f: target });
      }
      return amt;
    }

    heal(f, amt, quiet) {
      if (!f.alive || amt <= 0) return;
      const before = f.hp;
      f.hp = Math.min(f.maxHp, f.hp + amt);
      if (!quiet && f.hp - before >= 1) this.events.emit('heal', { f, amount: f.hp - before });
    }

    ko(f, by) {
      if (!f.alive) return;
      f.alive = false;
      f.hp = 0;
      f.koTime = this.time;
      if (by && by !== f) by.stats.kos++;
      f.dash = null; f.forced = null; f.aura = null;
      this.events.emit('ko', { f, by });
    }

    onFall(f) {
      if (!f.alive) return;
      f.stats.falls++;
      const by = this.time - f.lastHitT < 6 ? f.lastHitBy : null;
      this.events.emit('fall', { f });
      this.damage(f, f.maxHp * (f.g.trait === 'elastico' ? 0.1 : 0.2), { src: by, ignoreInv: true, noKnock: true, tag: 'fall' });
      if (!f.alive) return;
      const s = this.world.findSafeSpot(f.lastSafe.x, f.lastSafe.y, 4, this.rng);
      f.x = s.x; f.y = s.y; f.z = s.z + 2;
      f.vx = f.vy = f.vz = f.kx = f.ky = 0;
      f.dash = null; f.forced = null; f.dodge.t = 0;
      f.inv = 1.5;
      this.events.emit('respawn', { f });
    }

    // Area blast with falloff, knockback and terrain damage.
    explosion(x, y, z, r, dmg, src, def, opts = {}) {
      const hit = [];
      for (const e of this.fighters) {
        if (!e.alive || (src && e.team === src.team) || (opts.exclude && opts.exclude === e)) continue;
        const dz = z - (e.z + e.height * 0.5);
        const d = Math.hypot(e.x - x, e.y - y, dz * 0.5);
        if (d > r + e.radius) continue;
        const fall = 1 - 0.4 * Math.min(1, Math.max(0, d - e.radius) / r);
        this.damage(e, dmg * fall, { src, def, kx: e.x - x, ky: e.y - y, kb: (def ? def.knock : 4) * (opts.kbMult || 1), tag: opts.tag });
        hit.push(e);
      }
      for (const t of this.turrets()) {
        if (src && t.owner.team === src.team) continue;
        if (Math.hypot(t.x - x, t.y - y) < r + 0.5) t.hp -= dmg;
      }
      if (opts.terrain !== 0) this.world.damageSphere(x, y, opts.terrainZ != null ? opts.terrainZ : z, opts.terrainR || r * 0.85, opts.terrain != null ? opts.terrain : (def ? def.terrain : 1) * 1.4, src);
      this.events.emit('explosion', { x, y, z, r, ramp: def && def.ramp ? def.ramp : null, small: !!opts.small, el: def && def.elements ? def.elements[0] : null });
      return hit;
    }

    // Brief pull toward a point (gravity element, magnetic modifier).
    vortex(x, y, z, r, src, dur = 0.45, strength = 16) {
      this.objects.push({ kind: 'vortex', x, y, z, r, t: dur, dur, owner: src, strength, update: XS.Powers.updateVortex });
      this.events.emit('vortex', { x, y, z, r });
    }

    // ---------------------------------------------------------------- step
    step(dt) {
      if (this.hitstop > 0) { this.hitstop -= dt; return; }
      this.time += dt;
      this.world.update(dt);
      if (this.scheduled.length) {
        const due = this.scheduled.filter((s) => s.t <= this.time);
        if (due.length) {
          this.scheduled = this.scheduled.filter((s) => s.t > this.time);
          for (const s of due) s.fn();
        }
      }
      for (const f of this.fighters) {
        if (f.alive && f.ai) f.ai.think(this, dt);
        f.update(this, dt);
      }
      this.separate();
      for (let i = 0; i < this.objects.length; i++) {
        const o = this.objects[i];
        if (o.update(this, o, dt) === false) o.dead = true;
      }
      if (this.objects.some((o) => o.dead)) this.objects = this.objects.filter((o) => !o.dead);
      for (const t of this.telegraphs) t.age += dt;
      this.telegraphs = this.telegraphs.filter((t) => t.age < t.dur);

      if (this.time > SUDDEN_DEATH_AT) this.crumble(dt);

      const teams = new Set(this.alive().map((f) => f.team));
      if (!this.over && teams.size <= 1) {
        this.endT += dt;
        if (this.endT === dt) {
          this.winnerTeam = teams.size ? [...teams][0] : null;
          this.events.emit('decided', { winnerTeam: this.winnerTeam });
          for (const f of this.alive()) if (f.rig) f.rig.victory();
        }
        if (this.endT > 1.8) { this.over = true; this.events.emit('over', { winnerTeam: this.winnerTeam }); }
      }
    }

    separate() {
      const F = this.fighters;
      for (let i = 0; i < F.length; i++) {
        const a = F[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < F.length; j++) {
          const b = F[j];
          if (!b.alive || Math.abs(a.z - b.z) > 2.5) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = (a.radius + b.radius) * 0.8;
          if (d >= min || d < 1e-4) continue;
          const push = (min - d) / 2;
          const nx = dx / d, ny = dy / d;
          if (!a.blocked(this, a.x - nx * push, a.y - ny * push)) { a.x -= nx * push; a.y -= ny * push; }
          if (!b.blocked(this, b.x + nx * push, b.y + ny * push)) { b.x += nx * push; b.y += ny * push; }
        }
      }
    }

    // Sudden death: the floor erodes inward from the rim.
    crumble(dt) {
      if (!this.suddenDeath) { this.suddenDeath = true; this.events.emit('suddenDeath', {}); }
      this.crumbleT -= dt;
      if (this.crumbleT > 0) return;
      this.crumbleT = 0.12;
      const w = this.world, c = this.arena.center;
      const maxR = Math.hypot(w.W, w.D) / 2;
      this.crumbleR = Math.min(maxR, this.crumbleR + 0.05);
      const edge = maxR - this.crumbleR;
      for (let k = 0; k < 6; k++) {
        const a = this.rng.range(0, Math.PI * 2);
        for (let rr = maxR; rr >= Math.max(3, edge); rr -= 0.5) {
          const x = Math.floor(c.x + Math.cos(a) * rr), y = Math.floor(c.y + Math.sin(a) * rr);
          if (w.topAt(x, y) === -Infinity) continue;
          w.damageSphere(x + 0.5, y + 0.5, w.topAt(x, y) - 1, 1.2, 40, null);
          break;
        }
      }
    }

    summary() {
      return this.fighters.map((f) => ({ id: f.id, name: f.name, team: f.team, alive: f.alive, hp: f.hp, stats: f.stats }));
    }
  }

  XS.Battle = Battle;
})(globalThis.XS = globalThis.XS || {});
