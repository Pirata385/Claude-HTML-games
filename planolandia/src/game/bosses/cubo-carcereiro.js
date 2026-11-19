/* Cubo Carcereiro — guardião da Borda. Um cubo gigante com rotação 3D: a forma do corte anuncia o golpe.
 * Quadrado → esmaga. Hexágono → gira cortando (fuja pela profundidade). Triângulo crescendo → investida pela profundidade.
 * O Núcleo (ponto fraco) só aparece quando o seu plano o atravessa. Ao morrer, planifica-se em 6 quadrados. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M, C2 = PL.C2;

  PL.MATS.carcereiro = { fill: 0x5a4b8a, top: 0x8270c4, dark: 0x3a2f63, hi: 0xc8b8ff, out: 0x120c22, speck: 0x6b5b9e, deco: null };

  // ---------- quatérnios mínimos ----------
  const Q = {
    id: () => [1, 0, 0, 0],
    axis(x, y, z, a) { const l = Math.hypot(x, y, z) || 1, s = Math.sin(a / 2); return [Math.cos(a / 2), (x / l) * s, (y / l) * s, (z / l) * s]; },
    mul(a, b) {
      return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
      ];
    },
    slerp(a, b, t) {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
      let bb = b;
      if (d < 0) { d = -d; bb = b.map((v) => -v); }
      if (d > 0.9995) { const r = a.map((v, i) => v + (bb[i] - v) * t); const l = Math.hypot(...r); return r.map((v) => v / l); }
      const th = Math.acos(d), s = Math.sin(th);
      const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      return a.map((v, i) => v * wa + bb[i] * wb);
    },
    mat(q) {
      const [w, x, y, z] = q;
      return [
        1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
      ];
    },
  };
  // diagonal principal (1,1,1) → eixo z: o corte central vira hexágono regular
  const Q_DIAG = Q.axis(1, -1, 0, Math.acos(1 / Math.sqrt(3)));

  class CuboCarcereiro extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.size = 64;
      this.hp = this.maxHp = 40;
      this.drop = 0;
      this.mat = 'carcereiro';
      this.boss = true;
      this.contact = 1;
      this.FY = d.floorY;
      this.zMid = G.room.d / 2;
      this.x = d.x; this.y = this.FY - 150; this.z = this.zMid;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.q = Q.id(); this.qTarget = Q.id();
      this.spin = 0; this.spinV = 0; this.wob = 0;
      this.base = G3.cuboidVerts(this.size, this.size, this.size);
      this.prim = G3.cuboid(this.x, this.y, this.z, this.size, this.size, this.size);
      this.coreR = 11;
      this.coreLocal = [0, 14, 18];
      this.core = [0, 0, 0];
      this.coreS = G3.newShape();
      this.coreVis = false;
      this.coreHits = 0;
      this.state = 'sleep'; this.stT = 0;
      this.phase = 1;
      this.waves = [];
      this.waveS = G3.newShape();
      this.nextAtk = 0;
      this.lockX = 0; this.ramDir = 1;
      this.unfold = 0;
      this.invuln = true;
      this.ruler = [];
      this.tileWarn = 0;
      this.minionT = 0;
      this.coreFlash = 0;
      this.reward = { flag: 'boss_cubo', item: 'dash', id: 'hab_dash', deco: 'rede', msg: 'O Cubo Carcereiro foi planificado.' };
    }

    zRange() { return [this.prim.zMin, this.prim.zMax]; }
    sliceAt(z, out) { return this.state === 'dead' ? false : G3.sliceInto(this.prim, z, out); }

    sync() {
      const qs = Q.mul(Q.axis(0, 0, 1, this.spin), Q.mul(this.q, Q.axis(0, 1, 0, this.wob)));
      const m = Q.mat(qs);
      G3.setHull(this.prim, this.base, m, this.x, this.y, this.z);
      const L = this.coreLocal;
      this.core[0] = this.x + m[0] * L[0] + m[1] * L[1] + m[2] * L[2];
      this.core[1] = this.y + m[3] * L[0] + m[4] * L[1] + m[5] * L[2];
      this.core[2] = this.z + m[6] * L[0] + m[7] * L[1] + m[8] * L[2];
    }

    updateSlice(pz, eco) {
      super.updateSlice(pz, eco);
      const dz = this.core[2] - pz, rr = this.coreR * this.coreR - dz * dz;
      this.coreVis = this.visible && rr > 4;
      if (this.coreVis) G3.setCircle(this.coreS, this.core[0], this.core[1], Math.sqrt(rr));
    }

    set(st) { this.state = st; this.stT = 0; }

    start(G) {
      this.set('intro');
      this.invuln = true;
      G.bossStart(this, 'CUBO CARCEREIRO', 'aquele que dobra prisioneiros');
    }

    pickAttack(G) {
      const P = G.player;
      const r = Math.random();
      const opts = this.phase === 1 ? ['slam', 'slam', 'spin', 'ram'] : ['slam', 'spin', 'ram', 'ram', 'spin'];
      let a = opts[(r * opts.length) | 0];
      if (a === this.last && Math.random() < 0.6) a = opts[(Math.random() * opts.length) | 0];
      this.last = a;
      if (a === 'slam') { this.set('slamRise'); this.qTarget = Q.id(); }
      else if (a === 'spin') { this.set('spinPrep'); this.qTarget = Q_DIAG; this.ramDir = P.x < this.x ? -1 : 1; }
      else {
        this.set('ramOut'); this.qTarget = Q_DIAG;
        this.ramSide = P.z > this.zMid ? -1 : 1;
      }
    }

    update(dt, G) {
      const P = G.player, room = G.room;
      this.t += dt; this.stT += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.coreFlash = Math.max(0, this.coreFlash - dt);
      const fast = this.phase === 2 ? 1.3 : 1;
      const hoverY = this.FY - 72;
      const qk = 1 - Math.exp(-dt * 5);
      this.q = Q.slerp(this.q, this.qTarget, qk);
      this.spinV = M.damp(this.spinV, 0, 2, dt);
      this.spin += this.spinV * dt;
      const spinning = this.state === 'spinPrep' || this.state === 'spin' || this.state === 'ramOut' || this.state === 'ramAim' || this.state === 'ram' || this.state === 'intro';
      if (!spinning && Math.abs(this.spinV) < 1.5) {
        const flat = Math.round(this.spin / (Math.PI / 2)) * (Math.PI / 2);
        this.spinV = 0;
        this.spin = M.damp(this.spin, flat, 6, dt);
      }
      this.wob = Math.sin(this.t * 1.3) * 0.12;
      this.ruler.length = 0;
      // atordoado no chão: janela de dano livre (não fere por contato)
      this.contact = this.state === 'stun' ? 0 : 1;

      switch (this.state) {
        case 'sleep':
          this.y = M.damp(this.y, this.FY - 160, 3, dt);
          this.z = this.zMid + 140;
          if (!G.save.flags.boss_cubo && P.x > this.def.trigger) this.start(G);
          break;
        case 'intro':
          // desce pela profundidade até o plano do Quadrado
          this.z = M.damp(this.z, P.z + 6, 2.2, dt);
          this.y = M.damp(this.y, hoverY, 3, dt);
          this.x = M.damp(this.x, this.def.x, 3, dt);
          this.spinV = 2;
          if (this.stT > 2.4) { this.set('idle'); this.invuln = false; this.nextAtk = 1.2; }
          break;
        case 'idle': {
          this.qTarget = Q.id();
          const tx = M.clamp(P.x + Math.sin(this.t * 0.9) * 60, 80, room.w - 80);
          this.x = M.damp(this.x, tx, 1.6, dt);
          this.y = M.damp(this.y, hoverY + Math.sin(this.t * 2) * 6, 3, dt);
          // fica perto do plano do Quadrado, mas com o núcleo um pouco fora: é preciso procurá-lo
          this.z = M.damp(this.z, P.z + Math.sin(this.t * 0.7) * 16, 1.2, dt);
          this.nextAtk -= dt * fast;
          if (this.nextAtk <= 0) this.pickAttack(G);
          break;
        }
        case 'slamRise':
          this.x = M.damp(this.x, P.x, 4, dt);
          this.y = M.damp(this.y, this.FY - 150, 4, dt);
          this.z = M.damp(this.z, P.z, 2, dt);
          if (this.stT > 0.8 / fast) { this.set('slamFall'); this.vy = 0; }
          break;
        case 'slamFall':
          this.vy += 1600 * dt;
          this.y += this.vy * dt;
          if (this.y >= this.FY - this.size / 2) {
            this.y = this.FY - this.size / 2;
            this.set('slamLand');
            G.shake(5, 0.35); G.sfx('slam');
            G.fx.burst(this.x, this.FY - 2, P.z, 18, { speed: 140, color: [0xe8dcc0, 0xc7b693, 0x8270c4], life: 0.5, grav: 300, ang0: -Math.PI / 2, spread: 2.6 });
            this.waves.push({ x: this.x - 34, dir: -1, z: this.z, t: 0 }, { x: this.x + 34, dir: 1, z: this.z, t: 0 });
            if (this.phase === 2) this.collapseFloor(G);
          }
          break;
        case 'slamLand':
          if (this.stT > 1.0 / fast) { this.set('idle'); this.nextAtk = 1.1; }
          break;
        case 'spinPrep': {
          const prep = 1.1 / fast;
          this.x = M.damp(this.x, this.ramDir > 0 ? 90 : room.w - 90, 3, dt);
          // só desce quando já está longe do Quadrado (não cai em cima dele)
          if (Math.abs(this.x - P.x) > 70 || this.stT > prep * 0.7) this.y = M.damp(this.y, this.FY - 48, 3, dt);
          // segue a profundidade do Quadrado e trava antes de disparar: o giro fica visível e desviável
          if (this.stT < prep - 0.4) this.z = M.damp(this.z, P.z, 3, dt);
          else this.flashT = Math.sin(this.stT * 40) > 0.6 ? 0.03 : this.flashT;
          this.spinV = 9;
          if (Math.random() < 0.4) G.fx.spawn({ x: this.x + (Math.random() - 0.5) * 70, y: this.FY - 2, z: P.z, vx: (Math.random() - 0.5) * 80, vy: -60, life: 0.4, color: 0xfff1a8, grav: 200 });
          if (this.stT > prep) { this.set('spin'); G.sfx('spin'); }
          break;
        }
        case 'spin':
          this.spinV = 14;
          this.x += this.ramDir * 165 * fast * dt;
          if (Math.random() < 0.6) G.fx.spawn({ x: this.x - this.ramDir * 30, y: this.FY - 2, z: this.z, vx: -this.ramDir * 90, vy: -50, life: 0.35, color: 0xfff1a8, grav: 220 });
          if ((this.ramDir > 0 && this.x > room.w - 70) || (this.ramDir < 0 && this.x < 70)) { this.set('idle'); this.nextAtk = 1.3; G.shake(3, 0.2); G.sfx('thud'); }
          break;
        case 'ramOut':
          // sai do plano para um lado da profundidade
          this.z = M.damp(this.z, this.zMid + this.ramSide * 150, 3, dt);
          if (Math.abs(this.z - P.z) > 70) {
            this.y = M.damp(this.y, this.FY - 44, 3, dt);
            this.x = M.damp(this.x, P.x, 2.5, dt);
          }
          this.spinV = 3;
          if (this.stT > 1.0) { this.set('ramAim'); this.lockX = P.x; }
          break;
        case 'ramAim':
          this.x = M.damp(this.x, this.lockX, 6, dt);
          this.ruler.push({ z: this.z, color: 0xe0475b });
          if (this.stT > 0.75 / fast) { this.set('ram'); G.sfx('ram'); }
          break;
        case 'ram':
          this.z -= this.ramSide * 270 * fast * dt;
          this.spinV = 6;
          this.ruler.push({ z: this.z, color: 0xe0475b });
          if ((this.ramSide > 0 && this.z < this.zMid - 150) || (this.ramSide < 0 && this.z > this.zMid + 150)) { this.set('return'); }
          break;
        case 'return':
          this.qTarget = Q.id();
          this.y = M.damp(this.y, hoverY, 5, dt);
          if (Math.abs(this.y - hoverY) < 8) this.z = M.damp(this.z, P.z, 2.5, dt);
          if (this.stT > 1.2) { this.set('idle'); this.nextAtk = 0.9; }
          break;
        case 'stun':
          // atordoado: cai sentado com o núcleo virado para o plano do Quadrado
          this.qTarget = Q.id();
          this.spinV = 0;
          this.y = M.damp(this.y, this.FY - this.size / 2, 8, dt);
          this.z = M.damp(this.z, P.z - this.coreLocal[2], 5, dt);
          if (Math.random() < 0.2) G.fx.spawn({ x: this.x + (Math.random() - 0.5) * 40, y: this.y - 34, z: P.z, vy: -40, life: 0.6, color: 0xfff1a8, grav: -30 });
          if (this.stT > 2.4) { this.set('idle'); this.nextAtk = 0.6; }
          break;
        case 'dying':
          this.spinV = 0;
          this.qTarget = Q.id();
          this.y = M.damp(this.y, this.FY - this.size / 2, 3, dt);
          this.z = M.damp(this.z, P.z, 3, dt);
          if (Math.random() < 0.35) {
            G.fx.burst(this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60, P.z, 5, { speed: 120, color: [0xc8b8ff, 0x8270c4, 0xffffff], life: 0.5, grav: 200, kind: 'shard' });
            G.sfx('hit');
          }
          this.flashT = Math.random() < 0.3 ? 0.05 : this.flashT;
          if (this.stT > 2.2) { this.set('unfold'); G.shake(6, 0.5); G.sfx('unfold'); }
          break;
        case 'unfold':
          this.unfold = Math.min(1, this.stT / 1.4);
          if (this.stT > 2.2) this.finish(G);
          break;
      }
      // ondas de choque no chão
      for (let i = this.waves.length - 1; i >= 0; i--) {
        const w = this.waves[i];
        w.t += dt;
        w.x += w.dir * 230 * dt;
        if (w.t > 1.6 || w.x < 20 || w.x > room.w - 20) this.waves.splice(i, 1);
      }
      if (this.phase === 1 && this.hp <= this.maxHp / 2 && this.hp > 0 && this.state !== 'dying' && this.state !== 'unfold' && this.state !== 'dead') {
        this.phase = 2;
        G.sfx('roar'); G.shake(4, 0.4);
        G.toast('O Carcereiro range: os ladrilhos do chão se soltam!');
      }
      this.updateTiles(dt, G);
      if (this.phase === 2 && this.state === 'idle') {
        this.minionT -= dt;
        if (this.minionT <= 0) {
          this.minionT = 9;
          if (G.ents.filter((e) => e.minion && e.alive).length < 2) {
            const m = G.spawnEnemy('cuboSentinela', { x: M.clamp(P.x + (Math.random() < 0.5 ? -120 : 120), 60, room.w - 60), y: this.FY - 30, z: P.z, size: 14, hp: 3, x0: 40, x1: room.w - 40 });
            m.minion = true; m.drop = 1;
          }
        }
      }
      this.sync();
    }

    // fase 2: faixas de profundidade do chão avisam (piscam) e caem por alguns segundos
    collapseFloor(G) {
      const tiles = G.room.prims.filter((p) => p.tile);
      if (!tiles.length) return;
      const bands = [...new Set(tiles.map((p) => p.band))];
      const P = G.player;
      const mine = tiles.find((p) => P.z >= p.zMin && P.z <= p.zMax);
      const pickA = mine ? mine.band : bands[0];
      let pickB = bands[(Math.random() * bands.length) | 0];
      if (pickB === pickA) pickB = bands[(bands.indexOf(pickA) + 2) % bands.length];
      for (const p of tiles) if (p.band === pickA || p.band === pickB) { p.warnT = 1.1; p.dyn = true; }
      G.room.touch();
      G.sfx('crack');
    }
    updateTiles(dt, G) {
      let changed = false;
      for (const p of G.room.prims) {
        if (!p.tile) continue;
        if (p.warnT > 0) {
          p.warnT -= dt;
          p.flashT = Math.sin(p.warnT * 30) > 0 ? 1 : 0;
          this.ruler.push({ z: (p.zMin + p.zMax) / 2, color: 0xffa65c, band: [p.zMin, p.zMax] });
          if (p.warnT <= 0) { p.fallT = 3.4; p.flashT = 0; }
        } else if (p.fallT > 0) {
          p.fallT -= dt;
          const drop = Math.min(200, (3.4 - p.fallT) * 300);
          const y0 = p.baseY + drop;
          p.yMin = y0; p.yMax = y0 + p.h0;
          if (drop > 60) p.off = true;
          if (p.fallT <= 0) { p.off = false; p.dyn = false; p.yMin = p.baseY; p.yMax = p.baseY + p.h0; changed = true; }
        }
      }
      if (changed) G.room.touch();
    }

    // perigos extras (ondas de choque) para o teste de contato do jogo
    hazards(pz, list) {
      for (const w of this.waves) {
        if (Math.abs(pz - w.z) > 44) continue;
        const s = list.pool[list.n] || (list.pool[list.n] = G3.newShape());
        G3.setRect(s, w.x - 5, this.FY - 13, w.x + 5, this.FY);
        list.n++;
      }
    }

    hit(G, dmg, dirX, dirY, info) {
      if (!this.alive || this.invuln || this.state === 'dying' || this.state === 'unfold') return false;
      const onCore = this.coreVis && info && info.hb && C2.overlap(info.hb, this.coreS);
      const d = onCore ? 4 : 1;
      this.hp -= d;
      this.flashT = 0.08;
      if (onCore) {
        this.coreFlash = 0.2;
        G.hitstop = Math.max(G.hitstop, 0.09);
        G.fx.ring(this.coreS.cx, this.coreS.cy, G.player.z, 3, 20, 0.3, 0xff5fa2, 2);
        G.sfx('core');
        if (this.state !== 'stun') {
          this.coreHits++;
          if (this.coreHits >= 4) { this.coreHits = 0; this.set('stun'); G.sfx('thud'); G.shake(3, 0.2); this.waves.length = 0; }
        }
      } else G.sfx('clank');
      if (this.hp <= 0) {
        this.hp = 0;
        this.set('dying');
        this.invuln = true;
        this.waves.length = 0;
        G.bossDying(this);
      }
      return true;
    }

    finish(G) {
      this.state = 'dead';
      this.alive = false;
      this.visible = false;
      G.bossDefeated(this, { x: this.x, y: this.FY });
    }

    draw(g, G, t) {
      const pz = G.player.z;
      // aviso no chão durante a investida pela profundidade: a "sombra" do cubo
      if (this.state === 'ramAim' || this.state === 'ram') {
        const k = 0.5 + 0.5 * Math.sin(t * 20);
        g.fillStyle(0xe0475b, 0.25 + 0.35 * k);
        g.fillRect(Math.round(this.x - 30), this.FY - 2, 60, 2);
        g.lineStyle(1, 0xe0475b, 0.5 + 0.5 * k);
        g.strokeEllipse(Math.round(this.x), this.FY - 1, 70, 8);
      }
      for (const w of this.waves) {
        if (Math.abs(pz - w.z) > 44) continue;
        const x = Math.round(w.x);
        g.fillStyle(0x120c22, 1); g.fillTriangle(x - 7, this.FY, x + 7, this.FY, x + w.dir * 2, this.FY - 15);
        g.fillStyle(0xc8b8ff, 1); g.fillTriangle(x - 5, this.FY, x + 5, this.FY, x + w.dir * 2, this.FY - 12);
        g.fillStyle(0xffffff, 1); g.fillRect(x + w.dir * 2, this.FY - 11, 1, 4);
      }
      if (this.state === 'unfold' || this.state === 'dead') return this.drawNet(g, t);
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s;
      PL.Slices.drawSolid(g, { mat: 'carcereiro', seed: 9 }, s, pz, { speck: false, deco: false, flash: this.flashT > 0 });
      if (this.flashT > 0) return;
      // núcleo
      if (this.coreVis) {
        const c = this.coreS;
        g.fillStyle(0x120c22, 1); g.fillCircle(c.cx, c.cy, c.r + 1);
        g.fillStyle(this.coreFlash > 0 ? 0xffffff : 0xff5fa2, 1); g.fillCircle(c.cx, c.cy, c.r);
        g.fillStyle(0xffc2dd, 1); g.fillCircle(c.cx - c.r * 0.3, c.cy - c.r * 0.3, c.r * 0.35);
        g.lineStyle(1, 0xff5fa2, 0.5 + 0.4 * Math.sin(t * 10));
        g.strokeCircle(c.cx, c.cy, c.r + 3);
      }
      // rosto no centro do corte (quando há área suficiente)
      const w = s.maxX - s.minX;
      if (w > 26 && !this.coreVis) {
        const cx = Math.round(s.cx), cy = Math.round(s.cy - 4);
        const angry = this.state !== 'idle' && this.state !== 'stun';
        g.fillStyle(0x120c22, 1); g.fillRect(cx - 10, cy - 3, 7, 5); g.fillRect(cx + 3, cy - 3, 7, 5);
        g.fillStyle(this.state === 'stun' ? 0x8270c4 : 0xfff1a8, 1);
        if (this.state === 'stun') { g.fillRect(cx - 9, cy, 5, 1); g.fillRect(cx + 4, cy, 5, 1); }
        else { g.fillRect(cx - 9, cy - 2, 5, 3); g.fillRect(cx + 4, cy - 2, 5, 3); }
        if (angry) { g.fillStyle(0x120c22, 1); g.fillRect(cx - 10, cy - 5, 6, 2); g.fillRect(cx + 4, cy - 5, 6, 2); }
        // boca de grade (é um carcereiro)
        g.fillStyle(0x120c22, 1); g.fillRect(cx - 7, cy + 6, 14, 5);
        g.fillStyle(0x8270c4, 1); for (let i = 0; i < 4; i++) g.fillRect(cx - 6 + i * 4, cy + 7, 1, 3);
      }
    }

    // planificação: a rede de 6 quadrados se abre e deita no chão
    drawNet(g, t) {
      const k = M.easeOut(this.unfold);
      const S = 22;
      const cx = Math.round(this.x), base = this.FY;
      // cruz: centro, cima, baixo, baixo-baixo, esquerda, direita — deitada no chão vira uma faixa
      const cells = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [0, 2]];
      for (const [i, j] of cells) {
        const ox = i * S * k, oy = j * S * k * 0.35;
        const x = cx + ox - S / 2, y = base - 8 - (1 - k) * 40 + oy * (1 - k) - (j === 0 ? 0 : 0);
        const w = S - 2, h = Math.max(3, Math.round(S * (1 - k * 0.8)));
        g.fillStyle(0x120c22, 1); g.fillRect(Math.round(x) - 1, Math.round(base - h) - 1, w + 2, h + 1);
        g.fillStyle(j === 0 && i === 0 ? 0x8270c4 : 0x5a4b8a, 1); g.fillRect(Math.round(x), Math.round(base - h), w, h);
        g.fillStyle(0xc8b8ff, 1); g.fillRect(Math.round(x), Math.round(base - h), w, 1);
      }
      if (this.unfold < 1 && Math.random() < 0.3) this.G.fx.spawn({ x: cx + (Math.random() - 0.5) * 80, y: base - 10, z: this.G.player.z, vy: -50, life: 0.7, color: 0xc8b8ff, grav: -20 });
    }
  }

  PL.ENEMIES.cuboCarcereiro = CuboCarcereiro;
  PL.Quat = Q;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
