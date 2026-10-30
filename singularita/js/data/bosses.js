// The two bosses of Dawnreach. Patterns are scripted in js/ai/bosses/.
export const BOSSES = {
  slime_prince: {
    id: 'slime_prince', name: 'The Slime Prince', title: 'Heir to the Coolant Throne', period: 'day', arena: 'glade', minLevel: 8,
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
    id: 'silverback_emperor', name: 'The Silverback Zombie Emperor', title: 'War-Ape of the Dawnforger King', period: 'night', arena: 'crater', minLevel: 14,
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
};
