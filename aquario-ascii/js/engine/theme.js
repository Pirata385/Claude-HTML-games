// Água-Tinta — theme (owner A). Colours come only from AQ.THEMES (js/core/ns.js).
// Themes: noite (default) and dia — bg + ink + alpha; papel — the same two colours on a ruled notebook page
// (AQ.paper) with page-turn transitions (AQ.pageturn); ciclo — dia by day, noite by night, blended across dawn
// (05–07) and dusk (17–19) by the world clock in quantised steps; colorido — a deep-sea bg, warm-white ink, a UI
// accent and one colour per tint role (the renderer draws from pre-tinted atlases).
(function (AQ) {
  'use strict';

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hex2(v) { var s = Math.round(Math.max(0, Math.min(255, v))).toString(16); return s.length < 2 ? '0' + s : s; }
  function rgbToHex(a) { return '#' + hex2(a[0]) + hex2(a[1]) + hex2(a[2]); }
  // sRGB ↔ linear, so blends do not sag through muddy greys.
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function unlin(c) { return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); }
  function mix(h1, h2, t) {
    var a = hexToRgb(h1), b = hexToRgb(h2), o = [0, 0, 0];
    for (var i = 0; i < 3; i++) o[i] = unlin(lin(a[i]) + (lin(b[i]) - lin(a[i])) * t);
    return rgbToHex(o);
  }
  function luminance(hex) { var a = hexToRgb(hex); return 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]); }
  function contrast(h1, h2) { var a = luminance(h1), b = luminance(h2); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
  // High-contrast colourful palette: same hues, brighter and more saturated.
  function boost(hex) {
    var c = hexToRgb(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = 0, h = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    s = Math.min(1, s * 1.2 + 0.08); l = Math.min(0.9, l * 1.08 + 0.05);
    function f(n) { var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
  }

  var ROLES = AQ.TINT_ROLES;
  var CYCLE_STEPS = 10;  // atlas re-tints per dawn / dusk (≈ one every 12 real seconds at 1 game min / s)
  var applying = false, cycleTimer = null;

  // nightness(minuteOfDay) → 0 (day) … 1 (night): dawn 05:00–07:00, dusk 17:00–19:00.
  function nightness(m) {
    m = ((m % 1440) + 1440) % 1440;
    if (m >= 420 && m < 1020) return 0;
    if (m >= 300 && m < 420) return 1 - (m - 300) / 120;
    if (m >= 1020 && m < 1140) return (m - 1020) / 120;
    return 1;
  }
  function clockMinutes() {
    var w = AQ.state && AQ.state.world;
    return w && typeof w.minutes === 'number' && isFinite(w.minutes) ? w.minutes : 720;
  }
  function cycleStep() { return Math.round(nightness(clockMinutes()) * CYCLE_STEPS); }
  // Colours of a ciclo step: bg day → dusk → night; ink is the light or the dark one, whichever reads better.
  // A light bg blending into a dark one passes a mid tone where neither ink reads well: such a step's bg is
  // nudged toward the nearer end until the chosen ink reaches 4.6 : 1 (the flip then happens in one step).
  var MIN_CONTRAST = 4.6;
  function cycleColors(entry, step) {
    if (typeof entry === 'string') entry = AQ.THEMES[entry];
    var q = step / CYCLE_STEPS, cy = entry.cycle;
    var D = AQ.THEMES[cy.day], K = AQ.THEMES[cy.dusk], N = AQ.THEMES[cy.night];
    if (q > 0.5) return { bg: mix(K.bg, N.bg, (q - 0.5) * 2), ink: mix(K.ink, N.ink, (q - 0.5) * 2) };
    var w = q * 2, bg, ink, c, dir = 0;
    for (var i = 0; i < 40; i++) {
      bg = mix(D.bg, K.bg, w);
      var cd = contrast(bg, D.ink), cl = contrast(bg, K.ink);
      ink = cd >= cl ? D.ink : K.ink; c = Math.max(cd, cl);
      if (c >= MIN_CONTRAST || w <= 0 || w >= 1) break;
      if (!dir) dir = cd >= cl ? -1 : 1;
      w = Math.max(0, Math.min(1, w + dir * 0.02));
    }
    return { bg: bg, ink: ink };
  }

  var theme = AQ.theme = {
    name: 'noite',          // base theme name (AQ.ENUM.THEMES)
    key: 'noite',           // AQ.THEMES key, incl. 'HC' suffix
    highContrast: false,
    temporary: false,       // true after apply(name, {persist:false})
    bg: AQ.THEMES.noite.bg,
    ink: AQ.THEMES.noite.ink,
    accent: AQ.THEMES.noite.ink,
    bgRgb: hexToRgb(AQ.THEMES.noite.bg).join(' '),
    inkRgb: hexToRgb(AQ.THEMES.noite.ink).join(' '),
    bgArr: hexToRgb(AQ.THEMES.noite.bg),
    inkArr: hexToRgb(AQ.THEMES.noite.ink),
    light: false,           // light background (dia, papel, ciclo by day)
    palette: null,          // colorido: css colour per AQ.TINT_ROLES index (0 = ink), else null
    paper: null,            // papel: {rule, margin, hi, shadow}
    cycleStep: -1,          // ciclo: current blend step (0 day … CYCLE_STEPS night)
    CYCLE_STEPS: CYCLE_STEPS,
    nightness: nightness,
    cycleColors: cycleColors,
    MIN_CONTRAST: MIN_CONTRAST,
    mix: mix,
    contrast: contrast,
    hexToRgb: hexToRgb,

    // apply(name?, {persist=true}): no name → from settings (theme + highContrast).
    // A name with persist:false is temporary (the ending); apply() with no name reverts to settings.
    apply: function (name, opts) {
      var persist = !(opts && opts.persist === false);
      var S = AQ.settings;
      var hc = !!S.get('highContrast');
      var base = name || S.get('theme');
      if (AQ.ENUM.THEMES.indexOf(base) < 0) base = 'noite';
      if (!name && base === 'papel' && !(AQ.state && AQ.state.player && AQ.state.player.unlocks && AQ.state.player.unlocks.paperTheme)) base = 'noite';
      if (name && persist && S.get('theme') !== name) {
        applying = true;
        try { S.set('theme', name); } finally { applying = false; }
      }
      var key = base + (hc ? 'HC' : '');
      var t = AQ.THEMES[key] || AQ.THEMES.noite;
      theme.name = base;
      theme.key = key;
      theme.highContrast = hc;
      theme.temporary = !!name && !persist;
      theme.paper = t.paper || null;
      var src = t.palette || (t.boost && AQ.THEMES[base].palette) || null;
      if (src) {
        var pal = new Array(ROLES.length);
        pal[0] = t.ink;
        for (var i = 1; i < ROLES.length; i++) pal[i] = t.boost ? boost(src[ROLES[i]]) : src[ROLES[i]];
        theme.palette = pal;
      } else theme.palette = null;
      var c = t;
      if (t.cycle) { theme.cycleStep = cycleStep(); c = cycleColors(t, theme.cycleStep); } else theme.cycleStep = -1;
      setColors(c.bg, c.ink, t.accent || c.ink, false);
      syncCycleTimer();
      return theme;
    },

    // Ciclo: re-tints when the clock crossed into another step (called every second and on demand).
    tickCycle: function () {
      var t = AQ.THEMES[theme.key];
      if (!t || !t.cycle) return false;
      var step = cycleStep();
      if (step === theme.cycleStep) return false;
      theme.cycleStep = step;
      var c = cycleColors(t, step);
      setColors(c.bg, c.ink, c.ink, true);
      return true;
    }
  };

  // setColors(bg, ink, accent, fast): fast = a ciclo step (the atlas is re-tinted in place, no glyph re-render).
  function setColors(bg, ink, accent, fast) {
    theme.bg = bg;
    theme.ink = ink;
    theme.accent = accent;
    theme.bgArr = hexToRgb(bg);
    theme.inkArr = hexToRgb(ink);
    theme.bgRgb = theme.bgArr.join(' ');
    theme.inkRgb = theme.inkArr.join(' ');
    theme.light = luminance(bg) > 0.3;
    if (typeof document !== 'undefined') {
      var root = document.documentElement, st = root.style;
      st.setProperty('--bg', bg);
      st.setProperty('--ink', ink);
      st.setProperty('--bg-rgb', theme.bgRgb);
      st.setProperty('--ink-rgb', theme.inkRgb);
      st.setProperty('--accent', accent);
      st.setProperty('--accent-rgb', hexToRgb(accent).join(' '));
      var p = theme.paper;
      if (p) {
        st.setProperty('--rule-rgb', hexToRgb(p.rule).join(' '));
        st.setProperty('--margin-rgb', hexToRgb(p.margin).join(' '));
        st.setProperty('--hi-rgb', hexToRgb(p.hi).join(' '));
        st.setProperty('--shadow-rgb', hexToRgb(p.shadow).join(' '));
      }
      root.style.colorScheme = theme.light ? 'light' : 'dark';
      root.setAttribute('data-theme', theme.name);
      root.classList.toggle('is-paper', !!p);
      root.classList.toggle('is-colorful', !!theme.palette);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', bg);
    }
    if (AQ.render && AQ.render.onTheme) AQ.render.onTheme(fast);
    if (AQ.paper && AQ.paper.refresh) AQ.paper.refresh();
    if (AQ.events) AQ.events.emit('theme:changed', { name: theme.name, bg: bg, ink: ink, highContrast: theme.highContrast, step: !!fast });
  }

  function syncCycleTimer() {
    var on = !!(AQ.THEMES[theme.key] && AQ.THEMES[theme.key].cycle);
    if (on && !cycleTimer && typeof setInterval === 'function') cycleTimer = setInterval(function () { theme.tickCycle(); }, 1000);
    else if (!on && cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
  }

  AQ.events.on('settings:changed', function (p) {
    if (applying) return;
    if (p.key === 'theme' || p.key === 'highContrast') theme.apply();
  });
  // A save loaded / reset or a clock jump (wait, debug) re-tints at once instead of on the next 1 s tick.
  ['scene:changed', 'world:phase', 'game:wait'].forEach(function (ev) { AQ.events.on(ev, function () { theme.tickCycle(); }); });
})(window.AQ);
