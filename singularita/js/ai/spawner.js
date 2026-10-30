// Spawning: island waves and ambient creatures by day and night, the boss schedule,
// cave populations, tremors and cave hazards.
import { WaveDirector } from '../systems/waveDirector.js';
import { WAVES } from '../data/waves.js';
import { BOSSES } from '../data/bosses.js';
import { NODES } from '../data/nodes.js';
import { F } from '../world/grid.js';
import { clamp } from '../core/math.js';
import { enemyDmg } from '../systems/scaling.js';
import { SlimePrince } from './bosses/slimePrince.js';
import { Silverback } from './bosses/silverback.js';

const BOSS_CLASS = { slime_prince: SlimePrince, silverback_emperor: Silverback };

export class Spawner {
  constructor(game) {
    this.g = game;
    this.director = new WaveDirector(WAVES.island, game.rng);
    this.director.onWaveStart = (idx, total) => { this.wave = { idx, total }; game.bus.emit('waveStart', { idx, total, phase: game.dayNight.phase }); };
    this.director.onWaveEnd = (idx, cleared) => { this.wave = null; game.bus.emit('waveEnd', { idx, cleared }); if (cleared) game.profile.stats.waves++; };
    this.wave = null;
    // A fresh character gets a quiet start before the first wave.
    if (game.profile.playTime < 180) this.director.timer = 150;
    this.popT = 0; this.tremorT = 150; this.stalT = 3;
    this.boss = null; // active scheduled boss group
    game.bus.on('phase', ({ phase }) => this.onPhase(phase));
    game.bus.on('gathered', (e) => this.onGathered(e));
    game.bus.on('bossDefeated', () => { this.boss = null; });
  }

  onZoneEnter() {
    const g = this.g;
    this.vents = (g.zone.hazards || []).filter((h) => h.type !== 'stalactite').map((h) => ({ ...h, t: h.phase }));
    this.tremorT = g.rng.range(...WAVES.cave.tremor.every);
    this.boss = null;
    if (g.zone.type === 'cave') {
      // Start each layer partly populated, away from the stairs.
      const n = Math.round(this.population() * 0.6);
      for (let k = 0; k < n; k++) this.spawnCave(18, 50);
    }
  }
  onZoneExit() { this.wave = null; this.director.mode = 'calm'; this.director.timer = 30; }

  population() { const z = this.g.zoneDef; return Math.min(this.g.enemies.cap - 4, (z.population || 10)); }

  islandLevel() {
    const g = this.g, f = WAVES.island.levelFollow;
    const bonus = (g.dayNight.phase === 'night' ? 1 : 0) + Math.floor(this.director.waveIdx / 3);
    return clamp(g.profile.level + bonus + g.rng.int(-1, 1), f.min, f.max);
  }
  caveLevel() { const b = this.g.zoneDef.band; return this.g.rng.int(b[0], b[1]); }

  // A walkable, reachable spot at a distance from the player, preferably out of view.
  findSpot(minD, maxD) {
    const g = this.g, p = g.player, grid = g.grid, f = g.cam.forward;
    for (let t = 0; t < 40; t++) {
      const a = g.rng.next() * Math.PI * 2, d = g.rng.range(minD, maxD);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const i = Math.floor(x), j = Math.floor(z);
      if (!grid.walkable(i, j) || grid.has(i, j, F.NOSPAWN | F.WATER | F.BASE | F.ARENA)) continue;
      if (t < 25 && (Math.cos(a) * f.x + Math.sin(a) * f.z) > 0.35) continue;
      const fd = g.enemies.flow.distAt(x, z);
      if (fd === -1) continue;
      return { x: i + 0.5, z: j + 0.5 };
    }
    return null;
  }

  spawnCave(minD = 16, maxD = 30, id) {
    const g = this.g, z = g.zoneDef;
    const spot = this.findSpot(minD, maxD);
    if (!spot) return null;
    const side = g.zone.sideOf?.(Math.floor(spot.x));
    const table = z.enemies.filter((e) => !e.side || e.side === side);
    const pick = id || g.rng.weighted(table).id;
    const el = WAVES.cave.elite;
    const eliteChance = Math.min(el.max, el.base + el.perLayer * g.zone.layer);
    return g.enemies.spawn(pick, spot.x, spot.z, { level: this.caveLevel(), elite: g.rng.chance(eliteChance), ambient: true });
  }

