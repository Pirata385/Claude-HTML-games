# Notes from B (creatures, world, spawn, art)

All §15.5 B contracts exist with the documented signatures. Items below are clarifications and backward-compatible
extensions.

## Data
- **`AQ.species`**: all 42 entries (§6.1–6.3), `fight.tell` from rarity, `fight.special` per §4.8 (`inflateAt`,
  `grip` (arraia, ermitao, lagosta, polvo, aranha), `roll`, `inkChance`, `glowInk`, `tear`, `scramble`, `alarm`).
  Extras: `timeMul` ({noite:2} for siri), `nearKind` (kind used for tank rules; `odd` → crustacean/fish), `camo`
  (escorpiao), `floats` (caravela), `glowAt:'noite'` (aguaviva), `lureLight` (diabo), `boss` (tinteira),
  `produces` for camarao = `{item:'camarao', qty:2, everyMin:10, minHappy:60}`; `keep:false` only for tinteira.
  Helpers: `sizeIndex(spOrSize)`, `name(id)`, `flavor(id)`, `TELL`.
- **`AQ.sightings.list`** entries also carry `size`, `depth`, `count` (golfinhos = 3 individuals), `speed`,
  `path` ('pass' | 'leap'). Helpers `inZone`, `name`, `flavor`.
- **`AQ.zones`** extras: `maxM`, `req` (informative unlock requirements; D's `progress` is the authority),
  `floorY(zoneOrId, x)` (= `depth·(base + amp·fbm2(x·freq, order·7.31+.5))`, use it so creatures and terrain agree),
  `depthM(zoneOrId, y)`, `name(id)`.
- **Strings** (`strings-world.js`): `sp.<id>.name|flavor|pt` (`.pt` = pt-BR name in both languages, for the bestiary's
  small print in English), `sighting.<id>.name|flavor|pt`, `zone.<id>.name|short|desc`,
  `zone.depth.surface|mid|bottom|deep` (bestiary hints), `phase.*` (+ `phase.any`), `weather.*` (+ `weather.any`),
  `kind.*`, `behavior.*`, and `sp.habitat.*`, `sp.light.*`, `sp.diet.*` (fish card "Gosta de: …").

## World (`AQ.world`)
- `state.world.minutes` is **absolute** game minutes. `now(state).minutes` is the **minute of the day** (0..1439);
  `now().total` is absolute. `AQ.util.fmtClock(now.minutes)` gives HH:MM.
- `tick/advance/advanceTo` coalesce events (one per kind per call) and emit `world:phase`, `world:weather` and
  also `world:hour` {hour, day}. Extras: `advance(state, minutes)`, `minutesUntil(state, phase)`, `stationary()`.
- `advanceTo(state, phase)` returns 0 when the clock is exactly at that phase's start.
- **Dark rule interpretation:** `isDark` = zone rule first (`always && depth ≥ below` → dark; at **night** dark iff
  `depth ≥ nightBelow`, i.e. the top of Baía/Recife/Kelp stays moonlit), otherwise `light() < .3`. `light()` blends
  phases over 30 min around each boundary (dawn/dusk .6, night .25, × weather × fog).
- Long-run storm share from the Markov table = 11.5%.

## Spawn (`AQ.spawn`)
- `conditionsMet`: time + weather; legendaries also need a bait with affinity > 0. Bait affinity is not a presence
  condition for others (it boosts the weight; fish that ignore your bait still swim by).
- Weather multipliers: "surface species" = `depth[0] < .05`; "predators" = `diet === 'predator'`.
- `schoolSize`: 4–8, but **3–5 for M-and-larger schools** (atum is L).
- `rollSpecimen`: `kg` = 3 significant digits below 1 kg (else round2) so tiny fish never read 0 kg; `zone` =
  `ctx.zone` or the species' zone. Extras: `bredSpecimen(id, a, b, rng)` (§6.7 juvenile length; D sets dense/bred),
  `kgFor(sp, len)`, `weatherMul`.

## Creatures (`AQ.creatures`)
- `create(id, opts, rng)` also accepts sighting ids (behaviour `ambient`) and `opts.school` (shared
  `{members:[]}`), `opts.buried`. **`createSchool(id, n, opts, rng)`** spawns a whole school (use it for `school`
  species and frenzies). `setJuvenile(c, on)` swaps to/from `_alevino`.
- Positions are the sprite-box centre (same as `render.sprite`). `mouth(c, out?)` → where the hook sits (the head
  end). `engaged(list)` → the nibbling/biting/hooked creature. `noticeRadius(c, hook, env)` for debug drawing.
- **Engagement flow (wild):** notice → `onEvent('notice')` → circles 0.5–1.5 s → `nibble` ×`rng.int(wariness+1)`
  (`onEvent('nibble', c, {left})`, 0.6–1.2 s apart; none in a frenzy) → lunges: **`onEvent('bite', c)`** when the
  mouth reaches the hook, then it **holds on the hook** until C resolves: `setHooked(c, true)` (strike in time) or
  `spook(c, 8)` (early/late; schoolmates get sec/2 automatically). If C does nothing for 6 s the fish leaves by itself
  (`onEvent('leave', c, {reason:'timeout'})`). Losing the hook (inactive or > 10 u away) → `leave` `{reason:'lost'}`.
  Static lures stall the approach (they bite only while moving). A hooked creature counts as engaged.
- **While hooked** C writes `c.x/c.y`; I derive velocity, facing (hysteresis) and a fast frame rate. Set
  `c.data.faceLock = ±1` to force facing. `setHooked(c, false)` → flee at ~2× speed and ignore hooks 8 s.
- **Poses:** set `c.pose = 'inflate'` (baiacu), `'ink'` (polvo), `'jet'` (lula), `'hide'` (ermitao), `'roll'`
  (isopode) to draw that extra frame; `null` returns to normal. Some poses also play automatically (flee, dart).
- `c.data.scramble = 0..1` makes the Typefish letters scatter (C: set ~1 on each shake; it decays).
- `update()` **removes creatures that left** (wild: 20 u past the edge once they are leaving; sightings when they
  exit) from the array in place, after `onEvent('leave', c, {reason:'despawn'})`. `remove(list, c, true)` fades out
  over 0.4 s (silent). Title mode wraps around instead.
- Extra `onEvent` type **`'splash'`** `{x, y, up}` when a leaper/dolphin crosses the surface.
- `env` extras read if present: `depth` (zone depth, default `bounds.y1 − surfaceY`), `dark` (bool) or
  `isDark(x, y)` for the luminosa ×1.5 rule, `current` (drift speed factor), `light` ('day'|'dim'|'night' in the
  tank; night makes day fish rest low and glow species glow), `level` (base level, e.g. a dim title background).
- `draw`: level = round((hooked ? 14 : env.level || 12) × visibility), min 1. **visibility should include depth
  fog** (I don't apply fog again). Glow cells at 10–12 when visibility < .5 (or a dim/night tank); legendaries get a
  rotating `.` halo at level 2; R/L/dense shimmer; dense = bold + densify; burrowed arraia shows only eyes + tail;
  escorpiao is capped at level 3 until the hook is within 8 u; atolla flashes its ring when hooked.
- Tank: `env.food = [{x, y, id}]` → fish swim to flakes and `onEvent('eat', c, {id})` (each id at most once per
  update); covers' `kind` or `tags` (`rocks`, `cave`, `plants`, `coral`) anchor lurkers/hoverers.

## Sprites (`AQ.sprites`)
- Helpers (non-enumerable): `get`, `keys()`. Each SpriteDef also has `key`, `extraMasks`, `buried` (cells drawn
  while buried), `lure` (diabo's light cell).
