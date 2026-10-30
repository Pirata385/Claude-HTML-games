// "Where to find": derived from zones, nodes, enemies and bosses so it always matches the game.
import { MATERIALS, MAIN_MATERIALS } from './materials.js';
import { NODES } from './nodes.js';
import { ENEMIES } from './enemies.js';
import { BOSSES } from './bosses.js';
import { ZONES, ZONE_ORDER } from './zones.js';
import { TIER_RECIPE_LEVEL } from './materials.js';

const tierNames = (t) => MAIN_MATERIALS.filter((id) => MATERIALS[id].tier === t).map((id) => MATERIALS[id].name);
export function toolRequirementText(node) {
  if (node.tool === 'axe') return 'Bare hands or any Axe';
  const t = Math.max(0, node.tier - 1);
  return `${tierNames(t).join(' or ')} Pickaxe or better`;
}
export function toolRequirementLevel(node) {
  if (node.tool === 'axe') return 1;
  return TIER_RECIPE_LEVEL[Math.max(0, node.tier - 1)];
}

const cache = new Map();
export function findSources(materialId) {
  if (cache.has(materialId)) return cache.get(materialId);
  const out = [];
  for (const zid of ZONE_ORDER) {
    const z = ZONES[zid];
    for (const n of z.nodes) {
      const nd = NODES[n.node];
      if (nd.material !== materialId) continue;
      out.push({ zone: zid, level: Math.max(z.levelReq, toolRequirementLevel(nd)), kind: 'node',
        how: `${nd.name} in ${z.name}${n.side ? ` (${n.side} side)` : ''} — ${toolRequirementText(nd)}` });
    }
    for (const e of z.enemies) {
      const en = ENEMIES[e.id];
      const d = en.drops.find((x) => x.id === materialId);
      if (!d) continue;
      const when = en.family === 'slime' && zid === 'island' ? ' by day' : en.family === 'zombie' && zid === 'island' ? ' by night' : '';
      out.push({ zone: zid, level: z.levelReq, kind: 'drop', how: `Dropped by ${en.name}${when} in ${z.name} (${Math.round(d.chance * 100)}%)` });
    }
  }
  for (const b of Object.values(BOSSES)) {
    if (b.rewards.some((r) => r.material === materialId)) out.push({ zone: 'island', level: b.minLevel, kind: 'boss', how: `Reward from ${b.name}` });
  }
  cache.set(materialId, out);
  return out;
}
