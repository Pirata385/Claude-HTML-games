/* Dynamic glyph layers, one pair of Blitters (full cell + half cell) per world slice, with bob pooling. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;

  class Layer {
    constructor(scene, half, parent) {
      this.bl = scene.make.blitter({ x: 0, y: 0, key: 'glyphs', add: false });
      parent.add(this.bl);
      this.pool = []; this.n = 0; this.half = half;
    }
    put(lx, ly, frame) {
      let b = this.pool[this.n];
      if (b) { b.reset(lx, ly, frame); b.visible = true; } else { b = this.bl.create(lx, ly, frame); this.pool.push(b); }
      this.n++;
      return b;
    }
    end() { for (let i = this.n; i < this.pool.length; i++) this.pool[i].visible = false; }
  }

  class Entities {
    constructor(scene, stack) { this.scene = scene; this.stack = stack; this.slices = []; this.proj = []; }
    setStack(stack) { this.destroy(); this.stack = stack; }
    layer(z) {
      let s = this.slices[z];
      if (!s) {
        const cont = this.stack.container(z);
        const halfC = this.scene.make.container({ x: 0, y: 0, add: false }).setScale(0.5);
        cont.add(halfC);
        s = this.slices[z] = { full: new Layer(this.scene, false, cont), half: new Layer(this.scene, true, halfC), halfC };
      }
      return s;
    }
    begin(proj) {
      this.proj = proj;
      for (let z = 0; z < this.slices.length; z++) {
        const s = this.slices[z]; if (!s) continue;
        s.full.n = 0; s.half.n = 0;
      }
    }
    /** Draw text lines with top-left at world (wx, wy). opts: {half, style, invert, center, bottom} */
    text(z, wx, wy, lines, opts) {
      const p = this.proj[z];
      if (!p) return;
      const o = opts || {};
      const s = this.layer(z);
      const L = o.half ? s.half : s.full;
      const cw = o.half ? C.CELL_W / 2 : C.CELL_W, chh = o.half ? C.CELL_H / 2 : C.CELL_H;
      const mul = o.half ? 4 : 2;
      if (typeof lines === 'string') lines = [lines];
      let w = 0; for (const l of lines) if (l.length > w) w = l.length;
      let x0 = wx, y0 = wy;
      if (o.center) x0 -= (w * cw) / 2;
      if (o.bottom) y0 -= lines.length * chh;
      const level = p.level;
      const style = o.invert ? 2 : (o.style != null ? o.style : (level <= 0 ? 1 : 0));
      for (let r = 0; r < lines.length; r++) {
        const line = lines[r];
        for (let c = 0; c < line.length; c++) {
          let ch = line[c];
          if (ch === ' ' && !o.invert) continue;
          if (level >= 2 && !PA.SliceStack.keep(c + Math.floor(x0 / cw), r, level)) continue;
          if (level >= 1) ch = PA.SliceStack.lighten(ch, level);
          L.put((x0 + c * cw) * mul, (y0 + r * chh) * mul, PA.Glyphs.frame(ch, style, 0));
        }
      }
    }
    /** Rasterise world-px segments (relative to wx, wy) into half-cell ASCII and draw them. */
    segs(z, wx, wy, segs, opts) {
      if (!this.proj[z]) return;
      const hw = C.CELL_W / 2, hh = C.CELL_H / 2;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of segs) {
        minX = Math.min(minX, s.x1, s.x2); maxX = Math.max(maxX, s.x1, s.x2);
        minY = Math.min(minY, s.y1, s.y2); maxY = Math.max(maxY, s.y1, s.y2);
      }
      // snap the grid origin to the half-cell lattice so glyphs don't swim
      const gx = Math.floor((wx + minX) / hw) * hw, gy = Math.floor((wy + minY) / hh) * hh;
      const cols = Math.ceil((wx + maxX - gx) / hw) + 1, rows = Math.ceil((wy + maxY - gy) / hh) + 1;
      const cs = segs.map((s) => ({ x1: (wx + s.x1 - gx) / hw, y1: (wy + s.y1 - gy) / hh, x2: (wx + s.x2 - gx) / hw, y2: (wy + s.y2 - gy) / hh }));
      const out = PA.Rasterize.segmentsToCells(cs, cols, rows);
      this.text(z, gx, gy, out, Object.assign({ half: true }, opts));
    }
    end() {
      for (const s of this.slices) if (s) { s.full.end(); s.half.end(); }
    }
    destroy() { for (const s of this.slices) if (s) { s.full.bl.destroy(); s.half.bl.destroy(); s.halfC.destroy(); } this.slices = []; }
  }
  PA.Entities = Entities;
})(typeof window !== 'undefined' ? window : globalThis);
