/* Planolândia — controlador de corpos na fatia: gravidade fica com quem chama; aqui só movimento e colisão.
 * O corpo tem espessura zero em z: colide apenas com o corte dos sólidos no seu plano. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const C2 = PL.C2;
  const W = () => PL.World;

  const S = [], P = [], S2 = [], P2 = [], tmp = { nx: 0, ny: 0 }, mtv = { nx: 0, ny: 0, depth: 0 };

  const Phys = {
    GRAV: 980,
    MAX_FALL: 440,
    STEP: 4,       // degrau subido automaticamente no chão
    AIR_STEP: 2,   // correção de quina no ar
    Z_STEP: 6,     // subida tolerada ao trocar de profundidade (elevadores)

    body(x, y, z, hx, hy) {
      return { x, y, z, hx, hy, vx: 0, vy: 0, grounded: false, gnx: 0, gny: -1, groundPrim: null, wall: 0, ceil: false, dropT: 0, noSnap: false };
    },

    // move pelo vetor velocidade × dt resolvendo colisões
    move(b, room, dt) {
      const wasG = b.grounded;
      b.grounded = false; b.ceil = false; b.wall = 0; b.groundPrim = null;
      const dist = Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt;
      const n = Math.min(16, Math.max(1, Math.ceil(dist / 3)));
      const sdt = dt / n;
      for (let i = 0; i < n; i++) {
        const dx = b.vx * sdt;
        if (dx !== 0) { b.x += dx; resolveX(b, room, dx, wasG || b.grounded); }
        const prevBottom = b.y + b.hy;
        const dy = b.vy * sdt;
        b.y += dy;
        resolveY(b, room, dy, prevBottom);
      }
      if (wasG && !b.grounded && b.vy >= 0 && !b.noSnap) snapDown(b, room, 5);
      if (b.dropT > 0) b.dropT -= dt;
    },

    // sólido (não atravessável) sobreposto ao corpo na posição dada
    overlapAt(b, room, x, y, z) {
      const c = room.query(z, x - b.hx, y - b.hy, x + b.hx, y + b.hy, W().MASK_SOLID, S, P);
      for (let k = 0; k < c; k++) {
        if (P[k].oneWay) continue;
        if (C2.aabbShape(x, y, b.hx - 0.05, b.hy - 0.05, S[k], mtv)) return P[k];
      }
      return null;
    },

    // tenta deslizar dz na profundidade; devolve {blocker} (primitivo que impediu, ou null)
    tryDepth(b, room, dz) {
      const z0 = b.z, z1 = z0 + dz;
      const blocker = Phys.overlapAt(b, room, b.x, b.y, z1);
      if (!blocker) { b.z = z1; return { blocker: null }; }
      // elevador: sobe um pouco se o obstáculo for só o chão subindo
      const up = upSep(b, room, b.x, b.y, z1);
      if (up <= Phys.Z_STEP && !Phys.overlapAt(b, room, b.x, b.y - up - 0.01, z1)) {
        b.y -= up + 0.001;
        b.z = z1;
        return { blocker: null };
      }
      // encostado numa superfície curva que cresce: um empurrãozinho lateral resolve
      if (C2.aabbShape(b.x, b.y, b.hx, b.hy, nudgeShape(room, blocker, z1), mtv) && mtv.depth < 2) {
        const nx = b.x + mtv.nx * (mtv.depth + 0.02), ny = b.y + mtv.ny * (mtv.depth + 0.02);
        if (!Phys.overlapAt(b, room, nx, ny, z1)) { b.x = nx; b.y = ny; b.z = z1; return { blocker: null }; }
      }
      // bloqueado: avança o máximo possível (busca binária)
      let lo = 0, hi = 1;
      for (let i = 0; i < 6; i++) {
        const m = (lo + hi) / 2;
        if (Phys.overlapAt(b, room, b.x, b.y, z0 + dz * m)) hi = m; else lo = m;
      }
      b.z = z0 + dz * lo;
      return { blocker };
    },

    // sólido "móvel com a profundidade" (loft/hull) logo abaixo dos pés, com maior apoio horizontal
    support(b, room) {
      const y = b.y + b.hy;
      const c = room.query(b.z, b.x - b.hx, y - 1, b.x + b.hx, y + 2, W().MASK_SOLID, S, P);
      let best = null, bestW = 2;
      for (let k = 0; k < c; k++) {
        const p = P[k], s = S[k];
        if ((p.kind !== 'loft' && p.kind !== 'hull') || p.dyn) continue;
        if (s.minY < y - 3 || s.minY > y + 2) continue;
        const w = Math.min(b.x + b.hx, s.maxX) - Math.max(b.x - b.hx, s.minX);
        if (w > bestW) { bestW = w; best = p; }
      }
      return best;
    },

    // cogumelo (primitivo com bounce) logo abaixo dos pés
    bounceUnder(b, room) {
      const y = b.y + b.hy;
      const c = room.query(b.z, b.x - b.hx + 1, y - 2, b.x + b.hx - 1, y + 2, W().MASK_SOLID, S, P);
      for (let k = 0; k < c; k++) {
        if (!P[k].bounce) continue;
        if (C2.aabbShape(b.x, y + 1, b.hx - 1, 2, S[k], mtv)) return P[k];
      }
      return null;
    },

    // perigo (espinhos etc.) tocando o corpo, com margem para não ser injusto
    hazardAt(b, room, shrink) {
      const sh = shrink === undefined ? 2 : shrink;
      const c = room.query(b.z, b.x - b.hx, b.y - b.hy, b.x + b.hx, b.y + b.hy, W().MASK_HAZARD, S, P);
      for (let k = 0; k < c; k++) {
        if (C2.aabbShape(b.x, b.y, b.hx - sh, b.hy - sh, S[k], mtv)) return P[k];
      }
      return null;
    },

    // empurra para fora de qualquer sólido; devolve a maior penetração encontrada (esmagamento se grande)
    depenetrate(b, room) {
      let worst = 0;
      for (let it = 0; it < 4; it++) {
        const c = room.query(b.z, b.x - b.hx, b.y - b.hy, b.x + b.hx, b.y + b.hy, W().MASK_SOLID, S, P);
        let moved = false;
        for (let k = 0; k < c; k++) {
          if (P[k].oneWay) continue;
          if (!C2.aabbShape(b.x, b.y, b.hx, b.hy, S[k], mtv)) continue;
          if (mtv.depth > worst) worst = mtv.depth;
          b.x += mtv.nx * mtv.depth; b.y += mtv.ny * mtv.depth;
          moved = true;
        }
        if (!moved) break;
      }
      return worst;
    },
  };

  const nudgeTmp = PL.G3 ? PL.G3.newShape() : null;
  function nudgeShape(room, p, z) { return PL.G3.sliceInto(p, z, nudgeTmp) ? nudgeTmp : { minX: 1, maxX: 0, minY: 1, maxY: 0 }; }

  function upSep(b, room, x, y, z) {
    let best = 0;
    const c = room.query(z, x - b.hx, y - b.hy, x + b.hx, y + b.hy, W().MASK_SOLID, S, P);
    for (let k = 0; k < c; k++) {
      if (P[k].oneWay) continue;
      const t = C2.aabbSepDir(x, y, b.hx - 0.05, b.hy, S[k], 0, -1, tmp);
      if (t > best) best = t;
    }
    return best;
  }

  function freeAt(b, room, x, y) {
    return !Phys.overlapAt(b, room, x, y, b.z);
  }

  function resolveX(b, room, dx, canStep) {
    const c = room.query(b.z, b.x - b.hx, b.y - b.hy, b.x + b.hx, b.y + b.hy, W().MASK_SOLID, S, P);
    // copia (sem alocar) para não ser sobrescrito pelas consultas internas; formas vêm do pool da sala,
    // então clona as formas para o pool secundário
    for (let k = 0; k < c; k++) { S2[k] = PL.G3.copyShape(S[k], S2[k] || PL.G3.newShape()); P2[k] = P[k]; }
    const shapes = S2, prims = P2;
    const dir = dx > 0 ? 1 : -1;
    for (let k = 0; k < c; k++) {
      const s = shapes[k], p = prims[k];
      if (p.oneWay) continue;
      const tUp = C2.aabbSepDir(b.x, b.y, b.hx, b.hy, s, 0, -1, tmp);
      if (tUp === 0) continue;
      const step = canStep ? Phys.STEP : Phys.AIR_STEP;
      if (tUp <= step && b.vy >= -40 && freeAt(b, room, b.x, b.y - tUp - 0.01)) {
        b.y -= tUp + 0.001;
        continue;
      }
      const tX = C2.aabbSepDir(b.x, b.y, b.hx, b.hy, s, -dir, 0, tmp);
      if (tX === 0) continue;
      if (tX <= Math.abs(dx) + 1.5) {
        b.x -= dir * tX;
        if (b.vx * dir > 0) b.vx = 0;
        b.wall = dir;
      } else if (C2.aabbShape(b.x, b.y, b.hx, b.hy, s, mtv)) {
        b.x += mtv.nx * mtv.depth; b.y += mtv.ny * mtv.depth;
        if (Math.abs(mtv.nx) > 0.6) b.wall = -Math.sign(mtv.nx);
      }
    }
  }

  function resolveY(b, room, dy, prevBottom) {
    const c = room.query(b.z, b.x - b.hx, b.y - b.hy, b.x + b.hx, b.y + b.hy, W().MASK_SOLID, S, P);
    for (let k = 0; k < c; k++) {
      const s = S[k], p = P[k];
      if (p.oneWay) {
        if (dy < 0 || b.dropT > 0) continue;
        if (prevBottom > s.minY + 0.75) continue;
        if (b.y + b.hy <= s.minY) continue;
        if (b.x + b.hx <= s.minX || b.x - b.hx >= s.maxX) continue;
        b.y = s.minY - b.hy;
        if (b.vy > 0) b.vy = 0;
        b.grounded = true; b.gnx = 0; b.gny = -1; b.groundPrim = p;
        continue;
      }
      if (dy >= 0) {
        const t = C2.aabbSepDir(b.x, b.y, b.hx, b.hy, s, 0, -1, tmp);
        if (t === 0) continue;
        if (t <= dy + 2.5 && tmp.ny < -0.6) {
          b.y -= t;
          if (b.vy > 0) b.vy = 0;
          b.grounded = true; b.gnx = tmp.nx; b.gny = tmp.ny; b.groundPrim = p;
          continue;
        }
      } else {
        const t = C2.aabbSepDir(b.x, b.y, b.hx, b.hy, s, 0, 1, tmp);
        if (t === 0) continue;
        if (t <= -dy + 2.5) {
          b.y += t;
          if (b.vy < 0) b.vy = 0;
          b.ceil = true;
          continue;
        }
      }
      if (C2.aabbShape(b.x, b.y, b.hx, b.hy, s, mtv)) {
        b.x += mtv.nx * mtv.depth; b.y += mtv.ny * mtv.depth;
        if (mtv.ny < -0.6) { b.grounded = true; b.gnx = mtv.nx; b.gny = mtv.ny; b.groundPrim = p; if (b.vy > 0) b.vy = 0; }
        else if (mtv.ny > 0.6) { b.ceil = true; if (b.vy < 0) b.vy = 0; }
        else {
          b.wall = -Math.sign(mtv.nx);
          // parede íngreme: escorrega, não cola
          if (b.vx * mtv.nx < 0) b.vx = 0;
        }
      }
    }
  }

  function snapDown(b, room, maxD) {
    const y0 = b.y, bottom0 = y0 + b.hy;
    const c = room.query(b.z, b.x - b.hx, y0 - b.hy, b.x + b.hx, y0 + b.hy + maxD, W().MASK_SOLID, S, P);
    let best = Infinity, gp = null, nx = 0, ny = -1;
    for (let k = 0; k < c; k++) {
      const s = S[k], p = P[k];
      if (p.oneWay) {
        if (b.dropT > 0 || s.minY < bottom0 - 0.75 || s.minY > bottom0 + maxD) continue;
        if (b.x + b.hx <= s.minX || b.x - b.hx >= s.maxX) continue;
        const d = s.minY - bottom0;
        if (d < best) { best = d; gp = p; nx = 0; ny = -1; }
        continue;
      }
      const t = C2.aabbSepDir(b.x, y0 + maxD, b.hx, b.hy, s, 0, -1, tmp);
      if (t > 0 && tmp.ny < -0.6) {
        const d = maxD - t;
        if (d >= -0.01 && d < best) { best = d; gp = p; nx = tmp.nx; ny = tmp.ny; }
      }
    }
    if (gp && best <= maxD) {
      b.y = y0 + Math.max(0, best);
      b.grounded = true; b.groundPrim = gp; b.gnx = nx; b.gny = ny;
      if (b.vy > 0) b.vy = 0;
    }
  }

  PL.Phys = Phys;

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
