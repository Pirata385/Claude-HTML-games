// Spawning configuration per zone. Everything about pacing is tuned here.
export const WAVES = {
  // Dawnreach is never quiet: one endless horde, slimes by day and Echoes by night,
  // at fixed levels. You outgrow the island; the cave is where the challenge grows.
  island: {
    cycle: { dayLen: 720, nightLen: 480 },
    population: { day: 8, night: 11 },
    spawnInterval: 2.5,
    elite: 0.06,
    levels: { day: [1, 10], night: [4, 14] },
    // Seconds of island time between roaming bosses.
    bossCooldown: [480, 840],
    tables: {
      day: [
        { id: 'slime', w: 6 }, { id: 'great_slime', w: 3 }, { id: 'spitter_slime', w: 3 }, { id: 'mender_slime', w: 2 },
      ],
      night: [
        { id: 'zombie_walker', w: 6 }, { id: 'zombie_runner', w: 4 }, { id: 'zombie_brute', w: 2 }, { id: 'zombie_screamer', w: 2 }, { id: 'zombie_bloater', w: 2 },
      ],
    },
    bosses: [
      { id: 'slime_prince', period: 'day' },
      { id: 'silverback_emperor', period: 'night' },
    ],
  },
  isle: {
    elite: { base: 0.08, perLayer: 0, max: 0.3 },
    respawnDelay: 5,
  },
  dimension: {
    // Beyond the first creatures, how many more a run sends, as a share of its population.
    // The Endless Dungeon counts per floor.
    reserve: 3, floorReserve: 1.5,
  },
  cave: {
    // Caves keep a living population instead of horns and waves; deeper layers add tremors.
    tremor: { fromLayer: 4, every: [120, 220], size: [4, 7] },
    elite: { base: 0.05, perLayer: 0.025, max: 0.3 },
    respawnDelay: 6,
  },
};
