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
  function extract(S, c, gi, copy) {
    if (!RB.state.take(S, 'beaker')) return 'You need an empty beaker.';
    const vial = { id: S.nextId++, gi, bases: GN.getGeneBases(c.g, gi, copy), from: RB.state.kind(c) };
    S.lab.vials.push(vial);
    c.hp = Math.max(0.2, c.hp - 0.25); c.rest = Math.max(c.rest, 1);
    return vial;
  }
  const vialSum = (v) => v.bases[0] + v.bases[1] + v.bases[2] + v.bases[3];
  // Write a vial into both copies of its gene. target is a creature or an egg (both have .g).
  function inject(S, vial, target, isEgg) {
    GN.setGeneBases(target.g, vial.gi, vial.bases, 'both');
    S.lab.vials.splice(S.lab.vials.indexOf(vial), 1);
    if (!isEgg) { target.inj = (target.inj || 0) + 1; if (!target.person) target.age++; RB.state.dirty(target); }
  }
  // CRISPR: set one base of a vial. A fumbled edit scrambles another base instead.
  function edit(vial, i, base) { vial.bases[i] = base; }
  function offTarget(vial, i, rng) {
    let j; do { j = rng.int(0, 3); } while (j === i);
    vial.bases[j] = (vial.bases[j] + rng.int(1, 3)) % 4;
    return j;
  }
  const guide = (rng, n) => { const out = []; for (let i = 0; i < n; i++) out.push(rng.int(0, 3)); return out; };

  // What a gene value means for its trait, in words, for the sequencer.
  function describe(S, gi, sum) {
    const g = GN.GENES[gi];
    if (!g.trait) return 'Does nothing anyone can find.';
    if (!known(S, gi)) return 'Unknown. Sequence more animals to learn what it does.';
    const def = GN.TRAITS[g.trait];
    if (def.switch) return sum >= def.thr ? 'Switch copy: ON (needs both copies).' : 'Switch copy: off. ' + def.thr + '+ turns it on.';
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
    S.eggs.push({ id: S.nextId++, g, nest: -1, hatch: S.day + 2, mom: name, dad: name, col: '#e8dcc0', spot: '#8a7a5a' });
    return '';
  }
  function powerOn(S) {
    if (S.lab.power) return true;
    if (!RB.state.take(S, 'fuse', 3)) return false;
    S.lab.power = true;
    return true;
  }

  RB.lab = { FRAGMENTS, REBUILD_COST, SEQ_FEE, known, knownCount, codingCount, geneLabel, reveal, sequence, extract, vialSum, inject, edit, offTarget, guide, describe, fragments, addFragment, rebuild, powerOn };
})();
