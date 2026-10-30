// Everything visual about a zone: terrain, sea, sky, props, structures and decoration.
// Built on zone entry and fully disposed on exit.
import * as THREE from 'three';
import { buildTerrain, makeTerrainMaterial, cullChunks } from './terrain.js';
import { makeWater } from './water.js';
import { NodeVisuals, buildDecor } from './props.js';
import { buildStructures } from './structures.js';
import { applyCavePalette } from './sky.js';

export class ZoneView {
  constructor(renderer, zone, sky, quality) {
    this.r = renderer; this.zone = zone; this.sky = sky;
    const scene = renderer.scene;
    this.material = makeTerrainMaterial();
    this.terrain = buildTerrain(zone, this.material);
    scene.add(this.terrain.group);
    this.nodes = new NodeVisuals(zone, scene, zone.type === 'cave' ? zone.def.palette.wall : null);
    this.structures = buildStructures(zone);
    scene.add(this.structures.group);
    this.decor = buildDecor(zone, quality);
    scene.add(this.decor.group);
    if (zone.type === 'island') {
      const c = { x: zone.grid.w / 2, z: zone.grid.d / 2 };
      this.water = makeWater(zone.grid.w * 3, zone.grid.seaLevel + 0.62, c);
      scene.add(this.water.group);
      sky.setVisible(true);
      renderer.scene.fog.near = 30;
      renderer.scene.fog.far = quality.viewDistance;
      renderer.playerLight.intensity = 0;
    } else {
      sky.setVisible(false);
      const pal = zone.def.palette;
      renderer.scene.background = new THREE.Color(pal.fog);
      renderer.scene.fog.near = 6;
      renderer.scene.fog.far = Math.min(quality.viewDistance, zone.def.hazards.includes('darkness') ? 26 : 38 + (7 - zone.layer) * 4);
      applyCavePalette(renderer, pal);
      renderer.playerLight.color.set(pal.light);
      renderer.playerLight.intensity = zone.def.hazards.includes('darkness') ? 9 : 14;
      renderer.playerLight.distance = 18;
    }
    this.viewDistance = quality.viewDistance;
  }
  update(dt, t, cam, player) {
    cullChunks(this.terrain.chunks, cam.x, cam.z, this.viewDistance);
    this.nodes.update(dt);
    if (player) this.nodes.occlude(cam.x, cam.z, player.x, player.z);
    this.structures.update(t);
    if (this.water) this.water.uniforms.uTime.value = t;
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
    scene.background = null;
  }
}
