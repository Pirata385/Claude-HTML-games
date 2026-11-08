// Niryk — world renderer in 2.5D: painterly floors, tall walls drawn in two passes (faces looking into rooms
// behind the actors, the rest in front with x-ray), scenery props with cast shadows, a multiply lightmap
// (dark ambient + warm/coloured light sources) and bright projectiles/effects composited on top.
'use strict';
(function () {
  const N = window.N, G = N.G, S = N.S, T = N.TILE, TS = N.TS, RS = N.RS, TAU = Math.PI * 2;
  const R = N.R = {};
  const WH = R.WH = 24; // wall height in world units
  let lcv = null, lctx = null, aoTop = null, aoSide = null;

  R.init = (ctx) => {
    // Sprites painted at RS px per world unit draw at their world size when given only a position.
    const raw = ctx.drawImage.bind(ctx);
    ctx.drawImage = function (img, a, b) { if (arguments.length === 3 && img && img.rs) return raw(img, a, b, img.W, img.H); return raw.apply(null, arguments); };
    lcv = document.createElement('canvas'); lctx = lcv.getContext('2d');
    aoTop = document.createElement('canvas'); aoTop.width = 2; aoTop.height = 24;
    let x = aoTop.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 24); g.addColorStop(0, 'rgba(4,2,10,0.62)'); g.addColorStop(1, 'rgba(4,2,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 2, 24);
    aoSide = document.createElement('canvas'); aoSide.width = 12; aoSide.height = 2;
    x = aoSide.getContext('2d'); g = x.createLinearGradient(0, 0, 12, 0); g.addColorStop(0, 'rgba(4,2,10,0.45)'); g.addColorStop(1, 'rgba(4,2,10,0)'); x.fillStyle = g; x.fillRect(0, 0, 12, 2);
  };
  R.resize = (gcv) => { gcv.width = Math.round(G.VW * RS); gcv.height = Math.round(G.VH * RS); lcv.width = Math.ceil(G.VW); lcv.height = Math.ceil(G.VH); };

  // ================================================================ level dressing
  const OBST = { overworld: ['bush', 'bush', 'rock', 'stump', 'bush', 'rock'], reverso: ['crystals', 'pillar', 'statue', 'mirror', 'crystals'], wasteland: ['rockPile', 'sandPillar', 'crate', 'rockPile', 'rib'], training: ['crate', 'barrel'], lobby: ['barrel', 'table'],
    pantano: ['mangue', 'juncos', 'cogumelosAzuis', 'juncos', 'stump'], gelo: ['cristalGelo', 'monteNeve', 'pilarGelo', 'monteNeve'], caldeira: ['obsidianaPico', 'cranios', 'rockPile', 'obsidianaPico'] };
  const CORNER = { overworld: 'stoneLantern', reverso: 'candles', wasteland: 'brazier', training: 'brazier', lobby: 'paperLantern', pantano: 'lanternaPantano', gelo: 'cristalGelo', caldeira: 'ventLava' };
  const BG = { overworld: { p: 0.5, names: ['tree'] }, reverso: { p: 0.22, names: ['crystals', 'pillar', 'statue'] }, wasteland: { p: 0.25, names: ['sandPillar', 'rib', 'rockPile'] }, pantano: { p: 0.45, names: ['mangue', 'mangue', 'juncos'] }, gelo: { p: 0.3, names: ['pilarGelo', 'cristalGelo'] }, caldeira: { p: 0.3, names: ['obsidianaPico', 'obsidianaPico', 'cranios'] } };
  const WALLDECO = { training: { p: 0.3, pick: (r) => (r < 0.2 ? 'torch' : 'banner') }, lobby: { p: 0.12, pick: () => 'banner' }, reverso: { p: 0.22, pick: (r) => (r < 0.15 ? 'window' : 'torch') }, wasteland: { p: 0.13, pick: () => 'torch' }, gelo: { p: 0.1, pick: () => 'torch' } };
  const LIGHT = { stoneLantern: ['#ffc870', 66, -19], candles: ['#ffd890', 52, -16], crystals: ['#b07aff', 52, -12], brazier: ['#ff9a40', 74, -15], paperLantern: ['#ffb060', 74, -21], torch: ['#ffa040', 62, -12], window: ['#d05aff', 46, -10], lanternaPantano: ['#9aff6a', 64, -16], cristalGelo: ['#7ad8ff', 60, -14], ventLava: ['#ff7a2a', 76, -4] };
  const DOORGLOW = { overworld: '#9aff6a', reverso: '#d05aff', wasteland: '#ff6a3a', pantano: '#9aff4a', gelo: '#7ad8ff', caldeira: '#ff8a2a' };
  const addLight = (map, name, x, y) => { const L = LIGHT[name]; if (L) map.lights.push({ x, y: y + L[2], r: L[1], c: L[0], ph: Math.random() * 10 }); };
  N.deco = (name) => S.deco[name];

  R.dress = (map, theme, o = {}) => {
    const W = map.W, h = (x, y, s = 0) => N.hash2(x * 7 + s * 101, y * 13 + s * 37);
    map.deco = new Map(); map.bg = []; map.patches = []; map.lights = []; map.wallDeco = new Map(); map.hidden = map.hidden || new Set();
    const pool = OBST[theme] || ['crate'];
    for (let i = 0; i < map.tiles.length; i++) if (map.tiles[i] === T.BLOCK && !map.hidden.has(i)) { const x = i % W, y = (i / W) | 0; map.deco.set(i, pool[Math.floor(h(x, y) * pool.length)]); }
    const corner = o.corner === undefined ? CORNER[theme] : o.corner;
    for (const room of map.rooms) {
      if (corner && room.w >= 9 && room.h >= 9) {
        const cs = [[room.x0 + 1, room.y0 + 1], [room.x0 + room.w - 2, room.y0 + 1]];
        if (room.h >= 13 || room.type === 'boss') cs.push([room.x0 + 1, room.y0 + room.h - 2], [room.x0 + room.w - 2, room.y0 + room.h - 2]);
        for (const [x, y] of cs) { const i = y * W + x; if (map.tiles[i] !== T.FLOOR) continue; map.tiles[i] = T.BLOCK; map.deco.set(i, corner); addLight(map, corner, (x + 0.5) * TS, (y + 1) * TS); }
      }
      if (o.patches !== false) {
        const n = room.type === 'boss' ? 3 : 1 + Math.floor(h(room.x0, room.y0, 5) * 2);
        for (let k = 0; k < n; k++) {
          const pt = { x: (room.x0 + 3 + h(room.id, k, 1) * (room.w - 6)) * TS, y: (room.y0 + 3 + h(room.id, k, 2) * (room.h - 6)) * TS, v: Math.floor(h(room.id, k, 3) * 3) };
          map.patches.push(pt);
          if (theme === 'caldeira') map.lights.push({ x: pt.x, y: pt.y, r: 54, c: '#ff6a1a', ph: Math.random() * 10 });
        }
      }
    }
    const wd = WALLDECO[theme], bg = BG[theme];
    for (let y = 1; y < map.H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (map.tiles[i] !== T.WALL) continue;
      const below = map.tiles[i + W];
      if (below !== T.FLOOR && below !== T.BLOCK) continue;
      if (wd && map.tiles[i - 1] === T.WALL && map.tiles[i + 1] === T.WALL && h(x, y, 9) < wd.p && !map.wallDeco.has(i - 1)) {
        const k = wd.pick(h(x, y, 8)); map.wallDeco.set(i, k);
        if (k === 'torch' || k === 'window') addLight(map, k, (x + 0.5) * TS, y * TS + 6);
      }
      if (bg && h(x, y, 4) < bg.p) map.bg.push({ name: bg.names[Math.floor(h(x, y, 6) * bg.names.length)], x: (x + 0.5) * TS + (h(x, y, 7) - 0.5) * 10, y: y * TS - WH + 10 });
    }
    if (theme === 'overworld') {
      const near = (x, y) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) { const t = N.tileAt(map, x + dx, y + dy); if (t === T.FLOOR || t === T.DOOR) return true; } return false; };
      for (let y = 0; y < map.H; y += 2) for (let x = 0; x < W; x += 2) if (map.tiles[y * W + x] === T.VOID && h(x, y, 11) < 0.35 && !near(x, y)) map.bg.push({ name: 'tree', x: x * TS + h(x, y, 12) * 12, y: y * TS + 20 });
    }
    map.bg.sort((a, b) => a.y - b.y);
  };

  // ================================================================ drawing helpers
  const sn = N.snap;
  R.castShadow = (ctx, spr, x, by, a = 0.34) => {
    const sil = N.silhouette(spr, '#05020a');
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, by); ctx.transform(1, 0, -0.55, -0.4, 0, 0); ctx.drawImage(sil, -spr.W / 2, -spr.H, spr.W, spr.H); ctx.restore();
  };
  R.prop = (ctx, spr, x, by) => ctx.drawImage(spr, sn(x - spr.W / 2), sn(by - spr.H));
  R.sprProp = (spr) => (ctx, pr) => { N.drawShadow(ctx, pr.x, pr.y, spr.W * 0.4); R.prop(ctx, spr, pr.x, pr.y + 2); };

  R.drawPortal = (ctx, pr) => {
    const t = G.time, x = pr.x, y = pr.y - 13, lobby = G.scene === 'lobby';
    const cols = pr.cols || (lobby ? ['#ffd166', '#c66bff', '#5fe3d6'] : ['#7cf07a', '#5fe3d6', '#ffffff']);
    N.drawShadow(ctx, x, pr.y + 2, 16);
    ctx.fillStyle = '#1a1424'; ctx.beginPath(); ctx.ellipse(x, y, 14, 18, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#120a1c' : cols[i % 3]; ctx.beginPath(); ctx.ellipse(x, y, 11.5 - i * 2 + Math.sin(t * 3 + i) * 0.6, 15.5 - i * 2.8 + Math.sin(t * 3 + i) * 0.6, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#5a5468'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 14, 18, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#9a94a8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 14.5, 18.5, 0, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = t * 2 + i * TAU / 6; ctx.fillStyle = cols[i % 3]; ctx.fillRect(sn(x + Math.cos(a) * 17), sn(y + Math.sin(a) * 21), 1.5, 1.5); }
    if (Math.random() < 0.3) N.part(x + N.rand(-8, 8), y + N.rand(-10, 10), 0, -18, cols[N.randi(0, 2)], 0.7, 1);
  };
  R.drawCampfire = (ctx, pr) => {
    const x = pr.x, y = pr.y;
    ctx.drawImage(S.misc.campfire, sn(x - 9.5), sn(y - 7));
    for (let i = 0; i < 3; i++) { const h = 10 + Math.sin(G.time * 12 + i * 2) * 3; ctx.fillStyle = ['#ff6a2a', '#ffb03a', '#fff2a0'][i]; ctx.beginPath(); ctx.moveTo(x - 6 + i * 2, y - 2); ctx.quadraticCurveTo(x - 4 + i, y - h * 0.6, x + Math.sin(G.time * 9 + i) * 1.5, y - 2 - h + i * 2.5); ctx.quadraticCurveTo(x + 4 - i, y - h * 0.6, x + 6 - i * 2, y - 2); ctx.fill(); }
    if (Math.random() < 0.4) N.part(x + N.rand(-3, 3), y - 9, N.rand(-5, 5), -30, '#ffb03a', 0.8, 1);
  };
  R.drawRack = (ctx, pr) => {
    N.drawShadow(ctx, pr.x, pr.y, 14);
    ctx.fillStyle = '#3a2418'; ctx.fillRect(sn(pr.x - 15), sn(pr.y - 22), 30, 2.5); ctx.fillRect(sn(pr.x - 15), sn(pr.y - 22), 2, 24); ctx.fillRect(sn(pr.x + 13), sn(pr.y - 22), 2, 24);
    ['espada_bronze', 'machado', 'katana'].forEach((id, i) => { const s = S.wp[id]; ctx.save(); ctx.translate(sn(pr.x - 8 + i * 8), sn(pr.y - 1)); ctx.rotate(-Math.PI / 2); ctx.drawImage(s, 0, -s.H / 2, s.W, s.H); ctx.restore(); });
  };
  R.drawPickup = (ctx, k) => {
    const y = k.y - k.z;
    if (k.type === 'coin') { const f = Math.floor((G.time * 8 + k.x) % 3); ctx.drawImage(S.misc.coin[f], sn(k.x - 3), sn(y - 6)); }
    else if (k.type === 'crystal') { N.drawShadow(ctx, k.x, k.y + 1, 3); ctx.drawImage(S.misc.crystal[Math.floor(G.time * 3 + k.x) % 2], sn(k.x - 3.5), sn(y - 11 + Math.sin(G.time * 4 + k.x) * 1.5)); }
    else if (k.type === 'potion') { N.drawShadow(ctx, k.x, k.y + 1, 4); ctx.drawImage(S.misc.potion, sn(k.x - 4.5), sn(y - 11)); }
  };
  function drawAreas(ctx) {
    for (const z of G.areas) {
      if (z.kind === 'fire') {
        const k = z.life / z.max; ctx.globalAlpha = Math.min(1, k * 2) * 0.85;
        ctx.fillStyle = '#c0300e'; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.55, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(z.x, z.y - 1, z.r * 0.65, z.r * 0.35, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.ellipse(z.x, z.y - 1.5, z.r * 0.3, z.r * 0.16, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        if (Math.random() < 0.1) N.part(z.x + N.rand(-4, 4), z.y, 0, -25, '#ffe066', 0.4, 1);
      } else if (z.kind === 'poison') {
        const k = z.life / z.max; ctx.globalAlpha = Math.min(1, k * 2) * 0.8;
        ctx.fillStyle = '#2a6a1a'; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6ad83a'; ctx.beginPath(); ctx.ellipse(z.x, z.y - 0.5, z.r * 0.7, z.r * 0.38, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        if (Math.random() < 0.12) { const a = Math.random() * TAU; N.part(z.x + Math.cos(a) * z.r * 0.5, z.y + Math.sin(a) * z.r * 0.3, 0, -12, '#b8ff7a', 0.5, 1); }
      } else if (z.kind === 'sand') {
        const k = z.life / z.max; ctx.globalAlpha = Math.min(1, k * 3) * 0.55;
        for (let i = 0; i < 3; i++) { ctx.strokeStyle = i % 2 ? '#e8c890' : '#c8955a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * (0.4 + i * 0.3), z.r * (0.25 + i * 0.18), G.time * (2 + i), 0, TAU * 0.7); ctx.stroke(); }
        ctx.globalAlpha = 1;
        if (Math.random() < 0.5) { const a = Math.random() * TAU; N.part(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r * 0.6, -Math.sin(a) * 40, Math.cos(a) * 25, '#e8c890', 0.5, 1); }
      } else if (z.draw) z.draw(ctx, z);
    }
  }
  function drawWallDeco(ctx, k, tx, ty) {
    const x = (tx + 0.5) * TS, faceTop = ty * TS + TS - WH;
    if (k === 'torch') { const s = S.deco.torch; ctx.drawImage(s, sn(x - s.W / 2), sn(faceTop + 5)); flame(ctx, x, faceTop + 5); }
    else if (k === 'window') { const s = S.deco.window; ctx.drawImage(s, sn(x - s.W / 2), sn(faceTop + 2)); }
    else if (k === 'banner') { const c = { lobby: '#c8463c', training: '#3a6ac8' }[G.theme] || '#8a3ad0'; const s = bannerSpr(c); ctx.drawImage(s, sn(x - s.W / 2), sn(faceTop + 2)); }
  }
  const banners = {}; const bannerSpr = (c) => banners[c] || (banners[c] = S.deco.wallBanner(c));
  function flame(ctx, x, y) {
    const h = 4 + Math.sin(G.time * 14 + x) * 1.2;
    ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(x - 2.5, y + 1); ctx.quadraticCurveTo(x, y - h, x + 2.5, y + 1); ctx.fill();
    ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.moveTo(x - 1, y + 1); ctx.quadraticCurveTo(x, y - h * 0.6, x + 1, y + 1); ctx.fill();
  }

  // ================================================================ the frame
  R.world = (ctx) => {
    const th = N.THEMES[G.theme] || N.THEMES.lobby, tl = S.tiles[G.theme] || S.tiles.lobby, map = G.map, cw = ctx.canvas.width, ch = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = th.void; ctx.fillRect(0, 0, cw, ch);
    if (G.scene === 'title') return R.titleBg(ctx);
    if (!map) return;
    const sa = G.shakeA || 0, ox = Math.round((G.camX + (sa ? N.rand(-sa, sa) * 0.5 : 0)) * RS) / RS, oy = Math.round((G.camY + (sa ? N.rand(-sa, sa) * 0.5 : 0)) * RS) / RS;
    R.ox = ox; R.oy = oy;
    ctx.setTransform(RS, 0, 0, RS, -ox * RS, -oy * RS);
    const W = map.W, x0 = Math.floor(ox / TS) - 1, y0 = Math.floor(oy / TS) - 1, x1 = x0 + Math.ceil(G.VW / TS) + 2, y1 = y0 + Math.ceil(G.VH / TS) + 4;
    const tile = (x, y) => N.tileAt(map, x, y), walk = (t) => t === T.FLOOR || t === T.DOOR || t === T.BLOCK;
    // void
    for (let vy = Math.floor(oy / 128) * 128; vy < oy + G.VH; vy += 128) for (let vx = Math.floor(ox / 128) * 128; vx < ox + G.VW; vx += 128) ctx.drawImage(tl.void, 0, 0, 256, 256, vx, vy, 128, 128);
    // floors + decals
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = tile(tx, ty); if (!walk(t)) continue;
      ctx.drawImage(tl.floor, (((tx % 8) + 8) % 8) * 32, (((ty % 8) + 8) % 8) * 32, 32, 32, tx * TS, ty * TS, TS, TS);
      if (t === T.FLOOR) { const h2 = N.hash2(tx + 77, ty + 31); if (h2 < 0.07) { const d = tl.decals[Math.floor(h2 * 997) % tl.decals.length]; ctx.drawImage(d, tx * TS + 2 + Math.floor(N.hash2(tx, ty) * 6), ty * TS + 2 + Math.floor(h2 * 50) % 6); } }
      if (t === T.DOOR) { ctx.fillStyle = 'rgba(8,4,14,0.25)'; ctx.fillRect(tx * TS, ty * TS, TS, TS); }
    }
    for (const pt of map.patches || []) { const s = tl.patches[pt.v]; if (pt.x + s.W / 2 < ox || pt.x - s.W / 2 > ox + G.VW || pt.y + s.H / 2 < oy || pt.y - s.H / 2 > oy + G.VH) continue; ctx.drawImage(s, sn(pt.x - s.W / 2), sn(pt.y - s.H / 2)); }
    // ambient occlusion along walls
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!walk(tile(tx, ty))) continue;
      if (tile(tx, ty - 1) === T.WALL) ctx.drawImage(aoTop, tx * TS, ty * TS, TS, 12);
      if (tile(tx - 1, ty) === T.WALL) ctx.drawImage(aoSide, tx * TS, ty * TS, 6, TS);
      if (tile(tx + 1, ty) === T.WALL) { ctx.save(); ctx.translate((tx + 1) * TS, ty * TS); ctx.scale(-1, 1); ctx.drawImage(aoSide, 0, 0, 6, TS); ctx.restore(); }
    }
    drawAreas(ctx);
    for (const f of G.fx) if (f.floor && f.draw) f.draw(ctx, Math.min(1, f.t / f.life), f);
    // scenery behind the walls
    for (const b of map.bg || []) { const s = S.deco[b.name]; if (!s || b.x + s.W < ox || b.x - s.W > ox + G.VW || b.y - s.H > oy + G.VH || b.y < oy - 10) continue; R.prop(ctx, s, b.x, b.y); }
    // phase A: walls whose face looks into a walkable area
    const front = [];
    for (let ty = y0 - 1; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tile(tx, ty) !== T.WALL) continue;
      const s = tile(tx, ty + 1);
      if (walk(s)) drawWall(ctx, tl, map, tx, ty, true); else front.push([tx, ty, s !== T.WALL]);
    }
    // locked doors: energy bars rising from the floor
    if (map.locked) {
      const glow = DOORGLOW[G.theme] || '#ffd166';
      for (const i of map.locked) {
        const tx = i % W, ty = (i / W) | 0; if (tx < x0 || tx > x1 || ty < y0 || ty > y1 + 2) continue;
        const bx = tx * TS, by = ty * TS + TS;
        ctx.globalAlpha = 0.28 + Math.sin(G.time * 6 + tx + ty) * 0.08; ctx.fillStyle = glow; ctx.fillRect(bx, by - WH, TS, WH); ctx.globalAlpha = 1;
        ctx.fillStyle = '#1a1424'; for (let k = 1.5; k < TS; k += 4.5) ctx.fillRect(bx + k, by - WH, 1.5, WH);
        ctx.fillStyle = glow; ctx.fillRect(bx, by - WH + ((G.time * 18 + tx * 3) % WH), TS, 0.8);
      }
    }
    // cast shadows of tall scenery
    const blocks = [];
    for (let ty = y0; ty <= y1 + 2; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tile(tx, ty) !== T.BLOCK) continue;
      const i = ty * W + tx; if (map.hidden && map.hidden.has(i)) continue;
      const name = (map.deco && map.deco.get(i)) || 'crate', s = S.deco[name] || S.deco.crate;
      R.castShadow(ctx, s, (tx + 0.5) * TS, ty * TS + TS - 2);
      blocks.push([ty * TS + TS - 2, s, (tx + 0.5) * TS]);
    }
    for (const pr of G.props) if (pr.spr && pr.cast !== false) R.castShadow(ctx, pr.spr, pr.x, pr.y + 2, 0.28);
    // y-sorted actors and props
    const list = [];
    for (const [y, s, x] of blocks) list.push([y, 5, s, x]);
    for (const pr of G.props) list.push([pr.y, 0, pr]);
    for (const k of G.pickups) list.push([k.y, 1, k]);
    for (const e of G.enemies) list.push([e.y + (e.boss && e.id === 'kharun' ? -999 : 0), 2, e]);
    for (const a of G.allies) list.push([a.y, 3, a]);
    if (G.p && (G.p.alive || G.dying)) list.push([G.p.y, 4, G.p]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [y, k, o, x] of list) {
      if (k === 5) R.prop(ctx, o, x, y + 1);
      else if (k === 0) { if (o.draw) o.draw(ctx, o); }
      else if (k === 1) R.drawPickup(ctx, o);
      else if (k === 2) N.drawEnemy(ctx, o);
      else if (k === 3) { if (o.draw) o.draw(ctx, o); }
      else if (G.p.alive) N.drawPlayer(ctx, o);
    }
    // phase C: walls in front of the actors (x-ray where they hide the hero)
    const p = G.p, px0 = p ? p.x - 9 : 0, py0 = p ? p.y - 22 : 0;
    for (const [tx, ty, face] of front) {
      const top = ty * TS - WH, bot = ty * TS + TS;
      const hide = p && tx * TS < px0 + 18 && tx * TS + TS > px0 && top < py0 + 24 && bot > py0;
      if (hide) ctx.globalAlpha = 0.45;
      drawWall(ctx, tl, map, tx, ty, face);
      ctx.globalAlpha = 1;
    }
    // lighting
    R.light(ctx, ox, oy);
    // bright layer: projectiles, effects, particles
    ctx.setTransform(RS, 0, 0, RS, -ox * RS, -oy * RS);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.projs) { const c = b.team === 'e' ? (b.glow || G.bulletColor || '#ff6a3a') : (b.glow || '#9fd8ff'); ctx.globalAlpha = 0.5; ctx.drawImage(N.glow(c), b.x - 9, b.y - 9, 18, 18); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const b of G.projs) N.drawProj(ctx, b);
    for (const f of G.fx) if (!f.floor && f.draw) f.draw(ctx, Math.min(1, f.t / f.life), f);
    if (N.drawAimIndicators) N.drawAimIndicators(ctx);
    for (const q of G.parts) { ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, q.size * 0.75, q.size * 0.75); }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    R.post(ctx, cw, ch);
  };

  function drawWall(ctx, tl, map, tx, ty, face) {
    const i = ty * map.W + tx, v = Math.floor(N.hash2(tx, ty * 3) * 4), x = tx * TS, top = ty * TS - WH;
    if (face) {
      ctx.drawImage(tl.faces[v], 0, 0, 32, 48, x, ty * TS + TS - WH, TS, WH);
      const d = map.wallDeco && map.wallDeco.get(i); if (d) drawWallDeco(ctx, d, tx, ty);
    }
    ctx.drawImage(tl.cap, 0, 0, 32, 32, x, top, TS, TS);
    const t = N.tileAt;
    if (t(map, tx, ty - 1) !== T.WALL) { ctx.fillStyle = 'rgba(255,240,220,0.16)'; ctx.fillRect(x, top, TS, 0.5); }
    if (t(map, tx - 1, ty) !== T.WALL) { ctx.fillStyle = 'rgba(255,240,220,0.1)'; ctx.fillRect(x, top, 0.5, TS); }
    if (t(map, tx + 1, ty) !== T.WALL) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + TS - 0.5, top, 0.5, TS); }
    if (face) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, top + TS - 0.5, TS, 0.5); }
  }

  // Multiply lightmap: ambient darkness, then every light source added on top.
  R.light = (ctx, ox, oy) => {
    const th = N.THEMES[G.theme] || N.THEMES.lobby, map = G.map, VW = G.VW, VH = G.VH;
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
    lctx.fillStyle = th.ambient; lctx.fillRect(0, 0, lcv.width, lcv.height);
    lctx.globalCompositeOperation = 'lighter';
    lctx.setTransform(1, 0, 0, 1, -ox, -oy);
    const add = (x, y, r, c, a = 1) => { if (x + r < ox || x - r > ox + VW || y + r < oy || y - r > oy + VH) return; lctx.globalAlpha = a; lctx.drawImage(N.glow(c), x - r, y - r, r * 2, r * 2); };
    const p = G.p;
    if (p) add(p.x, p.y - 8, 110, '#fff0dc', 0.8);
    for (const L of map.lights || []) add(L.x, L.y, L.r * (1 + Math.sin(G.time * 9 + L.ph) * 0.04 + Math.sin(G.time * 23 + L.ph * 3) * 0.02), L.c, 0.95);
    for (const pr of G.props) if (pr.light) add(pr.x, pr.y + (pr.light[2] || -10), pr.light[1], pr.light[0], pr.light[3] || 0.9);
    for (const b of G.projs) add(b.x, b.y, b.team === 'e' ? 16 : 20, b.team === 'e' ? (G.bulletColor || '#ff6a3a') : (b.glow || '#9fd8ff'), 0.55);
    for (const f of G.flashes || []) add(f.x, f.y, f.r, f.c, Math.max(0, 1 - f.t / f.life));
    for (const k of G.pickups) if (k.type === 'crystal') add(k.x, k.y - 6, 14, '#5fe3d6', 0.6);
    const BL = { nyxara: '#d05aff', kharun: '#ffb02e', musgo: '#c8ff9a', gorgulho: '#9aff4a', glacia: '#9fe8ff', ignavar: '#ff7a2a' };
    for (const e of G.enemies) if (e.boss) add(e.x, e.y, 70, BL[e.id] || '#ffffff', 0.45);
    for (const z of G.areas) if (z.kind === 'fire') add(z.x, z.y, 22, '#ff8a2a', 0.5); else if (z.kind === 'poison') add(z.x, z.y, 20, '#6ad83a', 0.35);
    lctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lcv, 0, 0, lcv.width, lcv.height, 0, 0, ctx.canvas.width * lcv.width / VW, ctx.canvas.height * lcv.height / VH);
    ctx.imageSmoothingEnabled = false; ctx.globalCompositeOperation = 'source-over';
    // bloom around the brightest sources
    ctx.setTransform(RS, 0, 0, RS, -ox * RS, -oy * RS); ctx.globalCompositeOperation = 'lighter';
    for (const L of map.lights || []) { if (L.x < ox - 20 || L.x > ox + VW + 20 || L.y < oy - 20 || L.y > oy + VH + 20) continue; ctx.globalAlpha = 0.22; ctx.drawImage(N.glow(L.c), L.x - 12, L.y - 12, 24, 24); }
    for (const pr of G.props) if (pr.light) { ctx.globalAlpha = 0.18; ctx.drawImage(N.glow(pr.light[0]), pr.x - 14, pr.y + (pr.light[2] || -10) - 14, 28, 28); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  N.flash = (x, y, r, c, life = 0.25) => { (G.flashes = G.flashes || []).push({ x, y, r, c, life, t: 0 }); };
  R.update = (dt) => { if (G.flashes) { for (const f of G.flashes) f.t += dt; G.flashes = G.flashes.filter((f) => f.t < f.life); } };

  // Screen-space finish: vignette, colour grade, hurt and death tints.
  R.post = (ctx, W, H) => {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
    const edge = { reverso: 'rgba(24,4,44,0.62)', wasteland: 'rgba(36,14,4,0.5)', overworld: 'rgba(2,10,6,0.55)', pantano: 'rgba(2,14,12,0.6)', gelo: 'rgba(4,14,30,0.5)', caldeira: 'rgba(40,6,2,0.55)' }[G.theme] || 'rgba(6,3,10,0.45)';
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, edge);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (G.theme === 'wasteland' && Math.random() < 0.5) N.part(G.camX + G.VW + 4, G.camY + Math.random() * G.VH, -N.rand(40, 90), N.rand(-5, 5), 'rgba(232,200,144,0.5)', 4, 1);
    if (G.theme === 'overworld' && Math.random() < 0.08) N.part(G.camX + Math.random() * G.VW, G.camY + Math.random() * G.VH, N.rand(-6, 6), N.rand(-8, -2), '#d8ff9a', 3, 1);
    if (G.theme === 'pantano' && Math.random() < 0.15) N.part(G.camX + Math.random() * G.VW, G.camY + Math.random() * G.VH, N.rand(-8, 8), N.rand(-6, 6), '#c8ff6a', 2.5, 1);
    if (G.theme === 'gelo' && Math.random() < 0.6) N.part(G.camX + Math.random() * (G.VW + 60) - 30, G.camY - 2, N.rand(-12, 4), N.rand(14, 28), '#ffffff', 6, 1);
    if (G.theme === 'caldeira' && Math.random() < 0.35) N.part(G.camX + Math.random() * G.VW, G.camY + G.VH + 2, N.rand(-6, 6), -N.rand(14, 30), Math.random() < 0.5 ? '#ff8a2a' : '#ffd060', 5, 1);
    if (G.theme === 'reverso' && Math.random() < 0.12) N.part(G.camX + Math.random() * G.VW, G.camY + G.VH, N.rand(-4, 4), -N.rand(8, 18), '#d05aff', 5, 1);
    if (G.hurtFlash > 0) { ctx.fillStyle = `rgba(255,40,60,${G.hurtFlash * 0.7})`; ctx.fillRect(0, 0, W, H); }
    if (G.dying) { ctx.fillStyle = `rgba(20,0,10,${Math.min(0.6, G.dyingT * 0.4)})`; ctx.fillRect(0, 0, W, H); }
  };

  // Title backdrop: night sky, the broken planet in three layers, the four heroes by a campfire.
  R.titleBg = (ctx) => {
    const W = G.VW, H = G.VH, t = G.time;
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#05040e'); sky.addColorStop(1, '#1a1030'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) { const x = N.hash2(i, 1) * W, y = N.hash2(i, 2) * H * 0.8; ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.7 * Math.abs(Math.sin(t * 0.8 + i))})`; ctx.fillRect(x, y, 0.5 + (i % 5 === 0) * 0.5, 0.5 + (i % 5 === 0) * 0.5); }
    const px = W * 0.5, py = H * 1.3, Rr = H * 0.95;
    const layers = [['#2f5a2a', 1], ['#4f8a3c', 0.99], ['#2a1a4a', 0.93], ['#5a3a9a', 0.918], ['#5a3418', 0.86], ['#c8955a', 0.848], ['#ff8a3a', 0.8]];
    for (const [c, k] of layers) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, Rr * k, Math.PI, TAU); ctx.fill(); }
    const core = ctx.createRadialGradient(px, py, 0, px, py, Rr * 0.8); core.addColorStop(0, '#fff8d0'); core.addColorStop(1, '#ffb050'); ctx.fillStyle = core; ctx.beginPath(); ctx.arc(px, py, Rr * 0.78 + Math.sin(t * 2), Math.PI, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { const a = t * 0.1 + i * 2.1; ctx.fillStyle = ['#e8e0ff', '#ffc8a0', '#a0e8ff'][i]; ctx.beginPath(); ctx.arc(W * 0.15 + i * W * 0.33 + Math.cos(a) * 8, H * 0.12 + i * 6, 4 + i, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#120a1c'; ctx.fillRect(0, H - 30, W, 30); ctx.fillStyle = '#2a1d42'; ctx.fillRect(0, H - 30, W, 1);
    const fx = W / 2, fy = H - 30;
    const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, 60); glow.addColorStop(0, 'rgba(255,160,60,0.35)'); glow.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = glow; ctx.fillRect(fx - 60, fy - 60, 120, 90);
    R.drawCampfire(ctx, { x: fx, y: fy + 2 });
    N.CHAR_ORDER.forEach((id, i) => { const spr = S.ch[id][Math.sin(t * 2.5 + i) > 0.6 ? 4 : 0], x = fx + [-46, -24, 24, 46][i]; ctx.save(); ctx.translate(sn(x), sn(fy + 1)); if (i >= 2) ctx.scale(-1, 1); ctx.drawImage(spr, -11, -21); ctx.restore(); });
    for (const q of G.parts) { ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 1, 1); }
    ctx.globalAlpha = 1;
  };
})();
