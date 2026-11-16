// scenes/roost.js — Sunset Roost, a home for retired birds. Dona Nina looks after them in her
// garden: they potter about, peck, and come running when she scatters grain. Bring retired birds in
// the truck to check them in; tap a resident for its card, or take it home again.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp } = RB.core;
  const ui = RB.ui, pal = RB.pal, ST = RB.state, common = RB.common;

  let S, site, keeper, nina, pen, say, t, rng, seeds, toss, goal, lineN;

  const LINES = [
    'They have earned a little peace and quiet.',
    'Grain at noon, a nap after, and nobody pecks anybody.',
    'This one still thinks it is a champion. I let it.',
    'Old birds know things. Mostly where the grain is.',
    'No rings here. Just a garden and a warm porch.',
    'They are fed and looked after, every day, for free. Somebody has to.',
  ];
  const caged = () => ST.at(S, 'cage');
  const retiredInTruck = () => caged().filter((c) => !c.person && ST.isRetired(c));
  const night = () => S.time >= 19 || S.time < 6;

  // Dona Nina, as a creature the garden can hold.
  function caretaker(k) {
    const c = { id: -1, name: k.name, g: k.g, age: 0, train: { muscle: 0, lungs: 0, reflex: 0, courage: 0 }, cond: 1, person: k.id, clothes: k.clothes, hat: null };
    c.age = RB.pheno.express(k.g).growDays + 1;
    return c;
  }

  function checkIn(c) {
    const why = ST.checkIn(S, c);
    if (why) { ui.toast(why, pal.coral); RB.audio.play('error'); return false; }
    RB.audio.play('good');
    return true;
  }
  function checkInPick() {
    common.pick('Check in', caged(), (c) => {
      if (!checkIn(c)) return;
      say = 'Welcome, ' + c.name + '. There is a warm spot by the porch.';
      common.checkAch(S); RB.game.save();
    }, (c) => {
      const ok = !c.person && ST.isRetired(c);
      return { text: ok ? 'Retired at ' + c.age + ' days' : c.person ? 'Birds only.' : 'Not retired yet: day ' + c.age + ' of about ' + ST.pheno(c).lifespan + '.', ok, label: 'Check in' };
    });
  }
  function checkInAll() {
    const list = retiredInTruck();
    for (const c of list) checkIn(c);
    say = list.length === 1 ? 'Welcome, ' + list[0].name + '.' : 'Welcome, all ' + list.length + ' of you. Mind the step.';
    common.checkAch(S); RB.game.save();
  }
  function takeHome(c) {
    ST.checkOut(S, c);
    ui.close();
    say = 'Off you go, ' + c.name + '. There is always a perch for you here.';
    ui.toast(c.name + ' is in your truck.', pal.teal);
    RB.game.save();
  }
  function onTap(c) {
    if (c === nina) { lineN = (lineN + 1) % LINES.length; say = LINES[lineN]; RB.audio.play('click'); return; }
    common.card(c, () => [{ label: 'To truck', icon: 'truck', fn: () => takeHome(c) }], { has: (x) => S.roost.includes(x) });
  }

  // Every little while Dona Nina walks to a spot and scatters grain, and the old birds come running.
  function tend(dt) {
    const ni = pen.items.find((it) => it.c === nina);
    if (!ni) return;
    toss -= dt;
    if (!goal && toss <= 0) {
      goal = { x: rng.range(pen.L * 0.2, pen.L * 0.8), t: 7 };
      pen.goTo(ni, goal.x);
    }
    if (goal) {
      goal.t -= dt;
      const there = Math.abs(ni.rag.midX() - goal.x) < 16 && ni.mode === 'idle';
      if (there || goal.t <= 0) {
        const f = ni.rag.f, x0 = ni.rag.midX() + f * ni.P.TD * 0.6, y0 = -ni.P.rest * 0.75;
        for (let i = 0; i < 12; i++) seeds.push({ x: x0, y: y0, vx: f * rng.range(40, 230), vy: rng.range(-220, -60), life: rng.range(7, 10) });
        RB.audio.play('click');
        const spot = x0 + f * 120;
        for (const it of pen.items) if (it.c !== nina && rng.chance(0.85)) pen.goTo(it, spot + rng.range(-90, 90), true);
        goal = null; toss = rng.range(8, 13); ni.t = rng.range(2, 4);
      }
    }
    for (const sd of seeds) {
      sd.life -= dt;
      if (sd.y < 0 || sd.vy < 0) { sd.vy += 900 * dt; sd.x += sd.vx * dt; sd.y = Math.min(0, sd.y + sd.vy * dt); if (sd.y >= 0) { sd.vx = 0; sd.vy = 0; } }
    }
    seeds = seeds.filter((sd) => sd.life > 0);
  }

  // The garden behind them, seen from the lawn: sky, hills, and further back Dona Nina's cottage
  // with its porch and rocking chair, a fence and a row of flowers.
  function backdrop(ctx, b) {
    const gy = b.y + b.h - 8, H = b.h, hy = gy - H * 0.2, dark = night();
    const sky = ctx.createLinearGradient(0, b.y, 0, hy);
    sky.addColorStop(0, dark ? '#2f3a5c' : '#f2b880'); sky.addColorStop(1, dark ? '#5b5a86' : '#fbe3c2');
    ctx.fillStyle = sky; ctx.fillRect(b.x, b.y, b.w, b.h);
    if (dark) { ctx.fillStyle = '#fffaf0'; for (let i = 1; i <= 40; i++) ctx.fillRect(b.x + RB.core.hash2(i, 1, 7) * b.w, b.y + 4 + RB.core.hash2(i, 2, 7) * (hy - b.y) * 0.75, 2, 2); }
    else { ctx.fillStyle = 'rgba(233,180,76,0.8)'; ctx.beginPath(); ctx.arc(b.x + b.w * 0.3, hy - H * 0.1, H * 0.11, 0, Math.PI * 2); ctx.fill(); }
    // far hills, then the back lawn
    ctx.fillStyle = dark ? '#3e5a5a' : '#a9c98a';
    ctx.beginPath(); ctx.moveTo(b.x, hy + 2);
    for (let x = 0; x <= b.w; x += 16) ctx.lineTo(b.x + x, hy - H * 0.1 - Math.sin(x * 0.008 + 1) * H * 0.05 - Math.sin(x * 0.021) * H * 0.02);
    ctx.lineTo(b.x + b.w, hy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark ? '#557f58' : '#9fcb7a'; ctx.fillRect(b.x, hy, b.w, gy - hy);
    // the cottage, standing back on the lawn
    const ch = H * 0.3, cw = Math.min(b.w * 0.42, H * 0.56), cx = b.x + b.w - cw / 2 - Math.min(40, b.w * 0.05), cy = hy + H * 0.05;
    ctx.fillStyle = dark ? '#cdb99a' : '#f3dfc0'; ctx.fillRect(cx - cw / 2, cy - ch, cw, ch);
    ctx.fillStyle = pal.coral; ctx.beginPath(); ctx.moveTo(cx - cw / 2 - cw * 0.07, cy - ch + 2); ctx.lineTo(cx, cy - ch - H * 0.15); ctx.lineTo(cx + cw / 2 + cw * 0.07, cy - ch + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = dark ? '#f2cf7a' : '#bfe6ef'; ctx.fillRect(cx - cw * 0.38, cy - ch * 0.78, cw * 0.2, ch * 0.3); ctx.fillRect(cx + cw * 0.18, cy - ch * 0.78, cw * 0.2, ch * 0.3);
    ctx.fillStyle = '#96693f'; ctx.fillRect(cx - cw * 0.08, cy - ch * 0.66, cw * 0.16, ch * 0.66);
    ctx.fillRect(cx - cw * 0.56, cy - ch * 0.42, cw * 1.12, Math.max(3, ch * 0.05)); ctx.fillRect(cx - cw * 0.54, cy - ch * 0.4, Math.max(2, cw * 0.025), ch * 0.4); ctx.fillRect(cx + cw * 0.515, cy - ch * 0.4, Math.max(2, cw * 0.025), ch * 0.4);
    ctx.fillStyle = pal.mustard; ctx.beginPath(); ctx.arc(cx, cy - ch * 0.82, ch * 0.09, Math.PI, 0); ctx.closePath(); ctx.fill();
    // the empty rocking chair on the porch
    ctx.save(); ctx.translate(cx + cw * 0.32, cy); ctx.rotate(Math.sin(t * 1.4) * 0.1); ctx.scale(ch / 100, ch / 100);
    ctx.fillStyle = '#b98a5a'; ctx.fillRect(-10, -30, 4, 26); ctx.fillRect(-10, -12, 20, 4); ctx.fillRect(6, -12, 4, 10);
    ctx.strokeStyle = '#96693f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -26, 22, 1.15, 2.0); ctx.stroke();
    ctx.restore();
    // the back fence and a row of flowers along it
    const fy = hy + H * 0.06, fx1 = cx - cw * 0.6;
    ctx.fillStyle = '#b98a5a';
    if (fx1 > b.x) {
      ctx.fillRect(b.x, fy - H * 0.075, fx1 - b.x, Math.max(2, H * 0.014)); ctx.fillRect(b.x, fy - H * 0.04, fx1 - b.x, Math.max(2, H * 0.014));
      for (let x = b.x + 14; x < fx1; x += H * 0.16) ctx.fillRect(x - 2, fy - H * 0.1, 4, H * 0.1);
    }
    for (let i = 0, x = b.x + 10; x < b.x + b.w; i++, x += H * 0.07) {
      const yy = fy + 3 + (i % 2) * 2;
      ctx.fillStyle = '#5f9a52'; ctx.fillRect(x - 1, yy - H * 0.03, 2, H * 0.03);
      ctx.fillStyle = i % 3 === 0 ? pal.coral : i % 3 === 1 ? pal.mustard : pal.paper;
      ctx.beginPath(); ctx.arc(x, yy - H * 0.03, Math.max(2.5, H * 0.011), 0, Math.PI * 2); ctx.fill();
    }
    // the front lawn the birds stand on
    ctx.fillStyle = dark ? '#4f7a52' : '#8fbf6a'; ctx.fillRect(b.x, gy - 4, b.w, b.y + b.h - gy + 4);
    ctx.fillStyle = dark ? '#43694a' : '#7fb069'; ctx.fillRect(b.x, gy + 2, b.w, b.y + b.h - gy);
  }
  function grain(ctx) {
    ctx.fillStyle = '#d9b44a';
    for (const sd of seeds) { ctx.globalAlpha = clamp(sd.life, 0, 1); ctx.beginPath(); ctx.ellipse(sd.x, sd.y - 2, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // The garden fills the screen, but no taller than it is wide-ish; on a tall phone the residents
  // are listed underneath.
  const gardenBox = () => { const v = ui.view, w = v.w - 16; return { x: 8, y: 78, w, h: Math.max(120, Math.min(v.h - 78 - 62, Math.max(200, w * 0.85))) }; };
  function residentList(x, y, w, h) {
    ui.list('roost', x, y, w, h, S.roost.length, 60, (i, rx, ry, rw) => {
      const c = S.roost[i];
      ui.rect(rx, ry + 2, rw - 6, 54, pal.paper, 10);
      common.portrait(c, rx + 4, ry + 5, 48, 48, { fill: pal.soft });
      ui.text(c.name, rx + 60, ry + 23, { size: 14, maxW: rw - 150 });
      ui.text(ST.kind(c) + ' · here since day ' + c.since, rx + 60, ry + 40, { size: 11, bold: false, maxW: rw - 150 });
      if (ui.btn(rx + rw - 84, ry + 10, 72, 38, 'More', { size: 13, fill: pal.plum })) onTap(c);
    });
  }

  RB.scenes.roost = {
    enter(args) {
      S = RB.game.S; site = RB.game.world.site[(args && args.site) || 'roost']; t = 0; seeds = []; toss = 2; goal = null; lineN = 0;
      rng = new Rng((S.seed ^ Math.imul(S.day, 3301)) >>> 0);
      keeper = RB.npc.current(S, RB.game.world.npcs.find((n) => n.site === 'roost'));
      RB.npc.info(S, keeper.id).met = true;
      nina = caretaker(keeper);
      pen = new RB.Pen({ drawOpts: common.drawOpts, onTap, canGrab: (c) => c !== nina, bg: backdrop, under: grain, roomy: true });
      const box = gardenBox(), list = [nina].concat(S.roost);
      pen.layout(box, list); pen.sync(list);
      const n = retiredInTruck().length;
      say = n ? (n === 1 ? 'Who have you brought me? Let me see the old dear.' : 'Who have you brought me? Let me see them.') : S.roost.length ? LINES[0] : 'A garden, a porch and all the grain they want. Bring me your old-timers.';
      RB.audio.setTune('farm');
    },
    exit() { if (pen) { pen.dispose(); pen = null; } },
    debug() { return { pen, nina }; },
    update(dt) {
      if (common.checkBroke(S, 'map')) return;
      t += dt;
      const box = gardenBox(), list = [nina].concat(S.roost);
      pen.sync(list);
      pen.update(dt, box);
      tend(dt);
    },
    draw(ctx) {
      const v = ui.view;
      ctx.fillStyle = '#f7e6cf'; ctx.fillRect(0, 0, v.w, v.h);
      // header: Dona Nina, and what she says
      ui.rect(0, 0, v.w, 70, pal.ink);
      common.portrait({ P: RB.pheno.express(keeper.g) }, 8, 8, 54, 54, { fill: pal.paper, draw: { clothes: keeper.clothes } });
      ui.text(site.name, 70, 24, { size: 16, color: pal.white, maxW: v.w - 252 });
      ui.wrap(keeper.name + ': ' + say, v.w - 252, 11, false).slice(0, 3).forEach((ln, i) => ui.text(ln, 70, 40 + i * 13, { size: 11, color: pal.sand, bold: false }));
      ui.money(S.money, v.w - 104, 28, { size: 14, color: pal.white, align: 'right' });
      if (ui.btn(v.w - 96, 14, 88, 42, 'Leave', { icon: 'left', fill: pal.coral, size: 13, key: 'Escape' })) { RB.audio.play('click'); RB.game.save(); RB.game.go('map'); return; }
      ui.text('In the truck: ' + caged().length, v.w - 104, 50, { size: 11, color: pal.sand, align: 'right', bold: false });
      // the garden
      const box = gardenBox();
      if (!pen.box) pen.layout(box);
      pen.draw(ctx);
      if (!S.roost.length) {
        const msg = 'The garden is quiet. Retired birds can live out their days here: bring them in your truck and Dona Nina will look after them.';
        const tw = Math.min(380, box.w - 32), lines = ui.wrap(msg, tw - 20, 12, false);
        ctx.save(); ctx.globalAlpha = 0.9; ui.rect(box.x + 12, box.y + 12, tw, lines.length * 16 + 16, pal.paper, 10); ctx.restore();
        lines.forEach((ln, i) => ui.text(ln, box.x + 22, box.y + 32 + i * 16, { size: 12, bold: false }));
      }
      const below = v.h - 62 - (box.y + box.h + 8);
      if (below >= 120 && S.roost.length) residentList(box.x, box.y + box.h + 8, box.w, below);
      // what you can do
      const y = v.h - 54, n = retiredInTruck().length;
      ui.text('Residents: ' + S.roost.length, 12, y + 26, { size: 13 });
      ui.text(n ? n + ' retired in your truck' : 'No retired birds in your truck', 12, y + 42, { size: 11, bold: false, color: n ? pal.teal : pal.grey });
      const bw = Math.min(150, (v.w - 200) / 2);
      if (ui.btn(v.w - 8 - bw, y + 6, bw, 42, 'Check in', { icon: 'home', fill: pal.plum, size: 13 })) checkInPick();
      if (n >= 2 && ui.btn(v.w - 16 - bw * 2, y + 6, bw, 42, 'Check in all ' + n, { fill: pal.teal, size: 13 })) checkInAll();
    },
  };
})();
