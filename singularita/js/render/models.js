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
  assassin: { cloth: '#4a3f63', legs: '#352e48', skin: '#d4a882', hair: '#1e1826', extra: (m) => [B(0, 0.05, 0, 0.66, 0.08, 0.4, m), B(0, 0.75, -0.18, 0.5, 0.3, 0.06, '#2e2a3a')] },
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

// The isle guardians.
export function buildRoninRig() {
  const robe = '#2a3a6a', sash = '#e8e2d0', skin = '#e0c0a0', straw = '#d8b870', steel = '#d8dde6';
  const rig = {
    kind: 'humanoid', scale: 1.25,
    parts: [
      { name: 'torso', parent: -1, pivot: [0, 0.95, 0], boxes: [B(0, 0.38, 0, 0.64, 0.76, 0.38, robe), B(0, 0.08, 0, 0.68, 0.14, 0.42, sash), B(0.18, 0.5, 0.2, 0.08, 0.5, 0.02, sash), B(0, 0.1, -0.24, 0.12, 0.6, 0.06, '#c8443a')] },
      { name: 'head', parent: 0, pivot: [0, 0.78, 0], boxes: [B(0, 0.22, 0, 0.44, 0.44, 0.44, skin), B(0.1, 0.24, 0.23, 0.08, 0.04, 0.02, '#141018'), B(-0.1, 0.24, 0.23, 0.08, 0.04, 0.02, '#141018'),
        B(0, 0.5, 0, 1.3, 0.08, 1.3, straw), B(0, 0.6, 0, 0.8, 0.14, 0.8, straw), B(0, 0.7, 0, 0.36, 0.1, 0.36, straw)] },
      { name: 'armL', parent: 0, pivot: [0.44, 0.68, 0], boxes: [B(0, -0.3, 0, 0.26, 0.66, 0.28, robe), B(0, -0.66, 0, 0.18, 0.12, 0.18, skin)] },
      { name: 'armR', parent: 0, pivot: [-0.44, 0.68, 0], boxes: [B(0, -0.3, 0, 0.26, 0.66, 0.28, robe), B(0, -0.66, 0, 0.18, 0.12, 0.18, skin), B(0, -0.72, 0.65, 0.06, 0.08, 1.3, steel), B(0, -0.72, -0.02, 0.14, 0.12, 0.3, '#2a2a2a')] },
      { name: 'legL', parent: -1, pivot: [0.17, 0.95, 0], boxes: [B(0, -0.45, 0, 0.3, 0.9, 0.34, '#1e2a4a')] },
      { name: 'legR', parent: -1, pivot: [-0.17, 0.95, 0], boxes: [B(0, -0.45, 0, 0.3, 0.9, 0.34, '#1e2a4a')] },
    ],
  };
  return new RigMesh(rig);
}

export function buildTearRig(k = 0) {
  const water = ['#7fe0ff', '#5fc8f0', '#9fe8ff'][k % 3];
  const rig = RIGS.wraith();
  for (const p of rig.parts) p.boxes = p.boxes.map((bx) => (bx[6] === W ? [...bx.slice(0, 6), water] : bx));
  rig.parts[1].boxes.push(B(0, 0.62, 0, 0.5, 0.12, 0.5, '#e8f8ff'), B(0.18, 0.75, 0, 0.08, 0.16, 0.08, '#e8f8ff'), B(-0.18, 0.75, 0, 0.08, 0.16, 0.08, '#e8f8ff'), B(0.1, 0.12, 0.24, 0.04, 0.12, 0.02, '#e8f8ff'));
  rig.scale = 1.3;
  return new RigMesh(rig);
}

