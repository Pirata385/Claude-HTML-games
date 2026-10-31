// Day/night clock for the island. `sun` is the sun's height: +1 noon, −1 midnight.
export class DayNight {
  constructor({ dayLen, nightLen }, clock = 0) {
    this.dayLen = dayLen; this.nightLen = nightLen; this.len = dayLen + nightLen;
    this.clock = ((clock % this.len) + this.len) % this.len;
  }
  advance(dt) { this.clock = (this.clock + dt) % this.len; }
  get phase() { return this.clock < this.dayLen ? 'day' : 'night'; }
  get progress() { return this.phase === 'day' ? this.clock / this.dayLen : (this.clock - this.dayLen) / this.nightLen; }
  get sun() { const s = Math.sin(Math.PI * this.progress); return this.phase === 'day' ? s : -s; }
  // Seconds left in the current phase.
  get remaining() { return this.phase === 'day' ? this.dayLen - this.clock : this.len - this.clock; }
}

// How much a lantern is needed, from the sun's height: 0 by day, rising through dusk, 1 at night.
export function nightGlow(sun) {
  const t = Math.min(1, Math.max(0, (0.15 - sun) / 0.4));
  return t * t * (3 - 2 * t);
}
