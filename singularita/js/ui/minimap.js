// Minimap and full map: a pre-rendered zone image with fog of war, points of interest and foes.
import { SURF, F, isWalled } from '../world/grid.js';
import { FogMap } from '../systems/fog.js';

const COL = {
  [SURF.SAND]: [226, 206, 150], [SURF.GRASS]: [96, 176, 88], [SURF.FOREST]: [58, 132, 70], [SURF.ROCK]: [140, 143, 150], [SURF.PATH]: [196, 166, 112],
  [SURF.DIRT]: [138, 94, 62], [SURF.BASE]: [190, 172, 140], [SURF.SNOW]: [232, 238, 242], [SURF.ARENA]: [170, 210, 110], [SURF.SEABED]: [38, 92, 150],
  [SURF.FLOOR]: [96, 88, 80], [SURF.WALL]: [24, 22, 26], [SURF.HOT]: [128, 62, 44], [SURF.COLD]: [58, 86, 128],
  [SURF.LAVA]: [255, 106, 26], [SURF.BASALT]: [58, 50, 54], [SURF.ROOT]: [122, 84, 52], [SURF.CORAL]: [255, 138, 168], [SURF.BRIDGE]: [154, 106, 58],
  [SURF.ADAMITE]: [138, 74, 200], [SURF.GEL]: [232, 196, 220], [SURF.GLASS]: [200, 222, 240], [SURF.CARPET]: [122, 42, 58],
};

export class Minimap {
  constructor(game, canvas) {
    this.g = game; this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.img = null; this.fog = null; this.zone = null;
    this.mask = document.createElement('canvas');
    this.revealT = 0;
  }

