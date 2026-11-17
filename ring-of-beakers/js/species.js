// species.js — archetypes. A species is only a region of genome space: each entry lists trait
// targets (in trait units, see genome.js) that a founding genome is built around. No DOM.
(function () {
  'use strict';
  const RB = globalThis.RB;
  const G = RB.genome;

  // name: [male, female] when they differ. t: trait targets. sw: recessive switches that are on.
  // night: only out at night. tier: 1 common .. 4 legendary (drives value and how hard it runs).
  const SPECIES = {
    chicken: { name: ['Rooster', 'Hen'], tier: 1, cv: 0.2, morph: { melanic: 0.07, leucistic: 0.25 },
      t: { hue: 0.07, sat: 0.6, lit: 0.42, litTail: -0.32, hueTail: 0.3, comb: 1.0, wattle: 0.6, spur: 0.5, tailLen: 1.1, tailFan: 0.6, tailUp: 0.75, aggression: 0.55 } },
    gamecock: { name: ['Gamecock', 'Gamehen'], tier: 2, cv: 0.15, morph: { melanic: 0.09, leucistic: 0.12 },
      t: { size: 0.95, bodyDepth: 0.85, posture: 0.55, legLen: 1.35, legThick: 1.1, neckLen: 1.2, spur: 0.95, talon: 0.5, comb: 0.5, combType: 0.9, wattle: 0.15, tailLen: 1.2, tailFan: 0.5, hue: 0.02, sat: 0.75, lit: 0.35, litTail: -0.3, muscle: 1.25, aggression: 0.95, courage: 0.9, reflex: 1.2, hide: 1.1 } },
    bantam: { name: 'Bantam', tier: 1, sw: ['fluff'], cv: 0.2, morph: { melanic: 0.06, leucistic: 0.3 },
      t: { size: 0.6, bodyDepth: 1.2, bodyLen: 0.85, legLen: 0.75, crest: 0.8, hue: 0.12, sat: 0.4, lit: 0.8, comb: 0.6, courage: 0.8, aggression: 0.7, tailUp: 0.9 } },
    duck: { name: ['Drake', 'Duck'], tier: 1, cv: 0.12, morph: { leucistic: 0.25 },
      t: { size: 0.9, posture: 0.18, bodyLen: 1.15, neckLen: 0.9, neckCurve: 0.5, beakLen: 1.25, beakFlat: 1, beakDepth: 0.8, beakHook: 0, legLen: 0.55, footSize: 1.3, web: 1, talon: 0.05, spur: 0, wingSize: 1.2, tailLen: 0.5, tailFan: 0.2, tailUp: 0.4, comb: 0, wattle: 0, hue: 0.09, sat: 0.35, lit: 0.42, hueHead: 0.25, litHead: -0.1, sheen: 0.9, belly: 0.6, beakTone: 0.55, legTone: 0.75, aggression: 0.3, courage: 0.4 } },
    goose: { name: ['Gander', 'Goose'], tier: 2, cv: 0.08,
      t: { size: 1.5, posture: 0.25, bodyLen: 1.15, bodyDepth: 1.1, neckLen: 1.8, neckCurve: 0.3, beakFlat: 0.7, beakHook: 0, legLen: 0.8, footSize: 1.4, web: 1, spur: 0, talon: 0.05, wingSize: 1.5, tailLen: 0.5, tailFan: 0.2, tailUp: 0.4, comb: 0, wattle: 0, sat: 0.05, lit: 0.85, beakTone: 0.75, legTone: 0.75, aggression: 0.9, courage: 0.9, muscle: 1.15 } },
    swan: { name: 'Swan', tier: 3,
      t: { size: 1.85, posture: 0.2, bodyLen: 1.25, neckLen: 2.35, neckCurve: 1, beakFlat: 0.6, beakHook: 0, legLen: 0.7, footSize: 1.4, web: 1, spur: 0, talon: 0.05, wingSize: 1.8, tailLen: 0.5, tailFan: 0.2, tailUp: 0.5, comb: 0, wattle: 0, sat: 0.02, lit: 0.95, beakTone: 0.75, legTone: 0, aggression: 0.7, courage: 0.8, muscle: 1.2 } },
    turkey: { name: 'Turkey', tier: 2, cv: 0.09, morph: { leucistic: 0.18 },
      t: { size: 1.9, bodyDepth: 1.35, bodyLen: 1.05, posture: 0.4, neckLen: 1.2, legLen: 1.1, legThick: 1.2, tailLen: 1.3, tailFan: 1, tailUp: 1, comb: 0.3, wattle: 1, bareHead: 1, combHue: -0.03, hue: 0.07, sat: 0.35, lit: 0.22, litTail: 0.15, pattern: 0.27, patContrast: 0.5, legTone: 0.9, courage: 0.45, reflex: 0.8, spur: 0.6 } },
    peafowl: { name: ['Peacock', 'Peahen'], tier: 3, morph: { leucistic: 0.08 },
      t: { size: 1.4, bodyLen: 1.1, posture: 0.4, neckLen: 1.5, legLen: 1.2, tailLen: 2.6, tailFan: 1, tailUp: 0.55, crest: 0.75, comb: 0, wattle: 0, hue: 0.62, sat: 0.85, lit: 0.38, hueTail: -0.25, litTail: 0.05, sheen: 1, beakTone: 0.3, legTone: 0.25, aggression: 0.35, courage: 0.35 } },
    pheasant: { name: 'Pheasant', tier: 2, morph: { melanic: 0.03 },
      t: { size: 0.85, bodyLen: 1.15, posture: 0.25, tailLen: 2.2, tailFan: 0.1, tailUp: 0.35, comb: 0.2, wattle: 0.5, hue: 0.07, sat: 0.8, lit: 0.45, hueHead: 0.3, litHead: -0.15, sheen: 0.8, pattern: 0.73, legTone: 0.25, reflex: 1.2 } },
    quail: { name: 'Quail', tier: 1, cv: 0.07,
      t: { size: 0.42, bodyDepth: 1.25, bodyLen: 0.85, neckLen: 0.5, legLen: 0.7, tailLen: 0.3, crest: 0.6, comb: 0, wattle: 0, hue: 0.08, sat: 0.3, lit: 0.5, pattern: 0.73, belly: 0.7, reflex: 1.35, courage: 0.3 } },
    ostrich: { name: 'Ostrich', tier: 3,
      t: { size: 2.45, bodyDepth: 1.15, posture: 0.3, neckLen: 2.2, neckThick: 0.7, neckCurve: 0.15, headSize: 0.75, eyeSize: 1.5, beakLen: 0.9, beakFlat: 0.4, beakHook: 0, legLen: 2.3, legThick: 1.5, footSize: 1.3, talon: 0.7, spur: 0, wingSize: 0.7, tailLen: 0.7, tailFan: 0.6, tailUp: 0.5, comb: 0, wattle: 0, bareHead: 1, hue: 0, sat: 0, lit: 0.1, litWing: 0.3, litTail: 0.3, beakTone: 0.6, legTone: 1, muscle: 1.3, lungs: 1.4, aggression: 0.55, courage: 0.6 } },
    emu: { name: 'Emu', tier: 3,
      t: { size: 2.1, bodyDepth: 1.25, posture: 0.25, neckLen: 1.7, neckThick: 0.85, headSize: 0.8, beakLen: 0.9, legLen: 1.9, legThick: 1.4, talon: 0.6, spur: 0, wingSize: 0.2, tailLen: 0.6, tailFan: 0.3, tailUp: 0.2, comb: 0, wattle: 0, hue: 0.08, sat: 0.25, lit: 0.3, bareHead: 0.6, combHue: -0.4, legTone: 0.2, beakTone: 0.1, lungs: 1.4, muscle: 1.2 } },
    cassowary: { name: 'Cassowary', tier: 4,
      t: { size: 2.0, bodyDepth: 1.3, posture: 0.3, neckLen: 1.5, legLen: 1.7, legThick: 1.7, footSize: 1.4, talon: 0.9, spur: 0.3, wingSize: 0.15, tailLen: 0.3, comb: 1.3, combType: 0.05, wattle: 0.9, bareHead: 1, combHue: -0.4, hue: 0.7, sat: 0.1, lit: 0.1, beakTone: 0.2, legTone: 0.2, muscle: 1.22, hide: 1.12, aggression: 0.95, courage: 0.95, bone: 1.2 } },
    falcon: { name: 'Falcon', tier: 3,
      t: { size: 0.68, posture: 0.75, bodyLen: 1.05, bodyDepth: 0.9, neckLen: 0.4, headSize: 1.05, eyeSize: 1.4, beakLen: 0.7, beakDepth: 1.2, beakHook: 1, legLen: 0.75, legThick: 1.1, footSize: 1.3, talon: 1, spur: 0, wingSize: 1.9, wingPoint: 1, tailLen: 1.1, tailFan: 0.25, tailUp: 0.1, comb: 0, wattle: 0, hue: 0.6, sat: 0.2, lit: 0.38, belly: 0.9, pattern: 0.27, patContrast: 0.6, beakTone: 0.4, eyeTone: 0.1, reflex: 1.5, muscle: 1.2, aggression: 0.8, courage: 0.7, focus: 0.9 } },
    eagle: { name: 'Eagle', tier: 4,
      t: { size: 1.35, posture: 0.65, bodyDepth: 1.1, neckLen: 0.5, headSize: 1.1, eyeSize: 1.2, beakDepth: 1.4, beakHook: 1, legLen: 0.9, legThick: 1.4, footSize: 1.5, talon: 1, spur: 0, wingSize: 2.1, wingPoint: 0.6, tailLen: 1.0, tailFan: 0.4, tailUp: 0.15, comb: 0, wattle: 0, hue: 0.07, sat: 0.45, lit: 0.25, litHead: 0.4, litTail: 0.3, eyeTone: 0.9, muscle: 1.35, reflex: 1.2, aggression: 0.8, courage: 0.85, focus: 0.85 } },
    vulture: { name: 'Vulture', tier: 3,
      t: { size: 1.5, posture: 0.55, bodyDepth: 1.15, neckLen: 1.3, neckCurve: 0.9, neckThick: 0.8, headSize: 0.9, beakLen: 1.1, beakDepth: 1.2, beakHook: 0.9, legLen: 0.9, talon: 0.4, spur: 0, wingSize: 2.2, wingPoint: 0.2, tailLen: 0.8, tailFan: 0.4, tailUp: 0.1, comb: 0, wattle: 0.2, bareHead: 1, combHue: 0.02, crest: 0, hue: 0.08, sat: 0.15, lit: 0.16, beakTone: 0.35, legTone: 0.3, hide: 1.35, lungs: 1.2, cunning: 0.7 } },
    owl: { name: 'Owl', tier: 3, night: true, sw: ['earTuft'],
      t: { size: 0.9, posture: 0.95, bodyDepth: 1.3, bodyLen: 0.9, neckLen: 0.2, headSize: 1.55, eyeSize: 1.9, beakLen: 0.45, beakHook: 1, beakDepth: 0.9, legLen: 0.6, legThick: 1.2, footSize: 1.2, talon: 0.95, spur: 0, wingSize: 1.7, wingPoint: 0.1, tailLen: 0.6, tailFan: 0.3, tailUp: 0.05, comb: 0, wattle: 0, hue: 0.08, sat: 0.35, lit: 0.4, pattern: 0.73, belly: 0.6, beakTone: 0.3, legTone: 0.3, eyeTone: 1, focus: 1, cunning: 0.8, reflex: 1.25, aggression: 0.6 } },
    heron: { name: 'Heron', tier: 2,
      t: { size: 1.3, posture: 0.5, bodyDepth: 0.8, neckLen: 2.3, neckCurve: 1, neckThick: 0.6, headSize: 0.8, beakLen: 2.1, beakDepth: 0.55, beakHook: 0, legLen: 2.3, legThick: 0.6, footSize: 1.4, talon: 0.2, spur: 0, wingSize: 1.7, tailLen: 0.5, tailFan: 0.2, tailUp: 0.2, comb: 0, wattle: 0, crest: 0.5, hue: 0.58, sat: 0.2, lit: 0.6, belly: 0.6, beakTone: 0.55, legTone: 0.3, bone: 0.7, reflex: 1.3, focus: 0.85 } },
    flamingo: { name: 'Flamingo', tier: 3,
      t: { size: 1.25, posture: 0.45, bodyDepth: 0.85, neckLen: 2.4, neckCurve: 1, neckThick: 0.55, headSize: 0.8, beakLen: 1.2, beakDepth: 1.5, beakHook: 0.85, legLen: 2.6, legThick: 0.5, web: 0.8, spur: 0, talon: 0, wingSize: 1.4, tailLen: 0.4, tailFan: 0.2, tailUp: 0.3, comb: 0, wattle: 0, hue: 0.95, sat: 0.85, lit: 0.7, litWing: -0.1, beakTone: 0.05, legTone: 1, bone: 0.65, aggression: 0.25, courage: 0.35 } },
    secretary: { name: 'Secretary Bird', short: 'Secretary', tier: 4,
      t: { size: 1.35, posture: 0.5, bodyDepth: 0.9, neckLen: 1.2, beakLen: 0.8, beakDepth: 1.2, beakHook: 1, legLen: 2.3, legThick: 0.9, talon: 0.7, spur: 0.2, wingSize: 1.6, tailLen: 1.8, tailFan: 0.15, tailUp: 0.3, crest: 1, comb: 0, wattle: 0, bareHead: 0.7, combHue: 0.07, hue: 0.6, sat: 0.08, lit: 0.7, litWing: -0.3, litTail: -0.4, legTone: 0.9, muscle: 1.3, reflex: 1.3, aggression: 0.75, courage: 0.75, focus: 0.8 } },
    pelican: { name: 'Pelican', tier: 3,
      t: { size: 1.6, posture: 0.35, bodyDepth: 1.25, neckLen: 1.5, neckCurve: 0.9, beakLen: 2.3, beakDepth: 0.9, beakHook: 0.3, beakFlat: 0.3, pouch: 1, legLen: 0.6, legThick: 1.2, footSize: 1.5, web: 1, spur: 0, talon: 0, wingSize: 1.9, tailLen: 0.4, comb: 0, wattle: 0, sat: 0.05, lit: 0.92, litWing: -0.25, beakTone: 0.75, legTone: 0.75, bone: 0.8, aggression: 0.4, hide: 1.1 } },
    gull: { name: 'Gull', tier: 1,
      t: { size: 0.72, posture: 0.3, neckLen: 0.6, beakLen: 1.1, beakHook: 0.4, legLen: 0.7, web: 1, spur: 0, talon: 0.1, wingSize: 1.6, wingPoint: 0.9, tailLen: 0.6, tailFan: 0.3, tailUp: 0.3, comb: 0, wattle: 0, sat: 0.05, lit: 0.93, litWing: -0.3, litTail: -0.2, beakTone: 0.6, legTone: 0.75, cunning: 0.95, aggression: 0.7, courage: 0.6, reflex: 1.2 } },
    penguin: { name: 'Penguin', tier: 3,
      t: { size: 1.05, posture: 1, bodyDepth: 1.3, bodyLen: 1.2, neckLen: 0.35, beakLen: 1.25, beakDepth: 0.9, beakHook: 0.4, muscle: 1.25, legLen: 0.3, legThick: 1.3, footSize: 1.4, web: 1, spur: 0, talon: 0.1, wingSize: 0.7, wingPoint: 1, tailLen: 0.25, tailFan: 0.1, tailUp: 0, comb: 0, wattle: 0, hue: 0.62, sat: 0.15, lit: 0.1, belly: 1, beakTone: 0.7, legTone: 0.75, bone: 1.4, hide: 1.3, lungs: 1.3, courage: 0.8, aggression: 0.7 } },
    parrot: { name: 'Macaw', tier: 3,
      t: { size: 0.8, posture: 0.75, neckLen: 0.4, headSize: 1.25, beakLen: 0.9, beakDepth: 1.7, beakHook: 1, legLen: 0.55, legThick: 1.1, talon: 0.5, spur: 0, wingSize: 1.4, tailLen: 2.0, tailFan: 0.1, tailUp: 0.05, comb: 0, wattle: 0, bareHead: 0.2, hue: 0, sat: 0.95, lit: 0.48, hueWing: 0.17, hueTail: -0.38, beakTone: 0.3, legTone: 0.25, cunning: 1, focus: 0.8, aggression: 0.6, hide: 0.9 } },
    toucan: { name: 'Toucan', tier: 3,
      t: { size: 0.8, posture: 0.6, neckLen: 0.4, headSize: 1.1, beakLen: 2.3, beakDepth: 1.7, beakHook: 0.45, legLen: 0.55, spur: 0, wingSize: 1.1, tailLen: 1.0, tailFan: 0.2, tailUp: 0.3, comb: 0, wattle: 0, hue: 0.65, sat: 0.2, lit: 0.1, belly: 1, beakTone: 0.75, legTone: 0.2, bone: 0.9, cunning: 0.7, aggression: 0.7, reflex: 1.2 } },
    kiwi: { name: 'Kiwi', tier: 3, night: true,
      t: { size: 0.5, posture: 0.25, bodyDepth: 1.4, bodyLen: 0.9, neckLen: 0.5, headSize: 0.8, eyeSize: 0.5, beakLen: 2.0, beakDepth: 0.45, beakHook: 0.05, legLen: 0.75, legThick: 1.4, talon: 0.5, spur: 0, wingSize: 0, tailLen: 0, comb: 0, wattle: 0, hue: 0.07, sat: 0.35, lit: 0.3, beakTone: 0.45, legTone: 0.3, hide: 1.2, courage: 0.65, aggression: 0.6 } },
    roadrunner: { name: 'Roadrunner', tier: 2,
      t: { size: 0.62, posture: 0.15, bodyLen: 1.2, bodyDepth: 0.8, neckLen: 0.9, beakLen: 1.2, beakHook: 0.2, legLen: 1.6, legThick: 0.8, spur: 0, talon: 0.3, wingSize: 0.8, tailLen: 2.0, tailFan: 0.1, tailUp: 0.7, crest: 0.9, comb: 0, wattle: 0, hue: 0.08, sat: 0.3, lit: 0.4, pattern: 0.9, belly: 0.7, legTone: 0.25, beakTone: 0.2, reflex: 1.5, lungs: 1.4, cunning: 0.8, aggression: 0.65 } },
    raven: { name: 'Raven', tier: 2,
      t: { size: 0.75, posture: 0.3, neckLen: 0.6, headSize: 1.1, beakLen: 1.3, beakDepth: 1.2, beakHook: 0.3, legLen: 0.8, spur: 0, talon: 0.4, wingSize: 1.5, tailLen: 1.0, tailFan: 0.3, tailUp: 0.2, comb: 0, wattle: 0, hue: 0.7, sat: 0.2, lit: 0.09, sheen: 0.7, beakTone: 0, legTone: 0, eyeTone: 0, cunning: 1, focus: 1, aggression: 0.6, courage: 0.6 } },
    hummingbird: { name: 'Hummingbird', tier: 3,
      t: { size: 0.36, posture: 0.6, neckLen: 0.5, headSize: 1.1, beakLen: 2.2, beakDepth: 0.4, beakHook: 0, legLen: 0.4, legThick: 0.6, spur: 0, talon: 0.1, wingSize: 1.7, wingPoint: 1, tailLen: 0.8, tailFan: 0.3, tailUp: 0.1, comb: 0, wattle: 0, hue: 0.38, sat: 0.9, lit: 0.42, sheen: 1, hueHead: 0.3, belly: 0.7, beakTone: 0, legTone: 0, reflex: 1.5, lungs: 1.3, aggression: 0.8, courage: 0.7 } },
    // Extinct: only from the fossil bench.
    dodo: { name: 'Dodo', tier: 4, extinct: true,
      t: { size: 1.6, posture: 0.4, bodyDepth: 1.55, neckThick: 1.4, headSize: 1.4, beakLen: 1.7, beakDepth: 1.5, beakHook: 0.9, legLen: 0.75, legThick: 1.7, footSize: 1.4, spur: 0, wingSize: 0.25, tailLen: 0.5, tailFan: 0.9, tailUp: 0.9, comb: 0, wattle: 0, bareHead: 0.6, combHue: 0.1, hue: 0.6, sat: 0.1, lit: 0.5, beakTone: 0.45, hide: 1.35, bone: 1.3, courage: 0.4, cunning: 0.05, reflex: 0.8, aggression: 0.5, muscle: 1.2, lifespan: 20 } },
    terror: { name: 'Terror Bird', short: 'Terror', tier: 5, extinct: true,
      t: { size: 2.4, bodyDepth: 1.15, neckLen: 1.5, neckThick: 1.4, headSize: 1.55, beakLen: 1.9, beakDepth: 1.7, beakHook: 1, legLen: 1.9, legThick: 1.6, footSize: 1.5, talon: 0.9, spur: 0, wingSize: 0.25, tailLen: 0.6, tailFan: 0.4, tailUp: 0.3, comb: 0, wattle: 0, crest: 0.6, hue: 0.08, sat: 0.5, lit: 0.3, pattern: 0.27, legTone: 0.3, muscle: 1.5, bone: 1.3, hide: 1.2, aggression: 1, courage: 1 } },
    moa: { name: 'Moa', tier: 5, extinct: true,
      t: { size: 2.65, posture: 0.3, bodyDepth: 1.4, bodyLen: 1.1, neckLen: 2.3, neckThick: 1.1, neckCurve: 0.3, headSize: 0.8, beakLen: 0.9, legLen: 2.1, legThick: 1.9, footSize: 1.6, talon: 0.4, spur: 0, wingSize: 0, tailLen: 0.2, comb: 0, wattle: 0, hue: 0.07, sat: 0.4, lit: 0.33, legTone: 0.35, beakTone: 0.4, bone: 1.4, hide: 1.3, muscle: 1.3, reflex: 0.7, aggression: 0.4, courage: 0.6 } },
    archaeo: { name: 'Archaeopteryx', short: 'Archaeo', tier: 5, extinct: true, sw: ['teeth', 'tailBone', 'arms'],
      t: { size: 0.6, posture: 0.3, bodyLen: 1.1, neckLen: 0.9, beakLen: 1.1, beakDepth: 0.9, talon: 0.8, spur: 0, wingSize: 1.4, tailLen: 1.8, tailFan: 0.3, tailUp: 0.4, comb: 0, wattle: 0, hue: 0.62, sat: 0.35, lit: 0.2, sheen: 0.6, legTone: 0.25, beakTone: 0.3, reflex: 1.3, aggression: 0.8, cunning: 0.7 } },
    raptor: { name: 'Raptor', tier: 5, extinct: true, sw: ['teeth', 'tailBone', 'arms'],
      t: { size: 1.25, posture: 0.2, bodyLen: 1.2, bodyDepth: 0.9, neckLen: 1.1, neckCurve: 0.8, headSize: 1.3, beakLen: 1.3, beakDepth: 1.2, beakHook: 0.1, legLen: 1.4, legThick: 1.3, footSize: 1.3, talon: 1, spur: 0, wingSize: 0.5, tailLen: 2.4, tailFan: 0.15, tailUp: 0.5, comb: 0, wattle: 0, crest: 0.5, hue: 0.09, sat: 0.55, lit: 0.4, pattern: 0.27, belly: 0.6, beakTone: 0.3, legTone: 0.3, muscle: 1.4, reflex: 1.4, aggression: 1, courage: 0.9, cunning: 0.9, focus: 0.9, armLen: 0.9 } },
    // People share the same genome: bare skin, arms, forward knees and no beak.
    human: { name: 'Person', tier: 3, person: true, sw: ['arms', 'bare', 'knee'], cv: 0.12,
      t: { size: 2.3, posture: 1, bodyLen: 0.95, bodyDepth: 0.95, neckLen: 0.22, neckThick: 1.1, headSize: 1.15, eyeSize: 0.75, beakLen: 0, legLen: 1.85, legThick: 1.5, footSize: 1.2, talon: 0, spur: 0, web: 0, wingSize: 0, tailLen: 0, comb: 0, wattle: 0, crest: 0.6, hue: 0.07, sat: 0.45, lit: 0.6, litHead: -0.3, aggression: 0.4, courage: 0.4, focus: 0.6, cunning: 0.7, lifespan: 22 } },
    // Added later, at the end so the kinds before them come out as they always did.
    // The Andean condor: a huge black soaring bird with white wing patches, a bare head and a fleshy
    // comb. It hisses and grunts rather than calls. Long-lived and very hard to wear down.
    condor: { name: 'Andean Condor', short: 'Condor', tier: 4,
      t: { size: 1.64, posture: 0.5, bodyDepth: 1.2, bodyLen: 1.1, neckLen: 1.0, neckCurve: 0.7, neckThick: 0.95, headSize: 0.95, beakLen: 1.0, beakDepth: 1.3, beakHook: 1, legLen: 1.05, legThick: 1.3, footSize: 1.3, talon: 0.3, spur: 0, wingSize: 2.3, wingPoint: 0.05, tailLen: 0.9, tailFan: 0.5, tailUp: 0.1, comb: 0.75, combType: 0.1, wattle: 0.55, bareHead: 1, combHue: -0.06, crest: 0, hue: 0.62, sat: 0.04, lit: 0.08, litWing: 0.3, litHead: 0.4, beakTone: 0.24, legTone: 0.25, eyeTone: 0.35, hide: 1.3, lungs: 1.55, bone: 1.15, muscle: 1.2, cunning: 0.6, aggression: 0.45, courage: 0.75, focus: 0.7, lifespan: 22, voicePitch: 0.15, voiceRasp: 0.95, voiceLen: 0.6 } },
    // The harpy eagle: the jungle's heaviest raptor, with a split grey crest, a black chest band over a
    // white belly, legs as thick as a child's wrist and huge talons. Calls with a long, thin wail.
    harpy: { name: 'Harpy Eagle', short: 'Harpy', tier: 4,
      t: { size: 1.36, posture: 0.8, bodyDepth: 1.2, bodyLen: 1.0, neckLen: 0.55, neckThick: 1.2, headSize: 1.4, eyeSize: 1.3, beakLen: 0.85, beakDepth: 1.65, beakHook: 1, legLen: 1.05, legThick: 1.9, footSize: 1.9, talon: 1, spur: 0, wingSize: 1.65, wingPoint: 0, tailLen: 1.25, tailFan: 0.35, tailUp: 0.1, crest: 1, comb: 0, wattle: 0, hue: 0.6, sat: 0.07, lit: 0.28, litHead: 0.4, litWing: -0.2, litTail: -0.05, belly: 1, pattern: 0.5, beakTone: 0.05, legTone: 0.5, eyeTone: 0.15, muscle: 1.5, bone: 1.25, reflex: 1.3, hide: 1.15, aggression: 0.9, courage: 0.95, focus: 0.95, cunning: 0.6, voicePitch: 0.9, voiceRasp: 0.1, voiceLen: 0.95 } },
    // Two night birds, so the dark has more than owls and kiwis in it.
    // The nightjar: a mottled bark-brown bird with a tiny bill, a huge gape, big eyes, long wings and
    // short legs, flat on the ground by day. Churrs all night.
    nightjar: { name: 'Nightjar', tier: 2, night: true,
      t: { size: 0.55, posture: 0.1, bodyLen: 1.2, bodyDepth: 0.85, neckLen: 0.25, headSize: 1.25, eyeSize: 1.65, beakLen: 0.3, beakDepth: 0.5, beakHook: 0.1, beakFlat: 0.6, legLen: 0.32, legThick: 0.6, footSize: 0.7, talon: 0.05, spur: 0, wingSize: 1.75, wingPoint: 0.85, tailLen: 1.45, tailFan: 0.3, tailUp: 0.15, comb: 0, wattle: 0, crest: 0, hue: 0.08, sat: 0.3, lit: 0.36, litHead: -0.05, pattern: 0.73, patContrast: 0.65, belly: 0.4, beakTone: 0.15, legTone: 0.3, eyeTone: 0.05, reflex: 1.35, focus: 0.7, cunning: 0.85, courage: 0.35, aggression: 0.35, voicePitch: 0.3, voiceRasp: 0.4, voiceLen: 1 } },
    // The potoo: sits bolt upright like a broken branch, with enormous yellow eyes and a gape that
    // splits its head in two. Its mournful call sounds like someone crying in the dark.
    potoo: { name: 'Potoo', tier: 3, night: true,
      t: { size: 0.78, posture: 1, bodyLen: 0.95, bodyDepth: 1.05, neckLen: 0.2, headSize: 1.55, eyeSize: 1.9, beakLen: 0.35, beakDepth: 1.25, beakHook: 0.4, beakFlat: 0.7, legLen: 0.3, legThick: 0.7, footSize: 0.8, talon: 0.3, spur: 0, wingSize: 1.45, wingPoint: 0.3, tailLen: 1.6, tailFan: 0.35, tailUp: 0.05, comb: 0, wattle: 0, crest: 0, hue: 0.09, sat: 0.18, lit: 0.48, litHead: 0.05, litWing: -0.1, pattern: 0.73, patContrast: 0.5, belly: 0.5, beakTone: 0.25, legTone: 0.3, eyeTone: 0.95, focus: 0.9, cunning: 0.75, courage: 0.55, aggression: 0.4, hide: 1.15, voicePitch: 0.2, voiceRasp: 0.1, voiceLen: 1 } },
  };
  for (const id of Object.keys(SPECIES)) { const s = SPECIES[id]; s.id = id; s.sw = s.sw || []; }
  const IDS = Object.keys(SPECIES);

  // Traits that decide which species an animal looks like.
  const SHAPE = ['size', 'bodyLen', 'bodyDepth', 'posture', 'neckLen', 'headSize', 'beakLen', 'beakDepth', 'beakHook', 'beakFlat',
    'legLen', 'legThick', 'wingSize', 'tailLen', 'tailFan', 'web', 'comb', 'eyeSize', 'pouch', 'bareHead', 'talon'];
  const SHAPE_SW = ['arms', 'bare', 'teeth', 'tailBone'];
  for (const id of IDS) {
    const s = SPECIES[id];
    s.vec = SHAPE.map((tid) => { const def = G.TRAITS[tid]; return G.unmapTrait(def, s.t[tid] !== undefined ? s.t[tid] : def.mid); });
  }

  // A fresh member of a species. opts: { sex, variation, sport (chance of a visible oddity) }
  function make(id, rng, opts) {
    opts = opts || {};
    const s = SPECIES[id];
    // colour morphs turn up now and then in every kind, and often in domestic ones
    const carriers = Object.assign({ melanic: 0.006, leucistic: 0.02 }, s.morph);
    const g = G.fromTargets(s.t, s.sw, rng, { sex: opts.sex, variation: opts.variation, colorVar: s.cv === undefined ? 0.045 : s.cv, carriers });
    const sport = opts.sport === undefined ? 0.05 : opts.sport;
    if (rng.chance(sport)) G.sport(g, rng, rng.int(1, 3));
    return g;
  }

  function vecOf(g) { return SHAPE.map((tid) => G.trait01(g, tid)); }
  function vecDist(v, s, g) {
    let sum = 0;
    for (let i = 0; i < v.length; i++) { const d = v[i] - s.vec[i]; sum += d * d; }
    let d = Math.sqrt(sum / v.length);
    for (const sw of SHAPE_SW) if (G.switchOn(g, sw) !== s.sw.includes(sw)) d += 0.12;
    return d;
  }
  const vowel = (c) => 'aeiouy'.includes(c.toLowerCase());
  // "Ostrich" + "Duck" -> "Ostruck": A up to its second vowel group, B from its first vowel.
  function blendNames(a, b) {
    a = a.split(' ')[0]; b = b.split(' ')[0];
    let i = 0;
    while (i < a.length && !vowel(a[i])) i++;
    while (i < a.length && vowel(a[i])) i++;
    while (i < a.length && !vowel(a[i])) i++;
    const head = a.slice(0, Math.max(2, i));
    let j = 0;
    while (j < b.length && !vowel(b[j])) j++;
    const tail = j === 0 ? b.toLowerCase() : b.slice(j);
    return head + tail;
  }
  // A name for the kind as a whole, for naming crosses ('Chicken', not 'Hen').
  const GENERIC = { chicken: 'Chicken', gamecock: 'Gamecock', duck: 'Duck', goose: 'Goose', peafowl: 'Peafowl' };
  const generic = (id) => GENERIC[id] || SPECIES[id].short || (Array.isArray(SPECIES[id].name) ? SPECIES[id].name[0] : SPECIES[id].name);
  const nameOf = (s, sex, short) => (Array.isArray(s.name) ? s.name[sex === 'F' ? 1 : 0] : short && s.short ? s.short : s.name);

  // Nearest archetype(s). Returns { id, second, pure, name, d }.
  function classify(g) {
    const v = vecOf(g);
    let best = null, second = null;
    for (const id of IDS) {
      const d = vecDist(v, SPECIES[id], g);
      if (!best || d < best.d) { second = best; best = { id, d }; } else if (!second || d < second.d) second = { id, d };
    }
    const pure = best.d < 0.105;
    const sb = SPECIES[best.id], ss = SPECIES[second.id];
    const name = pure ? nameOf(sb, g.sex) : blendNames(nameOf(sb, g.sex, true), nameOf(ss, g.sex, true));
    return { id: best.id, second: second.id, pure, name, d: best.d };
  }

  RB.species = { SPECIES, IDS, SHAPE, make, classify, blendNames, nameOf, generic };
})();
