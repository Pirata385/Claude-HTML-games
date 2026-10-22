// Visual effects: particles (sparks, smoke, voxel debris, creature parts),
// floating numbers, lightning, screen shake and flashes. Listens to battle and
// world events; drawing is split into depth-bucketed world particles and
// overlays.
(function (XS) {
  'use strict';

  const gfx = XS.gfx;
  const DEBRIS_CAP = [140, 320, 600];
  const PART_CAP = [220, 520, 1000];

  class FX {
    constructor(world, opts = {}) {
      this.world = world;
      this.parts = [];
      this.texts = [];
      this.bolts = [];
      this.rings = [];
      this.quality = opts.quality != null ? opts.quality : 1;
      this.trauma = 0;
      this.flash = 0;
      this.flashColor = '#ffffff';
      this.settings = opts.settings || {};
      this.cubeCache = new Map();
      this.rng = new XS.RNG(XS.hash(77, 'fx'));
      this.unsub = [];
      this.unsub.push(world.events.on('break', (e) => this.debris(e, false)));
      this.unsub.push(world.events.on('fall', (e) => this.debris(e, true)));
    }

    dispose() { for (const u of this.unsub) u(); this.unsub = []; }

    // ---------------------------------------------------------- spawning
    add(p) {
      if (this.parts.length >= PART_CAP[this.quality]) {
        if (p.kind === 'cube' || p.kind === 'ball') this.parts.shift(); else return null;
      }
      p.age = 0;
      p.grav = p.grav != null ? p.grav : 0;
      p.drag = p.drag != null ? p.drag : 0;
      this.parts.push(p);
      return p;
    }
    burst(x, y, z, ramp, n, speed = 6, opts = {}) {
      n = Math.round(n * [0.45, 1, 1.6][this.quality]);
      for (let i = 0; i < n; i++) {
        const a = this.rng.range(0, Math.PI * 2), up = this.rng.range(-0.2, 1);
        const s = speed * this.rng.range(0.3, 1);
        this.add({
          kind: opts.kind || 'spark', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: up * s * 0.8,
          life: this.rng.range(0.25, 0.6) * (opts.life || 1), color: ramp[this.rng.int(1, ramp.length - 1)], size: opts.size || 1,
          grav: opts.grav != null ? opts.grav : 9, drag: 2.5,
        });
      }
    }
    smoke(x, y, z, n, color = '#b8b0c8') {
      n = Math.round(n * [0.4, 1, 1.4][this.quality]);
      for (let i = 0; i < n; i++) {
        this.add({ kind: 'smoke', x: x + this.rng.range(-0.6, 0.6), y: y + this.rng.range(-0.6, 0.6), z: z + this.rng.range(0, 0.6), vx: this.rng.range(-0.8, 0.8), vy: this.rng.range(-0.8, 0.8), vz: this.rng.range(0.6, 1.8), life: this.rng.range(0.5, 1.1), color, size: this.rng.range(1.5, 3.2), drag: 1.5 });
      }
    }
    ring(x, y, z, r, color, life = 0.35) { this.rings.push({ x, y, z, r, color, life, age: 0 }); }
    text(x, y, z, str, color, big) {
      if (this.texts.length > 40) this.texts.shift();
      this.texts.push({ x, y, z, str: String(str), color, big: !!big, age: 0, life: big ? 1.4 : 0.8, ox: this.rng.range(-3, 3) });
    }
    shake(amount) {
      const k = this.settings.reduceMotion ? 0 : (this.settings.shake != null ? this.settings.shake : 1);
      this.trauma = Math.min(1, this.trauma + amount * k);
    }
    flashScreen(a, color = '#ffffff') {
      if (this.settings.reduceFlash) a *= 0.25;
      this.flash = Math.max(this.flash, a);
      this.flashColor = color;
    }

    debris(e, falling) {
      const d = e.def;
      if (!d) return;
      const live = this.parts.reduce((n, p) => n + (p.kind === 'cube' ? 1 : 0), 0);
      if (live > DEBRIS_CAP[this.quality]) return;
      const cx = e.x + 0.5, cy = e.y + 0.5, cz = e.z + 0.5;
      if (falling) {
        this.add({ kind: 'cube', x: cx, y: cy, z: cz, vx: this.rng.range(-0.6, 0.6), vy: this.rng.range(-0.6, 0.6), vz: 0, life: 2.4, color: d.color, grav: 26, bounce: 0.25, drag: 0.4, size: 1 });
        return;
      }
      const n = this.quality === 0 ? 1 : this.rng.chance(0.6) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = this.rng.range(0, Math.PI * 2), s = this.rng.range(2, 7);
        this.add({ kind: 'cube', x: cx, y: cy, z: cz, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: this.rng.range(3, 9), life: this.rng.range(1, 1.8), color: d.color, grav: 26, bounce: 0.35, drag: 0.6, size: this.rng.chance(0.3) ? 1 : 0.5 });
      }
      if (this.rng.chance(0.35)) this.smoke(cx, cy, cz, 1, XS.color.mix(d.color, '#ffffff', 0.4));
    }

    // Break a rig into flying parts (KO "disassembly").
    disassemble(rig, x, y, dirX, dirY) {
      for (let i = 0; i < rig.primCount; i++) {
        const p = rig.prims[i];
        if (p.k !== 0 && p.k !== 1) continue;
        if (this.rng.chance(this.quality === 0 ? 0.6 : 0.15)) continue;
        const a = Math.atan2(p.y - y, p.x - x) + this.rng.range(-0.6, 0.6);
        const s = this.rng.range(2, 8);
        this.add({
          kind: 'ball', x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s + dirX * 3, vy: Math.sin(a) * s + dirY * 3, vz: this.rng.range(4, 11),
          life: this.rng.range(1.4, 2.4), ramp: p.ramp, r: Math.max(0.2, Math.min(0.9, p.r)), grav: 24, bounce: 0.4, drag: 0.5,
        });
      }
    }

    // ---------------------------------------------------------- battle hooks
    attach(battle, hooks = {}) {
      const ev = battle.events;
      const on = (t, fn) => ev.on(t, fn);
      on('hit', (e) => {
        if (e.amount < 0.5) return;
        const ramp = e.def && e.def.ramp ? e.def.ramp : ['#888', '#ddd', '#fff', '#fff'];
        if (!e.dot) this.burst(e.x, e.y, e.z, ramp, 6 + Math.min(14, e.amount / 3), 7);
        if (this.settings.damageNumbers !== false) {
          const col = e.tag === 'fall' ? '#ff5050' : e.target.isPlayer ? '#ff7a7a' : e.dot ? '#c8ffa0' : (e.def && e.def.form !== 'basic' ? ramp[3] : '#ffffff');
          this.text(e.x, e.y, e.z + 0.8, Math.round(e.amount), col, e.amount >= 25);
        }
        if (!e.dot) this.shake(Math.min(0.5, 0.06 + e.amount / 120) * (e.target.isPlayer ? 1.3 : 0.8));
        if (e.target.isPlayer && hooks.playerHit) hooks.playerHit(e);
      });
      on('heal', (e) => { if (this.settings.damageNumbers !== false) this.text(e.f.x, e.f.y, e.f.z + e.f.height + 0.5, '+' + Math.round(e.amount), '#7dff8a'); });
      on('explosion', (e) => {
        const ramp = e.ramp || ['#5a1a08', '#e0601a', '#ffb040', '#fff0b0'];
        this.burst(e.x, e.y, e.z, ramp, e.small ? 8 : 18, e.small ? 6 : 10);
        this.smoke(e.x, e.y, e.z, e.small ? 2 : 5);
        this.ring(e.x, e.y, e.z - 0.4, e.r, ramp[2], 0.35);
        this.shake(e.small ? 0.12 : 0.3);
        if (!e.small && e.r > 3) this.flashScreen(0.18, ramp[3]);
      });
      on('impact', (e) => { this.burst(e.x, e.y, e.z, e.ramp || ['#666', '#aaa', '#fff', '#fff'], e.small ? 4 : 8, 5); });
      on('fizzle', (e) => { this.burst(e.x, e.y, e.z, e.ramp, 3, 3); });
      on('ricochet', (e) => { this.burst(e.x, e.y, e.z, e.ramp, 4, 4); });
      on('chain', (e) => this.bolts.push({ pts: this.lightning(e), color: e.ramp[3], glow: e.ramp[2], life: 0.18, age: 0 }));
      on('blink', (e) => {
        for (let i = 0; i <= 8; i++) {
          const t = i / 8;
          this.add({ kind: 'spark', x: XS.lerp(e.x1, e.x2, t), y: XS.lerp(e.y1, e.y2, t), z: XS.lerp(e.z1, e.z2, t) + 1.2, vx: 0, vy: 0, vz: 1, life: 0.35 + t * 0.2, color: e.ramp[2], size: 2 });
        }
      });
      on('vortex', (e) => {
        for (let i = 0; i < 10; i++) {
          const a = this.rng.range(0, Math.PI * 2);
          this.add({ kind: 'spark', x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, z: e.z + 0.5, vx: -Math.cos(a) * e.r * 2.5, vy: -Math.sin(a) * e.r * 2.5, vz: 0, life: 0.4, color: '#c8b8ff', size: 1 });
        }
      });
      on('fall', (e) => { this.text(e.f.x, e.f.y, 4, XS.t('fall'), '#ff5050', true); this.shake(0.35); });
      on('respawn', (e) => { this.ring(e.f.x, e.f.y, e.f.z, 1.5, '#ffffff', 0.4); this.burst(e.f.x, e.f.y, e.f.z + 1, ['#888', '#fff', '#fff', '#fff'], 10, 4); });
      on('slam', (e) => { this.smoke(e.x, e.y, e.z, 3); this.shake(0.2); });
      on('status', (e) => {
        const label = e.type === 'freeze' ? 'CONGELADO' : 'ATORDOADO';
        this.text(e.f.x, e.f.y, e.f.z + e.f.height + 1, label, e.type === 'freeze' ? '#bff4ff' : '#ffe86a');
      });
      on('enrage', (e) => { this.text(e.f.x, e.f.y, e.f.z + e.f.height + 1.5, 'FÚRIA!', '#ff4040', true); this.shake(0.5); this.flashScreen(0.3, '#ff3030'); });
      on('wall', (e) => this.smoke(e.x, e.y, 3.5, 6));
      on('aura', (e) => this.ring(e.f.x, e.f.y, e.f.z, e.def.radius, e.def.ramp[2], 0.5));
      on('auraPulse', (e) => this.ring(e.f.x, e.f.y, e.f.z + 0.2, e.def.radius, e.def.ramp[1], 0.3));
      on('cast', (e) => this.burst(e.f.x, e.f.y, e.f.z + e.f.height * 0.6, e.def.ramp, 6, 3, { life: 0.6 }));
      on('dodge', (e) => this.smoke(e.f.x, e.f.y, e.f.z, 2, '#d8d0e8'));
      on('swing', (e) => {
        const f = e.f, r = f.basic.def.range;
        const a = f.facing;
        for (let i = 0; i < 5; i++) {
          const aa = a + (i - 2) * 0.3;
          this.add({ kind: 'spark', x: f.x + Math.cos(aa) * r * 0.8, y: f.y + Math.sin(aa) * r * 0.8, z: f.z + f.height * 0.5, vx: -Math.sin(aa) * 4, vy: Math.cos(aa) * 4, vz: 0, life: 0.15, color: '#ffffff', size: 1 });
        }
      });
      on('ko', (e) => {
        if (e.f.rig) this.disassemble(e.f.rig, e.f.x, e.f.y, e.f.kx * 0.1, e.f.ky * 0.1);
        this.text(e.f.x, e.f.y, e.f.z + e.f.height + 1, XS.t('ko'), '#ffe066', true);
        this.shake(0.7);
        this.flashScreen(0.35);
      });
    }

    lightning(e) {
      const pts = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const t = i / n, j = i === 0 || i === n ? 0 : 0.5;
        pts.push({ x: XS.lerp(e.x1, e.x2, t) + this.rng.range(-j, j), y: XS.lerp(e.y1, e.y2, t) + this.rng.range(-j, j), z: XS.lerp(e.z1, e.z2, t) + this.rng.range(-j, j) });
      }
      return pts;
    }

    // ---------------------------------------------------------- update
    update(dt) {
      const w = this.world;
      for (const p of this.parts) {
        p.age += dt;
        p.vz -= p.grav * dt;
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; if (p.kind === 'smoke') p.vz *= k; }
        p.px = p.x; p.py = p.y; p.pz = p.z;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.bounce != null) {
          const g = w.groundAt(p.x, p.y, p.pz + 0.2, 0.3);
          if (g !== -Infinity && p.z < g && p.pz >= g - 0.3) {
            p.z = g; p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6;
            if (Math.abs(p.vz) < 1.5) p.vz = 0;
          }
        }
      }
      this.parts = this.parts.filter((p) => p.age < p.life && p.z > -40);
      for (const t of this.texts) t.age += dt;
      this.texts = this.texts.filter((t) => t.age < t.life);
      for (const b of this.bolts) b.age += dt;
      this.bolts = this.bolts.filter((b) => b.age < b.life);
      for (const r of this.rings) r.age += dt;
      this.rings = this.rings.filter((r) => r.age < r.life);
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      this.flash = Math.max(0, this.flash - dt * 3);
    }

    shakeOffset(time) {
      const t = this.trauma * this.trauma * 7;
      return { x: Math.round(Math.sin(time * 61) * t), y: Math.round(Math.cos(time * 53) * t) };
    }

    // ---------------------------------------------------------- drawing
    cubeSprite(color, size) {
      const key = color + size;
      let s = this.cubeCache.get(key);
      if (!s) {
        const w = size >= 1 ? 4 : 2, h = size >= 1 ? 4 : 2;
        s = gfx.makeCanvas(w, h);
        const g = s.getContext('2d');
        g.fillStyle = XS.color.lighten(color, 0.15); g.fillRect(0, 0, w, h / 2);
        g.fillStyle = color; g.fillRect(0, h / 2, w / 2, h / 2);
        g.fillStyle = XS.color.darken(color, 0.25); g.fillRect(w / 2, h / 2, w / 2, h / 2);
        this.cubeCache.set(key, s);
      }
      return s;
    }

    bucketKey(p, maxD) { return XS.clamp(Math.floor(p.x) + Math.floor(p.y), 0, maxD); }

    drawPart(ctx, p, ox, oy) {
      const sx = Math.round(XS.isoX(p.x, p.y) + ox), sy = Math.round(XS.isoY(p.x, p.y, p.z) + oy);
      const k = 1 - p.age / p.life;
      switch (p.kind) {
        case 'spark': {
          ctx.fillStyle = p.color;
          const px = Math.round(XS.isoX(p.px, p.py) + ox), py = Math.round(XS.isoY(p.px, p.py, p.pz) + oy);
          if (p.size >= 2 && k > 0.5) ctx.fillRect(sx - 1, sy - 1, 2, 2);
          else gfx.line(ctx, px, py, sx, sy, p.color);
          break;
        }
        case 'smoke': {
          const r = p.size * (1 + (1 - k)), a = k * 0.6;
          ctx.fillStyle = gfx.ditherPattern(ctx, p.color, a);
          gfx.ellipse(ctx, sx, sy, r, r, ctx.fillStyle);
          break;
        }
        case 'cube': {
          if (k < 0.25 && Math.floor(p.age * 20) % 2) break;
          const s = this.cubeSprite(p.color, p.size);
          ctx.drawImage(s, sx - (s.width >> 1), sy - (s.height >> 1));
          break;
        }
        case 'ball':
          if (k < 0.2 && Math.floor(p.age * 20) % 2) break;
          gfx.ball(ctx, sx, sy, Math.max(1, p.r * 4.4), p.ramp);
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, p.size || 1, p.size || 1);
      }
    }

    drawOverlay(ctx, ox, oy) {
      for (const r of this.rings) {
        const k = r.age / r.life, sx = XS.isoX(r.x, r.y) + ox, sy = XS.isoY(r.x, r.y, r.z) + oy;
        const rr = r.r * (0.4 + 0.6 * XS.easeOutCubic(k));
        gfx.ellipseRing(ctx, sx, sy, rr * 5.66, rr * 2.83, r.color);
        if (k < 0.5) gfx.ellipseRing(ctx, sx, sy, rr * 5.66 - 1, rr * 2.83 - 1, r.color);
      }
      for (const b of this.bolts) {
        const pts = b.pts.map((p) => [XS.isoX(p.x, p.y) + ox, XS.isoY(p.x, p.y, p.z) + oy]);
        for (let i = 1; i < pts.length; i++) {
          gfx.thickLine(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1, b.glow);
          gfx.line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], b.color);
        }
      }
      for (const t of this.texts) {
        const k = t.age / t.life;
        const sx = XS.isoX(t.x, t.y) + ox + t.ox, sy = XS.isoY(t.x, t.y, t.z) + oy - XS.easeOutCubic(Math.min(1, k * 1.5)) * 10;
        if (k > 0.75 && Math.floor(t.age * 20) % 2) continue;
        gfx.text(ctx, t.str, sx, sy, t.color, 'center', '#0a0610');
        if (t.big) gfx.text(ctx, t.str, sx + 1, sy, t.color, 'center');
      }
    }

    drawFlash(ctx, W, H) {
      if (this.flash <= 0.01) return;
      ctx.fillStyle = gfx.ditherPattern(ctx, this.flashColor, Math.min(0.8, this.flash));
      ctx.fillRect(0, 0, W, H);
    }
  }

  XS.FX = FX;
})(globalThis.XS = globalThis.XS || {});
