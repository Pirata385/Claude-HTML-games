/* Automatic quality: drops slices drawn and sharpness when the frame rate sags, restores them when it recovers. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  let acc = 0, frames = 0, low = 0, high = 0;
  PA.Quality = {
    level: 0, // 0 = as set by the player, 1 = fewer slices, 2 = also lower sharpness
    frame(dt) {
      if (!PA.settings.autoQuality || !PA.scene) return;
      acc += dt; frames++;
      if (acc < 1000) return;
      const fps = frames * 1000 / acc; acc = 0; frames = 0;
      if (fps < 42) { low++; high = 0; } else if (fps > 57) { high++; low = 0; } else { low = 0; high = 0; }
      if (low >= 3 && this.level < 2) { this.level++; low = 0; this.apply(); }
      if (high >= 12 && this.level > 0) { this.level--; high = 0; this.apply(); }
    },
    apply() {
      const s = PA.settings, g = PA.scene;
      g.maxSlices = this.level >= 1 ? Math.min(s.slices, 2) : s.slices;
      PA.qualityDpr = this.level >= 2 ? 1 : null;
      if (PA.refreshSize) PA.refreshSize();
    },
  };
  const baseDpr = () => PA.dpr;
  PA.Bus.on('ready', () => {
    const orig = baseDpr();
    PA.dpr = function () { const d = orig(); return PA.qualityDpr ? Math.min(d, PA.qualityDpr) : d; };
  });
})(typeof window !== 'undefined' ? window : globalThis);
