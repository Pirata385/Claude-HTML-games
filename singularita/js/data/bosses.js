// The two bosses of Dawnreach. Patterns are scripted in js/ai/bosses/.
export const BOSSES = {
  slime_prince: {
    id: 'slime_prince', name: 'The Slime Prince', title: 'Heir to the Coolant Throne', zone: 'island', period: 'day', arena: 'glade', minLevel: 8,
    hp: 900, dmg: 14, levelOffset: 2, color: '#ffd166', model: 'prince',
    intro: 'Kneel! The Prince of all that Wobbles graces the Glade. My crown was poured in the first forge of Vael, and so I am owed a kingdom.',
    defeat: 'Unthinkable… The gel… remembers… a cooler time…',
    lore: 'When the Dawnforgers poured their crown-moulds, the coolant that cooled the royal casts drank in a little of their ambition. It grew a crown of its own, and opinions.',
    phases: [
      { at: 1.0, name: 'Royal Bounce', desc: 'Leaps and lands in rings of force. Jump or dodge the rings.' },
      { at: 0.75, name: 'The Royal Guard', desc: 'Calls golden guards. Each guard he absorbs heals and grows him. Kill them first.' },
      { at: 0.5, name: 'Royal Division', desc: 'Splits into two halves that must both fall.' },
    ],
    rewards: [
      { material: 'royal_jelly', min: 3, max: 5, chance: 1 },
      { item: 'princes_crown', chance: 0.25, firstKill: true },
      { material: 'slime_gel', min: 10, max: 16, chance: 1 },
    ],
    xp: 900,
  },
  silverback_emperor: {
    id: 'silverback_emperor', name: 'The Silverback Zombie Emperor', title: 'War-Ape of the Dawnforger King', zone: 'island', period: 'night', arena: 'crater', minLevel: 14,
    hp: 1600, dmg: 24, levelOffset: 3, color: '#d8dde6', model: 'silverback',
    intro: '(A roar shakes the crater. On the Emperor\'s wrist a royal seal still gleams: he guarded a king who has been dust for a thousand years.)',
    defeat: '(The Emperor sinks to one knee and bows toward the sea, where the old palace once stood. The Echo leaves him gently.)',
    lore: 'The Dawnforger king kept a menagerie. Its silver ape guarded the throne room on the night of the Fracture, and the Echo raised it still loyal, still waiting for orders.',
    phases: [
      { at: 1.0, name: 'Imperial Wrath', desc: 'Leap slams and boulder throws. Watch the circles.' },
      { at: 0.6, name: 'The Charge', desc: 'Charges in straight lines. Bait him into a pillar to stun him.' },
      { at: 0.3, name: 'Enraged', desc: 'Faster, angrier, and summons Echoes with every roar.' },
    ],
    rewards: [
      { material: 'silver_mane', min: 2, max: 4, chance: 1 },
      { item: 'emperors_knuckle', chance: 0.25, firstKill: true },
      { material: 'zombie_sinew', min: 10, max: 16, chance: 1 },
    ],
    xp: 1800,
  },

  // Guardians of the elemental isles. They wait in their arenas and return some time after defeat.
  ronin_east_wind: {
    id: 'ronin_east_wind', name: 'Ronin of the East Wind', title: 'Oathbound Guard of the Eastern Gate', zone: 'isle_air', arena: 'shrine', minLevel: 70,
    hp: 2400, dmg: 30, levelOffset: 3, color: '#cfe8ff', model: 'ronin', respawn: 600,
    intro: 'You climb well, stranger. My oath was to let no one pass the eastern gate. The gate fell a thousand years ago. The oath did not.',
    defeat: 'So the wind turns… Take the sigil. Guard it better than I guarded my king.',
    lore: 'When the Fracture raced east, a single guard drew his blade and cut the wind in two, and the eastern isle was spared the worst of it. He has stood on its highest spire ever since, sword half-drawn, waiting for an order that will not come.',
    phases: [
      { at: 1.0, name: 'The Drawn Blade', desc: 'Iai dashes along a line, crescents of wind, and a counter stance: do not strike while he glows blue.' },
      { at: 0.6, name: 'Gale Steps', desc: 'He flickers between three points around you before striking.' },
      { at: 0.3, name: 'Eastwind Storm', desc: 'Tornadoes sweep the spire while he fights faster.' },
    ],
    rewards: [
      { material: 'sigil_wind', min: 1, max: 1, chance: 1, once: true },
      { material: 'eastwind_silk', min: 2, max: 4, chance: 1 },
      { item: 'ronin_sash', chance: 0.2, firstKill: true },
      { material: 'zephyr_feather', min: 6, max: 10, chance: 1 },
    ],
    xp: 30000,
  },
  tears_of_poseidon: {
    id: 'tears_of_poseidon', name: 'Tears of Poseidon', title: 'Grief of the Drowned Palace', zone: 'isle_water', arena: 'temple', minLevel: 70,
    hp: 900, dmg: 26, levelOffset: 3, color: '#7fe0ff', model: 'tear', respawn: 600, members: 3,
    intro: '(Three tears fall from the drowned god\'s statue and do not land. They circle you, weeping, and the sea begins to rise.)',
    defeat: '(The last tear falls into the lagoon. For a moment the tide stops, as if the sea were listening. Then, gently, it goes out.)',
    lore: 'The palace of Vael fell into the sea on the night of the Fracture. The god of that sea had loved its people. His grief became three tears that never stopped falling, and each tide they shed lifts the water a little higher.',
    phases: [
      { at: 1.0, name: 'Weeping', desc: 'While all three Tears live, the water rises. Fight from the raised stones.' },
      { at: 0.66, name: 'Undertow', desc: 'Whirlpools drag you toward their hearts.' },
      { at: 0.33, name: 'The Last Tear', desc: 'Alone and furious, the last Tear calls waves across the whole temple.' },
    ],
    rewards: [
      { material: 'sigil_tide', min: 1, max: 1, chance: 1, once: true },
      { material: 'poseidon_tear', min: 2, max: 4, chance: 1 },
      { item: 'tearstone_pendant', chance: 0.2, firstKill: true },
      { material: 'abyssal_pearl', min: 3, max: 6, chance: 1 },
    ],
    xp: 30000,
  },
  magma_vector: {
    id: 'magma_vector', name: 'The Magma Vector', title: 'Heat Given Direction', zone: 'isle_fire', arena: 'caldera', minLevel: 84,
    hp: 3200, dmg: 34, levelOffset: 3, color: '#ff9a3a', model: 'vector', respawn: 600,
    intro: '(The caldera\'s heart lifts into the air as a burning cube. Lines of light spear out across the ground: the paths it is about to take.)',
    defeat: '(The cube cools to black glass and cracks. Inside, the Sigil of Flame still points somewhere you cannot see.)',
    lore: 'The Dawnforgers gave the volcano\'s heat a direction, so their great forge could draw it on demand. When the forge died, the heat kept its direction and lost its purpose. It has moved in straight lines ever since.',
    phases: [
      { at: 1.0, name: 'Straight Lines', desc: 'It shows its path, then dashes along it, leaving lava. Its core cools between dashes: strike then.' },
      { at: 0.6, name: 'Reflection', desc: 'Its vectors now bounce off the caldera walls.' },
      { at: 0.3, name: 'Cross Product', desc: 'Two vectors at once, crossing.' },
    ],
    rewards: [
      { material: 'sigil_flame', min: 1, max: 1, chance: 1, once: true },
      { material: 'vector_core', min: 2, max: 4, chance: 1 },
      { item: 'vector_ring', chance: 0.2, firstKill: true },
      { material: 'obsidian', min: 6, max: 10, chance: 1 },
    ],
    xp: 42000,
  },
  allele_golem: {
    id: 'allele_golem', name: 'Allele of the Divine Golem', title: 'The Living Genome', zone: 'isle_earth', arena: 'grove', minLevel: 84,
    hp: 3600, dmg: 32, levelOffset: 3, color: '#8ad06a', model: 'allele', respawn: 600,
    intro: 'EXPRESSING: GRANITE. EXPRESSING: QUARTZ. EXPRESSING: MOSS. (The golem\'s core shifts colour, rewriting what it is.)',
    defeat: 'RECESSIVE… ALL… RECESSIVE. (Its last seed drops into your hand: the Sigil of Stone, warm as a living thing.)',
    lore: 'The Dawnforgers wanted a guardian that could never be outmatched, so they grew one that could become anything. They gave it three alleles of stone, crystal and root, and it switches between them faster than any foe can adapt. Almost any foe.',
    phases: [
      { at: 1.0, name: 'Expression', desc: 'Granite: armoured, strike its glowing back. Quartz: swift, dodge its combos. Moss: kill the seedlings before they heal it.' },
      { at: 0.6, name: 'Codominance', desc: 'Two alleles at once.' },
      { at: 0.3, name: 'Mutation', desc: 'The alleles cycle rapidly.' },
    ],
    rewards: [
      { material: 'sigil_stone', min: 1, max: 1, chance: 1, once: true },
      { material: 'allele_seed', min: 2, max: 4, chance: 1 },
      { item: 'allele_crest', chance: 0.2, firstKill: true },
      { material: 'living_amber', min: 4, max: 8, chance: 1 },
    ],
    xp: 42000,
  },
};
