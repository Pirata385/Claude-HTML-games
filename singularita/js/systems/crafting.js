// Crafting: any unlocked recipe can be made if the level and materials allow it.
import { count, takeStack, addStack, addItem } from './inventory.js';

export function checkRecipe(profile, recipe) {
  const missing = [];
  for (const [id, need] of Object.entries(recipe.inputs)) {
    const have = count(profile.inv, id);
    if (have < need) missing.push({ id, need, have });
  }
  const levelOk = profile.level >= recipe.level;
  return { craftable: levelOk && missing.length === 0, levelOk, missing };
}

export function craft(profile, recipe) {
  const c = checkRecipe(profile, recipe);
  if (!c.craftable) return { ok: false, reason: c.levelOk ? 'Missing materials.' : `Requires level ${recipe.level}.` };
  for (const [id, need] of Object.entries(recipe.inputs)) takeStack(profile.inv, id, need);
  const firstTime = !profile.stats.crafted[recipe.id];
  profile.stats.crafted[recipe.id] = (profile.stats.crafted[recipe.id] || 0) + 1;
  if (recipe.output.item) return { ok: true, firstTime, uid: addItem(profile.inv, recipe.output.item) };
  addStack(profile.inv, recipe.output.stack, recipe.output.count);
  return { ok: true, firstTime };
}
