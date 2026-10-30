// Stackable consumables. Their effects are applied in js/systems/consumableUse.js.
export const CONSUMABLES = {
  healing_tonic: { id: 'healing_tonic', name: 'Healing Tonic', rarity: 'common', icon: '❤', color: '#ff6b6b', effect: { heal: 0.35 }, cd: 8,
    desc: 'Restores 35% of your health. Slime gel, boiled with sap: it tastes exactly like that.' },
  greater_healing_tonic: { id: 'greater_healing_tonic', name: 'Greater Healing Tonic', rarity: 'rare', icon: '❤', color: '#ff3d6e', effect: { heal: 0.65 }, cd: 8,
    desc: 'Restores 65% of your health. Emerald dust makes it mend what the gel cannot.' },
  resource_tonic: { id: 'resource_tonic', name: 'Vigour Tonic', rarity: 'uncommon', icon: '◆', color: '#6fa8ff', effect: { resource: 0.6 }, cd: 8,
    desc: 'Restores 60% of your class resource (Stamina, Focus, Mana, Energy or Spirit).' },
  antidote: { id: 'antidote', name: 'Antidote', rarity: 'uncommon', icon: '⚕', color: '#8ef0c8', effect: { cure: ['poison'], status: 'antidote' }, cd: 4,
    desc: 'Cures poison and keeps it off for 30 s. Essential in the gas-filled depths.' },
  reset_crystal: { id: 'reset_crystal', name: 'Reset Crystal', rarity: 'rare', icon: '◇', color: '#c48cff', effect: { respec: true }, cd: 0, menuOnly: true,
    desc: 'Returns every attribute point you have spent, so you can place them again. Use it from the Character tab.' },
  royal_bait: { id: 'royal_bait', name: 'Royal Jelly Bait', rarity: 'rare', icon: '♛', color: '#ffd166', effect: { summon: 'slime_prince' }, cd: 0,
    desc: 'Sweet enough to offend royalty. Use it in the Sunlit Glade by day to summon the Slime Prince.' },
  echo_horn: { id: 'echo_horn', name: 'Echo Horn', rarity: 'rare', icon: '♪', color: '#d8dde6', effect: { summon: 'silverback_emperor' }, cd: 0,
    desc: 'A miner\'s shift horn. Blow it in Bone Ridge Crater at night and the Emperor answers.' },
};
