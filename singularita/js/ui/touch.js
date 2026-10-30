// Touch controls: floating joystick on the left, drag-to-look on the right, an action cluster
// with cooldown sweeps, a contextual interact button. Feeds the same Input actions as the keyboard.
import { h, clear } from './dom.js';
import { SKILLS } from '../data/skills.js';

let installed = false, current = null;

export class TouchControls {
  constructor(game, root) {
    this.g = game; this.root = root;
    this.stick = { id: null, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.buttons = [];
    this.root.hidden = !game.input.isTouch;
    this.build();
    const onStart = (e) => this.start(e), onMove = (e) => this.move(e), onEnd = (e) => this.end(e);
    root.addEventListener('touchstart', onStart, { passive: false });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd, { passive: false });
    root.addEventListener('touchcancel', onEnd, { passive: false });
    current = this;
    if (!installed) {
      installed = true;
      window.addEventListener('touchstart', () => { const c = current; if (!c || c.g.disposed) return; c.g.input.lastDevice = 'touch'; if (c.root.hidden) { c.root.hidden = false; c.applyLayout(); } }, { passive: true, capture: true });
    }
    this.applyLayout();
    this.onResize = () => { if (current === this) this.applyLayout(); };
    addEventListener('resize', this.onResize);
  }

  dispose() { removeEventListener('resize', this.onResize); }

  applyLayout() {
    const t = this.g.settings.touch;
    // Scale the cluster to the short side of the screen so it never crowds the HUD.
    const portrait = innerHeight > innerWidth;
    const fit = portrait ? Math.min(1.1, Math.max(0.8, innerWidth / 430)) : Math.min(1.1, Math.max(0.68, innerHeight / 600));
    this.root.style.setProperty('--tsize', t.size * fit);
    document.body.style.setProperty('--tsize', t.size * fit);
    this.root.style.setProperty('--topa', t.opacity);
    this.root.classList.toggle('lefty', t.leftHanded);
    document.body.classList.toggle('touch-ui', !this.root.hidden);
  }

  build() {
    clear(this.root);
    this.buttons = [];
    this.stickBase = h('div', { class: 't-stick', hidden: true }, h('div', { class: 't-knob' }));
    this.lookZone = h('div', { class: 't-look' });
    this.moveZone = h('div', { class: 't-move' });
    this.cluster = h('div', { class: 't-cluster' });
    this.root.append(this.moveZone, this.lookZone, this.stickBase, this.cluster);
    this.rebuild();
  }

  rebuild() {
    const g = this.g;
    if (!this.cluster || !g.player.kit) return;
    clear(this.cluster);
    this.buttons = [];
    const kit = g.player.kit;
    const btn = (action, cls, icon, label) => {
      const cd = h('div', { class: 'cd' });
      const b = h('button', { class: `tb ${cls}`, 'data-action': action, 'aria-label': label }, h('span', { class: 'ti' }, icon), label ? h('small', {}, label) : null, cd);
      this.cluster.append(b);
      this.buttons.push({ el: b, action, cd, id: null });
      return this.buttons[this.buttons.length - 1];
    };
    btn('attack', 'atk', kit.basic.icon, null).id = kit.basic.id;
    btn('alt', 'alt', kit.alt.icon, null).id = kit.alt.id;
    g.profile.hotbars[g.profile.classId].forEach((id, k) => { btn(`skill${k + 1}`, `sk sk${k + 1}`, SKILLS[id]?.icon || '·', null).id = id; });
    btn('dodge', 'dodge', '⤳', 'Dodge');
    btn('jump', 'jump', '⤒', 'Jump');
    btn('lock', 'lock', '◎', 'Lock');
    btn('tonic', 'tonic', '❤', null);
    this.interactBtn = btn('interact', 'interact', '✋', 'Use');
    this.interactBtn.el.hidden = true;
  }

  setInteract(label) {
    if (!this.interactBtn) return;
    this.interactBtn.el.hidden = !label;
    if (label) this.interactBtn.el.querySelector('small').textContent = label.length > 18 ? label.slice(0, 17) + '…' : label;
  }

  start(e) {
    const g = this.g;
    for (const t of e.changedTouches) {
      const b = t.target.closest?.('.tb');
      if (b) { e.preventDefault(); const a = b.dataset.action; g.input.press(a); b.classList.add('down'); (this.held ||= new Map()).set(t.identifier, { a, b }); continue; }
      const lefty = g.settings.touch.leftHanded;
      const leftSide = lefty ? t.clientX > window.innerWidth * 0.55 : t.clientX < window.innerWidth * 0.45;
      if (leftSide && this.stick.id === null) {
        e.preventDefault();
        this.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY };
        this.stickBase.hidden = false;
        this.stickBase.style.transform = `translate(${t.clientX}px, ${t.clientY}px)`;
        this.stickBase.firstChild.style.transform = 'translate(-50%, -50%)';
      } else if (this.look.id === null) {
        e.preventDefault();
        this.look = { id: t.identifier, x: t.clientX, y: t.clientY, t0: performance.now(), sx: t.clientX, sy: t.clientY };
      }
    }
  }
  move(e) {
    const g = this.g;
    for (const t of e.changedTouches) {
      if (t.identifier === this.stick.id) {
        e.preventDefault();
        const R = 56 * g.settings.touch.size;
        let dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
        const l = Math.hypot(dx, dy);
        if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
        g.input.stick.x = dx / R; g.input.stick.y = -dy / R;
        this.stickBase.firstChild.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (t.identifier === this.look.id) {
        e.preventDefault();
        g.input.look.dx += (t.clientX - this.look.x) * 1.3;
        g.input.look.dy += (t.clientY - this.look.y) * 1.3;
        this.look.x = t.clientX; this.look.y = t.clientY;
      }
    }
  }
  end(e) {
    const g = this.g;
    for (const t of e.changedTouches) {
      const held = this.held?.get(t.identifier);
      if (held) { g.input.release(held.a); held.b.classList.remove('down'); this.held.delete(t.identifier); continue; }
      if (t.identifier === this.stick.id) { this.stick.id = null; g.input.stick.x = g.input.stick.y = 0; this.stickBase.hidden = true; }
      if (t.identifier === this.look.id) {
        // A quick tap on the view (no drag) locks on to the nearest foe in front.
        const quick = performance.now() - this.look.t0 < 200 && Math.hypot(t.clientX - this.look.sx, t.clientY - this.look.sy) < 10;
        this.look.id = null;
        if (quick && !g.paused) { g.input.press('lock'); setTimeout(() => g.input.release('lock'), 30); }
      }
    }
  }

  update() {
    if (this.root.hidden) return;
    const kit = this.g.player.kit;
    for (const b of this.buttons) {
      if (!b.id) continue;
      const s = SKILLS[b.id];
      const frac = s.kind === 'skill' ? kit.cdFrac(b.id) : 0;
      b.cd.style.setProperty('--cd', `${Math.round(frac * 360)}deg`);
      b.cd.style.display = frac > 0 ? 'block' : 'none';
      b.el.classList.toggle('locked', !kit.unlocked(b.id));
    }
  }
}
