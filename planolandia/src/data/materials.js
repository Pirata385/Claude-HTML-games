/* Planolândia — paletas e materiais. Cada sólido tem um material; cada região, uma paleta de céu e fundo. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});

  // fill: face cortada · top: superfície que recua na profundidade (lábio 2.5D) · dark: sombra/pintas
  // hi: realce da borda superior · out: contorno · deco: enfeite nas bordas de cima
  PL.MATS = {
    pedra: { fill: 0xd9c9b0, top: 0xf3e7cf, dark: 0xa8957a, hi: 0xfff7e6, out: 0x2a2140, speck: 0xc0aa8d, deco: 'hachura' },
    pedraEsc: { fill: 0x9c8aa6, top: 0xbcaac4, dark: 0x6f5f7d, hi: 0xd8c9de, out: 0x221a36, speck: 0x8a7895, deco: null },
    lilas: { fill: 0x9b87c9, top: 0xc4b5ea, dark: 0x6f5d9e, hi: 0xe2d8ff, out: 0x231b3d, speck: 0x8a76b8, deco: 'cristal' },
    coral: { fill: 0xe97c6b, top: 0xf7ab9a, dark: 0xb35548, hi: 0xffd2c4, out: 0x3a1a26, speck: 0xd46958, deco: null },
    teal: { fill: 0x5fb7a8, top: 0x9ae2d4, dark: 0x3c8579, hi: 0xd2fff5, out: 0x14303a, speck: 0x50a597, deco: 'seta' },
    ouro: { fill: 0xf0c25a, top: 0xffe39a, dark: 0xb88a2e, hi: 0xfff6d0, out: 0x3a2a12, speck: 0xdcae48, deco: null },
    espinho: { fill: 0xf1eff6, top: 0xffffff, dark: 0x9aa0b8, hi: 0xffffff, out: 0x2a2140, speck: 0xe0475b, deco: null },
    grade: { fill: 0x5b4f86, top: 0x7d70ad, dark: 0x3d335f, hi: 0xa79bd6, out: 0x18122b, speck: 0x4d4275, deco: null },
    fenda: { fill: 0x1a1030, top: 0x2b1b4f, dark: 0x0b0618, hi: 0xff5fa2, out: 0xff5fa2, speck: 0x3a2266, deco: null },
    plataforma: { fill: 0xc7b693, top: 0xe8dab8, dark: 0x8f7d5c, hi: 0xfff2d4, out: 0x2a2140, speck: 0xb09e7c, deco: null },
  };

  PL.REGIONS = {
    borda: {
      nome: 'Borda do Plano',
      skyTop: 0x150f29, skyBot: 0x2f2552, grid: 0x2c2350, gridHi: 0x3b2f68,
      far: [0x2a2150, 0x352a63], mid: [0x3f3373, 0x4b3e86], fog: 0x6a5aa8,
      ghostBack: 0x6fb6ff, ghostFront: 0xffa65c,
      musica: 'borda',
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
