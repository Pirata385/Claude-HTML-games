// physics.js — a small position-based dynamics world: particles, sticks, static boxes, plus the
// geometry helpers the ragdolls and the fight use. Deterministic, fixed step, y-down. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;

  function solveStick(s) {
    const a = s.a, b = s.b, w = a.im + b.im;
    if (w === 0) return;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
    if (s.max && d <= s.len) return; // rope: only resists stretching
    const k = (d - s.len) / d * s.k / w;
    a.x += dx * k * a.im; a.y += dy * k * a.im;
    b.x -= dx * k * b.im; b.y -= dy * k * b.im;
  }

  class World {
    constructor(o) {
      o = o || {};
      this.g = o.g === undefined ? 1400 : o.g;
      this.iter = o.iter || 6;
      this.ps = []; this.sticks = []; this.boxes = []; this.solvers = [];
      this.maxV = 2600;
    }
    particle(x, y, m, r) {
      const p = { x, y, ox: x, oy: y, vx: 0, vy: 0, m, im: m > 0 ? 1 / m : 0, r: r || 0, gnd: false, fr: 0.3 };
      this.ps.push(p); return p;
    }
    stick(a, b, len, k, max) {
      const s = { a, b, len: len === undefined ? Math.hypot(b.x - a.x, b.y - a.y) : len, k: k === undefined ? 1 : k, on: true, max: !!max };
      this.sticks.push(s); return s;
    }
    box(x0, y0, x1, y1) { const b = { x0, y0, x1, y1 }; this.boxes.push(b); return b; }
    // Top of the first surface found going down from yFrom at x, or null.
    surfaceAt(x, yFrom) {
      let best = null;
      for (const b of this.boxes) if (x >= b.x0 && x <= b.x1 && b.y0 >= yFrom - 1e-6 && (best === null || b.y0 < best)) best = b.y0;
      return best;
    }
    collideStatic(p) {
      const r = p.r;
      for (const b of this.boxes) {
        if (p.x + r <= b.x0 || p.x - r >= b.x1 || p.y + r <= b.y0 || p.y - r >= b.y1) continue;
        const dTop = p.y + r - b.y0;
        if (p.oy + r <= b.y0 + 3 && p.x >= b.x0 && p.x <= b.x1) { p.y = b.y0 - r; p.gnd = true; continue; }
        const dBot = b.y1 - (p.y - r), dL = p.x + r - b.x0, dR = b.x1 - (p.x - r);
        const m = Math.min(dTop, dBot, dL, dR);
        if (m === dTop) { p.y = b.y0 - r; p.gnd = true; }
        else if (m === dL) p.x = b.x0 - r;
        else if (m === dR) p.x = b.x1 + r;
        else p.y = b.y1 + r;
      }
    }
    step(dt) {
      const ps = this.ps, g = this.g, maxV = this.maxV;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.ox = p.x; p.oy = p.y;
        if (p.im === 0) continue; // kinematic: moved by its owner, which also sets vx/vy
        p.vy += g * dt;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > maxV) { p.vx *= maxV / sp; p.vy *= maxV / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.gnd = false;
      }
      for (let it = 0; it < this.iter; it++) {
        for (let i = 0; i < this.sticks.length; i++) if (this.sticks[i].on) solveStick(this.sticks[i]);
        for (let i = 0; i < this.solvers.length; i++) this.solvers[i].solve(this, it);
        for (let i = 0; i < ps.length; i++) if (ps[i].im > 0) this.collideStatic(ps[i]);
      }
      const inv = 1 / dt;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.im === 0) continue;
        p.vx = (p.x - p.ox) * inv; p.vy = (p.y - p.oy) * inv;
        if (p.gnd) { p.vx *= 1 - p.fr; if (p.vy > 0) p.vy = 0; }
      }
    }
  }

  // Closest point on segment a-b to (px, py): returns t in 0..1 through the out object.
  function closestT(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (l2 < 1e-9) return 0;
    const t = ((px - ax) * dx + (py - ay) * dy) / l2;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }
  // Circle (x, y, r) against the capsule a-b of radius rc. Returns null or { t, nx, ny, pen }
  // with the normal pointing from the capsule to the circle.
  function circleCapsule(x, y, r, ax, ay, bx, by, rc) {
    const t = closestT(x, y, ax, ay, bx, by);
    const qx = ax + (bx - ax) * t, qy = ay + (by - ay) * t;
    let nx = x - qx, ny = y - qy;
    const d = Math.hypot(nx, ny), pen = r + rc - d;
    if (pen <= 0) return null;
    if (d < 1e-6) { nx = 0; ny = -1; } else { nx /= d; ny /= d; }
    return { t, nx, ny, pen, qx, qy };
  }
  // Push particle p (radius rp) out of the capsule between particles a and b (radius rc), by mass.
  function resolveParticleCapsule(p, rp, a, b, rc) {
    const hit = circleCapsule(p.x, p.y, rp, a.x, a.y, b.x, b.y, rc);
    if (!hit) return null;
    const wa = (1 - hit.t), wb = hit.t;
    const wSeg = wa * wa * a.im + wb * wb * b.im, w = p.im + wSeg;
    if (w === 0) return hit;
    const l = hit.pen / w;
    p.x += hit.nx * l * p.im; p.y += hit.ny * l * p.im;
    a.x -= hit.nx * l * wa * a.im; a.y -= hit.ny * l * wa * a.im;
    b.x -= hit.nx * l * wb * b.im; b.y -= hit.ny * l * wb * b.im;
    return hit;
  }
  function resolveParticles(p, q, rp, rq) {
    let nx = p.x - q.x, ny = p.y - q.y;
    const d = Math.hypot(nx, ny), pen = rp + rq - d, w = p.im + q.im;
    if (pen <= 0 || w === 0) return false;
    if (d < 1e-6) { nx = 1; ny = 0; } else { nx /= d; ny /= d; }
    const l = pen / w;
    p.x += nx * l * p.im; p.y += ny * l * p.im; q.x -= nx * l * q.im; q.y -= ny * l * q.im;
    return true;
  }

  RB.physics = { World, solveStick, closestT, circleCapsule, resolveParticleCapsule, resolveParticles };
})();
