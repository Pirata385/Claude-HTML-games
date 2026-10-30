// Settings: audio, graphics, camera, controls (rebinding), touch layout and interface.
// Used in game (as a menu tab) and from the title screen (as a modal).
import { h, clear } from '../dom.js';
import { GRAPHICS_PRESETS, applyPreset, DEFAULT_BINDINGS } from '../../systems/settings.js';

const ACTION_NAMES = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', jump: 'Jump', dodge: 'Dodge', interact: 'Interact / gather',
  lock: 'Lock on', tonic: 'Drink tonic', skill1: 'Skill 1', skill2: 'Skill 2', skill3: 'Skill 3', skill4: 'Skill 4', menu: 'Menu', inventory: 'Inventory',
  craft: 'Crafting', character: 'Character', skills: 'Skills', map: 'Map', journal: 'Journal', recall: 'Return to camp',
};

function panel(settings, apply, rerender, input) {
  const s = settings;
  const slider = (label, obj, key, min, max, step, fmt = (v) => `${Math.round(v * 100)}%`) => {
    const out = h('b', {}, fmt(obj[key]));
    return h('label', { class: 'set-row' }, h('span', {}, label), h('input', { type: 'range', min, max, step, value: obj[key], oninput: (e) => { obj[key] = Number(e.target.value); out.textContent = fmt(obj[key]); apply(); } }), out);
  };
  const toggle = (label, obj, key, after) => h('label', { class: 'set-row' }, h('span', {}, label), h('input', { type: 'checkbox', checked: obj[key], onchange: (e) => { obj[key] = e.target.checked; if (obj === s.graphics) s.graphics.preset = 'custom'; apply(); after?.(); } }), h('b', {}, ''));
  const gfxSlider = (label, key, min, max, step, fmt) => { const r = slider(label, s.graphics, key, min, max, step, fmt); r.querySelector('input').addEventListener('change', () => { s.graphics.preset = 'custom'; rerender(); }); return r; };
  const binds = h('div', { class: 'binds' }, Object.keys(DEFAULT_BINDINGS).map((a) => h('div', { class: 'set-row' }, h('span', {}, ACTION_NAMES[a]),
    h('button', { class: 'btn small key', onclick: (e) => {
      const btn = e.currentTarget;
      btn.textContent = 'Press a key…';
      if (!input) return;
      input.onKey = (code) => {
        input.onKey = null;
        if (code !== 'Escape') { for (const [k, v] of Object.entries(s.controls.bindings)) if (v === code && k !== a) s.controls.bindings[k] = s.controls.bindings[a]; s.controls.bindings[a] = code; }
        apply(); rerender();
      };
    } }, s.controls.bindings[a]))));
  return h('div', { class: 'settings' },
    h('section', {}, h('h4', {}, 'Audio'),
      slider('Master', s.audio, 'master', 0, 1, 0.05), slider('Music', s.audio, 'music', 0, 1, 0.05), slider('Effects', s.audio, 'sfx', 0, 1, 0.05),
      slider('Ambience', s.audio, 'ambient', 0, 1, 0.05), slider('Interface', s.audio, 'ui', 0, 1, 0.05)),
    h('section', {}, h('h4', {}, 'Graphics'),
      h('div', { class: 'row' }, ...Object.keys(GRAPHICS_PRESETS).map((p) => h('button', { class: `btn small${s.graphics.preset === p ? ' primary' : ''}`, onclick: () => { applyPreset(s, p); apply(); rerender(); } }, p[0].toUpperCase() + p.slice(1))),
        s.graphics.preset === 'custom' ? h('span', { class: 'muted small' }, 'Custom') : null),
      gfxSlider('Render scale', 'renderScale', 0.5, 1.5, 0.05), gfxSlider('View distance', 'viewDistance', 50, 180, 10, (v) => `${v} m`),
      gfxSlider('Particles', 'particles', 0.2, 1, 0.05), gfxSlider('Field of view', 'fov', 50, 85, 1, (v) => `${v}°`), gfxSlider('Max creatures', 'maxEnemies', 16, 48, 4, (v) => `${v}`),
      toggle('Shadows', s.graphics, 'shadows'), toggle('Grass and flowers', s.graphics, 'grass'), toggle('Dynamic resolution', s.graphics, 'dynamicRes'),
      h('p', { class: 'muted small' }, 'Grass and particle changes apply fully on the next zone you enter.')),
    h('section', {}, h('h4', {}, 'Camera'),
      slider('Horizontal sensitivity', s.camera, 'sensX', 0.2, 3, 0.05, (v) => v.toFixed(2)), slider('Vertical sensitivity', s.camera, 'sensY', 0.2, 3, 0.05, (v) => v.toFixed(2)),
      slider('Distance', s.camera, 'distance', 3, 12, 0.5, (v) => `${v} m`), toggle('Invert vertical', s.camera, 'invertY'), toggle('Screen shake', s.camera, 'shake')),
    h('section', {}, h('h4', {}, 'Touch'),
      slider('Button size', s.touch, 'size', 0.7, 1.4, 0.05), slider('Button opacity', s.touch, 'opacity', 0.3, 1, 0.05), toggle('Left-handed layout', s.touch, 'leftHanded')),
    h('section', {}, h('h4', {}, 'Interface'), toggle('Damage numbers', s.ui, 'damageNumbers'), toggle('Objective hints', s.ui, 'hints')),
    h('section', {}, h('h4', {}, 'Key bindings'), binds, h('button', { class: 'btn small', onclick: () => { s.controls.bindings = { ...DEFAULT_BINDINGS }; apply(); rerender(); } }, 'Reset bindings')));
}

export function settingsTab(g, root, opts, rerender) {
  root.append(panel(g.settings, () => g.applySettings(), rerender, g.input));
}

// Modal version for the title screen.
export function openSettings(ctx) {
  const host = document.getElementById('dialog');
  const render = () => {
    clear(host).append(h('div', { class: 'dlg wide' }, h('div', { class: 'dlg-body' }, h('h3', {}, 'Settings'),
      panel(ctx.settings, () => { ctx.renderer.applyQuality(ctx.settings.graphics); ctx.saveSettings(); }, render, null),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => { host.hidden = true; } }, 'Done')))));
    host.hidden = false;
  };
  render();
}
