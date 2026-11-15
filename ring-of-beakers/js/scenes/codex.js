// scenes/codex.js — the book: kinds of bird met so far, the gene atlas, feats, and how to play.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng } = RB.core;
  const ui = RB.ui, pal = RB.pal, common = RB.common, GN = RB.genome;
  let S, tab, back, samples = null;

  const HELP = [
    ['The day', 'Feed your birds (the feeder holds grain for the night), then drive out. Time only passes on the map. Sleep at home to start the next day: birds age, eggs are laid and hatch, shops restock.'],
    ['Catching', 'Throw nets at wild creatures. Big, strong ones tear plain nets: tire them out by chasing, lure them with seed, trap them in holes you dug, or buy heavy nets. Some fly, some run, some charge the truck.'],
    ['Fighting', 'Load fighters into the truck and enter a bout at an arena. They fight on their own: body shape, weapons, wind and nerve decide it. You shout three commands, each with a cooldown, and you can bet. Win enough at an arena and its boss will face you.'],
    ['Breeding', 'Drag a male and a female into a nest and sleep. The egg takes after both: every gene has two copies, one from each parent. Different kinds can cross, less reliably. Chicks grow up in a couple of days.'],
    ['Digging', 'A shovel digs anywhere on the map: coins, relics, worms, fuses, fossil fragments. Red crosses mark sure finds. Holes stay and trap small animals.'],
    ['The lab', 'Three fuses bring the lab to life. Sequence a creature to read its genome, extract a gene into a beaker, edit it at the CRISPR bench, and inject it into another creature or an egg. Four fossil fragments rebuild a lost species.'],
    ['People', 'Neighbours buy birds that match what they want, breed their own, collect relics, or challenge you. You can net them, too. The sheriff takes a dim view.'],
    ['BFC', 'Brazil\'s Fried Chicken pays by the kilo for any bird you are done with, at the counter or through the pick-up box in your yard.'],
  ];

  function sample(id) {
    samples = samples || {};
    if (!samples[id]) samples[id] = RB.pheno.express(RB.species.make(id, new Rng(RB.core.hashStr(id)), { sex: 'M', sport: 0 }));
    return samples[id];
  }

  RB.scenes.codex = {
    enter(args) { S = RB.game.S; tab = 0; back = args.back || 'coop'; },
    update() {},
    draw(ctx) {
      const v = ui.view;
      ctx.fillStyle = pal.cream; ctx.fillRect(0, 0, v.w, v.h);
      ui.rect(0, 0, v.w, 50, pal.ink);
      ui.icon('book', 26, 25, 24, pal.mustard); ui.text('Codex', 48, 31, { size: 17, color: pal.white });
      if (ui.btn(v.w - 96, 6, 88, 38, 'Back', { icon: 'left', fill: pal.coral, size: 13, key: 'Escape' })) RB.game.go(back);
      const bw = Math.min(v.w - 16, 700), b = { x: (v.w - bw) / 2, y: 58, w: bw, h: v.h - 66 };
      const names = ['Birds', 'Genes', 'Feats', 'How to play'], tw = Math.min(120, (b.w - 18) / 4);
      names.forEach((n, i) => { if (ui.btn(b.x + i * (tw + 6), b.y, tw, 32, n, { fill: tab === i ? pal.ink : pal.paper, color: tab === i ? pal.white : pal.ink, size: 12, flat: true })) { tab = i; RB.audio.play('click'); } });
      const y0 = b.y + 40, h = b.h - 40;
      if (tab === 0) {
        const ids = RB.species.IDS.filter((id) => !RB.species.SPECIES[id].person), cols = Math.max(3, Math.floor(b.w / 112)), cw = b.w / cols, rows = Math.ceil(ids.length / cols);
        ui.list('codexBirds', b.x, y0, b.w, h, rows, cw + 14, (r, x, y) => {
          for (let c = 0; c < cols; c++) {
            const id = ids[r * cols + c]; if (!id) break;
            const sp = RB.species.SPECIES[id], seen = S.codex.species[id], bx = x + c * cw;
            common.portrait({ P: sample(id) }, bx + 3, y + 3, cw - 10, cw - 10, { fill: seen ? pal.paper : pal.soft, draw: seen ? {} : { sil: '#c9bda3' } });
            ui.text(seen ? RB.species.nameOf(sp, 'M') : sp.extinct ? 'extinct ???' : '???', bx + cw / 2 - 2, y + cw + 5, { size: 11, align: 'center', maxW: cw - 8, color: seen ? pal.ink : pal.grey });
          }
        });
      } else if (tab === 1) {
        const groups = {};
        for (const g of GN.GENES) { if (!g.trait) continue; const grp = GN.TRAITS[g.trait].group; (groups[grp] = groups[grp] || []).push(g); }
        const keys = Object.keys(groups), lines = [];
        const title = { body: 'Body', head: 'Neck and head', beak: 'Beak', legs: 'Legs and feet', wings: 'Wings and tail', crest: 'Comb and crest', colour: 'Colour', vigour: 'Vigour', mind: 'Mind', life: 'Life', odd: 'Oddities' };
        for (const k of keys) { const known = groups[k].filter((g) => RB.lab.known(S, g.idx)); lines.push({ head: title[k] + '  ' + known.length + '/' + groups[k].length, frac: known.length / groups[k].length }); lines.push({ text: known.length ? known.map((g) => g.name + ' (' + (g.chr === GN.Z_CHR ? 'Z' : g.chr + 1) + ')').join(', ') : 'Nothing known yet.' }); }
        ui.text('Genes known: ' + RB.lab.knownCount(S) + ' of ' + GN.N_GENES + '. Sequence creatures at the lab to learn more.', b.x + 4, y0 + 12, { size: 12, bold: false, maxW: b.w - 8 });
        const flat = [];
        for (const ln of lines) { if (ln.head) flat.push(ln); else for (const w of ui.wrap(ln.text, b.w - 16, 11, false)) flat.push({ text: w }); }
        ui.list('codexGenes', b.x, y0 + 20, b.w, h - 20, flat.length, 17, (i, x, y, w) => {
          const ln = flat[i];
          if (ln.head) { ui.text(ln.head, x + 4, y + 13, { size: 12 }); ui.bar(x + w - 110, y + 5, 96, 7, ln.frac, pal.plum); }
          else ui.text(ln.text, x + 8, y + 12, { size: 11, bold: false, color: pal.grey });
        });
      } else if (tab === 2) {
        const ids = Object.keys(common.ACH);
        const st = S.stats;
        ui.text('Bouts ' + st.fights + ' · wins ' + st.wins + ' · caught ' + st.caught + ' · hatched ' + st.bred + ' · holes ' + st.dug + ' · earned $' + st.earned, b.x + 4, y0 + 12, { size: 11, bold: false, maxW: b.w - 8 });
        ui.list('codexFeats', b.x, y0 + 20, b.w, h - 20, ids.length, 44, (i, x, y, w) => {
          const a = common.ACH[ids[i]], got = S.codex.ach[ids[i]];
          ui.rect(x, y + 2, w - 6, 40, got ? pal.paper : pal.soft, 8);
          ui.icon(got ? 'trophy' : 'lock', x + 22, y + 22, 20, got ? pal.mustard : pal.grey);
          ui.text(a[0], x + 44, y + 19, { size: 13, color: got ? pal.ink : pal.grey }); ui.text(a[1], x + 44, y + 34, { size: 10, bold: false, color: pal.grey });
        });
      } else {
        const flat = [];
        for (const sec of HELP) { flat.push({ head: sec[0] }); for (const w of ui.wrap(sec[1], b.w - 16, 12, false)) flat.push({ text: w }); flat.push({ text: '' }); }
        ui.list('codexHelp', b.x, y0, b.w, h, flat.length, 17, (i, x, y) => { const ln = flat[i]; if (ln.head) ui.text(ln.head, x + 4, y + 13, { size: 13, color: pal.teal }); else ui.text(ln.text, x + 4, y + 12, { size: 12, bold: false }); });
      }
    },
  };
})();
