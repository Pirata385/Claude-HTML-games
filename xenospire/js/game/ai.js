// Utility AI for opponents (and for headless test fights). It keeps the
// distance its kit prefers, avoids telegraphs, zones and edges, dodges
// incoming shots with a human-ish reaction time, and scores every ready power
// before casting it. Personality bends the weights.
(function (XS) {
  'use strict';

  const PERS = {
    agressivo: { range: 0.75, cast: 1.2, dodge: 0.9, retreat: 0.6 },
    cauteloso: { range: 1.25, cast: 0.9, dodge: 1.2, retreat: 1.4 },
    exibido: { range: 1, cast: 1.3, dodge: 1, retreat: 0.9 },
    caotico: { range: 1, cast: 1.1, dodge: 0.8, retreat: 1 },
    estrategista: { range: 1.1, cast: 1, dodge: 1.1, retreat: 1.1 },
  };

  class AI {
    constructor(f, opts = {}) {
      this.f = f;
      this.skill = XS.clamp(opts.skill != null ? opts.skill : 0.5, 0.1, 1.2);
      this.p = PERS[f.g.personality] || PERS.estrategista;
      this.rng = new XS.RNG(XS.hash(f.g.seed, 'ai', opts.salt || 0));
      this.decide = 0;
      this.castGap = 1 + this.rng.next();
      this.strafe = this.rng.sign();
      this.strafeT = 2;
      this.target = null;
      this.dodged = new WeakSet();
      this.react = 0;
      this.pendingDodge = null;
      this.move = { x: 0, y: 0 };
      this.aimErr = 0;
    }

    think(b, dt) {
      const f = this.f, c = f.ctrl;
      const s = this.skill;
      this.decide -= dt;
      this.castGap -= dt;
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = this.rng.range(1.2, 3.2); }

      if (this.decide <= 0) {
        this.decide = XS.lerp(0.36, 0.12, Math.min(1, s)) * this.rng.range(0.8, 1.2);
        this.target = this.pickTarget(b);
        this.aimErr = this.rng.gauss(0, (1 - Math.min(1, s)) * 0.32);
        this.plan(b);
      }
      c.mx = this.move.x; c.my = this.move.y;
      const t = this.target;
      if (!t || !t.alive) { c.attack = false; return; }
      const dx = t.x - f.x, dy = t.y - f.y, dist = Math.hypot(dx, dy);
      c.aim = Math.atan2(dy, dx) + this.aimErr * 0.5;

      // ---- dodging incoming threats (with reaction delay) ----
      if (this.pendingDodge) {
        this.pendingDodge.t -= dt;
        if (this.pendingDodge.t <= 0) {
          c.mx = this.pendingDodge.x; c.my = this.pendingDodge.y; c.dodge = true;
          this.pendingDodge = null;
        }
      } else if (f.dodge.cd <= 0) {
        const threat = this.findThreat(b);
        if (threat && this.rng.chance(Math.min(0.92, s * 0.8 * this.p.dodge))) {
          this.pendingDodge = { t: XS.lerp(0.32, 0.06, Math.min(1, s)), x: threat.x, y: threat.y };
        }
      }

      // ---- powers ----
      if (this.castGap <= 0 && XS.Status.canAct(f) && !f.dash) {
        const choice = this.choosePower(b, t, dist);
        if (choice) {
          c.cast = choice.slot; c.castAngle = choice.angle; c.castDist = choice.dist;
          this.castGap = XS.lerp(1.5, 0.35, Math.min(1, s)) / this.p.cast * this.rng.range(0.7, 1.3);
        }
      }
      // ---- basic attack ----
      const B = f.basic.def;
      const facing = Math.abs(XS.angleDiff(f.facing, Math.atan2(dy, dx))) < 1.2;
      if (B.kind === 'spit') c.attack = dist < B.range * 0.9 && this.los(b, t) && this.rng.chance(0.5 + s * 0.4);
      else c.attack = dist - t.radius < B.range + 0.3 && (facing || B.kind === 'spin');
    }

    pickTarget(b) {
      const f = this.f;
      let best = null, bs = -Infinity;
      for (const e of b.fighters) {
        if (!e.alive || e.team === f.team) continue;
        const d = Math.hypot(e.x - f.x, e.y - f.y);
        let score = -d - (e.hp / e.maxHp) * 6 + (e === this.target ? 3 : 0) + (e.isPlayer ? 1.5 : 0);
        if (e.lastHitBy === f) score += 1;
        if (f.lastHitBy === e && b.time - f.lastHitT < 3) score += 4;
        if (score > bs) { bs = score; best = e; }
      }
      return best;
    }

    los(b, t) {
      const f = this.f, z = f.z + 1.4;
      return !b.world.raycast(f.x, f.y, z, t.x, t.y, Math.max(z, t.z + 1.4));
    }

    // Preferred fighting distance from the kit.
    preferredRange() {
      const f = this.f;
      let sum = 0, n = 0;
      for (const p of f.powers) {
        const k = p.def.ai.kind;
        const r = k === 'ranged' || k === 'zone' ? Math.min(9, p.def.range * 0.7) : 2.6;
        const w = p.cd < 1.5 ? 2 : 1;
        sum += r * w; n += w;
      }
      if (f.basic.def.kind !== 'spit') { sum += 2.2 * 1.5; n += 1.5; } else { sum += 6; n += 1; }
      return XS.clamp((sum / Math.max(1, n)) * this.p.range, 2, 10);
    }

    plan(b) {
      const f = this.f, t = this.target, w = b.world;
      let mx = 0, my = 0;
      if (t && t.alive) {
        const dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d;
        let want = this.preferredRange();
        if (f.hp < f.maxHp * 0.3) want *= 1 + 0.35 * this.p.retreat;
        if (d > want + 1.2) { mx += ux; my += uy; }
        else if (d < want - 1.2) { mx -= ux * this.p.retreat; my -= uy * this.p.retreat; }
        mx += -uy * this.strafe * 0.8; my += ux * this.strafe * 0.8;
        if (!this.los(b, t)) { mx += ux * 0.6 - uy * this.strafe * 0.6; my += uy * 0.6 + ux * this.strafe * 0.6; }
      }
      // Stay away from the rim and from holes ahead.
      const c = b.arena.center, cx = c.x - f.x, cy = c.y - f.y, cd = Math.hypot(cx, cy) || 1;
      const rim = cd / (b.arena.size * 0.45);
      if (rim > 0.55) { mx += (cx / cd) * (rim - 0.55) * 3; my += (cy / cd) * (rim - 0.55) * 3; }
      const ml = Math.hypot(mx, my) || 1;
      for (const look of [1.4, 2.6]) {
        const ax = f.x + (mx / ml) * look, ay = f.y + (my / ml) * look;
        const g = w.groundAt(ax, ay, f.z + 1, 0);
        if (g === -Infinity || g < f.z - 2.5) { mx = cx / cd * 1.5 - mx * 0.5; my = cy / cd * 1.5 - my * 0.5; break; }
      }
      // Hazards: enemy telegraphs and zones.
      for (const tg of b.telegraphs) {
        if (tg.team === f.team) continue;
        const hx = f.x - tg.x, hy = f.y - tg.y, hd = Math.hypot(hx, hy);
        if (hd < tg.r + f.radius + 1) { mx += (hx / (hd || 1)) * 2.5; my += (hy / (hd || 1)) * 2.5; }
      }
      for (const o of b.objects) {
        if (o.kind !== 'zone' || o.owner.team === f.team) continue;
        const hx = f.x - o.x, hy = f.y - o.y, hd = Math.hypot(hx, hy);
        if (hd < o.r + f.radius + 0.5) { mx += (hx / (hd || 1)) * 1.5; my += (hy / (hd || 1)) * 1.5; }
      }
      const l = Math.hypot(mx, my);
      this.move = l > 0.05 ? { x: mx / l, y: my / l } : { x: 0, y: 0 };
    }

    // Incoming projectile or telegraph on top of us -> a dodge direction.
    findThreat(b) {
      const f = this.f;
      for (const o of b.objects) {
        if (o.kind !== 'proj' || o.owner.team === f.team || this.dodged.has(o)) continue;
        const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy);
        if (d > 6 || d < 0.5) continue;
        const sp = Math.hypot(o.vx, o.vy) || 1;
        const dot = (dx * o.vx + dy * o.vy) / (d * sp);
        if (dot < 0.85 || d / sp > 0.5) continue;
        this.dodged.add(o);
        const side = this.rng.sign();
        return { x: (-o.vy / sp) * side, y: (o.vx / sp) * side };
      }
      for (const tg of b.telegraphs) {
        if (tg.team === f.team || this.dodged.has(tg)) continue;
        const hx = f.x - tg.x, hy = f.y - tg.y, hd = Math.hypot(hx, hy);
        if (hd > tg.r + f.radius || tg.dur - tg.age > 0.35) continue;
        this.dodged.add(tg);
        return hd > 0.1 ? { x: hx / hd, y: hy / hd } : { x: 1, y: 0 };
      }
      return null;
    }

    choosePower(b, t, dist) {
      const f = this.f;
      const los = this.los(b, t);
      let best = null, bs = 0.35;
      f.powers.forEach((p, slot) => {
        if (p.cd > 0) return;
        const d = p.def;
        const lead = d.speed ? dist / d.speed : 0.5;
        const px = t.x + t.vx * lead * Math.min(1, this.skill), py = t.y + t.vy * lead * Math.min(1, this.skill);
        const angle = Math.atan2(py - f.y, px - f.x) + this.aimErr;
        const pd = Math.hypot(px - f.x, py - f.y);
        let s = 0, castAngle = angle, castDist = pd;
        switch (d.form) {
          case 'bolt': case 'boomerang': case 'beam':
            if (los && dist < d.range * 0.95) s = 1;
            break;
          case 'hook':
            if (los && dist < d.range * 0.9 && dist > 4) s = 0.9;
            break;
          case 'nova': if (dist < d.radius + t.radius) s = 1.2; break;
          case 'cone': if (dist < d.range && los) s = 1.1; break;
          case 'orbit': if (dist < 6) s = 0.9; break;
          case 'dash':
            if (los && dist > 2.5 && dist < d.range + 1.5) s = 1;
            else if (f.hp < f.maxHp * 0.35 && dist < 4) { s = 0.8; castAngle = angle + Math.PI; }
            break;
          case 'field': case 'rain': case 'mine':
            if (pd < d.range + 1) s = 0.95;
            if (d.form === 'mine' && dist < 4) { castDist = Math.min(pd, 2); }
            break;
          case 'summon': if (dist < 14) s = 0.8; castDist = Math.min(d.range, 3); break;
          case 'wall':
            if (dist > 5 && t.powers.some((q) => q.def.ai.kind === 'ranged')) { s = 0.6; castDist = Math.min(d.range, dist * 0.45); }
            break;
          case 'blink':
            if (f.hp < f.maxHp * 0.35 && dist < 4) {
              s = 0.9; castAngle = Math.atan2(b.arena.center.y - f.y, b.arena.center.x - f.x); castDist = d.range;
            } else if (dist > 5 && dist < d.range + 2) { s = 0.8; castDist = Math.max(1, dist - 1.5); }
            break;
          case 'aura': if (dist < 5 || f.hp < f.maxHp * 0.55) s = 0.9; break;
        }
        if (!s) return;
        s *= (0.85 + this.rng.next() * 0.3) * (1 + d.tier * 0.05);
        if (s > bs) { bs = s; best = { slot, angle: castAngle, dist: castDist }; }
      });
      return best;
    }
  }

  XS.AI = AI;
})(globalThis.XS = globalThis.XS || {});
