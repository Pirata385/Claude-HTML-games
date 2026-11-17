/* Mutatrix: cobaias em pixel art 2.5D (PixiJS). Âncoras num elipsoide giram com a cobaia;
   as partes são ordenadas por profundidade e desenhadas com contorno de 1 pixel e sombreamento chapado. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const X = MX.Pix, PAL = X.PAL;
  const TAU = Math.PI * 2;
  const TILT = 0.2;
  const R = Math.round;

  const DEF = {
    rato: { ell: { cx: -0.05, cy: -0.05, rx: 0.85, ry: 0.55, rz: 0.56 }, head: { cx: 0.78, cy: -0.34, cz: 0, r: 0.42 }, baseYaw: -0.55, feet: 0.55 },
    robo: { ell: { cx: 0, cy: -0.02, rx: 0.62, ry: 0.55, rz: 0.48 }, head: { cx: 0, cy: -0.94, cz: 0, r: 0.36 }, baseYaw: 0.4, feet: 1.02 },
    planta: { ell: { cx: 0, cy: -0.2, rx: 0.48, ry: 0.62, rz: 0.48 }, head: { cx: 0, cy: -0.82, cz: 0, r: 0.42 }, baseYaw: 0.3, feet: 1.0 },
    ameba: { ell: { cx: 0, cy: 0, rx: 1.0, ry: 0.78, rz: 0.9 }, head: { cx: 0, cy: -0.1, cz: 0.05, r: 0.78 }, baseYaw: 0.2, feet: 0.74 },
  };

  // ---------------------------------------------------------------- projeção
  function makeView(x, y, s, yaw, o) {
    o = o || {};
    const sx = o.sx || 1, sy = o.sy || 1, sz = o.sz || sx;
    return { x, y, s, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw), sx, sy, sz, flip: o.flip ? -1 : 1 };
  }
  function pr(v, X0, Y0, Z0) {
    const x = X0 * v.sx, y = Y0 * v.sy, z = Z0 * v.sz;
    const xr = x * v.cos + z * v.sin;
    const zr = -x * v.sin + z * v.cos;
    return [v.x + xr * v.s, v.y + (y * v.flip + zr * TILT) * v.s, zr];
  }
  function rotZ(v, X0, Z0) { return -X0 * v.sx * v.sin + Z0 * v.sz * v.cos; }

  // ---------------------------------------------------------------- modificadores (mesma lógica de antes)
  function gatherMods(sub, st) {
    const m = { scale: 1, sx: 1, sy: 1, color: null, pattern: null, clear: 0, glow: null, metal: 0, stone: 0, balloon: 0 };
    const b = { float: 0, hop: 0, dance: 0, sing: 0, talk: 0, hiccup: 0, clones: 0, teleport: 0, ceiling: 0, emit: [], vibrate: 0, laser: [], spin: 0 };
    for (const mu of sub.mutations) {
      if (st && st.hidden && st.hidden.has(mu.uid)) continue;
      const r = mu.render;
      if (r.body) {
        const a = r.amount || 1;
        switch (r.body) {
          case 'giant': m.scale *= 1 + 0.2 * a; break;
          case 'tiny': m.scale *= 1 - 0.24 * a; break;
          case 'color': m.color = r.color; break;
          case 'pattern': m.pattern = { id: r.pattern, color: r.color2 }; break;
          case 'clear': m.clear = Math.max(m.clear, 0.5); break;
          case 'glow': m.glow = r.color; break;
          case 'metal': m.metal = 1; break;
          case 'stone': m.stone = 1; break;
          case 'balloon': m.balloon += a; m.sx *= 1.14; m.sy *= 1.18; break;
          case 'stretch': m.sx *= 1 + 0.32 * a; m.sy *= 1 - 0.1 * a; break;
          case 'squash': m.sx *= 1 + 0.22 * a; m.sy *= 1 - 0.28 * a; break;
          default: break;
        }
      }
      if (r.beh) {
        const k = r.intensity || 1;
        switch (r.beh) {
          case 'float': b.float = Math.max(b.float, k); break;
          case 'hop': b.hop = Math.max(b.hop, k); break;
          case 'dance': b.dance = Math.max(b.dance, k); break;
          case 'sing': b.sing = Math.max(b.sing, k); break;
          case 'talk': b.talk = 1; break;
          case 'hiccup': b.hiccup = Math.max(b.hiccup, k); break;
          case 'clones': b.clones = Math.max(b.clones, r.n || 2); break;
          case 'teleport': b.teleport = 1; break;
          case 'ceiling': b.ceiling = 1; break;
          case 'emit': b.emit.push({ theme: mu.theme, color: r.color, color2: r.color2, k }); break;
          case 'vibrate': b.vibrate = Math.max(b.vibrate, k); break;
          case 'laser': b.laser.push(r.color); break;
          case 'spin': b.spin = Math.max(b.spin, k); break;
          default: break;
        }
      }
    }
    m.scale = Math.max(0.45, Math.min(1.75, m.scale));
    m.sx = Math.max(0.6, Math.min(1.8, m.sx)); m.sy = Math.max(0.5, Math.min(1.6, m.sy));
    return { mods: m, beh: b };
  }
  function coreFill(mods, base) {
    if (mods.stone) return 0xa3a39a;
    if (mods.metal) return X.mix(mods.color || base, 0xc8d4dc, 0.55);
    return X.num(mods.color || base);
  }

  // ---------------------------------------------------------------- estampas por varredura
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0);
  function overlays(g, gl, shape, mods, cx, cy, t) {
    if (!mods.pattern && !mods.stone && !mods.metal && !mods.clear) { glowSpots(gl, shape, mods, cx, cy, t); return; }
    const pc = mods.pattern ? X.num(mods.pattern.color) : 0;
    const id = mods.pattern && mods.pattern.id;
    X.scanFill(g, shape, (x, y) => {
      const lx = x - R(cx), ly = y - R(cy);
      if (mods.stone) { const h = hash(lx, ly) % 11; if (h === 0) return 0x6d6c64; if (h === 1) return 0xc9c9c0; }
      if (mods.metal && (((lx - ly) % 12) + 12) % 12 < 2) return 0xffffff;
      if (id === 'listras' && (((lx + ly) >> 2) & 1) === 0) return pc;
      if (id === 'bolinhas' && ((lx + 60) % 6) < 2 && ((ly + 60 + (((lx + 60) / 6 | 0) % 2) * 3) % 6) < 2) return pc;
      if (id === 'xadrez' && ((((lx + 64) >> 2) + ((ly + 64) >> 2)) & 1)) return pc;
      if (id === 'zigue' && ((ly + 60 + Math.abs(((lx + 64) % 8) - 4)) % 6) < 2) return pc;
      return null;
    });
    if (mods.clear) {
      // esqueleto visível
      g.moveTo(R(cx - 8), R(cy)).lineTo(R(cx + 8), R(cy)).stroke({ width: 1, color: PAL.ink, alpha: 0.35 });
      for (let i = -2; i <= 2; i++) g.moveTo(R(cx + i * 3), R(cy - 2)).lineTo(R(cx + i * 3 + 1), R(cy + 4)).stroke({ width: 1, color: PAL.ink, alpha: 0.3 });
      g.circle(R(cx + 3), R(cy + 1), 2 + (Math.sin(t * 7) > 0 ? 1 : 0)).fill({ color: PAL.pink, alpha: 0.7 });
    }
    if (mods.stone) {
      g.moveTo(R(cx - 6), R(cy - 5)).lineTo(R(cx - 2), R(cy - 1)).lineTo(R(cx - 4), R(cy + 3)).lineTo(R(cx), R(cy + 6)).stroke({ width: 1, color: PAL.ink, alpha: 0.6 });
    }
    glowSpots(gl, shape, mods, cx, cy, t);
  }
  function glowSpots(gl, shape, mods, cx, cy, t) {
    if (!mods.glow || !gl) return;
    const c = X.num(mods.glow);
    const r = shape.t === 'ell' ? Math.min(shape.rx, shape.ry) : 8;
    for (let i = 0; i < 5; i++) {
      const a = i * 2.1 + t * 0.3;
      gl.rect(R(cx + Math.cos(a) * r * 0.55), R(cy + Math.sin(a * 1.3) * r * 0.45), 2, 2).fill({ color: c, alpha: 0.7 + 0.3 * Math.sin(t * 3 + i) });
    }
  }

  // ---------------------------------------------------------------- olhos em pixel
  function eye(g, x, y, r, o) {
    o = o || {};
    x = R(x); y = R(y);
    const blink = (o.blink || 0) > 0.55;
    const sq = o.squash === undefined ? 1 : o.squash;
    if (o.mat === 'metal') {
      const rr = Math.max(2, R(r * 1.1));
      g.circle(x, y, rr + 1).fill(PAL.ink);
      g.circle(x, y, rr).fill(0x2a2f45);
      if (blink) { g.rect(x - rr + 1, y, rr * 2 - 1, 1).fill(X.num(o.iris || PAL.yellow)); return; }
      const ir = Math.max(1, R(rr * 0.6));
      g.circle(x + R((o.lx || 0) * rr * 0.35), y + R((o.ly || 0) * rr * 0.3), ir).fill(X.num(o.iris || PAL.yellow));
      g.rect(x - rr + 1, y - rr + 1, 1, 1).fill(PAL.white);
      if (o.glow) o.glow.circle(x, y, rr + 2).fill({ color: X.num(o.iris || PAL.yellow), alpha: 0.35 });
      return;
    }
    if (r < 2.2) {
      if (blink) { g.rect(x - 1, y, 3, 1).fill(PAL.ink); return; }
      g.rect(x - 1, y - 1, 2, 3).fill(X.num(o.iris || PAL.ink));
      g.rect(x - 1, y - 1, 1, 1).fill(PAL.white);
      return;
    }
    const rx = Math.max(1.5, r * sq);
    if (blink) { g.rect(R(x - rx) - 1, y - 1, R(rx * 2) + 2, 3).fill(PAL.ink); g.rect(R(x - rx), y, R(rx * 2), 1).fill(X.num(o.lid || PAL.ink)); return; }
    X.ell(g, x, y, rx, r, o.white === undefined ? PAL.white : o.white, { flat: true, alpha: o.alpha });
    const pr2 = Math.max(1, r * (o.pupil || 0.55));
    const px = x + R((o.lx || 0) * rx * 0.4), py = y + R((o.ly || 0) * r * 0.35);
    if (o.slit) {
      g.ellipse(px, py, Math.max(1, pr2 * sq), pr2).fill(X.num(o.iris || PAL.ink));
      g.rect(px, R(py - pr2 * 0.8), 1, Math.max(2, R(pr2 * 1.6))).fill(PAL.ink);
    } else g.ellipse(px, py, Math.max(1, pr2 * sq), pr2).fill(X.num(o.iris || PAL.ink));
    g.rect(R(px - pr2 * 0.5), R(py - pr2 * 0.6), 1, 1).fill(PAL.white);
  }

  // ---------------------------------------------------------------- disposição das partes (cacheada)
  const layoutCache = new Map();
  function layoutFor(sub, m) {
    const r = m.render;
    const key = sub.seed + ':' + sub.host + ':' + m.uid + ':' + (r.n || 1);
    let L = layoutCache.get(key);
    if (L) return L;
    const rng = MX.RNG.make(r.seed);
    const n = r.n || 1;
    L = [];
    const add = (u, v, onHead, extra) => L.push(Object.assign({ u, v, onHead, ph: rng.range(0, TAU), k: rng.range(0.82, 1.18) }, extra || {}));
    const rnd = (a, b) => rng.range(a, b);
    switch (r.part) {
      case 'eye': for (let i = 0; i < n; i++) add(rnd(-1.5, 1.5), rnd(-0.15, 0.9), rng.chance(0.5)); break;
      case 'bigeye': add(rnd(-0.35, 0.35), rnd(0.05, 0.35), sub.host === 'planta' || sub.host === 'robo'); break;
      case 'tentacle': for (let i = 0; i < n; i++) add((i / n) * TAU + rnd(-0.5, 0.5), rnd(-0.75, -0.2), false); break;
      case 'wing': for (let i = 0; i < n; i += 2) { const v = 0.55 - i * 0.18; add(Math.PI - 0.95, v, false, { side: -1 }); add(Math.PI + 0.95, v, false, { side: 1 }); } break;
      case 'horn':
        if (n === 2) { add(-0.75, 0.75, true, { side: -1 }); add(0.75, 0.75, true, { side: 1 }); }
        else for (let i = 0; i < n; i++) add(n === 1 ? 0 : -0.9 + (1.8 * i) / (n - 1), rnd(0.6, 1.0), true, { side: i % 2 ? 1 : -1 });
        break;
      case 'spikes': for (let i = 0; i < n; i++) add(rnd(0, TAU), rnd(0.05, 1.3), false); break;
      case 'antenna': for (let i = 0; i < n; i++) add(-0.6 + (1.2 * i) / Math.max(1, n - 1), rnd(1.0, 1.3), true); break;
      case 'mouth': for (let i = 0; i < n; i++) add(rnd(-0.9, 0.9), rnd(-0.35, 0.2), false); break;
      case 'tail': for (let i = 0; i < n; i++) add(Math.PI + rnd(-0.7, 0.7), rnd(-0.3, 0.1), false); break;
      case 'arms': for (let i = 0; i < n; i++) add((i % 2 ? 1 : -1) * (Math.PI / 2 + rnd(-0.45, 0.45)), rnd(-0.4, 0.15), false, { side: i % 2 ? 1 : -1 }); break;
      case 'crystals': for (let i = 0; i < n; i++) add(Math.PI + rnd(-1.5, 1.5), rnd(0.2, 1.25), false, { len: rnd(0.7, 1.35) }); break;
      case 'flowers': for (let i = 0; i < n; i++) add(rnd(0, TAU), rnd(0.15, 1.3), rng.chance(0.35)); break;
      case 'mushrooms': case 'lamp': for (let i = 0; i < n; i++) add(Math.PI + rnd(-1.6, 1.6), rnd(0.3, 1.1), false); break;
      case 'fin': for (let i = 0; i < n; i++) add(Math.PI + (i - (n - 1) / 2) * 0.9, rnd(0.55, 1.0), false); break;
      case 'gills': add(Math.PI / 2, 0.05, false); add(-Math.PI / 2, 0.05, false); break;
      case 'chimney': add(Math.PI * 0.85, 0.85, false); break;
      case 'propeller': add(0, Math.PI / 2, true); break;
      case 'speaker': add(0.2, -0.05, false); break;
      case 'head2': add(rng.chance(0.5) ? 1.1 : -1.1, 0.7, false); break;
      case 'hair': for (let i = 0; i < 12; i++) add(rnd(0, TAU), rnd(0.55, 1.45), sub.host !== 'rato'); break;
      case 'fangs': add(0, -0.5, true); break;
      case 'stinger': add(Math.PI, -0.1, false); break;
      default: add(0, 0, false); break;
    }
    layoutCache.set(key, L);
    if (layoutCache.size > 600) layoutCache.delete(layoutCache.keys().next().value);
    return L;
  }
  function anchorLocal(def, inst, host) {
    if (host === 'rato' && inst.onHead && inst.u === 0 && inst.v === -0.5) return { p: [def.head.cx + 0.42, def.head.cy + 0.2, 0], n: [0.35, 1, 0] };
    const cu = Math.cos(inst.u), su = Math.sin(inst.u), cv = Math.cos(inst.v), sv = Math.sin(inst.v);
    const dx = su * cv, dy = -sv, dz = cu * cv;
    if (inst.onHead) { const h = def.head; return { p: [h.cx + dx * h.r, h.cy + dy * h.r, h.cz + dz * h.r], n: [dx, dy, dz] }; }
    const e = def.ell;
    return { p: [e.cx + dx * e.rx, e.cy + dy * e.ry, dz * e.rz], n: [dx, dy, dz] };
  }

  // ---------------------------------------------------------------- partes
  // A: âncora [x, y]; d: direção para fora; S: tamanho base em px; F: cor; o: opções.
  function drawPart(g, gl, type, A, d, S, F, o) {
    const t = o.t, ph = o.ph, mat = o.mat;
    const px = -d[1], py = d[0];
    switch (type) {
      case 'eye': {
        const r = Math.max(1.5, S * 0.13);
        eye(g, A[0] + d[0] * r * 0.4, A[1] + d[1] * r * 0.4, r, { mat, iris: mat === 'metal' ? F : X.dark(F, 0.35), lx: o.lx, ly: o.ly, blink: o.blink, squash: Math.max(0.4, Math.min(1, 0.45 + 0.55 * o.facing)), glow: gl });
        if (mat === 'leaf') g.rect(R(A[0]), R(A[1] - r - 2), 1, 2).fill(PAL.green);
        break;
      }
      case 'bigeye': {
        const r = Math.max(3, S * 0.3);
        const cx = A[0] + d[0] * r * 0.3, cy = A[1] + d[1] * r * 0.3;
        X.ell(g, cx, cy, r + 1, r + 1, X.dark(F, 0.15), { noHi: true });
        eye(g, cx, cy, r, { mat: mat === 'metal' ? 'metal' : null, iris: F, lx: o.lx, ly: o.ly, blink: o.blink, slit: true, pupil: 0.62, squash: Math.max(0.45, Math.min(1, 0.5 + 0.5 * o.facing)), lid: X.dark(F, 0.15), glow: gl });
        if (mat !== 'metal' && !(o.blink > 0.55)) { g.rect(R(cx + r * 0.5), R(cy - r * 0.3), 1, 2).fill(PAL.red); g.rect(R(cx - r * 0.6), R(cy + r * 0.4), 2, 1).fill(PAL.red); }
        break;
      }
      case 'tentacle': case 'tail': case 'stinger': {
        const isT = type === 'tentacle';
        const L = S * (isT ? 0.95 : type === 'tail' ? 0.85 : 0.75);
        const pts = [];
        let ang = Math.atan2(d[1], d[0]);
        if (!isT) ang = Math.atan2(d[1] * 0.4 + (type === 'stinger' ? -0.6 : 0.2), d[0]);
        let x = A[0], y = A[1];
        const N = 7;
        for (let i = 0; i < N; i++) {
          pts.push([x, y]);
          const k = i / (N - 1);
          ang += Math.sin(t * (isT ? 2.2 : 3.2) * o.wob + ph + i * 0.8) * (isT ? 0.38 : 0.26) * k + (type === 'stinger' ? -0.26 : isT ? 0.06 : -0.14) * k;
          x += Math.cos(ang) * L / (N - 1); y += Math.sin(ang) * L / (N - 1);
        }
        const w0 = Math.max(2, S * (isT ? 0.17 : 0.11)), w1 = Math.max(1, S * 0.04);
        if (mat === 'metal' && isT) {
          X.tube(g, pts, w0 * 0.8, w0 * 0.65, X.mix(F, 0x94b0c2, 0.45));
          for (let i = 1; i < N - 1; i += 2) X.px(g, pts[i][0], pts[i][1], PAL.ink, 1);
          const e = pts[N - 1];
          X.rect(g, e[0] - 1, e[1] - 1, 3, 3, PAL.yellow);
        } else {
          X.tube(g, pts, w0, w1, F, { alpha: mat === 'gel' ? 0.85 : undefined });
          if (isT && mat !== 'leaf') for (let i = 2; i < N - 1; i += 2) X.px(g, pts[i][0] + px * w0 * 0.25, pts[i][1] + py * w0 * 0.25, X.light(F, 0.55), 1);
          if (mat === 'leaf') for (let i = 2; i < N - 1; i += 2) X.ell(g, pts[i][0] + px * 3, pts[i][1] + py * 3, 2, 1, PAL.lime, { flat: true });
          const e = pts[N - 1];
          if (type === 'tail' && mat === 'fur') X.ell(g, e[0], e[1], 2, 2, X.dark(F, 0.25), { flat: true });
          if (type === 'stinger') {
            X.poly(g, [[e[0] + Math.cos(ang) * 5, e[1] + Math.sin(ang) * 5], [e[0] + Math.cos(ang + 1.9) * 2, e[1] + Math.sin(ang + 1.9) * 2], [e[0] + Math.cos(ang - 1.9) * 2, e[1] + Math.sin(ang - 1.9) * 2]], PAL.dark);
            if (o.emit) o.emit.push({ x: e[0], y: e[1], kind: 'drip', color: 0xa7f070 });
          }
        }
        break;
      }
      case 'wing': {
        const side = o.side || 1;
        const span = S * 0.95;
        const flap = Math.sin(t * 7 * o.wob + ph) * 0.35;
        const base = Math.atan2(-0.85, side * 0.6) + flap * -side;
        const P2 = (a, r) => [A[0] + Math.cos(a) * r, A[1] + Math.sin(a) * r];
        if (mat === 'metal') {
          for (let i = 0; i < 3; i++) { const a = base + side * i * 0.35; X.tube(g, [A, P2(a, span * (1 - i * 0.15))], Math.max(3, S * 0.15), Math.max(2, S * 0.08), X.mix(F, 0xc8d4dc, 0.5 - i * 0.1)); }
        } else if (mat === 'leaf') {
          const tip = P2(base, span), m1 = P2(base + side * 0.45, span * 0.6), m2 = P2(base - side * 0.35, span * 0.55);
          X.poly(g, [A, m1, tip, m2], F);
          X.line(g, [A, tip], 1, X.dark(F, 0.35));
        } else {
          const pts = [A, P2(base, span)];
          for (let i = 1; i <= 3; i++) { const a = base + side * i * 0.32; const r = span * (0.92 - i * 0.12); pts.push(P2(a - side * 0.16, r * 0.8)); pts.push(P2(a, r)); }
          X.poly(g, pts, mat === 'gel' ? X.light(F, 0.3) : F, { alpha: mat === 'gel' ? 0.75 : undefined });
          for (let i = 0; i <= 3; i++) { const a = base + side * i * 0.32; X.line(g, [A, P2(a, span * (i === 0 ? 1 : 0.92 - i * 0.12))], 1, X.dark(F, 0.4)); }
        }
        break;
      }
      case 'horn': {
        const L = S * 0.55 * (o.k || 1);
        const side = o.side || 0;
        const pts = [];
        let ang = Math.atan2(d[1] - 0.6, d[0] + side * 0.1);
        let x = A[0], y = A[1];
        for (let i = 0; i < 5; i++) { pts.push([x, y]); ang += side * 0.2 - 0.02; x += Math.cos(ang) * L / 4; y += Math.sin(ang) * L / 4; }
        X.tube(g, pts, Math.max(3, S * 0.17), 1, X.mix(F, 0xefe3c8, 0.45));
        break;
      }
      case 'spikes': {
        const L = Math.max(4, S * 0.3 * (o.k || 1)), w = Math.max(2, S * 0.07);
        X.poly(g, [[A[0] + px * w, A[1] + py * w], [A[0] + d[0] * L, A[1] + d[1] * L], [A[0] - px * w, A[1] - py * w]], mat === 'leaf' ? X.mix(F, 0xf4e8c8, 0.3) : X.dark(F, 0.1));
        break;
      }
      case 'antenna': {
        const L = S * 0.6;
        const sway = Math.sin(t * 2.4 + ph) * 0.25;
        const ex = A[0] + (d[0] * 0.4 + sway) * L, ey = A[1] + (d[1] * 0.4 - 0.9) * L;
        X.line(g, [A, [(A[0] + ex) / 2 + sway * 2, (A[1] + ey) / 2], [ex, ey]], 1, PAL.ink);
        const on = Math.sin(t * 4 + ph) > 0;
        X.circ(g, ex, ey, 2, on ? X.light(F, 0.3) : F, { flat: true });
        if (on && gl) gl.circle(R(ex), R(ey), 4).fill({ color: X.num(F), alpha: 0.4 });
        break;
      }
      case 'mouth': {
        const r = Math.max(3, S * 0.2);
        const open = 0.35 + 0.35 * Math.max(0, Math.sin(t * 3 * o.wob + ph));
        const cx = R(A[0] + d[0] * r * 0.2), cy = R(A[1] + d[1] * r * 0.2);
        const sq = Math.max(0.4, Math.min(1, 0.45 + 0.55 * o.facing));
        if (mat === 'leaf') {
          X.poly(g, [[cx - r * sq, cy], [cx - r * 0.5 * sq, cy - r * (0.4 + open)], [cx + r * 0.5 * sq, cy - r * (0.4 + open)], [cx + r * sq, cy]], X.dark(F, 0.1));
          X.poly(g, [[cx - r * sq, cy], [cx - r * 0.5 * sq, cy + r * (0.4 + open)], [cx + r * 0.5 * sq, cy + r * (0.4 + open)], [cx + r * sq, cy]], F);
          for (let i = -1; i <= 1; i++) X.px(g, cx + i * 2, cy - 1, PAL.white, 1);
        } else {
          X.ell(g, cx, cy, r * sq, Math.max(1.5, r * open), 0x5d1830, { flat: true, ink: X.dark(F, 0.3) });
          g.rect(R(cx - r * sq * 0.6), R(cy - r * open) + 1, Math.max(1, R(r * sq * 1.2)), 1).fill(PAL.white);
          X.ell(g, cx, cy + Math.max(1, R(r * open * 0.4)), Math.max(1, r * sq * 0.45), 1, PAL.pink, { flat: true, noOutline: true });
        }
        break;
      }
      case 'arms': {
        const side = o.side || 1;
        const L = S * 0.3;
        const wave = Math.sin(t * 5 * o.wob + ph) * 0.7;
        const a1 = Math.atan2(d[1] + 0.2, d[0]);
        const e = [A[0] + Math.cos(a1) * L, A[1] + Math.sin(a1) * L];
        const a2 = a1 - side * 0.5 - 1.1 + wave * 0.6;
        const h = [e[0] + Math.cos(a2) * L * 0.85, e[1] + Math.sin(a2) * L * 0.85];
        X.line(g, [A, e, h], Math.max(1, R(S * 0.07)), mat === 'metal' ? X.mix(F, 0xc8d4dc, 0.5) : F, { outline: true });
        X.circ(g, h[0], h[1], 1.5, mat === 'metal' ? PAL.yellow : X.light(F, 0.2), { flat: true });
        break;
      }
      case 'crystals': {
        const L = Math.max(5, S * 0.36 * (o.len || 1)), w = Math.max(2, S * 0.1);
        const tip = [A[0] + d[0] * L, A[1] + d[1] * L];
        const m1 = [A[0] + d[0] * L * 0.7 + px * w, A[1] + d[1] * L * 0.7 + py * w];
        const m2 = [A[0] + d[0] * L * 0.7 - px * w, A[1] + d[1] * L * 0.7 - py * w];
        X.poly(g, [[A[0] + px * w * 0.7, A[1] + py * w * 0.7], m1, tip, m2, [A[0] - px * w * 0.7, A[1] - py * w * 0.7]], X.light(F, 0.2), { alpha: 0.95 });
        X.line(g, [[A[0] + px * w * 0.3, A[1] + py * w * 0.3], [tip[0] + px, tip[1] + py]], 1, X.light(F, 0.6));
        if (gl && Math.sin(t * 3 + ph * 3) > 0.85) gl.rect(R(tip[0]) - 1, R(tip[1]) - 1, 3, 3).fill({ color: 0xffffff, alpha: 0.9 });
        break;
      }
      case 'flowers': {
        const st = Math.max(3, S * 0.14);
        const cx = A[0] + d[0] * st, cy = A[1] + d[1] * st;
        X.line(g, [A, [cx, cy]], 1, PAL.teal);
        const r = Math.max(1.5, S * 0.07);
        const rot = t * 0.6 + ph;
        for (let i = 0; i < 5; i++) { const a = rot + i / 5 * TAU; X.circ(g, cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3, r, F, { flat: true }); }
        X.circ(g, cx, cy, Math.max(1, r * 0.8), PAL.yellow, { flat: true });
        break;
      }
      case 'mushrooms': case 'lamp': {
        const h = Math.max(3, S * 0.16);
        const cx = A[0] + d[0] * h, cy = A[1] + d[1] * h;
        X.line(g, [A, [cx, cy]], Math.max(2, R(S * 0.06)), 0xf4e8c8, { outline: true });
        const r = Math.max(3, S * 0.13);
        if (type === 'lamp') {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2 + ph);
          if (gl) { gl.circle(R(cx), R(cy - 1), R(r * 2.4)).fill({ color: X.num(F), alpha: 0.18 + 0.15 * pulse }); gl.circle(R(cx), R(cy - 1), R(r * 1.5)).fill({ color: X.num(F), alpha: 0.2 }); }
          X.ell(g, cx, cy - 1, r, r * 0.7, X.light(F, 0.3 + 0.3 * pulse), { noHi: true });
        } else {
          X.ell(g, cx, cy - 1, r, r * 0.75, F);
          X.px(g, cx - r * 0.4, cy - r * 0.4, PAL.white, 1); X.px(g, cx + r * 0.3, cy - r * 0.2, PAL.white, 1);
        }
        break;
      }
      case 'fin': {
        const L = S * 0.42;
        const wave = Math.sin(t * 3 + ph) * 0.12;
        const tip = [A[0] + (d[0] + px * 0.6 + wave) * L, A[1] + (d[1] + py * 0.6) * L];
        const b1 = [A[0] + px * S * 0.15, A[1] + py * S * 0.15], b2 = [A[0] - px * S * 0.15, A[1] - py * S * 0.15];
        X.poly(g, [b1, tip, b2], F, { alpha: mat === 'gel' ? 0.8 : undefined });
        X.line(g, [A, tip], 1, X.dark(F, 0.35));
        break;
      }
      case 'gills': {
        if (o.facing < 0.1) break;
        const open = Math.sin(t * 2.5 + ph) > 0;
        for (let i = -1; i <= 1; i++) {
          const ox = A[0] + px * i * 3, oy = A[1] + py * i * 3;
          X.line(g, [[ox - d[0] * 0, oy - 3], [ox, oy + 3]], open ? 2 : 1, open ? PAL.pink : PAL.ink);
        }
        break;
      }
      case 'chimney': {
        const w = Math.max(5, S * 0.2), h = Math.max(7, S * 0.36);
        const x = A[0] - w / 2, y = A[1] - h;
        X.rect(g, x, y, w, h, 0xc9573f);
        for (let r = 1; r < 4; r++) g.rect(R(x), R(y + r * h / 4), R(w), 1).fill(0x8a3a2a);
        X.rect(g, x - 1, y - 2, w + 2, 2, 0x8a3a2a);
        if (o.emit) o.emit.push({ x: A[0], y: y - 3, kind: 'smoke', color: 0x94b0c2 });
        break;
      }
      case 'propeller': {
        const mast = Math.max(3, S * 0.2);
        const cx = A[0], cy = A[1] - mast;
        X.line(g, [A, [cx, cy]], 1, PAL.ink);
        const a = t * 18, L = S * 0.42;
        for (let i = 0; i < 2; i++) { const k = Math.cos(a + i * Math.PI); X.ell(g, cx + k * L * 0.5, cy, Math.abs(k) * L * 0.5 + 1, 1.5, F, { flat: true }); }
        X.px(g, cx - 1, cy - 1, PAL.yellow, 2);
        break;
      }
      case 'speaker': {
        if (o.facing < -0.2) break;
        const r = Math.max(3, S * 0.2);
        const pulse = Math.sin(t * 9) > 0.3 ? 1 : 0;
        const sq = Math.max(0.35, Math.min(1, 0.4 + 0.6 * o.facing));
        X.ell(g, A[0], A[1], r * sq * 1.1, r * 1.1, 0x2a2f45, { flat: true });
        X.ell(g, A[0], A[1], r * sq * 0.75 + pulse, r * 0.75 + pulse, F, { noHi: true, noOutline: true });
        X.ell(g, A[0], A[1], Math.max(1, r * sq * 0.3), Math.max(1, r * 0.3), X.dark(F, 0.35), { flat: true, noOutline: true });
        if (o.emit) o.emit.push({ x: A[0], y: A[1] - r, kind: 'note', color: X.num(F) });
        break;
      }
      case 'head2': {
        const nk = S * 0.32;
        const h = [A[0] + d[0] * nk, A[1] + d[1] * nk - S * 0.1];
        X.tube(g, [A, [(A[0] + h[0]) / 2, (A[1] + h[1]) / 2 + 1], h], Math.max(3, S * 0.15), Math.max(3, S * 0.12), o.body);
        const r = Math.max(4, S * 0.24);
        if (o.host === 'robo') { X.rect(g, h[0] - r, h[1] - r * 0.8, r * 2, r * 1.6, o.body, { bevel: true }); eye(g, h[0], h[1], r * 0.45, { mat: 'metal', iris: F, blink: o.blink, glow: gl }); }
        else if (o.host === 'ameba') { X.ell(g, h[0], h[1], r * 1.1, r * 0.9, o.body, { alpha: 0.88 }); eye(g, h[0] - r * 0.4, h[1] - r * 0.15, Math.max(1.5, r * 0.3), { blink: o.blink }); eye(g, h[0] + r * 0.4, h[1] - r * 0.15, Math.max(1.5, r * 0.3), { blink: o.blink }); }
        else {
          if (o.host === 'rato') { X.circ(g, h[0] - r * 0.7, h[1] - r * 0.75, r * 0.45, o.body, { flat: true }); X.circ(g, h[0] + r * 0.7, h[1] - r * 0.75, r * 0.45, o.body, { flat: true }); }
          X.circ(g, h[0], h[1], r, o.body);
          eye(g, h[0] - r * 0.4, h[1] - r * 0.1, Math.max(1.5, r * 0.28), { blink: o.blink, iris: F }); eye(g, h[0] + r * 0.4, h[1] - r * 0.1, Math.max(1.5, r * 0.28), { blink: o.blink, iris: F });
          g.rect(R(h[0] - 1), R(h[1] + r * 0.4), 3, 1).fill(PAL.ink);
        }
        break;
      }
      case 'hair': {
        const L = S * 0.55 * (o.k || 1);
        const pts = [];
        let x = A[0], y = A[1];
        let ang = Math.atan2(d[1], d[0]);
        for (let i = 0; i < 5; i++) { pts.push([x, y]); ang += 0.32 + Math.sin(t * 2 + ph + i) * 0.14; x += Math.cos(ang) * L / 4; y += Math.sin(ang) * L / 4; }
        X.line(g, pts, Math.max(1, R(S * 0.06)), F, { outline: true });
        break;
      }
      case 'fangs': {
        if (o.facing < -0.3) break;
        for (const s of [-1, 1]) {
          const bx = A[0] + px * s * 3, by = A[1] + py * s * 3;
          X.poly(g, [[bx - 1, by], [bx + 2, by], [bx + 0.5, by + Math.max(3, S * 0.18)]], PAL.white);
        }
        break;
      }
      default: break;
    }
  }

  function drawShell(g, c, rx, ry, F) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; pts.push([c[0] + Math.cos(a) * rx * 0.96, c[1] + ry * 0.05 + Math.sin(a) * ry * 0.92]); }
    X.poly(g, pts, F);
    const sh = { t: 'poly', pts };
    const dk = X.dark(F, 0.35);
    X.scanFill(g, sh, (x, y) => { const ly = y - R(c[1]); const lx = x - R(c[0]); return ((ly + 200) % 5 === 0) || (((lx + 200 + (((ly + 200) / 5 | 0) % 2) * 4) % 8) === 0) ? dk : null; });
  }
  function drawMane(g, hc, r, F, t) {
    const pts = [];
    const n = 16;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + Math.sin(t * 1.5) * 0.05; const k = i % 2 ? 1.25 : 1.6; pts.push([hc[0] + Math.cos(a) * r * k, hc[1] + Math.sin(a) * r * k * 0.95]); }
    X.poly(g, pts, F);
  }
  function drawCrest(g, hc, r, F, t) {
    const pts = [];
    for (let i = 0; i <= 8; i++) { const a = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.7; const k = i % 2 ? 1.2 : 1.6 + Math.sin(t * 2 + i) * 0.05; pts.push([hc[0] + Math.cos(a) * r * k, hc[1] + Math.sin(a) * r * k]); }
    pts.push([hc[0] + Math.cos(-Math.PI * 0.15) * r * 0.6, hc[1] + Math.sin(-Math.PI * 0.15) * r * 0.6]);
    pts.push([hc[0] + Math.cos(-Math.PI * 0.85) * r * 0.6, hc[1] + Math.sin(-Math.PI * 0.85) * r * 0.6]);
    X.poly(g, pts, F);
  }

  // ---------------------------------------------------------------- núcleos das espécies
  function coreRato(g, gl, v, sub, st, mods, items, t) {
    const b = sub.base, d = DEF.rato;
    const fur = coreFill(mods, b.fur);
    const belly = mods.color || mods.stone || mods.metal ? X.light(fur, 0.3) : X.num(b.belly);
    const alpha = mods.clear ? 1 - mods.clear : undefined;
    const e = d.ell;
    const c = pr(v, e.cx, e.cy, 0);
    const rxs = Math.hypot(e.rx * v.cos * v.sx, e.rz * v.sin * v.sz) * v.s;
    const rys = Math.hypot(e.ry * v.sy, e.rz * v.sz * TILT * Math.abs(v.cos)) * v.s;
    for (const [fx, fz] of [[0.45, 0.3], [0.45, -0.3], [-0.5, 0.3], [-0.5, -0.3]]) {
      const p = pr(v, fx, 0.5, fz);
      items.push({ z: p[2] * 0.5, f: () => X.ell(g, p[0], p[1], Math.max(2, v.s * 0.12), Math.max(1, v.s * 0.06), b.nose, { flat: true }) });
    }
    const tail = [];
    for (let i = 0; i < 6; i++) { const k = i / 5; tail.push(pr(v, -0.82 - k * 0.85, 0.15 - Math.sin(k * 2.6) * 0.45, Math.sin(t * 2.2 + k * 3 + b.phase) * 0.22 * k)); }
    items.push({ z: tail[2][2] - 0.2, f: () => X.tube(g, tail.map((p) => [p[0], p[1]]), Math.max(2, v.s * 0.1), 1, b.nose, { flat: true }) });
    items.push({
      z: 0, f: () => {
        X.ell(g, c[0], c[1], rxs, rys, fur, { alpha });
        X.ell(g, c[0] + rxs * 0.05, c[1] + rys * 0.45, rxs * 0.62, rys * 0.42, belly, { flat: true, noOutline: true, alpha });
        overlays(g, gl, { t: 'ell', x: c[0], y: c[1], rx: rxs - 1, ry: rys - 1 }, mods, c[0], c[1], t);
        if (!mods.metal && !mods.stone) for (let i = 0; i < 4; i++) { const a = -2.4 + i * 0.35; X.px(g, c[0] + Math.cos(a) * rxs * 0.8, c[1] + Math.sin(a) * rys * 0.8, X.dark(fur, 0.25), 1); }
      },
    });
    const h = d.head;
    const hc = pr(v, h.cx, h.cy, h.cz);
    const hr = h.r * v.s * Math.sqrt(v.sx * v.sy);
    const snout = pr(v, h.cx + 0.36, h.cy + 0.08, 0);
    const nose = pr(v, h.cx + 0.6, h.cy + 0.06, 0);
    const earL = pr(v, h.cx - 0.08, h.cy - 0.36, 0.26), earR = pr(v, h.cx - 0.08, h.cy - 0.36, -0.26);
    const eyeL = pr(v, h.cx + 0.18, h.cy - 0.1, 0.3), eyeR = pr(v, h.cx + 0.18, h.cy - 0.1, -0.3);
    const ear = (p) => () => { X.circ(g, p[0], p[1], hr * 0.55, fur, { alpha, noHi: true }); X.circ(g, p[0] + 1, p[1] + 1, Math.max(1, hr * 0.32), b.ear, { flat: true, noOutline: true }); };
    items.push({ z: earL[2] - 0.01, f: ear(earL) });
    items.push({ z: earR[2] - 0.01, f: ear(earR) });
    items.push({
      z: hc[2], f: () => {
        const sn = () => X.circ(g, snout[0], snout[1], hr * 0.58, fur, { alpha, noHi: true });
        if (snout[2] < hc[2]) sn();
        X.circ(g, hc[0], hc[1], hr, fur, { alpha });
        if (snout[2] >= hc[2]) sn();
        overlays(g, gl, { t: 'ell', x: hc[0], y: hc[1], rx: hr - 1, ry: hr - 1 }, mods, hc[0], hc[1], t);
        for (const ep of [eyeL, eyeR]) {
          if (ep[2] < hc[2] - 0.12) continue;
          eye(g, ep[0], ep[1], Math.max(1.5, hr * 0.22), { iris: b.eye, blink: st ? st.blink : 0, squash: 1, lx: st ? st.lx : 0, ly: st ? st.ly : 0, pupil: 0.7 });
        }
        if (st && st.mouth > 0.1) X.ell(g, nose[0] - (nose[0] - hc[0]) * 0.3, nose[1] + hr * 0.3, 1.5, 1 + st.mouth, 0x5d1830, { flat: true, noOutline: true });
        X.circ(g, nose[0], nose[1], Math.max(1.5, hr * 0.16), b.nose, { flat: true });
        const dir = nose[0] > hc[0] ? 1 : -1;
        for (const s of [-1, 1]) X.line(g, [[nose[0] - dir, nose[1] + 1], [nose[0] + dir * hr * 0.9, nose[1] + s * 2 + 1]], 1, X.mix(PAL.ink, fur, 0.4));
      },
    });
    return { center: c, rx: rxs, ry: rys, head: [hc[0], hc[1], hc[2], hr] };
  }

  function drawBox(g, v, cx, cy, cz, hx, hy, hz, cols, alpha) {
    const C = {};
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) C[sx + ',' + sy + ',' + sz] = pr(v, cx + sx * hx, cy + sy * hy, cz + sz * hz);
    const q = (a, b, c, d) => [C[a], C[b], C[c], C[d]];
    const faces = [{ pts: q('-1,-1,-1', '1,-1,-1', '1,-1,1', '-1,-1,1'), col: cols.top, id: 'top' }];
    if (v.cos > 0) faces.push({ pts: q('-1,-1,1', '1,-1,1', '1,1,1', '-1,1,1'), col: cols.front, id: 'front' });
    if (v.cos < 0) faces.push({ pts: q('1,-1,-1', '-1,-1,-1', '-1,1,-1', '1,1,-1'), col: cols.front, id: 'back' });
    if (-v.sin > 0) faces.push({ pts: q('1,-1,1', '1,-1,-1', '1,1,-1', '1,1,1'), col: cols.side, id: 'right' });
    if (v.sin > 0) faces.push({ pts: q('-1,-1,-1', '-1,-1,1', '-1,1,1', '-1,1,-1'), col: cols.side, id: 'left' });
    // contorno do conjunto primeiro, depois as faces sem contorno (não ficam linhas duplas)
    for (const f of faces) X.poly(g, f.pts.map((p) => [p[0], p[1]]), PAL.ink, { alpha: alpha === undefined ? undefined : Math.min(1, alpha + 0.3) });
    let front = null;
    for (const f of faces) {
      X.poly(g, f.pts.map((p) => [p[0], p[1]]), f.col, { noOutline: true, alpha });
      if (f.id === 'front' || f.id === 'back') front = f;
    }
    // arestas internas
    for (const f of faces) { const p = f.pts; X.line(g, [[p[0][0], p[0][1]], [p[1][0], p[1][1]]], 1, X.dark(f.col, 0.45), { alpha: 0.6 }); }
    return { front, faces };
  }
  function facePt(f, u, w) {
    const [a, b, c, d] = f.pts;
    const x1 = a[0] + (b[0] - a[0]) * u, y1 = a[1] + (b[1] - a[1]) * u;
    const x2 = d[0] + (c[0] - d[0]) * u, y2 = d[1] + (c[1] - d[1]) * u;
    return [x1 + (x2 - x1) * w, y1 + (y2 - y1) * w];
  }

  function coreRobo(g, gl, v, sub, st, mods, items, t) {
    const b = sub.base;
    const plate = coreFill(mods, b.plate);
    const plate2 = mods.color || mods.stone || mods.metal ? X.dark(plate, 0.22) : X.num(b.plate2);
    const cols = { front: plate, side: plate2, top: X.light(plate, 0.3) };
    const alpha = mods.clear ? 1 - mods.clear * 0.8 : undefined;
    for (const lx of [-0.3, 0.3]) {
      const a = pr(v, lx, 0.48, 0), bb = pr(v, lx, 0.92, 0);
      items.push({ z: a[2] - 0.05, f: () => { X.tube(g, [[a[0], a[1]], [bb[0], bb[1]]], Math.max(3, v.s * 0.15), Math.max(3, v.s * 0.12), 0x566c86); drawBox(g, v, lx, 0.97, 0.06, 0.16, 0.05, 0.2, { front: 0x333c57, side: 0x29304a, top: 0x566c86 }); } });
    }
    for (const s of [-1, 1]) {
      const r0 = pr(v, s * 0.62, -0.05, 0);
      const wave = Math.sin(t * 2 + b.phase + s) * 0.15;
      const el = pr(v, s * 0.86, 0.18 + wave, 0.12), hd = pr(v, s * 0.92, 0.42 + wave, 0.25);
      items.push({
        z: rotZ(v, s * 0.7, 0.1), f: () => {
          X.line(g, [[r0[0], r0[1]], [el[0], el[1]], [hd[0], hd[1]]], Math.max(2, R(v.s * 0.09)), 0x94b0c2, { outline: true });
          X.circ(g, el[0], el[1], 1.5, PAL.yellow, { flat: true });
          const ca = Math.atan2(hd[1] - el[1], hd[0] - el[0]);
          for (const k of [-0.6, 0.6]) X.line(g, [[hd[0], hd[1]], [hd[0] + Math.cos(ca + k) * 3, hd[1] + Math.sin(ca + k) * 3]], 1, PAL.ink);
        },
      });
    }
    const t1 = pr(v, -0.25, -0.5, -0.4), t2 = pr(v, -0.15, -0.95, -0.3), t3 = pr(v, 0.15, -0.6, -0.42);
    items.push({ z: -0.42, f: () => X.tube(g, [[t1[0], t1[1]], [t3[0] - v.s * 0.3, t3[1] - v.s * 0.4], [t2[0], t2[1]]], Math.max(2, v.s * 0.08), Math.max(2, v.s * 0.07), b.heart) });
    const center = pr(v, 0, 0, 0);
    items.push({
      z: 0, f: () => {
        const box = drawBox(g, v, 0, 0, 0, 0.6, 0.48, 0.42, cols, alpha);
        for (const f of box.faces) if (f.id !== 'top') overlays(g, gl, { t: 'poly', pts: f.pts.map((p) => [p[0], p[1]]) }, mods, center[0], center[1], t);
        if (box.front) {
          const f = box.front;
          const hc = facePt(f, 0.5, 0.42);
          const wx = Math.max(2, Math.abs(v.cos) * v.s * 0.22 * v.sx), wy = Math.max(2, v.s * 0.22 * v.sy);
          X.ell(g, hc[0], hc[1], wx + 1, wy + 1, 0x2a2f45, { flat: true });
          X.ell(g, hc[0], hc[1], wx, wy, 0x5d1830, { flat: true, noOutline: true });
          const pulse = Math.sin(t * 6.5) > 0.5 ? 1 : 0;
          const hs = Math.max(1, wy * 0.5) + pulse, hsx = Math.max(1, wx * 0.5) + pulse;
          X.poly(g, [[hc[0], hc[1] + hs], [hc[0] - hsx, hc[1] - hs * 0.2], [hc[0] - hsx * 0.6, hc[1] - hs * 0.8], [hc[0], hc[1] - hs * 0.35], [hc[0] + hsx * 0.6, hc[1] - hs * 0.8], [hc[0] + hsx, hc[1] - hs * 0.2]], b.heart, { noOutline: true });
          if (gl) gl.circle(R(hc[0]), R(hc[1]), R(wy * 1.3)).fill({ color: X.num(b.heart), alpha: 0.12 + pulse * 0.1 });
          X.px(g, hc[0] - wx * 0.5, hc[1] - wy * 0.55, PAL.white, 1);
          for (const [u, w] of [[0.08, 0.1], [0.92, 0.1], [0.08, 0.9], [0.92, 0.9]]) { const p = facePt(f, u, w); X.px(g, p[0], p[1], PAL.ink, 1); }
          const band = [facePt(f, 0, 0.8), facePt(f, 1, 0.8), facePt(f, 1, 0.95), facePt(f, 0, 0.95)];
          X.scanFill(g, { t: 'poly', pts: band }, (x, y) => ((((x + y) >> 1) & 1) ? PAL.ink : PAL.yellow));
        }
      },
    });
    const n1 = pr(v, 0, -0.48, 0), n2 = pr(v, 0, -0.7, 0);
    items.push({ z: 0.001, f: () => X.tube(g, [[n1[0], n1[1]], [n2[0], n2[1]]], Math.max(3, v.s * 0.13), Math.max(3, v.s * 0.11), 0x566c86, { flat: true }) });
    const h = DEF.robo.head;
    const hc = pr(v, h.cx, h.cy, h.cz);
    items.push({
      z: 0.002, f: () => {
        const box = drawBox(g, v, h.cx, h.cy, h.cz, 0.36, 0.26, 0.3, cols, alpha);
        for (const f of box.faces) if (f.id !== 'top') overlays(g, gl, { t: 'poly', pts: f.pts.map((p) => [p[0], p[1]]) }, mods, hc[0], hc[1], t);
        if (box.front && box.front.id === 'front') {
          const f = box.front;
          if (b.lens === 1) { const p = facePt(f, 0.5, 0.42); eye(g, p[0], p[1], Math.max(2, v.s * 0.14), { mat: 'metal', iris: b.eye, blink: st ? st.blink : 0, lx: st ? st.lx : 0, ly: st ? st.ly : 0, glow: gl }); }
          else for (const u of [0.3, 0.7]) { const p = facePt(f, u, 0.42); eye(g, p[0], p[1], Math.max(1.5, v.s * 0.08), { mat: 'metal', iris: b.eye, blink: st ? st.blink : 0, lx: st ? st.lx : 0, glow: gl }); }
          const open = st && st.mouth > 0.1 ? 1 : 0;
          for (let i = 0; i < 4; i++) { const a = facePt(f, 0.3 + i * 0.13, 0.72 - open * 0.06), c2 = facePt(f, 0.3 + i * 0.13, 0.86 + open * 0.05); X.line(g, [a, c2], 1, PAL.ink); }
        }
        if (b.antenna) {
          const a0 = pr(v, h.cx + 0.12, h.cy - 0.26, 0), a1 = pr(v, h.cx + 0.2, h.cy - 0.6, 0);
          X.line(g, [[a0[0], a0[1]], [a1[0], a1[1]]], 1, PAL.ink);
          const on = Math.sin(t * 3 + b.phase) > 0;
          X.circ(g, a1[0], a1[1], 2, on ? 0xff4d4d : 0x7f2a35, { flat: true });
          if (on && gl) gl.circle(R(a1[0]), R(a1[1]), 5).fill({ color: 0xff4d4d, alpha: 0.4 });
        }
      },
    });
    return { center, rx: v.s * 0.65, ry: v.s * 0.6, head: [hc[0], hc[1], hc[2] + 0.002, v.s * 0.36] };
  }

  function corePlanta(g, gl, v, sub, st, mods, items, t) {
    const b = sub.base;
    const leaf = coreFill(mods, b.leaf);
    const leaf2 = mods.color || mods.metal || mods.stone ? X.dark(leaf, 0.25) : X.num(b.leaf2);
    const bulbCol = coreFill(mods, b.bulb);
    const alpha = mods.clear ? 1 - mods.clear : undefined;
    const pv = Object.assign({}, v, { sx: 1, sy: 1, sz: 1 });
    const top = 0.45, bot = 1.0;
    const tl = pr(pv, -0.42, top, 0), tr = pr(pv, 0.42, top, 0), bl = pr(pv, -0.32, bot, 0), br = pr(pv, 0.32, bot, 0);
    const rimY = R((tl[1] + tr[1]) / 2), ry = Math.max(2, 0.42 * v.s * TILT * 1.4);
    items.push({
      z: -0.6, f: () => {
        const pot = [[tl[0], rimY], [bl[0], bl[1]], [br[0], br[1]], [tr[0], rimY]];
        X.poly(g, pot, b.pot);
        X.scanFill(g, { t: 'poly', pts: pot }, (x, y) => (y > rimY + (bl[1] - rimY) * 0.45 && y < rimY + (bl[1] - rimY) * 0.62 ? X.num(b.pot2) : x > (tr[0] - 3) ? X.dark(b.pot, 0.2) : null));
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + v.yaw;
          const z = Math.cos(a);
          if (z < 0.2) continue;
          X.px(g, (tl[0] + tr[0]) / 2 + Math.sin(a) * (tr[0] - tl[0]) * 0.4, rimY + (bl[1] - rimY) * 0.28, PAL.cream, z > 0.7 ? 2 : 1);
        }
        X.ell(g, (tl[0] + tr[0]) / 2, rimY, (tr[0] - tl[0]) / 2 + 2, ry + 1, b.pot2, { flat: true });
        X.ell(g, (tl[0] + tr[0]) / 2, rimY + 1, (tr[0] - tl[0]) / 2 - 1, Math.max(1, ry - 1), 0x4a2f22, { flat: true, noOutline: true });
      },
    });
    const stem = [];
    for (let i = 0; i < 5; i++) { const k = i / 4; stem.push(pr(v, Math.sin(t * 1.1 + b.phase) * 0.1 * k * k, top - k * (top + 0.55), Math.cos(t * 0.9 + b.phase) * 0.06 * k)); }
    items.push({ z: -0.02, f: () => X.tube(g, stem.map((p) => [p[0], p[1]]), Math.max(3, v.s * 0.12), Math.max(3, v.s * 0.1), leaf2, { alpha }) });
    for (let i = 0; i < b.leaves; i++) {
      const a = (i / b.leaves) * TAU + b.a * 3;
      const hk = 0.15 + (i / b.leaves) * 0.55;
      const sp = stem[Math.min(4, Math.round(hk * 4))];
      const base = [Math.sin(t * 1.1 + b.phase) * 0.1 * hk * hk, top - hk * (top + 0.55), 0];
      const droop = 0.12 + Math.sin(t * 1.5 + i) * 0.04;
      const tip = pr(v, base[0] + Math.sin(a) * 0.62, base[1] - 0.12 + droop, Math.cos(a) * 0.62);
      const mid = pr(v, base[0] + Math.sin(a) * 0.35, base[1] - 0.22, Math.cos(a) * 0.35);
      items.push({
        z: tip[2] * 0.8, f: () => {
          const dx = tip[0] - sp[0], dy = tip[1] - sp[1];
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          const w = Math.max(2, v.s * 0.14);
          X.poly(g, [[sp[0], sp[1]], [mid[0] + nx * w, mid[1] + ny * w], [tip[0], tip[1]], [mid[0] - nx * w * 0.8, mid[1] - ny * w * 0.8]], i % 2 ? leaf : X.mix(leaf, leaf2, 0.25), { alpha });
          X.line(g, [[sp[0], sp[1]], [mid[0], mid[1]], [tip[0], tip[1]]], 1, X.dark(leaf, 0.35));
        },
      });
    }
    const h = DEF.planta.head;
    const sway = Math.sin(t * 1.1 + b.phase) * 0.1;
    const hc = pr(v, h.cx + sway, h.cy, h.cz);
    const hr = h.r * v.s * Math.sqrt(v.sx * v.sy);
    const eL = pr(v, h.cx + sway - 0.17, h.cy - 0.02, 0.36), eR = pr(v, h.cx + sway + 0.17, h.cy - 0.02, 0.36);
    const mo = pr(v, h.cx + sway, h.cy + 0.17, 0.38);
    items.push({
      z: hc[2] + 0.01, f: () => {
        X.ell(g, hc[0] - hr * 0.25, hc[1] - hr * 1.05, Math.max(2, hr * 0.28), Math.max(1, hr * 0.13), leaf, { flat: true });
        X.ell(g, hc[0] + hr * 0.25, hc[1] - hr * 1.05, Math.max(2, hr * 0.28), Math.max(1, hr * 0.13), leaf, { flat: true });
        X.ell(g, hc[0], hc[1], hr * 1.05, hr * 0.95, bulbCol, { alpha });
        overlays(g, gl, { t: 'ell', x: hc[0], y: hc[1], rx: hr * 1.05 - 1, ry: hr * 0.95 - 1 }, mods, hc[0], hc[1], t);
        for (const ep of [eL, eR]) { if (ep[2] < hc[2] - 0.1) continue; eye(g, ep[0], ep[1], Math.max(1.5, hr * 0.24), { blink: st ? st.blink : 0, lx: st ? st.lx : 0, ly: st ? st.ly : 0, pupil: 0.6 }); }
        if (mo[2] > hc[2] - 0.1) {
          X.px(g, eL[0] - hr * 0.15, eL[1] + hr * 0.3, PAL.pink, 2); X.px(g, eR[0] + hr * 0.05, eR[1] + hr * 0.3, PAL.pink, 2);
          if (st && st.mouth > 0.1) X.ell(g, mo[0], mo[1], 2, 1 + st.mouth, 0x5d1830, { flat: true });
          else { g.rect(R(mo[0] - 2), R(mo[1]), 1, 1).fill(PAL.ink); g.rect(R(mo[0] - 1), R(mo[1] + 1), 3, 1).fill(PAL.ink); g.rect(R(mo[0] + 2), R(mo[1]), 1, 1).fill(PAL.ink); }
        }
      },
    });
    return { center: pr(v, 0, -0.2, 0), rx: v.s * 0.55, ry: v.s * 0.8, head: [hc[0], hc[1], hc[2] + 0.01, hr] };
  }

  function coreAmeba(g, gl, v, sub, st, mods, items, t) {
    const b = sub.base;
    const gel = coreFill(mods, b.gel);
    const c = pr(v, 0, 0, 0);
    const rx = v.s * v.sx, ry = v.s * 0.78 * v.sy;
    const alpha = mods.metal || mods.stone ? undefined : mods.clear ? 0.5 : 0.88;
    const pod = Math.max(0, Math.sin(t * 0.8 + b.phase)) * 0.18;
    const blob = (k, ox, oy) => {
      const pts = [];
      for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; const f = 1 + 0.06 * Math.sin(t * 1.7 + i * 1.3 + b.phase) + 0.04 * Math.sin(t * 2.9 + i * 2.1) + (i === 3 ? pod : 0); pts.push([c[0] + ox + Math.cos(a) * rx * f * k, c[1] + oy + Math.sin(a) * ry * f * k]); }
      return pts;
    };
    const outer = blob(1, 0, 0);
    const orgs = [];
    const rng = MX.RNG.make(sub.seed + 'org');
    for (let i = 0; i < 6; i++) orgs.push([rng.range(-0.6, 0.6), rng.range(-0.4, 0.45), rng.range(-0.5, 0.5), rng.range(0.06, 0.11)]);
    items.push({
      z: 0, f: () => {
        X.poly(g, outer, X.dark(gel, 0.28), { alpha });
        X.poly(g, blob(0.86, -rx * 0.1, -ry * 0.12), gel, { noOutline: true, alpha });
        X.ell(g, c[0] - rx * 0.38, c[1] - ry * 0.42, rx * 0.2, ry * 0.12, b.spot, { flat: true, noOutline: true, alpha: 0.85 });
        for (const og of orgs) { const p = pr(v, og[0], og[1] + Math.sin(t + og[0] * 5) * 0.04, og[2]); X.circ(g, p[0], p[1], Math.max(1, og[3] * v.s), b.core, { flat: true, noOutline: true, alpha: 0.45 + 0.3 * (p[2] + 0.5) }); }
        const nc = pr(v, 0.22, -0.02, -0.15);
        X.circ(g, nc[0], nc[1], Math.max(2, v.s * 0.24), X.mix(b.core, gel, 0.2), { alpha: 0.85, ink: X.dark(b.core, 0.4), noHi: true });
        X.circ(g, nc[0] + 1, nc[1] - 1, Math.max(1, v.s * 0.08), X.dark(b.core, 0.35), { flat: true, noOutline: true });
        overlays(g, gl, { t: 'poly', pts: blob(0.95, 0, 0) }, mods, c[0], c[1], t);
      },
    });
    const eL = pr(v, -0.3, -0.28, 0.72), eR = pr(v, 0.3, -0.28, 0.72), mo = pr(v, 0, -0.02, 0.8);
    items.push({
      z: 0.01, f: () => {
        for (const ep of [eL, eR]) { if (ep[2] < -0.15) continue; eye(g, ep[0], ep[1], Math.max(2, v.s * 0.16), { blink: st ? st.blink : 0, squash: Math.max(0.4, Math.min(1, ep[2] * 1.4 + 0.3)), lx: st ? st.lx : 0, ly: st ? st.ly : 0, pupil: 0.6 }); }
        if (mo[2] > -0.1) {
          if (st && st.mouth > 0.1) X.ell(g, mo[0], mo[1], 2, 1 + st.mouth, 0x5d1830, { flat: true });
          else { g.rect(R(mo[0] - 2), R(mo[1]), 1, 1).fill(PAL.ink); g.rect(R(mo[0] - 1), R(mo[1] + 1), 3, 1).fill(PAL.ink); g.rect(R(mo[0] + 2), R(mo[1]), 1, 1).fill(PAL.ink); }
        }
      },
    });
    return { center: c, rx, ry, head: [c[0], c[1] - ry * 0.1, 0.05, Math.min(rx, ry) * 0.95] };
  }

  const CORES = { rato: coreRato, robo: coreRobo, planta: corePlanta, ameba: coreAmeba };
  const MAT = { rato: 'fur', robo: 'metal', planta: 'leaf', ameba: 'gel' };
  function bodyColor(sub, mods) {
    const b = sub.base;
    return coreFill(mods, sub.host === 'rato' ? b.fur : sub.host === 'robo' ? b.plate : sub.host === 'planta' ? b.leaf : b.gel);
  }
  function partColor(sub, F, mods) {
    const b = sub.base;
    if (mods.stone) return X.mix(F, 0xa3a39a, 0.6);
    if (sub.host === 'robo') return X.mix(F, b.plate, 0.2);
    if (sub.host === 'planta') return X.mix(F, b.leaf, 0.12);
    if (sub.host === 'ameba') return X.mix(F, b.gel, 0.12);
    return X.mix(F, b.fur, 0.12);
  }

  // ---------------------------------------------------------------- desenho principal
  // g: Graphics; o.glow: Graphics aditivo (luzes). Devolve { core, v, beh, mods, flip } ou null.
  function draw(g, sub, x, groundY, s, yaw, st, t, o) {
    o = o || {};
    const def = DEF[sub.host];
    const gl = o.glow || null;
    const { mods, beh } = gatherMods(sub, o.mini ? null : st);
    let scale = mods.scale, sx = mods.sx, sy = mods.sy;
    let ox = 0, oy = 0, alpha = 1, flip = false;
    const still = o.still || o.mini;
    if (!still && st) {
      const br = Math.sin(t * 2.2 + sub.base.phase) > 0.6 ? 1.03 : 1;
      sy *= br * (1 - st.squash * 0.18); sx *= 1 + st.squash * 0.14;
      if (beh.float) oy -= (0.35 + Math.sin(t * 1.6) * 0.08) * s * scale;
      if (beh.hop) { const h = Math.abs(Math.sin(t * 3.4 * beh.hop)); oy -= h * 0.35 * s; if (h < 0.15) { sy *= 0.9; sx *= 1.08; } }
      if (beh.dance) { ox += Math.sin(t * 4) * 0.12 * s; sy *= 1 + (Math.sin(t * 8) > 0 ? 0.05 : -0.03); }
      if (beh.vibrate) { ox += (Math.random() < 0.5 ? -1 : 1) * beh.vibrate; }
      if (st.hic > 0) oy -= Math.sin(st.hic * Math.PI) * 0.25 * s;
      if (beh.ceiling) flip = true;
      if (st.collapse) {
        const pc = st.collapse.p, id = st.collapse.id;
        if (id === 'confete') { scale *= 1 + pc * 0.7; ox += (Math.random() - 0.5) * pc * 4; if (pc > 0.62) alpha = 0; }
        else if (id === 'derretimento') { sy *= 1 - pc * 0.85; sx *= 1 + pc * 0.7; }
        else if (id === 'ascensao') { oy -= pc * pc * s * 9; if (pc > 0.85) alpha = 0; }
        else if (id === 'fuga') { const k = pc < 0.5 ? pc * 2 : 1; ox += (o.ventX - x) * k * k; oy -= Math.abs(Math.sin(pc * 18)) * s * 0.3 * (1 - pc) + (pc > 0.5 ? (groundY - o.ventY) * (pc - 0.5) * 2 : 0); scale *= 1 - pc * 0.5; if (pc > 0.92) alpha = 0; }
        else if (id === 'fusao') { ox += (o.machineX - x) * pc * pc; sx *= 1 + pc * 1.2; sy *= 1 - pc * 0.5; if (pc > 0.85) alpha = 0; }
        else if (id === 'implosao') { scale *= Math.max(0.05, 1 - pc * pc); }
        else if (id === 'florescimento') { scale *= 1 - pc * 0.5; if (pc > 0.85) alpha = 0; }
        else if (id === 'curto') { ox += (Math.random() - 0.5) * 5 * pc; if (pc > 0.7) alpha = 0; }
        else if (id === 'mitose') { if (pc > 0.25) alpha = 0; }
        else if (id === 'petrificacao') { if (pc > 0.4) mods.stone = 1; }
      }
      if (st.reveal > 0) scale *= 1 + Math.sin(st.reveal * Math.PI) * 0.12;
    }
    if (alpha <= 0) return null;
    const v = makeView(R(x + ox), 0, s * scale, yaw + (o.mini ? def.baseYaw : 0), { sx, sy, flip });
    v.y = flip ? (o.ceilY || groundY - s * 3) + def.feet * v.s * sy : groundY + oy - def.feet * v.s * sy;

    if (!o.noShadow) {
      const lift = Math.max(0, -oy) / s;
      g.ellipse(R(x + ox), R(groundY + 1), Math.max(3, R(s * scale * (sub.host === 'ameba' ? 1 : 0.85) * sx / (1 + lift * 0.6))), Math.max(1, R(s * 0.14 / (1 + lift * 0.6)))).fill({ color: PAL.ink, alpha: 0.3 });
    }
    if (mods.glow && gl) {
      const c = X.num(mods.glow);
      const k = Math.sin(t * 2.5) > 0 ? 1 : 0.85;
      gl.circle(v.x, R(v.y), R(v.s * 1.7 * k)).fill({ color: c, alpha: 0.12 });
      gl.circle(v.x, R(v.y), R(v.s * 1.25 * k)).fill({ color: c, alpha: 0.14 });
    }
    const items = [];
    const core = CORES[sub.host](g, gl, v, sub, o.mini ? null : st, mods, items, t);
    if (!o.noParts) {
      const body = bodyColor(sub, mods);
      const mat = mods.metal ? 'metal' : MAT[sub.host];
      const emit = st && !o.mini ? (st.emitPts = []) : null;
      for (const mu of sub.mutations) {
        const r = mu.render;
        if (!r.part) continue;
        if (st && !o.mini && st.hidden && st.hidden.has(mu.uid)) continue;
        let grow = 1;
        if (st && !o.mini && st.born && st.born.has(mu.uid)) { const k = (t - st.born.get(mu.uid)) / 0.7; grow = k >= 1 ? 1 : Math.max(0.05, easeOutBack(Math.max(0, k))); }
        if (st && !o.mini && st.pulse && st.pulse.has(mu.uid)) { const k = (t - st.pulse.get(mu.uid)) / 0.6; if (k < 1) grow *= 1 + Math.sin(k * Math.PI) * 0.25; }
        const F = partColor(sub, r.color, mods);
        const S = v.s * r.size * grow;
        if (r.part === 'shell') { items.push({ z: 0.015, f: () => drawShell(g, [core.center[0], core.center[1]], core.rx, core.ry, F) }); continue; }
        if (r.part === 'mane') { const hd = core.head; items.push({ z: hd[2] - 0.03, f: () => drawMane(g, hd, hd[3] * grow, F, t) }); continue; }
        if (r.part === 'crest') { const hd = core.head; items.push({ z: hd[2] - 0.02, f: () => drawCrest(g, hd, hd[3] * grow, F, t) }); continue; }
        for (const inst of layoutFor(sub, mu)) {
          const an = anchorLocal(def, inst, sub.host);
          let ap = an.p;
          if (sub.host === 'planta' && inst.onHead) ap = [ap[0] + Math.sin(t * 1.1 + sub.base.phase) * 0.1, ap[1], ap[2]];
          if (sub.host === 'ameba') ap = [ap[0] * 0.92, ap[1] * 0.92, ap[2] * 0.92];
          const A = pr(v, ap[0], ap[1], ap[2]);
          const B = pr(v, ap[0] + an.n[0] * 0.4, ap[1] + an.n[1] * 0.4, ap[2] + an.n[2] * 0.4);
          let dx = B[0] - A[0], dy = B[1] - A[1];
          const len = Math.hypot(dx, dy) || 1;
          dx /= len; dy /= len;
          const facing = rotZ(v, an.n[0], an.n[2]);
          const opts = { t, ph: inst.ph, k: inst.k, len: inst.len, side: inst.side, wob: r.wob || 1, mat, facing, emit, host: sub.host, body, lx: st ? st.lx : 0, ly: st ? st.ly : 0, blink: st ? st.blink : 0 };
          items.push({ z: A[2] + facing * 0.05 + (inst.onHead ? 0.003 : 0), f: () => drawPart(g, gl, r.part, [A[0], A[1]], [dx, dy], S, F, opts) });
        }
      }
    }
    items.sort((a, b) => a.z - b.z);
    if (alpha < 1) { /* alfa parcial não é usado na pixel art: some de uma vez */ }
    for (const it of items) it.f();

    if (!o.mini && !still && beh.clones && st && !st.collapse) {
      for (let i = 0; i < beh.clones; i++) {
        const a = t * 0.9 + (i / beh.clones) * TAU;
        const cz = Math.sin(a);
        draw(g, sub, v.x + Math.cos(a) * s * 1.7, groundY - s * (1.4 + 0.25 * Math.sin(t * 2 + i)) + cz * s * 0.25, s * 0.3, yaw + a, null, t, { mini: true, noShadow: true, glow: gl });
      }
    }
    return { core, v, beh, mods, flip };
  }
  function easeOutBack(k) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
  function portrait(g, sub, x, groundY, s, t, gl) { return draw(g, sub, x, groundY, s, 0, null, t || 0, { mini: true, glow: gl }); }

  MX.Creature = { DEF, draw, portrait, gatherMods, makeView, pr, layoutFor, drawPart, eye };
})(typeof window !== 'undefined' ? window : globalThis);
