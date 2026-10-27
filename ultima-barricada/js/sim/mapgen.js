// Procedural map generation from a seed: road grid, districts, river, points of interest,
// environmental details, a balanced starting area and guaranteed connectivity.
(function (UB) {
  'use strict';
  const { T, F, POIS, BAL, DIFFICULTY } = UB.DEF;
  const W = UB.World;

  // District codes (per tile, only used during generation).
  const D = { ROAD: 0, BASE: 1, RES: 2, DOWN: 3, IND: 4, PARK: 5, FOREST: 6, FARM: 7 };
  const D_KEY = { base: D.BASE, residential: D.RES, downtown: D.DOWN, industrial: D.IND, park: D.PARK, forest: D.FOREST, farm: D.FARM };

  function generate(S) {
    const N = S.map.w;
    const m = S.map;
    const rng = new UB.Rng(UB.hashStr('map|' + S.seed));
    const ns = UB.hashStr('noise|' + S.seed) & 0xffff;
    const I = (x, y) => y * N + x;
    const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

    const road = new Uint8Array(N * N);      // 1 minor road, 2 main road
    const dist = new Uint8Array(N * N);      // district per tile
    const poiMask = new Int32Array(N * N);   // POI id per tile
    const keep = new Uint8Array(N * N);      // keep clear of features (entrances, paths)

    // Base position near the centre.
    const bx = (N >> 1) + rng.int(-6, 6), by = (N >> 1) + rng.int(-6, 6);
    S.base = { x: bx, y: by };
    const dBase = (x, y) => Math.hypot(x - bx, y - by);

    // 1. Ground noise: grass with patches of dirt.
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      m.terrain[I(x, y)] = UB.fbm(ns, x / 14, y / 14, 3) > 0.66 ? T.DIRT : T.GRASS;
    }

    // 2. Road grid lines with jittered spacing; the lines closest to the base are main roads.
    function lines(center) {
      const out = [];
      let p = rng.int(4, 9);
      while (p < N - 6) { out.push({ p, w: rng.chance(0.4) ? 2 : 1 }); p += rng.int(15, 21); }
      let best = out[0];
      for (const l of out) if (Math.abs(l.p - center) < Math.abs(best.p - center)) best = l;
      best.w = 2;
      return out;
    }
    const vLines = lines(bx), hLines = lines(by);
    function intervals(ls) {
      const out = [];
      let start = 0;
      for (const l of ls) { if (l.p - 1 >= start) out.push({ a: start, b: l.p - 1 }); start = l.p + l.w; }
      if (start <= N - 1) out.push({ a: start, b: N - 1 });
      return out;
    }
    const xi = intervals(vLines), yi = intervals(hLines);

    // 3. Districts per block: downtown and industrial clusters, residential near the base,
    // forest and farms on the outskirts.
    const ang = rng.range(0, Math.PI * 2);
    const clampC = (v) => Math.max(18, Math.min(N - 18, v));
    const dc = { x: clampC(bx + Math.cos(ang) * rng.range(26, 34)), y: clampC(by + Math.sin(ang) * rng.range(26, 34)) };
    const ang2 = ang + Math.PI + rng.range(-0.8, 0.8);
    const ic = { x: clampC(bx + Math.cos(ang2) * rng.range(28, 38)), y: clampC(by + Math.sin(ang2) * rng.range(28, 38)) };
    const blocks = [];
    for (let a = 0; a < xi.length; a++) for (let b = 0; b < yi.length; b++) {
      const blk = { x0: xi[a].a, x1: xi[a].b, y0: yi[b].a, y1: yi[b].b, a, b };
      blk.cx = (blk.x0 + blk.x1) / 2; blk.cy = (blk.y0 + blk.y1) / 2;
      const n = UB.fbm(ns + 31, blk.cx / 40, blk.cy / 40, 2);
      const d = dBase(blk.cx, blk.cy) / (N / 2);
      let k;
      if (bx >= blk.x0 && bx <= blk.x1 && by >= blk.y0 && by <= blk.y1) k = 'base';
      else if (Math.hypot(blk.cx - dc.x, blk.cy - dc.y) < 20) k = 'downtown';
      else if (Math.hypot(blk.cx - ic.x, blk.cy - ic.y) < 18) k = 'industrial';
      else if (d < 0.45) k = n < 0.3 ? 'park' : 'residential';
      else if (d < 0.75) k = n < 0.42 ? 'forest' : n > 0.68 ? 'farm' : 'residential';
      else k = n < 0.6 ? 'forest' : 'farm';
      blk.k = k;
      blocks.push(blk);
      for (let y = blk.y0; y <= blk.y1; y++) for (let x = blk.x0; x <= blk.x1; x++) dist[I(x, y)] = D_KEY[k];
    }
    const blockAt = (a, b) => blocks.find((k) => k.a === a && k.b === b);
    const rural = (k) => k === 'forest' || k === 'farm';

    // 4. Paint road segments, dropping some between rural blocks for variety.
    function paintRoad(x, y, w) { if (inb(x, y)) { road[I(x, y)] = Math.max(road[I(x, y)], w === 2 ? 2 : 1); dist[I(x, y)] = D.ROAD; } }
    vLines.forEach((l, i) => {
      yi.forEach((iv, j) => {
        const left = blockAt(i, j), right = blockAt(i + 1, j);
        const ks = [left && left.k, right && right.k];
        if (!ks.includes('base') && ks.every((k) => !k || rural(k)) && rng.chance(0.55)) return;
        if (!ks.includes('base') && ks.every((k) => k === 'park') && rng.chance(0.5)) return;
        for (let y = iv.a; y <= iv.b; y++) for (let k = 0; k < l.w; k++) paintRoad(l.p + k, y, l.w);
      });
    });
    hLines.forEach((l, j) => {
      xi.forEach((iv, i) => {
        const top = blockAt(i, j), bottom = blockAt(i, j + 1);
        const ks = [top && top.k, bottom && bottom.k];
        if (!ks.includes('base') && ks.every((k) => !k || rural(k)) && rng.chance(0.55)) return;
        if (!ks.includes('base') && ks.every((k) => k === 'park') && rng.chance(0.5)) return;
        for (let x = iv.a; x <= iv.b; x++) for (let k = 0; k < l.w; k++) paintRoad(x, l.p + k, l.w);
      });
    });
    // Intersections: paved when any neighbouring segment exists.
    for (const vl of vLines) for (const hl of hLines) {
      let any = false;
      for (let k = 0; k < vl.w; k++) { if ((inb(vl.p + k, hl.p - 1) && road[I(vl.p + k, hl.p - 1)]) || (inb(vl.p + k, hl.p + hl.w) && road[I(vl.p + k, hl.p + hl.w)])) any = true; }
      for (let k = 0; k < hl.w; k++) { if ((inb(vl.p - 1, hl.p + k) && road[I(vl.p - 1, hl.p + k)]) || (inb(vl.p + vl.w, hl.p + k) && road[I(vl.p + vl.w, hl.p + k)])) any = true; }
      if (!any) continue;
      for (let dx = 0; dx < vl.w; dx++) for (let dy = 0; dy < hl.w; dy++) paintRoad(vl.p + dx, hl.p + dy, Math.max(vl.w, hl.w));
    }
    // Road terrain: asphalt, or dirt tracks for minor roads through the countryside.
    for (let i = 0; i < N * N; i++) {
      if (!road[i]) continue;
      if (road[i] === 2) { m.terrain[i] = T.ASPHALT; continue; }
      const x = i % N, y = (i / N) | 0;
      let rur = 0, tot = 0;
      for (let d = -3; d <= 3; d++) for (const [xx, yy] of [[x + d, y], [x, y + d]]) {
        if (!inb(xx, yy)) continue;
        const dd = dist[I(xx, yy)];
        if (dd === D.ROAD) continue;
        tot++; if (dd === D.FOREST || dd === D.FARM) rur++;
      }
      m.terrain[i] = tot && rur / tot > 0.6 ? T.DIRT : T.ASPHALT;
    }

    // 5. River (optional), meandering across the map away from the base, with bridges.
    if (rng.chance(0.55)) {
      const vertical = rng.chance(0.5);
      const width = rng.int(2, 3);
      const baseC = vertical ? bx : by;
      let c0 = -1;
      for (let tries = 0; tries < 40 && c0 < 0; tries++) {
        const cand = rng.int(12, N - 14);
        let ok = true;
        for (let t = 0; t < N && ok; t++) {
          const c = cand + (UB.fbm(ns + 7, t / 26, 0.5, 2) - 0.5) * 36;
          if (Math.abs(c - baseC) < 19) ok = false;
        }
        if (ok) c0 = cand;
      }
      if (c0 >= 0) {
        let prev = null;
        for (let t = 0; t < N; t++) {
          const c = Math.round(c0 + (UB.fbm(ns + 7, t / 26, 0.5, 2) - 0.5) * 36);
          const lo = prev === null ? c : Math.min(prev, c), hi = prev === null ? c : Math.max(prev, c);
          for (let s = lo; s <= hi + width - 1; s++) {
            const x = vertical ? s : t, y = vertical ? t : s;
            if (!inb(x, y)) continue;
            const i = I(x, y);
            m.terrain[i] = road[i] ? T.BRIDGE : T.WATER;
          }
          prev = c;
        }
      }
    }
    const isWater = (x, y) => m.terrain[I(x, y)] === T.WATER;

    // 6. District ground textures.
    for (const blk of blocks) {
      const w = blk.x1 - blk.x0 + 1, h = blk.y1 - blk.y0 + 1;
      for (let y = blk.y0; y <= blk.y1; y++) for (let x = blk.x0; x <= blk.x1; x++) {
        const i = I(x, y);
        if (m.terrain[i] === T.WATER || m.terrain[i] === T.BRIDGE || road[i]) continue;
        const edge = x === blk.x0 || x === blk.x1 || y === blk.y0 || y === blk.y1;
        const n = UB.fbm(ns + 50, x / 6, y / 6, 2);
        switch (blk.k) {
          case 'residential': if (edge) m.terrain[i] = T.SIDEWALK; break;
          case 'downtown': m.terrain[i] = edge ? T.SIDEWALK : n > 0.62 ? T.RUBBLE : n > 0.42 ? T.CONCRETE : T.SIDEWALK; break;
          case 'industrial': m.terrain[i] = edge ? T.CONCRETE : n > 0.66 ? T.DIRT : n < 0.25 ? T.RUBBLE : T.CONCRETE; break;
          case 'forest': m.terrain[i] = n > 0.7 ? T.GRASS : T.FOREST; break;
          case 'farm': {
            const fx = (x - blk.x0) % 7, fy = (y - blk.y0) % 9;
            m.terrain[i] = edge ? T.GRASS : fx === 0 || fy === 0 ? T.DIRT : T.FARM;
            break;
          }
          default: break;
        }
      }
      if (blk.k === 'park' && w >= 10 && h >= 10 && rng.chance(0.6)) {
        const rx = rng.range(2, Math.min(4.5, w / 4)), ry = rng.range(2, Math.min(4.5, h / 4));
        for (let y = blk.y0; y <= blk.y1; y++) for (let x = blk.x0; x <= blk.x1; x++) {
          if (((x - blk.cx) / rx) ** 2 + ((y - blk.cy) / ry) ** 2 <= 1) m.terrain[I(x, y)] = T.WATER;
        }
      }
    }

    // 7. Points of interest.
    function rectFree(x0, y0, w, h) {
      if (x0 < 1 || y0 < 1 || x0 + w > N - 1 || y0 + h > N - 1) return false;
      for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) {
        const i = I(x, y);
        if (poiMask[i]) return false;
        const inside = x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
        if (inside && (road[i] || isWater(x, y) || m.terrain[i] === T.BRIDGE)) return false;
      }
      return true;
    }
    function tryPlaceIn(type, blk, minD, maxD) {
      const def = POIS[type];
      for (let rot = 0; rot < 2; rot++) {
        const w = rot ? def.size[1] : def.size[0], h = rot ? def.size[0] : def.size[1];
        const xmin = blk.x0 + 1, xmax = blk.x1 - w, ymin = blk.y0 + 1, ymax = blk.y1 - h;
        if (xmax < xmin || ymax < ymin) continue;
        for (let t = 0; t < 14; t++) {
          const x0 = rng.int(xmin, xmax), y0 = rng.int(ymin, ymax);
          const d = dBase(x0 + w / 2, y0 + h / 2);
          if (d < Math.max(minD, 11 + Math.max(w, h) / 2) || d > maxD) continue;
          if (!rectFree(x0, y0, w, h)) continue;
          return addPoi(type, x0, y0, w, h, blk);
        }
      }
      return null;
    }
    function addPoi(type, x0, y0, w, h, blk) {
      const def = POIS[type];
      // Entrance faces the closest block edge (roads surround blocks), with a cleared path to it.
      const dl = x0 - blk.x0, dr = blk.x1 - (x0 + w - 1), dt = y0 - blk.y0, db = blk.y1 - (y0 + h - 1);
      const mn = Math.min(dl, dr, dt, db);
      let ex, ey, sx, sy;
      if (mn === db) { ex = x0 + (w >> 1); ey = y0 + h; sx = 0; sy = 1; }
      else if (mn === dr) { ex = x0 + w; ey = y0 + (h >> 1); sx = 1; sy = 0; }
      else if (mn === dt) { ex = x0 + (w >> 1); ey = y0 - 1; sx = 0; sy = -1; }
      else { ex = x0 - 1; ey = y0 + (h >> 1); sx = -1; sy = 0; }
      const poi = {
        id: W.nextId(S), kind: 'poi', type, tx: x0, ty: y0, w, h, ex, ey,
        searchesLeft: def.searches, discovered: false, rumor: false, looted: 0,
        variant: rng.int(0, 99999), hp: def.hp || 0, maxHp: def.hp || 0, spawnT: 0, dead: false,
      };
      S.pois.push(poi);
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) poiMask[I(x, y)] = poi.id;
      for (let k = 0, x = ex, y = ey; k < 8 && inb(x, y); k++, x += sx, y += sy) {
        const i = I(x, y);
        if (road[i] || poiMask[i]) break;
        keep[i] = 1;
        if (m.terrain[i] === T.WATER) m.terrain[i] = T.BRIDGE;
        else if (m.terrain[i] !== T.SIDEWALK && m.terrain[i] !== T.CONCRETE) m.terrain[i] = blk.k === 'forest' || blk.k === 'farm' ? T.DIRT : T.SIDEWALK;
      }
      if (blk.k === 'downtown' && type !== 'ruin' && rng.chance(0.4)) m.terrain[I(ex, ey)] = T.RUBBLE;
      return poi;
    }
    function place(type, kinds, count, minD, maxD) {
      let placed = 0;
      const pool = blocks.filter((b) => kinds.includes(b.k));
      const any = blocks.filter((b) => b.k !== 'base');
      for (const list of [pool, any]) {
        const order = rng.shuffle(list.slice());
        for (const blk of order) {
          if (placed >= count) break;
          if (tryPlaceIn(type, blk, minD, maxD)) placed++;
        }
        if (placed >= count) break;
      }
      return placed;
    }
    const FAR = 999;
    place('hospital', ['downtown'], 1, 26, FAR);
    place('police', ['downtown', 'residential'], 1, 25, FAR);
    place('market', ['downtown', 'residential'], 2, 14, FAR);
    place('pharmacy', ['residential', 'downtown'], 2, 14, FAR);
    place('hardware', ['residential', 'industrial'], 1, 14, FAR);
    place('gas', ['residential', 'industrial', 'farm', 'downtown'], 2, 18, FAR);
    place('warehouse', ['industrial'], 2, 16, FAR);
    place('factory', ['industrial'], 1, 20, FAR);
    place('farmhouse', ['farm'], 2, 20, FAR);
    place('camp', ['forest', 'park', 'farm'], 2, 22, FAR);
    place('nest', ['forest', 'industrial', 'downtown', 'farm'], 3, 38, FAR);
    place('ruin', ['downtown'], 5, 14, FAR);
    // Houses fill residential blocks, with a few scattered farther out.
    for (const blk of blocks) {
      const area = (blk.x1 - blk.x0 + 1) * (blk.y1 - blk.y0 + 1);
      const tries = blk.k === 'residential' ? Math.floor(area / 45) + rng.int(0, 2) : blk.k === 'farm' || blk.k === 'forest' || blk.k === 'park' ? (rng.chance(0.35) ? 3 : 0) : blk.k === 'downtown' ? 4 : 0;
      for (let t = 0; t < tries; t++) tryPlaceIn('house', blk, 11, FAR);
    }
    // Make sure there are at least two houses within reach of the base.
    let nearHouses = S.pois.filter((p) => p.type === 'house' && dBase(p.tx + 1.5, p.ty + 1.5) < 22).length;
    for (const blk of blocks.slice().sort((p, q) => dBase(p.cx, p.cy) - dBase(q.cx, q.cy))) {
      if (nearHouses >= 2) break;
      for (let t = 0; t < 30 && nearHouses < 2; t++) if (tryPlaceIn('house', blk, 11, 22)) nearHouses++;
    }

    // 8. Features: vegetation, wrecks, debris, containers, crates, hazards.
    const R = (p) => rng.next() < p;
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
      const i = I(x, y);
      if (poiMask[i] || keep[i] || isWater(x, y) || m.terrain[i] === T.BRIDGE) continue;
      const db = dBase(x, y);
      if (road[i]) {
        // Abandoned cars on roads, never next to each other so a lane always stays open.
        if (db > 7 && R(0.035)) {
          let near = false;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (m.feature[I(x + dx, y + dy)] === F.CAR) near = true;
          if (!near) { m.feature[i] = F.CAR; m.famt[i] = rng.int(24, 40); }
        }
        continue;
      }
      if (db < 5) continue;
      const dd = dist[i];
      const fn = UB.fbm(ns + 90, x / 9, y / 9, 2);
      let f = F.NONE;
      switch (dd) {
        case D.FOREST: f = R(0.2 + fn * 0.45) ? (fn > 0.55 ? F.PINE : R(0.08) ? F.DEADTREE : F.TREE) : R(0.08) ? F.BUSH : R(0.015) ? F.ROCK : F.NONE; break;
        case D.PARK: f = R(0.12) ? F.TREE : R(0.07) ? F.BUSH : F.NONE; break;
        case D.RES: f = R(0.05) ? F.TREE : R(0.05) ? F.BUSH : R(0.008) ? F.DEBRIS : F.NONE; break;
        case D.FARM: f = m.terrain[i] === T.GRASS && R(0.1) ? F.TREE : m.terrain[i] === T.DIRT && R(0.03) ? F.FENCE : F.NONE; break;
        case D.DOWN: f = R(0.05) ? F.DEBRIS : R(0.012) ? F.DEADTREE : R(0.008) ? F.CAR : F.NONE; break;
        case D.IND: f = R(0.03) ? F.CONTAINER : R(0.04) ? F.DEBRIS : R(0.006) ? F.CAR : F.NONE; break;
        case D.BASE: f = db > 7 && R(0.06) ? F.TREE : db > 7 && R(0.03) ? F.BUSH : F.NONE; break;
        default: break;
      }
      if (f === F.NONE) continue;
      m.feature[i] = f;
      const def = UB.DEF.FEATURE[f];
      if (def.amt) m.famt[i] = rng.int(def.amt[0], def.amt[1]);
    }
    // Hazards: toxic spills in the industrial area, fires among downtown ruins.
    for (let k = 0; k < 2; k++) {
      const cx = Math.round(ic.x + rng.range(-8, 8)), cy = Math.round(ic.y + rng.range(-8, 8));
      const r = rng.range(1.6, 2.8);
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) {
        if (!inb(x, y) || poiMask[I(x, y)] || keep[I(x, y)] || isWater(x, y)) continue;
        if (Math.hypot(x - cx, y - cy) <= r + UB.hash3(x, y, ns) * 0.8) { m.terrain[I(x, y)] = T.TOXIC; if (!UB.DEF.FEATURE[m.feature[I(x, y)]] || !UB.DEF.FEATURE[m.feature[I(x, y)]].block) m.feature[I(x, y)] = F.NONE; }
      }
    }
    for (const p of S.pois.filter((q) => q.type === 'ruin')) {
      if (!rng.chance(0.6)) continue;
      const x = p.tx + p.w, y = p.ty + rng.int(0, p.h - 1);
      if (inb(x, y) && !road[I(x, y)] && !poiMask[I(x, y)] && !keep[I(x, y)] && !isWater(x, y)) { m.feature[I(x, y)] = F.FIRE; m.terrain[I(x, y)] = T.RUBBLE; }
    }
    // Military checkpoints: concrete barriers across part of a main road with an ammo crate.
    let checkpoints = 0;
    for (let t = 0; t < 400 && checkpoints < 3; t++) {
      const x = rng.int(2, N - 3), y = rng.int(2, N - 3);
      const i = I(x, y);
      if (road[i] !== 2 || dBase(x, y) < 18 || dBase(x, y) > 45 || m.feature[i]) continue;
      const vertical = road[I(x, y - 1)] && road[I(x, y + 1)];
      const ox = vertical ? 1 : 0, oy = vertical ? 0 : 1;
      // Barrier on this lane, crate on the curb beside the road.
      m.feature[i] = F.BARRIER;
      for (let s = 1; s < 4; s++) {
        const cx = x - ox * s, cy = y - oy * s;
        if (inb(cx, cy) && !road[I(cx, cy)] && !poiMask[I(cx, cy)] && !isWater(cx, cy)) { m.feature[I(cx, cy)] = F.CRATE; m.famt[I(cx, cy)] = 1; break; }
      }
      checkpoints++;
    }
    // Scattered supply crates.
    for (let t = 0, made = 0; t < 600 && made < 10; t++) {
      const x = rng.int(2, N - 3), y = rng.int(2, N - 3);
      const i = I(x, y);
      if (m.feature[i] || poiMask[i] || isWater(x, y) || dBase(x, y) < 14) continue;
      m.feature[i] = F.CRATE; m.famt[i] = 0; made++;
    }

    // 9. Base clearing, then balanced starting resources nearby.
    for (let y = by - 8; y <= by + 8; y++) for (let x = bx - 8; x <= bx + 8; x++) {
      if (!inb(x, y)) continue;
      const d = dBase(x, y), i = I(x, y);
      if (d <= 6.5) { m.feature[i] = F.NONE; if (!road[i] && m.terrain[i] !== T.BRIDGE) m.terrain[i] = UB.hash3(x, y, ns) < 0.2 ? T.DIRT : T.GRASS; if (m.terrain[i] === T.WATER) m.terrain[i] = T.GRASS; }
      else if (d <= 8 && UB.DEF.FEATURE[m.feature[i]] && UB.DEF.FEATURE[m.feature[i]].block && !UB.DEF.FEATURE[m.feature[i]].res) m.feature[i] = F.NONE;
    }
    function countNear(pred, r) {
      let c = 0;
      for (let y = by - r; y <= by + r; y++) for (let x = bx - r; x <= bx + r; x++) if (inb(x, y) && dBase(x, y) <= r && pred(m.feature[I(x, y)])) c++;
      return c;
    }
    function addNear(f, need, r0, r1) {
      for (let t = 0; t < 500 && need > 0; t++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(r0, r1);
        const x = Math.round(bx + Math.cos(a) * r), y = Math.round(by + Math.sin(a) * r);
        if (!inb(x, y)) continue;
        const i = I(x, y);
        if (m.feature[i] || poiMask[i] || keep[i] || road[i] || isWater(x, y) || m.terrain[i] === T.BRIDGE) continue;
        m.feature[i] = f;
        const def = UB.DEF.FEATURE[f];
        m.famt[i] = rng.int(def.amt[0], def.amt[1]);
        need--;
      }
    }
    const isWood = (f) => f === F.TREE || f === F.PINE || f === F.DEADTREE;
    const isScrap = (f) => f === F.CAR || f === F.DEBRIS || f === F.CONTAINER;
    addNear(F.TREE, 16 - countNear(isWood, 14), 7.5, 14);
    addNear(F.DEBRIS, 3 - countNear((f) => f === F.DEBRIS, 14), 7.5, 13);
    addNear(F.CAR, 5 - countNear(isScrap, 14), 8, 14);

    // 10. Register POIs and derive blocking, then guarantee every goal is reachable.
    W.rebuild(S);
    const start = { x: bx, y: by + 3 };
    const targets = [];
    for (const p of S.pois) targets.push({ x: p.ex, y: p.ey });
    // Horde spawn points: road exits on the map border plus a few random border tiles.
    const spawns = [];
    const sideName = (x, y) => (x === 0 ? 'Noroeste' : y === 0 ? 'Nordeste' : x === N - 1 ? 'Sudeste' : 'Sudoeste');
    const border = [];
    for (let k = 0; k < N; k++) border.push([k, 0], [k, N - 1], [0, k], [N - 1, k]);
    let lastRoad = null;
    for (const [x, y] of border) {
      const i = I(x, y);
      if (road[i] && !isWater(x, y)) {
        if (!lastRoad || Math.abs(lastRoad[0] - x) + Math.abs(lastRoad[1] - y) > 3) spawns.push({ x, y, side: sideName(x, y) });
        lastRoad = [x, y];
      }
    }
    for (const side of [0, 1, 2, 3]) {
      for (let k = 0; k < 2; k++) {
        const s = rng.int(10, N - 11);
        const [x, y] = side === 0 ? [0, s] : side === 1 ? [s, 0] : side === 2 ? [N - 1, s] : [s, N - 1];
        if (!isWater(x, y) && !poiMask[I(x, y)]) spawns.push({ x, y, side: sideName(x, y) });
      }
    }
    for (const sp of spawns) { const i = I(sp.x, sp.y); if (m.feature[i]) m.feature[i] = F.NONE; targets.push(sp); }
    W.rebuild(S);
    carveConnectivity(S, start, targets);
    W.rebuild(S);
    S.spawns = spawns;

    // Rumours: the radio chatter tells where a few key places are.
    for (const type of ['hospital', 'police', 'gas']) {
      const p = S.pois.find((q) => q.type === type);
      if (p) p.rumor = true;
    }
    // Explored area around the base.
    for (let y = by - 14; y <= by + 14; y++) for (let x = bx - 14; x <= bx + 14; x++) if (inb(x, y) && dBase(x, y) <= 13) m.explored[I(x, y)] = 1;

    populate(S, rng, dBase);
  }

  // Dijkstra from the base over every tile; blocked features are passable at a high cost so
  // unreachable goals can be connected by clearing the cheapest route (trees cut, water bridged).
  function carveConnectivity(S, start, targets) {
    const N = S.map.w, m = S.map;
    const I = (x, y) => y * N + x;
    const reach = new Uint8Array(N * N);
    const q = [I(start.x, start.y)];
    reach[q[0]] = 1;
    while (q.length) {
      const i = q.pop();
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = I(xx, yy);
        if (reach[j] || S._blockU[j]) continue;
        reach[j] = 1; q.push(j);
      }
    }
    const missing = targets.filter((t) => !reach[I(t.x, t.y)]);
    if (!missing.length) return 0;
    const distA = new Float64Array(N * N).fill(Infinity);
    const parent = new Int32Array(N * N).fill(-1);
    const heap = new UB.U.Heap(4096);
    const s0 = I(start.x, start.y);
    distA[s0] = 0; heap.push(s0, 0);
    while (heap.size) {
      const i = heap.pop();
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const j = I(xx, yy);
        const occ = S._occ[j];
        if (occ) continue;
        const c = !S._blockU[j] ? 1 : m.terrain[j] === UB.DEF.T.WATER ? 25 : 12;
        const nd = distA[i] + c;
        if (nd < distA[j]) { distA[j] = nd; parent[j] = i; heap.push(j, nd); }
      }
    }
    let carved = 0;
    for (const t of missing) {
      let i = I(t.x, t.y);
      while (i >= 0 && i !== s0) {
        if (S._blockU[i]) {
          if (m.terrain[i] === UB.DEF.T.WATER) m.terrain[i] = UB.DEF.T.BRIDGE;
          m.feature[i] = 0; m.famt[i] = 0;
          W.refreshTile(S, i);
          carved++;
        }
        i = parent[i];
      }
    }
    return carved;
  }

  // Initial zombie population: wanderers far from the base plus guards around each POI.
  function populate(S, rng, dBase) {
    const N = S.map.w;
    const diff = DIFFICULTY[S.difficulty] || DIFFICULTY.normal;
    const wanderers = Math.round(BAL.wanderBase * diff.wander);
    for (let t = 0, made = 0; t < wanderers * 30 && made < wanderers; t++) {
      const x = rng.int(1, N - 2), y = rng.int(1, N - 2);
      if (dBase(x, y) < BAL.baseSafeRadius || S._blockZ[y * N + x] || S._occ[y * N + x]) continue;
      UB.Zombies.spawn(S, 'walker', x + 0.5, y + 0.5, { state: 'wander' });
      made++;
    }
    for (const p of S.pois) {
      const def = POIS[p.type];
      const count = p.type === 'house' ? (rng.chance(0.6) ? rng.int(1, 2) : 0) : Math.round(def.danger * 1.5) + rng.int(0, def.danger);
      const pairs = Object.entries(def.guards);
      for (let k = 0; k < count; k++) {
        const type = rng.weighted(pairs);
        for (let t = 0; t < 20; t++) {
          const x = p.ex + rng.int(-3, 3), y = p.ey + rng.int(-3, 3);
          if (x < 0 || y < 0 || x >= N || y >= N || S._blockZ[y * N + x] || S._occ[y * N + x]) continue;
          if (dBase(x + 0.5, y + 0.5) < 15) break;
          UB.Zombies.spawn(S, type, x + 0.5, y + 0.5, { state: 'idle', home: p.id });
          break;
        }
      }
    }
  }

  UB.MapGen = { generate, carveConnectivity };
})(globalThis.UB = globalThis.UB || {});
