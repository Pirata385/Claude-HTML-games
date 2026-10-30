// What the isles do to you: updraft flights and gales on the spires, the tide on the atoll,
// lava and eruptions on Cinderspine, quakes on the mesas.
import { F } from './grid.js';
import { moveCircle, groundAt } from './physics.js';
import { applyTide, tideAt } from './tide.js';
import { updraftArc, FLIGHT_TIME } from './updraft.js';
import { enemyDmg } from '../systems/scaling.js';

const TIDE_LINES = {
  low: 'Low tide: the sandbars and pearl beds are uncovered.',
  rising: 'The tide is rising. Get off the sandbars!',
  high: 'High tide. The temple islet is cut off.',
  falling: 'The tide is going out.',
};

export class Phenomena {
  constructor(game) {
    this.g = game;
    this.kinds = new Set();
  }

  onZoneEnter() {
    const g = this.g, z = g.zone;
    this.kinds = new Set(z.def.phenomena || []);
    this.flight = null;
    this.padCd = 0;
    this.gust = null;
    this.gustT = g.rng.range(16, 24);
    this.eruptT = g.rng.range(8, 12);
    this.quakeT = g.rng.range(20, 28);
    this.lavaT = 0;
    this.ashT = 0;
    this.tideT = 0;
    this.tidePhase = null;
    if (this.kinds.has('tide')) this.updateTide(true);
  }

  onZoneExit() {
    const p = this.g.player;
    if (this.flight) { p.carried = false; this.flight = null; }
  }

  dmg(base) { return enemyDmg(base, this.g.zoneDef.band[0]); }

  update(dt) {
    const g = this.g, p = g.player;
    if (!this.kinds.size || !p.alive) { if (this.flight) this.onZoneExit(); return; }
    if (this.kinds.has('updrafts')) this.updateUpdrafts(dt);
    if (this.kinds.has('gusts')) this.updateGusts(dt);
    if (this.kinds.has('tide')) this.updateTide(false, dt);
    if (this.kinds.has('lava')) this.updateLava(dt);
    if (this.kinds.has('eruptions')) this.updateEruptions(dt);
    if (this.kinds.has('quakes')) this.updateQuakes(dt);
  }

  // ------------------------------------------------------------------ air
  updateUpdrafts(dt) {
    const g = this.g, p = g.player, z = g.zone;
    if (this.flight) {
      const f = this.flight;
      f.t += dt / FLIGHT_TIME;
      const q = updraftArc(f.u, Math.min(1, f.t));
      p.x = q.x; p.z = q.z; p.y = p.ry = q.y;
      p.vx = p.vz = p.vy = 0;
      p.iframes = Math.max(p.iframes, 0.25);
      p.yaw = Math.atan2(f.u.to.x - f.u.x, f.u.to.z - f.u.z);
      if (Math.random() < 0.5) g.fx.burst(p.x, p.y + 0.5, p.z, 1, { color: '#e8f6ff', speed: 1, up: -1, life: 0.5, size: 0.18 });
      if (f.t >= 1) {
        p.carried = false;
        p.y = p.ry = groundAt(g.grid, p.x, p.z);
        p.grounded = true;
        this.flight = null;
        this.padCd = 1.5;
        g.bus.emit('land', { hard: false });
      }
      return;
    }
    this.padCd -= dt;
    // Pads breathe: a few motes rise from each nearby vent.
    for (const u of z.updrafts) {
      const d2 = (u.x - p.x) ** 2 + (u.z - p.z) ** 2;
      if (d2 < 900 && Math.random() < dt * 6) g.fx.burst(u.x + (Math.random() - 0.5) * 1.6, u.h + 0.2, u.z + (Math.random() - 0.5) * 1.6, 1, { color: '#cfefff', speed: 0.2, up: 5, gravity: -2, life: 1.0, size: 0.16 });
      if (this.padCd <= 0 && p.grounded && d2 < 1.1 * 1.1) {
        this.flight = { u, t: 0 };
        p.carried = true;
        g.bus.emit('sfx', { id: 'gust' });
        g.bus.emit('updraft', {});
        break;
      }
    }
  }

  updateGusts(dt) {
    const g = this.g, p = g.player;
    if (this.gust) {
      const s = this.gust;
      s.t -= dt;
      if (!p.carried) moveCircle(g.grid, p, s.dx * 3.2 * dt, s.dz * 3.2 * dt, p.radius, 1.05);
      if (Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 12;
        g.fx.burst(p.x + Math.cos(a) * r - s.dx * 6, p.ry + 0.5 + Math.random() * 3, p.z + Math.sin(a) * r - s.dz * 6, 1, { color: '#ffffff', speed: 0.3, up: 0, gravity: 0, life: 0.7, size: 0.1, vx: s.dx * 16, vz: s.dz * 16 });
      }
      if (s.t <= 0) this.gust = null;
      return;
    }
    this.gustT -= dt;
    if (this.gustT > 0) return;
    this.gustT = g.rng.range(20, 30);
    const a = g.rng.next() * Math.PI * 2;
    this.gust = { dx: Math.cos(a), dz: Math.sin(a), t: 4 };
    g.ui?.banner('A gale sweeps the spires', 'Brace yourself: the wind pushes everything with it.');
    g.bus.emit('sfx', { id: 'gust' });
  }

