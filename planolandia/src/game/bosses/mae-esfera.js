/* Mãe-Esfera — guardiã do Bosque. Uma esfera enorme que se move em 3D: para o Quadrado, um círculo
 * que nasce de um ponto, cresce, encolhe e some. O olho fica no equador: só aparece quando o plano passa
 * pelo meio dela, onde ela é maior. Na metade da vida, divide-se em duas Filhas. Homenagem a Flatland:
 * foi ela quem um dia atravessou o chão de Planolândia como um círculo que crescia. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M;

  PL.MATS.esfera = { fill: 0xd96aa0, top: 0xf29bc4, dark: 0x9a3f6e, hi: 0xffd2e8, out: 0x3a1028, speck: 0xffffff, deco: null };

  class MaeEsfera extends PL.Enemy {
    constructor(G, d) {
      super(G, d);
      this.daughter = !!d.daughter;
      this.R = d.R || (this.daughter ? 40 : 64);
      this.hp = this.maxHp = this.daughter ? 12 : 36;
      this.boss = !this.daughter;
      this.drop = this.daughter ? 6 : 0;
      this.mat = 'esfera';
      this.FY = d.floorY;
      this.zMid = G.room.d / 2;
      this.x = d.x; this.y = this.FY - this.R; this.z = this.daughter ? d.z : this.zMid + 220;
      this.vx = 0; this.vy = 0;
      this.prim = G3.sphere(this.x, this.y, this.z, this.R);
      this.state = this.daughter ? 'idle' : 'sleep'; this.stT = 0;
      this.nextAtk = this.daughter ? 0.8 + (d.delay || 0) : 1.4;
      this.invuln = !this.daughter;
      this.ruler = [];
      this.eyeVis = false;
      this.blinkT = 0;
      this.flat = 1;
      this.phase = 1;
      this.speed = this.daughter ? 1.25 : 1;
      this.reward = {
        flag: 'boss_mae', item: 'garra', id: 'hab_garra', deco: 'disco', msg: 'A Mãe-Esfera murchou num disco.', speaker: 'Mãe-Esfera',
        lines: [
          'Você… também é lá de baixo?',
          'Eu visitei um mundo chato, uma vez. Atravessei o chão deles como um círculo que nascia de um ponto, crescia e sumia. O pobre quadrado de lá nunca entendeu.',
          'Depois veio a Coisa de Fora e fez comigo o que eu tinha feito com ele. Agora sou eu quem não entende.',
          'Leve esta quina. Agarre-se ao que puder… e feche a Ruptura.',
        ],
      };
    }
    zRange() { return [this.z - this.R, this.z + this.R]; }
    sliceAt(z, out) {
      if (this.state === 'sleep' || this.state === 'split' || this.state === 'dead') return false;
      const p = this.prim;
      p.cx = this.x; p.cy = this.y; p.cz = this.z; p.r = this.R;
      p.zMin = this.z - this.R; p.zMax = this.z + this.R;
      return G3.sliceInto(p, z, out);
    }
    updateSlice(pz, eco) {
      super.updateSlice(pz, eco);
      this.eyeVis = this.visible && Math.abs(pz - this.z) < 12 && this.state !== 'dying';
    }
    set(st) { this.state = st; this.stT = 0; }

    pick(G) {
      const opts = this.daughter ? ['pass', 'bounce', 'pass'] : ['pass', 'bounce', 'spawn', 'pass', 'bounce'];
      let a = opts[(Math.random() * opts.length) | 0];
      if (a === this.last) a = opts[(Math.random() * opts.length) | 0];
      this.last = a;
      if (a === 'pass') { this.set('passOut'); this.side = G.player.z > this.zMid ? -1 : 1; }
      else if (a === 'bounce') { this.set('bounceAim'); this.bz = G.player.z; this.vx = (G.player.x < this.x ? -1 : 1) * 160 * this.speed; }
      else this.set('spawn');
    }

    update(dt, G) {
      const P = G.player, room = G.room;
      this.t += dt; this.stT += dt;
      this.flashT = Math.max(0, this.flashT - dt);
      this.blinkT -= dt;
      this.ruler.length = 0;
      const floorY = this.FY - this.R;
      switch (this.state) {
        case 'sleep':
          if (!G.save.flags.boss_mae && P.x > this.def.trigger) {
            this.set('intro');
            this.z = P.z + this.R + 40;
            this.x = this.def.x;
            G.bossStart(this, 'MÃE-ESFERA', 'a visitante que caiu do alto', 'boss2');
          }
          break;
        case 'intro':
          // um ponto no chão que cresce até virar círculo
          this.z = M.damp(this.z, P.z + 4, 1.2, dt);
          if (this.stT > 3) { this.set('idle'); this.invuln = false; }
          break;
        case 'idle': {
          const tx = M.clamp(P.x + Math.sin(this.t * 0.7) * 90, this.R + 20, room.w - this.R - 20);
          this.x = M.damp(this.x, tx, 1.1 * this.speed, dt);
          this.y = floorY - Math.abs(Math.sin(this.t * 3)) * 10;
          this.z = M.damp(this.z, P.z + Math.sin(this.t * 0.9) * 22, 1.0, dt);
          this.nextAtk -= dt * this.speed;
          if (this.nextAtk <= 0) this.pick(G);
          break;
        }
        case 'passOut':
          this.z = M.damp(this.z, this.zMid + this.side * (this.R + 120), 3, dt);
          this.x = M.damp(this.x, P.x, 2, dt);
          this.y = M.damp(this.y, floorY, 6, dt);
          if (this.stT > 1) { this.set('passAim'); this.lockX = M.clamp(P.x, this.R, room.w - this.R); }
          break;
        case 'passAim':
          this.x = M.damp(this.x, this.lockX, 6, dt);
          this.ruler.push({ z: this.z, color: 0xe0475b });
          if (this.stT > 0.7 / this.speed) { this.set('pass'); G.sfx('ram'); }
          break;
        case 'pass':
          this.z -= this.side * 250 * this.speed * dt;
          this.ruler.push({ z: this.z, color: 0xe0475b });
          if ((this.side > 0 && this.z < this.zMid - this.R - 120) || (this.side < 0 && this.z > this.zMid + this.R + 120)) this.set('return');
          break;
        case 'return':
          this.z = M.damp(this.z, P.z + 30, 2, dt);
          if (this.stT > 1.1) { this.set('idle'); this.nextAtk = 1.2; }
          break;
        case 'bounceAim':
          this.z = M.damp(this.z, this.bz, 4, dt);
          this.y = floorY + Math.sin(this.stT * 30) * 2;
          if (this.stT > 0.6) { this.set('bounce'); this.vy = -380; G.sfx('boing'); }
          break;
        case 'bounce':
          this.vy += 900 * dt;
          this.x += this.vx * dt; this.y += this.vy * dt;
          if (this.y > floorY) { this.y = floorY; this.vy = -360; G.shake(3, 0.15); G.sfx('thud'); }
          if (this.x < this.R + 4 || this.x > room.w - this.R - 4) { this.vx = -this.vx; this.x = M.clamp(this.x, this.R + 4, room.w - this.R - 4); }
          if (this.stT > 3.2) { this.y = Math.min(this.y, floorY); this.set('idle'); this.nextAtk = 1; }
          break;
        case 'spawn':
          this.y = floorY - Math.sin(this.stT * 8) * 6;
          if (this.stT > 0.8) {
            const n = G.ents.filter((e) => e.esferula && e.alive).length;
            for (let i = 0; i < Math.min(4, 6 - n); i++) {
              const e = G.spawnEnemy('esferoide', { x: this.x + (i - 1.5) * 24, y: this.y - this.R, z: P.z + (i % 2 ? 1 : -1) * (30 + i * 8), r: 7, hp: 1, za: 8 });
              e.esferula = true; e.drop = 1; e.mat = 'esfera';
            }
            G.sfx('spore');
            this.set('idle'); this.nextAtk = 1.6;
          }
          break;
        case 'split': {
          const kids = G.ents.filter((e) => e.daughter && e.alive);
          for (const k of kids) if (k.state !== 'dying') this.ruler.push({ z: k.z, color: 0xf29bc4 });
          if (!kids.length) this.set('dying');
          break;
        }
        case 'dying':
          this.contact = 0;
          this.flat = Math.max(0.08, 1 - this.stT / 1.6);
          if (!this.daughter && this.stT < 0.1) { this.x = this.def.x; this.z = P.z; this.y = floorY; }
          if (this.stT > 1.8) this.finish(G);
          break;
      }
      if (this.state !== 'dying') this.flat = 1;
    }

    hit(G, dmg, dirX, dirY, info) {
      if (!this.alive || this.invuln || this.state === 'dying' || this.state === 'split') return false;
      const d = this.eyeVis ? 3 : 1;
      this.hp -= d;
      this.flashT = 0.08;
      if (this.eyeVis) { G.sfx('core'); G.hitstop = Math.max(G.hitstop, 0.08); G.fx.ring(this.s.cx, this.s.cy, G.player.z, 4, 24, 0.3, 0xffffff, 2); this.blinkT = 0.4; }
      else G.sfx('hit');
      if (!this.daughter && this.phase === 1 && this.hp <= this.maxHp / 2) this.split(G);
      else if (this.hp <= 0) {
        this.hp = 0;
        this.invuln = true;
        this.set('dying');
        G.sfx('roar');
        if (this.daughter) G.toast('Uma das Filhas murcha.');
      }
      return true;
    }

    split(G) {
      this.phase = 2;
      this.set('split');
      this.invuln = true;
      G.sfx('unfold'); G.shake(5, 0.4);
      G.fx.burst(this.x, this.y, G.player.z, 24, { speed: 200, color: [0xd96aa0, 0xf29bc4, 0xffffff], life: 0.7, grav: 200, kind: 'shard' });
      G.toast('A Mãe-Esfera se divide em duas!');
      for (const s of [-1, 1]) {
        const k = G.spawnEnemy('maeEsfera', { x: M.clamp(this.x + s * 70, 60, G.room.w - 60), floorY: this.FY, z: G.player.z + s * 30, daughter: true, delay: s > 0 ? 1.2 : 0 });
        k.mat = 'esfera';
      }
    }

    finish(G) {
      if (this.daughter) {
        this.alive = false;
        G.fx.burst(this.x, this.FY - 4, G.player.z, 12, { speed: 120, color: [0xf29bc4, 0xffd2e8], life: 0.5, grav: 300 });
        G.dropVerts(this.x, this.FY - 10, this.drop);
        return;
      }
      this.state = 'dead';
      this.alive = false;
      this.visible = false;
      G.bossDefeated(this, { x: this.x, y: this.FY });
    }

    draw(g, G, t) {
      if (this.state === 'passAim' || this.state === 'pass') {
        const k = 0.5 + 0.5 * Math.sin(t * 20);
        g.lineStyle(1, 0xe0475b, 0.5 + 0.5 * k);
        g.strokeEllipse(Math.round(this.x), this.FY - 1, this.R * 1.4, 8);
      }
      this.drawGhost(g, G);
      if (!this.visible) return;
      const s = this.s, r = s.r;
      const w = r * 2, h = r * 2 * this.flat;
      const cx = Math.round(s.cx), cy = Math.round(this.state === 'dying' ? this.FY - h / 2 : s.cy);
      const mat = PL.MATS.esfera;
      g.fillStyle(mat.out, 1); g.fillEllipse(cx, cy, w + 2, h + 2);
      g.fillStyle(this.flashT > 0 ? 0xffffff : (this.daughter ? 0xe887b6 : mat.fill), 1); g.fillEllipse(cx, cy, w, h);
      if (this.flashT > 0) return;
      // sombreamento esférico em faixas (pixel art)
      g.fillStyle(mat.dark, 1); g.fillEllipse(cx + w * 0.1, cy + h * 0.1, w * 0.82, h * 0.82);
      g.fillStyle(this.daughter ? 0xe887b6 : mat.fill, 1); g.fillEllipse(cx - w * 0.05, cy - h * 0.05, w * 0.8, h * 0.8);
      g.fillStyle(mat.top, 1); g.fillEllipse(cx - w * 0.2, cy - h * 0.22, w * 0.32, h * 0.2);
      g.fillStyle(mat.hi, 1); g.fillRect(Math.round(cx - w * 0.26), Math.round(cy - h * 0.3), Math.max(1, Math.round(w * 0.08)), 1);
      // faixas de latitude: cordas horizontais que se mexem conforme a profundidade
      g.lineStyle(1, mat.dark, 0.7);
      for (const f of [-0.55, 0.55]) {
        const yy = cy + f * h * 0.5;
        const hw = Math.sqrt(Math.max(0, 1 - f * f * 0.25)) * w * 0.45;
        g.lineBetween(cx - hw, yy, cx + hw, yy);
      }
      // o olho do equador
      if (this.eyeVis) {
        const P = G.player;
        const ew = Math.min(22, r * 0.5), eh = this.blinkT > 0 ? 2 : Math.min(14, r * 0.32);
        g.fillStyle(mat.out, 1); g.fillEllipse(cx, cy, ew + 3, eh + 3);
        g.fillStyle(0xffffff, 1); g.fillEllipse(cx, cy, ew, eh);
        if (this.blinkT <= 0) {
          const px = M.clamp((P.x - cx) * 0.05, -ew * 0.25, ew * 0.25), py = M.clamp((P.y - cy) * 0.05, -eh * 0.2, eh * 0.2);
          g.fillStyle(0x3a1028, 1); g.fillCircle(Math.round(cx + px), Math.round(cy + py), Math.max(2, eh * 0.35));
          g.fillStyle(0xffffff, 1); g.fillRect(Math.round(cx + px - 1), Math.round(cy + py - 2), 1, 1);
        }
      } else if (r > this.R * 0.5 && this.state !== 'dying') {
        // pálpebra fechada: o olho está mais para dentro ou para fora da tela
        g.fillStyle(mat.out, 0.6); g.fillRect(cx - 4, cy, 8, 1);
      }
    }
  }

  PL.ENEMIES.maeEsfera = MaeEsfera;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
