// scenes/chores.js — flat broke: muck out Dona Cida's henhouse for $50. Scrub every pile on the
// floor (hold and rub with the mouse or a finger) while her hens wander about and, now and then,
// add to the work. When the floor is spotless you are paid and sent back where you were.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, TAU } = RB.core;
  const ui = RB.ui, pal = RB.pal, input = RB.input, ST = RB.state, common = RB.common;
  const PAY = 50, START = 10, DROPS = 3;

  let S, back, rng, piles, hens, parts, floor, t, dropT, dropsLeft, cleaned, total, done, prev, scrubT, brush;

  function layout() {
    const v = ui.view, top = v.w < 600 ? 128 : 112;
    floor = { x: 14, y: top, w: v.w - 28, h: v.h - top - 16 };
  }
  const inFloor = (m) => ({ x: floor.x + m + rng.next() * (floor.w - 2 * m), y: floor.y + m + rng.next() * (floor.h - 2 * m) });
  function addPile(x, y) {
    piles.push({ x, y, dirt: 1, r: rng.range(15, 21), seed: rng.int(1, 1e6), wet: 0 });
    total++;
  }
  function puff(x, y, n, col, text) { for (let i = 0; i < n; i++) parts.push({ x: x + rng.range(-10, 10), y: y + rng.range(-6, 6), vx: rng.range(-50, 50), vy: rng.range(-90, -20), life: rng.range(0.4, 0.9), col, text: i === 0 ? text : null }); }

  function finish() {
    done = true;
    S.money += PAY; S.stats.earned += PAY; S.stats.chores = (S.stats.chores || 0) + 1;
    S.time = Math.min(29.5, S.time + 1.5);
    common.award(S, 'chores');
    RB.game.save();
    RB.audio.play('win');
    ui.message('Spotless!', 'Dona Cida inspects the floor, sniffs, and counts out $' + PAY + ' into your hand. "Same time next week, if you are still poor."', () => RB.game.go(back), { ok: 'Thanks, Dona Cida', head: pal.teal });
  }

  function drawPile(ctx, p) {
    const k = Math.sqrt(Math.max(0, p.dirt)), r = p.r * (0.35 + 0.65 * k);
    if (p.wet > 0) { ctx.globalAlpha = p.wet * 0.35; ctx.fillStyle = '#6d8fa0'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.3, p.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (p.dirt <= 0) return;
    ctx.globalAlpha = clamp(0.35 + p.dirt, 0, 1);
    ctx.fillStyle = 'rgba(60,40,20,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.2, r * 1.15, r * 0.45, 0, 0, TAU); ctx.fill();
    // a soft-serve swirl: three stacked blobs
    const tiers = [[0, 1, 0.5], [-0.42, 0.72, 0.42], [-0.78, 0.42, 0.34]];
    tiers.forEach((q, i) => {
      ctx.fillStyle = i % 2 ? '#8f6338' : '#7a5230';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + q[0] * r, r * q[1], r * q[2], 0, 0, TAU); ctx.fill();
    });
    ctx.fillStyle = '#5e3f24'; ctx.beginPath(); ctx.arc(p.x + r * 0.08, p.y - r * 1.05, r * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(p.x - r * 0.3, p.y - r * 0.15, r * 0.18, r * 0.09, -0.4, 0, TAU); ctx.fill();
    // stink lines and flies
    ctx.strokeStyle = 'rgba(120,140,90,0.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      for (let j = 0; j <= 8; j++) { const yy = p.y - r * 1.4 - j * 3.2, xx = p.x + i * r * 0.5 + Math.sin(t * 4 + j * 0.8 + i + p.seed) * 3; if (j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const a = t * (5 + i) + p.seed + i * 3, fx = p.x + Math.cos(a) * r * 1.3, fy = p.y - r * 0.9 + Math.sin(a * 1.7) * r * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(fx - 2, fy - 2, 2.2, 1.3, 0.5, 0, TAU); ctx.ellipse(fx + 2, fy - 2, 2.2, 1.3, -0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawBrush(ctx, x, y, busy) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5 + (busy ? Math.sin(t * 30) * 0.18 : 0));
    ctx.fillStyle = '#96693f'; ctx.fillRect(-3, -46, 6, 34);
    ctx.fillStyle = '#e9b44c'; ui.rr(ctx, -16, -14, 32, 12, 4); ctx.fill();
    ctx.fillStyle = '#f6ead2'; for (let i = -13; i <= 13; i += 4) ctx.fillRect(i - 1, -3, 2, 7);
    ctx.restore();
  }

  RB.scenes.chores = {
    enter(args) {
      S = RB.game.S; back = args.back || 'coop';
      rng = new Rng((S.seed ^ Math.imul(S.day, 7349) ^ ((S.stats.chores || 0) * 911)) >>> 0);
      layout();
      piles = []; parts = []; total = 0; cleaned = 0; done = false; t = 0; prev = {}; scrubT = 0; brush = null;
      dropsLeft = DROPS; dropT = rng.range(4, 6);
      for (let i = 0; i < START; i++) { const p = inFloor(34); addPile(p.x, p.y); }
      hens = [];
      for (let i = 0; i < 4; i++) {
        const p = inFloor(40);
        hens.push({ P: RB.pheno.express(RB.species.make(rng.pick(['chicken', 'chicken', 'bantam', 'chicken']), rng, { sex: i ? 'F' : 'M', sport: 0 })), x: p.x, y: p.y, tx: p.x, ty: p.y, f: 1, ph: rng.next(), sp: 0, t: rng.range(0, 2), voice: rng.range(3, 9) });
      }
      RB.audio.setTune('farm');
    },
    update(dt) {
      t += dt;
      layout();
      if (done) return;
      // scrubbing: any pointer that is down rubs the piles under it
      let busy = false;
      brush = input.hasMouse && !input.touch ? { x: input.mx, y: input.my } : null;
      const seen = {};
      for (const p of input.ptrs) {
        if (p.ui) continue;
        seen[p.id] = true;
        const last = prev[p.id] || { x: p.x, y: p.y }, moved = Math.hypot(p.x - last.x, p.y - last.y);
        prev[p.id] = { x: p.x, y: p.y };
        brush = { x: p.x, y: p.y };
        for (const pl of piles) {
          if (pl.dirt <= 0 || Math.hypot(pl.x - p.x, pl.y - p.y) > pl.r + 18) continue;
          busy = true;
          pl.dirt -= moved * 0.0065 + dt * 0.25 + (p.fresh ? 0.12 : 0);
          if (rng.chance(0.35)) parts.push({ x: pl.x + rng.range(-pl.r, pl.r), y: pl.y + rng.range(-pl.r * 0.5, pl.r * 0.3), vx: rng.range(-20, 20), vy: rng.range(-40, -10), life: 0.5, col: 'rgba(255,255,255,0.85)', bubble: true });
          if (pl.dirt <= 0) { pl.dirt = 0; pl.wet = 1; cleaned++; RB.audio.play('good'); puff(pl.x, pl.y - 10, 6, '#bfe6ef', cleaned + '/' + (total + dropsLeft)); }
        }
      }
      for (const id of Object.keys(prev)) if (!seen[id]) delete prev[id];
      if (busy) { scrubT -= dt; if (scrubT <= 0) { scrubT = 0.11; RB.audio.play('step'); } }
      // the hens wander, and every so often one adds a pile
      for (const h of hens) {
        h.t -= dt; h.voice -= dt;
        if (h.voice <= 0) { h.voice = rng.range(4, 12); RB.audio.voice(h.P.voice, 'cluck'); }
        if (h.t <= 0) { const p = inFloor(36); h.tx = p.x; h.ty = p.y; h.t = rng.range(2, 5); }
        const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy), s = Math.min(55, h.P.speedMax * 0.35);
        if (d > 6) { h.x += dx / d * s * dt; h.y += dy / d * s * dt; h.sp = 0.5; if (Math.abs(dx) > 2) h.f = dx > 0 ? 1 : -1; } else h.sp = 0;
        h.ph = (h.ph + dt * (0.6 + h.sp * 2)) % 1;
      }
      const left = piles.filter((p) => p.dirt > 0).length;
      if (dropsLeft > 0) {
        dropT -= dt * (left === 0 ? 6 : 1);
        if (dropT <= 0) {
          const h = rng.pick(hens);
          addPile(clamp(h.x - h.f * h.P.TL * 0.6, floor.x + 20, floor.x + floor.w - 20), clamp(h.y + 4, floor.y + 20, floor.y + floor.h - 12));
          dropsLeft--; dropT = rng.range(4, 7);
          puff(h.x, h.y - h.P.rest - 10, 1, 'rgba(0,0,0,0)', 'plop!'); RB.audio.play('thud');
        }
      } else if (left === 0) finish();
      for (const p of piles) if (p.wet > 0) p.wet = Math.max(0, p.wet - dt * 0.4);
      for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.bubble) p.vy += 120 * dt; }
      parts = parts.filter((p) => p.life > 0);
    },
    draw(ctx) {
      const v = ui.view;
      ctx.fillStyle = '#c99a63'; ctx.fillRect(0, 0, v.w, v.h);
      // the back wall with its nest boxes
      const wy = v.w < 600 ? 84 : 64;
      ui.rect(0, wy, v.w, floor.y - wy, '#a8794a');
      for (let x = 20; x < v.w - 60; x += 110) { ui.rect(x, wy + 8, 70, 30, '#5c4630', 4); ui.rect(x, wy + 28, 70, 10, '#e6c66a', 2); }
      // planks and straw
      ctx.fillStyle = '#d8ad72'; ctx.fillRect(floor.x, floor.y, floor.w, floor.h);
      ctx.fillStyle = '#c99d63';
      for (let y = floor.y + 26; y < floor.y + floor.h; y += 26) ctx.fillRect(floor.x, y, floor.w, 2);
      const sr = new Rng(77);
      ctx.strokeStyle = '#e6c66a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 70; i++) { const x = floor.x + sr.next() * floor.w, y = floor.y + sr.next() * floor.h, a = sr.range(0, TAU); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 4); ctx.stroke(); }
      for (const p of piles) drawPile(ctx, p);
      // hens, back to front
      const sc = clamp(Math.min(v.w, v.h) / 520, 0.6, 1);
      for (const h of hens.slice().sort((a, b) => a.y - b.y)) {
        ctx.save(); ctx.translate(h.x, h.y); ctx.scale(sc, sc);
        RB.art.drawShadow(ctx, 0, 1, h.P.TL * 0.55);
        RB.art.drawCreature(ctx, h.P, RB.pose.animPose(h.P, { x: 0, y: 0, f: h.f, phase: h.ph, speed: h.sp, time: t }), {});
        ctx.restore();
      }
      for (const p of parts) {
        ctx.globalAlpha = clamp(p.life * 2, 0, 1);
        if (p.text) RB.props.label(ctx, p.text, p.x, p.y - 16, 16, pal.ink);
        ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.bubble ? 3 : 4 * p.life + 1, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (brush) drawBrush(ctx, brush.x, brush.y, input.ptrs.length > 0);
      // header: on narrow screens the progress bar gets a line of its own
      const narrow = v.w < 600, hh = narrow ? 84 : 64;
      ui.rect(0, 0, v.w, hh, pal.ink); ui.zone(0, 0, v.w, hh);
      ui.text('Dona Cida\'s henhouse', 14, 26, { size: 16, color: pal.white, maxW: v.w - 110 });
      ui.text('Hold and rub each pile until it is gone. $' + PAY + ' when the floor is spotless.', 14, 46, { size: 11, color: pal.sand, bold: false, maxW: narrow ? v.w - 28 : v.w - 200 });
      ui.money(S.money, v.w - 12, 30, { size: 14, color: pal.white, align: 'right' });
      const left = piles.filter((p) => p.dirt > 0).length + dropsLeft, all = total + dropsLeft;
      const bw = narrow ? v.w - 80 : 120, bx = narrow ? 14 : v.w - 132, by = narrow ? 62 : 42;
      ui.bar(bx, by, bw, 10, (all - left) / all, pal.teal, 'rgba(255,255,255,0.2)');
      ui.text((all - left) + '/' + all, narrow ? bx + bw + 8 : bx - 6, by + 9, { size: 11, color: pal.white, align: narrow ? 'left' : 'right' });
    },
    debug() { return { piles, hens, floor, cleaned, total, dropsLeft, done }; },
  };
  void ST;
})();
