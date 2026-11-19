/* Planolândia — desenho das fatias em pixel art cartunesca.
 * Camada estática: redesenhada numa RenderTexture só quando z (quantizado) ou a sala mudam.
 * Visual de "folha cortada": contorno, face cortada, lábio 2.5D (a matéria que continua para dentro da tela),
 * realces, pintas de material sólido (ruído 3D, mudam ao atravessar a matéria) e enfeites nas bordas. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M;

  const tmpS = [G3.newShape(), G3.newShape(), G3.newShape(), G3.newShape()];
  const tmpG = G3.newShape();

  function pathFill(g, s, ox, oy, grow) {
    if (s.type === 'circle') {
      const r = s.r + (grow || 0);
      if (r > 0.4) g.fillCircle(Math.round(s.cx + ox), Math.round(s.cy + oy), r);
      return;
    }
    const p = s.pts;
    g.beginPath();
    g.moveTo(p[0] + ox, p[1] + oy);
    for (let i = 1; i < s.n; i++) g.lineTo(p[i * 2] + ox, p[i * 2 + 1] + oy);
    g.closePath();
    g.fillPath();
  }

  // contorno de 1 px: a forma desenhada em 4 deslocamentos na cor do contorno
  function outline(g, s, color, alpha) {
    g.fillStyle(color, alpha === undefined ? 1 : alpha);
    pathFill(g, s, -1, 0); pathFill(g, s, 1, 0); pathFill(g, s, 0, -1); pathFill(g, s, 0, 1);
  }

  // realces: bordas voltadas para cima clareiam, para baixo escurecem (1 px para dentro)
  function edgeShade(g, s, mat) {
    if (s.type === 'circle') {
      if (s.r < 3) return;
      g.lineStyle(1, mat.hi, 1);
      g.beginPath(); g.arc(s.cx, s.cy, s.r - 1.5, Math.PI * 1.08, Math.PI * 1.62); g.strokePath();
      g.lineStyle(1, mat.dark, 1);
      g.beginPath(); g.arc(s.cx, s.cy, s.r - 1.5, Math.PI * 0.08, Math.PI * 0.9); g.strokePath();
      return;
    }
    const p = s.pts, n = s.n;
    // orientação do polígono
    let area = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1]; }
    const sg = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = p[i * 2], y0 = p[i * 2 + 1], x1 = p[j * 2], y1 = p[j * 2 + 1];
      const ex = x1 - x0, ey = y1 - y0, l = Math.hypot(ex, ey);
      if (l < 3) continue;
      // normal para fora
      const nx = (ey / l) * sg, ny = (-ex / l) * sg;
      if (ny < -0.4) {
        g.lineStyle(1, mat.hi, 1);
        g.lineBetween(x0 - nx * 1.5, y0 - ny * 1.5, x1 - nx * 1.5, y1 - ny * 1.5);
      } else if (ny > 0.4 || nx > 0.7) {
        g.lineStyle(1, mat.dark, 1);
        g.lineBetween(x0 - nx * 1.5, y0 - ny * 1.5, x1 - nx * 1.5, y1 - ny * 1.5);
      }
    }
  }

  // pintas: ruído 3D amostrado numa grade; ao mudar de profundidade, as pintas mudam como num mármore cortado
  function speckle(g, s, mat, z, dens) {
    if (!mat.speck || dens <= 0) return;
    const cell = 6, zc = Math.floor(z / 9);
    const x0 = Math.floor(s.minX / cell), x1 = Math.floor(s.maxX / cell), y0 = Math.floor(s.minY / cell), y1 = Math.floor(s.maxY / cell);
    if ((x1 - x0) * (y1 - y0) > 4000) return;
    g.fillStyle(mat.speck, 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const h = M.hash(cx, cy, zc);
      if (h > 0.22 * dens) continue;
      const px = cx * cell + Math.floor(M.hash(cy, cx, zc + 7) * cell), py = cy * cell + Math.floor(M.hash(cx + 3, cy, zc) * cell);
      if (!PL.C2.pointIn(px, py, s)) continue;
      if (!PL.C2.pointIn(px, py - 3, s) || !PL.C2.pointIn(px + 2, py + 2, s)) continue; // longe da borda
      g.fillRect(px, py, h < 0.05 ? 2 : 1, 1);
    }
  }

  // enfeites determinísticos nas bordas superiores
  function decorate(g, s, mat, p) {
    if (!mat.deco || s.type === 'circle') return;
    const pts = s.pts, n = s.n;
    let area = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; }
    const sg = area > 0 ? 1 : -1;
    const seed = (p.seed || 0) + 13;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[j * 2], y1 = pts[j * 2 + 1];
      const ex = x1 - x0, ey = y1 - y0, l = Math.hypot(ex, ey);
      if (l < 6) continue;
      const ny = (-ex / l) * sg;
      if (ny > -0.7) continue;
      for (let t = 3; t < l - 2; t += 4) {
        const x = Math.round(x0 + (ex * t) / l), y = Math.round(y0 + (ey * t) / l);
        const h = M.hash(x, Math.round(y), seed);
        if (mat.deco === 'hachura') {
          if (h < 0.45) { g.fillStyle(h < 0.2 ? mat.hi : mat.top, 1); g.fillRect(x, y - 1 - Math.floor(h * 6), 1, 1 + Math.floor(h * 6)); }
        } else if (mat.deco === 'cristal') {
          if (h < 0.12) { g.fillStyle(mat.hi, 1); g.fillTriangle(x - 2, y, x + 2, y, x, y - 4 - Math.floor(h * 20)); }
        } else if (mat.deco === 'seta') {
          if (h < 0.3 && t % 12 < 4) { g.fillStyle(mat.hi, 1); g.fillRect(x, y + 3, 1, 1); g.fillRect(x - 1, y + 4, 3, 1); }
        }
      }
    }
  }

  // contorno pontilhado (premonição / fantasmas)
  function dotted(g, s, color, alpha, step) {
    g.fillStyle(color, alpha);
    step = step || 3;
    if (s.type === 'circle') {
      const n = Math.max(6, Math.floor((s.r * Math.PI * 2) / step));
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.fillRect(Math.round(s.cx + Math.cos(a) * s.r), Math.round(s.cy + Math.sin(a) * s.r), 1, 1); }
      return;
    }
    const p = s.pts;
    for (let i = 0; i < s.n; i++) {
      const j = (i + 1) % s.n;
      const x0 = p[i * 2], y0 = p[i * 2 + 1], ex = p[j * 2] - x0, ey = p[j * 2 + 1] - y0, l = Math.hypot(ex, ey);
      for (let t = 0; t < l; t += step) g.fillRect(Math.round(x0 + (ex * t) / l), Math.round(y0 + (ey * t) / l), 1, 1);
    }
  }

  // um sólido completo: lábio 2.5D (fatias um pouco à frente, deslocadas para cima-direita), contorno, face, realces
  function drawSolid(g, p, s, z, opts) {
    const mat = PL.MATS[p.mat] || PL.MATS.pedra;
    const lip = opts && opts.lip === false ? 0 : 3;
    let deepest = null;
    // lábio: matéria que continua em z+ (para dentro da tela)
    const lipList = [];
    for (let k = lip; k >= 1; k--) {
      const ls = tmpS[k];
      if (G3.sliceInto(p, z + k * 2.2, ls)) { lipList.push(k, ls); if (!deepest) deepest = [k, ls]; }
    }
    if (deepest) {
      g.fillStyle(mat.out, 1);
      const k = deepest[0], ls = deepest[1];
      pathFill(g, ls, k + 1, -k); pathFill(g, ls, k, -k - 1);
    }
    outline(g, s, mat.out);
    for (let i = 0; i < lipList.length; i += 2) {
      const k = lipList[i], ls = lipList[i + 1];
      g.fillStyle(k === 1 ? mat.top : M.mix(mat.top, mat.dark, 0.25 * (k - 1)), 1);
      pathFill(g, ls, k, -k);
    }
    g.fillStyle(opts && opts.flash ? 0xffffff : mat.fill, 1);
    pathFill(g, s, 0, 0);
    if (opts && opts.flash) return;
    // blocos altos escurecem para baixo (camadas de terreno): a luz vem de cima
    if (s.type === 'poly' && s.n === 4 && !p.hazard && (s.maxY - s.minY) > 26 && Math.abs(s.pts[1] - s.pts[3]) < 0.01 && Math.abs(s.pts[0] - s.pts[6]) < 0.01) {
      const top = s.minY, bot = s.maxY - 1, x0 = s.minX + 1, w = s.maxX - s.minX - 2;
      const bands = [[12, 0.1], [24, 0.18], [40, 0.27], [62, 0.36], [96, 0.45]];
      for (let i = 0; i < bands.length; i++) {
        const y0 = Math.round(top + bands[i][0]);
        if (y0 >= bot) break;
        const y1 = i + 1 < bands.length ? Math.min(bot, Math.round(top + bands[i + 1][0])) : bot;
        g.fillStyle(mat.dark, bands[i][1]);
        g.fillRect(x0, y0, w, y1 - y0);
      }
    }
    edgeShade(g, s, mat);
    if (!opts || opts.speck !== false) speckle(g, s, mat, z, opts && opts.dens !== undefined ? opts.dens : 1);
    if (!opts || opts.deco !== false) decorate(g, s, mat, p);
    if (p.hazard && s.type === 'poly') {
      // ponta vermelha dos espinhos
      let bi = 0;
      for (let i = 1; i < s.n; i++) if (s.pts[i * 2 + 1] < s.pts[bi * 2 + 1]) bi = i;
      g.fillStyle(mat.speck, 1);
      g.fillRect(Math.round(s.pts[bi * 2]) - 1, Math.round(s.pts[bi * 2 + 1]), 2, 2);
    }
  }

  class SliceRenderer {
    constructor(scene) {
      this.scene = scene;
      this.g = scene.make.graphics({ x: 0, y: 0 }, false);
      this.dyn = scene.add.graphics().setDepth(11);
      this.rt = null;
      this.key = '';
      this.vis = [];
      this.dens = 1;
      this.ghostRange = 8;
      this.eco = false;
    }
    setRoom(room) {
      this.room = room;
      if (this.rt) this.rt.destroy();
      this.rt = this.scene.add.renderTexture(0, 0, room.w, room.h).setOrigin(0, 0).setDepth(10);
      this.key = '';
    }
    destroy() {
      if (this.rt) this.rt.destroy();
      this.dyn.destroy();
      this.g.destroy();
    }
    redraw(z) {
      const room = this.room, g = this.g;
      g.clear();
      const ghosts = PL.REGIONS[room.def.region] || PL.REGIONS.borda;
      // premonição: o que vai surgir logo à frente/atrás (contorno pontilhado bem fraco)
      const gr = this.eco ? 48 : this.ghostRange;
      for (const p of room.prims) {
        if (p.off || p.hidden || p.dyn || p.secret) continue;
        if (z >= p.zMin && z <= p.zMax) continue;
        if (p.zMin > z && p.zMin <= z + gr) {
          if (G3.sliceInto(p, p.zMin + 0.01, tmpG)) dotted(g, tmpG, ghosts.ghostFront, this.eco ? 0.55 : 0.45, this.eco ? 2 : 3);
        } else if (p.zMax < z && p.zMax >= z - gr) {
          if (G3.sliceInto(p, p.zMax - 0.01, tmpG)) dotted(g, tmpG, ghosts.ghostBack, this.eco ? 0.55 : 0.45, this.eco ? 2 : 3);
        }
      }
      const vis = room.visibleAt(z, this.vis);
      // perigos por último, sólidos grandes primeiro (os menores ficam por cima)
      vis.sort((a, b) => (a.hazard ? 1 : 0) - (b.hazard ? 1 : 0) || (b._s.maxX - b._s.minX) * (b._s.maxY - b._s.minY) - (a._s.maxX - a._s.minX) * (a._s.maxY - a._s.minY));
      for (const p of vis) {
        if (p.dyn) continue;
        drawSolid(g, p, p._s, z, { dens: this.dens });
      }
      this.rt.clear();
      this.rt.draw(g, 0, 0);
      this.rt.render();
    }
    update(z, t, extra) {
      const room = this.room;
      const qz = Math.round(z * 2) / 2;
      const key = room.version + '|' + qz + '|' + this.eco;
      if (key !== this.key) { this.key = key; this.redraw(qz); }
      // camada dinâmica: sólidos móveis, avisos de que a forma vai sumir, bloqueios
      const d = this.dyn;
      d.clear();
      for (const p of room.prims) {
        if (p.off || p.hidden) continue;
        if (!p.dyn) { const e0 = Math.min(z - p.zMin, p.zMax - z); if (e0 < 0 || e0 >= 7) continue; }
        const s = G3.slice(p, z);
        if (!s) continue;
        if (p.dyn) drawSolid(d, p, s, z, { speck: false, flash: p.flashT > 0 });
        const e = G3.zEdge(p, z);
        if (e < 7 && !p.hazard && (s.maxX - s.minX) > 4) {
          // forma evanescente: contorno tremulando
          const a = (1 - e / 7) * (0.45 + 0.35 * Math.sin(t * 18 + (p.seed || 0)));
          dotted(d, s, 0xffffff, Math.max(0, a), 2);
        }
      }
      if (extra && extra.blocker && extra.blockT > 0) {
        if (G3.sliceInto(extra.blocker, extra.blockZ, tmpG)) {
          const a = Math.min(1, extra.blockT * 4);
          d.fillStyle(0xff4d6d, 0.35 * a); pathFill(d, tmpG, 0, 0);
          dotted(d, tmpG, 0xff4d6d, a, 2);
        }
      }
    }
  }

  PL.Slices = { SliceRenderer, drawSolid, pathFill, outline, dotted, edgeShade };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
