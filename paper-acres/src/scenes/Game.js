/* Main scene: owns the current map, physics, the vector world drawing and the ASCII post-process. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
      PA.scene = this;
      this.paper = new PA.Paper(this);
      this.ascii = new PA.Ascii(this);
      this.map = PA.Gen.testWorld(7);
      this.world = new PA.WorldDraw(this.map);
      const sp = this.map.spots.spawn;
      const feet = this.map.grid.surfaceY(sp.x, sp.z) * C.CELL_H;
      this.matter.world.autoUpdate = false;
      this.terrain = new PA.Terrain(this, this.map);
      this.terrain.sync(sp.x * C.CELL_W, sp.z);
      this.player = new PA.Player(this, this.map, sp.x * C.CELL_W + C.CELL_W / 2, feet - 1, sp.z);
      this.cam = { x: this.player.x, y: feet - 3 * C.CELL_H, z: sp.z, zoom: 1 };
      this.maxSlices = 4;
      this.season = 'summer';
      this.scale.on('resize', () => this.onResize());
      this.onResize();
      PA.Bus.emit('ready');
    }
    onResize() {
      const W = this.scale.width, H = this.scale.height;
      const cssH = H / PA.dpr();
      const rows = cssH >= 700 ? 30 : cssH >= 480 ? 26 : 22;
      // integer device pixels per character row: the ASCII grid, the ruled lines and the current slice line up
      const cellPx = Math.max(10, Math.round(H / rows));
      this.cam.zoom = cellPx / C.CELL_H;
      this.paper.resize(W, H);
      this.paper.setCell(cellPx);
      this.ascii.resize(W, H, cellPx);
    }
    update(time, phaserDelta) {
      // Phaser smooths/caps delta; use the real clock so the simulation runs in real time at low fps too.
      const nowMs = performance.now();
      const delta = Math.min(this.lastNow ? nowMs - this.lastNow : phaserDelta, 250);
      this.lastNow = nowMs;
      const dt = Math.min(delta, 50);
      const inp = PA.Input.poll();
      // fixed 60 Hz physics so speed doesn't depend on frame rate
      const STEP = 1000 / 60;
      this.acc = Math.min((this.acc || 0) + Math.min(delta, 100), STEP * 5);
      let first = true;
      while (this.acc >= STEP) {
        const stepInp = first ? inp : Object.assign({}, inp, PA.Input.NO_EDGES);
        this.simTime = (this.simTime || 0) + STEP;
        this.player.update(STEP, stepInp, this.simTime);
        this.matter.world.step(STEP);
        this.acc -= STEP; first = false;
      }
      this.terrain.sync(this.player.x, this.player.z);
      this.followCamera(dt);
      this.render(nowMs);
    }
    followCamera(dt) {
      const p = this.player, cam = this.cam;
      const a = 1 - Math.pow(0.001, dt / 1000);
      cam.x += (p.x + p.facing * 30 - cam.x) * a * 2.2;
      const ty = p.feet - 3 * C.CELL_H;
      if (Math.abs(ty - cam.y) > C.CELL_H * 1.5 || p.lastGround > this.simTime - 60) cam.y += (ty - cam.y) * a * 1.6;
      cam.z = PA.U.approach(cam.z, p.z, dt / C.STEP_MS);
    }
    /** Camera snapped so the current slice's cells sit exactly on the character grid (no glyph shimmer). */
    drawCam() {
      const W = this.scale.width, H = this.scale.height, cam = this.cam, R = this.ascii;
      const ax = W / 2, ay = H * C.ANCHOR_Y;
      const ox = Math.round((ax - cam.x * cam.zoom) / R.cellW) * R.cellW;
      const oy = Math.round((ay - cam.y * cam.zoom) / R.cellH) * R.cellH;
      return { x: (ax - ox) / cam.zoom, y: (ay - oy) / cam.zoom, z: cam.z, zoom: cam.zoom };
    }
    render(now) {
      const W = this.scale.width, H = this.scale.height, R = this.ascii, g = this.map.grid;
      const cam = this.drawCam();
      R.begin();
      const zFirst = Math.max(0, Math.ceil(cam.z - 0.999));
      const zLast = Math.min(g.d - 1, Math.floor(cam.z + this.maxSlices));
      this.proj = [];
      for (let z = zLast; z >= zFirst; z--) {
        const k = z - cam.z;
        if (k <= -1) continue;
        const p = PA.View.slice(k, cam, W, H);
        const level = PA.View.levelOf(k);
        p.level = level;
        this.proj[z] = p;
        const st = this.world.drawSlice(R, z, p, level, this.season);
        if (this.player.z === z) this.player.draw(R, p);
      }
      R.end(now);
    }
  }
  PA.GameScene = GameScene;
})(typeof window !== 'undefined' ? window : globalThis);
