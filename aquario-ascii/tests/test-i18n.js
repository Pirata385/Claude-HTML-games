// Água-Tinta — i18n tests (owner E), §15.11: identical key sets for pt-BR and en across ALL string files,
// no empty strings, matching {placeholders}, data-driven keys present (sp.*, item.*, goal.*, ach.*, msg.*,
// zone.*, sighting.*, fish.escape.*), and every literal key used by E's UI code exists.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function (T) {
  const ROOT = path.resolve(__dirname, '..');
  const FILES = ['strings-ui', 'strings-world', 'strings-fishing', 'strings-economy'];

  function dicts() {
    const { AQ } = T.load();
    return { AQ, pt: AQ.i18n._dicts['pt-BR'], en: AQ.i18n._dicts.en };
  }
  function owner(key) {
    const p = key.split('.')[0];
    if (/^(ui|hud|settings|tut|note|credits|rarity|size|common|debug)$/.test(p)) return 'strings-ui (E)';
    if (/^(sp|sighting|zone|phase|weather|kind|behavior)$/.test(p)) return 'strings-world (B)';
    if (p === 'fish') return 'strings-fishing (C)';
    if (/^(item|goal|ach|msg|aq)$/.test(p)) return 'strings-economy (D)';
    return 'unknown owner';
  }
  function report(list, max) {
    const by = {};
    list.forEach((k) => { (by[owner(k)] = by[owner(k)] || []).push(k); });
    return Object.keys(by).map((o) => o + ': ' + by[o].length + ' [' + by[o].slice(0, max || 8).join(', ') + (by[o].length > (max || 8) ? ', …' : '') + ']').join(' | ');
  }
  function placeholders(s) { return (String(s).match(/\{[A-Za-z0-9_]+\}/g) || []).sort().filter((x, i, a) => a.indexOf(x) === i); }

  T.test('every string file is listed in index.html and loads', () => {
    const scripts = T.loader.scriptList(false);
    FILES.forEach((f) => T.ok(scripts.indexOf('js/data/' + f + '.js') >= 0, f + ' in index.html'));
  });

  T.test('pt-BR and en have identical key sets (all string files)', () => {
    const { pt, en } = dicts();
    const missingEn = Object.keys(pt).filter((k) => !(k in en)).sort();
    const missingPt = Object.keys(en).filter((k) => !(k in pt)).sort();
    T.ok(!missingEn.length && !missingPt.length,
      (missingEn.length ? 'missing in en → ' + report(missingEn) : '') + (missingPt.length ? ' ; missing in pt-BR → ' + report(missingPt) : ''));
  });

  T.test('no empty strings', () => {
    const { pt, en } = dicts();
    const empty = [];
    Object.keys(pt).forEach((k) => { if (typeof pt[k] !== 'string' || !pt[k].trim()) empty.push('pt-BR:' + k); });
    Object.keys(en).forEach((k) => { if (typeof en[k] !== 'string' || !en[k].trim()) empty.push('en:' + k); });
    T.eq(empty, [], 'empty or non-string values');
  });

  T.test('{placeholders} match between languages', () => {
    const { pt, en } = dicts();
    const bad = [];
    Object.keys(pt).forEach((k) => {
      if (!(k in en)) return;
      const a = placeholders(pt[k]).join(','), b = placeholders(en[k]).join(',');
      if (a !== b) bad.push(k + ' (' + a + ' vs ' + b + ')');
    });
    T.eq(bad, [], 'placeholder mismatch');
  });

  T.test('plural keys come in .one/.other pairs', () => {
    const { pt } = dicts();
    const bad = [];
    Object.keys(pt).forEach((k) => {
      if (/\.one$/.test(k) && !(k.replace(/\.one$/, '.other') in pt)) bad.push(k);
      if (/\.other$/.test(k) && !(k.replace(/\.other$/, '.one') in pt)) bad.push(k);
    });
    T.eq(bad, [], 'unpaired plural keys');
  });

  T.test('data ids have their strings (sp, sighting, zone, item, goal, ach, msg, fish.escape)', () => {
    const { AQ, pt } = dicts();
    const keys = Object.keys(pt);
    const hasPrefix = (p) => keys.some((k) => k === p || k.indexOf(p + '.') === 0);
    const missing = [];
    const spIds = (AQ.species && AQ.species.ids && AQ.species.ids().length) ? AQ.species.ids() : AQ.ENUM.SPECIES.slice();
    spIds.forEach((id) => {
      if (!pt['sp.' + id + '.name']) missing.push('sp.' + id + '.name');
      if (!pt['sp.' + id + '.flavor']) missing.push('sp.' + id + '.flavor');
    });
    AQ.ENUM.SIGHTINGS.forEach((id) => { if (!hasPrefix('sighting.' + id)) missing.push('sighting.' + id); });
    AQ.ENUM.ZONES.forEach((id) => { if (!hasPrefix('zone.' + id)) missing.push('zone.' + id); });
    AQ.ENUM.PHASES.forEach((id) => { if (!hasPrefix('phase.' + id)) missing.push('phase.' + id); });
    AQ.ENUM.WEATHER.forEach((id) => { if (!hasPrefix('weather.' + id)) missing.push('weather.' + id); });
    const items = (AQ.items && AQ.items.list) || [];
    items.forEach((it) => { if (!hasPrefix('item.' + it.id)) missing.push('item.' + it.id); });
    if (AQ.items && AQ.items.GEAR) {
      Object.keys(AQ.items.GEAR).forEach((slot) => AQ.items.GEAR[slot].forEach((g) => {
        if (g.name && !pt[g.name] && !(slot === 'lantern' && g.tier === 0)) missing.push(g.name);
      }));
    }
    const goals = (AQ.goals && AQ.goals.chain && AQ.goals.chain.length) ? AQ.goals.chain.map((g) => g.id) : AQ.ENUM.GOALS;
    goals.forEach((id) => { if (!hasPrefix('goal.' + id)) missing.push('goal.' + id); });
    const achs = (AQ.goals && AQ.goals.achievements && AQ.goals.achievements.length) ? AQ.goals.achievements.map((a) => a.id) : AQ.ENUM.ACHIEVEMENTS;
    achs.forEach((id) => { if (!hasPrefix('ach.' + id)) missing.push('ach.' + id); });
    AQ.ENUM.MESSAGES.forEach((id) => { if (!hasPrefix('msg.' + id)) missing.push('msg.' + id); });
    AQ.ENUM.ESCAPE.forEach((r) => { if (!hasPrefix('fish.escape.' + r)) missing.push('fish.escape.' + r); });
    T.ok(!missing.length, 'missing → ' + report(missing, 10));
  });

  T.test('E: story notes, rarity, size, settings options and tutorial steps have strings', () => {
    const { AQ, pt } = dicts();
    const missing = [];
    AQ.ENUM.NOTES.forEach((id) => { if (!pt['note.' + id]) missing.push('note.' + id); });
    AQ.ENUM.RARITY.forEach((r) => { if (!pt['rarity.' + r]) missing.push('rarity.' + r); });
    AQ.ENUM.SIZE.forEach((s) => { if (!pt['size.' + s]) missing.push('size.' + s); });
    AQ.ENUM.BAITS.forEach((b) => { if (!pt['hud.baitName.' + b]) missing.push('hud.baitName.' + b); });
    AQ.ENUM.LIGHT.forEach((l) => { if (!pt['hud.lightMode.' + l]) missing.push('hud.lightMode.' + l); });
    ['auto', 'high', 'medium', 'low'].forEach((q) => { if (!pt['settings.q.' + q]) missing.push('settings.q.' + q); });
    ['format', 'checksum', 'json', 'shape', 'future', 'migrate'].forEach((e) => { if (!pt['ui.saveio.err.' + e]) missing.push('ui.saveio.err.' + e); });
    AQ.ENUM.HABITAT.forEach((h) => { if (!pt['ui.fish.habitat.' + h]) missing.push('ui.fish.habitat.' + h); });
    T.eq(missing, []);
  });

  T.test('E: every literal key used by the UI code exists', () => {
    const { pt } = dicts();
    const files = ['js/ui/dom.js', 'js/ui/hud.js', 'js/ui/modals.js', 'js/ui/menus.js', 'js/ui/shop.js', 'js/ui/bestiary.js',
      'js/ui/cards.js', 'js/ui/goals.js', 'js/ui/tutorial.js', 'js/scenes/title.js', 'js/scenes/ending.js'];
    const re = /(?:\bt|i18n\.t|tn|key:|Key:|titleKey:|bodyKey:|okKey:|cancelKey:)\s*\(?\s*'((?:ui|hud|settings|tut|note|credits|rarity|size|common)\.[A-Za-z0-9_.]+)'/g;
    const missing = [];
    files.forEach((f) => {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      let m;
      while ((m = re.exec(src))) {
        const k = m[1];
        if (k.endsWith('.')) continue;
        const isBase = Object.keys(pt).some((x) => x.indexOf(k + '.') === 0);
        if (!(k in pt) && !isBase) missing.push(f + ': ' + k);
      }
    });
    T.eq(missing, [], 'keys referenced in code but not defined');
  });

  T.test('canvas-drawn strings stay inside the atlas charset', () => {
    const { AQ, pt, en } = dicts();
    const allowed = new Set(AQ.CHARSET.text.split(''));
    const bad = [];
    const keys = Object.keys(pt).filter((k) => /^credits\./.test(k) || k === 'ui.title.subtitle' || k === 'ui.title.name');
    keys.forEach((k) => [pt[k], en[k]].forEach((s) => {
      String(s || '').split('').forEach((ch) => { if (!allowed.has(ch)) bad.push(k + ':' + ch); });
    }));
    T.eq(bad, []);
  });

  T.test('i18n helpers: tn plural and interpolation with UI keys', () => {
    const { AQ } = T.load();
    AQ.i18n.setLang('pt-BR', { silent: true });
    T.eq(AQ.i18n.tn('common.coins', 1), '1 moeda');
    T.eq(AQ.i18n.tn('common.coins', 1250), '1.250 moedas');
    AQ.i18n.setLang('en', { silent: true });
    T.eq(AQ.i18n.tn('common.pearls', 2), '2 pearls');
    T.eq(AQ.i18n.t('ui.unit.cm', { n: '27.4' }), '27.4 cm');
    AQ.i18n.setLang('pt-BR', { silent: true });
  });
};
