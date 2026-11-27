// Água-Tinta — page-turn transition of the Paper theme (owner A).
// capture() snapshots the outgoing view: the canvases composited into one reusable canvas (bg at its scroll
// offset, main, top, the ruled page multiplied over them) plus an inert clone of the #ui overlay. The caller then switches the view underneath
// and play() peels the snapshot away like a notebook page lifted from its bottom-right corner: a diagonal fold
// sweeps right → left, the lifted part shows as the back of the sheet (shaded like a curl, lit along the fold,
// faint rules showing through) and casts a shadow on the newly revealed view. ~620 ms; reduced motion: a 200 ms
// crossfade. Taps are swallowed only while it plays; the snapshot is released at the end.
(function (AQ) {
  'use strict';

  var DUR = 620, DUR_REDUCED = 200;
  // Full-screen hub panels that turn like pages (cards, pickers and confirms keep their own small animation).
  var PAGES = { shop: 1, bestiary: 1, goals: 1, settings: 1, saveIO: 1, credits: 1 };

  var root = null, page = null, snap = null, sctx = null, holder = null, fold = null, flap = null, shade = null;
  var cur = null; // {t0, dur, reduced, resolve, raf, geo}

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function build() {
    if (root) return true;
    var app = document.getElementById('app');
    if (!app) return false;
    root = el('div', 'aq-turn');
    root.setAttribute('aria-hidden', 'true');
    page = el('div', 'aq-turn-page');
    snap = el('canvas', 'aq-turn-snap');
    sctx = snap.getContext('2d');
    holder = el('div', 'aq-turn-ui');
    page.appendChild(snap); page.appendChild(holder);
    fold = el('div', 'aq-turn-fold');
    shade = el('div', 'aq-turn-shade');
    flap = el('div', 'aq-turn-flap');
    fold.appendChild(shade); fold.appendChild(flap);
    root.appendChild(page); root.appendChild(fold);
    root.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); });
    app.appendChild(root);
    return true;
  }

  function reduced() { return !!(AQ.fx && AQ.fx.motion && AQ.fx.motion() < 1); }

  // Composites the current frame (device px) into the snapshot canvas.
  function shoot() {
    var D = AQ.display, R = AQ.render, cv = D.canvases;
    var W = D.widthD || Math.round(D.width * D.dpr), H = D.heightD || Math.round(D.height * D.dpr);
    if (snap.width !== W || snap.height !== H) { snap.width = W; snap.height = H; }
    snap.style.width = D.width + 'px';
    snap.style.height = D.height + 'px';
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = 'source-over';
    sctx.fillStyle = AQ.theme.bg;
    sctx.fillRect(0, 0, W, H);
    if (cv.bg) sctx.drawImage(cv.bg, Math.round(R.bgOffset.x * D.dpr), Math.round(R.bgOffset.y * D.dpr));
    if (cv.main) sctx.drawImage(cv.main, 0, 0);
    if (cv.top) sctx.drawImage(cv.top, 0, 0);
    // the ruled page multiplies over the frame, as on screen
    var pc = AQ.paper && AQ.paper.active() && AQ.paper.canvas();
    if (pc && pc.width) {
      sctx.globalCompositeOperation = 'multiply';
      sctx.drawImage(pc, 0, 0);
      sctx.globalCompositeOperation = 'source-over';
    }
  }

  // Inert copy of the overlay (HUD, open panels), with the scroll positions of its scrollable boxes.
  function cloneUi() {
    while (holder.firstChild) holder.removeChild(holder.firstChild);
    var ui = document.getElementById('ui');
    if (!ui) return;
    var c = ui.cloneNode(true);
    c.setAttribute('inert', '');
    c.removeAttribute('aria-live');
    holder.appendChild(c);
    var src = ui.querySelectorAll('.aq-scroll'), dst = c.querySelectorAll('.aq-scroll');
    for (var i = 0; i < src.length && i < dst.length; i++) if (src[i].scrollTop) dst[i].scrollTop = src[i].scrollTop;
  }

  function finish() {
    if (!cur) return;
    var c = cur;
    cur = null;
    if (c.raf) cancelAnimationFrame(c.raf);
    if (c.timer) clearTimeout(c.timer);
    root.classList.remove('is-on', 'is-reduced', 'is-playing');
    page.style.clipPath = ''; page.style.opacity = '';
    while (holder.firstChild) holder.removeChild(holder.firstChild);
    snap.width = 0; snap.height = 0; // release the snapshot
    if (c.resolve) c.resolve(true);
  }

  // Fold geometry for the stage size: the fold leans so the bottom-right corner lifts first.
  function geometry() {
    var W = AQ.display.width, H = AQ.display.height;
    var d = Math.round(H * 0.32), L = Math.hypot(d, H);
    var g = { W: W, H: H, d: d, cos: H / L, sin: d / L, phi: Math.atan2(d, H) };
    g.Xext = W * g.cos + H * g.sin;   // page extent across the fold
    g.Yext = W * g.sin + H * g.cos;   // page extent along the fold
    return g;
  }
  function setupFlap(g) {
    var ch = AQ.display.cellH || 20;
    flap.style.width = Math.ceil(g.Xext) + 'px';
    flap.style.height = Math.ceil(g.Yext) + 'px';
    shade.style.height = Math.ceil(g.Yext) + 'px';
    // back of the sheet: rules show through mirrored (perpendicular to the reflected rule direction)
    flap.style.setProperty('--rule-angle', g.phi + 'rad');
    flap.style.setProperty('--rule-step', ch + 'px');
  }

  var pts = [], lifted = [];
  // Sutherland–Hodgman against x ≥ 0 (local fold frame).
  function clipRight(src, out) {
    out.length = 0;
    for (var i = 0; i < src.length; i += 2) {
      var ax = src[i], ay = src[i + 1], j = (i + 2) % src.length, bx = src[j], by = src[j + 1];
      var ain = ax >= 0, bin = bx >= 0;
      if (ain) out.push(ax, ay);
      if (ain !== bin) { var t = ax / (ax - bx); out.push(0, ay + (by - ay) * t); }
    }
    return out;
  }
  function poly(arr, ox, oy, mirror) {
    var s = '';
    for (var i = 0; i < arr.length; i += 2) {
      var x = mirror ? ox - arr[i] : arr[i] - ox, y = arr[i + 1] - oy;
      s += (i ? ',' : '') + x.toFixed(1) + 'px ' + y.toFixed(1) + 'px';
    }
    return 'polygon(' + s + ')';
  }

  function layout(e) {
    var g = cur.geo, W = g.W, H = g.H, d = g.d;
    var xb = W - e * (W + d + 2), xt = xb + d;
    page.style.clipPath = 'polygon(0 0,' + xt.toFixed(1) + 'px 0,' + xb.toFixed(1) + 'px ' + H + 'px,0 ' + H + 'px)';
    // page corners → local fold frame (origin at the fold's bottom point, x across the fold toward the lift)
    var cs = g.cos, sn = g.sin, C = [0, 0, W, 0, W, H, 0, H];
    pts.length = 0;
    var ymin = Infinity;
    for (var i = 0; i < 8; i += 2) {
      var dx = C[i] - xb, dy = C[i + 1] - H;
      var xl = dx * cs + dy * sn, yl = -dx * sn + dy * cs;
      pts.push(xl, yl);
      if (yl < ymin) ymin = yl;
    }
    clipRight(pts, lifted);
    fold.style.transform = 'translate(' + xb.toFixed(1) + 'px,' + H + 'px) rotate(' + g.phi + 'rad)';
    if (lifted.length < 6) { flap.style.visibility = shade.style.visibility = 'hidden'; return; }
    flap.style.visibility = shade.style.visibility = '';
    flap.style.transform = 'translate(' + (-g.Xext).toFixed(1) + 'px,' + ymin.toFixed(1) + 'px)';
    flap.style.clipPath = poly(lifted, g.Xext, ymin, true);
    shade.style.transform = 'translate(0,' + ymin.toFixed(1) + 'px)';
    shade.style.clipPath = poly(lifted, 0, ymin, false);
    // the shadow on the revealed view fades as the sheet lifts away
    shade.style.opacity = (1 - 0.6 * e).toFixed(3);
  }

  function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  function frame(now) {
    if (!cur) return;
    if (!cur.t0) cur.t0 = now;
    var p = Math.min(1, (now - cur.t0) / cur.dur);
    if (cur.reduced) page.style.opacity = (1 - p).toFixed(3);
    else layout(ease(p));
    if (p >= 1) { finish(); return; }
    cur.raf = requestAnimationFrame(frame);
  }

  var T = AQ.pageturn = {
    PAGES: PAGES,
    DUR: DUR,                  // ms (debug may lengthen it to inspect a turn)
    DUR_REDUCED: DUR_REDUCED,
    // enabled() → the Paper theme is showing (also the ending's temporary Paper).
    enabled: function () { return typeof document !== 'undefined' && !!(AQ.theme && AQ.theme.paper && AQ.display && AQ.display.ready); },
    // wants(screenName) → this hub panel opens / closes with a page turn now.
    wants: function (name) { return !!PAGES[name] && T.enabled(); },
    active: function () { return !!cur; },
    // capture() → true when a snapshot is ready for play(). A turn still running is completed first.
    capture: function () {
      if (!T.enabled() || !build()) return false;
      finish();
      try { shoot(); cloneUi(); } catch (e) { console.warn('[AQ.pageturn] capture failed:', e); return false; }
      cur = { t0: 0, dur: 0, reduced: false, resolve: null, raf: 0, timer: 0, geo: null, captured: true };
      page.style.opacity = '';
      page.style.clipPath = '';
      root.classList.add('is-on'); // covers the switch underneath until play() starts
      cur.timer = setTimeout(finish, 1500); // a capture without play() never sticks
      return true;
    },
    // play() → Promise resolved when the page is gone. Without a capture it resolves at once.
    play: function () {
      if (!cur || !cur.captured || cur.raf) return Promise.resolve(false);
      return new Promise(function (resolve) {
        cur.resolve = resolve;
        cur.reduced = reduced();
        cur.dur = cur.reduced ? T.DUR_REDUCED : T.DUR;
        root.classList.toggle('is-reduced', cur.reduced);
        root.classList.add('is-playing');
        if (!cur.reduced) { cur.geo = geometry(); setupFlap(cur.geo); layout(0); }
        cur.raf = requestAnimationFrame(frame);
        // safety net: never leave the overlay up (hidden tab: rAF paused)
        clearTimeout(cur.timer);
        cur.timer = setTimeout(finish, cur.dur + 600);
      });
    },
    // turn(fn): capture, run fn() (switch the view), play. → Promise
    turn: function (fn) {
      var ok = T.capture();
      try { fn(); } catch (e) { console.error(e); }
      return ok ? T.play() : Promise.resolve(false);
    },
    cancel: finish
  };

  AQ.events.on('display:resize', function () { if (cur) finish(); });
})(window.AQ);
