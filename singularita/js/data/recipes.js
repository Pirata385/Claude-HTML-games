// Recipes: generated for all gear and tools, plus hand-written consumables.
// Level gates crafting; there is no ordering between unlocked recipes.
import { MATERIALS, MAIN_MATERIALS, TIER_RECIPE_LEVEL } from './materials.js';
import { CLASS_IDS } from './classes.js';
import { ITEMS } from './items.js';

const BASE_QTY = { weapon: 8, armor: 12, accessory: 5, pickaxe: 6, axe: 5 };
const SLOT_LEVEL = { weapon: 0, armor: 1, accessory: 2, pickaxe: 0, axe: 0 };

// Secondary inputs by tier and slot. `X` stands for the rift drop matching a tier-6 gem.
const SECONDARY = [
  { weapon: {}, armor: { slime_gel: 3 }, accessory: { slime_gel: 4 }, pickaxe: {}, axe: {} },
  { weapon: { wood: 4, slime_gel: 2 }, armor: { wood: 3, slime_gel: 4 }, accessory: { slime_gel: 5 }, pickaxe: { wood: 4 }, axe: { wood: 4 } },
  { weapon: { wood: 5, zombie_sinew: 3 }, armor: { bat_leather: 4, zombie_sinew: 2 }, accessory: { zombie_sinew: 3, slime_gel: 6 }, pickaxe: { wood: 5, zombie_sinew: 2 }, axe: { wood: 5, zombie_sinew: 1 } },
  { weapon: { wood: 6, zombie_sinew: 5 }, armor: { bat_leather: 6, stone: 10 }, accessory: { royal_jelly: 1, bat_leather: 3 }, pickaxe: { wood: 6, zombie_sinew: 3 }, axe: { wood: 6 } },
  { weapon: { iron: 6, bat_leather: 4 }, armor: { iron: 8, bat_leather: 8 }, accessory: { silver_mane: 1, iron: 4 }, pickaxe: { iron: 4, zombie_sinew: 4 }, axe: { iron: 3 } },
  { weapon: { crawler_chitin: 6, iron: 6 }, armor: { crawler_chitin: 8, iron: 8 }, accessory: { royal_jelly: 2, silver_mane: 1 }, pickaxe: { crawler_chitin: 4 }, axe: { crawler_chitin: 2 } },
  { weapon: { X: 6, emerald: 4 }, armor: { X: 8, emerald: 6 }, accessory: { silver_mane: 2, X: 4 }, pickaxe: { X: 3, emerald: 2 }, axe: { X: 2 } },
  { weapon: { prism_dust: 8, gold: 10 }, armor: { prism_dust: 10, titanium: 8 }, accessory: { royal_jelly: 3, silver_mane: 3, prism_dust: 4 }, pickaxe: { prism_dust: 5 }, axe: { prism_dust: 3 } },
];
const RIFT_DROP = { ruby: 'ember_core', sapphire: 'rime_shard' };

function gearInputs(matId, slot) {
  const t = MATERIALS[matId].tier;
  const inputs = { [matId]: BASE_QTY[slot] + 2 * t };
  for (const [id, n] of Object.entries(SECONDARY[t][slot])) {
    const real = id === 'X' ? RIFT_DROP[matId] : id;
    inputs[real] = (inputs[real] || 0) + n;
  }
  return inputs;
}

const list = [];
const addGear = (itemId, matId, slot, category) => {
  list.push({
    id: `craft_${itemId}`, category, output: { item: itemId, count: 1 },
    level: TIER_RECIPE_LEVEL[MATERIALS[matId].tier] + SLOT_LEVEL[slot],
    inputs: gearInputs(matId, slot),
  });
};
for (const mat of MAIN_MATERIALS) {
  for (const cls of CLASS_IDS) {
    addGear(`${cls}_weapon_${mat}`, mat, 'weapon', 'weapons');
    addGear(`${cls}_armor_${mat}`, mat, 'armor', 'armor');
    addGear(`${cls}_accessory_${mat}`, mat, 'accessory', 'accessories');
  }
  addGear(`pickaxe_${mat}`, mat, 'pickaxe', 'tools');
  addGear(`axe_${mat}`, mat, 'axe', 'tools');
}

const consumable = (id, level, inputs, count) => list.push({ id: `craft_${id}`, category: 'consumables', output: { stack: id, count }, level, inputs });
consumable('healing_tonic', 1, { slime_gel: 3, wood: 2 }, 2);
consumable('resource_tonic', 5, { slime_gel: 3, zombie_sinew: 1 }, 2);
consumable('reset_crystal', 8, { stone: 12, gold: 3 }, 1);
consumable('royal_bait', 10, { slime_gel: 15, gold: 2 }, 1);
consumable('echo_horn', 16, { zombie_sinew: 15, iron: 3 }, 1);
consumable('antidote', 22, { slime_gel: 4, bat_leather: 2 }, 2);
consumable('greater_healing_tonic', 30, { slime_gel: 4, crawler_chitin: 2, emerald: 1 }, 2);

export const RECIPES = Object.fromEntries(list.map((r) => [r.id, r]));
export const RECIPE_CATEGORIES = [
  { id: 'weapons', name: 'Weapons' }, { id: 'armor', name: 'Armour' }, { id: 'accessories', name: 'Accessories' },
  { id: 'tools', name: 'Tools' }, { id: 'consumables', name: 'Consumables' },
];
export const recipeOutputDef = (r) => (r.output.item ? ITEMS[r.output.item] : null);
