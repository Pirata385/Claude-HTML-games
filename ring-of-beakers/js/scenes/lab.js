// scenes/lab.js — the genetics lab. Sequence a creature to see its fourteen chromosome pairs (every gene
// is mapped), pull a gene into a (free) beaker, edit its bases at the CRISPR bench (a timing game on a
// ring of bases), inject it into another creature or an egg, and rebuild extinct birds from fossils.
// In a normal game sequencing, each edit and each injection cost money (lab.js: FEES); a sandbox is free.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, TAU, clamp } = RB.core;
  const ui = RB.ui, pal = RB.pal, ST = RB.state, common = RB.common, L = RB.lab, GN = RB.genome, IT = RB.items;
  const BASE_COL = ['#e76f51', '#2a9d8f', '#e9b44c', '#6d4c7d'], BASES = 'ACGT';

  let S, tab, subject, gene, t, base;
  const caged = () => ST.at(S, 'cage');
  function tiles(bases, x, y, s, gap) {
    for (let i = 0; i < 4; i++) { ui.rect(x + i * (s + gap), y, s, s, BASE_COL[bases[i]], Math.min(4, s / 4)); if (s >= 14) ui.text(BASES[bases[i]], x + i * (s + gap) + s / 2, y + s / 2 + 0.5, { size: s * 0.6, color: pal.white, align: 'center', base: 'middle' }); }
  }

  // The fourteen chromosome pairs as a grid of genes, each tile showing its two copies. Coding genes
  // are pale, junk DNA darker, the selected gene dark, and the other genes of its trait glow green.
  // Tapping a tile picks that gene.
  function genomeGrid(g, x0, y0, w, h, sel, onPick) {
    const cw = w / GN.N_CHR, chH = Math.min(cw * 0.62 + 4, 34, (h - 14) / GN.GENES_PER_CHR), ts = Math.min((cw - 5) / 4 - 1, (chH - 5) / 2);
    const rel = sel >= 0 ? new Set(L.related(sel)) : null, ctx = ui.ctx, pulse = 0.75 + 0.25 * Math.sin(t * 3);
    for (let c = 0; c < GN.N_CHR; c++) {
      ui.text(c === GN.Z_CHR ? 'Z' : String(c + 1), x0 + c * cw + cw / 2, y0 + 10, { size: 10, align: 'center', color: pal.grey });
      for (let sl = 0; sl < GN.GENES_PER_CHR; sl++) {
        const gi = c * GN.GENES_PER_CHR + sl, x = x0 + c * cw + 1, y = y0 + 14 + sl * chH, junk = !GN.GENES[gi].trait;
        if (rel && rel.has(gi)) { // a soft green glow round its partners
          ctx.save(); ctx.shadowColor = 'rgba(72, 196, 96, ' + (0.9 * pulse).toFixed(2) + ')'; ctx.shadowBlur = 12; ctx.strokeStyle = 'rgba(88, 200, 108, ' + pulse.toFixed(2) + ')'; ctx.lineWidth = 2.5;
          ui.rr(ctx, x - 1, y - 1, cw, chH, 5); ctx.stroke(); ctx.restore();
        }
        ui.rect(x, y, cw - 2, chH - 2, gi === sel ? pal.ink : rel && rel.has(gi) ? '#e6f5e2' : junk ? '#ddd6c6' : pal.paper, 4);
        tiles(GN.getGeneBases(g, gi, 'a'), x + 2.5, y + 2, ts, 1);
        if (!GN.isHemi(g, gi)) tiles(GN.getGeneBases(g, gi, 'b'), x + 2.5, y + 3 + ts, ts, 1);
        if (ui.tapIn(x, y, cw - 2, chH - 2)) { onPick(gi); RB.audio.play('tick'); }
      }
    }
  }
  function genome(b) {
    const list = caged();
    if (!list.length) { ui.para('Bring creatures in the truck to study them.', b.x + 4, b.y + 6, b.w, { size: 13 }); return; }
    if (!subject || !list.includes(subject)) { subject = list[0]; gene = -1; }
    // who is on the table, a whole-genome copy of them, and a change of sex
    const cbw = b.w > 520 ? 170 : 116, sbw = b.w > 520 ? 132 : 96;
    list.forEach((c, i) => {
      const x = b.x + i * 52;
      if (x + 48 > b.x + b.w - cbw - sbw - 14) return;
      ui.rect(x, b.y, 48, 48, c === subject ? pal.mustard : pal.soft, 10);
      common.portrait(c, x + 3, b.y + 3, 42, 42, { fill: pal.paper });
      if (ui.tapIn(x, b.y, 48, 48)) { subject = c; gene = -1; RB.audio.play('click'); }
    });
    if (ui.btn(b.x + b.w - cbw, b.y + 2, cbw, 44, b.w > 520 ? 'Copy whole genome' : 'Copy genome', { icon: 'dna', fill: pal.plum, size: 12, disabled: !L.sequenced(S, subject) })) {
      L.copyGenome(S, subject); RB.audio.play('zap');
      ui.toast('All of ' + subject.name + '\'s genes are in one beaker. ' + subject.name + ' is worn out for today, not hurt.', pal.plum);
    }
    const male = subject.g.sex === 'M';
    if (ui.btn(b.x + b.w - cbw - sbw - 6, b.y + 2, sbw, 44, b.w > 520 ? (male ? 'Make female' : 'Make male') : (male ? 'To female' : 'To male'), { icon: 'heart', fill: male ? '#d98cab' : '#3d6fa5', size: 12 })) {
      const c = subject;
      ui.confirm('Change ' + c.name + '\'s sex?', c.name + ' is ' + (male ? 'male' : 'female') + '. The lab can make ' + (c.person ? (male ? 'him a woman' : 'her a man') : (male ? 'it a female' : 'it a male')) + ' for good: ' + (male ? 'one Z chromosome becomes a W' : 'the Z chromosome is doubled') + '. It is free, and leaves ' + c.name + ' worn out for today.', 'Change', () => {
        const sex = L.changeSex(S, c); RB.audio.play('zap'); gene = -1; RB.game.save();
        ui.toast(c.name + ' is now ' + (sex === 'F' ? 'female' : 'male') + ': a ' + ST.kind(c).toLowerCase() + '.', pal.plum);
      }, { fill: pal.plum });
    }
    const y0 = b.y + 56, g = subject.g, wide = b.w > 520, detailH = 94;
    if (!L.sequenced(S, subject)) { // a creature's genome has to be read first (once)
      ui.para(subject.name + '\'s genome has not been read yet. Sequencing reads all of it, once, for $' + L.feeOf(S, 'sequence') + '. Then you can study its genes, take them out and copy them.', b.x + 4, y0 + 6, b.w - 8, { size: 13 });
      if (ui.btn(b.x + 4, y0 + 70, 240, 44, 'Sequence · $' + L.feeOf(S, 'sequence'), { icon: 'dna', fill: pal.teal, disabled: S.money < L.feeOf(S, 'sequence') })) {
        const why = L.sequence(S, subject);
        if (why) ui.toast(why, pal.coral); else { RB.audio.play('zap'); ui.toast(subject.name + '\'s genome is read.', pal.teal); RB.game.save(); }
      }
      return;
    }
    genomeGrid(g, b.x, y0, b.w, b.h - 56 - detailH - 6, gene, (gi) => { gene = gi; });
    // the chosen gene
    const dy = b.y + b.h - detailH;
    ui.rect(b.x, dy, b.w, detailH, pal.paper, 10);
    if (gene < 0) { ui.para('Every gene is mapped. Tap one: each has two copies, one from each parent (females have a single copy of Z genes). Darker tiles are junk DNA.', b.x + 8, dy + 6, b.w - 16, { size: 12 }); return; }
    const hemi = GN.isHemi(g, gene);
    const partners = L.related(gene);
    ui.text(L.geneLabel(S, gene) + '  ·  ' + GN.GENES[gene].mode + (hemi ? ' · one copy' : '') + (partners.length ? '  ·  works with ' + partners.map((x) => L.geneLabel(S, x)).join(', ') + ' (green)' : ''), b.x + 8, dy + 18, { size: 14, maxW: b.w - (GN.GENES[gene].trait ? 52 : 16) });
    if (GN.GENES[gene].trait && ui.btn(b.x + b.w - 38, dy + 4, 32, 24, '?', { fill: pal.teal, size: 15, flat: true, r: 8 })) { guideJump = GN.GENES[gene].trait; tab = 3; RB.audio.play('click'); }
    ui.text('A: ' + L.describe(S, gene, GN.getGeneBases(g, gene, 'a')), b.x + 8, dy + 36, { size: 11, bold: false, maxW: (wide ? b.w - 260 : b.w - 16) });
    if (!hemi) ui.text('B: ' + L.describe(S, gene, GN.getGeneBases(g, gene, 'b')), b.x + 8, dy + 51, { size: 11, bold: false, maxW: (wide ? b.w - 260 : b.w - 16) });
    const bx = wide ? b.x + b.w - 244 : b.x + 8, by = wide ? dy + 26 : dy + 58, bw = wide ? 118 : (b.w - 22) / 2;
    const take = (copy) => { L.extract(S, subject, gene, copy); RB.audio.play('zap'); ui.toast('Extracted into a beaker. ' + subject.name + ' is worn out for today, not hurt.', pal.teal); };
    if (ui.btn(bx, by, bw, wide ? 40 : 30, 'Extract A', { icon: 'beaker', size: 12 })) take('a');
    if (ui.btn(bx + bw + 6, by, bw, wide ? 40 : 30, 'Extract B', { icon: 'beaker', size: 12, disabled: hemi })) take('b');
  }

  function beakers(b) {
    const vials = S.lab.vials;
    ui.text((S.sandbox ? 'Sandbox: everything in the lab is free.' : 'Beakers are free; each edit costs $' + L.EDIT_FEE + ', each injection $' + L.INJECT_FEE + ' (a clone $' + L.CLONE_FEE + ').') + ' Whole genomes stay in their beaker after an injection.', b.x + 4, b.y + 14, { size: 12, bold: false, maxW: b.w - 8 });
    if (!vials.length) { ui.para('No beakers yet. In the Genome tab, tap a gene and extract a copy, or copy a creature\'s whole genome.', b.x + 4, b.y + 30, b.w - 8, { size: 13 }); return; }
    const narrow = b.w < 520, bw = narrow ? 60 : 76, gap = 6, tx = narrow ? 64 : 116, tw = b.w - tx - 3 * bw - 3 * gap - 16;
    ui.list('vials', b.x, b.y + 24, b.w, b.h - 24, vials.length, 66, (i, x, y, w) => {
      const v = vials[i];
      ui.rect(x, y + 2, w - 6, 60, v.full ? '#f1e6f4' : pal.paper, 10);
      if (v.full) {
        common.portrait({ P: RB.pheno.express(L.vialGenome(v)) }, x + 6, y + 6, narrow ? 52 : 100, 52, { fill: pal.paper });
        ui.text('Whole genome: ' + v.name, x + tx, y + 24, { size: 13, maxW: tw });
        ui.text(v.from + ' · all ' + GN.N_GENES + ' genes · inject to make a clone', x + tx, y + 42, { size: 10, bold: false, maxW: tw });
      } else {
        if (narrow) tiles(v.bases, x + 6, y + 18, 12, 1); else tiles(v.bases, x + 8, y + 12, 22, 3);
        ui.text(L.geneLabel(S, v.gi) + '  ·  copy ' + (v.copy === 'b' ? 'B' : 'A'), x + tx, y + 24, { size: 13, maxW: tw });
        ui.text('from a ' + v.from.toLowerCase() + ' · ' + L.describe(S, v.gi, v.bases), x + tx, y + 42, { size: 10, bold: false, maxW: tw });
      }
      const bx0 = x + w - 6 - 3 * bw - 2 * gap;
      if (ui.btn(bx0, y + 13, bw, 38, 'Edit', { icon: narrow ? 'dna' : null, fill: pal.plum, size: 12 })) { if (v.full) genomeEditor(v); else editWindow(singleGene(v)); }
      if (ui.btn(bx0 + bw + gap, y + 13, bw, 38, 'Inject', { fill: pal.coral, size: 12 })) injectPick(v);
      if (ui.btn(bx0 + 2 * (bw + gap), y + 13, bw, 38, narrow ? '' : 'Delete', { icon: 'trash', fill: pal.grey, size: 12 })) {
        ui.confirm('Throw this beaker away?', (v.full ? 'The copy of ' + v.name + '\'s genome' : L.geneLabel(S, v.gi)) + ' goes down the sink.', 'Throw away', () => { L.removeVial(S, v); RB.audio.play('poof'); RB.game.save(); });
      }
    });
  }
  // Pick who gets the beaker. A single gene goes into one copy of the receiver's gene, A or B (the
  // copy it was taken from, unless you pick the other), or into both.
  const INTO = [['a', 'Copy A'], ['b', 'Copy B'], ['both', 'Both']];
  function injectPick(v) {
    const targets = caged().map((c) => ({ c })).concat(S.eggs.map((e) => ({ e })));
    let into = v.copy === 'b' ? 'b' : 'a';
    ui.open({ draw() {
      const top = v.full ? 18 : 62;
      const box = ui.window(v.full ? 'Clone ' + v.name : 'Inject ' + L.geneLabel(S, v.gi), 380, Math.min(ui.view.h - 16, 102 + top + Math.max(1, targets.length) * 62), {});
      if (!box) return;
      if (v.full) ui.text('The receiver becomes a clone of ' + v.name + ', but keeps its own age. Pick one to preview.', box.x, box.y + 10, { size: 11, bold: false, maxW: box.w });
      else {
        const what = { a: 'Only copy A of the receiver\'s gene is overwritten', b: 'Only copy B of the receiver\'s gene is overwritten', both: 'Both copies of the receiver\'s gene are overwritten' }[into];
        ui.text(what + (into === 'both' ? '.' : '; the other copy stays as it is.') + ' This beaker came from copy ' + (v.copy === 'b' ? 'B' : 'A') + '.', box.x, box.y + 10, { size: 11, bold: false, maxW: box.w });
        const bw = (box.w - 12) / 3;
        INTO.forEach(([id, label], i) => {
          if (ui.btn(box.x + i * (bw + 6), box.y + 20, bw, 30, label, { fill: into === id ? pal.ink : pal.soft, color: into === id ? pal.white : pal.ink, size: 12, flat: true })) { into = id; RB.audio.play('click'); }
        });
        if (GN.GENES[v.gi].chr === GN.Z_CHR) ui.text('A Z gene: a female has a single copy of it, and either button writes that copy.', box.x, box.y + 60, { size: 10, bold: false, color: pal.grey, maxW: box.w });
      }
      if (!targets.length) ui.text('Nobody in the cage, and no eggs at home.', box.x, box.y + top + 22, { size: 13 });
      ui.list('inj', box.x, box.y + top, box.w, box.h - top, targets.length, 62, (i, x, y, w) => {
        const tg = targets[i];
        ui.rect(x, y + 2, w - 6, 56, pal.soft, 10);
        if (tg.c) common.portrait(tg.c, x + 4, y + 6, 48, 48, { fill: pal.paper }); else RB.art.drawEgg(ui.ctx, x + 28, y + 30, 18, tg.e.col, tg.e.spot, tg.e.id);
        ui.text(tg.c ? tg.c.name : 'Egg (' + tg.e.dad + ' × ' + tg.e.mom + ')', x + 60, y + 26, { size: 13, maxW: w - 150 });
        ui.text(tg.c ? ST.kind(tg.c) : 'hatches day ' + tg.e.hatch, x + 60, y + 42, { size: 11, bold: false });
        if (ui.btn(x + w - 90, y + 12, 78, 36, 'Preview', { icon: 'eye', fill: pal.plum, size: 12 })) previewWindow(v, tg, into);
      });
    } });
  }
  // Two creatures side by side at the same scale, feet on the same ground, so a change of size or
  // proportion shows as it is.
  function drawPair(A, B, x, y, w, h, gap, opts) {
    const ctx = ui.ctx, t = ui.time;
    const poseA = RB.pose.animPose(A, { x: 0, y: 0, f: 1, time: t }), poseB = RB.pose.animPose(B, { x: 0, y: 0, f: 1, time: t });
    const ba = RB.pose.bounds(A, poseA), bb = RB.pose.bounds(B, poseB);
    const sc = Math.min((w - 12) / Math.max(ba.x1 - ba.x0, bb.x1 - bb.x0), (h - 14) / Math.max(-Math.min(ba.y0, bb.y0), 1));
    [[A, poseA, ba, x, pal.soft], [B, poseB, bb, x + w + gap, '#efe2f3']].forEach(([P, pose, b, bx, fill]) => {
      ui.rect(bx, y, w, h, fill, 10);
      ctx.save(); ui.rr(ctx, bx, y, w, h, 10); ctx.clip();
      ctx.fillStyle = 'rgba(35,49,74,0.12)'; ctx.fillRect(bx, y + h - 8, w, 8);
      ctx.translate(bx + w / 2 - (b.x0 + b.x1) / 2 * sc, y + h - 8); ctx.scale(sc, sc);
      RB.art.drawCreature(ctx, P, pose, opts || {});
      ctx.restore();
    });
  }
  // Before and after: the creature as it is and as it would be with this gene, its numbers and
  // what changes. Nothing happens until you press Inject.
  const STATS = [['power', 'Power'], ['speed', 'Speed'], ['tough', 'Toughness'], ['stamina', 'Stamina'], ['guts', 'Guts'], ['wits', 'Wits'], ['fury', 'Fury']];
  function previewWindow(v, tg, into) {
    const isEgg = !tg.c, target = tg.c || tg.e, pv = L.preview(S, v, target, isEgg, into), A = pv.before, B = pv.after;
    const fmt = (x) => (typeof x === 'string' ? x : Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(2));
    const lines = [];
    if (pv.full) {
      lines.push(['Whole genome of ' + v.name + ' (' + v.from + '): a clone, at ' + (isEgg ? 'the egg\'s' : tg.c.name + '\'s') + ' age.', pal.plum]);
      if (pv.tooOld) lines.push(['Too old for this body: ' + tg.c.name + ' would be retired at once.', pal.coral]);
      if (!isEgg && tg.c.person) lines.push([tg.c.name + ' stops being a person. Their house will stand empty.', pal.coral]);
    } else {
      const one = GN.isHemi(target.g, v.gi);
      lines.push([one ? 'Into its single copy of this Z gene.' : pv.into === 'both' ? 'Into both copies of the gene.' : 'Into copy ' + pv.into.toUpperCase() + ' only; copy ' + (pv.into === 'a' ? 'B' : 'A') + ' stays as it is.', pal.plum]);
      if (!pv.trait) lines.push(['This gene does nothing anyone can see.', pal.grey]);
      else {
        const name = pv.trait.known ? pv.trait.label : 'An unknown trait';
        lines.push([name + ': ' + fmt(pv.trait.from) + ' → ' + fmt(pv.trait.to), pv.trait.from === pv.trait.to || Math.abs(pv.trait.to - pv.trait.from) < 1e-3 ? pal.grey : pal.ink]);
      }
    }
    lines.push(['Weight: ' + common.fmtKg(A.weightKg) + ' → ' + common.fmtKg(B.weightKg) + (B.weightClass !== A.weightClass ? ' (' + RB.pheno.WEIGHT_CLASSES[B.weightClass][0] + 'weight)' : ''), B.weightClass !== A.weightClass ? pal.plum : pal.ink]);
    if (B.species.name !== A.species.name) lines.push(['Would look like: ' + B.species.name, pal.plum]);
    for (const o of B.odd) if (!A.odd.includes(o)) lines.push(['Gains ' + o, pal.teal]);
    for (const o of A.odd) if (!B.odd.includes(o)) lines.push(['Loses ' + o, pal.coral]);
    if (A.css.body !== B.css.body || A.css.wing !== B.css.wing || A.css.tail !== B.css.tail) lines.push(['Its colours change.', pal.ink]);
    ui.open({ draw() {
      const box = ui.window('Preview: ' + (isEgg ? 'the egg' : tg.c.name), 440, 520, {});
      if (!box) return;
      const H = box.h, ph = clamp(H - 30 - (7 * 15 + 12) - lines.length * 15 - 28 - 52, 56, 190), pw = (box.w - 36) / 2;
      const opts = isEgg ? {} : common.drawOpts(tg.c);
      drawPair(A, B, box.x, box.y, pw, ph, 36, opts);
      ui.icon('right', box.x + box.w / 2, box.y + ph / 2, 22, pal.plum);
      let y = box.y + ph + 14;
      ui.text(isEgg ? 'Hatches as' : 'Now', box.x + pw / 2, y, { size: 12, align: 'center' });
      ui.text(pv.full ? 'The clone' : isEgg ? 'With this gene' : 'After the injection', box.x + pw + 36 + pw / 2, y, { size: 12, align: 'center', color: pal.plum });
      y += 8;
      // the numbers: now, a bar for after, after, and the change
      for (const st of STATS) {
        const a = A.rate[st[0]], b = B.rate[st[0]], d = b - a, cap = Math.max((A.rateCap || {})[st[0]] || 100, (B.rateCap || {})[st[0]] || 100);
        ui.text(st[1], box.x, y + 11, { size: 11, bold: false });
        ui.text(String(a), box.x + 104, y + 11, { size: 11, align: 'right', color: pal.grey });
        ui.bar(box.x + 112, y + 4, box.w - 112 - 84, 8, b / cap, d > 0 ? pal.teal : d < 0 ? pal.coral : pal.grey);
        ui.text(String(b), box.x + box.w - 44, y + 11, { size: 11, align: 'right' });
        if (d) ui.text((d > 0 ? '+' : '') + d, box.x + box.w, y + 11, { size: 11, align: 'right', color: d > 0 ? pal.teal : pal.coral });
        y += 15;
      }
      y += 4;
      for (const ln of lines) { ui.text(ln[0], box.x, y + 11, { size: 11, color: ln[1], maxW: box.w }); y += 15; }
      ui.text(isEgg ? 'The egg takes the ' + (pv.full ? 'genome' : 'gene') + ' and hatches as usual.' : tg.c.name + ' will be worn out for today, but not hurt.' + (pv.full ? ' The beaker is kept.' : ''), box.x, y + 13, { size: 11, bold: false, color: pal.grey, maxW: box.w });
      const by = box.y + box.h - 42, half = (box.w - 8) / 2;
      if (ui.btn(box.x, by, half, 40, 'Back', { fill: pal.grey, key: 'Escape' })) { ui.close(); return; }
      const fee = L.feeOf(S, pv.full ? 'clone' : 'inject');
      if (ui.btn(box.x + half + 8, by, half, 40, (pv.full ? 'Make the clone' : 'Inject') + (fee ? ' · $' + fee : ''), { icon: 'beaker', fill: pal.coral, key: 'Enter', disabled: S.money < fee })) {
        const why = L.pay(S, pv.full ? 'clone' : 'inject');
        if (why) { ui.toast(why, pal.coral); return; }
        L.inject(S, v, target, isEgg, into);
        common.award(S, 'inject'); if (pv.full) common.award(S, 'clone'); common.checkAch(S); RB.audio.play('poof');
        ui.closeAll();
        ui.toast(isEgg ? 'The egg glows for a moment.' : tg.c.name + ' shudders, and changes.', pal.plum);
        RB.game.save();
      }
    } });
  }
  // Something the CRISPR bench can edit: four bases of one gene, written back by commit().
  const singleGene = (v) => ({ id: v.id, gi: v.gi, bases: v.bases, commit() {} });
  // Edit a gene inside a whole-genome beaker: pick it on the chromosome grid, pick a copy.
  function genomeEditor(v) {
    let sel = -1, copy = 'a';
    ui.open({ draw() {
      const box = ui.window('Genome of ' + v.name, 720, 560, {});
      if (!box) return;
      const g = L.vialGenome(v), detailH = 86;
      genomeGrid(g, box.x, box.y, box.w, box.h - detailH - 6, sel, (gi) => { sel = gi; copy = 'a'; });
      const dy = box.y + box.h - detailH;
      ui.rect(box.x, dy, box.w, detailH, pal.paper, 10);
      if (sel < 0) { ui.para('Tap any gene in this copy of ' + v.name + '\'s genome to edit it. The changes go into every clone made from it.', box.x + 8, dy + 6, box.w - 16, { size: 12 }); return; }
      const hemi = GN.isHemi(g, sel);
      if (hemi) copy = 'a';
      ui.text(L.geneLabel(S, sel), box.x + 8, dy + 18, { size: 14, maxW: box.w - 200 });
      ui.text(L.describe(S, sel, GN.getGeneBases(g, sel, copy)), box.x + 8, dy + 36, { size: 11, bold: false, maxW: box.w - 16 });
      const bw = Math.min(90, (box.w - 24) / 3), by = dy + 46;
      if (ui.btn(box.x + 8, by, bw, 32, 'Copy A', { fill: copy === 'a' ? pal.ink : pal.soft, color: copy === 'a' ? pal.white : pal.ink, size: 12, flat: true })) copy = 'a';
      if (ui.btn(box.x + 14 + bw, by, bw, 32, 'Copy B', { fill: copy === 'b' ? pal.ink : pal.soft, color: copy === 'b' ? pal.white : pal.ink, size: 12, flat: true, disabled: hemi })) copy = 'b';
      if (ui.btn(box.x + box.w - bw - 8, by, bw, 32, 'Edit', { icon: 'dna', fill: pal.plum, size: 12 })) editWindow(L.genomeGene(v, sel, copy));
    } });
  }
  // Choose which base to change and to what, then play the cut.
  // With the mini-game switched off (Settings), an edit applies at once and the bench stays open.
  const miniGame = () => RB.game.settings.crispr !== false;
  function editNow(v, pos, to) {
    const why = L.pay(S, 'edit');
    if (why) { ui.toast(why, pal.coral); return; }
    L.edit(v, pos, to); if (v.commit) v.commit();
    common.award(S, 'crispr'); RB.audio.play('good'); RB.game.save();
  }
  function editWindow(v) {
    let pos = 0, to = (v.bases[0] + 1) % 4;
    ui.open({ draw() {
      const box = ui.window('CRISPR bench', 340, 330, {});
      if (!box) return;
      ui.text(L.geneLabel(S, v.gi), box.x, box.y + 12, { size: 14, maxW: box.w });
      ui.text('Now: ' + L.describe(S, v.gi, v.bases), box.x, box.y + 30, { size: 11, bold: false, maxW: box.w });
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
      const after = v.bases.slice(); after[pos] = to;
      ui.text('After: ' + L.describe(S, v.gi, after), box.x, box.y + 184, { size: 11, bold: false, maxW: box.w });
      const ef = L.feeOf(S, 'edit');
      ui.text('A is worth 0, C 1, G 2, T 3; in colour genes the first letter weighs most. ' + (ef ? 'Each cut costs $' + ef + '.' : 'Cuts are free.'), box.x, box.y + 202, { size: 10, bold: false, maxW: box.w, color: pal.grey });
      const game = miniGame();
      ui.text(game ? 'Each cut is a small mini-game. You can switch it off in Settings.' : 'Mini-game off (Settings): edits apply at once.', box.x, box.y + 218, { size: 10, bold: false, maxW: box.w, color: pal.plum });
      if (ui.btn(box.x, box.y + box.h - 46, box.w, 44, (game ? 'Cut' : 'Edit') + (ef ? ' · $' + ef : ''), { icon: 'dna', fill: pal.plum, disabled: to === v.bases[pos] || S.money < ef })) {
        if (game) { const why = L.pay(S, 'edit'); if (why) ui.toast(why, pal.coral); else { ui.close(); cutGame(v, pos, to); } } // paid when the cut starts
        else { editNow(v, pos, to); to = (v.bases[pos] + 1) % 4; ui.toast('Base ' + (pos + 1) + ' is now ' + BASES[v.bases[pos]] + '.', pal.teal); }
      }
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
          if (idx >= need) { done = 1; L.edit(v, pos, to); v.commit(); common.award(S, 'crispr'); RB.audio.play('win'); } else ensure(guide[idx]);
        } else { good = false; strikes++; RB.audio.play('bad'); if (strikes >= 3) { done = -1; L.offTarget(v, pos, r); v.commit(); } }
      }
    } });
  }

  function fossils(b) {
    const sets = Object.keys(IT.FOSSILS);
    ui.para(S.sandbox ? 'Sandbox: every fossil is complete. Rebuild any of them as often as you like, free: each one is an egg sent to your coop.' : 'Fossil fragments turn up when you dig. Four of a kind and $' + L.REBUILD_COST + ' rebuild the animal as an egg, sent to your coop.', b.x + 4, b.y, b.w - 8, { size: 12 });
    ui.list('fossils', b.x, b.y + 40, b.w, b.h - 40, sets.length, 60, (i, x, y, w) => {
      const id = sets[i], n = L.fragments(S, id);
      ui.rect(x, y + 2, w - 6, 54, pal.paper, 10);
      ui.icon('skull', x + 28, y + 29, 26, n ? pal.ink : pal.grey);
      ui.text(IT.FOSSILS[id], x + 60, y + 24, { size: 14 });
      for (let k = 0; k < L.FRAGMENTS; k++) ui.rect(x + 60 + k * 20, y + 34, 16, 10, k < n ? pal.plum : pal.soft, 4);
      if (S.sandbox) ui.text('∞', x + 146, y + 44, { size: 13 });
      else if (n > L.FRAGMENTS) ui.text('+' + (n - L.FRAGMENTS), x + 146, y + 44, { size: 11 });
      if (ui.btn(x + w - 100, y + 10, 88, 38, 'Rebuild', { size: 13, fill: pal.plum, disabled: n < L.FRAGMENTS || (!S.sandbox && S.money < L.REBUILD_COST) })) {
        const msg = L.rebuild(S, id);
        if (msg) ui.toast(msg, pal.coral); else { common.award(S, 'fossil'); RB.audio.play('zap'); ui.message('It lives', 'An egg is on its way to your coop. It hatches in two mornings.', null, { head: pal.plum }); RB.game.save(); }
      }
    });
  }

  // ---- the Guide: how genes work, then every kind of gene and what it does, grouped by body part.
  // Built into lines for the width it is shown at; the Genome tab's info button jumps to an entry.
  const GROW = 18;
  let guideCache = null, guideJump = null, guideMark = null;
  function guideRows(w) {
    if (guideCache && guideCache.w === w) return guideCache;
    const rows = [], at = {}, wrap = (txt) => ui.wrap(txt, w - 24, 12, false);
    rows.push({ head: 'How genes work' });
    for (const [t, txt] of L.GUIDE_INTRO) { rows.push({ title: t }); for (const ln of wrap(txt)) rows.push({ line: ln }); rows.push({}); }
    let grp = null;
    for (const e of L.guideEntries()) {
      if (e.group !== grp) { grp = e.group; rows.push({ head: e.groupName }); }
      at[e.id] = rows.length;
      rows.push({ title: e.label, how: e.how, id: e.id });
      for (const ln of wrap(e.text)) rows.push({ line: ln, id: e.id });
      rows.push({});
    }
    guideCache = { w, rows, at };
    return guideCache;
  }
  function guideTab(b) {
    ui.text('What every kind of gene does. In the Genome tab, the ? button on a gene jumps to it here.', b.x + 4, b.y + 14, { size: 12, bold: false, maxW: b.w - 8 });
    const lw = b.w, G = guideRows(lw), id = 'guide' + lw, top = b.y + 24;
    if (guideJump) { // scroll so that entry is at the top, and mark it for a moment
      ui.scroll[id] = { y: Math.max(0, (G.at[guideJump] - 1) * GROW), grab: null };
      guideMark = { id: guideJump, until: t + 2.5 }; guideJump = null;
    }
    if (guideMark && t > guideMark.until) guideMark = null;
    ui.rect(b.x, top, b.w, b.h - 24, pal.paper, 10);
    ui.list(id, b.x, top + 4, lw, b.h - 32, G.rows.length, GROW, (i, x, y, w) => {
      const r = G.rows[i];
      if (guideMark && r.id === guideMark.id) ui.rect(x + 4, y, w - 14, GROW, '#d8efe9', 0);
      if (r.head) ui.text(r.head, x + 10, y + 15, { size: 14, color: pal.plum });
      else if (r.title) {
        ui.text(r.title, x + 12, y + 14, { size: 13, maxW: w * 0.5 });
        if (r.how) ui.text(r.how, x + w - 14, y + 14, { size: 10, bold: false, color: pal.teal, align: 'right', maxW: w * 0.5 - 20 });
      } else if (r.line) ui.text(r.line, x + 12, y + 13, { size: 12, bold: false });
    });
  }
  RB.scenes.lab = {
    enter() { S = RB.game.S; tab = 0; subject = null; gene = -1; t = 0; RB.audio.setTune('lab'); base = RB.game.world.npcs.find((n) => n.site === 'lab') || null; },
    update(dt) { t += dt; },
    debug() { return { editWindow, singleGene, injectPick, setTab: (i) => { tab = i; }, pick: (c, gi) => { subject = c; gene = gi; }, guideJump: (id) => { guideJump = id; tab = 3; } }; },
    draw(ctx) {
      const v = ui.view;
      ctx.fillStyle = '#e4efec'; ctx.fillRect(0, 0, v.w, v.h);
      ui.rect(0, 0, v.w, 56, pal.ink);
      // whoever runs the lab (tap to net them)
      const boss = base ? RB.npc.current(S, base) : null;
      if (boss) { common.portrait({ P: RB.pheno.express(boss.g) }, 8, 6, 44, 44, { fill: pal.paper, draw: { clothes: boss.clothes } }); common.keeperTap(S, base, 8, 6, 44, 44, () => RB.game.go('map')); }
      else ui.icon('beaker', 28, 28, 30, pal.teal);
      ui.text('The Lab', 60, 24, { size: 16, color: pal.white });
      ui.text((boss ? boss.name + ' · ' : '') + (S.lab.power ? 'All ' + GN.N_GENES + ' genes mapped' : 'No power'), 60, 42, { size: 11, color: pal.sand, bold: false, maxW: v.w - 180 });
      ui.money(S.money, v.w - 104, 33, { size: 14, color: pal.white, align: 'right' });
      if (ui.btn(v.w - 96, 8, 88, 40, 'Leave', { icon: 'left', fill: pal.coral, size: 13, key: 'Escape' })) { RB.game.save(); RB.game.go('map'); }
      const bw = Math.min(v.w - 16, 700), b = { x: (v.w - bw) / 2, y: 64, w: bw, h: v.h - 72 };
      if (!S.lab.power) {
        const n = ST.count(S, 'fuse');
        ui.panel(b.x, b.y, b.w, 190, {});
        ui.text('The generator is dead', b.x + 14, b.y + 28, { size: 17 });
        ui.para((boss ? boss.name : 'Prof. Bequer') + ': "' + (boss ? RB.npc.chirp(boss) : '') + 'Three fuses and we are in business. There is one buried by the red cross outside. Net & Spade can order them, and people have dug them up all over."', b.x + 14, b.y + 38, b.w - 28, { size: 12 });
        for (let i = 0; i < 3; i++) ui.icon('fuse', b.x + 34 + i * 44, b.y + 120, 34, i < n ? pal.mustard : pal.soft);
        if (ui.btn(b.x + 160, b.y + 100, 170, 42, 'Fit the fuses', { disabled: n < 3 })) { L.powerOn(S); RB.audio.play('zap'); common.checkAch(S); RB.game.save(); }
        return;
      }
      const names = ['Genome', 'Beakers', 'Fossils', 'Guide'], tw = Math.min(120, (b.w - 18) / 4);
      names.forEach((n, i) => { if (ui.btn(b.x + i * (tw + 6), b.y, tw, 32, n, { fill: tab === i ? pal.ink : pal.paper, color: tab === i ? pal.white : pal.ink, size: 12, flat: true })) { tab = i; RB.audio.play('click'); } });
      const c = { x: b.x, y: b.y + 40, w: b.w, h: b.h - 40 };
      if (tab === 0) genome(c); else if (tab === 1) beakers(c); else if (tab === 2) fossils(c); else guideTab(c);
    },
  };
})();
