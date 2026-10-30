// Box-built character rigs with procedural animation.
// Enemies render through RigInstancer (one InstancedMesh per rig part, so dozens of foes cost
// a handful of draw calls); the player, bosses and Lume use RigMesh (a plain object hierarchy).
import * as THREE from 'three';
import { boxesGeometry, litMaterial, unlitMaterial } from './voxel.js';

const B = (x, y, z, w, h, d, c) => [x, y, z, w, h, d, c];
const P = (name, parent, pivot, boxes, tint = null, o = {}) => ({ name, parent, pivot, boxes, tint, ...o });
const W = '#ffffff';

// ---------------------------------------------------------------- rig definitions
function humanoid({ skin = W, cloth = W, legs = W, head = [], eyes = '#141018', armLen = 0.66, scale = 1, extraTorso = [] } = {}) {
  return {
    kind: 'humanoid', scale,
    parts: [
      P('torso', -1, [0, 0.95, 0], [B(0, 0.38, 0, 0.62, 0.76, 0.36, cloth), ...extraTorso], 'b'),
      P('head', 0, [0, 0.78, 0], [B(0, 0.24, 0, 0.48, 0.48, 0.48, skin), B(0.11, 0.26, 0.245, 0.08, 0.1, 0.02, eyes), B(-0.11, 0.26, 0.245, 0.08, 0.1, 0.02, eyes), ...head], 'a'),
      P('armL', 0, [0.42, 0.68, 0], [B(0, -armLen / 2 + 0.04, 0, 0.2, armLen, 0.22, skin)], 'a'),
      P('armR', 0, [-0.42, 0.68, 0], [B(0, -armLen / 2 + 0.04, 0, 0.2, armLen, 0.22, skin)], 'a'),
      P('legL', -1, [0.16, 0.95, 0], [B(0, -0.45, 0, 0.24, 0.9, 0.26, legs)], 'c'),
      P('legR', -1, [-0.16, 0.95, 0], [B(0, -0.45, 0, 0.24, 0.9, 0.26, legs)], 'c'),
    ],
  };
}

