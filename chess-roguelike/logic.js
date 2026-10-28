// Peões & Perdição — pure game logic (no DOM).
// Loaded as a plain <script> in the browser (window.ChessRL) and with require() in tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessRL = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- RNG ----------
  function makeRng(seed) {
    let s = seed >>> 0 || 1;
    const r = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    r.weighted = (table) => {
      let total = 0;
      for (const k in table) total += table[k];
      let x = r() * total;
      for (const k in table) if ((x -= table[k]) < 0) return k;
      return Object.keys(table)[0];
    };
    return r;
  }
  function hash(...parts) {
    let h = 2166136261;
    for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  const rngFor = (...parts) => makeRng(hash(...parts));

  // ---------- Catalogues ----------
  const FLOOR = 0, ROCK = 1, PIT = 2;
  const NAMES = { K: 'Rei', Q: 'Rainha', R: 'Torre', B: 'Bispo', N: 'Cavalo', P: 'Peão' };
  const VALUE = { P: 100, N: 300, B: 320, R: 500, Q: 900, K: 0 };
  const PRICE = { P: 30, N: 70, B: 70, R: 110, Q: 200 };
  const MUT_PRICE = 80, AMULET_PRICE = 140;
  const KING_DEAD = 100000;

  const MUTATIONS = {
    hop: { name: 'Saltitante', icon: 'hop', desc: 'Sempre pode avançar 2 casas.', only: ['P'] },
    retreat: { name: 'Marcha-ré', icon: 'retreat', desc: 'Também anda 1 casa para trás.', only: ['P'] },
    orth1: { name: 'Passo Reto', icon: 'orth', desc: 'Também anda/captura 1 casa em linha reta.', not: ['Q', 'R', 'K'] },
    diag1: { name: 'Passo Torto', icon: 'diag', desc: 'Também anda/captura 1 casa na diagonal.', not: ['Q', 'B', 'K'] },
    leap: { name: 'Galope', icon: 'leap', desc: 'Também salta como o Cavalo.', not: ['N'] },
    shield: { name: 'Escudo', icon: 'shield', desc: 'Sobrevive ao primeiro ataque de cada batalha.' },
    bomb: { name: 'Explosivo', icon: 'bomb', desc: 'Ao ser capturado explode e leva junto todos ao redor (menos reis).', not: ['K'] },
    vampire: { name: 'Vampiro', icon: 'fang', desc: 'Ao capturar, ganha um escudo.' },
    royal: { name: 'Majestade', icon: 'crown', desc: 'Anda como a Rainha.', only: ['K'], hidden: true },
  };
  const canMutate = (type, muts, id) => {
    const m = MUTATIONS[id];
    if (!m || muts.includes(id)) return false;
    if (m.only && !m.only.includes(type)) return false;
    if (m.not && m.not.includes(type)) return false;
    return true;
  };

  const AMULETS = {
    aegis: { name: 'Coroa de Ferro', icon: 'helm', desc: 'Seu Rei começa toda batalha com escudo.' },
    midPromo: { name: 'Pergaminho da Ascensão', icon: 'scroll', desc: 'Peões promovem ao cruzar o meio do tabuleiro.' },
    phoenix: { name: 'Pena de Fênix', icon: 'feather', desc: 'A primeira peça perdida em cada batalha volta depois dela.' },
    greed: { name: 'Bolsa Gulosa', icon: 'pouch', desc: '+50% de ouro das batalhas.' },
    lucky: { name: 'Trevo de 4 Folhas', icon: 'clover', desc: 'Recompensas oferecem 4 opções.' },
    warband: { name: 'Tambor de Guerra', icon: 'drum', desc: '+1 fileira para posicionar tropas.' },
    spoils: { name: 'Saqueador', icon: 'flag', desc: '+6 de ouro por peça inimiga capturada.' },
  };

  const KINGS = [
    {
      id: 'belly', name: 'Rei Barrigudo', desc: 'Lento mas teimoso. O Rei começa toda batalha com escudo.',
      army: [['K'], ['P'], ['P'], ['P'], ['N'], ['R']], gold: 40, amulets: ['aegis'],
    },
    {
      id: 'merchant', name: 'Rei Mercador', desc: 'Exército pequeno, bolso cheio. +50% de ouro.',
      army: [['K'], ['P'], ['P'], ['N'], ['B']], gold: 160, amulets: ['greed'],
    },
    {
      id: 'mad', name: 'Rei Louco', desc: 'Peões saltitantes que promovem no meio do tabuleiro. Caos!',
      army: [['K'], ['P', 'hop'], ['P', 'hop'], ['P', 'hop'], ['P', 'hop'], ['B', 'bomb']], gold: 20, amulets: ['midPromo'],
    },
  ];

  const BOSSES = {
    1: { name: 'Torre Viva', rule: 'summon', desc: 'Invoca um peão a cada 3 turnos.' },
    2: { name: 'Rei Fantasma', rule: 'ghost', desc: 'O Rei também salta como o Cavalo e começa com escudo.' },
    3: { name: 'Rainha Vermelha', rule: 'twin', desc: 'Joga DUAS vezes por turno.' },
  };

  // ---------- Board state ----------
  const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ORTH = DIRS8.slice(0, 4), DIAG = DIRS8.slice(4);
  const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const other = (side) => (side === 'w' ? 'b' : 'w');

  function makePiece(id, side, type, x, y, muts = [], extra = {}) {
    return { id, side, type, x, y, muts: muts.slice(), shield: muts.includes('shield'), moved: false, ...extra };
  }

  // rules: { promo: {w: row, b: row}, boss: null|'summon'|'twin'|'ghost', maxPly }
  function makeBattle(w, h, tiles, pieces, rules = {}) {
    return {
      w, h, tiles, pieces, turn: 'w', ply: 0, winner: null, second: false, bMoves: 0, nextId: 1,
      rules: { promo: { w: 0, b: h - 1 }, boss: null, maxPly: 240, ...rules },
    };
  }
  function clone(st) {
    return { ...st, pieces: st.pieces.map((p) => ({ ...p })), _occ: null };
  }
  function occOf(st) {
    if (!st._occ) {
      const occ = new Array(st.w * st.h).fill(null);
      for (const p of st.pieces) occ[p.y * st.w + p.x] = p;
      st._occ = occ;
    }
    return st._occ;
  }
  const byId = (st, id) => st.pieces.find((p) => p.id === id);
  const pieceAt = (st, x, y) => (x < 0 || y < 0 || x >= st.w || y >= st.h ? null : occOf(st)[y * st.w + x]);
  const tileAt = (st, x, y) => (x < 0 || y < 0 || x >= st.w || y >= st.h ? ROCK : st.tiles[y * st.w + x]);

  function pieceMoves(st, p) {
    const out = [];
    const seen = new Set();
    const occ = occOf(st);
    const add = (x, y, mode) => {
      if (tileAt(st, x, y) !== FLOOR) return false;
      const key = y * st.w + x;
      const o = occ[key];
      if (o) {
        if (o.side !== p.side && mode !== 'move' && !seen.has(key)) {
          seen.add(key);
          out.push({ id: p.id, x, y, cap: o.id });
        }
        return false;
      }
      if (mode !== 'capture' && !seen.has(key)) {
        seen.add(key);
        out.push({ id: p.id, x, y, cap: null });
      }
      return true;
    };
    const step = (dirs) => { for (const [dx, dy] of dirs) add(p.x + dx, p.y + dy, 'both'); };
    const slide = (dirs) => {
      for (const [dx, dy] of dirs) {
        let x = p.x + dx, y = p.y + dy;
        while (add(x, y, 'both')) { x += dx; y += dy; }
      }
    };
    switch (p.type) {
      case 'K': step(DIRS8); break;
      case 'Q': slide(DIRS8); break;
      case 'R': slide(ORTH); break;
      case 'B': slide(DIAG); break;
      case 'N': step(KNIGHT); break;
      case 'P': {
        const f = p.side === 'w' ? -1 : 1;
        if (add(p.x, p.y + f, 'move') && (!p.moved || p.muts.includes('hop'))) add(p.x, p.y + 2 * f, 'move');
        add(p.x - 1, p.y + f, 'capture');
        add(p.x + 1, p.y + f, 'capture');
        if (p.muts.includes('retreat')) add(p.x, p.y - f, 'move');
        break;
      }
    }
    for (const m of p.muts) {
      if (m === 'orth1') step(ORTH);
      else if (m === 'diag1') step(DIAG);
      else if (m === 'leap') step(KNIGHT);
      else if (m === 'royal') slide(DIRS8);
    }
    return out;
  }
  function allMoves(st, side) {
    const out = [];
    for (const p of st.pieces) if (p.side === side) out.push(...pieceMoves(st, p));
    return out;
  }
  const needsPromotion = (st, p) =>
    p.type === 'P' && (p.side === 'w' ? p.y <= st.rules.promo.w : p.y >= st.rules.promo.b);

  function endTurn(ns, side, ev) {
    ns.ply++;
    if (ns.rules.boss === 'twin' && side === 'b' && !ns.second && !ns.winner) {
      ns.second = true;
      return;
    }
    ns.second = false;
    ns.turn = other(side);
    if (side === 'b') {
      ns.bMoves++;
      if (ns.rules.boss === 'summon' && ns.bMoves % 3 === 0 && !ns.winner) {
        // Summon a pawn on the empty floor tile of the top two rows closest to the centre.
        let best = null, bd = Infinity;
        for (let y = 0; y < Math.min(2, ns.h); y++) {
          for (let x = 0; x < ns.w; x++) {
            if (tileAt(ns, x, y) !== FLOOR || pieceAt(ns, x, y)) continue;
            const d = Math.abs(x - (ns.w - 1) / 2) + y * 0.5;
            if (d < bd) { bd = d; best = [x, y]; }
          }
        }
        if (best) {
          const p = makePiece('s' + ns.nextId++, 'b', 'P', best[0], best[1]);
          ns.pieces.push(p);
          ns._occ = null;
          ev.push({ type: 'summon', id: p.id, x: p.x, y: p.y });
        }
      }
    }
    if (!ns.winner && ns.ply >= ns.rules.maxPly) ns.winner = 'draw';
  }

  // Returns { st, events }. Never mutates the input state.
  function applyMove(st, mv, promoType) {
    const ns = clone(st);
    const ev = [];
    const p = byId(ns, mv.id);
    const side = p.side;
    const from = { x: p.x, y: p.y };
    let moved = true;
    if (mv.cap) {
      const t = byId(ns, mv.cap);
      if (t.shield) {
        t.shield = false;
        moved = false;
        ev.push({ type: 'shield', id: t.id, by: p.id, x: t.x, y: t.y });
      } else {
        ns.pieces = ns.pieces.filter((q) => q !== t);
        ev.push({ type: 'capture', id: t.id, by: p.id, x: t.x, y: t.y, piece: t });
        if (t.type === 'K') ns.winner = side;
        p.x = mv.x; p.y = mv.y;
        if (t.muts.includes('bomb')) {
          const blown = ns.pieces.filter((q) => q.type !== 'K' && Math.abs(q.x - t.x) <= 1 && Math.abs(q.y - t.y) <= 1);
          ns.pieces = ns.pieces.filter((q) => !blown.includes(q));
          ev.push({ type: 'bomb', x: t.x, y: t.y, ids: blown.map((q) => q.id), pieces: blown });
        } else if (p.muts.includes('vampire') && !p.shield) {
          p.shield = true;
          ev.push({ type: 'vampire', id: p.id });
        }
      }
    } else {
      p.x = mv.x; p.y = mv.y;
    }
    ns._occ = null;
    p.moved = true;
    const alive = ns.pieces.includes(p);
    if (moved && alive && needsPromotion(ns, p)) {
      p.type = promoType || 'Q';
      ev.push({ type: 'promote', id: p.id, to: p.type });
    }
    ev.unshift({ type: 'move', id: p.id, from, x: moved ? mv.x : from.x, y: moved ? mv.y : from.y, bounced: !moved });
    endTurn(ns, side, ev);
    return { st: ns, events: ev };
  }
  function passTurn(st) {
    const ns = clone(st);
    const ev = [{ type: 'pass', side: st.turn }];
    endTurn(ns, st.turn, ev);
    return { st: ns, events: ev };
  }

  // ---------- AI ----------
  function evaluate(st) {
    if (st.winner === 'w') return KING_DEAD;
    if (st.winner === 'b') return -KING_DEAD;
    if (st.winner === 'draw') return 0;
    let s = 0;
    const cx = (st.w - 1) / 2, cy = (st.h - 1) / 2;
    for (const p of st.pieces) {
      let v = VALUE[p.type] + p.muts.length * 50 + (p.shield ? 120 : 0);
      if (p.type === 'P') v += (p.side === 'w' ? st.h - 1 - p.y : p.y) * 10;
      if (p.type !== 'K') v += (4 - (Math.abs(p.x - cx) + Math.abs(p.y - cy)) / 2) * 5;
      s += p.side === 'w' ? v : -v;
    }
    return s;
  }
  const sideSign = (side) => (side === 'w' ? 1 : -1);

  function orderMoves(st, moves) {
    const score = (m) => {
      if (!m.cap) return 0;
      const t = byId(st, m.cap), a = byId(st, m.id);
      return (t.type === 'K' ? 50000 : VALUE[t.type] * 10) - VALUE[a.type];
    };
    return moves.map((m) => [score(m), m]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  }

  // Negamax with alpha-beta; scores are from the point of view of st.turn.
  function negamax(st, depth, alpha, beta, ctx) {
    ctx.nodes++;
    if (st.winner) return st.winner === 'draw' ? 0 : (st.winner === st.turn ? 1 : -1) * (KING_DEAD + depth);
    if (depth <= 0) return quiesce(st, alpha, beta, 4, ctx);
    const moves = orderMoves(st, allMoves(st, st.turn));
    if (!moves.length) {
      const ns = passTurn(st).st;
      return ns.turn === st.turn ? negamax(ns, depth - 1, alpha, beta, ctx) : -negamax(ns, depth - 1, -beta, -alpha, ctx);
    }
    let best = -Infinity;
    for (const mv of moves) {
      const ns = applyMove(st, mv).st;
      const sc = ns.turn === st.turn ? negamax(ns, depth - 1, alpha, beta, ctx) : -negamax(ns, depth - 1, -beta, -alpha, ctx);
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta || ctx.nodes > ctx.limit) break;
    }
    return best;
  }
  function quiesce(st, alpha, beta, qd, ctx) {
    ctx.nodes++;
    if (st.winner) return st.winner === 'draw' ? 0 : (st.winner === st.turn ? 1 : -1) * KING_DEAD;
    const stand = sideSign(st.turn) * evaluate(st);
    if (qd <= 0 || ctx.nodes > ctx.limit) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const caps = orderMoves(st, allMoves(st, st.turn).filter((m) => m.cap));
    for (const mv of caps) {
      const ns = applyMove(st, mv).st;
      const sc = ns.turn === st.turn ? quiesce(ns, alpha, beta, qd - 1, ctx) : -quiesce(ns, -beta, -alpha, qd - 1, ctx);
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  // opts: { depth, noise, rng, limit }
  function bestMove(st, opts = {}) {
    const depth = opts.depth || 2, noise = opts.noise || 0, rng = opts.rng || Math.random;
    const ctx = { nodes: 0, limit: opts.limit || 60000 };
    const moves = orderMoves(st, allMoves(st, st.turn));
    if (!moves.length) return null;
    let best = null, bestSc = -Infinity;
    for (const mv of moves) {
      const ns = applyMove(st, mv).st;
      let sc = ns.turn === st.turn
        ? negamax(ns, depth - 1, -Infinity, Infinity, ctx)
        : -negamax(ns, depth - 1, -Infinity, Infinity, ctx);
      if (Math.abs(sc) < KING_DEAD / 2) sc += (rng() - 0.5) * noise;
      if (sc > bestSc) { bestSc = sc; best = mv; }
    }
    return best;
  }

  // ---------- Run generation ----------
  const FLOORS = 7;
  function makeMap(seed, act) {
    const rng = rngFor(seed, 'map', act);
    const nodes = {}, floors = [];
    for (let f = 0; f < FLOORS; f++) {
      const n = f === 0 ? 3 : rng.int(2, 4);
      const row = [];
      for (let i = 0; i < n; i++) {
        let type;
        if (f === 0) type = 'battle';
        else if (f === FLOORS - 1) type = 'rest';
        else {
          const t = { battle: 45, event: 20 };
          if (f >= 1) t.shop = 12;
          if (f >= 2) t.elite = 16;
          if (f >= 3 && f < FLOORS - 2) t.rest = 8;
          type = rng.weighted(t);
        }
        const id = `${f}-${i}`;
        nodes[id] = { id, f, i, col: (i + 0.5) / n, type, next: [] };
        row.push(id);
      }
      floors.push(row);
    }
    if (!floors.slice(2, 5).some((r) => r.some((id) => nodes[id].type === 'shop'))) nodes[rng.pick(floors[3])].type = 'shop';
    nodes.boss = { id: 'boss', f: FLOORS, i: 0, col: 0.5, type: 'boss', next: [] };
    floors.push(['boss']);
    const link = (a, b) => { if (!nodes[a].next.includes(b)) nodes[a].next.push(b); };
    for (let f = 0; f < FLOORS - 1; f++) {
      const cur = floors[f], nxt = floors[f + 1];
      const nearest = (col) => nxt.reduce((a, b) => (Math.abs(nodes[b].col - col) < Math.abs(nodes[a].col - col) ? b : a));
      for (const id of cur) {
        const near = nearest(nodes[id].col);
        link(id, near);
        if (rng() < 0.45) {
          const j = nxt.indexOf(near) + (rng() < 0.5 ? -1 : 1);
          if (j >= 0 && j < nxt.length) link(id, nxt[j]);
        }
      }
      for (const id of nxt) {
        if (cur.some((c) => nodes[c].next.includes(id))) continue;
        const from = cur.reduce((a, b) => (Math.abs(nodes[b].col - nodes[id].col) < Math.abs(nodes[a].col - nodes[id].col) ? b : a));
        link(from, id);
      }
    }
    for (const id of floors[FLOORS - 1]) link(id, 'boss');
    return { act, nodes, floors };
  }

  function makeEncounter(seed, act, nodeId, kind, floor = 0) {
    const rng = rngFor(seed, 'enc', act, nodeId);
    const size = act === 1 ? rng.pick([6, 7]) : act === 2 ? rng.pick([7, 8]) : 8;
    const w = size, h = size;
    const tiles = new Array(w * h).fill(FLOOR);
    const obstacles = rng.int(1, act + 2);
    for (let k = 0; k < obstacles; k++) {
      const x = rng.int(0, w - 1), y = rng.int(2, h - 3);
      const t = rng() < 0.6 ? ROCK : PIT;
      tiles[y * w + x] = t;
      if (rng() < 0.7) tiles[(h - 1 - y) * w + (w - 1 - x)] = t;
    }
    let budget = { 1: 6, 2: 11, 3: 16 }[act] + floor;
    if (kind === 'elite') budget = Math.round(budget * 1.5);
    if (kind === 'boss') budget = Math.round(budget * 1.6);
    const army = [{ type: 'K', muts: [] }];
    const pawns = Math.min(w - 1, rng.int(2, 3 + act));
    for (let i = 0; i < pawns; i++) army.push({ type: 'P', muts: [] });
    budget -= pawns;
    const cost = { N: 3, B: 3, R: 5, Q: 9 };
    while (budget >= 3 && army.length < 2 * w - 1) {
      const opts = Object.keys(cost).filter((t) => cost[t] <= budget && (t !== 'Q' || act > 1 || kind !== 'battle'));
      if (!opts.length) break;
      const t = rng.pick(opts);
      army.push({ type: t, muts: [] });
      budget -= cost[t];
    }
    const mutChance = kind === 'elite' ? 0.45 : kind === 'boss' ? 0.3 : act === 3 ? 0.2 : act === 2 ? 0.08 : 0;
    for (const u of army) {
      if (u.type === 'K' || rng() >= mutChance) continue;
      const opts = Object.keys(MUTATIONS).filter((m) => !MUTATIONS[m].hidden && canMutate(u.type, u.muts, m));
      if (opts.length) u.muts.push(rng.pick(opts));
    }
    let boss = null;
    if (kind === 'boss') {
      boss = BOSSES[act];
      if (boss.rule === 'ghost') army[0].muts.push('leap', 'shield');
      if (boss.rule === 'summon') army.push({ type: 'R', muts: ['shield'] });
    }
    // Placement: king on the back row centre, pawns in front, the rest on the back row then overflow.
    const placed = [];
    const free = (x, y) => tiles[y * w + x] === FLOOR && !placed.some((p) => p.x === x && p.y === y);
    const order = (y) => Array.from({ length: w }, (_, i) => i).sort((a, b) => Math.abs(a - (w - 1) / 2) - Math.abs(b - (w - 1) / 2) || a - b).map((x) => [x, y]);
    const slotsBack = order(0), slotsFront = order(1);
    const take = (list) => list.find(([x, y]) => free(x, y));
    for (const u of army) {
      const pref = u.type === 'P' ? [slotsFront, slotsBack] : [slotsBack, slotsFront];
      const spot = take(pref[0]) || take(pref[1]);
      if (spot) placed.push({ ...u, x: spot[0], y: spot[1] });
    }
    return {
      w, h, tiles, enemy: placed, boss, kind, act,
      depth: act === 1 && kind === 'battle' ? 2 : 3,
      noise: act === 1 ? 70 : act === 2 ? 30 : 10,
    };
  }

  function deployRows(h, amulets) {
    const n = amulets.includes('warband') ? 3 : 2;
    return Array.from({ length: n }, (_, i) => h - 1 - i);
  }
  // army: [{id, type, muts}] -> { placed: [{id,x,y}], bench: [id] }
  function autoDeploy(enc, army, amulets) {
    const { w, h, tiles } = enc;
    const rows = deployRows(h, amulets);
    const placed = [], bench = [];
    const used = new Set();
    const centre = (y) => Array.from({ length: w }, (_, i) => i).sort((a, b) => Math.abs(a - (w - 1) / 2) - Math.abs(b - (w - 1) / 2) || b - a).map((x) => [x, y]);
    const sorted = army.slice().sort((a, b) => (a.type === 'K' ? -1 : b.type === 'K' ? 1 : VALUE[b.type] - VALUE[a.type]));
    for (const u of sorted) {
      const pref = u.type === 'P' ? rows.slice(1).concat(rows[0]) : [rows[0]].concat(rows.slice(1));
      let spot = null;
      for (const y of pref) {
        spot = centre(y).find(([x, yy]) => tiles[yy * w + x] === FLOOR && !used.has(yy * w + x));
        if (spot) break;
      }
      if (spot) { used.add(spot[1] * w + spot[0]); placed.push({ id: u.id, x: spot[0], y: spot[1] }); }
      else bench.push(u.id);
    }
    return { placed, bench, rows };
  }

  function startBattle(enc, army, placed, amulets) {
    const pieces = [];
    for (const pl of placed) {
      const u = army.find((a) => a.id === pl.id);
      const p = makePiece('w' + u.id, 'w', u.type, pl.x, pl.y, u.muts, { armyId: u.id });
      if (u.type === 'K' && amulets.includes('aegis')) p.shield = true;
      pieces.push(p);
    }
    enc.enemy.forEach((u, i) => pieces.push(makePiece('b' + i, 'b', u.type, u.x, u.y, u.muts)));
    const mid = Math.floor((enc.h - 1) / 2);
    return makeBattle(enc.w, enc.h, enc.tiles, pieces, {
      promo: { w: amulets.includes('midPromo') ? mid : 0, b: enc.h - 1 },
      boss: enc.boss ? enc.boss.rule : null,
    });
  }

  // Resolve a finished battle back into the persistent army.
  // deployedIds: army ids that took the field. lostOrder: army ids in the order they fell.
  function settleArmy(army, st, deployedIds, amulets, lostOrder = []) {
    const alive = new Map(st.pieces.filter((p) => p.side === 'w').map((p) => [p.armyId, p]));
    const lost = [];
    const next = [];
    for (const u of army) {
      const p = alive.get(u.id);
      if (p) next.push({ ...u, type: p.type });
      else if (deployedIds.includes(u.id)) lost.push(u);
      else next.push(u);
    }
    let revived = null;
    if (amulets.includes('phoenix') && lost.length) {
      const firstId = lostOrder.find((id) => lost.some((u) => u.id === id && u.type !== 'K'));
      revived = lost.find((u) => u.id === firstId) || lost.find((u) => u.type !== 'K') || null;
      if (revived) next.push(revived);
    }
    return { army: next, lost: lost.filter((u) => u !== revived), revived };
  }

  function goldFor(kind, act, amulets, captures) {
    let g = kind === 'boss' ? 120 : kind === 'elite' ? 55 + act * 15 : 25 + act * 10;
    g += amulets.includes('spoils') ? captures * 6 : 0;
    if (amulets.includes('greed')) g = Math.round(g * 1.5);
    return g;
  }

  function makeOffers(rng, act, kind, amulets) {
    const n = amulets.includes('lucky') ? 4 : 3;
    const out = [];
    const freeAmulets = Object.keys(AMULETS).filter((a) => !amulets.includes(a));
    const pieceTable = act === 1 ? { P: 4, N: 3, B: 3, R: 2, Q: kind === 'battle' ? 0 : 1 } : { P: 2, N: 3, B: 3, R: 3, Q: kind === 'battle' ? 1 : 2 };
    const amuletChance = kind === 'battle' ? 0.12 : 0.6;
    const usedMuts = new Set();
    if (kind !== 'battle' && freeAmulets.length) out.push({ kind: 'amulet', id: rng.pick(freeAmulets) });
    while (out.length < n) {
      const r = rng();
      if (r < amuletChance && freeAmulets.length && !out.some((o) => o.kind === 'amulet')) {
        out.push({ kind: 'amulet', id: rng.pick(freeAmulets) });
      } else if (r < 0.55) {
        out.push({ kind: 'piece', type: rng.weighted(pieceTable) });
      } else {
        const opts = Object.keys(MUTATIONS).filter((m) => !MUTATIONS[m].hidden && !usedMuts.has(m));
        const m = rng.pick(opts);
        usedMuts.add(m);
        out.push({ kind: 'mut', id: m });
      }
    }
    return out;
  }

  return {
    makeRng, rngFor, hash,
    FLOOR, ROCK, PIT, NAMES, VALUE, PRICE, MUT_PRICE, AMULET_PRICE, KING_DEAD,
    MUTATIONS, AMULETS, KINGS, BOSSES, FLOORS, canMutate,
    makePiece, makeBattle, clone, byId, pieceAt, tileAt, pieceMoves, allMoves, applyMove, passTurn,
    evaluate, bestMove,
    makeMap, makeEncounter, deployRows, autoDeploy, startBattle, settleArmy, goldFor, makeOffers,
  };
});
