// scenes/roost.js — Sunset Roost, a home for retired birds. Outside (on the map) it is the same
// cottage as ever; inside is a big fenced yard seen from above, like the world outside. Dona Nina
// looks after the old birds: they wander the grass, peck about and come running when she scatters
// grain. At nightfall they settle on the straw under the lean-to and sleep, and she goes indoors (her
// window lights up) until morning. Time passes here as it does out on the map. Bring retired birds in
// the truck to check them in (they walk in through the gate); tap a resident for its card, or take it
// home again. Drag to look around a yard too big for the screen.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp } = RB.core;
  const ui = RB.ui, pal = RB.pal, ST = RB.state, common = RB.common, props = RB.props;
  const TAU = Math.PI * 2;

  let S, site, keeper, say, t, rng, lineN, yard, cam, ents, nina, seeds, toss, drag, decor, wasNight;

  const LINES = [
    'They have earned a little peace and quiet.',
    'Grain at noon, a nap after, and nobody pecks anybody.',
    'This one still thinks it is a champion. I let it.',
    'Old birds know things. Mostly where the grain is.',
    'No rings here. Just a yard, the straw and a warm porch.',
    'They are fed and looked after, every day, for free. Somebody has to.',
  ];
  const caged = () => ST.at(S, 'cage');
  const retiredInTruck = () => caged().filter((c) => !c.person && ST.isRetired(c));
  const night = () => S.time >= 19 || S.time < 6;

  // ---- the yard: its size grows with the residents. Fence round the edge, the gate at the bottom,
  // the cottage at the top with the lean-to and its straw beside it.
  function makeYard(n) {
    const W = clamp(1400 + n * 14, 1400, 2600), H = Math.round(W * 0.52);
    const sw = clamp(260 + n * 16, 280, W * 0.36), sh = clamp(110 + n * 3, 130, 260);
    const door = { x: W / 2, y: 236 }, straw = { x: W / 2 - 150 - sw, y: 250, w: sw, h: sh };
    return { W, H, door, straw, gate: { x: W / 2, y: H - 30 }, x0: 70, x1: W - 70, y0: 290 + Math.max(0, sh - 130), y1: H - 70 };
  }
  function makeDecor(r) {
    const out = [], { W, H } = yard;
    const clear = yard.straw.y + yard.straw.h + 90; // nothing grows on the straw
    for (let i = 0; i < 9; i++) out.push({ kind: r.chance(0.6) ? 'tree' : 'bush', x: r.chance(0.5) ? r.range(110, W * 0.3) : r.range(W * 0.7, W - 110), y: r.range(Math.min(clear, H - 160), H - 120), s: r.range(0.9, 1.25) });
    for (let i = 0; i < 70; i++) out.push({ kind: 'flower', x: r.range(60, W - 60), y: r.range(yard.y0, H - 50), s: r.range(0.8, 1.2) });
    out.push({ kind: 'hay', x: yard.straw.x + yard.straw.w + 40, y: yard.straw.y + 60, s: 1.1 });
    return out;
  }
  // a spot on the straw for each resident, in rows
  function strawSpot(i, n) {
    const st = yard.straw, cols = Math.max(3, Math.ceil(Math.sqrt(n * 2))), rows = Math.ceil(n / cols);
    return { x: st.x + 24 + (i % cols + 0.5) * (st.w - 48) / cols, y: st.y + 30 + (Math.floor(i / cols) + 0.5) * Math.max(16, (st.h - 40) / Math.max(1, rows)) };
  }

  // Dona Nina, as a creature the yard can hold.
  function caretaker(k) {
    const c = { id: -1, name: k.name, g: k.g, age: 0, train: { muscle: 0, lungs: 0, reflex: 0, courage: 0 }, cond: 1, person: k.id, clothes: k.clothes, hat: null };
    c.age = RB.pheno.express(k.g).growDays + 1;
    return c;
  }
  // Someone in the yard: where they are, where they are going, and what they are up to.
  function ent(c, x, y) {
    const P = ST.pheno(c);
    return { c, P, x, y, f: rng.chance(0.5) ? 1 : -1, tx: x, ty: y, state: 'idle', t: rng.range(0.5, 3), ph: rng.next(), v: clamp(22 + P.LLv * 0.8, 22, 75) };
  }
  function syncEnts() {
    const here = new Set(S.roost);
    ents = ents.filter((e) => e === nina || here.has(e.c));
    for (const c of S.roost) if (!ents.some((e) => e.c === c)) { const e = ent(c, yard.gate.x + rng.range(-20, 20), yard.gate.y - 10); e.state = 'walk'; e.tx = yard.gate.x + rng.range(-200, 200); e.ty = yard.gate.y - rng.range(120, 260); ents.push(e); }
  }
  const residents = () => ents.filter((e) => e !== nina);
  const randomSpot = () => ({ x: rng.range(yard.x0, yard.x1), y: rng.range(yard.y0, yard.y1) });

  function checkIn(c) {
    const why = ST.checkIn(S, c);
    if (why) { ui.toast(why, pal.coral); RB.audio.play('error'); return false; }
    RB.audio.play('good');
    return true;
  }
  function checkInPick() {
    common.pick('Check in', caged(), (c) => {
      if (!checkIn(c)) return;
      say = 'Welcome, ' + c.name + '. In you come, through the gate.';
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
  function onTap(e) {
    if (e === nina) { lineN = (lineN + 1) % LINES.length; say = LINES[lineN]; RB.audio.play('click'); return; }
    common.card(e.c, () => [{ label: 'To truck', icon: 'truck', fn: () => takeHome(e.c) }], { has: (x) => S.roost.includes(x) });
  }
  function residentList() {
    ui.open({ draw() {
      const v = ui.view, box = ui.window('Residents (' + S.roost.length + ')', 420, Math.min(v.h - 16, 120 + S.roost.length * 60), {});
      if (!box) return;
      if (!S.roost.length) { ui.para('Nobody lives here yet.', box.x, box.y, box.w, { size: 13 }); return; }
      ui.list('roostList', box.x, box.y, box.w, box.h, S.roost.length, 60, (i, rx, ry, rw) => {
        const c = S.roost[i];
        ui.rect(rx, ry + 2, rw - 6, 54, pal.paper, 10);
        common.portrait(c, rx + 4, ry + 5, 48, 48, { fill: pal.soft });
        ui.text(c.name, rx + 60, ry + 23, { size: 14, maxW: rw - 150 });
        ui.text(ST.kind(c) + ' · here since day ' + c.since, rx + 60, ry + 40, { size: 11, bold: false, maxW: rw - 150 });
        if (ui.btn(rx + rw - 84, ry + 10, 72, 38, 'More', { size: 13, fill: pal.plum })) { const e = ents.find((x) => x.c === c); if (e) onTap(e); }
      });
    } });
  }

  // ---- life in the yard
  function walkTo(e, x, y) { e.tx = clamp(x, 40, yard.W - 40); e.ty = clamp(y, 200, yard.H - 40); e.state = 'walk'; }
  function step(e, dt, speedK) {
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy), v = e.v * (speedK || 1);
    if (d < 4) return true;
    const k = Math.min(1, v * dt / d);
    e.x += dx * k; e.y += dy * k;
    if (Math.abs(dx) > 2) e.f = dx > 0 ? 1 : -1;
    e.ph = (e.ph + dt * v / (e.P.LLv * 2.2 + 12)) % 1;
    return false;
  }
  function updateResident(e, i, n, dt, dark) {
    e.t -= dt;
    if (dark) { // bedtime: off to a spot on the straw, then sleep
      const sp = strawSpot(i, n);
      if (e.state !== 'sleep') { e.tx = sp.x; e.ty = sp.y; if (step(e, dt, 1.2)) { e.state = 'sleep'; e.f = rng.chance(0.5) ? 1 : -1; } else e.state = 'walk'; }
      return;
    }
    if (e.state === 'sleep') { e.state = 'idle'; e.t = rng.range(0.5, 4); } // morning
    if (e.state === 'walk' || e.state === 'grain') {
      if (step(e, dt, e.state === 'grain' ? 1.6 : 1)) { e.state = e.state === 'grain' ? 'eat' : rng.chance(0.4) ? 'peck' : 'idle'; e.t = e.state === 'eat' ? rng.range(3, 6) : rng.range(1.5, 5); }
    } else if (e.t <= 0) {
      if (e.state === 'eat') { // eat a seed or two where it stands
        let n2 = 0; for (const sd of seeds) if (n2 < 2 && Math.hypot(sd.x - e.x, sd.y - e.y) < 50) { sd.life = Math.min(sd.life, 0.3); n2++; }
      }
      const s = randomSpot(); walkTo(e, e.x + clamp(s.x - e.x, -380, 380), e.y + clamp(s.y - e.y, -260, 260));
    }
  }
  // Dona Nina: by day she strolls about and scatters grain every little while, and the old birds come
  // running; at nightfall she goes indoors, and comes out again in the morning.
  function updateNina(dt, dark) {
    const e = nina;
    if (dark) {
      if (e.inside) return;
      e.tx = yard.door.x; e.ty = yard.door.y; e.state = 'walk';
      if (step(e, dt, 1.3)) { e.inside = true; say = 'Goodnight, my dears. Sleep tight.'; RB.audio.play('click'); }
      return;
    }
    if (e.inside) { e.inside = false; e.x = yard.door.x; e.y = yard.door.y + 6; walkTo(e, yard.door.x + rng.range(-150, 150), yard.y0 + rng.range(40, 140)); say = 'Good morning! Who is hungry?'; }
    toss -= dt;
    if (e.state === 'walk') { if (step(e, dt)) { e.state = 'idle'; e.t = rng.range(2, 5); } }
    else if (toss <= 0) { // scatter grain in front of her
      const cx = e.x + e.f * 70, cy = e.y + rng.range(-10, 30);
      for (let i = 0; i < 16; i++) { const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * 70; seeds.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.6, life: rng.range(8, 12), drop: rng.range(0.1, 0.5) }); }
      RB.audio.play('click');
      for (const r of residents()) if (r.state !== 'sleep' && rng.chance(0.85)) { r.tx = cx + rng.range(-70, 70); r.ty = cy + rng.range(-40, 40); r.state = 'grain'; }
      toss = rng.range(9, 15); e.t = rng.range(2, 4); e.state = 'idle';
    } else if (e.t <= 0 && e.state === 'idle') {
      const s = randomSpot(); walkTo(e, s.x, s.y); e.t = 3;
    } else e.t -= dt;
  }

  // ---- drawing
  function grass(ctx, dark) {
    const { W, H } = yard;
    ctx.fillStyle = dark ? '#3f6446' : '#8fbf6a'; ctx.fillRect(-W, -H, W * 3, H * 3); // the fields outside
    ctx.fillStyle = dark ? '#4c7652' : '#a6d07e'; ctx.fillRect(0, 0, W, H); // the yard
    ctx.fillStyle = dark ? '#557f58' : '#b4d88c';
    for (let i = 0; i < 260; i++) { const x = RB.core.hash2(i, 3, 11) * W, y = RB.core.hash2(i, 5, 11) * H; ctx.fillRect(x, y, 3, 8); ctx.fillRect(x + 4, y + 2, 3, 6); }
    // the path from the gate to the door
    ctx.fillStyle = dark ? '#8a7a5c' : '#e3c98a';
    ctx.beginPath(); ctx.moveTo(yard.gate.x - 34, H); ctx.quadraticCurveTo(W / 2 + 90, H * 0.6, yard.door.x - 26, yard.door.y); ctx.lineTo(yard.door.x + 26, yard.door.y); ctx.quadraticCurveTo(W / 2 + 150, H * 0.6, yard.gate.x + 34, H); ctx.closePath(); ctx.fill();
    // the straw under the lean-to
    const st = yard.straw;
    ctx.fillStyle = dark ? '#a08a4a' : '#e6c768'; ui.rr(ctx, st.x, st.y, st.w, st.h, 18); ctx.fill();
    ctx.fillStyle = dark ? '#8a763e' : '#d4b250';
    for (let i = 0; i < 40; i++) ctx.fillRect(st.x + 10 + RB.core.hash2(i, 7, 3) * (st.w - 30), st.y + 8 + RB.core.hash2(i, 9, 3) * (st.h - 20), 14, 2);
  }
  function fence(ctx) {
    const { W, H } = yard, post = '#96693f', rail = '#b98a5a';
    props.fence(ctx, 10, W / 2 - 60, H - 14); props.fence(ctx, W / 2 + 60, W - 10, H - 14); // the bottom, with the gate open in the middle
    ctx.fillStyle = post; ctx.fillRect(W / 2 - 66, H - 60, 10, 50); ctx.fillRect(W / 2 + 56, H - 60, 10, 50);
    for (const x of [10, W - 18]) { // the sides, seen end-on
      ctx.fillStyle = rail; ctx.fillRect(x + 2, 40, 4, H - 54);
      ctx.fillStyle = post; for (let y = 40; y < H - 14; y += 60) ctx.fillRect(x, y - 30, 8, 34);
    }
  }
  function backFence(ctx) { props.fence(ctx, 10, yard.W - 10, 120); }
  function leanTo(ctx, dark) { // a roof on posts over the straw
    const st = yard.straw, y = st.y + 6;
    ctx.fillStyle = '#96693f'; ctx.fillRect(st.x + 6, y - 70, 8, 76); ctx.fillRect(st.x + st.w - 14, y - 70, 8, 76);
    ctx.fillStyle = dark ? '#8a5040' : '#c4553a'; ctx.beginPath(); ctx.moveTo(st.x - 16, y - 64); ctx.lineTo(st.x + st.w + 16, y - 64); ctx.lineTo(st.x + st.w + 6, y - 92); ctx.lineTo(st.x - 6, y - 92); ctx.closePath(); ctx.fill();
  }
  function cottage(ctx, dark) {
    const x = yard.door.x, y = yard.door.y;
    props.building(ctx, { x, y: y - 60, id: 'roost' }, t);
    if (dark && nina.inside) { // her window lit
      ctx.fillStyle = 'rgba(255,214,120,0.9)'; ctx.fillRect(x - 64, y - 66, 30, 26); ctx.fillRect(x + 34, y - 66, 30, 26);
    }
  }
  function poseOf(e) {
    const P = e.P, walking = e.state === 'walk' || e.state === 'grain', sleeping = e.state === 'sleep';
    const pose = RB.pose.animPose(P, { x: e.x, y: e.y, f: e.f, phase: e.ph, speed: walking ? (e.state === 'grain' ? 0.5 : 0.3) : 0, time: t + e.ph * 7, sit: sleeping ? 1 : 0 });
    const pecking = !walking && !sleeping && e !== nina && (e.state === 'eat' ? Math.sin(t * 9 + e.ph * 20) > 0 : e.state === 'peck' && Math.sin(t * 3 + e.ph * 20) > 0.5);
    if (pecking) { const k = pose.neck.length; pose.neck[k - 1] += P.NL * 0.5; pose.neck[k - 2] += e.f * P.NL * 0.3; pose.headAng += e.f > 0 ? 0.9 : -0.9; }
    if (sleeping) pose.eye = 'sleep';
    return pose;
  }

  // The yard on screen: below the header, above the buttons.
  const yardBox = () => { const v = ui.view; return { x: 0, y: 70, w: v.w, h: v.h - 70 - 62 }; };
  function fitCam(box) {
    const k = (RB.game.view && RB.game.view.s) || 1; // screen pixels per unit of the interface
    const z = Math.max(Math.min(box.w / yard.W, box.h / yard.H), 0.45 / k); // the whole yard if the birds stay big enough, else drag to look around
    cam.z = z;
    const hw = box.w / 2 / z, hh = box.h / 2 / z;
    cam.x = yard.W <= hw * 2 ? yard.W / 2 : clamp(cam.x, hw, yard.W - hw);
    cam.y = yard.H <= hh * 2 ? yard.H / 2 : clamp(cam.y, hh, yard.H - hh);
  }

  RB.scenes.roost = {
    enter(args) {
      S = RB.game.S; site = RB.game.world.site[(args && args.site) || 'roost']; t = 0; seeds = []; toss = 3; lineN = 0; drag = null;
      rng = new Rng((S.seed ^ Math.imul(S.day, 3301)) >>> 0);
      keeper = RB.npc.current(S, RB.game.world.npcs.find((n) => n.site === 'roost'));
      RB.npc.info(S, keeper.id).met = true;
      yard = makeYard(S.roost.length); decor = makeDecor(new Rng(4242));
      const dark = night(); wasNight = dark;
      nina = ent(caretaker(keeper), yard.door.x + 60, yard.y0 + 60); nina.v = 70; nina.inside = dark;
      ents = [nina];
      S.roost.forEach((c, i) => { const p = dark ? strawSpot(i, S.roost.length) : randomSpot(), e = ent(c, p.x, p.y); if (dark) e.state = 'sleep'; ents.push(e); });
      cam = { x: dark ? yard.straw.x + yard.straw.w / 2 : yard.W / 2, y: 0, z: 1 }; // (starts at the top, by the cottage or, at night, the straw, when the yard does not fit)
      const n = retiredInTruck().length;
      say = dark ? (S.roost.length ? 'Shh, they are all asleep. ' : '') + 'Come back in the morning, dear.' : n ? (n === 1 ? 'Who have you brought me? Let me see the old dear.' : 'Who have you brought me? Let me see them.') : S.roost.length ? LINES[0] : 'A big yard, a warm porch and all the grain they want. Bring me your old-timers.';
      RB.audio.setTune(dark ? 'night' : 'day');
    },
    exit() {},
    debug() { return { ents, nina, yard, cam, seeds, night: night() }; },
    update(dt) {
      if (common.checkBroke(S, 'map')) return;
      t += dt;
      // time passes here as it does on the map (the next day starts once you are back outside)
      const before = S.time; S.time = Math.min(29.95, S.time + dt / 30 * (RB.game.timeSpeed || 1));
      if (before < 19 && S.time >= 19 && RB.game.timeSpeed > 1) RB.game.timeSpeed = 1;
      const dark = night();
      if (dark !== wasNight) { wasNight = dark; RB.audio.setTune(dark ? 'night' : 'day'); }
      syncEnts();
      const res = residents();
      res.forEach((e, i) => updateResident(e, i, res.length, dt, dark));
      updateNina(dt, dark);
      for (const sd of seeds) { sd.life -= dt; sd.drop = Math.max(0, sd.drop - dt); }
      seeds = seeds.filter((sd) => sd.life > 0);
      // drag to look around
      const box = yardBox(), p = ui.downIn(box.x, box.y, box.w, box.h);
      if (p && p.moved > 10) { if (drag && drag.id === p.id) { cam.x -= (p.x - drag.x) / cam.z; cam.y -= (p.y - drag.y) / cam.z; } drag = { id: p.id, x: p.x, y: p.y }; } else if (!p) drag = null;
    },
    draw(ctx) {
      const v = ui.view, dark = night(), box = yardBox();
      ctx.fillStyle = '#f7e6cf'; ctx.fillRect(0, 0, v.w, v.h);
      fitCam(box);
      const z = cam.z, ox = box.x + box.w / 2 - cam.x * z, oy = box.y + box.h / 2 - cam.y * z;
      ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
      ctx.translate(ox, oy); ctx.scale(z, z);
      grass(ctx, dark);
      backFence(ctx);
      // grain on the ground
      ctx.fillStyle = '#d9b44a';
      for (const sd of seeds) { ctx.globalAlpha = clamp(sd.life, 0, 1); ctx.beginPath(); ctx.ellipse(sd.x, sd.y - sd.drop * 60, 4, 3, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      // everything standing, back to front
      const items = decor.map((d) => ({ y: d.y, draw: () => props.decor(ctx, d, t) }));
      items.push({ y: yard.door.y, draw: () => cottage(ctx, dark) }, { y: yard.straw.y + 4, draw: () => leanTo(ctx, dark) });
      for (const e of ents) {
        if (e.inside) continue;
        items.push({ y: e.y, draw: () => {
          RB.art.drawShadow(ctx, e.x, e.y + 1, e.P.TL * 0.5);
          RB.art.drawCreature(ctx, e.P, poseOf(e), e === nina ? { clothes: keeper.clothes } : common.drawOpts(e.c));
          if (e.state === 'sleep') { const k = (t * 0.5 + e.ph) % 1; props.label(ctx, 'z', e.x + e.f * e.P.TL * 0.3 + k * 14, e.y - e.P.rest - e.P.TD - 10 - k * 26, 12 + k * 6, 'rgba(255,255,255,' + (1 - k).toFixed(2) + ')'); }
        } });
      }
      items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
      fence(ctx);
      ctx.restore();
      if (dark) { ctx.fillStyle = 'rgba(16,20,48,0.38)'; ctx.fillRect(box.x, box.y, box.w, box.h); }
      // tap someone (the nearest in front first)
      for (const e of ents.slice().sort((a, b) => b.y - a.y)) {
        if (e.inside) continue;
        const sx = ox + e.x * z, sy = oy + e.y * z, w = Math.max(30, e.P.TL * 1.2 * z), h = Math.max(36, (e.P.rest + e.P.TD + e.P.NL + e.P.HR) * z);
        if (ui.tapIn(sx - w / 2, sy - h, w, h + 8)) { onTap(e); break; }
      }
      if (!S.roost.length) {
        const msg = 'The yard is quiet. Retired birds can live out their days here: bring them in your truck and Dona Nina will look after them.';
        const tw = Math.min(380, box.w - 32), lines = ui.wrap(msg, tw - 20, 12, false);
        ctx.save(); ctx.globalAlpha = 0.9; ui.rect(box.x + 12, box.y + 12, tw, lines.length * 16 + 16, pal.paper, 10); ctx.restore();
        lines.forEach((ln, i) => ui.text(ln, box.x + 22, box.y + 32 + i * 16, { size: 12, bold: false }));
      }
      // header: Dona Nina, and what she says
      ui.rect(0, 0, v.w, 70, pal.ink);
      common.portrait({ P: RB.pheno.express(keeper.g) }, 8, 8, 54, 54, { fill: pal.paper, draw: { clothes: keeper.clothes } });
      common.keeperTap(S, RB.game.world.npcs.find((n) => n.site === 'roost'), 8, 8, 54, 54, () => RB.game.go('map'));
      ui.text(site.name + ' · ' + common.fmtTime(S.time), 70, 24, { size: 16, color: pal.white, maxW: v.w - 252 });
      ui.wrap(keeper.name + ': ' + RB.npc.chirp(keeper) + say, v.w - 252, 11, false).slice(0, 3).forEach((ln, i) => ui.text(ln, 70, 40 + i * 13, { size: 11, color: pal.sand, bold: false }));
      ui.money(S.money, v.w - 104, 28, { size: 14, color: pal.white, align: 'right' });
      if (ui.btn(v.w - 96, 14, 88, 42, 'Leave', { icon: 'left', fill: pal.coral, size: 13, key: 'Escape' })) { RB.audio.play('click'); RB.game.save(); RB.game.go('map'); return; }
      ui.text('In the truck: ' + caged().length, v.w - 104, 50, { size: 11, color: pal.sand, align: 'right', bold: false });
      // what you can do
      const y = v.h - 58, n = retiredInTruck().length;
      ui.rect(0, y - 4, v.w, 62, '#f7e6cf');
      const bw = Math.min(150, (v.w - 24) / 3 - 4);
      if (ui.btn(8, y + 6, bw, 42, 'Residents ' + S.roost.length, { fill: pal.soft, color: pal.ink, size: 13 })) residentList();
      ui.text(n ? n + ' retired in your truck' : 'No retired birds in your truck', 16 + bw, y + 32, { size: 11, bold: false, color: n ? pal.teal : pal.grey, maxW: v.w - bw * 2 - 40 - (n >= 2 ? bw : 0) });
      if (ui.btn(v.w - 8 - bw, y + 6, bw, 42, 'Check in', { icon: 'home', fill: pal.plum, size: 13 })) checkInPick();
      if (n >= 2 && ui.btn(v.w - 16 - bw * 2, y + 6, bw, 42, 'Check in all ' + n, { fill: pal.teal, size: 13 })) checkInAll();
    },
  };
})();
