// Spawning: the endless island horde by day and night, the roaming bosses,
// cave and isle populations, the isle guardians, tremors and cave hazards.
import { Horde, BossClock } from '../systems/horde.js';
import { ENEMIES } from '../data/enemies.js';
import { runLevel } from '../systems/run.js';
import { WAVES } from '../data/waves.js';
import { BOSSES } from '../data/bosses.js';
import { NODES } from '../data/nodes.js';
import { F } from '../world/grid.js';
import { enemyDmg } from '../systems/scaling.js';
import { SlimePrince } from './bosses/slimePrince.js';
import { Silverback } from './bosses/silverback.js';
import { Ronin } from './bosses/ronin.js';
import { Tears } from './bosses/tears.js';
import { MagmaVector } from './bosses/magmaVector.js';
import { AlleleGolem } from './bosses/alleleGolem.js';

const BOSS_CLASS = { slime_prince: SlimePrince, silverback_emperor: Silverback, ronin_east_wind: Ronin, tears_of_poseidon: Tears, magma_vector: MagmaVector, allele_golem: AlleleGolem };

export class Spawner {
  constructor(game) {
    this.g = game;
    this.horde = new Horde(WAVES.island, game.rng);
    this.bossClock = new BossClock(WAVES.island, game.rng, game.profile.world.bossTimer);
    this.popT = 0; this.tremorT = 150; this.stalT = 3;
    this.boss = null; // active scheduled boss group
    game.bus.on('phase', () => this.onPhase());
    game.bus.on('gathered', (e) => this.onGathered(e));
    game.bus.on('bossDefeated', ({ def }) => {
      this.boss = null;
      // Isle guardians come back to their arenas a while after each defeat.
      if (def.zone && def.zone !== 'island') (game.profile.world.guardians ||= {})[def.id] = game.profile.playTime + def.respawn;
    });
  }

  onZoneEnter() {
    const g = this.g;
    this.vents = (g.zone.hazards || []).filter((h) => h.type !== 'stalactite').map((h) => ({ ...h, t: h.phase }));
    this.tremorT = g.rng.range(...WAVES.cave.tremor.every);
    this.boss = null;
    if (g.zone.type === 'cave' || g.zone.type === 'isle' || g.zone.type === 'dimension') {
      // Start each layer, isle and dimension partly populated, away from the way in.
      const n = Math.round(this.population() * 0.6);
      for (let k = 0; k < n; k++) this.spawnCave(18, 50);
    }
    if (g.zone.type === 'isle') this.spawnGuardian();
    if (g.zone.type === 'dimension') this.spawnDimension();
  }
  onZoneExit() {}

  population() { const z = this.g.zoneDef; return Math.min(this.g.enemies.cap - 4, Math.round((z.population || 10) * (this.g.zone.modifier === 'swarm' ? 1.5 : 1))); }

