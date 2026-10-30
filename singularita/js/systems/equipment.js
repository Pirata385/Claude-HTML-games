// Equipment loadouts are kept per class, so switching class at the Altar swaps gear too.
import { ITEMS, STAT_LABELS } from '../data/items.js';
import { findItem } from './inventory.js';

export const SLOTS = ['weapon', 'armor', 'acc1', 'acc2'];
export const emptyLoadout = () => ({ weapon: null, armor: null, acc1: null, acc2: null });

export const loadout = (p) => (p.equipment[p.classId] ||= emptyLoadout());

export function canEquip(profile, def) {
  if (!def || def.kind !== 'gear') return { ok: false, reason: 'Not equippable.' };
  if (def.class !== 'any' && def.class !== profile.classId) return { ok: false, reason: `Only a ${def.class[0].toUpperCase() + def.class.slice(1)} can use this.` };
  return { ok: true };
}

export function equip(profile, uid, slotHint) {
  const inst = findItem(profile.inv, uid);
  if (!inst) return { ok: false, reason: 'Item not found.' };
  const def = ITEMS[inst.id];
  const c = canEquip(profile, def);
  if (!c.ok) return c;
  const lo = loadout(profile);
  for (const s of SLOTS) if (lo[s] === uid) lo[s] = null;
  let slot = def.slot;
  if (slot === 'accessory') slot = slotHint === 'acc2' || (slotHint !== 'acc1' && lo.acc1 != null && lo.acc2 == null) ? 'acc2' : 'acc1';
  lo[slot] = uid;
  return { ok: true, slot };
}

export function unequip(profile, slot) { loadout(profile)[slot] = null; }

export function equippedDefs(profile) {
  const lo = loadout(profile), out = [];
  for (const s of SLOTS) {
    const inst = lo[s] != null ? findItem(profile.inv, lo[s]) : null;
    if (inst) out.push(ITEMS[inst.id]);
    else if (lo[s] != null) lo[s] = null; // stale reference
  }
  return out;
}

export function equippedIn(profile, slot) {
  const uid = loadout(profile)[slot];
  const inst = uid != null ? findItem(profile.inv, uid) : null;
  return inst ? ITEMS[inst.id] : null;
}

export function isEquipped(profile, uid) {
  return Object.values(profile.equipment).some((lo) => SLOTS.some((s) => lo[s] === uid));
}

// Stat-by-stat comparison of a candidate against the current item.
export function compareItems(candidate, current) {
  const keys = new Set([...Object.keys(candidate?.stats || {}), ...Object.keys(current?.stats || {})]);
  return [...keys].filter((k) => STAT_LABELS[k]).map((stat) => {
    const a = candidate?.stats[stat] || 0, b = current?.stats[stat] || 0;
    return { stat, a, b, delta: a - b };
  });
}

export function bestTool(inv, kind) {
  let best = null;
  for (const i of inv.items) {
    const d = ITEMS[i.id];
    if (d.kind === 'tool' && d.tool === kind && (!best || d.tier > best.tier)) best = d;
  }
  return best;
}
