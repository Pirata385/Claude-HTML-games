/* Planolândia — salas 3D, consultas de sólidos na fatia e validação das conexões do mapa. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const G3 = PL.G3, C2 = PL.C2;

  const MASK_SOLID = 1, MASK_HAZARD = 2, MASK_ALL = 3;
  const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top', near: 'far', far: 'near' };

  const defs = {};
  function defRoom(def) {
    if (defs[def.id]) throw new Error('sala repetida: ' + def.id);
    def.exits = def.exits || [];
    defs[def.id] = def;
    return def;
  }

  // construtor usado pelas salas para declarar sólidos e entidades
  function Builder(room, state) {
    this.room = room;
    this.state = state || {};
    this.prims = [];
    this.ents = [];
    this.mat = 'pedra';
  }
  const BP = Builder.prototype;
  BP.add = function (p) { if (p.mat === 'pedra' && this.mat !== 'pedra') p.mat = this.mat; this.prims.push(p); return p; };
  BP.opts = function (o) { return Object.assign({ mat: this.mat }, o || {}); };
  BP.box = function (x, y, w, h, z0, z1, o) { return this.add(G3.box(x, y, w, h, z0 === undefined ? 0 : z0, z1 === undefined ? this.room.d : z1, this.opts(o))); };
  BP.prism = function (pts, z0, z1, o) { return this.add(G3.prism(pts, z0, z1, this.opts(o))); };
  BP.loft = function (a, zA, b, zB, o) { return this.add(G3.loft(a, zA, b, zB, this.opts(o))); };
  BP.cuboid = function (cx, cy, cz, w, h, d, rot, o) { return this.add(G3.cuboid(cx, cy, cz, w, h, d, rot, this.opts(o))); };
  BP.pyramid = function (cx, yb, cz, w, d, h, o) { return this.add(G3.pyramid(cx, yb, cz, w, d, h, this.opts(o))); };
  BP.rod = function (x0, y0, z0, x1, y1, z1, t, o) { return this.add(G3.rod(x0, y0, z0, x1, y1, z1, t, this.opts(o))); };
  BP.sphere = function (cx, cy, cz, r, o) { return this.add(G3.sphere(cx, cy, cz, r, this.opts(o))); };
  BP.cyl = function (axis, cx, cy, cz, r, hl, o) { return this.add(G3.cyl(axis, cx, cy, cz, r, hl, this.opts(o))); };
  BP.cone = function (axis, cx, cy, cz, r, h, dir, o) { return this.add(G3.cone(axis, cx, cy, cz, r, h, dir, this.opts(o))); };
  // fileira de espinhos (pirâmides perigosas) ao longo de x, em pé sobre y
  BP.spikes = function (x0, x1, y, z0, z1, o) {
    const n = Math.max(1, Math.round((x1 - x0) / 12)), w = (x1 - x0) / n;
    const zc = (z0 + z1) / 2, d = z1 - z0;
    for (let i = 0; i < n; i++) this.add(G3.pyramid(x0 + w * (i + 0.5), y, zc, w, d, 11, Object.assign({ mat: 'espinho', hazard: true, solid: false, pogo: true }, o || {})));
  };
  BP.ent = function (type, props) { const e = Object.assign({ type }, props || {}); this.ents.push(e); return e; };
  BP.flag = function (k) { return !!(this.state.flags && this.state.flags[k]); };

  // sala carregada (instância de execução)
  function Room(def, state) {
    this.def = def;
    this.id = def.id;
    this.w = def.size[0]; this.h = def.size[1]; this.d = def.size[2];
    this.pos = { x: def.pos[0], y: def.pos[1], z: def.pos[2] || 0 };
    const b = new Builder(this, state);
    if (def.mat) b.mat = def.mat;
    if (def.build) def.build(b, state || {});
    this.prims = b.prims;
    this.ents = b.ents;
    this.exits = def.exits;
    this.pool = [];
    this.renderZ = NaN;
    this.version = 0;
  }
  const RP = Room.prototype;

  RP.addPrim = function (p) { this.prims.push(p); this.version++; return p; };
  RP.removePrim = function (p) { const i = this.prims.indexOf(p); if (i >= 0) this.prims.splice(i, 1); this.version++; };
  RP.touch = function () { this.version++; };

  // sólidos/perigos na fatia z que tocam o retângulo; preenche S (formas) e P (primitivos)
  RP.query = function (z, minX, minY, maxX, maxY, mask, S, P) {
    let c = 0;
    const prims = this.prims;
    for (let i = 0; i < prims.length; i++) {
      const p = prims[i];
      if (p.off) continue;
      const m = (p.solid ? MASK_SOLID : 0) | (p.hazard ? MASK_HAZARD : 0);
      if (!(m & mask)) continue;
      if (z < p.zMin || z > p.zMax || p.xMax < minX || p.xMin > maxX || p.yMax < minY || p.yMin > maxY) continue;
      let s = this.pool[c];
      if (!s) s = this.pool[c] = G3.newShape();
      if (!G3.sliceInto(p, z, s)) continue;
      if (s.maxX < minX || s.minX > maxX || s.maxY < minY || s.minY > maxY) continue;
      S[c] = s; P[c] = p; c++;
    }
    return c;
  };

  // lista de primitivos visíveis na fatia z (usada pelo renderizador); formas ficam em p._s
  RP.visibleAt = function (z, out) {
    out.length = 0;
    for (let i = 0; i < this.prims.length; i++) {
      const p = this.prims[i];
      if (p.off || p.hidden) continue;
      if (G3.slice(p, z)) out.push(p);
    }
    return out;
  };

  RP.exitAt = function (side, a, b, zz) {
    // a: coordenada ao longo da borda (y para left/right, x para top/bottom, x para near/far); b: y para near/far
    for (const e of this.exits) {
      if (e.side !== side) continue;
      const r = e.range;
      if (a < r[0] || a > r[1]) continue;
      if (side === 'near' || side === 'far') { if (b < e.yr[0] || b > e.yr[1]) continue; }
      else if (e.zr && (zz < e.zr[0] || zz > e.zr[1])) continue;
      return e;
    }
    return null;
  };

  // ---------- validação das conexões ----------
  function edgeOf(def, side) {
    const [x, y, z] = [def.pos[0], def.pos[1], def.pos[2] || 0];
    const [w, h, d] = def.size;
    switch (side) {
      case 'left': return x; case 'right': return x + w;
      case 'top': return y; case 'bottom': return y + h;
      case 'near': return z; case 'far': return z + d;
    }
    return NaN;
  }
  // faixa de uma saída em coordenadas do mundo
  function worldRange(def, e) {
    const off = (e.side === 'left' || e.side === 'right') ? def.pos[1] : def.pos[0];
    const r = [e.range[0] + off, e.range[1] + off];
    let zr = null, yr = null;
    if (e.side === 'near' || e.side === 'far') yr = [e.yr[0] + def.pos[1], e.yr[1] + def.pos[1]];
    else { const z0 = def.pos[2] || 0; const z = e.zr || [0, def.size[2]]; zr = [z[0] + z0, z[1] + z0]; }
    return { r, zr, yr };
  }
  function overlapLen(a, b) { return Math.min(a[1], b[1]) - Math.max(a[0], b[0]); }

  function validate(list) {
    const problems = [];
    const byId = {};
    for (const d of list) byId[d.id] = d;
    for (const d of list) {
      for (const e of d.exits) {
        if (e.sealed) continue;
        const t = byId[e.to];
        if (!t) { problems.push(`${d.id}: saída ${e.side} aponta para sala inexistente "${e.to}"`); continue; }
        const back = t.exits.find((x) => x.to === d.id && x.side === OPPOSITE[e.side]);
        if (!back) { problems.push(`${d.id} → ${t.id}: falta a saída de volta (${OPPOSITE[e.side]})`); continue; }
        if (Math.abs(edgeOf(d, e.side) - edgeOf(t, back.side)) > 0.01) problems.push(`${d.id} → ${t.id}: bordas não coincidem (${edgeOf(d, e.side)} ≠ ${edgeOf(t, back.side)})`);
        const A = worldRange(d, e), B = worldRange(t, back);
        if (overlapLen(A.r, B.r) < 12) problems.push(`${d.id} → ${t.id}: aberturas não se sobrepõem`);
        if (A.zr && overlapLen(A.zr, B.zr) < 12) problems.push(`${d.id} → ${t.id}: faixas de profundidade não se sobrepõem`);
        if (A.yr && overlapLen(A.yr, B.yr) < 12) problems.push(`${d.id} → ${t.id}: faixas verticais não se sobrepõem`);
      }
    }
    return problems;
  }

  PL.World = { defs, defRoom, Room, Builder, validate, worldRange, edgeOf, OPPOSITE, MASK_SOLID, MASK_HAZARD, MASK_ALL };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
