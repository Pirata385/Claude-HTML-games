// Procedural arenas: one per floor of the Xenospire. A theme gives the palette,
// materials, sky and props; the generator builds the voxel floor, places props,
// picks spawn points and guarantees every spawn can reach the others.
(function (XS) {
  'use strict';

  const BASE = 5; // floor voxels occupy z = 0..4, so fighters stand at z = 5

  const THEMES = [
    {
      id: 'cristal', name: 'Jardim de Cristal', pattern: 'tiles', shapes: ['octagon', 'circle', 'rings'],
      sky: ['#070a24', '#1d1450', '#43226e'], nebula: ['#5b3a9e', '#b26bd6'], stars: '#efe6ff',
      body: { type: 'ringed', color: '#7fd8e8' }, tower: ['#141030', '#272055', '#ffd98a'], light: '#9ff6ff',
      mats: {
        plating: { kind: 'plating', color: '#2e2a48' }, sub: { kind: 'stone', color: '#8f88ad' },
        floorA: { kind: 'tile', color: '#c8c2df' }, floorB: { kind: 'tile', color: '#a59dc4' },
        accent: { kind: 'stone', color: '#6f6895' }, wall: { kind: 'stone', color: '#9b94bb' },
        prop1: { kind: 'crystal', color: '#66f0de' }, prop2: { kind: 'crystal', color: '#d68cff' },
        core: { kind: 'core', color: '#ffe066' }, crate: { kind: 'crystal', color: '#9fe8ff' }, trunk: { kind: 'stone', color: '#7a7398' },
      },
      props: { crystals: 4, pillar: 2, ruin: 1, core: 1, monolith: 0.5 },
      music: { root: 62, mode: 'lydian', bpm: 92 },
    },
    {
      id: 'forja', name: 'Forja de Plasma', pattern: 'checker', shapes: ['square', 'cross', 'octagon'],
      sky: ['#120406', '#3a0c12', '#7a1e14'], nebula: ['#a8321c', '#ff7a2a'], stars: '#ffd8b0',
      body: { type: 'sun', color: '#ff9a3a' }, tower: ['#160a0a', '#2e1612', '#ff8a3a'], light: '#ff9a4a',
      mats: {
        plating: { kind: 'plating', color: '#2a2222' }, sub: { kind: 'stone', color: '#4a3a36' },
        floorA: { kind: 'metal', color: '#5e5552' }, floorB: { kind: 'metal', color: '#4a403e' },
        accent: { kind: 'metal', color: '#7a6a60' }, wall: { kind: 'metal', color: '#665a55' },
        prop1: { kind: 'neon', color: '#ff7a2a' }, prop2: { kind: 'metal', color: '#8a7a70' },
        core: { kind: 'core', color: '#ffcf3a' }, crate: { kind: 'metal', color: '#80553a' }, trunk: { kind: 'metal', color: '#5a4a44' },
      },
      props: { pillar: 3, crate: 3, core: 2, ruin: 1, scrap: 1 },
      music: { root: 50, mode: 'phrygian', bpm: 118 },
    },
    {
      id: 'biblioteca', name: 'Biblioteca Congelada', pattern: 'tiles', shapes: ['square', 'octagon', 'cross'],
      sky: ['#030a1c', '#0d2448', '#24497a'], nebula: ['#3a7ac0', '#a8e0ff'], stars: '#e8f6ff',
      body: { type: 'moon', color: '#dfe9f5' }, tower: ['#0a1426', '#1c2e4c', '#bfe6ff'], light: '#cfefff',
      mats: {
        plating: { kind: 'plating', color: '#24324a' }, sub: { kind: 'stone', color: '#5d7290' },
        floorA: { kind: 'ice', color: '#bfe2f2' }, floorB: { kind: 'stone', color: '#93b4cc' },
        accent: { kind: 'stone', color: '#6d88a8' }, wall: { kind: 'wood', color: '#6a4a3a' },
        prop1: { kind: 'wood', color: '#b8483a' }, prop2: { kind: 'ice', color: '#d8f4ff' },
        core: { kind: 'core', color: '#8ff0ff' }, crate: { kind: 'ice', color: '#a8dcf0' }, trunk: { kind: 'wood', color: '#5a3e30' },
      },
      props: { shelf: 4, pillar: 2, crystals: 1, core: 1 },
      music: { root: 57, mode: 'dorian', bpm: 84 },
    },
    {
      id: 'fungos', name: 'Recife de Fungos', pattern: 'noise', organic: true, shapes: ['circle', 'islands', 'octagon'],
      sky: ['#04121a', '#0a2a33', '#14504f'], nebula: ['#1f8a7a', '#7ae0b0'], stars: '#d8fff0',
      body: { type: 'planet', color: '#e07ab8' }, tower: ['#081a1e', '#123236', '#7affd0'], light: '#8affd8',
      mats: {
        plating: { kind: 'plating', color: '#1e2a2e' }, sub: { kind: 'soil', color: '#4a2e4a' },
        floorA: { kind: 'soil', color: '#7a4a78' }, floorB: { kind: 'organic', color: '#5e8a4a' },
        accent: { kind: 'soil', color: '#9a5a8a' }, wall: { kind: 'organic', color: '#c8a8d8' },
        prop1: { kind: 'organic', color: '#ff6aa8' }, prop2: { kind: 'organic', color: '#4ae0e0' },
        core: { kind: 'core', color: '#b8ff6a' }, crate: { kind: 'organic', color: '#d8c890' }, trunk: { kind: 'organic', color: '#e8dcc0' },
      },
      props: { mushroom: 4, crystals: 1, core: 1 },
      music: { root: 55, mode: 'mixolydian', bpm: 100 },
    },
    {
      id: 'neon', name: 'Templo Neon', pattern: 'tiles', shapes: ['cross', 'square', 'rings'],
      sky: ['#06020e', '#14062a', '#2e0a4a'], nebula: ['#7a1a9a', '#ff3ab8'], stars: '#ffd8ff',
      body: { type: 'ringed', color: '#ff5ad0' }, tower: ['#0a0614', '#1a0e2e', '#ff4ad8'], light: '#ff6ae0',
      mats: {
        plating: { kind: 'plating', color: '#120c1e' }, sub: { kind: 'stone', color: '#2a2040' },
        floorA: { kind: 'tile', color: '#2c2440' }, floorB: { kind: 'neon', color: '#ff3ab8' },
        accent: { kind: 'stone', color: '#3a2e58' }, wall: { kind: 'stone', color: '#40325e' },
        prop1: { kind: 'neon', color: '#3af0ff' }, prop2: { kind: 'neon', color: '#ff3ab8' },
        core: { kind: 'core', color: '#ffe03a' }, crate: { kind: 'stone', color: '#5a4880' }, trunk: { kind: 'stone', color: '#3a2e58' },
      },
      props: { pillar: 3, monolith: 1, ruin: 2, core: 1 },
      music: { root: 52, mode: 'aeolian', bpm: 124 },
    },
    {
      id: 'ferro', name: 'Ferro-Velho Orbital', pattern: 'checker', shapes: ['square', 'islands', 'octagon'],
      sky: ['#0e0806', '#2a1a10', '#5a3a1e'], nebula: ['#a0602a', '#e0a050'], stars: '#ffe8c8',
      body: { type: 'planet', color: '#c87a3a' }, tower: ['#120c08', '#2a1e14', '#ffc060'], light: '#ffb060',
      mats: {
        plating: { kind: 'plating', color: '#2a2420' }, sub: { kind: 'metal', color: '#4a3e34' },
        floorA: { kind: 'metal', color: '#7a6a58' }, floorB: { kind: 'metal', color: '#5e4c3c' },
        accent: { kind: 'metal', color: '#9a5a2a' }, wall: { kind: 'metal', color: '#6a5a4a' },
        prop1: { kind: 'metal', color: '#b0703a' }, prop2: { kind: 'glass', color: '#8ad0c0' },
        core: { kind: 'core', color: '#ff8a3a' }, crate: { kind: 'metal', color: '#4a6a7a' }, trunk: { kind: 'metal', color: '#5a4a3a' },
      },
      props: { scrap: 4, crate: 3, pillar: 1, core: 2 },
      music: { root: 48, mode: 'dorian', bpm: 108 },
    },
    {
      id: 'pantano', name: 'Pântano Bioluminescente', pattern: 'noise', organic: true, shapes: ['circle', 'islands', 'rings'],
      sky: ['#020c08', '#06201a', '#0c3a2a'], nebula: ['#0e6a4a', '#3ae08a'], stars: '#d0ffe8',
      body: { type: 'moon', color: '#b8ffd8' }, tower: ['#04120c', '#0c2a1e', '#6affb0'], light: '#7affc0',
      mats: {
        plating: { kind: 'plating', color: '#10201a' }, sub: { kind: 'soil', color: '#24382a' },
        floorA: { kind: 'soil', color: '#3a5a3a' }, floorB: { kind: 'organic', color: '#2e4a30' },
        accent: { kind: 'soil', color: '#4a6a3a' }, wall: { kind: 'wood', color: '#4a3a2a' },
        prop1: { kind: 'neon', color: '#6affb0' }, prop2: { kind: 'organic', color: '#2a8a5a' },
        core: { kind: 'core', color: '#d0ff4a' }, crate: { kind: 'wood', color: '#5a4a2a' }, trunk: { kind: 'wood', color: '#3e2e20' },
      },
      props: { mushroom: 3, crystals: 2, ruin: 1, core: 1 },
      music: { root: 53, mode: 'aeolian', bpm: 88 },
    },
    {
      id: 'doce', name: 'Nebulosa Doce', pattern: 'checker', shapes: ['circle', 'octagon', 'islands'],
      sky: ['#1a0a2a', '#4a1a5a', '#c05a9a'], nebula: ['#ff8ad0', '#ffd0e8'], stars: '#ffffff',
      body: { type: 'planet', color: '#8af0d0' }, tower: ['#2a1030', '#5a2a5a', '#ffe0f0'], light: '#ffe0f8',
      mats: {
        plating: { kind: 'plating', color: '#4a2a5a' }, sub: { kind: 'jelly', color: '#c06ab0' },
        floorA: { kind: 'tile', color: '#ffd0e8' }, floorB: { kind: 'tile', color: '#a8f0e0' },
        accent: { kind: 'jelly', color: '#ff8ac0' }, wall: { kind: 'jelly', color: '#c8a0ff' },
        prop1: { kind: 'jelly', color: '#ff6a9a' }, prop2: { kind: 'jelly', color: '#8ae8ff' },
        core: { kind: 'core', color: '#fff07a' }, crate: { kind: 'jelly', color: '#ffb86a' }, trunk: { kind: 'jelly', color: '#f8f0e0' },
      },
      props: { mushroom: 2, crate: 3, crystals: 2, core: 1 },
      music: { root: 60, mode: 'major', bpm: 112 },
    },
    {
      id: 'observatorio', name: 'Observatório Dourado', pattern: 'rings', shapes: ['circle', 'rings', 'octagon'],
      sky: ['#02040e', '#0a1430', '#1a2a5a'], nebula: ['#2a4a9a', '#6a8ad8'], stars: '#fff6d8',
      body: { type: 'ringed', color: '#e8c070' }, tower: ['#080a18', '#161c34', '#ffe08a'], light: '#ffe9a8',
      mats: {
        plating: { kind: 'plating', color: '#1e2236' }, sub: { kind: 'stone', color: '#8a8aa0' },
        floorA: { kind: 'tile', color: '#e8e4d8' }, floorB: { kind: 'tile', color: '#c8a85a' },
        accent: { kind: 'stone', color: '#b8b4a8' }, wall: { kind: 'stone', color: '#d8d4c8' },
        prop1: { kind: 'metal', color: '#d8a83a' }, prop2: { kind: 'glass', color: '#8ac8ff' },
        core: { kind: 'core', color: '#fff0a0' }, crate: { kind: 'metal', color: '#a08050' }, trunk: { kind: 'stone', color: '#c8c4b8' },
      },
      props: { pillar: 4, monolith: 1, ruin: 1, core: 1 },
      music: { root: 59, mode: 'lydian', bpm: 96 },
    },
    {
      id: 'deserto', name: 'Deserto de Vidro', pattern: 'noise', organic: true, shapes: ['circle', 'octagon', 'square'],
      sky: ['#1a0e14', '#5a2a2a', '#d0784a'], nebula: ['#e09a5a', '#ffd0a0'], stars: '#fff0e0',
      body: { type: 'sun', color: '#ffd06a' }, tower: ['#1e1010', '#3e2420', '#ffc890'], light: '#ffd8a0',
      mats: {
        plating: { kind: 'plating', color: '#3a2a24' }, sub: { kind: 'soil', color: '#a0704a' },
        floorA: { kind: 'soil', color: '#e0b07a' }, floorB: { kind: 'soil', color: '#c8925a' },
        accent: { kind: 'stone', color: '#b07a5a' }, wall: { kind: 'stone', color: '#c89a6a' },
        prop1: { kind: 'glass', color: '#8af0e8' }, prop2: { kind: 'glass', color: '#ffb0d0' },
        core: { kind: 'core', color: '#ff6a3a' }, crate: { kind: 'stone', color: '#9a6a4a' }, trunk: { kind: 'stone', color: '#a87a5a' },
      },
      props: { crystals: 3, ruin: 3, pillar: 1, core: 1 },
      music: { root: 56, mode: 'phrygian', bpm: 98 },
    },
  ];

  // Shape masks in normalised coordinates (u, v in -1..1). `e` erodes edges.
  function inShape(shape, u, v, e) {
    const r = Math.hypot(u, v) + e;
    switch (shape) {
      case 'circle': return r <= 0.93;
      case 'square': return Math.max(Math.abs(u), Math.abs(v)) + e <= 0.9;
      case 'cross': return (Math.min(Math.abs(u), Math.abs(v)) + e <= 0.42 && Math.max(Math.abs(u), Math.abs(v)) <= 0.93) || r <= 0.6;
      case 'rings': {
        const bridge = Math.min(Math.abs(u), Math.abs(v)) <= 0.12 && r <= 0.93;
        return r <= 0.36 || (r >= 0.54 && r <= 0.93) || bridge;
      }
      case 'islands': {
        const c = [[0, 0, 0.36], [0.55, 0.5, 0.32], [-0.55, 0.5, 0.32], [0.55, -0.5, 0.32], [-0.55, -0.5, 0.32]];
        for (const [x, y, rr] of c) if (Math.hypot(u - x, v - y) + e <= rr) return true;
        // bridges from the centre island to the satellites
        for (const [x, y] of c.slice(1)) {
          const len = Math.hypot(x, y), t = Math.max(0, Math.min(1, (u * x + v * y) / (len * len)));
          if (Math.hypot(u - x * t, v - y * t) <= 0.1) return true;
        }
        return false;
      }
      default: // octagon
        return Math.abs(u) + Math.abs(v) + e <= 1.3 && Math.max(Math.abs(u), Math.abs(v)) + e <= 0.92;
    }
  }

  function generate(seed, floor, opts = {}) {
    const rng = new XS.RNG(XS.hash(seed, floor, 'arena'));
    const theme = opts.theme || THEMES[XS.hash(seed, floor, 'theme') % THEMES.length];
    const size = opts.size || (opts.big ? rng.int(104, 112) : rng.int(88, 100));
    const W = size, D = size, H = 20;
    const world = new XS.VoxelWorld(W, D, H);
    const M = {};
    for (const key of Object.keys(theme.mats)) M[key] = world.addMaterial(Object.assign({ key }, theme.mats[key]));

    const put = (x, y, z, m) => {
      if (!world.inside(x, y, z)) return;
      const i = world.idx(x, y, z);
      world.mat[i] = m; world.hp[i] = m ? 1 : 0;
    };
    const top = (x, y) => {
      for (let z = H - 1; z >= 0; z--) if (world.mat[world.idx(x, y, z)]) return z + 1;
      return 0;
    };

    // ---- floor ----
    const shape = opts.shape || rng.pick(theme.shapes);
    const cx = W / 2, cy = D / 2;
    const nseed = rng.int(0, 1 << 20);
    const inside = (x, y) => {
      const e = theme.organic ? (XS.noise2(x * 0.12, y * 0.12, nseed) - 0.5) * 0.14 : 0;
      return inShape(shape, (x + 0.5 - cx) / (W / 2), (y + 0.5 - cy) / (D / 2), e);
    };
    const pattern = (x, y) => {
      switch (theme.pattern) {
        case 'checker': return ((x >> 1) + (y >> 1)) & 1 ? M.floorA : M.floorB;
        case 'noise': return XS.noise2(x * 0.17, y * 0.17, nseed + 7) > 0.56 ? M.floorB : M.floorA;
        case 'rings': return Math.floor(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / 2.5) % 2 ? M.floorB : M.floorA;
        default: return (x % 4 === 0 || y % 4 === 0) ? M.floorB : M.floorA;
      }
    };
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue;
        put(x, y, 0, M.plating);
        for (let z = 1; z < BASE - 1; z++) put(x, y, z, M.sub);
        put(x, y, BASE - 1, pattern(x, y));
      }
    }

    // ---- rolling hills: terraces one voxel apart, always walkable ----
    const raise = (x, y, m) => { const t = top(x, y); if (t) put(x, y, t, m); };
    const hseed = rng.int(0, 1 << 20), hk = rng.range(0.035, 0.055);
    const lv = new Int8Array(W * D);
    for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
      if (top(x, y) !== BASE || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 7) continue;
      const n = XS.noise2(x * hk, y * hk, hseed);
      lv[x + y * W] = n > 0.68 ? 1 + (n > 0.77 ? 1 : 0) : 0;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 1; y < D - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = x + y * W;
        lv[i] = Math.min(lv[i], lv[i - 1] + 1, lv[i + 1] + 1, lv[i - W] + 1, lv[i + W] + 1);
      }
    }
    for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) for (let k = 0; k < lv[x + y * W]; k++) raise(x, y, k === lv[x + y * W] - 1 ? M.accent : M.sub);

    // ---- ravines through organic floors: a void core with a sunken lip ----
    if (theme.organic && rng.chance(0.75)) {
      const rseed = rng.int(0, 1 << 20);
      for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
        if (!top(x, y) || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 10) continue;
        const d = Math.abs(XS.noise2(x * 0.03, y * 0.03, rseed) - 0.5);
        if (d < 0.014) for (let z = 0; z < H; z++) put(x, y, z, 0);
        else if (d < 0.022) for (let z = BASE - 1; z < H; z++) put(x, y, z, 0);
      }
    }

    // ---- a landmark at the centre: a fortress ring with four gates, or a dais ----
    if (!theme.organic && rng.chance(0.55)) {
      const R = rng.int(7, 9), rot = rng.chance(0.5) ? 0 : Math.PI / 4;
      for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++) for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (Math.abs(d - R) > 0.6 || top(x, y) !== BASE) continue;
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx) - rot;
        const gate = Math.abs(Math.sin(a * 2)) < 0.38; // four wide openings
        if (gate) continue;
        const h = 3 + ((x + y) % 2 === 0 ? 1 : 0); // crenellations
        for (let k = 0; k < h; k++) put(x, y, BASE + k, k === h - 1 ? M.accent : M.wall);
      }
    }
    if (rng.chance(0.5)) {
      for (let y = 0; y < D; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (top(x, y) !== BASE) continue;
          if (d <= 3.2) raise(x, y, M.accent);
          if (d <= 1.6) raise(x, y, M.floorB);
        }
      }
    }

    // ---- spawns (before props, so props keep clear of them) ----
    const nf = opts.fighters || 2;
    world.refreshAll();
    const spawns = [];
    const a0 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < nf; i++) {
      const a = a0 + (i / nf) * Math.PI * 2;
      // Duels start ~24 voxels apart near the middle; free-for-alls spread out.
      const rr = nf === 2 ? 12 : Math.min(size * 0.28, 12 + nf * 3);
      spawns.push(world.findSafeSpot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 6, rng));
    }

    // ---- props ----
    const placed = [];
    const freeAt = (x, y, clear) => {
      for (const s of spawns) if (Math.hypot(x - s.x, y - s.y) < clear) return false;
      for (const p of placed) if (Math.hypot(x - p.x, y - p.y) < p.r) return false;
      return true;
    };
    const column = (x, y, h, m) => { const t = top(x, y); if (!t) return; for (let k = 0; k < h; k++) put(x, y, t + k, m); };
    const PROPS = {
      pillar(x, y) {
        const s = rng.int(2, 3), h = rng.int(3, 6), broken = rng.chance(0.35);
        for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
          const hh = broken ? Math.max(2, h - rng.int(0, 4)) : h;
          column(x + i, y + j, hh, M.wall);
          if (!broken) { const t = top(x + i, y + j); put(x + i, y + j, t - 1, M.accent); }
        }
        return 3;
      },
      ruin(x, y) {
        const horiz = rng.chance(0.5), len = rng.int(4, 7), hmax = rng.int(2, 3);
        for (let i = 0; i < len; i++) {
          if (rng.chance(0.15)) continue;
          const h = hmax - (rng.chance(0.3) ? rng.int(1, 2) : 0);
          column(horiz ? x + i : x, horiz ? y : y + i, Math.max(1, h), M.wall);
        }
        return len * 0.6 + 1;
      },
      crystals(x, y) {
        const n = rng.int(3, 6);
        for (let k = 0; k < n; k++) {
          const ox = rng.int(-2, 2), oy = rng.int(-2, 2), h = rng.int(2, 5), m = rng.chance(0.5) ? M.prop1 : M.prop2;
          if (h >= 5) { column(x + ox + 1, y + oy, 2, m); column(x + ox, y + oy + 1, 2, m); }
          column(x + ox, y + oy, h, m);
        }
        return 3.5;
      },
      mushroom(x, y) {
        const th = rng.int(2, 3), rc = rng.range(1.8, 2.7), m = rng.chance(0.5) ? M.prop1 : M.prop2;
        column(x, y, th, M.trunk);
        const t = top(x, y);
        for (let z = 0; z <= Math.ceil(rc * 0.6); z++) {
          for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
            if (Math.hypot(i / rc, j / rc, z / (rc * 0.6)) > 1) continue;
            put(x + i, y + j, t + z - 1, m);
          }
        }
        return 4;
      },
      crate(x, y) {
        const s = rng.chance(0.6) ? 2 : 1;
        for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) column(x + i, y + j, s, M.crate);
        if (rng.chance(0.5)) column(x + s, y, 1, M.crate);
        return 2.5;
      },
      core(x, y) {
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) column(x + i, y + j, 1, M.accent);
        column(x, y, 2, M.core);
        return 3;
      },
      shelf(x, y) {
        const horiz = rng.chance(0.5), len = rng.int(4, 6);
        for (let i = 0; i < len; i++) {
          const xx = horiz ? x + i : x, yy = horiz ? y : y + i;
          const t = top(xx, yy);
          if (!t) continue;
          for (let k = 0; k < 3; k++) put(xx, yy, t + k, k === 1 && rng.chance(0.7) ? (rng.chance(0.5) ? M.prop1 : M.prop2) : M.wall);
        }
        return len * 0.6 + 1;
      },
      scrap(x, y) {
        const r = rng.range(2, 3);
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
          const d = Math.hypot(i, j);
          if (d > r) continue;
          const h = Math.round((1 - d / r) * rng.range(1.5, 4));
          for (let k = 0; k < h; k++) column(x + i, y + j, 1, rng.pick([M.wall, M.crate, M.prop1, M.accent]));
        }
        return 3.5;
      },
      monolith(x, y) {
        const h = rng.int(5, 7);
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) column(x + i, y + j, h, M.prop1);
        return 3;
      },
    };
    const kinds = Object.keys(theme.props).map((k) => ({ k, w: theme.props[k] }));
    // Few props, far apart: wide lanes to fight in and less to hide the action.
    const target = Math.round(size * 0.13) + (opts.big ? 2 : 0);
    let tries = 0;
    while (placed.length < target && tries++ < 1200) {
      const x = rng.int(3, W - 4), y = rng.int(3, D - 4);
      if (top(x, y) < BASE || !freeAt(x, y, 9) || Math.hypot(x - cx, y - cy) < 11) continue;
      const kind = rng.weighted(kinds).k;
      const r = PROPS[kind](x, y);
      placed.push({ x, y, r: r + 7, kind });
    }

    world.refreshAll();
    ensureConnected(world, spawns, M, pattern);
    world.refreshAll();
    world.needsSupport = false;

    return {
      world, theme, shape, spawns, size, M,
      center: { x: cx, y: cy, z: world.topAt(cx, cy) === -Infinity ? BASE : world.topAt(cx, cy) },
      name: theme.name,
    };
  }

  // Columns reachable from (sx, sy) walking with steps of at most 1 voxel.
  function reachableFrom(world, sx, sy) {
    const { W, D, colTop } = world;
    const seen = new Uint8Array(W * D);
    const start = Math.floor(sx) + Math.floor(sy) * W;
    if (!colTop[start]) return seen;
    const q = [start];
    seen[start] = 1;
    while (q.length) {
      const c = q.pop();
      const x = c % W, y = Math.floor(c / W);
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
        const n = nx + ny * W;
        if (seen[n] || !colTop[n] || Math.abs(colTop[n] - colTop[c]) > 1) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
    return seen;
  }

  // Carve 3-wide corridors at floor height until every spawn reaches spawn 0.
  function ensureConnected(world, spawns, M, pattern) {
    for (let pass = 0; pass < 3; pass++) {
      const seen = reachableFrom(world, spawns[0].x, spawns[0].y);
      let ok = true;
      for (let i = 1; i < spawns.length; i++) {
        const s = spawns[i];
        if (seen[Math.floor(s.x) + Math.floor(s.y) * world.W]) continue;
        ok = false;
        carve(world, spawns[0], s, M, pattern);
      }
      if (ok) return true;
      world.refreshAll();
    }
    return false;
  }

  function carve(world, a, b, M, pattern) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 3);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x0 = Math.floor(a.x + (b.x - a.x) * t), y0 = Math.floor(a.y + (b.y - a.y) * t);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const x = x0 + ox, y = y0 + oy;
          if (!world.inside(x, y, 0)) continue;
          for (let z = 0; z < world.H; z++) {
            const i = world.idx(x, y, z);
            const m = z === 0 ? M.plating : z < BASE - 1 ? M.sub : z === BASE - 1 ? pattern(x, y) : 0;
            world.mat[i] = m; world.hp[i] = m ? 1 : 0;
          }
        }
      }
    }
  }

  XS.Arena = { THEMES, BASE, generate, reachableFrom, inShape };
})(globalThis.XS = globalThis.XS || {});
