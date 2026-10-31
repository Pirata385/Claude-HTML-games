// The Stardust's Astral: a constellation spirit, a stand that fights within a leash of its bearer,
// can orbit as a guard or be posted as a sentinel. It breaks after a number of blows (more with
// Spirituality, up to 20), whatever their strength; ground hazards pass through it. A share of each
// wound echoes to the bearer.
import { Entity } from './entity.js';
import { buildAstral } from '../render/models.js';
import { angleDiff } from '../core/math.js';

export class Astral extends Entity {
  constructor(game) {
    super({ team: 'player', radius: 0.5, height: 2.2, scale: 1 });
    this.g = game;
    this.manifested = false;
    this.hp = 0; // filled on its first manifestation
    this.lockT = 0;
    this.target = null; this.commandT = 0;
    this.strikeT = 0; this.combo = 0;
    this.orbitT = 0; this.orbitAng = 0;
    this.post = null; this.postT = 0;
    this.dive = null;
    this.vis = buildAstral(game.profile.seed);
    this.vis.group.visible = false;
    game.r.scene.add(this.vis.group);
    this.def = { name: 'Astral' };
  }
  get leash() { return this.post ? 8 : this.g.stats.leash; }
  get anchor() { return this.post || this.g.player; }

  manifest(on) {
    if (on === this.manifested) return;
    if (on && this.lockT > 0) return;
    this.manifested = on;
    this.alive = on;
    if (on) {
      // Its health is counted in blows.
      this.maxHp = this.g.stats.astralHits;
      if (this.hp <= 0 || this.hp > this.maxHp) this.hp = this.maxHp;
      const p = this.g.player;
      this.x = p.x - Math.sin(p.yaw) * 1.2; this.z = p.z - Math.cos(p.yaw) * 1.2; this.ry = p.ry + 0.4;
      this.g.fx.column(this.x, p.ry, this.z, '#' + this.vis.color.getHexString(), 22);
      this.g.bus.emit('sfx', { id: 'manifest' });
    } else { this.post = null; this.orbitT = 0; this.dive = null; this.g.fx.burst(this.x, this.ry + 1, this.z, 16, { color: '#' + this.vis.color.getHexString(), speed: 3 }); }
    this.vis.group.visible = on;
  }

  get hitsLeft() { return this.manifested ? this.hp : 0; }

  takeDamage(amount, source, opts = {}) {
    if (!this.manifested) return 'none';
    // Puddles, vents and falling rock pass through it: only blows and skills count.
    if (opts.type === 'hazard') return 'none';
    const def = this.post ? 1.3 : 1;
    const dmg = Math.round(amount / def * (100 / (100 + this.g.stats.def)));
    this.hp -= 1;
    this.flash = 1;
    this.g.overlay.text(this.x, this.ry + 2.2, this.z, this.hp > 0 ? `◆ ${this.hp}` : '◆ 0', 'hurt');
    // A share of the wound echoes back to the bearer.
    const echo = dmg * 0.3;
    if (echo >= 1) { const p = this.g.player; p.hp = Math.max(1, p.hp - echo); p.flash = 0.6; }
    if (this.hp <= 0) {
      this.g.overlay.text(this.x, this.ry + 2.6, this.z, 'Astral broken!', 'hurt');
      this.manifest(false);
      this.lockT = 6;
      this.g.player.res = 0;
      this.g.bus.emit('sfx', { id: 'break' });
    }
    return 'hit';
  }

  command(target) { this.target = target; this.commandT = 1.2; }

