// Title, save slots, character creation and save import.
import { h, clear, fmtTime } from './dom.js';
import { CLASSES, CLASS_IDS } from '../data/classes.js';
import { skillsOf } from '../data/skills.js';
import { ZONES } from '../data/zones.js';
import { newProfile, importString, SLOT_COUNT } from '../systems/save.js';
import { openSettings } from './menus/settings.js';
import { toggleFullscreen, isStandalone } from './fullscreen.js';
import { portraitOf, releasePortraits } from '../render/portrait.js';

export class TitleScreen {
  constructor(root, ctx) { this.root = root; this.ctx = ctx; }

  show() { this.title(); }
  close() { clear(this.root); }

  frame(...content) {
    clear(this.root);
    this.root.append(h('div', { class: 'screen' }, h('div', { class: 'screen-bg' }), h('div', { class: 'screen-inner' }, ...content)));
  }

  title() {
    const slots = this.ctx.store.list();
    const recent = slots.filter(Boolean).sort((a, b) => b.savedAt - a.savedAt)[0];
    this.frame(
      h('div', { class: 'title-logo' }, 'SINGULARITA'),
      h('div', { class: 'title-sub' }, 'The Broken Isles'),
      h('div', { class: 'title-buttons' },
        recent && h('button', { class: 'btn primary big', onclick: () => this.play(recent.slot) },
          h('span', {}, 'Continue'), h('small', {}, `${recent.name} · ${CLASSES[recent.classId].name} Lv ${recent.level}`)),
        h('button', { class: `btn big${recent ? '' : ' primary'}`, onclick: () => this.create() }, 'New Character'),
        slots.some(Boolean) && h('button', { class: 'btn big', onclick: () => this.slots() }, 'Load Game'),
        h('button', { class: 'btn', onclick: () => openSettings(this.ctx, null) }, 'Settings'),
        h('button', { class: 'btn ghost', onclick: () => this.importView() }, 'Import a save code'),
        this.ctx.input?.isTouch && !isStandalone() && h('button', { class: 'btn ghost fs-toggle', onclick: () => toggleFullscreen().then((tip) => { if (tip) alert(tip); }) }, '⛶ Full screen'),
      ),
      h('p', { class: 'title-foot' }, `Up to ${SLOT_COUNT} characters are saved in this browser.`),
    );
  }

  play(slot) {
    const r = this.ctx.store.load(slot);
    if (!r.ok) { alert(r.error); return; }
    this.close();
    this.ctx.onPlay(r.profile);
  }

  slots() {
    const list = this.ctx.store.list();
    const used = list.filter(Boolean).length;
    this.frame(
      h('h2', { class: 'screen-title' }, 'Load Game'),
      h('p', { class: 'muted small save-count' }, `${used} of ${SLOT_COUNT} slots in use. Tap a character to play.`),
      h('div', { class: 'save-list' }, list.map((s, i) => (s ? this.saveCard(s, i) : this.emptyCard(i)))),
      h('button', { class: 'btn ghost', onclick: () => this.title() }, '← Back'),
    );
    releasePortraits();
  }

  saveCard(s, i) {
    const c = CLASSES[s.classId];
    const img = portraitOf(s.classId, s.weapon?.material, s.armor?.material);
    const stat = (ico, label, v) => h('span', { class: 'save-stat', title: label }, h('i', {}, ico), String(v));
    const meta = [ZONES[s.zone]?.name || 'Dawnreach', `${fmtTime(s.playTime)} played`, `${s.bosses} boss${s.bosses === 1 ? '' : 'es'} defeated`, `${s.deaths} death${s.deaths === 1 ? '' : 's'}`];
    return h('div', { class: 'save-card', style: { '--cc': c.color } },
      h('button', { class: 'save-main', onclick: () => this.play(i), 'aria-label': `Play ${s.name}` },
        h('div', { class: 'save-portrait' }, img ? h('img', { src: img, alt: '' }) : h('span', { class: 'save-emblem' }, c.name[0])),
        h('div', { class: 'save-info' },
          h('div', { class: 'save-head' }, h('b', { class: 'save-name' }, s.name), h('span', { class: 'save-lv' }, `Lv ${s.level}`)),
          h('div', { class: 'save-class' }, h('span', { class: 'cls' }, c.name), s.title && h('span', { class: 'save-title' }, `· ${s.title}`), s.cycle > 0 && h('span', { class: 'save-asc' }, `✦ Ascension ${s.cycle}`)),
          h('div', { class: 'save-stats' }, stat('❤', 'Health', s.maxHp), stat('⚔', 'Damage', s.power), stat('⛨', 'Defence', s.def)),
          h('div', { class: 'save-gear' }, `${s.weapon?.name || 'No weapon'} · ${s.armor?.name || 'No armour'}`),
          h('small', { class: 'save-meta' }, meta.join(' · ')))),
      h('div', { class: 'save-actions' },
        h('button', { class: 'btn primary', onclick: () => this.play(i) }, 'Play'),
        h('button', { class: 'btn ghost', onclick: () => this.exportSlot(i) }, 'Export'),
        h('button', { class: 'btn danger', onclick: () => { if (confirm(`Delete ${s.name} for good?`)) { this.ctx.store.remove(i); this.slots(); } } }, 'Delete')));
  }

