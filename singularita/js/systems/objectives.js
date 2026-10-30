// The objectives chain: event-driven progress, plus state checks for goals already met.
import { OBJECTIVES } from '../data/objectives.js';

const matches = (target, value) => target === 'any' || target.split('|').includes(value);

export class ObjectiveTracker {
  constructor(profile) { this.p = profile; }
  get current() { return OBJECTIVES[this.p.objectives.index] || null; }

  // Returns the completed objective, or null.
  handle(ev) {
    const o = this.current;
    if (!o) return null;
    let inc = 0;
    switch (o.type) {
      case 'gather': if (ev.type === 'gathered' && matches(o.target, ev.material)) inc = ev.n; break;
      case 'craft': case 'craftAny': if (ev.type === 'crafted' && matches(o.target, ev.item)) inc = 1; break;
      case 'equip': if (ev.type === 'equipped' && ev.slot === o.target && ev.tier >= (o.minTier || 0)) inc = o.count; break;
      case 'kill': if (ev.type === 'kill') inc = 1; break;
      case 'allocate': if (ev.type === 'allocate') inc = 1; break;
      case 'reach': if (ev.type === 'zone' && ev.id === o.target) inc = 1; break;
      case 'boss': if (ev.type === 'boss') inc = 1; break;
      case 'lore': if (ev.type === 'lore' && matches(o.target, ev.id)) inc = 1; break;
      default: break;
    }
    if (!inc) return null;
    this.p.objectives.progress += inc;
    if (this.p.objectives.progress < o.count) return null;
    return this.advance();
  }

  advance() {
    const o = this.current;
    this.p.objectives.index++;
    this.p.objectives.progress = 0;
    return o;
  }

  // Completes goals whose condition is already true (e.g. a layer reached before the goal came up).
  checkImmediate(ctx = {}) {
    const done = [];
    for (let guard = 0; guard < OBJECTIVES.length; guard++) {
      const o = this.current;
      if (!o) break;
      const p = this.p;
      let ok = false;
      if (o.type === 'reach') ok = !!p.zones[o.target];
      else if (o.type === 'lore') ok = p.lore.includes(o.target);
      else if (o.type === 'boss') ok = Object.keys(p.stats.bosses).length > 0;
      else if (o.type === 'allocate') ok = Object.values(p.attrs).some((v) => v > 0);
      else if (o.type === 'equip') ok = (ctx.weaponTier ?? -1) >= (o.minTier || 0);
      else if (o.type === 'craft' || o.type === 'craftAny') ok = o.target.split('|').some((id) => p.stats.crafted[`craft_${id}`]);
      if (!ok) break;
      done.push(this.advance());
    }
    return done;
  }
}
