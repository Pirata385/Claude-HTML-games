// Skills: the class kit, and choosing which four skills sit on the hotbar.
import { h } from '../dom.js';
import { skillsOf, SKILLS } from '../../data/skills.js';
import { CLASSES } from '../../data/classes.js';

export function skillsTab(g, root, opts, rerender) {
  const p = g.profile, cls = p.classId;
  const hb = p.hotbars[cls];
  const st = (g.ui.skillState ||= { pick: null });
  const res = CLASSES[cls].resource.name;
  const card = (s) => {
    const locked = p.level < s.unlock;
    const onBar = hb.indexOf(s.id);
    return h('div', { class: `skill${locked ? ' locked' : ''}${st.pick === s.id ? ' picked' : ''}` },
      h('div', { class: 'sk-ico' }, s.icon),
      h('div', { class: 'sk-body' },
        h('b', {}, s.name, h('small', {}, s.kind === 'basic' ? ' · basic attack' : s.kind === 'alt' ? ' · alternate' : ` · unlocks at Lv ${s.unlock}`)),
        h('p', {}, s.desc),
        h('small', { class: 'muted' }, [s.cost ? `${s.cost} ${res}` : null, s.cd ? `${s.cd} s cooldown` : null].filter(Boolean).join(' · '))),
      s.kind === 'skill' ? h('button', { class: 'btn small', disabled: locked, onclick: () => { st.pick = st.pick === s.id ? null : s.id; rerender(); } }, onBar >= 0 ? `On slot ${onBar + 1}` : st.pick === s.id ? 'Choose a slot ↓' : 'Place') : null);
  };
  const bar = h('div', { class: 'hb-edit' }, hb.map((id, k) => h('button', { class: `hb-slot${st.pick ? ' target' : ''}`, onclick: () => {
    if (!st.pick) return;
    const prev = hb.indexOf(st.pick);
    if (prev >= 0) hb[prev] = hb[k];
    hb[k] = st.pick; st.pick = null;
    g.ui.buildHotbar(); rerender();
  } }, h('small', {}, `Slot ${k + 1}`), h('span', {}, SKILLS[id]?.icon || '·'), h('b', {}, SKILLS[id]?.name || 'Empty'))));
  root.append(h('div', { class: 'skills-layout' },
    h('h3', {}, `${CLASSES[cls].name} skills`),
    h('p', { class: 'muted small' }, 'Four of your six skills sit on the hotbar. Pick a skill, then the slot to put it in. Key bindings can be changed in Settings.'),
    bar,
    h('div', { class: 'skill-list' }, skillsOf(cls).map(card))));
}
