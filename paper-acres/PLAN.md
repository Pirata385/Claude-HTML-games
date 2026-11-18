# Paper Acres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A two-tone (beige + black) ASCII farming/life platformer in Phaser 3.90 where a stickman walks through depth slices of a 3D world, farms, befriends a town, draws inanimate objects into existence and fights with real physics.

**Architecture:** Classic `<script>` files sharing a global `PA` namespace (opens over `file://`); pure logic modules also `module.exports` for `node --test`. One Phaser scene (`Game`) renders a 3D cell grid as a perspective stack of slice layers built from a runtime glyph atlas into per-chunk Blitters; Matter physics handles the player, combat, and drawn objects; NPCs/animals use grid kinematics. HUD and menus are DOM overlays.

**Tech Stack:** Phaser 3.90.0 (vendored `lib/phaser.min.js`, Matter physics), WebAudio synthesis, Courier Prime + Patrick Hand (vendored woff2, OFL), Node 18+ `node:test`, Playwright (pre-installed) for browser checks.

**Spec:** `paper-acres/DESIGN.md` (copied from the approved plan).

## Global Constraints

- Only two colours anywhere: paper `#efe4c8` and ink `#000000` (CSS, canvas, Phaser tints). No alpha used to create tones; tones come from glyph density, ordered dithering and inverted cells. Edge anti-aliasing is acceptable.
- Ruled lines: thin black (~1 px) aligned to world rows; margin: thin black line.
- Cell = 12 × 20 world px; glyph atlas cells are 24 × 40 px (2×).
- Overworld 480 × 48 × 12 (x, y, z); y grows downward; z = 0 is nearest the viewer.
- Slice scale `s(k) = 1 / (1 + 0.35·k)` toward vanishing point (screen centre x, 28 % from top); draw up to 5 slices ahead (setting 2–6).
- Slice step only if the player box fits in the destination; auto step-up ≤ 1 cell; tween `zCam` over 220 ms.
- Drawing produces only inanimate objects from the unlocked word list; never creatures.
- Pencil (graphite) objects fade over 3 days and can be erased; pen (ink) objects are permanent. Cost = filled cells × word multiplier; eraser refunds 50 %.
- Game text in English. Desktop (keyboard/mouse), touch, basic gamepad.
- Edits outside `paper-acres/`: only the root `index.html` (GAMES entry + `paper` drawArt branch) and the root `README.md` table row.
- Commit and push after each milestone to `claude/ascii-stickman-farm-game-67tb1d`.

## Review Focus

1. Resizing / rotating a phone mid-game → canvas, zoom and touch controls re-layout without stretching or losing input. (Task 1.6: resize test in Playwright.)
2. Stepping into a slice while overlapping a drawn object or NPC → the step is refused, never embeds the player in geometry. (Task 1.5 test `stepSlice refuses when blocked by body`.)
3. Corrupt / old save in localStorage → title screen still loads, offers new game, never throws. (Task 2.4 test `load tolerates garbage`.)
4. Drawing an empty or 1-dot sketch → confirm is disabled, no zero-cell object, no ink charged. (Task 4.2 test `empty sketch rejected`.)
5. Tab hidden / huge frame delta → time and physics don't jump (clamped delta, auto pause). (Task 1.6: delta clamp in Game loop; Playwright visibility check.)

---

## File map (responsibilities)

