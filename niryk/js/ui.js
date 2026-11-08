// Niryk — interface drawn on the high-resolution UI canvas: text, panels and buttons (immediate mode),
// the HUD, the minimap, every menu (lobby stations, pause, run results) and the touch controls.
'use strict';
(function () {
  const N = window.N, G = N.G, S = N.S, I = N.input, TAU = Math.PI * 2;
  const U = N.UI = { sel: {}, scroll: 0 };
  let ctx = null;
  const C = { ink: '#f1ebe0', muted: '#a49cb0', gold: '#f0cc6a', bg: '#15131c', bg2: '#1f1b28', hi: '#3e3014', red: '#ff4a5e', blue: '#8fc4ff', cyan: '#5fe3d6' };
  U.C = C;

  // ---------------------------------------------------------------- primitives
  U.begin = (c, UW, UH) => { ctx = c; U.W = UW; U.H = UH; U.mx = I.mx / innerWidth * UW; U.my = I.my / innerHeight * UH; ctx.imageSmoothingEnabled = false; };
  U.font = (size, bold = true) => `${bold ? 700 : 400} ${size}px "Pixelify Sans", ui-monospace, monospace`;
  U.text = (s, x, y, o = {}) => {
    const size = o.size || 18; ctx.font = U.font(size, o.bold !== false);
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.stroke !== false) { ctx.lineJoin = 'round'; ctx.strokeStyle = o.strokeColor || '#0d0a14'; ctx.lineWidth = Math.max(3, size / 4); ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || C.ink; ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  };
  U.measure = (s, size = 18, bold = true) => { ctx.font = U.font(size, bold); return ctx.measureText(s).width; };
  U.wrap = (s, maxW, size = 18, bold = false) => {
    ctx.font = U.font(size, bold); const out = [];
    for (const para of String(s).split('\n')) {
      let line = '';
      for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
      out.push(line);
    }
    return out;
  };
  U.para = (s, x, y, maxW, o = {}) => {
    const size = o.size || 17, lh = o.lh || size * 1.3;
    for (const l of U.wrap(s, maxW, size, o.bold)) { U.text(l, x, y, Object.assign({ size, bold: false, stroke: false, color: C.muted }, o)); y += lh; }
    return y;
  };
  U.inside = (x, y, w, h) => U.mx >= x && U.mx < x + w && U.my >= y && U.my < y + h;
  U.panel = (x, y, w, h, o = {}) => {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6 + (o.drop === false ? 0 : 3));
    ctx.fillStyle = o.bg || C.bg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x, y, w, 2);
    ctx.strokeStyle = o.border || 'rgba(184,144,58,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  };
  U.btn = (x, y, w, h, label, o = {}) => {
    const hov = !o.disabled && U.inside(x, y, w, h);
    U.panel(x, y, w, h, { bg: o.active ? C.hi : hov ? '#2c2638' : o.bg || C.bg2, border: o.active ? 'rgba(240,204,106,0.85)' : hov ? 'rgba(240,204,106,0.5)' : undefined, drop: true });
    if (label) U.text(label, x + w / 2, y + h / 2 + 1, { size: o.size || 19, align: 'center', base: 'middle', color: o.disabled ? '#6a6278' : o.active ? C.gold : o.color || C.ink });
    if (hov && I.mclick) { I.mclick = false; N.sfx('ui'); return true; }
    return false;
  };
  U.spr = (spr, x, y, sc = 3, o = {}) => {
    if (!spr) return;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const img = o.sil ? N.silhouette(spr, o.sil) : spr;
    const w = (spr.W || spr.width) * sc, h = (spr.H || spr.height) * sc;
    if (o.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); }
    else ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  };
  U.sprFit = (spr, x, y, w, h, o = {}) => { const sw = spr.W || spr.width, sh = spr.H || spr.height, sc = Math.max(0.5, Math.floor(Math.min(w / sw, h / sh) * 2) / 2); U.spr(spr, Math.round(x + (w - sw * sc) / 2), Math.round(y + (h - sh * sc) / 2), sc, o); };
  U.bar = (x, y, w, h, v, max, col, label) => {
    ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#2a2236'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * N.clamp(v / max, 0, 1)), h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, Math.round(w * N.clamp(v / max, 0, 1)), Math.max(2, h / 5));
    if (label) U.text(label, x + w / 2, y + h / 2 + 1, { size: h * 0.85, align: 'center', base: 'middle' });
  };
  U.dim = (a = 0.6) => { ctx.fillStyle = `rgba(8,5,14,${a})`; ctx.fillRect(0, 0, U.W, U.H); };
  // A centred menu window with a title and a close button. Returns its rectangle.
  U.frame = (title, w, h, o = {}) => {
    U.dim(0.62);
    w = Math.min(w, U.W - 24); h = Math.min(h, U.H - 24);
    const x = Math.round((U.W - w) / 2), y = Math.round((U.H - h) / 2);
    U.frameBox(x, y, w, h, { bg: '#14121a' });
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#2a2214'); g.addColorStop(0.6, '#1a1620'); g.addColorStop(1, '#14121a');
    ctx.fillStyle = g; ctx.fillRect(x + 3, y + 3, w - 6, 48); ctx.fillStyle = '#b8903a'; ctx.fillRect(x + 3, y + 51, w - 6, 1.5);
    U.text(title, x + 24, y + 36, { size: 28, color: C.gold });
    if (o.close !== false && U.btn(x + w - 50, y + 8, 40, 34, '✕', { size: 20 })) G.closeMenu();
    return { x, y, w, h };
  };
  U.toW = (wx) => (wx - G.camX) * U.W / G.VW;
  U.toH = (wy) => (wy - G.camY) * U.H / G.VH;

  // ---------------------------------------------------------------- HUD (Otherworld Legends style: dark frames with gold trim, ink-brush buttons)
  const gold = '#b8903a', goldHi = '#f0cc6a';
  const frameBox = (x, y, w, h, o = {}) => {
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = o.bg || '#15131c'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = o.border || gold; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = goldHi; for (const [cx, cy] of [[x, y], [x + w - 5, y], [x, y + h - 5], [x + w - 5, y + h - 5]]) ctx.fillRect(cx, cy, 5, 5);
  };
  U.frameBox = frameBox;
  const fancyBar = (x, y, w, h, v, max, c0, c1, label) => {
    ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#2a2230'; ctx.fillRect(x, y, w, h);
    const k = N.clamp(v / max, 0, 1);
    if (k > 0) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(x, y, Math.round(w * k), h); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x, y, Math.round(w * k), Math.max(2, h * 0.3)); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + h - 3, Math.round(w * k), 3); }
    if (label) U.text(label, x + w - 8, y + h / 2 + 1, { size: Math.max(13, h * 0.78), align: 'right', base: 'middle' });
  };
  // Small vector icons for the vitals.
  const heart = (x, y, s, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.1, x - s * 0.5, y + s * 0.5); ctx.lineTo(x, y + s); ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.bezierCurveTo(x + s, y - s * 0.1, x, y - s * 0.2, x, y + s * 0.3); ctx.fill(); };
  const shieldIc = (x, y, s, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - s * 0.5, y); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.closePath(); ctx.fill(); };
  // Ink-brush round button: white disc with a dark glyph (attack / dash), or the ability ink icon.
  U.inkDisc = (x, y, r, light) => {
    ctx.fillStyle = light ? '#f4efe6' : '#0c0a0e'; ctx.beginPath();
    for (let a = 0; a <= TAU + 0.01; a += 0.2) { const rr = r * (1 + Math.sin(a * 5 + x) * 0.025 + Math.sin(a * 11 + y) * 0.02); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.fill();
    ctx.strokeStyle = light ? '#0c0a0e' : '#f4efe6'; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  };
  const glyphDash = (x, y, s, c) => { ctx.strokeStyle = c; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round'; for (const o of [-0.28, 0.12]) { ctx.beginPath(); ctx.moveTo(x + (o - 0.12) * s, y - 0.3 * s); ctx.lineTo(x + (o + 0.16) * s, y); ctx.lineTo(x + (o - 0.12) * s, y + 0.3 * s); ctx.stroke(); } ctx.lineCap = 'butt'; };
  const glyphAim = (x, y, s, c) => { ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, TAU); ctx.stroke(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(x + dx * s * 0.2, y + dy * s * 0.2); ctx.lineTo(x + dx * s * 0.48, y + dy * s * 0.48); ctx.stroke(); } ctx.beginPath(); ctx.arc(x, y, s * 0.07, 0, TAU); ctx.fill(); };
  U.hud = () => {
    const p = G.p; if (!p) return;
    const touch = I.usingTouch;
    // portrait + vitals
    const px = 14, py = 14;
    frameBox(px, py, 84, 84, { bg: '#221a24' });
    const face = p.form === 'dragon' ? S.ch.dragon[0] : S.hero[p.char].face;
    ctx.save(); ctx.beginPath(); ctx.rect(px + 3, py + 3, 78, 78); ctx.clip();
    if (p.form === 'dragon') U.spr(face, px - 50, py - 2, 4); else U.spr(face, px + 2, py + 6, 8);
    ctx.restore();
    const bx = px + 98;
    heart(bx + 4, py + 6, 15, '#ff4a5e');
    fancyBar(bx + 22, py + 5, 250, 22, p.hp, p.maxHp, '#c81e3a', '#ff7a3a', `${Math.ceil(p.hp)}/${p.maxHp}`);
    shieldIc(bx + 4, py + 37, 15, '#9ab8e0');
    fancyBar(bx + 22, py + 37, 210, 15, p.shield, p.maxShield, '#5a6e96', '#a8c4ec', `${Math.floor(p.shield)}/${p.maxShield}`);
    U.spr(S.misc.coin[0], bx + 22, py + 62, 2.4);
    U.text(String(p.gold), bx + 42, py + 78, { size: 19, color: C.gold });
    U.spr(S.misc.crystal[0], bx + 102, py + 58, 2.2);
    U.text(String(G.run ? G.run.crystals : N.save.crystals), bx + 120, py + 78, { size: 19, color: C.cyan });
    if (p.potions) { U.spr(S.misc.potion, bx + 172, py + 58, 2); U.text('×' + p.potions, bx + 192, py + 78, { size: 17 }); }
    // equipment column of round icons
    let ey = py + 104;
    p.equip.slice(0, 10).forEach((id, i) => {
      const cx = px + 18 + (i >= 5 ? 40 : 0), cy = ey + 18 + (i % 5) * 40;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, TAU); ctx.fill();
      ctx.fillStyle = '#221c28'; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.fill();
      ctx.strokeStyle = N.RARITY[N.EQUIPS[id].rarity].color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.stroke();
      U.spr(S.eq[id], cx - 13, cy - 13, 2.1);
    });
    if (p.equip.length > 10) U.text('+' + (p.equip.length - 10), px + 98, ey + 200, { size: 15, color: C.muted });
    // buffs
    const buffs = [];
    if (p.form === 'dragon') buffs.push(['Forma Dracônica', p.formT, '#ff6a2a']);
    if (p.buffs.war > 0) buffs.push(['Relincho', p.buffs.war, '#ffb03a']);
    if (p.buffs.hawk > 0) buffs.push(['Olho de Gavião', p.buffs.hawk, '#ffe066']);
    if (p.buffs.tail > 0) buffs.push(['Vento de Cauda', p.buffs.tail, '#cfe2ff']);
    if (p.buffs.gallop > 0) buffs.push(['Galope', p.buffs.gallop, '#c8b898']);
    buffs.forEach(([n, t, c], i) => U.text(`${n} ${t.toFixed(1)}s`, bx + 22, py + 104 + i * 22, { size: 16, color: c }));
    // weapon card (bottom-left; above the joystick area on touch)
    const w = N.weaponOf(p), w2 = p.weapons[1 - p.wi] ? N.WEAPONS[p.weapons[1 - p.wi]] : null;
    const wy = U.H - (touch ? 300 : 92);
    frameBox(14, wy, 240, 76);
    if (p.form === 'dragon') U.text('Garras de dragão', 26, wy + 44, { size: 18, color: '#ff8a3a' });
    else { U.sprFit(S.wp[w.id], 20, wy + 6, 130, 46); U.text(w.name, 24, wy + 66, { size: 15, color: N.RARITY[w.rarity].color }); }
    if (w2) { frameBox(266, wy + 18, 92, 58, { bg: '#100e16' }); U.sprFit(S.wp[w2.id], 272, wy + 24, 80, 34, { alpha: 0.75 }); if (!touch) U.text('R', 352, wy + 36, { size: 15, color: C.muted, align: 'right' }); }
    // ability + dash buttons (desktop)
    if (!touch) {
      p.abil.forEach((s, i) => U.abilIcon(s, U.W - 196 + i * 92, U.H - 64, 40, ['Q', 'E'][i]));
      U.inkDisc(U.W - 288, U.H - 56, 30, true); glyphDash(U.W - 288, U.H - 56, 34, '#0c0a0e');
      if (p.dashCd > 0) { ctx.fillStyle = 'rgba(8,5,14,0.6)'; ctx.beginPath(); ctx.moveTo(U.W - 288, U.H - 56); ctx.arc(U.W - 288, U.H - 56, 30, -Math.PI / 2, -Math.PI / 2 + TAU * N.clamp(p.dashCd / 0.85, 0, 1)); ctx.fill(); }
      badge(U.W - 288, U.H - 22, 'Espaço');
    }
    U.location();
    if (G.scene === 'run') U.minimap();
    if (G.boss && G.boss.alive) U.bossBar(G.boss);
    U.prompt();
  };
  const badge = (x, y, t) => { ctx.font = U.font(13); const w = ctx.measureText(t).width + 12; ctx.fillStyle = '#0c0a0e'; ctx.fillRect(x - w / 2, y - 9, w, 18); ctx.strokeStyle = gold; ctx.lineWidth = 1; ctx.strokeRect(x - w / 2 + 0.5, y - 8.5, w - 1, 17); U.text(t, x, y + 1, { size: 13, align: 'center', base: 'middle', stroke: false, color: C.gold }); };
  U.abilIcon = (s, cx, cy, r, key) => {
    const ready = s.charges > 0;
    U.spr(S.ab[s.id], cx - r * 1.12, cy - r * 1.12, r * 2.24 / S.ab[s.id].W, ready ? {} : { alpha: 0.55 });
    if (s.flash > 0) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, TAU); ctx.stroke(); }
    if (s.charges < s.max && s.cdMax > 0) {
      const k = N.clamp(s.cd / s.cdMax, 0, 1);
      ctx.fillStyle = 'rgba(8,5,14,0.62)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.closePath(); ctx.fill();
      if (!ready) U.text(Math.ceil(s.cd).toString(), cx, cy + 2, { size: r * 0.8, align: 'center', base: 'middle' });
    }
    if (s.max > 1) { ctx.fillStyle = '#0c0a0e'; ctx.beginPath(); ctx.arc(cx + r * 0.75, cy + r * 0.75, 11, 0, TAU); ctx.fill(); U.text(String(s.charges), cx + r * 0.75, cy + r * 0.75 + 1, { size: 15, align: 'center', base: 'middle', color: C.gold }); }
    if (s.mod >= 0) { ctx.fillStyle = '#c66bff'; ctx.save(); ctx.translate(cx + r * 0.78, cy - r * 0.78); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(-5, -5, 10, 10); ctx.restore(); }
    if (key) badge(cx, cy + r + 2, key);
  };
  // Location banner + pause button (top-right).
  U.location = () => {
    let name = G.scene === 'lobby' ? 'Acampamento Estelar' : G.scene === 'training' ? 'Campo de Treino' : '';
    if (G.scene === 'run' && G.run) name = `${N.WORLDS[G.run.world].name}  ${G.run.world + 1}-${G.run.level + 1}`;
    ctx.font = U.font(17); const w = Math.max(190, ctx.measureText(name).width + 50), x = U.W - 14 - w, y = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 3, y - 3, w + 6, 40);
    ctx.fillStyle = '#15131c'; ctx.fillRect(x, y, w, 34);
    ctx.fillStyle = gold; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + 32, w, 2);
    for (const ex of [x - 2, x + w - 6]) { ctx.save(); ctx.translate(ex + 4, y + 17); ctx.rotate(Math.PI / 4); ctx.fillStyle = goldHi; ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
    U.text(name, x + w / 2, y + 18, { size: 17, align: 'center', base: 'middle', color: '#e8f0d8' });
    const bx = x - 50;
    frameBox(bx, y, 36, 34);
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(bx + 12, y + 9, 4, 16); ctx.fillRect(bx + 20, y + 9, 4, 16);
    if (!I.usingTouch && U.inside(bx, y, 36, 34) && I.mclick && !G.menu) { I.mclick = false; G.openMenu('pause'); }
    U.locBottom = y + 40;
  };
  U.minimap = () => {
    const m = G.map; if (!m || !m.rooms) return;
    let minX = 99, minY = 99, maxX = -99, maxY = -99;
    for (const r of m.rooms) { if (!r.seen) continue; minX = Math.min(minX, r.gx); minY = Math.min(minY, r.gy); maxX = Math.max(maxX, r.gx); maxY = Math.max(maxY, r.gy); }
    const cw = 26, ch = 20, gap = 10, W = Math.max(4, maxX - minX + 1) * (cw + gap), H = Math.max(3, maxY - minY + 1) * (ch + gap);
    const sc = Math.min(1, 236 / W, 170 / H), pw = W * sc + 20, ph = H * sc + 46, x0 = U.W - 14 - pw + 10, y0 = (U.locBottom || 60) + 8;
    frameBox(x0 - 10, y0, pw, ph, { bg: 'rgba(16,14,22,0.88)' });
    const pos = (r) => [x0 + (r.gx - minX) * (cw + gap) * sc, y0 + 10 + (r.gy - minY) * (ch + gap) * sc];
    ctx.strokeStyle = '#6a6278'; ctx.lineWidth = 3 * sc;
    for (const r of m.rooms) { if (!r.seen) continue; for (const l of r.links) { const o = m.rooms[l]; if (!o.seen || l < r.id) continue; const [ax, ay] = pos(r), [bx, by] = pos(o); ctx.beginPath(); ctx.moveTo(ax + cw * sc / 2, ay + ch * sc / 2); ctx.lineTo(bx + cw * sc / 2, by + ch * sc / 2); ctx.stroke(); } }
    const col = { start: '#8a8aaa', enemy: '#4a4458', chest: '#ffd040', upgrade: '#c66bff', shop: '#5fe3d6', boss: '#ff4a5e' };
    for (const r of m.rooms) {
      if (!r.seen) continue;
      const [x, y] = pos(r);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 2, y - 2, cw * sc + 4, ch * sc + 4);
      ctx.fillStyle = r.visited ? (r.type === 'enemy' ? (r.cleared ? '#8a8098' : '#5a4e6a') : col[r.type]) : '#262030';
      ctx.fillRect(x, y, cw * sc, ch * sc);
      if (!r.visited && r.type !== 'enemy') { ctx.fillStyle = col[r.type]; ctx.fillRect(x + cw * sc / 2 - 3, y + ch * sc / 2 - 3, 6, 6); }
      if (G.portal && G.portal.room === r) { ctx.fillStyle = '#7cf07a'; ctx.fillRect(x + cw * sc / 2 - 4, y + ch * sc / 2 - 4, 8, 8); }
      if (r === G.curRoom || r === G.lastRoom) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, cw * sc + 2, ch * sc + 2); }
    }
    U.text('M', x0 + pw - 24, y0 + ph - 10, { size: 12, color: '#5a5268', stroke: false });
  };
  U.bossBar = (b) => {
    const w = N.clamp(U.W - 700, 300, 560), x = (U.W - w) / 2, y = U.H - 92;
    U.text(b.def.name, U.W / 2, y + 2, { size: 22, align: 'center', color: '#ffd0d0', base: 'top' });
    U.text(b.def.title, U.W / 2, y + 26, { size: 13, align: 'center', color: C.muted, base: 'top', bold: false });
    fancyBar(x, y + 46, w, 14, b.hp, b.maxHp, b.p2 ? '#a80e2a' : '#8a1428', b.p2 ? '#ff4a3a' : '#e8384c');
    ctx.fillStyle = goldHi; for (const ex of [x - 8, x + w + 2]) { ctx.save(); ctx.translate(ex + 3, y + 53); ctx.rotate(Math.PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
  };
  // Interaction prompt (and item card) for the prop nearest to the hero.
  U.prompt = () => {
    const n = G.near; if (!n || G.menu) return;
    const lab = n.label ? n.label() : null; if (!lab) return;
    const x = U.toW(n.x), y = U.toH(n.y - (n.h || 18)) - 18;
    ctx.font = U.font(17); const lw = ctx.measureText(lab).width + (I.usingTouch ? 24 : 54);
    ctx.fillStyle = 'rgba(12,10,16,0.85)'; ctx.fillRect(x - lw / 2, y - 16, lw, 28); ctx.fillStyle = gold; ctx.fillRect(x - lw / 2, y + 11, lw, 1.5);
    if (!I.usingTouch) { ctx.fillStyle = '#f4efe6'; ctx.fillRect(x - lw / 2 + 6, y - 11, 22, 18); U.text('F', x - lw / 2 + 17, y - 1, { size: 15, align: 'center', base: 'middle', stroke: false, color: '#0c0a0e' }); }
    U.text(lab, x + (I.usingTouch ? 0 : 14), y - 1, { size: 17, align: 'center', base: 'middle', stroke: false });
    const info = n.info && n.info();
    if (info) {
      const w = 350, lines = U.wrap(info.desc, w - 28, 16), h = 60 + lines.length * 21 + (info.extra ? 24 : 0);
      let bx = N.clamp(x - w / 2, 10, U.W - w - 10), by = y - h - 30; if (by < 10) by = U.toH(n.y) + 30;
      frameBox(bx, by, w, h, { bg: 'rgba(18,15,24,0.96)', border: info.color || gold });
      U.text(info.name, bx + 14, by + 30, { size: 20, color: info.color || C.ink });
      if (info.tag) U.text(info.tag, bx + w - 14, by + 30, { size: 13, align: 'right', color: C.muted, bold: false });
      let ly = by + 54; for (const l of lines) { U.text(l, bx + 14, ly, { size: 16, bold: false, stroke: false, color: '#d8cfe6' }); ly += 21; }
      if (info.extra) U.text(info.extra, bx + 14, ly + 4, { size: 15, color: C.gold });
    }
  };
  // In-world labels for lobby stations.
  U.labels = () => {
    for (const pr of G.props) {
      if (!pr.title || G.menu) continue;
      const x = U.toW(pr.x), y = U.toH(pr.y - (pr.h || 18)) - (G.near === pr ? 50 : 12);
      if (x < -100 || x > U.W + 100 || y < -40 || y > U.H + 40) continue;
      U.text(pr.title, x, y, { size: 15, align: 'center', color: pr.titleColor || '#d8c8ff' });
    }
  };
  // Damage numbers: big, outlined; criticals get a red burst behind them.
  U.texts = () => {
    for (const t of G.texts) {
      const k = t.t / t.life, x = U.toW(t.x), y = U.toH(t.y) - k * 44 - (k < 0.15 ? (0.15 - k) * 60 : 0);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      if (t.big) {
        const s = 30 * (k < 0.12 ? 0.6 + k * 3.3 : 1);
        ctx.fillStyle = '#c81e2a'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? s * 0.55 : s * 0.95; ctx.lineTo(x + Math.cos(a) * rr * 1.2, y - 8 + Math.sin(a) * rr * 0.8); } ctx.fill();
        U.text(t.txt, x, y, { size: s, align: 'center', color: t.c === '#ffb02e' ? '#fff2a0' : t.c, strokeColor: '#2a0808' });
      } else U.text(t.txt, x, y, { size: 21, align: 'center', color: t.c, strokeColor: '#140a10' });
      ctx.globalAlpha = 1;
    }
  };
  U.banner = () => {
    const b = G.banner; if (!b) return;
    const k = b.t / b.life, a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, U.W, 0); g.addColorStop(0, 'rgba(8,6,12,0)'); g.addColorStop(0.5, 'rgba(8,6,12,0.82)'); g.addColorStop(1, 'rgba(8,6,12,0)');
    ctx.fillStyle = g; ctx.fillRect(0, U.H * 0.26, U.W, 116);
    ctx.fillStyle = gold; ctx.fillRect(U.W * 0.25, U.H * 0.26 + 2, U.W * 0.5, 1.5); ctx.fillRect(U.W * 0.25, U.H * 0.26 + 112, U.W * 0.5, 1.5);
    U.text(b.title, U.W / 2, U.H * 0.26 + 58, { size: 44, align: 'center', color: b.color || C.gold });
    if (b.sub) U.text(b.sub, U.W / 2, U.H * 0.26 + 94, { size: 19, align: 'center', color: C.ink, bold: false });
    ctx.globalAlpha = 1;
  };
  U.toasts = () => {
    (G.toasts || []).forEach((t, i) => {
      const k = t.t / 4, a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.globalAlpha = a;
      const w = 440, x = (U.W - w) / 2, y = 84 + i * 80;
      frameBox(x, y, w, 66, { bg: '#1e1826' });
      U.spr(S.misc.trophy, x + 12, y + 7, 1);
      U.text(t.title, x + 58, y + 28, { size: 19, color: C.gold });
      U.text(t.sub, x + 58, y + 52, { size: 14, color: C.ink, bold: false });
      ctx.globalAlpha = 1;
    });
  };

  // ---------------------------------------------------------------- touch controls
  U.touchLayout = () => {
    const W = U.W, H = U.H;
    return {
      attack: { x: W - 104, y: H - 104, r: 64, kind: 'attack' },
      dash: { x: W - 236, y: H - 58, r: 40, kind: 'dash' },
      ab1: { x: W - 250, y: H - 170, r: 40, slot: 0 },
      ab2: { x: W - 166, y: H - 246, r: 40, slot: 1 },
      interact: { x: W - 64, y: H - 232, r: 34, label: 'F' },
      swap: { x: W - 56, y: H - 320, r: 26, label: '⇄' },
      pause: { x: W - 300, y: 31, r: 0, label: '' },
    };
  };
  U.processTouch = () => {
    I.vmove.x = 0; I.vmove.y = 0;
    for (const k in I.vbtn) if (I.vbtn[k] !== 'tap') I.vbtn[k] = false;
    if (!I.touches.size) return;
    const L = U.touchLayout(), menuMode = !!G.menu || G.scene === 'title';
    for (const t of I.touches.values()) {
      const ux = t.x / innerWidth * U.W, uy = t.y / innerHeight * U.H;
      if (t.fresh) {
        if (menuMode) { t.claim = 'ui'; I.mx = t.x; I.my = t.y; I.mclick = true; continue; }
        if (uy < 60 && ux > U.W - 360 && ux < U.W - 260) { t.claim = 'pause'; I.vbtn.pause = 'tap'; continue; }
        let best = null;
        for (const k in L) { const b = L[k]; if (!b.r) continue; if (k === 'interact' && !G.near) continue; if (k === 'swap' && !(G.p && G.p.weapons[1])) continue; if (Math.hypot(ux - b.x, uy - b.y) < b.r * 1.2) best = k; }
        t.claim = best || (ux < U.W * 0.45 ? 'move' : 'attack');
        if (t.claim === 'move') { t.ox = ux; t.oy = uy; }
      }
      if (t.claim === 'ui') { I.mx = t.x; I.my = t.y; continue; }
      if (t.claim === 'pause') continue;
      if (t.claim === 'move') {
        let dx = ux - t.ox, dy = uy - t.oy; const d = Math.hypot(dx, dy), R = 70;
        if (d > R) { t.ox += dx / d * (d - R); t.oy += dy / d * (d - R); dx = ux - t.ox; dy = uy - t.oy; }
        const m = Math.hypot(dx, dy); if (m > 8) { I.vmove.x = dx / R; I.vmove.y = dy / R; }
        t.sx = ux; t.sy = uy;
      } else if (t.claim) { I.vbtn[t.claim] = !t.ended || I.vbtn[t.claim] === 'tap' ? true : false; if (t.ended && t.fresh) I.vbtn[t.claim] = 'tap'; }
    }
  };
  U.drawTouch = () => {
    if (!I.usingTouch || G.menu || G.scene === 'title' || !G.p) return;
    const L = U.touchLayout();
    let stick = null; for (const t of I.touches.values()) if (t.claim === 'move' && !t.ended) stick = t;
    const sx = stick ? stick.ox : 130, sy = stick ? stick.oy : U.H - 130;
    ctx.globalAlpha = stick ? 0.55 : 0.3; ctx.strokeStyle = '#f4efe6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, 70, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(12,10,16,0.35)'; ctx.fill();
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 60, sy + Math.sin(a) * 60); ctx.lineTo(sx + Math.cos(a + 0.12) * 50, sy + Math.sin(a + 0.12) * 50); ctx.lineTo(sx + Math.cos(a - 0.12) * 50, sy + Math.sin(a - 0.12) * 50); ctx.fill(); }
    ctx.globalAlpha = stick ? 0.9 : 0.45; U.inkDisc(stick ? stick.sx || sx : sx, stick ? stick.sy || sy : sy, 28, true); ctx.globalAlpha = 1;
    for (const k in L) {
      const b = L[k]; if (!b.r) continue;
      if (k === 'interact' && !G.near) continue;
      if (k === 'swap' && !G.p.weapons[1]) continue;
      ctx.globalAlpha = I.vbtn[k] ? 1 : 0.85;
      if (b.slot !== undefined) { const s = G.p.abil[b.slot]; if (s) U.abilIcon(s, b.x, b.y, b.r); }
      else if (b.kind === 'attack') { U.inkDisc(b.x, b.y, b.r, true); glyphAim(b.x, b.y, b.r * 1.3, '#0c0a0e'); }
      else if (b.kind === 'dash') { U.inkDisc(b.x, b.y, b.r, true); glyphDash(b.x, b.y, b.r * 1.1, '#0c0a0e'); }
      else { U.inkDisc(b.x, b.y, b.r, false); U.text(b.label, b.x, b.y + 2, { size: b.r * 0.85, align: 'center', base: 'middle', stroke: false }); }
      ctx.globalAlpha = 1;
    }
  };

  // ---------------------------------------------------------------- menus
  const M = U.menus = {};
  const rarityTag = (r) => N.RARITY[r].name;

  M.pause = () => {
    const f = U.frame('Pausa', 560, 470);
    let y = f.y + 76; const x = f.x + 40, w = f.w - 80;
    if (U.btn(x, y, w, 50, 'Continuar')) G.closeMenu(); y += 64;
    const o = N.save.opts;
    if (U.btn(x, y, w, 46, 'Música: ' + (o.music ? 'Ligada' : 'Desligada'), { size: 17 })) { o.music = !o.music; N.audio.applyOpts(); N.writeSave(); } y += 56;
    if (U.btn(x, y, w, 46, 'Efeitos sonoros: ' + (o.sfx ? 'Ligados' : 'Desligados'), { size: 17 })) { o.sfx = !o.sfx; N.audio.applyOpts(); N.writeSave(); } y += 56;
    if (U.btn(x, y, w, 46, 'Tremor de tela: ' + (o.shake ? 'Ligado' : 'Desligado'), { size: 17 })) { o.shake = !o.shake; N.writeSave(); } y += 56;
    if (U.btn(x, y, w, 46, 'Como jogar', { size: 17 })) G.openMenu('help', { back: 'pause' }); y += 64;
    if (G.scene === 'run') { if (U.btn(x, y, w, 50, 'Abandonar a run', { color: '#ff9aa8' })) { G.closeMenu(); G.endRun(false, true); } }
    else if (U.btn(x, y, w, 50, 'Tela inicial', { color: C.muted })) { G.closeMenu(); G.goTitle(); }
  };

  M.help = (m) => {
    const f = U.frame('Como jogar', 900, 580);
    const x = f.x + 30; let y = f.y + 84;
    const rows = [
      ['Mover', 'WASD ou setas'], ['Mirar / atacar', 'Mouse + botão esquerdo (segure)'], ['Esquiva', 'Espaço, Shift ou botão direito'],
      ['Habilidades', 'Q e E'], ['Interagir / comprar / pegar', 'F ou Enter'], ['Trocar de arma', 'R ou Tab'], ['Pausa', 'Esc ou P'],
      ['Toque (celular)', 'Lado esquerdo move; botões à direita atacam (mira automática), esquivam e usam habilidades'],
    ];
    for (const [a, b] of rows) { U.text(a, x, y, { size: 19, color: C.gold }); U.para(b, x + 300, y, f.w - 360, { size: 18, color: C.ink }); y += 40; }
    y += 6;
    U.para('Cada herói tem 4 habilidades; leve 2 para a run (Q e E). Cada habilidade tem 3 passivas: escolha no máximo uma, ou use a habilidade base. Salas fecham as portas até todos os inimigos caírem. Cristais ✦ ficam com você entre as runs e compram melhorias no Altar dos Ancestrais.', x, y, f.w - 60, { size: 17 });
    if (U.btn(f.x + f.w / 2 - 100, f.y + f.h - 66, 200, 46, 'Voltar')) { if (m.back) G.openMenu(m.back); else G.closeMenu(); }
  };

  // Hero profile (lobby NPCs)
  M.hero = (m) => {
    const id = m.id, c = N.CHARS[id];
    const f = U.frame(c.name + ' — ' + c.title, 980, 600);
    ctx.fillStyle = '#120c1c'; ctx.fillRect(f.x + 24, f.y + 70, 260, 300);
    const t = G.time;
    U.sprFit(S.ch[id][Math.floor(t * 4) % 3], f.x + 24, f.y + 80, 260, 260);
    U.text(c.name, f.x + 154, f.y + 400, { size: 30, align: 'center', color: c.color });
    const stats = [['Vida', c.hp, 9, '#e8384c'], ['Escudo', c.shield, 6, '#7aa8e0'], ['Velocidade', c.speed, 80, '#7cdc6a'], ['Crítico', Math.round(c.crit * 100), 12, '#ffe066']];
    stats.forEach(([n, v, mx, col], i) => { const y = f.y + 432 + i * 34; U.text(n, f.x + 26, y + 16, { size: 16, color: C.muted }); U.bar(f.x + 140, y + 4, 140, 14, v, mx, col, String(v) + (n === 'Crítico' ? '%' : '')); });
    const rx = f.x + 310, rw = f.w - 334;
    let y = U.para(c.bio, rx, f.y + 92, rw, { size: 17, color: '#d8cfe6' });
    y += 12;
    const w = N.WEAPONS[c.weapon];
    U.text('Arma preferida', rx, y + 6, { size: 18, color: C.gold });
    U.panel(rx, y + 18, rw, 62, { bg: '#151022' }); U.sprFit(S.wp[w.id], rx + 8, y + 24, 100, 50);
    U.text(w.name, rx + 120, y + 44, { size: 18 }); U.text(w.desc, rx + 120, y + 68, { size: 14, bold: false, stroke: false, color: C.muted });
    y += 110;
    U.text('Habilidades', rx, y, { size: 18, color: C.gold });
    c.abilities.forEach((a, i) => { const ax = rx + (i % 2) * (rw / 2), ay = y + 14 + Math.floor(i / 2) * 58; U.panel(ax, ay, rw / 2 - 10, 48, { bg: '#151022' }); U.spr(S.ab[a], ax + 6, ay + 6, 2); U.text(N.ABILITIES[a].name, ax + 50, ay + 30, { size: 16 }); });
    const by = f.y + f.h - 70;
    const cur = N.save.char === id;
    if (U.btn(rx, by, 300, 50, cur ? 'Herói atual' : 'Jogar com ' + c.name, { active: cur })) { if (!cur) { G.switchHero(id); } G.closeMenu(); }
    if (U.btn(rx + 320, by, 260, 50, 'Grimório')) { if (!cur) G.switchHero(id); G.openMenu('loadout'); }
  };

  // Ability loadout: pick 2 of 4 and one passive (or none) per ability
  M.loadout = (m) => {
    const id = N.save.char, c = N.CHARS[id];
    const f = U.frame('Grimório de ' + c.name, 1100, 620);
    const lo = N.getLoadout(id).map(([a]) => a);
    N.save.mods = N.save.mods || {};
    if (!m.sel || !c.abilities.includes(m.sel)) m.sel = lo[0];
    // slots
    ['Q', 'E'].forEach((k, i) => {
      const a = lo[i], ab = N.ABILITIES[a], mod = N.save.mods[a] === undefined ? -1 : N.save.mods[a];
      const x = f.x + 24 + i * 300, y = f.y + 64;
      U.panel(x, y, 284, 56, { bg: '#151022' }); U.text(k, x + 12, y + 36, { size: 22, color: C.gold }); U.spr(S.ab[a], x + 40, y + 8, 2.5);
      U.text(ab.name, x + 88, y + 26, { size: 16 }); U.text(mod < 0 ? 'Base' : ab.mods[mod].name, x + 88, y + 47, { size: 14, color: mod < 0 ? C.muted : '#d8a8ff' });
    });
    U.text('Leve 2 habilidades. Cada uma pode usar no máximo 1 passiva.', f.x + f.w - 24, f.y + 98, { size: 15, align: 'right', color: C.muted, bold: false, stroke: false });
    // list
    const lx = f.x + 24, ly = f.y + 136;
    c.abilities.forEach((a, i) => {
      const y = ly + i * 104, slot = lo.indexOf(a);
      if (U.btn(lx, y, 300, 92, '', { active: m.sel === a })) m.sel = a;
      U.spr(S.ab[a], lx + 10, y + 14, 4);
      U.text(N.ABILITIES[a].name, lx + 86, y + 38, { size: 17 });
      U.text('Recarga ' + N.ABILITIES[a].cd + 's', lx + 86, y + 64, { size: 14, color: C.muted });
      if (slot >= 0) U.text(slot ? 'E' : 'Q', lx + 284, y + 30, { size: 20, align: 'right', color: C.gold });
    });
    // detail
    const a = m.sel, ab = N.ABILITIES[a], dx = f.x + 348, dw = f.w - 372;
    let y = f.y + 160;
    U.text(ab.name, dx, y, { size: 26, color: c.color });
    y = U.para(ab.desc + '  (recarga ' + ab.cd + 's)', dx, y + 30, dw, { size: 17, color: '#d8cfe6' });
    const slot = lo.indexOf(a);
    ['Q', 'E'].forEach((k, i) => {
      if (U.btn(dx + i * 190, y + 4, 176, 42, slot === i ? 'Equipada em ' + k : 'Equipar em ' + k, { active: slot === i, size: 16 })) {
        const nl = lo.slice(); const other = nl.indexOf(a);
        if (other >= 0 && other !== i) { nl[other] = nl[i]; }
        nl[i] = a; N.save.loadout[id] = nl; N.writeSave(); G.refreshLoadout && G.refreshLoadout();
      }
    });
    y += 62;
    U.text('Passivas — escolha uma ou nenhuma', dx, y, { size: 17, color: C.gold });
    y += 12;
    const cur = N.save.mods[a] === undefined ? -1 : N.save.mods[a];
    const opts = [{ name: 'Habilidade base', desc: 'Sem modificações.' }].concat(ab.mods);
    const oh = Math.min(76, (f.y + f.h - 20 - y) / 4 - 8);
    opts.forEach((o, i) => {
      const mi = i - 1, oy = y + i * (oh + 8);
      if (U.btn(dx, oy, dw, oh, '', { active: cur === mi })) { N.save.mods[a] = mi; N.writeSave(); G.refreshLoadout && G.refreshLoadout(); }
      U.text(o.name, dx + 14, oy + 25, { size: 17, color: cur === mi ? C.gold : mi < 0 ? C.muted : '#e0c0ff' });
      U.para(o.desc, dx + 14, oy + 47, dw - 28, { size: 15, color: '#cfc6dc' });
    });
  };

  // Codex
  M.codex = (m) => {
    const f = U.frame('Códice de Niryk', 1120, 620);
    const tabs = [['w', 'Armas'], ['q', 'Equipamentos'], ['m', 'Monstros'], ['b', 'Chefes']];
    m.tab = m.tab || 'w';
    tabs.forEach(([k, n], i) => { if (U.btn(f.x + 24 + i * 170, f.y + 62, 160, 40, n, { active: m.tab === k, size: 17 })) { m.tab = k; m.sel = null; } });
    const list = m.tab === 'w' ? Object.keys(N.WEAPONS) : m.tab === 'q' ? Object.keys(N.EQUIPS) : m.tab === 'm' ? Object.keys(N.ENEMIES) : Object.keys(N.BOSSES);
    const known = (k) => !!N.save.codex[m.tab][k];
    const got = list.filter(known).length;
    U.text(`${got} / ${list.length} descobertos`, f.x + f.w - 24, f.y + 90, { size: 16, align: 'right', color: C.muted });
    const cols = m.tab === 'b' ? 3 : 6, cs = m.tab === 'b' ? 132 : 76, gx = f.x + 24, gy = f.y + 122;
    list.forEach((k, i) => {
      const x = gx + (i % cols) * (cs + 8), y = gy + Math.floor(i / cols) * (cs + 8);
      if (U.btn(x, y, cs, cs, '', { active: m.sel === k })) m.sel = k;
      const spr = m.tab === 'w' ? S.wp[k] : m.tab === 'q' ? S.eq[k] : m.tab === 'm' ? S.en[k][0] : S.boss[k][0];
      U.sprFit(spr, x + 6, y + 6, cs - 12, cs - 12, known(k) ? {} : { sil: '#0d0a14' });
    });
    const dx = gx + cols * (cs + 8) + 16, dw = f.x + f.w - 24 - dx;
    U.panel(dx, gy, dw, f.h - 146, { bg: '#151022' });
    const k = m.sel || list.find(known);
    if (!k) { U.para('Nada descoberto aqui ainda. Explore Niryk!', dx + 20, gy + 40, dw - 40, { size: 17 }); return; }
    const spr = m.tab === 'w' ? S.wp[k] : m.tab === 'q' ? S.eq[k] : m.tab === 'm' ? S.en[k][0] : S.boss[k][0];
    U.sprFit(spr, dx + 20, gy + 16, dw - 40, 150, known(k) ? {} : { sil: '#0d0a14' });
    let y = gy + 196;
    if (!known(k)) { U.text('???', dx + 20, y, { size: 26 }); U.para('Ainda não descoberto.', dx + 20, y + 32, dw - 40); return; }
    if (m.tab === 'w') {
      const w = N.WEAPONS[k];
      U.text(w.name, dx + 20, y, { size: 24, color: N.RARITY[w.rarity].color }); U.text(rarityTag(w.rarity), dx + dw - 20, y, { size: 15, align: 'right', color: C.muted });
      y = U.para(w.desc, dx + 20, y + 30, dw - 40, { size: 17, color: '#d8cfe6' }) + 8;
      const kind = { melee: 'Corpo a corpo', thrust: 'Estocada', ranged: 'À distância', cast: 'Feitiço' }[w.kind];
      for (const [a, b] of [['Tipo', kind], ['Dano', w.dmg + (w.count > 1 ? ' × ' + w.count : '')], ['Ataques/s', w.rate], ['Herói', w.owner ? N.CHARS[w.owner].name : '—']]) { U.text(a, dx + 20, y + 4, { size: 16, color: C.muted }); U.text(String(b), dx + 180, y + 4, { size: 16 }); y += 28; }
    } else if (m.tab === 'q') {
      const q = N.EQUIPS[k];
      U.text(q.name, dx + 20, y, { size: 24, color: N.RARITY[q.rarity].color }); U.text(rarityTag(q.rarity), dx + dw - 20, y, { size: 15, align: 'right', color: C.muted });
      U.para(q.desc, dx + 20, y + 32, dw - 40, { size: 18, color: '#d8cfe6' });
    } else if (m.tab === 'm') {
      const e = N.ENEMIES[k];
      U.text(e.name, dx + 20, y, { size: 24 }); U.text(N.WORLDS[e.world].name, dx + dw - 20, y, { size: 15, align: 'right', color: C.muted });
      y = U.para(e.desc, dx + 20, y + 32, dw - 40, { size: 17, color: '#d8cfe6' }) + 8;
      U.text('Vida base: ' + e.hp, dx + 20, y + 4, { size: 16, color: C.muted });
      U.text(N.save.codex.m[k] > 1 ? 'Já derrotado' : 'Avistado', dx + 20, y + 30, { size: 16, color: N.save.codex.m[k] > 1 ? '#7cf07a' : C.muted });
    } else {
      const b = N.BOSSES[k];
      U.text(b.name, dx + 20, y, { size: 26, color: '#ffb0b8' }); U.text(b.title, dx + 20, y + 28, { size: 17, color: C.gold });
      y = U.para(b.desc, dx + 20, y + 58, dw - 40, { size: 17, color: '#d8cfe6' }) + 8;
      U.text('Vida: ' + b.hp + '   ·   ' + N.WORLDS[b.world].name, dx + 20, y + 4, { size: 16, color: C.muted });
      U.text('Vitórias: ' + (N.save.stats.bossKills[k] || 0), dx + 20, y + 30, { size: 16, color: C.muted });
    }
  };

  M.achievements = () => {
    const f = U.frame('Salão das Conquistas', 1100, 640);
    const list = N.ACHIEVEMENTS, done = list.filter((a) => N.save.ach[a.id]).length;
    U.text(`${done} / ${list.length}`, f.x + f.w - 70, f.y + 34, { size: 20, align: 'right', color: C.muted });
    const half = Math.ceil(list.length / 2), cw = (f.w - 64) / 2, rh = Math.min(58, (f.h - 84) / half - 4);
    list.forEach((a, i) => {
      const col = Math.floor(i / half), row = i % half, x = f.x + 24 + col * (cw + 16), y = f.y + 66 + row * (rh + 4);
      const ok = !!N.save.ach[a.id];
      U.panel(x, y, cw, rh, { bg: ok ? '#2a2414' : '#151022', drop: false });
      U.spr(S.misc.trophy, x + 8, y + (rh - 26) / 2, 1, ok ? {} : { sil: '#3a3248' });
      U.text(a.name, x + 36, y + rh * 0.42, { size: 16, color: ok ? C.gold : C.ink });
      U.text(a.desc, x + 36, y + rh * 0.82, { size: 13, bold: false, stroke: false, color: C.muted });
      U.text('+' + a.reward + ' ✦', x + cw - 10, y + rh * 0.42, { size: 15, align: 'right', color: ok ? '#6a8a7a' : C.cyan });
    });
  };

  // Altar dos Ancestrais: permanent stat upgrades bought with crystals (a constellation of nodes)
  M.upgrades = (m) => {
    const f = U.frame('Altar dos Ancestrais', 1100, 640);
    U.spr(S.misc.crystal[0], f.x + f.w - 200, f.y + 12, 3);
    U.text(String(N.save.crystals), f.x + f.w - 172, f.y + 36, { size: 22, color: C.cyan });
    const cx = f.x + f.w / 2, cy = f.y + 250, list = N.UPGRADES;
    ctx.fillStyle = '#0f0a1c'; ctx.fillRect(f.x + 20, f.y + 60, f.w - 40, 380);
    for (let i = 0; i < 60; i++) { const sx = f.x + 20 + N.hash2(i, 1) * (f.w - 40), sy = f.y + 60 + N.hash2(i, 2) * 380; ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.5 * Math.abs(Math.sin(G.time + i))})`; ctx.fillRect(sx, sy, 2, 2); }
    const span = f.w - 180;
    const pos = list.map((u, i) => [f.x + 90 + (i / (list.length - 1)) * span, cy + (i % 2 ? 70 : -60) + Math.sin(i * 1.7) * 14]);
    ctx.strokeStyle = 'rgba(160,150,220,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); pos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    m.sel = m.sel || list[0].id;
    list.forEach((u, i) => {
      const [x, y] = pos[i], lv = N.save.upg[u.id] || 0, sel = m.sel === u.id;
      if (U.inside(x - 34, y - 34, 68, 68) && I.mclick) { I.mclick = false; m.sel = u.id; N.sfx('ui'); }
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = lv ? u.color : '#3a3250'; ctx.beginPath(); ctx.arc(x, y, 29, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(x - 8, y - 8, 9, 0, TAU); ctx.fill();
      if (sel) { ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 39 + Math.sin(G.time * 4) * 2, 0, TAU); ctx.stroke(); }
      U.text(String(lv), x, y + 2, { size: 24, align: 'center', base: 'middle' });
      U.text(u.name, x, y + 56, { size: 15, align: 'center', color: sel ? C.gold : C.ink });
      for (let k = 0; k < u.max; k++) { ctx.fillStyle = k < lv ? u.color : '#3a3250'; ctx.fillRect(x - u.max * 7 + k * 14 + 2, y + 64, 10, 6); }
    });
    const u = list.find((x) => x.id === m.sel), lv = N.save.upg[u.id] || 0, max = lv >= u.max, cost = N.upgradeCost(u, lv);
    const by = f.y + 456;
    U.panel(f.x + 20, by, f.w - 40, f.h - (by - f.y) - 20, { bg: '#151022' });
    U.text(u.name, f.x + 44, by + 40, { size: 26, color: u.color });
    U.text(u.desc + ' por nível', f.x + 44, by + 72, { size: 18, color: '#d8cfe6', bold: false, stroke: false });
    U.text(`Nível ${lv} / ${u.max}`, f.x + 44, by + 104, { size: 17, color: C.muted });
    const can = !max && N.save.crystals >= cost;
    if (U.btn(f.x + f.w - 330, by + 34, 286, 62, max ? 'Nível máximo' : `Melhorar — ${cost} ✦`, { disabled: !can, active: can })) {
      N.save.crystals -= cost; N.save.upg[u.id] = lv + 1; N.writeSave(); N.sfx('levelup'); N.checkAch(); G.refreshLoadout && G.refreshLoadout();
    }
  };

  M.runStart = () => {
    const id = N.save.char, c = N.CHARS[id];
    const f = U.frame('Portal para as profundezas', 760, 500);
    ctx.fillStyle = '#120c1c'; ctx.fillRect(f.x + 24, f.y + 70, 200, 220);
    U.sprFit(S.ch[id][0], f.x + 24, f.y + 80, 200, 200);
    U.text(c.name, f.x + 124, f.y + 320, { size: 26, align: 'center', color: c.color });
    const rx = f.x + 250, rw = f.w - 274;
    U.para('Três mundos, três níveis cada. No terceiro nível de cada mundo, um chefe guarda a passagem. Ouro só vale durante a run; cristais ✦ você leva de volta.', rx, f.y + 92, rw, { size: 16 });
    N.getLoadout(id).forEach(([a, mod], i) => {
      const y = f.y + 196 + i * 70, ab = N.ABILITIES[a];
      U.panel(rx, y, rw, 60, { bg: '#151022' }); U.text(i ? 'E' : 'Q', rx + 12, y + 38, { size: 22, color: C.gold }); U.spr(S.ab[a], rx + 40, y + 10, 2.5);
      U.text(ab.name, rx + 90, y + 27, { size: 17 }); U.text(mod < 0 ? 'Habilidade base' : 'Passiva: ' + ab.mods[mod].name, rx + 90, y + 49, { size: 14, color: mod < 0 ? C.muted : '#d8a8ff' });
    });
    if (U.btn(rx, f.y + f.h - 80, 250, 56, 'Descer!', { active: true, size: 22 })) { G.closeMenu(); G.startRun(); }
    if (U.btn(rx + 266, f.y + f.h - 80, 200, 56, 'Grimório')) G.openMenu('loadout');
  };

  // Training ground terminal and weapon rack
  M.training = (m) => {
    const f = U.frame('Terminal de Treinamento', 1000, 600);
    U.text('Invocar monstros já avistados', f.x + 24, f.y + 88, { size: 18, color: C.gold });
    const list = Object.keys(N.ENEMIES), cols = 9, cs = 92;
    list.forEach((k, i) => {
      const x = f.x + 24 + (i % cols) * (cs + 10), y = f.y + 104 + Math.floor(i / cols) * (cs + 10), known = !!N.save.codex.m[k];
      if (U.btn(x, y, cs, cs, '', { disabled: !known }) && known) G.trainingSpawn(k);
      U.sprFit(S.en[k][0], x + 6, y + 6, cs - 12, cs - 12, known ? {} : { sil: '#0d0a14' });
    });
    const by = f.y + f.h - 150;
    if (U.btn(f.x + 24, by, 280, 50, 'Limpar a arena', { size: 17 })) G.trainingClear();
    if (U.btn(f.x + 324, by, 300, 50, 'Recarga instantânea: ' + (G.noCd ? 'SIM' : 'NÃO'), { size: 17, active: G.noCd })) { G.noCd = !G.noCd; }
    if (U.btn(f.x + 644, by, 300, 50, 'Invencível: ' + (G.godMode ? 'SIM' : 'NÃO'), { size: 17, active: G.godMode })) G.godMode = !G.godMode;
    U.para('Os bonecos mostram o dano por segundo. Monstros invocados aqui não soltam itens.', f.x + 24, by + 90, f.w - 48, { size: 16 });
  };
  M.rack = () => {
    const f = U.frame('Arsenal de Treino', 1000, 560);
    U.text('Escolha uma arma já descoberta (fica na mão atual)', f.x + 24, f.y + 88, { size: 17, color: C.gold });
    const list = Object.keys(N.WEAPONS), cols = 8, cw = 112, ch = 86;
    list.forEach((k, i) => {
      const x = f.x + 24 + (i % cols) * (cw + 8), y = f.y + 108 + Math.floor(i / cols) * (ch + 34), known = !!N.save.codex.w[k], w = N.WEAPONS[k];
      if (U.btn(x, y, cw, ch, '', { disabled: !known, active: G.p && G.p.weapons[G.p.wi] === k }) && known) { G.p.weapons[G.p.wi] = k; N.sfx('pickup'); }
      U.sprFit(S.wp[k], x + 6, y + 6, cw - 12, ch - 12, known ? {} : { sil: '#0d0a14' });
      U.text(known ? w.name.split(' ')[0] : '???', x + cw / 2, y + ch + 22, { size: 14, align: 'center', color: known ? N.RARITY[w.rarity].color : C.muted });
    });
  };

  M.result = (m) => {
    const win = m.win, f = U.frame(win ? 'O Núcleo Estelar brilha de novo!' : m.quit ? 'Run abandonada' : 'Você caiu em Niryk...', 760, 540, { close: false });
    const r = m.res;
    const lines = [
      ['Herói', N.CHARS[r.char].name], ['Mais longe', `${N.WORLDS[r.world].name} ${r.world + 1}-${r.level + 1}`], ['Inimigos derrotados', r.kills],
      ['Salas limpas', r.rooms], ['Equipamentos', r.equips], ['Tempo', `${Math.floor(r.time / 60)}m ${String(Math.floor(r.time % 60)).padStart(2, '0')}s`],
    ];
    let y = f.y + 100;
    for (const [a, b] of lines) { U.text(a, f.x + 60, y, { size: 19, color: C.muted }); U.text(String(b), f.x + f.w - 60, y, { size: 19, align: 'right' }); y += 38; }
    y += 10;
    U.panel(f.x + 60, y, f.w - 120, 70, { bg: '#151022' });
    U.spr(S.misc.crystal[0], f.x + 84, y + 14, 4);
    U.text(`+${r.crystals} cristais`, f.x + 130, y + 46, { size: 26, color: C.cyan });
    if (r.bonus) U.text(`(${r.bonus} de bônus)`, f.x + f.w - 84, y + 46, { size: 16, align: 'right', color: C.muted });
    if (U.btn(f.x + f.w / 2 - 170, f.y + f.h - 80, 340, 56, 'Voltar ao acampamento', { active: true })) { G.closeMenu(); G.goLobby(); }
  };

  // ---------------------------------------------------------------- title screen
  U.title = () => {
    const t = G.time, big = Math.min(120, U.W / 7), ty = U.H * 0.2;
    U.text('NIRYK', U.W / 2 + 6, ty + 6, { size: big, align: 'center', color: '#3a1830', stroke: false });
    U.text('NIRYK', U.W / 2, ty, { size: big, align: 'center', color: '#ffd166', strokeColor: '#3a1830' });
    U.text('Lendas do Planeta Partido', U.W / 2, ty + 44, { size: 24, align: 'center', color: '#cbb8ff' });
    const bw = 300, bx = U.W / 2 - bw / 2, by = ty + 72;
    if (U.btn(bx, by, bw, 56, 'Jogar', { active: true, size: 24 })) G.goLobby();
    if (U.btn(bx, by + 68, bw, 44, 'Como jogar', { size: 19 })) G.openMenu('help');
    const lw = Math.min(760, U.W - 40), lx = U.W / 2 - lw / 2, ly0 = by + 132;
    const lines = []; for (const l of N.LORE) lines.push(...U.wrap(l, lw - 40, 15));
    ctx.fillStyle = 'rgba(11,8,24,0.72)'; ctx.fillRect(lx, ly0, lw, lines.length * 20 + 22);
    lines.forEach((l, i) => U.text(l, U.W / 2, ly0 + 26 + i * 20, { size: 15, bold: false, stroke: false, align: 'center', color: '#c8bce0' }));
    if (Math.sin(t * 3) > -0.3) U.text('Pressione Enter para começar', U.W / 2, U.H - 18, { size: 15, align: 'center', color: C.muted });
  };
})();
