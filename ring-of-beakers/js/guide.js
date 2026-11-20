// guide.js — the map's markers: kinds of place a player may want to find (arenas, shops, vets,
// villages, dealers in exotic birds, treasure marks, where each kind of fossil is dug up, where the
// sea birds live, islands where an extinct kind still lives) and where they are, on the mainland
// and, once the open sea is unlocked, on its islands. The player switches each kind on or off; the
// map shows pins for them and the road map an arrow to the nearest. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const WD = RB.world;

  let cache = null;
  // [{ id, label, group, sea (only out at sea) }]
  function categories() {
    if (cache) return cache;
    const out = [
      { id: 'arena', label: 'Arenas', group: 'Places' },
      { id: 'shop', label: 'Shops and trading posts', group: 'Places' },
      { id: 'vet', label: 'Vets and bird doctors', group: 'Places' },
      { id: 'village', label: 'Villages and houses', group: 'Places' },
      { id: 'exotic', label: 'Exotic bird dealers', group: 'Places' },
      { id: 'mark', label: 'Treasure marks', group: 'Places' },
      { id: 'isle', label: 'Your islands', group: 'Places', sea: true },
    ];
    for (const id of Object.keys(RB.items.FOSSILS)) out.push({ id: 'fossil:' + id, label: RB.items.FOSSILS[id] + ' fossils', group: 'Fossils', sea: RB.sea.SEA_FOSSILS.includes(id) });
    for (const id of RB.sea.SEA_BIRDS) out.push({ id: 'bird:' + id, label: RB.species.generic(id) + 's', group: 'Birds', sea: true });
    out.push({ id: 'lost', label: 'Islands where an extinct kind lives', group: 'Birds', sea: true });
    cache = out;
    return out;
  }
  const label = (id) => (categories().find((c) => c.id === id) || { label: id }).label;

  // Places of one kind within reach of (x, y): [{ x, y, name }]. sea: the open sea is unlocked, so
  // its islands count too.
  function find(world, S, cat, x, y, reach, sea) {
    const out = [], near = (px, py) => Math.hypot(px - x, py - y) <= reach;
    const islands = sea ? RB.sea.islandsNear(world, x, y, reach) : [];
    const add = (px, py, name) => { if (near(px, py)) out.push({ x: px, y: py, name }); };
    const keeperOf = (s) => world.npcs.find((n) => n.site === s.id);
    const siteKinds = { arena: ['arena'], shop: ['shop'], vet: ['vet'], exotic: ['exotic'] };
    if (siteKinds[cat]) {
      for (const s of world.sites) {
        if (s.island && !sea) continue;
        if (siteKinds[cat].includes(s.kind) || (cat === 'exotic' && s.kind === 'house' && (keeperOf(s) || {}).role === 'exotic')) add(s.x, s.y, s.kind === 'house' ? (keeperOf(s) || {}).name + '\'s' : s.name);
      }
    } else if (cat === 'village') {
      for (const s of world.sites) if (s.kind === 'house' && !s.island) add(s.x, s.y, (keeperOf(s) || {}).name || 'House');
      for (const is of islands) { const h = is.sites.find((q) => q.kind === 'house'); if (h) add(h.x, h.y, is.name + ' village'); }
    } else if (cat === 'isle') {
      for (const isle of S.isles || []) add(isle.x, isle.y, isle.name);
    } else if (cat === 'mark') {
      for (const m of world.marks) if (!S.marksDug[m.cx + ',' + m.cy]) add(m.x, m.y, 'Treasure');
    } else if (cat.startsWith('fossil:')) {
      const set = cat.slice(7);
      // the mainland's lands, the coast, and the Bone Quarry
      for (const b of world.blobs) if (WD.FOSSIL_BIOME[b[0]] === set) add(b[1].x, b[1].y, WD.BIOMES[b[0]].name);
      if (WD.FOSSIL_BIOME.coast === set) for (const f of [0.2, 0.5, 0.8]) add(WD.W * f, WD.seaY(world, WD.W * f) - 320, 'The coast');
      if (WD.QUARRY_SETS.some((e) => e[0] === set) && world.site.quarry) add(world.site.quarry.x, world.site.quarry.y + WD.QUARRY_DY, 'Bone Quarry');
      // islands: the sea's own fossils lie under every island, the others under islands of their land
      for (const is of islands) if (RB.sea.SEA_FOSSILS.includes(set) || WD.FOSSIL_BIOME[is.main] === set || (WD.FOSSIL_ALSO && WD.FOSSIL_ALSO[is.main] === set)) add(is.x, is.y, is.name);
    } else if (cat.startsWith('bird:')) {
      const id = cat.slice(5);
      for (const is of islands) if (is.fauna.day.some((e) => e[0] === id)) add(is.x, is.y, is.name);
    } else if (cat === 'lost') {
      for (const is of islands) if (is.lost) add(is.x, is.y, is.name + ' (' + RB.species.nameOf(RB.species.SPECIES[is.lost], 'M') + ')');
    }
    return out;
  }
  // The nearest place of any of the given kinds: { x, y, name, cat, d } or null.
  function nearest(world, S, cats, x, y, reach, sea) {
    let best = null;
    for (const cat of cats) for (const p of find(world, S, cat, x, y, reach, sea)) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (!best || d < best.d) best = Object.assign({ cat, d }, p);
    }
    return best;
  }
  // The kinds switched on in a save.
  const on = (S) => Object.keys(S.markers || {}).filter((k) => S.markers[k]);

  RB.guide = { categories, label, find, nearest, on };
})();
