// Niryk — content: heroes, abilities and their passives, weapons, equipment, enemies, bosses, worlds,
// blessings, meta upgrades and achievements. Pure data (no DOM), so the tests can load it in Node.
'use strict';
(function () {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const N = root.N = root.N || {};

  N.LORE = [
    'Niryk é um planeta partido em três camadas.',
    'Na superfície, o Overworld ainda respira; abaixo dele, o Mundo Reverso devolve tudo invertido;',
    'e no fundo jazem as Wastelands, onde os Colossos tombaram quando o Núcleo Estelar começou a se apagar.',
    'Quatro heróis descem pelas camadas para reacender o Núcleo — de novo, e de novo, e de novo.',
  ];

  N.RARITY = [
    { name: 'Comum', color: '#c9c9d6' },
    { name: 'Raro', color: '#4fa3ff' },
    { name: 'Épico', color: '#c66bff' },
    { name: 'Lendário', color: '#ffb52e' },
  ];

  // ---------------------------------------------------------------- heroes
  N.CHARS = {
    emberian: {
      name: 'Emberian', title: 'A Brasa Dracônica', color: '#e0503c',
      hp: 7, shield: 4, speed: 62, crit: 0.05, weapon: 'tronco',
      abilities: ['forma', 'rugido', 'investida', 'pancada'],
      bio: 'Filha de uma linhagem que dividia o sangue com os dragões de Niryk. Tem dois chifres e uma cauda escamosa — o resto é humano, e teimoso. Arrancou um tronco de árvore inteiro para usar como porrete, e quando a raiva sobe, desperta sua forma dracônica de quatro patas.',
    },
    sylvar: {
      name: 'Sylvar', title: 'O Arqueiro da Lua Prateada', color: '#5fe3d6',
      hp: 5, shield: 5, speed: 70, crit: 0.1, weapon: 'arco_lunar',
      abilities: ['chuva', 'espirito', 'passo', 'raizes'],
      bio: 'Elfo dos bosques de prata, guardião dos espíritos da floresta. Fala com raízes e vagalumes, e nunca erra uma flecha sob a luz das três luas de Niryk.',
    },
    kestrus: {
      name: 'Kestrus', title: 'O Gavião das Tempestades', color: '#6f9ae0',
      hp: 5, shield: 4, speed: 78, crit: 0.08, weapon: 'penas',
      abilities: ['tempestade', 'mergulho', 'rajada', 'olho'],
      bio: 'Um homem aviano de penas azul-tempestade, nascido nos picos onde os raios moram. Arremessa as próprias penas afiadas como lâminas e mergulha do céu como um falcão.',
    },
    haldor: {
      name: 'Haldor', title: 'O Corcel de Ferro', color: '#e0a03c',
      hp: 8, shield: 3, speed: 66, crit: 0.05, weapon: 'lanca',
      abilities: ['galope', 'coice', 'relincho', 'ferradura'],
      bio: 'Cavaleiro de um povo equino — orelhas, crina, cauda e cascos de cavalo, mas mãos e coração de gente. Empunha a Lança Trovejante e nunca recua de uma carga.',
    },
  };
  N.CHAR_ORDER = ['emberian', 'sylvar', 'kestrus', 'haldor'];

  // ---------------------------------------------------------------- abilities (4 per hero, 3 passives each)
  N.ABILITIES = {
    // Emberian
    forma: { char: 'emberian', name: 'Forma Dracônica', cd: 24, desc: 'Transforma-se num dragão quadrúpede por 7s: +25% de velocidade, -40% de dano recebido e ataques viram garradas amplas.', mods: [
      { name: 'Sopro Infernal', desc: 'Na forma dracônica, os ataques viram um sopro de fogo em cone que incendeia.' },
      { name: 'Coração de Brasa', desc: 'Ao se transformar, recupera 2 de Vida. Cada abate prolonga a forma em 1s.' },
      { name: 'Pouso Cataclísmico', desc: 'Explosões de fogo (25 de dano) ao se transformar e ao voltar à forma humana.' },
    ] },
    rugido: { char: 'emberian', name: 'Rugido Ígneo', cd: 9, desc: 'Rugido em área: 6 de dano, empurra e atordoa por 1s.', mods: [
      { name: 'Eco Flamejante', desc: 'Incendeia os inimigos atingidos (3 de dano/s por 4s).' },
      { name: 'Rugido Ensurdecedor', desc: 'Raio 60% maior e atordoamento de 2,5s.' },
      { name: 'Brado Protetor', desc: 'Destrói projéteis inimigos na área e concede +2 de Escudo.' },
    ] },
    investida: { char: 'emberian', name: 'Investida Flamejante', cd: 6, desc: 'Avança com tudo, invulnerável, causando 9 de dano a quem atravessar.', mods: [
      { name: 'Rastro de Fogo', desc: 'Deixa um rastro de chamas por 3s.' },
      { name: 'Dupla Investida', desc: 'Acumula 2 cargas.' },
      { name: 'Impacto Final', desc: 'Termina com uma explosão (16 de dano).' },
    ] },
    pancada: { char: 'emberian', name: 'Pancada Sísmica', cd: 8, desc: 'Salta e golpeia o chão com o tronco: onda de choque de 14 de dano.', mods: [
      { name: 'Tremor Contínuo', desc: 'Três abalos secundários em sequência.' },
      { name: 'Fissuras de Magma', desc: 'Oito fissuras de lava se espalham a partir do impacto.' },
      { name: 'Salto Colossal', desc: 'Salta até a mira, invulnerável no ar.' },
    ] },
    // Sylvar
    chuva: { char: 'sylvar', name: 'Chuva de Flechas', cd: 9, desc: 'Uma área na mira recebe 14 flechas em 1,2s (4 de dano cada).', mods: [
      { name: 'Flechas de Geada', desc: 'As flechas deixam os inimigos 50% mais lentos por 2s.' },
      { name: 'Tempestade de Prata', desc: 'Dobro de flechas por mais tempo e área 30% maior.' },
      { name: 'Flecha Estelar', desc: 'Uma única flecha colossal cai após 0,6s: explosão de 40 de dano.' },
    ] },
    espirito: { char: 'sylvar', name: 'Espírito da Floresta', cd: 16, desc: 'Invoca um fogo-fátuo que orbita você e dispara nos inimigos por 12s.', mods: [
      { name: 'Guardião Ent', desc: 'Invoca uma muda de Ent fixa que atrai os inimigos e dispara sementes.' },
      { name: 'Enxame de Vagalumes', desc: 'Invoca três fogos-fátuos menores.' },
      { name: 'Espírito Curativo', desc: 'Os tiros deixam lento e o espírito cura 1 de Vida ao expirar.' },
    ] },
    passo: { char: 'sylvar', name: 'Passo Feérico', cd: 5, desc: 'Teleporta-se na direção da mira, invulnerável por um instante.', mods: [
      { name: 'Ilusão', desc: 'Deixa um clone que atrai os inimigos por 3s e explode (15 de dano).' },
      { name: 'Passos Duplos', desc: 'Acumula 2 cargas.' },
      { name: 'Lâminas de Folha', desc: 'Libera 10 lâminas de folha na origem e no destino.' },
    ] },
    raizes: { char: 'sylvar', name: 'Raízes Prendedoras', cd: 10, desc: 'Raízes irrompem na mira: prendem os inimigos por 2,5s e causam dano contínuo.', mods: [
      { name: 'Espinhos Venenosos', desc: 'Envenena os inimigos presos (4 de dano/s por 4s).' },
      { name: 'Floresta Viva', desc: 'A área permanece por 6s, prendendo quem entrar.' },
      { name: 'Seiva Vital', desc: '+1 de Escudo por inimigo preso (máx. 3).' },
    ] },
    // Kestrus
    tempestade: { char: 'kestrus', name: 'Tempestade de Penas', cd: 8, desc: 'Gira e solta 16 penas afiadas em todas as direções (5 de dano).', mods: [
      { name: 'Espiral', desc: 'Três ondas de penas em espiral.' },
      { name: 'Penas Bumerangue', desc: 'As penas voltam para você, acertando duas vezes.' },
      { name: 'Penas Afiadas', desc: 'As penas atravessam inimigos e causam sangramento.' },
    ] },
    mergulho: { char: 'kestrus', name: 'Mergulho do Falcão', cd: 9, desc: 'Levanta voo (invulnerável) e mergulha na mira: 18 de dano em área.', mods: [
      { name: 'Voo Planado', desc: 'Plana por até 2,5s movendo-se livremente; ative de novo para mergulhar.' },
      { name: 'Garras Trovejantes', desc: 'O impacto solta raios em cadeia em até 5 inimigos.' },
      { name: 'Mergulho Duplo', desc: 'Depois do mergulho, pode mergulhar de novo em até 2s.' },
    ] },
    rajada: { char: 'kestrus', name: 'Rajada de Vento', cd: 7, desc: 'Cone de vento que empurra, causa 4 de dano e destrói projéteis inimigos.', mods: [
      { name: 'Reflexão', desc: 'Em vez de destruir, devolve os projéteis inimigos como seus.' },
      { name: 'Ciclone', desc: 'Lança um tornado que puxa e fere os inimigos.' },
      { name: 'Vento de Cauda', desc: 'Também concede +40% de velocidade e de ataque por 4s.' },
    ] },
    olho: { char: 'kestrus', name: 'Olho de Gavião', cd: 15, desc: 'Por 6s: +40% de crítico e projéteis mais rápidos.', mods: [
      { name: 'Marca da Presa', desc: 'Marca o inimigo mais forte: ele recebe dano em dobro por 8s.' },
      { name: 'Foco Absoluto', desc: 'Durante o efeito, críticos causam 3x em vez de 2x.' },
      { name: 'Caçador Veloz', desc: 'Abates durante o efeito reduzem a recarga da outra habilidade em 2s.' },
    ] },
    // Haldor
    galope: { char: 'haldor', name: 'Galope', cd: 8, desc: 'Dispara a galope por 2,5s com o dobro de velocidade, atropelando inimigos (7 de dano).', mods: [
      { name: 'Estouro da Manada', desc: 'Cavalos espectrais galopam ao seu lado, atropelando também.' },
      { name: 'Ferraduras de Fogo', desc: 'Deixa um rastro de fogo por onde passa.' },
      { name: 'Inabalável', desc: 'Invulnerável durante o galope, mas ele dura 1,6s.' },
    ] },
    coice: { char: 'haldor', name: 'Coice', cd: 6, desc: 'Coice devastador à frente: 20 de dano e empurrão enorme. Quem bate na parede sofre +10.', mods: [
      { name: 'Coice Sísmico', desc: 'Envia uma onda de choque em linha reta.' },
      { name: 'Coice Duplo', desc: 'Acerta à frente e atrás.' },
      { name: 'Casco Atordoante', desc: 'Atordoa os inimigos atingidos por 2s.' },
    ] },
    relincho: { char: 'haldor', name: 'Relincho de Guerra', cd: 18, desc: 'Por 6s: +40% de dano e +30% de velocidade de ataque.', mods: [
      { name: 'Hino dos Bravos', desc: 'Também restaura todo o Escudo.' },
      { name: 'Grito de Pânico', desc: 'Inimigos próximos fogem aterrorizados por 3s.' },
      { name: 'Fúria Equina', desc: 'Dura 9s e cada abate prolonga o efeito em 1s.' },
    ] },
    ferradura: { char: 'haldor', name: 'Ferradura Trovão', cd: 5, desc: 'Arremessa uma ferradura gigante que vai e volta (9 de dano a cada passagem).', mods: [
      { name: 'Corrente Elétrica', desc: 'A ferradura eletrocuta os inimigos próximos pelo caminho.' },
      { name: 'Trio de Ferraduras', desc: 'Arremessa três ferraduras em leque.' },
      { name: 'Ferradura Ímã', desc: 'Puxa os inimigos para a sua trajetória.' },
    ] },
  };

  // ---------------------------------------------------------------- weapons (16)
  // kind: melee (arc swing), thrust (line), ranged (projectiles), cast (spell at the cursor)
  N.WEAPONS = {
    tronco: { name: 'Tronco de Árvore', rarity: 0, kind: 'melee', dmg: 8, rate: 1.7, range: 30, arc: 2.2, knock: 120, owner: 'emberian', sfx: 'heavy', fx: '#ffcf7a', desc: 'Um tronco arrancado com raiz e tudo. Emberian o gira como um porrete.' },
    arco_lunar: { name: 'Arco Lunar', rarity: 0, kind: 'ranged', dmg: 5, rate: 2.7, speed: 280, pierce: 1, proj: 'arrow', owner: 'sylvar', sfx: 'arrow', desc: 'Arco de madeira prateada. As flechas atravessam um inimigo.' },
    penas: { name: 'Penas-Lâmina', rarity: 0, kind: 'ranged', dmg: 3, rate: 3, speed: 250, count: 3, spread: 0.24, life: 0.55, proj: 'feather', owner: 'kestrus', sfx: 'arrow', desc: 'Três penas afiadas arremessadas em leque.' },
    lanca: { name: 'Lança Trovejante', rarity: 0, kind: 'thrust', dmg: 7, rate: 2.1, range: 44, width: 9, knock: 70, zap: 0.2, owner: 'haldor', sfx: 'swing', fx: '#ffe066', desc: 'Estocada longa. 20% de chance de descarregar um raio.' },
    espada_bronze: { name: 'Espada de Bronze', rarity: 0, kind: 'melee', dmg: 6, rate: 3, range: 25, arc: 1.9, knock: 50, sfx: 'swing', fx: '#ffe0a0', desc: 'Simples, rápida e confiável.' },
    funda: { name: 'Funda de Pedras', rarity: 0, kind: 'ranged', dmg: 5, rate: 2.4, speed: 210, bounce: 2, proj: 'stone', sfx: 'shoot', desc: 'Pedras que ricocheteiam nas paredes duas vezes.' },
    machado: { name: 'Machado Duplo de Pedra', rarity: 1, kind: 'melee', dmg: 12, rate: 1.4, range: 31, arc: 2.8, knock: 130, sfx: 'heavy', fx: '#d8d8e0', desc: 'Pesado e largo: acerta tudo ao redor.' },
    besta: { name: 'Besta de Repetição', rarity: 1, kind: 'ranged', dmg: 3, rate: 6.5, speed: 320, spread: 0.08, proj: 'bolt', sfx: 'arrow', desc: 'Dispara virotes sem parar.' },
    cajado_brasa: { name: 'Cajado de Brasa', rarity: 1, kind: 'ranged', dmg: 7, rate: 1.8, speed: 170, explode: 24, burn: true, proj: 'fireball', sfx: 'magic', desc: 'Bolas de fogo que explodem e incendeiam.' },
    cajado_gelo: { name: 'Cajado Gélido', rarity: 1, kind: 'ranged', dmg: 3, rate: 3.6, speed: 240, count: 2, spread: 0.14, slow: true, proj: 'ice', sfx: 'magic', desc: 'Estilhaços de gelo que deixam os inimigos lentos.' },
    martelo: { name: 'Martelo de Meteorito', rarity: 2, kind: 'melee', dmg: 18, rate: 0.95, range: 31, arc: 2.3, knock: 170, shock: true, sfx: 'heavy', fx: '#ff9a4a', desc: 'Cada golpe libera uma pequena onda de choque.' },
    katana: { name: 'Katana do Vento Cortante', rarity: 2, kind: 'melee', dmg: 8, rate: 2.7, range: 28, arc: 2.0, knock: 40, wave: true, sfx: 'swing', fx: '#9ff6ff', desc: 'Cada corte também lança uma lâmina de vento.' },
    orbe: { name: 'Orbe Arcano', rarity: 2, kind: 'ranged', dmg: 5, rate: 3, speed: 150, homing: 5, proj: 'orb', sfx: 'magic', desc: 'Orbes que perseguem o inimigo mais próximo.' },
    tomo: { name: 'Tomo das Raízes', rarity: 2, kind: 'cast', dmg: 10, rate: 1.6, radius: 20, root: 0.35, sfx: 'magic', desc: 'Faz espinhos brotarem na mira; podem prender inimigos.' },
    mosquete: { name: 'Mosquete Rúnico', rarity: 3, kind: 'ranged', dmg: 20, rate: 1.05, speed: 440, pierce: 5, proj: 'rune', sfx: 'gun', desc: 'Um tiro rúnico que atravessa fileiras inteiras.' },
    bacamarte: { name: 'Bacamarte de Cristal', rarity: 3, kind: 'ranged', dmg: 4, rate: 1.5, speed: 250, count: 8, spread: 0.65, speedVar: 0.3, life: 0.7, proj: 'shard', sfx: 'gun', desc: 'Uma explosão de estilhaços do Mundo Reverso.' },
  };

  // ---------------------------------------------------------------- equipment (20)
  N.EQUIPS = {
    coracao: { name: 'Coração de Niryk', rarity: 1, fx: { maxHp: 2 }, desc: '+2 de Vida máxima.' },
    casco: { name: 'Casco de Tartaruga-Rocha', rarity: 0, fx: { maxShield: 2 }, desc: '+2 de Escudo máximo.' },
    botas: { name: 'Botas de Couro de Wyvern', rarity: 0, fx: { speed: 0.15 }, desc: '+15% de velocidade de movimento.' },
    garra: { name: 'Garra Afiada', rarity: 0, fx: { crit: 0.12 }, desc: '+12% de chance de crítico.' },
    luva: { name: 'Manopla de Ferro', rarity: 0, fx: { melee: 0.25 }, desc: '+25% de dano corpo a corpo.' },
    aljava: { name: 'Aljava Encantada', rarity: 0, fx: { ranged: 0.2, projSpeed: 0.2 }, desc: '+20% de dano à distância e projéteis mais rápidos.' },
    ampulheta: { name: 'Ampulheta Quebrada', rarity: 1, fx: { cdr: 0.2 }, desc: '-20% na recarga das habilidades.' },
    tambor: { name: 'Tambor de Guerra', rarity: 1, fx: { atkSpeed: 0.2 }, desc: '+20% de velocidade de ataque.' },
    moeda: { name: 'Moeda da Sorte', rarity: 0, fx: { gold: 0.5, discount: 0.15 }, desc: '+50% de ouro e preços 15% menores.' },
    olho_cristal: { name: 'Olho de Cristal', rarity: 1, fx: { pierce: 1 }, desc: 'Projéteis atravessam +1 inimigo.' },
    amuleto_brasa: { name: 'Amuleto de Brasa', rarity: 1, fx: { burnChance: 0.15 }, desc: 'Ataques têm 15% de chance de incendiar.' },
    cristal_gelo: { name: 'Cristal de Gelo Eterno', rarity: 1, fx: { freezeChance: 0.12 }, desc: 'Ataques têm 12% de chance de congelar por 1s.' },
    chifre_trovao: { name: 'Chifre do Trovão', rarity: 2, fx: { chainChance: 0.12 }, desc: 'Acertos têm 12% de chance de soltar um raio em cadeia.' },
    cacto: { name: 'Couraça de Cacto', rarity: 0, fx: { thorns: 10 }, desc: 'Ao sofrer dano, dispara 10 espinhos ao redor.' },
    lanterna: { name: 'Lanterna Espiritual', rarity: 2, fx: { spiritChance: 0.25 }, desc: 'Inimigos derrotados têm 25% de chance de liberar um espírito teleguiado.' },
    anel_vamp: { name: 'Anel Vampírico', rarity: 2, fx: { vampEvery: 12 }, desc: 'A cada 12 inimigos derrotados, recupera 1 de Vida.' },
    fenix: { name: 'Pena de Fênix', rarity: 3, fx: { revive: 1 }, desc: 'Ao morrer, renasce com metade da Vida (uma vez).' },
    capa: { name: 'Capa das Sombras', rarity: 1, fx: { dashCdr: 0.4, dashBomb: 1 }, desc: 'A esquiva recarrega 40% mais rápido e deixa uma sombra que explode.' },
    ima: { name: 'Pedra-Ímã', rarity: 0, fx: { magnet: 1, maxShield: 1 }, desc: 'Atrai moedas e cristais de longe. +1 de Escudo máximo.' },
    orvalho: { name: 'Frasco de Orvalho', rarity: 1, fx: { roomHeal: 0.25 }, desc: 'Ao limpar uma sala, 25% de chance de recuperar 1 de Vida.' },
  };

  // ---------------------------------------------------------------- blessings (upgrade rooms)
  N.BLESSINGS = [
    { id: 'b_hp', name: 'Bênção da Raiz', desc: '+1 de Vida máxima e cura 1.', fx: { maxHp: 1 }, heal: 1, color: '#ff5a6a' },
    { id: 'b_dmg', name: 'Bênção da Chama', desc: '+12% de dano.', fx: { dmg: 0.12 }, color: '#ff8a3a' },
    { id: 'b_atk', name: 'Bênção do Vento', desc: '+12% de velocidade de ataque.', fx: { atkSpeed: 0.12 }, color: '#9ff6ff' },
    { id: 'b_crit', name: 'Bênção da Lua', desc: '+8% de chance de crítico.', fx: { crit: 0.08 }, color: '#ffe066' },
    { id: 'b_cd', name: 'Bênção do Tempo', desc: '-12% na recarga das habilidades.', fx: { cdr: 0.12 }, color: '#b48cff' },
    { id: 'b_shield', name: 'Bênção da Pedra', desc: '+1 de Escudo máximo.', fx: { maxShield: 1 }, color: '#8fb4d8' },
    { id: 'b_speed', name: 'Bênção do Galope', desc: '+8% de velocidade de movimento.', fx: { speed: 0.08 }, color: '#7cdc6a' },
    { id: 'b_heal', name: 'Bênção do Orvalho', desc: 'Recupera toda a Vida.', heal: 99, color: '#ff9ad0' },
    { id: 'b_abil', name: 'Bênção Arcana', desc: '+25% de dano das habilidades.', fx: { abilDmg: 0.25 }, color: '#c66bff' },
  ];

  // ---------------------------------------------------------------- enemies (6 per world)
  // ai: behaviour key in entities.js; shot: projectile pattern; fly: ignores obstacles.
  N.ENEMIES = {
    // Overworld
    gosmo: { world: 0, name: 'Gosmo', hp: 13, speed: 36, r: 6, ai: 'hopper', touch: 1, desc: 'Uma geleia verde que pula atrás de qualquer coisa que se mexa. Em grupo, cerca a presa.' },
    cogumelo: { world: 0, name: 'Cogumelo Esporeiro', hp: 18, speed: 16, r: 6, ai: 'shooter', shot: { n: 3, spread: 0.35, speed: 85, cd: 2.2 }, desc: 'Fica quietinho até soltar nuvens de esporos em leque.' },
    goblin: { world: 0, name: 'Goblin Lanceiro', hp: 20, speed: 40, r: 6, ai: 'charger', touch: 1, desc: 'Abaixa a lança, grita e corre em linha reta. Bate na parede com frequência.' },
    lobo: { world: 0, name: 'Lobo Cinzento', hp: 22, speed: 64, r: 7, ai: 'lunger', touch: 1, desc: 'Rodeia a presa e dá botes rápidos. Nunca caça sozinho.' },
    kobold: { world: 0, name: 'Arqueiro Kobold', hp: 15, speed: 42, r: 6, ai: 'kiter', shot: { n: 1, speed: 135, cd: 1.7 }, desc: 'Mantém distância e atira flechas de pedra.' },
    besouro: { world: 0, name: 'Besouro-Rocha', hp: 44, speed: 20, r: 8, ai: 'tank', touch: 1, shot: { n: 8, speed: 70, cd: 3.2 }, desc: 'Lento e blindado. De tempos em tempos solta um anel de pedras.' },
    // Mundo Reverso
    imp: { world: 1, name: 'Diabrete Sombrio', hp: 24, speed: 46, r: 6, ai: 'blinker', touch: 1, desc: 'Some numa nuvem de sombra e reaparece ao seu lado com as garras prontas.' },
    olho: { world: 1, name: 'Olho Flutuante', hp: 22, speed: 30, r: 7, ai: 'floater', fly: true, shot: { n: 3, speed: 120, cd: 2, burst: 3 }, desc: 'Vê tudo, invertido. Dispara rajadas de luz roxa.' },
    cavaleiro: { world: 1, name: 'Cavaleiro Espelhado', hp: 58, speed: 30, r: 8, ai: 'knight', touch: 2, desc: 'Seu escudo de espelho bloqueia projéteis vindos da frente. Ataque pelos lados.' },
    morcego: { world: 1, name: 'Morcego do Vazio', hp: 11, speed: 72, r: 5, ai: 'bat', fly: true, touch: 1, desc: 'Voa em zigue-zague e chega sempre em bando.' },
    mago: { world: 1, name: 'Mago Invertido', hp: 28, speed: 30, r: 6, ai: 'caster', shot: { n: 10, speed: 80, cd: 3 }, desc: 'Conjura espirais de projéteis e se teleporta quando acuado.' },
    aranha: { world: 1, name: 'Aranha de Cristal', hp: 26, speed: 50, r: 7, ai: 'jumper', touch: 1, shot: { n: 6, speed: 90 }, desc: 'Salta sobre a presa e espalha estilhaços ao aterrissar.' },
    // Wasteland dos Colossos
    escorpiao: { world: 2, name: 'Escorpião de Ferrugem', hp: 38, speed: 42, r: 7, ai: 'scorpion', touch: 1, shot: { n: 3, spread: 0.3, speed: 120, cd: 2.4 }, desc: 'Persegue e dispara gotas de ácido com a cauda.' },
    verme: { world: 2, name: 'Verme da Areia', hp: 46, speed: 60, r: 8, ai: 'burrower', shot: { n: 10, speed: 85 }, desc: 'Nada sob a areia, intocável, e emerge num anel de pedras.' },
    golem: { world: 2, name: 'Golem de Sucata', hp: 90, speed: 22, r: 10, ai: 'slammer', touch: 2, desc: 'Um amontoado de ferro dos Colossos. Golpeia o chão criando ondas de choque.' },
    poeira: { world: 2, name: 'Espírito de Poeira', hp: 16, speed: 80, r: 5, ai: 'kamikaze', fly: true, desc: 'Um redemoinho ressentido que explode ao chegar perto.' },
    abutre: { world: 2, name: 'Abutre de Ossos', hp: 30, speed: 56, r: 7, ai: 'bomber', fly: true, desc: 'Circula no alto e larga ossos explosivos.' },
    sentinela: { world: 2, name: 'Sentinela Colossal', hp: 70, speed: 0, r: 9, ai: 'turret', shot: { n: 2, speed: 95, cd: 0.16 }, desc: 'Torre antiga que ainda obedece aos Colossos. Gira disparando jatos de energia.' },
  };

  // ---------------------------------------------------------------- bosses
  N.BOSSES = {
    musgo: { world: 0, name: 'Mãe-Musgo', title: 'Guardiã da Floresta Ancestral', hp: 720, r: 18, desc: 'Um golem de pedra e musgo tão antigo quanto o Overworld. Faz o chão tremer, cospe sementes em espiral e chama os Gosmos para protegê-la.' },
    nyxara: { world: 1, name: "Nyx'ara", title: 'O Espelho Partido', hp: 1150, r: 15, desc: 'O reflexo de algo que nunca existiu. Teleporta-se entre cacos de espelho, cria cópias de si mesma e corta a sala com feixes de luz.' },
    kharun: { world: 2, name: 'Kharun', title: 'O Último Colosso', hp: 1700, r: 24, desc: 'A cabeça do último Colosso ainda pensa. Seus punhos de pedra esmagam o chão e seu olho dispara o resto do Núcleo Estelar.' },
  };

  // ---------------------------------------------------------------- worlds
  N.WORLDS = [
    { id: 'overworld', name: 'Overworld', sub: 'A superfície viva de Niryk', enemies: ['gosmo', 'cogumelo', 'goblin', 'lobo', 'kobold', 'besouro'], boss: 'musgo', music: 'overworld', bullet: '#ff6a3a' },
    { id: 'reverso', name: 'Mundo Reverso', sub: 'O reflexo invertido da superfície', enemies: ['imp', 'olho', 'cavaleiro', 'morcego', 'mago', 'aranha'], boss: 'nyxara', music: 'reverso', bullet: '#d05aff' },
    { id: 'wasteland', name: 'Wasteland dos Colossos', sub: 'Onde os gigantes tombaram', enemies: ['escorpiao', 'verme', 'golem', 'poeira', 'abutre', 'sentinela'], boss: 'kharun', music: 'wasteland', bullet: '#ff3a5a' },
  ];
  N.LEVELS_PER_WORLD = 3;

  // ---------------------------------------------------------------- meta upgrades (Altar dos Ancestrais)
  N.UPGRADES = [
    { id: 'vigor', name: 'Vigor', desc: '+1 de Vida máxima', max: 5, cost: 25, color: '#ff5a6a' },
    { id: 'carapaca', name: 'Carapaça', desc: '+1 de Escudo máximo', max: 5, cost: 25, color: '#8fb4d8' },
    { id: 'furia', name: 'Fúria', desc: '+6% de dano', max: 5, cost: 30, color: '#ff8a3a' },
    { id: 'precisao', name: 'Precisão', desc: '+3% de crítico', max: 5, cost: 25, color: '#ffe066' },
    { id: 'agilidade', name: 'Agilidade', desc: '+4% de velocidade', max: 5, cost: 20, color: '#7cdc6a' },
    { id: 'foco', name: 'Foco', desc: '-5% de recarga das habilidades', max: 5, cost: 30, color: '#b48cff' },
    { id: 'fortuna', name: 'Fortuna', desc: '+15 de ouro inicial', max: 5, cost: 20, color: '#ffc53a' },
    { id: 'colheita', name: 'Colheita Estelar', desc: '+10% de cristais obtidos', max: 5, cost: 35, color: '#5fe3d6' },
    { id: 'segunda', name: 'Segunda Chance', desc: 'Começa cada run com uma Poção de Vida', max: 1, cost: 120, color: '#ff9ad0' },
  ];
  N.upgradeCost = (u, lvl) => u.cost * (lvl + 1);

  // ---------------------------------------------------------------- achievements
  N.ACHIEVEMENTS = [
    { id: 'first', name: 'Primeiro Sangue', desc: 'Derrote seu primeiro inimigo.', reward: 5 },
    { id: 'hunter', name: 'Caçador', desc: 'Derrote 250 inimigos no total.', reward: 25 },
    { id: 'slayer', name: 'Exterminador', desc: 'Derrote 1000 inimigos no total.', reward: 60 },
    { id: 'boss_musgo', name: 'Raiz do Mal', desc: 'Derrote a Mãe-Musgo.', reward: 20 },
    { id: 'boss_nyxara', name: 'Espelho Quebrado', desc: "Derrote Nyx'ara.", reward: 35 },
    { id: 'boss_kharun', name: 'Queda do Colosso', desc: 'Derrote Kharun.', reward: 50 },
    { id: 'win', name: 'Lenda de Niryk', desc: 'Reacenda o Núcleo Estelar (vença uma run).', reward: 60 },
    { id: 'win_emberian', name: 'Chama Ancestral', desc: 'Vença uma run com Emberian.', reward: 40 },
    { id: 'win_sylvar', name: 'Flecha Prateada', desc: 'Vença uma run com Sylvar.', reward: 40 },
    { id: 'win_kestrus', name: 'Asas Livres', desc: 'Vença uma run com Kestrus.', reward: 40 },
    { id: 'win_haldor', name: 'Galope Final', desc: 'Vença uma run com Haldor.', reward: 40 },
    { id: 'collector', name: 'Colecionador', desc: 'Tenha 8 equipamentos numa mesma run.', reward: 25 },
    { id: 'arsenal', name: 'Arsenal Completo', desc: 'Descubra as 16 armas no Códice.', reward: 40 },
    { id: 'scholar', name: 'Estudioso', desc: 'Descubra todos os monstros no Códice.', reward: 40 },
    { id: 'flawless', name: 'Intocável', desc: 'Derrote um chefe sem perder Vida.', reward: 40 },
    { id: 'tycoon', name: 'Magnata', desc: 'Tenha 300 de ouro ao mesmo tempo.', reward: 20 },
    { id: 'ascend', name: 'Ascensão', desc: 'Compre 20 níveis no Altar dos Ancestrais.', reward: 50 },
    { id: 'dragon', name: 'Dragão Desperto', desc: 'Derrote 30 inimigos na forma dracônica.', reward: 25 },
  ];

  // Give every entry its own key as id.
  for (const table of [N.CHARS, N.ABILITIES, N.WEAPONS, N.EQUIPS, N.ENEMIES, N.BOSSES]) for (const k in table) table[k].id = k;
})();
