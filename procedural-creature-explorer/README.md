# Procedural Creature Explorer

A mobile-first isometric pixel-art exploration game in a single HTML file. You walk an infinite, procedurally generated world, discover creatures that are evolved at runtime, analyse their anatomy and traits, give them custom names, and keep them in a persistent bestiary.

**Play:** open `index.html` in a modern browser (WebGL2 is required: recent Chrome, Edge, Firefox, or Safari 15+). No build step and no network access are needed. Serving the folder over HTTP also works, for example with `npx serve .` from the repository root.

## Gameplay

- **Explore** an endless world of 12 biomes: Rolling Meadow, Old Forest, Steaming Jungle, Ochre Desert, Golden Savanna, Boreal Taiga, Frost Tundra, Murky Swamp, Granite Peaks, Mycelial Wilds, Sunlit Shore and Open Waters. It also has rivers, lakes, oceans, cliffs and a day/night cycle.
- **Discover** creatures from five classes: insects (arthropods), mammals, reptiles, birds and chimerids. Every region and biome hosts its own populations, so travelling keeps turning up new species.
- **Scan** a creature by holding SCAN within range. The analysis sheet shows its body plan, segment and joint counts, limbs, wings, eyes, appendages, locomotion, mass, speed, diet, temperament, activity cycle and social structure. It also shows a genome code and a live 3D preview that you can rotate and set walking.
- **Name** each discovery, or roll new name suggestions, and browse the **bestiary**, filtered by class, with field ranks as your catalogue grows.
- **Interact**: CALL (whistle) draws curious creatures in, scares skittish ones off and provokes territorial displays. Creatures graze, rest at night or by day depending on their rhythm, greet members of their own species, hunt smaller animals, take off and land.

## Controls

| Action | Touch | Keyboard / mouse |
| --- | --- | --- |
| Move | drag anywhere (floating joystick; push far to run) or tap the ground | WASD / arrows, Shift to run |
| Target | tap a creature | click a creature, Tab cycles |
| Scan | hold SCAN | hold Space |
| Call | CALL | F |
| Camera | pinch to zoom, rotate buttons | wheel or +/− to zoom, Q/E to rotate |
| Panels | buttons in the HUD | B bestiary, Esc menu, H help |

The game supports portrait and landscape and rotates seamlessly. State is kept in memory and saved automatically to `localStorage` (key `pce.save.v1`).

## How it works

The file is split into clearly labelled sections, ready to be modularised:

1. **HTML**: HUD, controls and panels.
2. **CSS**: mobile-first styles with landscape variants and safe-area support.
3. **JS core** (`<script id="pce-core">`): DOM-free, so it also runs in Web Workers and in Node tests.
   - Math, seeded RNG, and 2D/3D Simplex noise.
   - World generation: domain-warped continents, hills, ridged mountains, rivers, lakes, swamps, and climate-driven biomes. Terrain is quantised into isometric steps; each chunk is meshed with baked ambient occlusion, strata, vegetation and shoreline water.
   - **Genetics**: each class has its own sampler, with many archetypes treated as tendencies rather than templates, plus a mutation pass for anatomical exceptions (extra or missing leg pairs, horns, wings, glow organs, eyestalks and so on). Chimerids recombine torso, head, limbs and tail from different classes and add unique organs such as tentacles, second heads, crystals and gills.
   - **Body builder**: the genome becomes a skeleton (torso chain, neck and head, tail, legs solved into a standing pose with IK, arms, wings, antennae, trunks, mandibles and more) plus blob primitives (round cones and ellipsoids).
   - **Organic meshing**: primitives are splatted into a signed-distance field with polynomial smooth-min, so parts merge like viscous droplets. Bilaterally symmetric noise makes the surface irregular, and naive surface nets extract the mesh. Each vertex gets two-bone skin weights and colours from zone palettes and patterns (stripes, bands, spots, patches, countershading).
   - **Procedural animation**: a phase-based gait planner gives tripod, trot, bound, metachronal-wave, biped and hop gaits, with planted feet, predictive foot placement and arc swings. Two-bone IK, trail-following spines for snakes, myriapods and lizards, look-at necks, folding and flapping wings, secondary motion for tails, antennae, tentacles, ears and trunks, plus displays (rearing, jaw, frill, fan).
   - Creature AI states, ecology pools (region × biome) and save helpers.
4. **JS worker**: chunks and species meshes are generated off the main thread from seeds alone. If workers are unavailable, a time-sliced main-thread fallback runs instead.
5. **JS renderer**: WebGL2 at a low internal resolution, upscaled with nearest-neighbour. It uses toon-banded lighting with ordered dithering, depth-based pixel outlines, GPU skinning from a float bone texture, animated water with foam, blob shadows, a player silhouette when occluded, a night lantern, and offscreen sprite previews.
6. **JS game**: floating-joystick touch input, pinch zoom, keyboard and mouse, chunk streaming, the population manager, the scanner, UI panels, procedural audio, adaptive quality and autosave.

## Tests

```sh
node --test procedural-creature-explorer/tests/core.test.mjs
```

The tests extract the core section from `index.html` and check determinism, seamless chunks, bone budgets, anatomical diversity, mesh validity (finite positions, weights, outward winding), gait stability and save round-trips.
