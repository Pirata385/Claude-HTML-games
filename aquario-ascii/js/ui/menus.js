// Água-Tinta — menus (owner E): title menu, pause, settings, save export/import, credits, and the app glue
// (new game / continue, Esc → pause, save:reset → title, quality and invalid-save toasts, offline queue).
(function (AQ) {
  'use strict';

  var ui = AQ.ui = AQ.ui || {};
  var D = ui.dom, t = D.t, el = D.el;
  var GAMES_MENU = '../index.html';
  var startingNewGame = false;
  var pausedByMenu = false;

  function S() { return AQ.settings; }
  function setS(k, v) { return S().set(k, v); }
  function hubScene() { var c = AQ.scenes && AQ.scenes.current; return c === 'map' || c === 'aquarium' || c === 'fishing'; }

  // ================================================================ title
  ui.titleLayout = { menuTop: null, menuLeft: null, menuWidth: null, side: false };
  ui.layoutTitle = function () {
    var inst = document.querySelector('.aq-title-menu');
    if (!inst) return;
    var L = ui.titleLayout;
    inst.style.top = L.menuTop !== null ? Math.round(L.menuTop) + 'px' : '';
    inst.style.left = L.menuLeft !== null ? Math.round(L.menuLeft) + 'px' : '';
    inst.style.width = L.menuWidth !== null ? Math.round(L.menuWidth) + 'px' : '';
    inst.classList.toggle('is-side', !!L.side);
  };

  ui.register('title', {
    modal: false,
    layer: 'base',
    closable: false,
    cls: 'is-title',
    build: function () {
      var wrap = el('div.aq-title');
      var menu = el('div.aq-title-menu');
      var hasSave = D.safe(function () { return AQ.store.hasSave() && AQ.store.existed !== false; }, false);
      if (hasSave) menu.appendChild(D.btn(t('ui.title.continue'), continueGame, { cls: 'aq-title-b', fid: 'continue', def: true, sfx: 'uiOpen' }));
      menu.appendChild(D.btn(t('ui.title.newGame'), newGame, { cls: 'aq-title-b', fid: 'new', def: !hasSave, sfx: 'uiOpen' }));
      menu.appendChild(D.btn(t('ui.title.settings'), function () { ui.show('settings'); }, { cls: 'aq-title-b', fid: 'settings' }));
      if (fsSupported()) menu.appendChild(D.btn(t(fsActive() ? 'ui.title.fullscreenExit' : 'ui.title.fullscreen'), function () { toggleFullscreen(null); }, { cls: 'aq-title-b', fid: 'fullscreen' }));
      menu.appendChild(D.btn(t('ui.title.credits'), function () { ui.show('credits'); }, { cls: 'aq-title-b', fid: 'credits' }));
      wrap.appendChild(menu);
      var back = el('a.aq-btn.aq-link', { href: GAMES_MENU, 'data-fid': 'games' }, [el('span.aq-back-arrow', { text: '<', 'aria-hidden': 'true' }), el('span.aq-btn-l', { text: t('ui.title.gamesMenu') })]);
      back.addEventListener('click', function () { D.safe(function () { AQ.store.flush('menu'); }); });
      var foot = el('div.aq-title-foot', null, [back, el('span.aq-fill'), el('span.aq-version', { text: t('ui.title.version', { v: AQ.VERSION }) })]);
      wrap.appendChild(foot);
      setTimeout(ui.layoutTitle, 0);
      return wrap;
    }
  });

  function newGame() {
    var go = function () {
      startingNewGame = true;
      try {
        D.safe(function () { AQ.game.newGame(); });
        if (!AQ.state.meta || !AQ.state.meta.created) D.safe(function () { AQ.store.replaceState(AQ.store.fresh()); });
      } finally { startingNewGame = false; }
      if (AQ.tutorial && AQ.tutorial.start) D.safe(function () { AQ.tutorial.start(); });
      D.safe(function () { AQ.store.save('newgame'); });
      ui.hide('title');
      AQ.scenes.go('fishing', { zone: 'baia', tutorial: !!(AQ.tutorial && AQ.tutorial.active) });
    };
    var has = D.safe(function () { return AQ.store.hasSave() && AQ.store.existed !== false && (AQ.state.meta.playSec > 0 || AQ.state.stats.catches > 0); }, false);
    if (!has) { go(); return; }
    ui.confirm({ titleKey: 'ui.title.confirmNewTitle', bodyKey: 'ui.title.confirmNewBody', okKey: 'ui.title.confirmNewOk', danger: true })
      .then(function (ok) { if (ok) go(); });
  }
  function continueGame() {
    ui.hide('title');
    var tut = AQ.state.tutorial || {};
    if (!tut.done && (tut.step || 0) < 8 && AQ.settings.get('hints') !== false) {
      if (AQ.tutorial && AQ.tutorial.resume) D.safe(function () { AQ.tutorial.resume(); });
      AQ.scenes.go('fishing', { zone: 'baia', tutorial: true });
      return;
    }
    AQ.scenes.go('map');
  }
  ui.newGame = newGame;
  ui.continueGame = continueGame;

  // ================================================================ pause
  ui.register('pause', {
    modal: true,
    layer: 'modal',
    cls: 'is-pause',
    build: function (inst) {
      var p = D.panel({ title: t('ui.pause.title'), onClose: function () { inst.close(null); }, cls: 'aq-narrow aq-pause' });
      var list = el('div.aq-stack');
      list.appendChild(D.btn(t('ui.pause.continue'), function () { inst.close(null); }, { fid: 'cont', def: true, cls: 'aq-wide' }));
      list.appendChild(D.btn(t('ui.pause.settings'), function () { ui.show('settings'); }, { fid: 'settings', cls: 'aq-wide' }));
      list.appendChild(D.btn(t('ui.pause.bestiary'), function () { ui.show('bestiary'); }, { fid: 'bestiary', cls: 'aq-wide' }));
      if (AQ.scenes.current !== 'map') {
        list.appendChild(D.btn(t('ui.pause.map'), function () {
          inst.close('map');
          ui.hideTransient();
          AQ.scenes.go('map');
        }, { fid: 'map', cls: 'aq-wide' }));
      }
      list.appendChild(D.btn(t('ui.pause.title2'), function () {
        inst.close('title');
        D.safe(function () { AQ.store.save('title'); });
        ui.hideTransient();
        AQ.scenes.go('title');
      }, { fid: 'title', cls: 'aq-wide' }));
      var a = el('a.aq-btn.aq-wide.aq-link', { href: GAMES_MENU, 'data-fid': 'games' }, el('span.aq-btn-l', { text: t('ui.pause.gamesMenu') }));
      a.addEventListener('click', function () { D.safe(function () { AQ.store.save('menu'); }); });
      list.appendChild(a);
      p.body.appendChild(list);
      return p.el;
    },
    onOpen: function () {
      if (AQ.scenes && !AQ.scenes.paused && hubScene()) { pausedByMenu = true; AQ.scenes.pause(); pausedByMenu = false; }
      if (AQ.audio && AQ.audio.duck) AQ.audio.duck(true);
    },
    onClose: function () {
      if (AQ.scenes && AQ.scenes.paused) { pausedByMenu = true; AQ.scenes.resume(); }
      pausedByMenu = false;
      if (AQ.audio && AQ.audio.duck) AQ.audio.duck(false);
    }
  });
  ui.openPause = function () {
    if (!hubScene() || ui.isOpen('pause')) return;
    ui.show('pause');
  };

  // Hide transient overlays (cards/pickers) before a scene change.
  ui.hideTransient = function () {
    ['zoneCard', 'baitPicker', 'decorPicker', 'tankPicker', 'fishCard', 'shop', 'bestiary', 'goals'].forEach(function (n) { ui.hide(n); });
    if (ui.hud && ui.hud.contemplate) ui.hud.contemplate(false);
  };

  // ================================================================ settings
  function row(label, control, opts) {
    var o = opts || {};
    var r = el('div.aq-row', { cls: o.cls });
    r.appendChild(el('div.aq-row-l', { text: label }));
    r.appendChild(el('div.aq-row-c', null, control));
    return r;
  }
  function section(title) { return el('h3.aq-sec', { text: title }); }
  function fsSupported() { return !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen); }
  function fsActive() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen(inst) {
    var de = document.documentElement;
    var p;
    try {
      if (fsActive()) p = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else p = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' });
    } catch (e) { p = Promise.reject(e); }
    Promise.resolve(p).then(function () { if (inst) setTimeout(function () { inst.rerender(); }, 120); },
      function () { ui.toast({ key: 'ui.toast.fullscreenFail' }, { kind: 'warn' }); });
  }

  ui.register('settings', {
    modal: true,
    cls: 'is-settings',
    build: function (inst) {
      var p = D.panel({ title: t('settings.title'), onClose: function () { inst.close(null); }, cls: 'aq-settings' });
      var b = p.body;
      var g = function (k) { return S().get(k); };
      var re = function () { inst.rerender(); };
      var pick = function (k) { return function (v) { setS(k, v); re(); }; };

      b.appendChild(section(t('settings.sec.sound')));
      ['volMaster', 'volMusic', 'volSfx', 'volAmbience'].forEach(function (k) {
        b.appendChild(row(t('settings.' + k), D.slider(t('settings.' + k), g(k), function (v) { setS(k, v); }, { fid: k })));
      });
      b.appendChild(row(t('settings.audioEngine'), D.seg(['auto', 'webaudio', 'compat'].map(function (v) { return { value: v, label: t('settings.ae.' + v) }; }),
        g('audioEngine'), function (v) {
          if (v === g('audioEngine')) return;
          setS('audioEngine', v);
          D.safe(function () { AQ.store.flush('audio-engine'); });
          setTimeout(function () { location.reload(); }, 150);   // the engine is chosen at load
        }, { fid: 'audioEngine' })));
      b.appendChild(el('p.aq-dim', { text: t('settings.aeHint') }));

      b.appendChild(section(t('settings.sec.video')));
      b.appendChild(row(t('settings.quality'), D.seg(['auto', 'high', 'medium', 'low'].map(function (v) { return { value: v, label: t('settings.q.' + v) }; }),
        g('quality'), pick('quality'), { fid: 'quality' })));
      b.appendChild(row(t('settings.motionStyle'), D.seg(['fluid', 'grid'].map(function (v) { return { value: v, label: t('settings.ms.' + v) }; }),
        g('motionStyle'), pick('motionStyle'), { fid: 'motionStyle' })));
      b.appendChild(row(t('settings.reducedMotion'), D.seg(['auto', 'on', 'off'].map(function (v) { return { value: v, label: t('settings.rm.' + v) }; }),
        g('reducedMotion'), pick('reducedMotion'), { fid: 'rm' })));
      b.appendChild(row(t('settings.glyphSize'), D.seg(['auto', 11, 12, 14, 16, 18, 20].map(function (v) { return { value: v, label: v === 'auto' ? t('common.auto') : String(v) }; }),
        g('glyphSize'), pick('glyphSize'), { fid: 'glyph' }), { cls: 'is-wrap' }));
      b.appendChild(row(t('settings.uiScale'), D.seg([0.85, 1, 1.15, 1.3].map(function (v) { return { value: v, label: AQ.i18n.pct(v) }; }),
        g('uiScale'), pick('uiScale'), { fid: 'uiScale' })));
      var paper = !!(AQ.state.player && AQ.state.player.unlocks && AQ.state.player.unlocks.paperTheme);
      b.appendChild(row(t('settings.theme'), D.seg(AQ.ENUM.THEMES.map(function (v) {
        if (v === 'papel') return { value: v, label: paper ? t('settings.th.papel') : t('settings.th.papelLocked'), disabled: !paper };
        return { value: v, label: t('settings.th.' + v) };
      }), g('theme'), pick('theme'), { fid: 'theme' }), { cls: 'is-wrap' }));
      var toggles1 = el('div.aq-toggles', null, [
        D.toggle(t('settings.highContrast'), g('highContrast'), function (v) { setS('highContrast', v); re(); }, { fid: 'hc' }),
        D.toggle(t('settings.showFps'), g('showFps'), function (v) { setS('showFps', v); re(); }, { fid: 'fps' })
      ]);
      b.appendChild(row('', toggles1, { cls: 'is-toggles' }));

      b.appendChild(section(t('settings.sec.controls')));
      b.appendChild(row(t('settings.handedness'), D.seg(['right', 'left'].map(function (v) { return { value: v, label: t('settings.hand.' + v) }; }),
        g('handedness'), pick('handedness'), { fid: 'hand' })));
      var vib = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
      var toggles2 = el('div.aq-toggles', null, [
        D.toggle(t('settings.haptics') + (vib ? '' : ' ' + t('settings.na')), g('haptics'), function (v) { setS('haptics', v); re(); }, { fid: 'haptics' }),
        D.toggle(t('settings.hints'), g('hints'), function (v) { setS('hints', v); re(); }, { fid: 'hints' })
      ]);
      b.appendChild(row('', toggles2, { cls: 'is-toggles' }));
      var toggles3 = el('div.aq-toggles', null, [
        D.toggle(t('settings.autoSteer'), g('autoSteer'), function (v) { setS('autoSteer', v); re(); }, { fid: 'autoSteer' }),
        D.toggle(t('settings.wideWindows'), g('wideWindows'), function (v) { setS('wideWindows', v); re(); }, { fid: 'wide' })
      ]);
      b.appendChild(row(t('settings.assists'), toggles3, { cls: 'is-toggles' }));

      b.appendChild(section(t('settings.sec.game')));
      if (fsSupported()) {
        b.appendChild(row(t('settings.fullscreen'), D.btn(fsActive() ? t('settings.fsExit') : t('settings.fsEnter'), function () { toggleFullscreen(inst); }, { fid: 'fs' })));
      }
      var tut = AQ.state.tutorial || {};
      var tutDone = tut.done || !(AQ.tutorial && AQ.tutorial.active);
      b.appendChild(row(t('settings.tutorial'), tutDone ? el('span.aq-dim', { text: t('settings.tutorialDone') }) :
        D.btn(t('settings.tutorialSkip'), function () { if (AQ.tutorial) AQ.tutorial.skip(); re(); }, { fid: 'tut' })));
      var saveBtns = el('div.aq-btnrow', null, [
        D.btn(t('settings.export'), function () { ui.show('saveIO', { tab: 'export' }); }, { fid: 'exp' }),
        D.btn(t('settings.import'), function () { ui.show('saveIO', { tab: 'import' }); }, { fid: 'imp' }),
        D.btn(t('settings.reset'), resetSave, { fid: 'reset', cls: 'is-danger' })
      ]);
      b.appendChild(row(t('settings.save'), saveBtns, { cls: 'is-wrap' }));
      return p.el;
    }
  });

  function resetSave() {
    ui.confirm({ titleKey: 'ui.confirm.resetTitle', bodyKey: 'ui.confirm.resetBody', okKey: 'ui.confirm.resetOk', danger: true })
      .then(function (ok) {
        if (!ok) return false;
        return ui.confirm({ titleKey: 'ui.confirm.reset2Title', bodyKey: 'ui.confirm.reset2Body', okKey: 'ui.confirm.reset2Ok', danger: true, delayMs: 1500 });
      })
      .then(function (ok) {
        if (!ok) return;
        D.safe(function () { AQ.store.reset(); });
        ui.toast({ key: 'ui.toast.reset' });
      });
  }

  // ================================================================ save export / import
  ui.register('saveIO', {
    modal: true,
    cls: 'is-saveio',
    build: function (inst) {
      var tab = inst.state.tab || inst.params.tab || 'export';
      inst.state.tab = tab;
      var p = D.panel({ title: t('ui.saveio.title'), onClose: function () { inst.close(null); }, cls: 'aq-saveio' });
      var tabs = el('div.aq-tabs', { role: 'tablist' });
      ['export', 'import'].forEach(function (k) {
        var b = el('button.aq-tab', { type: 'button', role: 'tab', 'aria-selected': k === tab ? 'true' : 'false', 'data-fid': 'tab:' + k }, el('span', { text: t('ui.saveio.' + k + 'Tab') }));
        if (k === tab) b.classList.add('is-on');
        b.addEventListener('click', function () { D.feedback('uiTap'); inst.state.tab = k; inst.state.err = null; inst.rerender(); });
        tabs.appendChild(b);
      });
      p.body.appendChild(tabs);
      if (tab === 'export') {
        var str = D.safe(function () { return AQ.store.exportString(); }, '');
        p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.saveio.exportLabel') }));
        var ta = el('textarea.aq-textarea', { readonly: true, spellcheck: 'false', rows: '6', 'aria-label': t('ui.saveio.exportLabel') });
        ta.value = str;
        ta.addEventListener('focus', function () { ta.select(); });
        p.body.appendChild(ta);
        p.foot.appendChild(D.btn(t('ui.saveio.download'), function () { download(str); }, { fid: 'dl' }));
        p.foot.appendChild(D.btn(t('ui.saveio.copy'), function () { copy(str, ta); }, { fid: 'copy', def: true }));
      } else {
        p.body.appendChild(el('p.aq-p.aq-dim', { text: t('ui.saveio.importLabel') }));
        var ti = el('textarea.aq-textarea', { spellcheck: 'false', rows: '6', 'aria-label': t('ui.saveio.importLabel'), 'data-fid': 'ta' });
        ti.value = inst.state.text || '';
        ti.addEventListener('input', function () { inst.state.text = ti.value; });
        p.body.appendChild(ti);
        if (inst.state.err) p.body.appendChild(el('p.aq-err', { role: 'alert', text: t('ui.saveio.err.' + inst.state.err) }));
        var file = el('input.aq-file', { type: 'file', accept: '.txt,text/plain', 'aria-hidden': 'true', tabindex: '-1' });
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          var rd = new FileReader();
          rd.onload = function () { inst.state.text = String(rd.result || ''); inst.state.err = null; inst.rerender(); };
          rd.readAsText(f);
        });
        p.body.appendChild(file);
        p.foot.appendChild(D.btn(t('ui.saveio.file'), function () { file.click(); }, { fid: 'file' }));
        p.foot.appendChild(D.btn(t('ui.saveio.import'), function () { doImport(inst); }, { fid: 'import', def: true }));
      }
      return p.el;
    }
  });
  function download(str) {
    try {
      var blob = new Blob([str], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      var d = new Date();
      a.download = 'agua-tinta-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.txt';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { ui.toast({ key: 'ui.toast.copyFail' }, { kind: 'warn' }); }
  }
  function copy(str, ta) {
    var done = function () { ui.toast({ key: 'ui.toast.copied' }, { kind: 'good' }); };
    var fail = function () {
      try { ta.focus(); ta.select(); if (document.execCommand('copy')) { done(); return; } } catch (e) { /* ignore */ }
      ui.toast({ key: 'ui.toast.copyFail' }, { kind: 'warn' });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(str).then(done, fail);
    else fail();
  }
  function doImport(inst) {
    var text = (inst.state.text || '').trim();
    if (!/^AT1:/.test(text.replace(/\s+/g, ''))) { inst.state.err = 'format'; inst.rerender(); if (AQ.audio) AQ.audio.sfx('error'); return; }
    ui.confirm({ titleKey: 'ui.saveio.confirmTitle', bodyKey: 'ui.saveio.confirmBody', danger: true }).then(function (ok) {
      if (!ok) return;
      var r = D.safe(function () { return AQ.store.importString(text); }, { ok: false, error: 'format' });
      if (!r.ok) { inst.state.err = r.error || 'format'; inst.rerender(); if (AQ.audio) AQ.audio.sfx('error'); return; }
      ui.toast({ key: 'ui.toast.imported' }, { kind: 'good' });
      ui.hide('saveIO');
      ui.hide('settings');
      ui.hide('pause');
      ui.hideTransient();
      if (AQ.theme) D.safe(function () { AQ.theme.apply(); });
      AQ.scenes.go('title');
    });
  }

  // ================================================================ credits
  ui.register('credits', {
    modal: true,
    cls: 'is-credits',
    build: function (inst) {
      var p = D.panel({ title: t('ui.credits.title'), onClose: function () { inst.close(null); }, cls: 'aq-narrow aq-credits' });
      var b = p.body;
      b.appendChild(el('p.aq-credits-title', { text: t('ui.title.name') }));
      b.appendChild(el('p.aq-dim.aq-center', { text: t('ui.title.subtitle') }));
      b.appendChild(el('p.aq-center', { text: t('credits.l1') }));
      ['2', '3', '4', '5', '6'].forEach(function (n) {
        b.appendChild(el('p.aq-credits-h', { text: t('credits.h' + n) }));
        b.appendChild(el('p.aq-center', { text: t('credits.l' + n) }));
      });
      b.appendChild(el('p.aq-credits-end', { text: '~ ' + t('credits.end') + ' ~' }));
      p.foot.appendChild(D.btn(t('common.close'), function () { inst.close(null); }, { def: true, sfx: 'uiBack' }));
      return p.el;
    }
  });

  // ================================================================ app glue
  var offlineQueue = [];
  function flushOffline() {
    var c = AQ.scenes && AQ.scenes.current;
    if (c !== 'map' && c !== 'aquarium') return;
    if (ui.isModal()) { setTimeout(flushOffline, 1200); return; }
    var p = offlineQueue.shift();
    if (p) ui.show('offline', p);
  }

  ui._onPauseEmpty = function () {
    if (ui.hud && ui.hud.current === 'aquarium' && document.querySelector('.aq-ui.is-contemplate')) { ui.hud.contemplate(false); return; }
    ui.openPause();
  };
  ui._onBackEmpty = function () {
    if (document.querySelector('.aq-ui.is-contemplate')) ui.hud.contemplate(false);
  };

  ui.onInit(function () {
    var E = AQ.events;
    E.on('scene:changed', function (p) {
      if (p.to === 'title') { ui.hideTransient(); ui.hide('pause'); if (!ui.isOpen('title')) ui.show('title'); }
      else if (ui.isOpen('title')) ui.hide('title');
      if (p.to === 'map' || p.to === 'aquarium') setTimeout(flushOffline, 600);
    });
    E.on('pause:changed', function (p) {
      if (pausedByMenu) return;
      if (p.paused && !ui.isOpen('pause') && hubScene()) ui.show('pause');
      else if (!p.paused && ui.isOpen('pause')) ui.hide('pause');
    });
    E.on('save:reset', function () {
      if (startingNewGame) return;
      ui.hideTransient();
      ['saveIO', 'settings', 'pause'].forEach(function (n) { ui.hide(n); });
      if (AQ.tutorial) AQ.tutorial.active = false;
      if (AQ.theme) D.safe(function () { AQ.theme.apply(); });
      if (AQ.scenes.current === 'title') ui.show('title');
      else AQ.scenes.go('title');
    });
    E.on('save:invalid', function () { setTimeout(function () { ui.toast({ key: 'ui.toast.saveInvalid' }, { kind: 'warn', ms: 5000 }); }, 600); });
    E.on('app:ready', function () {
      if (AQ.store && AQ.store.loadError) setTimeout(function () { ui.toast({ key: 'ui.toast.saveInvalid' }, { kind: 'warn', ms: 5000 }); }, 900);
    });
    E.on('quality:changed', function (p) {
      if (p && p.auto) ui.toast({ key: 'ui.toast.quality', vars: { preset: t('settings.q.' + p.preset) } });
    });
    E.on('offline:summary', function (p) {
      if (!p) return;
      offlineQueue.length = 0;
      offlineQueue.push(p);
      flushOffline();
    });
    E.on('ending:start', function () {
      ui.hideTransient();
      ui.hide('catchCard');
      setTimeout(function () { if (AQ.scenes.current !== 'ending') AQ.scenes.go('ending'); }, 200);
    });
    E.on('settings:changed', function (p) {
      if (p.key === 'showFps' || p.key === 'theme' || p.key === 'highContrast') { var s = document.querySelector('[data-screen="settings"]'); void s; }
    });
    // keep the Settings row and the title menu's Fullscreen label in sync (also when leaving with Esc / F11)
    function onFsChange() {
      if (document.querySelector('[data-screen="settings"], [data-screen="title"]')) ui.rerenderAll();
    }
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
  });
})(window.AQ);
