// Run with: node --test chess-roguelike/tests/
const test = require('node:test');
const assert = require('node:assert');
const C = require('../logic.js');

const empty = (w = 8, h = 8) => new Array(w * h).fill(C.FLOOR);
const board = (pieces, opts = {}) => C.makeBattle(opts.w || 8, opts.h || 8, opts.tiles || empty(opts.w, opts.h), pieces, opts.rules);
const P = (id, side, type, x, y, muts) => C.makePiece(id, side, type, x, y, muts);
const targets = (st, id) => C.pieceMoves(st, C.byId(st, id)).map((m) => `${m.x},${m.y}`).sort();

test('rook slides until blocked and captures the first enemy', () => {
  const st = board([P('r', 'w', 'R', 0, 7), P('own', 'w', 'P', 0, 4), P('e', 'b', 'P', 3, 7)]);
  assert.deepStrictEqual(targets(st, 'r'), ['0,5', '0,6', '1,7', '2,7', '3,7']);
});

test('knight jumps over pieces and rocks but cannot land on rocks or pits', () => {
  const tiles = empty();
  tiles[5 * 8 + 2] = C.ROCK; // (2,5)
  tiles[6 * 8 + 3] = C.PIT; // (3,6)
  const st = board([P('n', 'w', 'N', 1, 7), P('x', 'w', 'P', 1, 6)], { tiles });
  assert.deepStrictEqual(targets(st, 'n'), ['0,5']);
});

test('pawn: double step only on first move, diagonal captures only', () => {
  const st = board([P('p', 'w', 'P', 3, 6), P('e', 'b', 'P', 4, 5), P('f', 'b', 'P', 2, 6)]);
  assert.deepStrictEqual(targets(st, 'p'), ['3,4', '3,5', '4,5']);
  const after = C.applyMove(st, { id: 'p', x: 3, y: 5, cap: null }).st;
  after.turn = 'w';
  assert.deepStrictEqual(targets(after, 'p'), ['3,4']);
});

test('hop mutation always allows the double step; retreat adds a backward step', () => {
  const st = board([P('p', 'w', 'P', 3, 4, ['hop', 'retreat'])]);
  C.byId(st, 'p').moved = true;
  assert.deepStrictEqual(targets(st, 'p'), ['3,2', '3,3', '3,5']);
});

test('leap mutation gives a bishop knight jumps', () => {
  const st = board([P('b', 'w', 'B', 0, 7, ['leap']), P('x', 'w', 'P', 1, 6)]);
  assert.deepStrictEqual(targets(st, 'b'), ['1,5', '2,6']);
});

test('shield absorbs the first capture and the attacker stays put', () => {
  const st = board([P('r', 'w', 'R', 0, 7), P('e', 'b', 'N', 0, 0, ['shield'])]);
  const { st: ns, events } = C.applyMove(st, { id: 'r', x: 0, y: 0, cap: 'e' });
  assert.ok(C.byId(ns, 'e'));
  assert.strictEqual(C.byId(ns, 'e').shield, false);
  assert.deepStrictEqual([C.byId(ns, 'r').x, C.byId(ns, 'r').y], [0, 7]);
  assert.ok(events.some((e) => e.type === 'shield'));
});

test('bomb takes out every non-king neighbour, including the attacker', () => {
  const st = board([
    P('q', 'w', 'Q', 3, 7), P('k', 'w', 'K', 4, 4), P('wp', 'w', 'P', 2, 4),
    P('e', 'b', 'R', 3, 3, ['bomb']), P('ek', 'b', 'K', 7, 0), P('ep', 'b', 'P', 3, 2),
  ]);
  const ns = C.applyMove(st, { id: 'q', x: 3, y: 3, cap: 'e' }).st;
  assert.deepStrictEqual(ns.pieces.map((p) => p.id).sort(), ['ek', 'k']);
});

