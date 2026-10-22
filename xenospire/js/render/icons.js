// 16x16 procedural power icons: a glyph per form, coloured by element, with
// pips for modifiers, a frame per tier, the payload of an Épico in a corner
// badge and (optionally) an element code.
(function (XS) {
  'use strict';

  const gfx = XS.gfx;
  const TIER_COLORS = ['#9a96b0', '#4aa8ff', '#c86aff', '#ff5ad0'];
  const ELEMENT_CODES = { plasma: 'PL', cryo: 'CR', gravity: 'GR', void: 'VZ', bio: 'BI', arc: 'AR', crystal: 'CS', sonic: 'SO', chrono: 'CN', psi: 'PS', earth: 'TE', light: 'LU' };
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
    sniper(g, r) { gfx.line(g, 2, 13, 13, 2, r[1]); gfx.line(g, 2, 12, 12, 2, r[3]); gfx.ellipseRing(g, 10, 6, 3, 3, r[2]); g.fillStyle = '#ffffff'; g.fillRect(10, 5, 1, 1); },
    drill(g, r) { gfx.poly(g, [[3, 4], [13, 9], [3, 13]], r[1]); for (let i = 0; i < 3; i++) gfx.line(g, 5 + i * 3, 5 + i, 5 + i * 3, 12 - i, r[3]); gfx.disc(g, 13, 9, 1, '#ffffff'); },
    wave(g, r) { for (let k = 0; k < 2; k++) for (let x = 2; x < 14; x++) { g.fillStyle = r[k ? 1 : 3]; g.fillRect(x, Math.round(8 + k * 3 - Math.sin((x - 2) / 3) * 3), 1, 2); } },
    eruption(g, r) { for (const [x, h] of [[3, 4], [7, 8], [11, 11]]) { gfx.poly(g, [[x - 2, 14], [x, 14 - h], [x + 2, 14]], r[1]); gfx.line(g, x, 14 - h, x, 13, r[3]); } },
    tornado(g, r) { for (let i = 0; i < 5; i++) gfx.ellipseRing(g, 8 + (i % 2), 3 + i * 2.4, 6 - i, 1.5, i % 2 ? r[2] : r[3]); },
    shotgun(g, r) { gfx.disc(g, 3, 8, 2, r[1]); for (const [x, y] of [[9, 3], [12, 6], [13, 10], [10, 13], [7, 7], [8, 10]]) gfx.disc(g, x, y, 1, r[3]); },
    quake(g, r) { gfx.line(g, 2, 12, 14, 12, r[1]); gfx.line(g, 8, 12, 6, 8, r[2]); gfx.line(g, 6, 8, 9, 5, r[2]); gfx.line(g, 8, 12, 11, 9, r[3]); for (const x of [3, 13]) gfx.line(g, x, 9, x, 11, r[3]); gfx.ball(g, 8, 3, 2, r); },
    grenade(g, r) { gfx.disc(g, 7, 9, 4.5, r[0]); gfx.ball(g, 7, 9, 4, r); g.fillStyle = r[0]; g.fillRect(6, 3, 3, 2); gfx.line(g, 9, 3, 12, 1, '#ffffff'); g.fillStyle = '#ffe08a'; g.fillRect(12, 1, 2, 2); },
    singularity(g, r) { gfx.ellipseRing(g, 8, 8, 7, 3, r[2]); gfx.ellipseRing(g, 8, 8, 5, 5, r[3]); gfx.disc(g, 8, 8, 3, '#05020a'); },
    meteor(g, r) { gfx.thickLine(g, 13, 2, 7, 8, 1.5, r[1]); gfx.line(g, 14, 3, 8, 9, r[3]); gfx.disc(g, 6, 10, 3.5, '#120a08'); gfx.ball(g, 6, 10, 3, ['#2a1c10', '#6a4a2a', r[2], r[3]]); },
  };

  // Tiny 5x5 badges for an Épico's payload (bottom-right corner).
  const BADGES = {
    nova(g, c) { gfx.ellipseRing(g, 13, 13, 2, 2, c); },
    field(g, c) { gfx.ellipse(g, 13, 13, 2.5, 1.5, c); },
    mines(g, c) { g.fillStyle = c; for (const [x, y] of [[11, 14], [13, 11], [15, 14]]) g.fillRect(x, y, 1, 1); },
    wall(g, c) { g.fillStyle = c; g.fillRect(11, 11, 4, 1); g.fillRect(11, 13, 4, 1); g.fillRect(12, 12, 1, 1); g.fillRect(14, 14, 1, 1); },
    singularity(g, c) { gfx.ellipseRing(g, 13, 13, 2, 1, c); g.fillStyle = '#000'; g.fillRect(13, 13, 1, 1); },
    rain(g, c) { g.fillStyle = c; for (const x of [11, 13, 15]) g.fillRect(x, 11 + (x % 2), 1, 3); },
    summon(g, c) { gfx.poly(g, [[13, 10], [15, 13], [13, 15], [11, 13]], c); },
    eruption(g, c) { g.fillStyle = c; for (const [x, h] of [[11, 2], [13, 4], [15, 3]]) g.fillRect(x, 15 - h, 1, h); },
    shotgun(g, c) { g.fillStyle = c; for (const [x, y] of [[13, 11], [11, 13], [15, 13], [13, 15], [13, 13]]) g.fillRect(x, y, 1, 1); },
    chain(g, c) { gfx.line(g, 11, 11, 13, 13, c); gfx.line(g, 13, 13, 12, 14, c); gfx.line(g, 12, 14, 15, 15, c); },
  };

  function power(def, opts = {}) {
    const key = keyOf(def) + (opts.codes ? 'c' : '');
    let cv = cache.get(key);
    if (cv) return cv;
    cv = gfx.makeCanvas(16, 16);
    const g = cv.getContext('2d');
    g.fillStyle = '#120c1e';
    g.fillRect(0, 0, 16, 16);
    (GLYPHS[def.form] || GLYPHS.bolt)(g, def.ramp);
    // Épico payload badge (Anômalo: in the second element's colour).
    if (def.combo && BADGES[def.combo.form]) {
      g.fillStyle = '#05020a'; g.fillRect(10, 10, 6, 6);
      BADGES[def.combo.form](g, (def.ramp2 || def.ramp)[3]);
    } else if (def.ramp2) { g.fillStyle = def.ramp2[2]; g.fillRect(13, 13, 2, 2); }
    // Modifier pips (top-left).
    for (let i = 0; i < Math.min(4, def.mods.length); i++) { g.fillStyle = i === 3 ? '#ff5ad0' : '#ffffff'; g.fillRect(1 + i * 2, 1, 1, 1); }
    // Frame per tier: plain, notched, double, double with sparkles.
    const C = TIER_COLORS[def.tier];
    g.fillStyle = C;
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    if (def.tier === 1) { g.fillStyle = '#bfe4ff'; for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15]]) g.fillRect(x, y, 1, 1); }
    if (def.tier >= 2) {
      g.fillStyle = XS.color.mix(C, '#000000', 0.45);
      g.fillRect(1, 1, 14, 1); g.fillRect(1, 14, 14, 1); g.fillRect(1, 1, 1, 14); g.fillRect(14, 1, 1, 14);
      g.fillStyle = '#ffe8ff'; g.fillRect(0, 0, 2, 1); g.fillRect(0, 0, 1, 2); g.fillRect(14, 15, 2, 1); g.fillRect(15, 14, 1, 2);
    }
    if (def.tier === 3) { g.fillStyle = '#5ff0ff'; for (let i = 0; i < 16; i += 3) { g.fillRect(i, 0, 1, 1); g.fillRect(15 - i, 15, 1, 1); g.fillRect(0, i, 1, 1); g.fillRect(15, 15 - i, 1, 1); } }
    if (opts.codes) gfx.text(g, ELEMENT_CODES[def.elements[0]] || '', 15, 10, '#ffffff', 'right', '#000000');
    cache.set(key, cv);
    return cv;
  }

  // Everything that changes the picture (Test Room filters can give one seed
  // several forms).
  const keyOf = (def) => [def.seed, def.tier, def.form, def.elements.join('+'), def.mods.join('+'), def.combo ? def.combo.form : ''].join(':');

  const urls = new Map();
  function url(def, opts = {}) {
    const key = keyOf(def) + (opts.codes ? 'c' : '');
    let u = urls.get(key);
    if (!u) { u = power(def, opts).toDataURL(); urls.set(key, u); }
    return u;
  }

  XS.icons = { power, url, TIER_COLORS, ELEMENT_CODES };
})(globalThis.XS = globalThis.XS || {});
