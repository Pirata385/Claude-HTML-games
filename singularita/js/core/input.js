// Keyboard, mouse and touch input mapped to actions. Touch controls feed the same API.
export const ACTIONS = ['forward', 'back', 'left', 'right', 'jump', 'dodge', 'interact', 'lock', 'tonic', 'skill1', 'skill2', 'skill3', 'skill4',
  'menu', 'inventory', 'craft', 'character', 'skills', 'map', 'journal', 'recall', 'attack', 'alt', 'escape'];

export class Input {
  constructor(el, bindings) {
    this.el = el;
    this.down = new Set(); this.pressed = new Set(); this.released = new Set();
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.stick = { x: 0, y: 0 };
    this.locked = false;
    this.captureEnabled = true;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.lastDevice = this.isTouch ? 'touch' : 'mouse';
    this.setBindings(bindings);
    this.onKey = null; // hook for key rebinding
    const kd = (e) => {
      if (this.onKey) { e.preventDefault(); this.onKey(e.code); return; }
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const a = e.code === 'Escape' ? 'escape' : this.map.get(e.code);
      if (!a) return;
      if (a === 'menu' || a === 'jump') e.preventDefault();
      if (!e.repeat) this.press(a);
      this.lastDevice = 'mouse';
    };
    const ku = (e) => { const a = e.code === 'Escape' ? 'escape' : this.map.get(e.code); if (a) this.release(a); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    el.addEventListener('mousedown', (e) => {
      this.lastDevice = 'mouse';
      if (!this.locked && this.captureEnabled && !this.isTouch) { el.requestPointerLock?.()?.catch?.(() => {}); }
      if (e.button === 0) this.press('attack');
      if (e.button === 2) this.press('alt');
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.release('attack'); if (e.button === 2) this.release('alt'); });
    window.addEventListener('mousemove', (e) => { if (this.locked) { this.look.dx += e.movementX; this.look.dy += e.movementY; } });
    el.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); }, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; });
    window.addEventListener('blur', () => this.clear());
  }
  setBindings(b) { this.bindings = b; this.map = new Map(Object.entries(b).map(([a, code]) => [code, a])); }
  press(a) { if (!this.down.has(a)) { this.down.add(a); this.pressed.add(a); } }
  release(a) { if (this.down.has(a)) { this.down.delete(a); this.released.add(a); } }
  isDown(a) { return this.down.has(a); }
  wasPressed(a) { return this.pressed.has(a); }
  wasReleased(a) { return this.released.has(a); }
  consume(a) { const had = this.pressed.has(a); this.pressed.delete(a); return had; }
  axes() {
    let x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    let y = (this.isDown('forward') ? 1 : 0) - (this.isDown('back') ? 1 : 0);
    x += this.stick.x; y += this.stick.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  releasePointer() { if (document.pointerLockElement) document.exitPointerLock?.(); }
  clear() { for (const a of [...this.down]) this.release(a); this.stick.x = this.stick.y = 0; }
  endFrame() { this.pressed.clear(); this.released.clear(); this.look.dx = this.look.dy = 0; this.zoom = 0; }
}
