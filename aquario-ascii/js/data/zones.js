// Água-Tinta — the five waters (owner B). Pure data (§5.1). Names: strings-world.js (zone.<id>.name).
//
// dark: { always, below, nightBelow } — depth fractions. `always` → dark below `below` at any hour;
//        at night the water is dark below `nightBelow` (above it the moon still lights the water). See AQ.world.isDark.
// req:  informative unlock requirements (D's AQ.progress is the authority): boat tier, line/lantern tier,
//        and `species` = n species caught in zone `from`.
(function (AQ) {
  'use strict';

  var list = [
    { id: 'baia', order: 0, depth: 70, mPerUnit: 0.17, maxM: 12,
      dark: { always: false, below: 1, nightBelow: 0.5 },
      bottom: 'sand', features: ['seagrass', 'rocks', 'caustics'],
      floorProfile: { base: 0.92, amp: 0.06, freq: 0.05 },
      popFactor: 1.0, music: 'baia', ambience: 'shallow', sightings: ['golfinhos'], frenzy: true,
      req: { boat: 1 } },
    { id: 'recife', order: 1, depth: 100, mPerUnit: 0.25, maxM: 25,
      dark: { always: false, below: 1, nightBelow: 0.5 },
      bottom: 'coral', features: ['coral', 'anemones', 'holes', 'caustics'],
      floorProfile: { base: 0.92, amp: 0.06, freq: 0.05 },
      popFactor: 1.1, music: 'recife', ambience: 'reef', sightings: ['tartaruga'], frenzy: true,
      req: { boat: 2, species: { from: 'baia', n: 5 } } },
    { id: 'kelp', order: 2, depth: 140, mPerUnit: 0.29, maxM: 40,
      dark: { always: false, below: 1, nightBelow: 0.4 },
      bottom: 'rocks', features: ['kelp', 'boulders', 'caves'],
      floorProfile: { base: 0.92, amp: 0.06, freq: 0.05 },
      popFactor: 0.9, music: 'kelp', ambience: 'kelp', sightings: [], frenzy: true,
      req: { boat: 3, species: { from: 'recife', n: 5 } } },
    { id: 'mar', order: 3, depth: 220, mPerUnit: 0.9, maxM: 200,
      dark: { always: true, below: 0.7, nightBelow: 0.3 },
      bottom: 'far', features: ['open', 'schools', 'bigWaves'],
      floorProfile: { base: 0.92, amp: 0.06, freq: 0.05 },
      popFactor: 0.7, music: 'mar', ambience: 'open', sightings: ['baleia', 'golfinhos'], frenzy: true,
      req: { boat: 4, line: 3, species: { from: 'kelp', n: 5 } } },
    { id: 'abismo', order: 4, depth: 320, mPerUnit: 5, maxM: 1600,
      dark: { always: true, below: 0.15, nightBelow: 0 },
      bottom: 'vents', features: ['cliffs', 'vents', 'snow'],
      floorProfile: { base: 0.92, amp: 0.08, freq: 0.05 },
      popFactor: 0.6, music: 'abismo', ambience: 'deep', sightings: [], frenzy: false,
      req: { boat: 5, lantern: 1, species: { from: 'mar', n: 6 } } }
  ];

  var byId = Object.create(null);
  list.forEach(function (z) { byId[z.id] = z; });

  AQ.zones = {
    list: list,
    order: list.map(function (z) { return z.id; }),
    get: function (id) { return byId[id] || null; },
    name: function (id) { return AQ.i18n.t('zone.' + id + '.name'); },
    // floorY(zoneOrId, x) → world y of the sea floor at column x (§5.1 floorProfile; deterministic per zone).
    floorY: function (zoneOrId, x) {
      var z = typeof zoneOrId === 'string' ? byId[zoneOrId] : zoneOrId;
      if (!z) return 0;
      var fp = z.floorProfile;
      return z.depth * (fp.base + fp.amp * AQ.util.fbm2(x * fp.freq, z.order * 7.31 + 0.5, 3));
    },
    // depthM(zoneOrId, y) → metres for a world y.
    depthM: function (zoneOrId, y) {
      var z = typeof zoneOrId === 'string' ? byId[zoneOrId] : zoneOrId;
      return z ? Math.max(0, y) * z.mPerUnit : 0;
    }
  };
})(window.AQ);
