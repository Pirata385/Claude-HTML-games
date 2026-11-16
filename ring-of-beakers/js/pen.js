// pen.js — a small live box of ragdolls drawn inside a screen rectangle: the truck's cage as seen
// from the map, or the garden of Sunset Roost. The creatures stand and shuffle about in their own
// physics world; you can grab and drag them, tap one for its card, or drag one out of the box to
// let it go where you drop it.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, lerp } = RB.core;
  const input = RB.input, ST = RB.state;
  const DT = RB.fight.DT;

  class Pen {
    // o: { onTap(c), onDropOut(c, screenX, screenY), drawOpts(c), canGrab(c),
    //      bg(ctx, box) to draw your own backdrop (default: the cage), under(ctx, pen) to draw on
    //      the ground in pen units before the creatures, roomy: zoom out so a crowd has room }
    constructor(o) {
      this.o = o || {};
      this.world = new RB.physics.World();
      this.world.box(-1e5, 0, 1e5, 500);
      this.items = []; this.acc = 0; this.grab = null; this.rng = new Rng(4242);
      this.L = 300; this.s = 1; this.box = null; this.t = 0;
    }
    // Keep one ragdoll per creature in the list (rebuilt if its body changed).
    sync(list) {
      for (const it of this.items.slice()) {
        if (!list.includes(it.c) || it.P !== ST.pheno(it.c)) { it.rag.remove(); this.items.splice(this.items.indexOf(it), 1); }
      }
      for (const c of list) {
        if (this.items.find((it) => it.c === c)) continue;
        const P = ST.pheno(c), x = this.rng.range(30, Math.max(31, this.L - 30));
        this.items.push({ c, P, rag: new RB.creature.Rag(this.world, P, x, 0, this.rng.chance(0.5) ? 1 : -1), t: this.rng.range(0.5, 3), tx: x, mode: 'idle' });
      }
    }
    // Fit the pen to its box: scale so the tallest rider stands inside it.
    layout(box, list) {
      this.box = box;
      let tall = 30, wide = 0, sum = 0;
      for (const c of list || this.items.map((it) => it.c)) { const P = ST.pheno(c); tall = Math.max(tall, P.rest + P.TD * 0.6 + P.NL * 0.9 + P.HR * 2); wide = Math.max(wide, P.TL); sum += P.TL; }
      this.s = clamp((box.h - 16) / tall, 0.08, 1.4);
      if (this.o.roomy) this.s = clamp(Math.min((box.h - 16) / (tall * 1.15), box.w / Math.max(3 * wide, 0.8 * sum)), 0.08, 1.4);
      this.L = box.w / this.s;
    }
    toWorld(px, py) { const b = this.box; return { x: (px - b.x) / this.s, y: (py - (b.y + b.h - 8)) / this.s }; }
    inBox(px, py) { const b = this.box; return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h; }
    pick(w) {
      let best = null, bd = 1e9;
      for (const it of this.items) {
        const d = Math.hypot(it.rag.midX() - w.x, it.rag.midY() - w.y), r = it.P.TD * 0.9 + it.P.TL * 0.4 + 14 / this.s;
        if (d < r && d < bd) { bd = d; best = it; }
      }
      return best;
    }
    // Send one to a spot (in pen units); with peck, it pecks at the ground when it gets there.
    goTo(it, x, peck) {
      const m = Math.min(it.P.TL * 0.5 + 6, this.L / 2 - 1);
      it.mode = 'walk'; it.tx = clamp(x, m, Math.max(m, this.L - m)); it.t = 6; it.peck = !!peck;
    }
    peckNow(it) { const rag = it.rag, P = it.P; if (!it.c.person && !rag.act) rag.startPeck(() => ({ x: rag.C.x + rag.f * (P.NL * 0.6 + 8), y: -2 })); }
    shift(rag, dx) {
      for (const p of rag.parts) { p.x += dx; p.ox += dx; }
      for (const leg of rag.legs) { if (leg.sw) { leg.sw.x0 += dx; leg.sw.x1 += dx; } if (leg.from) leg.from.x += dx; }
    }
    // Input, a little wandering and the physics. box: the screen rectangle the pen fills.
    update(dt, box) {
      this.t += dt;
      this.layout(box);
      // grabbing
      for (const p of input.ptrs) {
        if (p.fresh && this.inBox(p.sx, p.sy) && !this.grab) {
          const it = this.pick(this.toWorld(p.x, p.y));
          if (it && (!this.o.canGrab || this.o.canGrab(it.c))) { this.grab = { it, id: p.id, moved: false, vx: 0, vy: 0 }; p.owner = 'pen'; }
        }
        const g = this.grab;
        if (g && g.id === p.id) {
          if (p.moved > 8 && !g.moved) { g.moved = true; g.it.rag.knockdown(1e6); g.it.rag.C.im = 0; g.it.rag.eye = 'scared'; if (!g.it.c.person) RB.audio.voice(g.it.P.voice, 'squawk'); }
          const w = this.toWorld(clamp(p.x, box.x + 6, box.x + box.w - 6), clamp(p.y, box.y + 6, box.y + box.h - 10));
          g.tx = w.x; g.ty = Math.min(w.y, -g.it.P.TD * 0.5); g.sx = p.x; g.sy = p.y; g.out = !this.inBox(p.x, p.y);
        }
      }
      for (const p of input.ups) {
        const g = this.grab;
        if (!g || g.id !== p.id) continue;
        const rag = g.it.rag;
        if (g.moved) { rag.C.im = 1 / rag.C.m; rag.C.vx = clamp(g.vx, -700, 700); rag.C.vy = clamp(g.vy, -700, 400); rag.stateT = 0; rag.downDur = 0.6; rag.eye = ''; }
        this.grab = null;
        if (g.moved && !this.inBox(p.x, p.y) && this.o.onDropOut) this.o.onDropOut(g.it.c, p.x, p.y);
      }
      // taps on the pen are ours, not the map's: a tap on a rider opens its card
      for (const tp of input.taps) {
        if (tp.used || !this.inBox(tp.x, tp.y)) continue;
        tp.used = true;
        const it = this.pick(this.toWorld(tp.x, tp.y));
        if (it && this.o.onTap) this.o.onTap(it.c);
      }
      // wandering
      for (const it of this.items) {
        const rag = it.rag, P = it.P;
        if (this.grab && this.grab.it === it) continue;
        if (rag.state !== 'stand') { rag.vxDes = 0; continue; }
        it.t -= dt;
        const m = Math.min(P.TL * 0.5 + 6, this.L / 2 - 1);
        if (it.t <= 0) {
          const r = this.rng.next();
          it.peck = false;
          if (r < 0.5) { it.mode = 'walk'; it.tx = this.rng.range(m, Math.max(m, this.L - m)); it.t = this.rng.range(2, 5); }
          else if (r < 0.7 && !it.c.person) { it.mode = 'idle'; it.t = this.rng.range(1, 2); rag.startPeck(() => ({ x: rag.C.x + rag.f * (P.NL * 0.6 + 8), y: -2 })); }
          else { it.mode = 'idle'; it.t = this.rng.range(1, 3); }
        }
        if (it.mode === 'walk') {
          const dx = it.tx - rag.midX();
          if (Math.abs(dx) < 10) { it.mode = 'idle'; rag.vxDes = 0; if (it.peck) { it.peck = false; it.t = this.rng.range(1.2, 2.4); this.peckNow(it); } }
          else { const dir = Math.sign(dx); if (dir !== rag.f && !rag.act) rag.flip(); rag.vxDes = dir * Math.min(P.speedMax * 0.35, 40 + P.speedMax * 0.1); }
        } else rag.vxDes = 0;
      }
      // physics, keeping everyone inside the cage
      this.acc = Math.min(this.acc + dt, 0.1);
      while (this.acc >= DT) {
        const g = this.grab;
        if (g && g.moved && g.tx !== undefined) {
          const C = g.it.rag.C, nx = lerp(C.x, g.tx, 0.35), ny = lerp(C.y, g.ty, 0.35);
          g.vx = (nx - C.x) / DT; g.vy = (ny - C.y) / DT; C.vx = g.vx; C.vy = g.vy; C.x = nx; C.y = ny;
        }
        for (const it of this.items) it.rag.control(DT);
        this.world.step(DT);
        for (const it of this.items) {
          it.rag.post();
          if (g && g.it === it) continue;
          const m = Math.min(it.P.TL * 0.5 + 4, this.L / 2 - 1), x = it.rag.midX();
          if (x < m) this.shift(it.rag, m - x); else if (x > this.L - m) this.shift(it.rag, this.L - m - x);
        }
        this.acc -= DT;
      }
    }
    // The cage interior, its riders, and the one being dragged out (drawn at the pointer).
    draw(ctx) {
      const b = this.box, ui = RB.ui, pal = RB.pal;
      if (!b) return;
      ctx.save();
      ui.rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.clip();
      if (this.o.bg) this.o.bg(ctx, b);
      else {
        ctx.fillStyle = '#d9e6e2'; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = 'rgba(35,49,74,0.18)';
        for (let x = b.x + 8; x < b.x + b.w; x += 18) ctx.fillRect(x, b.y, 3, b.h - 8);
        ctx.fillStyle = '#96693f'; ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
      }
      ctx.translate(b.x, b.y + b.h - 8); ctx.scale(this.s, this.s);
      if (this.o.under) this.o.under(ctx, this);
      const order = this.items.slice().sort((a, c) => c.P.S - a.P.S);
      for (const it of order) {
        if (this.grab && this.grab.it === it && this.grab.out) continue;
        RB.art.drawCreature(ctx, it.P, it.rag.getPose(), this.o.drawOpts ? this.o.drawOpts(it.c) : {});
      }
      ctx.restore();
      if (!this.o.bg) { ctx.fillStyle = pal.ink; ctx.fillRect(b.x, b.y, b.w, 3); }
      const g = this.grab;
      if (g && g.out && g.moved) {
        ctx.save(); ctx.globalAlpha = 0.85;
        RB.art.drawFitted(ctx, g.it.P, g.sx - 34, g.sy - 60, 68, 68, Object.assign({ eye: 'scared' }, this.o.drawOpts ? this.o.drawOpts(g.it.c) : {}));
        ctx.restore();
        ui.text('Let go here', g.sx, g.sy + 22, { size: 12, align: 'center', color: pal.white });
      }
    }
    dispose() { for (const it of this.items) it.rag.remove(); this.items = []; this.grab = null; }
  }

  RB.Pen = Pen;
})();
