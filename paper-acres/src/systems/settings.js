/* Player settings, stored separately from save slots. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const KEY = 'paperacres.settings';
  const DEFAULTS = {
    master: 0.8, music: 0.55, sfx: 0.8, dayLength: 700, uiScale: 1, boil: false, shake: true, slices: 4,
    autoQuality: true, dprCap: 2, model: 0, touch: 'auto', leftHanded: false, touchSize: 1, hints: true, reducedMotion: false, pauseOnBlur: true,
  };
  PA.Settings = {
    DEFAULTS,
    load() {
      let s = {};
      try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
      PA.settings = Object.assign({}, DEFAULTS, s);
      return PA.settings;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(PA.settings)); } catch (e) { /* private mode */ } },
    set(k, v) { PA.settings[k] = v; this.save(); this.apply(); PA.Bus.emit('settings', { k, v }); },
    apply() {
      const s = PA.settings;
      document.documentElement.style.setProperty('--ui', String(s.uiScale));
      if (PA.Touch && PA.Touch.el) PA.Touch.refresh();
      if (PA.scene && PA.scene.ascii) { PA.scene.ascii.boil = !!s.boil && !s.reducedMotion; PA.scene.maxSlices = s.slices; }
      if (PA.Audio && PA.Audio.applyVolumes) PA.Audio.applyVolumes();
    },
  };
  PA.Settings.load();
})(typeof window !== 'undefined' ? window : globalThis);
