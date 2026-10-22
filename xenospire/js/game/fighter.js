// A fighter in the arena: physics against the voxel world, falls into the
// void, dodge, basic attack and power slots. Driven by a controller struct that
// either the player's input or the AI fills every step.
(function (XS) {
  'use strict';

  const GRAV = 32;
  const STEP = 1.05;

  class Fighter {
    constructor(o) {
      this.id = o.id;
      this.team = o.team;
      this.g = o.genome;
      this.isPlayer = !!o.isPlayer;
      this.name = o.name || this.g.name;
      const st = this.g.stats;
      this.maxHp = Math.round(st.maxHp * (o.hpMult || 1));
      this.hp = o.hp != null ? Math.max(1, Math.min(this.maxHp, Math.round(o.hp))) : this.maxHp;
      this.speed = st.speed * (o.speedMult || 1);
      this.mass = st.mass * (o.massMult || 1);
      this.radius = st.radius * (o.sizeMult || 1);
      this.height = st.height * (o.sizeMult || 1);
      this.x = o.x; this.y = o.y; this.z = o.z;
      this.vx = 0; this.vy = 0; this.vz = 0; this.kx = 0; this.ky = 0;
      this.facing = o.facing || 0;
      this.aimAngle = this.facing;
      this.alive = true;
      this.grounded = true;
      this.glide = 0;
      this.powers = (o.powers || []).map((def) => ({ def, cd: 0.5 }));
      const B = XS.Creature.BASICS[this.g.basic];
      const dmgScale = o.basicMult || 1;
      this.basic = {
        def: {
          form: 'basic', kind: B.kind, name: B.name, damage: Math.round(B.damage * dmgScale), cooldown: B.cooldown * st.basicRate,
          range: B.range + (B.kind === 'spit' ? 0 : this.radius * 0.6), arc: B.arc || 0, speed: B.speed || 0, radius: 0.35,
          knock: B.kind === 'spit' ? 1.5 : 4, terrain: 0.5, status: [], mods: [], elements: [], ramp: this.g.palette.accent,
        },
        cd: 0, windup: 0,
      };
      this.dodge = { def: XS.Creature.DODGES[this.g.dodge], kind: this.g.dodge, cd: 0, t: 0, vx: 0, vy: 0 };
      this.dash = null;
      this.forced = null;
      this.aura = null;
      this.st = XS.Status.fresh();
      this.inv = 1;
      this.ctrl = { mx: 0, my: 0, aim: this.facing, castAngle: null, castDist: 6, attack: false, cast: -1, dodge: false };
      this.faceLock = 0;
      this.stats = { dmg: 0, taken: 0, kos: 0, falls: 0, voxels: 0, casts: [0, 0, 0, 0], basic: 0 };
      this.lastSafe = { x: o.x, y: o.y, z: o.z };
      this.safeT = 0;
      this.lastHitBy = null;
      this.lastHitT = -99;
      this.koTime = 0;
      this.enraged = false;
      this.ai = null;
      this.rig = null;
      this.dmgMult = o.dmgMult || 1;
    }

    get airborne() { return !this.grounded; }

    update(b, dt) {
      if (!this.alive) return;
      XS.Status.update(b, this, dt);
      if (!this.alive) return;
      const cdr = XS.Status.cooldownRate(this);
      for (const p of this.powers) p.cd = Math.max(0, p.cd - dt * cdr);
      this.basic.cd = Math.max(0, this.basic.cd - dt * cdr);
      this.dodge.cd = Math.max(0, this.dodge.cd - dt);
      this.inv = Math.max(0, this.inv - dt);
      this.faceLock = Math.max(0, this.faceLock - dt);
      if (this.aura) XS.Powers.updateAura(b, this, dt);

      const c = this.ctrl;
      this.aimAngle = c.aim;
      if (XS.Status.canAct(this) && !this.dash && !this.forced && this.dodge.t <= 0) {
        if (c.dodge && this.dodge.cd <= 0) this.startDodge(b);
        else if (c.cast >= 0) this.tryCast(b, c.cast);
        else if (c.attack && this.basic.cd <= 0 && this.basic.windup <= 0) this.startBasic(b);
      }
      c.dodge = false;
      c.cast = -1;
      if (this.basic.windup > 0 && (this.basic.windup -= dt) <= 0) this.resolveBasic(b);

      // ---- horizontal movement ----
      let mvx = 0, mvy = 0;
      if (this.dodge.t > 0) {
        this.dodge.t -= dt;
        mvx = this.dodge.vx; mvy = this.dodge.vy;
      } else if (this.dash) {
        const v = XS.Powers.updateDash(b, this, dt);
        mvx = v.x; mvy = v.y;
      } else if (this.forced) {
        this.forced.t -= dt;
        mvx = this.forced.vx; mvy = this.forced.vy;
        if (this.forced.t <= 0) this.forced = null;
      } else {
        const sp = this.speed * XS.Status.speedMult(this) * (this.enraged ? 1.15 : 1);
        const tx = c.mx * sp, ty = c.my * sp;
        const acc = (this.grounded ? 48 : 20) * dt;
        this.vx += XS.clamp(tx - this.vx, -acc, acc);
        this.vy += XS.clamp(ty - this.vy, -acc, acc);
        mvx = this.vx; mvy = this.vy;
        const m = Math.hypot(c.mx, c.my);
        if (m > 0.15 && this.faceLock <= 0 && XS.Status.canAct(this)) this.facing = XS.turnToward(this.facing, Math.atan2(c.my, c.mx), 14 * dt);
      }
      const fr = this.grounded ? 5 : 1.2;
      this.kx *= Math.exp(-fr * dt); this.ky *= Math.exp(-fr * dt);
      this.move(b, (mvx + this.kx) * dt, (mvy + this.ky) * dt);

      // ---- vertical ----
      const ground = this.groundUnder(b);
      const trait = this.g.trait;
      if (this.z > ground + 0.02 || this.vz > 0) {
        this.grounded = false;
        this.vz -= GRAV * dt;
        const overVoid = ground === -Infinity;
        if (overVoid && (trait === 'planar' || trait === 'levitante') && this.glide < (trait === 'planar' ? 0.9 : 0.55) && this.z > -1) {
          this.glide += dt;
          this.vz = Math.max(this.vz, -0.8);
        }
        this.z += this.vz * dt;
        if (this.z <= ground) { this.z = ground; this.vz = 0; this.grounded = true; this.glide = 0; }
      } else {
        this.z = ground;
        this.vz = 0;
        this.grounded = true;
        this.glide = 0;
      }
      if (this.z < -6) b.onFall(this);

      if (this.grounded && (this.safeT -= dt) <= 0) {
        this.safeT = 0.4;
        const w = b.world;
        if (w.isSafe(Math.floor(this.x), Math.floor(this.y), 3)) this.lastSafe = { x: this.x, y: this.y, z: this.z };
      }
    }

    groundUnder(b) {
      const w = b.world, r = this.radius * 0.45;
      const tol = this.g.trait === 'levitante' ? 2.1 : STEP;
      let g = w.groundAt(this.x, this.y, this.z, tol);
      g = Math.max(g, w.groundAt(this.x + r, this.y, this.z, tol), w.groundAt(this.x - r, this.y, this.z, tol));
      g = Math.max(g, w.groundAt(this.x, this.y + r, this.z, tol), w.groundAt(this.x, this.y - r, this.z, tol));
      return g;
    }

    blocked(b, px, py) {
      const w = b.world, r = this.radius * 0.75;
      const z0 = this.z + (this.g.trait === 'levitante' ? 2.1 : STEP), z1 = this.z + Math.max(1.6, this.height * 0.75);
      for (let cy = Math.floor(py - r); cy <= Math.floor(py + r); cy++) {
        for (let cx = Math.floor(px - r); cx <= Math.floor(px + r); cx++) {
          const nx = XS.clamp(px, cx, cx + 1), ny = XS.clamp(py, cy, cy + 1);
          if ((nx - px) ** 2 + (ny - py) ** 2 > r * r) continue;
          if (w.blockedSpan(cx, cy, z0, z1)) return { cx, cy };
        }
      }
      return null;
    }

    move(b, dx, dy) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.35));
      dx /= steps; dy /= steps;
      for (let i = 0; i < steps; i++) {
        let hit = dx ? this.blocked(b, this.x + dx, this.y) : null;
        if (hit) { this.slam(b, hit, 'x'); dx = 0; } else this.x += dx;
        hit = dy ? this.blocked(b, this.x, this.y + dy) : null;
        if (hit) { this.slam(b, hit, 'y'); dy = 0; } else this.y += dy;
      }
    }

    // Being knocked hard into a wall hurts and breaks it a little.
    slam(b, hit, axis) {
      const k = axis === 'x' ? this.kx : this.ky;
      if (Math.abs(k) > 9 && !this.dash) {
        b.world.damageSphere(hit.cx + 0.5, hit.cy + 0.5, this.z + 1, 1.3, Math.abs(k) * 0.12, this.lastHitBy);
        b.damage(this, 4, { src: this.lastHitBy, tag: 'slam', noKnock: true });
        b.events.emit('slam', { f: this, x: hit.cx + 0.5, y: hit.cy + 0.5, z: this.z + 1 });
      }
      if (axis === 'x') { this.vx = 0; this.kx *= -0.3; } else { this.vy = 0; this.ky *= -0.3; }
      if (this.dash) this.dash.blocked = true;
    }

    startDodge(b) {
      const c = this.ctrl, D = this.dodge.def;
      let dx = c.mx, dy = c.my;
      const m = Math.hypot(dx, dy);
      if (m < 0.2) { dx = Math.cos(this.facing); dy = Math.sin(this.facing); } else { dx /= m; dy /= m; }
      const v = D.dist / D.time;
      this.dodge.t = D.time;
      this.dodge.vx = dx * v; this.dodge.vy = dy * v;
      this.dodge.cd = 1.5;
      this.inv = Math.max(this.inv, D.time + 0.06);
      if (this.dodge.kind === 'voo') { this.vz = 7; this.grounded = false; }
      if (this.rig) this.rig.dodge(this.dodge.kind, D.time);
      b.events.emit('dodge', { f: this });
    }

    tryCast(b, slot) {
      const p = this.powers[slot];
      if (!p || p.cd > 0) return false;
      const c = this.ctrl;
      const angle = c.castAngle != null ? c.castAngle : this.aimAngle;
      this.facing = angle;
      this.faceLock = 0.35;
      p.cd = p.def.cooldown;
      this.stats.casts[slot]++;
      XS.Powers.cast(b, this, p.def, { angle, dist: c.castDist });
      if (this.rig) this.rig.cast();
      b.events.emit('cast', { f: this, def: p.def, slot });
      c.castAngle = null;
      return true;
    }

    startBasic(b) {
      const B = this.basic;
      B.cd = B.def.cooldown;
      this.facing = this.aimAngle;
      this.faceLock = 0.3;
      this.stats.basic++;
      if (B.def.kind === 'spit') {
        XS.Powers.spawnProjectile(b, this, B.def, this.aimAngle, {});
        if (this.rig) this.rig.cast();
      } else {
        B.windup = 0.09;
        if (this.rig) this.rig.melee();
      }
      b.events.emit('basic', { f: this });
    }

    resolveBasic(b) {
      const D = this.basic.def;
      let any = false;
      for (const e of b.fighters) {
        if (!e.alive || e.team === this.team) continue;
        const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy) - e.radius;
        if (d > D.range || Math.abs(e.z - this.z) > 2.5) continue;
        if (D.kind === 'melee' && Math.abs(XS.angleDiff(this.facing, Math.atan2(dy, dx))) > D.arc / 2) continue;
        b.damage(e, D.damage, { src: this, def: D, kx: dx, ky: dy, kb: D.knock });
        any = true;
      }
      for (const t of b.turrets()) {
        if (t.owner.team === this.team) continue;
        if (Math.hypot(t.x - this.x, t.y - this.y) < D.range + 0.6) { t.hp -= D.damage; any = true; }
      }
      const fx = this.x + Math.cos(this.facing) * D.range * 0.7, fy = this.y + Math.sin(this.facing) * D.range * 0.7;
      b.world.damageSphere(D.kind === 'spin' ? this.x : fx, D.kind === 'spin' ? this.y : fy, this.z + 1, D.kind === 'spin' ? D.range : 1.1, 0.7, this);
      b.events.emit('swing', { f: this, hit: any });
    }
  }

  XS.Fighter = Fighter;
})(globalThis.XS = globalThis.XS || {});
