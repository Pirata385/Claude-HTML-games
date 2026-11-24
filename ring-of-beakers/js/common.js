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
  common.drawOpts = (c) => ({ hat: c.hat || (c.clothes && c.clothes.hat) || null, clothes: c.clothes || null, acc: c.acc || null });

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
  // Off to muck out Dona Cida's henhouse: when not a coin is left, or when a lost bet leaves too
  // little to enter even the cheapest bout (S.mustMuck, set when the bet is settled).
  common.checkBroke = function (S, back) {
    if ((S.money > 0 && !S.mustMuck) || RB.game.pending || ui.modals.length || RB.game.slot === undefined) return false;
    const why = S.money > 0 ? 'That bet cost you dear: $' + S.money + ' left, not enough to enter even the cheapest bout ($' + RB.economy.minEntry() + ').' : 'Not a coin to your name.';
    ui.message('Flat broke', why + ' Dona Cida at Feed & Seed pays $50 to muck out her henhouse, and she is not fussy about who does it.', () => RB.game.go('chores', { back }), { ok: 'Grab a shovel', head: pal.brick });
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
    birdtown: ['Bird town', 'Put a bird in charge of every house and business on the mainland, in place of the people.', (S) => !!(RB.game && RB.game.world) && ST.birdTown(S, RB.game.world) === ST.mainlanders(RB.game.world).length,
      (S) => (RB.game && RB.game.world ? ST.birdTown(S, RB.game.world) + ' of ' + ST.mainlanders(RB.game.world).length + ' places run by birds' : '')],
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
    for (const it of ST.grantUnlocks(S)) ui.toast('Unlocked: ' + RB.items.ITEMS[it].name + ' (in your bag)', pal.teal);
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
    if (c.eternal) out.push([c.eternal === 2 ? 'Eternal vigor' : 'Eternal: breeds for ever', '#d9a21b']);
    if (c.rest > 0) out.push(['Dazed', pal.coral]);
    if (c.tired) out.push(['Worn out', pal.grey]);
    if (c.hp < 0.99) out.push(['Wounded ' + Math.round(c.hp * 100) + '%', pal.brick]);
    if (!c.fed) out.push([c.hungry > 0 ? 'Starving' : 'Hungry', c.hungry > 0 ? pal.coral : pal.mustard]);
    if (c.buff === 'chili') out.push(['Fired up', '#d7372f']);
    if (c.love) out.push(['In love', pal.coral]);
    return out;
  };
  // o.has(c): whether the creature is still there to show (default: it is one of your birds)
  // Tabs across the top of a window: returns the index picked (st.tab) and the height they take.
  common.tabs = function (st, names, x, y, w) {
    const tw = Math.min(120, (w - (names.length - 1) * 6) / names.length);
    names.forEach((n, i) => { if (ui.btn(x + i * (tw + 6), y, tw, 32, n, { fill: st.tab === i ? pal.ink : pal.soft, color: st.tab === i ? pal.white : pal.ink, size: 13, flat: true })) { st.tab = i; RB.audio.play('click'); } });
    return 40;
  };
  // A bird's card: the bird (Card), who its parents are and the young it has had (Family), and in a
  // sandbox game its numbers, set by hand (Edit).
  common.card = function (c, actions, o) {
    const S = RB.game.S, st = { tab: 0 };
    ui.open({ draw() {
      if (!(o && o.has ? o.has(c) : S.birds.includes(c))) { ui.close(); return; }
      const P = ST.pheno(c), v = ui.view, wide = v.w >= 560;
      const acts = actions ? actions(c) : [];
      const rows = Math.ceil(acts.length / (wide ? 4 : 2));
      const box0 = ui.window(c.name, wide ? 540 : 340, (wide ? 340 : 470) + rows * 46, {});
      if (!box0) return;
      if (ui.tapIn(box0.x, box0.y - 46, box0.w - 44, 38)) { const n = window.prompt('Name', c.name); if (n && n.trim()) c.name = n.trim().slice(0, 16); }
      const names = c.person ? ['Card'] : ['Card', 'Family'].concat(S.sandbox ? ['Edit'] : []);
      const th = names.length > 1 ? common.tabs(st, names, box0.x, box0.y, box0.w) : 0;
      const box = { x: box0.x, y: box0.y + th, w: box0.w, h: box0.h - th };
      const per = wide ? 4 : 2, aw = (box.w - (per - 1) * 8) / per, ay0 = box.y + box.h - rows * 46 + 4;
      const actionRow = () => acts.forEach((a, i) => {
        if (ui.btn(box.x + (i % per) * (aw + 8), ay0 + Math.floor(i / per) * 46, aw, 38, a.label, { icon: a.icon, fill: a.fill, disabled: a.disabled, size: 13 })) { RB.audio.play('click'); a.fn(c); }
      });
      if (st.tab === 1 && names[1]) { common.familyTab(c, box, wide, actions); actionRow(); return; }
      if (st.tab === 2 && names[2]) { common.editTab(c, box, wide); return; } // (the actions stay on the other tabs: the numbers need the room)
      const pw = wide ? 150 : 118;
      common.portrait(c, box.x, box.y, pw, pw);
      let tx = box.x + pw + 12, ty = box.y + 14;
      const tw = box.w - pw - 12;
      ui.icon(P.sex === 'M' ? 'male' : 'female', tx + 8, ty - 4, 15, P.sex === 'M' ? '#3d6fa5' : pal.coral);
      ui.text(ST.kind(c), tx + 22, ty, { size: 15, maxW: tw - 24 });
      ty += 19;
      const stage = c.person ? 'not amused' : c.eternal === 2 ? 'in its prime for ever, day ' + c.age : ST.isRetired(c) ? 'retired at ' + c.age + ' days' + (c.at === 'roost' ? ', at Sunset Roost since day ' + c.since : '') : P.stage + ', day ' + c.age + ' of about ' + P.lifespan;
      ui.text(stage, tx, ty, { size: 12, bold: false, maxW: tw }); ty += 16;
      ui.text(common.fmtKg(P.weightKg) + ' · ' + RB.pheno.WEIGHT_CLASSES[P.weightClass][0] + 'weight · cap ' + RB.pheno.PHYS_CAP[P.weightClass], tx, ty, { size: 12, bold: false, maxW: tw }); ty += 16;
      ui.text('Record ' + c.wins + '–' + c.losses + (c.person ? '' : ' · worth about $' + RB.economy.value(c)), tx, ty, { size: 12, bold: false, maxW: tw }); ty += 14;
      ui.text('Trust', tx, ty + 9, { size: 11, bold: false }); ui.bar(tx + 34, ty + 2, tw - 40, 7, c.bond, pal.coral); ty += 18;
      let cx = tx;
      const habit = ST.quirkOf(S, c);
      for (const s of common.statusOf(c).concat(P.odd.map((o) => [o, pal.plum])).concat(c.gear ? [[RB.items.ITEMS[c.gear].name, pal.grey]] : []).concat(habit ? [['Habit: ' + ST.QUIRKS[habit], pal.teal]] : [])) {
        const w = ui.width(s[0], 10) + 12;
        if (cx + w > tx + tw) { cx = tx; ty += 18; }
        ui.rect(cx, ty, w, 15, s[1], 7); ui.text(s[0], cx + 6, ty + 11, { size: 10, color: pal.white }); cx += w + 4;
      }
      // stat bars, below the picture and the last row of tags
      const by = Math.max(wide ? box.y + pw + 10 : box.y + pw + 12, ty + 23), cols = wide ? 2 : 1, bw = (box.w - (cols - 1) * 16) / cols;
      BARS.forEach((b, i) => {
        const col = i % cols, row = Math.floor(i / cols), x = box.x + col * (bw + 16), y = by + row * 19;
        ui.text(b[1], x, y + 10, { size: 11, bold: false });
        ui.bar(x + 68, y + 2, bw - 100, 9, P.rate[b[0]] / ((P.rateCap && P.rateCap[b[0]]) || 100), b[2]); // full at the weight class's limit
        ui.text(String(P.rate[b[0]]), x + bw, y + 10, { size: 11, align: 'right' });
      });
      if (c.edit && S.sandbox) ui.text('Numbers set by hand (Edit tab)', box.x, by + Math.ceil(BARS.length / cols) * 19 + 8, { size: 10, bold: false, color: pal.plum });
      actionRow();
    } });
  };

  // ---- Family: the mother and the father (drawn if you still have them, or if the Hall of Fame
  // remembers them), and the young the bird has had that are still with you or on your islands.
  const famePs = new Map();
  const famePheno = (e) => { const k = e.id + ':' + e.age; let P = famePs.get(k); if (!P) { P = RB.pheno.express(RB.genome.deserialize(e.g), { age: e.age }); famePs.set(k, P); } return P; };
  common.familyTab = function (c, box, wide, actions) {
    const S = RB.game.S, fam = ST.family(S, c), pw = wide ? 96 : 76;
    const unknown = c.origin === 'start' ? 'One of the two chickens Aunt Dalva left you: nobody knows its parents.'
      : c.origin === 'wild' ? 'Caught in the wild: its parents are out there somewhere.'
        : c.origin === 'born' ? ((c.log || []).some((n) => /fossil/.test(n.t)) ? 'Hatched from an egg rebuilt from fossil fragments: its parents lived long ago.' : 'Its parents were not written down.')
          : 'Bought or traded: its parents were never known.';
    if (!fam.mother && !fam.father) ui.para(unknown, box.x, box.y + 4, box.w, { size: 13, bold: false });
    const one = (label, f, x, y, w) => {
      ui.text(label, x, y + 12, { size: 12, color: pal.grey });
      if (!f) { ui.para('Unknown.', x, y + 22, w, { size: 12, bold: false }); return; }
      const has = f.c || f.e, px = x, py = y + 20;
      if (f.c) common.portrait(f.c, px, py, pw, pw); else if (f.e) common.portrait({ P: famePheno(f.e) }, px, py, pw, pw); else { ui.rect(px, py, pw, pw, pal.soft, 10); ui.text('?', px + pw / 2, py + pw / 2 + 12, { size: 34, align: 'center', color: pal.grey }); }
      const tx = px + pw + 10, tw = w - pw - 10;
      const where = f.c ? ST.whereOf(S, f.c) : f.e ? (f.e.gone ? f.e.status || 'Gone' : 'In the Hall of Fame') : f.who ? 'No longer with you.' : '';
      ui.text(f.who ? f.who.name : 'Not recorded', tx, py + 14, { size: 14, maxW: tw });
      ui.para((f.c ? ST.kind(f.c) : f.kind || '?') + (where ? '. ' + where : '') + (!f.who ? ' (hatched before families were written down)' : ''), tx, py + 22, tw, { size: 11, bold: false });
      if (f.c && ui.btn(tx, py + pw - 30, Math.min(110, tw), 30, 'Open card', { size: 12, fill: pal.teal })) common.card(f.c, S.birds.includes(f.c) ? actions : null, { has: () => true });
      return has;
    };
    const y0 = box.y + (fam.mother || fam.father ? 0 : 40);
    if (wide) { one('Mother', fam.mother, box.x, y0, box.w / 2 - 8); one('Father', fam.father, box.x + box.w / 2 + 8, y0, box.w / 2 - 8); }
    else { one('Mother', fam.mother, box.x, y0, box.w); one('Father', fam.father, box.x, y0 + pw + 34, box.w); }
    const yy = y0 + (wide ? pw + 34 : 2 * (pw + 34)) + 6;
    const young = fam.young;
    ui.text('Young' + (young.length ? ' (' + young.length + ')' : ''), box.x, yy + 12, { size: 12, color: pal.grey });
    ui.para(young.length ? young.slice(0, 24).map((b) => b.name).join(', ') + (young.length > 24 ? '...' : '') : 'None yet (or none still with you).', box.x, yy + 20, box.w, { size: 12, bold: false });
  };

  // ---- Edit (sandbox): every number set by hand, up to the weight class's cap (100 for the others).
  // Drag along a bar or use - and +. The change is real: it moves the body behind the number.
  common.editTab = function (c, box, wide) {
    const P = ST.pheno(c), lw = 78, vw = 40, bw = box.w - lw - vw - 76;
    ui.para('Sandbox: set any number as you like. It changes the bird for real, in bouts too. Reset gives it back the numbers its genes and training give.', box.x, box.y, box.w, { size: 11, bold: false });
    const set = (k, v) => { c.edit = Object.assign({}, c.edit || {}, { [k]: Math.round(clamp(v, 0, P.rateCap[k])) }); c._P = null; };
    BARS.forEach((b, i) => {
      const k = b[0], y = box.y + (wide ? 38 : 52) + i * 30, cap = P.rateCap[k], bx = box.x + lw;
      ui.text(b[1], box.x, y + 16, { size: 12, bold: false, color: c.edit && c.edit[k] !== undefined ? pal.plum : pal.ink });
      ui.bar(bx, y + 8, bw, 12, P.rate[k] / cap, b[2]);
      const p = ui.downIn(bx - 4, y, bw + 8, 28);
      if (p) set(k, (p.x - bx) / bw * cap);
      ui.text(String(P.rate[k]), bx + bw + vw, y + 16, { size: 12, align: 'right' });
      if (ui.btn(bx + bw + vw + 6, y + 2, 32, 26, '-', { size: 14, fill: pal.soft, color: pal.ink })) set(k, P.rate[k] - 5);
      if (ui.btn(bx + bw + vw + 42, y + 2, 32, 26, '+', { size: 14, fill: pal.soft, color: pal.ink })) set(k, P.rate[k] + 5);
    });
    const yb = box.y + (wide ? 38 : 52) + BARS.length * 30 + 6;
    if (ui.btn(box.x, yb, 150, 34, 'Reset to its genes', { size: 12, fill: pal.grey, disabled: !c.edit })) { delete c.edit; c._P = null; }
    if (ui.btn(box.x + 158, yb, 120, 34, 'All to the cap', { size: 12, fill: pal.plum })) { const e = {}; for (const b of BARS) e[b[0]] = P.rateCap[b[0]]; c.edit = e; c._P = null; }
  };

  // ---- the wardrobe: one thing per place (head, face, neck, back, feet, tail) and one piece of
  // fighting kit. What comes off goes back in the bag. Works wherever the bird is: the yard or the truck.
  common.wardrobe = function (c) {
    const S = RB.game.S, IT = RB.items, SL = IT.SLOTS;
    ui.open({ draw() {
      if (!S.birds.includes(c)) { ui.close(); return; }
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
  };
  // ---- hand a creature something from the bag: grain, a treat, a tonic, a mushroom... Wherever it is,
  // the yard or the truck out on the road. onFed(c, item) runs after it eats.
  common.feedPick = function (c, onFed) {
    const S = RB.game.S, IT = RB.items;
    ui.open({ draw() {
      if (!S.birds.includes(c)) { ui.close(); return; }
      const v = ui.view, items = ST.owned(S).filter((id) => IT.ITEMS[id].kind === 'feed');
      const box = ui.window('Give ' + c.name + ' something', 440, Math.min(v.h - 16, 150 + Math.max(1, items.length) * 50), {});
      if (!box) return;
      common.portrait(c, box.x, box.y, 64, 64, { fill: pal.soft });
      ui.text(c.fed ? 'Fed today.' : 'Hungry: anything from here is a full meal.', box.x + 76, box.y + 22, { size: 13, color: c.fed ? pal.teal : pal.coral, maxW: box.w - 80 });
      ui.text('Trust', box.x + 76, box.y + 46, { size: 11, bold: false }); ui.bar(box.x + 110, box.y + 39, Math.min(160, box.w - 120), 7, c.bond, pal.coral);
      if (!items.length) { ui.para('Nothing to give in the bag. Feed & Seed sells grain, worms, chili and tonics.', box.x, box.y + 80, box.w, { size: 12, color: pal.grey }); return; }
      ui.list('give' + c.id, box.x, box.y + 74, box.w, box.h - 74, items.length, 50, (i, x, y, w) => {
        const it = IT.ITEMS[items[i]];
        ui.rect(x, y + 2, w - 6, 44, pal.soft, 10); ui.itemIcon(it.id, x + 24, y + 24, 26);
        ui.text(it.name + ' (' + ST.fmtCount(ST.count(S, it.id)) + ')', x + 46, y + 20, { size: 13, maxW: w - 130 });
        ui.text(it.desc, x + 46, y + 36, { size: 10, bold: false, maxW: w - 130, color: pal.grey });
        if (ui.btn(x + w - 78, y + 7, 66, 34, 'Give', { size: 12, fill: pal.teal })) {
          const full = it.id === 'grain' && c.fed, msg = ST.feed(S, c, it.id);
          if (!msg) { ui.toast('None left.', pal.coral); RB.audio.play('error'); return; }
          ui.toast(msg, full ? pal.coral : pal.teal); RB.audio.play(full ? 'error' : 'good');
          if (!full) { RB.game.save(); if (onFed) onFed(c, it.id); }
        }
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
      if (ui.btn(box.x, box.y + box.h - 46, box.w, 42, 'Throw a net' + (silver ? ' (silver)' : ' (' + ST.fmtCount(n) + ' left)'), { icon: 'net', fill: pal.plum, disabled: !silver && !n })) {
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
      const box = ui.window('Settings', 340, inGame ? 566 : 506, {});
      if (!box) return;
      const st = game.settings;
      let y = box.y + 4;
      // seven rows and the full-screen button; on a short screen the rows draw closer together
      const step = Math.max(38, Math.min(46, (box.h - (inGame ? 46 : 0) - 44) / 7));
      const vol = (label, key, icon) => {
        ui.icon(icon, box.x + 12, y + 18, 18, pal.ink); ui.text(label, box.x + 30, y + 23, { size: 14 });
        if (ui.btn(box.x + box.w - 150, y, 40, 36, '', { icon: 'minus', fill: pal.grey })) { st[key] = Math.max(0, +(st[key] - 0.1).toFixed(1)); game.applySettings(); RB.audio.play('click'); }
        ui.bar(box.x + box.w - 104, y + 13, 58, 10, st[key], pal.teal);
        if (ui.btn(box.x + box.w - 40, y, 40, 36, '', { icon: 'plus', fill: pal.grey })) { st[key] = Math.min(1, +(st[key] + 0.1).toFixed(1)); game.applySettings(); RB.audio.play('click'); }
        y += step;
      };
      vol('Sound', 'sfx', 'sound'); vol('Music', 'music', 'music');
      // the open-air music: one track after another, or now and then with quiet in between
      ui.icon('music', box.x + 12, y + 18, 18, pal.ink); ui.text('Music plays', box.x + 30, y + 23, { size: 14, maxW: box.w - 160 });
      const some = st.musicMode === 'sometimes';
      if (ui.btn(box.x + box.w - 120, y, 120, 36, some ? 'Now and then' : 'Always', { fill: some ? pal.plum : pal.teal, size: 13 })) { st.musicMode = some ? 'always' : 'sometimes'; game.applySettings(); RB.audio.play('click'); if (some) RB.audio.musicSkipQuiet(); }
      y += step;
      // on/off switches (on unless switched off)
      const toggle = (label, key, icon) => {
        ui.icon(icon, box.x + 12, y + 18, 18, pal.ink); ui.text(label, box.x + 30, y + 23, { size: 14, maxW: box.w - 130 });
        if (ui.btn(box.x + box.w - 90, y, 90, 36, st[key] === false ? 'Off' : 'On', { fill: st[key] === false ? pal.grey : pal.teal, size: 13 })) { st[key] = st[key] === false; game.applySettings(); RB.audio.play('click'); }
        y += step;
      };
      toggle('Gene-edit mini-game', 'crispr', 'dna'); // off: gene edits apply at once
      toggle('Goal hints', 'goals', 'target');         // off: no goal line at the top of the screen
      toggle('Impact frames', 'impactFrames', 'bolt'); // off: a landed flying kick does not freeze and flash
      if (ui.btn(box.x, y, box.w, 38, 'Full screen', { icon: 'full', fill: pal.plum })) game.fullscreen();
      y += 48;
      if (y + 44 < box.y + box.h - (inGame ? 46 : 0)) ui.para('Mouse or touch for everything. On the map: WASD or arrows drive, hold the mouse to aim a net, E enters, Q digs, 1-3 pick a tool.', box.x, y, box.w, { size: 11, color: pal.grey }); // when there is room
      if (inGame && ui.btn(box.x, box.y + box.h - 40, box.w, 40, 'Save and quit to title', { fill: pal.coral, icon: 'home' })) { game.save(); ui.close(); game.go('title'); }
    } });
  };
})();
