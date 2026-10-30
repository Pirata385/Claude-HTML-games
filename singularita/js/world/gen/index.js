// Zone generation entry point. The world seed is fixed so the world is the same on every load.
import { hashSeed, hashStr } from '../../core/rng.js';
import { ZONES } from '../../data/zones.js';
import { generateIsland } from './island.js';
import { generateCave } from './cave.js';
import { generateIsle } from './isles.js';

export const WORLD_SEED = 0x51a6017a;
export const GEN_VERSION = 1;
export const zoneSeed = (zoneId) => hashSeed(WORLD_SEED, hashStr(zoneId), GEN_VERSION);

export function generateZone(zoneId) {
  const def = ZONES[zoneId];
  if (!def) throw new Error(`unknown zone ${zoneId}`);
  const seed = zoneSeed(zoneId);
  if (def.type === 'island') return generateIsland(def, seed);
  if (def.type === 'isle') return generateIsle(def, seed);
  return generateCave(def, seed);
}
