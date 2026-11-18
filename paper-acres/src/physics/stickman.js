/* Stickman rig: a hand-drawn stick figure with real joints (IK knees and elbows), animated procedurally.
 * Coordinates are world px relative to the point between the feet (y up is negative), facing right.
 * The ASCII renderer converts the drawing; nothing here knows about characters. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const TAU = Math.PI * 2;
  const BONES = { thigh: 14, shin: 14, upper: 10, fore: 10, spine: 17, neck: 3 };
  // body thickness in figure units (the figure is drawn 1.5x; 4 units = 6 px = one character)
  const SHAPE = { limb: 4, torso: 8, head: 8 };
  const HEAD_R = SHAPE.head;
  const HIP_Y = -27.5;

  const v = (x, y) => ({ x, y });
  /** Two-bone IK: the middle joint between a and b, bending toward `side` (+1 = the figure's front). */
  function ik(a, b, l1, l2, side) {
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.02;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    if (d < 1e-3) return v(a.x + side * l1, a.y);
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    const ux = dx / d, uy = dy / d;
    // perpendicular pointing to the figure's front (+x) when the limb hangs down
    return v(a.x + ux * along - uy * h * side, a.y + uy * along + ux * h * side);
  }
  /** Clamp an end effector so the limb can reach it. */
  function reach(a, b, l) { const d = Math.hypot(b.x - a.x, b.y - a.y); return d <= l ? b : v(a.x + (b.x - a.x) / d * l, a.y + (b.y - a.y) / d * l); }

  /** Assemble a full pose from the hip, a lean, foot targets and hand targets. */
  function pose(hip, lean, footL, footR, handL, handR, o) {
    const opt = o || {};
    const chest = v(hip.x + lean, hip.y - Math.sqrt(Math.max(1, BONES.spine * BONES.spine - lean * lean)));
    const legL = BONES.thigh + BONES.shin, armL = BONES.upper + BONES.fore;
    footL = reach(hip, footL, legL); footR = reach(hip, footR, legL);
    handL = reach(chest, handL, armL); handR = reach(chest, handR, armL);
    const kneeL = ik(hip, footL, BONES.thigh, BONES.shin, -1);
    const kneeR = ik(hip, footR, BONES.thigh, BONES.shin, -1);
    const elbowL = ik(chest, handL, BONES.upper, BONES.fore, opt.elbows || 1);
    const elbowR = ik(chest, handR, BONES.upper, BONES.fore, opt.elbows || 1);
    const tilt = opt.headTilt || 0;
    const neckDir = Math.atan2(chest.y - hip.y, chest.x - hip.x) + tilt;
    const head = v(chest.x + Math.cos(neckDir) * (BONES.neck + HEAD_R), chest.y + Math.sin(neckDir) * (BONES.neck + HEAD_R));
    return { hip, chest, head, kneeL, footL, kneeR, footR, elbowL, handL, elbowR, handR, bend: opt.bend || 0 };
  }

  const RIGS = {
    idle(t) {
      const b = Math.sin(t * TAU);
      const hip = v(0, HIP_Y + b * 0.4);
      return pose(hip, 0.6, v(-7, 0), v(7, 0), v(-11, -24 + b * 0.8), v(11.5, -24 + b * 0.8), { bend: 1.5 });
    },
    walk(t, p) {
      const S = p.stride || 10, L = p.lift || 6, ph = t * TAU;
      const c = Math.cos(ph), s = Math.sin(ph);
      const footL = v(S * c, -L * Math.max(0, -s)), footR = v(-S * c, -L * Math.max(0, s));
      const hip = v(0, HIP_Y + 1.6 * Math.abs(c) - 0.6);
      const lean = p.lean != null ? p.lean : 2.5;
      const A = p.arm || 11;
      const handL = v(lean - A * c - 3, -24 + Math.abs(c) * 3), handR = v(lean + A * c + 3, -24 + Math.abs(c) * 3);
      return pose(hip, lean, footL, footR, handL, handR, { bend: 2 });
    },
    run(t) {
      const ph = t * TAU, c = Math.cos(ph), s = Math.sin(ph);
      const footL = v(13 * c, -9 * Math.max(0, -s) - 1), footR = v(-13 * c, -9 * Math.max(0, s) - 1);
      const hip = v(2, HIP_Y + 2.4 * Math.abs(c) - 0.5);
      const lean = 7;
      // pumping arms, elbows bent at ~90 degrees
      const handL = v(2 + lean - 9 * c, -33 - 3 * s), handR = v(2 + lean + 9 * c, -33 + 3 * s);
      return pose(hip, lean, footL, footR, handL, handR, { elbows: -1, bend: 3 });
    },
    crouch() { return pose(v(0, HIP_Y + 7), 4, v(-6, 0), v(6, 0), v(-4, -18), v(10, -20), { bend: 4 }); },
    jump(t) {
      const s = Math.sin(t * TAU) * 1.5;
      return pose(v(0, HIP_Y), 0.5, v(-7, -8 + s), v(9, -4), v(-11, -61), v(12, -60 + s), { headTilt: -0.15 });
    },
    fall(t) {
      const s = Math.sin(t * TAU * 2) * 3;
      return pose(v(0, HIP_Y), -0.5, v(-7, 0), v(8, -3), v(-15, -50 + s), v(15, -52 - s));
    },
    land() { return pose(v(0, HIP_Y + 8), 5, v(-7, 0), v(7, 0), v(-12, -14), v(14, -16), { bend: 5 }); },
    climb(t) {
      const s = Math.sin(t * TAU);
      return pose(v(0, HIP_Y), 0, v(-4, -3 - s * 4), v(4, -3 + s * 4), v(-4, -60 + s * 5), v(4, -60 - s * 5), { elbows: -1 });
    },
    swim(t) {
      const s = Math.sin(t * TAU), c = Math.cos(t * TAU);
      const hip = v(-6, -22);
      const j = pose(hip, 13, v(-26, -18 + s * 4), v(-25, -24 - s * 4), v(20 + c * 6, -38 + s * 5), v(18 - c * 6, -30 - s * 5));
      return j;
    },
    /** Tool/weapon swing: p.progress 0..1, p.aim (rad, 0 = straight ahead). */
    swing(t, p) {
      const pr = PA.U.clamp(p.progress || 0, 0, 1), base = p.aim != null ? p.aim : 0.35;
      const a = base - 2.2 + PA.U.smooth(pr) * 3.0;
      const lean = -2 + pr * 7;
      const hip = v(0, HIP_Y + pr * 2);
      const chest = v(lean, hip.y - BONES.spine);
      const handR = v(chest.x + Math.cos(a) * 19, chest.y + Math.sin(a) * 19);
      const j = pose(hip, lean, v(-9, 0), v(10, 0), v(-12, -30), handR, { elbows: 1 });
      return j;
    },
    hurt(t) {
      const s = Math.sin(t * TAU * 3) * 2;
      return pose(v(-1, HIP_Y), -6, v(-7, 0), v(7, -2), v(-16, -46 + s), v(10, -48 - s), { headTilt: 0.35 });
    },
    wave(t) { const s = Math.sin(t * TAU * 2); return pose(v(0, HIP_Y), 0.5, v(-7, 0), v(7, 0), v(-11, -24), v(12 + s * 4, -58), { elbows: -1 }); },
    talk(t) { const s = Math.sin(t * TAU * 2); return pose(v(0, HIP_Y), 1, v(-7, 0), v(7, 0), v(-11, -24), v(13, -34 + s * 3), { elbows: -1 }); },
    sit() { return pose(v(-2, -14), 1.5, v(14, 0), v(16, 0), v(8, -16), v(10, -16)); },
  };

  function rig(kind, t, p) { return (RIGS[kind] || RIGS.idle)(t || 0, p || {}); }

  function blend(a, b, k) {
    if (!a) return b;
    const out = {};
    for (const key in b) {
      if (typeof b[key] === 'number') { out[key] = b[key]; continue; }
      const A = a[key] || b[key];
      out[key] = v(A.x + (b[key].x - A.x) * k, A.y + (b[key].y - A.y) * k);
    }
    return out;
  }

  /** Build the figure's path (limbs, curved spine, little feet) into ctx, mirrored by facing. */
  function tracePath(ctx, j, f) {
    const X = (q) => q.x * f;
    const limb = (a, b, c) => { ctx.moveTo(X(a), a.y); ctx.lineTo(X(b), b.y); ctx.lineTo(X(c), c.y); };
    // spine: a gentle curve that bows backward when leaning
    const mx = (j.hip.x + j.chest.x) / 2 - (j.bend || 0) * 0.6, my = (j.hip.y + j.chest.y) / 2;
    ctx.moveTo(X(j.hip), j.hip.y); ctx.quadraticCurveTo(mx * f, my, X(j.chest), j.chest.y);
    limb(j.hip, j.kneeL, j.footL); limb(j.hip, j.kneeR, j.footR);
    limb(j.chest, j.elbowL, j.handL); limb(j.chest, j.elbowR, j.handR);
    // feet: short strokes pointing forward
    ctx.moveTo(X(j.footL), j.footL.y); ctx.lineTo((j.footL.x + 3.5) * f, j.footL.y);
    ctx.moveTo(X(j.footR), j.footR.y); ctx.lineTo((j.footR.x + 3.5) * f, j.footR.y);
    // neck
    const nx = j.chest.x + (j.head.x - j.chest.x) * 0.35, ny = j.chest.y + (j.head.y - j.chest.y) * 0.35;
    ctx.moveTo(X(j.chest), j.chest.y); ctx.lineTo(nx * f, ny);
  }

  /** Solid body: back limbs, torso + neck, front limbs as thick round strokes in st.solid; the head is a hollow ring. */
  function drawSolid(ctx, j, f, st) {
    const X = (q) => q.x * f;
    const stroke = (w, build) => { ctx.lineWidth = w; ctx.strokeStyle = st.solid; ctx.beginPath(); build(); ctx.stroke(); };
    const limb = (a, b, c, foot) => stroke(SHAPE.limb, () => { ctx.moveTo(X(a), a.y); ctx.lineTo(X(b), b.y); ctx.lineTo(X(c), c.y); if (foot) ctx.lineTo((c.x + 3) * f, c.y); });
    // the left limbs are the far side when facing right (and the near side when facing left)
    const backArm = f > 0 ? ['elbowL', 'handL'] : ['elbowR', 'handR'], frontArm = f > 0 ? ['elbowR', 'handR'] : ['elbowL', 'handL'];
    const backLeg = f > 0 ? ['kneeL', 'footL'] : ['kneeR', 'footR'], frontLeg = f > 0 ? ['kneeR', 'footR'] : ['kneeL', 'footL'];
    limb(j.chest, j[backArm[0]], j[backArm[1]]);
    limb(j.hip, j[backLeg[0]], j[backLeg[1]], true);
    const mx = (j.hip.x + j.chest.x) / 2 - (j.bend || 0) * 0.6, my = (j.hip.y + j.chest.y) / 2;
    // the neck stops at the rim of the head so the ring stays round
    const hd = Math.hypot(j.head.x - j.chest.x, j.head.y - j.chest.y) || 1;
    const nk = Math.max(0, hd - HEAD_R - SHAPE.limb * 0.6) / hd;
    const nx = j.chest.x + (j.head.x - j.chest.x) * nk, ny = j.chest.y + (j.head.y - j.chest.y) * nk;
    stroke(SHAPE.torso, () => { ctx.moveTo(X(j.hip), j.hip.y); ctx.quadraticCurveTo(mx * f, my, X(j.chest), j.chest.y); });
    if (st.wide) stroke(SHAPE.torso + st.wide, () => { ctx.moveTo(X(j.chest), j.chest.y + 2); ctx.lineTo(X(j.hip), j.hip.y + 8); });
    if (st.skirt) { ctx.fillStyle = st.solid; ctx.beginPath(); ctx.moveTo(X(j.hip) - 4, j.hip.y - 4); ctx.lineTo(X(j.hip) - 11, j.hip.y + 12); ctx.lineTo(X(j.hip) + 11, j.hip.y + 12); ctx.lineTo(X(j.hip) + 4, j.hip.y - 4); ctx.closePath(); ctx.fill(); }
    stroke(SHAPE.limb, () => { ctx.moveTo(X(j.chest), j.chest.y); ctx.lineTo(nx * f, ny); });
    limb(j.hip, j[frontLeg[0]], j[frontLeg[1]], true);
    limb(j.chest, j[frontArm[0]], j[frontArm[1]]);
    // hollow round head: blank paper inside a thin ink ring
    ctx.fillStyle = st.paper; ctx.beginPath(); ctx.arc(j.head.x * f, j.head.y, HEAD_R, 0, TAU); ctx.fill();
    ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw; ctx.beginPath(); ctx.arc(j.head.x * f, j.head.y, HEAD_R, 0, TAU); ctx.stroke();
  }

  /** Draw the figure: paper halo first (so scenery never cuts through it), then the body. */
  function draw(ctx, j, facing, st) {
    const f = facing < 0 ? -1 : 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (st.halo) {
      // a blank-paper aura around the whole figure: nothing behind it may cut through the drawing
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k in j) { const q = j[k]; if (typeof q !== 'object') continue; x0 = Math.min(x0, q.x * f); x1 = Math.max(x1, q.x * f); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      y0 = Math.min(y0, j.head.y - HEAD_R);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + st.halo, ry = (y1 - y0) / 2 + st.halo;
      ctx.fillStyle = st.paper; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.15, ry * 1.08, 0, 0, TAU); ctx.fill();
    }
    if (st.solid) { drawSolid(ctx, j, f, st); return; }
    ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw;
    ctx.beginPath(); tracePath(ctx, j, f);
    ctx.moveTo(j.head.x * f + HEAD_R, j.head.y); ctx.arc(j.head.x * f, j.head.y, HEAD_R, 0, TAU);
    ctx.stroke();
  }

  PA.Stick = { rig, blend, draw, ik, BONES, HEAD_R, SHAPE, RIGS, SCALE: 1.5 }; // drawn 1.5x: ~9 character rows tall
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Stick;
})(typeof window !== 'undefined' ? window : globalThis);
