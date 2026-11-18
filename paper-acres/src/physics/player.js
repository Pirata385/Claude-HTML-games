/* The player stickman: a Matter capsule with platformer control, ladders, swimming and slice stepping. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const C = PA.C;
  const TUNE = { walk: 2.2, run: 3.6, accel: 0.35, airAccel: 0.18, jump: 8.6, coyote: 110, buffer: 130, climb: 1.8, swimUp: 2.4 };

  class Player {
    constructor(scene, map, x, feetY, z) {
      this.scene = scene; this.map = map;
      this.W = 18; this.H = 84;
      this.z = z; this.facing = 1;
      this.anim = 0; this.state = 'idle'; this.action = null;
      this.lastGround = -1e9; this.lastJumpPress = -1e9; this.groundNow = false;
      this.makeBody(x, feetY);
      const w = scene.matter.world;
      this.onBefore = () => { this.groundNow = false; };
      this.onPairs = (ev) => this.contacts(ev.pairs);
      w.on('beforeupdate', this.onBefore);
      w.on('collisionstart', this.onPairs);
      w.on('collisionactive', this.onPairs);
    }
    makeBody(x, feetY) {
      if (this.body) this.scene.matter.world.remove(this.body);
      this.body = this.scene.matter.add.rectangle(x, feetY - this.H / 2, this.W, this.H, {
        chamfer: { radius: 5 }, friction: 0, frictionStatic: 0, frictionAir: 0.005, restitution: 0,
        inertia: Infinity, label: 'player', collisionFilter: PA.filters.player(this.z),
      });
      this.body.gameObjectRef = this;
    }
    destroy() {
      const w = this.scene.matter.world;
      w.off('beforeupdate', this.onBefore); w.off('collisionstart', this.onPairs); w.off('collisionactive', this.onPairs);
      w.remove(this.body);
    }
    contacts(pairs) {
      const me = this.body;
      for (const pair of pairs) {
        const a = pair.bodyA.parent || pair.bodyA, b = pair.bodyB.parent || pair.bodyB;
        if (a !== me && b !== me) continue;
        if (pair.isSensor) continue;
        const col = pair.collision;
        const bottom = me.position.y + this.H / 2 - 4;
        for (let i = 0; i < (col.supportCount || 0); i++) {
          const s = col.supports[i];
          if (s && s.y >= bottom) { this.groundNow = true; this.standingOn = a === me ? b : a; break; }
        }
      }
    }
    get x() { return this.body.position.x; }
    get feet() { return this.body.position.y + this.H / 2; }
    get vx() { return this.body.velocity.x; }
    get vy() { return this.body.velocity.y; }
    setPos(x, feetY) { this.scene.matter.body.setPosition(this.body, { x, y: feetY - this.H / 2 }); this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 }); }
    setVel(x, y) { this.scene.matter.body.setVelocity(this.body, { x, y }); }
    cellBox(dy = 0) {
      const x0 = Math.floor((this.x - this.W / 2 + 1) / C.CELL_W), x1 = Math.floor((this.x + this.W / 2 - 1) / C.CELL_W);
      const y0 = Math.floor((this.feet - this.H + 1 + dy) / C.CELL_H), y1 = Math.floor((this.feet - 1 + dy) / C.CELL_H);
      return { x0, x1, y0, y1 };
    }
    boxFree(z, dy = 0) {
      const g = this.map.grid, b = this.cellBox(dy);
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (g.solid(x, y, z)) return false;
      // other bodies in that slice (props, drawn objects)
      const bounds = { min: { x: this.x - this.W / 2, y: this.feet - this.H + dy }, max: { x: this.x + this.W / 2, y: this.feet + dy - 1 } };
      const bodies = this.scene.matter.world.getAllBodies().filter((bb) => bb.label !== 'terrain' && bb !== this.body && (bb.collisionFilter.category & PA.sliceBit(z)) && !bb.isSensor);
      if (bodies.length && this.scene.matter.query.region(bodies, bounds).length) return false;
      return true;
    }
    /** Step one slice toward (dir=+1) or away from (dir=-1) the horizon. Returns success. */
    stepSlice(dir) {
      const nz = this.z + dir, g = this.map.grid;
      if (nz < 0 || nz >= g.d) return false;
      let dy = 0;
      if (!this.boxFree(nz, 0)) {
        if (this.boxFree(nz, -C.CELL_H) && this.boxFree(this.z, -C.CELL_H)) dy = -C.CELL_H;
        else { this.bump = { t: 0, dir }; PA.Bus.emit('slice-blocked', { dir }); return false; }
      }
      this.z = nz;
      this.body.collisionFilter = PA.filters.player(nz);
      if (dy) this.scene.matter.body.setPosition(this.body, { x: this.x, y: this.body.position.y + dy });
      PA.Bus.emit('slice-step', { z: nz, dir });
      return true;
    }
    tryStepUp(dir) {
      const g = this.map.grid;
      const fx = Math.floor((this.x + dir * (this.W / 2 + 2)) / C.CELL_W);
      const feetRow = Math.floor((this.feet - 1) / C.CELL_H);
      if (!g.solid(fx, feetRow, this.z)) return false;
      if (g.solid(fx, feetRow - 1, this.z)) return false;
      // room for the whole body one cell higher at the ledge
      const rows = Math.ceil(this.H / C.CELL_H);
      for (let r = 1; r <= rows + 1; r++) if (g.solid(fx, feetRow - r, this.z) || g.solid(Math.floor(this.x / C.CELL_W), feetRow - r, this.z)) return false;
      const newFeet = feetRow * C.CELL_H - 0.5;
      this.scene.matter.body.setPosition(this.body, { x: this.x + dir * 3, y: newFeet - this.H / 2 });
      this.drawOffset = (this.drawOffset || 0) + C.CELL_H * 0.8;
      return true;
    }
    tileAt(dx, dy) { return PA.TILES[this.map.grid.get(Math.floor((this.x + dx) / C.CELL_W), Math.floor(dy / C.CELL_H), this.z)]; }
    update(dt, inp, now) {
      const b = this.body;
      const mid = this.tileAt(0, this.feet - this.H / 2), low = this.tileAt(0, this.feet - 4);
      this.onLadder = mid.ladder || low.ladder || (PA.Drawn && PA.Drawn.onLadder(this.z, this.x, this.feet - this.H, this.feet));
      this.inWater = mid.water;
      if (this.groundNow) this.lastGround = now;
      const grounded = this.groundNow;
      const canJump = now - this.lastGround < TUNE.coyote;
      if (inp.jumpP) this.lastJumpPress = now;
      if (this.frozen) { this.setVel(0, b.velocity.y); this.state = this.frozen; this.anim += dt / 900; return; }

      // ladders / slice stepping share W/S
      if (this.onLadder && (inp.up || inp.down)) this.climbing = true;
      if (!this.onLadder) this.climbing = false;
      if (!this.climbing) {
        if (inp.upP) this.stepSlice(+1);
        else if (inp.downP) this.stepSlice(-1);
      }

      const run = inp.run;
      const target = inp.moveX * (run ? TUNE.run : TUNE.walk) * (this.inWater ? 0.55 : 1) * (this.action ? 0.25 : 1);
      if (inp.moveX && !this.action) this.facing = inp.moveX > 0 ? 1 : -1;
      let vx = PA.U.approach(b.velocity.x, target, grounded ? TUNE.accel : TUNE.airAccel);
      let vy = b.velocity.y;
      b.ignoreGravity = false;
      if (this.climbing) {
        b.ignoreGravity = true;
        vy = (inp.down ? 1 : 0) * TUNE.climb - (inp.up ? 1 : 0) * TUNE.climb;
        vx *= 0.6;
        if (inp.jumpP) { this.climbing = false; vy = -TUNE.jump * 0.7; }
      } else if (this.inWater) {
        b.ignoreGravity = true;
        vy = PA.U.approach(vy, inp.jump || inp.up ? -TUNE.swimUp : 0.9, 0.12);
      } else if (now - this.lastJumpPress < TUNE.buffer && canJump) {
        vy = -TUNE.jump; this.lastJumpPress = -1e9; this.lastGround = -1e9;
        PA.Bus.emit('jump');
      } else if (!inp.jump && vy < -2.5) {
        vy *= 0.8; // variable jump height
      }
      if (vy > 11) vy = 11;
      // a drawn umbrella in hand turns a fall into a glide
      const sel = PA.scene && PA.scene.inv && PA.scene.inv.slots[PA.scene.hot];
      if (sel && sel.id === 'drawn' && sel.extra.word === 'umbrella' && vy > 1.8 && !this.climbing && !this.inWater) { vy = 1.8; this.gliding = true; } else this.gliding = false;
      // auto step-up onto 1-cell ledges while walking on the ground
      if (inp.moveX && (grounded || now - this.lastGround < 60) && !this.climbing) this.tryStepUp(inp.moveX > 0 ? 1 : -1);
      this.setVel(vx, vy);

      // animation state
      const speed = Math.abs(vx);
      if (this.action) { this.state = 'swing'; }
      else if (this.climbing) { this.state = 'climb'; this.anim += (Math.abs(vy) + 0.2) * dt / 400; }
      else if (this.inWater) { this.state = 'swim'; this.anim += dt / 700; }
      else if (!grounded && now - this.lastGround > 80) { this.state = vy < 0 ? 'jump' : 'fall'; }
      else if (speed > 0.25) { this.state = run && speed > TUNE.walk + 0.2 ? 'run' : 'walk'; this.anim += speed * dt / (run ? 380 : 300); }
      else { this.state = 'idle'; this.anim += dt / 2200; }
      if (this.anim > 1) this.anim -= Math.floor(this.anim);
      if (grounded && !this.wasGrounded && this.fallSpeed > 4) { PA.Bus.emit('land', { speed: this.fallSpeed }); this.landT = 150; }
      if (this.landT > 0) { this.landT -= dt; if (this.state === 'idle' || this.state === 'walk') this.state = 'land'; }
      this.fallSpeed = vy; this.wasGrounded = grounded;
    }
    model() { const s = PA.scene && PA.scene.state; return PA.Stick.model(s && s.model != null ? s.model : PA.settings.model); }
    /** Current skeleton, eased toward the target pose so state changes flow. */
    joints(dt) {
      const act = this.action;
      const target = PA.Stick.rig(this.state, this.anim, act ? { progress: act.progress, aim: act.aim } : {});
      const k = this.lastJ ? 1 - Math.exp(-(dt || 16) / 55) : 1;
      this.lastJ = PA.Stick.blend(this.lastJ, target, k);
      return this.lastJ;
    }
    /** Drawn as a line drawing; the ASCII pass converts it. A paper halo keeps it readable over scenery. */
    draw(R, p, dt) {
      this.drawOffset = (this.drawOffset || 0) * 0.75;
      if (this.hurtT > 0 && Math.floor(this.hurtT / 80) % 2) return;
      const j = this.joints(dt);
      R.use(p);
      const ctx = R.ctx;
      ctx.save();
      const k = PA.Stick.SCALE, gx = PA.Stick.snapX(this.x); // the torso stands in the middle of one character column
      ctx.translate(gx, this.feet + this.drawOffset - 1);
      ctx.scale(k, k);
      PA.Stick.draw(ctx, j, this.facing, { ink: '#000', paper: '#fff', solid: p.level === 0 ? PA.Ascii.solidFor(this.model()) : null, model: this.model(), lw: R.lw(p, 1.0) / k, halo: R.lw(p, 4.5) / k });
      ctx.restore();
      const sx = p.ox + this.x * p.scale, sy = p.oy + this.feet * p.scale;
      R.mask(sx - 36 * p.scale, sy - 102 * p.scale, sx + 36 * p.scale, sy);
      this.screenCell = R.cellAt(sx, sy - 1);
    }
  }
  Player.TUNE = TUNE;
  PA.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
