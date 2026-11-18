/* The notebook page: paper specks, ruled lines that follow the current slice, margin line, punched holes, fold. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;

  function makeTextures(scene) {
    if (!scene.textures.exists('paper-specks')) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = C.PAPER; ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = C.INK;
      const r = PA.RNG.mulberry32(1234);
      for (let i = 0; i < 70; i++) ctx.fillRect(Math.floor(r() * 256), Math.floor(r() * 256), 1, 1);
      scene.textures.addCanvas('paper-specks', cv);
    }
    if (!scene.textures.exists('rule')) {
      const cv = document.createElement('canvas'); cv.width = 8; cv.height = C.GH;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = C.INK; ctx.fillRect(0, C.GH - 2, 8, 2);
      scene.textures.addCanvas('rule', cv);
    }
  }

  class Paper {
    constructor(scene) {
      this.scene = scene;
      makeTextures(scene);
      const W = scene.scale.width, H = scene.scale.height;
      this.specks = scene.add.tileSprite(0, 0, W, H, 'paper-specks').setOrigin(0).setDepth(-100);
      this.rule = scene.add.tileSprite(0, 0, W, H, 'rule').setOrigin(0).setDepth(1500);
      this.g = scene.add.graphics().setDepth(2000);
      this.resize(W, H);
    }
    resize(W, H) {
      this.W = W; this.H = H;
      this.specks.setSize(W, H);
      this.rule.setSize(W, H);
      const g = this.g;
      g.clear();
      const u = Math.max(1, Math.round(H / 600));
      // margin line
      const mx = Math.round(Math.min(W * 0.07, 90));
      g.fillStyle(C.INK_N, 1);
      g.fillRect(mx, 0, u, H);
      // punched holes (ink discs)
      const hr = Math.max(5, Math.round(Math.min(W, H) * 0.014));
      for (const f of [0.18, 0.5, 0.82]) g.fillCircle(Math.round(mx * 0.45), Math.round(H * f), hr);
      // fold: a dotted horizontal crease
      for (let x = mx + 6 * u; x < W; x += 7 * u) g.fillRect(x, Math.round(H * 0.47), u, u);
      this.marginX = mx;
    }
    update(p0) {
      if (!p0) return;
      const s = p0.scale / 2;
      this.rule.setTileScale(1, s);
      this.rule.tilePositionY = -p0.oy / s;
    }
    setVisible(v) { this.specks.visible = v; this.rule.visible = v; this.g.visible = v; }
  }
  PA.Paper = Paper;
})(typeof window !== 'undefined' ? window : globalThis);
