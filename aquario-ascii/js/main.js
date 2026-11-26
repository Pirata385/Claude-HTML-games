// Água-Tinta — boot (owner A): settings → save → perf → theme → display → input/ui/audio → title scene → loop.
(function (AQ) {
  'use strict';

  function safe(label, fn) {
    try { return fn(); } catch (e) { console.error('[AQ.main] ' + label + ' failed:', e); return undefined; }
  }

  function applyUiScale() {
    document.documentElement.style.setProperty('--ui-scale', String(AQ.settings.get('uiScale')));
  }

  function lifecycle() {
    var hiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        hiddenAt = Date.now();
        AQ.loop.stop();
        AQ.events.emit('app:hidden', {});
      } else {
        var awayMs = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        AQ.loop.start();
        AQ.events.emit('app:visible', { awayMs: awayMs });
      }
    });
    window.addEventListener('pagehide', function () { AQ.store.save('pagehide'); });
    AQ.events.on('lang:changed', function (p) { document.documentElement.lang = p.lang; });
    AQ.events.on('settings:changed', function (p) { if (p.key === 'uiScale') applyUiScale(); });
  }

  function boot() {
    var stage = document.getElementById('stage');
    var uiRoot = document.getElementById('ui');
    safe('settings.load', function () { AQ.settings.load(); });
    document.documentElement.lang = AQ.i18n.lang;
    applyUiScale();
    safe('store.load', function () { AQ.store.load(); });
    safe('perf.init', function () { AQ.perf.init(); });
    safe('theme.apply', function () { AQ.theme.apply(); });

    AQ.display.init(stage).then(function () {
      safe('input.init', function () { AQ.input.init(stage); });
      safe('ui.init', function () { AQ.ui.init(uiRoot); });
      safe('audio.init', function () { AQ.audio.init(); });
      safe('store.startAutosave', function () { AQ.store.startAutosave(); });
      lifecycle();
      var bootEl = document.getElementById('boot');
      if (bootEl) {
        bootEl.classList.add('done');
        setTimeout(function () { if (bootEl.parentNode) bootEl.parentNode.removeChild(bootEl); }, 400);
      }
      AQ.events.emit('app:ready', {});
      AQ.scenes.go('title', null, { transition: 'fade' });
      AQ.loop.start();
    }).catch(function (e) { console.error('[AQ.main] boot failed:', e); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.AQ);
