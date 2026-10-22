// The Loom: procedural powers. A power is FORM x ELEMENT(s) x MODIFIERS x TIER.
//   Comum   - a basic form + element, no modifiers
//   Raro    - basic + 1-2 dynamics (bounce, split, homing, charge, curve...)
//   Épico   - two powers in one: a primary form plus a combo payload
//   Anômalo - very rare: epic + two fused elements + an anomalous modifier
// Structure (form, elements, modifiers, combo, name) depends only on the seed
// and tier; numbers are then scaled so every power's expected value matches
// the budget of the floor it was woven on. Re-weaving the same seed on a
// higher floor ("Reforçar") keeps its identity and raises its numbers.
(function (XS) {
  'use strict';

  const BUDGET_BASE = 3.1;          // expected damage per second at floor 1, tier Comum
  const FLOOR_GROWTH = 0.07;         // +7% budget per floor
  const TIER_MULT = [1, 1.12, 1.25, 1.42];
  const TERRAIN_MULT = 3.4;          // how hard powers hit the voxels
  const COMBO_SHARE = 0.4;           // share of an epic's budget spent on its payload

  const ELEMENTS = {
    plasma: { name: 'Plasma', noun: 'plasma', adj: [['Plasmático', 'Plasmática'], ['Ígneo', 'Ígnea']], ramp: ['#5a1020', '#c2401f', '#ff8a2a', '#ffe08a'], status: 'burn', terrain: 1.3, utility: 0.22, stain: 1, poetic: ['de Mil Sóis', 'da Estrela Furiosa', 'do Núcleo Derretido'], sfx: { wave: 'sawtooth', noise: 0.55, f0: 260, f1: 70, cutoff: 1600 } },
    cryo: { name: 'Crio', noun: 'gelo', adj: [['Criogênico', 'Criogênica'], ['Glacial', 'Glacial']], ramp: ['#1a2f6b', '#3f7fd8', '#8fd8ff', '#effcff'], status: 'chill', terrain: 0.9, utility: 0.32, stain: 2, poetic: ['do Zero Absoluto', 'do Inverno Eterno', 'de Plutão'], sfx: { wave: 'triangle', noise: 0.2, f0: 1400, f1: 900, cutoff: 5000 } },
    gravity: { name: 'Gravidade', noun: 'gravidade', adj: [['Gravitacional', 'Gravitacional'], ['Pesado', 'Pesada']], ramp: ['#1c0f3a', '#4b2a8f', '#8f6cf0', '#d9c8ff'], status: 'pull', terrain: 1.1, utility: 0.3, stain: 4, poetic: ['do Horizonte de Eventos', 'da Massa Infinita', 'de Netuno'], sfx: { wave: 'sine', noise: 0.1, f0: 90, f1: 40, cutoff: 900 } },
    void: { name: 'Vazio', noun: 'vazio', adj: [['do Vazio', 'do Vazio'], ['Abissal', 'Abissal']], ramp: ['#07040f', '#2a0f3d', '#7a2fa0', '#e070ff'], status: 'drain', terrain: 1.0, utility: 0.28, stain: 4, poetic: ['do Nada Faminto', 'do Silêncio Total', 'de Antes do Big Bang'], sfx: { wave: 'sine', noise: 0.3, f0: 200, f1: 600, cutoff: 1200 } },
    bio: { name: 'Bio', noun: 'ácido', adj: [['Tóxico', 'Tóxica'], ['Ácido', 'Ácida']], ramp: ['#10331a', '#2f8a2f', '#8be04a', '#e8ff9a'], status: 'poison', terrain: 1.25, utility: 0.25, stain: 3, poetic: ['do Pântano Primordial', 'da Fome Verde', 'dos Mil Esporos'], sfx: { wave: 'square', noise: 0.45, f0: 320, f1: 160, cutoff: 1400 } },
    arc: { name: 'Arco', noun: 'eletricidade', adj: [['Elétrico', 'Elétrica'], ['Voltaico', 'Voltaica']], ramp: ['#2a2408', '#c99a10', '#ffe03a', '#fffbd0'], status: 'shock', terrain: 0.9, utility: 0.3, stain: 1, poetic: ['da Tempestade Solar', 'do Relâmpago Gago', 'de Júpiter'], sfx: { wave: 'square', noise: 0.6, f0: 900, f1: 1800, cutoff: 6000 } },
    crystal: { name: 'Cristal', noun: 'cristal', adj: [['Cristalino', 'Cristalina'], ['Prismático', 'Prismática']], ramp: ['#20304a', '#3fa0a0', '#8ff0d8', '#f0fff8'], status: 'shard', terrain: 1.0, utility: 0.28, stain: 5, poetic: ['da Geometria Sagrada', 'do Diamante Cantor', 'das Mil Facetas'], sfx: { wave: 'triangle', noise: 0.1, f0: 1800, f1: 2400, cutoff: 7000 } },
    sonic: { name: 'Sônico', noun: 'som', adj: [['Sônico', 'Sônica'], ['Ressonante', 'Ressonante']], ramp: ['#3a2410', '#a06a2a', '#e8b860', '#fff0c8'], status: 'stagger', terrain: 2.0, utility: 0.25, stain: 0, poetic: ['do Primeiro Grito', 'da Nota Proibida', 'do Trovão Distante'], sfx: { wave: 'sawtooth', noise: 0.35, f0: 140, f1: 60, cutoff: 2200 } },
    chrono: { name: 'Cronos', noun: 'tempo', adj: [['Temporal', 'Temporal'], ['Relativístico', 'Relativística']], ramp: ['#2b2d3a', '#6d7390', '#b8c0e0', '#ffffff'], status: 'timeslow', terrain: 0.8, utility: 0.35, stain: 2, poetic: ['do Último Segundo', 'da Ampulheta Rachada', 'de Ontem'], sfx: { wave: 'sine', noise: 0.05, f0: 600, f1: 300, cutoff: 3000 } },
    psi: { name: 'Psi', noun: 'energia psíquica', adj: [['Psíquico', 'Psíquica'], ['Mental', 'Mental']], ramp: ['#3a0a2a', '#c02a7a', '#ff6ac0', '#ffd0ec'], status: 'mark', terrain: 0.7, utility: 0.32, stain: 4, poetic: ['da Mente Coletiva', 'do Sonho Alheio', 'do Terceiro Olho'], sfx: { wave: 'triangle', noise: 0.15, f0: 500, f1: 1000, cutoff: 2500 } },
    earth: { name: 'Terra', noun: 'rocha', adj: [['Telúrico', 'Telúrica'], ['Rochoso', 'Rochosa']], ramp: ['#2a1c10', '#6a4a2a', '#b08a5a', '#ecd8b0'], status: 'root', terrain: 2.0, utility: 0.3, stain: 0, poetic: ['do Núcleo do Planeta', 'da Montanha Adormecida', 'das Placas Tectônicas'], sfx: { wave: 'sawtooth', noise: 0.6, f0: 110, f1: 50, cutoff: 900 } },
    light: { name: 'Luz', noun: 'luz', adj: [['Luminoso', 'Luminosa'], ['Radiante', 'Radiante']], ramp: ['#3a2a5a', '#a890ff', '#ffe8ff', '#ffffff'], status: 'blind', terrain: 0.8, utility: 0.3, stain: 1, poetic: ['da Primeira Manhã', 'do Farol Cósmico', 'da Aurora Eterna'], sfx: { wave: 'sine', noise: 0.05, f0: 900, f1: 1600, cutoff: 6000 } },
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
    root: 'Enraizar: prende o alvo no chão por 0,6 s.',
    blind: 'Ofuscar: o alvo causa 25% menos dano por 3 s.',
  };

  // aim: how the power is aimed (line | cone | lob | zone | dash | self | wall).
  // hit: expected fraction of the nominal damage that lands (aiming, dodges).
  // kb: knockback impulse. terrain: voxel damage power at impact.
  const FORMS = {
    bolt: { nouns: [['Projétil', 'm'], ['Dardo', 'm'], ['Disparo', 'm'], ['Bólide', 'm']], plural: 'projéteis', aim: 'line', ai: 'ranged', cd: [1.6, 3], range: [9, 13], speed: [13, 18], radius: 0.45, hit: 0.55, kb: 3, terrain: 1.4 },
    beam: { nouns: [['Lança', 'f'], ['Raio', 'm'], ['Feixe', 'm']], plural: 'feixes', aim: 'line', ai: 'ranged', cd: [3, 5], range: [10, 14], radius: 0.55, ticks: 3, hit: 0.6, kb: 1.5, terrain: 1.3 },
    sniper: { nouns: [['Agulha', 'f'], ['Flecha', 'f'], ['Tiro Certeiro', 'm']], plural: 'agulhas', aim: 'line', ai: 'ranged', cd: [3, 5], range: [16, 21], speed: [34, 40], radius: 0.3, hit: 0.5, kb: 4, terrain: 1.6 },
    boomerang: { nouns: [['Bumerangue', 'm'], ['Disco', 'm'], ['Chakram', 'm']], plural: 'discos', aim: 'line', ai: 'ranged', cd: [2.5, 4], range: [8, 11], speed: [14, 17], radius: 0.6, hit: 0.7, kb: 3, terrain: 1 },
    hook: { nouns: [['Gancho', 'm'], ['Arpão', 'm'], ['Laço', 'm']], plural: 'ganchos', aim: 'line', ai: 'ranged', mobility: true, cd: [5, 8], range: [8, 11], speed: [22, 26], radius: 0.5, hit: 0.5, kb: 0, terrain: 0.8 },
    drill: { nouns: [['Broca', 'f'], ['Perfuratriz', 'f'], ['Verruma', 'f']], plural: 'brocas', aim: 'line', ai: 'ranged', cd: [4, 6], range: [12, 16], speed: [8, 10], radius: 0.6, hit: 0.6, kb: 2, terrain: 4 },
    wave: { nouns: [['Onda', 'f'], ['Maré', 'f'], ['Ondulação', 'f']], plural: 'ondas', aim: 'line', ai: 'ranged', cd: [4, 6], range: [9, 12], speed: [9, 11], radius: 1.3, hit: 0.6, kb: 6, terrain: 2.2 },
    eruption: { nouns: [['Erupção', 'f'], ['Fenda', 'f'], ['Estalagmite', 'f']], plural: 'erupções', aim: 'line', ai: 'ranged', cd: [4, 7], range: [8, 11], radius: 0.9, hit: 0.5, kb: 5, terrain: 1.5 },
    tornado: { nouns: [['Redemoinho', 'm'], ['Tornado', 'm'], ['Ciclone', 'm']], plural: 'redemoinhos', aim: 'line', ai: 'zone', cd: [7, 10], range: [10, 13], speed: [3.5, 4.5], radius: [1.6, 2.2], tick: 0.35, hit: 0.3, kb: 3, terrain: 1 },
    cone: { nouns: [['Sopro', 'm'], ['Jorro', 'm'], ['Bafo', 'm']], aim: 'cone', ai: 'close', cd: [3.5, 6], range: [4.5, 6], ticks: 4, duration: 0.6, angle: 0.9, hit: 0.55, kb: 2, terrain: 1 },
    shotgun: { nouns: [['Rajada', 'f'], ['Saraivada', 'f'], ['Leque', 'm']], plural: 'chumbos', aim: 'cone', ai: 'close', cd: [2.4, 4], range: [5, 7], speed: [16, 20], count: 6, angle: 0.7, radius: 0.28, hit: 0.42, kb: 1.2, terrain: 0.6 },
    quake: { nouns: [['Tremor', 'm'], ['Terremoto', 'm'], ['Pisão', 'm']], aim: 'cone', ai: 'close', cd: [5, 8], range: [4, 6], angle: 1.6, hit: 0.55, kb: 7, terrain: 3 },
    grenade: { nouns: [['Granada', 'f'], ['Bomba', 'f'], ['Cápsula', 'f']], plural: 'granadas', aim: 'lob', ai: 'zone', cd: [3, 5], range: [7, 10], radius: [1.8, 2.4], hit: 0.45, kb: 6, terrain: 3 },
    mine: { nouns: [['Mina', 'f'], ['Armadilha', 'f'], ['Semente', 'f']], plural: 'minas', aim: 'lob', ai: 'zone', cd: [5, 8], range: [7, 9], count: 3, radius: 2, hit: 0.3, kb: 7, terrain: 2.2 },
    field: { nouns: [['Campo', 'm'], ['Poça', 'f'], ['Domínio', 'm']], aim: 'lob', ai: 'zone', cd: [6, 9], range: [8, 11], radius: [2.4, 3.2], duration: [3, 4.5], tick: 0.5, hit: 0.3, kb: 0, terrain: 0.5 },
    singularity: { nouns: [['Singularidade', 'f'], ['Buraco Negro', 'm'], ['Vórtice', 'm']], aim: 'lob', ai: 'zone', cd: [8, 11], range: [8, 11], radius: [3, 4], duration: [2.5, 3.5], tick: 0.4, hit: 0.35, kb: 0, terrain: 1.5 },
    summon: { nouns: [['Sentinela', 'f'], ['Totem', 'm'], ['Familiar', 'm']], plural: 'sentinelas', aim: 'lob', ai: 'zone', cd: [9, 13], range: [5, 7], duration: [7, 9], count: 1, tick: 1.1, hit: 0.45, kb: 1.5, terrain: 0.6 },
    rain: { nouns: [['Chuva', 'f'], ['Tempestade', 'f'], ['Granizo', 'm']], plural: 'impactos', aim: 'zone', ai: 'zone', cd: [5, 8], range: [9, 12], count: 5, radius: 1.4, spread: 2.6, hit: 0.28, kb: 4, terrain: 2.2 },
    meteor: { nouns: [['Meteoro', 'm'], ['Cometa', 'm'], ['Astro Cadente', 'm']], plural: 'meteoros', aim: 'zone', ai: 'zone', cd: [9, 13], range: [9, 13], radius: [3, 4], hit: 0.4, kb: 10, terrain: 6 },
    dash: { nouns: [['Investida', 'f'], ['Arremetida', 'f'], ['Ímpeto', 'm']], aim: 'dash', ai: 'close', mobility: true, cd: [3.5, 6], range: [6, 8], radius: 1.3, hit: 0.5, kb: 7, terrain: 1.6 },
    blink: { nouns: [['Salto', 'm'], ['Passo', 'm'], ['Translação', 'f']], aim: 'dash', ai: 'mobility', mobility: true, cd: [5, 8], range: [6, 9], radius: [2, 2.6], hit: 0.45, kb: 7, terrain: 1.6 },
    nova: { nouns: [['Nova', 'f'], ['Explosão', 'f'], ['Pulso', 'm']], aim: 'self', ai: 'close', cd: [4, 7], range: [0, 0], radius: [3, 4], hit: 0.5, kb: 8, terrain: 2.4 },
    orbit: { nouns: [['Anel', 'm'], ['Órbita', 'f'], ['Halo', 'm']], plural: 'orbes', aim: 'self', ai: 'close', cd: [7, 10], duration: [5, 7], count: 3, radius: 0.55, orbit: 2.3, tick: 0.6, hit: 0.22, kb: 2, terrain: 0.6 },
    aura: { nouns: [['Aura', 'f'], ['Manto', 'm'], ['Couraça', 'f']], aim: 'self', ai: 'defense', cd: [10, 14], duration: [4, 6], radius: 2.6, tick: 0.8, hit: 0.5, kb: 2.5, terrain: 0.4 },
    wall: { nouns: [['Muralha', 'f'], ['Barreira', 'f'], ['Bastião', 'm']], aim: 'wall', ai: 'defense', cd: [7, 10], range: [5, 7], duration: [5, 7], length: 5, height: 3, radius: 1.5, hit: 0.35, kb: 6, terrain: 0 },
  };
  const FORM_WEIGHTS = {
    bolt: 2.6, beam: 1.4, sniper: 1.1, boomerang: 1.2, hook: 0.9, drill: 1, wave: 1.1, eruption: 1.1, tornado: 1,
    cone: 1.1, shotgun: 1.2, quake: 1, grenade: 1.5, mine: 1, field: 1.1, singularity: 0.9, summon: 0.9, rain: 1.1, meteor: 0.9,
    dash: 1.2, blink: 1, nova: 1.2, orbit: 1, aura: 0.9, wall: 0.8,
  };
  // Which forms throw a lobbed shell (arcing over walls) to their target point.
  const LOBBED = ['grenade', 'mine', 'field', 'singularity', 'summon'];

  const ALL = Object.keys(FORMS);
  const LINE = ['bolt', 'sniper', 'boomerang', 'drill'];
  // hit: multiplier on expected hits; util: added utility; dmg: extra
  // instances of damage (echo, mirrored); cd/size/speed: stat multipliers.
  const MODS = {
    split: { adj: [['Tríplice', 'Tríplice'], ['Múltiplo', 'Múltipla']], forms: ['bolt', 'beam', 'boomerang', 'hook', 'mine', 'rain', 'orbit', 'summon', 'grenade', 'sniper', 'drill', 'wave', 'eruption', 'tornado', 'shotgun', 'meteor'], hit: 1, util: 0.05 },
    homing: { adj: [['Teleguiado', 'Teleguiada'], ['Faminto', 'Faminta']], forms: ['bolt', 'boomerang', 'tornado', 'drill'], hit: 1.35, util: 0 },
    ricochet: { adj: [['Ricocheteante', 'Ricocheteante'], ['Saltitante', 'Saltitante']], forms: ['bolt', 'boomerang', 'grenade', 'sniper'], hit: 1.15, util: 0.05 },
    pierce: { adj: [['Perfurante', 'Perfurante']], forms: ['bolt', 'beam', 'dash', 'boomerang', 'shotgun'], hit: 1.15, util: 0.05 },
    explosive: { adj: [['Explosivo', 'Explosiva']], forms: ['bolt', 'boomerang', 'hook', 'mine', 'rain', 'dash', 'blink', 'beam', 'sniper', 'drill', 'wave'], hit: 1.25, util: 0.05, terrain: 1.6 },
    echo: { adj: [['Ecoante', 'Ecoante']], forms: ['bolt', 'beam', 'nova', 'cone', 'rain', 'dash', 'boomerang', 'mine', 'blink', 'hook', 'grenade', 'sniper', 'wave', 'eruption', 'quake', 'shotgun'], dmg: 2, util: 0 },
    trail: { adj: [['Persistente', 'Persistente'], ['Rastejante', 'Rastejante']], forms: ['bolt', 'dash', 'boomerang', 'orbit', 'wave', 'drill', 'tornado'], hit: 1, util: 0.22 },
    vampiric: { adj: [['Vampírico', 'Vampírica']], forms: ALL.filter((f) => f !== 'wall'), hit: 1, util: 0.28 },
    colossal: { adj: [['Colossal', 'Colossal']], forms: ['bolt', 'nova', 'field', 'rain', 'orbit', 'summon', 'wall', 'mine', 'boomerang', 'beam', 'grenade', 'wave', 'tornado', 'meteor', 'quake', 'eruption', 'singularity', 'drill'], hit: 1.2, util: 0, cd: 1.25, size: 1.7, speed: 0.65, kb: 1.4, excludes: ['swift'] },
    swift: { adj: [['Veloz', 'Veloz']], forms: ['bolt', 'boomerang', 'dash', 'hook', 'beam', 'blink', 'sniper', 'grenade', 'drill', 'wave', 'shotgun'], hit: 1.1, util: 0, cd: 0.75, size: 0.75, speed: 1.6, excludes: ['colossal'] },
    excavator: { adj: [['Escavador', 'Escavadora'], ['Demolidor', 'Demolidora']], forms: ALL.filter((f) => f !== 'wall'), hit: 1, util: 0.08, terrain: 3 },
    crystallize: { adj: [['Cristalizante', 'Cristalizante']], forms: ['bolt', 'rain', 'nova', 'mine', 'blink', 'beam', 'dash', 'grenade', 'meteor', 'sniper', 'wave', 'quake', 'eruption'], hit: 1, util: 0.15 },
    spiral: { adj: [['Espiralado', 'Espiralada']], forms: ['bolt'], hit: 1.05, util: 0 },
    chain: { adj: [['Encadeado', 'Encadeada']], forms: ['bolt', 'beam', 'hook', 'sniper', 'shotgun'], hit: 1.4, util: 0 },
    magnetic: { adj: [['Magnético', 'Magnética']], forms: ['bolt', 'rain', 'mine', 'field', 'nova', 'blink', 'grenade', 'meteor', 'quake'], hit: 1, util: 0.2 },
    returning: { adj: [['Retornável', 'Retornável'], ['Fiel', 'Fiel']], forms: ['bolt', 'drill'], hit: 1.3, util: 0 },
    charge: { adj: [['Carregável', 'Carregável']], forms: ['bolt', 'sniper', 'beam', 'grenade', 'meteor', 'wave', 'drill', 'hook', 'eruption'], hit: 1.15, util: 0 },
    curve: { adj: [['Curvo', 'Curva'], ['Sinuoso', 'Sinuosa']], forms: ['bolt', 'drill', 'wave'], hit: 1.08, util: 0 },
    burrow: { adj: [['Subterrâneo', 'Subterrânea']], forms: ['bolt', 'wave'], hit: 1.1, util: 0.1, terrain: 1.5 },
    cluster: { adj: [['Fragmentário', 'Fragmentária']], forms: ['grenade', 'meteor', 'mine'], hit: 1.4, util: 0.05 },
    delay: { adj: [['Retardado', 'Retardada']], forms: ['grenade', 'mine', 'meteor', 'nova', 'blink'], hit: 1.05, util: 0.05 },
    fractal: { adj: [['Fractal', 'Fractal']], forms: ['bolt', 'rain', 'mine', 'boomerang', 'grenade', 'meteor', 'sniper'], anomalous: true, hit: 1.6, util: 0.05 },
    mirrored: { adj: [['Espelhado', 'Espelhada']], forms: ['bolt', 'beam', 'cone', 'boomerang', 'hook', 'sniper', 'shotgun', 'wave', 'eruption', 'drill'], anomalous: true, dmg: 1.6, util: 0 },
  };
  const MOD_TEXT = {
    homing: () => 'Persegue o inimigo mais próximo.',
    ricochet: (d) => (d.form === 'grenade' ? 'Quica antes de explodir.' : 'Ricocheteia nas paredes até 3 vezes.'),
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
    charge: () => 'Segure a mira para carregar: até 1,6× de dano e tamanho.',
    curve: () => 'Faz uma curva no caminho.',
    burrow: () => 'Viaja por baixo da terra, abrindo uma trincheira.',
    cluster: () => 'Ao explodir, solta 4 minigranadas.',
    delay: () => 'Detona 1,2 s depois, com 40% mais força.',
    fractal: () => 'Ao impactar, gera 3 cópias menores de si.',
    mirrored: () => 'Também é conjurado na direção oposta.',
  };

  // Épico payloads: the second power folded into the first.
  const SUBS = {
    nova: { noun: 'Nova', radius: [2.2, 3], hit: 0.5, kb: 6, terrain: 2.2 },
    field: { noun: 'Campo', radius: [2, 2.6], duration: [2.5, 3.5], tick: 0.5, hit: 0.3, kb: 0, terrain: 0.4 },
    mines: { noun: 'Minas', count: 3, radius: 1.8, hit: 0.3, kb: 6, terrain: 2 },
    wall: { noun: 'Muralha', length: 5, duration: [4, 6], radius: 1.2, hit: 0.25, kb: 5, terrain: 0, util: 0.4 },
    singularity: { noun: 'Buraco Negro', radius: [2.5, 3.2], duration: [1.5, 2.2], tick: 0.4, hit: 0.3, kb: 0, terrain: 1, util: 0.3 },
    rain: { noun: 'Chuva', count: 4, radius: 1.2, spread: 2.4, hit: 0.28, kb: 3, terrain: 1.8 },
    summon: { noun: 'Sentinela', duration: [5, 7], tick: 1.1, hit: 0.45, kb: 1.5, terrain: 0.5 },
    eruption: { noun: 'Espinhos', count: 4, range: 4, radius: 0.8, hit: 0.45, kb: 5, terrain: 1.2 },
    shotgun: { noun: 'Estilhaços', count: 8, range: 5, speed: 16, radius: 0.28, hit: 0.2, kb: 1, terrain: 0.6 },
    chain: { noun: 'Relâmpago', count: 3, range: 7, hit: 0.6, kb: 1, terrain: 0 },
  };
  // When the payload fires, by primary form.
  const TRIGGER = {
    bolt: 'impact', sniper: 'impact', grenade: 'impact', hook: 'impact', mine: 'impact', meteor: 'impact', blink: 'impact',
    boomerang: 'end', drill: 'end', beam: 'end', wave: 'end', tornado: 'end', rain: 'end', singularity: 'end', field: 'end',
    eruption: 'end', summon: 'end', wall: 'end', dash: 'end',
    quake: 'cast', cone: 'cast', shotgun: 'cast', nova: 'cast', aura: 'cast', orbit: 'cast',
  };
  const TRIGGER_TEXT = { impact: 'Ao acertar', end: 'Ao terminar', cast: 'Ao conjurar' };

  const POETIC_NOUNS = ['Beijo', 'Sussurro', 'Fúria', 'Canção', 'Dente', 'Abraço', 'Lágrima', 'Promessa', 'Grito', 'Dança', 'Suspiro', 'Mordida', 'Carícia', 'Juramento', 'Eco', 'Rugido', 'Bênção', 'Maldição'];
  const PLACES = ['de Andrômeda', 'de Órion', 'de Vega', 'de Sírius', 'de Cassiopeia', 'do Último Quasar', 'da Nebulosa Caranguejo', 'do Vigésimo Céu', 'de Betelgeuse', 'do Curador', 'da Torre', 'de Aldebarã'];
  const FLAVOR_THINGS = [
    'de uma supernova tímida', 'do bocejo de um quasar', 'de uma estrela que desistiu', 'de um cometa atrasado',
    'do sonho de um buraco negro', 'de luz com 9 bilhões de anos', 'de uma canção de ninar alienígena', 'de saudade cristalizada',
    'da poeira de um império esquecido', 'do primeiro trovão do universo', 'de uma promessa não cumprida', 'do riso de uma lua',
  ];
  const SFX_DUR = {
    bolt: 0.16, beam: 0.42, sniper: 0.12, boomerang: 0.22, hook: 0.2, drill: 0.4, wave: 0.45, eruption: 0.5, tornado: 0.6,
    cone: 0.6, shotgun: 0.2, quake: 0.55, grenade: 0.25, mine: 0.2, field: 0.35, singularity: 0.6, summon: 0.4, rain: 0.3,
    meteor: 0.7, dash: 0.25, blink: 0.28, nova: 0.5, orbit: 0.3, aura: 0.6, wall: 0.45,
  };

  function tierFor(seed, floor, maxTier = 3) {
    const rng = new XS.RNG(XS.hash(seed, 'tier', floor));
    const w = [Math.max(20, 55 - floor * 1.5), 32 + floor * 0.4, 11 + floor * 0.5, 2 + floor * 0.15];
    const items = w.map((v, i) => ({ i, w: i <= maxTier ? v : 0 }));
    return rng.weighted(items).i;
  }

  const budget = (floor, tier) => BUDGET_BASE * (1 + FLOOR_GROWTH * (Math.max(1, floor) - 1)) * TIER_MULT[tier];
  const pickRange = (rng, v) => (Array.isArray(v) ? rng.range(v[0], v[1]) : v);

  // Expected hits per cast for one point of per-hit damage (before modifiers).
  function hitsFor(form, d, F) {
    switch (form) {
      case 'field': case 'singularity': case 'aura': return (d.duration / F.tick) * F.hit;
      case 'orbit': case 'summon': return d.count * (d.duration / F.tick) * F.hit;
      case 'tornado': return (d.duration / F.tick) * F.hit;
      case 'cone': return d.ticks * F.hit;
      case 'boomerang': return d.count * F.hit * 1.4;
      case 'eruption': case 'wave': case 'drill': return d.count * F.hit * 1.1;
      default: return d.count * d.ticks * F.hit;
    }
  }

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
    const allowedEl = opts.elements && opts.elements.length ? elementKeys.filter((e) => opts.elements.includes(e)) : elementKeys;
    const e1 = rs.pick(allowedEl);
    const elements = [e1];
    if (tier === 3) elements.push(rs.pick(elementKeys.filter((e) => e !== e1)));
    const mods = [];
    const pool = Object.keys(MODS).filter((m) => MODS[m].forms.includes(form) && !MODS[m].anomalous);
    rs.shuffle(pool);
    const nMods = tier === 0 ? 0 : tier === 1 ? rs.int(1, 2) : tier === 2 ? rs.int(0, 1) : 1;
    for (const m of pool) {
      if (mods.length >= nMods) break;
      if ((MODS[m].excludes || []).some((x) => mods.includes(x))) continue;
      mods.push(m);
    }
    if (tier === 3) {
      const anom = Object.keys(MODS).filter((m) => MODS[m].anomalous && MODS[m].forms.includes(form));
      if (anom.length) mods.push(rs.pick(anom));
    }
    let comboForm = null;
    if (tier >= 2) {
      const subs = Object.keys(SUBS).filter((s) => s !== form && !(s === 'mines' && form === 'mine') && !(s === 'shotgun' && form === 'shotgun'));
      comboForm = rs.pick(subs);
    }
    const has = (m) => mods.includes(m);

    // ---- numbers (floor independent) ----
    const size = (has('colossal') ? MODS.colossal.size : 1) * (has('swift') ? MODS.swift.size : 1);
    const spdM = (has('colossal') ? MODS.colossal.speed : 1) * (has('swift') ? MODS.swift.speed : 1);
    const cdM = (has('colossal') ? MODS.colossal.cd : 1) * (has('swift') ? MODS.swift.cd : 1);
    let count = F.count || 1;
    if (has('split')) {
      if (form === 'mine' || form === 'rain' || form === 'shotgun') count += 3;
      else if (form === 'orbit') count += 2;
      else if (form === 'summon' || form === 'tornado' || form === 'meteor') count = 2;
      else count = 3;
    }
    const def = {
      seed, floor, tier, form, elements, mods,
      aim: F.aim,
      lob: LOBBED.includes(form),
      target: F.aim === 'self' ? 'self' : (F.aim === 'line' || F.aim === 'cone' || form === 'dash') ? 'dir' : 'point',
      cooldown: Math.round(pickRange(rn, F.cd) * cdM * 10) / 10,
      range: Math.round(pickRange(rn, F.range || 0) * 10) / 10,
      radius: Math.round(pickRange(rn, F.radius || 0.5) * size * 100) / 100,
      speed: Math.round(pickRange(rn, F.speed || 0) * spdM * 10) / 10,
      duration: Math.round(pickRange(rn, F.duration || 0) * 10) / 10,
      count,
      ticks: F.ticks || 1,
      knock: F.kb * (has('colossal') ? MODS.colossal.kb : 1) * (elements.includes('sonic') ? 1.8 : 1),
      blast: has('explosive') ? Math.round(1.8 * size * 10) / 10 : 0,
      status: elements.map((e) => ELEMENTS[e].status),
      ai: { kind: F.ai, mobility: !!F.mobility },
    };
    if (form === 'wall') def.length = Math.round(F.length * (has('colossal') ? 1.6 : 1));
    if (form === 'orbit') def.orbit = F.orbit * (has('colossal') ? 1.3 : 1);
    if (form === 'rain') def.spread = F.spread * size;
    if (form === 'cone' || form === 'quake' || form === 'shotgun') def.angle = F.angle * (form === 'cone' ? size : 1);
    if (form === 'cone') def.duration = F.duration;
    if (form === 'beam' && has('colossal')) def.radius *= 1.2;
    if (form === 'tornado') def.duration = Math.round((def.range / def.speed) * 10) / 10;
    def.ai.range = def.aim === 'self' ? (form === 'orbit' ? def.orbit : def.radius) : def.range;

    // ---- balance: solve damage from the budget ----
    const hits = hitsFor(form, def, F);
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
    if (form === 'singularity' || form === 'tornado') util += 0.2;
    if (form === 'eruption') util += 0.15;
    util += Math.min(0.3, def.knock * 0.025);
    const b = budget(floor, tier);
    const share = comboForm ? 1 - COMBO_SHARE : 1;
    const value = hits * hitM * extra * (1 + util); // expected damage per point of per-hit damage
    def.damage = Math.max(1, Math.round((b * share * def.cooldown) / value));
    // Re-derive the cooldown from the rounded damage so small per-hit numbers
    // don't drift away from the budget.
    const [cdMin, cdMax] = F.cd;
    def.cooldown = XS.clamp(Math.round(((def.damage * value) / (b * share)) * 10) / 10, cdMin * 0.6 * cdM, cdMax * 1.5 * cdM);
    def.budget = b;
    def.expected = (def.damage * value) / def.cooldown;
    def.hitsPerCast = hits * hitM * extra;
    const terrainBase = F.terrain * ELEMENTS[e1].terrain * (has('excavator') ? MODS.excavator.terrain : 1) * (has('explosive') ? MODS.explosive.terrain : 1) * (has('burrow') ? MODS.burrow.terrain : 1);
    def.terrain = Math.round(terrainBase * TERRAIN_MULT * (1 + 0.03 * (floor - 1)) * 100) / 100;
    if (comboForm) {
      def.combo = makeCombo(comboForm, TRIGGER[form], def, rn, b * COMBO_SHARE);
      def.expected += def.combo.expected;
    }

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
      dur: SFX_DUR[form] * (has('colossal') ? 1.4 : 1),
      vib: rn.range(0, 12),
    };
    return def;
  }

  // The payload of an epic power, balanced on its own share of the budget.
  function makeCombo(form, trigger, parent, rn, subBudget) {
    const T = SUBS[form];
    const c = {
      form, trigger,
      radius: Math.round(pickRange(rn, T.radius || 1) * 100) / 100,
      duration: Math.round(pickRange(rn, T.duration || 0) * 10) / 10,
      count: T.count || 1, tick: T.tick || 0.5, range: T.range || 0, speed: T.speed || 0, spread: T.spread || 0,
      length: T.length || 0, knock: T.kb, terrain: Math.round(T.terrain * TERRAIN_MULT * 100) / 100,
      elements: parent.elements, status: parent.status, mods: [], ramp: null,
    };
    let hits;
    switch (form) {
      case 'field': case 'singularity': hits = (c.duration / c.tick) * T.hit; break;
      case 'summon': hits = (c.duration / c.tick) * T.hit; break;
      case 'mines': case 'rain': case 'shotgun': hits = c.count * T.hit; break;
      default: hits = T.hit;
    }
    const value = hits * (1 + (T.util || 0));
    c.damage = Math.max(1, Math.round((subBudget * parent.cooldown) / value));
    c.expected = (c.damage * value) / parent.cooldown;
    return c;
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
    if (def.combo) technical += ` com ${SUBS[def.combo.form].noun}`;
    else if (def.tier === 1 && !prepositional && rng.chance(0.35)) technical += ' ' + rng.pick(PLACES);
    if (def.tier === 3) technical += ` Nº ${rng.int(100, 9999)}`;
    if (rng.chance(0.3)) return { name: `${rng.pick(POETIC_NOUNS)} ${rng.pick(ELEMENTS[e1].poetic)}`, sub: technical };
    return { name: technical, sub: null };
  }

  function describe(d) {
    const F = FORMS[d.form];
    const dmg = d.damage, n = d.count, el = ELEMENTS[d.elements[0]].noun;
    const r = XS.fmt1(d.radius), dur = XS.fmt1(d.duration), rg = XS.fmt1(d.range);
    const lines = [];
    switch (d.form) {
      case 'bolt': lines.push(n > 1 ? `Dispara ${n} ${F.plural} de ${el} que causam ${dmg} de dano cada.` : `Dispara um projétil de ${el} que causa ${dmg} de dano.`); break;
      case 'beam': lines.push(`${n > 1 ? `Dispara ${n} feixes` : 'Dispara um feixe'} de ${el} que causa ${dmg} de dano por pulso (3 pulsos).`); break;
      case 'sniper': lines.push(`${n > 1 ? `Dispara ${n} agulhas` : 'Dispara uma agulha'} de ${el} de longo alcance (${rg}) que atravessa${n > 1 ? 'm' : ''} inimigos: ${dmg} de dano.`); break;
      case 'drill': lines.push(`${n > 1 ? `Lança ${n} brocas` : 'Lança uma broca'} de ${el} que atravessa e escava paredes: ${dmg} de dano.`); break;
      case 'wave': lines.push(`${n > 1 ? `Solta ${n} ondas` : 'Solta uma onda'} de ${el} que corre pelo chão escavando o caminho: ${dmg} de dano.`); break;
      case 'eruption': lines.push(`${n > 1 ? `Abre ${n} fileiras` : 'Abre uma fileira'} de espinhos de ${el} que brotam do chão: ${dmg} de dano e lança os inimigos para cima.`); break;
      case 'tornado': lines.push(`${n > 1 ? `Solta ${n} redemoinhos` : 'Solta um redemoinho'} de ${el} que avança puxando inimigos: ${dmg} de dano a cada 0,35 s.`); break;
      case 'shotgun': lines.push(`Dispara ${n} chumbos de ${el} em leque: ${dmg} de dano cada.`); break;
      case 'quake': lines.push(`Golpeia o chão à frente, abrindo uma cratera: ${dmg} de dano e atordoa por 0,4 s.`); break;
      case 'grenade': lines.push(`${n > 1 ? `Arremessa ${n} granadas` : 'Arremessa uma granada'} de ${el} que explode ao cair (raio ${r}): ${dmg} de dano.`); break;
      case 'singularity': lines.push(`Arremessa um núcleo que vira um buraco negro (raio ${r}) por ${dur} s: puxa tudo e causa ${dmg} de dano a cada 0,4 s.`); break;
      case 'meteor': lines.push(`${n > 1 ? `Chama ${n} meteoros` : 'Chama um meteoro'} de ${el}: depois de 1,2 s abre uma cratera enorme (raio ${r}) causando ${dmg} de dano.`); break;
      case 'nova': lines.push(`Após um breve acúmulo, explode ao seu redor (raio ${r}) causando ${dmg} de dano.`); break;
      case 'cone': lines.push(`Sopra ${el} à frente por ${XS.fmt1(d.duration)} s: ${dmg} de dano por pulso.`); break;
      case 'field': lines.push(`Arremessa um frasco que vira uma zona de ${el} (raio ${r}) por ${dur} s: ${dmg} de dano a cada 0,5 s.`); break;
      case 'rain': lines.push(`Faz cair ${n} impactos de ${el} na área: ${dmg} de dano cada.`); break;
      case 'dash': lines.push(`Avança ${rg} voxels causando ${dmg} de dano a quem atravessar.`); break;
      case 'orbit': lines.push(`${n} orbes de ${el} giram ao seu redor por ${dur} s: ${dmg} de dano por toque.`); break;
      case 'summon': lines.push(`${n > 1 ? `Arremessa ${n} sentinelas` : 'Arremessa uma sentinela'} que atira por ${dur} s: ${dmg} de dano por tiro.`); break;
      case 'mine': lines.push(`Arremessa ${n} minas que explodem ao contato: ${dmg} de dano.`); break;
      case 'wall': lines.push(`Ergue uma muralha de ${d.length} voxels por ${dur} s. Quem estiver no caminho sofre ${dmg} de dano.`); break;
      case 'boomerang': lines.push(`${n > 1 ? `Lança ${n} discos` : 'Lança um disco'} que vai e volta: ${dmg} de dano por passagem.`); break;
      case 'hook': lines.push(`${n > 1 ? `Lança ${n} ganchos que puxam` : 'Lança um gancho que puxa'} o inimigo (${dmg} de dano). Em paredes, puxa você.`); break;
      case 'blink': lines.push(`Teleporta você até ${rg} voxels e explode na chegada (${dmg} de dano).`); break;
      case 'aura': lines.push(`Por ${dur} s: ${AURA_TEXT[d.elements[0]]}. Pulsos causam ${dmg} de dano ao redor.`); break;
    }
    if (d.combo) lines.push(`Épico — ${TRIGGER_TEXT[d.combo.trigger]}, ${comboText(d.combo)}.`);
    for (const s of d.status) lines.push(STATUS_TEXT[s]);
    for (const m of d.mods) if (m !== 'split') lines.push(MOD_TEXT[m](d)); // split shows up as the count
    return lines;
  }
  function comboText(c) {
    const r = XS.fmt1(c.radius), dur = XS.fmt1(c.duration), dmg = c.damage;
    switch (c.form) {
      case 'nova': return `explode (raio ${r}): ${dmg} de dano`;
      case 'field': return `deixa uma zona (raio ${r}) por ${dur} s: ${dmg} de dano a cada 0,5 s`;
      case 'mines': return `espalha ${c.count} minas: ${dmg} de dano cada`;
      case 'wall': return `ergue uma muralha de ${c.length} voxels (${dmg} de dano a quem estiver no caminho)`;
      case 'singularity': return `abre um buraco negro por ${dur} s que puxa tudo: ${dmg} de dano a cada 0,4 s`;
      case 'rain': return `faz chover ${c.count} impactos: ${dmg} de dano cada`;
      case 'summon': return `invoca uma sentinela por ${dur} s: ${dmg} de dano por tiro`;
      case 'eruption': return `faz brotar espinhos em ${c.count} direções: ${dmg} de dano`;
      case 'shotgun': return `solta ${c.count} estilhaços em todas as direções: ${dmg} de dano cada`;
      case 'chain': return `lança um relâmpago em até ${c.count} inimigos: ${dmg} de dano cada`;
    }
    return '';
  }
  const AURA_TEXT = {
    plasma: 'você incendeia quem chegar perto', cryo: 'você sofre 30% menos dano', gravity: 'você atrai inimigos próximos',
    void: 'você cura 30% do dano que causa', bio: 'você regenera vida', arc: 'você solta choques em volta',
    crystal: 'você ganha um escudo de cristal', sonic: 'você repele quem chegar perto', chrono: 'você fica 30% mais rápido',
    psi: 'você marca inimigos próximos', earth: 'você fica pesado e sofre 30% menos dano e empurrão', light: 'você ofusca quem chegar perto',
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
    if (personality === 'exibido') s *= 1 + def.mods.length * 0.08 + (def.combo ? 0.15 : 0);
    // Variety: prefer kinds the kit doesn't have yet.
    if (current.some((c) => c.ai.kind === k)) s *= 0.82;
    return s;
  }

  XS.Power = { generate, tierFor, budget, draftScore, ELEMENTS, FORMS, MODS, SUBS, TRIGGER, STATUS_TEXT, BUDGET_BASE, TIER_MULT, LOBBED, LINE };
})(globalThis.XS = globalThis.XS || {});
