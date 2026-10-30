// Instanced props: resource nodes (with depleted and hit states) and decoration.
import * as THREE from 'three';
import { boxesGeometry, litMaterial, unlitMaterial } from './voxel.js';
import { NODES } from '../data/nodes.js';
import { MATERIALS } from '../data/materials.js';
import { occludes } from './occlusion.js';

const B = (x, y, z, w, h, d, c) => [x, y, z, w, h, d, c];

// Prop models: arrays of boxes standing on y = 0.
const MODELS = {
  oak: () => [B(0, 1.1, 0, 0.7, 2.2, 0.7, '#7a5232'), B(0, 2.9, 0, 2.8, 1.6, 2.8, '#3f9b45'), B(0, 3.9, 0, 1.9, 0.9, 1.9, '#52b456'), B(0.9, 2.5, 0.6, 1.0, 0.8, 1.0, '#378a3e')],
  pine: () => [B(0, 0.9, 0, 0.6, 1.8, 0.6, '#6b4a2e'), B(0, 2.1, 0, 2.6, 1.0, 2.6, '#2f7a52'), B(0, 3.0, 0, 1.9, 0.9, 1.9, '#33865a'), B(0, 3.8, 0, 1.2, 0.8, 1.2, '#3a9463'), B(0, 4.4, 0, 0.5, 0.5, 0.5, '#43a06c')],
  birch: () => [B(0, 1.3, 0, 0.5, 2.6, 0.5, '#e8e4d8'), B(0.26, 0.9, 0, 0.04, 0.2, 0.3, '#3a3a3a'), B(-0.26, 1.7, 0.1, 0.04, 0.16, 0.24, '#3a3a3a'), B(0, 3.0, 0, 2.0, 1.4, 2.0, '#8fcf62'), B(0, 3.9, 0, 1.2, 0.7, 1.2, '#a2dc72')],
  boulder: () => [B(0, 0.5, 0, 1.5, 1.0, 1.3, '#8e9199'), B(0.45, 0.95, -0.2, 0.9, 0.7, 0.9, '#9fa3ab'), B(-0.5, 0.35, 0.4, 0.8, 0.6, 0.7, '#7d8088')],
  oreRock: () => [B(0, 0.45, 0, 1.4, 0.9, 1.3, '#ffffff'), B(-0.4, 0.8, 0.2, 0.8, 0.7, 0.8, '#e6e6e6'), B(0.35, 0.3, -0.35, 0.8, 0.5, 0.7, '#d0d0d0')],
  oreCrystal: () => [B(0.15, 1.15, 0.1, 0.35, 0.7, 0.35, '#ffffff'), B(-0.45, 1.3, 0.25, 0.25, 0.5, 0.25, '#ffffff'), B(0.55, 0.75, -0.35, 0.3, 0.45, 0.3, '#ffffff'), B(-0.1, 0.95, -0.5, 0.22, 0.35, 0.22, '#ffffff')],
  stump: () => [B(0, 0.3, 0, 0.75, 0.6, 0.75, '#7a5232'), B(0, 0.61, 0, 0.6, 0.04, 0.6, '#c9a46a')],
  rubble: () => [B(0.2, 0.15, 0, 0.5, 0.3, 0.4, '#7d8088'), B(-0.3, 0.12, 0.2, 0.4, 0.24, 0.35, '#6d7078'), B(0, 0.1, -0.35, 0.3, 0.2, 0.3, '#8e9199')],
};

