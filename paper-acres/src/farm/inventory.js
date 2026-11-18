/* Inventory: fixed slots of {id, n, extra}. Items with extra (tool level, drawing, word) never stack. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  const ORDER = ['tool', 'drawn', 'seed', 'crop', 'forage', 'fish', 'artisan', 'food', 'material', 'placeable', 'word'];
  class Inventory {
    constructor(size) { this.size = size; this.slots = new Array(size).fill(null); }
    maxStack(id, extra) { const it = PA.Items.get(id); return extra || !it ? 1 : it.stack; }
    /** Add n of id; returns the amount that did not fit. */
    add(id, n = 1, extra) {
      if (!PA.Items.get(id)) return n;
      const max = this.maxStack(id, extra);
      if (max > 1) {
        for (const s of this.slots) {
          if (!s || s.id !== id || s.extra || s.n >= max) continue;
          const k = Math.min(n, max - s.n); s.n += k; n -= k;
          if (!n) return 0;
        }
      }
      for (let i = 0; i < this.size && n > 0; i++) {
        if (this.slots[i]) continue;
        const k = Math.min(n, max);
        this.slots[i] = { id, n: k }; if (extra) this.slots[i].extra = extra;
        n -= k;
      }
      if (n !== 0) PA.Bus && PA.Bus.emit && PA.Bus.emit('inv-full');
      PA.Bus && PA.Bus.emit && PA.Bus.emit('inv');
      return n;
    }
    count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; }
    has(id, n = 1) { return this.count(id) >= n; }
    remove(id, n = 1) {
      if (this.count(id) < n) return false;
      for (let i = this.size - 1; i >= 0 && n > 0; i--) {
        const s = this.slots[i];
        if (!s || s.id !== id) continue;
        const k = Math.min(n, s.n); s.n -= k; n -= k;
        if (!s.n) this.slots[i] = null;
      }
      PA.Bus && PA.Bus.emit && PA.Bus.emit('inv');
      return true;
    }
    takeAt(i, n = 1) {
      const s = this.slots[i]; if (!s) return null;
      const k = Math.min(n, s.n); s.n -= k;
      const out = { id: s.id, n: k, extra: s.extra };
      if (!s.n) this.slots[i] = null;
      PA.Bus && PA.Bus.emit && PA.Bus.emit('inv');
      return out;
    }
    swap(a, b) { const t = this.slots[a]; this.slots[a] = this.slots[b]; this.slots[b] = t; PA.Bus && PA.Bus.emit && PA.Bus.emit('inv'); }
    free() { return this.slots.filter((s) => !s).length; }
    sort() {
      const items = this.slots.filter(Boolean);
      const rank = (s) => { const it = PA.Items.get(s.id); return ORDER.indexOf(it ? it.cat : 'material'); };
      items.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id) || (b.n - a.n));
      this.slots = items.concat(new Array(this.size - items.length).fill(null));
      PA.Bus && PA.Bus.emit && PA.Bus.emit('inv');
    }
    grow(size) { while (this.slots.length < size) this.slots.push(null); this.size = size; }
    toJSON() { return { size: this.size, slots: this.slots.map((s) => (s ? Object.assign({}, s) : null)) }; }
    static from(j) { const inv = new Inventory(j && j.size ? j.size : 36); if (j && j.slots) inv.slots = j.slots.map((s) => (s ? Object.assign({}, s) : null)); while (inv.slots.length < inv.size) inv.slots.push(null); return inv; }
  }
  PA.Inventory = Inventory;
  if (typeof module !== 'undefined' && module.exports) module.exports = Inventory;
})(typeof window !== 'undefined' ? window : globalThis);
