// Small shared helpers: math, a binary min-heap for path searches and base64 for typed arrays.
(function (UB) {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);

  // Min-heap of integer items keyed by float priority. Reused between searches (clear()).
  function Heap(capacity) {
    this.items = new Int32Array(capacity || 1024);
    this.prio = new Float64Array(capacity || 1024);
    this.size = 0;
  }
  Heap.prototype.clear = function () { this.size = 0; };
  Heap.prototype.push = function (item, p) {
    if (this.size >= this.items.length) {
      const ni = new Int32Array(this.items.length * 2); ni.set(this.items); this.items = ni;
      const np = new Float64Array(this.prio.length * 2); np.set(this.prio); this.prio = np;
    }
    let i = this.size++;
    const it = this.items, pr = this.prio;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= p) break;
      it[i] = it[parent]; pr[i] = pr[parent]; i = parent;
    }
    it[i] = item; pr[i] = p;
  };
  Heap.prototype.pop = function () {
    const it = this.items, pr = this.prio;
    const top = it[0];
    const n = --this.size;
    if (n > 0) {
      const item = it[n], p = pr[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && pr[c + 1] < pr[c]) c++;
        if (pr[c] >= p) break;
        it[i] = it[c]; pr[i] = pr[c]; i = c;
      }
      it[i] = item; pr[i] = p;
    }
    return top;
  };

  // Base64 without relying on btoa/Buffer, so it works in the browser and in Node's vm.
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const B64I = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) B64I[B64.charCodeAt(i)] = i;
  function bytesToB64(bytes) {
    let out = '';
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    const rest = bytes.length - i;
    if (rest === 1) {
      const n = bytes[i] << 16;
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
    } else if (rest === 2) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
    }
    return out;
  }
  function b64ToBytes(str) {
    const clean = str.replace(/=+$/, '');
    const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
    let o = 0, buf = 0, bits = 0;
    for (let i = 0; i < clean.length; i++) {
      const v = B64I[clean.charCodeAt(i)];
      if (v < 0) continue;
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
    }
    return out.subarray(0, o);
  }
  // Typed array <-> {t: type name, d: base64} (little-endian, which every browser uses).
  function packArray(arr) {
    return { t: arr.constructor.name, d: bytesToB64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)) };
  }
  function unpackArray(obj) {
    const bytes = b64ToBytes(obj.d);
    const Ctor = { Uint8Array, Uint16Array, Int16Array, Int32Array, Float32Array }[obj.t] || Uint8Array;
    const copy = new Uint8Array(bytes.length); copy.set(bytes);
    return new Ctor(copy.buffer);
  }

  UB.U = { clamp, lerp, dist, dist2, Heap, bytesToB64, b64ToBytes, packArray, unpackArray };
})(globalThis.UB = globalThis.UB || {});