  emptyCard(i) {
    return h('div', { class: 'save-card empty' },
      h('button', { class: 'save-main', onclick: () => this.create(i) },
        h('div', { class: 'save-portrait' }, h('span', { class: 'save-emblem' }, '+')),
        h('div', { class: 'save-info' }, h('b', { class: 'save-name' }, `Slot ${i + 1}`), h('span', { class: 'muted' }, 'Empty. Tap to create a new character.'))));
  }

  exportSlot(i) {
    const r = this.ctx.store.load(i);
    if (!r.ok) return;
    import('../systems/save.js').then(({ exportString }) => {
      const code = exportString(r.profile);
      const ta = h('textarea', { class: 'code', readonly: true }, code);
      this.frame(h('h2', { class: 'screen-title' }, 'Save code'), h('p', {}, 'Copy this code somewhere safe. Import it on any browser to continue.'), ta,
        h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { ta.select(); navigator.clipboard?.writeText(code); } }, 'Copy'), h('button', { class: 'btn ghost', onclick: () => this.slots() }, '← Back')));
    });
  }

  importView() {
    const ta = h('textarea', { class: 'code', placeholder: 'Paste a save code (it starts with SGv1:)' });
    const out = h('p', { class: 'error' });
    this.frame(h('h2', { class: 'screen-title' }, 'Import a save'), ta, out,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => {
          const r = importString(ta.value);
          if (!r.ok) { out.textContent = r.error; return; }
          const list = this.ctx.store.list();
          let slot = list.findIndex((s) => !s);
          if (slot < 0) { slot = Number(prompt(`All slots are full. Overwrite which slot (1-${SLOT_COUNT})?`)) - 1; if (!(slot >= 0 && slot < SLOT_COUNT)) return; }
          r.profile.slot = slot;
          this.ctx.store.save(slot, r.profile);
          this.slots();
        } }, 'Import'),
        h('button', { class: 'btn ghost', onclick: () => this.title() }, '← Back')));
  }

  create(slotHint) {
    let chosen = 'swordsman';
    const name = h('input', { class: 'name-input', maxlength: 16, value: '', placeholder: 'Your name' });
    const detail = h('div', { class: 'class-detail' });
    const cards = h('div', { class: 'class-cards' });
    const renderDetail = () => {
      const c = CLASSES[chosen];
      clear(detail).append(
        h('h3', { style: { color: c.color } }, c.name),
        h('p', { class: 'tagline' }, c.tagline),
        h('p', {}, c.desc),
        h('p', { class: 'muted' }, `Resource: ${c.resource.name} · Main attributes: ${Object.keys(c.scaling).map((a) => a.toUpperCase()).join(', ')}`),
        h('ul', { class: 'skill-preview' }, skillsOf(chosen).map((s) => h('li', {}, h('span', { class: 'ico' }, s.icon), h('b', {}, s.name), s.kind === 'skill' ? h('small', {}, ` Lv ${s.unlock}`) : h('small', {}, s.kind === 'basic' ? ' basic' : ' alt')))),
      );
      for (const el of cards.children) el.classList.toggle('on', el.dataset.cls === chosen);
    };
    for (const id of CLASS_IDS) {
      const c = CLASSES[id];
      cards.append(h('button', { class: 'class-card', 'data-cls': id, style: { '--cc': c.color }, onclick: () => { chosen = id; renderDetail(); } },
        h('b', {}, c.name), h('small', {}, c.tagline)));
    }
    renderDetail();
    this.frame(
      h('h2', { class: 'screen-title' }, 'New Character'),
      h('label', { class: 'field' }, h('span', {}, 'Name'), name),
      cards, detail,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary big', onclick: () => {
          const list = this.ctx.store.list();
          let slot = slotHint ?? list.findIndex((s) => !s);
          if (slot < 0) { slot = Number(prompt(`All slots are full. Replace which slot (1-${SLOT_COUNT})?`)) - 1; if (!(slot >= 0 && slot < SLOT_COUNT)) return; }
          const nm = name.value.trim().slice(0, 16) || 'Wanderer';
          const p = newProfile({ name: nm, classId: chosen, slot, seed: (Math.random() * 2 ** 31) >>> 0 });
          this.ctx.store.save(slot, p);
          this.close();
          this.ctx.onPlay(p);
        } }, 'Begin'),
        h('button', { class: 'btn ghost', onclick: () => this.title() }, '← Back')),
      h('p', { class: 'muted small' }, 'You can change class later at the Altar in camp. Each class keeps its own gear.'),
    );
    name.focus();
  }
}
