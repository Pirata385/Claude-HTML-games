// Dimension runs: each portal opens a fresh run with its own layout, from entrance to ruler.
// The Endless Dungeon keeps going down, floor by floor, and remembers your deepest floor.
import { hashSeed, hashStr } from '../core/rng.js';
import { WORLD_SEED } from '../world/gen/index.js';

export const runSeed = (dimId, n) => hashSeed(WORLD_SEED, hashStr(dimId), 1000 + n);
export const isJailerFloor = (floor) => floor % 5 === 0;

const record = (p, dimId) => ((p.dims ||= {})[dimId] ||= { runs: 0, cleared: 0, bestFloor: 0 });

// returnTo: { zone, x, z } — where the portal was opened, and where the run ends.
export function startRun(p, dimId, returnTo) {
  const r = record(p, dimId);
  p.run = { dim: dimId, seed: runSeed(dimId, r.runs), floor: 1, kills: 0, startedAt: p.playTime, returnTo };
  r.runs++;
  p.zones[dimId] = { nodes: {}, fog: null };
  return p.run;
}

export function nextFloor(run) {
  run.floor++;
  return run.floor;
}

// The Endless Dungeon grows harder with depth (to the level cap); the others keep their band.
export function runLevel(def, run) {
  if (def.rule === 'keys') return Math.min(300, def.band[0] + (run.floor - 1) * 4);
  return Math.round((def.band[0] + def.band[1]) / 2);
}

// outcome: 'complete' (the ruler fell), 'leave' (took a stair out), 'fail' (death or recall).
export function endRun(p, outcome) {
  const run = p.run;
  if (!run) return null;
  const r = record(p, run.dim);
  if (outcome === 'complete') r.cleared++;
  if (outcome !== 'fail' || run.floor > 1) r.bestFloor = Math.max(r.bestFloor, run.floor);
  p.run = null;
  return { dim: run.dim, floor: run.floor, kills: run.kills, outcome, returnTo: run.returnTo };
}
