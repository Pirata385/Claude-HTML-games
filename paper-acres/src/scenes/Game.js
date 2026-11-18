/* Main scene: owns the current map, the slice stack, entity layers and the frame loop. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
      PA.scene = this;
      this.paper = new PA.Paper(this);
      this.map = PA.Gen.testWorld(7);
      this.stack = new PA.SliceStack(this, this.map);
      this.ents = new PA.Entities(this, this.stack);
      const sp = this.map.spots.spawn;
      this.cam = { x: sp.x * C.CELL_W, y: (this.map.grid.surfaceY(sp.x, sp.z) - 2) * C.CELL_H, z: sp.z, zoom: 1 };
      this.zTarget = sp.z;
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
      this.scale.on('resize', () => this.onResize());
      this.onResize();
      PA.Bus.emit('ready');
    }
    onResize() {
      const W = this.scale.width, H = this.scale.height;
      this.paper.resize(W, H);
      const cssH = H / PA.dpr();
      const rows = cssH >= 700 ? 26 : 20;
      this.cam.zoom = H / (rows * C.CELL_H);
    }
    update(time, delta) {
      const dt = Math.min(delta, 50);
      const k = this.keys;
      const sp = 0.5 * dt;
      if (k.A.isDown || k.LEFT.isDown) this.cam.x -= sp;
      if (k.D.isDown || k.RIGHT.isDown) this.cam.x += sp;
      if (Phaser.Input.Keyboard.JustDown(k.W)) this.zTarget = Math.min(this.map.grid.d - 1, this.zTarget + 1);
      if (Phaser.Input.Keyboard.JustDown(k.S)) this.zTarget = Math.max(0, this.zTarget - 1);
      this.cam.z = PA.U.approach(this.cam.z, this.zTarget, dt / C.STEP_MS);
      this.render();
    }
    render() {
      const W = this.scale.width, H = this.scale.height;
      this.stack.update(this.cam, W, H);
      const p0 = this.stack.proj[Math.round(this.cam.z)];
      this.paper.update(p0);
      this.ents.begin(this.stack.proj);
      this.ents.end();
    }
  }
  PA.GameScene = GameScene;
})(typeof window !== 'undefined' ? window : globalThis);
