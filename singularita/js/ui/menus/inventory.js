// Inventory and equipment, with comparisons against what is equipped.
import { h, clear } from '../dom.js';
import { ITEMS } from '../../data/items.js';
import { MATERIALS, TRAITS } from '../../data/materials.js';
import { CONSUMABLES } from '../../data/consumables.js';
import { RARITY } from '../../data/materials.js';
import { CLASSES } from '../../data/classes.js';
import { SLOTS, equip, unequip, equippedIn, isEquipped, bestTool, canEquip, loadout } from '../../systems/equipment.js';
import { findItem } from '../../systems/inventory.js';
import { findSources } from '../../data/sources.js';
import { MEMORY_TRAITS, memoryOf, setMemory, withMemory } from '../../systems/memory.js';
import { rarityColor, statLines, compareLines, itemHeader } from './common.js';

const SLOT_NAMES = { weapon: 'Weapon', armor: 'Armour', acc1: 'Accessory', acc2: 'Accessory' };

export function inventoryTab(g, root, opts, rerender) {
  const p = g.profile;
  const state = (g.ui.invState ||= { tab: 'gear', sel: null, sort: 'tier' });
  const detail = h('div', { class: 'detail' });
  // Singularita's shape memory: two traits of lower materials, chosen at the Forge.
  const memoryPanel = (def) => {
    const cur = memoryOf(p, def), picks = [...cur];
    const atForge = g.isAtForge();
    const names = (list) => list.map((t) => TRAITS[t].name).join(' and ');
    const sel = (n) => h('select', { onchange: (e) => { picks[n] = e.target.value; } }, MEMORY_TRAITS.map((t) => h('option', { value: t, selected: picks[n] === t }, TRAITS[t].name)));
    return h('div', { class: 'memory' }, h('h4', {}, 'Shape memory'),
      h('p', { class: 'muted small' }, `It remembers ${names(cur)}: ${cur.map((t) => TRAITS[t].desc).join(' ')} ${atForge ? 'Choose what it should remember.' : 'Change it at the Forge.'}`),
      h('div', { class: 'row' }, sel(0), sel(1),
        h('button', { class: 'btn', disabled: !atForge, onclick: () => {
          const r = setMemory(p, def, picks);
          if (!r.ok) { g.ui.toast(r.reason, 'warn'); return; }
          g.onGearChanged(def);
          g.ui.toast(`It remembers ${names(picks)} now.`, 'good');
          rerender();
        } }, 'Remember')));
  };
  const showItem = (uid) => {
    const inst = findItem(p.inv, uid);
    if (!inst) return;
    const def = ITEMS[inst.id];
    const slot = def.slot === 'accessory' ? 'acc1' : def.slot;
    const cur = def.kind === 'gear' ? equippedIn(p, slot) : def.kind === 'tool' ? bestTool(p.inv, def.tool) : null;
    const eq = isEquipped(p, uid);
    const ce = canEquip(p, def);
    clear(detail).append(itemHeader(def), statLines(def.memory ? withMemory(p, [def])[0] : def),
      def.memory ? memoryPanel(def) : null,
      def.kind === 'gear' ? h('div', {}, h('h4', {}, eq ? 'Equipped' : `Compared with ${cur ? cur.name : 'nothing'}`), eq ? null : compareLines(def, cur)) : null,
      h('p', { class: 'flavour' }, def.desc),
      def.kind === 'gear' ? h('div', { class: 'row' },
        eq ? h('button', { class: 'btn', onclick: () => { for (const s of SLOTS) if (loadout(p)[s] === uid) unequip(p, s); g.onGearChanged(); rerender(); } }, 'Unequip')
          : h('button', { class: 'btn primary', disabled: !ce.ok, onclick: () => { const r = equip(p, uid); if (r.ok) { g.onGearChanged(def); rerender(); } } }, 'Equip'),
        !eq && def.slot === 'accessory' && ce.ok ? h('button', { class: 'btn', onclick: () => { equip(p, uid, 'acc2'); g.onGearChanged(def); rerender(); } }, 'Equip in slot 2') : null,
        !ce.ok ? h('span', { class: 'muted small' }, ce.reason) : null) : null,
      def.kind === 'tool' ? h('p', { class: 'muted small' }, 'Tools are used automatically: your best pickaxe and axe are always in hand.') : null);
  };
  const showStack = (id) => {
    const def = CONSUMABLES[id] || MATERIALS[id];
    const src = MATERIALS[id] ? findSources(id) : [];
    clear(detail).append(
      h('div', { class: 'item-head' }, h('h3', { style: { color: rarityColor(def.rarity) } }, def.name), h('div', { class: 'tags' }, h('span', {}, RARITY[def.rarity].name), h('span', {}, `× ${p.inv.stacks[id] || 0}`))),
      h('p', { class: 'flavour' }, def.desc),
      src.length ? h('div', {}, h('h4', {}, 'Where to find'), h('ul', { class: 'sources' }, src.map((s) => h('li', {}, s.how, h('small', {}, ` (from Lv ${s.level})`))))) : null,
      CONSUMABLES[id] ? h('div', { class: 'row' },
        id === 'reset_crystal' ? h('button', { class: 'btn', onclick: () => { g.ui.openMenu('character'); } }, 'Open Character') :
        h('button', { class: 'btn primary', onclick: () => { g.ui.closeMenu(); g.useConsumable(id); } }, 'Use')) : null);
  };

  // Equipment column.
  const eqCol = h('div', { class: 'equip-col' }, h('h4', {}, `${CLASSES[p.classId].name} loadout`));
  for (const s of SLOTS) {
    const d = equippedIn(p, s);
    eqCol.append(h('button', { class: `eq-slot${d ? '' : ' empty'}`, style: d ? { borderColor: rarityColor(d.rarity) } : {}, onclick: () => d && showItem(loadout(p)[s]) },
      h('small', {}, SLOT_NAMES[s]), h('b', { style: d ? { color: rarityColor(d.rarity) } : {} }, d ? d.name : 'Empty')));
  }
  for (const t of ['pickaxe', 'axe']) {
    const d = bestTool(p.inv, t);
    eqCol.append(h('div', { class: `eq-slot tool${d ? '' : ' empty'}` }, h('small', {}, t === 'pickaxe' ? 'Pickaxe' : 'Axe'), h('b', { style: d ? { color: rarityColor(d.rarity) } : {} }, d ? d.name : 'Bare hands')));
  }
  const st = g.stats;
  eqCol.append(h('div', { class: 'mini-stats' }, h('span', {}, `Power ${Math.round(st.power)}`), h('span', {}, `Defence ${Math.round(st.def)}`), h('span', {}, `Health ${st.maxHp}`)));

  // Item grid.
  const tabs = h('div', { class: 'subtabs' }, [['gear', 'Gear'], ['materials', 'Materials'], ['consumables', 'Consumables']].map(([id, n]) => h('button', { class: `stab${state.tab === id ? ' on' : ''}`, onclick: () => { state.tab = id; rerender(); } }, n)));
  const sortSel = h('select', { class: 'sel', onchange: (e) => { state.sort = e.target.value; rerender(); } }, [['tier', 'Sort: tier'], ['name', 'Sort: name'], ['class', 'Sort: class']].map(([v, n]) => h('option', { value: v, selected: state.sort === v }, n)));
  const grid = h('div', { class: 'item-grid' });
  if (state.tab === 'gear') {
    const list = p.inv.items.map((i) => ({ i, d: ITEMS[i.id] }));
    list.sort((a, b) => (state.sort === 'name' ? a.d.name.localeCompare(b.d.name) : state.sort === 'class' ? String(a.d.class).localeCompare(String(b.d.class)) || b.d.tier - a.d.tier : b.d.tier - a.d.tier || a.d.name.localeCompare(b.d.name)));
    for (const { i, d } of list) {
      const usable = canEquip(p, d).ok || d.kind === 'tool';
      grid.append(h('button', { class: `cell${isEquipped(p, i.uid) ? ' eq' : ''}${usable ? '' : ' dim'}`, style: { '--rc': rarityColor(d.rarity) }, title: d.name, onclick: () => { state.sel = i.uid; showItem(i.uid); } },
        h('b', {}, d.name), h('small', {}, d.kind === 'tool' ? 'Tool' : d.class === 'any' ? 'Unique' : CLASSES[d.class].name)));
    }
    if (!list.length) grid.append(h('p', { class: 'muted' }, 'No gear yet. Craft some at the Forge.'));
  } else {
    const isCons = state.tab === 'consumables';
    const ids = Object.keys(p.inv.stacks).filter((id) => (isCons ? CONSUMABLES[id] : MATERIALS[id]) && p.inv.stacks[id] > 0);
    ids.sort((a, b) => (state.sort === 'name' ? (CONSUMABLES[a] || MATERIALS[a]).name.localeCompare((CONSUMABLES[b] || MATERIALS[b]).name) : ((MATERIALS[a]?.tier ?? 0) - (MATERIALS[b]?.tier ?? 0))));
    // Key items (the sigils) come first, under their own heading.
    const keys = ids.filter((id) => MATERIALS[id]?.kind === 'key');
    const cell = (id) => {
      const d = CONSUMABLES[id] || MATERIALS[id];
      return h('button', { class: 'cell stack', style: { '--rc': rarityColor(d.rarity) }, onclick: () => showStack(id) }, h('i', { class: 'swatch', style: { background: d.color } }), h('b', {}, d.kind === 'key' ? `✦ ${d.name}` : d.name), h('small', {}, d.kind === 'key' ? 'Key item' : `× ${p.inv.stacks[id]}`));
    };
    if (keys.length) grid.append(h('p', { class: 'muted small', style: { gridColumn: '1 / -1' } }, 'Key items'), ...keys.map(cell), h('p', { class: 'muted small', style: { gridColumn: '1 / -1' } }, 'Materials'));
    for (const id of ids) if (!keys.includes(id)) grid.append(cell(id));
    if (!ids.length) grid.append(h('p', { class: 'muted' }, isCons ? 'No consumables. Tonics are crafted at the Forge.' : 'No materials yet. Chop trees and mine rocks.'));
  }
  root.append(h('div', { class: 'inv-layout' }, eqCol, h('div', { class: 'inv-main' }, h('div', { class: 'toolbar' }, tabs, sortSel), grid), detail));
  if (state.sel && findItem(p.inv, state.sel) && state.tab === 'gear') showItem(state.sel);
  else detail.append(h('p', { class: 'muted' }, 'Select an item to see its details and compare it with what you have equipped.'));
}
