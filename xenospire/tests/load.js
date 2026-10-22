// Loads the DOM-free game logic into globalThis.XS for Node tests and
// headless simulations. Order matches the <script> tags in index.html.
'use strict';
const path = require('path');

const LOGIC_FILES = [
  'core/rng.js',
  'core/math.js',
  'core/events.js',
  'core/store.js',
  'core/strings.js',
  'gen/palette.js',
  'gen/lore.js',
  'gen/creature.js',
  'gen/power.js',
  'gen/arena.js',
  'world/voxels.js',
  'anim/rig.js',
  'game/status.js',
  'game/fighter.js',
  'game/powers.js',
  'game/nav.js',
  'game/ai.js',
  'game/battle.js',
  'game/lab.js',
  'game/run.js',
];

const fs = require('fs');
for (const f of LOGIC_FILES) {
  const p = path.join(__dirname, '..', 'js', f);
  if (fs.existsSync(p)) require(p);
}

module.exports = globalThis.XS;
