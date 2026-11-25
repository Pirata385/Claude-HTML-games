# Notes from A (engine) — phase 0

Everything in §15.5 for A exists with the documented signature. Items below are **clarifications and
backward-compatible extensions**; nothing in the contracts was removed or renamed.

## Boot order (`js/main.js`)
`settings.load()` → `store.load()` → `perf.init()` → `theme.apply()` → `display.init(#stage)` (waits for the font,
≤ 1.5 s) → `input.init` → `ui.init(#ui)` → `audio.init()` → `store.startAutosave()` → emit `app:ready` →
`scenes.go('title', null, {transition:'fade'})` → `loop.start()`. Each init is wrapped in try/catch.

## Core
- **AQ.state identity never changes.** `load()`, `reset()` and `importString()` replace its *contents* in place, so
  holding a reference is safe.
- `AQ.store.load()` on a corrupt or future save: raw string → `.bak`, fresh state, `AQ.store.loadError` =
  `'json'|'shape'|'future'|'migrate'`, and event **`save:invalid` {error}** (new). **E**: toast "Save inválido — um
  backup foi guardado." on that event or by checking `AQ.store.loadError` on `app:ready`.
- `AQ.store.existed` / `AQ.store.hasSave()` (new) tell E whether to show **Continuar**.
- `AQ.store.fresh()` (new) = `defaults()` + `meta.created/lastActive/seed` + `world.rng` seeded. `load()` with no save
  and `reset()` use it. `defaults()` returns the §15.8 literal values (all zeros in `meta`).
- `.bak` is written: on corrupt/future loads, before a migration, before `reset()` and before `importString()`.
- `save(reason)` sets `meta.lastSaved = meta.lastActive = now` and `meta.build`; returns false (never throws) when
  storage fails. Extras: `flush(reason)` (save if dirty), `backup()`, `readBackup()`, `startAutosave()/stopAutosave()`,
  `memoryBackend()`, `parseSave(raw)`, `replaceState(obj)`.
- `importString` errors: `'format' | 'checksum' | 'json' | 'shape' | 'future' | 'migrate'`.
- `migrate(obj, toVersion = AQ.SAVE_VERSION)`; unversioned objects are treated as v0 → `MIGRATIONS[1]`.
- `meta.playSec` is incremented by the loop (1 per unpaused second in map/fishing/aquarium), which also calls
  `AQ.store.markDirty()` each such second, so autosave runs every 15 s while playing.
- **Settings:** `set(key, value)` returns the stored value after validation (unchanged when invalid; no event if the
  value did not change). `theme:'papel'` is rejected unless `state.player.unlocks.paperTheme`. Extras: `load()`,
  `validate(key, v)`, `SCHEMA`, `persist()`. Persisted as `{v:1, ...}`; unknown keys dropped on load.
- **Change language with `AQ.settings.set('lang', 'en')`** (persists, then `i18n.setLang` emits `lang:changed`).
- i18n: `add(lang, dict)` accepts flat (`'a.b'`) or nested objects. `tn()` also honours an optional `key.zero`.
  **`pct(x)` takes a fraction 0..1** (`.78 → '78%'`). `num/money/pearls` are deterministic (no ICU).
  `has(key)` without lang = current language or pt-BR fallback.
- rng: `fork(label)` does **not** advance the parent (same state + label → same child). `weighted()` → `null` when the
  total weight is 0; `pick([])` → `undefined`. `normal()` keeps no cached spare (state fully captured by getState).
  `AQ.rng.Rng` (class) and `AQ.rng.fmix` exposed.
- events: listeners receive `(payload, name)`; `'*'` listens to everything; extra `count(name)`.
- util extras: `round1, round2, isPlainObject, utf8Bytes, utf8Decode, b64encode, b64decode, crc32, hex8, PI2`.
  `deepMerge` treats arrays as values (an existing array is kept as is).
- `AQ.ENUM` (deep-frozen) has the §15.4 list plus reference id lists collected from the spec: `SPECIES` (42, roster
  order), `LEGENDARIES`, `FIGHT_STATES`, `TELLS`, `FISHING_PHASES`, `DEFORM`, `CHOICES`, `DECOR`, `TANK_CAP`,
  `TANK_FILTER`, `TANK_SLOTS`, `MAX_TANKS`, `ITEM_CATS`, `ITEMS_BAIT`, `ITEMS_LURE`, `ITEMS_AQUA`, `GOAL_TYPES`,
  `GOALS`, `ACHIEVEMENTS`, `MESSAGES`, `NOTES`, `TUTORIAL`, `FACES`, `STARS`, `FX`, `SFX`, `HAPTICS`, `ACTIONS`,
  `INPUT_MODES`, `HUD_MODES`, `TOAST_KINDS`, `SCREENS`, `THEMES`, `LANGS`, `ANGLER`, `BESTIARY_TOTAL`.
  Data owners stay the source of truth for details; tell A if an id list is wrong.
- `AQ.CHARSET` also has `ascii`, `latin`, `text` (= everything the atlas preloads).
- **`AQ.CONTRACTS`** (ns.js) is the machine-readable §15.5 table used by `tests/test-contracts.js` and
  `AQ.debug.checkContracts()`. If a contract changes, update it there too.

## Engine
- **Anchors:** screen-px and grid-cell calls (`glyph`, `glyphC`, `text`, `knock`, `knockC`, `cellToScreen`) use the
  **top-left** of the cell box. World calls use the **centre**: `glyphW` (centre of the glyph), `sprite` (centre of the
  box, as specified), `textW` (vertical centre; x is the left edge / centre / right edge per `align`).
