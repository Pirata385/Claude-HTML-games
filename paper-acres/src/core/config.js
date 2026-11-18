/* Paper Acres — global constants. Two colours only: paper and ink. */
(function (root) {
  'use strict';
  const PA = root.PA = root.PA || {};
  PA.C = {
    CELL_W: 12, CELL_H: 20,      // world cell size in px
    GW: 24, GH: 40,              // glyph atlas cell (2x)
    PAPER: '#efe4c8', INK: '#000000',
    PAPER_N: 0xefe4c8, INK_N: 0x000000,
    SLICE_K: 0.35, HORIZON: 0.28, ANCHOR_Y: 0.6,
    STEP_MS: 220,
    CHUNK_W: 32, CHUNK_H: 16,
    MAX_SLICES: 5,
    DROPOUT: [0, 0.12, 0.3, 0.45, 0.6, 0.72, 0.8],
    VERSION: 1,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PA.C;
})(typeof window !== 'undefined' ? window : globalThis);
