// The rules that make each dimension its own: twin-bound creatures, adamite corruption,
// the Reflection and its plates, dragon breath and nests. (Keys and levers live in interact.js.)
import * as THREE from 'three';
import { F } from './grid.js';
import { moveCircle } from './physics.js';
import { enemyDmg } from '../systems/scaling.js';
import { buildPlayerRig } from '../render/models.js';
import { animate } from '../render/rigs.js';
import { equippedIn } from '../systems/equipment.js';

const TWIN_WINDOW = 3;
const glass = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.5, color: 0xcfefff });

export class DimensionRules {
  constructor(game) {
    this.g = game;
    this.twins = new WeakMap();
    this.pending = [];
    game.bus.on('spawned', ({ enemy }) => this.onSpawn(enemy));
    game.bus.on('kill', ({ enemy }) => this.onKill(enemy));
    game.bus.on('gathered', (e) => this.onGathered(e));
  }

  get rule() { return this.g.zone.type === 'dimension' ? this.g.zoneDef.rule : null; }
  twinOf(e) { return this.twins.get(e) || null; }
  dmg(base) { return enemyDmg(base, this.g.zoneDef.band[0]); }

  onZoneEnter() {
    const g = this.g;
    this.pending = [];
    g.player.corruption = 0;
    this.breathT = 6;
    this.nests = (g.zone.nests || []).map((n) => ({ ...n, t: 0, hatched: false }));
    this.clearReflection();
    if (this.rule === 'reflection') this.makeReflection();
  }
  onZoneExit() { this.clearReflection(); this.pending = []; }

  update(dt) {
    const g = this.g, rule = this.rule;
    if (!rule || !g.player.alive) return;
    if (rule === 'twins') this.updateTwins(dt);
    if (rule === 'corruption') this.updateCorruption(dt);
    if (rule === 'reflection') this.updateReflection(dt);
    if (rule === 'breath') this.updateBreath(dt);
  }
  render(dt) { if (this.reflection) this.renderReflection(dt); }

  // ------------------------------------------------------------------ The Twin Slimes
  // Twin-bound creatures arrive in pairs. A lone kill revives after a moment, unless the twin falls too.
  onSpawn(e) {
    if (!e.def.twin || this.twins.has(e) || this.spawningTwin || this.rule !== 'twins') return;
    this.spawningTwin = true;
    const t = this.g.enemies.spawn(e.def.id, e.x + 1.4, e.z + 0.6, { level: e.level, noIntro: e.spawnT <= 0 });
    this.spawningTwin = false;
    if (t) { this.twins.set(e, t); this.twins.set(t, e); }
  }
  onKill(e) {
    const twin = this.twins.get(e);
    if (!twin || this.rule !== 'twins') return;
    if (twin.alive) {
      this.pending.push({ dead: e, twin, t: TWIN_WINDOW });
      this.g.overlay.text(twin.x, twin.ry + 2.2, twin.z, 'Its twin calls it back…', 'status');
    } else this.pending = this.pending.filter((p) => p.dead !== twin);
  }
  updateTwins(dt) {
    const g = this.g;
    for (const p of [...this.pending]) {
      p.t -= dt;
      if (!p.twin.alive) { this.pending.splice(this.pending.indexOf(p), 1); continue; }
      if (p.t > 0) continue;
      this.pending.splice(this.pending.indexOf(p), 1);
      this.spawningTwin = true;
      const back = g.enemies.spawn(p.dead.def.id, p.twin.x + 1.2, p.twin.z, { level: p.dead.level, noIntro: true });
      this.spawningTwin = false;
      if (!back) continue;
      back.hp = back.maxHp * 0.6;
      this.twins.set(back, p.twin); this.twins.set(p.twin, back);
      g.fx.burst(back.x, back.ry + 0.6, back.z, 16, { color: back.def.color, speed: 4 });
      g.ui?.toast('The twin revived! Bring both down within three seconds.', 'warn');
    }
  }

  // ------------------------------------------------------------------ The Corrupted King
  updateCorruption(dt) {
    const g = this.g, p = g.player, z = g.zone;
    const i = Math.floor(p.x), j = Math.floor(p.z);
    const near = (z.braziers || []).some((b) => Math.hypot(b.x - p.x, b.z - p.z) < b.r);
    if (near) p.corruption = Math.max(0, p.corruption - 45 * dt);
    else if (g.grid.has(i, j, F.CORRUPT)) p.corruption = Math.min(100, p.corruption + 12 * dt);
    else p.corruption = Math.max(0, p.corruption - 2 * dt);
    if (p.corruption >= 100) {
      this.corruptT = (this.corruptT || 0) - dt;
      if (this.corruptT <= 0) {
        this.corruptT = 1;
        g.combat.hurt(p, g.stats.maxHp * 0.05, null, { type: 'hazard', status: [{ id: 'slow' }] });
        g.fx.burst(p.x, p.ry + 1, p.z, 8, { color: '#9a4ae0', speed: 2, up: 2 });
      }
    }
  }
  // Breaking adamite cleanses the ground around it.
  onGathered({ node, x, z }) {
    if (this.rule !== 'corruption' || node !== 'adamite_cluster') return;
    const g = this.g;
    for (let j = Math.floor(z - 3); j <= z + 3; j++) for (let i = Math.floor(x - 3); i <= x + 3; i++) if (g.grid.inside(i, j) && Math.hypot(i + 0.5 - x, j + 0.5 - z) <= 3) g.grid.clear(i, j, F.CORRUPT);
    g.player.corruption = Math.max(0, g.player.corruption - 30);
    g.ui?.toast('The adamite shatters and the ground around it clears.', 'good');
  }

