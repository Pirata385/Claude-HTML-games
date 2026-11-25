// Água-Tinta — deterministic RNG (mulberry32) and FNV-1a hash (owner A). Pure.
(function (AQ) {
  'use strict';

  // FNV-1a 32-bit over the UTF-8 bytes of str.
  function hash(str) {
    var bytes = AQ.util.utf8Bytes(String(str));
    var h = 0x811c9dc5;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // murmur3 finaliser: decorrelates fork seeds.
  function fmix(h) {
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  function Rng(seed) { this.s = seed >>> 0; }

  Rng.prototype.next = function () {
    var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Integer in [0, n).
  Rng.prototype.int = function (n) { return Math.floor(this.next() * n); };
  // Integer in [a, b] (inclusive).
  Rng.prototype.irange = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  // Float in [a, b).
  Rng.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.pick = function (arr) { return arr && arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined; };
  // Weighted pick: wFn(item, index) → weight (≤ 0 ignored). Returns null when the total weight is 0.
  Rng.prototype.weighted = function (arr, wFn) {
    var total = 0, i, w;
    for (i = 0; i < arr.length; i++) { w = +wFn(arr[i], i); if (w > 0) total += w; }
    if (!(total > 0)) return null;
    var r = this.next() * total;
    for (i = 0; i < arr.length; i++) {
      w = +wFn(arr[i], i);
      if (w > 0) { r -= w; if (r < 0) return arr[i]; }
    }
    for (i = arr.length - 1; i >= 0; i--) if (+wFn(arr[i], i) > 0) return arr[i];
    return null;
  };
  // Box-Muller (no cached spare, so getState/setState fully captures the stream).
  Rng.prototype.normal = function (mu, sd) {
    var m = mu === undefined ? 0 : mu, s = sd === undefined ? 1 : sd;
    var u1 = 1 - this.next(), u2 = this.next();
    return m + s * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  // In-place Fisher-Yates; returns arr.
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  // Child stream derived from the current state and a label. Does not advance the parent:
  // the same parent state + label always gives the same child.
  Rng.prototype.fork = function (label) {
    return new Rng(fmix((this.s ^ fmix(hash(label === undefined ? '' : label) + 0x9e3779b9)) >>> 0));
  };
  Rng.prototype.getState = function () { return this.s >>> 0; };
  Rng.prototype.setState = function (s) { this.s = s >>> 0; };

  function create(seed) {
    if (typeof seed === 'string') return new Rng(hash(seed));
    return new Rng((seed === undefined || seed === null ? 0 : Number(seed)) >>> 0);
  }

  AQ.rng = {
    Rng: Rng,
    hash: hash,
    fmix: fmix,
    create: create,
    // Cosmetic only (never for gameplay or saved state).
    global: new Rng((hash('agua-tinta') ^ (AQ.util.now() >>> 0)) >>> 0)
  };
})(window.AQ);