| File | Responsibility |
| --- | --- |
| `index.html` | DOM shell, CSS (two colours), script order, overlay roots (`#hud`, `#menu`, `#dialog`, `#touch`, `#sketch`, `#title`) |
| `src/core/config.js` | `PA.C` constants (sizes, colours, tuning) |
| `src/core/util.js` | `PA.U` clamp/lerp/bayer4/etc. |
| `src/core/rng.js` | `PA.RNG` seeded RNG, hashes, value noise |
| `src/core/events.js` | `PA.Bus` tiny pub/sub |
| `src/ascii/glyphs.js` | Builds glyph atlas texture; `PA.Glyphs.frame(ch, style, variant)` |
| `src/ascii/rasterize.js` | Strokes/segments → ASCII cells |
| `src/ascii/shapes.js` | Shape features + word ranking |
| `src/world/tiles.js` | Tile registry `PA.T` / `PA.TILES` and glyph selection |
| `src/world/grid.js` | `PA.Grid` 3D storage + edit log |
| `src/world/gen.js` | Overworld, interiors, mine floors |
| `src/render/paper.js` | Page background, ruled lines, margin, holes, specks |
| `src/render/sliceStack.js` | Perspective slice layers, chunk Blitter cache, depth lightening |
| `src/render/entities.js` | Per-slice dynamic glyph layers (full + half cell) |
| `src/render/lighting.js` | Night inversion mask (subtract blend / canvas difference), dusk hatch |
| `src/render/weather.js` | Screen-space rain/snow/leaves glyphs |
| `src/physics/terrain.js` | Static Matter bodies from grid (greedy rects), per-slice filters |
| `src/physics/stickman.js` | Procedural skeleton poses, segments, ragdoll |
| `src/physics/player.js` | Player controller (Matter body, slice stepping, ladders, water) |
| `src/draw/words.js` | Word catalogue (shape prefs, multiplier, behaviour) |
| `src/draw/sketchpad.js` | DOM/canvas sketch UI, live ASCII preview, word list |
| `src/draw/drawnObject.js` | Materialise drawings as Matter bodies, fading, erase |
| `src/farm/items.js` | Item registry |
| `src/farm/inventory.js` | `PA.Inventory` |
| `src/farm/crops.js` | Crop defs, growth per day |
| `src/farm/tools.js` | Tool actions on the grid |
| `src/farm/crafting.js` | Recipes, machines |
| `src/farm/animals.js` | Livestock |
| `src/life/wildlife.js` | Critters |
| `src/life/fishing.js` | Fishing minigame |
| `src/town/npcs.js` | NPC data (looks, gifts, birthdays, dialogue) |
| `src/town/schedules.js` | NPC routines and runtime movement |
| `src/town/dialogue.js` | Line selection, friendship, heart events |
| `src/town/shops.js` | Shop stock and buy/sell |
| `src/town/quests.js` | Request board, Torn Pages bundles, mail |
| `src/town/festivals.js` | Seasonal festivals |
| `src/combat/weapons.js` | Physical weapons on the hand joint |
| `src/combat/enemies.js` | Enemy types (Matter) |
| `src/combat/mine.js` | Mine floors runtime, elevator |
| `src/combat/bosses.js` | Coffee Stain, Scissor Knight, The Eraser |
| `src/systems/state.js` | `PA.newState(seed, opts)` central game state |
| `src/systems/time.js` | Clock, days, seasons, weather roll |
| `src/systems/save.js` | Slots, serialise/deserialise, export/import |
| `src/systems/settings.js` | Settings load/save/apply |
| `src/systems/input.js` | Keyboard/mouse/touch/gamepad → action snapshot |
| `src/systems/audio.js` | Generative music + SFX |
| `src/systems/quality.js` | Auto quality from FPS |
| `src/ui/hud.js`, `notebook.js`, `dialogueBox.js`, `touch.js`, `title.js` | DOM UI |
| `src/scenes/Boot.js`, `Game.js` | Phaser scenes |
| `tests/*.test.js` | Node tests; `tests/load.js` loads modules into `globalThis.PA` |

---

## Milestone 1 — Engine

