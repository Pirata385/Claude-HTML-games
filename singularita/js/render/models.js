// Player outfits and weapons by class and material, boss rigs, Lume and the Stardust Astral.
import * as THREE from 'three';
import { RigMesh, RIGS } from './rigs.js';
import { boxesGeometry, unlitMaterial, glowMaterial } from './voxel.js';
import { MATERIALS } from '../data/materials.js';
import { makeRng } from '../core/rng.js';

const B = (x, y, z, w, h, d, c) => [x, y, z, w, h, d, c];
const W = '#ffffff';

const OUTFIT = {
  swordsman: { cloth: '#b8433a', legs: '#4a3a34', skin: '#e8c4a0', hair: '#4a2e1e', extra: (m) => [B(0, 0.62, -0.2, 0.66, 0.2, 0.06, m), B(0.36, 0.7, 0, 0.18, 0.18, 0.4, m), B(-0.36, 0.7, 0, 0.18, 0.18, 0.4, m)] },
  archer: { cloth: '#4f8a4a', legs: '#5a4630', skin: '#d9b08a', hair: '#7a4a24', extra: (m) => [B(0.2, 0.3, -0.22, 0.2, 0.7, 0.14, '#7a5232'), B(0, 0.1, 0, 0.66, 0.1, 0.4, m)] },
  mage: { cloth: '#4a52a8', legs: '#3a3a6a', skin: '#ecd0b0', hair: '#d8d8e8', extra: (m) => [B(0, -0.1, 0, 0.7, 0.3, 0.42, '#4a52a8'), B(0, 0.4, 0.19, 0.12, 0.6, 0.02, m)] },
  assassin: { cloth: '#2e2a3a', legs: '#24202e', skin: '#c99a7a', hair: '#141018', extra: (m) => [B(0, 0.05, 0, 0.66, 0.08, 0.4, m), B(0, 0.75, -0.18, 0.5, 0.3, 0.06, '#2e2a3a')] },
  stardust: { cloth: '#3a2a5a', legs: '#2a2040', skin: '#e0c0e8', hair: '#f0e8ff', extra: (m) => [B(0, 0.4, -0.2, 0.7, 0.9, 0.06, '#5a3a8a'), B(0.2, 0.55, -0.24, 0.06, 0.06, 0.02, '#ffffff'), B(-0.15, 0.3, -0.24, 0.06, 0.06, 0.02, '#ffffff'), B(0, 0.62, 0.19, 0.14, 0.14, 0.02, m)] },
};
const HEADGEAR = {
  swordsman: (m) => [B(0, 0.5, 0, 0.54, 0.14, 0.54, m), B(0, 0.38, -0.25, 0.52, 0.3, 0.06, m)],
  archer: (hair) => [B(0, 0.5, -0.04, 0.54, 0.12, 0.54, '#4f8a4a'), B(0, 0.3, -0.27, 0.5, 0.36, 0.06, '#4f8a4a'), B(0, 0.44, 0.2, 0.5, 0.06, 0.12, hair)],
  mage: (m) => [B(0, 0.52, 0, 0.62, 0.08, 0.62, '#3a3a8a'), B(0, 0.7, 0, 0.36, 0.3, 0.36, '#3a3a8a'), B(0.04, 0.92, -0.04, 0.18, 0.2, 0.18, '#3a3a8a'), B(0, 0.6, 0.19, 0.1, 0.08, 0.02, m)],
  assassin: () => [B(0, 0.42, -0.02, 0.54, 0.24, 0.54, '#2e2a3a'), B(0, 0.12, 0.25, 0.5, 0.16, 0.04, '#2e2a3a')],
  stardust: (m) => [B(0, 0.52, 0, 0.5, 0.1, 0.5, '#f0e8ff'), B(0, 0.7, 0, 0.12, 0.2, 0.12, m), B(0.22, 0.62, 0, 0.08, 0.14, 0.08, m), B(-0.22, 0.62, 0, 0.08, 0.14, 0.08, m)],
};

