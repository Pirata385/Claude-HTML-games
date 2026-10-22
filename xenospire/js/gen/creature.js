// Procedural beings: anatomy, palette, personality, gameplay stats derived from
// the body, and a name/homeworld/bio. Fully deterministic from a seed.
(function (XS) {
  'use strict';

  // Tunables shared with balance (see tests/sim.test.js).
  const HP_BASE = 260;
  const SPEED_BASE = 6.2;

  const ARCHETYPES = {
    biped: { w: 3, legPairs: [1, 1], armPairs: [1, 1], posture: [0.72, 0.92], spine: [2, 3], tail: 0.5, wings: 0.12, knee: 'fwd', legLen: [2.2, 3.0], hp: 1, speed: 1 },
    quadruped: { w: 3, legPairs: [2, 2], armPairs: [0, 0], centaur: 0.2, posture: [0, 0.12], spine: [3, 4], tail: 0.85, wings: 0.12, knee: 'fwd', legLen: [1.7, 2.4], hp: 1.05, speed: 1.06 },
    hexapod: { w: 2, legPairs: [3, 3], armPairs: [0, 1], posture: [0, 0.18], spine: [2, 3], tail: 0.35, wings: 0.3, knee: 'up', legLen: [1.7, 2.5], hp: 0.95, speed: 1.08 },
    arachnid: { w: 1.6, legPairs: [4, 4], armPairs: [0, 0], posture: [0, 0.08], spine: [2, 2], tail: 0.3, wings: 0, knee: 'up', legLen: [2.1, 2.9], hp: 0.95, speed: 1.08 },
    serpent: { w: 1.8, legPairs: [0, 0], armPairs: [0, 1], posture: [0, 0], spine: [6, 8], tail: 0, wings: 0.15, knee: 'fwd', legLen: [0, 0], hp: 1.02, speed: 0.98 },
    floater: { w: 1.6, legPairs: [0, 0], armPairs: [0, 1], posture: [0.35, 0.6], spine: [1, 2], tail: 0, wings: 0, knee: 'fwd', legLen: [0, 0], hp: 0.9, speed: 0.97 },
    avian: { w: 1.8, legPairs: [1, 1], armPairs: [0, 0], posture: [0.45, 0.65], spine: [2, 3], tail: 0.9, wings: 1, knee: 'back', legLen: [1.9, 2.5], hp: 0.92, speed: 1.04 },
    blob: { w: 1.2, legPairs: [0, 0], armPairs: [0, 2], posture: [0.5, 0.5], spine: [1, 1], tail: 0.2, wings: 0, knee: 'fwd', legLen: [0, 0], hp: 1.12, speed: 0.92 },
  };
  const ARCHETYPE_NAMES = {
    biped: 'Bípede', quadruped: 'Quadrúpede', hexapod: 'Hexápode', arachnid: 'Aracnídeo',
    serpent: 'Serpentiforme', floater: 'Flutuante', avian: 'Alado', blob: 'Gelatinoso',
  };

  const PERSONALITIES = [
    { id: 'agressivo', name: 'Agressivo', w: 3 },
    { id: 'cauteloso', name: 'Cauteloso', w: 2 },
    { id: 'exibido', name: 'Exibido', w: 2 },
    { id: 'caotico', name: 'Caótico', w: 1.5 },
    { id: 'estrategista', name: 'Estrategista', w: 2 },
  ];

  const TRAITS = {
    planar: { name: 'Planador', desc: 'Plana sobre buracos e esquiva voando.' },
    estavel: { name: 'Estável', desc: 'Muitas patas: sofre 30% menos empurrão.' },
    esguio: { name: 'Esguio', desc: 'Corpo fino: é mais difícil de acertar.' },
    levitante: { name: 'Levitante', desc: 'Flutua sobre degraus e pequenos buracos.' },
    elastico: { name: 'Elástico', desc: 'Corpo de gel: sofre 20% menos empurrão e metade do dano de queda.' },
    destro: { name: 'Destro', desc: 'Mãos hábeis: ataque básico 20% mais rápido.' },
    corredor: { name: 'Corredor', desc: 'Pernas fortes: 8% mais rápido.' },
  };

  const BASICS = {
    garra: { name: 'Garra', kind: 'melee', damage: 5, cooldown: 0.55, range: 2.1, arc: 1.9 },
    mordida: { name: 'Mordida', kind: 'melee', damage: 7, cooldown: 0.7, range: 1.9, arc: 1.3 },
    cauda: { name: 'Chicote de cauda', kind: 'spin', damage: 6, cooldown: 0.8, range: 2.6, arc: 6.3 },
    cuspe: { name: 'Cuspe', kind: 'spit', damage: 4, cooldown: 0.6, range: 9, speed: 15 },
  };
  const DODGES = {
    rolamento: { name: 'Rolamento', dist: 5, time: 0.28 },
    voo: { name: 'Bater de asas', dist: 5.6, time: 0.34 },
    fase: { name: 'Salto de fase', dist: 4.8, time: 0.2 },
  };

  // ------------------------------------------------------------ naming
  const SYLL = {
    hard: { c: ['k', 'z', 'x', 'tch', 'q', 'tr', 'kr', 'zz', 'ck', 'sk'], v: ['i', 'e', 'a', 'y', 'ii'], end: ['ix', 'ek', 'izz', 'ak', "'t", 'rix'] },
    soft: { c: ['l', 'm', 'n', 's', 'sh', 'v', 'y', 'th', 'f'], v: ['o', 'u', 'a', 'ae', 'ii', 'ei', 'ou'], end: ['ae', 'une', 'ol', 'iel', 'oa', 'is'] },
    mid: { c: ['b', 'd', 'g', 'r', 'th', 'v', 'm', 'n', 'gr', 'dr', 'br'], v: ['o', 'a', 'u', 'e', 'au'], end: ['or', 'ath', 'um', 'ok', 'ar', 'ul'] },
    bird: { c: ['p', 't', 'k', 'r', 'w', 'ch', 'tw', 'pr'], v: ['ee', 'i', 'a', 'oo', 'e'], end: ['ee', 'it', 'ik', 'aw', 'ip'] },
    goo: { c: ['bl', 'gl', 'p', 'm', 'b', 'pl', 'sl'], v: ['oo', 'u', 'o', 'ub'], end: ['oop', 'ub', 'um', 'orp', 'ish'] },
  };
  const STYLE = { hexapod: 'hard', arachnid: 'hard', floater: 'soft', serpent: 'soft', biped: 'mid', quadruped: 'mid', avian: 'bird', blob: 'goo' };
  function speciesName(rng, style) {
    const s = SYLL[style];
    const n = rng.int(2, 3);
    let name = '';
    for (let i = 0; i < n; i++) name += rng.pick(s.c) + rng.pick(s.v);
    if (rng.chance(0.55)) name += rng.pick(s.end);
    name = name.replace(/(.)\1\1+/g, '$1$1');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  function worldName(rng) {
    const base = speciesName(rng, rng.pick(['mid', 'soft', 'hard']));
    const greek = ['Α', 'Δ', 'Σ', 'Ω', 'Φ', 'Ψ'];
    return rng.pick([
      () => `${base}-${rng.int(2, 99)}`,
      () => `${base} Prime`,
      () => `Lua de ${base}`,
      () => `Anel de ${base}`,
      () => `Cinturão ${base}`,
      () => `${base} ${rng.pick(['II', 'III', 'IV', 'VII', 'IX'])}`,
      () => `Kepler-${rng.pick(greek)}${rng.int(1, 9)}`,
      () => `Nebulosa ${base}`,
    ])();
  }
  const EPITHETS = [
    'que Ri do Vácuo', 'de Seis Sóis', 'Sem-Medo', 'Come-Estrelas', 'que Nunca Pisca', 'do Último Cometa',
    'Quebra-Luas', 'Guarda-Tudo', 'Sonha-Alto', 'de Casca Dupla', 'Pé-de-Plasma', 'que Veio a Pé',
    'Mil-Vezes-Campeão (segundo si)', 'de Poucas Palavras', 'Ex-Contador', 'do Sorriso Torto', 'Filhote de Supernova',
  ];
  const FEATURE_EPITHETS = { eyes: 'de Olhos Mil', wings: 'Corta-Ventos', big: 'Tamanho-Família', small: 'Bolso-de-Bolso', tail: 'Cauda-Chicote' };
  const HABITATS = [
    'planeta oceânico de gás rosa', 'cinturão de asteroides gelados', 'lua vulcânica sem nome', 'floresta de cristal cantante',
    'deserto de vidro líquido', 'nebulosa com cheiro de canela', 'anel de lixo orbital', 'pântano de neon',
    'cidade-colmeia subterrânea', 'cometa errante', 'estação abandonada de um império esquecido', 'oceano de mercúrio morno',
  ];
  const LIKES = [
    'poesia ácida', 'colecionar meteoritos', 'cochilos de 300 anos', 'jazz de baleias espaciais', 'chá de plasma morno',
    'dançar em gravidade zero', 'contar estrelas (já vai em 12)', 'trocadilhos ruins', 'castelos de poeira cósmica',
    'mapas de lugares que não existem', 'o som de voxels quebrando', 'novelas transmitidas há mil anos',
  ];
  const HATES = [
    'buracos negros barulhentos', 'segundas-feiras galácticas', 'formulários do Curador', 'luz ultravioleta', 'silêncio',
    'meias molhadas', 'spoilers do fim do universo', 'escadas (todas elas)', 'quem não devolve ferramentas', 'gravidade alta',
  ];
  const MOTIVES = [
    'reacender seu sol', 'provar que o topo existe', 'recuperar seu chapéu favorito', 'vingar um primo distante',
    'pagar uma dívida de jogo', 'conhecer o Curador pessoalmente', 'escrever um livro de autoajuda', 'fugir do tédio eterno',
    'encontrar o Tear e pedir um poder melhor', 'ver a vista lá de cima', 'ganhar uma aposta com a própria mãe',
  ];

  // ------------------------------------------------------------ genome
  function generate(seed, opts = {}) {
    const rng = new XS.RNG(XS.hash(seed, 'being'));
    const archetype = opts.archetype || rng.weighted(Object.keys(ARCHETYPES).map((k) => ({ k, w: ARCHETYPES[k].w }))).k;
    const A = ARCHETYPES[archetype];
    const size = (opts.size || 1) * rng.range(0.88, 1.22);

    // Spine (index 0 = chest / front).
    const n = rng.int(A.spine[0], A.spine[1]);
    const segLen = archetype === 'serpent' ? rng.range(0.75, 0.95) * size : rng.range(0.75, 1.1) * size;
    const baseR = (archetype === 'serpent' ? rng.range(0.55, 0.75) : archetype === 'blob' ? rng.range(1.35, 1.7) : archetype === 'floater' ? rng.range(1.05, 1.4) : rng.range(0.75, 1.15)) * size;
    const hump = rng.range(-0.25, 0.35), bulge = rng.range(0, 1);
    const radii = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      let r = baseR * (1 + hump * Math.sin(Math.PI * Math.min(1, t * 1.2)) - (archetype === 'serpent' ? t * 0.45 : 0));
      if (archetype !== 'serpent' && i === n - 1 && n > 2) r *= 0.8 + bulge * 0.5; // abdomen
      radii.push(Math.max(0.35, r));
    }
    const posture = rng.range(A.posture[0], A.posture[1]);

    // Head.
    const head = {
      r: archetype === 'blob' ? 0 : rng.range(0.5, 0.9) * size,
      neck: archetype === 'serpent' ? rng.range(0.8, 1.2) : rng.range(0.15, 0.8),
      eyes: rng.weighted([{ n: 1, w: 1 }, { n: 2, w: 5 }, { n: 3, w: 1.2 }, { n: 4, w: 1 }, { n: 6, w: 0.5 }]).n,
      eyeSize: rng.range(0.2, 0.38),
      eyeStyle: rng.pick(['round', 'round', 'slit', 'compound', 'glow']),
      eyeSpread: rng.range(0.35, 0.75),
      mouth: rng.pick(['beak', 'mandibles', 'smile', 'trunk', 'fangs', 'none']),
      crown: rng.pick(['none', 'none', 'horns', 'antennae', 'crest', 'unicorn', 'frills']),
      crownLen: rng.range(0.5, 1.2) * size,
    };
    if (archetype === 'blob') head.eyes = rng.int(1, 3);

    // Limbs.
    const legPairs = rng.int(A.legPairs[0], A.legPairs[1]);
    let legLen = legPairs ? rng.range(A.legLen[0], A.legLen[1]) * size : 0;
    if (legPairs >= 3) legLen = Math.max(legLen, Math.max(...radii) * 2.3); // insect legs must clear the body
    const legs = {
      pairs: legPairs, len: legLen, thick: rng.range(0.18, 0.32) * size * (archetype === 'arachnid' ? 0.7 : 1),
      foot: rng.pick(['claw', 'pad', 'hoof', 'point']), knee: A.knee,
    };
    let armPairs = rng.int(A.armPairs[0], A.armPairs[1]);
    if (A.centaur && rng.chance(A.centaur)) armPairs = 1;
    const arms = {
      pairs: armPairs, len: rng.range(1.2, 2.0) * size, thick: rng.range(0.16, 0.28) * size,
      hand: rng.pick(['claw', 'three', 'tentacle', 'blade', 'mitt']),
    };
    const tail = rng.chance(A.tail) ? {
      segs: rng.int(3, 6), r: Math.max(0.25, radii[n - 1] * rng.range(0.35, 0.6)), segLen: rng.range(0.45, 0.7) * size,
      curl: rng.range(-0.2, 0.8), tip: rng.pick(['none', 'club', 'spike', 'fan', 'stinger', 'flame']),
    } : null;
    const wings = rng.chance(A.wings) ? { type: rng.pick(archetype === 'hexapod' ? ['insect', 'insect', 'energy'] : ['bat', 'feather', 'insect', 'energy']), span: rng.range(1.9, 3.0) * size } : null;
    const tentacles = archetype === 'floater' ? { count: rng.int(3, 6), len: rng.range(1.6, 2.6) * size, r: rng.range(0.16, 0.26) * size } : null;

    const palette = XS.color.creaturePalette(rng);
    const pattern = rng.pick(['none', 'stripes', 'spots', 'plates', 'glowspots', 'none']);
    const personality = rng.weighted(PERSONALITIES);

    // ---- derived gameplay stats ----
    let volume = head.r ** 3;
    for (const r of radii) volume += r ** 3;
    const volNorm = XS.clamp((volume - 0.9) / 7.5, 0, 1);
    let trait;
    if (wings) trait = 'planar';
    else if (archetype === 'floater') trait = 'levitante';
    else if (archetype === 'blob') trait = 'elastico';
    else if (archetype === 'serpent') trait = 'esguio';
    else if (legPairs >= 3) trait = 'estavel';
    else if (archetype === 'quadruped') trait = 'corredor';
    else trait = 'destro';

    let basic;
    if (armPairs && ['claw', 'blade', 'three'].includes(arms.hand)) basic = 'garra';
    else if (tail && ['club', 'spike', 'stinger'].includes(tail.tip)) basic = 'cauda';
    else if (['fangs', 'mandibles', 'beak'].includes(head.mouth) && archetype !== 'floater') basic = 'mordida';
    else basic = 'cuspe';
    const dodge = wings ? 'voo' : (archetype === 'floater' || archetype === 'blob') ? 'fase' : 'rolamento';

    const maxR = Math.max(...radii);
    const bodyHeight = archetype === 'floater' ? 1.6 + maxR * 2 : archetype === 'serpent' ? maxR * 2 + 1.2 : archetype === 'blob' ? maxR * 1.7 : legLen * 0.8 + maxR * 2 + (posture > 0.5 ? (n - 1) * segLen * Math.sin(posture * 1.3) : 0) + head.r;
    const stats = {
      maxHp: Math.round(HP_BASE * XS.lerp(0.85, 1.22, volNorm) * A.hp),
      speed: SPEED_BASE * XS.lerp(1.1, 0.9, volNorm) * A.speed * (trait === 'corredor' ? 1.08 : 1),
      mass: XS.lerp(0.78, 1.35, volNorm),
      radius: XS.clamp(maxR * (trait === 'esguio' ? 0.95 : 1.15), 0.7, 1.7),
      height: XS.clamp(bodyHeight, 2, 7),
      knockTaken: trait === 'estavel' ? 0.7 : trait === 'elastico' ? 0.8 : 1,
      basicRate: trait === 'destro' ? 0.8 : 1,
    };

    // ---- identity ----
    const style = STYLE[archetype];
    const name = speciesName(rng, style);
    let epithet = rng.pick(EPITHETS);
    if (head.eyes >= 4 && rng.chance(0.6)) epithet = FEATURE_EPITHETS.eyes;
    else if (wings && rng.chance(0.4)) epithet = FEATURE_EPITHETS.wings;
    else if (size > 1.15 && rng.chance(0.4)) epithet = FEATURE_EPITHETS.big;
    else if (size < 0.92 && rng.chance(0.4)) epithet = FEATURE_EPITHETS.small;
    else if (tail && tail.segs >= 5 && rng.chance(0.3)) epithet = FEATURE_EPITHETS.tail;
    const bio = {
      world: worldName(rng),
      habitat: rng.pick(HABITATS),
      likes: rng.pick(LIKES),
      hates: rng.pick(HATES),
      motive: rng.pick(MOTIVES),
    };
    const voice = { pitch: XS.clamp(1.25 - (size - 0.88) * 1.3 + rng.range(-0.15, 0.15), 0.5, 1.6), wave: rng.pick(['sine', 'triangle', 'square', 'sawtooth']), wobble: rng.range(2, 9) };

    return {
      seed: seed >>> 0, archetype, size, posture,
      spine: { n, segLen, radii }, head, legs, arms, tail, wings, tentacles,
      palette, pattern, personality: personality.id,
      stats, trait, basic, dodge,
      name, epithet, bio, voice,
    };
  }

  function describe(g) {
    return {
      archetype: ARCHETYPE_NAMES[g.archetype],
      personality: PERSONALITIES.find((p) => p.id === g.personality).name,
      trait: TRAITS[g.trait],
      basic: BASICS[g.basic],
      dodge: DODGES[g.dodge],
    };
  }

  XS.Creature = { generate, describe, ARCHETYPES, ARCHETYPE_NAMES, PERSONALITIES, TRAITS, BASICS, DODGES, HP_BASE, SPEED_BASE };
})(globalThis.XS = globalThis.XS || {});
