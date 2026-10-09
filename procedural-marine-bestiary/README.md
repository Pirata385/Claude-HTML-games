# Procedural Marine Bestiary

An infinite, procedurally generated ocean to explore, gently catch and catalogue sea life in. Every creature is grown from a **42-gene genome**, so no two specimens of the same class look or move alike. Catch a creature and it enters your bestiary at once; then keep it in one of your aquariums or return it to the wild, where it may turn up again.

The whole game is one self-contained file: [`index.html`](index.html). It has no build step and no asset files. The only external script is p5.js, loaded from jsDelivr at a pinned version with a Subresource Integrity hash.

## Play

| Action | Touch | Mouse | Keyboard |
| --- | --- | --- | --- |
| Glide the scoop | Drag anywhere (a joystick anchored where you touch) | Drag | Arrow keys or WASD |
| Zoom | Pinch | Scroll wheel | |
| Gently catch | Hold the scoop still over a creature until the ring fills | Same | Same |
| Keep or release a catch | One tap on **Keep in a tank** or **Release to the ocean** | Click | Tab and Enter |
| Close a sheet | **Close** | **Close** | Escape |
| Switch tank | Arrows in the top bar | Same | `[` and `]` |

Calm, unhurried approaches work best. Creatures are startled by a fast-moving scoop, and a creature that never felt threatened gives a **gentle catch**. Some bold creatures are curious and drift toward a still scoop on their own.

### Aquariums

- Every tank holds up to **40** creatures. When every tank is full, keeping another opens a new tank automatically, so there is no limit on the number of tanks.
- **Decor** (up to 30 pieces per tank): corals, rocks, plants, driftwood and structures. Pick a piece, tap the tank to place it, drag to move it, and rotate, flip or remove it when selected.
- **Feed** by tapping the tank. Creatures swim to the food and eat it.
- **Light** (day, dusk, moon, lamp) and **floor** (sand, pebbles, basalt, rubble, moss) change how the tank looks and how comfortable its residents are.
- Each creature has a **comfort** ring: Thriving, Content, Uneasy or Stressed. Comfort depends on how recently it was fed, whether shy creatures have cover, whether plant-loving creatures have plants nearby, the variety of decor, crowding, and the light.

### Bestiary

Search by common or Latin name, filter by class, rarity or status, and sort by newest, oldest, rarity, name or class. Select several specimens to move them into a tank or release them together. Each entry has a live portrait, its genome summary, the full 42-gene table, discovery time and free-text field notes.

## Biology

Eight classes, each with two or three subgroups that stand in for the subphyla and subclasses of the brief:

| Class | Subgroups |
| --- | --- |
| Vertebrate Fish (Osteichthyes) | Ray-finned fishes; Lobe-finned fishes |
| Cartilaginous Fish (Chondrichthyes) | Sharks and rays; Chimaeras |
| Cetaceans | Toothed whales and dolphins; Baleen whales |
| Crustaceans | Malacostracans; Copepods |
| Gastropods | Sea slugs and nudibranchs; Sea butterflies |
| Asteriidae (sea stars & related echinoderms) | Sea stars; Brittle stars; Sea urchins |
| Porifera (sponges) | Demosponges; Glass sponges |
| Cnidarians | Anemones and corals (Anthozoa); Jellies and hydroids (Medusozoa) |

### The genome

A genome is exactly 42 numbers in `[0, 1]`. Each class reads the same genes through its own body plan, so one gene can set a fin shape for a fish and an arm count for a sea star. The table below groups them; the full list is `PMB.GENES` in the code.

| Group | Genes |
| --- | --- |
| Body plan (8) | lineage (chooses the subgroup), asymmetry, length, depth, girth, segmentation, head size, curvature |
| Appendages (8) | appendage count, length and shape, tail form, eye size and count, mouth size, frills |
| Surface (5) | spination, lobing, pores and texture, branching, translucency |
| Colour (12) | primary hue, harmony, accent hue, saturation, lightness, pattern, pattern scale and contrast, gradient, iridescence and its shift, bioluminescence |
| Identity (3) | size class, rarity roll, name seed |
| Behaviour (6) | swim style, cruise speed, roaming range, shyness (reaction to the player), idle motion, sociability |

Traits are derived from genes. Special traits (Bioluminescent, Iridescent, Translucent, Colossal, Miniature, Armored, Warning colors, Polychromatic) and the **rarity** tier (Common, Uncommon, Rare, Exquisite, Mythic) come from the genome, so a specimen's rarity never changes.

Colour uses colour-theory harmonies (analogous, complementary, triadic and split-complementary), with the accent and bioluminescent hues chosen from the genome as well.

### Names and descriptions

Each specimen has:

- a **common name** (for example "Ghost Needleball"), built from descriptors or a generated given name plus a subgroup noun;
- a **scientific designation** (genus and epithet, such as *Bathyechinus annulata*), where the epithet reflects the specimen's traits (*lucens* for bioluminescence, *striata* for striped patterns);
- a **catalogue number** in discovery order;
- a short **flavor text** written from its body plan, motion, favored depth and specials.

