// The Loom: procedural powers. A power is FORM x ELEMENT(s) x MODIFIERS x TIER.
// Structure (form, elements, modifiers, name) depends only on the seed and
// tier; numbers are then scaled so every power's expected value matches the
// budget of the floor it was woven on. Re-weaving the same seed on a higher
// floor ("Reforçar") keeps its identity and raises its numbers.
(function (XS) {
  'use strict';

  const BUDGET_BASE = 2.8;          // expected damage per second at floor 1, tier Comum
  const FLOOR_GROWTH = 0.07;         // +7% budget per floor
  const TIER_MULT = [1, 1.12, 1.25, 1.42];
  const TIER_MODS = [1, 2, 3, 3];

  const ELEMENTS = {
    plasma: { name: 'Plasma', noun: 'plasma', adj: [['Plasmático', 'Plasmática'], ['Ígneo', 'Ígnea']], ramp: ['#5a1020', '#c2401f', '#ff8a2a', '#ffe08a'], status: 'burn', terrain: 1.3, utility: 0.22, poetic: ['de Mil Sóis', 'da Estrela Furiosa', 'do Núcleo Derretido'], sfx: { wave: 'sawtooth', noise: 0.55, f0: 260, f1: 70, cutoff: 1600 } },
    cryo: { name: 'Crio', noun: 'gelo', adj: [['Criogênico', 'Criogênica'], ['Glacial', 'Glacial']], ramp: ['#1a2f6b', '#3f7fd8', '#8fd8ff', '#effcff'], status: 'chill', terrain: 0.9, utility: 0.32, poetic: ['do Zero Absoluto', 'do Inverno Eterno', 'de Plutão'], sfx: { wave: 'triangle', noise: 0.2, f0: 1400, f1: 900, cutoff: 5000 } },
    gravity: { name: 'Gravidade', noun: 'gravidade', adj: [['Gravitacional', 'Gravitacional'], ['Pesado', 'Pesada']], ramp: ['#1c0f3a', '#4b2a8f', '#8f6cf0', '#d9c8ff'], status: 'pull', terrain: 1.1, utility: 0.3, poetic: ['do Horizonte de Eventos', 'da Massa Infinita', 'de Netuno'], sfx: { wave: 'sine', noise: 0.1, f0: 90, f1: 40, cutoff: 900 } },
    void: { name: 'Vazio', noun: 'vazio', adj: [['do Vazio', 'do Vazio'], ['Abissal', 'Abissal']], ramp: ['#07040f', '#2a0f3d', '#7a2fa0', '#e070ff'], status: 'drain', terrain: 1.0, utility: 0.28, poetic: ['do Nada Faminto', 'do Silêncio Total', 'de Antes do Big Bang'], sfx: { wave: 'sine', noise: 0.3, f0: 200, f1: 600, cutoff: 1200 } },
    bio: { name: 'Bio', noun: 'ácido', adj: [['Tóxico', 'Tóxica'], ['Ácido', 'Ácida']], ramp: ['#10331a', '#2f8a2f', '#8be04a', '#e8ff9a'], status: 'poison', terrain: 1.25, utility: 0.25, poetic: ['do Pântano Primordial', 'da Fome Verde', 'dos Mil Esporos'], sfx: { wave: 'square', noise: 0.45, f0: 320, f1: 160, cutoff: 1400 } },
    arc: { name: 'Arco', noun: 'eletricidade', adj: [['Elétrico', 'Elétrica'], ['Voltaico', 'Voltaica']], ramp: ['#2a2408', '#c99a10', '#ffe03a', '#fffbd0'], status: 'shock', terrain: 0.9, utility: 0.3, poetic: ['da Tempestade Solar', 'do Relâmpago Gago', 'de Júpiter'], sfx: { wave: 'square', noise: 0.6, f0: 900, f1: 1800, cutoff: 6000 } },
    crystal: { name: 'Cristal', noun: 'cristal', adj: [['Cristalino', 'Cristalina'], ['Prismático', 'Prismática']], ramp: ['#20304a', '#3fa0a0', '#8ff0d8', '#f0fff8'], status: 'shard', terrain: 1.0, utility: 0.28, poetic: ['da Geometria Sagrada', 'do Diamante Cantor', 'das Mil Facetas'], sfx: { wave: 'triangle', noise: 0.1, f0: 1800, f1: 2400, cutoff: 7000 } },
    sonic: { name: 'Sônico', noun: 'som', adj: [['Sônico', 'Sônica'], ['Ressonante', 'Ressonante']], ramp: ['#3a2410', '#a06a2a', '#e8b860', '#fff0c8'], status: 'stagger', terrain: 2.0, utility: 0.25, poetic: ['do Primeiro Grito', 'da Nota Proibida', 'do Trovão Distante'], sfx: { wave: 'sawtooth', noise: 0.35, f0: 140, f1: 60, cutoff: 2200 } },
    chrono: { name: 'Cronos', noun: 'tempo', adj: [['Temporal', 'Temporal'], ['Relativístico', 'Relativística']], ramp: ['#2b2d3a', '#6d7390', '#b8c0e0', '#ffffff'], status: 'timeslow', terrain: 0.8, utility: 0.35, poetic: ['do Último Segundo', 'da Ampulheta Rachada', 'de Ontem'], sfx: { wave: 'sine', noise: 0.05, f0: 600, f1: 300, cutoff: 3000 } },
    psi: { name: 'Psi', noun: 'energia psíquica', adj: [['Psíquico', 'Psíquica'], ['Mental', 'Mental']], ramp: ['#3a0a2a', '#c02a7a', '#ff6ac0', '#ffd0ec'], status: 'mark', terrain: 0.7, utility: 0.32, poetic: ['da Mente Coletiva', 'do Sonho Alheio', 'do Terceiro Olho'], sfx: { wave: 'triangle', noise: 0.15, f0: 500, f1: 1000, cutoff: 2500 } },
  };

  const STATUS_TEXT = {
    burn: 'Queimadura: dano extra ao longo de 3 s.',
    chill: 'Gelo: deixa lento e, acumulando, congela.',
    pull: 'Atração: puxa os alvos para o impacto.',
    drain: 'Dreno: você cura 35% do dano causado.',
    poison: 'Veneno: dano extra ao longo de 4 s.',
    shock: 'Choque: atordoa por um instante.',
    shard: 'Estilhaço: acertar gera escudo para você.',
    stagger: 'Impacto: empurrão muito mais forte.',
    timeslow: 'Atraso temporal: o alvo fica 35% mais lento.',
    mark: 'Marca: o alvo sofre +25% de dano por 4 s.',
  };

  // hit: expected fraction of the nominal damage that lands (aiming, dodges).
  // kb: knockback impulse. terrain: voxel damage power at impact.
  const FORMS = {
    bolt: { nouns: [['Projétil', 'm'], ['Dardo', 'm'], ['Disparo', 'm'], ['Bólide', 'm']], plural: 'projéteis', target: 'dir', ai: 'ranged', cd: [1.6, 3], range: [9, 13], speed: [13, 18], radius: 0.45, hit: 0.55, kb: 3, terrain: 1.4 },
    beam: { nouns: [['Lança', 'f'], ['Raio', 'm'], ['Feixe', 'm']], plural: 'feixes', target: 'dir', ai: 'ranged', cd: [3, 5], range: [10, 14], radius: 0.55, ticks: 3, hit: 0.6, kb: 1.5, terrain: 1.3 },
    nova: { nouns: [['Nova', 'f'], ['Explosão', 'f'], ['Pulso', 'm']], target: 'self', ai: 'close', cd: [4, 7], range: [0, 0], radius: [3, 4], hit: 0.5, kb: 8, terrain: 2.4 },
    cone: { nouns: [['Sopro', 'm'], ['Jorro', 'm'], ['Bafo', 'm']], target: 'dir', ai: 'close', cd: [3.5, 6], range: [4.5, 6], ticks: 4, duration: 0.6, angle: 0.9, hit: 0.55, kb: 2, terrain: 1 },
    field: { nouns: [['Campo', 'm'], ['Poça', 'f'], ['Domínio', 'm']], target: 'point', ai: 'zone', cd: [6, 9], range: [8, 11], radius: [2.4, 3.2], duration: [3, 4.5], tick: 0.5, hit: 0.3, kb: 0, terrain: 0.5 },
    rain: { nouns: [['Chuva', 'f'], ['Tempestade', 'f'], ['Granizo', 'm']], plural: 'impactos', target: 'point', ai: 'zone', cd: [5, 8], range: [9, 12], count: 5, radius: 1.4, spread: 2.6, hit: 0.28, kb: 4, terrain: 2.2 },
    dash: { nouns: [['Investida', 'f'], ['Arremetida', 'f'], ['Ímpeto', 'm']], target: 'dir', ai: 'close', mobility: true, cd: [3.5, 6], range: [6, 8], radius: 1.3, hit: 0.5, kb: 7, terrain: 1.6 },
    orbit: { nouns: [['Anel', 'm'], ['Órbita', 'f'], ['Halo', 'm']], plural: 'orbes', target: 'self', ai: 'close', cd: [7, 10], duration: [5, 7], count: 3, radius: 0.55, orbit: 2.3, tick: 0.6, hit: 0.22, kb: 2, terrain: 0.6 },
    summon: { nouns: [['Sentinela', 'f'], ['Totem', 'm'], ['Familiar', 'm']], plural: 'sentinelas', target: 'point', ai: 'zone', cd: [9, 13], range: [5, 7], duration: [7, 9], count: 1, tick: 1.1, hit: 0.45, kb: 1.5, terrain: 0.6 },
    mine: { nouns: [['Mina', 'f'], ['Armadilha', 'f'], ['Semente', 'f']], plural: 'minas', target: 'point', ai: 'zone', cd: [5, 8], range: [7, 9], count: 3, radius: 2, hit: 0.3, kb: 7, terrain: 2.2 },
    wall: { nouns: [['Muralha', 'f'], ['Barreira', 'f'], ['Bastião', 'm']], target: 'point', ai: 'defense', cd: [7, 10], range: [5, 7], duration: [5, 7], length: 5, height: 3, radius: 1.5, hit: 0.35, kb: 6, terrain: 0 },
    boomerang: { nouns: [['Bumerangue', 'm'], ['Disco', 'm'], ['Chakram', 'm']], plural: 'discos', target: 'dir', ai: 'ranged', cd: [2.5, 4], range: [8, 11], speed: [14, 17], radius: 0.6, hit: 0.7, kb: 3, terrain: 1 },
    hook: { nouns: [['Gancho', 'm'], ['Arpão', 'm'], ['Laço', 'm']], plural: 'ganchos', target: 'dir', ai: 'ranged', mobility: true, cd: [5, 8], range: [8, 11], speed: [22, 26], radius: 0.5, hit: 0.5, kb: 0, terrain: 0.8 },
    blink: { nouns: [['Salto', 'm'], ['Passo', 'm'], ['Translação', 'f']], target: 'point', ai: 'mobility', mobility: true, cd: [5, 8], range: [6, 9], radius: [2, 2.6], hit: 0.45, kb: 7, terrain: 1.6 },
    aura: { nouns: [['Aura', 'f'], ['Manto', 'm'], ['Couraça', 'f']], target: 'self', ai: 'defense', cd: [10, 14], duration: [4, 6], radius: 2.6, tick: 0.8, hit: 0.5, kb: 2.5, terrain: 0.4 },
  };
  const FORM_WEIGHTS = { bolt: 3, beam: 1.6, nova: 1.4, cone: 1.3, field: 1.3, rain: 1.3, dash: 1.3, orbit: 1.1, summon: 1, mine: 1.1, wall: 0.8, boomerang: 1.3, hook: 1, blink: 1.1, aura: 1 };

  const DAMAGING = Object.keys(FORMS);
  const PROJECTILES = ['bolt', 'boomerang', 'hook'];
  // hit: multiplier on expected hits; util: added utility; dmg: extra
  // instances of damage (echo, mirrored); cd/size/speed: stat multipliers.
  const MODS = {
    split: { adj: [['Tríplice', 'Tríplice'], ['Fragmentado', 'Fragmentada']], forms: ['bolt', 'beam', 'boomerang', 'hook', 'mine', 'rain', 'orbit', 'summon'], hit: 1, util: 0.05 },
    homing: { adj: [['Teleguiado', 'Teleguiada'], ['Faminto', 'Faminta']], forms: ['bolt', 'boomerang'], hit: 1.35, util: 0 },
    ricochet: { adj: [['Ricocheteante', 'Ricocheteante'], ['Saltitante', 'Saltitante']], forms: ['bolt', 'boomerang'], hit: 1.15, util: 0.05 },
    pierce: { adj: [['Perfurante', 'Perfurante']], forms: ['bolt', 'beam', 'dash', 'boomerang'], hit: 1.15, util: 0.05 },
    explosive: { adj: [['Explosivo', 'Explosiva']], forms: ['bolt', 'boomerang', 'hook', 'mine', 'rain', 'dash', 'blink', 'beam'], hit: 1.25, util: 0.05, terrain: 1.6 },
    echo: { adj: [['Ecoante', 'Ecoante']], forms: ['bolt', 'beam', 'nova', 'cone', 'rain', 'dash', 'boomerang', 'mine', 'blink', 'hook'], dmg: 2, util: 0 },
    trail: { adj: [['Persistente', 'Persistente'], ['Rastejante', 'Rastejante']], forms: ['bolt', 'dash', 'boomerang', 'orbit'], hit: 1, util: 0.22 },
    vampiric: { adj: [['Vampírico', 'Vampírica']], forms: DAMAGING.filter((f) => f !== 'wall'), hit: 1, util: 0.28 },
    colossal: { adj: [['Colossal', 'Colossal']], forms: ['bolt', 'nova', 'field', 'rain', 'orbit', 'summon', 'wall', 'mine', 'boomerang', 'beam'], hit: 1.2, util: 0, cd: 1.25, size: 1.7, speed: 0.65, kb: 1.4, excludes: ['swift'] },
    swift: { adj: [['Veloz', 'Veloz']], forms: ['bolt', 'boomerang', 'dash', 'hook', 'beam', 'blink'], hit: 1.1, util: 0, cd: 0.75, size: 0.75, speed: 1.6, excludes: ['colossal'] },
    excavator: { adj: [['Escavador', 'Escavadora'], ['Demolidor', 'Demolidora']], forms: DAMAGING.filter((f) => f !== 'wall'), hit: 1, util: 0.08, terrain: 3 },
    crystallize: { adj: [['Cristalizante', 'Cristalizante']], forms: ['bolt', 'rain', 'nova', 'mine', 'blink', 'beam', 'dash'], hit: 1, util: 0.15 },
    spiral: { adj: [['Espiralado', 'Espiralada']], forms: ['bolt'], hit: 1.05, util: 0 },
    chain: { adj: [['Encadeado', 'Encadeada']], forms: ['bolt', 'beam', 'hook'], hit: 1.4, util: 0 },
    magnetic: { adj: [['Magnético', 'Magnética']], forms: ['bolt', 'rain', 'mine', 'field', 'nova', 'blink'], hit: 1, util: 0.2 },
    returning: { adj: [['Retornável', 'Retornável'], ['Fiel', 'Fiel']], forms: ['bolt'], hit: 1.3, util: 0 },
    fractal: { adj: [['Fractal', 'Fractal']], forms: ['bolt', 'rain', 'mine', 'boomerang'], anomalous: true, hit: 1.6, util: 0.05 },
    mirrored: { adj: [['Espelhado', 'Espelhada']], forms: ['bolt', 'beam', 'cone', 'boomerang', 'hook'], anomalous: true, dmg: 1.6, util: 0 },
  };
  const MOD_TEXT = {
    homing: () => 'Persegue o inimigo mais próximo.',
    ricochet: () => 'Ricocheteia nas paredes até 3 vezes.',
    pierce: (d) => (d.form === 'beam' ? 'Atravessa paredes.' : 'Atravessa inimigos.'),
    explosive: (d) => `Explode no impacto (raio ${XS.fmt1(d.blast)}).`,
    echo: () => 'Repete-se sozinho 0,6 s depois.',
    trail: () => 'Deixa um rastro nocivo pelo caminho.',
    vampiric: () => 'Cura você em 30% do dano causado.',
    colossal: () => 'Enorme, lento e pesado.',
    swift: () => 'Rápido e leve.',
    excavator: () => 'Triplica a destruição do cenário.',
    crystallize: () => 'Faz brotar cristais onde acerta.',
    spiral: () => 'Avança em espiral.',
    chain: () => 'Salta para mais 2 inimigos próximos.',
    magnetic: () => 'Puxa inimigos para o ponto de impacto.',
    returning: () => 'Volta para você depois do alcance máximo.',
    fractal: () => 'Ao impactar, gera 3 cópias menores de si.',
    mirrored: () => 'Também é conjurado na direção oposta.',
  };

  const POETIC_NOUNS = ['Beijo', 'Sussurro', 'Fúria', 'Canção', 'Dente', 'Abraço', 'Lágrima', 'Promessa', 'Grito', 'Dança', 'Suspiro', 'Mordida', 'Carícia', 'Juramento', 'Eco', 'Rugido', 'Bênção', 'Maldição'];
  const PLACES = ['de Andrômeda', 'de Órion', 'de Vega', 'de Sírius', 'de Cassiopeia', 'do Último Quasar', 'da Nebulosa Caranguejo', 'do Vigésimo Céu', 'de Betelgeuse', 'do Curador', 'da Torre', 'de Aldebarã'];
  const FLAVOR_THINGS = [
    'de uma supernova tímida', 'do bocejo de um quasar', 'de uma estrela que desistiu', 'de um cometa atrasado',
    'do sonho de um buraco negro', 'de luz com 9 bilhões de anos', 'de uma canção de ninar alienígena', 'de saudade cristalizada',
    'da poeira de um império esquecido', 'do primeiro trovão do universo', 'de uma promessa não cumprida', 'do riso de uma lua',
  ];

  function tierFor(seed, floor, maxTier = 3) {
    const rng = new XS.RNG(XS.hash(seed, 'tier', floor));
    const w = [Math.max(14, 62 - floor * 2), 26 + floor * 0.6, 9 + floor * 0.6, 3 + floor * 0.45];
    const items = w.map((v, i) => ({ i, w: i <= maxTier ? v : 0 }));
    return rng.weighted(items).i;
  }

  const budget = (floor, tier) => BUDGET_BASE * (1 + FLOOR_GROWTH * (Math.max(1, floor) - 1)) * TIER_MULT[tier];
  const pickRange = (rng, v) => (Array.isArray(v) ? rng.range(v[0], v[1]) : v);

  // ------------------------------------------------------------- generate
  function generate(seed, floor = 1, opts = {}) {
    seed >>>= 0;
    const tier = opts.tier != null ? opts.tier : tierFor(seed, floor, opts.maxTier);
    const rs = new XS.RNG(XS.hash(seed, 'structure', tier));
    const rn = new XS.RNG(XS.hash(seed, 'numbers'));

    // ---- structure ----
    const formWeights = Object.keys(FORMS).map((k) => ({ k, w: (opts.forms && !opts.forms.includes(k)) ? 0 : FORM_WEIGHTS[k] }));
    const form = rs.weighted(formWeights).k;
    const F = FORMS[form];
    const elementKeys = Object.keys(ELEMENTS);
    const e1 = rs.pick(elementKeys);
    const elements = [e1];
    if (tier === 3) elements.push(rs.pick(elementKeys.filter((e) => e !== e1)));
    const mods = [];
    const pool = Object.keys(MODS).filter((m) => MODS[m].forms.includes(form) && !MODS[m].anomalous);
    rs.shuffle(pool);
    for (const m of pool) {
      if (mods.length >= TIER_MODS[tier]) break;
      if ((MODS[m].excludes || []).some((x) => mods.includes(x))) continue;
      mods.push(m);
    }
    if (tier === 3) {
      const anom = Object.keys(MODS).filter((m) => MODS[m].anomalous && MODS[m].forms.includes(form));
      if (anom.length) mods.push(rs.pick(anom));
    }
    const has = (m) => mods.includes(m);

    // ---- numbers (floor independent) ----
    const size = (has('colossal') ? MODS.colossal.size : 1) * (has('swift') ? MODS.swift.size : 1);
    const spdM = (has('colossal') ? MODS.colossal.speed : 1) * (has('swift') ? MODS.swift.speed : 1);
    const cdM = (has('colossal') ? MODS.colossal.cd : 1) * (has('swift') ? MODS.swift.cd : 1);
    let count = F.count || 1;
    if (has('split')) count = form === 'mine' || form === 'rain' ? count + 3 : form === 'orbit' ? count + 2 : form === 'summon' ? 2 : 3;
    const def = {
      seed, floor, tier, form, elements, mods,
      target: F.target,
      cooldown: Math.round(pickRange(rn, F.cd) * cdM * 10) / 10,
      range: Math.round(pickRange(rn, F.range || 0) * 10) / 10,
      radius: Math.round(pickRange(rn, F.radius || 0.5) * size * 100) / 100,
      speed: Math.round(pickRange(rn, F.speed || 0) * spdM * 10) / 10,
      duration: Math.round(pickRange(rn, F.duration || 0) * 10) / 10,
      count,
      ticks: F.ticks || 1,
      knock: F.kb * (has('colossal') ? MODS.colossal.kb : 1) * (e1 === 'sonic' || elements[1] === 'sonic' ? 1.8 : 1),
      blast: has('explosive') ? Math.round(1.8 * size * 10) / 10 : 0,
      status: elements.map((e) => ELEMENTS[e].status),
      ai: { kind: F.ai, mobility: !!F.mobility },
    };
    if (form === 'wall') def.length = Math.round(F.length * (has('colossal') ? 1.6 : 1));
    if (form === 'orbit') def.orbit = F.orbit * (has('colossal') ? 1.3 : 1);
    if (form === 'rain') def.spread = F.spread * size;
    if (form === 'cone') { def.duration = F.duration; def.angle = F.angle * size; }
    if (form === 'beam' && has('colossal')) def.radius *= 1.2;
    def.ai.range = def.target === 'self' ? (form === 'nova' || form === 'aura' ? def.radius : def.orbit || 2.5) : def.range;

    // ---- balance: solve damage from the budget ----
    let hits = def.count * def.ticks * F.hit;
    if (form === 'field') hits = (def.duration / F.tick) * F.hit;
    if (form === 'orbit') hits = def.count * (def.duration / F.tick) * F.hit;
    if (form === 'summon') hits = def.count * (def.duration / F.tick) * F.hit;
    if (form === 'aura') hits = (def.duration / F.tick) * F.hit;
    if (form === 'cone') hits = def.ticks * F.hit;
    if (form === 'boomerang') hits = def.count * F.hit * 1.4;
    let hitM = 1, util = 0, extra = 1;
    for (const m of mods) {
      const M = MODS[m];
      hitM *= M.hit || 1;
      util += M.util || 0;
      if (M.dmg) extra *= M.dmg;
    }
    for (const e of elements) util += ELEMENTS[e].utility;
    if (F.mobility) util += 0.25;
    if (form === 'wall') util += 0.6;
    if (form === 'aura') util += 0.4;
    util += Math.min(0.3, def.knock * 0.025);
    const b = budget(floor, tier);
    const raw = (b * def.cooldown) / (hits * hitM * extra * (1 + util));
    def.damage = Math.max(1, Math.round(raw));
    def.budget = b;
    def.expected = (def.damage * hits * hitM * extra * (1 + util)) / def.cooldown;
    def.hitsPerCast = hits * hitM * extra;
    const terrainBase = F.terrain * ELEMENTS[e1].terrain * (has('excavator') ? MODS.excavator.terrain : 1) * (has('explosive') ? MODS.explosive.terrain : 1);
    def.terrain = Math.round(terrainBase * (1 + 0.03 * (floor - 1)) * 100) / 100;

    // ---- presentation ----
    def.ramp = ELEMENTS[e1].ramp;
    def.ramp2 = elements[1] ? ELEMENTS[elements[1]].ramp : null;
    Object.assign(def, nameFor(def, rs));
    def.desc = describe(def);
    def.flavor = `${floor > 1 && opts.reinforced ? 'Re-tecido' : 'Tecido'} no andar ${floor} com fios ${rs.pick(FLAVOR_THINGS)}.`;
    const sx = ELEMENTS[e1].sfx;
    def.sfx = {
      wave: sx.wave, noise: sx.noise, cutoff: sx.cutoff * rn.range(0.8, 1.25),
      f0: sx.f0 * rn.range(0.8, 1.25) / Math.sqrt(size), f1: sx.f1 * rn.range(0.8, 1.25) / Math.sqrt(size),
      dur: { bolt: 0.16, beam: 0.42, nova: 0.5, cone: 0.6, field: 0.35, rain: 0.3, dash: 0.25, orbit: 0.3, summon: 0.4, mine: 0.2, wall: 0.45, boomerang: 0.22, hook: 0.2, blink: 0.28, aura: 0.6 }[form] * (has('colossal') ? 1.4 : 1),
      vib: rn.range(0, 12),
    };
    return def;
  }

  function nameFor(def, rng) {
    const F = FORMS[def.form];
    const [noun, gender] = rng.pick(F.nouns);
    const gi = gender === 'f' ? 1 : 0;
    const [e1, e2] = def.elements;
    let elem;
    if (e2) {
      const a1 = ELEMENTS[e1].adj.find((a) => !a[0].startsWith('do '))[0];
      const a2 = ELEMENTS[e2].adj.find((a) => !a[0].startsWith('do '))[gi];
      elem = `${a1}-${a2.charAt(0).toLowerCase()}${a2.slice(1)}`;
    } else elem = rng.pick(ELEMENTS[e1].adj)[gi];
    const visibleMods = def.mods.filter((m) => !['split'].includes(m) || def.mods.length === 1);
    const modAdj = visibleMods.length ? rng.pick(MODS[visibleMods[0]].adj)[gi] : '';
    const prepositional = elem.startsWith('do ');
    let technical = prepositional ? `${noun}${modAdj ? ' ' + modAdj : ''} ${elem}` : `${noun} ${elem}${modAdj ? ' ' + modAdj : ''}`;
    if (def.tier >= 1 && !prepositional && rng.chance(0.4)) technical += ' ' + rng.pick(PLACES);
    if (def.tier === 3) technical += ` Nº ${rng.int(100, 9999)}`;
    if (rng.chance(0.3)) return { name: `${rng.pick(POETIC_NOUNS)} ${rng.pick(ELEMENTS[e1].poetic)}`, sub: technical };
    return { name: technical, sub: null };
  }

  function describe(d) {
    const F = FORMS[d.form];
    const dmg = d.damage, n = d.count, el = ELEMENTS[d.elements[0]].noun;
    const r = XS.fmt1(d.radius), dur = XS.fmt1(d.duration);
    const lines = [];
    switch (d.form) {
      case 'bolt': lines.push(n > 1 ? `Dispara ${n} ${F.plural} de ${el} que causam ${dmg} de dano cada.` : `Dispara um projétil de ${el} que causa ${dmg} de dano.`); break;
      case 'beam': lines.push(`${n > 1 ? `Dispara ${n} feixes` : 'Dispara um feixe'} de ${el} que causa ${dmg} de dano por pulso (3 pulsos).`); break;
      case 'nova': lines.push(`Após um breve acúmulo, explode ao seu redor (raio ${r}) causando ${dmg} de dano.`); break;
      case 'cone': lines.push(`Sopra ${el} à frente por ${XS.fmt1(d.duration)} s: ${dmg} de dano por pulso.`); break;
      case 'field': lines.push(`Cria uma zona de ${el} (raio ${r}) por ${dur} s que causa ${dmg} de dano a cada 0,5 s.`); break;
      case 'rain': lines.push(`Faz cair ${n} impactos de ${el} na área: ${dmg} de dano cada.`); break;
      case 'dash': lines.push(`Avança ${XS.fmt1(d.range)} voxels causando ${dmg} de dano a quem atravessar.`); break;
      case 'orbit': lines.push(`${n} orbes de ${el} giram ao seu redor por ${dur} s: ${dmg} de dano por toque.`); break;
      case 'summon': lines.push(`${n > 1 ? `Invoca ${n} sentinelas` : 'Invoca uma sentinela'} que atira por ${dur} s: ${dmg} de dano por tiro.`); break;
      case 'mine': lines.push(`Planta ${n} minas que explodem ao contato: ${dmg} de dano.`); break;
      case 'wall': lines.push(`Ergue uma muralha de ${d.length} voxels por ${dur} s. Quem estiver no caminho sofre ${dmg} de dano.`); break;
      case 'boomerang': lines.push(`${n > 1 ? `Lança ${n} discos` : 'Lança um disco'} que vai e volta: ${dmg} de dano por passagem.`); break;
      case 'hook': lines.push(`${n > 1 ? `Lança ${n} ganchos que puxam` : 'Lança um gancho que puxa'} o inimigo (${dmg} de dano). Em paredes, puxa você.`); break;
      case 'blink': lines.push(`Teleporta você até ${XS.fmt1(d.range)} voxels e explode na chegada (${dmg} de dano).`); break;
      case 'aura': lines.push(`Por ${dur} s: ${AURA_TEXT[d.elements[0]]}. Pulsos causam ${dmg} de dano ao redor.`); break;
    }
    for (const s of d.status) lines.push(STATUS_TEXT[s]);
    for (const m of d.mods) if (m !== 'split') lines.push(MOD_TEXT[m](d)); // split shows up as the count
    return lines;
  }
  const AURA_TEXT = {
    plasma: 'você incendeia quem chegar perto', cryo: 'você sofre 30% menos dano', gravity: 'você atrai inimigos próximos',
    void: 'você cura 30% do dano que causa', bio: 'você regenera vida', arc: 'você solta choques em volta',
    crystal: 'você ganha um escudo de cristal', sonic: 'você repele quem chegar perto', chrono: 'você fica 30% mais rápido',
    psi: 'você marca inimigos próximos',
  };

  // How an AI personality values a power when drafting.
  function draftScore(def, personality, current = []) {
    const k = def.ai.kind;
    const pref = {
      agressivo: { ranged: 1, close: 1.35, zone: 0.85, mobility: 1.1, defense: 0.6 },
      cauteloso: { ranged: 1.25, close: 0.7, zone: 1.15, mobility: 1.05, defense: 1.3 },
      exibido: { ranged: 1.05, close: 1.1, zone: 1.05, mobility: 1.2, defense: 0.8 },
      caotico: { ranged: 1, close: 1, zone: 1, mobility: 1, defense: 1 },
      estrategista: { ranged: 1.1, close: 0.95, zone: 1.25, mobility: 1, defense: 1.1 },
    }[personality] || {};
    let s = (def.expected / def.budget) * (1 + def.tier * 0.18) * (pref[k] || 1);
    if (personality === 'exibido') s *= 1 + def.mods.length * 0.08;
    // Variety: prefer kinds the kit doesn't have yet.
    if (current.some((c) => c.ai.kind === k)) s *= 0.82;
    return s;
  }

  XS.Power = { generate, tierFor, budget, draftScore, ELEMENTS, FORMS, MODS, STATUS_TEXT, BUDGET_BASE, TIER_MULT };
})(globalThis.XS = globalThis.XS || {});
