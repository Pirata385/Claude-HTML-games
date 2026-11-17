// Loads the DOM-free game modules into Node and returns the shared RB namespace.
'use strict';
const path = require('path');
const fs = require('fs');
const dir = path.join(__dirname, '..', 'js');
const ORDER = ['core', 'genome', 'species', 'phenotype', 'pose', 'physics', 'creature', 'fight', 'items', 'world', 'npc', 'economy', 'sea', 'lab', 'state'];
for (const name of ORDER) {
  const file = path.join(dir, name + '.js');
  if (fs.existsSync(file)) require(file);
}
module.exports = globalThis.RB;
