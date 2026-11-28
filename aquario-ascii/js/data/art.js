// Água-Tinta — non-creature art (owner B). Pure data (§6.6 "Other art B owns").
// Same source format as sprites.js ('│' separates frames, '‵' = backtick). Art items are SpriteDefs
// ({frames, extra, masks, fps, deform, amp, glow, ...}) unless noted (logo blocks, angler poses, icons = lines).
// No text in the art: labels (AQUÁRIO, LOJA…) are drawn by the scenes from the string tables.
(function (AQ) {
  'use strict';

  var parse = AQ.sprites._parse;
  var rowMask = AQ.sprites._rowMask;
  var cellsOf = AQ.sprites._cellsOf;

  function def(key, opts, block) {
    var o = opts || {};
    var frames = parse(block);
    var extra = {};
    if (o.extra) for (var n in o.extra) if (Object.prototype.hasOwnProperty.call(o.extra, n)) extra[n] = parse(o.extra[n]);
    return {
      key: key, frames: frames, extra: extra,
      masks: o.maskRows ? frames.map(function (f) { return rowMask(f, o.maskRows); }) : null,
      extraMasks: null,
      fps: o.fps || 2, deform: o.deform || 'none', amp: o.amp === undefined ? 1 : o.amp,
      glow: o.glowCh ? cellsOf(frames, o.glowCh) : null, scramble: false, buried: null, lure: null
    };
  }
  function lines(block) { return parse(block)[0]; }
  // raw(block): lines exactly as written (no trimming), for poses that must share one canvas
  function raw(block) {
    var ls = String(block).replace(/\u2035/g, '`').split('\n');
    if (ls.length && ls[0].trim() === '') ls.shift();
    if (ls.length && ls[ls.length - 1].trim() === '') ls.pop();
    return ls;
  }

  // ------------------------------------------------------------------------------------------------ logo
  var wide = lines(String.raw`
    ´
   _     ___  _   _    _         _____  ___  _  _  _____    _
  /_\   / __|| | | |  /_\   ___ |_   _||_ _|| \| ||_   _|  /_\
 / _ \ | (_ || |_| | / _ \ |___|  | |   | | | .‵ |  | |   / _ \
/_/ \_\ \___| \___/ /_/ \_\       |_|  |___||_|\_|  |_|  /_/ \_\
`);
  function slice(ls, a, b) {
    var out = ls.map(function (l) { return l.slice(a, b).replace(/\s+$/, ''); });
    while (out.length && out[0].trim() === '') out.shift();
    var w = 0;
    out.forEach(function (l) { if (l.length > w) w = l.length; });
    return out.map(function (l) { while (l.length < w) l += ' '; return l; });
  }
  var logo = { wide: wide, tall: [slice(wide, 0, 27), slice(wide, 32, 64)] };

  // ------------------------------------------------------------------------------------------------ boats
  // boats[tier] (1 Canoa … 5 Traineira); `boat` = the canoe. Deck row = row 0; the angler stands on it.
  var boats = [null,
    def('boat1', { fps: 1 }, String.raw`
._____________. │  _____________.
 \___________/  │ .\___________/
`),
    def('boat2', { fps: 1 }, String.raw`
 _|___________|_ │  _|___________|_
(o)(o)(o)(o)(o)) │ ((o)(o)(o)(o)(o)
`),
    def('boat3', { fps: 2 }, String.raw`
    ._____________. │     ._____________.
 [#]\_____________/ │  [#]\_____________/
 ~~                 │  ,~
`),
    def('boat4', { fps: 1 }, String.raw`
       |\         │        |\
       | \        │        | )
       |__\       │        |__\
._____________.   │ ._____________.
 \___________/    │  \___________/
`),
    def('boat5', { fps: 1 }, String.raw`
        _|_  /     │         _|_  /
     __|[]_|/      │      __|[]_|/
._________|_______.│ ._________|_______.
 \_o___o___o_____/ │  \_o___o___o_____/
`)
  ];

  // ------------------------------------------------------------------------------------------------ angler
  // Poses are 9×4 with the figure at the same place (head at col 3, row 2); the boat deck hides the legs.
  // tip = rod-tip cell [c, r] in right-facing coordinates (where the line starts); mirror for casts to the left.
  var angler = {
    idle: raw(String.raw`
       .
      /
   o /
  /|/
`),
    windup: raw(String.raw`
.
 \
  \o
  /|
`),
    cast: raw(String.raw`


   o___.
  /|
`),
    reel: [
      raw(String.raw`
       .
     ,´
   o/
  /|
`),
      raw(String.raw`

    .-.
   o/  \
  /|
`),
      raw(String.raw`

    .-.
   o/  \
  /|    |
`)
    ],
    cheer: raw(String.raw`


  \o/
   |
`),
    tip: { idle: [7, 0], windup: [0, 0], cast: [7, 2], reel: [[7, 0], [7, 2], [8, 3]], cheer: null },
    w: 9, h: 4
  };
  // pad every pose to exactly 9×4
  (function () {
    function fix(src) {
      var out = src.slice();
      while (out.length < 4) out.push('');
      return out.map(function (l) { while (l.length < 9) l += ' '; return l.slice(0, 9); });
    }
    angler.idle = fix(angler.idle); angler.windup = fix(angler.windup); angler.cast = fix(angler.cast);
    angler.cheer = fix(angler.cheer); angler.reel = angler.reel.map(fix);
  })();

  // ------------------------------------------------------------------------------------------------ props
  var bottle = def('bottle', { fps: 2 }, String.raw`
 .---._    │  .---._ '
(~~~~__)=o │ (~~~~__)=o
 ‵---´     │  ‵---´
`);

  var birds = def('birds', { fps: 6, extra: { dive: String.raw`
\|/
 v
` } }, String.raw`
^v^ │ -v-
`);

  var lamp = def('lamp', { fps: 3, glowCh: "'|" }, String.raw`
 _|_  │  _|_
/___\ │ /___\
\ | / │  ' '
`);

  var filter = def('filter', { fps: 3 }, String.raw`
.--.  °│ .--. o
|::| o │ |::|  °
|::|°  │ |::| o
‵--´   │ ‵--´
`);

  var tentacle = def('tentacle', { fps: 2, deform: 'sway', amp: 0.6 }, String.raw`
  .--.  │   .--.
 / o  ) │  (  o \
( o .´  │   ‵. o )
 \ o \  │   / o /
  ) o ) │  ( o (
 (_.-´  │   ‵-._)
`);

  // ------------------------------------------------------------------------------------------------ tank decor (≤ 10×6)
  var decor = {
    pedras: def('pedras', { fps: 1 }, String.raw`
   _      │    _
 .´ ‵. _  │  .´ ‵. _
(  .  )( )│ (  .  )( )
`),
    algas: def('algas', { fps: 1, deform: 'sway', amp: 0.8 }, String.raw`
 )  (   │  )  (
(  ) )  │ (  ) )
 )(  (  │  )(  (
(  )) ) │ (  )) )
 )( (   │  )( (
`),
    coral: def('coral', { fps: 1, deform: 'sway', amp: 0.2 }, String.raw`
 Y  \|/  │  Y  \|/
\|/ \Y/  │ \|/ \Y/
 \Y/ |   │  \Y/ |
 _|__|_  │  _|__|_
`),
    anemona: def('anemona', { fps: 2, deform: 'sway', amp: 0.6 }, String.raw`
\ |/\| / │ | \|/ |
 \|(||)/ │ \|(||)/
  (____) │  (____)
`),
    kelp: def('kelp', { fps: 1, deform: 'sway', amp: 1 }, String.raw`
  ) (  │   ) (
 (  ) ~│  (  ) ~
~ )(   │ ~ )(
 (  )  │  (  )
  )( ~ │   )( ~
 (  )  │  (  )
`),
    gruta: def('gruta', { fps: 1 }, String.raw`
   ____    │    ____
 .´    ‵.  │  .´    ‵.
/  .--.  \ │ /  .--.  \
|_/    \_| │ |_/    \_|
`),
    castelo: def('castelo', { fps: 1 }, String.raw`
 ,_,  ,_, │  ,_,  ,_,
 |o|__|o| │  |o|__|o|
 |  __  | │  |  __  |
 |_|  |_| │  |_|  |_|
`),
    ostra: def('ostra', { fps: 0.25 }, String.raw`
         │  .----.
 .----.  │  \    /
(_.--._) │ (__@___)
`),
    bau: def('bau', { fps: 1 }, String.raw`
       . │        °
 ._____. │  ._____. o
 |_____| │  |‵‵‵‵‵|
 |__o__| │  |__o__|
`),
    naufragio: def('naufragio', { fps: 1 }, String.raw`
    |\    │     |\
    | \   │     | \
  __|__\_ │   __|__\_
  \  o  ‵\│   \  o  ‵\
   \__/\_\│    \__/\_\
`),
    ruina: def('ruina', { fps: 1 }, String.raw`
 ___     │  ___
|___|  _ │ |___|  _
 | |  |_|│  | |  |_|
 | |  | |│  | |  | |
_|_|__|_|│ _|_|__|_|
`),
    farol: def('farol', { fps: 2, glowCh: '*' }, String.raw`
 -  *  - │   \ * /
   /_\   │    /_\
   |=|   │    |=|
   |o|   │    |o|
  /___\  │   /___\
`)
  };

  // ------------------------------------------------------------------------------------------------ visitors (4 × 2 walk frames, 3 rows)
  var visitors = [
    def('visitor0', { fps: 4 }, String.raw`
 o  │  o
/|\ │ /|\
/ \ │  |
`),
    def('visitor1', { fps: 4 }, String.raw`
 o  │  o
/|\ │ /|\
/A\ │  A
`),
    def('visitor2', { fps: 4 }, String.raw`
  ° │   °
 o/ │  o|
/|\ │ / \
`),
    def('visitor3', { fps: 4 }, String.raw`
 o  │  o
/|[ │ /|[
/ \ │  |
`)
  ];

  // ------------------------------------------------------------------------------------------------ map pieces (labels drawn by the scene)
  var map = {
    aquarium: def('mapAquarium', { fps: 1 }, String.raw`
 _______ │  _______
| ><> ~ |│ | ~ <>< |
|  ._.  |│ |  ._.  |
|__| |__|│ |__| |__|
`),
    shop: def('mapShop', { fps: 1 }, String.raw`
 ______ │  ______
|  $   |│ |   $  |
|[]  []|│ |[]  []|
|__||__|│ |__||__|
`),
    lighthouse: def('mapLighthouse', { fps: 1, glowCh: '*' }, String.raw`
  *  │ -*-
 /_\ │ /_\
 |=| │ |=|
 | | │ | |
/___\│/___\
`),
    pier: def('mapPier', { fps: 1 }, String.raw`
===|===|=== │ ===|===|===
   |   |    │   ~|  ~|
`)
  };

  // ------------------------------------------------------------------------------------------------ terrain pieces for the fishing scene (C may use them)
  var terrain = {
    seagrass: [
      def('seagrass0', { deform: 'sway', amp: 0.7 }, String.raw`
 ,  │  ,
)(  │ )(
)(, │ ,)(
`),
      def('seagrass1', { deform: 'sway', amp: 0.7 }, String.raw`
 , ; │  ; ,
,;,; │ ;,;,
)(;, │ ,;)(
`)
    ],
    rock: [
      def('rock0', {}, String.raw`
 .-. │  .-.
(   )│ (   )
`),
      def('rock1', {}, String.raw`
  _.-._   │   _.-._
.´     ‵. │ .´     ‵.
(_._._._) │ (_._._._)
`)
    ],
    coralHead: [
      def('coralHead0', {}, String.raw`
 #%# │  %#%
(@&@)│ (&@&)
`),
      def('coralHead1', { deform: 'sway', amp: 0.2 }, String.raw`
Y \|/ │ Y \|/
|  Y  │ |  Y
`)
    ],
    kelp: def('kelpStalk', { deform: 'sway', amp: 1.2 }, String.raw`
 ) ( │  ) (
(  )~│ (  )~
 )(  │  )(
~(  )│ ~(  )
 )(  │  )(
(  ) │ (  )
`),
    boulder: def('boulder', {}, String.raw`
   _.---._    │    _.---._
 .´  . .  ‵.  │  .´  . .  ‵.
(  .   .   .) │ (  .   .   .)
`),
    cave: def('cave', {}, String.raw`
  .-~~~-.   │   .-~~~-.
 /       \  │  /       \
|         | │ |         |
`),
    vent: def('vent', { fps: 3 }, String.raw`
  °   │  o
 .o.  │ .°.
/   \ │/   \
`)
  };

  // ------------------------------------------------------------------------------------------------ icons (lines; shop, HUD)
  var icons = {
    rod: ['  /', ' / ', '/  '],
    line: ['-~-~-'],
    reel: ['(@)'],
    hook: [' |', '_J'],
    lantern: [' _ ', '[*]'],
    boat: ['\\_/'],
    bait: ['o~,'],
    lure: ['<>='],
    tank: ['[~~]'],
    tankcap: ['[++]'],
    filter: ['[::]'],
    feeder: ['[v]'],
    cofre: ['[$]'],
    decor: ['\\|/'],
    pearl: ['@'],
    coin: ['$']
  };

  // ------------------------------------------------------------------------------------------------ bait glyphs (§4.5)
  var baitGlyph = { massa: 'o', minhoca: '~', camarao: ',', lula: '=', luminosa: '*', colher: '<>', jig: '>=', papel: '#', perola: '@' };

  AQ.art = {
    logo: logo,
    boat: boats[1],
    boats: boats,
    angler: angler,
    bottle: bottle,
    birds: birds,
    decor: decor,
    visitors: visitors,
    map: map,
    lamp: lamp,
    filter: filter,
    tentacle: tentacle,
    oyster: decor.ostra,
    terrain: terrain,
    icons: icons,
    baitGlyph: baitGlyph,
    hook: 'J'
  };
})(window.AQ);