  update(dt) {
    const g = this.g, p = g.player;
    this.lockT = Math.max(0, this.lockT - dt);
    if (!this.manifested) return;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.commandT -= dt; this.strikeT -= dt; this.orbitT -= dt;
    if (this.postT > 0) { this.postT -= dt; if (this.postT <= 0) this.post = null; }
    const spi = g.stats.spiPower;
    let gx, gz, speed = 11;
    if (this.dive) {
      // Comet Dive: a straight line, hitting all it passes.
      const d = this.dive;
      const step = Math.min(d.left, 30 * dt);
      this.x += d.dx * step; this.z += d.dz * step; d.left -= step;
      for (const e of g.combat.circle(this.x, this.z, 1.2, 'player')) if (!d.hit.has(e)) { d.hit.add(e); g.combat.hit(e, { mult: d.mult, src: 'astral', knock: 1.2, from: this }); }
      g.fx.burst(this.x, this.ry + 1, this.z, 2, { color: '#' + this.vis.color.getHexString(), speed: 1, life: 0.4 });
      if (d.left <= 0) this.dive = null;
      this.render(dt);
      return;
    }
    if (this.orbitT > 0) {
      this.orbitAng += dt * 5;
      gx = p.x + Math.cos(this.orbitAng) * 1.8; gz = p.z + Math.sin(this.orbitAng) * 1.8; speed = 40;
      this.strikeT -= 0;
      if (this.strikeT <= 0) { this.strikeT = 0.5; for (const e of g.combat.circle(this.x, this.z, 1.3, 'player')) g.combat.hit(e, { mult: 0.4, src: 'astral', noTraits: true, from: this }); }
    } else {
      const anchor = this.anchor;
      // Pick a target: the commanded one, else the nearest foe within the leash.
      if (!this.target?.alive || this.target.dist2(anchor) > (this.leash + 2) ** 2) this.target = null;
      if (!this.target) this.target = g.combat.nearest(anchor.x, anchor.z, this.leash, 'player');
      if (this.target) {
        const t = this.target;
        const a = Math.atan2(this.x - t.x, this.z - t.z);
        gx = t.x + Math.sin(a) * (t.radius + 0.9); gz = t.z + Math.cos(a) * (t.radius + 0.9);
        const near = Math.hypot(this.x - gx, this.z - gz) < 1.0;
        if (near && this.strikeT <= 0) {
          const commanded = this.commandT > 0;
          const mults = g.player.kit.basic.astralDmg;
          const mult = commanded ? mults[this.combo] : 0.55;
          g.combat.hit(t, { mult, src: 'astral', knock: this.combo === 2 ? 0.8 : 0.1, from: this });
          g.fx.slash(this.x, this.ry + 1, this.z, Math.atan2(t.x - this.x, t.z - this.z), 1.9, 120, '#' + this.vis.color.getHexString(), 0.12);
          g.bus.emit('sfx', { id: 'astralHit' });
          // A fist flies: left, right, left.
          this.punch = 1; this.punchArm = this.combo % 2;
          this.combo = (this.combo + 1) % 3;
          this.strikeT = commanded ? 0.26 / g.stats.attackSpeed : 0.85;
        }
      } else if (this.post) { gx = this.post.x; gz = this.post.z; }
      else { gx = p.x - Math.sin(p.yaw) * 1.1 + Math.cos(p.yaw) * 0.9; gz = p.z - Math.cos(p.yaw) * 1.1 - Math.sin(p.yaw) * 0.9; speed = 9; }
    }
    const dx = gx - this.x, dz = gz - this.z, l = Math.hypot(dx, dz);
    if (l > 0.05) { const s = Math.min(l, speed * dt); this.x += (dx / l) * s; this.z += (dz / l) * s; }
    if (l > 0.3) this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
    else if (this.target) this.yaw += angleDiff(this.yaw, Math.atan2(this.target.x - this.x, this.target.z - this.z)) * Math.min(1, dt * 10);
    // Leash: never drift too far from the bearer (or the post).
    const an = this.anchor, ad = Math.hypot(this.x - an.x, this.z - an.z);
    if (ad > this.leash + 3) { this.x = an.x + ((this.x - an.x) / ad) * (this.leash + 3); this.z = an.z + ((this.z - an.z) / ad) * (this.leash + 3); }
    this.render(dt);
    void spi;
  }

  render(dt = 1 / 60) {
    const g = this.g;
    const gh = g.grid.height(Math.floor(this.x), Math.floor(this.z));
    this.ry += (gh + 0.35 + Math.sin(g.time * 2.4) * 0.12 - this.ry) * 0.2;
    this.vis.group.position.set(this.x, this.ry, this.z);
    this.vis.group.rotation.y = this.yaw;
    // Arms: a guard pose at rest, the striking fist thrown forward.
    this.punch = Math.max(0, (this.punch || 0) - dt * 7);
    const rest = -0.35 + Math.sin(g.time * 2.4) * 0.05, thrust = -1.55 * Math.sin(Math.min(1, this.punch) * Math.PI * 0.5);
    this.vis.armL.rotation.x = rest + (this.punchArm === 0 ? thrust : 0);
    this.vis.armR.rotation.x = rest + (this.punchArm === 1 ? thrust : 0);
    const s = 1 + this.flash * 0.15;
    this.vis.group.scale.set(s, s, s);
  }

  dispose() { this.vis.dispose(); }
}
