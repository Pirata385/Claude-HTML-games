// sea.js — the open sea, unlocked at the end of the story (or from the start in a sandbox game).
// Past the mainland's shores lies an endless ocean, cut into square chunks that are made the first
// time anything looks at them. A chunk may hold an island or two, each with its own lands, birds (a
// local race of each kind, a couple of strangers from far away, now and then a kind thought extinct),
// and on the bigger ones a village, a shop and a vet, or an arena with a boss of its own. Islands
// further out are wilder and their arenas harder. Everything comes from the save's seed, so an
// island is the same every time you land on it. No DOM: the map scene draws what this describes.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, TAU, clamp, hashStr } = RB.core;
  const WD = RB.world, SP = () => RB.species.SPECIES;

  const CHUNK = 7000, CLEAR = 2600; // chunk size, and no islands this close to the mainland's edge
  // Birds that live only out at sea, and fossils dug up only on its islands.
  const SEA_BIRDS = ['albatross', 'frigatebird', 'puffin'], SEA_FOSSILS = ['haast', 'auk', 'pelagornis'];
  const LANDS = ['farm', 'wetland', 'savanna', 'highlands', 'jungle', 'tundra', 'volcanic', 'desert'];
  const TWISTS = ['grain', 'mud', 'wind', 'dark', 'rounds'];
  const SYL = ['ka', 'lo', 'ma', 'ru', 'te', 'vi', 'no', 'sa', 'pe', 'ba', 'qui', 'tor', 'mel', 'ya', 'zu', 'ori', 'an', 'el', 'is', 'ur', 'do', 'fa'];
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const word = (r) => cap(r.pick(SYL) + r.pick(SYL) + (r.chance(0.5) ? r.pick(SYL) : ''));
  // the mainland arenas' fees and purses by tier, for the island arenas to follow
  const TIER = [{ fee: 15, purse: 70, bet: 300 }, { fee: 50, purse: 220, bet: 1000 }, { fee: 150, purse: 650, bet: 3000 }, { fee: 400, purse: 1700, bet: 8000 }, { fee: 1000, purse: 4500, bet: 20000 }];

  const chunkOf = (x, y) => ({ cx: Math.floor(x / CHUNK), cy: Math.floor(y / CHUNK) });
  function chunk(world, cx, cy) {
    if (!world.chunks) world.chunks = new Map();
    const key = cx + ',' + cy;
    let ch = world.chunks.get(key);
    if (ch) return ch;
    ch = { cx, cy, islands: [] };
    world.chunks.set(key, ch);
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    if (x0 + CHUNK > -CLEAR && x0 < WD.W + CLEAR && y0 + CHUNK > -CLEAR && y0 < WD.H + CLEAR) return ch; // the mainland's own waters
    const r = new Rng((world.seed ^ Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ 0x15a) >>> 0);
    const n = r.chance(0.72) ? (r.chance(0.3) ? 2 : 1) : 0;
    for (let k = 0; k < n; k++) {
      const R = k === 0 ? r.range(1100, 2700) : r.range(700, 1300);
      let x = 0, y = 0, ok = false;
      for (let t = 0; t < 20 && !ok; t++) {
        x = r.range(x0 + R + 350, x0 + CHUNK - R - 350); y = r.range(y0 + R + 350, y0 + CHUNK - R - 350);
        ok = ch.islands.every((o) => Math.hypot(o.x - x, o.y - y) > o.R + R + 450);
      }
      if (ok) ch.islands.push(island(world, r, cx, cy, k, x, y, R));
    }
    return ch;
  }

  function island(world, r, cx, cy, k, x, y, R) {
    const id = 'i' + cx + '_' + cy + '_' + k, shape = WD.blob(r, x, y, R), inner = { x, y, R: R * 0.84, harm: shape.harm };
    const main = r.pick(LANDS), patches = [];
    for (let i = r.int(0, 2); i > 0; i--) { const a = r.range(0, TAU), d = r.range(0, R * 0.45); patches.push([r.pick(LANDS), WD.blob(r, x + Math.cos(a) * d, y + Math.sin(a) * d, r.range(R * 0.25, R * 0.45))]); }
    // further out is wilder
    const far = clamp((Math.hypot(x - WD.W / 2, y - WD.H / 2) - 9000) / 45000, 0, 1);
    // the birds: the land's own, a couple of strangers, and now and then a kind thought long gone
    const ids = RB.species.IDS.filter((s) => !SP()[s].person);
    const day = WD.FAUNA[main].day.map((e) => e.slice()), night = WD.FAUNA[main].night.map((e) => e.slice());
    const strangers = [];
    for (let i = 0; i < 2; i++) { const s = r.pick(ids.filter((s) => !SP()[s].extinct && !SP()[s].night && !SEA_BIRDS.includes(s))); strangers.push(s); day.push([s, r.range(5, 12)]); }
    // the sea's own birds: albatrosses everywhere, frigatebirds where it is warm, puffins where it is cold
    day.push(['albatross', 6]);
    if (['jungle', 'desert', 'savanna', 'volcanic', 'farm', 'wetland'].includes(main)) day.push(['frigatebird', 8]);
    if (['tundra', 'highlands'].includes(main)) day.push(['puffin', 12]);
    let lost = null;
    if (r.chance(0.08 + 0.17 * far)) { lost = r.pick(ids.filter((s) => SP()[s].extinct)); day.push([lost, 6]); }
    // a local race: every bird here is a little different from its kind elsewhere
    const race = { size: r.chance(0.4) ? (r.chance(0.5) ? r.range(0.72, 0.88) : r.range(1.15, 1.35)) : 1, hue: r.chance(0.5) ? r.range(-0.15, 0.15) : 0,
      lit: r.chance(0.4) ? r.range(-0.15, 0.15) : 0, crest: r.chance(0.25) ? r.range(0.55, 1) : null, tail: r.chance(0.25) ? r.range(1.2, 1.6) : 1 };
    const is = { id, x, y, R, shape, inner, main, patches, fauna: { day, night }, strangers, lost, race, far, name: word(r) + ' ' + r.pick(['Island', 'Isle', 'Key', 'Atoll', 'Rock']), tier: 1 + Math.round(far * 3), sites: [], roads: [] };
    places(world, r, is);
    return is;
  }

  // Villages, a shop and a vet, an arena: the bigger the island, the more it has.
  function places(world, r, is) {
    const spots = [];
    const spot = () => {
      for (let t = 0; t < 40; t++) {
        const a = r.range(0, TAU), d = r.range(0, is.R * 0.55), x = is.x + Math.cos(a) * d, y = is.y + Math.sin(a) * d;
        if (WD.inBlob(is.inner, x, y + 70) && spots.every((p) => Math.hypot(p.x - x, p.y - y) > 560)) { spots.push({ x, y }); return { x, y }; }
      }
      return null;
    };
    const add = (o, keeper) => {
      const p = spot();
      if (!p) return null;
      const site = Object.assign({ x: p.x, y: p.y, r: 120, island: is.id }, o);
      world.sites.push(site); world.site[site.id] = site; is.sites.push(site);
      if (keeper) world.npcs.push(RB.npc.make(r, keeper.id || 'n_' + site.id, keeper.name, keeper.role, site.id, keeper.sex, keeper.hat || null));
      return site;
    };
    const person = (role) => { const sex = r.chance(0.5) ? 'M' : 'F'; return { name: RB.npc.randomName(r, sex), sex, role, hat: r.chance(0.3) ? r.pick(['cowboy', 'bandana', 'party']) : null }; };
    if (is.R >= 1150 && r.chance(0.8)) {
      for (let i = r.int(2, 4); i > 0; i--) add({ id: 'h_' + is.id + '_' + i, kind: 'house', name: 'House' }, person(r.weighted([['villager', 4], ['breeder', 3], ['trainer', 2], ['collector', 1], ['exotic', 1]], (e) => e[1])[0]));
    }
    if (is.R >= 1700 && r.chance(0.6)) {
      const pool = ['grain', 'worm', 'tonic', 'chili', 'net', 'bignet', 'shovel', 'seed', 'loveseed', 'mushroom', 'gromash', 'fuse', 'bandana', 'party', 'spurs', 'helmet', 'scarf'];
      add({ id: 's_' + is.id, kind: 'shop', name: is.name.split(' ')[0] + ' Trading Post', stock: r.shuffle(pool.slice()).slice(0, 7).concat(['grainsack']), line: 'Not much comes out this far. Have a look.' }, Object.assign(person('keeper'), { id: 'k_s_' + is.id }));
      add({ id: 'v_' + is.id, kind: 'vet', look: 'vet', name: is.name.split(' ')[0] + ' Bird Doctor', line: 'Bring me the wounded. I have seen it all out here.' }, Object.assign(person('keeper'), { id: 'k_v_' + is.id }));
    }
    if (is.R >= 1900 && r.chance(0.4)) {
      const t = Math.min(4, is.tier), boss = person('keeper'), base = TIER[t], twist = r.pick(TWISTS);
      const day = is.fauna.day.filter((e) => !SP()[e[0]].night), mix = [r.weighted(day, (e) => e[1])[0], r.weighted(day, (e) => e[1])[0]];
      const classes = [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6], [4, 5, 6]][t];
      const name = is.name.split(' ')[0] + ' ' + r.pick(['Arena', 'Ring', 'Pit', 'Coliseum']);
      const site = add({ id: 'a_' + is.id, kind: 'arena', name, line: 'Fresh blood from the mainland? Step in.' }, Object.assign(boss, { id: 'k_a_' + is.id }));
      if (site) {
        RB.economy.addArena({ id: site.id, name, tier: t, island: true, modes: [twist], classes, fee: base.fee, purse: base.purse, need: r.int(3, 4), betCap: base.bet,
          boss: { trainer: boss.name, bird: RB.state ? r.pick(RB.state.BIRD_NAMES) : 'Champ', mix, wc: classes[2], purse: base.purse * 6, gear: r.pick([null, 'scarf', 'helmet', 'spurs']) } });
      }
    }
    // a track joining the island's places
    for (let i = 1; i < is.sites.length; i++) {
      const a = is.sites[i - 1], b = is.sites[i], mx = (a.x + b.x) / 2 + r.range(-120, 120), my = (a.y + b.y) / 2 + r.range(-120, 120);
      is.roads.push([{ x: a.x, y: a.y + 70 }, { x: mx, y: my + 70 }, { x: b.x, y: b.y + 70 }]);
    }
  }

  // ---- what the world asks of the sea
  function islandAt(world, x, y) {
    const c = chunkOf(x, y);
    for (const is of chunk(world, c.cx, c.cy).islands) if (WD.inBlob(is.shape, x, y)) return is;
    return null;
  }
  function biomeAt(world, x, y) {
    const is = islandAt(world, x, y);
    if (!is) return null;
    if (!WD.inBlob(is.inner, x, y)) return 'coast';
    for (const p of is.patches) if (WD.inBlob(p[1], x, y)) return p[0];
    return is.main;
  }
  function onRoad(world, x, y) {
    const is = islandAt(world, x, y);
    if (!is) return false;
    for (const road of is.roads) for (let i = 0; i < road.length - 1; i++) {
      const a = road[i], b = road[i + 1], t = RB.physics.closestT(x, y, a.x, a.y, b.x, b.y);
      if (Math.hypot(x - (a.x + (b.x - a.x) * t), y - (a.y + (b.y - a.y) * t)) < 46) return true;
    }
    return false;
  }
  // The islands of every chunk within reach of a point (making the chunks as needed).
  function islandsNear(world, x, y, reach) {
    const out = [], c0 = chunkOf(x - reach, y - reach), c1 = chunkOf(x + reach, y + reach);
    for (let cx = c0.cx; cx <= c1.cx; cx++) for (let cy = c0.cy; cy <= c1.cy; cy++) for (const is of chunk(world, cx, cy).islands) if (Math.hypot(is.x - x, is.y - y) < reach + is.R) out.push(is);
    return out;
  }
  // The trait targets that make a kind into this island's race of it.
  function raceTargets(is, id) {
    const t = SP()[id].t, rc = is.race, o = {};
    if (rc.size !== 1) o.size = (t.size === undefined ? 1 : t.size) * rc.size;
    if (rc.hue) o.hue = (((t.hue === undefined ? 0.5 : t.hue) + rc.hue) % 1 + 1) % 1;
    if (rc.lit) o.lit = clamp((t.lit === undefined ? 0.45 : t.lit) + rc.lit, 0.08, 0.95);
    if (rc.crest !== null) o.crest = rc.crest;
    if (rc.tail !== 1) o.tailLen = Math.min(2.6, (t.tailLen === undefined ? 1 : t.tailLen) * rc.tail);
    return o;
  }
  // An island's wild birds for a day: about the same by day and by night, renewed each morning.
  function population(world, is, day) {
    if (is.owned) return []; // your own islands keep only the birds you leave there
    const r = new Rng((world.seed ^ hashStr(is.id) ^ Math.imul((day || 0) + 1, 2654435761)) >>> 0), out = [];
    const groups = clamp(Math.round(is.R * is.R / 280000), 4, 26);
    for (let g = 0; g < groups; g++) {
      let x = 0, y = 0, ok = false;
      for (let t = 0; t < 12 && !ok; t++) { const a = r.range(0, TAU), d = Math.sqrt(r.next()) * is.R * 0.8; x = is.x + Math.cos(a) * d; y = is.y + Math.sin(a) * d; ok = WD.inBlob(is.shape, x, y) && !WD.nearestSite(world, x, y, 260); }
      if (!ok) continue;
      const night = r.chance(0.5), sp = r.weighted(night ? is.fauna.night : is.fauna.day, (e) => e[1])[0];
      for (let n = r.int(1, SP()[sp].tier <= 2 ? 3 : 2); n > 0; n--) {
        const ax = x + r.range(-90, 90), ay = y + r.range(-70, 70);
        if (!WD.inBlob(is.shape, ax, ay)) continue;
        out.push({ id: is.id + ':' + out.length, sp, g: RB.species.make(sp, r, { sport: 0.1, targets: raceTargets(is, sp) }), x: ax, y: ay, night, cross: null, island: is.id });
      }
    }
    return out;
  }
  // A line about an island's birds, for the chart.
  function describe(is) {
    if (is.owned && is.isle) { const i = is.isle; return 'your island · ' + i.birds.length + ' bird' + (i.birds.length === 1 ? '' : 's') + (i.gen ? ' · generation ' + i.gen : '') + (i.rad > 0.05 ? ' · radioactive' : ''); }
    const bits = [WD.BIOMES[is.main].name.toLowerCase()];
    if (is.race.size > 1) bits.push('giant birds'); else if (is.race.size < 1) bits.push('little birds');
    if (is.lost) bits.push('a lost kind lives here');
    if (is.sites.some((s) => s.kind === 'arena')) bits.push('an arena');
    if (is.sites.some((s) => s.kind === 'house')) bits.push('a village');
    return bits.join(' · ');
  }

  // ---- your own islands (see state.js): raise one, or claim an empty one
  // Why an island cannot be raised centred here, or ''.
  const NEAR_MAIN = 'Too close to the mainland.';
  function raiseSpot(world, x, y, R) {
    const cx = clamp(x, 0, WD.W), cy = clamp(y, 0, WD.H);
    if (Math.hypot(x - cx, y - cy) < R + 1500) return NEAR_MAIN;
    if (WD.biomeAt(world, x, y) !== 'water') return 'There is land here already.';
    for (const is of islandsNear(world, x, y, R + 4000)) if (Math.hypot(is.x - x, is.y - y) < is.R + R + 500) return 'Too close to ' + is.name + '.';
    return '';
  }
  function raised(isle) {
    const r = new Rng(isle.seed), shape = WD.blob(r, isle.x, isle.y, isle.R);
    return { id: isle.id, x: isle.x, y: isle.y, R: isle.R, shape, inner: { x: isle.x, y: isle.y, R: isle.R * 0.84, harm: shape.harm }, main: isle.land, patches: [],
      fauna: { day: [], night: [] }, strangers: [], lost: null, race: { size: 1, hue: 0, lit: 0, crest: null, tail: 1 }, far: 0, name: isle.name, tier: 1, sites: [], roads: [], made: true };
  }
  // Put a save's islands into a world (the world is rebuilt from the seed, so this runs on every
  // load): raised ones rise again, and each gets its field station. Safe to call again.
  function restoreIsles(world, S) {
    for (const isle of S.isles || []) {
      const c = chunkOf(isle.x, isle.y), ch = chunk(world, c.cx, c.cy);
      let is = ch.islands.find((q) => q.id === isle.id);
      if (!is && isle.made) { is = raised(isle); ch.islands.push(is); }
      if (!is) continue;
      is.owned = true; is.isle = isle;
      const id = 'hut_' + isle.id;
      if (!world.site[id]) {
        const site = { id, kind: 'isle', name: isle.name + ' Field Station', x: is.x, y: is.y - 70, r: 120, island: is.id, isle: isle.id, line: 'Your field station. The birds out here look after themselves: they pair up, raise young and grow old.' };
        world.sites.push(site); world.site[id] = site; is.sites.unshift(site);
      }
    }
  }

  RB.sea = { word, raiseSpot, NEAR_MAIN, restoreIsles, SEA_BIRDS, SEA_FOSSILS, CHUNK, CLEAR, LANDS, chunk, chunkOf, islandAt, biomeAt, onRoad, islandsNear, raceTargets, population, describe };
})();