function weaponBoxes(cls, matColor) {
  const grip = '#4a3420', m = matColor;
  switch (cls) {
    case 'swordsman': return [B(0, 0, 0.05, 0.08, 0.26, 0.08, grip), B(0, 0.15, 0.05, 0.34, 0.08, 0.1, '#d9b24c'), B(0, 0.75, 0.05, 0.12, 1.1, 0.05, m), B(0, 1.34, 0.05, 0.08, 0.1, 0.04, m)];
    case 'archer': return [B(0, 0, 0.08, 0.07, 0.3, 0.07, grip), B(0, 0.38, 0.0, 0.07, 0.5, 0.07, m), B(0, -0.38, 0.0, 0.07, 0.5, 0.07, m), B(0, 0.7, -0.1, 0.07, 0.22, 0.07, m), B(0, -0.7, -0.1, 0.07, 0.22, 0.07, m), B(0, 0, -0.18, 0.02, 1.5, 0.02, '#f0ece0')];
    case 'mage': return [B(0, 0.3, 0.05, 0.08, 1.7, 0.08, '#6b4a2e'), B(0, 1.25, 0.05, 0.24, 0.12, 0.24, '#d9b24c'), B(0, 1.42, 0.05, 0.22, 0.26, 0.22, m)];
    case 'assassin': return [B(0, 0, 0.05, 0.07, 0.18, 0.07, grip), B(0, 0.1, 0.05, 0.2, 0.05, 0.07, '#5a5a62'), B(0, 0.38, 0.05, 0.07, 0.5, 0.03, m)];
    case 'stardust': return [B(0, 0.05, 0.12, 0.18, 0.18, 0.18, m), B(0, 0.05, 0.12, 0.3, 0.04, 0.04, '#f0e8ff'), B(0, 0.05, 0.12, 0.04, 0.3, 0.04, '#f0e8ff')];
    default: return [];
  }
}

// Builds the player's rig for a class, coloured by the equipped weapon and armour materials.
export function buildPlayerRig(cls, weaponMat, armorMat) {
  const o = OUTFIT[cls];
  const armor = armorMat ? MATERIALS[armorMat].color : o.cloth;
  const mat = weaponMat ? MATERIALS[weaponMat].color : '#9a6a3c';
  const head = cls === 'swordsman' || cls === 'mage' || cls === 'stardust' ? HEADGEAR[cls](armor) : HEADGEAR[cls](o.hair);
  const rig = {
    kind: 'humanoid',
    parts: [
      { name: 'torso', parent: -1, pivot: [0, 0.95, 0], boxes: [B(0, 0.38, 0, 0.62, 0.76, 0.36, o.cloth), ...o.extra(armor)] },
      { name: 'head', parent: 0, pivot: [0, 0.78, 0], boxes: [B(0, 0.24, 0, 0.48, 0.48, 0.48, o.skin), B(0.11, 0.26, 0.245, 0.08, 0.1, 0.02, '#141018'), B(-0.11, 0.26, 0.245, 0.08, 0.1, 0.02, '#141018'), B(0, 0.45, -0.05, 0.5, 0.1, 0.42, o.hair), ...head] },
      { name: 'armL', parent: 0, pivot: [0.42, 0.68, 0], boxes: [B(0, -0.29, 0, 0.2, 0.66, 0.22, o.cloth), B(0, -0.56, 0, 0.18, 0.14, 0.2, o.skin), B(0, -0.05, 0, 0.24, 0.2, 0.26, armor)] },
      { name: 'armR', parent: 0, pivot: [-0.42, 0.68, 0], boxes: [B(0, -0.29, 0, 0.2, 0.66, 0.22, o.cloth), B(0, -0.56, 0, 0.18, 0.14, 0.2, o.skin), B(0, -0.05, 0, 0.24, 0.2, 0.26, armor)] },
      { name: 'legL', parent: -1, pivot: [0.16, 0.95, 0], boxes: [B(0, -0.45, 0, 0.24, 0.9, 0.26, o.legs), B(0, -0.82, 0.04, 0.26, 0.16, 0.32, '#3a2a20')] },
      { name: 'legR', parent: -1, pivot: [-0.16, 0.95, 0], boxes: [B(0, -0.45, 0, 0.24, 0.9, 0.26, o.legs), B(0, -0.82, 0.04, 0.26, 0.16, 0.32, '#3a2a20')] },
      { name: 'weapon', parent: 3, pivot: [0, -0.62, 0.04], boxes: weaponBoxes(cls, mat) },
    ],
  };
  if (cls === 'assassin') rig.parts.push({ name: 'weapon2', parent: 2, pivot: [0, -0.62, 0.04], boxes: weaponBoxes(cls, mat) });
  if (cls === 'archer') rig.parts[6].pivot = [0, -0.58, 0.02];
  // Rotate weapons so blades point forward-up from the fist.
  const rm = new RigMesh(rig);
  for (const p of rm.parts) if (p.def.name.startsWith('weapon')) {
    p.mesh.rotation.x = cls === 'archer' ? 0 : cls === 'mage' ? 0.2 : Math.PI / 2;
    if (cls === 'archer') p.mesh.rotation.y = Math.PI / 2;
  }
  return rm;
}

