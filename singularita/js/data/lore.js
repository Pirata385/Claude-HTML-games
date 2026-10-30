// Lore: Echo Stones scattered through the world, Lume's lines and the Sealed Core Gate.
// Nothing is told all at once; the Journal collects what the player has found.

export const LORE = {
  // Dawnreach -------------------------------------------------------------
  lore_beacon: { zone: 'island', title: 'The Beacon Keeper', text:
    'Lume was built to tend this beacon until the ships came home. The ships did not come home. Lume kept the light on anyway, for nine hundred and twelve years, and then the tide brought you.' },
  lore_first_forge: { zone: 'island', title: 'The First Forge', text:
    'Here the Dawnforgers lit their first forge with island oak and learned that metal remembers the heat that shaped it. Every forge after this one was an attempt to make metal remember more.' },
  lore_coolant: { zone: 'island', title: 'Coolant Pits', text:
    'The forges ran hot, so the Dawnforgers bred a living gel to cool them, and it drank heat, ambition and anything else spilled into it. When the forges went cold, the gel went looking for warmth. You have met it. It hops.' },
  lore_night_shift: { zone: 'island', title: 'The Night Shift', text:
    'When the Fracture came, the miners of the Hollow Deep were mid-shift. The Echo, the ringing left in the air when reality broke, caught them there. They still clock in every night, still walk the old roads to the cave, still wear their helmets. They no longer remember why.' },
  lore_menagerie: { zone: 'island', title: 'The King\'s Menagerie', text:
    'The king kept beasts from every corner of Vael. Most fled when the palace fell into the sea. One, a silverback with a royal seal on its wrist, stayed at its post. Some loyalties outlive the one they were sworn to.' },
  lore_fracture: { zone: 'island', title: 'The Fracture', text:
    'Vael was once one land. Then the king tried to forge a crown from Singularita, the matter that remembers every shape it could have been. The crown remembered too much. The land broke into isles, and somewhere far below, a door was shut.' },

  // The Hollow Deep -------------------------------------------------------
  lore_rootways: { zone: 'cave_1', title: 'Rootways Marker', text:
    'DEPTH ONE. Roots reach this far; nothing green grows deeper. Miners: mind the bats, the crabs, and the urge to keep digging. The urge is the Core calling. Do not answer it.' },
  lore_galleries: { zone: 'cave_2', title: 'Copper Galleries', text:
    'The Galleries were wired with copper so the lanterns would never fail. When the Echo came, every wire rang at once, and the miners say the walls sang for a week. Some still hum, if you listen close.' },
  lore_ironworks: { zone: 'cave_3', title: 'Foreman\'s Log', text:
    'Quota tripled again. The king wants iron for rails, rails for carts, carts for the deep seams. They say there is a metal down there that hums like a bell and weighs nothing at all. I say a metal that weighs nothing has no business being underground.' },
  lore_whispers: { zone: 'cave_4', title: 'The Whispering', text:
    'Here the fungus breathes, and its breath can kill. Every Dawnforger who went deeper carried a phial of antidote and a promise never to listen to the whispers. The whispers know your name. They only want you to come a little closer.' },
  lore_rifts: { zone: 'cave_5', title: 'The Rift Survey', text:
    'The rift splits fire from frost like a seam split by a blade. The surveyors believe the Fracture ran right through here: on one side the heat of the forges, on the other the cold of the sea that drowned the palace. Ruby grows on the first side, sapphire on the second.' },
  lore_prism: { zone: 'cave_6', title: 'Prism Hymn', text:
    'Every light becomes all lights. Every path becomes all paths. The crystals here sing when struck, and what they sing wakes the sentries. The Dawnforgers built the sentries to guard the Core. The sentries no longer remember that the Dawnforgers are gone.' },
  lore_throat: { zone: 'cave_7', title: 'The Diamond Throat', text:
    'Pressure turned everything here to diamond: stone, roots, rails, even the bones of the first Echo. At the bottom of the throat stands a gate. The king\'s engineers called it the last thing that worked as intended.' },
  lore_seal: { zone: 'cave_7', title: 'The Sealed Core Gate', text:
    'Four sockets around a door that is not quite there. Wind, Tide, Flame and Stone: the four isles torn from Vael each carry a sigil of the seal. Bring all four and the gate will open. Whether it should is another question.' },
};

// Lume, the beacon-keeper construct at the base.
export const LUME_LINES = {
  greet: [
    'Welcome back. The beacon kept the light on.',
    'Light holds. Come warm your hands at the forge.',
    'I counted the waves while you were away. There were many. You survived them all, so the count does not matter.',
  ],
  first: 'You are awake. Good. I am Lume. I keep this beacon, and now, it seems, I keep you. Creatures come for the light by day and by night; the beacon keeps them out of this camp. Gather, build, grow strong. The island will teach you the rest.',
  night: 'Night. The Echoes are walking. Stay near the beacon if you are tired, or go out and meet them. Their sinew makes fine grips.',
  day: 'Day again. The slimes will be after the warmth. Kill the pink ones first: they mend the rest.',
  caveHint: 'The Hollow Deep lies under the hill to the north-east. Each layer is deeper, richer and more dangerous. The Dawnforgers marked the depths with stones. Read them.',
  gateHint: 'You found the gate. Four sigils… four isles. Their shores are beyond my light, for now.',
};
