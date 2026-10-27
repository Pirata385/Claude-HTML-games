// Procedural voxel models: survivors, zombies, corpses, vegetation and debris, player
// structures (with build progress and damage states) and every kind of point of interest.
(function (UB) {
  'use strict';
  const { Model } = UB.Vox;
  // Scale an 0xRRGGBB colour's brightness.
  function tone(hex, k) {
    const f = (v) => Math.min(255, Math.max(0, Math.round(v * k)));
    return (f((hex >> 16) & 255) << 16) | (f((hex >> 8) & 255) << 8) | f(hex & 255);
  }

  // ---- palettes ------------------------------------------------------------------------------
  const SKIN = [0xe0b08a, 0xc68e64, 0x8d5a3b, 0xf0c8a0, 0xa8714a];
  const HAIR = [0x3a2a1a, 0x1a1410, 0x8a5a2a, 0xd8b060, 0x5a3a2a];
  const ZSKIN = [0x86a06c, 0x9aa878, 0x74906a, 0xa9b39a, 0x8a9a5a];
  const ZCLOTH = [0x6a4a4a, 0x4a5a6a, 0x7a6a4a, 0x5a4a6a, 0x4a6a5a, 0x8a7a6a];
  const BLOOD = 0x7a1414, BLOOD2 = 0xa02020, BOOT = 0x2a201a, METAL = 0x3a3e44, METAL2 = 0x5a6068;
  const ROLE_LOOK = {
    soldier: { shirt: 0x5a6b3a, shirt2: 0x3e4a2a, pants: 0x4a5236 },
    scout: { shirt: 0x3f6e48, shirt2: 0x2f5a3a, pants: 0x3a3a44 },
    engineer: { shirt: 0xe8762a, shirt2: 0xf2c230, pants: 0x34507a },
    medic: { shirt: 0xe8ecf0, shirt2: 0xd02a2a, pants: 0x2a6a6a },
  };

  // ---- humanoids -----------------------------------------------------------------------------
  // Parametric humanoid facing +x. p: size, h, legH, legW, bodyW, bodyD, bodyH, head, lean,
  // colors {skin, hair, shirt, shirt2, pants, boots}, pose ('down'|'gun'|'zombie'|'raise'|'bat'|'work'),
  // frame (0 idle, 1-2 walk, 3 action), weapon, decorate(m, ctx).
  function humanoid(p) {
    const S = p.size || 9, H = p.h || 14;
    const m = new Model(S, S, H);
    const c = (S - 1) / 2;
    const legW = p.legW || 1, legH = p.legH || 4, bodyW = p.bodyW || 3, bodyD = p.bodyD || 2, bodyH = p.bodyH || 4, head = p.head || 3;
    const y0 = Math.round(c - (bodyW - 1) / 2), y1 = y0 + bodyW - 1;
    const x0 = Math.round(c - (bodyD - 1) / 2) - (bodyD % 2 === 0 ? 0 : 0), x1 = x0 + bodyD - 1;
    const col = p.colors;
    const fr = p.frame || 0;
    const step = fr === 1 ? 1 : fr === 2 ? -1 : 0;
    const legX = x0 + Math.floor((bodyD - legW) / 2);
    // Legs and boots.
    const leg = (ly, off) => {
      m.box(legX + off, ly, 1, legX + off + legW - 1, ly + legW - 1, legH - 1, col.pants);
      m.box(legX + off, ly, 0, legX + off + legW - 1, ly + legW - 1, 0, col.boots);
      if (off > 0) m.set(legX + off + legW, ly, 0, col.boots);
    };
    leg(y0, step);
    leg(y1 - legW + 1, -step);
    if (bodyW - 2 * legW > 0) m.box(legX, y0 + legW, legH - 1, legX + legW - 1, y1 - legW, legH - 1, col.pants);
    // Torso (leaning forward for zombies and runners).
    const lean = p.lean || 0;
    for (let z = legH; z < legH + bodyH; z++) {
      const sh = Math.round((lean * (z - legH + 1)) / bodyH);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        let cc = col.shirt;
        if (p.shirtFn) cc = p.shirtFn(x + sh, y, z, x0 + sh, x1 + sh, y0, y1, legH);
        if (cc !== null) m.set(x + sh, y, z, cc);
      }
    }
    const topZ = legH + bodyH;
    const shTop = Math.round(lean);
    // Head.
    const hx0 = Math.round(c - (head - 1) / 2) + shTop + (p.headFwd || 0), hy0 = Math.round(c - (head - 1) / 2);
    const hz0 = topZ - (p.headSink || 0);
    m.box(hx0, hy0, hz0, hx0 + head - 1, hy0 + head - 1, hz0 + head - 1, col.skin);
    const eye = col.eye || 0x1a1418;
    m.set(hx0 + head - 1, hy0, hz0 + head - 2, eye);
    m.set(hx0 + head - 1, hy0 + head - 1, hz0 + head - 2, eye);
    if (col.hair) {
      m.box(hx0, hy0, hz0 + head - 1, hx0 + head - 1, hy0 + head - 1, hz0 + head - 1, col.hair);
      m.box(hx0, hy0, hz0, hx0, hy0 + head - 1, hz0 + head - 1, col.hair);
    }
    // Arms.
    const shZ = topZ - 1, ay0 = y0 - 1, ay1 = y1 + 1, ax = x1 + shTop - (bodyD > 2 ? 1 : 0);
    const arm = (ay, inner) => {
      switch (p.pose) {
        case 'gun':
          m.set(ax, ay, shZ, col.shirt); m.set(ax + 1, ay, shZ - 1, col.shirt); m.set(ax + 2, inner, shZ - 1, col.skin); break;
        case 'zombie':
          for (let k = 0; k < 3; k++) m.set(ax + k, ay, shZ, k === 2 ? col.skin : col.shirt);
          m.set(ax + 3, ay, shZ, col.skin); break;
        case 'raise':
          m.set(ax, ay, shZ, col.shirt); m.set(ax + 1, ay, shZ + 1, col.shirt); m.set(ax + 1, ay, shZ + 2, col.skin); break;
        case 'work':
          m.set(ax, ay, shZ, col.shirt); m.set(ax + 1, ay, shZ, col.skin); break;
        default:
          for (let z = shZ - 2; z <= shZ; z++) m.set(ax - (bodyD > 1 ? 1 : 0), ay, z, z === shZ - 2 ? col.skin : col.shirt);
      }
    };
    arm(ay0, y0 + 1 > y1 ? y0 : Math.min(y1, y0 + 1));
    arm(ay1, Math.max(y0, y1 - 1));
    if (p.decorate) p.decorate(m, { x0, x1, y0, y1, legH, topZ, hx0, hy0, hz0, head, ax, shZ, ay0, ay1, shTop, c });
    return m;
  }

  // Weapons held in front (pose 'gun'), from the hands forward along +x.
  function addWeapon(m, k, weapon, frame) {
    const hx = k.ax + 2, cy = Math.round(k.c), z = k.shZ - 1;
    const back = frame === 3 ? -1 : 0;
    if (weapon === 'pistol') { m.box(hx + back, cy, z, hx + 1 + back, cy, z, METAL); m.set(hx + back, cy, z - 1, METAL2); }
    else if (weapon === 'shotgun') { m.box(hx - 1 + back, cy, z, hx + 3 + back, cy, z, METAL); m.box(hx - 2 + back, cy, z - 1, hx + back, cy, z - 1, 0x7a5030); }
    else if (weapon === 'rifle') { m.box(hx - 2 + back, cy, z, hx + 4 + back, cy, z, 0x2a2e30); m.box(hx - 2 + back, cy, z - 1, hx - 1 + back, cy, z - 1, 0x5a4028); m.set(hx + 1 + back, cy, z + 1, METAL2); }
  }

  function survivor(role, weapon, frame, variant) {
    const look = ROLE_LOOK[role];
    const v = variant || 0;
    const colors = { skin: SKIN[v % SKIN.length], hair: HAIR[(v >> 2) % HAIR.length], shirt: look.shirt, pants: look.pants, boots: BOOT };
    const melee = weapon === 'bat';
    const pose = frame === 4 ? 'work' : melee ? (frame === 3 ? 'raise' : 'down') : 'gun';
    return humanoid({
      size: 9, h: 15, colors, pose, frame: frame === 4 ? 0 : frame,
      shirtFn: (x, y, z, x0, x1, y0, y1, legH) => {
        if (role === 'soldier' && z >= legH + 1 && z <= legH + 2) return look.shirt2;
        if (role === 'engineer' && (y === y0 || y === y1) && z > legH) return look.shirt2;
        if (role === 'medic' && x === x1 && y === Math.round((y0 + y1) / 2) && z === legH + 2) return look.shirt2;
        if (role === 'scout' && z === legH) return 0x2a2a30;
        return look.shirt;
      },
      decorate: (m, k) => {
        const top = k.hz0 + k.head;
        if (role === 'soldier') { m.box(k.hx0, k.hy0, top - 1, k.hx0 + k.head - 1, k.hy0 + k.head - 1, top, 0x55603a); m.box(k.hx0 - 1, k.hy0, top - 1, k.hx0 - 1, k.hy0 + k.head - 1, top - 1, 0x55603a); }
        if (role === 'engineer') { m.box(k.hx0, k.hy0, top, k.hx0 + k.head - 1, k.hy0 + k.head - 1, top, 0xf2c230); m.box(k.hx0 + k.head, k.hy0, top, k.hx0 + k.head, k.hy0 + k.head - 1, top, 0xf2c230); }
        if (role === 'scout') { m.box(k.hx0, k.hy0, top - 1, k.hx0 + k.head - 1, k.hy0 + k.head - 1, top - 1, 0x2f5a3a); m.box(k.hx0, k.hy0, k.hz0, k.hx0, k.hy0 + k.head - 1, top - 1, 0x2f5a3a); m.box(k.x0 - 1, k.y0, k.legH + 1, k.x0 - 1, k.y1, k.legH + 3, 0x6b4a2a); }
        if (role === 'medic') { m.box(k.hx0, k.hy0, top - 1, k.hx0 + k.head - 1, k.hy0 + k.head - 1, top - 1, 0xf4f4f4); m.set(k.hx0 + k.head - 1, k.hy0 + 1, top - 1, 0xd02a2a); }
        if (melee) {
          const bx = k.ax + (frame === 3 ? 2 : 1), by = k.ay1;
          if (frame === 3) m.box(bx, by, k.shZ + 1, bx, by, k.shZ + 5, 0x9a7448);
          else m.box(bx - 1, by, k.shZ - 5, bx - 1, by, k.shZ - 2, 0x9a7448);
        } else if (frame !== 4) addWeapon(m, k, weapon, frame);
        if (frame === 4) m.box(k.ax + 2, k.ay1, k.shZ - 1, k.ax + 2, k.ay1, k.shZ + 1, 0x8a8a8a);
      },
    });
  }

  const Z_SPEC = {
    walker: { size: 9, h: 15, lean: 1, pose: 'zombie' },
    runner: { size: 9, h: 15, lean: 2, pose: 'zombie', bodyW: 3, shirt: 0x8a2a2a },
    bloater: { size: 11, h: 15, lean: 0, pose: 'zombie', bodyW: 5, bodyD: 4, bodyH: 5, skin: 0xa8b060 },
    brute: { size: 13, h: 20, lean: 1, pose: 'zombie', legW: 2, legH: 6, bodyW: 5, bodyD: 3, bodyH: 6, head: 4, skin: 0x7a8a70 },
    spitter: { size: 9, h: 16, lean: 1, pose: 'down', skin: 0x9ab84a, neck: true },
    screamer: { size: 9, h: 16, lean: 0, pose: 'raise', skin: 0xc8c8b0, bodyW: 3, mouth: true },
    armored: { size: 9, h: 15, lean: 1, pose: 'zombie', armored: true },
    colossus: { size: 19, h: 30, lean: 2, pose: 'zombie', legW: 3, legH: 9, bodyW: 7, bodyD: 5, bodyH: 9, head: 5, skin: 0x8a6a6a, bones: true },
  };
  function zombie(type, variant, frame) {
    const sp = Z_SPEC[type];
    const v = variant || 0;
    const skin = sp.skin || ZSKIN[v % ZSKIN.length];
    const shirt = sp.armored ? 0x2a3448 : sp.shirt || ZCLOTH[(v * 3 + 1) % ZCLOTH.length];
    const pants = sp.armored ? 0x22283a : [0x3a3a44, 0x4a4036, 0x2e3440][v % 3];
    const colors = { skin, hair: type === 'brute' || type === 'colossus' ? null : [0x2a2018, 0x4a3a2a, null][v % 3], shirt, pants, boots: 0x2a2420, eye: type === 'spitter' ? 0x7aff3a : 0xd8e070 };
    let pose = sp.pose;
    if (frame === 3) pose = 'raise';
    const seed = v * 977 + 13;
    return humanoid({
      size: sp.size, h: sp.h, colors, pose, frame: frame === 3 ? 0 : frame, lean: sp.lean,
      legW: sp.legW, legH: sp.legH, bodyW: sp.bodyW, bodyD: sp.bodyD, bodyH: sp.bodyH, head: sp.head, headFwd: sp.lean ? 1 : 0, headSink: type === 'brute' || type === 'colossus' ? 1 : 0,
      shirtFn: (x, y, z, x0, x1, y0, y1, legH) => {
        const h = UB.hash3(x + seed, y * 3, z * 5);
        if (sp.armored) return z === legH + 2 && x === x1 ? 0x4a5a7a : shirt;
        if (type === 'bloater') return h < 0.15 ? 0xc8b040 : h < 0.3 ? 0x8a9a40 : skin;
        if (h < 0.12) return skin;             // torn clothes
        if (h < 0.2) return BLOOD;
        return shirt;
      },
      decorate: (m, k) => {
        const top = k.hz0 + k.head;
        if (sp.armored) {
          m.box(k.hx0, k.hy0, top - 1, k.hx0 + k.head - 1, k.hy0 + k.head - 1, top, 0x2a3040);
          m.box(k.hx0 + k.head - 1, k.hy0, k.hz0, k.hx0 + k.head - 1, k.hy0 + k.head - 1, top - 2, 0x8ab0d0);
        }
        if (sp.neck) { m.box(k.hx0 + 1, k.hy0, k.hz0 - 1, k.hx0 + 2, k.hy0 + 2, k.hz0, 0x7ac83a); m.set(k.hx0 + 3, k.hy0 + 1, k.hz0, 0x9aff4a); }
        if (sp.mouth) { m.set(k.hx0 + k.head - 1, k.hy0 + 1, k.hz0, 0x6a0a0a); m.set(k.hx0 + k.head - 1, k.hy0 + 1, k.hz0 + 1, 0x6a0a0a); }
        if (sp.bones) {
          for (let i = 0; i < 6; i++) m.set(k.x0 - 1, k.y0 + i, k.legH + 3 + (i % 3) * 2, 0xe8e0c8);
          m.box(k.hx0, k.hy0 - 1, top, k.hx0, k.hy0 - 1, top + 1, 0xe8e0c8);
          m.box(k.hx0, k.hy0 + k.head, top, k.hx0, k.hy0 + k.head, top + 1, 0xe8e0c8);
        }
        if (type === 'bloater') for (let i = 0; i < 4; i++) m.set(k.x1 + 1, k.y0 + i + 1, k.legH + 1 + (i % 2) * 2, 0xd8c048);
        // Blood on the mouth.
        m.set(k.hx0 + k.head - 1, k.hy0 + Math.floor(k.head / 2), k.hz0, BLOOD2);
      },
    });
  }

  // Lying body; colour by kind. Facing +x.
  function corpse(kind, variant) {
    const human = kind === 'unit';
    const sp = human ? null : Z_SPEC[kind] || Z_SPEC.walker;
    const big = sp && (kind === 'brute' || kind === 'colossus');
    const L = big ? (kind === 'colossus' ? 16 : 12) : 9, Wd = big ? (kind === 'colossus' ? 8 : 5) : 3;
    const m = new Model(L + 2, Wd + 4, big ? 4 : 3);
    const skin = human ? SKIN[variant % SKIN.length] : sp.skin || ZSKIN[variant % ZSKIN.length];
    const cloth = human ? 0x5a5a5a : sp.armored ? 0x2a3448 : sp.shirt || ZCLOTH[(variant * 3 + 1) % ZCLOTH.length];
    const y0 = 2;
    m.box(1, y0, 0, Math.floor(L * 0.45), y0 + Wd - 1, 0, 0x3a3a44);
    m.box(Math.floor(L * 0.45) + 1, y0, 0, L - 3, y0 + Wd - 1, big ? 1 : 0, cloth);
    m.box(L - 2, y0, 0, L, y0 + Wd - 1, big ? 2 : 1, skin);
    m.set(L - 4, y0 - 1, 0, skin); m.set(L - 5, y0 + Wd, 0, skin);
    return m;
  }

  // ---- vegetation and props ---------------------------------------------------------------------------
  function tree(kind, v) {
    const r = new UB.Rng(v * 31 + 7);
    if (kind === 'pine') {
      const m = new Model(9, 9, 18);
      m.box(4, 4, 0, 4, 4, 4, 0x5a3a22);
      const greens = [0x2f5a32, 0x3a6a3a, 0x24482a];
      for (let z = 3; z < 17; z++) {
        const rad = Math.max(0.6, ((17 - z) / 14) * 4.2 * (z % 3 === 0 ? 0.85 : 1));
        for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if ((x - 4) ** 2 + (y - 4) ** 2 <= rad * rad) m.set(x, y, z, greens[(x * 3 + y + z) % 3]);
      }
      return m;
    }
    if (kind === 'dead') {
      const m = new Model(9, 9, 15);
      m.box(4, 4, 0, 4, 4, 11, 0x5a4a3e);
      m.box(4, 4, 6, 7, 4, 6, 0x5a4a3e); m.box(7, 4, 7, 7, 4, 9, 0x5a4a3e);
      m.box(4, 1, 8, 4, 4, 8, 0x4a3e34); m.box(4, 1, 9, 4, 1, 11, 0x4a3e34);
      m.box(2, 4, 10, 4, 4, 10, 0x5a4a3e);
      return m;
    }
    const m = new Model(11, 11, 15);
    m.box(5, 5, 0, 5, 5, 6, 0x5a3a22);
    m.set(6, 5, 0, 0x5a3a22); m.set(5, 6, 0, 0x5a3a22);
    const greens = [[0x3f7a3a, 0x4f8a42, 0x2f6030], [0x5a7a2a, 0x6a8a32, 0x48622a], [0x7a6a2a, 0x8a5a2a, 0x5a6a2a]][v % 5 === 4 ? 2 : v % 3 === 2 ? 1 : 0];
    m.sphere(5 + r.range(-0.5, 0.5), 5 + r.range(-0.5, 0.5), 9.5, 4.6, (x, y, z, d) => {
      const h = UB.hash3(x + v, y * 7, z * 3);
      if (d > 0.75 && h < 0.35) return undefined;
      return greens[h < 0.33 ? 0 : h < 0.75 ? 1 : 2];
    }, 4.4, 3.8);
    return m;
  }
  function bush(v) {
    const m = new Model(8, 8, 5);
    const g = [0x3f6a32, 0x4f7a3a, 0x355a2a];
    m.sphere(4, 4, 1.5, 3.3, (x, y, z) => (UB.hash3(x + v, y, z) < 0.2 ? undefined : g[(x + y + z + v) % 3]), 3, 2.5);
    if (v % 3 === 0) { m.set(2, 3, 3, 0xc84a4a); m.set(5, 5, 3, 0xc84a4a); }
    return m;
  }
  function car(v, rot) {
    const m = new Model(16, 9, 7);
    const bodies = [0x8a2a22, 0x2a4a7a, 0xb8b4a8, 0x3a5a3a, 0x6a6a6a, 0x9a7a2a];
    const burned = v % 4 === 3;
    const body = burned ? 0x3a2a24 : bodies[v % bodies.length];
    const rust = 0x7a4a2a;
    m.box(2, 1, 1, 13, 7, 3, (x, y, z) => (UB.hash3(x, y + v, z) < 0.12 ? rust : body));
    m.box(5, 2, 4, 10, 6, 5, (x, y, z) => ((x === 5 || x === 10) && z === 4 ? 0x1c2630 : z === 5 ? body : y === 2 || y === 6 ? 0x26323e : body));
    for (const [x, y] of [[3, 1], [12, 1], [3, 7], [12, 7]]) m.box(x, y, 0, x + 1, y, 1, 0x1a1a1a);
    m.box(13, 2, 2, 13, 2, 2, 0xe8e0a0); m.box(13, 6, 2, 13, 6, 2, 0xe8e0a0);
    if (v % 3 === 1) m.box(6, 3, 6, 8, 5, 6, 0x6a5a4a);
    return rot ? m.rotate(1) : m;
  }
  function debris(v) {
    const m = new Model(8, 8, 4);
    const r = new UB.Rng(v * 13 + 1);
    const cols = [0x8a8378, 0x6a5a4a, 0x5a5e64, 0x7a6a58, 0x9a9488];
    for (let k = 0; k < 9; k++) {
      const x = r.int(0, 6), y = r.int(0, 6), w = r.int(1, 2), d = r.int(1, 2), h = r.int(0, 2);
      m.box(x, y, 0, x + w - 1, y + d - 1, h, r.pick(cols));
    }
    m.box(1, r.int(1, 5), 1, 6, r.int(1, 5), 1, 0x7a5030);
    return m;
  }
  function crate(kind) {
    const m = new Model(8, 8, 7);
    if (kind === 3) {
      m.box(1, 1, 0, 6, 6, 4, (x, y, z) => (z === 2 || x === 1 || x === 6 ? 0x3a4a2a : 0x56683a));
      m.box(2, 2, 5, 5, 5, 6, 0xe8e8e0);
      m.set(3, 3, 6, 0xd84a2a);
      return m;
    }
    if (kind === 2) {
      m.box(2, 2, 0, 5, 5, 2, 0x6b4a2a);
      m.box(2, 3, 3, 5, 4, 3, 0x5a3a20);
      return m;
    }
    m.box(1, 1, 0, 6, 6, 4, (x, y, z) => (z === 0 || z === 4 || x === 1 || x === 6 || y === 1 || y === 6 ? 0x7a5030 : 0x9a6a3a));
    if (kind === 1) m.box(3, 1, 2, 4, 1, 2, 0x56683a);
    return m;
  }
  function rock(v) {
    const m = new Model(8, 8, 5);
    m.sphere(4, 4, 1, 3.4, (x, y, z) => [0x6a6a66, 0x7a7a74, 0x5a5a58][(x + y * 2 + z + v) % 3], 3, 3);
    return m;
  }
  function fence(v, along) {
    const m = new Model(8, 8, 6);
    const wood = [0x7a5a3a, 0x6a4a2e][v % 2];
    for (let x = 0; x < 8; x++) {
      if (x % 3 === 0) m.box(x, 3, 0, x, 3, 5, wood);
      m.set(x, 3, 2, wood); m.set(x, 3, 4, wood);
    }
    return along ? m.rotate(1) : m;
  }
  function barrier(along) {
    const m = new Model(8, 8, 5);
    m.box(0, 2, 0, 7, 5, 1, 0x9a9890);
    m.box(0, 3, 2, 7, 4, 3, (x) => (x % 4 < 2 ? 0xc8402a : 0xe8e0d0));
    return along ? m.rotate(1) : m;
  }
  function container(v) {
    const m = new Model(8, 8, 6);
    const cols = [0x2a5a8a, 0x8a3a2a, 0x3a6a3a, 0xb8902a];
    const c = cols[v % cols.length];
    m.box(0, 2, 0, 7, 5, 4, (x, y, z) => {
      if (z === 4) return tone(c, 1.08);
      if (x === 7 && (y === 3 || y === 4) && z >= 1 && z <= 3) return tone(c, 0.6);
      if (UB.hash3(x, y + v, z) < 0.08) return 0x7a4a2a;
      return x % 2 ? c : tone(c, 0.82);
    });
    m.box(0, 2, 0, 7, 2, 0, tone(c, 0.6)); m.box(0, 5, 0, 7, 5, 0, tone(c, 0.6));
    return v % 2 ? m.rotate(1) : m;
  }

  // ---- player structures ------------------------------------------------------------------------------
  const WOOD = 0x8a6038, WOOD2 = 0x6a4628, PLANK = 0x9a7048, CONCRETE = 0x9a968c, CONC2 = 0x7e7a72;
  const SAND = 0xb09a6a;

  function sandbags(m, x0, y0, x1, y1, h) {
    for (let z = 0; z < h; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
      m.set(x, y, z, (x + y + z) % 3 === 0 ? 0x9a865a : SAND);
    }
  }

  function structure(type, level, opts) {
    opts = opts || {};
    const L = level || 1;
    let m;
    switch (type) {
      case 'barricade': {
        m = new Model(8, 8, 8);
        for (let y = 0; y < 8; y += 3) m.box(3, y, 0, 4, y, 6, WOOD2);
        m.box(3, 0, 1, 3, 7, 2, PLANK); m.box(4, 0, 4, 4, 7, 5, PLANK);
        for (let k = 0; k < 6; k++) m.set(3 + (k % 2), k + 1, k, WOOD);
        if (L >= 2) { m.box(2, 0, 3, 2, 7, 3, PLANK); m.box(5, 0, 6, 5, 7, 6, PLANK); }
        if (L >= 3) m.box(4, 0, 1, 5, 7, 4, (x, y) => (y % 2 ? METAL2 : 0x6a7078));
        break;
      }
      case 'wall': {
        m = new Model(8, 8, 12);
        const c1 = L >= 2 ? 0x8a4a3a : CONCRETE, c2 = L >= 2 ? 0x6a3a2e : CONC2;
        m.box(0, 0, 0, 7, 7, 9, (x, y, z) => ((z % 3 === 2) || ((x + (z % 6 < 3 ? 0 : 2)) % 4 === 0 && y % 4 === 0) ? c2 : c1));
        if (L >= 2) m.box(0, 0, 4, 7, 7, 4, METAL2);
        if (L >= 3) for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) if ((x + y) % 2 === 0) m.set(x, y, 10, 0x8a8a90);
        break;
      }
      case 'gate': {
        m = new Model(8, 8, 12);
        m.box(0, 0, 0, 1, 1, 10, CONC2); m.box(6, 6, 0, 7, 7, 10, CONC2);
        m.box(0, 6, 0, 1, 7, 10, CONC2); m.box(6, 0, 0, 7, 1, 10, CONC2);
        const panel = L >= 2 ? 0x5a6470 : WOOD;
        if (!opts.open) {
          m.box(2, 2, 0, 5, 5, 8, (x, y, z) => (z === 4 ? METAL : (x + y) % 2 ? panel : tone(panel, 0.9)));
        } else {
          m.box(2, 0, 0, 2, 1, 8, panel); m.box(5, 6, 0, 5, 7, 8, panel);
        }
        m.box(0, 0, 10, 7, 1, 10, 0xc89a2a);
        break;
      }
      case 'tower': {
        m = new Model(8, 8, 24);
        for (const [x, y] of [[0, 0], [7, 0], [0, 7], [7, 7]]) m.box(x, y, 0, x, y, 16, WOOD2);
        for (let z = 3; z < 15; z += 4) { m.box(0, 0, z, 7, 0, z, WOOD); m.box(0, 7, z, 7, 7, z, WOOD); }
        m.box(0, 0, 15, 7, 7, 15, PLANK);
        if (L >= 3) sandbagsAt(m, 16, 2);
        else { m.box(0, 0, 16, 7, 0, 17, WOOD); m.box(0, 7, 16, 7, 7, 17, WOOD); m.box(0, 0, 16, 0, 7, 17, WOOD); m.box(7, 0, 16, 7, 7, 17, WOOD); }
        for (const [x, y] of [[0, 0], [7, 0], [0, 7], [7, 7]]) m.box(x, y, 18, x, y, 20, WOOD2);
        for (let z = 21; z <= 22; z++) m.box(z - 21, z - 21, z, 7 - (z - 21), 7 - (z - 21), z, L >= 2 ? 0x5a6470 : 0x6a3a2a);
        break;
      }
      case 'turret': {
        m = new Model(8, 8, 9);
        sandbags(m, 0, 0, 7, 7, 3);
        m.box(3, 3, 0, 4, 4, 4, METAL);
        m.box(2, 2, 5, 5, 5, 6, L >= 3 ? 0x4a5a3a : METAL2);
        m.box(5, 3, 6, 9, 3, 6, METAL); m.box(5, 4, 6, 8, 4, 6, METAL);
        m.box(1, 2, 7, 1, 5, 8, 0x6a7078);
        const r = opts.dir || 0;
        return r ? m.rotate(r) : m;
      }
      case 'spotlight': {
        m = new Model(8, 8, 15);
        m.box(3, 3, 0, 4, 4, 0, CONC2);
        m.box(3, 3, 1, 3, 3, 11, METAL);
        m.box(2, 2, 12, 5, 5, 13, METAL2);
        m.box(5, 2, 12, 5, 5, 13, opts.on ? 0xfff6c0 : 0xb8b49a);
        break;
      }
      case 'spikes': {
        m = new Model(8, 8, 4);
        m.box(0, 0, 0, 7, 7, 0, WOOD2);
        for (let y = 0; y < 8; y += 2) for (let x = (y / 2) % 2; x < 8; x += 2) { m.set(x, y, 1, L >= 2 ? METAL2 : WOOD); m.set(x, y, 2, 0xb8b8b0); if (L >= 3) m.set(x, y, 3, 0xd8d8d0); }
        break;
      }
      case 'shelter': {
        m = new Model(16, 16, 18);
        const wall = L >= 3 ? 0x7a6a58 : WOOD;
        m.box(1, 1, 0, 14, 14, 0, WOOD2);
        m.shell(2, 2, 1, 13, 13, 8, (x, y, z) => ((y === 13 && x >= 6 && x <= 8 && z <= 5) ? 0x2a1a10 : (x === 13 && (y === 5 || y === 10) && z >= 4 && z <= 5) ? 0x30404a : z % 2 ? wall : tone(wall, 0.88)));
        for (let k = 0; k <= 6; k++) m.box(1 + k, 1, 9 + k, 14 - k, 14, 9 + k, (x, y) => (y === 1 || y === 14 ? WOOD2 : L >= 2 ? 0x5a6470 : 0x8a3a2a));
        if (L >= 2) m.box(12, 6, 9, 12, 7, 16, 0x6a6a6a);
        break;
      }
      case 'depot': {
        m = new Model(16, 16, 14);
        m.box(1, 1, 0, 14, 14, 0, CONC2);
        m.shell(2, 2, 1, 11, 13, 9, (x, y, z) => ((x === 11 && y >= 5 && y <= 10 && z <= 7) ? (z % 2 ? 0x6a7078 : 0x5a6068) : y % 2 ? 0x7a8088 : 0x6a7078));
        m.box(2, 2, 10, 11, 13, 10, 0x4a5058);
        m.box(12, 2, 1, 14, 4, 3, 0x9a6a3a); m.box(12, 9, 1, 14, 11, 2, 0x9a6a3a); m.box(13, 10, 3, 14, 11, 4, 0x56683a);
        if (L >= 2) m.box(12, 5, 1, 13, 7, 4, 0x7a5030);
        if (L >= 3) m.box(2, 2, 11, 11, 13, 11, 0x8a3a2a);
        break;
      }
      case 'workshop': {
        m = new Model(16, 16, 20);
        m.box(1, 1, 0, 14, 14, 0, CONC2);
        m.shell(2, 2, 1, 12, 12, 9, (x, y, z) => ((x === 12 && y >= 5 && y <= 9 && z <= 6) ? 0x2a2420 : (z % 3 === 0 ? 0x6a3a2e : 0x8a4a3a)));
        m.box(2, 2, 10, 12, 12, 10, 0x4a4a52);
        m.box(3, 3, 11, 4, 4, 17, 0x6a3a2e); m.box(3, 3, 18, 4, 4, 18, 0x2a2a2a);
        m.box(13, 10, 1, 14, 11, 3, METAL); m.box(13, 10, 4, 14, 11, 4, 0x5a5a5a);
        m.sphere(12.5, 7, 7, 1.5, 0xc89a2a, 0.6, 1.5);
        if (L >= 2) m.box(13, 3, 1, 14, 5, 2, 0x7a5030);
        if (L >= 3) m.box(7, 7, 11, 9, 9, 12, METAL2);
        break;
      }
      case 'garden': {
        m = new Model(16, 16, 6);
        m.box(0, 0, 0, 15, 15, 0, 0x5a3e24);
        for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
          if (x === 0 || x === 15 || y === 0 || y === 15) { if ((x + y) % 2 === 0) m.box(x, y, 1, x, y, 2, WOOD); continue; }
          if (y % 3 === 1) continue;
          const g = UB.hash3(x, y, L) ;
          m.set(x, y, 1, 0x6a4a2a);
          if (g < 0.8) m.set(x, y, 2, g < 0.4 ? 0x5a9a3a : 0x7aba4a);
          if (L >= 2 && g < 0.45) m.set(x, y, 3, 0x4a8a32);
          if (L >= 3 && g < 0.15) m.set(x, y, 4, 0xd84a3a);
        }
        break;
      }
      case 'generator': {
        m = new Model(16, 16, 13);
        m.box(1, 1, 0, 14, 14, 0, CONC2);
        m.box(3, 4, 1, 11, 11, 6, (x, y, z) => (z === 6 ? 0x3a3a3a : (x + z) % 4 < 2 && (x === 11 || y === 11) ? 0x1a1a1a : 0xe0b020));
        m.box(5, 6, 7, 5, 6, 11, METAL); m.box(5, 6, 12, 6, 6, 12, 0x2a2a2a);
        m.box(12, 2, 1, 13, 3, 4, 0xa02a1a); m.box(12, 5, 1, 13, 6, 4, 0xa02a1a);
        if (L >= 2) m.box(12, 9, 1, 13, 10, 4, 0x2a5a8a);
        if (L >= 3) m.box(3, 12, 1, 9, 13, 2, METAL2);
        break;
      }
      case 'infirmary': {
        m = new Model(16, 16, 14);
        m.box(1, 1, 0, 14, 14, 0, 0xc8c8c0);
        for (let k = 0; k <= 7; k++) m.box(2 + k, 2, 1 + k, 13 - k, 13, 1 + k, (x, y) => (y === 2 || y === 13 ? 0xd8d8d0 : 0xe8e8e0));
        m.box(7, 4, 8, 8, 11, 8, 0xd02a2a); m.box(4, 7, 8, 11, 8, 8, 0xd02a2a);
        m.box(5, 13, 1, 10, 13, 5, 0x6a8a8a);
        if (L >= 2) m.box(13, 3, 1, 14, 4, 3, 0xe8e8e0);
        break;
      }
      case 'radio': {
        m = new Model(16, 16, 34);
        m.box(1, 1, 0, 14, 14, 0, CONC2);
        m.shell(2, 2, 1, 8, 8, 6, (x, y, z) => ((x === 8 && y === 5 && z <= 4) ? 0x2a2420 : 0x7a7e70));
        m.box(2, 2, 7, 8, 8, 7, 0x4a4a52);
        for (let z = 1; z < 32; z++) { const s = z < 16 ? 1 : 0; m.box(11 - s, 11 - s, z, 11 + s, 11 + s, z, z % 4 === 0 ? 0xd84a2a : 0xd8d8d0); }
        m.set(11, 11, 32, opts.on ? 0xff3a2a : 0x8a2a2a);
        break;
      }
      case 'hq': {
        m = new Model(24, 24, 26);
        m.box(0, 0, 0, 23, 23, 0, CONC2);
        const wall = L >= 3 ? 0x7a7e86 : 0xb0a490;
        m.shell(2, 2, 1, 21, 21, 15, (x, y, z) => {
          if (z === 8) return 0x8a7a64;
          if ((x === 21 || y === 21) && z % 8 >= 3 && z % 8 <= 5 && ((x + y) % 5 === 0 || (x + y) % 5 === 1)) return z < 8 ? 0x7a5030 : 0x1c2630;
          if (y === 21 && x >= 10 && x <= 13 && z <= 6) return 0x3a2a1a;
          return (x + z) % 7 === 0 ? tone(wall, 0.9) : wall;
        });
        m.box(2, 2, 16, 21, 21, 16, 0x5a5650);
        for (let x = 2; x <= 21; x++) for (const y of [2, 21]) if (x % 2 === 0) m.set(x, y, 17, wall);
        for (let y = 2; y <= 21; y++) for (const x of [2, 21]) if (y % 2 === 0) m.set(x, y, 17, wall);
        // Flag and antenna.
        m.box(5, 5, 17, 5, 5, 25, METAL2); m.box(5, 6, 22, 5, 9, 25, (x, y, z) => (z >= 24 ? 0x2a6a3a : z === 23 ? 0xe8d040 : 0x2a4a9a));
        m.box(17, 17, 17, 17, 17, 23, METAL);
        sandbags(m, 0, 22, 9, 23, 3); sandbags(m, 14, 22, 23, 23, 3); sandbags(m, 22, 0, 23, 9, 3); sandbags(m, 22, 14, 23, 23, 3);
        if (L >= 2) { m.box(10, 10, 17, 13, 13, 19, 0x6a6a6a); m.box(9, 9, 20, 14, 14, 20, 0x8a3a2a); }
        if (L >= 3) m.box(2, 2, 6, 21, 21, 6, (x, y) => (x === 2 || x === 21 || y === 2 || y === 21 ? METAL2 : undefined));
        break;
      }
      default: m = new Model(8, 8, 4); m.box(1, 1, 0, 6, 6, 3, 0xff00ff);
    }
    return m;
  }
  function sandbagsAt(m, z0, h) {
    for (let z = z0; z < z0 + h; z++) for (let x = 0; x < m.w; x++) for (let y = 0; y < m.d; y++) {
      if (x === 0 || y === 0 || x === m.w - 1 || y === m.d - 1) m.set(x, y, z, (x + y + z) % 3 === 0 ? 0x9a865a : SAND);
    }
  }

  // Construction stage: the finished model cut at a height, wrapped in scaffolding.
  function underConstruction(full, progress) {
    const m = new Model(full.w, full.d, full.h);
    m.pal = full.pal.slice(); m.palIdx = new Map(full.palIdx);
    const zmax = Math.max(1, Math.floor(full.h * progress));
    for (let z = 0; z < Math.min(zmax, full.h); z++) for (let y = 0; y < full.d; y++) for (let x = 0; x < full.w; x++) {
      const v = full.data[(z * full.d + y) * full.w + x];
      if (v) m.data[(z * m.d + y) * m.w + x] = v;
    }
    const W = full.w - 1, D = full.d - 1, top = Math.min(full.h - 1, zmax + 2);
    for (const [x, y] of [[0, 0], [W, 0], [0, D], [W, D]]) m.box(x, y, 0, x, y, top, 0xc89a4a);
    for (let z = 3; z <= top; z += 4) { m.box(0, 0, z, W, 0, z, 0xb8883a); m.box(0, D, z, W, D, z, 0xb8883a); m.box(0, 0, z, 0, D, z, 0xb8883a); m.box(W, 0, z, W, D, z, 0xb8883a); }
    return m;
  }
  // Damage: knock out some voxels and scorch others.
  function damaged(full, amount, seed) {
    const m = new Model(full.w, full.d, full.h);
    m.pal = full.pal.slice(); m.palIdx = new Map(full.palIdx);
    const soot = m.col(0x2a2622);
    for (let i = 0; i < full.data.length; i++) {
      const v = full.data[i];
      if (!v) continue;
      const h = UB.hash3(i, seed, 5);
      if (h < amount * 0.5 && i > full.w * full.d * 2) continue;
      m.data[i] = h < amount ? soot : v;
    }
    return m;
  }

  // ---- points of interest ----------------------------------------------------------------------------------
  // Door side (toward the entrance tile): 'x+' | 'y+' | 'x-' | 'y-'.
  function doorSide(p) {
    if (p.ey >= p.ty + p.h) return 'y+';
    if (p.ex >= p.tx + p.w) return 'x+';
    if (p.ey < p.ty) return 'y-';
    return 'x-';
  }

  // Generic walls with windows, floor trims, a door and optional damage holes.
  function walls(m, o) {
    const { x0, y0, x1, y1, H } = o;
    const r = o.rng;
    const lenX = x1 - x0, lenY = y1 - y0;
    for (let z = 1; z <= H; z++) {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const edgeX = x === x0 || x === x1, edgeY = y === y0 || y === y1;
        if (!edgeX && !edgeY) continue;
        const along = edgeX && !edgeY ? y - y0 : x - x0;
        const len = edgeX && !edgeY ? lenY : lenX;
        let c = o.wall;
        const fz = (z - 1) % 8;
        if (o.trim && fz === 7) c = o.trim;
        const corner = edgeX && edgeY;
        if (!corner && fz >= 3 && fz <= 5 && along > 1 && along < len - 1 && along % (o.winEvery || 4) < (o.winW || 2)) {
          const hh = UB.hash3(x * 3 + z, y * 5, o.seed);
          c = hh < 0.15 ? 0x0c0c10 : hh < 0.28 && o.boarded ? 0x7a5a3a : o.glass || 0x1e2a36;
          if (hh > 0.9) c = 0x3a5a6a;
        }
        // Door.
        const mid = (o.door === 'x+' || o.door === 'x-') ? Math.round((y0 + y1) / 2) : Math.round((x0 + x1) / 2);
        const onDoorWall = (o.door === 'x+' && x === x1) || (o.door === 'x-' && x === x0) || (o.door === 'y+' && y === y1) || (o.door === 'y-' && y === y0);
        if (onDoorWall && !corner && z <= (o.doorH || 6)) {
          const pos = o.door[0] === 'x' ? y : x;
          if (Math.abs(pos - mid) <= (o.doorW || 1)) c = o.doorC || 0x1a140e;
        }
        if (o.holes && UB.fbm(o.seed, x / 3 + y / 3, z / 3, 2) > 1 - o.holes) continue;
        m.set(x, y, z, c);
      }
    }
  }
  function flatRoof(m, x0, y0, x1, y1, z, c, parapet) {
    m.box(x0, y0, z, x1, y1, z, c);
    if (parapet) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (x === x0 || x === x1 || y === y0 || y === y1) m.set(x, y, z + 1, parapet);
  }
  function gableRoof(m, x0, y0, x1, y1, z0, c, c2, alongX) {
    const half = alongX ? Math.ceil((y1 - y0 + 1) / 2) : Math.ceil((x1 - x0 + 1) / 2);
    for (let k = 0; k <= half; k++) {
      if (alongX) m.box(x0, y0 + k, z0 + k, x1, y1 - k, z0 + k, (x, y) => (y === y0 + k || y === y1 - k ? c : c2));
      else m.box(x0 + k, y0, z0 + k, x1 - k, y1, z0 + k, (x) => (x === x0 + k || x === x1 - k ? c : c2));
    }
  }
  function cross(m, cx, cy, z, s, c) {
    m.box(cx - s, cy - 1, z, cx + s, cy, z, c);
    m.box(cx - 1, cy - s, z, cx, cy + s, z, c);
  }

  function poi(p) {
    const W = p.w * 8, D = p.h * 8;
    const r = new UB.Rng(p.variant * 7 + 3);
    const door = doorSide(p);
    const seed = p.variant % 997;
    let m;
    switch (p.type) {
      case 'house': {
        const floors = r.chance(0.3) ? 2 : 1;
        const H = floors * 8;
        m = new Model(W, D, H + 12);
        const wallC = r.pick([0xc8b89a, 0xa8b8a0, 0xd0a890, 0x9aa8b8, 0xc8c0a8, 0xb89a8a]);
        const roofC = r.pick([0x8a3a2a, 0x4a4a52, 0x6a5a3a, 0x7a2e24]);
        m.box(1, 1, 0, W - 2, D - 2, 0, 0x7a7468);
        const ruined = r.chance(0.35);
        walls(m, { x0: 2, y0: 2, x1: W - 3, y1: D - 3, H, wall: wallC, trim: tone(wallC, 0.8), door, seed, boarded: true, winEvery: 5, holes: ruined ? 0.12 : 0 });
        if (!ruined || r.chance(0.5)) gableRoof(m, 1, 1, W - 2, D - 2, H + 1, tone(roofC, 0.75), roofC, W >= D);
        else flatRoof(m, 2, 2, W - 3, Math.floor(D / 2), H + 1, roofC);
        m.box(W - 6, 4, H + 1, W - 5, 5, H + 6, 0x6a4a3a);
        break;
      }
      case 'pharmacy': case 'hardware': {
        const H = 9;
        m = new Model(W, D, H + 6);
        const pharm = p.type === 'pharmacy';
        const wallC = pharm ? 0xd8dcd8 : 0x8a4a3a;
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x8a8a82);
        walls(m, { x0: 2, y0: 2, x1: W - 3, y1: D - 3, H, wall: wallC, door, seed, winEvery: 3, glass: 0x24343e, doorW: 2 });
        flatRoof(m, 2, 2, W - 3, D - 3, H + 1, 0x5a5a5a, wallC);
        const sign = pharm ? 0x2a9a4a : 0xe07a20;
        m.box(W - 2, 4, 7, W - 2, D - 5, 8, sign);
        m.box(4, D - 2, 7, W - 5, D - 2, 8, sign);
        if (pharm) { m.box(W - 2, Math.floor(D / 2) - 1, 10, W - 2, Math.floor(D / 2), 13, 0x2aba5a); m.box(W - 2, Math.floor(D / 2) - 2, 11, W - 2, Math.floor(D / 2) + 1, 12, 0x2aba5a); }
        break;
      }
      case 'market': {
        const H = 11;
        m = new Model(W, D, H + 4);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x6a6a68);
        walls(m, { x0: 2, y0: 2, x1: W - 3, y1: D - 3, H, wall: 0xc8c0b0, door, seed, winEvery: 2, winW: 2, glass: 0x22303a, doorW: 2 });
        flatRoof(m, 2, 2, W - 3, D - 3, H + 1, 0x7a7a74, 0xc8c0b0);
        for (let x = 2; x <= W - 3; x++) m.box(x, D - 2, 7, x, D - 2, 8, x % 4 < 2 ? 0xd04030 : 0xf0e8e0);
        for (let y = 2; y <= D - 3; y++) m.box(W - 2, y, 7, W - 2, y, 8, y % 4 < 2 ? 0xd04030 : 0xf0e8e0);
        m.box(W - 2, 4, 10, W - 2, 10, 11, 0xd8b030);
        m.box(W - 8, D - 1, 1, W - 6, D - 1, 2, 0x9aa0a8);
        break;
      }
      case 'warehouse': case 'factory': {
        const fac = p.type === 'factory';
        const H = fac ? 14 : 12;
        m = new Model(W, D, fac ? 34 : H + 6);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x7a7670);
        const wallFn = (x, y) => ((x + y) % 2 ? 0x7a8088 : 0x6a7078);
        walls(m, { x0: 2, y0: 2, x1: W - 3, y1: D - 3, H, wall: fac ? 0x6a4038 : 0x7a8088, trim: fac ? 0x5a3430 : 0x5a6068, door, seed, winEvery: 6, winW: 2, doorW: 3, doorH: 9, doorC: 0x4a5058, holes: r.chance(0.3) ? 0.08 : 0 });
        // Sawtooth roof.
        for (let x = 2; x <= W - 3; x++) {
          const t = (x - 2) % 6;
          const hgt = H + 1 + Math.min(t, 3);
          m.box(x, 2, H + 1, x, D - 3, hgt, (xx, yy, zz) => (zz === hgt ? (t < 3 ? 0x5a6068 : 0x3a5a6a) : wallFn(xx, yy)));
        }
        if (fac) {
          for (const [cx, cy] of [[5, D - 6], [W - 7, 5]]) {
            for (let z = 1; z < 32; z++) m.sphere(cx, cy, z, 1.6, z > 28 ? (z % 2 ? 0xd84a2a : 0xe8e0d0) : 0x8a5a48, 1.6, 0.6);
          }
          m.box(W - 2, 6, 6, W - 2, D - 7, 6, METAL2);
        }
        break;
      }
      case 'gas': {
        m = new Model(W, D, 14);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x6a6a68);
        const shopW = Math.floor(W * 0.38);
        walls(m, { x0: 1, y0: 1, x1: shopW, y1: D - 2, H: 7, wall: 0xe8e0d0, door: 'x+', seed, winEvery: 2, doorW: 1 });
        flatRoof(m, 1, 1, shopW, D - 2, 8, 0xc83030);
        const exploded = p.exploded;
        for (const [x, y] of [[shopW + 4, 3], [W - 3, 3], [shopW + 4, D - 4], [W - 3, D - 4]]) m.box(x, y, 1, x, y, exploded ? 4 : 9, 0xd8d8d0);
        if (!exploded) m.box(shopW + 2, 1, 10, W - 1, D - 2, 11, (x, y, z) => (z === 10 ? 0xc83030 : 0xf0f0e8));
        for (const y of [Math.floor(D / 3), Math.floor((2 * D) / 3)]) {
          m.box(shopW + 8, y, 1, shopW + 9, y + 1, 4, exploded ? 0x2a2622 : 0xe8e0d0);
          if (!exploded) m.box(shopW + 8, y, 5, shopW + 9, y + 1, 5, 0xc83030);
        }
        if (exploded) for (let k = 0; k < 20; k++) m.set(r.int(shopW, W - 1), r.int(0, D - 1), 1, 0x2a2622);
        break;
      }
      case 'police': {
        const H = 16;
        m = new Model(W, D, H + 6);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x6a6a6a);
        walls(m, { x0: 2, y0: 2, x1: W - 3, y1: D - 3, H, wall: 0x8a96a2, trim: 0x2a4a9a, door, seed, winEvery: 4, glass: 0x1a222a });
        for (let x = 2; x <= W - 3; x++) { m.set(x, D - 3, 5, 0x2a4a9a); m.set(x, D - 3, 6, 0x2a4a9a); }
        for (let y = 2; y <= D - 3; y++) { m.set(W - 3, y, 5, 0x2a4a9a); m.set(W - 3, y, 6, 0x2a4a9a); }
        flatRoof(m, 2, 2, W - 3, D - 3, H + 1, 0x4a4a52, 0x8a96a2);
        m.box(8, 6, H + 2, 9, 7, H + 2, 0xd82a2a); m.box(10, 6, H + 2, 11, 7, H + 2, 0x2a5ad8);
        m.box(W - 6, D - 6, H + 2, W - 6, D - 6, H + 5, METAL);
        m.box(W - 2, D - 6, 1, W - 1, D - 6, 3, 0x9a9890);
        break;
      }
      case 'hospital': {
        const H = 24;
        m = new Model(W, D, H + 4);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x8a8a86);
        walls(m, { x0: 2, y0: 2, x1: W - 3, y1: D - 3, H, wall: 0xe0e4e8, trim: 0x4a9a9a, door, seed, winEvery: 3, glass: 0x22343e, holes: 0.05 });
        flatRoof(m, 2, 2, W - 3, D - 3, H + 1, 0x8a8a8a, 0xd0d4d8);
        cross(m, Math.floor(W / 2), Math.floor(D / 2), H + 2, 4, 0xc82828);
        m.box(W - 2, 6, 14, W - 2, 9, 17, 0xc82828); m.box(W - 2, 7, 12, W - 2, 8, 19, 0xc82828);
        break;
      }
      case 'farmhouse': {
        const H = 10;
        m = new Model(W, D, 26);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x6a5a3a);
        const bx1 = W - 8;
        walls(m, { x0: 1, y0: 1, x1: bx1, y1: D - 2, H, wall: 0x9a2a22, trim: 0xe8e0d0, door, seed, winEvery: 6, doorW: 2, doorH: 7 });
        gableRoof(m, 0, 0, bx1 + 1, D - 1, H + 1, 0x5a4a3a, 0x4a3a2e, true);
        for (let z = 0; z < 22; z++) m.sphere(W - 4, Math.floor(D / 2), z, 3, z > 18 ? 0x8a8a90 : 0xb0b0a8, 3, 0.6);
        break;
      }
      case 'camp': {
        m = new Model(W, D, 9);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x6a5a3a);
        const tents = [[2, 2, 0xd87a2a], [W - 9, 3, 0x2a6a9a], [3, D - 9, 0x4a7a3a]];
        for (const [tx, ty, c] of tents) for (let k = 0; k < 4; k++) m.box(tx + k, ty, 1 + k, tx + 7 - k, ty + 5, 1 + k, (x) => (x === tx + k || x === tx + 7 - k ? c : tone(c, 0.8)));
        const fx = Math.floor(W / 2) + 1, fy = Math.floor(D / 2) + 1;
        for (let a = 0; a < 8; a++) m.set(fx + Math.round(Math.cos(a) * 2), fy + Math.round(Math.sin(a) * 2), 1, 0x7a7a74);
        m.box(fx - 1, fy, 1, fx + 1, fy, 1, 0x5a3a22);
        for (let x = 0; x < W; x += 3) m.box(x, D - 1, 1, x + 1, D - 1, 3, WOOD);
        break;
      }
      case 'ruin': {
        m = new Model(W, D, 22);
        m.box(0, 0, 0, W - 1, D - 1, 0, 0x6a6158);
        const H = 20;
        const wallC = r.pick([0x8a8378, 0x9a8a78, 0x7a6a62]);
        for (let x = 2; x <= W - 3; x++) for (let y = 2; y <= D - 3; y++) {
          if (x !== 2 && x !== W - 3 && y !== 2 && y !== D - 3) {
            if (UB.hash3(x, y, seed) < 0.18) m.box(x, y, 1, x, y, 1 + Math.floor(UB.hash3(y, x, seed) * 3), wallC);
            continue;
          }
          const hh = Math.floor(UB.fbm(seed, x / 5, y / 5, 2) * H * 1.3 - 4);
          for (let z = 1; z <= Math.min(H, hh); z++) {
            const fz = (z - 1) % 8;
            m.set(x, y, z, fz >= 3 && fz <= 5 && (x + y) % 4 < 2 ? 0x101014 : fz === 7 ? 0x6a5a50 : wallC);
          }
        }
        break;
      }
      case 'nest': {
        m = new Model(W, D, 12);
        const cols = [0x7a2a4a, 0x9a3a5a, 0x5a1a3a, 0x6a2a3a];
        m.sphere(W / 2, D / 2, 2, W / 2 - 1, (x, y, z) => (UB.hash3(x, y, z) < 0.08 ? 0xc0a040 : cols[(x * 3 + y + z * 2) % cols.length]), D / 2 - 1, 8);
        for (let k = 0; k < 6; k++) { const a = k * 1.05; m.box(Math.round(W / 2 + Math.cos(a) * 7), Math.round(D / 2 + Math.sin(a) * 7), 0, Math.round(W / 2 + Math.cos(a) * 7), Math.round(D / 2 + Math.sin(a) * 7), 0, 0x5a1a3a); }
        break;
      }
      default:
        m = new Model(W, D, 6); m.box(1, 1, 0, W - 2, D - 2, 5, 0x888888);
    }
    return m;
  }

  UB.Models = { humanoid, survivor, zombie, corpse, tree, bush, car, debris, crate, rock, fence, barrier, container, structure, underConstruction, damaged, poi, doorSide, ROLE_LOOK, tone };
})(globalThis.UB = globalThis.UB || {});