  update(dt) {
    const g = this.g;
    if (!g.player.alive) return;
    if (g.zone.type === 'island') this.updateIsland(dt);
    else this.updateCave(dt);
  }

  updateIsland(dt) {
    const g = this.g;
    const reqs = this.director.update(dt, {
      phase: g.dayNight.phase, playerLevel: g.profile.level,
      waveAlive: g.enemies.count((e) => e.wave), ambientAlive: g.enemies.count((e) => e.ambient),
      paused: g.enemies.list.length >= g.enemies.cap,
    });
    for (const r of reqs) {
      const spot = this.findSpot(22, 34);
      const e = spot && g.enemies.spawn(r.id, spot.x, spot.z, { level: this.islandLevel(), elite: r.elite, wave: r.wave, ambient: !r.wave });
      if (!e && r.wave) this.director.pending.push(r.id); // try again next interval
    }
  }

  updateCave(dt) {
    const g = this.g;
    this.popT -= dt;
    if (this.popT <= 0) {
      this.popT = WAVES.cave.respawnDelay;
      if (g.enemies.count() < this.population()) this.spawnCave();
    }
    const def = g.zoneDef, layer = g.zone.layer;
    // Tremors from the fourth layer down.
    if (layer >= WAVES.cave.tremor.fromLayer) {
      this.tremorT -= dt;
      if (this.tremorT <= 0) {
        this.tremorT = g.rng.range(...WAVES.cave.tremor.every);
        g.cam.shake(0.8);
        g.ui?.banner('The cave trembles…', 'Something is digging toward you.');
        g.bus.emit('sfx', { id: 'tremor' });
        const n = g.rng.int(...WAVES.cave.tremor.size);
        for (let k = 0; k < n; k++) this.spawnCave(8, 15, k % 2 ? 'burrower' : def.enemies.find((e) => e.id === 'crystal_crawler') ? 'crystal_crawler' : 'burrower');
      }
    }
    const p = g.player, grid = g.grid;
    // Falling stalactites inside marked areas.
    if (def.hazards.includes('stalactite') && grid.has(Math.floor(p.x), Math.floor(p.z), F.HAZARD)) {
      this.stalT -= dt;
      if (this.stalT <= 0) {
        this.stalT = g.rng.range(2.5, 5);
        const x = p.x + p.vx * 0.8 + g.rng.range(-1, 1), z = p.z + p.vz * 0.8 + g.rng.range(-1, 1);
        const y = grid.height(Math.floor(x), Math.floor(z));
        g.fx.telegraph({ shape: 'circle', x, z, y, r: 1.6, t: 1.1, color: '#ffb347' });
        g.bus.emit('sfx', { id: 'creak' });
        const dmg = enemyDmg(16, def.band[0]);
        g.combat.after(1.1, () => {
          g.fx.burst(x, y + 0.3, z, 20, { color: def.palette.wall, speed: 5, up: 3 });
          g.bus.emit('sfx', { id: 'rockfall' });
          for (const t of g.combat.circle(x, z, 1.6, 'enemy')) g.combat.hurt(t, dmg, null, { type: 'hazard', status: [{ id: 'stun', dur: 0.6 }] });
        });
      }
    }
    // Vents breathe on a timer while the player is near.
    for (const v of this.vents) {
      if (Math.hypot(v.x - p.x, v.z - p.z) > 30) continue;
      v.t -= dt;
      if (v.t > 0) continue;
      v.t = v.period;
      const y = grid.height(v.i, v.j);
      const dmg = enemyDmg(9, def.band[0]);
      if (v.type === 'gas_vent') {
        g.combat.zone({ x: v.x, z: v.z, y, r: v.r, t: 3.5, interval: 0.5, team: 'enemy', color: '#9be15d',
          onTick: (ts, z) => { g.fx.burst(z.x + g.rng.range(-2, 2), y + 0.4, z.z + g.rng.range(-2, 2), 2, { color: '#9be15d', speed: 0.5, up: 1, gravity: -0.5, life: 1.2, size: 0.3 }); for (const t of ts) g.combat.hurt(t, dmg * 0.25, null, { type: 'hazard', status: [{ id: 'poison' }] }); } });
      } else {
        const fire = v.type === 'heat_vent';
        g.fx.telegraph({ shape: 'circle', x: v.x, z: v.z, y, r: 2.6, t: 0.9, color: fire ? '#ff7a3d' : '#9fd8ff' });
        g.combat.after(0.9, () => {
          g.fx.burst(v.x, y + 0.5, v.z, 24, { color: fire ? '#ff7a3d' : '#cfefff', speed: 3, up: 7, gravity: 4, life: 0.8 });
          for (const t of g.combat.circle(v.x, v.z, 2.6, 'enemy')) g.combat.hurt(t, dmg, null, { type: 'hazard', status: [{ id: fire ? 'burn' : 'chill' }] });
        });
      }
    }
  }