### Task 1.1: Vendored libs, shell, core modules
**Files:** Create `lib/phaser.min.js`, `lib/PHASER-LICENSE.txt`, `fonts/*.woff2`, `fonts/OFL.txt`, `index.html`, `src/core/{config,util,rng,events}.js`, `tests/load.js`, `tests/rng.test.js`
**Interfaces — Produces:**
- `PA.C = { CELL_W:12, CELL_H:20, GW:24, GH:40, PAPER:'#efe4c8', INK:'#000000', PAPER_N:0xefe4c8, INK_N:0x000000, SLICE_K:0.35, HORIZON:0.28, STEP_MS:220, CHUNK_W:32, CHUNK_H:16 }`
- `PA.RNG.mulberry32(seed) → () => number[0,1)`, `PA.RNG.hash3(x,y,z,seed) → uint32`, `PA.RNG.noise1(x, seed) → [0,1]` (smooth value noise), `PA.RNG.seedFrom(str) → uint32`, `new PA.RNG.Rng(seed)` with `next() int(a,b) pick(arr) chance(p)`
- `PA.U.clamp, lerp, bayer4(x,y) → [0,1)`, `PA.Bus.on/off/emit`
- `tests/load.js`: `load(...relPaths)` evaluates files with `globalThis` as root, returns `globalThis.PA`
- [ ] Test `rng determinism`: two `Rng(42)` produce the same 100 numbers; `Rng(43)` differs; `noise1` continuous (|n(x)-n(x+0.01)| < 0.05)
- [ ] Implement; `node --test paper-acres/tests` → PASS; commit

