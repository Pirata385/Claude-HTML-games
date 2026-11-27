// Água-Tinta — effects (owner A): pooled particles, the 1D surface ripple field, ink clouds, camera shake,
// flash/lightning, ink-wipe transitions and motion(). All coordinates are world units unless noted.
// Reduced motion (§12): no shake, flashes capped at level 1, 4-particle splashes without rings, straight bubbles,
// coins/text fade in place, blooms become a 200 ms fade, waves × .4 without impulses, transitions cross-fade.
(function (AQ) {
  'use strict';

  var U = AQ.util, R = AQ.render, D = AQ.display, ASPECT = AQ.ASPECT;
  var POOL = 400, MAX_CLOUDS = 6;
  var rnd = AQ.rng.create('fx'); // cosmetic stream

  // ================================================================ motion
  var motionVal = 1, mql = null;
  function readMotion() {
    var s = AQ.settings.get('reducedMotion');
    var reduce = s === 'on' || (s === 'auto' && !!(mql && mql.matches));
    motionVal = reduce ? 0.3 : 1;
  }
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mql.addEventListener) mql.addEventListener('change', readMotion);
      else if (mql.addListener) mql.addListener(readMotion);
    }
  } catch (e) { mql = null; }
  readMotion();
  function reduced() { return motionVal < 1; }

  // ================================================================ particles
  function P() {
    this.alive = false; this.kind = ''; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.g = 0; this.drag = 0; this.life = 0; this.max = 1; this.level = 10; this.code = 0;
    this.seq = null; this.text = ''; this.wob = 0; this.t = 0; this.pop = false; this.surfaceY = 0; this.bold = false;
  }
  var pool = [];
  for (var i = 0; i < POOL; i++) pool.push(new P());

  var A = AQ.atlas;
  function codes(str) { var a = []; for (var k = 0; k < str.length; k++) a.push(A.code(str[k])); return a; }
  var SEQ = {
    bubble: codes('·°oO'),   // grows as it rises
    spark: codes('*+.'),
    dust: codes('#%*:.'),
    bloom: codes('*:.'),
    foam: codes(".,'\"*"),
    flake: codes('·°'),
    ink: codes(' .:*#%@'),
    star: codes('*')
  };
  var CODE = { drop: A.code("'"), coin: A.code('$'), pop: A.code('*'), open: A.code('('), close: A.code(')') };

  // Presets: n, speed (u/s), gravity (u/s², + = down), life (s), level.
  // Tint role per particle kind (AQ.TINTS.fx; drawn in the ink outside the Colourful theme).
  var KIND_TINT = (AQ.TINTS && AQ.TINTS.fx) || {};
  var TXT = { align: 'center', bold: false, tint: undefined };
  var KINDS = {
    splash: { n: 14, sp: 13, g: 42, life: 0.75, level: 11 },
    drop: { n: 4, sp: 2.5, g: 34, life: 0.7, level: 10 },
    bubble: { n: 2, sp: 5.5, g: 0, life: 2.2, level: 9 },
    spark: { n: 8, sp: 11, g: 0, life: 0.45, level: 13, drag: 3 },
    ink: { n: 1, life: 2.5, level: 9 },            // → ink cloud (see emitInk)
    coin: { n: 1, sp: 4, g: -5, life: 1.1, level: 14 },
    flake: { n: 6, sp: 1.6, g: 1.2, life: 3.2, level: 8, drag: 1.5 },
    dust: { n: 8, sp: 3.5, g: -1.5, life: 0.8, level: 7, drag: 3 },
    pop: { n: 1, sp: 0, g: 0, life: 0.12, level: 12 },
    ripple: { n: 2, sp: 6, g: 0, life: 0.7, level: 8 },
    text: { n: 1, sp: 3, g: 0, life: 1.4, level: 14 },
    bloom: { n: 16, sp: 9, g: 0, life: 0.6, level: 13, drag: 2.5 }
  };

  function cap() { return (AQ.perf && AQ.perf.params && AQ.perf.params.maxParticles) || POOL; }
  var cursor = 0;
  function alloc() {
    if (fx.count >= cap()) return null;
    for (var k = 0; k < POOL; k++) {
      var p = pool[cursor];
      cursor = (cursor + 1) % POOL;
      if (!p.alive) return p;
    }
    return null;
  }
  function spawn(kind, x, y, vx, vy, life, level, code, seq) {
    var p = alloc();
    if (!p) return null;
    var k = KINDS[kind];
    p.alive = true; fx.count++;
    p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.t = 0;
    p.g = k.g || 0; p.drag = k.drag || 0; p.life = p.max = life; p.level = level;
    p.code = code || 0; p.seq = seq || null; p.text = ''; p.wob = 0; p.pop = false; p.bold = false;
    return p;
  }
  function jitterLife(base) { return base * (0.75 + rnd.next() * 0.5); }

  // ================================================================ surface ripple field (1D)
  // Height h(x) in world units (negative = up) = 3 travelling sines × amp + an impulse wave field (damping .985).
  var STEP = 1 / 60;
  var surf = {
    x0: -12, n: 0, h: new Float32Array(0), v: new Float32Array(0), t: 0, acc: { t: 0 },
    amp: 1,       // multiplier set by scenes (e.g. 2 in storms)
    base: 0.45,   // calm amplitude in world units
    reset: function (widthU) {
      var n = Math.max(8, Math.ceil(widthU || D.cols || 80) + 24);
      if (n !== this.n) { this.n = n; this.h = new Float32Array(n); this.v = new Float32Array(n); }
      else { this.h.fill(0); this.v.fill(0); }
      this.x0 = -12;
    },
    // follow(x0): slides the impulse window so it starts at world column x0 (scrolling scenes keep it on the view;
    // ripples keep their world position, cells that enter the window start calm).
    follow: function (x0) {
      if (!this.n) this.reset();
      var k = Math.round(x0) - this.x0;
      if (!k) return;
      var n = this.n, h = this.h, v = this.v;
      if (Math.abs(k) >= n) { h.fill(0); v.fill(0); }
      else if (k > 0) { h.copyWithin(0, k); v.copyWithin(0, k); h.fill(0, n - k); v.fill(0, n - k); }
      else { h.copyWithin(-k, 0, n + k); v.copyWithin(-k, 0, n + k); h.fill(0, 0, -k); v.fill(0, 0, -k); }
      this.x0 += k;
    },
    // impulse(wx, power=1): pushes the surface down at wx (splashes, jumps). Ignored with reduced motion.
    impulse: function (wx, power) {
      if (reduced()) return;
      if (!this.n) this.reset();
      var p = power === undefined ? 1 : power;
      var i = Math.round(wx - this.x0);
      for (var d = -1; d <= 1; d++) {
        var j = i + d;
        if (j > 0 && j < this.n - 1) this.v[j] += p * (d === 0 ? 7 : 3.5);
      }
    },
    update: function (dt) {
      this.t += dt;
      if (!this.n) return;
      var self = this;
      U.fixedStep(this.acc, dt, STEP, function () {
        var h = self.h, v = self.v, n = self.n, k = 70; // wave speed² (u²/s²)
        for (var j = 1; j < n - 1; j++) v[j] += (h[j - 1] + h[j + 1] - 2 * h[j]) * k * STEP;
        for (var q = 1; q < n - 1; q++) {
          v[q] *= 0.985;
          h[q] = U.clamp(h[q] + v[q] * STEP, -2.5, 2.5);
        }
      });
    },
    // height(wx) → surface y offset at wx (world units; mean surface is y = 0).
    height: function (wx) {
      var t = this.t, a = this.base * this.amp * (reduced() ? 0.4 : 1);
      var y = a * (0.55 * Math.sin(0.21 * wx - 1.3 * t) + 0.3 * Math.sin(0.47 * wx + 0.9 * t + 1.7) + 0.15 * Math.sin(1.1 * wx - 2.1 * t + 0.4));
      if (this.n) {
        var fxp = wx - this.x0, j = Math.floor(fxp);
        if (j >= 0 && j < this.n - 1) { var f = fxp - j; y += this.h[j] * (1 - f) + this.h[j + 1] * f; }
      }
      return y;
    },
    slope: function (wx) { return (this.height(wx + 0.5) - this.height(wx - 0.5)); },
    // cell(wx, out?) → {y, row, ch, code}: the world row holding the surface at wx and the wave-ramp glyph for its
    // sub-row position ('_' = bottom of the cell … "'" = top), nudged by the slope.
    cell: function (wx, out) {
      var o = out || {};
      var y = this.height(wx), row = Math.floor(y / ASPECT), p = y / ASPECT - row; // p: 0 top … 1 bottom
      var v = U.clamp((1 - p) - this.slope(wx) * 0.25, 0, 0.999);
      var ramp = R.RAMPS.wave;
      o.y = y; o.row = row; o.ch = ramp[Math.floor(v * ramp.length)]; o.code = A.code(o.ch);
      return o;
    }
  };

  // ================================================================ ink clouds
  function Cloud() { this.alive = false; this.x = 0; this.y = 0; this.r = 0; this.rMax = 8; this.t = 0; this.life = 2.5; this.glow = false; this.seed = 0; this.fade = 1; }
  var clouds = [];
  for (var ci = 0; ci < MAX_CLOUDS; ci++) clouds.push(new Cloud());

  function emitInk(wx, wy, o) {
    var c = null;
    for (var k = 0; k < MAX_CLOUDS; k++) if (!clouds[k].alive) { c = clouds[k]; break; }
    if (!c) { c = clouds[0]; for (var q = 1; q < MAX_CLOUDS; q++) if (clouds[q].t > c.t) c = clouds[q]; }
    c.alive = true; c.x = wx; c.y = wy; c.t = 0; c.r = 0;
    c.rMax = o.radius || 8;
    c.life = o.life === undefined ? KINDS.ink.life : o.life;
    c.glow = !!o.glow; c.seed = rnd.int(1000); c.fade = 1;
    return 1;
  }
  function cloudDensity(c, wx, wy) {
    if (!c.alive || c.r <= 0) return 0;
    var dx = wx - c.x, dy = (wy - c.y), d = Math.sqrt(dx * dx + dy * dy) / c.r;
    if (d >= 1.25) return 0;
    var n = U.noise3(wx * 0.22 + c.seed, wy * 0.22, c.t * 0.7) - 0.5;
    return U.clamp(((1 - d) * 1.6 + n * 0.9) * c.fade, 0, 1);
  }
  var tmpCell = { c: 0, r: 0 };
  function drawClouds() {
    var cw = D.cellW, chh = D.cellH, fr = R.cam.y / ASPECT - R.camRow(), cc = R.camCol(), frx = R.cam.x - cc;
    for (var k = 0; k < MAX_CLOUDS; k++) {
      var c = clouds[k];
      if (!c.alive || c.r <= 0.2) continue;
      var rr = c.r * 1.25;
      R.worldToCell(c.x - rr, c.y - rr, tmpCell);
      var c0 = tmpCell.c, r0 = tmpCell.r;
      R.worldToCell(c.x + rr, c.y + rr, tmpCell);
      var c1 = Math.min(tmpCell.c, D.cols), r1 = Math.min(tmpCell.r, D.rows + 1);
      c0 = Math.max(c0, 0); r0 = Math.max(r0, -1);
      var tick = Math.floor(c.t * 8);
      for (var r = r0; r <= r1; r++) {
        var wy = (r + R.camRow()) * ASPECT + 1;
        var py = D.originY + (r - fr) * chh + R.cam.shake.y;
        for (var col = c0; col <= c1; col++) {
          var wx = col + cc + 0.5;
          var dens = cloudDensity(c, wx, wy);
          if (dens <= 0.02) continue;
          var px = D.originX + (col - frx) * cw + R.cam.shake.x;
          if (c.glow) { // vampira: sparkles instead of a dark cloud
            if (R.hash01(col, r, tick + c.seed) < dens * 0.35) R.glyph(SEQ.star[0], px, py, 11, 'glow');
            else if (dens > 0.5 && R.hash01(r, col, tick) < 0.2) R.glyph(SEQ.ink[1], px, py, 4, 'glow');
            continue;
          }
          R.knock(px, py, cw, chh, Math.min(0.96, dens * 1.2));
          var code = SEQ.ink[Math.min(SEQ.ink.length - 1, Math.floor(dens * (SEQ.ink.length - 1)))];
          if (code) R.glyph(code, px, py, dens > 0.8 ? 2 : Math.max(1, Math.round(1 + dens * 4)), 'inkcloud');
        }
      }
    }
  }

  // ================================================================ shake / flash / wipe state
  var shakeAmp = 0, shakeT = 0, shakeDur = 0;
  var flashLevel = 0, flashT = 0, flashDur = 0, lastLightning = -1e9, clock = 0;
  var wipe = null; // {dir, t, dur, resolve, fade, offs}

  // ================================================================ API
  var fx = AQ.fx = {
    count: 0,
    KINDS: KINDS,
    surface: surf,
    covered: false, // the screen stays covered after an 'out' wipe until the next 'in'

    // emit(kind, wx, wy, opts?{n, power, dir, text, level, life, radius, glow, surfaceY, impulse, bold}) → count
    emit: function (kind, wx, wy, opts) {
      var k = KINDS[kind];
      if (!k) return 0;
      var o = opts || {};
      var red = reduced();
      var power = o.power === undefined ? 1 : o.power;
      var level = o.level || k.level;
      var n = o.n !== undefined ? o.n : k.n;
      var made = 0, p, j, ang, sp;
      switch (kind) {
        case 'ink':
          return emitInk(wx, wy, o);
        case 'splash':
          if (o.n === undefined) n = Math.round(U.clamp(8 + 12 * power, 8, 20));
          if (red) n = Math.min(n, 4);
          for (j = 0; j < n; j++) {
            ang = -Math.PI / 2 + (rnd.next() - 0.5) * 1.7 + (o.dir || 0) * 0.35;
            sp = k.sp * (0.45 + rnd.next() * 0.75) * (0.6 + 0.4 * power);
            p = spawn(kind, wx, wy, Math.cos(ang) * sp, Math.sin(ang) * sp * 1.5, jitterLife(o.life || k.life), level, SEQ.foam[rnd.int(SEQ.foam.length)]);
            if (p) made++;
          }
          if (!red) made += fx.emit('ripple', wx, wy, { impulse: false, level: 8 });
          if (o.impulse !== false && Math.abs(wy - (o.surfaceY || 0)) < 2.5) surf.impulse(wx, power);
          return made;
        case 'drop':
          for (j = 0; j < n; j++) {
            p = spawn(kind, wx + (rnd.next() - 0.5) * 2, wy, (rnd.next() - 0.5) * k.sp, -rnd.next() * k.sp, jitterLife(o.life || k.life), level, CODE.drop);
            if (p) made++;
          }
          return made;
        case 'bubble':
          n = Math.max(1, Math.round(n * ((AQ.perf && AQ.perf.params.bubbles) || 1)));
          for (j = 0; j < n; j++) {
            p = spawn(kind, wx + (rnd.next() - 0.5), wy, 0, -k.sp * (0.7 + rnd.next() * 0.6) * power, o.life || k.life * (0.8 + rnd.next() * 0.6), level, SEQ.bubble[0], SEQ.bubble);
            if (p) { p.wob = red ? 0 : rnd.range(0, 6.28); p.pop = true; p.surfaceY = o.surfaceY || 0; made++; }
          }
          return made;
        case 'coin':
          if (n <= 1) {
            p = spawn(kind, wx, wy, 0, red ? 0 : -k.sp, o.life || k.life, level, CODE.coin);
            if (p) { if (red) p.g = 0; made++; }
            return made;
          }
          for (j = 0; j < n; j++) { // shower: a small fountain of $
            p = red
              ? spawn(kind, wx + (rnd.next() - 0.5) * 6, wy - rnd.next() * 3, 0, 0, jitterLife(o.life || 1.2), level, CODE.coin)
              : spawn(kind, wx, wy, (rnd.next() - 0.5) * 12 * power, -(9 + rnd.next() * 8) * power, jitterLife(o.life || 1.3), level, CODE.coin);
            if (p) { p.g = red ? 0 : 30; made++; }
          }
          return made;
        case 'text':
          p = spawn(kind, wx, wy, 0, red ? 0 : -k.sp, o.life || k.life, level, 0);
          if (p) { p.text = String(o.text === undefined ? '' : o.text); p.bold = !!o.bold; made++; }
          return made;
        case 'ripple':
          if (red) n = 0;
          for (j = 0; j < n; j++) {
            var side = j % 2 ? 1 : -1;
            p = spawn(kind, wx + side * 0.5, wy, side * k.sp * (0.7 + 0.3 * power), 0, o.life || k.life, level, side > 0 ? CODE.close : CODE.open);
            if (p) made++;
          }
          if (o.impulse !== false && Math.abs(wy - (o.surfaceY || 0)) < 2.5) surf.impulse(wx, 0.5 * power);
          return made;
        case 'bloom':
          if (red) {
            p = spawn(kind, wx, wy, 0, 0, 0.2, level, SEQ.star[0]);
            return p ? 1 : 0;
          }
          for (j = 0; j < n; j++) {
            ang = (j / n) * Math.PI * 2;
            p = spawn(kind, wx, wy, Math.cos(ang) * k.sp * power, Math.sin(ang) * k.sp * power, o.life || k.life, level, SEQ.bloom[0], SEQ.bloom);
            if (p) made++;
          }
          return made;
        case 'pop':
          p = spawn(kind, wx, wy, 0, 0, o.life || k.life, level, CODE.pop);
          return p ? 1 : 0;
        default: // spark, dust, flake
          for (j = 0; j < n; j++) {
            ang = rnd.next() * Math.PI * 2;
            sp = (k.sp || 0) * power * (0.4 + rnd.next() * 0.8);
            var seq = SEQ[kind];
            p = spawn(kind, wx + (kind === 'flake' ? (rnd.next() - 0.5) * 3 : 0), wy, Math.cos(ang) * sp, Math.sin(ang) * sp * (kind === 'flake' ? 0.3 : 1),
              jitterLife(o.life || k.life), level, kind === 'flake' ? seq[rnd.int(seq.length)] : seq[0], kind === 'flake' ? null : seq);
            if (p) { if (kind === 'flake') p.wob = red ? 0 : rnd.range(0, 6.28); made++; }
          }
          return made;
      }
    },
    // emitS(kind, px, py, opts): screen CSS px (e.g. from a DOM element); emitC(kind, c, r, opts): screen grid cell.
    emitS: function (kind, px, py, opts) { var w = R.screenToWorld(px, py, {}); return fx.emit(kind, w.x, w.y, opts); },
    emitC: function (kind, c, r, opts) {
      var s = R.cellToScreen(c, r, {});
      return fx.emitS(kind, s.x + D.cellW / 2, s.y + D.cellH / 2, opts);
    },

    // inkAt(wx, wy) → 0..1 ink-cloud density (fish hidden in ink, etc.)
    inkAt: function (wx, wy) {
      var m = 0;
      for (var k = 0; k < MAX_CLOUDS; k++) { var d = cloudDensity(clouds[k], wx, wy); if (d > m) m = d; }
      return m;
    },
    clearInk: function () { for (var k = 0; k < MAX_CLOUDS; k++) clouds[k].alive = false; },
    inkCount: function () { var n = 0; for (var k = 0; k < MAX_CLOUDS; k++) if (clouds[k].alive) n++; return n; },

    update: function (dt) {
      var red = reduced();
      for (var k = 0; k < POOL; k++) {
        var p = pool[k];
        if (!p.alive) continue;
        p.t += dt;
        p.life -= dt;
        if (p.pop && p.y <= p.surfaceY) { // bubble reached the surface
          p.alive = false; fx.count--;
          fx.emit('pop', p.x, p.surfaceY - 0.5);
          if (!red) surf.impulse(p.x, 0.15);
          continue;
        }
        if (p.life <= 0) { p.alive = false; fx.count--; continue; }
        if (p.drag) { var d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
        p.vy += p.g * dt;
        var wob = p.wob ? Math.sin(p.t * (p.kind === 'flake' ? 2.2 : 6) + p.wob) * (p.kind === 'flake' ? 1.2 : 0.8) : 0;
        p.x += (p.vx + wob) * dt;
        p.y += p.vy * dt;
        if (p.seq) {
          var f = 1 - p.life / p.max;
          p.code = p.seq[Math.min(p.seq.length - 1, Math.floor(f * p.seq.length))];
        }
      }
      for (var c = 0; c < MAX_CLOUDS; c++) {
        var cl = clouds[c];
        if (!cl.alive) continue;
        cl.t += dt;
        cl.r = cl.rMax * U.easeOutCubic(Math.min(1, cl.t / (red ? 0.3 : 0.6)));
        if (isFinite(cl.life) && cl.life > 0) {
          var fadeStart = cl.life * 0.6;
          cl.fade = cl.t < fadeStart ? 1 : Math.max(0, 1 - (cl.t - fadeStart) / (cl.life - fadeStart));
          if (cl.t >= cl.life) cl.alive = false;
        }
      }
      surf.update(dt);
      clock += dt;
      if (shakeT > 0) {
        shakeT -= dt;
        var a = shakeT > 0 ? shakeAmp * (shakeT / shakeDur) : 0;
        R.cam.shake.x = (rnd.next() * 2 - 1) * a;
        R.cam.shake.y = (rnd.next() * 2 - 1) * a;
        if (shakeT <= 0) shakeAmp = 0;
      } else if (R.cam.shake.x || R.cam.shake.y) { R.cam.shake.x = 0; R.cam.shake.y = 0; }
    },

    // Draws ink clouds and particles on the current layer (scenes call this inside draw()).
    draw: function () {
      drawClouds();
      for (var k = 0; k < POOL; k++) {
        var p = pool[k];
        if (!p.alive) continue;
        var f = p.life / p.max;
        var lvl = Math.max(1, Math.round(p.level * Math.min(1, f * 2)));
        var tk = KIND_TINT[p.kind] || 0;
        if (p.text) { TXT.bold = p.bold; TXT.tint = tk; R.textW(p.text, p.x, p.y, lvl, TXT); }
        else if (p.code) R.glyphW(p.code, p.x, p.y, lvl, tk);
      }
    },

    clear: function () {
      for (var k = 0; k < POOL; k++) pool[k].alive = false;
      fx.count = 0;
      fx.clearInk();
      shakeT = 0; shakeAmp = 0;
      R.cam.shake.x = 0; R.cam.shake.y = 0;
    },

    // shake(px, sec): camera shake in CSS px (2–4 px on bites and snaps). Disabled with reduced motion.
    shake: function (px, sec) {
      if (reduced()) return;
      shakeAmp = Math.max(shakeT > 0 ? shakeAmp : 0, px);
      shakeDur = shakeT = Math.max(shakeT, sec || 0.25);
    },

    // flash(level, sec): full-screen ink veil on the top layer, fading out. Reduced motion caps it at level 1.
    flash: function (level, sec) {
      flashLevel = U.clamp(level | 0, 0, 15);
      if (reduced()) flashLevel = Math.min(flashLevel, 1);
      flashDur = flashT = sec || 0.12;
      R.markTopDirty();
    },
    // lightning(): level-3 veil for 120 ms, at most every 4 s (reduced: a level-1 dim pulse). → bool fired
    lightning: function () {
      if (clock - lastLightning < 4) return false;
      lastLightning = clock;
      if (reduced()) fx.flash(1, 0.3); else fx.flash(3, 0.12);
      return true;
    },

    // inkWipe('out'|'in', sec=.4) → Promise. 'out' covers the screen, 'in' reveals it. Reduced motion: 200 ms fade.
    inkWipe: function (dir, sec) {
      if (wipe && wipe.resolve) wipe.resolve();
      var fade = reduced();
      return new Promise(function (resolve) {
        var d = dir === 'in' ? 'in' : 'out';
        var cols = Math.max(1, D.cols), offs = new Float32Array(cols), rows = new Float32Array(Math.max(1, D.rows + 2));
        for (var c = 0; c < cols; c++) {
          var lr = c / cols;
          offs[c] = (d === 'out' ? lr : 1 - lr) * (SPREAD - 0.1) + rnd.next() * 0.1;
        }
        for (var r = 0; r < rows.length; r++) rows[r] = (rnd.next() - 0.5) * 0.16;
        wipe = { dir: d, t: 0, dur: fade ? 0.2 : (sec || 0.4), resolve: resolve, fade: fade, offs: offs, rowJ: rows };
        if (d === 'out') fx.covered = false;
        R.markTopDirty();
      });
    },

    motion: function () { return motionVal; },

    // Loop step 7 (real time, also while paused): transitions and flash on the top layer.
    drawTop: function (dtReal) {
      var ctx = D.ctx.top;
      if (!ctx) return;
      R.setTarget('top');
      if (flashT > 0) {
        flashT -= dtReal;
        R.markTopDirty();
        if (flashT > 0 && flashLevel) {
          ctx.globalAlpha = R.ALPHA[flashLevel] * (flashT / flashDur);
          ctx.fillStyle = AQ.theme.ink;
          ctx.fillRect(0, 0, D.canvases.top.width, D.canvases.top.height);
        }
      }
      if (wipe) {
        wipe.t += dtReal;
        var p = U.clamp(wipe.t / wipe.dur, 0, 1);
        R.markTopDirty();
        drawCover(ctx, wipe.dir === 'out' ? p : 1 - p, wipe);
        if (p >= 1) {
          var res = wipe.resolve, d = wipe.dir;
          wipe = null;
          fx.covered = d === 'out';
          if (res) res();
        }
      } else if (fx.covered) {
        R.markTopDirty();
        ctx.globalAlpha = 1;
        ctx.fillStyle = AQ.theme.bg;
        ctx.fillRect(0, 0, D.canvases.top.width, D.canvases.top.height);
      }
      ctx.globalAlpha = 1;
      R.setTarget('main');
    }
  };

  // Ink wipe (§12): columns sweep the density ramp; behind the edge the page is solid bg.
  var RAMP_D = codes(R.RAMPS.density);
  var SPREAD = 0.62, BAND = 0.3; // column offsets span SPREAD; each column takes BAND of the wipe
  function drawCover(ctx, cover, w) {
    var Wd = D.canvases.top.width, Hd = D.canvases.top.height;
    if (w.fade || !D.cols) {
      ctx.globalAlpha = cover;
      ctx.fillStyle = AQ.theme.bg;
      ctx.fillRect(0, 0, Wd, Hd);
      return;
    }
    var cols = Math.min(D.cols, w.offs.length), rows = D.rows, cwd = D.cellWd, oxd = D.originXd;
    var n = RAMP_D.length;
    ctx.fillStyle = AQ.theme.bg;
    for (var c = 0; c < cols; c++) {
      var local = (cover * (SPREAD + BAND) - w.offs[c]) / BAND; // 0 → 1 across the column's transition
      if (local <= 0) continue;
      var x0 = oxd + c * cwd, x1 = x0 + cwd;
      if (c === 0) x0 = 0;
      if (c === cols - 1) x1 = Wd;
      if (local >= 1.1) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = AQ.theme.bg;
        ctx.fillRect(x0, 0, x1 - x0, Hd);
        continue;
      }
      for (var r = -1; r <= rows; r++) {
        var lr = U.clamp(local + (w.rowJ[(r + 1) % w.rowJ.length] || 0) * 2, 0, 1);
        if (lr <= 0) continue;
        var y0 = r < 0 ? 0 : D.originYd + r * D.cellHd, y1 = r < 0 ? D.originYd : (r === rows ? Hd : y0 + D.cellHd);
        if (r === rows) y0 = D.originYd + rows * D.cellHd;
        ctx.globalAlpha = Math.min(1, lr * 1.15);
        ctx.fillStyle = AQ.theme.bg;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (r < 0 || r >= rows) continue;
        var v = lr < 0.5 ? lr * 2 : (1 - lr) * 2; // edge glyphs rise then fall: ' .·:-=+*#%@' → back to ' '
        var code = RAMP_D[Math.min(n - 1, Math.floor(v * (n - 1)))];
        if (code) R.glyph(code, D.originX + c * D.cellW, D.originY + r * D.cellH, 13);
      }
    }
  }

  AQ.events.on('settings:changed', function (p) { if (p.key === 'reducedMotion') readMotion(); });
  AQ.events.on('display:resize', function (m) { if (surf.n) surf.reset(m.cols); });
})(window.AQ);