test('capturing the king wins; promotion happens on the last row', () => {
  const st = board([P('p', 'w', 'P', 1, 1), P('ek', 'b', 'K', 2, 0)]);
  const ns = C.applyMove(st, { id: 'p', x: 2, y: 0, cap: 'ek' }, 'N').st;
  assert.strictEqual(ns.winner, 'w');
  assert.strictEqual(C.byId(ns, 'p').type, 'N');
});

test('midPromo rule promotes pawns at the middle row', () => {
  const st = board([P('p', 'w', 'P', 0, 4), P('ek', 'b', 'K', 7, 0)], { rules: { promo: { w: 3, b: 7 } } });
  const ns = C.applyMove(st, { id: 'p', x: 0, y: 3, cap: null }).st;
  assert.strictEqual(C.byId(ns, 'p').type, 'Q');
});

test('twin boss moves twice before the turn passes back', () => {
  const st = board([P('k', 'w', 'K', 0, 7), P('ek', 'b', 'K', 7, 0)], { rules: { boss: 'twin' } });
  st.turn = 'b';
  const a = C.applyMove(st, { id: 'ek', x: 6, y: 0, cap: null }).st;
  assert.strictEqual(a.turn, 'b');
  const b = C.applyMove(a, { id: 'ek', x: 5, y: 0, cap: null }).st;
  assert.strictEqual(b.turn, 'w');
});

test('summon boss spawns a pawn every third enemy move', () => {
  let st = board([P('k', 'w', 'K', 0, 7), P('ek', 'b', 'K', 7, 0)], { rules: { boss: 'summon' } });
  for (let i = 0; i < 3; i++) {
    st = C.applyMove(st, { id: 'k', x: i % 2 ? 0 : 1, y: 7, cap: null }).st;
    st = C.applyMove(st, { id: 'ek', x: i % 2 ? 7 : 6, y: 0, cap: null }).st;
  }
  assert.strictEqual(st.pieces.filter((p) => p.side === 'b' && p.type === 'P').length, 1);
});

test('AI takes a free king and avoids hanging its own king', () => {
  const st = board([P('k', 'w', 'K', 0, 7), P('r', 'w', 'R', 5, 7), P('ek', 'b', 'K', 5, 0), P('eq', 'b', 'Q', 0, 0)]);
  st.turn = 'b';
  // Black queen can capture the white king on the a-file.
  const mv = C.bestMove(st, { depth: 2 });
  assert.deepStrictEqual([mv.id, mv.cap], ['eq', 'k']);

  const st2 = board([P('k', 'w', 'K', 0, 7), P('r', 'w', 'R', 5, 7), P('ek', 'b', 'K', 5, 0), P('ep', 'b', 'P', 0, 1)]);
  st2.turn = 'b';
  const mv2 = C.bestMove(st2, { depth: 2 });
  // The rook attacks the king along the f-file: the king must step off it.
  assert.strictEqual(mv2.id, 'ek');
  assert.notStrictEqual(mv2.x, 5);
});

test('map is deterministic, ends in a boss and every node is reachable', () => {
  for (let seed = 1; seed < 40; seed++) {
    for (const act of [1, 2, 3]) {
      const m = C.makeMap(seed, act);
      assert.deepStrictEqual(m, C.makeMap(seed, act));
      const seen = new Set(m.floors[0]);
      const stack = [...m.floors[0]];
      while (stack.length) for (const n of m.nodes[stack.pop()].next) if (!seen.has(n)) { seen.add(n); stack.push(n); }
      assert.strictEqual(seen.size, Object.keys(m.nodes).length);
      for (const id of Object.keys(m.nodes)) if (id !== 'boss') assert.ok(m.nodes[id].next.length > 0);
      assert.ok(m.floors.slice(2, 5).flat().some((id) => m.nodes[id].type === 'shop'));
    }
  }
});

