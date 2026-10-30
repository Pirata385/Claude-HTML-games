// Box-built ("voxel") geometry with baked vertex colours, and shared materials.
import * as THREE from 'three';

const FACES = [
  { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], shade: 0.86 },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], shade: 0.8 },
  { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], shade: 1.0 },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], shade: 0.6 },
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], shade: 0.92 },
  { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], shade: 0.76 },
];
const _c = new THREE.Color();

// boxes: [cx, cy, cz, w, h, d, color] — centred boxes in model space.
export function boxesGeometry(boxes) {
  const n = boxes.length * 24;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const idx = new (n > 65000 ? Uint32Array : Uint16Array)(boxes.length * 36);
  let v = 0, t = 0;
  for (const [cx, cy, cz, w, h, d, color] of boxes) {
    _c.set(color);
    for (const f of FACES) {
      const base = v;
      for (const [sx, sy, sz] of f.v) {
        pos[v * 3] = cx + (sx * w) / 2; pos[v * 3 + 1] = cy + (sy * h) / 2; pos[v * 3 + 2] = cz + (sz * d) / 2;
        nor[v * 3] = f.n[0]; nor[v * 3 + 1] = f.n[1]; nor[v * 3 + 2] = f.n[2];
        col[v * 3] = _c.r * f.shade; col[v * 3 + 1] = _c.g * f.shade; col[v * 3 + 2] = _c.b * f.shade;
        v++;
      }
      idx[t++] = base; idx[t++] = base + 1; idx[t++] = base + 2; idx[t++] = base; idx[t++] = base + 2; idx[t++] = base + 3;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Shared materials: everything voxel uses vertex colours, so one material serves many meshes.
let lit = null, unlit = null, glow = null;
export const litMaterial = () => (lit ||= new THREE.MeshLambertMaterial({ vertexColors: true }));
export const unlitMaterial = () => (unlit ||= new THREE.MeshBasicMaterial({ vertexColors: true }));
export const glowMaterial = () => (glow ||= new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));

// Shade a hex colour (multiply) and return a hex number.
export function shade(color, k) {
  _c.set(color).multiplyScalar(k);
  return _c.getHex();
}
export function mix(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}
