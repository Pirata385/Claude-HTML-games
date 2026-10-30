// Static structures: the base camp, cave mouth, arenas, Echo Stones, stairs, shafts, the gate, vents.
import * as THREE from 'three';
import { boxesGeometry, litMaterial, unlitMaterial, glowMaterial } from './voxel.js';

const B = (x, y, z, w, h, d, c) => [x, y, z, w, h, d, c];

export function buildStructures(zone) {
  const group = new THREE.Group();
  const geos = [];
  const animated = [];
  const g = zone.grid;
  const groundAt = (x, z) => g.height(Math.floor(x), Math.floor(z));
  const add = (boxes, x, z, { rot = 0, mat = litMaterial(), y = null, cast = true } = {}) => {
    const geo = boxesGeometry(boxes);
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y ?? groundAt(x, z), z);
    m.rotation.y = rot;
    m.castShadow = cast; m.receiveShadow = true;
    group.add(m);
    return m;
  };

  if (zone.type === 'island') {
    const s = zone.base.stations;
    // Forge: furnace with a glowing mouth, chimney and anvil.
    add([B(0, 0.5, 0, 2.4, 1.0, 2.0, '#6e6a66'), B(0, 1.5, -0.4, 1.8, 1.2, 1.2, '#7d7873'), B(0, 2.6, -0.5, 0.7, 1.4, 0.7, '#5d5955'),
      B(1.2, 0.75, 0.9, 0.9, 0.5, 0.5, '#3a3a40'), B(1.2, 0.35, 0.9, 0.4, 0.5, 0.35, '#2e2e33')], s.forge.x, s.forge.z);
    add([B(0, 1.4, 0.21, 0.9, 0.6, 0.02, '#ff8a3d'), B(0, 3.35, -0.5, 0.4, 0.1, 0.4, '#ffb070')], s.forge.x, s.forge.z, { mat: unlitMaterial(), cast: false });
    // Altar: stepped stone with a floating crystal.
    add([B(0, 0.25, 0, 2.2, 0.5, 2.2, '#9a96a8'), B(0, 0.7, 0, 1.5, 0.4, 1.5, '#aaa6b8'), B(0, 1.1, 0, 0.8, 0.4, 0.8, '#bab6c8')], s.altar.x, s.altar.z);
    const crystal = add([B(0, 0, 0, 0.45, 0.8, 0.45, '#c48cff'), B(0, 0, 0, 0.7, 0.3, 0.3, '#e0c4ff')], s.altar.x, s.altar.z, { mat: unlitMaterial(), cast: false });
    crystal.position.y += 2.0;
    animated.push((t) => { crystal.rotation.y = t * 0.8; crystal.position.y = groundAt(s.altar.x, s.altar.z) + 2.0 + Math.sin(t * 1.6) * 0.15; });
    // Bed.
    add([B(0, 0.25, 0, 1.2, 0.5, 2.2, '#7a5232'), B(0, 0.55, 0.15, 1.1, 0.12, 1.7, '#c9493f'), B(0, 0.6, -0.8, 0.8, 0.16, 0.4, '#f2ece0')], s.bed.x, s.bed.z, { rot: 0.2 });
    // Beacon: tall pillar, gold cage, light crystal and a soft beam.
    add([B(0, 0.6, 0, 1.6, 1.2, 1.6, '#8e8a86'), B(0, 3.0, 0, 0.9, 3.8, 0.9, '#a8a29c'), B(0, 5.1, 0, 1.4, 0.3, 1.4, '#d9b24c'),
      B(0.6, 5.8, 0.6, 0.15, 1.2, 0.15, '#d9b24c'), B(-0.6, 5.8, 0.6, 0.15, 1.2, 0.15, '#d9b24c'), B(0.6, 5.8, -0.6, 0.15, 1.2, 0.15, '#d9b24c'), B(-0.6, 5.8, -0.6, 0.15, 1.2, 0.15, '#d9b24c'),
      B(0, 6.5, 0, 1.4, 0.2, 1.4, '#d9b24c')], s.beacon.x, s.beacon.z);
    const core = add([B(0, 0, 0, 0.7, 0.9, 0.7, '#fff2b0')], s.beacon.x, s.beacon.z, { mat: unlitMaterial(), cast: false });
    const beam = add([B(0, 14, 0, 0.6, 28, 0.6, '#ffe9a0')], s.beacon.x, s.beacon.z, { mat: glowMaterial(), cast: false });
    beam.material = beam.material.clone(); beam.material.opacity = 0.18; geos.push({ dispose: () => beam.material.dispose() });
    animated.push((t) => { core.position.y = groundAt(s.beacon.x, s.beacon.z) + 5.8 + Math.sin(t * 2) * 0.08; core.rotation.y = t; });
    // Camp dressing: tents, crates, a lantern post.
    add([B(0, 0.9, 0, 2.6, 0.12, 2.8, '#d9c7a0'), B(0, 0.45, 0, 2.2, 0.9, 2.4, '#c4ad80'), B(0, 1.25, 0, 1.6, 0.6, 2.8, '#d9c7a0')], zone.base.x - 11, zone.base.z + 4, { rot: 0.4 });
    add([B(0, 0.4, 0, 0.8, 0.8, 0.8, '#9a6a3c'), B(0.9, 0.3, 0.2, 0.6, 0.6, 0.6, '#8a5a2c'), B(0.3, 1.0, 0.1, 0.5, 0.4, 0.5, '#a87a4c')], s.forge.x - 2.5, s.forge.z + 0.5);
    for (const [ox, oz] of [[9, 9], [-9, 9], [9, -9], [-9, -9]]) {
      add([B(0, 1.2, 0, 0.2, 2.4, 0.2, '#5d4630'), B(0, 2.5, 0, 0.5, 0.4, 0.5, '#3a3a40')], zone.base.x + ox, zone.base.z + oz);
      add([B(0, 2.5, 0, 0.3, 0.3, 0.3, '#ffd48a')], zone.base.x + ox, zone.base.z + oz, { mat: unlitMaterial(), cast: false });
    }

    // The Wayshrine: a standing stone with four rune bands, one per isle.
    const w = zone.base.wayshrine;
    if (w) {
      add([B(0, 0.2, 0, 1.8, 0.4, 1.8, '#8e8a86'), B(0, 1.6, 0, 0.9, 2.6, 0.9, '#a8a29c'), B(0, 3.05, 0, 1.1, 0.3, 1.1, '#8e8a86')], w.x, w.z);
      add([B(0, 2.3, 0.46, 0.5, 0.18, 0.02, '#9fe0ff'), B(0, 1.9, 0.46, 0.5, 0.18, 0.02, '#5fb0ff'), B(0, 1.5, 0.46, 0.5, 0.18, 0.02, '#ff7a3d'), B(0, 1.1, 0.46, 0.5, 0.18, 0.02, '#8ad06a')],
        w.x, w.z, { rot: Math.atan2(zone.base.x - w.x, zone.base.z - w.z), mat: unlitMaterial(), cast: false });
    }

    // Cave mouth: a stone arch over a dark opening, facing the base.
    const cm = zone.caveMouth;
    const face = Math.atan2(zone.base.x - cm.x, zone.base.z - cm.z);
    add([B(-2.2, 2, 0, 1.4, 4, 1.6, '#6d6a72'), B(2.2, 2, 0, 1.4, 4, 1.6, '#6d6a72'), B(0, 4.4, 0, 6, 1.2, 1.8, '#5d5a62'), B(0, 5.2, -0.5, 4, 0.6, 1.2, '#7d7a82'),
      B(-3.2, 0.8, -0.8, 1.2, 1.6, 1.4, '#7d7a82'), B(3.1, 0.6, -0.6, 1.0, 1.2, 1.2, '#7d7a82'), B(0, 3.0, -1.6, 7, 6, 2.2, '#5a5660')], cm.x, cm.z, { rot: face });
    add([B(0, 1.9, 0.02, 3.0, 3.8, 0.1, '#050407')], cm.x, cm.z, { rot: face, mat: unlitMaterial(), cast: false });
    add([B(-3, 1.0, 1.4, 0.15, 2.0, 0.15, '#6b4a2e'), B(-3, 1.9, 1.4, 1.1, 0.5, 0.1, '#9a7a4a')], cm.x, cm.z, { rot: face });

    // Arenas.
    for (const a of Object.values(zone.arenas)) {
      const ring = [];
      for (let k = 0; k < 22; k++) {
        const ang = (k / 22) * Math.PI * 2;
        const x = Math.cos(ang) * (a.r + 0.6), z = Math.sin(ang) * (a.r + 0.6);
        ring.push(a.id === 'glade' ? B(x, 0.25, z, 0.5, 0.5, 0.5, k % 2 ? '#ffd166' : '#f2f0e0') : B(x, 0.4, z, 0.8, 0.8, 0.8, '#d8d2c0'));
      }
      add(ring, a.x, a.z, { y: a.h });
      for (const p of a.pillars) add([B(0, 2.5, 0, 2, 5, 2, '#7d7873'), B(0, 5.15, 0, 2.3, 0.3, 2.3, '#8e8a86'), B(0.4, 1.0, 1.05, 0.6, 0.6, 0.1, '#6a6560')], p.x, p.z, { y: a.h });
      if (a.id === 'crater') add([B(-4, 0.15, 3, 1.4, 0.3, 0.3, '#e8e2d0'), B(-3.6, 0.3, 3.4, 0.3, 0.3, 0.3, '#e8e2d0'), B(5, 0.2, -2, 0.4, 0.4, 0.4, '#e8e2d0'), B(5.4, 0.15, -1.6, 1.2, 0.3, 0.3, '#e8e2d0')], a.x, a.z, { y: a.h });
    }
  }

  // Echo Stones (both zone types).
  for (const p of zone.pois.filter((q) => q.type === 'lore')) {
    const ruins = zone.type === 'island'
      ? [B(-2, 1.2, -1, 0.9, 2.4, 0.9, '#b8b2a4'), B(2.1, 0.7, -0.6, 0.9, 1.4, 0.9, '#a8a294'), B(1.4, 0.2, 1.6, 1.8, 0.4, 0.9, '#b8b2a4'), B(-1.6, 0.15, 1.4, 1.2, 0.3, 0.8, '#a8a294')]
      : [];
    add([...ruins, B(0, 1.1, 0, 0.9, 2.2, 0.45, '#3a3448'), B(0, 0.15, 0, 1.4, 0.3, 0.9, '#4a4458')], p.x, p.z);
    const rune = add([B(0, 1.3, 0.24, 0.5, 1.2, 0.02, '#c48cff')], p.x, p.z, { mat: unlitMaterial(), cast: false });
    rune.userData.lore = p.id;
    animated.push((t) => { rune.scale.setScalar(0.9 + Math.sin(t * 2 + p.x) * 0.1); });
  }

  if (zone.type === 'cave') {
    const e = zone.entry, x = zone.exit;
    // Stairs up toward a shaft of light.
    add([B(0, 0.15, 0, 2.2, 0.3, 2.2, '#7d7873'), B(0, 0.45, 0, 1.6, 0.3, 1.6, '#8d8883'), B(0, 0.75, 0, 1.0, 0.3, 1.0, '#9d9893'),
      B(-1.0, 1.2, -1.0, 0.25, 2.4, 0.25, '#6b4a2e'), B(1.0, 1.2, -1.0, 0.25, 2.4, 0.25, '#6b4a2e'), B(0, 2.45, -1.0, 2.3, 0.25, 0.25, '#6b4a2e')], e.x, e.z, { y: e.h });
    const shaft = add([B(0, 5, 0, 1.2, 10, 1.2, '#fff4d0')], e.x, e.z, { y: e.h, mat: glowMaterial(), cast: false });
    shaft.material = shaft.material.clone(); shaft.material.opacity = 0.07; geos.push({ dispose: () => shaft.material.dispose() });
    if (x.type === 'shaft') {
      add([B(0, 0.04, 0, 2.6, 0.08, 2.6, '#020203')], x.x, x.z, { y: x.h, mat: unlitMaterial(), cast: false });
      add([B(-1.5, 0.25, 0, 0.4, 0.5, 3.4, '#6d6a72'), B(1.5, 0.25, 0, 0.4, 0.5, 3.4, '#6d6a72'), B(0, 0.25, -1.5, 2.6, 0.5, 0.4, '#6d6a72'), B(0, 0.25, 1.5, 2.6, 0.5, 0.4, '#6d6a72'),
        B(-1.2, 1.2, -1.5, 0.15, 2.4, 0.15, '#6b4a2e'), B(1.2, 1.2, -1.5, 0.15, 2.4, 0.15, '#6b4a2e'), B(0, 2.4, -1.5, 2.6, 0.18, 0.18, '#6b4a2e')], x.x, x.z, { y: x.h });
    } else {
      // The Sealed Core Gate: a great door with four empty sockets.
      add([B(0, 3.5, 0, 7.5, 7, 1.4, '#2a2838'), B(-4.2, 3.8, 0, 1.2, 7.6, 1.8, '#3a3850'), B(4.2, 3.8, 0, 1.2, 7.6, 1.8, '#3a3850'), B(0, 7.6, 0, 9.6, 1.0, 2.0, '#3a3850'),
        B(0, 3.5, 0.72, 0.15, 6.4, 0.1, '#14121c')], x.x, x.z, { y: x.h });
      const sockets = [];
      for (const [sx, sy, col] of [[-2, 5.4, '#9fe0ff'], [2, 5.4, '#5fb0ff'], [-2, 1.8, '#ff7a3d'], [2, 1.8, '#8ad06a']]) {
        sockets.push(B(sx, sy, 0.75, 0.9, 0.9, 0.1, '#16141e'), B(sx, sy, 0.8, 0.4, 0.4, 0.05, col));
      }
      add(sockets, x.x, x.z, { y: x.h, mat: unlitMaterial(), cast: false });
    }
    // Vents.
    for (const h of zone.hazards) {
      if (h.type === 'stalactite') continue;
      const col = h.type === 'gas_vent' ? '#9be15d' : h.type === 'heat_vent' ? '#ff7a3d' : '#9fd8ff';
      add([B(0, 0.3, 0, 1.0, 0.6, 1.0, '#4a4440'), B(0, 0.7, 0, 0.6, 0.3, 0.6, '#5a5450')], h.x, h.z);
      add([B(0, 0.86, 0, 0.36, 0.04, 0.36, col)], h.x, h.z, { mat: unlitMaterial(), cast: false });
    }
  }

  return {
    group, animated,
    update(t) { for (const f of animated) f(t); },
    dispose() { group.parent?.remove(group); for (const gg of geos) gg.dispose(); },
  };
}
