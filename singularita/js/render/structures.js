// Static structures: the base camp, cave mouth, arenas, Echo Stones, stairs, shafts, the gate, vents,
// and on the isles their landings, arenas and updraft vents.
import * as THREE from 'three';
import { boxesGeometry, litMaterial, unlitMaterial, glowMaterial } from './voxel.js';

const B = (x, y, z, w, h, d, c) => [x, y, z, w, h, d, c];

export function buildStructures(zone, opts = {}) {
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

  if (zone.type === 'isle') buildIsle(zone, add, animated);
  if (zone.type === 'dimension') buildDimension(zone, add, animated);

  // Echo Stones (every zone type).
  for (const p of zone.pois.filter((q) => q.type === 'lore')) {
    const ruins = zone.type !== 'cave'
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
    } else if (x.type === 'gate') {
      // The Sealed Core Gate: a great door with four sockets. Open, its leaves stand aside
      // and the sockets burn with the sigils.
      const open = !!opts.gateOpen;
      add([B(-4.2, 3.8, 0, 1.2, 7.6, 1.8, '#3a3850'), B(4.2, 3.8, 0, 1.2, 7.6, 1.8, '#3a3850'), B(0, 7.6, 0, 9.6, 1.0, 2.0, '#3a3850')], x.x, x.z, { y: x.h });
      if (open) add([B(-3.0, 3.5, -1.4, 0.5, 7, 3.6, '#2a2838'), B(3.0, 3.5, -1.4, 0.5, 7, 3.6, '#2a2838'), B(0, 3.4, -0.4, 5.4, 6.8, 0.05, '#0a0810')], x.x, x.z, { y: x.h });
      else add([B(0, 3.5, 0, 7.5, 7, 1.4, '#2a2838'), B(0, 3.5, 0.72, 0.15, 6.4, 0.1, '#14121c')], x.x, x.z, { y: x.h });
      const sockets = [];
      for (const [sx, sy, col] of [[-2, 5.4, '#9fe0ff'], [2, 5.4, '#5fb0ff'], [-2, 1.8, '#ff7a3d'], [2, 1.8, '#8ad06a']]) {
        const ox = open ? Math.sign(sx) * 1.6 : 0;
        sockets.push(B(sx + ox, sy, 0.75, 0.9, 0.9, 0.1, '#16141e'), B(sx + ox, sy, 0.8, open ? 0.7 : 0.4, open ? 0.7 : 0.4, 0.05, col));
      }
      add(sockets, x.x, x.z, { y: x.h, mat: unlitMaterial(), cast: false });
      if (open) {
        const glow = add([B(0, 3.4, 0, 5.2, 6.6, 0.3, '#ffe9a8')], x.x, x.z, { y: x.h, mat: glowMaterial(), cast: false });
        glow.material = glow.material.clone(); glow.material.opacity = 0.25; geos.push({ dispose: () => glow.material.dispose() });
        animated.push((t) => { glow.material.opacity = 0.2 + Math.sin(t * 1.5) * 0.06; });
      }
    } else {
      // The Heart Seal: dawnstone and duskstone woven around a heart that does not beat yet.
      add([B(0, 0.25, 0, 7, 0.5, 7, '#2a2630'), B(-2.6, 2.2, 0, 1.2, 4.4, 1.2, '#8a7a5a'), B(2.6, 2.2, 0, 1.2, 4.4, 1.2, '#3a2a5a'), B(0, 4.6, 0, 6.4, 0.8, 1.4, '#4a4058')], x.x, x.z, { y: x.h });
      const heart = add([B(-0.35, 0, 0, 0.7, 1.4, 1.0, '#ffe9a8'), B(0.35, 0, 0, 0.7, 1.4, 1.0, '#a87aff'), B(0, 0, 0, 0.5, 0.5, 1.2, '#ffffff')], x.x, x.z, { y: x.h + 2.2, mat: unlitMaterial(), cast: false });
      animated.push((t) => { heart.rotation.y = Math.sin(t * 0.6) * 0.4; heart.scale.setScalar(1 + Math.max(0, Math.sin(t * 1.1)) * 0.05); });
    }
    // Vents.
    for (const h of zone.hazards) {
      if (h.type === 'stalactite') continue;
      if (h.type === 'radiance') {
        add([B(0, 0.3, 0, 1.2, 0.6, 1.2, '#6a5a3a'), B(0, 1.1, 0, 0.4, 1.2, 0.4, '#8a7a5a')], h.x, h.z);
        const c = add([B(0, 0, 0, 0.5, 1.0, 0.5, '#ffe9a8'), B(0.25, -0.2, 0.1, 0.3, 0.6, 0.3, '#fff4c8')], h.x, h.z, { mat: unlitMaterial(), cast: false });
        c.position.y += 2.1;
        animated.push((t) => { c.rotation.y = t * 0.9 + h.x; });
        continue;
      }
      if (h.type === 'umbral') {
        add([B(0, 0.03, 0, h.r * 1.7, 0.06, h.r * 1.7, '#1a1028'), B(0, 0.05, 0, h.r * 1.2, 0.06, h.r * 1.2, '#3a2060')], h.x, h.z, { mat: unlitMaterial(), cast: false });
        continue;
      }
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

// The isles: a dock and return stone at the landing, dressing for each guardian's arena, updraft vents.
function buildIsle(zone, add, animated) {
  const l = zone.landing, a = zone.arena;
  // The landing: planks running out to sea and the return stone with its four runes.
  const el = zone.def.element;
  if (el !== 'air') add([B(0, 0.1, 2.2, 2.2, 0.2, 5, '#9a6a3a'), B(-1.0, -0.6, 4.2, 0.25, 1.6, 0.25, '#6b4a2e'), B(1.0, -0.6, 4.2, 0.25, 1.6, 0.25, '#6b4a2e')], l.x, l.z);
  add([B(0, 0.2, 0, 1.4, 0.4, 1.4, '#8e8a86'), B(0, 1.2, 0, 0.7, 1.8, 0.7, '#a8a29c')], l.x, l.z);
  add([B(0, 1.5, 0.36, 0.36, 0.14, 0.02, '#9fe0ff'), B(0, 1.2, 0.36, 0.36, 0.14, 0.02, '#5fb0ff'), B(0, 0.9, 0.36, 0.36, 0.14, 0.02, '#ff7a3d')], l.x, l.z, { mat: unlitMaterial(), cast: false, rot: zone.spawnYaw });
  if (el === 'air') {
    // The Windward Shrine: a gate of two posts and a lintel at the edge of the summit.
    const gx = a.x, gz = a.z + a.r + 0.5;
    add([B(-2.6, 2.2, 0, 0.5, 4.4, 0.5, '#c8443a'), B(2.6, 2.2, 0, 0.5, 4.4, 0.5, '#c8443a'), B(0, 4.5, 0, 7, 0.4, 0.7, '#2a2a2a'), B(0, 3.8, 0, 5.6, 0.3, 0.4, '#c8443a')], gx, gz);
    const ring = [];
    for (let k = 0; k < 16; k++) { const ang = (k / 16) * Math.PI * 2; ring.push(B(Math.cos(ang) * (a.r + 0.6), 0.3, Math.sin(ang) * (a.r + 0.6), 0.6, 0.6, 0.6, '#d8dde6')); }
    add(ring, a.x, a.z, { y: a.h });
  } else if (el === 'water') {
    // The Drowned Temple: broken columns around the floor; the raised stones are part of the ground.
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + 0.2, h = 2 + (k % 3);
      add([B(0, h / 2, 0, 0.9, h, 0.9, '#d8d0c0'), B(0, h + 0.15, 0, 1.2, 0.3, 1.2, '#c8c0b0')], a.x + Math.cos(ang) * (a.r + 1.2), a.z + Math.sin(ang) * (a.r + 1.2), { y: a.h });
    }
  } else if (el === 'fire') {
    // Braziers burn on the caldera rim.
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + 0.5;
      const x = a.x + Math.cos(ang) * (a.r + 3), z = a.z + Math.sin(ang) * (a.r + 3);
      add([B(0, 0.6, 0, 0.6, 1.2, 0.6, '#2e2a2e'), B(0, 1.3, 0, 1.0, 0.3, 1.0, '#3a3236')], x, z);
      const fire = add([B(0, 0, 0, 0.6, 0.6, 0.6, '#ff8a3d'), B(0, 0.35, 0, 0.35, 0.4, 0.35, '#ffd070')], x, z, { mat: unlitMaterial(), cast: false });
      fire.position.y += 1.7;
      animated.push((t) => { fire.scale.y = 1 + Math.sin(t * 9 + k) * 0.15; });
    }
  } else if (el === 'earth') {
    // Standing stones ring the Seed Grove, with a young tree at its heart.
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2;
      add([B(0, 1.2, 0, 0.9, 2.4 + (k % 2) * 0.8, 0.7, '#9a8a7a'), B(0, 0.1, 0, 1.2, 0.2, 1.0, '#7a9a4a')], a.x + Math.cos(ang) * (a.r + 1.2), a.z + Math.sin(ang) * (a.r + 1.2), { y: a.h, rot: -ang });
    }
  }
  // Updraft vents: a stone ring around a breathing hole.
  for (const u of zone.updrafts) {
    add([B(0.9, 0.12, 0, 0.3, 0.24, 2.1, '#b8c0cc'), B(-0.9, 0.12, 0, 0.3, 0.24, 2.1, '#b8c0cc'), B(0, 0.12, 0.9, 1.5, 0.24, 0.3, '#b8c0cc'), B(0, 0.12, -0.9, 1.5, 0.24, 0.3, '#b8c0cc')], u.x, u.z, { y: u.h });
    const core = add([B(0, 0.03, 0, 1.4, 0.04, 1.4, '#cfefff')], u.x, u.z, { y: u.h, mat: glowMaterial(), cast: false });
    animated.push((t) => { core.scale.setScalar(0.8 + Math.sin(t * 3 + u.x) * 0.2); });
  }
}

