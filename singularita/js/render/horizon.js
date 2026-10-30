// The elemental isles on Dawnreach's horizon: four far silhouettes that ride with the camera,
// so they never come closer, tinted into the sky's haze as the day turns.
import * as THREE from 'three';
import { boxesGeometry } from './voxel.js';

const B = (x, y, z, w, h, d, c) => [x, y, z, w, h, d, c];

// Each shape stands on y = 0 and is roughly 40–70 m across, drawn 1.3 times larger far away.
const SHAPES = {
  // Air: floating spires, a few of them tall and thin.
  air: () => [B(-14, 20, 0, 6, 18, 6, '#c8d4e0'), B(-14, 9, 0, 3, 6, 3, '#aab8c8'), B(0, 30, 4, 8, 22, 8, '#d8e2ec'), B(0, 16, 4, 4, 8, 4, '#b8c4d4'), B(14, 22, -2, 6, 14, 6, '#c8d4e0'), B(22, 14, 6, 4, 8, 4, '#b8c4d4')],
  // Water: a low ring with a temple spire in the middle.
  water: () => [B(-22, 2, 0, 10, 4, 18, '#9ab8a0'), B(22, 2, 0, 10, 4, 18, '#9ab8a0'), B(0, 2, -16, 34, 4, 8, '#a8c8a8'), B(0, 6, 0, 4, 12, 4, '#d8d0c0'), B(0, 13, 0, 2, 4, 2, '#e8e0d0')],
  // Fire: a cone with a glowing crown.
  fire: () => [B(0, 4, 0, 60, 8, 40, '#4a3a38'), B(0, 12, 0, 40, 8, 28, '#3e302e'), B(0, 19, 0, 24, 6, 18, '#342828'), B(0, 23, 0, 12, 3, 10, '#ff7a3d')],
  // Earth: flat-topped mesas.
  earth: () => [B(-16, 9, 0, 22, 18, 16, '#b8784a'), B(10, 12, 4, 18, 24, 14, '#c8885a'), B(26, 6, -4, 14, 12, 12, '#a86a40'), B(10, 25, 4, 18, 2, 14, '#7a9a4a')],
};
const PLACES = [['air', 0.8], ['water', 2.3], ['fire', 3.6], ['earth', 5.1]]; // angle around Dawnreach

export class Horizon {
  constructor(scene, distance) {
    this.group = new THREE.Group();
    this.haze = { value: new THREE.Color() };
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    // Aerial perspective: far shapes take on the colour of the air between.
    this.material.onBeforeCompile = (sh) => {
      sh.uniforms.uHaze = this.haze;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, 0.45);');
    };
    this.geos = [];
    for (const [kind, a] of PLACES) {
      const geo = boxesGeometry(SHAPES[kind]());
      this.geos.push(geo);
      const m = new THREE.Mesh(geo, this.material);
      m.position.set(Math.cos(a) * distance, -4, Math.sin(a) * distance);
      m.lookAt(0, -4, 0);
      m.scale.setScalar(1.3);
      m.frustumCulled = false;
      m.renderOrder = -5;
      this.group.add(m);
    }
    scene.add(this.group);
  }
  // Follow the camera across the ground plane and blend into the horizon colour.
  update(cam, horizonColor) {
    this.group.position.set(cam.x, 0, cam.z);
    this.haze.value.copy(horizonColor).multiplyScalar(0.92);
  }
  dispose() { this.group.parent?.remove(this.group); for (const g of this.geos) g.dispose(); this.material.dispose(); }
}
