/* 3D cell grid: x columns, y rows (down), z slices (0 = nearest). Tracks player edits for saves. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  class Grid {
    constructor(w, h, d) {
      this.w = w; this.h = h; this.d = d;
      this.t = new Uint8Array(w * h * d);
      this.m = new Uint8Array(w * h * d);
      this.edits = new Set();
      this.listeners = [];
    }
    idx(x, y, z) { return (z * this.h + y) * this.w + x; }
    inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d; }
    get(x, y, z) {
      if (z < 0 || z >= this.d || y < 0) return 0;
      if (y >= this.h) return PA.T.BEDROCK;
      if (x < 0 || x >= this.w) return PA.T.STONE;
      return this.t[(z * this.h + y) * this.w + x];
    }
    set(x, y, z, t, log = true) {
      if (!this.inside(x, y, z)) return;
      const i = this.idx(x, y, z);
      this.t[i] = t;
      if (log) this.edits.add(i);
      for (const fn of this.listeners) fn(x, y, z);
    }
    meta(x, y, z) { return this.inside(x, y, z) ? this.m[this.idx(x, y, z)] : 0; }
    setMeta(x, y, z, v, log = true) {
      if (!this.inside(x, y, z)) return;
      const i = this.idx(x, y, z);
      this.m[i] = v;
      if (log) this.edits.add(i);
      for (const fn of this.listeners) fn(x, y, z);
    }
    /** Set tile + meta in one call (one change notification). */
    put(x, y, z, t, meta = 0, log = true) {
      if (!this.inside(x, y, z)) return;
      const i = this.idx(x, y, z);
      this.t[i] = t; this.m[i] = meta;
      if (log) this.edits.add(i);
      for (const fn of this.listeners) fn(x, y, z);
    }
    def(x, y, z) { return PA.TILES[this.get(x, y, z)]; }
    solid(x, y, z) { const d = PA.TILES[this.get(x, y, z)]; return !!(d && d.solid); }
    surfaceY(x, z) { for (let y = 0; y < this.h; y++) if (this.solid(x, y, z)) return y; return this.h; }
    onChange(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
    exportEdits() { const out = []; for (const i of this.edits) out.push([i, this.t[i], this.m[i]]); return out; }
    importEdits(list) {
      for (const e of list || []) {
        const i = e[0]; if (i < 0 || i >= this.t.length) continue;
        this.t[i] = e[1] | 0; this.m[i] = e[2] | 0; this.edits.add(i);
      }
    }
    coords(i) { const x = i % this.w, y = Math.floor(i / this.w) % this.h, z = Math.floor(i / (this.w * this.h)); return { x, y, z }; }
  }
  PA.Grid = Grid;
  if (typeof module !== 'undefined' && module.exports) module.exports = Grid;
})(typeof window !== 'undefined' ? window : globalThis);
