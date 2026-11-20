// genome.js — the genome: 14 chromosome pairs of A/C/G/T bases with genes at fixed loci,
// meiosis with crossing-over, point mutation and ZW sex determination. No DOM.
//
// A gene is 4 bases; a base is worth 0..3 (A, C, G, T), so one copy of a gene is worth 0..12.
// The two copies combine by the gene's mode: additive (mean), dominant (max) or recessive (min).
// Females are ZW: genes on the Z chromosome (index 13) have a single copy in them.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const { Rng, clamp, lerp } = RB.core;

  const BASES = 'ACGT';
  const N_CHR = 14, GENES_PER_CHR = 10, GENE_LEN = 4;
  const CHR_LEN = GENES_PER_CHR * GENE_LEN;
  const N_GENES = N_CHR * GENES_PER_CHR, N_BASES = N_GENES * GENE_LEN;
  const Z_CHR = 13;
  const GENE_WEIGHTS = [1.3, 1.0, 0.7]; // the first gene of a trait is its major gene

  // Quantitative traits: [id, genes, min, mid, max, curve, zLinkedGenes, label, group, flags]
  // curve 'g' is geometric around mid (sizes and ratios), 'l' is piecewise linear.
  // flag 'd' = dominant, 's' = only the first gene carries the value (hue: the second fine-tunes).
  const Q = [
    ['size', 3, 0.35, 1, 2.7, 'g', 0, 'Body size', 'body'],
    ['bodyLen', 2, 0.7, 1, 1.7, 'g', 0, 'Body length', 'body'],
    ['bodyDepth', 2, 0.65, 1, 1.6, 'g', 0, 'Body depth', 'body'],
    ['posture', 2, 0, 0.35, 1, 'l', 0, 'Posture', 'body'],
    ['chest', 1, 0, 0.5, 1, 'l', 0, 'Chest', 'body'],
    ['neckLen', 3, 0.15, 1, 2.5, 'g', 0, 'Neck length', 'head'],
    ['neckThick', 1, 0.55, 1, 1.6, 'g', 0, 'Neck girth', 'head'],
    ['neckCurve', 1, 0, 0.4, 1, 'l', 0, 'Neck curve', 'head'],
    ['headSize', 2, 0.6, 1, 1.6, 'g', 0, 'Head size', 'head'],
    ['eyeSize', 1, 0.5, 1, 1.9, 'g', 0, 'Eye size', 'head'],
    ['beakLen', 3, 0, 1, 2.4, 'l', 0, 'Beak length', 'beak'],
    ['beakDepth', 2, 0.4, 1, 1.7, 'g', 0, 'Beak depth', 'beak'],
    ['beakHook', 2, 0, 0.2, 1, 'l', 0, 'Beak hook', 'beak'],
    ['beakFlat', 1, 0, 0.1, 1, 'l', 0, 'Bill flatness', 'beak'],
    ['pouch', 1, 0, 0.05, 1, 'l', 0, 'Throat pouch', 'beak'],
    ['legLen', 3, 0.25, 1, 2.7, 'g', 0, 'Leg length', 'legs'],
    ['shin', 1, 0.36, 0.5, 0.64, 'l', 0, 'Shin ratio', 'legs'],
    ['legThick', 2, 0.45, 1, 1.9, 'g', 0, 'Leg girth', 'legs'],
    ['footSize', 2, 0.5, 1, 1.9, 'g', 0, 'Foot size', 'legs'],
    ['talon', 2, 0, 0.3, 1, 'l', 0, 'Talons', 'legs'],
    ['spur', 2, 0, 0.4, 1, 'l', 1, 'Spurs', 'legs'],
    ['web', 1, 0, 0.1, 1, 'l', 0, 'Webbing', 'legs', 'd'],
    ['wingSize', 3, 0, 1, 2.3, 'l', 0, 'Wing size', 'wings'],
    ['wingPoint', 1, 0, 0.4, 1, 'l', 0, 'Wing shape', 'wings'],
    ['tailLen', 2, 0, 1, 2.6, 'l', 1, 'Tail length', 'wings'],
    ['tailFan', 2, 0, 0.4, 1, 'l', 0, 'Tail fan', 'wings'],
    ['tailUp', 1, 0, 0.6, 1, 'l', 0, 'Tail carriage', 'wings'],
    ['comb', 2, 0, 0.7, 1.7, 'l', 1, 'Comb size', 'crest'],
    ['combType', 1, 0, 0.5, 1, 'l', 0, 'Comb type', 'crest'],
    ['wattle', 1, 0, 0.5, 1, 'l', 0, 'Wattles', 'crest'],
    ['crest', 1, 0, 0.15, 1, 'l', 0, 'Feather crest', 'crest'],
    ['bareHead', 1, 0, 0.1, 1, 'l', 0, 'Bare head', 'crest'],
    ['hue', 2, 0, 0.5, 1, 'l', 0, 'Plumage hue', 'colour', 'sp'],
    ['sat', 1, 0, 0.45, 1, 'l', 0, 'Plumage vividness', 'colour', 'p'],
    ['lit', 2, 0.08, 0.45, 0.95, 'l', 0, 'Plumage brightness', 'colour', 'p'],
    ['hueWing', 1, -0.25, 0, 0.25, 'l', 0, 'Wing tint', 'colour', 'p'],
    ['litWing', 1, -0.3, -0.05, 0.3, 'l', 0, 'Wing shade', 'colour', 'p'],
    ['hueTail', 1, -0.4, 0, 0.4, 'l', 0, 'Tail tint', 'colour', 'p'],
    ['litTail', 1, -0.4, -0.1, 0.3, 'l', 0, 'Tail shade', 'colour', 'p'],
    ['hueHead', 1, -0.3, 0, 0.3, 'l', 0, 'Head tint', 'colour', 'p'],
    ['litHead', 1, -0.3, 0, 0.4, 'l', 0, 'Head shade', 'colour', 'p'],
    ['beakTone', 1, 0, 0.5, 1, 'l', 0, 'Beak colour', 'colour', 'p'],
    ['legTone', 1, 0, 0.5, 1, 'l', 0, 'Leg colour', 'colour', 'p'],
    ['combHue', 1, -0.5, 0, 0.5, 'l', 0, 'Comb colour', 'colour', 'p'],
    ['pattern', 1, 0, 0.5, 1, 'l', 0, 'Feather pattern', 'colour', 'p'],
    ['patContrast', 1, 0, 0.4, 1, 'l', 0, 'Pattern contrast', 'colour', 'p'],
    ['belly', 1, 0, 0.3, 1, 'l', 0, 'Pale belly', 'colour', 'p'],
    ['sheen', 1, 0, 0.1, 1, 'l', 0, 'Iridescence', 'colour', 'dp'],
    ['eyeTone', 1, 0, 0.5, 1, 'l', 0, 'Eye colour', 'colour', 'p'],
    ['muscle', 3, 0.6, 1, 1.5, 'g', 0, 'Muscle', 'vigour'],
    ['bone', 2, 0.6, 1, 1.5, 'g', 0, 'Bone density', 'vigour'],
    ['lungs', 3, 0.5, 1, 1.6, 'g', 0, 'Lungs', 'vigour'],
    ['reflex', 2, 0.55, 1, 1.5, 'g', 0, 'Reflexes', 'vigour'],
    ['hide', 2, 0.7, 1, 1.4, 'g', 0, 'Tough hide', 'vigour'],
    ['aggression', 3, 0, 0.5, 1, 'l', 1, 'Aggression', 'mind'],
    ['courage', 3, 0, 0.5, 1, 'l', 0, 'Courage', 'mind'],
    ['focus', 2, 0, 0.5, 1, 'l', 0, 'Focus', 'mind'],
    ['cunning', 2, 0, 0.5, 1, 'l', 0, 'Cunning', 'mind'],
    ['lifespan', 2, 9, 14, 22, 'l', 0, 'Lifespan', 'life'],
    ['fertility', 2, 0.4, 0.85, 1.25, 'l', 0, 'Fertility', 'life'],
    ['growth', 1, 0.6, 1, 1.5, 'g', 0, 'Growth rate', 'life'],
    ['appetite', 1, 0.6, 1, 1.5, 'g', 0, 'Appetite', 'life'],
    ['voicePitch', 1, 0, 0.5, 1, 'l', 0, 'Voice pitch', 'life'],
    ['voiceRasp', 1, 0, 0.5, 1, 'l', 0, 'Voice rasp', 'life'],
    ['voiceLen', 1, 0, 0.5, 1, 'l', 0, 'Call length', 'life'],
    ['armLen', 1, 0.5, 1, 1.6, 'g', 0, 'Arm length', 'odd'],
  ];
  // Colour morphs added later, placed on loci that used to be junk so older saves keep their layout.
  // [id, label, threshold, mode]: a dominant morph shows with one copy, a recessive one needs two.
  const EXTRA = [['melanic', 'Melanism', 10, 'dom'], ['leucistic', 'Leucism', 9, 'rec']];
  // Later still, two more junk loci came to life (after these, so the loci above stay where they are):
  // the bill's shape, and a sail along the back. Random junk almost never spells either, so birds
  // made before them look as they always did; and where a kind does not ask for them, they are made
  // just as junk was, so everyone generated from a seed (the people of a world, say) stays the same.
  // Bill shape: a copy spells a shape when it ends in TA; its first two bases say which. The bill takes
  // that shape only when both copies spell the same one (recessive), else it stays plain. (Junk ends
  // in TA in about one copy in fifty, and two copies spelling the same shape by chance is rarer still.)
  const SHAPE_CODES = ['plain', 'spoon', 'down', 'up', 'crossed', 'casque', 'skimmer', 'sword', 'jaws', 'snout', 'plain', 'plain', 'plain', 'plain', 'plain', 'plain'];
  const LATE_Q = [['billShape', 'Bill shape', 'beak']];
  // Back sail: both copies must read TATA, exactly (junk does so about once in two thousand copies).
  const LATE_SW = [['sail', 'Back sail', [3, 0, 3, 0]]];
  // Switches: recessive on/off genes. [id, label, threshold (min copy sum needed)]
  const SW = [
    ['teeth', 'Teeth', 9], ['arms', 'Arms', 9], ['bare', 'Bare skin', 9],
    ['twoHeadsA', 'Twin head I', 9], ['twoHeadsB', 'Twin head II', 9],
    ['glow', 'Glow', 9], ['tailBone', 'Bony tail', 9], ['gigas', 'Gigantism', 9], ['nana', 'Dwarfism', 9],
    ['knee', 'Forward knees', 9], ['cyclops', 'One eye', 9], ['earTuft', 'Ear tufts', 9],
    ['legsExtra', 'Extra legs', 9], ['fluff', 'Feathered feet', 9],
  ];

  const TRAITS = {}; // id -> def
  const TRAIT_LIST = [];
  for (const q of Q) {
    const def = { id: q[0], n: q[1], min: q[2], mid: q[3], max: q[4], curve: q[5], z: q[6], label: q[7], group: q[8],
      mode: (q[9] || '').includes('d') ? 'dom' : 'add', sep: (q[9] || '').includes('s'), pos: (q[9] || '').includes('p'), genes: [] };
    TRAITS[def.id] = def; TRAIT_LIST.push(def);
  }
  for (const s of SW) {
    const def = { id: s[0], n: 1, switch: true, thr: s[2], label: s[1], group: 'odd', mode: 'rec', z: 0, genes: [] };
    TRAITS[def.id] = def; TRAIT_LIST.push(def);
  }
  for (const s of EXTRA) {
    const def = { id: s[0], n: 1, switch: true, thr: s[2], label: s[1], group: 'colour', mode: s[3], z: 0, genes: [], extra: true };
    TRAITS[def.id] = def; TRAIT_LIST.push(def);
  }
  for (const s of LATE_Q) { const def = { id: s[0], n: 1, shape: true, label: s[1], group: s[2], mode: 'rec', pos: true, z: 0, genes: [], extra: true, late: true }; TRAITS[def.id] = def; TRAIT_LIST.push(def); }
  for (const s of LATE_SW) { const def = { id: s[0], n: 1, switch: true, code: s[2], thr: 12, label: s[1], group: 'odd', mode: 'rec', z: 0, genes: [], extra: true, late: true }; TRAITS[def.id] = def; TRAIT_LIST.push(def); }

  // Fixed gene layout: related genes are scattered over the chromosomes by a fixed-seed shuffle,
  // so the map is the same in every save and what a player learns about it stays true.
  const GENES = new Array(N_GENES);
  (function layout() {
    const rng = new Rng(0xbea4e25);
    const zSlots = [], other = [];
    for (let i = 0; i < N_GENES; i++) (Math.floor(i / GENES_PER_CHR) === Z_CHR ? zSlots : other).push(i);
    rng.shuffle(zSlots); rng.shuffle(other);
    const want = [];
    for (const def of TRAIT_LIST) if (!def.extra) for (let k = 0; k < def.n; k++) want.push({ def, k, z: k >= def.n - def.z });
    for (const w of want) if (w.z) w.slot = zSlots.pop();
    const pool = rng.shuffle(other.concat(zSlots));
    for (const w of want) if (!w.z) w.slot = pool.pop();
    const roman = ['I', 'II', 'III'];
    // the later additions go onto free autosomal loci, chosen by their own fixed seed
    const free = [];
    for (const w of want) free[w.slot] = true;
    const spare = [];
    for (let i = 0; i < N_GENES; i++) if (!free[i] && Math.floor(i / GENES_PER_CHR) !== Z_CHR) spare.push(i);
    new Rng(0xc0102).shuffle(spare);
    for (const def of TRAIT_LIST) if (def.extra) want.push({ def, k: 0, z: false, slot: spare.pop() });
    for (const w of want) {
      const g = { idx: w.slot, chr: Math.floor(w.slot / GENES_PER_CHR), slot: w.slot % GENES_PER_CHR, trait: w.def.id, k: w.k,
        mode: w.def.mode, pos: !!w.def.pos, name: w.def.label + (w.def.n > 1 ? ' ' + roman[w.k] : '') };
      GENES[w.slot] = g; w.def.genes[w.k] = w.slot;
    }
    for (let i = 0; i < N_GENES; i++) {
      if (!GENES[i]) GENES[i] = { idx: i, chr: Math.floor(i / GENES_PER_CHR), slot: i % GENES_PER_CHR, trait: null, k: 0, mode: 'add', name: 'Junk DNA' };
    }
  })();

  function mapTrait(def, v) {
    if (def.curve === 'g') {
      return v >= 0.5 ? def.mid * Math.pow(def.max / def.mid, (v - 0.5) * 2) : def.mid * Math.pow(def.min / def.mid, (0.5 - v) * 2);
    }
    return v >= 0.5 ? lerp(def.mid, def.max, (v - 0.5) * 2) : lerp(def.min, def.mid, v * 2);
  }
  function unmapTrait(def, x) {
    x = clamp(x, def.min, def.max);
    if (def.curve === 'g') {
      return x >= def.mid ? 0.5 + 0.5 * Math.log(x / def.mid) / Math.log(def.max / def.mid) : 0.5 - 0.5 * Math.log(x / def.mid) / Math.log(def.min / def.mid);
    }
    if (x >= def.mid) return def.max === def.mid ? 0.5 : 0.5 + 0.5 * (x - def.mid) / (def.max - def.mid);
    return def.mid === def.min ? 0.5 : 0.5 * (x - def.min) / (def.mid - def.min);
  }

  const blank = (sex) => ({ a: new Uint8Array(N_BASES), b: new Uint8Array(N_BASES), sex: sex || 'M' });
  const clone = (g) => ({ a: new Uint8Array(g.a), b: new Uint8Array(g.b), sex: g.sex });
  const copySum = (strand, gi) => { const o = gi * GENE_LEN; return strand[o] + strand[o + 1] + strand[o + 2] + strand[o + 3]; };
  const isHemi = (g, gi) => g.sex === 'F' && GENES[gi].chr === Z_CHR;

  // One copy of a gene as 0..1. Most genes count their bases (so ACGT and TGCA are the same);
  // colour genes read them as a base-4 number, so any change of base changes the colour.
  const posValue = (strand, gi) => { const o = gi * GENE_LEN; return (strand[o] * 64 + strand[o + 1] * 16 + strand[o + 2] * 4 + strand[o + 3]) / 255; };
  const copyValue = (strand, gi) => (GENES[gi].pos ? posValue(strand, gi) : copySum(strand, gi) / 12);
  // How strongly a copy is expressed next to the other one. Each allele carries its own dominance
  // (one base that does not change its value much), so a hybrid can take a whole body part after
  // one parent, blend the two, or anything between.
  const DOM_W = [1, 1.9, 3.6, 7];
  const domOf = (strand, gi) => DOM_W[strand[gi * GENE_LEN + (GENES[gi].pos ? 3 : 0)]];

  function geneValue(g, gi) {
    const va = copyValue(g.a, gi);
    if (isHemi(g, gi)) return va;
    const vb = copyValue(g.b, gi), mode = GENES[gi].mode;
    return mode === 'add' ? (va + vb) / 2 : mode === 'dom' ? Math.max(va, vb) : Math.min(va, vb);
  }
  // Plumage hue: a circular blend of the two copies, weighted by their dominance.
  function hueValue(g) {
    const def = TRAITS.hue, g0 = def.genes[0], g1 = def.genes[1];
    const hc = (s) => copyValue(s, g0) + (copyValue(s, g1) - 0.5) * 0.16;
    const da = domOf(g.a, g0), db = domOf(g.b, g0), ha = hc(g.a) * Math.PI * 2, hb = hc(g.b) * Math.PI * 2;
    let h = Math.atan2(Math.sin(ha) * da + Math.sin(hb) * db, Math.cos(ha) * da + Math.cos(hb) * db) / (Math.PI * 2);
    return h < 0 ? h + 1 : h;
  }
  // 0..1 value of a trait before mapping to its units. Each parent's copy gives a value over all the
  // trait's genes; the two are then weighted by the dominance of the major gene's copies.
  function trait01(g, id) {
    const def = TRAITS[id];
    if (def.sep) return hueValue(g);
    let w = 0;
    if (def.mode !== 'add') {
      let sum = 0;
      for (let k = 0; k < def.n; k++) { sum += geneValue(g, def.genes[k]) * GENE_WEIGHTS[k]; w += GENE_WEIGHTS[k]; }
      return sum / w;
    }
    let sa = 0, sb = 0;
    for (let k = 0; k < def.n; k++) {
      const gi = def.genes[k], wk = GENE_WEIGHTS[k], a = copyValue(g.a, gi);
      sa += a * wk; sb += (isHemi(g, gi) ? a : copyValue(g.b, gi)) * wk; w += wk;
    }
    const g0 = def.genes[0], da = domOf(g.a, g0), db = domOf(isHemi(g, g0) ? g.a : g.b, g0);
    return (sa * da + sb * db) / (w * (da + db));
  }
  const traitValue = (g, id) => mapTrait(TRAITS[id], trait01(g, id));
  // ---- the bill's shape: what one copy spells ('' if it spells nothing), and what the bill is
  function copyShape(strand, gi) {
    const o = gi * GENE_LEN;
    return strand[o + 2] === 3 && strand[o + 3] === 0 ? SHAPE_CODES[strand[o] * 4 + strand[o + 1]] : '';
  }
  function billShape(g) {
    const gi = TRAITS.billShape.genes[0], a = copyShape(g.a, gi), b = copyShape(g.b, gi);
    return a && a === b ? a : 'plain';
  }
  // The four bases that spell a shape.
  function shapeBases(shape) { const i = Math.max(0, SHAPE_CODES.indexOf(shape)); return [i >> 2, i & 3, 3, 0]; }
  // A switch is on when its copies add up to enough (one copy for a dominant one, both for a recessive
  // one); a switch with a code needs both copies to read exactly that.
  const copyIs = (strand, gi, code) => { const o = gi * GENE_LEN; return strand[o] === code[0] && strand[o + 1] === code[1] && strand[o + 2] === code[2] && strand[o + 3] === code[3]; };
  function switchOn(g, id) {
    const def = TRAITS[id];
    if (def.code) { const gi = def.genes[0]; return copyIs(g.a, gi, def.code) && (isHemi(g, gi) || copyIs(g.b, gi, def.code)); }
    return geneValue(g, def.genes[0]) * 12 >= def.thr - 1e-6;
  }

  // Random 4 bases with the given sum (0..12).
  function basesForSum(sum, rng) {
    sum = clamp(Math.round(sum), 0, 12);
    const b = [0, 0, 0, 0];
    let left = sum;
    while (left > 0) { const i = rng.int(0, 3); if (b[i] < 3) { b[i]++; left--; } }
    return b;
  }
  // How much each colour gene wanders within a kind, relative to its colour variation: shade and
  // vividness vary freely, hue less, so a kind keeps its palette while no two birds match.
  const CV_MUL = { hue: 0.25, hueWing: 0.4, hueTail: 0.45, hueHead: 0.3, combHue: 0.15, eyeTone: 0.6, beakTone: 0.7, legTone: 0.7 };
  // Bases that read as v (0..1) by position; the last base (the dominance one) is random.
  function basesForPos(v, rng) {
    const n = (Math.round(clamp(v, 0, 1) * 255) & ~3) | rng.int(0, 3);
    return [(n >> 6) & 3, (n >> 4) & 3, (n >> 2) & 3, n & 3];
  }
  function setGeneBases(g, gi, bases, copy) {
    const o = gi * GENE_LEN;
    for (let i = 0; i < GENE_LEN; i++) {
      if (copy !== 'b') g.a[o + i] = bases[i];
      if (copy !== 'a' && !isHemi(g, gi)) g.b[o + i] = bases[i];
    }
  }
  function getGeneBases(g, gi, copy) {
    const o = gi * GENE_LEN, s = copy === 'b' && !isHemi(g, gi) ? g.b : g.a;
    return [s[o], s[o + 1], s[o + 2], s[o + 3]];
  }

  function random(rng, sex) {
    const g = blank(sex || (rng.chance(0.5) ? 'M' : 'F'));
    for (let i = 0; i < N_BASES; i++) { g.a[i] = rng.int(0, 3); g.b[i] = rng.int(0, 3); }
    return g;
  }

  // Build a genome whose traits land near the given targets (in trait units); missing traits take
  // the default (mid) value. `switches` lists the switches to turn on.
  // opts: { sex, variation (std dev in base-sum units), colorVar (std dev of colour genes, 0..1),
  //         carrier (chance of a hidden recessive switch copy), carriers ({ switchId: chance per copy }) }
  function fromTargets(targets, switches, rng, opts) {
    opts = opts || {};
    const variation = opts.variation === undefined ? 0.7 : opts.variation;
    const cvar = opts.colorVar === undefined ? 0.04 : opts.colorVar;
    const g = blank(opts.sex || (rng.chance(0.5) ? 'M' : 'F'));
    const on = new Set(switches || []);
    for (let gi = 0; gi < N_GENES; gi++) {
      const gene = GENES[gi], def = gene.trait ? TRAITS[gene.trait] : null;
      const asked = def && def.late && (def.shape ? targets && targets[def.id] && targets[def.id] !== 'plain' : on.has(def.id));
      for (const copy of ['a', 'b']) {
        if (!def || (def.late && !asked)) { setGeneBases(g, gi, basesForSum(rng.int(0, 12), rng), copy); continue; }
        if (def.shape) { setGeneBases(g, gi, shapeBases(targets[def.id]), copy); continue; }
        if (def.late) { setGeneBases(g, gi, def.code, copy); continue; }
        if (def.switch) {
          const p = opts.carriers && opts.carriers[def.id] !== undefined ? opts.carriers[def.id] : def.mode === 'dom' ? 0 : opts.carrier === undefined ? 0.04 : opts.carrier;
          const sum = on.has(def.id) ? rng.int(10, 12) : rng.chance(p) ? rng.int(def.thr, 12) : rng.int(0, Math.min(7, def.thr - 2));
          setGeneBases(g, gi, basesForSum(sum, rng), copy);
          continue;
        }
        const t = targets && targets[def.id] !== undefined ? targets[def.id] : def.mid;
        let v = def.sep && gene.k > 0 ? 0.5 : unmapTrait(def, t);
        if (def.pos) {
          v += rng.gauss() * cvar * (def.sep ? (gene.k > 0 ? 0.25 : CV_MUL.hue) : CV_MUL[def.id] || 1);
          if (def.sep && gene.k === 0) v = ((v % 1) + 1) % 1;
          setGeneBases(g, gi, basesForPos(v, rng), copy);
        } else setGeneBases(g, gi, basesForSum(v * 12 + rng.gauss() * variation, rng), copy);
      }
      // a recessive carrier copy must never switch the trait on by accident
      if (def && def.switch && !def.late && def.mode === 'rec' && !on.has(def.id) && switchOn(g, def.id)) {
        setGeneBases(g, gi, basesForSum(rng.int(0, 6), rng), isHemi(g, gi) ? 'a' : 'b');
      }
    }
    return g;
  }

  // One gamete: a haploid set of chromosomes with crossing-over. Returns { bases, w }.
  function gamete(g, rng) {
    const out = new Uint8Array(N_BASES);
    let w = false;
    for (let c = 0; c < N_CHR; c++) {
      const o = c * CHR_LEN;
      if (c === Z_CHR && g.sex === 'F') {
        if (rng.chance(0.5)) { w = true; continue; }
        for (let i = 0; i < CHR_LEN; i++) out[o + i] = g.a[o + i];
        continue;
      }
      let cur = rng.chance(0.5) ? g.a : g.b;
      for (let i = 0; i < CHR_LEN; i++) {
        if (i > 0 && rng.chance(1.3 / CHR_LEN)) cur = cur === g.a ? g.b : g.a;
        out[o + i] = cur[o + i];
      }
    }
    return { bases: out, w };
  }

  function mutateBase(strand, i, rng) { strand[i] = (strand[i] + rng.int(1, 3)) % 4; }

  // n random point mutations, anywhere in the genome.
  function mutate(g, rng, n) {
    for (let k = 0; k < n; k++) {
      const i = rng.int(0, N_BASES - 1), gi = Math.floor(i / GENE_LEN);
      mutateBase(rng.chance(0.5) || isHemi(g, gi) ? g.a : g.b, i, rng);
    }
    return g;
  }

  // Re-roll n coding genes to an extreme: the visible "sports" among wild animals.
  function sport(g, rng, n) {
    for (let k = 0; k < n; k++) {
      let gi; do { gi = rng.int(0, N_GENES - 1); } while (!GENES[gi].trait || TRAITS[GENES[gi].trait].switch || TRAITS[GENES[gi].trait].late);
      const sum = rng.chance(0.5) ? rng.int(0, 2) : rng.int(10, 12);
      setGeneBases(g, gi, basesForSum(sum, rng), 'both');
    }
    return g;
  }

  // Child of a ZW mother and a ZZ father. opts.mutRate is per base (default 0.003).
  function breed(mother, father, rng, opts) {
    const mu = opts && opts.mutRate !== undefined ? opts.mutRate : 0.003;
    const gd = gamete(father, rng), gm = gamete(mother, rng);
    const child = { a: gd.bases, b: gm.bases, sex: gm.w ? 'F' : 'M' };
    for (let i = 0; i < N_BASES; i++) {
      if (rng.chance(mu)) mutateBase(child.a, i, rng);
      if (rng.chance(mu)) mutateBase(child.b, i, rng);
    }
    return child;
  }

  // Mean difference of gene values over the coding genes: 0 identical, about 0.3+ unrelated species.
  function distance(g1, g2) {
    let sum = 0, n = 0;
    for (let gi = 0; gi < N_GENES; gi++) {
      if (!GENES[gi].trait) continue;
      sum += Math.abs(geneValue(g1, gi) - geneValue(g2, gi)); n++;
    }
    return sum / n;
  }

  const strandToString = (s) => { let out = ''; for (let i = 0; i < s.length; i++) out += BASES[s[i]]; return out; };
  const stringToStrand = (str) => { const s = new Uint8Array(N_BASES); for (let i = 0; i < N_BASES; i++) { const v = BASES.indexOf(str[i]); s[i] = v < 0 ? 0 : v; } return s; };
  const serialize = (g) => ({ a: strandToString(g.a), b: strandToString(g.b), s: g.sex });
  const deserialize = (o) => ({ a: stringToStrand(o.a), b: stringToStrand(o.b), sex: o.s === 'F' ? 'F' : 'M' });
  function hash(g) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < N_BASES; i++) { h ^= g.a[i] + 4 * g.b[i] + 1; h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  RB.genome = { SHAPE_CODES, copyShape, copyIs, billShape, shapeBases, BASES, N_CHR, GENES_PER_CHR, GENE_LEN, CHR_LEN, N_GENES, N_BASES, Z_CHR, TRAITS, TRAIT_LIST, GENES, DOM_W,
    mapTrait, unmapTrait, blank, clone, copySum, copyValue, posValue, isHemi, geneValue, hueValue, trait01, traitValue, switchOn, basesForSum, basesForPos,
    setGeneBases, getGeneBases, random, fromTargets, gamete, mutate, sport, breed, distance, serialize, deserialize, hash };
})();
