// Journal: objectives, the level roadmap, lore found so far and bosses defeated.
import { h } from '../dom.js';
import { OBJECTIVES } from '../../data/objectives.js';
import { LORE } from '../../data/lore.js';
import { BOSSES } from '../../data/bosses.js';
import { MATERIALS } from '../../data/materials.js';
import { ZONES } from '../../data/zones.js';
import { buildUnlocks } from '../../data/unlocks.js';

export function journalTab(g, root, opts, rerender) {
  const p = g.profile;
  const s = (g.ui.journalState ||= { tab: 'goals' });
  const tabs = h('div', { class: 'subtabs' }, [['goals', 'Objectives'], ['roadmap', 'Roadmap'], ['lore', 'Lore'], ['bosses', 'Bosses']].map(([id, n]) => h('button', { class: `stab${s.tab === id ? ' on' : ''}`, onclick: () => { s.tab = id; rerender(); } }, n)));
  const body = h('div', { class: 'journal-body' });
  if (s.tab === 'goals') {
    body.append(h('ul', { class: 'goals' }, OBJECTIVES.map((o, i) => h('li', { class: i < p.objectives.index ? 'done' : i === p.objectives.index ? 'cur' : 'todo' },
      h('b', {}, i < p.objectives.index ? '✓ ' : i === p.objectives.index ? '➤ ' : '· ', i <= p.objectives.index ? o.text : '???'),
      i === p.objectives.index ? h('small', {}, `${o.hint}${o.count > 1 ? ` (${p.objectives.progress}/${o.count})` : ''}`) : null))));
  } else if (s.tab === 'roadmap') {
    const list = buildUnlocks(p.classId);
    body.append(h('p', { class: 'muted small' }, `You are level ${p.level}. Level unlocks recipes, areas and skills; it never limits what you can equip.`),
      h('ul', { class: 'roadmap' }, list.map((u) => h('li', { class: u.level <= p.level ? 'done' : '' }, h('b', {}, `Lv ${u.level}`), h('span', {}, u.entries.map((e) => `${{ recipe: '⚒', zone: '⛰', skill: '✦', boss: '☠' }[e.type]} ${e.label}`).join(' · '))))));
  } else if (s.tab === 'lore') {
    const ids = Object.keys(LORE);
    body.append(h('p', { class: 'muted small' }, `${p.lore.length} of ${ids.length} found.`),
      ...ids.map((id) => p.lore.includes(id)
        ? h('details', { class: 'lore' }, h('summary', {}, LORE[id].title, h('small', {}, ` · ${ZONES[LORE[id].zone].name}`)), h('p', {}, LORE[id].text))
        : h('div', { class: 'lore unknown' }, `??? · ${ZONES[LORE[id].zone].name}`)));
  } else {
    for (const b of Object.values(BOSSES)) {
      const n = p.stats.bosses[b.id] || 0;
      const sigil = b.rewards.find((r) => r.once)?.material;
      const where = ZONES[b.zone]?.type === 'dimension'
        ? `Rules ${ZONES[b.zone].name}, at the end of every run there. ${(p.inv.stacks[sigil] || 0) ? `✦ You carry the ${MATERIALS[sigil].name}.` : `Keeps the ${MATERIALS[sigil].name}.`}`
        : b.zone && b.zone !== 'island'
        ? `Guards ${ZONES[b.zone].name} (${ZONES[b.zone].subtitle}) from level ${b.minLevel}, and returns 10 minutes after each defeat. ${(p.inv.stacks[sigil] || 0) ? `✦ You carry the ${MATERIALS[sigil].name}.` : `Keeps the ${MATERIALS[sigil].name}.`}`
        : `Roams Dawnreach ${b.period === 'day' ? 'by day' : 'by night'}, in the ${b.arena === 'glade' ? 'Sunlit Glade' : 'Bone Ridge Crater'}, from level ${b.minLevel}.`;
      body.append(h('div', { class: 'boss-entry' }, h('h4', {}, b.name, h('small', {}, ` · ${b.title}`)),
        h('p', { class: 'muted small' }, `${where} Defeated ${n} time${n === 1 ? '' : 's'}.`),
        n ? h('p', {}, b.lore) : h('p', { class: 'muted' }, '???'),
        h('ul', { class: 'phases' }, b.phases.map((ph) => h('li', {}, h('b', {}, ph.name), ` — ${n ? ph.desc : '???'}`)))));
    }
  }
  root.append(tabs, body);
}
