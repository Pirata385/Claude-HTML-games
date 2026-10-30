// Singularita's shape memory: every Singularita piece remembers two traits of the materials below
// it, chosen at the Forge and changed whenever you like. The choice is kept per item in the save.
import { TRAIT_MODS } from '../data/items.js';
import { MATERIALS, MAIN_MATERIALS } from '../data/materials.js';

export const MEMORY_TRAITS = [...new Set(MAIN_MATERIALS.map((id) => MATERIALS[id].trait))].filter((t) => t !== 'singular');
// What a new piece remembers before you choose.
const DEFAULT = { weapon: ['prismatic', 'ember'], armor: ['verdant', 'tempered'], accessory: ['featherweight', 'radiant'] };

export function memoryOf(p, item) {
  if (!item?.memory) return [];
  return p.memory?.[item.id] || DEFAULT[item.slot];
}

export function setMemory(p, item, traits) {
  if (!item?.memory) return { ok: false, reason: 'Only Singularita remembers.' };
  if (!Array.isArray(traits) || traits.length !== item.memory) return { ok: false, reason: `Choose ${item.memory} traits.` };
  if (new Set(traits).size !== traits.length) return { ok: false, reason: 'Choose two different traits.' };
  if (!traits.every((t) => MEMORY_TRAITS.includes(t))) return { ok: false, reason: 'It cannot remember that.' };
  (p.memory ||= {})[item.id] = [...traits];
  return { ok: true };
}

// Gear as it is worn: Singularita pieces gain their remembered traits for their slot.
export function withMemory(p, gear) {
  return gear.map((it) => {
    if (!it?.memory) return it;
    const traits = memoryOf(p, it);
    const stats = { ...it.stats };
    for (const t of traits) for (const [k, v] of Object.entries(TRAIT_MODS[t][it.slot] || {})) stats[k] = (stats[k] || 0) + v;
    if (stats.defMult) { stats.def = Math.round((stats.def || 0) * (1 + stats.defMult)); delete stats.defMult; }
    return { ...it, stats, remembered: traits };
  });
}
