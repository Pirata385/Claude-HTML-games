// System: save, export, quit.
import { h } from '../dom.js';
import { exportString } from '../../systems/save.js';
import { fmtTime } from '../dom.js';

export function systemTab(g, root) {
  const p = g.profile;
  const code = h('textarea', { class: 'code', readonly: true, hidden: true });
  root.append(h('div', { class: 'system' },
    h('p', {}, `${p.name} · slot ${p.slot + 1} · ${fmtTime(p.playTime)} played. The game saves itself every minute, when you travel, craft, level up or rest.`),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => { g.save('manual'); g.ui.toast('Saved.', 'good'); } }, 'Save now'),
      h('button', { class: 'btn', onclick: () => { g.save('export'); code.value = exportString(p); code.hidden = false; code.select(); navigator.clipboard?.writeText(code.value).then(() => g.ui.toast('Save code copied.', 'good'), () => {}); } }, 'Export save code'),
      h('button', { class: 'btn', onclick: () => g.ui.openMenu('settings') }, 'Settings'),
      h('button', { class: 'btn danger', onclick: () => { g.ui.closeMenu(); g.hooks.quitToTitle(); } }, 'Save and quit to title'),
      h('button', { class: 'btn ghost', onclick: () => g.ui.closeMenu() }, 'Resume')),
    code,
    h('h4', {}, 'Controls'),
    h('ul', { class: 'controls-help' },
      h('li', {}, 'Move: WASD · Look: mouse (click the view to capture it) · Jump: Space · Dodge: Shift'),
      h('li', {}, 'Attack: left click (hold to charge or repeat) · Alternate: right click · Skills: 1–4 · Lock on: Q'),
      h('li', {}, 'Interact / gather: F (hold to keep swinging) · Tonic: R · Return to camp: B'),
      h('li', {}, 'Menus: Tab / I inventory · C crafting · K character · L skills · M map · J journal · Esc'),
      h('li', {}, 'Touch: left stick to move, drag the right side to look, buttons on the right to fight.'))));
}