// Bosses.
export function buildPrinceRig() {
  const rig = RIGS.slime();
  rig.parts.push({ name: 'crown', parent: 0, pivot: [0, 0.92, 0], boxes: [B(0, 0.1, 0, 0.62, 0.2, 0.62, '#ffcf3a'), B(0.24, 0.3, 0.24, 0.12, 0.24, 0.12, '#ffcf3a'), B(-0.24, 0.3, 0.24, 0.12, 0.24, 0.12, '#ffcf3a'), B(0.24, 0.3, -0.24, 0.12, 0.24, 0.12, '#ffcf3a'), B(-0.24, 0.3, -0.24, 0.12, 0.24, 0.12, '#ffcf3a'), B(0, 0.14, 0.32, 0.12, 0.12, 0.02, '#ff4d5e')] });
  rig.parts.push({ name: 'cape', parent: 0, pivot: [0, 0.75, -0.48], boxes: [B(0, -0.3, -0.03, 0.9, 0.6, 0.06, '#8a2a4a'), B(0, 0.02, 0, 0.94, 0.08, 0.1, '#f0ece0')] });
  return new RigMesh(rig, { tints: { a: '#ffd166' } });
}

export function buildSilverbackRig() {
  const fur = '#c9ced8', dark = '#5a6070', skin = '#7a8a6a';
  const rig = {
    kind: 'humanoid',
    parts: [
      { name: 'torso', parent: -1, pivot: [0, 1.3, 0], boxes: [B(0, 0.6, 0, 1.7, 1.3, 1.1, fur), B(0, 0.4, 0.5, 1.1, 0.8, 0.2, dark), B(0, 1.2, -0.2, 1.4, 0.4, 0.8, fur)] },
      { name: 'head', parent: 0, pivot: [0, 1.25, 0.35], boxes: [B(0, 0.3, 0, 0.8, 0.7, 0.7, fur), B(0, 0.22, 0.36, 0.56, 0.4, 0.06, skin), B(0.16, 0.36, 0.4, 0.1, 0.08, 0.02, '#ff4a3a'), B(-0.16, 0.36, 0.4, 0.1, 0.08, 0.02, '#ff4a3a'), B(0, 0.7, -0.05, 0.9, 0.12, 0.8, '#ffcf3a')] },
      { name: 'armL', parent: 0, pivot: [1.0, 1.05, 0.1], boxes: [B(0, -0.75, 0, 0.55, 1.5, 0.6, fur), B(0, -1.55, 0.05, 0.62, 0.36, 0.7, dark), B(0, -0.55, 0.32, 0.2, 0.14, 0.02, '#ffcf3a')] },
      { name: 'armR', parent: 0, pivot: [-1.0, 1.05, 0.1], boxes: [B(0, -0.75, 0, 0.55, 1.5, 0.6, fur), B(0, -1.55, 0.05, 0.62, 0.36, 0.7, dark)] },
      { name: 'legL', parent: -1, pivot: [0.45, 1.3, -0.1], boxes: [B(0, -0.65, 0, 0.55, 1.3, 0.6, fur), B(0, -1.25, 0.1, 0.6, 0.2, 0.8, dark)] },
      { name: 'legR', parent: -1, pivot: [-0.45, 1.3, -0.1], boxes: [B(0, -0.65, 0, 0.55, 1.3, 0.6, fur), B(0, -1.25, 0.1, 0.6, 0.2, 0.8, dark)] },
    ],
  };
  return new RigMesh(rig);
}

