# Ring of Beakers

A bird-fighting and genetics game, drawn in flat vector canvas 2D. You inherit a coop, two chickens and a debt. Net wild birds, breed them, splice their genes, and send them into the ring, where the shape of the body decides the bout.

Open `index.html` in a browser. It needs no build step and no server, and it runs on desktop and on phones, in portrait or landscape.

## How to play

- **Yard.** Tap a bird for its card. The truck carries as many creatures as you like: whoever rides in it stands in its bed, and you drag birds in and out of it at any time (tap the truck to load or unload everyone). Drag a bird into a nest to breed, onto the dummy to train, or into the BFC pick-up box to be rid of it. Pick a feed at the bottom and tap a bird, or the feeder. Sleep ends the day.
- **Map.** WASD or the arrow keys drive (on touch, the left thumb). Click to throw a net; on touch, drag from the net button to aim, or tap it to throw at the nearest animal. The truck button (or `C`) opens a live view of the cage: move the riders about, tap one for its card, or drag one out onto the map to let it go there. `Q` digs, `E` enters a door, `1`-`3` pick a tool, `H` honks. The clock button (or `T`) speeds time up x4 or x12, and drops back to normal at nightfall.
- **Time.** Tap the clock in the top bar to wait an hour or until nightfall (19:00), when the Cellar and the Night Market open.
- **Money.** Every arena always has two exhibition bouts to watch and bet on; as soon as one is fought the next pair takes its place. Nobody posts odds: the bet window shows both fighters' numbers side by side, and a winning bet pays back three times the stake. If your money ever runs out, Dona Cida pays $50 to scrub the droppings off her henhouse floor (hold and rub each pile).
- **Feeding.** One grain feeds any creature for the day. Birds in the yard walk to the feeder and eat on their own; whatever is left feeds the rest at night.
- **Ring.** Your bird fights on its own. Shout `Sic 'em!`, `Back off!` or `Whistle` (keys `1`-`3`); each has a cooldown, and a bird that does not trust you may ignore you. The flag throws in the towel. Every bout wears a bird out for the day (a tonic restores its vigour so it can fight again); only a loss wounds it, and wounds stay until the vet heals them.
- **Lab.** Three fuses power it. Every gene is mapped from the start: pick any creature in the truck to see its fourteen chromosome pairs and what each gene does. Extract one copy of a gene into a beaker, or copy the **whole genome** into one beaker. Edit any base at the CRISPR bench (a whole-genome beaker opens on a chromosome grid, so you can edit any of its genes), then inject into another creature or an egg. A whole genome turns the receiver, bird or person, into a **clone** of the donor at the receiver's own age, and its beaker is kept, so a favourite bird can be kept for ever. Beakers you no longer want can be thrown away. Everything in the lab is free. Before an injection, a preview shows the creature as it is and as it would be (an egg as the adult it grows into), with its stats and what changes; nothing happens until you confirm. Giving or receiving genes leaves a creature worn out for the day, never hurt.

The Codex (in the yard) has a longer guide, the kinds of bird you have met, the gene atlas and the feats.

## What is in it

- **Genetics.** Every creature has 14 chromosome pairs of A/C/G/T bases, 140 genes at fixed places, two copies of each. About 80 traits are read from them: size, neck, beak, legs, spurs, wings, tail, comb, colours and patterns, muscle, lungs, nerve, lifespan, voice, and rare switches such as teeth, arms, a second head or a glow. Birds are ZW: males carry two Z chromosomes and females one, so some traits follow the sex. Eggs come from meiosis with crossing-over and a little mutation.
- **Colours.** Colour genes are read base by base, so any difference in them shows: no two birds are quite alike, domestic kinds come in many shades, and black (dominant) and white (recessive) morphs turn up now and then.
- **34 kinds of bird**, from quail to ostrich, five of them extinct and only reachable through fossils. A kind is only a region of the gene space, so anything can have young with anything: a hummingbird with an ostrich, or a hen with a person. Each parent's copy of a gene carries its own dominance, so a cross can take whole body parts after one parent, blend others, and get its colours from either side. Crosses are named after both parents and breed true to their new kind.
- **Physics fights.** Fighters are ragdolls built from their genes. They peck, kick with their spurs, buffet with their wings, shove and punch; damage comes from the speed of the blow where it lands. Three kinds of bout: the pit, push-out on a platform, and aerial over water.
- **A seeded map** with six biomes, each with its own animals by day and by night. The day's wild population lives all over the map and stays put while you go in and out of places; it is renewed each morning, and about one wild animal in 170 is a natural cross of two kinds. The map also has roads, sixteen sites and twelve houses. Animals graze, bolt, fly off or charge the truck depending on their genes. Digging almost always turns something up. Holes you dig trap small animals and fill back in overnight, when the ground holds something new; a red X is a one-time find whose hole stays.
- **People.** Neighbours buy birds that match what they want, breed and swap their own, collect relics, or challenge you. They can be netted too, which the sheriff minds. A netted person can share a nest with a bird, or go to BFC; their house stands empty for three days until someone new moves in.
- **BFC, Brazil's Fried Chicken.** Takes any bird (or person) you are done with, by the kilo, at the counter or from the box in your yard. A parody: the look is a fried chicken place, the mascot (Coronel Galo, a rooster in a white suit) and everything else are this game's own.
- Five arenas, each with one bout a day in every weight class from Gnat to Titan (so any bird you own has a fight), bosses and betting, a sideshow with three contests, an ending, nineteen feats, synthesised sound and music, three save slots with export and import.

## Files

```
index.html          the page: a canvas and the scripts, in dependency order
js/core.js          seeded random numbers and maths
js/genome.js        chromosomes, genes, meiosis, mutation
js/species.js       the kinds of creature, and telling which kind one is
js/phenotype.js     genes -> body, colours and fighting numbers
js/pose.js          standing, walking, flying and sitting poses
js/physics.js       the particle world
js/creature.js      the ragdoll: gait, balance, attacks
js/fight.js         a bout: brains, damage, commands, odds
js/items.js  world.js  npc.js  economy.js  lab.js  state.js   the rules
js/birdart.js  props.js    drawing creatures and scenery
js/input.js  ui.js  audio.js  save.js  common.js  main.js     the shell
js/scenes/          title, coop, ring, map, sites, lab, codex, chores
tests/              logic tests
```

Everything up to `state.js` runs without a browser, which is how the tests and the betting odds work.

## Tests

```
node --test ring-of-beakers/tests/*.test.js
```

They cover the genome (layout, meiosis, sex ratio, mutation, saving), all kinds standing and walking in the physics, bouts being deterministic and always ending, weapons mattering, and the rules of the save, the BFC, the arenas, the world, the people and the lab.

## Notes

- Add `?scene=coop&seed=7` to the address to jump into a throwaway game that is never saved (also `map`, `lab`, `codex`).
- Saves live in the browser's local storage. The bag button on the title screen exports a save as text and imports one.
- The game is a spiritual successor to the breed-and-race genre, with its own theme, world, art and text.
