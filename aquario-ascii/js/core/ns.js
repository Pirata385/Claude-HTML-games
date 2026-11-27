// Água-Tinta — namespace root, version, enums, themes, charset, storage keys (owner A).
// This file (and css/style.css fallbacks) are the ONLY places allowed to hold colour literals.
(function (w) {
  'use strict';
  var AQ = w.AQ || (w.AQ = {});

  AQ.VERSION = '1.0.0';
  AQ.SAVE_VERSION = 1;
  AQ.SETTINGS_VERSION = 1;
  AQ.ASPECT = 2; // world units per grid row (1 u = 1 column width)

  AQ.STORAGE_KEYS = {
    save: 'aquario-ascii.save',
    backup: 'aquario-ascii.save.bak',
    settings: 'aquario-ascii.settings'
  };

  // Theme table: the selectable themes are AQ.ENUM.THEMES; each has a '<name>HC' high-contrast twin.
  //  · noite / dia: two colours + alpha. · papel: + the ruled-notebook page colours (rules, margin, page-turn light
  //    and shadow). · ciclo: blends dia → crepusculo → noite with the world clock (bg/ink here are only the
  //    fallback). · colorido: bg + warm-white ink + a UI accent + one colour per tint role (AQ.TINT_ROLES); its
  //    high-contrast twin brightens and saturates the same palette (AQ.theme).
  AQ.THEMES = {
    noite: { bg: '#0e0d0b', ink: '#e9dfc7' },
    noiteHC: { bg: '#050504', ink: '#f7f0de' },
    dia: { bg: '#dbe7ea', ink: '#0f3b4c' },
    diaHC: { bg: '#f1f8f9', ink: '#032231' },
    crepusculo: { bg: '#272c40', ink: '#f2e7d0' },
    crepusculoHC: { bg: '#161a29', ink: '#fff7e3' },
    ciclo: { bg: '#0e0d0b', ink: '#e9dfc7', cycle: { day: 'dia', dusk: 'crepusculo', night: 'noite' } },
    cicloHC: { bg: '#050504', ink: '#f7f0de', cycle: { day: 'diaHC', dusk: 'crepusculoHC', night: 'noiteHC' } },
    papel: { bg: '#e9dfc7', ink: '#0e0d0b', paper: { rule: '#2c64d8', margin: '#d8363a', hi: '#fffcf3', shadow: '#2b2417' } },
    papelHC: { bg: '#f7f0de', ink: '#050504', paper: { rule: '#2457c4', margin: '#c8282c', hi: '#ffffff', shadow: '#1c170e' } },
    colorido: {
      bg: '#061a24', ink: '#f3e9d6', accent: '#ffb25b',
      palette: {
        water: '#56b6ea', surface: '#7fe3f0', foam: '#d6f6fa', ray: '#b2f2e6', snow: '#c9dcf0',
        sand: '#e2b66b', rock: '#b38d6c', plant: '#5fd068', kelp: '#a3c43e', coral: '#ff7a7a', anemone: '#ff79c6',
        bubble: '#a8f0ff', star: '#fff1b0', sun: '#ffd25e', moon: '#f6eecf', cloud: '#9fb3c8', rain: '#7fa6c9',
        lantern: '#ffcf6b', wood: '#d08a4e', line: '#e4e8ea', accent: '#ffb25b', gold: '#ffd24a', glass: '#8fd0dc',
        food: '#e8b27a', vent: '#ff8a3d', glow: '#7dffb2', inkcloud: '#8a6cc8',
        orange: '#ff9a3c', blue: '#4f9dff', yellow: '#ffe14d', violet: '#b88cff', pink: '#ff8fc7', red: '#ff5a4f',
        green: '#5ee08a', teal: '#3fd6c6', silver: '#c8d6e0', brown: '#c98f5a', white: '#f5f3ec', purple: '#c06cff',
        skin: '#f2c49b', grey: '#98a4ad'
      }
    },
    coloridoHC: { bg: '#020d13', ink: '#fff8ec', accent: '#ffc070', boost: true }
  };
  // Tint roles: index 0 is the ink. Renderer calls take a role name (AQ.render.tint / opts.tint); themes without a
  // palette draw every role in the ink, so they look exactly as before.
  AQ.TINT_ROLES = ['ink', 'water', 'surface', 'foam', 'ray', 'snow', 'sand', 'rock', 'plant', 'kelp', 'coral', 'anemone',
    'bubble', 'star', 'sun', 'moon', 'cloud', 'rain', 'lantern', 'wood', 'line', 'accent', 'gold', 'glass', 'food', 'vent',
    'glow', 'inkcloud', 'orange', 'blue', 'yellow', 'violet', 'pink', 'red', 'green', 'teal', 'silver', 'brown', 'white',
    'purple', 'skin', 'grey'];

  // Printable ASCII 0x20..0x7E.
  var ascii = '';
  for (var i = 0x20; i <= 0x7e; i++) ascii += String.fromCharCode(i);
  var latin = '°·´¨¯¸×÷«»¦øº¬';
  var textExtra = 'ÁÂÃÀÇÉÊÍÓÔÕÚÜáâãàçéêíóôõúüª¿¡©§';
  AQ.CHARSET = {
    ascii: ascii,
    latin: latin,
    sprite: ascii + latin,          // sprites and textures (§2.3)
    textExtra: textExtra,           // extra letters allowed in text only
    text: ascii + latin + textExtra // everything the atlas preloads
  };

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  AQ.ENUM = deepFreeze({
    // ---- §15.4 (binding list) ----
    RARITY: ['C', 'U', 'R', 'L'],
    RARITY_W: { C: 100, U: 35, R: 8, L: 0 },
    SIZE: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    SIZE_COST: { XS: 1, S: 2, M: 4, L: 8, XL: 16, XXL: Infinity },
    SIZE_MAX: { XS: [6, 2], S: [12, 4], M: [18, 5], L: [26, 7], XL: [34, 9], XXL: [48, 14] },
    ZONES: ['baia', 'recife', 'kelp', 'mar', 'abismo'],
    PHASES: ['amanhecer', 'dia', 'entardecer', 'noite'],
    WEATHER: ['limpo', 'nublado', 'chuva', 'tempestade'],
    BAITS: ['massa', 'minhoca', 'camarao', 'lula', 'luminosa', 'colher', 'jig', 'papel', 'perola'],
    LURES: ['colher', 'jig'],
    HABITAT: ['sand', 'plants', 'rocks', 'coral', 'cave', 'open'],
    LIGHT: ['day', 'dim', 'night'],
    DIET: ['prey', 'grazer', 'filter', 'predator'],
    KIND: ['fish', 'crustacean', 'cephalopod', 'jelly', 'eel', 'ray', 'shark', 'odd'],
    BEHAVIOR: ['school', 'dart', 'cruise', 'lurk', 'drift', 'crawl', 'burrow', 'hover', 'leap', 'ambient'],
    FIGHT: ['puller', 'runner', 'diver', 'jumper', 'shaker', 'burrower', 'deadweight', 'drifter', 'inflater', 'inker', 'boss'],
    GEAR: ['rod', 'line', 'reel', 'hook', 'lantern', 'boat'],
    ESCAPE: ['snap', 'slack', 'thrown', 'tear', 'fray', 'spooled', 'loose', 'slip'],
    SIGHTINGS: ['baleia', 'golfinhos', 'tartaruga'],
    QUALITY: ['high', 'medium', 'low'],
    SCENES: ['title', 'map', 'fishing', 'aquarium', 'ending'],

    // ---- reference id lists collected from the spec (extensions; data owners remain the source of truth) ----
    SPECIES: [
      'manjuba', 'tainha', 'siri', 'camarao', 'baiacu', 'arraia', 'agulha', 'cavalo', 'ermitao', 'tipografo',
      'palhaco', 'cirurgiao', 'papagaio', 'moreia', 'lagosta', 'leao', 'polvo',
      'sargo', 'cavalinha', 'lula', 'escorpiao', 'congro', 'garoupa', 'aranha',
      'aguaviva', 'voador', 'dourado', 'atum', 'caravela', 'lua', 'manta', 'martelo', 'marlim',
      'machado', 'vibora', 'isopode', 'diabo', 'vampira', 'atolla', 'pelicano', 'celacanto', 'tinteira'
    ],
    LEGENDARIES: ['tipografo', 'marlim', 'celacanto', 'tinteira'],
    BESTIARY_TOTAL: 45,
    FIGHT_STATES: ['rest', 'pull', 'run', 'dive', 'rise', 'jump', 'shake', 'burrow', 'grip', 'drift', 'tell', 'inflate', 'roll'],
    TELLS: ['run', 'dive', 'jump', 'shake', 'burrow', 'grip', 'ink'],
    FISHING_PHASES: ['idle', 'aiming', 'flying', 'sinking', 'waiting', 'nibble', 'bite', 'fight', 'landing', 'retrieve'],
    DEFORM: ['swim', 'pulse', 'sway', 'crawl', 'jitter', 'none'],
    CHOICES: ['keep', 'sell', 'release'],
    DECOR: ['pedras', 'algas', 'coral', 'anemona', 'kelp', 'gruta', 'castelo', 'ostra', 'bau', 'naufragio', 'ruina', 'farol'],
    TANK_CAP: [12, 20, 32, 48],
    TANK_FILTER: [14, 28, 56],
    TANK_SLOTS: 5,
    MAX_TANKS: 4,
    ITEM_CATS: ['gear', 'bait', 'lure', 'tank', 'decor', 'misc'],
    ITEMS_BAIT: ['bait_minhoca', 'bait_camarao', 'bait_lula', 'bait_luminosa', 'bait_papel', 'bait_perola'],
    ITEMS_LURE: ['lure_colher', 'lure_jig'],
    ITEMS_AQUA: ['tank', 'tankcap', 'filter', 'feeder', 'cofre'],
    GOAL_TYPES: ['catch', 'keep', 'feed', 'buy', 'discover', 'collectTill', 'unlockZone', 'catchRarity', 'decorTank',
      'fishInAquarium', 'catchAt', 'tanks', 'breed', 'trophy', 'stars', 'catchIn', 'messages', 'sighting',
      'catchSpecies', 'ending', 'completion', 'dense'],
    GOALS: ['g01', 'g02', 'g03', 'g04', 'g05', 'g06', 'g07', 'g08', 'g09', 'g10', 'g11', 'g12', 'g13', 'g14',
      'g15', 'g16', 'g17', 'g18', 'g19', 'g20', 'g21', 'g22', 'g23', 'g24', 'g25', 'g26', 'g27', 'g28'],
    ACHIEVEMENTS: ['primeira_fisgada', 'linha_partida', 'paciencia', 'coracao_mole', 'comerciante', 'tinta_densa',
      'colecionador', 'enciclopedia', 'gigante', 'noite_adentro', 'tempestade_perfeita', 'mao_leve', 'tipografia',
      'ermitao', 'tres_coracoes', 'fazendeiro_do_mar', 'bilheteria_cheia', 'abissal', 'frenesi', 'fim_da_tinta'],
    MESSAGES: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'],
    NOTES: ['intro', 'firstCatch', 'aquarium', 'recife', 'kelp', 'mar', 'abismo', 'stars4', 'ending'],
    TUTORIAL: ['intro', 'cast', 'sink', 'nibble', 'strike', 'reel', 'steer', 'keep', 'free', 'goAquarium', 'card',
      'feed', 'till', 'done'],
    FACES: [':D', ':)', ':|', ':('],
    STARS: [0, 100, 600, 1500, 5000],
    FX: ['splash', 'drop', 'bubble', 'spark', 'ink', 'coin', 'flake', 'dust', 'pop', 'ripple', 'text'],
    SFX: ['cast', 'splashSmall', 'splashBig', 'reel', 'nibble', 'bite', 'hook', 'tension', 'snap', 'escape', 'catch',
      'newSpecies', 'rare', 'legendary', 'coin', 'pearl', 'feed', 'bubble', 'buy', 'goal', 'uiTap', 'uiBack',
      'uiOpen', 'error', 'splash-jump'],
    HAPTICS: ['tap', 'nibble', 'bite', 'hook', 'tell', 'snap', 'catch', 'coin'],
    ACTIONS: ['primary', 'back', 'pause', 'prev', 'next', 'bait', 'retrieve', 'feed', 'nav', 'confirm'],
    INPUT_MODES: ['mouse', 'touch', 'keyboard', 'gamepad'],
    HUD_MODES: ['none', 'hub', 'fishing', 'aquarium'],
    TOAST_KINDS: ['info', 'good', 'warn', 'rare'],
    SCREENS: ['title', 'pause', 'settings', 'saveIO', 'credits', 'shop', 'bestiary', 'goals', 'zoneCard', 'catchCard',
      'fishCard', 'decorPicker', 'tankPicker', 'baitPicker', 'offline', 'note', 'confirm'],
    THEMES: ['noite', 'dia', 'ciclo', 'colorido', 'papel'],
    LANGS: ['en'],
    ANGLER: ['idle', 'windup', 'cast', 'reel', 'cheer']
  });

  // Contract table (§15.5), used by tests/test-contracts.js and AQ.debug.checkContracts().
  // "name" = function, "name:type" = other type (object | array | string | number | boolean | any).
  // pure: true → loaded in Node by tests/loader.js; false → browser only.
  AQ.CONTRACTS = deepFreeze({
    util: { pure: true, api: 'clamp lerp invLerp smoothstep damp wrap sign easeOutCubic easeInOutSine noise1 noise2 noise3 fbm2 deepClone deepMerge now fmtClock fixedStep' },
    textart: { pure: true, api: 'MIRROR:object mirrorLine mirror pad width height silhouette densify autoMask badChars' },
    rng: { pure: true, api: 'hash create global:object' },
    events: { pure: true, api: 'on once off emit clear' },
    i18n: { pure: true, api: 'LANGS:array lang:string add t tn has keys setLang num money pearls pct date' },
    store: { pure: true, api: 'defaults load save markDirty reset migrate MIGRATIONS:object exportString importString backend:object' },
    settings: { pure: true, api: 'DEFAULTS:object get set all reset' },
    state: { pure: true, api: '' },
    sprites: { pure: true, api: 'get' },
    art: { pure: true, api: 'logo:object decor:object visitors:array map:object baitGlyph:object' },
    species: { pure: true, api: 'list:array get inZone ids' },
    sightings: { pure: true, api: 'list:array get' },
    zones: { pure: true, api: 'list:array get order:array' },
    world: { pure: true, api: 'MIN_PER_SEC:number TRANSITIONS:object phaseOf now tick advanceTo forecast light isDark' },
    spawn: { pure: true, api: 'conditionsMet weightOf table pick legendaryReady schoolSize rollSpecimen' },
    creatures: { pure: true, api: 'create update draw drawList hitTest bounds setHooked spook remove' },
    line: { pure: true, api: 'createRope stepRope rasterize glyphFor trajectory' },
    sail: { pure: true, api: 'create nudge step moving speedFrac CONST:object' },
    bite: { pure: true, api: 'window create nibble open strike expired' },
    fight: { pure: true, api: 'CONST:object STYLES:object PULL_MUL:object create step autopilot' },
    items: { pure: true, api: 'list:array get byCat GEAR:object BAITS:object DECOR:object' },
    goals: { pure: true, api: 'chain:array achievements:array messages:array' },
    economy: { pure: true, api: 'gear specimenValue fishSellValue priceOf requirementsMet canAfford incomePerMinute offlineEarnings feedCost' },
    aquarium: { pure: true, api: 'tankUsage canFit bestTankFor fishHappiness tankHappiness tankAttraction attraction stars face tick' },
    progress: { pure: true, api: 'zoneUnlocked zoneRequirements activeGoals goalProgress check completion' },
    game: { pure: true, api: 'newGame resolveCatch markSeen markSighting foundMessage bottleCoins buy equipBait consumeBait addBait sellFish releaseFish moveFish renameFish feedTank collectTill placeDecor setTankLight tick applyOffline stat wait luck addLuck resetLuck' },
    theme: { pure: false, api: 'name:string bg:string ink:string bgRgb:string inkRgb:string apply' },
    display: { pure: false, api: 'init cols:number rows:number cellW:number cellH:number cellWd:number cellHd:number dpr:number fontPx:number originX:number originY:number width:number height:number orientation:string isTouch:boolean safe:object canvases:object ctx:object metrics refresh' },
    atlas: { pure: false, api: 'build code draw count:number capacity:number' },
    render: { pure: false, api: 'ALPHA:object lv RAMPS:object ramp code grid:object cam:object worldToScreen screenToWorld worldToCell cellToScreen glyph glyphW glyphC text textW compile sprite knock knockC DEFORMERS:object' },
    fx: { pure: false, api: 'emit update draw clear count:number shake flash inkWipe motion' },
    input: { pure: false, api: 'init mode:string pointer:object on isDown axis virtual:object block unblock blocked:boolean' },
    scenes: { pure: false, api: 'register go current:any has pause resume paused:boolean' },
    perf: { pure: false, api: 'fps:number frameMs:number preset params:object setPreset' },
    loop: { pure: false, api: 'start stop running:boolean time:number' },
    ui: { pure: false, api: 'init show hide isOpen isModal toast hud:object catchCard fishCard note confirm hint clearHint hudInsets applyI18n screens:array' },
    audio: { pure: false, api: 'init unlock ready:boolean sfx setMood setAmbience setTension reel applyVolumes suspend resume' },
    haptics: { pure: false, api: 'pulse tension' },
    tutorial: { pure: false, api: 'start step:number active:boolean skip next' },
    fishing: { pure: false, api: 'phase:any script anchor debugSpawn debugLand sailPress sailRelease sailShown' }
  });
})(window);
