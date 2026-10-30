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
// Tier 8: Dawndosite draws on the isles of Air and Water, Escuresite on Fire and Earth.
const TIER8 = {
  dawndosite: { weapon: { skyglass: 8, abyssal_pearl: 6, zephyr_feather: 6 }, armor: { tide_silk: 10, zephyr_feather: 8, diamond: 10 },
    accessory: { eastwind_silk: 2, poseidon_tear: 2, skyglass: 4, abyssal_pearl: 3 }, pickaxe: { skyglass: 4, abyssal_pearl: 3 }, axe: { zephyr_feather: 3, tide_silk: 2 } },
  escuresite: { weapon: { obsidian: 8, living_amber: 6, salamander_scale: 6 }, armor: { golem_shard: 10, salamander_scale: 8, diamond: 10 },
    accessory: { vector_core: 2, allele_seed: 2, obsidian: 4, living_amber: 3 }, pickaxe: { obsidian: 4, living_amber: 3 }, axe: { salamander_scale: 3, golem_shard: 2 } },
};

// Tier 9: Chromantite gear draws on the dimensions, and every piece needs a Singularita Shard.
const TIER9 = {
  weapon: { gaol_iron: 8, dragon_scale: 6, singularita_shard: 2 }, armor: { purple_adamite: 10, twin_gel: 8, singularita_shard: 2 },
  accessory: { specular_glass: 6, twin_gel: 4, jailer_chain: 1, singularita_shard: 3 }, pickaxe: { gaol_iron: 4, purple_adamite: 3, singularita_shard: 1 }, axe: { dragon_scale: 3, twin_gel: 2, singularita_shard: 1 },
};
// Tier 10: Singularita itself, bound with the materials of every dimension.
const TIER10 = {
  weapon: { gaol_iron: 10, dragon_scale: 10, specular_glass: 6, ragnarok_ember: 1 }, armor: { purple_adamite: 12, twin_gel: 10, dragon_scale: 6, siamese_heart: 1 },
  accessory: { specular_glass: 8, purple_adamite: 6, twin_gel: 6, mirror_self: 1, adamite_crown_shard: 1 }, pickaxe: { gaol_iron: 6, specular_glass: 4 }, axe: { dragon_scale: 4, twin_gel: 4 },
};

function gearInputs(matId, slot) {
  const t = MATERIALS[matId].tier;
  const inputs = { [matId]: BASE_QTY[slot] + 2 * t };
  for (const [id, n] of Object.entries(t === 10 ? TIER10[slot] : t === 9 ? TIER9[slot] : t === 8 ? TIER8[matId][slot] : SECONDARY[t][slot])) {
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
consumable('pearl_elixir', 72, { abyssal_pearl: 1, tide_silk: 2, slime_gel: 4 }, 2);

// Emblems: each opens the portal to one dimension. Their hearts come from the bosses of the main world.
consumable('emblem_dungeon', 100, { silver_mane: 3, vector_core: 2, dawndosite: 4, iron: 20 }, 1);
consumable('emblem_twins', 110, { royal_jelly: 4, poseidon_tear: 2, escuresite: 4, slime_gel: 30 }, 1);
consumable('emblem_king', 125, { allele_seed: 2, silver_mane: 3, escuresite: 6, prism_dust: 10 }, 1);
consumable('emblem_mirror', 140, { eastwind_silk: 2, poseidon_tear: 2, dawndosite: 6, diamond: 8 }, 1);
consumable('emblem_dragons', 160, { vector_core: 3, eastwind_silk: 2, allele_seed: 2, dawndosite: 4, escuresite: 4 }, 1);

// Elemental isle accessories.
const isleAcc = (item, level, inputs) => list.push({ id: `craft_${item}`, category: 'accessories', output: { item, count: 1 }, level, inputs });
isleAcc('zephyr_charm', 72, { skyglass: 6, zephyr_feather: 8, diamond: 4 });
isleAcc('tidecaller_pendant', 72, { abyssal_pearl: 6, tide_silk: 8, sapphire: 4 });
isleAcc('cinder_brand', 86, { obsidian: 8, salamander_scale: 8, ruby: 4 });
isleAcc('rootbound_torc', 86, { living_amber: 10, golem_shard: 6, emerald: 6 });

export const RECIPES = Object.fromEntries(list.map((r) => [r.id, r]));
export const RECIPE_CATEGORIES = [
  { id: 'weapons', name: 'Weapons' }, { id: 'armor', name: 'Armour' }, { id: 'accessories', name: 'Accessories' },
  { id: 'tools', name: 'Tools' }, { id: 'consumables', name: 'Consumables' },
];
export const recipeOutputDef = (r) => (r.output.item ? ITEMS[r.output.item] : null);
