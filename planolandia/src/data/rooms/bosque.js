/* Planolândia — Região 2: Bosque dos Cones (Marco 2).
 * Troncos são cilindros em pé (afinam e somem com a profundidade), copas são cones e discos, cogumelos quicam.
 * Entrada pelo teto do Mirante do Ponto Fixo (borda_ponto1). Bordas conferidas por tests/rooms.test.js. */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const R = PL.World.defRoom;

  // cogumelo: chapéu em cone baixo (quica) sobre um talo fino; fora do centro, o chapéu fica menor e mais baixo
  function cogumelo(B, x, top, z, r, bounce) {
    B.cone('y', x, top + 11, z, r || 22, 11, -1, { mat: 'cogumelo', bounce: bounce || 480 });
    B.cyl('y', x, top + 16, z, 4, 5, { mat: 'folha' });
  }
  // tronco em pé do chão até y0, com copa em cone por cima (decoração alta)
  function tronco(B, x, z, r, y0, floorY) {
    B.cyl('y', x, (y0 + floorY) / 2, z, r, (floorY - y0) / 2, { mat: 'casca' });
  }

  // ---------- 1. Raízes (chegada por baixo) ----------
  R({
    id: 'bosque_raizes', region: 'bosque', name: 'Raízes', banner: 'onde o chão vira teto',
    pos: [1880, -720, 0], size: [480, 440, 180],
    exits: [
      { side: 'bottom', range: [150, 240], to: 'borda_ponto1' },
      { side: 'right', range: [60, 120], to: 'bosque_trilha' },
    ],
    build(B) {
      B.mat = 'terra';
      B.box(0, 420, 150, 20); B.box(240, 420, 240, 20);
      B.box(0, 0, 20, 420);
      B.box(20, 0, 440, 20, 0, 180, { mat: 'copa' });
      B.box(460, 0, 20, 60); B.box(460, 120, 20, 300);
      B.box(130, 398, 140, 6, 0, 180, { oneWay: true, mat: 'folha' });
      cogumelo(B, 330, 405, 90, 22, 500);
      B.box(370, 300, 90, 8, 0, 180, { mat: 'casca', oneWay: true });
      // raiz-elevador: baixa no fundo (z=180), alta na frente (z=0)
      B.loft([250, 298, 360, 312], 180, [250, 130, 360, 144], 0, { mat: 'teal' });
      B.box(360, 120, 120, 14, 0, 180, { mat: 'casca' });
      if (!B.flag('veio_raizes')) B.box(28, 388, 34, 32, 30, 110, { mat: 'veio', breakable: 4, deposit: 18, flag: 'veio_raizes' });
      B.ent('folha', { x: 200, y: 230, z: 90 });
      B.ent('hint', { x0: 120, x1: 300, y0: 330, text: 'Cogumelos lançam você para o alto. Segure [jump] para ir mais longe.' });
      B.ent('hint', { x0: 300, x1: 470, y0: 200, y1: 300, text: 'A raiz verde é um elevador: deslize até o fundo, suba nela e volte para a frente.' });
    },
  });

  // ---------- 2. Trilha dos Troncos ----------
  R({
    id: 'bosque_trilha', region: 'bosque', name: 'Trilha dos Troncos', banner: 'árvores que existem em umas fatias e não em outras',
    pos: [2360, -840, 0], size: [960, 280, 220],
    exits: [
      { side: 'left', range: [180, 240], to: 'bosque_raizes' },
      { side: 'right', range: [180, 240], to: 'bosque_clareira' },
      { side: 'top', range: [340, 420], to: 'bosque_copas' },
      { side: 'far', range: [700, 800], yr: [180, 240], to: 'bosque_toca' },
    ],
    build(B) {
      B.mat = 'terra';
      B.box(0, 240, 960, 40);
      B.box(0, 0, 20, 180); B.box(940, 0, 20, 180);
      B.box(20, 0, 320, 16, 0, 220, { mat: 'copa' }); B.box(420, 0, 520, 16, 0, 220, { mat: 'copa' });
      tronco(B, 250, 60, 26, 16, 240);
      tronco(B, 560, 170, 30, 16, 240);
      tronco(B, 640, 40, 24, 16, 240);
      tronco(B, 800, 120, 28, 16, 240);
      // subida para as Copas: cogumelo, galho alto do outro lado do vão (exige Investida) e folhas
      cogumelo(B, 160, 226, 110, 20, 480);
      B.box(240, 124, 110, 12, 40, 180, { mat: 'casca' });
      B.box(300, 84, 80, 6, 40, 180, { oneWay: true, mat: 'folha' });
      B.box(330, 44, 80, 6, 40, 180, { oneWay: true, mat: 'folha' });
      B.box(60, 190, 80, 6, 60, 160, { oneWay: true, mat: 'folha' });
      if (!B.flag('veio_trilha')) B.box(470, 210, 30, 30, 0, 60, { mat: 'veio', breakable: 4, deposit: 20, flag: 'veio_trilha' });
      B.ent('brotocone', { x: 470, y: 227, z: 120 });
      B.ent('brotocone', { x: 880, y: 227, z: 60 });
      B.ent('rolo', { x: 700, y: 229, z: 190 });
      B.ent('esferoide', { x: 380, y: 200, z: 130, za: 26 });
      B.ent('hint', { x0: 0, x1: 230, y0: 150, text: 'Troncos afinam quando você se afasta do meio deles: procure a fatia em que dá para passar.' });
      B.ent('hint', { x0: 100, x1: 260, y0: 60, y1: 200, need: 'dash', text: 'Do alto do cogumelo, [dash] no ar alcança o galho.' });
    },
  });

  // ---------- 3. Toca Escondida (fundo da Trilha) ----------
  R({
    id: 'bosque_toca', region: 'bosque', name: 'Toca Escondida', banner: 'atrás do último tronco',
    pos: [3000, -720, 220], size: [240, 160, 100],
    exits: [{ side: 'near', range: [40, 170], yr: [60, 120], to: 'bosque_trilha' }],
    build(B) {
      B.mat = 'terra';
      B.box(0, 120, 240, 40); B.box(0, 0, 240, 16, 0, 100, { mat: 'copa' });
      B.box(0, 16, 14, 104); B.box(226, 16, 14, 104);
      B.box(170, 104, 40, 16, 0, 100, { mat: 'musgo' });
      B.ent('pickup', { x: 190, y: 104, z: 50, item: 'teorema', teorema: 'paralelas', id: 'teo_paralelas', flag: 'teo_paralelas' });
      B.ent('sign', { x: 70, y: 120, z: 30, title: 'Entalhe na raiz', pages: ['"Duas paralelas nunca se encontram. A não ser que uma delas aprenda a deslizar."'] });
    },
  });

  // ---------- 4. Copas (opcional, exige Investida) ----------
  R({
    id: 'bosque_copas', region: 'bosque', name: 'Copas', banner: 'o teto do bosque',
    pos: [2360, -1120, 0], size: [720, 280, 180],
    exits: [{ side: 'bottom', range: [340, 420], to: 'bosque_trilha' }],
    build(B) {
      B.mat = 'copa';
      B.box(0, 270, 340, 10); B.box(420, 270, 300, 10);
      B.box(0, 0, 12, 270); B.box(712, 0, 8, 270);
      B.box(320, 250, 120, 6, 0, 180, { oneWay: true, mat: 'folha' });
      // discos de copa: largos no centro da profundidade, estreitos fora dele
      B.cyl('y', 230, 216, 90, 48, 6);
      B.cyl('y', 90, 176, 60, 44, 6);
      B.cyl('y', 520, 226, 100, 44, 6);
      B.box(670, 210, 42, 60, 60, 140, { mat: 'casca' });
      if (!B.flag('veio_copas')) B.box(40, 136, 30, 34, 40, 90, { mat: 'veio', breakable: 4, deposit: 22, flag: 'veio_copas' });
      B.ent('pickup', { x: 692, y: 210, z: 100, item: 'fragLado', id: 'frag_bosque_1', flag: 'frag_bosque_1', msg: 'No alto das copas, preso entre folhas. Mais um lado perdido.' });
      B.ent('folha', { x: 400, y: 130, z: 90 });
      B.ent('folha', { x: 600, y: 150, z: 70 });
      B.ent('hint', { x0: 540, x1: 680, need: 'dash', text: 'Pule e use [dash] no ar para cruzar o vão até o tronco.' });
    },
  });

  // ---------- 5. Clareira do Segmento ----------
  R({
    id: 'bosque_clareira', region: 'bosque', name: 'Clareira do Segmento',
    pos: [3320, -840, 0], size: [560, 280, 160],
    exits: [
      { side: 'left', range: [180, 240], to: 'bosque_trilha' },
      { side: 'right', range: [180, 240], to: 'bosque_tenda' },
    ],
    build(B) {
      B.mat = 'terra';
      B.box(0, 240, 560, 40);
      B.box(0, 0, 20, 180); B.box(540, 0, 20, 180);
      B.box(0, 0, 560, 16, 0, 160, { mat: 'copa' });
      tronco(B, 470, 130, 22, 16, 240);
      cogumelo(B, 90, 226, 40, 18, 420);
      B.ent('bench', { x: 230, y: 240, z: 80 });
      B.ent('npc', { id: 'segmento', x: 360, y: 240, z: 80 });
      B.ent('sign', { x: 150, y: 240, z: 120, title: 'Placa de casca', pages: [
        'BOSQUE DOS CONES',
        'Aqui as árvores são cones e cilindros. De lado, elas crescem e encolhem conforme você desliza. Nenhuma se mexe.',
      ] });
    },
  });

  // ---------- 6. Tenda do Pentágono ----------
  R({
    id: 'bosque_tenda', region: 'bosque', name: 'Tenda do Pentágono',
    pos: [3880, -840, 0], size: [480, 280, 160],
    exits: [
      { side: 'left', range: [180, 240], to: 'bosque_clareira' },
      { side: 'right', range: [180, 240], to: 'bosque_brejo' },
    ],
    build(B) {
      B.mat = 'terra';
      B.box(0, 240, 480, 40);
      B.box(0, 0, 20, 180); B.box(460, 0, 20, 180);
      B.box(0, 0, 480, 16, 0, 160, { mat: 'copa' });
      // a tenda: um prisma triangular atrás do mercador
      B.prism([170, 240, 260, 150, 350, 240], 110, 160, { mat: 'coral' });
      if (!B.flag('veio_tenda')) B.box(400, 206, 32, 34, 30, 90, { mat: 'veio', breakable: 4, deposit: 22, flag: 'veio_tenda' });
      B.ent('npc', { id: 'pentagono', x: 260, y: 240, z: 80 });
    },
  });

  // ---------- 7. Brejo dos Cogumelos ----------
  R({
    id: 'bosque_brejo', region: 'bosque', name: 'Brejo dos Cogumelos', banner: 'pule de chapéu em chapéu',
    pos: [4360, -900, 0], size: [960, 400, 200],
    exits: [
      { side: 'left', range: [240, 300], to: 'bosque_tenda' },
      { side: 'right', range: [140, 200], to: 'bosque_cipos' },
    ],
    build(B) {
      B.mat = 'terra';
      B.box(0, 300, 200, 100);
      B.box(200, 380, 395, 20);
      B.spikes(200, 595, 380, 0, 200, { mat: 'espinheiro' });
      B.box(255, 300, 60, 80, 0, 200, { mat: 'musgo' });
      B.box(365, 280, 60, 100, 0, 200, { mat: 'musgo' });
      B.box(475, 240, 60, 140, 0, 200, { mat: 'musgo' });
      B.box(595, 200, 365, 200);
      B.box(0, 0, 20, 240); B.box(940, 0, 20, 140);
      B.box(20, 0, 920, 14, 0, 200, { mat: 'copa' });
      cogumelo(B, 296, 289, 100, 22, 470);
      cogumelo(B, 405, 269, 88, 22, 470);
      cogumelo(B, 515, 229, 112, 22, 470);
      B.ent('folha', { x: 420, y: 150, z: 100 });
      B.ent('folha', { x: 660, y: 110, z: 60 });
      B.ent('rolo', { x: 860, y: 189, z: 100 });
      B.ent('hint', { x0: 0, x1: 220, text: 'Espinheiros embaixo. Quique de cogumelo em cogumelo, ou golpeie para baixo ([down] + [attack]) nos espinhos.' });
    },
  });

  // ---------- 8. Cipós Oblíquos ----------
  R({
    id: 'bosque_cipos', region: 'bosque', name: 'Cipós Oblíquos',
    pos: [5320, -1000, 0], size: [640, 400, 200],
    exits: [
      { side: 'left', range: [240, 300], to: 'bosque_brejo' },
      { side: 'right', range: [60, 120], to: 'bosque_antessala' },
    ],
    build(B) {
      B.mat = 'terra';
      B.box(0, 300, 170, 100);
      B.box(170, 380, 470, 20);
      B.spikes(170, 640, 380, 0, 200, { mat: 'espinheiro' });
      B.box(0, 0, 20, 240);
      B.box(620, 0, 20, 60); B.box(620, 136, 20, 244);
      B.box(20, 0, 600, 14, 0, 200, { mat: 'copa' });
      // cipó 1: rente ao chão da esquerda na frente, alto no fundo
      B.loft([170, 300, 260, 312], 0, [170, 200, 260, 212], 200, { mat: 'teal' });
      B.box(260, 196, 120, 14, 0, 200, { mat: 'casca' });
      // cipó 2: baixo no fundo, alto na frente
      B.loft([380, 196, 470, 208], 200, [380, 112, 470, 124], 0, { mat: 'teal' });
      B.box(470, 120, 170, 16, 0, 200, { mat: 'casca' });
      B.ent('brotocone', { x: 320, y: 183, z: 100 });
      B.ent('folha', { x: 450, y: 70, z: 120 });
      B.ent('hint', { x0: 20, x1: 280, y1: 310, text: 'Cipós verdes sobem conforme a profundidade. Leia a régua para saber para onde deslizar.' });
    },
  });

  // ---------- 9. Antessala do Ninho ----------
  R({
    id: 'bosque_antessala', region: 'bosque', name: 'Antessala do Ninho',
    pos: [5960, -1060, 0], size: [400, 240, 160],
    exits: [
      { side: 'left', range: [120, 180], to: 'bosque_cipos' },
      { side: 'right', range: [120, 180], to: 'bosque_ninho' },
    ],
    build(B) {
      B.mat = 'musgo';
      B.box(0, 180, 400, 60);
      B.box(0, 0, 20, 120); B.box(380, 0, 20, 120);
      B.box(0, 0, 400, 14, 0, 160, { mat: 'copa' });
      B.ent('bench', { x: 190, y: 180, z: 80 });
      B.ent('sign', { x: 310, y: 180, title: 'Arranhões numa raiz', pages: [
        'Ela vem do fundo como um ponto, cresce até tapar o céu e some de novo.',
        'Não fique no meio dela. Mas é no meio dela que está o olho.',
      ] });
    },
  });

  // ---------- 10. Ninho da Mãe-Esfera ----------
  R({
    id: 'bosque_ninho', region: 'bosque', name: 'Ninho da Mãe-Esfera',
    pos: [6360, -1180, 0], size: [640, 360, 240],
    exits: [
      { side: 'left', range: [240, 300], to: 'bosque_antessala' },
      { side: 'top', range: [420, 500], to: 'bosque_alto' },
    ],
    build(B) {
      B.mat = 'musgo';
      B.box(0, 300, 640, 60);
      B.box(0, 0, 20, 240); B.box(620, 0, 20, 300);
      B.box(0, 0, 420, 16, 0, 240, { mat: 'copa' }); B.box(500, 0, 140, 16, 0, 240, { mat: 'copa' });
      tronco(B, 120, 50, 16, 16, 300);
      tronco(B, 300, 200, 16, 16, 300);
      // poço de Garra até a abertura do teto
      B.box(420, 16, 14, 260, 0, 240, { mat: 'casca' });
      B.box(490, 16, 14, 260, 0, 240, { mat: 'casca' });
      B.ent('gate', { x: 20, y: 240, w: 12, h: 60, open: true });
      B.ent('maeEsfera', { x: 260, floorY: 300, trigger: 150, unless: 'boss_mae' });
      B.ent('disco', { x: 260, y: 300, only: 'boss_mae' });
      B.ent('hint', { x0: 410, x1: 510, y0: 200, need: 'garra', text: 'Segure em direção à parede para se agarrar e aperte [jump] para saltar de uma para a outra.' });
    },
  });

  // ---------- 11. Copa Alta (exige Garra) ----------
  R({
    id: 'bosque_alto', region: 'bosque', name: 'Copa Alta',
    pos: [6640, -1660, 0], size: [320, 480, 160],
    exits: [
      { side: 'bottom', range: [140, 220], to: 'bosque_ninho' },
      { side: 'right', range: [40, 100], to: 'cidade_portao', sealed: true },
    ],
    build(B) {
      B.mat = 'casca';
      B.box(0, 460, 140, 20); B.box(220, 460, 100, 20);
      B.box(0, 0, 20, 460);
      B.box(300, 0, 20, 40); B.box(300, 100, 20, 360);
      B.box(20, 0, 280, 20, 0, 160, { mat: 'copa' });
      B.box(120, 438, 130, 6, 0, 160, { oneWay: true, mat: 'folha' });
      B.box(230, 80, 14, 356);                       // coluna: o poço da direita tem 56 px
      B.box(20, 140, 130, 14, 0, 160, { mat: 'musgo' }); // nicho do Teorema
      B.ent('pickup', { x: 60, y: 140, z: 80, item: 'teorema', teorema: 'bissetriz', id: 'teo_bissetriz', flag: 'teo_bissetriz' });
      B.ent('fenda', { x: 312, y: 100, h: 58, title: 'Fenda para a Cidade', msg: ['Mais acima, torres de poliedros: a Cidade dos Sólidos. A passagem ainda está instável. (Marco 4)'] });
      B.ent('folha', { x: 100, y: 300, z: 80 });
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
