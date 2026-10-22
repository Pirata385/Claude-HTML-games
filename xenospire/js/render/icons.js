// 16x16 procedural power icons: a glyph per form, coloured by element, with
// pips for modifiers, a tier frame and (optionally) an element code.
(function (XS) {
  'use strict';

  const gfx = XS.gfx;
  const TIER_COLORS = ['#9a96b0', '#4aa8ff', '#c86aff', '#ff5ad0'];
  const ELEMENT_CODES = { plasma: 'PL', cryo: 'CR', gravity: 'GR', void: 'VZ', bio: 'BI', arc: 'AR', crystal: 'CS', sonic: 'SO', chrono: 'CN', psi: 'PS' };
  const cache = new Map();

  const GLYPHS = {
    bolt(g, r) { gfx.line(g, 3, 12, 8, 7, r[1]); gfx.line(g, 4, 13, 9, 8, r[1]); gfx.disc(g, 10, 6, 3, r[0]); gfx.ball(g, 10, 6, 2.5, r); },
    beam(g, r) { gfx.thickLine(g, 3, 12, 12, 3, 1.5, r[1]); gfx.line(g, 3, 12, 12, 3, r[3]); gfx.disc(g, 12, 3, 1.5, r[3]); },
    nova(g, r) { gfx.ellipseRing(g, 8, 8, 6, 6, r[2]); gfx.ellipseRing(g, 8, 8, 4, 4, r[1]); gfx.ball(g, 8, 8, 2, r); },
    cone(g, r) { gfx.poly(g, [[3, 8], [13, 3], [13, 13]], r[1]); gfx.poly(g, [[3, 8], [12, 5], [12, 11]], r[2]); gfx.disc(g, 3, 8, 1.5, r[3]); },
    field(g, r) { gfx.ellipse(g, 8, 10, 6, 3, r[1]); gfx.ellipseRing(g, 8, 10, 6, 3, r[3]); gfx.disc(g, 6, 6, 1, r[2]); gfx.disc(g, 10, 4, 1, r[2]); },
    rain(g, r) { for (const [x, y] of [[4, 4], [8, 7], [12, 3]]) { gfx.line(g, x, y, x - 1, y + 4, r[1]); gfx.disc(g, x - 1, y + 5, 1, r[3]); } gfx.line(g, 2, 13, 13, 13, r[2]); },
    dash(g, r) { for (const x of [3, 7, 11]) { gfx.line(g, x, 4, x + 3, 8, r[x === 11 ? 3 : 2]); gfx.line(g, x + 3, 8, x, 12, r[x === 11 ? 3 : 2]); } },
    orbit(g, r) { gfx.ellipseRing(g, 8, 8, 6, 4, r[1]); gfx.ball(g, 8, 8, 2, r); gfx.disc(g, 2, 8, 1.5, r[3]); gfx.disc(g, 12, 5, 1.5, r[3]); gfx.disc(g, 11, 12, 1.5, r[3]); },
    summon(g, r) { gfx.line(g, 8, 9, 8, 14, r[0]); gfx.disc(g, 8, 7, 4, r[0]); gfx.ball(g, 8, 7, 3, r); g.fillStyle = '#ffffff'; g.fillRect(8, 6, 2, 2); g.fillStyle = '#100818'; g.fillRect(9, 7, 1, 1); },
    mine(g, r) { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; gfx.line(g, 8, 9, 8 + Math.cos(a) * 5, 9 + Math.sin(a) * 4, r[1]); } gfx.disc(g, 8, 9, 3, r[0]); gfx.ball(g, 8, 9, 2.5, r); g.fillStyle = '#ff4040'; g.fillRect(8, 8, 1, 1); },
    wall(g, r) { for (let y = 4; y < 14; y += 3) for (let x = (y % 2 ? 1 : 3); x < 14; x += 5) { g.fillStyle = r[2]; g.fillRect(x, y, 4, 2); g.fillStyle = r[1]; g.fillRect(x, y + 2, 4, 1); } },
    boomerang(g, r) { gfx.thickLine(g, 3, 11, 8, 3, 1, r[2]); gfx.thickLine(g, 8, 3, 13, 11, 1, r[2]); gfx.line(g, 3, 11, 8, 3, r[3]); },
    hook(g, r) { gfx.line(g, 2, 13, 9, 6, r[1]); gfx.thickLine(g, 9, 6, 9, 2, 1, r[2]); gfx.thickLine(g, 9, 6, 13, 6, 1, r[2]); gfx.thickLine(g, 13, 6, 13, 3, 1, r[3]); },
    blink(g, r) { gfx.disc(g, 4, 10, 2, r[1]); for (let i = 0; i < 4; i++) { g.fillStyle = r[2]; g.fillRect(6 + i * 1.5, 9 - i * 1.5, 1, 1); } gfx.disc(g, 12, 4, 2.5, r[0]); gfx.ball(g, 12, 4, 2, r); },
    aura(g, r) { gfx.ellipseRing(g, 8, 8, 7, 7, r[1]); gfx.ellipseRing(g, 8, 8, 5, 5, r[2]); gfx.ball(g, 8, 8, 2.5, r); },
  };

  function power(def, opts = {}) {
    const key = def.seed + ':' + def.tier + ':' + def.form + (opts.codes ? 'c' : '');
    let cv = cache.get(key);
    if (cv) return cv;
    cv = gfx.makeCanvas(16, 16);
    const g = cv.getContext('2d');
    g.fillStyle = '#120c1e';
    g.fillRect(0, 0, 16, 16);
    (GLYPHS[def.form] || GLYPHS.bolt)(g, def.ramp);
    if (def.ramp2) { g.fillStyle = def.ramp2[2]; g.fillRect(13, 13, 2, 2); }
    // Modifier pips (top-left).
    for (let i = 0; i < Math.min(4, def.mods.length); i++) { g.fillStyle = i === 3 ? '#ff5ad0' : '#ffffff'; g.fillRect(1 + i * 2, 1, 1, 1); }
    // Tier frame.
    g.fillStyle = TIER_COLORS[def.tier];
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    if (def.tier === 3) { g.fillStyle = '#5ff0ff'; for (let i = 0; i < 16; i += 3) { g.fillRect(i, 0, 1, 1); g.fillRect(15 - i, 15, 1, 1); } }
    if (opts.codes) gfx.text(g, ELEMENT_CODES[def.elements[0]] || '', 15, 10, '#ffffff', 'right', '#000000');
    cache.set(key, cv);
    return cv;
  }

  const urls = new Map();
  function url(def, opts = {}) {
    const key = def.seed + ':' + def.tier + (opts.codes ? 'c' : '');
    let u = urls.get(key);
    if (!u) { u = power(def, opts).toDataURL(); urls.set(key, u); }
    return u;
  }

  XS.icons = { power, url, TIER_COLORS, ELEMENT_CODES };
})(globalThis.XS = globalThis.XS || {});
