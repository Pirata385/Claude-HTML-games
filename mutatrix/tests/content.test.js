const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MX = require('./_load');
const { Data, Words } = MX;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') out.push(...walk(p)); }
    else if (/\.(js|mjs|html|css|md)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('nenhum emoji ou pictograma nos arquivos do jogo', () => {
  const root = path.join(__dirname, '..');
  const re = /\p{Extended_Pictographic}/u;
  for (const f of walk(root)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => assert.ok(!re.test(l), path.relative(root, f) + ':' + (i + 1) + ' ' + l.trim().slice(0, 80)));
  }
});

test('referências entre dados são válidas', () => {
  for (const h of Data.HOSTS) for (const t of h.likes.concat(h.dislikes)) assert.ok(Data.THEME[t], t);
  for (const a of Data.ARCH) for (const t of a.themes) assert.ok(Data.THEME[t], a.id + ' ' + t);
  for (const t of Data.THEMES) { assert.ok(Data.EVENTS[t.event], t.event); assert.ok(Data.DANGER_TEXT[t.id]); }
  for (const s of Data.SYNERGIES) assert.ok(Data.THEME[s.a] && Data.THEME[s.b]);
  for (const p of Words.PROFESSIONS) for (const t of p.themes) assert.ok(Data.THEME[t]);
  for (const it of Data.SHOP) if (it.need) assert.ok(Data.SHOP_ITEM[it.need]);
  assert.strictEqual(new Set(Data.ARCH.map((a) => a.id)).size, Data.ARCH.length);
  assert.ok(Data.ARCH.length >= 48);
  assert.strictEqual(Data.THEMES.length, 12);
  assert.strictEqual(Data.CAPSIDS.length, 8);
});

test('todo texto desenhado na cena cabe na fonte em pixel', () => {
  require(path.join(__dirname, '..', 'js', 'render', 'pix.js'));
  const X = globalThis.MX.Pix;
  const strings = [].concat(Words.SPEECH, Object.values(Words.SUBJECT_NAMES).flat(), Words.TITLES_M, Words.TITLES_F, Words.ROBOT_MODELS,
    Data.HOSTS.map((h) => h.short), ['PRONTA', 'SÍNTESE', 'CEPA OK', 'CÂMARA 01', 'VAZIA', 'PERIGO', 'MUTE', 'COM', 'FRÁGIL', 'FICHA DE ESPÉCIME', 'APROVADO', 'NORMAL. AINDA.', 'MUTAÇÕES', 'Nº 0001', 'DOSES', 'BIZ', 'INST', 'Ai!',
      'Para de cutucar!', 'Isso faz cócegas.', 'Eu mordo, hein.', 'De novo não!', 'Que dedo gelado.']);
  for (const a of Data.ARCH) for (const t of Data.THEMES) { strings.push(a.noun + ' ' + t.adj[a.g]); for (const c of t.comp) strings.push(a.noun + ' ' + c); }
  for (const str of strings) for (const ch of str) assert.ok(X.supports(ch), 'caractere sem glifo: "' + ch + '" em "' + str + '"');
});
