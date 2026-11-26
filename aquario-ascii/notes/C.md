# Notes from C (fishing)

Files: `js/logic/{fight,bite,line}.js`, `js/data/strings-fishing.js` (English only), `js/scenes/{map,fishing-bg,fishing-hud,fishing}.js`,
`tests/{test-fight,test-line,test-bite}.js`, `tests/balance-report.js` (fights; requires `tests/balance-pacing.js` if present).

## Fight model (§4.7–4.8) — deviations and extensions (all in `AQ.fight.CONST`)
The spec formulas are implemented verbatim. Three behaviours had to be added so that the §15.11 assertions can hold:
- **Burrow arrival** `BURROW_ARRIVE: 8`: a burrowing fish's speed toward its cover is × `min(1, d/8)`. Without it a fish
  hooked next to its hole (the normal case: lurkers hold near covers) frays before any counterplay. Steering away plus
  reeling now keeps it out (autopilot ≥ 93 %; rod 0 frays 25–35 %).
- **Soft-body drag** `SOFT_DRAG: .7`: species with `special.tear` get `+ .7 × gain` on the target tension while reeling.
  With drift `pm = .3` and tier-4 `Ls`, T could never reach `tear`, so "always reel tears ≥ 70 %" was unreachable.
- **Boss hold** `BOSS_HOLD: 12`: before phase 2 a boss cannot be reeled within ~12 u (gain fades over 12–22 u), so all
  three phases always play (the marlin used to land at S ≈ .45).
- Also: `T` is hard-capped at `T_MAX 1.6`; the hookset's first state is never rest/burrow/grip; jump = rise at −2v →
  airborne `AIR_TIME` on a −4 u arc → splash at y = 3 → rest; tells × .85 in a boss's last phase; tinteira rises under
  S .1; grip special adds a `grip .15` weight (arraia only near the floor); roll special adds `roll .2`.
- `create(..., opts)` extras: `origin {x, y}` (fight space = world − origin; `floorY` gets world x, covers are world
  rects), `viewCols`, `script {power, stamina, runs:[{at, dir}], noEscape}`. Without covers a virtual cover sits 12 u
  beside / 6 u below the hook site.
- `step()` returns a **reused** array (copy what you keep). Extra event `{type:'air', on}` (jump leaves/enters water).
- Extras: `AQ.fight.danger(fs)` → 0..1 (closest failure timer), `DT`, `DUR`, `BOSSES`, `NEEDS_TELL`.

## Other logic
- `AQ.bite.window(sp, gear, settings)`: settings may be `AQ.settings` or `{wideWindows, biteWindow}`; `biteWindow`
  overrides the species window and drops the rod bonus (tutorial 2.0 s). Extra `remaining(bs, now)`.
- `AQ.line`: `resetRope`, `pointAt(traj, t)`; `trajectory(..., opts{minX, maxX, out, n})`; `rasterize` cells also carry
  `{bold, c, r}` and are pooled. Glyphs are placed at exact rope positions one cell apart (movable type) — 8-connected.

## Scene integration
- Hooked creature stays in B's list (B draws it); C writes `c.x/c.y`, `c.pose` (inflate/ink/jet/roll),
  `c.data.faceLock`, `c.data.scramble`, and uses `creatures.mouth()` for the hook. Escape → `setHooked(c, false)`.
  `env` extras: `depth`, `isDark(x, y)`, `zone`, `lantern`, `luck`; `env.hook.engagedUid`. If `creatures.update` is an
  empty stub, a small built-in stand-in runs instead.
- Bait is consumed on landing and on escapes, with p = .5 on a late miss (§4.6/4.9); not on early strikes.
- E already toasts `fight:end` reasons (`fish.escape.*`) and `bite:miss`; C toasts only hook-too-small, end of line,
  bottles, first-time tells (`fish.tip.*`, once per session, hints on) and tinteira phases. **E:** `frenzy:start` and
  `legendary:near` have strings ready (`fish.frenzy.start`, `fish.legendary.near`) if you want to toast them.
- `AQ.fishing.script(opts)` also accepts `forceSpawn[].n / dx`. `scenes.go('fishing', {tutorial:true})` applies a
  default tutorial script (6 manjubas 11 u out at depth .3, auto-stop, 2 s window, P .35 / stam 4, run left at 4 s,
  no escape) unless one was set; cleared after the next landed catch. Frenzies and bottles are off in the tutorial.
