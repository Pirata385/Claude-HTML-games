// Destructible voxel arena. Pure logic (no DOM): storage, damage, structural
// collapse, temporary voxels, ray casts and the queries physics needs.
(function (XS) {
  'use strict';

  // Physical archetypes; themes give them colours (see gen/arena.js).
  // hardness divides incoming damage; durability is 1 for every voxel.
  const KINDS = {
    plating: { hardness: 9, texture: 'tile' },
    tile: { hardness: 2.2, texture: 'tile' },
    stone: { hardness: 2.6, texture: 'noise' },
    soil: { hardness: 1.6, texture: 'noise' },
    metal: { hardness: 4, texture: 'plate' },
    crystal: { hardness: 1.3, texture: 'crystal' },
    glass: { hardness: 0.6, texture: 'crystal' },
    organic: { hardness: 1.0, texture: 'grain' },
    wood: { hardness: 1.4, texture: 'grain' },
    ice: { hardness: 1.0, texture: 'crystal' },
    jelly: { hardness: 0.8, texture: 'noise' },
    core: { hardness: 0.7, texture: 'glow', explosive: true, emissive: true },
    neon: { hardness: 2.0, texture: 'glow', emissive: true },
    summoned: { hardness: 1.1, texture: 'crystal', emissive: true },
  };

  class VoxelWorld {
    constructor(W, D, H) {
      this.W = W; this.D = D; this.H = H;
      const n = W * D * H;
      this.mat = new Uint8Array(n);
      this.hp = new Float32Array(n);
      this.colTop = new Uint8Array(W * D); // highest solid z + 1 (0 = empty column)
      this.materials = [null];             // index 0 is air
      this.dirty = new Uint8Array(W + D);  // per-diagonal redraw flags for the renderer
      this.allDirty = true;
      this.temp = new Map();                // idx -> seconds left
      this.events = new XS.Emitter();
      this.needsSupport = false;
      this.pendingBlasts = [];
      this.brokenTotal = 0;
    }

    addMaterial(def) {
      const kind = KINDS[def.kind] || KINDS.stone;
      const m = Object.assign({ hardness: kind.hardness, texture: kind.texture, explosive: !!kind.explosive, emissive: !!kind.emissive }, def);
      this.materials.push(m);
      if (this.materials.length > 255) throw new Error('too many materials');
      return this.materials.length - 1;
    }

    idx(x, y, z) { return x + this.W * (y + this.D * z); }
    inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.W && y < this.D && z < this.H; }
    get(x, y, z) {
      x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
      return this.inside(x, y, z) ? this.mat[this.idx(x, y, z)] : 0;
    }
    solid(x, y, z) { return this.get(x, y, z) !== 0; }

    set(x, y, z, m) {
      if (!this.inside(x, y, z)) return;
      const i = this.idx(x, y, z);
      this.mat[i] = m;
      this.hp[i] = m ? 1 : 0;
      if (!m) this.temp.delete(i);
      this._refreshColumn(x, y);
      this._markDirty(x, y);
    }

    // A voxel that crumbles on its own after `seconds`.
    setTemp(x, y, z, m, seconds) {
      if (!this.inside(x, y, z) || this.mat[this.idx(x, y, z)]) return false;
      this.set(x, y, z, m);
      this.temp.set(this.idx(x, y, z), seconds);
      return true;
    }

    _refreshColumn(x, y) {
      let top = 0;
      for (let z = this.H - 1; z >= 0; z--) {
        if (this.mat[this.idx(x, y, z)]) { top = z + 1; break; }
      }
      this.colTop[x + y * this.W] = top;
    }

    _markDirty(x, y) {
      const d = x + y;
      for (let k = d - 1; k <= d + 1; k++) if (k >= 0 && k < this.dirty.length) this.dirty[k] = 1;
    }

    refreshAll() {
      for (let y = 0; y < this.D; y++) for (let x = 0; x < this.W; x++) this._refreshColumn(x, y);
      this.allDirty = true;
    }

    // Top of the column (the z an entity would stand on), or -Infinity over void.
    topAt(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.W || y >= this.D) return -Infinity;
      const t = this.colTop[x + y * this.W];
      return t === 0 ? -Infinity : t;
    }

    // Highest floor at or below height z (+ tolerance) in a column; handles
    // overhangs. Returns -Infinity if nothing below.
    groundAt(x, y, z, tolerance = 0.5) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.W || y >= this.D) return -Infinity;
      let zz = Math.min(this.H - 1, Math.floor(z + tolerance) - 1);
      for (; zz >= 0; zz--) if (this.mat[this.idx(x, y, zz)]) return zz + 1;
      return -Infinity;
    }

    // True if any solid voxel occupies the vertical span [z0, z1) of a column.
    blockedSpan(x, y, z0, z1) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.W || y >= this.D) return false;
      const a = Math.max(0, Math.floor(z0)), b = Math.min(this.H, Math.ceil(z1));
      for (let z = a; z < b; z++) if (this.mat[this.idx(x, y, z)]) return true;
      return false;
    }

    // Damage every voxel inside a sphere. `power` is roughly "how many units of
    // durability" are removed at the centre for hardness 1.
    // Returns the number of voxels broken (including chain reactions).
    damageSphere(cx, cy, cz, r, power, source) {
      if (power <= 0 || r <= 0) return 0;
      let broken = 0;
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.W - 1, Math.floor(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.D - 1, Math.floor(cy + r));
      const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(this.H - 1, Math.floor(cz + r));
      for (let z = z0; z <= z1; z++) {
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = this.idx(x, y, z);
            const m = this.mat[i];
            if (!m) continue;
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz);
            if (d > r) continue;
            const def = this.materials[m];
            if (def.indestructible) continue;
            this.hp[i] -= (power * (1 - 0.65 * (d / r))) / def.hardness;
            if (this.hp[i] <= 0) {
              this._break(x, y, z, i, m, source);
              broken++;
            }
          }
        }
      }
      // Explosive voxels (energy cores) chain into more blasts.
      let guard = 0;
      while (this.pendingBlasts.length && guard++ < 24) {
        const b = this.pendingBlasts.shift();
        this.events.emit('blast', b);
        broken += this.damageSphere(b.x, b.y, b.z, b.r, b.power, b.source);
      }
      return broken;
    }

    _break(x, y, z, i, m, source) {
      const def = this.materials[m];
      this.mat[i] = 0;
      this.hp[i] = 0;
      this.temp.delete(i);
      this._refreshColumn(x, y);
      this._markDirty(x, y);
      this.needsSupport = true;
      this.brokenTotal++;
      this.events.emit('break', { x, y, z, m, def, source });
      if (def.explosive) this.pendingBlasts.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, r: 2.6, power: 2.4, source });
    }

    // Grow voxels of material m inside a sphere (only into air). Returns count.
    growSphere(cx, cy, cz, r, m, seconds, density = 1, rng = null) {
      let n = 0;
      for (let z = Math.floor(cz - r); z <= cz + r; z++) {
        for (let y = Math.floor(cy - r); y <= cy + r; y++) {
          for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz) > r) continue;
            if (density < 1 && (rng ? rng.next() : Math.random()) > density) continue;
            // Only grow supported voxels so they don't instantly collapse.
            if (z > 0 && !this.solid(x, y, z - 1)) continue;
            if (this.setTemp(x, y, z, m, seconds * (0.85 + 0.3 * (rng ? rng.next() : Math.random())))) n++;
          }
        }
      }
      return n;
    }

    // Remove voxels no longer connected to the bottom layer (z = 0).
    // Each removed voxel is reported with a 'fall' event so FX can drop it.
    checkSupport() {
      this.needsSupport = false;
      const { W, D, H } = this;
      const n = W * D * H;
      const seen = new Uint8Array(n);
      const queue = new Int32Array(n);
      let head = 0, tail = 0;
      for (let y = 0; y < D; y++) {
        for (let x = 0; x < W; x++) {
          const i = this.idx(x, y, 0);
          if (this.mat[i]) { seen[i] = 1; queue[tail++] = i; }
        }
      }
      const layer = W * D;
      while (head < tail) {
        const i = queue[head++];
        const x = i % W, y = Math.floor(i / W) % D, z = Math.floor(i / layer);
        const nb = [
          x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1,
          y > 0 ? i - W : -1, y < D - 1 ? i + W : -1,
          z > 0 ? i - layer : -1, z < H - 1 ? i + layer : -1,
        ];
        for (const j of nb) {
          if (j >= 0 && !seen[j] && this.mat[j]) { seen[j] = 1; queue[tail++] = j; }
        }
      }
      let fallen = 0;
      for (let i = 0; i < n; i++) {
        if (this.mat[i] && !seen[i]) {
          const m = this.mat[i];
          const x = i % W, y = Math.floor(i / W) % D, z = Math.floor(i / layer);
          this.mat[i] = 0; this.hp[i] = 0; this.temp.delete(i);
          this._refreshColumn(x, y);
          this._markDirty(x, y);
          this.events.emit('fall', { x, y, z, m, def: this.materials[m] });
          fallen++;
        }
      }
      return fallen;
    }

    update(dt) {
      if (this.temp.size) {
        for (const [i, t] of this.temp) {
          const left = t - dt;
          if (left > 0) { this.temp.set(i, left); continue; }
          const W = this.W, layer = W * this.D;
          const x = i % W, y = Math.floor(i / W) % this.D, z = Math.floor(i / layer);
          const m = this.mat[i];
          if (m) this._break(x, y, z, i, m, null);
          else this.temp.delete(i);
        }
      }
      if (this.needsSupport) this.checkSupport();
    }

    // Voxel DDA (Amanatides & Woo) from a to b. Returns the first solid voxel hit
    // with the entry point and face normal, or null.
    raycast(ax, ay, az, bx, by, bz) {
      const dx = bx - ax, dy = by - ay, dz = bz - az;
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-6) return null;
      let x = Math.floor(ax), y = Math.floor(ay), z = Math.floor(az);
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
      const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
      const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
      const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
      let tmx = dx !== 0 ? (dx > 0 ? x + 1 - ax : ax - x) * tdx : Infinity;
      let tmy = dy !== 0 ? (dy > 0 ? y + 1 - ay : ay - y) * tdy : Infinity;
      let tmz = dz !== 0 ? (dz > 0 ? z + 1 - az : az - z) * tdz : Infinity;
      let t = 0, nx = 0, ny = 0, nz = 0;
      for (let guard = 0; guard < 512; guard++) {
        if (this.inside(x, y, z) && this.mat[this.idx(x, y, z)]) {
          return { x, y, z, t, px: ax + dx * t, py: ay + dy * t, pz: az + dz * t, nx, ny, nz };
        }
        if (tmx < tmy && tmx < tmz) { t = tmx; tmx += tdx; x += sx; nx = -sx; ny = 0; nz = 0; }
        else if (tmy < tmz) { t = tmy; tmy += tdy; y += sy; nx = 0; ny = -sy; nz = 0; }
        else { t = tmz; tmz += tdz; z += sz; nx = 0; ny = 0; nz = -sz; }
        if (t > 1) return null;
      }
      return null;
    }

    // Nearest walkable column to (x, y): solid top, clear headroom, not at the
    // rim. Used for spawns and respawns after a fall.
    findSafeSpot(x, y, headroom = 4, rng = null) {
      const cx = Math.floor(x), cy = Math.floor(y);
      const maxR = Math.max(this.W, this.D);
      for (let r = 0; r < maxR; r++) {
        const candidates = [];
        for (let yy = cy - r; yy <= cy + r; yy++) {
          for (let xx = cx - r; xx <= cx + r; xx++) {
            if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== r) continue;
            if (this._safe(xx, yy, headroom)) candidates.push({ x: xx + 0.5, y: yy + 0.5, z: this.colTop[xx + yy * this.W] });
          }
        }
        if (candidates.length) return rng ? rng.pick(candidates) : candidates[0];
      }
      return { x: this.W / 2, y: this.D / 2, z: this.H };
    }

    _safe(x, y, headroom) {
      if (x < 1 || y < 1 || x >= this.W - 1 || y >= this.D - 1) return false;
      const t = this.colTop[x + y * this.W];
      if (!t) return false;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nt = this.colTop[x + ox + (y + oy) * this.W];
          if (!nt || Math.abs(nt - t) > 1) return false;
          if (this.blockedSpan(x + ox, y + oy, t + 1, t + headroom)) return false;
        }
      }
      return true;
    }

    count() {
      let n = 0;
      for (let i = 0; i < this.mat.length; i++) if (this.mat[i]) n++;
      return n;
    }
  }

  XS.VOXEL_KINDS = KINDS;
  XS.VoxelWorld = VoxelWorld;
})(globalThis.XS = globalThis.XS || {});
