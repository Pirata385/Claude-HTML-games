// creature.js — the ragdoll ("rag") built from a phenotype: a physical body driven by a gait and by
// action motors. Legs are spring-loaded struts between the torso and pinned feet (knees are drawn
// by IK), the neck is a particle chain, and a balance spring keeps the torso pitched. No DOM.
//
// States: stand (feet step to keep under the body), air (hop, fall), down (knocked over, limp),
// rise (getting up), ko. Actions: peck, kick, shove, punch, duck.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { clamp, lerp, smooth, wrapAngle } = RB.core;

  class Rag {
    constructor(world, P, x, groundY, f) {
      this.world = world; this.P = P; this.f = f;
      const M = (this.M = P.massRel);
      const cs = Math.cos(P.pitch), sn = Math.sin(P.pitch);
      const ts = RB.pose.attachTs(P), t0 = ts[0], stand = RB.pose.standHeight(P);
      const ay = groundY - stand;
      const hx = x - f * t0 * P.TL * cs, hy = ay + t0 * P.TL * sn;
      const cx = x + f * (1 - t0) * P.TL * cs, cy = ay - (1 - t0) * P.TL * sn;
      this.parts = [];
      const mk = (px, py, m, r) => { const p = world.particle(px, py, m, r); this.parts.push(p); return p; };
      this.sticks = [];
      const st = (a, b, len, k, max) => { const s = world.stick(a, b, len, k, max); this.sticks.push(s); return s; };
      this.H = mk(hx, hy, 0.42 * M, P.TD / 2); this.C = mk(cx, cy, 0.42 * M, P.TD / 2);
      this.H.fr = 0; this.C.fr = 0;
      st(this.H, this.C, P.TL, 1);
      // neck and head
      const area = P.TL * P.TD, k = P.neckK, segLen = P.NL / k;
      const mNeck = Math.max(0.012 * M, 0.5 * M * (P.NL * P.NT) / area), mHead = Math.max(0.02 * M, 0.6 * M * (3.14 * P.HR * P.HR) / area);
      this.neck = [];
      let px = cx, py = cy, prev = this.C;
      for (let i = 0; i < k; i++) {
        px += f * segLen * Math.cos(P.neckAng[i]); py -= segLen * Math.sin(P.neckAng[i]);
        const last = i === k - 1;
        const p = mk(px, py, last ? mHead + mNeck / k : mNeck / k, last ? P.HR : P.NT / 2);
        st(prev, p, segLen, 1);
        this.neck.push(p); prev = p;
      }
      this.head = prev;
      this.neckK0 = clamp(0.045 * P.t.neckThick * P.muscle, 0.02, 0.09);
      this.neckK = this.neckK0; this.neckBend = 0;
      // tail
      this.T = null;
      if (P.tailL > 0.5) {
        const ta = Math.PI - P.pitch + P.tailAng, len = P.tailL * 0.55;
        this.tailLen = len;
        this.T = mk(hx + f * Math.cos(ta) * len, hy + Math.sin(ta) * len, 0.012 * M, 1);
        st(this.H, this.T, len, 1);
      }
      // legs: feet are kinematic (im = 0) while planted, swinging or hanging
      this.legs = [];
      for (let p = 0; p < ts.length; p++) {
        for (let side = 0; side < 2; side++) {
          const neutral = (side ? -1 : 1) * 0.1 * P.LLv;
          const lax = hx + f * ts[p] * P.TL * cs;
          const foot = mk(lax + neutral * f, groundY, 0.03 * M, Math.max(0.8, P.LT * 0.6));
          foot.im = 0; foot.fr = 0.5;
          this.legs.push({ t: ts[p], pair: p, side, foot, planted: true, sw: null, neutral, group: (p + side) % 2, kick: false, lift: 0, slid: false, from: null });
        }
      }
      // hands (if any) are kinematic and follow a pose
      this.hands = [];
      if (P.armL > 0) {
        for (let side = 0; side < 2; side++) {
          const h = mk(cx, cy, 0.02 * M, Math.max(1, P.LT * 0.9)); h.im = 0;
          this.hands.push({ p: h, side, punch: false });
        }
      }
      this.accel = 1500 * P.traction * Math.sqrt(P.muscle);
      this.vxDes = 0; this.crouch = 1; this.crouchT = 1; this.lean = 0; this.leanT = 0; this.restMul = 1;
      this.state = 'stand'; this.stateT = 0; this.kBal = 1; this.downDur = 0; this.dead = false;
      this.wing = 0; this.wingV = 0;
      this.headAng = f > 0 ? 0.1 : Math.PI - 0.1; this.headAngT = null;
      this.act = null; this.weapon = null; this.weaponLeg = null; this.eye = ''; this.beakOpen = 0; this.guard = 0;
      this.planted = this.legs.length; this.swinging = 0; this.groundT = 0; this.landed = false; this.fists = false;
      this.placeHands(1);
      world.solvers.push(this);
    }

    ax(leg) { return this.H.x + (this.C.x - this.H.x) * leg.t; }
    ay(leg) { return this.H.y + (this.C.y - this.H.y) * leg.t; }
    midX() { return (this.H.x + this.C.x) / 2; }
    midY() { return (this.H.y + this.C.y) / 2; }
    vx() { return (this.H.vx + this.C.vx) / 2; }
    vy() { return (this.H.vy + this.C.vy) / 2; }
    pitchErr() {
      const ang = Math.atan2(this.C.y - this.H.y, this.C.x - this.H.x), pt = this.P.pitch + this.lean;
      return wrapAngle(ang - (this.f > 0 ? -pt : Math.PI + pt));
    }
    setState(s) { this.state = s; this.stateT = 0; }
    beakTip() { const r = this.P.HR + this.P.BL; return { x: this.head.x + Math.cos(this.headAng) * r, y: this.head.y + Math.sin(this.headAng) * r }; }

    control(dt) {
      const P = this.P, H = this.H, C = this.C;
      this.stateT += dt; this.landed = false;
      this.wingV += (-this.wing * 90 - this.wingV * 11) * dt;
      this.wing = Math.max(0, this.wing + this.wingV * dt);
      this.crouch += (this.crouchT - this.crouch) * Math.min(1, dt * 22);
      this.lean += (this.leanT - this.lean) * Math.min(1, dt * 16);
      const st = this.state;
      if (st === 'stand') {
        const vx = this.vx();
        this.gait(dt, vx);
        if (this.planted > 0) {
          const dv = clamp(this.vxDes - vx, -this.accel * dt, this.accel * dt);
          H.vx += dv; C.vx += dv;
        } else if (this.swinging === 0) this.setState('air');
      } else if (st === 'air') this.airborne(dt);
      else if (st === 'down') { if (this.stateT > this.downDur && !this.dead) this.startRise(); }
      else if (st === 'rise') this.rising();
      if (this.act) this.updateAct(dt);
      this.placeHands(Math.min(1, dt * 18));
      // head direction
      let target = this.headAngT;
      if (st === 'down' || st === 'ko') {
        const n = this.neck.length, a = n > 1 ? this.neck[n - 2] : C;
        target = Math.atan2(this.head.y - a.y, this.head.x - a.x);
      } else if (target === null) target = this.f > 0 ? 0.1 : Math.PI - 0.1;
      this.headAng += wrapAngle(target - this.headAng) * Math.min(1, dt * 22);
      void P;
    }

    canSwing(leg) { for (const o of this.legs) if (o !== leg && o.sw && o.group !== leg.group) return false; return true; }

    gait(dt, vx) {
      const P = this.P, w = this.world, LL = P.LL, f = this.f;
      const sp = Math.abs(vx), moving = Math.abs(this.vxDes) > 4 || sp > 14;
      const dir = sp > 6 ? Math.sign(vx) : Math.sign(this.vxDes) || f;
      const frac = Math.min(1, sp / Math.max(1, P.speedMax));
      const Tsw = P.swingMin * (1.9 - 0.9 * frac);
      const LLv = P.LLv, hs = clamp(sp * Tsw * 0.95, Math.min(0.1 * LLv, P.hsMax), P.hsMax);
      let planted = 0, swinging = 0;
      for (const leg of this.legs) {
        if (!leg.sw) continue;
        const sw = leg.sw, F = leg.foot, ax = this.ax(leg), ay = this.ay(leg);
        sw.t += dt / sw.dur;
        const s = Math.min(1, sw.t), e = smooth(s);
        const tx = ax + vx * sw.dur * (1 - s) * 0.5 + (moving ? dir * hs : leg.neutral * f);
        sw.x1 += (tx - sw.x1) * 0.35;
        const nx = lerp(sw.x0, sw.x1, e), surf = w.surfaceAt(nx, ay - 1);
        const ny = lerp(sw.y0, surf === null ? sw.y0 : surf, e) - Math.sin(s * Math.PI) * LLv * (0.1 + 0.18 * frac);
        F.vx = (nx - F.x) / dt; F.vy = (ny - F.y) / dt; F.x = nx; F.y = ny;
        leg.lift = Math.sin(s * Math.PI);
        if (sw.t >= 1) {
          leg.sw = null; leg.lift = 0; F.vx = 0; F.vy = 0;
          if (surf !== null && surf - ay <= LL * 1.02) { F.y = surf; leg.planted = true; } else leg.planted = false;
        } else swinging++;
      }
      for (const leg of this.legs) {
        if (leg.sw || leg.kick) { if (leg.kick) swinging++; continue; }
        const F = leg.foot, ax = this.ax(leg), ay = this.ay(leg);
        if (leg.planted) {
          planted++;
          F.vx = 0; F.vy = 0;
          const off = F.x - ax - (moving ? 0 : leg.neutral * f);
          let need = moving ? off * dir < -hs : Math.abs(off) > 0.24 * LLv;
          if (Math.hypot(F.x - ax, F.y - ay) > 0.985 * LL || leg.slid) need = true;
          leg.slid = false;
          if (need && this.canSwing(leg)) {
            leg.sw = { t: 0, dur: Tsw, x0: F.x, y0: F.y, x1: ax + vx * Tsw * 0.5 + (moving ? dir * hs : leg.neutral * f) };
            leg.planted = false; planted--; swinging++;
          }
        } else { // no footing: hang under the body until there is ground again
          const nx = lerp(F.x, ax, 0.25), surf = w.surfaceAt(nx, ay - 1);
          let ny = lerp(F.y, ay + 0.9 * P.rest, 0.25);
          if (surf !== null && surf <= ay + 0.98 * LL) { ny = surf; leg.planted = true; planted++; }
          F.vx = (nx - F.x) / dt; F.vy = (ny - F.y) / dt; F.x = nx; F.y = ny;
          leg.lift = leg.planted ? 0 : 1;
        }
      }
      this.planted = planted; this.swinging = swinging;
    }

    airborne(dt) {
      const P = this.P, w = this.world, vy = this.vy();
      let landed = 0;
      for (const leg of this.legs) {
        if (leg.kick) continue;
        const F = leg.foot, ax = this.ax(leg), ay = this.ay(leg);
        const nx = lerp(F.x, ax - this.f * 0.1 * P.LLv, 0.3);
        let ny = lerp(F.y, ay + P.rest * 0.92, 0.3);
        const surf = w.surfaceAt(nx, ay - 1);
        leg.planted = false; leg.sw = null;
        if (surf !== null && ny >= surf && vy > -40 && this.stateT > 0.06) { ny = surf; leg.planted = true; landed++; }
        F.vx = (nx - F.x) / dt; F.vy = (ny - F.y) / dt; F.x = nx; F.y = ny;
        leg.lift = leg.planted ? 0 : 1;
      }
      if (this.H.gnd || this.C.gnd) this.groundT += dt; else this.groundT = 0;
      if (landed > 0) {
        if (Math.abs(this.pitchErr()) > 1.1) this.knockdown(0.6);
        else { this.setState('stand'); this.crouch = 0.72; this.landed = true; this.planted = landed; this.swinging = 0; }
      } else if (this.groundT > 0.25) this.knockdown(0.5);
    }

    knockdown(dur) {
      if (this.state === 'ko') return;
      this.setState('down'); this.downDur = dur; this.kBal = 0; this.groundT = 0;
      this.act = null; this.weapon = null; this.guard = 0; this.crouchT = 1; this.leanT = 0; this.neckBend = 0; this.neckK = this.neckK0 * 0.25; this.headAngT = null;
      for (const leg of this.legs) { leg.planted = false; leg.sw = null; leg.kick = false; leg.lift = 1; leg.foot.im = 1 / leg.foot.m; }
      for (const h of this.hands) h.punch = false;
      this.H.fr = 0.35; this.C.fr = 0.35; this.planted = 0; this.swinging = 0;
    }
    ko() { this.knockdown(1e9); this.state = 'ko'; this.dead = true; this.eye = 'ko'; }

    startRise() {
      const surf = this.world.surfaceAt(this.midX(), Math.min(this.H.y, this.C.y) - this.P.TD);
      if (surf === null) { this.stateT = 0; this.downDur = 0.3; return; }
      this.setState('rise'); this.riseSurf = surf; this.restMul = 0.2;
      this.riseDur = 0.5 / Math.sqrt(this.P.reflex);
      for (const leg of this.legs) { const F = leg.foot; F.im = 0; F.vx = 0; F.vy = 0; leg.planted = true; leg.from = { x: F.x, y: F.y }; }
      this.planted = this.legs.length;
    }
    rising() {
      const u = Math.min(1, this.stateT / this.riseDur), e = smooth(Math.min(1, u * 3));
      for (const leg of this.legs) {
        const F = leg.foot;
        F.x = lerp(leg.from.x, this.ax(leg) + leg.neutral * this.f, e); F.y = lerp(leg.from.y, this.riseSurf, e);
        leg.lift = 1 - e;
      }
      this.restMul = lerp(0.2, 1, smooth(u)); this.kBal = smooth(u);
      if (u >= 1) { this.setState('stand'); this.kBal = 1; this.restMul = 1; this.H.fr = 0; this.C.fr = 0; this.neckK = this.neckK0; }
    }

    // ---- constraints, called on every solver iteration
    solve() {
      const st = this.state;
      if (st === 'stand' || st === 'rise') { for (const leg of this.legs) if (leg.planted) this.solveLeg(leg); }
      else for (const leg of this.legs) if (leg.foot.im > 0) this.solveLegLoose(leg);
      if (this.kBal > 0) this.solveBalance();
      this.solvePose();
    }
    moveAttach(t, cx, cy) {
      const H = this.H, C = this.C, wH = 1 - t, wC = t, den = wH * wH * H.im + wC * wC * C.im;
      if (den <= 0) return;
      const lx = cx / den, ly = cy / den;
      H.x += lx * wH * H.im; H.y += ly * wH * H.im; C.x += lx * wC * C.im; C.y += ly * wC * C.im;
    }
    // A planted leg is a suspension strut: it holds the attach point up at the strut's height above
    // the foot (vertical only, so walking never brakes against its own legs) and, as a hard limit,
    // it cannot stretch past its length. A foot holds only so much sideways pull before it slides.
    solveLeg(leg) {
      const P = this.P, F = leg.foot, ax = this.ax(leg), ay = this.ay(leg);
      const dx = ax - F.x, dy = ay - F.y, d = Math.hypot(dx, dy) || 1e-6, LL = P.LL;
      if (d > LL * 1.06) { leg.planted = false; return; } // yanked off its feet
      const rest = P.rest * this.crouch * this.restMul;
      const adx = Math.min(Math.abs(dx), rest * 0.6), top = F.y - Math.sqrt(rest * rest - adx * adx);
      if (ay > top) this.moveAttach(leg.t, 0, (top - ay) * 0.5);
      if (d > LL) {
        const c = LL - d;
        let cx = dx / d * c;
        const cy = dy / d * c, lim = P.traction * Math.abs(cy) + 0.02;
        if (Math.abs(cx) > lim) { const ex = cx - Math.sign(cx) * lim; F.x -= ex; cx -= ex; leg.slid = true; }
        this.moveAttach(leg.t, cx, cy);
      }
    }
    solveLegLoose(leg) {
      const F = leg.foot, t = leg.t, H = this.H, C = this.C, ax = this.ax(leg), ay = this.ay(leg);
      const dx = ax - F.x, dy = ay - F.y, d = Math.hypot(dx, dy) || 1e-6, LL = this.P.LL;
      if (d <= LL) return;
      const wH = 1 - t, wC = t, wA = wH * wH * H.im + wC * wC * C.im, w = wA + F.im;
      const l = (d - LL) / d / w;
      F.x += dx * l * F.im; F.y += dy * l * F.im;
      H.x -= dx * l * wH * H.im; H.y -= dy * l * wH * H.im; C.x -= dx * l * wC * C.im; C.y -= dy * l * wC * C.im;
    }
    solveBalance() {
      const H = this.H, C = this.C, rot = -this.pitchErr() * 0.35 * this.kBal;
      const mx = (H.x + C.x) / 2, my = (H.y + C.y) / 2, c = Math.cos(rot), s = Math.sin(rot);
      let dx = H.x - mx, dy = H.y - my;
      H.x = mx + dx * c - dy * s; H.y = my + dx * s + dy * c;
      dx = C.x - mx; dy = C.y - my;
      C.x = mx + dx * c - dy * s; C.y = my + dx * s + dy * c;
    }
    solvePose() {
      const P = this.P, f = this.f, C = this.C, H = this.H, k = this.neck.length, segLen = P.NL / k, kN = this.neckK;
      if (kN > 0) {
        // the neck pose follows half of the torso's tilt, so heads stay roughly level
        const tilt = -this.pitchErr() * f * 0.5 - this.lean * 0.6;
        let px = C.x, py = C.y;
        for (let i = 0; i < k; i++) {
          const a = P.neckAng[i] + tilt + this.neckBend * (i + 1) / k;
          px += f * segLen * Math.cos(a); py -= segLen * Math.sin(a);
          const p = this.neck[i];
          p.x += (px - p.x) * kN; p.y += (py - p.y) * kN;
        }
      }
      if (this.T) {
        const al = Math.atan2(C.y - H.y, f * (C.x - H.x)), ta = al + Math.PI + P.tailAng;
        const T = this.T, kT = this.state === 'down' || this.state === 'ko' ? 0.01 : 0.07;
        T.x += (H.x + f * Math.cos(ta) * this.tailLen - T.x) * kT; T.y += (H.y + Math.sin(ta) * this.tailLen - T.y) * kT;
      }
    }

    placeHands(k) {
      if (!this.hands.length) return;
      const P = this.P, f = this.f, H = this.H, C = this.C;
      const sx = H.x + (C.x - H.x) * 0.82, sy = H.y + (C.y - H.y) * 0.82;
      for (const h of this.hands) {
        h.sx = sx; h.sy = sy;
        if (h.punch) continue;
        let ox, oy;
        if (this.state === 'down' || this.state === 'ko') { ox = 0.5; oy = 0.6; }
        else if (this.fists) { ox = 0.55 - h.side * 0.2; oy = -0.15 + h.side * 0.2; }
        else if (P.person) { ox = 0.12; oy = 0.94; } else { ox = 0.55; oy = 0.5; }
        const p = h.p, nx = lerp(p.x, sx + f * P.armL * ox, k), ny = lerp(p.y, sy + P.armL * oy, k);
        p.vx = 0; p.vy = 0; p.x = nx; p.y = ny;
      }
    }

    // ---- actions
    hop(vx, vy) {
      this.H.vx = vx; this.C.vx = vx; this.H.vy = vy; this.C.vy = vy;
      for (const leg of this.legs) { leg.planted = false; leg.sw = null; }
      this.setState('air'); this.planted = 0; this.swinging = 0; this.groundT = 0;
    }
    flap(k) {
      this.wingV = 16;
      if (this.state === 'air') { const dv = this.P.flapV * (k === undefined ? 1 : k); this.H.vy -= dv; this.C.vy -= dv; return true; }
      return false;
    }
    startPeck(tgt, slow) {
      if (this.act || this.state !== 'stand') return false;
      const P = this.P;
      this.act = { type: 'peck', t: 0, phase: 0, tgt, hit: false, wind: 0.12 / P.reflex * (0.8 + 0.2 * P.t.neckLen) * (slow || 1), strike: 0.17, rec: 0.18 / P.reflex,
        v: 430 * Math.pow(P.muscle, 0.7) * Math.sqrt(P.reflex) * (0.75 + 0.25 * P.t.neckLen) };
      this.neckBend = 0.55; this.neckK = this.neckK0 * 2; this.beakOpen = 0.2;
      return true;
    }
    startKick(tgt, power) {
      if (this.act || this.state !== 'stand' || this.planted === 0) return false;
      const P = this.P;
      this.act = { type: 'kick', t: 0, phase: 0, tgt, hit: false, power: power || 0.85, crouch: 0.09 / P.reflex, leg: this.legs[(P.legPairs - 1) * 2],
        v: 520 * Math.pow(P.muscle, 0.7) * (0.6 + 0.4 * Math.min(2, P.t.legLen)) };
      this.crouchT = 0.7;
      return true;
    }
    startShove() {
      if (this.act || this.state !== 'stand' || this.planted === 0) return false;
      this.act = { type: 'shove', t: 0, phase: 0, hit: false, v: 0.9 * this.P.speedMax + 150 * this.P.muscle };
      this.crouchT = 0.8; this.leanT = -0.2;
      return true;
    }
    startPunch(tgt) {
      if (this.act || this.state !== 'stand' || !this.hands.length) return false;
      const P = this.P;
      this.act = { type: 'punch', t: 0, phase: 0, tgt, hit: false, wind: 0.1 / P.reflex, hand: this.hands[0], v: 560 * Math.pow(P.muscle, 0.7) };
      return true;
    }
    startBuffet() {
      if (this.act || this.state !== 'stand' || this.P.WL < 4) return false;
      this.act = { type: 'buffet', t: 0, phase: 0, hit: false, wind: 0.11 / this.P.reflex };
      this.wingV = 22;
      return true;
    }
    startDuck(dur) {
      if (this.act || this.state !== 'stand') return false;
      this.act = { type: 'duck', t: 0, dur };
      this.crouchT = 0.55; this.neckBend = 0.35; this.guard = 1;
      return true;
    }
    endAct() {
      this.act = null; this.weapon = null; this.guard = 0; this.crouchT = 1; this.leanT = 0; this.neckBend = 0; this.neckK = this.neckK0; this.headAngT = null; this.beakOpen = 0;
    }

    updateAct(dt) {
      const a = this.act, P = this.P, f = this.f, head = this.head;
      a.t += dt;
      if (a.type === 'peck') {
        if (a.phase === 0 && a.t >= a.wind) {
          a.phase = 1; this.neckBend = 0; this.neckK = this.neckK0 * 0.05; this.leanT = -0.32; this.beakOpen = 0.7;
          if (this.planted > 0) { const lunge = f * a.v * 0.16; this.H.vx += lunge; this.C.vx += lunge; }
        }
        if (a.phase === 1) {
          const tg = a.tgt(), dx = tg.x - head.x, dy = tg.y - head.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, dt * 40);
          const ux = dx / d, uy = dy / d, n = this.neck.length;
          head.vx += (ux * a.v - head.vx) * k; head.vy += (uy * a.v - head.vy) * k;
          for (let i = 0; i < n - 1; i++) { const p = this.neck[i], s = (i + 1) / n; p.vx += (ux * a.v * s - p.vx) * k * 0.5; p.vy += (uy * a.v * s - p.vy) * k * 0.5; }
          this.headAngT = Math.atan2(dy, dx);
          this.weapon = a.hit ? null : 'beak';
          if (a.hit || a.t >= a.wind + a.strike || d < P.HR * 0.5) {
            a.phase = 2; a.t2 = a.t; this.weapon = null; this.neckK = this.neckK0 * 1.5; this.leanT = 0; this.beakOpen = 0;
          }
        } else if (a.phase === 2 && a.t >= a.t2 + a.rec) this.endAct();
      } else if (a.type === 'kick') {
        if (a.phase === 0 && a.t >= a.crouch) {
          a.phase = 1; a.t1 = a.t;
          const tg = a.tgt(), dx = tg.x - this.midX();
          const vy = P.jumpV * a.power, air = 2 * vy / this.world.g;
          a.air = air; // a flying kick strikes for the whole leap (fight.js: the flying kick)
          // an ordinary kick reaches the target near the top of the leap; a flying kick comes down on it
          const vx = clamp((dx - f * P.LL * (a.fly ? 0.3 : 0.5)) / Math.max(0.12, air * (a.fly ? 0.85 : 0.55)), -P.jumpV * 1.2, P.jumpV * 1.2);
          this.hop(vx, -vy); if (!a.fly && !a.low) this.flap(1); this.crouchT = 1; // no wingbeat on a flying kick (low and long) or a wader's little hop-kick
        } else if (a.phase === 1 && a.t >= a.t1 + 0.05) {
          a.phase = 2; a.t2 = a.t; a.leg.kick = true; a.leg.planted = false; a.leg.sw = null;
        } else if (a.phase === 2) {
          const leg = a.leg, F = leg.foot, tg = a.tgt(), ax = this.ax(leg), ay = this.ay(leg);
          const dx = tg.x - F.x, dy = tg.y - F.y, d = Math.hypot(dx, dy) || 1;
          let nx = F.x + (dx / d * a.v + this.vx()) * dt, ny = F.y + (dy / d * a.v + this.vy()) * dt;
          const lx = nx - ax, ly = ny - ay, ld = Math.hypot(lx, ly), max = P.LL * 0.98;
          if (ld > max) { nx = ax + lx / ld * max; ny = ay + ly / ld * max; }
          F.vx = (nx - F.x) / dt; F.vy = (ny - F.y) / dt; F.x = nx; F.y = ny; leg.lift = 0.4;
          this.weapon = a.hit ? null : 'foot'; this.weaponLeg = leg;
          if (a.hit || a.t >= a.t2 + (a.fly ? Math.max(0.28, (a.air || 0) * 0.95) : 0.28)) { a.phase = 3; this.weapon = null; leg.kick = false; }
        } else if (a.phase === 3 && (this.state === 'stand' || a.t > 1.6)) this.endAct();
      } else if (a.type === 'shove') {
        if (a.phase === 0 && a.t >= 0.07) { a.phase = 1; const dv = f * a.v; this.H.vx += dv; this.C.vx += dv; this.weapon = 'body'; }
        else if (a.phase === 1) { if (a.hit) this.weapon = null; if (a.t >= 0.32) this.endAct(); }
      } else if (a.type === 'punch') {
        const h = a.hand, p = h.p;
        if (a.phase === 0) {
          h.punch = true;
          const nx = lerp(p.x, h.sx - f * P.armL * 0.25, 0.3), ny = lerp(p.y, h.sy + P.armL * 0.05, 0.3);
          p.x = nx; p.y = ny; p.vx = 0; p.vy = 0;
          if (a.t >= a.wind) a.phase = 1;
        } else if (a.phase === 1) {
          const tg = a.tgt(), dx = tg.x - p.x, dy = tg.y - p.y, d = Math.hypot(dx, dy) || 1;
          let nx = p.x + dx / d * a.v * dt, ny = p.y + dy / d * a.v * dt;
          const lx = nx - h.sx, ly = ny - h.sy, ld = Math.hypot(lx, ly), max = P.armL * 0.98;
          if (ld > max) { nx = h.sx + lx / ld * max; ny = h.sy + ly / ld * max; }
          p.vx = (nx - p.x) / dt; p.vy = (ny - p.y) / dt; p.x = nx; p.y = ny;
          this.weapon = a.hit ? null : 'fist'; this.weaponHand = h;
          if (a.hit || a.t >= a.wind + 0.15) { a.phase = 2; a.t2 = a.t; this.weapon = null; h.punch = false; }
        } else if (a.t >= a.t2 + 0.16) this.endAct();
      } else if (a.type === 'buffet') {
        if (a.phase === 0 && a.t >= a.wind) {
          a.phase = 1; this.leanT = -0.15;
          if (this.planted > 0) { const dv = f * 120 * P.muscle; this.H.vx += dv; this.C.vx += dv; }
        } else if (a.phase === 1) {
          this.weapon = a.hit ? null : 'wing';
          if (a.t >= a.wind + 0.14) this.endAct();
        }
      } else if (a.type === 'duck') {
        if (a.t >= a.dur) this.endAct();
      }
    }

    // After the world step: a planted strut never launches the body, so kill upward speed.
    post() {
      if (this.state === 'stand' && this.planted > 0) {
        if (this.H.vy < 0) this.H.vy *= 0.5;
        if (this.C.vy < 0) this.C.vy *= 0.5;
      }
    }

    // Impulse from a blow, as a change of velocity. part: 'head' | 'body'.
    push(dvx, dvy, part) {
      if (dvy < -110 && (this.state === 'stand' || this.state === 'rise')) { // knocked off its feet
        const vx = this.vx(), vy = this.vy();
        if (this.state === 'rise') { this.kBal = 1; this.restMul = 1; this.H.fr = 0; this.C.fr = 0; this.neckK = this.neckK0; }
        this.hop(vx, vy);
      }
      if (part === 'head') {
        this.head.vx += dvx * 2.2; this.head.vy += dvy * 2.2;
        this.H.vx += dvx * 0.5; this.C.vx += dvx * 0.5;
      } else { this.H.vx += dvx; this.C.vx += dvx; this.H.vy += dvy; this.C.vy += dvy; }
    }

    // Mirror the whole body to face the other way (velocities keep the body's own motion).
    flip() {
      const cx = this.midX(), vcx = this.vx();
      this.f = -this.f;
      for (const p of this.parts) { p.x = 2 * cx - p.x; p.ox = 2 * cx - p.ox; p.vx = 2 * vcx - p.vx; }
      for (const leg of this.legs) { if (leg.sw) { leg.sw.x0 = 2 * cx - leg.sw.x0; leg.sw.x1 = 2 * cx - leg.sw.x1; } if (leg.from) leg.from.x = 2 * cx - leg.from.x; if (leg.foot.im === 0) leg.foot.vx = 0; }
      this.headAng = Math.PI - this.headAng;
      if (this.headAngT !== null) this.headAngT = Math.PI - this.headAngT;
    }

    getPose() {
      const pose = { f: this.f, hx: this.H.x, hy: this.H.y, cx: this.C.x, cy: this.C.y, neck: [], headAng: this.headAng, legs: [],
        tx: this.T ? this.T.x : NaN, ty: this.T ? this.T.y : NaN, wing: this.wing, beakOpen: this.beakOpen, eye: this.eye };
      for (const p of this.neck) pose.neck.push(p.x, p.y);
      for (const leg of this.legs) pose.legs.push({ ax: this.ax(leg), ay: this.ay(leg), fx: leg.foot.x, fy: leg.foot.y, side: leg.side, pair: leg.pair, lift: leg.lift });
      if (this.hands.length) pose.arms = this.hands.map((h) => ({ sx: h.sx, sy: h.sy, x: h.p.x, y: h.p.y, side: h.side }));
      return pose;
    }

    remove() {
      const w = this.world, parts = new Set(this.parts), sticks = new Set(this.sticks);
      w.ps = w.ps.filter((p) => !parts.has(p));
      w.sticks = w.sticks.filter((s) => !sticks.has(s));
      w.solvers = w.solvers.filter((s) => s !== this);
    }
  }

  RB.creature = { Rag };
})();
