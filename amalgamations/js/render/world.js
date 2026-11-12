// Amalgamations — world view: streams chunks around the player (ground + water + banks in one mesh per chunk),
// instanced props, merged structure meshes, colliders and interactables, sky, fog, sun and day/night.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const R = AM.R || (AM.R = {});
  const { CHUNK, TILE, TILES } = AM;
  const WATER_Y = -0.32, BANK = '#8a6a48';

  class WorldView {
    constructor(scene, world, opts) {
      this.scene = scene; this.world = world;
      this.radius = opts.radius || 2;
      this.shadows = !!opts.shadows;
      this.chunks = new Map();
      this.pending = [];
      this.root = new THREE.Group(); scene.add(this.root);
      this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      this.waterMat = new THREE.MeshLambertMaterial({ color: '#3f9fd8', transparent: true, opacity: 0.78, depthWrite: false });
      this.lavaMat = new THREE.MeshBasicMaterial({ color: '#ff6a1f', toneMapped: false });
      this.structMats = R.materials().set;
      this.removed = opts.removed || new Set();   // harvested prop ids
      // instanced props
      this.inst = {};
      const caps = { tree: 1800, pine: 900, pineSnow: 700, deadtree: 500, cactus: 400, bush: 400, flowers: 1600, grass: 2600, reeds: 900, deadbush: 400, rock: 700, log: 250, bones: 200, iceSpike: 400, mushroomS: 700, giantShroom: 500, glowShroom: 400, crystal: 600, lavarock: 500, vent: 150, ore_iron: 120, ore_goldore: 120, ore_crystal: 120, ore_stone: 120 };
      const k = this.radius >= 4 ? 2.2 : this.radius === 3 ? 1.5 : 1;
      for (const t of R.PROP_TYPES) {
        const geo = R.propGeo(t);
        const mats = this.structMats;
        const im = new THREE.InstancedMesh(geo, mats, Math.round((caps[t] || 300) * k));
        im.count = 0;
        im.castShadow = this.shadows && !/grass|flowers|reeds|mushroomS|deadbush|bones|glowShroom/.test(t);
        im.receiveShadow = false;
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.root.add(im);
        this.inst[t] = im;
      }
      this.propsDirty = true;
      this.colliders = new Map();   // cell key -> list
      this.interactables = new Map(); // id -> object
      this.structMeshes = new Map(); // struct id -> {mesh, s}
      this.dyn = new THREE.Group(); this.root.add(this.dyn);
      this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
      this.lastCx = null; this.lastCz = null;
    }
    setRadius(r) { this.radius = r; this.lastCx = null; }

    // ---------- chunk ground ----------
    buildGround(data) {
      const { biome, water, shade } = data;
      const pos = [], col = [];
      const ox = data.cx * CHUNK, oz = data.cz * CHUNK;
      const color = (hex) => R.lin(hex);
      const quad = (x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, c) => {
        pos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2, x0, y0, z0, x2, y2, z2, x3, y3, z3);
        for (let i = 0; i < 6; i++) col.push(c[0], c[1], c[2]);
      };
      const W = (tx, tz) => {
        if (tx >= 0 && tz >= 0 && tx < TILES && tz < TILES) return water[tz * TILES + tx];
        return this.world.waterAt(ox + tx * TILE + 1, oz + tz * TILE + 1);
      };
      const waterTiles = [];
      for (let tz = 0; tz < TILES; tz++) for (let tx = 0; tx < TILES; tx++) {
        const i = tz * TILES + tx;
        const B = AM.BIOMES[biome[i]];
        const x0 = ox + tx * TILE, z0 = oz + tz * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
        if (water[i]) {
          const deep = water[i] === 2;
          const bed = deep ? (B.id === 'volcanic' ? '#3a1a10' : '#2a5a78') : (B.id === 'tundra' ? '#9ac0d0' : '#5a8a7a');
          quad(x0, WATER_Y - (deep ? 0.25 : 0), z1, x1, WATER_Y - (deep ? 0.25 : 0), z1, x1, WATER_Y - (deep ? 0.25 : 0), z0, x0, WATER_Y - (deep ? 0.25 : 0), z0, color(bed));
          waterTiles.push([x0, z0, deep, B.id]);
          continue;
        }
        let c = B.ground[shade[i]];
        // sandy shore next to water
        if (B.id !== 'desert' && B.id !== 'tundra' && B.id !== 'volcanic' && (W(tx - 1, tz) || W(tx + 1, tz) || W(tx, tz - 1) || W(tx, tz + 1))) c = AM.mixColor(c, '#e3cf94', 0.55);
        quad(x0, 0, z1, x1, 0, z1, x1, 0, z0, x0, 0, z0, color(c));
        // banks (vertical faces down to the water bed)
        const bank = color(B.id === 'tundra' ? '#b8c8d0' : B.id === 'volcanic' ? '#2a2220' : BANK);
        if (W(tx, tz + 1)) quad(x0, 0, z1, x0, WATER_Y - 0.25, z1, x1, WATER_Y - 0.25, z1, x1, 0, z1, bank);
        if (W(tx, tz - 1)) quad(x1, 0, z0, x1, WATER_Y - 0.25, z0, x0, WATER_Y - 0.25, z0, x0, 0, z0, bank);
        if (W(tx + 1, tz)) quad(x1, 0, z1, x1, WATER_Y - 0.25, z1, x1, WATER_Y - 0.25, z0, x1, 0, z0, bank);
        if (W(tx - 1, tz)) quad(x0, 0, z0, x0, WATER_Y - 0.25, z0, x0, WATER_Y - 0.25, z1, x0, 0, z1, bank);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, this.groundMat);
      mesh.receiveShadow = this.shadows;
      mesh.matrixAutoUpdate = false;
      let wmesh = null, lmesh = null;
      if (waterTiles.length) {
        const wp = [], lp = [];
        for (const [x0, z0, deep, b] of waterTiles) {
          const arr = b === 'volcanic' && deep ? lp : wp;
          const y = -0.08;
          arr.push(x0, y, z0 + TILE, x0 + TILE, y, z0 + TILE, x0 + TILE, y, z0, x0, y, z0 + TILE, x0 + TILE, y, z0, x0, y, z0);
        }
        const mk = (arr, mat) => {
          if (!arr.length) return null;
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
          g.computeVertexNormals();
          const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.renderOrder = 1; return m;
        };
        wmesh = mk(wp, this.waterMat); lmesh = mk(lp, this.lavaMat);
      }
      return { mesh, wmesh, lmesh };
    }

    // ---------- streaming ----------
    update(px, pz, budget) {
      const cx = Math.floor(px / CHUNK), cz = Math.floor(pz / CHUNK);
      if (cx !== this.lastCx || cz !== this.lastCz) {
        this.lastCx = cx; this.lastCz = cz;
        const want = new Set();
        const r = this.radius;
        const list = [];
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz > (r + 0.5) * (r + 0.5)) continue;
          const k = (cx + dx) + ',' + (cz + dz);
          want.add(k);
          if (!this.chunks.has(k)) list.push([dx * dx + dz * dz, cx + dx, cz + dz]);
        }
        list.sort((a, b) => a[0] - b[0]);
        this.pending = list.map((l) => [l[1], l[2]]);
        for (const [k, c] of this.chunks) if (!want.has(k)) this.unloadChunk(k, c);
      }
      let n = budget || 1;
      while (n-- > 0 && this.pending.length) { const [x, z] = this.pending.shift(); this.loadChunk(x, z); }
      if (this.propsDirty) this.rebuildProps();
    }
    loadAllNow(px, pz) { this.lastCx = null; this.update(px, pz, 999); }
    loadChunk(cx, cz) {
      const k = cx + ',' + cz;
      if (this.chunks.has(k)) return;
      const data = this.world.chunk(cx, cz);
      const g = this.buildGround(data);
      this.root.add(g.mesh); if (g.wmesh) this.root.add(g.wmesh); if (g.lmesh) this.root.add(g.lmesh);
      const c = { data, ground: g, keys: [] };
      this.chunks.set(k, c);
      // colliders and interactables for props
      for (const p of data.props) {
        const def = AM.PROPS[p.t];
        if (p.id && this.removed.has(p.id)) continue;
        if (def.solid) this.addCollider({ x: p.x, z: p.z, r: def.solid * p.s, chunk: k, prop: p });
        if (def.interact) this.addInteractable({ id: p.id, type: def.interact, x: p.x, z: p.z, r: 1.6, prop: p, chunk: k, ore: p.ore });
      }
      // structures whose centre is in this chunk
      for (const s of data.structs) {
        if (Math.floor(s.x / CHUNK) !== cx || Math.floor(s.z / CHUNK) !== cz) continue;
        this.loadStructure(s, k);
      }
      this.propsDirty = true;
      if (this.onChunk) this.onChunk(c, true);
    }
    unloadChunk(k, c) {
      for (const m of [c.ground.mesh, c.ground.wmesh, c.ground.lmesh]) if (m) { this.root.remove(m); m.geometry.dispose(); }
      this.chunks.delete(k);
      for (const [ck, list] of this.colliders) { const f = list.filter((o) => o.chunk !== k); if (f.length !== list.length) { if (f.length) this.colliders.set(ck, f); else this.colliders.delete(ck); } }
      for (const [id, it] of this.interactables) if (it.chunk === k) this.interactables.delete(id);
      for (const [id, sm] of this.structMeshes) if (sm.chunk === k) { this.root.remove(sm.mesh); for (const o of sm.objs) this.dyn.remove(o); this.structMeshes.delete(id); }
      this.propsDirty = true;
      if (this.onChunk) this.onChunk(c, false);
    }
    rebuildProps() {
      this.propsDirty = false;
      const counts = {};
      for (const t in this.inst) counts[t] = 0;
      const m = this._m, q = this._q, p = this._p, s = this._s, e = this._e;
      for (const c of this.chunks.values()) {
        for (const pr of c.data.props) {
          if (pr.id && this.removed.has(pr.id)) continue;
          const t = pr.t === 'ore' ? 'ore_' + pr.ore : pr.t;
          const im = this.inst[t];
          if (!im || counts[t] >= im.instanceMatrix.count) continue;
          e.set(0, pr.r, 0); q.setFromEuler(e); p.set(pr.x, 0, pr.z); s.set(pr.s, pr.s, pr.s);
          m.compose(p, q, s);
          im.setMatrixAt(counts[t]++, m);
        }
      }
      for (const t in this.inst) { const im = this.inst[t]; im.count = counts[t]; im.instanceMatrix.needsUpdate = true; }
    }
    removeProp(id) {
      this.removed.add(id);
      this.interactables.delete(id);
      for (const [ck, list] of this.colliders) { const f = list.filter((o) => !(o.prop && o.prop.id === id)); if (f.length !== list.length) this.colliders.set(ck, f); }
      this.propsDirty = true;
    }
    restoreProp(id) { this.removed.delete(id); this.lastCx = null; this.propsDirty = true; for (const [k, c] of this.chunks) if (c.data.props.some((p) => p.id === id)) { this.unloadChunk(k, c); } }

    // ---------- structures ----------
    loadStructure(s, chunkKey) {
      if (this.structMeshes.has(s.id)) return;
      const geo = R.structureGeo(this.world, s);
      const mesh = geo ? new THREE.Mesh(geo, this.structMats) : new THREE.Group();
      mesh.position.set(s.x, 0, s.z);
      mesh.castShadow = this.shadows; mesh.receiveShadow = this.shadows;
      mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
      const objs = [];
      const sm = { mesh, s, chunk: chunkKey, objs };
      this.structMeshes.set(s.id, sm);
      const col = (o) => this.addCollider(Object.assign({ chunk: chunkKey }, o));
      const it = (o) => this.addInteractable(Object.assign({ chunk: chunkKey, struct: s }, o));
      if (s.type === 'village') {
        const L = this.world.villageLayout(s);
        for (const h of L.houses) col({ x: h.x, z: h.z, box: [h.w / 2 + 0.2, h.d / 2 + 0.2], rot: h.rot });
        col({ x: L.well.x, z: L.well.z, r: 1.0 });
        col({ x: L.obelisk.x, z: L.obelisk.z, r: 0.8 });
        col({ x: L.lab.x, z: L.lab.z, box: [2.1, 1.7], rot: 0 });
        col({ x: L.forge.x, z: L.forge.z, box: [1.2, 0.9], rot: 0 });
        col({ x: L.stall.x, z: L.stall.z, box: [1.4, 0.7], rot: 0 });
        it({ id: 'ob:' + s.id, type: 'obelisk', x: L.obelisk.x, z: L.obelisk.z, r: 2.4, label: 'Waypoint' });
        sm.layout = L;
      } else if (s.type === 'ruin') {
        const L = this.world.ruinLayout(s);
        for (const p of L.pillars) col({ x: p.x, z: p.z, r: 0.55 });
        for (const w of L.walls) col({ x: w.x, z: w.z, box: [w.w / 2, 0.35], rot: w.rot });
        col({ x: L.lore.x, z: L.lore.z, r: 0.5 });
        it({ id: L.lore.id, type: 'lore', x: L.lore.x, z: L.lore.z, r: 2.0, label: 'Read', struct: s });
        it({ id: L.chest.id, type: 'chest', x: L.chest.x, z: L.chest.z, r: 1.8, level: s.level, big: false, struct: s });
        sm.layout = L;
      } else if (s.type === 'camp') {
        const L = this.world.campLayout(s);
        for (const t of L.tents) col({ x: t.x, z: t.z, r: 1.2 });
        col({ x: s.x, z: s.z, r: 0.6 });
        sm.layout = L;
      } else if (s.type === 'cave' || s.type === 'dungeon') {
        col({ x: s.x, z: s.z - (s.type === 'cave' ? 0.6 : 1.2), box: s.type === 'cave' ? [2.9, 2.0] : [3.6, 1.6], rot: 0 });
        it({ id: 'en:' + s.id, type: s.type, x: s.x, z: s.z + (s.type === 'cave' ? 2.6 : 2.4), r: 2.2, struct: s });
      } else if (s.type === 'shrine') {
        col({ x: s.x, z: s.z, r: 0.8 });
        it({ id: 'ob:' + s.id, type: 'obelisk', x: s.x, z: s.z, r: 2.4, label: 'Waypoint', struct: s });
      } else if (s.type === 'chest') {
        it({ id: 'c:' + s.id, type: 'chest', x: s.x, z: s.z, r: 1.8, level: s.level, big: false, struct: s });
      }
      if (this.onStructure) this.onStructure(sm, true);
    }

    // ---------- collisions ----------
    addCollider(o) {
      const k = Math.floor(o.x / 8) + ',' + Math.floor(o.z / 8);
      if (!this.colliders.has(k)) this.colliders.set(k, []);
      this.colliders.get(k).push(o);
    }
    addInteractable(o) { this.interactables.set(o.id, o); }
    // Push a circle (x, z, r) out of static colliders. Returns [x, z].
    resolve(x, z, r) {
      const cx0 = Math.floor((x - r - 3) / 8), cx1 = Math.floor((x + r + 3) / 8), cz0 = Math.floor((z - r - 3) / 8), cz1 = Math.floor((z + r + 3) / 8);
      for (let a = cx0; a <= cx1; a++) for (let b = cz0; b <= cz1; b++) {
        const list = this.colliders.get(a + ',' + b);
        if (!list) continue;
        for (const o of list) {
          if (o.box) {
            const c = Math.cos(o.rot), s = Math.sin(o.rot);
            const dx = x - o.x, dz = z - o.z;
            let lx = dx * c - dz * s, lz = dx * s + dz * c;
            const bx = o.box[0], bz = o.box[1];
            if (Math.abs(lx) < bx && Math.abs(lz) < bz) {
              if (bx - Math.abs(lx) < bz - Math.abs(lz)) lx = Math.sign(lx || 1) * (bx + r); else lz = Math.sign(lz || 1) * (bz + r);
            } else {
              const qx = AM.clamp(lx, -bx, bx), qz = AM.clamp(lz, -bz, bz);
              const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
              if (d >= r) continue;
              lx = qx + (ex / d) * r; lz = qz + (ez / d) * r;
            }
            x = o.x + lx * c + lz * s; z = o.z - lx * s + lz * c;
          } else {
            const dx = x - o.x, dz = z - o.z, rr = r + o.r;
            const d2 = dx * dx + dz * dz;
            if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; x = o.x + (dx / d) * rr; z = o.z + (dz / d) * rr; }
          }
        }
      }
      return [x, z];
    }
    // True if the point is inside a static collider (used by projectiles and beams).
    pointBlocked(x, z) { const r = this.resolve(x, z, 0.05); return Math.abs(r[0] - x) > 1e-3 || Math.abs(r[1] - z) > 1e-3; }
    // 0 dry, 1 shallow, 2 deep (blocks). Uses loaded chunk data when available.
    waterAt(x, z) {
      const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
      const c = this.chunks.get(cx + ',' + cz);
      if (!c) return this.world.waterAt(x, z);
      const tx = Math.floor((x - cx * CHUNK) / TILE), tz = Math.floor((z - cz * CHUNK) / TILE);
      return c.data.water[tz * TILES + tx];
    }
    biomeAt(x, z) {
      const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
      const c = this.chunks.get(cx + ',' + cz);
      if (!c) return this.world.biomeAt(x, z);
      const tx = Math.floor((x - cx * CHUNK) / TILE), tz = Math.floor((z - cz * CHUNK) / TILE);
      return c.data.biome[tz * TILES + tx];
    }
    nearestInteractable(x, z, maxD) {
      let best = null, bd = maxD;
      for (const it of this.interactables.values()) {
        const d = Math.hypot(it.x - x, it.z - z) - (it.r || 1.5) + 1.5;
        if (d < bd) { bd = d; best = it; }
      }
      return best;
    }
    setVisible(v) { this.root.visible = v; }
    dispose() {
      for (const [k, c] of this.chunks) this.unloadChunk(k, c);
      this.scene.remove(this.root);
    }
  }

  // ---------- sky, sun and day/night ----------
  class Sky {
    constructor(scene, shadows, shadowSize) {
      this.scene = scene;
      this.hemi = new THREE.HemisphereLight(0xdff3ff, 0x5a6a4a, 1.05);
      this.sun = new THREE.DirectionalLight(0xffffff, 1.7);
      this.sun.castShadow = !!shadows;
      if (shadows) {
        this.sun.shadow.mapSize.set(shadowSize, shadowSize);
        const cam = this.sun.shadow.camera;
        cam.left = -22; cam.right = 22; cam.top = 22; cam.bottom = -22; cam.near = 1; cam.far = 90;
        this.sun.shadow.bias = -0.0008;
        this.sun.shadow.normalBias = 0.02;
      }
      this.night = new THREE.PointLight(0xffc070, 0, 14, 1.6);
      scene.add(this.hemi, this.sun, this.sun.target, this.night);
      scene.fog = new THREE.Fog(0xcfe8f2, 70, 140);
      scene.background = new THREE.Color(0xcfe8f2);
      this._c1 = new THREE.Color(); this._c2 = new THREE.Color();
      this.darkness = 0;
    }
    // time: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight. fogHex: biome fog colour.
    update(time, x, z, fogHex, camDist, playerGlow) {
      const sunUp = Math.sin(time * Math.PI * 2);
      const day = AM.clamp(sunUp * 2.2 + 0.35, 0, 1);
      this.darkness = 1 - day;
      const ang = time * Math.PI * 2;
      this.sun.position.set(x + Math.cos(ang) * 30, 20 + Math.max(0, sunUp) * 30, z + 18);
      this.sun.target.position.set(x, 0, z);
      this.sun.intensity = 0.5 + 1.25 * day;
      this._c1.set(0xffffff); this._c2.set(0xffb070);
      this.sun.color.copy(this._c1).lerp(this._c2, AM.clamp(1 - Math.abs(sunUp) * 3, 0, 1) * 0.6);
      if (day < 0.5) { this._c2.set(0x9ab0ff); this.sun.color.lerp(this._c2, 1 - day * 2); }
      this.hemi.intensity = 0.75 + 0.35 * day;
      this._c1.set(0xdff3ff); this._c2.set(0x8a9ad8);
      this.hemi.color.copy(this._c2).lerp(this._c1, day);
      const fog = this._c1.set(fogHex);
      this._c2.set(0x1a2040);
      fog.lerp(this._c2, (1 - day) * 0.65);
      this.scene.fog.color.copy(fog);
      this.scene.background.copy(fog);
      this.scene.fog.near = camDist + 18; this.scene.fog.far = camDist + 70;
      this.night.position.set(x, 3, z);
      this.night.intensity = playerGlow ? (1 - day) * 2.2 : (1 - day) * 0.6;
      return day;
    }
  }

  Object.assign(R, { WorldView, Sky, WATER_Y });
})(typeof window !== 'undefined' ? window : globalThis);
