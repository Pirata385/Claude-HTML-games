/* The whole game state in one plain object (serialisable as JSON). */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.SEASONS = ['spring', 'summer', 'fall', 'winter'];
  PA.START_WORDS = ['plank', 'ladder', 'crate', 'bridge', 'sign', 'umbrella'];
  PA.newState = function (seed, o) {
    o = o || {};
    return {
      v: 1, seed: seed >>> 0,
      name: o.name || 'Doodle', farm: o.farm || 'Paper Acres',
      seasonDays: o.seasonDays === 14 ? 14 : 28,
      year: 1, season: 0, day: 1, time: 360, weather: 'sun', tomorrow: 'sun',
      gold: 500, hp: 100, maxHp: 100, energy: 270, maxEnergy: 270,
      ink: { graphite: 30, ink: 6 },
      inv: null,
      words: PA.START_WORDS.slice(),
      map: 'house', pos: { x: 15, z: 0, facing: 1 },
      maps: {}, crops: [], objects: [], drawings: [], animals: [],
      npcs: {}, flags: {}, mail: [], quests: [], pages: {}, shipped: [],
      mine: { deepest: 0 }, stats: { days: 0, shipped: 0, drawn: 0 },
      played: 0,
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.newState;
})(typeof window !== 'undefined' ? window : globalThis);