const geoCache = new Map();
export function propGeometry(name) {
  if (!geoCache.has(name)) geoCache.set(name, boxesGeometry(MODELS[name]()));
  return geoCache.get(name);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function modelFor(nodeId) {
  const m = NODES[nodeId].model;
  return m === 'ore' ? 'ore' : m;
}

export class NodeVisuals {
  constructor(zone, scene, caveTint) {
    this.zone = zone;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = {};
    this.slots = [];
    this.shakes = new Map();
    const counts = {};
    for (const n of zone.nodes) { const m = modelFor(n.node); counts[m] = (counts[m] || 0) + 1; }
    const mk = (name, geoName, count, mat, cast = true) => {
      const mesh = new THREE.InstancedMesh(propGeometry(geoName), mat, Math.max(1, count));
      mesh.castShadow = cast; mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
      this.meshes[name] = mesh;
      return mesh;
    };
    for (const [m, n] of Object.entries(counts)) {
      if (m === 'ore') { mk('oreRock', 'oreRock', n, litMaterial()); mk('oreCrystal', 'oreCrystal', n, unlitMaterial(), false); }
      else mk(m, m, n, litMaterial());
    }
    const trees = (counts.oak || 0) + (counts.pine || 0) + (counts.birch || 0);
    const rocks = (counts.boulder || 0) + (counts.ore || 0);
    mk('stump', 'stump', trees, litMaterial(), false);
    mk('rubble', 'rubble', rocks, litMaterial(), false);
    const used = {};
    const next = (name) => (used[name] = (used[name] || 0) + 1) - 1;
    zone.nodes.forEach((n) => {
      const m = modelFor(n.node);
      const slot = { node: n, model: m, parts: [], dep: null };
      if (m === 'ore') {
        slot.parts.push(['oreRock', next('oreRock')], ['oreCrystal', next('oreCrystal')]);
        slot.dep = ['rubble', next('rubble')];
      } else {
        slot.parts.push([m, next(m)]);
        slot.dep = m === 'boulder' ? ['rubble', next('rubble')] : ['stump', next('stump')];
      }
      this.slots.push(slot);
      // Colour: trees vary a little; ore rock follows the cave; crystals take the material colour.
      for (const [name, idx] of slot.parts) {
        const mesh = this.meshes[name];
        if (name === 'oreCrystal') _c.set(MATERIALS[NODES[n.node].material].color).multiplyScalar(n.node === 'ore_stone' ? 0.8 : 1.25);
        else if (name === 'oreRock') _c.set(caveTint || '#8e9199');
        else { const v = 0.88 + ((n.i * 7 + n.j * 13) % 10) / 40; _c.setRGB(v, v, v); }
        mesh.setColorAt(idx, _c);
      }
      this.place(slot, false);
    });
    for (const mesh of Object.values(this.meshes)) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); }
    // Trees by 4 m bucket, to find the ones standing between the camera and the player.
    this.buckets = new Map();
    this.slots.forEach((sl, i) => { if (['oak', 'pine', 'birch'].includes(sl.model)) { const k = `${sl.node.i >> 2},${sl.node.j >> 2}`; if (!this.buckets.has(k)) this.buckets.set(k, []); this.buckets.get(k).push(i); } });
    this.hidden = new Set();
  }

  // Hides trees whose canopy would block the view of the player; restores them afterwards.
  occlude(cx, cz, px, pz) {
    if (!this.buckets.size) return;
    const next = new Set();
    const b0 = (Math.min(cx, px) - 3) >> 2, b1 = (Math.max(cx, px) + 3) >> 2, c0 = (Math.min(cz, pz) - 3) >> 2, c1 = (Math.max(cz, pz) + 3) >> 2;
    for (let bj = c0; bj <= c1; bj++) for (let bi = b0; bi <= b1; bi++) {
      const list = this.buckets.get(`${bi},${bj}`);
      if (!list) continue;
      for (const i of list) {
        const n = this.slots[i].node;
        if (occludes(cx, cz, px, pz, n.x, n.z)) next.add(i);
      }
    }
    // Swap the sets first: place() consults this.hidden, so restored trees must already be out of it.
    const prev = this.hidden;
    this.hidden = next;
    for (const i of prev) if (!next.has(i)) { const s = this.slots[i]; this.place(s, s.depleted); }
    for (const i of next) if (!prev.has(i)) { const s = this.slots[i]; for (const [name, idx] of s.parts) { this.meshes[name].setMatrixAt(idx, ZERO); this.meshes[name].instanceMatrix.needsUpdate = true; } }
  }
  matrixFor(n, ox = 0, oz = 0, sy = 1) {
    _p.set(n.x + ox, n.h, n.z + oz);
    _q.setFromEuler(_e.set(0, n.rot, 0));
    _s.set(n.scale, n.scale * sy, n.scale);
    return _m.compose(_p, _q, _s);
  }
  place(slot, depleted) {
    slot.depleted = depleted;
    const hidden = this.hidden?.has(this.slots.indexOf(slot));
    for (const [name, idx] of slot.parts) this.meshes[name].setMatrixAt(idx, depleted || hidden ? ZERO : this.matrixFor(slot.node));
    this.meshes[slot.dep[0]].setMatrixAt(slot.dep[1], depleted ? this.matrixFor(slot.node) : ZERO);
    for (const name of [...slot.parts.map((p) => p[0]), slot.dep[0]]) this.meshes[name].instanceMatrix.needsUpdate = true;
  }
  setDepleted(index, depleted) { const s = this.slots[index]; if (s && s.depleted !== depleted) this.place(s, depleted); }
  hit(index) { this.shakes.set(index, 0.28); }
  update(dt) {
    for (const [index, t] of this.shakes) {
      const s = this.slots[index];
      const nt = t - dt;
      if (nt <= 0 || s.depleted) { this.shakes.delete(index); if (!s.depleted) this.place(s, false); continue; }
      this.shakes.set(index, nt);
      const a = Math.sin(nt * 60) * nt * 0.35;
      for (const [name, idx] of s.parts) { this.meshes[name].setMatrixAt(idx, this.matrixFor(s.node, a, a * 0.6, 1 - nt * 0.15)); this.meshes[name].instanceMatrix.needsUpdate = true; }
    }
  }
  dispose() { this.group.parent?.remove(this.group); for (const m of Object.values(this.meshes)) m.dispose(); }
}

