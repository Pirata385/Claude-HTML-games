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

  function drawStump(ctx, prop, season, st) {
    const bx = (prop.x + 0.5) * C.CELL_W, by = prop.gy * C.CELL_H - 1.5;
    ctx.save(); ctx.translate(bx, by);
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-6, -3, -6, -10); ctx.lineTo(6, -10); ctx.quadraticCurveTo(6, -3, 10, 0);
    ctx.fillStyle = st.paper; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -10, 6, 2, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /* ---------- built things (all hollow outlines) ---------- */
  const GROUND = (o) => ((o && o.gy != null) ? o.gy : (PA.Gen ? PA.Gen.GY : 34)) * C.CELL_H - 1.6;
  function outline(ctx, st, build) { ctx.beginPath(); build(); ctx.fillStyle = st.paper; ctx.fill(); ctx.strokeStyle = st.ink; ctx.stroke(); }

  function drawBuilding(ctx, b, season, st, R, p) {
    const x0 = b.x0 * C.CELL_W, x1 = (b.x0 + b.w) * C.CELL_W, base = GROUND(b), top = (PA.Gen.GY - b.h) * C.CELL_H, mid = (x0 + x1) / 2;
    ctx.lineWidth = st.lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const roofH = Math.min(64, (x1 - x0) * 0.32);
    // roof first (behind the wall's top edge), then the wall
    if (b.roof === 'gable') outline(ctx, st, () => { ctx.moveTo(x0 - 8, top + 1.5); ctx.lineTo(mid, top - roofH); ctx.lineTo(x1 + 8, top + 1.5); ctx.closePath(); });
    else if (b.roof === 'shed') outline(ctx, st, () => { ctx.moveTo(x0 - 6, top + 1.5); ctx.lineTo(x0 - 6, top - 26); ctx.lineTo(x1 + 6, top - 8); ctx.lineTo(x1 + 6, top + 1.5); ctx.closePath(); });
    else if (b.roof === 'barn') outline(ctx, st, () => { const w = x1 - x0; ctx.moveTo(x0 - 6, top + 1.5); ctx.lineTo(x0 + w * 0.12, top - 30); ctx.lineTo(mid, top - 46); ctx.lineTo(x1 - w * 0.12, top - 30); ctx.lineTo(x1 + 6, top + 1.5); ctx.closePath(); });
    else outline(ctx, st, () => { ctx.rect(x0 - 3, top - 10, x1 - x0 + 6, 11.5); });
    if (b.chimney) outline(ctx, st, () => { ctx.rect(x1 - 34, top - roofH * 0.75 - 16, 12, roofH * 0.6 + 12); });
    outline(ctx, st, () => { ctx.rect(x0 + 1.5, top + 1.5, x1 - x0 - 3, base - top - 1.5); });
    // door (two cells) with a knob
    const dx = b.door * C.CELL_W;
    ctx.beginPath(); ctx.rect(dx + 1, base - 74, 2 * C.CELL_W - 2, 74); ctx.stroke();
    ctx.beginPath(); ctx.arc(dx + 2 * C.CELL_W - 7, base - 36, 1.8, 0, Math.PI * 2); ctx.fillStyle = st.ink; ctx.fill();
    // windows with a cross, spread on both sides of the door
    const n = b.windows, wy = top + (base - top) * 0.22, ws = 26;
    const slots = [];
    for (let i = 0; i < n; i++) { slots.push(x0 + (dx - x0) * (i + 1) / (n + 1)); slots.push(dx + 2 * C.CELL_W + (x1 - dx - 2 * C.CELL_W) * (i + 1) / (n + 1)); }
    ctx.beginPath();
    for (const wx of slots) {
      if (wx - ws / 2 < x0 + 4 || wx + ws / 2 > x1 - 4) continue;
      ctx.rect(wx - ws / 2, wy, ws, ws * 0.95);
      ctx.moveTo(wx, wy); ctx.lineTo(wx, wy + ws * 0.95);
      ctx.moveTo(wx - ws / 2, wy + ws * 0.47); ctx.lineTo(wx + ws / 2, wy + ws * 0.47);
    }
    ctx.strokeStyle = st.ink; ctx.stroke();
    // shop sign: real characters on the facade (only legible on near slices)
    if (b.sign && R && p && p.level <= 1) {
      const sy = p.oy + (top + 6) * p.scale, sx = p.ox + mid * p.scale - (b.sign.length * R.cellW) / 2;
      R.stampText(sx, sy, b.sign, { style: p.level === 0 ? 1 : 0 });
    }
  }

  function drawMine(ctx, m, season, st) {
    const x0 = m.x * C.CELL_W, x1 = (m.x + m.w) * C.CELL_W, base = GROUND(m), mid = (x0 + x1) / 2;
    ctx.lineWidth = st.lw;
    outline(ctx, st, () => { ctx.moveTo(x0, base); ctx.lineTo(x0, base - 44); ctx.quadraticCurveTo(mid, base - 80, x1, base - 44); ctx.lineTo(x1, base); ctx.closePath(); });
    ctx.beginPath();
    ctx.moveTo(x0 + 10, base); ctx.lineTo(x0 + 10, base - 50); ctx.moveTo(x1 - 10, base); ctx.lineTo(x1 - 10, base - 50);
    ctx.moveTo(x0 + 4, base - 50); ctx.lineTo(x1 - 4, base - 50);
    ctx.moveTo(mid - 14, base - 6); ctx.lineTo(mid + 14, base - 6); // rail
    ctx.stroke();
  }

  const SMALL = {
    bin(ctx, o, st) { const x = o.x * C.CELL_W - 8, b = GROUND(o); outline(ctx, st, () => ctx.rect(x, b - 18, 28, 18)); ctx.beginPath(); ctx.moveTo(x - 3, b - 22); ctx.lineTo(x + 31, b - 22); ctx.moveTo(x + 6, b - 9); ctx.lineTo(x + 22, b - 9); ctx.stroke(); },
    mailbox(ctx, o, st) { const x = (o.x + 0.5) * C.CELL_W, b = GROUND(o); ctx.beginPath(); ctx.moveTo(x, b); ctx.lineTo(x, b - 22); ctx.stroke(); outline(ctx, st, () => { ctx.rect(x - 9, b - 34, 18, 12); }); ctx.beginPath(); ctx.moveTo(x + 9, b - 30); ctx.lineTo(x + 13, b - 30); ctx.lineTo(x + 13, b - 40); ctx.stroke(); },
    well(ctx, o, st) { const x = (o.x + 0.5) * C.CELL_W, b = GROUND(o); outline(ctx, st, () => ctx.rect(x - 16, b - 16, 32, 16)); ctx.beginPath(); ctx.moveTo(x - 14, b - 16); ctx.lineTo(x - 14, b - 46); ctx.moveTo(x + 14, b - 16); ctx.lineTo(x + 14, b - 46); ctx.stroke(); outline(ctx, st, () => { ctx.moveTo(x - 22, b - 44); ctx.lineTo(x, b - 60); ctx.lineTo(x + 22, b - 44); ctx.closePath(); }); },
    fence(ctx, o, st) { const b = GROUND(o); ctx.beginPath(); for (let x = o.x0; x <= o.x1; x += 2) { ctx.moveTo((x + 0.5) * C.CELL_W, b); ctx.lineTo((x + 0.5) * C.CELL_W, b - 18); } ctx.moveTo((o.x0 + 0.5) * C.CELL_W, b - 12); ctx.lineTo((o.x1 + 0.5) * C.CELL_W, b - 12); ctx.stroke(); },
    board(ctx, o, st) { const x = (o.x + 0.5) * C.CELL_W, b = GROUND(o); ctx.beginPath(); ctx.moveTo(x - 16, b); ctx.lineTo(x - 16, b - 24); ctx.moveTo(x + 16, b); ctx.lineTo(x + 16, b - 24); ctx.stroke(); outline(ctx, st, () => ctx.rect(x - 22, b - 50, 44, 26)); ctx.beginPath(); ctx.moveTo(x - 14, b - 42); ctx.lineTo(x - 2, b - 42); ctx.moveTo(x + 4, b - 38); ctx.lineTo(x + 15, b - 38); ctx.moveTo(x - 14, b - 32); ctx.lineTo(x + 2, b - 32); ctx.stroke(); },
    fountain(ctx, o, st) { const x = (o.x + 0.5) * C.CELL_W, b = GROUND(o); outline(ctx, st, () => { ctx.moveTo(x - 30, b - 14); ctx.lineTo(x + 30, b - 14); ctx.lineTo(x + 24, b); ctx.lineTo(x - 24, b); ctx.closePath(); }); ctx.beginPath(); ctx.moveTo(x, b - 14); ctx.lineTo(x, b - 38); ctx.moveTo(x, b - 38); ctx.quadraticCurveTo(x - 14, b - 44, x - 20, b - 18); ctx.moveTo(x, b - 38); ctx.quadraticCurveTo(x + 14, b - 44, x + 20, b - 18); ctx.stroke(); },
    sign(ctx, o, st, R, p) { const x = (o.x + 0.5) * C.CELL_W, b = GROUND(o); ctx.beginPath(); ctx.moveTo(x, b); ctx.lineTo(x, b - 22); ctx.stroke(); const w = Math.max(30, o.text.length * C.CELL_W + 8); outline(ctx, st, () => ctx.rect(x - w / 2, b - 42, w, 20)); if (R && p && p.level <= 1) R.stampText(p.ox + (x - (o.text.length * C.CELL_W) / 2) * p.scale, p.oy + (b - 36) * p.scale, o.text, { style: 0 }); },
    lamp(ctx, o, st) { const x = (o.x + 0.5) * C.CELL_W, b = GROUND(o); ctx.beginPath(); ctx.moveTo(x, b); ctx.lineTo(x, b - 52); ctx.moveTo(x - 6, b); ctx.lineTo(x + 6, b); ctx.stroke(); outline(ctx, st, () => { ctx.moveTo(x - 6, b - 52); ctx.lineTo(x + 6, b - 52); ctx.lineTo(x + 4, b - 62); ctx.lineTo(x - 4, b - 62); ctx.closePath(); }); },
    bench(ctx, o, st) { const x = (o.x + 0.5) * C.CELL_W, b = GROUND(o); ctx.beginPath(); ctx.moveTo(x - 18, b - 10); ctx.lineTo(x + 18, b - 10); ctx.moveTo(x - 14, b - 10); ctx.lineTo(x - 14, b); ctx.moveTo(x + 14, b - 10); ctx.lineTo(x + 14, b); ctx.moveTo(x - 18, b - 22); ctx.lineTo(x + 18, b - 22); ctx.moveTo(x - 16, b - 22); ctx.lineTo(x - 16, b - 10); ctx.stroke(); },
  };

  /* ---------- interiors: back wall, side walls, furniture (outline only) ---------- */
  function drawRoom(ctx, r, st) {
    const x0 = r.x0 * C.CELL_W + 1.5, x1 = (r.x0 + r.w) * C.CELL_W - 1.5, base = GROUND(r), top = (r.gy - r.h) * C.CELL_H;
    outline(ctx, st, () => ctx.rect(x0, top, x1 - x0, base - top));
    ctx.beginPath(); ctx.moveTo(x0, base - 8); ctx.lineTo(x1, base - 8); ctx.stroke(); // skirting board
    ctx.beginPath();
    for (const wx of r.win) { const x = wx * C.CELL_W, y = top + 26; ctx.rect(x, y, 40, 34); ctx.moveTo(x + 20, y); ctx.lineTo(x + 20, y + 34); ctx.moveTo(x, y + 17); ctx.lineTo(x + 40, y + 17); }
    for (const px of r.pic) { const x = px * C.CELL_W, y = top + 32; ctx.rect(x, y, 30, 22); ctx.moveTo(x + 4, y + 18); ctx.lineTo(x + 12, y + 9); ctx.lineTo(x + 18, y + 15); ctx.lineTo(x + 26, y + 6); }
    if (r.clock != null) { const x = (r.clock + 0.5) * C.CELL_W, y = top + 40; ctx.moveTo(x + 9, y); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 2); }
    ctx.stroke();
  }
  function drawWalls(ctx, r, st) {
    const x0 = r.x0 * C.CELL_W + 1.5, x1 = (r.x0 + r.w) * C.CELL_W - 1.5, base = GROUND(r), top = (r.gy - r.h - 1) * C.CELL_H;
    ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(x0, top); ctx.moveTo(x1, base); ctx.lineTo(x1, top); ctx.moveTo(x0, top); ctx.lineTo(x1, top); ctx.stroke();
  }
  const FURN = {
    bed(ctx, x, b, st) { outline(ctx, st, () => ctx.rect(x, b - 16, 60, 16)); outline(ctx, st, () => ctx.rect(x, b - 34, 8, 34)); outline(ctx, st, () => ctx.rect(x + 10, b - 24, 16, 8)); ctx.beginPath(); ctx.moveTo(x + 28, b - 16); ctx.lineTo(x + 58, b - 16); ctx.stroke(); },
    table(ctx, x, b, st) { ctx.beginPath(); ctx.moveTo(x, b - 22); ctx.lineTo(x + 46, b - 22); ctx.moveTo(x + 5, b - 22); ctx.lineTo(x + 5, b); ctx.moveTo(x + 41, b - 22); ctx.lineTo(x + 41, b); ctx.stroke(); },
    desk(ctx, x, b, st) { outline(ctx, st, () => ctx.rect(x, b - 24, 46, 24)); ctx.beginPath(); ctx.rect(x + 28, b - 18, 14, 8); ctx.stroke(); },
    chair(ctx, x, b, st) { ctx.beginPath(); ctx.moveTo(x + 1, b - 12); ctx.lineTo(x + 11, b - 12); ctx.moveTo(x + 2, b - 12); ctx.lineTo(x + 2, b); ctx.moveTo(x + 10, b - 12); ctx.lineTo(x + 10, b); ctx.moveTo(x + 2, b - 12); ctx.lineTo(x + 2, b - 30); ctx.stroke(); },
    stove(ctx, x, b, st) { outline(ctx, st, () => ctx.rect(x, b - 30, 34, 30)); ctx.beginPath(); ctx.rect(x + 6, b - 20, 22, 14); ctx.moveTo(x + 14, b - 30); ctx.lineTo(x + 14, b - 60); ctx.stroke(); },
    workbench(ctx, x, b, st) { ctx.beginPath(); ctx.moveTo(x, b - 24); ctx.lineTo(x + 46, b - 24); ctx.moveTo(x + 4, b - 24); ctx.lineTo(x + 4, b); ctx.moveTo(x + 42, b - 24); ctx.lineTo(x + 42, b); ctx.moveTo(x + 4, b - 8); ctx.lineTo(x + 42, b - 8); ctx.moveTo(x + 12, b - 24); ctx.lineTo(x + 18, b - 34); ctx.moveTo(x + 15, b - 36); ctx.lineTo(x + 22, b - 32); ctx.stroke(); },
    counter(ctx, x, b, st, f) { const w = (f.w || 6) * C.CELL_W; outline(ctx, st, () => ctx.rect(x, b - 28, w, 28)); ctx.beginPath(); ctx.moveTo(x - 4, b - 28); ctx.lineTo(x + w + 4, b - 28); ctx.stroke(); },
    shelf(ctx, x, b, st) { ctx.beginPath(); for (const y of [b - 20, b - 42, b - 64]) { ctx.moveTo(x, y); ctx.lineTo(x + 46, y); } ctx.moveTo(x, b); ctx.lineTo(x, b - 70); ctx.moveTo(x + 46, b); ctx.lineTo(x + 46, b - 70); ctx.rect(x + 6, b - 32, 8, 12); ctx.rect(x + 26, b - 54, 10, 12); ctx.stroke(); },
    bookshelf(ctx, x, b, st) { outline(ctx, st, () => ctx.rect(x, b - 74, 48, 74)); ctx.beginPath(); for (const y of [b - 25, b - 50]) { ctx.moveTo(x, y); ctx.lineTo(x + 48, y); } for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) { const bx = x + 6 + k * 10; ctx.moveTo(bx, b - 4 - i * 25); ctx.lineTo(bx, b - 20 - i * 25); } ctx.stroke(); },
    anvil(ctx, x, b, st) { outline(ctx, st, () => { ctx.moveTo(x, b - 22); ctx.lineTo(x + 34, b - 22); ctx.lineTo(x + 26, b - 14); ctx.lineTo(x + 24, b); ctx.lineTo(x + 10, b); ctx.lineTo(x + 8, b - 14); ctx.closePath(); }); },
    forge(ctx, x, b, st) { outline(ctx, st, () => ctx.rect(x, b - 30, 46, 30)); outline(ctx, st, () => { ctx.moveTo(x + 4, b - 30); ctx.lineTo(x + 14, b - 64); ctx.lineTo(x + 32, b - 64); ctx.lineTo(x + 42, b - 30); ctx.closePath(); }); ctx.beginPath(); ctx.moveTo(x + 12, b - 30); ctx.lineTo(x + 17, b - 40); ctx.lineTo(x + 22, b - 32); ctx.lineTo(x + 28, b - 42); ctx.lineTo(x + 34, b - 30); ctx.stroke(); },
    fireplace(ctx, x, b, st) { outline(ctx, st, () => ctx.rect(x, b - 44, 50, 44)); ctx.beginPath(); ctx.moveTo(x + 10, b); ctx.lineTo(x + 10, b - 24); ctx.quadraticCurveTo(x + 25, b - 36, x + 40, b - 24); ctx.lineTo(x + 40, b); ctx.moveTo(x + 16, b - 4); ctx.lineTo(x + 34, b - 8); ctx.moveTo(x - 4, b - 44); ctx.lineTo(x + 54, b - 44); ctx.stroke(); },
    plant(ctx, x, b, st) { outline(ctx, st, () => { ctx.moveTo(x, b - 12); ctx.lineTo(x + 12, b - 12); ctx.lineTo(x + 10, b); ctx.lineTo(x + 2, b); ctx.closePath(); }); ctx.beginPath(); ctx.moveTo(x + 6, b - 12); ctx.lineTo(x + 1, b - 28); ctx.moveTo(x + 6, b - 12); ctx.lineTo(x + 6, b - 32); ctx.moveTo(x + 6, b - 12); ctx.lineTo(x + 12, b - 27); ctx.stroke(); },
    crate(ctx, x, b, st) { outline(ctx, st, () => ctx.rect(x, b - 22, 22, 22)); ctx.beginPath(); ctx.moveTo(x, b - 22); ctx.lineTo(x + 22, b); ctx.moveTo(x + 22, b - 22); ctx.lineTo(x, b); ctx.stroke(); },
    barrel(ctx, x, b, st) { outline(ctx, st, () => { ctx.moveTo(x + 2, b); ctx.quadraticCurveTo(x - 3, b - 13, x + 2, b - 26); ctx.lineTo(x + 20, b - 26); ctx.quadraticCurveTo(x + 25, b - 13, x + 20, b); ctx.closePath(); }); ctx.beginPath(); ctx.moveTo(x, b - 8); ctx.lineTo(x + 22, b - 8); ctx.moveTo(x, b - 18); ctx.lineTo(x + 22, b - 18); ctx.stroke(); },
    board(ctx, x, b, st, f) { const w = (f.w || 8) * C.CELL_W; outline(ctx, st, () => ctx.rect(x, b - 80, w, 54)); ctx.beginPath(); for (let i = 0; i < 6; i++) { const px = x + 8 + i * (w - 16) / 6; ctx.rect(px, b - 72 + (i % 2) * 18, 14, 14); } ctx.stroke(); },
    stairs(ctx, x, b, st) { ctx.beginPath(); ctx.moveTo(x, b); for (let i = 0; i < 5; i++) { ctx.lineTo(x + i * 10, b - (i + 1) * 12); ctx.lineTo(x + (i + 1) * 10, b - (i + 1) * 12); } ctx.lineTo(x + 50, b); ctx.stroke(); },
    hay(ctx, x, b, st) { outline(ctx, st, () => { ctx.moveTo(x, b); ctx.quadraticCurveTo(x + 18, b - 38, x + 36, b); ctx.closePath(); }); ctx.beginPath(); ctx.moveTo(x + 10, b - 8); ctx.lineTo(x + 14, b - 16); ctx.moveTo(x + 22, b - 6); ctx.lineTo(x + 24, b - 18); ctx.stroke(); },
    mat(ctx, x, b) { ctx.beginPath(); ctx.moveTo(x + 2, b - 2); ctx.lineTo(x + 34, b - 2); ctx.stroke(); },
  };
  // furniture is drawn 1.5x larger than life so it survives the conversion to characters
  function drawFurniture(ctx, f, st) {
    const fn = FURN[f.kind]; if (!fn) return;
    const x = f.x * C.CELL_W, b = GROUND(f), k = f.kind === 'counter' || f.kind === 'board' || f.kind === 'mat' ? 1 : 1.5;
    ctx.save(); ctx.translate(x, b); ctx.scale(k, k); ctx.lineWidth = st.lw / k;
    fn(ctx, 0, 0, Object.assign({}, st, { lw: st.lw / k }), f);
    ctx.restore();
  }

  function drawMineLadder(ctx, o, st) {
    const x = o.x * C.CELL_W, b = GROUND(o);
    ctx.beginPath();
    if (o.up) { for (const xx of [x, x + 12]) { ctx.moveTo(xx, b); ctx.lineTo(xx, b - 120); } for (let y = b - 10; y > b - 120; y -= 14) { ctx.moveTo(x, y); ctx.lineTo(x + 12, y); } }
    else { ctx.moveTo(x - 10, b); ctx.quadraticCurveTo(x + 6, b + 8, x + 22, b); for (const xx of [x, x + 12]) { ctx.moveTo(xx, b - 2); ctx.lineTo(xx, b - 34); } for (let y = b - 10; y > b - 34; y -= 12) { ctx.moveTo(x, y); ctx.lineTo(x + 12, y); } }
    ctx.stroke();
  }
  function drawCart(ctx, o, st) { const x = o.x * C.CELL_W, b = GROUND(o); outline(ctx, st, () => { ctx.moveTo(x - 14, b - 24); ctx.lineTo(x + 26, b - 24); ctx.lineTo(x + 20, b - 6); ctx.lineTo(x - 8, b - 6); ctx.closePath(); }); ctx.beginPath(); ctx.moveTo(x + 2, b - 3); ctx.arc(x - 1, b - 3, 3, 0, Math.PI * 2); ctx.moveTo(x + 20, b - 3); ctx.arc(x + 17, b - 3, 3, 0, Math.PI * 2); ctx.moveTo(x - 30, b); ctx.lineTo(x + 46, b); ctx.stroke(); }

  /** Horizontal extent of a prop in world px (for culling). */
  function extent(pr) {
    if (pr.type === 'building') return [pr.x0 * C.CELL_W - 20, (pr.x0 + pr.w) * C.CELL_W + 20];
    if (pr.type === 'fence') return [pr.x0 * C.CELL_W, (pr.x1 + 1) * C.CELL_W];
    if (pr.type === 'mine') return [pr.x * C.CELL_W, (pr.x + pr.w) * C.CELL_W];
    if (pr.type === 'room' || pr.type === 'walls') return [pr.x0 * C.CELL_W, (pr.x0 + pr.w) * C.CELL_W];
    if (pr.type === 'furniture') return [pr.x * C.CELL_W - 10, (pr.x + (pr.w || 6)) * C.CELL_W + 10];
    const r = pr.type === 'tree' ? 140 : 60;
    return [pr.x * C.CELL_W - r, pr.x * C.CELL_W + r];
  }

  PA.Props = { SPECIES, treeGeom, drawTree, drawBush, extent,
    draw(ctx, prop, season, st, R, p) {
      ctx.lineWidth = st.lw; ctx.strokeStyle = st.ink; ctx.fillStyle = st.paper; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (prop.type === 'tree') {
        if (prop.shake > 0.02) { ctx.save(); ctx.translate(Math.sin(prop.shake * 30) * prop.shake * 3, 0); drawTree(ctx, prop, season, st); ctx.restore(); prop.shake *= 0.86; }
        else drawTree(ctx, prop, season, st);
      }
      else if (prop.type === 'stump') drawStump(ctx, prop, season, st);
      else if (prop.type === 'bush') drawBush(ctx, prop, season, st);
      else if (prop.type === 'building') drawBuilding(ctx, prop, season, st, R, p);
      else if (prop.type === 'mine') drawMine(ctx, prop, season, st);
      else if (prop.type === 'room') drawRoom(ctx, prop, st);
      else if (prop.type === 'walls') drawWalls(ctx, prop, st);
      else if (prop.type === 'furniture') drawFurniture(ctx, prop, st);
      else if (prop.type === 'mineLadder') drawMineLadder(ctx, prop, st);
      else if (prop.type === 'cart') drawCart(ctx, prop, st);
      else if (SMALL[prop.type]) SMALL[prop.type](ctx, prop, st, R, p);
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Props;
})(typeof window !== 'undefined' ? window : globalThis);
