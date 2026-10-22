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
        this.decide = XS.lerp(0.5, 0.15, Math.min(1, s)) * this.rng.range(0.8, 1.2);
        this.target = this.pickTarget(b);
        this.aimErr = this.rng.gauss(0, (1.15 - Math.min(1, s)) * 0.45);
        // Weaker beings hesitate: they don't swing at every chance.
        this.swing = this.rng.chance(0.35 + 0.6 * Math.min(1, s));
        this.plan(b);
      }
      c.mx = this.move.x; c.my = this.move.y;
      // Wedged against something for a while: sidestep for a moment.
      this.stuckT = (this.stuckT || 0) + dt;
      if (this.stuckT > 1) {
        const moved = this.lastPos ? Math.hypot(f.x - this.lastPos.x, f.y - this.lastPos.y) : 9;
        this.lastPos = { x: f.x, y: f.y };
        this.stuckT = 0;
        if (moved < 0.6 && (c.mx || c.my) && !f.dash) {
          const side = this.rng.sign();
          this.unstick = { t: 0.8, x: -c.my * side - c.mx * 0.3, y: c.mx * side - c.my * 0.3 };
          if (this.nav) this.nav.age = Infinity;
        }
      }
      if (this.unstick && (this.unstick.t -= dt) > 0) { const l = Math.hypot(this.unstick.x, this.unstick.y) || 1; c.mx = this.unstick.x / l; c.my = this.unstick.y / l; }
      // Never walk off a ledge into the void, whatever the plan says.
      if ((c.mx || c.my) && !this.groundAhead(b, c.mx, c.my, 1.3)) {
        // Go around the hole along the distance field; else head for the
        // centre; else stand still.
        const t = this.target;
        let alt = t && t.alive ? this.navDir(b, t) : null;
        if (!alt || !this.groundAhead(b, alt.x, alt.y, 1.3)) alt = this.towardCenter(b);
        if (!this.groundAhead(b, alt.x, alt.y, 1.3)) alt = { x: 0, y: 0 };
        c.mx = alt.x; c.my = alt.y;
      }
      const t = this.target;
      if (!t || !t.alive) { c.attack = false; return; }
      const dx = t.x - f.x, dy = t.y - f.y, dist = Math.hypot(dx, dy);
      c.aim = Math.atan2(dy, dx) + this.aimErr * 0.5;

      // ---- dodging incoming threats (with reaction delay) ----
      if (this.pendingDodge) {
        this.pendingDodge.t -= dt;
        if (this.pendingDodge.t <= 0) {
          const d = this.safeDodge(b, this.pendingDodge.x, this.pendingDodge.y);
          c.mx = d.x; c.my = d.y; c.dodge = true;
          this.pendingDodge = null;
        }
      } else if (f.dodge.cd <= 0) {
        const threat = this.findThreat(b);
        if (threat && this.rng.chance(Math.min(0.85, s * 0.55 * this.p.dodge))) {
          this.pendingDodge = { t: XS.lerp(0.5, 0.12, Math.min(1, s)), x: threat.x, y: threat.y };
        }
      }

      // ---- powers ----
      if (this.castGap <= 0 && XS.Status.canAct(f) && !f.dash) {
        const choice = this.choosePower(b, t, dist);
        if (choice) {
          c.cast = choice.slot; c.castAngle = choice.angle; c.castDist = choice.dist; c.castCharge = choice.charge;
          this.castGap = XS.lerp(2.6, 0.7, Math.min(1, s)) / this.p.cast * this.rng.range(0.7, 1.3);
        }
      }
      // ---- basic attack ----
      const B = f.basic.def;
      const facing = Math.abs(XS.angleDiff(f.facing, Math.atan2(dy, dx))) < 1.2;
      if (B.kind === 'spit') c.attack = this.swing && dist < B.range * 0.9 && this.los(b, t) && this.rng.chance(0.3 + s * 0.5);
      else c.attack = this.swing && dist - t.radius < B.range + 0.3 && (facing || B.kind === 'spin');
    }

    groundAhead(b, dx, dy, dist) {
      const f = this.f;
      const g = b.world.groundAt(f.x + dx * dist, f.y + dy * dist, f.z + 1.1, 0);
      return g !== -Infinity && g > f.z - 2.5;
    }

    towardCenter(b) {
      const c = b.arena.center, dx = c.x - this.f.x, dy = c.y - this.f.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }

    // Prefer the suggested dodge direction, else its opposite, else the centre.
    safeDodge(b, dx, dy) {
      const dist = this.f.dodge.def.dist;
      const ok = (x, y) => this.groundAhead(b, x, y, dist * 0.5) && this.groundAhead(b, x, y, dist);
      if (ok(dx, dy)) return { x: dx, y: dy };
      if (ok(-dx, -dy)) return { x: -dx, y: -dy };
      return this.towardCenter(b);
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
        const los = this.los(b, t);
        // Blocked line (cover, hills, ravines): follow the distance field.
        const hole = (k) => { const g = w.groundAt(f.x + ux * k, f.y + uy * k, f.z + 1.1, 0); return g === -Infinity || g < f.z - 1.5; };
        const straight = los && !f.blocked(b, f.x + ux * 1.4, f.y + uy * 1.4) && !hole(1.4) && !hole(2.6);
        const nav = (d > want + 1.2 || !los) && !straight ? this.navDir(b, t) : null;
        if (nav) { mx += nav.x * 1.3; my += nav.y * 1.3; }
        else {
          if (d > want + 1.2) { mx += ux; my += uy; }
          else if (d < want - 1.2) { mx -= ux * this.p.retreat; my -= uy * this.p.retreat; }
          if (!los) { mx += ux * 0.6 - uy * this.strafe * 0.6; my += uy * 0.6 + ux * this.strafe * 0.6; }
        }
        mx += -uy * this.strafe * (nav ? 0.25 : 0.8); my += ux * this.strafe * (nav ? 0.25 : 0.8);
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
        if ((o.kind !== 'zone' && o.kind !== 'sing' && o.kind !== 'tornado' && o.kind !== 'mine') || o.owner.team === f.team) continue;
        const r = o.kind === 'mine' ? 2.2 : o.kind === 'sing' ? o.r * 1.4 : o.r;
        const hx = f.x - o.x, hy = f.y - o.y, hd = Math.hypot(hx, hy);
        if (hd < r + f.radius + 0.5) { const k = o.kind === 'sing' ? 2.5 : 1.5; mx += (hx / (hd || 1)) * k; my += (hy / (hd || 1)) * k; }
      }
      const l = Math.hypot(mx, my);
      this.move = l > 0.05 ? { x: mx / l, y: my / l } : { x: 0, y: 0 };
    }

    // Direction along the distance field toward the target (null if unreachable).
    navDir(b, t) {
      const f = this.f;
      if (!this.nav) this.nav = new XS.NavField(b.world, { clear: f.radius * 0.75 > 0.55 });
      this.nav.update(t.x, t.y, b.time - (this.navT || 0));
      this.navT = b.time;
      return this.nav.dirFrom(f.x, f.y);
    }

    // Incoming projectile or telegraph on top of us -> a dodge direction.
    findThreat(b) {
      const f = this.f;
      for (const o of b.objects) {
        if ((o.kind !== 'proj' && o.kind !== 'wave' && o.kind !== 'tornado') || o.owner.team === f.team || this.dodged.has(o)) continue;
        const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy);
        if (d > 6 || d < 0.5) continue;
        const vx = o.kind === 'proj' ? o.vx : Math.cos(o.angle) * (o.speed || o.def.speed);
        const vy = o.kind === 'proj' ? o.vy : Math.sin(o.angle) * (o.speed || o.def.speed);
        const sp = Math.hypot(vx, vy) || 1;
        const dot = (dx * vx + dy * vy) / (d * sp);
        if (dot < 0.85 || d / sp > (o.kind === 'proj' ? 0.5 : 0.9)) continue;
        this.dodged.add(o);
        const side = this.rng.sign();
        return { x: (-vy / sp) * side, y: (vx / sp) * side };
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

    // Every ready power is scored by how it is aimed, not by its form, so new
    // forms only need the right aim type (and a few form-specific nudges).
    choosePower(b, t, dist) {
      const f = this.f, w = b.world;
      const los = this.los(b, t);
      const sk = Math.min(1, this.skill);
      let best = null, bs = 0.35;
      f.powers.forEach((p, slot) => {
        if (p.cd > 0) return;
        const d = p.def, has = (m) => d.mods.includes(m);
        // Lead the target by the time the power takes to arrive.
        let lead;
        switch (d.aim) {
          case 'line': lead = d.speed ? dist / d.speed : 0.15; break;
          case 'lob': lead = 0.35 + dist * 0.045 + (d.form === 'grenade' && has('delay') ? 1.2 : 0); break;
          case 'zone': lead = d.form === 'meteor' ? 1.2 : 0.7; break;
          default: lead = 0.2;
        }
        lead *= sk;
        const px = t.x + t.vx * lead, py = t.y + t.vy * lead;
        const angle = Math.atan2(py - f.y, px - f.x) + this.aimErr;
        const pd = Math.hypot(px - f.x, py - f.y);
        let s = 0, castAngle = angle, castDist = pd;
        switch (d.aim) {
          case 'line':
            if (d.form === 'hook') { if (los && dist < d.range * 0.9 && dist > 4) s = 0.9; }
            else if (d.form === 'drill' || has('burrow')) { if (dist < d.range * 0.95) s = los ? 0.95 : 0.9; } // through cover
            else if (d.form === 'eruption') { if (dist < d.range + d.radius && Math.abs(t.z - f.z) < 2.5) s = 1; }
            else if (d.form === 'tornado') { if (dist < d.range * 0.9) s = 0.85; }
            else if (d.form === 'wave') { if (los && dist < d.range * 0.95 && Math.abs(t.z - f.z) < 2.5) s = 1; }
            else if (los && dist < d.range * 0.95) s = d.form === 'sniper' ? (dist > 6 ? 1.1 : 0.7) : 1;
            break;
          case 'cone':
            if (los && dist - t.radius < d.range) s = d.form === 'quake' ? 1.15 : 1.1;
            break;
          case 'lob':
            if (w.topAt(px, py) === -Infinity) break; // don't throw into the void
            if (d.form === 'summon') { if (dist < 14) { s = 0.8; castDist = Math.min(d.range, Math.max(2, dist * 0.4)); } }
            else if (pd < d.range + 1) s = d.form === 'grenade' || d.form === 'singularity' ? (los ? 0.9 : 1.05) : 0.95; // lobs shine against cover
            if (d.form === 'mine' && dist < 4) castDist = Math.min(pd, 2);
            break;
          case 'zone':
            if (pd < d.range + 1 && w.topAt(px, py) !== -Infinity) s = d.form === 'meteor' ? (t.st.stun > 0 || t.st.root > 0 || t.st.freeze > 0 ? 1.3 : 0.85) : 0.95;
            break;
          case 'dash':
            if (d.form === 'blink') {
              if (f.hp < f.maxHp * 0.35 && dist < 4) {
                s = 0.9; castAngle = Math.atan2(b.arena.center.y - f.y, b.arena.center.x - f.x); castDist = d.range;
              } else if (dist > 5 && dist < d.range + 2) { s = 0.8; castDist = Math.max(1, dist - 1.5); }
            } else if (los && dist > 2.5 && dist < d.range + 1.5) s = 1;
            else if (f.hp < f.maxHp * 0.35 && dist < 4) { s = 0.8; castAngle = angle + Math.PI; }
            if (s && !this.groundAhead(b, Math.cos(castAngle), Math.sin(castAngle), Math.min(d.range, castDist + 1))) s = 0; // never dash off a ledge
            break;
          case 'self':
            if (d.form === 'nova') { if (dist < d.radius + t.radius) s = 1.2; }
            else if (d.form === 'orbit') { if (dist < 6) s = 0.9; }
            else if (dist < 5 || f.hp < f.maxHp * 0.55) s = 0.9;
            break;
          case 'wall':
            if (dist > 5 && t.powers.some((q) => q.def.ai.kind === 'ranged')) { s = 0.6; castDist = Math.min(d.range, dist * 0.45); }
            break;
        }
        if (!s) return;
        if (d.combo) s *= 1.05;
        s *= (0.85 + this.rng.next() * 0.3) * (1 + d.tier * 0.05);
        if (s > bs) {
          bs = s;
          // AIs "hold" a charge power for a moment's worth of charge.
          const charge = has('charge') ? XS.clamp(this.rng.range(0.3, 1) * (0.5 + sk * 0.5), 0, 1) : 0;
          best = { slot, angle: castAngle, dist: XS.clamp(castDist, 1, d.range || 1), charge };
        }
      });
      return best;
    }
  }

  XS.AI = AI;
})(globalThis.XS = globalThis.XS || {});
