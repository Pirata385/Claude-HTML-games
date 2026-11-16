// scenes/map.js — the overworld. Drive the truck (WASD/arrows or the touch stick), throw nets at
// wild creatures (click, or drag from the net button), dig with the shovel, scatter seed, and
// roll up to a door to go in. Animals graze, bolt, fly off or charge depending on their genes.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, lerp, TAU, hash2 } = RB.core;
  const ui = RB.ui, pal = RB.pal, input = RB.input, ST = RB.state, common = RB.common, props = RB.props, WD = RB.world;

  let S, world, car, cam, wild, folk, sheriff, nets, flying, seeds, parts, t, rng, tool, aim, stick, digT, near, paths, decorCache, det, stun, warned, sirenT, pen;

  const zoom = () => clamp(Math.max(ui.view.w, ui.view.h) / 1500, 0.45, 0.8);
  const toWorld = (px, py) => ({ x: cam.x + (px - ui.view.w / 2) / zoom(), y: cam.y + (py - ui.view.h / 2) / zoom() });
  const isNight = () => S.time >= 19;
  const mapSpeed = (P) => clamp(P.speedMax * 1.45, 90, 560);
  const range = () => (S.equip.launcher ? 900 : 520);
  const cageRoom = () => ST.cageCap(S) - ST.at(S, 'cage').length;
  function puff(x, y, n, col, text) { for (let i = 0; i < n; i++) parts.push({ x: x + rng.range(-14, 14), y: y + rng.range(-10, 10), vx: rng.range(-60, 60), vy: rng.range(-110, -30), life: rng.range(0.5, 1), col, text: i === 0 ? text : null }); }

  function buildPaths() {
    paths = { blobs: [], ponds: [] };
    const mk = (b) => { const p = new Path2D(); for (let i = 0; i <= 56; i++) { const th = i / 56 * TAU, r = WD.blobR(b, th); const x = b.x + Math.cos(th) * r, y = b.y + Math.sin(th) * r; if (i) p.lineTo(x, y); else p.moveTo(x, y); } p.closePath(); return p; };
    for (const b of world.blobs) paths.blobs.push([b[0], mk(b[1])]);
    for (const b of world.ponds) paths.ponds.push(mk(b));
  }

  // The wild animals: the day's population (see world.population), kept for the whole day so they
  // stay where they were while you go in and out of places. Animals caught today are remembered in
  // the save; everything is renewed the next morning. Night groups only come out after dark.
  function loadWild() {
    const key = S.seed + ':' + S.day, cache = RB.game.wild;
    if (cache && cache.key === key) return cache.list;
    if (!S.wildGone || S.wildGone.day !== S.day) S.wildGone = { day: S.day, ids: [] };
    const gone = new Set(S.wildGone.ids), list = [];
    for (const e of WD.population(world, S.day)) if (!gone.has(e.id)) list.push(makeWild(e.g, e.x, e.y, 'graze', e));
    RB.game.wild = { key, list };
    return list;
  }
  function makeWild(g, x, y, state, e) {
    const P = RB.pheno.express(g);
    return { id: e ? e.id : null, night: !!(e && e.night), cross: e ? e.cross : null, g, P, x, y, f: rng.chance(0.5) ? 1 : -1, state: state || 'graze', t: rng.range(0.5, 4), ph: rng.next(), sp: 0, stam: 100, alt: 0, tx: x, ty: y, mean: P.aggression > 0.8 && P.courage > 0.7 && P.S > 0.8 };
  }
  function addWild(g, x, y, state) { const w = makeWild(g, x, y, state); wild.push(w); return w; }
  const awake = (w) => !w.night || isNight();
  function removeWild(w) {
    const i = wild.indexOf(w);
    if (i >= 0) wild.splice(i, 1);
    if (w.id !== null && S.wildGone) S.wildGone.ids.push(w.id);
  }
  // A hole: an ordinary one dug today (they fill back in overnight), or a treasure mark dug up.
  const holeAt = (cx, cy) => { const k = cx + ',' + cy; return S.dug[k] === S.day || !!S.marksDug[k]; };

  function catchWild(w, big) {
    const strength = Math.sqrt(w.P.massRel) * w.P.muscle;
    const hold = clamp((big ? 1.7 : 1.25) - 0.26 * strength + (w.stam < 20 ? 0.3 : 0) + (w.state === 'trapped' ? 0.5 : 0), 0.08, 1);
    if (!rng.chance(hold)) { ui.toast('It tore right through the net!', pal.coral); RB.audio.play('bad'); w.state = 'flee'; w.t = 3; puff(w.x, w.y - 30, 6, pal.paper); return 'torn'; }
    removeWild(w);
    const x = w.cross || {};
    const c = ST.addBird(S, w.g, { at: 'cage', bond: 0.1, origin: 'wild', mom: x.mom, dad: x.dad, momKey: x.momKey, dadKey: x.dadKey });
    if (w.cross) ui.toast('A natural cross! Very rare in the wild.', pal.plum);
    S.stats.caught++;
    common.discover(S, c);
    ui.toast('Caught ' + c.name + ', a ' + ST.kind(c).toLowerCase() + '.', pal.teal);
    RB.audio.play('catch'); RB.audio.voice(w.P.voice, 'squawk'); puff(w.x, w.y - 30, 8, w.P.css.body);
    common.checkAch(S);
    return 'caught';
  }
  function catchPerson(f) {
    f.gone = true;
    RB.npc.info(S, f.npc.id).gone = true;
    ST.addBird(S, RB.genome.clone(f.npc.g), { at: 'cage', name: f.npc.name, person: f.npc.id, clothes: f.npc.clothes, bond: 0, origin: 'wild' });
    S.stats.kidnapped++;
    let seenBy = 0;
    for (const o of folk) if (o !== f && !o.gone && Math.hypot(o.x - f.x, o.y - f.y) < 750) { seenBy++; o.scared = 6; }
    S.heat = clamp(S.heat + (f.npc.role === 'sheriff' ? 70 : 35) + seenBy * 15, 0, 100);
    ui.toast('You netted ' + f.npc.name + '!' + (seenBy ? ' Somebody saw that.' : ''), pal.plum);
    RB.audio.play('catch'); puff(f.x, f.y - 60, 8, pal.paper, rng.pick(RB.npc.SCREAMS));
    common.checkAch(S);
    return 'caught';
  }
  function throwNet(tx, ty) {
    const id = tool === 'bignet' && ST.count(S, 'bignet') ? 'bignet' : 'net';
    if (!ST.take(S, id)) { ui.toast('No nets left. Net & Spade sells them.', pal.coral); RB.audio.play('error'); return; }
    let dx = tx - car.x, dy = ty - car.y; const d = Math.hypot(dx, dy) || 1, max = range();
    if (d > max) { dx *= max / d; dy *= max / d; }
    const dist = Math.min(d, max);
    flying.push({ x0: car.x, y0: car.y - 40, x1: car.x + dx, y1: car.y + dy, t: 0, dur: 0.3 + dist / 1500, id });
    car.f = dx >= 0 ? 1 : -1;
    RB.audio.play('net');
  }
  function landNet(n) {
    const R = n.id === 'bignet' ? 100 : 78;
    let best = null, bd = R;
    for (const w of wild) { if (w.alt > 40 || !awake(w)) continue; const d = Math.hypot(w.x - n.x1, w.y - n.y1); if (d < bd) { bd = d; best = w; } }
    let who = null;
    for (const f of folk) { if (f.gone) continue; const d = Math.hypot(f.x - n.x1, f.y - n.y1); if (d < bd) { bd = d; who = f; best = null; } }
    let res = 'miss';
    if (who) res = catchPerson(who); else if (best) res = catchWild(best, n.id === 'bignet');
    if (res === 'miss' || res === 'full') nets.push({ x: n.x1, y: n.y1, id: n.id });
    if (res === 'miss') puff(n.x1, n.y1, 3, '#d9c7a0');
  }
  function dig() {
    if (digT > 0) return;
    if (!ST.count(S, 'shovel')) { ui.toast('The shovel is worn out. Net & Spade sells them.', pal.coral); RB.audio.play('error'); return; }
    const c = WD.cellOf(car.x, car.y), key = c.cx + ',' + c.cy;
    if (WD.markAt(world, c.cx, c.cy) ? S.marksDug[key] : S.dug[key] === S.day) { ui.toast('Already dug here today. Holes fill back in overnight.'); return; }
    if (WD.biomeAt(world, car.x, car.y) === 'water') { ui.toast('Too wet to dig.'); return; }
    digT = 0.8; car.vx = 0; car.vy = 0;
    RB.audio.play('dig');
  }
  function finishDig() {
    const c = WD.cellOf(car.x, car.y), key = c.cx + ',' + c.cy, loot = WD.lootAt(world, c.cx, c.cy, S.day);
    ST.take(S, 'shovel'); S.stats.dug++;
    if (WD.markAt(world, c.cx, c.cy)) S.marksDug[key] = true; else S.dug[key] = S.day;
    const hx = (c.cx + 0.5) * WD.CELL, hy = (c.cy + 0.5) * WD.CELL;
    puff(hx, hy, 8, '#8a6a44');
    if (!loot) { ui.toast('Nothing but dirt.'); }
    else {
      RB.audio.play('found');
      if (loot.type === 'money' || loot.type === 'chest') { S.money += loot.money; S.stats.earned += loot.money; ui.toast((loot.type === 'chest' ? 'A buried chest! $' : 'Buried coins: $') + loot.money, pal.mustard); }
      else if (loot.type === 'item') { ST.give(S, loot.id, loot.n || 1); ui.toast('Dug up: ' + RB.items.ITEMS[loot.id].name + (loot.n > 1 ? ' x' + loot.n : ''), pal.teal); }
      else if (loot.type === 'fossil') { RB.lab.addFragment(S, loot.set); ui.toast('A fossil fragment: ' + RB.items.FOSSILS[loot.set] + ' (' + RB.lab.fragments(S, loot.set) + '/' + RB.lab.FRAGMENTS + ')', pal.plum); }
      else if (loot.type === 'creature') { const id = rng.pick(['kiwi', 'quail', 'bantam', 'owl']); addWild(RB.species.make(id, rng, { sport: 1 }), hx, hy, 'trapped').t = 9; ui.toast('Something was asleep down there!', pal.plum); }
    }
    common.checkAch(S);
  }
  function enter(site) {
    const st = site.kind;
    RB.audio.play('click');
    if (st === 'home') {
      RB.game.save(); RB.game.go('coop'); return; // riders stay in the truck: drag them out in the yard
    }
    const night = site.id === 'cellar' || site.id === 'market';
    if (night && !isNight()) { ui.toast(site.name + ' opens after dark (19:00). Speed time up, or tap the clock to wait.'); return; }
    let keeper = world.npcs.find((n) => n.site === site.id);
    if (keeper) keeper = RB.npc.current(S, keeper);
    const empty = RB.npc.vacancy(S, keeper);
    if (empty === 'sold') { ui.toast('The house stands empty. Someone new will move in soon.', pal.plum); return; }
    if (empty === 'away') { ui.toast('Nobody is minding the place. ' + keeper.name + ' is... away.', pal.plum); return; }
    if (st === 'arena' && !RB.economy.arenaOpen(S, RB.economy.ARENA[site.id])) { ui.toast('Win the boss bout at the arena before this one first.', pal.coral); return; }
    S.pos = { x: car.x, y: car.y };
    RB.game.save();
    RB.game.go(st === 'lab' ? 'lab' : 'site', { site: site.id });
  }
  function fined() {
    const fine = Math.min(S.money, 50 + Math.round(S.heat * 8));
    S.money -= fine;
    const held = ST.at(S, 'cage').filter((c) => c.person);
    for (const c of held) { const st = RB.npc.info(S, c.person); st.gone = false; st.rel = Math.max(-100, st.rel - 20); ST.removeBird(S, c); const f = folk.find((o) => o.npc.id === c.person); if (f) f.gone = false; }
    S.heat = Math.max(0, S.heat - 45);
    stun = 1.2; car.vx = 0; car.vy = 0;
    RB.audio.play('error');
    ui.message('Pulled over', (sheriff ? sheriff.npc.name : 'The sheriff') + ' writes you a ticket for $' + fine + '.' + (held.length ? ' He also lets ' + held.map((c) => c.name).join(' and ') + ' out of your cage, with apologies on your behalf.' : ''), null, { head: pal.brick });
  }

  RB.scenes.map = {
    enter() {
      S = RB.game.S; world = RB.game.world;
      rng = new Rng((S.seed ^ Math.imul(S.day, 7717) ^ Math.floor(S.time * 10)) >>> 0);
      const home = world.site.home, p = S.pos || { x: home.x, y: home.y + 150 };
      car = { x: p.x, y: p.y, vx: 0, vy: 0, f: 1, bob: 0 };
      cam = { x: car.x, y: car.y };
      nets = []; flying = []; seeds = []; parts = []; t = 0; tool = 'net'; aim = null; stick = null; digT = 0; near = null; det = null; stun = 0; warned = false; sirenT = 0;
      // treasure marks dug in older saves were kept in S.dug
      if (!S.marksDug) { S.marksDug = {}; for (const m of world.marks) { const k = m.cx + ',' + m.cy; if (S.dug[k]) S.marksDug[k] = true; } }
      wild = loadWild();
      decorCache = new Map();
      if (!paths || paths.seed !== world.seed) { buildPaths(); paths.seed = world.seed; }
      folk = world.npcs.filter((n) => n.site.startsWith('house') || n.role === 'sheriff').map((n0) => {
        const n = RB.npc.current(S, n0), s = world.site[n.site], P = RB.pheno.express(n.g);
        return { npc: n, P, x: s.x + (n.role === 'sheriff' ? 160 : 70), y: s.y + 120, hx: s.x + 70, hy: s.y + 120, f: 1, ph: 0, sp: 0, t: rng.range(0, 3), gone: RB.npc.info(S, n.id).gone, scared: 0 };
      });
      sheriff = folk.find((f) => f.npc.role === 'sheriff');
      RB.audio.setTune('map');
      // the truck's cage, live: grab the riders, tap one for its card, drag one out to let it go
      pen = new RB.Pen({ drawOpts: common.drawOpts, onTap: (c) => common.card(c, riderActions), onDropOut: (c, sx, sy) => { const w = toWorld(sx, sy); releaseAt(c, w.x, w.y); } });
    },
    exit() { if (car) S.pos = { x: car.x, y: car.y }; if (pen) { pen.dispose(); pen = null; } },

    update(dt) {
      const v = ui.view, z = zoom();
      if (common.checkBroke(S, 'map')) return;
      t += dt; stun = Math.max(0, stun - dt);
      // world time: an hour every 30 s, or faster with the speed button; it drops back to normal at nightfall
      const before = S.time, g = RB.game;
      S.time += dt / 30 * (g.timeSpeed || 1);
      if (before < 19 && S.time >= 19) { if (g.timeSpeed > 1) g.timeSpeed = 1; ui.toast('Night falls. The Cellar and the Night Market are open.', pal.plum); }
      if (S.time > 23.5 && g.timeSpeed > 1) g.timeSpeed = 1;
      if (S.time >= 26) { S.pos = null; RB.game.go('coop', { passOut: true }); return; }
      // ---- driving
      let ix = (input.key('KeyD', 'ArrowRight') ? 1 : 0) - (input.key('KeyA', 'ArrowLeft') ? 1 : 0), iy = (input.key('KeyS', 'ArrowDown') ? 1 : 0) - (input.key('KeyW', 'ArrowUp') ? 1 : 0);
      stick = null;
      for (const p of input.ptrs) {
        if (p.ui || p.mouse) continue;
        if (p.sx < v.w * 0.5 && !p.owner) p.owner = 'stick';
        if (p.owner === 'stick') { const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy); stick = { sx: p.sx, sy: p.sy, x: p.x, y: p.y }; if (d > 8) { const k = Math.min(1, d / 46) / d; ix = dx * k; iy = dy * k; } }
      }
      const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
      const biome = WD.biomeAt(world, car.x, car.y), road = WD.onRoad(world, car.x, car.y);
      let slow = road ? 1.2 : WD.BIOMES[biome].slow;
      if (S.up.tires && biome !== 'water' && !road) slow = Math.max(slow, 1);
      const vmax = (330 + 75 * S.up.engine) * slow * (stun > 0 || digT > 0 ? 0 : 1);
      car.vx += (ix * vmax - car.vx) * Math.min(1, dt * 5); car.vy += (iy * vmax - car.vy) * Math.min(1, dt * 5);
      const nx = clamp(car.x + car.vx * dt, 80, WD.W - 80), ny = clamp(car.y + car.vy * dt, 80, Math.min(WD.H - 80, WD.seaY(world, car.x) + 240));
      car.x = nx; car.y = ny;
      if (Math.abs(car.vx) > 20) car.f = car.vx > 0 ? 1 : -1;
      const sp = Math.hypot(car.vx, car.vy);
      car.bob = sp > 30 ? Math.abs(Math.sin(t * 22)) * 2.5 : 0;
      cam.x += (car.x - cam.x) * Math.min(1, dt * 6); cam.y += (car.y - 30 - cam.y) * Math.min(1, dt * 6);
      // ---- tools
      if (input.hit('Digit1')) tool = 'net'; if (input.hit('Digit2') && ST.count(S, 'bignet')) tool = 'bignet'; if (input.hit('Digit3')) tool = 'seed';
      if (input.hit('KeyQ')) dig();
      if (input.hit('KeyH')) honk();
      if (digT > 0) { digT -= dt; if (digT <= 0) finishDig(); }
      aim = null;
      for (const p of input.ptrs) { // dragging from the net button aims a throw
        if (p.owner !== 'aim') continue;
        const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy);
        if (d > 10) { const k = Math.min(1, d / 70); aim = { x: car.x + dx / d * range() * k, y: car.y + dy / d * range() * k }; }
      }
      for (const p of input.ups) {
        if (p.owner !== 'aim') continue;
        const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy);
        if (d > 10) { const k = Math.min(1, d / 70); throwNet(car.x + dx / d * range() * k, car.y + dy / d * range() * k); }
      }
      const tap = input.worldTap();
      if (tap && (!input.touch || tap.sx > v.w * 0.5)) {
        const w = toWorld(tap.x, tap.y);
        if (tool === 'seed') dropSeed(); else if (!input.touch) throwNet(w.x, w.y);
      }
      // ---- nets
      for (const n of flying) { n.t += dt / n.dur; if (n.t >= 1) landNet(n); }
      flying = flying.filter((n) => n.t < 1);
      for (const n of nets.slice()) if (Math.hypot(n.x - car.x, n.y - car.y) < 70) { nets.splice(nets.indexOf(n), 1); ST.give(S, n.id); RB.audio.play('click'); }
      for (const s of seeds) s.t -= dt;
      seeds = seeds.filter((s) => s.t > 0);
      // ---- wildlife
      const R = Math.hypot(v.w, v.h) / 2 / z;
      const far = R + 450; // animals beyond this wait where they are
      for (const w of wild) {
        const dx = w.x - car.x, dy = w.y - car.y;
        if (dx > far || dx < -far || dy > far || dy < -far || !awake(w)) continue; // far away: it waits where it is
        const d = Math.hypot(dx, dy) || 1, P = w.P;
        const ms = mapSpeed(P);
        let vx = 0, vy = 0;
        w.t -= dt;
        if (w.state === 'graze' || w.state === 'walk' || w.state === 'eat') {
          const alertR = (250 + 240 * P.focus) * (sp < 90 ? 0.55 : 1) * (w.state === 'eat' ? 0.45 : 1);
          if (d < alertR) {
            if (w.mean && rng.chance(0.6)) { w.state = 'charge'; w.t = 4; }
            else if (P.canFly && rng.chance(0.75)) { w.state = 'fly'; w.t = rng.range(2.4, 4); w.dir = Math.atan2(dy, dx) + rng.range(-0.7, 0.7); RB.audio.voice(P.voice, 'squawk'); }
            else { w.state = 'flee'; w.t = 1; if (rng.chance(0.4)) RB.audio.voice(P.voice, 'cluck'); }
          } else if (w.state === 'graze') {
            const seed = seeds.find((s) => Math.hypot(s.x - w.x, s.y - w.y) < 520);
            if (seed && P.hook < 0.7) { w.state = 'walk'; w.tx = seed.x + rng.range(-30, 30); w.ty = seed.y + rng.range(-20, 20); w.lured = true; w.t = 9; }
            else if (w.t <= 0) { w.state = 'walk'; w.tx = w.x + rng.range(-260, 260); w.ty = w.y + rng.range(-200, 200); w.t = 6; w.lured = false; }
          } else if (w.state === 'walk') {
            const ex = w.tx - w.x, ey = w.ty - w.y, ed = Math.hypot(ex, ey);
            if (ed < 16 || w.t <= 0) { w.state = w.lured ? 'eat' : 'graze'; w.t = w.lured ? 9 : rng.range(1.5, 5); }
            else { const s = ms * (w.lured ? 0.5 : 0.28); vx = ex / ed * s; vy = ey / ed * s; }
          } else if (w.t <= 0) { w.state = 'graze'; w.t = rng.range(1, 3); w.lured = false; }
        } else if (w.state === 'flee') {
          const s = ms * (w.stam > 0 ? 1 : 0.42), wob = Math.sin(t * 3 + w.ph * 9) * 0.5, a = Math.atan2(dy, dx) + wob;
          vx = Math.cos(a) * s; vy = Math.sin(a) * s;
          w.stam = Math.max(0, w.stam - dt * 17 / P.lungs);
          if (d > 900 && w.t <= 0) { w.state = 'graze'; w.t = rng.range(2, 5); }
        } else if (w.state === 'fly') {
          w.alt = Math.min(110, w.alt + 240 * dt); vx = Math.cos(w.dir) * 520; vy = Math.sin(w.dir) * 520;
          if (w.t <= 0) { w.state = 'land'; }
        } else if (w.state === 'land') {
          w.alt -= 200 * dt; vx = Math.cos(w.dir) * 200; vy = Math.sin(w.dir) * 200;
          if (w.alt <= 0) { w.alt = 0; w.state = 'graze'; w.t = rng.range(1, 3); w.stam = Math.max(0, w.stam - 25); }
        } else if (w.state === 'charge') {
          const s = ms * 1.1; vx = -dx / d * s; vy = -dy / d * s;
          if (d < 62) { stun = 0.8; car.vx = -dx / d * -260; car.vy = -dy / d * -260; RB.audio.play('thud'); RB.audio.voice(P.voice, 'squawk'); puff(car.x, car.y - 40, 6, pal.paper, 'HONK!'); w.state = 'flee'; w.t = 2.5; if (!warned) { warned = true; ui.toast('That one fights back. Imagine it in the ring.', pal.coral); } }
          else if (w.t <= 0 || d > 800) { w.state = 'graze'; w.t = 2; }
        } else if (w.state === 'trapped') { if (w.t <= 0) { w.state = 'flee'; w.t = 2; } }
        if (biomeBlocked(w.x + vx * dt, w.y + vy * dt, P)) { vx = -vx * 0.5; vy = -vy * 0.5; if (w.state === 'walk') w.state = 'graze'; }
        w.x = clamp(w.x + vx * dt, 60, WD.W - 60); w.y = clamp(w.y + vy * dt, 60, WD.H - 60);
        const s = Math.hypot(vx, vy);
        if (Math.abs(vx) > 5) w.f = vx > 0 ? 1 : -1;
        w.sp = clamp(s / ms, 0, 1); w.ph = (w.ph + dt * (0.6 + w.sp * 2.4)) % 1;
        // a hole is a trap for anything small enough
        if (w.alt <= 0 && w.state !== 'trapped' && P.S < 1.7 && s > 10) { const c = WD.cellOf(w.x, w.y); if (holeAt(c.cx, c.cy) && Math.hypot((c.cx + 0.5) * WD.CELL - w.x, (c.cy + 0.5) * WD.CELL - w.y) < 34) { w.state = 'trapped'; w.t = 7; w.x = (c.cx + 0.5) * WD.CELL; w.y = (c.cy + 0.5) * WD.CELL; puff(w.x, w.y, 5, '#8a6a44', 'stuck!'); } }
      }
      // ---- people and the law
      for (const f of folk) {
        if (f.gone) continue;
        f.scared = Math.max(0, f.scared - dt);
        let vx = 0, vy = 0;
        if (f === sheriff) {
          const dx = car.x - f.x, dy = car.y - f.y, d = Math.hypot(dx, dy) || 1, hot = S.heat >= 50 || (S.heat >= 30 && ST.at(S, 'cage').some((c) => c.person));
          if (hot && d < 1500) {
            const s = 345; vx = dx / d * s; vy = dy / d * s;
            sirenT -= dt; if (sirenT <= 0) { sirenT = 0.55; RB.audio.play('siren'); }
            if (d < 70 && stun <= 0) { fined(); f.x = f.hx + 90; f.y = f.hy; }
          } else { const ex = f.hx + 90 - f.x, ey = f.hy - f.y, ed = Math.hypot(ex, ey); if (ed > 20) { vx = ex / ed * 120; vy = ey / ed * 120; } }
        } else {
          const dx = f.x - car.x, dy = f.y - car.y, d = Math.hypot(dx, dy) || 1;
          if (f.scared > 0 && d < 500) { vx = dx / d * 150; vy = dy / d * 150; }
          else { f.t -= dt; if (f.t <= 0) { f.t = rng.range(2, 6); f.tx = f.hx + rng.range(-90, 90); f.ty = f.hy + rng.range(-20, 50); } const ex = (f.tx || f.hx) - f.x, ey = (f.ty || f.hy) - f.y, ed = Math.hypot(ex, ey); if (ed > 8) { vx = ex / ed * 50; vy = ey / ed * 50; } }
        }
        f.x += vx * dt; f.y += vy * dt;
        const s = Math.hypot(vx, vy);
        if (Math.abs(vx) > 4) f.f = vx > 0 ? 1 : -1;
        f.sp = clamp(s / 220, 0, 1); f.ph = (f.ph + dt * (0.5 + f.sp * 3)) % 1;
      }
      // ---- the truck's cage panel
      if (RB.game.penOpen && pen) { const list = ST.at(S, 'cage'), b = penBox(); pen.layout(b, list); pen.sync(list); pen.update(dt, b); }
      // ---- doors
      near = WD.nearestSite(world, car.x, car.y, 135);
      if (near && (input.hit('KeyE') || input.hit('Enter') || input.hit('Space'))) enter(near);
      // ---- metal detector
      det = null;
      if (S.equip.detector) {
        const c = WD.cellOf(car.x, car.y); let bd = 1e9;
        for (let cx = c.cx - 5; cx <= c.cx + 5; cx++) for (let cy = c.cy - 5; cy <= c.cy + 5; cy++) { if (holeAt(cx, cy)) continue; const l = WD.lootAt(world, cx, cy, S.day); if (l && l.metal) { const d = Math.hypot((cx + 0.5) * WD.CELL - car.x, (cy + 0.5) * WD.CELL - car.y); if (d < bd) bd = d; } }
        if (bd < 520) { det = 1 - bd / 520; if (Math.floor(t * (1 + det * 9)) !== Math.floor((t - dt) * (1 + det * 9))) RB.audio.play('tick'); }
      }
      for (const p of parts) { p.life -= dt * 1.4; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; }
      parts = parts.filter((p) => p.life > 0);
    },

    draw(ctx) {
      const v = ui.view, z = zoom(), n = common.night(S.time);
      const x0 = cam.x - v.w / 2 / z, y0 = cam.y - v.h / 2 / z, x1 = cam.x + v.w / 2 / z, y1 = cam.y + v.h / 2 / z;
      ctx.fillStyle = WD.BIOMES.farm.ground; ctx.fillRect(0, 0, v.w, v.h);
      ctx.save();
      ctx.translate(v.w / 2 - cam.x * z, v.h / 2 - cam.y * z); ctx.scale(z, z);
      for (let i = paths.blobs.length - 1; i >= 0; i--) { ctx.fillStyle = WD.BIOMES[paths.blobs[i][0]].ground; ctx.fill(paths.blobs[i][1]); }
      // the coast and the sea follow the same wavy line
      const strip = (off, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 - 50, y1 + 400); for (let x = x0 - 50; x <= x1 + 60; x += 50) ctx.lineTo(x, WD.seaY(world, x) + off); ctx.lineTo(x1 + 60, y1 + 400); ctx.closePath(); ctx.fill(); };
      if (y1 > world.sea.y - 800) { strip(-620, WD.BIOMES.coast.ground); strip(0, WD.BIOMES.water.ground); strip(90 + Math.sin(t) * 10, WD.BIOMES.water.dark); }
      ctx.fillStyle = WD.BIOMES.water.ground; for (const p of paths.ponds) ctx.fill(p);
      // ground texture: one small tuft per cell, darker than its biome
      const gs = 150;
      for (let gx = Math.floor(x0 / gs); gx <= Math.floor(x1 / gs); gx++) for (let gy = Math.floor(y0 / gs); gy <= Math.floor(y1 / gs); gy++) {
        const hx = (gx + hash2(gx, gy, 3)) * gs, hy = (gy + hash2(gx, gy, 4)) * gs;
        ctx.fillStyle = WD.BIOMES[WD.biomeAt(world, hx, hy)].dark; ctx.beginPath(); ctx.ellipse(hx, hy, 16, 5, 0, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#dcccaa'; ctx.lineWidth = 78; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const road of world.roads) { ctx.beginPath(); ctx.moveTo(road[0].x, road[0].y); for (let i = 1; i < road.length; i++) ctx.lineTo(road[i].x, road[i].y); ctx.stroke(); }
      // holes, treasure marks, nets and seed on the ground
      const c0 = WD.cellOf(x0, y0), c1 = WD.cellOf(x1, y1);
      for (let cx = c0.cx; cx <= c1.cx; cx++) for (let cy = c0.cy; cy <= c1.cy; cy++) if (holeAt(cx, cy)) { const hx = (cx + 0.5) * WD.CELL, hy = (cy + 0.5) * WD.CELL; ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(hx, hy, 36, 20, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4e3a26'; ctx.beginPath(); ctx.ellipse(hx, hy + 3, 26, 13, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = pal.coral; ctx.lineWidth = 9;
      for (const m of world.marks) if (!S.marksDug[m.cx + ',' + m.cy]) { const mx = (m.cx + 0.5) * WD.CELL, my = (m.cy + 0.5) * WD.CELL; ctx.beginPath(); ctx.moveTo(mx - 20, my - 14); ctx.lineTo(mx + 20, my + 14); ctx.moveTo(mx + 20, my - 14); ctx.lineTo(mx - 20, my + 14); ctx.stroke(); }
      for (const s of seeds) { ctx.fillStyle = pal.mustard; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(s.x + Math.cos(i * 2.4) * (8 + i * 2.6), s.y + Math.sin(i * 2.4) * (5 + i * 1.6), 3, 0, TAU); ctx.fill(); } }
      for (const nt of nets) drawNet(ctx, nt.x, nt.y, 34, nt.id);
      // everything standing up, sorted by depth
      const list = [];
      const ds = 260;
      for (let gx = Math.floor((x0 - 120) / ds); gx <= Math.floor((x1 + 120) / ds); gx++) for (let gy = Math.floor(y0 / ds); gy <= Math.floor((y1 + 140) / ds); gy++) {
        const k = gx + ',' + gy; let d = decorCache.get(k);
        if (!d) { d = WD.decorAt(world, gx, gy, ds); decorCache.set(k, d); }
        for (const it of d) list.push({ y: it.y, kind: 0, it });
      }
      if (decorCache.size > 900) decorCache.clear();
      for (const s of world.sites) if (s.x > x0 - 320 && s.x < x1 + 320 && s.y > y0 - 120 && s.y < y1 + 260) list.push({ y: s.y + 60, kind: 1, it: s });
      for (const w of wild) if (awake(w) && w.x > x0 - 200 && w.x < x1 + 200 && w.y > y0 - 100 && w.y < y1 + 300) list.push({ y: w.y, kind: 2, it: w });
      for (const f of folk) if (!f.gone && f.x > x0 - 200 && f.x < x1 + 200 && f.y > y0 - 100 && f.y < y1 + 300) list.push({ y: f.y, kind: 3, it: f });
      list.push({ y: car.y, kind: 4 });
      list.sort((a, b) => a.y - b.y);
      for (const e of list) {
        if (e.kind === 0) props.decor(ctx, e.it, t);
        else if (e.kind === 1) {
          const s = e.it, keeper = world.npcs.find((q) => q.site === s.id), closed = ((s.id === 'cellar' || s.id === 'market') && !isNight()) || RB.npc.vacancy(S, keeper) !== '' || (s.kind === 'arena' && !RB.economy.arenaOpen(S, RB.economy.ARENA[s.id]));
          props.building(ctx, s, t, { closed, power: S.lab.power });
          const name = s.kind === 'house' ? (world.npcs.find((q) => q.site === s.id) || {}).name || 'House' : s.name;
          props.label(ctx, name, s.x, s.y - (s.kind === 'arena' ? 118 : s.id === 'carnival' ? 150 : 130), 20, pal.ink);
        } else if (e.kind === 2) {
          const w = e.it, pit = w.state === 'trapped' ? 18 : 0;
          if (w.alt > 0) RB.art.drawShadow(ctx, w.x, w.y, w.P.TL * 0.4); else RB.art.drawShadow(ctx, w.x, w.y + 1, w.P.TL * 0.55);
          const pose = RB.pose.animPose(w.P, { x: w.x, y: w.y + pit, f: w.f, phase: w.ph, speed: w.sp, time: t, fly: w.alt > 8 ? 1 : 0, alt: w.alt * 1.6 });
          if (w.state === 'trapped') pose.eye = 'scared'; else if (w.state === 'charge') pose.eye = 'angry';
          if (w.state === 'eat' || (w.state === 'graze' && Math.sin(t * 2 + w.ph * 20) > 0.6)) { const k = pose.neck.length; pose.neck[k - 1] += w.P.NL * 0.5; pose.neck[k - 2] += w.f * w.P.NL * 0.3; pose.headAng += w.f > 0 ? 0.9 : -0.9; }
          RB.art.drawCreature(ctx, w.P, pose, {});
          if (w.stam <= 0 && w.state === 'flee') props.label(ctx, 'puff...', w.x, w.y - w.P.rest - w.P.TD - 14, 14, pal.ink);
        } else if (e.kind === 3) {
          const f = e.it;
          RB.art.drawShadow(ctx, f.x, f.y + 1, 26);
          if (f === sheriff) { ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(f.x - f.f * 26, f.y - 12, 12, 0, TAU); ctx.arc(f.x + f.f * 26, f.y - 12, 12, 0, TAU); ctx.fill(); ctx.fillRect(f.x - 26, f.y - 26, 52, 8); }
          const pose = RB.pose.animPose(f.P, { x: f.x, y: f.y - (f === sheriff ? 18 : 0), f: f.f, phase: f.ph, speed: f === sheriff ? 0 : f.sp, time: t });
          if (f.scared > 0) { pose.eye = 'scared'; pose.beakOpen = 1; }
          RB.art.drawCreature(ctx, f.P, pose, { clothes: f.npc.clothes });
        } else {
          RB.art.drawShadow(ctx, car.x, car.y + 2, 62);
          const caged = ST.at(S, 'cage'), len = clamp(80 + 14 * Math.max(0, caged.length - 3), 80, 170);
          props.truckBack(ctx, car.x, car.y, car.f, { bob: car.bob, len });
          caged.slice(-12).forEach((c, i, arr) => { const w = (len - 8) / Math.max(1, arr.length), bx = car.f > 0 ? car.x + 18 - len + 4 + i * w : car.x - 18 + 4 + i * w; RB.art.drawFitted(ctx, ST.pheno(c), bx, car.y - 83 - car.bob, w, 37, Object.assign({ f: car.f, fill: 1 }, common.drawOpts(c))); });
          props.truckFront(ctx, car.x, car.y, car.f, { bob: car.bob, len });
          if (digT > 0) { ctx.save(); ctx.translate(car.x + car.f * 80, car.y - 6); ctx.rotate(Math.sin(digT * 16) * 0.5); ctx.fillStyle = pal.brick; ctx.fillRect(-3, -50, 6, 46); ctx.fillStyle = pal.grey; ctx.fillRect(-11, -8, 22, 18); ctx.restore(); }
        }
      }
      for (const nt of flying) { const k = nt.t, x = lerp(nt.x0, nt.x1, k), y = lerp(nt.y0, nt.y1, k) - Math.sin(k * Math.PI) * 130; drawNet(ctx, x, y, 22 + 26 * k, nt.id, t * 9); }
      if (aim) { ctx.strokeStyle = 'rgba(35,49,74,0.55)'; ctx.lineWidth = 5; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(car.x, car.y - 40); ctx.lineTo(aim.x, aim.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(aim.x, aim.y, tool === 'bignet' ? 100 : 78, 0, TAU); ctx.stroke(); }
      for (const p of parts) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); if (p.text) props.label(ctx, p.text, p.x, p.y - 20, 20, pal.ink); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, 7 * p.life + 2, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.restore();
      // night: dark, with a pool of light around the truck
      if (n > 0) {
        const r = (S.equip.lantern ? 420 : 250) * z, g = ctx.createRadialGradient(v.w / 2, v.h / 2 + 20, r * 0.35, v.w / 2, v.h / 2 + 20, r);
        g.addColorStop(0, 'rgba(22,28,62,0)'); g.addColorStop(1, 'rgba(22,28,62,' + 0.62 * n + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);
      }

      // ---- interface
      common.hud(S);
      common.drawGoal(S, 44);
      if (ui.btn(v.w - 48, 6, 42, 34, '', { icon: 'gear', fill: pal.grey })) common.settings(true);
      if (ui.btn(v.w - 96, 6, 42, 34, '', { icon: 'map', fill: pal.ink })) bigMap();
      const caged = ST.at(S, 'cage');
      if (ui.btn(v.w - 96 - 80, 6, 74, 34, String(caged.length), { icon: 'truck', fill: RB.game.penOpen ? pal.mustard : pal.paper, color: pal.ink, iconCol: pal.coral, size: 13, key: 'KeyC' })) { RB.game.penOpen = !RB.game.penOpen; RB.audio.play('click'); }
      if (RB.game.penOpen && pen) {
        const b = penBox();
        ui.panel(b.x - 4, b.y - 26, b.w + 8, b.h + 30, { r: 12 });
        ui.text('In the truck: ' + caged.length + (caged.length ? ' · drag one out to let it go' : ''), b.x + 4, b.y - 9, { size: 11, maxW: b.w - 70 });
        if (ui.btn(b.x + b.w - 26, b.y - 23, 26, 20, '', { icon: 'close', fill: pal.coral, flat: true, r: 6 })) RB.game.penOpen = false;
        if (ui.btn(b.x + b.w - 58, b.y - 23, 28, 20, '', { icon: 'eye', fill: pal.ink, flat: true, r: 6 })) cageWindow();
        pen.draw(ctx);
        if (!caged.length) ui.text('Empty. Net something!', b.x + b.w / 2, b.y + b.h / 2, { size: 13, align: 'center', color: pal.grey });
      }
      ui.text(WD.BIOMES[WD.biomeAt(world, car.x, car.y)].name, 12, 84, { size: 11, color: n > 0.5 ? pal.white : pal.ink, bold: false });
      if (det !== null) { ui.rect(12, 90, 92, 16, 'rgba(35,49,74,0.7)', 8); ui.icon('detector', 22, 98, 11, pal.white); ui.bar(34, 94, 64, 8, det, pal.mustard, 'rgba(255,255,255,0.25)'); }
      // tools, bottom right
      const tools = [['net', ST.count(S, 'net'), 'Digit1']];
      if (ST.count(S, 'bignet')) tools.push(['bignet', ST.count(S, 'bignet')]);
      if (ST.count(S, 'seed')) tools.push(['seed', ST.count(S, 'seed')]);
      const bs = 54, by = v.h - bs - 10;
      // time speed, above the shovel
      const sp1 = RB.game.timeSpeed || 1;
      if (ui.btn(v.w - 10 - bs, by - 46, bs, 38, 'x' + sp1, { icon: 'clock', fill: sp1 > 1 ? pal.plum : pal.paper, color: sp1 > 1 ? pal.white : pal.ink, iconCol: sp1 > 1 ? pal.white : pal.plum, size: 13, key: 'KeyT' })) {
        RB.game.timeSpeed = sp1 === 1 ? 4 : sp1 === 4 ? 12 : 1; RB.audio.play('click');
        if (RB.game.timeSpeed > 1 && S.time > 23.5) { RB.game.timeSpeed = 1; ui.toast('Too late to hurry the clock. Head home.', pal.coral); }
      }
      let bx = v.w - 10 - bs;
      if (ui.btn(bx, by, bs, bs, '', { icon: 'shovel', fill: pal.brick })) dig();
      ui.text(String(ST.count(S, 'shovel')), bx + bs - 6, by + bs - 5, { size: 12, color: pal.white, align: 'right' });
      for (const tl of tools.reverse()) {
        bx -= bs + 8;
        const on = tool === tl[0], isNet = tl[0] !== 'seed';
        ui.zone(bx, by, bs, bs);
        ctx.fillStyle = pal.shadow; ui.rr(ctx, bx, by + 3, bs, bs, 12); ctx.fill();
        ctx.fillStyle = on ? pal.mustard : pal.paper; ui.rr(ctx, bx, by, bs, bs, 12); ctx.fill();
        ui.itemIcon(tl[0], bx + bs / 2, by + bs / 2 - 3, 26);
        ui.text(String(tl[1]), bx + bs - 6, by + bs - 5, { size: 12, align: 'right' });
        for (const p of input.ptrs) if (p.fresh && p.sx >= bx && p.sx <= bx + bs && p.sy >= by && p.sy <= by + bs) { tool = tl[0]; if (isNet) p.owner = 'aim'; }
        if (ui.tapIn(bx, by, bs, bs)) { tool = tl[0]; if (isNet) autoThrow(); else dropSeed(); } // a plain tap throws at the nearest animal
      }
      if (near) {
        const label = near.kind === 'home' ? 'Go home' : 'Enter ' + (near.kind === 'house' ? (world.npcs.find((q) => q.site === near.id) || {}).name + '\'s' : near.name);
        const w = Math.min(v.w - 150, ui.width(label, 15) + 44);
        if (ui.btn((v.w - w) / 2, v.h - 62, w, 46, label, { icon: 'right', fill: pal.teal, size: 15 })) enter(near);
      } else if (!input.touch && t < 12) ui.text('WASD or arrows to drive · click to throw a net · Q digs · E enters · T speeds time', v.w / 2, v.h - 20, { size: 12, align: 'center', color: n > 0.5 ? pal.white : pal.ink });
      else if (input.touch && t < 12) ui.text('Left thumb drives. Drag from the net to aim, tap it to throw.', v.w / 2, v.h - 76, { size: 12, align: 'center', color: n > 0.5 ? pal.white : pal.ink, maxW: v.w - 16 });
      if (stick) { ctx.fillStyle = 'rgba(35,49,74,0.25)'; ctx.beginPath(); ctx.arc(stick.sx, stick.sy, 46, 0, TAU); ctx.fill(); const dx = stick.x - stick.sx, dy = stick.y - stick.sy, d = Math.hypot(dx, dy) || 1, k = Math.min(46, d) / d; ctx.fillStyle = 'rgba(255,250,240,0.85)'; ctx.beginPath(); ctx.arc(stick.sx + dx * k, stick.sy + dy * k, 20, 0, TAU); ctx.fill(); }
      if (S.time > 24.5) ui.text('It is very late. Head home before you nod off.', v.w / 2, 82, { size: 12, align: 'center', color: pal.white });
    },
    debug() { return { car, wild, folk, nets, near, world, throwNet, dig, tool: () => tool }; },
  };

  function biomeBlocked(x, y, P) { return P.web < 0.5 && WD.biomeAt(world, x, y) === 'water'; }
  function honk() { RB.audio.play('horn'); for (const w of wild) if (Math.hypot(w.x - car.x, w.y - car.y) < 700 && (w.state === 'graze' || w.state === 'walk' || w.state === 'eat')) { w.state = 'flee'; w.t = 1.5; } }
  function dropSeed() {
    if (!ST.take(S, 'seed')) { ui.toast('No seed.', pal.coral); return; }
    seeds.push({ x: car.x + car.f * 60, y: car.y + 20, t: 40 }); RB.audio.play('click');
    if (!ST.count(S, 'seed')) tool = 'net';
  }
  // A tap on the net button throws at the nearest thing in reach.
  function autoThrow() {
    let best = null, bd = range();
    for (const w of wild) { if (w.alt > 40 || !awake(w)) continue; const d = Math.hypot(w.x - car.x, w.y - car.y); if (d < bd) { bd = d; best = w; } }
    if (best) throwNet(best.x, best.y); else throwNet(car.x + car.f * 300, car.y);
  }
  function drawNet(ctx, x, y, r, id, spin) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin || 0);
    ctx.strokeStyle = id === 'bignet' ? pal.plum : pal.paper; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) { const k = i * r * 0.36, h = Math.sqrt(Math.max(0, r * r - k * k)); ctx.beginPath(); ctx.moveTo(k, -h); ctx.lineTo(k, h); ctx.moveTo(-h, k); ctx.lineTo(h, k); ctx.stroke(); }
    ctx.restore();
  }
  // Where the cage panel sits: under the top bar, on the left.
  function penBox() { const v = ui.view, w = Math.min(380, v.w - 24); return { x: 12, y: 136, w, h: v.portrait ? 150 : Math.min(140, v.h * 0.3) }; }
  // Let a rider go at a spot on the map: a bird goes back to the wild there, a person walks home.
  function releaseAt(c, wx, wy) {
    if (c.person) {
      const st = RB.npc.info(S, c.person); st.gone = false; st.rel = Math.max(-100, st.rel - 40);
      const f = folk.find((o) => o.npc.id === c.person);
      if (f) { f.gone = false; f.x = wx; f.y = wy; f.scared = 5; }
    } else { const w = addWild(c.g, wx, wy, 'graze'); w.stam = 30; w.t = 2; }
    ST.removeBird(S, c);
    puff(wx, wy - 30, 6, pal.paper);
    ui.toast(c.name + (c.person ? ' scrambles off home.' : ' is free again.'), pal.ink);
    RB.audio.play('poof');
  }
  const riderActions = (cc) => [{ label: cc.person ? 'Let go' : 'Set free', icon: 'feather', fill: pal.grey, fn: () => { releaseAt(cc, car.x - car.f * 90, car.y + 30); ui.closeAll(); } }];
  function cageWindow() {
    const list = ST.at(S, 'cage');
    common.pick('In the truck', list, (c) => common.card(c, riderActions), () => ({ text: '', ok: true, label: 'Look' }));
  }
  // The whole world at a glance.
  function bigMap() {
    ui.open({ draw() {
      const v = ui.view, box = ui.window('Map', v.w - 16, v.h - 16, {});
      if (!box) return;
      const ctx = ui.ctx, k = Math.min(box.w / WD.W, box.h / WD.H), ox = box.x + (box.w - WD.W * k) / 2, oy = box.y + (box.h - WD.H * k) / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, WD.W * k, WD.H * k); ctx.clip();
      ctx.translate(ox, oy); ctx.scale(k, k);
      ctx.fillStyle = WD.BIOMES.farm.ground; ctx.fillRect(0, 0, WD.W, WD.H);
      for (let i = paths.blobs.length - 1; i >= 0; i--) { ctx.fillStyle = WD.BIOMES[paths.blobs[i][0]].ground; ctx.fill(paths.blobs[i][1]); }
      const strip = (off, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, WD.H); for (let x = 0; x <= WD.W; x += 200) ctx.lineTo(x, WD.seaY(world, x) + off); ctx.lineTo(WD.W, WD.H); ctx.closePath(); ctx.fill(); };
      strip(-620, WD.BIOMES.coast.ground); strip(0, WD.BIOMES.water.ground);
      ctx.fillStyle = WD.BIOMES.water.ground; for (const p of paths.ponds) ctx.fill(p);
      ctx.strokeStyle = '#dcccaa'; ctx.lineWidth = 60; ctx.lineJoin = 'round';
      for (const road of world.roads) { ctx.beginPath(); ctx.moveTo(road[0].x, road[0].y); for (let i = 1; i < road.length; i++) ctx.lineTo(road[i].x, road[i].y); ctx.stroke(); }
      ctx.strokeStyle = pal.coral; ctx.lineWidth = 40;
      for (const m of world.marks) if (!S.marksDug[m.cx + ',' + m.cy]) { ctx.beginPath(); ctx.moveTo(m.x - 80, m.y - 60); ctx.lineTo(m.x + 80, m.y + 60); ctx.moveTo(m.x + 80, m.y - 60); ctx.lineTo(m.x - 80, m.y + 60); ctx.stroke(); }
      ctx.restore();
      for (const s of world.sites) {
        if (s.kind === 'house') { ui.rect(ox + s.x * k - 3, oy + s.y * k - 3, 6, 6, pal.brick, 1); continue; }
        const col = s.kind === 'arena' ? pal.coral : s.id === 'home' ? pal.teal : s.id === 'bfc' ? '#d7372f' : pal.ink;
        ui.rect(ox + s.x * k - 5, oy + s.y * k - 5, 10, 10, col, 3);
        ui.text(s.name, ox + s.x * k, oy + s.y * k - 8, { size: 10, align: 'center' });
      }
      ui.icon('truck', ox + car.x * k, oy + car.y * k, 18, pal.coral);
      ui.text('Red crosses mark something buried.', box.x + 4, box.y + box.h - 4, { size: 10, bold: false });
    } });
  }
})();
