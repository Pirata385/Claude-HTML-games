// The endless horde of Dawnreach: creatures keep coming a few at a time, with no waves,
// no announcements and no growth in strength. Bosses roam on a random clock.
// Pure logic: it returns spawn requests and the game places them in the world.
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';

const CORE = new Set(['swarm', 'frontline', 'tank']);

export const islandLevel = (cfg, phase, rng) => rng.int(...cfg.levels[phase]);

// Chance that a creature in a cave, isle or dimension spawns elite. Caves grow more elite with
// depth unless the zone sets its own rate; a dimension's Elite modifier overrides everything.
export function eliteChance(def, zone, waves) {
  if (zone.modifier === 'elite') return 0.35;
  if (def.elite != null) return def.elite;
  const el = zone.type === 'cave' ? waves.cave.elite : waves.isle.elite;
  return Math.min(el.max, el.base + el.perLayer * (zone.layer || 0));
}

export class Horde {
  constructor(cfg, rng) {
    this.cfg = cfg; this.rng = rng;
    this.timer = 0;
  }
  // ctx: { phase, alive, core (front-liners alive), cap, target (overrides the population) }
  update(dt, ctx) {
    const out = [];
    this.timer -= dt;
    if (this.timer > 0) return out;
    this.timer = this.cfg.spawnInterval;
    const room = Math.min(ctx.target ?? this.cfg.population[ctx.phase], ctx.cap ?? Infinity) - ctx.alive;
    const n = Math.min(room, 1 + this.rng.int(0, 1));
    let core = ctx.core ?? 0;
    for (let k = 0; k < n; k++) {
      // Healers, screamers and bloaters only come when there is a front line to stand behind.
      const table = this.cfg.tables[ctx.phase].filter((e) => core >= 3 || CORE.has(ENEMIES[e.id].role));
      const e = this.rng.weighted(table);
      if (CORE.has(ENEMIES[e.id].role)) core++;
      out.push({ id: e.id, elite: this.rng.chance(this.cfg.elite), level: islandLevel(this.cfg, ctx.phase, this.rng) });
    }
    return out;
  }
}

export class BossClock {
  constructor(cfg, rng, timer) {
    this.cfg = cfg; this.rng = rng;
    this.timer = timer ?? this.cooldown();
  }
  cooldown() { return this.rng.range(...this.cfg.bossCooldown); }
  // ctx: { phase, level, bossAbroad }. Returns the id of the boss to spawn now, or null.
  update(dt, ctx) {
    if (ctx.bossAbroad) return null;
    this.timer -= dt;
    if (this.timer > 0) return null;
    const ok = this.cfg.bosses.filter((b) => b.period === ctx.phase && BOSSES[b.id].minLevel <= ctx.level);
    if (!ok.length) { this.timer = 60; return null; }
    this.timer = this.cooldown();
    return this.rng.pick(ok).id;
  }
}
