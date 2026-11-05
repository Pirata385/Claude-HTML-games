// Portraits of saved characters for the load screen: the real player rig in its gear, drawn once
// by a small renderer of its own and kept as an image. Returns null where WebGL is missing.
import * as THREE from 'three';
import { buildPlayerRig } from './models.js';

const W = 192, H = 224;
const cache = new Map();
let r = null, scene = null, cam = null;

function setup() {
  r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(W, H, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a4a3a, 1.4));
  const key = new THREE.DirectionalLight(0xfff1d6, 2.0);
  key.position.set(2, 3, 4);
  scene.add(key);
  cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 20);
  cam.position.set(0.7, 1.5, 4.6);
  cam.lookAt(0, 1.18, 0);
}

// One portrait as a data URL, or null.
export function portraitOf(classId, weaponMat = null, armorMat = null) {
  const k = `${classId}|${weaponMat}|${armorMat}`;
  if (cache.has(k)) return cache.get(k);
  let url = null;
  try {
    if (!r) setup();
    const rig = buildPlayerRig(classId, weaponMat, armorMat);
    rig.root.rotation.y = 0.25;
    // A relaxed stance: the weapon arm a little forward.
    const arm = rig.parts.find((p) => p.def.name === 'armR');
    if (arm) arm.group.rotation.x = -0.35;
    scene.add(rig.root);
    r.render(scene, cam);
    url = r.domElement.toDataURL('image/png');
    rig.dispose();
  } catch (err) {
    console.warn('[portrait] unavailable', err?.message);
  }
  cache.set(k, url);
  return url;
}

// Frees the renderer's WebGL context once the load screen is drawn; the images stay cached.
export function releasePortraits() {
  if (!r) return;
  r.dispose();
  r.forceContextLoss?.();
  r = scene = cam = null;
}