  // ------------------------------------------------------------------ The Mirrored
  makeReflection() {
    const g = this.g, z = g.zone, p = g.profile;
    const w = equippedIn(p, 'weapon'), a = equippedIn(p, 'armor');
    const rig = buildPlayerRig(p.classId, w?.material, a?.material);
    rig.root.traverse((o) => { if (o.isMesh) { o.material = glass; o.userData.baseMat = glass; } });
    g.r.scene.add(rig.root);
    this.reflection = { rig, x: z.reflectionStart.x, z: z.reflectionStart.z, y: 0, radius: 0.36, anim: { t: 0, move: 0, phase: 0, atk: 0, wind: 0, air: false, style: 'slash' } };
  }
  clearReflection() { if (this.reflection) { this.reflection.rig.dispose(); this.reflection = null; } }
  updateReflection(dt) {
    const g = this.g, p = g.player, z = g.zone, rf = this.reflection;
    if (!rf) return;
    // It walks to where you are, in the mirror. Its own walls stop it; you have to lead it round.
    const tx = g.grid.w - p.x, tz = p.z;
    const dx = tx - rf.x, dz = tz - rf.z, d = Math.hypot(dx, dz);
    if (d > 0.05) {
      const step = Math.min(d, 7.5 * dt);
      moveCircle(g.grid, rf, (dx / d) * step, (dz / d) * step, rf.radius, 1.05);
      rf.anim.move = Math.min(1, d * 2); rf.anim.phase += step * 2.2;
    } else rf.anim.move = 0;
    rf.y = g.grid.height(Math.floor(rf.x), Math.floor(rf.z));
    // Both on mirrored plates: the gate between them opens.
    for (const pl of z.plates) {
      const gate = z.gates.find((gt) => gt.id === pl.gate);
      if (gate.open) continue;
      if (Math.hypot(p.x - pl.left.x, p.z - pl.left.z) < 0.9 && Math.hypot(rf.x - pl.right.x, rf.z - pl.right.z) < 0.9) {
        gate.open = true;
        for (const k of gate.cells) z.grid.flags[k] &= ~F.OBSTACLE;
        g.enemies.flow.valid = false;
        g.view.rebuildStructures?.();
        g.ui?.toast('You and your reflection agree. The glass gate opens.', 'good');
        g.bus.emit('sfx', { id: 'unlock' });
      }
    }
    // In the Hall of Mirrors it steps out of the glass to face you; the reflection here is gone.
    if (z.arena && Math.hypot(p.x - z.arena.x, p.z - z.arena.z) < z.arena.r) this.clearReflection();
  }
  renderReflection(dt) {
    const rf = this.reflection, p = this.g.player;
    const a = rf.anim;
    a.t += dt; a.air = !p.grounded; a.atk = p.anim.atk; a.style = p.anim.style;
    animate(rf.rig.rig, a, rf.rig.pose);
    rf.rig.applyPose();
    rf.rig.root.position.set(rf.x, rf.y, rf.z);
    rf.rig.root.rotation.y = -p.yaw;
  }

  // ------------------------------------------------------------------ The Dragons' Roost
  updateBreath(dt) {
    const g = this.g, p = g.player;
    this.breathT -= dt;
    if (this.breathT <= 0 && !p.carried) {
      this.breathT = g.rng.range(9, 13);
      const a = g.rng.next() * Math.PI * 2;
      this.breathAt(p.x + Math.cos(a) * 14, p.z + Math.sin(a) * 14);
    }
    // Lingering by a nest hatches its eggs.
    for (const n of this.nests) {
      if (n.hatched) continue;
      if (Math.hypot(p.x - n.x, p.z - n.z) < 6) n.t += dt; else n.t = Math.max(0, n.t - dt);
      if (n.t > 4) {
        n.hatched = true;
        g.ui?.toast('The eggs crack open!', 'warn');
        for (let k = 0; k < 2; k++) g.enemies.spawn('dragon_whelp', n.x + (k ? 1.5 : -1.5), n.z, { level: g.spawner.caveLevel(), summoned: true });
      }
    }
  }
  // A line of fire from (ox, oz) through the player's position. Rocks in the way shelter you.
  breathAt(ox, oz) {
    const g = this.g, p = g.player;
    const tx = p.x, tz = p.z, dx = tx - ox, dz = tz - oz, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
    const len = l + 12;
    g.fx.telegraph({ shape: 'line', x: ox, z: oz, y: p.ry, dx: ux, dz: uz, len, width: 4, t: 1.6, color: '#ff6a1a' });
    g.ui?.banner('Dragon breath!', 'Get behind a standing rock.');
    g.combat.after(1.6, () => {
      for (let d = 0; d < len; d += 2) g.fx.burst(ox + ux * d, p.ry + 1, oz + uz * d, 3, { color: d % 4 ? '#ff8a3d' : '#ffd166', speed: 3, up: 2, life: 0.6 });
      g.bus.emit('sfx', { id: 'roar' });
      for (const t of g.combat.line(ox, oz, ux, uz, len, 4, 'enemy')) {
        if (this.sheltered(ox, oz, t.x, t.z)) continue;
        g.combat.hurt(t, this.dmg(28), null, { type: 'hazard', status: [{ id: 'burn' }] });
      }
    });
  }
  sheltered(ox, oz, x, z) {
    const g = this.g, rocks = g.zone.rocks || [];
    const d = Math.hypot(x - ox, z - oz), n = Math.ceil(d / 0.4);
    for (let s = 1; s < n; s++) {
      const t = s / n, cx = ox + (x - ox) * t, cz = oz + (z - oz) * t;
      if (rocks.some((r) => cx >= r.x - 1.05 && cx <= r.x + 1.05 && cz >= r.z - 1.05 && cz <= r.z + 1.05)) return true;
    }
    return false;
  }
}
