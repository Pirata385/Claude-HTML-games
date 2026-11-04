// Ascension (New Game+): once the story has an ending, it can begin again with you as you are.
// You keep your level, attributes, gear, materials, lore and records; the story's keys go, the gate
// shuts, and every creature and boss stands higher, with more elites, more experience and more loot.
import { SIGILS, SHARDS } from '../data/materials.js';
import { OBJECTIVES } from '../data/objectives.js';

export const ASCENSION = {
  levels: 30,        // creature and boss levels per cycle (up to the cap)
  xp: 0.25, loot: 0.25, elite: 0.06, // per cycle
  resumeAt: 'o_isle', // where the tale picks up again
  keys: [...SIGILS, ...SHARDS, 'singular_key'],
};

export const canAscend = (p) => !!p.ending;

export function ascend(p) {
  if (!canAscend(p)) throw new Error('Ascension waits for an ending.');
  p.cycle = (p.cycle || 0) + 1;
  for (const k of ASCENSION.keys) delete p.inv.stacks[k];
  (p.flags ||= {}).gateOpen = false;
  p.ending = null;
  p.run = null;
  p.objectives = { index: OBJECTIVES.findIndex((o) => o.id === ASCENSION.resumeAt), progress: 0 };
  return p.cycle;
}

export const ascendLevel = (level, cycle = 0) => Math.min(300, level + ASCENSION.levels * (cycle || 0));
export const ascendBonus = (cycle = 0) => ({ xp: 1 + ASCENSION.xp * (cycle || 0), loot: 1 + ASCENSION.loot * (cycle || 0), elite: ASCENSION.elite * (cycle || 0) });
