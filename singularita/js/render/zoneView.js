// Everything visual about a zone: terrain, sea, sky, props, structures and decoration.
// Built on zone entry and fully disposed on exit.
import * as THREE from 'three';
import { buildTerrain, makeTerrainMaterial, cullChunks } from './terrain.js';
import { makeWater } from './water.js';
import { NodeVisuals, buildDecor } from './props.js';
import { buildStructures } from './structures.js';
import { applyCavePalette, applyIslePalette } from './sky.js';
import { Horizon } from './horizon.js';
import { F } from '../world/grid.js';

export class ZoneView {
  constructor(renderer, zone, sky, quality, opts = {}) {
    this.r = renderer; this.zone = zone; this.sky = sky;
    this.opts = opts;
    const scene = renderer.scene;
    const pal = zone.def.palette;
    this.material = makeTerrainMaterial();
    this.terrain = buildTerrain(zone, this.material);
    scene.add(this.terrain.group);
    this.nodes = new NodeVisuals(zone, scene, zone.type === 'cave' ? pal.wall : zone.type === 'isle' ? pal.rock : null);
    this.structures = buildStructures(zone, opts);
    scene.add(this.structures.group);
    this.decor = buildDecor(zone, quality);
    scene.add(this.decor.group);
    const c = { x: zone.grid.w / 2, z: zone.grid.d / 2 };
    if (zone.type === 'island') {
      this.water = makeWater(zone.grid.w * 3, zone.grid.seaLevel + 0.62, c);
      scene.add(this.water.group);
      this.horizon = new Horizon(scene, quality.viewDistance + 20);
      sky.setVisible(true);
      renderer.scene.fog.near = 30;
      renderer.scene.fog.far = quality.viewDistance;
      renderer.playerLight.intensity = 0;
    } else if (zone.type === 'isle') {
      sky.setVisible(true);
      applyIslePalette(renderer, sky, pal);
      if (zone.def.element === 'air') this.water = makeWater(zone.grid.w * 4, 0, c, { color: 0xf4f8ff, opacity: 0.94, floor: null, foam: [1, 1, 1] });
      else this.water = makeWater(zone.grid.w * 3, (zone.tideLevel != null ? zone.tideLevel + 0.12 : zone.grid.seaLevel + 0.62), c, { color: new THREE.Color(pal.sea).getHex(), floor: new THREE.Color(pal.sea).multiplyScalar(0.6).getHex() });
      scene.add(this.water.group);
      if (zone.def.element === 'fire') this.lava = buildLavaGlow(zone, scene);
      renderer.scene.fog.near = 40;
      renderer.scene.fog.far = quality.viewDistance;
      renderer.playerLight.intensity = 0;
    } else {
      sky.setVisible(false);
      renderer.scene.background = new THREE.Color(pal.fog);
      renderer.scene.fog.near = 6;
      renderer.scene.fog.far = Math.min(quality.viewDistance, zone.def.hazards.includes('darkness') ? 26 : 38 + (7 - Math.min(7, zone.layer)) * 4);
      applyCavePalette(renderer, pal);
      renderer.playerLight.color.set(pal.light);
      renderer.playerLight.intensity = zone.def.hazards.includes('darkness') ? 9 : 14;
      renderer.playerLight.distance = 18;
    }
    this.viewDistance = quality.viewDistance;
  }
  setWaterLevel(y) { this.water?.setLevel(y); }
  // The Sealed Core Gate opens: rebuild the structures with the open gate.
  setGateOpen(open) {
    this.opts = { ...this.opts, gateOpen: open };
    this.structures.dispose();
    this.structures = buildStructures(this.zone, this.opts);
    this.r.scene.add(this.structures.group);
  }
  update(dt, t, cam, player) {
    cullChunks(this.terrain.chunks, cam.x, cam.z, this.viewDistance);
    this.nodes.update(dt);
    if (player) this.nodes.occlude(cam.x, cam.z, player.x, player.z);
    this.structures.update(t);
    if (this.water) this.water.uniforms.uTime.value = t;
    if (this.lava) this.lava.material.color.setRGB(1, 0.42 + Math.sin(t * 2.2) * 0.08, 0.1);
    if (this.horizon) this.horizon.update(cam, this.sky.uniforms.horizon.value);
  }
  dispose() {
    const scene = this.r.scene;
    scene.remove(this.terrain.group);
    for (const c of this.terrain.chunks) c.mesh.geometry.dispose();
    this.material.dispose();
    this.nodes.dispose();
    this.structures.dispose();
    this.decor.dispose();
    if (this.water) { scene.remove(this.water.group); this.water.dispose(); }
    if (this.lava) { scene.remove(this.lava); this.lava.geometry.dispose(); this.lava.material.dispose(); this.lava.dispose(); }
    this.horizon?.dispose();
    scene.background = null;
  }
}

// A glowing skin over every lava cell, so the rivers burn even in shadow.
function buildLavaGlow(zone, scene) {
  const g = zone.grid, cells = [];
  for (let k = 0; k < g.flags.length; k++) if (g.flags[k] & F.LAVA) cells.push(k);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), new THREE.MeshBasicMaterial({ color: 0xff6a1a }), Math.max(1, cells.length));
  const m = new THREE.Matrix4();
  cells.forEach((k, n) => { const i = k % g.w, j = (k - i) / g.w; mesh.setMatrixAt(n, m.makeTranslation(i + 0.5, g.h[k] + 0.04, j + 0.5)); });
  mesh.count = cells.length;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}
