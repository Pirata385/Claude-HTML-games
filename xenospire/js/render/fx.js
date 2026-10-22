// Visual effects: particles (sparks, embers, shards, smoke, voxel debris,
// creature parts), shockwave rings, floor lights, lightning, afterimages,
// floating numbers, screen shake and flashes. Listens to battle and world
// events. Every element has its own impact recipe so powers read at a glance.
(function (XS) {
  'use strict';

  const gfx = XS.gfx;
  const S = XS.ISO.S;
  const DEBRIS_CAP = [140, 320, 600];
  const PART_CAP = [260, 650, 1300];
  const FALLBACK = ['#5a1a08', '#e0601a', '#ffb040', '#fff0b0'];

  class FX {
    constructor(world, opts = {}) {
      this.world = world;
      this.parts = [];
      this.texts = [];
      this.bolts = [];
      this.rings = [];
      this.lights = [];
      this.ghosts = [];
      this.stars = [];
      this.quality = opts.quality != null ? opts.quality : 1;
      this.trauma = 0;
      this.kick = { x: 0, y: 0 };
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
      p.px = p.x; p.py = p.y; p.pz = p.z;
      this.parts.push(p);
      return p;
    }
    n(count) { return Math.max(1, Math.round(count * [0.4, 1, 1.5][this.quality])); }

    burst(x, y, z, ramp, n, speed = 6, opts = {}) {
      n = this.n(n);
      const R = this.rng;
      for (let i = 0; i < n; i++) {
        const a = R.range(0, Math.PI * 2), up = R.range(-0.2, 1);
        const s = speed * R.range(0.3, 1);
        this.add({
          kind: opts.kind || 'spark', x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: up * s * 0.8 + (opts.lift || 0),
          life: R.range(0.25, 0.6) * (opts.life || 1), color: ramp[R.int(1, ramp.length - 1)], size: opts.size || 1,
          grav: opts.grav != null ? opts.grav : 9, drag: opts.drag != null ? opts.drag : 2.5, glow: opts.glow,
        });
      }
    }
    smoke(x, y, z, n, color = '#b8b0c8', size = 1) {
      n = this.n(n);
      const R = this.rng;
      for (let i = 0; i < n; i++) {
        this.add({ kind: 'smoke', x: x + R.range(-0.6, 0.6), y: y + R.range(-0.6, 0.6), z: z + R.range(0, 0.6), vx: R.range(-0.8, 0.8), vy: R.range(-0.8, 0.8), vz: R.range(0.6, 1.8), life: R.range(0.5, 1.1), color, size: R.range(1.5, 3.2) * S * size, drag: 1.5 });
      }
    }
    // Shockwave ring on the ground: r grows from r0 to r1.
    ring(x, y, z, r1, color, life = 0.35, opts = {}) {
      this.rings.push({ x, y, z, r0: opts.r0 != null ? opts.r0 : r1 * 0.3, r1, color, life, age: 0, width: opts.width || 2, glow: opts.glow !== false, reverse: !!opts.reverse });
    }
    light(x, y, z, r, color, life = 0.3, intensity = 1) {
      if (this.quality === 0) return;
      this.lights.push({ x, y, z, r, color, life, age: 0, intensity });
    }
    star(x, y, z, size, color) { this.stars.push({ x, y, z, size, color, life: 0.14, age: 0 }); }
    text(x, y, z, str, color, big) {
      if (this.texts.length > 40) this.texts.shift();
      this.texts.push({ x, y, z, str: String(str), color, big: !!big, age: 0, life: big ? 1.4 : 0.85, ox: this.rng.range(-4, 4) * S });
    }
    shake(amount, dx = 0, dy = 0) {
      const k = this.settings.reduceMotion ? 0 : (this.settings.shake != null ? this.settings.shake : 1);
      this.trauma = Math.min(1, this.trauma + amount * k);
      if (dx || dy) {
        const l = Math.hypot(dx, dy) || 1;
        this.kick.x += (dx - dy) / l * amount * 6 * S * k;
        this.kick.y += (dx + dy) / l * amount * 3 * S * k;
      }
    }
    flashScreen(a, color = '#ffffff') {
      if (this.settings.reduceFlash) a *= 0.25;
      this.flash = Math.max(this.flash, a);
      this.flashColor = color;
    }
    // Afterimage: a flat-coloured copy of a rig's current silhouette.
    ghost(rig, color, life = 0.3) {
      const prims = [];
      for (let i = 0; i < rig.primCount; i++) {
        const p = rig.prims[i];
        if (p.k === 0 || p.k === 1) prims.push({ k: p.k, x: p.x, y: p.y, z: p.z, x1: p.x1, y1: p.y1, z1: p.z1, x2: p.x2, y2: p.y2, z2: p.z2, r: p.r });
      }
      this.ghosts.push({ prims, color, life, age: 0 });
      if (this.ghosts.length > 24) this.ghosts.shift();
    }

    debris(e, falling) {
      const d = e.def;
      if (!d) return;
      let live = 0;
      for (const p of this.parts) if (p.kind === 'cube') live++;
      if (live > DEBRIS_CAP[this.quality]) return;
      const R = this.rng;
      const cx = e.x + 0.5, cy = e.y + 0.5, cz = e.z + 0.5;
      if (falling) {
        this.add({ kind: 'cube', x: cx, y: cy, z: cz, vx: R.range(-0.6, 0.6), vy: R.range(-0.6, 0.6), vz: 0, life: 2.4, color: d.color, grav: 26, bounce: 0.25, drag: 0.4, size: 1, spin: R.range(-8, 8) });
        return;
      }
      const n = this.quality === 0 ? 1 : R.chance(0.6) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = R.range(0, Math.PI * 2), s = R.range(2, 8);
        this.add({ kind: 'cube', x: cx, y: cy, z: cz, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: R.range(3, 10), life: R.range(1, 1.8), color: d.color, grav: 26, bounce: 0.35, drag: 0.6, size: R.chance(0.35) ? 1 : 0.55, spin: R.range(-10, 10) });
      }
      if (R.chance(0.3)) this.smoke(cx, cy, cz, 1, XS.color.mix(d.color, '#ffffff', 0.4));
      if (d.emissive && R.chance(0.5)) this.burst(cx, cy, cz, [d.color, d.color, XS.color.lighten(d.color, 0.4), '#ffffff'], 3, 5, { kind: 'ember', glow: true });
    }

    // Break a rig into flying parts (KO "disassembly").
    disassemble(rig, x, y, dirX, dirY) {
      const R = this.rng;
      for (let i = 0; i < rig.primCount; i++) {
        const p = rig.prims[i];
        if (p.k !== 0 && p.k !== 1) continue;
        if (R.chance(this.quality === 0 ? 0.6 : 0.12)) continue;
        const a = Math.atan2(p.y - y, p.x - x) + R.range(-0.6, 0.6);
        const s = R.range(2, 9);
        this.add({
          kind: 'ball', x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s + dirX * 3, vy: Math.sin(a) * s + dirY * 3, vz: R.range(4, 12),
          life: R.range(1.4, 2.4), ramp: p.ramp, r: Math.max(0.2, Math.min(0.9, p.r)), grav: 24, bounce: 0.4, drag: 0.5,
        });
      }
    }

    // ---------------------------------------------------- element recipes
    // The signature look of every element when something lands.
    elementImpact(el, x, y, z, ramp, size = 1) {
      const R = this.rng;
      ramp = ramp || FALLBACK;
      const k = Math.max(0.5, size);
      this.light(x, y, z, 3.2 * k, ramp[2], 0.35, 1);
      this.star(x, y, z, 5 * S * k, ramp[3]);
      switch (el) {
        case 'plasma':
          this.burst(x, y, z, ramp, 12 * k, 7 * k, { kind: 'ember', glow: true, grav: -3, lift: 2, life: 1.2 });
          this.smoke(x, y, z, 3 * k, '#5a4040');
          break;
        case 'cryo':
          this.burst(x, y, z, ['#ffffff', '#bff4ff', '#8fd8ff', '#ffffff'], 12 * k, 9 * k, { kind: 'shard', grav: 14, life: 1.2 });
          this.burst(x, y, z, ramp, 8 * k, 3, { kind: 'px', grav: -1, life: 1.4 });
          this.ring(x, y, z - 0.4, 2.2 * k, '#dff8ff', 0.4);
          break;
        case 'gravity':
          for (let i = 0; i < this.n(14 * k); i++) {
            const a = R.range(0, Math.PI * 2), r = R.range(1.5, 3) * k;
            this.add({ kind: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: z + R.range(-0.3, 1), vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, vz: 0, life: 0.33, color: R.pick(ramp), glow: true });
          }
          this.ring(x, y, z - 0.4, 2.8 * k, ramp[2], 0.4, { r0: 2.8 * k, reverse: true });
          break;
        case 'void':
          for (let i = 0; i < this.n(12 * k); i++) {
            const a = R.range(0, Math.PI * 2), r = R.range(1.2, 2.6) * k;
            this.add({ kind: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z, vx: -Math.cos(a) * r * 3.5, vy: -Math.sin(a) * r * 3.5, vz: R.range(-1, 1), life: 0.3, color: R.pick([ramp[2], ramp[3]]), glow: true });
          }
          this.add({ kind: 'hole', x, y, z, vx: 0, vy: 0, vz: 0, life: 0.35, size: 6 * S * k, color: ramp[3] });
          break;
        case 'bio':
          this.burst(x, y, z, ramp, 12 * k, 6 * k, { kind: 'px', size: S, grav: 16, life: 1.1 });
          this.burst(x, y, z, ramp, 5 * k, 2, { kind: 'bubble', grav: -2, life: 1.4 });
          break;
        case 'arc':
          for (let i = 0; i < Math.round(3 * k); i++) {
            const a = R.range(0, Math.PI * 2), r = R.range(1.4, 2.6) * k;
            this.bolts.push({ pts: this.lightning({ x1: x, y1: y, z1: z, x2: x + Math.cos(a) * r, y2: y + Math.sin(a) * r, z2: z + R.range(-1, 1) }), color: '#ffffff', glow: ramp[2], life: 0.14, age: 0 });
          }
          this.burst(x, y, z, ramp, 10 * k, 10 * k, { glow: true, life: 0.6 });
          break;
        case 'crystal':
          this.burst(x, y, z, ramp, 12 * k, 8 * k, { kind: 'shard', grav: 18, life: 1.3 });
          this.burst(x, y, z, ['#ffffff', '#ffffff', ramp[3], ramp[2]], 6, 4, { kind: 'px', grav: 0, life: 0.6 });
          break;
        case 'sonic':
          for (let i = 0; i < 3; i++) this.ring(x, y, z - 0.3, (2 + i * 1.2) * k, i ? ramp[2] : ramp[3], 0.3 + i * 0.1, { r0: 0.3, width: 3 - i });
          this.smoke(x, y, z - 0.5, 4 * k, '#c8b090');
          break;
        case 'chrono':
          this.ring(x, y, z - 0.3, 2.5 * k, ramp[3], 0.5, { r0: 0.4 });
          this.ring(x, y, z - 0.3, 2.5 * k, ramp[2], 0.5, { r0: 2.5 * k, reverse: true });
          for (let i = 0; i < this.n(10); i++) {
            const a = (i / 10) * Math.PI * 2;
            this.add({ kind: 'spark', x: x + Math.cos(a) * 1.5 * k, y: y + Math.sin(a) * 1.5 * k, z, vx: -Math.sin(a) * 6, vy: Math.cos(a) * 6, vz: 0, life: 0.4, color: ramp[3] });
          }
          break;
        case 'psi':
          for (let i = 0; i < this.n(14 * k); i++) {
            const a = (i / 14) * Math.PI * 4, r = 0.2 + i * 0.12 * k;
            this.add({ kind: 'spark', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: z + i * 0.05, vx: -Math.sin(a) * 5, vy: Math.cos(a) * 5, vz: 1, life: 0.5, color: R.pick(ramp), glow: true });
          }
          this.ring(x, y, z - 0.3, 2 * k, ramp[3], 0.45);
          break;
        default:
          this.burst(x, y, z, ramp, 10 * k, 7 * k, { glow: true });
      }
    }

    // ---------------------------------------------------------- battle hooks
    attach(battle, hooks = {}) {
      const on = (t, fn) => battle.events.on(t, fn);
      on('hit', (e) => {
        if (e.amount < 0.5) return;
        const def = e.def;
        const ramp = def && def.ramp ? def.ramp : ['#888', '#ddd', '#fff', '#fff'];
        if (!e.dot) {
          const big = e.amount >= 20;
          this.star(e.x, e.y, e.z, (big ? 9 : 6) * S, big ? '#ffffff' : ramp[3]);
          this.burst(e.x, e.y, e.z, ramp, 6 + Math.min(16, e.amount / 3), 8, { glow: big });
          if (big) this.light(e.x, e.y, e.z, 2.5, ramp[2], 0.25, 0.9);
          const src = e.src;
          this.shake(Math.min(0.55, 0.06 + e.amount / 110) * (e.target.isPlayer ? 1.3 : 0.8), src ? e.target.x - src.x : 0, src ? e.target.y - src.y : 0);
        }
        if (this.settings.damageNumbers !== false) {
          const col = e.tag === 'fall' ? '#ff5050' : e.target.isPlayer ? '#ff7a7a' : e.dot ? '#c8ffa0' : (def && def.form !== 'basic' ? ramp[3] : '#ffffff');
          this.text(e.x, e.y, e.z + 0.8, Math.round(e.amount), col, e.amount >= 25);
        }
        if (e.target.isPlayer && hooks.playerHit) hooks.playerHit(e);
      });
      on('heal', (e) => {
        if (this.settings.damageNumbers !== false) this.text(e.f.x, e.f.y, e.f.z + e.f.height + 0.5, '+' + Math.round(e.amount), '#7dff8a');
        this.burst(e.f.x, e.f.y, e.f.z + e.f.height * 0.5, ['#2f8a2f', '#7dff8a', '#c8ffc8', '#ffffff'], 4, 2, { kind: 'px', grav: -4, life: 1 });
      });
      on('explosion', (e) => {
        const ramp = e.ramp || FALLBACK;
        const k = e.small ? 0.6 : Math.min(2.2, 0.6 + e.r * 0.35);
        this.elementImpact(e.el, e.x, e.y, e.z, ramp, k);
        this.ring(e.x, e.y, e.z - 0.4, e.r, ramp[2], 0.4, { width: e.small ? 2 : 3 });
        if (!e.small) {
          this.ring(e.x, e.y, e.z - 0.4, e.r * 1.25, ramp[3], 0.55, { width: 1 });
          this.burst(e.x, e.y, e.z, ramp, 10, 12, { glow: true, life: 0.8 });
          this.smoke(e.x, e.y, e.z, 4);
          this.light(e.x, e.y, e.z, e.r * 1.5, ramp[2], 0.5, 0.85);
        }
        this.shake(e.small ? 0.14 : Math.min(0.6, 0.25 + e.r * 0.06));
        if (!e.small && e.r > 3.5) this.flashScreen(0.14, ramp[3]);
      });
      on('impact', (e) => this.elementImpact(e.el, e.x, e.y, e.z, e.ramp, e.small ? 0.5 : 0.9));
      on('fizzle', (e) => { this.burst(e.x, e.y, e.z, e.ramp, 4, 3, { glow: true }); this.light(e.x, e.y, e.z, 1.5, e.ramp[2], 0.2); });
      on('ricochet', (e) => { this.burst(e.x, e.y, e.z, e.ramp, 6, 5, { glow: true }); this.star(e.x, e.y, e.z, 4 * S, e.ramp[3]); });
      on('chain', (e) => this.bolts.push({ pts: this.lightning(e), color: '#ffffff', glow: e.ramp[2], life: 0.22, age: 0 }));
      on('blink', (e) => {
        const ramp = e.ramp;
        this.elementImpact(null, e.x1, e.y1, e.z1 + 1, ramp, 0.8);
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          this.add({ kind: 'ember', x: XS.lerp(e.x1, e.x2, t), y: XS.lerp(e.y1, e.y2, t), z: XS.lerp(e.z1, e.z2, t) + 1.2, vx: 0, vy: 0, vz: 1, life: 0.3 + t * 0.3, color: ramp[2], glow: true });
        }
        this.ring(e.x2, e.y2, e.z2, 2.2, ramp[3], 0.35, { r0: 0.2 });
        if (e.f.rig) this.ghost(e.f.rig, ramp[2], 0.4);
      });
      on('vortex', (e) => {
        for (let i = 0; i < this.n(12); i++) {
          const a = this.rng.range(0, Math.PI * 2);
          this.add({ kind: 'spark', x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, z: e.z + 0.5, vx: -Math.cos(a) * e.r * 2.5 - Math.sin(a) * 4, vy: -Math.sin(a) * e.r * 2.5 + Math.cos(a) * 4, vz: 0, life: 0.4, color: '#c8b8ff', glow: true });
        }
        this.ring(e.x, e.y, e.z, e.r, '#8f6cf0', 0.45, { r0: e.r, reverse: true });
      });
      on('fall', (e) => { this.text(e.f.x, e.f.y, 4, XS.t('fall'), '#ff5050', true); this.shake(0.35); });
      on('respawn', (e) => { this.ring(e.f.x, e.f.y, e.f.z, 1.8, '#ffffff', 0.4); this.burst(e.f.x, e.f.y, e.f.z + 1, ['#888', '#fff', '#fff', '#fff'], 10, 4, { glow: true }); this.light(e.f.x, e.f.y, e.f.z, 2.5, '#ffffff', 0.4); });
      on('slam', (e) => { this.smoke(e.x, e.y, e.z, 4); this.star(e.x, e.y, e.z, 7 * S, '#ffffff'); this.shake(0.25); });
      on('status', (e) => {
        const label = e.type === 'freeze' ? 'CONGELADO' : e.type === 'root' ? 'ENRAIZADO' : 'ATORDOADO';
        this.text(e.f.x, e.f.y, e.f.z + e.f.height + 1, label, e.type === 'freeze' ? '#bff4ff' : e.type === 'root' ? '#ecd8b0' : '#ffe86a');
        if (e.type === 'freeze') this.burst(e.f.x, e.f.y, e.f.z + e.f.height * 0.5, ['#ffffff', '#bff4ff', '#8fd8ff', '#ffffff'], 10, 5, { kind: 'shard', grav: 10 });
      });
      on('enrage', (e) => { this.text(e.f.x, e.f.y, e.f.z + e.f.height + 1.5, 'FÚRIA!', '#ff4040', true); this.shake(0.5); this.flashScreen(0.3, '#ff3030'); this.ring(e.f.x, e.f.y, e.f.z, 4, '#ff4040', 0.6, { width: 3 }); });
      on('wall', (e) => {
        this.smoke(e.x, e.y, 3.5, 6);
        this.burst(e.x, e.y, 3.5, e.ramp, 14, 6, { glow: true, lift: 4 });
        this.light(e.x, e.y, 3, 3.5, e.ramp[2], 0.6);
        this.shake(0.2);
      });
      on('aura', (e) => {
        this.ring(e.f.x, e.f.y, e.f.z, e.def.radius, e.def.ramp[3], 0.5, { width: 3 });
        this.burst(e.f.x, e.f.y, e.f.z + 1, e.def.ramp, 14, 5, { kind: 'ember', glow: true, grav: -4, life: 1.2 });
        this.flashScreen(0.08, e.def.ramp[2]);
      });
      on('auraPulse', (e) => { this.ring(e.f.x, e.f.y, e.f.z + 0.2, e.def.radius, e.def.ramp[2], 0.35, { r0: 0.5 }); this.light(e.f.x, e.f.y, e.f.z, e.def.radius, e.def.ramp[2], 0.3, 0.8); });
      on('cast', (e) => {
        const f = e.f, ramp = e.def.ramp, z = f.z + f.height * 0.6;
        const hx = f.x + Math.cos(f.facing) * f.radius, hy = f.y + Math.sin(f.facing) * f.radius;
        this.star(hx, hy, z, 7 * S, ramp[3]);
        this.light(f.x, f.y, f.z, 2.4, ramp[2], 0.3, 1);
        this.burst(hx, hy, z, ramp, 8, 4, { kind: 'ember', glow: true, life: 0.7 });
        this.ring(f.x, f.y, f.z + 0.1, 1.6, ramp[2], 0.3, { r0: 0.4, width: 1 });
      });
      on('combo', (e) => {
        const ramp = e.ramp || e.def.ramp;
        this.star(e.x, e.y, e.z + 1, 10 * S, '#ffffff');
        this.ring(e.x, e.y, e.z + 0.1, 2.6, ramp[3], 0.45, { r0: 0.3, width: 2 });
        this.light(e.x, e.y, e.z, 3.5, ramp[2], 0.4, 1);
        this.burst(e.x, e.y, e.z + 0.8, ramp, 10, 6, { kind: 'ember', glow: true, lift: 2, life: 0.9 });
      });
      on('quake', (e) => {
        const f = e.f, ramp = e.def.ramp, R = this.rng;
        for (let k = 1; k <= 5; k++) {
          const rr = f.radius + (e.range * k) / 5, aa = e.angle + R.range(-e.spread / 2, e.spread / 2);
          const x = f.x + Math.cos(aa) * rr, y = f.y + Math.sin(aa) * rr;
          this.smoke(x, y, f.z, 2, '#a89880', 1.2);
          this.burst(x, y, f.z + 0.3, ['#3a2a1c', '#6a4a2a', '#b08a5a', ramp[3]], 5, 5, { kind: 'px', grav: 20, lift: 5, life: 1 });
        }
        this.ring(f.x + Math.cos(e.angle) * e.range * 0.5, f.y + Math.sin(e.angle) * e.range * 0.5, f.z + 0.1, e.range * 0.7, ramp[2], 0.4, { r0: 0.5, width: 3 });
        this.shake(0.45, Math.cos(e.angle), Math.sin(e.angle));
      });
      on('spike', (e) => {
        const ramp = e.def.ramp;
        this.burst(e.x, e.y, e.z + 1, ramp, 5, 6, { kind: 'shard', grav: 18, lift: 6, life: 0.8 });
        if (this.rng.chance(0.5)) this.smoke(e.x, e.y, e.z, 1, '#a89880');
        this.light(e.x, e.y, e.z, 1.8, ramp[2], 0.25, 0.8);
        this.shake(0.06);
      });
      on('land', (e) => {
        this.smoke(e.x, e.y, e.z, e.small ? 1 : 2);
        if (e.splash) this.ring(e.x, e.y, e.z + 0.1, e.splash, e.ramp[3], 0.4, { r0: 0.4, width: 2 });
        else this.burst(e.x, e.y, e.z + 0.3, e.ramp, 4, 3, { glow: true });
      });
      on('meteor', (e) => {
        this.shake(0.85);
        this.flashScreen(0.18, e.def.ramp[3]);
        this.ring(e.x, e.y, e.z, e.r * 1.6, '#ffffff', 0.7, { r0: e.r * 0.5, width: 3 });
        this.smoke(e.x, e.y, e.z, 10, '#8a7a70', 1.6);
        this.burst(e.x, e.y, e.z + 0.5, ['#2a1c10', '#6a4a2a', e.def.ramp[2], e.def.ramp[3]], 24, 12, { kind: 'px', grav: 20, lift: 6, life: 1.4 });
      });
      on('drill', (e) => this.burst(e.x, e.y, e.z, ['#ffffff', e.ramp[3], e.ramp[2], '#ffe8a0'], 3, 7, { life: 0.4 }));
      on('echo', (e) => this.ring(e.f.x, e.f.y, e.f.z + 0.1, 2, e.def.ramp[3], 0.35, { r0: 0.3, width: 1 }));
      on('dodge', (e) => { this.smoke(e.f.x, e.f.y, e.f.z, 2, '#d8d0e8'); if (e.f.rig) this.ghost(e.f.rig, '#d8e8ff', 0.25); });
      on('pull', (e) => this.bolts.push({ pts: this.lightning({ x1: e.f.x, y1: e.f.y, z1: e.f.z + 1, x2: e.by.x, y2: e.by.y, z2: e.by.z + 1 }), color: '#ffffff', glow: '#c8c8ff', life: 0.25, age: 0 }));
      on('grapple', (e) => this.bolts.push({ pts: this.lightning({ x1: e.f.x, y1: e.f.y, z1: e.f.z + 1, x2: e.x, y2: e.y, z2: e.f.z + 1 }), color: '#ffffff', glow: '#c8c8ff', life: 0.25, age: 0 }));
      on('swing', (e) => {
        const f = e.f, r = f.basic.def.range, a = f.facing;
        for (let i = 0; i < 7; i++) {
          const aa = a + (i - 3) * 0.24;
          this.add({ kind: 'spark', x: f.x + Math.cos(aa) * r * 0.85, y: f.y + Math.sin(aa) * r * 0.85, z: f.z + f.height * 0.5, vx: -Math.sin(aa) * 6, vy: Math.cos(aa) * 6, vz: 0, life: 0.14, color: '#ffffff', size: 1 });
        }
      });
      on('ko', (e) => {
        const f = e.f;
        if (f.rig) this.disassemble(f.rig, f.x, f.y, f.kx * 0.1, f.ky * 0.1);
        this.text(f.x, f.y, f.z + f.height + 1, XS.t('ko'), '#ffe066', true);
        this.ring(f.x, f.y, f.z, 4, '#ffffff', 0.6, { width: 3 });
        this.light(f.x, f.y, f.z, 5, '#ffe9a8', 0.8, 1.4);
        this.star(f.x, f.y, f.z + f.height * 0.5, 16 * S, '#ffffff');
        this.shake(0.8);
        this.flashScreen(0.3);
      });
    }

    lightning(e) {
      const pts = [];
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const t = i / n, j = i === 0 || i === n ? 0 : 0.45;
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
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; if (p.kind === 'smoke' || p.kind === 'ember') p.vz *= k; }
        p.px = p.x; p.py = p.y; p.pz = p.z;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.bounce != null) {
          const g = w.groundAt(p.x, p.y, p.pz + 0.2, 0.3);
          if (g !== -Infinity && p.z < g && p.pz >= g - 0.3) {
            p.z = g; p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6;
            if (Math.abs(p.vz) < 1.5) { p.vz = 0; p.spin = 0; }
          }
        }
      }
      this.parts = this.parts.filter((p) => p.age < p.life && p.z > -40);
      for (const list of [this.texts, this.bolts, this.rings, this.lights, this.ghosts, this.stars]) for (const t of list) t.age += dt;
      this.texts = this.texts.filter((t) => t.age < t.life);
      this.bolts = this.bolts.filter((b) => b.age < b.life);
      this.rings = this.rings.filter((r) => r.age < r.life);
      this.lights = this.lights.filter((l) => l.age < l.life);
      this.ghosts = this.ghosts.filter((g) => g.age < g.life);
      this.stars = this.stars.filter((s) => s.age < s.life);
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      const kk = Math.exp(-12 * dt);
      this.kick.x *= kk; this.kick.y *= kk;
      this.flash = Math.max(0, this.flash - dt * 5);
    }

    shakeOffset(time) {
      const t = this.trauma * this.trauma * 7 * S;
      return { x: Math.round(Math.sin(time * 61) * t + this.kick.x), y: Math.round(Math.cos(time * 53) * t + this.kick.y) };
    }

    // ---------------------------------------------------------- drawing
    cubeSprite(color, size) {
      const key = color + size;
      let s = this.cubeCache.get(key);
      if (!s) {
        const w = Math.max(2, Math.round((size >= 1 ? 4 : 2) * S));
        s = gfx.makeCanvas(w, w);
        const g = s.getContext('2d');
        g.fillStyle = XS.color.lighten(color, 0.15); g.fillRect(0, 0, w, w / 2);
        g.fillStyle = color; g.fillRect(0, w / 2, w / 2, w / 2);
        g.fillStyle = XS.color.darken(color, 0.25); g.fillRect(w / 2, w / 2, w / 2, w / 2);
        this.cubeCache.set(key, s);
      }
      return s;
    }

    drawPart(ctx, p, ox, oy) {
      const sx = Math.round(XS.isoX(p.x, p.y) + ox), sy = Math.round(XS.isoY(p.x, p.y, p.z) + oy);
      const k = 1 - p.age / p.life;
      switch (p.kind) {
        case 'spark': {
          const px = Math.round(XS.isoX(p.px, p.py) + ox), py = Math.round(XS.isoY(p.px, p.py, p.pz) + oy);
          // Stretch the streak so fast sparks read as motion.
          const ex = sx + (sx - px), ey = sy + (sy - py);
          gfx.line(ctx, px, py, ex, ey, p.color);
          if (p.glow && this.quality) gfx.glow(ctx, sx, sy, 4 * S, p.color, 0.6 * k);
          break;
        }
        case 'ember': {
          const r = Math.max(1, (p.size || 1) * S * (0.4 + k * 0.8));
          gfx.disc(ctx, sx, sy, r, k > 0.5 ? p.color : XS.color.darken(p.color, 0.3));
          if (this.quality) gfx.glow(ctx, sx, sy, 5 * S * (0.5 + k), p.color, 0.7 * k);
          break;
        }
        case 'shard': {
          const a = p.age * 18 + p.x * 7;
          const L = 2.5 * S * (0.5 + k * 0.5);
          gfx.thickLine(ctx, sx - Math.cos(a) * L, sy - Math.sin(a) * L * 0.6, sx + Math.cos(a) * L, sy + Math.sin(a) * L * 0.6, 0.5 * S, p.color);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(sx, sy, S, S);
          break;
        }
        case 'bubble':
          gfx.ellipseRing(ctx, sx, sy, 1.5 * S * (1.4 - k * 0.4), 1.5 * S * (1.4 - k * 0.4), p.color);
          break;
        case 'hole': {
          const r = p.size * (k < 0.5 ? k * 2 : 1);
          gfx.glow(ctx, sx, sy, r * 2.2, p.color, 0.8);
          gfx.disc(ctx, sx, sy, r, '#05020a');
          break;
        }
        case 'smoke': {
          const r = p.size * (1 + (1 - k)), a = k * 0.6;
          gfx.ellipse(ctx, sx, sy, r, r, gfx.ditherPattern(ctx, p.color, a));
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
          gfx.ball(ctx, sx, sy, Math.max(S, p.r * XS.PXU), p.ramp);
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.fillRect(sx, sy, (p.size || 1) * (S > 1 ? 2 : 1), (p.size || 1) * (S > 1 ? 2 : 1));
      }
    }

    // Additive light pools on the floor (drawn after the world).
    drawLights(ctx, ox, oy, extra) {
      if (this.quality === 0) return;
      const pool = (x, y, z, r, color, a) => {
        const sx = XS.isoX(x, y) + ox, sy = XS.isoY(x, y, z) + oy;
        gfx.glow(ctx, sx, sy, r * XS.ELX * 1.4, color, a, 0.5);
      };
      for (const l of this.lights) {
        const k = 1 - l.age / l.life;
        pool(l.x, l.y, l.z, l.r * (0.7 + 0.3 * k), l.color, Math.min(0.85, l.intensity * k));
      }
      if (extra) for (const l of extra) pool(l.x, l.y, l.z, l.r, l.color, l.a);
    }

    drawGhosts(ctx, ox, oy) {
      for (const g of this.ghosts) {
        const k = 1 - g.age / g.life;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * k * 0.55;
        for (const p of g.prims) {
          if (p.k === 0) gfx.disc(ctx, XS.isoX(p.x, p.y) + ox, XS.isoY(p.x, p.y, p.z) + oy, Math.max(S, p.r * XS.PXU), g.color);
          else gfx.thickLine(ctx, XS.isoX(p.x1, p.y1) + ox, XS.isoY(p.x1, p.y1, p.z1) + oy, XS.isoX(p.x2, p.y2) + ox, XS.isoY(p.x2, p.y2, p.z2) + oy, Math.max(S * 0.5, p.r * XS.PXU), g.color);
        }
        ctx.globalAlpha = prev;
      }
    }

    drawOverlay(ctx, ox, oy) {
      for (const r of this.rings) {
        const k = r.age / r.life, sx = XS.isoX(r.x, r.y) + ox, sy = XS.isoY(r.x, r.y, r.z) + oy;
        const t = r.reverse ? 1 - XS.easeOutCubic(k) : XS.easeOutCubic(k);
        const rr = r.r0 + (r.r1 - r.r0) * t;
        if (rr <= 0.05) continue;
        const fade = 1 - k;
        if (r.glow && this.quality) gfx.glow(ctx, sx, sy, rr * XS.ELX * 1.2, r.color, 0.35 * fade, 0.5);
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * Math.min(1, fade * 1.6);
        const wd = Math.max(1, Math.round(r.width * S * fade));
        for (let i = 0; i < wd; i++) gfx.ellipseRing(ctx, sx, sy, rr * XS.ELX - i, rr * XS.ELY - i * 0.5, i === 0 ? '#ffffff' : r.color);
        ctx.globalAlpha = prev;
      }
      for (const b of this.bolts) {
        const pts = b.pts.map((p) => [XS.isoX(p.x, p.y) + ox, XS.isoY(p.x, p.y, p.z) + oy]);
        const flick = Math.floor(b.age * 40) % 2;
        for (let i = 1; i < pts.length; i++) {
          gfx.thickLine(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], S * (flick ? 1.2 : 0.8), b.glow);
          gfx.line(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], b.color);
        }
        if (this.quality) for (let i = 0; i < pts.length; i += 3) gfx.glow(ctx, pts[i][0], pts[i][1], 6 * S, b.glow, 0.5);
      }
      for (const s of this.stars) {
        const k = 1 - s.age / s.life;
        const sx = Math.round(XS.isoX(s.x, s.y) + ox), sy = Math.round(XS.isoY(s.x, s.y, s.z) + oy);
        const L = s.size * (0.6 + 0.4 * k);
        gfx.glow(ctx, sx, sy, L * 1.4, s.color, k);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - Math.round(L), sy, Math.round(L * 2) + 1, Math.max(1, S >> 1));
        ctx.fillRect(sx, sy - Math.round(L * 0.7), Math.max(1, S >> 1), Math.round(L * 1.4) + 1);
      }
      for (const t of this.texts) {
        const k = t.age / t.life;
        const sx = XS.isoX(t.x, t.y) + ox + t.ox, sy = XS.isoY(t.x, t.y, t.z) + oy - XS.easeOutCubic(Math.min(1, k * 1.5)) * 10 * S;
        if (k > 0.75 && Math.floor(t.age * 20) % 2) continue;
        const pop = t.big && k < 0.12 ? 1 : 0;
        const scale = (t.big ? S + 1 : S) + pop;
        gfx.text(ctx, t.str, sx, sy - scale * 2.5, t.color, 'center', '#0a0610', scale);
      }
    }

    drawFlash(ctx, W, H) {
      if (this.flash <= 0.01) return;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = Math.min(0.35, this.flash * 0.6);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = prev;
    }
  }

  XS.FX = FX;
})(globalThis.XS = globalThis.XS || {});
