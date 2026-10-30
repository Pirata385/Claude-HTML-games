// The player: movement, jumping, dodging and animation. Combat comes from the class kit.
import { Entity } from './entity.js';
import { moveCircle, groundAt, unstick } from '../world/physics.js';
import { animate } from '../render/rigs.js';
import { F } from '../world/grid.js';
import { damp, angleDiff } from '../core/math.js';

const GRAVITY = 24, JUMP_V = 8.2, STEP = 1.05;

export class Player extends Entity {
  constructor(o) {
    super({ team: 'player', radius: 0.36, ...o });
    this.grounded = true;
    this.phase = 0;
    this.moveAmt = 0;
    this.dodgeT = 0; this.dodgeCd = 0; this.iframes = 0;
    this.dodgeX = 0; this.dodgeZ = 0;
    this.res = 0;
    this.combatT = 99; // seconds since last combat
    this.still = 0;
    this.rig = null;
    this.kit = null;
    this.anim = { t: 0, move: 0, phase: 0, atk: 0, wind: 0, air: false, style: 'slash', aim: false, guard: false };
  }

  setRig(rig, scene) {
    if (this.rig) this.rig.dispose();
    this.rig = rig;
    scene.add(rig.root);
  }

  update(dt, g) {
    if (!this.alive) return;
    if (this.carried) { this.combatT += dt; return; }
    const { input, cam, grid, stats } = g;
    if (unstick(grid, this)) { this.y = this.ry = groundAt(grid, this.x, this.z); this.grounded = true; }
    const st = this.statuses;
    this.combatT += dt;
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.flash = Math.max(0, this.flash - dt * 4);

    // Desired movement relative to the camera.
    const ax = g.inputBlocked ? { x: 0, y: 0 } : input.axes();
    const f = cam.forward, r = cam.right;
    let mx = f.x * ax.y + r.x * ax.x, mz = f.z * ax.y + r.z * ax.x;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const kitMult = this.kit?.moveMult ?? 1;
    const [ci, cj] = grid.cellAt(this.x, this.z);
    const wading = grid.has(ci, cj, F.WATER) ? 0.6 : 1;
    const speed = stats.moveSpeed * st.slowMult * kitMult * wading * (st.rooted ? 0 : 1);

    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      moveCircle(grid, this, this.dodgeX * 11 * dt, this.dodgeZ * 11 * dt, this.radius, STEP);
    } else {
      this.vx = damp(this.vx, mx * speed, 14, dt);
      this.vz = damp(this.vz, mz * speed, 14, dt);
      if (this.kbt > 0) { this.kbt -= dt; this.vx += this.kbx * dt * 8; this.vz += this.kbz * dt * 8; }
      moveCircle(grid, this, this.vx * dt, this.vz * dt, this.radius, this.grounded ? STEP : STEP + 0.2);
      if (ml > 0.1 && !this.kit?.facingLocked) this.yaw += angleDiff(this.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 14);
      if (this.kit?.faceYaw != null) this.yaw += angleDiff(this.yaw, this.kit.faceYaw) * Math.min(1, dt * 20);
    }

    // Dodge roll: short burst with invulnerability.
    if (!g.inputBlocked && input.wasPressed('dodge') && this.dodgeCd <= 0 && !st.rooted && this.grounded) {
      const dx = ml > 0.1 ? mx / Math.max(ml, 1e-6) : -f.x, dz = ml > 0.1 ? mz / Math.max(ml, 1e-6) : -f.z;
      const l = Math.hypot(dx, dz) || 1;
      this.dodgeX = dx / l; this.dodgeZ = dz / l;
      this.dodgeT = 0.32; this.iframes = 0.34; this.dodgeCd = stats.dodgeCd;
      this.yaw = Math.atan2(this.dodgeX, this.dodgeZ);
      g.bus.emit('dodge', { x: this.x, z: this.z });
    }

    // Vertical.
    const ground = groundAt(grid, this.x, this.z);
    if (this.grounded) {
      if (ground < this.y - 0.05) { this.grounded = false; this.vy = 0; }
      else this.y = ground;
      if (!g.inputBlocked && input.wasPressed('jump') && !st.rooted) { this.vy = JUMP_V; this.grounded = false; g.bus.emit('jump', {}); }
    }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) { this.y = ground; this.grounded = true; if (this.vy < -12) g.bus.emit('land', { hard: true }); this.vy = 0; }
    }
    this.ry = this.grounded ? damp(this.ry, this.y, 18, dt) : this.y;
    if (Math.abs(this.ry - this.y) > 2) this.ry = this.y;

    // Animation state.
    const hs = Math.hypot(this.vx, this.vz);
    this.moveAmt = damp(this.moveAmt, Math.min(1, hs / 4), 10, dt);
    this.phase += hs * dt * 2.2;
    this.still = hs < 0.2 ? this.still + dt : 0;
  }

  render(dt) {
    if (!this.rig) return;
    const a = this.anim;
    a.t += dt; a.move = this.moveAmt; a.phase = this.phase; a.air = !this.grounded;
    const k = this.kit?.animState;
    a.atk = k?.atk || 0; a.style = k?.style || 'slash'; a.aim = !!k?.aim; a.guard = !!k?.guard; a.wind = k?.wind || 0;
    animate(this.rig.rig, a, this.rig.pose);
    if (this.dodgeT > 0) { const p = this.rig.pose[0]; p.rx = 0.9; p.y = -0.35; }
    this.rig.applyPose();
    this.rig.root.position.set(this.x, this.ry, this.z);
    this.rig.root.rotation.y = this.yaw;
    this.rig.setFlash(this.flash);
    const veiled = this.statuses.has('invisible');
    this.rig.root.visible = !veiled || Math.sin(a.t * 30) > 0.6;
  }
}