  caveLevel() {
    const g = this.g;
    if (g.zone.type === 'dimension' && g.profile.run) return Math.min(300, runLevel(g.zoneDef, g.profile.run) + g.rng.int(-2, 2));
    const b = g.zoneDef.band;
    return g.rng.int(b[0], b[1]);
  }

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
    const el = g.zone.type === 'cave' ? WAVES.cave.elite : WAVES.isle.elite;
    const eliteChance = g.zone.modifier === 'elite' ? 0.35 : Math.min(el.max, el.base + el.perLayer * (g.zone.layer || 0));
    return g.enemies.spawn(pick, spot.x, spot.z, { level: this.caveLevel(), elite: g.rng.chance(eliteChance), ambient: true });
  }

  update(dt) {
    const g = this.g;
    if (!g.player.alive) return;
    if (g.zone.type === 'island') this.updateIsland(dt);
    else if (g.zone.type === 'isle' || g.zone.type === 'dimension') this.updateIsle(dt);
    else this.updateCave(dt);
  }

  updateIsland(dt) {
    const g = this.g;
    // Creatures left far behind wander off, so the horde follows you around the island.
    for (const e of g.enemies.list) if (e.horde && e.alive && e.tier === 'dormant' && e.dormantT > 20) { e.alive = false; e.dyingT = 0; }
    let alive = 0, core = 0;
    for (const e of g.enemies.list) if (e.alive && e.horde) { alive++; if (['swarm', 'frontline', 'tank'].includes(ENEMIES[e.def.id].role)) core++; }
    // A brand-new castaway gets a thinner horde for the first few minutes.
    const target = g.profile.playTime < 240 ? 4 : undefined;
    for (const r of this.horde.update(dt, { phase: g.dayNight.phase, alive, core, cap: g.enemies.cap - 4, target })) {
      const spot = this.findSpot(22, 34);
      if (spot) g.enemies.spawn(r.id, spot.x, spot.z, { level: r.level, elite: r.elite, horde: true, ambient: true });
    }
    // Roaming bosses: a random clock, paused while one is abroad.
    const id = this.bossClock.update(dt, { phase: g.dayNight.phase, level: g.profile.level, bossAbroad: !!this.boss });
    g.profile.world.bossTimer = this.bossClock.timer;
    if (id) this.spawnBoss(id, false);
  }

  // The isles keep a living population at their own fixed levels, like the caves.
  updateIsle(dt) {
    const g = this.g;
    this.popT -= dt;
    if (this.popT <= 0) {
      this.popT = WAVES.isle.respawnDelay;
      if (g.enemies.count((e) => !e.boss && !e.summoned) < this.population()) this.spawnCave();
    }
  }

  // A dimension run: the Warden with the key, or the ruler in its arena.
  spawnDimension() {
    const g = this.g, z = g.zone;
    if (z.warden) {
      const e = g.enemies.spawn('jail_warden', z.warden.x, z.warden.z, { level: this.caveLevel() + 2, summoned: true });
      if (e) g.ui?.toast('A Gaol Warden holds the key to this floor\'s stair.', 'info', 5);
    }
    if (z.arena && BOSS_CLASS[z.arena.boss]) this.spawnBoss(z.arena.boss, false);
  }

  // Each isle's guardian waits in its arena unless it fell recently.
  spawnGuardian() {
    const g = this.g;
    const def = Object.values(BOSSES).find((b) => b.zone === g.zone.id);
    if (!def || (g.profile.world.guardians?.[def.id] || 0) > g.profile.playTime) return;
    this.spawnBoss(def.id, false);
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
      } else if (v.type === 'radiance') {
        // Dawn crystals flare: a blinding burst.
        g.fx.telegraph({ shape: 'circle', x: v.x, z: v.z, y, r: 3.2, t: 1.0, color: '#ffe9a8' });
        g.combat.after(1.0, () => {
          g.fx.burst(v.x, y + 1.2, v.z, 30, { color: '#fff4c8', speed: 6, up: 4, life: 0.6 });
          g.fx.column(v.x, y, v.z, '#ffe9a8', 16, 0.8);
          for (const t of g.combat.circle(v.x, v.z, 3.2, 'enemy')) g.combat.hurt(t, dmg, null, { type: 'hazard', status: [{ id: 'blind' }] });
        });
      } else if (v.type === 'umbral') {
        v.t = 0.5;
        // Dusk pools: standing in one slows you and drains your resource.
        if (Math.hypot(p.x - v.x, p.z - v.z) < v.r - 0.3) {
          p.statuses.apply('slow', { dur: 1 });
          p.res = Math.max(0, p.res - g.stats.resourceMax * 0.05);
          g.fx.burst(p.x, p.ry + 0.3, p.z, 2, { color: '#8a5aff', speed: 0.6, up: 1.5, life: 0.6, size: 0.14 });
        }
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
  onPhase() {
    const g = this.g;
    if (g.zone.type !== 'island') return;
    // A waiting boss who was never engaged leaves when its time is over.
    if (this.boss && !this.boss.engaged && !this.boss.defeated) {
      for (const m of this.boss.members) { m.alive = false; m.dyingT = 0; }
      g.ui?.toast(`${this.boss.def.name} grows bored and departs.`);
      this.boss = null;
    }
  }

  spawnBoss(id, engaged) {
    const g = this.g;
    const def = BOSSES[id];
    const arena = g.zone.arenas ? g.zone.arenas[def.arena] : g.zone.arena;
    // Bosses have fixed levels, like the creatures of their island; the Jailer grows with the gaol.
    const level = g.zone.type === 'dimension' && g.profile.run ? Math.min(300, runLevel(g.zoneDef, g.profile.run) + def.levelOffset) : def.minLevel + def.levelOffset;
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
