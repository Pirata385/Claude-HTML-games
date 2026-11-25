// Água-Tinta — display: canvas sizing, grid metrics, font loading, safe areas (owner A).
(function (AQ) {
  'use strict';

  var U = AQ.util;
  var FAMILY = "ATMono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";
  var stage = null, resizeTimer = 0, safeProbe = null, measureCtx = null, fontLoaded = false;

  var D = AQ.display = {
    family: FAMILY,
    ready: false,
    cols: 0, rows: 0,
    cellW: 0, cellH: 0, cellWd: 0, cellHd: 0,
    dpr: 1, fontPx: 16, adv: 0.6,
    originX: 0, originY: 0, originXd: 0, originYd: 0,
    width: 0, height: 0, widthD: 0, heightD: 0,
    orientation: 'landscape',
    isTouch: false,
    safe: { top: 0, right: 0, bottom: 0, left: 0 },
    worldW: 0, worldH: 0,   // visible grid in world units (cols, rows·ASPECT)
    canvases: { bg: null, main: null, top: null },
    ctx: { bg: null, main: null, top: null },
    isFullscreen: false,

    // init(stageEl) → Promise. Waits for the webfont (≤ 1500 ms), sizes canvases, builds the atlas.
    init: function (stageEl) {
      stage = stageEl || document.getElementById('stage');
      D.canvases.bg = stage.querySelector('#cv-bg');
      D.canvases.main = stage.querySelector('#cv-main');
      D.canvases.top = stage.querySelector('#cv-top');
      D.ctx.bg = D.canvases.bg.getContext('2d', { alpha: false });
      D.ctx.main = D.canvases.main.getContext('2d');
      D.ctx.top = D.canvases.top.getContext('2d');
      D.isTouch = detectTouch();
      measureCtx = document.createElement('canvas').getContext('2d');

      safeProbe = document.createElement('div');
      safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
      document.body.appendChild(safeProbe);

      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
      AQ.events.on('settings:changed', function (p) {
        if (p.key === 'glyphSize') D.refresh();
      });
      AQ.events.on('quality:changed', function () { if (D.ready) D.refresh(); });
      document.addEventListener('fullscreenchange', function () {
        D.isFullscreen = !!document.fullscreenElement;
        AQ.events.emit('display:fullscreen', { on: D.isFullscreen });
      });

      return waitFont().then(function () {
        D.refresh();
        D.ready = true;
        // Late font load (after the timeout): rebuild the atlas with the real font.
        if (!fontLoaded && document.fonts && document.fonts.addEventListener) {
          document.fonts.addEventListener('loadingdone', function () {
            if (!fontLoaded && document.fonts.check('16px ATMono')) { fontLoaded = true; D.refresh(true); }
          });
        }
      });
    },

    // fullscreen(on?) → Promise<bool> (toggles when on is omitted). Resolves false when unsupported or refused.
    fullscreen: function (on) {
      var el = document.documentElement;
      var want = on === undefined ? !document.fullscreenElement : !!on;
      try {
        if (want && !document.fullscreenElement && el.requestFullscreen) {
          return el.requestFullscreen({ navigationUI: 'hide' }).then(function () { return true; }, function () { return false; });
        }
        if (!want && document.fullscreenElement && document.exitFullscreen) {
          return document.exitFullscreen().then(function () { return true; }, function () { return false; });
        }
      } catch (e) { /* unsupported */ }
      return Promise.resolve(false);
    },
    canFullscreen: function () { return !!(document.documentElement.requestFullscreen && document.fullscreenEnabled !== false); },

    metrics: function () {
      return {
        cols: D.cols, rows: D.rows, cellW: D.cellW, cellH: D.cellH, cellWd: D.cellWd, cellHd: D.cellHd,
        dpr: D.dpr, fontPx: D.fontPx, originX: D.originX, originY: D.originY, width: D.width, height: D.height,
        orientation: D.orientation, isTouch: D.isTouch, worldW: D.worldW, worldH: D.worldH,
        safe: { top: D.safe.top, right: D.safe.right, bottom: D.safe.bottom, left: D.safe.left }
      };
    },

    // Recomputes everything; emits 'display:resize' with metrics() when the grid or size changed (or force).
    refresh: function (force) {
      if (!stage) return D.metrics();
      var prev = D.cols + 'x' + D.rows + '@' + D.cellWd + 'x' + D.cellHd + ':' + D.width + 'x' + D.height + ':' + D.dpr;
      var W = Math.max(1, Math.round(stage.clientWidth || window.innerWidth));
      var H = Math.max(1, Math.round(stage.clientHeight || window.innerHeight));
      var params = (AQ.perf && AQ.perf.params) || { dprCap: 2, densityBias: 1 };
      var fontChanged = force === true;
      var dpr = Math.min(window.devicePixelRatio || 1, params.dprCap || 2);
      var Wd = Math.round(W * dpr), Hd = Math.round(H * dpr);

      var gs = AQ.settings.get('glyphSize');
      var fontPx = gs === 'auto'
        ? U.clamp(Math.floor(Math.min(W / 31.2, H / 36) * (params.densityBias || 1)), 11, 20)
        : gs;
      var adv, cellWd, cellHd, cols, rows;
      for (;;) {
        adv = measureAdv(fontPx);
        cellWd = Math.max(1, Math.round(fontPx * adv * dpr));
        cellHd = Math.max(1, Math.round(fontPx * 1.2 * dpr));
        cols = Math.floor(Wd / cellWd);
        rows = Math.floor(Hd / cellHd);
        if ((cols >= 40 && rows >= 22) || fontPx <= 9) break;
        fontPx -= 1;
      }

      D.width = W; D.height = H; D.widthD = Wd; D.heightD = Hd;
      D.dpr = dpr; D.fontPx = fontPx; D.adv = adv;
      D.cellWd = cellWd; D.cellHd = cellHd;
      D.cellW = cellWd / dpr; D.cellH = cellHd / dpr;
      D.cols = cols; D.rows = rows;
      D.originXd = Math.floor((Wd - cols * cellWd) / 2);
      D.originYd = Math.floor((Hd - rows * cellHd) / 2);
      D.originX = D.originXd / dpr; D.originY = D.originYd / dpr;
      D.orientation = W >= H ? 'landscape' : 'portrait';
      D.worldW = cols;
      D.worldH = rows * AQ.ASPECT;
      readSafe();

      sizeCanvas(D.canvases.main, Wd, Hd, dpr);
      sizeCanvas(D.canvases.top, Wd, Hd, dpr);
      sizeCanvas(D.canvases.bg, Wd, Hd + 2 * cellHd, dpr); // 2 rows taller for the sub-row scroll
      [D.ctx.bg, D.ctx.main, D.ctx.top].forEach(function (c) { c.imageSmoothingEnabled = false; });

      if (AQ.atlas) AQ.atlas.build(fontPx, dpr, AQ.theme.ink, FAMILY, { w: cellWd, h: cellHd }, fontChanged);
      if (AQ.render && AQ.render.resize) AQ.render.resize();

      var now = D.cols + 'x' + D.rows + '@' + D.cellWd + 'x' + D.cellHd + ':' + D.width + 'x' + D.height + ':' + D.dpr;
      if (force || now !== prev) {
        var m = D.metrics();
        if (AQ.perf && AQ.perf.grace) AQ.perf.grace(1.5);
        if (AQ.scenes && AQ.scenes.resizeCurrent) AQ.scenes.resizeCurrent(m);
        AQ.events.emit('display:resize', m);
      }
      return D.metrics();
    }
  };

  function detectTouch() {
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    } catch (e) { /* ignore */ }
    return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  }

  function measureAdv(fontPx) {
    measureCtx.font = fontPx + 'px ' + FAMILY;
    var w = measureCtx.measureText('MMMMMMMMMM').width / 10;
    var a = w / fontPx;
    return a > 0.3 && a < 1 ? a : 0.6;
  }

  function sizeCanvas(cv, wd, hd, dpr) {
    if (cv.width !== wd) cv.width = wd;
    if (cv.height !== hd) cv.height = hd;
    cv.style.width = (wd / dpr) + 'px';
    cv.style.height = (hd / dpr) + 'px';
  }

  function readSafe() {
    if (!safeProbe) return;
    var cs = getComputedStyle(safeProbe);
    D.safe.top = parseFloat(cs.paddingTop) || 0;
    D.safe.right = parseFloat(cs.paddingRight) || 0;
    D.safe.bottom = parseFloat(cs.paddingBottom) || 0;
    D.safe.left = parseFloat(cs.paddingLeft) || 0;
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { D.refresh(); }, 120);
  }

  function waitFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var timeout = new Promise(function (res) { setTimeout(res, 1500); });
    var load = Promise.all([document.fonts.load('16px ATMono'), document.fonts.load('bold 16px ATMono')])
      .then(function () { fontLoaded = document.fonts.check('16px ATMono'); })
      .catch(function () { /* fallback stack */ });
    return Promise.race([load, timeout]);
  }
})(window.AQ);
