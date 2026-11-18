/* Weather drawn as vector strokes in screen space on top of the world; the ASCII pass turns them into / | . * */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const parts = [];
  let kind = null;
  function reset(k, W, H) {
    kind = k; parts.length = 0;
    const n = k === 'storm' ? 90 : k === 'rain' ? 55 : k === 'snow' ? 70 : k === 'wind' ? 18 : 0;
    const r = PA.RNG.mulberry32(77);
    for (let i = 0; i < n; i++) parts.push({ x: r() * W, y: r() * H, v: 0.6 + r() * 0.6, ph: r() * 6.28 });
  }
  PA.Weather = {
    draw(R, weather, season, dt, W, H, cellH) {
      const k = weather === 'wind' && season !== 'fall' && season !== 'winter' ? 'wind' : weather;
      if (k !== kind || (parts.length && (parts[0].W !== W))) { reset(k, W, H); if (parts.length) parts[0].W = W; }
      if (!parts.length || k === 'sun') return;
      const ctx = R.ctx;
      ctx.save();
      ctx.setTransform(R.bx, 0, 0, R.by, 0, 0);
      ctx.strokeStyle = '#4a4a4a'; ctx.fillStyle = '#4a4a4a'; ctx.lineWidth = 1 / R.by; ctx.lineCap = 'round';
      const sp = dt / 16.7;
      ctx.beginPath();
      for (const p of parts) {
        if (k === 'rain' || k === 'storm') {
          const len = cellH * (k === 'storm' ? 1.9 : 1.4);
          p.y += cellH * 0.9 * p.v * sp; p.x -= cellH * 0.3 * p.v * sp * (k === 'storm' ? 1.6 : 1);
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + len * (k === 'storm' ? 0.55 : 0.32), p.y - len);
        } else if (k === 'snow') {
          p.y += cellH * 0.06 * p.v * sp; p.ph += 0.03 * sp; p.x += Math.sin(p.ph) * 0.6 * sp;
          ctx.moveTo(p.x + 1.6, p.y); ctx.arc(p.x, p.y, cellH * 0.07, 0, Math.PI * 2);
        } else if (k === 'wind') {
          p.x += cellH * 0.35 * p.v * sp; p.ph += 0.08 * sp; p.y += Math.sin(p.ph) * 1.2 * sp;
          ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + cellH * 0.3, p.y - cellH * 0.25, p.x + cellH * 0.6, p.y);
        }
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * (W + 200); }
        if (p.x < -30) p.x = W + 20;
        if (p.x > W + 40) p.x = -20;
      }
      if (k === 'snow') ctx.fill(); else ctx.stroke();
      ctx.restore();
    },
    icon(w) { return { sun: '(*)', rain: '///', storm: '/!/', snow: '* *', wind: '~~>' }[w] || '(*)'; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
