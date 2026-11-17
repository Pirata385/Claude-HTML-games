// world.js — the overworld, built from the save's seed: biomes as smooth blobs, a sea, ponds, the
// sites (shops, arenas, lab, BFC, houses), roads, what lives where and what is buried where.
// No DOM: the map scene draws what this describes.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, hash2, TAU } = RB.core;

  const W = 12000, H = 8000, CELL = 96;
  const BIOMES = {
    farm: { name: 'Farmland', ground: '#b9cf7a', dark: '#a6c067', slow: 1 },
    wetland: { name: 'Wetland', ground: '#8fbf8a', dark: '#79ad79', slow: 0.62 },
    savanna: { name: 'Savanna', ground: '#e3c878', dark: '#d4b663', slow: 0.8 },
    highlands: { name: 'Highlands', ground: '#b7b9a4', dark: '#a3a590', slow: 0.85 },
    coast: { name: 'Coast', ground: '#efdfae', dark: '#e3d09a', slow: 0.7 },
    jungle: { name: 'Jungle', ground: '#5fa56b', dark: '#4f945c', slow: 0.7 },
    water: { name: 'Water', ground: '#6fc3d6', dark: '#5fb3c8', slow: 0.3 },
    town: { name: 'Town', ground: '#d9cdb4', dark: '#cbbd9f', slow: 1 },
  };
  // Who turns up where: [species, weight]. By day the day list; after dark the night list takes
  // over (the day birds roost and the night birds come out in their place).
  const FAUNA = {
    farm: { day: [['chicken', 30], ['bantam', 10], ['quail', 12], ['pheasant', 8], ['turkey', 6], ['gamecock', 3], ['raven', 8], ['duck', 5], ['goose', 4]], night: [['owl', 14], ['nightjar', 10]] },
    wetland: { day: [['duck', 25], ['goose', 14], ['swan', 6], ['heron', 14], ['flamingo', 8], ['pelican', 4], ['raven', 3]], night: [['owl', 8], ['kiwi', 6], ['heron', 5], ['nightjar', 4]] },
    savanna: { day: [['ostrich', 10], ['emu', 8], ['roadrunner', 14], ['secretary', 5], ['vulture', 10], ['quail', 10], ['turkey', 4]], night: [['owl', 8], ['nightjar', 12]] },
    highlands: { day: [['falcon', 12], ['eagle', 7], ['vulture', 10], ['raven', 14], ['pheasant', 8], ['condor', 4]], night: [['owl', 20], ['nightjar', 5]] },
    coast: { day: [['gull', 30], ['pelican', 12], ['penguin', 8], ['flamingo', 8], ['heron', 6]], night: [['owl', 4], ['penguin', 6], ['kiwi', 3], ['gull', 3]] },
    jungle: { day: [['parrot', 14], ['toucan', 12], ['peafowl', 8], ['cassowary', 4], ['hummingbird', 12], ['pheasant', 4], ['harpy', 3]], night: [['kiwi', 16], ['owl', 8], ['potoo', 12]] },
    town: { day: [['chicken', 10], ['raven', 10], ['gull', 4]], night: [['owl', 6], ['nightjar', 4]] },
  };
  const FOSSIL_BIOME = { coast: 'dodo', savanna: 'terror', jungle: 'moa', wetland: 'archaeo', highlands: 'raptor' };

  function blob(r, x, y, R) {
    const harm = [];
    for (let k = 2; k <= 5; k++) harm.push([k, r.range(0.04, 0.13) / Math.sqrt(k - 1), r.range(0, TAU)]);
    return { x, y, R, harm };
  }
  function blobR(b, th) { let s = 1; for (const h of b.harm) s += h[1] * Math.sin(h[0] * th + h[2]); return b.R * s; }
  function inBlob(b, x, y) {
    const dx = x - b.x, dy = y - b.y, d2 = dx * dx + dy * dy;
    if (d2 > b.R * b.R * 1.7) return false;
    const r = blobR(b, Math.atan2(dy, dx));
    return d2 < r * r;
  }

  const SITES = [
    // id, kind, name, x, y
    ['home', 'home', 'Home Coop', 5600, 4400], ['feed', 'shop', 'Feed & Seed', 6080, 4120], ['tools', 'shop', 'Net & Spade', 6520, 4480], ['bfc', 'bfc', 'BFC', 6960, 4040],
    ['garage', 'garage', 'Biu\'s Garage', 7300, 4500], ['hatter', 'shop', 'Odete\'s Hats', 7680, 4430], ['vet', 'vet', 'Dr. Ivo, Vet', 7940, 4760], ['bank', 'bank', 'Big Wattle Loans', 7500, 5020],
    ['city', 'arena', 'City Arena', 8040, 5180], ['backyard', 'arena', 'Backyard Pit', 5100, 4880], ['county', 'arena', 'County Ring', 8950, 3300], ['carnival', 'carnival', 'Sideshow', 9850, 4250],
    ['lab', 'lab', 'The Lab', 3950, 3050], ['cellar', 'arena', 'The Cellar', 2450, 6250], ['grand', 'arena', 'Grand Ring', 6000, 1150], ['market', 'shop', 'Night Market', 4350, 6820],
  ];
  // Opened after the first release: id, kind, name, x, y, road, keeper [name, sex, hat]
  // keeper: [name, sex, hat, role (default 'keeper')]
  const LATER = [['roost', 'roost', 'Sunset Roost', 4880, 4120, ['home', 'roost'], ['Dona Nina', 'F', null]],
    ['oddities', 'exotic', 'Curio Aviary', 7120, 5300, ['bank', 'oddities'], ['Madame Zuleica', 'F', 'tophat', 'exotic']]];
  const HOUSES = [[5050, 3700], [4500, 4500], [6400, 5250], [5800, 5600], [6700, 3500], [9700, 2500], [10300, 3500], [2700, 2700], [2900, 5300], [5600, 6700], [8300, 6750], [6900, 1500]];
  const ROADS = [
    ['home', 'feed', 'tools', 'bfc', 'garage', 'hatter', 'vet', 'city'], ['garage', 'bank', 'city'], ['home', 'backyard'], ['bfc', 'county', 'carnival'],
    ['home', 'lab'], ['backyard', 'market'], ['backyard', 'cellar'], ['feed', 'grand'],
  ];

  function generate(seed) {
    const r = new Rng((seed ^ 0x77a1d) >>> 0);
    const world = { seed, w: W, h: H, cell: CELL };
    world.blobs = [
      ['highlands', blob(r, 6000, 950, 1750)], ['wetland', blob(r, 2600, 2400, 2000)], ['savanna', blob(r, 9500, 2700, 2300)], ['jungle', blob(r, 2500, 5800, 1850)],
      ['town', blob(r, 7650, 4760, 720)],
    ];
    world.ponds = [blob(r, 2200, 2000, 420), blob(r, 3100, 2900, 300), blob(r, 2000, 3200, 260), blob(r, 4900, 5300, 230), blob(r, 9300, 1900, 240), blob(r, 2100, 5500, 250)];
    world.sea = { y: H - 950, a1: r.range(60, 110), k1: r.range(0.0012, 0.0019), p1: r.range(0, TAU), a2: r.range(25, 50), k2: r.range(0.004, 0.006), p2: r.range(0, TAU) };
    world.sites = [];
    world.site = {};
    for (const s of SITES) {
      const site = { id: s[0], kind: s[1], name: s[2], x: s[3] + r.range(-40, 40), y: s[4] + r.range(-40, 40), r: 120 };
      world.sites.push(site); world.site[site.id] = site;
    }
    HOUSES.forEach((h, i) => {
      const site = { id: 'house' + i, kind: 'house', name: 'House', x: h[0] + r.range(-90, 90), y: h[1] + r.range(-90, 90), r: 100 };
      world.sites.push(site); world.site[site.id] = site;
    });
    const road = (ids, rr) => {
      const pts = [];
      for (let i = 0; i < ids.length; i++) {
        const s = world.site[ids[i]];
        if (i > 0) { // a gentle bend between sites
          const p = pts[pts.length - 1], mx = (p.x + s.x) / 2, my = (p.y + s.y) / 2, d = Math.hypot(s.x - p.x, s.y - p.y);
          pts.push({ x: mx + rr.range(-0.12, 0.12) * d, y: my + rr.range(-0.12, 0.12) * d });
        }
        pts.push({ x: s.x, y: s.y + 70 });
      }
      return pts;
    };
    world.roads = ROADS.map((ids) => road(ids, r));
    // treasure marks: a guaranteed find under each
    world.marks = [
      { x: world.site.lab.x + 330, y: world.site.lab.y + 260, loot: { type: 'item', id: 'fuse' } },
      { x: 9100, y: 1500, loot: { type: 'fossil', set: 'terror' } }, { x: 1500, y: 4700, loot: { type: 'chest', money: 400 } },
      { x: 10600, y: 6500, loot: { type: 'fossil', set: 'dodo' } }, { x: 4700, y: 1300, loot: { type: 'item', id: 'oldspur' } }, { x: 7300, y: 6300, loot: { type: 'chest', money: 250 } },
    ];
    for (const m of world.marks) { m.x += r.range(-60, 60); m.y += r.range(-60, 60); m.cx = Math.floor(m.x / CELL); m.cy = Math.floor(m.y / CELL); }
    world.npcs = RB.npc ? RB.npc.populate(world, r) : [];
    // Sites opened later draw from their own numbers, so the rest of an older save's map stays put.
    const r2 = new Rng((seed ^ 0x5007e) >>> 0);
    for (const s of LATER) {
      const site = { id: s[0], kind: s[1], name: s[2], x: s[3] + r2.range(-40, 40), y: s[4] + r2.range(-40, 40), r: 120 };
      world.sites.push(site); world.site[site.id] = site;
      world.roads.push(road(s[5], r2));
      if (RB.npc) world.npcs.push(RB.npc.make(r2, 'k_' + s[0], s[6][0], s[6][3] || 'keeper', s[0], s[6][1], s[6][2]));
    }
    return world;
  }

  const seaY = (world, x) => { const s = world.sea; return s.y + s.a1 * Math.sin(x * s.k1 + s.p1) + s.a2 * Math.sin(x * s.k2 + s.p2); };
  function biomeAt(world, x, y) {
    const sy = seaY(world, x);
    if (y > sy) return 'water';
    for (const p of world.ponds) if (inBlob(p, x, y)) return 'water';
    if (y > sy - 620) return 'coast';
    for (const b of world.blobs) if (inBlob(b[1], x, y)) return b[0];
    return 'farm';
  }
  function onRoad(world, x, y) {
    for (const road of world.roads) {
      for (let i = 0; i < road.length - 1; i++) {
        const a = road[i], b = road[i + 1], t = RB.physics.closestT(x, y, a.x, a.y, b.x, b.y);
        if (Math.hypot(x - (a.x + (b.x - a.x) * t), y - (a.y + (b.y - a.y) * t)) < 46) return true;
      }
    }
    return false;
  }
  function nearestSite(world, x, y, maxD) {
    let best = null, bd = maxD === undefined ? Infinity : maxD;
    for (const s of world.sites) { const d = Math.hypot(s.x - x, s.y + 70 - y); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  // Pick a species for a wild animal here. night: after dark.
  function spawnSpecies(world, x, y, night, rng) {
    const b = biomeAt(world, x, y);
    if (b === 'water') return null;
    const f = FAUNA[b];
    return rng.weighted(night ? f.night : f.day, (e) => e[1])[0];
  }

  // The treasure mark (red X) in a cell, if there is one.
  const markAt = (world, cx, cy) => world.marks.find((m) => m.cx === cx && m.cy === cy) || null;
  // What is buried in a cell on a given day. Ordinary holes fill back in overnight and the ground
  // holds something new the next day; a treasure mark always holds its own find.
  // Returns null or { type: 'money' | 'item' | 'fossil' | 'chest' | 'creature', ..., metal }.
  // The day birds of a spot's land, as [[species, weight], ...] (for neighbours' stock).
  function faunaAt(world, x, y) {
    const b = biomeAt(world, x, y);
    return (FAUNA[b] || FAUNA.farm).day;
  }
  function lootAt(world, cx, cy, day) {
    const m = markAt(world, cx, cy);
    if (m) return Object.assign({ metal: m.loot.type !== 'fossil', marked: true }, m.loot);
    const ds = (world.seed + Math.imul(day || 0, 7919)) | 0;
    const u = hash2(cx, cy, ds), v = hash2(cx, cy, ds + 91), x = (cx + 0.5) * CELL, y = (cy + 0.5) * CELL;
    if (u > 0.97) return null; // coming up empty is rare
    const b = biomeAt(world, x, y);
    if (b === 'water') return null;
    const k = u / 0.97;
    if (k < 0.34) return { type: 'money', money: 4 + Math.floor(v * 34), metal: true };
    if (k < 0.52) return { type: 'item', id: 'worm', n: 1 + Math.floor(v * 3) };
    if (k < 0.62) return { type: 'item', id: 'cap', metal: true };
    if (k < 0.69) return { type: 'item', id: 'boot' };
    if (k < 0.76) return { type: 'item', id: 'shard' };
    if (k < 0.84) return FOSSIL_BIOME[b] ? { type: 'fossil', set: FOSSIL_BIOME[b] } : { type: 'item', id: 'worm', n: 2 };
    if (k < 0.9) return b === 'jungle' || b === 'wetland' ? { type: 'item', id: 'mushroom' } : { type: 'money', money: 20 + Math.floor(v * 40), metal: true };
    if (k < 0.925) return { type: 'item', id: 'oldspur', metal: true };
    if (k < 0.945) return { type: 'item', id: 'fuse', metal: true };
    if (k < 0.965) return { type: 'chest', money: 150 + Math.floor(v * 350), metal: true };
    if (k < 0.99) return { type: 'creature' };
    return { type: 'item', id: 'idol', metal: true };
  }
  const cellOf = (x, y) => ({ cx: Math.floor(x / CELL), cy: Math.floor(y / CELL) });

  // The day's wild population: groups of animals spread over the land, the same for a given save
  // and day, so they stay put while you go in and out of places and are renewed each morning.
  // Some groups only come out at night. Very rarely (about one animal in 170) a wild bird is
  // a natural cross of two kinds. Entries: { id, sp, g, x, y, night, cross }
  const CROSS_RATE = 0.006;
  // Birds you set free leave their genes in the wild: from the next day on, an animal born within
  // GENE_REACH of where one was let go is, now and then (GENE_FLOW), a young of it and a wild one.
  const GENE_FLOW = 0.025, GENE_REACH = 2400;
  // A young of two genomes whatever their sexes (two males or two females: one stands in for the
  // other sex, a female father with her Z doubled). Returns { g, momFirst }.
  function youngOf(g1, g2, r) {
    let mom = g1.sex === 'F' ? g1 : g2.sex === 'F' ? g2 : null, dad = mom === g1 ? g2 : g1;
    if (!mom) { mom = { a: g1.a, b: g1.b, sex: 'F' }; dad = g2; }
    if (dad.sex === 'F') {
      const GN = RB.genome, o = GN.Z_CHR * GN.CHR_LEN, b = dad.b.slice();
      b.set(dad.a.subarray(o, o + GN.CHR_LEN), o);
      dad = { a: dad.a, b, sex: 'M' };
    }
    return { g: RB.genome.breed(mom, dad, r), momFirst: mom === g1 || mom.a === g1.a };
  }
  // pool: released birds' genes ({ g, x, y, name, key, label }), from RB.state.genePool.
  function population(world, day, groups, pool) {
    const r = new Rng((world.seed ^ Math.imul((day || 0) + 1, 2654435761) ^ 0x51d) >>> 0);
    const out = [], ids = RB.species.IDS.filter((id) => !RB.species.SPECIES[id].extinct && !RB.species.SPECIES[id].person);
    let made = 0;
    for (let tries = 0; made < (groups || 280) && tries < 8000; tries++) {
      const x = r.range(150, W - 150), y = r.range(150, H - 150);
      if (biomeAt(world, x, y) === 'water' || nearestSite(world, x, y, 260)) continue;
      // a day group here, and the night group that comes out in its place after dark
      const night = r.chance(0.5), sp = spawnSpecies(world, x, y, night, r);
      if (!sp) continue;
      made++;
      const n = r.int(1, RB.species.SPECIES[sp].tier <= 2 ? 3 : 2);
      for (let i = 0; i < n; i++) {
        const ax = x + r.range(-90, 90), ay = y + r.range(-70, 70);
        if (biomeAt(world, ax, ay) === 'water') continue;
        let g, cross = null;
        if (r.chance(CROSS_RATE)) {
          // a natural cross: this kind and another from the same land (or, rarely, from anywhere)
          const b = biomeAt(world, ax, ay), f = FAUNA[b] ? FAUNA[b].day.map((e) => e[0]).filter((id) => id !== sp) : [];
          const other = r.chance(0.7) && f.length ? r.pick(f) : r.pick(ids.filter((id) => id !== sp));
          const momFirst = r.chance(0.5), momId = momFirst ? sp : other, dadId = momFirst ? other : sp;
          g = RB.genome.breed(RB.species.make(momId, r, { sex: 'F', sport: 0 }), RB.species.make(dadId, r, { sex: 'M', sport: 0 }), r);
          cross = { momKey: momId, dadKey: dadId, mom: RB.species.generic(momId), dad: RB.species.generic(dadId) };
        } else g = RB.species.make(sp, r, { sport: 0.07 });
        out.push({ id: out.length, sp, g, x: ax, y: ay, night, cross });
      }
    }
    // genes from birds set free, drawn from numbers of their own so the rest of the day stays put
    if (pool && pool.length) {
      const rg = new Rng((world.seed ^ Math.imul((day || 0) + 1, 40503) ^ 0x9e3) >>> 0);
      for (const e of out) {
        if (e.cross) continue;
        const near = pool.filter((p) => Math.hypot(p.x - e.x, p.y - e.y) < GENE_REACH);
        if (!near.length || !rg.chance(GENE_FLOW)) continue;
        const p = rg.pick(near), y = youngOf(e.g, p.g, rg);
        e.g = y.g; e.kin = { name: p.name, key: p.key, label: p.label };
        if (e.sp !== p.key) {
          const w = { key: e.sp, label: RB.species.generic(e.sp) }, f = { key: p.key, label: p.label };
          const mom = y.momFirst ? w : f, dad = y.momFirst ? f : w;
          e.cross = { momKey: mom.key, dadKey: dad.key, mom: mom.label, dad: dad.label };
        }
      }
    }
    return out;
  }

  // Scenery for one cell of the decor grid (a coarser grid than the loot cells): [{ kind, x, y, s }]
  const DECOR = {
    farm: ['tree', 'bush', 'hay', 'flower', 'flower'], wetland: ['reed', 'reed', 'willow', 'bush'], savanna: ['acacia', 'drybush', 'rock', 'mound'],
    highlands: ['pine', 'pine', 'rock', 'boulder'], coast: ['palm', 'shell', 'rock'], jungle: ['bigleaf', 'bigleaf', 'fern', 'tree'], town: ['bush', 'flower'], water: ['lily'],
  };
  function decorAt(world, gx, gy, size) {
    const out = [], n = hash2(gx, gy, world.seed + 5) < 0.55 ? 1 : hash2(gx, gy, world.seed + 6) < 0.5 ? 2 : 0;
    for (let i = 0; i < n; i++) {
      const x = (gx + hash2(gx * 3 + i, gy, world.seed + 7)) * size, y = (gy + hash2(gx, gy * 3 + i, world.seed + 8)) * size;
      const b = biomeAt(world, x, y), list = DECOR[b];
      if (b === 'water' && biomeAt(world, x, y - 200) === 'water' && y > seaY(world, x)) continue; // open sea stays empty
      if (onRoad(world, x, y) || nearestSite(world, x, y, 190)) continue;
      out.push({ kind: list[Math.floor(hash2(gx + i, gy - i, world.seed + 9) * list.length)], x, y, s: 0.8 + 0.5 * hash2(gx - i, gy + i, world.seed + 10) });
    }
    return out;
  }

  RB.world = { faunaAt, W, H, CELL, BIOMES, FAUNA, CROSS_RATE, GENE_FLOW, GENE_REACH, youngOf, generate, biomeAt, seaY, inBlob, blobR, onRoad, nearestSite, spawnSpecies, markAt, lootAt, cellOf, population, decorAt };
})();
