// Amalgamations — visual effects with pooled objects: cube particles (one InstancedMesh), glowing orbs
// for projectiles (one InstancedMesh), ground decals for telegraphs and zones, beams, lightning and shields.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const R = AM.R || (AM.R = {});

  class FX {
    constructor(scene, opts) {
      this.scene = scene;
      this.cap = opts.particles || 600;
      this.mul = opts.particleMul || 1;
      const cube = new THREE.BoxGeometry(1, 1, 1);
      this.pm = new THREE.InstancedMesh(cube, new THREE.MeshBasicMaterial({ toneMapped: false }), this.cap);
      this.pm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
      this.pm.count = 0; this.pm.frustumCulled = false;
      this.pm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(this.pm);
      const N = this.cap;
      this.P = { x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), vz: new Float32Array(N), life: new Float32Array(N), max: new Float32Array(N), size: new Float32Array(N), grav: new Float32Array(N), r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N) };
      this.n = 0;
      // orbs
      this.ocap = 200;
      this.om = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), this.ocap);
      this.om.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.ocap * 3), 3);
      this.om.count = 0; this.om.frustumCulled = false;
      this.om.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(this.om);
      this.orbs = [];
      this.timed = [];
      // pools
      this.decals = []; this.beams = []; this.bubbles = [];
      this.geo = {
        circle: new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2),
        ring: new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2),
        rect: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
        box: new THREE.BoxGeometry(1, 1, 1),
        bubble: new THREE.IcosahedronGeometry(1, 0),
      };
      this.coneCache = new Map();
      this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
      this.ident = new THREE.Quaternion();
    }
    setMul(m) { this.mul = m; }

    // ---------- particles ----------
    spawn(x, y, z, vx, vy, vz, life, size, color, grav) {
      if (this.n >= this.cap) return;
      const i = this.n++, P = this.P;
      P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz;
      P.life[i] = life; P.max[i] = life; P.size[i] = size; P.grav[i] = grav == null ? 9 : grav;
      const c = R.lin(color); P.r[i] = c[0]; P.g[i] = c[1]; P.b[i] = c[2];
    }
    burst(x, y, z, color, n, speed, size, life, grav) {
      n = Math.max(1, Math.round(n * this.mul));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.1, s = (speed || 4) * (0.4 + Math.random() * 0.8);
        this.spawn(x, y, z, Math.cos(a) * s * (1 - e * 0.5), s * e, Math.sin(a) * s * (1 - e * 0.5), (life || 0.6) * (0.6 + Math.random() * 0.6), (size || 0.14) * (0.6 + Math.random() * 0.7), color, grav);
      }
    }
    ringBurst(x, z, radius, color, n, size) {
      n = Math.max(4, Math.round(n * this.mul));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        this.spawn(x + Math.cos(a) * radius * 0.3, 0.2, z + Math.sin(a) * radius * 0.3, Math.cos(a) * radius * 2.4, 1.5 + Math.random(), Math.sin(a) * radius * 2.4, 0.4, size || 0.18, color, 6);
      }
    }
    trail(x, y, z, color, size) { if (Math.random() < this.mul) this.spawn(x, y, z, (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 0.35, size || 0.12, color, 0); }

    // ---------- orbs (projectile visuals) ----------
    orb(color, size) {
      if (this.orbs.length >= this.ocap) return { set() {}, remove() {}, dead: true };
      const h = { i: this.orbs.length, x: 0, y: 0, z: 0, size: size || 0.35, rot: Math.random() * 6, spin: 6, fx: this, color };
      const c = R.lin(color);
      this.om.instanceColor.setXYZ(h.i, c[0], c[1], c[2]);
      this.om.instanceColor.needsUpdate = true;
      h.set = (x, y, z) => { h.x = x; h.y = y; h.z = z; };
      h.remove = () => {
        if (h.dead) return;
        h.dead = true;
        const last = this.orbs.pop();
        if (last !== h) {
          this.orbs[h.i] = last; last.i = h.i;
          const lc = R.lin(last.color); this.om.instanceColor.setXYZ(last.i, lc[0], lc[1], lc[2]); this.om.instanceColor.needsUpdate = true;
        }
      };
      this.orbs.push(h);
      return h;
    }

    // ---------- decals ----------
    _decalMesh(geo) {
      let d = this.decals.find((x) => !x.used && x.geo === geo);
      if (!d) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 2;
        d = { mesh, mat, geo, used: false };
        this.decals.push(d);
        this.scene.add(mesh);
      }
      d.used = true; d.mesh.visible = true; d.mesh.rotation.set(0, 0, 0); d.mesh.scale.set(1, 1, 1);
      return d;
    }
    coneGeo(angle) {
      const k = Math.round(angle * 20);
      if (!this.coneCache.has(k)) this.coneCache.set(k, new THREE.CircleGeometry(1, 20, Math.PI / 2 - (k / 20) / 2, k / 20).rotateX(-Math.PI / 2));
      return this.coneCache.get(k);
    }
    // kind: 'circle' | 'ring' | 'cone' | 'rect'. Returns a handle with set(x, z, yaw), progress(p), remove().
    decal(kind, x, z, size, color, opacity, opts) {
      opts = opts || {};
      const geo = kind === 'cone' ? this.coneGeo(opts.angle || 1) : this.geo[kind];
      const d = this._decalMesh(geo);
      d.mat.color.set(color); d.mat.opacity = opacity == null ? 0.3 : opacity;
      d.mesh.position.set(x, 0.05 + (opts.lift || 0), z);
      if (kind === 'rect') d.mesh.scale.set(opts.width || 1, 1, size);
      else d.mesh.scale.set(size, 1, size);
      d.mesh.rotation.y = opts.yaw || 0;
      const h = {
        d,
        set(nx, nz, yaw) { d.mesh.position.x = nx; d.mesh.position.z = nz; if (yaw != null) d.mesh.rotation.y = yaw; },
        opacity(o) { d.mat.opacity = o; },
        scale(s) { if (kind === 'rect') d.mesh.scale.z = s; else d.mesh.scale.set(s, 1, s); },
        remove() { d.used = false; d.mesh.visible = false; },
      };
      return h;
    }
    // A one-shot expanding ring.
    pulse(x, z, radius, color, life) {
      const h = this.decal('ring', x, z, 0.1, color, 0.8);
      this.timed.push({ t: 0, life: life || 0.35, fn: (k) => { h.scale(0.1 + radius * AM.smooth(k)); h.opacity(0.8 * (1 - k)); }, end: () => h.remove() });
    }
    flashDisc(x, z, radius, color, life) {
      const h = this.decal('circle', x, z, radius, color, 0.5);
      this.timed.push({ t: 0, life: life || 0.25, fn: (k) => h.opacity(0.5 * (1 - k)), end: () => h.remove() });
    }

    // ---------- beams and lightning ----------
    _beam() {
      let b = this.beams.find((x) => !x.used);
      if (!b) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
        const mesh = new THREE.Mesh(this.geo.box, mat);
        mesh.renderOrder = 3;
        b = { mesh, mat, used: false };
        this.beams.push(b);
        this.scene.add(mesh);
      }
      b.used = true; b.mesh.visible = true;
      return b;
    }
    beam(x1, y1, z1, x2, y2, z2, color, width, life) {
      const b = this._beam();
      b.mat.color.set(color); b.mat.opacity = 0.9;
      const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, len = Math.hypot(dx, dy, dz) || 0.01;
      b.mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      b.mesh.scale.set(width, width, len);
      b.mesh.lookAt(x2, y2, z2);
      if (life > 0) this.timed.push({ t: 0, life, fn: (k) => { b.mat.opacity = 0.9 * (1 - k); }, end: () => { b.used = false; b.mesh.visible = false; } });
      return { b, remove: () => { b.used = false; b.mesh.visible = false; }, set: (a1, a2, a3, c1, c2, c3) => { const ex = c1 - a1, ey = c2 - a2, ez = c3 - a3; const l = Math.hypot(ex, ey, ez) || 0.01; b.mesh.position.set((a1 + c1) / 2, (a2 + c2) / 2, (a3 + c3) / 2); b.mesh.scale.z = l; b.mesh.lookAt(c1, c2, c3); } };
    }
    lightning(x1, y1, z1, x2, y2, z2, color) {
      let px = x1, py = y1, pz = z1;
      const segs = 4;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const j = i === segs ? 0 : 0.45;
        const nx = AM.lerp(x1, x2, t) + (Math.random() - 0.5) * j, ny = AM.lerp(y1, y2, t) + (Math.random() - 0.5) * j * 0.6, nz = AM.lerp(z1, z2, t) + (Math.random() - 0.5) * j;
        this.beam(px, py, pz, nx, ny, nz, color, 0.09, 0.22);
        px = nx; py = ny; pz = nz;
      }
    }
    bubble(color) {
      let b = this.bubbles.find((x) => !x.used);
      if (!b) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false });
        const mesh = new THREE.Mesh(this.geo.bubble, mat);
        b = { mesh, mat, used: false };
        this.bubbles.push(b);
        this.scene.add(mesh);
      }
      b.used = true; b.mesh.visible = true; b.mat.color.set(color);
      return { set: (x, y, z, r) => { b.mesh.position.set(x, y, z); b.mesh.scale.setScalar(r); b.mesh.rotation.y += 0.02; }, remove: () => { b.used = false; b.mesh.visible = false; } };
    }

    // ---------- update ----------
    update(dt) {
      const P = this.P, m = this._m, p = this._p, s = this._s, q = this.ident;
      let i = 0;
      while (i < this.n) {
        P.life[i] -= dt;
        if (P.life[i] <= 0) {
          const j = --this.n;
          for (const k in P) P[k][i] = P[k][j];
          continue;
        }
        P.vy[i] -= P.grav[i] * dt;
        P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
        if (P.y[i] < 0.03) { P.y[i] = 0.03; P.vy[i] *= -0.3; P.vx[i] *= 0.7; P.vz[i] *= 0.7; }
        const k = P.life[i] / P.max[i];
        const sz = P.size[i] * (0.35 + 0.65 * k);
        p.set(P.x[i], P.y[i], P.z[i]); s.set(sz, sz, sz);
        m.compose(p, q, s);
        this.pm.setMatrixAt(i, m);
        this.pm.instanceColor.setXYZ(i, P.r[i], P.g[i], P.b[i]);
        i++;
      }
      this.pm.count = this.n;
      this.pm.instanceMatrix.needsUpdate = true;
      this.pm.instanceColor.needsUpdate = true;
      // orbs
      const e = new THREE.Euler();
      for (let o = 0; o < this.orbs.length; o++) {
        const h = this.orbs[o];
        h.rot += dt * h.spin;
        e.set(h.rot, h.rot * 0.7, 0); this._q.setFromEuler(e);
        p.set(h.x, h.y, h.z); s.set(h.size, h.size, h.size);
        m.compose(p, this._q, s);
        this.om.setMatrixAt(o, m);
      }
      this.om.count = this.orbs.length;
      this.om.instanceMatrix.needsUpdate = true;
      // timed visuals
      for (let k = this.timed.length - 1; k >= 0; k--) {
        const t = this.timed[k];
        t.t += dt;
        const f = Math.min(1, t.t / t.life);
        t.fn(f);
        if (f >= 1) { if (t.end) t.end(); this.timed.splice(k, 1); }
      }
    }
    clear() {
      this.n = 0;
      while (this.orbs.length) this.orbs[this.orbs.length - 1].remove();
      for (const d of this.decals) { d.used = false; d.mesh.visible = false; }
      for (const b of this.beams) { b.used = false; b.mesh.visible = false; }
      for (const b of this.bubbles) { b.used = false; b.mesh.visible = false; }
      for (const t of this.timed) if (t.end) t.end();
      this.timed.length = 0;
    }
  }
  R.FX = FX;
})(typeof window !== 'undefined' ? window : globalThis);
