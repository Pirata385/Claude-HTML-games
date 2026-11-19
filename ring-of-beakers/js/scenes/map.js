// scenes/map.js — the overworld. Drive the truck (WASD/arrows or the touch stick), throw nets at
// wild creatures (click, or drag from the net button), dig with the shovel, scatter seed, and
// roll up to a door to go in. Animals graze, bolt, fly off or charge depending on their genes.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, lerp, TAU, hash2, hashStr } = RB.core;
  const ui = RB.ui, pal = RB.pal, input = RB.input, ST = RB.state, common = RB.common, props = RB.props, WD = RB.world;

  let seaWarned = false, guide = null, guideAt = 0, isleHint = null, hintAt = 0, raiseAt = null, seaT = 6;
  let S, world, car, cam, wild, folk, sheriff, nets, flying, seeds, parts, t, rng, tool, aim, stick, digT, near, paths, decorCache, det, stun, warned, sirenT, pen;

  const baseZoom = () => clamp(Math.max(ui.view.w, ui.view.h) / 1500, 0.45, 0.8);
  // the player's own zoom, kept in Settings: 1 is the usual view, 2 sees twice as far
  const ZOOM_MAX = 2;
  const viewZoom = () => clamp((RB.game.settings && RB.game.settings.viewZoom) || 1, 1, ZOOM_MAX);
  const zoom = () => baseZoom() / viewZoom();
  function setViewZoom(k) { const v = +clamp(k, 1, ZOOM_MAX).toFixed(3); if (v !== viewZoom()) { RB.game.settings.viewZoom = v; RB.game.applySettings(); } }
  const toWorld = (px, py) => ({ x: cam.x + (px - ui.view.w / 2) / zoom(), y: cam.y + (py - ui.view.h / 2) / zoom() });
  const isNight = () => S.time >= 19;
  // the music out here: day or night, on the mainland or out at sea
  const mapMood = () => (car && ST.openSea(S) && !WD.inMain(car.x, car.y) ? (isNight() ? 'seanight' : 'sea') : isNight() ? 'night' : 'day');
  const mapSpeed = (P) => clamp(P.speedMax * 1.45, 90, 560);
  const range = () => (S.equip.launcher ? 900 : 520);
  const cageRoom = () => ST.cageCap(S) - ST.at(S, 'cage').length;
  function puff(x, y, n, col, text) { for (let i = 0; i < n; i++) parts.push({ x: x + rng.range(-14, 14), y: y + rng.range(-10, 10), vx: rng.range(-60, 60), vy: rng.range(-110, -30), life: rng.range(0.5, 1), col, text: i === 0 ? text : null }); }

  // The beach around the mainland, past the old map's edges (it matches world.biomeAt).
  function shorePath() {
    const p = new Path2D(), W = WD.W, sw = WD.shoreW, yl = WD.seaY(world, 0) - 40, yr = WD.seaY(world, W) - 40;
    p.moveTo(0, yl);
    for (let y = yl; y > 0; y -= 100) p.lineTo(-sw(-200, y), y);
    const c0 = sw(-200, -200) * 0.7, c1 = sw(W + 200, -200) * 0.7;
    p.lineTo(-c0, -c0);
    for (let x = 0; x <= W; x += 100) p.lineTo(x, -sw(x, -200));
    p.lineTo(W + c1, -c1);
    for (let y = 0; y <= yr; y += 100) p.lineTo(W + sw(W + 200, y), y);
    p.lineTo(W, yr); p.lineTo(0, yl); p.closePath();
    return p;
  }
  // An island's outline, beach and lands, made once and kept.
  const islandPaths = new Map();
  function islandPath(is) {
    let ip = islandPaths.get(is.id);
    if (!ip) {
      const mk = (b) => { const p = new Path2D(); for (let i = 0; i <= 64; i++) { const th = i / 64 * TAU, r = WD.blobR(b, th); const x = b.x + Math.cos(th) * r, y = b.y + Math.sin(th) * r; if (i) p.lineTo(x, y); else p.moveTo(x, y); } p.closePath(); return p; };
      ip = { shape: mk(is.shape), inner: mk(is.inner), patches: is.patches.map((q) => [q[0], mk(q[1])]) };
      islandPaths.set(is.id, ip);
    }
    return ip;
  }
  function buildPaths() {
    paths = { blobs: [], ponds: [] };
    paths.shore = shorePath();
    const mk = (b) => { const p = new Path2D(); for (let i = 0; i <= 56; i++) { const th = i / 56 * TAU, r = WD.blobR(b, th); const x = b.x + Math.cos(th) * r, y = b.y + Math.sin(th) * r; if (i) p.lineTo(x, y); else p.moveTo(x, y); } p.closePath(); return p; };
    for (const b of world.blobs) paths.blobs.push([b[0], mk(b[1])]);
    for (const b of world.ponds) paths.ponds.push(mk(b));
  }

  // The wild animals: the day's population (see world.population), kept for the whole day so they
  // stay where they were while you go in and out of places. Animals caught today are remembered in
  // the save; everything is renewed the next morning. By day the day birds are out; after dark they roost and the night birds take their place.
  function loadWild() {
    const key = S.seed + ':' + S.day, cache = RB.game.wild;
    if (cache && cache.key === key) return cache.list;
    if (!S.wildGone || S.wildGone.day !== S.day) S.wildGone = { day: S.day, ids: [] };
    const gone = new Set(S.wildGone.ids), list = [];
    // birds you set free on earlier days have left a little of themselves in the wild
    for (const e of WD.population(world, S.day, undefined, ST.genePool(S))) if (!gone.has(e.id)) list.push(makeWild(e.g, e.x, e.y, 'graze', e));
    RB.game.wild = { key, list };
    return list;
  }
  // Birds you set free live on near where you let them go, under their own names (each day a little
  // way off, wandering). Kept in step with S.released: freed ones join in, netted ones leave.
  function releasedWild(rec, x, y) {
    const r = new Rng((hashStr(rec.name + ':' + rec.x + ':' + rec.y) ^ Math.imul(S.day, 6007)) >>> 0);
    const wx = x !== undefined ? x : rec.x + r.range(-260, 260), wy = y !== undefined ? y : rec.y + r.range(-200, 200);
    const w = makeWild(RB.genome.deserialize(rec.g), wx, wy, 'graze');
    w.rel = rec; w.name = rec.name; w.any = true; w.hat = rec.bird ? rec.bird.hat : null;
    if (!WD.inMain(wx, wy)) w.island = 'sea';
    return w;
  }
  function syncReleased() {
    if (!wild) return;
    const alive = (S.released || []).filter(ST.wildAlive), recs = new Set(alive); // the ones that died of old age are gone
    for (let i = wild.length - 1; i >= 0; i--) if (wild[i].rel && !recs.has(wild[i].rel)) wild.splice(i, 1);
    const shown = new Set(wild.filter((w) => w.rel).map((w) => w.rel));
    for (const rec of alive) if (!shown.has(rec)) wild.push(releasedWild(rec));
  }
  // The birds living on your islands walk about there too (they are yours: the field station is
  // where you take one back). Rebuilt whenever the map opens or a colony changes.
  function syncColonies() {
    if (!wild) return;
    for (let i = wild.length - 1; i >= 0; i--) if (wild[i].own) wild.splice(i, 1);
    for (const isle of S.isles || []) {
      const r = new Rng((hashStr(isle.id) ^ Math.imul(S.day, 977)) >>> 0), is = RB.sea.islandAt(world, isle.x, isle.y);
      if (!is) continue;
      for (const c of isle.birds) {
        let x = isle.x, y = isle.y;
        for (let k = 0; k < 10; k++) { const a = r.range(0, TAU), d = Math.sqrt(r.next()) * isle.R * 0.7; x = isle.x + Math.cos(a) * d; y = isle.y + Math.sin(a) * d; if (WD.inBlob(is.inner, x, y)) break; }
        const w = makeWild(c.g, x, y, 'graze');
        w.P = ST.pheno(c); w.own = c; w.any = true; w.island = isle.id; w.clothes = c.clothes || null;
        wild.push(w);
      }
    }
  }
  // Claim the empty island you stand on, or raise a new one from the sea ahead of the boat.
  function claimHere(is) {
    ui.confirm('Claim ' + is.name + '?', 'For $' + ST.CLAIM_COST + ' this island is yours. Its wild birds move on, and you get a field station: leave birds there and they live on their own, pair up and raise young, generation after generation. Odd mushrooms and isotopes left there make the young come out strange.', 'Claim', () => {
      const res = ST.claimIsle(S, is);
      if (typeof res === 'string') { ui.toast(res, pal.coral); RB.audio.play('error'); return; }
      RB.sea.restoreIsles(world, S);
      for (let i = wild.length - 1; i >= 0; i--) if (wild[i].island === is.id && !wild[i].own) wild.splice(i, 1);
      syncColonies(); RB.audio.play('found'); RB.game.save();
      ui.toast(is.name + ' is yours. Its field station is in the middle of the island.', pal.teal);
    }, { fill: pal.teal });
  }
  function raiseHere(at) {
    ui.open({ draw() {
      const box = ui.window('Raise an island', 360, 330, {});
      if (!box) return;
      ui.para('For $' + ST.RAISE_COST + ' a new island rises from the sea right ahead of the boat, empty and yours, with a field station. What should it be made of?', box.x, box.y, box.w, { size: 12 });
      const lands = RB.sea.LANDS, cols = 2, bw = (box.w - 8) / cols;
      lands.forEach((land, i) => {
        const x = box.x + (i % cols) * (bw + 8), y = box.y + 64 + Math.floor(i / cols) * 46;
        if (ui.btn(x, y, bw, 38, WD.BIOMES[land].name, { fill: WD.BIOMES[land].ground, color: pal.ink, size: 13, disabled: S.money < ST.RAISE_COST })) {
          const res = ST.raiseIsle(S, world, at.x, at.y, land);
          if (typeof res === 'string') { ui.toast(res, pal.coral); RB.audio.play('error'); return; }
          ui.close(); RB.sea.restoreIsles(world, S); syncColonies(); RB.audio.play('found'); RB.game.save();
          ui.toast(res.name + ' rises from the sea. Its field station is in the middle.', pal.teal);
        }
      });
    } });
  }
  // Out at sea each island's birds join the day's wild list as you come near it.
  function loadIslands() {
    const cache = RB.game.wild;
    if (!cache) return;
    cache.islands = cache.islands || new Set();
    const gone = new Set(S.wildGone ? S.wildGone.ids : []);
    for (const is of RB.sea.islandsNear(world, car.x, car.y, 9000)) {
      if (cache.islands.has(is.id)) continue;
      cache.islands.add(is.id);
      for (const e of RB.sea.population(world, is, S.day)) if (!gone.has(e.id)) wild.push(makeWild(e.g, e.x, e.y, 'graze', e));
    }
  }
  function makeWild(g, x, y, state, e) {
    const P = RB.pheno.express(g);
    return { id: e ? e.id : null, night: !!(e && e.night), cross: e ? e.cross : null, kin: e ? e.kin : null, island: e ? e.island || null : null, g, P, x, y, f: rng.chance(0.5) ? 1 : -1, state: state || 'graze', t: rng.range(0.5, 4), ph: rng.next(), sp: 0, stam: 100, alt: 0, tx: x, ty: y, mean: P.aggression > 0.8 && P.courage > 0.7 && P.S > 0.8 };
  }
  function addWild(g, x, y, state) { const w = makeWild(g, x, y, state); w.any = true; if (!WD.inMain(x, y)) w.island = 'sea'; wild.push(w); return w; }
  // Day birds roost after dark and the night birds come out in their place. Animals you let go or
  // dig up are about at any hour.
  const awake = (w) => w.any || (w.night ? isNight() : !isNight());
  function removeWild(w) {
    const i = wild.indexOf(w);
    if (i >= 0) wild.splice(i, 1);
    if (w.id !== null && S.wildGone) S.wildGone.ids.push(w.id);
  }
  // A hole: an ordinary one dug today (they fill back in overnight), or a treasure mark dug up.
  const holeAt = (cx, cy) => { const k = cx + ',' + cy; return S.dug[k] === S.day || !!S.marksDug[k]; };

  // ---- birds of the open sea. Now and then, out on open water, a flock (or a lone bird) turns up:
  // passing over on migration, wheeling over a shoal and dropping onto the water to feed, or riding
  // the swell in a raft. Down on the water they can be netted; most take off when the boat gets close.
  // [kind, weight, smallest flock, biggest flock]
  const SEA_FLOCKS = [['albatross', 8, 1, 2], ['gull', 12, 3, 9], ['frigatebird', 6, 1, 4], ['booby', 8, 2, 8], ['tropicbird', 5, 1, 3], ['cormorant', 5, 2, 7], ['pelican', 4, 2, 6], ['puffin', 6, 3, 10], ['penguin', 3, 3, 8]];
  function seaFlock(R, mode0) {
    const e = rng.weighted(SEA_FLOCKS, (q) => q[1]), lone = rng.chance(0.25), n = lone ? 1 : rng.int(e[2], e[3]);
    const flier = RB.pheno.express(RB.species.make(e[0], new Rng(1), { sport: 0 })).canFly;
    const mode = mode0 || (!flier ? 'raft' : rng.weighted([['migrate', 5], ['feed', 4], ['raft', 2]], (q) => q[1])[0]);
    const a = rng.range(0, TAU), d0 = mode === 'migrate' ? R + 250 : rng.range(R * 0.45, R * 0.85);
    const cx = car.x + Math.cos(a) * d0, cy = car.y + Math.sin(a) * d0;
    if (mode !== 'migrate' && WD.biomeAt(world, cx, cy) !== 'water') return [];
    const dir = mode === 'migrate' ? Math.atan2(car.y - cy, car.x - cx) + rng.range(-0.6, 0.6) : rng.range(0, TAU), speed = rng.range(230, 330), out = [];
    for (let i = 0; i < n; i++) {
      const side = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 64, back = Math.ceil(i / 2) * 70; // a ragged V on the move, a loose crowd otherwise
      const ox = mode === 'migrate' ? -Math.cos(dir) * back - Math.sin(dir) * side : rng.range(-170, 170), oy = mode === 'migrate' ? -Math.sin(dir) * back + Math.cos(dir) * side : rng.range(-120, 120);
      const w = makeWild(RB.species.make(e[0], rng, { sport: 0.06 }), cx + ox, cy + oy, 'graze');
      Object.assign(w, { seaBird: true, any: true, island: 'sea', mode, dir, speed, cx, cy, ang: rng.range(0, TAU), cr: rng.range(130, 260), spin: rng.range(0.5, 0.9) * (rng.chance(0.5) ? 1 : -1), life: rng.range(35, 70) });
      w.state = mode === 'migrate' ? 'migrate' : mode === 'feed' ? 'circle' : 'swim';
      w.alt = w.state === 'swim' ? 0 : rng.range(70, 100); w.t = w.state === 'circle' ? rng.range(3, 9) : rng.range(5, 12);
      if (w.state === 'swim' && WD.biomeAt(world, w.x, w.y) !== 'water') continue;
      wild.push(w); out.push(w);
    }
    return out;
  }
  function seaLife(dt, R) {
    seaT -= dt;
    if (seaT > 0) return;
    seaT = rng.range(12, 26);
    if (!car.boat || WD.inMain(car.x, car.y) || RB.sea.islandAt(world, car.x, car.y)) return;
    if (wild.filter((w) => w.seaBird).length > 14 || !rng.chance(0.7)) return;
    seaFlock(R);
  }
  // One sea bird's moment. Returns true once it has gone for good.
  function seaBird(w, dt, dx, dy, d, R) {
    const P = w.P;
    let vx = 0, vy = 0;
    w.t -= dt; w.life -= dt;
    const water = (x, y) => WD.biomeAt(world, x, y) === 'water';
    if (w.state === 'swim' && d < 170 + 220 * P.focus) { // the boat comes too close
      if (P.canFly) { w.state = 'takeoff'; w.dir = Math.atan2(dy, dx) + rng.range(-0.6, 0.6); RB.audio.voice(P.voice, 'squawk'); }
      else { w.state = 'paddle'; w.dir = Math.atan2(dy, dx); w.t = 3; }
    }
    if (w.state === 'flee' || w.state === 'graze') { w.dir = Math.atan2(dy, dx); w.state = P.canFly ? 'takeoff' : 'paddle'; w.t = 3; } // a torn net
    if (w.state === 'migrate') {
      w.alt += (95 - w.alt) * Math.min(1, dt * 2); vx = Math.cos(w.dir) * w.speed; vy = Math.sin(w.dir) * w.speed;
      if (d > R + 700 && dx * vx + dy * vy > 0) return true; // flown on, out of sight
    } else if (w.state === 'circle') {
      w.ang += dt * w.spin;
      const tx = w.cx + Math.cos(w.ang) * w.cr, ty = w.cy + Math.sin(w.ang) * w.cr * 0.55;
      vx = (tx - w.x) * 2.2; vy = (ty - w.y) * 2.2; w.alt += (85 - w.alt) * Math.min(1, dt * 2);
      if (w.t <= 0) {
        if (w.life <= 0) { w.state = 'migrate'; w.dir = rng.range(0, TAU); }
        else if (water(w.x, w.y)) w.state = 'dive';
        else w.t = 2;
      }
    } else if (w.state === 'dive') {
      w.alt -= 300 * dt; vx = Math.cos(w.ang) * 50; vy = Math.sin(w.ang) * 30;
      if (w.alt <= 0) { w.alt = 0; w.state = 'swim'; w.t = rng.range(3, 7); puff(w.x, w.y - 6, 4, '#d7eef5'); }
    } else if (w.state === 'swim') {
      vx = Math.cos(w.dir) * 16; vy = Math.sin(w.dir) * 10;
      if (w.t <= 0) {
        if (P.canFly && (w.mode === 'feed' || w.life <= 0)) { w.state = 'takeoff'; w.dir = rng.range(0, TAU); }
        else if (w.life <= 0) { w.state = 'paddle'; w.dir = Math.atan2(dy, dx); w.t = 8; }
        else { w.t = rng.range(2, 5); w.dir = rng.range(0, TAU); }
      }
    } else if (w.state === 'paddle') {
      const sp = mapSpeed(P) * 0.85; vx = Math.cos(w.dir) * sp; vy = Math.sin(w.dir) * sp;
      if (w.life <= 0 && d > R + 500) return true;
      if (w.t <= 0) { w.state = 'swim'; w.t = rng.range(3, 6); }
    } else if (w.state === 'takeoff') {
      w.alt += 150 * dt; vx = Math.cos(w.dir) * 280; vy = Math.sin(w.dir) * 280;
      if (w.alt >= 70) { if (w.mode === 'feed' && w.life > 0) { w.state = 'circle'; w.t = rng.range(3, 8); w.cx = w.x; w.cy = w.y; } else { w.state = 'migrate'; w.speed = 300; } }
    }
    // down on the water they keep to it
    if (w.alt <= 0 && !water(w.x + vx * dt, w.y + vy * dt)) { vx = -vx; vy = -vy; w.dir += Math.PI; }
    w.x += vx * dt; w.y += vy * dt;
    if (Math.abs(vx) > 5) w.f = vx > 0 ? 1 : -1;
    const s = Math.hypot(vx, vy);
    w.sp = w.alt > 0 ? 1 : clamp(s / mapSpeed(P), 0, 1); w.ph = (w.ph + dt * (0.6 + w.sp * 2.4)) % 1;
    return w.life < -120 && d > R + 400; // long overstayed and out of sight
  }
  function catchWild(w, big) {
    const strength = Math.sqrt(w.P.massRel) * w.P.muscle;
    const hold = clamp((big ? 1.7 : 1.25) - 0.26 * strength + (w.stam < 20 ? 0.3 : 0) + (w.state === 'trapped' ? 0.5 : 0), 0.08, 1);
    if (!rng.chance(hold)) { ui.toast('It tore right through the net!', pal.coral); RB.audio.play('bad'); w.state = 'flee'; w.t = 3; puff(w.x, w.y - 30, 6, pal.paper); return 'torn'; }
    removeWild(w);
    if (w.rel) { // one you set free: the same bird, name and all
      const c = ST.recapture(S, w.rel);
      S.stats.caught++;
      ui.toast(c.name + ' is back in the truck. It seems to remember you.', pal.teal);
      RB.audio.play('catch'); RB.audio.voice(w.P.voice, 'squawk'); puff(w.x, w.y - 30, 8, w.P.css.body);
      common.checkAch(S);
      return 'caught';
    }
    const x = w.cross || {};
    const c = ST.addBird(S, w.g, { at: 'cage', bond: 0.1, origin: 'wild', mom: x.mom, dad: x.dad, momKey: x.momKey, dadKey: x.dadKey });
    if (w.kin) ui.toast('This one has a look of ' + w.kin.name + ', whom you set free.', pal.plum);
    else if (w.cross) ui.toast('A natural cross! Very rare in the wild.', pal.plum);
    S.stats.caught++;
    common.discover(S, c);
    ui.toast('Caught ' + c.name + ', a ' + ST.kind(c).toLowerCase() + '.', pal.teal);
    RB.audio.play('catch'); RB.audio.voice(w.P.voice, 'squawk'); puff(w.x, w.y - 30, 8, w.P.css.body);
    common.checkAch(S);
    return 'caught';
  }
  function catchPerson(f) {
    f.gone = true;
    const c = ST.netKeeper(S, f.base);
    RB.audio.play('catch');
    if (!c.person) { ui.toast(c.name + ' is back in the truck, a bird again.', pal.plum); puff(f.x, f.y - 30, 6, f.P.css.body); common.checkAch(S); return 'caught'; } // a bird you put in charge
    let seenBy = 0;
    for (const o of folk) if (o !== f && !o.gone && Math.hypot(o.x - f.x, o.y - f.y) < 750) { seenBy++; o.scared = 6; }
    ST.caughtPerson(S, (f.npc.role === 'sheriff' ? 70 : 35) + seenBy * 15);
    ui.toast('You netted ' + f.npc.name + '!' + (seenBy ? ' Somebody saw that.' : ''), pal.plum);
    puff(f.x, f.y - 60, 8, pal.paper, rng.pick(RB.npc.SCREAMS));
    common.checkAch(S);
    return 'caught';
  }
  function throwNet(tx, ty) {
    const id = ST.useNet(S, tool === 'bignet' && ST.count(S, 'bignet') ? 'bignet' : 'net');
    if (!id) { ui.toast('No nets left. Net & Spade sells them.', pal.coral); RB.audio.play('error'); return; }
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
    for (const w of wild) { if (w.alt > 40 || !awake(w) || w.own) continue; const d = Math.hypot(w.x - n.x1, w.y - n.y1); if (d < bd) { bd = d; best = w; } }
    let who = null;
    for (const f of folk) { if (f.gone) continue; const d = Math.hypot(f.x - n.x1, f.y - n.y1); if (d < bd) { bd = d; who = f; best = null; } }
    let res = 'miss';
    if (who) res = catchPerson(who); else if (best) res = catchWild(best, n.id === 'bignet');
    if ((res === 'miss' || res === 'full') && n.id !== 'silvernet') nets.push({ x: n.x1, y: n.y1, id: n.id }); // the silver net comes back by itself
    if (res === 'miss') puff(n.x1, n.y1, 3, '#d9c7a0');
  }
  function dig() {
    if (digT > 0) return;
    if (!ST.digsLeft(S)) { ui.toast(S.equip.goldshovel ? 'The golden shovel has dug its ' + ST.GOLD_DIGS + ' holes today. Net & Spade sells shovels.' : 'The shovel is worn out. Net & Spade sells them.', pal.coral); RB.audio.play('error'); return; }
    const c = WD.cellOf(car.x, car.y), key = c.cx + ',' + c.cy;
    if (WD.markAt(world, c.cx, c.cy) ? S.marksDug[key] : S.dug[key] === S.day) { ui.toast('Already dug here today. Holes fill back in overnight.'); return; }
    if (WD.biomeAt(world, car.x, car.y) === 'water') { ui.toast('Too wet to dig.'); return; }
    digT = 0.8; car.vx = 0; car.vy = 0;
    RB.audio.play('dig');
  }
  function finishDig() {
    const c = WD.cellOf(car.x, car.y), key = c.cx + ',' + c.cy, loot = WD.lootAt(world, c.cx, c.cy, S.day);
    ST.useDig(S); S.stats.dug++;
    if (WD.markAt(world, c.cx, c.cy)) S.marksDug[key] = true; else S.dug[key] = S.day;
    const hx = (c.cx + 0.5) * WD.CELL, hy = (c.cy + 0.5) * WD.CELL;
    puff(hx, hy, 8, '#8a6a44');
    if (!loot) { ui.toast('Nothing but dirt.'); }
    else {
      RB.audio.play('found');
      if (loot.type === 'money' || loot.type === 'chest') { S.money += loot.money; S.stats.earned += loot.money; ui.toast((loot.type === 'chest' ? 'A buried chest! $' : 'Buried coins: $') + loot.money, pal.mustard); }
      else if (loot.type === 'item') { ST.give(S, loot.id, loot.n || 1); ui.toast('Dug up: ' + RB.items.ITEMS[loot.id].name + (loot.n > 1 ? ' x' + loot.n : ''), pal.teal); }
      else if (loot.type === 'fossil') { RB.lab.addFragment(S, loot.set); ui.toast((loot.set === 'elephant' ? 'A huge bone! ' : 'A fossil fragment: ') + RB.items.FOSSILS[loot.set] + ' (' + RB.lab.fragments(S, loot.set) + '/' + RB.lab.FRAGMENTS + ')', pal.plum); }
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
    const base = world.npcs.find((n) => n.site === site.id);
    const empty = RB.npc.vacancy(S, base);
    // nobody minding the place: put someone in charge, or come back later
    if (empty) { common.vacant(S, site, base, empty, () => { refreshFolk(); enter(site); }); return; }
    if (st === 'arena' && !RB.economy.arenaOpen(S, RB.economy.ARENA[site.id])) { ui.toast('The Grand Ring only takes champions: beat the boss at every other arena first.', pal.coral); return; }
    S.pos = { x: car.x, y: car.y };
    RB.game.save();
    RB.game.go(st === 'lab' ? 'lab' : st === 'roost' ? 'roost' : 'site', { site: site.id });
  }
  // Dawn out on the road or at sea: the night passes at home as if you had slept there (the feeder,
  // the nests, the eggs, a day older), and you carry on from where you are.
  function dawn() {
    const rep = ST.sleep(S);
    RB.game.timeSpeed = 1;
    wild = loadWild(); syncReleased(); syncColonies(); // the new day's wild, your freed birds (those still alive) and your colonies
    S.pos = { x: car.x, y: car.y };
    common.checkAch(S);
    RB.game.save();
    ui.message('Day ' + S.day, 'The sun comes up while you are still out. The new day starts right here.' + (rep.lines.length ? '\n' + rep.lines.join('\n') : ''), null, { ok: 'Good morning' });
  }
  function fined() {
    const fine = Math.min(S.money, 50 + Math.round(S.heat * 8));
    S.money -= fine;
    const held = ST.at(S, 'cage').filter((c) => c.person);
    for (const c of held) { ST.releasePerson(S, c, 20); ST.removeBird(S, c); }
    refreshFolk();
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
      RB.sea.restoreIsles(world, S); // your islands, and their field stations
      wild = loadWild();
      syncReleased();
      syncColonies();
      decorCache = new Map();
      if (!paths || paths.seed !== world.seed) { buildPaths(); paths.seed = world.seed; }
      folk = world.npcs.filter((n) => n.site.startsWith('house') || n.role === 'sheriff').map((n0) => {
        const s = world.site[n0.site];
        return { base: n0, npc: null, P: null, x: s.x + (n0.role === 'sheriff' ? 160 : 70), y: s.y + 120, hx: s.x + 70, hy: s.y + 120, f: 1, ph: 0, sp: 0, t: rng.range(0, 3), gone: true, scared: 0 };
      });
      refreshFolk();
      sheriff = folk.find((f) => f.base.role === 'sheriff');
      RB.audio.setTune(mapMood());
      // the truck's cage, live: grab the riders, tap one for its card, drag one out to let it go
      pen = new RB.Pen({ drawOpts: common.drawOpts, onTap: (c) => common.card(c, riderActions), onDropOut: (c, sx, sy) => { const w = toWorld(sx, sy); releaseAt(c, w.x, w.y); } });
    },
    exit() { if (car) S.pos = { x: car.x, y: car.y }; if (pen) { pen.dispose(); pen = null; } },

    update(dt) {
      const v = ui.view, z = zoom();
      if (common.checkBroke(S, 'map')) return;
      t += dt; stun = Math.max(0, stun - dt);
      RB.audio.setTune(mapMood()); // night music at nightfall, sea music past the shore
      // world time: an hour every 30 s, or faster with the speed button; it drops back to normal at nightfall
      const before = S.time, g = RB.game;
      S.time += dt / 30 * (g.timeSpeed || 1);
      if (before < 19 && S.time >= 19) { if (g.timeSpeed > 1) g.timeSpeed = 1; ui.toast('Night falls. The Cellar and the Night Market are open.', pal.plum); }
      // staying out all night costs nothing: at dawn the new day simply starts wherever you are
      if (S.time >= 30) { dawn(); return; }
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
      // the open sea: no more edges, and with the speedboat kit the truck takes to the water
      const open = ST.openSea(S), boat = open && ST.hasBoat(S);
      car.boat = boat && biome === 'water';
      let slow = road ? 1.2 : WD.BIOMES[biome].slow;
      if (S.up.tires && biome !== 'water' && !road) slow = Math.max(slow, 1);
      if (car.boat) slow = 1.45;
      const vmax = (330 + 75 * S.up.engine) * slow * (stun > 0 || digT > 0 ? 0 : 1);
      car.vx += (ix * vmax - car.vx) * Math.min(1, dt * 5); car.vy += (iy * vmax - car.vy) * Math.min(1, dt * 5);
      let nx = car.x + car.vx * dt, ny = car.y + car.vy * dt;
      if (!open) { nx = clamp(nx, 80, WD.W - 80); ny = clamp(ny, 80, Math.min(WD.H - 80, WD.seaY(world, car.x) + 240)); }
      else if (!boat && WD.biomeAt(world, nx, ny) === 'water' && (!WD.inMain(nx, ny) || ny > WD.seaY(world, nx) + 240)) {
        nx = car.x; ny = car.y; car.vx = 0; car.vy = 0; // deep water stops a truck
        if (!seaWarned) { seaWarned = true; ui.toast('The open sea! Biu\'s Garage can fit a speedboat kit.', pal.teal); }
      }
      car.x = nx; car.y = ny;
      isleHint = null;
      if (open && !near) {
        const isl = car.boat ? null : RB.sea.islandAt(world, car.x, car.y);
        if (isl && !isl.owned && !isl.made && !isl.sites.length) isleHint = { claim: isl };
        else if (car.boat) {
          // out on the open sea the button is always there; where an island cannot rise it says why
          if (t - hintAt > 0.4) { hintAt = t; const at = { x: car.x + car.f * (ST.RAISE_R + 260), y: car.y }; at.why = RB.sea.raiseSpot(world, at.x, at.y, ST.RAISE_R); raiseAt = at; }
          if (raiseAt && raiseAt.why !== RB.sea.NEAR_MAIN) isleHint = { raise: raiseAt };
        }
      }
      if (open) {
        loadIslands();
        // landing on an island puts it on the list you can sail back to from the map
        const isl = car.boat ? null : RB.sea.islandAt(world, car.x, car.y);
        if (isl && !S.visited[isl.id]) { S.visited[isl.id] = 1; ui.toast('You land on ' + isl.name + '. From now on you can sail back here from the map.', pal.teal); }
      }
      if (Math.abs(car.vx) > 20) car.f = car.vx > 0 ? 1 : -1;
      const sp = Math.hypot(car.vx, car.vy);
      car.bob = sp > 30 ? Math.abs(Math.sin(t * 22)) * 2.5 : 0;
      cam.x += (car.x - cam.x) * Math.min(1, dt * 6); cam.y += (car.y - 30 - cam.y) * Math.min(1, dt * 6);
      // ---- tools
      if (input.hit('Digit1')) tool = 'net'; if (input.hit('Digit2') && ST.count(S, 'bignet')) tool = 'bignet'; if (input.hit('Digit3')) tool = 'seed';
      if (input.hit('KeyQ')) dig();
      if (input.hit('KeyH')) honk();
      // zoom: the wheel, or - and = (the buttons are drawn with the other controls)
      if (!ui.modals.length) {
        if (input.wheel) setViewZoom(viewZoom() * Math.pow(1.12, input.wheel));
        if (input.hit('Minus') || input.hit('NumpadSubtract')) setViewZoom(viewZoom() * 1.25);
        if (input.hit('Equal') || input.hit('NumpadAdd')) setViewZoom(viewZoom() / 1.25);
      }
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
      if (open) seaLife(dt, R);
      const goneSea = [];
      for (const w of wild) {
        const dx = w.x - car.x, dy = w.y - car.y;
        if (w.seaBird) { if (seaBird(w, dt, dx, dy, Math.hypot(dx, dy) || 1, R)) goneSea.push(w); continue; }
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
        // mainland animals keep to the mainland; island birds roam their own island (water stops them)
        if (w.island) { w.x += vx * dt; w.y += vy * dt; }
        else { w.x = clamp(w.x + vx * dt, 60, WD.W - 60); w.y = clamp(w.y + vy * dt, 60, WD.H - 60); }
        const s = Math.hypot(vx, vy);
        if (Math.abs(vx) > 5) w.f = vx > 0 ? 1 : -1;
        w.sp = clamp(s / ms, 0, 1); w.ph = (w.ph + dt * (0.6 + w.sp * 2.4)) % 1;
        // a hole is a trap for anything small enough
        if (w.alt <= 0 && w.state !== 'trapped' && P.S < 1.7 && s > 10) { const c = WD.cellOf(w.x, w.y); if (holeAt(c.cx, c.cy) && Math.hypot((c.cx + 0.5) * WD.CELL - w.x, (c.cy + 0.5) * WD.CELL - w.y) < 34) { w.state = 'trapped'; w.t = 7; w.x = (c.cx + 0.5) * WD.CELL; w.y = (c.cy + 0.5) * WD.CELL; puff(w.x, w.y, 5, '#8a6a44', 'stuck!'); } }
      }
      for (const w of goneSea) wild.splice(wild.indexOf(w), 1);
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
        if (bd < 520) det = 1 - bd / 520; // a silent needle: the meter fills as you get close
      }
      for (const p of parts) { p.life -= dt * 1.4; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; }
      parts = parts.filter((p) => p.life > 0);
    },

    draw(ctx) {
      const v = ui.view, z = zoom(), n = common.night(S.time);
      const x0 = cam.x - v.w / 2 / z, y0 = cam.y - v.h / 2 / z, x1 = cam.x + v.w / 2 / z, y1 = cam.y + v.h / 2 / z;
      // the sea all round, the mainland's beach, then the mainland
      ctx.fillStyle = WD.BIOMES.water.ground; ctx.fillRect(0, 0, v.w, v.h);
      ctx.save();
      ctx.translate(v.w / 2 - cam.x * z, v.h / 2 - cam.y * z); ctx.scale(z, z);
      ctx.fillStyle = WD.BIOMES.coast.ground; ctx.fill(paths.shore);
      ctx.fillStyle = WD.BIOMES.farm.ground; ctx.fillRect(0, 0, WD.W, WD.H);
      for (let i = paths.blobs.length - 1; i >= 0; i--) { ctx.fillStyle = WD.BIOMES[paths.blobs[i][0]].ground; ctx.fill(paths.blobs[i][1]); }
      // the coast and the sea follow the same wavy line (across the mainland only)
      const sx0 = Math.max(0, x0 - 50), sx1 = Math.min(WD.W, x1 + 60);
      const strip = (off, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(sx0, y1 + 400); for (let x = sx0; x <= sx1; x += 50) ctx.lineTo(x, WD.seaY(world, x) + off); ctx.lineTo(sx1, WD.seaY(world, sx1) + off); ctx.lineTo(sx1, y1 + 400); ctx.closePath(); ctx.fill(); };
      if (y1 > world.sea.y - 800 && sx1 > sx0) { strip(-620, WD.BIOMES.coast.ground); strip(0, WD.BIOMES.water.ground); strip(90 + Math.sin(t) * 10, WD.BIOMES.water.dark); }
      ctx.fillStyle = WD.BIOMES.water.ground; for (const p of paths.ponds) ctx.fill(p);
      // islands out at sea
      const viewR = Math.hypot(x1 - x0, y1 - y0) / 2 + 400;
      for (const is of RB.sea.islandsNear(world, cam.x, cam.y, viewR)) {
        const ip = islandPath(is);
        ctx.fillStyle = WD.BIOMES.coast.ground; ctx.fill(ip.shape);
        ctx.fillStyle = WD.BIOMES[is.main].ground; ctx.fill(ip.inner);
        for (const q of ip.patches) { ctx.save(); ctx.clip(ip.inner); ctx.fillStyle = WD.BIOMES[q[0]].ground; ctx.fill(q[1]); ctx.restore(); }
        if (is.isle && is.isle.rad > 0.02) { ctx.fillStyle = 'rgba(120,255,90,' + (0.08 + 0.22 * is.isle.rad * (0.8 + 0.2 * Math.sin(t * 2))).toFixed(3) + ')'; ctx.fill(ip.inner); } // radioactive
        ctx.strokeStyle = '#dcccaa'; ctx.lineWidth = 78; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const road of is.roads) { ctx.beginPath(); ctx.moveTo(road[0].x, road[0].y); for (let i = 1; i < road.length; i++) ctx.lineTo(road[i].x, road[i].y); ctx.stroke(); }
      }
      // ground texture: one small tuft per cell, darker than its biome (one fill per colour)
      const gs = 150, tufts = new Map();
      for (let gx = Math.floor(x0 / gs); gx <= Math.floor(x1 / gs); gx++) for (let gy = Math.floor(y0 / gs); gy <= Math.floor(y1 / gs); gy++) {
        const hx = (gx + hash2(gx, gy, 3)) * gs, hy = (gy + hash2(gx, gy, 4)) * gs, col = WD.BIOMES[WD.biomeAt(world, hx, hy)].dark;
        let path = tufts.get(col); if (!path) { path = new Path2D(); tufts.set(col, path); }
        path.moveTo(hx + 16, hy); path.ellipse(hx, hy, 16, 5, 0, 0, TAU);
      }
      for (const [col, path] of tufts) { ctx.fillStyle = col; ctx.fill(path); }
      // the Bone Quarry's dig: a terraced pit roped off on four posts, with bones showing
      const qs = world.site.quarry;
      if (qs && Math.abs(qs.x - cam.x) < 3000 && Math.abs(qs.y - cam.y) < 3000) {
        const qx = qs.x, qy = qs.y + WD.QUARRY_DY, qr = WD.QUARRY_R;
        ctx.fillStyle = '#d8c08e'; ctx.beginPath(); ctx.ellipse(qx, qy, qr, qr * 0.62, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c4a874'; ctx.beginPath(); ctx.ellipse(qx, qy + 20, qr * 0.72, qr * 0.42, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ad9160'; ctx.beginPath(); ctx.ellipse(qx, qy + 36, qr * 0.42, qr * 0.24, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#f6ead2';
        for (let i = 0; i < 9; i++) { const a = i * 2.4, d = qr * (0.2 + 0.08 * (i % 5)); const bx = qx + Math.cos(a) * d * 1.3, by = qy + Math.sin(a) * d * 0.8; ctx.save(); ctx.translate(bx, by); ctx.rotate(a); ctx.fillRect(-14, -3, 28, 6); ctx.beginPath(); ctx.arc(-14, -3, 5, 0, TAU); ctx.arc(-14, 3, 5, 0, TAU); ctx.arc(14, -3, 5, 0, TAU); ctx.arc(14, 3, 5, 0, TAU); ctx.fill(); ctx.restore(); }
        ctx.strokeStyle = '#b5523b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(qx, qy, qr + 30, qr * 0.62 + 24, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#96693f'; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.fillRect(qx + Math.cos(a) * (qr + 30) - 4, qy + Math.sin(a) * (qr * 0.62 + 24) - 30, 8, 30); }
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
          props.building(ctx, s, t, { closed, power: S.lab.power, rad: s.isle ? (ST.isleOf(S, s.isle) || {}).rad : 0 });
          const name = s.kind === 'house' ? (world.npcs.find((q) => q.site === s.id) || {}).name || 'House' : s.name;
          props.label(ctx, name, s.x, s.y - (s.kind === 'arena' ? 118 : s.id === 'carnival' ? 150 : 130), 20, pal.ink);
        } else if (e.kind === 2) {
          const w = e.it, afloat = w.seaBird && w.alt <= 0, pit = w.state === 'trapped' ? 18 : afloat ? w.P.LLv * 0.9 + Math.sin(t * 2.4 + w.ph * 9) * 1.5 : 0;
          if (afloat) { ctx.save(); ctx.beginPath(); ctx.rect(w.x - 400, w.y - 600, 800, 600 + 1); ctx.clip(); }
          else if (w.alt > 0) RB.art.drawShadow(ctx, w.x, w.y, w.P.TL * 0.4); else RB.art.drawShadow(ctx, w.x, w.y + 1, w.P.TL * 0.55);
          const pose = RB.pose.animPose(w.P, { x: w.x, y: w.y + pit, f: w.f, phase: w.ph, speed: w.sp, time: t, fly: w.alt > 8 ? 1 : 0, alt: w.alt * 1.6 });
          if (w.state === 'trapped') pose.eye = 'scared'; else if (w.state === 'charge') pose.eye = 'angry';
          if (w.state === 'eat' || (w.state === 'graze' && Math.sin(t * 2 + w.ph * 20) > 0.6)) { const k = pose.neck.length; pose.neck[k - 1] += w.P.NL * 0.5; pose.neck[k - 2] += w.f * w.P.NL * 0.3; pose.headAng += w.f > 0 ? 0.9 : -0.9; }
          RB.art.drawCreature(ctx, w.P, pose, w.clothes ? { clothes: w.clothes } : w.hat ? { hat: w.hat } : {});
          if (w.rel && Math.hypot(w.x - car.x, w.y - car.y) < 700) props.label(ctx, w.name, w.x, w.y - w.P.rest - w.P.TD - 18 - w.alt * 1.6, 18, pal.plum); // a bird you set free still answers to its name
          if (afloat) { ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(w.x, w.y + 1, w.P.TL * 0.65 + Math.sin(t * 2 + w.ph * 7) * 3, w.P.TL * 0.16, 0, 0, TAU); ctx.stroke(); }
          if (w.stam <= 0 && w.state === 'flee') props.label(ctx, 'puff...', w.x, w.y - w.P.rest - w.P.TD - 14, 14, pal.ink);
        } else if (e.kind === 3) {
          const f = e.it;
          RB.art.drawShadow(ctx, f.x, f.y + 1, 26);
          if (f === sheriff) { ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(f.x - f.f * 26, f.y - 12, 12, 0, TAU); ctx.arc(f.x + f.f * 26, f.y - 12, 12, 0, TAU); ctx.fill(); ctx.fillRect(f.x - 26, f.y - 26, 52, 8); }
          const pose = RB.pose.animPose(f.P, { x: f.x, y: f.y - (f === sheriff ? 18 : 0), f: f.f, phase: f.ph, speed: f === sheriff ? 0 : f.sp, time: t });
          if (f.scared > 0) { pose.eye = 'scared'; pose.beakOpen = 1; }
          RB.art.drawCreature(ctx, f.P, pose, { clothes: f.npc.clothes });
        } else {
          const caged = ST.at(S, 'cage'), len = clamp(80 + 14 * Math.max(0, caged.length - 3), 80, 170);
          const bob = car.boat ? Math.sin(t * 3) * 2.5 : car.bob;
          if (car.boat) props.boatBack(ctx, car.x, car.y, car.f, { len, t }); else RB.art.drawShadow(ctx, car.x, car.y + 2, 62);
          props.truckBack(ctx, car.x, car.y, car.f, { bob, len });
          caged.slice(-12).forEach((c, i, arr) => { const w = (len - 8) / Math.max(1, arr.length), bx = car.f > 0 ? car.x + 18 - len + 4 + i * w : car.x - 18 + 4 + i * w; RB.art.drawFitted(ctx, ST.pheno(c), bx, car.y - 83 - bob, w, 37, Object.assign({ f: car.f, fill: 1 }, common.drawOpts(c))); });
          if (car.boat) props.boatFront(ctx, car.x, car.y, car.f, { bob, len }); else props.truckFront(ctx, car.x, car.y, car.f, { bob, len });
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

      // the guide: an arrow to the nearest place of any kind switched on in the map's markers
      const gcats = RB.guide.on(S).filter((id) => { const c = RB.guide.categories().find((q) => q.id === id); return c && (!c.sea || ST.openSea(S)); });
      if (gcats.length) {
        if (!guideAt || t - guideAt > 1) { guide = RB.guide.nearest(world, S, gcats, car.x, car.y, ST.openSea(S) ? 60000 : 16000, ST.openSea(S)); guideAt = t; }
        if (guide && guide.d > 260) {
          const a = Math.atan2(guide.y - car.y, guide.x - car.x), R = Math.min(v.w, v.h) * 0.34, ax = v.w / 2 + Math.cos(a) * R, ay = v.h / 2 + Math.sin(a) * R * 0.8;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
          ctx.fillStyle = 'rgba(35,49,74,0.35)'; ctx.beginPath(); ctx.moveTo(20, 3); ctx.lineTo(-12, -11); ctx.lineTo(-6, 3); ctx.lineTo(-12, 17); ctx.closePath(); ctx.fill();
          ctx.fillStyle = pal.coral; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -14); ctx.lineTo(-6, 0); ctx.lineTo(-12, 14); ctx.closePath(); ctx.fill();
          ctx.restore();
          const km = guide.d / 1000, txt = RB.guide.label(guide.cat).replace(/ fossils$/, ' fossils') + ': ' + guide.name + ' · ' + (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km';
          const tw = Math.min(v.w - 20, ui.width(txt, 11) + 16), tx = clamp(ax - tw / 2, 10, v.w - 10 - tw), ty = clamp(ay + 20, 50, v.h - 90);
          ui.rect(tx, ty, tw, 20, 'rgba(255,250,240,0.92)', 10); ui.text(txt, tx + tw / 2, ty + 14, { size: 11, align: 'center', maxW: tw - 10 });
        }
      } else guide = null;
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
      const tools = [S.equip.silvernet ? ['net', '∞', 'Digit1', 'silvernet'] : ['net', ST.fmtCount(ST.count(S, 'net')), 'Digit1']];
      if (ST.count(S, 'bignet')) tools.push(['bignet', ST.fmtCount(ST.count(S, 'bignet'))]);
      if (ST.count(S, 'seed')) tools.push(['seed', ST.fmtCount(ST.count(S, 'seed'))]);
      const bs = 54, by = v.h - bs - 10;
      // zoom out to see further (up to twice as far), or back in, above the clock
      const vz = viewZoom(), zw = (bs - 4) / 2, zy = by - 46 - 42;
      if (ui.btn(v.w - 10 - bs, zy, zw, 34, '', { icon: 'minus', fill: pal.paper, iconCol: pal.ink, disabled: vz >= ZOOM_MAX - 0.001 })) { setViewZoom(vz * 1.25); RB.audio.play('click'); }
      if (ui.btn(v.w - 10 - zw, zy, zw, 34, '', { icon: 'plus', fill: pal.paper, iconCol: pal.ink, disabled: vz <= 1.001 })) { setViewZoom(vz / 1.25); RB.audio.play('click'); }
      if (vz > 1.001) ui.text('x' + vz.toFixed(1), v.w - 10 - bs / 2, zy - 6, { size: 11, align: 'center', color: n > 0.5 ? pal.white : pal.ink });
      // time speed, above the shovel
      const sp1 = RB.game.timeSpeed || 1;
      if (ui.btn(v.w - 10 - bs, by - 46, bs, 38, 'x' + sp1, { icon: 'clock', fill: sp1 > 1 ? pal.plum : pal.paper, color: sp1 > 1 ? pal.white : pal.ink, iconCol: sp1 > 1 ? pal.white : pal.plum, size: 13, key: 'KeyT' })) {
        RB.game.timeSpeed = sp1 === 1 ? 4 : sp1 === 4 ? 12 : 1; RB.audio.play('click');
      }
      let bx = v.w - 10 - bs;
      const gold = ST.goldLeft(S) > 0;
      if (ui.btn(bx, by, bs, bs, '', { icon: 'shovel', fill: gold ? '#d9a21b' : pal.brick })) dig();
      // the golden shovel's digs left today, then ordinary ones
      const digs = ST.endless(S, 'shovel') ? '∞' : S.equip.goldshovel && ST.count(S, 'shovel') ? ST.goldLeft(S) + '+' + ST.count(S, 'shovel') : String(ST.digsLeft(S));
      ui.text(digs, bx + bs - 6, by + bs - 5, { size: 12, color: pal.white, align: 'right' });
      for (const tl of tools.reverse()) {
        bx -= bs + 8;
        const on = tool === tl[0], isNet = tl[0] !== 'seed';
        ui.zone(bx, by, bs, bs);
        ctx.fillStyle = pal.shadow; ui.rr(ctx, bx, by + 3, bs, bs, 12); ctx.fill();
        ctx.fillStyle = on ? pal.mustard : pal.paper; ui.rr(ctx, bx, by, bs, bs, 12); ctx.fill();
        ui.itemIcon(tl[3] || tl[0], bx + bs / 2, by + bs / 2 - 3, 26);
        ui.text(String(tl[1]), bx + bs - 6, by + bs - 5, { size: 12, align: 'right' });
        for (const p of input.ptrs) if (p.fresh && p.sx >= bx && p.sx <= bx + bs && p.sy >= by && p.sy <= by + bs) { tool = tl[0]; if (isNet) p.owner = 'aim'; }
        if (ui.tapIn(bx, by, bs, bs)) { tool = tl[0]; if (isNet) autoThrow(); else dropSeed(); } // a plain tap throws at the nearest animal
      }
      // the big action button sits bottom centre, or above the tools when they would overlap (portrait)
      const actY = (w) => (v.w + w) / 2 > bx - 6 ? by - 54 : v.h - 62;
      if (near) {
        const label = near.kind === 'home' ? 'Go home' : 'Enter ' + (near.kind === 'house' ? (world.npcs.find((q) => q.site === near.id) || {}).name + '\'s' : near.name);
        const w = Math.min(v.w - 150, ui.width(label, 15) + 44);
        if (ui.btn((v.w - w) / 2, actY(w), w, 46, label, { icon: 'right', fill: pal.teal, size: 15 })) enter(near);
      } else if (isleHint) {
        const label = isleHint.claim ? 'Claim this island · $' + ST.CLAIM_COST : 'Raise an island here · $' + ST.RAISE_COST;
        const w = Math.min(v.w - 150, ui.width(label, 14) + 44), why = isleHint.raise && isleHint.raise.why;
        if (ui.btn((v.w - w) / 2, actY(w), w, 46, label, { icon: isleHint.claim ? 'flag' : 'up', fill: why ? pal.grey : pal.plum, size: 14 })) {
          if (isleHint.claim) claimHere(isleHint.claim);
          else if (why) { ui.toast(why + ' An island needs open water, away from land.', pal.coral); RB.audio.play('error'); }
          else raiseHere(isleHint.raise);
        }
      } else if (!input.touch && t < 12) ui.text('WASD or arrows to drive · click to throw a net · Q digs · E enters · T speeds time', v.w / 2, v.h - 20, { size: 12, align: 'center', color: n > 0.5 ? pal.white : pal.ink });
      else if (input.touch && t < 12) ui.text('Left thumb drives. Drag from the net to aim, tap it to throw.', v.w / 2, v.h - 76, { size: 12, align: 'center', color: n > 0.5 ? pal.white : pal.ink, maxW: v.w - 16 });
      if (stick) { ctx.fillStyle = 'rgba(35,49,74,0.25)'; ctx.beginPath(); ctx.arc(stick.sx, stick.sy, 46, 0, TAU); ctx.fill(); const dx = stick.x - stick.sx, dy = stick.y - stick.sy, d = Math.hypot(dx, dy) || 1, k = Math.min(46, d) / d; ctx.fillStyle = 'rgba(255,250,240,0.85)'; ctx.beginPath(); ctx.arc(stick.sx + dx * k, stick.sy + dy * k, 20, 0, TAU); ctx.fill(); }
    },
    debug() { return { car, wild, folk, nets, near, world, throwNet, dig, bigMap, riderCard: (c) => common.card(c, riderActions), seaFlock: (mode, R) => seaFlock(R || 900, mode), tool: () => tool, guide: () => guide }; },
  };

  // Who walks out of each house now: its own person, a newcomer, or whoever you put in charge.
  function refreshFolk() {
    if (!folk) return;
    for (const f of folk) {
      const n = RB.npc.current(S, f.base);
      if (f.npc !== n) { f.npc = n; f.P = RB.pheno.express(n.g); }
      f.gone = RB.npc.vacancy(S, f.base) !== '';
    }
  }
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
    ctx.strokeStyle = id === 'bignet' ? pal.plum : id === 'silvernet' ? '#cfd8e3' : pal.paper; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) { const k = i * r * 0.36, h = Math.sqrt(Math.max(0, r * r - k * k)); ctx.beginPath(); ctx.moveTo(k, -h); ctx.lineTo(k, h); ctx.moveTo(-h, k); ctx.lineTo(h, k); ctx.stroke(); }
    ctx.restore();
  }
  // Where the cage panel sits: under the top bar, on the left.
  function penBox() { const v = ui.view, w = Math.min(380, v.w - 24); return { x: 12, y: 136, w, h: v.portrait ? 150 : Math.min(140, v.h * 0.3) }; }
  // Let a rider go at a spot on the map: a bird goes back to the wild there, a person walks home.
  function releaseAt(c, wx, wy) {
    let back = null;
    if (c.person) {
      back = ST.releasePerson(S, c, 40); // home again; whoever you had put in charge there comes back
      refreshFolk();
      const f = folk.find((o) => o.base.id === c.person);
      if (f && !f.gone) { f.x = wx; f.y = wy; f.scared = 5; }
    }
    const rec = ST.setFree(S, c, wx, wy); // it lives on out here, and its genes join the wild around here
    if (rec) { const w = releasedWild(rec, wx, wy); w.stam = 30; w.t = 2; wild.push(w); }
    puff(wx, wy - 30, 6, pal.paper);
    ui.toast(c.name + (c.person ? ' scrambles off home.' : ' is free again.') + (back ? ' ' + back.name + ', who was minding the place, hops back into the truck.' : ''), pal.ink);
    RB.audio.play('poof');
  }
  // What you can do with a rider, wherever the truck (or the boat) is: feed it, dress it, let it go.
  const riderActions = (cc) => [
    { label: 'Give', icon: 'seed', fill: pal.teal, fn: () => common.feedPick(cc) },
    { label: 'Wear', icon: 'hat', fill: pal.plum, fn: () => common.wardrobe(cc) },
    { label: cc.person ? 'Let go' : 'Set free', icon: 'feather', fill: pal.grey, fn: () => { releaseAt(cc, car.x - car.f * 90, car.y + 30); ui.closeAll(); } },
  ];
  function cageWindow() {
    const list = ST.at(S, 'cage');
    common.pick('In the truck', list, (c) => common.card(c, riderActions), () => ({ text: '', ok: true, label: 'Look' }));
  }
  // The whole world at a glance.
  // ---- the map window: zoom (buttons, wheel, pinch), drag to look around, markers, and fast travel
  // between islands you have landed on (and home). Out at sea it doubles as a sea chart.
  const GD = RB.guide;
  const MARKER_COL = { Places: pal.ink, Fossils: pal.plum, Birds: pal.teal };
  function drawMainland(ctx, k) {
    ctx.fillStyle = WD.BIOMES.coast.ground; ctx.fill(paths.shore);
    ctx.fillStyle = WD.BIOMES.farm.ground; ctx.fillRect(0, 0, WD.W, WD.H);
    for (let i = paths.blobs.length - 1; i >= 0; i--) { ctx.fillStyle = WD.BIOMES[paths.blobs[i][0]].ground; ctx.fill(paths.blobs[i][1]); }
    const strip = (off, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, WD.H); for (let x = 0; x <= WD.W; x += 200) ctx.lineTo(x, WD.seaY(world, x) + off); ctx.lineTo(WD.W, WD.H); ctx.closePath(); ctx.fill(); };
    strip(-620, WD.BIOMES.coast.ground); strip(0, WD.BIOMES.water.ground);
    ctx.fillStyle = WD.BIOMES.water.ground; for (const p of paths.ponds) ctx.fill(p);
    ctx.strokeStyle = '#dcccaa'; ctx.lineWidth = Math.max(60, 3 / k); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const road of world.roads) { ctx.beginPath(); ctx.moveTo(road[0].x, road[0].y); for (let i = 1; i < road.length; i++) ctx.lineTo(road[i].x, road[i].y); ctx.stroke(); }
    ctx.strokeStyle = pal.coral; ctx.lineWidth = Math.max(40, 2.5 / k);
    const xs = Math.max(80, 7 / k);
    for (const m of world.marks) if (!S.marksDug[m.cx + ',' + m.cy]) { ctx.beginPath(); ctx.moveTo(m.x - xs, m.y - xs * 0.75); ctx.lineTo(m.x + xs, m.y + xs * 0.75); ctx.moveTo(m.x + xs, m.y - xs * 0.75); ctx.lineTo(m.x - xs, m.y + xs * 0.75); ctx.stroke(); }
  }
  // Fast travel: sail straight to an island you have landed on before, or home. It takes time.
  function travelHours(x, y) { return Math.max(0.5, Math.min(8, Math.round(Math.hypot(x - car.x, y - car.y) / 15000 * 2) / 2)); }
  function travelTo(dest) {
    const h = travelHours(dest.x, dest.y);
    car.x = dest.x; car.y = dest.y; car.vx = 0; car.vy = 0; cam.x = car.x; cam.y = car.y - 30;
    S.time += h; S.pos = { x: car.x, y: car.y };
    ui.closeAll();
    ui.toast('You sail to ' + dest.name + '. ' + h + ' hour' + (h === 1 ? '' : 's') + ' at sea.', pal.teal);
    RB.audio.play('whoosh');
    RB.game.save();
  }
  function destOf(sel) {
    if (sel.main) { const h = world.site.home; return { x: h.x, y: h.y + 160, name: 'home' }; }
    const is = sel.is, s = is.sites[0];
    return s ? { x: s.x, y: s.y + 170, name: is.name } : { x: is.x, y: is.y, name: is.name };
  }
  function bigMap() {
    const sea = ST.openSea(S), boat = sea && ST.hasBoat(S);
    const MV = { x: car.x, y: car.y, k: 0 };
    let drag = null, pinch = null, sel = null, panel = false, islCache = null;
    ui.open({ draw(u, dt) {
      const v = ui.view, ctx = ui.ctx, box = ui.window(sea ? 'Map and sea chart' : 'Map', v.w - 16, v.h - 16, {});
      if (!box) return;
      const wide = box.w >= 560, side = wide && panel ? 220 : 0;
      const A = { x: box.x, y: box.y + 36, w: box.w - side - (side ? 8 : 0), h: box.h - 36 - 40 };
      // how far it zooms: from the whole of the waters round you to a close look at a village
      const fit = Math.min(A.w / WD.W, A.h / WD.H) * 0.95, kMin = sea ? Math.min(A.w, A.h) / 65000 : fit, kMax = Math.min(A.w, A.h) / 1200;
      if (!MV.k) { if (sea && !WD.inMain(car.x, car.y)) MV.k = Math.min(A.w, A.h) / 40000; else { MV.k = fit; MV.x = WD.W / 2; MV.y = WD.H / 2; } }
      const zoomAt = (f, px, py) => {
        const k2 = clamp(MV.k * f, kMin, kMax), wx = MV.x + (px - (A.x + A.w / 2)) / MV.k, wy = MV.y + (py - (A.y + A.h / 2)) / MV.k;
        MV.x = wx - (px - (A.x + A.w / 2)) / k2; MV.y = wy - (py - (A.y + A.h / 2)) / k2; MV.k = k2;
      };
      const inA = (px, py) => px >= A.x && px <= A.x + A.w && py >= A.y && py <= A.y + A.h && !(panel && !wide);
      // the wheel zooms where the mouse is; one finger drags, two pinch
      if (input.wheel && inA(input.mx, input.my)) zoomAt(Math.pow(1.25, -input.wheel), input.mx, input.my);
      const ps = input.ptrs.filter((p) => inA(p.sx, p.sy));
      if (ps.length >= 2) {
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), mx = (ps[0].x + ps[1].x) / 2, my = (ps[0].y + ps[1].y) / 2;
        if (pinch) { zoomAt(d / Math.max(1, pinch.d), mx, my); MV.x -= (mx - pinch.mx) / MV.k; MV.y -= (my - pinch.my) / MV.k; }
        pinch = { d, mx, my }; drag = null;
      } else {
        pinch = null;
        const p = ps[0];
        if (p) { if (drag && drag.id === p.id) { MV.x -= (p.x - drag.x) / MV.k; MV.y -= (p.y - drag.y) / MV.k; } drag = { id: p.id, x: p.x, y: p.y }; } else drag = null;
      }
      // before the sea opens there is only the mainland to look at
      if (!sea) { MV.x = clamp(MV.x, 0, WD.W); MV.y = clamp(MV.y, 0, WD.H); }
      const k = MV.k, cx = A.x + A.w / 2, cy = A.y + A.h / 2, sx = (x) => cx + (x - MV.x) * k, sy = (y) => cy + (y - MV.y) * k;
      const reach = Math.hypot(A.w, A.h) / 2 / k + 3000;
      // a tap picks an island (or the mainland) to read about or sail to
      for (const tp of input.taps) {
        if (tp.used || !inA(tp.x, tp.y)) continue;
        tp.used = true;
        const wx = MV.x + (tp.x - cx) / k, wy = MV.y + (tp.y - cy) / k;
        const is = sea ? RB.sea.islandsNear(world, wx, wy, 6 / k + 500).filter((q) => Math.hypot(q.x - wx, q.y - wy) < q.R + 8 / k).sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))[0] : null;
        sel = is ? { is } : WD.inMain(wx, wy) || WD.biomeAt(world, wx, wy) === 'coast' && Math.abs(wx - WD.W / 2) < WD.W ? { main: true } : null;
      }
      // ---- the picture
      ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
      ctx.fillStyle = WD.BIOMES.water.ground; ctx.fillRect(A.x, A.y, A.w, A.h);
      ctx.save(); ctx.translate(sx(0), sy(0)); ctx.scale(k, k); drawMainland(ctx, k); ctx.restore();
      // the islands in view (looked up again only once the view has moved a fair way)
      const ck = Math.round(MV.x / 1500) + ',' + Math.round(MV.y / 1500) + ',' + Math.round(reach / 1500);
      if (!islCache || islCache.k !== ck) islCache = { k: ck, list: sea ? RB.sea.islandsNear(world, MV.x, MV.y, reach + 1500) : [] };
      const onScreen = (is) => { const px = sx(is.x), py = sy(is.y), r = is.R * k + 12; return px > A.x - r && px < A.x + A.w + r && py > A.y - r && py < A.y + A.h + r; };
      const isl = islCache.list.filter(onScreen);
      for (const is of isl) {
        if (is.R * k > 18) { // close enough to see its shape, lands and tracks
          const ip = islandPath(is);
          ctx.save(); ctx.translate(sx(0), sy(0)); ctx.scale(k, k);
          ctx.fillStyle = WD.BIOMES.coast.ground; ctx.fill(ip.shape); ctx.fillStyle = WD.BIOMES[is.main].ground; ctx.fill(ip.inner);
          for (const q of ip.patches) { ctx.save(); ctx.clip(ip.inner); ctx.fillStyle = WD.BIOMES[q[0]].ground; ctx.fill(q[1]); ctx.restore(); }
          ctx.strokeStyle = '#dcccaa'; ctx.lineWidth = Math.max(60, 3 / k); ctx.lineCap = 'round';
          for (const road of is.roads) { ctx.beginPath(); ctx.moveTo(road[0].x, road[0].y); for (let i = 1; i < road.length; i++) ctx.lineTo(road[i].x, road[i].y); ctx.stroke(); }
          ctx.restore();
        } else {
          ctx.fillStyle = WD.BIOMES.coast.ground; ctx.beginPath(); ctx.arc(sx(is.x), sy(is.y), Math.max(2.5, is.R * k), 0, TAU); ctx.fill();
          ctx.fillStyle = WD.BIOMES[is.main].ground; ctx.beginPath(); ctx.arc(sx(is.x), sy(is.y), Math.max(1.5, is.R * 0.84 * k), 0, TAU); ctx.fill();
        }
        if (ST.canSail(S, is)) { ctx.strokeStyle = pal.teal; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(is.x), sy(is.y), Math.max(4, is.R * k) + 3, 0, TAU); ctx.stroke(); }
      }
      if (sel && sel.is) { ctx.strokeStyle = pal.mustard; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx(sel.is.x), sy(sel.is.y), Math.max(6, sel.is.R * k) + 7, 0, TAU); ctx.stroke(); }
      // places, and their names once there is room to read them
      const taken = [];
      const label = (txt, x, y, o) => { const w = ui.width(txt, o.size || 10), lx = x - w / 2, ly = y - 12; if (taken.some((q) => lx < q.x + q.w && q.x < lx + w && ly < q.y + 13 && q.y < ly + 13)) return; taken.push({ x: lx, y: ly, w }); ui.text(txt, x, y, Object.assign({ align: 'center' }, o)); };
      for (const s of world.sites) {
        if (s.island && !sea) continue;
        const px = sx(s.x), py = sy(s.y);
        if (px < A.x - 20 || px > A.x + A.w + 20 || py < A.y - 20 || py > A.y + A.h + 20) continue;
        if (s.island && k < 0.012) continue;
        if (s.kind === 'house') { ui.rect(px - 3, py - 3, 6, 6, pal.brick, 1); continue; }
        const col = s.kind === 'arena' ? pal.coral : s.id === 'home' ? pal.teal : s.id === 'bfc' ? '#d7372f' : s.id === 'roost' ? pal.plum : s.id === 'quarry' ? pal.mustard : pal.ink;
        ui.rect(px - 5, py - 5, 10, 10, col, 3);
        if (k > 0.03 || (!s.island && k >= fit * 0.9)) label(s.name, px, py - 8, { size: 10 });
      }
      if (sea) for (const is of isl.slice().sort((a, b) => b.R - a.R)) {
        const arena = is.sites.some((q) => q.kind === 'arena');
        if (is.R * k > 7 || (arena && is.R * k > 3.5) || is === (sel && sel.is)) label(is.name + (arena ? ' · arena' : ''), sx(is.x), sy(is.y) - Math.max(6, is.R * k) - 3, { size: 9, bold: arena });
      }
      // markers switched on
      for (const cat of GD.on(S)) {
        const c = GD.categories().find((q) => q.id === cat);
        if (!c || (c.sea && !sea)) continue;
        for (const m of GD.find(world, S, cat, MV.x, MV.y, reach, sea)) {
          const px = sx(m.x), py = sy(m.y);
          if (px < A.x || px > A.x + A.w || py < A.y || py > A.y + A.h) continue;
          const col = MARKER_COL[c.group] || pal.ink;
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 6, py - 12); ctx.arc(px, py - 15, 7, Math.PI * 0.8, Math.PI * 0.2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = pal.white; ctx.beginPath(); ctx.arc(px, py - 15, 3, 0, TAU); ctx.fill();
          if (k > 0.004) label(c.label.replace(/ fossils$/, ''), px, py - 26, { size: 9, color: col, bold: true });
        }
      }
      ctx.restore();
      ui.icon(car.boat ? 'truck' : 'truck', sx(car.x), sy(car.y), 18, pal.coral);
      // ---- the controls: zoom, back to the truck, back to the mainland, markers
      const bw = 40, by = box.y, roomy = box.w >= 400, nw = roomy ? 84 : 44;
      let bx = box.x;
      const ctl = (w, label, o) => { const hit = ui.btn(bx, by, w, 30, label, Object.assign({ size: 12, flat: true }, o)); bx += w + 6; return hit; };
      if (ctl(bw, '', { icon: 'plus', fill: pal.ink })) zoomAt(1.6, cx, cy);
      if (ctl(bw, '', { icon: 'minus', fill: pal.ink })) zoomAt(1 / 1.6, cx, cy);
      if (ctl(nw, roomy ? 'Truck' : '', { icon: 'truck', fill: pal.coral })) { MV.x = car.x; MV.y = car.y; if (MV.k < 0.01) MV.k = Math.min(kMax, Math.max(MV.k, Math.min(A.w, A.h) / 20000)); }
      // the mainland, all of it, picked: from far out at sea, one tap and "Sail there"
      if (ctl(nw, roomy ? 'Home' : '', { icon: 'home', fill: pal.teal })) { MV.x = WD.W / 2; MV.y = WD.H / 2; MV.k = clamp(fit, kMin, kMax); sel = { main: true }; RB.audio.play('click'); }
      if (ctl(104, 'Markers' + (GD.on(S).length ? ' (' + GD.on(S).length + ')' : ''), { icon: 'eye', fill: panel ? pal.mustard : pal.plum, color: panel ? pal.ink : pal.white })) panel = !panel;
      // ---- the bottom line: what is picked, and fast travel
      const fy = box.y + box.h - 34;
      if (sel) {
        const here = sel.is ? RB.sea.islandAt(world, car.x, car.y) === sel.is : WD.inMain(car.x, car.y);
        const txt = sel.is ? sel.is.name + ': ' + RB.sea.describe(sel.is) + (ST.canSail(S, sel.is) ? '' : ' · not landed on yet') : 'The mainland: home, the town and the five arenas.';
        const can = boat && !here && (sel.main || ST.canSail(S, sel.is));
        const d = can ? destOf(sel) : null;
        ui.text(txt, box.x, fy + 21, { size: 11, bold: false, maxW: box.w - (can ? 190 : 4) });
        if (can && ui.btn(box.x + box.w - 180, fy, 180, 32, 'Sail there · ' + travelHours(d.x, d.y) + ' h', { icon: 'right', fill: pal.teal, size: 12 })) travelTo(d);
      } else ui.text(sea ? (S.sandbox ? 'Drag to look around, pinch or scroll to zoom. Tap any island to sail there.' : 'Drag to look around, pinch or scroll to zoom. Tap an island you have landed on (ringed) to sail there.') : 'Drag to look around, pinch or scroll to zoom. Red crosses mark something buried.', box.x, fy + 21, { size: 11, bold: false, maxW: box.w });
      // ---- the markers panel
      if (panel) {
        const P = wide ? { x: box.x + box.w - 220, y: A.y, w: 220, h: A.h } : { x: A.x, y: A.y, w: A.w, h: A.h }; // (fixed width: it may have opened this very frame)
        ui.rect(P.x, P.y, P.w, P.h, pal.paper, 10);
        const cats = GD.categories().filter((c) => !c.sea || sea), rows = [];
        let g = null;
        for (const c of cats) { if (c.group !== g) { g = c.group; rows.push({ head: g }); } rows.push({ c }); }
        ui.list('markers', P.x + 4, P.y + 4, P.w - 8, P.h - 8, rows.length, 32, (i, x, y, w) => {
          const r = rows[i];
          if (r.head) { ui.text(r.head, x + 4, y + 22, { size: 12, color: MARKER_COL[r.head] }); return; }
          const onNow = !!S.markers[r.c.id];
          if (ui.btn(x, y + 2, w - 6, 28, r.c.label, { fill: onNow ? MARKER_COL[r.c.group] : pal.soft, color: onNow ? pal.white : pal.ink, size: 11, flat: true, icon: onNow ? 'check' : null })) { S.markers[r.c.id] = !onNow; RB.audio.play('click'); }
        });
      }
    } });
  }
})();
