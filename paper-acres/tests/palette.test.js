'use strict';
// The game shows exactly two colours: paper #efe4c8 and ink #000000. Greys and white may only appear in files
// that draw into the offscreen ASCII buffer (never shown on screen; they only steer the glyph matcher).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./load');

const BUFFER_FILES = new Set(['src/render/ascii.js', 'src/render/worldDraw.js', 'src/render/weather.js', 'src/physics/player.js', 'src/draw/sketchpad.js']);
function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(rel)); else if (/\.(js|html|css)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const isGrey = (h) => { const x = h.slice(1); const full = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.slice(0, 6); return full.slice(0, 2) === full.slice(2, 4) && full.slice(2, 4) === full.slice(4, 6); };

test('only paper and ink are ever shown', () => {
  const list = ['index.html', ...files('src')];
  const bad = [];
  for (const f of list) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const h = m[0].toLowerCase();
      if (h === '#efe4c8' || h === '#000000' || h === '#000') continue;
      if (BUFFER_FILES.has(f) && isGrey(h)) continue;
      if (f === 'src/render/ascii.js' && h === '#0000ff') continue; // solid-body marker inside the offscreen buffer only
      bad.push(f + ': ' + h);
    }
    if (/\b(rgba?|hsla?)\(/.test(src)) bad.push(f + ': rgb/hsl colour');
    for (const m of src.matchAll(/['"](white|black|gr[ae]y|red|blue|green|yellow|orange|purple|pink|brown)['"]/gi)) bad.push(f + ': named colour ' + m[1]);
  }
  assert.deepStrictEqual(bad, []);
});