export const RIGS = {
  slime: () => ({ kind: 'slime', parts: [
    P('body', -1, [0, 0, 0], [B(0, 0.38, 0, 1.0, 0.76, 1.0, W), B(0, 0.82, 0, 0.72, 0.16, 0.72, W), B(0, 0.12, 0, 1.12, 0.24, 1.12, W)], 'a'),
    P('face', 0, [0, 0, 0], [B(0.2, 0.5, 0.51, 0.14, 0.2, 0.02, '#141018'), B(-0.2, 0.5, 0.51, 0.14, 0.2, 0.02, '#141018'), B(0, 0.32, 0.51, 0.26, 0.06, 0.02, '#141018'), B(0.22, 0.56, 0.52, 0.05, 0.06, 0.01, W)]),
  ] }),
  zombie: (o = {}) => humanoid({ armLen: 0.72, eyes: '#e8ff7a', head: o.helmet ? [B(0, 0.52, 0, 0.56, 0.14, 0.56, '#c9a640'), B(0, 0.5, 0.29, 0.14, 0.12, 0.04, '#fff2a0')] : [B(0.1, 0.5, 0.05, 0.2, 0.06, 0.3, '#3a3a2a')] }),
  bat: () => ({ kind: 'bat', parts: [
    P('body', -1, [0, 0, 0], [B(0, 0, 0, 0.36, 0.36, 0.44, W), B(0, 0.18, 0.18, 0.26, 0.24, 0.24, W), B(0.08, 0.34, 0.16, 0.06, 0.12, 0.06, W), B(-0.08, 0.34, 0.16, 0.06, 0.12, 0.06, W), B(0.07, 0.2, 0.31, 0.05, 0.05, 0.02, '#ff4a4a'), B(-0.07, 0.2, 0.31, 0.05, 0.05, 0.02, '#ff4a4a')], 'a'),
    P('wingL', 0, [0.18, 0.05, 0], [B(0.38, 0, 0, 0.76, 0.04, 0.5, W)], 'a'),
    P('wingR', 0, [-0.18, 0.05, 0], [B(-0.38, 0, 0, 0.76, 0.04, 0.5, W)], 'a'),
  ] }),
  crab: () => ({ kind: 'crab', parts: [
    P('body', -1, [0, 0, 0], [B(0, 0.45, 0, 1.3, 0.55, 1.0, W), B(0, 0.78, -0.1, 1.0, 0.2, 0.7, W), B(0.2, 0.85, 0.45, 0.1, 0.2, 0.1, '#141018'), B(-0.2, 0.85, 0.45, 0.1, 0.2, 0.1, '#141018'),
      B(0.65, 0.2, 0.2, 0.14, 0.4, 0.14, '#6a6a70'), B(-0.65, 0.2, 0.2, 0.14, 0.4, 0.14, '#6a6a70'), B(0.65, 0.2, -0.25, 0.14, 0.4, 0.14, '#6a6a70'), B(-0.65, 0.2, -0.25, 0.14, 0.4, 0.14, '#6a6a70')], 'a'),
    P('clawL', 0, [0.55, 0.5, 0.45], [B(0.15, 0, 0.3, 0.42, 0.34, 0.5, W)], 'a'),
    P('clawR', 0, [-0.55, 0.5, 0.45], [B(-0.15, 0, 0.3, 0.42, 0.34, 0.5, W)], 'a'),
  ] }),
  beetle: () => ({ kind: 'bug', parts: [
    P('body', -1, [0, 0, 0], [B(0, 0.35, -0.1, 0.8, 0.45, 1.0, W), B(0, 0.62, -0.1, 0.6, 0.12, 0.8, W), B(0, 0.32, 0.5, 0.45, 0.3, 0.3, '#2a2a30'),
      B(0.12, 0.38, 0.66, 0.08, 0.08, 0.02, '#e8fff8'), B(-0.12, 0.38, 0.66, 0.08, 0.08, 0.02, '#e8fff8'),
      B(0.45, 0.15, 0.2, 0.3, 0.08, 0.08, '#2a2a30'), B(-0.45, 0.15, 0.2, 0.3, 0.08, 0.08, '#2a2a30'), B(0.45, 0.15, -0.3, 0.3, 0.08, 0.08, '#2a2a30'), B(-0.45, 0.15, -0.3, 0.3, 0.08, 0.08, '#2a2a30')], 'a'),
  ] }),
  crawler: () => ({ kind: 'bug', parts: [
    P('body', -1, [0, 0, 0], [B(0, 0.3, 0, 0.7, 0.36, 1.2, W), B(0, 0.52, -0.2, 0.3, 0.3, 0.3, W), B(0, 0.6, 0.2, 0.22, 0.38, 0.22, W), B(0, 0.28, 0.66, 0.36, 0.26, 0.2, '#1e2a28'),
      B(0.1, 0.33, 0.77, 0.06, 0.06, 0.02, '#ff6a6a'), B(-0.1, 0.33, 0.77, 0.06, 0.06, 0.02, '#ff6a6a'),
      B(0.45, 0.12, 0.3, 0.34, 0.07, 0.07, '#1e2a28'), B(-0.45, 0.12, 0.3, 0.34, 0.07, 0.07, '#1e2a28'), B(0.45, 0.12, -0.3, 0.34, 0.07, 0.07, '#1e2a28'), B(-0.45, 0.12, -0.3, 0.34, 0.07, 0.07, '#1e2a28')], 'a'),
  ] }),
  puff: () => ({ kind: 'puff', parts: [
    P('body', -1, [0, 0, 0], [B(0, 0.5, 0, 0.9, 0.8, 0.9, W), B(0, 0.5, 0, 1.05, 0.55, 1.05, W), B(0, 0.95, 0, 0.5, 0.2, 0.5, W), B(0.3, 0.75, 0.46, 0.14, 0.14, 0.02, '#fff2a0'), B(-0.25, 0.4, 0.53, 0.12, 0.12, 0.02, '#fff2a0'), B(0.46, 0.4, -0.1, 0.02, 0.14, 0.14, '#fff2a0'), B(0, 0.08, 0, 0.3, 0.16, 0.3, '#6a5a4a')], 'a'),
  ] }),
  slug: () => ({ kind: 'slug', parts: [
    P('s0', -1, [0, 0, 0.45], [B(0, 0.3, 0, 0.7, 0.6, 0.6, W), B(0.18, 0.66, 0.18, 0.06, 0.24, 0.06, '#2a1a10'), B(-0.18, 0.66, 0.18, 0.06, 0.24, 0.06, '#2a1a10'), B(0, 0.62, -0.1, 0.3, 0.06, 0.3, '#ffe066')], 'a'),
    P('s1', -1, [0, 0, -0.15], [B(0, 0.28, 0, 0.8, 0.56, 0.62, W), B(0.2, 0.58, 0, 0.18, 0.04, 0.18, '#ffe066')], 'a'),
    P('s2', -1, [0, 0, -0.7], [B(0, 0.22, 0, 0.62, 0.44, 0.56, W)], 'a'),
  ] }),
  wraith: () => ({ kind: 'wraith', parts: [
    P('robe', -1, [0, 0.4, 0], [B(0, 0.5, 0, 0.7, 1.0, 0.5, W), B(0, -0.05, 0, 0.5, 0.3, 0.36, W), B(0, -0.3, 0, 0.3, 0.3, 0.2, W)], 'a'),
    P('head', 0, [0, 1.0, 0], [B(0, 0.22, 0, 0.46, 0.46, 0.46, W), B(0.1, 0.22, 0.24, 0.1, 0.06, 0.02, '#e8fbff'), B(-0.1, 0.22, 0.24, 0.1, 0.06, 0.02, '#e8fbff'), B(0, 0.48, -0.05, 0.56, 0.12, 0.56, W)], 'a'),
    P('armL', 0, [0.42, 0.85, 0], [B(0, -0.3, 0.08, 0.16, 0.6, 0.16, W)], 'a'),
    P('armR', 0, [-0.42, 0.85, 0], [B(0, -0.3, 0.08, 0.16, 0.6, 0.16, W)], 'a'),
  ] }),
  golem: () => ({ kind: 'humanoid', scale: 1, parts: [
    P('torso', -1, [0, 1.0, 0], [B(0, 0.45, 0, 1.0, 0.9, 0.7, '#6a6478'), B(0.3, 1.0, 0, 0.3, 0.5, 0.3, W), B(-0.25, 1.05, -0.1, 0.24, 0.6, 0.24, W), B(0, 0.5, 0.36, 0.4, 0.4, 0.04, W)], 'a'),
    P('head', 0, [0, 0.95, 0.1], [B(0, 0.18, 0, 0.5, 0.4, 0.5, '#5a5468'), B(0, 0.2, 0.26, 0.34, 0.08, 0.02, W)], 'a'),
    P('armL', 0, [0.7, 0.78, 0], [B(0, -0.45, 0, 0.42, 0.9, 0.42, '#6a6478'), B(0, -0.95, 0, 0.5, 0.3, 0.5, W)], 'a'),
    P('armR', 0, [-0.7, 0.78, 0], [B(0, -0.45, 0, 0.42, 0.9, 0.42, '#6a6478'), B(0, -0.95, 0, 0.5, 0.3, 0.5, W)], 'a'),
    P('legL', -1, [0.26, 1.0, 0], [B(0, -0.5, 0, 0.4, 1.0, 0.44, '#5a5468')]),
    P('legR', -1, [-0.26, 1.0, 0], [B(0, -0.5, 0, 0.4, 1.0, 0.44, '#5a5468')]),
  ] }),
  lurker: () => ({ kind: 'humanoid', scale: 1, parts: [
    P('torso', -1, [0, 1.15, 0], [B(0, 0.4, 0, 0.44, 0.8, 0.26, W)], 'a'),
    P('head', 0, [0, 0.82, 0.08], [B(0, 0.2, 0, 0.36, 0.42, 0.4, W), B(0.09, 0.22, 0.21, 0.08, 0.04, 0.02, '#bff6ff'), B(-0.09, 0.22, 0.21, 0.08, 0.04, 0.02, '#bff6ff')], 'a'),
    P('armL', 0, [0.3, 0.74, 0], [B(0, -0.55, 0, 0.12, 1.1, 0.12, W), B(0, -1.15, 0.06, 0.2, 0.14, 0.28, '#bff6ff')], 'a'),
    P('armR', 0, [-0.3, 0.74, 0], [B(0, -0.55, 0, 0.12, 1.1, 0.12, W), B(0, -1.15, 0.06, 0.2, 0.14, 0.28, '#bff6ff')], 'a'),
    P('legL', -1, [0.12, 1.15, 0], [B(0, -0.57, 0, 0.14, 1.15, 0.14, W)], 'a'),
    P('legR', -1, [-0.12, 1.15, 0], [B(0, -0.57, 0, 0.14, 1.15, 0.14, W)], 'a'),
  ] }),
  sentry: () => ({ kind: 'sentry', parts: [
    P('base', -1, [0, 0, 0], [B(0, 0.4, 0, 0.9, 0.8, 0.9, '#3a3450'), B(0, 1.2, 0, 0.5, 0.9, 0.5, W), B(0.3, 1.0, 0.2, 0.2, 0.6, 0.2, W), B(-0.25, 1.0, -0.25, 0.2, 0.5, 0.2, W)], 'a'),
    P('orb', 0, [0, 2.1, 0], [B(0, 0, 0, 0.42, 0.42, 0.42, W), B(0, 0, 0.22, 0.16, 0.16, 0.04, '#ff4a8a')], 'a'),
  ] }),
};

