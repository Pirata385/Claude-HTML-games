/* Boot: wait for the embedded fonts, build the glyph atlas, then start the game scene. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const all = Promise.all([
      document.fonts.load('400 36px "Courier Prime"'),
      document.fonts.load('700 36px "Courier Prime"'),
      document.fonts.load('20px "Patrick Hand"'),
    ]).catch(() => null);
    return Promise.race([all, new Promise((r) => setTimeout(r, 2500))]);
  }

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }
    create() {
      fontsReady().then(() => {
        PA.Glyphs.build(this);
        this.scene.start('Game');
      });
    }
  }

  PA.dpr = function () {
    const cap = (PA.settings && PA.settings.dprCap) || 2;
    return Math.max(1, Math.min(window.devicePixelRatio || 1, cap));
  };

  PA.start = function () {
    const dpr = PA.dpr();
    const host = document.getElementById('game');
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    PA.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: PA.C.PAPER,
      width: Math.round(w * dpr), height: Math.round(h * dpr),
      scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
      physics: { default: 'matter', matter: { gravity: { y: 1.6 }, enableSleeping: false, debug: false, positionIterations: 8, velocityIterations: 6 } },
      render: { antialias: true, powerPreference: 'high-performance' },
      input: { activePointers: 4 },
      disableContextMenu: true,
      banner: false,
      scene: [BootScene, PA.GameScene],
    });
    let pending = 0;
    const onResize = () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        const d = PA.dpr();
        const ww = host.clientWidth || window.innerWidth, hh = host.clientHeight || window.innerHeight;
        PA.game.scale.resize(Math.round(ww * d), Math.round(hh * d));
        PA.game.scale.setZoom(1 / d);
        PA.Bus.emit('resize', { w: ww, h: hh, dpr: d });
      }, 60);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    PA.refreshSize = onResize;
  };
  PA.BootScene = BootScene;
})(typeof window !== 'undefined' ? window : globalThis);