- `AQ.fishing.debugLand(id, {choice, fast})` hooks one at the hook and fights it on autopilot (×8), then resolves
  without the card (sell; tinteira release → ending). `AQ.fishing.state` is a read-only debug view.
- Angler/boat/bottle/tentacle art from `AQ.art` when present (fallbacks inline). C draws the **rod procedurally**
  (hand → tip, bends with tension) — angler art should not include the rod.

## Balance (autopilot, recommended gear, 100 seeds)
All 42 land ≥ 93 %; medians C 12.7 s, U 19.7 s, R 24.5 s, L 53.6 s. One tier below spools deep species (isopode,
celacanto, tinteira 0 %). **tipografo** (L, shaker) lands in ~12 s — far from a legendary feel; consider P/stamina up
or boss style. arraia has gearTier 1 but hookMin 2 (tests use an adequate hook).

## Sailing — the fishing scene scrolls horizontally (owner request)
- World x is endless. `AQ.sail` (pure, `js/logic/sail.js`, `tests/test-sail.js`): `create/nudge/step/moving/speedFrac`,
  `CONST` (MAX 12 col/s, spool-up ease-in, drag + friction ease-out, NUDGE .3 s ≈ 2 cols, `anchor` drag when not allowed).
- Sailing only in `idle`. A press with the line out and nothing hooked (flying…bite, retrieve) queues the sail and
  reels in ×5 (`st.fastRetrieve`); `backToIdle` then turns the boat and nudges (or the held input takes over). Off in
  fight / landing / card, and while `AQ.tutorial.active && step < 8` (or `st.tutorial && st.scripted`): there ←/→ only
  pick the side as before. Fight steering keys latch (`st.sailLatch`) until released, so they never become sailing.
- Inputs: A/D, ←/→, d-pad, left stick (analog 0.3–0.5) held; LB/RB (and Q/E: `action:prev/next`) nudge; E's HUD
  buttons call `AQ.fishing.sailPress(dir)` / `sailRelease(dir|0)` directly (no virtual input → no input-mode flip);
  `sailShown()` drives their visibility. The cast goes where the boat faces (keyboard aim still picks the side).
- Camera: `st.cam.x` uses the same critically damped spring as y; it leads the bow (`anchorFrac`: landscape .3/.7,
  portrait .42/.58, following the aimed side while aiming) plus a speed look-ahead, and keeps the hook / fighting fish
  on screen. Cast clamps use the view the camera settles on for that side (`camTargetFor(dir)`).
- Terrain (`fishing-bg.js`): chunks of 32 columns from `rng('terrain:zone:seed:k')`, built on demand around the view
  (`BG.ensure(x0, x1)`, dropped beyond 2 chunks). `floorAt` interpolates integer samples whether or not they are in the
  sliding cache, so placement never depends on the camera. `covers()` is one array updated in place (fight + B keep
  the reference). The abyss "cliffs" became rock spires per chunk (walls at the view edges made no sense any more).
  Feature densities are per column (old counts per view width). Water texture, snow, glints, surface hashes use
  world columns; clouds have a .25 parallax. `BG.columnAt(x)` (debug/tests) returns a column's glyphs.
- Creatures: spawns come from the edge ahead while sailing (80 %), faster (×.35 interval); despawn beyond
  max(30, .5·cols) off-view. `env.bounds` = "territory": view ± 12 at rest; while sailing it stretches ahead and keeps
  the water behind (≤ despawn distance), so B's edge turns / hover clamps do not drag fish along with the camera.
- Frenzy, bottle, sightings, legendary silhouette/arrival use world x relative to the view; a frenzy is a place
  (`frenzyHere()`: within max(30, .9·cols) of the boat). Positions are remembered per zone for the session (`F._pos`).
- Wake: `~ - . ,` glyphs behind the stern (knock out the wave glyph) + a ripple / small surface impulse; reduced
  motion: few, faint, no ripple. Bob grows a little with speed.
- Engine (A's files, additive): `R.camCol()`; `worldToCell` is column-snapped; the bg grid is `D.cols + 1` wide
  (`grid.viewCols` = view) and carries the fractional column as a CSS translate; `commit()` self-blits by whole
  columns (`scrollCols`); `camMoved()` also fires on a column change. `fx.surface.follow(x0)` slides the ripple
  window; ink clouds draw on the snapped columns. Other scenes keep integer `cam.x`, so nothing changes for them.
