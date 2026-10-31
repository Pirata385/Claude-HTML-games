// Visual effects: voxel particles, ground telegraphs, slash arcs, beams and area markers.
// Everything is pooled; nothing allocates per frame once warmed up.
import * as THREE from 'three';
import { boxesGeometry } from './voxel.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class FX {
  constructor(scene, quality) {
    this.scene = scene;
    this.mult = quality.particles;
    // Particles.
    this.cap = Math.round(700 * Math.max(0.3, this.mult));
    this.pGeo = boxesGeometry([[0, 0, 0, 1, 1, 1, '#ffffff']]);
    this.pMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    this.pMesh = new THREE.InstancedMesh(this.pGeo, this.pMat, this.cap);
    this.pMesh.frustumCulled = false;
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.cap; i++) { this.pMesh.setMatrixAt(i, ZERO); this.pMesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
    scene.add(this.pMesh);
    this.parts = new Float32Array(this.cap * 12); // x y z vx vy vz life max size grav r g b packed separately
    this.pcol = new Float32Array(this.cap * 3);
    this.alive = new Uint8Array(this.cap);
    this.cursor = 0;
    // Decals (telegraphs, zones) and slashes.
    this.decals = [];
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
    this.rectGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.arcGeos = new Map();
    this.lines = [];
  }

  // ------------------------------------------------------------- particles
  burst(x, y, z, n, o = {}) {
    n = Math.max(1, Math.round(n * this.mult));
    _c.set(o.color || '#ffffff');
    const speed = o.speed ?? 4, life = o.life ?? 0.6, size = o.size ?? 0.14, grav = o.gravity ?? 12, up = o.up ?? 2, spread = o.spread ?? 1;
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.cap;
      const b = i * 12;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.parts[b] = x + (Math.random() - 0.5) * 0.3 * spread; this.parts[b + 1] = y; this.parts[b + 2] = z + (Math.random() - 0.5) * 0.3 * spread;
      this.parts[b + 3] = Math.cos(a) * s * spread + (o.vx || 0); this.parts[b + 4] = up + Math.random() * up; this.parts[b + 5] = Math.sin(a) * s * spread + (o.vz || 0);
      this.parts[b + 6] = life * (0.6 + Math.random() * 0.4); this.parts[b + 7] = this.parts[b + 6]; this.parts[b + 8] = size * (0.6 + Math.random() * 0.8); this.parts[b + 9] = grav;
      const v = o.vary ?? 0.15;
      this.pcol[i * 3] = _c.r * (1 - v + Math.random() * v * 2); this.pcol[i * 3 + 1] = _c.g * (1 - v + Math.random() * v * 2); this.pcol[i * 3 + 2] = _c.b * (1 - v + Math.random() * v * 2);
      this.alive[i] = 1;
    }
  }
  // A short-lived rising column (level up, heals, spawns).
  column(x, y, z, color, n = 24, r = 0.8) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.burst(x + Math.cos(a) * r, y + Math.random() * 0.4, z + Math.sin(a) * r, 1, { color, speed: 0.3, up: 3, gravity: -2, life: 1.0, size: 0.12 });
    }
  }

  // ------------------------------------------------------------- decals
  // shape: 'circle' | 'ring' | 'line'. Telegraphs fill up over `t` seconds then vanish.
  decal(o) {
    let d = this.decals.find((x) => !x.active && x.shape === o.shape);
    if (!d) {
      const geo = o.shape === 'line' ? this.rectGeo : o.shape === 'ring' ? this.ringGeo : this.discGeo;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const outer = new THREE.Mesh(geo, mat);
      const innerMat = mat.clone();
      const inner = new THREE.Mesh(geo, innerMat);
      outer.add(inner);
      outer.renderOrder = 3;
      this.scene.add(outer);
      d = { shape: o.shape, mesh: outer, inner, mat, innerMat };
      this.decals.push(d);
    }
    Object.assign(d, { active: true, t: 0, dur: o.t ?? 1, fill: o.fill !== false, persist: !!o.persist, follow: o.follow || null, pulse: !!o.pulse, alpha: o.alpha ?? 0.5 });
    d.mat.color.set(o.color || '#ff4a3a');
    d.innerMat.color.set(o.color || '#ff4a3a');
    d.mesh.visible = true;
    d.mesh.position.set(o.x, (o.y ?? 0) + 0.06, o.z);
    if (o.shape === 'line') { d.mesh.scale.set(o.width, 1, o.len); d.mesh.rotation.y = Math.atan2(o.dx, o.dz); }
    else { d.mesh.scale.set(o.r, 1, o.r); d.mesh.rotation.y = 0; }
    d.inner.scale.set(d.fill ? 0.001 : 1, 1, d.fill ? 0.001 : 1);
    d.inner.visible = o.shape !== 'ring';
    return d;
  }
  telegraph(o) { return this.decal({ ...o, fill: true }); }
  release(d) { if (d) { d.active = false; d.mesh.visible = false; } }

  // ------------------------------------------------------------- slashes and beams
  slash(x, y, z, yaw, range, arcDeg, color = '#ffffff', life = 0.16) {
    const key = Math.round(arcDeg);
    if (!this.arcGeos.has(key)) {
      const a = (arcDeg * Math.PI) / 180;
      // The arc is centred on +Y in its own plane; laid flat it must point to +Z, the way a yaw of 0 faces.
      const g = new THREE.RingGeometry(0.55, 1, 24, 1, Math.PI / 2 - a / 2, a).rotateX(Math.PI / 2);
      this.arcGeos.set(key, g);
    }
    const d = this.decal({ shape: 'circle', x, z, y, r: range, t: life, fill: false, color, alpha: 0.85 });
    d.mesh.geometry = this.arcGeos.get(key);
    d.inner.visible = false;
    d.mesh.rotation.y = yaw;
    d.slash = true;
    return d;
  }
  beam(ax, ay, az, bx, by, bz, color = '#ffe066', life = 0.18) {
    let l = this.lines.find((x) => !x.active);
    if (!l) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      l = { line: new THREE.Line(g, m), g, m };
      l.line.frustumCulled = false;
      this.scene.add(l.line);
      this.lines.push(l);
    }
    const pos = l.g.attributes.position.array;
    pos[0] = ax; pos[1] = ay; pos[2] = az; pos[3] = bx; pos[4] = by; pos[5] = bz;
    l.g.attributes.position.needsUpdate = true;
    l.m.color.set(color);
    Object.assign(l, { active: true, t: life, life });
    l.line.visible = true;
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) continue;
      const b = i * 12;
      this.parts[b + 6] -= dt;
      if (this.parts[b + 6] <= 0) { this.alive[i] = 0; this.pMesh.setMatrixAt(i, ZERO); any = true; continue; }
      this.parts[b + 4] -= this.parts[b + 9] * dt;
      this.parts[b] += this.parts[b + 3] * dt; this.parts[b + 1] += this.parts[b + 4] * dt; this.parts[b + 2] += this.parts[b + 5] * dt;
      const k = this.parts[b + 6] / this.parts[b + 7];
      const s = this.parts[b + 8] * (0.3 + 0.7 * k);
      _m.compose(_p.set(this.parts[b], this.parts[b + 1], this.parts[b + 2]), _q.setFromEuler(_e.set(k * 3, k * 2, 0)), _s.set(s, s, s));
      this.pMesh.setMatrixAt(i, _m);
      this.pMesh.setColorAt(i, _c.setRGB(this.pcol[i * 3], this.pcol[i * 3 + 1], this.pcol[i * 3 + 2]));
      any = true;
    }
    if (any) { this.pMesh.instanceMatrix.needsUpdate = true; this.pMesh.instanceColor.needsUpdate = true; }
    for (const d of this.decals) {
      if (!d.active) continue;
      d.t += dt;
      if (d.follow) d.mesh.position.set(d.follow.x, d.follow.ry + 0.06, d.follow.z);
      const k = Math.min(1, d.t / d.dur);
      if (d.fill) d.inner.scale.set(Math.max(0.001, k), 1, Math.max(0.001, k));
      const fade = d.slash ? 1 - k : d.persist ? 1 : 1;
      const pulse = d.pulse ? 0.75 + Math.sin(d.t * 6) * 0.25 : 1;
      d.mat.opacity = d.alpha * (d.fill ? 0.35 : 1) * fade * pulse;
      d.innerMat.opacity = d.alpha * 0.7 * pulse;
      if (!d.persist && d.t >= d.dur) {
        this.release(d);
        if (d.slash) { d.slash = false; d.mesh.geometry = this.discGeo; }
      }
    }
    for (const l of this.lines) {
      if (!l.active) continue;
      l.t -= dt;
      l.m.opacity = Math.max(0, l.t / l.life);
      if (l.t <= 0) { l.active = false; l.line.visible = false; }
    }
  }

  clear() {
    this.alive.fill(0);
    for (let i = 0; i < this.cap; i++) this.pMesh.setMatrixAt(i, ZERO);
    this.pMesh.instanceMatrix.needsUpdate = true;
    for (const d of this.decals) this.release(d);
    for (const l of this.lines) { l.active = false; l.line.visible = false; }
  }

  dispose() {
    this.scene.remove(this.pMesh); this.pMesh.dispose(); this.pGeo.dispose(); this.pMat.dispose();
    for (const d of this.decals) { this.scene.remove(d.mesh); d.mat.dispose(); d.innerMat.dispose(); }
    for (const l of this.lines) { this.scene.remove(l.line); l.g.dispose(); l.m.dispose(); }
    this.ringGeo.dispose(); this.discGeo.dispose(); this.rectGeo.dispose();
    for (const g of this.arcGeos.values()) g.dispose();
  }
}
