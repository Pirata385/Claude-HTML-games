// Active status effects on an entity: timers, stacks, damage over time and the stat modifiers they imply.
import { STATUS } from '../data/status.js';

export class StatusSet {
  constructor() { this.map = new Map(); }
  // opts: { dur, stacks, src, power (damage basis for DoTs), value }
  apply(id, opts = {}) {
    const def = STATUS[id];
    if (!def) return null;
    const cur = this.map.get(id);
    const dur = opts.dur ?? def.duration;
    if (cur) {
      cur.t = Math.max(cur.t, dur);
      if (def.maxStacks) cur.stacks = Math.min(def.maxStacks, cur.stacks + (opts.stacks || 1));
      if (opts.power) cur.power = Math.max(cur.power || 0, opts.power);
      if (opts.value != null) cur.value = opts.value;
      if (opts.src) cur.src = opts.src;
      return cur;
    }
    const s = { id, t: dur, max: dur, stacks: opts.stacks || 1, src: opts.src || null, power: opts.power || 0, value: opts.value ?? 0, tick: 0 };
    this.map.set(id, s);
    return s;
  }
  has(id) { return this.map.has(id); }
  harmfulCount() { let n = 0; for (const id of this.map.keys()) if (STATUS[id]?.harmful) n++; return n; }
  get(id) { return this.map.get(id); }
  remove(id) { this.map.delete(id); }
  clear() { this.map.clear(); }
  // Calls onDot(amount, statusId, src) once per second per damaging status.
  update(dt, onDot) {
    for (const [id, s] of this.map) {
      s.t -= dt;
      const def = STATUS[id];
      if (def.dotFrac && s.power > 0) {
        s.tick += dt;
        while (s.tick >= 0.5) { s.tick -= 0.5; onDot?.(s.power * def.dotFrac * 0.5 * s.stacks, id, s.src); }
      }
      if (s.t <= 0) this.map.delete(id);
    }
  }
  get stunned() { return this.has('stun') || this.has('freeze'); }
  get rooted() { return this.has('root') || this.stunned; }
  get slowMult() {
    let m = 1;
    const c = this.get('chill'); if (c) m *= 1 - STATUS.chill.slow * c.stacks;
    if (this.has('slow')) m *= 1 - STATUS.slow.slow;
    if (this.has('haste')) m *= 1 + STATUS.haste.speed;
    return Math.max(0.2, m);
  }
  // Damage taken multiplier (vulnerabilities) for a given attacker.
  vulnFrom(src) {
    let m = 1;
    if (this.has('shock')) m += STATUS.shock.vuln;
    const mk = this.get('marked'); if (mk && (!mk.src || mk.src === src)) m += STATUS.marked.vuln;
    if (this.has('guarded')) m *= 1 - STATUS.guarded.dr;
    return m;
  }
  get defMult() { return this.has('sunder') ? 1 - STATUS.sunder.defDown : 1; }
  get missChance() { return this.has('blind') ? STATUS.blind.miss : 0; }
}
