// scenes/coop.js — home. A side-on yard where the birds are real ragdolls: tap one for its card,
// drag one into the truck, a nest, the training dummy or the BFC pick-up box. The truck's bed is
// part of the yard: whoever rides in it stands in it, and can be dragged in and out at any time. Feed from the bar
// at the bottom, sleep to end the day, or drive out to the map.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, lerp, TAU } = RB.core;
  const ui = RB.ui, pal = RB.pal, input = RB.input, ST = RB.state, common = RB.common, props = RB.props;
  const DT = RB.fight.DT;

  let S, pw, birds, cam, parts, acc, selected, grab, cand, rng, lay, pan, t, hit, bedBox;
  const BED_Y = -46, BED_MAX = 380;

  function layout() {
    const n = ST.nestCount(S);
    lay = { truck: -250, feeder: -60, nests: [], dummy: null };
    lay.bedR = lay.truck + 18; lay.house = lay.bedR - BED_MAX - 150; lay.left = lay.house - 120;
    for (let i = 0; i < n; i++) lay.nests.push(80 + i * 150);
    let x = 80 + n * 150;
    if (S.up.dummy) { lay.dummy = x - 10; x += 120; }
    lay.box = x + 20; lay.right = lay.box + 110; lay.walk0 = lay.truck + 90; lay.walk1 = lay.box - 80;
    lay.bedLen = 80;
  }
  // Landscape fits the whole yard when it can; portrait stays close and pans.
  function zoom() {
    const v = ui.view, byH = v.h * 0.72 / 330;
    return v.portrait ? clamp(byH, 0.8, 1.45) : clamp(Math.min(byH, v.w / (lay.right - lay.left + 30)), 0.82, 1.25);
  }
  const groundY = () => ui.view.h - 92;
  const toWorld = (px, py) => ({ x: cam.x + (px - ui.view.w / 2) / zoom(), y: (py - groundY()) / zoom() });

  // The truck bed grows with whoever rides in it.
  function bedLen() {
    let sum = 40;
    for (const c of ST.at(S, 'cage')) sum += ST.pheno(c).TL * 0.8 + 14;
    return clamp(sum, 80, BED_MAX);
  }
  const bedL = () => lay.bedR - lay.bedLen;
  const inBed = (c) => c.at === 'cage';
  function mkRag(c, x) {
    const P = ST.pheno(c), bed = inBed(c), m = Math.min(P.TL * 0.5 + 6, lay.bedLen / 2 - 1);
    const rx = bed ? clamp(x === undefined ? rng.range(bedL() + m, lay.bedR - m) : x, bedL() + m, lay.bedR - m) : clamp(x, lay.walk0, lay.walk1);
    const rag = new RB.creature.Rag(pw, P, rx, bed ? BED_Y : 0, rng.chance(0.5) ? 1 : -1);
    const e = { c, P, rag, mode: 'idle', tx: x, t: rng.range(0.3, 3), blink: rng.range(1, 5), voice: rng.range(4, 20) };
    birds.push(e);
    return e;
  }
  function dropRag(e) { e.rag.remove(); birds.splice(birds.indexOf(e), 1); }
  function rebuild() {
    for (const e of birds.slice()) dropRag(e);
    lay.bedLen = bedLen(); fitBed();
    for (const c of ST.at(S, 'home')) mkRag(c, rng.range(lay.walk0, lay.walk1));
    for (const c of ST.at(S, 'cage')) mkRag(c);
  }
  function fitBed() { if (bedBox) { bedBox.x0 = bedL(); bedBox.x1 = lay.bedR; } }
  // Move a whole ragdoll sideways (to keep riders inside the bed).
  function shiftRag(rag, dx) {
    for (const p of rag.parts) { p.x += dx; p.ox += dx; }
    for (const leg of rag.legs) { if (leg.sw) { leg.sw.x0 += dx; leg.sw.x1 += dx; } if (leg.from) leg.from.x += dx; }
  }
  function spark(x, y, kind, n, text) {
    for (let i = 0; i < (n || 1); i++) parts.push({ x: x + rng.range(-12, 12), y: y + rng.range(-8, 8), vx: rng.range(-40, 40), vy: rng.range(-90, -30), life: 1, kind, text, rot: rng.range(0, TAU) });
  }

  function think(e, dt) {
    const rag = e.rag, P = e.P;
    e.blink -= dt; if (e.blink < -0.12) e.blink = rng.range(1.5, 6);
    e.voice -= dt;
    if (e.voice < 0) { e.voice = rng.range(8, 30); if (birds.length && !e.c.person && rng.chance(0.5)) RB.audio.voice(P.voice, 'cluck'); }
    if (rag.state !== 'stand') { rag.vxDes = 0; return; }
    const asleep = S.time >= 20 && !e.c.person;
    rag.crouchT = asleep ? 0.55 : 1;
    rag.eye = asleep ? 'sleep' : e.blink < 0 ? 'blink' : '';
    if (asleep) { rag.vxDes = 0; return; }
    const bed = inBed(e.c), m = Math.min(P.TL * 0.5 + 6, lay.bedLen / 2 - 1);
    const lo = bed ? bedL() + m : lay.walk0, hi = bed ? lay.bedR - m : lay.walk1, floorY = bed ? BED_Y : 0;
    // anyone in the yard who has not eaten today goes to the feeder; one grain fills any creature
    if (!bed && !e.c.fed && S.feeder > 0) {
      const fx = lay.feeder + (e.c.id % 2 ? 1 : -1) * (24 + e.P.TL * 0.3), dx = fx - rag.midX();
      // once at the feeder it stays put while pecking (a peck lunges a little)
      if (Math.abs(dx) > (e.atFeed ? 26 + e.P.TL * 0.5 : 16)) { const dir = Math.sign(dx); if (dir !== rag.f && !rag.act) rag.flip(); rag.vxDes = dir * Math.min(P.speedMax * 0.5, 60 + P.speedMax * 0.15); e.atFeed = false; e.eatT = 0; return; }
      e.atFeed = true;
      rag.vxDes = 0;
      const face = Math.sign(lay.feeder - rag.midX()) || 1;
      if (face !== rag.f && !rag.act) rag.flip();
      if (!rag.act && !e.c.person) rag.startPeck(() => ({ x: lay.feeder, y: -26 }));
      e.eatT = (e.eatT || 0) + dt;
      if (e.eatT > 0.9) { S.feeder--; ST.eat(e.c); e.eatT = 0; e.atFeed = false; spark(lay.feeder, -44, 'heart', 1); e.t = rng.range(0.5, 2); e.mode = 'idle'; }
      return;
    }
    e.t -= dt;
    if (e.t <= 0) {
      const r = rng.next();
      if (r < 0.5) { e.mode = 'walk'; e.tx = rng.range(lo, Math.max(lo, hi)); e.t = rng.range(2, 6); }
      else if (r < 0.75 && !e.c.person) { e.mode = 'idle'; e.t = rng.range(1, 2); rag.startPeck(() => ({ x: rag.C.x + rag.f * (P.NL * 0.6 + 8), y: floorY - 2 })); }
      else if (r < 0.82) { e.mode = 'idle'; rag.wingV = 16; e.t = rng.range(1, 2.5); }
      else { e.mode = 'idle'; e.t = rng.range(1, 4); }
    }
    if (e.mode === 'walk') {
      const dx = e.tx - rag.midX();
      if (Math.abs(dx) < 14) { e.mode = 'idle'; rag.vxDes = 0; }
      else { const dir = Math.sign(dx); if (dir !== rag.f && !rag.act) rag.flip(); rag.vxDes = dir * Math.min(P.speedMax * 0.4, 50 + P.speedMax * 0.12); }
    } else rag.vxDes = 0;
  }

  // ---- what you can do with a creature from its card
  function actions(c) {
    const a = [];
    if (c.at === 'home') a.push({ label: 'To truck', icon: 'truck', fn: () => place(c, 'cage') });
    else a.push({ label: 'To yard', icon: 'home', fn: () => place(c, 'home') });
    a.push({ label: 'Wear', icon: 'hat', fill: pal.plum, fn: () => wear(c) });
    if (S.up.dummy) a.push({ label: 'Train', icon: 'weight', fill: pal.mustard, disabled: c.trained || ST.isRetired(c), fn: () => trainPick(c) });
    a.push({ label: c.person ? 'Let go' : 'Set free', icon: 'feather', fill: pal.grey, fn: () => release(c) });
    return a;
  }
  // Move a creature between the yard and a container, keeping its ragdoll in step.
  function place(c, to, x) {
    const msg = ST.move(S, c, to);
    if (msg) { ui.toast(msg, pal.coral); RB.audio.play('error'); return false; }
    const e = birds.find((b) => b.c === c);
    lay.bedLen = bedLen(); fitBed();
    if (to === 'home') { if (!e) mkRag(c, x === undefined ? lay.feeder + rng.range(-80, 200) : x); }
    else if (to === 'cage') {
      // keep the ragdoll if it was dropped over the bed; otherwise it hops in
      if (e && (e.rag.midX() < bedL() - 10 || e.rag.midX() > lay.bedR + 10)) { dropRag(e); mkRag(c); }
      else if (!e) mkRag(c);
    } else if (e) { spark(e.rag.midX(), e.rag.midY(), 'poof', 5); dropRag(e); }
    RB.audio.play(to === 'crate' ? 'thud' : 'click');
    if (to === 'home' && x !== undefined && e) { /* dragged out: it stays where it was dropped */ }
    if (to === 'crate') ui.toast(c.name + ' waits for the BFC van tonight. Take ' + (c.person ? 'them' : 'it') + ' back before you sleep, if you change your mind.', pal.brick);
    return true;
  }
  function release(c) {
    ui.confirm(c.person ? 'Let ' + c.name + ' go?' : 'Set ' + c.name + ' free?', c.person ? c.name + ' walks home, and will not forget this.' : c.name + ' goes back to the wild near the farm, still answering to that name. Net it again one day if you miss it.', c.person ? 'Let go' : 'Set free', () => {
      const e = birds.find((b) => b.c === c);
      if (e) dropRag(e);
      if (c.person) { const back = ST.releasePerson(S, c, 40); if (back) ui.toast(back.name + ', who was minding ' + c.name + '\'s place, is back in the truck.', pal.plum); }
      const home = RB.game.world.site.home;
      ST.setFree(S, c, home.x, home.y + 150); // it lives on round the farm under its own name, and its genes join the wild there
      ui.closeAll();
    });
  }
  function wear(c) {
    ui.open({ draw() {
      const items = ST.owned(S).filter((id) => ['hat', 'gear'].includes(RB.items.ITEMS[id].kind));
      const box = ui.window('What ' + c.name + ' wears', 360, Math.min(ui.view.h - 16, 170 + items.length * 50), {});
      if (!box) return;
      const worn = [c.hat, c.gear].filter(Boolean);
      ui.text(worn.length ? 'Wearing: ' + worn.map((id) => RB.items.ITEMS[id].name).join(', ') : 'Wearing nothing.', box.x, box.y + 14, { size: 13, maxW: box.w - 96 });
      if (worn.length && ui.btn(box.x + box.w - 88, box.y - 4, 88, 32, 'Take off', { fill: pal.grey, size: 12 })) { for (const id of worn) ST.give(S, id); c.hat = null; c.gear = null; }
      if (!items.length) ui.para('You own no hats or gear. Odete sells them in town.', box.x, box.y + 34, box.w, { size: 12, color: pal.grey });
      ui.list('wear', box.x, box.y + 34, box.w, box.h - 34, items.length, 50, (i, x, y, w) => {
        const it = RB.items.ITEMS[items[i]];
        ui.rect(x, y + 2, w - 6, 44, pal.soft, 10); ui.itemIcon(it.id, x + 24, y + 24, 24);
        ui.text(it.name, x + 46, y + 20, { size: 13 }); ui.text(it.desc, x + 46, y + 36, { size: 10, bold: false, maxW: w - 130 });
        if (ui.btn(x + w - 76, y + 7, 64, 34, 'Wear', { size: 12 })) {
          const slot = it.kind === 'hat' ? 'hat' : 'gear';
          if (c[slot]) ST.give(S, c[slot]);
          ST.take(S, it.id); c[slot] = it.id; RB.audio.play('click');
        }
      });
    } });
  }
  // Each session says what it trains, how much it adds, and which of the bird's numbers go up.
  const RATE_NAMES = { power: 'Power', speed: 'Speed', tough: 'Toughness', stamina: 'Stamina', guts: 'Guts', wits: 'Wits', fury: 'Fury' };
  function trainPick(c) {
    const labels = { muscle: 'Strength', reflex: 'Reflexes', lungs: 'Wind', courage: 'Nerve' };
    const pct = (x) => Math.round(x * 100) + '%';
    ui.open({ draw() {
      const box = ui.window('Train ' + c.name, 380, 330, {});
      if (!box) return;
      ui.para('One session a day. Each adds a little to one kind of training, up to 15%.', box.x, box.y, box.w, { size: 12 });
      ST.TRAIN.forEach((stat, i) => {
        const y = box.y + 36 + i * 60, pv = ST.trainPreview(c, stat), maxed = pv.gain <= 0, tx = box.x + 132, tw = box.w - 132;
        ui.text(maxed ? labels[stat] + ' maxed out (15%)' : '+' + pct(pv.gain) + ' ' + labels[stat].toLowerCase() + ' (now ' + pct(pv.from) + ')', tx, y + 14, { size: 12, maxW: tw });
        const shown = new Set(pv.rates.map((r) => r[0]));
        const parts = pv.rates.map((r) => RATE_NAMES[r[0]] + ' +' + r[1]).concat(pv.affects.filter((k) => !shown.has(k)).map((k) => RATE_NAMES[k] + ' +<1'));
        ui.text(maxed ? 'Nothing more to gain here.' : parts.length ? parts.join(' · ') : 'Too small to show in the numbers yet.', tx, y + 30, { size: 11, bold: false, color: maxed ? pal.grey : pal.teal, maxW: tw });
        ui.bar(tx, y + 38, tw, 6, c.train[stat] / 0.15, pal.mustard);
        if (ui.btn(box.x, y, 122, 46, labels[stat], { fill: pal.mustard, color: pal.ink, size: 13, disabled: maxed })) {
          const msg = ST.train(S, c, stat);
          if (msg) ui.toast(msg, pal.coral); else { hit = 1; RB.audio.play('kick'); ui.toast(c.name + ' trained ' + labels[stat].toLowerCase() + '.', pal.teal); const e = birds.find((b) => b.c === c); if (e) { const x = e.rag.midX(); dropRag(e); mkRag(c, x); } }
          ui.close();
        }
      });
    } });
  }
  // The feeder: pick how many grains to pour in at once.
  function feederWindow() {
    const mouths = () => S.birds.length;
    let n = Math.max(1, mouths() - S.feeder);
    ui.open({ draw() {
      const box = ui.window('Feeder', 340, 300, {});
      if (!box) return;
      const have = ST.count(S, 'grain'), most = Math.min(999, have);
      n = Math.max(0, Math.min(n, most));
      const nights = mouths() ? Math.floor(S.feeder / mouths()) : 0;
      ui.para('Holds ' + S.feeder + ' grain' + (mouths() ? ' (' + (nights === 1 ? 'one night' : nights + ' nights') + ' for your ' + mouths() + ' mouths)' : '') + '. Each creature eats one a night; what is left stays for the next. You have ' + ST.fmtCount(have) + ' grain.', box.x, box.y, box.w, { size: 13 });
      // the amount: steppers and quick picks
      const sy = box.y + 76, bw = (box.w - 4 * 6 - 90) / 4;
      const step = (d, i) => { if (ui.btn(box.x + i * (bw + 6) + (i >= 2 ? 90 + 6 : 0), sy, bw, 40, (d > 0 ? '+' : '−') + Math.abs(d), { fill: pal.soft, color: pal.ink, size: 14, flat: true })) { n = Math.max(0, Math.min(most, n + d)); RB.audio.play('click'); } };
      step(-10, 0); step(-1, 1); step(1, 2); step(10, 3);
      ui.rect(box.x + 2 * (bw + 6), sy, 90, 40, pal.paper, 10);
      ui.text(String(n), box.x + 2 * (bw + 6) + 45, sy + 27, { size: 20, align: 'center' });
      const qy = sy + 50, qw = (box.w - 12) / 3;
      const quick = (label, v, i) => { if (ui.btn(box.x + i * (qw + 6), qy, qw, 34, label, { fill: pal.soft, color: pal.ink, size: 12, flat: true, disabled: v <= 0 })) { n = Math.min(most, v); RB.audio.play('click'); } };
      quick('Tonight', mouths() - S.feeder, 0);
      quick('A week', mouths() * 7 - S.feeder, 1);
      quick(have === Infinity ? '100' : 'All (' + most + ')', have === Infinity ? 100 : most, 2);
      if (ui.btn(box.x, box.y + box.h - 44, box.w, 40, n > 0 ? 'Pour in ' + n + ' grain' : have ? 'Pick an amount' : 'No grain: Feed & Seed sells it', { icon: 'grain', fill: pal.mustard, color: pal.ink, disabled: n <= 0 })) {
        if (ST.take(S, 'grain', n)) { S.feeder += n; RB.audio.play('click'); ui.toast(n + ' grain in the feeder. It now holds ' + S.feeder + '.', pal.teal); RB.game.save(); n = Math.max(0, Math.min(n, ST.count(S, 'grain'))); }
      }
    } });
  }
  function eggWindow(e) {
    const d = e.hatch - S.day;
    ui.message('Egg', 'From a ' + e.dad.toLowerCase() + ' and a ' + e.mom.toLowerCase() + '. It hatches ' + (d <= 1 ? 'tomorrow morning' : 'in ' + d + ' mornings') + ', if the coop has room.');
  }
  function doSleep() {
    const rep = ST.sleep(S);
    layout(); rebuild();
    common.checkAch(S);
    RB.game.save();
    RB.audio.play('sleep');
    ui.message('Day ' + S.day, rep.lines.length ? rep.lines.join('\n') : 'A quiet night.', () => {
      const cock = S.birds.find((c) => !c.person && c.g.sex === 'M' && ST.isAdult(c));
      if (cock) RB.audio.voice(ST.pheno(cock).voice, 'crow');
    }, { ok: 'Good morning' });
  }
  function feedBird(c, x, y) {
    const msg = ST.feed(S, c, selected);
    if (!msg) { ui.toast('None left.', pal.coral); return; }
    ui.toast(msg, pal.teal); RB.audio.play('good'); spark(x, y, selected === 'mushroom' || selected === 'isotope' ? 'poof' : 'heart', 4);
    const e = birds.find((b) => b.c === c);
    if (e && e.P !== ST.pheno(c)) { const bx = e.rag.midX(); dropRag(e); mkRag(c, bx); }
    if (!ST.count(S, selected)) selected = null;
  }
  // Open a list of who is inside a container.
  // Tap the truck: load or unload everyone at once (or drag them one by one).
  function truckWindow() {
    ui.open({ draw() {
      const n = ST.at(S, 'cage').length, yard = ST.at(S, 'home');
      const box = ui.window('The truck', 320, 214, {});
      if (!box) return;
      ui.para('It carries as many as you like. Drag birds in and out of the bed, or move everyone at once.', box.x, box.y, box.w, { size: 12 });
      const y = box.y + box.h - 94;
      if (ui.btn(box.x, y, box.w, 42, 'Unload everyone (' + n + ')', { icon: 'home', disabled: !n })) {
        let left = 0;
        for (const c of ST.at(S, 'cage')) if (!place(c, 'home', rng.range(lay.walk0, lay.walk1))) { left++; break; }
        if (left) ui.toast('The coop is full: the rest stay in the truck.', pal.coral);
        ui.close();
      }
      if (ui.btn(box.x, y + 50, box.w, 42, 'Load everyone from the yard (' + yard.length + ')', { icon: 'truck', fill: pal.mustard, color: pal.ink, disabled: !yard.length })) {
        for (const c of yard) place(c, 'cage');
        ui.close();
      }
    } });
  }
  function inside(where, title) {
    const list = ST.at(S, where);
    if (!list.length) return false;
    common.pick(title, list, (c) => place(c, 'home', where === 'cage' ? lay.truck + 120 : undefined), () => ({ text: '', ok: true, label: 'Take out' }));
    return true;
  }

  RB.scenes.coop = {
    enter(args) {
      S = RB.game.S; rng = new Rng((S.seed ^ S.day * 977 ^ 0xc00b) >>> 0);
      pw = new RB.physics.World(); pw.box(-4000, 0, 4000, 600);
      birds = []; parts = []; acc = 0; selected = null; grab = null; cand = null; pan = null; t = 0; hit = 0;
      layout();
      pw.box(-4000, -3000, lay.left - 20, 0); pw.box(lay.right + 20, -3000, 4000, 0);
      bedBox = pw.box(lay.bedR - 80, BED_Y, lay.bedR, -16);
      cam = { x: (lay.truck + lay.box) / 2 };
      rebuild();
      RB.audio.setTune('farm');
      S.pos = null;
      if (args.intro) {
        ui.message('A coop of your own', 'Aunt Dalva left you her coop, two chickens, and a debt of $15,000 to Big Wattle.\n\nThe only trade that pays around here is the ring. Catch birds out on the map, breed the good ones, splice the strange ones at the lab, and fight your way from the Backyard Pit to the Grand Ring.\n\nNobody gets hurt for good. Mostly.', null, { ok: 'Let\'s go' });
      }
    },
    exit() { for (const e of birds.slice()) e.rag.remove(); birds = []; bedBox = null; },
    debug() { return { birds, lay, cam, zoom: zoom(), groundY: groundY(), trainPick, feederWindow }; },

    update(dt) {
      if (common.checkBroke(S, 'coop')) return;
      t += dt; hit = Math.max(0, hit - dt * 3);
      const v = ui.view, z = zoom();
      // pointers: grab a bird, or pan the yard
      for (const p of input.ptrs) {
        if (p.ui) continue;
        const w = toWorld(p.x, p.y);
        if (p.fresh) {
          cand = null; pan = null;
          let best = null, bd = 1e9;
          for (const e of birds) { const d = Math.hypot(e.rag.midX() - w.x, e.rag.midY() - w.y), r = e.P.TD * 0.8 + e.P.TL * 0.35 + 16 / z; if (d < r && d < bd) { bd = d; best = e; } }
          if (best) cand = { e: best, id: p.id }; else pan = { id: p.id, x0: cam.x, px: p.x };
        }
        if (cand && cand.id === p.id && !grab && p.moved > 10) {
          grab = { e: cand.e, id: p.id, vx: 0, vy: 0 };
          const rag = grab.e.rag; rag.knockdown(1e6); rag.C.im = 0; rag.eye = 'scared';
          if (!grab.e.c.person) RB.audio.voice(grab.e.P.voice, 'squawk');
        }
        if (grab && grab.id === p.id) {
          grab.tx = w.x; grab.ty = Math.min(w.y, -grab.e.P.TD * 0.5);
          if (p.x < 40) cam.x -= 300 * dt; else if (p.x > v.w - 40) cam.x += 300 * dt;
        } else if (pan && pan.id === p.id && p.moved > 6) cam.x = pan.x0 - (p.x - pan.px) / z;
      }
      for (const p of input.ups) {
        if (grab && grab.id === p.id) {
          const e = grab.e, rag = e.rag, x = rag.C.x;
          rag.C.im = 1 / rag.C.m; rag.C.vx = clamp(grab.vx, -900, 900); rag.C.vy = clamp(grab.vy, -900, 600);
          rag.stateT = 0; rag.downDur = 0.8; rag.eye = '';
          let to = null;
          if (x > bedL() - 14 && x < lay.truck + 66) to = 'cage';
          else if (Math.abs(x - lay.box) < 62) to = 'crate';
          else if (lay.dummy !== null && Math.abs(x - lay.dummy) < 50) { trainPick(e.c); }
          else lay.nests.forEach((nx, i) => { if (Math.abs(x - nx) < 72) to = 'nest' + i; });
          if (!to && inBed(e.c)) to = 'home';
          if (to && to !== e.c.at) {
            if (!place(e.c, to, x) && inBed(e.c)) { shiftRag(rag, clamp(x, bedL() + 10, lay.bedR - 10) - x); }
          }
          grab = null;
        }
      }
      if (input.key('ArrowLeft', 'KeyA')) cam.x -= 420 * dt;
      if (input.key('ArrowRight', 'KeyD')) cam.x += 420 * dt;
      const half = v.w / 2 / z;
      cam.x = lay.right - lay.left + 120 < half * 2 ? (lay.left + lay.right) / 2 : clamp(cam.x, lay.left - 60 + half, lay.right + 60 - half);

      // taps: a bird, an egg or a piece of furniture
      const tap = input.worldTap();
      if (tap) {
        const w = toWorld(tap.x, tap.y);
        let best = null, bd = 1e9;
        for (const e of birds) { const d = Math.hypot(e.rag.midX() - w.x, e.rag.midY() - w.y), r = e.P.TD * 0.8 + e.P.TL * 0.35 + 16 / z; if (d < r && d < bd) { bd = d; best = e; } }
        if (best) { if (selected) feedBird(best.c, best.rag.midX(), best.rag.midY() - best.P.TD); else { RB.audio.play('click'); common.card(best.c, actions); } }
        else if (w.x > bedL() - 10 && w.x < lay.truck + 70 && w.y > -110) truckWindow();
        else if (Math.abs(w.x - lay.feeder) < 55 && w.y > -60) { if (selected === 'grain' && ST.take(S, 'grain')) { S.feeder++; RB.audio.play('click'); } else feederWindow(); }
        else if (Math.abs(w.x - lay.box) < 60 && w.y > -90) { if (!inside('crate', 'Waiting for the BFC van')) ui.toast('The BFC pick-up box. Drop an unwanted bird in and the van takes it tonight.', pal.brick); }
        else if (lay.dummy !== null && Math.abs(w.x - lay.dummy) < 45 && w.y > -130) ui.toast('Drag a bird onto the dummy to train it.');
        else if (Math.abs(w.x - lay.house) < 100 && w.y > -200) ui.confirm('Sleep?', 'Sleeping ends the day. Everyone eats from the feeder, eggs are laid and hatch.', 'Sleep', doSleep, { fill: pal.plum });
        else lay.nests.forEach((nx, i) => {
          if (Math.abs(w.x - nx) > 72 || w.y < -160) return;
          const egg = S.eggs.find((e) => e.nest === i);
          if (egg && w.y > -75) eggWindow(egg);
          else if (!inside('nest' + i, 'Nest ' + (i + 1))) ui.toast('Drag a male and a female here, then sleep.');
        });
        const basket = S.eggs.filter((e) => e.nest < 0);
        if (!best && basket.length && Math.abs(w.x - (lay.house + 150)) < 40 && w.y > -50) eggWindow(basket[0]);
      }

      // creatures think and the yard steps
      for (const e of birds) {
        if (e.P !== ST.pheno(e.c)) { const x = e.rag.midX(); dropRag(e); mkRag(e.c, x); continue; }
        if (!grab || grab.e !== e) think(e, dt);
      }
      acc = Math.min(acc + dt, 0.1);
      while (acc >= DT) {
        if (grab) {
          const C = grab.e.rag.C, nx = lerp(C.x, grab.tx, 0.35), ny = lerp(C.y, grab.ty, 0.35);
          grab.vx = (nx - C.x) / DT; grab.vy = (ny - C.y) / DT; C.vx = grab.vx; C.vy = grab.vy; C.x = nx; C.y = ny;
        }
        for (const e of birds) e.rag.control(DT);
        pw.step(DT);
        for (const e of birds) e.rag.post();
        for (const e of birds) {
          if (!inBed(e.c) || (grab && grab.e === e)) continue;
          const m = Math.min(e.P.TL * 0.5 + 4, lay.bedLen / 2 - 1), x = e.rag.midX();
          if (x < bedL() + m) shiftRag(e.rag, bedL() + m - x); else if (x > lay.bedR - m) shiftRag(e.rag, lay.bedR - m - x);
        }
        acc -= DT;
      }
      for (const p of parts) { p.life -= dt * (p.kind === 'heart' ? 0.9 : 1.6); p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'heart' ? -20 : 120) * dt; }
      parts = parts.filter((p) => p.life > 0);
    },

    draw(ctx) {
      const v = ui.view, z = zoom(), gy = groundY(), sky = common.sky(S.time);
      const g = ctx.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, sky.top); g.addColorStop(1, sky.low);
      ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, gy);
      if (sky.night > 0.3) { ctx.fillStyle = 'rgba(255,255,255,' + (sky.night * 0.8) + ')'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 173.3) % v.w, (i * 71.7) % (gy * 0.7), 1.6, 1.6); }
      const sunA = (S.time - 6) / 13 * Math.PI;
      ctx.fillStyle = S.time >= 19 ? '#f3efe0' : '#fbe9a8'; ctx.beginPath(); ctx.arc(v.w * (0.12 + 0.76 * clamp((S.time - 6) / 13, 0, 1)), gy * 0.75 - Math.sin(clamp(sunA, 0, Math.PI)) * gy * 0.55, 24, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.75 - 0.5 * sky.night) + ')';
      for (let i = 0; i < 4; i++) { const cx = ((i * 310 + t * 6 - cam.x * 0.05) % (v.w + 240) + v.w + 240) % (v.w + 240) - 120, cy = 40 + i * 26; ctx.beginPath(); ctx.ellipse(cx, cy, 46, 12, 0, 0, TAU); ctx.ellipse(cx + 26, cy - 8, 28, 11, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = common.mix('#a9c877', '#3d5a56', sky.night * 0.7);
      ctx.beginPath(); ctx.moveTo(0, gy);
      for (let x = 0; x <= v.w + 20; x += 20) ctx.lineTo(x, gy - 50 - Math.sin((x + cam.x * 0.25) * 0.006) * 24 - Math.sin((x + cam.x * 0.25) * 0.017) * 9);
      ctx.lineTo(v.w, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = common.mix('#b9cf7a', '#3f5f55', sky.night * 0.7); ctx.fillRect(0, gy - 2, v.w, v.h - gy + 2);
      ctx.fillStyle = common.mix('#a6c067', '#38554d', sky.night * 0.7); ctx.fillRect(0, gy + 18, v.w, v.h - gy);

      ctx.save();
      ctx.translate(v.w / 2 - cam.x * z, gy); ctx.scale(z, z);
      props.fence(ctx, lay.left, lay.right, -6);
      props.house(ctx, lay.house, 0);
      // the truck and who is in it
      const caged = ST.at(S, 'cage');
      // the truck, with whoever rides in it standing between the cage and the front rail
      props.truckBack(ctx, lay.truck, 0, 1, { len: lay.bedLen });
      for (const e of birds.slice().sort((a, b) => b.P.S - a.P.S)) if (inBed(e.c) && (!grab || grab.e !== e)) RB.art.drawCreature(ctx, e.P, e.rag.getPose(), common.drawOpts(e.c));
      props.truckFront(ctx, lay.truck, 0, 1, { len: lay.bedLen });
      props.label(ctx, caged.length ? caged.length + ' in the truck' : 'Truck', lay.bedR - lay.bedLen / 2, -98, 12, pal.ink);
      props.feeder(ctx, lay.feeder, 0, S.feeder);
      if (S.feeder > 0) props.label(ctx, String(S.feeder), lay.feeder, -52, 12, pal.ink);
      lay.nests.forEach((nx, i) => {
        props.nest(ctx, nx, 0);
        const pair = ST.at(S, 'nest' + i);
        pair.forEach((c, k) => RB.art.drawFitted(ctx, ST.pheno(c), nx - 50 + k * 50, -110, 50, 60, Object.assign({ f: k ? -1 : 1 }, common.drawOpts(c))));
        props.nestFront(ctx, nx, 0);
        S.eggs.filter((e) => e.nest === i).forEach((e, k) => RB.art.drawEgg(ctx, nx - 14 + k * 28, -60, 10, e.col, e.spot, e.id));
        if (pair.length === 2) { ctx.fillStyle = pal.coral; const b = Math.sin(t * 3) * 3; ctx.save(); ctx.translate(nx, -150 + b); ctx.beginPath(); ctx.arc(-5, -3, 6, 0, TAU); ctx.arc(5, -3, 6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-10.5, 0); ctx.lineTo(10.5, 0); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill(); ctx.restore(); }
      });
      if (lay.dummy !== null) props.dummy(ctx, lay.dummy, 0, hit * Math.sin(t * 30));
      S.eggs.filter((e) => e.nest < 0).forEach((e, k) => RB.art.drawEgg(ctx, lay.house + 140 + k * 22, -11, 10, e.col, e.spot, e.id));
      const crate = ST.at(S, 'crate');
      crate.forEach((c, i) => RB.art.drawFitted(ctx, ST.pheno(c), lay.box - 40 + i * 26, -112, 54, 56, Object.assign({ f: 1, eye: 'scared' }, common.drawOpts(c))));
      props.bfcBox(ctx, lay.box, 0);
      // the flock
      const order = birds.slice().sort((a, b) => b.P.S - a.P.S);
      for (const e of order) if ((!grab || grab.e !== e) && !inBed(e.c)) { RB.art.drawShadow(ctx, e.rag.midX(), 1, e.P.TL * 0.55); RB.art.drawCreature(ctx, e.P, e.rag.getPose(), common.drawOpts(e.c)); }
      if (grab) { RB.art.drawShadow(ctx, grab.e.rag.midX(), 1, grab.e.P.TL * 0.4); RB.art.drawCreature(ctx, grab.e.P, grab.e.rag.getPose(), common.drawOpts(grab.e.c)); }
      for (const e of birds) if (e.c.person && e.rag.state === 'stand' && Math.sin(t * 0.7 + e.c.id) > 0.92) props.label(ctx, '...', e.rag.head.x, e.rag.head.y - e.P.HR * 2.2, 16, pal.ink);
      for (const p of parts) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        if (p.kind === 'heart') { ctx.fillStyle = pal.coral; ctx.beginPath(); ctx.arc(p.x - 3, p.y, 4, 0, TAU); ctx.arc(p.x + 3, p.y, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 2); ctx.lineTo(p.x + 7, p.y + 2); ctx.lineTo(p.x, p.y + 10); ctx.closePath(); ctx.fill(); }
        else { ctx.fillStyle = pal.paper; ctx.beginPath(); ctx.arc(p.x, p.y, 9 * p.life + 3, 0, TAU); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      if (sky.night > 0) { ctx.fillStyle = 'rgba(25,32,70,' + sky.night * 0.34 + ')'; ctx.fillRect(0, 0, v.w, v.h); }

      // ---- interface
      common.hud(S);
      common.drawGoal(S, 44);
      const wide = v.w > 640, bw = wide ? 92 : 42;
      const btns = [['Map', 'truck', pal.teal, () => RB.game.go('map')], ['Sleep', 'moon', pal.plum, () => ui.confirm('Sleep?', 'Sleeping ends the day. Everyone eats from the feeder, eggs are laid and hatch.', 'Sleep', doSleep, { fill: pal.plum })],
        ['Codex', 'book', pal.ink, () => RB.game.go('codex', { back: 'coop' })], ['', 'gear', pal.grey, () => common.settings(true)]];
      let bx = v.w - 8;
      for (let i = btns.length - 1; i >= 0; i--) {
        const b = btns[i], w = b[0] && wide ? bw : 42;
        bx -= w;
        if (ui.btn(bx, 6, w, 34, wide ? b[0] : '', { icon: b[1], fill: b[2], size: 13 })) { RB.audio.play('click'); b[3](); }
        bx -= 6;
      }
      // feed bar
      const feeds = ST.owned(S).filter((id) => RB.items.ITEMS[id].kind === 'feed');
      const barY = v.h - 56, n = feeds.length, step = Math.min(52, (v.w - 96) / Math.max(1, n));
      ui.rect(0, v.h - 64, v.w, 64, 'rgba(35,49,74,0.82)'); ui.zone(0, v.h - 64, v.w, 64);
      ui.text('Coop ' + ST.atHome(S).length + '/' + ST.coopCap(S), v.w - 10, v.h - 28, { size: 12, align: 'right', color: pal.white });
      if (!n) ui.text('No feed left. Feed & Seed sells grain.', 12, v.h - 28, { size: 12, color: pal.white, bold: false, maxW: v.w - 100 });
      feeds.forEach((id, i) => {
        const x = 8 + i * step, on = selected === id;
        if (ui.btn(x, barY, step - 6, 46, '', { fill: on ? pal.mustard : pal.paper, flat: true })) { selected = on ? null : id; RB.audio.play('click'); }
        ui.itemIcon(id, x + (step - 6) / 2, barY + 20, 24);
        ui.text(ST.fmtCount(ST.count(S, id)), x + step - 10, barY + 42, { size: 11, align: 'right' });
      });
      if (selected) ui.text(RB.items.ITEMS[selected].name + ': tap a creature to feed it' + (selected === 'grain' ? ', or the feeder' : ''), v.w / 2, v.h - 72, { size: 12, align: 'center', color: sky.night > 0.5 ? pal.white : pal.ink, maxW: v.w - 16 });
    },
  };
})();
