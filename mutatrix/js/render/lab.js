/* Mutatrix: laboratório em pixel art 2.5D (PixiJS): parede, janela, bancada, prateleiras, Mutatrix, câmara e seringa.
   Todas as medidas estão em pixels da resolução baixa. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});
  const X = MX.Pix, PAL = X.PAL;
  const TAU = Math.PI * 2;
  const R = Math.round;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // rect: área livre da cena em pixels baixos.
  function layout(W, H, rect) {
    const vw = Math.max(120, rect.w), vh = Math.max(100, rect.h);
    const narrow = vw < vh * 1.25;
    const u = narrow ? clamp(Math.min(vw / 190, vh / 190), 0.7, 2.4) : clamp(Math.min(vw / 330, vh / 215), 0.7, 2.4);
    const U = (v) => R(v * u);
    const benchY = R(rect.y + vh * (narrow ? 0.84 : 0.81));
    const Rc = U(46);
    let cx = R(rect.x + vw * (narrow ? 0.58 : 0.6));
    const machW = U(66), machH = U(124);
    let mx = cx - Rc - R(machW * 0.6) - U(8);
    if (!narrow && mx - machW / 2 < rect.x + 3) { const d = rect.x + 3 - (mx - machW / 2); cx = Math.min(cx + d, R(rect.x + vw - Rc - U(6))); mx = cx - Rc - R(machW * 0.6) - U(8); }
    const baseH = U(12);
    const floorY = benchY - R(baseH * 0.5);
    const glassH = Math.min(U(112), floorY - rect.y - U(16));
    const L = {
      W, H, rect, u, U, narrow, benchY, R: Rc, cx, floorY, glassH, top: floorY - glassH, baseH, ry: Math.max(3, R(Rc * 0.26)),
      mach: { x: mx, w: machW, h: machH, bottom: benchY + U(2) },
      cs: Rc * 0.54,
      syringe: { x: Math.min(cx + Rc + U(26), R(rect.x + vw - U(18))), y: benchY + U(7) },
      vent: { x: R(rect.x + vw - U(22)), y: R(rect.y + U(16)) },
    };
    const sx0 = cx + Rc + U(10), sx1 = R(rect.x + vw - U(5));
    L.jar = U(16);
    L.shelves = [];
    if (sx1 - sx0 > L.jar * 2.2) { L.shelves = [{ x0: sx0, x1: sx1, y: R(rect.y + vh * 0.32) }, { x0: sx0, x1: sx1, y: R(rect.y + vh * 0.56) }]; L.vent.x = sx1 - U(12); }
    else if (sx1 - sx0 > L.jar * 1.15) L.shelves = [{ x0: sx0, x1: sx1, y: R(rect.y + vh * 0.42) }];
    const machTop = L.mach.bottom - machH;
    const wr = U(15);
    if (machTop - rect.y > wr * 2 + U(10)) L.window = { x: mx, y: R(rect.y + (machTop - rect.y) / 2 + U(2)), r: wr };
    else if (!narrow && cx - Rc - (mx + machW / 2) > wr * 2.4) L.window = { x: R((mx + machW / 2 + cx - Rc) / 2), y: R(rect.y + U(34)), r: wr };
    return L;
  }

  function jarSlots(L, n) {
    const out = [];
    let i = 0;
    for (const sh of L.shelves) {
      const per = Math.max(1, Math.floor((sh.x1 - sh.x0) / (L.jar * 1.3)));
      const gap = (sh.x1 - sh.x0) / per;
      for (let j = 0; j < per && i < n; j++, i++) out.push({ x: R(sh.x0 + gap * (j + 0.5)), y: sh.y });
    }
    return out;
  }

  // ---------------------------------------------------------------- fundo estático
  function drawWall(g, L) {
    const { W, H, benchY, U } = L;
    g.rect(0, 0, W, H).fill(0x3a4670);
    for (let x = 0; x < W; x += U(26)) g.rect(x, 0, 1, benchY).fill(0x333e66);
    for (let x = U(13); x < W; x += U(26)) g.rect(x, 0, 1, benchY).fill(0x45527e);
    g.rect(0, R(L.rect.y + U(4)), W, U(3)).fill(0x29366f);
    const tileTop = benchY - U(48);
    const ts = Math.max(5, U(9));
    g.rect(0, tileTop, W, benchY - tileTop).fill(0x6f8aa6);
    for (let y = tileTop; y < benchY; y += ts) {
      g.rect(0, y, W, 1).fill(0x566c86);
      for (let x = ((y - tileTop) / ts) % 2 ? R(ts / 2) : 0; x < W; x += ts) { g.rect(x, y, 1, ts).fill(0x566c86); g.rect(x + 1, y + 1, 1, 1).fill(0x94b0c2); }
    }
    g.rect(0, tileTop - U(3), W, U(3)).fill(PAL.teal);
    g.rect(0, tileTop - U(3), W, 1).fill(0x3d9a96);
    const py = R(L.rect.y + U(10));
    X.rect(g, -2, py, W + 4, U(5), PAL.silver, { bevel: true });
    for (let x = U(30); x < W; x += U(80)) X.rect(g, x, py - 1, U(6), U(7), PAL.slate, { bevel: true });
    const v = L.vent;
    X.rect(g, v.x - U(10), v.y - U(6), U(20), U(12), 0xa9b8c8, { bevel: true });
    for (let i = 0; i < 4; i++) g.rect(v.x - U(8), v.y - U(4) + i * U(3), U(16), 1).fill(PAL.ink);
  }

  function drawWindowFrame(g, L) {
    const w = L.window;
    if (!w) return;
    X.circ(g, w.x, w.y, w.r + 2, PAL.silver, { flat: true });
    X.circ(g, w.x, w.y, w.r, 0x141a33, { flat: true, noOutline: true });
    const rng = MX.RNG.make('janela');
    for (let i = 0; i < 14; i++) { const a = rng.range(0, TAU), d = rng.range(0, w.r - 2); X.px(g, w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, i % 4 ? 0x94b0c2 : PAL.white); }
    X.circ(g, w.x + w.r * 0.4, w.y - w.r * 0.35, Math.max(2, w.r * 0.25), PAL.cream, { flat: true, noOutline: true });
    X.circ(g, w.x + w.r * 0.5, w.y - w.r * 0.42, Math.max(2, w.r * 0.22), 0x141a33, { flat: true, noOutline: true });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; X.px(g, w.x + Math.cos(a) * (w.r + 1), w.y + Math.sin(a) * (w.r + 1), PAL.slate, 1); }
  }

  function drawPoster(g, x, y, w, h, kind) {
    X.rect(g, x - w / 2, y - h / 2, w, h, kind === 'cartaz' ? PAL.cream : PAL.yellow, { bevel: true });
    if (kind === 'cartaz') {
      X.circ(g, x, y - h * 0.15, w * 0.25, PAL.pink);
      X.text(g, 'MUTE', x, y + h * 0.12, PAL.ink, { align: 'center' });
      X.text(g, 'COM', x, y + h * 0.3, PAL.red, { align: 'center' });
    } else {
      X.poly(g, [[x, y - h * 0.38], [x + w * 0.32, y + h * 0.08], [x - w * 0.32, y + h * 0.08]], PAL.cream);
      X.text(g, '!', x, y - h * 0.2, PAL.ink, { align: 'center' });
      X.text(g, 'PERIGO', x, y + h * 0.2, PAL.ink, { align: 'center' });
    }
  }

  function drawJar(g, x, y, L, entry) {
    const w = L.jar, h = R(L.jar * 1.25);
    const top = y - h;
    X.rect(g, x - w / 2, top, w, h, entry ? 0x8fd9b8 : 0xb8e6ee, { alpha: entry ? 0.45 : 0.25 });
    if (entry && entry.sub) MX.Creature.portrait(g, entry.sub, x, y - R(h * 0.16), Math.max(4, w * 0.2), 0.5);
    g.rect(x - w / 2 + 1, top + 2, 1, h - 4).fill({ color: PAL.white, alpha: 0.6 });
    X.rect(g, x - w / 2 + 1, top - 3, w - 2, 3, entry ? 0xc9573f : PAL.silver);
    X.rect(g, x - w / 2 + 2, y - R(h * 0.32), w - 4, Math.max(3, R(h * 0.18)), PAL.cream, { noOutline: true });
  }

  function drawShelves(g, L, state) {
    const U = L.U;
    for (const sh of L.shelves) {
      X.rect(g, sh.x0 - U(3), sh.y, sh.x1 - sh.x0 + U(6), U(3), PAL.wood, { bevel: true });
      for (const bx of [sh.x0, sh.x1]) X.poly(g, [[bx - U(2), sh.y + U(3)], [bx + U(2), sh.y + U(3)], [bx, sh.y + U(8)]], PAL.brown);
    }
    const n = state ? state.unlocked.shelf : 4;
    jarSlots(L, n).forEach((sl, i) => drawJar(g, sl.x, sl.y, L, state && state.shelf[i] ? state.shelf[i] : null));
    const top = L.shelves[0];
    const deco = state ? state.unlocked.decor : [];
    if (top && (deco.includes('trofeu') || deco.includes('trofeu_ouro'))) {
      const gold = deco.includes('trofeu_ouro');
      const tx = top.x0 + U(4), ty = top.y;
      X.rect(g, tx - U(4), ty - U(3), U(8), U(3), PAL.brown);
      X.rect(g, tx - 1, ty - U(7), 2, U(4), gold ? PAL.yellow : PAL.silver);
      X.poly(g, [[tx - U(5), ty - U(14)], [tx + U(5), ty - U(14)], [tx + U(2), ty - U(7)], [tx - U(2), ty - U(7)]], gold ? PAL.yellow : PAL.silver);
    }
  }

  function drawBench(g, L, state) {
    const { W, H, benchY, U } = L;
    X.rect(g, -2, benchY - U(2), W + 4, U(8), PAL.wood);
    g.rect(0, benchY - U(2), W, 1).fill(PAL.tan);
    g.rect(0, benchY + U(5), W, 1).fill(PAL.brown);
    g.rect(0, benchY + U(6) + 1, W, H).fill(PAL.teal);
    g.rect(0, benchY + U(6) + 1, W, 1).fill(PAL.ink);
    const dw = U(52), dh = U(22);
    for (let x = U(8); x < W; x += dw + U(8)) {
      const y = benchY + U(13);
      if (y > H) break;
      X.rect(g, x, y, dw, dh, 0x2f8a85, { bevel: true });
      X.rect(g, x + dw / 2 - U(6), y + U(8), U(12), U(3), PAL.yellow, { bevel: true });
    }
    if (state && state.unlocked.decor.includes('tapete')) {
      const cx = L.cx, cy = benchY + U(2);
      X.ell(g, cx, cy, L.R * 1.45, U(5), PAL.pink, { flat: true });
      X.scanFill(g, { t: 'ell', x: cx, y: cy, rx: L.R * 1.45 - 1, ry: U(5) - 1 }, (x, y) => (((x >> 2) + (y >> 1)) % 3 === 0 ? PAL.cream : null));
    }
    const fx = L.mach.x + L.mach.w / 2 + U(6);
    beaker(g, fx, benchY - U(2), U(10), PAL.pink);
    beaker(g, fx + U(9), benchY - U(2), U(7), PAL.lime);
    if (state && state.unlocked.decor.includes('samambaia')) fern(g, R(L.rect.x + L.rect.w - U(14)), benchY - U(2), L);
  }
  function beaker(g, x, y, h, col) {
    const w = R(h * 0.7);
    const pts = [[x - w * 0.25, y - h], [x - w * 0.25, y - h * 0.6], [x - w / 2, y], [x + w / 2, y], [x + w * 0.25, y - h * 0.6], [x + w * 0.25, y - h]];
    X.poly(g, pts, 0xb8e6ee, { alpha: 0.35 });
    X.scanFill(g, { t: 'poly', pts }, (px, py) => (py > y - h * 0.45 ? X.num(col) : null));
  }
  function fern(g, x, y, L) {
    const U = L.U;
    X.poly(g, [[x - U(6), y - U(11)], [x + U(6), y - U(11)], [x + U(4), y], [x - U(4), y]], PAL.orange);
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.38; X.tube(g, [[x, y - U(11)], [x + Math.cos(a) * U(10) + (i - 3), y - U(11) + Math.sin(a) * U(10) - U(2)], [x + Math.cos(a) * U(20), y - U(11) + Math.sin(a) * U(20)]], Math.max(2, U(3)), 1, i % 2 ? PAL.green : 0x4fae6a, { flat: true }); }
  }

  function drawDecal(g, L, d) {
    const x = R(L.rect.x + d.x * L.rect.w), y = R(L.rect.y + d.y * L.rect.h), U = L.U, k = d.k || 1;
    switch (d.type) {
      case 'scorch': X.scanFill(g, { t: 'ell', x, y, rx: U(9) * k, ry: U(6) * k }, (px, py) => ((px + py) % 2 === 0 || Math.hypot((px - x) / k, (py - y) / k) < U(4) ? 0x1d1d24 : null), 0.55); break;
      case 'crack': for (let i = 0; i < 4; i++) { const a = i * 1.5 + d.x * 10; X.line(g, [[x, y], [x + Math.cos(a) * U(5), y + Math.sin(a) * U(5)], [x + Math.cos(a + 0.4) * U(10), y + Math.sin(a + 0.4) * U(9)]], 1, PAL.ink); } break;
      case 'vine': X.line(g, [[x, y], [x + U(6), y + U(10)], [x - U(3), y + U(20)], [x + U(4), y + U(30)]], Math.max(1, U(2)), PAL.green, { outline: true }); for (let i = 0; i < 3; i++) X.ell(g, x + (i % 2 ? 5 : -3), y + U(6) + i * U(9), U(3), U(2), PAL.lime, { flat: true }); break;
      case 'crystal': for (let i = 0; i < 3; i++) X.poly(g, [[x + (i - 1) * U(4) - U(2), y], [x + (i - 1) * U(4), y - U(8 + i * 3)], [x + (i - 1) * U(4) + U(2), y]], PAL.cyan); break;
      case 'sprinkles': for (let i = 0; i < 22; i++) g.rect(x + ((i * 37) % 30 - 15) * U(1), y + ((i * 13) % 5), U(2), 1).fill([PAL.pink, PAL.yellow, PAL.cyan, PAL.orange, PAL.white][i % 5]); break;
      case 'water': X.ell(g, x, y, U(24), U(3), PAL.sky, { flat: true, noOutline: true, alpha: 0.35 }); break;
      case 'goo': X.ell(g, x, y, U(10), U(3), d.c || PAL.lime, { flat: true, alpha: 0.7 }); break;
      case 'wrench': X.line(g, [[x - U(5), y + U(5)], [x + U(5), y - U(5)]], Math.max(2, U(2)), PAL.silver, { outline: true }); X.circ(g, x + U(6), y - U(6), U(3), PAL.silver, { flat: true }); break;
      case 'bone': X.rect(g, x - U(5), y - 1, U(10), 2, PAL.cream); X.circ(g, x - U(5), y, U(2), PAL.cream, { flat: true }); X.circ(g, x + U(5), y, U(2), PAL.cream, { flat: true }); break;
      default: break;
    }
  }

  function drawBackground(g, L, state) {
    drawWall(g, L);
    drawWindowFrame(g, L);
    const U = L.U;
    const deco = state ? state.unlocked.decor : [];
    const spots = [];
    const leftSpace = L.mach.x - L.mach.w / 2 - L.rect.x;
    if (!L.narrow && leftSpace > Math.max(40, U(26)) + 10) spots.push([R(L.rect.x + leftSpace / 2), R(L.rect.y + L.rect.h * 0.42)]);
    if (L.shelves.length > 1) {
      const sh = L.shelves[1], w = sh.x1 - sh.x0;
      if (w > U(56)) { spots.push([R(sh.x0 + w * 0.28), sh.y + U(26)]); spots.push([R(sh.x0 + w * 0.72), sh.y + U(26)]); }
      else if (w > U(26)) spots.push([R(sh.x0 + w / 2), sh.y + U(26)]);
    }
    ['perigo'].concat(deco.includes('cartaz') ? ['cartaz'] : []).forEach((k, i) => { if (spots[i]) drawPoster(g, spots[i][0], spots[i][1], Math.max(40, U(26)), Math.max(32, U(32)), k); });
    drawShelves(g, L, state);
    drawBench(g, L, state);
    if (state) for (const d of state.damage.decals) drawDecal(g, L, d);
    const lx = L.cx, ly = L.top - U(16);
    const cord0 = R(L.rect.y + U(14));
    if (ly > cord0) g.rect(lx, cord0, 1, ly - cord0).fill(PAL.ink);
    X.poly(g, [[lx - U(7), ly + U(5)], [lx - U(3), ly], [lx + U(3), ly], [lx + U(7), ly + U(5)]], PAL.yellow);
  }

  // ---------------------------------------------------------------- partes animadas da parede
  function windowTwinkle(g, gl, L, t) {
    const w = L.window;
    if (!w) return;
    for (let i = 0; i < 3; i++) {
      const a = i * 2.3 + 0.5, d = w.r * (0.3 + i * 0.2);
      if (Math.sin(t * 2 + i * 1.7) > 0.6) gl.rect(R(w.x + Math.cos(a) * d) - 1, R(w.y + Math.sin(a) * d), 3, 1).fill({ color: PAL.white, alpha: 0.9 });
    }
  }
  function lampLight(gl, L, dim) {
    const U = L.U, lx = L.cx, ly = L.top - U(11);
    const f = dim ? 0.3 : 1;
    const pts = [[lx - U(6), ly], [lx + U(6), ly], [lx + L.R * 0.95, L.floorY], [lx - L.R * 0.95, L.floorY]];
    X.scanFill(gl, { t: 'poly', pts }, (x, y) => (((x + y) & 1) === 0 ? 0xffcd75 : null), 0.1 * f);
    gl.circle(lx, ly + 1, U(4)).fill({ color: PAL.yellow, alpha: 0.5 * f });
  }

  // ---------------------------------------------------------------- Mutatrix
  function drawMachine(g, gl, L, a, t) {
    const U = L.U, m = L.mach;
    const shx = a.shake ? (Math.random() < 0.5 ? -1 : 1) * Math.max(1, R(a.shake * U(1))) : 0;
    const w = m.w, h = m.h, cx = m.x + shx;
    const x0 = R(cx - w / 2), y0 = m.bottom - h;
    const lidX = L.cx - R(L.R * 0.3), lidY = L.top - U(5);
    const pipe = [[cx + w * 0.22, y0 + U(10)], [cx + w * 0.3, y0 - U(10)], [lidX - U(10), lidY - U(22)], [lidX, lidY - U(2)]];
    X.tube(g, pipe, U(5), U(5), PAL.silver);
    if (a.synth || a.flow) {
      const k = (t * 1.6) % 1, i = Math.min(2, Math.floor(k * 3)), f = k * 3 - i;
      const p0 = pipe[i], p1 = pipe[i + 1];
      gl.circle(R(p0[0] + (p1[0] - p0[0]) * f), R(p0[1] + (p1[1] - p0[1]) * f), U(3)).fill({ color: X.num(a.flowColor || PAL.pink), alpha: 0.9 });
    }
    if (a.tentacle) {
      const pts = [];
      let ang = -0.4, x = x0 + 2, y = y0 + h * 0.4;
      for (let i = 0; i < 7; i++) { pts.push([x, y]); ang += Math.sin(t * 2 + i * 0.6) * 0.3 - 0.12; x -= Math.cos(ang) * U(6); y += Math.sin(ang) * U(6); }
      X.tube(g, pts, U(8), U(2), PAL.pink);
    }
    for (const fx of [0.18, 0.82]) X.rect(g, x0 + w * fx - U(5), m.bottom - U(4), U(10), U(4), PAL.dark);
    X.rrect(g, x0, y0 + h * 0.18, w, h * 0.8, U(5), PAL.blue, { bevel: true });
    g.rect(x0 + w - U(6), R(y0 + h * 0.2), U(4), R(h * 0.76)).fill(0x3350b0);
    // cúpula e centrífuga
    const dcx = cx, dcy = R(y0 + h * 0.2), drx = R(w * 0.42), dry = R(h * 0.17);
    const dome = [];
    for (let i = 0; i <= 12; i++) { const an = Math.PI + (i / 12) * Math.PI; dome.push([dcx + Math.cos(an) * drx, dcy + Math.sin(an) * dry]); }
    X.poly(g, dome, PAL.cyan, { alpha: 0.3, noOutline: true });
    const spin = t * (a.synth ? 14 : 1.2);
    for (let i = 0; i < 4; i++) {
      const an = spin + i / 4 * TAU;
      const vx = dcx + Math.cos(an) * w * 0.24, vy = dcy - dry * 0.45 + Math.sin(an) * U(2);
      const col = a.themes[i % Math.max(1, a.themes.length)] || '#94b0c2';
      X.rect(g, vx - U(2), vy - U(6), U(4), U(8), Math.sin(an) > 0 ? col : X.dark(col, 0.3));
    }
    X.line(g, dome, 1, PAL.ink);
    X.rect(g, dcx - drx * 0.55, dcy - dry * 0.75, 2, 1, PAL.white, { noOutline: true });
    X.rect(g, cx - w * 0.46, dcy - 1, w * 0.92, U(4), PAL.silver, { bevel: true });
    // placa
    const py = R(y0 + h * 0.27);
    X.rect(g, cx - w * 0.4, py, w * 0.8, 11, PAL.yellow, { bevel: true });
    X.text(g, w >= 56 ? 'MUTATRIX' : 'MTX', cx, py + 2, PAL.ink, { align: 'center' });
    // tela
    const sx0 = R(x0 + w * 0.1), sy0 = R(y0 + h * 0.37), sw = R(w * 0.8), sh = Math.max(17, R(h * 0.15));
    X.rect(g, sx0, sy0, sw, sh, 0x0f2a2a);
    for (let k = 0; k < 2; k++) for (let i = 1; i < sw - 1; i++) {
      const yy = R(sy0 + sh * 0.3 + Math.sin(i * 0.35 + t * (a.synth ? 8 : 2) + k * Math.PI) * sh * 0.18);
      g.rect(sx0 + i, yy, 1, 1).fill(k ? 0x38b764 : 0x73efb0);
    }
    const status = a.status || 'PRONTA';
    if (X.measure(status) <= sw - 3) X.text(g, status, sx0 + 2, sy0 + sh - 8, 0x73efb0);
    // fita genética
    const ty = R(y0 + h * 0.55), tw = R(w * 0.82), tx = R(cx - tw / 2), th = Math.max(5, U(8));
    X.rect(g, tx, ty, tw, th, PAL.dark);
    const cw = (tw - U(8)) / 6;
    for (let i = 0; i < 6; i++) {
      const bx = R(tx + U(4) + i * cw);
      const sl = a.design && a.design.slots[i];
      g.rect(bx + 1, ty + 2, Math.max(1, R(cw) - 2), th - 4).fill(i >= a.slots ? 0x29304a : sl ? X.num(MX.Data.THEME[sl.theme].color) : 0x94b0c2);
    }
    // mostradores
    const dy = R(y0 + h * 0.72);
    const dial = (x, val) => {
      X.circ(g, x, dy, U(6), PAL.cream, { noHi: true });
      const an = Math.PI * 0.75 + (val / 100) * Math.PI * 1.5 + (a.synth ? Math.sin(t * 30) * 0.1 : 0);
      X.line(g, [[x, dy], [x + Math.cos(an) * U(5), dy + Math.sin(an) * U(5)]], 1, PAL.red);
    };
    dial(R(cx - w * 0.22), a.design ? a.design.virulence : 30);
    dial(R(cx + w * 0.22), a.design ? a.design.chaos : 10);
    const cols = [PAL.orange, PAL.yellow, PAL.pink, PAL.lime, PAL.cyan];
    for (let i = 0; i < 5; i++) {
      const on = a.synth ? Math.sin(t * 12 + i * 1.3) > 0 : Math.sin(t * 1.5 + i * 2.1) > 0.5;
      const lx = R(cx - w * 0.3 + i * w * 0.15), ly = R(y0 + h * 0.86);
      X.circ(g, lx, ly, Math.max(1.5, U(2)), on ? cols[i] : PAL.dark, { flat: true });
      if (on) gl.circle(lx, ly, U(4)).fill({ color: cols[i], alpha: 0.35 });
    }
    for (let i = 0; i < 3; i++) {
      const tx2 = x0 + w + U(2) + i * U(4), tTop = R(y0 + h * 0.36 + i * U(3)), tBot = m.bottom - U(8);
      const col = a.themes[i] || '#9fe2bf';
      const lvl = R(tTop + (tBot - tTop) * (0.35 + (Math.sin(t * (a.synth ? 6 : 1) + i) > 0 ? 0.05 : 0)));
      X.rect(g, tx2, tTop, Math.max(2, U(3)), tBot - tTop, PAL.cyan, { alpha: 0.3 });
      g.rect(tx2, lvl, Math.max(2, U(3)), tBot - lvl).fill(X.num(col));
      for (let b = 0; b < 2; b++) { const k = ((t * (a.synth ? 1.4 : 0.35) + b * 0.5 + i * 0.2) % 1); X.px(g, tx2 + 1, tBot - k * (tBot - lvl), PAL.white, 1); }
    }
    const trayY = m.bottom - U(9);
    X.rect(g, cx - U(10), trayY, U(20), U(3), PAL.dark);
    return { trayX: cx, trayY };
  }

  // ---------------------------------------------------------------- câmara
  function arcPts(cx, cy, rx, ry, a0, a1, n) { const p = []; for (let i = 0; i <= n; i++) { const an = a0 + (i / n) * (a1 - a0); p.push([cx + Math.cos(an) * rx, cy + Math.sin(an) * ry]); } return p; }
  function chamberBack(g, gl, L, t, a) {
    const { cx, R: Rc, ry, floorY, top, baseH } = L;
    const by = floorY + R(baseH * 0.3);
    const band = arcPts(cx, by, Rc * 1.12, ry * 1.12, 0, Math.PI, 16).concat(arcPts(cx, by - baseH * 0.6, Rc * 1.12, ry * 1.12, Math.PI, 0, 16));
    X.poly(g, band, PAL.slate);
    X.scanFill(g, { t: 'poly', pts: band }, (x, y) => ((((x - y) >> 2) & 1) ? PAL.yellow : PAL.ink));
    X.ell(g, cx, by - R(baseH * 0.6), Rc * 1.12, ry * 1.12, PAL.silver, { flat: true });
    X.ell(g, cx, floorY, Rc * 0.88, ry * 0.85, 0xc3ccd3, { noHi: true });
    for (let i = 0; i < 10; i++) { const an = (a.yaw || 0) + i / 10 * TAU; X.px(g, cx + Math.sin(an) * Rc * 0.74, floorY + Math.cos(an) * ry * 0.72, PAL.slate, 1); }
    const back = arcPts(cx, top, Rc, ry, Math.PI, TAU, 16).concat(arcPts(cx, floorY, Rc, ry, TAU, Math.PI, 16));
    X.poly(g, back, PAL.cyan, { noOutline: true, alpha: 0.1 });
    X.line(g, arcPts(cx, top, Rc, ry, Math.PI, TAU, 16), 1, 0x94b0c2, { alpha: 0.6 });
    X.line(g, arcPts(cx, floorY, Rc, ry, Math.PI, TAU, 16), 1, 0x94b0c2, { alpha: 0.6 });
  }

  function chamberFront(g, gl, L, t, a) {
    const { cx, R: Rc, ry, floorY, top, U } = L;
    g.rect(cx - Rc - 1, top, 2, floorY - top).fill(PAL.ink);
    g.rect(cx + Rc - 1, top, 2, floorY - top).fill(PAL.ink);
    X.line(g, arcPts(cx, floorY, Rc, ry, 0, Math.PI, 16), 1, PAL.ink);
    g.rect(R(cx - Rc * 0.78), top + ry, 2, R((floorY - top) * 0.72)).fill({ color: PAL.white, alpha: 0.45 });
    g.rect(R(cx - Rc * 0.66), top + ry + U(4), 1, R((floorY - top) * 0.5)).fill({ color: PAL.white, alpha: 0.35 });
    g.rect(R(cx + Rc * 0.72), top + ry + U(3), 1, R((floorY - top) * 0.55)).fill({ color: PAL.white, alpha: 0.3 });
    if (a.glass) for (const gd of a.glass) glassDecal(g, L, gd);
    const lid = arcPts(cx, top, Rc * 1.06, ry * 1.06, 0, Math.PI, 16).concat(arcPts(cx, top - U(6), Rc * 1.06, ry * 1.06, Math.PI, 0, 16));
    X.poly(g, lid, PAL.slate);
    X.ell(g, cx, top - U(6), Rc * 1.06, ry * 1.06, PAL.silver, { flat: true });
    X.ell(g, cx - R(Rc * 0.3), top - U(7), U(6), Math.max(1, U(2)), PAL.dark, { flat: true });
    const lx = R(cx + Rc * 0.55), ly = top - U(10);
    const alarm = a.alarm && Math.sin(t * 10) > 0;
    X.rect(g, lx - U(3), ly, U(6), U(4), alarm ? 0xff4d4d : a.warn ? PAL.yellow : 0x7f2a35, { bevel: true });
    if (alarm) { gl.circle(lx, ly + 2, U(14)).fill({ color: 0xff4d4d, alpha: 0.18 }); gl.circle(lx, ly + 2, U(7)).fill({ color: 0xff4d4d, alpha: 0.3 }); }
    const label = a.label || 'CÂMARA 01';
    const lw2 = X.measure(label) + 6;
    const ly2 = floorY + R(L.baseH * 0.25);
    X.rect(g, cx - lw2 / 2, ly2, lw2, 11, PAL.cream, { bevel: true });
    X.text(g, label, cx, ly2 + 2, PAL.ink, { align: 'center' });
  }

  function glassDecal(g, L, gd) {
    const x = R(L.cx + gd.x * L.R), y = R(L.top + gd.y * (L.floorY - L.top)), U = L.U;
    if (gd.type === 'crack') {
      for (let i = 0; i < 5; i++) { const an = i * 1.25 + gd.r; X.line(g, [[x, y], [x + Math.cos(an) * U(4), y + Math.sin(an) * U(4)], [x + Math.cos(an + 0.3) * U(8), y + Math.sin(an + 0.3) * U(7)]], 1, PAL.white, { alpha: 0.7 }); }
    } else if (gd.type === 'scorch') {
      X.scanFill(g, { t: 'ell', x, y, rx: U(5), ry: U(4) }, (px, py) => ((px + py) % 2 === 0 ? 0x1d1d24 : null), 0.55);
    } else {
      X.ell(g, x, y, U(4), U(3), gd.c || PAL.lime, { flat: true, alpha: 0.75 });
      g.rect(x - 1, y, 2, U(5)).fill({ color: X.num(gd.c || PAL.lime), alpha: 0.75 });
    }
  }

  // ---------------------------------------------------------------- seringa
  function syringe(g, gl, x, y, ang, L, col, amount, glow, t) {
    const U = L.U;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const T = (px, py) => [x + px * ca - py * sa, y + px * sa + py * ca];
    const quad = (x0, y0, x1, y1) => [T(x0, y0), T(x1, y0), T(x1, y1), T(x0, y1)];
    const len = U(36), w = Math.max(5, U(7));
    if (glow) gl.circle(R(x), R(y), U(22)).fill({ color: X.num(col || PAL.pink), alpha: Math.sin(t * 5) > 0 ? 0.22 : 0.14 });
    X.line(g, [T(len * 0.5, 0), T(len * 0.84, 0)], 1, PAL.silver, { outline: true });
    X.poly(g, quad(-len * 0.38, -w / 2, len * 0.5, w / 2), PAL.cyan, { alpha: 0.4 });
    if (amount > 0) X.poly(g, quad(len * 0.5 - len * 0.86 * amount, -w / 2 + 1, len * 0.48, w / 2 - 1), col || PAL.pink, { noOutline: true });
    for (let i = 1; i < 6; i++) X.line(g, [T(-len * 0.38 + i * len * 0.14, -w / 2), T(-len * 0.38 + i * len * 0.14, -w / 2 + 2)], 1, PAL.ink);
    X.poly(g, quad(len * 0.48, -w * 0.3, len * 0.56, w * 0.3), PAL.silver);
    X.poly(g, quad(-len * 0.62, -1, -len * 0.38, 1), PAL.cream);
    X.poly(g, quad(-len * 0.68, -w * 0.7, -len * 0.62, w * 0.7), PAL.orange);
    X.poly(g, quad(-len * 0.42, -w * 0.85, -len * 0.38, w * 0.85), PAL.cream);
  }

  // ---------------------------------------------------------------- decoração animada
  function decorDynamic(g, gl, L, state, t, playing) {
    const deco = state ? state.unlocked.decor : [];
    const U = L.U;
    if (deco.includes('luminaria')) {
      const x = L.mach.x - L.mach.w / 2 - U(8), y = L.benchY - U(2);
      const h = U(22), w = U(9);
      X.poly(g, [[x - w * 0.6, y], [x + w * 0.6, y], [x + w * 0.35, y - U(4)], [x - w * 0.35, y - U(4)]], PAL.dark);
      X.poly(g, [[x - w * 0.35, y - U(4)], [x + w * 0.35, y - U(4)], [x + w * 0.2, y - h], [x - w * 0.2, y - h]], PAL.yellow);
      for (let i = 0; i < 2; i++) { const k = (Math.sin(t * 0.5 + i * 2.1) + 1) / 2; X.circ(g, x, y - U(6) - k * (h - U(10)), Math.max(1.5, U(2)), PAL.orange, { flat: true, noOutline: true }); }
      gl.circle(R(x), R(y - h / 2), U(10)).fill({ color: PAL.yellow, alpha: 0.12 });
      X.poly(g, [[x - w * 0.2, y - h], [x + w * 0.2, y - h], [x + w * 0.12, y - h - U(3)], [x - w * 0.12, y - h - U(3)]], PAL.dark);
    }
    if (deco.includes('relogio')) {
      const cx = L.window ? L.window.x + L.window.r + U(16) : L.cx - L.R - U(14), cy = R(L.rect.y + U(30));
      X.circ(g, cx, cy, U(8), PAL.cream, { noHi: true });
      const d = new Date();
      const hh = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * TAU, mm = d.getMinutes() / 60 * TAU;
      X.line(g, [[cx, cy], [cx + Math.sin(hh) * U(4), cy - Math.cos(hh) * U(4)]], 1, PAL.ink);
      X.line(g, [[cx, cy], [cx + Math.sin(mm) * U(6), cy - Math.cos(mm) * U(6)]], 1, PAL.red);
    }
    if (deco.includes('radio')) {
      const sh = L.shelves[0];
      const x = sh ? sh.x1 - U(10) : L.mach.x + L.mach.w / 2 + U(20), y = sh ? sh.y : L.benchY - U(2);
      X.rect(g, x - U(10), y - U(10), U(20), U(10), 0x4fb8a8, { bevel: true });
      X.circ(g, x - U(4), y - U(5), U(3), PAL.cream, { flat: true });
      X.rect(g, x + U(1), y - U(8), U(7), U(3), PAL.cream, { noOutline: true });
      X.px(g, x + U(1) + ((t * 3) % 1) * U(6) * (playing ? 1 : 0), y - U(8), PAL.red, 1);
    }
  }

  MX.Lab = { layout, drawBackground, windowTwinkle, lampLight, drawMachine, chamberBack, chamberFront, syringe, decorDynamic, jarSlots, drawDecal, glassDecal };
})(typeof window !== 'undefined' ? window : globalThis);