### Task 1.2: Rasterizer and glyph atlas
**Files:** Create `src/ascii/rasterize.js`, `src/ascii/glyphs.js`, `tests/rasterize.test.js`
**Interfaces — Produces:**
- `PA.Rasterize.strokesToCells(strokes, cols, rows) → string[]` (rows of length `cols`, `' '` empty). `strokes`: arrays of `{x,y}` in cell units.
- `PA.Rasterize.segmentsToCells(segs, cols, rows) → string[]` with `segs` = `{x1,y1,x2,y2}` in cell units (used by stickman, rotated drawings).
- Algorithm: sample every 0.2 cell; per cell accumulate direction bins H/V/D1(`/`)/D2(`\`) (undirected, screen y down), mean y-fraction, count. Char: one bin → `-` (`_` if mean y-frac > 0.72), `|`, `/`, `\`; H+V → `+`, or `.` if V lies below H, `'` if V above H; D1+D2 → `x`; ≥3 bins → `#`; strokes shorter than 0.35 cell → `.`; closed stroke with bbox < 1.2 cells → `o` (bbox 1.2–2 → `O`).
- `PA.Glyphs.CHARS` (ASCII 32–126), `PA.Glyphs.build(scene)` creates texture `'glyphs'` with frames for style 0 regular, 1 bold, 2 inverted (paper glyph on ink box) × 3 jitter variants; `PA.Glyphs.frame(ch, style, variant) → frame index`.
- [ ] Tests: horizontal → `'-----'`; vertical → `'|'` column; up-right diagonal → `/`; down-right → `\`; plus sign centre `+`; line at cell bottom → `_`; tap → `.`; small loop → `o`; rectangle top corners `.` bottom corners `'`
- [ ] Implement; tests PASS; commit

### Task 1.3: Tiles, grid, test world
**Files:** Create `src/world/tiles.js`, `src/world/grid.js`, `tests/grid.test.js`
**Interfaces — Produces:**
- `PA.T` ids: `AIR 0, DIRT 1, GRASS 2, STONE 3, BEDROCK 4, WATER 5, SAND 6, PLANK 7, TRUNK 8, LEAVES 9, BRICK 10, ROOF 11, WINDOW 12, DOOR 13, LADDER 14, FENCE 15, SOIL 16, SOIL_WET 17, WEED 18, ROCK 19, BRANCH 20, FLOWER 21, BUSH 22, ORE_COPPER 23, ORE_IRON 24, ORE_GOLD 25, ORE_GRAPHITE 26, INKSTONE 27, SNOW 28, ICE 29, WALL_BG 30, FLOOR 31, COUNTER 32, SHELF 33, BED 34, TABLE 35, SIGN 36, CROP 37, STUMP 38, MUSHROOM 39, BOULDER 40, SPIKES 41, CRYSTAL 42, RAIL 43, ...`
- `PA.TILES[id] = { name, solid, ladder, water, tillable, decor, breakable:{tool, hp, drop}, glyph(x,y,z,surface,h) → char }`
- `new PA.Grid(w,h,d)`; `get(x,y,z)` (x out of range → STONE, y<0 → AIR, y≥h → BEDROCK); `set(x,y,z,t, log=true)`; `meta(x,y,z)/setMeta`; `solid(x,y,z)`; `surfaceY(x,z)`; `onChange(fn)`; `edits` Map idx→tile; `exportEdits() → [[idx,tile],...]`; `importEdits(list)`
- [ ] Tests: set/get roundtrip; out-of-bounds rules; `surfaceY` on flat ground; edits recorded and re-imported onto a fresh grid
- [ ] Implement; tests PASS; commit

### Task 1.4: Rendering — paper, slice stack, entity layers
**Files:** Create `src/render/{paper,sliceStack,entities}.js`, `src/scenes/{Boot,Game}.js` (minimal), wire `index.html`
**Interfaces — Produces:**
- `new PA.Paper(scene)`; `paper.update(cam)` — fixed-screen specks/holes/margin; ruled lines scroll with `cam.y` and `cam.zoom`.
- `PA.View` projection: `PA.View.slice(k, cam, screenW, screenH) → {scale, ox, oy}` so `screen = (ox + worldX*scale, oy + worldY*scale)`; `cam = {x, y, z (float zCam), zoom}`; vanishing point `(W/2, H*0.28)`; current slice anchor `(W/2, H*0.58)`.
- `new PA.SliceStack(scene, map)`; `setCamera(cam)`; `update()`; `invalidate(x,y,z)`; `setMaxSlices(n)`; `destroy()`. Cache key `z:cx:cy:level`, LRU 96 Blitters. Level = `round(z - cam.z)`; level 0 bold; level ≥1 regular, lightened via `PA.SliceStack.lighten(ch, level)`, dropped when `bayer4(x,y) < [0,.12,.3,.45,.6,.72][level]`. Slices behind current: drawn only mid-transition with 0.8 dropout.
- `new PA.Entities(scene)`; per frame `begin(cam)`, `text(z, wx, wy, lines, {style, half, anchor})`, `segs(z, wx, wy, segs, {style})` (half-cell raster), `end()`.
- [ ] Playwright smoke: page loads, no console errors, screenshot shows ground and stacked slices; commit

### Task 1.5: Physics terrain, stickman, player
**Files:** Create `src/physics/{terrain,stickman,player}.js`, `tests/stickman.test.js`
**Interfaces — Produces:**
- `PA.sliceBit(z) = 1 << (z & 15)`
- `new PA.Terrain(scene, map)`; `sync(px, z)` builds bodies for chunks within ±2 of `px` in slices z−1..z+1; `invalidate(x,y,z)`; `destroy()`. Greedy merge `PA.Terrain.rects(grid, z, x0, y0, w, h) → [{x,y,w,h}]` (cell units, pure).
- `PA.Stick.pose(kind, t, p) → joints` with joints `head, neck, hip, elbowL, handL, elbowR, handR, kneeL, footL, kneeR, footR` (world px, origin at feet centre); kinds `idle walk run jump fall climb swim swing sit sleep hurt`; `PA.Stick.toSegs(joints) → segs`.
- `new PA.Player(scene, map, x, y, z)`; `update(dt, input)`; `stepSlice(dir) → boolean`; props `z, facing, grounded, body, joints, state`.
- Tuning: Matter gravity y = 1.6, player body 14 × 46 px chamfer 6, friction 0, inertia ∞; walk 2.6 px/step, run 4.2; jump vel −9.5; coyote 100 ms; jump buffer 120 ms.
- [ ] Tests: `Terrain.rects` covers every solid cell exactly once on a random grid; `Stick.pose('walk')` keeps feet within 2 px of ground at phase 0/0.5
- [ ] Playwright: hold D for 1 s → x increases; press W → z+1 after 300 ms; commit

### Task 1.6: Input, camera, resize, loop
**Files:** Create `src/systems/input.js`, `src/ui/touch.js`; finish `Game.js` loop
**Interfaces — Produces:**
- `PA.Input.init(scene)`; `PA.Input.poll() → { moveX, up, down, upP, downP, jump, jumpP, run, use, useP, aim (rad|null), interactP, drawP, menuP, mapP, pauseP, hotbar (0-8|-1), wheel }` (`P` = pressed this frame)
- Touch overlay (outline-only): joystick left (flick up/down = slice), buttons Jump / Use / Act / Draw; hidden on non-touch unless setting forces.
- Game loop clamps dt to 50 ms; DPR-aware canvas (`scale.mode NONE`, size = css × min(dpr, cap), zoom 1/dpr); world zoom = canvasH / (rows·CELL_H) with rows 24 (≥ 700 css px) or 20 (phones).
- [ ] Playwright: resize 1280×720 → 844×390 → no errors, canvas matches; touch emulation tap Jump → player leaves ground; Milestone 1 commit + push

## Milestone 2 — World

### Task 2.1: Overworld generator
**Files:** Create `src/world/gen.js`, `tests/gen.test.js`
**Interfaces — Produces:** `PA.Gen.overworld(seed) → map` where `map = { id:'overworld', kind, grid, doors:[{x,y,z,to,toX,toZ}], spots:{spawn, bin, mailbox, mine, board, ...}, zones:[{name,x0,x1}], props:[] }`; `PA.Gen.interior(id) → map`; `PA.Gen.mineFloor(seed, n) → map`.
Layout per DESIGN: farm x 0–150 (z0 road, z1 yard w/ bin+mailbox, z2–z5 field rows, z6 house facade, z7–z8 house body, z9 creek, z10–11 hills/forest), town x 190–330 (street z2, facades z3, plaza z5, alley z7), forest/lake x 330–420, mountain + mine entrance x 420–480.
- [ ] Tests: determinism (hash of tiles equal for same seed, different for other); BFS reachability (step rules) from spawn to bin, house door, town board, every shop door and mine entrance; creek z9 not crossable without help
- [ ] Implement; PASS; commit

### Task 2.2: Interiors and doors
- `PA.Gen.interior(id)` for `house, store, smith, stationer, carpenter, ranch, cafe, clinic, library, hall, coop, barn, npcHomes`; `Game.loadMap(id, entry)` swaps stack/terrain/entities; fade = dithered wipe.
- [ ] Playwright: walk into farmhouse door, interact → interior loads; exit returns to overworld door; commit

### Task 2.3: Time, weather, lighting
**Files:** `src/systems/time.js`, `src/render/{lighting,weather}.js`, `tests/time.test.js`
- `PA.Time.tick(state, realMs, msPerGameMin)`; `PA.Time.newDay(state) → {season changed, weather}`; seasons `['spring','summer','fall','winter']`, `daysPerSeason` 28|14; day 6:00 → 26:00 (2am pass-out); default 700 ms per game minute.
- Night mask: darkness 0 until 18:00, dithered ramp to 1 by 20:30; lights from lanterns/windows/player lantern.
- [ ] Tests: 1200 game minutes → pass-out flag; day 28 → next season; weather deterministic by seed+day; commit

### Task 2.4: State, save, title
**Files:** `src/systems/{state,save,settings}.js`, `src/ui/title.js`, `tests/save.test.js`
- `PA.newState(seed, {name, farmName, seasonDays}) → state`; `PA.Save.write(slot, state, maps)`, `read(slot) → state|null`, `list() → [{slot, summary}]`, `exportJSON`, `importJSON`; key `paperacres.slot{n}`; autosave on new day.
- [ ] Tests: roundtrip deep-equal (inventory, edits, crops, words); `load tolerates garbage` (`read` returns null for `'{bad'`); Milestone 2 commit + push

## Milestone 3 — Farming

### Task 3.1: Items + inventory
**Files:** `src/farm/{items,inventory}.js`, `tests/inventory.test.js`
- `PA.Items.get(id)` → `{id,name,icon,cat,price,energy,stack,season,desc}`; ≥ 120 items (tools, 16 seeds/crops, forage 12, fish 12, ores/bars, food, artisan, materials, machines, furniture).
- `new PA.Inventory(36)`; `add(id, n, extra) → leftover`; `remove(id, n) → bool`; `count(id)`; `swap(a,b)`; `sort()`; `toJSON()/PA.Inventory.from(json)`; hotbar = slots 0–8.
- [ ] Tests: stacking to 99, overflow leftover, remove across stacks, drawn items (extra) never stack; commit

### Task 3.2: Tools, soil, crops, debris
**Files:** `src/farm/{tools,crops}.js`, `tests/crops.test.js`
- `PA.Tools.use(game, toolItem, targetCell) → {ok, energy}`; targets = surface cell in front of player in current slice; hoe tills GRASS/DIRT surface on farm → SOIL; can wets SOIL → SOIL_WET; scythe cuts WEED/harvests; axe BRANCH/TRUNK/STUMP; pick ROCK/ORE.
- `PA.Crops.DEFS` 16 crops (4/season) `{id, seasons, days, stages, regrow, seed, sell}`; `PA.Crops.newDay(state, rained)` grows watered crops, kills out-of-season, resets wet soil (unless rain).
- [ ] Tests: grows only when watered; harvest ready at `days`; regrow; season change kills; rain waters; commit

### Task 3.3: Shipping, machines, energy, HUD, notebook menu
**Files:** `src/farm/crafting.js`, `src/ui/{hud,notebook}.js`
- Shipping bin pays next morning; machines `kiln (wood→charcoal→graphite)`, `inkpress (inkcap/berries→ink)`, `jar (crop→preserve)`, `furnace (ore→bar)` process over game minutes; workbench recipes.
- Notebook tabs: Inventory, Words, Map, Calendar, Journal, Friends, Collection, Settings, Save.
- [ ] Playwright: till, plant, water, sleep → crop stage advances; ship item → gold next day; Milestone 3 commit + push

## Milestone 4 — Drawing

### Task 4.1: Words + shape ranking
**Files:** `src/draw/words.js`, `src/ascii/shapes.js`, `tests/shapes.test.js`
- `PA.Words.ALL` ~44 entries `{id, name, cat:'structure'|'physics'|'tool'|'combat'|'home', mult, shape:{aspect:[lo,hi], dom:'h'|'v'|'round'|'box'|'any', filled}, body:'static'|'dynamic'|'item'|'float', behaviour}`; starting words `plank, ladder, crate, bridge, sign, umbrella`.
- `PA.Shapes.features(cells) → {w,h,aspect,density,closed,h,v,d,round}`; `PA.Shapes.rank(features, wordIds) → [{id,score}]`.
- [ ] Tests: long line → top-2 ⊂ {bridge, plank}; box → crate top-3; tall thin → ladder top-3; circle → boulder/ball/wheel top-3; commit

### Task 4.2: Sketchpad + ink economy
**Files:** `src/draw/sketchpad.js`, `tests/ink.test.js`
- Full-screen DOM canvas pad (grid up to 24×14, upgradable from 12×8), tools pencil/pen/eraser/fill/undo/clear, live ASCII preview, ranked word list (unlocked only), placement step (choose slice z−1/z/z+1, position).
- `PA.Ink.cost(cells, word, medium) → number`; `PA.Ink.charge(state, cost, medium) → bool`; `PA.Ink.refund(state, obj)`.
- [ ] Tests: cost = filled × mult; charge fails when short; refund 50 %; `empty sketch rejected`; commit

### Task 4.3: Drawn objects in the world
**Files:** `src/draw/drawnObject.js`
- `PA.Drawn.spawn(game, drawing, word, x, y, z)` → Matter compound body from merged cell rects; static structures freeze when sleeping; floats on water (boat/raft/balloon); tools/weapons become inventory items with the drawing as icon; pencil fade 3 days via dither dropout; erase with eraser tool; persisted in `state.drawings`.
- Rotated rendering re-rasterises stored strokes at angle buckets (32).
- [ ] Playwright: draw a line, pick Bridge, it settles across a gap and the player walks over it; Milestone 4 commit + push

## Milestone 5 — Town
- Task 5.1 `npcs.js` + `schedules.js`: 13 NPCs (Dot & Dash = 2) with homes, routines (time → map/x/z), kinematic walkers, name tags. Test: schedule resolver returns correct location at given times.
- Task 5.2 `dialogue.js` + `dialogueBox.js`: line picking by season/weather/hearts, daily talk +20 pts, gifts (loved +80, liked +45, neutral +20, disliked −20, hated −40, birthday ×8), 250 pts per heart, 2 heart events each. Test: friendship math.
- Task 5.3 `shops.js`: stock per shop/season, buy/sell, tool upgrades (2 days), word cards, buildings (coop, barn, house upgrade). Test: buy deducts gold/adds item, cannot overspend.
- Task 5.4 `quests.js` + `festivals.js`: request board (daily), mail, 6 Torn Pages with bundles and world unlocks, 4 festivals. Test: bundle completion unlocks flag. Milestone 5 commit + push.

## Milestone 6 — Life
- Task 6.1 `animals.js`: buy chickens/cows/goats/sheep (needs coop/barn), feed, pet, products daily by happiness. Test: product produced when fed.
- Task 6.2 `wildlife.js`: rabbits, birds, butterflies, frogs, deer, crows (eat unprotected crops; scarecrow radius 8 protects). Test: crow rule.
- Task 6.3 `fishing.js`: cast, bite timer, bar minigame, 12 fish by location/season/time. Milestone 6 commit + push.

## Milestone 7 — Combat & Mine
- Task 7.1 `weapons.js`: weapon body jointed to hand, swing torque toward aim, damage = impulse·k, shield block, bombs radial impulse. Test (pure): `PA.Weapons.damage(relVel, mass)` monotonic.
- Task 7.2 `enemies.js`: Smudge, Scrawl Bat, Paperclip Spider, Eraser Mite, Crumple, Ink Golem; slice changing; drops.
- Task 7.3 `mine.js`: 30 floors from `Gen.mineFloor`, ladders/holes, elevator every 5, ores, inkcaps; faint → clinic, lose 10 % gold + random items.
- Task 7.4 `bosses.js`: Coffee Stain (10), Scissor Knight (20), The Eraser (30, erases terrain). Milestone 7 commit + push.

## Milestone 8 — Audio
- Task 8.1 `audio.js`: master/music/sfx buses; generative scheduler (lookahead 100 ms), instruments pluck (Karplus-Strong buffers cached per note), kalimba, soft keys, bass, pad, noise perc; themes spring/summer/fall/winter/night/town/mine/boss/festival/title; crossfades; SFX set listed in DESIGN; pencil scratch tied to stroke speed. Milestone 8 commit + push.

## Milestone 9 — Polish
- Task 9.1 Settings complete (volumes, day length, UI scale, wobble/boil, shake, slices 2–6, auto quality, touch layout/left-handed, hints, reduced motion, pause on blur); `quality.js` auto adjusts DPR cap, slices, boil.
- Task 9.2 Map tab (top-down ASCII x×z), journal, tutorial on first days, contextual hints.
- Task 9.3 Palette test (`tests/palette.test.js`: scan `index.html`, `src/**` for hex/rgb/hsl/named colours ≠ the two) + screenshot pixel sampling script.
- Task 9.4 README.md, DESIGN.md, root `index.html` GAMES entry + `paper` drawArt, root README row; full Playwright pass (desktop + iPhone 13 landscape/portrait, FPS sample, file:// load). Final commit + push.
