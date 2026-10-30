// Gathering rules: a pickaxe of tier T mines nodes up to tier T + 1; trees work with bare hands.
import { bestTool } from './equipment.js';
import { HAND_POWER } from '../data/nodes.js';
import { toolRequirementText } from '../data/sources.js';

export function canGather(inv, node) {
  const tool = bestTool(inv, node.tool);
  if (node.tool === 'axe') return { ok: true, tool };
  if (!tool || tool.tier + 1 < node.tier) return { ok: false, tool, reason: `Requires ${toolRequirementText(node)}.` };
  return { ok: true, tool };
}

export const gatherDamage = (tool, gatherPower) => (tool ? tool.stats.toolPower : HAND_POWER) * gatherPower;

export function rollYield(node, luck, rng) {
  let n = rng.int(node.yield[0], node.yield[1]);
  if (luck > 0 && rng.chance(luck)) n++;
  return n;
}
