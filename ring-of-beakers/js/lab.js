// lab.js — the rules of the genetics lab: a complete gene atlas, gene extraction into beakers,
// whole-genome copies (injected, they turn the receiver into a clone), injection into eggs and
// living creatures, CRISPR base edits, and rebuilding extinct birds from fossil fragments.
// No DOM (the lab scene draws all this).
(function () {
  'use strict';
  const RB = globalThis.RB;
  const GN = RB.genome;
  const FRAGMENTS = 4, REBUILD_COST = 600, SEQ_FEE = 0;

  // Every gene is mapped from the start: nothing has to be sequenced to learn what it does.
  const known = () => true;
  const knownCount = () => GN.N_GENES;
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
  // Sequencing is no longer needed (the atlas is complete); kept so older saves and callers work.
  function sequence(S, c) { S.lab.seq[c.id] = true; return []; }

  // Pull one copy of a gene into a beaker. Returns the vial, or a string saying why not.
  // Beakers are free. Giving a sample leaves the donor worn out for the day, never hurt.
  function extract(S, c, gi, copy) {
    const vial = { id: S.nextId++, gi, bases: GN.getGeneBases(c.g, gi, copy), from: RB.state.kind(c) };
    S.lab.vials.push(vial);
    c.tired = true;
    return vial;
  }
  const vialSum = (v) => v.bases[0] + v.bases[1] + v.bases[2] + v.bases[3];

  // ---- whole-genome copies
  // Copy a creature's whole genome into one beaker. Injected, it turns the receiver into a clone
  // of the donor (keeping the receiver's age, training and name). The beaker is not used up, so a
  // favourite bird can be kept for ever, and any of its genes can be edited in the beaker.
  function copyGenome(S, c) {
    const vial = { id: S.nextId++, full: true, genome: GN.serialize(c.g), name: c.name, from: RB.state.kind(c), label: RB.state.label(c), key: RB.state.kindKey(c) };
    S.lab.vials.push(vial);
    c.tired = true;
    return vial;
  }
  // Turn a male into a female, or a female into a male: bird or person. Sex lives in the Z
  // chromosomes (a male has two, a female one Z and a W): a new female keeps her first Z, and a
  // new male gets a second copy of it. Like any lab work it leaves the creature worn out for the day.
  function changeSex(S, c) {
    const g = c.g, o = GN.Z_CHR * GN.CHR_LEN;
    if (g.sex === 'M') g.sex = 'F';
    else { for (let i = 0; i < GN.CHR_LEN; i++) g.b[o + i] = g.a[o + i]; g.sex = 'M'; }
    RB.state.dirty(c); c.tired = true; c.love = false;
    RB.state.note(S, c, 'became ' + (g.sex === 'F' ? 'female' : 'male') + ' at the lab'); RB.state.title(c, 'Changed sex at the lab');
    return g.sex;
  }
  // The other genes of the same trait (Muscle I, II and III work together).
  function related(gi) {
    const tr = GN.GENES[gi] && GN.GENES[gi].trait;
    return tr ? GN.TRAITS[tr].genes.filter((x) => x !== gi) : [];
  }
  // The genome in a whole-genome beaker (decoded once and kept until the beaker is edited).
  const decoded = new WeakMap();
  function vialGenome(v) {
    let g = decoded.get(v);
    if (!g) { g = GN.deserialize(v.genome); decoded.set(v, g); }
    return g;
  }
  // One copy of one gene in a whole-genome beaker, as something the CRISPR bench can edit.
  function genomeGene(v, gi, copy) {
    const g = vialGenome(v), c = copy === 'b' && !GN.isHemi(g, gi) ? 'b' : 'a';
    return { id: v.id, gi, copy: c, bases: GN.getGeneBases(g, gi, c), commit() { const gg = vialGenome(v); const o = gi * GN.GENE_LEN, s = c === 'b' ? gg.b : gg.a; for (let i = 0; i < 4; i++) s[o + i] = this.bases[i]; v.genome = GN.serialize(gg); } };
  }
  function removeVial(S, v) { const i = S.lab.vials.indexOf(v); if (i >= 0) S.lab.vials.splice(i, 1); }
  // Write a vial into both copies of its gene. target is a creature or an egg (both have .g).
  // An injection leaves a creature worn out for the day (a tonic perks it up), never hurt.
  // A single gene overwrites both copies and uses up its beaker. A whole genome turns the receiver
  // into a clone of the donor and its beaker is kept.
  function inject(S, vial, target, isEgg) {
    if (vial.full) {
      target.g = GN.clone(vialGenome(vial));
      target.mom = target.dad = vial.label; target.momKey = target.dadKey = vial.key;
      if (!isEgg) {
        // a netted person who becomes a bird is no longer that person: their house empties
        if (target.person) { RB.state.soldPerson(S, target); target.person = null; }
        const P = RB.pheno.express(target.g);
        target.clothes = P.person ? target.clothes || RB.npc.clothes(new RB.core.Rng(target.id * 7919), null) : null;
        RB.state.note(S, target, 'became a clone of ' + vial.name + ' at the lab'); RB.state.title(target, 'A clone of ' + vial.name);
      }
    } else {
      GN.setGeneBases(target.g, vial.gi, vial.bases, 'both');
      removeVial(S, vial);
    }
    if (!isEgg) { target.inj = (target.inj || 0) + 1; target.tired = true; RB.state.dirty(target); }
  }
  // What an injection would do, without doing it: the creature (an egg is shown as the adult it
  // grows into) before and after, and the trait the gene belongs to.
  function preview(S, vial, target, isEgg) {
    const g2 = vial.full ? GN.clone(vialGenome(vial)) : GN.clone(target.g);
    if (!vial.full) GN.setGeneBases(g2, vial.gi, vial.bases, 'both');
    const opts = isEgg ? {} : { age: target.age, train: target.train, cond: target.cond };
    const before = RB.pheno.express(target.g, opts), after = RB.pheno.express(g2, opts);
    if (vial.full) return { before, after, g: g2, trait: null, full: true, tooOld: !isEgg && target.age >= after.lifespan };
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
  // in a sandbox game every fossil is always complete: rebuild as many as you like, for free
  const fragments = (S, set) => (S.sandbox ? FRAGMENTS : S.lab.fossils[set] || 0);
  function addFragment(S, set) { S.lab.fossils[set] = (S.lab.fossils[set] || 0) + 1; }
  // Four fragments and a fee give an egg of the lost species.
  function rebuild(S, set) {
    if (fragments(S, set) < FRAGMENTS) return 'You need ' + FRAGMENTS + ' fragments.';
    if (!S.sandbox) {
      if (S.money < REBUILD_COST) return 'Rebuilding costs $' + REBUILD_COST + '.';
      S.money -= REBUILD_COST; S.lab.fossils[set] -= FRAGMENTS;
    }
    const g = RB.species.make(set, S._rng, { sport: 0.1 });
    const name = RB.species.nameOf(RB.species.SPECIES[set], g.sex);
    S.eggs.push({ id: S.nextId++, g, nest: -1, hatch: S.day + 2, mom: RB.species.generic(set), dad: RB.species.generic(set), momKey: set, dadKey: set, col: '#e8dcc0', spot: '#8a7a5a', fossil: true });
    return '';
  }
  function powerOn(S) {
    if (S.lab.power) return true;
    if (!RB.state.take(S, 'fuse', 3)) return false;
    S.lab.power = true;
    return true;
  }

  RB.lab = { changeSex, related, FRAGMENTS, REBUILD_COST, SEQ_FEE, known, knownCount, codingCount, geneLabel, reveal, sequence, extract, vialSum, copyGenome, vialGenome, genomeGene, removeVial, inject, preview, edit, offTarget, guide, describe, fragments, addFragment, rebuild, powerOn };
})();
