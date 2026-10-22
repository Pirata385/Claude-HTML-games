// Draws an arena with an optional battle: background, tower, terrain bands
// interleaved with depth-bucketed entities (with a see-through window in
// whatever stands between the camera and the player), additive light pools,
// then overlays (zones, telegraphs, beams, aim preview, bars, numbers,
// off-screen arrows).
(function (XS) {
  'use strict';

  const gfx = XS.gfx;
  const S = XS.ISO.S;
  const TEAM_COLORS = ['#5ff0c8', '#ff6a6a', '#ffb24a', '#c88aff', '#6ab8ff'];
  const el0 = (def) => (def && def.elements && def.elements[0]) || null;
  const TAU = Math.PI * 2;
  const DIRT = ['#3a2a1c', '#6a4a2a', '#8a6a44', '#b08a5a'];
  // Power objects drawn in the depth buckets (between terrain bands).
  const BUCKETED = new Set(['proj', 'turret', 'mine', 'lob', 'bomb', 'wave', 'tornado', 'sing']);

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
      this.windowK = 0;     // see-through window opening (0..1)
      this.dynLights = [];
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
      battle.events.on('turretShot', (e) => this.fx.star(e.o.x, e.o.y, e.o.z, 5 * S, e.o.def.ramp[3]));
    }

    dispose() { this.fx.dispose(); }

    rigState(f) {
      return { x: f.x, y: f.y, z: f.z, facing: f.facing, vx: f.vx + f.kx * 0.3, vy: f.vy + f.ky * 0.3, airborne: !f.grounded, aimAngle: f.aimAngle };
    }

    // ------------------------------------------------------------ update
    update(dt) {
      this.time += dt;
      const b = this.battle, fx = this.fx, R = fx.rng, q = fx.quality;
      if (b) {
        for (const f of b.fighters) if (f.alive && f.rig) f.rig.update(dt, this.rigState(f));
        for (const o of b.objects) {
          const def = o.def, ramp = def && def.ramp, el = el0(def);
          switch (o.kind) {
            case 'proj': {
              (o._trail || (o._trail = [])).push({ x: o.x, y: o.y, z: o.z });
              if (o._trail.length > (def.form === 'sniper' ? 12 : 8)) o._trail.shift();
              if (o.burrow) {
                fx.add({ kind: 'px', x: o.x + R.range(-0.3, 0.3), y: o.y + R.range(-0.3, 0.3), z: o.z + 0.4, vx: R.range(-2, 2), vy: R.range(-2, 2), vz: R.range(3, 6), grav: 22, life: 0.45, color: R.pick(DIRT) });
                break;
              }
              if (o.drill && R.chance(0.5)) fx.add({ kind: 'spark', x: o.x, y: o.y, z: o.z, vx: R.range(-3, 3), vy: R.range(-3, 3), vz: R.range(-1, 3), life: 0.2, color: '#ffffff' });
              if (def.form === 'basic' || o.pellet || !R.chance([0.35, 0.8, 1][q])) break;
              if (el === 'plasma') fx.add({ kind: 'ember', x: o.x, y: o.y, z: o.z, vx: R.range(-1, 1), vy: R.range(-1, 1), vz: R.range(0.5, 2), life: 0.35, color: R.pick(ramp), glow: true });
              else if (el === 'cryo' || el === 'crystal') fx.add({ kind: 'px', x: o.x + R.range(-0.3, 0.3), y: o.y + R.range(-0.3, 0.3), z: o.z, vx: 0, vy: 0, vz: -0.5, life: 0.5, color: R.chance(0.5) ? '#ffffff' : ramp[3] });
              else if (el === 'bio') fx.add({ kind: 'px', x: o.x, y: o.y, z: o.z, vx: 0, vy: 0, vz: 0, grav: 12, life: 0.5, color: ramp[2] });
              else if (el === 'arc' && R.chance(0.3)) fx.bolts.push({ pts: fx.lightning({ x1: o.x, y1: o.y, z1: o.z, x2: o.x + R.range(-1, 1), y2: o.y + R.range(-1, 1), z2: o.z + R.range(-0.8, 0.8) }), color: '#ffffff', glow: ramp[2], life: 0.08, age: 0 });
              else fx.add({ kind: 'spark', x: o.x, y: o.y, z: o.z, vx: -o.vx * 0.08 + R.range(-1, 1), vy: -o.vy * 0.08 + R.range(-1, 1), vz: R.range(-0.5, 0.5), life: 0.25, color: R.pick(ramp) });
              break;
            }
            case 'beam':
              if (R.chance([0.4, 0.9, 1][q])) fx.burst(o.ex, o.ey, o.ez, ramp, 2, 7, { glow: true, life: 0.5 });
              break;
            case 'cone': {
              const f = o.owner;
              for (let i = 0; i < [2, 4, 7][q]; i++) {
                const a = o.angle + R.range(-def.angle / 2, def.angle / 2), s = R.range(7, 14);
                const kind = el === 'plasma' ? 'ember' : el === 'cryo' || el === 'crystal' ? 'shard' : el === 'bio' ? 'bubble' : 'spark';
                fx.add({ kind, x: f.x + Math.cos(a) * f.radius, y: f.y + Math.sin(a) * f.radius, z: f.z + f.height * 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: R.range(-1, 1.5), life: def.range / s, color: R.pick(ramp), size: 1.4, drag: 0.4, glow: true });
              }
              break;
            }
            case 'zone':
              if (R.chance(o.tag === 'trail' ? 0.06 : [0.2, 0.5, 0.9][q])) this.zoneParticle(o, el, ramp);
              break;
            case 'nova': {
              const f = o.owner;
              for (let i = 0; i < [1, 2, 3][q]; i++) {
                const a = R.range(0, Math.PI * 2), r = def.radius * R.range(0.7, 1);
                fx.add({ kind: 'spark', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, z: f.z + R.range(0.3, 1.8), vx: -Math.cos(a) * r * 3.5, vy: -Math.sin(a) * r * 3.5, vz: 0, life: 0.28, color: ramp[3], glow: true });
              }
              break;
            }
            case 'lob':
              (o._trail || (o._trail = [])).push({ x: o.x, y: o.y, z: o.z });
              if (o._trail.length > 7) o._trail.shift();
              if (R.chance([0.2, 0.5, 0.8][q])) fx.add({ kind: 'spark', x: o.x, y: o.y, z: o.z, vx: R.range(-1, 1), vy: R.range(-1, 1), vz: R.range(-0.5, 1), life: 0.25, color: R.pick(ramp), glow: true });
              break;
            case 'wave': {
              const ux = Math.cos(o.angle), uy = Math.sin(o.angle);
              for (let i = 0; i < [1, 2, 4][q]; i++) {
                const s = R.range(-1, 1) * o.r;
                fx.add({ kind: 'px', x: o.x - uy * s, y: o.y + ux * s, z: o.z + (o.burrow ? 0.2 : 0.9), vx: ux * o.speed * 0.5 + R.range(-1.5, 1.5), vy: uy * o.speed * 0.5 + R.range(-1.5, 1.5), vz: R.range(3, 7), grav: 20, life: 0.5, color: o.burrow ? R.pick(DIRT) : R.pick([ramp[2], ramp[3], '#ffffff']) });
              }
              break;
            }
            case 'tornado':
              for (let i = 0; i < [2, 3, 5][q]; i++) {
                const a = R.range(0, TAU), h = R.range(0, 3.5), r = o.r * (0.3 + h * 0.2);
                fx.add({ kind: 'spark', x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, z: o.z + h, vx: -Math.sin(a) * 9, vy: Math.cos(a) * 9, vz: 2, life: 0.3, color: R.pick(ramp), glow: true });
              }
              break;
            case 'sing':
              for (let i = 0; i < [2, 3, 5][q]; i++) {
                const a = R.range(0, TAU), r = o.r * R.range(0.8, 1.4);
                fx.add({ kind: 'spark', x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, z: o.z + R.range(-1, 0.6), vx: -Math.cos(a) * r * 2.6 - Math.sin(a) * r * 1.5, vy: -Math.sin(a) * r * 2.6 + Math.cos(a) * r * 1.5, vz: 0, life: 0.38, color: R.pick([ramp[2], ramp[3]]), glow: true });
              }
              break;
            case 'orbit':
              if (o.orbs) {
                o._trails = o._trails || [];
                o.orbs.forEach((p, i) => { const t = o._trails[i] || (o._trails[i] = []); t.push({ x: p.x, y: p.y, z: p.z }); if (t.length > 6) t.shift(); });
              }
              break;
          }
        }
        for (const f of b.fighters) {
          if (!f.alive) continue;
          if (f.st.burn && R.chance(0.45)) fx.add({ kind: 'ember', x: f.x + R.range(-0.5, 0.5), y: f.y, z: f.z + f.height * R.range(0.3, 0.9), vx: 0, vy: 0, vz: 2.5, life: 0.45, color: R.pick(['#ff8a2a', '#ffe08a', '#c2401f']), glow: true });
          if (f.st.poison && R.chance(0.2)) fx.add({ kind: 'bubble', x: f.x, y: f.y + R.range(-0.5, 0.5), z: f.z + f.height, vx: 0, vy: 0, vz: 1.2, life: 0.7, color: '#8be04a' });
          if (f.aura && R.chance(0.6)) {
            const a = R.range(0, Math.PI * 2), r = f.aura.def.radius * R.range(0.5, 1);
            fx.add({ kind: 'ember', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, z: f.z + 0.2, vx: 0, vy: 0, vz: R.range(1.5, 3.5), life: 0.7, color: R.pick(f.aura.def.ramp), glow: true });
          }
          if (f.dash) {
            f._ghostT = (f._ghostT || 0) - dt;
            if (f._ghostT <= 0 && f.rig) { f._ghostT = 0.035; fx.ghost(f.rig, f.dash.def.ramp[2], 0.3); }
            fx.add({ kind: 'spark', x: f.x + R.range(-0.6, 0.6), y: f.y + R.range(-0.6, 0.6), z: f.z + R.range(0.3, f.height), vx: -f.dash.vx * 0.4, vy: -f.dash.vy * 0.4, vz: 0, life: 0.18, color: '#ffffff' });
          }
        }
      }
      fx.update(dt);
      this.updateCamera(dt);
    }

    zoneParticle(o, el, ramp) {
      const fx = this.fx, R = fx.rng;
      const a = R.range(0, Math.PI * 2), r = Math.sqrt(R.next()) * o.r;
      const x = o.x + Math.cos(a) * r, y = o.y + Math.sin(a) * r;
      switch (el) {
        case 'plasma': fx.add({ kind: 'ember', x, y, z: o.z, vx: 0, vy: 0, vz: R.range(2, 4), life: 0.6, color: R.pick(ramp), glow: true, size: 1.3 }); break;
        case 'cryo': fx.add({ kind: 'px', x, y, z: o.z + 3, vx: R.range(-0.4, 0.4), vy: 0, vz: -2, life: 1.4, color: '#ffffff' }); break;
        case 'bio': fx.add({ kind: 'bubble', x, y, z: o.z, vx: 0, vy: 0, vz: 1.4, life: 0.9, color: ramp[3] }); break;
        case 'gravity': case 'void':
          fx.add({ kind: 'spark', x, y, z: o.z + 0.3, vx: (o.x - x) * 2 - (y - o.y) * 2, vy: (o.y - y) * 2 + (x - o.x) * 2, vz: 0.5, life: 0.4, color: R.pick(ramp), glow: true }); break;
        case 'arc':
          if (R.chance(0.3)) fx.bolts.push({ pts: fx.lightning({ x1: x, y1: y, z1: o.z, x2: x + R.range(-1.2, 1.2), y2: y + R.range(-1.2, 1.2), z2: o.z + R.range(0, 1.5) }), color: '#ffffff', glow: ramp[2], life: 0.1, age: 0 });
          break;
        default: fx.add({ kind: 'ember', x, y, z: o.z, vx: 0, vy: 0, vz: R.range(1, 2.5), life: 0.7, color: ramp[3], glow: true });
      }
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
      // Open the see-through window while something stands in front of the player.
      const want = p && this.settings.xray !== false && this.occluded(p) ? 1 : 0;
      this.windowK = XS.damp(this.windowK, want, 9, dt);
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
      this.terrain.view = { W, H };
      this.terrain.drawFloor(ctx, ox, oy, W, H);

      const maxD = this.terrain.bands.length - 1;
      const buckets = this.buckets;
      for (let d = 0; d <= maxD; d++) { if (buckets[d]) buckets[d].length = 0; else buckets[d] = []; }
      const put = (d, kind, o) => buckets[XS.clamp(d, 0, maxD)].push(kind, o);
      // Things below the floor line over the void are hidden by the slab in front.
      const BASE = this.terrain.base, wld = this.arena.world;
      const underSlab = (x, y, z) => {
        if (z > BASE - 0.3 || wld.topAt(x, y) !== -Infinity) return false;
        for (let t = 0.5; z + t < BASE + 0.5; t += 0.5) if (wld.solid(x + t, y + t, z + t)) return true;
        return false;
      };
      const b = this.battle;
      if (b) {
        for (const f of b.fighters) if (f.alive && !underSlab(f.x, f.y, f.z + f.height * 0.6)) put(Math.floor(f.x + f.radius * 0.7) + Math.floor(f.y + f.radius * 0.7), 'f', f);
        for (const o of b.objects) {
          if (BUCKETED.has(o.kind)) put(Math.floor(o.x) + Math.floor(o.y), o.kind, o);
          else if (o.kind === 'orbit' && o.orbs) o.orbs.forEach((q, i) => put(Math.floor(q.x) + Math.floor(q.y), 'orb', { o, q, i }));
        }
      }
      for (const p of this.fx.parts) if (!underSlab(p.x, p.y, p.z)) put(Math.floor(p.x) + Math.floor(p.y), 'p', p);
      // Chunks of terrain falling or toppling, voxel by voxel.
      const w = this.arena.world;
      for (const c of w.chunks) {
        for (const v of c.vox) {
          const q = w.chunkVoxelPos(c, v);
          if (underSlab(q.x + 0.5, q.y + 0.5, q.z + 0.5)) continue;
          put(Math.floor(q.x + 0.5) + Math.floor(q.y + 0.5), 'cv', { q, v });
        }
      }

      const win = this.seeThrough(b, ox, oy);
      for (let d = 0; d <= maxD; d++) {
        if (win && d > win.d) this.drawBandWindowed(ctx, d, ox, oy, win);
        else this.terrain.drawBand(ctx, d, ox, oy);
        const bk = buckets[d];
        for (let i = 0; i < bk.length; i += 2) this.drawEntity(ctx, bk[i], bk[i + 1], ox, oy);
      }

      this.fx.drawGhosts(ctx, ox, oy);
      if (b) {
        this.collectLights(b);
        this.fx.drawLights(ctx, ox, oy, this.dynLights);
        this.drawOverlays(ctx, b, ox, oy, W, H);
      } else this.fx.drawLights(ctx, ox, oy, null);
      this.fx.drawOverlay(ctx, ox, oy);
      this.fx.drawFlash(ctx, W, H);
    }

    // ---------------------------------------------------- see-through window
    // An ellipse around the player's body, cut at the feet line so floors in
    // front never fade; only bands in front of the player get windowed.
    seeThrough(b, ox, oy) {
      const p = b && b.player;
      if (!p || !p.alive || this.windowK < 0.03) return null;
      const k = XS.easeOutCubic(this.windowK);
      const cx = XS.isoX(p.x, p.y) + ox, cy = XS.isoY(p.x, p.y, p.z + p.height * 0.5) + oy;
      const feet = XS.isoY(p.x, p.y, p.z) + oy + 2 * S;
      const rx = Math.max(16 * S, p.radius * XS.ELX * 2) * k, ry = (p.height * XS.ISO.VZ * 0.5 + 12 * S) * k;
      const poly = (sc) => {
        const path = new Path2D();
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          const x = cx + Math.cos(a) * rx * sc, y = Math.min(feet, cy + Math.sin(a) * ry * sc);
          if (i) path.lineTo(x, y); else path.moveTo(x, y);
        }
        path.closePath();
        return path;
      };
      const outer = poly(1), inner = poly(0.62);
      const W = this.screen.W, H = this.screen.H;
      const rest = new Path2D();
      rest.rect(-10, -10, W + 20, H + 20);
      rest.addPath(outer);
      const ringPath = new Path2D(outer);
      ringPath.addPath(inner);
      return {
        d: Math.floor(p.x + p.radius * 0.7) + Math.floor(p.y + p.radius * 0.7),
        bbox: { x: cx - rx, y: cy - ry, w: rx * 2, h: Math.max(1, feet - (cy - ry)) },
        rest, ringPath, inner,
      };
    }

    drawBandWindowed(ctx, d, ox, oy, win) {
      const r = this.terrain.bandRect(d, ox, oy);
      if (!r) return;
      const bb = win.bbox;
      if (r.x > bb.x + bb.w || r.x + r.w < bb.x || r.y > bb.y + bb.h || r.y + r.h < bb.y) { this.terrain.drawBand(ctx, d, ox, oy); return; }
      ctx.save(); ctx.clip(win.rest, 'evenodd'); this.terrain.drawBand(ctx, d, ox, oy); ctx.restore();
      ctx.save(); ctx.clip(win.ringPath, 'evenodd'); ctx.globalAlpha = 0.55; this.terrain.drawBand(ctx, d, ox, oy); ctx.restore();
      ctx.save(); ctx.clip(win.inner); ctx.globalAlpha = 0.22; this.terrain.drawBand(ctx, d, ox, oy); ctx.restore();
    }

    // ---------------------------------------------------------- entities
    drawEntity(ctx, kind, o, ox, oy) {
      switch (kind) {
        case 'f': this.drawFighter(ctx, o, ox, oy); break;
        case 'p': this.fx.drawPart(ctx, o, ox, oy); break;
        case 'proj': this.drawProjectile(ctx, o, ox, oy); break;
        case 'turret': {
          const bob = Math.sin(this.time * 3 + o.x) * 0.25;
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z + bob) + oy;
          const R = o.def.ramp;
          XS.drawShadow(ctx, o.x, o.y, o.z - 1.2, 0.6, ox, oy, 0.7);
          gfx.glow(ctx, sx, sy, 14 * S, R[2], 0.7);
          const h = 6 * S, w = 3.5 * S;
          gfx.poly(ctx, [[sx, sy - h - 1], [sx + w + 1, sy], [sx, sy + h * 0.6 + 1], [sx - w - 1, sy]], '#0c0816');
          gfx.poly(ctx, [[sx, sy - h], [sx + w, sy], [sx, sy + h * 0.6], [sx - w, sy]], R[1]);
          gfx.poly(ctx, [[sx, sy - h], [sx + w, sy], [sx, sy]], R[2]);
          gfx.disc(ctx, sx, sy - S, 1.5 * S, '#ffffff');
          ctx.fillStyle = '#120a18';
          ctx.fillRect(Math.round(sx + (Math.cos(o.aim) - Math.sin(o.aim)) * S * 0.7), Math.round(sy - S + (Math.cos(o.aim) + Math.sin(o.aim)) * S * 0.35), S, S);
          break;
        }
        case 'mine': {
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
          const armed = o.arm <= 0, blink = armed ? (Math.sin(this.time * 12) > 0) : true;
          if (armed) gfx.glow(ctx, sx, sy - S, (blink ? 9 : 5) * S, o.def.ramp[2], 0.8);
          gfx.disc(ctx, sx, sy - S, 3.5 * S, '#0c0816');
          gfx.ball(ctx, sx, sy - S, 2.5 * S, o.def.ramp);
          gfx.disc(ctx, sx, sy - S * 1.5, S, blink ? '#ff4040' : '#601010');
          break;
        }
        case 'lob': this.drawLob(ctx, o, ox, oy); break;
        case 'cv': {
          const { q, v } = o;
          const spr = this.terrain.sprite(v.m, Math.floor(XS.hash3f(v.x, v.y, v.z) * 4), XS.clamp(Math.round(q.z), 0, 31), 0, XS.crackOf(v.hp), v.stain);
          ctx.drawImage(spr, Math.round(XS.isoX(q.x, q.y) - XS.ISO.HX + ox), Math.round(XS.isoY(q.x, q.y, q.z + 1) + oy));
          break;
        }
        case 'bomb': {
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
          const on = Math.sin(this.time * (8 + 30 * (1 - o.t / o.T))) > 0;
          gfx.glow(ctx, sx, sy - 2 * S, (on ? 14 : 8) * S, on ? '#ff4a4a' : o.def.ramp[2], 0.8);
          gfx.disc(ctx, sx, sy - 2 * S, 4.5 * S, '#0c0816');
          gfx.ball(ctx, sx, sy - 2 * S, 3.5 * S, o.def.ramp);
          gfx.disc(ctx, sx, sy - 3 * S, 1.2 * S, on ? '#ff4040' : '#601010');
          break;
        }
        case 'wave': this.drawWave(ctx, o, ox, oy); break;
        case 'tornado': this.drawTornado(ctx, o, ox, oy); break;
        case 'sing': {
          const R = o.def.ramp, sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
          const k = Math.min(1, (o.dur - o.t) / 0.25), r = (3 + 2 * Math.sin(this.time * 9)) * S * k + 2 * S;
          gfx.glow(ctx, sx, sy, o.r * XS.ELX * 0.9, R[1], 0.6, 0.6);
          for (let i = 0; i < 3; i++) gfx.ellipseRing(ctx, sx, sy, (r * 2.2 + i * 3 * S), (r * 2.2 + i * 3 * S) * 0.35, i ? R[2] : R[3], 3, Math.floor(this.time * (14 - i * 4)));
          gfx.disc(ctx, sx, sy, r + S, R[3]);
          gfx.disc(ctx, sx, sy, r, '#05020a');
          break;
        }
        case 'orb': {
          const q = o.q, R = o.o.def.ramp, sx = XS.isoX(q.x, q.y) + ox, sy = XS.isoY(q.x, q.y, q.z) + oy;
          const r = Math.max(2 * S, o.o.def.radius * XS.PXU);
          const tr = o.o._trails && o.o._trails[o.i];
          if (tr) this.drawTrail(ctx, tr, ox, oy, r * 0.8, R);
          gfx.glow(ctx, sx, sy, r * 3, R[2], 0.8);
          gfx.disc(ctx, sx, sy, r + 1, R[0]);
          gfx.ball(ctx, sx, sy, r, R);
          break;
        }
      }
    }

    drawLob(ctx, o, ox, oy) {
      const def = o.def, R = def.ramp, sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
      const g = this.arena.world.groundAt(o.x, o.y, o.z, 0);
      if (g !== -Infinity) XS.drawShadow(ctx, o.x, o.y, g, o.payload === 'mini' ? 0.25 : 0.45, ox, oy, 0.6);
      const r = (o.payload === 'mini' ? 1.6 : 2.6) * S;
      if (o._trail) this.drawTrail(ctx, o._trail, ox, oy, r * 0.55, R);
      gfx.glow(ctx, sx, sy, r * 3.2, R[2], 0.8);
      switch (o.payload) {
        case 'singularity': gfx.disc(ctx, sx, sy, r + S, R[3]); gfx.disc(ctx, sx, sy, r, '#05020a'); break;
        case 'summon': {
          const h = r * 1.6;
          gfx.poly(ctx, [[sx, sy - h - 1], [sx + r + 1, sy], [sx, sy + h * 0.6 + 1], [sx - r - 1, sy]], '#0c0816');
          gfx.poly(ctx, [[sx, sy - h], [sx + r, sy], [sx, sy + h * 0.6], [sx - r, sy]], R[2]);
          break;
        }
        case 'field':
          gfx.disc(ctx, sx, sy, r + 1, '#0c0816');
          gfx.ball(ctx, sx, sy, r, R);
          ctx.fillStyle = '#dfe8ff'; ctx.fillRect(Math.round(sx - S / 2), Math.round(sy - r - 2 * S), S, 2 * S);
          break;
        default:
          gfx.disc(ctx, sx, sy, r + 1, '#0c0816');
          gfx.ball(ctx, sx, sy, r, R);
          if (o.payload === 'grenade' && Math.floor(this.time * 20) % 2) gfx.disc(ctx, sx + S, sy - r, S, '#ffffff');
      }
    }

    // A crest of energy (or a dirt mound when burrowing) across its path.
    drawWave(ctx, o, ox, oy) {
      const R = o.def.ramp, ux = Math.cos(o.angle), uy = Math.sin(o.angle);
      const top = [], base = [];
      const H = o.burrow ? 0.6 : 1.5;
      for (let i = 0; i <= 8; i++) {
        const s = i / 4 - 1, px = o.x - uy * s * o.r, py = o.y + ux * s * o.r;
        const h = H * (1 - s * s) * (0.85 + 0.15 * Math.sin(this.time * 24 + i));
        top.push([XS.isoX(px, py) + ox, XS.isoY(px, py, o.z + h) + oy]);
        base.unshift([XS.isoX(px, py) + ox, XS.isoY(px, py, o.z) + oy]);
      }
      const cx = XS.isoX(o.x, o.y) + ox, cy = XS.isoY(o.x, o.y, o.z + H * 0.5) + oy;
      if (!o.burrow) gfx.glow(ctx, cx, cy, o.r * XS.ELX * 1.4, R[2], 0.7);
      gfx.poly(ctx, top.concat(base), o.burrow ? DIRT[1] : R[1]);
      for (let i = 1; i < top.length; i++) gfx.line(ctx, top[i - 1][0], top[i - 1][1], top[i][0], top[i][1], o.burrow ? DIRT[3] : R[3]);
      if (!o.burrow) for (let i = 2; i < top.length - 2; i += 2) gfx.disc(ctx, top[i][0], top[i][1], S, '#ffffff');
    }

    drawTornado(ctx, o, ox, oy) {
      const R = o.def.ramp, sx = XS.isoX(o.x, o.y) + ox;
      const k = Math.min(1, (o.dur - o.t) / 0.3, o.t / 0.3 + 0.2);
      gfx.glow(ctx, sx, XS.isoY(o.x, o.y, o.z) + oy, o.r * XS.ELX * 1.2, R[2], 0.5 * k, 0.5);
      for (let i = 0; i < 7; i++) {
        const h = i * 0.6, r = o.r * (0.25 + i * 0.14) * k;
        const wob = Math.sin(this.time * 6 + i * 0.9) * 0.3;
        const sy = XS.isoY(o.x, o.y, o.z + h) + oy;
        gfx.ellipseRing(ctx, sx + wob * XS.ELX, sy, r * XS.ELX, r * XS.ELY, i % 2 ? R[2] : R[3], 3, Math.floor(this.time * 30 + i * 3));
      }
      gfx.glow(ctx, sx, XS.isoY(o.x, o.y, o.z + 1.5) + oy, 10 * S * k, R[3], 0.5);
    }

    drawTrail(ctx, pts, ox, oy, r, ramp) {
      for (let i = 1; i < pts.length; i++) {
        const k = i / pts.length;
        const a = pts[i - 1], c = pts[i];
        gfx.thickLine(ctx, XS.isoX(a.x, a.y) + ox, XS.isoY(a.x, a.y, a.z) + oy, XS.isoX(c.x, c.y) + ox, XS.isoY(c.x, c.y, c.z) + oy, Math.max(0.5, r * k * 0.8), k > 0.6 ? ramp[2] : ramp[1]);
      }
    }

    drawProjectile(ctx, o, ox, oy) {
      const def = o.def, R = def.ramp, el = el0(def);
      const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
      if (def.form === 'basic') {
        const r = Math.max(1.5 * S, o.r * XS.PXU);
        if (o._trail) this.drawTrail(ctx, o._trail, ox, oy, r * 0.7, R);
        gfx.disc(ctx, sx, sy, r + 1, R[0]);
        gfx.ball(ctx, sx, sy, r, R);
        return;
      }
      if (o.burrow) {
        const h = Math.sin(this.time * 30) > 0 ? S : 0;
        gfx.ellipse(ctx, sx, sy - S - h, 4 * S, 2 * S, DIRT[1]);
        gfx.ellipse(ctx, sx, sy - 2 * S - h, 2.5 * S, 1.2 * S, DIRT[3]);
        gfx.glow(ctx, sx, sy - S, 8 * S, R[2], 0.5, 0.5);
        return;
      }
      if (o.pellet) {
        const r = Math.max(1.5 * S, o.r * XS.PXU);
        if (o._trail) this.drawTrail(ctx, o._trail.slice(-4), ox, oy, r * 0.6, R);
        gfx.glow(ctx, sx, sy, r * 3, R[2], 0.7);
        gfx.disc(ctx, sx, sy, r, R[3]);
        return;
      }
      if (def.form === 'sniper') {
        const tr = o._trail;
        if (tr && tr.length > 1) {
          const a = tr[0];
          gfx.thickLine(ctx, XS.isoX(a.x, a.y) + ox, XS.isoY(a.x, a.y, a.z) + oy, sx, sy, S * 0.6, R[2]);
          gfx.line(ctx, XS.isoX(a.x, a.y) + ox, XS.isoY(a.x, a.y, a.z) + oy, sx, sy, '#ffffff');
        }
        gfx.glow(ctx, sx, sy, 12 * S, R[3], 1);
        gfx.disc(ctx, sx, sy, 1.5 * S, '#ffffff');
        return;
      }
      const r = Math.max(2.5 * S, o.r * XS.PXU * (o.child ? 0.8 : 1.15));
      if (o._trail) this.drawTrail(ctx, o._trail, ox, oy, r, R);
      if (o.drill) {
        const dsx = (o.vx - o.vy) * XS.ISO.HX, dsy = (o.vx + o.vy) * XS.ISO.HY;
        const dl = Math.hypot(dsx, dsy) || 1, ux = dsx / dl, uy = dsy / dl, L = r * 2.4, spin = this.time * 40;
        gfx.glow(ctx, sx, sy, r * 3, R[2], 0.8);
        gfx.poly(ctx, [[sx + ux * L, sy + uy * L], [sx - uy * r, sy + ux * r], [sx - ux * r * 0.6, sy - uy * r * 0.6], [sx + uy * r, sy - ux * r]], R[1]);
        for (let i = 0; i < 3; i++) {
          const t = ((spin + i * 2) % 6) / 6, px = sx + ux * L * (1 - t) - ux * r * 0.5 * t, py = sy + uy * L * (1 - t) - uy * r * 0.5 * t, w = r * t;
          gfx.line(ctx, px - uy * w, py + ux * w, px + uy * w, py - ux * w, R[3]);
        }
        gfx.disc(ctx, sx + ux * L, sy + uy * L, S, '#ffffff');
        return;
      }
      gfx.glow(ctx, sx, sy, r * 3.4, R[2], 0.9);
      // Direction on screen (for oriented shapes).
      const dsx = (o.vx - o.vy) * XS.ISO.HX, dsy = (o.vx + o.vy) * XS.ISO.HY;
      const dl = Math.hypot(dsx, dsy) || 1, ux = dsx / dl, uy = dsy / dl;
      const t = this.time;
      if (def.form === 'boomerang') {
        const a = t * 22;
        const L = r * 2;
        gfx.thickLine(ctx, sx - Math.cos(a) * L, sy - Math.sin(a) * L * 0.5, sx + Math.cos(a) * L, sy + Math.sin(a) * L * 0.5, S * 0.8, R[2]);
      }
      switch (el) {
        case 'cryo': {
          const tip = [sx + ux * r * 2, sy + uy * r * 2], back = [sx - ux * r * 1.6, sy - uy * r * 1.6];
          const s1 = [sx - uy * r * 0.8, sy + ux * r * 0.8], s2 = [sx + uy * r * 0.8, sy - ux * r * 0.8];
          gfx.poly(ctx, [tip, s1, back, s2], R[1]);
          gfx.poly(ctx, [tip, s1, [sx, sy]], R[3]);
          gfx.line(ctx, back[0], back[1], tip[0], tip[1], '#ffffff');
          break;
        }
        case 'crystal': {
          const a = t * 6;
          const pts = [0, 1, 2, 3].map((i) => [sx + Math.cos(a + (i * Math.PI) / 2) * r * 1.4, sy + Math.sin(a + (i * Math.PI) / 2) * r * 1.4 * 0.75]);
          gfx.poly(ctx, pts, R[1]);
          gfx.poly(ctx, [pts[0], pts[1], [sx, sy]], R[3]);
          break;
        }
        case 'gravity':
          gfx.disc(ctx, sx, sy, r, '#140a26');
          gfx.ellipseRing(ctx, sx, sy, r * 1.9, r * 0.8, R[3]);
          gfx.ellipseRing(ctx, sx, sy, r * 1.4, r * 1.4, R[2], 2, Math.floor(t * 20));
          break;
        case 'void':
          gfx.disc(ctx, sx, sy, r + S, R[3]);
          gfx.disc(ctx, sx, sy, r, '#05020a');
          break;
        case 'arc':
          gfx.disc(ctx, sx, sy, r, R[2]);
          gfx.disc(ctx, sx, sy, r * 0.55, '#ffffff');
          for (let i = 0; i < 3; i++) {
            const a = t * 30 + i * 2.1, L = r * (1.6 + Math.sin(t * 50 + i));
            gfx.line(ctx, sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L, '#ffffff');
          }
          break;
        case 'sonic':
          gfx.disc(ctx, sx, sy, r, R[2]);
          for (let i = 1; i <= 2; i++) {
            const k = ((t * 3 + i * 0.5) % 1);
            gfx.ellipseRing(ctx, sx + ux * r * i, sy + uy * r * i, r * (0.8 + k), r * (0.8 + k), R[3]);
          }
          break;
        case 'chrono': {
          gfx.disc(ctx, sx, sy, r + 1, R[0]);
          gfx.disc(ctx, sx, sy, r, R[2]);
          const a = t * 8;
          gfx.line(ctx, sx, sy, sx + Math.cos(a) * r * 0.9, sy + Math.sin(a) * r * 0.9, R[0]);
          gfx.ellipseRing(ctx, sx, sy, r * 1.5, r * 1.5, R[3], 2, Math.floor(t * 10));
          break;
        }
        case 'psi': {
          gfx.ball(ctx, sx, sy, r, R);
          const k = (t * 2.5) % 1;
          gfx.ellipseRing(ctx, sx, sy, r * (1.2 + k), r * (1.2 + k), R[3]);
          break;
        }
        default:
          gfx.disc(ctx, sx, sy, r + 1, R[0]);
          gfx.ball(ctx, sx, sy, r, R);
      }
      gfx.disc(ctx, sx, sy, Math.max(1, r * 0.35), '#ffffff');
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
      const my = XS.isoY(f.x, f.y, f.z + f.height * 0.5) + oy;
      if (s.shield > 0) {
        gfx.glow(ctx, hx, my, f.radius * XS.ELX * 1.6, '#9ff6ff', 0.25 + 0.1 * Math.sin(this.time * 6));
        gfx.ellipseRing(ctx, hx, my, f.radius * XS.ELX * 1.15, f.height * XS.ISO.VZ * 0.62, '#dffcff', 3, Math.floor(this.time * 10));
      }
      if (s.stun > 0 || s.freeze > 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.time * 6 + (i * Math.PI * 2) / 3;
          ctx.fillStyle = s.freeze > 0 ? '#e8fbff' : '#ffe86a';
          ctx.fillRect(Math.round(hx + Math.cos(a) * 6 * S), Math.round(hy - 3 * S + Math.sin(a) * 2 * S), S, S);
        }
      }
    }

    // Is something solid in front of the fighter (between it and the camera)?
    occluded(f) {
      const w = this.arena.world;
      for (let k = 1; k <= 6; k++) {
        for (const [ax, ay] of [[k, k], [k, k - 1], [k - 1, k], [k + 1, k - 1], [k - 1, k + 1]]) {
          if (w.blockedSpan(f.x + ax, f.y + ay, f.z + 1 + k * 0.5, f.z + f.height + k)) return true;
        }
      }
      return false;
    }

    // Light pools cast by live power objects this frame.
    collectLights(b) {
      const L = this.dynLights;
      L.length = 0;
      if (this.fx.quality === 0) return;
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 8);
      for (const o of b.objects) {
        const R = o.def && o.def.ramp;
        switch (o.kind) {
          case 'proj': if (o.def.form !== 'basic') L.push({ x: o.x, y: o.y, z: Math.max(0, b.world.groundAt(o.x, o.y, o.z, 0)), r: 1.8, color: R[2], a: 0.55 }); break;
          case 'beam':
            for (let i = 0; i <= 3; i++) {
              const t = i / 3;
              L.push({ x: XS.lerp(o.sx, o.ex, t), y: XS.lerp(o.sy, o.ey, t), z: o.owner.z, r: 2, color: R[2], a: 0.7 * (1 - o.t / 0.45) });
            }
            break;
          case 'zone': L.push({ x: o.x, y: o.y, z: o.z, r: o.r * 0.9, color: R[2], a: (o.tag === 'trail' ? 0.25 : 0.5) * pulse * Math.min(1, o.t / 0.4) }); break;
          case 'orbit': if (o.orbs) for (const p of o.orbs) L.push({ x: p.x, y: p.y, z: o.owner.z, r: 1.2, color: R[2], a: 0.4 }); break;
          case 'turret': L.push({ x: o.x, y: o.y, z: o.z - 1.2, r: 1.6, color: R[2], a: 0.5 * pulse }); break;
          case 'mine': if (o.arm <= 0) L.push({ x: o.x, y: o.y, z: o.z, r: 1.1, color: R[2], a: 0.35 * pulse }); break;
          case 'strike': L.push({ x: o.x, y: o.y, z: o.z, r: o.r, color: R[2], a: 0.6 * (1 - o.t / o.delay) }); break;
          case 'nova': L.push({ x: o.x, y: o.y, z: o.z, r: o.r * (1 - o.t / o.T), color: R[2], a: 0.8 }); break;
          case 'lob': if (o.payload !== 'mini') L.push({ x: o.x, y: o.y, z: Math.max(0, b.world.groundAt(o.x, o.y, o.z, 0)), r: 1.5, color: R[2], a: 0.4 }); break;
          case 'bomb': L.push({ x: o.x, y: o.y, z: o.z, r: o.r * 0.6, color: '#ff4a4a', a: 0.45 * pulse }); break;
          case 'wave': L.push({ x: o.x, y: o.y, z: o.z, r: o.r * 1.6, color: R[2], a: o.burrow ? 0.2 : 0.6 }); break;
          case 'tornado': L.push({ x: o.x, y: o.y, z: o.z, r: o.r * 1.4, color: R[2], a: 0.5 * pulse }); break;
          case 'sing': L.push({ x: o.x, y: o.y, z: o.ground, r: o.r * 1.2, color: R[1], a: 0.7 * pulse }); break;
          case 'meteor': L.push({ x: o.x, y: o.y, z: o.z, r: o.r * (1 - o.t / o.T), color: R[2], a: 0.8 * (1 - o.t / o.T) }); break;
        }
      }
      for (const f of b.fighters) if (f.alive && f.aura) L.push({ x: f.x, y: f.y, z: f.z, r: f.aura.def.radius, color: f.aura.def.ramp[2], a: 0.4 * pulse });
    }

    drawOverlays(ctx, b, ox, oy, W, H) {
      // Zones: glowing ground with turning rings.
      for (const o of b.objects) {
        if (o.kind !== 'zone') continue;
        const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
        const fade = Math.min(1, o.t / 0.4);
        const rx = o.r * XS.ELX, ry = o.r * XS.ELY;
        if (o.tag === 'trail') { gfx.glow(ctx, sx, sy, rx * 1.3, o.def.ramp[2], 0.45 * fade, 0.5); continue; }
        gfx.ellipse(ctx, sx, sy, rx, ry, gfx.ditherPattern(ctx, o.def.ramp[1], 0.22 * fade));
        gfx.ellipseRing(ctx, sx, sy, rx, ry, o.def.ramp[3], 4, Math.floor(this.time * 8));
        gfx.ellipseRing(ctx, sx, sy, rx * 0.66, ry * 0.66, o.def.ramp[2], 3, -Math.floor(this.time * 10));
      }
      // Telegraphs (red edge when they threaten the player's team).
      const pt = b.player ? b.player.team : -1;
      for (const t of b.telegraphs) {
        const sx = XS.isoX(t.x, t.y) + ox, sy = XS.isoY(t.x, t.y, t.z) + oy;
        const k = t.age / t.dur;
        const rx = t.r * XS.ELX, ry = t.r * XS.ELY;
        const threat = t.team !== pt;
        gfx.glow(ctx, sx, sy, rx * 1.2 * k + 2, threat ? '#ff3a3a' : t.ramp[2], 0.25 + 0.5 * k, 0.5);
        gfx.ellipse(ctx, sx, sy, rx * k, ry * k, gfx.ditherPattern(ctx, threat ? '#ff5a5a' : t.ramp[2], 0.35));
        gfx.ellipseRing(ctx, sx, sy, rx, ry, threat && Math.floor(this.time * 10) % 2 ? '#ff4a4a' : t.ramp[3], 3, Math.floor(this.time * 12));
      }
      // Beams, falling strikes, nova and aura rings.
      for (const o of b.objects) {
        if (o.kind === 'beam') this.drawBeam(ctx, o, ox, oy);
        else if (o.kind === 'strike' && o.t < 0.3) {
          const sx = XS.isoX(o.x, o.y) + ox, sy = XS.isoY(o.x, o.y, o.z) + oy;
          const top = sy - 90 * S * (o.t / 0.3) - 4 * S;
          gfx.thickLine(ctx, sx, top - 16 * S, sx, top, S, o.def.ramp[2]);
          gfx.glow(ctx, sx, top, 10 * S, o.def.ramp[2], 1);
          gfx.disc(ctx, sx, top, 3 * S, o.def.ramp[3]);
          gfx.disc(ctx, sx, top, 1.5 * S, '#ffffff');
        } else if (o.kind === 'nova') {
          const f = o.owner, sx = XS.isoX(f.x, f.y) + ox, sy = XS.isoY(f.x, f.y, f.z + f.height * 0.5) + oy;
          gfx.glow(ctx, sx, sy, Math.max(0, 1 - o.t / 0.28) * 26 * S, o.def.ramp[3], 0.9);
        } else if (o.kind === 'lob' && !o.tele && o.payload !== 'mini' && !o.overVoid) {
          const sx = XS.isoX(o.tx, o.ty) + ox, sy = XS.isoY(o.tx, o.ty, o.tz) + oy, k = o.t / o.T;
          gfx.ellipseRing(ctx, sx, sy, (0.5 + k * 0.5) * XS.ELX, (0.5 + k * 0.5) * XS.ELY, o.def.ramp[3], 2, Math.floor(this.time * 12));
        } else if (o.kind === 'meteor' && o.t < 0.6) {
          const R = o.def.ramp, k = o.t / 0.6;
          const gx = XS.isoX(o.x, o.y) + ox, gy = XS.isoY(o.x, o.y, o.z) + oy;
          const mx = gx - 30 * S * k, my = gy - 130 * S * k;
          const rr = Math.max(3 * S, o.r * 1.6 * S);
          gfx.glow(ctx, mx, my, rr * 4, R[2], 0.9);
          gfx.thickLine(ctx, mx + 20 * S, my - 60 * S, mx, my, rr * 0.5, R[2]);
          gfx.thickLine(ctx, mx + 10 * S, my - 30 * S, mx, my, rr * 0.35, R[3]);
          gfx.disc(ctx, mx, my, rr + S, '#0c0816');
          gfx.ball(ctx, mx, my, rr, ['#2a1c10', '#6a4a2a', R[2], R[3]]);
        }
      }
      for (const f of b.fighters) {
        if (!f.alive || !f.aura) continue;
        const sx = XS.isoX(f.x, f.y) + ox, sy = XS.isoY(f.x, f.y, f.z) + oy, r = f.aura.def.radius;
        gfx.ellipseRing(ctx, sx, sy, r * XS.ELX, r * XS.ELY, f.aura.def.ramp[3], 3, Math.floor(this.time * 9));
      }
      // Aim preview.
      if (this.aim && b.player && b.player.alive) this.drawAim(ctx, b.player, this.aim, ox, oy);
      // Bars, markers, x-ray, off-screen arrows.
      for (const f of b.fighters) {
        if (!f.alive) continue;
        const hx = Math.round(XS.isoX(f.x, f.y) + ox), hy = Math.round(XS.isoY(f.x, f.y, f.z + f.height) + oy) - 5 * S;
        if (f.isPlayer && this.settings.xray !== false && this.windowK > 0.5) XS.drawRigOutline(ctx, f.rig, ox, oy, TEAM_COLORS[0]);
        const col = f.isPlayer ? TEAM_COLORS[0] : TEAM_COLORS[1 + (f.team % 4)];
        if (this.showBars) {
          const w = 13 * S, h = 2 * S, k = Math.max(0, f.hp / f.maxHp);
          ctx.fillStyle = '#0a0610'; ctx.fillRect(hx - w / 2 - 1, hy - 1, w + 2, h + 2);
          ctx.fillStyle = '#3a2a3a'; ctx.fillRect(hx - w / 2, hy, w, h);
          ctx.fillStyle = col; ctx.fillRect(hx - w / 2, hy, Math.ceil(w * k), h);
          if (f.st.shield > 0) { ctx.fillStyle = '#e8fbff'; ctx.fillRect(hx - w / 2, hy - 1, Math.min(w, Math.ceil((w * f.st.shield) / f.maxHp)), 1); }
        }
        if (f.isPlayer) {
          ctx.fillStyle = col;
          for (let i = 0; i < 3 * S; i++) ctx.fillRect(hx - (3 * S - i), hy - 7 * S + i, (3 * S - i) * 2 + 1, 1);
        }
        if (f.dummy && XS.Lab) {
          const d = XS.Lab.dps(f, b.time);
          gfx.text(ctx, d > 0 ? `DPS ${d.toFixed(1)}` : f.dummy === 'still' ? 'DPS' : '', hx, hy - 9 * S, '#ffd166', 'center', '#0a0610', S);
        }
        const sx = XS.isoX(f.x, f.y) + ox, sy = XS.isoY(f.x, f.y, f.z + f.height / 2) + oy;
        if (!f.isPlayer && (sx < 0 || sy < 0 || sx > W || sy > H)) {
          const cx = XS.clamp(sx, 7 * S, W - 7 * S), cy = XS.clamp(sy, 7 * S, H - 7 * S);
          const a = Math.atan2(sy - H / 2, sx - W / 2);
          gfx.disc(ctx, cx, cy, 5 * S, '#0a0610');
          gfx.disc(ctx, cx, cy, 4 * S, col);
          gfx.disc(ctx, cx + Math.cos(a) * 2.5 * S, cy + Math.sin(a) * 2.5 * S, S, '#0a0610');
        }
      }
    }

    drawBeam(ctx, o, ox, oy) {
      const R = o.def.ramp;
      const ax = XS.isoX(o.sx, o.sy) + ox, ay = XS.isoY(o.sx, o.sy, o.sz) + oy;
      const bx = XS.isoX(o.ex, o.ey) + ox, by = XS.isoY(o.ex, o.ey, o.ez) + oy;
      const fade = Math.max(0, 1 - o.t / 0.42);
      const w = (o.def.mods.includes('colossal') ? 1.6 : 1) * 3 * S * (0.6 + 0.4 * fade) * (0.85 + 0.3 * this.fx.rng.next());
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 * fade;
      ctx.strokeStyle = R[1]; ctx.lineWidth = w * 2.6;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = R[2]; ctx.lineWidth = w * 1.3;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, w * 0.45);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
      gfx.glow(ctx, ax, ay, 12 * S, R[3], fade);
      gfx.glow(ctx, bx, by, 16 * S, R[2], fade);
      gfx.disc(ctx, bx, by, (2 + this.fx.rng.next() * 2) * S, '#ffffff');
    }

    // ------------------------------------------------------- aim indicators
    // Brawl Stars-style: a translucent shape on the ground for how the power
    // is aimed (line, cone, thrown arc + landing zone, zone, dash arrow,
    // circle around you, wall segment). Red when the aim is being cancelled.
    drawAim(ctx, f, aim, ox, oy) {
      const def = aim.def, w = this.arena.world;
      const col = aim.cancel ? '#ff4040' : XS.color.mix('#ffffff', def.ramp ? def.ramp[2] : '#ffd166', 0.3);
      const alpha = aim.cancel ? 0.24 : 0.3 + 0.15 * (aim.charge || 0) + 0.05 * Math.sin(this.time * 8);
      const z = f.z + 0.05;
      const a = aim.angle, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
      const P = (x, y, zz = z) => [XS.isoX(x, y) + ox, XS.isoY(x, y, zz) + oy];
      const shape = (pts, zz = z) => {
        const sp = pts.map(([x, y]) => P(x, y, zz));
        ctx.save(); ctx.globalAlpha = alpha; gfx.poly(ctx, sp, col); ctx.restore();
        for (let i = 0; i < sp.length; i++) {
          const p0 = sp[i], p1 = sp[(i + 1) % sp.length];
          gfx.line(ctx, p0[0], p0[1], p1[0], p1[1], col);
          gfx.line(ctx, p0[0], p0[1] + 1, p1[0], p1[1] + 1, col);
        }
      };
      const circle = (x, y, zz, r, fill = true) => {
        const [sx, sy] = P(x, y, zz);
        if (fill) { ctx.save(); ctx.globalAlpha = alpha; gfx.ellipse(ctx, sx, sy, r * XS.ELX, r * XS.ELY, col); ctx.restore(); }
        gfx.ellipseRing(ctx, sx, sy, r * XS.ELX, r * XS.ELY, col, fill ? 0 : 3, Math.floor(this.time * 12));
        if (fill) gfx.ellipseRing(ctx, sx, sy + 1, r * XS.ELX, r * XS.ELY, col);
      };
      // A straight (or curving) band from the fighter.
      const band = (ang, len, hw, start, curve = 0, speed = 1) => {
        const left = [], right = [];
        let x = f.x + Math.cos(ang) * start, y = f.y + Math.sin(ang) * start, h = ang;
        if (curve) h -= curve * (len / speed) / 2;
        const n = curve ? 14 : 1, step = (len - start) / n;
        for (let i = 0; i <= n; i++) {
          left.push([x - Math.sin(h) * hw, y + Math.cos(h) * hw]);
          right.unshift([x + Math.sin(h) * hw, y - Math.cos(h) * hw]);
          x += Math.cos(h) * step; y += Math.sin(h) * step; h += curve * (step / speed);
        }
        shape(left.concat(right));
      };
      const wedge = (ang, half, r, start = 0.4) => {
        const pts = [[f.x + Math.cos(ang) * start, f.y + Math.sin(ang) * start]];
        for (let i = 0; i <= 12; i++) { const t = ang - half + (i / 12) * half * 2; pts.push([f.x + Math.cos(t) * r, f.y + Math.sin(t) * r]); }
        shape(pts);
      };
      const target = () => {
        const d = XS.clamp(aim.dist, 1, def.range || 1);
        const x = f.x + ux * d, y = f.y + uy * d;
        const g = w.groundAt(x, y, f.z + 6, 0);
        return { x, y, z: (g === -Infinity ? f.z : g) + 0.05, d };
      };
      const dotted = (x1, y1, z1, x2, y2, z2, apex = 0) => {
        const n = Math.max(6, Math.round(Math.hypot(x2 - x1, y2 - y1) * 2.5)), ph = Math.floor(this.time * 10);
        let prev = null;
        for (let i = 0; i <= n; i++) {
          const k = i / n, q = P(XS.lerp(x1, x2, k), XS.lerp(y1, y2, k), XS.lerp(z1, z2, k) + apex * 4 * k * (1 - k));
          if (prev && (i + ph) % 3 !== 0) { gfx.line(ctx, prev[0], prev[1], q[0], q[1], '#0a0610'); gfx.line(ctx, prev[0], prev[1] - 1, q[0], q[1] - 1, col); }
          prev = q;
        }
      };

      if (aim.basic) {
        if (def.kind === 'spit') band(a, def.range, 0.35, f.radius * 0.6);
        else if (def.kind === 'spin') circle(f.x, f.y, z, def.range);
        else wedge(a, (def.arc || 1.6) / 2, def.range);
        return;
      }
      const has = (m) => def.mods.includes(m);
      const size = 1 + 0.4 * (aim.charge || 0);
      const spread = { bolt: 0.28, boomerang: 0.28, hook: 0.28, sniper: 0.1, drill: 0.3, wave: 0.35, eruption: 0.4, tornado: 0.5, beam: 0.3 }[def.form] || 0.28;
      const fanned = (fn) => { const n = def.count || 1; for (let i = 0; i < n; i++) fn(a + (i - (n - 1) / 2) * spread, i % 2 ? -1 : 1); };
      switch (def.aim) {
        case 'line': {
          const hw = Math.max(0.3, (def.form === 'eruption' || def.form === 'tornado' || def.form === 'wave' ? def.radius : def.radius * 0.8) * size);
          const start = def.form === 'eruption' ? f.radius + 0.6 : f.radius * 0.6;
          const len = def.form === 'eruption' ? def.range + start : def.range;
          const curve = has('curve') ? (def.form === 'wave' ? 1 : 1.2) : 0;
          fanned((ang, side) => band(ang, len, hw, start, curve * side, def.speed || 10));
          break;
        }
        case 'cone': wedge(a, def.angle / 2, def.range); break;
        case 'lob': {
          const t = target();
          dotted(f.x, f.y, f.z + 1.4, t.x, t.y, t.z, 1.5 + t.d * 0.25);
          if (def.form === 'mine') {
            for (let i = 0; i < def.count; i++) {
              const ang = (i / def.count) * Math.PI * 2 + a, rr = def.count > 1 ? 1.7 : 0;
              circle(t.x + Math.cos(ang) * rr, t.y + Math.sin(ang) * rr, t.z, 1.2);
            }
          } else if (def.form === 'summon' || def.form === 'grenade') {
            const n = def.count || 1, gap = def.form === 'summon' ? 2.2 : 1.8;
            for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * gap; circle(t.x + px * off, t.y + py * off, t.z, def.form === 'summon' ? 1 : def.radius * size); }
          } else circle(t.x, t.y, t.z, def.radius * size);
          break;
        }
        case 'zone': {
          const t = target();
          dotted(f.x, f.y, z, t.x, t.y, t.z);
          if (def.form === 'rain') { circle(t.x, t.y, t.z, def.spread); circle(t.x, t.y, t.z, def.radius, false); }
          else { const n = def.count || 1; for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * 3.2; circle(t.x + px * off, t.y + py * off, t.z, def.radius * size * (has('delay') ? 1.2 : 1)); } }
          break;
        }
        case 'dash': {
          if (def.form === 'blink') {
            const t = target();
            dotted(f.x, f.y, z, t.x, t.y, t.z);
            circle(t.x, t.y, t.z, def.radius);
          } else {
            const L = def.range, hw = Math.max(0.5, def.radius * 0.7), tip = L - 1.2;
            const b0 = f.radius * 0.5;
            shape([
              [f.x + ux * b0 + px * hw, f.y + uy * b0 + py * hw], [f.x + ux * tip + px * hw, f.y + uy * tip + py * hw],
              [f.x + ux * tip + px * hw * 1.8, f.y + uy * tip + py * hw * 1.8], [f.x + ux * L, f.y + uy * L],
              [f.x + ux * tip - px * hw * 1.8, f.y + uy * tip - py * hw * 1.8], [f.x + ux * tip - px * hw, f.y + uy * tip - py * hw],
              [f.x + ux * b0 - px * hw, f.y + uy * b0 - py * hw],
            ]);
          }
          break;
        }
        case 'self': {
          if (def.form === 'orbit') {
            circle(f.x, f.y, z, def.orbit, false);
            for (let i = 0; i < def.count; i++) { const t = this.time * 3.2 + (i / def.count) * Math.PI * 2; circle(f.x + Math.cos(t) * def.orbit, f.y + Math.sin(t) * def.orbit, z, def.radius + 0.2); }
          } else circle(f.x, f.y, z, def.radius * (has('delay') ? 1.2 : 1) * size);
          break;
        }
        case 'wall': {
          const t = target(), L = def.length / 2;
          shape([
            [t.x - px * L - ux * 0.5, t.y - py * L - uy * 0.5], [t.x + px * L - ux * 0.5, t.y + py * L - uy * 0.5],
            [t.x + px * L + ux * 0.5, t.y + py * L + uy * 0.5], [t.x - px * L + ux * 0.5, t.y - py * L + uy * 0.5],
          ], t.z);
          dotted(f.x, f.y, z, t.x, t.y, t.z);
          break;
        }
      }
    }
  }

  XS.Scene = Scene;
  XS.TEAM_COLORS = TEAM_COLORS;
})(globalThis.XS = globalThis.XS || {});
