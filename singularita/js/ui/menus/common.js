// Shared bits for menu tabs.
import { h } from '../dom.js';
import { ITEMS, STAT_LABELS, PERCENT_STATS } from '../../data/items.js';
import { MATERIALS, RARITY, TRAITS } from '../../data/materials.js';
import { CONSUMABLES } from '../../data/consumables.js';
import { CLASSES } from '../../data/classes.js';
import { compareItems } from '../../systems/equipment.js';

export const rarityColor = (r) => RARITY[r]?.color || '#ccc';
export const fmtStat = (k, v) => (PERCENT_STATS.has(k) ? `${v > 0 ? '+' : ''}${Math.round(v * 1000) / 10}%` : `${v > 0 && k !== 'power' && k !== 'def' && k !== 'hp' && k !== 'toolPower' ? '+' : ''}${Math.round(v * 10) / 10}`);

export function defOf(id) { return ITEMS[id] || CONSUMABLES[id] || MATERIALS[id]; }
export function nameOf(id) { return defOf(id)?.name || id; }

export function statLines(def) {
  return h('ul', { class: 'stat-lines' }, Object.entries(def.stats || {}).filter(([k]) => STAT_LABELS[k]).map(([k, v]) => h('li', {}, h('span', {}, STAT_LABELS[k]), h('b', {}, fmtStat(k, v)))));
}

export function compareLines(cand, cur) {
  const rows = compareItems(cand, cur).filter((r) => Math.abs(r.delta) > 1e-9);
  if (!rows.length) return h('p', { class: 'muted small' }, cur ? 'Same as equipped.' : '');
  return h('ul', { class: 'stat-lines cmp' }, rows.map((r) => {
    const better = r.stat === 'dodgeCd' ? r.delta > 0 : r.delta > 0;
    return h('li', { class: better ? 'up' : 'down' }, h('span', {}, STAT_LABELS[r.stat]), h('b', {}, `${fmtStat(r.stat, r.a)} (${r.delta > 0 ? '▲' : '▼'} ${fmtStat(r.stat, Math.abs(r.delta)).replace('+', '')})`));
  }));
}

export function itemHeader(def) {
  const tags = [];
  if (def.kind === 'gear') tags.push(def.class === 'any' ? 'Any class' : CLASSES[def.class].name, def.slot === 'armor' ? 'Armour' : def.slot[0].toUpperCase() + def.slot.slice(1));
  if (def.kind === 'tool') tags.push(def.tool === 'pickaxe' ? 'Pickaxe' : 'Axe');
  return h('div', { class: 'item-head' },
    h('h3', { style: { color: rarityColor(def.rarity) } }, def.name),
    h('div', { class: 'tags' }, h('span', { style: { color: rarityColor(def.rarity) } }, RARITY[def.rarity]?.name || ''), ...tags.map((t) => h('span', {}, t))),
    def.trait ? h('p', { class: 'trait' }, h('b', {}, `${TRAITS[def.trait].name}: `), TRAITS[def.trait].desc) : null);
}
