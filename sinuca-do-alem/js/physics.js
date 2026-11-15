/* Sinuca do Além — física: bolas em 2D com altura (saltos), tabelas com bocas de caçapa,
   rebatedores, portais, hélice, buraco negro, vento. Sem DOM: roda também em Node para os testes. */
(function (g) {
  'use strict';
  const SA = (g.SA = g.SA || {});
  const P = (SA.Phys = {});

  P.HW = 500; P.HH = 250; P.R = 16;
  const GRAV = 1200, E_BALL = 0.965, VMAX = 3400, MU = 230, RAIL_Z = 18;
  P.RAIL_Z = RAIL_Z;

  let nextId = 1;
  P.makeBall = function (o) {
    const b = {
      id: o.id || nextId++, kind: o.kind || 'obj', type: o.type || 'n', num: o.num, pts: o.pts || 0,
      color: o.color || '#fff', glyph: o.glyph || null,
      x: o.x || 0, y: o.y || 0, z: o.z || 0, vx: 0, vy: 0, vz: 0,
      r: o.r || P.R, m: o.m || 1, alive: true, sink: null,
      cush: 0, lastHit: null, burning: !!o.burning, bonus: 0, ghost: o.type === 'fantasma' || !!o.ghost,
      portalCd: 0, phase: 0, passed: null, firstHit: false, plow: 0, follow: 0, side: 0,
      // orientação: polo (p) e tangente (t), para desenhar o número girando
      px: 0, py: -0.45, pz: 0.893, tx: 1, ty: 0, tz: 0,
    };
    if (o.id && o.id >= nextId) nextId = o.id + 1;
    return b;
  };
  P.resetIds = function (n) { nextId = n || 1; };

  // Geometria da mesa. Caçapas: 0,1,2 em baixo (y negativo), 3,4,5 em cima; 1 e 4 são as do meio.
  P.buildGeom = function (o) {
    o = o || {};
    const s = o.pocketScale || 1, hw = P.HW, hh = P.HH;
    const gc = 44 * s, gs = 38 * s, J = 22;
    const geom = {
      hw, hh, friction: o.friction || 1, electric: !!o.electric, pocketScale: s,
      pockets: [], segs: [], circles: [], portals: null, well: null, wind: null, tilt: null,
      patches: [], spinner: null, hungry: false,
    };
    const cr = 30 * s, sr = 28 * s;
    const pk = (x, y, r, corner) => geom.pockets.push({ x, y, r, corner, closed: false });
    pk(-hw - 6, -hh - 6, cr, true); pk(0, -hh - 16, sr, false); pk(hw + 6, -hh - 6, cr, true);
    pk(-hw - 6, hh + 6, cr, true); pk(0, hh + 16, sr, false); pk(hw + 6, hh + 6, cr, true);
    const seg = (x1, y1, x2, y2, extra) => geom.segs.push(Object.assign({ x1, y1, x2, y2 }, extra));
    for (const sy of [-1, 1]) {
      const y = sy * hh;
      // duas tabelas longas por lado, com as bocas (jaws) em diagonal
      seg(-hw + gc, y, -gs, y); seg(gs, y, hw - gc, y);
      seg(-hw + gc, y, -hw + gc - J, y + sy * J, { jaw: true }); seg(hw - gc, y, hw - gc + J, y + sy * J, { jaw: true });
      seg(-gs, y, -gs + 9, y + sy * J, { jaw: true }); seg(gs, y, gs - 9, y + sy * J, { jaw: true });
    }
    for (const sx of [-1, 1]) {
      const x = sx * hw;
      seg(x, -hh + gc, x, hh - gc);
      seg(x, -hh + gc, x + sx * J, -hh + gc - J, { jaw: true }); seg(x, hh - gc, x + sx * J, hh - gc + J, { jaw: true });
    }
    geom.gc = gc; geom.gs = gs;
    return geom;
  };

  function roll(b, dx, dy) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-5) return;
    const kx = -dy / dist, ky = dx / dist, th = dist / b.r, c = Math.cos(th), s = Math.sin(th);
    // Rodrigues com eixo k = (kx, ky, 0)
    let d = kx * b.px + ky * b.py;
    let cx = ky * b.pz, cy = -kx * b.pz, cz = kx * b.py - ky * b.px;
    const px = b.px * c + cx * s + kx * d * (1 - c), py = b.py * c + cy * s + ky * d * (1 - c), pz = b.pz * c + cz * s;
    d = kx * b.tx + ky * b.ty;
    cx = ky * b.tz; cy = -kx * b.tz; cz = kx * b.ty - ky * b.tx;
    const tx = b.tx * c + cx * s + kx * d * (1 - c), ty = b.ty * c + cy * s + ky * d * (1 - c), tz = b.tz * c + cz * s;
    const n = 1 / Math.sqrt(px * px + py * py + pz * pz);
    b.px = px * n; b.py = py * n; b.pz = pz * n;
    // re-ortogonaliza a tangente
    const dp = tx * b.px + ty * b.py + tz * b.pz;
    let ux = tx - dp * b.px, uy = ty - dp * b.py, uz = tz - dp * b.pz;
    const m = 1 / Math.sqrt(ux * ux + uy * uy + uz * uz);
    b.tx = ux * m; b.ty = uy * m; b.tz = uz * m;
  }

  function sinkBall(w, b, pk, px, py) {
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    b.sink = { t: 0, x: px, y: py, pk, sx: b.x, sy: b.y };
    b.vx = b.vy = 0; b.vz = 0;
    w.events.push({ t: 'pocket', b, pk, v: sp });
  }

  function collideSeg(w, b, s, sx1, sy1, sx2, sy2, surf) {
    const ex = sx2 - sx1, ey = sy2 - sy1, len2 = ex * ex + ey * ey;
    let t = ((b.x - sx1) * ex + (b.y - sy1) * ey) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = sx1 + ex * t, cy = sy1 + ey * t;
    let dx = b.x - cx, dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) return;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d, ny = dy / d;
    b.x = cx + nx * b.r; b.y = cy + ny * b.r;
    let rvx = b.vx, rvy = b.vy, svx = 0, svy = 0;
    if (surf) { svx = -surf.w * (cy - surf.y); svy = surf.w * (cx - surf.x); rvx -= svx; rvy -= svy; }
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    let e = s.wall ? 0.62 : 0.74;
    if (b.type === 'borracha') e = 1.0;
    if (w.geom.electric && !s.wall && -vn < 1300) e = Math.max(e, 1.14);
    rvx -= (1 + e) * vn * nx; rvy -= (1 + e) * vn * ny;
    // leve perda tangencial
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    rvx -= tx * vt * 0.04; rvy -= ty * vt * 0.04;
    if (b.kind === 'cue' && b.side && !s.jaw) {
      const k = b.side * -vn * 0.32;
      rvx += tx * k; rvy += ty * k; b.side *= 0.35;
    }
    b.vx = rvx + svx; b.vy = rvy + svy;
    w.events.push({ t: 'cushion', b, v: -vn, x: cx, y: cy, jaw: !!s.jaw, wall: !!s.wall, spinner: !!surf });
  }

  function spinnerEnds(sp) {
    const c = Math.cos(sp.ang), s = Math.sin(sp.ang), h = sp.len / 2;
    return [sp.x - c * h, sp.y - s * h, sp.x + c * h, sp.y + s * h];
  }
  P.spinnerEnds = spinnerEnds;

  function substep(w, h) {
    const g = w.geom, B = w.balls, ev = w.events, hw = g.hw, hh = g.hh;
    const mu0 = MU * g.friction;
    if (g.spinner && w.spin) g.spinner.ang += g.spinner.w * h;
    let magnets = null;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b.alive && !b.sink && b.type === 'ima' && b.vx * b.vx + b.vy * b.vy > 900) (magnets = magnets || []).push(b);
    }
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (!b.alive || b.sink) continue;
      if (b.portalCd > 0) b.portalCd -= h;
      let sp2 = b.vx * b.vx + b.vy * b.vy;
      const ground = b.z <= 0.5;
      if (ground) {
        let ax = 0, ay = 0;
        if (sp2 > 1e-6) {
          if (g.wind) { ax += g.wind.x; ay += g.wind.y; }
          if (g.tilt) { ax += g.tilt.x; ay += g.tilt.y; }
          if (g.hungry && b.kind === 'obj') {
            let best = null, bd = 210;
            for (const p of g.pockets) { if (p.closed) continue; const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = p; } }
            if (best) { const a = 300 * (1 - bd / 210) + 60; ax += ((best.x - b.x) / bd) * a; ay += ((best.y - b.y) / bd) * a; }
          }
        }
        if (g.well) {
          const dx = g.well.x - b.x, dy = g.well.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          if (d < g.well.range) {
            const f = 1 - d / g.well.range, a = g.well.k * f * f;
            if (sp2 > 1e-6 || a > mu0 * 1.05) { ax += (dx / d) * a; ay += (dy / d) * a; }
          }
        }
        if (magnets && b.kind === 'obj') {
          for (const m of magnets) {
            if (m === b) continue;
            const dx = m.x - b.x, dy = m.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
            if (d < 170 && d > 1) { const a = 560 * (1 - d / 170); ax += (dx / d) * a; ay += (dy / d) * a; }
          }
        }
        if (ax || ay) { b.vx += ax * h; b.vy += ay * h; sp2 = b.vx * b.vx + b.vy * b.vy; }
      }
      if (sp2 > 0) {
        let sp = Math.sqrt(sp2);
        if (ground) {
          let mu = mu0;
          for (const p of g.patches) { const dx = b.x - p.x, dy = b.y - p.y; if (dx * dx + dy * dy < p.r * p.r) mu *= p.mul; }
          const ns = sp * (1 - 0.32 * h) - mu * h;
          if (ns <= 0) { b.vx = 0; b.vy = 0; sp = 0; } else { const k = ns / sp; b.vx *= k; b.vy *= k; sp = ns; }
        }
        if (sp > VMAX) { const k = VMAX / sp; b.vx *= k; b.vy *= k; }
        if (sp > 0) {
          const dx = b.vx * h, dy = b.vy * h;
          b.x += dx; b.y += dy;
          roll(b, dx, dy);
        }
      }
      if (b.z > 0 || b.vz !== 0) {
        b.vz -= GRAV * h; b.z += b.vz * h;
        if (b.z <= 0) {
          b.z = 0;
          if (b.vz < -240) { ev.push({ t: 'land', b, v: -b.vz }); b.vz = -b.vz * 0.38; } else b.vz = 0;
        }
      }
    }
    // bola × bola
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      if (!a.alive || a.sink) continue;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j];
        if (!b.alive || b.sink) continue;
        const ac = a.kind === 'cue', bc = b.kind === 'cue';
        if (ac && bc) continue;
        if ((a.ghost && !bc) || (b.ghost && !ac)) continue;
        const rr = a.r + b.r, dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const dz = a.z - b.z;
        if (dz > rr * 0.75 || dz < -rr * 0.75) continue;
        const cue = ac ? a : bc ? b : null, other = ac ? b : a;
        if (cue && cue.passed) {
          if (cue.passed.indexOf(other.id) >= 0) continue;
          if (cue.phase > 0) { cue.phase--; cue.passed.push(other.id); ev.push({ t: 'phase', b: cue, o: other }); continue; }
        }
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = rr - d;
        const ima = 1 / a.m, imb = 1 / b.m, tot = ima + imb;
        a.x -= (nx * ov * ima) / tot; a.y -= (ny * ov * ima) / tot;
        b.x += (nx * ov * imb) / tot; b.y += (ny * ov * imb) / tot;
        const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (vn <= 0) continue;
        const first = cue && !cue.firstHit;
        const pvx = cue ? cue.vx : 0, pvy = cue ? cue.vy : 0;
        const jimp = ((1 + E_BALL) * vn) / tot;
        a.vx -= jimp * ima * nx; a.vy -= jimp * ima * ny;
        b.vx += jimp * imb * nx; b.vy += jimp * imb * ny;
        if (first) {
          cue.firstHit = true;
          if (cue.plow) { cue.vx += (pvx - cue.vx) * cue.plow; cue.vy += (pvy - cue.vy) * cue.plow; }
          if (cue.follow) { cue.vx += pvx * cue.follow * 0.55; cue.vy += pvy * cue.follow * 0.55; }
        }
        ev.push({ t: 'hit', a, b, v: vn, x: a.x + nx * a.r, y: a.y + ny * a.r, first, cue, other });
      }
    }
    // tabelas, engradados, hélice, rebatedores, portais, caçapas
    const hasWalls = g.hasWalls;
    let sp = null;
    if (g.spinner) sp = spinnerEnds(g.spinner);
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (!b.alive || b.sink) continue;
      if (b.z > RAIL_Z) {
        // no ar, acima das tabelas: uma parede invisível mantém a bola na mesa
        if (b.x > hw - b.r) { b.x = hw - b.r; if (b.vx > 0) b.vx *= -0.5; } else if (b.x < -hw + b.r) { b.x = -hw + b.r; if (b.vx < 0) b.vx *= -0.5; }
        if (b.y > hh - b.r) { b.y = hh - b.r; if (b.vy > 0) b.vy *= -0.5; } else if (b.y < -hh + b.r) { b.y = -hh + b.r; if (b.vy < 0) b.vy *= -0.5; }
        continue;
      }
      const inner = b.x > -hw + b.r + 1 && b.x < hw - b.r - 1 && b.y > -hh + b.r + 1 && b.y < hh - b.r - 1;
      if (!inner || hasWalls) {
        for (let k = 0; k < g.segs.length; k++) {
          const s = g.segs[k];
          if (inner && !s.wall) continue;
          collideSeg(w, b, s, s.x1, s.y1, s.x2, s.y2, null);
        }
      }
      if (sp) collideSeg(w, b, SPIN_SEG, sp[0], sp[1], sp[2], sp[3], w.spin ? g.spinner : null);
      for (let k = 0; k < g.circles.length; k++) {
        const c = g.circles[k];
        const dx = b.x - c.x, dy = b.y - c.y, rr = b.r + c.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
        b.x = c.x + nx * rr; b.y = c.y + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + c.e) * vn * nx; b.vy -= (1 + c.e) * vn * ny;
          if (c.kick) {
            const out = b.vx * nx + b.vy * ny;
            if (out < c.kick) { b.vx += (c.kick - out) * nx; b.vy += (c.kick - out) * ny; }
          }
          ev.push({ t: c.lid ? 'lid' : 'bumper', b, c, v: -vn });
        }
      }
      if (g.portals && b.portalCd <= 0) {
        for (let k = 0; k < 2; k++) {
          const p = g.portals[k], q = g.portals[1 - k];
          const dx = b.x - p.x, dy = b.y - p.y;
          if (dx * dx + dy * dy < p.r * p.r) {
            b.x = q.x + dx; b.y = q.y + dy; b.portalCd = 0.55;
            ev.push({ t: 'portal', b, from: p, to: q });
            break;
          }
        }
      }
      if (b.z > 6) continue;
      let sunk = false;
      for (let k = 0; k < 6; k++) {
        const p = g.pockets[k];
        if (p.closed) continue;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy < p.r * p.r) { sinkBall(w, b, k, p.x, p.y); sunk = true; break; }
      }
      if (sunk) continue;
      const ox = Math.abs(b.x) - hw, oy = Math.abs(b.y) - hh;
      if (ox > 4 || oy > 4) {
        let best = 0, bd = Infinity;
        for (let k = 0; k < 6; k++) { const p = g.pockets[k], d = Math.hypot(b.x - p.x, b.y - p.y); if (d < bd) { bd = d; best = k; } }
        const p = g.pockets[best];
        if (!p.closed) { sinkBall(w, b, best, p.x, p.y); continue; }
        // caçapa tampada: devolve para dentro
        if (ox > 0) { b.x = Math.sign(b.x) * (hw - b.r); b.vx = -Math.sign(b.x) * Math.abs(b.vx) * 0.6; }
        if (oy > 0) { b.y = Math.sign(b.y) * (hh - b.r); b.vy = -Math.sign(b.y) * Math.abs(b.vy) * 0.6; }
      }
      if (g.well) {
        const dx = b.x - g.well.x, dy = b.y - g.well.y;
        if (dx * dx + dy * dy < g.well.r * g.well.r) sinkBall(w, b, -1, g.well.x, g.well.y);
      }
    }
    w.time += h;
  }
  const SPIN_SEG = { wall: true, spinnerSeg: true };

  // Avança o mundo em dt segundos, com subpassos conforme a bola mais rápida.
  P.step = function (w, dt) {
    let vmax = 0;
    const B = w.balls;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (!b.alive) continue;
      if (b.sink) {
        b.sink.t += dt;
        const k = Math.min(1, b.sink.t / 0.26);
        b.x = b.sink.sx + (b.sink.x - b.sink.sx) * k; b.y = b.sink.sy + (b.sink.y - b.sink.sy) * k;
        if (b.sink.t >= 0.3) b.alive = false;
        continue;
      }
      const s = Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vz);
      if (s > vmax) vmax = s;
    }
    const n = Math.max(1, Math.min(24, Math.ceil((vmax * dt) / (P.R * 0.4))));
    const h = dt / n;
    for (let k = 0; k < n; k++) substep(w, h);
  };

  P.atRest = function (w) {
    for (const b of w.balls) {
      if (!b.alive) continue;
      if (b.sink || b.vx !== 0 || b.vy !== 0 || b.z > 0 || b.vz !== 0) return false;
    }
    return true;
  };

  P.makeWorld = function (geom) {
    return { geom, balls: [], events: [], time: 0, spin: false };
  };

  // ---------- Previsão para a guia de mira ----------
  function rayCircle(x, y, dx, dy, cx, cy, R) {
    const ox = x - cx, oy = y - cy, b = ox * dx + oy * dy, c = ox * ox + oy * oy - R * R;
    if (c < 0) return -1;
    const disc = b * b - c;
    if (disc < 0) return -1;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : -1;
  }
  P.castRay = function (w, x, y, dx, dy, r, skipId, opts) {
    const g = w.geom;
    const best = { t: Infinity, type: 'none', nx: 0, ny: 0, ball: null };
    const set = (t, type, nx, ny, ball) => { if (t >= 0 && t < best.t) { best.t = t; best.type = type; best.nx = nx; best.ny = ny; best.ball = ball || null; } };
    if (dx > 1e-9) set((g.hw - r - x) / dx, 'rail', -1, 0); else if (dx < -1e-9) set((-g.hw + r - x) / dx, 'rail', 1, 0);
    if (dy > 1e-9) set((g.hh - r - y) / dy, 'rail', 0, -1); else if (dy < -1e-9) set((-g.hh + r - y) / dy, 'rail', 0, 1);
    if (!(opts && opts.noBalls)) {
      for (const b of w.balls) {
        if (!b.alive || b.sink || b.id === skipId || b.kind === 'cue') continue;
        const t = rayCircle(x, y, dx, dy, b.x, b.y, b.r + r);
        if (t >= 0 && t < best.t) { best.t = t; best.type = 'ball'; best.ball = b; }
      }
    }
    for (const c of g.circles) {
      const t = rayCircle(x, y, dx, dy, c.x, c.y, c.r + r);
      if (t >= 0 && t < best.t) { const hx = x + dx * t, hy = y + dy * t, d = Math.hypot(hx - c.x, hy - c.y) || 1; set(t, 'bumper', (hx - c.x) / d, (hy - c.y) / d); }
    }
    const caps = [];
    for (const s of g.segs) if (s.wall) caps.push([s.x1, s.y1, s.x2, s.y2]);
    if (g.spinner) caps.push(spinnerEnds(g.spinner));
    for (const s of caps) {
      const ex = s[2] - s[0], ey = s[3] - s[1], len = Math.hypot(ex, ey), ux = ex / len, uy = ey / len, nx = -uy, ny = ux;
      const s0 = (x - s[0]) * nx + (y - s[1]) * ny, rate = dx * nx + dy * ny;
      if (Math.abs(s0) > r && Math.abs(rate) > 1e-9) {
        const side = s0 > 0 ? 1 : -1, t = (side * r - s0) / rate;
        if (t >= 0 && t < best.t) {
          const u = (x + dx * t - s[0]) * ux + (y + dy * t - s[1]) * uy;
          if (u >= 0 && u <= len) set(t, 'wall', nx * side, ny * side);
        }
      }
      for (let k = 0; k < 2; k++) {
        const cx = s[k * 2], cy = s[k * 2 + 1], t = rayCircle(x, y, dx, dy, cx, cy, r);
        if (t >= 0 && t < best.t) { const hx = x + dx * t, hy = y + dy * t; set(t, 'wall', (hx - cx) / r, (hy - cy) / r); }
      }
    }
    best.x = x + dx * best.t; best.y = y + dy * best.t;
    if (best.type === 'ball') {
      const b = best.ball, d = Math.hypot(b.x - best.x, b.y - best.y) || 1;
      best.nx = (b.x - best.x) / d; best.ny = (b.y - best.y) / d; // direção em que a bola-alvo sai
    }
    return best;
  };
})(typeof window !== 'undefined' ? window : globalThis);