  // Crystal resonance: mining gems in resonant layers may wake sentries.
  onGathered({ node, x, z }) {
    const g = this.g;
    if (g.zone.type !== 'cave' || !g.zoneDef.hazards.includes('resonance')) return;
    if (!['emerald', 'ruby', 'sapphire', 'diamond'].includes(NODES[node].material)) return;
    if (!g.rng.chance(0.3)) return;
    g.overlay.text(x, g.player.ry + 2.6, z, 'The crystals resonate…', 'status');
    g.bus.emit('sfx', { id: 'resonance' });
    for (let k = 0; k < g.rng.int(1, 2); k++) {
      const a = g.rng.next() * Math.PI * 2;
      const sx = x + Math.cos(a) * 4, sz = z + Math.sin(a) * 4;
      if (g.grid.walkable(Math.floor(sx), Math.floor(sz))) g.enemies.spawn('crystal_sentry', Math.floor(sx) + 0.5, Math.floor(sz) + 0.5, { level: this.caveLevel() });
    }
  }

  // ------------------------------------------------------------------ bosses
  onPhase(phase) {
    const g = this.g;
    if (g.zone.type !== 'island') return;
    // A waiting boss who was never engaged leaves when its time is over.
    if (this.boss && !this.boss.engaged && !this.boss.defeated) {
      for (const m of this.boss.members) { m.alive = false; m.dyingT = 0; }
      g.ui?.toast(`${this.boss.def.name} grows bored and departs.`);
      this.boss = null;
    }
    for (const b of WAVES.island.bosses) {
      if (b.period !== phase || this.boss) continue;
      const def = BOSSES[b.id];
      if (g.profile.level < def.minLevel) continue;
      const pity = g.profile.world.bossPity[b.id] || 0;
      if (g.rng.next() < b.chance + pity * b.pity) { g.profile.world.bossPity[b.id] = 0; this.spawnBoss(b.id, false); }
      else g.profile.world.bossPity[b.id] = pity + 1;
    }
  }

  spawnBoss(id, engaged) {
    const g = this.g;
    const def = BOSSES[id];
    const arena = g.zone.arenas[def.arena];
    const level = Math.max(def.minLevel, g.profile.level) + def.levelOffset;
    const b = new BOSS_CLASS[id](g, level, arena);
    g.enemies.addBoss(b);
    this.boss = b.group;
    b.group.engaged = !!engaged;
    g.bus.emit('bossAppear', { def, arena });
    return b;
  }

  // Lures: Royal Jelly Bait by day in the Glade, the Echo Horn by night in the Crater.
  trySummon(bossId) {
    const g = this.g, def = BOSSES[bossId];
    if (g.zone.type !== 'island') return `${def.name} only answers on Dawnreach.`;
    if (g.dayNight.phase !== def.period) return `${def.name} only answers by ${def.period}.`;
    const a = g.zone.arenas[def.arena];
    if (Math.hypot(g.player.x - a.x, g.player.z - a.z) > a.r) return `Use it inside the ${a.name}.`;
    if (this.boss) return 'A boss is already abroad.';
    this.spawnBoss(bossId, false);
    return null;
  }
}
