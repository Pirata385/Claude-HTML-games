/* Draws the world as vector strokes into the ASCII buffer, slice by slice (far to near). Terrain outlines are
 * cached as Path2D per (slice, chunk) in world px; paper fills behind solid cells occlude farther slices. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const CW = C.CELL_W, CH = C.CELL_H, OFF = 1.6; // lines sit just inside the upper/outer cell

  class WorldDraw {
    constructor(map) { this.setMap(map); }
    setMap(map) {
      if (this.unsub) this.unsub();
      this.map = map; this.grid = map.grid;
      this.cache = new Map();
      this.unsub = this.grid.onChange((x, y, z) => {
        const cx = Math.floor(x / C.CHUNK_W);
        this.cache.delete(z + ':' + cx);
        if (x % C.CHUNK_W === 0) this.cache.delete(z + ':' + (cx - 1));
        if (x % C.CHUNK_W === C.CHUNK_W - 1) this.cache.delete(z + ':' + (cx + 1));
      });
      this.indexProps();
    }
    indexProps() {
      this.propsBy = [];
      for (const p of this.map.props || []) (this.propsBy[p.z] = this.propsBy[p.z] || []).push(p);
    }
    invalidateAll() { this.cache.clear(); }
    solidOpaque(x, y, z) { const d = PA.TILES[this.grid.get(x, y, z)]; return !!(d && d.solid && d.opaque && !d.noDraw); }
    build(z, cx) {
      const g = this.grid, T = PA.T, x0 = cx * C.CHUNK_W, x1 = Math.min(x0 + C.CHUNK_W, g.w);
      const fill = new Path2D(), edge = new Path2D(), dots = new Path2D(), water = new Path2D(), waterLine = new Path2D(), thin = new Path2D();
      const stamps = [];
      const so = (x, y) => this.solidOpaque(x, y, z);
      for (let y = 0; y < g.h; y++) {
        let run = -1;
        for (let x = x0; x <= x1; x++) {
          const top = x < x1 && so(x, y) && !so(x, y - 1) && y > 0;
          if (top && run < 0) run = x;
          if (!top && run >= 0) { edge.moveTo(run * CW, y * CH - OFF); edge.lineTo(x * CW, y * CH - OFF); run = -1; }
        }
        for (let x = x0; x < x1; x++) {
          const t = g.get(x, y, z), d = PA.TILES[t];
          if (!d) continue;
          const h = PA.RNG.hash3(x, y, z, 31);
          if (d.water) {
            water.rect(x * CW, y * CH, CW, CH);
            if (g.get(x, y - 1, z) === T.AIR) {
              const yy = y * CH + 3;
              waterLine.moveTo(x * CW, yy);
              waterLine.quadraticCurveTo(x * CW + 3, yy - 3, x * CW + 6, yy);
              waterLine.quadraticCurveTo(x * CW + 9, yy + 3, x * CW + 12, yy);
            } else if (h % 7 === 0) { thin.moveTo(x * CW + 2, y * CH + 10); thin.lineTo(x * CW + 9, y * CH + 10); }
            continue;
          }
          if (d.ladder) {
            thin.moveTo(x * CW + 2.5, y * CH); thin.lineTo(x * CW + 2.5, y * CH + CH);
            thin.moveTo(x * CW + 9.5, y * CH); thin.lineTo(x * CW + 9.5, y * CH + CH);
            thin.moveTo(x * CW + 2.5, y * CH + 10); thin.lineTo(x * CW + 9.5, y * CH + 10);
            continue;
          }
          if (d.meta !== false && (t === T.DECO || t === T.ART || t === T.DOOR || t === T.CROP || t === T.FORAGE || t === T.OBJ || t === T.LEAVES || t === T.TRUNK)) {
            const m = g.meta(x, y, z);
            if (m && m !== 32) stamps.push([x, y, String.fromCharCode(m)]);
            if (d.opaque) fill.rect(x * CW - 0.5, y * CH - 0.5, CW + 1, CH + 1);
            continue;
          }
          if (t === T.WEED) { thin.moveTo(x * CW + 3, y * CH + CH - OFF); thin.lineTo(x * CW + 4, y * CH + 9); thin.moveTo(x * CW + 8, y * CH + CH - OFF); thin.lineTo(x * CW + 7, y * CH + 8); continue; }
          if (t === T.FLOWER) { thin.moveTo(x * CW + 6, y * CH + CH - OFF); thin.lineTo(x * CW + 6, y * CH + 9); dots.moveTo(x * CW + 8.5, y * CH + 7); dots.arc(x * CW + 6, y * CH + 7, 2.5, 0, Math.PI * 2); continue; }
          if (t === T.ROCK) { edge.moveTo(x * CW + 1, y * CH + CH - OFF); edge.quadraticCurveTo(x * CW + 6, y * CH + 4, x * CW + 11, y * CH + CH - OFF); continue; }
          if (t === T.BRANCH) { thin.moveTo(x * CW + 1, y * CH + CH - 3); thin.lineTo(x * CW + 11, y * CH + CH - 7); continue; }
          if (!d.solid || !d.opaque || d.noDraw) continue;
          fill.rect(x * CW - 0.5, y * CH - 0.5, CW + 1, CH + 1);
          const L = !so(x - 1, y), R = !so(x + 1, y), B = y + 1 < g.h && !so(x, y + 1);
          if (L) { edge.moveTo(x * CW + OFF, y * CH - OFF); edge.lineTo(x * CW + OFF, y * CH + CH - OFF); }
          if (R) { edge.moveTo(x * CW + CW - OFF, y * CH - OFF); edge.lineTo(x * CW + CW - OFF, y * CH + CH - OFF); }
          if (B) { edge.moveTo(x * CW, y * CH + CH - OFF); edge.lineTo(x * CW + CW, y * CH + CH - OFF); }
          const exposed = !so(x, y - 1);
          if (exposed && t === T.GRASS && h % 9 === 0) { thin.moveTo(x * CW + 4, y * CH - OFF); thin.lineTo(x * CW + 2.5, y * CH - 8); thin.moveTo(x * CW + 6, y * CH - OFF); thin.lineTo(x * CW + 8, y * CH - 9); }
          if (t === T.SOIL || t === T.SOIL_WET) {
            thin.moveTo(x * CW + 1, y * CH + 5); thin.lineTo(x * CW + 11, y * CH + 5);
            thin.moveTo(x * CW + 1, y * CH + 12); thin.lineTo(x * CW + 11, y * CH + 12);
            if (t === T.SOIL_WET) { thin.moveTo(x * CW + 1, y * CH + 8.5); thin.lineTo(x * CW + 11, y * CH + 8.5); thin.moveTo(x * CW + 1, y * CH + 16); thin.lineTo(x * CW + 11, y * CH + 16); }
          }
          if (d.style === 2) { // ore: a small filled nugget
            dots.moveTo(x * CW + 9, y * CH + 10); dots.arc(x * CW + 6, y * CH + 10, 3, 0, Math.PI * 2);
          }
        }
      }
      return { fill, edge, dots, water, waterLine, thin, stamps };
    }
    chunk(z, cx) {
      const k = z + ':' + cx;
      let c = this.cache.get(k);
      if (!c) { c = this.build(z, cx); this.cache.set(k, c); }
      return c;
    }
    /** Draw slice z with projection p. level: 0 current, >0 farther, -1 ghost in front. */
    drawSlice(R, z, p, level, season) {
      const ctx = R.ctx, g = this.grid;
      R.use(p);
      const ghost = level < 0;
      const shade = ghost ? '#c8c8c8' : level === 0 ? '#000' : level === 1 ? '#3a3a3a' : level === 2 ? '#5a5a5a' : '#777';
      const lw = R.lw(p, ghost ? 0.6 : level === 0 ? 0.95 : level === 1 ? 0.85 : level === 2 ? 0.75 : 0.65);
      const wx0 = -p.ox / p.scale - CW, wx1 = (R.W - p.ox) / p.scale + CW;
      const cx0 = Math.max(0, Math.floor(wx0 / CW / C.CHUNK_W)), cx1 = Math.min(Math.ceil(g.w / C.CHUNK_W) - 1, Math.floor(wx1 / CW / C.CHUNK_W));
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const st = { lw, ink: shade, paper: '#ffffff' };
      // far props behind the terrain of their own slice? No: props stand on it, draw terrain first.
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = this.chunk(z, cx);
        if (!ghost) { ctx.fillStyle = '#ffffff'; ctx.fill(c.fill); ctx.fill(c.water); }
        ctx.strokeStyle = shade; ctx.lineWidth = lw;
        ctx.stroke(c.edge);
        ctx.lineWidth = lw * 0.85; ctx.stroke(c.waterLine);
        if (level <= 2) { ctx.lineWidth = lw * 0.8; ctx.stroke(c.thin); ctx.fillStyle = shade; ctx.fill(c.dots); }
        if (level === 0) for (const s of c.stamps) R.stamp(p.ox + (s[0] + 0.5) * CW * p.scale, p.oy + (s[1] + 0.5) * CH * p.scale, s[2]);
        else if (level > 0 && level <= 2 && c.stamps.length) {
          ctx.fillStyle = shade; ctx.font = '16px monospace'; ctx.textAlign = 'center';
          for (const s of c.stamps) ctx.fillText(s[2], (s[0] + 0.5) * CW, s[1] * CH + 15);
        }
      }
      const props = this.propsBy[z];
      if (props && !ghost) {
        for (const pr of props) {
          if (pr.front) continue;
          const e = PA.Props.extent(pr);
          if (e[1] < wx0 || e[0] > wx1) continue;
          PA.Props.draw(ctx, pr, season, st, R, p);
        }
      }
      st.wx0 = wx0; st.wx1 = wx1;
      return st;
    }
    /** Props that stand in front of the actors of their slice (shop counters). */
    drawFront(R, z, p, st, season) {
      const props = this.propsBy[z];
      if (!props || p.level < 0) return;
      R.use(p);
      for (const pr of props) {
        if (!pr.front) continue;
        const e = PA.Props.extent(pr);
        if (e[1] < st.wx0 || e[0] > st.wx1) continue;
        PA.Props.draw(R.ctx, pr, season, st, R, p);
      }
    }
  }
  PA.WorldDraw = WorldDraw;
})(typeof window !== 'undefined' ? window : globalThis);
