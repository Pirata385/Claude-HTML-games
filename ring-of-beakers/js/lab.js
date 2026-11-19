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
  // The beaker remembers which copy it holds (A or B), and goes back into that copy when injected.
  // Beakers are free. Giving a sample leaves the donor worn out for the day, never hurt.
  function extract(S, c, gi, copy) {
    const which = copy === 'b' && !GN.isHemi(c.g, gi) ? 'b' : 'a';
    const vial = { id: S.nextId++, gi, copy: which, bases: GN.getGeneBases(c.g, gi, which), from: RB.state.kind(c) };
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
  // Which copy of the receiver's gene a single-gene beaker is written into: 'a', 'b' or 'both'.
  // By default the copy it was taken from (older beakers, which did not say, go into A). A female
  // has only one copy of a Z gene, so B means her single copy there.
  function intoCopy(vial, target, into) {
    const c = into === 'both' || into === 'a' || into === 'b' ? into : vial.copy === 'b' ? 'b' : 'a';
    return c === 'b' && GN.isHemi(target.g, vial.gi) ? 'a' : c;
  }
  // Write a vial into its gene. target is a creature or an egg (both have .g).
  // An injection leaves a creature worn out for the day (a tonic perks it up), never hurt.
  // A single gene overwrites one copy (into: 'a' or 'b', by default the one it came from) or both,
  // and uses up its beaker. A whole genome turns the receiver into a clone of the donor and its
  // beaker is kept.
  function inject(S, vial, target, isEgg, into) {
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
      GN.setGeneBases(target.g, vial.gi, vial.bases, intoCopy(vial, target, into));
      removeVial(S, vial);
    }
    if (!isEgg) { target.inj = (target.inj || 0) + 1; target.tired = true; RB.state.dirty(target); }
  }
  // What an injection would do, without doing it: the creature (an egg is shown as the adult it
  // grows into) before and after, and the trait the gene belongs to.
  function preview(S, vial, target, isEgg, into) {
    const g2 = vial.full ? GN.clone(vialGenome(vial)) : GN.clone(target.g);
    if (!vial.full) GN.setGeneBases(g2, vial.gi, vial.bases, intoCopy(vial, target, into));
    const opts = isEgg ? {} : { age: RB.state.bodyAge(target), train: target.train, cond: target.cond };
    const before = RB.pheno.express(target.g, opts), after = RB.pheno.express(g2, opts);
    if (vial.full) return { before, after, g: g2, trait: null, full: true, tooOld: !isEgg && target.age >= after.lifespan };
    const gene = GN.GENES[vial.gi], def = gene.trait ? GN.TRAITS[gene.trait] : null;
    let trait = null;
    if (def && def.switch) trait = { label: def.label, from: GN.switchOn(target.g, def.id) ? 'on' : 'off', to: GN.switchOn(g2, def.id) ? 'on' : 'off', known: known(S, vial.gi) };
    else if (def) trait = { label: def.label, from: GN.traitValue(target.g, def.id), to: GN.traitValue(g2, def.id), known: known(S, vial.gi) };
    return { before, after, g: g2, trait, into: intoCopy(vial, target, into) };
  }
  // CRISPR: set one base of a vial. A fumbled edit scrambles another base instead.
  function edit(vial, i, base) { vial.bases[i] = base; }
  function offTarget(vial, i, rng) {
    let j; do { j = rng.int(0, 3); } while (j === i);
    vial.bases[j] = (vial.bases[j] + rng.int(1, 3)) % 4;
    return j;
  }
  const guide = (rng, n) => { const out = []; for (let i = 0; i < n; i++) out.push(rng.int(0, 3)); return out; };


  // ---- the Guide tab: how genes work, and what every kind of gene does
  const GUIDE_INTRO = [
    ['Two copies', 'Every gene comes in two copies: A from one parent and B from the other. A female has a single copy of the genes on the Z chromosome (the last row; marked "on Z" below), so whatever that copy says is what she gets, and a male passes his Z genes to his daughters.'],
    ['Four bases', 'Each copy is four bases (A C G T, worth 0 1 2 3). Most genes just add their bases up, so ACGT and TGCA mean the same; colour genes read them in order as one number, so any change of base changes the colour.'],
    ['Copies together', 'The two copies are blended. Each copy also carries its own dominance, so a cross can take a body part wholly after one parent or land between the two. A dominant gene (marked dom) shows with one strong copy.'],
    ['I, II, III', 'Big traits are spread over two or three genes (Muscle I, II and III). The first is the major gene and counts most; they light up green together on the chromosome map.'],
    ['Switches', 'Oddities are switches: a copy is ON when its bases add up to 9 or more. Most switches are recessive and need both copies ON; Melanism is dominant and needs one copy at 10+. Twin head needs both its genes switched on.'],
    ['In the lab', 'Extract copy A or B into a beaker, edit its bases at the CRISPR bench, and inject it into copy A, copy B or both of another creature or an egg. Junk DNA does nothing at all.'],
  ];
  const GROUP_NAMES = { body: 'Body', head: 'Head and neck', beak: 'Beak', legs: 'Legs and feet', wings: 'Wings and tail', crest: 'Comb and crest', colour: 'Colours', vigour: 'Strength and health', mind: 'Mind', life: 'Life', odd: 'Oddities (switches)' };
  const GROUP_ORDER = ['body', 'head', 'beak', 'legs', 'wings', 'crest', 'colour', 'vigour', 'mind', 'life', 'odd'];
  const GENE_GUIDE = {
    size: 'Overall scale of the whole body. Weight grows with roughly its cube: big birds have far more health and hit a little harder, and fight in heavier weight classes; it also deepens the voice.',
    bodyLen: 'Length of the torso. A longer body is heavier and has a little more health.',
    bodyDepth: 'How deep and round the body is. Deeper means heavier with more health, but slower to run and to jump.',
    posture: 'How the body is carried: low points it flat like a duck, high stands it upright like a penguin or a gamecock. Looks, mostly: it moves where the legs meet the body.',
    chest: 'How full and rounded the breast is. Looks only.',
    neckLen: 'Length of the neck. A long neck reaches further with the beak, so it strikes from further away.',
    neckThick: 'Thickness of the neck. A thick neck (helped by muscle) holds the head steadier; a thin one lets it wobble about.',
    neckCurve: 'How much the neck bends into an S. Looks only.',
    headSize: 'Size of the head. The beak grows with the head, so a big head carries a bigger beak, and is a bigger target.',
    eyeSize: 'Size of the eyes. Big eyes see in the dark: in the arena where the lights go out they still hit what they aim at, and dodge.',
    beakLen: 'Length of the beak: more reach, and a sharper peck up to about twice the usual length. Below a stub there is no beak at all and pecks barely hurt.',
    beakDepth: 'How deep and heavy the beak is. A heavier beak adds a little to every peck.',
    beakHook: 'A hooked tip, like a hawk\'s. The single biggest boost to peck damage.',
    beakFlat: 'A flat bill, like a duck\'s. It blunts pecks a lot.',
    pouch: 'A throat pouch under the beak, like a pelican\'s. Looks only.',
    legLen: 'Length of the legs: a longer stride (faster), longer kicks and higher jumps. Very long legs are harder to balance.',
    shin: 'How the leg is split between thigh and shin. Changes the look of the stride.',
    legThick: 'Thickness of the legs. Sturdier legs keep their balance better, and add a little weight.',
    footSize: 'Size of the feet. Big feet grip the ground (quicker to get going) and keep their balance.',
    talon: 'Claws on the toes. They make kicks much sharper and grip the ground.',
    spur: 'Spurs on the back of the legs. They make kicks sharper. Males grow them fully, hens about a third.',
    web: 'Webbing between the toes (dominant). With half or more, wild birds of the kind walk into water and swim; below that they stay on land.',
    wingSize: 'Size of the wings: wing buffets in a fight, flapping hops, and flight if the wings are big enough for the weight (flyers can take off when you come near).',
    wingPoint: 'Wing shape, from round to pointed. Looks only.',
    tailLen: 'Length of the tail; hens grow shorter tails. Long tails score at the sideshow Pageant.',
    tailFan: 'How wide the tail spreads, up to a peacock fan; hens fan less. Scores at the Pageant.',
    tailUp: 'How the tail is held, from drooping to cocked high. Looks only.',
    comb: 'Size of the comb; hens grow smaller combs. Scores at the Pageant.',
    combType: 'Shape of the comb: casque, knob, single, rose or pea.',
    wattle: 'Wattles hanging under the beak; hens grow smaller ones.',
    crest: 'A crest of feathers on the head. Scores at the Pageant.',
    bareHead: 'A bare-skinned head and neck, like a vulture\'s or a cassowary\'s.',
    hue: 'The main colour of the plumage, all round the colour wheel. Read as a number, so any change of base shifts the colour; the second gene fine-tunes it.',
    sat: 'How vivid the plumage is, from dull to bright. Vivid birds score at the Pageant.',
    lit: 'How light the plumage is, from near black to pale.',
    hueWing: 'Shifts the wings\' colour away from the body\'s.',
    litWing: 'Makes the wings darker or lighter than the body.',
    hueTail: 'Shifts the tail\'s colour away from the body\'s.',
    litTail: 'Makes the tail darker or lighter than the body.',
    hueHead: 'Shifts the head\'s colour away from the body\'s.',
    litHead: 'Makes the head darker or lighter than the body.',
    beakTone: 'Colour of the beak, from black and slate grey through yellow and orange to red. Looks only.',
    legTone: 'Colour of the legs and feet, from black and slate grey through yellow and orange to pink. Looks only.',
    combHue: 'Colour of the comb, wattles and any bare skin.',
    pattern: 'The feather pattern: pied, barred, solid, speckled or laced. Any pattern but solid scores at the Pageant.',
    patContrast: 'How strongly the feather pattern stands out against the main colour, from barely there to bold.',
    belly: 'How much of the underside is pale, from none to a white belly under the main colour.',
    sheen: 'A metallic, iridescent sheen (dominant). Scores at the Pageant.',
    eyeTone: 'Colour of the eyes, from black through brown and amber to yellow. Looks only.',
    muscle: 'Raw strength: Power in the ring (how hard every strike lands), plus running speed, jumping and getting going. Training Strength adds up to 15%.',
    bone: 'Bone density: heavier and much harder to hurt (more health), with heavier wing buffets, but a little worse at jumping.',
    lungs: 'Wind: Stamina, how long it keeps fighting before it has to back off and rest. Training Wind adds up to 15%.',
    reflex: 'Reflexes: quicker steps and strikes, so more Speed and more attacks, and better dodging. Training Reflexes adds up to 15%.',
    hide: 'A tough hide: more health, so Toughness, without the weight of bone.',
    aggression: 'Fury: how eagerly it closes in and how often it strikes. Males get a little more.',
    courage: 'Guts: morale. Brave birds shrug off hits, and very brave ones never run away. Training Nerve adds to it.',
    focus: 'Half of Wits: aims for the head more often, obeys your shouted commands, and sees better in the dark.',
    cunning: 'Half of Wits: dodges strikes and backs off at the right moment.',
    lifespan: 'How many days it lives before it retires (about 9 to 22). Out in the wild, a freed bird dies the night after its last day; on your islands, two days after.',
    fertility: 'The chance of an egg when it nests (the two parents are averaged).',
    growth: 'How fast a chick grows up: the faster, the fewer days until it is an adult.',
    appetite: 'How much it would like to eat. Every creature is full on one grain a day, so for now it changes nothing you can see.',
    voicePitch: 'How high or low its call is (size also deepens it).',
    voiceRasp: 'How rough or clear its call sounds, from a clean whistle to a hoarse croak.',
    voiceLen: 'How long its call lasts, from a short chirp to a long drawn-out cry.',
    armLen: 'Length of the arms, if it has the Arms switch on. Longer arms punch from further away.',
    teeth: 'Teeth in the beak: every peck hurts 25% more.',
    arms: 'Arms with hands: it punches (sharper with talons). With Bare skin and no beak to speak of, it is a person.',
    bare: 'Bare skin instead of feathers. With Arms and almost no beak, it is a person.',
    twoHeadsA: 'Twin head, part one. With Twin head II also on, it grows a second head and its pecks hurt 25% more.',
    twoHeadsB: 'Twin head, part two. With Twin head I also on, it grows a second head and its pecks hurt 25% more.',
    glow: 'It glows softly, day and night. Looks only, and rather striking.',
    tailBone: 'A bony tail like a dinosaur\'s, where a feathered tail would be.',
    gigas: 'Gigantism: half as big again as its genes would make it, with all the weight, health and power that brings.',
    nana: 'Dwarfism: about two thirds of the size its genes would make it, much lighter and with less health.',
    knee: 'Knees that bend forward instead of back. Looks only.',
    cyclops: 'A single eye in the middle of the face. Looks only.',
    earTuft: 'Feather tufts like an owl\'s ears. Looks only.',
    legsExtra: 'Four legs: 15% faster and much steadier on its feet.',
    fluff: 'Feathers growing down over the feet. Looks only.',
    melanic: 'Melanism (dominant): one strong copy turns the whole bird black with a sheen, over whatever the colour genes say.',
    leucistic: 'Leucism (recessive): with both copies on, the bird comes out white.',
  };
  const MODE_NAMES = { add: 'blends', dom: 'dominant', rec: 'recessive' };
  // One entry per kind of gene: its name, its genes, how it is inherited and what it does.
  function guideEntries() {
    const out = [];
    for (const grp of GROUP_ORDER) {
      for (const def of GN.TRAIT_LIST.filter((d) => d.group === grp)) {
        const z = def.genes.map((gi, k) => (GN.GENES[gi].chr === GN.Z_CHR ? ['I', 'II', 'III'][k] : null)).filter(Boolean);
        const onZ = !z.length ? '' : def.n === 1 ? ' · on Z' : ' · ' + (z.length > 1 ? 'genes ' : 'gene ') + z.join(' and ') + ' on Z';
        const how = def.switch ? (def.mode === 'dom' ? 'dominant switch, one copy at ' + def.thr + '+' : 'recessive switch, both copies at ' + def.thr + '+')
          : (def.n > 1 ? def.n + ' genes' : '1 gene') + ' · ' + MODE_NAMES[def.mode] + (def.pos ? ' · read in order' : '');
        out.push({ id: def.id, group: grp, groupName: GROUP_NAMES[grp], label: def.label, genes: def.genes.slice(), how: how + onZ, onZ: z.length > 0, text: GENE_GUIDE[def.id] || '' });
      }
    }
    return out;
  }
  const guideOf = (gi) => { const tr = GN.GENES[gi] && GN.GENES[gi].trait; return tr ? guideEntries().find((e) => e.id === tr) : null; };
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

  RB.lab = { changeSex, related, intoCopy, GUIDE_INTRO, GENE_GUIDE, GROUP_NAMES, guideEntries, guideOf, FRAGMENTS, REBUILD_COST, SEQ_FEE, known, knownCount, codingCount, geneLabel, reveal, sequence, extract, vialSum, copyGenome, vialGenome, genomeGene, removeVial, inject, preview, edit, offTarget, guide, describe, fragments, addFragment, rebuild, powerOn };
})();
