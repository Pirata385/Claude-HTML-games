// Single source of truth for game content and balance numbers. Simulation, renderer and UI
// all read from here, so tuning happens in one place. Names and descriptions shown to the player
// live in the dictionaries (js/i18n/*.js), keyed by these ids.
(function (UB) {
  'use strict';

  // Fixed simulation step (seconds) and day cycle lengths at 1x speed.
  const TIME = { TICK: 0.05, DAY: 210, DAY1: 300, DUSK: 30, NIGHT: 120 };

  // Terrain types (Uint8 per tile). cost = movement cost multiplier; block = impassable.
  const T = { GRASS: 0, DIRT: 1, ASPHALT: 2, SIDEWALK: 3, CONCRETE: 4, FOREST: 5, WATER: 6, RUBBLE: 7, FARM: 8, TOXIC: 9, BRIDGE: 10, FLOOR: 11 };
  const TERRAIN = [
    { key: 'grass', cost: 1 },
    { key: 'dirt', cost: 1 },
    { key: 'asphalt', cost: 0.85 },
    { key: 'sidewalk', cost: 0.9 },
    { key: 'concrete', cost: 0.9 },
    { key: 'forest', cost: 1.25 },
    { key: 'water', cost: 1, block: true },
    { key: 'rubble', cost: 1.35 },
    { key: 'farm', cost: 1.15 },
    { key: 'toxic', cost: 1.3, hazard: 6 },
    { key: 'bridge', cost: 0.9 },
    { key: 'floor', cost: 1 },
  ];

  // Map features (one per tile). res/amt: what gathering yields; block: impassable.
  const F = { NONE: 0, TREE: 1, PINE: 2, DEADTREE: 3, BUSH: 4, CAR: 5, DEBRIS: 6, CRATE: 7, FENCE: 8, ROCK: 9, FIRE: 10, BARRIER: 11, CONTAINER: 12 };
  const FEATURE = [
    null,
    { key: 'tree', block: true, res: 'wood', amt: [18, 30], rate: 0.75 },
    { key: 'pine', block: true, res: 'wood', amt: [22, 34], rate: 0.75 },
    { key: 'deadtree', block: true, res: 'wood', amt: [8, 14], rate: 0.9 },
    { key: 'bush', cost: 1.4 },
    { key: 'car', block: true, res: 'scrap', amt: [30, 50], rate: 0.6, bonus: ['fuel', 3, 8] },
    { key: 'debris', cost: 1.3, res: 'scrap', amt: [10, 18], rate: 0.8, bonus: ['wood', 2, 6] },
    { key: 'crate', pickup: true },
    { key: 'fence', block: true },
    { key: 'rock', block: true },
    { key: 'fire', hazard: 10, light: 5 },
    { key: 'barrier', block: true },
    { key: 'container', block: true, res: 'scrap', amt: [30, 50], rate: 0.5 },
  ];

  const RES = ['food', 'wood', 'scrap', 'ammo', 'fuel', 'meds'];

  const WEAPONS = {
    bat: { range: 1.2, dmg: 14, cd: 0.9, ammo: 0, noise: 2, acc: 0.95, melee: true },
    pistol: { range: 6, dmg: 14, cd: 0.6, ammo: 1, noise: 10, acc: 0.78 },
    shotgun: { range: 4.5, dmg: 10, pellets: 5, cone: 0.4, cd: 1.15, ammo: 1, noise: 14, acc: 0.85 },
    rifle: { range: 9, dmg: 34, cd: 1.3, ammo: 1, noise: 16, acc: 0.9, pierce: true },
  };

  const ROLES = {
    soldier: { hp: 120, speed: 2.1, acc: 0.1, build: 1, gather: 1, loot: 1, weapon: 'shotgun', vision: 8 },
    scout: { hp: 95, speed: 2.7, acc: 0, build: 1, gather: 1, loot: 1.6, weapon: 'pistol', vision: 11 },
    engineer: { hp: 100, speed: 2.1, acc: 0, build: 2, gather: 1.3, loot: 1, weapon: 'pistol', vision: 8 },
    medic: { hp: 100, speed: 2.2, acc: 0, build: 1, gather: 1, loot: 1, weapon: 'pistol', vision: 8, heal: 1.5 },
  };
  const RANKS = [
    { xp: 0, acc: 0, hp: 0 },
    { xp: 12, acc: 0.07, hp: 15 },
    { xp: 35, acc: 0.14, hp: 30 },
  ];

  // Zombies. cost = horde budget points; from = first night they appear in hordes.
  const ZOMBIES = {
    walker: { hp: 24, speed: 0.85, dmg: 6, cd: 1.2, cost: 1, from: 1, bite: 0.04, sight: 6, struct: 0.7 },
    runner: { hp: 22, speed: 2.4, dmg: 5, cd: 0.8, cost: 1.5, from: 3, bite: 0.04, sight: 8, struct: 0.8 },
    bloater: { hp: 55, speed: 0.7, dmg: 6, cd: 1.4, cost: 3, from: 5, bite: 0.05, sight: 5, struct: 1, explode: { r: 1.9, dmg: 45 } },
    brute: { hp: 320, speed: 0.75, dmg: 22, cd: 1.6, cost: 6, from: 6, bite: 0.1, sight: 6, struct: 3 },
    spitter: { hp: 45, speed: 0.9, dmg: 10, cd: 2.6, cost: 4, from: 8, bite: 0.05, sight: 8, struct: 1, range: 5 },
    screamer: { hp: 60, speed: 1.2, dmg: 4, cd: 1.2, cost: 5, from: 10, bite: 0.05, sight: 8, struct: 0.6, scream: { cd: 9, r: 16, buff: 0.35, dur: 5 } },
    armored: { hp: 90, speed: 0.85, dmg: 8, cd: 1.2, cost: 4, from: 12, bite: 0.07, sight: 6, struct: 1.2, armor: 0.5 },
    crawler: { hp: 16, speed: 1.25, dmg: 5, cd: 1, cost: 1, from: 2, bite: 0.06, sight: 5, struct: 0.6, evade: 0.35 },
    leaper: { hp: 40, speed: 1.5, dmg: 7, cd: 1.1, cost: 3, from: 7, bite: 0.05, sight: 8, struct: 0.8, leap: { cd: 7, dist: 2.2 } },
    toxic: { hp: 50, speed: 0.8, dmg: 6, cd: 1.3, cost: 3, from: 9, bite: 0.05, sight: 6, struct: 0.8, aura: { r: 1.6, dps: 3 }, cloud: { r: 1.8, dps: 5, time: 8 } },
    colossus: { hp: 1400, speed: 0.6, dmg: 40, cd: 2, cost: 25, from: 10, bite: 0.15, sight: 7, struct: 4, boss: true },
  };

  // Player structures. levels[i]: cost to reach that level (level 1 = build cost), hp and effect values.
  const BUILDINGS = {
    hq: { size: 3, cat: 'base',
      levels: [
        { cost: {}, hp: 4000, cap: 150, beds: 4, territory: 12, slots: 2, range: 1 },
        { cost: { wood: 80, scrap: 60 }, hp: 6000, cap: 250, beds: 5, territory: 16, slots: 3, range: 1 },
        { cost: { wood: 150, scrap: 150, fuel: 20 }, hp: 8500, cap: 400, beds: 6, territory: 20, slots: 4, range: 2 },
      ], vision: 9, light: 6 },
    barricade: { size: 1, cat: 'defense', key: 'z',
      levels: [{ cost: { wood: 20 }, hp: 160 }, { cost: { wood: 20 }, hp: 260 }, { cost: { wood: 30, scrap: 10 }, hp: 400 }] },
    wall: { size: 1, cat: 'defense', key: 'm',
      levels: [{ cost: { wood: 10, scrap: 15 }, hp: 450 }, { cost: { scrap: 25 }, hp: 700 }, { cost: { scrap: 40 }, hp: 1000 }] },
    gate: { size: 1, cat: 'defense', key: 'g',
      levels: [{ cost: { wood: 20, scrap: 20 }, hp: 350 }, { cost: { scrap: 25 }, hp: 550 }, { cost: { scrap: 40 }, hp: 800 }] },
    tower: { size: 1, cat: 'defense', key: 't',
      levels: [{ cost: { wood: 40, scrap: 10 }, hp: 300, slots: 2, range: 2 }, { cost: { wood: 30, scrap: 20 }, hp: 420, slots: 2, range: 3 }, { cost: { scrap: 40 }, hp: 600, slots: 3, range: 3 }], vision: 11 },
    turret: { size: 1, cat: 'defense', key: 'k', requires: 'bp_turret',
      levels: [{ cost: { scrap: 30, wood: 10 }, hp: 220, power: 2, range: 7, dmg: 8, cd: 0.25 }, { cost: { scrap: 35 }, hp: 300, power: 2, range: 7.5, dmg: 11, cd: 0.22 }, { cost: { scrap: 50, fuel: 5 }, hp: 400, power: 3, range: 8, dmg: 14, cd: 0.2 }], vision: 7 },
    spotlight: { size: 1, cat: 'defense', key: 'l', requires: 'bp_spotlight',
      levels: [{ cost: { scrap: 15, wood: 5 }, hp: 120, power: 1, light: 6 }, { cost: { scrap: 15 }, hp: 160, power: 1, light: 8 }, { cost: { scrap: 25 }, hp: 220, power: 1, light: 10 }] },
    spikes: { size: 1, cat: 'defense', key: 'x', walkable: true,
      levels: [{ cost: { wood: 10, scrap: 5 }, hp: 120, dps: 14 }, { cost: { scrap: 10 }, hp: 180, dps: 20 }, { cost: { scrap: 15 }, hp: 260, dps: 28 }] },
    mine: { size: 1, cat: 'defense', key: 'n', walkable: true,
      levels: [{ cost: { scrap: 10, fuel: 2 }, hp: 60, dmg: 80, r: 1.6 }, { cost: { scrap: 10, fuel: 2 }, hp: 80, dmg: 110, r: 1.8 }, { cost: { scrap: 15, fuel: 3 }, hp: 100, dmg: 150, r: 2.1 }] },
    flamer: { size: 1, cat: 'defense', key: 'f', requires: 'bp_flamer',
      levels: [{ cost: { scrap: 35, fuel: 10 }, hp: 260, range: 3.5, dmg: 7, cd: 0.4, fuelEvery: 10 }, { cost: { scrap: 30, fuel: 5 }, hp: 340, range: 4, dmg: 10, cd: 0.4, fuelEvery: 12 }, { cost: { scrap: 45, fuel: 10 }, hp: 450, range: 4.5, dmg: 13, cd: 0.35, fuelEvery: 14 }], vision: 6 },
    shelter: { size: 2, cat: 'base', key: 'a',
      levels: [{ cost: { wood: 40, scrap: 10 }, hp: 400, beds: 4 }, { cost: { wood: 40, scrap: 20 }, hp: 550, beds: 6 }, { cost: { wood: 50, scrap: 40 }, hp: 700, beds: 8 }] },
    depot: { size: 2, cat: 'base', key: 'd',
      levels: [{ cost: { wood: 50, scrap: 10 }, hp: 500, cap: 150 }, { cost: { wood: 40, scrap: 30 }, hp: 650, cap: 250 }, { cost: { wood: 50, scrap: 60 }, hp: 800, cap: 400 }] },
    canteen: { size: 2, cat: 'base', key: 'c',
      levels: [{ cost: { wood: 40, scrap: 15 }, hp: 380, save: 0.2, morale: 3 }, { cost: { wood: 30, scrap: 25 }, hp: 480, save: 0.3, morale: 5 }, { cost: { wood: 40, scrap: 40, fuel: 5 }, hp: 600, save: 0.4, morale: 7 }] },
    training: { size: 2, cat: 'base', key: 'p',
      levels: [{ cost: { wood: 35, scrap: 20 }, hp: 300, xp: 2 }, { cost: { wood: 30, scrap: 30 }, hp: 380, xp: 3 }, { cost: { scrap: 50, ammo: 20 }, hp: 460, xp: 4.5 }] },
    workshop: { size: 2, cat: 'prod', key: 'o',
      levels: [{ cost: { wood: 40, scrap: 30 }, hp: 450, workers: 1, power: 1 }, { cost: { wood: 30, scrap: 50 }, hp: 550, workers: 2, power: 1 }, { cost: { scrap: 80, fuel: 10 }, hp: 700, workers: 2, power: 1 }] },
    garden: { size: 2, cat: 'prod', key: 'h',
      levels: [{ cost: { wood: 30 }, hp: 250, workers: 2, mult: 1 }, { cost: { wood: 30, scrap: 10 }, hp: 320, workers: 2, mult: 1.5 }, { cost: { wood: 40, scrap: 20, meds: 2 }, hp: 400, workers: 3, mult: 1.8 }] },
    generator: { size: 2, cat: 'prod', key: 'e',
      levels: [{ cost: { wood: 20, scrap: 40 }, hp: 350, supply: 6, burn: 60 }, { cost: { scrap: 40 }, hp: 450, supply: 9, burn: 55 }, { cost: { scrap: 60, fuel: 10 }, hp: 550, supply: 12, burn: 50 }] },
    infirmary: { size: 2, cat: 'prod', key: 'i',
      levels: [{ cost: { wood: 40, scrap: 20, meds: 2 }, hp: 350, power: 2, patients: 2, heal: 4 }, { cost: { scrap: 30, meds: 3 }, hp: 450, power: 2, patients: 3, heal: 6 }, { cost: { scrap: 40, meds: 5 }, hp: 550, power: 2, patients: 4, heal: 9 }] },
    sawmill: { size: 2, cat: 'prod', key: 'v',
      levels: [{ cost: { wood: 30, scrap: 30 }, hp: 380, workers: 1, mult: 1 }, { cost: { wood: 20, scrap: 40 }, hp: 460, workers: 2, mult: 1.2 }, { cost: { scrap: 60, fuel: 5 }, hp: 560, workers: 2, mult: 1.6 }] },
    lab: { size: 2, cat: 'prod', key: 'q', requires: 'bp_lab',
      levels: [{ cost: { scrap: 40, wood: 20, meds: 2 }, hp: 320, workers: 1, power: 2, cycle: 45 }, { cost: { scrap: 40, meds: 3 }, hp: 400, workers: 2, power: 2, cycle: 40 }, { cost: { scrap: 60, fuel: 10 }, hp: 480, workers: 2, power: 3, cycle: 32 }] },
    radio: { size: 2, cat: 'prod', key: 'r', requires: 'bp_radio',
      levels: [{ cost: { scrap: 30, wood: 10, fuel: 5 }, hp: 300, power: 1, chance: 0.45 }, { cost: { scrap: 30 }, hp: 380, power: 1, chance: 0.6 }, { cost: { scrap: 40, fuel: 5 }, hp: 450, power: 1, chance: 0.75 }] },
  };
  const BUILD_ORDER = ['barricade', 'wall', 'gate', 'tower', 'spikes', 'mine', 'turret', 'flamer', 'spotlight', 'shelter', 'depot', 'canteen', 'training', 'garden', 'workshop', 'sawmill', 'generator', 'infirmary', 'lab', 'radio'];
  // Items crafted at the workshop (go to the armory, then equipped from the survivor panel).
  const CRAFT = {
    shotgun: { cost: { scrap: 20, wood: 6 }, level: 2, time: 20 },
    rifle: { cost: { scrap: 35, wood: 8, fuel: 2 }, level: 3, time: 30 },
  };
  // Blueprint ids (names live in the dictionaries as bp.<id>).
  const BLUEPRINTS = ['bp_turret', 'bp_spotlight', 'bp_radio', 'bp_flamer', 'bp_lab'];

  // Points of interest. loot: [res, min, max, chance]; guards: zombie mix spawned at generation.
  const POIS = {
    house: { size: [3, 3], searches: 2, time: 8, danger: 1, guards: { walker: 1 },
      loot: [['food', 2, 6, 0.85], ['wood', 2, 6, 0.6], ['scrap', 2, 6, 0.6], ['ammo', 3, 8, 0.45], ['meds', 1, 2, 0.25]] },
    pharmacy: { size: [3, 3], searches: 2, time: 10, danger: 2, guards: { walker: 1 },
      loot: [['meds', 3, 6, 1], ['food', 1, 3, 0.4]] },
    market: { size: [5, 4], searches: 4, time: 12, danger: 2, guards: { walker: 1, runner: 0.3 },
      loot: [['food', 10, 20, 1], ['meds', 1, 2, 0.2]] },
    warehouse: { size: [6, 4], searches: 4, time: 14, danger: 2, guards: { walker: 1 },
      loot: [['food', 4, 10, 0.7], ['scrap', 8, 15, 0.9], ['wood', 5, 12, 0.8]] },
    hardware: { size: [4, 3], searches: 3, time: 12, danger: 2, guards: { walker: 1 },
      loot: [['scrap', 10, 18, 1], ['wood', 8, 14, 0.9]], special: 'bp_spotlight' },
    gas: { size: [4, 3], searches: 3, time: 12, danger: 3, guards: { walker: 1, runner: 0.4 }, explosive: true,
      loot: [['fuel', 10, 20, 1], ['food', 2, 5, 0.5]], special: 'bp_flamer' },
    police: { size: [5, 4], searches: 4, time: 15, danger: 4, guards: { walker: 1, armored: 0.6 },
      loot: [['ammo', 25, 45, 1], ['scrap', 3, 8, 0.4]], special: 'police' },
    hospital: { size: [6, 5], searches: 5, time: 16, danger: 5, guards: { walker: 1, runner: 0.4, spitter: 0.25 },
      loot: [['meds', 6, 12, 1], ['food', 2, 5, 0.4]], recruit: 0.25, special: 'bp_lab' },
    factory: { size: [6, 6], searches: 5, time: 15, danger: 3, guards: { walker: 1, brute: 0.12 },
      loot: [['scrap', 15, 25, 1], ['fuel', 4, 10, 0.6]], special: 'bp_turret' },
    farmhouse: { size: [4, 3], searches: 3, time: 10, danger: 1, guards: { walker: 1 },
      loot: [['food', 8, 14, 1], ['wood', 4, 8, 0.6]] },
    camp: { size: [3, 3], searches: 1, time: 10, danger: 2, guards: { walker: 1, runner: 0.3 },
      loot: [['food', 2, 6, 0.6]], recruitCamp: true },
    ruin: { size: [4, 4], searches: 1, time: 10, danger: 1, guards: { walker: 1 },
      loot: [['scrap', 6, 12, 1], ['wood', 4, 10, 0.8]] },
    nest: { size: [2, 2], searches: 0, time: 0, danger: 4, guards: { walker: 1, runner: 0.4 }, nest: true, hp: 450,
      loot: [] },
  };

  const DIFFICULTY = {
    easy: { horde: 0.7, zhp: 0.85, start: 1.4, wander: 0.8 },
    normal: { horde: 1, zhp: 1, start: 1, wander: 1 },
    hard: { horde: 1.35, zhp: 1.15, start: 0.85, wander: 1.2 },
    nightmare: { horde: 1.8, zhp: 1.3, start: 0.7, wander: 1.5 },
  };

  const WEATHER = {
    clear: { noise: 1, vision: 1 },
    rain: { noise: 0.7, vision: 0.85 },
    fog: { noise: 1, vision: 0.6 },
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
    workshopBatch: { scrap: 2, ammo: 8 },
    sawmillWoodEvery: 15,    // seconds per wood per sawmill worker at mult 1
    labBatch: { food: 3, scrap: 2, meds: 1 }, // one lab cycle per worker
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

  UB.DEF = { TIME, T, TERRAIN, F, FEATURE, RES, WEAPONS, ROLES, RANKS, ZOMBIES, BUILDINGS, BUILD_ORDER, CRAFT, BLUEPRINTS, POIS, DIFFICULTY, WEATHER, BAL, FIRST_NAMES, LAST_NAMES };
})(globalThis.UB = globalThis.UB || {});
