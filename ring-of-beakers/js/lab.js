// lab.js — the rules of the genetics lab: the gene atlas that fills in as you sequence, gene
// extraction into beakers, injection into eggs and living creatures, CRISPR base edits, and
// rebuilding extinct birds from fossil fragments. No DOM (the lab scene draws all this).
(function () {
  'use strict';
  const RB = globalThis.RB;
  const GN = RB.genome;
  const FRAGMENTS = 4, REBUILD_COST = 600, SEQ_FEE = 40;

  const known = (S, gi) => !!S.lab.atlas[gi];
  const knownCount = (S) => Object.keys(S.lab.atlas).length;
  const codingCount = () => GN.GENES.filter((g) => g.trait).length;
  function geneLabel(S, gi) {
    const g = GN.GENES[gi];
    return known(S, gi) ? g.name : 'Gene ' + (g.chr + 1) + '-' + (g.slot + 1);
  }
  // Learn up to n genes not yet in the atlas. Returns their names.
  function reveal(S, n, rng) {
    const unknown = [];
    for (let gi = 0; gi < GN.N_GENES; gi++) if (!known(S, gi)) unknown.push(gi);
    rng.shuffle(unknown);
    const out = [];
    for (const gi of unknown.slice(0, n)) { S.lab.atlas[gi] = true; out.push(GN.GENES[gi].name); }
    return out;
  }
  // Sequence a creature: the first read of each animal teaches the atlas a few genes, and any
  // switch that is plainly on in it is learned at once.
  function sequence(S, c) {
    const first = !S.lab.seq[c.id], out = [];
    if (first) {
      S.lab.seq[c.id] = true;
      for (const def of GN.TRAIT_LIST) {
        if (def.switch && GN.switchOn(c.g, def.id) && !known(S, def.genes[0])) { S.lab.atlas[def.genes[0]] = true; out.push(GN.GENES[def.genes[0]].name); }
      }
      for (const name of reveal(S, 5, S._rng)) out.push(name);
    }
    return out;
  }

  // Pull one copy of a gene into a beaker. Returns the vial, or a string saying why not.
  // Beakers are free. Giving a sample leaves the donor worn out for the day, never hurt.
  function extract(S, c, gi, copy) {
    const vial = { id: S.nextId++, gi, bases: GN.getGeneBases(c.g, gi, copy), from: RB.state.kind(c) };
    S.lab.vials.push(vial);
    c.tired = true;
    return vial;
  }
  const vialSum = (v) => v.bases[0] + v.bases[1] + v.bases[2] + v.bases[3];
  // Write a vial into both copies of its gene. target is a creature or an egg (both have .g).
  // An injection leaves a creature worn out for the day (a tonic perks it up), never hurt.
  function inject(S, vial, target, isEgg) {
    GN.setGeneBases(target.g, vial.gi, vial.bases, 'both');
    S.lab.vials.splice(S.lab.vials.indexOf(vial), 1);
    if (!isEgg) { target.inj = (target.inj || 0) + 1; target.tired = true; RB.state.dirty(target); }
  }
  // What an injection would do, without doing it: the creature (an egg is shown as the adult it
  // grows into) before and after, and the trait the gene belongs to.
  function preview(S, vial, target, isEgg) {
    const g2 = GN.clone(target.g);
    GN.setGeneBases(g2, vial.gi, vial.bases, 'both');
    const opts = isEgg ? {} : { age: target.age, train: target.train, cond: target.cond };
    const before = RB.pheno.express(target.g, opts), after = RB.pheno.express(g2, opts);
    const gene = GN.GENES[vial.gi], def = gene.trait ? GN.TRAITS[gene.trait] : null;
    let trait = null;
    if (def && def.switch) trait = { label: def.label, from: GN.switchOn(target.g, def.id) ? 'on' : 'off', to: GN.switchOn(g2, def.id) ? 'on' : 'off', known: known(S, vial.gi) };
    else if (def) trait = { label: def.label, from: GN.traitValue(target.g, def.id), to: GN.traitValue(g2, def.id), known: known(S, vial.gi) };
    return { before, after, g: g2, trait };
  }
  // CRISPR: set one base of a vial. A fumbled edit scrambles another base instead.
  function edit(vial, i, base) { vial.bases[i] = base; }
  function offTarget(vial, i, rng) {
    let j; do { j = rng.int(0, 3); } while (j === i);
    vial.bases[j] = (vial.bases[j] + rng.int(1, 3)) % 4;
    return j;
  }
  const guide = (rng, n) => { const out = []; for (let i = 0; i < n; i++) out.push(rng.int(0, 3)); return out; };

  // What one copy of a gene (its four bases) means for its trait, in words, for the sequencer.
  const HUES = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'magenta', 'pink'];
  function describe(S, gi, bases) {
    const g = GN.GENES[gi];
    if (!g.trait) return 'Does nothing anyone can find.';
    if (!known(S, gi)) return 'Unknown. Sequence more animals to learn what it does.';
    const def = GN.TRAITS[g.trait], sum = bases[0] + bases[1] + bases[2] + bases[3];
    if (def.switch) {
      const need = def.mode === 'dom' ? 'one copy is enough' : 'needs both copies';
      return sum >= def.thr ? 'Switch copy: ON (' + need + ').' : 'Switch copy: off. ' + def.thr + '+ turns it on (' + need + ').';
    }
    if (g.pos) {
      const n = bases[0] * 64 + bases[1] * 16 + bases[2] * 4 + bases[3];
      if (def.id === 'hue' && g.k === 0) return 'Plumage hue: ' + HUES[Math.floor(n / 256 * 12) % 12] + ' (' + n + '/255, first letter weighs most)';
      return def.label + ': ' + n + '/255 (colour gene: the first letter weighs most)';
    }
    return def.label + ': ' + (sum <= 3 ? 'very low' : sum <= 5 ? 'low' : sum <= 7 ? 'middling' : sum <= 9 ? 'high' : 'very high') + ' (' + sum + '/12)';
  }

  // ---- fossils
  const fragments = (S, set) => S.lab.fossils[set] || 0;
  function addFragment(S, set) { S.lab.fossils[set] = fragments(S, set) + 1; }
  // Four fragments and a fee give an egg of the lost species.
  function rebuild(S, set) {
    if (fragments(S, set) < FRAGMENTS) return 'You need ' + FRAGMENTS + ' fragments.';
    if (S.money < REBUILD_COST) return 'Rebuilding costs $' + REBUILD_COST + '.';
    S.money -= REBUILD_COST; S.lab.fossils[set] -= FRAGMENTS;
    const g = RB.species.make(set, S._rng, { sport: 0.1 });
    const name = RB.species.nameOf(RB.species.SPECIES[set], g.sex);
    S.eggs.push({ id: S.nextId++, g, nest: -1, hatch: S.day + 2, mom: RB.species.generic(set), dad: RB.species.generic(set), momKey: set, dadKey: set, col: '#e8dcc0', spot: '#8a7a5a' });
    return '';
  }
  function powerOn(S) {
    if (S.lab.power) return true;
    if (!RB.state.take(S, 'fuse', 3)) return false;
    S.lab.power = true;
    return true;
  }

  RB.lab = { FRAGMENTS, REBUILD_COST, SEQ_FEE, known, knownCount, codingCount, geneLabel, reveal, sequence, extract, vialSum, inject, preview, edit, offTarget, guide, describe, fragments, addFragment, rebuild, powerOn };
})();
