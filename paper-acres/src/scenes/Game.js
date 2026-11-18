/* Main scene: owns the current map, physics, the vector world drawing and the ASCII post-process,
 * plus the day clock, lighting and the title/play modes. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const DENS = 2; // characters per world cell (each way): the figure is ~6 characters tall

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
      PA.scene = this;
      this.mode = 'title';
      this.paper = new PA.Paper(this);
      this.ascii = new PA.Ascii(this);
      this.maps = {};
      this.map = this.maps.overworld = PA.Gen.overworld(12345);
      this.world = new PA.WorldDraw(this.map);
      const sp = this.map.spots.spawn;
      const feet = this.map.grid.surfaceY(sp.x, sp.z) * C.CELL_H;
      this.matter.world.autoUpdate = false;
      this.matter.world.on('collisionstart', (ev) => { if (this.state) PA.Combat.onPairs(this, ev.pairs); });
      this.matter.world.on('collisionactive', (ev) => { if (this.state && PA.Enemies.list.length) PA.Combat.onPairs(this, ev.pairs); });
      PA.Bus.on('explode', (e) => { if (this.state) PA.Enemies.explode(this, e.x, e.y, e.z); });
      this.terrain = new PA.Terrain(this, this.map);
      this.terrain.sync(sp.x * C.CELL_W, sp.z);
      this.player = new PA.Player(this, this.map, sp.x * C.CELL_W + C.CELL_W / 2, feet - 1, sp.z);
      this.cam = { x: this.player.x, y: feet - 3 * C.CELL_H, z: 1, zoom: 1 };
      this.maxSlices = PA.settings.slices || 4;
      this.season = 'spring';
      PA.season = this.season;
      this.state = null;
      this.scale.on('resize', () => this.onResize());
      this.onResize();
      PA.Settings.apply();
      PA.Bus.on('blur', () => { if (this.mode === 'play' && PA.settings.pauseOnBlur) this.paused = true; });
      window.addEventListener('focus', () => { this.paused = false; });
      PA.Bus.emit('ready');
    }
    onResize() {
      const W = this.scale.width, H = this.scale.height;
      const cssH = H / PA.dpr();
      const rows = cssH >= 700 ? 24 : cssH >= 480 ? 22 : 19; // world rows on screen
      const charPx = Math.max(6, Math.round(H / (rows * DENS)));
      this.cam.zoom = charPx * DENS / C.CELL_H;
      this.paper.resize(W, H);
      this.paper.setCell(charPx * DENS);
      this.ascii.resize(W, H, charPx);
    }

    /* ---------------- title / start ---------------- */
    showTitle() {
      this.mode = 'title';
      PA.UI.Title.show(true);
      PA.UI.HUD.show(false);
      PA.UI.Hotbar.show(false);
      if (PA.Touch.el) PA.Touch.setVisible(false);
    }
    quitToTitle() {
      this.state = null;
      this.maps = {};
      this.maps.overworld = PA.Gen.overworld(12345);
      this.loadMap('overworld', 60, 1, 1);
      this.showTitle();
    }
    selectHot(i) { this.hot = (i + 9) % 9; PA.UI.Hotbar.render(); }
    startGame(state, slot, isNew) {
      this.state = state; this.slot = slot;
      PA.Drawn.clearBodies(this);
      this.maps = {};
      this.maps.overworld = PA.Gen.overworld(state.seed);
      for (const id in state.maps) this.getMap(id).grid.importEdits(state.maps[id].edits || []);
      this.setSeason(PA.SEASONS[state.season]);
      state.forage = state.forage || []; state.ship = state.ship || []; state.objects = state.objects || [];
      if (state.inv) this.inv = PA.Inventory.from(state.inv);
      else {
        this.inv = new PA.Inventory(36);
        for (const t of ['hoe', 'can', 'axe', 'pickaxe', 'scythe', 'eraser', 'sword']) this.inv.add(t, 1, t === 'can' ? { lvl: 0, water: 40 } : { lvl: 0 });
        this.inv.add('parsnip_seeds', 15); this.inv.add('bread', 2);
      }
      this.hot = 0;
      // chopped trees and stumps
      if (state.props && state.props.overworld) {
        const ow = this.maps.overworld;
        ow.props = ow.props.filter((p) => p.type !== 'tree' && p.type !== 'stump');
        for (const [type, x, z, seed, kind] of state.props.overworld) ow.props.push({ type, x, z, seed, kind, gy: ow.grid.surfaceY(x, z) });
      }
      if (isNew) state.pos = { x: PA.Gen.ROOMS.house.furn[0][1] + 6, z: 0, facing: 1 };
      this.loadMap(state.map, state.pos.x, state.pos.z, state.pos.facing);
      this.mode = 'play';
      this.paused = false;
      this.placing = null;
      PA.UI.Title.show(false);
      PA.UI.HUD.show(true);
      PA.UI.Hotbar.show(true); PA.UI.Hotbar.render();
      if (PA.Touch.el) PA.Touch.setVisible(true);
      PA.NPCs.init(this);
      this.applyUnlocks();
      if (isNew) state.mail.push(...PA.Quests.mailFor(state));
      PA.Bus.emit('start', { state, isNew });
      if (isNew) { PA.Save.write(slot, this.snapshot()); PA.UI.toast('Welcome to ' + state.farm + '!', 3000); }
    }
    setSeason(name) {
      if (this.season === name) return;
      this.season = name; PA.season = name;
      for (const id in this.maps) if (this.world.map === this.maps[id]) this.world.invalidateAll();
    }
    /** State with fresh map edits, ready to save. */
    snapshot() {
      const s = this.state;
      for (const id in this.maps) {
        const e = this.maps[id].grid.exportEdits();
        if (e.length) s.maps[id] = { edits: e };
      }
      s.map = this.map.id;
      s.pos = { x: Math.floor(this.player.x / C.CELL_W), z: this.player.z, facing: this.player.facing };
      if (this.map.kind === 'mine') { const d = this.maps.overworld.doors.find((q) => q.to === 'mine'); s.map = 'overworld'; s.pos = { x: d.x, z: d.z - 1, facing: 1 }; }
      if (this.inv) s.inv = this.inv.toJSON();
      PA.Drawn.sync();
      return s;
    }
    save() { if (this.state) return PA.Save.write(this.slot, this.snapshot()); return false; }

    /* ---------------- frame ---------------- */
    update(time, phaserDelta) {
      // Phaser smooths/caps delta; use the real clock so the simulation runs in real time at low fps too.
      const nowMs = performance.now();
      const delta = Math.min(this.lastNow ? nowMs - this.lastNow : phaserDelta, 250);
      this.lastNow = nowMs;
      const dt = Math.min(delta, 50);
      this.frameDt = dt;
      if (this.mode === 'title') { this.titleCam(dt); this.render(nowMs, dt); if ((this.moodT = (this.moodT || 0) + dt) > 1000) { this.moodT = 0; PA.Audio.pickTheme(this); } return; }
      const inp = PA.Input.poll();
      if (inp.pauseP && !PA.Input.blocked) this.togglePause();
      const running = !this.paused && !PA.Input.blocked && !this.transition;
      if (running) {
        const ev = PA.Time.tick(this.state, delta, PA.settings.dayLength);
        if (ev.passOut) this.sleep(true);
      }
      let pinp = inp;
      if (this.placing && !this.paused) { PA.Drawn.placementInput(this, inp); pinp = Object.assign({}, inp, PA.Input.NO_EDGES, { moveX: 0, up: false, down: false, jump: false, use: false }); }
      else if (!this.transition && !this.paused) { this.checkDoors(inp); this.handleActions(inp, nowMs); }
      // fixed 60 Hz physics so speed doesn't depend on frame rate
      const STEP = 1000 / 60;
      this.acc = this.paused ? 0 : Math.min((this.acc || 0) + Math.min(delta, 100), STEP * 5);
      let first = true;
      while (this.acc >= STEP) {
        const stepInp = first ? pinp : Object.assign({}, pinp, PA.Input.NO_EDGES);
        this.simTime = (this.simTime || 0) + STEP;
        PA.Farm.tickAction(this, STEP);
        PA.Drawn.step(this, STEP);
        PA.NPCs.step(this, STEP);
        PA.Animals.step(this, STEP);
        PA.Combat.step(this, STEP);
        PA.Enemies.step(this, STEP);
        if (this.player.iframes > 0) this.player.iframes -= STEP;
        if (this.player.hurtT > 0) this.player.hurtT -= STEP;
        PA.Wildlife.step(this, STEP);
        this.player.update(STEP, stepInp, this.simTime);
        this.matter.world.step(STEP);
        this.acc -= STEP; first = false;
      }
      this.terrain.sync(this.player.x, this.player.z);
      this.followCamera(dt);
      PA.UI.HUD.update(this.state);
      // footsteps on paper and the music's mood
      const pl = this.player, ph = pl.anim < 0.5 ? 0 : 1;
      if ((pl.state === 'walk' || pl.state === 'run') && ph !== this.lastPhase) PA.Audio.sfx('step');
      this.lastPhase = ph;
      if ((this.moodT = (this.moodT || 0) + dt) > 1000) { this.moodT = 0; PA.Audio.pickTheme(this); }
      PA.Hints.step(this, dt);
      PA.Quality.frame(delta);
      this.render(nowMs, dt);
    }
    handleActions(inp, now) {
      if (inp.menuP && !PA.UI.Notebook.open) { PA.UI.Notebook.show(); return; }
      if (inp.mapP) { PA.UI.Notebook.show('map'); return; }
      if (PA.Input.blocked) return;
      if (inp.hotbar >= 0) this.selectHot(inp.hotbar);
      if (inp.wheel) this.selectHot(this.hot + Math.sign(inp.wheel));
      if (PA.Fishing.active) { PA.Fishing.step(this, this.frameDt || 16, inp); return; }
      if (inp.useP || (inp.use && now - (this.lastUse || 0) > 420)) { this.lastUse = now; PA.Farm.useSelected(this); }
      if (inp.interactP) PA.Farm.interact(this, false);
      if (inp.drawP && PA.Sketch) PA.Sketch.open(this);
    }
    togglePause() {
      this.paused = !this.paused;
      PA.UI.toast(this.paused ? 'Paused (Esc to resume)' : 'Resumed', 1200);
    }
    titleCam(dt) {
      // drift slowly over the farm and the town behind the title page
      this.titleT = (this.titleT || 0) + dt / 1000;
      const cam = this.cam;
      cam.x = (60 + (Math.sin(this.titleT * 0.05) * 0.5 + 0.5) * 220) * C.CELL_W;
      cam.y = (PA.Gen.GY - 5) * C.CELL_H; cam.z = 1;
    }

    /* ---------------- maps and doors ---------------- */
    getMap(id) {
      if (!this.maps[id]) this.maps[id] = id === 'overworld' ? PA.Gen.overworld(this.state ? this.state.seed : 12345) : PA.Gen.interior(id);
      return this.maps[id];
    }
    loadMap(id, x, z, facing) {
      const map = this.getMap(id);
      this.map = map;
      this.terrain.destroy();
      this.world.setMap(map);
      this.terrain = new PA.Terrain(this, map);
      const feet = map.grid.surfaceY(x, z) * C.CELL_H - 1;
      const p = this.player;
      p.map = map; p.z = z; p.body.collisionFilter = PA.filters.player(z);
      p.setPos(x * C.CELL_W + C.CELL_W / 2, feet);
      if (facing) p.facing = facing;
      p.lastJ = null;
      this.terrain.sync(p.x, z);
      if (map.kind === 'mine') PA.Enemies.load(this, map); else PA.Enemies.clear(this);
      if (this.state) { PA.Drawn.loadMap(this); this.animalActors = null; PA.Animals.actors(this); PA.Wildlife.list = []; PA.Fishing.active = null; }
      this.cam.x = p.x; this.cam.y = feet - 3 * C.CELL_H; this.cam.z = z;
      PA.Bus.emit('map', { id, kind: map.kind });
    }
    /** Dithered page-turn: fade to ink, run `mid` (swap maps), fade back. */
    pageTurn(mid) {
      if (this.transition) return;
      const t0 = performance.now(), D = 260;
      this.transition = true;
      let swapped = false;
      this.ascii.wipe = (now) => {
        const t = (now - t0) / D;
        if (t >= 1 && !swapped) { swapped = true; mid(); }
        if (t >= 2) { this.ascii.wipe = null; this.transition = false; return 0; }
        return t < 1 ? t : 2 - t;
      };
    }
    goTo(id, x, z, facing) { this.pageTurn(() => this.loadMap(id, x, z, facing)); PA.Bus.emit('door'); }
    checkDoors(inp) {
      const p = this.player, map = this.map, cx = Math.floor(p.x / C.CELL_W);
      if (map.kind === 'interior') {
        if (inp.downP && p.z === 0 && Math.abs(cx - map.exit.x) <= 3) {
          const d = this.maps.overworld.doors.find((dd) => dd.to === map.id);
          inp.downP = false;
          if (d) this.goTo('overworld', d.x, d.z - 1, 1);
          return;
        }
        if (map.id === 'house' && (inp.interactP || inp.upP) && p.z === 0) {
          const bed = map.props.find((q) => q.kind === 'bed');
          if (bed && cx >= bed.x - 1 && cx <= bed.x + 8) {
            inp.interactP = false; inp.upP = false;
            PA.UI.confirm('Go to bed and end the day?', ['Sleep', 'Not yet']).then((i) => { if (i === 0) this.sleep(false); });
          }
        }
        return;
      }
      if (PA.Mine.checkLadders(this, inp)) return;
      if (map.kind === 'mine') return;
      if (!(inp.upP || inp.interactP)) return;
      for (const d of map.doors) {
        if (d.z !== p.z + 1 || cx < d.x - 1 || cx > d.x + d.w) continue;
        inp.upP = false; inp.interactP = false;
        if (d.to === 'mine') { PA.Mine.enter(this); return; }
        const m = this.getMap(d.to);
        this.goTo(d.to, m.spots.entry.x, 0, 1);
        return;
      }
    }

    /* ---------------- days ---------------- */
    sleep(passedOut) {
      const s = this.state;
      if (this.sleeping) return;
      this.sleeping = true;
      this.pageTurn(() => {
        if (passedOut) {
          const lost = Math.min(1000, Math.floor(s.gold * 0.1));
          s.gold -= lost;
          s.energy = Math.floor(s.maxEnergy * 0.5);
          PA.UI.toast(lost ? `You passed out. Someone carried you home... (-${lost}g)` : 'You passed out and woke up at home.', 3600);
        } else s.energy = s.maxEnergy;
        s.hp = s.maxHp;
        const r = PA.Time.newDay(s);
        PA.Farm.newDay(this);
        PA.Drawn.newDay(this);
        PA.Animals.newDay(this);
        PA.Dialogue.newDay(s);
        for (const m of PA.Quests.mailFor(s)) if (!s.mail.some((q) => q.id === m.id)) s.mail.push(m);
        if (s.flags.upgrade && s.flags.upgradeReady <= s.stats.days) {
          const u = s.flags.upgrade; this.inv.add(u.id, 1, Object.assign({}, u.extra || {}, { lvl: u.lvl }));
          PA.UI.toast('Gus delivered your ' + ['', 'copper', 'iron', 'gold'][u.lvl] + ' ' + PA.Items.get(u.id).name.toLowerCase() + '!', 4000);
          s.flags.upgrade = null; s.flags.upgradeReady = null;
        }
        this.applyUnlocks();
        PA.NPCs.place(this, true);
        PA.Bus.emit('newday', { state: s, rolled: r });
        this.setSeason(PA.SEASONS[s.season]);
        const bed = PA.Gen.ROOMS.house.furn[0];
        this.loadMap('house', bed[1] + 6, 0, 1);
        this.save();
        this.sleeping = false;
        PA.UI.toast(PA.Time.weekday(s) + '. ' + PA.Time.dateText(s) + ' - ' + { sun: 'sunny', rain: 'rain', storm: 'a storm', snow: 'snow', wind: 'windy' }[s.weather], 3000);
      });
    }

    /** Rewards of mended pages and finished buildings, applied to the world. */
    applyUnlocks() {
      const s = this.state, ow = this.maps.overworld, g = ow.grid, GY = PA.Gen.GY;
      if (s.flags.creekBridge && g.get(58, GY - 1, 8) !== PA.T.PLANK) for (let x = 55; x <= 62; x++) g.set(x, GY - 1, 8, PA.T.PLANK);
      if (s.flags.allWords) for (const w of PA.Words.ALL) if (!s.words.includes(w.id)) s.words.push(w.id);
      for (const [flag, id, x0, w] of [['coop', 'coop', 120, 10], ['barn', 'barn', 136, 14]]) {
        if (s.flags[flag] !== true || ow.props.some((p) => p.id === id)) continue;
        for (let z = 6; z < 8; z++) for (let x = x0; x < x0 + w; x++) for (let y = GY - 7; y < GY; y++) g.set(x, y, z, PA.T.WALL, false);
        ow.props.push({ type: 'building', id, x0, w, z: 6, h: 7, roof: 'barn', door: x0 + Math.floor(w / 2) - 1, sign: id.toUpperCase(), windows: 1 });
        ow.doors.push({ x: x0 + Math.floor(w / 2) - 1, z: 6, w: 2, to: id });
        this.world.indexProps();
      }
      if (s.flags.minecart && !ow.props.some((p) => p.type === 'cart')) { ow.props.push({ type: 'cart', x: 152, z: 1 }); this.world.indexProps(); }
      if (s.flags.mended && !s.flags.endingSeen) { s.flags.endingSeen = true; setTimeout(() => PA.UI.confirm('The notebook of Marginton is whole again. Every page, every margin, every line. The Eraser has nothing left to take... and you have a farm full of drawings. Thank you for playing! (The notebook goes on.)', ['Keep drawing']), 600); }
    }

    /* ---------------- camera ---------------- */
    followCamera(dt) {
      const p = this.player, cam = this.cam;
      const a = 1 - Math.pow(0.001, dt / 1000);
      cam.x += (p.x + p.facing * 30 - cam.x) * a * 2.2;
      const ty = p.feet - 3 * C.CELL_H;
      if (Math.abs(ty - cam.y) > C.CELL_H * 1.5 || p.lastGround > this.simTime - 60) cam.y += (ty - cam.y) * a * 1.6;
      cam.z = PA.U.approach(cam.z, p.z, dt / C.STEP_MS);
      // keep the page inside the map; small rooms stay centred
      const W = this.scale.width / cam.zoom, mapW = this.map.grid.w * C.CELL_W;
      if (mapW <= W * 0.95) cam.x = mapW / 2;
      else cam.x = PA.U.clamp(cam.x, W / 2 - C.CELL_W * 2, mapW - W / 2 + C.CELL_W * 2);
    }
    /** Camera snapped so the current slice sits exactly on the character grid (no glyph shimmer). */
    drawCam() {
      const W = this.scale.width, H = this.scale.height, cam = this.cam, R = this.ascii;
      const ax = W / 2, ay = H * C.ANCHOR_Y;
      const ox = Math.round((ax - cam.x * cam.zoom) / R.cellW) * R.cellW;
      const oy = Math.round((ay - cam.y * cam.zoom) / R.cellH) * R.cellH;
      let sx = 0;
      if (this.shake > 0.02 && PA.settings.shake && !PA.settings.reducedMotion) { sx = Math.round((Math.random() - 0.5) * this.shake * 3) * R.cellW; this.shake *= 0.85; }
      return { x: (ax - ox - sx) / cam.zoom, y: (ay - oy) / cam.zoom, z: cam.z, zoom: cam.zoom, persp: this.map.kind === 'interior' ? 0.12 : null };
    }

    /* ---------------- drawing ---------------- */
    render(now, dt) {
      const W = this.scale.width, H = this.scale.height, R = this.ascii, g = this.map.grid;
      const cam = this.drawCam();
      R.begin();
      const zFirst = Math.max(0, Math.ceil(cam.z - 0.999));
      const zLast = Math.min(g.d - 1, Math.floor(cam.z + this.maxSlices));
      this.proj = [];
      const lights = [];
      for (let z = zLast; z >= zFirst; z--) {
        const k = z - cam.z;
        if (k <= -1) continue;
        const p = PA.View.slice(k, cam, W, H);
        const level = PA.View.levelOf(k);
        p.level = level;
        this.proj[z] = p;
        const st = this.world.drawSlice(R, z, p, level, this.season);
        if (this.mode === 'play') {
          this.world.drawDynamic(R, z, p, st, this.state); PA.Drawn.draw(R, z, p, st, this); PA.NPCs.draw(R, z, p, st, this);
          PA.Animals.draw(R, z, p, st, this); PA.Wildlife.draw(R, z, p, st); PA.Fishing.draw(R, z, p, st, this); PA.Enemies.draw(R, z, p, st);
        }
        if (this.mode === 'play' && this.player.z === z) this.player.draw(R, p, dt);
        this.world.drawFront(R, z, p, st, this.season);
        if (level >= 0 && level <= 2) this.collectLights(z, p, lights);
      }
      if (this.map.kind !== 'interior' && this.state) PA.Weather.draw(R, this.state.weather, this.season, dt || 16, W, H, R.cellH);
      // night: the page inverts outside the circles of light
      const dark = this.map.kind === 'mine' ? 0.92 : this.map.kind === 'interior' || !this.state ? 0 : PA.Time.darkness(this.state.time);
      if (dark > 0) {
        const p0 = this.proj[this.player.z];
        const lantern = this.inv && this.inv.slots.some((q) => q && q.id === 'drawn' && q.extra.word === 'lantern');
        if (p0) lights.push({ x: p0.ox + this.player.x * p0.scale, y: p0.oy + (this.player.feet - 50) * p0.scale, r: R.cellH * (lantern ? 18 : this.map.kind === 'mine' ? 10 : 7) });
        if (this.map.kind === 'mine') for (const pr of this.map.props) if (pr.type === 'mineLadder' && this.proj[pr.z]) { const q = this.proj[pr.z]; lights.push({ x: q.ox + (pr.x + 0.5) * C.CELL_W * q.scale, y: q.oy + (pr.gy - 2) * C.CELL_H * q.scale, r: R.cellH * 6 }); }
        for (const e of PA.Drawn.live) if ((e.rec.word === 'lamp' || e.rec.word === 'lantern') && this.proj[e.rec.z]) { const q = this.proj[e.rec.z]; lights.push({ x: q.ox + e.rec.x * q.scale, y: q.oy + e.rec.y * q.scale, r: R.cellH * 10 * q.scale / this.cam.zoom }); }
        R.night = { t: dark, lights };
        document.body.classList.toggle('night', dark > 0.5);
      } else { R.night = null; document.body.classList.remove('night'); }
      R.end(now);
    }
    collectLights(z, p, out) {
      const props = this.world.propsBy[z];
      if (!props) return;
      for (const pr of props) {
        if (pr.type === 'lamp') out.push({ x: p.ox + (pr.x + 0.5) * C.CELL_W * p.scale, y: p.oy + (PA.Gen.GY - 3) * C.CELL_H * p.scale, r: 5 * C.CELL_H * p.scale });
        else if (pr.type === 'building' && pr.windows) out.push({ x: p.ox + (pr.x0 + pr.w / 2) * C.CELL_W * p.scale, y: p.oy + (PA.Gen.GY - pr.h / 2) * C.CELL_H * p.scale, r: pr.w * 0.45 * C.CELL_W * p.scale });
      }
    }
  }
  PA.GameScene = GameScene;
  PA.startGame = (state, slot, isNew) => PA.scene.startGame(state, slot, isNew);
})(typeof window !== 'undefined' ? window : globalThis);
