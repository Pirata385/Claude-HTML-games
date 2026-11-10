/* Filogênese — partículas e textos flutuantes (em coordenadas de mundo). */
(function (FG) {
  'use strict';
  const U = FG.U, TAU = U.TAU;
  const list = [];
  const FX = FG.FX = {
    list, max: 320,
    clear() { list.length = 0; },
    /** Cria `n` partículas do tipo dado. */
    burst(type, x, y, n, o) { for (let i = 0; i < n; i++) FX.add(type, x, y, o); },
    add(type, x, y, o) {
      if (list.length >= FX.max) { if (type !== 'text' && type !== 'ring') return null; list.shift(); }
      o = o || {};
      const a = o.a != null ? o.a : Math.random() * TAU, sp = o.sp != null ? o.sp : 0;
      const p = { type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: o.life || 1, size: o.size || 4, col: o.col || '#fff', g: 0, drag: 2, text: o.text, rot: Math.random() * TAU, vr: 0, z: 0 };
      switch (type) {
        case 'dust': p.vx = Math.cos(a) * (20 + Math.random() * 30); p.vy = Math.sin(a) * (20 + Math.random() * 30) - 10; p.life = 0.5 + Math.random() * 0.3; p.size = o.size || 3 + Math.random() * 3; p.col = o.col || 'rgba(190,170,130,0.5)'; break;
        case 'hit': { const s = 90 + Math.random() * 130; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = 0.3 + Math.random() * 0.2; p.size = 2 + Math.random() * 2.5; p.col = o.col || '#ffd9a0'; p.drag = 5; break; }
        case 'crumb': { const s = 40 + Math.random() * 60; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 30; p.g = 220; p.life = 0.5 + Math.random() * 0.3; p.size = 1.5 + Math.random() * 2; break; }
        case 'heart': case 'note': case 'star': case 'zzz': case 'q': case 'anger': case 'leafp':
          p.vx = (Math.random() - 0.5) * 40; p.vy = -34 - Math.random() * 26; p.life = o.life || 1.1 + Math.random() * 0.4; p.size = o.size || 8 + Math.random() * 4; p.drag = 0.6; p.vr = (Math.random() - 0.5) * 2; break;
        case 'dna': { const s = 60 + Math.random() * 80; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = 0.9 + Math.random() * 0.4; p.size = 3 + Math.random() * 2; p.col = o.col || '#7cf0c0'; p.drag = 3; break; }
        case 'splash': { const s = 50 + Math.random() * 90; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 40; p.g = 260; p.life = 0.45 + Math.random() * 0.25; p.size = 1.5 + Math.random() * 2.5; p.col = o.col || 'rgba(220,245,255,0.85)'; break; }
        case 'ring': p.life = o.life || 0.5; p.size = o.size || 30; break;
        case 'ripple': p.life = o.life || 0.9; p.size = o.size || 16; p.col = o.col || 'rgba(230,248,255,0.5)'; break;
        case 'text': p.vy = -42; p.life = o.life || 1.2; p.size = o.size || 15; p.drag = 1.4; break;
        case 'glow': p.vx = (Math.random() - 0.5) * 16; p.vy = (Math.random() - 0.5) * 16; p.life = o.life || 3 + Math.random() * 3; p.size = o.size || 2; p.drag = 0; p.col = o.col || '#eaff9a'; break;
        case 'shell': { const s = 40 + Math.random() * 70; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 50; p.g = 300; p.life = 0.7; p.size = 3 + Math.random() * 3; p.col = o.col || '#f3ead2'; p.vr = (Math.random() - 0.5) * 12; break; }
      }
      if (o.life) p.life = o.life;
      list.push(p);
      return p;
    },
    text(x, y, text, col, size) { return FX.add('text', x, y, { text, col: col || '#fff', size: size || 15 }); },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.t += dt;
        if (p.t >= p.life) { list[i] = list[list.length - 1]; list.pop(); continue; }
        p.vy += p.g * dt;
        const f = 1 - Math.min(1, p.drag * dt);
        p.vx *= f; p.vy = p.g ? p.vy : p.vy * f;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.type === 'glow') { p.vx += (Math.random() - 0.5) * 60 * dt; p.vy += (Math.random() - 0.5) * 60 * dt; }
      }
    },
    draw(ctx, x0, y0, x1, y1) {
      ctx.lineCap = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        const k = p.t / p.life, a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, s = p.size;
        ctx.globalAlpha = a;
        switch (p.type) {
          case 'dust': ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, s * (0.6 + k), 0, TAU); ctx.fill(); break;
          case 'hit': case 'crumb': case 'dna': case 'splash': ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, s * (1 - k * 0.5), 0, TAU); ctx.fill(); break;
          case 'shell': ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s / 2, -s / 3, s, s * 0.66); ctx.restore(); break;
          case 'glow': { const tw = 0.5 + 0.5 * Math.sin(p.t * 5 + p.rot); ctx.globalAlpha = a * tw * Math.min(1, p.t * 2); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, s * 2.4, 0, TAU); ctx.fill(); ctx.globalAlpha = a * Math.min(1, p.t * 2); ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.8, 0, TAU); ctx.fill(); break; }
          case 'ring': ctx.strokeStyle = p.col; ctx.lineWidth = 3 * (1 - k); ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(p.x, p.y, s * (0.3 + k * 0.9), 0, TAU); ctx.stroke(); break;
          case 'ripple': ctx.strokeStyle = p.col; ctx.lineWidth = 1.5; ctx.globalAlpha = (1 - k) * 0.7; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * (0.5 + k), s * (0.5 + k) * 0.7, 0, 0, TAU); ctx.stroke(); break;
          case 'heart': {
            ctx.fillStyle = p.col === '#fff' ? '#ff6f91' : p.col; const q = s * (0.6 + Math.min(1, k * 4) * 0.4);
            ctx.beginPath(); ctx.moveTo(p.x, p.y + q * 0.75);
            ctx.bezierCurveTo(p.x - q * 1.3, p.y - q * 0.1, p.x - q * 0.6, p.y - q, p.x, p.y - q * 0.35);
            ctx.bezierCurveTo(p.x + q * 0.6, p.y - q, p.x + q * 1.3, p.y - q * 0.1, p.x, p.y + q * 0.75); ctx.fill(); break;
          }
          case 'note': {
            ctx.fillStyle = ctx.strokeStyle = p.col === '#fff' ? '#bfe3ff' : p.col; const q = s * 0.55;
            ctx.beginPath(); ctx.ellipse(p.x, p.y, q, q * 0.75, -0.4, 0, TAU); ctx.fill();
            ctx.lineWidth = Math.max(1.2, s * 0.14); ctx.beginPath(); ctx.moveTo(p.x + q * 0.85, p.y); ctx.lineTo(p.x + q * 0.85, p.y - s * 1.3); ctx.lineTo(p.x + q * 2, p.y - s * 1.0); ctx.stroke(); break;
          }
          case 'star': {
            ctx.fillStyle = p.col === '#fff' ? '#ffe27a' : p.col; ctx.beginPath();
            for (let j = 0; j < 10; j++) { const r = j % 2 ? s * 0.42 : s, an = p.rot + j * Math.PI / 5; ctx.lineTo(p.x + Math.cos(an) * r, p.y + Math.sin(an) * r); }
            ctx.closePath(); ctx.fill(); break;
          }
          case 'leafp': ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.22, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
          case 'zzz': case 'q': case 'anger': {
            ctx.font = `bold ${Math.round(s * 1.5)}px system-ui, sans-serif`;
            const ch = p.type === 'zzz' ? 'z' : p.type === 'q' ? '?' : '!';
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(ch, p.x, p.y);
            ctx.fillStyle = p.type === 'anger' ? '#ff5a4a' : p.type === 'q' ? '#ffd76a' : '#dfe9ff'; ctx.fillText(ch, p.x, p.y); break;
          }
          case 'text': {
            const sc = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, (k - 0.12));
            ctx.font = `800 ${Math.round(s * sc)}px system-ui, sans-serif`;
            ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(10,14,12,0.75)'; ctx.strokeText(p.text, p.x, p.y);
            ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y); break;
          }
        }
      }
      ctx.globalAlpha = 1;
    },
  };
})(window.FG = window.FG || {});
