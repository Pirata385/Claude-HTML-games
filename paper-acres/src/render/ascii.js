/* ASCII post-process: the scene is drawn with Canvas2D into a small offscreen buffer (SX x SY samples per
 * character cell); each cell's dark samples form a pattern that PA.Matcher turns into a glyph. Inside the buffer,
 * pure black = current-slice ink (bold glyphs), grey = farther ink (regular glyphs), white = paper. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;

  class Ascii {
    constructor(scene) {
      this.scene = scene;
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true, alpha: false });
      this.cont = scene.add.container(0, 0).setDepth(1000);
      this.bl = scene.make.blitter({ x: 0, y: 0, key: 'glyphs', add: false });
      this.cont.add(this.bl);
      this.pool = [];
      this.stamps = [];
      this.threshold = 96;   // darkness (0..255) for a sample to count as ink
      this.boldAt = 185;     // mean darkness of the ink samples above which the glyph is bold
      this.boil = false;
      this.night = null;     // { lights: [{x, y, r}] } in screen px -> inverted page
      this.resize(scene.scale.width, scene.scale.height, 24);
    }
    resize(W, H, cellH) {
      this.W = W; this.H = H;
      this.cellH = Math.max(8, Math.round(cellH));
      this.cellW = this.cellH * C.GW / C.GH;
      this.cols = Math.ceil(W / this.cellW) + 1;
      this.rows = Math.ceil(H / this.cellH) + 1;
      const M = PA.Matcher;
      this.canvas.width = this.cols * M.SX; this.canvas.height = this.rows * M.SY;
      this.bx = M.SX / this.cellW; this.by = M.SY / this.cellH; // buffer px per screen px
      this.cont.setScale(this.cellH / C.GH);
      this.glyph = new Array(this.cols * this.rows).fill(' ');
    }
    /** Start a frame: clear to paper. */
    begin() {
      const ctx = this.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.stamps.length = 0;
      this.masks = [];
    }
    /** Set the buffer transform for a slice projection p (world px -> screen px -> buffer px). */
    use(p) {
      this.ctx.setTransform(p.scale * this.bx, 0, 0, p.scale * this.by, p.ox * this.bx, p.oy * this.by);
    }
    /** Line width (world px) that is about `px` buffer pixels wide for projection p. */
    lw(p, px) { return px / (p.scale * this.by); }
    /** Force a character at a screen position (e.g. a head, a sign, an icon). */
    stamp(sx, sy, ch, opts) {
      const c = Math.floor(sx / this.cellW), r = Math.floor(sy / this.cellH);
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
      this.stamps.push({ c, r, ch, style: opts && opts.style, invert: opts && opts.invert, pri: (opts && opts.pri) || 0 });
    }
    /** Blank paper over whole character cells (actors stand on a clean patch). */
    clearCells(c0, r0, w, h) {
      const ctx = this.ctx, M = PA.Matcher;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ffffff';
      ctx.fillRect(c0 * M.SX, r0 * M.SY, w * M.SX, h * M.SY);
      ctx.restore();
    }
    /** Stamp a multi-line ASCII sprite whose top-left character cell is (c0, r0); halo clears the cells first. */
    sprite(c0, r0, rows, opts) {
      const o = opts || {};
      if (o.halo !== false) {
        for (let r = 0; r < rows.length; r++) {
          const line = rows[r], l = line.search(/\S/);
          if (l < 0) continue;
          const rr = line.length - 1 - line.split('').reverse().join('').search(/\S/);
          this.clearCells(c0 + l - (o.pad || 0), r0 + r, rr - l + 1 + 2 * (o.pad || 0), 1);
        }
      }
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
          const ch = rows[r][c];
          if (ch === ' ') continue;
          const cc = c0 + c, rr = r0 + r;
          if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
          this.stamps.push({ c: cc, r: rr, ch, style: o.style != null ? o.style : 1, invert: o.invert, pri: o.pri || 5 });
        }
      }
      this.masks.push([c0, r0, c0 + rows[0].length - 1, r0 + rows.length - 1]);
    }
    cellAt(sx, sy) { return { c: Math.floor(sx / this.cellW), r: Math.floor(sy / this.cellH) }; }
    /** Suppress low-priority stamps inside a screen rectangle (e.g. where an actor stands). */
    mask(x0, y0, x1, y1) { this.masks.push([Math.floor(x0 / this.cellW), Math.floor(y0 / this.cellH), Math.floor(x1 / this.cellW), Math.floor(y1 / this.cellH)]); }
    /** Text on the character grid: one cell per letter from the first cell (no float drift between letters). */
    stampText(sx, sy, text, opts) {
      const c0 = Math.floor(sx / this.cellW + 1e-6), r = Math.floor(sy / this.cellH + 1e-6);
      for (let i = 0; i < text.length; i++) if (text[i] !== ' ') this.stamp((c0 + i + 0.5) * this.cellW, (r + 0.5) * this.cellH, text[i], opts);
    }
    put(i, x, y, frame) {
      let b = this.pool[i];
      if (b) { b.reset(x, y, frame); b.visible = true; } else { b = this.bl.create(x, y, frame); this.pool.push(b); }
    }
    /** Convert the buffer to glyphs. */
    end(now) {
      const M = PA.Matcher, SX = M.SX, SY = M.SY, cols = this.cols, rows = this.rows;
      const bw = this.canvas.width, bh = this.canvas.height;
      const data = this.ctx.getImageData(0, 0, bw, bh).data;
      const thr = this.threshold, boldAt = this.boldAt;
      // darkness map + ridge thinning: a sample is ink only if it is the darkest across the stroke
      // (strict on one side so a line split evenly over two samples keeps exactly one of them)
      const N = bw * bh;
      if (!this.dk || this.dk.length !== N) { this.dk = new Uint8Array(N); this.on = new Uint8Array(N); this.sol = new Uint8Array(N); this.gm = new Uint8Array(N); }
      const dk = this.dk, onm = this.on, sol = this.sol, gm = this.gm;
      // solid body ink (dark red channel, bright blue channel) is never thinned; green tells the model
      for (let i = 0, o = 0; i < N; i++, o += 4) { dk[i] = 255 - data[o]; sol[i] = dk[i] > thr && data[o + 2] > 160 ? 1 : 0; gm[i] = data[o + 1]; }
      const models = PA.Stick && PA.Stick.MODELS, votes = new Uint8Array(20);
      for (let y = 0; y < bh; y++) {
        const row = y * bw;
        for (let x = 0; x < bw; x++) {
          const i = row + x, d = dk[i];
          if (d <= thr) { onm[i] = 0; continue; }
          if (sol[i]) { onm[i] = 1; continue; }
          const L = x > 0 ? dk[i - 1] : 0, Rr = x < bw - 1 ? dk[i + 1] : 0;
          const U = y > 0 ? dk[i - bw] : 0, D = y < bh - 1 ? dk[i + bw] : 0;
          onm[i] = ((d > L && d >= Rr) || (d > U && d >= D)) ? 1 : 0;
        }
      }
      const stampMap = new Map();
      const masked = (s) => this.masks.some((m) => s.c >= m[0] && s.c <= m[2] && s.r >= m[1] && s.r <= m[3]);
      for (const s of this.stamps) {
        const k = s.r * cols + s.c, prev = stampMap.get(k);
        if (s.pri <= 0 && masked(s)) continue;
        if (!prev || s.pri >= prev.pri) stampMap.set(k, s);
      }
      const phase = this.boil ? Math.floor((now || 0) / 170) : 0;
      const night = this.night;
      const wipe = this.wipe ? this.wipe(now) : 0; // 0..1 page-turn dither (1 = all ink)
      const lights = night ? night.lights || [] : null;
      let n = 0;
      const GW = C.GW, GH = C.GH, G = PA.Glyphs, ink = G.box('ink');
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          let key = 0, sum = 0, on = 0, ns = 0, sbits = 0;
          const base = r * SY * bw + c * SX;
          for (let yy = 0; yy < SY; yy++) {
            let i = base + yy * bw;
            for (let xx = 0; xx < SX; xx++, i++) {
              if (onm[i]) { const bit = 1 << (yy * SX + xx); key |= bit; sum += dk[i]; on++; if (sol[i]) { ns++; sbits |= bit; } }
            }
          }
          // a body cell is either the model's character or nothing: thin edges of a solid shape never become strokes
          if (ns && ns < M.SOLID_MIN) key = (key & ~sbits) >>> 0;
          let ch = key ? M.pick(key, ns) : ' ';
          if (ns >= M.SOLID_MIN && models) {
            votes.fill(0); let best = 0;
            for (let yy = 0; yy < SY; yy++) { let i = base + yy * bw; for (let xx = 0; xx < SX; xx++, i++) if (sol[i]) { const m = Ascii.modelOf(gm[i]); votes[m]++; if (votes[m] > votes[best]) best = m; } }
            ch = (models[best] || models[0]).body;
          }
          this.glyph[idx] = ch;
          let style = (on && sum / on >= boldAt) || ns >= M.SOLID_MIN ? 1 : 0;
          let inv = false;
          const st = stampMap.get(idx);
          if (st) { ch = st.ch; if (st.style != null) style = st.style; inv = !!st.invert; }
          if (wipe > 0 && PA.U.bayer4(c, r) < wipe) { this.put(n++, c * GW, r * GH, ink); continue; }
          if (lights) {
            // night: the page is inverted except inside lamp circles (dithered rim)
            const px = (c + 0.5) * this.cellW, py = (r + 0.5) * this.cellH;
            let lit = 0;
            for (const L of lights) { const d = Math.hypot(px - L.x, (py - L.y) * 1.2) / L.r; if (d < 1) lit = Math.max(lit, 1 - d); }
            const t = night.t == null ? 1 : night.t;
            const dark = PA.U.bayer4(c, r) < t * (1 - Math.min(1, lit * 3));
            if (dark) inv = !inv;
          }
          this.glyph[idx] = ch;
          if (ch === ' ' && !inv) continue;
          const v = (PA.RNG.hash3(c, r, phase, 5) % 3);
          const frame = inv ? (ch === ' ' ? ink : G.frame(ch, 2, v)) : G.frame(ch, style, v);
          this.put(n++, c * GW, r * GH, frame);
        }
      }
      for (let i = n; i < this.pool.length; i++) this.pool[i].visible = false;
      this.count = n;
    }
    /** Debug: current screen as text rows. */
    text() {
      const out = [];
      for (let r = 0; r < this.rows; r++) out.push(this.glyph.slice(r * this.cols, (r + 1) * this.cols).join(''));
      return out;
    }
  }
  // Buffer-only marker colours for solid body ink (never reach the screen; see the palette test):
  // red 0 = dark ink, blue 255 = "solid", green = which stickman model (selects the body character).
  Ascii.solidFor = (i) => '#00' + ((i | 0) * 12).toString(16).padStart(2, '0') + 'ff';
  Ascii.modelOf = (g) => Math.max(0, Math.min(19, Math.round(g / 12)));
  Ascii.SOLID = Ascii.solidFor(0);
  Ascii.BUFFER_PAPER = '#ffffff'; // paper inside the buffer
  PA.Ascii = Ascii;
})(typeof window !== 'undefined' ? window : globalThis);
