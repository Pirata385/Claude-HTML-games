// Destructible voxel arena. Pure logic (no DOM): storage, damage with ragged
// craters, cracks and element stains, local structural checks, rigid chunks
// that fall or topple and settle as rubble, temporary voxels, ray casts and
// the queries physics needs.
(function (XS) {
  'use strict';

  // Physical archetypes; themes give them colours (see gen/arena.js).
  // hardness divides incoming damage; durability is 1 for every voxel.
  // brittle materials spread cracks to their neighbours when they shatter.
  const KINDS = {
    plating: { hardness: 8, texture: 'tile' },
    tile: { hardness: 1.2, texture: 'tile' },
    stone: { hardness: 1.5, texture: 'noise' },
    soil: { hardness: 1.0, texture: 'noise' },
    metal: { hardness: 2.2, texture: 'plate' },
    crystal: { hardness: 0.8, texture: 'crystal', brittle: true },
    glass: { hardness: 0.4, texture: 'crystal', brittle: true },
    organic: { hardness: 0.7, texture: 'grain' },
    wood: { hardness: 0.9, texture: 'grain' },
    ice: { hardness: 0.7, texture: 'crystal', brittle: true },
    jelly: { hardness: 0.6, texture: 'noise' },
    core: { hardness: 0.5, texture: 'glow', explosive: true, emissive: true },
    neon: { hardness: 1.3, texture: 'glow', emissive: true },
    summoned: { hardness: 0.8, texture: 'crystal', emissive: true },
  };

  const GRAV = 30;
  const CHUNK_MAX = 420;      // bigger loose clusters crumble voxel by voxel
  const FLOOD_LIMIT = 1600;   // a flood this big is assumed to be anchored
  // Crack level shown by the renderer: 0 intact, 1 cracked, 2 shattered.
  const crackOf = (hp) => (hp > 0.66 ? 0 : hp > 0.33 ? 1 : 2);

  class VoxelWorld {
    constructor(W, D, H) {
      this.W = W; this.D = D; this.H = H;
      const n = W * D * H;
      this.mat = new Uint8Array(n);
      this.hp = new Float32Array(n);
      this.stain = new Uint8Array(n);       // element marks (see Power.ELEMENTS[].stain)
      this.mark = new Uint32Array(n);       // flood-fill visit stamps
      this.epoch = 0;
      this.colTop = new Uint8Array(W * D); // highest solid z + 1 (0 = empty column)
      this.materials = [null];             // index 0 is air
      this.dirty = new Uint8Array(W + D);  // per-diagonal redraw flags for the renderer
      this.allDirty = true;
      this.version = 0;                     // bumps whenever a column changes
      this.temp = new Map();                // idx -> seconds left
      this.events = new XS.Emitter();
      this.needsSupport = false;
      this.supportSeeds = [];               // cells whose structure must be re-checked
      this.pendingBlasts = [];
      this.pendingCracks = [];
      this.brokenTotal = 0;
      this.chunks = [];
      this.salt = 0;
      this.clock = 0;
      this.lastHit = null;
      this.lastSource = null;
      this.rng = new XS.RNG(XS.hash(W, D, H, 'voxels'));
    }

    addMaterial(def) {
      const kind = KINDS[def.kind] || KINDS.stone;
      const m = Object.assign({ hardness: kind.hardness, texture: kind.texture, explosive: !!kind.explosive, emissive: !!kind.emissive, brittle: !!kind.brittle }, def);
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
    crackAt(i) { return this.mat[i] ? crackOf(this.hp[i]) : 0; }

    set(x, y, z, m) {
      if (!this.inside(x, y, z)) return;
      const i = this.idx(x, y, z);
      const was = this.mat[i];
      this.mat[i] = m;
      this.hp[i] = m ? 1 : 0;
      this.stain[i] = 0;
      if (!m) {
        this.temp.delete(i);
        if (was) this._seedAround(x, y, z);
      }
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
      this.version++;
    }

    _markDirty(x, y) {
      const d = x + y;
      for (let k = d - 1; k <= d + 1; k++) if (k >= 0 && k < this.dirty.length) this.dirty[k] = 1;
      if (this.onDirty) this.onDirty(x, y);
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

    // Damage every voxel inside a sphere whose radius is roughened per voxel,
    // so craters come out ragged. `power` is roughly "how many units of
    // durability" are removed at the centre for hardness 1. Voxels just past
    // the edge keep the element's stain (scorch, frost, acid...).
    // Returns the number of voxels broken (including chain reactions).
    damageSphere(cx, cy, cz, r, power, source, stain = 0) {
      if (power <= 0 || r <= 0) return 0;
      const salt = (this.salt = (this.salt + 1) & 0xffff);
      const R = r * 1.25 * (stain ? 1.2 : 1);
      let broken = 0;
      this.lastHit = { x: cx, y: cy, z: cz, r, power, t: this.clock };
      if (source) this.lastSource = source; // credited when what it broke crushes someone
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(this.W - 1, Math.floor(cx + R));
      const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(this.D - 1, Math.floor(cy + R));
      const z0 = Math.max(0, Math.floor(cz - R)), z1 = Math.min(this.H - 1, Math.floor(cz + R));
      for (let z = z0; z <= z1; z++) {
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = this.idx(x, y, z);
            const m = this.mat[i];
            if (!m) continue;
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz);
            if (d > R) continue;
            const rr = r * (0.75 + 0.5 * XS.hash3f(x * 7 + salt, y * 13 - salt, z * 3 + (salt >> 2)));
            if (d > rr) {
              if (stain && d < rr * 1.45 && this.stain[i] !== stain) { this.stain[i] = stain; this._markDirty(x, y); }
              continue;
            }
            const def = this.materials[m];
            if (def.indestructible) continue;
            const before = this.hp[i];
            this.hp[i] -= (power * (1 - 0.65 * (d / rr))) / def.hardness;
            if (this.hp[i] <= 0) {
              this._break(x, y, z, i, m, source);
              broken++;
            } else if (crackOf(before) !== crackOf(this.hp[i]) || (stain && this.stain[i] !== stain)) {
              if (stain) this.stain[i] = stain;
              this._markDirty(x, y);
            }
          }
        }
      }
      broken += this._settleChains(source);
      return broken;
    }

    // Cracks running through brittle neighbours, then energy cores going off.
    _settleChains(source) {
      let broken = 0, guard = 0;
      while ((this.pendingCracks.length || this.pendingBlasts.length) && guard++ < 64) {
        if (this.pendingCracks.length) {
          const i = this.pendingCracks.shift();
          const m = this.mat[i];
          if (!m || !this.materials[m].brittle) continue;
          const W = this.W, layer = W * this.D;
          const x = i % W, y = Math.floor(i / W) % this.D, z = Math.floor(i / layer);
          const before = this.hp[i];
          this.hp[i] -= (0.25 + 0.5 * this.rng.next()) / (this.materials[m].hardness + 0.4);
          if (this.hp[i] <= 0) { this._break(x, y, z, i, m, source); broken++; }
          else if (crackOf(before) !== crackOf(this.hp[i])) this._markDirty(x, y);
          continue;
        }
        const b = this.pendingBlasts.shift();
        this.events.emit('blast', b);
        broken += this.damageSphere(b.x, b.y, b.z, b.r, b.power, b.source, 1);
      }
      this.pendingCracks.length = 0;
      return broken;
    }

    _break(x, y, z, i, m, source) {
      const def = this.materials[m];
      this.mat[i] = 0;
      this.hp[i] = 0;
      this.stain[i] = 0;
      this.temp.delete(i);
      this._refreshColumn(x, y);
      this._markDirty(x, y);
      this._seedAround(x, y, z);
      this.brokenTotal++;
      this.events.emit('break', { x, y, z, m, def, source });
      if (def.explosive) this.pendingBlasts.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, r: 2.6, power: 2.4, source });
      if (def.brittle && this.pendingCracks.length < 24) {
        for (const j of this._neighbours(x, y, z)) if (this.mat[j] && this.materials[this.mat[j]].brittle && this.rng.chance(0.55)) this.pendingCracks.push(j);
      }
    }

    _neighbours(x, y, z) {
      const out = [], layer = this.W * this.D, i = this.idx(x, y, z);
      if (x > 0) out.push(i - 1);
      if (x < this.W - 1) out.push(i + 1);
      if (y > 0) out.push(i - this.W);
      if (y < this.D - 1) out.push(i + this.W);
      if (z > 0) out.push(i - layer);
      if (z < this.H - 1) out.push(i + layer);
      return out;
    }

    _seedAround(x, y, z) {
      this.needsSupport = true;
      if (this.supportSeeds.length < 4096) for (const j of this._neighbours(x, y, z)) this.supportSeeds.push(j);
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

    // Local structural check: flood from the cells around recent breaks.
    // Clusters that never reach the bottom layer (z = 0) come loose as rigid
    // chunks; very big loose clusters crumble voxel by voxel ('fall').
    checkSupport() {
      this.needsSupport = false;
      const seeds = this.supportSeeds;
      this.supportSeeds = [];
      const ep = ++this.epoch;
      let loose = 0;
      for (const s of seeds) {
        if (!this.mat[s] || this.mark[s] === ep) continue;
        const res = this._flood(s, ep);
        if (res) { this._detach(res); loose += res.length; }
      }
      return loose;
    }

    // Depth-first flood that dives toward z = 0 first. Returns the cells of a
    // floating cluster, or null if the cluster is anchored (or too big).
    _flood(start, ep) {
      const W = this.W, D = this.D, layer = W * D, H = this.H;
      const stack = [start], cells = [start];
      this.mark[start] = ep;
      while (stack.length) {
        const i = stack.pop();
        const z = Math.floor(i / layer);
        if (z === 0) return null;
        const x = i % W, y = Math.floor(i / W) % D;
        // Pushed last = explored first: down, then sideways, then up.
        const nb = [z < H - 1 ? i + layer : -1, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < D - 1 ? i + W : -1, i - layer];
        for (const j of nb) {
          if (j < 0 || this.mark[j] === ep || !this.mat[j]) continue;
          this.mark[j] = ep;
          stack.push(j);
          cells.push(j);
        }
        if (cells.length > FLOOD_LIMIT) return null;
      }
      return cells;
    }

    _detach(cells) {
      const W = this.W, D = this.D, layer = W * D;
      const cols = new Set();
      if (cells.length > CHUNK_MAX) {
        for (const i of cells) {
          const m = this.mat[i], x = i % W, y = Math.floor(i / W) % D, z = Math.floor(i / layer);
          this.mat[i] = 0; this.hp[i] = 0; this.stain[i] = 0; this.temp.delete(i);
          cols.add(x + y * W);
          this.events.emit('fall', { x, y, z, m, def: this.materials[m] });
        }
        for (const c of cols) { this._refreshColumn(c % W, Math.floor(c / W)); this._markDirty(c % W, Math.floor(c / W)); }
        return;
      }
      const vox = [];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity, sx = 0, sy = 0;
      for (const i of cells) {
        const x = i % W, y = Math.floor(i / W) % D, z = Math.floor(i / layer);
        vox.push({ x, y, z, m: this.mat[i], hp: this.hp[i], stain: this.stain[i], temp: this.temp.get(i) || 0 });
        this.mat[i] = 0; this.hp[i] = 0; this.stain[i] = 0; this.temp.delete(i);
        cols.add(x + y * W);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        sx += x + 0.5; sy += y + 0.5;
      }
      for (const c of cols) { this._refreshColumn(c % W, Math.floor(c / W)); this._markDirty(c % W, Math.floor(c / W)); }
      const n = vox.length, cx = sx / n, cy = sy / n;
      // Shove from the blast that broke it (if recent and close).
      let dx = this.rng.range(-1, 1), dy = this.rng.range(-1, 1), push = 0.5;
      const h = this.lastHit;
      if (h && this.clock - h.t < 0.25 && Math.hypot(h.x - cx, h.y - cy) < h.r + 8) {
        dx = cx - h.x; dy = cy - h.y;
        push = Math.min(5, 0.6 + h.power * 0.25);
      }
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      const height = maxZ - minZ + 1, width = Math.max(maxX - minX, maxY - minY) + 1;
      const chunk = {
        vox, n, mode: 'fall', t: 0, ox: 0, oy: 0, oz: 0, vx: dx * push / Math.sqrt(Math.max(1, n / 8)), vy: dy * push / Math.sqrt(Math.max(1, n / 8)), vz: 0,
        cx, cy, minZ, maxZ, source: this.lastSource || null, hit: new Set(),
      };
      // Tall and thin: topple over its base edge, away from the blow.
      if (height >= 3 && height >= width * 2) {
        chunk.mode = 'topple';
        chunk.dir = { x: dx, y: dy };
        chunk.px = cx + dx * width * 0.5; chunk.py = cy + dy * width * 0.5; chunk.pz = minZ;
        chunk.ang = 0.04; chunk.angV = 0.6 + push * 0.15; chunk.L = height;
      }
      this.chunks.push(chunk);
      this.events.emit('chunk', { chunk, x: cx, y: cy, z: minZ, n });
    }

    // World position of a chunk voxel's corner right now.
    chunkVoxelPos(c, v) {
      if (c.mode !== 'topple') return { x: v.x + c.ox, y: v.y + c.oy, z: v.z + c.oz };
      const ux = c.dir.x, uy = c.dir.y;
      const rx = v.x + 0.5 - c.px, ry = v.y + 0.5 - c.py, rz = v.z + 0.5 - c.pz;
      const u = rx * ux + ry * uy, w = -rx * uy + ry * ux;
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang);
      const u2 = u * ca + rz * sa, z2 = -u * sa + rz * ca;
      return { x: c.px + ux * u2 - uy * w - 0.5, y: c.py + uy * u2 + ux * w - 0.5, z: c.pz + z2 - 0.5 };
    }

    _stepChunks(dt) {
      for (const c of this.chunks) {
        c.t += dt;
        if (c.mode === 'topple') {
          c.angV += (1.5 * GRAV / c.L) * Math.sin(c.ang) * dt;
          c.ang += c.angV * dt;
          let hit = c.ang >= Math.PI / 2 - 0.05;
          if (!hit && c.ang > 0.25) {
            for (const v of c.vox) {
              const p = this.chunkVoxelPos(c, v);
              if (this.solid(Math.round(p.x), Math.round(p.y), Math.floor(p.z + 0.2))) { hit = true; break; }
            }
          }
          if (hit) this._toFall(c);
          continue;
        }
        c.vz -= GRAV * dt;
        const nz = c.oz + c.vz * dt, nx = c.ox + c.vx * dt, ny = c.oy + c.vy * dt;
        let land = false, lift = -Infinity;
        for (const v of c.vox) {
          const gx = Math.round(v.x + nx), gy = Math.round(v.y + ny), gz = Math.floor(v.z + nz);
          if (this.solid(gx, gy, gz)) { land = true; lift = Math.max(lift, gz + 1 - v.z); }
        }
        if (land || c.t > 6) { c.oz = land ? Math.max(Math.min(lift, c.oz + 1), nz) : nz; c.ox = nx; c.oy = ny; this._settle(c, land); }
        else { c.ox = nx; c.oy = ny; c.oz = nz; }
        if (c.oz + c.minZ < -14) c.dead = true;
      }
      if (this.chunks.some((c) => c.dead)) this.chunks = this.chunks.filter((c) => !c.dead);
    }

    // A toppled chunk lies down: freeze its rotated layout and let it drop.
    _toFall(c) {
      const vx = c.dir.x * c.angV * c.L * 0.25, vy = c.dir.y * c.angV * c.L * 0.25;
      c.vox = c.vox.map((v) => {
        const p = this.chunkVoxelPos(c, v);
        return Object.assign({}, v, { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) });
      });
      c.mode = 'fall';
      c.ox = c.oy = c.oz = 0;
      c.vx = vx * 0.2; c.vy = vy * 0.2; c.vz = -c.angV * c.L * 0.3;
      c.minZ = Math.min(...c.vox.map((v) => v.z));
    }

    // Land: snap to the grid, keep most voxels as cracked rubble, shatter the rest.
    _settle(c, landed) {
      c.dead = true;
      if (!landed) return;
      const speed = Math.abs(c.vz);
      const shatter = Math.min(0.6, 0.18 + speed * 0.02);
      const OX = Math.round(c.ox), OY = Math.round(c.oy), OZ = Math.round(c.oz);
      let placed = 0, sx = 0, sy = 0, sz = 0;
      const sorted = c.vox.slice().sort((a, b) => a.z - b.z);
      for (const v of sorted) {
        const x = v.x + OX, y = v.y + OY;
        let z = v.z + OZ;
        if (!this.inside(x, y, 0)) continue;
        if (this.rng.chance(shatter)) {
          this.events.emit('break', { x, y, z: Math.max(0, z), m: v.m, def: this.materials[v.m], source: c.source });
          continue;
        }
        while (z < this.H && z >= 0 && this.mat[this.idx(x, y, z)]) z++;
        if (z < 0 || z >= this.H) continue;
        // Rubble needs something under it (or it simply tumbles off as debris).
        if (z > 0 && !this.mat[this.idx(x, y, z - 1)]) {
          let zz = z;
          while (zz > 0 && !this.mat[this.idx(x, y, zz - 1)]) zz--;
          if (zz === 0) { this.events.emit('fall', { x, y, z, m: v.m, def: this.materials[v.m] }); continue; }
          z = zz;
        }
        const i = this.idx(x, y, z);
        this.mat[i] = v.m;
        this.hp[i] = Math.min(v.hp, 0.6);
        this.stain[i] = v.stain;
        if (v.temp) this.temp.set(i, v.temp);
        this._refreshColumn(x, y);
        this._markDirty(x, y);
        placed++; sx += x + 0.5; sy += y + 0.5; sz += z;
      }
      const n = Math.max(1, placed);
      this.events.emit('chunkLand', { x: placed ? sx / n : c.cx + c.ox, y: placed ? sy / n : c.cy + c.oy, z: placed ? sz / n : c.minZ + c.oz, n: c.n, placed, speed, source: c.source });
    }

    update(dt) {
      this.clock += dt;
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
      if (this.chunks.length) this._stepChunks(dt);
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
            if (this.isSafe(xx, yy, headroom)) candidates.push({ x: xx + 0.5, y: yy + 0.5, z: this.colTop[xx + yy * this.W] });
          }
        }
        if (candidates.length) return rng ? rng.pick(candidates) : candidates[0];
      }
      return { x: this.W / 2, y: this.D / 2, z: this.H };
    }

    isSafe(x, y, headroom) {
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
  XS.crackOf = crackOf;
})(globalThis.XS = globalThis.XS || {});
