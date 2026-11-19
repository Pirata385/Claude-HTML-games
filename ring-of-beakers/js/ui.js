// ui.js — a small immediate-mode UI drawn on the canvas, in points: text, panels, buttons,
// scrolling lists, icons, toasts and a stack of modal windows. Flat fills with hard shadows.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { clamp, TAU } = RB.core;
  const input = RB.input;

  const pal = { cream: '#f6ead2', paper: '#fffaf0', ink: '#23314a', teal: '#2a9d8f', mustard: '#e9b44c', coral: '#e76f51', plum: '#6d4c7d', leaf: '#7fb069',
    sky: '#8fd0e0', sand: '#edd9a3', brick: '#b5523b', grey: '#8b97a8', soft: '#e9dcc0', white: '#ffffff', shadow: 'rgba(35,49,74,0.2)', dim: 'rgba(35,49,74,0.55)' };
  const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", "Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  const fonts = {};
  const font = (size, bold) => { const k = size + (bold === false ? 'n' : 'b'); return fonts[k] || (fonts[k] = (bold === false ? '500 ' : '800 ') + size + 'px ' + FONT); };

  const ui = { ctx: null, view: null, zones: [], prev: [], layer: 0, top: 0, modals: [], scroll: {}, toasts: [], clip: null, pal, time: 0, hover: true };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  ui.rr = rr;
  ui.begin = function (ctx, view, dt) { ui.ctx = ctx; ui.view = view; ui.prev = ui.zones; ui.zones = []; ui.layer = 0; ui.top = ui.modals.length; ui.clip = null; ui.time += dt; };
  ui.active = () => ui.layer === ui.top;
  ui.zone = (x, y, w, h) => { ui.zones.push([x, y, w, h]); };
  ui.over = (x, y) => { if (ui.modals.length) return true; for (const z of ui.prev) if (x >= z[0] && x <= z[0] + z[2] && y >= z[1] && y <= z[1] + z[3]) return true; return false; };
  const inClip = (x, y) => !ui.clip || (x >= ui.clip[0] && x <= ui.clip[0] + ui.clip[2] && y >= ui.clip[1] && y <= ui.clip[1] + ui.clip[3]);
  ui.tapIn = function (x, y, w, h) {
    if (!ui.active()) return false;
    for (const t of input.taps) if (!t.used && t.x >= x && t.x <= x + w && t.y >= y && t.y <= y + h && t.sx >= x && t.sx <= x + w && t.sy >= y && t.sy <= y + h && inClip(t.x, t.y)) { t.used = true; return true; }
    return false;
  };
  ui.downIn = function (x, y, w, h) {
    if (!ui.active()) return null;
    for (const p of input.ptrs) if (p.sx >= x && p.sx <= x + w && p.sy >= y && p.sy <= y + h && p.x >= x - 8 && p.x <= x + w + 8 && p.y >= y - 8 && p.y <= y + h + 8 && inClip(p.sx, p.sy)) return p;
    return null;
  };

  // ---- text
  ui.text = function (str, x, y, o) {
    o = o || {};
    const ctx = ui.ctx;
    let size = o.size || 14;
    ctx.font = font(size, o.bold);
    if (o.maxW) { let w = ctx.measureText(str).width; while (w > o.maxW && size > 8) { size -= 1; ctx.font = font(size, o.bold); w = ctx.measureText(str).width; } }
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    ctx.fillStyle = o.color || pal.ink;
    ctx.fillText(str, x, y);
    return o.measure ? ctx.measureText(str).width : 0;
  };
  ui.width = (str, size, bold) => { ui.ctx.font = font(size || 14, bold); return ui.ctx.measureText(str).width; };
  const wrapCache = new Map();
  ui.wrap = function (str, maxW, size, bold) {
    const key = size + '|' + maxW + '|' + (bold === false ? 0 : 1) + '|' + str;
    let lines = wrapCache.get(key);
    if (lines) return lines;
    ui.ctx.font = font(size, bold);
    lines = [];
    for (const para of String(str).split('\n')) {
      let cur = '';
      for (const word of para.split(' ')) {
        const tryLine = cur ? cur + ' ' + word : word;
        if (ui.ctx.measureText(tryLine).width > maxW && cur) { lines.push(cur); cur = word; } else cur = tryLine;
      }
      lines.push(cur);
    }
    if (wrapCache.size > 400) wrapCache.clear();
    wrapCache.set(key, lines);
    return lines;
  };
  // Wrapped paragraph. Returns the height it took.
  ui.para = function (str, x, y, maxW, o) {
    o = o || {};
    const size = o.size || 13, lh = size * 1.3, lines = ui.wrap(str, maxW, size, o.bold === undefined ? false : o.bold);
    for (let i = 0; i < lines.length; i++) ui.text(lines[i], o.align === 'center' ? x + maxW / 2 : x, y + size + i * lh, { size, color: o.color, bold: o.bold === undefined ? false : o.bold, align: o.align });
    return lines.length * lh;
  };

  // ---- shapes
  ui.panel = function (x, y, w, h, o) {
    o = o || {};
    const ctx = ui.ctx, r = o.r === undefined ? 12 : o.r;
    if (o.shadow !== false) { ctx.fillStyle = pal.shadow; rr(ctx, x, y + 4, w, h, r); ctx.fill(); }
    ctx.fillStyle = o.fill || pal.paper; rr(ctx, x, y, w, h, r); ctx.fill();
    if (o.zone !== false) ui.zone(x, y, w, h);
  };
  ui.rect = function (x, y, w, h, fill, r) { const ctx = ui.ctx; ctx.fillStyle = fill; if (r) { rr(ctx, x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h); };
  ui.bar = function (x, y, w, h, frac, color, bg) {
    const ctx = ui.ctx;
    ctx.fillStyle = bg || pal.soft; rr(ctx, x, y, w, h, h / 2); ctx.fill();
    const f = clamp(frac, 0, 1);
    if (f > 0.01) { ctx.fillStyle = color || pal.teal; rr(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
  };

  // Button. Returns true when tapped. o: { fill, color, disabled, size, icon, iconCol, sub, r, key (keyboard code), flat }
  ui.btn = function (x, y, w, h, label, o) {
    o = o || {};
    const ctx = ui.ctx, dis = !!o.disabled, r = o.r === undefined ? 10 : o.r;
    const press = !dis && ui.downIn(x, y, w, h);
    const fill = dis ? '#cfc6b3' : o.fill || pal.teal, dy = press ? 2 : 0;
    ui.zone(x, y, w, h);
    if (!o.flat) { ctx.fillStyle = pal.shadow; rr(ctx, x, y + 3, w, h, r); ctx.fill(); }
    ctx.fillStyle = fill; rr(ctx, x, y + dy, w, h, r); ctx.fill();
    const col = dis ? '#948b7a' : o.color || pal.white, size = o.size || Math.min(15, h * 0.42);
    let tx = x + w / 2;
    if (o.icon) {
      const is = Math.min(h * 0.6, 22);
      if (label) { const tw = ui.width(label, size); const total = is + 5 + tw; ui.icon(o.icon, x + (w - total) / 2 + is / 2, y + h / 2 + dy, is, o.iconCol || col); tx = x + (w - total) / 2 + is + 5 + tw / 2; }
      else ui.icon(o.icon, x + w / 2, y + h / 2 + dy, Math.min(w, h) * 0.58, o.iconCol || col);
    }
    if (label) {
      if (o.sub) { ui.text(label, tx, y + h * 0.42 + dy, { size, color: col, align: 'center', maxW: w - 10 }); ui.text(o.sub, tx, y + h * 0.8 + dy, { size: size * 0.72, color: col, align: 'center', bold: false, maxW: w - 8 }); }
      else ui.text(label, tx, y + h / 2 + dy + 0.5, { size, color: col, align: 'center', base: 'middle', maxW: w - (o.icon ? 34 : 10) });
    }
    if (dis) return false;
    if (o.key && ui.active() && input.hits[o.key]) { input.hits[o.key] = false; return true; }
    return ui.tapIn(x, y, w, h);
  };

  // Scrolling list: drawRow(i, x, y, w, h) for each visible row.
  ui.list = function (id, x, y, w, h, n, rowH, drawRow) {
    const ctx = ui.ctx, st = ui.scroll[id] || (ui.scroll[id] = { y: 0, grab: null });
    const max = Math.max(0, n * rowH - h);
    ui.zone(x, y, w, h);
    if (ui.active()) {
      let held = false;
      for (const p of input.ptrs) {
        if (p.sx < x || p.sx > x + w || p.sy < y || p.sy > y + h) continue;
        held = true;
        if (!st.grab || st.grab.id !== p.id) st.grab = { id: p.id, y0: st.y, py: p.y };
        if (p.moved > 8) st.y = st.grab.y0 - (p.y - st.grab.py);
      }
      if (!held) st.grab = null;
      if (input.wheel && input.mx >= x && input.mx <= x + w && input.my >= y && input.my <= y + h) st.y += input.wheel * rowH * 0.9;
    }
    st.y = clamp(st.y, 0, max);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const old = ui.clip; ui.clip = [x, y, w, h];
    const i0 = Math.floor(st.y / rowH), i1 = Math.min(n - 1, Math.floor((st.y + h) / rowH));
    for (let i = i0; i <= i1; i++) drawRow(i, x, y + i * rowH - st.y, w, rowH);
    ui.clip = old; ctx.restore();
    if (max > 0) { const bh = Math.max(24, h * h / (n * rowH)); ctx.fillStyle = 'rgba(35,49,74,0.25)'; rr(ctx, x + w - 4, y + (h - bh) * (st.y / max), 3, bh, 1.5); ctx.fill(); }
  };

  // ---- icons: flat glyphs in a box of size s centred on (x, y)
  ui.icon = function (name, x, y, s, col) {
    const ctx = ui.ctx, u = s / 2;
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = col || pal.ink; ctx.strokeStyle = col || pal.ink; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const C = (cx, cy, r) => { ctx.beginPath(); ctx.arc(cx * u, cy * u, r * u, 0, TAU); ctx.fill(); };
    const L = (...p) => { ctx.beginPath(); ctx.moveTo(p[0] * u, p[1] * u); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * u, p[i + 1] * u); ctx.stroke(); };
    const Pg = (...p) => { ctx.beginPath(); ctx.moveTo(p[0] * u, p[1] * u); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * u, p[i + 1] * u); ctx.closePath(); ctx.fill(); };
    const R = (rx, ry, rw, rh, r) => { rr(ctx, rx * u, ry * u, rw * u, rh * u, (r || 0) * u); ctx.fill(); };
    switch (name) {
      case 'coin': ctx.fillStyle = col || pal.mustard; C(0, 0, 0.9); ctx.fillStyle = 'rgba(255,255,255,0.45)'; C(0, 0, 0.55); break;
      case 'net': ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.arc(0.15 * u, -0.2 * u, 0.62 * u, 0, TAU); ctx.stroke(); L(-0.3, 0.25, -0.9, 0.9); ctx.lineWidth = s * 0.05; L(-0.3, -0.5, 0.6, 0.1); L(-0.4, -0.1, 0.4, 0.35); L(0.5, -0.65, -0.25, 0.1); L(0.1, -0.8, -0.4, -0.2); break;
      case 'shovel': L(0.75, -0.8, -0.15, 0.1); Pg(-0.1, -0.2, 0.3, 0.2, -0.45, 0.95, -0.9, 0.5, -0.5, 0.2); L(0.5, -0.95, 0.95, -0.5); break;
      case 'seed': ctx.beginPath(); ctx.ellipse(-0.4 * u, 0.2 * u, 0.3 * u, 0.42 * u, 0.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0.3 * u, -0.3 * u, 0.3 * u, 0.42 * u, -0.4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0.4 * u, 0.5 * u, 0.26 * u, 0.36 * u, 1.2, 0, TAU); ctx.fill(); break;
      case 'map': Pg(-0.9, -0.6, -0.3, -0.8, -0.3, 0.6, -0.9, 0.8); Pg(-0.22, -0.8, 0.3, -0.6, 0.3, 0.8, -0.22, 0.6); Pg(0.38, -0.6, 0.9, -0.8, 0.9, 0.6, 0.38, 0.8); break;
      case 'truck': R(-0.95, -0.35, 1.2, 0.8, 0.1); Pg(0.3, -0.1, 0.7, -0.1, 0.95, 0.2, 0.95, 0.45, 0.3, 0.45); ctx.fillStyle = pal.ink; C(-0.5, 0.55, 0.25); C(0.55, 0.55, 0.25); break;
      case 'moon': ctx.beginPath(); ctx.arc(0, 0, 0.85 * u, 0.6, TAU - 0.9); ctx.arc(0.42 * u, -0.25 * u, 0.7 * u, TAU - 1.5, 1.05, true); ctx.closePath(); ctx.fill(); break;
      case 'sun': C(0, 0, 0.45); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; L(Math.cos(a) * 0.65, Math.sin(a) * 0.65, Math.cos(a) * 0.95, Math.sin(a) * 0.95); } break;
      case 'heart': C(-0.42, -0.25, 0.48); C(0.42, -0.25, 0.48); Pg(-0.86, -0.05, 0.86, -0.05, 0, 0.9); break;
      case 'egg': ctx.beginPath(); ctx.ellipse(0, 0.08 * u, 0.62 * u, 0.85 * u, 0, 0, TAU); ctx.fill(); break;
      case 'beaker': Pg(-0.28, -0.9, 0.28, -0.9, 0.28, -0.25, 0.8, 0.75, 0.6, 0.95, -0.6, 0.95, -0.8, 0.75, -0.28, -0.25); ctx.fillStyle = 'rgba(255,255,255,0.5)'; Pg(-0.5, 0.25, 0.5, 0.25, 0.68, 0.75, -0.68, 0.75); break;
      case 'dna': ctx.lineWidth = s * 0.1; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12, px = Math.sin(t * TAU) * 0.5 * u, py = (t * 1.8 - 0.9) * u; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
        ctx.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12, px = -Math.sin(t * TAU) * 0.5 * u, py = (t * 1.8 - 0.9) * u; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); ctx.lineWidth = s * 0.06; L(-0.4, -0.45, 0.4, -0.45); L(-0.4, 0.45, 0.4, 0.45); break;
      case 'gear': C(0, 0, 0.6); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; C(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.2); } ctx.fillStyle = 'rgba(255,255,255,0.7)'; C(0, 0, 0.26); break;
      case 'book': R(-0.8, -0.8, 1.6, 1.6, 0.15); ctx.fillStyle = 'rgba(255,255,255,0.55)'; R(-0.5, -0.5, 1.0, 0.25, 0.05); R(-0.5, -0.05, 0.7, 0.2, 0.05); break;
      case 'star': ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.42 : 0.95; ctx.lineTo(Math.cos(a) * r * u, Math.sin(a) * r * u); } ctx.closePath(); ctx.fill(); break;
      case 'bolt': Pg(0.25, -0.95, -0.6, 0.15, -0.05, 0.15, -0.3, 0.95, 0.6, -0.2, 0.05, -0.2); break;
      case 'shield': ctx.beginPath(); ctx.moveTo(-0.75 * u, -0.8 * u); ctx.lineTo(0.75 * u, -0.8 * u); ctx.lineTo(0.75 * u, 0); ctx.quadraticCurveTo(0.7 * u, 0.7 * u, 0, 0.95 * u); ctx.quadraticCurveTo(-0.7 * u, 0.7 * u, -0.75 * u, 0); ctx.closePath(); ctx.fill(); break;
      case 'whistle': C(-0.25, 0.15, 0.6); R(-0.1, -0.45, 1.05, 0.4, 0.08); ctx.fillStyle = 'rgba(255,255,255,0.6)'; C(-0.25, 0.15, 0.22); break;
      case 'flag': L(-0.6, -0.9, -0.6, 0.95); Pg(-0.5, -0.85, 0.85, -0.5, -0.5, -0.05); break;
      case 'close': ctx.lineWidth = s * 0.16; L(-0.6, -0.6, 0.6, 0.6); L(-0.6, 0.6, 0.6, -0.6); break;
      case 'check': ctx.lineWidth = s * 0.16; L(-0.7, 0.05, -0.2, 0.55, 0.7, -0.5); break;
      case 'plus': ctx.lineWidth = s * 0.16; L(-0.7, 0, 0.7, 0); L(0, -0.7, 0, 0.7); break;
      case 'minus': ctx.lineWidth = s * 0.16; L(-0.7, 0, 0.7, 0); break;
      case 'left': ctx.lineWidth = s * 0.16; L(0.35, -0.7, -0.4, 0, 0.35, 0.7); break;
      case 'right': ctx.lineWidth = s * 0.16; L(-0.35, -0.7, 0.4, 0, -0.35, 0.7); break;
      case 'sound': Pg(-0.9, -0.3, -0.45, -0.3, 0.05, -0.75, 0.05, 0.75, -0.45, 0.3, -0.9, 0.3); ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.arc(0.1 * u, 0, 0.45 * u, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(0.1 * u, 0, 0.8 * u, -0.7, 0.7); ctx.stroke(); break;
      case 'mute': Pg(-0.9, -0.3, -0.45, -0.3, 0.05, -0.75, 0.05, 0.75, -0.45, 0.3, -0.9, 0.3); ctx.lineWidth = s * 0.12; L(0.35, -0.35, 0.9, 0.35); L(0.35, 0.35, 0.9, -0.35); break;
      case 'music': C(-0.45, 0.6, 0.32); C(0.5, 0.4, 0.32); ctx.lineWidth = s * 0.11; L(-0.15, 0.6, -0.15, -0.7, 0.8, -0.9, 0.8, 0.4); break;
      case 'full': ctx.lineWidth = s * 0.13; L(-0.85, -0.3, -0.85, -0.85, -0.3, -0.85); L(0.3, -0.85, 0.85, -0.85, 0.85, -0.3); L(0.85, 0.3, 0.85, 0.85, 0.3, 0.85); L(-0.3, 0.85, -0.85, 0.85, -0.85, 0.3); break;
      case 'home': Pg(-0.95, -0.05, 0, -0.95, 0.95, -0.05); R(-0.65, -0.1, 1.3, 1.0, 0.05); ctx.fillStyle = 'rgba(255,255,255,0.6)'; R(-0.18, 0.3, 0.36, 0.6, 0.03); break;
      case 'lock': R(-0.65, -0.1, 1.3, 1.0, 0.15); ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.arc(0, -0.15 * u, 0.42 * u, Math.PI, 0); ctx.stroke(); break;
      case 'clock': C(0, 0, 0.9); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = s * 0.1; L(0, -0.5, 0, 0, 0.35, 0.25); break;
      case 'trophy': Pg(-0.6, -0.85, 0.6, -0.85, 0.45, 0.05, -0.45, 0.05); R(-0.12, 0, 0.24, 0.5); R(-0.5, 0.5, 1.0, 0.3, 0.06); ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.arc(-0.6 * u, -0.5 * u, 0.3 * u, 1.2, 4.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0.6 * u, -0.5 * u, 0.3 * u, -1.5, 1.9); ctx.stroke(); break;
      case 'bucket': ctx.fillStyle = col || pal.white; Pg(-0.8, -0.7, 0.8, -0.7, 0.55, 0.9, -0.55, 0.9); ctx.fillStyle = pal.coral; Pg(-0.5, -0.7, -0.2, -0.7, -0.15, 0.9, -0.38, 0.9); Pg(0.2, -0.7, 0.5, -0.7, 0.38, 0.9, 0.15, 0.9); ctx.fillStyle = pal.coral; R(-0.9, -0.9, 1.8, 0.28, 0.08); break;
      case 'fuse': R(-0.3, -0.9, 0.6, 0.3, 0.05); R(-0.3, 0.6, 0.6, 0.3, 0.05); ctx.fillStyle = 'rgba(255,255,255,0.75)'; R(-0.38, -0.6, 0.76, 1.2, 0.08); ctx.strokeStyle = col || pal.ink; ctx.lineWidth = s * 0.07; L(0, -0.55, 0.15, -0.1, -0.15, 0.1, 0, 0.55); break;
      case 'eye': ctx.beginPath(); ctx.ellipse(0, 0, 0.95 * u, 0.55 * u, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; C(0, 0, 0.36); ctx.fillStyle = col || pal.ink; C(0, 0, 0.18); break;
      case 'sleep': ctx.lineWidth = s * 0.11; L(-0.8, -0.1, -0.2, -0.1, -0.8, 0.8, -0.2, 0.8); ctx.lineWidth = s * 0.09; L(0.1, -0.8, 0.8, -0.8, 0.1, -0.1, 0.8, -0.1); break;
      case 'target': ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.arc(0, 0, 0.8 * u, 0, TAU); ctx.stroke(); C(0, 0, 0.28); L(0, -1, 0, -0.6); L(0, 1, 0, 0.6); L(-1, 0, -0.6, 0); L(1, 0, 0.6, 0); break;
      case 'feather': ctx.beginPath(); ctx.ellipse(0.1 * u, -0.15 * u, 0.4 * u, 0.85 * u, 0.6, 0, TAU); ctx.fill(); L(-0.85, 0.9, 0.3, -0.4); break;
      case 'grain': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-0.3 * u, (0.45 - i * 0.5) * u, 0.2 * u, 0.33 * u, -0.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0.3 * u, (0.45 - i * 0.5) * u, 0.2 * u, 0.33 * u, 0.6, 0, TAU); ctx.fill(); } L(0, 0.95, 0, -0.7); break;
      case 'worm': ctx.lineWidth = s * 0.2; ctx.beginPath(); ctx.moveTo(-0.8 * u, 0.4 * u); ctx.bezierCurveTo(-0.4 * u, -0.9 * u, 0, 0.9 * u, 0.4 * u, -0.1 * u); ctx.lineTo(0.8 * u, -0.5 * u); ctx.stroke(); break;
      case 'chili': ctx.beginPath(); ctx.moveTo(-0.3 * u, -0.6 * u); ctx.quadraticCurveTo(0.9 * u, -0.5 * u, 0.6 * u, 0.9 * u); ctx.quadraticCurveTo(0.0, 0.5 * u, -0.6 * u, -0.3 * u); ctx.closePath(); ctx.fill(); ctx.strokeStyle = pal.leaf; L(-0.45, -0.5, -0.7, -0.9); break;
      case 'bottle': R(-0.2, -0.95, 0.4, 0.4, 0.05); R(-0.5, -0.5, 1.0, 1.45, 0.2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; R(-0.32, -0.05, 0.64, 0.5, 0.05); break;
      case 'mushroom': ctx.beginPath(); ctx.arc(0, -0.05 * u, 0.9 * u, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = pal.cream; R(-0.25, -0.05, 0.5, 0.95, 0.15); ctx.fillStyle = 'rgba(255,255,255,0.75)'; C(-0.4, -0.45, 0.16); C(0.3, -0.55, 0.2); break;
      case 'atom': C(0, 0, 0.25); ctx.lineWidth = s * 0.07; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 0.95 * u, 0.36 * u, i * Math.PI / 3, 0, TAU); ctx.stroke(); } break;
      case 'spur': Pg(-0.9, 0.5, 0.2, -0.2, 0.3, 0.3); ctx.lineWidth = s * 0.14; ctx.beginPath(); ctx.arc(0.4 * u, 0.05 * u, 0.5 * u, -1.2, 2.2); ctx.stroke(); break;
      case 'weight': R(-0.95, -0.45, 0.4, 0.9, 0.08); R(0.55, -0.45, 0.4, 0.9, 0.08); R(-0.6, -0.14, 1.2, 0.28, 0.05); break;
      case 'bag': Pg(-0.7, -0.4, 0.7, -0.4, 0.85, 0.9, -0.85, 0.9); ctx.lineWidth = s * 0.1; ctx.beginPath(); ctx.arc(0, -0.4 * u, 0.4 * u, Math.PI, 0); ctx.stroke(); break;
      case 'person': C(0, -0.55, 0.38); ctx.beginPath(); ctx.arc(0, 0.9 * u, 0.75 * u, Math.PI, 0); ctx.closePath(); ctx.fill(); break;
      case 'bird': ctx.beginPath(); ctx.ellipse(-0.1 * u, 0.2 * u, 0.7 * u, 0.5 * u, -0.3, 0, TAU); ctx.fill(); C(0.5, -0.4, 0.33); Pg(0.75, -0.5, 1.0, -0.35, 0.75, -0.25); Pg(-0.6, 0.0, -1.0, -0.45, -0.95, 0.25); L(-0.1, 0.6, -0.1, 0.95); L(0.2, 0.6, 0.2, 0.95); break;
      case 'trash': R(-0.6, -0.5, 1.2, 1.45, 0.12); R(-0.8, -0.8, 1.6, 0.25, 0.06); R(-0.25, -0.98, 0.5, 0.2, 0.05); break;
      case 'info': C(0, 0, 0.9); ctx.fillStyle = pal.white; C(0, -0.45, 0.14); R(-0.12, -0.2, 0.24, 0.75, 0.05); break;
      case 'swap': ctx.lineWidth = s * 0.12; L(-0.8, -0.35, 0.7, -0.35); L(0.35, -0.75, 0.75, -0.35, 0.35, 0.05); L(0.8, 0.4, -0.7, 0.4); L(-0.35, 0.0, -0.75, 0.4, -0.35, 0.8); break;
      case 'lantern': R(-0.4, -0.5, 0.8, 1.2, 0.15); R(-0.55, -0.7, 1.1, 0.25, 0.06); R(-0.55, 0.65, 1.1, 0.25, 0.06); ctx.fillStyle = pal.mustard; C(0, 0.1, 0.25); ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.arc(0, -0.7 * u, 0.3 * u, Math.PI, 0); ctx.stroke(); break;
      case 'detector': ctx.lineWidth = s * 0.12; L(0.7, -0.9, -0.25, 0.4); ctx.beginPath(); ctx.ellipse(-0.35 * u, 0.6 * u, 0.6 * u, 0.3 * u, 0, 0, TAU); ctx.stroke(); break;
      case 'boot': Pg(-0.5, -0.9, 0.1, -0.9, 0.1, 0.2, 0.9, 0.45, 0.9, 0.9, -0.5, 0.9); break;
      case 'shard': Pg(-0.8, 0.6, -0.2, -0.9, 0.7, -0.3, 0.5, 0.8); break;
      case 'skull': C(0, -0.15, 0.75); R(-0.4, 0.3, 0.8, 0.5, 0.1); ctx.fillStyle = pal.paper; C(-0.3, -0.15, 0.2); C(0.3, -0.15, 0.2); break;
      case 'up': ctx.lineWidth = s * 0.16; L(-0.7, 0.35, 0, -0.4, 0.7, 0.35); break;
      case 'down': ctx.lineWidth = s * 0.16; L(-0.7, -0.35, 0, 0.4, 0.7, -0.35); break;
      case 'male': ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.arc(-0.2 * u, 0.2 * u, 0.52 * u, 0, TAU); ctx.stroke(); L(0.2, -0.2, 0.85, -0.85); L(0.4, -0.85, 0.85, -0.85, 0.85, -0.4); break;
      case 'female': ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.arc(0, -0.3 * u, 0.52 * u, 0, TAU); ctx.stroke(); L(0, 0.22, 0, 0.95); L(-0.35, 0.6, 0.35, 0.6); break;
      case 'hat': R(-0.95, 0.35, 1.9, 0.3, 0.08); R(-0.55, -0.75, 1.1, 1.15, 0.1); break;
      default: C(0, 0, 0.8);
    }
    ctx.restore();
  };
  const ITEM_ICON = { net: ['net', pal.teal], bignet: ['net', pal.plum], silvernet: ['net', '#8f9db0'], goldshovel: ['shovel', '#d9a21b'], shovel: ['shovel', pal.brick], seed: ['seed', pal.mustard], detector: ['detector', pal.grey], launcher: ['target', pal.coral], lantern: ['lantern', pal.ink],
    grain: ['grain', pal.mustard], grainsack: ['bag', pal.mustard], worm: ['worm', pal.coral], chili: ['chili', '#d7372f'], tonic: ['bottle', pal.teal], gromash: ['bag', pal.leaf], loveseed: ['heart', pal.coral], mushroom: ['mushroom', pal.plum], isotope: ['atom', '#58c468'],
    elixir: ['bottle', pal.plum], vigor: ['bottle', '#d9a21b'], spurs: ['spur', pal.grey], helmet: ['shield', pal.grey], scarf: ['feather', pal.coral], anklets: ['weight', pal.ink], tophat: ['hat', pal.ink], cowboy: ['hat', pal.brick], party: ['hat', pal.mustard],
    bandana: ['hat', pal.coral], crown: ['trophy', pal.mustard], bucket: ['bucket', pal.white], beaker: ['beaker', pal.teal], enzyme: ['dna', pal.plum], fuse: ['fuse', pal.mustard], cap: ['coin', pal.grey], boot: ['boot', pal.brick],
    shard: ['shard', pal.brick], oldspur: ['spur', pal.mustard], idol: ['trophy', pal.mustard],
    beakcap: ['spur', '#8b97a8'], mail: ['shield', '#8b97a8'], wingwax: ['feather', pal.mustard], horseshoe: ['star', pal.mustard], springs: ['up', pal.teal], flask: ['bottle', pal.coral] };
  const DRAWN = ['hat', 'face', 'neck', 'back', 'feet', 'tail'];
  ui.itemIcon = function (id, x, y, s) {
    const it = RB.items && RB.items.ITEMS[id];
    if (!ITEM_ICON[id] && it && DRAWN.includes(it.kind) && RB.art && RB.art.accIcon) { RB.art.accIcon(ui.ctx, id, x, y, s); return; } // a little picture of the thing itself
    const ic = ITEM_ICON[id] || ['bag', pal.grey]; ui.icon(ic[0], x, y, s, ic[1]);
  };
  ui.money = function (amount, x, y, o) {
    o = o || {};
    const size = o.size || 14, str = '$' + amount, w = ui.width(str, size);
    const x0 = o.align === 'right' ? x - w - size * 1.1 : o.align === 'center' ? x - (w + size * 1.1) / 2 : x;
    ui.icon('coin', x0 + size * 0.45, y - size * 0.34, size * 0.95);
    ui.text(str, x0 + size * 1.1, y, { size, color: o.color });
    return w + size * 1.1;
  };

  // ---- toasts and modals
  ui.toast = function (msg, color) { ui.toasts.push({ msg, t: 0, color: color || pal.ink }); if (ui.toasts.length > 4) ui.toasts.shift(); };
  ui.drawToasts = function (dt) {
    const ctx = ui.ctx, v = ui.view;
    let y = 58;
    for (const t of ui.toasts) {
      t.t += dt;
      const a = clamp(Math.min(t.t * 6, (3.2 - t.t) * 3), 0, 1), w = Math.min(v.w - 24, ui.width(t.msg, 13) + 28);
      ctx.globalAlpha = a; ctx.fillStyle = t.color; rr(ctx, (v.w - w) / 2, y - 6 * (1 - a), w, 28, 14); ctx.fill();
      ui.text(t.msg, v.w / 2, y + 14 - 6 * (1 - a), { size: 13, color: pal.white, align: 'center', base: 'middle', maxW: w - 16 });
      ctx.globalAlpha = 1; y += 32;
    }
    ui.toasts = ui.toasts.filter((t) => t.t < 3.2);
  };
  ui.open = function (modal) { ui.modals.push(modal); return modal; };
  ui.close = function () { const m = ui.modals.pop(); if (m && m.onClose) m.onClose(); };
  ui.closeAll = function () { ui.modals.length = 0; };
  ui.drawModals = function (dt) {
    for (let i = 0; i < ui.modals.length; i++) {
      ui.layer = i + 1;
      if (i === ui.modals.length - 1) { ui.ctx.fillStyle = pal.dim; ui.ctx.fillRect(0, 0, ui.view.w, ui.view.h); }
      const m = ui.modals[i];
      m.draw(ui, dt);
      if (ui.modals[i] !== m) break; // it closed itself
    }
    ui.layer = 0;
  };
  // A centred window with a title. Returns the content box. o: { close (default true), fill }
  ui.window = function (title, w, h, o) {
    o = o || {};
    const v = ui.view;
    w = Math.min(w, v.w - 16); h = Math.min(h, v.h - 16);
    const x = (v.w - w) / 2, y = (v.h - h) / 2;
    ui.panel(x, y, w, h, { fill: o.fill });
    ui.rect(x, y, w, 40, o.head || pal.ink, 12); ui.rect(x, y + 20, w, 20, o.head || pal.ink);
    ui.text(title, x + 14, y + 20, { size: 16, color: pal.white, base: 'middle', maxW: w - 60 });
    if (o.close !== false && (ui.btn(x + w - 36, y + 6, 28, 28, '', { icon: 'close', fill: pal.coral, flat: true, r: 8, key: 'Escape' }))) { ui.close(); return null; }
    return { x: x + 12, y: y + 48, w: w - 24, h: h - 60 };
  };
  ui.confirm = function (title, text, yes, onYes, o) {
    o = o || {};
    ui.open({ draw() {
      const lines = ui.wrap(text, Math.min(300, ui.view.w - 56), 13, false);
      const box = ui.window(title, 340, 122 + lines.length * 17, { close: false });
      ui.para(text, box.x, box.y, box.w, { size: 13 });
      const by = box.y + box.h - 40, bw = (box.w - 10) / 2;
      if (ui.btn(box.x, by, bw, 40, o.no || 'Cancel', { fill: pal.grey, key: 'Escape' })) { ui.close(); return; }
      if (ui.btn(box.x + bw + 10, by, bw, 40, yes, { fill: o.fill || pal.coral, key: 'Enter' })) { ui.close(); onYes(); }
    } });
  };
  ui.message = function (title, text, onOk, o) {
    o = o || {};
    ui.open({ draw() {
      const tw = Math.min(330, ui.view.w - 56), lines = ui.wrap(text, tw, 13, false);
      const box = ui.window(title, 360, Math.min(ui.view.h - 16, 118 + lines.length * 17), { close: false, head: o.head });
      const bodyH = box.h - 48;
      ui.list('msg' + title, box.x, box.y, box.w, bodyH, lines.length, 17, (i, x, y) => ui.text(lines[i], x, y + 13, { size: 13, bold: false }));
      if (ui.btn(box.x + box.w / 2 - 70, box.y + box.h - 40, 140, 40, o.ok || 'OK', { key: 'Enter' })) { ui.close(); if (onOk) onOk(); }
    } });
  };

  RB.ui = ui; RB.pal = pal;
})();