// ---------------------------------------------------------------- animation
// Pose per part: rotation, offset, uniform-ish scale. Reused objects, no allocation per frame.
export function makePose(n) { return Array.from({ length: n }, () => ({ rx: 0, ry: 0, rz: 0, x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1 })); }
function reset(pose) { for (const p of pose) { p.rx = p.ry = p.rz = p.x = p.y = p.z = 0; p.sx = p.sy = p.sz = 1; } }

// st: { t, move (0..1), phase (walk cycle), atk (0..1, 0 = none), wind (0..1), air, kind, special }
export function animate(rig, st, pose) {
  reset(pose);
  const parts = rig.parts;
  const ix = (name) => parts.findIndex((p) => p.name === name);
  const k = rig.kind;
  const ph = st.phase, mv = st.move;
  if (k === 'humanoid') {
    const [t, h, al, ar, ll, lr] = ['torso', 'head', 'armL', 'armR', 'legL', 'legR'].map(ix);
    const sw = Math.sin(ph) * 0.75 * mv;
    if (ll >= 0) { pose[ll].rx = sw; pose[lr].rx = -sw; }
    if (al >= 0) { pose[al].rx = -sw * 0.8; pose[ar].rx = sw * 0.8; }
    pose[t].y = Math.abs(Math.cos(ph)) * 0.05 * mv + Math.sin(st.t * 2) * 0.01;
    if (h >= 0) pose[h].rx = Math.sin(st.t * 1.3) * 0.03;
    if (st.reach) { pose[al].rx = -1.35 + Math.sin(st.t * 6) * 0.08; pose[ar].rx = -1.35 + Math.cos(st.t * 6) * 0.08; }
    if (st.wind > 0) { pose[ar].rx = -2.4 * st.wind; pose[al].rx = -2.2 * st.wind; pose[t].rx = -0.2 * st.wind; }
    if (st.atk > 0) {
      const a = st.atk;
      const swing = Math.sin(a * Math.PI);
      const style = st.style || 'slash';
      if (style === 'slash') { pose[ar].rx = -1.6 + a * 2.4; pose[ar].rz = -0.6 * swing; pose[t].ry = 0.6 - a * 1.2; }
      else if (style === 'slash2') { pose[ar].rx = -1.2; pose[ar].rz = 1.4 - a * 2.6; pose[t].ry = -0.5 + a * 1.0; }
      else if (style === 'overhead') { pose[ar].rx = -2.9 + a * 3.2; pose[al].rx = -2.9 + a * 3.2; pose[t].rx = -0.2 + a * 0.5; }
      else if (style === 'thrust') { pose[ar].rx = -1.5; pose[ar].z = swing * 0.3; pose[t].ry = -0.3 * swing; }
      else if (style === 'bow') { pose[al].rx = -1.55; pose[ar].rx = -1.55; pose[ar].rz = 0.25; pose[al].ry = 0; pose[t].ry = -0.2; }
      else if (style === 'cast') { pose[ar].rx = -1.7 * swing - 0.4; pose[al].rx = -1.0 * swing; }
      else if (style === 'stab') { pose[ar].rx = -1.4 * swing; pose[al].rx = -1.4 * (1 - swing); pose[t].ry = 0.3 * Math.sin(a * Math.PI * 2); }
      else if (style === 'slam') { pose[ar].rx = -2.6 + a * 2.8; pose[al].rx = -2.6 + a * 2.8; pose[t].rx = a * 0.4; }
      else if (style === 'spin') { pose[t].ry = a * Math.PI * 2; pose[ar].rz = -1.4; pose[al].rz = 1.4; }
    }
    if (st.aim) { pose[al].rx = -1.55; pose[ar].rx = -1.55; pose[ar].rz = 0.3; }
    if (st.air) { pose[ll].rx = -0.5; pose[lr].rx = 0.3; pose[al].rz = 0.4; pose[ar].rz = -0.4; }
    if (st.guard) { pose[ar].rx = -1.2; pose[ar].rz = 0.9; pose[al].rx = -1.0; }
  } else if (k === 'slime') {
    const sq = st.squash ?? 0;
    pose[0].sy = 1 + sq; pose[0].sx = pose[0].sz = 1 - sq * 0.5;
    pose[1].sy = pose[0].sy; pose[1].sx = pose[1].sz = pose[0].sx;
    pose[0].y = 0; pose[1].y = 0;
  } else if (k === 'bat') {
    const f = Math.sin(st.t * 18);
    pose[1].rz = f * 0.8; pose[2].rz = -f * 0.8;
    pose[0].y = Math.sin(st.t * 4) * 0.08;
  } else if (k === 'crab') {
    pose[0].y = Math.abs(Math.sin(ph * 2)) * 0.04 * mv;
    pose[0].rz = Math.sin(ph) * 0.06 * mv;
    const c = st.atk > 0 ? Math.sin(st.atk * Math.PI) : 0;
    pose[1].ry = -0.3 - c * 0.6; pose[2].ry = 0.3 + c * 0.6;
    pose[1].rx = -c * 0.6; pose[2].rx = -c * 0.6;
  } else if (k === 'bug') {
    pose[0].y = Math.abs(Math.sin(ph * 2)) * 0.05 * mv;
    pose[0].rx = st.atk > 0 ? -Math.sin(st.atk * Math.PI) * 0.4 : 0;
  } else if (k === 'puff') {
    const p = 1 + Math.sin(st.t * 3) * 0.06 + (st.wind || 0) * 0.35;
    pose[0].sx = pose[0].sz = p; pose[0].sy = 2 - p;
  } else if (k === 'slug') {
    for (let s = 0; s < 3; s++) { pose[s].x = Math.sin(ph + s * 1.2) * 0.12 * (0.3 + mv); pose[s].sy = 1 + Math.sin(ph * 2 + s) * 0.06; }
  } else if (k === 'wraith') {
    pose[0].y = Math.sin(st.t * 2) * 0.12;
    pose[0].rx = 0.15 * mv;
    pose[2].rx = -0.4 + Math.sin(st.t * 2.5) * 0.2 - (st.atk > 0 ? Math.sin(st.atk * Math.PI) * 1.2 : 0);
    pose[3].rx = -0.4 + Math.cos(st.t * 2.5) * 0.2 - (st.atk > 0 ? Math.sin(st.atk * Math.PI) * 1.2 : 0);
  } else if (k === 'sentry') {
    pose[1].y = Math.sin(st.t * 2) * 0.12;
    pose[1].ry = st.t * 1.5;
  }
}

