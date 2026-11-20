// scenes/sites.js — what happens indoors: shops, the garage, the vet, the bank, the BFC counter,
// neighbours' houses (buyers, breeders, collectors, rival trainers), the arenas' cards with
// betting, and the sideshow. One scene, drawn according to the kind of site.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp } = RB.core;
  const ui = RB.ui, pal = RB.pal, ST = RB.state, common = RB.common, EC = RB.economy, IT = RB.items;

  let S, world, site, keeper, base, tab, say, t;

  const caged = () => ST.at(S, 'cage');
  function pay(n) { if (S.money < n) { ui.toast('You cannot afford that.', pal.coral); RB.audio.play('error'); return false; } S.money -= n; RB.audio.play('buy'); return true; }
  function earn(n) { S.money += n; S.stats.earned += n; RB.audio.play('coin'); }

  // A list row: icon or portrait on the left, two lines of text, a price and one button.
  function row(x, y, w, o) {
    ui.rect(x, y + 2, w - 6, 54, pal.paper, 10);
    if (o.c) common.portrait(o.c, x + 4, y + 5, 48, 48, { fill: pal.soft });
    else if (o.P) common.portrait({ P: o.P }, x + 4, y + 5, 48, 48, { fill: pal.soft });
    else if (o.item) ui.itemIcon(o.item, x + 28, y + 29, 28);
    else if (o.icon) ui.icon(o.icon, x + 28, y + 29, 26, o.iconCol || pal.ink);
    const bw = o.btn ? 78 : 0, tx = x + 60, tw = w - 72 - bw - (o.price !== undefined ? 62 : 0);
    ui.text(o.title, tx, y + 23, { size: 14, maxW: tw });
    if (o.sub) ui.text(o.sub, tx, y + 40, { size: 11, bold: false, maxW: tw, color: o.subCol });
    if (o.price !== undefined) ui.text('$' + o.price, x + w - bw - 18, y + 33, { size: 14, align: 'right', color: o.priceCol || pal.ink });
    return o.btn ? ui.btn(x + w - bw - 10, y + 10, bw, 38, o.btn, { size: 13, fill: o.fill, disabled: o.off, color: o.color }) : false;
  }
  function tabs(names, x, y, w) {
    const tw = Math.min(120, (w - (names.length - 1) * 6) / names.length);
    names.forEach((n, i) => { if (ui.btn(x + i * (tw + 6), y, tw, 32, n, { fill: tab === i ? pal.ink : pal.soft, color: tab === i ? pal.white : pal.ink, size: 13, flat: true })) { tab = i; RB.audio.play('click'); } });
    return 40;
  }

  // ---- shops
  function shop(b) {
    const up = Object.keys(IT.UPGRADES).filter((id) => IT.UPGRADES[id].at === site.id);
    const names = ['Buy', 'Sell'].concat(up.length ? ['Upgrades'] : []);
    const y = b.y + tabs(names, b.x, b.y, b.w), h = b.h - 40;
    if (tab === 0) {
      const stock = IT.STOCK[site.id] || site.stock || [];
      ui.list('buy' + site.id, b.x, y, b.w, h, stock.length, 60, (i, x, yy, w) => {
        const it = IT.ITEMS[stock[i]], endless = ST.endless(S, it.gives || it.id), owned = (it.kind === 'equip' && S.equip[it.id]) || endless;
        const have = it.kind === 'equip' ? '' : endless ? ' · endless in a sandbox game' : ' · you have ' + ST.count(S, it.gives || it.id) + (it.gives ? ' ' + IT.ITEMS[it.gives].name.toLowerCase() : '');
        if (row(x, yy, w, { item: it.id, title: it.name, sub: it.desc + have, price: it.price, btn: endless ? '∞' : owned ? 'Owned' : 'Buy', off: owned })) {
          if (pay(it.price)) { if (it.kind === 'equip') S.equip[it.id] = true; else ST.give(S, it.gives || it.id, it.uses || 1); } // a sack fills the grain store
        }
      });
    } else if (tab === 1) {
      const inv = Object.keys(S.inv).filter((id) => IT.ITEMS[id] && !ST.endless(S, id) && S.inv[id] > 0); // endless sandbox stock is not for sale
      const k = site.id === 'market' ? 1.5 : 1;
      if (!inv.length) ui.text('Nothing to sell.', b.x + 6, y + 24, { size: 13, bold: false });
      ui.list('sell' + site.id, b.x, y, b.w, h, inv.length, 60, (i, x, yy, w) => {
        const it = IT.ITEMS[inv[i]], unit = it.id === 'shovel' ? 0 : Math.max(1, Math.round(IT.sellPrice(it.id) * (it.kind === 'loot' ? k : 1)));
        if (row(x, yy, w, { item: it.id, title: it.name + ' x' + S.inv[it.id], sub: it.id === 'shovel' ? 'Digs left. Not for sale.' : it.desc, price: unit || undefined, btn: unit ? 'Sell' : null, fill: pal.mustard, color: pal.ink })) { ST.take(S, it.id); earn(unit); }
      });
    } else upgrades(b.x, y, b.w, h, up);
  }
  function upgrades(x0, y0, w0, h0, ids) {
    ui.list('up' + site.id, x0, y0, w0, h0, ids.length, 60, (i, x, y, w) => {
      const u = IT.UPGRADES[ids[i]], lvl = S.up[ids[i]] || 0, max = lvl >= u.prices.length;
      if (u.open && !ST.openSea(S) && !max) { // the speedboat kit waits for the end of the story
        row(x, y, w, { icon: 'truck', iconCol: pal.grey, title: u.name, sub: 'Win the Grand Ring and pay off the bank, and Biu will fit it.', subCol: pal.grey, btn: 'Locked', off: true });
        return;
      }
      if (row(x, y, w, { icon: ids[i] === 'cage' || ids[i] === 'engine' || ids[i] === 'tires' ? 'truck' : ids[i] === 'nest' || ids[i] === 'incubator' ? 'egg' : ids[i] === 'dummy' ? 'weight' : 'home', iconCol: pal.teal,
        title: u.name + (u.prices.length > 1 ? ' (' + lvl + '/' + u.prices.length + ')' : ''), sub: u.desc, price: max ? undefined : u.prices[lvl], btn: max ? 'Done' : 'Buy', off: max })) {
        if (pay(u.prices[lvl])) S.up[ids[i]]++;
      }
    });
  }

  function vet(b) {
    const list = caged().filter((c) => c.hp < 0.99 || c.rest > 0 || c.cond < 1);
    if (!list.length) { ui.para(caged().length ? 'Everyone in your truck is in fine shape. (A worn-out bird needs a tonic, not me.)' : 'Bring a wounded creature in the truck and I will stitch it up. Wounds do not heal on their own.', b.x + 4, b.y + 6, b.w - 8, { size: 13 }); return; }
    ui.list('vet', b.x, b.y, b.w, b.h, list.length, 60, (i, x, y, w) => {
      const c = list[i], cost = 15 + Math.round((1 - c.hp) * 90) + (c.rest > 0 ? 25 : 0) + Math.round((1 - c.cond) * 40);
      if (row(x, y, w, { c, title: c.name, sub: common.statusOf(c).map((s) => s[0]).join(', ') || 'Run down', price: cost, btn: 'Heal' })) { if (pay(cost)) { c.hp = 1; c.rest = 0; c.cond = 1; c.hungry = 0; ST.dirty(c); say = c.name + '\'s wounds are healed.'; } }
    });
  }

  function bank(b) {
    ui.text('You owe', b.x + 6, b.y + 24, { size: 14, bold: false });
    ui.text('$' + S.debt, b.x + 6, b.y + 62, { size: 34, color: S.debt > 0 ? pal.brick : pal.teal });
    ui.bar(b.x + 6, b.y + 76, Math.min(360, b.w - 12), 12, 1 - S.debt / 15000, pal.teal);
    if (S.debt <= 0) { ui.para('Paid in full. Big Wattle shakes your hand as if it hurt him.', b.x + 6, b.y + 100, b.w - 12, { size: 13 }); return; }
    const amounts = [100, 1000, S.debt], bw = Math.min(130, (b.w - 24) / 3);
    amounts.forEach((a, i) => {
      const n = Math.min(a, S.debt);
      if (ui.btn(b.x + 6 + i * (bw + 6), b.y + 104, bw, 44, i === 2 ? 'Pay it all' : 'Pay $' + n, { disabled: S.money < n, size: 13 })) {
        S.money -= n; S.debt -= n; RB.audio.play('coin');
        if (S.debt <= 0) { common.checkAch(S); ui.message('Free as a bird', 'The last dollar lands on Big Wattle\'s desk. He counts it twice, sighs, and tears up the note.\n\nAunt Dalva\'s coop is yours, free and clear.', null, { head: pal.teal }); }
      }
    });
  }

  // ---- BFC: Brazil's Fried Chicken
  function bfc(b) {
    const sp = EC.bfcSpecial(S), ctx = ui.ctx;
    ui.rect(b.x, b.y, b.w, 56, '#d7372f', 10);
    RB.props.coronel(ctx, b.x + 34, b.y + 56, 0.72);
    ui.text('Today\'s special: ' + sp.label, b.x + 70, b.y + 24, { size: 15, color: pal.white, maxW: b.w - 80 });
    ui.text('Double pay for those. Everything else by the kilo.', b.x + 70, b.y + 42, { size: 11, color: pal.white, bold: false, maxW: b.w - 80 });
    // loyalty card
    const y1 = b.y + 64;
    ui.text('Loyalty card', b.x + 4, y1 + 15, { size: 12 });
    for (let i = 0; i < 10; i++) { const cx = b.x + 96 + i * 21; ui.rect(cx - 8, y1 + 2, 16, 16, i < S.bfc.stamps ? '#d7372f' : pal.soft, 8); if (i < S.bfc.stamps) ui.icon('check', cx, y1 + 10, 9, pal.white); }
    const list = caged();
    if (!list.length) { ui.para('Nothing in the cage. Bring the birds you are done with, or use the pick-up box in your yard.', b.x + 4, y1 + 30, b.w - 8, { size: 13 }); return; }
    ui.list('bfc', b.x, y1 + 26, b.w, b.h - 90, list.length, 60, (i, x, y, w) => {
      const c = list[i], P = ST.pheno(c), price = EC.bfcPrice(S, c), special = !c.person && EC.bfcIsSpecial(S, c);
      if (row(x, y, w, { c, title: c.name, sub: ST.kind(c) + ' · ' + common.fmtKg(P.weightKg) + (special ? ' · special!' : ''), subCol: special ? '#d7372f' : undefined, price, btn: 'Sell', fill: '#d7372f' })) {
        ui.confirm('Sell ' + c.name + '?', c.name + ' goes through the kitchen door and does not come back. $' + price + '.', 'Sell', () => {
          if (c.person) ST.soldPerson(S, c); else ST.fameLeave(S, c, 'Went through the BFC kitchen door');
          ST.removeBird(S, c); earn(price); S.bfc.sold++; S.bfc.stamps++; S.stats.sold++;
          for (const o of caged()) o.bond = Math.max(0, o.bond - 0.1);
          say = c.person ? 'The Coronel asks no questions. Secret recipe.' : caged().length ? 'A pleasure. The others saw nothing. Probably.' : 'A pleasure doing business.';
          if (S.bfc.stamps >= 10) { S.bfc.stamps -= 10; ST.give(S, 'bucket'); ui.toast('Card full! You get a BFC bucket to wear.', '#d7372f'); }
          common.checkAch(S);
        }, { fill: '#d7372f' });
      }
    });
  }

  // ---- neighbours: every one of them buys, sells and trades; some also do a thing of their own
  // (collectors buy relics, trainers fight you, the exotic dealer sells the strangest birds there are)
  function houseTabs(role) {
    const t = role === 'exotic' ? ['Buy', 'Sell', 'Trade'] : ['Sell', 'Buy', 'Trade'];
    if (role === 'collector') t.push('Relics');
    if (role === 'trainer') t.push('Duel');
    return t;
  }
  function house(b) {
    const role = keeper.role, st = RB.npc.info(S, keeper.id), names = houseTabs(role);
    st.credit = st.credit || 0; st.sold = st.sold || {};
    const y0 = b.y + tabs(names, b.x, b.y, b.w), h = b.h - (y0 - b.y), now = names[Math.min(tab, names.length - 1)];
    if (now === 'Sell') sellTo(b.x, y0, b.w, h, st);
    else if (now === 'Buy') buyFrom(b.x, y0, b.w, h, st);
    else if (now === 'Trade') tradeWith(b.x, y0, b.w, h, st);
    else if (now === 'Relics') relics(b.x, y0, b.w);
    else duel(b.x, y0, b.w);
  }
  // they buy your birds, paying more for what they wish for
  function sellTo(x0, y0, w0, h0, st) {
    const wish = RB.npc.wishOf(S, keeper), list = caged().filter((c) => !c.person);
    ui.text('Wants ' + wish.text + '.', x0 + 4, y0 + 12, { size: 12, bold: false, color: pal.plum, maxW: w0 - 8 });
    if (!list.length) { ui.para('Bring birds in your truck and I will make you an offer.', x0 + 4, y0 + 26, w0, { size: 13 }); return; }
    ui.list('offer' + keeper.id, x0, y0 + 20, w0, h0 - 20, list.length, 60, (i, x, yy, w) => {
      const c = list[i], m = wish.score(ST.pheno(c), c), price = RB.npc.offer(S, keeper, c);
      if (row(x, yy, w, { c, title: c.name, sub: RB.npc.fitText(m), subCol: m > 0.45 ? pal.teal : pal.grey, price, priceCol: m > 0.45 ? pal.teal : pal.ink, btn: 'Sell', fill: pal.mustard, color: pal.ink })) {
        ui.confirm('Sell ' + c.name + '?', keeper.name + ' pays $' + price + '. (Worth about $' + EC.value(c) + ' on a plain day.)', 'Sell', () => {
          ST.fameLeave(S, c, 'Sold to ' + keeper.name); ST.removeBird(S, c); earn(price); S.stats.sold++; st.n++; st.rel = Math.min(100, st.rel + (m > 0.45 ? 10 : 3));
          say = m > 0.45 ? 'Oh, look at it! Thank you!' : 'It will do.';
          common.checkAch(S);
        }, { fill: pal.teal });
      }
    });
  }
  // their own birds, paid in cash or with trade-in credit
  function buyFrom(x0, y0, w0, h0, st) {
    const stock = RB.npc.stockOf(S, world, keeper);
    ui.text(st.credit ? 'Your trade-in credit here: $' + st.credit : keeper.role === 'exotic' ? 'New arrivals every three days.' : 'A few birds of my own. New ones every three days.', x0 + 4, y0 + 12, { size: 12, bold: false, color: pal.plum, maxW: w0 - 8 });
    if (!stock.length) { ui.para('Sold out. Come back in a few days.', x0 + 4, y0 + 26, w0, { size: 13 }); return; }
    ui.list('stock' + keeper.id, x0, y0 + 20, w0, h0 - 20, stock.length, 60, (i, x, y, w) => {
      const s = stock[i], cash = Math.max(0, s.price - st.credit);
      const kind = s.momKey && s.dadKey && s.momKey !== s.dadKey ? RB.species.blendNames(s.dad, s.mom) : s.P.species.name;
      if (row(x, y, w, { P: s.P, title: s.name + ', ' + kind.toLowerCase(), sub: common.fmtKg(s.P.weightKg) + ' · power ' + s.P.rate.power + ' · speed ' + s.P.rate.speed + (s.P.odd.length ? ' · ' + s.P.odd.join(', ') : ''), subCol: s.P.odd.length ? pal.plum : undefined, price: cash, btn: cash < s.price ? 'Swap' : 'Buy' })) {
        if (pay(cash)) {
          st.credit -= s.price - cash; st.sold[s.key] = true;
          const c = ST.addBird(S, s.g, { at: 'cage', name: s.name, age: 3, bond: 0.2, origin: 'bought', mom: s.mom, dad: s.dad, momKey: s.momKey, dadKey: s.dadKey });
          common.discover(S, c); st.rel = Math.min(100, st.rel + 5);
          say = keeper.role === 'exotic' ? 'No refunds. Do not feed it after midnight.' : 'Look after it.';
          common.checkAch(S);
        }
      }
    });
  }
  // hand over a bird for credit towards one of theirs
  function tradeWith(x0, y0, w0, h0, st) {
    const list = caged().filter((c) => !c.person);
    ui.text('Trade-in credit: $' + st.credit + ' (spend it in Buy)', x0 + 4, y0 + 12, { size: 12, color: pal.plum, maxW: w0 - 8 });
    if (!list.length) { ui.para('Bring a bird in your truck to swap.', x0 + 4, y0 + 26, w0, { size: 13 }); return; }
    ui.list('trade' + keeper.id, x0, y0 + 20, w0, h0 - 20, list.length, 60, (i, x, y, w) => {
      const c = list[i], credit = Math.round(EC.value(c) * 0.9), old = ST.isRetired(c);
      if (row(x, y, w, { c, title: c.name, sub: old ? 'Retired: too old to breed.' : ST.kind(c), subCol: old ? pal.coral : undefined, price: old ? undefined : credit, btn: 'Trade', fill: pal.mustard, color: pal.ink, off: old })) {
        st.credit += credit; ST.fameLeave(S, c, 'Traded to ' + keeper.name); ST.removeBird(S, c); RB.audio.play('coin'); say = 'A fair swap. That is credit with me.';
      }
    });
  }
  function relics(x0, y0, w0) {
    const loot = Object.keys(S.inv).filter((id) => IT.ITEMS[id] && IT.ITEMS[id].kind === 'loot');
    if (!loot.length) { ui.para('No relics on you. Dig some up and bring them here.', x0 + 4, y0 + 6, w0, { size: 13 }); return; }
    const each = (id) => Math.round(IT.ITEMS[id].price * 0.9 * keeper.wealth);
    if (ui.btn(x0, y0, Math.min(260, w0), 36, 'Sell all relics ($' + loot.reduce((s, id) => s + each(id) * S.inv[id], 0) + ')', { fill: pal.mustard, color: pal.ink, size: 13 })) {
      let sum = 0; for (const id of loot) { sum += each(id) * S.inv[id]; delete S.inv[id]; }
      earn(sum); say = 'Marvellous. Dirt and all.';
    }
    loot.forEach((id, i) => ui.text(IT.ITEMS[id].name + ' x' + S.inv[id] + ' · $' + each(id) + ' each', x0 + 4, y0 + 60 + i * 18, { size: 12, bold: false }));
  }
  function duel(x0, y0, w0) {
    const ch = RB.npc.challengeOf(S, keeper);
    if (!ch) { ui.para('We have fought today. Come back tomorrow, if you dare.', x0 + 4, y0 + 6, w0, { size: 13 }); return; }
    common.portrait({ P: ch.opp.P }, x0 + 4, y0 + 4, 110, 110);
    ui.text(ch.opp.name, x0 + 124, y0 + 26, { size: 17 });
    ui.text(ch.opp.P.species.name + ' · ' + common.fmtKg(ch.opp.P.weightKg), x0 + 124, y0 + 46, { size: 12, bold: false });
    ui.text((ch.open ? 'Any weight' : RB.pheno.WEIGHT_CLASSES[ch.wc][0] + 'weight or lighter') + ' · stake $' + ch.fee + ' each', x0 + 124, y0 + 64, { size: 12, bold: false, maxW: w0 - 130 });
    if (ui.btn(x0 + 124, y0 + 76, 150, 40, 'Accept', { fill: pal.coral, disabled: S.money < ch.fee })) enterBout(ch, null, ch.opp);
  }

  // ---- your island's field station: the colony, bringing birds, and the radiation
  function isle(b) {
    const I = ST.isleOf(S, site.isle);
    if (!I) { ui.para('This station is not yours.', b.x + 4, b.y + 6, b.w, { size: 13 }); return; }
    const y0 = b.y + tabs(['Colony', 'Bring', 'Environment', 'Stay'], b.x, b.y, b.w), h = b.h - (y0 - b.y);
    if (tab === 0) {
      ui.text(I.birds.length + ' of ' + ST.isleCap(I) + ' living here · ' + (I.gen ? 'generation ' + I.gen : 'the founders') + (I.born ? ' · ' + I.born + ' hatched so far' : '') + (I.rad > 0.05 ? ' · radioactive' : ''), b.x + 4, y0 + 12, { size: 12, color: pal.plum, maxW: b.w - 8 });
      if (!I.birds.length) { ui.para('Nobody lives here yet. Bring birds (or people you netted) in the truck and leave them here (Bring): pairs raise young every so often, and generation follows generation. Stay a while to watch it happen.', b.x + 4, y0 + 26, b.w - 8, { size: 13 }); return; }
      const list = I.birds.slice().sort((a, c) => (c.gen || 0) - (a.gen || 0) || a.age - c.age);
      ui.list('isle' + I.id, b.x, y0 + 20, b.w, h - 20, list.length, 60, (i, x, y, w) => {
        const c = list[i], P = ST.pheno(c);
        if (row(x, y, w, { c, title: c.name + ' · gen ' + (c.gen || 0), sub: ST.kind(c) + ' · ' + P.stage + ', day ' + c.age + (P.odd.length ? ' · ' + P.odd.join(', ') : ''), subCol: P.odd.length ? pal.plum : undefined, btn: 'Take', fill: pal.mustard, color: pal.ink })) {
          ST.fromIsle(S, I, c); say = c.name + ' hops into the truck.'; RB.audio.play('click'); RB.game.save();
        }
      });
    } else if (tab === 1) {
      const list = caged();
      if (!list.length) { ui.para('Nobody in the truck. Bring birds from home, or net some out here. People you net can live here too.', b.x + 4, y0 + 6, b.w - 8, { size: 13 }); return; }
      const room = ST.isleCap(I) - I.birds.length;
      ui.text(room > 0 ? 'Room for ' + room + ' more. Leave a male and a female of whatever you like.' : 'The island is full: no room for more until some pass away.', b.x + 4, y0 + 12, { size: 12, color: room > 0 ? pal.teal : pal.coral, maxW: b.w - 8 });
      ui.list('bring' + I.id, b.x, y0 + 20, b.w, h - 20, list.length, 60, (i, x, y, w) => {
        const c = list[i];
        if (row(x, y, w, { c, title: c.name, sub: ST.kind(c) + ' · ' + (c.g.sex === 'M' ? 'male' : 'female'), btn: 'Leave', off: room <= 0 })) {
          if (!ST.toIsle(S, I, c)) { say = c.person ? c.name + ' looks around, sighs, and starts building a hut.' : c.name + ' wanders off into its new home.'; RB.audio.play('good'); RB.game.save(); }
        }
      });
    } else if (tab === 3) {
      stayTab(I, b, y0);
    } else {
      const lvl = I.rad, word = lvl < 0.05 ? 'clean' : lvl < 0.3 ? 'faintly radioactive' : lvl < 0.6 ? 'radioactive' : 'glowing hot';
      ui.text('The island is ' + word + '.', b.x + 4, y0 + 16, { size: 14 });
      ui.bar(b.x + 4, y0 + 26, Math.min(360, b.w - 8), 12, lvl, '#58c468');
      ui.para('Young born while the island is hot come out mutated: odd genes, extreme bodies, now and then teeth, two heads, a glow or extra legs. The hotter, the stranger. It fades a little every night.', b.x + 4, y0 + 52, b.w - 8, { size: 12 });
      const bw = Math.min(300, b.w - 8);
      const leave = (item) => { const why = ST.dose(S, I, item); if (why) { ui.toast(why, pal.coral); RB.audio.play('error'); } else { RB.audio.play('zap'); say = item === 'isotope' ? 'The isotope hums in the grass. Best not stand too close.' : 'The mushroom sinks into the soil.'; RB.game.save(); } };
      if (ui.btn(b.x + 4, y0 + 124, bw, 40, 'Leave an odd mushroom (' + ST.fmtCount(ST.count(S, 'mushroom')) + ')', { icon: 'mushroom', fill: pal.plum, size: 13, disabled: !ST.count(S, 'mushroom') })) leave('mushroom');
      if (ui.btn(b.x + 4, y0 + 172, bw, 40, 'Leave an isotope (' + ST.fmtCount(ST.count(S, 'isotope')) + ')', { icon: 'atom', fill: '#3f8f4a', size: 13, disabled: !ST.count(S, 'isotope') })) leave('isotope');
      if (ui.btn(b.x + 4, y0 + 220, bw, 40, 'Clean it up · $' + ST.CLEAN_COST, { fill: pal.teal, size: 13, disabled: lvl <= 0 })) { const why = ST.cleanIsle(S, I); if (why) ui.toast(why, pal.coral); else { say = 'Scrubbed clean. The next young will be ordinary again.'; RB.game.save(); } }
      ui.text('The Night Market sells odd mushrooms and isotopes.', b.x + 4, y0 + 280, { size: 11, bold: false, color: pal.grey, maxW: b.w - 8 });
    }
  }

  // Stay at the station for several nights in a row and let the generations roll by.
  function stayTab(I, b, y0) {
    const mouths = S.birds.length, grain = ST.count(S, 'grain') + S.feeder, nights = mouths ? Math.floor(grain / mouths) : Infinity;
    ui.para('Camp at the field station and let the days go by. Every night here counts as a night at home: the colony breeds and grows old, your birds at home age and their eggs hatch. Your birds at home and in the truck are fed from the grain in your bag.', b.x + 4, y0 + 6, b.w - 8, { size: 12 });
    const enough = ST.endless(S, 'grain') ? 'Endless grain: nobody goes hungry.' : nights === Infinity ? 'Nobody at home to feed.' : 'Grain (bag and feeder): ' + grain + ' for ' + mouths + ' mouth' + (mouths === 1 ? '' : 's') + ': enough for ' + nights + ' night' + (nights === 1 ? '' : 's') + '.';
    ui.text(enough, b.x + 4, y0 + 96, { size: 12, color: nights < 7 ? pal.coral : pal.teal, maxW: b.w - 8 });
    const opts = [[1, 'One night'], [3, 'Three nights'], [7, 'A week'], [15, 'Two weeks'], [ST.STAY_MAX, 'A month']];
    const cols = b.w > 420 ? 2 : 1, bw = (Math.min(b.w, 520) - 8 - (cols - 1) * 8) / cols;
    opts.forEach(([n, label], i) => {
      const x = b.x + 4 + (i % cols) * (bw + 8), y = y0 + 112 + Math.floor(i / cols) * 48;
      if (ui.btn(x, y, bw, 40, label, { icon: 'moon', fill: n > nights ? pal.brick : pal.plum, size: 13 })) {
        const gen0 = I.gen, res = ST.stay(S, n);
        RB.audio.play('tick'); common.checkAch(S); RB.game.save();
        say = n === 1 ? 'A quiet night under the stars.' : n + ' days later. Generation ' + I.gen + (I.gen > gen0 ? ', up from ' + gen0 : '') + '.';
        ui.message(n === 1 ? 'Morning on ' + I.name : n + ' days on ' + I.name, res.lines.join('\n'), null, { ok: 'Back to work' });
      }
    });
  }

  // ---- the Bone Quarry: what you have dug up so far, and how to make a bird of it
  function quarry(b) {
    const sets = Object.keys(IT.FOSSILS);
    ui.para('Dig anywhere in the roped-off pit south of my tent: most finds there are fossil fragments: nearly a third of them elephant bird, and now and then a dinosaur (a tyrannosaur, the ostrich-like Gallimimus, or a sail-backed Spinosaurus). Four fragments of one kind rebuild it at the Lab.', b.x + 4, b.y + 4, b.w - 8, { size: 13 });
    ui.list('quarry', b.x, b.y + 76, b.w, b.h - 76, sets.length, 60, (i, x, y, w) => {
      const id = sets[i], n = RB.lab.fragments(S, id), seen = S.codex.species[id];
      const where = id === 'pteranodon' ? ' · a flying reptile: only on islands out at sea' : RB.sea.SEA_FOSSILS.includes(id) ? ' · only on islands out at sea' : id === 'trex' ? ' · a dinosaur: here, or on volcanic islands' : id === 'gallimimus' ? ' · a dinosaur: only here' : id === 'spino' ? ' · a dinosaur: here, or on desert islands' : id === 'gastornis' ? ' · under farmland, here and out at sea' : '';
      row(x, y, w, { P: RB.pheno.express(RB.species.make(id, new Rng(RB.core.hashStr(id)), { sex: 'M', sport: 0 })), title: IT.FOSSILS[id] + (id === 'elephant' ? ' · the giant' : ''), sub: n + ' of ' + RB.lab.FRAGMENTS + ' fragments' + where + (n >= RB.lab.FRAGMENTS ? ' · ready to rebuild at the Lab' : '') + (seen ? ' · rebuilt before' : ''), subCol: n >= RB.lab.FRAGMENTS ? pal.teal : undefined });
    });
  }

  // ---- arenas
  function enterBout(card, arena, opp) {
    const list = caged().filter((c) => !EC.canEnter(S, c, card));
    const all = caged();
    common.pick('Who fights?', all, (c) => betWindow(card, arena, opp, c), (c) => { const why = EC.canEnter(S, c, card); return { text: why || RB.pheno.WEIGHT_CLASSES[ST.pheno(c).weightClass][0] + 'weight · ' + c.wins + '–' + c.losses, ok: !why, label: 'Send in' }; });
    void list;
  }
  // Before the bell: the two fighters' numbers side by side, and a bet. Nobody posts odds any more,
  // so you judge the birds yourself; a winning bet pays back three times the stake.
  const STATS = [['power', 'Power'], ['speed', 'Speed'], ['tough', 'Toughness'], ['stamina', 'Stamina'], ['guts', 'Guts'], ['wits', 'Wits'], ['fury', 'Fury']];
  function betWindow(card, arena, opp, c, exhibit) {
    let stake = 0, side = 0;
    const cap = arena ? arena.betCap : Math.max(100, card.fee * 5);
    const A = c ? { P: ST.pheno(c), name: c.name, hp: c.hp } : { P: exhibit.a.P, name: exhibit.a.name, hp: 1 };
    const B = { P: opp.P, name: opp.name, hp: 1 };
    ui.open({ draw() {
      const box = ui.window((exhibit ? 'Place a bet' : 'Before the bell') + ' · wins pay ' + EC.BET_RETURN + '×', 400, exhibit ? 450 : 410, {});
      if (!box) return;
      const H = box.h, ph = H > 330 ? 62 : 44, sideH = exhibit ? 40 : 0;
      const rows = STATS.length + 1, rowH = clamp((H - ph - 30 - sideH - 58 - 50 - 6) / rows, 10, 16);
      const pw = (box.w - 50) / 2, mid = box.x + box.w / 2;
      if (c) common.portrait(c, box.x, box.y, pw, ph); else common.portrait({ P: A.P }, box.x, box.y, pw, ph);
      common.portrait({ P: B.P }, box.x + pw + 50, box.y, pw, ph, { f: -1 });
      ui.text('vs', mid, box.y + ph / 2 + 6, { size: 16, align: 'center', color: pal.coral });
      let y = box.y + ph + 14;
      ui.text(A.name, box.x + pw / 2, y, { size: 13, align: 'center', maxW: pw });
      ui.text(B.name, box.x + pw + 50 + pw / 2, y, { size: 13, align: 'center', maxW: pw });
      y += 13;
      const sub = (F) => F.P.species.name + ' · ' + common.fmtKg(F.P.weightKg);
      ui.text(sub(A), box.x + pw / 2, y, { size: 10, align: 'center', bold: false, maxW: pw });
      ui.text(sub(B), box.x + pw + 50 + pw / 2, y, { size: 10, align: 'center', bold: false, maxW: pw });
      y += 5;
      // the numbers: each bar grows out from the middle, longer is better
      const bw = box.w / 2 - 72, fs = Math.min(10, rowH - 2); // room for the numbers at both ends
      const row = (label, va, vb, col) => {
        const ry = y + 1, bh = Math.max(4, rowH - 5);
        ui.rect(mid - 40 - bw, ry, bw, bh, pal.soft, bh / 2); ui.rect(mid + 40, ry, bw, bh, pal.soft, bh / 2);
        if (va > 0) ui.rect(mid - 40 - bw * va / 100, ry, bw * va / 100, bh, col, bh / 2);
        if (vb > 0) ui.rect(mid + 40, ry, bw * vb / 100, bh, col, bh / 2);
        ui.text(label, mid, ry + bh / 2 + 0.5, { size: fs, align: 'center', base: 'middle', bold: false });
        ui.text(String(va), mid - 44 - bw, ry + bh / 2 + 0.5, { size: fs, align: 'right', base: 'middle' });
        ui.text(String(vb), mid + 44 + bw, ry + bh / 2 + 0.5, { size: fs, align: 'left', base: 'middle' });
        y += rowH;
      };
      const cols = [pal.coral, pal.teal, pal.brick, pal.leaf, pal.mustard, pal.plum, '#d7372f'];
      STATS.forEach((st, i) => row(st[1], A.P.rate[st[0]], B.P.rate[st[0]], cols[i]));
      row('Health', Math.round(A.hp * 100), Math.round(B.hp * 100), pal.coral);
      y += 4;
      if (exhibit) {
        const half = (box.w - 8) / 2;
        if (ui.btn(box.x, y, half, 32, 'Back ' + A.name, { fill: side === 0 ? pal.ink : pal.soft, color: side === 0 ? pal.white : pal.ink, size: 12, flat: true })) side = 0;
        if (ui.btn(box.x + half + 8, y, half, 32, 'Back ' + B.name, { fill: side === 1 ? pal.ink : pal.soft, color: side === 1 ? pal.white : pal.ink, size: 12, flat: true })) side = 1;
        y += sideH;
      }
      const max = Math.max(0, Math.min(cap, S.money - (exhibit ? 0 : card.fee)));
      ui.text(stake ? 'Bet $' + stake + ' on ' + (side ? B.name : A.name) + ': win $' + stake * EC.BET_RETURN + ' back' : 'No bet (up to $' + max + ' here)', box.x, y + 13, { size: 13, maxW: box.w });
      [0, 0.25, 0.5, 1].forEach((f, i) => { const sw = (box.w - 18) / 4, v = Math.floor(max * f / 5) * 5; if (ui.btn(box.x + i * (sw + 6), y + 20, sw, 32, i === 0 ? 'None' : '$' + v, { fill: pal.mustard, color: pal.ink, size: 12, disabled: i > 0 && v <= 0 })) stake = v; });
      const fee = exhibit ? 0 : card.fee;
      if (ui.btn(box.x, box.y + box.h - 44, box.w, 44, exhibit ? (stake ? 'Bet and watch' : 'Just watch') : 'Fight!' + (fee ? ' (entry $' + fee + ')' : ''), { fill: pal.coral, disabled: S.money < fee + stake, key: 'Enter' })) {
        S.money -= fee + stake;
        ui.closeAll();
        RB.game.go('ring', { a: c ? { c } : exhibit.a, b: opp, card, arena, bet: { side, amount: stake, mult: EC.BET_RETURN - 1 }, back: 'site', backArgs: { site: site.id } });
      }
    } });
  }
  function arenaLobby(b) {
    const arena = EC.ARENA[site.id], lg = EC.leagueOf(S, arena.id), cards = EC.cards(S, arena), exs = [EC.exhibition(S, arena, 0), EC.exhibition(S, arena, 1)];
    const champ = RB.economy.bossOf(S, arena), held = lg.boss && lg.champ !== undefined ? ST.byId(S, lg.champ) : null;
    ui.text(lg.boss ? 'You are champion here' + (held ? ', with ' + held.name : lg.champName ? ', with ' + lg.champName : '') + '.' : lg.wins >= arena.need ? (champ.gen ? 'The title went to ' + champ.trainer + ' and ' + champ.bird + '. Take it back!' : 'Face ' + champ.trainer + ' for the title.') : 'Wins ' + lg.wins + ' of ' + arena.need + ' to face ' + champ.trainer, b.x + 4, b.y + 14, { size: 13, maxW: b.w - 8 });
    ui.bar(b.x + 4, b.y + 22, Math.min(300, b.w - 8), 8, lg.boss ? 1 : lg.wins / arena.need, pal.mustard);
    // what this arena does instead of ring-outs
    const tw = RB.fight.TWISTS[arena.modes[0]] || RB.fight.TWISTS.pit;
    ui.text(tw[0] + ': ' + tw[1], b.x + 4, b.y + 44, { size: 11, bold: false, color: pal.plum, maxW: b.w - 8 });
    // the exhibitions come first: there are always two to watch and bet on
    const rows = cards.length + exs.length, modes = {};
    for (const k of Object.keys(RB.fight.TWISTS)) modes[k] = RB.fight.TWISTS[k][0];
    modes.push = modes.mud; modes.aerial = modes.wind;
    ui.list('cards' + site.id, b.x, b.y + 54, b.w, b.h - 54, rows, 76, (i, x, y, w) => {
      ui.rect(x, y + 2, w - 6, 70, i < exs.length ? '#f1e6f4' : pal.paper, 10);
      if (i < exs.length) {
        const ex = exs[i];
        common.portrait({ P: ex.a.P }, x + 4, y + 7, 54, 60, { fill: pal.soft }); common.portrait({ P: ex.b.P }, x + 62, y + 7, 54, 60, { fill: pal.soft, f: -1 });
        ui.text('Exhibition: ' + ex.a.name + ' v ' + ex.b.name, x + 124, y + 24, { size: 13, maxW: w - 220 });
        ui.text(ex.a.P.species.name + ' v ' + ex.b.P.species.name, x + 124, y + 41, { size: 11, bold: false, maxW: w - 220 });
        ui.text(modes[ex.mode] + ' · watch and bet, any time', x + 124, y + 57, { size: 11, bold: false, color: pal.plum, maxW: w - 220 });
        if (ui.btn(x + w - 92, y + 18, 78, 38, 'Watch', { size: 13, fill: pal.plum })) betWindow({ key: ex.key, mode: ex.mode, fee: 0, exh: { arena: arena.id, slot: ex.slot } }, arena, ex.b, null, ex);
        return;
      }
      const card = cards[i - exs.length], opp = EC.opponentFor(S, arena, card), done = S.bets[card.key] === S.day && !card.boss;
      // which of your caged birds make this weight
      const fit = caged().filter((c) => ST.isAdult(c) && !ST.isRetired(c) && (card.open || ST.pheno(c).weightClass <= card.wc) && (!c.person || card.tier >= 3)).length;
      const cls = card.open ? 'Any weight' : RB.pheno.WEIGHT_CLASSES[card.wc][0] + 'weight';
      common.portrait({ P: opp.P }, x + 4, y + 7, 60, 60, { fill: card.boss ? pal.mustard : pal.soft, f: -1 });
      ui.text((card.boss ? 'BOSS · ' : '') + cls + ': ' + opp.name + ' (' + opp.trainer + ')', x + 72, y + 22, { size: 13, maxW: w - 170 });
      ui.text(opp.P.species.name + ' · ' + common.fmtKg(opp.P.weightKg) + ' · ' + modes[card.mode], x + 72, y + 38, { size: 11, bold: false, maxW: w - 170 });
      ui.text(fit ? fit + ' of yours in the truck can enter' : 'none of yours in the truck make this weight', x + 72, y + 52, { size: 11, bold: !!fit, color: fit ? pal.teal : pal.grey, maxW: w - 170 });
      ui.text('entry $' + card.fee + ' · purse $' + card.purse, x + 72, y + 66, { size: 11, color: pal.ink, maxW: w - 170 });
      if (ui.btn(x + w - 92, y + 18, 78, 38, done ? 'Done' : 'Enter', { size: 13, fill: card.boss ? pal.coral : pal.teal, disabled: done || S.money < card.fee })) enterBout(card, arena, opp);
    });
  }

  // ---- the sideshow: three small contests against three strangers
  function carnival(b) {
    const day = EC.showOfDay(S);
    ui.list('shows', b.x, b.y, b.w, b.h, EC.SHOWS.length, 60, (i, x, y, w) => {
      const sh = EC.SHOWS[i], done = S.bets['show:' + sh.id] === S.day;
      const sub = sh.id === 'pageant' ? 'Today the judges want ' + { big: 'size', tiny: 'something dainty', bright: 'bright colours', odd: 'the bizarre' }[day.taste] + '.' : sh.desc;
      if (row(x, y, w, { icon: sh.id === 'dash' ? 'bolt' : sh.id === 'hop' ? 'up' : 'star', iconCol: pal.coral, title: sh.name + ' · prize $' + sh.prize, sub, price: sh.fee, btn: done ? 'Done' : 'Enter', off: done || S.money < sh.fee })) {
        common.pick('Who goes in?', caged().filter((c) => !c.person), (c) => runShow(sh, c, day), (c) => { const why = ST.isRetired(c) ? 'Retired: too old for the show.' : ST.isAdult(c) ? '' : 'Too young.'; return { text: why, ok: !why, label: 'Send in' }; });
      }
    });
  }
  function runShow(sh, c, day) {
    S.money -= sh.fee; S.bets['show:' + sh.id] = S.day;
    const r = new Rng(day.seed ^ RB.core.hashStr(sh.id));
    const score = (P) => (sh.id === 'dash' ? 100 / EC.dashTime(P) : sh.id === 'hop' ? EC.hopHeight(P) * 10 : EC.pageantScore(P, day.taste)) * r.range(0.9, 1.1);
    const pool = ['chicken', 'duck', 'goose', 'turkey', 'pheasant', 'roadrunner', 'peafowl', 'heron', 'gull', 'parrot', 'quail', 'falcon'];
    const rows = [{ name: c.name, P: ST.pheno(c), me: true, c }];
    for (let i = 0; i < 3; i++) rows.push({ name: r.pick(ST.BIRD_NAMES), P: RB.pheno.express(RB.species.make(r.pick(pool), r, { sport: 0.1 })) });
    for (const e of rows) e.s = score(e.P);
    const top = Math.max(...rows.map((e) => e.s));
    rows.sort((a, b) => b.s - a.s);
    const won = rows[0].me;
    let k = 0, paid = false;
    ui.open({ draw(u, dt) {
      k = Math.min(1, k + dt * 0.6);
      const box = ui.window(sh.name, 360, 330, { close: false });
      rows.forEach((e, i) => {
        const y = box.y + i * 58;
        common.portrait(e.me ? e.c : { P: e.P }, box.x, y, 50, 50, { fill: e.me ? pal.mustard : pal.soft, draw: { phase: (t * 2) % 1, speed: sh.id === 'dash' && k < 1 ? 1 : 0 } });
        ui.text((k >= 1 ? (i + 1) + '. ' : '') + e.name, box.x + 58, y + 20, { size: 13 });
        ui.bar(box.x + 58, y + 28, box.w - 62, 12, e.s / top * k, e.me ? pal.coral : pal.teal);
      });
      if (k >= 1) {
        if (!paid) {
          paid = true; c.shows = (c.shows || 0) + 1; // the Hall of Fame keeps count
          if (won) { earn(sh.prize); c.bond = Math.min(1, c.bond + 0.04); c.showWins = (c.showWins || 0) + 1; if (c.showWins === 1) ST.note(S, c, 'won its first sideshow contest, the ' + sh.name); } else RB.audio.play('lose');
          ST.fameCheck(S); RB.game.save();
        }
        ui.text(won ? c.name + ' wins $' + sh.prize + '!' : c.name + ' did not place first.', box.x + box.w / 2, box.y + box.h - 54, { size: 14, align: 'center', color: won ? pal.teal : pal.ink });
        if (ui.btn(box.x + box.w / 2 - 70, box.y + box.h - 42, 140, 40, 'OK', { key: 'Enter' })) ui.close();
      }
    } });
  }

  const LINES = {
    feed: 'Grain, tonics and timber. What will it be?', tools: 'Nets catch birds. Shovels find what the birds cannot.', hatter: 'A bird without a hat is just poultry.', market: 'You did not buy it here.',
    garage: 'She will do sixty with a tail wind.', vet: 'Dazed? Pecked? I have seen worse.', bank: 'Every day you do not pay, I think of you.', bfc: 'It\'s finger-peckin\' good! What have you brought the Coronel?',
    quarry: 'Dig inside the ropes. Most of what comes up here is bone, and some of it is very, very big. Some of it has teeth.',
    carnival: 'Step right up! Fastest, highest, fairest!', backyard: 'Sand, a fence and a crowd. Same as it ever was.', county: 'We keep it clean here. Mostly.', city: 'Weigh in, pay up, and may the better bird win.',
    cellar: 'No names, no questions. People welcome, in their weight.', grand: 'Only champions stand on this sand.',
  };

  RB.scenes.site = {
    enter(args) {
      S = RB.game.S; world = RB.game.world; site = world.site[args.site]; tab = 0; t = 0;
      base = world.npcs.find((n) => n.site === site.id) || null;
      keeper = base ? RB.npc.current(S, base) : null;
      say = site.kind === 'house' || site.kind === 'exotic' ? RB.npc.greeting(S, keeper) : RB.npc.chirp(keeper) + (LINES[site.id] || site.line || 'Hello.');
      if (keeper) RB.npc.info(S, keeper.id).met = true;
      // the arenas' lobby and the night shops have music of their own; elsewhere the day or night music plays on
      RB.audio.setTune(site.id === 'cellar' || site.id === 'market' ? 'nightshop' : site.kind === 'arena' ? 'arena' : S.time >= 19 ? 'night' : 'day');
    },
    update(dt) { if (common.checkBroke(S, 'map')) return; t += dt; },
    draw(ctx) {
      const v = ui.view;
      ctx.fillStyle = site.id === 'cellar' ? '#4a4460' : site.id === 'bfc' ? '#f7e3de' : site.kind === 'exotic' ? '#efe2f2' : pal.cream; ctx.fillRect(0, 0, v.w, v.h);
      // header: who you are talking to, and what they say
      ui.rect(0, 0, v.w, 70, pal.ink);
      if (keeper) { // whoever minds the place (BFC's is the Coronel himself): tap the portrait to net them
        common.portrait({ P: RB.pheno.express(keeper.g) }, 8, 8, 54, 54, { fill: pal.paper, draw: { clothes: keeper.clothes } });
        if (RB.npc.vacancy(S, base) === '') common.keeperTap(S, base, 8, 8, 54, 54, () => { RB.game.go('map'); });
      }
      const name = keeper ? keeper.name : site.name;
      ui.text(site.kind === 'house' ? name : site.name, 70, 24, { size: 16, color: pal.white, maxW: v.w - 252 });
      const lines = ui.wrap((site.kind === 'house' || site.kind === 'isle' ? '' : name + ': ') + say, v.w - 252, 11, false);
      lines.slice(0, 3).forEach((ln, i) => ui.text(ln, 70, 40 + i * 13, { size: 11, color: pal.sand, bold: false }));
      ui.money(S.money, v.w - 104, 28, { size: 14, color: pal.white, align: 'right' });
      if (ui.btn(v.w - 96, 14, 88, 42, 'Leave', { icon: 'left', fill: pal.coral, size: 13, key: 'Escape' })) { RB.audio.play('click'); RB.game.save(); RB.game.go('map'); }
      ui.text('In the truck: ' + caged().length, v.w - 104, 50, { size: 11, color: pal.sand, align: 'right', bold: false });
      const bw = Math.min(v.w - 16, 640), b = { x: (v.w - bw) / 2, y: 78, w: bw, h: v.h - 86 };
      const k = site.kind;
      if (k === 'shop') shop(b);
      else if (k === 'garage') upgrades(b.x, b.y, b.w, b.h, Object.keys(IT.UPGRADES).filter((id) => IT.UPGRADES[id].at === 'garage'));
      else if (k === 'vet') vet(b);
      else if (k === 'bank') bank(b);
      else if (k === 'bfc') bfc(b);
      else if (k === 'house' || k === 'exotic') house(b);
      else if (k === 'quarry') quarry(b);
      else if (k === 'isle') isle(b);
      else if (k === 'arena') arenaLobby(b);
      else if (k === 'carnival') carnival(b);
    },
  };
})();
