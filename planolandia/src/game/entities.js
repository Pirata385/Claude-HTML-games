/* Planolândia — entidades que não são inimigos: Vértices (dinheiro), Pontos Fixos (bancos), placas,
 * itens, portões, o Contorno (onde você morreu), dicas e fendas seladas. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, M = PL.M, Phys = PL.Phys, C2 = PL.C2;
  PL.ENTS = PL.ENTS || {};

  const OUT = 0x2a2140;

  function inBand(G, z, half) { return Math.abs(G.player.z - z) <= half; }
  function ghostAlpha(G, z, half) {
    const d = Math.abs(G.player.z - z) - half;
    const range = G.eco ? 48 : 10;
    return d > 0 && d <= range ? 0.45 * (1 - d / (range + 1)) + 0.15 : 0;
  }

  // ---------- Vértice: moeda que cai dos inimigos ----------
  class Vert {
    constructor(G, d) {
      this.G = G;
      this.b = Phys.body(d.x, d.y, G.player.z, 2, 2);
      this.b.vx = d.vx || 0; this.b.vy = d.vy || 0;
      this.value = d.value || 1;
      this.alive = true;
      this.t = Math.random() * 6;
      this.delay = 0.35;
    }
    update(dt, G) {
      const b = this.b, P = G.player;
      this.t += dt; this.delay -= dt;
      b.z = P.z;
      const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy);
      const mag = G.mods ? G.mods.magnet : 44;
      if (this.delay <= 0 && d < mag && !P.dead) {
        b.vx = M.approach(b.vx, (dx / d) * 220, 900 * dt);
        b.vy = M.approach(b.vy, (dy / d) * 220, 900 * dt);
        b.x += b.vx * dt; b.y += b.vy * dt;
      } else {
        b.vy = Math.min(b.vy + 700 * dt, 300);
        if (b.grounded) b.vx = M.approach(b.vx, 0, 300 * dt);
        const vy0 = b.vy;
        Phys.move(b, G.room, dt);
        if (b.grounded && vy0 > 60) { b.vy = -vy0 * 0.35; b.grounded = false; }
      }
      if (this.delay <= 0 && d < 9 && !P.dead) {
        this.alive = false;
        G.save.vert += this.value;
        G.sfx('coin');
        G.fx.burst(b.x, b.y, b.z, 3, { speed: 40, color: 0xfff1a8, life: 0.25, grav: 0, size: 1 });
        G.hud && G.hud.pulse('vert');
      }
      if (b.y > G.room.h + 30) this.alive = false;
    }
    draw(g, G, t) {
      const b = this.b;
      const s = Math.round(Math.abs(Math.sin(this.t * 4)) * 2);
      const x = Math.round(b.x), y = Math.round(b.y);
      g.fillStyle(OUT, 1); g.fillRect(x - 1 - s / 2, y - 3, 3 + s, 6); g.fillRect(x - 2 - s / 2, y - 2, 5 + s, 4);
      g.fillStyle(0xffe08a, 1); g.fillRect(x - s / 2, y - 2, 1 + s, 4);
      g.fillStyle(0xffffff, 1); g.fillRect(x - s / 2, y - 2, 1, 1);
    }
  }
  PL.ENTS.vert = Vert;

  // ---------- Ponto Fixo (banco) ----------
  class Bench {
    constructor(G, d) {
      Object.assign(this, { G, x: d.x, y: d.y, z: d.z === undefined ? G.room.d / 2 : d.z, id: d.id || G.room.id, alive: true, t: 0 });
      this.half = 14;
      this.prompt = 'Descansar';
    }
    near(G) { const P = G.player; return inBand(G, this.z, this.half) && Math.abs(P.x - this.x) < 16 && Math.abs(P.y + 6 - this.y) < 14 && P.b.grounded; }
    interact(G) { G.rest(this); }
    update(dt) { this.t += dt; }
    draw(g, G, t) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const ga = ghostAlpha(G, this.z, this.half);
      if (!inBand(G, this.z, this.half)) {
        if (ga) { g.lineStyle(1, 0xffffff, ga); g.strokeRect(x - 10, y - 6, 20, 6); g.strokeCircle(x, y - 18, 4); }
        return;
      }
      // pedestal
      g.fillStyle(OUT, 1); g.fillRect(x - 11, y - 7, 22, 7);
      g.fillStyle(0x7d70ad, 1); g.fillRect(x - 10, y - 6, 20, 6);
      g.fillStyle(0xa79bd6, 1); g.fillRect(x - 10, y - 6, 20, 1);
      g.fillStyle(0x4d4275, 1); g.fillRect(x - 6, y - 4, 12, 1);
      // ponto fixo: um ponto brilhante com órbitas (pontos fixos não se movem sob a transformação)
      const cy = y - 18 + Math.sin(this.t * 2) * 1.5;
      const rest = this.G.restingAt === this;
      for (let i = 0; i < 2; i++) {
        const a = this.t * (1.2 + i * 0.7) + i;
        g.lineStyle(1, i ? 0xffa65c : 0x6fb6ff, 0.8);
        g.strokeEllipse(x, cy, 18 - i * 6 + Math.sin(a) * 4, 6 + Math.cos(a) * 3);
      }
      g.fillStyle(0xffffff, 1); g.fillRect(x - 1, Math.round(cy) - 1, 3, 3);
      if (rest || Math.sin(this.t * 3) > 0.6) { g.fillStyle(0xfff1a8, 1); g.fillRect(x, Math.round(cy) - 3, 1, 1); g.fillRect(x, Math.round(cy) + 3, 1, 1); g.fillRect(x - 3, Math.round(cy), 1, 1); g.fillRect(x + 3, Math.round(cy), 1, 1); }
    }
  }
  PL.ENTS.bench = Bench;

  // ---------- Placa com texto ----------
  class Sign {
    constructor(G, d) {
      Object.assign(this, { G, x: d.x, y: d.y, z: d.z === undefined ? G.room.d / 2 : d.z, pages: d.pages || [d.text], alive: true, title: d.title });
      this.half = 12;
      this.prompt = d.prompt || 'Ler';
    }
    near(G) { const P = G.player; return inBand(G, this.z, this.half) && Math.abs(P.x - this.x) < 14 && Math.abs(P.y + 6 - this.y) < 18 && P.b.grounded; }
    interact(G) { G.dialog(this.pages, this.title); }
    update() {}
    draw(g, G) {
      const x = Math.round(this.x), y = Math.round(this.y);
      const ga = ghostAlpha(G, this.z, this.half);
      if (!inBand(G, this.z, this.half)) { if (ga) { g.lineStyle(1, 0xffffff, ga); g.strokeRect(x - 8, y - 20, 16, 10); } return; }
      g.fillStyle(OUT, 1); g.fillRect(x - 1, y - 12, 3, 12); g.fillRect(x - 9, y - 21, 18, 11);
      g.fillStyle(0x8f7d5c, 1); g.fillRect(x, y - 11, 1, 11);
      g.fillStyle(0xe8dab8, 1); g.fillRect(x - 8, y - 20, 16, 9);
      g.fillStyle(0xa8957a, 1); g.fillRect(x - 6, y - 18, 10, 1); g.fillRect(x - 6, y - 16, 12, 1); g.fillRect(x - 6, y - 14, 7, 1);
    }
  }
  PL.ENTS.sign = Sign;

  // ---------- Item coletável (Fragmento de Lado, habilidade) ----------
  class Pickup {
    constructor(G, d) {
      Object.assign(this, { G, x: d.x, y: d.y, z: d.z === undefined ? G.room.d / 2 : d.z, item: d.item, id: d.id, alive: true, t: 0, msg: d.msg });
      this.half = 6;
    }
    update(dt, G) {
      this.t += dt;
      const P = G.player;
      if (P.dead || !inBand(G, this.z, this.half)) return;
      if (Math.abs(P.x - this.x) < 12 && Math.abs(P.y - (this.y - 4)) < 14) {
        this.alive = false;
        G.collect(this);
      }
    }
    draw(g, G) {
      const x = Math.round(this.x), y = Math.round(this.y - 6 + Math.sin(this.t * 2.5) * 2);
      const ga = ghostAlpha(G, this.z, this.half);
      if (!inBand(G, this.z, this.half)) {
        if (ga) { g.lineStyle(1, 0xfff1a8, ga + 0.15); g.strokeCircle(x, y, 6 + Math.sin(this.t * 4)); }
        return;
      }
      g.lineStyle(1, 0xfff1a8, 0.4 + 0.3 * Math.sin(this.t * 5));
      g.strokeCircle(x, y, 9 + Math.sin(this.t * 3));
      if (this.item === 'fragLado') {
        // um segmento de reta girando: um lado perdido de algum polígono
        const a = this.t * 2, c = Math.cos(a) * 6, s = Math.sin(a) * 2;
        g.lineStyle(3, OUT, 1); g.lineBetween(x - c, y - s, x + c, y + s);
        g.lineStyle(1, 0xffe08a, 1); g.lineBetween(x - c, y - s, x + c, y + s);
        g.fillStyle(0xffffff, 1); g.fillRect(Math.round(x - c), Math.round(y - s), 1, 1); g.fillRect(Math.round(x + c), Math.round(y + s), 1, 1);
      } else if (this.item === 'teorema') {
        // um pergaminho com um triângulo retângulo
        g.fillStyle(OUT, 1); g.fillRect(x - 6, y - 5, 12, 10);
        g.fillStyle(0xf3e7cf, 1); g.fillRect(x - 5, y - 4, 10, 8);
        g.fillStyle(0xff5fa2, 1); g.fillTriangle(x - 3, y + 2, x + 3, y + 2, x - 3, y - 3);
        g.fillStyle(0xa8957a, 1); g.fillRect(x - 6, y - 5, 1, 10); g.fillRect(x + 5, y - 5, 1, 10);
      } else if (this.item === 'garra') {
        // uma quina afiada pulsando
        const k = 4 + Math.abs(Math.sin(this.t * 3)) * 3;
        g.fillStyle(OUT, 1); g.fillTriangle(x - k - 1, y + k + 1, x + k + 1, y + k + 1, x - k - 1, y - k - 1);
        g.fillStyle(0xf6d55c, 1); g.fillTriangle(x - k, y + k, x + k, y + k, x - k, y - k);
        g.fillStyle(0xffffff, 1); g.fillRect(Math.round(x - k), Math.round(y - k), 1, 2);
      } else {
        // orbe de habilidade: uma linha esticando (Investida)
        const w = 4 + Math.abs(Math.sin(this.t * 3)) * 8;
        g.fillStyle(OUT, 1); g.fillRect(Math.round(x - w / 2 - 1), y - 3, Math.round(w + 2), 6);
        g.fillStyle(0xf6d55c, 1); g.fillRect(Math.round(x - w / 2), y - 2, Math.round(w), 4);
        g.fillStyle(0xffffff, 1); g.fillRect(Math.round(x - w / 2), y - 2, Math.round(w), 1);
      }
    }
  }
  PL.ENTS.pickup = Pickup;

  // ---------- Portão (sólido dinâmico que abre/fecha) ----------
  class Gate {
    constructor(G, d) {
      Object.assign(this, { G, x: d.x, y: d.y, w: d.w || 16, h: d.h || 64, alive: true, id: d.id });
      this.open = !!d.open;
      this.k = this.open ? 1 : 0;
      this.prim = G.room.addPrim(G3.box(this.x, this.y, this.w, this.h, d.z0 || 0, d.z1 === undefined ? G.room.d : d.z1, { mat: 'grade', dyn: true }));
      G.hasDyn = true;
      this.sync();
    }
    set(open) { if (open !== this.open) { this.open = open; this.G.sfx('gate'); this.G.shake(1.5, 0.25); } }
    sync() {
      const p = this.prim, yy = this.y - this.k * (this.h - 4);
      p.pts[1] = yy; p.pts[3] = yy; p.pts[5] = yy + this.h; p.pts[7] = yy + this.h;
      p.yMin = yy; p.yMax = yy + this.h;
      p.off = this.k > 0.98;
    }
    update(dt) {
      this.k = M.approach(this.k, this.open ? 1 : 0, dt * (this.open ? 1.2 : 4));
      this.sync();
    }
    draw() {}
  }
  PL.ENTS.gate = Gate;

  // ---------- Contorno: o que restou de você na última morte ----------
  class Contorno {
    constructor(G, d) {
      Object.assign(this, { G, x: d.x, y: d.y, z: d.z, value: d.value, alive: true, t: 0 });
    }
    update(dt, G) {
      this.t += dt;
      const P = G.player;
      if (!P.dead && Math.abs(P.z - this.z) < 4 && Math.abs(P.x - this.x) < 12 && Math.abs(P.y - this.yy()) < 12) {
        this.alive = false;
        G.recoverContorno(this);
      }
    }
    yy() { return this.y + Math.sin(this.t * 1.6) * 3; }
    draw(g, G) {
      const x = Math.round(this.x), y = Math.round(this.yy());
      const near = Math.abs(G.player.z - this.z);
      const a = near < 4 ? 1 : near < 40 ? 0.5 * (1 - near / 40) + 0.15 : 0;
      if (!a) return;
      const j = () => (Math.random() - 0.5) * 1.2;
      g.lineStyle(1, 0xffffff, a);
      g.strokeRect(x - 5 + j(), y - 5 + j(), 10, 10);
      g.lineStyle(1, 0x6fb6ff, a * 0.7);
      g.strokeRect(x - 6 + j(), y - 6 + j(), 12, 12);
      g.fillStyle(0xffffff, a);
      g.fillRect(x - 3, y - 2, 1, 2); g.fillRect(x + 2, y - 2, 1, 2);
    }
  }
  PL.ENTS.contorno = Contorno;

  // ---------- Dica de tutorial (texto no HUD quando o Quadrado passa pela faixa) ----------
  class Hint {
    constructor(G, d) { Object.assign(this, { G, x0: d.x0, x1: d.x1, y0: d.y0 === undefined ? -1e9 : d.y0, y1: d.y1 === undefined ? 1e9 : d.y1, text: d.text, need: d.need, alive: true, hint: true }); }
    active(G) {
      const P = G.player;
      if (this.need && !G.save.abilities[this.need]) return false;
      return P.x >= this.x0 && P.x <= this.x1 && P.y >= this.y0 && P.y <= this.y1;
    }
    update() {}
    draw() {}
  }
  PL.ENTS.hint = Hint;

  // ---------- Fenda (selada ou a Ruptura): rachadura dimensional pulsante ----------
  class Fenda {
    constructor(G, d) {
      Object.assign(this, { G, x: d.x, y: d.y, h: d.h || 60, z: d.z === undefined ? -1 : d.z, msg: d.msg, title: d.title, alive: true, t: 0, cool: 0 });
      this.pts = [];
      const rnd = M.rng(M.hashStr(G.room.id + d.x));
      for (let i = 0; i <= 10; i++) this.pts.push((rnd() - 0.5) * 8);
      this.prompt = d.interact ? 'Examinar' : null;
    }
    near(G) { const P = G.player; return this.prompt && Math.abs(P.x - this.x) < 18 && P.y > this.y - this.h && P.y < this.y + 8; }
    interact(G) { G.dialog(this.msg, this.title); }
    update(dt, G) {
      this.t += dt; this.cool -= dt;
      const P = G.player;
      if (!this.prompt && this.cool <= 0 && Math.abs(P.x - this.x) < 20 && P.y > this.y - this.h - 6 && P.y < this.y + 6) {
        this.cool = 4;
        G.toast(this.msg[0]);
      }
      if (Math.random() < 0.15) G.fx.spawn({ x: this.x + (Math.random() - 0.5) * 6, y: this.y - Math.random() * this.h, z: G.player.z, vx: (Math.random() - 0.5) * 30, vy: -20, life: 0.6, color: Math.random() < 0.5 ? 0xff5fa2 : 0x6fb6ff, grav: -20, size: 1 });
    }
    draw(g, G, t) {
      const x = this.x, y = this.y, h = this.h;
      const w = 2 + Math.sin(t * 3) * 1;
      g.fillStyle(0x0b0618, 0.9);
      g.beginPath();
      g.moveTo(x, y - h);
      for (let i = 0; i <= 10; i++) g.lineTo(x + this.pts[i] + w * Math.sin(i * 0.9 + t * 4), y - h + (h * i) / 10);
      for (let i = 10; i >= 0; i--) g.lineTo(x + this.pts[i] - w * Math.sin(i * 0.9 + t * 4) * 0.6 - 2, y - h + (h * i) / 10);
      g.closePath(); g.fillPath();
      g.lineStyle(1, 0xff5fa2, 0.7 + 0.3 * Math.sin(t * 6));
      g.beginPath();
      g.moveTo(x, y - h);
      for (let i = 0; i <= 10; i++) g.lineTo(x + this.pts[i] + w * Math.sin(i * 0.9 + t * 4), y - h + (h * i) / 10);
      g.strokePath();
    }
  }
  PL.ENTS.fenda = Fenda;

  // ---------- Rede planificada do Cubo Carcereiro (o cubo derrotado virou um achatado) ----------
  class Rede {
    constructor(G, d) { Object.assign(this, { G, x: d.x, y: d.y, alive: true, t: 0 }); }
    update(dt) { this.t += dt; }
    draw(g) {
      const S = 22, cx = Math.round(this.x), base = Math.round(this.y);
      const cells = [-1, 0, 1, 2];
      for (const i of cells) {
        const x = cx + i * S - S / 2;
        g.fillStyle(0x120c22, 1); g.fillRect(x - 1, base - 5, S, 5);
        g.fillStyle(i === 0 ? 0x8270c4 : 0x5a4b8a, 1); g.fillRect(x, base - 4, S - 2, 4);
        g.fillStyle(0xc8b8ff, 1); g.fillRect(x, base - 4, S - 2, 1);
      }
      // as duas abas da cruz, dobradas para cima e para baixo do centro
      g.fillStyle(0x120c22, 1); g.fillRect(cx - S / 2 - 1, base - 9, S, 4);
      g.fillStyle(0x5a4b8a, 1); g.fillRect(cx - S / 2, base - 8, S - 2, 3);
      g.fillStyle(0xfff1a8, 1); g.fillRect(cx - 4, base - 3, 2, 1); g.fillRect(cx + 2, base - 3, 2, 1);
    }
  }
  PL.ENTS.rede = Rede;

  // ---------- Disco: a Mãe-Esfera achatada ----------
  class Disco {
    constructor(G, d) { Object.assign(this, { G, x: d.x, y: d.y, alive: true, t: 0 }); }
    update(dt) { this.t += dt; }
    draw(g) {
      const x = Math.round(this.x), y = Math.round(this.y);
      g.fillStyle(0x3a1028, 1); g.fillEllipse(x, y - 3, 92, 9);
      g.fillStyle(0xd96aa0, 1); g.fillEllipse(x, y - 3, 88, 6);
      g.fillStyle(0xf29bc4, 1); g.fillEllipse(x - 6, y - 4, 60, 2);
      // o olho, fechado, dorme no meio do disco
      g.fillStyle(0x3a1028, 1); g.fillRect(x - 4, y - 4, 8, 1);
    }
  }
  PL.ENTS.disco = Disco;

  // ---------- NPC: achatados que conversam (Segmento, Pentágono) ----------
  class Npc {
    constructor(G, d) {
      Object.assign(this, { G, x: d.x, y: d.y, z: d.z === undefined ? G.room.d / 2 : d.z, id: d.id, alive: true, t: Math.random() * 6 });
      this.def = PL.NPCS[d.id];
      this.half = 6;
      this.prompt = 'Conversar';
      this.blink = 0;
    }
    near(G) { const P = G.player; return inBand(G, this.z, this.half) && Math.abs(P.x - this.x) < 22 && Math.abs(P.y - (this.y - 8)) < 20 && P.b.grounded; }
    interact(G) {
      const r = this.def.talk(G, this);
      PL.Audio.sfx('talk');
      G.dialog(r.pages, this.def.nome, r.after ? () => r.after(G, this) : null);
    }
    update(dt) {
      this.t += dt;
      this.blink -= dt;
      if (this.blink < -3 - Math.random() * 3) this.blink = 0.12;
    }
    draw(g, G, t) {
      const ga = ghostAlpha(G, this.z, this.half);
      if (!inBand(G, this.z, this.half)) {
        if (ga) { g.lineStyle(1, 0xffffff, ga); g.strokeCircle(Math.round(this.x), Math.round(this.y - 12), 7); }
        return;
      }
      const look = Math.sign(G.player.x - this.x) || 1;
      this.def.draw(g, this, t, look, this.blink > 0);
    }
  }
  PL.ENTS.npc = Npc;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
