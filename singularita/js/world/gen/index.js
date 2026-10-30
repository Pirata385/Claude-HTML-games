// Zone generation entry point. The world seed is fixed so the world is the same on every load.
import { hashSeed, hashStr } from '../../core/rng.js';
import { ZONES } from '../../data/zones.js';
import { generateIsland } from './island.js';
import { generateCave } from './cave.js';
import { generateIsle } from './isles.js';
import { generateDimension } from './dimensions.js';

export const WORLD_SEED = 0x51a6017a;
export const GEN_VERSION = 1;
export const zoneSeed = (zoneId) => hashSeed(WORLD_SEED, hashStr(zoneId), GEN_VERSION);

// Dimensions take a run seed (and a floor in the Endless Dungeon); everything else is fixed.
export function generateZone(zoneId, opts = {}) {
  const def = ZONES[zoneId];
  if (!def) throw new Error(`unknown zone ${zoneId}`);
  const seed = opts.seed ?? zoneSeed(zoneId);
  if (def.type === 'dimension') return generateDimension(zoneId, { seed, floor: opts.floor || 1 });
  if (def.type === 'island') return generateIsland(def, seed);
  if (def.type === 'isle') return generateIsle(def, seed);
  return generateCave(def, seed);
}
