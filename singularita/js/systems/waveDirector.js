// Wave director: calm periods with an ambient population, then waves composed by role.
// Pure logic: it returns spawn requests and the game places them in the world.
import { ENEMIES, ROLE_COST } from '../data/enemies.js';

export function composeWave(cfg, period, waveIdx, playerLevel, rng) {
  const budget = Math.round(cfg.budget.base + cfg.budget.perWave * waveIdx + cfg.budget.perLevel * playerLevel);
  const table = cfg.tables[period].filter((e) => waveIdx >= cfg.roleUnlock[ENEMIES[e.id].role]);
  const core = table.filter((e) => ['swarm', 'frontline'].includes(ENEMIES[e.id].role));
  const out = [];
  let spent = 0;
  // At least half the budget goes to the front line, so support roles always have someone to support.
  while (spent < budget / 2 && core.length) { const e = rng.weighted(core); out.push(e.id); spent += ROLE_COST[ENEMIES[e.id].role]; }
  while (spent < budget) {
    const left = budget - spent;
    const fits = table.filter((e) => ROLE_COST[ENEMIES[e.id].role] <= left + 1);
    if (!fits.length) break;
    const e = rng.weighted(fits);
    out.push(e.id);
    spent += ROLE_COST[ENEMIES[e.id].role];
  }
  return rng.shuffle(out);
}

export class WaveDirector {
  constructor(cfg, rng) {
    this.cfg = cfg; this.rng = rng;
    this.mode = 'calm';
    this.timer = rng.range(cfg.calm[0], cfg.calm[1]);
    this.waveIdx = 0;
    this.period = null;
    this.pending = [];
    this.spawnTimer = 0;
    this.waveTimer = 0;
    this.ambientTimer = 0;
    this.onWaveStart = null;
    this.onWaveEnd = null;
  }
  eliteChance() { const e = this.cfg.elite; return Math.min(e.max, e.base + e.perWave * this.waveIdx); }
  // ctx: { phase, playerLevel, waveAlive, ambientAlive, paused }
  update(dt, ctx) {
    const out = [];
    if (this.period !== ctx.phase) { this.period = ctx.phase; this.waveIdx = 0; }
    if (ctx.paused) return out;
    const waveAlive = ctx.waveAlive ?? ctx.alive ?? 0;
    const ambientAlive = ctx.ambientAlive ?? ctx.alive ?? 0;
    if (this.mode === 'calm') {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0 && ambientAlive < this.cfg.ambient[ctx.phase]) {
        this.ambientTimer = 3;
        out.push({ id: this.rng.weighted(this.cfg.tables[ctx.phase]).id, elite: false, wave: false });
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        this.mode = 'wave';
        this.pending = composeWave(this.cfg, ctx.phase, this.waveIdx, ctx.playerLevel, this.rng);
        this.total = this.pending.length;
        this.waveTimer = this.cfg.waveDuration;
        this.spawnTimer = 0;
        this.onWaveStart?.(this.waveIdx, this.total);
      }
    } else {
      this.waveTimer -= dt;
      this.spawnTimer -= dt;
      if (this.pending.length && this.spawnTimer <= 0) {
        this.spawnTimer = this.cfg.spawnInterval;
        const n = Math.min(this.pending.length, 2 + this.rng.int(0, 2));
        const elite = this.eliteChance();
        for (let i = 0; i < n; i++) out.push({ id: this.pending.pop(), elite: this.rng.chance(elite), wave: true });
      }
      const cleared = !this.pending.length && waveAlive === 0;
      if (cleared || (this.waveTimer <= 0 && !this.pending.length)) {
        this.onWaveEnd?.(this.waveIdx, cleared);
        this.waveIdx++;
        this.mode = 'calm';
        this.timer = this.rng.range(this.cfg.calm[0], this.cfg.calm[1]);
      }
    }
    return out;
  }
}