- `text(..., {align:'right'})`: the last character lands in column `c`. Same for `grid.text`.
- `worldToCell` uses the **row-snapped** camera (`floor(wy/2) − floor(cam.y/2)`), matching the bg grid, which carries
  the fractional row as a CSS translate. `grid.rows = view rows + 2`; `grid.viewRows` = visible rows.
- `worldToScreen/screenToWorld/worldToCell/cellToScreen` accept an optional `out` object (avoid allocations).
  `grid.get()` returns a shared object.
- `sprite(frame|lines, wx, wy, opts)`: `glyphMap(ch,c,r)` / `levelMap(c,r,level)` get **right-facing** frame
  coordinates (as in sprite data, e.g. glow cells); `glyphMap` may return `null` to skip a glyph. `sprite()` skips
  deform in grid motion style and when `perf.params.deform === false`, and uses bbox knockout when
  `perf.params.knock === 'bbox'`, but it does **not** multiply `amp` by `AQ.fx.motion()` — callers do (§12).
  Extra opt: `seed` (dissolve pattern). Frames: `R.Frame` class with `w,h,lines,codes,mask,spans,flipped()`.
- Atlas codes: `0` = blank, bit 9 (`512`) = bold, `≥ 1024` = overflow (fillText). `atlas.build` takes an optional 5th
  arg `{w,h}` (cell size in device px). Extra: `atlas.char(code)`.
- Render extras: `rampCode(name, v, bold)`, `setTarget('main'|'top')`, `beginFrame/beginTop/endFrame` (loop only),
  `invalidate()`, `levelOf(level)` (after the high-contrast remap), `isGridStyle()`, `camRow()`, `applyBgTransform()`.
  High contrast remaps levels at draw time; callers always pass the nominal level.
- **Scenes:** `AQ.scenes.current` is the scene **name**; `AQ.scenes.def` is its definition, `get(name)`, `params`,
  `transitioning` are extra. `go()` calls are serialized. On a scene change: `fx.clear()`, `render.cam.set(0,0)`,
  `render.invalidate()`, `enter(params || {})`, then `resize(metrics)` if defined, then `scene:changed`. All scene
  hooks are wrapped in try/catch (errors logged, max 3 per hook). `go()` also un-pauses.
- **The loop does not call `fx.draw()`** — scenes call it inside `draw()` where they want particles (§15.7 step 7).
  The loop does call `fx.update(dt)` (unpaused) and draws transitions/flash on the top layer.
- **Input:** pointer presses on the canvas are *not* `action:primary` (scenes use raw `down/up/tap/hold/drag`);
  `isDown('primary')` = keyboard Space/Enter, virtual (E's reel button) or gamepad A/RT. Enter emits
  `action:primary` and `action:confirm`; Esc emits `action:pause` and `action:back`. `action:nav` repeats with key
  repeat. While **blocked**: raw canvas events, `primary`, `bait`, `retrieve`, `feed` are suppressed and
  `isDown/axis` read idle; `back`, `pause`, `nav`, `confirm`, `prev`, `next` still fire (UI navigation). Keys are
  ignored when focus is in an input/textarea, and Space/Enter on a focused `<button>` are left to the DOM.
  `app:gesture` fires once on the first pointerdown anywhere (incl. `#ui`), keydown or gamepad press.
  Payload objects for raw pointer events are reused: copy fields you keep. Extra: `axis('aimY'|'navY')`.
- `perf.params` object identity is stable (contents change with the preset). Extras: `PRESETS`, `current`,
  `initial`, `auto`, `sample(ms)`. The FPS overlay is the `#fps` DOM element (`showFps`).
- `display` extras: `family`, `adv`, `widthD/heightD`, `originXd/originYd` (device px), `ready`. `display:resize` is
  emitted only when the size or grid changes (after the current scene's `resize`).
- `theme`: `name` is the base (`'noite'|'papel'`), `key` includes `HC`; extras `highContrast`, `temporary`,
  `bgArr/inkArr`. `apply()` with no name and a locked papel falls back to noite.
- `fx` extras: `KINDS` presets, `covered` (screen covered after an 'out' wipe), `drawTop(dtReal)` (loop only).

## CSS (`css/style.css`)
Variables on `:root`: `--bg --ink --bg-rgb --ink-rgb` (set live by AQ.theme), `--font`, `--ui-scale` (set by A from
settings), `--safe-top/right/bottom/left` (env() insets). `#ui` has `pointer-events:none`; **E must set
`pointer-events:auto` on its widgets.** `#boot` fades out and is removed after boot.

## Stubs
A created every missing file from §15.1 as a stub (header comment `STUB created by A`). Owners replace them entirely.
Neutral returns, but object-shaped where the contract returns an object (e.g. `world.now()`, `tankUsage()`), and
`ui.catchCard()` resolves `{choice:'sell'}`. The **title stub** draws a placeholder line (a literal, debug-style) and a
wave row on the bg grid as an engine smoke test — E replaces it.

## Fonts
`fonts/JetBrainsMonoNL-{Regular,Bold}.woff2` from `jetbrains-mono@1.0.6`. `fonts/LICENSE-JetBrainsMono.txt` holds the
typeface's SIL OFL 1.1 text (the npm package only ships its own MIT LICENSE for the packaging, also included).
CSS family name: `ATMono`.
