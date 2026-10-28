// Translations: both dictionaries cover every key the game uses, and real game logs format
// cleanly in both languages (no raw keys, no leftover placeholders).

const I = UB.I18N;
const LANGS = ['pt', 'en'];
const D = UB.DEF;
// Anything that still looks like a dictionary key after formatting means a missing text.
const RAW = /\b(msg|reason|cause|why|bld|poi|zom|role|res|resdesc|weapon|bp|rank|side|weather|diff|feat|ter|obj|loot|tip|toast|ui)\.[A-Za-z_]/;

function inBoth(key) { return LANGS.every((l) => Object.prototype.hasOwnProperty.call(I.dict(l), key)); }
function clean(text, what) {
  assert.ok(typeof text === 'string' && text.trim(), `${what}: empty text`);
  assert.ok(!/[{}]/.test(text), `${what}: leftover placeholder in "${text}"`);
  assert.ok(!RAW.test(text), `${what}: raw key in "${text}"`);
  assert.ok(!/undefined|NaN|\[object/.test(text), `${what}: bad value in "${text}"`);
}
function withLang(lang, fn) {
  const prev = I.lang;
  I.set(lang);
  try { fn(); } finally { I.set(prev); }
}

test('pt and en have exactly the same keys, none empty', () => {
  const pt = I.dict('pt'), en = I.dict('en');
  const onlyPt = Object.keys(pt).filter((k) => !(k in en));
  const onlyEn = Object.keys(en).filter((k) => !(k in pt));
  assert.deepStrictEqual({ onlyPt, onlyEn }, { onlyPt: [], onlyEn: [] });
  for (const d of [pt, en]) {
    for (const k in d) assert.ok(typeof d[k] === 'function' || (typeof d[k] === 'string' && d[k].trim()), `empty text: ${k}`);
  }
});

test('every game id has a name in both languages', () => {
  const need = [];
  for (const id in D.BUILDINGS) need.push(`bld.${id}.name`, `bld.${id}.desc`, `tab.${D.BUILDINGS[id].cat}`);
  for (const id in D.POIS) need.push(`poi.${id}.name`, `poi.${id}.desc`);
  for (const id in D.ZOMBIES) need.push(`zom.${id}.name`, `zom.${id}.note`);
  for (const id in D.ROLES) need.push(`role.${id}.name`, `role.${id}.desc`);
  for (const id in D.WEAPONS) need.push(`weapon.${id}`);
  for (const id in D.CRAFT) need.push(`weapon.${id}`, `loot.${id}`);
  for (const id of D.RES) need.push(`res.${id}`, `resdesc.${id}`);
  for (const id of D.BLUEPRINTS) need.push(`bp.${id}`);
  D.RANKS.forEach((r, i) => need.push(`rank.${i}`));
  for (const id in D.DIFFICULTY) need.push(`diff.${id}`, `diffdesc.${id}`);
  for (const id in D.WEATHER) need.push(`weather.${id}`, `msg.weather.${id}`);
  for (const t of D.TERRAIN) need.push(`ter.${t.key}`);
  for (const f of D.FEATURE) if (f) need.push(`feat.${f.key}`);
  for (const s of ['NW', 'NE', 'SE', 'SW']) need.push(`side.${s}`);
  for (const o of UB.Objectives.LIST) need.push(`obj.${o.id}`);
  for (const o of ['move', 'amove', 'hold', 'attack', 'gather', 'loot', 'garrison', 'work', 'patient', 'build', 'repair', 'return']) need.push(`ord.${o}`);
  for (const k of ['build', 'repair', 'garrison', 'patient', 'idle']) need.push(`task.${k}`);
  const missing = need.filter((k) => !inBoth(k));
  assert.deepStrictEqual(missing, []);
});

test('every key written in the source code exists in both dictionaries', () => {
  const files = [
    ...src.list('js/sim').map((f) => 'js/sim/' + f),
    ...src.list('js/ui').map((f) => 'js/ui/' + f),
    'js/main.js',
  ];
  const PREFIX = 'msg|reason|cause|why|tip|toast|ui|menu|hud|ord|task|act|bld|poi|feat|ter|set|slots|over|rec|pause|place|build|unit|gen|idle|obj|sq|banner|tab|new|diffdesc|hint|group|zom|loot|res|weapon|side';
  const literal = new RegExp(`'((?:${PREFIX})\\.[\\w.]*\\w)'`, 'g');
  const used = new Set();
  for (const f of files) {
    const code = src.read(f);
    for (const m of code.matchAll(literal)) used.add(m[1]);
    // Tips are looked up as tip.<id>.
    if (f === 'js/main.js') for (const m of code.matchAll(/\{ id: '(\w+)', when/g)) if (m[1] !== 'select') used.add('tip.' + m[1]);
  }
  for (const m of src.read('index.html').matchAll(/data-i18n(?:-\w+)?="([^"]+)"/g)) used.add(m[1]);
  assert.ok(used.size > 250, 'scan found too few keys: ' + used.size);
  const missing = [...used].filter((k) => !inBoth(k));
  assert.deepStrictEqual(missing, []);
});

test('a real game log formats cleanly in both languages', () => {
  const seen = [];
  const orig = UB.Game.msg;
  UB.Game.msg = function (S, k, p) { seen.push({ k, p }); return orig.apply(this, arguments); };
  let S;
  try {
    S = UB.Game.newGame({ seed: 'idiomas', difficulty: 'hard' });
    UB.Bot.run(S, UB.Bot.strong, 3);
  } finally { UB.Game.msg = orig; }
  // Refused commands, with and without parameters.
  const hq = UB.World.hq(S);
  const reasons = [
    UB.Game.command(S, { type: 'build', build: 'wall', x: -5, y: -5 }),
    UB.Game.command(S, { type: 'build', build: 'turret', x: hq.tx + 4, y: hq.ty }),
    UB.Game.command(S, { type: 'demolish', id: hq.id }),
    UB.Game.command(S, { type: 'nope' }),
  ];
  S.res.wood = 0; S.res.scrap = 0;
  reasons.push(UB.Game.command(S, { type: 'build', build: 'shelter', x: hq.tx + 4, y: hq.ty + 4 }));
  const all = seen.concat(S.log.filter((m) => m.k));
  const kinds = new Set(all.map((m) => m.k));
  assert.ok(kinds.size >= 12, 'too few message kinds to be a useful check: ' + [...kinds].join(', '));
  for (const lang of LANGS) {
    withLang(lang, () => {
      for (const m of all) clean(I.msg(m), `${lang} ${m.k}`);
      for (const r of reasons) { assert.ok(!r.ok); clean(I.reason(r), `${lang} ${r.reason}`); }
      for (const m of S.memorial) clean(I.t(m.cause.k, m.cause.p), `${lang} ${m.cause.k}`);
      for (const o of UB.Objectives.LIST) clean(I.t('msg.objective', { o: o.id, items: Object.entries(o.reward).map(([res, n]) => ({ res, n })), bonus: 300 }), `${lang} obj ${o.id}`);
    });
  }
  withLang('en', () => {
    assert.strictEqual(I.t('msg.built', { b: 'wall' }), 'Wall finished.');
    assert.strictEqual(I.t('reason.missing', { items: [{ res: 'wood', n: 5 }, { res: 'scrap', n: 2 }] }), 'Missing 5 wood and 2 scrap');
  });
  withLang('pt', () => {
    assert.strictEqual(I.t('msg.horde', { n: 12, sides: ['NW', 'SE'] }), 'Horda de 12 zumbis se aproximando pelo Noroeste e Sudeste.');
  });
});

test('every loot and weather message formats in both languages', () => {
  const loot = [{ res: 'food', n: 4 }, { bp: 'bp_turret' }, { weapon: 'rifle' }];
  for (const lang of LANGS) {
    withLang(lang, () => {
      for (const id in D.POIS) {
        clean(I.t('msg.loot', { p: id, items: loot, last: true }), `${lang} loot ${id}`);
        clean(I.t('msg.loot', { p: id, items: [] }), `${lang} empty loot ${id}`);
        clean(I.t('msg.ambush', { p: id }), `${lang} ambush ${id}`);
      }
      for (const id in D.ZOMBIES) clean(I.t('msg.died', { name: 'Ana', cause: { k: 'cause.zombie', p: { z: id } } }), `${lang} died ${id}`);
      for (const f of D.FEATURE) if (f) clean(I.t('reason.clearFirst', { f: f.key }), `${lang} clear ${f.key}`);
    });
  }
});

test('language detection and fallbacks', () => {
  assert.strictEqual(I.detect(['pt-BR', 'en']), 'pt');
  assert.strictEqual(I.detect(['pt-PT']), 'pt');
  assert.strictEqual(I.detect(['en-US']), 'en');
  assert.strictEqual(I.detect(['de-DE', 'pt-BR']), 'en');
  assert.strictEqual(I.detect(['EN-gb']), 'en');
  assert.strictEqual(I.detect([]), 'en');
  // Unknown languages are ignored; messages from older saves keep their stored text.
  withLang('xx', () => assert.ok(['pt', 'en'].includes(I.lang)));
  assert.strictEqual(I.msg({ text: 'texto antigo' }), 'texto antigo');
  withLang('en', () => assert.strictEqual(I.t('banner.dusk', { sides: ['Noroeste', 'SE'], s: 9 }), '⚠ HORDE APPROACHING · Noroeste and Southeast · 9s'));
});

test('the simulation holds no player-facing text', () => {
  // Accented letters inside string literals of js/sim are a sign of untranslated text.
  for (const f of src.list('js/sim')) {
    const code = src.read('js/sim/' + f).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const hits = code.match(/'[^'\n]*[À-ÿ][^'\n]*'|`[^`]*[À-ÿ][^`]*`/g);
    assert.strictEqual(hits, null, `${f}: ${hits && hits.join(' | ')}`);
  }
});
