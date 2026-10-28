// Menus and persistence: main menu, new game, save/load slots (with export/import), settings,
// help, records, pause and game over. Storage failures (private mode, quota) are non-fatal.
(function (UB) {
  'use strict';
  const M = {};
  const I = UB.I18N, tr = I.t;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const KEY = { slot: (n) => `ub.save.${n}`, settings: 'ub.settings', records: 'ub.records' };
  const SLOTS = ['auto', '1', '2', '3'];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  M.store = store;

  let stack = [];
  M.show = function (id, push) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
    if (push !== false) stack.push(id);
    $('tooltip').hidden = true;
  };
  M.hideAll = function () { for (const s of document.querySelectorAll('.screen')) s.classList.remove('show'); stack = []; };
  M.isOpen = () => !!document.querySelector('.screen.show');
  M.back = function () {
    stack.pop();
    const prev = stack[stack.length - 1];
    if (prev) M.show(prev, false);
    else if (UB.App.inGame) { M.hideAll(); UB.App.resumeFromMenu(); }
    else M.show('scrMain');
  };

  M.init = function () {
    for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { UB.Audio.play('click'); M.back(); };
    $('mNew').onclick = () => { openNew(); };
    $('mContinue').onclick = () => { if (load('auto')) M.hideAll(); };
    $('mLoad').onclick = () => openSlots('load');
    $('mHelp').onclick = () => M.show('scrHelp');
    $('mRecords').onclick = () => { renderRecords(); M.show('scrRecords'); };
    $('mSettings').onclick = () => { renderSettings(); M.show('scrSettings'); };
    $('pResume').onclick = () => { M.hideAll(); UB.App.resumeFromMenu(); };
    $('pSave').onclick = () => openSlots('save');
    $('pLoad').onclick = () => openSlots('load');
    $('pSettings').onclick = () => { renderSettings(); M.show('scrSettings'); };
    $('pHelp').onclick = () => M.show('scrHelp');
    $('pQuit').onclick = () => { UB.App.quitToMenu(); };
    $('oMenu').onclick = () => UB.App.quitToMenu();
    $('oSame').onclick = () => { const S = UB.App.S; M.hideAll(); UB.App.startNew(S.seed, S.difficulty); };
    $('oNew').onclick = () => openNew();
    $('nRandom').onclick = () => { $('nSeed').value = randomSeed(); };
    $('nStart').onclick = () => {
      M.hideAll();
      UB.App.startNew($('nSeed').value.trim() || randomSeed(), M.diff || 'normal');
    };
    $('importFile').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const obj = JSON.parse(r.result);
          const data = obj.data || r.result;
          UB.App.loadState(typeof data === 'string' ? data : JSON.stringify(data));
          M.hideAll();
        } catch (err) { UB.HUD.toast(tr('toast.badFile')); }
      };
      r.readAsText(f);
      e.target.value = '';
    };
    // Fullscreen (hidden where the browser cannot do it, e.g. iPhone Safari).
    const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
    for (const id of ['mFull', 'pFull']) { $(id).hidden = !fsOk; $(id).onclick = () => { UB.Audio.play('click'); M.toggleFullscreen(); }; }
    document.addEventListener('fullscreenchange', M.refreshFullscreen);
    document.addEventListener('webkitfullscreenchange', M.refreshFullscreen);
    $('mLang').innerHTML = I.LANGS.map((l) => `<button class="btn" data-lang="${l}" lang="${I.TAG[l]}" title="${I.NAMES[l]}">${l.toUpperCase()}</button>`).join('');
    $('mLang').onclick = (e) => { const b = e.target.closest('[data-lang]'); if (b) { UB.Audio.play('click'); M.setLang(b.dataset.lang); } };
    M.applyLang();
  };

  // Switches the language and redraws every text on screen (menus, HUD, generated lists).
  M.setLang = function (lang) {
    UB.App.settings.lang = I.set(lang);
    saveSettings();
    M.applyLang();
  };
  M.applyLang = function () {
    I.applyStatic();
    $('helpBody').innerHTML = tr('help.html');
    for (const b of document.querySelectorAll('[data-lang]')) b.classList.toggle('sel', b.dataset.lang === I.lang);
    M.refreshMain();
    M.refreshFullscreen();
    UB.Tutorial.refresh();
    if ($('scrSettings').classList.contains('show')) renderSettings();
    if ($('scrRecords').classList.contains('show')) renderRecords();
    UB.HUD.refresh();
  };

  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  M.toggleFullscreen = function () {
    const el = document.documentElement;
    try {
      if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* not allowed here */ }
  };
  M.refreshFullscreen = function () {
    const k = fsElement() ? 'menu.exitFullscreen' : 'menu.fullscreen';
    for (const id of ['mFull', 'pFull']) $(id).textContent = (fsElement() ? '⤡ ' : '⤢ ') + tr(k);
    setTimeout(() => UB.Render.resize(), 50);
  };

  M.refreshMain = function () { $('mContinue').hidden = !store.get(KEY.slot('auto')); };

  function randomSeed() {
    const words = tr('new.seedWords').split(',');
    return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  function openNew() {
    $('nSeed').value = randomSeed();
    M.diff = M.diff || 'normal';
    const seg = $('nDiff');
    const render = () => {
      seg.innerHTML = Object.keys(UB.DEF.DIFFICULTY).map((k) => `<button class="btn ${M.diff === k ? 'sel good' : ''}" data-d="${k}">${tr('diff.' + k)}</button>`).join('');
      $('nDiffDesc').textContent = tr('diffdesc.' + M.diff);
    };
    seg.onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) { M.diff = b.dataset.d; render(); } };
    render();
    M.show('scrNew');
  }

  // ---- save slots ---------------------------------------------------------------------------------------
  function meta(S) {
    return { day: S.day, nights: S.nights, score: UB.Game.score(S), seed: S.seed, difficulty: S.difficulty, survivors: S.units.length, date: new Date().toISOString() };
  }
  function save(slot) {
    const S = UB.App.S;
    if (!S || S.over) return false;
    const payload = JSON.stringify({ meta: meta(S), data: UB.Game.serialize(S) });
    const ok = store.set(KEY.slot(slot), payload);
    if (!ok) UB.HUD.toast(tr('toast.saveFailed'));
    M.refreshMain();
    return ok;
  }
  function load(slot) {
    const raw = store.get(KEY.slot(slot));
    if (!raw) { UB.HUD.toast(tr('toast.emptySlot')); return false; }
    try {
      const obj = JSON.parse(raw);
      UB.App.loadState(obj.data);
      return true;
    } catch (e) {
      UB.HUD.toast(tr('toast.badSave'));
      return false;
    }
  }
  M.autosave = function () { save('auto'); };
  M.quickSave = function () { if (save('1')) UB.HUD.toast(tr('toast.quickSaved')); };
  M.quickLoad = function () { if (load('1')) { M.hideAll(); UB.HUD.toast(tr('toast.quickLoaded')); } };

  function openSlots(mode) {
    $('slotTitle').textContent = tr(mode === 'save' ? 'slots.titleSave' : 'slots.titleLoad');
    const list = $('slotList');
    const render = () => {
      list.innerHTML = SLOTS.map((s) => {
        const raw = store.get(KEY.slot(s));
        let m = null;
        try { m = raw ? JSON.parse(raw).meta : null; } catch (e) { m = null; }
        const name = s === 'auto' ? tr('slots.auto') : tr('slots.slot', { n: s });
        const info = m ? `${tr('slots.info', { day: m.day, nights: m.nights, score: I.num(m.score), survivors: m.survivors })}<br><small>${tr('slots.meta', { seed: esc(m.seed), diff: m.difficulty, date: I.date(m.date) })}</small>` : `<small>${tr('slots.empty')}</small>`;
        const btns = [];
        if (mode === 'save' && s !== 'auto') btns.push(`<button class="btn good" data-s="save" data-slot="${s}">${tr('slots.saveHere')}</button>`);
        if (mode === 'load' && m) btns.push(`<button class="btn good" data-s="load" data-slot="${s}">${tr('slots.loadBtn')}</button>`);
        if (m) btns.push(`<button class="btn" data-s="export" data-slot="${s}" title="${esc(tr('slots.exportTitle'))}">${tr('slots.export')}</button>`, `<button class="btn bad" data-s="del" data-slot="${s}">${tr('slots.delete')}</button>`);
        return `<div class="slot"><div class="info"><b>${name}</b><span>${info}</span></div><div class="row">${btns.join('')}</div></div>`;
      }).join('');
    };
    list.onclick = (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      const slot = b.dataset.slot;
      UB.Audio.play('click');
      if (b.dataset.s === 'save') { if (save(slot)) UB.HUD.toast(tr('toast.savedSlot', { n: slot })); render(); }
      else if (b.dataset.s === 'load') { if (load(slot)) M.hideAll(); }
      else if (b.dataset.s === 'del') { if (b.dataset.confirm) { store.del(KEY.slot(slot)); M.refreshMain(); render(); } else { b.dataset.confirm = '1'; b.textContent = tr('slots.confirm'); } }
      else if (b.dataset.s === 'export') {
        const raw = store.get(KEY.slot(slot));
        const blob = new Blob([raw], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ultima-barricada-${slot}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    };
    render();
    M.show('scrSlots');
  }

  // ---- settings -------------------------------------------------------------------------------------------
  // lang: '' until the player picks one; the browser language decides meanwhile.
  const DEFAULTS = { master: 0.8, sfx: 0.8, amb: 0.5, shake: true, quality: 'high', ui: 1, edgeScroll: false, fps: false, paths: true, autopause: true, tips: true, lang: '', tutorialDone: false };
  M.loadSettings = function () {
    let s = {};
    try { s = JSON.parse(store.get(KEY.settings) || '{}'); } catch (e) { s = {}; }
    return Object.assign({}, DEFAULTS, s);
  };
  function saveSettings() { store.set(KEY.settings, JSON.stringify(UB.App.settings)); }
  M.setSetting = function (k, v) { UB.App.settings[k] = v; saveSettings(); };
  function renderSettings() {
    const s = UB.App.settings;
    const range = (k, label) => `<div class="set-row"><span>${label}</span><input type="range" min="0" max="1" step="0.05" data-k="${k}" value="${s[k]}"></div>`;
    const toggle = (k, label) => `<div class="set-row"><span>${label}</span><button class="btn ${s[k] ? 'good' : ''}" data-t="${k}">${tr(s[k] ? 'set.on' : 'set.off')}</button></div>`;
    const choice = (k, label, opts, cur) => `<div class="set-row"><span>${label}</span><span class="row">${opts.map(([v, n]) => `<button class="btn ${(cur !== undefined ? cur : s[k]) === v ? 'sel good' : ''}" data-c="${k}" data-v="${v}">${n}</button>`).join('')}</span></div>`;
    $('setList').innerHTML = choice('lang', tr('set.lang'), I.LANGS.map((l) => [l, I.NAMES[l]]), I.lang) +
      range('master', tr('set.master')) + range('sfx', tr('set.sfx')) + range('amb', tr('set.amb')) +
      choice('quality', tr('set.quality'), [['low', tr('set.low')], ['high', tr('set.high')]]) +
      choice('ui', tr('set.ui'), [[0.9, '90%'], [1, '100%'], [1.15, '115%'], [1.3, '130%']]) +
      toggle('tips', tr('set.tips')) + toggle('shake', tr('set.shake')) + toggle('paths', tr('set.paths')) + toggle('edgeScroll', tr('set.edge')) +
      toggle('autopause', tr('set.autopause')) + toggle('fps', tr('set.fps')) +
      `<div class="set-row"><span>${tr('set.tutorial')}</span><button class="btn" data-tut-again ${s.tutorialDone ? '' : 'disabled'}>${tr(s.tutorialDone ? 'set.tutorialAgain' : 'set.tutorialQueued')}</button></div>`;
    const list = $('setList');
    list.oninput = (e) => { const k = e.target.dataset.k; if (k) { s[k] = +e.target.value; UB.App.applySettings(); saveSettings(); } };
    list.onclick = (e) => {
      const t = e.target.closest('[data-t]'), c = e.target.closest('[data-c]');
      if (c && c.dataset.c === 'lang') { M.setLang(c.dataset.v); return; }
      if (e.target.closest('[data-tut-again]')) { M.setSetting('tutorialDone', false); UB.HUD.toast(tr('toast.tutorialQueued')); renderSettings(); return; }
      if (t) s[t.dataset.t] = !s[t.dataset.t];
      else if (c) s[c.dataset.c] = c.dataset.c === 'ui' ? +c.dataset.v : c.dataset.v;
      else return;
      UB.App.applySettings(); saveSettings(); renderSettings();
    };
  }

  // ---- records & game over ---------------------------------------------------------------------------------
  function records() { try { return JSON.parse(store.get(KEY.records) || '[]'); } catch (e) { return []; } }
  M.addRecord = function (S) {
    const list = records();
    list.push({ score: S.finalScore || UB.Game.score(S), nights: S.nights, seed: S.seed, difficulty: S.difficulty, kills: S.stats.kills, date: new Date().toISOString() });
    list.sort((a, b) => b.score - a.score);
    store.set(KEY.records, JSON.stringify(list.slice(0, 12)));
    return list.findIndex((r) => r.seed === S.seed && r.score === (S.finalScore || UB.Game.score(S)));
  };
  function renderRecords() {
    const list = records();
    $('recList').innerHTML = list.length ? list.map((r, i) => `<div class="rec"><span>${i + 1}. ${tr('rec.row', { score: `<b>${I.num(r.score)}</b>`, nights: r.nights })}</span><span class="muted small">“${esc(r.seed)}” · ${tr('diff.' + r.difficulty)}</span></div>`).join('') : `<p class="muted">${tr('rec.none')}</p>`;
  }
  M.gameOver = function (S) {
    if (!S.finalScore) S.finalScore = UB.Game.score(S);
    const rank = M.addRecord(S);
    store.del(KEY.slot('auto'));
    M.refreshMain();
    $('overTitle').textContent = tr(S.over === 'hq' ? 'over.hq' : 'over.dead');
    const st = S.stats;
    // Causes are {k, p}; saves from before the translation stored plain text.
    const cause = (c) => (c && c.k ? tr(c.k, c.p) : String(c || ''));
    const mem = S.memorial.length ? `<h3>${tr('over.memorial')}</h3><ul class="memorial">${S.memorial.map((m) => `<li><b>${esc(m.name)}</b> — ${esc(tr('over.memEntry', { role: m.role, day: m.day, cause: cause(m.cause) }))}</li>`).join('')}</ul>` : '';
    const stat = (n, k) => `<div><b>${I.num(n)}</b>${tr(k)}</div>`;
    $('overBody').innerHTML = `<p class="muted">Seed “${esc(S.seed)}” · ${tr('diff.' + S.difficulty)}${rank === 0 ? ` · <span class="good-t">${tr('over.record')}</span>` : ''}</p>
      <div class="stat-grid">
        ${stat(S.finalScore, 'over.points')}${stat(S.nights, 'over.nights')}${stat(st.kills, 'over.kills')}
        ${stat(st.loots, 'over.loots')}${stat(st.built, 'over.built')}${stat(st.recruits, 'over.recruits')}
        ${stat(st.nests || 0, 'over.nests')}${stat(st.deaths, 'over.deaths')}${stat(UB.Objectives.count(S), 'over.objectives')}
      </div>${mem}`;
    M.show('scrOver');
  };

  UB.Menus = M;
})(globalThis.UB = globalThis.UB || {});
