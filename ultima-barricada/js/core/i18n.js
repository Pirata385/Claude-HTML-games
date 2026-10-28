// Translations. Dictionaries (js/i18n/*.js) map keys to text; the simulation only stores keys
// and parameters, and the interface formats them in the current language when shown.
// Placeholders: {x} inserts a value; {x|type} translates an id (or a list of ids), e.g.
// {b|bld} -> building name; a trailing |l lowercases: {r|res|l}.
(function (UB) {
  'use strict';
  const DICT = {};
  // Available languages: code, locale tag (numbers, dates) and native name (language pickers).
  const I = { lang: 'pt', LANGS: ['pt', 'en'], TAG: { pt: 'pt-BR', en: 'en-US' }, NAMES: { pt: 'Português', en: 'English' } };

  I.add = function (lang, d) { DICT[lang] = Object.assign(DICT[lang] || {}, d); };
  I.dict = (lang) => DICT[lang] || {};
  // The browser's main language if we have it (pt-BR, pt-PT -> pt), otherwise English.
  I.detect = function (langs) {
    const code = String((langs && langs[0]) || '').slice(0, 2).toLowerCase();
    return I.LANGS.includes(code) ? code : 'en';
  };
  I.set = function (lang) { if (DICT[lang]) I.lang = lang; return I.lang; };

  function raw(key) {
    const d = DICT[I.lang];
    if (d && Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    const p = DICT.pt;
    if (p && Object.prototype.hasOwnProperty.call(p, key)) return p[key];
    return undefined;
  }
  I.has = (key) => raw(key) !== undefined;
  const lower = (s) => String(s).toLocaleLowerCase(I.TAG[I.lang]);

  function list(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + I.t('ui.and') + arr[arr.length - 1];
  }
  // Loot/reward entries: {res, n} | {bp} | {weapon}.
  function item(it) {
    if (it.res) return `+${it.n} ${lower(I.t('res.' + it.res))}`;
    if (it.bp) return I.t('bp.' + it.bp);
    if (it.weapon) return I.t('loot.' + it.weapon);
    return '';
  }
  // Unknown ids (e.g. side names stored as text by older saves) are shown as they are.
  const named = (k, v) => (I.has(k) ? I.t(k) : String(v));
  const TYPES = {
    bld: (v) => named(`bld.${v}.name`, v),
    poi: (v) => named(`poi.${v}.name`, v),
    zom: (v) => named(`zom.${v}.name`, v),
    role: (v) => named(`role.${v}.name`, v),
    res: (v) => named(`res.${v}`, v),
    weapon: (v) => named(`weapon.${v}`, v),
    bp: (v) => named(`bp.${v}`, v),
    rank: (v) => named(`rank.${v}`, v),
    side: (v) => named(`side.${v}`, v),
    weather: (v) => named(`weather.${v}`, v),
    diff: (v) => named(`diff.${v}`, v),
    feat: (v) => named(`feat.${v}`, v),
    ter: (v) => named(`ter.${v}`, v),
    obj: (v) => named(`obj.${v}`, v),
    key: (v) => (v && typeof v === 'object' ? I.t(v.k, v.p) : I.t(v)),
    n: (v) => I.num(v),
  };
  const LISTS = {
    items: (arr) => list(arr.map(item)),
    cost: (arr) => list(arr.map((c) => `${c.n} ${lower(I.t('res.' + c.res))}`)),
  };

  function fmt(s, p) {
    return s.replace(/\{(\w+)(?:\|(\w+))?(?:\|(l))?\}/g, (m, k, type, mod) => {
      const v = p ? p[k] : undefined;
      if (v === undefined || v === null) return '';
      let out;
      if (type && LISTS[type]) out = LISTS[type](v);
      else if (type && TYPES[type]) out = Array.isArray(v) ? list(v.map(TYPES[type])) : TYPES[type](v);
      else out = String(v);
      return mod === 'l' ? lower(out) : out;
    });
  }

  I.t = function (key, p) {
    const s = raw(key);
    if (s === undefined) return key;
    return typeof s === 'function' ? s(p || {}, I) : fmt(s, p);
  };
  I.name = (cat, id) => I.t(`${cat}.${id}.name`);
  I.desc = (cat, id) => I.t(`${cat}.${id}.desc`);
  I.items = (arr) => list(arr.map(item));
  I.list = list;
  I.lower = lower;
  I.num = (n) => Number(n).toLocaleString(I.TAG[I.lang]);
  I.date = (d) => new Date(d).toLocaleString(I.TAG[I.lang]);
  // Messages from the simulation ({k, p}); older saves stored plain text.
  I.msg = (m) => (m && m.k ? I.t(m.k, m.p) : (m && m.text) || '');
  // Reasons returned by commands: a key with optional parameters.
  I.reason = (r) => (r && r.reason ? I.t(r.reason, r.rp) : '');

  // Static HTML: data-i18n (text), data-i18n-html, data-i18n-title, data-i18n-aria.
  I.applyStatic = function (root) {
    const doc = root || document;
    for (const el of doc.querySelectorAll('[data-i18n]')) el.textContent = I.t(el.dataset.i18n);
    for (const el of doc.querySelectorAll('[data-i18n-html]')) el.innerHTML = I.t(el.dataset.i18nHtml);
    for (const el of doc.querySelectorAll('[data-i18n-title]')) el.title = I.t(el.dataset.i18nTitle);
    for (const el of doc.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', I.t(el.dataset.i18nAria));
    if (!root) {
      document.documentElement.lang = I.TAG[I.lang];
      document.title = I.t('menu.docTitle');
    }
  };

  UB.I18N = I;
  UB.t = I.t;
})(globalThis.UB = globalThis.UB || {});
