// Map storage and tile queries. The map itself (terrain, features, explored) is saved;
// derived grids (occupancy, blocking, structures) start with "_" and are rebuilt on load.
(function (UB) {
  'use strict';
  const { T, TERRAIN, F, FEATURE, BUILDINGS } = UB.DEF;

  function createMap(size) {
    const n = size * size;
    return {
      w: size, h: size,
      terrain: new Uint8Array(n),
      feature: new Uint8Array(n),
      famt: new Uint16Array(n),
      explored: new Uint8Array(n),
    };
  }

  const inb = (S, x, y) => x >= 0 && y >= 0 && x < S.map.w && y < S.map.h;
  const idx = (S, x, y) => y * S.map.w + x;

  // Allocate derived grids and fill them from the saved state.
  function rebuild(S) {
    const n = S.map.w * S.map.h;
    S._occ = new Int32Array(n);      // building/POI id on the tile (including blueprints)
    S._struct = new Int32Array(n);   // completed player structure that blocks zombies
    S._blockU = new Uint8Array(n);   // impassable for survivors
    S._blockZ = new Uint8Array(n);   // impassable for zombies (structures are attacked instead)
    S._vis = new Uint8Array(n);      // currently visible
    S._light = new Uint8Array(n);    // lit at night (spotlights, fires, HQ)
    S._ents = new Map();
    for (const list of [S.units, S.zombies, S.buildings, S.pois]) for (const e of list) S._ents.set(e.id, e);
    for (const p of S.pois) stampFootprint(S, p, p.id);
    for (const b of S.buildings) stampFootprint(S, b, b.id);
    for (let i = 0; i < n; i++) refreshTile(S, i);
    S._structVersion = (S._structVersion || 0) + 1;
  }

  function stampFootprint(S, e, id) {
    for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) {
      if (inb(S, x, y)) S._occ[idx(S, x, y)] = id;
    }
  }

  // Recompute blocking flags of a single tile from terrain, feature and occupant.
  function refreshTile(S, i) {
    const t = TERRAIN[S.map.terrain[i]];
    const f = FEATURE[S.map.feature[i]];
    let bu = !!t.block || !!(f && f.block);
    let bz = bu;
    let st = 0;
    const occ = S._occ[i];
    if (occ) {
      const e = S._ents.get(occ);
      if (e && e.kind === 'poi') { bu = true; bz = true; }
      else if (e && e.kind === 'bld' && e.built >= 1) {
        const def = BUILDINGS[e.type];
        if (!def.walkable) {
          st = e.id;
          bz = true;
          if (e.type !== 'gate') bu = true;
        }
      }
    }
    S._blockU[i] = bu ? 1 : 0;
    S._blockZ[i] = bz ? 1 : 0;
    S._struct[i] = st;
  }

  function refreshArea(S, x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(S, x, y)) refreshTile(S, idx(S, x, y));
    S._structVersion++;
  }

  function setFeature(S, x, y, f, amt) {
    const i = idx(S, x, y);
    S.map.feature[i] = f;
    S.map.famt[i] = amt || 0;
    refreshTile(S, i);
    S._structVersion++;
  }

  // Movement cost of a tile for survivors (Infinity when blocked).
  function costU(S, i) {
    if (S._blockU[i]) return Infinity;
    const f = FEATURE[S.map.feature[i]];
    return TERRAIN[S.map.terrain[i]].cost * (f && f.cost ? f.cost : 1);
  }

  function register(S, e) { S._ents.set(e.id, e); }
  function unregister(S, e) { S._ents.delete(e.id); }
  const get = (S, id) => S._ents.get(id);
  const nextId = (S) => S.nextId++;

  function hq(S) { return S._ents.get(S.hqId); }
  function territory(S) {
    const h = hq(S);
    return h ? BUILDINGS.hq.levels[h.level - 1].territory : 0;
  }
  function inTerritory(S, x, y) {
    const h = hq(S);
    if (!h) return false;
    const r = territory(S);
    return UB.U.dist2(x, y, h.tx + 1.5, h.ty + 1.5) <= r * r;
  }

  // Walkable tile nearest to (x, y), searching rings outward; used to drop entities safely.
  function nearestOpen(S, x, y, forZombie, maxR) {
    const block = forZombie ? S._blockZ : S._blockU;
    const cx = Math.floor(x), cy = Math.floor(y);
    for (let r = 0; r <= (maxR || 8); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (inb(S, tx, ty) && !block[idx(S, tx, ty)] && !S._occ[idx(S, tx, ty)]) return { x: tx, y: ty };
      }
    }
    return null;
  }

  UB.World = { createMap, inb, idx, rebuild, stampFootprint, refreshTile, refreshArea, setFeature, costU, register, unregister, get, nextId, hq, territory, inTerritory, nearestOpen };
})(globalThis.UB = globalThis.UB || {});
