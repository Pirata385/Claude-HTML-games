// Água-Tinta — creature sprites (owner B). Pure data (§6.6).
//
// Source format: each block is String.raw text; frames sit side by side, separated by '│' (U+2502, never part of
// the art) followed by ONE space. '‵' (U+2035) stands for a backtick (a backtick would end the template).
// parse() strips blank rows/columns common to all frames (tight bbox), right-pads every line to the common width,
// and checks that all frames have the same height. Sprites face RIGHT; the tail is at column 0.
//
// SpriteDef = { frames:[lines[]], extra:{name: lines[][]}, masks:null|[mask lines[] per frame], fps, deform, amp,
//               glow:null|[[c,r]], scramble, buried:null|[[c,r]] (burrow: the only cells drawn while buried),
//               lure:null|[c,r] (anglerfish light) }
(function (AQ) {
  'use strict';

  var BT = /‵/g;
  var SEP = '│';

  function rtrim(s) { return s.replace(/\s+$/, ''); }

  // parse(block) → frames (array of padded line arrays, equal sizes)
  function parse(block) {
    var raw = String(block).replace(BT, '`').split('\n');
    var frames = [], i, k;
    for (i = 0; i < raw.length; i++) {
      if (raw[i].indexOf(SEP) < 0 && raw[i].trim() === '' && (frames.length === 0 || frames[0].length === 0)) continue;
      var segs = raw[i].split(SEP);
      for (k = 0; k < segs.length; k++) {
        var s = k === 0 ? segs[k] : segs[k].slice(1);
        if (!frames[k]) frames[k] = [];
        frames[k].push(rtrim(s));
      }
    }
    var h = 0;
    for (k = 0; k < frames.length; k++) h = Math.max(h, frames[k].length);
    for (k = 0; k < frames.length; k++) while (frames[k].length < h) frames[k].push('');
    // drop rows blank in every frame (top and bottom)
    function rowBlank(r) { for (var q = 0; q < frames.length; q++) if (frames[q][r].trim() !== '') return false; return true; }
    while (h > 0 && rowBlank(h - 1)) { for (k = 0; k < frames.length; k++) frames[k].pop(); h--; }
    while (h > 0 && rowBlank(0)) { for (k = 0; k < frames.length; k++) frames[k].shift(); h--; }
    // strip leading columns blank in every frame
    var lead = Infinity;
    for (k = 0; k < frames.length; k++) for (i = 0; i < h; i++) {
      var ln = frames[k][i];
      if (ln.trim() === '') continue;
      var m = ln.length - ln.replace(/^ +/, '').length;
      if (m < lead) lead = m;
    }
    if (!isFinite(lead)) lead = 0;
    var w = 0;
    for (k = 0; k < frames.length; k++) for (i = 0; i < h; i++) {
      frames[k][i] = frames[k][i].slice(lead);
      if (frames[k][i].length > w) w = frames[k][i].length;
    }
    for (k = 0; k < frames.length; k++) for (i = 0; i < h; i++) {
      var s2 = frames[k][i];
      while (s2.length < w) s2 += ' ';
      frames[k][i] = s2;
    }
    return frames;
  }

  // Cells of `chars` found in any frame (right-facing coordinates).
  function cellsOf(frames, chars) {
    var out = [], seen = {};
    for (var k = 0; k < frames.length; k++) {
      var f = frames[k];
      for (var r = 0; r < f.length; r++) for (var c = 0; c < f[r].length; c++) {
        if (chars.indexOf(f[r][c]) >= 0 && !seen[c + ',' + r]) { seen[c + ',' + r] = 1; out.push([c, r]); }
      }
    }
    return out.length ? out : null;
  }

  // Mask that knocks out only the given rows (auto row span); other rows show the water (tentacles, legs).
  function rowMask(frame, rows) {
    var auto = AQ.textart.autoMask(frame), out = [];
    for (var r = 0; r < frame.length; r++) {
      out.push(rows.indexOf(r) >= 0 ? auto[r] : auto[r].replace(/x/g, '.'));
    }
    return out;
  }

  var S = AQ.sprites = {};

  // def(key, opts, block) → SpriteDef. opts: fps, deform, amp, glowCh, glow, buriedCh, scramble, extra:{name: block},
  // maskRows:[rows knocked out] (explicit masks for every frame), lureCh.
  function def(key, opts, block) {
    var o = opts || {};
    var frames = parse(block);
    var extra = {};
    if (o.extra) for (var name in o.extra) if (Object.prototype.hasOwnProperty.call(o.extra, name)) extra[name] = parse(o.extra[name]);
    var masks = null;
    if (o.maskRows) masks = frames.map(function (f) { return rowMask(f, o.maskRows); });
    var sd = {
      key: key,
      frames: frames,
      extra: extra,
      masks: masks,
      extraMasks: null,
      fps: o.fps || 4,
      deform: o.deform || 'swim',
      amp: o.amp === undefined ? 1 : o.amp,
      glow: o.glow || (o.glowCh ? cellsOf(frames, o.glowCh) : null),
      scramble: !!o.scramble,
      buried: o.buriedCh ? cellsOf([frames[0]], o.buriedCh) : null,
      lure: null
    };
    if (o.maskRows && o.extraMaskRows !== false) {
      sd.extraMasks = {};
      for (var en in extra) sd.extraMasks[en] = extra[en].map(function (f) { return rowMask(f, o.maskRows); });
    }
    if (o.lureCh) { var lc = cellsOf([frames[0]], o.lureCh); sd.lure = lc ? lc[0] : null; }
    S[key] = sd;
    return sd;
  }

  var warned = {};
  var PLACEHOLDER = { key: '?', frames: [['?'], ['?']], extra: {}, masks: null, fps: 1, deform: 'none', amp: 1, glow: null, scramble: false, buried: null, lure: null };

  // get(key) → SpriteDef (missing → '?' placeholder + console.warn)
  Object.defineProperty(S, 'get', { enumerable: false, value: function (key) {
    var s = S[key];
    if (s && s.frames) return s;
    if (!warned[key]) { warned[key] = 1; if (typeof console !== 'undefined') console.warn('[AQ.sprites] missing sprite: ' + key); }
    return PLACEHOLDER;
  } });
  // keys() → every sprite key (species, sightings, _alevino)
  Object.defineProperty(S, 'keys', { enumerable: false, value: function () {
    return Object.keys(S).filter(function (k) { return S[k] && S[k].frames; });
  } });
  Object.defineProperty(S, '_parse', { enumerable: false, value: parse });
  Object.defineProperty(S, '_def', { enumerable: false, value: def });
  Object.defineProperty(S, '_rowMask', { enumerable: false, value: rowMask });
  Object.defineProperty(S, '_cellsOf', { enumerable: false, value: cellsOf });

  // =================================================================================================== juvenile
  def('_alevino', { fps: 6 }, String.raw`
>°) │ =°)
`);


  // =================================================================================================== BAÍA RASA
  def('manjuba', { fps: 6 }, String.raw`
><°> │ -<°>
`);

  def('tainha', { fps: 5 }, String.raw`
   ,   ,_     │    ,   ,_
\.-'‵-' ‵-.   │ |.-'‵-' ‵-.
>(  )))   °>  │ =(  )))   °>
/‵-.____.-´   │ |‵-.____.-´
`);

  def('siri', { fps: 4, deform: 'crawl', maskRows: [0, 1, 2] }, String.raw`
(\   °°   /)  │ (\   °°   /)
 \\.-""-.//   │  \\.-""-.//
  (______)    │   (______)
 /´/ /\ \‵\   │  \‵\ /\ /´/
`);

  def('camarao', { fps: 5, amp: 0.8 }, String.raw`
 _.-~~ │  _.~-~
>(((°' │ }(((°,
`);

  def('baiacu', { fps: 4, extra: { inflate: String.raw`
 \ ' | ' /
-(    °  )=
 / , | , \
` } }, String.raw`
  .---.  │   .---.
><(  °)= │ -<(  °)=
  ‵---´  │   ‵---´
`);

  def('arraia', { fps: 3, amp: 0.7 }, String.raw`
        _.-°°._   │         _.-°°._
~~--.._´       ‵. │ -~~-.._´       ‵.
       ‵-.___.-´  │        ‵-.,_,.-´
`);

  def('agulha', { fps: 6 }, String.raw`
\,_____.     │ -,_____.
/‵-----‵°=-- │ -‵-----‵°=--
`);

  def('cavalo', { fps: 3, deform: 'sway', amp: 0.4 }, String.raw`
 _(°= │  _(°=
{_)@  │ (_)9
`);

  def('ermitao', { fps: 4, deform: 'crawl', extra: { hide: String.raw`
.----._
( /// ‵=o
‵----´
` } }, String.raw`
.----._      │ .----._
( /// ‵=(°°> │ ( /// ‵=(°°)
‵----´  /\   │ ‵----´  \/
`);

  def('tipografo', { fps: 3, scramble: true }, String.raw`
     _.-~~-._      │      _.-~~-._
\\ .´T I N T A‵.   │ || .´T I N T A‵.
 >{ a o v i m  °>  │  ={ a o v i m  °>
// ‵.W A V U M.´   │ || ‵.W A V U M.´
     ‵-..,..-´     │      ‵-..,..-´
`);

  // =================================================================================================== RECIFE
  def('palhaco', { fps: 5 }, String.raw`
  _,_   │   _,_
>|)|°)  │ =|)|°)
`);

  def('cirurgiao', { fps: 5 }, String.raw`
  _.-""-._    │   _.-""-._
\/ ((((   ‵.  │ |  ((((   ‵.
 }+      ° >  │  =+      ° >
/\‵-.___.-´   │ | ‵-.___.-´
`);

  def('papagaio', { fps: 4 }, String.raw`
     _.-''''-._     │      _.-''''-._
\  .´ (((((    ‵.   │ |  .´ (((((    ‵.
 >(  ((((((  o  =]  │  =(  ((((((  o  =]
/  ‵. (((((   _.´   │ |  ‵. (((((   _.´
     ‵-.....-´      │      ‵-.....-´
`);

  def('moreia', { fps: 2, amp: 1.4 }, String.raw`
   .-~-.   _.-.   │    .-~-.   _.-.
~./     ‵-´ ° ‵\  │ -./     ‵-´ ° ‵.
            ‵vv/  │             ‵--´
`);

  def('lagosta', { fps: 4, deform: 'crawl' }, String.raw`
   __,^^^^.  ,~~~  │    __,^^^^.  ,~~~
}((((((    °°=´    │ {((((((    °°=´
  ‵‵‵‵‵/|/|\‵~~~~  │   ‵‵‵‵‵|\|/|‵~~~~
`);

  def('leao', { fps: 4, amp: 0.7 }, String.raw`
  \\|||//   │   |\\|//|
>=(|)|)|)°> │ -=(|)|)|)°>
  //|||\\   │   |//|\\|
`);

  def('polvo', { fps: 3, deform: 'sway', amp: 0.5, extra: { ink: String.raw`
 ~~-====-._.---.
~~~-=====-(   ° )
 ~~-====-´‵---´
` } }, String.raw`
    .-"""-.     │     .-"""-.
   (     ° )    │    (     ° )
    \ ,  , /    │     \ ,  , /
  /)/)/  \(\(\  │   (\(\(  )/)/)
 ( ( (    ) ) ) │   ) ) )  ( ( (
`);

  // =================================================================================================== KELP
  def('sargo', { fps: 5 }, String.raw`
  _.-""-._   │   _.-""-._
\/ | | |  ‵. │ |  | | |  ‵.
 > | | | °m) │ =  | | | °m)
/\‵._|_|_.-´ │ | ‵._|_|_.-´
`);

  def('cavalinha', { fps: 6 }, String.raw`
  _.-~~~-._   │   _.-~~~-._
>:>/\/\/\ °>  │ -:>/\/\/\ °>
  ‵-.___.-´   │   ‵-.___.-´
`);

  def('lula', { fps: 4, amp: 1.2, extra: { jet: String.raw`
     .____.-´|
~~~=(°     ‵>
     ‵‵‵-.,_|
` } }, String.raw`
 ~~-.__..-´| │  ~-~.__..-´|
~~=(°     ‵> │ ~-=(°     ‵>
 ~~-´‵‵‵-.,| │  -~~´‵‵‵-.,|
`);

  def('escorpiao', { fps: 3, amp: 0.6 }, String.raw`
  .^v^v^v.    │   .^v^v^v.
\(;:%;:;:‵.   │ |(;:%;:;:‵.
 >:;%;: °  )  │  =:;%;: °  )
/‵"v"v"v"-´   │ |‵"v"v"v"-´
`);

  def('congro', { fps: 2, amp: 1.4 }, String.raw`
 .-~-.    _.-~-.   │  .-~-.    _.-~-.
´     ‵--´      °> │ -     ‵--´      °>
`);

  def('garoupa', { fps: 3 }, String.raw`
         _.-"""""-._        │          _.-"""""-._
\\    .-´ ·  ·  ·  ‵-.      │  \    .-´ ·  ·  ·  ‵-.
 \\ .´  ·  ·  ·  ·   ‵.     │   \ .´  ·  ·  ·  ·   ‵.
  >(  ·  ·  ·  ·   @  ‵=)   │   >(  ·  ·  ·  ·   @  ‵=)
 // ‵. ·  ·  ·  ·  __.-´    │   / ‵. ·  ·  ·  ·  __.-´
//    ‵-._ ·  · _.-´        │  /    ‵-._ ·  · _.-´
          ‵"""""´           │           ‵"""""´
`);

  def('aranha', { fps: 3, deform: 'crawl', maskRows: [1, 2] }, String.raw`
  /\    __    /\   │    /\   __   /\
 /  \  (°°)  /  \  │   /  \ (°°) /  \
/   /\(____)/\   \ │  /   /(____)\   \
   /  /    \  \    │ /   //      \\   \
`);

  // =================================================================================================== MAR ABERTO
  def('aguaviva', { fps: 2, deform: 'pulse', glowCh: "'", maskRows: [0, 1] }, String.raw`
 .-~~-.  │   .--.
(  ''  ) │  ( '' )
 ;:;;:;  │  :;:;;:
 ' ', '  │   ' ,'
`);

  def('voador', { fps: 6 }, String.raw`
    _.-´´´  │
\ .´_.-´    │ \
 >(==---°>  │  >(==---°>
/           │ / ‵-.___
`);

  def('dourado', { fps: 4 }, String.raw`
       _.,,,,,,,,,,,,,_     │        _.,,,,,,,,,,,,,_
\\   .´ ·  ·  ·  ·  · ‵-.   │  |   .´ ·  ·  ·  ·  · ‵-.
 \\.´  ·  ·  ·  ·  ·     |  │  |\.´  ·  ·  ·  ·  ·     |
  >=  ·  ·  ·  ·  ·   @  |  │   ==  ·  ·  ·  ·  ·   @  |
 //‵.  ·  ·  ·  ·  ·   _/   │  |/‵.  ·  ·  ·  ·  ·   _/
//   ‵-.____________.-‵=    │  |   ‵-.____________.-‵=
`);

  def('atum', { fps: 5 }, String.raw`
        __/\__        │         __/\__
 \\  _.-'      '-._   │  ||  _.-'      '-._
  >=(    )))    ° >   │   ==(    )))    ° >
 //  '-.__    __.-'   │  ||  '-.__    __.-'
        \/  \/        │         \/  \/
`);

  def('caravela', { fps: 2, deform: 'sway', amp: 0.6, maskRows: [0, 1, 2] }, String.raw`
  ,/\/\/\.    │   ,/\/\/\.
.´       ‵-.  │ .´       ‵-.
‵-.;:;:;.-´´  │ ‵-.:;:;:.-´´
  ¦ ' ¦ ' ¦   │   ' ¦ ' ¦ '
`);

  def('lua', { fps: 2, amp: 0.4 }, String.raw`
       /|             │        |\
   _.-´ |‵‵--.._      │    _.-´ \‵‵--.._
 {´              ‵.   │  {´              ‵.
 {         °      o)  │  {         °      o)
 {.              .´   │  {.              .´
   ‵-.. |..--‵‵´      │    ‵-.. /..--‵‵´
       \|             │        |/
`);

  def('manta', { fps: 2, amp: 0.4 }, String.raw`
               .                │
             .´ ‵.              │
           .´     ‵.            │          ._
         .´         ‵-.__       │       .-´  ‵‵‵‵---..__.
~~~~----<   (((    °     ‵>=    │ ~~~~----<   (((    °     ‵>=
         ‵.         __.-´       │       ‵-._   ____..--´´
           ‵.     .´            │           ‵‵´
             ‵. .´              │
               ‵                │
`);

  def('martelo', { fps: 4 }, String.raw`
            ,               │             ,
\         _/|               │ |         _/|
 \    _.-´  ‵‵‵---..__   °  │  |    _.-´  ‵‵‵---..__   °
  >==´  )))           ‵‵|   │   ===´  )))           ‵‵|
 /  ‵-.__    ____..--‵‵‵|   │  |  ‵-.__    ____..--‵‵‵|
/        ‵\.´ /´         °  │ |        ‵\.´ /´         °
`);

  def('marlim', { fps: 4 }, String.raw`
         ,                         │          ,
        /|‵-._                     │         /|‵-._
\\    _/ |    ‵-._                 │  |    _/ |    ‵-._
 \\.-´   |)))     ‵-._             │  |\.-´   |)))     ‵-._
  >=               @  ‵=========-  │   ==               @  ‵=========-
 //‵-._          __.-´             │  |/‵-._          __.-´
//     ‵-.____.-´                  │  |     ‵-.____.-´
           \/                      │            \/
`);

  // =================================================================================================== ABISMO
  def('machado', { fps: 6, glowCh: ':' }, String.raw`
 ,--@. │  ,--@.
>\:::) │ -\:::)
`);

  def('vibora', { fps: 4, glowCh: '·' }, String.raw`
  ,___      │   ,___
\.´· ‵-.°\  │ |.´· ‵-.°\
/‵·_·_.´\/\/│ |‵·_·_.´\/\/
`);

  def('isopode', { fps: 4, deform: 'crawl', extra: { roll: String.raw`
 .-""-.
( (()) )
 ‵-..-´
` } }, String.raw`
   _.------._    │    _.------._
 .´| | | | | ‵., │  .´| | | | | ‵.,
(__|_|_|_|_|__°)=│ (__|_|_|_|_|__°)~
  ´ ´ ´ ´ ´ ´    │   ‵ ‵ ‵ ‵ ‵ ‵
`);

  def('diabo', { fps: 3, glowCh: '*', lureCh: '*' }, String.raw`
       .-.    │        .-.
  _.--´   *   │   _.--´    *
>(   @  \     │ =(   @  \
  ‵-.vvv´     │   ‵-.vvv´
`);

  def('vampira', { fps: 2, deform: 'swim', amp: 0.5, glowCh: '·' }, String.raw`
     ,.  ,   │      ,.  ,
 _.-‵´ ‵´ ‵. │  _.-‵´ ‵´ ‵.
<·::·:  @  ) │ =·::·:  @  )
 ‵-.-.-.__.´ │  ‵-.-.-.__.´
`);

  def('atolla', { fps: 2, deform: 'pulse', glowCh: '·:', maskRows: [0, 1, 2] }, String.raw`
    _.-~~~~~-._    │      _.-~~~-._
  .´ ·:·:·:·: ‵.   │    .´·:·:·:·:‵.
  (_.;_;_;_;_._)   │    (_;_;_;_;_)
   ' ¦ ' ¦ ' ¦ '   │     ¦ ' ¦ ' ¦
        ‵.         │          )
`);

  def('pelicano', { fps: 2, amp: 1.5, glowCh: '*' }, String.raw`
                   _.-.     │                    _.-.
               _.-´ @  ‵.   │                _.-´ @  ‵.
*~~~~-----...-´  ____   \   │ *-~~~~----...-´  ____   \
              ‵-´    ‵-. |  │               ‵-´    ‵-. |
                 ‵-.___‵´   │                  ‵-.___‵´
`);

  def('celacanto', { fps: 2, amp: 0.7 }, String.raw`
           _.-"""-._          │            _.-"""-._
\\     _.-´ ·  ·  · ‵-._      │  |     _.-´ ·  ·  · ‵-._
 \\ .-´ ·  ((((  ·  ·   ‵.    │  |\ .-´ ·  ((((  ·  ·   ‵.
 =>( ·   (((((  ·   @   =>    │  =>( ·   (((((  ·   @   =>
 // ‵-. ·  ((((  ·    _.-´    │  |/ ‵-. ·  ((((  ·    _.-´
//     ‵-.(),___(),.-´        │  |     ‵-.(),___(),.-´
          ´´    ´´            │           ‵‵    ‵‵
`);

  def('tinteira', { fps: 2, amp: 1.3 }, String.raw`
                                    _.--._      │                                     _.--._
        ~-._                   _.-´´      ‵.    │         _.-~                   _.-´´      ‵.
   ~-._     ‵-._      __..--´´´             |>  │    _.-~     _.-´      __..--´´´             |>
       ‵-._     ‵‵‵--´                      |   │        ~-._´‵‵‵‵‵‵--´                      |
 ~~--..__  ‵‵‵=<(((   @@         ·  ·  ·     >  │  ~~--..__  ‵‵‵=<(((   @@         ·  ·  ·     >
         ‵‵--..__.-´´                       |   │          ‵‵--..__.-´´                       |
      _.-´´  _.-´  ‵‵--..__                _|>  │       _.-´´ ‵-._   ‵‵--..__                _|>
 ~~-´    _.-´              ‵‵‵--..__   _.-´     │  ~-.-´        ‵-.._        ‵‵‵--..__   _.-´
       ~´                           ‵‵‵         │                    ‵~                  ‵‵‵
`);

  // =================================================================================================== SIGHTINGS
  def('baleia', { fps: 1, amp: 0.5 }, String.raw`
                               ___               │                                ___
\\                   __...---´´´  ‵‵--..__       │                     __...---´´´  ‵‵--..__
 \\__           _.-´´                     ‵-._   │ ==‵‵‵-..__     _.-´´                     ‵-._
  ==‵‵‵--..__.-´       ·   ·         °        ‵. │ //       ‵-._.-´       ·   ·         °        ‵.
 //          ‵-.__   ================     _.-´   │//           ‵-.__   ================     _.-´
//                ‵‵-..\\________..--´´´´        │                  ‵‵-..\\________..--´´´´
                        \\\\                     │                        \\\\
`);

  def('golfinhos', { fps: 3 }, String.raw`
         /|          │          /|
   __.--´ ‵‵-.._     │    __.--´ ‵‵-.._
>-´           °‵=-   │ =´           °‵=-
  ‵‵-.______.--´     │  ‵‵-.______.--´
`);

  def('tartaruga', { fps: 2 }, String.raw`
    _.---._      │     _.---._
  .´/\_/\_‵.  _  │   .´/\_/\_‵.  _
 (__\/_\/__)-(°> │  (__\/_\/__)-(°>
    \\   //      │     //   \\
`);

  // burrowed arraia: only the eyes and the tail show
  (function () {
    var f = S.arraia.frames[0], cells = [];
    for (var r = 0; r < f.length; r++) for (var c = 0; c < f[r].length; c++) {
      if (f[r][c] === '°' || (r === 1 && c < 6 && f[r][c] !== ' ')) cells.push([c, r]);
    }
    S.arraia.buried = cells;
  })();
})(window.AQ);
