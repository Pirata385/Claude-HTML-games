// Amalgamations — caves and dungeons as instanced interiors with their own collision grid.
// The overworld is hidden while you are inside; leaving puts you back at the entrance.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});
  const R = AM.R;

  const THEMES = {
    cave: { floor: ['#5a544c', '#625a52', '#564f48'], wall: '#6a625a', top: '#4a4038', fog: '#141218', h: 1.35 },
    dungeon: { floor: ['#686c7a', '#70748a', '#636777'], wall: '#4a4d58', top: '#30323c', fog: '#100e16', h: 1.2 },
  };

  class Interior {
    constructor(G, struct) {
      this.G = G; this.s = struct;
      this.kind = struct.type;
      this.L = struct.type === 'cave' ? AM.genCave(struct.seed, struct.level) : AM.genDungeon(struct.seed, struct.level);
      this.S = AM.DUNGEON_CELL;
      this.group = new THREE.Group();
      G.scene.add(this.group);
      this.doorsOpen = struct.type === 'cave' || G.state.cleared.has(struct.id);
      this.interactables = new Map();
      this.spikeT = 0;
      this.build();
    }
    cell(cx, cz) { const L = this.L; if (cx < 0 || cz < 0 || cx >= L.w || cz >= L.h) return 0; return L.cells[cz * L.w + cx]; }
    wall(cx, cz) { const c = this.cell(cx, cz); return c === 0 || (c === 3 && !this.doorsOpen); }
    toWorld(cx, cz) { return [cx * this.S + this.S / 2, cz * this.S + this.S / 2]; }
    build() {
      const L = this.L, S = this.S, T = THEMES[this.kind];
      const rng = AM.makeRng(this.s.seed ^ 0xbeef);
      // floor (one merged mesh)
      const gb = new R.GeoBuilder(false);
      const walls = [];
      for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) {
        const c = L.cells[z * L.w + x];
        const [wx, wz] = this.toWorld(x, z);
        if (c !== 0) {
          const col = c === 2 ? '#5a3a3a' : T.floor[(x * 7 + z * 13) % 3];
          gb.box({ w: S, h: 0.1, l: S, col, m: R.mat([wx, -0.05, wz]) });
        } else {
          let edge = false;
          for (let dz = -1; dz <= 1 && !edge; dz++) for (let dx = -1; dx <= 1; dx++) if (this.cell(x + dx, z + dz) !== 0) { edge = true; break; }
          if (edge) walls.push([wx, wz, T.h * (0.8 + rng.next() * 0.45)]);
        }
      }
      const floor = new THREE.Mesh(gb.build(), R.materials().set);
      floor.receiveShadow = this.G.settings.shadows !== 'off';
      this.group.add(floor);
      // walls (instanced)
      const wg = new R.GeoBuilder(false);
      wg.box({ w: S, h: 1, l: S, c: this.kind === 'cave' ? 0.35 : 0.05, col: T.wall, m: R.mat([0, 0.5, 0]) });
      wg.box({ w: S * 0.9, h: 0.06, l: S * 0.9, col: T.top, m: R.mat([0, 1.0, 0]) });
      const im = new THREE.InstancedMesh(wg.build(), R.materials().set, walls.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      walls.forEach((w, i) => { p.set(w[0], 0, w[1]); sc.set(1, w[2], 1); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.kind === 'cave' ? (i % 4) * 0.4 : 0); m.compose(p, q, sc); im.setMatrixAt(i, m); });
      im.castShadow = this.G.settings.shadows === 'high';
      this.group.add(im);
      // decorations: torches in dungeons, crystals in caves
      const deco = new R.GeoBuilder(false);
      for (let i = 0; i < walls.length; i += 9) {
        const [x, z] = walls[i];
        if (this.kind === 'dungeon') { deco.box({ w: 0.12, h: 0.7, l: 0.12, col: '#3b3f46', m: R.mat([x, T.h + 0.35, z]) }); deco.box({ w: 0.24, h: 0.3, l: 0.24, col: '#ff9b2f', bucket: 1, m: R.mat([x, T.h + 0.85, z]) }); }
        else if (rng.chance(0.5)) deco.box({ w: 0.35, h: 0.9, l: 0.35, tt: 0.15, col: rng.pick(['#7ae4ff', '#b48aff', '#7affb0']), bucket: 1, m: R.mat([x, T.h + 0.3, z], [0.3, 0, 0.3]) });
      }
      this.group.add(new THREE.Mesh(deco.build(), R.materials().set));
      // exit portal at the entrance
      const [ex, ez] = this.toWorld(L.entrance.x, L.entrance.z);
      this.exit = { x: ex, z: ez };
      const portal = new THREE.Mesh(R.objectGeo('exitPortal'), R.materials().set);
      portal.position.set(ex, 0, ez);
      this.group.add(portal);
      this.interactables.set('exit', { id: 'exit', type: 'exit', x: ex, z: ez, r: 2.2, label: 'Leave' });
      // doors
      this.doorMeshes = [];
      if (this.kind === 'dungeon' && !this.doorsOpen) {
        for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) if (L.cells[z * L.w + x] === 3) {
          const d = new THREE.Mesh(R.objectGeo('door'), R.materials().set);
          const [wx, wz] = this.toWorld(x, z);
          d.position.set(wx, 0, wz); this.group.add(d); this.doorMeshes.push(d);
        }
      }
      // spikes
      this.spikes = [];
      for (let z = 0; z < L.h; z++) for (let x = 0; x < L.w; x++) if (L.cells[z * L.w + x] === 2) {
        const sm = new THREE.Mesh(R.objectGeo('spikes'), R.materials().set);
        const [wx, wz] = this.toWorld(x, z);
        sm.position.set(wx, -0.45, wz); this.group.add(sm); this.spikes.push(sm);
      }
      // chests and ores
      this.chestMeshes = new Map();
      for (const c of L.chests) {
        const [x, z] = this.toWorld(c.x, c.z);
        const opened = this.G.state.opened.has(c.id);
        const mesh = new THREE.Mesh(R.objectGeo(opened ? 'chestOpen' : c.big ? 'chestBig' : 'chest'), R.materials().set);
        mesh.position.set(x, 0, z); this.group.add(mesh);
        this.chestMeshes.set(c.id, mesh);
        if (!opened) this.interactables.set(c.id, { id: c.id, type: 'chest', x, z, r: 1.8, level: this.s.level, big: c.big, interior: true, locked: c.big && this.kind === 'dungeon' });
      }
      this.oreMeshes = new Map();
      for (const o of L.ores) {
        if (this.G.isMined(o.id)) continue;
        const [x, z] = this.toWorld(o.x, o.z);
        const mesh = new THREE.Mesh(R.propGeo('ore_' + o.ore), R.materials().set);
        mesh.position.set(x, 0, z); mesh.rotation.y = (o.x * 13 + o.z) % 6; this.group.add(mesh);
        this.oreMeshes.set(o.id, mesh);
        this.interactables.set(o.id, { id: o.id, type: 'mine', ore: o.ore, x, z, r: 1.7, interior: true });
      }
    }
    spawn() {
      const G = this.G, L = this.L, s = this.s;
      const biome = AM.BIOME_INDEX[s.biome] || 0;
      this.gate = [];
      for (const sp of L.spawns) {
        const [x, z] = this.toWorld(sp.x, sp.z);
        const roll = G.world.rollWild(AM.makeRng(AM.hash2(sp.x, sp.z, s.seed)), biome, s.level);
        const e = AM.Ent.spawnWild(G, x, z, roll, { biome: s.biome });
        e.interior = true; e.aggressive = true;
        if (sp.gate) this.gate.push(e);
      }
      if (L.boss && !G.state.cleared.has(s.id)) {
        const [x, z] = this.toWorld(L.boss.x, L.boss.z);
        const rng = AM.makeRng(s.seed ^ 0xb055);
        const sp = AM.BIOMES[biome].spawns, ids = Object.keys(sp);
        const roll = { mother: rng.weighted(ids, (k) => sp[k]), father: rng.pick(AM.BASE_IDS), variant: rng.int(0, 5), level: s.level + 1, rank: 'boss', affix: null };
        const b = AM.Ent.spawnWild(G, x, z, roll, { biome: s.biome });
        b.interior = true; b.name = this.bossName(rng, b.genome); b.dungeon = s;
        this.boss = b;
      }
    }
    bossName(rng, g) { return rng.pick(['Lord', 'Queen', 'Elder', 'Dread', 'Ancient', 'Mad']) + ' ' + g.name; }
    // ---------- level interface (same as WorldView) ----------
    waterAt() { return 0; }
    biomeAt() { return AM.BIOME_INDEX[this.s.biome] || 0; }
    pointBlocked(x, z) { return this.wall(Math.floor(x / this.S), Math.floor(z / this.S)); }
    resolve(x, z, r) {
      const S = this.S;
      const cx0 = Math.floor((x - r) / S) - 1, cx1 = Math.floor((x + r) / S) + 1, cz0 = Math.floor((z - r) / S) - 1, cz1 = Math.floor((z + r) / S) + 1;
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        if (!this.wall(cx, cz)) continue;
        const minx = cx * S, maxx = minx + S, minz = cz * S, maxz = minz + S;
        const qx = AM.clamp(x, minx, maxx), qz = AM.clamp(z, minz, maxz);
        const dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
        if (d < r) {
          if (d < 1e-5) { // centre inside the wall: push to the nearest open side
            const opts = [[minx - r, z, x - minx], [maxx + r, z, maxx - x], [x, minz - r, z - minz], [x, maxz + r, maxz - z]];
            opts.sort((a, b) => a[2] - b[2]);
            x = opts[0][0]; z = opts[0][1];
          } else { x = qx + (dx / d) * r; z = qz + (dz / d) * r; }
        }
      }
      return [x, z];
    }
    nearestInteractable(x, z, maxD) {
      let best = null, bd = maxD;
      for (const it of this.interactables.values()) { const d = Math.hypot(it.x - x, it.z - z) - (it.r || 1.5) + 1.5; if (d < bd) { bd = d; best = it; } }
      return best;
    }
    openChest(id) {
      const mesh = this.chestMeshes.get(id);
      if (mesh) mesh.geometry = R.objectGeo('chestOpen');
      this.interactables.delete(id);
    }
    removeOre(id) { const m = this.oreMeshes.get(id); if (m) { this.group.remove(m); } this.interactables.delete(id); }
    update(dt) {
      const G = this.G;
      // boss door opens once the rooms before it are cleared
      if (!this.doorsOpen && this.gate && this.gate.every((e) => e.dead)) {
        this.doorsOpen = true;
        for (const d of this.doorMeshes) this.group.remove(d);
        G.hud.toast('The sealed door grinds open…', 'gold');
        G.audio.sfx('door');
      }
      const big = [...this.interactables.values()].find((i) => i.locked);
      if (big && this.boss && this.boss.dead) big.locked = false;
      // spike traps cycle: down 1.6 s, up 0.7 s
      this.spikeT = (this.spikeT + dt) % 2.3;
      const up = this.spikeT > 1.6;
      const warn = this.spikeT > 1.25 && !up;
      for (const sm of this.spikes) sm.position.y = up ? 0 : warn ? -0.3 : -0.45;
      if (up) {
        const p = G.player;
        if (!p.dead && this.cell(Math.floor(p.x / this.S), Math.floor(p.z / this.S)) === 2 && (p.spikeHit || 0) < G.time) {
          p.spikeHit = G.time + 0.8;
          AM.Combat.damage(G, null, p, p.maxHp * 0.12, { kind: 'true' });
        }
      }
    }
    dispose() { this.G.scene.remove(this.group); }
  }

  AM.Interior = Interior;
  AM.INTERIOR_THEMES = THEMES;
})(typeof window !== 'undefined' ? window : globalThis);
