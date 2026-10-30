// Resource nodes placed by the world generators.
// Pickaxe rule: a pickaxe of tier T mines nodes up to tier T + 1. Trees need no tool.

const HP_BASE = 6, HP_GROWTH = 1.45;
const nodeHp = (tier) => Math.round(HP_BASE * HP_GROWTH ** tier);

const ore = (material, tier, o = {}) => ({
  id: `ore_${material}`, material, tier, tool: 'pickaxe', hp: nodeHp(tier),
  yield: [1, 3], respawn: 150 + tier * 20, xp: 2 + tier * 3, model: 'ore', ...o,
});

export const NODES = {
  tree_oak: { id: 'tree_oak', name: 'Oak', material: 'wood', tier: 0, tool: 'axe', hp: 6, yield: [2, 4], respawn: 90, xp: 1, model: 'oak' },
  tree_pine: { id: 'tree_pine', name: 'Pine', material: 'wood', tier: 0, tool: 'axe', hp: 7, yield: [2, 5], respawn: 100, xp: 1, model: 'pine' },
  tree_birch: { id: 'tree_birch', name: 'Pale Birch', material: 'wood', tier: 0, tool: 'axe', hp: 6, yield: [2, 4], respawn: 90, xp: 1, model: 'birch' },
  boulder: { id: 'boulder', name: 'Boulder', material: 'stone', tier: 1, tool: 'pickaxe', hp: nodeHp(1), yield: [2, 4], respawn: 120, xp: 2, model: 'boulder' },
  ore_stone: ore('stone', 1, { name: 'Stone Seam', yield: [2, 4], respawn: 110 }),
  ore_copper: ore('copper', 2, { name: 'Copper Vein' }),
  ore_gold: ore('gold', 2, { name: 'Gold Vein', yield: [1, 2] }),
  ore_iron: ore('iron', 3, { name: 'Iron Vein' }),
  ore_lead: ore('lead', 4, { name: 'Lead Vein' }),
  ore_titanium: ore('titanium', 4, { name: 'Titanium Vein' }),
  ore_emerald: ore('emerald', 5, { name: 'Emerald Cluster', yield: [1, 2] }),
  ore_ruby: ore('ruby', 6, { name: 'Ruby Cluster', yield: [1, 2] }),
  ore_sapphire: ore('sapphire', 6, { name: 'Sapphire Cluster', yield: [1, 2] }),
  ore_diamond: ore('diamond', 7, { name: 'Diamond Geode', yield: [1, 2] }),
  ore_dawndosite: ore('dawndosite', 8, { name: 'Dawndosite Bloom', yield: [1, 2], model: 'ore' }),
  ore_escuresite: ore('escuresite', 8, { name: 'Escuresite Knot', yield: [1, 2], model: 'ore' }),

  // Elemental isles.
  tree_cloudpine: { id: 'tree_cloudpine', name: 'Cloud Pine', material: 'wood', tier: 0, tool: 'axe', hp: 7, yield: [2, 4], respawn: 100, xp: 2, model: 'cloudpine' },
  tree_palm: { id: 'tree_palm', name: 'Palm', material: 'wood', tier: 0, tool: 'axe', hp: 6, yield: [2, 4], respawn: 100, xp: 2, model: 'palm' },
  tree_charred: { id: 'tree_charred', name: 'Charred Tree', material: 'wood', tier: 0, tool: 'axe', hp: 5, yield: [1, 3], respawn: 100, xp: 2, model: 'charred' },
  tree_mossoak: { id: 'tree_mossoak', name: 'Moss Oak', material: 'wood', tier: 0, tool: 'axe', hp: 8, yield: [3, 5], respawn: 100, xp: 2, model: 'mossoak' },
  node_skyglass: ore('skyglass', 7, { id: 'node_skyglass', name: 'Skyglass Spire', yield: [1, 3] }),
  pearl_bed: ore('abyssal_pearl', 7, { id: 'pearl_bed', name: 'Pearl Bed', yield: [1, 2], model: 'pearl', tide: 'low' }),
  ore_obsidian: ore('obsidian', 7, { name: 'Obsidian Flow', yield: [1, 3] }),
  amber_root: { id: 'amber_root', name: 'Amber Root', material: 'living_amber', tier: 0, tool: 'axe', hp: 30, yield: [1, 2], respawn: 200, xp: 20, model: 'amber' },
};

// Power of tools by tier; hands are 1.
export const TOOL_POWER = [2, 3, 4.5, 6.5, 9, 12.5, 17, 23, 31];
export const HAND_POWER = 1;
