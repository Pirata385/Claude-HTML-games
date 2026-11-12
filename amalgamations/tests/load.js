// Loads every pure-logic module into globalThis.AM for the Node tests.
const path = require('path');
const files = ['core', 'data/bases', 'data/powers', 'data/items', 'data/skilltree', 'fusion', 'powerfusion', 'stats', 'loot', 'worldgen', 'dungeongen', 'quests', 'save'];
for (const f of files) require(path.join(__dirname, '..', 'js', f + '.js'));
module.exports = globalThis.AM;