// ---------------------------------------------------------------- RigMesh (single characters)
export class RigMesh {
  constructor(rig, { material = litMaterial(), tints = {} } = {}) {
    this.rig = rig;
    this.root = new THREE.Group();
    this.parts = [];
    this.geos = [];
    this.pose = makePose(rig.parts.length);
    for (const p of rig.parts) {
      const grp = new THREE.Group();
      grp.position.set(...p.pivot);
      const boxes = p.tint && tints[p.tint] ? p.boxes.map((b) => (b[6] === W ? [...b.slice(0, 6), tints[p.tint]] : b)) : p.boxes;
      const geo = boxesGeometry(boxes);
      this.geos.push(geo);
      const mesh = new THREE.Mesh(geo, p.unlit ? unlitMaterial() : material);
      mesh.castShadow = true;
      grp.add(mesh);
      grp.userData.base = new THREE.Vector3(...p.pivot);
      (p.parent >= 0 ? this.parts[p.parent].group : this.root).add(grp);
      this.parts.push({ def: p, group: grp, mesh });
    }
    if (rig.scale) this.root.scale.setScalar(rig.scale);
  }
  attach(partName, object) { this.parts.find((p) => p.def.name === partName)?.group.add(object); }
  applyPose() {
    this.pose.forEach((ps, i) => {
      const g = this.parts[i].group;
      g.position.copy(g.userData.base).add({ x: ps.x, y: ps.y, z: ps.z });
      g.rotation.set(ps.rx, ps.ry, ps.rz);
      g.scale.set(ps.sx, ps.sy, ps.sz);
    });
  }
  setFlash(k) {
    for (const p of this.parts) {
      const m = p.mesh.material;
      if (k > 0 && !p.flashMat) { p.flashMat = m.clone(); p.flashMat.emissive?.setRGB(1, 1, 1); }
      p.mesh.material = k > 0 && p.flashMat ? p.flashMat : (p.def.unlit ? unlitMaterial() : this.baseMaterial || m);
      if (k > 0 && p.flashMat?.emissive) p.flashMat.emissiveIntensity = k * 0.8;
    }
  }
  dispose() { this.root.parent?.remove(this.root); for (const g of this.geos) g.dispose(); for (const p of this.parts) p.flashMat?.dispose(); }
}

