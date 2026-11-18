/* World props drawn as vector outlines (trees, bushes). Geometry is pure (world px, origin = trunk base on the
 * ground line, y up is negative); draw() renders hollow outlines: strokes first, then a paper fill that erases
 * everything inside, so only the silhouette remains. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const SPECIES = {
    oak:   { trunkW: 10, trunkH: [3, 4], lobes: [5, 7], lobeR: [30, 40], rx: [100, 120], ry: [36, 48], fork: true },
    fruit: { trunkW: 0, trunkH: [2, 3], lobes: [4, 5], lobeR: [24, 32], rx: [48, 62], ry: [26, 34], fork: true, fruit: true },
    birch: { trunkW: 0, trunkH: [4, 5], lobes: [3, 4], lobeR: [20, 26], rx: [22, 30], ry: [50, 64], fork: false },
    pine:  { trunkW: 0, trunkH: [1, 2], tiers: [3, 4] },
  };

  function treeGeom(prop, season) {
    const kind = SPECIES[prop.kind] ? prop.kind : 'oak', sp = SPECIES[kind];
    const rnd = PA.RNG.mulberry32((prop.seed >>> 0) || 1);
    const ri = (a) => a[0] + Math.floor(rnd() * (a[1] - a[0] + 1));
    const rr = (a) => a[0] + rnd() * (a[1] - a[0]);
    const h = ri(sp.trunkH) * C.CELL_H;
    const g = { kind, trunk: { w: sp.trunkW, h }, lobes: [], branches: [], tiers: [], fruit: [], patchy: season === 'fall' };
    if (kind === 'pine') {
      const n = ri(sp.tiers);
      let y = -h, half = 14 + n * 9;
      for (let i = 0; i < n; i++) { g.tiers.unshift({ y, half }); y -= 26 + rnd() * 6; half *= 0.72; }
      g.top = y - 6;
      return g;
    }
    if (season === 'winter') {
      const branch = (x, y, ang, len, depth) => {
        const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        g.branches.push([x, y, x2, y2]);
        if (depth <= 0) return;
        for (const s of [-1, 1]) branch(x2, y2, ang + s * (0.3 + rnd() * 0.35), len * (0.62 + rnd() * 0.12), depth - 1);
      };
      const spread = kind === 'birch' ? 0.35 : 0.7;
      branch(0, -h, -Math.PI / 2 - spread, 34 + rnd() * 10, 2);
      branch(0, -h, -Math.PI / 2 + spread, 34 + rnd() * 10, 2);
      branch(0, -h, -Math.PI / 2 + (rnd() - 0.5) * 0.3, 40 + rnd() * 10, 1);
      return g;
    }
    const rx = rr(sp.rx), ry = rr(sp.ry), n = ri(sp.lobes);
    const cy = -h - ry * 0.85;
    g.lobes.push({ x: 0, y: cy, r: ry * 0.95 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.8, d = 0.5 + rnd() * 0.5, lr = rr(sp.lobeR);
      g.lobes.push({ x: Math.cos(a) * (rx - lr) * d, y: cy + Math.sin(a) * Math.max(4, ry - lr * 0.7) * d, r: lr });
    }
    // keep every lobe above the trunk top
    for (const L of g.lobes) if (L.y + L.r > -h + C.CELL_H) L.y = -h + C.CELL_H - L.r;
    if (sp.fork) { const w = sp.trunkW / 2; g.branches.push([-w, -h, -w - 10, -h - 18], [w, -h, w + 10, -h - 18]); }
    if (sp.fruit && season !== 'winter') {
      for (let i = 0; i < 4; i++) { const L = g.lobes[1 + (i % (g.lobes.length - 1))]; g.fruit.push({ x: L.x + (rnd() - 0.5) * L.r, y: L.y + (rnd() - 0.2) * L.r * 0.6 }); }
    }
    return g;
  }

  const cache = new Map();
  function geomCached(prop, season) {
    const key = prop.kind + ':' + prop.seed + ':' + season;
    let g = cache.get(key);
    if (!g) { g = treeGeom(prop, season); cache.set(key, g); }
    return g;
  }

  /** Draw a tree with ctx already transformed to its slice (world px). st = { lw, ink, paper } */
  function drawTree(ctx, prop, season, st) {
    const g = geomCached(prop, season);
    const bx = (prop.x + 0.5) * C.CELL_W, by = prop.gy * C.CELL_H - 1.5;
    ctx.save();
    ctx.translate(bx, by);
    ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // trunk (two lines, or one for thin trees) with a little root flare
    const w = g.trunk.w / 2, h = g.trunk.h;
    ctx.beginPath();
    if (w > 0) {
      ctx.moveTo(-w - 6, 0); ctx.quadraticCurveTo(-w, -4, -w, -12); ctx.lineTo(-w, -h - 8);
      ctx.moveTo(w + 6, 0); ctx.quadraticCurveTo(w, -4, w, -12); ctx.lineTo(w, -h - 8);
    } else { ctx.moveTo(0, 0); ctx.lineTo(0, -h - 8); }
    ctx.stroke();
    if (g.kind === 'pine') {
      ctx.beginPath();
      ctx.moveTo(0, g.top);
      for (let i = g.tiers.length - 1; i >= 0; i--) { const t = g.tiers[i]; ctx.lineTo(t.half, t.y); if (i > 0) ctx.lineTo(g.tiers[i - 1].half * 0.62, t.y); }
      for (let i = 0; i < g.tiers.length; i++) { const t = g.tiers[i]; if (i > 0) ctx.lineTo(-g.tiers[i - 1].half * 0.62, t.y); ctx.lineTo(-t.half, t.y); if (i < g.tiers.length - 1) {} }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }
    if (g.lobes.length) {
      if (g.patchy) ctx.setLineDash([st.lw * 5, st.lw * 3]);
      ctx.beginPath();
      for (const L of g.lobes) { ctx.moveTo(L.x + L.r, L.y); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2); }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const L of g.lobes) { const r = Math.max(1, L.r - st.lw * 0.6); ctx.moveTo(L.x + r, L.y); ctx.arc(L.x, L.y, r, 0, Math.PI * 2); }
      ctx.fill();
    }
    if (g.branches.length) {
      ctx.beginPath();
      for (const b of g.branches) { ctx.moveTo(b[0], b[1]); ctx.lineTo(b[2], b[3]); }
      ctx.stroke();
    }
    if (g.fruit.length) {
      ctx.fillStyle = st.ink;
      for (const f of g.fruit) { ctx.beginPath(); ctx.arc(f.x, f.y, season === 'spring' ? 1.5 : 3, 0, Math.PI * 2); season === 'spring' ? ctx.fill() : ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawBush(ctx, prop, season, st) {
    const bx = (prop.x + 0.5) * C.CELL_W, by = prop.gy * C.CELL_H - 1.5;
    const r = PA.RNG.mulberry32(prop.seed || 1);
    const lobes = [];
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) lobes.push({ x: (i - (n - 1) / 2) * 11 + (r() - 0.5) * 4, y: -9 - r() * 4, r: 9 + r() * 4 });
    ctx.save(); ctx.translate(bx, by);
    ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper;
    ctx.beginPath(); for (const L of lobes) { ctx.moveTo(L.x + L.r, L.y); ctx.arc(L.x, L.y, L.r, Math.PI, Math.PI * 2.0001); } ctx.stroke();
    ctx.beginPath(); for (const L of lobes) { const rr = L.r - st.lw * 0.6; ctx.moveTo(L.x + rr, L.y); ctx.arc(L.x, L.y, rr, 0, Math.PI * 2); } ctx.fill();
    ctx.beginPath(); ctx.moveTo(lobes[0].x - lobes[0].r, 0); ctx.lineTo(lobes[n - 1].x + lobes[n - 1].r, 0); ctx.stroke();
    ctx.restore();
  }

  PA.Props = { SPECIES, treeGeom, drawTree, drawBush,
    draw(ctx, prop, season, st) { if (prop.type === 'tree') drawTree(ctx, prop, season, st); else if (prop.type === 'bush') drawBush(ctx, prop, season, st); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Props;
})(typeof window !== 'undefined' ? window : globalThis);
