/* Planolândia — NPCs: falas por progresso (flags) e desenho procedural.
 * talk(G) → { pages, after? }  (after roda quando o diálogo fecha) */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const OUT = 0x2a1e3b;

  function poly(g, cx, cy, r, n, a0, fill) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const path = (ox, oy) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + ox, p[1] + oy) : g.moveTo(p[0] + ox, p[1] + oy))); g.closePath(); g.fillPath(); };
    g.fillStyle(OUT, 1); path(-1, 0); path(1, 0); path(0, -1); path(0, 1);
    g.fillStyle(fill, 1); path(0, 0);
  }

  const SEG_DICAS = [
    ['Rochas com pintas douradas são veios de Vértices. Golpeie até rachar.'],
    ['Nos Pontos Fixos, aperte [up] de novo enquanto descansa para trocar os seus Teoremas. Os Postulados limitam quantos cabem.'],
    ['Os troncos da Trilha afinam quando você se afasta do meio deles. Lá no fundo da Trilha, depois do último tronco, a página continua… para dentro.'],
    ['O Pentágono vende mapas. Mapas tortos, mas mapas.'],
    ['Os Brotocones cospem esporos. Esporos também são redondos: um passo para o lado da profundidade e eles passam por você.'],
    ['Lá em cima, nas Copas, só se chega esticando o corpo como uma linha. Você já sabe fazer isso?'],
  ];

  PL.NPCS = {
    segmento: {
      nome: 'Segmento',
      talk(G) {
        const f = G.save.flags;
        if (!f.seg_1) {
          f.seg_1 = true;
          return { pages: [
            'Ora, ora… um achatado! Fazia tempo que eu não via alguém sem espessura.',
            'Eu sou Segmento. Vivi a vida inteira em Linhalândia, indo e voltando numa reta só. Até a Ruptura me puxar para cá.',
            'Aqui chamam isto de Espaçolândia. Eles têm três direções, imagine. Você e eu só vemos a fatia onde estamos.',
            'A diferença é que você aprendeu a deslizar. Eu só consigo ficar parado e pensar. Muito.',
            'No fundo do bosque mora a Mãe-Esfera. Ela também caiu de outro lugar e perdeu o juízo. Some pela profundidade e volta do nada.',
            'Se for até ela, procure o olho no meio. É onde ela é maior… e onde mais dói.',
          ] };
        }
        if (f.boss_mae && !f.seg_presente) {
          return {
            pages: [
              'Você venceu a Mãe-Esfera! E ainda tem os quatro lados. Impressionante.',
              'Tome isto. Me ajudou a não perder a cabeça enquanto eu pensava, parado, por anos.',
            ],
            after: (g) => { f.seg_presente = true; g.collect({ item: 'teorema', teorema: 'lema_foco', id: 'teo_lema_foco', x: G.player.x, y: G.player.y }); },
          };
        }
        const i = (f.seg_i || 0) % SEG_DICAS.length;
        f.seg_i = i + 1;
        return { pages: SEG_DICAS[i] };
      },
      draw(g, e, t, look, blink) {
        const x = Math.round(e.x), y = Math.round(e.y - 4 + Math.sin(t * 1.5) * 1.5);
        g.fillStyle(OUT, 1); g.fillRect(x - 2, y - 33, 5, 34);
        g.fillStyle(0xd8d0e8, 1); g.fillRect(x - 1, y - 32, 3, 32);
        g.fillStyle(0xffffff, 1); g.fillRect(x - 1, y - 32, 1, 32);
        g.fillStyle(0xfff1a8, 1); g.fillRect(x - 2, y - 35, 5, 2); g.fillRect(x - 2, y, 5, 2);
        if (blink) { g.fillStyle(OUT, 1); g.fillRect(x - 2, y - 26, 5, 1); }
        else { g.fillStyle(OUT, 1); g.fillRect(x - 3, y - 29, 7, 6); g.fillStyle(0xffffff, 1); g.fillRect(x - 2, y - 28, 5, 4); g.fillStyle(OUT, 1); g.fillRect(x + look, y - 27, 1, 2); }
        // barba de tracinhos, balançando
        g.lineStyle(1, 0xffffff, 0.9);
        for (let i = 0; i < 4; i++) { const w = Math.sin(t * 2 + i) * 0.8; g.lineBetween(x + 2, y - 20 + i * 3, x + 5 + w, y - 18 + i * 3); }
      },
    },

    pentagono: {
      nome: 'Pentágono',
      talk(G) {
        const f = G.save.flags;
        const shop = (g) => g.hud && g.hud.openShop('pentagono');
        if (!f.pent_1) {
          f.pent_1 = true;
          return { pages: [
            'Cinco lados! Repare bem: cinco. Em Planolândia eu seria praticamente da nobreza.',
            'Aqui, sou só um cartógrafo com mapas tortos e uma mochila de quinquilharias.',
            'Mapas, Teoremas, segmentos perdidos… Pago meus mapas em Vértices, e você também. Dê uma olhada.',
          ], after: shop };
        }
        const falas = [
          'De volta! Os Vértices não se gastam sozinhos.',
          'Um bom mapa vale mais que três lados. Eu teria cinco, mas enfim.',
          'Trago tudo na mochila. Até o que não cabe nela.',
        ];
        return { pages: [falas[(f.pent_i = ((f.pent_i || 0) + 1)) % falas.length]], after: shop };
      },
      draw(g, e, t, look, blink) {
        const x = Math.round(e.x), y = Math.round(e.y - 12 + Math.sin(t * 2) * 1);
        // mochila de rolos de mapa, atrás
        const bx = x - look * 10;
        g.fillStyle(OUT, 1); g.fillRect(bx - 4, y - 9, 8, 14);
        g.fillStyle(0xe8dab8, 1); g.fillRect(bx - 3, y - 12, 2, 10); g.fillRect(bx, y - 14, 2, 12); g.fillRect(bx + 2, y - 11, 1, 9);
        g.fillStyle(0x8f5a3c, 1); g.fillRect(bx - 3, y - 4, 7, 8);
        poly(g, x, y, 11, 5, -Math.PI / 2, 0xf0a04b);
        g.fillStyle(0xffc27a, 1); g.fillRect(x - 6, y - 5, 5, 1);
        // chapéu de cartógrafo
        g.fillStyle(OUT, 1); g.fillRect(x - 9, y - 12, 18, 3); g.fillRect(x - 5, y - 17, 10, 6);
        g.fillStyle(0x5a3826, 1); g.fillRect(x - 8, y - 11, 16, 1); g.fillRect(x - 4, y - 16, 8, 4);
        g.fillStyle(0xff5fa2, 1); g.fillRect(x - 4, y - 13, 8, 1);
        // olhos
        if (blink) { g.fillStyle(OUT, 1); g.fillRect(x - 4, y - 2, 3, 1); g.fillRect(x + 1, y - 2, 3, 1); }
        else {
          g.fillStyle(0xffffff, 1); g.fillRect(x - 5, y - 4, 3, 4); g.fillRect(x + 1, y - 4, 3, 4);
          g.fillStyle(OUT, 1); g.fillRect(x - 4 + look, y - 3, 1, 2); g.fillRect(x + 2 + look, y - 3, 1, 2);
        }
        g.fillStyle(OUT, 1); g.fillRect(x - 2, y + 3, 4, 1);
        g.fillStyle(0xe97c6b, 1); g.fillRect(x - 7, y + 1, 2, 1); g.fillRect(x + 5, y + 1, 2, 1);
      },
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
