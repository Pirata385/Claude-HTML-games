/* The words you can give to a drawing: only inanimate things. shape = what the classifier looks for. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  // [id, name, cat, mult, aspect[lo,hi], dom (h|v|d|round|box|any), closed (true|false|null), body, extra]
  const W = [
    ['bridge', 'Bridge', 'structure', 1.2, [3, 20], 'h', null, 'static'],
    ['plank', 'Plank', 'structure', 0.8, [2.5, 30], 'h', null, 'dynamic'],
    ['ladder', 'Ladder', 'structure', 1, [0.05, 0.6], 'v', null, 'ladder', { rungs: true }],
    ['stairs', 'Stairs', 'structure', 1.2, [0.5, 2.2], 'd', null, 'static'],
    ['platform', 'Platform', 'structure', 1, [2, 10], 'h', null, 'static'],
    ['wall', 'Wall', 'structure', 1, [0.08, 0.7], 'box', null, 'static'],
    ['fence', 'Fence', 'structure', 0.8, [1.5, 9], 'h', null, 'static', { rungs: true }],
    ['pillar', 'Pillar', 'structure', 1, [0.1, 0.45], 'v', null, 'static'],
    ['shelter', 'Shelter', 'structure', 1.5, [0.7, 2.2], 'box', null, 'static'],
    ['sign', 'Sign', 'structure', 0.6, [0.9, 3.5], 'box', true, 'static'],
    ['crate', 'Crate', 'physics', 1, [0.7, 1.4], 'box', true, 'dynamic'],
    ['boulder', 'Boulder', 'physics', 1.4, [0.7, 1.45], 'round', true, 'dynamic', { density: 0.012 }],
    ['ball', 'Ball', 'physics', 0.8, [0.8, 1.25], 'round', true, 'dynamic', { bounce: 0.85, density: 0.0008 }],
    ['wheel', 'Wheel', 'physics', 1, [0.8, 1.25], 'round', true, 'dynamic', { friction: 1 }],
    ['cart', 'Cart', 'physics', 1.4, [1.2, 3], 'box', null, 'dynamic'],
    ['boat', 'Boat', 'physics', 1.5, [1.8, 5], 'h', null, 'float'],
    ['raft', 'Raft', 'physics', 1.2, [2, 7], 'h', null, 'float'],
    ['balloon', 'Balloon', 'physics', 1.3, [0.55, 1.2], 'round', true, 'balloon'],
    ['umbrella', 'Umbrella', 'physics', 1, [0.7, 2.2], 'any', null, 'item'],
    ['spring', 'Spring', 'physics', 1.2, [0.25, 1.1], 'd', false, 'spring'],
    ['anchor', 'Anchor', 'physics', 1.5, [0.5, 1.6], 'any', null, 'dynamic', { density: 0.02 }],
    ['rope', 'Rope', 'physics', 0.6, [0.05, 30], 'any', false, 'rope'],
    ['seesaw', 'Seesaw', 'physics', 1.3, [3, 12], 'h', null, 'seesaw'],
    ['watering_can', 'Watering Can', 'tool', 1.2, [0.8, 2.5], 'any', null, 'item', { as: 'can' }],
    ['hoe', 'Hoe', 'tool', 1, [0.2, 5], 'any', false, 'item', { as: 'hoe' }],
    ['axe', 'Axe', 'tool', 1, [0.3, 3], 'any', null, 'item', { as: 'axe' }],
    ['pickaxe', 'Pickaxe', 'tool', 1.1, [0.6, 3], 'any', null, 'item', { as: 'pickaxe' }],
    ['fishing_rod', 'Fishing Rod', 'tool', 1, [0.2, 6], 'd', false, 'item', { as: 'rod' }],
    ['bucket', 'Bucket', 'tool', 0.8, [0.6, 1.5], 'box', null, 'item', { as: 'can' }],
    ['lantern', 'Lantern', 'tool', 1.2, [0.4, 1.3], 'box', null, 'item', { light: true }],
    ['sprinkler', 'Sprinkler', 'tool', 2, [0.6, 2.5], 'any', null, 'object', { as: 'sprinkler' }],
    ['scarecrow', 'Scarecrow', 'tool', 1.5, [0.4, 1.4], 'any', null, 'object', { as: 'scarecrow' }],
    ['sword', 'Sword', 'combat', 1.2, [0.05, 0.5], 'v', false, 'item', { as: 'sword' }],
    ['hammer', 'Hammer', 'combat', 1.4, [0.3, 1.5], 'any', null, 'item', { as: 'sword', heavy: true }],
    ['spear', 'Spear', 'combat', 1.1, [0.03, 0.3], 'v', false, 'item', { as: 'sword', long: true }],
    ['shield', 'Shield', 'combat', 1.3, [0.5, 1.1], 'round', true, 'item', { shield: true }],
    ['boomerang', 'Boomerang', 'combat', 1, [0.8, 2.6], 'd', false, 'item', { thrown: true }],
    ['bomb', 'Bomb', 'combat', 2, [0.8, 1.3], 'round', true, 'bomb'],
    ['chair', 'Chair', 'home', 0.8, [0.4, 1.1], 'any', null, 'static'],
    ['table', 'Table', 'home', 1, [1.2, 4], 'h', null, 'static'],
    ['bed', 'Bed', 'home', 1.5, [1.8, 5], 'box', null, 'static'],
    ['lamp', 'Lamp', 'home', 1, [0.25, 0.9], 'v', null, 'static', { light: true }],
    ['painting', 'Painting', 'home', 0.8, [0.6, 2.2], 'box', true, 'static'],
    ['flower_pot', 'Flower Pot', 'home', 0.7, [0.5, 1.5], 'any', null, 'static'],
    ['clock', 'Clock', 'home', 1, [0.8, 1.25], 'round', true, 'static'],
  ];
  const ALL = W.map(([id, name, cat, mult, aspect, dom, closed, body, extra]) => Object.assign({ id, name, cat, mult, aspect, dom, closed, body }, extra || {}));
  const BY = {};
  for (const w of ALL) BY[w.id] = w;
  PA.Words = { ALL, get: (id) => BY[id] || null };
  PA.START_WORDS_LIST = ['plank', 'ladder', 'crate', 'bridge', 'sign', 'umbrella'];
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.Words;
})(typeof window !== 'undefined' ? window : globalThis);
