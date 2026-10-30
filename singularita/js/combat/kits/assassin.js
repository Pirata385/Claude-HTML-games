// Assassin: fast blades, backstabs, marks, vanishing and executions.
import { BaseKit, dirOf } from './base.js';
import { isBehind } from '../formulas.js';

export class AssassinKit extends BaseKit {
  constructor(g) { super(g, 'assassin'); this.combo = 0; this.comboT = 0; this.stabCd = 0; this.guaranteedBackstab = 0; }

  updateClass(dt, input) {
    this.stabCd -= dt; this.comboT -= dt; this.guaranteedBackstab -= dt;
    if (input.wasPressed('alt')) this.mark();
    if (input.isDown('attack') && this.stabCd <= 0) this.stab();
  }

  backstabMult(t) { return this.guaranteedBackstab > 0 || isBehind(t, this.p) ? this.basic.backstab : 0; }

  strike(t, mult, extra = {}) {
    const bs = this.backstabMult(t);
    if (bs) { this.g.overlay.text(t.x, t.ry + t.height * t.scale + 0.8, t.z, 'Backstab', 'status'); this.guaranteedBackstab = 0; }
    const venom = this.p.statuses.has('venom') ? [{ id: 'poison', stacks: 1 }] : [];
    return this.combat.hit(t, { mult, backstab: bs || undefined, status: [...venom, ...(extra.status || [])], knock: extra.knock ?? 0.1, pierceArmor: !!bs });
  }

  stab() {
    const s = this.basic;
    if (this.comboT <= 0) this.combo = 0;
    const yaw = this.aimYaw(s.range + 3);
    this.face(yaw);
    this.play('stab', 0.18 / this.stats.attackSpeed);
    const ts = this.combat.arc(this.p.x, this.p.z, yaw, s.range, s.arc, 'player');
    this.fx.slash(this.p.x, this.p.ry + 0.9, this.p.z, yaw, s.range, s.arc, '#ff9ab8', 0.12);
    for (const t of ts) this.strike(t, s.dmg[this.combo]);
    this.g.bus.emit('sfx', { id: ts.length ? 'stab' : 'swing' });
    this.combo = (this.combo + 1) % 3; this.comboT = 0.6;
    this.stabCd = (this.combo === 0 ? 0.32 : 0.19) / this.stats.attackSpeed;
  }

  mark() {
    const s = this.alt;
    if (this.cdLeft(s.id) > 0) return;
    const t = this.aimTarget(18);
    if (!t) { this.warn('No target to mark.'); return; }
    if (this.p.res < s.cost) { this.warn('Not enough Energy.'); return; }
    this.p.res -= s.cost; this.cd[s.id] = s.cd;
    this.combat.applyStatus(t, 'marked', { dur: s.duration });
    this.g.lockTarget = t;
    this.g.overlay.text(t.x, t.ry + t.height * t.scale + 1, t.z, 'Marked', 'status');
    this.g.bus.emit('sfx', { id: 'mark' });
  }

  s_as_shadowstep(s) {
    const t = this.aimTarget(s.range);
    if (!t) { this.warn('No target to step behind.'); return false; }
    this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 14, { color: '#3a2a5a', speed: 3 });
    const back = t.yaw + Math.PI, r = t.radius + 0.9;
    const tx = t.x + Math.sin(back) * r, tz = t.z + Math.cos(back) * r;
    const g = this.g.grid;
    if (g.walkable(Math.floor(tx), Math.floor(tz))) { this.p.x = tx; this.p.z = tz; }
    else { this.p.x = t.x - Math.sin(this.p.yaw) * r; this.p.z = t.z - Math.cos(this.p.yaw) * r; }
    this.face(Math.atan2(t.x - this.p.x, t.z - this.p.z));
    this.guaranteedBackstab = 1.5;
    this.p.iframes = Math.max(this.p.iframes, 0.2);
    this.g.lockTarget = t;
    this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 14, { color: '#3a2a5a', speed: 3 });
    this.g.bus.emit('sfx', { id: 'blink' });
  }

  s_as_smoke(s) {
    this.p.statuses.apply('invisible', { dur: s.duration });
    this.p.statuses.apply('empower', { dur: s.duration + 3 });
    this.fx.burst(this.p.x, this.p.ry + 0.8, this.p.z, 40, { color: '#8a8a9a', speed: 4, up: 1.5, gravity: -0.5, life: 1.4, size: 0.3 });
    this.g.bus.emit('sfx', { id: 'smoke' });
  }

  s_as_fan(s) {
    this.play('spin', 0.25);
    for (let k = 0; k < s.count; k++) {
      const yaw = (k / s.count) * Math.PI * 2, d = dirOf(yaw);
      this.combat.shoot({ x: this.p.x, y: this.p.ry + 1.1, z: this.p.z, dx: d.x, dz: d.z, speed: 22, team: 'player', kind: 'knife', life: 0.45, radius: 0.35,
        onHit: (e) => this.strike(e, s.dmg, { status: [{ id: 'bleed' }] }) });
    }
    this.g.bus.emit('sfx', { id: 'knives' });
  }

  s_as_venom(s) {
    this.p.statuses.apply('venom', { dur: s.duration });
    this.fx.column(this.p.x, this.p.ry, this.p.z, '#9be15d', 14, 0.5);
  }

  s_as_exec(s) {
    const t = this.aimTarget(s.range + 1.5);
    const yaw = t ? Math.atan2(t.x - this.p.x, t.z - this.p.z) : this.aimYaw(4);
    this.face(yaw); this.play('overhead', 0.25);
    const ts = this.combat.arc(this.p.x, this.p.z, yaw, s.range, 70, 'player');
    let killed = false;
    for (const e of ts) {
      const low = e.hp / e.maxHp < s.execute;
      const r = this.strike(e, s.dmg * (low ? 2.5 : 1), { knock: 0.5 });
      if (r && !e.alive) killed = true;
    }
    this.fx.slash(this.p.x, this.p.ry + 1, this.p.z, yaw, s.range, 70, '#ff3a5a', 0.2);
    if (killed) { this.cd[s.id] = s.cd * 0.5 * (1 - this.stats.cdr); this.g.overlay.text(this.p.x, this.p.ry + 2.4, this.p.z, 'Executed', 'status'); }
    this.g.bus.emit('sfx', { id: 'heavy' });
    return true;
  }

  s_as_dashcut(s) {
    const yaw = this.aimYaw(s.range + 2), d = dirOf(yaw);
    const x0 = this.p.x, z0 = this.p.z;
    this.face(yaw);
    const dist = this.dash(d.x, d.z, s.range, 0.35);
    this.play('slash', 0.2);
    for (const t of this.combat.line(x0, z0, d.x, d.z, dist + 0.5, 2.4, 'player')) this.strike(t, s.dmg, { status: [{ id: 'bleed' }] });
    this.fx.burst(this.p.x, this.p.ry + 1, this.p.z, 12, { color: '#ff9ab8', speed: 4 });
    this.g.bus.emit('sfx', { id: 'dash' });
  }
}
