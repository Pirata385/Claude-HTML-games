import { StatusSet } from '../combat/statusRuntime.js';

let nextId = 1;
export class Entity {
  constructor(o) {
    this.id = nextId++;
    this.team = 'enemy';
    this.x = 0; this.y = 0; this.z = 0; this.ry = 0;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.yaw = 0;
    this.radius = 0.4;
    this.hp = 1; this.maxHp = 1; this.level = 1;
    this.alive = true;
    this.flash = 0;
    this.kbx = 0; this.kbz = 0; this.kbt = 0;
    this.shield = 0;
    this.statuses = new StatusSet();
    this.height = 1.8;
    Object.assign(this, o);
  }
  dist2(o) { const dx = this.x - o.x, dz = this.z - o.z; return dx * dx + dz * dz; }
  knock(dx, dz, power) {
    const l = Math.hypot(dx, dz) || 1;
    this.kbx = (dx / l) * power; this.kbz = (dz / l) * power; this.kbt = 0.18;
  }
}
