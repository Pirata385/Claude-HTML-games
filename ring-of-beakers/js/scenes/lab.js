// scenes/lab.js — the genetics lab. Sequence a creature to see its fourteen chromosome pairs,
// pull a gene into a beaker, edit its bases at the CRISPR bench (a timing game on a ring of
// bases), inject it into another creature or an egg, and rebuild extinct birds from fossils.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, TAU } = RB.core;
  const ui = RB.ui, pal = RB.pal, ST = RB.state, common = RB.common, L = RB.lab, GN = RB.genome, IT = RB.items;
  const BASE_COL = ['#e76f51', '#2a9d8f', '#e9b44c', '#6d4c7d'], BASES = 'ACGT';

  let S, tab, subject, gene, t;
  const caged = () => ST.at(S, 'cage');
  function tiles(bases, x, y, s, gap) {
    for (let i = 0; i < 4; i++) { ui.rect(x + i * (s + gap), y, s, s, BASE_COL[bases[i]], Math.min(4, s / 4)); if (s >= 14) ui.text(BASES[bases[i]], x + i * (s + gap) + s / 2, y + s / 2 + 0.5, { size: s * 0.6, color: pal.white, align: 'center', base: 'middle' }); }
  }

  function genome(b) {
    const list = caged();
    if (!list.length) { ui.para('Bring creatures in the truck to study them.', b.x + 4, b.y + 6, b.w, { size: 13 }); return; }
    if (!subject || !list.includes(subject)) { subject = list[0]; gene = -1; }
    // who is on the table
    list.forEach((c, i) => {
      const x = b.x + i * 52;
      if (x + 48 > b.x + b.w) return;
      ui.rect(x, b.y, 48, 48, c === subject ? pal.mustard : pal.soft, 10);
      common.portrait(c, x + 3, b.y + 3, 42, 42, { fill: pal.paper });
      if (ui.tapIn(x, b.y, 48, 48)) { subject = c; gene = -1; RB.audio.play('click'); }
    });
    const y0 = b.y + 56;
    if (!S.lab.seq[subject.id]) {
      ui.para(subject.name + ' has not been sequenced. A first read also teaches the atlas a few genes.', b.x + 4, y0, b.w - 8, { size: 13 });
      if (ui.btn(b.x, y0 + 46, 220, 42, 'Sequence ($' + L.SEQ_FEE + ')', { icon: 'dna', disabled: S.money < L.SEQ_FEE })) {
        S.money -= L.SEQ_FEE;
        const learned = L.sequence(S, subject);
        RB.audio.play('zap'); common.checkAch(S);
        ui.message('Sequenced', learned.length ? 'New in the atlas: ' + learned.join(', ') + '.' : 'Nothing new for the atlas this time.');
      }
      return;
    }
    // the chromosomes: columns of genes, each with its two copies
    const g = subject.g, wide = b.w > 520;
    const detailH = 94, gridH = b.h - 56 - detailH - 6;
    const cw = b.w / GN.N_CHR, chH = Math.min(cw * 0.62 + 4, 34, (gridH - 14) / GN.GENES_PER_CHR), ts = Math.min((cw - 5) / 4 - 1, (chH - 5) / 2);
    for (let c = 0; c < GN.N_CHR; c++) {
      ui.text(c === GN.Z_CHR ? 'Z' : String(c + 1), b.x + c * cw + cw / 2, y0 + 10, { size: 10, align: 'center', color: pal.grey });
      for (let s = 0; s < GN.GENES_PER_CHR; s++) {
        const gi = c * GN.GENES_PER_CHR + s, x = b.x + c * cw + 1, y = y0 + 14 + s * chH, kn = L.known(S, gi), junk = !GN.GENES[gi].trait;
        ui.rect(x, y, cw - 2, chH - 2, gi === gene ? pal.ink : kn ? (junk ? '#ddd6c6' : pal.paper) : pal.soft, 4);
        tiles(GN.getGeneBases(g, gi, 'a'), x + 2.5, y + 2, ts, 1);
        if (!GN.isHemi(g, gi)) tiles(GN.getGeneBases(g, gi, 'b'), x + 2.5, y + 3 + ts, ts, 1);
        if (ui.tapIn(x, y, cw - 2, chH - 2)) { gene = gi; RB.audio.play('tick'); }
      }
    }
    // the chosen gene
    const dy = b.y + b.h - detailH;
    ui.rect(b.x, dy, b.w, detailH, pal.paper, 10);
    if (gene < 0) { ui.para('Tap a gene. Each has two copies, one from each parent (females have a single copy of Z genes). Known genes are pale; grey ones are still a mystery.', b.x + 8, dy + 6, b.w - 16, { size: 12 }); return; }
    const sa = GN.copySum(g.a, gene), hemi = GN.isHemi(g, gene), sb = hemi ? null : GN.copySum(g.b, gene);
    ui.text(L.geneLabel(S, gene) + '  ·  ' + GN.GENES[gene].mode + (hemi ? ' · one copy' : ''), b.x + 8, dy + 18, { size: 14, maxW: b.w - 16 });
    ui.text('A: ' + L.describe(S, gene, sa), b.x + 8, dy + 36, { size: 11, bold: false, maxW: (wide ? b.w - 260 : b.w - 16) });
    if (!hemi) ui.text('B: ' + L.describe(S, gene, sb), b.x + 8, dy + 51, { size: 11, bold: false, maxW: (wide ? b.w - 260 : b.w - 16) });
    const bx = wide ? b.x + b.w - 244 : b.x + 8, by = wide ? dy + 26 : dy + 58, bw = wide ? 118 : (b.w - 22) / 2;
    const take = (copy) => { const r = L.extract(S, subject, gene, copy); if (typeof r === 'string') { ui.toast(r + ' The lab sells them.', pal.coral); RB.audio.play('error'); } else { RB.audio.play('zap'); ui.toast('Extracted into a beaker. ' + subject.name + ' feels woozy.', pal.teal); } };
    if (ui.btn(bx, by, bw, wide ? 40 : 30, 'Extract A', { icon: 'beaker', size: 12 })) take('a');
    if (ui.btn(bx + bw + 6, by, bw, wide ? 40 : 30, 'Extract B', { icon: 'beaker', size: 12, disabled: hemi })) take('b');
  }

  function beakers(b) {
    const vials = S.lab.vials;
    ui.text('Enzyme: ' + ST.count(S, 'enzyme') + ' · empty beakers: ' + ST.count(S, 'beaker'), b.x + 4, b.y + 14, { size: 12, bold: false });
    if (!vials.length) { ui.para('No genes in beakers yet. Sequence a creature, tap a gene and extract a copy.', b.x + 4, b.y + 30, b.w - 8, { size: 13 }); return; }
    ui.list('vials', b.x, b.y + 24, b.w, b.h - 24, vials.length, 66, (i, x, y, w) => {
      const v = vials[i];
      ui.rect(x, y + 2, w - 6, 60, pal.paper, 10);
      tiles(v.bases, x + 8, y + 12, 22, 3);
      ui.text(L.geneLabel(S, v.gi), x + 116, y + 24, { size: 13, maxW: w - 290 });
      ui.text('from a ' + v.from.toLowerCase() + ' · ' + L.describe(S, v.gi, L.vialSum(v)), x + 116, y + 42, { size: 10, bold: false, maxW: w - 290 });
      if (ui.btn(x + w - 170, y + 13, 76, 38, 'Edit', { icon: 'dna', fill: pal.plum, size: 12 })) editWindow(v);
      if (ui.btn(x + w - 88, y + 13, 76, 38, 'Inject', { fill: pal.coral, size: 12 })) injectPick(v);
    });
  }
  function injectPick(v) {
    const targets = caged().map((c) => ({ c })).concat(S.eggs.map((e) => ({ e })));
    ui.open({ draw() {
      const box = ui.window('Inject ' + L.geneLabel(S, v.gi), 380, Math.min(ui.view.h - 16, 120 + Math.max(1, targets.length) * 62), {});
      if (!box) return;
      ui.text('Both copies are overwritten. An adult ages a day; an egg does not mind.', box.x, box.y + 10, { size: 11, bold: false, maxW: box.w });
      if (!targets.length) ui.text('Nobody in the cage, and no eggs at home.', box.x, box.y + 40, { size: 13 });
      ui.list('inj', box.x, box.y + 18, box.w, box.h - 18, targets.length, 62, (i, x, y, w) => {
        const tg = targets[i];
        ui.rect(x, y + 2, w - 6, 56, pal.soft, 10);
        if (tg.c) common.portrait(tg.c, x + 4, y + 6, 48, 48, { fill: pal.paper }); else RB.art.drawEgg(ui.ctx, x + 28, y + 30, 18, tg.e.col, tg.e.spot, tg.e.id);
        ui.text(tg.c ? tg.c.name : 'Egg (' + tg.e.dad + ' × ' + tg.e.mom + ')', x + 60, y + 26, { size: 13, maxW: w - 150 });
        ui.text(tg.c ? ST.kind(tg.c) : 'hatches day ' + tg.e.hatch, x + 60, y + 42, { size: 11, bold: false });
        if (ui.btn(x + w - 84, y + 12, 72, 36, 'Inject', { fill: pal.coral, size: 12 })) {
          L.inject(S, v, tg.c || tg.e, !tg.c);
          common.award(S, 'inject'); common.checkAch(S); RB.audio.play('poof');
          ui.close();
          ui.toast(tg.c ? tg.c.name + ' shudders, and changes.' : 'The egg glows for a moment.', pal.plum);
          RB.game.save();
        }
      });
    } });
  }
  // Choose which base to change and to what, then play the cut.
  function editWindow(v) {
    let pos = 0, to = (v.bases[0] + 1) % 4;
    ui.open({ draw() {
      const box = ui.window('CRISPR bench', 340, 318, {});
      if (!box) return;
      ui.text(L.geneLabel(S, v.gi), box.x, box.y + 12, { size: 14, maxW: box.w });
      ui.text('Now: ' + L.describe(S, v.gi, L.vialSum(v)), box.x, box.y + 30, { size: 11, bold: false, maxW: box.w });
      const s = 44, x0 = box.x + (box.w - (s * 4 + 30)) / 2;
      for (let i = 0; i < 4; i++) {
        const x = x0 + i * (s + 10), y = box.y + 44;
        if (i === pos) ui.rect(x - 4, y - 4, s + 8, s + 8, pal.ink, 10);
        ui.rect(x, y, s, s, BASE_COL[v.bases[i]], 8); ui.text(BASES[v.bases[i]], x + s / 2, y + s / 2 + 1, { size: 24, color: pal.white, align: 'center', base: 'middle' });
        if (ui.tapIn(x, y, s, s)) { pos = i; to = (v.bases[i] + 1) % 4; }
      }
      ui.text('Change base ' + (pos + 1) + ' to:', box.x, box.y + 118, { size: 12 });
      for (let k = 0; k < 4; k++) {
        const x = x0 + k * (s + 10), y = box.y + 126, same = k === v.bases[pos];
        ui.rect(x, y, s, 36, same ? pal.soft : BASE_COL[k], 8); ui.text(BASES[k], x + s / 2, y + 19, { size: 18, color: same ? pal.grey : pal.white, align: 'center', base: 'middle' });
        if (k === to && !same) { ui.ctx.strokeStyle = pal.ink; ui.ctx.lineWidth = 3; ui.rr(ui.ctx, x - 2, y - 2, s + 4, 40, 9); ui.ctx.stroke(); }
        if (!same && ui.tapIn(x, y, s, 36)) to = k;
      }
      const after = L.vialSum(v) - v.bases[pos] + to;
      ui.text('After: ' + L.describe(S, v.gi, after), box.x, box.y + 184, { size: 11, bold: false, maxW: box.w });
      ui.text('A is worth 0, C 1, G 2, T 3. Each cut uses one enzyme (you have ' + ST.count(S, 'enzyme') + ').', box.x, box.y + 202, { size: 10, bold: false, maxW: box.w, color: pal.grey });
      if (ui.btn(box.x, box.y + box.h - 46, box.w, 44, 'Cut', { icon: 'dna', fill: pal.plum, disabled: !ST.count(S, 'enzyme') || to === v.bases[pos] })) { ST.take(S, 'enzyme'); ui.close(); cutGame(v, pos, to); }
    } });
  }
  // The cut: a ring of bases turns under the blade. Cut when the next letter of the guide is
  // under it. Five good cuts make the edit; three bad ones scramble another base instead.
  function cutGame(v, pos, to) {
    const r = new Rng((Date.now() ^ v.id * 7919) >>> 0), N = 12, need = 5;
    const guide = L.guide(r, need), ring = [];
    for (let i = 0; i < N; i++) ring.push(r.int(0, 3));
    const ensure = (base) => { if (ring.filter((x) => x === base).length < 2) { ring[r.int(0, N - 1)] = base; ring[r.int(0, N - 1)] = base; } };
    ensure(guide[0]);
    let ang = 0, idx = 0, strikes = 0, flash = 0, good = true, done = 0;
    const under = () => { const a = ((-Math.PI / 2 - ang) % TAU + TAU) % TAU; return Math.floor(a / (TAU / N) + 0.5) % N; };
    ui.open({ draw(u, dt) {
      const v2 = ui.view, box = ui.window('Cut on the guide', 340, Math.min(v2.h - 16, 470), { close: false });
      const ctx = ui.ctx, cx = box.x + box.w / 2, R = Math.min(105, (box.h - 190) / 2), cy = box.y + 62 + R;
      flash = Math.max(0, flash - dt * 4);
      if (!done) ang += dt * (1.5 + idx * 0.28);
      // the guide
      for (let i = 0; i < need; i++) {
        const x = cx - (need * 30) / 2 + i * 30;
        ui.rect(x, box.y, 26, 26, i < idx ? pal.soft : BASE_COL[guide[i]], 6); ui.text(BASES[guide[i]], x + 13, box.y + 14, { size: 15, color: i < idx ? pal.grey : pal.white, align: 'center', base: 'middle' });
        if (i === idx && !done) { ctx.strokeStyle = pal.ink; ctx.lineWidth = 3; ui.rr(ctx, x - 2, box.y - 2, 30, 30, 7); ctx.stroke(); }
      }
      // the ring and the blade
      ctx.strokeStyle = pal.soft; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      const u0 = under();
      for (let i = 0; i < N; i++) {
        const a = ang + i * TAU / N, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.fillStyle = BASE_COL[ring[i]]; ctx.beginPath(); ctx.arc(x, y, i === u0 ? 17 : 14, 0, TAU); ctx.fill();
        ui.text(BASES[ring[i]], x, y + 1, { size: 14, color: pal.white, align: 'center', base: 'middle' });
      }
      ctx.fillStyle = flash > 0 ? (good ? pal.teal : pal.coral) : pal.ink;
      ctx.beginPath(); ctx.moveTo(cx - 12, cy - R - 34); ctx.lineTo(cx + 12, cy - R - 34); ctx.lineTo(cx, cy - R - 16); ctx.closePath(); ctx.fill();
      ui.icon('beaker', cx, cy, 44, pal.teal);
      for (let i = 0; i < 3; i++) ui.icon('close', cx - 24 + i * 24, cy + R + 34, 12, i < strikes ? pal.coral : pal.soft);
      const by = box.y + box.h - 52;
      if (done) {
        ui.text(done > 0 ? 'A clean edit.' : 'The blade slipped: another base changed.', cx, by - 8, { size: 13, align: 'center', color: done > 0 ? pal.teal : pal.coral });
        if (ui.btn(box.x, by, box.w, 48, 'OK', { key: 'Enter' })) { ui.close(); RB.game.save(); }
        return;
      }
      if (ui.btn(box.x, by, box.w, 48, 'CUT', { fill: pal.coral, key: 'Space', size: 18 }) || ui.tapIn(cx - R - 20, cy - R - 20, R * 2 + 40, R * 2 + 40)) {
        flash = 1;
        if (ring[u0] === guide[idx]) {
          good = true; idx++; RB.audio.play('good'); ring[u0] = r.int(0, 3);
          if (idx >= need) { done = 1; L.edit(v, pos, to); common.award(S, 'crispr'); RB.audio.play('win'); } else ensure(guide[idx]);
        } else { good = false; strikes++; RB.audio.play('bad'); if (strikes >= 3) { done = -1; L.offTarget(v, pos, r); } }
      }
    } });
  }

  function fossils(b) {
    const sets = Object.keys(IT.FOSSILS);
    ui.para('Fossil fragments turn up when you dig. Four of a kind and $' + L.REBUILD_COST + ' rebuild the animal as an egg, sent to your coop.', b.x + 4, b.y, b.w - 8, { size: 12 });
    ui.list('fossils', b.x, b.y + 40, b.w, b.h - 40, sets.length, 60, (i, x, y, w) => {
      const id = sets[i], n = L.fragments(S, id);
      ui.rect(x, y + 2, w - 6, 54, pal.paper, 10);
      ui.icon('skull', x + 28, y + 29, 26, n ? pal.ink : pal.grey);
      ui.text(IT.FOSSILS[id], x + 60, y + 24, { size: 14 });
      for (let k = 0; k < L.FRAGMENTS; k++) ui.rect(x + 60 + k * 20, y + 34, 16, 10, k < n ? pal.plum : pal.soft, 4);
      if (n > L.FRAGMENTS) ui.text('+' + (n - L.FRAGMENTS), x + 146, y + 44, { size: 11 });
      if (ui.btn(x + w - 100, y + 10, 88, 38, 'Rebuild', { size: 13, fill: pal.plum, disabled: n < L.FRAGMENTS || S.money < L.REBUILD_COST })) {
        const msg = L.rebuild(S, id);
        if (msg) ui.toast(msg, pal.coral); else { common.award(S, 'fossil'); RB.audio.play('zap'); ui.message('It lives', 'An egg is on its way to your coop. It hatches in two mornings.', null, { head: pal.plum }); RB.game.save(); }
      }
    });
  }
  function supplies(b) {
    const stock = IT.STOCK.lab;
    ui.list('labshop', b.x, b.y, b.w, b.h, stock.length, 60, (i, x, y, w) => {
      const it = IT.ITEMS[stock[i]];
      ui.rect(x, y + 2, w - 6, 54, pal.paper, 10); ui.itemIcon(it.id, x + 28, y + 29, 28);
      ui.text(it.name, x + 60, y + 23, { size: 14 }); ui.text(it.desc + ' · you have ' + ST.count(S, it.id), x + 60, y + 40, { size: 11, bold: false, maxW: w - 220 });
      ui.text('$' + it.price, x + w - 104, y + 33, { size: 14, align: 'right' });
      if (ui.btn(x + w - 92, y + 10, 78, 38, 'Buy', { size: 13, disabled: S.money < it.price })) { S.money -= it.price; ST.give(S, it.id); RB.audio.play('buy'); }
    });
  }

  RB.scenes.lab = {
    enter() { S = RB.game.S; tab = 0; subject = null; gene = -1; t = 0; RB.audio.setTune('lab'); },
    update(dt) { t += dt; },
    draw(ctx) {
      const v = ui.view;
      ctx.fillStyle = '#e4efec'; ctx.fillRect(0, 0, v.w, v.h);
      ui.rect(0, 0, v.w, 56, pal.ink);
      ui.icon('beaker', 28, 28, 30, pal.teal);
      ui.text('The Lab', 52, 24, { size: 16, color: pal.white });
      ui.text(S.lab.power ? 'Atlas: ' + L.knownCount(S) + ' of ' + GN.N_GENES + ' genes' : 'No power', 52, 42, { size: 11, color: pal.sand, bold: false });
      ui.money(S.money, v.w - 104, 33, { size: 14, color: pal.white, align: 'right' });
      if (ui.btn(v.w - 96, 8, 88, 40, 'Leave', { icon: 'left', fill: pal.coral, size: 13, key: 'Escape' })) { RB.game.save(); RB.game.go('map'); }
      const bw = Math.min(v.w - 16, 700), b = { x: (v.w - bw) / 2, y: 64, w: bw, h: v.h - 72 };
      if (!S.lab.power) {
        const n = ST.count(S, 'fuse');
        ui.panel(b.x, b.y, b.w, 190, {});
        ui.text('The generator is dead', b.x + 14, b.y + 28, { size: 17 });
        ui.para('Prof. Bequer: "Three fuses and we are in business. There is one buried by the red cross outside. Net & Spade can order them, and people have dug them up all over."', b.x + 14, b.y + 38, b.w - 28, { size: 12 });
        for (let i = 0; i < 3; i++) ui.icon('fuse', b.x + 34 + i * 44, b.y + 120, 34, i < n ? pal.mustard : pal.soft);
        if (ui.btn(b.x + 160, b.y + 100, 170, 42, 'Fit the fuses', { disabled: n < 3 })) { L.powerOn(S); RB.audio.play('zap'); common.checkAch(S); RB.game.save(); }
        return;
      }
      const names = ['Genome', 'Beakers', 'Fossils', 'Supplies'], tw = Math.min(110, (b.w - 18) / 4);
      names.forEach((n, i) => { if (ui.btn(b.x + i * (tw + 6), b.y, tw, 32, n, { fill: tab === i ? pal.ink : pal.paper, color: tab === i ? pal.white : pal.ink, size: 12, flat: true })) { tab = i; RB.audio.play('click'); } });
      const c = { x: b.x, y: b.y + 40, w: b.w, h: b.h - 40 };
      if (tab === 0) genome(c); else if (tab === 1) beakers(c); else if (tab === 2) fossils(c); else supplies(c);
    },
  };
})();
