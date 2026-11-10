/* Filogênese — geração procedural de famílias, espécies, nichos, genomas e nomes. */
(function (FG) {
  'use strict';
  const U = FG.U, Parts = FG.Parts;

  // Biomas (ids usados pelo mundo e pelas espécies)
  const B = FG.B = { DEEP: 0, SHALLOW: 1, BEACH: 2, GRASS: 3, FOREST: 4, SAVANNA: 5, DESERT: 6, SWAMP: 7, TUNDRA: 8, ROCK: 9, SNOW: 10 };

  /* Nichos ecológicos. react: flee (foge), neutral (ignora), defend (revida), territorial, hunter (caça). */
  const NICHES = {
    pastador:    { diet: 'H', group: [4, 6], react: 'flee', fear: 0.75, aggr: 0, soc: 1.0 },
    frugivoro:   { diet: 'H', group: [3, 5], react: 'flee', fear: 1, aggr: 0, soc: 1.1 },
    ramoneador:  { diet: 'H', group: [2, 3], react: 'defend', fear: 0.1, aggr: 0.35, soc: 0.85 },
    cantor:      { diet: 'H', group: [3, 5], react: 'neutral', fear: 0.4, aggr: 0.05, soc: 0.9 },
    oportunista: { diet: 'O', group: [2, 4], react: 'neutral', fear: 0.35, aggr: 0.3, soc: 0.9 },
    anfibio:     { diet: 'O', group: [3, 4], react: 'neutral', fear: 0.5, aggr: 0.15, soc: 1.0 },
    guardiao:    { diet: 'O', group: [2, 4], react: 'territorial', fear: 0, aggr: 0.6, soc: 0.7 },
    necrofago:   { diet: 'C', group: [2, 3], react: 'neutral', fear: 0.6, aggr: 0.35, soc: 0.7 },
    emboscador:  { diet: 'C', group: [1, 2], react: 'hunter', fear: 0.05, aggr: 0.9, soc: 0.5 },
    matilha:     { diet: 'C', group: [3, 5], react: 'hunter', fear: 0.15, aggr: 0.8, soc: 0.55 },
    apice:       { diet: 'C', group: [1, 1], react: 'hunter', fear: 0, aggr: 1, soc: 0.4 },
    tita:        { diet: 'O', group: [1, 1], react: 'territorial', fear: 0, aggr: 0.7, soc: 0.3 },
  };

  /* Planos corporais das famílias: cada mundo sorteia 8 destes 10 e varia tudo dentro das faixas. */
  const THEMES = [
    { key: 'saltador', pairs: [1, 1], segs: [6, 8], f: [0.8, 1], m: [1, 1.25], r: [0.7, 0.95], tail: [0.28, 0.42], heads: ['round', 'wedge'], hsize: [1.05, 1.25], leg: [1.15, 1.5], size: [0.7, 0.92], tiers: [0, 3], niches: ['frugivoro', 'pastador', 'frugivoro', 'cantor'], biomes: [B.GRASS, B.FOREST, B.SAVANNA] },
    { key: 'corredor', pairs: [2, 2], segs: [8, 10], f: [0.8, 0.95], m: [0.9, 1.1], r: [0.75, 0.9], tail: [0.3, 0.4], heads: ['long', 'wedge'], hsize: [0.9, 1.05], leg: [1.2, 1.6], size: [0.85, 1.1], tiers: [0, 3], niches: ['pastador', 'frugivoro', 'pastador', 'oportunista'], biomes: [B.GRASS, B.SAVANNA, B.TUNDRA] },
    { key: 'cantor', pairs: [1, 2], segs: [7, 9], f: [0.85, 1], m: [1, 1.2], r: [0.8, 1], tail: [0.3, 0.42], heads: ['round', 'long'], hsize: [1, 1.15], leg: [1, 1.3], size: [0.8, 1.05], tiers: [0, 4], niches: ['cantor', 'cantor', 'oportunista', 'cantor'], biomes: [B.FOREST, B.GRASS, B.SWAMP] },
    { key: 'matilheiro', pairs: [2, 2], segs: [8, 10], f: [1, 1.2], m: [0.9, 1.05], r: [0.7, 0.85], tail: [0.3, 0.4], heads: ['long', 'wedge'], hsize: [1, 1.15], leg: [1, 1.3], size: [0.85, 1.12], tiers: [1, 4], niches: ['necrofago', 'matilha', 'matilha', 'apice'], biomes: [B.SAVANNA, B.TUNDRA, B.GRASS] },
    { key: 'couracado', pairs: [2, 3], segs: [7, 9], f: [1, 1.2], m: [1.3, 1.6], r: [1.1, 1.35], tail: [0.2, 0.3], heads: ['wide', 'flat'], hsize: [0.9, 1.05], leg: [0.6, 0.85], size: [1.05, 1.3], tiers: [1, 4], niches: ['pastador', 'ramoneador', 'guardiao', 'ramoneador'], biomes: [B.SAVANNA, B.GRASS, B.DESERT] },
    { key: 'espreitador', pairs: [3, 3], segs: [10, 13], f: [0.8, 0.95], m: [0.85, 1.05], r: [0.7, 0.85], tail: [0.35, 0.45], heads: ['wedge', 'long'], hsize: [0.95, 1.1], leg: [0.7, 0.95], size: [0.9, 1.2], tiers: [1, 4], niches: ['necrofago', 'emboscador', 'emboscador', 'apice'], biomes: [B.FOREST, B.SWAMP] },
    { key: 'rastejante', pairs: [0, 0], segs: [12, 14], f: [0.75, 0.9], m: [0.9, 1.1], r: [0.7, 0.9], tail: [0.4, 0.5], heads: ['wedge', 'flat', 'round'], hsize: [1, 1.15], leg: [1, 1], size: [0.8, 1.15], tiers: [0, 3], niches: ['oportunista', 'emboscador', 'necrofago', 'anfibio'], biomes: [B.DESERT, B.SWAMP, B.FOREST] },
    { key: 'catador', pairs: [3, 4], segs: [7, 9], f: [0.9, 1.1], m: [1.05, 1.3], r: [0.9, 1.15], tail: [0.15, 0.25], heads: ['wide', 'round'], hsize: [0.9, 1.05], leg: [0.9, 1.2], size: [0.7, 1], tiers: [0, 3], niches: ['necrofago', 'oportunista', 'oportunista', 'guardiao'], biomes: [B.DESERT, B.BEACH, B.SAVANNA] },
    { key: 'anfibio', pairs: [2, 2], segs: [7, 9], f: [1, 1.2], m: [1.1, 1.35], r: [0.85, 1.05], tail: [0.3, 0.42], heads: ['wide', 'flat'], hsize: [1, 1.15], leg: [0.8, 1.05], size: [0.8, 1.1], tiers: [0, 2], niches: ['anfibio', 'anfibio', 'oportunista', 'guardiao'], biomes: [B.BEACH, B.SWAMP] },
    { key: 'colosso', pairs: [2, 2], segs: [9, 11], f: [1.15, 1.35], m: [1.2, 1.45], r: [0.9, 1.1], tail: [0.3, 0.4], heads: ['wedge', 'wide'], hsize: [0.95, 1.1], leg: [1, 1.25], size: [1.25, 1.5], tiers: [2, 4], niches: ['ramoneador', 'apice', 'guardiao'], biomes: [B.TUNDRA, B.SAVANNA, B.FOREST] },
  ];

  const ONSETS = ['k', 'kr', 'z', 'v', 'th', 'gr', 'm', 'n', 's', 'sh', 't', 'tr', 'l', 'b', 'br', 'd', 'dr', 'f', 'g', 'h', 'j', 'p', 'pl', 'r', 'x', 'qu', 'y', 'ch'];
  const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ae', 'ou', 'ia', 'y'];
  const CODAS = ['l', 'n', 'r', 's', 'x', 'm', 'k', 'th', 'sh', 'rn', 'lk', ''];
  const ENDINGS = ['us', 'a', 'ix', 'on', 'ops', 'ia', 'ax', 'or', 'is', 'um'];
  // [latim, pt, en]
  const EPI = {
    stripes: ['striatus', 'Listrado', 'Striped'], rings: ['anulatus', 'Anelado', 'Ringed'], spots: ['maculatus', 'Pintado', 'Spotted'],
    patches: ['variegatus', 'Malhado', 'Mottled'], dorsal: ['dorsalis', 'Dorsal', 'Ridgeback'],
    fast: ['velox', 'Veloz', 'Swift'], fierce: ['ferox', 'Feroz', 'Fierce'], small: ['minor', 'Anão', 'Dwarf'], big: ['major', 'Grande', 'Greater'],
    night: ['nocturnus', 'Noturno', 'Night'], gentle: ['mansuetus', 'Manso', 'Gentle'], singer: ['cantans', 'Cantor', 'Singing'],
    armored: ['armatus', 'Couraçado', 'Armored'], thorny: ['spinosus', 'Espinhoso', 'Thorny'], horned: ['cornutus', 'Chifrudo', 'Horned'],
    leaper: ['saltator', 'Saltador', 'Leaping'], shadow: ['umbrosus', 'Sombrio', 'Shadow'], winged: ['alatus', 'Alado', 'Winged'],
    red: ['rubens', 'Rubro', 'Crimson'], gold: ['aureus', 'Dourado', 'Golden'], green: ['viridis', 'Verde', 'Green'], blue: ['caeruleus', 'Azul', 'Blue'],
    violet: ['violaceus', 'Violeta', 'Violet'], grey: ['cinereus', 'Cinzento', 'Ashen'],
    [B.SWAMP]: ['palustris', 'do Brejo', 'Marsh'], [B.DESERT]: ['arenarius', 'das Dunas', 'Dune'], [B.FOREST]: ['silvestris', 'da Mata', 'Forest'],
    [B.TUNDRA]: ['nivalis', 'das Neves', 'Snow'], [B.BEACH]: ['litoralis', 'da Costa', 'Shore'], [B.SAVANNA]: ['campestris', 'da Savana', 'Savanna'], [B.GRASS]: ['pratensis', 'do Prado', 'Meadow'],
  };
  const BIOME_TINT = { [B.TUNDRA]: [200, 12, 82], [B.DESERT]: [38, 55, 62], [B.SWAMP]: [110, 30, 30], [B.FOREST]: [120, 40, 36], [B.SAVANNA]: [45, 50, 52], [B.BEACH]: [45, 40, 70], [B.GRASS]: [95, 45, 48] };

  function makeRoot(r) {
    let s = r.pick(ONSETS) + r.pick(VOWELS) + r.pick(CODAS);
    if (s.length < 4 || r.chance(0.35)) s += r.pick(['a', 'o', 'i', 'e']) + r.pick(['l', 'n', 'r', 'k', 'x', 't']);
    return s;
  }

  /** Escolhe a melhor parte de uma categoria que satisfaz `pred`, até o nível `maxT`. */
  function pickPart(cat, maxT, r, pred) {
    let pool = Parts.inCat(cat).filter((p) => p.tier <= maxT && (!pred || pred(p)));
    if (!pool.length) pool = Parts.inCat(cat).filter((p) => !pred || pred(p));
    if (!pool.length) return null;
    const top = Math.max(...pool.map((p) => p.tier));
    const want = top > 1 && r.chance(0.3) ? top - 1 : top;
    const sel = pool.filter((p) => p.tier === want);
    return r.pick(sel.length ? sel : pool).id;
  }
  const has = (k) => (p) => p.st[k] > 0;

  /** Monta o genoma de uma espécie a partir do plano da família, do nicho e do nível. */
  function buildGenome(theme, fam, niche, tier, biome, r, sizeMul) {
    const N = NICHES[niche];
    const t4 = tier / 4;
    const mt = U.clamp(tier + 1, 1, 4);
    const g = {
      seed: (r() * 4294967296) >>> 0,
      size: U.lerp(theme.size[0], theme.size[1], t4) * r.range(0.96, 1.05) * (sizeMul || 1),
      segs: r.int(theme.segs[0], theme.segs[1]), len: r.range(0.92, 1.08),
      prof: [r.range(theme.f[0], theme.f[1]), r.range(theme.m[0], theme.m[1]), r.range(theme.r[0], theme.r[1])],
      tailLen: r.range(theme.tail[0], theme.tail[1]),
      head: { shape: fam.head, size: r.range(theme.hsize[0], theme.hsize[1]) },
      eyePairs: fam.eyePairs,
      legs: { pairs: fam.pairs, len: r.range(theme.leg[0], theme.leg[1]) },
      parts: { mouth: null, eyes: null, feet: null, arms: null, horn: null, tail: null, back: null, gland: null, voice: null, adorn: null },
      skin: null,
    };
    const P = g.parts;
    const diet = niche === 'cantor' && r.chance(0.35) ? 'O' : niche === 'guardiao' && r.chance(0.5) ? 'H' : N.diet;
    P.mouth = pickPart('mouth', mt, r, (p) => p.st.diet === diet);
    const hunter = N.react === 'hunter';
    P.eyes = pickPart('eyes', mt, r, hunter ? (p) => p.vis.k !== 'round' : null);
    const footWant = { pastador: 'speed', frugivoro: 'jump', ramoneador: 'hp', cantor: 'dance', oportunista: 'speed', anfibio: 'swim',
      guardiao: 'hp', necrofago: 'stealth', emboscador: 'stealth', matilha: 'speed', apice: 'speed', tita: 'hp' }[niche];
    P.feet = pickPart('feet', mt, r, (p) => (footWant === 'speed' ? p.st.speed >= 2 && !p.st.dance && !p.st.swim : p.st[footWant] > 0)) || 'f_coto';
    const ch = (p) => r.chance(p + t4 * 0.25);
    // armas
    if (niche === 'emboscador' || niche === 'apice' || (niche === 'matilha' && ch(0.4)) || (niche === 'oportunista' && ch(0.3)) || (niche === 'necrofago' && ch(0.5)) || niche === 'tita')
      P.arms = pickPart('arms', mt, r);
    if (niche === 'ramoneador' || niche === 'guardiao' || (niche === 'pastador' && tier >= 1 && ch(0.4)) || (niche === 'apice' && ch(0.4)) || niche === 'tita')
      P.horn = pickPart('horn', mt, r, has('charge'));
    if ((niche === 'emboscador' && ch(0.45)) || (niche === 'oportunista' && ch(0.3)) || (theme.key === 'rastejante' && tier >= 1) || (niche === 'necrofago' && ch(0.35)) || (niche === 'anfibio' && ch(0.3)))
      P.gland = pickPart('gland', mt, r);
    // cauda
    if (niche === 'ramoneador' || niche === 'tita' || (niche === 'guardiao' && ch(0.5))) P.tail = pickPart('tail', mt, r, has('strike'));
    else if (niche === 'cantor') P.tail = pickPart('tail', mt, r, (p) => p.st.charm > 0 || p.st.sing > 0);
    else if (niche === 'anfibio') P.tail = 't_leme';
    else if (niche === 'apice' && ch(0.5)) P.tail = pickPart('tail', mt, r, has('strike'));
    else if (niche === 'emboscador' && tier >= 2 && ch(0.3)) P.tail = 't_ferrao';
    else if (ch(0.18)) P.tail = pickPart('tail', Math.min(mt, 2), r);
    // dorso
    if (theme.key === 'couracado' || niche === 'tita') P.back = pickPart('back', Math.max(mt, 2), r, (p) => p.st.hp > 0);
    else if (niche === 'cantor') P.back = ch(0.6) ? pickPart('back', Math.max(mt, 2), r, (p) => p.st.charm > 0 && !p.st.hp) : null;
    else if (niche === 'apice' || (niche === 'emboscador' && ch(0.3))) P.back = 'b_espinhos';
    else if (niche === 'matilha' && ch(0.5)) P.back = 'b_juba';
    else if (theme.key === 'saltador' && tier >= 2) P.back = pickPart('back', mt, r, has('jump'));
    else if (niche === 'guardiao' && ch(0.5)) P.back = pickPart('back', Math.max(mt, 2), r, (p) => p.st.pose > 0 || p.st.hp > 0);
    // social
    if (niche === 'cantor' || niche === 'anfibio' || (niche === 'pastador' && ch(0.35)) || (niche === 'frugivoro' && ch(0.35)))
      P.voice = pickPart('voice', mt, r);
    if (niche === 'cantor' || (niche === 'frugivoro' && ch(0.55)) || (niche === 'pastador' && ch(0.25)) || (niche === 'oportunista' && ch(0.3)) || (niche === 'guardiao' && ch(0.4)))
      P.adorn = pickPart('adorn', mt, r);
    // pele: matiz da família com desvio da espécie e leve camuflagem do bioma
    const hue = (fam.hue + r.range(-26, 26) + 360) % 360;
    let c1 = [hue, fam.sat + r.range(-8, 8), fam.lum + r.range(-6, 6)];
    const tint = BIOME_TINT[biome];
    if (tint) c1 = U.hslMix(c1, tint, 0.28);
    const c2 = [(hue + r.pick([28, -32, 160, 185])) % 360, U.clamp(c1[1] + r.range(-5, 15), 20, 85), U.clamp(c1[2] + (r.chance(0.6) ? -22 : 20), 14, 84)];
    const c3 = [(hue + r.range(150, 210)) % 360, r.range(65, 90), r.range(52, 66)];
    g.skin = { pattern: r.chance(0.7) ? fam.pattern : r.pick(['stripes', 'spots', 'patches', 'dorsal', 'rings', 'plain']), c1, c2, c3 };
    return g;
  }

  function voiceFor(g, r) {
    return {
      f: U.clamp(520 / Math.pow(g.size, 1.5) * r.range(0.8, 1.25), 70, 1500),
      wave: r.pick(['sine', 'triangle', 'square', 'sawtooth', 'triangle']),
      vib: r.range(4, 26), vibDepth: r.range(0.01, 0.07),
      glide: r.pick(['up', 'down', 'updown', 'flat', 'chirp']),
      syll: r.int(1, 4), mel: (r() * 1e9) | 0,
    };
  }

  function pickEpithet(sp, g, st, used, r) {
    const hue = g.skin.c1[0], sat = g.skin.c1[1];
    const color = sat < 22 ? 'grey' : hue < 20 || hue >= 335 ? 'red' : hue < 65 ? 'gold' : hue < 170 ? 'green' : hue < 265 ? 'blue' : 'violet';
    const c = [];
    if (sp.nocturnal) c.push('night');
    if (g.parts.back === 'b_asas' || g.parts.back === 'b_asinhas') c.push('winged');
    if (st.hp > 150 && (g.parts.back === 'b_placas' || g.parts.back === 'b_couraca')) c.push('armored');
    if (g.parts.horn) c.push('horned');
    if (st.sing >= 4) c.push('singer');
    if (st.jump >= 3) c.push('leaper');
    if (st.speed >= 4) c.push('fast');
    if (st.thorns) c.push('thorny');
    if (NICHES[sp.niche].react === 'hunter') c.push(r.chance(0.5) ? 'fierce' : 'shadow');
    if (NICHES[sp.niche].react === 'flee') c.push('gentle');
    c.push(sp.biome);
    if (EPI[g.skin.pattern]) c.push(g.skin.pattern);
    c.push(color);
    c.push(sp.tier <= 1 ? 'small' : 'big');
    r.shuffle(c);
    for (const k of c) if (!used[k]) { used[k] = 1; return EPI[k]; }
    for (const k in EPI) if (!used[k]) { used[k] = 1; return EPI[k]; }
    return EPI.grey;
  }

  const MAP_COL = { H: '#7bd66a', C: '#ef6a5a', O: '#f0c05a' };

  function finalize(sp) {
    sp.stats = Parts.stats(sp.genome, sp.level || 1);
    if (sp.isTitan) { sp.stats.hp = Math.round(sp.stats.hp * 2.4); sp.stats.power *= 1.15; }
    if (sp.isPlayer) sp.stats.moveSpeed = Math.round(sp.stats.moveSpeed * 1.1);
    sp.diet = sp.stats.diet;
    sp.mapColor = sp.isPlayer ? '#ffffff' : MAP_COL[sp.diet];
    sp.rev = (sp.rev || 0) + 1;
    return sp;
  }

  const Species = FG.Species = {
    NICHES, THEMES,

    /** Gera a fauna de um mundo: 8 famílias, ~27 espécies e 3 titãs. */
    generate(seed) {
      const r = U.rng(U.hash(seed, 77, 4242));
      const must = ['corredor', 'saltador', 'matilheiro', 'cantor'];
      const rest = r.shuffle(THEMES.filter((t) => !must.includes(t.key))).slice(0, 4);
      const themes = THEMES.filter((t) => must.includes(t.key)).concat(rest);
      const families = [], list = [], byId = {}, roots = {};
      let hue0 = r() * 360;
      themes.forEach((theme, fi) => {
        let root;
        do { root = makeRoot(r); } while (roots[root]);
        roots[root] = 1;
        hue0 = (hue0 + 360 / themes.length + r.range(-14, 14)) % 360;
        const fam = {
          id: 'f' + fi, theme: theme.key, root,
          genus: U.cap(root) + r.pick(ENDINGS),
          name: { pt: U.cap(root) + 'ídeos', en: U.cap(root) + 'ids' },
          hue: hue0, sat: r.range(42, 68), lum: r.range(42, 58),
          pattern: r.pick(['stripes', 'spots', 'patches', 'dorsal', 'rings', 'spots', 'stripes']),
          head: r.pick(theme.heads), pairs: r.int(theme.pairs[0], theme.pairs[1]), eyePairs: r.chance(0.2) ? 2 : 1,
          species: [],
        };
        families.push(fam);
        const n = theme.key === 'colosso' ? r.int(2, 3) : r.int(3, 4);
        const used = {};
        for (let j = 0; j < n; j++) {
          const tier = U.clamp(Math.round(U.lerp(theme.tiers[0], theme.tiers[1], n > 1 ? j / (n - 1) : 0)), 0, 4);
          const niche = theme.niches[j % theme.niches.length];
          const biome = theme.biomes[(j + (r.chance(0.3) ? 1 : 0)) % theme.biomes.length];
          const N = NICHES[niche];
          const sp = { id: 's' + list.length, fam: fam.id, niche, tier, biome, group: N.group.slice(), level: 1,
            nocturnal: r.chance(niche === 'emboscador' ? 0.6 : niche === 'necrofago' ? 0.4 : 0.08) };
          sp.genome = buildGenome(theme, fam, niche, tier, biome, r);
          finalize(sp);
          const e = pickEpithet(sp, sp.genome, sp.stats, used, r);
          sp.sci = fam.genus + ' ' + e[0];
          sp.name = { pt: fam.genus + ' ' + e[1], en: e[2] + ' ' + fam.genus };
          sp.voice = voiceFor(sp.genome, r);
          list.push(sp); byId[sp.id] = sp; fam.species.push(sp.id);
        }
      });
      // Titãs: gigantes ancestrais de três famílias diferentes
      const titans = [];
      const tf = r.shuffle(families.slice()).slice(0, 3);
      tf.forEach((fam, i) => {
        const theme = THEMES.find((t) => t.key === fam.theme);
        const sp = { id: 't' + i, fam: fam.id, niche: 'tita', tier: 4, biome: theme.biomes[0], group: [1, 1], level: 1, nocturnal: false, isTitan: true };
        sp.genome = buildGenome(theme, fam, 'tita', 4, sp.biome, r, 3.1 / U.lerp(theme.size[0], theme.size[1], 1));
        if (sp.genome.legs.pairs === 0) sp.genome.segs = 14;
        finalize(sp);
        sp.sci = fam.genus + ' titan';
        sp.name = { pt: fam.genus + ' Ancestral', en: 'Elder ' + fam.genus };
        sp.voice = voiceFor(sp.genome, r);
        list.push(sp); byId[sp.id] = sp; fam.species.push(sp.id); titans.push(sp.id);
      });
      return { families, list, byId, titans };
    },

    /** Espécie do jogador. */
    makePlayer(name, genome, level) {
      const sp = { id: 'player', fam: 'you', niche: 'oportunista', tier: 0, biome: B.BEACH, group: [3, 4], level: level || 1,
        nocturnal: false, isPlayer: true, genome, name: { pt: name, en: name }, sci: name };
      const r = U.rng(genome.seed ^ 0x51ed);
      finalize(sp);
      sp.voice = voiceFor(genome, r);
      sp.niche = Parts.nicheOf(sp.stats);
      return sp;
    },

    /** Recalcula atributos depois de mudar o genoma ou o nível. */
    refresh(sp) {
      finalize(sp);
      if (sp.isPlayer) sp.niche = Parts.nicheOf(sp.stats);
      return sp;
    },
  };
})(window.FG = window.FG || {});
