// The running game: owns the zone, the player, the camera and every per-frame system.
import { EventBus } from './core/events.js';
import { Input } from './core/input.js';
import { makeRng, hashSeed } from './core/rng.js';
import { CameraRig } from './render/cameraRig.js';
import { Sky, applyDayPalette } from './render/sky.js';
import { ZoneView } from './render/zoneView.js';
import { buildPlayerRig } from './render/models.js';
import { generateZone } from './world/gen/index.js';
import { Player } from './entities/player.js';
import { DayNight } from './systems/dayNight.js';
import { computeStats } from './systems/stats.js';
import { equippedDefs, equippedIn } from './systems/equipment.js';
import { WAVES } from './data/waves.js';
import { ZONES } from './data/zones.js';

const zoneCache = new Map();
export function getZone(id) {
  if (!zoneCache.has(id)) zoneCache.set(id, generateZone(id));
  return zoneCache.get(id);
}

export class Game {
  constructor({ renderer, settings, store, profile, hooks = {} }) {
    this.r = renderer;
    this.settings = settings;
    this.store = store;
    this.profile = profile;
    this.hooks = hooks;
    this.bus = new EventBus();
    this.input = new Input(renderer.gl.domElement, settings.controls.bindings);
    this.cam = new CameraRig(renderer.camera, settings);
    this.sky = new Sky(renderer.scene);
    this.dayNight = new DayNight(WAVES.island.cycle, profile.world.clock);
    this.rng = makeRng(hashSeed(profile.seed, Date.now() & 0xffff));
    this.time = 0;
    this.paused = false;
    this.inputBlocked = false;
    this.systems = [];
    this.player = new Player({});
    this.recomputeStats();
    this.player.hp = this.stats.maxHp;
    this.player.res = this.stats.resourceMax;
    this.rebuildPlayerRig();
  }

  get grid() { return this.zone.grid; }

  recomputeStats() {
    this.stats = computeStats(this.profile, equippedDefs(this.profile));
    this.player.maxHp = this.stats.maxHp;
    this.player.level = this.profile.level;
    if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
    this.bus.emit('stats', this.stats);
  }

  rebuildPlayerRig() {
    const w = equippedIn(this.profile, 'weapon'), a = equippedIn(this.profile, 'armor');
    this.player.setRig(buildPlayerRig(this.profile.classId, w?.material, a?.material), this.r.scene);
  }

  // Leave the current zone (disposing everything) and build the next one.
  enterZone(zoneId, arrival = null) {
    for (const s of this.systems) s.onZoneExit?.(this);
    if (this.view) { this.view.dispose(); this.view = null; }
    this.zone = getZone(zoneId);
    this.zoneDef = ZONES[zoneId];
    this.profile.zone = zoneId;
    this.profile.zones[zoneId] ||= { nodes: {}, fog: null };
    this.view = new ZoneView(this.r, this.zone, this.sky, this.settings.graphics);
    const p = arrival || this.zone.spawn;
    this.player.x = p.x; this.player.z = p.z;
    this.player.y = this.player.ry = this.grid.height(Math.floor(p.x), Math.floor(p.z));
    this.player.vx = this.player.vz = this.player.vy = 0;
    this.player.grounded = true;
    this.player.yaw = arrival?.yaw ?? this.zone.spawnYaw ?? Math.PI;
    this.cam.snapBehind(this.player.yaw);
    this.cam.pitch = this.zone.type === 'cave' ? 0.55 : 0.42;
    for (const s of this.systems) s.onZoneEnter?.(this);
    this.bus.emit('zoneEnter', { id: zoneId, def: this.zoneDef });
  }

  addSystem(s) { this.systems.push(s); s.init?.(this); return s; }

  update(dt) {
    this.time += dt;
    this.profile.playTime += dt;
    if (this.zone.type === 'island') {
      const before = this.dayNight.phase;
      this.dayNight.advance(dt);
      this.profile.world.clock = this.dayNight.clock;
      if (before !== this.dayNight.phase) this.bus.emit('phase', { phase: this.dayNight.phase });
    }
    this.player.update(dt, this);
    for (const s of this.systems) s.update?.(dt, this);
  }

  render(dt) {
    const target = this.lockTarget?.alive ? this.lockTarget : null;
    this.cam.update(dt, this.player, this.input, this.grid, target, !!this.player.kit?.animState?.aim, this.input.lastDevice === 'touch', this.zone.type === 'cave');
    this.player.render(dt);
    for (const s of this.systems) s.render?.(dt, this);
    const camPos = this.r.camera.position;
    this.view.update(dt, this.time, camPos);
    if (this.zone.type === 'island') {
      const dir = applyDayPalette(this.r, this.sky, this.dayNight.sun, this.dayNight.progress, this.dayNight.phase);
      this.r.sun.position.set(this.player.x + dir.x * 80, this.player.y + dir.y * 80, this.player.z + dir.z * 80);
    } else {
      this.r.sun.position.set(this.player.x + 20, this.player.y + 60, this.player.z + 10);
    }
    this.r.sun.target.position.set(this.player.x, this.player.y, this.player.z);
    // The lantern light sits between the player and the camera, so the visible side is lit.
    const f = this.cam.forward;
    this.r.playerLight.position.set(this.player.x - f.x * 1.5, this.player.ry + 3, this.player.z - f.z * 1.5);
    this.sky.follow(this.r.camera);
    this.r.render();
  }

  frame(dt) {
    if (!this.paused) this.update(dt);
    this.render(this.paused ? 0 : dt);
    this.input.endFrame();
  }
}
