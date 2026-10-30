// Swordsman: three-hit combos, guard and perfect parry, gap closers and crowd control.
import { BaseKit, dirOf } from './base.js';
import { isInFront } from '../formulas.js';

export class SwordsmanKit extends BaseKit {
  constructor(g) { super(g, 'swordsman'); this.combo = 0; this.comboT = 0; this.swingCd = 0; this.guardT = 0; this.whirl = null; }

  updateClass(dt, input) {
    this.swingCd -= dt; this.comboT -= dt;
    // Guard (hold alt): slower, blocks frontal hits; the first 0.25 s is a parry window.
    const guarding = input.isDown('alt') && !this.whirl;
    if (guarding && !this.animState.guard) { this.guardT = 0; this.g.bus.emit('sfx', { id: 'guard' }); }
    this.animState.guard = guarding;
    this.guardT += dt;
    this.moveMult = guarding ? 0.45 : this.whirl ? 0.8 : 1;
    if (guarding) this.face(this.aimYaw(8), 0.1);
    if (!guarding && (input.wasPressed('attack') || (input.isDown('attack') && this.comboT > 0)) && this.swingCd <= 0 && !this.whirl) this.swing();
  }

  swing() {
    const s = this.basic;
    if (this.comboT <= 0) this.combo = 0;
    const step = this.combo;
    const dur = 0.34 / this.stats.attackSpeed;
    this.play(step === 1 ? 'slash2' : step === 2 ? 'overhead' : 'slash', dur);
    this.melee(s.range, s.arc, s.dmg[step], { knock: step === 2 ? 1.2 : 0.25 });
    if (step === 2) this.g.cam.shake(0.12);
    this.combo = (step + 1) % 3;
    this.comboT = 0.75;
    this.swingCd = dur * (step === 2 ? 1.35 : 0.9);
  }

  onIncoming(hit) {
    if (!this.animState.guard || !hit.source || hit.opts.unblockable) return null;
    if (hit.source.x != null && !isInFront(this.p, hit.source)) return null;
    if (this.guardT <= this.alt.parryWindow) {
      const src = hit.source;
      if (src.alive && src.statuses) {
        this.combat.applyStatus(src, 'stun', { dur: 1.2 });
        if (src.hp != null) this.combat.applyRaw(src, hit.amount, 'dmg');
      }
      this.g.overlay.text(this.p.x, this.p.ry + 2.3, this.p.z, 'Parry!', 'status');
      this.fx.burst(this.p.x + Math.sin(this.p.yaw) * 0.6, this.p.ry + 1.1, this.p.z + Math.cos(this.p.yaw) * 0.6, 16, { color: '#ffe066', speed: 6 });
      this.g.hitStop(0.08);
      this.g.bus.emit('sfx', { id: 'parry' });
      this.g.bus.emit('parry', {});
      return { parried: true };
    }
    if (this.p.res >= this.alt.cost) {
      this.p.res -= this.alt.cost;
      this.g.bus.emit('sfx', { id: 'block' });
      this.fx.burst(this.p.x + Math.sin(this.p.yaw) * 0.6, this.p.ry + 1.1, this.p.z + Math.cos(this.p.yaw) * 0.6, 6, { color: '#cfd4dc', speed: 4 });
      return { blocked: this.alt.block };
    }
    this.g.overlay.text(this.p.x, this.p.ry + 2.3, this.p.z, 'Guard broken', 'info');
    return null;
  }

  s_sw_lunge(s) {
    const yaw = this.aimYaw(s.range + 2), d = dirOf(yaw);
    this.face(yaw);
    const x0 = this.p.x, z0 = this.p.z;
    const dist = this.dash(d.x, d.z, s.range, 0.25);
    this.play('thrust', 0.25);
    for (const t of this.combat.line(x0, z0, d.x, d.z, dist + 1, 2.2, 'player')) this.combat.hit(t, { mult: s.dmg, knock: 0.6, from: { x: x0, z: z0 } });
    this.fx.burst(x0, this.p.ry + 0.4, z0, 10, { color: '#e8e2d0', speed: 3, vx: d.x * 6, vz: d.z * 6 });
  }