// The dimensions: the way back, the Endless Dungeon's stair, the Twins' gel gates and levers,
// the King's braziers, the Mirror's plates, the Roost's standing rocks and nests.
function buildDimension(zone, add, animated) {
  const g = zone.grid, pal = zone.def.palette;
  const e = zone.entry;
  // The way back: a dark ring where you came in.
  add([B(0, 0.1, 0, 3, 0.2, 3, '#2a2438'), B(-1.3, 1.4, 0, 0.3, 2.8, 0.3, '#4a3a68'), B(1.3, 1.4, 0, 0.3, 2.8, 0.3, '#4a3a68'), B(0, 2.9, 0, 2.9, 0.3, 0.3, '#4a3a68')], e.x, e.z, { y: e.h });
  const veil = add([B(0, 1.4, 0, 2.3, 2.6, 0.06, pal.accent || '#c48cff')], e.x, e.z, { y: e.h, mat: glowMaterial(), cast: false });
  veil.material = veil.material.clone(); veil.material.opacity = 0.35;
  animated.push((t) => { veil.material.opacity = 0.25 + Math.sin(t * 2) * 0.1; });
  const x = zone.exit;
  if (x?.type === 'stair') {
    add([B(0, 0.04, 0, 2.6, 0.08, 2.6, '#020203')], x.x, x.z, { y: x.h, mat: unlitMaterial(), cast: false });
    add([B(-1.5, 0.3, 0, 0.4, 0.6, 3.4, '#5a544e'), B(1.5, 0.3, 0, 0.4, 0.6, 3.4, '#5a544e'), B(0, 0.3, -1.5, 2.6, 0.6, 0.4, '#5a544e'), B(0, 0.3, 1.5, 2.6, 0.6, 0.4, '#5a544e')], x.x, x.z, { y: x.h });
    if (x.locked) add([B(0, 1.0, 0, 3.0, 0.2, 0.2, '#8a8a96'), B(0, 1.0, 0, 0.2, 0.2, 3.0, '#8a8a96'), B(0, 1.2, 0, 0.5, 0.5, 0.3, '#ffcf6a')], x.x, x.z, { y: x.h });
  }
  // Twin Slimes: gates of solid gel, and the levers that melt them.
  for (const gate of zone.gates || []) {
    if (gate.open || zone.def.rule !== 'twins') continue;
    const boxes = gate.cells.map((k) => { const i = k % g.w, j = (k - i) / g.w; return B(i + 0.5 - gate.x, 1.2, j + 0.5 - gate.z, 1, 2.4, 1, '#ff8ab0'); });
    const m = add(boxes, gate.x, gate.z, { y: 0, mat: glowMaterial(), cast: false });
    m.material = m.material.clone(); m.material.opacity = 0.55;
  }
  for (const l of zone.levers || []) {
    add([B(0, 0.3, 0, 0.8, 0.6, 0.8, '#6a5a6a'), B(0, 1.0, 0, 0.16, 1.4, 0.16, '#d8c8d8')], l.x, l.z);
    const handle = add([B(0, 0.5, 0, 0.12, 1.0, 0.12, '#ffd166'), B(0, 1.0, 0, 0.3, 0.3, 0.3, l.pulled ? '#8ad06a' : '#ff6a8a')], l.x, l.z, { cast: false });
    handle.position.y += 0.6; handle.rotation.x = l.pulled ? 0.9 : -0.9;
  }
  // Mirrored: the glass gates and the plates on both sides of the line.
  for (const gate of zone.gates || []) {
    if (gate.open || zone.def.rule !== 'reflection') continue;
    const boxes = gate.cells.map((k) => { const i = k % g.w, j = (k - i) / g.w; return B(i + 0.5 - gate.x, 1.4, j + 0.5 - gate.z, 1, 2.8, 1, '#cfefff'); });
    const m = add(boxes, gate.x, gate.z, { y: 0, mat: glowMaterial(), cast: false });
    m.material = m.material.clone(); m.material.opacity = 0.4;
  }
  for (const pl of zone.plates || []) for (const s of [pl.left, pl.right]) add([B(0, 0.04, 0, 1.6, 0.08, 1.6, '#9fe0ff')], s.x, s.z, { mat: unlitMaterial(), cast: false });
  // Corrupted King: braziers burning back the adamite.
  for (const b of zone.braziers || []) {
    add([B(0, 0.5, 0, 0.5, 1.0, 0.5, '#4a3a2a'), B(0, 1.05, 0, 1.0, 0.2, 1.0, '#6a5a4a')], b.x, b.z);
    const f = add([B(0, 0, 0, 0.6, 0.6, 0.6, '#ffcf6a'), B(0, 0.35, 0, 0.3, 0.4, 0.3, '#fff2a8')], b.x, b.z, { mat: unlitMaterial(), cast: false });
    f.position.y += 1.5;
    animated.push((t) => { f.scale.y = 1 + Math.sin(t * 8 + b.x) * 0.15; });
  }
  // Dragons' Roost: standing rocks to hide behind, and nests.
  for (const r of zone.rocks || []) add([B(0, 2.0, 0, 2, 4, 2, '#4a3a3a'), B(0.3, 4.3, 0.2, 1.4, 0.8, 1.4, '#5a4a48')], r.x, r.z, { y: r.h });
  for (const n of zone.nests || []) add([B(0, 0.2, 0, 3, 0.4, 3, '#5a3a22'), B(0.4, 0.55, 0.2, 0.5, 0.7, 0.5, '#e8d8a0'), B(-0.4, 0.5, -0.3, 0.45, 0.6, 0.45, '#d8c890'), B(0.1, 0.5, -0.6, 0.45, 0.6, 0.45, '#e8d8a0')], n.x, n.z, { y: n.h });
}
