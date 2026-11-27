// Água-Tinta — theme table, colourful palette and art tints (owner A).
'use strict';
const fs = require('fs');
const path = require('path');

const HEX = /^#[0-9a-f]{6}$/;
function lum(hex) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

module.exports = function (T) {
  T.test('every theme / palette / paper entry is a valid colour', () => {
    const { AQ } = T.load();
    for (const [key, t] of Object.entries(AQ.THEMES)) {
      T.ok(HEX.test(t.bg) && HEX.test(t.ink), key + ' bg/ink');
      if (t.accent) T.ok(HEX.test(t.accent), key + ' accent');
      if (t.paper) for (const [k, v] of Object.entries(t.paper)) T.ok(HEX.test(v), key + '.paper.' + k);
      if (t.palette) for (const [k, v] of Object.entries(t.palette)) T.ok(HEX.test(v), key + '.palette.' + k + ' = ' + v);
      if (t.cycle) for (const k of ['day', 'dusk', 'night']) T.ok(AQ.THEMES[t.cycle[k]] && !AQ.THEMES[t.cycle[k]].cycle, key + '.cycle.' + k);
    }
  });

  T.test('ink reads on every background (incl. every ciclo step)', () => {
    const { AQ } = T.load();
    for (const th of AQ.ENUM.THEMES) {
      for (const k of [th, th + 'HC']) {
        const t = AQ.THEMES[k];
        T.ok(contrast(t.bg, t.ink) >= (k.endsWith('HC') ? 12 : 9), k + ' contrast ' + contrast(t.bg, t.ink).toFixed(1));
      }
    }
    // ciclo: every step of AQ.theme's blend keeps the ink readable
    const { context } = T.load({ fresh: true });
    const vm = require('vm');
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/engine/theme.js'), 'utf8'), context);
    const TH = context.AQ.theme;
    for (const key of ['ciclo', 'cicloHC']) {
      for (let s = 0; s <= TH.CYCLE_STEPS; s++) {
        const c = TH.cycleColors(key, s);
        T.ok(HEX.test(c.bg) && HEX.test(c.ink), key + ' step ' + s + ' colours');
        T.ok(contrast(c.bg, c.ink) >= 4.5, key + ' step ' + s + ' contrast ' + contrast(c.bg, c.ink).toFixed(2));
      }
      T.eq(TH.cycleColors(key, 0).bg, AQ.THEMES[AQ.THEMES[key].cycle.day].bg, key + ' full day');
      T.eq(TH.cycleColors(key, TH.CYCLE_STEPS).bg, AQ.THEMES[AQ.THEMES[key].cycle.night].bg, key + ' full night');
    }
    T.eq([TH.nightness(12 * 60), TH.nightness(0), TH.nightness(6 * 60), TH.nightness(18 * 60)], [0, 1, 0.5, 0.5], 'dawn / dusk');
  });

  T.test('the colourful palette colours every tint role', () => {
    const { AQ } = T.load();
    const pal = AQ.THEMES.colorido.palette;
    T.eq(AQ.TINT_ROLES[0], 'ink');
    T.eq(new Set(AQ.TINT_ROLES).size, AQ.TINT_ROLES.length, 'unique roles');
    T.ok(AQ.TINT_ROLES.length < 256, 'fits the Uint8 grid tint');
    for (const r of AQ.TINT_ROLES.slice(1)) T.ok(HEX.test(pal[r] || ''), 'palette.' + r);
    for (const k of Object.keys(pal)) T.ok(AQ.TINT_ROLES.indexOf(k) > 0, 'palette key is a role: ' + k);
  });

  T.test('every species, sighting and art item has a valid colourful-theme tint', () => {
    const { AQ } = T.load();
    const R = AQ.TINT_ROLES, S = AQ.TINTS.sprites;
    for (const id of AQ.ENUM.SPECIES) T.ok(R.indexOf(S[id]) > 0, 'species ' + id + ' → ' + S[id]);
    for (const key of AQ.sprites.keys()) T.ok(R.indexOf(S[key]) > 0, 'sprite ' + key + ' → ' + S[key]);
    for (const [p, role] of Object.entries(AQ.TINTS.art)) {
      let v = AQ.art;
      for (const k of p.split('.')) v = v && v[k];
      T.ok(v, 'art path exists: ' + p);
      T.ok(R.indexOf(role) > 0, 'art ' + p + ' → ' + role);
    }
    for (const [k, role] of Object.entries(AQ.TINTS.fx)) T.ok(R.indexOf(role) > 0, 'fx ' + k + ' → ' + role);
    for (const d of AQ.ENUM.DECOR) T.ok(AQ.TINTS.art['decor.' + d], 'decor ' + d + ' tinted');
  });

  T.test('colour literals live only in the theme table (and CSS fallbacks)', () => {
    const root = path.resolve(__dirname, '..');
    const bad = [];
    (function walk(dir) {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.js$/.test(f)) continue;
        const rel = path.relative(root, p).split(path.sep).join('/');
        if (rel === 'js/core/ns.js' || rel === 'js/engine/debug.js') continue;
        const src = fs.readFileSync(p, 'utf8');
        const m = src.match(/['"]#[0-9a-fA-F]{3,6}['"]|\brgba?\(\s*\d/g);
        if (m) bad.push(rel + ': ' + m.slice(0, 3).join(' '));
      }
    })(path.join(root, 'js'));
    T.eq(bad, []);
    const css = fs.readFileSync(path.join(root, 'css/ui.css'), 'utf8');
    T.ok(!/#[0-9a-fA-F]{3,6}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'ui.css uses theme variables only');
  });
};
