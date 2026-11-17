// common.js — pieces the scenes share: the top HUD, the sky, creature portraits, the creature
// card, pick-a-creature lists, goals and achievements.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { clamp, smooth, lerp } = RB.core;
  const ui = RB.ui, pal = RB.pal, ST = RB.state;
  const common = {};
  RB.scenes = RB.scenes || {};

  common.fmtTime = (h) => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return hh + ':' + (mm < 10 ? '0' : '') + mm; };
  common.fmtKg = (kg) => (kg < 1 ? Math.round(kg * 1000) + ' g' : kg < 10 ? kg.toFixed(1) + ' kg' : Math.round(kg) + ' kg');
  // dark from nightfall, and light again towards dawn for anyone still out after midnight
  common.night = (time) => smooth((time - 18.3) / 2.4) * (1 - smooth((time - 28.2) / 1.8));
  const rgbOf = (c) => (c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.slice(4, -1).split(',').map(Number));
  // Blend two colours given as #rrggbb or rgb(r,g,b).
  function mix(a, b, t) {
    const pa = rgbOf(a), pb = rgbOf(b);
    return 'rgb(' + pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',') + ')';
  }
  common.mix = mix;
  // Sky colours for the time of day.
  common.sky = function (time) {
    const n = common.night(time), dusk = clamp(1 - Math.abs(time - 18.6) / 1.6, 0, 1);
    return { top: mix(mix('#9fd9ea', '#f2a57b', dusk), '#1f2b4d', n), low: mix(mix('#d8f0ee', '#f7d49b', dusk), '#3a4a78', n), night: n };
  };
  common.drawOpts = (c) => ({ hat: c.hat || (c.clothes && c.clothes.hat) || null, clothes: c.clothes || null });

  // A creature in a rounded tile.
  common.portrait = function (c, x, y, w, h, o) {
    o = o || {};
    const P = c.g && c.train ? ST.pheno(c) : c.P || c;
    ui.rect(x, y, w, h, o.fill || pal.soft, 10);
    const ctx = ui.ctx;
    ctx.save(); ui.rr(ctx, x, y, w, h, 10); ctx.clip();
    RB.art.drawFitted(ctx, P, x + 4, y + 4, w - 8, h - 8, Object.assign({ time: ui.time, f: o.f || 1 }, c.g && c.train ? common.drawOpts(c) : {}, o.draw || {}));
    ctx.restore();
    return P;
  };

  // ---- top HUD: money, day and time, heat. Returns the x where it ends.
  common.hud = function (S) {
    const v = ui.view;
    let x = 8;
    const chip = (w, draw) => { ui.rect(x, 9, w, 30, pal.shadow, 15); ui.rect(x, 6, w, 30, pal.paper, 15); ui.zone(x, 6, w, 30); draw(x); x += w + 6; };
    const mw = ui.width('$' + S.money, 15) + 38;
    chip(mw, (cx) => { ui.icon('coin', cx + 16, 21, 17); ui.text('$' + S.money, cx + 29, 26, { size: 15 }); });
    const ts = 'Day ' + S.day + ' · ' + common.fmtTime(S.time), tw = ui.width(ts, 13) + 36;
    const tx = x;
    chip(tw, (cx) => { ui.icon(S.time >= 19 ? 'moon' : 'sun', cx + 15, 21, 15, S.time >= 19 ? pal.plum : pal.mustard); ui.text(ts, cx + 27, 25.5, { size: 13 }); });
    if (ui.tapIn(tx, 6, tw, 30)) { RB.audio.play('click'); common.passTime(S); }
    if (S.heat > 0 && v.w > 420) chip(74, (cx) => { ui.icon('star', cx + 14, 21, 14, pal.coral); ui.bar(cx + 26, 17, 40, 8, S.heat / 100, pal.coral); });
    return x;
  };

  // ---- passing time: the clock chip in the HUD opens this
  common.passTime = function (S) {
    ui.open({ draw() {
      const box = ui.window('Pass time', 320, 236, {});
      if (!box) return;
      ui.para('It is ' + common.fmtTime(S.time) + '. The Cellar and the Night Market open at 19:00. On the map, the clock button speeds time up.', box.x, box.y, box.w, { size: 12 });
      const wait = (to) => { S.time = Math.min(29.5, to); RB.audio.play('tick'); ui.close(); ui.toast('It is ' + common.fmtTime(S.time) + '.', pal.plum); };
      const y = box.y + box.h - 94;
      if (ui.btn(box.x, y, box.w, 42, 'Wait one hour', { icon: 'clock', disabled: S.time >= 28.9 })) wait(S.time + 1);
      if (ui.btn(box.x, y + 50, box.w, 42, S.time < 19 ? 'Wait until nightfall (19:00)' : 'It is already night', { icon: 'moon', fill: pal.plum, disabled: S.time >= 19 })) wait(19);
    } });
  };

  // ---- flat broke: off to muck out a henhouse for $50
  common.checkBroke = function (S, back) {
    if (S.money > 0 || RB.game.pending || ui.modals.length || RB.game.slot === undefined) return false;
    ui.message('Flat broke', 'Not a coin to your name. Dona Cida at Feed & Seed pays $50 to muck out her henhouse, and she is not fussy about who does it.', () => RB.game.go('chores', { back }), { ok: 'Grab a shovel', head: pal.brick });
    return true;
  };

  // ---- goals: one line telling a new player what to try next
  const GOALS = [
    ['Drive out (Map) and net a wild bird.', (S) => S.stats.caught >= 1],
    ['Win a bout at the Backyard Pit.', (S) => S.stats.wins >= 1],
    ['Put a male and a female in the nest and sleep.', (S) => S.stats.bred >= 1 || S.eggs.length > 0],
    ['Dig a hole with the shovel out on the map.', (S) => S.stats.dug >= 1],
    ['Beat Old Bira, boss of the Backyard Pit.', (S) => RB.economy.leagueOf(S, 'backyard').boss],
    ['Find three fuses and power up the Lab.', (S) => S.lab.power],
    ['Extract a gene and inject it into another creature.', (S) => !!S.codex.ach.inject],
    ['Beat the boss of every arena, then Madame Plume at the Grand Ring.', (S) => RB.economy.leagueOf(S, 'grand').boss],
    ['Pay off Big Wattle at the bank.', (S) => S.debt <= 0],
  ];
  common.goal = function (S) {
    while (S.goal < GOALS.length && GOALS[S.goal][1](S)) S.goal++;
    return S.goal < GOALS.length ? GOALS[S.goal][0] : null;
  };
  common.drawGoal = function (S, y) {
    if (RB.game && RB.game.settings && RB.game.settings.goals === false) return; // switched off in Settings
    const g = common.goal(S);
    if (!g) return;
    const v = ui.view, w = Math.min(v.w - 16, ui.width(g, 12) + 44), x = (v.w - w) / 2;
    ui.rect(x, y, w, 24, 'rgba(35,49,74,0.82)', 12);
    ui.icon('target', x + 14, y + 12, 12, pal.mustard);
    ui.text(g, x + 26, y + 12.5, { size: 12, color: pal.white, base: 'middle', maxW: w - 34 });
  };

  // ---- achievements
  const ACH = {
    catch1: ['Butterfingers no more', 'Net your first creature.', (S) => S.stats.caught >= 1],
    catch10: ['A bird in the hand', 'Net ten creatures.', (S) => S.stats.caught >= 10],
    win1: ['Beginner\'s pluck', 'Win a bout.', (S) => S.stats.wins >= 1],
    win10: ['Feathers will fly', 'Win ten bouts.', (S) => S.stats.wins >= 10],
    hatch: ['Nest egg', 'Hatch a chick.', (S) => S.stats.bred >= 1],
    hybrid: ['What is that?', 'Hatch a creature that looks like no single kind.', (S) => S.birds.some((c) => c.origin === 'born' && !ST.pheno(c).species.pure)],
    dig10: ['Dirt under the nails', 'Dig ten holes.', (S) => S.stats.dug >= 10],
    power: ['Let there be light', 'Power up the lab.', (S) => S.lab.power],
    inject: ['Mad science', 'Inject a gene.', null],
    crispr: ['Molecular scissors', 'Land a CRISPR edit.', null],
    fossil: ['Old bones, new tricks', 'Rebuild an extinct bird.', null],
    recipe: ['Secret Recipe', 'Send eleven birds to BFC.', (S) => S.bfc.sold >= 11],
    chores: ['Honest work', 'Muck out a henhouse for $50.', null],
    hybrid2: ['Love is blind', 'Hatch a chick from two very different parents.', (S) => S.birds.some((c) => c.origin === 'born' && RB.state.isCross(c))],
    kidnap: ['Finders keepers', 'Net a person.', (S) => S.stats.kidnapped >= 1],
    sweep: ['Ghost town', 'Net every single person on the mainland, shopkeepers and all.', (S) => !!(RB.game && RB.game.world) && ST.nettedAll(S, RB.game.world),
      (S) => (RB.game && RB.game.world ? ST.nettedCount(S, RB.game.world) + ' of ' + ST.mainlanders(RB.game.world).length + ' so far' : '')],
    rich: ['Feathered nest', 'Hold $5000 at once.', (S) => S.money >= 5000],
    clone: ['Send in the clones', 'Turn a creature into a clone with a whole-genome copy.', null],
    roost: ['Golden years', 'Retire a bird to Sunset Roost.', (S) => (S.roost || []).length >= 1],
    twitcher: ['Twitcher', 'Meet fifteen kinds of bird.', (S) => Object.keys(S.codex.species).length >= 15],
    heads: ['Two heads are better', 'Own a two-headed creature.', (S) => S.birds.some((c) => ST.pheno(c).twoHeads)],
    champ: ['Champion of the Grand Ring', 'Beat Madame Plume.', (S) => RB.economy.leagueOf(S, 'grand').boss],
    free: ['Free as a bird', 'Pay off the whole debt.', (S) => S.debt <= 0],
  };
  common.ACH = ACH;
  common.award = function (S, id) {
    if (S.codex.ach[id]) return;
    S.codex.ach[id] = true;
    ui.toast('Achievement: ' + ACH[id][0], pal.plum);
    RB.audio.play('found');
  };
  common.checkAch = function (S) { for (const id of Object.keys(ACH)) if (ACH[id][2] && !S.codex.ach[id] && ACH[id][2](S)) common.award(S, id); };
  common.discover = function (S, c) {
    const P = ST.pheno(c);
    if (P.species.pure && !P.person && !S.codex.species[P.species.id]) { S.codex.species[P.species.id] = true; ui.toast('New in the codex: ' + RB.species.nameOf(RB.species.SPECIES[P.species.id], P.sex), pal.teal); }
  };

  // ---- the creature card. actions(c) returns [{ label, icon, fill, fn, disabled }]
  const BARS = [['power', 'Power', pal.coral], ['speed', 'Speed', pal.teal], ['tough', 'Toughness', pal.brick], ['stamina', 'Stamina', pal.leaf], ['guts', 'Guts', pal.mustard], ['wits', 'Wits', pal.plum], ['fury', 'Fury', '#d7372f']];
  common.statusOf = function (c) {
    const out = [];
    if (ST.isRetired(c)) out.push(['Retired', pal.plum]);
    if (c.rest > 0) out.push(['Dazed', pal.coral]);
    if (c.tired) out.push(['Worn out', pal.grey]);
    if (c.hp < 0.99) out.push(['Wounded ' + Math.round(c.hp * 100) + '%', pal.brick]);
    if (!c.fed) out.push([c.hungry > 0 ? 'Starving' : 'Hungry', c.hungry > 0 ? pal.coral : pal.mustard]);
    if (c.buff === 'chili') out.push(['Fired up', '#d7372f']);
    if (c.love) out.push(['In love', pal.coral]);
    return out;
  };
  // o.has(c): whether the creature is still there to show (default: it is one of your birds)
  common.card = function (c, actions, o) {
    const S = RB.game.S;
    ui.open({ draw() {
      if (!(o && o.has ? o.has(c) : S.birds.includes(c))) { ui.close(); return; }
      const P = ST.pheno(c), v = ui.view, wide = v.w >= 560;
      const acts = actions ? actions(c) : [];
      const rows = Math.ceil(acts.length / (wide ? 4 : 2));
      const box = ui.window(c.name, wide ? 540 : 340, (wide ? 300 : 430) + rows * 46, {});
      if (!box) return;
      if (ui.tapIn(box.x, box.y - 46, box.w - 44, 38)) { const n = window.prompt('Name', c.name); if (n && n.trim()) c.name = n.trim().slice(0, 16); }
      const pw = wide ? 150 : 118;
      common.portrait(c, box.x, box.y, pw, pw);
      let tx = box.x + pw + 12, ty = box.y + 14;
      const tw = box.w - pw - 12;
      ui.icon(P.sex === 'M' ? 'male' : 'female', tx + 8, ty - 4, 15, P.sex === 'M' ? '#3d6fa5' : pal.coral);
      ui.text(ST.kind(c), tx + 22, ty, { size: 15, maxW: tw - 24 });
      ty += 19;
      const stage = c.person ? 'not amused' : ST.isRetired(c) ? 'retired at ' + c.age + ' days' + (c.at === 'roost' ? ', at Sunset Roost since day ' + c.since : '') : P.stage + ', day ' + c.age + ' of about ' + P.lifespan;
      ui.text(stage, tx, ty, { size: 12, bold: false, maxW: tw }); ty += 16;
      ui.text(common.fmtKg(P.weightKg) + ' · ' + RB.pheno.WEIGHT_CLASSES[P.weightClass][0] + 'weight', tx, ty, { size: 12, bold: false, maxW: tw }); ty += 16;
      ui.text('Record ' + c.wins + '–' + c.losses + (c.person ? '' : ' · worth about $' + RB.economy.value(c)), tx, ty, { size: 12, bold: false, maxW: tw }); ty += 14;
      ui.text('Trust', tx, ty + 9, { size: 11, bold: false }); ui.bar(tx + 34, ty + 2, tw - 40, 7, c.bond, pal.coral); ty += 18;
      let cx = tx;
      for (const s of common.statusOf(c).concat(P.odd.map((o) => [o, pal.plum])).concat(c.gear ? [[RB.items.ITEMS[c.gear].name, pal.grey]] : [])) {
        const w = ui.width(s[0], 10) + 12;
        if (cx + w > tx + tw) { cx = tx; ty += 18; }
        ui.rect(cx, ty, w, 15, s[1], 7); ui.text(s[0], cx + 6, ty + 11, { size: 10, color: pal.white }); cx += w + 4;
      }
      // stat bars
      const by = wide ? box.y + pw + 10 : box.y + pw + 12, cols = wide ? 2 : 1, bw = (box.w - (cols - 1) * 16) / cols;
      BARS.forEach((b, i) => {
        const col = i % cols, row = Math.floor(i / cols), x = box.x + col * (bw + 16), y = by + row * 19;
        ui.text(b[1], x, y + 10, { size: 11, bold: false });
        ui.bar(x + 68, y + 2, bw - 100, 9, P.rate[b[0]] / 100, b[2]);
        ui.text(String(P.rate[b[0]]), x + bw, y + 10, { size: 11, align: 'right' });
      });
      // actions
      const per = wide ? 4 : 2, aw = (box.w - (per - 1) * 8) / per, ay0 = box.y + box.h - rows * 46 + 4;
      acts.forEach((a, i) => {
        if (ui.btn(box.x + (i % per) * (aw + 8), ay0 + Math.floor(i / per) * 46, aw, 38, a.label, { icon: a.icon, fill: a.fill, disabled: a.disabled, size: 13 })) { RB.audio.play('click'); a.fn(c); }
      });
    } });
  };

  // ---- pick one creature from a list. note(c) -> { text, ok } shown on each row.
  common.pick = function (title, list, onPick, note) {
    ui.open({ draw() {
      const box = ui.window(title, 380, Math.min(ui.view.h - 16, 96 + Math.max(1, list.length) * 62), {});
      if (!box) return;
      if (!list.length) { ui.para('Nothing in the cage. Load creatures into the truck at home, or catch some.', box.x, box.y + 6, box.w, { size: 13 }); return; }
      ui.list('pick' + title, box.x, box.y, box.w, box.h, list.length, 62, (i, x, y, w) => {
        const c = list[i], P = ST.pheno(c), n = note ? note(c) : { text: '', ok: true };
        ui.rect(x, y + 2, w - 6, 56, pal.soft, 10);
        common.portrait(c, x + 4, y + 6, 48, 48, { fill: pal.paper });
        ui.text(c.name, x + 60, y + 22, { size: 14, maxW: w - 150 });
        ui.text(ST.kind(c) + ' · ' + common.fmtKg(P.weightKg), x + 60, y + 37, { size: 11, bold: false, maxW: w - 150 });
        if (n.text) ui.text(n.text, x + 60, y + 51, { size: 11, color: n.ok ? pal.teal : pal.coral, maxW: w - 150 });
        if (ui.btn(x + w - 84, y + 12, 72, 36, n.label || 'Pick', { disabled: !n.ok, size: 13, fill: n.fill })) { RB.audio.play('click'); ui.close(); onPick(c); }
      });
    } });
  };

  // ---- whoever minds a place, tapped in the header: net them right there, indoors
  // base: the person from world.npcs. onCaught(c) runs once they are in the truck.
  common.keeperTap = function (S, base, x, y, w, h, onCaught) {
    if (!base) return;
    const ctx = ui.ctx;
    // a little net badge on the portrait says it can be tapped
    ctx.fillStyle = pal.plum; ctx.beginPath(); ctx.arc(x + w - 4, y + h - 4, 10, 0, Math.PI * 2); ctx.fill();
    ui.icon('net', x + w - 4, y + h - 4, 12, pal.white);
    if (ui.tapIn(x, y, w + 6, h + 6)) { RB.audio.play('click'); common.netKeeper(S, base, onCaught); }
  };
  common.netKeeper = function (S, base, onCaught) {
    const cur = RB.npc.current(S, base), bird = !!cur.bird;
    const what = bird
      ? cur.name + ' minds the place for you. Net it and it goes back in your truck as it was, and the place needs someone new.'
      : 'Throw a net over ' + cur.name + ' right here. The place stays shut while ' + (cur.sex === 'F' ? 'she is' : 'he is') + ' away, unless you put someone else in charge. The sheriff will hear about it.';
    ui.open({ draw() {
      const box = ui.window(cur.name, 360, 250, {});
      if (!box) return;
      common.portrait({ P: RB.pheno.express(cur.g) }, box.x, box.y + 2, 76, 76, { draw: { clothes: cur.clothes } });
      ui.para(what, box.x + 86, box.y + 2, box.w - 86, { size: 12 });
      const silver = !!S.equip.silvernet, n = ST.count(S, 'net') + ST.count(S, 'bignet');
      if (ui.btn(box.x, box.y + box.h - 46, box.w, 42, 'Throw a net' + (silver ? ' (silver)' : ' (' + n + ' left)'), { icon: 'net', fill: pal.plum, disabled: !silver && !n })) {
        if (!ST.useNet(S, 'net')) ST.useNet(S, 'bignet');
        const c = ST.netKeeper(S, base);
        if (c.person && !bird) ST.caughtPerson(S, base.role === 'sheriff' ? 70 : 40);
        ui.close();
        RB.audio.play('catch');
        if (c.person) RB.audio.play('error');
        ui.toast(bird ? c.name + ' is back in the truck, a bird again.' : 'You netted ' + c.name + '! "' + RB.npc.SCREAMS[(S.day + c.id) % RB.npc.SCREAMS.length] + '"', pal.plum);
        common.checkAch(S);
        RB.game.save();
        onCaught(c);
      }
    } });
  };

  // ---- a place with nobody minding it: put a creature from the truck in charge
  // base: the person from world.npcs; empty: 'away' or 'sold'. onDone runs once someone runs it.
  common.vacant = function (S, site, base, empty, onDone) {
    const was = RB.npc.current(S, base);
    const text = (empty === 'sold' ? 'The place stands empty. Someone new will move in before long.' : 'Nobody is minding the place: ' + was.name + ' is... away.') +
      ' Or put someone in charge yourself: a person you netted, or any bird in the truck. A bird put in charge wakes up sentient and carries on the trade.';
    ui.open({ draw() {
      const box = ui.window(site.kind === 'house' ? 'An empty house' : site.name, 360, 230, {});
      if (!box) return;
      ui.para(text, box.x, box.y + 2, box.w, { size: 12 });
      const list = ST.at(S, 'cage');
      if (ui.btn(box.x, box.y + box.h - 46, box.w, 42, list.length ? 'Put someone in charge' : 'The truck is empty', { icon: 'right', fill: pal.teal, disabled: !list.length })) {
        ui.close();
        common.pick('Who takes over?', list, (c) => {
          const why = ST.installKeeper(S, base, c);
          if (why) { ui.toast(why, pal.coral); RB.audio.play('error'); return; }
          RB.audio.play('good');
          ui.toast(c.person === base.id ? c.name + ' is back where ' + (c.g.sex === 'F' ? 'she' : 'he') + ' belongs.' : c.person ? c.name + ' takes over. Nobody asks questions.' : c.name + ' blinks, clears its throat and starts talking. It runs the place now.', pal.teal);
          common.checkAch(S);
          RB.game.save();
          onDone();
        }, (c) => ({ text: c.person ? (c.person === base.id ? 'their own place' : 'a person') : 'will wake up sentient', ok: true, label: 'Hire', fill: pal.teal }));
      }
    } });
  };

  RB.common = common;
})();

