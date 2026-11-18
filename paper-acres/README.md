# Paper Acres

A farming and life game drawn on the last pages of an old school notebook. Everything is a line drawing (the stickman, trees, houses, townsfolk, animals, monsters and your own sketches) that an ASCII renderer turns into characters every frame. Two colours only: beige paper and black ink.

You inherit grandpa's scribbled farm next to the town of **Marginton**. Grow crops, befriend thirteen townsfolk, raise animals, fish, fight your way down **the Inkwell** mine, and use your special gift: **draw a thing, name it, and it becomes real.**

Open `index.html` (works from `file://` too). In English. Desktop (keyboard and mouse), touch, and basic gamepad.

## The world is 3D, you live in a slice

The page is a 3D grid seen from the side. You walk left and right in the current slice. **W** steps one slice *into* the page, toward the horizon; **S** steps back out. Slices further away are drawn smaller and lighter, converging on the horizon, and each slice has its own ground: a field row, the street, a creek, a back alley. Collisions only happen in your own slice, so stepping sideways in depth is also a dodge.

## Controls

| Action | Keyboard / mouse | Touch | Gamepad |
| --- | --- | --- | --- |
| Walk / run | A, D (Shift runs) | left stick | left stick, B runs |
| Step into the page / out | W / S (climb ladders) | flick the stick up / down | stick up / down |
| Jump | Space | jump | A |
| Use selected item / tool / weapon | J, F or left click (aim with the mouse) | use (drag to aim) | X (right stick aims) |
| Act: talk, open doors, harvest, shops | E or right click | act | Y |
| Draw | Q | draw | triggers |
| Hotbar | 1-9, mouse wheel | tap a slot | bumpers |
| Notebook (items, craft, words, map, calendar, friends, journal, settings, save) | Tab or I, M for the map | [=] | Start |
| Pause | Esc or P | | Back |

## Features

- **ASCII renderer.** The scene is drawn with Canvas2D into a small offscreen buffer (4x6 samples per character). Strokes are thinned to one sample, and every cell's pattern is matched to the nearest character template (memoised). Farther slices are drawn in lighter ink, which turns into thinner, regular-weight glyphs; nearer slices hide farther ones with blank paper.
- **Drawing.** The sketchpad converts your strokes to ASCII live. A shape classifier ranks the words you know (45 inanimate words; you can never draw a living thing). Pencil uses lead and fades after three days (and can be erased); pen uses ink and is permanent. Drawn things get a physics body shaped like your strokes: bridges and platforms fall and settle, boats and rafts float, balloons hover, springs launch you, ladders and ropes can be climbed, bombs explode, and tools, weapons, umbrellas (glide) and lanterns (light) go into your bag.
- **Farming.** Hoe, watering can, axe, pickaxe and scythe (upgradable to copper, iron and gold); 16 crops over four seasons; weeds, rocks, branches and choppable trees; forage; a shipping bin paid next morning; kiln, ink press, furnace, preserves jar, chests, sprinklers that water the rows in front of and behind them, and scarecrows against crows.
- **Your stickman.** A thin stick figure (big hollow head, one-character body) in 3 models: rungs `≡`, solid squares `■` and solid spheres `●`. Pick one in the gallery on the title screen, in the new-game form, or in settings.
- **Marginton.** Thirteen townsfolk drawn as stick figures, taking turns with the three models, with their own hats and hair. Each has a daily routine, lines that change with season, weather and friendship, gift tastes, a birthday and two heart events. There are shops (seeds, word cards, ink and lead, tool upgrades, café, clinic, carpentry, ranch, bait), a request board, mail, a library that trades donations for words, and four festivals (Doodle Fair, Lantern Night, Harvest Weigh-in, Snow Sketch).
- **Mend the Notebook.** Six torn pages of the town notebook, each mended with bundles of items, unlock a bridge to grandpa's orchard, the mine elevator, a weather-proof field row, a minecart, every word, and the ending.
- **Life.** You buy chickens, cows, goats and sheep for the coop and barn, then feed, pet and collect from them. Wildlife (rabbits, birds, butterflies, frogs, deer, crows) appears by zone and season. Fishing in the creek, the lake and the mine pools has a reel-in minigame and 12 fish.
- **The Inkwell.** 30 mine floors generated from a seed, each with five slices and ores (copper, iron, gold, graphite, inkstone, quartz). Weapons are real bodies swung toward where you aim, and damage depends on impact speed and weight. Six enemies step between slices; the eraser mites eat pencil drawings. Three bosses: Coffee Stain, Scissor Knight, and The Eraser, who rubs out the floor. If you faint, you wake up at the clinic.
- **Days.** The day runs 6:00 to 2:00, with seasons of 28 days (or 14) and seeded weather (sun, rain, storms, wind, snow). At night the page inverts, dithered, with circles of light around lamps, windows and you.
- **Sound.** All synthesised: generative music in 11 moods (seasons, night, town, indoors, mine, boss, festival, title) and effects for everything, including a pencil that scratches faster as you draw faster.
- **Quality of life.**
  - 3 save slots with autosave every morning, and JSON export and import
  - settings for volumes, day length, slices drawn, text size, sharpness, touch layout (left-handed), wobbly pencil lines, screen shake, hints and reduced motion
  - automatic quality, first-time hints, pause on blur, and hold-to-repeat tools

## Code map

```
index.html           shell, CSS (two colours), script order
lib/phaser.min.js    Phaser 3.90.0 (MIT), Matter physics
fonts/               Courier Prime, Patrick Hand (OFL)
src/core/            config, util, seeded RNG, event bus
src/ascii/           glyph atlas, ASCII matcher, stroke rasterizer, shape features
src/world/           tiles, 3D grid, generators (overworld, interiors, mine floors)
src/render/          projection, vector world drawing, props, ASCII post-process, paper, weather
src/physics/         terrain bodies, stickman rig, player controller
src/draw/            words, ink, sketchpad, drawn objects
src/farm/            items, inventory, crops, crafting, farming, animals
src/life/            wildlife, fishing
src/town/            townsfolk data, dialogue, shops, quests, festivals, people in the world
src/combat/          combat, enemies and bosses, the mine
src/systems/         state, time, saves, settings, input, audio, quality
src/ui/              touch, toasts, dialogs, HUD, title, notebook, town screens, hints
src/scenes/          Boot and Game (Phaser scenes)
tests/               node --test (pure logic: rasterizer, matcher, grid, generators, crops, inventory, ink, shapes, town, life, mine, saves, palette)
```

## Tests

```
node --test tests/*.test.js
```

The palette test fails if any colour other than paper and ink can reach the screen. Greys appear only in the offscreen buffer, where they set glyph weight.