  s_sw_whirl(s) {
    this.play('spin', s.duration);
    this.whirl = this.combat.zone({ x: this.p.x, z: this.p.z, r: s.radius, t: s.duration, interval: 0.3, team: 'player', follow: this.p, color: '#fff4d0',
      onTick: (ts) => { for (const t of ts) this.combat.hit(t, { mult: s.dmg, knock: 0.3 }); this.g.bus.emit('sfx', { id: 'swing' }); },
      onEnd: () => { this.whirl = null; } });
  }

  s_sw_sunder(s) {
    const yaw = this.aimYaw(5);
    this.face(yaw, 0.5);
    this.play('overhead', 0.45);
    this.combat.after(0.22, () => {
      this.melee(s.range, s.arc, s.dmg, { yaw, knock: 0.8, status: [{ id: 'sunder' }], color: '#ffb347' });
      this.g.cam.shake(0.2);
    });
  }

  s_sw_warcry(s) {
    this.p.statuses.apply('guarded', { dur: s.duration });
    for (const e of this.combat.circle(this.p.x, this.p.z, s.radius, 'player')) this.combat.applyStatus(e, 'taunt');
    this.fx.decal({ shape: 'ring', x: this.p.x, z: this.p.z, y: this.p.ry, r: s.radius, t: 0.6, fill: false, color: '#f2c14e' });
    this.g.overlay.text(this.p.x, this.p.ry + 2.4, this.p.z, 'War Cry!', 'status');
    this.g.cam.shake(0.15);
  }

  s_sw_earth(s) {
    const yaw = this.aimYaw(s.range), d = dirOf(yaw);
    this.face(yaw, 0.5);
    this.play('slam', 0.4);
    const x0 = this.p.x, z0 = this.p.z, y0 = this.p.ry;
    const hit = new Set();
    for (let k = 1; k <= s.range; k++) {
      this.combat.after(0.12 + k * 0.035, () => {
        const x = x0 + d.x * k, z = z0 + d.z * k;
        this.fx.burst(x, y0 + 0.2, z, 4, { color: '#b8a98a', speed: 3, up: 5, life: 0.5 });
        for (const t of this.combat.circle(x, z, s.width / 2, 'player')) if (!hit.has(t)) { hit.add(t); this.combat.hit(t, { mult: s.dmg, knock: 0.6, status: [{ id: 'stun', dur: 0.8 }] }); }
      });
    }
    this.g.cam.shake(0.3);
    this.g.bus.emit('sfx', { id: 'slam' });
  }

  s_sw_dance(s) {
    const targets = this.combat.circle(this.p.x, this.p.z, s.range, 'player').sort((a, b) => a.dist2(this.p) - b.dist2(this.p)).slice(0, s.hits);
    if (!targets.length) { this.warn('No foes in reach.'); return false; }
    this.p.iframes = 0.15 * targets.length + 0.3;
    targets.forEach((t, k) => this.combat.after(k * 0.14, () => {
      if (!t.alive) return;
      const a = Math.random() * Math.PI * 2;
      this.p.x = t.x + Math.cos(a) * (t.radius + 0.8); this.p.z = t.z + Math.sin(a) * (t.radius + 0.8);
      const yaw = Math.atan2(t.x - this.p.x, t.z - this.p.z);
      this.face(yaw);
      this.play(k % 2 ? 'slash2' : 'slash', 0.12);
      this.combat.hit(t, { mult: s.dmg, knock: 0.3 });
      this.fx.slash(this.p.x, this.p.ry + 0.9, this.p.z, yaw, 2.4, 140, '#9ff0ff', 0.14);
      this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 6, { color: '#9ff0ff', speed: 3 });
    }));
  }
}
