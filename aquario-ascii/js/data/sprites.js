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

  def('baiacu', { fps: 4, extra: { inflate: String.raw`
 \ ' | ' /
-(    °  )=
 / , | , \
` } }, String.raw`
  .---.  │   .---.
><(  °)= │ -<(  °)=
  ‵---´  │   ‵---´
`);
})(window.AQ);
