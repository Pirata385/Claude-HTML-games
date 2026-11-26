// Água-Tinta — theme (owner A). Two colours only: bg and ink, from AQ.THEMES.
(function (AQ) {
  'use strict';

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  var applying = false;

  var theme = AQ.theme = {
    name: 'noite',          // base theme name ('noite' | 'papel')
    key: 'noite',           // AQ.THEMES key, incl. 'HC' suffix
    highContrast: false,
    temporary: false,       // true after apply(name, {persist:false})
    bg: AQ.THEMES.noite.bg,
    ink: AQ.THEMES.noite.ink,
    bgRgb: hexToRgb(AQ.THEMES.noite.bg).join(' '),
    inkRgb: hexToRgb(AQ.THEMES.noite.ink).join(' '),
    bgArr: hexToRgb(AQ.THEMES.noite.bg),
    inkArr: hexToRgb(AQ.THEMES.noite.ink),

    // apply(name?, {persist=true}): no name → from settings (theme + highContrast).
    // A name with persist:false is temporary (the ending); apply() with no name reverts to settings.
    apply: function (name, opts) {
      var persist = !(opts && opts.persist === false);
      var S = AQ.settings;
      var hc = !!S.get('highContrast');
      var base = name || S.get('theme');
      if (!AQ.THEMES[base]) base = 'noite';
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
      theme.bg = t.bg;
      theme.ink = t.ink;
      theme.bgArr = hexToRgb(t.bg);
      theme.inkArr = hexToRgb(t.ink);
      theme.bgRgb = theme.bgArr.join(' ');
      theme.inkRgb = theme.inkArr.join(' ');

      if (typeof document !== 'undefined') {
        var st = document.documentElement.style;
        st.setProperty('--bg', t.bg);
        st.setProperty('--ink', t.ink);
        st.setProperty('--bg-rgb', theme.bgRgb);
        st.setProperty('--ink-rgb', theme.inkRgb);
        document.documentElement.style.colorScheme = base === 'papel' ? 'light' : 'dark';
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', t.bg);
      }
      if (AQ.render && AQ.render.onTheme) AQ.render.onTheme();
      if (AQ.events) AQ.events.emit('theme:changed', { name: base, bg: t.bg, ink: t.ink, highContrast: hc });
      return theme;
    }
  };

  AQ.events.on('settings:changed', function (p) {
    if (applying) return;
    if (p.key === 'theme' || p.key === 'highContrast') theme.apply();
  });
})(window.AQ);
