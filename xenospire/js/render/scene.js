// Draws an arena with an optional battle: background, tower, terrain bands
// interleaved with depth-bucketed entities, then flat overlays (zones,
// telegraphs, beams, aim preview, bars, numbers, off-screen arrows).
(function (XS) {
  'use strict';

  const gfx = XS.gfx;
  const TEAM_COLORS = ['#5ff0c8', '#ff6a6a', '#ffb24a', '#c88aff', '#6ab8ff'];

  class Scene {
    constructor(screen, arena, opts = {}) {
      this.screen = screen;
      this.arena = arena;
      this.settings = opts.settings || {};
      this.terrain = new XS.Terrain(arena.world);
      this.bg = new XS.Background(arena.theme, XS.hash(opts.seed || 1, arena.theme.id));
      this.bg.resize(screen.W, screen.H);
      this.bg.buildTower(arena);
      this.fx = new XS.FX(arena.world, { quality: this.settings.quality != null ? this.settings.quality : 1, settings: this.settings });
      this.battle = null;
      const c = arena.center;
      this.cam = { x: XS.isoX(c.x, c.y), y: XS.isoY(c.x, c.y, c.z) };
      this.time = 0;
      this.buckets = [];
      this.aim = null;
      this.focus = null;
      this.showBars = true;
    }

    resize() {
      this.bg.sky = null;
      this.bg.resize(this.screen.W, this.screen.H);
    }

    setBattle(battle, hooks) {
      this.battle = battle;
      for (const f of battle.fighters) {
        f.rig = new XS.Rig(f.g);
        f.rig.update(0.016, this.rigState(f));
      }
      this.fx.attach(battle, hooks);
    }

    dispose() { this.fx.dispose(); }

    rigState(f) {
      return { x: f.x, y: f.y, z: f.z, facing: f.facing, vx: f.vx + f.kx * 0.3, vy: f.vy + f.ky * 0.3, airborne: !f.grounded, aimAngle: f.aimAngle };
    }

    // ------------------------------------------------------------ update
    update(dt) {
      this.time += dt;
      const b = this.battle;
      if (b) {
        for (const f of b.fighters) if (f.alive && f.rig) f.rig.update(dt, this.rigState(f));
        const q = this.fx.quality;
        for (const o of b.objects) {
          if (o.kind === 'proj' && this.fx.rng.chance([0.3, 0.7, 1][q])) {
            this.fx.add({ kind: 'px', x: o.x, y: o.y, z: o.z, vx: 0, vy: 0, vz: 0, life: 0.22, color: o.def.ramp[o.child ? 1 : 2], size: 1 });
          } else if (o.kind === 'cone') {
            const f = o.owner;
            for (let i = 0; i < [1, 3, 5][q]; i++) {
              const a = o.angle + this.fx.rng.range(-o.def.angle / 2, o.def.angle / 2), s = this.fx.rng.range(6, 12);
              this.fx.add({ kind: 'spark', x: f.x, y: f.y, z: f.z + f.height * 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: this.fx.rng.range(-1, 1), life: o.def.range / s, color: this.fx.rng.pick(o.def.ramp), size: 1, drag: 0.5 });
            }
          } else if (o.kind === 'zone' && this.fx.rng.chance(o.tag === 'trail' ? 0.05 : [0.15, 0.4, 0.7][q])) {
            const a = this.fx.rng.range(0, Math.PI * 2), r = Math.sqrt(this.fx.rng.next()) * o.r;
            this.fx.add({ kind: 'px', x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, z: o.z, vx: 0, vy: 0, vz: this.fx.rng.range(1, 2.5), life: 0.6, color: o.def.ramp[3], size: 1 });
          } else if (o.kind === 'nova' && q) {
            const a = this.fx.rng.range(0, Math.PI * 2), f = o.owner;
            this.fx.add({ kind: 'spark', x: f.x + Math.cos(a) * 2.5, y: f.y + Math.sin(a) * 2.5, z: f.z + 1, vx: -Math.cos(a) * 9, vy: -Math.sin(a) * 9, vz: 0, life: 0.25, color: o.def.ramp[3] });
          }
        }
        for (const f of b.fighters) {
          if (!f.alive) continue;
          if (f.st.burn && this.fx.rng.chance(0.3)) this.fx.add({ kind: 'px', x: f.x + this.fx.rng.range(-0.5, 0.5), y: f.y, z: f.z + f.height * this.fx.rng.range(0.3, 0.9), vx: 0, vy: 0, vz: 2.5, life: 0.4, color: this.fx.rng.pick(['#ff8a2a', '#ffe08a', '#c2401f']) });
          if (f.st.poison && this.fx.rng.chance(0.15)) this.fx.add({ kind: 'px', x: f.x, y: f.y + this.fx.rng.range(-0.5, 0.5), z: f.z + f.height, vx: 0, vy: 0, vz: 1.2, life: 0.6, color: '#8be04a' });
          if (f.aura && this.fx.rng.chance(0.4)) {
            const a = this.fx.rng.range(0, Math.PI * 2);
            this.fx.add({ kind: 'px', x: f.x + Math.cos(a) * f.aura.def.radius * 0.8, y: f.y + Math.sin(a) * f.aura.def.radius * 0.8, z: f.z + 0.2, vx: 0, vy: 0, vz: 2, life: 0.5, color: f.aura.def.ramp[2] });
          }
        }
      }
      this.fx.update(dt);
      this.updateCamera(dt);
    }

    updateCamera(dt) {
      const b = this.battle;
      let tx, ty, tz;
      const c = this.arena.center;
      const p = b && b.player && b.player.alive ? b.player : null;
      if (this.focus) { tx = this.focus.x; ty = this.focus.y; tz = this.focus.z; }
      else if (p) {
        const e = b.nearestEnemy(p);
        tx = p.x; ty = p.y; tz = p.z;
        if (e) { const k = Math.min(0.35, 9 / (Math.hypot(e.x - p.x, e.y - p.y) + 9) * 0.5); tx += (e.x - p.x) * k; ty += (e.y - p.y) * k; }
      } else if (b && b.alive().length) {
        const al = b.alive();
        tx = al.reduce((s, f) => s + f.x, 0) / al.length; ty = al.reduce((s, f) => s + f.y, 0) / al.length; tz = c.z;
      } else { tx = c.x; ty = c.y; tz = c.z; }
      tz = Math.max(0, tz || 0);
      const goalX = XS.isoX(tx, ty), goalY = XS.isoY(tx, ty, tz + 1);
      this.cam.x = XS.damp(this.cam.x, goalX, 5, dt);
      this.cam.y = XS.damp(this.cam.y, goalY, 5, dt);
    }

    // -------------------------------------------------------------- draw
    draw() {
      const ctx = this.screen.ctx, W = this.screen.W, H = this.screen.H;
      const sh = this.fx.shakeOffset(this.time);
      const ox = Math.round(W / 2 - this.cam.x + sh.x), oy = Math.round(H / 2 - this.cam.y + sh.y);
      this.ox = ox; this.oy = oy;
      this.bg.draw(ctx, this.cam.x, this.cam.y, this.time, this.fx.quality);
      this.bg.drawTower(ctx, ox, oy);
      this.terrain.update();

      const maxD = this.terrain.bands.length - 1;
      const buckets = this.buckets;
      for (let d = 0; d <= maxD; d++) { if (buckets[d]) buckets[d].length = 0; else buckets[d] = []; }
      const put = (d, kind, o) => buckets[XS.clamp(d, 0, maxD)].push(kind, o);
      const b = this.battle;
      if (b) {
        for (const f of b.fighters) if (f.alive) put(Math.floor(f.x + f.radius * 0.7) + Math.floor(f.y + f.radius * 0.7), 'f', f);
        for (const o of b.objects) {
          if (o.kind === 'proj' || o.kind === 'turret' || o.kind === 'mine') put(Math.floor(o.x) + Math.floor(o.y), o.kind, o);
          else if (o.kind === 'orbit' && o.orbs) for (const q of o.orbs) put(Math.floor(q.x) + Math.floor(q.y), 'orb', { o, q });
        }
      }
      for (const p of this.fx.parts) put(Math.floor(p.x) + Math.floor(p.y), 'p', p);

      for (let d = 0; d <= maxD; d++) {
        this.terrain.drawBand(ctx, d, ox, oy);
        const bk = buckets[d];
        for (let i = 0; i < bk.length; i += 2) this.drawEntity(ctx, bk[i], bk[i + 1], ox, oy);
      }

      if (b) this.drawOverlays(ctx, b, ox, oy, W, H);
      this.fx.drawOverlay(ctx, ox, oy);
      this.fx.drawFlash(ctx, W, H);
    }

    drawEntity(ctx, kind, o, ox, oy) {
      switch (kind) {
        case 'f': this.drawFighter(ctx, o, ox, oy); break;
        case 'p': this.fx.drawPart(ctx, o, ox, oy); break;
        case 'proj': {
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
          const r = Math.max(o.def.form === 'basic' ? 1 : 1.5, o.r * 4.4);
          if (o.def.form === 'boomerang') {
            const a = this.time * 20;
            gfx.thickLine(ctx, sx - Math.cos(a) * r * 1.4, sy - Math.sin(a) * r * 0.7, sx + Math.cos(a) * r * 1.4, sy + Math.sin(a) * r * 0.7, 1, o.def.ramp[1]);
          }
          gfx.disc(ctx, sx, sy, r + 1, o.def.ramp[0]);
          gfx.ball(ctx, sx, sy, r, o.def.ramp);
          break;
        }
        case 'turret': {
          const bob = Math.sin(this.time * 3 + o.x) * 0.25;
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z + bob) + oy;
          XS.drawShadow(ctx, o.x, o.y, o.z - 1.2, 0.6, ox, oy, 0.7);
          gfx.disc(ctx, sx, sy, 4, '#0c0816');
          gfx.ball(ctx, sx, sy, 3, o.def.ramp);
          gfx.disc(ctx, sx, sy - 5, 2, '#0c0816');
          gfx.ball(ctx, sx, sy - 5, 1.2, o.def.ramp2 || o.def.ramp);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(sx + Math.cos(o.aim) - Math.sin(o.aim)), Math.round(sy + (Math.cos(o.aim) + Math.sin(o.aim)) * 0.5), 1, 1);
          break;
        }
        case 'mine': {
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
          const blink = o.arm > 0 ? 1 : Math.floor(this.time * 6) % 2;
          gfx.disc(ctx, sx, sy - 1, 2.5, '#0c0816');
          gfx.disc(ctx, sx, sy - 1, 1.5, blink ? o.def.ramp[3] : o.def.ramp[1]);
          break;
        }
        case 'orb': {
          const q = o.q, sx = XS.isoX(q.x, q.y) + ox, sy = XS.isoY(q.x, q.y, q.z) + oy;
          const r = Math.max(1.5, o.o.def.radius * 4.4);
          gfx.disc(ctx, sx, sy, r + 1, o.o.def.ramp[0]);
          gfx.ball(ctx, sx, sy, r, o.o.def.ramp);
          break;
        }
      }
    }

    drawFighter(ctx, f, ox, oy) {
      const g = this.arena.world.groundAt(f.x, f.y, f.z + 0.5, 0);
      if (g !== -Infinity) XS.drawShadow(ctx, f.x, f.y, g, f.radius, ox, oy, f.z - g > 3 ? 0.5 : 1);
      const s = f.st;
      let tint = null, tintK = 0.45;
      if (s.freeze > 0) { tint = '#a8ecff'; tintK = 0.6; }
      else if (f.enraged && Math.floor(this.time * 6) % 2) { tint = '#ff3030'; tintK = 0.35; }
      else if (s.timeslow > 0) { tint = '#d0d8ff'; tintK = 0.3; }
      else if (s.poison) { tint = '#7aff6a'; tintK = 0.25; }
      else if (s.chill > 0) { tint = '#bfeaff'; tintK = 0.15 * s.chill; }
      let alpha = 1;
      if (f.dodge.t > 0 && f.dodge.kind === 'fase') alpha = 0.3;
      else if (f.inv > 0 && f.inv < 1.6 && Math.floor(this.time * 14) % 2) alpha = 0.55;
      XS.drawRig(ctx, f.rig, ox, oy, { flash: f.rig.flash > 0, tint, tintK, alpha });
      const hx = XS.isoX(f.x, f.y) + ox, hy = XS.isoY(f.x, f.y, f.z + f.height) + oy;
      if (s.shield > 0) gfx.ellipseRing(ctx, hx, hy + f.height * 2, f.radius * 6, f.height * 2.6, '#bff8ff', 3, Math.floor(this.time * 10));
      if (s.stun > 0 || s.freeze > 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.time * 6 + (i * Math.PI * 2) / 3;
          ctx.fillStyle = s.freeze > 0 ? '#e8fbff' : '#ffe86a';
          ctx.fillRect(Math.round(hx + Math.cos(a) * 5), Math.round(hy - 3 + Math.sin(a) * 2), 1, 1);
        }
      }
    }

    // Is something solid in front of the fighter (between it and the camera)?
    occluded(f) {
      const w = this.arena.world;
      for (let k = 1; k <= 4; k++) {
        for (const [ax, ay] of [[k, k], [k, k - 1], [k - 1, k]]) {
          if (w.blockedSpan(f.x + ax, f.y + ay, f.z + 1 + k * 0.6, f.z + f.height + k)) return true;
        }
      }
      return false;
    }

    drawOverlays(ctx, b, ox, oy, W, H) {
      // Zones.
      for (const o of b.objects) {
        if (o.kind !== 'zone') continue;
        const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
        const fade = Math.min(1, o.t / 0.4);
        const rx = o.r * 5.66, ry = o.r * 2.83;
        gfx.ellipse(ctx, sx, sy, rx, ry, gfx.ditherPattern(ctx, o.def.ramp[1], (o.tag === 'trail' ? 0.3 : 0.4) * fade));
        if (o.tag !== 'trail') gfx.ellipseRing(ctx, sx, sy, rx, ry, o.def.ramp[2], 4, Math.floor(this.time * 8));
      }
      // Telegraphs (red edge when they threaten the player's team).
      const pt = b.player ? b.player.team : -1;
      for (const t of b.telegraphs) {
        const sx = XS.isoX(t.x, t.y) + ox, sy = XS.isoY(t.x, t.y, t.z) + oy;
        const k = t.age / t.dur;
        const rx = t.r * 5.66, ry = t.r * 2.83;
        gfx.ellipse(ctx, sx, sy, rx * k, ry * k, gfx.ditherPattern(ctx, t.ramp[2], 0.35));
        gfx.ellipseRing(ctx, sx, sy, rx, ry, t.team !== pt && Math.floor(this.time * 10) % 2 ? '#ff4a4a' : t.ramp[3], 3, Math.floor(this.time * 12));
      }
      // Beams and falling strikes.
      for (const o of b.objects) {
        if (o.kind === 'beam') {
          const ax = XS.isoX(o.sx, o.sy) + ox, ay = XS.isoY(o.sx, o.sy, o.sz) + oy;
          const bx = XS.isoX(o.ex, o.ey) + ox, by = XS.isoY(o.ex, o.ey, o.ez) + oy;
          const w = (o.def.mods.includes('colossal') ? 2.5 : 1.5) * (1 - o.t / 0.45);
          const j = () => (this.fx.rng.next() - 0.5) * 1.5;
          gfx.thickLine(ctx, ax, ay, bx + j(), by + j(), w + 1, o.def.ramp[1]);
          gfx.thickLine(ctx, ax, ay, bx, by, Math.max(0.5, w - 0.5), o.def.ramp[3]);
          gfx.disc(ctx, bx, by, 2 + this.fx.rng.next() * 2, o.def.ramp[3]);
        } else if (o.kind === 'strike' && o.t < 0.22) {
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
          const top = sy - 60 * (o.t / 0.22) - 6;
          gfx.thickLine(ctx, sx, top - 10, sx, top, 1.5, o.def.ramp[2]);
          gfx.disc(ctx, sx, top, 2.5, o.def.ramp[3]);
        }
      }
      // Aim preview.
      if (this.aim && b.player && b.player.alive) this.drawAim(ctx, b.player, this.aim, ox, oy);
      // Bars, markers, x-ray.
      for (const f of b.fighters) {
        if (!f.alive) continue;
        const hx = Math.round(XS.isoX(f.x, f.y) + ox), hy = Math.round(XS.isoY(f.x, f.y, f.z + f.height) + oy) - 5;
        if (f.isPlayer && this.settings.xray !== false && this.occluded(f)) XS.drawRigOutline(ctx, f.rig, ox, oy, TEAM_COLORS[0]);
        const col = f.isPlayer ? TEAM_COLORS[0] : TEAM_COLORS[1 + (f.team % 4)];
        if (this.showBars) {
          const w = 14, k = Math.max(0, f.hp / f.maxHp);
          ctx.fillStyle = '#0a0610'; ctx.fillRect(hx - w / 2 - 1, hy - 1, w + 2, 4);
          ctx.fillStyle = '#3a2a3a'; ctx.fillRect(hx - w / 2, hy, w, 2);
          ctx.fillStyle = col; ctx.fillRect(hx - w / 2, hy, Math.ceil(w * k), 2);
          if (f.st.shield > 0) { ctx.fillStyle = '#e8fbff'; ctx.fillRect(hx - w / 2, hy - 1, Math.min(w, Math.ceil((w * f.st.shield) / f.maxHp)), 1); }
        }
        if (f.isPlayer) {
          ctx.fillStyle = col;
          ctx.fillRect(hx - 2, hy - 5, 5, 1); ctx.fillRect(hx - 1, hy - 4, 3, 1); ctx.fillRect(hx, hy - 3, 1, 1);
        }
        // Off-screen arrows.
        const sx = XS.isoX(f.x, f.y) + ox, sy = XS.isoY(f.x, f.y, f.z + f.height / 2) + oy;
        if (!f.isPlayer && (sx < 0 || sy < 0 || sx > W || sy > H)) {
          const cx = XS.clamp(sx, 6, W - 7), cy = XS.clamp(sy, 6, H - 7);
          const a = Math.atan2(sy - H / 2, sx - W / 2);
          ctx.fillStyle = '#0a0610';
          gfx.disc(ctx, cx, cy, 4, '#0a0610');
          gfx.disc(ctx, cx, cy, 3, col);
          ctx.fillStyle = '#0a0610';
          ctx.fillRect(Math.round(cx + Math.cos(a) * 2), Math.round(cy + Math.sin(a) * 2), 1, 1);
        }
      }
    }

    drawAim(ctx, f, aim, ox, oy) {
      const def = aim.def, col = aim.cancel ? '#ff4040' : def.ramp[3];
      const fx = XS.isoX(f.x, f.y) + ox, fy = XS.isoY(f.x, f.y, f.z) + oy;
      const dot = (x, y, z, i) => {
        if (!((i + Math.floor(this.time * 12)) % 3)) return;
        const sx = Math.round(XS.isoX(x, y) + ox), sy = Math.round(XS.isoY(x, y, z) + oy);
        ctx.fillStyle = '#0a0610'; ctx.fillRect(sx - 1, sy - 1, 3, 3);
        ctx.fillStyle = col; ctx.fillRect(sx, sy, 1, 1);
      };
      const z = f.z + 0.1;
      if (def.target === 'dir') {
        const range = def.form === 'dash' ? def.range : def.range;
        const n = Math.ceil(range * 3);
        const spreads = def.form === 'cone' ? [-def.angle / 2, def.angle / 2] : def.count > 1 && def.form !== 'beam' ? [-(def.count - 1) * 0.14, 0, (def.count - 1) * 0.14] : [0];
        for (const s of spreads) for (let i = 2; i <= n; i++) dot(f.x + Math.cos(aim.angle + s) * (i / 3), f.y + Math.sin(aim.angle + s) * (i / 3), z, i);
      } else if (def.target === 'point') {
        const d = XS.clamp(aim.dist, 1, def.range);
        const px = f.x + Math.cos(aim.angle) * d, py = f.y + Math.sin(aim.angle) * d;
        const g = this.arena.world.groundAt(px, py, f.z + 4, 0);
        const pz = g === -Infinity ? f.z : g;
        const r = def.form === 'rain' ? def.spread : def.form === 'mine' && def.count > 1 ? 2.2 : def.form === 'wall' ? 0.6 : def.form === 'summon' ? 1 : def.radius;
        for (let i = 2; i <= Math.ceil(d * 2); i++) dot(f.x + Math.cos(aim.angle) * (i / 2), f.y + Math.sin(aim.angle) * (i / 2), z, i);
        const sx = XS.isoX(px, py) + ox, sy = XS.isoY(px, py, pz) + oy;
        gfx.ellipseRing(ctx, sx, sy + 1, r * 5.66, r * 2.83, '#0a0610');
        gfx.ellipseRing(ctx, sx, sy, r * 5.66, r * 2.83, col, 3, Math.floor(this.time * 12));
        if (def.form === 'wall') {
          const L = def.length / 2, wx = -Math.sin(aim.angle), wy = Math.cos(aim.angle);
          gfx.line(ctx, XS.isoX(px - wx * L, py - wy * L) + ox, XS.isoY(px - wx * L, py - wy * L, pz) + oy, XS.isoX(px + wx * L, py + wy * L) + ox, XS.isoY(px + wx * L, py + wy * L, pz) + oy, col);
        }
      } else {
        const r = def.form === 'orbit' ? def.orbit : def.radius;
        gfx.ellipseRing(ctx, fx, fy + 1, r * 5.66, r * 2.83, '#0a0610');
        gfx.ellipseRing(ctx, fx, fy, r * 5.66, r * 2.83, col, 3, Math.floor(this.time * 12));
      }
    }
  }

  XS.Scene = Scene;
  XS.TEAM_COLORS = TEAM_COLORS;
})(globalThis.XS = globalThis.XS || {});
