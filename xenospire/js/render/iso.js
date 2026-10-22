// Voxel terrain renderer. The arena is cut into diagonal bands (x + y = d);
// each band is cached on its own canvas, cropped to its content, and only
// re-rendered when a voxel on or next to it changes. Drawing bands
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

  class Terrain {
    constructor(world) {
      this.world = world;
      this.sprites = new Map();
      this.bands = new Array(world.W + world.D - 1).fill(null);
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

    // Re-render dirty bands; call once per frame before drawing.
    update() {
      const w = this.world;
      for (let d = 0; d < this.bands.length; d++) {
        if (w.allDirty || w.dirty[d] || !this.bands[d]) {
          this.renderBand(d);
          w.dirty[d] = 0;
        }
      }
      w.allDirty = false;
    }

    renderBand(d) {
      const w = this.world;
      const xMin = Math.max(0, d - (w.D - 1)), xMax = Math.min(w.W - 1, d);
      let maxTop = 0;
      for (let x = xMin; x <= xMax; x++) maxTop = Math.max(maxTop, w.colTop[x + (d - x) * w.W]);
      let band = this.bands[d];
      if (!band) band = this.bands[d] = { cv: null, w: 0, h: 0, sx0: 0, sy0: 0, empty: true, topZ: 0 };
      band.empty = maxTop === 0;
      if (band.empty) return;
      // Leave headroom for voxels that powers may raise later.
      const topZ = Math.min(w.H, maxTop + 2);
      const bw = (xMax - xMin) * 2 * HX + SW, bh = topZ * VZ + 2 * HY;
      if (!band.cv || band.cv.width < bw || band.cv.height < bh) band.cv = XS.gfx.makeCanvas(bw, bh);
      band.w = bw; band.h = bh; band.topZ = topZ;
      band.sx0 = (2 * xMin - d) * HX - HX;
      band.sy0 = d * HY - topZ * VZ;
      const g = band.cv.getContext('2d');
      g.clearRect(0, 0, band.cv.width, band.cv.height);
      for (let x = xMin; x <= xMax; x++) {
        const y = d - x;
        const top = w.colTop[x + y * w.W];
        for (let z = 0; z < top; z++) {
          const i = w.idx(x, y, z);
          const m = w.mat[i];
          if (!m) continue;
          const upAir = !w.solid(x, y, z + 1);
          if (!upAir && w.solid(x + 1, y, z) && w.solid(x, y + 1, z)) continue; // hidden
          let flags = 0;
          if (upAir) {
            if (!w.solid(x - 1, y, z)) flags |= 1;
            if (!w.solid(x, y - 1, z)) flags |= 2;
            if (w.solid(x - 1, y, z + 1)) flags |= 4;
            if (w.solid(x, y - 1, z + 1)) flags |= 8;
          }
          const variant = Math.floor(XS.hash3f(x, y, z) * 4);
          g.drawImage(this.sprite(m, variant, Math.min(31, z), flags, XS.crackOf(w.hp[i]), w.stain[i]), (x - y) * HX - HX - band.sx0, d * HY - (z + 1) * VZ - band.sy0);
        }
      }
    }

    // ox, oy: screen offset of the world-screen origin (camera translation).
    drawBand(ctx, d, ox, oy) {
      const b = this.bands[d];
      if (b && !b.empty) ctx.drawImage(b.cv, 0, 0, b.w, b.h, ox + b.sx0, oy + b.sy0, b.w, b.h);
    }

    // Screen rect of a band (for the see-through window test).
    bandRect(d, ox, oy) {
      const b = this.bands[d];
      if (!b || b.empty) return null;
      return { x: ox + b.sx0, y: oy + b.sy0, w: b.w, h: b.h };
    }
  }

  XS.Terrain = Terrain;
  XS.VOXEL_SPRITE = { SW, SH };
})(globalThis.XS = globalThis.XS || {});