export function buildVectorRig() {
  const rig = {
    kind: 'wisp', scale: 1.6,
    parts: [
      { name: 'core', parent: -1, pivot: [0, 1.6, 0], unlit: true, boxes: [B(0, 0, 0, 0.9, 0.9, 0.9, '#ffb347'), B(0, 0, 0, 0.5, 0.5, 1.4, '#ffe0a0'), B(0, 0, 0.75, 0.2, 0.2, 0.3, '#ffffff')] },
      { name: 'shell', parent: 0, pivot: [0, 0, 0], boxes: [B(0.75, 0, 0, 0.3, 0.9, 0.9, '#2e2a2e'), B(-0.75, 0, 0, 0.3, 0.9, 0.9, '#2e2a2e'), B(0, 0.75, 0, 0.9, 0.3, 0.9, '#3a3236'), B(0, -0.75, 0, 0.9, 0.3, 0.9, '#3a3236'),
        B(0, 0, -0.9, 0.5, 0.5, 0.4, '#2e2a2e'), B(0.6, 0.6, -0.6, 0.2, 0.2, 0.6, '#ff6a1a'), B(-0.6, -0.6, -0.6, 0.2, 0.2, 0.6, '#ff6a1a')] },
    ],
  };
  return new RigMesh(rig);
}

export function buildAlleleRig() {
  const stone = '#7a7068', moss = '#6a9a4a';
  const rig = {
    kind: 'humanoid', scale: 1.6,
    parts: [
      { name: 'torso', parent: -1, pivot: [0, 1.0, 0], boxes: [B(0, 0.45, 0, 1.1, 0.95, 0.75, stone), B(0.3, 1.0, -0.1, 0.4, 0.3, 0.4, moss), B(-0.35, 0.95, 0.1, 0.3, 0.2, 0.5, moss), B(0, 0.5, -0.4, 0.6, 0.6, 0.06, '#c8f0a0')] },
      { name: 'head', parent: 0, pivot: [0, 0.95, 0.1], boxes: [B(0, 0.2, 0, 0.55, 0.45, 0.5, '#6a6058'), B(0, 0.22, 0.26, 0.36, 0.08, 0.02, '#c8f0a0'), B(0, 0.5, -0.05, 0.6, 0.12, 0.5, moss)] },
      { name: 'armL', parent: 0, pivot: [0.75, 0.8, 0], boxes: [B(0, -0.45, 0, 0.44, 0.9, 0.44, stone), B(0, -0.98, 0, 0.55, 0.32, 0.55, '#5a5048'), B(0.1, -0.3, 0.2, 0.2, 0.3, 0.1, moss)] },
      { name: 'armR', parent: 0, pivot: [-0.75, 0.8, 0], boxes: [B(0, -0.45, 0, 0.44, 0.9, 0.44, stone), B(0, -0.98, 0, 0.55, 0.32, 0.55, '#5a5048')] },
      { name: 'legL', parent: -1, pivot: [0.28, 1.0, 0], boxes: [B(0, -0.5, 0, 0.42, 1.0, 0.46, '#6a6058')] },
      { name: 'legR', parent: -1, pivot: [-0.28, 1.0, 0], boxes: [B(0, -0.5, 0, 0.42, 1.0, 0.46, '#6a6058')] },
    ],
  };
  const r = new RigMesh(rig);
  // The allele crystal on its chest shows which gene is expressed.
  r.crystal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.12), new THREE.MeshBasicMaterial({ color: 0xc8f0a0 }));
  r.crystal.position.set(0, 0.5, 0.4);
  r.attach('torso', r.crystal);
  const base = r.dispose.bind(r);
  r.dispose = () => { base(); r.crystal.geometry.dispose(); r.crystal.material.dispose(); };
  return r;
}

