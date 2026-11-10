/* Filogênese — criatura: corpo físico, espinha encadeada, pernas com passos e IK, e animações procedurais. */
(function (FG) {
  'use strict';
  const U = FG.U, TAU = U.TAU, Draw = FG.Draw;
  let uid = 0;
  const GRAV = 900;

  class Creature {
    constructor(sp, x, y, o) {
      o = o || {};
      this.id = ++uid; this.sp = sp; this.baby = !!o.baby;
      this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
      this.angle = o.angle == null ? Math.random() * TAU : o.angle;
      this.mx = 0; this.my = 0; this.sprint = false; this.sneaking = false; this.sprinting = false;
      this.faceT = null; this.lookAt = null;
      this.time = Math.random() * 10; this.gait = 0; this.speed = 0;
      this.jz = 0; this.vz = 0; this.z = 0;
      this.stun = 0; this.dash = 0; this.dashX = 0; this.dashY = 0;
      this.poison = 0; this.poisonDps = 0; this.poisonSrc = null;
      this.cd = { bite: 0, charge: 0, spit: 0, strike: 0, social: 0 };
      this.anim = null;
      this.jaw = 0; this.blink = 0; this.blinkT = 1 + Math.random() * 4; this.blinkA = 0; this.lookX = 0.4; this.lookY = 0;
      this.flare = 0; this.sing = 0; this.wing = 0; this.armSwing = 0; this.scaleMul = 1; this.flash = 0; this.alpha = 1;
      this.lunge = 0; this.headTurn = 0; this.wig = 0; this.wagA = 0.22; this.wagF = 3.2; this.headA = this.angle;
      this.wet = 0; this.biome = 0; this.dead = false; this.sleeping = false;
      this.stamina = 1; this.stamT = 0; this.breath = 1; this.speedMul = 1;
      this.isPlayer = false; this.ai = null; this.nest = o.nest || null;
      this.friend = false; this.friendMeter = 0;
      this.stepEv = 0; this.landed = false; this.combatT = -99;
      this.maxHp = 0; this.hp = 0;
      this.rebuild();
      this.hp = this.maxHp;
    }

    /** (Re)constrói a parte dependente do genoma — chamado quando a espécie evolui. */
    rebuild() {
      const sp = this.sp, bp = this.bp = Draw.bpFor(sp, this.baby);
      this.rev = sp.rev; this.stats = sp.stats;
      const old = this.maxHp;
      this.maxHp = Math.max(1, Math.round(sp.stats.hp * (this.baby ? 0.3 : 1)));
      if (old) this.hp = Math.min(this.maxHp, Math.max(1, Math.round(this.hp * this.maxHp / old)));
      const n = bp.n;
      this.spine = new Float32Array(n * 2); this.rs = new Float32Array(n * 2);
      this.legs = [];
      const P = bp.legIdx.length;
      for (let j = 0; j < P; j++) for (let side = -1; side <= 1; side += 2)
        this.legs.push({ idx: bp.legIdx[j], side, back: P > 1 && j >= P / 2, fx: 0, fy: 0, sx: 0, sy: 0, tx: 0, ty: 0, st: -1 });
      this.radius = bp.radius;
      this.reach = bp.headGap + bp.hr * bp.hs.L;
      this.settle();
    }

    /** Coloca a espinha reta atrás da cabeça e os pés na posição de repouso. */
    settle() {
      const bp = this.bp, S = this.spine, n = bp.n, a = this.angle;
      S[2] = this.x; S[3] = this.y;
      S[0] = this.x + Math.cos(a) * bp.headGap; S[1] = this.y + Math.sin(a) * bp.headGap;
      for (let i = 2; i < n; i++) { S[i * 2] = S[(i - 1) * 2] - Math.cos(a) * bp.sp; S[i * 2 + 1] = S[(i - 1) * 2 + 1] - Math.sin(a) * bp.sp; }
      this.rs.set(S); this.headA = a;
      for (const lg of this.legs) { const h = this.legHome(lg); lg.fx = h[0]; lg.fy = h[1]; lg.st = -1; }
    }

    legHome(lg) {
      const S = this.spine, bp = this.bp, n = bp.n, i = lg.idx;
      const a = i - 1, b = Math.min(n - 1, i + 1);
      let tx = S[a * 2] - S[b * 2], ty = S[a * 2 + 1] - S[b * 2 + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const reach = bp.r[i] * 0.55 + bp.legLen * 0.6, fwd = bp.legLen * (lg.back ? -0.1 : 0.24);
      HOME[0] = S[i * 2] - ty * lg.side * reach + tx * fwd;
      HOME[1] = S[i * 2 + 1] + tx * lg.side * reach + ty * fwd;
      return HOME;
    }

    play(name, dur, extra) { this.anim = Object.assign({ name, t: 0, dur }, extra); return this.anim; }

    jump() {
      if (this.jz > 0 || this.stats.jump <= 0 || this.stamina < 0.15 || this.wet >= 2 || this.stun > 0 || this.dead) return false;
      this.vz = 175 + 30 * this.stats.jump; this.jz = 0.01;
      this.stamina -= 0.15; this.stamT = 0.6;
      return true;
    }

    knock(dx, dy, force) {
      const l = Math.hypot(dx, dy) || 1, m = 1 / Math.max(0.5, Math.sqrt(this.stats.bulk || 1));
      this.kx += dx / l * force * m; this.ky += dy / l * force * m;
    }

    get airborne() { return this.jz > 8; }

    update(dt, world) {
      if (this.rev !== this.sp.rev) this.rebuild();
      const bp = this.bp, st = this.stats, n = bp.n;
      this.time += dt;
      const cd = this.cd;
      if (cd.bite > 0) cd.bite -= dt; if (cd.charge > 0) cd.charge -= dt; if (cd.spit > 0) cd.spit -= dt;
      if (cd.strike > 0) cd.strike -= dt; if (cd.social > 0) cd.social -= dt;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);

      // ---- animação: alvos dos parâmetros de pose ----
      let A = this.anim;
      if (A) { A.t += dt; if (A.t >= A.dur) this.anim = A = null; }
      let jawT = 0, lungeT = 0, flareT = 0, singT = 0, swing = 0, scaleT = 1, twist = 0, wigT = 0, hop = 0, lock = false;
      if (A) {
        const p = A.t / A.dur, w = A.t;
        switch (A.name) {
          case 'bite': jawT = p < 0.45 ? 1 : 0; lungeT = Math.sin(Math.min(1, p / 0.7) * Math.PI) * bp.sp * 1.4; break;
          case 'strike': swing = p; twist = Math.sin(p * Math.PI) * 0.8 * (A.dir || 1); jawT = 0.4; break;
          case 'spit': jawT = p > 0.3 && p < 0.75 ? 1 : 0.25; lungeT = (p < 0.4 ? -(p / 0.4) : p < 0.6 ? 1.4 : 0) * bp.sp * 0.6; break;
          case 'charge': lungeT = bp.sp * 0.5; jawT = 0.35; break;
          case 'sing': lock = true; singT = 0.55 + 0.45 * Math.sin(w * 15); jawT = 0.5 + 0.5 * Math.sin(w * 15); twist = Math.sin(w * 4) * 0.15; break;
          case 'dance': lock = true; wigT = 1; twist = Math.sin(w * 9) * 0.45; hop = Math.abs(Math.sin(w * 9)) * 7 * bp.size; break;
          case 'charm': lock = true; flareT = Math.sin(p * Math.PI) * 1.1; wigT = 0.3; twist = Math.sin(w * 6) * 0.18; break;
          case 'pose': lock = true; flareT = 1; scaleT = 1 + Math.sin(p * Math.PI) * 0.17; jawT = 0.65; break;
          case 'eat': lock = true; jawT = 0.5 + 0.5 * Math.sin(w * 17); lungeT = bp.sp * 0.5 * Math.abs(Math.sin(w * 8.5)); break;
          case 'call': lock = true; singT = 0.7 + 0.3 * Math.sin(w * 22); jawT = 0.85; flareT = 0.5; break;
          case 'roar': lock = true; jawT = 1; flareT = 0.8; scaleT = 1.06; break;
          case 'happy': hop = Math.abs(Math.sin(w * 10)) * 6 * bp.size; flareT = 0.4; break;
          case 'die': lock = true; break;
        }
      }
      const k20 = Math.min(1, dt * 20), k10 = Math.min(1, dt * 10);
      this.jaw += (jawT - this.jaw) * k20;
      this.lunge += (lungeT - this.lunge) * k20;
      this.flare += (U.clamp(flareT, 0, 1) - this.flare) * k10;
      this.sing += (singT - this.sing) * k20;
      this.scaleMul += (scaleT - this.scaleMul) * k10;
      this.wig += (wigT - this.wig) * k10;
      this.armSwing = swing;

      // ---- movimento ----
      let mx = this.mx, my = this.my;
      if (this.stun > 0) this.stun -= dt;
      if (lock || this.stun > 0 || this.dead || this.sleeping) { mx = 0; my = 0; }
      const moving = mx !== 0 || my !== 0, air = this.jz > 1;
      let spd = st.moveSpeed * this.speedMul * (this.baby ? 0.85 : 1);
      if (!air) { if (this.wet === 1) spd *= 0.8; else if (this.wet >= 2) spd *= 0.42 + 0.085 * st.swim; }
      if (this.sneaking) spd *= 0.5;
      if (!this.isPlayer && this.hp < this.maxHp * 0.4) spd *= 0.82;   // ferido, manca
      let sprinting = false;
      if (this.sprint && moving && this.stamina > 0.02 && !this.sneaking && this.wet < 2) {
        spd *= this.isPlayer ? 1.55 : 1.32; sprinting = true;
        this.stamina = Math.max(0, this.stamina - dt * (this.isPlayer ? 0.15 : 0.11)); this.stamT = this.isPlayer ? 0.9 : 2.5;
      } else if ((this.stamT -= dt) <= 0) this.stamina = Math.min(1, this.stamina + dt * 0.24);
      this.sprinting = sprinting;
      if (this.dash > 0) { this.dash -= dt; this.vx = this.dashX; this.vy = this.dashY; }
      else {
        const k = Math.min(1, dt * (air ? 1.5 : 9));
        this.vx += (mx * spd - this.vx) * k; this.vy += (my * spd - this.vy) * k;
      }
      const ox = this.x, oy = this.y;
      this.x += (this.vx + this.kx) * dt; this.y += (this.vy + this.ky) * dt;
      if (this.kx || this.ky) { const f = 1 - Math.min(1, dt * 7); this.kx *= f; this.ky *= f; if (Math.abs(this.kx) + Math.abs(this.ky) < 2) this.kx = this.ky = 0; }
      if (world) world.resolve(this, ox, oy);
      const sp2 = this.speed = Math.hypot(this.vx, this.vy);
      this.gait += sp2 * dt / (bp.sp * 2.4);

      // ---- salto / planar ----
      this.landed = false;
      if (this.jz > 0 || this.vz > 0) {
        let g = GRAV;
        if (this.vz < 0 && st.glide > 0) g *= 1 - 0.21 * st.glide;
        this.vz -= g * dt; this.jz += this.vz * dt;
        if (this.jz <= 0) { this.jz = 0; this.vz = 0; this.landed = true; }
      }
      this.z = this.jz + hop;
      const wingT = this.jz > 3 ? 1 : this.flare * 0.8;
      this.wing += (wingT - this.wing) * k10;

      // ---- orientação ----
      let want = this.angle;
      if (this.faceT != null && this.dash <= 0) want = this.faceT;
      else if (sp2 > 8) want = Math.atan2(this.vy, this.vx);
      if (!this.dead && !this.sleeping) this.angle = U.angTo(this.angle, want, (this.dash > 0 ? 22 : 7.5) / Math.pow(bp.size, 0.35) * dt);
      let ht = 0;
      if (this.lookAt && !this.dead) ht = U.clamp(U.angDiff(this.angle, Math.atan2(this.lookAt.y - this.y, this.lookAt.x - this.x)), -0.75, 0.75);
      else if (sp2 < 10 && !this.sleeping) ht = Math.sin(this.time * 0.6 + this.id) * 0.16;
      this.headTurn += (ht + twist - this.headTurn) * Math.min(1, dt * 9);
      const ha = this.headA = this.angle + this.headTurn;

      // ---- espinha: corrente com limite de dobra ----
      const S = this.spine;
      S[2] = this.x; S[3] = this.y;
      const hg = bp.headGap + this.lunge;
      S[0] = this.x + Math.cos(ha) * hg; S[1] = this.y + Math.sin(ha) * hg;
      let pa = this.angle + Math.PI;
      const maxBend = bp.n > 11 ? 0.42 : 0.55, spc = bp.sp;
      for (let i = 2; i < n; i++) {
        const px = S[(i - 1) * 2], py = S[(i - 1) * 2 + 1];
        let a = Math.atan2(S[i * 2 + 1] - py, S[i * 2] - px);
        const d = U.angDiff(pa, a);
        if (d > maxBend) a = pa + maxBend; else if (d < -maxBend) a = pa - maxBend;
        S[i * 2] = px + Math.cos(a) * spc; S[i * 2 + 1] = py + Math.sin(a) * spc;
        pa = a;
      }

      // ---- pernas: passos alternados ----
      const L = this.legs;
      if (L.length) {
        const stepDur = U.clamp(0.21 - sp2 / 1500, 0.08, 0.2), thr = bp.legLen * 0.46;
        const tuck = air || this.wet >= 2;
        for (let q = 0; q < L.length; q++) {
          const lg = L[q], h = this.legHome(lg), hx = h[0], hy = h[1];
          if (tuck) { const k = Math.min(1, dt * 16); lg.fx += (hx - lg.fx) * k; lg.fy += (hy - lg.fy) * k; lg.st = -1; continue; }
          if (lg.st >= 0) {
            lg.st += dt / stepDur;
            lg.tx = hx + this.vx * stepDur * 0.85; lg.ty = hy + this.vy * stepDur * 0.85;
            if (lg.st >= 1) { lg.st = -1; lg.fx = lg.tx; lg.fy = lg.ty; this.stepEv++; }
            else { const e = U.smooth(lg.st); lg.fx = U.lerp(lg.sx, lg.tx, e); lg.fy = U.lerp(lg.sy, lg.ty, e); }
          } else {
            const d = Math.hypot(lg.fx - hx, lg.fy - hy);
            if (d > thr && !(L[q ^ 1].st >= 0 && d < thr * 2.3)) { lg.st = 0; lg.sx = lg.fx; lg.sy = lg.fy; lg.tx = hx; lg.ty = hy; }
          }
        }
      }

      // ---- espinha de desenho: ondulação de marcha, rebolado e abano da cauda ----
      const R = this.rs, legless = L.length === 0, moveF = Math.min(1, sp2 / 60);
      const amp = (legless ? 0.55 : 0.1) * spc * moveF, wig = this.wig * spc * 0.55;
      const gf = legless ? 1.6 : 3.2, ph = legless ? 0.75 : 0.5, wagA = this.wagA * spc, wt = this.time * this.wagF;
      for (let i = 0; i < n; i++) {
        let off = 0;
        if (i >= 1) {
          const t = i / (n - 1);
          off = Math.sin(this.gait * gf - i * ph) * amp * (legless ? 0.35 + t : t);
          if (wig > 0.01) off += Math.sin(this.time * 13 - i * 0.9) * wig * (0.4 + t);
          if (i > bp.torsoN) off += Math.sin(wt - i * 0.7) * wagA * ((i - bp.torsoN) / bp.tailN);
        } else if (legless) off = Math.sin(this.gait * gf) * amp * 0.3;
        if (off) {
          const a = i === 0 ? 0 : i - 1, b = i === n - 1 ? n - 1 : i + 1;
          let tx = S[a * 2] - S[b * 2], ty = S[a * 2 + 1] - S[b * 2 + 1];
          const l = Math.hypot(tx, ty) || 1;
          R[i * 2] = S[i * 2] - ty / l * off; R[i * 2 + 1] = S[i * 2 + 1] + tx / l * off;
        } else { R[i * 2] = S[i * 2]; R[i * 2 + 1] = S[i * 2 + 1]; }
      }

      // ---- olhos ----
      if ((this.blinkT -= dt) <= 0) { this.blinkT = 2 + Math.random() * 4; this.blinkA = 0.16; }
      if (this.sleeping || this.dead) this.blink = 1;
      else if (this.blinkA > 0) { this.blinkA -= dt; this.blink = Math.sin(U.clamp(this.blinkA / 0.16, 0, 1) * Math.PI); }
      else this.blink = 0;
      let lx = 0.4, ly = 0;
      if (this.lookAt) { const a = Math.atan2(this.lookAt.y - S[1], this.lookAt.x - S[0]) - ha; lx = Math.cos(a); ly = Math.sin(a); }
      this.lookX += (lx - this.lookX) * k10; this.lookY += (ly - this.lookY) * k10;
    }
  }
  const HOME = [0, 0];

  FG.Creature = Creature;
})(window.FG = window.FG || {});
