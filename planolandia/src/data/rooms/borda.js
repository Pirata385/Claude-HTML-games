/* Planolândia — Região 1: Borda do Plano (Marco 1).
 * Coordenadas locais: x → direita, y → baixo, z → para dentro da tela. pos = canto da sala no mundo.
 * Bordas e aberturas são conferidas por tests/rooms.test.js (World.validate). */
(function (root) {
  'use strict';
  const PL = root.PL || (root.PL = {});
  const R = PL.World.defRoom;

  // ---------- 1. Chegada ----------
  R({
    id: 'borda_chegada', region: 'borda', name: 'Chegada',
    pos: [0, 0, 0], size: [960, 400, 160],
    spawn: { x: 96, y: 330, z: 80 },
    exits: [{ side: 'right', range: [250, 340], to: 'borda_degraus' }],
    build(B) {
      B.box(0, 340, 960, 60);                       // chão
      B.box(0, 0, 24, 340);                         // parede da Ruptura
      B.box(228, 318, 56, 22);                      // primeiro degrau
      B.box(330, 300, 60, 40, 0, 160, { mat: 'lilas' });
      B.prism([390, 300, 430, 340, 390, 340], 0, 160, { mat: 'lilas' });
      // a esfera que bloqueia o caminho: só se passa por ela deslizando na profundidade
      B.sphere(600, 266, 30, 106, { mat: 'coral' });
      // pirâmide de demonstração: triângulo no centro, trapézio fora dele
      B.pyramid(830, 340, 80, 90, 120, 34, { mat: 'lilas' });
      B.box(930, 0, 30, 250);                       // moldura da saída
      B.ent('fenda', { x: 54, y: 340, h: 90, interact: true, title: 'A Ruptura', msg: [
        'Uma rachadura no próprio espaço. Foi por aqui que você caiu, arrancado de Planolândia.',
        'Do outro lado, um zumbido familiar: o mundo chato, sem altura nem profundidade, onde tudo é linha.',
        'A fenda está fechada para você. Algo que gira os planos poderia abri-la… um dia.',
      ] });
      B.ent('hint', { x0: 60, x1: 330, text: '[left] [right] andar · [jump] pular (segure para ir mais alto)' });
      B.ent('sign', { x: 470, y: 340, title: 'Placa torta', pages: [
        '"PARA CIMA, NÃO PARA O NORTE."',
        'Alguém riscou embaixo, com letra tremida: "a esfera não sai do lugar. Quem muda é você."',
      ] });
      B.ent('hint', { x0: 480, x1: 720, text: '[zf] frente · [zb] trás — deslize na profundidade: o mundo não muda, a sua fatia muda' });
      B.ent('hint', { x0: 760, x1: 940, text: 'A régua à esquerda mostra a sua profundidade dentro da sala' });
    },
  });

  // ---------- 2. Degraus Oblíquos (elevadores de profundidade) ----------
  R({
    id: 'borda_degraus', region: 'borda', name: 'Degraus Oblíquos', banner: 'plataformas que sobem quando você desliza',
    pos: [960, -240, 0], size: [640, 640, 160],
    exits: [
      { side: 'left', range: [490, 580], to: 'borda_chegada' },
      { side: 'right', range: [176, 240], to: 'borda_ponto1' },
    ],
    build(B) {
      B.box(0, 580, 640, 60);
      B.box(0, 0, 640, 20);
      B.box(0, 20, 20, 470);
      B.box(620, 20, 20, 156);
      B.box(620, 262, 20, 318);
      // elevador 1: rente ao chão em z=0, sobe até 440 em z=160
      B.loft([120, 578, 240, 592], 0, [120, 440, 240, 454], 160, { mat: 'teal' });
      // plataforma de pedra que só existe no fundo da sala
      B.box(272, 420, 128, 18, 104, 160);
      // elevador 2: alto na frente (z=0), baixo no fundo
      B.loft([440, 420, 560, 434], 160, [440, 262, 560, 276], 0, { mat: 'teal' });
      B.box(560, 240, 80, 22);                       // patamar da saída
      B.box(20, 520, 40, 60, 0, 160, { mat: 'lilas' });
      B.ent('rabisco', { x: 380, y: 570, z: 80 });
      B.ent('hint', { x0: 20, x1: 300, y0: 480, text: 'Plataformas verdes sobem e descem enquanto você desliza ([zf] [zb]). Suba nelas onde estão rentes ao chão.' });
      B.ent('hint', { x0: 300, x1: 620, y0: 500, text: '[attack] golpe de Aresta · segure [up] ou [down] (no ar) para mirar' });
    },
  });

  // ---------- 3. Primeiro Ponto Fixo (e a subida para o Bosque dos Cones) ----------
  R({
    id: 'borda_ponto1', region: 'borda', name: 'Mirante do Ponto Fixo',
    pos: [1600, -280, 0], size: [560, 340, 160],
    exits: [
      { side: 'left', range: [216, 280], to: 'borda_degraus' },
      { side: 'right', range: [216, 280], to: 'borda_campo' },
      { side: 'top', range: [430, 520], to: 'bosque_raizes' },
    ],
    build(B) {
      B.box(0, 280, 560, 60);
      B.box(0, 0, 430, 24); B.box(520, 0, 40, 24);
      B.box(0, 24, 20, 192);
      B.box(540, 24, 20, 192);
      B.cyl('z', 120, 252, 80, 16, 60, { mat: 'pedraEsc' });
      // elevador de profundidade até a abertura do teto: rente ao chão na frente, alto no fundo
      B.loft([430, 278, 520, 292], 0, [430, 40, 520, 54], 160, { mat: 'teal' });
      B.ent('bench', { x: 280, y: 280, z: 80 });
      B.ent('sign', { x: 190, y: 280, title: 'Inscrição gasta', pages: [
        'PONTO FIXO: um lugar que nenhuma transformação consegue mover.',
        'Descanse aqui ([up]) para salvar, recuperar os Lados e voltar a este ponto se o seu contorno se desfizer.',
      ] });
      B.ent('hint', { x0: 380, x1: 540, text: 'O elevador verde sobe até a abertura do teto: pise nele bem na frente ([zb]) e deslize para o fundo ([zf]).' });
    },
  });

  // ---------- 4. Campo das Formas ----------
  R({
    id: 'borda_campo', region: 'borda', name: 'Campo das Formas',
    pos: [2160, -400, 0], size: [960, 460, 200],
    exits: [
      { side: 'left', range: [336, 400], to: 'borda_ponto1' },
      { side: 'right', range: [336, 400], to: 'borda_fenda' },
      { side: 'far', range: [850, 950], yr: [330, 400], to: 'borda_segredo' },
    ],
    build(B) {
      B.box(0, 400, 960, 60);
      B.prism([300, 400, 360, 360, 460, 360, 520, 400], 0, 200);
      B.cyl('z', 640, 382, 100, 22, 70, { mat: 'pedraEsc' });
      B.box(760, 300, 30, 100, 0, 110, { mat: 'lilas' });
      B.cuboid(180, 384, 60, 30, 32, 30, { yaw: 0.6 }, { mat: 'pedraEsc' });
      B.cuboid(180, 384, 150, 30, 32, 30, { yaw: 1.1 }, { mat: 'pedraEsc' });
      B.box(840, 330, 120, 8, 150, 200, { oneWay: true, mat: 'plataforma' });
      B.box(950, 220, 10, 110);
      B.ent('esferoide', { x: 420, y: 340, z: 100 });
      B.ent('esferoide', { x: 690, y: 330, z: 70, za: 28 });
      B.ent('esferoide', { x: 880, y: 370, z: 150, za: 30 });
      B.ent('rabisco', { x: 250, y: 390, z: 80 });
      B.ent('rabisco', { x: 590, y: 390, z: 140 });
      B.ent('hint', { x0: 0, x1: 240, text: 'Inimigos 3D só ferem (e só podem ser feridos) quando cortam o seu plano' });
      B.ent('hint', { x0: 840, x1: 960, text: 'A marca no fim da régua indica uma passagem pela profundidade' });
    },
  });

  // ---------- 5. Sala secreta (atrás do Campo, pela profundidade) ----------
  R({
    id: 'borda_segredo', region: 'borda', name: 'Dobra Escondida', banner: 'uma sala que só existe mais para dentro',
    pos: [2960, -200, 200], size: [240, 220, 120],
    exits: [{ side: 'near', range: [40, 160], yr: [130, 200], to: 'borda_campo' }],
    build(B) {
      B.box(0, 200, 240, 20);
      B.box(0, 0, 240, 22);
      B.box(0, 22, 14, 178);
      B.box(226, 22, 14, 178);
      B.box(150, 172, 50, 28, 0, 120, { mat: 'ouro' });
      B.ent('pickup', { x: 175, y: 172, z: 60, item: 'fragLado', id: 'frag_borda_1', flag: 'frag_borda_1', msg: 'Escondido numa dobra do espaço. Junte quatro para ganhar um Lado.' });
      B.ent('sign', { x: 70, y: 200, z: 20, title: 'Rabisco na parede', pages: ['"Quem só anda para os lados nunca encontra o que está atrás da página."'] });
    },
  });

  // ---------- 6. Fenda Vertical (pogo e plataformas que deslizam) ----------
  R({
    id: 'borda_fenda', region: 'borda', name: 'Fenda Vertical',
    pos: [3120, -400, 0], size: [480, 900, 160],
    exits: [
      { side: 'left', range: [336, 400], to: 'borda_campo' },
      { side: 'right', range: [780, 840], to: 'borda_salao' },
    ],
    build(B) {
      B.box(0, 0, 480, 20);                           // teto
      B.box(0, 20, 20, 316);                          // parede esquerda (acima da entrada)
      B.box(0, 400, 20, 500);
      B.box(460, 20, 20, 760);                        // parede direita (abertura embaixo)
      B.box(0, 840, 480, 60);                         // chão
      B.box(20, 400, 130, 20);                        // patamar de entrada
      B.box(20, 640, 130, 200);                       // P3: bloco à esquerda, logo abaixo da entrada
      B.box(150, 700, 190, 140);                      // fundo do fosso
      B.spikes(150, 340, 700, 0, 160);
      B.box(340, 660, 70, 16);                        // P4: dentro do túnel
      B.box(330, 586, 130, 30, 0, 160, { mat: 'lilas' }); // P2 (teto do túnel)
      B.box(180, 470, 120, 14);                       // P1
      // elevador entre P2 (z=0) e P1 (z=160)
      B.loft([300, 586, 330, 598], 0, [300, 470, 330, 482], 160, { mat: 'teal' });
      // plataforma que desliza: à esquerda no fundo (z=150), à direita na frente (z=0)
      B.loft([150, 640, 200, 650], 150, [290, 660, 340, 670], 0, { mat: 'teal' });
      if (!B.flag('borda_parede1')) B.box(400, 526, 40, 60, 0, 160, { mat: 'pedraEsc', breakable: 3, flag: 'borda_parede1' });
      B.ent('pickup', { x: 450, y: 586, z: 80, item: 'fragLado', id: 'frag_borda_2', flag: 'frag_borda_2', msg: 'Atrás de uma parede rachada. Golpes revelam o que a geometria esconde.' });
      B.ent('agulha', { x: 240, y: 457, z: 80, period: 2.4 });
      B.ent('agulha', { x: 370, y: 573, z: 80, period: 2.4, phase: 1.2 });
      B.ent('esferoide', { x: 420, y: 800, z: 80 });
      B.ent('hint', { x0: 20, x1: 160, y0: 560, y1: 660, text: 'No ar, [down] + [attack] quica em espinhos. Ou suba na plataforma verde e deslize com [zf] [zb].' });
      B.ent('hint', { x0: 170, x1: 460, y0: 420, y1: 590, text: 'Agulhas atravessam o plano vindas da profundidade: o anel vermelho avisa' });
    },
  });

  // ---------- 7. Salão dos Cubos Girantes ----------
  R({
    id: 'borda_salao', region: 'borda', name: 'Salão das Barras Giradas',
    pos: [3600, 180, 0], size: [800, 320, 180],
    exits: [
      { side: 'left', range: [200, 260], to: 'borda_fenda' },
      { side: 'right', range: [200, 260], to: 'borda_antecamara' },
    ],
    build(B) {
      B.box(0, 260, 260, 60);
      B.box(540, 260, 260, 60);
      B.box(260, 300, 280, 20);
      B.spikes(260, 540, 300, 0, 180);
      B.box(0, 0, 800, 18);
      // barras longas giradas em torno do eixo vertical: o pedaço cortado corre de lado conforme z
      B.cuboid(400, 265, 90, 340, 10, 22, { yaw: 0.42 }, { mat: 'teal' });
      B.cuboid(330, 196, 60, 120, 10, 22, { yaw: -0.6 }, { mat: 'teal' });
      B.box(380, 150, 60, 10, 120, 180, { mat: 'ouro', oneWay: true });
      B.ent('cuboSentinela', { x: 640, y: 250, z: 90, x0: 570, x1: 770 });
      B.ent('cuboSentinela', { x: 720, y: 250, z: 40, x0: 570, x1: 780, dir: -1 });
      B.ent('hint', { x0: 120, x1: 300, text: 'Barras giradas: em pé sobre elas, deslize na profundidade e o pedaço sob você corre de lado' });
    },
  });

  // ---------- 8. Antecâmara ----------
  R({
    id: 'borda_antecamara', region: 'borda', name: 'Antecâmara',
    pos: [4400, 140, 0], size: [480, 340, 160],
    exits: [
      { side: 'left', range: [240, 300], to: 'borda_salao' },
      { side: 'right', range: [240, 300], to: 'borda_arena' },
    ],
    build(B) {
      B.box(0, 300, 480, 40);
      B.box(0, 0, 480, 24);
      B.box(0, 24, 20, 216);
      B.box(460, 24, 20, 216);
      B.cyl('x', 240, 60, 80, 14, 200, { mat: 'pedraEsc' });
      B.ent('bench', { x: 200, y: 300, z: 80 });
      B.ent('sign', { x: 330, y: 300, title: 'Aviso riscado', pages: [
        'ALÉM DESTA PORTA, O CARCEREIRO.',
        'Ele dobra os prisioneiros em cubos e os guarda para sempre. A forma dele mostra o que vai fazer: preste atenção no corte.',
        'Dizem que o seu núcleo fica fora do centro. Procure-o pela profundidade.',
      ] });
    },
  });

  // ---------- 9. Arena do Cubo Carcereiro ----------
  R({
    id: 'borda_arena', region: 'borda', name: 'Cela do Carcereiro',
    pos: [4880, 120, 0], size: [640, 340, 200],
    exits: [
      { side: 'left', range: [260, 320], to: 'borda_antecamara' },
      { side: 'right', range: [260, 320], to: 'borda_saida' },
    ],
    build(B) {
      B.box(0, 0, 640, 20);
      B.box(0, 20, 20, 240);
      B.box(620, 20, 20, 240);
      // chão em ladrilhos: 4 colunas × 4 faixas de profundidade (caem na fase 2)
      const cols = [0, 160, 320, 480, 640], bands = [0, 50, 100, 150, 200];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const p = B.box(cols[i], 320, cols[i + 1] - cols[i], 20, bands[j], bands[j + 1], { mat: (i + j) % 2 ? 'pedra' : 'plataforma' });
        p.tile = true; p.band = j; p.baseY = 320; p.h0 = 20; p.unsafe = true;
      }
      B.ent('gate', { x: 20, y: 260, w: 12, h: 60, open: true });
      B.ent('gate', { x: 608, y: 260, w: 12, h: 60, open: true });
      B.ent('cuboCarcereiro', { x: 340, floorY: 320, trigger: 190, unless: 'boss_cubo' });
      B.ent('rede', { x: 330, y: 320, only: 'boss_cubo' });
    },
  });

  // ---------- 10. Saída da Cela (vão que exige a Investida) ----------
  R({
    id: 'borda_saida', region: 'borda', name: 'Vão da Investida',
    pos: [5520, 80, 0], size: [720, 400, 160],
    exits: [
      { side: 'left', range: [300, 360], to: 'borda_arena' },
      { side: 'right', range: [270, 360], to: 'minas_entrada', sealed: true },
    ],
    build(B) {
      B.box(0, 360, 200, 40);
      B.box(304, 360, 416, 40);
      B.box(200, 390, 104, 10);
      B.spikes(200, 304, 390, 0, 160);
      B.box(0, 0, 720, 20);
      B.box(0, 20, 20, 280);
      B.box(700, 20, 20, 250);
      B.loft([520, 360, 575, 372], 0, [520, 296, 575, 308], 160, { mat: 'teal' });
      B.box(580, 300, 40, 60, 110, 160, { mat: 'lilas' });
      B.ent('pickup', { x: 600, y: 300, z: 135, item: 'fragLado', id: 'frag_borda_3', flag: 'frag_borda_3' });
      B.ent('esferoide', { x: 420, y: 330, z: 80 });
      B.ent('cuboSentinela', { x: 480, y: 350, z: 60, x0: 330, x1: 500 });
      B.ent('fenda', { x: 688, y: 360, h: 80, title: 'Fenda para as Minas', msg: ['Uma fenda desce para as Minas Toroidais… ainda instável demais para atravessar. (Marco 3)'] });
      B.ent('hint', { x0: 40, x1: 200, need: 'dash', text: '[dash] Investida: pule e estique-se no ar para cruzar o vão' });
      B.ent('hint', { x0: 40, x1: 200, text: 'Largo demais para um pulo. Talvez o Carcereiro saiba como cruzar…' });
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = PL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
