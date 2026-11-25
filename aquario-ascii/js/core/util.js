// Água-Tinta — math, noise, object helpers, encoding helpers, AQ.textart (owner A). Pure.
(function (AQ) {
  'use strict';

  var PI2 = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function invLerp(a, b, v) { return a === b ? 0 : (v - a) / (b - a); }
  function smoothstep(e0, e1, x) {
    var t = clamp(invLerp(e0, e1, x), 0, 1);
    return t * t * (3 - 2 * t);
  }
  // Frame-rate independent exponential smoothing toward target.
  function damp(cur, target, lambda, dt) { return target + (cur - target) * Math.exp(-lambda * dt); }
  function wrap(v, n) { var r = v % n; return r < 0 ? r + n : r; }
  function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function easeOutCubic(t) { var u = 1 - t; return 1 - u * u * u; }
  function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  function round1(v) { return Math.round(v * 10) / 10; }
  function round2(v) { return Math.round(v * 100) / 100; }

  // ---------------------------------------------------------------- value noise (fixed seed)
  var PERM = new Uint8Array(512);
  var VALS = new Float32Array(256);
  (function initNoise() {
    var s = 0x9e3779b9 >>> 0;
    function rnd() { // mulberry32, local so util has no dependency on rng.js
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var p = [];
    for (var i = 0; i < 256; i++) { p[i] = i; VALS[i] = rnd(); }
    for (var j = 255; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var tmp = p[j]; p[j] = p[k]; p[k] = tmp; }
    for (var m = 0; m < 512; m++) PERM[m] = p[m & 255];
  })();

  function fade(t) { return t * t * (3 - 2 * t); }

  function noise1(x) {
    var xi = Math.floor(x), xf = x - xi, i0 = xi & 255;
    var a = VALS[PERM[i0]], b = VALS[PERM[i0 + 1]];
    return a + (b - a) * fade(xf);
  }
  function noise2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var X = xi & 255, Y = yi & 255;
    var a = VALS[PERM[PERM[X] + Y]], b = VALS[PERM[PERM[X + 1] + Y]];
    var c = VALS[PERM[PERM[X] + Y + 1]], d = VALS[PERM[PERM[X + 1] + Y + 1]];
    var u = fade(xf), v = fade(yf);
    var ab = a + (b - a) * u, cd = c + (d - c) * u;
    return ab + (cd - ab) * v;
  }
  function noise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var X = xi & 255, Y = yi & 255, Z = zi & 255;
    var u = fade(xf), v = fade(yf), w = fade(zf);
    var A = PERM[X] + Y, B = PERM[X + 1] + Y;
    var AA = PERM[A] + Z, AB = PERM[A + 1] + Z, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
    var x1 = lerp(VALS[PERM[AA]], VALS[PERM[BA]], u);
    var x2 = lerp(VALS[PERM[AB]], VALS[PERM[BB]], u);
    var y1 = lerp(x1, x2, v);
    var x3 = lerp(VALS[PERM[AA + 1]], VALS[PERM[BA + 1]], u);
    var x4 = lerp(VALS[PERM[AB + 1]], VALS[PERM[BB + 1]], u);
    var y2 = lerp(x3, x4, v);
    return lerp(y1, y2, w);
  }
  function fbm2(x, y, octaves) {
    var o = octaves || 3, amp = 0.5, f = 1, sum = 0, norm = 0;
    for (var i = 0; i < o; i++) {
      sum += amp * noise2(x * f + i * 17.31, y * f + i * 9.77);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }

  // ---------------------------------------------------------------- objects
  function isPlainObject(o) {
    if (o === null || typeof o !== 'object' || Array.isArray(o)) return false;
    var p = Object.getPrototypeOf(o);
    return p === null || Object.getPrototypeOf(p) === null; // plain object from any realm
  }
  function deepClone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) { var a = new Array(o.length); for (var i = 0; i < o.length; i++) a[i] = deepClone(o[i]); return a; }
    if (!isPlainObject(o)) return o;
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = deepClone(o[k]);
    return r;
  }
  // Fills keys missing in target from defaults (recursively). Never overwrites existing values.
  function deepMerge(target, defaults) {
    if (!isPlainObject(target)) return deepClone(defaults);
    for (var k in defaults) {
      if (!Object.prototype.hasOwnProperty.call(defaults, k)) continue;
      var dv = defaults[k];
      if (target[k] === undefined) target[k] = deepClone(dv);
      else if (isPlainObject(dv) && isPlainObject(target[k])) deepMerge(target[k], dv);
    }
    return target;
  }

  function now() { return Date.now(); }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtClock(minutesOfDay) {
    var m = Math.floor(wrap(minutesOfDay, 1440));
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }

  // Fixed-step accumulator: runs fn(step) while acc.t >= step, at most 8 times per call (backlog dropped).
  function fixedStep(acc, dt, step, fn) {
    acc.t += dt;
    var n = 0;
    while (acc.t >= step && n < 8) { fn(step); acc.t -= step; n++; }
    if (acc.t >= step) acc.t = acc.t % step;
    return n;
  }

  // ---------------------------------------------------------------- encodings (no TextEncoder/btoa: must run in a bare vm)
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function utf8Decode(bytes) {
    var s = '', i = 0;
    while (i < bytes.length) {
      var b = bytes[i++], c;
      if (b < 0x80) c = b;
      else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
      else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      if (c > 0xffff) { c -= 0x10000; s += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 1023)); }
      else s += String.fromCharCode(c);
    }
    return s;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64R = {};
  for (var bi = 0; bi < 64; bi++) B64R[B64.charAt(bi)] = bi;
  function b64encode(bytes) {
    var s = '', i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    var rem = bytes.length - i;
    if (rem === 1) { var a = bytes[i] << 16; s += B64[a >> 18] + B64[(a >> 12) & 63] + '=='; }
    else if (rem === 2) { var b = (bytes[i] << 16) | (bytes[i + 1] << 8); s += B64[b >> 18] + B64[(b >> 12) & 63] + B64[(b >> 6) & 63] + '='; }
    return s;
  }
  // Returns null on invalid input.
  function b64decode(str) {
    str = String(str).replace(/\s+/g, '');
    if (str.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(str)) return null;
    var out = [];
    for (var i = 0; i < str.length; i += 4) {
      var c0 = B64R[str[i]], c1 = B64R[str[i + 1]], c2 = str[i + 2] === '=' ? 0 : B64R[str[i + 2]], c3 = str[i + 3] === '=' ? 0 : B64R[str[i + 3]];
      if (c0 === undefined || c1 === undefined || c2 === undefined || c3 === undefined) return null;
      var n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
      out.push((n >> 16) & 255);
      if (str[i + 2] !== '=') out.push((n >> 8) & 255);
      if (str[i + 3] !== '=') out.push(n & 255);
    }
    return out;
  }
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytesOrString) {
    var bytes = typeof bytesOrString === 'string' ? utf8Bytes(bytesOrString) : bytesOrString;
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function hex8(n) { var h = (n >>> 0).toString(16); while (h.length < 8) h = '0' + h; return h; }

  AQ.util = {
    PI2: PI2,
    clamp: clamp, lerp: lerp, invLerp: invLerp, smoothstep: smoothstep, damp: damp,
    wrap: wrap, sign: sign, easeOutCubic: easeOutCubic, easeInOutSine: easeInOutSine,
    round1: round1, round2: round2,
    noise1: noise1, noise2: noise2, noise3: noise3, fbm2: fbm2,
    isPlainObject: isPlainObject, deepClone: deepClone, deepMerge: deepMerge,
    now: now, fmtClock: fmtClock, fixedStep: fixedStep,
    utf8Bytes: utf8Bytes, utf8Decode: utf8Decode, b64encode: b64encode, b64decode: b64decode,
    crc32: crc32, hex8: hex8
  };

  // ---------------------------------------------------------------- AQ.textart
  var MIRROR = {
    '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
    '/': '\\', '\\': '/', '`': '´', '´': '`', 'd': 'b', 'b': 'd', 'p': 'q', 'q': 'p', '«': '»', '»': '«'
  };
  var DENSIFY = { '.': ':', ',': ';', '-': '=', "'": '"', '`': '"', '~': '=', 'o': 'O' };

  function width(lines) {
    var w = 0;
    for (var i = 0; i < lines.length; i++) if (lines[i].length > w) w = lines[i].length;
    return w;
  }
  function height(lines) { return lines.length; }
  function padRight(s, w) { while (s.length < w) s += ' '; return s; }
  function pad(lines) {
    var w = width(lines), out = new Array(lines.length);
    for (var i = 0; i < lines.length; i++) out[i] = padRight(lines[i], w);
    return out;
  }
  function mapChars(s, table) {
    var r = '';
    for (var i = 0; i < s.length; i++) { var ch = s[i]; r += table[ch] !== undefined ? table[ch] : ch; }
    return r;
  }
  function mirrorLine(s) {
    var r = '';
    for (var i = s.length - 1; i >= 0; i--) { var ch = s[i]; r += MIRROR[ch] !== undefined ? MIRROR[ch] : ch; }
    return r;
  }
  function mirror(lines) {
    var p = pad(lines), out = new Array(p.length);
    for (var i = 0; i < p.length; i++) out[i] = mirrorLine(p[i]);
    return out;
  }
  function silhouette(lines, ch) {
    var c = ch === undefined ? '·' : ch, out = new Array(lines.length);
    for (var i = 0; i < lines.length; i++) out[i] = lines[i].replace(/[^ ]/g, c);
    return out;
  }
  function densify(lines) {
    var out = new Array(lines.length);
    for (var i = 0; i < lines.length; i++) out[i] = mapChars(lines[i], DENSIFY);
    return out;
  }
  // Default knockout mask: each row from its first to its last non-space character.
  function autoMask(lines) {
    var w = width(lines), out = new Array(lines.length);
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i], a = -1, b = -1;
      for (var j = 0; j < s.length; j++) if (s[j] !== ' ') { if (a < 0) a = j; b = j; }
      var m = '';
      for (var k = 0; k < w; k++) m += a >= 0 && k >= a && k <= b ? 'x' : '.';
      out[i] = m;
    }
    return out;
  }
  // Unique characters not in charset (default: sprite charset).
  function badChars(lines, charset) {
    var cs = charset || AQ.CHARSET.sprite, seen = {}, out = [];
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i];
      for (var j = 0; j < s.length; j++) {
        var ch = s[j];
        if (cs.indexOf(ch) < 0 && !seen[ch]) { seen[ch] = 1; out.push(ch); }
      }
    }
    return out;
  }

  AQ.textart = {
    MIRROR: MIRROR, DENSIFY: DENSIFY,
    mirrorLine: mirrorLine, mirror: mirror, pad: pad, width: width, height: height,
    silhouette: silhouette, densify: densify, autoMask: autoMask, badChars: badChars
  };
})(window.AQ);
