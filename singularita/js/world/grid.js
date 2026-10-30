// ZoneGrid: one cell per metre. Heights are whole blocks; walls are cave rock columns.
// Collision, camera rays, pathing, spawning and the minimap all read this one structure.
import { hashStr } from '../core/rng.js';

export const F = {
  WALL: 1, WATER: 2, BASE: 4, ARENA: 8, PATH: 16, POI: 32, NOSPAWN: 64, HAZARD: 128,
  OBSTACLE: 256, DEEP: 512, HOT: 1024, COLD: 2048, VOID: 4096, LAVA: 8192, TIDAL: 16384,
};
export const SURF = { SAND: 0, GRASS: 1, FOREST: 2, ROCK: 3, PATH: 4, DIRT: 5, BASE: 6, SNOW: 7, FLOOR: 8, WALL: 9, HOT: 10, COLD: 11, ARENA: 12, SEABED: 13,
  LAVA: 14, BASALT: 15, ROOT: 16, CORAL: 17, BRIDGE: 18 };

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export { N4, N8 };

export class ZoneGrid {
  constructor(w, d) {
    this.w = w; this.d = d;
    this.h = new Int16Array(w * d);
    this.flags = new Uint16Array(w * d);
    this.surf = new Uint8Array(w * d);
    this.wallHeight = 0;
    this.seaLevel = -100;
  }
  idx(i, j) { return j * this.w + i; }
  inside(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.d; }
  cellAt(x, z) { return [Math.floor(x), Math.floor(z)]; }
  has(i, j, flag) { return this.inside(i, j) && (this.flags[this.idx(i, j)] & flag) !== 0; }
  set(i, j, flag) { this.flags[this.idx(i, j)] |= flag; }
  clear(i, j, flag) { this.flags[this.idx(i, j)] &= ~flag; }
  setWall(i, j) { this.flags[this.idx(i, j)] |= F.WALL; }
  height(i, j) { return this.inside(i, j) ? this.h[this.idx(i, j)] : -100; }
  // Top of whatever occupies the cell (walls rise above the floor).
  top(i, j) {
    if (!this.inside(i, j)) return 1000;
    const k = this.idx(i, j);
    return this.flags[k] & F.WALL ? this.h[k] + this.wallHeight : this.h[k];
  }
  walkable(i, j) {
    if (!this.inside(i, j)) return false;
    const f = this.flags[this.idx(i, j)];
    return (f & (F.WALL | F.DEEP | F.OBSTACLE | F.VOID)) === 0;
  }
  canStep(i0, j0, i1, j1, maxStep) {
    return this.walkable(i1, j1) && this.height(i1, j1) - this.height(i0, j0) <= maxStep;
  }
  // Breadth-first distances (in steps) from a cell; −1 means unreachable.
  bfs(si, sj, { maxStep = 1, passable = null, maxDist = Infinity } = {}) {
    const dist = new Int32Array(this.w * this.d).fill(-1);
    if (!this.inside(si, sj)) return dist;
    const q = new Int32Array(this.w * this.d);
    let head = 0, tail = 0;
    const s = this.idx(si, sj);
    dist[s] = 0; q[tail++] = s;
    while (head < tail) {
      const k = q[head++];
      const i = k % this.w, j = (k - i) / this.w, dk = dist[k];
      if (dk >= maxDist) continue;
      for (const [di, dj] of N4) {
        const ni = i + di, nj = j + dj;
        if (!this.inside(ni, nj)) continue;
        const nk = this.idx(ni, nj);
        if (dist[nk] !== -1) continue;
        if (passable ? !passable(ni, nj, i, j) : !this.canStep(i, j, ni, nj, maxStep)) continue;
        dist[nk] = dk + 1; q[tail++] = nk;
      }
    }
    return dist;
  }
  hashCode() {
    let h = 0x811c9dc5;
    const mix = (v) => { h ^= v & 0xffff; h = Math.imul(h, 0x01000193); };
    for (let k = 0; k < this.h.length; k++) { mix(this.h[k]); mix(this.flags[k]); mix(this.surf[k]); }
    return (h ^ hashStr(`${this.w}x${this.d}`)) >>> 0;
  }
}
