// Archer: hold-to-charge shots, steady aim, fans of arrows, traps and an arrow storm.
import { BaseKit, dirOf } from './base.js';

export class ArcherKit extends BaseKit {
  constructor(g) { super(g, 'archer'); this.charging = false; this.charge = 0; this.shotCd = 0; }

  updateClass(dt, input) {
    this.shotCd -= dt;
    const aiming = input.isDown('alt');
    this.animState.aim = aiming || this.charging;
    this.moveMult = aiming ? 0.5 : this.charging ? 0.7 : 1;
    if (this.animState.aim) this.face(this.aimYaw(30), 0.1);
    if (input.wasPressed('attack') && this.shotCd <= 0) { this.charging = true; this.charge = 0; }
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / this.basic.chargeTime);
      this.animState.wind = this.charge;
      if (!input.isDown('attack')) { this.release(); }
    } else this.animState.wind = 0;
  }

  release() {
    this.charging = false;
    const s = this.basic;
    const c = this.charge;
    const mult = s.dmg[0] + (s.dmg[1] - s.dmg[0]) * c;
    const pierce = c >= 0.95 || this.p.statuses.has('hawkeye') ? 3 : 0;
    this.arrow(this.aimYaw(32), mult, { pierce, speed: s.speed * (0.8 + c * 0.4) });
    this.play('bow', 0.18);
    this.shotCd = 0.32 / this.stats.attackSpeed;
    this.charge = 0;
  }

  // Fires one arrow; spread shrinks with Dexterity and while aiming.
  arrow(yaw, mult, o = {}) {
    const spread = (o.exact ? 0 : 0.05) * (1 - this.stats.accuracy) * (this.g.input.isDown('alt') ? 0.3 : 1);
    yaw += (Math.random() - 0.5) * spread;
    const d = dirOf(yaw);
    const tgt = this.aimTarget(32);
    const sy = this.p.ry + 1.35;
    let dy = 0;
    if (tgt) { const dist = Math.hypot(tgt.x - this.p.x, tgt.z - this.p.z); dy = (tgt.ry + tgt.height * (tgt.scale || 1) * 0.5 - sy) / Math.max(1, dist); }
    else dy = -Math.tan(Math.max(0, this.g.cam.pitch - 0.42)) * 0.4;
    const x0 = this.p.x, z0 = this.p.z;
    this.combat.shoot({ x: x0 + d.x * 0.6, y: sy, z: z0 + d.z * 0.6, dx: d.x, dy, dz: d.z, speed: (o.speed || 40) * this.stats.projSpeed, team: 'player', kind: 'arrow', radius: 0.3, life: 1.4, pierce: o.pierce || 0,
      onHit: (e) => {
        const close = Math.hypot(e.x - x0, e.z - z0) < 3 ? 0.7 : 1; // point-blank penalty
        this.combat.hit(e, { mult: mult * close, ranged: true, knock: o.knock || 0.15, status: o.status, from: { x: x0, z: z0 } });
        o.onHit?.(e);
      },
      onExpire: o.onExpire });
    this.g.bus.emit('sfx', { id: 'bow' });
  }

  s_ar_volley(s) {
    const yaw = this.aimYaw(25);
    this.face(yaw); this.play('bow', 0.2);
    const step = (s.spread * Math.PI) / 180 / (s.count - 1);
    for (let k = 0; k < s.count; k++) this.arrow(yaw - (s.spread * Math.PI) / 360 + step * k, s.dmg, { exact: true });
  }

  s_ar_roll(s) {
    const yaw = this.aimYaw(25), d = dirOf(yaw);
    this.dash(-d.x, -d.z, s.range, 0.35);
    this.face(yaw); this.play('bow', 0.2);
    this.combat.after(0.12, () => this.arrow(this.aimYaw(25), s.dmg, { exact: true }));
  }

  s_ar_pin(s) {
    const yaw = this.aimYaw(30);
    this.face(yaw); this.play('bow', 0.2);
    this.arrow(yaw, s.dmg, { exact: true, status: [{ id: 'root', dur: s.duration }], knock: 0 });
  }

  s_ar_blast(s) {
    const yaw = this.aimYaw(30);
    this.face(yaw); this.play('bow', 0.2);
    let done = false;
    const boom = (x, y, z) => {
      if (done) return; done = true;
      this.fx.burst(x, y, z, 24, { color: '#ffb347', speed: 7, up: 3 });
      this.fx.decal({ shape: 'ring', x, z, y: this.g.grid.height(Math.floor(x), Math.floor(z)), r: s.radius, t: 0.35, fill: false, color: '#ffb347' });
      this.g.cam.shake(0.2);
      this.g.bus.emit('sfx', { id: 'explode' });
      for (const t of this.combat.circle(x, z, s.radius, 'player')) this.combat.hit(t, { mult: s.dmg, knock: 1.4, ranged: true, from: { x, z } });
    };
    this.arrow(yaw, 0.3, { exact: true, onHit: (e) => boom(e.x, e.ry + 1, e.z), onExpire: (pr) => boom(pr.x, pr.y, pr.z) });
  }

  s_ar_rain(s) {
    const pt = this.aimPoint(s.range);
    this.face(Math.atan2(pt.x - this.p.x, pt.z - this.p.z)); this.play('bow', 0.25);
    const y = this.g.grid.height(Math.floor(pt.x), Math.floor(pt.z));
    this.combat.zone({ x: pt.x, z: pt.z, y, r: s.radius, t: s.duration, interval: 0.25, team: 'player', color: '#c9a874',
      onTick: (ts, z) => {
        for (let k = 0; k < 4; k++) { const a = Math.random() * 6.28, r = Math.random() * s.radius; this.fx.burst(z.x + Math.cos(a) * r, y + 3, z.z + Math.sin(a) * r, 1, { color: '#d8c8a0', speed: 0.2, up: -14, gravity: 0, life: 0.22, size: 0.1 }); }
        for (const t of ts) this.combat.hit(t, { mult: s.dmg, ranged: true, status: [{ id: 'slow', dur: 1 }], noTraits: true });
      } });
  }

  s_ar_hawk(s) {
    this.p.statuses.apply('hawkeye', { dur: s.duration });
    this.fx.column(this.p.x, this.p.ry, this.p.z, '#ffe066', 18);
    this.g.overlay.text(this.p.x, this.p.ry + 2.4, this.p.z, 'Hawk Eye', 'status');
  }
}