test('encounters place a king and keep the deploy rows clear', () => {
  for (let seed = 1; seed < 60; seed++) {
    for (const act of [1, 2, 3]) {
      for (const kind of ['battle', 'elite', 'boss']) {
        const e = C.makeEncounter(seed, act, 'n', kind, 3);
        assert.strictEqual(e.enemy.filter((u) => u.type === 'K').length, 1);
        for (const y of [e.h - 1, e.h - 2]) for (let x = 0; x < e.w; x++) assert.strictEqual(e.tiles[y * e.w + x], C.FLOOR);
        for (const u of e.enemy) assert.strictEqual(e.tiles[u.y * e.w + u.x], C.FLOOR);
      }
    }
  }
});

test('a full battle against itself terminates and settleArmy applies losses + phoenix', () => {
  const army = [{ id: 1, type: 'K', muts: [] }, { id: 2, type: 'P', muts: [] }, { id: 3, type: 'N', muts: [] }, { id: 4, type: 'R', muts: [] }];
  const enc = C.makeEncounter(7, 1, '0-0', 'battle');
  const { placed } = C.autoDeploy(enc, army, []);
  let st = C.startBattle(enc, army, placed, ['phoenix']);
  const rng = C.makeRng(3);
  const lostOrder = [];
  while (!st.winner) {
    const mv = C.bestMove(st, { depth: 1, rng, noise: 50 });
    const r = mv ? C.applyMove(st, mv) : C.passTurn(st);
    for (const e of r.events) if (e.type === 'capture' && e.piece.side === 'w') lostOrder.push(e.piece.armyId);
    st = r.st;
  }
  const res = C.settleArmy(army, st, placed.map((p) => p.id), ['phoenix'], lostOrder);
  const survivors = st.pieces.filter((p) => p.side === 'w').length;
  assert.strictEqual(res.army.length, survivors + (res.revived ? 1 : 0));
});

test('offers respect the lucky amulet', () => {
  const rng = C.makeRng(5);
  assert.strictEqual(C.makeOffers(rng, 1, 'battle', []).length, 3);
  assert.strictEqual(C.makeOffers(rng, 1, 'elite', ['lucky']).length, 4);
});

test('catalogue texts and icons contain no emoji', () => {
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
  const texts = [];
  for (const m of Object.values(C.MUTATIONS)) texts.push(m.name, m.icon, m.desc);
  for (const a of Object.values(C.AMULETS)) texts.push(a.name, a.icon, a.desc);
  for (const k of C.KINGS) texts.push(k.name, k.desc);
  for (const b of Object.values(C.BOSSES)) texts.push(b.name, b.desc);
  for (const t of texts) assert.ok(!EMOJI.test(t), `emoji in "${t}"`);
  for (const m of Object.values(C.MUTATIONS)) assert.match(m.icon, /^[a-z]+$/);
  for (const a of Object.values(C.AMULETS)) assert.match(a.icon, /^[a-z]+$/);
});

test('Act II boss king jumps like a knight but no longer slides like a queen', () => {
  for (let seed = 1; seed < 20; seed++) {
    const e = C.makeEncounter(seed, 2, 'boss', 'boss', 7);
    const k = e.enemy.find((u) => u.type === 'K');
    assert.deepStrictEqual(k.muts.slice().sort(), ['leap', 'shield']);
    const st = C.makeBattle(e.w, e.h, e.tiles, e.enemy.map((u, i) => C.makePiece('b' + i, 'b', u.type, u.x, u.y, u.muts)));
    st.turn = 'b';
    const kp = st.pieces.find((p) => p.type === 'K');
    for (const m of C.pieceMoves(st, kp)) {
      const dx = Math.abs(m.x - kp.x), dy = Math.abs(m.y - kp.y);
      assert.ok(Math.max(dx, dy) === 1 || (dx === 1 && dy === 2) || (dx === 2 && dy === 1), `${dx},${dy}`);
    }
  }
});
