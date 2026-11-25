// Água-Tinta — line tests (owner C): cast trajectory, verlet rope, rasteriser. §15.11.
'use strict';
module.exports = function (T) {
  const ALLOWED = new Set(['|', '/', '\\', '-', '_', '~', '.', "'", ',']);

  T.test('landing x is monotonic in power and within [boat + 6, boat + castMax]', () => {
    const { AQ } = T.load();
    for (const castMax of [26, 34, 44, 56, 70]) {
      for (const dir of [1, -1]) {
        let prev = -Infinity;
        for (let i = 0; i <= 20; i++) {
          const tr = AQ.line.trajectory({ x: 40, y: -3 }, i / 20, dir, castMax);
          const off = (tr.landX - 40) * dir;
          T.ok(off >= 6 - 1e-9 && off <= castMax + 1e-9, 'offset ' + off + ' in range (castMax ' + castMax + ')');
          T.ok(off >= prev - 1e-9, 'monotonic');
          prev = off;
          const last = tr.points[tr.points.length - 1];
          T.near(last.x, tr.landX, 1e-6, 'path ends at landX');
          T.near(last.y, 0, 1e-6, 'path ends on the surface');
          T.ok(tr.flightTime > 0.3 && tr.flightTime < 2.2, 'flight time ' + tr.flightTime);
          const mid = AQ.line.pointAt(tr, tr.flightTime / 2);
          T.ok(mid.y < -3, 'arcs above the rod tip');
        }
      }
    }
    const cl = AQ.line.trajectory({ x: 40, y: -3 }, 1, 1, 70, { maxX: 60 });
    T.near(cl.landX, 60, 1e-9, 'clamped to the view');
  });

  T.test('rope segment lengths within 5% after settling (slack and taut)', () => {
    const { AQ } = T.load();
    for (const [len, iters] of [[60, 6], [45, 4], [30, 3], [20, 4]]) {
      const rope = AQ.line.createRope(24);
      const a = { x: 10, y: -4 }, b = { x: 35, y: 20 };
      for (let i = 0; i < 600; i++) AQ.line.stepRope(rope, a, b, len, 1 / 60, { gravity: 30, iterations: iters, waterY: 0 });
      let worst = 0;
      for (let i = 0; i < rope.n - 1; i++) {
        const d = Math.hypot(rope.px[i + 1] - rope.px[i], rope.py[i + 1] - rope.py[i]);
        worst = Math.max(worst, Math.abs(d - rope.seg) / rope.seg);
      }
      T.ok(worst < 0.05, 'len ' + len + ' iters ' + iters + ': worst segment error ' + (worst * 100).toFixed(2) + '%');
      T.near(rope.px[0], a.x, 1e-9); T.near(rope.py[rope.n - 1], b.y, 1e-9);
      if (len > 40) {
        let sag = 0;
        for (let i = 0; i < rope.n; i++) {
          const t = i / (rope.n - 1);
          sag = Math.max(sag, rope.py[i] - (a.y + (b.y - a.y) * t));
        }
        T.ok(sag > 2, 'slack rope sags (' + sag.toFixed(1) + ')');
      }
    }
  });

  T.test('raster glyphs ⊂ allowed set; consecutive cells 8-connected; no gaps or repeats', () => {
    const { AQ } = T.load();
    const out = [];
    const rng = AQ.rng.create('line-test');
    for (let k = 0; k < 60; k++) {
      const rope = AQ.line.createRope(24);
      const a = { x: rng.range(0, 80), y: rng.range(-6, -1) };
      const b = { x: rng.range(0, 80), y: rng.range(-2, 120) };
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const len = dist * rng.range(0.8, 1.6);
      for (let i = 0; i < 90; i++) AQ.line.stepRope(rope, a, b, len, 1 / 60, { gravity: 30, iterations: 4, waterY: 0 });
      for (const tension of [0, 0.3, 0.95]) {
        AQ.line.rasterize(rope, out, { tension, underwaterLevelMul: 0.8 });
        T.ok(out.length >= 2, 'cells emitted');
        for (let i = 0; i < out.length; i++) {
          const cl = out[i];
          T.ok(ALLOWED.has(cl.ch), 'glyph ' + JSON.stringify(cl.ch));
          T.ok(cl.level >= 1 && cl.level <= 15, 'level ' + cl.level);
          T.eq(cl.c, Math.floor(cl.wx)); T.eq(cl.r, Math.floor(cl.wy / 2));
          if (i) {
            const dc = Math.abs(cl.c - out[i - 1].c), dr = Math.abs(cl.r - out[i - 1].r);
            T.ok(dc <= 1 && dr <= 1 && (dc + dr) > 0, 'cells ' + (i - 1) + '→' + i + ' 8-connected (' + dc + ',' + dr + ')');
          }
        }
        T.eq(out[0].c, Math.floor(a.x), 'starts at the rod tip');
        const last = out[out.length - 1];
        T.ok(Math.abs(last.c - Math.floor(b.x)) <= 1 && Math.abs(last.r - Math.floor(b.y / 2)) <= 1, 'ends at the hook');
      }
    }
  });

  T.test('glyphFor picks by slope', () => {
    const { AQ } = T.load();
    const g = AQ.line.glyphFor;
    T.eq(g(0, 5, 0.5), '|'); T.eq(g(5, 0, 0.5), '-'); T.eq(g(5, 5, 0.5), '\\'); T.eq(g(5, -5, 0.5), '/');
    T.eq(g(-5, 5, 0.5), '/'); T.eq(g(5, 0.2, 0), '~'); T.eq(g(0.1, 5, 0), ',');
  });
};
