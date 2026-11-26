// Água-Tinta — i18n (owner A). Pure. The game is English only: 'en' is the default and the fallback language.
// Change the language through AQ.settings.set('lang', ...) so it persists; that calls setLang().
(function (AQ) {
  'use strict';

  var LANGS = ['en'];
  var FALLBACK = 'en';
  var dicts = { en: Object.create(null) };
  var pluralCache = {};
  var dateCache = {};

  // add(lang, dict): dict may be flat ('a.b': 'x') or nested ({a: {b: 'x'}}); nested keys are joined with '.'.
  function add(lang, dict, prefix) {
    if (!dicts[lang]) dicts[lang] = Object.create(null);
    var d = dicts[lang], p = prefix ? prefix + '.' : '';
    for (var k in dict) {
      if (!Object.prototype.hasOwnProperty.call(dict, k)) continue;
      var v = dict[k];
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) add(lang, v, p + k);
      else d[p + k] = v;
    }
    return i18n;
  }

  function interpolate(s, vars) {
    if (!vars || typeof s !== 'string' || s.indexOf('{') < 0) return s;
    return s.replace(/\{([A-Za-z0-9_]+)\}/g, function (m, name) {
      return vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : m;
    });
  }

  // Missing key → fallback ('en') → '[key]'.
  function t(key, vars) {
    var s = dicts[i18n.lang] ? dicts[i18n.lang][key] : undefined;
    if (s === undefined) s = dicts[FALLBACK][key];
    if (s === undefined) return '[' + key + ']';
    return interpolate(String(s), vars);
  }

  function pluralCategory(n, lang) {
    try {
      if (typeof Intl !== 'undefined' && Intl.PluralRules) {
        var pr = pluralCache[lang] || (pluralCache[lang] = new Intl.PluralRules(lang));
        return pr.select(n);
      }
    } catch (e) { /* fall through */ }
    return Math.abs(n) === 1 ? 'one' : 'other';
  }

  // tn(key, n, vars): uses key.zero (n === 0, if present), key.one / key.other (Intl.PluralRules); vars.n = num(n).
  function tn(key, n, vars) {
    var v = {};
    if (vars) for (var k in vars) v[k] = vars[k];
    v.n = num(n, Math.round(n) === n ? 0 : 1);
    if (n === 0 && has(key + '.zero')) return t(key + '.zero', v);
    var cat = pluralCategory(n, i18n.lang);
    var full = key + '.' + cat;
    if (has(full)) return t(full, v);
    if (has(key + '.other')) return t(key + '.other', v);
    if (has(key + '.one')) return t(key + '.one', v);
    return t(key, v);
  }

  // has(key) → defined in the current language or the fallback; has(key, lang) → defined in that language only.
  function has(key, lang) {
    if (lang) return !!(dicts[lang] && dicts[lang][key] !== undefined);
    return (dicts[i18n.lang] && dicts[i18n.lang][key] !== undefined) || dicts[FALLBACK][key] !== undefined;
  }
  function keys(lang) { return Object.keys(dicts[lang || i18n.lang] || {}).sort(); }

  function setLang(lang, opts) {
    if (LANGS.indexOf(lang) < 0) return false;
    var prev = i18n.lang;
    i18n.lang = lang;
    if (prev !== lang && !(opts && opts.silent) && AQ.events) AQ.events.emit('lang:changed', { lang: lang });
    return true;
  }

  function seps() { return i18n.lang === 'en' ? [',', '.'] : ['.', ',']; } // [thousands, decimal]

  // num(1250.5, 1) → '1.250,5' (pt-BR) / '1,250.5' (en). Deterministic, no ICU dependency.
  function num(n, decimals) {
    var d = decimals === undefined ? 0 : decimals;
    n = Number(n);
    if (!isFinite(n)) return n > 0 ? '∞' : n < 0 ? '-∞' : '-';
    var s = Math.abs(n).toFixed(d), neg = n < 0 && Number(s) !== 0;
    var parts = s.split('.'), ip = parts[0], out = '';
    var sp = seps();
    for (var i = 0; i < ip.length; i++) {
      if (i > 0 && (ip.length - i) % 3 === 0) out += sp[0];
      out += ip[i];
    }
    if (parts[1]) out += sp[1] + parts[1];
    return (neg ? '-' : '') + out;
  }
  function money(n) { return '$ ' + num(Math.round(Number(n) || 0)); }
  function pearls(n) { return '@ ' + num(Math.round(Number(n) || 0)); }
  // pct(x): x is a fraction 0..1 → '78%'.
  function pct(x) { return num(Math.round((Number(x) || 0) * 100)) + '%'; }
  function pad2(v) { return v < 10 ? '0' + v : '' + v; }
  function date(ts) {
    var lang = i18n.lang;
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        var f = dateCache[lang] || (dateCache[lang] = new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }));
        return f.format(new Date(ts));
      }
    } catch (e) { /* fall through */ }
    var dt = new Date(ts);
    return lang === 'en'
      ? pad2(dt.getMonth() + 1) + '/' + pad2(dt.getDate()) + '/' + dt.getFullYear()
      : pad2(dt.getDate()) + '/' + pad2(dt.getMonth() + 1) + '/' + dt.getFullYear();
  }

  var i18n = AQ.i18n = {
    LANGS: LANGS,
    FALLBACK: FALLBACK,
    lang: FALLBACK,
    add: add, t: t, tn: tn, has: has, keys: keys, setLang: setLang,
    num: num, money: money, pearls: pearls, pct: pct, date: date,
    _dicts: dicts
  };
})(window.AQ);
