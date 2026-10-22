// Voxel terrain renderer: voxel sprites (texture, lips, ambient occlusion,
// cracks and element stains) and the Terrain cache that draws an arena as a
// chunked floor plus diagonal bands of raised content. Drawing bands
// back-to-front and inserting entities after their band gives correct
// painter's ordering.
(function (XS) {
  'use strict';

  const { mix, lighten, darken, scale } = XS.color;
  const { HX, HY, VZ } = XS.ISO;
  const SW = 2 * HX, SH = 2 * HY + VZ; // voxel sprite size

  // Face map of the voxel sprite: 0 none, 1 top, 2 left (+y), 3 right (+x).
  const FACE = (() => {
    const f = new Uint8Array(SW * SH);
    const k = HY / HX;
    for (let py = 0; py < SH; py++) {
      for (let px = 0; px < SW; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        let v = 0;
        if (Math.abs(cx - HX) / HX + Math.abs(cy - HY) / HY <= 1) v = 1;
        else if (cx < HX && cy >= HY + cx * k && cy <= HY + VZ + cx * k) v = 2;
        else if (cx >= HX && cy >= 2 * HY - (cx - HX) * k && cy <= 2 * HY + VZ - (cx - HX) * k) v = 3;
        f[py * SW + px] = v;
      }
    }
    return f;
  })();
  const faceAt = (px, py) => (px >= 0 && py >= 0 && px < SW && py < SH ? FACE[py * SW + px] : 0);
  // Row of a side pixel counted from the top edge of its face (0 .. VZ-1).
  function sideRow(face, px, py) {
    const cx = px + 0.5, k = HY / HX;
    const top = face === 2 ? HY + cx * k : 2 * HY - (cx - HX) * k;
    return Math.floor(py + 0.5 - top);
  }

  // Crack masks per variant and level: 1 = fissure pixel, 2 = chipped edge.
  // A fissure starts near the middle of the top face, wanders to an edge and
  // runs down a side face.
  const crackCache = new Map();
  function crackMask(variant, level) {
    const key = variant * 4 + level;
    let m = crackCache.get(key);
    if (m) return m;
    m = new Uint8Array(SW * SH);
    for (let k = 0; k < level; k++) {
      let x = HX + (XS.hash3f(variant, k, 11) - 0.5) * HX * 0.8, y = HY + (XS.hash3f(variant, k, 12) - 0.5) * HY * 0.6;
      let a = XS.hash3f(variant, k, 13) * Math.PI * 2;
      for (let s = 0; s < SW + VZ * 2; s++) {
        const px = Math.floor(x), py = Math.floor(y);
        const f = faceAt(px, py);
        if (!f) break;
        m[py * SW + px] = 1;
        a += (XS.hash3f(variant * 7 + k, s, 14) - 0.5) * 1.1;
        if (f !== 1) a = Math.PI / 2 + (XS.hash3f(variant, k, s) - 0.5) * 1.4; // down the side
        x += Math.cos(a); y += Math.sin(a) * (f === 1 ? 0.6 : 1);
      }
    }
    if (level >= 2) {
      // A chipped outer corner on the right face.
      const cx = SW - 2, cy = 2 * HY;
      for (let py = 0; py < SH; py++) for (let px = 0; px < SW; px++) {
        if (FACE[py * SW + px] && Math.hypot(px - cx, (py - cy) * 1.4) < 2.6 + (variant % 2)) m[py * SW + px] = 2;
      }
    }
    crackCache.set(key, m);
    return m;
  }

  // Battle marks left by elements on a voxel (see Power.ELEMENTS[].stain).
  function stainColor(col, stain, face, h) {
    const top = face === 1;
    switch (stain) {
      case 1: return h < 0.72 ? mix(col, '#1a1210', top ? 0.62 : 0.4) : col;            // scorch
      case 2: return mix(col, '#eaf8ff', top ? (h < 0.8 ? 0.6 : 0.35) : 0.22);          // frost
      case 3: return h < 0.55 ? mix(col, '#5aa02a', top ? 0.55 : 0.35) : col;           // acid
      case 4: return h > 0.975 ? '#e070ff' : h < 0.7 ? mix(col, '#22102e', top ? 0.6 : 0.35) : col; // void
      case 5: return h < 0.5 ? mix(col, '#a8fff0', top ? 0.45 : 0.25) : col;            // crystal
    }
    return col;
  }

  // flags: 1 lip back-left, 2 lip back-right, 4 AO left, 8 AO right
  // crack: 0..2 (from the voxel's hp); stain: 0..5
  function makeVoxelSprite(def, variant, z, flags, crack = 0, stain = 0) {
    const cv = XS.gfx.makeCanvas(SW, SH), g = cv.getContext('2d');
    const shade = def.emissive ? 1 : Math.max(0.74, Math.min(1.06, 0.8 + z * 0.065));
    const base = scale(def.color, shade);
    const top = def.emissive ? lighten(base, 0.2) : lighten(base, 0.12);
    const left = base;
    const right = def.emissive ? darken(base, 0.12) : darken(base, 0.24);
    const lip = lighten(base, 0.38);
    const tex = def.texture;
    const v = variant;
    const cracks = crack ? crackMask(v, crack) : null;
    for (let py = 0; py < SH; py++) {
      for (let px = 0; px < SW; px++) {
        const face = FACE[py * SW + px];
        if (!face) continue;
        const h = XS.hash3f(px + v * 31, py, v + 3);
        let col;
        if (face === 1) {
          col = top;
          const upper = faceAt(px, py - 1) !== 1, lower = faceAt(px, py + 1) !== 1;
          const inner = !upper && faceAt(px, py - 2) !== 1;
          // Texture.
          if (tex === 'tile') {
            if (lower) col = darken(col, 0.14);
            else if (inner) col = lighten(col, 0.08);
          } else if (tex === 'plate') {
            if (lower) col = darken(col, 0.18);
            else if ((px === HX - 3 || px === HX + 2) && py === HY + (v % 2 ? -1 : 0)) col = lighten(col, 0.35);
            else if (h < 0.1) col = darken(col, 0.05);
          } else if (tex === 'crystal') {
            const diag = (px + py * 2 + v * 3) % 9;
            if (diag === 0) col = lighten(col, 0.3);
            else if (diag === 1) col = lighten(col, 0.12);
            else if (lower) col = darken(col, 0.1);
          } else if (tex === 'glow') {
            const d = Math.abs(px + 0.5 - HX) / HX + Math.abs(py + 0.5 - HY) / HY;
            col = d < 0.45 ? lighten(col, 0.45) : d < 0.75 ? lighten(col, 0.2) : col;
          } else if (tex === 'grain') {
            if ((py + (v % 3)) % 3 === 0 && h < 0.7) col = darken(col, 0.07);
            if (lower) col = darken(col, 0.08);
          } else { // noise: stone / soil speckles
            col = h < 0.14 ? darken(col, 0.1) : h > 0.88 ? lighten(col, 0.08) : col;
            if (lower && h < 0.6) col = darken(col, 0.06);
          }
          if (upper && ((flags & 1) && px < HX || (flags & 2) && px >= HX)) col = lip;
          if ((flags & 4) && px < HX) col = darken(col, 0.2 * (1 - (px / HX) * 0.5));
          if ((flags & 8) && px >= HX) col = darken(col, 0.2 * (0.5 + ((px - HX) / HX) * 0.5));
        } else {
          col = face === 2 ? left : right;
          const row = sideRow(face, px, py);
          const outer = face === 2 ? px === 0 : px === SW - 1;
          const seam = face === 2 ? px === HX - 1 : px === HX;
          // Light from above: top rows of a side a touch brighter.
          if (row === 0) col = lighten(col, 0.1);
          if (tex === 'tile' || tex === 'plate') {
            if (row === VZ - 1) col = darken(col, 0.16);
            if (tex === 'plate' && (px === (face === 2 ? 3 : SW - 4))) col = darken(col, 0.1);
          } else if (tex === 'noise') {
            // Little bricks: mortar every half voxel, staggered by variant.
            const half = Math.floor(VZ / 2);
            const brickX = (px + (row < half ? 0 : 3) + v) % 6 === 0;
            if (row === half || row === VZ - 1 || (brickX && row > 0)) col = darken(col, 0.14);
            else if (h < 0.12) col = darken(col, 0.07);
          } else if (tex === 'grain') {
            if (row % 2 === 0) col = darken(col, 0.07 + (h < 0.3 ? 0.04 : 0));
          } else if (tex === 'crystal') {
            if ((px + row + v) % 7 === 0) col = lighten(col, 0.28);
          } else if (tex === 'glow') {
            col = mix(col, top, 0.25 + 0.25 * (1 - row / VZ));
          }
          if (outer && !def.emissive) col = darken(col, 0.12);
          if (seam) col = darken(col, 0.05);
        }
        if (stain) col = stainColor(col, stain, face, XS.hash3f(px + v * 31, py + 77, v + 9));
        if (cracks) {
          const c = cracks[py * SW + px];
          if (c === 1) col = darken(col, 0.5);
          else if (c === 2) col = darken(col, 0.38);
          else if (px > 0 && py > 0 && cracks[(py - 1) * SW + px - 1] === 1) col = lighten(col, 0.12);
        }
        g.fillStyle = col;
        g.fillRect(px, py, 1, 1);
      }
    }
    return cv;
  }

  const CH = 16;           // floor chunk size, in columns
  const SEG = 12;          // band segment length along x
  const FLOOR_CACHE = 64;  // floor chunk canvases kept alive

  // Terrain in two layers so big arenas stay cheap:
  // - the floor (z < base) is cached in 16x16-column chunks, drawn first and
  //   only re-rendered where something changed; chunks off screen are evicted;
  // - raised content (z >= base: props, hills, walls, rubble) plus the floor
  //   voxels on the front lip of pits lives in diagonal bands (x + y = d) cut
  //   into short segments, drawn back-to-front between entity buckets.
  class Terrain {
    constructor(world, opts = {}) {
      this.world = world;
      this.base = opts.base != null ? opts.base : (XS.Arena ? XS.Arena.BASE : 3);
      this.sprites = new Map();
      this.nBands = world.W + world.D - 1;
      this.bands = new Array(this.nBands).fill(null);
      this.bandDirty = new Uint8Array(this.nBands).fill(1);
      this.cw = Math.ceil(world.W / CH); this.cd = Math.ceil(world.D / CH);
      this.floorDirty = new Uint8Array(this.cw * this.cd).fill(1);
      this.floor = new Map();
      this.frame = 0;
      // Chunks back to front.
      this.order = [];
      for (let j = 0; j < this.cd; j++) for (let i = 0; i < this.cw; i++) this.order.push(i + j * this.cw);
      this.order.sort((a, b) => ((a % this.cw) + Math.floor(a / this.cw)) - ((b % this.cw) + Math.floor(b / this.cw)));
      world.onDirty = (x, y) => this.touch(x, y);
    }

    sprite(m, variant, z, flags, crack = 0, stain = 0) {
      const key = ((((m * 4 + variant) * 32 + z) * 16 + flags) * 3 + crack) * 6 + stain;
      let s = this.sprites.get(key);
      if (!s) {
        s = makeVoxelSprite(this.world.materials[m], variant, z, flags, crack, stain);
        this.sprites.set(key, s);
      }
      return s;
    }

    // A voxel changed at column (x, y): its band and the next two (pit lips
    // depend on the columns behind them), and the floor chunks around it.
    touch(x, y) {
      const d = x + y;
      for (let k = d - 1; k <= d + 2; k++) if (k >= 0 && k < this.nBands) this.bandDirty[k] = 1;
      const i0 = Math.max(0, (x - 1) >> 4), i1 = Math.min(this.cw - 1, (x + 1) >> 4);
      const j0 = Math.max(0, (y - 1) >> 4), j1 = Math.min(this.cd - 1, (y + 1) >> 4);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.floorDirty[i + j * this.cw] = 1;
    }

    // Floor voxels of a column go into the bands when a column behind it is
    // lower than the floor (a pit or the void), so whatever stands in the pit
    // is correctly hidden by the lip in front of it.
    isLip(x, y) {
      const w = this.world, t = (a, b) => (a < 0 || b < 0 || a >= w.W || b >= w.D ? 0 : w.colTop[a + b * w.W]);
      const base = this.base;
      return t(x - 1, y) < base || t(x, y - 1) < base || t(x - 1, y - 1) < base;
    }

    // Draw one voxel into a canvas context at canvas origin (ox0, oy0).
    drawVoxel(g, x, y, z, d, ox0, oy0) {
      const w = this.world, i = w.idx(x, y, z), m = w.mat[i];
      if (!m) return;
      const upAir = !w.solid(x, y, z + 1);
      if (!upAir && w.solid(x + 1, y, z) && w.solid(x, y + 1, z)) return; // hidden
      let flags = 0;
      if (upAir) {
        if (!w.solid(x - 1, y, z)) flags |= 1;
        if (!w.solid(x, y - 1, z)) flags |= 2;
        if (w.solid(x - 1, y, z + 1)) flags |= 4;
        if (w.solid(x, y - 1, z + 1)) flags |= 8;
      }
      const variant = Math.floor(XS.hash3f(x, y, z) * 4);
      g.drawImage(this.sprite(m, variant, Math.min(31, z), flags, XS.crackOf(w.hp[i]), w.stain[i]), (x - y) * HX - HX - ox0, d * HY - (z + 1) * VZ - oy0);
    }

    // Re-render dirty bands; call once per frame before drawing.
    update() {
      const w = this.world;
      if (w.allDirty) { this.bandDirty.fill(1); this.floorDirty.fill(1); w.allDirty = false; }
      for (let d = 0; d < this.nBands; d++) {
        if (this.bandDirty[d]) { this.renderBand(d); this.bandDirty[d] = 0; }
      }
      this.frame++;
    }

    renderBand(d) {
      const w = this.world, base = this.base;
      const xMin = Math.max(0, d - (w.D - 1)), xMax = Math.min(w.W - 1, d);
      const old = this.bands[d] || [];
      const segs = [];
      for (let k0 = xMin; k0 <= xMax; k0 += SEG) {
        const k1 = Math.min(xMax, k0 + SEG - 1);
        let maxTop = 0, minZ = Infinity, cx0 = Infinity, cx1 = -Infinity;
        for (let x = k0; x <= k1; x++) {
          const y = d - x, top = w.colTop[x + y * w.W];
          if (!top) continue;
          const z0 = this.isLip(x, y) ? 0 : base;
          if (top <= z0) continue;
          maxTop = Math.max(maxTop, top); minZ = Math.min(minZ, z0);
          cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x);
        }
        if (cx0 > cx1) continue;
        const bw = (cx1 - cx0) * 2 * HX + SW, bh = (maxTop - minZ) * VZ + 2 * HY;
        const prev = old[segs.length];
        const cv = prev && prev.cv.width >= bw && prev.cv.height >= bh ? prev.cv : XS.gfx.makeCanvas(bw, bh);
        const seg = { cv, w: bw, h: bh, sx0: (2 * cx0 - d) * HX - HX, sy0: d * HY - maxTop * VZ };
        const g = cv.getContext('2d');
        g.clearRect(0, 0, cv.width, cv.height);
        for (let x = cx0; x <= cx1; x++) {
          const y = d - x, top = w.colTop[x + y * w.W];
          const z0 = this.isLip(x, y) ? 0 : base;
          for (let z = z0; z < top; z++) this.drawVoxel(g, x, y, z, d, seg.sx0, seg.sy0);
        }
        segs.push(seg);
      }
      this.bands[d] = segs.length ? segs : null;
    }

    // Screen box of floor chunk c in world-screen coordinates.
    chunkBox(c) {
      const W = this.world.W, D = this.world.D;
      const i = c % this.cw, j = Math.floor(c / this.cw);
      const x0 = i * CH, y0 = j * CH, x1 = Math.min(W, x0 + CH), y1 = Math.min(D, y0 + CH);
      const sx0 = (x0 - (y1 - 1)) * HX - HX, sx1 = (x1 - 1 - y0) * HX + HX;
      const sy0 = (x0 + y0) * HY - this.base * VZ, sy1 = (x1 + y1 - 2) * HY + 2 * HY;
      return { x0, y0, x1, y1, sx0, sy0, w: sx1 - sx0, h: sy1 - sy0 };
    }

    renderChunk(c) {
      const w = this.world, base = this.base;
      const b = this.chunkBox(c);
      let ch = this.floor.get(c);
      if (!ch) { ch = { cv: XS.gfx.makeCanvas(b.w, b.h), used: 0 }; this.floor.set(c, ch); }
      const g = ch.cv.getContext('2d');
      g.clearRect(0, 0, b.w, b.h);
      let any = false;
      for (let d = b.x0 + b.y0; d <= b.x1 + b.y1 - 2; d++) {
        for (let x = Math.max(b.x0, d - (b.y1 - 1)); x <= Math.min(b.x1 - 1, d - b.y0); x++) {
          const y = d - x, top = Math.min(base, w.colTop[x + y * w.W]);
          for (let z = 0; z < top; z++) { this.drawVoxel(g, x, y, z, d, b.sx0, b.sy0); any = true; }
        }
      }
      ch.empty = !any;
      this.floorDirty[c] = 0;
    }

    // The floor layer: visible chunks, back to front.
    drawFloor(ctx, ox, oy, W, H) {
      for (const c of this.order) {
        const b = this.chunkBox(c);
        const x = ox + b.sx0, y = oy + b.sy0;
        if (x > W || y > H || x + b.w < 0 || y + b.h < 0) continue;
        if (this.floorDirty[c] || !this.floor.has(c)) this.renderChunk(c);
        const ch = this.floor.get(c);
        ch.used = this.frame;
        if (!ch.empty) ctx.drawImage(ch.cv, x, y);
      }
      if (this.floor.size > FLOOR_CACHE) {
        const old = [...this.floor.entries()].sort((a, b) => a[1].used - b[1].used);
        for (let k = 0; k < this.floor.size - FLOOR_CACHE; k++) this.floor.delete(old[k][0]);
      }
    }

    // ox, oy: screen offset of the world-screen origin (camera translation).
    drawBand(ctx, d, ox, oy) {
      const segs = this.bands[d];
      if (!segs) return;
      const v = this.view;
      for (const s of segs) {
        const x = ox + s.sx0, y = oy + s.sy0;
        if (v && (x > v.W || y > v.H || x + s.w < 0 || y + s.h < 0)) continue;
        ctx.drawImage(s.cv, 0, 0, s.w, s.h, x, y, s.w, s.h);
      }
    }

    // Screen rect of a band (for the see-through window test).
    bandRect(d, ox, oy) {
      const segs = this.bands[d];
      if (!segs) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of segs) { x0 = Math.min(x0, s.sx0); y0 = Math.min(y0, s.sy0); x1 = Math.max(x1, s.sx0 + s.w); y1 = Math.max(y1, s.sy0 + s.h); }
      return { x: ox + x0, y: oy + y0, w: x1 - x0, h: y1 - y0 };
    }
  }

  XS.Terrain = Terrain;
  XS.VOXEL_SPRITE = { SW, SH };
})(globalThis.XS = globalThis.XS || {});