// Settings window: volumes, full screen, and (in a game) save and quit.
(function () {
  'use strict';
  const RB = globalThis.RB, ui = RB.ui, pal = RB.pal;
  RB.common.settings = function (inGame) {
    const game = RB.game;
    ui.open({ draw() {
      const box = ui.window('Settings', 340, inGame ? 424 : 364, {});
      if (!box) return;
      const st = game.settings;
      let y = box.y + 4;
      const vol = (label, key, icon) => {
        ui.icon(icon, box.x + 12, y + 18, 18, pal.ink); ui.text(label, box.x + 30, y + 23, { size: 14 });
        if (ui.btn(box.x + box.w - 150, y, 40, 36, '', { icon: 'minus', fill: pal.grey })) { st[key] = Math.max(0, +(st[key] - 0.1).toFixed(1)); game.applySettings(); RB.audio.play('click'); }
        ui.bar(box.x + box.w - 104, y + 13, 58, 10, st[key], pal.teal);
        if (ui.btn(box.x + box.w - 40, y, 40, 36, '', { icon: 'plus', fill: pal.grey })) { st[key] = Math.min(1, +(st[key] + 0.1).toFixed(1)); game.applySettings(); RB.audio.play('click'); }
        y += 46;
      };
      vol('Sound', 'sfx', 'sound'); vol('Music', 'music', 'music');
      // on/off switches (on unless switched off)
      const toggle = (label, key, icon) => {
        ui.icon(icon, box.x + 12, y + 18, 18, pal.ink); ui.text(label, box.x + 30, y + 23, { size: 14, maxW: box.w - 130 });
        if (ui.btn(box.x + box.w - 90, y, 90, 36, st[key] === false ? 'Off' : 'On', { fill: st[key] === false ? pal.grey : pal.teal, size: 13 })) { st[key] = st[key] === false; game.applySettings(); RB.audio.play('click'); }
        y += 46;
      };
      toggle('Gene-edit mini-game', 'crispr', 'dna'); // off: gene edits apply at once
      toggle('Goal hints', 'goals', 'target');         // off: no goal line at the top of the screen
      if (ui.btn(box.x, y, box.w, 38, 'Full screen', { icon: 'full', fill: pal.plum })) game.fullscreen();
      y += 48;
      ui.para('Mouse or touch for everything. On the map: WASD or arrows drive, hold the mouse to aim a net, E enters, Q digs, 1-3 pick a tool.', box.x, y, box.w, { size: 11, color: pal.grey });
      if (inGame && ui.btn(box.x, box.y + box.h - 40, box.w, 40, 'Save and quit to title', { fill: pal.coral, icon: 'home' })) { game.save(); ui.close(); game.go('title'); }
    } });
  };
})();
