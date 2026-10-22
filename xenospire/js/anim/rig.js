// Spore-style procedural animation. A Rig turns a genome plus the fighter's
// physical state into a list of 3D primitives (balls, limbs, eyes, membranes)
// every frame: spines follow their leader, legs plant feet and step with
// 2-bone IK, tails and tentacles swing as chains, heads track the target.
(function (XS) {
  'use strict';

  const { clamp, lerp } = XS;
  const UP = { x: 0, y: 0, z: 1 };

  // ---- tiny mutable vector helpers (hot path) ----
  const set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
  const add3 = (a, b, s = 1) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });
  const len3 = (a) => Math.hypot(a.x, a.y, a.z);

  // Analytic two-bone IK: returns the joint position given root, target,
  // bone lengths and a pole hint direction.
  function ik2(root, target, a, b, pole) {
    let dx = target.x - root.x, dy = target.y - root.y, dz = target.z - root.z;
    let d = Math.hypot(dx, dy, dz) || 1e-4;
    dx /= d; dy /= d; dz /= d;
    d = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.001);
    const x = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    const pd = pole.x * dx + pole.y * dy + pole.z * dz;
    let px = pole.x - dx * pd, py = pole.y - dy * pd, pz = pole.z - dz * pd;
    const pl = Math.hypot(px, py, pz) || 1;
    px /= pl; py /= pl; pz /= pl;
    return { x: root.x + dx * x + px * h, y: root.y + dy * x + py * h, z: root.z + dz * x + pz * h };
  }

  class Rig {
    constructor(genome) {
      this.g = genome;
      this.t = 0;
      this.init = false;
      this.pos = { x: 0, y: 0, z: 0 };
      this.facing = 0;
      this.vel = { x: 0, y: 0 };
      this.speed = 0;
      this.look = 0;          // head yaw offset (radians)
      this.aimAngle = 0;
      this.gait = 0;
      this.airborne = false;
      this.blinkT = 0;
      this.blinkNext = 1 + (genome.seed % 5);
      this.act = { cast: 0, castSide: 1, melee: 0, meleeSide: 1, hurt: 0, hurtX: 0, hurtY: 0, dodge: 0, dodgeDur: 0.3, dodgeKind: 'rolamento', victory: 0, spin: 0 };
      this.flash = 0;
      this.mouthOpen = 0;
      const g = genome;
      this.spine = Array.from({ length: g.spine.n }, () => ({ x: 0, y: 0, z: 0 }));
      this.headP = { x: 0, y: 0, z: 0 };
      this.legs = [];
      const pairs = g.legs.pairs;
      for (let p = 0; p < pairs; p++) {
        for (const side of [-1, 1]) {
          let seg, along = 0;
          if (g.archetype === 'arachnid') { seg = 0; along = [0.55, 0.18, -0.2, -0.55][p] || 0; }
          else if (pairs === 1) seg = g.spine.n - 1;
          else seg = Math.round((p * (g.spine.n - 1)) / (pairs - 1));
          const insect = g.legs.knee === 'up';
          this.legs.push({
            seg, side, along, group: (p + (side > 0 ? 1 : 0)) % 2,
            a: g.legs.len * (insect ? 0.46 : 0.5), b: g.legs.len * (insect ? 0.62 : 0.52),
            splay: insect ? g.legs.len * 0.55 : g.legs.len * 0.1 + g.spine.radii[seg] * 0.45,
            foot: { x: 0, y: 0, z: 0 }, from: null, to: null, t: 0, stepping: false, knee: { x: 0, y: 0, z: 0 }, hip: { x: 0, y: 0, z: 0 },
          });
        }
      }
      this.arms = [];
      for (let p = 0; p < g.arms.pairs; p++) {
        for (const side of [-1, 1]) this.arms.push({ side, row: p, hand: { x: 0, y: 0, z: 0 }, elbow: { x: 0, y: 0, z: 0 }, sh: { x: 0, y: 0, z: 0 } });
      }
      this.tail = g.tail ? Array.from({ length: g.tail.segs + 1 }, () => ({ x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 })) : null;
      this.tents = g.tentacles ? Array.from({ length: g.tentacles.count }, () => Array.from({ length: 5 }, () => ({ x: 0, y: 0, z: 0 }))) : null;
      this.prims = [];
      this.primCount = 0;
      const P = g.palette;
      const white = ['#c8c8d8', '#ffffff', '#ffffff', '#ffffff'];
      this.ramps = {
        body: P.body, belly: P.belly, accent: P.accent,
        limb: [P.body[0], P.body[0], P.body[1], P.body[2]],
        horn: [P.accent[0], P.accent[1], P.accent[2], P.accent[3]],
        glow: P.glow ? XS.color.ramp(P.glow, 4, 0.6) : P.accent,
        white,
      };
      // Decorative surface points (spots / plates) fixed in body space.
      const rng = new XS.RNG(XS.hash(g.seed, 'skin'));
      this.decor = [];
      if (g.pattern === 'spots' || g.pattern === 'glowspots' || g.pattern === 'plates') {
        for (let i = 0; i < g.spine.n; i++) {
          const k = g.pattern === 'plates' ? 1 : rng.int(1, 3);
          for (let j = 0; j < k; j++) {
            this.decor.push(g.pattern === 'plates'
              ? { seg: i, f: 0, r: 0, u: 0.85, size: 0.42 }
              : { seg: i, f: rng.range(-0.5, 0.5), r: rng.range(-0.8, 0.8), u: rng.range(0.1, 0.8), size: rng.range(0.18, 0.3) });
          }
        }
      }
    }

    // ----------------------------------------------------- per-frame update
    // s: { x, y, z (feet level), facing, vx, vy, airborne, aimAngle, alive }
    update(dt, s) {
      dt = Math.min(dt, 1 / 20);
      const g = this.g;
      this.t += dt;
      const A = this.act;
      for (const k of ['cast', 'melee', 'hurt', 'dodge', 'victory']) if (A[k] > 0) A[k] = Math.max(0, A[k] - dt);
      this.flash = Math.max(0, this.flash - dt);
      this.mouthOpen = Math.max(0, this.mouthOpen - dt * 3);
      set(this.pos, s.x, s.y, s.z);
      this.facing = s.facing;
      this.vel.x = s.vx; this.vel.y = s.vy;
      this.speed = Math.hypot(s.vx, s.vy);
      this.airborne = !!s.airborne;
      this.aimAngle = s.aimAngle != null ? s.aimAngle : s.facing;
      this.look = lerp(this.look, clamp(XS.angleDiff(this.facing, this.aimAngle), -0.9, 0.9), 1 - Math.exp(-10 * dt));
      const speedK = clamp(this.speed / (g.stats.speed || 6), 0, 1.3);
      this.gait += dt * (2 + speedK * 9);
      this.blinkNext -= dt;
      if (this.blinkNext < 0) { this.blinkT = 0.12; this.blinkNext = 1.5 + ((this.t * 7919) % 3); }
      this.blinkT = Math.max(0, this.blinkT - dt);

      // Basis.
      const c = Math.cos(this.facing), sn = Math.sin(this.facing);
      const F = { x: c, y: sn, z: 0 }, R = { x: sn, y: -c, z: 0 };
      this.F = F; this.R = R;
      const W = (f, r, u, base = this.pos) => ({ x: base.x + F.x * f + R.x * r, y: base.y + F.y * f + R.y * r, z: base.z + u });

      // ---- body height and spine rest pose ----
      const n = g.spine.n, seg = g.spine.segLen, L = (n - 1) * seg;
      let a = g.posture * 1.25;
      if (g.posture > 0.5) a -= speedK * 0.18; // upright bodies lean into the run
      let hipH;
      if (g.archetype === 'floater') hipH = 1.6 + Math.sin(this.t * 1.6) * 0.22;
      else if (g.archetype === 'serpent') hipH = g.spine.radii[0] * 0.9;
      else if (g.archetype === 'blob') hipH = g.spine.radii[0] * 0.8 + (this.speed > 0.4 ? Math.abs(Math.sin(this.gait * 1.2)) * 0.8 : Math.sin(this.t * 3) * 0.06);
      else hipH = g.legs.len * 0.72 + Math.sin(this.gait * 2) * 0.06 * g.legs.len * speedK;
      let lift = 0, offF = 0, offR = 0, squash = 1;
      if (A.melee > 0) offF += Math.sin((A.melee / 0.25) * Math.PI) * 0.45;
      if (A.cast > 0) offF -= Math.sin((A.cast / 0.35) * Math.PI) * 0.18;
      if (A.hurt > 0) {
        const k = A.hurt / 0.25;
        squash = 1 - 0.28 * k;
        const hx = A.hurtX, hy = A.hurtY;
        offF += (hx * F.x + hy * F.y) * 0.35 * k;
        offR += (hx * R.x + hy * R.y) * 0.35 * k;
      }
      if (A.victory > 0) lift += Math.abs(Math.sin(this.t * 9)) * 0.6;
      let roll = 0;
      if (A.dodge > 0) {
        const p = 1 - A.dodge / A.dodgeDur;
        if (A.dodgeKind === 'rolamento') { roll = p * Math.PI * 2; squash *= 0.75; }
        else if (A.dodgeKind === 'voo') lift += Math.sin(p * Math.PI) * 1.4;
      }
      const chestF = Math.cos(a) * L / 2 + offF;
      const chestU = (hipH + L * Math.sin(a)) * (0.75 + 0.25 * squash) + lift;
      const cr = Math.cos(roll), sr = Math.sin(roll);
      const centerU = hipH * 0.9 + lift;
      const slither = g.archetype === 'serpent';
      for (let i = 0; i < n; i++) {
        let f = chestF - Math.cos(a) * i * seg;
        let u = chestU - Math.sin(a) * i * seg;
        let r = offR;
        if (slither) {
          const amp = 0.45 * Math.min(1, i / 2) * (0.25 + speedK);
          r += Math.sin(this.gait * 1.4 - i * 0.9) * amp;
          if (i === 0) u += 0.45;
        }
        if (roll) { // spin around the right axis through the body centre
          const df = f - offF, du = u - centerU;
          f = offF + df * cr - du * sr; u = centerU + df * sr + du * cr;
        }
        const target = W(f, r, u);
        const p = this.spine[i];
        if (!this.init) set(p, target.x, target.y, target.z);
        else {
          const rate = Math.max(8, 32 - i * 5);
          const k = 1 - Math.exp(-rate * dt);
          p.x += (target.x - p.x) * k; p.y += (target.y - p.y) * k; p.z += (target.z - p.z) * k;
        }
      }
      for (let i = 1; i < n; i++) { // follow the leader: keep segment lengths
        const p = this.spine[i], q = this.spine[i - 1];
        const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d = Math.hypot(dx, dy, dz) || 1;
        set(p, q.x + (dx / d) * seg, q.y + (dy / d) * seg, q.z + (dz / d) * seg);
      }

      // ---- head ----
      const chest = this.spine[0], r0 = g.spine.radii[0], hr = g.head.r;
      const up = XS.smooth(clamp((g.posture - 0.3) / 0.4, 0, 1));
      const hf = lerp(r0 * 0.75 + hr * 0.55 + g.head.neck * 0.6, r0 * 0.3, up);
      const hu = lerp(g.head.neck * 0.8 + r0 * 0.25, r0 * 0.8 + hr * 0.75 + g.head.neck * 0.35, up) + (slither ? 0.5 : 0);
      const ly = this.look * 0.5;
      const hfx = Math.cos(this.facing + ly), hfy = Math.sin(this.facing + ly);
      const headTarget = hr > 0
        ? { x: chest.x + hfx * hf, y: chest.y + hfy * hf, z: chest.z + hu * squash }
        : { x: chest.x, y: chest.y, z: chest.z };
      if (!this.init) set(this.headP, headTarget.x, headTarget.y, headTarget.z);
      else {
        const k = 1 - Math.exp(-26 * dt);
        this.headP.x += (headTarget.x - this.headP.x) * k; this.headP.y += (headTarget.y - this.headP.y) * k; this.headP.z += (headTarget.z - this.headP.z) * k;
      }
      this.HF = { x: Math.cos(this.facing + this.look * 0.9), y: Math.sin(this.facing + this.look * 0.9), z: 0 };

      // ---- legs ----
      const groundZ = this.pos.z;
      const stepDur = clamp(0.3 - speedK * 0.12, 0.13, 0.3);
      for (const leg of this.legs) {
        const sp = this.spine[leg.seg], rr = g.spine.radii[leg.seg];
        const hip = add3(add3(sp, R, leg.side * rr * 0.62), F, leg.along * rr);
        hip.z -= rr * 0.25;
        leg.hip = hip;
        const rest = add3(add3(hip, R, leg.side * leg.splay), F, leg.along * leg.splay * 0.9);
        rest.z = groundZ;
        const pred = { x: rest.x + this.vel.x * stepDur * 0.9, y: rest.y + this.vel.y * stepDur * 0.9, z: groundZ };
        const reach = leg.a + leg.b;
        if (!this.init || this.airborne || A.dodge > 0) {
          const dangle = add3(hip, F, 0.25);
          dangle.z = Math.max(groundZ, hip.z - reach * 0.78);
          if (!this.init || this.airborne || A.dodgeKind !== 'rolamento') set(leg.foot, dangle.x, dangle.y, this.airborne ? dangle.z : groundZ);
          if (A.dodge > 0 && A.dodgeKind === 'rolamento') set(leg.foot, lerp(hip.x, rest.x, 0.3), lerp(hip.y, rest.y, 0.3), hip.z - rr * 0.6);
          leg.stepping = false;
        } else if (leg.stepping) {
          leg.t += dt / stepDur;
          const k = XS.smooth(Math.min(1, leg.t));
          leg.foot.x = lerp(leg.from.x, leg.to.x, k);
          leg.foot.y = lerp(leg.from.y, leg.to.y, k);
          leg.foot.z = groundZ + Math.sin(Math.min(1, leg.t) * Math.PI) * g.legs.len * 0.28;
          if (leg.t >= 1) { leg.stepping = false; leg.foot.z = groundZ; }
        } else {
          leg.foot.z = groundZ;
          const d = Math.hypot(leg.foot.x - pred.x, leg.foot.y - pred.y);
          const idle = this.speed < 0.3;
          const thresh = idle ? g.legs.len * 0.2 : g.legs.len * (0.32 + 0.1 * (leg.group ? 0.5 : 0));
          if (d > reach * 1.3) set(leg.foot, pred.x, pred.y, groundZ); // teleported or shoved
          else if (d > thresh && !this.legs.some((o) => o.stepping && o.group !== leg.group && o.t < 0.7)) {
            leg.stepping = true; leg.t = 0;
            leg.from = { x: leg.foot.x, y: leg.foot.y, z: groundZ };
            leg.to = pred;
          }
        }
        const pole = g.legs.knee === 'up' ? add3(UP, R, leg.side * 0.9) : g.legs.knee === 'back' ? { x: -F.x, y: -F.y, z: 0.3 } : { x: F.x, y: F.y, z: 0.25 };
        leg.knee = ik2(hip, leg.foot, leg.a, leg.b, pole);
      }

      // ---- arms ----
      const armLen = g.arms.len, ua = armLen * 0.5, la = armLen * 0.55;
      for (const arm of this.arms) {
        const sh = add3(add3(chest, R, arm.side * r0 * 0.82), F, r0 * 0.1);
        sh.z += r0 * (0.15 - arm.row * 0.35) * squash;
        arm.sh = sh;
        const aimX = Math.cos(this.aimAngle), aimY = Math.sin(this.aimAngle);
        let target;
        if (A.cast > 0 && (arm.side === A.castSide || g.arms.pairs > 1 || A.cast > 0.2)) {
          target = { x: sh.x + aimX * armLen * 0.95, y: sh.y + aimY * armLen * 0.95, z: sh.z + 0.25 };
        } else if (A.melee > 0 && arm.side === A.meleeSide) {
          const p = 1 - A.melee / 0.25;
          const ang = this.aimAngle + arm.side * lerp(1.1, -1.1, p);
          target = { x: sh.x + Math.cos(ang) * armLen * 0.95, y: sh.y + Math.sin(ang) * armLen * 0.95, z: sh.z - 0.1 };
        } else if (A.victory > 0) {
          target = { x: sh.x + R.x * arm.side * 0.3, y: sh.y + R.y * arm.side * 0.3, z: sh.z + armLen * 0.9 + Math.sin(this.t * 12 + arm.side) * 0.2 };
        } else {
          const swing = Math.sin(this.gait + (arm.side > 0 ? Math.PI : 0)) * 0.35 * armLen * Math.min(1, speedK);
          const sway = Math.sin(this.t * 1.7 + arm.side) * 0.05;
          target = add3(add3(sh, F, armLen * 0.28 + swing), R, arm.side * (0.2 + sway));
          target.z = sh.z - armLen * 0.7;
        }
        const k = 1 - Math.exp(-22 * dt);
        if (!this.init) set(arm.hand, target.x, target.y, target.z);
        else { arm.hand.x += (target.x - arm.hand.x) * k; arm.hand.y += (target.y - arm.hand.y) * k; arm.hand.z += (target.z - arm.hand.z) * k; }
        const pole = { x: -F.x * 0.6 + R.x * arm.side * 0.5, y: -F.y * 0.6 + R.y * arm.side * 0.5, z: -0.6 };
        arm.elbow = ik2(sh, arm.hand, ua, la, pole);
      }

      // ---- tail (verlet chain pulled toward a curled rest shape) ----
      if (this.tail) {
        const T = g.tail, last = this.spine[n - 1], rl = g.spine.radii[n - 1];
        const backF = -Math.cos(a), backU = -Math.sin(a);
        const base = { x: last.x + F.x * backF * rl * 0.7, y: last.y + F.y * backF * rl * 0.7, z: last.z + backU * rl * 0.7 + rl * 0.15 };
        const p0 = this.tail[0];
        set(p0, base.x, base.y, base.z); p0.px = base.x; p0.py = base.y; p0.pz = base.z;
        for (let k = 1; k < this.tail.length; k++) {
          const p = this.tail[k];
          const ck = T.curl * 0.7 * (k / T.segs) + 0.15;
          const sway = Math.sin(this.t * 2.2 + k * 0.7) * 0.12 * k * T.segLen + this.look * -0.3 * k * T.segLen;
          const tgt = {
            x: base.x - F.x * Math.cos(ck) * T.segLen * k + R.x * sway,
            y: base.y - F.y * Math.cos(ck) * T.segLen * k + R.y * sway,
            z: base.z + Math.sin(ck) * T.segLen * k,
          };
          if (!this.init) { set(p, tgt.x, tgt.y, tgt.z); p.px = tgt.x; p.py = tgt.y; p.pz = tgt.z; continue; }
          const vx = (p.x - p.px) * 0.84, vy = (p.y - p.py) * 0.84, vz = (p.z - p.pz) * 0.84;
          p.px = p.x; p.py = p.y; p.pz = p.z;
          p.x += vx; p.y += vy; p.z += vz - 6 * dt * dt;
          const kk = 1 - Math.exp(-10 * dt);
          p.x += (tgt.x - p.x) * kk; p.y += (tgt.y - p.y) * kk; p.z += (tgt.z - p.z) * kk;
        }
        for (let it = 0; it < 2; it++) {
          for (let k = 1; k < this.tail.length; k++) {
            const p = this.tail[k], q = this.tail[k - 1];
            const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d = Math.hypot(dx, dy, dz) || 1;
            p.x = q.x + (dx / d) * T.segLen; p.y = q.y + (dy / d) * T.segLen; p.z = q.z + (dz / d) * T.segLen;
          }
        }
      }

      // ---- tentacles ----
      if (this.tents) {
        const T = g.tentacles, segL = T.len / 4;
        for (let i = 0; i < this.tents.length; i++) {
          const ang = (i / this.tents.length) * Math.PI * 2 + 0.4;
          const ox = Math.cos(ang), oy = Math.sin(ang);
          const base = add3(add3(chest, F, ox * r0 * 0.6), R, oy * r0 * 0.6);
          base.z -= r0 * 0.55;
          const chain = this.tents[i];
          for (let k = 0; k < chain.length; k++) {
            const w = Math.sin(this.t * 3 + k * 0.8 + i * 1.3) * 0.1 * k, w2 = Math.cos(this.t * 2.3 + k * 0.6 + i) * 0.08 * k;
            const tgt = {
              x: base.x + (F.x * ox + R.x * oy) * k * 0.07 + R.x * w + F.x * w2 - this.vel.x * 0.05 * k,
              y: base.y + (F.y * ox + R.y * oy) * k * 0.07 + R.y * w + F.y * w2 - this.vel.y * 0.05 * k,
              z: base.z - segL * k,
            };
            const p = chain[k];
            if (!this.init || k === 0) set(p, tgt.x, tgt.y, tgt.z);
            else { const kk = 1 - Math.exp(-(16 - k * 2) * dt); p.x += (tgt.x - p.x) * kk; p.y += (tgt.y - p.y) * kk; p.z += (tgt.z - p.z) * kk; }
          }
        }
      }
      this.init = true;
      this.buildPrims();
    }

    // ------------------------------------------------------ primitive list
    _p() {
      let p = this.prims[this.primCount];
      if (!p) { p = {}; this.prims[this.primCount] = p; }
      this.primCount++;
      p.k = 0; p.ramp = null; p.col = null; p.alpha = 1; p.bias = 0; p.pts = null; p.style = null;
      return p;
    }
    ball(c, r, ramp, bias = 0) { const p = this._p(); p.k = 0; p.x = c.x; p.y = c.y; p.z = c.z; p.r = r; p.ramp = ramp; p.bias = bias; return p; }
    limb(a, b, r, ramp, bias = 0) {
      const p = this._p(); p.k = 1;
      p.x = (a.x + b.x) / 2; p.y = (a.y + b.y) / 2; p.z = (a.z + b.z) / 2;
      p.x1 = a.x; p.y1 = a.y; p.z1 = a.z; p.x2 = b.x; p.y2 = b.y; p.z2 = b.z;
      p.r = r; p.ramp = ramp; p.bias = bias;
      return p;
    }

    buildPrims() {
      this.primCount = 0;
      const g = this.g, Rm = this.ramps, F = this.F, R = this.R;
      const n = g.spine.n;
      // Body segments (stripes alternate ramps).
      for (let i = 0; i < n; i++) {
        const ramp = g.pattern === 'stripes' && i % 2 === 1 ? Rm.accent : Rm.body;
        this.ball(this.spine[i], g.spine.radii[i], ramp);
        if (g.archetype === 'blob') {
          const lower = { x: this.spine[i].x, y: this.spine[i].y, z: this.spine[i].z - g.spine.radii[i] * 0.4 };
          this.ball(lower, g.spine.radii[i] * 0.95, Rm.belly, -0.2);
        }
      }
      for (const d of this.decor) {
        const sp = this.spine[d.seg], r = g.spine.radii[d.seg];
        const pos = { x: sp.x + (F.x * d.f + R.x * d.r) * r, y: sp.y + (F.y * d.f + R.y * d.r) * r, z: sp.z + d.u * r };
        const ramp = g.pattern === 'glowspots' ? Rm.glow : g.pattern === 'plates' ? Rm.horn : Rm.accent;
        this.ball(pos, r * d.size, ramp, r * 0.9).decor = true;
      }
      // Tail.
      if (this.tail) {
        const T = g.tail;
        for (let k = 1; k < this.tail.length; k++) {
          const t = k / T.segs;
          this.limb(this.tail[k - 1], this.tail[k], T.r * (1 - t * 0.6), Rm.body);
        }
        const tip = this.tail[this.tail.length - 1];
        if (T.tip === 'club') this.ball(tip, T.r * 1.5, Rm.horn);
        else if (T.tip === 'spike' || T.tip === 'stinger') {
          const prev = this.tail[this.tail.length - 2];
          const dir = { x: tip.x - prev.x, y: tip.y - prev.y, z: tip.z - prev.z }, dl = len3(dir) || 1;
          this.limb(tip, add3(tip, dir, 0.7 / dl), T.r * 0.5, Rm.horn);
        } else if (T.tip === 'fan') {
          for (const s of [-1, 0, 1]) this.ball(add3(add3(tip, R, s * 0.35), UP, Math.abs(s) * -0.1 + 0.15), T.r * 0.8, Rm.accent);
        } else if (T.tip === 'flame') this.ball(tip, T.r * 1.1, Rm.glow).glow = true;
      }
      // Tentacles.
      if (this.tents) {
        for (const chain of this.tents) {
          for (let k = 1; k < chain.length; k++) this.limb(chain[k - 1], chain[k], g.tentacles.r * (1 - k * 0.15), k % 2 ? Rm.body : Rm.belly);
        }
      }
      // Legs.
      for (const leg of this.legs) {
        const th = g.legs.thick;
        this.limb(leg.hip, leg.knee, th, Rm.limb);
        this.limb(leg.knee, leg.foot, th * 0.8, Rm.limb);
        if (g.legs.foot === 'pad') this.ball(leg.foot, th * 1.3, Rm.belly);
        else if (g.legs.foot === 'hoof') this.ball(leg.foot, th * 1.1, Rm.horn);
        else if (g.legs.foot === 'claw') this.limb(leg.foot, add3(leg.foot, F, 0.35), th * 0.5, Rm.horn);
      }
      // Arms.
      for (const arm of this.arms) {
        const th = g.arms.thick;
        this.limb(arm.sh, arm.elbow, th, Rm.limb);
        this.limb(arm.elbow, arm.hand, th * 0.85, Rm.limb);
        const h = arm.hand, hand = g.arms.hand;
        if (hand === 'mitt') this.ball(h, th * 1.6, Rm.belly);
        else if (hand === 'three') this.ball(h, th * 1.25, Rm.belly);
        else if (hand === 'claw') {
          for (const s of [-1, 1]) this.limb(h, add3(add3(h, F, 0.35), R, s * 0.18), th * 0.45, Rm.horn);
        } else if (hand === 'blade') {
          const dx = h.x - arm.elbow.x, dy = h.y - arm.elbow.y, dz = h.z - arm.elbow.z, dl = Math.hypot(dx, dy, dz) || 1;
          this.limb(h, { x: h.x + (dx / dl) * 0.9, y: h.y + (dy / dl) * 0.9, z: h.z + (dz / dl) * 0.9 + 0.15 }, th * 0.45, Rm.horn);
        } else if (hand === 'tentacle') {
          const dx = h.x - arm.elbow.x, dy = h.y - arm.elbow.y, dl = Math.hypot(dx, dy) || 1;
          const w = Math.sin(this.t * 5 + arm.side) * 0.3;
          this.limb(h, { x: h.x + (dx / dl) * 0.5 + R.x * w, y: h.y + (dy / dl) * 0.5 + R.y * w, z: h.z - 0.3 }, th * 0.55, Rm.limb);
        }
      }
      // Wings.
      if (g.wings) {
        const chest = this.spine[0], r0 = g.spine.radii[0], span = g.wings.span;
        const rate = this.airborne || this.act.dodge > 0 ? 15 : this.speed > 0.5 ? 7 : 2.2;
        const amp = this.airborne || this.act.dodge > 0 ? 0.9 : this.speed > 0.5 ? 0.5 : 0.16;
        for (const side of [-1, 1]) {
          const ang = 0.4 + Math.sin(this.t * rate + (side > 0 ? 0 : 0.2)) * amp;
          const sh = add3(add3(add3(chest, UP, r0 * 0.55), R, side * r0 * 0.35), F, -r0 * 0.2);
          const out = { x: R.x * side * Math.cos(ang), y: R.y * side * Math.cos(ang), z: Math.sin(ang) };
          const tip = add3(add3(sh, out, span), F, -span * 0.2);
          const back = add3(add3(sh, out, span * 0.62), F, -span * 0.75);
          const type = g.wings.type;
          const col = type === 'insect' ? '#e6fbff' : type === 'energy' ? (g.palette.glow || g.palette.accent[3]) : type === 'feather' ? g.palette.body[2] : g.palette.accent[1];
          const p = this._p();
          p.k = 3; p.pts = [sh, tip, back]; p.col = col; p.alpha = type === 'insect' ? 0.5 : type === 'energy' ? 0.6 : 1;
          p.edge = type === 'feather' ? g.palette.body[0] : g.palette.accent[0];
          p.x = (sh.x + tip.x + back.x) / 3; p.y = (sh.y + tip.y + back.y) / 3; p.z = (sh.z + tip.z + back.z) / 3;
          p.bias = -0.3;
          this.limb(sh, tip, 0.12, Rm.horn, -0.25);
        }
      }
      // Head, eyes, mouth, crown.
      const H = this.headP, hr = g.head.r > 0 ? g.head.r : g.spine.radii[0];
      const HF = this.HF;
      if (g.head.r > 0) {
        const neckFrom = this.spine[0];
        if (Math.hypot(H.x - neckFrom.x, H.y - neckFrom.y, H.z - neckFrom.z) > g.spine.radii[0] * 0.8) this.limb(neckFrom, H, hr * 0.45, Rm.body);
        this.ball(H, hr, Rm.body);
      }
      const hrx = Math.cos(this.facing + this.look * 0.9 - Math.PI / 2), hry = Math.sin(this.facing + this.look * 0.9 - Math.PI / 2);
      const HR = { x: hrx, y: hry, z: 0 };
      // Crown.
      const crown = g.head.crown, cl = g.head.crownLen;
      const top = add3(H, UP, hr * 0.8);
      if (crown === 'horns') {
        for (const s of [-1, 1]) {
          const b = add3(top, HR, s * hr * 0.55);
          const m = add3(add3(b, UP, cl * 0.55), HR, s * cl * 0.3);
          const tip = add3(add3(m, UP, cl * 0.35), HF, -cl * 0.35);
          this.limb(b, m, hr * 0.22, Rm.horn); this.limb(m, tip, hr * 0.14, Rm.horn);
        }
      } else if (crown === 'antennae') {
        for (const s of [-1, 1]) {
          const b = add3(top, HR, s * hr * 0.35);
          const tip = add3(add3(add3(b, UP, cl * 1.1), HF, cl * 0.35 + Math.sin(this.t * 4 + s) * 0.12), HR, s * cl * 0.3);
          this.limb(b, tip, 0.07, Rm.limb);
          this.ball(tip, 0.16, Rm.glow).glow = !!g.palette.glow;
        }
      } else if (crown === 'crest') {
        for (let k = 0; k < 3; k++) this.ball(add3(add3(top, HF, -k * hr * 0.45), UP, -k * 0.1), hr * (0.4 - k * 0.08), Rm.accent, -0.05);
      } else if (crown === 'unicorn') {
        const b = add3(add3(H, HF, hr * 0.6), UP, hr * 0.5);
        this.limb(b, add3(add3(b, HF, cl * 0.6), UP, cl * 0.6), hr * 0.18, Rm.horn);
      } else if (crown === 'frills') {
        for (const s of [-1, 1]) this.ball(add3(add3(H, HR, s * hr * 0.95), HF, -hr * 0.3), hr * 0.55, Rm.accent, -0.2);
      }
      // Eyes.
      const ne = g.head.eyes;
      const layout = ne === 1 ? [[0, 0.25]] : ne === 2 ? [[-1, 0.25], [1, 0.25]] : ne === 3 ? [[-1, 0.2], [1, 0.2], [0, 0.6]]
        : ne === 4 ? [[-1, 0.15], [1, 0.15], [-0.6, 0.55], [0.6, 0.55]] : [[-1, 0.1], [0, 0.15], [1, 0.1], [-0.7, 0.5], [0, 0.6], [0.7, 0.5]];
      const eyeR = Math.max(0.16, hr * g.head.eyeSize * (ne > 3 ? 0.75 : 1));
      for (const [ex, ey] of layout) {
        const yaw = ex * g.head.eyeSpread * 0.9;
        const dx = HF.x * Math.cos(yaw) + HR.x * Math.sin(yaw), dy = HF.y * Math.cos(yaw) + HR.y * Math.sin(yaw);
        const ce = Math.cos(ey), se = Math.sin(ey);
        const pos = { x: H.x + dx * ce * hr * 0.86, y: H.y + dy * ce * hr * 0.86, z: H.z + se * hr * 0.86 };
        const p = this._p();
        p.k = 2; p.x = pos.x; p.y = pos.y; p.z = pos.z; p.r = eyeR; p.bias = hr * 0.05;
        p.style = g.head.eyeStyle; p.col = g.head.eyeStyle === 'glow' ? (g.palette.glow || g.palette.eye) : g.palette.eye;
        p.lookX = Math.cos(this.aimAngle); p.lookY = Math.sin(this.aimAngle);
        p.closed = this.blinkT > 0 || this.act.hurt > 0.15;
      }
      // Mouth.
      const mouth = g.head.mouth, mo = this.mouthOpen;
      const mp = add3(add3(H, HF, hr * 0.88), UP, -hr * 0.3);
      if (mouth === 'beak') {
        this.limb(mp, add3(add3(mp, HF, hr * 0.6), UP, -0.05 - mo * 0.2), hr * 0.22, Rm.horn, hr * 0.1);
      } else if (mouth === 'mandibles') {
        for (const s of [-1, 1]) this.limb(add3(mp, HR, s * hr * 0.3), add3(add3(mp, HF, hr * 0.45), HR, s * hr * (0.15 + mo * 0.25)), hr * 0.12, Rm.horn, hr * 0.1);
      } else if (mouth === 'trunk') {
        const a1 = add3(add3(mp, HF, hr * 0.4), UP, -hr * 0.25);
        const a2 = add3(add3(a1, HF, hr * 0.3 + mo * 0.3), UP, -hr * 0.45 + Math.sin(this.t * 3) * 0.1);
        this.limb(mp, a1, hr * 0.2, Rm.body, hr * 0.1); this.limb(a1, a2, hr * 0.15, Rm.body, hr * 0.1);
      } else if (mouth === 'fangs' || mouth === 'smile') {
        const p = this._p();
        p.k = 4; p.x = mp.x; p.y = mp.y; p.z = mp.z; p.r = hr * 0.35; p.bias = hr * 0.2;
        p.style = mouth; p.col = '#1a0c14'; p.open = mo;
      }
    }

    // Kick off actions (called by combat).
    cast(side) { this.act.cast = 0.35; this.act.castSide = side || (this.act.castSide * -1); this.mouthOpen = 1; }
    melee() { this.act.melee = 0.25; this.act.meleeSide *= -1; this.mouthOpen = 1; }
    hurt(dx, dy) { this.act.hurt = 0.25; const l = Math.hypot(dx, dy) || 1; this.act.hurtX = dx / l; this.act.hurtY = dy / l; this.flash = 0.09; }
    dodge(kind, dur) { this.act.dodge = dur; this.act.dodgeDur = dur; this.act.dodgeKind = kind; }
    victory() { this.act.victory = 999; }
  }

  XS.Rig = Rig;
  XS.ik2 = ik2;
})(globalThis.XS = globalThis.XS || {});
