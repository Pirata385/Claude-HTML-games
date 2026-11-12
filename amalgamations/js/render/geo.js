// Amalgamations — low-poly geometry builder: chamfered, tapered and sheared boxes with flat-shaded
// vertex colours, merged into one BufferGeometry with material groups (solid / glow / ghost) and
// optional rigid skinning (each part follows one bone).
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const R = AM.R || (AM.R = {});

  const colorCache = new Map();
  function lin(hex) {
    let c = colorCache.get(hex);
    if (!c) { const t = new THREE.Color(hex); c = [t.r, t.g, t.b]; colorCache.set(hex, c); }
    return c;
  }
  R.lin = lin;

  const _v = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _s = new THREE.Vector3(1, 1, 1);
  const _p = new THREE.Vector3();

  // Build a transform matrix from position [x,y,z] and rotation [rx,ry,rz] (radians, XYZ order).
  function mat(pos, rot, scale) {
    _p.set(pos[0], pos[1], pos[2]);
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0, rot && rot[3] ? rot[3] : 'XYZ');
    _q.setFromEuler(_e);
    if (scale) _s.set(scale, scale, scale); else _s.set(1, 1, 1);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }
  R.mat = mat;

  class GeoBuilder {
    constructor(skinned) {
      this.skinned = !!skinned;
      this.b = [0, 1, 2].map(() => ({ p: [], n: [], c: [], s: [] }));
    }
    tri(bucket, a, b, c, col, bone) {
      const B = this.b[bucket];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      B.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      for (let i = 0; i < 3; i++) { B.n.push(nx, ny, nz); B.c.push(col[0], col[1], col[2]); if (this.skinned) B.s.push(bone || 0); }
    }
    // o: {w,h,l,c, tt (taper top), tf (taper front), tb (taper back), sh (shear: top shifts along z by sh*h),
    //     m (Matrix4), col (hex | fn(center, normal) → hex), bucket, bone}
    box(o) {
      const W = o.w / 2, H = o.h / 2, L = o.l / 2;
      const c = Math.min(o.c || 0, W * 0.9, H * 0.9, L * 0.9);
      const tt = o.tt == null ? 1 : o.tt, tf = o.tf == null ? 1 : o.tf, tb = o.tb == null ? 1 : o.tb, sh = o.sh || 0;
      const tp = (x, y, z) => {
        const fy = (y + H) / (2 * H);
        const k = 1 + (tt - 1) * fy;
        const fz = (z + L) / (2 * L);
        const kf = fz > 0.5 ? 1 + (tf - 1) * (fz - 0.5) * 2 : 1 + (tb - 1) * (0.5 - fz) * 2;
        return [x * k * kf, y * kf, z * k + sh * (y + H)];
      };
      const polys = [];
      if (c <= 0.002) {
        const P = (sx, sy, sz) => tp(sx * W, sy * H, sz * L);
        polys.push([P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)], [P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)]);
        polys.push([P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)], [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)]);
        polys.push([P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], [P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1)]);
      } else {
        const PX = (sx, sy, sz) => tp(sx * W, sy * (H - c), sz * (L - c));
        const PY = (sx, sy, sz) => tp(sx * (W - c), sy * H, sz * (L - c));
        const PZ = (sx, sy, sz) => tp(sx * (W - c), sy * (H - c), sz * L);
        for (const s of [1, -1]) {
          polys.push([PX(s, -1, -1), PX(s, 1, -1), PX(s, 1, 1), PX(s, -1, 1)]);
          polys.push([PY(-1, s, -1), PY(1, s, -1), PY(1, s, 1), PY(-1, s, 1)]);
          polys.push([PZ(-1, -1, s), PZ(1, -1, s), PZ(1, 1, s), PZ(-1, 1, s)]);
        }
        for (const a of [1, -1]) for (const b of [1, -1]) {
          polys.push([PX(a, b, -1), PY(a, b, -1), PY(a, b, 1), PX(a, b, 1)]);
          polys.push([PY(-1, a, b), PZ(-1, a, b), PZ(1, a, b), PY(1, a, b)]);
          polys.push([PX(a, -1, b), PZ(a, -1, b), PZ(a, 1, b), PX(a, 1, b)]);
        }
        for (const a of [1, -1]) for (const b of [1, -1]) for (const d of [1, -1]) polys.push([PX(a, b, d), PY(a, b, d), PZ(a, b, d)]);
      }
      this._emit(polys, o, [0, 0, sh * H]);
    }
    // Octagonal prism along 'y' (horizontal bands) or 'z' (vertical bands): only the edges along the axis are chamfered.
    prism(o) {
      const W = o.w / 2, H = o.h / 2, L = o.l / 2;
      const ax = o.axis || 'y';
      const A = ax === 'y' ? W : W, Bh = ax === 'y' ? L : H, E = ax === 'y' ? H : L;
      const cv = Math.min(o.cv || 0, A * 0.9, Bh * 0.9);
      const ring = [[A - cv, Bh], [A, Bh - cv], [A, -(Bh - cv)], [A - cv, -Bh], [-(A - cv), -Bh], [-A, -(Bh - cv)], [-A, Bh - cv], [-(A - cv), Bh]];
      const pt = (u, v, e) => (ax === 'y' ? [u, e, v] : [u, v, e]);
      const polys = [ring.map(([u, v]) => pt(u, v, E)), ring.map(([u, v]) => pt(u, v, -E))];
      for (let i = 0; i < 8; i++) { const a = ring[i], b = ring[(i + 1) % 8]; polys.push([pt(a[0], a[1], E), pt(b[0], b[1], E), pt(b[0], b[1], -E), pt(a[0], a[1], -E)]); }
      this._emit(polys, o, [0, 0, 0]);
    }
    _emit(polys, o, ctr) {
      const bucket = o.bucket || 0, bone = o.bone || 0;
      const fn = typeof o.col === 'function' ? o.col : null;
      const fixed = fn ? null : lin(o.col || '#ff00ff');
      for (const poly of polys) {
        // winding: the polygon normal must point away from the shape's centre
        let cx = 0, cy = 0, cz = 0;
        for (const p of poly) { cx += p[0]; cy += p[1]; cz += p[2]; }
        cx /= poly.length; cy /= poly.length; cz /= poly.length;
        const a = poly[0], b = poly[1], d = poly[2];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        if (nx * (cx - ctr[0]) + ny * (cy - ctr[1]) + nz * (cz - ctr[2]) < 0) poly.reverse();
        const col = fn ? lin(fn([cx, cy, cz], [nx, ny, nz])) : fixed;
        const T = poly.map((p) => { _v.set(p[0], p[1], p[2]); if (o.m) _v.applyMatrix4(o.m); return [_v.x, _v.y, _v.z]; });
        for (let i = 1; i < T.length - 1; i++) this.tri(bucket, T[0], T[i], T[i + 1], col, bone);
      }
    }
    // A flat triangle-fan polygon (points already in model space).
    poly(pts, col, bucket, bone) {
      const c = lin(col);
      for (let i = 1; i < pts.length - 1; i++) this.tri(bucket || 0, pts[0], pts[i], pts[i + 1], c, bone);
    }
    get triCount() { return this.b.reduce((a, B) => a + B.p.length / 9, 0); }
    build() {
      const total = this.b.reduce((a, B) => a + B.p.length / 3, 0);
      const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3), col = new Float32Array(total * 3);
      const si = this.skinned ? new Uint16Array(total * 4) : null, sw = this.skinned ? new Float32Array(total * 4) : null;
      const geo = new THREE.BufferGeometry();
      let off = 0;
      this.b.forEach((B, mi) => {
        const n = B.p.length / 3;
        if (!n) return;
        pos.set(B.p, off * 3); nrm.set(B.n, off * 3); col.set(B.c, off * 3);
        if (si) for (let i = 0; i < n; i++) { si[(off + i) * 4] = B.s[i]; sw[(off + i) * 4] = 1; }
        geo.addGroup(off, n, mi);
        off += n;
      });
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (si) { geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); }
      geo.computeBoundingSphere();
      return geo;
    }
  }
  R.GeoBuilder = GeoBuilder;

  let summon = null;
  R.summonMat = function () { if (!summon) summon = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#d8b8ff', transparent: true, opacity: 0.55, depthWrite: false, emissive: '#3a1a6a' }); return summon; };
  // Shared materials. Group 0 solid, 1 glow (unlit), 2 ghost (translucent).
  let mats = null;
  R.materials = function () {
    if (mats) return mats;
    const solid = new THREE.MeshLambertMaterial({ vertexColors: true });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const ghost = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false });
    const flash = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const flashRed = new THREE.MeshBasicMaterial({ color: 0xff6a5a });
    mats = { solid, glow, ghost, flash, flashRed, set: [solid, glow, ghost], flashSet: [flash, flash, flash], flashRedSet: [flashRed, flashRed, flashRed] };
    return mats;
  };
})(typeof window !== 'undefined' ? window : globalThis);