// Decoration that never changes: flowers, glowing growths, rails.
export function buildDecor(zone, quality) {
  const group = new THREE.Group();
  const disposables = [];
  const inst = (geo, mat, list, colorOf, scaleOf = () => 1, cast = false) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((d, k) => {
      const s = scaleOf(d);
      mesh.setMatrixAt(k, _m.compose(_p.set(d.x, d.h, d.z), _q.setFromEuler(_e.set(0, (k * 1.7) % 6.28, 0)), _s.set(s, s, s)));
      mesh.setColorAt(k, _c.set(colorOf(d)));
    });
    mesh.castShadow = cast;
    mesh.computeBoundingSphere();
    group.add(mesh);
    disposables.push(mesh);
  };
  if (zone.decor.flowers && quality.grass) {
    const geo = boxesGeometry([B(0, 0.12, 0, 0.06, 0.24, 0.06, '#3c8a3a'), B(0, 0.3, 0, 0.2, 0.14, 0.2, '#ffffff')]);
    disposables.push(geo);
    const cols = ['#ffd166', '#ff7aa8', '#9fd8ff', '#ffffff'];
    inst(geo, litMaterial(), zone.decor.flowers, (d) => cols[d.c], () => 1.2);
    // Grass tufts share the flower positions, offset.
    const tuft = boxesGeometry([B(0, 0.15, 0, 0.08, 0.3, 0.08, '#ffffff'), B(0.12, 0.11, 0.05, 0.06, 0.22, 0.06, '#ffffff'), B(-0.1, 0.12, -0.06, 0.06, 0.24, 0.06, '#ffffff')]);
    disposables.push(tuft);
    inst(tuft, litMaterial(), zone.decor.flowers.map((f) => ({ ...f, x: f.x + 0.9, z: f.z - 0.6 })), () => '#5aa84e', () => 1.3);
  }
  if (zone.decor.glow?.length) {
    const pal = zone.def.palette;
    const kind = pal.glow;
    const boxes = kind === 'glowcap' || kind === 'fungus'
      ? [B(0, 0.25, 0, 0.12, 0.5, 0.12, '#d8d0c0'), B(0, 0.55, 0, 0.5, 0.18, 0.5, '#ffffff')]
      : [B(0, 0.4, 0, 0.22, 0.8, 0.22, '#ffffff'), B(0.2, 0.25, 0.1, 0.16, 0.5, 0.16, '#ffffff'), B(-0.15, 0.2, -0.12, 0.14, 0.4, 0.14, '#ffffff')];
    const geo = boxesGeometry(boxes);
    disposables.push(geo);
    const cols = [pal.accent, pal.accent2 || pal.light, pal.light];
    inst(geo, unlitMaterial(), zone.decor.glow, (d) => (zone.split ? (d.x < zone.grid.w / 2 ? '#ff7a3d' : '#7fc8ff') : cols[d.c]), () => 1.2);
  }
  if (zone.decor.rails?.length) {
    const geo = boxesGeometry([B(0, 0.05, 0, 1.0, 0.1, 0.3, '#6b4a2e'), B(0.3, 0.14, 0, 0.08, 0.08, 1.0, '#9a948a'), B(-0.3, 0.14, 0, 0.08, 0.08, 1.0, '#9a948a')]);
    disposables.push(geo);
    const g = zone.grid;
    inst(geo, litMaterial(), zone.decor.rails.map((r) => ({ x: r.i + 0.5, z: r.j + 0.5, h: g.h[g.idx(r.i, r.j)] })), () => '#ffffff');
  }
  return { group, dispose() { group.parent?.remove(group); for (const d of disposables) d.dispose(); } };
}
