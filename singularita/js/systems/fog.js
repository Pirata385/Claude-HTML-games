// Fog of war for maps: one bit per 4×4-metre block, stored as base64 in the save.
const CELL = 4;

export class FogMap {
  constructor(w, d, bits) {
    this.w = Math.ceil(w / CELL); this.d = Math.ceil(d / CELL);
    this.bits = bits && bits.length === Math.ceil((this.w * this.d) / 8) ? bits : new Uint8Array(Math.ceil((this.w * this.d) / 8));
    this.dirty = false;
  }
  seenCell(ci, cj) {
    if (ci < 0 || cj < 0 || ci >= this.w || cj >= this.d) return false;
    const k = cj * this.w + ci;
    return (this.bits[k >> 3] & (1 << (k & 7))) !== 0;
  }
  seenAt(x, z) { return this.seenCell(Math.floor(x / CELL), Math.floor(z / CELL)); }
  reveal(x, z, r) {
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL), r0 = Math.floor((z - r) / CELL), r1 = Math.floor((z + r) / CELL);
    for (let cj = r0; cj <= r1; cj++) for (let ci = c0; ci <= c1; ci++) {
      if (ci < 0 || cj < 0 || ci >= this.w || cj >= this.d) continue;
      const cx = ci * CELL + CELL / 2, cz = cj * CELL + CELL / 2;
      if ((cx - x) ** 2 + (cz - z) ** 2 > (r + CELL) ** 2) continue;
      const k = cj * this.w + ci;
      if (!(this.bits[k >> 3] & (1 << (k & 7)))) { this.bits[k >> 3] |= 1 << (k & 7); this.dirty = true; }
    }
  }
  encode() { let s = ''; for (const b of this.bits) s += String.fromCharCode(b); return btoa(s); }
  static decode(w, d, str) {
    try {
      const bin = atob(str || '');
      const bits = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i);
      return new FogMap(w, d, bits);
    } catch { return new FogMap(w, d); }
  }
}
