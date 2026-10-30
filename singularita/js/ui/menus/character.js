// Character: attributes with live previews of what a point changes, derived stats, respec.
import { h } from '../dom.js';
import { ATTRS, ATTR_INFO, computeStats } from '../../systems/stats.js';
import { allocate, respec } from '../../systems/attributes.js';
import { equippedDefs } from '../../systems/equipment.js';
import { xpToNext } from '../../systems/progression.js';
import { count, takeStack } from '../../systems/inventory.js';
import { CLASSES } from '../../data/classes.js';
import { fmt } from '../../core/math.js';

const SHOW = [
  ['maxHp', 'Health', (v) => fmt(v)], ['def', 'Defence', (v) => v.toFixed(0)], ['power', 'Weapon power', (v) => v.toFixed(0)], ['dmgMult', 'Damage multiplier', (v) => `×${v.toFixed(2)}`],
  ['critChance', 'Crit chance', (v) => `${(v * 100).toFixed(1)}%`], ['critMult', 'Crit damage', (v) => `×${v.toFixed(2)}`], ['attackSpeed', 'Attack speed', (v) => `×${v.toFixed(2)}`],
  ['moveSpeed', 'Move speed', (v) => v.toFixed(2)], ['dodgeCd', 'Dodge cooldown', (v) => `${v.toFixed(2)} s`], ['cdr', 'Cooldown reduction', (v) => `${(v * 100).toFixed(1)}%`],
  ['resourceMax', 'Resource max', (v) => v.toFixed(0)], ['resourceRegen', 'Resource regen', (v) => `${v.toFixed(1)}/s`], ['spiPower', 'Astral power', (v) => `×${v.toFixed(2)}`],
  ['leash', 'Astral leash', (v) => `${v.toFixed(1)} m`], ['statusRes', 'Status resist', (v) => `${(v * 100).toFixed(1)}%`], ['statusPotency', 'Status potency', (v) => `×${v.toFixed(2)}`],
  ['gatherPower', 'Gathering', (v) => `×${v.toFixed(2)}`], ['oocRegen', 'Rest regen', (v) => `${(v * 100).toFixed(2)}%/s`], ['tonicPotency', 'Tonic potency', (v) => `×${v.toFixed(2)}`],
  ['accuracy', 'Accuracy', (v) => `${(v * 100).toFixed(0)}%`], ['knockback', 'Knockback', (v) => `×${v.toFixed(2)}`], ['healMult', 'Healing received', (v) => `×${v.toFixed(2)}`],
];

export function characterTab(g, root, opts, rerender) {
  const p = g.profile, c = CLASSES[p.classId];
  const gear = equippedDefs(p);
  const cur = computeStats(p, gear);
  const preview = h('div', { class: 'preview muted small' }, 'Hover or tap + to preview what a point changes.');
  const showPreview = (a) => {
    const q = structuredClone({ ...p, inv: { stacks: {}, items: [] } });
    q.attrs[a] += 1;
    const nx = computeStats(q, gear);
    const diffs = SHOW.filter(([k]) => Math.abs(nx[k] - cur[k]) > 1e-6).map(([k, n, f]) => `${n} ${f(cur[k])} → ${f(nx[k])}`);
    preview.textContent = `+1 ${ATTR_INFO[a].name}: ${diffs.join(' · ') || 'no change'}`;
  };
  const attrRows = ATTRS.map((a) => h('div', { class: 'attr' },
    h('div', { class: 'attr-name' }, h('b', {}, ATTR_INFO[a].name), h('small', {}, ATTR_INFO[a].desc)),
    h('div', { class: 'attr-val' }, h('b', {}, cur.attrs[a]), p.attrs[a] !== cur.attrs[a] ? h('small', {}, ` (${p.attrs[a]} spent)`) : null),
    h('button', { class: 'btn small', disabled: !p.attrPoints, onmouseenter: () => showPreview(a), onfocus: () => showPreview(a),
      onclick: () => { if (allocate(p, a, 1)) { g.onAttributesChanged(); rerender(); } } }, '+1'),
    h('button', { class: 'btn small', disabled: p.attrPoints < 5, onclick: () => { if (allocate(p, a, 5)) { g.onAttributesChanged(); rerender(); } } }, '+5')));
  const crystals = count(p.inv, 'reset_crystal');
  const next = xpToNext(p.level);
  root.append(h('div', { class: 'char-layout' },
    h('div', { class: 'char-col' },
      h('h3', { style: { color: c.color } }, `${p.name} — ${c.name}`),
      h('p', { class: 'muted' }, `Level ${p.level} · ${fmt(p.xp)} / ${fmt(next)} XP · Main attributes: ${Object.keys(c.scaling).map((x) => ATTR_INFO[x].name).join(', ')}`),
      h('div', { class: `points-box${p.attrPoints ? ' on' : ''}` }, `${p.attrPoints} attribute point${p.attrPoints === 1 ? '' : 's'} to spend`),
      ...attrRows, preview,
      h('div', { class: 'row' }, h('button', { class: 'btn', disabled: !crystals, onclick: () => {
        if (!confirm('Use a Reset Crystal to return all spent points?')) return;
        takeStack(p.inv, 'reset_crystal', 1); respec(p); g.onAttributesChanged(); rerender();
      } }, `Reset attributes (${crystals} Reset Crystal${crystals === 1 ? '' : 's'})`)),
      h('p', { class: 'muted small' }, `Free growth: ${c.growth.map((x) => ATTR_INFO[x].name).join(' and ')} rise by 1 every two levels. Level never limits what you can equip; it unlocks recipes and deeper areas.`)),
    h('div', { class: 'char-col' }, h('h4', {}, 'Derived stats'), h('ul', { class: 'stat-lines' }, SHOW.map(([k, n, f]) => h('li', {}, h('span', {}, n), h('b', {}, f(cur[k]))))))));
}
