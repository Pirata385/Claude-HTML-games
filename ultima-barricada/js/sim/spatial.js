// Uniform-grid spatial hash rebuilt every tick: cheap neighbour and target queries for
// hundreds of zombies without O(n²) scans.
(function (UB) {
  'use strict';

  function Grid(size, cell) {
    this.cell = cell;
    this.cw = Math.ceil(size / cell);
    this.head = new Int32Array(this.cw * this.cw);
    this.next = new Int32Array(256);
    this.items = [];
  }
  Grid.prototype.rebuild = function (list) {
    this.head.fill(-1);
    if (this.next.length < list.length) this.next = new Int32Array(list.length * 2);
    this.items = list;
    const c = this.cell, cw = this.cw;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (e.dead || e.hidden) { this.next[k] = -2; continue; }
      let cx = Math.floor(e.x / c), cy = Math.floor(e.y / c);
      cx = cx < 0 ? 0 : cx >= cw ? cw - 1 : cx;
      cy = cy < 0 ? 0 : cy >= cw ? cw - 1 : cy;
      const ci = cy * cw + cx;
      this.next[k] = this.head[ci];
      this.head[ci] = k;
    }
  };
  // Calls fn(e, d2) for every live entity within r of (x, y). Return true from fn to stop.
  Grid.prototype.query = function (x, y, r, fn) {
    const c = this.cell, cw = this.cw, r2 = r * r;
    const x0 = Math.max(0, Math.floor((x - r) / c)), x1 = Math.min(cw - 1, Math.floor((x + r) / c));
    const y0 = Math.max(0, Math.floor((y - r) / c)), y1 = Math.min(cw - 1, Math.floor((y + r) / c));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let k = this.head[cy * cw + cx]; k >= 0; k = this.next[k]) {
        const e = this.items[k];
        const dx = e.x - x, dy = e.y - y, d2 = dx * dx + dy * dy;
        if (d2 <= r2 && fn(e, d2)) return;
      }
    }
  };
  Grid.prototype.nearest = function (x, y, r, filter) {
    let best = null, bd = Infinity;
    this.query(x, y, r, (e, d2) => { if (d2 < bd && (!filter || filter(e))) { bd = d2; best = e; } });
    return best;
  };
  Grid.prototype.count = function (x, y, r) {
    let n = 0;
    this.query(x, y, r, () => { n++; });
    return n;
  };

  UB.Spatial = { Grid };
})(globalThis.UB = globalThis.UB || {});
