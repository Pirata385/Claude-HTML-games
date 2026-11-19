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
    // Bosque dos Cones
    casca: { fill: 0x8a5a3c, top: 0xb07a52, dark: 0x5a3826, hi: 0xd9a37a, out: 0x24140e, speck: 0x734a30, deco: 'musgo' },
    copa: { fill: 0x3f8f5a, top: 0x6fc27a, dark: 0x2a6342, hi: 0xa8e89a, out: 0x10261a, speck: 0x357a4c, deco: 'folha' },
    musgo: { fill: 0x6c8f6a, top: 0x9cc28e, dark: 0x4a6a4c, hi: 0xc9e8b0, out: 0x16261a, speck: 0x5c7e5a, deco: 'musgo' },
    terra: { fill: 0x5e4a3a, top: 0x7d6650, dark: 0x3e2f24, hi: 0x9c8466, out: 0x1a120c, speck: 0x6e5844, deco: 'musgo' },
    cogumelo: { fill: 0xd96aa0, top: 0xf29bc4, dark: 0x9a3f6e, hi: 0xffd2e8, out: 0x3a1028, speck: 0xffffff, deco: null },
    folha: { fill: 0x5fb05a, top: 0x8fd67a, dark: 0x3d7a3e, hi: 0xc9f0a0, out: 0x10261a, speck: 0x4f9a4c, deco: null },
    espinheiro: { fill: 0x2f5a3a, top: 0x4a7f52, dark: 0x1c3a24, hi: 0x7fb07a, out: 0x0c1a10, speck: 0xe0475b, deco: null },
    veio: { fill: 0x77708f, top: 0x9890b0, dark: 0x4f4a63, hi: 0xc4bedb, out: 0x1a1626, speck: 0xffd75e, deco: null },
    plataforma: { fill: 0xc7b693, top: 0xe8dab8, dark: 0x8f7d5c, hi: 0xfff2d4, out: 0x2a2140, speck: 0xb09e7c, deco: null },
  };

  PL.REGIONS = {
    borda: {
      nome: 'Borda do Plano',
      skyTop: 0x150f29, skyBot: 0x2f2552, grid: 0x2c2350, gridHi: 0x3b2f68,
      far: [0x2a2150, 0x352a63], mid: [0x3f3373, 0x4b3e86], fog: 0x6a5aa8,
      ghostBack: 0x6fb6ff, ghostFront: 0xffa65c,
      musica: 'borda',
      kinds: ['cubo', 'octa', 'tetra'],
    },
    bosque: {
      nome: 'Bosque dos Cones',
      skyTop: 0x07141a, skyBot: 0x153a3a, grid: 0x102a2c, gridHi: 0x1a3d3e,
      far: [0x123330, 0x1a443e], mid: [0x1d4e45, 0x276253], fog: 0xffd27a,
      ghostBack: 0x6fb6ff, ghostFront: 0xffa65c,
      musica: 'bosque',
      kinds: ['cone', 'cone', 'cil'],
      vagalumes: true,
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
