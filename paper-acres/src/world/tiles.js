/* Tile registry. Glyphs are chosen per cell from a deterministic hash so ground looks hand-stippled. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const names = ['AIR', 'DIRT', 'GRASS', 'STONE', 'BEDROCK', 'WATER', 'SAND', 'PLANK', 'TRUNK', 'LEAVES',
    'DECO', 'ART', 'DOOR', 'LADDER', 'FENCE', 'SOIL', 'SOIL_WET', 'WEED', 'ROCK', 'BRANCH',
    'FLOWER', 'BUSH', 'ORE_COPPER', 'ORE_IRON', 'ORE_GOLD', 'ORE_GRAPHITE', 'INKSTONE', 'SPIKES', 'CROP', 'FORAGE',
    'OBJ', 'BRICK', 'ROOF', 'STUMP', 'CRYSTAL', 'FRAGILE', 'GLASS'];
  const T = {};
  names.forEach((n, i) => { T[n] = i; });
  const H = (x, y, z, s) => PA.RNG.hash3(x, y, z, s || 7);
  const pick = (arr, x, y, z, s) => arr[H(x, y, z, s) % arr.length];
  const metaChar = (g, x, y, z, dflt) => { const m = g.meta(x, y, z); return m ? String.fromCharCode(m) : dflt; };
  const season = () => (PA.season || 'spring');

  const DEF = { solid: false, ladder: false, water: false, decor: false, style: null, breakable: null, tillable: false };
  const TILES = [];
  const SEE_THROUGH = new Set(['weed', 'flower', 'branch', 'crop', 'forage', 'fence', 'ladder', 'spikes', 'object', 'rock', 'bush', 'air']);
  function def(id, o) { const d = Object.assign({}, DEF, o); if (d.opaque == null) d.opaque = !SEE_THROUGH.has(d.name); TILES[id] = d; }

  def(T.AIR, { name: 'air', glyph: () => ' ' });
  // Natural ground is drawn as an outline: the surface line lives in the air cell above (see airGlyph),
  // step/cliff sides get '|', ceilings '-', and the inside is nearly empty paper.
  function groundGlyph(g, x, y, z, dots) {
    if (!g.solid(x - 1, y, z) || !g.solid(x + 1, y, z)) return g.solid(x, y - 1, z) || !g.solid(x, y + 1, z) ? (g.solid(x, y + 1, z) ? '|' : '|') : '|';
    if (!g.solid(x, y + 1, z) && y + 1 < g.h) return '-';
    const r = H(x, y, z) % 60;
    return r < 60 - dots ? ' ' : r % 2 ? '.' : ',';
  }
  def(T.DIRT, { name: 'dirt', solid: true, tillable: true, line: '_', glyph: (g, x, y, z) => groundGlyph(g, x, y, z, 3) });
  def(T.GRASS, { name: 'grass', solid: true, tillable: true, line: 'grass', glyph: (g, x, y, z) => groundGlyph(g, x, y, z, 2) });
  def(T.STONE, { name: 'stone', solid: true, line: 'stone', breakable: { tool: 'pickaxe', hp: 6, drop: 'stone' }, glyph(g, x, y, z) {
    const e = groundGlyph(g, x, y, z, 0);
    if (e !== ' ') return e;
    const r = H(x, y, z) % 40;
    return r < 2 ? '%' : r < 4 ? '.' : ' ';
  } });
  def(T.BEDROCK, { name: 'bedrock', solid: true, line: '_', glyph: (g, x, y, z) => pick(['=', '-', '=', ' '], x, y, z) });
  def(T.WATER, { name: 'water', water: true, glyph(g, x, y, z) {
    if (g.get(x, y - 1, z) === T.AIR) return '~';
    return pick([' ', ' ', '-', '~', ' ', '.'], x, y, z);
  } });
  def(T.SAND, { name: 'sand', solid: true, line: '_', glyph: (g, x, y, z) => { const e = groundGlyph(g, x, y, z, 0); return e !== ' ' ? e : pick(['.', ' ', ' ', '.', ' ', ' '], x, y, z); } });
  def(T.PLANK, { name: 'plank', solid: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, '=') });
  def(T.TRUNK, { name: 'trunk', decor: true, breakable: { tool: 'axe', hp: 10, drop: 'wood' }, glyph: (g, x, y, z) => metaChar(g, x, y, z, '|') });
  // Canopies are painted as outlines (meta char); the inside is blank paper that still hides farther slices.
  def(T.LEAVES, { name: 'leaves', decor: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, ' ') });
  def(T.DECO, { name: 'deco', decor: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, ' ') });
  def(T.ART, { name: 'art', solid: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, '#') });
  def(T.DOOR, { name: 'door', decor: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, '|') });
  def(T.LADDER, { name: 'ladder', ladder: true, glyph: () => 'H' });
  def(T.FENCE, { name: 'fence', decor: true, glyph: (g, x) => (x % 2 === 0 ? '+' : '-') });
  def(T.SOIL, { name: 'soil', solid: true, glyph: (g, x, y, z) => pick(['=', '=', '-', '='], x, y, z, 3) });
  def(T.SOIL_WET, { name: 'wet soil', solid: true, glyph: () => '#' });
  def(T.WEED, { name: 'weed', decor: true, breakable: { tool: 'scythe', hp: 1, drop: 'fiber' }, glyph: (g, x, y, z) => pick(['w', 'v', 'Y', 'w'], x, y, z) });
  def(T.ROCK, { name: 'rock', decor: true, breakable: { tool: 'pickaxe', hp: 2, drop: 'stone' }, glyph: () => '@' });
  def(T.BRANCH, { name: 'branch', decor: true, breakable: { tool: 'axe', hp: 1, drop: 'wood' }, glyph: (g, x, y, z) => pick(['/', '\\', '/'], x, y, z) });
  def(T.FLOWER, { name: 'flower', decor: true, glyph: (g, x, y, z) => pick(['*', '*', 'f', '+'], x, y, z) });
  def(T.BUSH, { name: 'bush', decor: true, glyph: (g, x, y, z) => pick(['m', 'n', 'm'], x, y, z) });
  def(T.ORE_COPPER, { name: 'copper ore', solid: true, style: 2, breakable: { tool: 'pickaxe', hp: 8, drop: 'copper_ore' }, glyph: () => 'c' });
  def(T.ORE_IRON, { name: 'iron ore', solid: true, style: 2, breakable: { tool: 'pickaxe', hp: 11, drop: 'iron_ore' }, glyph: () => 'i' });
  def(T.ORE_GOLD, { name: 'gold ore', solid: true, style: 2, breakable: { tool: 'pickaxe', hp: 14, drop: 'gold_ore' }, glyph: () => '$' });
  def(T.ORE_GRAPHITE, { name: 'graphite', solid: true, style: 2, breakable: { tool: 'pickaxe', hp: 7, drop: 'graphite' }, glyph: () => 'g' });
  def(T.INKSTONE, { name: 'inkstone', solid: true, style: 2, breakable: { tool: 'pickaxe', hp: 12, drop: 'inkstone' }, glyph: () => '&' });
  def(T.SPIKES, { name: 'spikes', decor: true, hazard: true, glyph: () => '^' });
  def(T.CROP, { name: 'crop', decor: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, '.') });
  def(T.FORAGE, { name: 'forage', decor: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, '*') });
  def(T.OBJ, { name: 'object', decor: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, '?') });
  def(T.BRICK, { name: 'brick', solid: true, glyph: (g, x, y) => (((x + (y % 2) * 2) % 4) === 0 ? '|' : '_') });
  def(T.ROOF, { name: 'roof', solid: true, glyph: (g, x, y, z) => metaChar(g, x, y, z, '=') });
  def(T.STUMP, { name: 'stump', solid: true, breakable: { tool: 'axe', hp: 4, drop: 'wood' }, glyph: () => 'U' });
  def(T.CRYSTAL, { name: 'crystal', solid: true, style: 2, breakable: { tool: 'pickaxe', hp: 9, drop: 'quartz' }, glyph: () => '*' });
  def(T.FRAGILE, { name: 'cracked rock', solid: true, breakable: { tool: 'bomb', hp: 1, drop: null }, glyph: (g, x, y, z) => pick(['%', 'x', '%'], x, y, z) });
  def(T.GLASS, { name: 'glass', solid: true, glyph: () => ' ' });

  /** Glyph for an AIR cell: the outline of the ground right below it (or nothing). */
  function airGlyph(g, x, y, z) {
    const b = TILES[g.get(x, y + 1, z)];
    if (!b || !b.line || y + 1 >= g.h) return ' ';
    if (b.line === 'grass') { const r = H(x, y, z, 9) % 9; return r === 0 ? ',' : '_'; }
    if (b.line === 'stone') { const r = H(x, y, z, 9) % 12; return r === 0 ? '^' : '_'; }
    return b.line;
  }

  function tileGlyph(g, x, y, z) {
    if (g.get(x, y, z) === 0) return airGlyph(g, x, y, z);
    const t = TILES[g.get(x, y, z)];
    return t ? t.glyph(g, x, y, z) : '?';
  }

  PA.T = T;
  PA.TILES = TILES;
  PA.tileGlyph = tileGlyph;
  PA.airGlyph = airGlyph;
  if (typeof module !== 'undefined' && module.exports) module.exports = { T, TILES, tileGlyph };
})(typeof window !== 'undefined' ? window : globalThis);
