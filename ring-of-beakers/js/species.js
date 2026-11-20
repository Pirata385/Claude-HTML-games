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
    // Two more for the night. The kakapo: a fat, flightless, moss-green parrot with a mottled back and
    // a face like an owl's. It waddles about after dark and booms like a far-off drum.
    kakapo: { name: 'Kakapo', tier: 4, night: true,
      t: { size: 1.0, posture: 0.45, bodyDepth: 1.45, bodyLen: 1.05, neckLen: 0.35, headSize: 1.25, eyeSize: 1.1, beakLen: 0.75, beakDepth: 1.5, beakHook: 0.95, legLen: 0.55, legThick: 1.4, footSize: 1.3, talon: 0.4, spur: 0, wingSize: 0.6, wingPoint: 0, tailLen: 0.8, tailFan: 0.3, tailUp: 0.1, comb: 0, wattle: 0, crest: 0, hue: 0.25, sat: 0.6, lit: 0.42, litHead: 0.08, pattern: 0.73, patContrast: 0.35, belly: 0.5, beakTone: 0.3, legTone: 0.3, eyeTone: 0.1, courage: 0.5, aggression: 0.3, cunning: 0.6, hide: 1.1, lifespan: 22, voicePitch: 0.05, voiceRasp: 0.2, voiceLen: 1 } },
    // The thick-knee (a stone-curlew): a sandy, streaky ground bird on long yellow legs with knobbly
    // knees, and huge yellow eyes for hunting in the dark. Wails across open country at night.
    thickknee: { name: 'Thick-knee', tier: 2, night: true,
      t: { size: 0.75, posture: 0.4, bodyLen: 1.05, bodyDepth: 0.9, neckLen: 0.7, headSize: 1.2, eyeSize: 1.85, beakLen: 0.75, beakDepth: 0.8, beakHook: 0.1, legLen: 1.45, legThick: 0.9, footSize: 0.9, talon: 0.1, spur: 0, wingSize: 1.2, wingPoint: 0.6, tailLen: 0.7, tailFan: 0.2, tailUp: 0.15, comb: 0, wattle: 0, crest: 0, hue: 0.09, sat: 0.3, lit: 0.55, pattern: 0.73, patContrast: 0.5, belly: 0.75, beakTone: 0.45, legTone: 0.5, eyeTone: 0.95, reflex: 1.3, cunning: 0.7, courage: 0.35, aggression: 0.4, voicePitch: 0.7, voiceRasp: 0.1, voiceLen: 0.9 } },
    // A day bird of the swamps. The shoebill: a tall slate-grey stork-like bird with a head too big for
    // it and a huge clog of a bill with a hook on the end. It stands stock still for hours, then strikes.
    shoebill: { name: 'Shoebill', tier: 4,
      t: { size: 1.55, posture: 0.85, bodyDepth: 1.0, bodyLen: 0.95, neckLen: 1.2, neckThick: 1.2, neckCurve: 0.6, headSize: 1.6, eyeSize: 1.0, beakLen: 2.2, beakDepth: 1.7, beakHook: 0.6, beakFlat: 0.25, legLen: 1.9, legThick: 0.8, footSize: 1.7, talon: 0.2, spur: 0, wingSize: 1.8, wingPoint: 0.1, tailLen: 0.6, tailFan: 0.3, tailUp: 0.1, comb: 0, wattle: 0, crest: 0.35, hue: 0.58, sat: 0.18, lit: 0.55, litWing: -0.05, beakTone: 0.26, legTone: 0.2, eyeTone: 0.75, focus: 1, cunning: 0.6, courage: 0.75, aggression: 0.6, reflex: 0.85, voicePitch: 0.2, voiceRasp: 0.9, voiceLen: 0.6 } },
    // A fossil of titanic size, only rebuilt from fragments (most of them dug up at the Bone Quarry).
    // The elephant bird: the heaviest bird that ever lived, three metres of shaggy brown bird on legs
    // like tree trunks. Slow to anger, impossible to move.
    elephant: { name: 'Elephant Bird', short: 'Elephant', tier: 5, extinct: true,
      t: { size: 2.7, posture: 0.25, bodyDepth: 1.7, bodyLen: 1.15, neckLen: 1.3, neckThick: 1.6, neckCurve: 0.3, headSize: 1.05, eyeSize: 0.6, beakLen: 1.3, beakDepth: 1.35, beakHook: 0.05, legLen: 1.75, legThick: 1.9, footSize: 1.85, talon: 0.5, spur: 0, wingSize: 0.05, tailLen: 0.3, tailFan: 0.5, tailUp: 0.3, comb: 0, wattle: 0, crest: 0, hue: 0.07, sat: 0.35, lit: 0.28, beakTone: 0.25, legTone: 0.22, muscle: 1.45, bone: 1.5, hide: 1.35, lungs: 1.2, reflex: 0.65, aggression: 0.45, courage: 0.85, lifespan: 22, voicePitch: 0, voiceRasp: 0.6, voiceLen: 1 } },
    // Birds of the open sea: they live only on the islands out there.
    // The albatross: a white ocean wanderer with the longest wings of any bird and a pink hooked bill.
    albatross: { name: 'Albatross', tier: 3,
      t: { size: 1.35, posture: 0.3, bodyLen: 1.15, bodyDepth: 1.0, neckLen: 0.55, headSize: 1.1, beakLen: 1.5, beakDepth: 1.0, beakHook: 0.8, legLen: 0.6, legThick: 1.0, footSize: 1.5, web: 1, talon: 0.05, spur: 0, wingSize: 2.3, wingPoint: 1, tailLen: 0.6, tailFan: 0.2, tailUp: 0.2, comb: 0, wattle: 0, crest: 0, hue: 0.1, sat: 0.05, lit: 0.93, litWing: -0.3, litTail: -0.1, beakTone: 0.95, legTone: 1, eyeTone: 0.1, lungs: 1.5, courage: 0.6, aggression: 0.45, voicePitch: 0.35, voiceRasp: 0.5, voiceLen: 0.8 } },
    // The frigatebird: a glossy black pirate of the tropics on long angled wings, with a forked tail, a
    // hooked bill and a red throat pouch it blows up like a balloon.
    frigatebird: { name: 'Frigatebird', short: 'Frigate', tier: 3,
      t: { size: 1.15, posture: 0.55, bodyLen: 1.0, bodyDepth: 0.85, neckLen: 0.45, headSize: 0.95, beakLen: 1.45, beakDepth: 0.7, beakHook: 1, legLen: 0.35, legThick: 0.6, footSize: 0.8, web: 0.3, talon: 0.3, spur: 0, wingSize: 2.3, wingPoint: 1, tailLen: 1.9, tailFan: 0.1, tailUp: 0.15, comb: 0, wattle: 1, combHue: -0.03, hue: 0.7, sat: 0.2, lit: 0.08, sheen: 0.6, beakTone: 0.25, legTone: 0.25, cunning: 0.95, aggression: 0.75, reflex: 1.3, voicePitch: 0.3, voiceRasp: 0.7, voiceLen: 0.8 } },
    // The puffin: a small black-and-white diver with a white face, orange feet and a big striped
    // orange bill that holds a row of fish.
    puffin: { name: 'Puffin', tier: 3,
      t: { size: 0.55, posture: 0.8, bodyDepth: 1.2, bodyLen: 1.0, neckLen: 0.3, headSize: 1.35, beakLen: 0.8, beakDepth: 1.7, beakHook: 0.3, legLen: 0.4, legThick: 1.0, footSize: 1.25, web: 1, talon: 0.1, spur: 0, wingSize: 0.9, wingPoint: 1, tailLen: 0.3, tailFan: 0.1, tailUp: 0.1, comb: 0, wattle: 0, crest: 0, hue: 0.62, sat: 0.1, lit: 0.1, litHead: 0.4, belly: 1, beakTone: 0.75, legTone: 0.75, eyeTone: 0.1, courage: 0.6, aggression: 0.5, reflex: 1.2, voicePitch: 0.3, voiceRasp: 0.7, voiceLen: 0.7 } },
    // Fossils of the open sea, dug up only on its islands.
    // Haast's eagle: the giant eagle that hunted moa, with talons like a tiger's claws.
    haast: { name: 'Haast\'s Eagle', short: 'Haast', tier: 5, extinct: true,
      t: { size: 1.95, posture: 0.6, bodyDepth: 1.2, neckLen: 0.55, neckThick: 1.3, headSize: 1.3, eyeSize: 1.2, beakLen: 1.0, beakDepth: 1.7, beakHook: 1, legLen: 1.1, legThick: 1.9, footSize: 1.9, talon: 1, spur: 0, wingSize: 1.6, wingPoint: 0, tailLen: 1.1, tailFan: 0.4, tailUp: 0.1, comb: 0, wattle: 0, crest: 0.2, hue: 0.07, sat: 0.4, lit: 0.22, litHead: 0.2, beakTone: 0.55, legTone: 0.55, eyeTone: 0.9, muscle: 1.5, bone: 1.3, reflex: 1.2, aggression: 0.95, courage: 0.95, focus: 0.9 } },
    // The great auk: a tall flightless seabird of the north, black and white, with a deep grooved bill.
    auk: { name: 'Great Auk', short: 'Auk', tier: 5, extinct: true,
      t: { size: 1.15, posture: 0.85, bodyDepth: 1.3, bodyLen: 1.15, neckLen: 0.45, headSize: 1.2, beakLen: 1.4, beakDepth: 1.7, beakHook: 0.7, legLen: 0.4, legThick: 1.2, footSize: 1.5, web: 1, talon: 0.1, spur: 0, wingSize: 0.4, wingPoint: 1, tailLen: 0.3, tailFan: 0.1, tailUp: 0.1, comb: 0, wattle: 0, crest: 0, hue: 0.62, sat: 0.1, lit: 0.1, litHead: 0.1, belly: 1, beakTone: 0.05, legTone: 0.05, bone: 1.3, hide: 1.25, lungs: 1.4, courage: 0.75, aggression: 0.6 } },
    // Pelagornis: the biggest flying bird there ever was, with bony teeth along a long bill.
    pelagornis: { name: 'Pelagornis', short: 'Pelagorn', tier: 5, extinct: true, sw: ['teeth'],
      t: { size: 1.75, posture: 0.4, bodyDepth: 0.95, bodyLen: 1.1, neckLen: 1.0, headSize: 1.25, beakLen: 2.2, beakDepth: 1.0, beakHook: 0.7, legLen: 0.6, legThick: 0.9, footSize: 1.4, web: 1, talon: 0.1, spur: 0, wingSize: 2.3, wingPoint: 1, tailLen: 0.7, tailFan: 0.2, tailUp: 0.2, comb: 0, wattle: 0, crest: 0, hue: 0.6, sat: 0.08, lit: 0.75, litWing: -0.25, beakTone: 0.5, legTone: 0.75, lungs: 1.5, reflex: 1.1, aggression: 0.7, courage: 0.7 } },
    // A dinosaur. Tyrannosaurus: a titanic bare-skinned two-legged hunter with a great toothy head,
    // a long stiff tail and comically small arms. Dug up at the Bone Quarry and on volcanic islands.
    trex: { name: 'Tyrannosaurus', short: 'Tyranno', tier: 5, extinct: true, sw: ['teeth', 'tailBone', 'arms', 'bare'],
      t: { billShape: 'jaws', size: 2.7, posture: 0.15, bodyLen: 1.3, bodyDepth: 1.35, neckLen: 0.9, neckThick: 1.7, neckCurve: 0.6, headSize: 1.6, eyeSize: 0.8, beakLen: 1.6, beakDepth: 1.7, beakHook: 0.1, legLen: 2.0, legThick: 1.9, footSize: 1.9, talon: 1, spur: 0, wingSize: 0, tailLen: 2.6, tailFan: 0.05, tailUp: 0.5, comb: 0, wattle: 0, crest: 0, hue: 0.22, sat: 0.35, lit: 0.32, pattern: 0.27, patContrast: 0.3, belly: 0.6, beakTone: 0.22, legTone: 0.3, eyeTone: 0.85, armLen: 0.55, muscle: 1.5, bone: 1.5, hide: 1.4, lungs: 1.3, reflex: 0.9, aggression: 1, courage: 1, focus: 0.8, voicePitch: 0, voiceRasp: 1, voiceLen: 1 } },
    // Three more for the night.
    // The tawny frogmouth: a grey, bark-streaked bird with a huge flat head, a bill like a wide frog's
    // mouth and yellow eyes. By day it poses as a broken branch; at night it thumps out low 'oom's.
    frogmouth: { name: 'Frogmouth', tier: 3, night: true,
      t: { size: 0.8, posture: 0.85, bodyDepth: 1.1, bodyLen: 0.95, neckLen: 0.25, headSize: 1.6, eyeSize: 1.3, beakLen: 0.75, beakDepth: 0.85, beakHook: 0.8, beakFlat: 1, legLen: 0.3, legThick: 0.8, footSize: 0.8, talon: 0.15, spur: 0, wingSize: 1.25, wingPoint: 0.2, tailLen: 1.15, tailFan: 0.35, tailUp: 0.05, comb: 0, wattle: 0, crest: 0.25, hue: 0.08, sat: 0.06, lit: 0.55, pattern: 0.73, patContrast: 0.45, belly: 0.55, beakTone: 0.25, legTone: 0.3, eyeTone: 0.9, focus: 0.85, cunning: 0.7, courage: 0.5, aggression: 0.35, hide: 1.1, voicePitch: 0.1, voiceRasp: 0.15, voiceLen: 0.6 } },
    // The oilbird: a chestnut cave bird speckled with white, with a strong hooked bill, long wings, a
    // long tail and tiny feet. It finds its way in the dark by clicking, and screams when disturbed.
    oilbird: { name: 'Oilbird', tier: 3, night: true,
      t: { size: 0.82, posture: 0.6, bodyLen: 1.15, bodyDepth: 0.9, neckLen: 0.35, headSize: 1.1, eyeSize: 1.5, beakLen: 0.75, beakDepth: 1.2, beakHook: 1, beakFlat: 0.3, legLen: 0.42, legThick: 0.55, footSize: 0.9, talon: 0.2, spur: 0, wingSize: 2.0, wingPoint: 0.6, tailLen: 1.7, tailFan: 0.5, tailUp: 0.2, comb: 0, wattle: 0, crest: 0, hue: 0.05, sat: 0.55, lit: 0.33, pattern: 0.73, patContrast: 0.4, belly: 0.4, beakTone: 0.55, legTone: 0.92, eyeTone: 0.1, cunning: 0.6, reflex: 1.2, courage: 0.4, aggression: 0.45, hide: 1.0, voicePitch: 0.75, voiceRasp: 0.9, voiceLen: 0.7 } },
    // The boat-billed heron: a stocky night heron with a black cap and crest, enormous dark eyes and
    // a broad bill shaped like an upturned boat, for scooping up whatever moves in the shallows.
    boatbill: { name: 'Boat-billed Heron', short: 'Boatbill', tier: 3, night: true,
      t: { size: 1.0, posture: 0.55, bodyDepth: 1.05, bodyLen: 1.0, neckLen: 0.9, neckCurve: 0.8, neckThick: 1.0, headSize: 1.35, eyeSize: 1.8, beakLen: 1.1, beakDepth: 1.15, beakFlat: 1, beakHook: 0.35, legLen: 1.2, legThick: 0.7, footSize: 1.3, talon: 0.15, spur: 0, wingSize: 1.5, tailLen: 0.45, tailFan: 0.2, tailUp: 0.2, comb: 0, wattle: 0, crest: 0.8, hue: 0.6, sat: 0.12, lit: 0.72, litHead: -0.55, belly: 0.7, beakTone: 0.15, legTone: 0.5, eyeTone: 0.1, focus: 0.8, reflex: 1.15, courage: 0.5, aggression: 0.5, voicePitch: 0.25, voiceRasp: 0.7, voiceLen: 0.5 } },
    // Three more by day.
    // The grey crowned crane: a tall grey crane with white wings, a black-and-white face, a red throat
    // wattle and a crown of stiff golden feathers. It dances, bows and booms.
    crane: { name: 'Crowned Crane', short: 'Crane', tier: 3,
      t: { size: 1.3, posture: 0.55, bodyDepth: 0.9, bodyLen: 1.0, neckLen: 1.7, neckCurve: 0.5, neckThick: 0.7, headSize: 0.9, eyeSize: 1.0, beakLen: 0.85, beakDepth: 0.7, beakHook: 0, legLen: 2.2, legThick: 0.65, footSize: 1.1, talon: 0.15, spur: 0, wingSize: 1.7, tailLen: 0.55, tailFan: 0.3, tailUp: 0.3, comb: 0, wattle: 0.6, crest: 1, hue: 0.6, sat: 0.08, lit: 0.55, litWing: 0.35, litHead: -0.4, beakTone: 0.2, legTone: 0.15, eyeTone: 0.6, bone: 0.75, reflex: 1.2, aggression: 0.5, courage: 0.6, voicePitch: 0.35, voiceRasp: 0.3, voiceLen: 0.8 } },
    // The laughing kookaburra: a big stocky kingfisher with a cream head, a dark eye stripe, a huge
    // straight bill and a rufous barred tail. Its call is a loud, mad cackle.
    kookaburra: { name: 'Kookaburra', tier: 2,
      t: { size: 0.68, posture: 0.65, bodyDepth: 1.15, bodyLen: 0.95, neckLen: 0.3, headSize: 1.5, eyeSize: 1.0, beakLen: 1.55, beakDepth: 1.25, beakHook: 0.15, beakFlat: 0.2, legLen: 0.35, legThick: 0.8, footSize: 0.8, talon: 0.3, spur: 0, wingSize: 1.2, wingPoint: 0.3, tailLen: 1.1, tailFan: 0.3, tailUp: 0.15, comb: 0, wattle: 0, crest: 0.3, hue: 0.08, sat: 0.35, lit: 0.62, litWing: -0.3, litHead: 0.12, hueTail: -0.03, belly: 0.8, beakTone: 0.08, legTone: 0.2, eyeTone: 0.2, cunning: 0.8, reflex: 1.25, aggression: 0.75, courage: 0.75, voicePitch: 0.55, voiceRasp: 0.4, voiceLen: 1 } },
    // The marabou stork: a huge undertaker of a stork, black-cloaked and white-bellied, with a bare
    // pink head, a dangling throat pouch and a bill like a pickaxe. Clatters its bill instead of calling.
    marabou: { name: 'Marabou Stork', short: 'Marabou', tier: 3,
      t: { size: 1.65, posture: 0.6, bodyDepth: 1.15, bodyLen: 1.0, neckLen: 1.2, neckCurve: 0.8, neckThick: 0.9, headSize: 1.0, eyeSize: 0.9, beakLen: 2.0, beakDepth: 1.4, beakHook: 0.05, beakFlat: 0.2, pouch: 0.8, legLen: 2.0, legThick: 0.85, footSize: 1.3, talon: 0.15, spur: 0, wingSize: 2.1, wingPoint: 0.2, tailLen: 0.5, tailFan: 0.3, tailUp: 0.2, comb: 0, wattle: 0.2, bareHead: 1, combHue: -0.04, hue: 0.6, sat: 0.1, lit: 0.22, belly: 0.85, beakTone: 0.6, legTone: 0.6, eyeTone: 0.5, hide: 1.3, cunning: 0.7, aggression: 0.6, courage: 0.7, voicePitch: 0.1, voiceRasp: 0.8, voiceLen: 0.6 } },
    // Three more birds of the sea.
    // The cormorant: a glossy black diver with a long snaky neck, a thin hooked bill, big webbed feet
    // and a stiff tail. Stands on rocks with its wings hung out to dry. Lives on the coast as well.
    cormorant: { name: 'Cormorant', tier: 2,
      t: { size: 0.95, posture: 0.7, bodyLen: 1.2, bodyDepth: 0.85, neckLen: 1.5, neckCurve: 0.6, neckThick: 0.7, headSize: 0.85, eyeSize: 1.0, beakLen: 1.25, beakDepth: 0.6, beakHook: 0.8, beakFlat: 0, legLen: 0.4, legThick: 1.0, footSize: 1.6, web: 1, talon: 0.1, spur: 0, wingSize: 1.4, wingPoint: 0.4, tailLen: 1.1, tailFan: 0.25, tailUp: 0.2, comb: 0, wattle: 0, crest: 0.2, hue: 0.45, sat: 0.25, lit: 0.08, sheen: 0.8, beakTone: 0.1, legTone: 0, eyeTone: 0.7, lungs: 1.3, reflex: 1.2, courage: 0.6, aggression: 0.6, voicePitch: 0.15, voiceRasp: 0.8, voiceLen: 0.5 } },
    // The red-footed booby: a brown-and-white plunge-diver with a pale pointed bill, long pointed
    // wings and bright red webbed feet it shows off in a high-stepping dance.
    booby: { name: 'Red-footed Booby', short: 'Booby', tier: 3,
      t: { size: 0.95, posture: 0.55, bodyLen: 1.1, bodyDepth: 1.0, neckLen: 0.6, headSize: 1.1, eyeSize: 1.1, beakLen: 1.25, beakDepth: 1.3, beakHook: 0, beakFlat: 0, legLen: 0.45, legThick: 0.9, footSize: 1.85, web: 1, talon: 0.05, spur: 0, wingSize: 2.05, wingPoint: 1, tailLen: 1.0, tailFan: 0.1, tailUp: 0.25, comb: 0, wattle: 0, hue: 0.08, sat: 0.25, lit: 0.55, litWing: -0.3, belly: 0.8, beakTone: 0.25, legTone: 1, eyeTone: 0.5, lungs: 1.2, reflex: 1.2, courage: 0.65, aggression: 0.5, voicePitch: 0.45, voiceRasp: 0.5, voiceLen: 0.5 } },
    // The red-billed tropicbird: a white seabird with a black eye stripe, a fine-barred back, a
    // coral-red bill and two white tail streamers longer than the rest of it. Barely able to walk.
    tropicbird: { name: 'Tropicbird', tier: 3,
      t: { size: 0.7, posture: 0.3, bodyLen: 1.1, bodyDepth: 0.9, neckLen: 0.4, headSize: 1.05, eyeSize: 1.1, beakLen: 0.95, beakDepth: 0.9, beakHook: 0.2, legLen: 0.42, legThick: 0.6, footSize: 1.2, web: 1, talon: 0.05, spur: 0, wingSize: 1.75, wingPoint: 1, tailLen: 2.6, tailFan: 0, tailUp: 0.2, comb: 0, wattle: 0, sat: 0.03, lit: 0.95, litWing: -0.15, pattern: 0, beakTone: 1, legTone: 0.6, eyeTone: 0.05, reflex: 1.35, courage: 0.5, aggression: 0.5, voicePitch: 0.85, voiceRasp: 0.3, voiceLen: 0.6 } },
    // Three more fossils.
    // Gastornis: a giant flightless bird of the old forests, taller than a man, with stumpy wings,
    // legs like posts and a bill so deep it could crack a coconut. Dug up under farmland.
    gastornis: { name: 'Gastornis', tier: 5, extinct: true,
      t: { size: 2.3, posture: 0.35, bodyDepth: 1.35, bodyLen: 1.05, neckLen: 1.1, neckThick: 1.6, neckCurve: 0.4, headSize: 1.6, eyeSize: 0.8, beakLen: 1.35, beakDepth: 1.7, beakHook: 0.2, legLen: 1.35, legThick: 1.8, footSize: 1.6, talon: 0.6, spur: 0, wingSize: 0.15, tailLen: 0.4, tailFan: 0.4, tailUp: 0.3, comb: 0, wattle: 0, crest: 0, hue: 0.06, sat: 0.3, lit: 0.3, belly: 0.6, beakTone: 0.55, legTone: 0.25, muscle: 1.45, bone: 1.4, hide: 1.3, reflex: 0.8, aggression: 0.7, courage: 0.9, voicePitch: 0.05, voiceRasp: 0.6, voiceLen: 1 } },
    // Gallimimus: a feathered dinosaur built like an ostrich with a stiff tail and little clawed arms,
    // with a toothless beak. The fastest thing on two legs. Dug up at the Bone Quarry.
    gallimimus: { name: 'Gallimimus', short: 'Gallimim', tier: 5, extinct: true, sw: ['tailBone', 'arms'],
      t: { size: 2.2, posture: 0.25, bodyLen: 1.25, bodyDepth: 0.95, neckLen: 1.9, neckThick: 0.8, neckCurve: 0.3, headSize: 0.8, eyeSize: 1.4, beakLen: 1.1, beakDepth: 0.6, beakHook: 0, beakFlat: 0.3, legLen: 2.2, legThick: 1.3, footSize: 1.3, talon: 0.6, spur: 0, wingSize: 0.3, tailLen: 2.4, tailFan: 0.1, tailUp: 0.45, comb: 0, wattle: 0, crest: 0, hue: 0.1, sat: 0.4, lit: 0.45, litWing: -0.15, belly: 0.75, beakTone: 0.35, legTone: 0.3, eyeTone: 0.8, armLen: 0.8, muscle: 1.25, lungs: 1.4, reflex: 1.35, courage: 0.4, aggression: 0.35, voicePitch: 0.2, voiceRasp: 0.5, voiceLen: 0.9 } },
    // Pteranodon: not a bird at all but a flying reptile, leathery and bare, with wings longer than a
    // boat, no tail, and a long toothless bill balanced by a crest sweeping back from its head.
    // Dug up on the islands of the open sea.
    pteranodon: { name: 'Pteranodon', short: 'Pterano', tier: 5, extinct: true, sw: ['bare'],
      t: { size: 1.5, posture: 0.5, bodyLen: 0.9, bodyDepth: 0.75, neckLen: 0.9, neckThick: 0.7, headSize: 1.2, eyeSize: 1.0, beakLen: 2.3, beakDepth: 0.7, beakHook: 0, legLen: 0.65, legThick: 0.6, footSize: 0.9, web: 0.3, talon: 0.5, spur: 0, wingSize: 2.3, wingPoint: 1, tailLen: 0.05, tailFan: 0, comb: 0, wattle: 0, crest: 1, hue: 0.05, sat: 0.35, lit: 0.45, beakTone: 0.6, legTone: 0.4, eyeTone: 0.8, reflex: 1.2, cunning: 0.6, aggression: 0.6, courage: 0.7, voicePitch: 0.5, voiceRasp: 0.9, voiceLen: 0.7 } },
    // Added with the bill shapes (genome.js: billShape), at the end like the others. Birds whose bills
    // could not be built before: a spoon, a sickle, an upturned awl, crossed tips, a helmet on top, a
    // lower half longer than the upper, a needle longer than the bird. And two birds-of-paradise.
    // The roseate spoonbill: a pink wader with a bare greenish head and a long bill ending in a flat
    // spoon it sweeps from side to side through the shallows.
    spoonbill: { name: 'Roseate Spoonbill', short: 'Spoonbill', tier: 3,
      t: { billShape: 'spoon', size: 1.0, posture: 0.5, bodyDepth: 0.95, bodyLen: 1.0, neckLen: 1.4, neckCurve: 0.5, neckThick: 0.8, headSize: 0.95, eyeSize: 0.9, beakLen: 1.7, beakDepth: 0.6, beakHook: 0, beakFlat: 0.4, legLen: 1.9, legThick: 0.6, footSize: 1.1, web: 0.4, talon: 0.1, spur: 0, wingSize: 1.6, tailLen: 0.5, tailFan: 0.3, tailUp: 0.3, comb: 0, wattle: 0, crest: 0, bareHead: 0.4, combHue: 0.25, hue: 0.95, hueHead: 0.12, litHead: 0.1, sat: 0.6, lit: 0.72, litWing: -0.08, belly: 0.2, beakTone: 0.3, legTone: 0.95, eyeTone: 0.75, reflex: 1.1, courage: 0.45, aggression: 0.4, voicePitch: 0.3, voiceRasp: 0.6, voiceLen: 0.3 } },
    // The scarlet ibis: a wader so red it glows, with a long bill curved down like a sickle.
    ibis: { name: 'Scarlet Ibis', short: 'Ibis', tier: 3,
      t: { billShape: 'down', size: 0.85, posture: 0.5, bodyDepth: 0.95, neckLen: 1.2, neckCurve: 0.5, neckThick: 0.75, headSize: 0.9, eyeSize: 0.9, beakLen: 1.9, beakDepth: 0.55, beakHook: 0, legLen: 1.5, legThick: 0.6, footSize: 1.1, web: 0.3, talon: 0.1, spur: 0, wingSize: 1.5, wingPoint: 0.5, tailLen: 0.5, tailFan: 0.2, comb: 0, wattle: 0, crest: 0, bareHead: 0.35, combHue: -0.02, hue: 0.0, sat: 0.9, lit: 0.5, litWing: -0.03, beakTone: 0.15, legTone: 0.95, eyeTone: 0.6, reflex: 1.15, courage: 0.45, aggression: 0.45, voicePitch: 0.45, voiceRasp: 0.7, voiceLen: 0.3 } },
    // The pied avocet: a black-and-white shorebird on long blue-grey legs, with a fine bill that
    // curves up at the end, swept through the water like a scythe.
    avocet: { name: 'Pied Avocet', short: 'Avocet', tier: 2,
      t: { billShape: 'up', size: 0.6, posture: 0.45, bodyDepth: 0.9, neckLen: 1.1, neckThick: 0.7, headSize: 0.9, eyeSize: 1.0, beakLen: 1.7, beakDepth: 0.45, beakHook: 0, legLen: 1.9, legThick: 0.5, footSize: 1.0, web: 0.6, talon: 0.05, spur: 0, wingSize: 1.4, wingPoint: 0.8, tailLen: 0.5, tailFan: 0.2, comb: 0, wattle: 0, crest: 0, hue: 0.6, sat: 0.03, lit: 0.92, litHead: -0.6, pattern: 0.05, patContrast: 1, belly: 0.9, beakTone: 0, legTone: 0.25, eyeTone: 0.3, reflex: 1.25, courage: 0.55, aggression: 0.55, voicePitch: 0.8, voiceRasp: 0.2, voiceLen: 0.3 } },
    // The red crossbill: a stocky red finch whose bill tips cross over, for prising seeds out of cones.
    crossbill: { name: 'Red Crossbill', short: 'Crossbill', tier: 2,
      t: { billShape: 'crossed', size: 0.32, posture: 0.6, bodyDepth: 1.15, bodyLen: 0.95, neckLen: 0.3, headSize: 1.2, eyeSize: 1.0, beakLen: 0.75, beakDepth: 1.1, beakHook: 0.5, legLen: 0.4, legThick: 0.6, footSize: 0.8, talon: 0.3, spur: 0, wingSize: 1.3, wingPoint: 0.6, tailLen: 0.9, tailFan: 0.2, tailUp: 0.3, comb: 0, wattle: 0, crest: 0, hue: 0.0, sat: 0.7, lit: 0.45, litWing: -0.25, hueWing: 0.05, litTail: -0.2, beakTone: 0.25, legTone: 0.25, eyeTone: 0.1, reflex: 1.3, cunning: 0.7, courage: 0.5, aggression: 0.5, voicePitch: 0.9, voiceRasp: 0.2, voiceLen: 0.2 } },
    // The great hornbill: black and white, with a huge yellow bill and a hollow helmet (the casque) on top.
    hornbill: { name: 'Great Hornbill', short: 'Hornbill', tier: 3,
      t: { billShape: 'casque', size: 1.15, posture: 0.55, bodyDepth: 0.95, bodyLen: 1.05, neckLen: 0.7, neckThick: 0.9, headSize: 1.1, eyeSize: 1.0, beakLen: 1.9, beakDepth: 1.5, beakHook: 0.3, legLen: 0.5, legThick: 0.8, footSize: 1.0, talon: 0.3, spur: 0, wingSize: 1.8, wingPoint: 0.3, tailLen: 1.6, tailFan: 0.3, tailUp: 0.2, comb: 0, wattle: 0, crest: 0, hue: 0.12, sat: 0.1, lit: 0.12, litHead: 0.6, litTail: 0.6, belly: 0.6, beakTone: 0.6, legTone: 0.2, eyeTone: 0.7, bone: 1.15, reflex: 1.05, courage: 0.7, aggression: 0.55, voicePitch: 0.15, voiceRasp: 0.8, voiceLen: 0.6 } },
    // The black skimmer: a tern-like seabird with a red-and-black bill whose lower half is longer than
    // the upper, ploughed through the water's surface in flight.
    skimmer: { name: 'Black Skimmer', short: 'Skimmer', tier: 2,
      t: { billShape: 'skimmer', size: 0.6, posture: 0.35, bodyDepth: 0.85, bodyLen: 1.05, neckLen: 0.5, headSize: 1.0, eyeSize: 1.0, beakLen: 1.5, beakDepth: 0.9, beakHook: 0, beakFlat: 0, legLen: 0.4, legThick: 0.6, footSize: 1.0, web: 0.8, talon: 0.05, spur: 0, wingSize: 2.0, wingPoint: 1, tailLen: 0.6, tailFan: 0.2, comb: 0, wattle: 0, crest: 0, hue: 0.6, sat: 0.05, lit: 0.1, belly: 1, beakTone: 0.95, legTone: 0.95, eyeTone: 0.1, reflex: 1.3, courage: 0.55, aggression: 0.5, voicePitch: 0.6, voiceRasp: 0.5, voiceLen: 0.4 } },
    // The sword-billed hummingbird: a little green hummingbird with a bill longer than the rest of it.
    swordbill: { name: 'Sword-billed Hummingbird', short: 'Swordbill', tier: 3,
      t: { billShape: 'sword', size: 0.22, posture: 0.5, bodyDepth: 0.9, bodyLen: 0.95, neckLen: 0.25, headSize: 1.0, eyeSize: 1.0, beakLen: 2.4, beakDepth: 0.45, beakHook: 0, legLen: 0.2, legThick: 0.4, footSize: 0.5, talon: 0.1, spur: 0, wingSize: 1.6, wingPoint: 1, tailLen: 1.0, tailFan: 0.4, tailUp: 0.4, comb: 0, wattle: 0, crest: 0, hue: 0.33, sat: 0.6, lit: 0.35, sheen: 0.9, beakTone: 0, legTone: 0, eyeTone: 0.05, reflex: 1.5, cunning: 0.8, courage: 0.5, aggression: 0.55, voicePitch: 1, voiceRasp: 0.1, voiceLen: 0.15 } },
    // The greater bird-of-paradise: a maroon bird with a yellow head and an emerald throat, whose
    // golden plumes spill from it in a great fountain when it shows off.
    paradise: { name: 'Greater Bird-of-paradise', short: 'Paradise', tier: 4,
      t: { size: 0.65, posture: 0.55, bodyDepth: 1.0, bodyLen: 0.95, neckLen: 0.4, headSize: 1.05, eyeSize: 1.0, beakLen: 0.9, beakDepth: 0.9, beakHook: 0.2, legLen: 0.5, legThick: 0.7, footSize: 0.9, talon: 0.3, spur: 0, wingSize: 1.2, wingPoint: 0.3, tailLen: 2.4, tailFan: 1.0, tailUp: 0.65, comb: 0, wattle: 0, crest: 0, hue: 0.04, sat: 0.5, lit: 0.25, hueHead: 0.1, litHead: 0.35, hueTail: 0.08, litTail: 0.45, sheen: 0.7, beakTone: 0.3, legTone: 0.25, eyeTone: 0.9, reflex: 1.2, cunning: 0.6, courage: 0.5, aggression: 0.45, voicePitch: 0.7, voiceRasp: 0.6, voiceLen: 0.6 } },
    // The king bird-of-paradise: a tiny crimson bird with a white belly, blue legs and two long tail
    // wires ending in green coils.
    kingparadise: { name: 'King Bird-of-paradise', short: 'Kingbird', tier: 4,
      t: { size: 0.35, posture: 0.6, bodyDepth: 1.1, bodyLen: 0.9, neckLen: 0.3, headSize: 1.1, eyeSize: 1.0, beakLen: 0.75, beakDepth: 0.8, beakHook: 0.15, legLen: 0.4, legThick: 0.6, footSize: 0.8, talon: 0.2, spur: 0, wingSize: 1.1, wingPoint: 0.4, tailLen: 2.2, tailFan: 0, tailUp: 0.4, comb: 0, wattle: 0, crest: 0, hue: 0.98, sat: 0.9, lit: 0.45, belly: 0.85, sheen: 0.6, hueTail: 0.3, beakTone: 0.75, legTone: 0.25, eyeTone: 0.4, reflex: 1.3, cunning: 0.6, courage: 0.5, aggression: 0.5, voicePitch: 0.85, voiceRasp: 0.3, voiceLen: 0.4 } },
    // A dinosaur. Spinosaurus: the longest hunter there ever was, with a crocodile's long narrow snout
    // full of cone teeth, a great sail along its back, clawed arms and a paddle of a tail. It fished
    // the rivers. Dug up at the Bone Quarry and on desert islands.
    spino: { name: 'Spinosaurus', short: 'Spino', tier: 5, extinct: true, sw: ['teeth', 'tailBone', 'arms', 'bare', 'sail'],
      t: { billShape: 'snout', size: 2.65, posture: 0.12, bodyLen: 1.5, bodyDepth: 1.15, neckLen: 1.1, neckThick: 1.3, neckCurve: 0.5, headSize: 1.3, eyeSize: 0.7, beakLen: 2.3, beakDepth: 0.8, beakHook: 0, legLen: 1.3, legThick: 1.6, footSize: 1.7, web: 0.7, talon: 1, spur: 0, wingSize: 0, tailLen: 2.6, tailFan: 0.05, tailUp: 0.4, comb: 0, wattle: 0, crest: 0, hue: 0.15, sat: 0.3, lit: 0.35, pattern: 0.27, patContrast: 0.25, belly: 0.6, combHue: 0.0, beakTone: 0.2, legTone: 0.3, eyeTone: 0.85, armLen: 0.9, muscle: 1.4, bone: 1.4, hide: 1.35, lungs: 1.4, reflex: 0.95, aggression: 0.95, courage: 0.95, focus: 0.75, voicePitch: 0.05, voiceRasp: 1, voiceLen: 1 } },
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

  // A fresh member of a species. opts: { sex, variation, sport (chance of a visible oddity),
  //   targets (trait targets laid over the species' own: an island's local race) }
  function make(id, rng, opts) {
    opts = opts || {};
    const s0 = SPECIES[id], s = opts.targets ? Object.assign({}, s0, { t: Object.assign({}, s0.t, opts.targets) }) : s0;
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
    if (G.billShape(g) !== (s.t.billShape || 'plain')) d += 0.14; // a spoon or a sickle says a lot about a bird
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
