// The tide of Tidecrown Atoll: a cycle of low, rising, high and falling water.
// Tidal cells switch between dry, shallow (slow) and deep (impassable) as the level moves.
import { F } from './grid.js';

export const SEA = 3;
export const TIDE = { low: SEA - 1.5, high: SEA + 1.5 };
export const TIDE_CYCLE = { low: 40, rise: 14, high: 30, fall: 14 };
const LEN = TIDE_CYCLE.low + TIDE_CYCLE.rise + TIDE_CYCLE.high + TIDE_CYCLE.fall;

// Level and phase name at time t (seconds).
export function tideAt(t) {
  const c = ((t % LEN) + LEN) % LEN;
  const { low, rise, high } = TIDE_CYCLE;
  const ease = (x) => x * x * (3 - 2 * x);
  if (c < low) return { level: TIDE.low, phase: 'low' };
  if (c < low + rise) return { level: TIDE.low + (TIDE.high - TIDE.low) * ease((c - low) / rise), phase: 'rising' };
  if (c < low + rise + high) return { level: TIDE.high, phase: 'high' };
  return { level: TIDE.high - (TIDE.high - TIDE.low) * ease((c - low - rise - high) / TIDE_CYCLE.fall), phase: 'falling' };
}

// Re-flags tidal cells for a water level. Returns how many cells changed state.
export function applyTide(zone, level) {
  const g = zone.grid;
  let changed = 0;
  for (const k of zone.tidal) {
    const before = g.flags[k] & (F.WATER | F.DEEP);
    let f = g.flags[k] & ~(F.WATER | F.DEEP);
    if (g.h[k] < level + 0.5) f |= F.WATER;
    if (g.h[k] < level - 1) f |= F.DEEP;
    g.flags[k] = f;
    if ((f & (F.WATER | F.DEEP)) !== before) changed++;
  }
  zone.tideLevel = level;
  return changed;
}
