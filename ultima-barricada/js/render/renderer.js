// Renderer: reads the simulation state and draws the isometric world in low-resolution pixel
// art (integer upscaling). Terrain comes from cached chunks; objects are depth-sorted, with big
// buildings sliced into half-tile columns so units walk correctly behind and in front of them.
// Then fog of war, night lighting with light sources, weather and effects.
(function (UB) {
  'use strict';
  const { F, FEATURE, BUILDINGS, POIS, ZOMBIES, T } = UB.DEF;
  const R = {};
  let cv, ctx, W = 320, H = 200, scale = 2, dpr = 1;
  const cam = { x: 0, y: 0 };
  let offX = 0, offY = 0;
  let shake = 0, quality = 'high', shakeOn = true;
  const sprites = new Map();
  const chunks = new Map();
  let fogC, fogX, fogImg, fogData, fogFrame = 0, lightC, lightX, vigC;
  const FX = { tracers: [], parts: [], decals: [], corpses: [], floats: [], rings: [], lights: [], booms: [], flares: [] };
  let ambient = [];
  let rain = [];
  let lastS = null;
  const win = { tx0: 0, tx1: 0, ty0: 0, ty1: 0 };

  // ---- setup --------------------------------------------------------------------------------------
  R.init = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d', { alpha: false });
    fogC = UB.Vox.makeCanvas(128, 128);
    fogX = fogC.getContext('2d');
    UB.Tiles.build();
    R.resize();
  };
  R.defaultScale = function () {
    const dw = window.innerWidth * dpr, dh = window.innerHeight * dpr;
    return Math.max(1, Math.min(6, Math.round(Math.sqrt(dw * dh) / 560)));
  };
  R.resize = function () {
    dpr = window.devicePixelRatio || 1;
    if (!R._scaleSet) scale = R.defaultScale();
    const cw = window.innerWidth, ch = window.innerHeight;
    W = Math.ceil((cw * dpr) / scale);
    H = Math.ceil((ch * dpr) / scale);
    cv.width = W; cv.height = H;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    ctx.imageSmoothingEnabled = false;
    lightC = UB.Vox.makeCanvas(Math.ceil(W / 2), Math.ceil(H / 2));
    lightX = lightC.getContext('2d');
    vigC = UB.Vox.makeCanvas(W, H);
    const vx = vigC.getContext('2d');
    const g = vx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    vx.fillStyle = g; vx.fillRect(0, 0, W, H);
    ambient = [];
    for (let i = 0; i < 40; i++) ambient.push({ x: Math.random() * W, y: Math.random() * H, v: 0.2 + Math.random() * 0.5, p: Math.random() * 6 });
  };
  R.setScale = function (s, px, py) {
    s = Math.max(1, Math.min(6, Math.round(s)));
    if (s === scale) return;
    // Keep the world point under (px, py) css pixels fixed.
    const before = px !== undefined ? R.s2w((px * dpr) / scale, (py * dpr) / scale) : null;
    scale = s; R._scaleSet = true;
    R.resize();
    if (before) {
      const after = R.s2w((px * dpr) / scale, (py * dpr) / scale);
      cam.x += (before.x - after.x - (before.y - after.y)) * 16;
      cam.y += (before.x - after.x + (before.y - after.y)) * 8;
    }
  };
  R.getScale = () => scale;
  R.setQuality = (q) => { quality = q; };
  R.setShake = (on) => { shakeOn = on; };
  R.size = () => ({ W, H, scale, dpr });
  R.cam = cam;
  R.centerOn = function (x, y) { cam.x = (x - y) * 16; cam.y = (x + y) * 8; };
  R.camTile = function () { return R.s2w(W / 2, H / 2); };
  R.pan = function (dxCss, dyCss) { cam.x -= (dxCss * dpr) / scale; cam.y -= (dyCss * dpr) / scale; };
  R.clampCam = function (S) {
    const N = S.map.w;
    const c = R.s2w(W / 2, H / 2);
    const x = Math.max(0, Math.min(N, c.x)), y = Math.max(0, Math.min(N, c.y));
    if (x !== c.x || y !== c.y) R.centerOn(x, y);
  };
  // Canvas (art) pixel <-> world tile coordinates on the ground plane.
  R.w2s = (x, y, z) => ({ x: Math.round((x - y) * 16 + offX), y: Math.round((x + y) * 8 + offY - (z || 0)) });
  R.s2w = function (px, py) {
    const wx = px - offX, wy = py - offY;
    return { x: (wx / 16 + wy / 8) / 2, y: (wy / 8 - wx / 16) / 2 };
  };
  R.cssToArt = (cx, cy) => ({ x: (cx * dpr) / scale, y: (cy * dpr) / scale });

  // ---- sprites ----------------------------------------------------------------------------------------
  function sprite(key, build, opts) {
    let s = sprites.get(key);
    if (s) return s;
    const m = build();
    s = UB.Vox.bake(m, opts);
    if (opts && opts.shadow) s.shadow = UB.Vox.bakeShadow(m, opts.shadowLen);
    sprites.set(key, s);
    return s;
  }
  function dimOf(s) { return s.dim || (s.dim = UB.Vox.dim(s, 0.5)); }
  R.sprite = sprite;
  R.clearCache = () => { sprites.clear(); chunks.clear(); };

  function unitSprite(S, u) {
    let frame = 0;
    const t = S.time;
    if (t - u.shootT < 0.12) frame = 3;
    else if (u.workT && t - u.workT < 0.25) frame = (Math.floor(t * 4) % 2) ? 4 : 0;
    else if (u.moving) frame = 1 + (Math.floor(t * 7 + u.id) % 2);
    const v = u.id % 5;
    return sprite(`s:${u.role}:${u.weapon === 'bat' || (u.ammo <= 0 && u.weapon !== 'bat') ? 'bat' : u.weapon}:${frame}:${u.facing}:${v}`, () => UB.Models.survivor(u.role, u.ammo <= 0 ? 'bat' : u.weapon, frame, v).rotate(u.facing));
  }
  function zombieSprite(S, z) {
    let frame = 0;
    if (S.time - z.attackT < 0.35) frame = 3;
    else if (z.moving) frame = 1 + (Math.floor(S.time * (z.type === 'runner' ? 8 : 3.5) + z.id) % 2);
    const v = z.id % 3;
    return sprite(`z:${z.type}:${v}:${frame}:${z.facing}`, () => UB.Models.zombie(z.type, v, frame).rotate(z.facing));
  }
  function featureSprite(f, tx, ty) {
    const h = Math.floor(UB.hash3(tx, ty, 5) * 1000);
    switch (f) {
      case F.TREE: return sprite(`f:tree:${h % 6}`, () => UB.Models.tree('oak', h % 6), { shadow: true, noise: 0.1 });
      case F.PINE: return sprite(`f:pine:${h % 3}`, () => UB.Models.tree('pine', h % 3), { shadow: true });
      case F.DEADTREE: return sprite(`f:dead:${h % 2}`, () => UB.Models.tree('dead', h % 2), { shadow: true });
      case F.BUSH: return sprite(`f:bush:${h % 4}`, () => UB.Models.bush(h % 4), { shadow: true, shadowLen: 0.4 });
      case F.CAR: return sprite(`f:car:${h % 12}`, () => UB.Models.car(h % 6, (h >> 3) % 2), { shadow: true });
      case F.DEBRIS: return sprite(`f:debris:${h % 5}`, () => UB.Models.debris(h % 5));
      case F.CRATE: return null;
      case F.FENCE: return sprite(`f:fence:${h % 2}`, () => UB.Models.fence(h % 2, 0), { shadow: true });
      case F.ROCK: return sprite(`f:rock:${h % 3}`, () => UB.Models.rock(h % 3), { shadow: true });
      case F.BARRIER: return sprite(`f:barrier`, () => UB.Models.barrier(0), { shadow: true });
      case F.CONTAINER: return sprite(`f:cont:${h % 4}`, () => UB.Models.container(h % 4), { shadow: true });
      default: return null;
    }
  }
  function crateSprite(kind) { return sprite(`f:crate:${kind}`, () => UB.Models.crate(kind), { shadow: true, shadowLen: 0.4 }); }
  function buildingSprite(S, b) {
    const L = b.level;
    if (b.built < 1) {
      const stage = b.built < 0.34 ? 0.2 : b.built < 0.67 ? 0.5 : 0.8;
      return sprite(`b:${b.type}:${L}:bp${stage}`, () => UB.Models.underConstruction(UB.Models.structure(b.type, L, {}), stage), { shadow: true });
    }
    const dmg = b.hp < b.maxHp * 0.5 ? (b.hp < b.maxHp * 0.25 ? 2 : 1) : 0;
    let extra = '';
    const o = {};
    if (b.type === 'gate') { o.open = !!b.open; extra = o.open ? 'o' : 'c'; }
    if (b.type === 'turret') { o.dir = b.dir || 0; extra = String(o.dir); }
    if (b.type === 'spotlight' || b.type === 'radio') { o.on = !!b.powered; extra = o.on ? '1' : '0'; }
    return sprite(`b:${b.type}:${L}:${dmg}:${extra}`, () => {
      const m = UB.Models.structure(b.type, L, o);
      return dmg ? UB.Models.damaged(m, dmg === 2 ? 0.3 : 0.15, b.type.length) : m;
    }, { shadow: true });
  }
  function poiSprite(p) {
    const st = p.exploded ? 'x' : 'n';
    return sprite(`p:${p.id}:${st}`, () => UB.Models.poi(p), { shadow: p.type !== 'nest', noise: 0.06 });
  }

  // Columns of a multi-tile footprint with their sort depth (cached per entity).
  function columnsOf(e) {
    if (e._cols && e._colsKey === e.tx * 1000 + e.ty) return e._cols;
    const cols = new Map();
    for (let ty = e.ty; ty < e.ty + e.h; ty++) for (let tx = e.tx; tx < e.tx + e.w; tx++) {
      for (const c of [tx - ty - 1, tx - ty]) {
        const d = tx + ty + 1;
        if (!cols.has(c) || cols.get(c) < d) cols.set(c, d);
      }
    }
    e._cols = cols; e._colsKey = e.tx * 1000 + e.ty;
    return cols;
  }

  // ---- terrain chunks -----------------------------------------------------------------------------------
  function chunk(S, cx, cy) {
    const key = cy * 64 + cx;
    let ch = chunks.get(key);
    if (!ch) {
      ch = UB.Tiles.drawChunk(S, cx, cy);
      chunks.set(key, ch);
      if (chunks.size > (quality === 'low' ? 20 : 40)) {
        let oldest = null, ot = Infinity;
        for (const [k, v] of chunks) if (v.used < ot && k !== key) { ot = v.used; oldest = k; }
        if (oldest !== null) chunks.delete(oldest);
      }
    }
    ch.used = performance.now();
    return ch;
  }
  R.invalidateTerrain = function (x, y, w, h) {
    const CH = UB.Tiles.CH;
    for (let cy = Math.floor(y / CH); cy <= Math.floor((y + h) / CH); cy++)
      for (let cx = Math.floor(x / CH); cx <= Math.floor((x + w) / CH); cx++) chunks.delete(cy * 64 + cx);
  };
  R.resetWorld = function () { chunks.clear(); for (const k of Object.keys(FX)) FX[k].length = 0; lastS = null; };

  // ---- effects from simulation events ----------------------------------------------------------------------
  function part(x, y, z, vx, vy, vz, life, color, size) {
    if (FX.parts.length > (quality === 'low' ? 250 : 700)) return;
    FX.parts.push({ x, y, z, vx, vy, vz, life, max: life, color, size: size || 1 });
  }
  function blood(x, y, n, color) {
    for (let i = 0; i < n; i++) part(x, y, 8 + Math.random() * 8, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 2.5, 20 + Math.random() * 25, 0.5 + Math.random() * 0.4, color || '#8a1414', 1);
  }
  function decal(x, y, kind, size) {
    FX.decals.push({ x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, kind, size: size || 1, life: 60, seed: Math.random() * 1000 });
    if (FX.decals.length > 220) FX.decals.shift();
  }
  R.ring = function (x, y, color) { FX.rings.push({ x, y, t: 0, color: color || '#7dff9a' }); };
  R.float = function (x, y, text, color) { FX.floats.push({ x, y, z: 20, text, color: color || '#e8e0a0', t: 0 }); };
  R.consume = function (S, onEvent) {
    if (S !== lastS) { lastS = S; }
    for (const e of S.fx) {
      switch (e.t) {
        case 'shot': {
          FX.tracers.push({ x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, z0: (e.z || 0.55) * 16, life: 0.07, w: e.w, hit: e.hit });
          FX.lights.push({ x: e.x0, y: e.y0, r: 2.2, life: 0.06, max: 0.06, c: '255,200,120' });
          if (e.hit) {
            blood(e.x1, e.y1, quality === 'low' ? 2 : 4);
            if (Math.random() < 0.25) decal(e.x1, e.y1, 'blood', 0.6);
          } else part(e.x1, e.y1, 2, 0, 0, 10, 0.25, '#b8b0a0', 1);
          break;
        }
        case 'melee': blood(e.x, e.y, 3); break;
        case 'zdie': {
          FX.corpses.push({ x: e.x, y: e.y, kind: e.type, f: e.f || 0, v: Math.floor(Math.random() * 3), life: 40 });
          if (FX.corpses.length > 160) FX.corpses.shift();
          decal(e.x, e.y, 'blood', ZOMBIES[e.type] && ZOMBIES[e.type].boss ? 2.5 : 1.2);
          blood(e.x, e.y, 6);
          break;
        }
        case 'udie':
          FX.corpses.push({ x: e.x, y: e.y, kind: 'unit', f: e.f || 0, v: 1, life: 90 });
          decal(e.x, e.y, 'blood', 1.4);
          blood(e.x, e.y, 10);
          break;
        case 'explode': {
          FX.booms.push({ x: e.x, y: e.y, r: e.r || 2, t: 0 });
          FX.lights.push({ x: e.x, y: e.y, r: (e.r || 2) * 2.5, life: 0.5, max: 0.5, c: '255,160,60' });
          decal(e.x, e.y, 'scorch', (e.r || 2) * 0.8);
          for (let i = 0; i < (quality === 'low' ? 12 : 30); i++) {
            const a = Math.random() * Math.PI * 2, sp = Math.random() * 4 * (e.r || 2);
            part(e.x, e.y, 6, Math.cos(a) * sp, Math.sin(a) * sp, 30 + Math.random() * 60, 0.6 + Math.random() * 0.6, Math.random() < 0.5 ? '#ffb040' : e.gore ? '#7a2a4a' : '#4a4440', 2);
          }
          shake = Math.max(shake, 4 + (e.r || 2));
          break;
        }
        case 'collapse':
          for (let i = 0; i < 24; i++) part(e.x + (Math.random() - 0.5) * e.w, e.y + (Math.random() - 0.5) * e.w, 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 10 + Math.random() * 20, 1 + Math.random(), '#8a8378', 2);
          decal(e.x, e.y, 'scorch', e.w * 0.6);
          shake = Math.max(shake, 3);
          break;
        case 'built':
          for (let i = 0; i < 10; i++) part(e.x + (Math.random() - 0.5), e.y + (Math.random() - 0.5), 2, (Math.random() - 0.5), (Math.random() - 0.5), 15, 0.7, '#e8d8a0', 1);
          break;
        case 'fell':
          for (let i = 0; i < 12; i++) part(e.x, e.y, 14 + Math.random() * 10, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 5, 0.9, e.f === F.CAR || e.f === F.DEBRIS ? '#7a7068' : '#4f8a42', 1);
          break;
        case 'loot': case 'deposit': case 'recruit':
          for (let i = 0; i < 8; i++) part(e.x, e.y, 10, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 25, 0.7, e.t === 'recruit' ? '#7dff9a' : '#ffe080', 1);
          break;
        case 'acid':
          for (let i = 0; i < 8; i++) part(e.x, e.y, 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 20, 0.5, '#9aff4a', 1);
          decal(e.x, e.y, 'acid', 0.7);
          break;
        case 'spit': part(e.x, e.y, 22, 0, 0, 10, 0.3, '#9aff4a', 2); break;
        case 'scream': FX.rings.push({ x: e.x, y: e.y, t: 0, color: '#ff5a5a', big: true }); break;
        case 'radio': FX.rings.push({ x: e.x, y: e.y, t: 0, color: '#ffd166', big: true }); break;
        case 'bang': part(e.x, e.y, 10, (Math.random() - 0.5), (Math.random() - 0.5), 15, 0.4, '#a89a80', 1); break;
        case 'drop': FX.flares.push({ x: e.x, y: e.y, life: 90 }); break;
        case 'terrain': R.invalidateTerrain(e.x, e.y, e.w, e.h); break;
        default: break;
      }
      if (onEvent) onEvent(e);
    }
    S.fx.length = 0;
  };

  function updateFx(dt) {
    for (const p of FX.parts) {
      p.life -= dt;
      p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06;
      p.vz -= 120 * dt; p.z += p.vz * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; }
    }
    FX.parts = FX.parts.filter((p) => p.life > 0);
    for (const t of FX.tracers) t.life -= dt;
    FX.tracers = FX.tracers.filter((t) => t.life > 0);
    for (const l of FX.lights) l.life -= dt;
    FX.lights = FX.lights.filter((l) => l.life > 0);
    for (const d of FX.decals) d.life -= dt;
    FX.decals = FX.decals.filter((d) => d.life > 0);
    for (const c of FX.corpses) c.life -= dt;
    FX.corpses = FX.corpses.filter((c) => c.life > 0);
    for (const f of FX.floats) { f.t += dt; f.z += dt * 14; }
    FX.floats = FX.floats.filter((f) => f.t < 1.6);
    for (const r of FX.rings) r.t += dt;
    FX.rings = FX.rings.filter((r) => r.t < (r.big ? 1.2 : 0.6));
    for (const b of FX.booms) b.t += dt;
    FX.booms = FX.booms.filter((b) => b.t < 0.6);
    for (const f of FX.flares) f.life -= dt;
    FX.flares = FX.flares.filter((f) => f.life > 0);
    shake = Math.max(0, shake - dt * 18);
  }

  // ---- drawing ------------------------------------------------------------------------------------------------
  const items = [];
  let nItems = 0;
  function push(d, kind, a, b, c, e) {
    let it = items[nItems];
    if (!it) { it = {}; items[nItems] = it; }
    it.d = d; it.kind = kind; it.a = a; it.b = b; it.c = c; it.e = e;
    nItems++;
  }
  const byDepth = (p, q) => p.d - q.d;

  function drawSprite(s, x, y, alpha) {
    if (alpha !== undefined && alpha < 1) { ctx.globalAlpha = alpha; ctx.drawImage(s.c, Math.round(x - s.ox), Math.round(y - s.oy)); ctx.globalAlpha = 1; }
    else ctx.drawImage(s.c, Math.round(x - s.ox), Math.round(y - s.oy));
  }
  function ellipse(x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function diamond(tx, ty, w, h, fill, stroke) {
    const a = R.w2s(tx, ty), b = R.w2s(tx + w, ty), c = R.w2s(tx + w, ty + h), d = R.w2s(tx, ty + h);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function bar(x, y, w, frac, color, bg) {
    x = Math.round(x - w / 2); y = Math.round(y);
    ctx.fillStyle = bg || 'rgba(10,8,12,0.85)';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(1, Math.round(w * Math.max(0, Math.min(1, frac)))), 2);
  }
  function hpColor(f) { return f > 0.6 ? '#6fdc6f' : f > 0.3 ? '#e8c84a' : '#e8503a'; }

  // Tiny pixel icons for POI markers (5x5 masks).
  const PIX = {
    hospital: ['..#..', '..#..', '#####', '..#..', '..#..'], pharmacy: ['..#..', '.###.', '#####', '.###.', '..#..'],
    police: ['#####', '#.#.#', '#####', '.#.#.', '.###.'], gas: ['###..', '#.#.#', '###.#', '###.#', '###..'],
    market: ['#####', '#...#', '#####', '.#.#.', '.....'], warehouse: ['..#..', '.###.', '#####', '#.#.#', '#####'],
    hardware: ['###..', '.#...', '.#...', '.####', '....#'], factory: ['#.#..', '#.#..', '#####', '#####', '#####'],
    farmhouse: ['..#..', '.###.', '#####', '#.#.#', '#####'], camp: ['..#..', '.#.#.', '#...#', '#####', '.....'],
    house: ['..#..', '.###.', '#####', '#.#.#', '#####'], ruin: ['#..#.', '#.##.', '####.', '#####', '#####'],
    nest: ['.#.#.', '#####', '#.#.#', '#####', '.#.#.'],
  };
  const POI_COLOR = { hospital: '#ff6a6a', pharmacy: '#6aff9a', police: '#6aa0ff', gas: '#ffb04a', market: '#ffd166', warehouse: '#c8b89a', hardware: '#ff9a4a', factory: '#b8a090', farmhouse: '#c8e07a', camp: '#7dff9a', house: '#d8d0c0', ruin: '#9a948c', nest: '#d84aa0' };
  function pixIcon(name, x, y, color) {
    const p = PIX[name];
    if (!p) return;
    ctx.fillStyle = 'rgba(10,8,12,0.85)';
    ctx.fillRect(x - 4, y - 4, 9, 9);
    ctx.fillStyle = color;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (p[r][c] === '#') ctx.fillRect(x - 2 + c, y - 2 + r, 1, 1);
  }
  R.pixIcon = (c2, name, x, y, color, sc) => {
    const p = PIX[name];
    if (!p) return;
    c2.fillStyle = color;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (p[r][c] === '#') c2.fillRect(x + c * sc, y + r * sc, sc, sc);
  };
  R.POI_COLOR = POI_COLOR;

  // Pixel text with a dark outline (small, for floating numbers).
  function text(str, x, y, color, align) {
    ctx.font = '8px monospace';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(10,8,12,0.9)';
    ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  R.frame = function (S, alpha, dt, ui) {
    ui = ui || {};
    updateFx(dt);
    const N = S.map.w;
    const sh = shakeOn && shake > 0 ? shake : 0;
    offX = Math.round(W / 2 - cam.x + (sh ? (Math.random() - 0.5) * sh : 0));
    offY = Math.round(H / 2 - cam.y + (sh ? (Math.random() - 0.5) * sh : 0));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, W, H);
    const daylight = UB.Waves.daylight(S);
    const time = performance.now() / 1000;

    // Visible tile window (generous below for tall sprites).
    const corners = [R.s2w(-64, -48), R.s2w(W + 64, -48), R.s2w(-64, H + 220), R.s2w(W + 64, H + 220)];
    const tx0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x)))), tx1 = Math.min(N - 1, Math.ceil(Math.max(...corners.map((c) => c.x))));
    const ty0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y)))), ty1 = Math.min(N - 1, Math.ceil(Math.max(...corners.map((c) => c.y))));
    const onScreen = (sx, sy, pad) => sx > -pad && sx < W + pad && sy > -pad && sy < H + pad * 3;
    win.tx0 = tx0; win.tx1 = tx1; win.ty0 = ty0; win.ty1 = ty1;

    // Terrain chunks.
    const CH = UB.Tiles.CH;
    for (let cy = Math.floor(ty0 / CH); cy <= Math.floor(ty1 / CH); cy++) for (let cx = Math.floor(tx0 / CH); cx <= Math.floor(tx1 / CH); cx++) {
      const ox = (cx * CH - (cy * CH + CH - 1)) * 16 - 16 + offX, oy = (cx * CH + cy * CH) * 8 + offY;
      if (ox > W || oy > H || ox + 512 < 0 || oy + 256 < 0) continue;
      const ch = chunk(S, cx, cy);
      ctx.drawImage(ch.c, ox, oy);
    }
    const vis = S._vis, exp = S.map.explored, feat = S.map.feature;

    // Water shimmer and toxic bubbles.
    if (quality !== 'low') {
      const blink = Math.floor(time * 2);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const t = S.map.terrain[ty * N + tx];
        if (t !== T.WATER && t !== T.TOXIC) continue;
        if (!exp[ty * N + tx]) continue;
        const h = UB.hash3(tx, ty, blink);
        if (h > 0.5) continue;
        const p = R.w2s(tx + 0.3 + h, ty + 0.3 + UB.hash3(ty, tx, blink) * 0.4);
        ctx.fillStyle = t === T.WATER ? 'rgba(160,210,235,0.7)' : 'rgba(200,255,120,0.8)';
        ctx.fillRect(p.x, p.y, t === T.WATER ? 3 : 1, 1);
      }
    }

    // Decals (blood, scorch, acid).
    for (const d of FX.decals) {
      if (!vis[Math.floor(d.y) * N + Math.floor(d.x)] && !exp[Math.floor(d.y) * N + Math.floor(d.x)]) continue;
      const p = R.w2s(d.x, d.y);
      if (!onScreen(p.x, p.y, 20)) continue;
      const a = Math.min(1, d.life / 10) * (d.kind === 'scorch' ? 0.55 : 0.75);
      ctx.fillStyle = d.kind === 'blood' ? `rgba(110,14,14,${a})` : d.kind === 'acid' ? `rgba(120,200,60,${a * 0.8})` : `rgba(20,16,14,${a})`;
      const r = 5 * d.size;
      for (let k = 0; k < 5; k++) {
        const ax = Math.round(p.x + Math.sin(d.seed + k * 2.1) * r * 0.8), ay = Math.round(p.y + Math.cos(d.seed + k * 1.7) * r * 0.4);
        ctx.fillRect(ax - Math.round(r * 0.4), ay - Math.round(r * 0.2), Math.round(r * 0.8) + 1, Math.round(r * 0.4) + 1);
      }
    }

    // Fog of war over the ground (soft-edged, drawn with the isometric transform).
    if (fogFrame++ % 3 === 0 || !fogImg) updateFog(S);
    ctx.save();
    ctx.setTransform(16, 8, -16, 8, offX, offY);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogC, 0, 0);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;

    // ---- collect objects ----
    nItems = 0;
    const shadowA = 0.22 + 0.16 * daylight;
    // Features.
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * N + tx;
      const f = feat[i];
      if (!f || !exp[i]) continue;
      const p = R.w2s(tx + 0.5, ty + 0.5);
      if (!onScreen(p.x, p.y, 40)) continue;
      if (f === F.FIRE) { push(tx + ty + 1, 4, p, tx, ty, null); continue; }
      const s = f === F.CRATE ? crateSprite(S.map.famt[i]) : featureSprite(f, tx, ty);
      if (!s) continue;
      if (s.shadow) { ctx.globalAlpha = shadowA * (vis[i] ? 1 : 0.6); ctx.drawImage(s.shadow.c, p.x - s.shadow.ox, p.y - s.shadow.oy); ctx.globalAlpha = 1; }
      push(tx + ty + 1, 0, vis[i] ? s : dimOf(s), p, null, null);
    }
    // Buildings and POIs (sliced into columns).
    const addBig = (e, s, dimmed, alpha) => {
      const c0 = e.tx + e.w / 2, c1 = e.ty + e.h / 2;
      const p = R.w2s(c0, c1);
      if (p.x + s.w < -20 || p.x - s.w > W + 20 || p.y - s.oy > H + 20 || p.y + 60 < 0) return;
      if (s.shadow) { ctx.globalAlpha = shadowA; ctx.drawImage(s.shadow.c, p.x - s.shadow.ox, p.y - s.shadow.oy); ctx.globalAlpha = 1; }
      const spr = dimmed ? dimOf(s) : s;
      if (e.w === 1 && e.h === 1) { push(e.tx + e.ty + 1, 1, spr, p, alpha, e); return; }
      const cols = columnsOf(e);
      const keys = [...cols.keys()];
      const cmin = Math.min(...keys), cmax = Math.max(...keys);
      const left = p.x - offX - spr.ox; // world-screen x of sprite's left edge
      for (let c = Math.floor(left / 16); c * 16 < left + spr.w; c++) {
        const cc = Math.max(cmin, Math.min(cmax, c));
        push(cols.get(cc), 2, spr, p, { sx: c * 16 - left, alpha }, e);
      }
    };
    for (const p of S.pois) {
      const i = p.ty * N + p.tx;
      let seen = false;
      for (let y = p.ty; y < p.ty + p.h && !seen; y++) for (let x = p.tx; x < p.tx + p.w; x++) if (exp[y * N + x]) { seen = true; break; }
      if (!seen) continue;
      if (p.tx + p.w < tx0 - 4 || p.tx > tx1 + 2 || p.ty + p.h < ty0 - 4 || p.ty > ty1 + 2) continue;
      let visible = false;
      for (let y = p.ty; y < p.ty + p.h && !visible; y++) for (let x = p.tx; x < p.tx + p.w; x++) if (vis[y * N + x]) { visible = true; break; }
      addBig(p, poiSprite(p), !visible, 1);
    }
    for (const b of S.buildings) {
      if (b.dead) continue;
      if (b.tx + b.w < tx0 - 4 || b.tx > tx1 + 2 || b.ty + b.h < ty0 - 4 || b.ty > ty1 + 2) continue;
      addBig(b, buildingSprite(S, b), false, b.built < 1 ? 0.85 : 1);
      if ((b.type === 'tower' || b.type === 'hq') && b.garrison.length) {
        const hq = b.type === 'hq';
        b.garrison.forEach((id, k) => {
          const u = UB.World.get(S, id);
          if (!u) return;
          const p = hq ? R.w2s(b.tx + 2.6 - (k % 2) * 0.4, b.ty + 1.2 + k * 0.5, 34) : R.w2s(b.tx + 0.3 + k * 0.4, b.ty + 0.7 - k * 0.2, 32);
          push(b.tx + b.ty + b.w + b.h - 1 + 0.01 + k * 0.001, 5, unitSprite(S, u), p, null, u);
        });
      }
    }
    // Corpses (flat, sorted slightly behind live entities).
    for (const c of FX.corpses) {
      const i = Math.floor(c.y) * N + Math.floor(c.x);
      if (!vis[i] && !exp[i]) continue;
      const p = R.w2s(c.x, c.y);
      if (!onScreen(p.x, p.y, 30)) continue;
      const s = sprite(`c:${c.kind}:${c.v}:${c.f}`, () => UB.Models.corpse(c.kind, c.v).rotate(c.f));
      push(c.x + c.y - 0.6, 3, s, p, Math.min(1, c.life / 6), null);
    }
    // Units and zombies, interpolated between ticks.
    const lerp = (e) => {
      const px = e._px === undefined ? e.x : e._px, py = e._py === undefined ? e.y : e._py;
      return { x: px + (e.x - px) * alpha, y: py + (e.y - py) * alpha };
    };
    const selSet = ui.selSet || new Set();
    for (const u of S.units) {
      if (u.dead || u.hidden) continue;
      const q = lerp(u);
      const p = R.w2s(q.x, q.y);
      if (!onScreen(p.x, p.y, 30)) continue;
      ellipse(p.x, p.y + 1, 6, 3, `rgba(0,0,0,${0.25 + 0.1 * daylight})`);
      if (selSet.has(u.id)) ellipse(p.x, p.y + 1, 8, 4, null, '#7dff9a', 1);
      push(q.x + q.y, 5, unitSprite(S, u), p, null, u);
    }
    for (const z of S.zombies) {
      if (z.dead) continue;
      const q = lerp(z);
      const i = Math.floor(q.y) * N + Math.floor(q.x);
      if (!vis[i]) continue;
      const p = R.w2s(q.x, q.y);
      if (!onScreen(p.x, p.y, 40)) continue;
      const big = ZOMBIES[z.type].boss ? 2.2 : z.type === 'brute' ? 1.4 : 1;
      ellipse(p.x, p.y + 1, 6 * big, 3 * big, `rgba(0,0,0,${0.22 + 0.1 * daylight})`);
      if (ui.selZombie === z.id) ellipse(p.x, p.y + 1, 8 * big, 4 * big, null, '#ff6a5a', 1);
      push(q.x + q.y, 6, zombieSprite(S, z), p, null, z);
    }
    // Acid projectiles.
    for (const pr of S.proj) {
      const t = pr.t / pr.T;
      const x = pr.x0 + (pr.x1 - pr.x0) * t, y = pr.y0 + (pr.y1 - pr.y0) * t;
      const p = R.w2s(x, y, 14 + Math.sin(t * Math.PI) * 30);
      push(x + y, 7, p, null, null, null);
    }

    // Ground overlays under objects: selection of buildings/POIs, build ghost, ranges, paths.
    drawGroundUI(S, ui);

    // ---- sorted draw ----
    const list = items.slice(0, nItems).sort(byDepth);
    for (const it of list) {
      switch (it.kind) {
        case 0: case 3: drawSprite(it.a, it.b.x, it.b.y, it.c === null ? undefined : it.c); break;
        case 1: drawSprite(it.a, it.b.x, it.b.y, it.c); break;
        case 2: {
          const s = it.a, o = it.c;
          const sx = Math.max(0, o.sx), w = Math.min(16, s.w - sx) - (o.sx < 0 ? -o.sx : 0);
          if (w <= 0) break;
          if (o.alpha < 1) ctx.globalAlpha = o.alpha;
          ctx.drawImage(s.c, sx, 0, w, s.h, Math.round(it.b.x - s.ox + sx), Math.round(it.b.y - s.oy), w, s.h);
          ctx.globalAlpha = 1;
          break;
        }
        case 4: { // fire
          const p = it.a;
          for (let k = 0; k < 5; k++) {
            const fl = Math.sin(time * 9 + k * 1.7 + it.b) * 2;
            ctx.fillStyle = k % 2 ? '#ffb040' : '#ff6a20';
            ctx.fillRect(p.x - 5 + k * 2, p.y - 4 - Math.abs(fl) - (k === 2 ? 4 : 0), 2, 4 + Math.abs(fl));
          }
          if (Math.random() < 0.08) part(it.b + 0.5, it.c + 0.5, 10, 0.3, -0.3, 8, 1.6, '#3a3634', 2);
          break;
        }
        case 5: case 6: drawSprite(it.a, it.b.x, it.b.y); break;
        case 7: ctx.fillStyle = '#9aff4a'; ctx.fillRect(it.a.x - 1, it.a.y - 1, 3, 3); break;
        default: break;
      }
    }
    // X-ray: own units faintly visible through buildings.
    ctx.globalAlpha = 0.3;
    for (const it of list) if (it.kind === 5) ctx.drawImage(it.a.c, Math.round(it.b.x - it.a.ox), Math.round(it.b.y - it.a.oy));
    ctx.globalAlpha = 1;

    // Selection outlines on top, so tall buildings do not hide them.
    if (ui.sel && (ui.sel.poi || ui.sel.bld)) {
      const e = UB.World.get(S, ui.sel.poi || ui.sel.bld);
      if (e && !e.dead) { ctx.globalAlpha = 0.5; diamond(e.tx, e.ty, e.w, e.h, null, ui.sel.poi ? '#ffd166' : '#7dff9a'); ctx.globalAlpha = 1; }
    }
    // Build preview sprite.
    if (ui.ghost && ui.ghost.tiles.length) {
      const s = R.ghostSprite(ui.ghost.type);
      ctx.globalAlpha = 0.55;
      for (const g of ui.ghost.tiles.slice(0, 60)) {
        const p = R.w2s(g.x + ui.ghost.size / 2, g.y + ui.ghost.size / 2);
        ctx.drawImage(s.c, Math.round(p.x - s.ox), Math.round(p.y - s.oy));
      }
      ctx.globalAlpha = 1;
    }
    // ---- effects ----
    for (const t of FX.tracers) {
      const a = R.w2s(t.x0, t.y0, t.z0), b = R.w2s(t.x1, t.y1, 10);
      ctx.strokeStyle = t.w === 'turret' ? 'rgba(255,230,140,0.9)' : 'rgba(255,240,180,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x + 0.5, a.y + 0.5); ctx.lineTo(b.x + 0.5, b.y + 0.5); ctx.stroke();
      ctx.fillStyle = '#fff6c0';
      ctx.fillRect(a.x - 1, a.y - 1, 3, 3);
    }
    for (const p of FX.parts) {
      if (!p.size) continue;
      const q = R.w2s(p.x, p.y, p.z);
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(q.x, q.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const b of FX.booms) {
      const p = R.w2s(b.x, b.y);
      const k = b.t / 0.6;
      ellipse(p.x, p.y, b.r * 16 * (0.3 + k), b.r * 8 * (0.3 + k), `rgba(255,${Math.round(200 - 150 * k)},60,${0.7 * (1 - k)})`);
    }
    for (const r of FX.rings) {
      const p = R.w2s(r.x, r.y);
      const k = r.t / (r.big ? 1.2 : 0.6);
      ctx.globalAlpha = 1 - k;
      ellipse(p.x, p.y, (r.big ? 60 : 12) * k + 3, ((r.big ? 60 : 12) * k + 3) / 2, null, r.color, 1);
      ctx.globalAlpha = 1;
    }
    for (const f of FX.flares) {
      const p = R.w2s(f.x, f.y);
      for (let k = 0; k < 6; k++) {
        const z = ((time * 12 + k * 9) % 54);
        ctx.fillStyle = `rgba(255,${80 + k * 10},60,${0.7 * (1 - z / 54)})`;
        ctx.fillRect(p.x - 1 + Math.round(Math.sin(time + k) * 2), p.y - z, 3, 3);
      }
    }
    if (S.weather === 'rain') drawRain(dt);

    // ---- lighting ----
    drawLighting(S, daylight, time);

    // ---- overlays above lighting: bars, markers, labels ----
    drawOverlays(S, ui, selSet, time);
    // Ambient dust/ash.
    if (quality !== 'low') {
      ctx.fillStyle = daylight > 0.5 ? 'rgba(230,220,200,0.35)' : 'rgba(180,190,220,0.25)';
      for (const a of ambient) {
        a.x += Math.sin(time * 0.3 + a.p) * 0.1 + a.v * 0.15; a.y += a.v * 0.08;
        if (a.x > W) a.x -= W; if (a.y > H) a.y -= H;
        ctx.fillRect(Math.round(a.x), Math.round(a.y), 1, 1);
      }
    }
    if (S.weather === 'fog') {
      ctx.fillStyle = 'rgba(190,196,200,0.16)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(vigC, 0, 0);
    if (ui.box) {
      const b = ui.box;
      ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(125,255,154,0.08)';
      const x = Math.round(Math.min(b.x0, b.x1)) + 0.5, y = Math.round(Math.min(b.y0, b.y1)) + 0.5;
      const w = Math.round(Math.abs(b.x1 - b.x0)), h = Math.round(Math.abs(b.y1 - b.y0));
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    }
  };

  function updateFog(S) {
    const N = S.map.w;
    if (!fogImg) { fogImg = fogX.createImageData(N, N); fogData = new Uint32Array(fogImg.data.buffer); }
    const exp = S.map.explored, vis = S._vis;
    for (let i = 0; i < N * N; i++) {
      fogData[i] = vis[i] ? 0 : exp[i] ? (140 << 24) | (26 << 16) | (14 << 8) | 10 : (255 << 24) | (12 << 16) | (8 << 8) | 7;
    }
    fogX.putImageData(fogImg, 0, 0);
  }

  function drawRain(dt) {
    if (rain.length < (quality === 'low' ? 60 : 160)) for (let i = 0; i < 6; i++) rain.push({ x: Math.random() * (W + 60), y: -10 - Math.random() * H, v: 180 + Math.random() * 80 });
    ctx.strokeStyle = 'rgba(170,190,220,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of rain) {
      r.y += r.v * Math.max(dt, 0.016); r.x -= r.v * 0.25 * Math.max(dt, 0.016);
      ctx.moveTo(Math.round(r.x), Math.round(r.y)); ctx.lineTo(Math.round(r.x + 2), Math.round(r.y - 6));
      if (r.y > H + 10) { r.y = -10; r.x = Math.random() * (W + 60); }
    }
    ctx.stroke();
  }

  function drawLighting(S, daylight, time) {
    // Colour grading at dawn/dusk.
    const c = S.clock;
    let tint = 0, tr = 255, tg = 170, tb = 110;
    if (c.phase === 'dusk') tint = 0.35;
    else if (c.phase === 'day' && c.t < 25) { tint = 0.25 * (1 - c.t / 25); tr = 255; tg = 200; tb = 160; }
    else if (c.phase === 'day' && c.t > UB.Waves.phaseLen(S, 'day') - 30) tint = 0.25 * (1 - (UB.Waves.phaseLen(S, 'day') - c.t) / 30);
    if (tint > 0) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${Math.round(255 - (255 - tr) * tint)},${Math.round(255 - (255 - tg) * tint)},${Math.round(255 - (255 - tb) * tint)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    const dark = Math.max(0, (1 - daylight) * 0.86);
    if (dark < 0.02) return;
    const lw = lightC.width, lh = lightC.height;
    lightX.globalCompositeOperation = 'source-over';
    lightX.clearRect(0, 0, lw, lh);
    lightX.fillStyle = `rgba(6,10,28,${dark})`;
    lightX.fillRect(0, 0, lw, lh);
    lightX.globalCompositeOperation = 'destination-out';
    const glows = [];
    const light = (x, y, r, k, color) => {
      const p = R.w2s(x, y);
      const rx = r * 11.3, cx = p.x / 2, cy = p.y / 2;
      if (cx + rx < 0 || cx - rx > lw || cy + rx < 0 || cy - rx > lh) return;
      lightX.save();
      lightX.translate(cx, cy);
      lightX.scale(1, 0.55);
      const g = lightX.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${k})`);
      g.addColorStop(0.6, `rgba(0,0,0,${k * 0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lightX.fillStyle = g;
      lightX.fillRect(-rx, -rx, rx * 2, rx * 2);
      lightX.restore();
      if (color) glows.push({ p, r, color });
    };
    for (const b of S.buildings) {
      if (b.dead || b.built < 1) continue;
      if (b.type === 'hq') light(b.tx + 1.5, b.ty + 1.5, UB.DEF.BUILDINGS.hq.light * 1.4, 0.95, '255,200,120');
      else if (b.type === 'spotlight' && b.powered) light(b.tx + 0.5, b.ty + 0.5, UB.Buildings.lvl(b).light * 1.5, 1, '255,250,210');
      else if (b.type === 'turret' && b.powered) light(b.tx + 0.5, b.ty + 0.5, 1.6, 0.6, null);
      else if (b.type === 'radio' && b.powered && Math.floor(time * 2) % 2) light(b.tx + 1.5, b.ty + 1.5, 1.5, 0.5, '255,60,40');
      else if (b.w > 1) light(b.tx + b.w / 2, b.ty + b.h / 2, 2.2, 0.5, null);
    }
    for (const u of S.units) if (!u.dead && !u.hidden) light(u.x, u.y, 3.2, 0.75, null);
    const N = S.map.w;
    for (let ty = win.ty0; ty <= win.ty1; ty++)
      for (let tx = win.tx0; tx <= win.tx1; tx++) {
        if (S.map.feature[ty * N + tx] === F.FIRE && S.map.explored[ty * N + tx]) light(tx + 0.5, ty + 0.5, 4 + Math.sin(time * 7 + tx) * 0.3, 0.95, '255,140,60');
      }
    for (const l of FX.lights) light(l.x, l.y, l.r, Math.min(1, (l.life / l.max) * 1.2), l.c);
    for (const f of FX.flares) light(f.x, f.y, 3, 0.8, '255,80,60');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lightC, 0, 0, lw, lh, 0, 0, lw * 2, lh * 2);
    ctx.imageSmoothingEnabled = false;
    // Warm additive glow around the brightest sources.
    ctx.globalCompositeOperation = 'lighter';
    for (const g of glows) {
      const rx = g.r * 9;
      ctx.save();
      ctx.translate(g.p.x, g.p.y);
      ctx.scale(1, 0.55);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, `rgba(${g.color},${0.22 * dark})`);
      gr.addColorStop(1, `rgba(${g.color},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawGroundUI(S, ui) {
    const sel = ui.sel || {};
    if (sel.bld) {
      const b = UB.World.get(S, sel.bld);
      if (b && !b.dead) {
        diamond(b.tx, b.ty, b.w, b.h, 'rgba(125,255,154,0.12)', '#7dff9a');
        const L = UB.Buildings.lvl(b);
        let r = 0;
        if (b.type === 'turret') r = L.range;
        else if (b.type === 'tower') r = 6 + L.range;
        else if (b.type === 'hq' && b.garrison.length) r = 6 + L.range;
        else if (b.type === 'spotlight') r = L.light;
        else if (b.type === 'hq') r = UB.World.territory(S);
        if (r) { const p = R.w2s(b.tx + b.w / 2, b.ty + b.h / 2); ellipse(p.x, p.y, r * 16 * Math.SQRT2, r * 8 * Math.SQRT2, null, b.type === 'hq' ? 'rgba(125,200,255,0.5)' : 'rgba(255,220,120,0.6)', 1); }
      }
    }
    if (sel.poi) {
      const p = UB.World.get(S, sel.poi);
      if (p) diamond(p.tx, p.ty, p.w, p.h, 'rgba(255,209,102,0.12)', '#ffd166');
    }
    if (sel.feat) diamond(sel.feat.x, sel.feat.y, 1, 1, null, '#ffd166');
    if (ui.hoverTile && !ui.ghost) diamond(ui.hoverTile.x, ui.hoverTile.y, 1, 1, null, 'rgba(255,255,255,0.25)');
    // Territory outline while building.
    if (ui.ghost) {
      const hq = UB.World.hq(S);
      if (hq) {
        const r = UB.World.territory(S);
        const p = R.w2s(hq.tx + 1.5, hq.ty + 1.5);
        ellipse(p.x, p.y, r * 16 * Math.SQRT2, r * 8 * Math.SQRT2, 'rgba(125,200,255,0.05)', 'rgba(125,200,255,0.45)', 1);
      }
      for (const g of ui.ghost.tiles) {
        diamond(g.x, g.y, ui.ghost.size, ui.ghost.size, g.ok ? 'rgba(125,255,154,0.28)' : 'rgba(255,90,70,0.32)', g.ok ? '#7dff9a' : '#ff5a46');
      }
    }
    // Planned paths of selected units.
    if (ui.selUnits && ui.showPaths) {
      ctx.fillStyle = 'rgba(125,255,154,0.6)';
      const N = S.map.w;
      for (const u of ui.selUnits) {
        if (!u.path || u.hidden) continue;
        for (let k = u.pathI; k < u.path.length; k += 1) {
          const i = u.path[k];
          const p = R.w2s((i % N) + 0.5, ((i / N) | 0) + 0.5);
          ctx.fillRect(p.x, p.y, 1, 1);
        }
      }
    }
  }

  function drawOverlays(S, ui, selSet, time) {
    const N = S.map.w;
    const vis = S._vis, exp = S.map.explored;
    // POI markers.
    for (const p of S.pois) {
      if (!p.discovered && !p.rumor) continue;
      const c = R.w2s(p.tx + p.w / 2, p.ty + p.h / 2);
      if (c.x < -20 || c.x > W + 20 || c.y < -60 || c.y > H + 20) continue;
      const def = POIS[p.type];
      if (p.type === 'house' && R.getScale() < 2 && !(ui.sel && ui.sel.poi === p.id)) continue;
      const h = Math.max(...[p.w, p.h]) * 8 + (p.type === 'hospital' ? 40 : p.type === 'police' ? 26 : 16);
      const y = c.y - h;
      if (!p.discovered) { text('?', c.x, y, '#ffd166'); continue; }
      const empty = p.searchesLeft <= 0 && !def.nest;
      pixIcon(p.type, c.x, y, empty ? '#6a6660' : POI_COLOR[p.type]);
      if (!empty && def.danger > 1) {
        ctx.fillStyle = '#ff6a5a';
        for (let k = 0; k < def.danger; k++) ctx.fillRect(c.x - def.danger * 2 + k * 4 + 1, y + 7, 2, 2);
      }
      if (def.nest && p.hp < p.maxHp) bar(c.x, y + 11, 18, p.hp / p.maxHp, '#d84aa0');
    }
    // Building bars.
    for (const b of S.buildings) {
      if (b.dead) continue;
      const sel = ui.sel && ui.sel.bld === b.id;
      const showHp = b.hp < b.maxHp * 0.999 || sel;
      if (!showHp && b.built >= 1) continue;
      const c = R.w2s(b.tx + b.w / 2, b.ty + b.h / 2);
      if (c.x < -20 || c.x > W + 20 || c.y < -60 || c.y > H + 40) continue;
      const y = c.y - b.h * 8 - (b.type === 'tower' ? 44 : b.type === 'wall' || b.type === 'gate' ? 22 : 16);
      if (b.built < 1) bar(c.x, y, 16, b.built, '#ffd166');
      else bar(c.x, y, b.w > 1 ? 20 : 12, b.hp / b.maxHp, hpColor(b.hp / b.maxHp));
      if (b.garrison.length) { ctx.fillStyle = '#7dff9a'; for (let k = 0; k < b.garrison.length; k++) ctx.fillRect(c.x - 4 + k * 3, y - 4, 2, 2); }
      if (b.workers.length) { ctx.fillStyle = '#ffd166'; for (let k = 0; k < b.workers.length; k++) ctx.fillRect(c.x - 4 + k * 3, y - 4, 2, 2); }
    }
    // Units.
    for (const u of S.units) {
      if (u.dead || u.hidden) continue;
      const p = R.w2s(u.x, u.y);
      if (!onScreenStrict(p)) continue;
      const sel = selSet.has(u.id);
      const top = p.y - 32;
      if (sel || u.hp < u.maxHp) bar(p.x, top, 12, u.hp / u.maxHp, hpColor(u.hp / u.maxHp));
      if (u.infected >= 0) { ctx.fillStyle = Math.floor(time * 3) % 2 ? '#9aff4a' : '#4a8a2a'; ctx.fillRect(p.x + 8, top - 1, 2, 3); }
      if (u.starving) { ctx.fillStyle = '#e8c84a'; ctx.fillRect(p.x - 10, top - 1, 2, 2); }
      if (u.searching && u.lootP) {
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, top - 6, 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u.lootP); ctx.stroke();
      }
      if (u.squad && sel) text(String(u.squad), p.x - 9, top + 1, '#7dff9a');
    }
    // Zombies: bars when hurt.
    for (const z of S.zombies) {
      if (z.dead || z.hp >= z.maxHp) continue;
      const i = Math.floor(z.y) * N + Math.floor(z.x);
      if (!vis[i]) continue;
      const p = R.w2s(z.x, z.y);
      if (!onScreenStrict(p)) continue;
      const big = ZOMBIES[z.type].boss ? 64 : z.type === 'brute' ? 42 : 32;
      bar(p.x, p.y - big, ZOMBIES[z.type].boss ? 28 : 10, z.hp / z.maxHp, '#e8503a');
    }
    // Floating texts.
    for (const f of FX.floats) {
      const p = R.w2s(f.x, f.y, f.z);
      ctx.globalAlpha = Math.min(1, 1.6 - f.t);
      text(f.text, p.x, p.y, f.color);
      ctx.globalAlpha = 1;
    }
    // Horde direction markers at the screen edge.
    if (S.horde && S.horde.spawns && (S.clock.phase === 'dusk' || S.clock.phase === 'night')) {
      for (const sp of S.horde.spawns) {
        const p = R.w2s(sp.x + 0.5, sp.y + 0.5);
        if (p.x >= 8 && p.x <= W - 8 && p.y >= 8 && p.y <= H - 8) { pixWarn(p.x, p.y, time); continue; }
        const cx = W / 2, cy = H / 2;
        const a = Math.atan2(p.y - cy, p.x - cx);
        const ex = cx + Math.cos(a) * (W / 2 - 14), ey = cy + Math.sin(a) * (H / 2 - 14);
        const x = Math.max(10, Math.min(W - 10, ex)), y = Math.max(22, Math.min(H - 10, ey));
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = Math.floor(time * 3) % 2 ? '#ff5a46' : '#c83a2a';
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-1, 0); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
  function pixWarn(x, y, time) {
    ctx.fillStyle = Math.floor(time * 3) % 2 ? '#ff5a46' : '#ffd166';
    ctx.fillRect(x - 1, y - 12, 2, 6); ctx.fillRect(x - 1, y - 4, 2, 2);
  }
  const onScreenStrict = (p) => p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 60;

  // ---- picking ---------------------------------------------------------------------------------------------
  // Returns what is under art-pixel (px, py): {kind: 'unit'|'zom'|'bld'|'poi'|'feat'|'ground', ...}.
  R.pick = function (S, px, py) {
    const N = S.map.w;
    let best = null, bd = -Infinity;
    const hit = (e, s, p) => px >= p.x - s.ox + 1 && px < p.x - s.ox + s.w - 1 && py >= p.y - s.oy + 2 && py < p.y - s.oy + s.h;
    for (const u of S.units) {
      if (u.dead || u.hidden) continue;
      const p = R.w2s(u.x, u.y);
      const s = unitSprite(S, u);
      if (hit(u, s, p) || Math.hypot(px - p.x, (py - p.y + 10) / 1.6) < 9) { const d = u.x + u.y + 100; if (d > bd) { bd = d; best = { kind: 'unit', id: u.id }; } }
    }
    for (const z of S.zombies) {
      if (z.dead || !S._vis[Math.floor(z.y) * N + Math.floor(z.x)]) continue;
      const p = R.w2s(z.x, z.y);
      const s = zombieSprite(S, z);
      if (hit(z, s, p)) { const d = z.x + z.y + 50; if (d > bd) { bd = d; best = { kind: 'zom', id: z.id }; } }
    }
    if (best) return best;
    const g = R.s2w(px, py);
    const tx = Math.floor(g.x), ty = Math.floor(g.y);
    if (tx >= 0 && ty >= 0 && tx < N && ty < N) {
      const i = ty * N + tx;
      const occ = S._occ[i];
      if (occ) {
        const e = UB.World.get(S, occ);
        if (e && (e.kind === 'bld' || S.map.explored[i])) return { kind: e.kind === 'bld' ? 'bld' : 'poi', id: e.id };
      }
    }
    // Tall sprites: buildings and POIs whose sprite covers the point.
    for (const list of [S.buildings, S.pois]) {
      for (const e of list) {
        if (e.dead) continue;
        if (e.kind === 'poi' && !S.map.explored[e.ty * N + e.tx] && !e.discovered) continue;
        const p = R.w2s(e.tx + e.w / 2, e.ty + e.h / 2);
        const s = e.kind === 'poi' ? poiSprite(e) : buildingSprite(S, e);
        if (hit(e, s, p)) { const d = e.tx + e.ty + e.w + e.h; if (d > bd) { bd = d; best = { kind: e.kind === 'bld' ? 'bld' : 'poi', id: e.id }; } }
      }
    }
    if (best) return best;
    for (const [dx, dy] of [[0, 0], [1, 1], [0, 1], [1, 0]]) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const i = y * N + x;
      if (S.map.feature[i] && S.map.explored[i] && FEATURE[S.map.feature[i]] && (FEATURE[S.map.feature[i]].res || FEATURE[S.map.feature[i]].pickup)) return { kind: 'feat', x, y };
    }
    return { kind: 'ground', x: g.x, y: g.y };
  };

  // Building ghost sprite for placement preview.
  R.ghostSprite = function (type) { return sprite(`b:${type}:1:0:`, () => UB.Models.structure(type, 1, {}), { shadow: true }); };
  // Icon canvas for the build menu.
  R.buildIcon = function (type) {
    const s = sprite(`b:${type}:1:0:${type === 'gate' ? 'c' : type === 'turret' ? '0' : type === 'spotlight' || type === 'radio' ? '0' : ''}`, () => UB.Models.structure(type, 1, {}), { shadow: true });
    return s;
  };
  R.unitIcon = function (role, weapon) { return sprite(`s:${role}:${weapon}:0:1:0`, () => UB.Models.survivor(role, weapon, 0, 0).rotate(1)); };
  R.zombieIcon = function (type) { return sprite(`z:${type}:0:0:1`, () => UB.Models.zombie(type, 0, 0).rotate(1)); };
  R.poiIcon = function (p) { return poiSprite(p); };

  UB.Render = R;
})(globalThis.UB = globalThis.UB || {});