Common names are unique within a save. A later collision gets a Roman numeral.

## Design decisions

These choices were made from the brief. They are recorded here so reviewers can challenge them.

1. **Single file, modular inside.** All code is inline in `index.html`, in numbered sections: 1 core rules, 2 rendering, 3 creatures and ocean, 4 scenes, 5 interface, 6 audio, 7 app. The core is pure logic with no DOM, so the tests can run it headless. That keeps the code ready to split into modules later.
2. **Pure core, tested.** Genome, phenotype, naming, rarity, save normalisation, aquarium rules, care, dwell and the world's zone and current maths live in section 1 and are covered by `tests/core.test.mjs` (53 tests, run with Node's built-in test runner, no npm).
3. **The brief's taxonomy is stylised.** Subgroups stand in for subphyla and subclasses, as the brief allows. Latin names are real, but the classification is a game model, not a taxonomic reference.
4. **Keep and release are one tap, and the entry is never lost.** The bestiary entry is written the moment a creature is caught, before the decision. A creature that is caught but never decided shows as *Undecided* and is returned to the ocean as a fallback.
5. **Released creatures can return.** A release places the specimen back in the ocean pool, and roughly one spawn in five draws from that pool. A creature that returns is the same specimen and keeps its catalogue entry.
6. **A specimen lives in exactly one place.** It is in the ocean, in one tank, or undecided. Saves are normalised on load, so memberships are rebuilt from specimen records and can never disagree.
7. **Sessile and crawling creatures live on the reef.** Sponges, anemones, sea fans, sea stars, urchins and nudibranchs are anchored to features (reefs, rocks, vents, kelp) in the ocean and to decor in tanks. Free-swimming creatures roam freely.
8. **Gentle catch is a dwell, not a button.** Holding the scoop still inside the ring fills progress over about 1.2 seconds. Speed, a frightened creature or leaving the ring drain it. The ring is a fixed 56 CSS pixels at any zoom, so touch targets stay usable.
9. **Light falloff is the depth.** One world unit is about 0.2 m. Zones are sunlit (to 200 m), twilight (to 1000 m), midnight (to 4000 m) and abyss. The background, vignette, dimming and sun rays all follow the depth.
10. **Care is gentle.** Hunger builds over four hours without a meal, comfort never drops a creature below zero, and nothing dies. A returning player finds their creatures hungry, not gone.
11. **Persistence.** Progress is saved to `localStorage` under one versioned key after each change. `normalize` repairs or drops anything unreadable and never throws. Backups can be downloaded and restored as JSON. If storage is unavailable, the game still plays for the visit and says so.
12. **Audio is synthesized.** WebAudio generates the chime, bubble and feeding sounds and a faint ambient hum. It starts only after the first gesture.
13. **Accessibility.** Controls are real buttons with labels; sheets are modal dialogs with focus moved in, Escape to close, and focus restored on close. Status messages go to a polite live region. Colour pairs were chosen for contrast in both themes. Reduced motion (device setting or in-game) limits particles, population and the frame budget.
14. **Performance.** Creatures use three levels of detail by on-screen size. Feature and decor art is painted once and reused, glows come from cached sprites, particles come from a fixed pool, and the frame loop lowers quality and pixel density when it runs slow.
15. **Security and privacy.** No network calls except the p5.js script and Google Fonts. p5.js is pinned to `1.9.4` with an SRI hash. Nothing is sent anywhere, and no analytics are included.

## Testing

```sh
node --test procedural-marine-bestiary/tests/core.test.mjs
```

The 53 unit tests cover:

- the 42-gene genome and its validation;
- taxonomy and subgroup coverage;
- deterministic decoding, and diversity (500 unique visual and 500 unique motion signatures per class);
- naming and rarity distribution;
- save normalisation, catch recording and catalogue numbering;
- the 40-creature tank cap, overflow, moves, releases and the 30-piece decor cap;
- comfort, hunger, mood thresholds and feeding;
- the gentle-catch dwell;
- ocean zones, deterministic chunks, currents and class weights;
- the single-file deliverable and its CDN allow-list.

The browser behaviour (drag, catch, keep, bestiary, tanks, decor, feeding, settings, reload persistence, phone and landscape layouts, and page errors) was checked with a Playwright smoke run during development. That run is not committed because it needs a browser and a local copy of p5.js.

## Known limitations

- p5.js is loaded from jsDelivr. The game needs network access on first load. A clear message appears if the library fails to load.
- Performance was measured only in headless Chromium with a software canvas, where a 390×844 phone viewport held about 60 fps with 30 creatures and the particle budget full. Phones with GPU-accelerated canvases will behave differently, and that has not been measured on device.
- The ocean is generated from one random seed per session, so the sea is not the same on each visit.
- There is no delete for bestiary entries, because entries are permanent by design.