// The rulers of the dimensions.
export function buildJailerRig() {
  const iron = '#5a5a66', dark = '#2e2e36', cloth = '#3a2a22';
  const rig = {
    kind: 'humanoid', scale: 1.7,
    parts: [
      { name: 'torso', parent: -1, pivot: [0, 1.0, 0], boxes: [B(0, 0.42, 0, 0.9, 0.84, 0.55, iron), B(0, 0.05, 0, 0.95, 0.2, 0.6, cloth), B(0.42, 0.1, 0.32, 0.3, 0.3, 0.06, '#ffcf6a'), B(0.5, -0.05, 0.32, 0.2, 0.2, 0.06, '#ffcf6a')] },
      { name: 'head', parent: 0, pivot: [0, 0.84, 0], boxes: [B(0, 0.24, 0, 0.5, 0.5, 0.5, dark), B(0, 0.28, 0.26, 0.4, 0.06, 0.02, '#ff6a3a'), B(0, 0.52, 0, 0.56, 0.1, 0.56, iron)] },
      { name: 'armL', parent: 0, pivot: [0.6, 0.72, 0], boxes: [B(0, -0.32, 0, 0.26, 0.7, 0.3, iron), B(0, -0.72, 0, 0.22, 0.14, 0.22, dark)] },
      // The iron hand: a fist as big as a head.
      { name: 'armR', parent: 0, pivot: [-0.62, 0.72, 0], boxes: [B(0, -0.3, 0, 0.34, 0.7, 0.36, iron), B(0, -0.88, 0.05, 0.72, 0.62, 0.72, '#8a8a96'), B(0, -0.6, 0.05, 0.5, 0.1, 0.5, dark)] },
      { name: 'legL', parent: -1, pivot: [0.22, 1.0, 0], boxes: [B(0, -0.5, 0, 0.32, 1.0, 0.36, dark)] },
      { name: 'legR', parent: -1, pivot: [-0.22, 1.0, 0], boxes: [B(0, -0.5, 0, 0.32, 1.0, 0.36, dark)] },
    ],
  };
  return new RigMesh(rig);
}

// element: 'fire' or 'ice' for a twin; 'united' for the two merged, crowned with both gems.
export function buildSiameseRig(element) {
  const color = { fire: '#ff7a5a', ice: '#7ab8ff', united: '#c890e0' }[element];
  const rig = RIGS.slime();
  const gems = element === 'united' ? [B(0.24, 0.32, 0, 0.14, 0.3, 0.14, '#ff4a3a'), B(-0.24, 0.32, 0, 0.14, 0.3, 0.14, '#9fe0ff')]
    : [B(element === 'fire' ? 0.24 : -0.24, 0.32, 0, 0.14, 0.3, 0.14, element === 'fire' ? '#ff4a3a' : '#9fe0ff')];
  rig.parts.push({ name: 'crown', parent: 0, pivot: [0, 0.92, 0], boxes: [B(0, 0.1, 0, 0.62, 0.2, 0.62, '#ffcf3a'), ...gems, B(0, 0.3, 0.24, 0.12, 0.26, 0.12, '#ffcf3a')] });
  return new RigMesh(rig, { tints: { a: color } });
}

export function buildAdamiteKingRig() {
  const robe = '#3a1a5a', crystal = '#b46aff', gold = '#ffcf6a';
  const rig = {
    kind: 'humanoid', scale: 1.6,
    parts: [
      { name: 'torso', parent: -1, pivot: [0, 0.95, 0], boxes: [B(0, 0.38, 0, 0.7, 0.8, 0.42, robe), B(0, 0.1, -0.3, 0.9, 1.0, 0.08, '#5a2a8a'), B(0.42, 0.78, 0, 0.26, 0.4, 0.26, crystal), B(-0.4, 0.72, 0.05, 0.22, 0.5, 0.22, crystal), B(0, 0.5, 0.22, 0.14, 0.4, 0.02, gold)] },
      { name: 'head', parent: 0, pivot: [0, 0.8, 0], boxes: [B(0, 0.22, 0, 0.44, 0.44, 0.44, '#c8b8d8'), B(0.1, 0.24, 0.23, 0.08, 0.06, 0.02, '#e8a8ff'), B(-0.1, 0.24, 0.23, 0.08, 0.06, 0.02, '#e8a8ff'),
        B(0, 0.5, 0, 0.52, 0.12, 0.52, gold), B(0.2, 0.72, 0.2, 0.1, 0.4, 0.1, crystal), B(-0.2, 0.75, 0.2, 0.1, 0.46, 0.1, crystal), B(0.2, 0.7, -0.2, 0.1, 0.36, 0.1, crystal), B(-0.2, 0.78, -0.2, 0.1, 0.5, 0.1, crystal), B(0, 0.85, 0, 0.12, 0.6, 0.12, '#e8c8ff')] },
      { name: 'armL', parent: 0, pivot: [0.45, 0.68, 0], boxes: [B(0, -0.32, 0, 0.22, 0.68, 0.24, robe)] },
      { name: 'armR', parent: 0, pivot: [-0.45, 0.68, 0], boxes: [B(0, -0.32, 0, 0.22, 0.68, 0.24, robe), B(0, -0.7, 0.75, 0.1, 0.16, 1.4, crystal), B(0, -0.72, 0.02, 0.3, 0.1, 0.1, gold)] },
      { name: 'legL', parent: -1, pivot: [0.17, 0.95, 0], boxes: [B(0, -0.45, 0, 0.26, 0.9, 0.3, robe)] },
      { name: 'legR', parent: -1, pivot: [-0.17, 0.95, 0], boxes: [B(0, -0.45, 0, 0.26, 0.9, 0.3, robe)] },
    ],
  };
  return new RigMesh(rig);
}