export function buildLumeRig() {
  const brass = '#c9a24c', dark = '#5a4a2a';
  const rig = {
    kind: 'humanoid',
    parts: [
      { name: 'torso', parent: -1, pivot: [0, 0.7, 0], boxes: [B(0, 0.35, 0, 0.6, 0.7, 0.45, brass), B(0, 0.38, 0.23, 0.3, 0.3, 0.02, '#ffe9a0'), B(0, -0.1, 0, 0.3, 0.3, 0.3, dark)] },
      { name: 'head', parent: 0, pivot: [0, 0.72, 0], boxes: [B(0, 0.22, 0, 0.5, 0.4, 0.44, brass), B(0, 0.24, 0.23, 0.2, 0.14, 0.02, '#9ff0ff'), B(0, 0.5, 0, 0.06, 0.2, 0.06, dark), B(0, 0.62, 0, 0.12, 0.12, 0.12, '#ffe9a0')] },
      { name: 'armL', parent: 0, pivot: [0.38, 0.6, 0], boxes: [B(0, -0.25, 0, 0.16, 0.5, 0.16, dark), B(0, -0.52, 0, 0.2, 0.14, 0.2, brass)] },
      { name: 'armR', parent: 0, pivot: [-0.38, 0.6, 0], boxes: [B(0, -0.25, 0, 0.16, 0.5, 0.16, dark), B(0, -0.52, 0, 0.2, 0.14, 0.2, brass)] },
    ],
  };
  return new RigMesh(rig);
}

// The Astral: a constellation figure unique to each character seed. Stars are generated
// from the seed on a humanoid frame and joined by faint lines.
export function buildAstral(seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const hue = rng.range(0.62, 0.88);
  const col = new THREE.Color().setHSL(hue, 0.85, 0.72);
  const frame = [[0, 2.1], [0, 1.6], [0.5, 1.45], [-0.5, 1.45], [0.75, 1.0], [-0.75, 1.0], [0, 1.0], [0.25, 0.4], [-0.25, 0.4], [0.3, -0.1], [-0.3, -0.1]];
  const stars = frame.map(([x, y]) => [x + rng.range(-0.12, 0.12), y + rng.range(-0.1, 0.1), rng.range(-0.15, 0.15)]);
  for (let i = 0; i < 6; i++) stars.push([rng.range(-0.9, 0.9), rng.range(0.2, 2.3), rng.range(-0.3, 0.3)]);
  const boxes = stars.map(([x, y, z], i) => B(x, y, z, i < 2 ? 0.22 : 0.13, i < 2 ? 0.22 : 0.13, i < 2 ? 0.22 : 0.13, '#' + col.getHexString()));
  boxes.push(B(0.08, 2.12, 0.12, 0.05, 0.05, 0.02, '#ffffff'), B(-0.08, 2.12, 0.12, 0.05, 0.05, 0.02, '#ffffff'));
  const starGeo = boxesGeometry(boxes);
  group.add(new THREE.Mesh(starGeo, unlitMaterial()));
  const links = [[0, 1], [1, 2], [1, 3], [2, 4], [3, 5], [1, 6], [6, 7], [6, 8], [7, 9], [8, 10]];
  const pts = [];
  for (const [a, b] of links) pts.push(...stars[a], ...stars[b]);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.6 });
  group.add(new THREE.LineSegments(lineGeo, lineMat));
  // A soft body of light.
  const auraGeo = boxesGeometry([B(0, 1.15, 0, 1.0, 2.1, 0.5, '#' + col.clone().multiplyScalar(0.35).getHexString())]);
  const aura = new THREE.Mesh(auraGeo, glowMaterial());
  group.add(aura);
  return { group, color: col, dispose() { starGeo.dispose(); lineGeo.dispose(); lineMat.dispose(); auraGeo.dispose(); group.parent?.remove(group); } };
}
