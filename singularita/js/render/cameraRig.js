// Third-person orbit camera: mouse/touch look, zoom, lock-on, collision with terrain and walls, shake.
import * as THREE from 'three';
import { clamp, damp, angleDiff } from '../core/math.js';
import { F } from '../world/grid.js';

const _pivot = new THREE.Vector3(), _want = new THREE.Vector3(), _look = new THREE.Vector3();

export class CameraRig {
  constructor(camera, settings) {
    this.camera = camera;
    this.settings = settings;
    this.yaw = Math.PI; this.pitch = 0.42;
    this.dist = settings.camera.distance; this.zoomTarget = this.dist;
    this.shakeAmt = 0;
    this.aim = 0;
    this.baseFov = camera.fov;
    this.cur = new THREE.Vector3();
    this.first = true;
  }
  get forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }
  get right() { return { x: -Math.cos(this.yaw), z: Math.sin(this.yaw) }; }
  shake(a) { if (this.settings.camera.shake) this.shakeAmt = Math.min(1, this.shakeAmt + a); }
  snapBehind(yaw) { this.yaw = yaw; this.first = true; }

  update(dt, player, input, grid, lockTarget, aiming, touchLook, high = false) {
    const cs = this.settings.camera;
    const k = 0.0024;
    this.yaw -= input.look.dx * k * cs.sensX * (touchLook ? 1.6 : 1);
    this.pitch += input.look.dy * k * cs.sensY * (cs.invertY ? -1 : 1) * (touchLook ? 1.6 : 1);
    this.pitch = clamp(this.pitch, -0.3, 1.25);
    if (input.zoom) this.zoomTarget = clamp(this.zoomTarget + input.zoom * 0.8, 3, 12);
    if (lockTarget) {
      const want = Math.atan2(lockTarget.x - player.x, lockTarget.z - player.z);
      this.yaw += angleDiff(this.yaw, want) * Math.min(1, dt * 6);
      this.pitch += (0.32 - this.pitch) * Math.min(1, dt * 2);
    }
    this.aim = damp(this.aim, aiming ? 1 : 0, 10, dt);
    this.dist = damp(this.dist, this.zoomTarget * (1 - this.aim * 0.45), 8, dt);

    // In caves the pivot rides above the 3-block walls, so the view looks down into the passages.
    _pivot.set(player.x, player.ry + (high ? 3.4 : 1.55), player.z);
    const f = this.forward, r = this.right;
    const shoulder = 0.55 * this.aim;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    _want.set(_pivot.x - f.x * this.dist * cp + r.x * shoulder, _pivot.y + this.dist * sp, _pivot.z - f.z * this.dist * cp + r.z * shoulder);

    // Pull in when terrain or rock is between the player and the camera.
    let t = 1;
    const steps = Math.ceil(this.dist / 0.25);
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const x = _pivot.x + (_want.x - _pivot.x) * u, y = _pivot.y + (_want.y - _pivot.y) * u, z = _pivot.z + (_want.z - _pivot.z) * u;
      const i = Math.floor(x), j = Math.floor(z);
      // Trees and rocks stand on obstacle cells: treat them as tall so the camera never ends up inside one.
      if (!grid.inside(i, j) || grid.top(i, j) + (grid.has(i, j, F.OBSTACLE) ? 4.2 : 0) > y - 0.3) { t = Math.max(0.12, (s - 1) / steps); break; }
    }
    _want.lerpVectors(_pivot, _want, t);
    if (this.first) { this.cur.copy(_want); this.first = false; }
    else this.cur.lerp(_want, 1 - Math.exp(-dt * 18));
    this.camera.position.copy(this.cur);
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * this.shakeAmt * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s; this.camera.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    }
    _look.set(_pivot.x + f.x * 2 + r.x * shoulder, high ? player.ry + 1.2 : _pivot.y + 0.1, _pivot.z + f.z * 2 + r.z * shoulder);
    this.camera.lookAt(_look);
    const fov = this.baseFov * (1 - this.aim * 0.18);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
}
