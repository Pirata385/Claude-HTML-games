// Draws a Rig's primitives as pixel art: a merged dark silhouette outline,
// then depth-sorted shaded balls/limbs, then eyes and mouths on top.
(function (XS) {
  'use strict';

  const PX = 4.4; // world units -> pixels for radii
  const gfx = XS.gfx;
  const tintCache = new Map();
  const WHITE = ['#d8d8e8', '#ffffff', '#ffffff', '#ffffff'];

  function tinted(ramp, tint, k) {
    const key = ramp.join() + '|' + tint + '|' + k;
    let r = tintCache.get(key);
    if (!r) { r = ramp.map((c) => XS.color.mix(c, tint, k)); tintCache.set(key, r); }
    return r;
  }

  const order = [];
  // opts: { flash, tint, tintK, outline, alpha, silhouette }
  function drawRig(ctx, rig, ox, oy, opts = {}) {
    const n = rig.primCount, P = rig.prims;
    order.length = 0;
    for (let i = 0; i < n; i++) {
      const p = P[i];
      p.sx = XS.isoX(p.x, p.y) + ox;
      p.sy = XS.isoY(p.x, p.y, p.z) + oy;
      p.d = p.x + p.y + p.z + p.bias;
      if (p.k === 1) {
        p.ax = XS.isoX(p.x1, p.y1) + ox; p.ay = XS.isoY(p.x1, p.y1, p.z1) + oy;
        p.bx = XS.isoX(p.x2, p.y2) + ox; p.by = XS.isoY(p.x2, p.y2, p.z2) + oy;
      }
      order.push(p);
    }
    order.sort((a, b) => a.d - b.d);
    const outline = opts.outline || rig.g.palette.outline;
    const prevAlpha = ctx.globalAlpha;
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;

    // Pass 1: silhouette outline.
    for (const p of order) {
      if (p.k === 0 && !p.decor) gfx.disc(ctx, p.sx, p.sy, Math.max(1, p.r * PX) + 1, outline);
      else if (p.k === 1) gfx.thickLine(ctx, p.ax, p.ay, p.bx, p.by, Math.max(0.5, p.r * PX) + 1, outline);
    }
    if (opts.silhouette) { ctx.globalAlpha = prevAlpha; return; }

    // Pass 2: fills in depth order.
    const flash = opts.flash;
    for (const p of order) {
      let ramp = p.ramp;
      if (ramp) {
        if (flash) ramp = WHITE;
        else if (opts.tint) ramp = tinted(ramp, opts.tint, opts.tintK || 0.45);
      }
      switch (p.k) {
        case 0: gfx.ball(ctx, p.sx, p.sy, Math.max(0.5, p.r * PX), ramp); break;
        case 1: {
          const r = Math.max(0.5, p.r * PX);
          const steps = Math.max(1, Math.ceil(Math.hypot(p.bx - p.ax, p.by - p.ay) / Math.max(1, r * 0.7)));
          for (let i = 0; i <= steps; i++) gfx.ball(ctx, p.ax + ((p.bx - p.ax) * i) / steps, p.ay + ((p.by - p.ay) * i) / steps, r, ramp);
          break;
        }
        case 3: {
          const pts = p.pts.map((q) => [XS.isoX(q.x, q.y) + ox, XS.isoY(q.x, q.y, q.z) + oy]);
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * p.alpha;
          gfx.poly(ctx, pts, flash ? '#ffffff' : p.col);
          ctx.globalAlpha = a;
          gfx.line(ctx, pts[0][0], pts[0][1], pts[2][0], pts[2][1], p.edge);
          gfx.line(ctx, pts[1][0], pts[1][1], pts[2][0], pts[2][1], p.edge);
          break;
        }
        case 2: drawEye(ctx, p, rig, flash); break;
        case 4: drawMouth(ctx, p); break;
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  function drawEye(ctx, p, rig, flash) {
    const r = Math.max(1.5, p.r * PX);
    if (p.closed) {
      ctx.fillStyle = rig.g.palette.body[0];
      ctx.fillRect(Math.round(p.sx - r), Math.round(p.sy), Math.round(r * 2), 1);
      return;
    }
    gfx.disc(ctx, p.sx, p.sy, r, flash ? '#ffffff' : p.col);
    if (p.style === 'glow') { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(p.sx), Math.round(p.sy) - 1, 1, 1); return; }
    // Pupil shifted toward the look direction (projected on screen).
    const lx = (p.lookX - p.lookY) * 0.7, ly = (p.lookX + p.lookY) * 0.35;
    const px = Math.round(p.sx + lx * Math.max(0, r - 1)), py = Math.round(p.sy + ly * Math.max(0, r - 1));
    ctx.fillStyle = '#120a18';
    if (p.style === 'slit') ctx.fillRect(px, py - 1, 1, r >= 2 ? 3 : 2);
    else if (p.style === 'compound') { ctx.fillRect(px - 1, py, 1, 1); ctx.fillRect(px + 1, py, 1, 1); ctx.fillRect(px, py - 1, 1, 1); ctx.fillRect(px, py + 1, 1, 1); }
    else if (r >= 2.5) ctx.fillRect(px, py, 2, 2);
    else ctx.fillRect(px, py, 1, 1);
  }

  function drawMouth(ctx, p) {
    const w = Math.max(1, Math.round(p.r * PX));
    const x = Math.round(p.sx), y = Math.round(p.sy);
    ctx.fillStyle = p.col;
    if (p.open > 0.3) { ctx.fillRect(x - w, y, w * 2 + 1, 2); }
    else ctx.fillRect(x - w, y, w * 2 + 1, 1);
    if (p.style === 'fangs') { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w, y + 1, 1, 1); ctx.fillRect(x + w, y + 1, 1, 1); }
  }

  // 1px outline of a rig's silhouette (x-ray view of the player behind walls):
  // mask minus its 4-neighbour erosion, composed on two scratch canvases.
  let scratchA = null, scratchB = null;
  function drawRigOutline(ctx, rig, ox, oy, color) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < rig.primCount; i++) {
      const p = rig.prims[i];
      const sx = XS.isoX(p.x, p.y) + ox, sy = XS.isoY(p.x, p.y, p.z) + oy, r = (p.r || 0.5) * PX + 3;
      minX = Math.min(minX, sx - r); maxX = Math.max(maxX, sx + r); minY = Math.min(minY, sy - r); maxY = Math.max(maxY, sy + r);
    }
    if (!Number.isFinite(minX)) return;
    minX = Math.floor(minX); minY = Math.floor(minY);
    const w = Math.min(160, Math.ceil(maxX - minX)), h = Math.min(160, Math.ceil(maxY - minY));
    if (!scratchA) { scratchA = gfx.makeCanvas(160, 160); scratchB = gfx.makeCanvas(160, 160); }
    const a = scratchA.getContext('2d'), b = scratchB.getContext('2d');
    a.clearRect(0, 0, 160, 160); b.clearRect(0, 0, 160, 160);
    drawRig(a, rig, ox - minX, oy - minY, { silhouette: true, outline: color });
    b.drawImage(scratchA, 0, 0);
    b.globalCompositeOperation = 'destination-in';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.drawImage(scratchA, dx, dy);
    b.globalCompositeOperation = 'source-over';
    a.globalCompositeOperation = 'destination-out';
    a.drawImage(scratchB, 0, 0);
    a.globalCompositeOperation = 'source-over';
    ctx.drawImage(scratchA, 0, 0, w, h, minX, minY, w, h);
  }

  // Soft dithered shadow on the ground under an entity.
  function shadow(ctx, x, y, z, r, ox, oy, alpha = 1) {
    const sx = XS.isoX(x, y) + ox, sy = XS.isoY(x, y, z) + oy;
    XS.gfx.ellipse(ctx, sx, sy, r * 5.2, r * 2.6, XS.gfx.ditherPattern(ctx, '#05030a', 0.55 * alpha));
  }

  // Animated portrait of a genome on a small canvas (menus, cards, codex).
  class Portrait {
    constructor(canvas, genome, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.rig = new XS.Rig(genome);
      this.facing = opts.facing != null ? opts.facing : 0.25;
      this.ground = opts.ground !== false;
      this.bg = opts.bg || null;
      this.t = 0;
      this.update(0.016);
    }
    update(dt) {
      this.t += dt;
      const g = this.rig.g;
      this.rig.update(dt, { x: 0, y: 0, z: 0, facing: this.facing + Math.sin(this.t * 0.5) * 0.25, vx: 0, vy: 0, aimAngle: this.facing });
      const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
      if (this.bg) { ctx.fillStyle = this.bg; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
      const top = g.stats.height;
      const ox = W / 2, oy = Math.round(H * 0.5 + (top * XS.ISO.VZ) / 2);
      if (this.ground) shadow(ctx, 0, 0, 0, g.stats.radius, ox, oy);
      drawRig(ctx, this.rig, ox, oy);
    }
  }

  XS.drawRig = drawRig;
  XS.drawRigOutline = drawRigOutline;
  XS.drawShadow = shadow;
  XS.Portrait = Portrait;
})(globalThis.XS = globalThis.XS || {});
