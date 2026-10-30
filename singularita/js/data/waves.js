// Wave director configuration per zone. Everything about pacing is tuned here.
export const WAVES = {
  island: {
    cycle: { dayLen: 720, nightLen: 480 },
    calm: [40, 70],
    waveDuration: 80,
    spawnInterval: 2.5,
    budget: { base: 6, perWave: 2, perLevel: 0.12 },
    // A role may join a wave once this many waves have passed in the current day or night.
    roleUnlock: { swarm: 0, frontline: 0, ranged: 1, bomber: 2, support: 2, tank: 3 },
    elite: { base: 0.04, perWave: 0.03, max: 0.3 },
    ambient: { day: 5, night: 7 },
    levelFollow: { min: 1, max: 45 },
    tables: {
      day: [
        { id: 'slime', w: 6 }, { id: 'great_slime', w: 3 }, { id: 'spitter_slime', w: 3 }, { id: 'mender_slime', w: 2 },
      ],
      night: [
        { id: 'zombie_walker', w: 6 }, { id: 'zombie_runner', w: 4 }, { id: 'zombie_brute', w: 2 }, { id: 'zombie_screamer', w: 2 }, { id: 'zombie_bloater', w: 2 },
      ],
    },
    bosses: [
      { id: 'slime_prince', period: 'day', chance: 0.25, pity: 0.1 },
      { id: 'silverback_emperor', period: 'night', chance: 0.25, pity: 0.1 },
    ],
  },
  cave: {
    // Caves keep a living population instead of horns and waves; deeper layers add tremors.
    tremor: { fromLayer: 4, every: [120, 220], size: [4, 7] },
    elite: { base: 0.05, perLayer: 0.025, max: 0.3 },
    respawnDelay: 6,
  },
};
