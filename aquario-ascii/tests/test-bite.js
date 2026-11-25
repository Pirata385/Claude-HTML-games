// Água-Tinta — bite timing tests (owner C). §4.6 and §15.11.
'use strict';
module.exports = function (T) {
  const sp = { id: 'baiacu', biteWindow: 0.75 };
  const gear = { window: 0.10 };

  T.test('window = biteWindow + rod bonus; × 1.5 with wideWindows', () => {
    const { AQ } = T.load();
    T.near(AQ.bite.window(sp, gear, { wideWindows: false }), 0.85, 1e-9);
    T.near(AQ.bite.window(sp, gear, { wideWindows: true }), 0.85 * 1.5, 1e-9);
    T.near(AQ.bite.window(sp, { window: 0 }, null), 0.75, 1e-9);
    // AQ.settings-like object
    T.near(AQ.bite.window(sp, gear, { get: (k) => k === 'wideWindows' }), 1.275, 1e-9);
    // tutorial override (2.0 s, no rod bonus)
    T.near(AQ.bite.window(sp, gear, { biteWindow: 2.0 }), 2.0, 1e-9);
    // real species data when B has published it
    const real = AQ.species.get('manjuba');
    if (real) T.near(AQ.bite.window(real, gear, {}), real.biteWindow + 0.10, 1e-9);
  });

  T.test('strike during a nibble → early', () => {
    const { AQ } = T.load();
    const bs = AQ.bite.create(sp, gear, {});
    AQ.bite.nibble(bs, 1.0);
    T.eq(bs.state, 'nibble'); T.eq(bs.nibbles, 1);
    T.eq(AQ.bite.strike(bs, 1.1), 'early');
    const idle = AQ.bite.create(sp, gear, {});
    T.eq(AQ.bite.strike(idle, 0.5), 'early', 'before any nibble');
  });

  T.test('strike inside the window → hooked; after → late; expired after the window', () => {
    const { AQ } = T.load();
    const a = AQ.bite.create(sp, gear, {});
    AQ.bite.nibble(a, 1); AQ.bite.nibble(a, 2);
    AQ.bite.open(a, 3);
    T.ok(!AQ.bite.expired(a, 3.5));
    T.near(AQ.bite.remaining(a, 3), 1, 1e-9);
    T.eq(AQ.bite.strike(a, 3.84), 'hooked');
    const b = AQ.bite.create(sp, gear, {});
    AQ.bite.open(b, 3);
    T.ok(AQ.bite.expired(b, 3.86));
    T.eq(AQ.bite.strike(b, 3.86), 'late');
    const c = AQ.bite.create(sp, gear, { wideWindows: true });
    AQ.bite.open(c, 0);
    T.eq(AQ.bite.strike(c, 1.2), 'hooked', 'wide window still open at 1.2 s');
  });
};
