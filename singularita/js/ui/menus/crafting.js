// Crafting: categories, filters (class, material, availability), have/need counts,
// where to find missing materials, and a comparison with what is equipped.
import { h, clear } from '../dom.js';
import { RECIPES, RECIPE_CATEGORIES } from '../../data/recipes.js';
import { ITEMS } from '../../data/items.js';
import { MATERIALS, MAIN_MATERIALS } from '../../data/materials.js';
import { CONSUMABLES } from '../../data/consumables.js';
import { CLASSES } from '../../data/classes.js';
import { findSources } from '../../data/sources.js';
import { checkRecipe, craft } from '../../systems/crafting.js';
import { equippedIn, bestTool } from '../../systems/equipment.js';
import { count } from '../../systems/inventory.js';
import { craftXp } from '../../systems/progression.js';
import { rarityColor, statLines, compareLines, itemHeader, nameOf } from './common.js';

export function craftingTab(g, root, opts, rerender) {
  const p = g.profile;
  const s = (g.ui.craftState ||= { cat: 'weapons', cls: 'mine', mat: 'all', avail: 'all', sel: null });
  const atForge = g.isAtForge();
  const outDef = (r) => (r.output.item ? ITEMS[r.output.item] : CONSUMABLES[r.output.stack]);

  const list = Object.values(RECIPES).filter((r) => {
    if (r.category !== s.cat) return false;
    const d = outDef(r);
    if (r.output.item && d.kind === 'gear' && s.cls !== 'all') { const c = s.cls === 'mine' ? p.classId : s.cls; if (d.class !== c && d.class !== 'any') return false; }
    if (s.mat !== 'all' && r.output.item && d.material !== s.mat) return false;
    const c = checkRecipe(p, r);
    if (s.avail === 'now' && !c.craftable) return false;
    if (s.avail === 'missing' && (!c.levelOk || c.craftable)) return false;
    if (s.avail === 'locked' && c.levelOk) return false;
    if (s.avail === 'unlocked' && !c.levelOk) return false;
    return true;
  }).sort((a, b) => a.level - b.level || nameOf(a.output.item || a.output.stack).localeCompare(nameOf(b.output.item || b.output.stack)));

  const sel = (opts2, val, key) => h('select', { class: 'sel', onchange: (e) => { s[key] = e.target.value; rerender(); } }, opts2.map(([v, n]) => h('option', { value: v, selected: val === v }, n)));
  const filters = h('div', { class: 'toolbar wrap' },
    h('div', { class: 'subtabs' }, RECIPE_CATEGORIES.map((c) => h('button', { class: `stab${s.cat === c.id ? ' on' : ''}`, onclick: () => { s.cat = c.id; s.sel = null; rerender(); } }, c.name))),
    sel([['mine', `Class: ${CLASSES[p.classId].name}`], ['all', 'Class: all'], ...Object.values(CLASSES).map((c) => [c.id, `Class: ${c.name}`])], s.cls, 'cls'),
    sel([['all', 'Material: all'], ...MAIN_MATERIALS.map((m) => [m, `Material: ${MATERIALS[m].name}`])], s.mat, 'mat'),
    sel([['all', 'Show: all'], ['unlocked', 'Show: unlocked'], ['now', 'Show: craftable now'], ['missing', 'Show: missing materials'], ['locked', 'Show: locked by level']], s.avail, 'avail'));

  const detail = h('div', { class: 'detail' });
  const rows = h('div', { class: 'recipe-list' });
  const showRecipe = (r) => {
    s.sel = r.id;
    for (const el of rows.children) el.classList.toggle('on', el.dataset.id === r.id);
    const d = outDef(r);
    const c = checkRecipe(p, r);
    const missing = new Set(c.missing.map((m) => m.id));
    const cur = r.output.item ? (d.kind === 'gear' ? (d.class === p.classId || d.class === 'any' ? equippedIn(p, d.slot === 'accessory' ? 'acc1' : d.slot) : null) : bestTool(p.inv, d.tool)) : null;
    const first = !p.stats.crafted[r.id];
    clear(detail).append(
      r.output.item ? itemHeader(d) : h('div', { class: 'item-head' }, h('h3', { style: { color: rarityColor(d.rarity) } }, `${d.name} × ${r.output.count}`)),
      h('div', { class: `req ${c.levelOk ? 'ok' : 'bad'}` }, `Requires level ${r.level}`, c.levelOk ? ' ✓' : ` — you are level ${p.level}`),
      h('h4', {}, 'Materials'),
      h('ul', { class: 'inputs' }, Object.entries(r.inputs).map(([id, need]) => {
        const have = count(p.inv, id);
        return h('li', { class: have >= need ? 'ok' : 'bad' }, h('i', { class: 'swatch', style: { background: MATERIALS[id].color } }), h('span', {}, MATERIALS[id].name), h('b', {}, `${have} / ${need}`));
      })),
      missing.size ? h('div', { class: 'where' }, h('h4', {}, 'Where to find what is missing'),
        ...[...missing].map((id) => h('div', { class: 'src' }, h('b', {}, MATERIALS[id].name), h('ul', {}, findSources(id).slice(0, 4).map((x) => h('li', {}, x.how, h('small', {}, ` · from Lv ${x.level}`))))))) : null,
      r.output.item ? h('div', {}, h('h4', {}, 'Result'), statLines(d), d.kind === 'gear' && cur ? h('div', {}, h('h4', {}, `Compared with ${cur.name}`), compareLines(d, cur)) : null) : h('p', { class: 'flavour' }, d.desc),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary big', disabled: !c.craftable || !atForge, onclick: () => {
          const res = craft(p, r);
          if (!res.ok) { g.ui.toast(res.reason, 'warn'); return; }
          g.onCrafted(r, res);
          if (res.firstTime) g.grantXp(craftXp(r.level), null);
          rerender();
        } }, 'Craft'),
        !atForge ? h('span', { class: 'muted small' }, 'Crafting happens at the Forge in camp. You can plan from anywhere.') : null,
        first && c.levelOk ? h('span', { class: 'muted small' }, `First craft: +${craftXp(r.level)} XP`) : null));
  };
  for (const r of list) {
    const d = outDef(r), c = checkRecipe(p, r);
    const badge = !c.levelOk ? h('span', { class: 'badge lock' }, `Lv ${r.level}`) : c.craftable ? h('span', { class: 'badge ok' }, 'Ready') : h('span', { class: 'badge miss' }, `${c.missing.length} missing`);
    rows.append(h('button', { class: 'recipe', 'data-id': r.id, onclick: () => showRecipe(r) }, h('b', { style: { color: rarityColor(d.rarity) } }, r.output.count > 1 ? `${d.name} ×${r.output.count}` : d.name), badge));
  }
  if (!list.length) rows.append(h('p', { class: 'muted' }, 'No recipes match these filters.'));
  root.append(h('div', { class: 'craft-head' }, atForge ? h('span', { class: 'pill good' }, '⚒ At the Forge') : h('span', { class: 'pill' }, 'Planning (go to the Forge to craft)')), filters, h('div', { class: 'craft-layout' }, rows, detail));
  const pre = list.find((r) => r.id === s.sel) || list.find((r) => checkRecipe(p, r).craftable) || list[0];
  if (pre) showRecipe(pre); else detail.append(h('p', { class: 'muted' }, 'Pick a recipe.'));
}
