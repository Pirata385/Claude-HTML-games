/* Procedural stickman: joint positions in world px relative to the feet centre (y up is negative), facing right. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const TAU = Math.PI * 2;
  const THIGH = 11.5, SHIN = 11.5, UPPER = 8, FORE = 8;
  const HIP = -22, NECK = -36, HEAD = -42;

  const v = (x, y) => ({ x, y });
  /** 2-bone IK: joint between a and b with given bone lengths, bending toward side (+1 forward). */
  function ik(a, b, l1, l2, side) {
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.01;
    if (d > max) { b = v(a.x + dx / d * max, a.y + dy / d * max); dx = b.x - a.x; dy = b.y - a.y; d = max; }
    if (d < 1e-3) return v(a.x + side * l1, a.y);
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const ux = dx / d, uy = dy / d;
    return v(a.x + ux * along - uy * h * side, a.y + uy * along + ux * h * side);
  }
  function limb(a, end, l1, l2, side) { const mid = ik(a, end, l1, l2, side); return [mid, end]; }

  function build(hip, neck, footL, footR, handL, handR, legSide = 1, armSide = -1) {
    const [kneeL] = limb(hip, footL, THIGH, SHIN, legSide);
    const [kneeR] = limb(hip, footR, THIGH, SHIN, legSide);
    const sh = v(neck.x, neck.y + 2);
    const [elbowL] = limb(sh, handL, UPPER, FORE, armSide);
    const [elbowR] = limb(sh, handR, UPPER, FORE, armSide);
    const head = v(neck.x + (neck.x - hip.x) * 0.35, neck.y - 6);
    return { head, neck, hip, kneeL, footL, kneeR, footR, shoulder: sh, elbowL, handL, elbowR, handR };
  }

  const POSES = {
    idle(t) {
      const b = Math.sin(t * TAU) * 0.6;
      return build(v(0, HIP + b * 0.3), v(0, NECK + b), v(-4, 0), v(4, 0), v(-5, -19 + b), v(5, -19 + b));
    },
    walk(t, p) {
      const a = (p.stride || 7), lift = p.lift || 4;
      const c = Math.cos(t * TAU), s = Math.sin(t * TAU);
      const fL = v(a * c, -lift * Math.max(0, -s)), fR = v(-a * c, -lift * Math.max(0, s));
      const bob = -Math.abs(s) * 1.2;
      const lean = p.lean || 0;
      const hip = v(0, HIP + bob), neck = v(lean, NECK + bob);
      return build(hip, neck, fL, fR, v(-a * c * 0.7 + lean, -20 + bob), v(a * c * 0.7 + lean, -20 + bob));
    },
    run(t) { return POSES.walk(t, { stride: 10, lift: 7, lean: 3 }); },
    jump() { return build(v(0, HIP + 2), v(1, NECK + 2), v(-3, -5), v(5, -3), v(-7, -42), v(8, -41)); },
    fall() { return build(v(0, HIP), v(0, NECK), v(-7, -1), v(6, -2), v(-12, -36), v(12, -36)); },
    climb(t) {
      const s = Math.sin(t * TAU);
      return build(v(0, HIP), v(0, NECK), v(-3, -2 - s * 3), v(3, -2 + s * 3), v(-4, -44 + s * 4), v(4, -44 - s * 4), 1, 1);
    },
    swim(t) {
      const s = Math.sin(t * TAU), c = Math.cos(t * TAU);
      return build(v(0, HIP + 6), v(4, NECK + 8), v(-8, -2 + s * 3), v(-6, -6 - s * 3), v(12 + c * 4, NECK + 4 + s * 4), v(10 - c * 4, NECK + 8 - s * 3));
    },
    /** Tool/weapon swing: p.progress 0..1, p.aim angle (rad, 0 = forward). Right hand sweeps an arc. */
    swing(t, p) {
      const pr = p.progress || 0, base = p.aim != null ? p.aim : 0.4;
      const a = base - 1.9 + pr * 2.8;
      const sh = v(1, NECK + 2);
      const hand = v(sh.x + Math.cos(a) * 15, sh.y + Math.sin(a) * 15);
      return build(v(0, HIP), v(1, NECK), v(-5, 0), v(6, 0), v(-6, -20), hand, 1, -1);
    },
    sit() { return build(v(0, -12), v(0, -27), v(8, 0), v(10, 0), v(6, -14), v(8, -15)); },
    sleep() { return build(v(-12, -3), v(8, -4), v(-24, -2), v(-23, -1), v(0, -2), v(2, -3)); },
    hurt(t) { const s = Math.sin(t * TAU * 3) * 1.5; return build(v(-2, HIP), v(-6 + s, NECK + 2), v(-6, 0), v(4, 0), v(-12, -30), v(-4, -40)); },
    wave(t) { const s = Math.sin(t * TAU * 2); return build(v(0, HIP), v(0, NECK), v(-4, 0), v(4, 0), v(-5, -19), v(8 + s * 3, -46)); },
  };

  /* ---- Full-size 3x3 ASCII sprite (facing right); the game draws the player and NPCs with these. ---- */
  const H = '\u25CB';
  const SPRITES = {
    idle: [[` ${H} `, '/|\\', '/ \\']],
    walk: [[` ${H} `, '/|\\', '/ \\'], [` ${H} `, '/|\\', ' |\\'], [` ${H} `, '/|\\', ' | '], [` ${H} `, '/|\\', '/| ']],
    run: [[` ${H} `, '-|\\', '/ >'], [` ${H} `, '/|-', ' |\\'], [` ${H} `, '-|\\', ' |>'], [` ${H} `, '/|-', '/| ']],
    jump: [[` ${H} `, '\\|/', '/ \\']],
    fall: [[` ${H} `, '\\|/', '| |']],
    climb: [[` ${H} `, '\\|/', '/ \\'], [` ${H} `, '\\|/', ' | ']],
    swim: [[` ${H} `, '\\|/', '~~~'], [` ${H} `, '/|\\', '~~~']],
    swing: [[` ${H} `, '/|_', '/ \\']],
    hurt: [[` ${H} `, '\\|/', '| \\'], [`  ${H}`, ' \\|', '/ \\']],
    sit: [[` ${H} `, '/|\\', ' |_']],
    wave: [[` ${H}/`, '/| ', '/ \\'], [` ${H}|`, '/| ', '/ \\']],
    sleep: [['   ', `${H}__ `, '   ']],
    talk: [[` ${H} `, '/|\\', '/ \\'], [` ${H} `, '/|-', '/ \\']],
  };
  const MIRROR = { '/': '\\', '\\': '/', '(': ')', ')': '(', '<': '>', '>': '<', '[': ']', ']': '[', '{': '}', '}': '{', 'b': 'd', 'd': 'b', 'p': 'q', 'q': 'p' };
  function mirror(rows) { return rows.map((r) => r.split('').reverse().map((c) => MIRROR[c] || c).join('')); }
  function sprite(kind, t, facing) {
    const frames = SPRITES[kind] || SPRITES.idle;
    const f = frames[Math.floor(((t % 1) + 1) % 1 * frames.length) % frames.length];
    return facing < 0 ? mirror(f) : f.slice();
  }

  function pose(kind, t, p) { return (POSES[kind] || POSES.idle)(t, p || {}); }

  function toSegs(j, facing = 1) {
    const f = (q) => ({ x: q.x * facing, y: q.y });
    const L = (a, b) => { const A = f(a), B = f(b); return { x1: A.x, y1: A.y, x2: B.x, y2: B.y }; };
    return [
      L(j.neck, j.hip),
      L(j.hip, j.kneeL), L(j.kneeL, j.footL),
      L(j.hip, j.kneeR), L(j.kneeR, j.footR),
      L(j.shoulder, j.elbowL), L(j.elbowL, j.handL),
      L(j.shoulder, j.elbowR), L(j.elbowR, j.handR),
    ];
  }

  PA.Stick = { pose, toSegs, ik, POSES, HEIGHT: 46, sprite, mirror, SPRITES, HEAD: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Stick;
})(typeof window !== 'undefined' ? window : globalThis);
