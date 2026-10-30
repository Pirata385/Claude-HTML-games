// "You?": the one in the glass. It fights the way your class fights: close and quick for the
// Swordsman and Assassin, from a distance for the Archer, Mage and Stardust. Then it splits in two
// (only the real one casts a shadow), and at the end it casts your last skill back at you.
import { Boss } from './base.js';
import { buildMirrorRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';
import { SKILLS } from '../../data/skills.js';
import { equippedIn } from '../../systems/equipment.js';

const RANGED = new Set(['archer', 'mage', 'stardust']);

export class MirrorSelf extends Boss {
  constructor(game, level, arena, opts = {}) {
    const p = game.profile;
    const w = equippedIn(p, 'weapon'), a = equippedIn(p, 'armor');
    super(game, BOSSES.you, level, arena, buildMirrorRig(p.classId, w?.material, a?.material), opts.group);
    this.radius = 0.4; this.height = 1.9; this.scale = 1.15;
    this.speed = 5.2;
    this.ranged = RANGED.has(p.classId);
    this.decoy = !!opts.decoy;
    if (this.decoy) {
      this.maxHp = this.hp = Math.round(this.maxHp * 0.15);
      this.rig.root.traverse((o) => { o.castShadow = false; });
    }
    this.lastSkill = null;
    this.offSkill = this.decoy ? null : game.bus.on('skill', (e) => { this.lastSkill = e.id; });
  }

  onPhase(i) {
    const g = this.g;
    if (this.decoy) return;
    if (i === 1) {
      g.ui?.banner('Doubled', 'It splits in two. Only the real one casts a shadow.');
      const d = new MirrorSelf(g, this.level, this.arena, { decoy: true, group: this.group });
      d.x = this.x + 3; d.z = this.z; d.phase = this.phase;
      g.enemies.addBoss(d);
    }
    if (i === 2) g.ui?.banner('Mimicry', 'It casts the last skill you used, back at you.');
  }
  dispose() { this.offSkill?.(); super.dispose(); }
  onReset() { for (const m of this.group.members) if (m !== this && m.decoy) { m.alive = false; m.dyingT = 0; } }

  think(dt) {
    const g = this.g, p = g.player;
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz) || 1;
    this.face(p.x, p.z, dt, 10);
    // Movement: the ranged copy keeps its distance and strafes; the melee copy closes in.
    const want = this.ranged ? 8 : 1.8;
    if (dist > want + 1) { this.move(dx, dz, this.speed * dt); this.anim.move = 1; }
    else if (this.ranged && dist < want - 2) { this.move(-dx, -dz, this.speed * 0.8 * dt); this.anim.move = 1; }
    else { this.move(-dz, dx, this.speed * 0.5 * dt * (Math.sin(g.time) > 0 ? 1 : -1)); this.anim.move = 0.6; }
    this.anim.phase += this.speed * dt * 2;
    if (this.cd > 0) return;
    if (this.phase >= 2 && this.lastSkill && !this.decoy && Math.random() < 0.4) { this.mimic(); return; }
    if (this.ranged) {
      // Three shots, the way you would.
      this.cd = 1.3;
      this.play('cast', 0.4);
      for (const off of [-0.12, 0, 0.12]) {
        const a = Math.atan2(dx, dz) + off;
        g.combat.shoot({ x: this.x, y: this.ry + 1.3, z: this.z, dx: Math.sin(a), dy: 0, dz: Math.cos(a), speed: 20, team: 'enemy', kind: g.profile.classId === 'archer' ? 'arrow' : 'bolt', radius: 0.35, life: 1.6,
          onHit: (t) => g.combat.hurt(t, this.dmg * (this.decoy ? 0.2 : 0.45), this, { type: 'ranged' }) });
      }
      g.bus.emit('sfx', { id: 'enemyShoot', x: this.x, z: this.z });
    } else {
      // A three-hit combo with a short tell, then a backstep.
      this.cd = 1.6;
      g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 2.8, 120, '#cfe8ff', 0.3);
      for (let k = 0; k < 3; k++) g.combat.after(0.3 + k * 0.25, () => {
        if (!this.alive) return;
        this.play(k % 2 ? 'slash2' : 'slash', 0.2);
        for (const t of g.combat.arc(this.x, this.z, this.yaw, 2.8, 120, 'enemy')) g.combat.hurt(t, this.dmg * (this.decoy ? 0.15 : 0.4), this, { type: 'melee', knock: 3 });
      });
    }
  }

  // Mimicry: your last skill, as the glass remembers it — a burst where you stand.
  mimic() {
    const g = this.g, p = g.player, s = SKILLS[this.lastSkill];
    this.cd = 2.2;
    this.play('cast', 0.8);
    g.overlay.text(this.x, this.ry + 3, this.z, `${s?.name || 'Your skill'}?`, 'status');
    const x = p.x, z = p.z;
    g.fx.telegraph({ shape: 'circle', x, z, y: p.ry, r: 3.2, t: 1.0, color: '#cfe8ff' });
    g.combat.after(1.0, () => {
      if (!this.alive) return;
      g.fx.burst(x, p.ry + 0.6, z, 30, { color: '#cfe8ff', speed: 7, up: 4 });
      for (const t of g.combat.circle(x, z, 3.2, 'enemy')) g.combat.hurt(t, this.dmg * 1.2, this, { type: 'aoe', knock: 6 });
    });
  }
}
