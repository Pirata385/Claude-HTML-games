// Minimal event emitter. Game logic emits events (hits, broken voxels, casts)
// that rendering, audio and UI subscribe to, so logic also runs headless.
(function (XS) {
  'use strict';

  class Emitter {
    constructor() { this._h = Object.create(null); }
    on(type, fn) {
      (this._h[type] || (this._h[type] = [])).push(fn);
      return () => this.off(type, fn);
    }
    off(type, fn) {
      const list = this._h[type];
      if (list) this._h[type] = list.filter((f) => f !== fn);
    }
    emit(type, data) {
      const list = this._h[type];
      if (!list) return;
      for (let i = 0; i < list.length; i++) list[i](data);
    }
    clear() { this._h = Object.create(null); }
  }

  XS.Emitter = Emitter;
})(globalThis.XS = globalThis.XS || {});
