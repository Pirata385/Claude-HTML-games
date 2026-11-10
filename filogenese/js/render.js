/* Filogênese — renderização: câmera, chão em blocos, cenário, criaturas, efeitos, noite/chuva, bússola e mapas. */
(function (FG) {
  'use strict';
  const U = FG.U, TAU = U.TAU, G = FG.Game, Draw = FG.Draw, Sprites = FG.Sprites, FX = FG.FX, Icons = FG.Icons, B = FG.B;
  const World = FG.World, CH = World.CHUNK, PC = World.PC;
  const ord = [], canopies = [], nearBuf = [];
  let ordN = 0;
  const REL_COL = { ally: '#7df08a', neutral: '#ffd76a', hostile: '#ff6a5a', extinct: '#9aa0a8', own: '#ffffff' };

  const R = FG.Render = {
    canvas: null, ctx: null, w: 0, h: 0, dpr: 1, zoom: 1, cam: { x: 0, y: 0 }, view: { x0: 0, y0: 0, x1: 0, y1: 0 },
    quality: 'medium', auto: true, ft: 16, slowT: 0, fastT: 0, t: 0, light: null, first: 8, fog: null, fogDirty: true,

    init(canvas) {
      R.canvas = canvas; R.ctx = canvas.getContext('2d', { alpha: false });
      R.light = document.createElement('canvas');
      R.applyQualitySetting();
      R.resize();
      FG.bus.on('mapdirty', () => { R.fogDirty = true; });
      FG.bus.on('gamestart', () => { R.first = 10; R.fogDirty = true; if (G.player) { R.cam.x = G.player.x; R.cam.y = G.player.y; } if (G.world) G.world.setQuality(R.quality); if (!Sprites.built) Sprites.build(1); });
      FG.bus.on('setting', (k) => { if (k === 'quality' || k === '*') R.applyQualitySetting(); if (k === 'zoom' || k === '*') R.resize(); });
    },
    applyQualitySetting() {
      const q = FG.Settings.data.quality;
      R.auto = q === 'auto';
      const mobile = Math.min(window.innerWidth, window.innerHeight) < 600 || (navigator.maxTouchPoints > 0 && window.innerWidth < 1100);
      R.setQuality(R.auto ? (mobile ? 'medium' : 'high') : q);
    },
    setQuality(q) {
      R.quality = q;
      FX.max = q === 'low' ? 110 : q === 'medium' ? 220 : 340;
      if (G.world) G.world.setQuality(q);
      R.resize();
    },
    resize() {
      const c = R.canvas;
      if (!c) return;
      const cap = R.quality === 'low' ? 1 : R.quality === 'medium' ? 1.5 : 2;
      R.dpr = Math.min(window.devicePixelRatio || 1, cap);
      R.w = c.clientWidth || window.innerWidth; R.h = c.clientHeight || window.innerHeight;
      const W = Math.round(R.w * R.dpr), H = Math.round(R.h * R.dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      R.light.width = Math.max(2, Math.ceil(R.w / 4)); R.light.height = Math.max(2, Math.ceil(R.h / 4));
    },
    baseZoom() {
      const P = G.player, s = P ? P.bp.size : 1;
      let z = U.clamp(Math.min(R.w, R.h) / 560, 0.62, 1.7) * FG.Settings.data.zoom / (0.78 + 0.22 * s);
      if (G.cine && (G.cine.type === 'mate' || G.cine.type === 'hatch')) z *= 1.25;
      return z;
    },
    toWorld(sx, sy) { return { x: R.cam.x + (sx - R.w / 2) / R.zoom, y: R.cam.y + (sy - R.h / 2) / R.zoom }; },
    toScreen(x, y) { return { x: (x - R.cam.x) * R.zoom + R.w / 2, y: (y - R.cam.y) * R.zoom + R.h / 2 }; },

    /** Ajusta a qualidade sozinho quando o quadro fica lento (modo automático). */
    adapt(dt) {
      R.ft += (dt * 1000 - R.ft) * 0.05;
      if (!R.auto || R.first > 0) return;
      if (R.ft > 26) { R.slowT += dt; R.fastT = 0; } else if (R.ft < 13) { R.fastT += dt; R.slowT = 0; } else { R.slowT = Math.max(0, R.slowT - dt); R.fastT = 0; }
      if (R.slowT > 3 && R.quality !== 'low') { R.slowT = 0; R.setQuality(R.quality === 'high' ? 'medium' : 'low'); }
      else if (R.fastT > 14 && R.quality === 'low') { R.fastT = 0; R.setQuality('medium'); }
    },

    frame(dt) {
      const ctx = R.ctx, W = G.world, P = G.player;
      if (!W || !P) return;
      const pf = R.prof;
      if (pf) pt = performance.now();
      R.t += dt; R.adapt(dt);
      const S = FG.Settings.data, low = R.quality === 'low';
      // ---- câmera ----
      const tz = R.baseZoom();
      R.zoom += (tz - R.zoom) * Math.min(1, dt * 3);
      const lead = P.dead ? 0 : 0.22;
      R.cam.x += (P.x + P.vx * lead - R.cam.x) * Math.min(1, dt * 6);
      R.cam.y += (P.y + P.vy * lead - R.cam.y) * Math.min(1, dt * 6);
      if (R.first > 0) { R.cam.x = P.x; R.cam.y = P.y; R.zoom = tz; }
      const z = R.zoom, dpr = R.dpr, w = R.w, h = R.h;
      let sx = 0, sy = 0;
      if (G.shake > 0 && S.shake) { sx = (Math.random() - 0.5) * G.shake / z; sy = (Math.random() - 0.5) * G.shake / z; }
      const cx = R.cam.x + sx, cy = R.cam.y + sy;
      const v = R.view; v.x0 = cx - w / 2 / z; v.y0 = cy - h / 2 / z; v.x1 = cx + w / 2 / z; v.y1 = cy + h / 2 / z;
      const k = z * dpr, ox = w / 2 * dpr - cx * k, oy = h / 2 * dpr - cy * k;

      if (pf) mark('cam');
      // ---- água animada ao fundo ----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#2d7ea8'; ctx.fillRect(0, 0, R.canvas.width, R.canvas.height);
      ctx.setTransform(k, 0, 0, k, ox, oy);
      if (!low && Sprites.waves && R.waterInView(W, v)) {
        // só pinta as ondas quando há água à vista (é a etapa mais cara do quadro)
        if (!R.wavePat) R.wavePat = ctx.createPattern(Sprites.waves, 'repeat');
        const pat = R.wavePat;
        if (pat.setTransform) {
          ctx.fillStyle = pat;
          pat.setTransform(new DOMMatrix().translate(R.t * 11, R.t * 4)); ctx.globalAlpha = 0.55; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
          if (R.quality === 'high') { pat.setTransform(new DOMMatrix().translate(-R.t * 7, R.t * 6).scale(1.7)); ctx.globalAlpha = 0.3; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); }
          ctx.globalAlpha = 1;
        }
      }
      if (pf) mark('water');
      // ---- chão: blocos alinhados a pixels do dispositivo (sem emendas) ----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const c0x = Math.floor(v.x0 / CH), c1x = Math.floor(v.x1 / CH), c0y = Math.floor(v.y0 / CH), c1y = Math.floor(v.y1 / CH);
      const map = W.mapCanvas(), mk = W.GW / W.SIZE;
      for (let gy = c0y; gy <= c1y; gy++) {
        const dy0 = Math.round(gy * CH * k + oy), dy1 = Math.round((gy + 1) * CH * k + oy);
        for (let gx = c0x; gx <= c1x; gx++) {
          const dx0 = Math.round(gx * CH * k + ox), dx1 = Math.round((gx + 1) * CH * k + ox);
          const cv = W.chunk(gx, gy);
          if (cv) ctx.drawImage(cv, dx0, dy0, dx1 - dx0, dy1 - dy0);
          else if (gx >= 0 && gy >= 0 && gx * CH < W.SIZE && gy * CH < W.SIZE) ctx.drawImage(map, gx * CH * mk, gy * CH * mk, CH * mk, CH * mk, dx0, dy0, dx1 - dx0, dy1 - dy0);
        }
      }
      W.pump(R.first > 0 ? 60 : 5);
      if (R.first > 0) R.first--;
      ctx.setTransform(k, 0, 0, k, ox, oy);

      if (pf) mark('ground');
      // ---- cenário: coleta por célula ----
      ordN = 0; canopies.length = 0;
      const p0x = Math.floor((v.x0 - 130) / PC), p1x = Math.floor((v.x1 + 130) / PC), p0y = Math.floor((v.y0 - 130) / PC), p1y = Math.floor((v.y1 + 130) / PC);
      const shadows = S.shadows && !low;
      for (let gy = p0y; gy <= p1y; gy++) for (let gx = p0x; gx <= p1x; gx++) {
        const items = W.cellAt(gx, gy).items;
        for (let i = 0; i < items.length; i++) {
          const it = items[i], t = it.t;
          if (t === 'grass') { if (!low || (it.id & 1)) Sprites.draw(ctx, Sprites.grass[it.biome][it.v], it.x, it.y, it.s); }
          else if (t === 'flower') { if (!low) Sprites.draw(ctx, Sprites.flower[it.v], it.x, it.y, it.s); }
          else if (t === 'misc' || t === 'reed' || t === 'lily') Sprites.draw(ctx, Sprites.misc[t === 'misc' ? it.kind : t][it.v], it.x, it.y, it.s);
          else if (t === 'tree') {
            if (it.kind === 'cactus' || it.kind === 'dead') push(it.y, 1, it);
            else {
              canopies.push(it);
              if (shadows) { ctx.fillStyle = 'rgba(8,20,10,0.2)'; ctx.beginPath(); ctx.ellipse(it.x + 10, it.y + 16, 46 * it.s, 38 * it.s, 0, 0, TAU); ctx.fill(); }
              ctx.fillStyle = '#5a4128'; ctx.beginPath(); ctx.arc(it.x, it.y, 8 * it.s, 0, TAU); ctx.fill();
            }
          } else push(it.y, 1, it);
        }
      }
      if (pf) mark('props');
      // ---- ninhos, fósseis, carcaças ----
      const H = G.homeNest;
      for (const n of W.nests) if (n.x > v.x0 - 80 && n.x < v.x1 + 80 && n.y > v.y0 - 80 && n.y < v.y1 + 80) R.drawNest(ctx, n, G.fauna.byId[n.sp]);
      if (H.x > v.x0 - 90 && H.x < v.x1 + 90 && H.y > v.y0 - 90 && H.y < v.y1 + 90) R.drawNest(ctx, H, G.playerSp);
      for (const f of W.fossils) {
        if (f.taken || f.x < v.x0 - 50 || f.x > v.x1 + 50 || f.y < v.y0 - 50 || f.y > v.y1 + 50) continue;
        const pu = 0.5 + 0.5 * Math.sin(R.t * 3 + f.id);
        ctx.strokeStyle = `rgba(255,244,200,${0.25 + pu * 0.35})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, 36 + pu * 5, 0, TAU); ctx.stroke();
        Sprites.draw(ctx, Sprites.fossil, f.x, f.y, 1);
      }
      const L = G.creatures, tgt = G.target;
      for (let i = 0; i < L.length; i++) {
        const c = L[i], m = c.bp.bodyLen + 60;
        if (c.x < v.x0 - m || c.x > v.x1 + m || c.y < v.y0 - m || c.y > v.y1 + m) { c.vis = false; continue; }
        c.vis = true;
        if (c.dead) Draw.creature(ctx, c, { shadow: false, lod: low ? 2 : 1 });
        else push(c.y, 0, c);
      }
      // ---- anel do alvo e marcador de interação ----
      if (tgt && !tgt.gone && tgt.vis) {
        const col = REL_COL[R.attitude(tgt)], rr = tgt.radius * 1.5 + 10;
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -R.t * 22;
        ctx.beginPath(); ctx.ellipse(tgt.x, tgt.y, rr, rr * 0.85, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      const it = G.interactable;
      if (it && it.type !== 'no') {
        const pu = 0.5 + 0.5 * Math.sin(R.t * 6);
        ctx.strokeStyle = `rgba(255,255,255,${0.5 + pu * 0.4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(it.x, it.y, 26 + pu * 4, 0, TAU); ctx.stroke();
      }
      if (pf) mark('nests');
      // ---- criaturas e sólidos ordenados por y ----
      sortOrd();
      const lodBias = low ? 1 : 0;
      for (let i = 0; i < ordN; i++) {
        const o = ord[i];
        if (o.k === 0) {
          const c = o.ref, px = c.bp.bodyLen * z;
          Draw.creature(ctx, c, { shadow: shadows || c.isPlayer, lod: Math.min(2, (px < 26 ? 2 : px < 56 ? 1 : 0) + (c.isPlayer ? 0 : lodBias)) });
        } else R.drawSolid(ctx, o.ref, shadows);
      }
      if (pf) mark('sorted');
      // ---- projéteis e partículas ----
      for (const p of G.projectiles) {
        ctx.fillStyle = 'rgba(155,224,74,0.35)'; ctx.beginPath(); ctx.arc(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.r * 1.3, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c8f56a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
      if (S.particles) FX.draw(ctx, v.x0 - 40, v.y0 - 40, v.x1 + 40, v.y1 + 40);
      if (pf) mark('fx');
      // ---- copas das árvores (somem perto do jogador) ----
      for (let i = 0; i < canopies.length; i++) {
        const it = canopies[i], set = Sprites.canopy[it.kind === 'leaf' ? (W.biomeAt(it.x, it.y) === B.FOREST ? 'leaf' : 'leafL') : it.kind];
        if (!set) continue;
        // a copa fica translúcida quando há qualquer criatura por baixo (suavizado por árvore)
        const rad = 54 * it.s;
        let d = U.dist(P.x, P.y, it.x, it.y) - P.radius;
        const under = G.near(it.x, it.y, rad + 60, nearBuf);
        for (let j = 0; j < under.length; j++) { const c = under[j]; if (c.dead && c !== tgt) continue; const q = U.dist(c.x, c.y, it.x, it.y) - c.radius; if (q < d) d = q; }
        const want = d < rad + 6 ? 0.3 : d < rad + 60 ? 0.3 + (d - rad - 6) / 54 * 0.64 : 0.94;
        it.a = it.a == null ? want : it.a + (want - it.a) * Math.min(1, dt * 6 + (dt === 0 ? 1 : 0));
        const sway = low ? 0 : Math.sin(R.t * 0.9 + it.x * 0.01 + it.y * 0.013) * 1.6;
        ctx.globalAlpha = it.a;
        Sprites.draw(ctx, set[it.v], it.x + sway, it.y + sway * 0.4, it.s);
      }
      ctx.globalAlpha = 1;
      if (pf) mark('canopy');
      // ---- indicadores sobre as criaturas ----
      R.overhead(ctx);
      if (pf) mark('overhead');
      // ---- espaço de tela: noite, chuva, bússola ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R.lighting(ctx);
      if (G.rain > 0.02 && S.weather) R.drawRain(ctx, dt);
      R.compass(ctx);
      R.ambient(dt);
      if (pf) mark('screen');
    },

    waterInView(W, v) {
      const nx = 7, ny = 5, sea = W.SEA;
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) if (W.hAt(v.x0 + (v.x1 - v.x0) * i / nx, v.y0 + (v.y1 - v.y0) * j / ny) < sea + 0.004) return true;
      return false;
    },

    attitude(c) {
      if (c.sp.isPlayer || (c.ai && c.ai.pack)) return 'own';
      const rel = G.rel(c.sp);
      if (rel.status === 'extinct') return 'extinct';
      if (rel.status === 'ally' || c.friend) return rel.anger > 0 ? 'hostile' : 'ally';
      if (rel.anger > 0 || (c.ai && c.ai.st === 'fight' && c.ai.tgt && G.isSide(c.ai.tgt))) return 'hostile';
      const react = FG.Species.NICHES[c.sp.niche].react;
      return react === 'hunter' ? 'hostile' : 'neutral';
    },

    drawSolid(ctx, it, shadows) {
      const t = it.t;
      if (t === 'rock') Sprites.draw(ctx, Sprites.rock[it.v], it.x, it.y, it.s);
      else if (t === 'tree') Sprites.draw(ctx, it.kind === 'cactus' ? Sprites.cactus[it.v] : Sprites.dead[it.v], it.x, it.y, it.s);
      else if (t === 'bush') { if (shadows) { ctx.fillStyle = 'rgba(8,20,10,0.18)'; ctx.beginPath(); ctx.ellipse(it.x + 4, it.y + 7, 16 * it.s, 12 * it.s, 0, 0, TAU); ctx.fill(); } Sprites.draw(ctx, Sprites.bush[it.biome][it.v], it.x, it.y, it.s); }
      else if (t === 'fbush') {
        if (shadows) { ctx.fillStyle = 'rgba(8,20,10,0.18)'; ctx.beginPath(); ctx.ellipse(it.x + 5, it.y + 8, 22 * it.s, 17 * it.s, 0, 0, TAU); ctx.fill(); }
        Sprites.draw(ctx, Sprites.fbush[it.biome][it.v], it.x, it.y, it.s);
        const n = G.world.bushFruit(it), col = Sprites.FRUIT[it.biome] || '#e8455e';
        for (let i = 0; i < n; i++) {
          const a = it.id * 1.7 + i * 2.2, fx = it.x + Math.cos(a) * 9 * it.s, fy = it.y + Math.sin(a) * 8 * it.s;
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(fx + 0.8, fy + 1.2, 4.6, 0, TAU); ctx.fill();
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(fx, fy, 4.4, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(fx - 1.3, fy - 1.4, 1.4, 0, TAU); ctx.fill();
        }
      }
    },

    drawNest(ctx, n, sp) {
      const rel = G.rel(sp), own = !!n.own, dead = rel.status === 'extinct' || (!own && n.pop <= 0 && !n.spawned);
      const seed = own ? 991 : n.id * 37 + 5, rad = own ? 50 : 42;
      ctx.globalAlpha = dead ? 0.45 : 1;
      ctx.fillStyle = 'rgba(52,36,20,0.42)'; ctx.beginPath(); ctx.ellipse(n.x, n.y, rad, rad * 0.86, 0, 0, TAU); ctx.fill();
      ctx.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        const h = U.hash(i, seed, 7) / 4294967296, a = i * TAU / 22 + h, r0 = rad * (0.82 + h * 0.2), l = 16 + h * 14;
        const x = n.x + Math.cos(a) * r0, y = n.y + Math.sin(a) * r0 * 0.86, ta = a + Math.PI / 2 + (h - 0.5) * 0.9;
        ctx.strokeStyle = i % 3 ? '#7a5a36' : '#5b4024'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(x - Math.cos(ta) * l / 2, y - Math.sin(ta) * l / 2); ctx.lineTo(x + Math.cos(ta) * l / 2, y + Math.sin(ta) * l / 2); ctx.stroke();
      }
      if (own || rel.status === 'ally') {
        ctx.strokeStyle = own ? 'rgba(255,255,255,0.55)' : 'rgba(125,240,138,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(n.x, n.y, rad + 9, (rad + 9) * 0.86, 0, 0, TAU); ctx.stroke();
      }
      const c1 = sp.genome.skin.c1, c2 = sp.genome.skin.c2, eggs = dead ? 0 : n.eggs;
      for (let i = 0; i < eggs; i++) {
        const a = seed + i * 2.1, ex = n.x + Math.cos(a) * 13, ey = n.y + Math.sin(a) * 10;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(ex + 1.5, ey + 2.5, 8, 10, a, 0, TAU); ctx.fill();
        ctx.fillStyle = U.hsl([c1[0], c1[1] * 0.5, 84]); ctx.beginPath(); ctx.ellipse(ex, ey, 8, 10, a, 0, TAU); ctx.fill();
        ctx.fillStyle = U.hsl(c2, 10, 0.8); ctx.beginPath(); ctx.arc(ex - 2, ey - 2, 2, 0, TAU); ctx.arc(ex + 3, ey + 2, 1.6, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    overhead(ctx) {
      const L = G.creatures, P = G.player, tgt = G.target, e = G.enc, cb = FG.Settings.data.colorblind;
      for (let i = 0; i < L.length; i++) {
        const c = L[i];
        if (!c.vis || c.dead || c.isPlayer) continue;
        const top = c.y - c.radius * (c.scaleMul || 1) - 14 - (c.z || 0);
        const att = R.attitude(c), isT = c === tgt;
        if (c.hp < c.maxHp || isT) {
          const bw = U.clamp(c.radius * 2.2, 26, 80), f = U.clamp(c.hp / c.maxHp, 0, 1);
          ctx.fillStyle = 'rgba(8,12,10,0.65)'; ctx.fillRect(c.x - bw / 2 - 1, top - 1, bw + 2, 6);
          ctx.fillStyle = att === 'own' ? '#8fd8ff' : REL_COL[att]; ctx.fillRect(c.x - bw / 2, top, bw * f, 4);
          if (c.friendMeter > 0 && !c.friend) { ctx.fillStyle = 'rgba(8,12,10,0.65)'; ctx.fillRect(c.x - bw / 2 - 1, top + 6, bw + 2, 5); ctx.fillStyle = '#ff9ec4'; ctx.fillRect(c.x - bw / 2, top + 7, bw * U.clamp(c.friendMeter, 0, 1), 3); }
        }
        const near = U.dist2(c.x, c.y, P.x, P.y) < 420 * 420;
        if (near || isT) {
          const iy = top - 12;
          if (c.ai && c.ai.pack) Icons.draw(ctx, 'paw', c.x, iy, 13, '#8fd8ff');
          else if (c.friend && att !== 'hostile') Icons.draw(ctx, 'heart', c.x, iy, 12, '#7df08a');
          else if (att === 'hostile' && c.ai && c.ai.st === 'fight' && c.ai.tgt && G.isSide(c.ai.tgt)) Icons.draw(ctx, 'alert', c.x, iy, 14, '#ff6a5a');
          else if (cb && isT) Icons.draw(ctx, att === 'hostile' ? 'alert' : att === 'ally' ? 'heart' : 'info', c.x, iy, 12, REL_COL[att]);
        }
      }
      if (e && e.c && e.c.vis && e.phase === 'ask' && e.want) {
        const c = e.c, bx = c.x, by = c.y - c.radius - 52 - (c.z || 0), pu = 1 + Math.sin(R.t * 8) * 0.05;
        ctx.fillStyle = 'rgba(14,20,18,0.35)'; ctx.beginPath(); ctx.arc(bx + 1.5, by + 3, 23 * pu, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fbfaf2'; ctx.beginPath(); ctx.arc(bx, by, 22 * pu, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx - 7, by + 19); ctx.lineTo(bx, by + 32); ctx.lineTo(bx + 7, by + 19); ctx.fill();
        ctx.strokeStyle = e.timer < 1.5 ? '#ff6a5a' : '#58c46a'; ctx.lineWidth = 4; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(bx, by, 22 * pu, -Math.PI / 2, -Math.PI / 2 + TAU * U.clamp(e.timer / e.tmax, 0, 1)); ctx.stroke();
        Icons.draw(ctx, e.want, bx, by, 26 * pu, '#2a3a34');
      }
    },

    /** Escuridão da noite com clarões em volta do jogador e de criaturas luminosas. */
    lighting(ctx) {
      const n = G.night, w = R.w, h = R.h;
      const dusk = U.sstep(0.5, 0.64, G.day) * (1 - U.sstep(0.66, 0.76, G.day)) + U.sstep(0.92, 0.97, G.day) * (1 - U.sstep(0.98, 1, G.day));
      if (dusk > 0.01) { ctx.fillStyle = `rgba(255,150,70,${dusk * 0.13})`; ctx.fillRect(0, 0, w, h); }
      const rain = G.rain * 0.14;
      if (rain > 0.01) { ctx.fillStyle = `rgba(40,56,80,${rain})`; ctx.fillRect(0, 0, w, h); }
      if (n < 0.02) return;
      const lc = R.light, lx = lc.getContext('2d'), s = lc.width / w, z = R.zoom, P = G.player;
      lx.globalCompositeOperation = 'source-over';
      lx.clearRect(0, 0, lc.width, lc.height);
      lx.fillStyle = `rgba(8,14,40,${0.66 * n})`; lx.fillRect(0, 0, lc.width, lc.height);
      lx.globalCompositeOperation = 'destination-out';
      const hole = (x, y, rad, a) => {
        const p = R.toScreen(x, y), g = lx.createRadialGradient(p.x * s, p.y * s, 0, p.x * s, p.y * s, rad * z * s);
        g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.5, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        lx.fillStyle = g; lx.beginPath(); lx.arc(p.x * s, p.y * s, rad * z * s, 0, TAU); lx.fill();
      };
      hole(P.x, P.y, 200 + 34 * P.stats.sense, 0.95);
      const L = G.creatures;
      for (let i = 0; i < L.length; i++) {
        const c = L[i];
        if (!c.vis || c.dead || c === P) continue;
        const pv = c.bp.pv;
        if ((pv.back && pv.back.vis.k === 'bulbs') || (pv.eyes && pv.eyes.vis.k === 'lantern')) hole(c.x, c.y, 100 + c.radius, 0.75);
      }
      const Hn = G.homeNest; hole(Hn.x, Hn.y, 150, 0.6);
      for (let i = 0; i < FX.list.length; i++) { const p = FX.list[i]; if (p.type === 'glow') hole(p.x, p.y, 26, 0.5); }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(lc, 0, 0, w, h);
    },

    drawRain(ctx, dt) {
      const a = G.rain, w = R.w, h = R.h, n = Math.round((R.quality === 'low' ? 40 : 90) * a);
      ctx.strokeStyle = `rgba(200,220,240,${0.28 * a})`; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sx = (U.hash(i, 3, 1) % 10000) / 10000, sp = 900 + (U.hash(i, 5, 2) % 500);
        const x = ((sx * (w + 200) + R.t * 160) % (w + 200)) - 100, y = ((U.hash(i, 9, 4) % 1000) / 1000 * h + R.t * sp) % (h + 40) - 20;
        ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
      }
      ctx.stroke();
      if (Math.random() < dt * 30 * a) { const v = R.view; FX.add('ripple', v.x0 + Math.random() * (v.x1 - v.x0), v.y0 + Math.random() * (v.y1 - v.y0), { size: 7, life: 0.5 }); }
    },

    /** Setas na borda da tela apontando para o ninho e para o objetivo. */
    compass(ctx) {
      if (G.cine) return;
      const ms = G.markers(), w = R.w, h = R.h, m = 34;
      for (const mk of ms) {
        const p = R.toScreen(mk.x, mk.y);
        if (p.x > m && p.x < w - m && p.y > m + 30 && p.y < h - m) continue;
        const a = Math.atan2(p.y - h / 2, p.x - w / 2);
        const ex = U.clamp(p.x, m + 6, w - m - 6), ey = U.clamp(p.y, m + 64, h - m - 70);
        const col = mk.kind === 'home' ? '#ffffff' : mk.kind === 'fossil' ? '#ffe9a8' : '#ffd76a';
        ctx.fillStyle = 'rgba(14,22,20,0.72)'; ctx.beginPath(); ctx.arc(ex, ey, 17, 0, TAU); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * 27, ey + Math.sin(a) * 27); ctx.lineTo(ex + Math.cos(a + 0.5) * 18, ey + Math.sin(a + 0.5) * 18); ctx.lineTo(ex + Math.cos(a - 0.5) * 18, ey + Math.sin(a - 0.5) * 18); ctx.fill();
        Icons.draw(ctx, mk.kind === 'home' ? 'nest' : mk.kind === 'fossil' ? 'bone' : 'paw', ex, ey, 18, col);
        const d = Math.round(U.dist(G.player.x, G.player.y, mk.x, mk.y) / 10);
        ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(d + ' m', ex, ey + 27); ctx.fillStyle = '#fff'; ctx.fillText(d + ' m', ex, ey + 27);
      }
    },

    /** Vida ambiente: vaga-lumes à noite, folhas e pólen de dia. */
    ambient(dt) {
      if (!FG.Settings.data.particles || R.quality === 'low') return;
      const v = R.view, W = G.world;
      if (Math.random() < dt * (G.night > 0.5 ? 5 : 1.2)) {
        const x = v.x0 + Math.random() * (v.x1 - v.x0), y = v.y0 + Math.random() * (v.y1 - v.y0), b = W.biomeAt(x, y);
        if (G.night > 0.5) { if (b === B.FOREST || b === B.SWAMP || b === B.GRASS) FX.add('glow', x, y); }
        else if (b === B.FOREST || b === B.GRASS) FX.add('leafp', x, y, { col: b === B.FOREST ? '#8fbf5a' : '#f2e9a0', size: 6, life: 2.4 });
      }
    },

    // ---------- minimapa e mapa-múndi ----------
    minimap(mctx, size) {
      const W = G.world, P = G.player;
      if (!W || !P) return;
      const map = W.mapCanvas(), range = 1500, k = W.GW / W.SIZE, r = size / 2, sc = size / (range * 2);
      mctx.clearRect(0, 0, size, size);
      mctx.save(); mctx.beginPath(); mctx.arc(r, r, r - 1, 0, TAU); mctx.clip();
      mctx.fillStyle = '#1b4e7a'; mctx.fillRect(0, 0, size, size);
      mctx.imageSmoothingEnabled = true;
      mctx.drawImage(map, (P.x - range) * k, (P.y - range) * k, range * 2 * k, range * 2 * k, 0, 0, size, size);
      const pt = (x, y) => [r + (x - P.x) * sc, r + (y - P.y) * sc];
      const H = G.homeNest;
      for (const n of W.nests) {
        if (!n.found) continue;
        const p = pt(n.x, n.y); if (p[0] < -6 || p[1] < -6 || p[0] > size + 6 || p[1] > size + 6) continue;
        const st = G.rel(G.fauna.byId[n.sp]).status;
        mctx.fillStyle = 'rgba(0,0,0,0.6)'; mctx.beginPath(); mctx.arc(p[0], p[1], 5, 0, TAU); mctx.fill();
        mctx.fillStyle = st === 'ally' ? REL_COL.ally : st === 'extinct' ? REL_COL.extinct : FG.Species.NICHES[G.fauna.byId[n.sp].niche].react === 'hunter' ? REL_COL.hostile : REL_COL.neutral;
        mctx.beginPath(); mctx.arc(p[0], p[1], 3.6, 0, TAU); mctx.fill();
      }
      const radar = 320 + 110 * P.stats.sense;
      for (const c of G.creatures) {
        if (c.dead || c === P || c.baby || U.dist2(c.x, c.y, P.x, P.y) > radar * radar) continue;
        const p = pt(c.x, c.y);
        mctx.fillStyle = REL_COL[R.attitude(c)]; mctx.beginPath(); mctx.arc(p[0], p[1], c.sp.isTitan ? 4 : 2, 0, TAU); mctx.fill();
      }
      for (const f of W.fossils) { if (f.taken || U.dist2(f.x, f.y, P.x, P.y) > radar * radar) continue; const p = pt(f.x, f.y); mctx.fillStyle = '#fff3c4'; mctx.fillRect(p[0] - 2, p[1] - 2, 4, 4); }
      let hp = pt(H.x, H.y);
      const hd = Math.hypot(hp[0] - r, hp[1] - r);
      if (hd > r - 9) { hp = [r + (hp[0] - r) / hd * (r - 9), r + (hp[1] - r) / hd * (r - 9)]; }
      Icons.draw(mctx, 'nest', hp[0], hp[1], 13, '#ffffff');
      mctx.translate(r, r); mctx.rotate(P.angle);
      mctx.fillStyle = '#fff'; mctx.strokeStyle = '#10201a'; mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.moveTo(7, 0); mctx.lineTo(-5, 5); mctx.lineTo(-2, 0); mctx.lineTo(-5, -5); mctx.closePath(); mctx.fill(); mctx.stroke();
      mctx.restore();
      if (G.night > 0.3) { mctx.fillStyle = `rgba(8,14,40,${G.night * 0.35})`; mctx.beginPath(); mctx.arc(r, r, r - 1, 0, TAU); mctx.fill(); }
    },
    /** Mapa-múndi com névoa de exploração e marcadores. Devolve a lista de pontos clicáveis. */
    worldMap(mctx, size) {
      const W = G.world, P = G.player, map = W.mapCanvas(), sc = size / W.SIZE, E = W.EXP;
      mctx.clearRect(0, 0, size, size);
      mctx.imageSmoothingEnabled = true;
      mctx.drawImage(map, 0, 0, size, size);
      if (!R.fog) { R.fog = document.createElement('canvas'); R.fog.width = R.fog.height = E; }
      if (R.fogDirty) {
        const fx = R.fog.getContext('2d'), img = fx.createImageData(E, E), d = img.data;
        for (let i = 0; i < E * E; i++) { d[i * 4] = 14; d[i * 4 + 1] = 20; d[i * 4 + 2] = 30; d[i * 4 + 3] = W.explored[i] ? 0 : 236; }
        fx.putImageData(img, 0, 0); R.fogDirty = false;
      }
      mctx.drawImage(R.fog, 0, 0, size, size);
      const pts = [], H = G.homeNest;
      const mark = (x, y, icon, col, data) => {
        const px = x * sc, py = y * sc;
        mctx.fillStyle = 'rgba(10,16,14,0.75)'; mctx.beginPath(); mctx.arc(px, py, 9, 0, TAU); mctx.fill();
        Icons.draw(mctx, icon, px, py, 12, col);
        if (data) pts.push(Object.assign({ px, py }, data));
      };
      for (const n of W.nests) {
        if (!n.found) continue;
        const sp = G.fauna.byId[n.sp], st = G.rel(sp).status;
        const col = st === 'ally' ? REL_COL.ally : st === 'extinct' ? REL_COL.extinct : FG.Species.NICHES[sp.niche].react === 'hunter' ? REL_COL.hostile : REL_COL.neutral;
        mark(n.x, n.y, st === 'extinct' ? 'skull' : st === 'ally' ? 'heart' : 'paw', col, { kind: 'nest', nest: n, sp, travel: st === 'ally' });
      }
      for (const f of W.fossils) if (!f.taken && W.explored[Math.floor(f.y / W.SIZE * E) * E + Math.floor(f.x / W.SIZE * E)]) mark(f.x, f.y, 'bone', '#fff3c4', null);
      for (const t of W.titanSpots) if (t.alive && G.rel(G.fauna.byId[t.sp]).seen) mark(t.x, t.y, 'alert', '#ff9a5a', { kind: 'titan', sp: G.fauna.byId[t.sp] });
      W.ownSites.forEach((s, i) => { if (i < G.home) mark(s.x, s.y, 'nest', '#9aa0a8', null); });
      mark(H.x, H.y, 'nest', '#ffffff', { kind: 'home', travel: true });
      const px = P.x * sc, py = P.y * sc;
      mctx.save(); mctx.translate(px, py); mctx.rotate(P.angle);
      mctx.fillStyle = '#ffffff'; mctx.strokeStyle = '#10201a'; mctx.lineWidth = 2;
      mctx.beginPath(); mctx.moveTo(10, 0); mctx.lineTo(-7, 7); mctx.lineTo(-3, 0); mctx.lineTo(-7, -7); mctx.closePath(); mctx.fill(); mctx.stroke();
      mctx.restore();
      return pts;
    },

    // ---------- fundo do menu: criaturas passeando ----------
    menuInit(seed) {
      const fauna = FG.Species.generate(seed), r = U.rng(seed), M = R.menu = { list: [], t: 0 };
      const pool = fauna.list.filter((s) => !s.isTitan);
      for (let i = 0; i < 9; i++) {
        const sp = pool[(r() * pool.length) | 0];
        const c = new FG.Creature(sp, r() * 1400 - 200, r() * 900 - 100);
        c.goal = { x: r() * 1200, y: r() * 800 }; c.speedMul = 0.45; M.list.push(c);
      }
    },
    menuFrame(dt) {
      const ctx = R.ctx, M = R.menu, w = R.w, h = R.h, dpr = R.dpr;
      if (!M) return;
      M.t += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#5f9a58'); g.addColorStop(1, '#3d7350');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const k = Math.max(w / 1200, h / 800) * 1.05;
      ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      for (let i = 0; i < 70; i++) {
        const x = U.hash(i, 1, 9) % 1400 - 100, y = U.hash(i, 2, 9) % 900 - 50, s = 18 + U.hash(i, 3, 9) % 50;
        ctx.fillStyle = i % 3 ? 'rgba(120,180,90,0.16)' : 'rgba(40,80,50,0.16)'; ctx.beginPath(); ctx.ellipse(x, y, s * 1.6, s, 0, 0, TAU); ctx.fill();
      }
      const L = M.list.slice().sort((a, b) => a.y - b.y);
      for (const c of L) {
        const d = U.dist(c.x, c.y, c.goal.x, c.goal.y);
        if (d < 30 || (c.wait = (c.wait || 0) - dt) > 0) { c.mx = c.my = 0; if (d < 30) { c.goal = { x: Math.random() * 1300 - 50, y: Math.random() * 860 - 30 }; c.wait = 1 + Math.random() * 3; if (Math.random() < 0.3) c.play(['sing', 'dance', 'charm', 'pose'][(Math.random() * 4) | 0], 1.3); } }
        else { const a = Math.atan2(c.goal.y - c.y, c.goal.x - c.x); c.mx = Math.cos(a); c.my = Math.sin(a); }
        c.update(dt, null);
        Draw.creature(ctx, c, {});
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(10,24,20,0.25)'); vg.addColorStop(1, 'rgba(6,16,14,0.82)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    },
  };

  let pt = 0;
  /** Perfil de desenho (desenvolvimento): com R.prof = {}, acumula ms por etapa. */
  function mark(name) { const n = performance.now(); R.prof[name] = (R.prof[name] || 0) + n - pt; pt = n; }
  function push(y, k, ref) { const o = ord[ordN] || (ord[ordN] = { y: 0, k: 0, ref: null }); o.y = y; o.k = k; o.ref = ref; ordN++; }
  function sortOrd() {
    // ordenação por inserção: a lista muda pouco de um quadro para o outro
    for (let i = 1; i < ordN; i++) {
      const o = ord[i], y = o.y;
      let j = i - 1;
      while (j >= 0 && ord[j].y > y) { ord[j + 1] = ord[j]; j--; }
      ord[j + 1] = o;
    }
  }
})(window.FG = window.FG || {});