  setZone(zone) {
    this.saveFog();
    this.zone = zone;
    const g = zone.grid;
    const c = document.createElement('canvas');
    c.width = g.w; c.height = g.d;
    const ctx = c.getContext('2d');
    const im = ctx.createImageData(g.w, g.d);
    const cave = isWalled(zone);
    for (let j = 0; j < g.d; j++) for (let i = 0; i < g.w; i++) {
      const k = g.idx(i, j);
      let col = g.flags[k] & F.VOID ? [206, 224, 242] : COL[g.surf[k]] || [255, 0, 255];
      let shade = cave ? 1 : 0.82 + Math.min(0.3, (g.h[k] - 3) * 0.015);
      if (g.flags[k] & F.OBSTACLE && !cave) shade *= 0.8;
      const o = k * 4;
      im.data[o] = col[0] * shade; im.data[o + 1] = col[1] * shade; im.data[o + 2] = col[2] * shade; im.data[o + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    this.img = c;
    const st = this.g.profile.zones[zone.id];
    this.fog = FogMap.decode(g.w, g.d, st?.fog);
    this.mask.width = this.fog.w; this.mask.height = this.fog.d;
    this.maskDirty = true;
  }

  saveFog() {
    if (this.fog && this.zone && this.fog.dirty) { this.g.profile.zones[this.zone.id].fog = this.fog.encode(); this.fog.dirty = false; }
  }

  rebuildMask() {
    const m = this.mask.getContext('2d'), f = this.fog;
    const im = m.createImageData(f.w, f.d);
    for (let cj = 0; cj < f.d; cj++) for (let ci = 0; ci < f.w; ci++) { const o = (cj * f.w + ci) * 4; im.data[o] = 8; im.data[o + 1] = 10; im.data[o + 2] = 20; im.data[o + 3] = f.seenCell(ci, cj) ? 0 : 235; }
    m.putImageData(im, 0, 0);
    this.maskDirty = false;
  }

  pois() {
    const g = this.g, z = this.zone, out = [];
    if (z.type === 'island') {
      out.push({ x: z.base.x, z: z.base.z, icon: '✦', color: '#ffe9a0', label: 'Camp' });
      out.push({ x: z.caveMouth.x, z: z.caveMouth.z, icon: '▼', color: '#f2ece0', label: 'Hollow Deep' });
      const bossAt = g.spawner?.boss && !g.spawner.boss.defeated ? g.spawner.boss.def.arena : null;
      for (const a of Object.values(z.arenas)) out.push({ x: a.x, z: a.z, icon: bossAt === a.id ? '☠' : '◎', color: bossAt === a.id ? '#ff4a3a' : '#c9b48a', label: a.name, always: bossAt === a.id });
    } else if (z.type === 'dimension') {
      out.push({ x: z.entry.x, z: z.entry.z, icon: '◎', color: '#c48cff', label: 'The way back' });
      if (z.exit) out.push({ x: z.exit.x, z: z.exit.z, icon: '▼', color: z.exit.locked ? '#8a8494' : '#f2ece0', label: z.exit.locked ? 'Locked stair' : 'Stair down', always: true });
      if (z.arena) out.push({ x: z.arena.x, z: z.arena.z, icon: g.spawner?.boss ? '☠' : '◎', color: g.spawner?.boss ? '#ff4a3a' : '#c9b48a', label: z.arena.name, always: true });
      for (const l of z.levers || []) out.push({ x: l.x, z: l.z, icon: l.pulled ? '·' : '⚲', color: '#ffd166', label: 'Lever' });
      for (const pl of z.plates || []) out.push({ x: pl.left.x, z: pl.left.z, icon: '◇', color: '#9fe0ff', label: 'Mirror plate' });
      if (g.portalOut) out.push({ x: g.portalOut.x, z: g.portalOut.z, icon: '◎', color: '#ffe9a8', label: 'Exit portal', always: true });
    } else if (z.type === 'isle') {
      out.push({ x: z.landing.x, z: z.landing.z, icon: '✦', color: '#ffe9a0', label: 'Return stone' });
      const here = g.spawner?.boss && !g.spawner.boss.defeated;
      out.push({ x: z.arena.x, z: z.arena.z, icon: here ? '☠' : '◎', color: here ? '#ff4a3a' : '#c9b48a', label: z.arena.name, always: true });
      for (const u of z.updrafts) out.push({ x: u.x, z: u.z, icon: '↑', color: '#cfefff', label: 'Updraft' });
    } else {
      out.push({ x: z.entry.x, z: z.entry.z, icon: '▲', color: '#9ff0e0', label: 'Stairs up' });
      const ex = { gate: ['⛩', '#c48cff', 'Sealed Core Gate'], heart: ['♥', '#ffe9a8', 'The Heart Seal'], core: ['✦', '#f4e8ff', 'The Singular Heart'], shaft: ['▼', '#f2ece0', 'Way down'] }[z.exit.type];
      out.push({ x: z.exit.x, z: z.exit.z, icon: ex[0], color: ex[1], label: ex[2] });
    }
    for (const p of z.pois) if (p.type === 'lore') out.push({ x: p.x, z: p.z, icon: '◆', color: g.profile.lore.includes(p.id) ? '#8a8494' : '#c48cff', label: 'Echo Stone' });
    return out;
  }

  draw() {
    if (!this.img) return;
    const g = this.g, p = g.player, z = this.zone;
    this.fog.reveal(p.x, p.z, isWalled(z) ? 14 : 24);
    if (this.fog.dirty) { this.maskDirty = true; this.revealT++; if (this.revealT % 20 === 0) this.saveFog(); }
    if (this.maskDirty) this.rebuildMask();
    const ctx = this.ctx, W = this.cv.width, R = isWalled(z) ? 34 : 50;
    const s = W / (R * 2);
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = isWalled(z) ? '#0a0a10' : '#1d4f7a'; ctx.fillRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.img, p.x - R, p.z - R, R * 2, R * 2, 0, 0, W, W);
    ctx.drawImage(this.mask, (p.x - R) / 4, (p.z - R) / 4, R / 2, R / 2, 0, 0, W, W);
    const toS = (x, zz) => [(x - p.x + R) * s, (zz - p.z + R) * s];
    for (const e of g.enemies.list) {
      if (!e.alive || e.untargetable || e.alpha < 0.3) continue;
      const [sx, sy] = toS(e.x, e.z);
      if (sx < 0 || sy < 0 || sx > W || sy > W) continue;
      ctx.fillStyle = e.boss ? '#ff3a3a' : e.elite ? '#ffb347' : '#ff6a6a';
      ctx.fillRect(sx - (e.boss ? 4 : 2), sy - (e.boss ? 4 : 2), e.boss ? 8 : 4, e.boss ? 8 : 4);
    }
    ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const poi of this.pois()) {
      if (!poi.always && !this.fog.seenAt(poi.x, poi.z)) continue;
      let [sx, sy] = toS(poi.x, poi.z);
      const dx = sx - W / 2, dy = sy - W / 2, d = Math.hypot(dx, dy);
      if (d > W / 2 - 10) { if (!poi.always && poi.icon !== '▼' && poi.icon !== '✦') continue; sx = W / 2 + (dx / d) * (W / 2 - 10); sy = W / 2 + (dy / d) * (W / 2 - 10); }
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(poi.icon, sx + 1, sy + 1);
      ctx.fillStyle = poi.color; ctx.fillText(poi.icon, sx, sy);
    }
    // Player arrow and view cone.
    ctx.translate(W / 2, W / 2);
    const cy = g.cam.yaw;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 40, Math.PI / 2 - cy - 0.5, Math.PI / 2 - cy + 0.5); ctx.closePath(); ctx.fill();
    ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,226,170,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffe9a0'; ctx.font = 'bold 11px system-ui'; ctx.fillText('N', W / 2, 10);
  }

  // Whole-zone map for the Map tab.
  drawFull(canvas) {
    if (!this.img) return;
    if (this.maskDirty) this.rebuildMask();
    const g = this.g, z = this.zone, ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, gw = z.grid.w, gd = z.grid.d;
    const s = Math.min(W / gw, H / gd), ox = (W - gw * s) / 2, oy = (H - gd * s) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = isWalled(z) ? '#0a0a10' : '#1d4f7a'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.img, ox, oy, gw * s, gd * s);
    ctx.drawImage(this.mask, ox, oy, gw * s, gd * s);
    ctx.font = `${Math.max(12, s * 6)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const poi of this.pois()) {
      if (!poi.always && !this.fog.seenAt(poi.x, poi.z)) continue;
      const sx = ox + poi.x * s, sy = oy + poi.z * s;
      ctx.fillStyle = '#000'; ctx.fillText(poi.icon, sx + 1, sy + 1); ctx.fillStyle = poi.color; ctx.fillText(poi.icon, sx, sy);
      ctx.font = `${Math.max(10, s * 4)}px system-ui`; ctx.fillStyle = '#f3eedf'; ctx.fillText(poi.label, sx, sy + Math.max(12, s * 6)); ctx.font = `${Math.max(12, s * 6)}px system-ui`;
    }
    const p = g.player;
    ctx.save(); ctx.translate(ox + p.x * s, oy + p.z * s); ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 8); ctx.lineTo(0, 4); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
