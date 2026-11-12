// Amalgamations — infinite seeded world generation (pure: no rendering).
// The ground is flat. Chunks are 32×32 m (16×16 tiles of 2 m). Structures are placed per 256 m region.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const CHUNK = 32, TILE = 2, TILES = CHUNK / TILE, REGION = 256;

  const BIOMES = [
    { id: 'meadow', name: 'Meadow', ground: ['#7fbf5a', '#89c862', '#76b552', '#93cf6a'], fog: '#cfe8f2',
      props: { tree: 0.03, bush: 0.012, flowers: 0.06, rock: 0.01, log: 0.004, grass: 0.12 },
      ores: { iron: 0.0022, stone: 0.003 },
      spawns: { wolf: 3, frog: 3, eagle: 2, turtle: 2, mushroom: 1.5, toaster: 1, rhino: 1, chameleon: 1, elephant: 0.6 } },
    { id: 'forest', name: 'Forest', ground: ['#4f8f44', '#5a9a4c', '#467f3c', '#55943f'], fog: '#bfd9c8',
      props: { tree: 0.13, pine: 0.05, bush: 0.02, mushroomS: 0.02, log: 0.01, rock: 0.008, grass: 0.1 },
      ores: { iron: 0.002, stone: 0.002 },
      spawns: { wolf: 3, chameleon: 2, mushroom: 2, bat: 2, frog: 1, eagle: 1, lantern: 1, chest: 0.6, octopus: 0.6 } },
    { id: 'desert', name: 'Desert', ground: ['#e3c987', '#d9bd78', '#eed49a', '#dfc380'], fog: '#f3e3bf',
      props: { cactus: 0.03, deadbush: 0.016, rock: 0.02, bones: 0.006 },
      ores: { goldore: 0.003, stone: 0.003 },
      spawns: { scorpion: 3, cactus: 3, rhino: 2, eagle: 1, rocket: 1, chest: 1, toaster: 1, teapot: 0.5 } },
    { id: 'tundra', name: 'Tundra', ground: ['#e8f1f5', '#dbe8ee', '#f4f8fa', '#d3e3ea'], fog: '#e6f0f6',
      props: { pineSnow: 0.05, iceSpike: 0.02, rock: 0.016, grass: 0.02 },
      ores: { iron: 0.0028, crystal: 0.0012 },
      spawns: { wolf: 2, golem: 2, elephant: 2, eagle: 1, ghost: 1, lantern: 1, teapot: 1, turtle: 0.6 } },
    { id: 'swamp', name: 'Swamp', ground: ['#5d7a4a', '#536e42', '#6a8452', '#4f6a40'], fog: '#b9c7a8',
      props: { deadtree: 0.04, reeds: 0.06, mushroomS: 0.03, bush: 0.02, log: 0.008, grass: 0.06 },
      ores: { stone: 0.002 },
      spawns: { frog: 3, octopus: 2, slime: 3, mushroom: 2, chameleon: 1, turtle: 2, ghost: 1 } },
    { id: 'grove', name: 'Mushroom Grove', ground: ['#7a6aa8', '#6d5e9a', '#8676b6', '#715fa0'], fog: '#c8bde6',
      props: { giantShroom: 0.06, mushroomS: 0.05, glowShroom: 0.02, bush: 0.012 },
      ores: { crystal: 0.002 },
      spawns: { mushroom: 3, slime: 2, eye: 2, ghost: 2, bat: 2, octopus: 1, lantern: 0.6 } },
    { id: 'crystal', name: 'Crystal Fields', ground: ['#9ec5d6', '#8db5c8', '#b0d4e2', '#97bfd1'], fog: '#d6ecf5',
      props: { crystal: 0.05, rock: 0.02, grass: 0.02 },
      ores: { crystal: 0.004, goldore: 0.0015 },
      spawns: { golem: 3, eye: 2, lantern: 2, rocket: 1, ghost: 1, dragon: 0.5, teapot: 1, chest: 1 } },
    { id: 'volcanic', name: 'Volcanic Wastes', ground: ['#3d3330', '#4a3d38', '#2f2826', '#45362f'], fog: '#5a4038',
      props: { lavarock: 0.035, vent: 0.008, deadtree: 0.01, rock: 0.015 },
      ores: { goldore: 0.003, iron: 0.003 },
      spawns: { dragon: 2, golem: 2, toaster: 2, rocket: 2, rhino: 1, scorpion: 1, lantern: 1 } },
  ];
  const BIOME_INDEX = {};
  BIOMES.forEach((b, i) => { b.index = i; BIOME_INDEX[b.id] = i; });

  // Props: solid = collision radius (0 = walk through). interact = what the action button does.
  const PROPS = {
    tree: { solid: 0.5 }, pine: { solid: 0.45 }, pineSnow: { solid: 0.45 }, deadtree: { solid: 0.35 }, cactus: { solid: 0.4 },
    bush: { solid: 0, interact: 'herb' }, flowers: { solid: 0 }, grass: { solid: 0 }, reeds: { solid: 0 }, deadbush: { solid: 0 },
    rock: { solid: 0.7 }, log: { solid: 0.5, interact: 'wood' }, bones: { solid: 0 }, iceSpike: { solid: 0.4 },
    mushroomS: { solid: 0 }, giantShroom: { solid: 0.6 }, glowShroom: { solid: 0 }, crystal: { solid: 0.5 },
    lavarock: { solid: 0.6 }, vent: { solid: 0.6 }, ore: { solid: 0.7, interact: 'mine' },
  };

  const VILLAGE_A = ['Ash', 'Brook', 'Clay', 'Dun', 'Elm', 'Fern', 'Glen', 'Hazel', 'Iron', 'Juni', 'Kel', 'Lark', 'Moss', 'North', 'Oak', 'Pine', 'Quill', 'Rook', 'Sand', 'Thorn', 'Umber', 'Vale', 'Wil', 'Yew'];
  const VILLAGE_B = ['ford', 'moor', 'wick', 'dale', 'stead', 'holm', 'bury', 'field', 'haven', 'ridge', 'well', 'mere', 'crest', 'hollow'];
  const STRUCT_R = { village: 24, ruin: 12, cave: 6, dungeon: 7, camp: 9, chest: 2, shrine: 4 };

  function createWorld(seed) {
    seed = seed >>> 0;
    const nT = AM.createNoise2D(seed ^ 0x1a2b), nM = AM.createNoise2D(seed ^ 0x3c4d), nW = AM.createNoise2D(seed ^ 0x5e6f);
    const nL = AM.createNoise2D(seed ^ 0x7081), nR = AM.createNoise2D(seed ^ 0x92a3), nD = AM.createNoise2D(seed ^ 0xb4c5);
    const nB = AM.createNoise2D(seed ^ 0xd6e7);
    const regionCache = new Map();

    function biomeAt(x, z) {
      const d = Math.hypot(x, z);
      if (d < 120 + 30 * nB(x / 60, z / 60)) return 0;
      const t = AM.fbm(nT, x / 650, z / 650, 3), m = AM.fbm(nM, x / 560 + 50, z / 560 - 30, 3), w = AM.fbm(nW, x / 800, z / 800, 2);
      const far = AM.clamp((d - 400) / 1400, 0, 1);
      if (d > 450 && w > 0.36 - 0.2 * far) return t > 0.02 ? 5 : 6;
      if (d > 700 && t > 0.36 - 0.14 * far && m < 0.06) return 7;
      if (t > 0.2 && m < 0) return 2;
      if (t < -0.24) return 3;
      if (m > 0.26) return 4;
      if (m > -0.02) return 1;
      return 0;
    }
    // 0 dry, 1 shallow (walkable, slower), 2 deep (blocks); in volcanic biomes deep water is lava.
    function rawWater(x, z) {
      const d = Math.hypot(x, z);
      if (d < 70) return 0;
      const b = biomeAt(x, z);
      const lake = AM.fbm(nL, x / 170, z / 170, 2);
      const riv = Math.abs(AM.fbm(nR, x / 520, z / 520, 2));
      const rk = b === 2 ? 0.5 : 1;
      const shallowLake = b === 4 ? 0.22 : 0.42;
      if (lake > 0.52 || riv < 0.011 * rk) return 2;
      if (lake > shallowLake || riv < 0.024 * rk) return 1;
      return 0;
    }
    function waterAt(x, z) {
      const w = rawWater(x, z);
      if (!w) return 0;
      const s = structureAt(x, z, 2);
      return s ? 0 : w;
    }
    function dangerAt(x, z) {
      const d = Math.hypot(x, z);
      if (d < 100) return 1;
      return Math.max(1, 1 + Math.floor(d / 90 + nD(x / 300, z / 300) * 0.8));
    }

    // ---------- structures ----------
    function villageName(rng) { return rng.pick(VILLAGE_A) + rng.pick(VILLAGE_B); }
    function region(rx, rz) {
      const key = rx + ',' + rz;
      if (regionCache.has(key)) return regionCache.get(key);
      const rng = AM.makeRng(AM.hash2(rx, rz, seed ^ 0x5157));
      const list = [];
      const ox = rx * REGION, oz = rz * REGION;
      const dReg = Math.hypot(ox + REGION / 2, oz + REGION / 2);
      const far = AM.clamp(dReg / 2500, 0, 1);
      const place = (type, fixed) => {
        const r = STRUCT_R[type];
        for (let tries = 0; tries < 8; tries++) {
          const x = fixed ? fixed[0] : ox + 26 + rng.next() * (REGION - 52);
          const z = fixed ? fixed[1] : oz + 26 + rng.next() * (REGION - 52);
          if (!fixed) {
            if (rawWater(x, z) || rawWater(x + r * 0.7, z) || rawWater(x - r * 0.7, z) || rawWater(x, z + r * 0.7) || rawWater(x, z - r * 0.7)) continue;
            if (list.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r + 10)) continue;
          }
          const id = `${type}:${rx}:${rz}:${list.length}`;
          const biome = BIOMES[biomeAt(x, z)].id;
          const s = { id, type, x, z, r, biome, level: dangerAt(x, z) + (type === 'dungeon' ? 2 : 0), seed: AM.hash2(Math.floor(x), Math.floor(z), seed) };
          if (type === 'village') s.name = fixed ? 'Hearthmoor' : villageName(rng);
          if (type === 'dungeon') s.name = rng.pick(['Sunken', 'Hollow', 'Forgotten', 'Howling', 'Ashen', 'Gloom', 'Rotting', 'Shattered']) + ' ' + rng.pick(['Crypt', 'Vault', 'Halls', 'Sanctum', 'Den', 'Warren', 'Keep', 'Pit']);
          if (type === 'cave') s.name = rng.pick(['Damp', 'Glittering', 'Echoing', 'Narrow', 'Mossy', 'Deep']) + ' Cave';
          list.push(s);
          return s;
        }
        return null;
      };
      if (rx === 0 && rz === 0) {
        place('village', [0, 0]);
        place('cave', [62, 48]);
        place('ruin', [-70, 55]);
        place('chest', [30, -60]);
        place('camp', [-45, -80]);
      } else if (rx === -1 && rz === -1) {
        place('dungeon', [-110, -120]);
        if (rng.chance(0.5)) place('ruin');
      } else {
        const nearSpawn = dReg < 380;
        if (!nearSpawn && rng.chance(0.3)) place('village');
        if (rng.chance(0.5)) place('ruin');
        if (rng.chance(0.55)) place('cave');
        if (rng.chance(0.28 + 0.25 * far)) place('dungeon');
        if (rng.chance(0.6)) place('camp');
        if (rng.chance(0.5)) place('chest');
        if (rng.chance(0.4)) place('chest');
        if (rng.chance(0.22)) place('shrine');
      }
      regionCache.set(key, list);
      return list;
    }
    function structuresNear(x, z, radius) {
      const out = [];
      const r0x = Math.floor((x - radius) / REGION), r1x = Math.floor((x + radius) / REGION);
      const r0z = Math.floor((z - radius) / REGION), r1z = Math.floor((z + radius) / REGION);
      for (let rx = r0x; rx <= r1x; rx++) for (let rz = r0z; rz <= r1z; rz++) {
        for (const s of region(rx, rz)) if (Math.hypot(s.x - x, s.z - z) <= radius + s.r) out.push(s);
      }
      return out;
    }
    function structureAt(x, z, pad) {
      const rx = Math.floor(x / REGION), rz = Math.floor(z / REGION);
      for (const s of region(rx, rz)) if (Math.hypot(s.x - x, s.z - z) < s.r + (pad || 0)) return s;
      return null;
    }

    // ---------- chunks ----------
    function chunk(cx, cz) {
      const ox = cx * CHUNK, oz = cz * CHUNK;
      const biome = new Uint8Array(TILES * TILES), water = new Uint8Array(TILES * TILES), shade = new Uint8Array(TILES * TILES);
      const props = [];
      const structs = structuresNear(ox + CHUNK / 2, oz + CHUNK / 2, CHUNK * 0.75);
      for (let tz = 0; tz < TILES; tz++) for (let tx = 0; tx < TILES; tx++) {
        const i = tz * TILES + tx;
        const x = ox + tx * TILE + TILE / 2, z = oz + tz * TILE + TILE / 2;
        const b = biomeAt(x, z);
        biome[i] = b;
        water[i] = waterAt(x, z);
        shade[i] = AM.hash2(cx * TILES + tx, cz * TILES + tz, seed) & 3;
        if (water[i] === 2) continue;
        const rng = AM.makeRng(AM.hash2(cx * TILES + tx, cz * TILES + tz, seed ^ 0x777));
        const inStruct = structs.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + 1);
        const B = BIOMES[b];
        if (!inStruct && !water[i]) {
          for (const ore in B.ores) {
            if (rng.next() < B.ores[ore]) { props.push({ t: 'ore', ore, x: x + rng.range(-0.5, 0.5), z: z + rng.range(-0.5, 0.5), r: rng.next() * 6.28, s: rng.range(0.85, 1.15), id: `o:${cx}:${cz}:${i}` }); break; }
          }
        }
        for (const t in B.props) {
          let dens = B.props[t];
          if (water[i] === 1 && t !== 'reeds') dens *= 0.15;
          if (inStruct && PROPS[t].solid) continue;
          if (inStruct) dens *= 0.3;
          if (rng.next() < dens) {
            const p = { t, x: x + rng.range(-0.8, 0.8), z: z + rng.range(-0.8, 0.8), r: rng.next() * 6.28, s: rng.range(0.8, 1.25) };
            if (PROPS[t].interact) p.id = `${t[0]}:${cx}:${cz}:${i}`;
            props.push(p);
            if (PROPS[t].solid) break;
          }
        }
      }
      return { cx, cz, biome, water, shade, props, structs };
    }

    // ---------- layouts of structures (deterministic) ----------
    function villageLayout(s) {
      const rng = AM.makeRng(s.seed ^ 0x11);
      const houses = [];
      const n = 5 + rng.int(0, 3);
      const roofs = ['#b5523b', '#4f6fa8', '#7a5a9a', '#3f8a5a', '#a8743b'];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.15, 0.15) + 0.4;
        const rad = 14 + rng.range(-1.5, 2.5);
        const w = rng.range(4.2, 6), d = rng.range(4, 5.5);
        houses.push({ x: s.x + Math.cos(a) * rad, z: s.z + Math.sin(a) * rad, w, d, rot: -a + Math.PI / 2, h: rng.range(2.6, 3.4), roof: rng.pick(roofs), wall: rng.pick(['#e9dcc0', '#d8c7a4', '#efe6d4', '#cdb894']) });
      }
      const npcs = [
        { role: 'elder', name: 'Elder', x: s.x - 4, z: s.z + 5 },
        { role: 'merchant', name: 'Merchant', x: s.x + 6, z: s.z + 3 },
        { role: 'smith', name: 'Blacksmith', x: s.x - 6, z: s.z - 3 },
        { role: 'lab', name: 'Lab Keeper', x: s.x + 3, z: s.z - 7 },
      ];
      return {
        houses, npcs,
        well: { x: s.x, z: s.z },
        obelisk: { x: s.x + 7, z: s.z - 1.5 },
        lab: { x: s.x + 3, z: s.z - 9.5 },
        forge: { x: s.x - 8.5, z: s.z - 3 },
        stall: { x: s.x + 8.5, z: s.z + 4 },
        lamps: [0, 1, 2, 3, 4, 5].map((i) => ({ x: s.x + Math.cos(i * 1.05) * 9.5, z: s.z + Math.sin(i * 1.05) * 9.5 })),
      };
    }
    function ruinLayout(s) {
      const rng = AM.makeRng(s.seed ^ 0x22);
      const pillars = [];
      const n = 6 + rng.int(0, 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (rng.chance(0.2)) continue;
        pillars.push({ x: s.x + Math.cos(a) * 8, z: s.z + Math.sin(a) * 8, h: rng.chance(0.4) ? rng.range(0.8, 1.8) : rng.range(2.6, 4) });
      }
      const walls = [];
      for (let i = 0; i < 3; i++) { const a = rng.next() * 6.28; walls.push({ x: s.x + Math.cos(a) * 5, z: s.z + Math.sin(a) * 5, rot: a, w: rng.range(2.5, 4.5), h: rng.range(1, 2.2) }); }
      return { pillars, walls, chest: { x: s.x, z: s.z, id: 'c:' + s.id }, lore: { x: s.x + 3, z: s.z + 2.5, id: 'l:' + s.id } };
    }
    function campLayout(s) {
      const rng = AM.makeRng(s.seed ^ 0x33);
      const tents = [];
      const n = 2 + rng.int(0, 1);
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rng.next(); tents.push({ x: s.x + Math.cos(a) * 4.5, z: s.z + Math.sin(a) * 4.5, rot: -a, c: rng.pick(['#a8743b', '#7a4a3a', '#6a7a4a']) }); }
      return { tents, fire: { x: s.x, z: s.z }, pack: 3 + rng.int(0, 2), elite: rng.chance(0.35) };
    }

    // ---------- wild creatures ----------
    function rollWild(rng, biomeIndex, level) {
      const sp = BIOMES[biomeIndex].spawns;
      const ids = Object.keys(sp);
      const a = rng.weighted(ids, (k) => sp[k]);
      const b = rng.chance(0.14) ? a : rng.weighted(ids, (k) => (k === a ? 0 : sp[k]));
      const variant = rng.int(0, 5);
      const elite = rng.chance(0.045);
      const lvl = Math.max(1, level + rng.int(-1, 1));
      return { mother: a, father: b, variant, level: lvl, rank: elite ? 'elite' : 'normal', affix: elite ? rng.pick(ELITE_AFFIXES) : null };
    }
    function villagesNear(x, z, radius) { return structuresNear(x, z, radius).filter((s) => s.type === 'village'); }

    return {
      seed, biomeAt, waterAt, rawWater, dangerAt, region, structuresNear, structureAt, chunk,
      villageLayout, ruinLayout, campLayout, rollWild, villagesNear,
    };
  }
  const ELITE_AFFIXES = [
    { id: 'vampiric', name: 'Vampiric', desc: 'Heals when it hits.' },
    { id: 'explosive', name: 'Explosive', desc: 'Explodes when it dies.' },
    { id: 'swift', name: 'Swift', desc: 'Moves and attacks faster.' },
    { id: 'armoured', name: 'Armoured', desc: 'Takes much less damage.' },
    { id: 'frenzied', name: 'Frenzied', desc: 'Hits harder as it gets hurt.' },
    { id: 'arcane', name: 'Arcane', desc: 'Casts powers more often.' },
  ];

  Object.assign(AM, { CHUNK, TILE, TILES, REGION, BIOMES, BIOME_INDEX, PROPS, STRUCT_R, ELITE_AFFIXES, createWorld });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
