/* Filogênese — mundo procedural: relevo, biomas, rios, ninhos, fósseis, vegetação e colisão. */
(function (FG) {
  'use strict';
  const U = FG.U, B = FG.B;
  const CELL = 40, GW = 384, SIZE = CELL * GW;   // 15360 unidades de lado
  const SEA = 0.34, DEEP_E = SEA - 0.05, PEAK = 0.79;
  const PC = 160;                                 // célula de vegetação
  const CHUNK = 640;                              // bloco de textura do chão
  const EXP = 96;                                 // grade de exploração (névoa do mapa)

  // densidade de objetos por célula de 160x160, por bioma
  const DENS = {
    [B.BEACH]: { tree: 0.1, fbush: 0.1, bush: 0.08, rock: 0.12, grass: 0.4, flower: 0, misc: 1.1 },
    [B.GRASS]: { tree: 0.22, fbush: 0.3, bush: 0.3, rock: 0.1, grass: 3.2, flower: 1.3, misc: 0.1 },
    [B.FOREST]: { tree: 1.15, fbush: 0.36, bush: 0.7, rock: 0.1, grass: 1.3, flower: 0.5, misc: 0.5 },
    [B.SAVANNA]: { tree: 0.2, fbush: 0.22, bush: 0.25, rock: 0.16, grass: 2.6, flower: 0.2, misc: 0.1 },
    [B.DESERT]: { tree: 0.2, fbush: 0.14, bush: 0.08, rock: 0.3, grass: 0.3, flower: 0, misc: 0.25 },
    [B.SWAMP]: { tree: 0.7, fbush: 0.26, bush: 0.5, rock: 0.05, grass: 1.6, flower: 0.3, misc: 1.4 },
    [B.TUNDRA]: { tree: 0.55, fbush: 0.2, bush: 0.2, rock: 0.3, grass: 0.7, flower: 0.1, misc: 0.1 },
  };
  const TREE_KIND = { [B.BEACH]: 'palm', [B.GRASS]: 'leaf', [B.FOREST]: 'leaf', [B.SAVANNA]: 'acacia', [B.DESERT]: 'cactus', [B.SWAMP]: 'willow', [B.TUNDRA]: 'pine' };
  const MISC_KIND = { [B.BEACH]: 'shell', [B.GRASS]: 'pebble', [B.FOREST]: 'mush', [B.SAVANNA]: 'pebble', [B.DESERT]: 'bones', [B.SWAMP]: 'reed', [B.TUNDRA]: 'pebble' };

  const lerp = U.lerp, sstep = U.sstep;
  function mix3(a, b, t, out) { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; }
  const C = {
    deep: [26, 78, 124], shallow: [64, 158, 172], foam: [226, 240, 236], sand: [226, 208, 150],
    dry: [158, 172, 86], lush: [92, 152, 70], forest: [58, 116, 60], swamp: [80, 104, 68],
    desert: [222, 190, 122], savanna: [196, 176, 94], jungle: [56, 126, 60],
    tundra: [200, 210, 204], taiga: [146, 168, 150], rock: [128, 122, 112], snow: [240, 244, 248],
  };
  const T1 = [0, 0, 0], T2 = [0, 0, 0], T3 = [0, 0, 0];

  class World {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.SIZE = SIZE; this.CELL = CELL; this.GW = GW; this.PC = PC; this.CHUNK = CHUNK; this.SEA = SEA; this.EXP = EXP;
      this.H = new Float32Array(GW * GW); this.M = new Float32Array(GW * GW); this.T = new Float32Array(GW * GW);
      this.Bm = new Uint8Array(GW * GW); this.reach = new Uint8Array(GW * GW);
      this.explored = new Uint8Array(EXP * EXP);
      this.cells = new Map(); this.fruitState = new Map(); this.frame = 0; this.now = 0;
      this.chunks = new Map(); this.chunkQ = []; this.job = null; this.tex = 160; this.maxChunks = 48;
      this.nests = []; this.fossils = []; this.titanSpots = []; this.ownSites = [];
      this.genTerrain();
      this.pickStart();
    }

    // ---------- relevo ----------
    genTerrain() {
      const s = this.seed, H = this.H, M = this.M, T = this.T, Bm = this.Bm;
      for (let gy = 0; gy < GW; gy++) for (let gx = 0; gx < GW; gx++) {
        const nx = gx / GW, ny = gy / GW, i = gy * GW + gx;
        const wx = nx + (U.fbm(nx * 3 + 7, ny * 3 + 3, s + 11, 3) - 0.5) * 0.22;
        const wy = ny + (U.fbm(nx * 3 - 5, ny * 3 + 11, s + 23, 3) - 0.5) * 0.22;
        let e = 0.57 + (U.fbm(wx * 4.3, wy * 4.3, s + 37, 5) - 0.5) * 1.85;
        const d = Math.hypot(nx - 0.5, ny - 0.5) * 2 + (U.fbm(nx * 2.6 + 31, ny * 2.6 + 17, s + 41, 3) - 0.5) * 0.42;
        const mask = 1 - sstep(0.6, 0.98, d);
        e = e * (0.35 + 0.65 * mask) - (1 - mask) * 0.32;
        // rios rasos serpenteando pelas terras baixas
        const rn = Math.abs(U.fbm(wx * 2.4 + 50, wy * 2.4 + 90, s + 53, 3) - 0.5);
        if (rn < 0.014 && e > SEA - 0.02 && e < 0.64) e = lerp(e, SEA - 0.028, sstep(0.014, 0.004, rn) * sstep(0.64, 0.56, e));
        H[i] = U.clamp(e, 0, 1);
        M[i] = U.clamp(0.5 + (U.fbm(nx * 3.3 + 100, ny * 3.3 + 200, s + 67, 4) - 0.5) * 1.9, 0, 1);
        T[i] = U.clamp(0.08 + ny * 0.84 + (U.fbm(nx * 2.2 + 300, ny * 2.2 + 400, s + 79, 3) - 0.5) * 0.5 - Math.max(0, e - 0.62) * 0.7, 0, 1);
        Bm[i] = World.biomeOf(H[i], M[i], T[i]);
      }
    }
    static biomeOf(e, m, t) {
      if (e < DEEP_E) return B.DEEP;
      if (e < SEA) return B.SHALLOW;
      if (e < SEA + 0.022) return B.BEACH;
      if (e > 0.86) return B.SNOW;
      if (e > PEAK) return B.ROCK;
      if (t < 0.29) return B.TUNDRA;
      if (t > 0.66) return m < 0.41 ? B.DESERT : m < 0.58 ? B.SAVANNA : B.FOREST;
      if (m > 0.66 && e < 0.5) return B.SWAMP;
      return m > 0.55 ? B.FOREST : m < 0.36 ? B.SAVANNA : B.GRASS;
    }

    /** Altura com interpolação bilinear. */
    hAt(x, y) {
      let fx = x / CELL - 0.5, fy = y / CELL - 0.5;
      if (fx < 0) fx = 0; else if (fx > GW - 1.001) fx = GW - 1.001;
      if (fy < 0) fy = 0; else if (fy > GW - 1.001) fy = GW - 1.001;
      const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * GW + x0, H = this.H;
      return (H[i] * (1 - tx) + H[i + 1] * tx) * (1 - ty) + (H[i + GW] * (1 - tx) + H[i + GW + 1] * tx) * ty;
    }
    sample(A, x, y) {
      let fx = x / CELL - 0.5, fy = y / CELL - 0.5;
      if (fx < 0) fx = 0; else if (fx > GW - 1.001) fx = GW - 1.001;
      if (fy < 0) fy = 0; else if (fy > GW - 1.001) fy = GW - 1.001;
      const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * GW + x0;
      return (A[i] * (1 - tx) + A[i + 1] * tx) * (1 - ty) + (A[i + GW] * (1 - tx) + A[i + GW + 1] * tx) * ty;
    }
    gi(x, y) { return U.clamp((y / CELL) | 0, 0, GW - 1) * GW + U.clamp((x / CELL) | 0, 0, GW - 1); }
    biomeAt(x, y) { return this.Bm[this.gi(x, y)]; }
    isLand(x, y) { const b = this.biomeAt(x, y); return b >= B.BEACH && b <= B.TUNDRA; }
    /** 0 = seco, 1 = raso, 2 = fundo. */
    wetAt(x, y) { const e = this.hAt(x, y); return e < DEEP_E ? 2 : e < SEA - 0.004 ? 1 : 0; }
    blocked(x, y, c) {
      if (x < 100 || y < 100 || x > SIZE - 100 || y > SIZE - 100) return true;
      const e = this.hAt(x, y);
      return e > PEAK || (c && !c.canSwim && e < DEEP_E);
    }

    // ---------- ponto inicial e alcance ----------
    pickStart() {
      const r = U.rng(U.hash(this.seed, 5, 99));
      let best = null;
      const a0 = r() * U.TAU;
      for (let k = 0; k < 10; k++) {
        const a = a0 + k * U.TAU / 10;
        let found = null;
        for (let d = SIZE * 0.49; d > SIZE * 0.1; d -= CELL * 0.5) {
          const x = SIZE / 2 + Math.cos(a) * d, y = SIZE / 2 + Math.sin(a) * d;
          const e = this.hAt(x, y);
          if (e > SEA + 0.012 && e < SEA + 0.08) {
            // exige terra firme mais adiante (não um banco de areia isolado)
            const x2 = SIZE / 2 + Math.cos(a) * (d - 500), y2 = SIZE / 2 + Math.sin(a) * (d - 500);
            if (!this.isLand(x2, y2)) continue;
            // recua para o interior até o ninho caber inteiro em terra seca
            let fx = x, fy = y;
            for (let q = 0; q < 12; q++) {
              let dry = this.hAt(fx, fy) > SEA + 0.016;
              for (let j = 0; j < 8 && dry; j++) { const b = j * Math.PI / 4; if (this.hAt(fx + Math.cos(b) * 120, fy + Math.sin(b) * 120) < SEA + 0.006) dry = false; }
              if (dry) break;
              fx -= Math.cos(a) * 40; fy -= Math.sin(a) * 40;
            }
            if (this.hAt(fx, fy) > PEAK - 0.05) continue;
            found = { x: fx, y: fy }; break;
          }
        }
        if (!found) continue;
        const n = this.flood(found.x, found.y);
        if (!best || n > best.n) best = { x: found.x, y: found.y, n, reach: this.reach.slice() };
        if (n > GW * GW * 0.2) break;
      }
      if (!best) best = { x: SIZE / 2, y: SIZE / 2, n: this.flood(SIZE / 2, SIZE / 2), reach: this.reach.slice() };
      this.reach = best.reach; this.start = { x: best.x, y: best.y }; this.reachN = best.n;
    }
    /** Marca as células alcançáveis a pé (terra e água rasa) a partir de um ponto. */
    flood(x, y) {
      const R = this.reach, H = this.H; R.fill(0);
      const st = [this.gi(x, y)]; R[st[0]] = 1; let n = 0;
      while (st.length) {
        const i = st.pop(); n++;
        const gx = i % GW, gy = (i / GW) | 0;
        if (gx > 0) { const j = i - 1; if (!R[j] && H[j] >= DEEP_E && H[j] <= PEAK) { R[j] = 1; st.push(j); } }
        if (gx < GW - 1) { const j = i + 1; if (!R[j] && H[j] >= DEEP_E && H[j] <= PEAK) { R[j] = 1; st.push(j); } }
        if (gy > 0) { const j = i - GW; if (!R[j] && H[j] >= DEEP_E && H[j] <= PEAK) { R[j] = 1; st.push(j); } }
        if (gy < GW - 1) { const j = i + GW; if (!R[j] && H[j] >= DEEP_E && H[j] <= PEAK) { R[j] = 1; st.push(j); } }
      }
      return n;
    }
    okSite(x, y, margin) {
      if (x < 400 || y < 400 || x > SIZE - 400 || y > SIZE - 400) return false;
      const i = this.gi(x, y), e = this.H[i];
      if (!this.reach[i] || e < SEA + (margin || 0.02) || e > 0.72) return false;
      // evita encostas e margens: os vizinhos também precisam ser terra
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; const e2 = this.hAt(x + Math.cos(a) * 110, y + Math.sin(a) * 110); if (e2 < SEA || e2 > PEAK - 0.02) return false; }
      return true;
    }

    /** Distribui ninhos, sítios do jogador, titãs e fósseis; atribui espécies por bioma e dificuldade. */
    populate(fauna) {
      const r = U.rng(U.hash(this.seed, 9, 1234));
      const S = this.start, far = (p, list, d) => { for (const q of list) if (U.dist2(p.x, p.y, q.x, q.y) < d * d) return false; return true; };
      const pts = [];
      // dois ninhos garantidos perto do início, para o jogo engrenar logo
      for (let k = 0; k < 600 && pts.length < 2; k++) {
        const a = r() * U.TAU, d = r.range(700, 1000), p = { x: S.x + Math.cos(a) * d, y: S.y + Math.sin(a) * d };
        if (this.okSite(p.x, p.y) && far(p, pts, 650)) pts.push(p);
      }
      for (let k = 0; k < 9000 && pts.length < 48; k++) {
        const p = { x: r.range(400, SIZE - 400), y: r.range(400, SIZE - 400) };
        if (!this.okSite(p.x, p.y) || U.dist(p.x, p.y, S.x, S.y) < 620 || !far(p, pts, 1000)) continue;
        pts.push(p);
      }
      pts.sort((a, b) => U.dist2(a.x, a.y, S.x, S.y) - U.dist2(b.x, b.y, S.x, S.y));
      const maxD = pts.length ? U.dist(pts[pts.length - 1].x, pts[pts.length - 1].y, S.x, S.y) : 1;
      // sítios do jogador: o inicial e dois de migração, cada vez mais para o interior
      this.ownSites = [{ x: S.x, y: S.y }];
      for (const f of [0.38, 0.7]) {
        let bi = -1, bd = 1e18;
        for (let i = 3; i < pts.length; i++) { if (pts[i].own) continue; const d = Math.abs(U.dist(pts[i].x, pts[i].y, S.x, S.y) - maxD * f); if (d < bd) { bd = d; bi = i; } }
        if (bi >= 0) { pts[bi].own = true; this.ownSites.push({ x: pts[bi].x, y: pts[bi].y }); }
      }
      const spots = pts.filter((p) => !p.own);
      const N = spots.length, cand = fauna.list.filter((s) => !s.isTitan);
      for (const s of cand) s.nestCount = 0;
      this.nests = spots.map((p, i) => {
        const tier = i < 3 ? 0 : Math.min(4, Math.floor(((i - 2) / Math.max(1, N - 2)) * 4.6 + 0.35));
        const biome = this.biomeAt(p.x, p.y);
        let best = null, bs = 1e9;
        for (const s of cand) {
          if (i < 3 && FG.Species.NICHES[s.niche].react !== 'flee' && s.niche !== 'cantor' && s.niche !== 'anfibio') continue;
          const sc = Math.abs(s.tier - tier) * 10 + (s.biome === biome ? 0 : 4) + s.nestCount * 7 + r() * 2;
          if (sc < bs) { bs = sc; best = s; }
        }
        if (!best) best = cand[0];
        best.nestCount++;
        const max = r.int(best.group[0], best.group[1]);
        return { id: i, x: p.x, y: p.y, sp: best.id, tier, biome, max, pop: max, eggs: r.int(2, 3), spawned: false, found: false, regen: 0 };
      });
      // nenhuma espécie fica sem ninho: toma um de quem tem de sobra
      for (const s of cand) {
        if (s.nestCount > 0) continue;
        let bn = null, bs = 1e9;
        for (const n of this.nests) { const o = fauna.byId[n.sp]; if (o.nestCount < 2 || n.id < 3) continue; const sc = Math.abs(n.tier - s.tier) * 10 + r(); if (sc < bs) { bs = sc; bn = n; } }
        if (bn) { fauna.byId[bn.sp].nestCount--; bn.sp = s.id; s.nestCount = 1; bn.max = bn.pop = r.int(s.group[0], s.group[1]); }
      }
      for (const s of cand) {
        let pop = 0; for (const n of this.nests) if (n.sp === s.id) pop += n.max;
        s.totalPop = pop;
        s.needFriends = U.clamp(Math.ceil(pop * 0.35), 1, 3);
        s.needKills = U.clamp(Math.ceil(pop * 0.6), 1, 6);
      }
      // titãs: longe do início e dos ninhos
      this.titanSpots = [];
      const all = pts.concat([S]);
      for (let k = 0; k < 6000 && this.titanSpots.length < fauna.titans.length; k++) {
        const p = { x: r.range(600, SIZE - 600), y: r.range(600, SIZE - 600) };
        if (!this.okSite(p.x, p.y) || U.dist(p.x, p.y, S.x, S.y) < maxD * 0.45 || !far(p, all, 560) || !far(p, this.titanSpots, 2600)) continue;
        this.titanSpots.push({ x: p.x, y: p.y, sp: fauna.titans[this.titanSpots.length], alive: true });
      }
      for (const t of this.titanSpots) { const s = fauna.byId[t.sp]; s.needFriends = 1; s.needKills = 1; s.totalPop = 1; }
      // fósseis
      this.fossils = [];
      const fp = [];
      for (let k = 0; k < 9000 && fp.length < 36; k++) {
        const p = { x: r.range(300, SIZE - 300), y: r.range(300, SIZE - 300) };
        if (!this.okSite(p.x, p.y, 0.012) || !far(p, all, 300) || !far(p, fp, 760)) continue;
        fp.push(p);
      }
      // um fóssil garantido perto do início (objetivo do tutorial)
      for (let k = 0; k < 400; k++) {
        const a = r() * U.TAU, d = r.range(380, 620), p = { x: S.x + Math.cos(a) * d, y: S.y + Math.sin(a) * d };
        if (this.okSite(p.x, p.y, 0.012) && far(p, this.nests, 260)) { fp.unshift(p); break; }
      }
      this.fossils = fp.map((p, i) => ({ id: i, x: p.x, y: p.y, tier: U.clamp(Math.floor(U.dist(p.x, p.y, S.x, S.y) / maxD * 4.4), 0, 3), taken: false }));
      this.maxD = maxD;
    }

    // ---------- vegetação por célula ----------
    cellAt(cx, cy) {
      const key = cx * 4096 + cy;
      let c = this.cells.get(key);
      if (!c) { c = this.genCell(cx, cy, key); this.cells.set(key, c); }
      c.last = this.frame;
      return c;
    }
    genCell(cx, cy, key) {
      const items = [], solids = [], bushes = [];
      const bx = cx * PC, by = cy * PC;
      const cell = { items, solids, bushes, last: 0 };
      if (cx < 0 || cy < 0 || bx >= SIZE || by >= SIZE) return cell;
      const r = U.rng(U.hash(cx, cy, this.seed ^ 0x5bd1e995));
      const b0 = this.biomeAt(bx + PC / 2, by + PC / 2);
      const wetCell = b0 === B.SHALLOW;
      const D = DENS[b0];
      if (!D && !wetCell) return cell;
      const near = (x, y, rad) => {
        for (const n of this.nests) if (U.dist2(x, y, n.x, n.y) < rad * rad) return true;
        for (const s of this.ownSites) if (U.dist2(x, y, s.x, s.y) < rad * rad) return true;
        for (const f of this.fossils) if (U.dist2(x, y, f.x, f.y) < 70 * 70) return true;
        return false;
      };
      const put = (t, n, fn) => {
        const cnt = Math.floor(n + r());
        for (let i = 0; i < cnt; i++) {
          const x = bx + r() * PC, y = by + r() * PC, b = this.biomeAt(x, y);
          const it = fn(x, y, b);
          if (it) { it.t = t; it.x = x; it.y = y; it.id = key * 64 + items.length; items.push(it); if (it.r) solids.push(it); }
        }
      };
      if (wetCell) {
        put('reed', 0.9, (x, y, b) => (b === B.SHALLOW && this.hAt(x, y) > SEA - 0.02 ? { s: r.range(0.8, 1.3), v: r.int(0, 2) } : null));
        put('lily', 0.35, (x, y, b) => (b === B.SHALLOW && this.sample(this.M, x, y) > 0.5 ? { s: r.range(0.7, 1.2), v: r.int(0, 2) } : null));
        return cell;
      }
      const land = (b) => b >= B.BEACH && b <= B.TUNDRA;
      const hill = sstep(0.62, 0.76, this.hAt(bx + PC / 2, by + PC / 2));
      put('tree', D.tree * (1 - hill * 0.6), (x, y, b) => {
        if (!land(b) || near(x, y, 190)) return null;
        let kind = TREE_KIND[b] || 'leaf';
        if (b === B.DESERT && r.chance(0.25)) kind = 'dead';
        const s = r.range(0.8, 1.25);
        return { kind, s, v: r.int(0, 2), r: (kind === 'cactus' ? 9 : 11) * s };
      });
      put('fbush', D.fbush, (x, y, b) => {
        if (!land(b) || near(x, y, 120)) return null;
        const it = { s: r.range(0.9, 1.15), v: r.int(0, 2), r: 13, fruit: 3, regrow: 0, biome: b };
        bushes.push(it);
        return it;
      });
      put('bush', D.bush, (x, y, b) => (land(b) && !near(x, y, 110) ? { s: r.range(0.7, 1.2), v: r.int(0, 2), biome: b } : null));
      put('rock', D.rock + hill * 1.2, (x, y, b) => { if (!land(b) || near(x, y, 130)) return null; const s = r.range(0.6, 1.5); return { s, v: r.int(0, 2), r: 13 * s }; });
      put('grass', D.grass, (x, y, b) => (land(b) && b !== B.BEACH ? { s: r.range(0.7, 1.3), v: r.int(0, 2), biome: b } : null));
      put('flower', D.flower, (x, y, b) => (land(b) ? { s: r.range(0.8, 1.2), v: r.int(0, 4) } : null));
      put('misc', D.misc, (x, y, b) => (land(b) && !near(x, y, 90) ? { kind: MISC_KIND[b] || 'pebble', s: r.range(0.7, 1.3), v: r.int(0, 2) } : null));
      // restaura o estado de frutos já colhidos
      for (const it of bushes) { const st = this.fruitState.get(it.id); if (st) { it.fruit = st.fruit; it.regrow = st.regrow; } }
      return cell;
    }
    /** Remove células de vegetação não usadas há tempo (chamado de vez em quando). */
    prune() {
      if (this.cells.size < 700) return;
      const lim = this.frame - 600;
      for (const [k, c] of this.cells) if (c.last < lim) this.cells.delete(k);
    }
    bushFruit(it) {
      if (it.fruit < 3 && this.now >= it.regrow) { it.fruit++; it.regrow = this.now + 40; this.fruitState.set(it.id, { fruit: it.fruit, regrow: it.regrow }); }
      return it.fruit;
    }
    takeFruit(it) {
      if (this.bushFruit(it) <= 0) return false;
      it.fruit--; it.regrow = this.now + 55;
      this.fruitState.set(it.id, { fruit: it.fruit, regrow: it.regrow });
      return true;
    }
    /** Arbusto com fruto mais próximo dentro de `rad`. */
    findBush(x, y, rad) {
      const c0x = Math.floor((x - rad) / PC), c1x = Math.floor((x + rad) / PC), c0y = Math.floor((y - rad) / PC), c1y = Math.floor((y + rad) / PC);
      let best = null, bd = rad * rad;
      for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
        const bs = this.cellAt(cx, cy).bushes;
        for (let i = 0; i < bs.length; i++) { const it = bs[i], d = U.dist2(x, y, it.x, it.y); if (d < bd && this.bushFruit(it) > 0) { bd = d; best = it; } }
      }
      return best;
    }

    /** Resolve colisão do corpo `c` com o terreno e com troncos/rochas; atualiza c.wet e c.biome. */
    resolve(c, ox, oy) {
      if (c.x !== c.x || c.y !== c.y) { c.x = ox; c.y = oy; c.vx = c.vy = 0; }
      if (this.blocked(c.x, c.y, c)) {
        if (!this.blocked(c.x, oy, c)) { c.y = oy; c.vy = 0; }
        else if (!this.blocked(ox, c.y, c)) { c.x = ox; c.vx = 0; }
        else { c.x = ox; c.y = oy; c.vx = c.vy = 0; }
        c.bumped = true;
      }
      const e = this.hAt(c.x, c.y);
      c.wet = e < DEEP_E ? 2 : e < SEA - 0.004 ? 1 : 0;
      c.biome = this.Bm[this.gi(c.x, c.y)];
      if (c.jz > 14) return;
      const rad = c.radius * 0.8, cx0 = Math.floor(c.x / PC), cy0 = Math.floor(c.y / PC);
      for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
        const sl = this.cellAt(cx, cy).solids;
        for (let i = 0; i < sl.length; i++) {
          const it = sl[i], dx = c.x - it.x, dy = c.y - it.y, min = rad + it.r, d2 = dx * dx + dy * dy;
          if (d2 < min * min && d2 > 0.0001) { const d = Math.sqrt(d2), p = (min - d); c.x += dx / d * p; c.y += dy / d * p; }
        }
      }
    }

    /** Ponto caminhável aleatório perto de (x, y). */
    randomNear(x, y, r0, r1, rnd, c) {
      for (let k = 0; k < 12; k++) {
        const a = rnd() * U.TAU, d = r0 + rnd() * (r1 - r0), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (!this.blocked(px, py, c) && this.hAt(px, py) > DEEP_E + 0.01) return { x: px, y: py };
      }
      return { x, y };
    }

    reveal(x, y, rad) {
      const k = SIZE / EXP, E = this.explored;
      const x0 = Math.max(0, Math.floor((x - rad) / k)), x1 = Math.min(EXP - 1, Math.floor((x + rad) / k));
      const y0 = Math.max(0, Math.floor((y - rad) / k)), y1 = Math.min(EXP - 1, Math.floor((y + rad) / k));
      let ch = false;
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        if (E[gy * EXP + gx]) continue;
        if (U.dist2((gx + 0.5) * k, (gy + 0.5) * k, x, y) < rad * rad) { E[gy * EXP + gx] = 1; ch = true; }
      }
      return ch;
    }

    // ---------- cor do chão ----------
    /** Escreve em `out` [r,g,b,a] a cor do terreno. n1: ruído fino (-1..1), sh: sombreado do relevo. */
    groundColor(e, m, t, n1, sh, out) {
      // água: cor por profundidade, espuma na beira e transição suave para a areia molhada
      const shore = sstep(SEA - 0.004, SEA + 0.004, e);
      let wr = 0, wg = 0, wb = 0, wa = 255;
      if (shore < 1) {
        mix3(C.shallow, C.deep, sstep(SEA, DEEP_E - 0.06, e), out);
        const foam = sstep(SEA - 0.013, SEA - 0.002, e);
        if (foam > 0) mix3(out, C.foam, foam * 0.6, out);
        wr = out[0]; wg = out[1]; wb = out[2]; wa = 170 + foam * 60;
        if (shore <= 0) { out[3] = wa; return out; }
      }
      const temperate = mix3(C.dry, C.lush, sstep(0.3, 0.52, m), T1);
      mix3(temperate, C.forest, sstep(0.5, 0.6, m), temperate);
      mix3(temperate, C.swamp, sstep(0.64, 0.7, m) * sstep(0.52, 0.47, e), temperate);
      const hot = mix3(C.desert, C.savanna, sstep(0.37, 0.45, m), T2);
      mix3(hot, C.jungle, sstep(0.55, 0.62, m), hot);
      const cold = mix3(C.tundra, C.taiga, sstep(0.45, 0.7, m), T3);
      mix3(temperate, hot, sstep(0.61, 0.71, t), out);
      mix3(out, cold, sstep(0.34, 0.25, t), out);
      const sand = sstep(SEA + 0.03, SEA + 0.014, e);
      if (sand > 0) mix3(out, C.sand, sand, out);
      const rock = sstep(0.73, 0.8, e);
      if (rock > 0) mix3(out, C.rock, rock, out);
      const snow = sstep(0.84, 0.88, e);
      if (snow > 0) mix3(out, C.snow, snow, out);
      const k = (0.93 + (e - 0.5) * 0.22 + n1 * 0.05) * sh * (0.86 + 0.14 * sstep(SEA, SEA + 0.012, e));
      out[0] *= k; out[1] *= k; out[2] *= k; out[3] = 255;
      if (shore < 1) { out[0] = wr + (out[0] - wr) * shore; out[1] = wg + (out[1] - wg) * shore; out[2] = wb + (out[2] - wb) * shore; out[3] = wa + (255 - wa) * shore; }
      return out;
    }

    /** Pinta um bloco de chão num ImageData (res x res pixels cobrindo CHUNK unidades); r0..r1 limita as linhas. */
    paintChunk(img, cx, cy, res, r0, r1) {
      const data = img.data, step = CHUNK / res, col = [0, 0, 0, 255], s = this.seed;
      const x0 = cx * CHUNK, y0 = cy * CHUNK;
      if (r0 == null) { r0 = 0; r1 = res; }
      let p = r0 * res * 4;
      for (let py = r0; py < r1; py++) {
        const wy = y0 + (py + 0.5) * step;
        for (let px = 0; px < res; px++) {
          const wx = x0 + (px + 0.5) * step;
          const e = this.hAt(wx, wy);
          const sh = e < SEA - 0.004 ? 1 : U.clamp(1 + (this.hAt(wx - 14, wy - 14) - this.hAt(wx + 14, wy + 14)) * 5.5, 0.72, 1.3);
          const n1 = (U.hash(wx / step | 0, wy / step | 0, s) / 2147483648 - 1) * 0.6 + (U.vnoise(wx / 38, wy / 38, s + 5) - 0.5) * 2.4;
          this.groundColor(e, this.sample(this.M, wx, wy), this.sample(this.T, wx, wy), n1, sh, col);
          data[p++] = col[0]; data[p++] = col[1]; data[p++] = col[2]; data[p++] = col[3];
        }
      }
    }
    /** Canvas do bloco (cx, cy) ou null se ainda está na fila. */
    chunk(cx, cy) {
      const key = cx * 4096 + cy, ch = this.chunks.get(key);
      if (ch) { ch.last = this.frame; return ch.cv; }
      if (cx < 0 || cy < 0 || cx * CHUNK >= SIZE || cy * CHUNK >= SIZE) return null;
      if (!this.chunkQ.includes(key) && !(this.job && this.job.key === key)) this.chunkQ.push(key);
      return null;
    }
    /** Pinta blocos da fila aos poucos (algumas linhas por vez) dentro do orçamento de tempo em ms, para não engasgar. */
    pump(budget) {
      const t0 = performance.now();
      while (performance.now() - t0 < budget) {
        let job = this.job;
        if (!job) {
          if (!this.chunkQ.length) break;
          const key = this.chunkQ.shift(), res = this.tex;
          const cv = document.createElement('canvas'); cv.width = cv.height = res;
          const ctx = cv.getContext('2d');
          job = this.job = { key, cx: Math.floor(key / 4096), cy: key % 4096, res, cv, ctx, img: ctx.createImageData(res, res), row: 0 };
        }
        const r1 = Math.min(job.res, job.row + 6);
        this.paintChunk(job.img, job.cx, job.cy, job.res, job.row, r1);
        job.row = r1;
        if (r1 >= job.res) { job.ctx.putImageData(job.img, 0, 0); this.chunks.set(job.key, { cv: job.cv, last: this.frame }); this.job = null; }
      }
      if (this.chunks.size > this.maxChunks) {
        let ok = null, ol = 1e18;
        for (const [k, c] of this.chunks) if (c.last < ol) { ol = c.last; ok = k; }
        if (ok != null && ol < this.frame - 30) this.chunks.delete(ok);
      }
    }
    setQuality(q) {
      const tex = q === 'high' ? 320 : q === 'low' ? 96 : 160;
      this.maxChunks = q === 'low' ? 30 : 48;
      if (tex !== this.tex) { this.tex = tex; this.chunks.clear(); this.chunkQ.length = 0; this.job = null; }
    }
    /** Mapa-múndi (1 pixel por célula). */
    mapCanvas() {
      if (this._map) return this._map;
      const cv = document.createElement('canvas'); cv.width = cv.height = GW;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(GW, GW), d = img.data, col = [0, 0, 0, 255];
      for (let i = 0; i < GW * GW; i++) {
        const e = this.H[i], gx = i % GW;
        const sh = e < SEA || gx === 0 || i < GW ? 1 : U.clamp(1 + (this.H[i - GW - 1] - e) * 9, 0.7, 1.35);
        this.groundColor(e, this.M[i], this.T[i], 0, sh, col);
        d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return (this._map = cv);
    }
  }
  World.SIZE = SIZE; World.CELL = CELL; World.PC = PC; World.CHUNK = CHUNK; World.SEA = SEA; World.EXP = EXP;
  FG.World = World;
})(window.FG = window.FG || {});
