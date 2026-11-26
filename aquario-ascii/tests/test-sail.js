// Água-Tinta — boat sailing kinematics tests (owner C): AQ.sail (js/logic/sail.js).
'use strict';
module.exports = function (T) {
  function run(AQ, b, input, sec, dt, opts) {
    const n = Math.round(sec / (dt || 1 / 60));
    let maxV = 0;
    for (let i = 0; i < n; i++) { AQ.sail.step(b, input, dt || 1 / 60, opts); maxV = Math.max(maxV, Math.abs(b.vx)); }
    return maxV;
  }

  T.test('full thrust eases in and settles near the top speed without exceeding it', () => {
    const { AQ } = T.load();
    const C = AQ.sail.CONST;
    T.ok(C.MAX >= 10 && C.MAX <= 14, 'top speed ' + C.MAX + ' columns/s');
    const b = AQ.sail.create(0);
    AQ.sail.step(b, 1, 1 / 60);
    T.ok(b.vx > 0 && b.vx < 0.2, 'first frame is a soft start: ' + b.vx);
    let prevX = b.x;
    for (let i = 0; i < 240; i++) { AQ.sail.step(b, 1, 1 / 60); T.ok(b.x >= prevX, 'moves forward'); prevX = b.x; }
    T.ok(b.vx > C.MAX * 0.95 && b.vx <= C.MAX + 1e-9, 'after 4 s: ' + b.vx);
  });

  T.test('releasing coasts to a full stop (ease out) within a few columns', () => {
    const { AQ } = T.load();
    const b = AQ.sail.create(10);
    run(AQ, b, 1, 4);
    const x0 = b.x;
    let t = 0;
    while (AQ.sail.moving(b) && t < 5) { AQ.sail.step(b, 0, 1 / 60); t += 1 / 60; }
    T.eq(b.vx, 0);
    T.ok(t > 0.8 && t < 2.6, 'stops in ' + t.toFixed(2) + ' s');
    T.ok(b.x - x0 > 3 && b.x - x0 < 9, 'coasts ' + (b.x - x0).toFixed(2) + ' columns');
    const x1 = b.x;
    run(AQ, b, 0, 2);
    T.eq(b.x, x1, 'stays at rest');
  });

  T.test('a tap nudges the boat a short, finite distance', () => {
    const { AQ } = T.load();
    for (const dir of [1, -1]) {
      const b = AQ.sail.create(0);
      AQ.sail.nudge(b, dir);
      run(AQ, b, 0, 4);
      T.eq(b.vx, 0);
      T.ok(b.x * dir > 0.8 && b.x * dir < 4, 'nudge ' + dir + ' → ' + b.x.toFixed(2));
    }
  });

  T.test('left and right are mirror images; analog input sails slower', () => {
    const { AQ } = T.load();
    const r = AQ.sail.create(0), l = AQ.sail.create(0);
    for (let i = 0; i < 200; i++) { AQ.sail.step(r, 1, 1 / 60); AQ.sail.step(l, -1, 1 / 60); }
    T.near(r.x, -l.x, 1e-9); T.near(r.vx, -l.vx, 1e-9);
    const h = AQ.sail.create(0);
    run(AQ, h, 0.5, 5);
    T.ok(h.vx > 4.5 && h.vx < 7, 'half stick → ' + h.vx.toFixed(2));
  });

  T.test('reverse thrust turns the boat around quickly; the anchor stops it', () => {
    const { AQ } = T.load();
    const b = AQ.sail.create(0);
    run(AQ, b, 1, 3);
    let t = 0;
    while (b.vx > 0 && t < 3) { AQ.sail.step(b, -1, 1 / 60); t += 1 / 60; }
    T.ok(t < 1, 'reverses in ' + t.toFixed(2) + ' s');
    const a = AQ.sail.create(0);
    run(AQ, a, 1, 3);
    AQ.sail.nudge(a, 1);
    t = 0;
    while (a.vx !== 0 && t < 3) { AQ.sail.step(a, 1, 1 / 60, { anchor: true }); t += 1 / 60; }
    T.ok(t < 0.8, 'anchored stop in ' + t.toFixed(2) + ' s');
    T.eq(a.nudge, 0);
  });

  T.test('frame-rate independent enough (30 vs 120 fps) and robust to bad dt', () => {
    const { AQ } = T.load();
    const a = AQ.sail.create(0), b = AQ.sail.create(0);
    run(AQ, a, 1, 2, 1 / 30); run(AQ, a, 0, 2, 1 / 30);
    run(AQ, b, 1, 2, 1 / 120); run(AQ, b, 0, 2, 1 / 120);
    T.ok(Math.abs(a.x - b.x) < 0.6, '30 fps ' + a.x.toFixed(2) + ' vs 120 fps ' + b.x.toFixed(2));
    const c = AQ.sail.create(5);
    AQ.sail.step(c, 1, NaN); AQ.sail.step(c, 1, -1); AQ.sail.step(c, NaN, 1 / 60);
    T.ok(Number.isFinite(c.x) && Number.isFinite(c.vx), 'finite');
    AQ.sail.step(c, 1, 5);
    T.ok(Math.abs(c.vx) <= AQ.sail.CONST.MAX, 'huge dt is clamped');
  });
};
