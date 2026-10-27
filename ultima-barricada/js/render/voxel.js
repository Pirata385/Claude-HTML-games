// Voxel models and the baker that turns them into isometric pixel-art sprites.
// 1 voxel = a 4×2 px diamond with 2 px sides; 8 voxels = 1 map tile (32×16 px).
// Sprites get face shading, a little per-voxel texture, ground contact darkening and a dark
// outline so silhouettes stay readable; a separate shadow sprite is cast on the ground.
(function (UB) {
  'use strict';

  function Model(w, d, h) {
    this.w = w; this.d = d; this.h = h;
    this.data = new Uint8Array(w * d * h);
    this.pal = [0];
    this.palIdx = new Map();
  }
  Model.prototype.col = function (hex) {
    let i = this.palIdx.get(hex);
    if (i === undefined) { i = this.pal.length; this.pal.push(hex); this.palIdx.set(hex, i); }
    return i;
  };
  Model.prototype.inb = function (x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.d && z < this.h; };
  Model.prototype.set = function (x, y, z, hex) {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (!this.inb(x, y, z)) return;
    this.data[(z * this.d + y) * this.w + x] = hex === null ? 0 : this.col(hex);
  };
  Model.prototype.get = function (x, y, z) {
    if (!this.inb(x, y, z)) return 0;
    return this.data[(z * this.d + y) * this.w + x];
  };
  Model.prototype.clear = function (x, y, z) { this.set(x, y, z, null); };
  // Inclusive box fill; hex may be a function (x, y, z) -> hex|null.
  Model.prototype.box = function (x0, y0, z0, x1, y1, z1, hex) {
    for (let z = Math.max(0, z0); z <= Math.min(this.h - 1, z1); z++)
      for (let y = Math.max(0, y0); y <= Math.min(this.d - 1, y1); y++)
        for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
          const c = typeof hex === 'function' ? hex(x, y, z) : hex;
          if (c !== undefined) this.set(x, y, z, c);
        }
    return this;
  };
  // Hollow box: walls only (cheaper to bake, same look).
  Model.prototype.shell = function (x0, y0, z0, x1, y1, z1, hex) {
    return this.box(x0, y0, z0, x1, y1, z1, (x, y, z) => (x === x0 || x === x1 || y === y0 || y === y1 || z === z1 ? (typeof hex === 'function' ? hex(x, y, z) : hex) : undefined));
  };
  Model.prototype.sphere = function (cx, cy, cz, r, hex, ry, rz) {
    ry = ry || r; rz = rz || r;
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const d = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d <= 1) { const c = typeof hex === 'function' ? hex(x, y, z, d) : hex; if (c !== undefined) this.set(x, y, z, c); }
        }
    return this;
  };
  // New model rotated by r quarter turns around the vertical axis (facing +x -> +y -> -x -> -y).
  Model.prototype.rotate = function (r) {
    r = ((r % 4) + 4) % 4;
    if (!r) return this;
    const swap = r % 2 === 1;
    const m = new Model(swap ? this.d : this.w, swap ? this.w : this.d, this.h);
    m.pal = this.pal.slice(); m.palIdx = new Map(this.palIdx);
    for (let z = 0; z < this.h; z++) for (let y = 0; y < this.d; y++) for (let x = 0; x < this.w; x++) {
      const v = this.data[(z * this.d + y) * this.w + x];
      if (!v) continue;
      let nx, ny;
      if (r === 1) { nx = this.d - 1 - y; ny = x; }
      else if (r === 2) { nx = this.w - 1 - x; ny = this.d - 1 - y; }
      else { nx = y; ny = this.w - 1 - x; }
      m.data[(z * m.d + ny) * m.w + nx] = v;
    }
    return m;
  };

  const OUTLINE = 0xff120e14; // ABGR for ImageData (opaque near-black)
  function shade(hex, k) {
    const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * k)));
    const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * k)));
    const b = Math.min(255, Math.max(0, Math.round((hex & 255) * k)));
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }

  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined' && !UB.forceDomCanvas) {
      try { return new OffscreenCanvas(w, h); } catch (e) { /* fall through */ }
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Bake a model to a sprite. Returns {c, ox, oy, w, h}: draw at (x - ox, y - oy) where
  // (x, y) is the screen position of the model's ground centre.
  function bake(m, opts) {
    opts = opts || {};
    const W = m.w, D = m.d, H = m.h;
    const minSx = -2 * D, maxSx = 2 * W, minSy = -2 * H, maxSy = W + D;
    const pad = 1;
    const cw = maxSx - minSx + pad * 2, chh = maxSy - minSy + pad * 2;
    const buf = new Uint32Array(cw * chh);
    const noise = opts.noise === undefined ? 0.07 : opts.noise;
    const top = opts.top || 1, left = opts.left || 0.8, right = opts.right || 0.6;
    const pal = m.pal;
    const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < cw && y < chh) buf[y * cw + x] = v; };
    for (let s = 0; s <= W + D - 2; s++) {
      for (let z = 0; z < H; z++) {
        const x0 = Math.max(0, s - (D - 1)), x1 = Math.min(W - 1, s);
        for (let x = x0; x <= x1; x++) {
          const y = s - x;
          const v = m.data[(z * D + y) * W + x];
          if (!v) continue;
          // Fully hidden voxels are skipped.
          if (m.get(x + 1, y, z) && m.get(x, y + 1, z) && m.get(x, y, z + 1)) continue;
          const hex = pal[v];
          const n = 1 + (UB.hash3(x * 7 + 3, y * 13 + 1, z * 31 + (opts.seed || 0)) - 0.5) * 2 * noise;
          const ground = z < 3 ? 0.86 + 0.05 * z : 1;
          const exposedTop = !m.get(x, y, z + 1);
          const cTop = shade(hex, top * n * (exposedTop && !m.get(x - 1, y, z + 1) && !m.get(x, y - 1, z + 1) ? 1.06 : 1));
          const cL = shade(hex, left * n * ground);
          const cR = shade(hex, right * n * ground);
          const sx = (x - y) * 2 - minSx + pad - 2;
          const sy = (x + y) - (z + 1) * 2 - minSy + pad;
          put(sx + 1, sy, cTop); put(sx + 2, sy, cTop);
          put(sx, sy + 1, cTop); put(sx + 1, sy + 1, cTop); put(sx + 2, sy + 1, cTop); put(sx + 3, sy + 1, cTop);
          put(sx, sy + 2, cL); put(sx + 1, sy + 2, cL); put(sx + 2, sy + 2, cR); put(sx + 3, sy + 2, cR);
          put(sx, sy + 3, cL); put(sx + 1, sy + 3, cL); put(sx + 2, sy + 3, cR); put(sx + 3, sy + 3, cR);
        }
      }
    }
    if (opts.outline !== false) {
      const out = new Uint32Array(buf);
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
        if (buf[y * cw + x]) continue;
        if ((x > 0 && buf[y * cw + x - 1]) || (x < cw - 1 && buf[y * cw + x + 1]) || (y > 0 && buf[(y - 1) * cw + x]) || (y < chh - 1 && buf[(y + 1) * cw + x])) out[y * cw + x] = OUTLINE;
      }
      buf.set(out);
    }
    const c = makeCanvas(cw, chh);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(cw, chh);
    new Uint32Array(img.data.buffer).set(buf);
    ctx.putImageData(img, 0, 0);
    const ox = -minSx + pad + (W / 2 - D / 2) * 2;
    const oy = -minSy + pad + (W / 2 + D / 2);
    return { c, ox, oy, w: cw, h: chh };
  }

  // Ground shadow cast toward +x (screen right-down), as if the sun were up and to the left.
  function bakeShadow(m, len) {
    len = len === undefined ? 0.55 : len;
    const W = m.w, D = m.d;
    const cells = new Set();
    let maxX = 0, maxY = 0;
    for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
      let top = -1;
      for (let z = m.h - 1; z >= 0; z--) if (m.data[(z * D + y) * W + x]) { top = z; break; }
      if (top < 0) continue;
      const L = Math.round((top + 1) * len);
      for (let t = 0; t <= L; t++) {
        const cx = x + t, cy = y + Math.round(t * 0.35);
        cells.add(cy * 4096 + cx);
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;
      }
    }
    const minSx = -2 * (maxY + 1), maxSx = 2 * (maxX + 1), maxSy = maxX + maxY + 2;
    const cw = maxSx - minSx + 2, chh = maxSy + 2;
    const c = makeCanvas(Math.max(1, cw), Math.max(1, chh));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    for (const k of cells) {
      const x = k % 4096, y = Math.floor(k / 4096);
      const sx = (x - y) * 2 - minSx - 2 + 1, sy = x + y + 1;
      ctx.fillRect(sx + 1, sy, 2, 1);
      ctx.fillRect(sx, sy + 1, 4, 1);
    }
    return { c, ox: -minSx + 1 + (W / 2 - D / 2) * 2, oy: 1 + (W / 2 + D / 2), w: cw, h: chh };
  }

  // Darkened copy of a sprite (for remembered-but-not-visible areas).
  function dim(sprite, k) {
    const c = makeCanvas(sprite.w, sprite.h);
    const ctx = c.getContext('2d');
    ctx.drawImage(sprite.c, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(8,10,20,${k})`;
    ctx.fillRect(0, 0, sprite.w, sprite.h);
    return { c, ox: sprite.ox, oy: sprite.oy, w: sprite.w, h: sprite.h };
  }

  UB.Vox = { Model, bake, bakeShadow, dim, makeCanvas, shade };
})(globalThis.UB = globalThis.UB || {});
