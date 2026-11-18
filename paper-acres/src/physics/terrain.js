/* Static Matter bodies built from the grid around the player, plus collision-filter helpers.
 * Category bits: 0..15 = "in slice z" (terrain, player, props); 16..31 = "actor in slice z" (enemies, weapons, props). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  PA.sliceBit = (z) => 1 << (z & 15);
  PA.actorBit = (z) => 1 << (16 + (z & 15));
  PA.filters = {
    terrain: (z) => ({ category: PA.sliceBit(z), mask: 0xFFFFFFFF | 0, group: 0 }),
    player: (z) => ({ category: PA.sliceBit(z), mask: PA.sliceBit(z) | PA.actorBit(z), group: -1 }),
    weapon: (z) => ({ category: PA.actorBit(z), mask: PA.actorBit(z), group: -1 }),
    enemy: (z) => ({ category: PA.actorBit(z), mask: PA.sliceBit(z) | PA.actorBit(z), group: 0 }),
    prop: (z) => ({ category: PA.sliceBit(z) | PA.actorBit(z), mask: PA.sliceBit(z) | PA.actorBit(z), group: 0 }),
  };

  /** Greedy merge of solid cells inside a region into rectangles (cell units). Pure. */
  function rects(grid, z, x0, y0, w, h) {
    const used = new Uint8Array(w * h);
    const solid = (x, y) => grid.solid(x0 + x, y0 + y, z);
    const out = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (used[y * w + x] || !solid(x, y)) continue;
        let rw = 1;
        while (x + rw < w && !used[y * w + x + rw] && solid(x + rw, y)) rw++;
        let rh = 1;
        outer: while (y + rh < h) {
          for (let k = 0; k < rw; k++) if (used[(y + rh) * w + x + k] || !solid(x + k, y + rh)) break outer;
          rh++;
        }
        for (let yy = 0; yy < rh; yy++) for (let k = 0; k < rw; k++) used[(y + yy) * w + x + k] = 1;
        out.push({ x: x0 + x, y: y0 + y, w: rw, h: rh });
      }
    }
    return out;
  }

  class Terrain {
    constructor(scene, map) {
      this.scene = scene; this.map = map; this.grid = map.grid;
      this.chunks = new Map(); // "z:cx" -> [bodies]
      this.dirty = new Set();
      this.unsub = this.grid.onChange((x, y, z) => this.dirty.add(z + ':' + Math.floor(x / C.CHUNK_W)));
      this.rangeX = 2; this.rangeZ = 2;
    }
    buildChunk(z, cx) {
      const g = this.grid, x0 = cx * C.CHUNK_W, w = Math.min(C.CHUNK_W, g.w - x0);
      const list = rects(g, z, x0, 0, w, g.h);
      const bodies = [];
      const M = this.scene.matter;
      for (const r of list) {
        const b = M.add.rectangle((r.x + r.w / 2) * C.CELL_W, (r.y + r.h / 2) * C.CELL_H, r.w * C.CELL_W, r.h * C.CELL_H, {
          isStatic: true, label: 'terrain', friction: 0.4, frictionStatic: 0.5, restitution: 0, collisionFilter: PA.filters.terrain(z),
        });
        b.sliceZ = z;
        bodies.push(b);
      }
      // world side walls so nothing leaves the page
      if (cx === 0) bodies.push(M.add.rectangle(-C.CELL_W * 2, g.h * C.CELL_H / 2, C.CELL_W * 4, g.h * C.CELL_H * 2, { isStatic: true, label: 'terrain', collisionFilter: PA.filters.terrain(z) }));
      if (x0 + w >= g.w) bodies.push(M.add.rectangle(g.w * C.CELL_W + C.CELL_W * 2, g.h * C.CELL_H / 2, C.CELL_W * 4, g.h * C.CELL_H * 2, { isStatic: true, label: 'terrain', collisionFilter: PA.filters.terrain(z) }));
      return bodies;
    }
    removeChunk(key) {
      const list = this.chunks.get(key);
      if (!list) return;
      for (const b of list) this.scene.matter.world.remove(b);
      this.chunks.delete(key);
    }
    /** Keep bodies for chunks near world x px in slices z-rangeZ..z+rangeZ. */
    sync(px, z) {
      const g = this.grid, pcx = Math.floor(px / C.CELL_W / C.CHUNK_W), maxCx = Math.ceil(g.w / C.CHUNK_W) - 1;
      const want = new Set();
      for (let zz = Math.max(0, z - this.rangeZ); zz <= Math.min(g.d - 1, z + this.rangeZ); zz++) {
        for (let cx = Math.max(0, pcx - this.rangeX); cx <= Math.min(maxCx, pcx + this.rangeX); cx++) want.add(zz + ':' + cx);
      }
      for (const key of this.dirty) if (this.chunks.has(key)) this.removeChunk(key);
      this.dirty.clear();
      for (const key of [...this.chunks.keys()]) if (!want.has(key)) this.removeChunk(key);
      for (const key of want) {
        if (this.chunks.has(key)) continue;
        const [zz, cx] = key.split(':').map(Number);
        this.chunks.set(key, this.buildChunk(zz, cx));
      }
      this.loaded = want;
    }
    /** True when terrain bodies exist under world x px in slice z (dynamic bodies there may be simulated). */
    isLoaded(px, z) { return !!(this.loaded && this.loaded.has(z + ':' + Math.floor(px / C.CELL_W / C.CHUNK_W))); }
    destroy() { for (const k of [...this.chunks.keys()]) this.removeChunk(k); if (this.unsub) this.unsub(); }
  }
  Terrain.rects = rects;
  PA.Terrain = Terrain;
  if (typeof module !== 'undefined' && module.exports) module.exports = Terrain;
})(typeof window !== 'undefined' ? window : globalThis);