// The one in the glass: your own shape, in dark mirror-glass.
export function buildMirrorRig(cls, weaponMat, armorMat) {
  const r = buildPlayerRig(cls, weaponMat, armorMat);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x8aa8c8, emissive: 0x101828 });
  r.root.traverse((o) => { if (o.isMesh) { o.material = mat; o.userData.baseMat = mat; } });
  const base = r.dispose.bind(r);
  r.dispose = () => { base(); mat.dispose(); };
  return r;
}

export function buildRagnarokRig() {
  const scale = '#a83a1a', belly = '#e8a060', horn = '#e8d8c0', dark = '#5a1a0a';
  const rig = {
    kind: 'bat', scale: 3.0,
    parts: [
      { name: 'body', parent: -1, pivot: [0, 0.9, 0], boxes: [B(0, 0, 0, 0.9, 0.7, 1.6, scale), B(0, -0.3, 0.1, 0.7, 0.2, 1.2, belly), B(0, 0.42, -0.2, 0.2, 0.2, 1.2, dark),
        B(0.3, -0.6, 0.5, 0.22, 0.6, 0.22, scale), B(-0.3, -0.6, 0.5, 0.22, 0.6, 0.22, scale), B(0.3, -0.6, -0.5, 0.22, 0.6, 0.22, scale), B(-0.3, -0.6, -0.5, 0.22, 0.6, 0.22, scale)] },
      { name: 'wingL', parent: 0, pivot: [0.45, 0.3, 0], boxes: [B(1.2, 0, 0, 2.4, 0.06, 1.3, '#8a2a1a'), B(1.2, 0.05, 0.55, 2.4, 0.1, 0.12, dark)] },
      { name: 'wingR', parent: 0, pivot: [-0.45, 0.3, 0], boxes: [B(-1.2, 0, 0, 2.4, 0.06, 1.3, '#8a2a1a'), B(-1.2, 0.05, 0.55, 2.4, 0.1, 0.12, dark)] },
      { name: 'neck', parent: 0, pivot: [0, 0.25, 0.75], boxes: [B(0, 0.25, 0.25, 0.36, 0.36, 0.6, scale), B(0, 0.5, 0.65, 0.5, 0.42, 0.62, scale), B(0, 0.38, 1.02, 0.36, 0.22, 0.3, dark),
        B(0.14, 0.62, 0.86, 0.08, 0.08, 0.02, '#ffe066'), B(-0.14, 0.62, 0.86, 0.08, 0.08, 0.02, '#ffe066'), B(0.18, 0.8, 0.45, 0.08, 0.36, 0.08, horn), B(-0.18, 0.8, 0.45, 0.08, 0.36, 0.08, horn)] },
      { name: 'tail', parent: 0, pivot: [0, 0, -0.8], boxes: [B(0, 0, -0.45, 0.4, 0.34, 0.9, scale), B(0, -0.05, -1.1, 0.26, 0.22, 0.6, scale), B(0, 0, -1.5, 0.4, 0.06, 0.3, dark)] },
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
// The Stardust's Astral: a stand. A floating warrior of starlight, crested helm and glowing eyes,
// broad plated shoulders and heavy fists, its body thinning to a wisp. Constellation stars mark it.
// The arms are their own groups, pivoting at the shoulder, so its fists can fly.
export function buildAstral(seed) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const hue = rng.range(0.62, 0.88);
  const col = new THREE.Color().setHSL(hue, 0.85, 0.72);
  const hex = (h, s, l) => '#' + new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l).getHexString();
  const body = hex(hue, 0.7, 0.62), plate = hex(hue + 0.06, 0.55, 0.4), dark = hex(hue, 0.5, 0.16), wisp = hex(hue, 0.8, 0.45), gold = '#ffd166';
  const torso = [
    // A wisp instead of legs.
    B(0, 0.42, -0.1, 0.12, 0.18, 0.1, wisp), B(0, 0.6, -0.06, 0.22, 0.2, 0.16, wisp), B(0, 0.8, -0.02, 0.32, 0.22, 0.22, body),
    B(0, 1.02, 0, 0.42, 0.24, 0.26, dark), B(0, 1.26, 0, 0.5, 0.3, 0.3, body),
    B(0, 1.6, 0, 0.78, 0.46, 0.4, body), B(0, 1.62, 0.21, 0.5, 0.32, 0.04, plate), B(0, 1.64, 0.235, 0.12, 0.12, 0.02, '#ffffff'),
    B(0.52, 1.84, 0, 0.36, 0.22, 0.44, plate), B(-0.52, 1.84, 0, 0.36, 0.22, 0.44, plate),
    B(0, 1.9, 0, 0.18, 0.12, 0.18, body),
    // The helm: a visor, two eyes, a crest and fins.
    B(0, 2.08, 0, 0.36, 0.34, 0.36, body), B(0, 2.08, 0.185, 0.28, 0.12, 0.02, dark),
    B(0.075, 2.09, 0.2, 0.06, 0.04, 0.02, '#ffffff'), B(-0.075, 2.09, 0.2, 0.06, 0.04, 0.02, '#ffffff'),
    B(0, 2.33, -0.02, 0.08, 0.2, 0.38, gold), B(0.2, 2.16, -0.05, 0.04, 0.18, 0.2, plate), B(-0.2, 2.16, -0.05, 0.04, 0.18, 0.2, plate),
  ];
  // Constellation stars across the chest and shoulders, different for every Starbearer.
  const stars = [[0, 1.64], [0.3, 1.78], [-0.3, 1.78], [0.18, 1.42], [-0.18, 1.42], [0, 1.22]].map(([x, y]) => [x + rng.range(-0.05, 0.05), y + rng.range(-0.05, 0.05), 0.22]);
  for (const [x, y, z] of stars) torso.push(B(x, y, z, 0.07, 0.07, 0.02, '#ffffff'));
  const torsoGeo = boxesGeometry(torso);
  const mat = unlitMaterial();
  group.add(new THREE.Mesh(torsoGeo, mat));
  const links = [[0, 1], [0, 2], [0, 3], [0, 4], [3, 5], [4, 5]];
  const pts = [];
  for (const [a, b] of links) pts.push(...stars[a], ...stars[b]);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.8 });
  group.add(new THREE.LineSegments(lineGeo, lineMat));
  // Arms: upper arm, a plated forearm and a heavy fist, hanging from the shoulder.
  const armGeo = boxesGeometry([B(0, -0.22, 0, 0.22, 0.42, 0.24, body), B(0, -0.58, 0.02, 0.22, 0.34, 0.24, plate),
    B(0, -0.84, 0.04, 0.3, 0.26, 0.3, plate), B(0, -0.84, 0.2, 0.26, 0.06, 0.02, gold)]);
  const arm = (side) => { const a = new THREE.Group(); a.position.set(0.52 * side, 1.78, 0); a.add(new THREE.Mesh(armGeo, mat)); group.add(a); return a; };
  const armL = arm(1), armR = arm(-1);
  // A soft body of light.
  const auraGeo = boxesGeometry([B(0, 1.3, 0, 1.0, 2.0, 0.5, '#' + col.clone().multiplyScalar(0.12).getHexString())]);
  group.add(new THREE.Mesh(auraGeo, glowMaterial()));
  return { group, color: col, armL, armR, dispose() { torsoGeo.dispose(); armGeo.dispose(); lineGeo.dispose(); lineMat.dispose(); auraGeo.dispose(); group.parent?.remove(group); } };
}
