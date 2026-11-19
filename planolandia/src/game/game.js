/* Planolândia — controlador da partida: salas, transições (bordas e profundidade), câmera, combate,
 * dano/morte/Contorno, Pontos Fixos, chefões e integração com o HUD. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const M = PL.M, G3 = PL.G3, C2 = PL.C2, Phys = PL.Phys;

  const tmpRect = G3.newShape(), depthTmp = G3.newShape();
  const QS = [], QP = [];

  class Game {
    constructor(scene, opts) {
      this.scene = scene;
      this.slot = opts.slot === undefined ? -1 : opts.slot;
      this.save = opts.save || PL.Save.fresh();
      this.settings = PL.Save.settings();
      this.debug = opts.debug || {};
      this.god = !!this.debug.god;
      this.bg = new PL.Background(scene);
      this.slices = new PL.Slices.SliceRenderer(scene);
      this.entG = scene.add.graphics().setDepth(20);
      this.playerG = scene.add.graphics().setDepth(30);
      this.fx = new PL.FX(scene);
      this.dbgG = scene.add.graphics().setDepth(60);
      this.fadeG = scene.add.graphics().setDepth(90).setScrollFactor(0);
      this.cam = { x: 0, y: 0, lx: 0, look: 0, lookT: 0 };
      this.shakeT = 0; this.shakeA = 0;
      this.hitstop = 0; this.slowT = 0;
      this.t = 0;
      this.ents = [];
      this.hz = { pool: [], n: 0 };
      this.fade = { a: 1, target: 0, speed: 3, cb: null };
      this.busy = false;
      this.paused = false;
      this.dialogOpen = false;
      this.restingAt = null;
      this.boss = null;
      this.promptEnt = null;
      this.activeHint = null;
      this.player = null;
      this.hud = null;
      this.eco = !!this.save.abilities.eco;
      this.mods = PL.Teoremas ? PL.Teoremas.mods(this.save) : null;
      this.fx.scale = this.settings.economy ? 0.5 : 1;
      this.slices.dens = this.settings.economy ? 0.5 : 1;

      let roomId, place;
      if (opts.spawn) { roomId = opts.spawn.room; place = opts.spawn; }
      else if (this.save.bench) { roomId = this.save.bench.room; place = this.save.bench; }
      else { roomId = this.save.room; place = null; }
      if (!PL.World.defs[roomId]) { roomId = 'borda_chegada'; place = null; }
      this.loadRoom(roomId, place);
      this.snapCamera();
    }

    get vw() { return this.scene.scale.width; }
    get vh() { return this.scene.scale.height; }

    // ---------- salas ----------
    loadRoom(id, place) {
      const def = PL.World.defs[id];
      const prevRegion = this.room ? this.room.def.region : null;
      this.room = new PL.World.Room(def, this.save);
      this.hasDyn = this.room.prims.some((p) => p.dyn);
      this.ents = [];
      this.fx.clear();
      this.boss = null;
      this.slices.setRoom(this.room);
      this.bg.setRegion(def.region, this.vw, this.vh);
      const sp = place || def.spawn || { x: 60, y: def.size[1] - 60, z: def.size[2] / 2 };
      if (!this.player) this.player = new PL.Player(this, sp.x, sp.y, sp.z);
      else { const b = this.player.b; b.x = sp.x; b.y = sp.y; b.z = sp.z; b.grounded = false; }
      const pb = this.player.b;
      pb.z = M.clamp(pb.z, 0, this.room.d);
      this.player.lastSafe = { x: pb.x, y: pb.y, z: pb.z };
      for (const e of this.room.ents) this.spawnEnt(e);
      const c = this.save.contorno;
      if (c && c.room === id) this.ents.push(new PL.ENTS.contorno(this, c));
      this.save.room = id;
      const firstVisit = !this.save.visited[id];
      this.save.visited[id] = true;
      if (this.hud) {
        if (prevRegion !== def.region) this.hud.banner(PL.REGIONS[def.region].nome, def.name);
        else if (firstVisit && def.banner) this.hud.banner(def.name, def.banner);
      }
      PL.Audio.music(def.music || PL.REGIONS[def.region].musica);
      Phys.depenetrate(pb, this.room);
    }

    spawnEnt(d) {
      if (d.flag && this.save.flags[d.flag]) return null;
      if (d.unless && this.save.flags[d.unless]) return null;
      if (d.only && !this.save.flags[d.only]) return null;
      let e = null;
      if (PL.ENEMIES[d.type]) { e = new PL.ENEMIES[d.type](this, d); e.enemy = true; }
      else if (PL.ENTS[d.type]) e = new PL.ENTS[d.type](this, d);
      else { console.warn('entidade desconhecida', d.type); return null; }
      e.type = d.type;
      this.ents.push(e);
      if (e.boss) this.boss = e;
      return e;
    }
    spawnEnemy(type, d) { return this.spawnEnt(Object.assign({ type }, d)); }

    // ---------- laço ----------
    step(dt) {
      this.t += dt;
      this.updateFade(dt);
      if (this.paused || this.dialogOpen) return;
      this.save.time += dt;
      this.shakeT = Math.max(0, this.shakeT - dt);
      if (this.busy) { this.fx.update(dt); return; }
      if (this.hitstop > 0) { this.hitstop -= dt; return; }
      let sdt = dt;
      if (this.slowT > 0) { this.slowT -= dt; sdt *= 0.45; }
      const P = this.player, I = PL.Input;

      if (this.restingAt) {
        if (I.pressed.up && this.hud) { I.eat('up'); this.hud.openTeoremas(true); return; }
        if (I.pressed.left || I.pressed.right || I.pressed.jump || I.pressed.attack || I.pressed.down || I.pressed.dash) { this.restingAt = null; P.frozen = false; }
      }
      P.update(sdt);
      if (!P.dead) this.checkEdges();

      const pz = P.z;
      for (let i = 0; i < this.ents.length; i++) this.ents[i].update(sdt, this);
      for (const e of this.ents) if (e.enemy) e.updateSlice(pz, this.eco);

      // dano por contato
      if (!P.dead && !this.busy) {
        const b = P.b;
        G3.setRect(tmpRect, b.x - b.hx + 2, b.y - b.hy + 2, b.x + b.hx - 2, b.y + b.hy);
        for (const e of this.ents) {
          if (!e.enemy || !e.alive || !e.visible || !e.contact) continue;
          if (C2.overlap(tmpRect, e.s)) { this.hurtPlayer(e.s.cx, e.contact); break; }
        }
        this.hz.n = 0;
        for (const e of this.ents) if (e.enemy && e.alive !== false && e.hazards) e.hazards(pz, this.hz);
        for (let i = 0; i < this.hz.n; i++) if (C2.overlap(tmpRect, this.hz.pool[i])) { this.hurtPlayer(this.hz.pool[i].cx, 1); break; }
      }
      for (let i = this.ents.length - 1; i >= 0; i--) {
        const e = this.ents[i];
        if (!e.alive && !(e.boss && e.state === 'dead')) this.ents.splice(i, 1);
      }
      this.fx.update(sdt);

      // interação (▲) e dicas
      this.promptEnt = null;
      if (this.restingAt) this.promptEnt = { x: this.restingAt.x, y: this.restingAt.y - 10, prompt: 'Teoremas', resting: true };
      else if (!P.dead && P.b.grounded) {
        for (const e of this.ents) if (e.near && e.near(this)) { this.promptEnt = e; break; }
        if (this.promptEnt && I.pressed.up && P.atkT <= 0) { I.eat('up'); this.promptEnt.interact(this); }
      }
      this.activeHint = null;
      for (const e of this.ents) if (e.hint && e.active(this)) { this.activeHint = e; break; }
    }

    render(dt) {
      this.updateCamera(dt);
      const cam = this.scene.cameras.main;
      let sx = 0, sy = 0;
      if (this.shakeT > 0 && this.settings.shake) {
        const a = this.shakeA * Math.min(1, this.shakeT * 6);
        sx = (Math.random() - 0.5) * 2 * a; sy = (Math.random() - 0.5) * 2 * a;
      }
      cam.setScroll(Math.round(this.cam.x + sx), Math.round(this.cam.y + sy));
      const P = this.player, pz = P.z;
      this.bg.update(this.cam.x, this.cam.y, pz, this.t);
      this.slices.eco = this.eco;
      this.slices.update(pz, this.t, { blocker: P.blocker, blockT: P.blockT, blockZ: P.blockZ });
      const g = this.entG;
      g.clear();
      for (const e of this.ents) if (!e.front) e.draw(g, this, this.t);
      this.playerG.clear();
      P.draw(this.playerG, this.t);
      for (const e of this.ents) if (e.front) e.draw(this.playerG, this, this.t);
      this.fx.draw(pz);
      this.drawDebug();
      this.drawFade();
    }

    // ---------- câmera ----------
    camTarget() {
      const P = this.player, r = this.room, vw = this.vw, vh = this.vh;
      let tx = P.x + this.cam.lx - vw / 2;
      let ty = P.y - vh * 0.56 + this.cam.look;
      tx = r.w <= vw ? (r.w - vw) / 2 : M.clamp(tx, 0, r.w - vw);
      ty = r.h <= vh ? (r.h - vh) / 2 : M.clamp(ty, 0, r.h - vh);
      return [tx, ty];
    }
    updateCamera(dt) {
      const P = this.player, I = PL.Input;
      this.cam.lx = M.damp(this.cam.lx, P.facing * 26, 2.5, dt);
      const still = P.b.grounded && Math.abs(P.b.vx) < 1 && P.atkT <= 0 && !this.promptEnt;
      if (still && (I.down.up || I.down.down)) this.cam.lookT += dt; else this.cam.lookT = 0;
      const look = this.cam.lookT > 0.5 ? (I.down.up ? -60 : 60) : 0;
      this.cam.look = M.damp(this.cam.look, look, 4, dt);
      const [tx, ty] = this.camTarget();
      this.cam.x = M.damp(this.cam.x, tx, 8, dt);
      this.cam.y = M.damp(this.cam.y, ty, 5.5, dt);
    }
    snapCamera() {
      this.cam.lx = this.player.facing * 26;
      const [tx, ty] = this.camTarget();
      this.cam.x = tx; this.cam.y = ty;
    }
    shake(a, t) { this.shakeA = Math.max(this.shakeT > 0 ? this.shakeA : 0, a); this.shakeT = Math.max(this.shakeT, t); }
    resize() { this.bg.resize(this.vw, this.vh); }

    // ---------- bordas, profundidade, transições ----------
    checkEdges() {
      const P = this.player, b = P.b, r = this.room;
      if (b.x - b.hx < 0) {
        const ex = r.exitAt('left', b.y, 0, b.z);
        if (!ex || ex.sealed) { b.x = b.hx; if (b.vx < 0) b.vx = 0; }
        else if (b.x < 0) return this.transition(ex);
      }
      if (b.x + b.hx > r.w) {
        const ex = r.exitAt('right', b.y, 0, b.z);
        if (!ex || ex.sealed) { b.x = r.w - b.hx; if (b.vx > 0) b.vx = 0; }
        else if (b.x > r.w) return this.transition(ex);
      }
      if (b.y - b.hy < 0) {
        const ex = r.exitAt('top', b.x, 0, b.z);
        if (!ex || ex.sealed) { b.y = b.hy; if (b.vy < 0) b.vy = 0; }
        else if (b.y < 0) return this.transition(ex);
      }
      if (b.y - b.hy > r.h) {
        const ex = r.exitAt('bottom', b.x, 0, b.z);
        if (ex && !ex.sealed) return this.transition(ex);
        return this.hurtPlayer(b.x, 1, { hazard: true, pit: true });
      }
    }
    depthLimit(b, dir) {
      const r = this.room;
      if (dir > 0) { const ex = r.exitAt('far', b.x, b.y); return ex && !ex.sealed ? r.d + 8 : r.d; }
      const ex = r.exitAt('near', b.x, b.y);
      return ex && !ex.sealed ? -8 : 0;
    }
    onDepth(P) {
      const b = P.b, r = this.room;
      if (b.z > r.d) { const ex = r.exitAt('far', b.x, b.y); if (ex) this.transition(ex); else b.z = r.d; }
      else if (b.z < 0) { const ex = r.exitAt('near', b.x, b.y); if (ex) this.transition(ex); else b.z = 0; }
    }

    transition(ex) {
      if (this.busy) return;
      this.busy = true;
      const P = this.player, b = P.b, r = this.room;
      const wx = r.pos.x + b.x, wy = r.pos.y + b.y, wz = r.pos.z + b.z;
      const vel = { vx: b.vx, vy: b.vy, vz: P.vz };
      PL.Audio.sfx('door');
      this.fadeTo(1, 7, () => {
        const t = PL.World.defs[ex.to];
        const tz = t.pos[2] || 0;
        const L = { x: wx - t.pos[0], y: wy - t.pos[1], z: wz - tz };
        const [tw, th, td] = t.size;
        switch (ex.side) {
          case 'right': L.x = b.hx + 2; break;
          case 'left': L.x = tw - b.hx - 2; break;
          case 'bottom': L.y = b.hy + 2; break;
          case 'top': L.y = th - b.hy - 2; vel.vy = Math.min(vel.vy, -340); P.jumping = false; break;
          case 'far': L.z = 1; break;
          case 'near': L.z = td - 1; break;
        }
        L.z = M.clamp(L.z, 0, td);
        this.loadRoom(ex.to, L);
        b.vx = vel.vx; b.vy = vel.vy; P.vz = vel.vz;
        // garante espaço livre na chegada
        for (let i = 0; i < 40 && Phys.overlapAt(b, this.room, b.x, b.y, b.z); i++) b.y -= 1;
        this.snapCamera();
        this.busy = false;
        this.fadeTo(0, 5);
        if (this.slot >= 0) PL.Save.write(this.slot, this.persistable());
      });
    }

    // salvamento ao trocar de sala guarda progresso (itens, mapa), mas o retorno continua sendo o Ponto Fixo
    persistable() { return this.save; }

    fadeTo(a, speed, cb) { this.fade.target = a; this.fade.speed = speed; this.fade.cb = cb || null; }
    updateFade(dt) {
      const f = this.fade;
      if (f.a !== f.target) {
        f.a = M.approach(f.a, f.target, f.speed * dt);
        if (f.a === f.target && f.cb) { const cb = f.cb; f.cb = null; cb(); }
      } else if (f.cb) { const cb = f.cb; f.cb = null; cb(); }
    }
    drawFade() {
      const g = this.fadeG;
      g.clear();
      if (this.fade.a > 0.001) { g.fillStyle(0x07040f, this.fade.a); g.fillRect(-4, -4, this.vw + 8, this.vh + 8); }
    }

    // ---------- combate ----------
    playerAttack(P, hb) {
      let hit = false;
      const reachZ = this.mods ? this.mods.atkDepth : 0;
      for (const e of this.ents) {
        if (!e.enemy || !e.alive || P.atkHit.has(e)) continue;
        let es = e.visible ? e.s : null;
        // Bissetriz: o golpe também corta fatias vizinhas
        if (!es && reachZ > 0) {
          for (const d of [-reachZ, -reachZ / 2, reachZ / 2, reachZ]) if (e.sliceAt(P.z + d, depthTmp) && C2.overlap(hb, depthTmp)) { es = depthTmp; break; }
        }
        if (!es || !C2.overlap(hb, es)) continue;
        P.atkHit.add(e);
        const dirX = P.atkDir === 'side' ? P.facing : (Math.sign(e.s.cx - P.x) || P.facing);
        const dirY = P.atkDir === 'up' ? -1 : P.atkDir === 'down' ? 1 : 0;
        const ok = e.hit(this, 1, dirX, dirY, { hb, dir: P.atkDir });
        if (ok || (e.pogo && P.atkDir === 'down')) {
          P.onAttackHit(e.geo === false ? 'hazard' : 'enemy');
          hit = true;
          const mx = (Math.max(hb.minX, es.minX) + Math.min(hb.maxX, es.maxX)) / 2;
          const my = (Math.max(hb.minY, es.minY) + Math.min(hb.maxY, es.maxY)) / 2;
          this.fx.burst(mx, my, P.z, 6, { speed: 150, color: [0xffffff, 0xfff1a8], life: 0.22, grav: 0, size: 2, ang0: dirY ? (dirY > 0 ? Math.PI / 2 : -Math.PI / 2) : (dirX > 0 ? 0 : Math.PI), spread: 1.6 });
          this.hitstop = Math.max(this.hitstop, ok ? 0.05 : 0.03);
          this.sfx(ok ? 'hit' : 'clink');
        }
      }
      const room = this.room;
      if (P.atkDir === 'down' && !P.atkHit.has('haz')) {
        const c = room.query(P.z, hb.minX, hb.minY, hb.maxX, hb.maxY, PL.World.MASK_HAZARD, QS, QP);
        for (let k = 0; k < c; k++) {
          if (!QP[k].pogo || !C2.overlap(hb, QS[k])) continue;
          P.atkHit.add('haz');
          this.player.onAttackHit('hazard');
          this.sfx('clink');
          this.fx.burst((hb.minX + hb.maxX) / 2, QS[k].minY, this.player.z, 5, { speed: 90, color: 0xffffff, life: 0.2, grav: 100, ang0: -Math.PI / 2, spread: 2 });
          break;
        }
      }
      // paredes quebráveis
      const c2 = room.query(this.player.z, hb.minX, hb.minY, hb.maxX, hb.maxY, PL.World.MASK_SOLID, QS, QP);
      for (let k = 0; k < c2; k++) {
        const p = QP[k];
        if (!p.breakable || this.player.atkHit.has(p) || !C2.overlap(hb, QS[k])) continue;
        this.player.atkHit.add(p);
        p.breakable--;
        p.flashT = 0.1;
        this.sfx('crack');
        this.shake(1.5, 0.1);
        const bm = PL.MATS[p.mat] || PL.MATS.pedra;
        const sx = QS[k].cx, sy = QS[k].cy, top = QS[k].minY;
        this.fx.burst(sx, sy, this.player.z, 6, { speed: 100, color: [bm.fill, bm.dark], life: 0.4, grav: 300, kind: 'shard' });
        // veio de Vértices: cada golpe solta um pouco
        if (p.deposit > 0) { const n = Math.min(p.deposit, 1 + (Math.random() < 0.5 ? 1 : 0)); p.deposit -= n; this.dropVerts(sx, top, n); this.sfx('coin'); }
        if (p.breakable <= 0) {
          p.off = true;
          if (p.flag) this.save.flags[p.flag] = true;
          if (p.deposit > 0) { this.dropVerts(sx, top, p.deposit); p.deposit = 0; }
          room.touch();
          this.sfx('kill');
          this.fx.burst(sx, sy, this.player.z, 18, { speed: 160, color: [bm.fill, bm.dark, bm.top], life: 0.6, grav: 400, kind: 'shard' });
        }
        hit = true;
        if (this.player.atkDir === 'side') this.player.onAttackHit('hazard');
      }
      return hit;
    }

    hurtPlayer(fromX, dmg, opts) {
      opts = opts || {};
      const P = this.player;
      if (P.dead || this.busy) return;
      const already = P.inv > 0;
      if (already && !opts.hazard) return;
      if (!already) {
        if (!this.god) this.save.lados -= dmg;
        P.hurt(fromX, opts);
        this.hitstop = Math.max(this.hitstop, 0.13);
        this.shake(3, 0.25);
        this.sfx('hurt');
        this.hud && this.hud.flash(0xffffff);
        if (navigator.vibrate && PL.Input.last === 'toque') { try { navigator.vibrate(60); } catch (e) { /* ignora */ } }
      }
      if (this.save.lados <= 0) { this.save.lados = 0; return this.playerDeath(); }
      if (opts.hazard) this.hazardRespawn();
    }

    hazardRespawn() {
      const P = this.player;
      this.busy = true;
      P.frozen = true;
      this.fadeTo(1, 5, () => {
        const b = P.b, s = P.lastSafe;
        b.x = s.x; b.y = s.y; b.z = s.z; b.vx = 0; b.vy = 0; P.vz = 0;
        P.inv = Math.max(P.inv, 0.8);
        this.snapCamera();
        this.busy = false;
        P.frozen = false;
        this.fadeTo(0, 4);
      });
    }

    playerDeath() {
      const P = this.player, b = P.b;
      P.dead = true;
      this.busy = true;
      this.sfx('death');
      this.shake(5, 0.4);
      // os quatro lados se soltam
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        this.fx.spawn({ x: b.x, y: b.y, z: b.z, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 80, life: 1.4, size: 5, color: 0xf6d55c, grav: 300, kind: 'shard', spin: 8 });
      }
      this.fx.burst(b.x, b.y, b.z, 20, { speed: 160, color: [0xf6d55c, 0xfff1a8, 0x2a1e3b], life: 0.9, grav: 200 });
      const hazardDeath = !!Phys.hazardAt(b, this.room) || b.y > this.room.h;
      const where = hazardDeath ? P.lastSafe : { x: b.x, y: b.y, z: b.z };
      this.scene.time.delayedCall(1300, () => {
        this.fadeTo(1, 1.5, () => {
          const st = this.save;
          st.deaths++;
          st.contorno = st.vert > 0 ? { room: this.room.id, x: where.x, y: where.y - 4, z: where.z, value: st.vert } : null;
          st.vert = 0; st.geo = 0; st.lados = st.maxLados;
          const bench = st.bench;
          if (bench) this.loadRoom(bench.room, bench);
          else this.loadRoom('borda_chegada', null);
          P.dead = false; P.inv = 1; P.frozen = false; P.b.vx = P.b.vy = 0; P.vz = 0;
          this.snapCamera();
          if (this.slot >= 0) PL.Save.write(this.slot, st);
          this.busy = false;
          this.fadeTo(0, 1.6);
          if (st.contorno) this.toast('Seu Contorno ficou para trás, com ' + st.contorno.value + ' Vértices.');
        });
      });
    }

    recoverContorno(c) {
      this.save.vert += c.value;
      this.save.contorno = null;
      this.sfx('heal');
      this.fx.ring(c.x, c.y, this.player.z, 4, 30, 0.5, 0x6fb6ff, 2);
      this.fx.burst(c.x, c.y, this.player.z, 14, { speed: 90, color: [0xffffff, 0x6fb6ff, 0xffe08a], life: 0.6, grav: 0 });
      this.toast('Contorno recuperado: +' + c.value + ' Vértices.');
      this.hud && this.hud.pulse('vert');
    }

    dropVerts(x, y, n) {
      for (let i = 0; i < n; i++) this.ents.push(new PL.ENTS.vert(this, { x, y, vx: (Math.random() - 0.5) * 140, vy: -120 - Math.random() * 120 }));
    }

    // ---------- Pontos Fixos, itens, chefões ----------
    rest(bench) {
      const P = this.player, st = this.save;
      this.restingAt = bench;
      P.frozen = true;
      P.b.vx = 0; P.vz = 0;
      P.b.x = bench.x;
      st.bench = { room: this.room.id, x: bench.x, y: bench.y - 8, z: bench.z };
      st.lados = st.maxLados;
      this.sfx('bench');
      this.fx.ring(bench.x, bench.y - 18, P.z, 4, 40, 0.6, 0x6fb6ff, 1);
      this.fx.ring(bench.x, bench.y - 18, P.z, 2, 26, 0.5, 0xffa65c, 1);
      if (this.slot >= 0) PL.Save.write(this.slot, st);
      this.toast('Ponto Fixo — progresso salvo. Lados restaurados.');
    }

    collect(pk) {
      const st = this.save;
      if (pk.id) st.flags[pk.id] = true;
      this.sfx('item');
      this.fx.ring(pk.x, pk.y - 6, this.player.z, 4, 34, 0.5, 0xfff1a8, 2);
      this.hitstop = 0.15;
      if (pk.item === 'fragLado') {
        const r = PL.Save.addFrag(st);
        if (r.complete) this.dialog(['Fragmento de Lado (4/4)', 'Os quatro segmentos se encaixam. Você ganhou um Lado a mais: agora suporta ' + st.maxLados + ' golpes.']);
        else this.dialog(['Fragmento de Lado (' + r.n + '/4)', pk.msg || 'Um segmento de reta perdido, de algum polígono que passou por aqui. Junte quatro para ganhar um Lado.']);
      } else if (pk.item === 'teorema') {
        const t = PL.TEOREMAS[pk.teorema];
        st.teoremas[pk.teorema] = true;
        this.dialog(['Teorema: ' + t.nome, t.desc, 'Custa ' + t.custo + ' Postulado' + (t.custo > 1 ? 's' : '') + '. Equipe Teoremas descansando num Ponto Fixo ([up]).'], 'Novo Teorema');
      } else if (pk.item === 'garra') {
        st.abilities.garra = true;
        this.dialog([
          'GARRA DE VÉRTICE',
          'A Mãe-Esfera, achatada num disco, deixou cair um vértice afiado. Você aprendeu a cravar a própria quina nas paredes.',
          'No ar, segure em direção a uma parede para se agarrar e deslizar devagar. Aperte [jump] para saltar para longe dela.',
          'Alternando entre paredes, dá para subir poços inteiros.',
        ], 'Nova habilidade');
      } else if (pk.item === 'dash') {
        st.abilities.dash = true;
        this.dialog([
          'INVESTIDA',
          'O Carcereiro planificado deixou cair sua última dobra. Você aprendeu a esticar o próprio corpo como uma linha.',
          'Aperte [dash] para disparar na direção em que está olhando. No ar, funciona uma vez por salto.',
          'Agora dá para atravessar vãos largos demais para um pulo.',
        ], 'Nova habilidade');
      }
      if (this.slot >= 0) PL.Save.write(this.slot, st);
    }

    bossStart(boss, name, sub, music) {
      for (const e of this.ents) if (e.type === 'gate') e.set(false);
      this.hud && this.hud.banner(name, sub, true);
      PL.Audio.music(music || 'boss');
    }
    bossDying() { this.slowT = 1.6; this.sfx('roar'); }
    bossDefeated(boss, pos) {
      const st = this.save;
      const r = boss.reward || { flag: 'boss_cubo', item: 'dash', id: 'hab_dash', deco: 'rede', msg: 'O Cubo Carcereiro foi planificado.' };
      st.flags[r.flag] = true;
      for (const e of this.ents) if (e.type === 'gate') e.set(true);
      if (r.deco && PL.ENTS[r.deco]) this.ents.push(new PL.ENTS[r.deco](this, { x: pos.x, y: pos.y }));
      this.spawnEnt({ type: 'pickup', item: r.item, id: r.id, x: pos.x, y: pos.y - 26, z: this.player.z });
      PL.Audio.music(this.room.def.music || PL.REGIONS[this.room.def.region].musica);
      if (r.msg) this.toast(r.msg);
      if (r.lines) this.dialog(r.lines, r.speaker);
      if (this.slot >= 0) PL.Save.write(this.slot, st);
    }
    recalcMods() { this.mods = PL.Teoremas.mods(this.save); }

    // ---------- textos ----------
    dialog(pages, title, onClose) { if (this.hud) this.hud.dialog(pages, title, onClose); else if (onClose) onClose(); }
    toast(text) { if (this.hud) this.hud.toast(text); }
    sfx(n, k) { PL.Audio.sfx(n, k); }

    rulerMarks() {
      const out = [];
      const r = this.room;
      for (const e of r.exits) {
        if (e.side !== 'near' && e.side !== 'far') continue;
        out.push({ z: e.side === 'far' ? r.d : 0, color: e.sealed ? 0xff5fa2 : 0xfff1a8, exit: true });
      }
      if (this.boss && this.boss.ruler) for (const m of this.boss.ruler) out.push(m);
      if (this.boss && this.boss.alive && this.boss.state !== 'sleep' && this.boss.state !== 'split') out.push({ z: this.boss.z, color: 0xc8b8ff, boss: true });
      for (const e of this.ents) if (e.type === 'contorno') out.push({ z: e.z, color: 0x6fb6ff });
      return out;
    }

    drawDebug() {
      const g = this.dbgG;
      g.clear();
      if (!this.debug.overlay) return;
      const P = this.player, b = P.b;
      const c = this.room.query(b.z, this.cam.x, this.cam.y, this.cam.x + this.vw, this.cam.y + this.vh, PL.World.MASK_ALL, QS, QP);
      for (let k = 0; k < c; k++) {
        const s = QS[k];
        g.lineStyle(1, QP[k].hazard ? 0xff0000 : QP[k].oneWay ? 0x00ffff : 0x00ff00, 0.8);
        if (s.type === 'circle') g.strokeCircle(s.cx, s.cy, s.r);
        else { g.beginPath(); g.moveTo(s.pts[0], s.pts[1]); for (let i = 1; i < s.n; i++) g.lineTo(s.pts[i * 2], s.pts[i * 2 + 1]); g.closePath(); g.strokePath(); }
      }
      g.lineStyle(1, 0xffff00, 1);
      g.strokeRect(b.x - b.hx, b.y - b.hy, b.hx * 2, b.hy * 2);
      for (const e of this.ents) if (e.enemy && e.visible) { g.lineStyle(1, 0xff00ff, 1); g.strokeRect(e.s.minX, e.s.minY, e.s.maxX - e.s.minX, e.s.maxY - e.s.minY); }
    }

    destroy() {
      this.bg.destroy(); this.slices.destroy(); this.fx.destroy();
      this.entG.destroy(); this.playerG.destroy(); this.dbgG.destroy(); this.fadeG.destroy();
    }
  }

  PL.Game = Game;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
