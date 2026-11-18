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

  let S, pw, birds, cam, parts, acc, selected, grab, cand, rng, lay, pan, t, hit, bedBox, ev, evT;
  const BED_Y = -46, BED_MAX = 380;

  function layout() {
    const n = ST.nestCount(S);
    lay = { truck: -250, feeder: -60, nests: [], dummy: null };
    lay.bedR = lay.truck + 18; lay.house = lay.bedR - BED_MAX - 150; lay.left = lay.house - 120;
    for (let i = 0; i < n; i++) lay.nests.push(80 + i * 150);
    let x = 80 + n * 150;
    if (S.up.dummy) { lay.dummy = x - 10; x += 120; }
    lay.box = x + 20; lay.fame = lay.box + 140; lay.right = lay.fame + 90; lay.walk0 = lay.truck + 90; lay.walk1 = lay.box - 80;
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


  // ---- habits and little happenings (all for show: nothing here touches the save)
  const walkSp = (P, k) => Math.min(P.speedMax * k, 40 + P.speedMax * k * 0.3);
  // Head for x; true once there.
  function goTo(e, x, k) {
    const rag = e.rag, dx = x - rag.midX();
    if (Math.abs(dx) < 12) { rag.vxDes = 0; return true; }
    const dir = Math.sign(dx); if (dir !== rag.f && !rag.act) rag.flip();
    rag.vxDes = dir * walkSp(e.P, k);
    return false;
  }
  function face(e, x) { const dir = Math.sign(x - e.rag.midX()) || 1; if (dir !== e.rag.f && !e.rag.act) e.rag.flip(); }
  function sing(e) { if (!e.c.person) RB.audio.voice(e.P.voice, 'crow'); e.say = { text: '♪ ♫', t: 1.8 }; e.rag.wingV = 10; }
  // Shoo a bird a little way off from x.
  function startle(o, fromX) {
    if (o.c.visitor) { o.mode = 'leave'; if ((o.rag.midX() < fromX ? -1 : 1) !== o.rag.f && !o.rag.act) o.rag.flip(); return; }
    if (o.mode === 'dispute' || o.mode === 'curio') return;
    o.mode = 'walk'; o.tx = clamp(o.rag.midX() + (o.rag.midX() < fromX ? -1 : 1) * rng.range(110, 220), lay.walk0, lay.walk1); o.t = 3;
    if (!o.c.person && rng.chance(0.5)) RB.audio.voice(o.P.voice, 'squawk');
    spark(o.rag.midX(), o.rag.midY() - o.P.TD * 0.5, 'feather', 2, o.P.css.body);
  }
  function startQuirk(e, q) {
    const yard = birds.filter((o) => o !== e && !inBed(o.c) && o.rag.state === 'stand');
    if (q === 'circles') { e.mode = 'circle'; e.t = rng.range(3, 6); e.qT = 0; e.qDir = e.rag.f; return true; }
    if (q === 'chaser') { const tg = yard.filter((o) => !o.c.person); if (!tg.length) return false; e.mode = 'chase'; e.target = rng.pick(tg); e.t = rng.range(3, 5); return true; }
    if (q === 'grudge') { const tc = ST.grudgeTarget(e.c, yard.map((o) => o.c)); if (!tc) return false; e.mode = 'pester'; e.target = yard.find((o) => o.c === tc); e.t = rng.range(4, 6); return true; }
    if (q === 'starer') { const spots = [lay.feeder, lay.house + 90, lay.box, lay.truck + 60].concat(lay.nests, lay.dummy !== null ? [lay.dummy] : []); e.mode = 'stare'; e.sx = rng.pick(spots); e.sx2 = clamp(e.sx + (e.rag.midX() < e.sx ? -70 : 70), lay.walk0, lay.walk1); e.t = rng.range(6, 11); return true; }
    if (q === 'singer') { sing(e); e.mode = 'idle'; e.t = rng.range(2, 4); return true; }
    return false;
  }
  // Odd things a bird may come across in the yard.
  const CURIOS = [['a bottle cap', '#c9c2b2', 'disc'], ['an odd sock', '#e76f51', 'sock'], ['a rubber duck', '#f2c14e', 'duck'], ['a glass marble', '#6fa8c9', 'ball'], ['a rusty key', '#a0522d', 'key'],
    ['a toy soldier', '#3d6fa5', 'stick'], ['a shiny pebble', '#dfe7ee', 'ball'], ['a tiny trophy', '#f2c14e', 'cup'], ['a fortune cookie', '#e2b862', 'disc'], ['a lost earring', '#c9a227', 'ring'], ['a mysterious egg-shaped stone', '#8b97a8', 'egg']];
  const CURIO_END = ['Hmph.', 'Mine!', '?!', '...', 'Boring.', 'Ooh.', 'Hm.'];
  function startEvent(kind) {
    const yard = birds.filter((e) => !inBed(e.c) && !e.c.person && !e.c.visitor && e.rag.state === 'stand' && e.mode !== 'dispute');
    kind = kind || rng.weighted([['dispute', 3], ['invader', 3], ['curio', 4]], (q) => q[1])[0];
    if (kind === 'dispute') {
      if (yard.length < 2) return false;
      const a = rng.pick(yard), b = rng.pick(yard.filter((o) => o !== a));
      ev = { kind, a, b, t: 7, mid: clamp((a.rag.midX() + b.rag.midX()) / 2, lay.walk0 + 70, lay.walk1 - 70), gap: (a.P.TL + b.P.TL) * 0.45 + 18 };
      a.mode = 'dispute'; b.mode = 'dispute';
      ui.toast(a.c.name + ' and ' + b.c.name + ' square off over a patch of the yard.', pal.brick);
      RB.audio.voice(a.P.voice, 'squawk');
      return true;
    }
    if (kind === 'invader') {
      const sp = rng.weighted(RB.world.FAUNA.farm.day.concat(RB.world.FAUNA.wetland.day), (q) => q[1])[0];
      const g = RB.species.make(sp, rng, { sport: 0.05 }), nm = RB.species.nameOf(RB.species.SPECIES[sp], g.sex).toLowerCase();
      const c = { id: -1 - rng.int(1, 1e6), name: 'A wild ' + nm, g, age: 60, train: { muscle: 0, lungs: 0, reflex: 0, courage: 0 }, cond: 1, hp: 1, fed: true, visitor: true, at: 'home', person: null, hat: null };
      const v = mkRag(c, lay.walk1);
      v.mode = 'walk'; v.tx = rng.range(lay.walk0 + 100, lay.walk1 - 60); v.t = 4; v.visits = rng.int(2, 3);
      ev = { kind, v, t: 22 };
      ui.toast((/^[aeiou]/.test(nm) ? 'An ' : 'A ') + nm + ' wanders into the yard.', pal.teal);
      return true;
    }
    if (kind === 'curio') {
      if (!yard.length) return false;
      const o = rng.pick(CURIOS), finder = yard.find((e) => ST.quirkOf(S, e.c) === 'starer') || rng.pick(yard);
      ev = { kind, o, x: rng.range(lay.walk0 + 40, lay.walk1 - 40), finder, t: 12, found: false };
      finder.mode = 'curio';
      ui.toast(finder.c.name + ' has found ' + o[0] + '.', pal.plum);
      return true;
    }
    return false;
  }
  function endDispute() {
    for (const e of [ev.a, ev.b]) if (birds.includes(e) && e.mode === 'dispute') { e.mode = 'walk'; e.tx = clamp(e.rag.midX() + (e === ev.a ? -1 : 1) * rng.range(100, 200), lay.walk0, lay.walk1); e.t = 3; }
    ev = null;
  }
  function updateEvent(dt) {
    ev.t -= dt;
    if (ev.kind === 'dispute') {
      if (!birds.includes(ev.a) || !birds.includes(ev.b) || inBed(ev.a.c) || inBed(ev.b.c) || ev.t <= 0) endDispute();
    } else if (ev.kind === 'invader') {
      const v = ev.v;
      if (!birds.includes(v) || v.gone || ev.t < -12) {
        if (birds.includes(v)) { spark(v.rag.midX(), v.rag.midY(), 'poof', 4); dropRag(v); }
        for (const e of birds) if (e.target === v) { e.mode = 'idle'; e.target = null; e.t = 1; }
        ev = null; return;
      }
      if (ev.t <= 0 && v.mode !== 'leave') { v.mode = 'leave'; if (v.rag.f < 0 && !v.rag.act) v.rag.flip(); }
      // the flock takes notice; the bolder ones see it off
      for (const e of birds) {
        if (e === v || inBed(e.c) || e.mode !== 'idle' || e.rag.state !== 'stand' || e.c.person) continue;
        const dx = v.rag.midX() - e.rag.midX();
        if (Math.abs(dx) < 260 && rng.chance(dt * 2)) face(e, v.rag.midX());
        if (Math.abs(dx) < 220 && e.P.aggression > 0.7 && rng.chance(dt * 0.3)) { e.mode = 'chase'; e.target = v; e.t = 3; }
      }
    } else if (ev.kind === 'curio') {
      if (!birds.includes(ev.finder) || ev.t <= 0) {
        spark(ev.x, -8, 'poof', 3);
        if (birds.includes(ev.finder) && ev.finder.mode === 'curio') { ev.finder.mode = 'idle'; ev.finder.t = 1; ev.finder.say = { text: rng.pick(CURIO_END), t: 2.2 }; }
        ev = null;
      }
    }
  }
  // A visiting wild bird: wanders to a spot or two, then leaves the way it came.
  function visitorThink(e, dt) {
    const rag = e.rag; e.t -= dt;
    if (e.mode === 'leave') { rag.vxDes = rag.f * walkSp(e.P, 0.55); if (rag.midX() > lay.right - 30 || rag.midX() < lay.left + 40) e.gone = true; return; }
    if (e.mode !== 'walk' || e.t <= 0) {
      if (e.visits-- <= 0) { e.mode = 'leave'; if (rag.f < 0 && !rag.act) rag.flip(); return; }
      e.mode = 'walk'; e.tx = rng.range(lay.walk0 + 60, lay.walk1 - 40); e.t = rng.range(3, 5);
    }
    if (goTo(e, e.tx, 0.35) && !rag.act && rng.chance(dt)) rag.startPeck(() => ({ x: rag.C.x + rag.f * (e.P.NL * 0.6 + 8), y: -2 }));
  }
  // A bird in one of the special moods above. Returns true if it took charge this frame.
  function moodThink(e, dt) {
    const rag = e.rag, P = e.P;
    if (e.mode === 'dispute' && ev && ev.kind === 'dispute') {
      const other = e === ev.a ? ev.b : ev.a, side = e === ev.a ? -1 : 1;
      if (goTo(e, ev.mid + side * ev.gap, 0.45)) {
        face(e, other.rag.midX()); rag.eye = 'angry';
        if (!rag.act && rng.chance(dt * 1.6)) { rag.wingV = 14; if (rng.chance(0.5)) rag.startPeck(() => ({ x: other.rag.head.x, y: other.rag.head.y })); }
        if (rng.chance(dt * 1.2)) spark((rag.midX() + other.rag.midX()) / 2, rag.midY() - P.TD * 0.4, 'feather', 1, rng.chance(0.5) ? P.css.body : other.P.css.body);
        if (rng.chance(dt * 0.4) && !e.c.person) RB.audio.voice(P.voice, 'squawk');
      }
      return true;
    }
    if (e.mode === 'curio' && ev && ev.kind === 'curio' && ev.finder === e) {
      const side = rag.midX() < ev.x ? -1 : 1;
      if (goTo(e, ev.x + side * (P.TL * 0.5 + 14), 0.4)) {
        face(e, ev.x);
        if (!ev.found) { ev.found = true; e.say = { text: '?', t: 1.5 }; }
        if (!rag.act && rng.chance(dt * 0.9)) rag.startPeck(() => ({ x: ev.x, y: -3 }));
      }
      return true;
    }
    return false;
  }

  function think(e, dt) {
    const rag = e.rag, P = e.P;
    e.blink -= dt; if (e.blink < -0.12) e.blink = rng.range(1.5, 6);
    e.voice -= dt;
    if (e.voice < 0) { e.voice = rng.range(8, 30); if (birds.length && !e.c.person && rng.chance(0.5)) RB.audio.voice(P.voice, 'cluck'); }
    if (e.say) { e.say.t -= dt; if (e.say.t <= 0) e.say = null; }
    if (rag.state !== 'stand') { rag.vxDes = 0; return; }
    if (e.c.visitor) { rag.eye = e.blink < 0 ? 'blink' : ''; visitorThink(e, dt); return; }
    const asleep = S.time >= 20 && !e.c.person;
    rag.crouchT = asleep ? 0.55 : 1;
    rag.eye = asleep ? 'sleep' : e.blink < 0 ? 'blink' : '';
    const habit = ST.quirkOf(S, e.c);
    if (asleep) { if (habit === 'singer' && rng.chance(dt * 0.05)) sing(e); rag.vxDes = 0; return; } // the night singer
    const bed = inBed(e.c), m = Math.min(P.TL * 0.5 + 6, lay.bedLen / 2 - 1);
    const lo = bed ? bedL() + m : lay.walk0, hi = bed ? lay.bedR - m : lay.walk1, floorY = bed ? BED_Y : 0;
    if (!bed && moodThink(e, dt)) return;
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
    if (e.t <= 0 && !bed && habit && rng.chance(0.32) && startQuirk(e, habit)) { /* its own little ways */ }
    else if (e.t <= 0) {
      e.target = null;
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
    } else if (e.mode === 'circle') { // round and round (side-on: about-turn after about-turn)
      e.qT -= dt;
      const x = rag.midX();
      if (e.qT <= 0 || (x < lo + 20 && e.qDir < 0) || (x > hi - 20 && e.qDir > 0)) { e.qDir = -e.qDir; e.qT = rng.range(0.4, 0.8); }
      if (e.qDir !== rag.f && !rag.act) rag.flip();
      rag.vxDes = e.qDir * walkSp(P, 0.3);
    } else if (e.mode === 'chase' || e.mode === 'pester') {
      const o = e.target;
      if (!o || !birds.includes(o) || inBed(o.c)) { e.mode = 'idle'; e.target = null; rag.vxDes = 0; return; }
      const near = Math.abs(o.rag.midX() - rag.midX()) < P.TL * 0.6 + o.P.TL * 0.5 + 12;
      if (!near) goTo(e, o.rag.midX(), e.mode === 'chase' ? 0.6 : 0.4);
      else {
        rag.vxDes = 0; face(e, o.rag.midX());
        if (e.mode === 'pester') { rag.eye = 'angry'; if (!rag.act && rng.chance(dt * 1.5)) { rag.startPeck(() => ({ x: o.rag.C.x, y: o.rag.C.y })); if (rng.chance(0.4)) e.say = { text: '!', t: 1 }; if (rng.chance(0.5)) startle(o, rag.midX()); } }
        else startle(o, rag.midX());
      }
    } else if (e.mode === 'stare') { // fixed on something, for ages
      if (goTo(e, e.sx2, 0.35)) { face(e, e.sx); if (!e.say && rng.chance(dt * 0.25)) e.say = { text: rng.pick(['...', '?', '!?']), t: 1.4 }; }
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
  // The wardrobe: one thing per place (head, face, neck, back, feet, tail) and one piece of
  // fighting kit. What comes off goes back in the bag.
  function wear(c) {
    const IT = RB.items, SL = IT.SLOTS;
    ui.open({ draw() {
      const v = ui.view, items = ST.owned(S).filter((id) => SL.includes(IT.ITEMS[id].kind)).sort((a, b) => SL.indexOf(IT.ITEMS[a].kind) - SL.indexOf(IT.ITEMS[b].kind) || IT.ITEMS[a].name.localeCompare(IT.ITEMS[b].name));
      const box = ui.window('What ' + c.name + ' wears', 440, Math.min(v.h - 16, 560), {});
      if (!box) return;
      common.portrait(c, box.x, box.y, 96, 96, { fill: pal.soft });
      const worn = SL.filter((sl) => ST.wornIn(c, sl)), tx = box.x + 106, tw = box.w - 106;
      if (!worn.length) ui.text('Wearing nothing yet.', tx, box.y + 16, { size: 13, bold: false, color: pal.grey });
      const per = Math.max(2, Math.floor((tw + 6) / 150));
      worn.forEach((sl, i) => {
        const id = ST.wornIn(c, sl), x = tx + (i % per) * ((tw + 6) / per), y = box.y + Math.floor(i / per) * 24, w = (tw + 6) / per - 6;
        ui.rect(x, y, w, 21, pal.soft, 8); ui.itemIcon(id, x + 11, y + 10.5, 15);
        ui.text(IT.ITEMS[id].name, x + 22, y + 15, { size: 10, maxW: w - 44 });
        if (ui.btn(x + w - 20, y + 2, 18, 17, '', { icon: 'close', fill: pal.grey, flat: true, r: 6 })) { ST.unwear(S, c, sl); RB.audio.play('click'); RB.game.save(); }
      });
      if (worn.length && ui.btn(tx, box.y + 74, 110, 26, 'Take all off', { fill: pal.grey, size: 11, flat: true })) { for (const sl of SL) ST.unwear(S, c, sl); RB.audio.play('click'); RB.game.save(); }
      if (!items.length) { ui.para('Nothing to wear in the bag. Madame Odete sells hats, glasses, ties, capes and shoes in town; some pieces are won through feats.', box.x, box.y + 112, box.w, { size: 12, color: pal.grey }); return; }
      ui.list('wear', box.x, box.y + 106, box.w, box.h - 106, items.length, 50, (i, x, y, w) => {
        const it = IT.ITEMS[items[i]], on = ST.wornIn(c, it.kind);
        ui.rect(x, y + 2, w - 6, 44, pal.soft, 10); ui.itemIcon(it.id, x + 24, y + 24, 26);
        ui.text(it.name + '  ·  ' + IT.SLOT_NAMES[it.kind] + (ST.endless(S, it.id) ? '' : ' (' + ST.count(S, it.id) + ')'), x + 46, y + 20, { size: 13, maxW: w - 130 });
        ui.text(it.desc, x + 46, y + 36, { size: 10, bold: false, maxW: w - 130, color: it.kind === 'gear' ? pal.teal : pal.grey });
        if (ui.btn(x + w - 78, y + 7, 66, 34, on ? 'Swap' : 'Wear', { size: 12, fill: it.kind === 'gear' ? pal.teal : pal.plum })) {
          const why = ST.wear(S, c, it.id);
          if (why) ui.toast(why, pal.coral); else { RB.audio.play('click'); RB.game.save(); }
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


  // ---- the Hall of Fame: a board by the gate with the birds that made your story
  const fameP = new Map();
  function famePheno(e) {
    const k = e.id + ':' + e.age + ':' + e.g.a.slice(0, 24);
    let P = fameP.get(k);
    if (!P) { P = RB.pheno.express(RB.genome.deserialize(e.g), { age: e.age }); fameP.set(k, P); }
    return P;
  }
  function hallWindow() {
    ST.fameCheck(S);
    let tab = 'all';
    ui.open({ draw() {
      const v = ui.view, all = S.fame.slice().sort((a, b) => ST.fameRank(b) - ST.fameRank(a));
      const box = ui.window('Hall of Fame', 520, Math.min(v.h - 16, 620), {});
      if (!box) return;
      // the tabs, in as many rows as the width needs
      const tabs = ST.FAME_TABS, per = Math.max(3, Math.min(tabs.length, Math.floor((box.w + 6) / 96))), tw = (box.w - (per - 1) * 6) / per;
      tabs.forEach(([id, label], i) => {
        const x = box.x + (i % per) * (tw + 6), y = box.y + Math.floor(i / per) * 36, n = all.filter((e) => ST.fameIn(e, id)).length;
        if (ui.btn(x, y, tw, 30, label + (id !== 'all' && n ? ' ' + n : ''), { fill: tab === id ? pal.ink : pal.soft, color: tab === id ? pal.white : pal.ink, size: 12, flat: true })) { tab = id; RB.audio.play('click'); }
      });
      let y0 = box.y + Math.ceil(tabs.length / per) * 36 + 4;
      const list = all.filter((e) => ST.fameIn(e, tab));
      if (tab === 'records' || tab === 'all') {
        const recs = ST.RECORDS.map(([, name]) => { const e = all.find((q) => q.titles.includes(name)); return e ? name.slice(8) + ': ' + e.name : null; }).filter(Boolean);
        ui.text(recs.length ? 'Records · ' + recs.join(' · ') : 'No records set yet.', box.x, y0 + 8, { size: 11, color: pal.plum, maxW: box.w });
        y0 += 18;
      }
      if (!list.length) {
        const why = { all: 'Nobody here yet. Birds you fight with, enter in the sideshow, or catch with outstanding numbers can earn a place: as champions, record holders, veterans, sideshow stars, wild talents or birds with a story. Birds born on your islands do not.',
          champions: 'No arena champions yet.', fighters: 'No veterans yet: ten wins in the ring, or a fighter that retired with three.', records: 'No records yet.', sideshow: 'No sideshow stars yet: three wins at the sideshow.',
          wild: 'No wild talents yet: a bird caught with numbers few of its kind ever have.', stories: 'No curious stories yet.' }[tab];
        ui.para(why, box.x, y0 + 8, box.w, { size: 13 }); return;
      }
      ui.list('hall' + tab, box.x, y0, box.w, box.y + box.h - y0, list.length, 66, (i, x, y, w) => {
        const e = list[i];
        ui.rect(x, y + 2, w - 6, 60, e.gone ? '#ece3cf' : pal.soft, 10);
        common.portrait({ P: famePheno(e) }, x + 4, y + 6, 52, 52, { fill: pal.paper, draw: { hat: e.hat, acc: e.acc } });
        if (e.titles.some((q) => q.startsWith('Champion'))) ui.icon('trophy', x + 50, y + 12, 13, pal.mustard);
        const shown = tab === 'all' ? e.titles : e.titles.filter((q) => ST.fameTabOf(q) === tab).concat(e.titles.filter((q) => ST.fameTabOf(q) !== tab));
        ui.text(e.name + '  ·  ' + e.kind, x + 64, y + 21, { size: 14, maxW: w - 150 });
        ui.text(shown.slice(0, 2).join(' · ') + (shown.length > 2 ? ' · +' + (shown.length - 2) : ''), x + 64, y + 38, { size: 11, color: pal.plum, maxW: w - 150 });
        ui.text(e.wins + '–' + e.losses + (e.shows ? '  ·  sideshow ' + (e.showWins || 0) + '/' + e.shows : '') + '  ·  ' + e.status, x + 64, y + 54, { size: 10, bold: false, color: pal.grey, maxW: w - 150 });
        if (ui.btn(x + w - 78, y + 15, 66, 34, 'Story', { size: 12, fill: pal.plum })) { RB.audio.play('click'); fameStory(e); }
      });
    } });
  }
  function fameStory(e) {
    ui.open({ draw() {
      const v = ui.view, box = ui.window(e.name, 480, Math.min(v.h - 16, 560), {});
      if (!box) return;
      const pw = Math.min(118, box.w * 0.34);
      common.portrait({ P: famePheno(e) }, box.x, box.y, pw, pw, { fill: pal.soft, draw: { hat: e.hat, acc: e.acc } });
      const tx = box.x + pw + 12, tw = box.w - pw - 12;
      let ty = box.y + 12;
      ui.icon(e.sex === 'M' ? 'male' : 'female', tx + 7, ty - 4, 14, e.sex === 'M' ? '#3d6fa5' : pal.coral);
      ui.text(e.kind, tx + 20, ty, { size: 14, maxW: tw - 22 }); ty += 18;
      for (const ln of ['Record ' + e.wins + '–' + e.losses + (e.shows ? '  ·  sideshow ' + (e.showWins || 0) + ' of ' + e.shows : '') + '  ·  ' + common.fmtKg(e.kg), 'Age ' + e.age + ' days  ·  in the Hall since day ' + e.since, 'Speed ' + e.speed + ' · Power ' + e.power + ' · Toughness ' + e.tough]) { ui.text(ln, tx, ty, { size: 11, bold: false, maxW: tw }); ty += 15; }
      let cx = tx;
      for (const t of e.titles) { const w = Math.min(tw, ui.width(t, 10) + 12); if (cx + w > tx + tw) { cx = tx; ty += 18; } ui.rect(cx, ty, w, 15, t.startsWith('Champion') ? pal.mustard : t.startsWith('Record') ? pal.teal : pal.plum, 7); ui.text(t, cx + 6, ty + 11, { size: 10, color: pal.white, maxW: w - 10 }); cx += w + 4; }
      const by = Math.max(box.y + pw + 10, ty + 24), lines = ui.wrap(ST.fameBio(e), box.w - 8, 12, false);
      ui.list('story' + e.id, box.x, by, box.w, box.y + box.h - by, lines.length, 17, (i, x, y) => ui.text(lines[i], x + 2, y + 13, { size: 12, bold: false }));
    } });
  }
  // The board itself: two posts, a painted sign and a gold cup, and a brass plate per famous bird.
  function drawHallBoard(ctx, x) {
    ctx.fillStyle = '#7a5236'; ctx.fillRect(x - 52, -150, 8, 150); ctx.fillRect(x + 44, -150, 8, 150);
    ctx.fillStyle = '#9a6a44'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 62, -170, 124, 92, 8) : ctx.rect(x - 62, -170, 124, 92); ctx.fill();
    ctx.fillStyle = '#b98656'; ctx.fillRect(x - 55, -163, 110, 78);
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(x - 12, -156); ctx.lineTo(x + 12, -156); ctx.lineTo(x + 8, -140); ctx.lineTo(x - 8, -140); ctx.closePath(); ctx.fill(); ctx.fillRect(x - 2, -140, 4, 6); ctx.fillRect(x - 8, -134, 16, 3);
    props.label(ctx, 'HALL OF FAME', x, -116, 11, '#3a2a1a');
    const n = Math.min(8, (S.fame || []).length);
    for (let i = 0; i < n; i++) { ctx.fillStyle = '#d9b45a'; ctx.fillRect(x - 50 + (i % 4) * 26, -104 + Math.floor(i / 4) * 9, 22, 6); }
  }

  // The odd thing found in the yard, lying on the ground at x.
  function drawCurio(ctx, o, x) {
    const col = o[1], sh = o[2];
    ctx.save(); ctx.translate(x, 0);
    ctx.fillStyle = 'rgba(35,49,74,0.15)'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col;
    if (sh === 'disc') { ctx.beginPath(); ctx.ellipse(0, -3, 9, 4, 0, 0, TAU); ctx.fill(); }
    else if (sh === 'ball') { ctx.beginPath(); ctx.arc(0, -6, 6, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-2, -8, 2, 0, TAU); ctx.fill(); }
    else if (sh === 'sock') { ctx.fillRect(-3, -18, 7, 14); ctx.beginPath(); ctx.ellipse(4, -4, 8, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -18, 7, 3); }
    else if (sh === 'duck') { ctx.beginPath(); ctx.ellipse(0, -6, 9, 6, 0, 0, TAU); ctx.arc(6, -13, 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#e76f51'; ctx.beginPath(); ctx.moveTo(10, -13); ctx.lineTo(15, -12); ctx.lineTo(10, -11); ctx.fill(); }
    else if (sh === 'key') { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(-6, -4, 4, 0, TAU); ctx.moveTo(-2, -4); ctx.lineTo(10, -4); ctx.lineTo(10, -1); ctx.moveTo(7, -4); ctx.lineTo(7, -1); ctx.stroke(); }
    else if (sh === 'stick') { ctx.fillRect(-2, -16, 4, 14); ctx.beginPath(); ctx.arc(0, -18, 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#23314a'; ctx.fillRect(-3, -4, 6, 3); }
    else if (sh === 'cup') { ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(6, -16); ctx.lineTo(3, -8); ctx.lineTo(-3, -8); ctx.closePath(); ctx.fill(); ctx.fillRect(-1, -8, 2, 5); ctx.fillRect(-5, -3, 10, 3); }
    else if (sh === 'ring') { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -5, 4, 0, TAU); ctx.stroke(); ctx.fillStyle = '#6fa8c9'; ctx.beginPath(); ctx.arc(0, -9.5, 2, 0, TAU); ctx.fill(); }
    else if (sh === 'egg') { ctx.beginPath(); ctx.ellipse(0, -8, 6, 8, 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-2, -11, 1.5, 3, 0.4, 0, TAU); ctx.fill(); }
    // a little glint so it catches the eye
    if (Math.sin(t * 4) > 0.6) { ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -20, 2, 6); ctx.fillRect(4, -18, 6, 2); }
    ctx.restore();
  }

  RB.scenes.coop = {
    enter(args) {
      S = RB.game.S; rng = new Rng((S.seed ^ S.day * 977 ^ 0xc00b) >>> 0);
      pw = new RB.physics.World(); pw.box(-4000, 0, 4000, 600);
      birds = []; parts = []; acc = 0; selected = null; grab = null; cand = null; pan = null; t = 0; hit = 0; ev = null; evT = rng.range(40, 110);
      layout();
      pw.box(-4000, -3000, lay.left - 20, 0); pw.box(lay.right + 20, -3000, 4000, 0);
      bedBox = pw.box(lay.bedR - 80, BED_Y, lay.bedR, -16);
      cam = { x: (lay.truck + lay.box) / 2 };
      rebuild();
      ST.fameCheck(S);
      RB.audio.setTune(S.time >= 19 ? 'night' : 'day');
      S.pos = null;
      if (args.intro) {
        ui.message('A coop of your own', 'Aunt Dalva left you her coop, two chickens, and a debt of $15,000 to Big Wattle.\n\nThe only trade that pays around here is the ring. Catch birds out on the map, breed the good ones, splice the strange ones at the lab, and fight your way from the Backyard Pit to the Grand Ring.\n\nNobody gets hurt for good. Mostly.', null, { ok: 'Let\'s go' });
      }
    },
    exit() { for (const e of birds.slice()) e.rag.remove(); birds = []; bedBox = null; },
    debug() { return { birds, lay, cam, zoom: zoom(), groundY: groundY(), trainPick, feederWindow, startEvent, ev: () => ev, hallWindow: () => hallWindow(), wear: (c) => wear(c) }; },

    update(dt) {
      if (common.checkBroke(S, 'coop')) return;
      t += dt; hit = Math.max(0, hit - dt * 3);
      RB.audio.setTune(S.time >= 19 ? 'night' : 'day'); // night music after dark, day music again in the morning
      const v = ui.view, z = zoom();
      // pointers: grab a bird, or pan the yard
      for (const p of input.ptrs) {
        if (p.ui) continue;
        const w = toWorld(p.x, p.y);
        if (p.fresh) {
          cand = null; pan = null;
          let best = null, bd = 1e9;
          for (const e of birds) { if (e.c.visitor) continue; const d = Math.hypot(e.rag.midX() - w.x, e.rag.midY() - w.y), r = e.P.TD * 0.8 + e.P.TL * 0.35 + 16 / z; if (d < r && d < bd) { bd = d; best = e; } }
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
        if (best && best.c.visitor) ui.toast(best.c.name + ' is only passing through.', pal.teal);
        else if (best) { if (selected) feedBird(best.c, best.rag.midX(), best.rag.midY() - best.P.TD); else { RB.audio.play('click'); common.card(best.c, actions); } }
        else if (w.x > bedL() - 10 && w.x < lay.truck + 70 && w.y > -110) truckWindow();
        else if (Math.abs(w.x - lay.feeder) < 55 && w.y > -60) { if (selected === 'grain' && ST.take(S, 'grain')) { S.feeder++; RB.audio.play('click'); } else feederWindow(); }
        else if (Math.abs(w.x - lay.box) < 60 && w.y > -90) { if (!inside('crate', 'Waiting for the BFC van')) ui.toast('The BFC pick-up box. Drop an unwanted bird in and the van takes it tonight.', pal.brick); }
        else if (lay.dummy !== null && Math.abs(w.x - lay.dummy) < 45 && w.y > -130) ui.toast('Drag a bird onto the dummy to train it.');
        else if (Math.abs(w.x - lay.fame) < 66 && w.y > -175) { RB.audio.play('click'); hallWindow(); }
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

      // now and then something happens in the yard
      evT -= dt;
      if (ev) updateEvent(dt);
      else if (evT <= 0) { evT = rng.range(75, 150); if (!ui.modals.length && !grab && S.time < 19.5 && rng.chance(0.55)) startEvent(); }
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
      for (const p of parts) { p.life -= dt * (p.kind === 'heart' ? 0.9 : p.kind === 'feather' ? 0.7 : 1.6); p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'heart' ? -20 : p.kind === 'feather' ? 30 : 120) * dt; if (p.kind === 'feather') { p.vx *= 0.97; p.rot += dt * 3; } }
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
      drawHallBoard(ctx, lay.fame);
      // the flock
      const order = birds.slice().sort((a, b) => b.P.S - a.P.S);
      for (const e of order) if ((!grab || grab.e !== e) && !inBed(e.c)) { RB.art.drawShadow(ctx, e.rag.midX(), 1, e.P.TL * 0.55); RB.art.drawCreature(ctx, e.P, e.rag.getPose(), common.drawOpts(e.c)); }
      if (grab) { RB.art.drawShadow(ctx, grab.e.rag.midX(), 1, grab.e.P.TL * 0.4); RB.art.drawCreature(ctx, grab.e.P, grab.e.rag.getPose(), common.drawOpts(grab.e.c)); }
      for (const e of birds) if (e.c.person && e.rag.state === 'stand' && Math.sin(t * 0.7 + e.c.id) > 0.92) props.label(ctx, '...', e.rag.head.x, e.rag.head.y - e.P.HR * 2.2, 16, pal.ink);
      for (const e of birds) if (e.say) props.label(ctx, e.say.text, e.rag.head.x, e.rag.head.y - e.P.HR * 2.4, 17, e.say.text[0] === '♪' ? pal.plum : pal.ink);
      if (ev && ev.kind === 'curio') drawCurio(ctx, ev.o, ev.x);
      for (const p of parts) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        if (p.kind === 'heart') { ctx.fillStyle = pal.coral; ctx.beginPath(); ctx.arc(p.x - 3, p.y, 4, 0, TAU); ctx.arc(p.x + 3, p.y, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + 2); ctx.lineTo(p.x + 7, p.y + 2); ctx.lineTo(p.x, p.y + 10); ctx.closePath(); ctx.fill(); }
        else if (p.kind === 'feather') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.text || pal.paper; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
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
