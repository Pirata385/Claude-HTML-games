// Space backdrop (dithered sky, nebula, stars, a celestial body) and the
// Xenospire's shaft dropping into the abyss below the arena.
(function (XS) {
  'use strict';

  const { hexToRgb, mix, darken, lighten } = XS.color;

  const SKY_CACHE = new Map();
  const TOWER_CACHE = new Map();

  class Background {
    constructor(theme, seed) {
      this.theme = theme;
      this.seed = seed >>> 0;
      this.sky = null;
      this.twinkles = [];
      this.tower = null;
      this.pad = 24 * XS.ISO.S;
    }

    resize(W, H) {
      if (this.sky && this.W === W && this.H === H) return;
      this.W = W; this.H = H;
      // Skies are cached per theme and size: new scenes (menus, floors) reuse them.
      const key = this.theme.id + ':' + this.seed + ':' + W + 'x' + H;
      let hit = SKY_CACHE.get(key);
      if (!hit) {
        hit = { sky: this.buildSky(W + this.pad * 2, H + this.pad * 2), twinkles: this.twinkles };
        SKY_CACHE.set(key, hit);
        if (SKY_CACHE.size > 4) SKY_CACHE.delete(SKY_CACHE.keys().next().value);
      }
      this.sky = hit.sky;
      this.twinkles = hit.twinkles;
    }

    buildSky(W, H) {
      const t = this.theme;
      const cv = XS.gfx.makeCanvas(W, H), g = cv.getContext('2d');
      const img = g.createImageData(W, H), px = img.data;
      const stops = t.sky.map(hexToRgb);
      const neb = t.nebula.map(hexToRgb);
      const rng = new XS.RNG(XS.hash(this.seed, 'sky'));
      const ns = rng.int(0, 1 << 20);
      const STEPS = 10;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          // Vertical gradient quantised to STEPS bands with ordered dithering.
          const f = (y / (H - 1)) * (stops.length - 1);
          const q = Math.floor(f * STEPS + XS.gfx.bayer(x, y)) / STEPS;
          const i0 = Math.min(stops.length - 2, Math.floor(q)), tt = Math.min(1, q - i0);
          let r = stops[i0][0] + (stops[i0 + 1][0] - stops[i0][0]) * tt;
          let gg = stops[i0][1] + (stops[i0 + 1][1] - stops[i0][1]) * tt;
          let b = stops[i0][2] + (stops[i0 + 1][2] - stops[i0][2]) * tt;
          // Nebula clouds.
          const S = XS.ISO.S;
          const n = XS.noise2(x / (46 * S), y / (34 * S), ns) * 0.65 + XS.noise2(x / (13 * S), y / (11 * S), ns + 1) * 0.35;
          const k = (n - 0.52) / 0.48;
          if (k > 0) {
            const level = Math.floor(k * 4 + XS.gfx.bayer(x + 1, y + 2)) / 4;
            if (level > 0) {
              const c = XS.noise2(x / (60 * S), y / (60 * S), ns + 2) > 0.5 ? neb[0] : neb[1];
              const a = Math.min(0.55, level * 0.42);
              r += (c[0] - r) * a; gg += (c[1] - gg) * a; b += (c[2] - b) * a;
            }
          }
          const o = (y * W + x) * 4;
          px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = 255;
        }
      }
      // Static stars.
      const star = hexToRgb(t.stars);
      const count = Math.floor((W * H) / 260);
      for (let i = 0; i < count; i++) {
        const x = rng.int(0, W - 1), y = rng.int(0, H - 1), o = (y * W + x) * 4;
        const a = rng.range(0.25, 1);
        px[o] += (star[0] - px[o]) * a; px[o + 1] += (star[1] - px[o + 1]) * a; px[o + 2] += (star[2] - px[o + 2]) * a;
      }
      g.putImageData(img, 0, 0);
      // A few cross-shaped bright stars.
      g.fillStyle = t.stars;
      for (let i = 0; i < Math.floor(W / 60); i++) {
        const x = rng.int(4, W - 5), y = rng.int(4, H - 5);
        g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      }
      this.drawBody(g, W, H, rng);
      this.twinkles = Array.from({ length: Math.floor(W / 9) }, () => ({ x: rng.int(0, W - 1), y: rng.int(0, H - 1), p: rng.range(0, 6.28), s: rng.range(1, 3) }));
      return cv;
    }

    drawBody(g, W, H, rng) {
      const body = this.theme.body;
      if (!body || body.type === 'none') return;
      const R = Math.max(10, Math.round(Math.min(W, H) * (body.type === 'sun' ? 0.09 : 0.13)));
      const cx = Math.round(W * rng.range(0.66, 0.84)), cy = Math.round(H * rng.range(0.16, 0.3));
      const ramp = XS.color.ramp(body.color, 5, 1.2);
      if (body.type === 'sun') {
        for (let ring = 3; ring >= 1; ring--) {
          XS.gfx.ellipse(g, cx, cy, R + ring * 5, R + ring * 5, XS.gfx.ditherPattern(g, lighten(body.color, 0.2), 0.16 * (4 - ring)));
        }
      }
      if (body.type === 'ringed') this.ring(g, cx, cy, R, ramp, false);
      for (let y = -R; y <= R; y++) {
        for (let x = -R; x <= R; x++) {
          if (x * x + y * y > R * R) continue;
          const nz = Math.sqrt(Math.max(0, 1 - (x * x + y * y) / (R * R)));
          let lam = (-x * 0.6 - y * 0.35) / R + nz * 0.55;
          if (body.type === 'sun') lam = 0.9 + nz * 0.3;
          if (body.type === 'planet' || body.type === 'ringed') lam += (XS.noise2(0, (y + R) / 3.2, this.seed & 255) - 0.5) * 0.35;
          if (body.type === 'moon' && XS.noise2((x + R) / 4, (y + R) / 4, this.seed & 511) > 0.7) lam -= 0.25;
          const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor((lam * 0.5 + 0.35) * ramp.length + XS.gfx.bayer(x + 40, y + 40) - 0.5)));
          g.fillStyle = ramp[idx];
          g.fillRect(cx + x, cy + y, 1, 1);
        }
      }
      if (body.type === 'ringed') this.ring(g, cx, cy, R, ramp, true);
    }

    ring(g, cx, cy, R, ramp, front) {
      const rx = R * 1.9, ry = R * 0.45;
      for (let i = 0; i < 360; i++) {
        const a = (i / 360) * Math.PI * 2;
        const isFront = Math.sin(a) > 0;
        if (isFront !== front) continue;
        for (let k = 0; k < 3; k++) {
          const x = Math.round(cx + Math.cos(a) * (rx - k * 1.6)), y = Math.round(cy + Math.sin(a) * (ry - k * 0.5));
          if (!front && (x - cx) ** 2 + (y - cy) ** 2 < R * R) continue;
          g.fillStyle = ramp[k === 1 ? 3 : 2];
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // camX/camY: camera centre in world-screen space (for parallax).
    draw(ctx, camX, camY, time, quality = 1) {
      const ox = -this.pad - Math.max(-this.pad, Math.min(this.pad, camX * 0.04));
      const oy = -this.pad - Math.max(-this.pad, Math.min(this.pad, camY * 0.04));
      ctx.drawImage(this.sky, Math.round(ox), Math.round(oy));
      if (quality < 1) return;
      ctx.fillStyle = this.theme.stars;
      for (const s of this.twinkles) {
        const v = Math.sin(time * s.s + s.p);
        if (v > 0.6) ctx.fillRect(s.x + Math.round(ox), s.y + Math.round(oy), 1, 1);
        if (v > 0.93) { ctx.fillRect(s.x + Math.round(ox) - 1, s.y + Math.round(oy), 3, 1); ctx.fillRect(s.x + Math.round(ox), s.y + Math.round(oy) - 1, 1, 3); }
      }
    }

    // The tower's shaft hanging below the arena (world space).
    buildTower(arena) {
      const t = this.theme;
      const R = arena.size * 0.34;
      const hw = Math.ceil(R * XS.ISO.HX * Math.SQRT2), ry = Math.ceil(R * XS.ISO.HY * Math.SQRT2);
      const key = t.id + ':' + (this.seed & 1023) + ':' + hw;
      const cached = TOWER_CACHE.get(key);
      if (cached) { this.tower = { cv: cached, hw, ry, cx: arena.center.x, cy: arena.center.y }; return; }
      const Hh = 300 * XS.ISO.S;
      const W = hw * 2 + 1;
      const cv = XS.gfx.makeCanvas(W, Hh + ry), g = cv.getContext('2d');
      const img = g.createImageData(W, Hh + ry), px = img.data;
      const C = {};
      const rgbOf = (c) => C[c] || (C[c] = hexToRgb(c));
      const [dark, mid, win] = t.tower;
      const ringA = lighten(mid, 0.18), ringB = darken(dark, 0.3);
      for (let y = 0; y < Hh + ry; y++) {
        for (let x = 0; x < W; x++) {
          const u = (x - hw) / hw;
          if (Math.abs(u) > 1) continue;
          const curve = Math.sqrt(1 - u * u) * ry;  // front of the cylinder bulges down
          const yy = y - curve;
          if (yy < 0) continue;
          const fade = yy / Hh;
          if (fade > 1 || XS.gfx.bayer(x, y) < fade * fade * 1.1) continue;
          const light = -u * 0.7 + 0.3;
          let col = light + XS.gfx.bayer(x + 1, y) * 0.5 > 0.55 ? mid : dark;
          const ringRow = Math.floor(yy) % (34 * XS.ISO.S);
          if (ringRow === 0) col = ringA;
          else if (ringRow === 1) col = ringB;
          else if (Math.abs(u) < 0.86 && ringRow > 8 && ringRow < 34 * XS.ISO.S - 8 && Math.floor(yy) % 7 < 2 && Math.round(x) % 6 < 2) {
            if (XS.hash3f(Math.floor(x / 6), Math.floor(yy / 7), this.seed & 1023) > 0.45) col = fade < 0.5 ? win : mix(win, dark, Math.round(fade * 20) / 20);
          }
          const c = rgbOf(col), o = (y * W + x) * 4;
          px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      TOWER_CACHE.set(key, cv);
      if (TOWER_CACHE.size > 3) TOWER_CACHE.delete(TOWER_CACHE.keys().next().value);
      this.tower = { cv, hw, ry, cx: arena.center.x, cy: arena.center.y };
    }

    drawTower(ctx, ox, oy) {
      if (!this.tower) return;
      const T = this.tower;
      const sx = XS.isoX(T.cx, T.cy) + ox, sy = XS.isoY(T.cx, T.cy, 0) + oy;
      ctx.drawImage(T.cv, Math.round(sx - T.hw), Math.round(sy - T.ry));
    }
  }

  // Draw a vertical dither fade from transparent to `color` (used in menus).
  function fadeRect(ctx, x, y, w, h, color) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = XS.gfx.ditherPattern(ctx, color, (i + 1) / 6);
      ctx.fillRect(x, y + (h * i) / 6, w, Math.ceil(h / 6));
    }
  }

  XS.Background = Background;
  XS.fadeRect = fadeRect;
})(globalThis.XS = globalThis.XS || {});
