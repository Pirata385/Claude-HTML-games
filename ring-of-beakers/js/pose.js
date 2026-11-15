// pose.js — analytic poses (standing, walking, flying, sitting) for a phenotype. The same pose
// structure comes out of the ragdoll (creature.js), so the art only ever draws poses. No DOM.
//
// World space is y-down. A pose is:
//   { f, hx, hy, cx, cy, neck: [x, y, ...] (last pair = head centre), headAng, legs: [{ ax, ay, fx, fy, side, pair, lift }],
//     tx, ty (tail tip), wing (0 folded .. ~1.6 raised), arms: [{ sx, sy, x, y }], beakOpen, eye ('', 'blink', 'ko', 'sleep', 'angry') }
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { lerp, TAU, clamp } = RB.core;

  // Standing height of the leg attach point above the ground.
  function standHeight(P) { return P.rest; }
  const attachTs = (P) => (P.legPairs > 1 ? [0.14, 0.8] : [P.stanceT]);

  // o: { x, y (ground), f, phase (walk cycle 0..1), speed (0 idle .. 1 run), time, fly (0..1), sit (0..1), lean, headTurn }
  function animPose(P, o) {
    const f = o.f || 1, sp = o.speed || 0, ph = o.phase || 0, time = o.time || 0;
    const fly = o.fly || 0, sit = o.sit || 0;
    const pitch = lerp(P.pitch, 0.2, fly) - 0.16 * sp * (1 - P.posture) + (o.lean || 0);
    const cs = Math.cos(pitch), sn = Math.sin(pitch);
    const ts = attachTs(P), t0 = ts[0];
    const stand = standHeight(P);
    const sitH = t0 * P.TL * sn + P.TD * 0.46;
    const bob = Math.sin(ph * TAU * 2) * 0.035 * P.LLv * sp + Math.sin(time * 2.1) * 0.012 * P.TD;
    const ay = -(lerp(stand, sitH, sit) + bob) - (o.alt || 0);
    // local frame: +x forward, y down, origin on the ground under the first attach point
    const hx = -t0 * P.TL * cs, hy = ay + t0 * P.TL * sn;
    const cx = (1 - t0) * P.TL * cs, cy = ay - (1 - t0) * P.TL * sn;
    const pose = { f, wing: 0, beakOpen: 0, eye: '' };
    const X = (lx) => o.x + f * lx, Y = (ly) => o.y + ly;
    pose.hx = X(hx); pose.hy = Y(hy); pose.cx = X(cx); pose.cy = Y(cy);
    // neck
    const k = P.neckK, seg = P.NL / k, nod = Math.sin(ph * TAU * 2) * 0.12 * sp + (o.nod || 0);
    let nx = cx, ny = cy;
    pose.neck = [];
    for (let i = 0; i < k; i++) {
      const a = P.neckAng[i] - nod * (i + 1) / k - sit * 0.25 - fly * 0.5 * (1 - P.posture);
      nx += seg * Math.cos(a); ny -= seg * Math.sin(a);
      pose.neck.push(X(nx), Y(ny));
    }
    const ha = 0.1 + (o.headTurn || 0);
    pose.headAng = f > 0 ? ha : Math.PI - ha;
    // legs
    pose.legs = [];
    const hs = lerp(0.1 * P.LLv, P.hsMax, sp);
    for (let p = 0; p < ts.length; p++) {
      const lax = hx + ts[p] * P.TL * cs, lay = hy - ts[p] * P.TL * sn;
      for (let side = 0; side < 2; side++) {
        let fx, fy, lift = 0;
        if (fly > 0.5) { fx = lax - 0.35 * P.LLv; fy = lay + 0.42 * P.TD + 0.5 * P.LLv; lift = 1; }
        else if (sp < 0.02) { fx = lax + (side ? -1 : 1) * 0.1 * P.LLv; fy = -(o.alt || 0); }
        else {
          const u = (ph + (side ? 0.5 : 0) + (p ? 0.5 : 0)) % 1;
          if (u < 0.5) { fx = lax + hs * (1 - u * 4); fy = 0; }
          else { const s = (u - 0.5) * 2; fx = lax + hs * (-1 + s * 2); lift = Math.sin(s * Math.PI); fy = -lift * P.LLv * (0.1 + 0.2 * sp); }
          fy -= (o.alt || 0);
        }
        pose.legs.push({ ax: X(lax), ay: Y(lay), fx: X(fx), fy: Y(fy), side, pair: p, lift });
      }
    }
    // tail: from the rump, the backward axis rotated up by tailAng
    if (P.tailL > 0.5) {
      const ta = Math.PI - pitch + P.tailAng + Math.sin(time * 3 + ph * TAU) * 0.05;
      pose.tx = X(hx + Math.cos(ta) * P.tailL * 0.55); pose.ty = Y(hy + Math.sin(ta) * P.tailL * 0.55);
    } else { pose.tx = NaN; pose.ty = NaN; }
    pose.wing = fly > 0.5 ? 0.7 + Math.sin(time * (o.flapHz || 14)) * 0.75 : (o.wing || 0);
    // arms
    if (P.armL > 0) {
      const sx = hx + 0.82 * P.TL * cs, sy = hy - 0.82 * P.TL * sn;
      pose.arms = [];
      for (let side = 0; side < 2; side++) {
        const sw = Math.sin(ph * TAU + (side ? Math.PI : 0)) * sp * 0.45;
        const ax = P.person ? 0.12 + sw : 0.55, ayk = P.person ? 0.94 : 0.5;
        pose.arms.push({ sx: X(sx), sy: Y(sy), x: X(sx + P.armL * ax), y: Y(sy + P.armL * ayk), side });
      }
    }
    return pose;
  }

  // Knee position for a leg from attach point to foot (2-bone IK). sign picks the bend side.
  function knee(ax, ay, fx, fy, l1, l2, sign) {
    let dx = fx - ax, dy = fy - ay, d = Math.hypot(dx, dy);
    if (d < 1e-4) { dx = 0; dy = 1; d = 1e-4; }
    const dd = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d, uy = dy / d;
    return { x: ax + ux * a - uy * h * sign, y: ay + uy * a + ux * h * sign };
  }

  // Rough bounding box of a pose, for portraits: { x0, y0, x1, y1 }
  function bounds(P, pose) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y, r) => { if (x - r < x0) x0 = x - r; if (x + r > x1) x1 = x + r; if (y - r < y0) y0 = y - r; if (y + r > y1) y1 = y + r; };
    add(pose.hx, pose.hy, P.TD * 0.6); add(pose.cx, pose.cy, P.TD * 0.6);
    const n = pose.neck.length;
    const hx = pose.neck[n - 2], hy = pose.neck[n - 1];
    add(hx, hy, P.HR * (1.2 + P.comb + P.crest * 1.6));
    add(hx + Math.cos(pose.headAng) * (P.HR + P.BL), hy + Math.sin(pose.headAng) * (P.HR + P.BL), P.BD);
    for (const l of pose.legs) add(l.fx, l.fy, P.FL);
    if (pose.tx === pose.tx) {
      const dx = pose.tx - pose.hx, dy = pose.ty - pose.hy, d = Math.hypot(dx, dy) || 1;
      add(pose.hx + dx / d * P.tailL, pose.hy + dy / d * P.tailL, P.tailL * (0.15 + 0.5 * P.tailFan));
    }
    if (pose.arms) for (const a of pose.arms) add(a.x, a.y, P.LT * 2);
    if (P.WL > 3 && pose.wing > 0.3) add((pose.hx + pose.cx) / 2, (pose.hy + pose.cy) / 2 - P.WL * 0.8, P.WL * 0.6);
    return { x0, y0, x1, y1 };
  }

  RB.pose = { animPose, standHeight, attachTs, knee, bounds };
})();
