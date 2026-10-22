// Small math kit + the isometric projection shared by rendering and input.
(function (XS) {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  // Frame-rate independent exponential approach.
  const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);

  const TAU = Math.PI * 2;
  const wrapAngle = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
  const angleDiff = (from, to) => wrapAngle(to - from);
  const turnToward = (from, to, maxStep) => { const d = angleDiff(from, to); return from + clamp(d, -maxStep, maxStep); };

  // ---- 3D vectors as plain {x, y, z} objects ----
  const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  const v3add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const v3sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const v3scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const v3len = (a) => Math.hypot(a.x, a.y, a.z);
  const v3dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const v3cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const v3norm = (a) => { const l = v3len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
  const v3lerp = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
  const v3dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const dist2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---- Isometric projection ----
  // One world unit is one voxel. A voxel's top face is a (8*S)x(4*S) px
  // diamond and its sides are 4*S px tall; S is the art resolution (2 = fine
  // pixels). The viewer looks along -(1, 1, 1), so x + y + z grows toward the
  // camera (used as the depth key).
  const S = 2;
  const ISO = { S, HX: 4 * S, HY: 2 * S, VZ: 4 * S, TILE_W: 8 * S, TILE_H: 4 * S };
  // World radius -> pixel radius, and the half-axes of a projected ground circle.
  const PXU = 4.4 * S, ELX = ISO.HX * Math.SQRT2, ELY = ISO.HY * Math.SQRT2;
  const isoX = (x, y) => (x - y) * ISO.HX;
  const isoY = (x, y, z) => (x + y) * ISO.HY - z * ISO.VZ;
  const depth = (x, y, z) => x + y + z;
  // Screen-space direction -> world (x, y) direction on the ground plane.
  function screenDirToWorld(sx, sy) {
    const wx = (sx / ISO.HX + sy / ISO.HY) / 2;
    const wy = (sy / ISO.HY - sx / ISO.HX) / 2;
    const l = Math.hypot(wx, wy);
    return l > 1e-6 ? { x: wx / l, y: wy / l } : { x: 0, y: 0 };
  }
  // Screen point -> world point on the horizontal plane at height z.
  function screenToWorld(sx, sy, z) {
    const a = sx / ISO.HX;            // x - y
    const b = (sy + z * ISO.VZ) / ISO.HY; // x + y
    return { x: (a + b) / 2, y: (b - a) / 2, z };
  }

  // Number formatting in Brazilian Portuguese ("4,2").
  const fmt1 = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const fmtInt = (n) => Math.round(n).toLocaleString('pt-BR');

  Object.assign(XS, {
    clamp, lerp, invLerp, smooth, easeOutCubic, easeInCubic, easeOutBack, damp,
    TAU, wrapAngle, angleDiff, turnToward,
    v3, v3add, v3sub, v3scale, v3len, v3dot, v3cross, v3norm, v3lerp, v3dist, dist2d,
    ISO, PXU, ELX, ELY, isoX, isoY, depth, screenDirToWorld, screenToWorld,
    fmt1, fmtInt,
  });
})(globalThis.XS = globalThis.XS || {});
