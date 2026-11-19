/* Planolândia — o Quadrado: controle, habilidades e rig procedural (molas de squash/stretch, olhos, perninhas). */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const M = PL.M, Phys = PL.Phys, G3 = PL.G3;

  const K = {
    RUN: 118, ACC_G: 2000, ACC_A: 1400,
    JUMP_V: -308, CUT: 0.42, APEX_G: 0.55,
    COYOTE: 0.09, BUFFER: 0.13,
    DEPTH: 86, DEPTH_ACC: 1000,
    DASH_V: 275, DASH_T: 0.17, DASH_CD: 0.42,
    ATK_T: 0.26, ATK_ACTIVE: 0.11, ATK_CD: 0.33,
    POGO_V: -290, RECOIL_V: 95, RECOIL_T: 0.07,
    INV: 1.15, FOCUS_T: 0.85, FOCUS_COST: 33, GEO_MAX: 99, GEO_HIT: 11,
    CLING_FALL: 60, WJ_VY: -300, WJ_VX: 190, WJ_LOCK: 0.15, WALL_COYOTE: 0.08, REACH: 22,
  };
  const MODS0 = { atkCd: 1, reach: 0, magnet: 44, depth: 1, focusT: 1, atkDepth: 0 };

  const tA = G3.newShape(), tB = G3.newShape();
  const COL = { body: 0xf6d55c, light: 0xfff1a8, shade: 0xd9a441, out: 0x2a1e3b, eye: 0xffffff, cheek: 0xf28a8a };

  class Player {
    constructor(G, x, y, z) {
      this.G = G;
      this.b = Phys.body(x, y, z, 6, 6);
      this.facing = 1;
      this.vz = 0;
      this.coyote = 0; this.jumpBuf = 0; this.jumping = false;
      this.dashT = 0; this.dashCd = 0; this.airDash = true;
      this.atkT = 0; this.atkCd = 0; this.atkDir = 'side'; this.atkHit = new Set(); this.atkBuf = 0; this.atkFlip = false;
      this.recoilT = 0; this.recoilV = 0;
      this.inv = 0; this.lock = 0; this.hurtT = 0;
      this.focusT = 0; this.focusing = false;
      this.dead = false; this.frozen = false;
      // rig
      this.sx = 1; this.sy = 1; this.vsx = 0; this.vsy = 0; this.rot = 0; this.vrot = 0;
      this.walkPh = 0; this.blinkT = 2.5; this.blink = 0; this.lookX = 1; this.lookY = 0; this.mouth = 0;
      this.lastSafe = { x, y, z }; this.safeT = 0;
      this.blocker = null; this.blockT = 0; this.blockZ = 0;
      this.wasGrounded = false; this.fallV = 0; this.airT = 0;
      this.flashT = 0;
      this.cling = 0; this.clingT = 0; this.clingDir = 0; this.wjT = 0; this.wjDir = 0;
    }

    get mods() { return this.G.mods || MODS0; }

    // encostado numa parede escalável do lado dir?
    wallTouch(dir) {
      const b = this.b;
      if (!this._probe) this._probe = { hx: b.hx, hy: b.hy - 3 };
      const p = Phys.overlapAt(this._probe, this.G.room, b.x + dir * 1.5, b.y - 1, b.z);
      return !!p && !p.slick && !p.bounce && !p.oneWay;
    }

    get x() { return this.b.x; }
    get y() { return this.b.y; }
    get z() { return this.b.z; }

    kick(sx, sy) { this.sx = sx; this.sy = sy; this.vsx = 0; this.vsy = 0; }

    update(dt) {
      const G = this.G, I = PL.Input, b = this.b, st = G.save, ab = st.abilities, room = G.room;
      const tm = (v) => Math.max(0, v - dt);
      this.coyote = tm(this.coyote); this.jumpBuf = tm(this.jumpBuf); this.dashCd = tm(this.dashCd);
      this.atkCd = tm(this.atkCd); this.atkBuf = tm(this.atkBuf); this.recoilT = tm(this.recoilT);
      this.inv = tm(this.inv); this.lock = tm(this.lock); this.hurtT = tm(this.hurtT); this.blockT = tm(this.blockT); this.flashT = tm(this.flashT);
      this.clingT = tm(this.clingT); this.wjT = tm(this.wjT);
      const md = this.mods;
      this.updateRig(dt);
      if (this.dead || this.frozen) { this.vz = 0; return; }

      let mx = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0);
      if (this.lock > 0 || this.focusing) mx = 0;
      if (mx && this.atkT <= 0) this.facing = mx;
      else if (mx && this.atkT > 0 && this.atkDir !== 'side') this.facing = mx;

      // ----- Garra de Vértice: agarrar a parede -----
      const wasCling = this.cling;
      this.cling = 0;
      if (ab.garra && !b.grounded && this.dashT <= 0 && this.lock <= 0 && mx && this.wjT <= 0 && this.wallTouch(mx)) {
        this.cling = mx;
        if (!wasCling) {
          b.vy = Math.max(0, b.vy) * 0.3;
          this.airDash = true;
          this.kick(0.85, 1.15);
          G.sfx('garra');
        }
        this.clingDir = mx; this.clingT = K.WALL_COYOTE;
        this.facing = -mx;
        if (b.vy > 20 && Math.random() < 0.35) G.fx.spawn({ x: b.x + mx * 6, y: b.y + 4, z: b.z, vx: -mx * 20, vy: -30, life: 0.3, color: 0xe8dcc0, grav: 120, size: 1 });
      }

      // ----- Investida (dash) -----
      if (I.pressed.dash && ab.dash && this.dashCd <= 0 && this.dashT <= 0 && this.lock <= 0 && (b.grounded || this.airDash)) {
        this.dashT = K.DASH_T;
        if (mx) this.facing = mx;
        if (!b.grounded) this.airDash = false;
        this.kick(1.7, 0.55);
        this.atkT = 0;
        G.sfx('dash');
        G.fx.burst(b.x - this.facing * 6, b.y, b.z, 6, { speed: 60, color: [0xfff1a8, 0xffffff], life: 0.3, grav: 0, size: 2, ang0: this.facing > 0 ? Math.PI : 0, spread: 1.2 });
      }
      if (this.dashT > 0) {
        this.dashT -= dt;
        b.vx = this.facing * K.DASH_V;
        b.vy = 0;
        if (this.dashT <= 0) { this.dashCd = K.DASH_CD; b.vx = this.facing * K.RUN * 0.8; }
        if (Math.random() < 0.6) G.fx.spawn({ x: b.x - this.facing * 4, y: b.y + (Math.random() - 0.5) * 8, z: b.z, vx: -this.facing * 20, life: 0.25, color: 0xfff1a8, grav: 0, kind: 'streak' });
      } else {
        const acc = b.grounded ? K.ACC_G : K.ACC_A;
        if (this.wjT > 0) b.vx = -this.wjDir * K.WJ_VX;      // impulso do pulo na parede não pode ser anulado
        else b.vx = M.approach(b.vx, mx * K.RUN, acc * dt);
        if (this.recoilT > 0) b.vx = this.recoilV;
        let g = Phys.GRAV;
        if (Math.abs(b.vy) < 45 && I.down.jump && !b.grounded) g *= K.APEX_G;
        b.vy = Math.min(b.vy + g * dt, this.cling ? K.CLING_FALL : Phys.MAX_FALL);
      }

      // ----- pulo -----
      if (I.pressed.jump) this.jumpBuf = K.BUFFER;
      if (b.grounded) { this.coyote = K.COYOTE; this.airDash = true; }
      const onOneWay = b.grounded && b.groundPrim && b.groundPrim.oneWay;
      if (this.jumpBuf > 0 && I.down.down && onOneWay) {
        b.dropT = 0.25; this.jumpBuf = 0; this.coyote = 0;
      } else if (this.jumpBuf > 0 && !b.grounded && (this.cling || this.clingT > 0) && ab.garra && this.lock <= 0) {
        // pulo na parede
        const d = this.cling || this.clingDir;
        b.vy = K.WJ_VY; b.vx = -d * K.WJ_VX;
        this.wjT = K.WJ_LOCK; this.wjDir = d;
        this.jumpBuf = 0; this.clingT = 0; this.cling = 0; this.jumping = true; this.facing = -d;
        this.kick(0.7, 1.4);
        this.vrot += -d * 20;
        G.sfx('walljump');
        G.fx.burst(b.x + d * 6, b.y, b.z, 5, { speed: 60, color: 0xe8dcc0, life: 0.3, grav: 80, ang0: d > 0 ? Math.PI : 0, spread: 1.4 });
      } else if (this.jumpBuf > 0 && this.coyote > 0 && this.lock <= 0 && this.dashT <= 0) {
        b.vy = K.JUMP_V; this.jumpBuf = 0; this.coyote = 0; this.jumping = true;
        this.kick(0.7, 1.4);
        G.sfx('jump');
        G.fx.burst(b.x, b.y + 6, b.z, 4, { speed: 40, color: 0xe8dcc0, life: 0.3, grav: 60, ang0: -Math.PI / 2, spread: 2.4 });
      }
      if (this.jumping && !I.down.jump && b.vy < 0) { b.vy *= K.CUT; this.jumping = false; }
      if (b.vy >= 0) this.jumping = false;

      // ----- profundidade -----
      let az = I.axisZ;
      if (this.lock > 0 || this.focusing || this.dashT > 0) az = 0;
      this.vz = M.approach(this.vz, az * K.DEPTH * md.depth, K.DEPTH_ACC * dt);
      if (Math.abs(this.vz) > 0.01) {
        const dz = this.vz * dt;
        const zmax = G.depthLimit(b, 1), zmin = G.depthLimit(b, -1);
        let nz = b.z + dz;
        if (nz > zmax) nz = zmax;
        if (nz < zmin) nz = zmin;
        if (nz !== b.z) {
          // apoio que desliza com a profundidade (barras giradas, plataformas oblíquas) leva o Quadrado junto
          let carry = 0;
          const gp = b.grounded ? Phys.support(b, room) : null;
          if (gp && G3.sliceInto(gp, b.z, tA) && G3.sliceInto(gp, nz, tB)) carry = tB.cx - tA.cx;
          const z0 = b.z;
          const res = Phys.tryDepth(b, room, nz - b.z);
          if (res.blocker) { this.blocker = res.blocker; this.blockT = 0.35; this.blockZ = nz; this.vz = 0; G.sfx('block'); }
          if (carry && b.z !== z0) {
            const ox = b.x;
            b.x += carry * ((b.z - z0) / (nz - z0));
            if (Phys.overlapAt(b, room, b.x, b.y, b.z)) b.x = ox;
          }
        } else this.vz = 0;
        G.onDepth(this);
      }

      // ----- movimento -----
      this.fallV = b.vy;
      Phys.move(b, room, dt);
      const gp = b.grounded ? (b.groundPrim && b.groundPrim.bounce ? b.groundPrim : Phys.bounceUnder(b, room)) : null;
      if (gp && gp.bounce && this.fallV >= 0) {
        // cogumelo: lança para cima
        b.vy = -gp.bounce * (I.down.jump ? 1.1 : 1);
        b.grounded = false;
        this.jumping = false; this.airDash = true; this.coyote = 0;
        this.kick(0.6, 1.5);
        gp.squashT = 0.25;
        G.sfx('boing');
        G.fx.burst(b.x, b.y + 6, b.z, 6, { speed: 70, color: [0xf29bc4, 0xffd2e8], life: 0.35, grav: 120, ang0: -Math.PI / 2, spread: 2.2 });
      } else if (b.grounded && !this.wasGrounded) this.onLand(this.fallV);
      if (!b.grounded) this.airT += dt; else this.airT = 0;
      this.wasGrounded = b.grounded;

      // ----- golpe de Aresta -----
      if (I.pressed.attack) this.atkBuf = 0.12;
      if (this.atkBuf > 0 && this.atkCd <= 0 && this.dashT <= 0 && this.lock <= 0 && !this.focusing) {
        this.atkBuf = 0;
        this.atkT = K.ATK_T; this.atkCd = K.ATK_CD * md.atkCd;
        this.atkDir = I.down.up ? 'up' : (I.down.down && !b.grounded) ? 'down' : 'side';
        if (this.cling && this.atkDir === 'side') this.facing = -this.cling;
        this.atkHit.clear();
        this.atkFlip = !this.atkFlip;
        this.vrot += (this.atkDir === 'side' ? -this.facing : this.atkDir === 'up' ? (this.atkFlip ? 1 : -1) : this.facing) * 26;
        G.sfx('slash');
      }
      if (this.atkT > 0) {
        const el = K.ATK_T - this.atkT;
        if (el <= K.ATK_ACTIVE) G.playerAttack(this, this.atkHitbox());
        this.atkT -= dt;
      }

      // ----- Foco (cura) -----
      const canFocus = I.down.focus && b.grounded && st.geo >= K.FOCUS_COST && st.lados < st.maxLados && this.atkT <= 0 && this.dashT <= 0 && this.lock <= 0;
      if (canFocus) {
        if (!this.focusing) G.sfx('focus');
        this.focusing = true;
        this.focusT += dt;
        b.vx = 0;
        if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          G.fx.spawn({ x: b.x + Math.cos(a) * 16, y: b.y + Math.sin(a) * 16, z: b.z, vx: -Math.cos(a) * 50, vy: -Math.sin(a) * 50, life: 0.3, color: 0xffffff, grav: 0, drag: 0 });
        }
        if (this.focusT >= K.FOCUS_T * md.focusT) {
          this.focusT = 0;
          st.geo -= K.FOCUS_COST;
          st.lados = Math.min(st.maxLados, st.lados + 1);
          this.kick(1.3, 0.8);
          G.sfx('heal');
          G.fx.ring(b.x, b.y, b.z, 4, 22, 0.4, 0xfff1a8, 2);
          G.hud && G.hud.pulse('lados');
        }
      } else { this.focusing = false; this.focusT = 0; }

      // ----- perigos, esmagamento e posição segura -----
      const crush = G.hasDyn ? Phys.depenetrate(b, room) : 0;
      const haz = Phys.hazardAt(b, room);
      if (crush > 5 || haz) G.hurtPlayer(b.x - this.facing, 1, { hazard: true, src: haz });
      this.safeT -= dt;
      if (b.grounded && !haz && this.safeT <= 0 && b.groundPrim && !b.groundPrim.dyn && !b.groundPrim.unsafe && this.dashT <= 0) {
        this.safeT = 0.2;
        // não guarda posições coladas em perigos
        const probe = { x: b.x, y: b.y, z: b.z, hx: b.hx + 14, hy: b.hy };
        if (!Phys.hazardAt(probe, room, 0)) { this.lastSafe.x = b.x; this.lastSafe.y = b.y; this.lastSafe.z = b.z; }
      }

      // olhar
      const tx = this.cling ? -this.cling : this.atkT > 0 && this.atkDir === 'side' ? this.facing : (mx || this.facing);
      this.lookX = M.damp(this.lookX, tx, 12, dt);
      this.lookY = M.damp(this.lookY, I.down.up ? -1 : I.down.down ? 1 : this.vz !== 0 ? -0.3 * Math.sign(this.vz) : 0, 10, dt);
    }

    atkHitbox() {
      const b = this.b;
      if (!this._hb) this._hb = G3.newShape();
      const R = K.REACH + this.mods.reach;
      if (this.atkDir === 'up') return G3.setRect(this._hb, b.x - 10, b.y - b.hy - R, b.x + 10, b.y);
      if (this.atkDir === 'down') return G3.setRect(this._hb, b.x - 10, b.y, b.x + 10, b.y + b.hy + R);
      const f = this.facing;
      return f > 0 ? G3.setRect(this._hb, b.x, b.y - 10, b.x + b.hx + R, b.y + 9) : G3.setRect(this._hb, b.x - b.hx - R, b.y - 10, b.x, b.y + 9);
    }

    // chamado pelo jogo quando o golpe acerta algo
    onAttackHit(kind) {
      const b = this.b;
      if (this.atkDir === 'down') {
        b.vy = K.POGO_V; this.jumping = false; this.airDash = true;
        this.kick(0.8, 1.3);
      } else if (this.atkDir === 'side') {
        this.recoilT = K.RECOIL_T; this.recoilV = -this.facing * K.RECOIL_V;
      } else if (b.vy < 0) {
        b.vy *= 0.6;
      }
      if (kind !== 'hazard') {
        const st = this.G.save;
        st.geo = Math.min(K.GEO_MAX, st.geo + K.GEO_HIT);
      }
    }

    onLand(v) {
      const k = M.clamp(v / 420, 0, 1);
      if (k > 0.15) {
        this.kick(1 + 0.45 * k, 1 - 0.4 * k);
        this.G.fx.burst(this.b.x, this.b.y + 6, this.b.z, Math.round(3 + 5 * k), { speed: 50 + 60 * k, color: [0xe8dcc0, 0xc7b693], life: 0.35, grav: 120, ang0: -Math.PI / 2, spread: 2.8 });
        this.G.sfx('land', k);
      }
    }

    hurt(fromX, opts) {
      const b = this.b;
      this.inv = K.INV; this.lock = 0.2; this.hurtT = 0.4; this.flashT = 0.12;
      this.atkT = 0; this.dashT = 0; this.focusing = false; this.focusT = 0;
      const dir = b.x >= fromX ? 1 : -1;
      if (!opts || !opts.hazard) { b.vx = dir * 160; b.vy = -190; this.recoilT = 0.12; this.recoilV = dir * 150; }
      this.kick(1.4, 0.6);
      this.vrot += dir * 30;
    }

    updateRig(dt) {
      // molas de squash/stretch e rotação
      const k = 320, d = 15;
      this.vsx += (-(this.sx - 1) * k - this.vsx * d) * dt; this.sx += this.vsx * dt;
      this.vsy += (-(this.sy - 1) * k - this.vsy * d) * dt; this.sy += this.vsy * dt;
      this.vrot += (-this.rot * 260 - this.vrot * 16) * dt; this.rot += this.vrot * dt;
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = 2 + Math.random() * 3; }
      this.blink = Math.max(0, this.blink - dt);
      const sp = Math.abs(this.b.vx);
      if (this.b.grounded && sp > 5) this.walkPh += sp * dt * 0.45;
      else if (this.b.grounded) this.walkPh = M.damp(this.walkPh, Math.round(this.walkPh / Math.PI) * Math.PI, 10, dt);
    }

    draw(g, t) {
      const b = this.b;
      if (this.dead) return;
      const blinkHide = this.inv > 0 && this.hurtT <= 0 && Math.floor(t * 18) % 2 === 0;
      const x = b.x, y = b.y;
      const f = this.facing;
      // rastros ao deslizar em profundidade (frente = para cima-direita na projeção oblíqua)
      const vzK = Math.abs(this.vz) / K.DEPTH;
      if (vzK > 0.1) {
        const s = Math.sign(this.vz);
        g.fillStyle(PL.REGIONS.borda[s > 0 ? 'ghostFront' : 'ghostBack'], 0.5 * vzK);
        for (let i = 0; i < 4; i++) {
          const o = ((t * 60 + i * 7) % 20) + 8;
          const px = x - s * o * 0.8 + (i - 1.5) * 4, py = y + s * o * 0.6 + (i % 2) * 5 - 2;
          g.fillRect(Math.round(px), Math.round(py), 2, 1);
        }
      }
      if (blinkHide) return;
      // ----- pernas -----
      const groundY = Math.round(y + 6);
      const sx = this.sx * (1 - 0.15 * vzK), sy = this.sy;
      const bodyH = 9 * sy, bodyW = 10 * sx;
      const bottom = y + 3.5; // base visual do corpo
      g.lineStyle(1, COL.out, 1);
      for (const side of [-1, 1]) {
        const hx = x + side * 2.5 * sx;
        let fx, fy;
        if (b.grounded) {
          const ph = this.walkPh + (side > 0 ? Math.PI : 0);
          fx = hx + Math.sin(ph) * 2.2 * f;
          fy = groundY - Math.max(0, -Math.cos(ph)) * 1.6;
        } else {
          fx = hx + side * (b.vy < 0 ? 0.5 : 1.5);
          fy = bottom + (b.vy < 0 ? 1.5 : 3);
        }
        g.lineBetween(Math.round(hx), Math.round(bottom), Math.round(fx), Math.round(fy));
        g.fillStyle(COL.out, 1);
        g.fillRect(Math.round(fx) - (side < 0 ? 1 : 0), Math.round(fy), 2, 1);
      }
      // ----- corpo (quadrado com squash e rotação) -----
      const cx = x, cy = bottom - bodyH / 2;
      const rotV = this.rot + (this.cling ? -this.cling * 0.16 : 0);
      const c = Math.cos(rotV), s = Math.sin(rotV);
      const hw = bodyW / 2, hh = bodyH / 2;
      const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([lx, ly]) => [cx + lx * c - ly * s, cy + lx * s + ly * c]);
      const path = (ox, oy) => {
        g.beginPath(); g.moveTo(P[0][0] + ox, P[0][1] + oy);
        for (let i = 1; i < 4; i++) g.lineTo(P[i][0] + ox, P[i][1] + oy);
        g.closePath(); g.fillPath();
      };
      g.fillStyle(COL.out, 1);
      path(-1, 0); path(1, 0); path(0, -1); path(0, 1);
      const flash = this.flashT > 0;
      const heal = this.focusing ? 0.4 + 0.4 * Math.sin(t * 20) : 0;
      g.fillStyle(flash ? 0xffffff : M.mix(COL.body, 0xffffff, heal), 1);
      path(0, 0);
      if (!flash) {
        // sombra embaixo/direita e brilho em cima/esquerda (luz vindo de cima-esquerda)
        g.lineStyle(1, COL.shade, 1);
        g.lineBetween(P[3][0] + 1, P[3][1] - 1, P[2][0] - 1, P[2][1] - 1);
        g.lineBetween(P[1][0] - 1, P[1][1] + 1, P[2][0] - 1, P[2][1] - 1);
        g.lineStyle(1, COL.light, 1);
        g.lineBetween(P[0][0] + 1, P[0][1] + 1, P[1][0] - 2, P[1][1] + 1);
        // rosto
        const lx = this.lookX, ly = this.lookY;
        const face = (u, v) => [cx + u * c - v * s, cy + u * s + v * c];
        const eyeY = -1.2 + ly * 0.8;
        for (const side of [-1, 1]) {
          const [ex, ey] = face(side * 2.3 + lx * 0.9, eyeY);
          if (this.blink > 0 || this.focusing) {
            g.fillStyle(COL.out, 1); g.fillRect(Math.round(ex - 1), Math.round(ey), 2, 1);
          } else if (this.hurtT > 0) {
            g.fillStyle(COL.out, 1); g.fillRect(Math.round(ex - 1), Math.round(ey - 1), 1, 1); g.fillRect(Math.round(ex), Math.round(ey), 1, 1); g.fillRect(Math.round(ex - 1), Math.round(ey + 1), 1, 1); g.fillRect(Math.round(ex + 1), Math.round(ey - 1), 1, 1); g.fillRect(Math.round(ex + 1), Math.round(ey + 1), 1, 1);
          } else {
            g.fillStyle(COL.eye, 1); g.fillRect(Math.round(ex - 1), Math.round(ey - 1), 2, 3);
            g.fillStyle(COL.out, 1); g.fillRect(Math.round(ex - 0.5 + lx * 0.5), Math.round(ey + ly * 0.6), 1, 2);
          }
        }
        const [mx2, my2] = face(lx * 0.8, 2.4);
        g.fillStyle(COL.out, 1);
        if (this.hurtT > 0 || this.atkT > 0.15) g.fillRect(Math.round(mx2 - 1), Math.round(my2 - 0.5), 2, 2);
        else g.fillRect(Math.round(mx2 - 1), Math.round(my2), 2, 1);
        g.fillStyle(COL.cheek, 1);
        const [ckx, cky] = face(-3.4 + lx * 0.6, 1.4), [ckx2, cky2] = face(3.4 + lx * 0.6, 1.4);
        g.fillRect(Math.round(ckx), Math.round(cky), 1, 1); g.fillRect(Math.round(ckx2), Math.round(cky2), 1, 1);
      }
      // ----- arco do golpe -----
      if (this.atkT > 0) {
        const el = K.ATK_T - this.atkT;
        const a = 1 - el / K.ATK_T;
        if (el < 0.16) {
          const r = 15;
          let ccx = x, ccy = y, a0, a1;
          if (this.atkDir === 'side') { ccx = x + f * 4; a0 = f > 0 ? -1.2 : Math.PI + 1.2; a1 = f > 0 ? 1.2 : Math.PI - 1.2; }
          else if (this.atkDir === 'up') { ccy = y - 3; a0 = -Math.PI / 2 - 1.2; a1 = -Math.PI / 2 + 1.2; }
          else { ccy = y + 3; a0 = Math.PI / 2 - 1.2; a1 = Math.PI / 2 + 1.2; }
          if (this.atkFlip) { const tt = a0; a0 = a1; a1 = tt; }
          const prog = Math.min(1, el / 0.07);
          const am = a0 + (a1 - a0) * prog;
          g.lineStyle(3, 0xffffff, a);
          g.beginPath(); g.arc(ccx, ccy, r, Math.min(a0, am), Math.max(a0, am)); g.strokePath();
          g.lineStyle(1, 0x9fe8ff, a);
          g.beginPath(); g.arc(ccx, ccy, r - 3, Math.min(a0, am), Math.max(a0, am)); g.strokePath();
        }
      }
      // carga do foco
      if (this.focusing) {
        g.lineStyle(1, 0xffffff, 0.8);
        g.beginPath(); g.arc(x, y - 1, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.focusT / (K.FOCUS_T * this.mods.focusT))); g.strokePath();
      }
    }
  }

  Player.K = K;
  PL.Player = Player;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
