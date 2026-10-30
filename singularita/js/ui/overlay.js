// 2D overlay drawn over the 3D view: floating numbers, enemy health bars, elite tags.
import * as THREE from 'three';

const _v = new THREE.Vector3();

export class Overlay {
  constructor(canvas, camera, settings) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = camera;
    this.settings = settings;
    this.texts = [];
    this.bars = [];
    this.dpr = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.cv.clientWidth || window.innerWidth; this.h = this.cv.clientHeight || window.innerHeight;
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
  }
  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    if (_v.z > 1 || _v.z < -1) return null;
    return [(_v.x * 0.5 + 0.5) * this.w, (-_v.y * 0.5 + 0.5) * this.h];
  }
  // kind: 'dmg' | 'crit' | 'hurt' | 'heal' | 'info' | 'loot' | 'xp'
  text(x, y, z, str, kind = 'dmg') {
    if (!this.settings.ui.damageNumbers && (kind === 'dmg' || kind === 'crit')) return;
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x, y, z, str, kind, t: 0, life: kind === 'loot' || kind === 'info' ? 1.6 : 0.9, jx: (Math.random() - 0.5) * 24 });
  }
  // Called each frame by the enemy system with entities worth a bar.
  setBars(list) { this.bars = list; }

  draw(dt) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    for (const e of this.bars) {
      const p = this.project(e.x, e.ry + e.height * e.scale + 0.45, e.z);
      if (!p) continue;
      const w = e.elite ? 64 : 44, hgt = e.elite ? 6 : 5;
      const x = p[0] - w / 2, y = p[1];
      c.fillStyle = 'rgba(10,10,20,0.75)'; c.fillRect(x - 1, y - 1, w + 2, hgt + 2);
      c.fillStyle = e.elite ? '#ffb347' : '#e8455a'; c.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), hgt);
      if (e.shield > 0) { c.fillStyle = '#7fb3ff'; c.fillRect(x, y - 3, w * Math.min(1, e.shield / e.maxHp), 2); }
      if (e.elite) {
        c.font = '600 11px system-ui, sans-serif'; c.textAlign = 'center';
        c.fillStyle = '#ffdf8a'; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3;
        c.strokeText(e.tag, p[0], y - 5); c.fillText(e.tag, p[0], y - 5);
      }
      let sx = x;
      for (const s of e.statusIcons) { c.fillStyle = s.color; c.font = '12px system-ui'; c.textAlign = 'left'; c.fillText(s.icon, sx, y + hgt + 12); sx += 12; }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.life) { this.texts.splice(i, 1); continue; }
      const p = this.project(t.x, t.y + t.t * 1.4, t.z);
      if (!p) continue;
      const k = t.t / t.life;
      const crit = t.kind === 'crit';
      const size = crit ? 24 : t.kind === 'loot' || t.kind === 'info' ? 14 : t.kind === 'xp' ? 13 : 17;
      c.globalAlpha = Math.min(1, (1 - k) * 2);
      c.font = `800 ${Math.round(size * (crit ? 1 + (1 - Math.min(1, t.t * 6)) * 0.4 : 1))}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.lineWidth = 3.5; c.strokeStyle = 'rgba(10,8,20,0.85)';
      c.fillStyle = { dmg: '#ffffff', crit: '#ffd34a', hurt: '#ff5a6e', heal: '#6fe08a', info: '#c9d6ff', loot: '#ffe9b0', xp: '#9fd8ff', status: '#c48cff' }[t.kind] || '#fff';
      c.strokeText(t.str, p[0] + t.jx, p[1]); c.fillText(t.str, p[0] + t.jx, p[1]);
      c.globalAlpha = 1;
    }
  }
  clear() { this.texts.length = 0; this.bars = []; }
}
