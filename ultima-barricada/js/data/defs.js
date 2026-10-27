// Single source of truth for game content and balance numbers. Simulation, renderer and UI
// all read from here, so tuning happens in one place.
(function (UB) {
  'use strict';

  // Fixed simulation step (seconds) and day cycle lengths at 1x speed.
  const TIME = { TICK: 0.05, DAY: 210, DAY1: 300, DUSK: 30, NIGHT: 120 };

  // Terrain types (Uint8 per tile). cost = movement cost multiplier; block = impassable.
  const T = { GRASS: 0, DIRT: 1, ASPHALT: 2, SIDEWALK: 3, CONCRETE: 4, FOREST: 5, WATER: 6, RUBBLE: 7, FARM: 8, TOXIC: 9, BRIDGE: 10, FLOOR: 11 };
  const TERRAIN = [
    { key: 'grass', name: 'Grama', cost: 1 },
    { key: 'dirt', name: 'Terra', cost: 1 },
    { key: 'asphalt', name: 'Asfalto', cost: 0.85 },
    { key: 'sidewalk', name: 'Calçada', cost: 0.9 },
    { key: 'concrete', name: 'Concreto', cost: 0.9 },
    { key: 'forest', name: 'Mata', cost: 1.25 },
    { key: 'water', name: 'Água', cost: 1, block: true },
    { key: 'rubble', name: 'Entulho', cost: 1.35 },
    { key: 'farm', name: 'Plantação', cost: 1.15 },
    { key: 'toxic', name: 'Vazamento tóxico', cost: 1.3, hazard: 6 },
    { key: 'bridge', name: 'Ponte', cost: 0.9 },
    { key: 'floor', name: 'Piso', cost: 1 },
  ];

  // Map features (one per tile). res/amt: what gathering yields; block: impassable.
  const F = { NONE: 0, TREE: 1, PINE: 2, DEADTREE: 3, BUSH: 4, CAR: 5, DEBRIS: 6, CRATE: 7, FENCE: 8, ROCK: 9, FIRE: 10, BARRIER: 11, CONTAINER: 12 };
  const FEATURE = [
    null,
    { key: 'tree', name: 'Árvore', block: true, res: 'wood', amt: [18, 30], rate: 0.75 },
    { key: 'pine', name: 'Pinheiro', block: true, res: 'wood', amt: [22, 34], rate: 0.75 },
    { key: 'deadtree', name: 'Árvore morta', block: true, res: 'wood', amt: [8, 14], rate: 0.9 },
    { key: 'bush', name: 'Arbusto', cost: 1.4 },
    { key: 'car', name: 'Carro abandonado', block: true, res: 'scrap', amt: [24, 40], rate: 0.55, bonus: ['fuel', 3, 8] },
    { key: 'debris', name: 'Destroços', cost: 1.3, res: 'scrap', amt: [8, 16], rate: 0.8, bonus: ['wood', 2, 6] },
    { key: 'crate', name: 'Caixa de suprimentos', pickup: true },
    { key: 'fence', name: 'Cerca', block: true },
    { key: 'rock', name: 'Rocha', block: true },
    { key: 'fire', name: 'Fogo', hazard: 10, light: 5 },
    { key: 'barrier', name: 'Barreira de concreto', block: true },
    { key: 'container', name: 'Contêiner', block: true, res: 'scrap', amt: [30, 50], rate: 0.5 },
  ];

  const RES = ['food', 'wood', 'scrap', 'ammo', 'fuel', 'meds'];
  const RES_NAME = { food: 'Comida', wood: 'Madeira', scrap: 'Sucata', ammo: 'Munição', fuel: 'Combustível', meds: 'Remédios' };

  const WEAPONS = {
    bat: { name: 'Taco', range: 1.2, dmg: 14, cd: 0.9, ammo: 0, noise: 2, acc: 0.95, melee: true },
    pistol: { name: 'Pistola', range: 6, dmg: 14, cd: 0.6, ammo: 1, noise: 10, acc: 0.78 },
    shotgun: { name: 'Espingarda', range: 4.5, dmg: 10, pellets: 5, cone: 0.4, cd: 1.15, ammo: 1, noise: 14, acc: 0.85 },
    rifle: { name: 'Rifle', range: 9, dmg: 34, cd: 1.3, ammo: 1, noise: 16, acc: 0.9, pierce: true },
  };

  const ROLES = {
    soldier: { name: 'Soldado', hp: 120, speed: 2.1, acc: 0.1, build: 1, gather: 1, loot: 1, weapon: 'shotgun', vision: 8, desc: 'Mais vida e precisão. Começa com espingarda.' },
    scout: { name: 'Batedor', hp: 95, speed: 2.7, acc: 0, build: 1, gather: 1, loot: 1.6, weapon: 'pistol', vision: 11, desc: 'Rápido, enxerga longe e saqueia mais depressa.' },
    engineer: { name: 'Engenheiro', hp: 100, speed: 2.1, acc: 0, build: 2, gather: 1.3, loot: 1, weapon: 'pistol', vision: 8, desc: 'Constrói e repara 2× mais rápido; coleta melhor.' },
    medic: { name: 'Médico', hp: 100, speed: 2.2, acc: 0, build: 1, gather: 1, loot: 1, weapon: 'pistol', vision: 8, heal: 1.5, desc: 'Cura aliados próximos e trata mordidas com remédios.' },
  };
  const RANKS = [
    { name: 'Novato', xp: 0, acc: 0, hp: 0 },
    { name: 'Veterano', xp: 12, acc: 0.07, hp: 15 },
    { name: 'Elite', xp: 35, acc: 0.14, hp: 30 },
  ];

  // Zombies. cost = horde budget points; from = first night they appear in hordes.
  const ZOMBIES = {
    walker: { name: 'Errante', hp: 24, speed: 0.85, dmg: 6, cd: 1.2, cost: 1, from: 1, bite: 0.04, sight: 6, struct: 0.7 },
    runner: { name: 'Corredor', hp: 22, speed: 2.4, dmg: 5, cd: 0.8, cost: 1.5, from: 3, bite: 0.04, sight: 8, struct: 0.8 },
    bloater: { name: 'Inchado', hp: 55, speed: 0.7, dmg: 6, cd: 1.4, cost: 3, from: 5, bite: 0.05, sight: 5, struct: 1, explode: { r: 1.9, dmg: 45 } },
    brute: { name: 'Brutamontes', hp: 320, speed: 0.75, dmg: 22, cd: 1.6, cost: 6, from: 6, bite: 0.1, sight: 6, struct: 3 },
    spitter: { name: 'Cuspidor', hp: 45, speed: 0.9, dmg: 10, cd: 2.6, cost: 4, from: 8, bite: 0.05, sight: 8, struct: 1, range: 5 },
    screamer: { name: 'Gritador', hp: 60, speed: 1.2, dmg: 4, cd: 1.2, cost: 5, from: 10, bite: 0.05, sight: 8, struct: 0.6, scream: { cd: 9, r: 16, buff: 0.35, dur: 5 } },
    armored: { name: 'Blindado', hp: 90, speed: 0.85, dmg: 8, cd: 1.2, cost: 4, from: 12, bite: 0.07, sight: 6, struct: 1.2, armor: 0.5 },
    colossus: { name: 'Colosso', hp: 1400, speed: 0.6, dmg: 40, cd: 2, cost: 25, from: 5, bite: 0.15, sight: 7, struct: 4, boss: true },
  };

  // Player structures. levels[i]: cost to reach that level (level 1 = build cost), hp and effect values.
  const BUILDINGS = {
    hq: { name: 'QG', size: 3, cat: 'base', desc: 'Coração da base: estoque, camas e território. Se cair, a partida acaba.',
      levels: [
        { cost: {}, hp: 2500, cap: 150, beds: 4, territory: 12 },
        { cost: { wood: 80, scrap: 60 }, hp: 3600, cap: 250, beds: 5, territory: 16 },
        { cost: { wood: 150, scrap: 150, fuel: 20 }, hp: 5000, cap: 400, beds: 6, territory: 20 },
      ], vision: 9, light: 6 },
    barricade: { name: 'Barricada', size: 1, cat: 'defense', key: 'z', desc: 'Barata e rápida. Bloqueia o caminho dos zumbis.',
      levels: [{ cost: { wood: 20 }, hp: 160 }, { cost: { wood: 20 }, hp: 260 }, { cost: { wood: 30, scrap: 10 }, hp: 400 }] },
    wall: { name: 'Muro', size: 1, cat: 'defense', key: 'm', desc: 'Resistente. Forma o perímetro da base.',
      levels: [{ cost: { wood: 10, scrap: 15 }, hp: 450 }, { cost: { scrap: 25 }, hp: 700 }, { cost: { scrap: 40 }, hp: 1000 }] },
    gate: { name: 'Portão', size: 1, cat: 'defense', key: 'g', desc: 'Sobreviventes passam, zumbis não. É o alvo preferido das hordas.',
      levels: [{ cost: { wood: 20, scrap: 20 }, hp: 350 }, { cost: { scrap: 25 }, hp: 550 }, { cost: { scrap: 40 }, hp: 800 }] },
    tower: { name: 'Torre de vigia', size: 1, cat: 'defense', key: 't', desc: 'Guarnição de 2 atiradores: +2 de alcance, −60% de dano recebido, visão ampla.',
      levels: [{ cost: { wood: 40, scrap: 10 }, hp: 300, slots: 2, range: 2 }, { cost: { wood: 30, scrap: 20 }, hp: 420, slots: 2, range: 3 }, { cost: { scrap: 40 }, hp: 600, slots: 3, range: 3 }], vision: 11 },
    turret: { name: 'Metralhadora', size: 1, cat: 'defense', key: 'k', requires: 'bp_turret', desc: 'Atira sozinha. Requer energia e gasta munição do estoque.',
      levels: [{ cost: { scrap: 30, wood: 10 }, hp: 220, power: 2, range: 7, dmg: 8, cd: 0.25 }, { cost: { scrap: 35 }, hp: 300, power: 2, range: 7.5, dmg: 11, cd: 0.22 }, { cost: { scrap: 50, fuel: 5 }, hp: 400, power: 3, range: 8, dmg: 14, cd: 0.2 }], vision: 7 },
    spotlight: { name: 'Holofote', size: 1, cat: 'defense', key: 'l', requires: 'bp_spotlight', desc: 'Ilumina a noite: precisão e visão normais na área. Requer energia.',
      levels: [{ cost: { scrap: 15, wood: 5 }, hp: 120, power: 1, light: 6 }, { cost: { scrap: 15 }, hp: 160, power: 1, light: 8 }, { cost: { scrap: 25 }, hp: 220, power: 1, light: 10 }] },
    spikes: { name: 'Armadilha de espinhos', size: 1, cat: 'defense', key: 'x', walkable: true, desc: 'Passável. Fere e atrasa os zumbis que pisam nela; perde resistência a cada golpe.',
      levels: [{ cost: { wood: 10, scrap: 5 }, hp: 120, dps: 14 }, { cost: { scrap: 10 }, hp: 180, dps: 20 }, { cost: { scrap: 15 }, hp: 260, dps: 28 }] },
    shelter: { name: 'Abrigo', size: 2, cat: 'base', key: 'a', desc: 'Camas para mais sobreviventes. Quem descansa na base se cura devagar.',
      levels: [{ cost: { wood: 40, scrap: 10 }, hp: 400, beds: 4 }, { cost: { wood: 40, scrap: 20 }, hp: 550, beds: 6 }, { cost: { wood: 50, scrap: 40 }, hp: 700, beds: 8 }] },
    depot: { name: 'Depósito', size: 2, cat: 'base', key: 'd', desc: 'Aumenta o limite de estoque de todos os recursos.',
      levels: [{ cost: { wood: 50, scrap: 10 }, hp: 500, cap: 150 }, { cost: { wood: 40, scrap: 30 }, hp: 650, cap: 250 }, { cost: { wood: 50, scrap: 60 }, hp: 800, cap: 400 }] },
    workshop: { name: 'Oficina', size: 2, cat: 'prod', key: 'o', desc: 'Trabalhadores transformam sucata em munição. Fabrica armas e libera projetos.',
      levels: [{ cost: { wood: 40, scrap: 30 }, hp: 450, workers: 1, power: 1 }, { cost: { wood: 30, scrap: 50 }, hp: 550, workers: 2, power: 1 }, { cost: { scrap: 80, fuel: 10 }, hp: 700, workers: 2, power: 1 }] },
    garden: { name: 'Horta', size: 2, cat: 'prod', key: 'h', desc: 'Trabalhadores cultivam comida. Cada um produz cerca de 8 por dia (cada sobrevivente come 3).',
      levels: [{ cost: { wood: 30 }, hp: 250, workers: 2, mult: 1 }, { cost: { wood: 30, scrap: 10 }, hp: 320, workers: 2, mult: 1.5 }, { cost: { wood: 40, scrap: 20, meds: 2 }, hp: 400, workers: 3, mult: 1.8 }] },
    generator: { name: 'Gerador', size: 2, cat: 'prod', key: 'e', desc: 'Queima combustível para gerar energia. Pode ser desligado para poupar.',
      levels: [{ cost: { wood: 20, scrap: 40 }, hp: 350, supply: 6, burn: 60 }, { cost: { scrap: 40 }, hp: 450, supply: 9, burn: 55 }, { cost: { scrap: 60, fuel: 10 }, hp: 550, supply: 12, burn: 50 }] },
    infirmary: { name: 'Enfermaria', size: 2, cat: 'prod', key: 'i', desc: 'Pacientes se curam rápido; trata mordidas gastando remédios. Requer energia.',
      levels: [{ cost: { wood: 40, scrap: 20, meds: 2 }, hp: 350, power: 2, patients: 2, heal: 4 }, { cost: { scrap: 30, meds: 3 }, hp: 450, power: 2, patients: 3, heal: 6 }, { cost: { scrap: 40, meds: 5 }, hp: 550, power: 2, patients: 4, heal: 9 }] },
    radio: { name: 'Rádio', size: 2, cat: 'prod', key: 'r', requires: 'bp_radio', desc: 'Atrai refugiados todo amanhecer, mas o chiado atrai zumbis à noite. Requer energia.',
      levels: [{ cost: { scrap: 30, wood: 10, fuel: 5 }, hp: 300, power: 1, chance: 0.45 }, { cost: { scrap: 30 }, hp: 380, power: 1, chance: 0.6 }, { cost: { scrap: 40, fuel: 5 }, hp: 450, power: 1, chance: 0.75 }] },
  };
  const BUILD_ORDER = ['barricade', 'wall', 'gate', 'tower', 'spikes', 'turret', 'spotlight', 'shelter', 'depot', 'garden', 'workshop', 'generator', 'infirmary', 'radio'];
  // Items crafted at the workshop (go to the armory, then equipped from the survivor panel).
  const CRAFT = {
    shotgun: { name: 'Espingarda', cost: { scrap: 20, wood: 6 }, level: 2, time: 20 },
    rifle: { name: 'Rifle', cost: { scrap: 35, wood: 8, fuel: 2 }, level: 3, time: 30 },
  };
  const BLUEPRINTS = {
    bp_turret: 'Projeto: Metralhadora',
    bp_spotlight: 'Projeto: Holofote',
    bp_radio: 'Projeto: Rádio',
  };

  // Points of interest. loot: [res, min, max, chance]; guards: zombie mix spawned at generation.
  const POIS = {
    house: { name: 'Casa', size: [3, 3], searches: 2, time: 8, danger: 1, guards: { walker: 1 },
      loot: [['food', 2, 6, 0.85], ['wood', 2, 6, 0.6], ['scrap', 2, 6, 0.6], ['ammo', 3, 8, 0.45], ['meds', 1, 2, 0.25]], desc: 'Pouco de tudo, risco baixo.' },
    pharmacy: { name: 'Farmácia', size: [3, 3], searches: 2, time: 10, danger: 2, guards: { walker: 1 },
      loot: [['meds', 3, 6, 1], ['food', 1, 3, 0.4]], desc: 'Remédios.' },
    market: { name: 'Supermercado', size: [5, 4], searches: 4, time: 12, danger: 2, guards: { walker: 1, runner: 0.3 },
      loot: [['food', 10, 20, 1], ['meds', 1, 2, 0.2]], desc: 'Muita comida.' },
    warehouse: { name: 'Armazém', size: [6, 4], searches: 4, time: 14, danger: 2, guards: { walker: 1 },
      loot: [['food', 4, 10, 0.7], ['scrap', 8, 15, 0.9], ['wood', 5, 12, 0.8]], desc: 'Comida, sucata e madeira.' },
    hardware: { name: 'Loja de ferragens', size: [4, 3], searches: 3, time: 12, danger: 2, guards: { walker: 1 },
      loot: [['scrap', 10, 18, 1], ['wood', 8, 14, 0.9]], special: 'bp_spotlight', desc: 'Sucata, madeira e o projeto do holofote.' },
    gas: { name: 'Posto de combustível', size: [4, 3], searches: 3, time: 12, danger: 3, guards: { walker: 1, runner: 0.4 }, explosive: true,
      loot: [['fuel', 10, 20, 1], ['food', 2, 5, 0.5]], desc: 'Muito combustível. Tiros perto das bombas podem causar uma explosão.' },
    police: { name: 'Delegacia', size: [5, 4], searches: 4, time: 15, danger: 4, guards: { walker: 1, armored: 0.6 },
      loot: [['ammo', 25, 45, 1], ['scrap', 3, 8, 0.4]], special: 'police', desc: 'Munição, armas e projetos (metralhadora e rádio).' },
    hospital: { name: 'Hospital', size: [6, 5], searches: 5, time: 16, danger: 5, guards: { walker: 1, runner: 0.4, spitter: 0.25 },
      loot: [['meds', 6, 12, 1], ['food', 2, 5, 0.4]], recruit: 0.25, desc: 'Muitos remédios e talvez um médico, mas está infestado.' },
    factory: { name: 'Fábrica', size: [6, 6], searches: 5, time: 15, danger: 3, guards: { walker: 1, brute: 0.12 },
      loot: [['scrap', 15, 25, 1], ['fuel', 4, 10, 0.6]], desc: 'Sucata em quantidade e combustível.' },
    farmhouse: { name: 'Fazenda', size: [4, 3], searches: 3, time: 10, danger: 1, guards: { walker: 1 },
      loot: [['food', 8, 14, 1], ['wood', 4, 8, 0.6]], desc: 'Comida e madeira, longe de tudo.' },
    camp: { name: 'Acampamento', size: [3, 3], searches: 1, time: 10, danger: 2, guards: { walker: 1, runner: 0.3 },
      loot: [['food', 2, 6, 0.6]], recruitCamp: true, desc: 'Sobreviventes cercados. Resgate-os se houver camas.' },
    ruin: { name: 'Ruína', size: [4, 4], searches: 1, time: 10, danger: 1, guards: { walker: 1 },
      loot: [['scrap', 6, 12, 1], ['wood', 4, 10, 0.8]], desc: 'Prédio desabado. Destroços aproveitáveis.' },
    nest: { name: 'Ninho', size: [2, 2], searches: 0, time: 0, danger: 4, guards: { walker: 1, runner: 0.4 }, nest: true, hp: 450,
      loot: [], desc: 'Massa pulsante que gera zumbis até ser destruída. Ataque-a.' },
  };

  const DIFFICULTY = {
    easy: { name: 'Fácil', horde: 0.7, zhp: 0.85, start: 1.4, wander: 0.8 },
    normal: { name: 'Normal', horde: 1, zhp: 1, start: 1, wander: 1 },
    hard: { name: 'Difícil', horde: 1.35, zhp: 1.15, start: 0.85, wander: 1.2 },
    nightmare: { name: 'Pesadelo', horde: 1.8, zhp: 1.3, start: 0.7, wander: 1.5 },
  };

  const WEATHER = {
    clear: { name: 'Limpo', noise: 1, vision: 1 },
    rain: { name: 'Chuva', noise: 0.7, vision: 0.85 },
    fog: { name: 'Neblina', noise: 1, vision: 0.6 },
  };

  // Assorted balance constants.
  const BAL = {
    mapSize: 128,
    startRes: { food: 40, wood: 70, scrap: 40, ammo: 120, fuel: 10, meds: 3 },
    startRoles: ['soldier', 'scout', 'engineer', 'medic'],
    eatPerDay: 3,
    carryCap: 20,
    backpackCap: 40,
    pocketAmmo: 30,
    gardenFoodEvery: 45,     // seconds per food per worker at mult 1
    workshopCycle: 20,       // seconds per ammo batch per worker
    workshopBatch: { scrap: 2, ammo: 6 },
    buildRate: 9,            // build points per second (×role build, ×morale)
    repairRate: 12,          // hp per second
    repairCostFactor: 0.5,   // fraction of build cost to repair from 0 to full
    demolishRefund: 0.5,
    infectTime: 300,         // seconds until a bitten survivor turns
    restHeal: 0.6,           // hp/s at base with a shelter
    maxZombies: 600,
    wanderBase: 35,
    wanderPerDay: 9,
    wanderMax: 240,
    nestEvery: 40,
    nestCap: 8,
    baseSafeRadius: 22,
    moraleStart: 70,
    score: { night: 1000, kill: 10, loot: 50, alive: 200, nest: 500 },
  };

  const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Kátia', 'Lucas', 'Marta', 'Nando', 'Olívia', 'Paulo', 'Quitéria', 'Rafa', 'Sara', 'Tiago', 'Úrsula', 'Vítor', 'Wanda', 'Yuri', 'Zé', 'Bia', 'Caio', 'Dora', 'Edu', 'Flor', 'Guto', 'Lia', 'Maju', 'Nina', 'Otto', 'Pietra', 'Renan', 'Sol', 'Téo', 'Vera'];
  const LAST_NAMES = ['Silva', 'Souza', 'Costa', 'Lima', 'Rocha', 'Alves', 'Pereira', 'Nunes', 'Ramos', 'Teixeira', 'Barros', 'Moura', 'Freitas', 'Cardoso', 'Pinto', 'Duarte', 'Farias', 'Macedo', 'Queiroz', 'Vieira'];

  UB.DEF = { TIME, T, TERRAIN, F, FEATURE, RES, RES_NAME, WEAPONS, ROLES, RANKS, ZOMBIES, BUILDINGS, BUILD_ORDER, CRAFT, BLUEPRINTS, POIS, DIFFICULTY, WEATHER, BAL, FIRST_NAMES, LAST_NAMES };
})(globalThis.UB = globalThis.UB || {});
