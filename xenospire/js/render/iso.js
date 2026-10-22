// Voxel terrain renderer. The arena is cut into diagonal bands (x + y = d);
// each band is cached on its own small canvas and only re-rendered when a voxel
// on or next to it changes. Drawing bands back-to-front and inserting entities
// after their band gives correct painter's ordering.
(function (XS) {
  'use strict';

  const { mix, lighten, darken, scale } = XS.color;

  // Face map of the 8x8 voxel sprite: 0 none, 1 top, 2 left (+y), 3 right (+x).
  const FACE = (() => {
    const f = new Uint8Array(64);
    for (let py = 0; py < 8; py++) {
      for (let px = 0; px < 8; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        let v = 0;
        if (Math.abs(cx - 4) / 4 + Math.abs(cy - 2) / 2 <= 1) v = 1;
        else if (cx < 4 && cy >= 2 + cx / 2 && cy <= 6 + cx / 2) v = 2;
        else if (cx >= 4 && cy >= 4 - (cx - 4) / 2 && cy <= 8 - (cx - 4) / 2) v = 3;
        f[py * 8 + px] = v;
      }
    }
    return f;
  })();
  const isTop = (px, py) => px >= 0 && py >= 0 && px < 8 && py < 8 && FACE[py * 8 + px] === 1;

  // flags: 1 lip back-left, 2 lip back-right, 4 AO left, 8 AO right
  function makeVoxelSprite(def, variant, z, flags) {
    const cv = XS.gfx.makeCanvas(8, 8), g = cv.getContext('2d');
    const shade = def.emissive ? 1 : Math.max(0.74, Math.min(1.06, 0.8 + z * 0.065));
    const base = scale(def.color, shade);
    const top = def.emissive ? lighten(base, 0.18) : lighten(base, 0.12);
    const left = base;
    const right = def.emissive ? darken(base, 0.12) : darken(base, 0.24);
    const lip = lighten(base, 0.38);
    const tex = def.texture;
    for (let py = 0; py < 8; py++) {
      for (let px = 0; px < 8; px++) {
        const face = FACE[py * 8 + px];
        if (!face) continue;
        let col = face === 1 ? top : face === 2 ? left : right;
        const h = XS.hash3f(px + variant * 17, py, variant + 3);
        if (face === 1) {
          if ((flags & 1) && px < 4 && !isTop(px, py - 1)) col = lip;
          else if ((flags & 2) && px >= 4 && !isTop(px, py - 1)) col = lip;
          else if (tex === 'tile' && !isTop(px, py + 1)) col = darken(col, 0.1);
          else if (tex === 'plate' && px === 4 && py === 1 + (variant % 2)) col = lighten(col, 0.25);
          else if (tex === 'crystal' && (px + py) % 5 === variant % 5) col = lighten(col, 0.22);
          else if (tex === 'glow' && py >= 1 && py <= 2 && px >= 3 && px <= 4) col = lighten(col, 0.4);
          else if (tex === 'noise' || tex === 'grain') col = h < 0.18 ? darken(col, 0.07) : h > 0.85 ? lighten(col, 0.06) : col;
          if ((flags & 4) && px < 4) col = darken(col, 0.2);
          if ((flags & 8) && px >= 4) col = darken(col, 0.2);
        } else {
          // Bottom seam on stacked blocks (brick look) and per-material texture.
          const bottomRow = face === 2 ? py === Math.floor(5.5 + (px + 0.5) / 2) : py === Math.floor(7.5 - (px - 3.5) / 2);
          if ((tex === 'tile' || tex === 'noise' || tex === 'plate') && bottomRow) col = darken(col, 0.14);
          else if (tex === 'grain' && py % 2 === 0) col = darken(col, 0.08);
          else if (tex === 'crystal' && face === 2 && px === 1 + (variant % 2)) col = lighten(col, 0.25);
          else if (tex === 'noise' && h < 0.15) col = darken(col, 0.08);
          else if (tex === 'glow' && face === 3) col = mix(col, top, 0.3);
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
      this.originX = world.D * XS.ISO.HX + 4;
      this.bandW = (world.W + world.D) * XS.ISO.HX + 12;
      this.bandH = world.H * XS.ISO.VZ + 8;
      this.bands = new Array(world.W + world.D - 1).fill(null);
    }

    sprite(m, variant, z, flags) {
      const key = ((m * 4 + variant) * 32 + z) * 16 + flags;
      let s = this.sprites.get(key);
      if (!s) {
        s = makeVoxelSprite(this.world.materials[m], variant, z, flags);
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

    bandTop(d) { return d * XS.ISO.HY - this.world.H * XS.ISO.VZ; }

    renderBand(d) {
      const w = this.world;
      let band = this.bands[d];
      if (!band) {
        band = XS.gfx.makeCanvas(this.bandW, this.bandH);
        this.bands[d] = band;
      }
      const g = band.getContext('2d');
      g.clearRect(0, 0, this.bandW, this.bandH);
      const xMin = Math.max(0, d - (w.D - 1)), xMax = Math.min(w.W - 1, d);
      for (let x = xMin; x <= xMax; x++) {
        const y = d - x;
        const top = w.colTop[x + y * w.W];
        for (let z = 0; z < top; z++) {
          const m = w.mat[w.idx(x, y, z)];
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
          const sx = (x - y) * XS.ISO.HX - 4 + this.originX;
          const sy = (w.H - z - 1) * XS.ISO.VZ;
          g.drawImage(this.sprite(m, variant, Math.min(31, z), flags), sx, sy);
        }
      }
    }

    // ox, oy: screen offset of world-screen origin (camera translation).
    drawBand(ctx, d, ox, oy) {
      const b = this.bands[d];
      if (b) ctx.drawImage(b, ox - this.originX, oy + this.bandTop(d));
    }
  }

  XS.Terrain = Terrain;
})(globalThis.XS = globalThis.XS || {});
