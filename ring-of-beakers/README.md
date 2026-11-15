# Ring of Beakers

A bird-fighting and genetics game, drawn in flat vector canvas 2D. You inherit a coop, two chickens and a debt. Net wild birds, breed them, splice their genes, and send them into the ring, where the shape of the body decides the bout.

Open `index.html` in a browser. It needs no build step and no server, and it runs on desktop and on phones, in portrait or landscape.

## How to play

- **Yard.** Tap a bird for its card. Drag a bird onto the truck to take it along, into a nest to breed, onto the dummy to train, or into the BFC pick-up box to be rid of it. Pick a feed at the bottom and tap a bird, or the feeder. Sleep ends the day.
- **Map.** WASD or the arrow keys drive (on touch, the left thumb). Click to throw a net; on touch, drag from the net button to aim, or tap it to throw at the nearest animal. `Q` digs, `E` enters a door, `1`-`3` pick a tool, `H` honks.
- **Ring.** Your bird fights on its own. Shout `Sic 'em!`, `Back off!` or `Whistle` (keys `1`-`3`); each has a cooldown, and a bird that does not trust you may ignore you. The flag throws in the towel.
- **Lab.** Three fuses power it. Sequence a creature, tap a gene and extract a copy into a beaker, edit it at the CRISPR bench, then inject it into another creature or an egg.

The Codex (in the yard) has a longer guide, the kinds of bird you have met, the gene atlas and the feats.

## What is in it

- **Genetics.** Every creature has 14 chromosome pairs of A/C/G/T bases, 140 genes at fixed places, two copies of each. About 80 traits are read from them: size, neck, beak, legs, spurs, wings, tail, comb, colours and patterns, muscle, lungs, nerve, lifespan, voice, and rare switches such as teeth, arms, a second head or a glow. Birds are ZW: males carry two Z chromosomes and females one, so some traits follow the sex. Eggs come from meiosis with crossing-over and a little mutation.
- **34 kinds of bird**, from quail to ostrich, five of them extinct and only reachable through fossils. A kind is only a region of the gene space, so anything can cross with anything, less reliably the further apart they are.
- **Physics fights.** Fighters are ragdolls built from their genes. They peck, kick with their spurs, buffet with their wings, shove and punch; damage comes from the speed of the blow where it lands. Three kinds of bout: the pit, push-out on a platform, and aerial over water.
- **A seeded map** with six biomes, each with its own animals by day and by night, roads, sixteen sites and twelve houses. Animals graze, bolt, fly off or charge the truck depending on their genes. Holes you dig stay, and trap small animals.
- **People.** Neighbours buy birds that match what they want, breed and swap their own, collect relics, or challenge you. They can be netted too, which the sheriff minds.
- **BFC, Brazil's Fried Chicken.** Takes any bird you are done with, by the kilo, at the counter or from the box in your yard. A parody: the look is a fried chicken place, the mascot (Coronel Galo, a rooster in a white suit) and everything else are this game's own.
- Five arenas with daily cards, bosses and betting, a sideshow with three contests, an ending, nineteen feats, synthesised sound and music, three save slots with export and import.

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
js/scenes/          title, coop, ring, map, sites, lab, codex
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
