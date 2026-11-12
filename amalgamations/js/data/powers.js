// Amalgamations — the 19 base powers, the 12 elements and the table of element combinations.
// dmg is a multiplier of the caster's attack. cd in seconds, energy cost in points.
(function (root) {
  'use strict';
  const AM = root.AM || (root.AM = {});

  const ELEMENTS = {
    fire:   { name: 'Fire',   color: '#ff7a2f', intense: 'Blazing' },
    frost:  { name: 'Frost',  color: '#8fe3ff', intense: 'Glacial' },
    storm:  { name: 'Storm',  color: '#ffe45c', intense: 'Thundering' },
    venom:  { name: 'Venom',  color: '#8fdc3c', intense: 'Virulent' },
    earth:  { name: 'Earth',  color: '#c0905a', intense: 'Titanic' },
    water:  { name: 'Water',  color: '#3fa7ff', intense: 'Torrential' },
    wind:   { name: 'Wind',   color: '#c8f5e8', intense: 'Howling' },
    life:   { name: 'Life',   color: '#5fe08a', intense: 'Verdant' },
    shadow: { name: 'Shadow', color: '#8a5cff', intense: 'Umbral' },
    light:  { name: 'Light',  color: '#fff3a8', intense: 'Radiant' },
    arcane: { name: 'Arcane', color: '#d07bff', intense: 'Astral' },
    metal:  { name: 'Metal',  color: '#c9d1dc', intense: 'Ironclad' },
  };

  // Effect types understood by the combat engine:
  // burn, poison, bleed (damage over time, power = fraction of hit per second), slow, freeze, stun, shock,
  // soak, blind, root, fear, knock (power = force), pull, vuln (target takes more damage), weaken,
  // lifesteal, heal (caster), pierce (ignore defence), crit (extra crit chance), refund (energy),
  // spread (statuses spread on death), haste (caster speed), execute, chain (extra chain jumps).
  const POWERS = {
    fireball: {
      name: 'Fireball', element: 'fire', shape: 'projectile', noun: 'Orb', word: 'Blast',
      dmg: 1.6, cd: 3.5, energy: 15, params: { speed: 15, range: 13, hit: 0.6, explode: 1.9 },
      effects: [{ type: 'burn', chance: 0.8, dur: 3, power: 0.2 }],
      desc: 'Hurl a ball of fire that explodes on impact and sets enemies alight.',
    },
    frostnova: {
      name: 'Frost Nova', element: 'frost', shape: 'nova', noun: 'Nova', word: 'Burst',
      dmg: 1.2, cd: 7, energy: 20, params: { radius: 4.2 },
      effects: [{ type: 'freeze', chance: 1, dur: 1.6 }],
      desc: 'A ring of ice bursts around you and freezes everything nearby.',
    },
    chainlightning: {
      name: 'Chain Lightning', element: 'storm', shape: 'chain', noun: 'Arc', word: 'Chain',
      dmg: 1.3, cd: 5, energy: 18, params: { range: 9, jumps: 4, jumpRange: 5.5 },
      effects: [{ type: 'shock', chance: 0.5, dur: 0.6 }],
      desc: 'A bolt that leaps from enemy to enemy, shocking them.',
    },
    venomspit: {
      name: 'Venom Spit', element: 'venom', shape: 'projectile', noun: 'Spit', word: 'Splash',
      dmg: 0.9, cd: 3, energy: 12, params: { speed: 13, range: 11, hit: 0.55, puddle: 1.7, puddleDur: 4 },
      effects: [{ type: 'poison', chance: 1, dur: 4, power: 0.35 }],
      desc: 'Spit a glob of venom that leaves a poisonous puddle.',
    },
    quakeslam: {
      name: 'Quake Slam', element: 'earth', shape: 'nova', noun: 'Quake', word: 'Tremor',
      dmg: 1.9, cd: 8, energy: 25, params: { radius: 5, delay: 0.25 },
      effects: [{ type: 'stun', chance: 1, dur: 1 }],
      desc: 'Slam the ground: a shockwave stuns everything around you.',
    },
    tidalwave: {
      name: 'Tidal Wave', element: 'water', shape: 'cone', noun: 'Wave', word: 'Surge',
      dmg: 1.3, cd: 6, energy: 20, params: { range: 7, angle: 1.25 },
      effects: [{ type: 'knock', chance: 1, power: 6 }, { type: 'soak', chance: 1, dur: 4 }],
      desc: 'Unleash a wave that washes enemies away and soaks them (soaked enemies take extra storm damage).',
    },
    galedash: {
      name: 'Gale Dash', element: 'wind', shape: 'dash', noun: 'Gust', word: 'Rush',
      dmg: 1.0, cd: 4, energy: 12, params: { distance: 7, width: 1.5 },
      effects: [{ type: 'knock', chance: 1, power: 3 }],
      desc: 'Dash on the wind, untouchable, knocking aside anything in the way.',
    },
    healingbloom: {
      name: 'Healing Bloom', element: 'life', shape: 'heal', noun: 'Bloom', word: 'Blossom',
      dmg: 0, cd: 14, energy: 30, params: { radius: 3.5, dur: 5, heal: 0.045 },
      effects: [],
      desc: 'Grow a flower bed that heals you and your allies by 4.5% of your health per second.',
    },
    shadowstep: {
      name: 'Shadow Step', element: 'shadow', shape: 'blink', noun: 'Step', word: 'Flicker',
      dmg: 1.4, cd: 6, energy: 15, params: { range: 8 },
      effects: [{ type: 'crit', chance: 1, power: 1 }],
      desc: 'Vanish and reappear behind your target with a guaranteed critical strike.',
    },
    sunbeam: {
      name: 'Sunbeam', element: 'light', shape: 'beam', noun: 'Beam', word: 'Ray',
      dmg: 0.45, cd: 9, energy: 28, params: { range: 11, width: 0.9, dur: 1.6, tick: 0.2 },
      effects: [{ type: 'blind', chance: 0.3, dur: 2 }],
      desc: 'Channel a searing beam of light that pierces every enemy in a line.',
    },
    starfall: {
      name: 'Starfall', element: 'arcane', shape: 'meteor', noun: 'Star', word: 'Fall',
      dmg: 2.6, cd: 9, energy: 26, params: { range: 11, radius: 2.6, delay: 0.9, count: 1 },
      effects: [{ type: 'stun', chance: 1, dur: 0.5 }],
      desc: 'Call down a falling star on the target area after a short delay.',
    },
    spiritpack: {
      name: 'Spirit Pack', element: 'arcane', shape: 'summon', noun: 'Spirits', word: 'Pack',
      dmg: 0.5, cd: 18, energy: 35, params: { count: 2, dur: 12, hp: 0.4 },
      effects: [],
      desc: 'Summon two spirit beasts that fight at your side for 12 seconds.',
    },
    ironskin: {
      name: 'Iron Skin', element: 'metal', shape: 'shield', noun: 'Skin', word: 'Guard',
      dmg: 0, cd: 15, energy: 25, params: { shield: 0.3, dur: 6, thorns: 0.3 },
      effects: [],
      desc: 'Harden your hide: a shield worth 30% of your health that reflects damage.',
    },
    blackhole: {
      name: 'Black Hole', element: 'shadow', shape: 'zone', noun: 'Hole', word: 'Vortex',
      dmg: 0.35, cd: 12, energy: 30, params: { range: 10, radius: 3.6, dur: 3, tick: 0.5, pull: 6 },
      effects: [],
      desc: 'Open a black hole that drags enemies in and crushes them.',
    },
    thornsnare: {
      name: 'Thorn Snare', element: 'life', shape: 'trap', noun: 'Snare', word: 'Bramble',
      dmg: 1.0, cd: 8, energy: 15, params: { range: 9, radius: 2.2, arm: 0.4, dur: 8 },
      effects: [{ type: 'root', chance: 1, dur: 2 }, { type: 'bleed', chance: 1, dur: 3, power: 0.15 }],
      desc: 'Plant a hidden bramble trap that roots and cuts whatever steps on it.',
    },
    boomerang: {
      name: 'Boomerang Blade', element: 'metal', shape: 'boomerang', noun: 'Blade', word: 'Spin',
      dmg: 1.1, cd: 4, energy: 14, params: { range: 9, speed: 16, hit: 0.8 },
      effects: [{ type: 'bleed', chance: 1, dur: 3, power: 0.2 }],
      desc: 'Throw a spinning blade that cuts through enemies on the way out and back.',
    },
    battleroar: {
      name: 'Battle Roar', element: 'wind', shape: 'buff', noun: 'Roar', word: 'Howl',
      dmg: 0, cd: 16, energy: 20, params: { dur: 6, atk: 0.25, radius: 5, fear: 1.5 },
      effects: [{ type: 'fear', chance: 1, dur: 1.5 }],
      desc: 'Roar: +25% damage for 6 seconds and nearby enemies flee in fear.',
    },
    stormcloud: {
      name: 'Storm Cloud', element: 'storm', shape: 'storm', noun: 'Cloud', word: 'Storm',
      dmg: 0.6, cd: 13, energy: 30, params: { range: 10, radius: 4.2, dur: 6, tick: 0.6 },
      effects: [{ type: 'shock', chance: 0.4, dur: 0.5 }],
      desc: 'Summon a thundercloud that strikes enemies beneath it with lightning.',
    },
    arcanemissiles: {
      name: 'Arcane Missiles', element: 'arcane', shape: 'projectile', noun: 'Missiles', word: 'Volley',
      dmg: 0.45, cd: 5, energy: 18, params: { speed: 12, range: 12, hit: 0.45, count: 5, spread: 0.9, homing: 1 },
      effects: [],
      desc: 'Fire five homing missiles of pure arcane energy.',
    },
  };
  const POWER_IDS = Object.keys(POWERS);
  for (const id of POWER_IDS) POWERS[id].id = id;

  // All 66 element pairs. Each gives a name, a colour and one bonus effect.
  const C = (a, b, name, effect) => ({ key: [a, b].sort().join('+'), name, effect });
  const COMBO_LIST = [
    C('fire', 'frost', 'Steam', { type: 'blind', chance: 0.5, dur: 1.5 }),
    C('fire', 'storm', 'Plasma', { type: 'pierce', chance: 1, power: 0.4 }),
    C('fire', 'venom', 'Toxfire', { type: 'poison', chance: 0.6, dur: 3, power: 0.3 }),
    C('fire', 'earth', 'Magma', { type: 'burn', chance: 1, dur: 4, power: 0.3 }),
    C('fire', 'water', 'Scald', { type: 'blind', chance: 0.4, dur: 1.5 }),
    C('fire', 'wind', 'Wildfire', { type: 'spread', chance: 1 }),
    C('fire', 'life', 'Phoenix', { type: 'heal', chance: 1, power: 0.12 }),
    C('fire', 'shadow', 'Hellfire', { type: 'burn', chance: 1, dur: 3, power: 0.45 }),
    C('fire', 'light', 'Solar', { type: 'blind', chance: 0.6, dur: 1.5 }),
    C('fire', 'arcane', 'Starfire', { type: 'crit', chance: 1, power: 0.25 }),
    C('fire', 'metal', 'Molten', { type: 'bleed', chance: 1, dur: 3, power: 0.2 }),
    C('frost', 'storm', 'Blizzard', { type: 'slow', chance: 1, dur: 3, power: 0.45 }),
    C('frost', 'venom', 'Frostbite', { type: 'poison', chance: 1, dur: 3, power: 0.25 }),
    C('frost', 'earth', 'Permafrost', { type: 'root', chance: 1, dur: 1.5 }),
    C('frost', 'water', 'Glacier', { type: 'freeze', chance: 1, dur: 2 }),
    C('frost', 'wind', 'Hailstorm', { type: 'slow', chance: 1, dur: 2.5, power: 0.4 }),
    C('frost', 'life', 'Frostbloom', { type: 'heal', chance: 1, power: 0.08 }),
    C('frost', 'shadow', 'Voidrime', { type: 'fear', chance: 0.6, dur: 1.2 }),
    C('frost', 'light', 'Prism', { type: 'crit', chance: 1, power: 0.2 }),
    C('frost', 'arcane', 'Rime', { type: 'refund', chance: 1, power: 0.3 }),
    C('frost', 'metal', 'Cryosteel', { type: 'vuln', chance: 1, dur: 4, power: 0.2 }),
    C('storm', 'venom', 'Neurotoxin', { type: 'stun', chance: 0.4, dur: 0.8 }),
    C('storm', 'earth', 'Magnetite', { type: 'pull', chance: 1, power: 4 }),
    C('storm', 'water', 'Conductive', { type: 'chain', chance: 1, power: 2 }),
    C('storm', 'wind', 'Tempest', { type: 'knock', chance: 1, power: 5 }),
    C('storm', 'life', 'Galvanic', { type: 'refund', chance: 1, power: 0.25 }),
    C('storm', 'shadow', 'Darkbolt', { type: 'pierce', chance: 1, power: 0.5 }),
    C('storm', 'light', 'Radiance', { type: 'blind', chance: 0.5, dur: 2 }),
    C('storm', 'arcane', 'Ion', { type: 'refund', chance: 1, power: 0.35 }),
    C('storm', 'metal', 'Railgun', { type: 'pierce', chance: 1, power: 0.6 }),
    C('venom', 'earth', 'Blight', { type: 'weaken', chance: 1, dur: 4, power: 0.2 }),
    C('venom', 'water', 'Miasma', { type: 'poison', chance: 1, dur: 5, power: 0.25 }),
    C('venom', 'wind', 'Pestilence', { type: 'spread', chance: 1 }),
    C('venom', 'life', 'Bloodroot', { type: 'lifesteal', chance: 1, power: 0.2 }),
    C('venom', 'shadow', 'Plague', { type: 'spread', chance: 1 }),
    C('venom', 'light', 'Caustic', { type: 'vuln', chance: 1, dur: 4, power: 0.2 }),
    C('venom', 'arcane', 'Hex', { type: 'weaken', chance: 1, dur: 4, power: 0.25 }),
    C('venom', 'metal', 'Rust', { type: 'vuln', chance: 1, dur: 5, power: 0.25 }),
    C('earth', 'water', 'Mud', { type: 'slow', chance: 1, dur: 3, power: 0.5 }),
    C('earth', 'wind', 'Sandstorm', { type: 'blind', chance: 0.6, dur: 2 }),
    C('earth', 'life', 'Overgrowth', { type: 'root', chance: 1, dur: 1.5 }),
    C('earth', 'shadow', 'Grave', { type: 'fear', chance: 0.7, dur: 1.5 }),
    C('earth', 'light', 'Crystal', { type: 'crit', chance: 1, power: 0.2 }),
    C('earth', 'arcane', 'Gravity', { type: 'pull', chance: 1, power: 5 }),
    C('earth', 'metal', 'Ironstone', { type: 'stun', chance: 0.5, dur: 1 }),
    C('water', 'wind', 'Monsoon', { type: 'knock', chance: 1, power: 5 }),
    C('water', 'life', 'Spring', { type: 'heal', chance: 1, power: 0.15 }),
    C('water', 'shadow', 'Abyss', { type: 'pull', chance: 1, power: 4 }),
    C('water', 'light', 'Rainbow', { type: 'heal', chance: 1, power: 0.1 }),
    C('water', 'arcane', 'Tidecall', { type: 'refund', chance: 1, power: 0.3 }),
    C('water', 'metal', 'Brine', { type: 'bleed', chance: 1, dur: 3, power: 0.2 }),
    C('wind', 'life', 'Pollen', { type: 'heal', chance: 1, power: 0.1 }),
    C('wind', 'shadow', 'Phantom', { type: 'haste', chance: 1, dur: 3, power: 0.3 }),
    C('wind', 'light', 'Aurora', { type: 'haste', chance: 1, dur: 3, power: 0.25 }),
    C('wind', 'arcane', 'Vortex', { type: 'pull', chance: 1, power: 4 }),
    C('wind', 'metal', 'Bladestorm', { type: 'bleed', chance: 1, dur: 3, power: 0.25 }),
    C('life', 'shadow', 'Necrotic', { type: 'lifesteal', chance: 1, power: 0.25 }),
    C('life', 'light', 'Holy', { type: 'heal', chance: 1, power: 0.15 }),
    C('life', 'arcane', 'Mystic', { type: 'refund', chance: 1, power: 0.3 }),
    C('life', 'metal', 'Thornsteel', { type: 'bleed', chance: 1, dur: 4, power: 0.2 }),
    C('shadow', 'light', 'Twilight', { type: 'pierce', chance: 1, power: 1 }),
    C('shadow', 'arcane', 'Void', { type: 'pull', chance: 1, power: 4 }),
    C('shadow', 'metal', 'Reaper', { type: 'execute', chance: 1, power: 0.25 }),
    C('light', 'arcane', 'Celestial', { type: 'crit', chance: 1, power: 0.3 }),
    C('light', 'metal', 'Gleam', { type: 'blind', chance: 0.5, dur: 2 }),
    C('arcane', 'metal', 'Runic', { type: 'refund', chance: 1, power: 0.3 }),
  ];
  const ELEMENT_COMBOS = {};
  for (const c of COMBO_LIST) {
    const [a, b] = c.key.split('+');
    c.color = AM.mixColor(ELEMENTS[a].color, ELEMENTS[b].color, 0.5);
    ELEMENT_COMBOS[c.key] = c;
  }

  Object.assign(AM, { ELEMENTS, POWERS, POWER_IDS, ELEMENT_COMBOS });
  if (typeof module !== 'undefined' && module.exports) module.exports = AM;
})(typeof window !== 'undefined' ? window : globalThis);
