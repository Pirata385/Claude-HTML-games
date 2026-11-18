/* Perspective stack of world slices. Each slice is drawn from cached per-chunk Blitters; farther slices are
 * smaller, use lighter glyphs and lose cells in an ordered-dither pattern (no grey, no alpha). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;

  const View = {
    persp(k) { return 1 / (1 + C.SLICE_K * Math.max(k, -1.6)); },
    /** Projection of slice at depth offset k (= z - cam.z): screen = (ox + wx*scale, oy + wy*scale). */
    slice(k, cam, W, H) {
      const s = View.persp(k);
      const vpx = W / 2, vpy = H * C.HORIZON, ax = W / 2, ay = H * C.ANCHOR_Y;
      const scale = cam.zoom * s;
      return { scale, ox: vpx + (ax - cam.x * cam.zoom - vpx) * s, oy: vpy + (ay - cam.y * cam.zoom - vpy) * s, s };
    },
    toWorld(sx, sy, p) { return { x: (sx - p.ox) / p.scale, y: (sy - p.oy) / p.scale }; },
  };

  const LIGHT1 = { '#': '=', '@': 'o', '%': '=', '&': '*', 'H': '|', 'W': 'w', 'M': 'm', 'O': 'o', '8': 'o', '$': 's', 'B': 'b', 'N': 'n', 'A': '^', 'U': 'u', 'Y': 'y' };
  const LIGHT2 = { '=': '-', '-': '.', '|': ':', '/': '.', '\\': '.', '+': '.', '*': '.', 'o': '.', '~': '-', ':': '.', '"': "'", '_': '.', 'x': '.', '^': '.', 'w': '.', 'v': '.', 'm': '.', 'n': '.', 'y': '.' };
  function lighten(ch, level) {
    if (level <= 0 || ch === ' ') return ch;
    let c = LIGHT1[ch] || ch;
    if (level >= 4) c = LIGHT2[c] || c;
    return c;
  }
  function keep(x, y, level) {
    if (level === 0) return true;
    const d = level < 0 ? 0.8 : C.DROPOUT[Math.min(level, C.DROPOUT.length - 1)];
    return PA.U.bayer4(x, y) >= d;
  }
  function levelOf(k) { return k <= -0.5 ? -1 : Math.round(k); }
  function depthOf(level) { return 1000 - level * 10; }

  class SliceStack {
    constructor(scene, map) {
      this.scene = scene;
      this.setMap(map);
      this.maxSlices = C.MAX_SLICES;
      this.maxCache = 110;
      this.buildBudget = 10;
      this.proj = [];
      this.tick = 0;
      this.boil = false;
      this.boilPhase = 0;
    }
    setMap(map) {
      if (this.cache) this.clear();
      this.map = map; this.grid = map.grid;
      this.cache = new Map(); // "z:cx:cy" -> Map(level -> entry)
      if (this.layers) for (const c of this.layers) if (c) c.destroy();
      this.layers = [];
      this.dirty = new Set();
      if (this.unsub) this.unsub();
      this.unsub = this.grid.onChange((x, y, z) => this.invalidate(x, y, z));
    }
    invalidate(x, y, z) {
      const cx = Math.floor(x / C.CHUNK_W), cy = Math.floor(y / C.CHUNK_H);
      this.dirty.add(z + ':' + cx + ':' + cy);
      if ((y + 1) % C.CHUNK_H === 0) this.dirty.add(z + ':' + cx + ':' + (cy + 1));
    }
    invalidateAll() { for (const k of this.cache.keys()) this.dirty.add(k); }
    clear() {
      for (const lv of this.cache.values()) for (const e of lv.values()) e.bl.destroy(); e.gfx.destroy();
      this.cache.clear();
    }
    destroy() { this.clear(); if (this.unsub) this.unsub(); for (const c of this.layers) if (c) c.destroy(); this.layers = []; }
    /** Container holding everything drawn in slice z; its transform is the slice projection (scale/2 for 2x glyphs). */
    container(z) {
      let c = this.layers[z];
      if (!c) { c = this.layers[z] = this.scene.add.container(0, 0); c.visible = false; c.entityStart = 0; }
      return c;
    }
    build(z, cx, cy, level) {
      const g = this.grid, CW = C.CHUNK_W, CH = C.CHUNK_H;
      const bl = this.scene.make.blitter({ x: 0, y: 0, key: 'glyphs', add: false });
      const gfx = this.scene.make.graphics({ x: 0, y: 0, add: false });
      const cont = this.container(z);
      cont.addAt(bl, 0);
      cont.addAt(gfx, 0);
      const x0 = cx * CW, y0 = cy * CH;
      // Occluder: paper-coloured runs behind opaque cells so nearer slices hide farther ones.
      gfx.fillStyle(C.PAPER_N, 1);
      const cw2 = C.CELL_W * 2, ch2 = C.CELL_H * 2;
      for (let y = y0; y < Math.min(y0 + CH, g.h); y++) {
        let run = -1;
        for (let x = x0; x <= Math.min(x0 + CW, g.w); x++) {
          const op = x < Math.min(x0 + CW, g.w) && PA.TILES[g.get(x, y, z)].opaque;
          if (op && run < 0) run = x;
          if (!op && run >= 0) {
            // extend down to merge identical runs is unnecessary; rows are cheap
            gfx.fillRect(run * cw2 - 1, y * ch2 - 1, (x - run) * cw2 + 2, ch2 + 2);
            run = -1;
          }
        }
      }
      const bobs = [];
      for (let y = y0; y < Math.min(y0 + CH, g.h); y++) {
        for (let x = x0; x < Math.min(x0 + CW, g.w); x++) {
          const t = g.get(x, y, z);
          if (t === 0) continue;
          let ch = PA.TILES[t].glyph(g, x, y, z);
          if (ch === ' ') continue;
          if (!keep(x, y, level)) continue;
          ch = lighten(ch, level);
          const td = PA.TILES[t];
          const style = (td.style === 2 && level <= 1) ? 2 : (level === 0 ? 1 : 0);
          const v = PA.RNG.hash3(x, y, z, 11) % 3;
          const b = bl.create(x * C.CELL_W * 2, y * C.CELL_H * 2, PA.Glyphs.frame(ch, style, v));
          if (level === 0) { b.data = { ch, style, v }; bobs.push(b); }
        }
      }
      return { bl, gfx, used: 0, bobs };
    }
    get(z, cx, cy, level) {
      const key = z + ':' + cx + ':' + cy;
      let lv = this.cache.get(key);
      if (lv && this.dirty.has(key)) { for (const e of lv.values()) e.bl.destroy(); e.gfx.destroy(); lv.clear(); }
      this.dirty.delete(key);
      if (!lv) { lv = new Map(); this.cache.set(key, lv); }
      let e = lv.get(level);
      if (!e) {
        if (this.budget <= 0 && level !== 0) return null;
        this.budget--;
        e = this.build(z, cx, cy, level);
        lv.set(level, e);
        this.count++;
      }
      e.used = this.tick;
      return e;
    }
    /** cam = {x, y, z (float), zoom}; W/H = canvas size. */
    update(cam, W, H) {
      this.tick++;
      this.budget = this.buildBudget;
      this.count = this.count || 0;
      const g = this.grid, CW = C.CHUNK_W, CH = C.CHUNK_H;
      const shown = new Set();
      this.proj = [];
      const zFirst = Math.max(0, Math.ceil(cam.z - 0.999));
      const zLast = Math.min(g.d - 1, Math.floor(cam.z + this.maxSlices));
      for (let z = zLast; z >= zFirst; z--) {
        const k = z - cam.z;
        if (k <= -1) continue;
        const level = levelOf(k);
        const p = View.slice(k, cam, W, H);
        p.level = level; p.k = k;
        this.proj[z] = p;
        const cont = this.container(z);
        cont.visible = true;
        cont.setPosition(p.ox, p.oy).setScale(p.scale / 2).setDepth(depthOf(level));
        const wx0 = (0 - p.ox) / p.scale, wx1 = (W - p.ox) / p.scale;
        const wy0 = (0 - p.oy) / p.scale, wy1 = (H - p.oy) / p.scale;
        const cx0 = Math.max(0, Math.floor(wx0 / C.CELL_W / CW)), cx1 = Math.min(Math.ceil(g.w / CW) - 1, Math.floor(wx1 / C.CELL_W / CW));
        const cy0 = Math.max(0, Math.floor(wy0 / C.CELL_H / CH)), cy1 = Math.min(Math.ceil(g.h / CH) - 1, Math.floor(wy1 / C.CELL_H / CH));
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const e = this.get(z, cx, cy, level);
            if (!e) continue;
            e.bl.visible = true; e.gfx.visible = true;
            shown.add(e);
          }
        }
      }
      for (let z = 0; z < this.layers.length; z++) if (this.layers[z] && !this.proj[z]) this.layers[z].visible = false;
      // hide everything not shown, evict old entries
      let total = 0;
      for (const [key, lv] of this.cache) {
        for (const [level, e] of lv) {
          total++;
          if (!shown.has(e)) { e.bl.visible = false; e.gfx.visible = false; }
          if (this.tick - e.used > 240 && !shown.has(e)) { e.bl.destroy(); e.gfx.destroy(); lv.delete(level); total--; }
        }
        if (lv.size === 0) this.cache.delete(key);
      }
      if (total > this.maxCache) this.evict(total - this.maxCache, shown);
      if (this.boil) this.doBoil(shown);
    }
    evict(n, shown) {
      const all = [];
      for (const [key, lv] of this.cache) for (const [level, e] of lv) if (!shown.has(e)) all.push([e.used, key, level, e]);
      all.sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < Math.min(n, all.length); i++) {
        const [, key, level, e] = all[i];
        e.bl.destroy(); e.gfx.destroy();
        const lv = this.cache.get(key); lv.delete(level); if (!lv.size) this.cache.delete(key);
      }
    }
    doBoil(shown) {
      const now = this.scene.time.now;
      const phase = Math.floor(now / 170);
      if (phase === this.boilPhase) return;
      this.boilPhase = phase;
      for (const e of shown) {
        if (!e.bobs.length) continue;
        for (let i = phase % 7; i < e.bobs.length; i += 7) {
          const b = e.bobs[i], d = b.data;
          d.v = (d.v + 1) % 3;
          b.setFrame(PA.Glyphs.frame(d.ch, d.style, d.v));
        }
      }
    }
  }
  SliceStack.lighten = lighten;
  SliceStack.keep = keep;
  SliceStack.levelOf = levelOf;
  SliceStack.depthOf = depthOf;
  PA.View = View;
  PA.SliceStack = SliceStack;
  if (typeof module !== 'undefined' && module.exports) module.exports = { View, SliceStack };
})(typeof window !== 'undefined' ? window : globalThis);
