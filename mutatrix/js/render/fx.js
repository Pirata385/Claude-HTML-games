/* Mutatrix: efeitos em pixel art (PixiJS): partículas, tremor, clarões, projéteis, desastres e balões de fala. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const X = MX.Pix, PAL = X.PAL;
  const TAU = Math.PI * 2;
  const R = Math.round;

  const parts = [], projs = [], beams = [];
  let maxParts = 500;
  let shakeMag = 0, shakeT = 0, shakeDur = 0;
  let flashCol = 0xffffff, flashA = 0, flashDur = 0, flashT = 0;
  let event = null;
  const opts = { shake: true, flashes: true, reduced: false };
  const GLOWY = new Set(['spark', 'star', 'fire']);

  function setLimits(level) { maxParts = level === 0 ? 160 : level === 1 ? 320 : 600; }
  function configure(o) { Object.assign(opts, o); }

  function spawn(type, x, y, o) {
    if (parts.length >= maxParts) parts.shift();
    o = o || {};
    const p = {
      type, x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, drag: o.drag === undefined ? 0.98 : o.drag,
      life: 0, max: o.life || 1, size: o.size || 2, grow: o.grow || 0, rot: o.rot || Math.random() * TAU, vr: o.vr || 0,
      color: X.num(o.color === undefined ? PAL.pink : o.color), text: o.text, floor: o.floor, bounce: o.bounce || 0, wob: Math.random() * TAU,
    };
    parts.push(p);
    return p;
  }
  function burst(type, x, y, n, o) {
    o = o || {};
    n = Math.max(1, Math.round(n * X.Q.particles));
    for (let i = 0; i < n; i++) {
      const a = o.angle === undefined ? Math.random() * TAU : o.angle + (Math.random() - 0.5) * (o.spread || 1);
      const sp = (o.speed || 60) * (0.4 + Math.random() * 0.8);
      spawn(type, x + (Math.random() - 0.5) * (o.jitter || 0), y + (Math.random() - 0.5) * (o.jitter || 0), Object.assign({}, o, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vr: (Math.random() - 0.5) * 8,
        size: (o.size || 2) * (0.6 + Math.random() * 0.8), life: (o.life || 1) * (0.6 + Math.random() * 0.7),
        color: Array.isArray(o.colors) ? o.colors[i % o.colors.length] : o.color,
      }));
    }
  }
  function themeParticle(theme, x, y, u) {
    if (Math.random() > X.Q.particles) return null;
    const r = Math.random;
    u = u || 1;
    switch (theme) {
      case 'igneo': return spawn('fire', x, y, { vy: -28 * u, vx: (r() - 0.5) * 12 * u, life: 0.7, size: 3 * u, grow: -3.5 * u, color: r() < 0.5 ? PAL.orange : PAL.yellow });
      case 'aquatico': return spawn('bubble', x, y, { vy: -22 * u, vx: (r() - 0.5) * 8 * u, life: 1.4, size: 1.5 * u + r() * 1.5 * u, color: PAL.cyan });
      case 'eletrico': return spawn('spark', x, y, { vx: (r() - 0.5) * 140 * u, vy: (r() - 0.5) * 140 * u, life: 0.22, size: 3, color: 0xffe066, drag: 0.88 });
      case 'vegetal': return spawn('leaf', x, y, { vx: (r() - 0.5) * 22 * u, vy: -14 * u, g: 18 * u, life: 1.6, size: 2, color: r() < 0.5 ? PAL.green : PAL.lime });
      case 'osseo': return spawn('bone', x, y, { vx: (r() - 0.5) * 36 * u, vy: -36 * u, g: 130 * u, life: 1.1, size: 2, color: 0xefe3c8 });
      case 'musical': return spawn('note', x, y, { vx: (r() - 0.5) * 12 * u, vy: -20 * u, life: 1.6, size: 1, color: r() < 0.5 ? PAL.pink : PAL.purple });
      case 'cosmico': return spawn('star', x + (r() - 0.5) * 12 * u, y, { vx: (r() - 0.5) * 8 * u, vy: -9 * u, life: 1.3, size: 2, color: r() < 0.5 ? 0xfff3a0 : 0xc9b8ff });
      case 'cristalino': return spawn('shard', x, y, { vx: (r() - 0.5) * 30 * u, vy: -26 * u, g: 70 * u, life: 1.1, size: 2, color: PAL.cyan });
      case 'sombrio': return spawn('wisp', x, y, { vx: (r() - 0.5) * 8 * u, vy: -15 * u, life: 1.4, size: 2.5 * u, grow: 3 * u, color: 0x4a3a6b });
      case 'gasoso': return spawn('puff', x, y, { vx: (r() - 0.5) * 10 * u, vy: -11 * u, life: 1.6, size: 2 * u, grow: 4 * u, color: PAL.lime });
      case 'magnetico': return spawn('iron', x, y, { vx: (r() - 0.5) * 50 * u, vy: (r() - 0.5) * 50 * u, life: 0.8, size: 1, color: 0x6d7480, drag: 0.92 });
      case 'acucarado': return spawn('sprinkle', x, y, { vx: (r() - 0.5) * 40 * u, vy: -30 * u, g: 110 * u, life: 1.2, size: 2, color: [PAL.pink, PAL.yellow, PAL.cyan, PAL.white, PAL.orange][Math.floor(r() * 5)] });
      default: return spawn('puff', x, y, { vy: -12 * u, life: 1, size: 2, grow: 3, color: PAL.white });
    }
  }
  function floatText(x, y, text, color) { spawn('text', x, y, { vy: -16, drag: 0.97, life: 1.6, color: color === undefined ? PAL.white : color, text }); }

  function update(dt, L) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vx *= Math.pow(p.drag, dt * 60); p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.size = Math.max(0.5, p.size + p.grow * dt);
      if (p.type === 'bubble' || p.type === 'note') p.x += Math.sin(p.life * 5 + p.wob) * 0.15;
      if (p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vy = -p.vy * p.bounce; p.vx *= 0.7; p.vr *= 0.6; }
    }
    for (let i = projs.length - 1; i >= 0; i--) {
      const q = projs[i];
      q.t += dt / q.dur;
      if (q.t >= 1) { projs.splice(i, 1); if (q.onHit) q.onHit(q); continue; }
      if (Math.random() < 0.5) spawn(q.trail, q.x0 + (q.x1 - q.x0) * q.t, q.y0 + (q.y1 - q.y0) * q.t - Math.sin(q.t * Math.PI) * q.arc, { life: 0.35, size: q.size * 0.6, grow: -q.size, color: q.color });
    }
    for (let i = beams.length - 1; i >= 0; i--) { beams[i].t += dt; if (beams[i].t > beams[i].dur) beams.splice(i, 1); }
    if (shakeT < shakeDur) shakeT += dt;
    if (flashT < flashDur) flashT += dt;
    if (event) {
      event.t += dt;
      event.update(dt, L);
      if (event.t >= event.dur) { const e = event; event = null; if (e.onEnd) e.onEnd(e); }
    }
  }

  const NOTE = [[0, 1, 1], [0, 1, 0], [0, 1, 0], [1, 1, 0], [1, 1, 0]];
  function draw(g, gl) {
    for (const p of parts) {
      const k = p.life / p.max;
      if (k > 0.75 && ((p.life * 30) | 0) % 2 === 0 && p.type !== 'text') continue; // pisca antes de sumir
      const s = Math.max(1, R(p.size));
      const x = R(p.x), y = R(p.y);
      switch (p.type) {
        case 'fire': g.rect(x - (s >> 1), y - (s >> 1), s, s).fill(p.color); gl.rect(x - s, y - s, s * 2, s * 2).fill({ color: p.color, alpha: 0.25 }); break;
        case 'bubble': g.circle(x, y, s).stroke({ width: 1, color: p.color }); g.rect(x - 1, y - 1, 1, 1).fill(PAL.white); break;
        case 'spark': { const l = 2 + R(Math.hypot(p.vx, p.vy) * 0.02); const an = Math.atan2(p.vy, p.vx); gl.moveTo(x, y).lineTo(R(x - Math.cos(an) * l), R(y - Math.sin(an) * l)).stroke({ width: 1, color: p.color }); break; }
        case 'leaf': case 'petal': g.rect(x, y, 2, Math.cos(p.rot) > 0 ? 1 : 2).fill(p.color); break;
        case 'bone': g.rect(x - 1, y, 3, 1).fill(p.color); g.rect(x - 2, y - 1, 1, 1).fill(p.color); g.rect(x + 2, y + 1, 1, 1).fill(p.color); break;
        case 'note': for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (NOTE[r][c]) g.rect(x + c, y + r, 1, 1).fill(p.color); break;
        case 'star': { const tw = Math.sin(p.life * 12 + p.wob) > 0 ? 2 : 1; gl.rect(x - tw, y, tw * 2 + 1, 1).fill(p.color); gl.rect(x, y - tw, 1, tw * 2 + 1).fill(p.color); break; }
        case 'shard': g.rect(x, y - 1, 1, 1).fill(p.color); g.rect(x - 1, y, 3, 1).fill(p.color); g.rect(x, y + 1, 1, 1).fill(p.color); break;
        case 'sprinkle': case 'confetti': g.rect(x, y, Math.cos(p.rot) > 0 ? 2 : 1, Math.cos(p.rot) > 0 ? 1 : 2).fill(p.color); break;
        case 'piece': X.rect(g, x - 1, y - 1, 3, 2, p.color); break;
        case 'wisp': case 'puff': case 'smoke': case 'fog': g.circle(x, y, s).fill({ color: p.color, alpha: p.type === 'fog' ? 0.28 : 0.55 }); break;
        case 'iron': g.rect(x, y, 1, 1).fill(p.color); break;
        case 'goo': X.circ(g, x, y, s, p.color, { flat: true }); break;
        case 'drip': g.rect(x, y, 1, 2).fill(p.color); break;
        case 'ring': g.ellipse(x, y, s, Math.max(1, R(s * 0.6))).stroke({ width: 1, color: p.color, alpha: 1 - k }); break;
        case 'poof': g.circle(x, y, s).fill({ color: PAL.white, alpha: 0.85 }); g.circle(x, y, s).stroke({ width: 1, color: PAL.ink, alpha: 0.6 }); break;
        case 'tool': X.line(g, [[x - 2, y + 2], [x + 2, y - 2]], 1, PAL.silver, { outline: true }); break;
        case 'text': X.text(g, p.text, x, y, p.color, { align: 'center', shadow: PAL.ink }); break;
        default: g.rect(x, y, s, s).fill(p.color);
      }
    }
    for (const q of projs) {
      const x = R(q.x0 + (q.x1 - q.x0) * q.t), y = R(q.y0 + (q.y1 - q.y0) * q.t - Math.sin(q.t * Math.PI) * q.arc);
      if (q.kind === 'bone') { g.rect(x - 2, y, 5, 1).fill(q.color); g.rect(x - 3, y - 1, 1, 3).fill(q.color); g.rect(x + 3, y - 1, 1, 3).fill(q.color); }
      else if (q.kind === 'tool') X.line(g, [[x - 3, y + 3], [x + 3, y - 3]], 1, PAL.silver, { outline: true });
      else if (q.kind === 'shard' || q.kind === 'thorn') X.poly(g, [[x, y - 3], [x + 2, y + 2], [x - 2, y + 2]], q.color);
      else if (q.kind === 'sound') g.circle(x, y, R(q.size * (1 + q.t * 2))).stroke({ width: 1, color: q.color });
      else { X.circ(g, x, y, q.size, q.color, { flat: true }); gl.circle(x, y, q.size + 2).fill({ color: q.color, alpha: 0.3 }); }
    }
    for (const b of beams) {
      const pts = [[b.x0, b.y0]];
      if (b.zig) for (let i = 1; i < 6; i++) { const f = i / 6; pts.push([b.x0 + (b.x1 - b.x0) * f + (Math.random() - 0.5) * 6, b.y0 + (b.y1 - b.y0) * f + (Math.random() - 0.5) * 6]); }
      pts.push([b.x1, b.y1]);
      X.line(gl, pts, 3, b.color, { alpha: 0.5 });
      X.line(gl, pts, 1, PAL.white);
    }
  }

  // ---------------------------------------------------------------- projéteis e raios
  const PROJ = {
    fireball: { kind: 'ball', color: PAL.orange, trail: 'fire', arc: 8 }, acid: { kind: 'ball', color: PAL.lime, trail: 'drip', arc: 14 },
    zap: { beam: true, color: 0xffe066 }, thorn: { kind: 'thorn', color: PAL.green, trail: 'leaf', arc: 4 }, bone: { kind: 'bone', color: 0xefe3c8, trail: 'puff', arc: 12 },
    sound: { kind: 'sound', color: PAL.pink, trail: 'ring', arc: 0 }, star: { kind: 'ball', color: 0xfff3a0, trail: 'star', arc: 10 },
    shard: { kind: 'shard', color: PAL.cyan, trail: 'shard', arc: 6 }, claw: { beam: true, color: 0x8a5cc9 }, puff: { kind: 'ball', color: PAL.lime, trail: 'puff', arc: 4 },
    tool: { kind: 'tool', color: PAL.silver, trail: 'iron', arc: 14 }, syrup: { kind: 'ball', color: 0xffaad4, trail: 'drip', arc: 14 },
  };
  function projectile(type, x0, y0, x1, y1, u, onHit) {
    const d = PROJ[type] || PROJ.fireball;
    if (d.beam) { beams.push({ x0, y0, x1, y1, t: 0, dur: 0.35, color: d.color, zig: true }); setTimeout(() => onHit && onHit({ x1, y1 }), 60); return; }
    projs.push({ x0, y0, x1, y1, t: 0, dur: 0.45, color: d.color, trail: d.trail, arc: d.arc * (u || 1), size: Math.max(2, 2 * (u || 1)), kind: d.kind, onHit });
  }
  function laser(x0, y0, x1, y1, color) { beams.push({ x0, y0, x1, y1, t: 0, dur: 0.4, color: X.num(color || 0xff4d4d), zig: false }); }

  // ---------------------------------------------------------------- tremor e clarão
  function shake(mag, dur) {
    if (!opts.shake || opts.reduced) return;
    shakeMag = Math.max(shakeMag * (1 - shakeT / Math.max(0.01, shakeDur)), mag); shakeT = 0; shakeDur = dur || 0.4;
  }
  function shakeOffset() {
    if (shakeT >= shakeDur) return [0, 0];
    const k = 1 - shakeT / shakeDur;
    const m = shakeMag * k * k;
    return [R((Math.random() - 0.5) * m * 2), R((Math.random() - 0.5) * m * 2)];
  }
  function flash(color, dur, a) { if (!opts.flashes) return; flashCol = X.num(color || 0xffffff); flashDur = dur || 0.25; flashT = 0; flashA = a === undefined ? 0.7 : a; }
  function drawFlash(g, W, H) { if (flashT < flashDur) g.rect(0, 0, W, H).fill({ color: flashCol, alpha: flashA * (1 - flashT / flashDur) }); }

  // ---------------------------------------------------------------- desastres
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function makeEvent(id, L, info) {
    const U = L.U, u = L.u;
    const e = { id, t: 0, dur: (info && info.dur) || 5, decals: [], update() {}, draw() {} };
    const RC = L.rect;
    const wallY = () => rnd(0.25, 0.65);
    const benchYn = (L.benchY - RC.y) / RC.h;
    const fade = () => (e.t > e.dur - 0.8 ? Math.max(0, (e.dur - e.t) / 0.8) : 1);
    switch (id) {
      case 'incendio':
        e.update = () => { if (e.t < e.dur - 1) for (let i = 0; i < 4; i++) spawn('fire', rnd(0, L.W), L.benchY + rnd(-2, 3), { vy: -rnd(30, 80) * u, vx: rnd(-8, 8), life: rnd(0.5, 1.1), size: rnd(3, 6) * u, grow: -5 * u, color: Math.random() < 0.5 ? PAL.orange : PAL.yellow }); if (Math.random() < 0.3) spawn('smoke', rnd(0, L.W), L.benchY - U(20), { vy: -25 * u, life: 2, size: 4 * u, grow: 7 * u, color: 0x6d6c64 }); };
        e.draw = (g, gl) => { gl.rect(0, 0, L.W, L.H).fill({ color: PAL.orange, alpha: 0.06 + (Math.sin(e.t * 20) > 0 ? 0.05 : 0) }); };
        e.decals = [{ type: 'scorch', x: rnd(0.1, 0.9), y: benchYn - 0.05 }, { type: 'scorch', x: rnd(0.1, 0.9), y: wallY() }];
        break;
      case 'inundacao':
        e.update = () => { const k = e.t / e.dur; e.level = k < 0.35 ? k / 0.35 : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; if (Math.random() < 0.4) spawn('bubble', rnd(0, L.W), L.H - 4, { vy: -rnd(15, 45) * u, life: 2, size: rnd(1, 3), color: PAL.cyan }); };
        e.draw = (g) => {
          const lvl = e.level || 0;
          const top = R(L.H - (L.H - (L.benchY - U(30))) * lvl);
          for (let x = 0; x < L.W; x += 2) { const yy = R(top + Math.sin(x * 0.08 + e.t * 3) * 2); g.rect(x, yy, 2, L.H - yy).fill({ color: PAL.sky, alpha: 0.42 }); g.rect(x, yy, 2, 1).fill({ color: PAL.white, alpha: 0.8 }); }
          if (lvl > 0.2) { const dx = R(L.W * 0.3 + Math.sin(e.t * 0.8) * U(20)), dy = R(top - U(3)); X.ell(g, dx, dy, U(6), U(4), PAL.yellow); X.circ(g, dx + U(4), dy - U(4), U(3), PAL.yellow, { noHi: true }); X.rect(g, dx + U(7), dy - U(4), U(2), 1, PAL.orange, { noOutline: true }); X.px(g, dx + U(4), dy - U(5), PAL.ink, 1); }
        };
        e.decals = [{ type: 'water', x: rnd(0.2, 0.8), y: benchYn + 0.01 }];
        break;
      case 'blecaute':
        e.draw = (g, gl, focus) => {
          const k = e.t / e.dur;
          const dark = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
          g.rect(0, 0, L.W, L.H).fill({ color: 0x080c16, alpha: 0.86 * dark * (Math.random() < 0.08 ? 0.5 : 1) });
          if (focus) { gl.rect(R(focus[0]) - 4, R(focus[1]), 2, 2).fill(0xfff7c2); gl.rect(R(focus[0]) + 3, R(focus[1]), 2, 2).fill(0xfff7c2); }
          if (Math.random() < 0.15) spawn('spark', L.mach.x, L.mach.bottom - L.mach.h * 0.5, { vx: rnd(-80, 80), vy: rnd(-80, 20), life: 0.3, size: 3, color: 0xffe066 });
        };
        e.decals = [{ type: 'scorch', x: (L.mach.x - RC.x) / RC.w, y: 0.45, k: 0.6 }];
        break;
      case 'trepadeiras': {
        const vines = [];
        for (let i = 0; i < 8; i++) { const fromTop = i % 3 === 0; const x0 = rnd(0, L.W), y0 = fromTop ? RC.y : L.H; const pts = [[x0, y0]]; let x = x0, y = y0; for (let k = 0; k < 6; k++) { x += rnd(-16, 16) * u; y += (fromTop ? 1 : -1) * rnd(14, 24) * u; pts.push([x, y]); } vines.push(pts); }
        e.draw = (g) => {
          if (fade() <= 0.3) return;
          const k = Math.min(1, e.t / (e.dur * 0.5));
          for (const v of vines) { const n = Math.max(2, Math.floor(v.length * k)); const pts = v.slice(0, n); X.line(g, pts, Math.max(2, U(2)), PAL.green, { outline: true }); for (let i = 1; i < n; i++) X.ell(g, pts[i][0] + U(3), pts[i][1], U(3), Math.max(1, U(1.5)), PAL.lime, { flat: true }); }
        };
        e.decals = [{ type: 'vine', x: rnd(0.05, 0.3), y: rnd(0.1, 0.4) }, { type: 'vine', x: rnd(0.7, 0.95), y: rnd(0.1, 0.4) }];
        break;
      }
      case 'terremoto':
        e.update = () => { shake(4, 0.3); if (Math.random() < 0.25) spawn('bone', rnd(0, L.W), RC.y, { vy: rnd(20, 60), vx: rnd(-15, 15), g: 280 * u, life: 3, size: 2, vr: rnd(-6, 6), color: 0xefe3c8, floor: L.benchY, bounce: 0.4 }); };
        e.decals = [{ type: 'bone', x: rnd(0.2, 0.8), y: benchYn }, { type: 'crack', x: rnd(0.1, 0.9), y: wallY() }];
        break;
      case 'onda':
        e.update = () => { if (Math.random() < 0.18) spawn('ring', L.cx, (L.top + L.floorY) / 2, { life: 1.4, size: 6, grow: 140 * u, color: Math.random() < 0.5 ? PAL.pink : PAL.purple, drag: 1 }); };
        e.decals = [{ type: 'crack', x: rnd(0.1, 0.9), y: wallY() }, { type: 'crack', x: rnd(0.1, 0.9), y: wallY() }];
        e.glass = true;
        break;
      case 'buraco': {
        const bx = R(L.cx - L.R * 1.5), by = R((L.top + L.floorY) / 2);
        e.update = () => {
          const k = e.t / e.dur;
          e.r = U(11) * (k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1);
          shake(1.5, 0.2);
          if (Math.random() < 0.5) { const a = rnd(0, TAU), d = rnd(50, 140) * u; const p = spawn(Math.random() < 0.5 ? 'confetti' : 'iron', bx + Math.cos(a) * d, by + Math.sin(a) * d, { life: 1.1, size: 2, color: Math.random() < 0.5 ? PAL.cream : PAL.silver, drag: 1 }); p.vx = (bx - p.x) / 1.05; p.vy = (by - p.y) / 1.05; }
        };
        e.draw = (g, gl) => {
          if (!e.r || e.r < 1) return;
          for (let i = 0; i < 3; i++) { const rr = e.r * (1.6 + i * 0.35); const a0 = e.t * 2 + i * 2; gl.ellipse(bx, by, R(rr), Math.max(1, R(rr * 0.35))).stroke({ width: 1, color: [PAL.pink, PAL.purple, 0xfff3a0][i], alpha: 0.6 + 0.4 * Math.sin(a0) }); }
          X.circ(g, bx, by, e.r, 0x05060b, { flat: true, ink: PAL.purple });
        };
        e.decals = [{ type: 'scorch', x: (bx - RC.x) / RC.w, y: (by - RC.y) / RC.h, k: 0.8 }];
        break;
      }
      case 'cristais': {
        const cr = [];
        for (let i = 0; i < 14; i++) { const fb = i % 2 === 0; cr.push({ x: rnd(0, L.W), y: fb ? L.benchY - U(2) : rnd(RC.y + U(14), L.benchY - U(50)), h: rnd(10, 26) * u, a: fb ? -Math.PI / 2 + rnd(-0.4, 0.4) : rnd(0, TAU), d: rnd(0, 0.4) }); }
        e.draw = (g, gl) => {
          for (const c of cr) {
            const k = Math.max(0, Math.min(1, (e.t / e.dur - c.d) * 2.5)) * fade();
            if (k <= 0) continue;
            const tip = [c.x + Math.cos(c.a) * c.h * k, c.y + Math.sin(c.a) * c.h * k], px = -Math.sin(c.a) * U(3), py = Math.cos(c.a) * U(3);
            X.poly(g, [[c.x + px, c.y + py], tip, [c.x - px, c.y - py]], PAL.cyan);
          }
          if (Math.random() < 0.3) spawn('star', rnd(0, L.W), rnd(RC.y, L.benchY), { life: 0.6, size: 2, color: PAL.white });
        };
        e.decals = [{ type: 'crystal', x: rnd(0.1, 0.9), y: benchYn }, { type: 'crystal', x: rnd(0.1, 0.9), y: benchYn }];
        break;
      }
      case 'sombras': {
        const ten = [];
        for (let i = 0; i < 8; i++) ten.push({ side: i % 4, off: rnd(0.1, 0.9), ph: rnd(0, TAU) });
        e.draw = (g) => {
          const k = Math.min(1, e.t / 1.5) * fade();
          g.rect(0, 0, L.W, L.H).fill({ color: 0x1c1530, alpha: 0.45 * k });
          for (const tn of ten) {
            const x0 = tn.side === 0 ? 0 : tn.side === 1 ? L.W : tn.off * L.W, y0 = tn.side === 2 ? 0 : tn.side === 3 ? L.H : tn.off * L.H;
            const tx = L.cx + Math.sin(e.t + tn.ph) * U(26), ty = (L.top + L.floorY) / 2 + Math.cos(e.t * 1.3 + tn.ph) * U(20);
            const pts = [];
            for (let i = 0; i <= 6; i++) { const f = i / 6 * k * 0.75; pts.push([x0 + (tx - x0) * f + Math.sin(e.t * 3 + i + tn.ph) * U(6), y0 + (ty - y0) * f + Math.cos(e.t * 2 + i) * U(6)]); }
            X.line(g, pts, Math.max(1, R(U(7) * k)), 0x120d22);
          }
          for (let i = 0; i < 4; i++) { if (Math.sin(e.t * 2 + i * 1.7) < 0.2) continue; const x = R([0.08, 0.92, 0.15, 0.85][i] * L.W), y = R([0.2, 0.25, 0.75, 0.7][i] * L.H); g.rect(x - 3, y, 2, 1).fill(0xff4d4d); g.rect(x + 2, y, 2, 1).fill(0xff4d4d); }
        };
        e.decals = [{ type: 'scorch', x: rnd(0.1, 0.9), y: wallY(), k: 1.2 }];
        break;
      }
      case 'nevoa':
        e.update = () => { if (Math.random() < 0.35) spawn('fog', rnd(-20, L.W), rnd(RC.y, L.H), { vx: rnd(8, 24) * u, life: 3, size: rnd(14, 30) * u, grow: 10 * u, color: [PAL.pink, PAL.cyan, PAL.yellow, PAL.purple][Math.floor(Math.random() * 4)], drag: 1 }); };
        e.decals = [{ type: 'goo', x: rnd(0.2, 0.8), y: benchYn, c: 0xc9a8f0 }];
        break;
      case 'imas':
        e.update = () => { if (Math.random() < 0.12 && e.t < e.dur - 1) { const fromL = Math.random() < 0.5; projs.push({ x0: fromL ? -8 : L.W + 8, y0: rnd(RC.y + U(14), L.benchY), x1: L.cx + rnd(-L.R, L.R), y1: rnd(L.top, L.floorY), t: 0, dur: 0.7, color: PAL.silver, trail: 'iron', arc: U(20), size: 3, kind: 'tool', onHit: () => shake(2, 0.15) }); } };
        e.decals = [{ type: 'wrench', x: rnd(0.1, 0.4), y: wallY() }, { type: 'wrench', x: rnd(0.6, 0.9), y: wallY() }];
        break;
      case 'granulado':
        e.update = () => { if (e.t < e.dur - 1) for (let i = 0; i < 4; i++) spawn('sprinkle', rnd(0, L.W), RC.y - 4, { vy: rnd(60, 120) * u, vx: rnd(-8, 8), g: 120 * u, life: 2.5, size: 2, vr: rnd(-10, 10), color: [PAL.pink, PAL.yellow, PAL.cyan, PAL.white, PAL.orange, PAL.purple][Math.floor(Math.random() * 6)], floor: L.benchY + rnd(0, U(6)), bounce: 0.3 }); };
        e.decals = [{ type: 'sprinkles', x: rnd(0.2, 0.5), y: benchYn }, { type: 'sprinkles', x: rnd(0.5, 0.8), y: benchYn }];
        break;
      default: break;
    }
    return e;
  }
  function startEvent(id, L, info, onEnd) { event = makeEvent(id, L, info); event.onEnd = onEnd; return event; }
  function drawEvent(g, gl, L, focus) { if (event) event.draw(g, gl, focus); }
  function eventActive() { return !!event; }

  // ---------------------------------------------------------------- balão de fala
  function speech(g, x, y, text, maxW) {
    const lines = X.wrap(String(text).toUpperCase(), maxW || 96, 1);
    const w = Math.max(...lines.map((l) => X.measure(l))) + 8, h = lines.length * X.LH + 5;
    const bx = R(x - w / 2), by = R(y - h - 5);
    X.rect(g, bx, by, w, h, PAL.white);
    X.poly(g, [[x - 3, by + h], [x + 2, by + h], [x - 1, by + h + 4]], PAL.white);
    g.rect(R(x - 2), by + h - 1, 4, 2).fill(PAL.white);
    lines.forEach((l, i) => X.text(g, l, x, by + 4 + i * X.LH, PAL.ink, { align: 'center' }));
  }

  function clear() { parts.length = 0; projs.length = 0; beams.length = 0; }
  function count() { return parts.length; }

  MX.FX = {
    setLimits, configure, spawn, burst, themeParticle, floatText, update, draw, projectile, laser,
    shake, shakeOffset, flash, drawFlash, startEvent, drawEvent, eventActive, speech, clear, count,
    get event() { return event; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
