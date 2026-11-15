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
    ['hue', 2, 0, 0.5, 1, 'l', 0, 'Plumage hue', 'colour', 's'],
    ['sat', 1, 0, 0.45, 1, 'l', 0, 'Plumage vividness', 'colour'],
    ['lit', 2, 0.08, 0.45, 0.95, 'l', 0, 'Plumage brightness', 'colour'],
    ['hueWing', 1, -0.25, 0, 0.25, 'l', 0, 'Wing tint', 'colour'],
    ['litWing', 1, -0.3, -0.05, 0.3, 'l', 0, 'Wing shade', 'colour'],
    ['hueTail', 1, -0.4, 0, 0.4, 'l', 0, 'Tail tint', 'colour'],
    ['litTail', 1, -0.4, -0.1, 0.3, 'l', 0, 'Tail shade', 'colour'],
    ['hueHead', 1, -0.3, 0, 0.3, 'l', 0, 'Head tint', 'colour'],
    ['litHead', 1, -0.3, 0, 0.4, 'l', 0, 'Head shade', 'colour'],
    ['beakTone', 1, 0, 0.5, 1, 'l', 0, 'Beak colour', 'colour'],
    ['legTone', 1, 0, 0.5, 1, 'l', 0, 'Leg colour', 'colour'],
    ['combHue', 1, -0.5, 0, 0.5, 'l', 0, 'Comb colour', 'colour'],
    ['pattern', 1, 0, 0.5, 1, 'l', 0, 'Feather pattern', 'colour'],
    ['patContrast', 1, 0, 0.4, 1, 'l', 0, 'Pattern contrast', 'colour'],
    ['belly', 1, 0, 0.3, 1, 'l', 0, 'Pale belly', 'colour'],
    ['sheen', 1, 0, 0.1, 1, 'l', 0, 'Iridescence', 'colour', 'd'],
    ['eyeTone', 1, 0, 0.5, 1, 'l', 0, 'Eye colour', 'colour'],
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
      mode: (q[9] || '').includes('d') ? 'dom' : 'add', sep: (q[9] || '').includes('s'), genes: [] };
    TRAITS[def.id] = def; TRAIT_LIST.push(def);
  }
  for (const s of SW) {
    const def = { id: s[0], n: 1, switch: true, thr: s[2], label: s[1], group: 'odd', mode: 'rec', z: 0, genes: [] };
    TRAITS[def.id] = def; TRAIT_LIST.push(def);
  }

  // Fixed gene layout: related genes are scattered over the chromosomes by a fixed-seed shuffle,
  // so the map is the same in every save and what a player learns about it stays true.
  const GENES = new Array(N_GENES);
  (function layout() {
    const rng = new Rng(0xbea4e25);
    const zSlots = [], other = [];
    for (let i = 0; i < N_GENES; i++) (Math.floor(i / GENES_PER_CHR) === Z_CHR ? zSlots : other).push(i);
    rng.shuffle(zSlots); rng.shuffle(other);
    const want = [];
    for (const def of TRAIT_LIST) for (let k = 0; k < def.n; k++) want.push({ def, k, z: k >= def.n - def.z });
    for (const w of want) if (w.z) w.slot = zSlots.pop();
    const pool = rng.shuffle(other.concat(zSlots));
    for (const w of want) if (!w.z) w.slot = pool.pop();
    const roman = ['I', 'II', 'III'];
    for (const w of want) {
      const g = { idx: w.slot, chr: Math.floor(w.slot / GENES_PER_CHR), slot: w.slot % GENES_PER_CHR, trait: w.def.id, k: w.k,
        mode: w.def.mode, name: w.def.label + (w.def.n > 1 ? ' ' + roman[w.k] : '') };
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

  function geneValue(g, gi) {
    const va = copySum(g.a, gi) / 12;
    if (isHemi(g, gi)) return va;
    const vb = copySum(g.b, gi) / 12, mode = GENES[gi].mode;
    return mode === 'add' ? (va + vb) / 2 : mode === 'dom' ? Math.max(va, vb) : Math.min(va, vb);
  }
  // 0..1 value of a trait before mapping to its units (weighted mean of its genes)
  function trait01(g, id) {
    const def = TRAITS[id];
    if (def.sep) return geneValue(g, def.genes[0]);
    let sum = 0, w = 0;
    for (let k = 0; k < def.n; k++) { sum += geneValue(g, def.genes[k]) * GENE_WEIGHTS[k]; w += GENE_WEIGHTS[k]; }
    return sum / w;
  }
  const traitValue = (g, id) => mapTrait(TRAITS[id], trait01(g, id));
  const switchOn = (g, id) => { const def = TRAITS[id]; return geneValue(g, def.genes[0]) * 12 >= def.thr - 1e-6; };

  // Random 4 bases with the given sum (0..12).
  function basesForSum(sum, rng) {
    sum = clamp(Math.round(sum), 0, 12);
    const b = [0, 0, 0, 0];
    let left = sum;
    while (left > 0) { const i = rng.int(0, 3); if (b[i] < 3) { b[i]++; left--; } }
    return b;
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
  // the default (mid) value. `switches` lists the recessive switches to turn on.
  // opts: { sex, variation (std dev in base-sum units), carrier (chance of a hidden switch copy) }
  function fromTargets(targets, switches, rng, opts) {
    opts = opts || {};
    const variation = opts.variation === undefined ? 0.7 : opts.variation;
    const g = blank(opts.sex || (rng.chance(0.5) ? 'M' : 'F'));
    const on = new Set(switches || []);
    for (let gi = 0; gi < N_GENES; gi++) {
      const gene = GENES[gi];
      for (const copy of ['a', 'b']) {
        let sum;
        if (!gene.trait) sum = rng.int(0, 12);
        else {
          const def = TRAITS[gene.trait];
          if (def.switch) {
            if (on.has(def.id)) sum = rng.int(10, 12);
            else sum = rng.chance(opts.carrier === undefined ? 0.04 : opts.carrier) ? rng.int(9, 12) : rng.int(0, 7);
          } else {
            const t = targets && targets[def.id] !== undefined ? targets[def.id] : def.mid;
            const v = def.sep && gene.k > 0 ? 0.5 : unmapTrait(def, t);
            sum = v * 12 + rng.gauss() * variation * (def.sep ? 0.4 : 1);
          }
        }
        setGeneBases(g, gi, basesForSum(sum, rng), copy);
      }
      // a carrier copy must never switch the trait on by accident
      if (gene.trait && TRAITS[gene.trait].switch && !on.has(gene.trait) && switchOn(g, gene.trait)) {
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
      let gi; do { gi = rng.int(0, N_GENES - 1); } while (!GENES[gi].trait || TRAITS[GENES[gi].trait].switch);
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

  RB.genome = { BASES, N_CHR, GENES_PER_CHR, GENE_LEN, CHR_LEN, N_GENES, N_BASES, Z_CHR, TRAITS, TRAIT_LIST, GENES,
    mapTrait, unmapTrait, blank, clone, copySum, isHemi, geneValue, trait01, traitValue, switchOn, basesForSum,
    setGeneBases, getGeneBases, random, fromTargets, gamete, mutate, sport, breed, distance, serialize, deserialize, hash };
})();
