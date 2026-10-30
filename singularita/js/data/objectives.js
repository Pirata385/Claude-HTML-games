// The objectives chain doubles as the tutorial: it teaches by doing, never by blocking.
// type: gather | craft | craftAny | kill | allocate | wave | reach | boss | lore | equip | level
export const OBJECTIVES = [
  { id: 'o_wood', type: 'gather', target: 'wood', count: 6, text: 'Gather Wood', hint: 'Walk up to a tree and press F (or the hand button) to chop it.', xp: 30 },
  { id: 'o_pick', type: 'craft', target: 'pickaxe_wood', count: 1, text: 'Craft a Wood Pickaxe at the Forge', hint: 'Open Crafting (C) next to the Forge in camp.', xp: 40 },
  { id: 'o_stone', type: 'gather', target: 'stone', count: 8, text: 'Mine Stone from boulders', hint: 'Boulders dot the island. Your best pickaxe is used automatically.', xp: 50 },
  { id: 'o_weapon', type: 'equip', target: 'weapon', minTier: 1, count: 1, text: 'Craft and equip a Stone (or better) weapon', hint: "Lume's worn weapon will not last. Check Crafting → Weapons.", xp: 60 },
  { id: 'o_kill', type: 'kill', target: 'any', count: 10, text: 'Defeat creatures', hint: 'Left click (or the sword button) to attack. Q locks on.', xp: 80 },
  { id: 'o_points', type: 'allocate', target: 'any', count: 1, text: 'Spend attribute points', hint: 'Open the Character tab (K) and assign your points.', xp: 40 },
  { id: 'o_wave', type: 'wave', target: 'any', count: 1, text: 'Survive a wave', hint: 'A horn sounds when a wave comes. Defeat every creature in it.', xp: 120 },
  { id: 'o_cave', type: 'reach', target: 'cave_1', count: 1, text: 'Enter the Hollow Deep', hint: 'The cave mouth is on the hill. Follow the marker on the minimap.', xp: 120 },
  { id: 'o_copper', type: 'gather', target: 'copper|gold', count: 6, text: 'Mine Copper or Gold', hint: 'A Stone Pickaxe or better is needed for copper and gold veins.', xp: 150 },
  { id: 'o_pick2', type: 'craftAny', target: 'pickaxe_copper|pickaxe_gold', count: 1, text: 'Craft a Copper or Gold Pickaxe', hint: 'Better pickaxes reach deeper veins.', xp: 200 },
  { id: 'o_layer2', type: 'reach', target: 'cave_2', count: 1, text: 'Descend to Layer 2', hint: 'Find the descent shaft in the Rootways. Layer 2 opens at level 8.', xp: 300 },
  { id: 'o_boss', type: 'boss', target: 'any', count: 1, text: 'Defeat the Slime Prince or the Silverback Emperor', hint: 'Bosses appear by chance at their arenas, or can be summoned with a crafted lure.', xp: 600 },
  { id: 'o_iron', type: 'gather', target: 'iron', count: 10, text: 'Mine Iron', hint: 'Iron veins run through layers 2 and 3.', xp: 400 },
  { id: 'o_layer4', type: 'reach', target: 'cave_4', count: 1, text: 'Reach the Whispering Depths (Layer 4)', hint: 'Bring Antidotes: the deep layers have hazards of their own.', xp: 900 },
  { id: 'o_emerald', type: 'gather', target: 'emerald', count: 6, text: 'Mine Emerald', hint: 'Emeralds grow in layers 4 and 5.', xp: 1200 },
  { id: 'o_layer6', type: 'reach', target: 'cave_6', count: 1, text: 'Reach the Prism Caverns (Layer 6)', hint: 'Ruby and sapphire gear will see you through.', xp: 2500 },
  { id: 'o_diamond', type: 'gather', target: 'diamond', count: 8, text: 'Mine Diamond', hint: 'Diamond needs a Ruby or Sapphire Pickaxe.', xp: 4000 },
  { id: 'o_gate', type: 'lore', target: 'lore_seal', count: 1, text: 'Find the Sealed Core Gate', hint: 'It waits at the bottom of the Diamond Throat (Layer 7).', xp: 6000 },
];
