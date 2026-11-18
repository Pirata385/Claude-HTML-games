/* Stickman rig: a thin stick figure with real joints (IK knees and elbows), animated procedurally.
 * Coordinates are world px relative to the point between the feet (y up is negative), facing right.
 * The ASCII renderer converts the drawing; nothing here knows about characters. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const TAU = Math.PI * 2;
  // Proportions come from the player's reference drawing: a big round hollow head (about 30% of the height),
  // a long thin torso, straight arms leaving it a little below the neck, straight legs in an upside-down V.
  // At 1.5x every part lands on whole character rows (10 px): head 3 rows, neck 1, torso 3, legs 3.
  const BONES = { thigh: 12, shin: 12, upper: 9, fore: 9, spine: 14.67, neck: 10 };
  const HEAD = { rx: 14, ry: 10 }; // 7 characters wide, 3 rows tall
  // thin rule: every body line is exactly one character thick (rasterised cell by cell, see cellLine)
  const SHAPE = { line: 1, head: HEAD };
  /* The hollow head as the renderer sees it: a pencil outline fitted to the character grid, drawn crisp on the
   * buffer's samples (4x6 per character) around the middle of its centre cell, so it converts to a clean
   * " .---. " / "(     )" / " '---' " instead of anti-aliased crumbs. Left half; the right half is its mirror. */
  const HEAD_OUTLINE = (() => {
    const half = [
      [[-6, -6], [-1, -6]],                                                // top
      [[-6, 5], [-1, 5]],                                                  // bottom
      [[-8, -5], [-8, -5]],                                                // upper corner
      [[-8, 4], [-8, 4]],                                                  // lower corner
      [[-11, -3], [-12, -3], [-13, -2], [-13, 1], [-12, 2], [-11, 2]],     // side
    ];
    return half.concat(half.map((pl) => pl.map(([x, y]) => [-1 - x, y])));
  })();
  /** Every sample the head outline covers, relative to the centre of the head's middle cell (in samples). */
  function headSamples() {
    const seen = new Set(), out = [];
    for (const pl of HEAD_OUTLINE) for (let i = 0; i < pl.length; i++) {
      const a = pl[Math.max(0, i - 1)], b = pl[i], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
      for (let k = 0; k <= n; k++) {
        const x = Math.round(a[0] + (b[0] - a[0]) * k / n), y = Math.round(a[1] + (b[1] - a[1]) * k / n), key = x + ',' + y;
        if (!seen.has(key)) { seen.add(key); out.push([x, y]); }
      }
    }
    return out;
  }
  // Models: the same thin figure filled with different characters (never letters or digits). The player picked
  // the rungs (the 15th of the first twenty symbol models; the rest were dropped) and asked for two more in the same
  // pattern: solid squares and solid spheres. All three are drawn by hand in the glyph atlas (PA.Glyphs.CUSTOM).
  const MODELS = [
    { name: 'Rungs', body: '\u2261' },   // the player's pick
    { name: 'Blocks', body: '\u25A0' },  // solid squares
    { name: 'Beads', body: '\u25CF' },   // solid spheres
  ];
  /** A valid model index (choices saved from older versions fall back to the first model). */
  function model(i) { const k = i | 0; return k >= 0 && k < MODELS.length ? k : 0; }
  const HEAD_R = HEAD.ry;
  const HIP_Y = -21.33;

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

  /** Assemble a full pose from the hip, a lean, foot targets and hand targets (relative to the chest). */
  function pose(hip, lean, footL, footR, handL, handR, o) {
    const opt = o || {};
    const chest = v(hip.x + lean, hip.y - Math.sqrt(Math.max(1, BONES.spine * BONES.spine - lean * lean)));
    const legL = BONES.thigh + BONES.shin, armL = BONES.upper + BONES.fore;
    // hand targets are given relative to the chest (the shoulders)
    handL = v(chest.x + handL.x, chest.y + handL.y); handR = v(chest.x + handR.x, chest.y + handR.y);
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
    // standing like the drawing: straight legs apart, straight arms down and out
    idle(t, p) {
      const b = Math.sin(t * TAU);
      const hip = v(0, HIP_Y + b * 0.3);
      const ax = p.armX != null ? p.armX : 15.5, ay = p.armY != null ? p.armY : 8.5;
      return pose(hip, 0, v(-11, 0), v(11, 0), v(-ax, ay + b * 0.4), v(ax, ay + b * 0.4));
    },
    walk(t, p) {
      const S = p.stride || 9, L = p.lift || 5, ph = t * TAU;
      const c = Math.cos(ph), s = Math.sin(ph);
      const footL = v(S * c, -L * Math.max(0, -s)), footR = v(-S * c, -L * Math.max(0, s));
      const hip = v(0, HIP_Y + 1.2 * Math.abs(c) - 0.4);
      const lean = p.lean != null ? p.lean : 1;
      // arms stay out to the sides like the drawing (never alongside the thin torso) and swing a little
      const A = BONES.upper + BONES.fore - 0.2, a0 = Math.atan2(p.armY != null ? p.armY : 8.5, p.armX != null ? p.armX : 15.5), sw = 0.3 * c;
      return pose(hip, lean, footL, footR, v(-A * Math.cos(a0 + sw), A * Math.sin(a0 + sw)), v(A * Math.cos(a0 - sw), A * Math.sin(a0 - sw)));
    },
    run(t) {
      const ph = t * TAU, c = Math.cos(ph), s = Math.sin(ph);
      const footL = v(11 * c, -8 * Math.max(0, -s) - 1), footR = v(-11 * c, -8 * Math.max(0, s) - 1);
      const hip = v(2, HIP_Y + 2 * Math.abs(c) - 0.3);
      // arms flung out and pumping, well away from the torso
      const A = BONES.upper + BONES.fore - 0.2, sw = 0.45 * c;
      return pose(hip, 4, footL, footR, v(-A * Math.cos(0.3 + sw), A * Math.sin(0.3 + sw)), v(A * Math.cos(0.3 - sw), A * Math.sin(0.3 - sw)));
    },
    crouch() { return pose(v(0, HIP_Y + 6), 3, v(-6, 0), v(6, 0), v(-7, 13), v(8, 12)); },
    jump(t) {
      const s = Math.sin(t * TAU) * 1.5;
      return pose(v(0, HIP_Y), 0.5, v(-6, -7 + s), v(8, -4), v(-11, -13), v(11, -12 + s), { headTilt: -0.15 });
    },
    fall(t) {
      const s = Math.sin(t * TAU * 2) * 3;
      return pose(v(0, HIP_Y), -0.5, v(-7, 0), v(8, -3), v(-15, -4 + s), v(15, -5 - s));
    },
    land() { return pose(v(0, HIP_Y + 6), 3, v(-8, 0), v(8, 0), v(-13, 10), v(12, 11)); },
    climb(t) {
      const s = Math.sin(t * TAU);
      return pose(v(0, HIP_Y), 0, v(-4, -3 - s * 4), v(4, -3 + s * 4), v(-4, -14 + s * 3), v(4, -14 - s * 3), { elbows: -1 });
    },
    swim(t) {
      const s = Math.sin(t * TAU), c = Math.cos(t * TAU);
      return pose(v(-6, -16), 13, v(-27, -14 + s * 4), v(-26, -19 - s * 4), v(12 + c * 5, -3 + s * 4), v(10 - c * 5, 3 - s * 4));
    },
    /** Tool/weapon swing: p.progress 0..1, p.aim (rad, 0 = straight ahead). */
    swing(t, p) {
      const pr = PA.U.clamp(p.progress || 0, 0, 1), base = p.aim != null ? p.aim : 0.35;
      const a = base - 2.2 + PA.U.smooth(pr) * 3.0;
      const lean = -2 + pr * 5;
      const hip = v(0, HIP_Y + pr * 2);
      const R = BONES.upper + BONES.fore - 1;
      return pose(hip, lean, v(-9, 0), v(9, 0), v(-10, 11), v(Math.cos(a) * R, Math.sin(a) * R), { elbows: 1 });
    },
    hurt(t) {
      const s = Math.sin(t * TAU * 3) * 2;
      return pose(v(-1, HIP_Y), -4, v(-8, 0), v(8, -2), v(-10, -4 + s), v(15, -5 - s), { headTilt: 0.35 });
    },
    wave(t) { const s = Math.sin(t * TAU * 2); return pose(v(0, HIP_Y), 0.2, v(-11, 0), v(11, 0), v(-15.5, 8.5), v(9 + s * 4, -13), { elbows: -1 }); },
    talk(t) { const s = Math.sin(t * TAU * 2); return pose(v(0, HIP_Y), 0.5, v(-11, 0), v(11, 0), v(-15.5, 8.5), v(12, 5 + s * 3), { elbows: -1 }); },
    sit() { return pose(v(-2, -12), 1.5, v(14, 0), v(16, 0), v(8, 12), v(10, 12)); },
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

  /** Where the neck meets the bottom of the head (the neck never enters the hollow head). */
  function neckEnd(j) {
    const dx = j.head.x - j.chest.x, dy = j.head.y - j.chest.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, d - HEAD.ry) / d;
    return v(j.chest.x + dx * k, j.chest.y + dy * k);
  }
  /** The body as polylines: torso and neck, both legs, both arms (straight segments, no feet, no hands). */
  function bodyLines(j) {
    return [[j.hip, j.chest, neckEnd(j)], [j.hip, j.kneeL, j.footL], [j.hip, j.kneeR, j.footR], [j.chest, j.elbowL, j.handL], [j.chest, j.elbowR, j.handR]];
  }
  /** The character cells a line crosses, one per row when steep or one per column when shallow (cell units in, [c, r]
   * out). The ends sit in their own cells and the middle follows the line without gaps. Columns are rounded toward
   * axisX (the figure's middle) so mirrored limbs give mirrored cells. */
  function cellLine(x0, y0, x1, y1, out, axisX) {
    const res = out || [];
    const fx = (x) => Math.floor(axisX == null ? x : x + (axisX > x ? 1e-6 : -1e-6));
    const steep = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
    const a0 = steep ? y0 : x0, a1 = steep ? y1 : x1, b0 = steep ? x0 : y0, b1 = steep ? x1 : y1;
    const fa = steep ? Math.floor : fx, fb = steep ? fx : Math.floor;
    const i0 = fa(a0), i1 = fa(a1), dir = i1 >= i0 ? 1 : -1;
    let prev = null;
    for (let i = i0; ; i += dir) {
      // ends: the end points themselves; in between: where the line crosses the middle of the row (or column)
      const t = i === i0 ? 0 : i === i1 ? 1 : (i + 0.5 - a0) / (a1 - a0);
      let m = fb(b0 + (b1 - b0) * t);
      if (prev != null && Math.abs(m - prev) > 1) m = prev + Math.sign(m - prev);
      res.push(steep ? [m, i] : [i, m]);
      prev = m;
      if (i === i1) break;
    }
    return res;
  }
  /** Thin solid body: every line becomes whole character cells in st.solid, so the renderer fills each with the model's
   * character (exactly one character thick). The hollow head is HEAD_OUTLINE drawn crisp in ink on the cells around
   * the head joint; the renderer converts it like any other line. Returns the head centre used (figure units). */
  function drawSolid(ctx, j, f, st) {
    const T = ctx.getTransform(), M = PA.Matcher, SX = M ? M.SX : 4, SY = M ? M.SY : 6;
    const cell = (q) => [(T.a * q.x * f + T.c * q.y + T.e) / SX, (T.b * q.x * f + T.d * q.y + T.f) / SY];
    const hc = cell(j.head), HC = Math.floor(hc[0]), HR = Math.floor(hc[1]);
    const seen = new Set(), cells = [], axis = cell(j.hip)[0];
    for (const full of bodyLines(j)) {
      // a limb that is almost straight is drawn as one straight line (like the drawing): an even staircase
      let line = full;
      if (full.length === 3) {
        const a = cell(full[0]), m = cell(full[1]), b = cell(full[2]);
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        if (Math.abs((m[0] - a[0]) * dy - (m[1] - a[1]) * dx) / L < 0.45) line = [full[0], full[2]];
      }
      const rows = new Map(), cols = new Map(); // cells of this limb so far, by row and by column
      for (let i = 1; i < line.length; i++) {
        const a = cell(line[i - 1]), b = cell(line[i]), steep = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
        for (const q of cellLine(a[0], a[1], b[0], b[1], null, axis)) {
          // across a knee or an elbow the limb stays one character thick: one cell per row (or column)
          const twin = steep ? rows.get(q[1]) : cols.get(q[0]);
          if (twin != null && Math.abs(twin - (steep ? q[0] : q[1])) <= 1) continue;
          rows.set(q[1], q[0]); cols.set(q[0], q[1]);
          const key = q[0] * 4096 + q[1];
          if (seen.has(key)) continue;
          seen.add(key);
          if (Math.abs(q[0] - HC) <= 3 && Math.abs(q[1] - HR) <= 1) continue; // the head's 7x3 cells stay hollow
          cells.push(q);
        }
      }
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = st.solid;
    for (const q of cells) ctx.fillRect(q[0] * SX, q[1] * SY, SX, SY);
    // hollow head: blank paper over its cells, then the outline
    const ox = HC * SX + SX / 2, oy = HR * SY + SY / 2;
    ctx.fillStyle = st.paper; ctx.fillRect((HC - 3) * SX, (HR - 1) * SY, 7 * SX, 3 * SY);
    ctx.fillStyle = st.ink;
    for (const q of headSamples()) ctx.fillRect(ox + q[0], oy + q[1], 1, 1);
    ctx.restore();
    const I = T.inverse(), hx = I.a * ox + I.c * oy + I.e, hy = I.b * ox + I.d * oy + I.f;
    return v(hx * f, hy);
  }

  /** Draw the figure: paper halo first (so scenery never cuts through it), then the body. Returns the head centre drawn. */
  function draw(ctx, j, facing, st) {
    const f = facing < 0 ? -1 : 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (st.halo) {
      // a blank-paper aura around the whole figure: nothing behind it may cut through the drawing
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const k in j) { const q = j[k]; if (typeof q !== 'object') continue; x0 = Math.min(x0, q.x * f); x1 = Math.max(x1, q.x * f); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      y0 = Math.min(y0, j.head.y - HEAD.ry - 8);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + st.halo, ry = (y1 - y0) / 2 + st.halo;
      ctx.fillStyle = st.paper; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.15, ry * 1.08, 0, 0, TAU); ctx.fill();
    }
    if (st.solid) return drawSolid(ctx, j, f, st);
    // far slices: the same figure as thin pencil lines
    ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw;
    ctx.beginPath();
    for (const line of bodyLines(j)) { ctx.moveTo(line[0].x * f, line[0].y); for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x * f, line[i].y); }
    ctx.moveTo(j.head.x * f + HEAD.rx, j.head.y); ctx.ellipse(j.head.x * f, j.head.y, HEAD.rx, HEAD.ry, 0, 0, TAU);
    ctx.stroke();
    return j.head;
  }

  /** World x of the middle of the character column holding x (characters are half a world cell wide). */
  function snapX(x) { const w = (PA.C ? PA.C.CELL_W : 12) / 2; return Math.floor(x / w) * w + w / 2; }

  PA.Stick = { rig, blend, draw, ik, cellLine, bodyLines, snapX, headSamples, model, BONES, HEAD, HEAD_R, SHAPE, MODELS, RIGS, SCALE: 1.5 }; // drawn 1.5x: ~10 character rows tall
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Stick;
})(typeof window !== 'undefined' ? window : globalThis);