  // ------------------------------------------------------------------ water
  updateTide(force, dt = 0) {
    const g = this.g, z = g.zone, p = g.player;
    this.tideT -= dt;
    if (!force && this.tideT > 0) return;
    this.tideT = 0.5;
    const { level, phase } = tideAt(g.profile.playTime);
    if (force || Math.abs(level - (z.tideLevel ?? -99)) > 0.04) {
      applyTide(z, level);
      g.view?.setWaterLevel?.(level + 0.12);
      g.enemies?.flow?.invalidate?.();
    }
    if (phase !== this.tidePhase) {
      if (this.tidePhase) g.ui?.toast(TIDE_LINES[phase], phase === 'rising' ? 'warn' : 'info', 5);
      this.tidePhase = phase;
      g.bus.emit('tide', { phase });
    }
    // Caught by the water: the current drags you to the nearest dry ground.
    const i = Math.floor(p.x), j = Math.floor(p.z);
    if (!p.carried && g.grid.has(i, j, F.DEEP)) {
      const spot = nearestWalkable(g.grid, i, j, 60);
      if (spot) {
        p.x = spot[0] + 0.5; p.z = spot[1] + 0.5;
        p.y = p.ry = groundAt(g.grid, p.x, p.z);
        p.grounded = true;
        g.combat.hurt(p, this.dmg(8), null, { type: 'hazard' });
        g.ui?.toast('The tide drags you ashore.', 'warn');
      }
    }
  }

  // ------------------------------------------------------------------ fire
  updateLava(dt) {
    const g = this.g, p = g.player;
    this.lavaT -= dt;
    this.ashT -= dt;
    if (this.ashT <= 0) {
      this.ashT = 0.12;
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 14;
      g.fx.burst(p.x + Math.cos(a) * r, p.ry + 4 + Math.random() * 4, p.z + Math.sin(a) * r, 1, { color: Math.random() < 0.2 ? '#ff8a3d' : '#5a4a46', speed: 0.2, up: -0.6, gravity: 0.2, life: 2.2, size: 0.1 });
    }
    if (this.lavaT > 0 || p.carried) return;
    const i = Math.floor(p.x), j = Math.floor(p.z);
    if (p.grounded && g.grid.has(i, j, F.LAVA)) {
      this.lavaT = 0.5;
      g.combat.hurt(p, this.dmg(14), null, { type: 'hazard', status: [{ id: 'burn' }] });
      g.fx.burst(p.x, p.ry + 0.2, p.z, 6, { color: '#ff7a1a', speed: 2, up: 3, life: 0.5 });
    }
  }

  updateEruptions(dt) {
    const g = this.g, p = g.player, grid = g.grid;
    this.eruptT -= dt;
    if (this.eruptT > 0) return;
    this.eruptT = g.rng.range(12, 18);
    g.cam.shake(0.5);
    g.bus.emit('sfx', { id: 'tremor' });
    const n = g.rng.int(5, 7);
    for (let k = 0; k < n; k++) {
      const a = g.rng.next() * Math.PI * 2, r = k === 0 ? g.rng.range(0, 2) : g.rng.range(4, 14);
      const x = p.x + Math.cos(a) * r, zz = p.z + Math.sin(a) * r;
      const ci = Math.floor(x), cj = Math.floor(zz);
      if (!grid.inside(ci, cj) || grid.has(ci, cj, F.WATER)) continue;
      const y = grid.height(ci, cj);
      const delay = 1.4 + k * 0.15;
      g.fx.telegraph({ shape: 'circle', x, z: zz, y, r: 1.8, t: delay, color: '#ff5a1a' });
      g.combat.after(delay, () => {
        g.fx.burst(x, y + 0.4, zz, 20, { color: '#ff7a1a', speed: 5, up: 5 });
        g.fx.burst(x, y + 0.4, zz, 10, { color: '#3a2a26', speed: 3, up: 4 });
        g.bus.emit('sfx', { id: 'rockfall', x, z: zz });
        for (const t of g.combat.circle(x, zz, 1.8, 'enemy')) g.combat.hurt(t, this.dmg(22), null, { type: 'hazard', status: [{ id: 'burn' }] });
      });
    }
  }

  // ------------------------------------------------------------------ earth
  updateQuakes(dt) {
    const g = this.g, p = g.player, grid = g.grid;
    this.quakeT -= dt;
    if (this.quakeT > 0) return;
    this.quakeT = g.rng.range(25, 35);
    g.cam.shake(1.0);
    g.ui?.banner('The ground heaves', 'Stone spikes burst up. Keep moving.');
    g.bus.emit('sfx', { id: 'tremor' });
    for (let k = 0; k < 8; k++) {
      const a = g.rng.next() * Math.PI * 2, r = k < 2 ? g.rng.range(0, 3) : g.rng.range(3, 12);
      const x = p.x + Math.cos(a) * r, zz = p.z + Math.sin(a) * r;
      const ci = Math.floor(x), cj = Math.floor(zz);
      if (!grid.walkable(ci, cj) || grid.has(ci, cj, F.WATER)) continue;
      const y = grid.height(ci, cj);
      const delay = 1.0 + k * 0.12;
      g.fx.telegraph({ shape: 'circle', x, z: zz, y, r: 1.4, t: delay, color: '#c8885a' });
      g.combat.after(delay, () => {
        g.fx.column(x, y, zz, '#9a6a4a', 14, 0.6);
        g.fx.burst(x, y + 0.6, zz, 12, { color: '#b8784a', speed: 3, up: 6 });
        for (const t of g.combat.circle(x, zz, 1.4, 'enemy')) g.combat.hurt(t, this.dmg(18), null, { type: 'hazard', status: [{ id: 'stun', dur: 0.5 }] });
      });
    }
  }
}

// Ring search for the closest standing room.
export function nearestWalkable(grid, i0, j0, maxR) {
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = Infinity;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj;
      if (!grid.walkable(i, j) || grid.has(i, j, F.WATER | F.LAVA)) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = [i, j]; }
    }
    if (best) return best;
  }
  return null;
}