// ---------------------------------------------------------------- RigInstancer (crowds)
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class RigInstancer {
  constructor(rig, capacity, scene) {
    this.rig = rig;
    this.capacity = capacity;
    this.meshes = rig.parts.map((p) => {
      const mesh = new THREE.InstancedMesh(boxesGeometry(p.boxes), litMaterial(), capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      for (let i = 0; i < capacity; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
      scene.add(mesh);
      return mesh;
    });
    this.free = Array.from({ length: capacity }, (_, i) => capacity - 1 - i);
    this.world = rig.parts.map(() => new THREE.Matrix4());
  }
  acquire() { return this.free.length ? this.free.pop() : -1; }
  release(slot) {
    if (slot < 0) return;
    for (const m of this.meshes) { m.setMatrixAt(slot, ZERO); m.instanceMatrix.needsUpdate = true; }
    this.free.push(slot);
  }
  // tints: { a, b, c } colours; flash: 0..1 (white); frost: tint override.
  write(slot, x, y, z, yaw, scale, pose, tints, flash = 0, alpha = 1) {
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(scale, scale, scale));
    const parts = this.rig.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], ps = pose[i];
      _l.compose(_v.set(p.pivot[0] + ps.x, p.pivot[1] + ps.y, p.pivot[2] + ps.z), _q.setFromEuler(_e.set(ps.rx, ps.ry, ps.rz)), _s.set(ps.sx, ps.sy, ps.sz));
      this.world[i].multiplyMatrices(p.parent >= 0 ? this.world[p.parent] : _m, _l);
      const mesh = this.meshes[i];
      mesh.setMatrixAt(slot, alpha <= 0 ? ZERO : this.world[i]);
      const tint = p.tint && tints[p.tint];
      if (tint) _c.set(tint); else _c.setRGB(1, 1, 1);
      if (flash > 0) _c.lerp(WHITE_HOT, flash);
      mesh.setColorAt(slot, _c);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }
  dispose() { for (const m of this.meshes) { m.parent?.remove(m); m.geometry.dispose(); m.dispose(); } }
}
const WHITE_HOT = new THREE.Color(3, 3, 3);
