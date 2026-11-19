/* Planolândia — configuração do Phaser. Altura interna fixa de 270 px; a largura acompanha a proporção da tela. */
(function (root) {
  'use strict';
  const PL = root.PL;
  const H = 270;

  function widthFor() {
    const ar = (root.innerWidth || 16) / (root.innerHeight || 9);
    let w = Math.round(H * ar);
    w = Math.max(432, Math.min(640, w));
    return w - (w % 2);
  }

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: widthFor(),
    height: H,
    pixelArt: true,
    backgroundColor: '#07040f',
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4, gamepad: false },
    audio: { noAudio: true },
    disableContextMenu: true,
    scene: [PL.BootScene, PL.TitleScene, PL.IntroScene, PL.GameScene, PL.HudScene],
  });
  PL.phaser = game;

  let rt = null;
  root.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const w = widthFor();
      if (w !== game.scale.width) game.scale.setGameSize(w, H);
    }, 120);
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
