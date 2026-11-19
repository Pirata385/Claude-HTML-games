/* Planolândia — fundo em parallax por região: céu de papel quadriculado e silhuetas de poliedros distantes.
 * As camadas também deslizam um pouco na diagonal quando o Quadrado muda de profundidade (pista 2.5D). */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const M = PL.M;

  function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }

  // projeção oblíqua simples de um poliedro em canvas
  function drawSolidSilhouette(ctx, kind, x, y, s, rot, fill, edge) {
    const verts = [];
    const faces = [];
    if (kind === 'cubo') {
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) verts.push([a, b, c]);
      faces.push([0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]);
    } else if (kind === 'octa') {
      verts.push([1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]);
      faces.push([0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 4], [1, 4, 3], [1, 3, 5], [1, 5, 2]);
    } else {
      verts.push([0, -1.3, 0], [1, 0.6, 1], [-1, 0.6, 1], [0, 0.6, -1.2]);
      faces.push([0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 2, 3]);
    }
    const m = PL.G3.rotMatrix(rot, rot * 0.7, rot * 0.3);
    const P = verts.map((v) => {
      const X = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
      const Y = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
      return [x + X * s, y + Y * s];
    });
    // silhueta = fecho convexo dos vértices projetados
    const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    const hull = lo.slice(0, -1).concat(up.slice(0, -1));
    ctx.fillStyle = hex(fill);
    ctx.beginPath();
    hull.forEach((p, i) => (i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1]))));
    ctx.closePath();
    ctx.fill();
    // arestas internas em pixel
    ctx.fillStyle = hex(edge);
    for (const f of faces) for (let i = 0; i < f.length; i++) {
      const a = P[f[i]], b = P[f[(i + 1) % f.length]];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let k = 0; k <= n; k += 2) ctx.fillRect(Math.round(a[0] + ((b[0] - a[0]) * k) / n), Math.round(a[1] + ((b[1] - a[1]) * k) / n), 1, 1);
    }
  }

  function makeTextures(scene, regionId) {
    const R = PL.REGIONS[regionId];
    const key = 'bg_' + regionId;
    if (scene.textures.exists(key + '_sky')) return key;
    // céu: gradiente com quadriculado (papel milimetrado de um mundo matemático)
    {
      const W = 64, H = 270;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      for (let y = 0; y < H; y++) {
        const t = y / H;
        // gradiente em faixas (dithering ordenado)
        const band = Math.floor(t * 10);
        for (let x = 0; x < W; x++) {
          const th = ((x + y) % 2) * 0.05;
          ctx.fillStyle = hex(M.mix(R.skyTop, R.skyBot, Math.min(1, band / 9 + th)));
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.fillStyle = hex(R.grid);
      for (let y = 0; y < H; y += 16) ctx.fillRect(0, y, W, 1);
      for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 1, H);
      ctx.fillStyle = hex(R.gridHi);
      for (let y = 0; y < H; y += 64) ctx.fillRect(0, y, W, 1);
      ctx.fillRect(0, 0, 1, H);
      scene.textures.addCanvas(key + '_sky', c);
    }
    // camadas de silhuetas
    const layers = [['far', 512, 270, 0.5], ['mid', 640, 270, 1]];
    layers.forEach(([nm, W, H, big], li) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const rnd = M.rng(M.hashStr(regionId + nm));
      const cols = R[nm];
      const kinds = ['cubo', 'octa', 'tetra'];
      const n = li === 0 ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const s = (14 + rnd() * 26) * big;
        const x = (i + 0.5) * (W / n) + (rnd() - 0.5) * 30;
        const y = H - 60 - s * (0.6 + rnd() * 1.4);
        drawSolidSilhouette(ctx, kinds[(rnd() * 3) | 0], x, y, s, rnd() * 6, cols[0], cols[1]);
        // repete na borda para emendar
        if (x < s * 2) drawSolidSilhouette(ctx, kinds[i % 3], x + W, y, s, rnd() * 6, cols[0], cols[1]);
      }
      // chão distante: colinas facetadas
      ctx.fillStyle = hex(cols[0]);
      let yy = H - 20;
      for (let x = 0; x <= W; x += 8) {
        const h = H - 66 - Math.round((Math.sin((x / W) * Math.PI * 2 * (li + 2)) * 0.5 + 0.5) * 22 * big);
        ctx.fillRect(x, h, 8, H - h);
        yy = h;
      }
      scene.textures.addCanvas(key + '_' + nm, c);
    });
    return key;
  }

  class Background {
    constructor(scene) {
      this.scene = scene;
      this.layers = [];
      this.region = null;
      this.motes = [];
    }
    setRegion(regionId, viewW, viewH) {
      if (this.region === regionId && this.layers.length) { this.resize(viewW, viewH); return; }
      this.destroy();
      this.region = regionId;
      const key = makeTextures(this.scene, regionId);
      const sc = this.scene;
      this.sky = sc.add.tileSprite(0, 0, viewW, viewH, key + '_sky').setOrigin(0, 0).setScrollFactor(0).setDepth(0);
      this.far = sc.add.tileSprite(0, viewH - 270, viewW, 270, key + '_far').setOrigin(0, 0).setScrollFactor(0).setDepth(1).setAlpha(0.9);
      this.mid = sc.add.tileSprite(0, viewH - 270, viewW, 270, key + '_mid').setOrigin(0, 0).setScrollFactor(0).setDepth(2).setAlpha(0.85);
      this.layers = [this.sky, this.far, this.mid];
      this.motesG = sc.add.graphics().setScrollFactor(0).setDepth(3);
      const rnd = M.rng(7);
      this.motes = [];
      for (let i = 0; i < 28; i++) this.motes.push({ x: rnd() * 640, y: rnd() * 270, z: rnd(), s: rnd() < 0.2 ? 2 : 1, ph: rnd() * 6 });
      this.viewW = viewW; this.viewH = viewH;
    }
    resize(w, h) {
      if (!this.sky) return;
      this.viewW = w; this.viewH = h;
      this.sky.setSize(w, h);
      this.far.setSize(w, 270).setY(h - 270);
      this.mid.setSize(w, 270).setY(h - 270);
    }
    update(camX, camY, z, t) {
      if (!this.sky) return;
      // parallax horizontal + leve deslocamento oblíquo com a profundidade
      this.sky.tilePositionX = camX * 0.05 + z * 0.05;
      this.sky.tilePositionY = camY * 0.05 - z * 0.05;
      this.far.tilePositionX = camX * 0.15 + z * 0.12;
      this.far.y = this.viewH - 270 + 20 + Math.min(20, Math.max(-20, -camY * 0.04)) + z * 0.05;
      this.mid.tilePositionX = camX * 0.3 + z * 0.25;
      this.mid.y = this.viewH - 270 + 30 + Math.min(30, Math.max(-30, -camY * 0.08)) + z * 0.1;
      const g = this.motesG;
      g.clear();
      const R = PL.REGIONS[this.region];
      for (const m of this.motes) {
        const par = 0.2 + m.z * 0.6;
        const x = ((m.x - camX * par - z * par * 0.6) % this.viewW + this.viewW) % this.viewW;
        const y = ((m.y - camY * par * 0.5 + Math.sin(t * 0.6 + m.ph) * 6 + z * par * 0.4) % this.viewH + this.viewH) % this.viewH;
        g.fillStyle(R.fog, 0.25 + m.z * 0.4);
        g.fillRect(Math.round(x), Math.round(y), m.s, m.s);
      }
    }
    destroy() {
      for (const l of this.layers) l.destroy();
      if (this.motesG) this.motesG.destroy();
      this.layers = [];
      this.sky = null;
    }
  }

  PL.Background = Background;
  PL.BG = { drawSolidSilhouette, makeTextures };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
