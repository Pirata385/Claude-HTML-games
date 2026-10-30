// Allele of the Divine Golem: a living genome that expresses one allele at a time.
// Granite: armoured in front (strike its back), heavy slams. Quartz: swift three-hit combos.
// Moss: seedlings sprout and heal it until cut. Later it expresses two at once, then mutates fast.
import { Boss } from './base.js';
import { buildAlleleRig } from '../../render/models.js';
import { BOSSES } from '../../data/bosses.js';

const ALLELES = {
  granite: { name: 'Granite', color: 0x9a948a, desc: 'Armoured in front: strike its back.' },
  quartz: { name: 'Quartz', color: 0xffd8f0, desc: 'Swift combos: dodge them.' },
  moss: { name: 'Moss', color: 0x7ad04a, desc: 'Cut the seedlings before they heal it.' },
};
const ORDER = ['granite', 'quartz', 'moss'];

export class AlleleGolem extends Boss {
  constructor(game, level, arena) {
    super(game, BOSSES.allele_golem, level, arena, buildAlleleRig());
    this.radius = 1.4; this.height = 3.8; this.scale = 1;
    this.expressed = ['granite'];
    this.geneT = 10;
    this.express(['granite']);
  }

  onPhase(i) {
    const g = this.g;
    if (i === 1) g.ui?.banner('Codominance', 'Two alleles at once.');
    if (i === 2) g.ui?.banner('Mutation', 'The alleles cycle faster and faster.');
    this.geneT = 0.5;
  }
  onReset() { this.express(['granite']); this.geneT = 10; this.clearSeedlings(); }

  express(list) {
    this.expressed = list;
    const has = (k) => list.includes(k);
    this.def.frontArmor = has('granite') ? 0.7 : 0;
    this.speed = has('quartz') ? 4.6 : 2.4;
    const c = list.length > 1 ? (ALLELES[list[0]].color + ALLELES[list[1]].color) / 2 : ALLELES[list[0]].color;
    this.rig.crystal?.material.color.setHex(c);
    if (has('moss')) this.sprout();
  }

  // Up to three seedlings at a time: cutting them is always worth it.
  sprout() {
    const g = this.g;
    const alive = g.enemies.list.filter((e) => e.golem === this && e.alive).length;
    for (let k = alive; k < 3; k++) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (this.arena.r - 6);
      const x = this.arena.x + Math.cos(a) * r, z = this.arena.z + Math.sin(a) * r;
      if (!g.grid.walkable(Math.floor(x), Math.floor(z))) continue;
      const e = g.enemies.spawn('allele_seedling', Math.floor(x) + 0.5, Math.floor(z) + 0.5, { level: this.level, summoned: true });
      if (e) e.golem = this;
    }
  }
  clearSeedlings() { for (const e of this.g.enemies.list) if (e.golem === this && e.alive) { e.alive = false; e.dyingT = 0; } }

  think(dt) {
    const g = this.g, p = g.player;
    // Gene expression cycles: one allele, then two, then a fast mutation.
    this.geneT -= dt;
    if (this.geneT <= 0 && this.state === 'approach') {
      const pick = () => ORDER[Math.floor(Math.random() * 3)];
      let next = [pick()];
      if (this.phase >= 1) { let b = pick(); while (b === next[0]) b = pick(); next.push(b); }
      this.express(next);
      this.geneT = this.phase >= 2 ? 5 : 10;
      g.overlay.text(this.x, this.ry + 4.6, this.z, next.map((k) => ALLELES[k].name).join(' + '), 'status');
      if (!this.shown) { this.shown = true; g.ui?.toast(`${ALLELES[next[0]].name}: ${ALLELES[next[0]].desc}`, 'info', 5); }
    }
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    const quartz = this.expressed.includes('quartz');
    switch (this.state) {
      case 'idle':
      case 'approach': {
        this.state = 'approach';
        if (dist > 3.4) { this.move(dx, dz, this.speed * dt); this.anim.move = 1; this.anim.phase += this.speed * dt * 1.2; } else this.anim.move = 0;
        this.face(p.x, p.z, dt, quartz ? 8 : 4);
        if (this.cd <= 0 && dist < 4.5) { this.state = quartz ? 'combo' : 'slam'; this.t = 0; }
        else if (this.cd <= -2) { this.state = 'quake'; this.t = 0; }
        break;
      }
      case 'slam': {
        if (this.t === 0) {
          this.sx = this.x + Math.sin(this.yaw) * 2.6; this.sz = this.z + Math.cos(this.yaw) * 2.6;
          g.fx.telegraph({ shape: 'circle', x: this.sx, z: this.sz, y: this.ry, r: 3, t: 1.0, color: '#c8885a' });
          this.play('slam', 1.0);
        }
        this.t += dt;
        if (this.t >= 1.0) {
          g.fx.burst(this.sx, this.ry + 0.3, this.sz, 30, { color: '#9a8a7a', speed: 7, up: 4 });
          g.cam.shake(0.5); g.bus.emit('sfx', { id: 'boom' });
          this.hurtIn(this.sx, this.sz, 3, 1.4, { knock: 9 });
          this.state = 'approach'; this.cd = 2.2;
        }
        break;
      }
      case 'combo': {
        // Quartz: three quick swings, each with its own short tell.
        if (this.t === 0) this.hits = 0;
        this.t += dt;
        const at = 0.45 * (this.hits + 1);
        if (this.t >= at - 0.3 && !this.tell) { this.tell = true; g.fx.slash(this.x, this.ry + 0.1, this.z, this.yaw, 3.6, 120, '#ffd8f0', 0.3); }
        if (this.t >= at) {
          this.tell = false; this.hits++;
          this.play(this.hits % 2 ? 'slash' : 'slash2', 0.25);
          for (const t of g.combat.arc(this.x, this.z, this.yaw, 3.6, 120, 'enemy')) g.combat.hurt(t, this.dmg * 0.8, this, { type: 'melee', knock: 4 });
          this.face(p.x, p.z, 1, 10);
          if (this.hits >= 3) { this.state = 'approach'; this.cd = 1.6; }
        }
        break;
      }
      case 'quake': {
        // From range: a line of stone spikes runs at you.
        if (this.t === 0) {
          this.qdx = dx / (dist || 1); this.qdz = dz / (dist || 1);
          g.fx.telegraph({ shape: 'line', x: this.x, z: this.z, y: this.ry, dx: this.qdx, dz: this.qdz, len: 16, width: 2.2, t: 1.0, color: '#c8885a' });
          this.play('overhead', 1.0);
        }
        this.t += dt;
        if (this.t >= 1.0) {
          for (let d = 2; d <= 16; d += 2) g.fx.column(this.x + this.qdx * d, this.ry, this.z + this.qdz * d, '#9a6a4a', 6, 0.5);
          for (const t of g.combat.line(this.x, this.z, this.qdx, this.qdz, 16, 2.2, 'enemy')) g.combat.hurt(t, this.dmg * 1.1, this, { type: 'aoe', status: [{ id: 'stun', dur: 0.5 }] });
          g.bus.emit('sfx', { id: 'tremor' });
          this.state = 'approach'; this.cd = 1.8;
        }
        break;
      }
      default: this.state = 'approach';
    }
  }
}
