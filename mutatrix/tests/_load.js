// Carrega os módulos de lógica pura do jogo no globalThis.MX, na mesma ordem do index.html.
const path = require('path');
const files = ['rng', 'data', 'words', 'genetics', 'mutations', 'subject', 'contracts', 'economy', 'save'];
for (const f of files) require(path.join(__dirname, '..', 'js', f + '.js'));
module.exports = globalThis.MX;
