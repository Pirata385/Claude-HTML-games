/* Sinuca do Além — conteúdo: bolas, amuletos, gizes, tacos, esquisitices de mesa e chefes. */
(function (g) {
  'use strict';
  const SA = (g.SA = g.SA || {});
  const D = (SA.Data = {});

  // ---------- Bolas comuns ----------
  D.BALL_COLORS = {
    1: '#f0c02c', 2: '#2f62c9', 3: '#d8382e', 4: '#7443b3', 5: '#ee7b22',
    6: '#2f9150', 7: '#8c2b34', 8: '#23232b', 9: '#e56a9c', 10: '#2bb3b0',
    11: '#c9a227', 12: '#4a7fe0', 13: '#e2574c', 14: '#9160cf', 15: '#f29544',
  };
  D.ptsFor = (num) => 10 + num * 5;

  // ---------- Bolas especiais ----------
  // Os efeitos ficam em game.js; aqui estão os dados e os textos.
  D.SPECIAL = {
    bomba: { name: 'Bola Bomba', glyph: '💣', color: '#34343f', pts: 30, price: 5,
      desc: 'Explode na primeira pancada de cada tacada, arremessando tudo em volta.' },
    ouro: { name: 'Bola de Ouro', glyph: '🪙', color: '#e0a92a', pts: 10, price: 4,
      desc: 'Rende +3 moedas ao ser encaçapada.' },
    fantasma: { name: 'Bola Fantasma', glyph: '👻', color: '#cfd9ea', pts: 70, price: 5,
      desc: 'Atravessa as outras bolas: só a branca e as tabelas a tocam.' },
    ameba: { name: 'Bola Ameba', glyph: '🦠', color: '#7fc24a', pts: 40, price: 5,
      desc: 'Ao levar uma pancada, divide-se em duas amebinhas de 25 pontos.' },
    ima: { name: 'Bola Ímã', glyph: '🧲', color: '#c7353f', pts: 35, price: 5,
      desc: 'Enquanto rola, arrasta consigo as bolas próximas.' },
    chumbo: { name: 'Bola de Chumbo', glyph: '⚓', color: '#6f7887', pts: 65, price: 5, mass: 3,
      desc: 'Pesadona: três vezes a massa. Leva o que encontrar pela frente.' },
    borracha: { name: 'Bola de Borracha', glyph: '🤸', color: '#f0589a', pts: 20, price: 4,
      desc: 'Quica forte nas tabelas e ganha +15 pontos por tabela tocada na tacada.' },
    cristal: { name: 'Bola de Cristal', glyph: '💎', color: '#7fd6e8', pts: 25, price: 6,
      desc: '+1 no multiplicador quando cai.' },
    maldita: { name: 'Bola 8 Maldita', glyph: '☠️', color: '#141418', pts: 150, price: 6,
      desc: 'Vale 150. Se cair com outras bolas na mesa: −1 tacada. Se for a última: ×3.' },
    raio: { name: 'Bola Raio', glyph: '⚡', color: '#f2e04a', pts: 30, price: 4,
      desc: 'Ao cair, um raio arremessa outra bola da mesa numa direção qualquer.' },
    fogo: { name: 'Bola de Fogo', glyph: '🔥', color: '#f0622a', pts: 30, price: 5,
      desc: 'Incendeia as bolas que toca. Bolas em chamas valem +15 pontos.' },
    camaleao: { name: 'Bola Camaleão', glyph: '🦎', color: '#35b98a', pts: 0, price: 5,
      desc: 'Vale o dobro dos pontos da última bola encaçapada nesta mesa.' },
    amebinha: { name: 'Amebinha', glyph: '🦠', color: '#9bd765', pts: 25, hidden: true, desc: 'Metade de uma ameba.' },
  };
  D.SPECIAL_IDS = Object.keys(D.SPECIAL).filter((k) => !D.SPECIAL[k].hidden);

  // ---------- Amuletos ----------
  // Ganchos: start(G, shot), pocket(G, shot, ball, pk, acc), end(G, shot), win(G, pay), mods: {...}
  const isCorner = (pk) => pk >= 0 && pk !== 1 && pk !== 4;
  D.RELICS = {
    dado: { name: 'Dado Viciado', icon: '🎲', rar: 0, desc: '+1 no multiplicador de toda tacada.',
      start: (G, s) => { s.mult += 1; } },
    copo: { name: 'Copo Americano', icon: '🥃', rar: 0, desc: '+15 pontos por bola encaçapada.',
      pocket: (G, s, b, pk, a) => { a.chips += 15; } },
    tabela: { name: 'Tabela Mágica', icon: '📐', rar: 0, desc: 'Encaçapar de tabela vale +1,5 no multiplicador (em vez de +0,5).',
      mods: { bankMult: 1.5 } },
    beijinho: { name: 'Beijinho', icon: '💋', rar: 1, desc: 'Carambola (bola que cai depois de tocar outra) vale +1,5 no multiplicador (em vez de +0,5).',
      mods: { kissMult: 1.5 } },
    trio: { name: 'Trio Elétrico', icon: '🎺', rar: 1, desc: 'Encaçapar 3 ou mais bolas numa tacada: ×2.',
      end: (G, s) => { if (s.pocketed.length >= 3) { s.xmult *= 2; s.notes.push('Trio Elétrico ×2'); } } },
    par: { name: 'Par ou Ímpar', icon: '✌️', rar: 0, desc: 'Bolas de número par: +25 pontos.',
      pocket: (G, s, b, pk, a) => { if (typeof b.num === 'number' && b.num % 2 === 0) a.chips += 25; } },
    impar: { name: 'Ímpar Ímpio', icon: '☝️', rar: 0, desc: 'Bolas de número ímpar: +0,5 no multiplicador.',
      pocket: (G, s, b, pk, a) => { if (typeof b.num === 'number' && b.num % 2 === 1) a.mult += 0.5; } },
    canto: { name: 'Canto Favorito', icon: '📍', rar: 0, desc: 'Caçapas de canto: +20 pontos por bola.',
      pocket: (G, s, b, pk, a) => { if (isCorner(pk)) a.chips += 20; } },
    meio: { name: 'Meio de Campo', icon: '🎯', rar: 1, desc: 'Caçapas do meio: +1 no multiplicador por bola.',
      pocket: (G, s, b, pk, a) => { if (pk === 1 || pk === 4) { a.mult += 1; a.labels.push('Meio +1'); } } },
    chamas: { name: 'Em Chamas', icon: '🌶️', rar: 1, desc: 'O bônus de sequência vale o dobro (+1 por tacada seguida com bola).',
      mods: { streakMult: 2 } },
    ultima: { name: 'Última Dose', icon: '🍺', rar: 1, desc: 'Na última tacada da mesa: ×3.',
      start: (G, s) => { if (s.isLast) { s.xmult *= 3; s.notes.push('Última Dose ×3'); } } },
    estouro: { name: 'Estouro', icon: '💥', rar: 0, desc: 'A primeira tacada de cada mesa: ×2.',
      start: (G, s) => { if (s.isBreak) { s.xmult *= 2; s.notes.push('Estouro ×2'); } } },
    colecionador: { name: 'Colecionador', icon: '🗃️', rar: 1, desc: '+0,3 no multiplicador por amuleto que você carrega.',
      start: (G, s) => { s.mult += 0.3 * G.run.relics.length; } },
    poupanca: { name: 'Poupança', icon: '🐷', rar: 1, desc: '+1 no multiplicador a cada 5 moedas guardadas (máx. +4).',
      start: (G, s) => { s.mult += Math.min(4, Math.floor(G.run.coins / 5)); } },
    vez: { name: 'Bola da Vez', icon: '👆', rar: 1, desc: 'A bola de menor número na mesa vale o triplo dos pontos.',
      pocket: (G, s, b, pk, a) => { if (b.id === s.lowestId) { a.chips *= 3; a.labels.push('Bola da vez ×3 pts'); } } },
    fiado: { name: 'Caderneta do Fiado', icon: '📒', rar: 2, desc: 'Ganha +0,25 de multiplicador permanente a cada mesa vencida.',
      start: (G, s, me) => { s.mult += me.n || 0; },
      win: (G, pay, me) => { me.n = (me.n || 0) + 0.25; },
      info: (me) => 'Agora: +' + SA.fmtMult(me.n || 0) },
    pinga: { name: 'Pinga-Fogo', icon: '🔥', rar: 0, desc: 'A primeira bola tocada pela branca pega fogo. Bolas em chamas valem +30 (em vez de +15).',
      mods: { igniteFirst: 1, burnPts: 30 } },
    gorjeta: { name: 'Gorjeta', icon: '💵', rar: 0, desc: '+1 moeda extra por tacada que sobrar ao vencer.',
      win: (G, pay) => { pay.lines.push(['Gorjeta', pay.left]); } },
    cofrinho: { name: 'Cofrinho', icon: '🏦', rar: 1, desc: 'Juros: +1 moeda a cada 5 guardadas ao vencer (máx. 5).',
      win: (G, pay) => { const j = Math.min(5, Math.floor(G.run.coins / 5)); if (j > 0) pay.lines.push(['Juros do cofrinho', j]); } },
    dente: { name: 'Dente de Ouro', icon: '🦷', rar: 0, desc: '+2 moedas a cada mesa vencida.',
      win: (G, pay) => { pay.lines.push(['Dente de ouro', 2]); } },
    vip: { name: 'Cliente VIP', icon: '🎟️', rar: 1, desc: 'Tudo no balcão sai 25% mais barato.', mods: { discount: 0.25 } },
    niquel: { name: 'Caça-Níquel', icon: '🎰', rar: 0, desc: 'Cada bola encaçapada tem 1 chance em 3 de render 1 moeda.',
      pocket: (G, s, b, pk, a) => { if (G.fxRng() < 1 / 3) { a.coins += 1; } } },
    laser: { name: 'Mira Laser', icon: '🔦', rar: 0, desc: 'Guia de mira longa e com um ricochete.', mods: { guide: 1 } },
    cera: { name: 'Feltro Encerado', icon: '🧈', rar: 0, desc: 'As bolas deslizam bem mais longe.', mods: { friction: 0.68 } },
    gulosas: { name: 'Caçapas Gulosas', icon: '👄', rar: 1, desc: 'Caçapas 20% maiores.', mods: { pocket: 1.2 } },
    braco: { name: 'Braço Forte', icon: '💪', rar: 0, desc: 'Força máxima +30%.', mods: { power: 1.3 } },
    kamikaze: { name: 'Branca Kamikaze', icon: '🕊️', rar: 1, desc: 'Encaçapar a branca não é falta e ainda rende +60 pontos.', mods: { kamikaze: 1 } },
    saideira: { name: 'Saideira', icon: '🍻', rar: 2, desc: 'Uma vez por noite: ao ficar sem tacadas, ganhe +3. (Some depois de usada.)', mods: { saideira: 1 } },
    folego: { name: 'Fôlego', icon: '🫁', rar: 1, desc: '+1 tacada por mesa.', mods: { shots: 1 } },
    maoboba: { name: 'Mão Boba', icon: '🫳', rar: 2, desc: 'Encaçapar 2 ou mais bolas numa tacada devolve a tacada.', mods: { refund2: 1 } },
    eletrica: { name: 'Tabelas Elétricas', icon: '🔌', rar: 1, desc: 'As tabelas dão choque e rebatem as bolas com mais força.', mods: { electric: 1 } },
    eco: { name: 'Eco', icon: '🔔', rar: 1, desc: 'A primeira bola encaçapada em cada mesa vale o dobro dos pontos.',
      pocket: (G, s, b, pk, a) => { if (!G.T.echoUsed) { G.T.echoUsed = true; a.chips *= 2; a.labels.push('Eco ×2 pts'); } } },
    polvora: { name: 'Pólvora', icon: '🧨', rar: 2, desc: 'Colisões fortes entre bolas têm chance de explodir.', mods: { polvora: 1 } },
    xerox: { name: 'Xerox', icon: '🖨️', rar: 1, desc: 'No começo de cada mesa, uma bola do saco entra duplicada (só naquela mesa).', mods: { xerox: 1 } },
    sopro: { name: 'Sopro do Além', icon: '🌬️', rar: 1, desc: 'Ao fim da tacada, bolas paradas na boca da caçapa caem sozinhas.', mods: { sopro: 1 } },
    gizeterno: { name: 'Giz Eterno', icon: '♾️', rar: 1, desc: '35% de chance de não gastar o giz usado.', mods: { chalkKeep: 0.35 } },
    coelho: { name: 'Pé de Coelho', icon: '🐇', rar: 2, desc: '×1,5 em toda tacada.',
      start: (G, s) => { s.xmult *= 1.5; } },
  };
  D.RELIC_IDS = Object.keys(D.RELICS);
  D.RAR_NAME = ['Comum', 'Incomum', 'Raro'];
  D.RELIC_PRICE = [5, 7, 10];

  // ---------- Gizes (consumíveis) ----------
  D.CHALKS = {
    fogo: { name: 'Giz de Fogo', icon: '🔥', color: '#e8622a', desc: 'A branca sai em chamas: incendeia o que toca e quase não perde força na primeira batida.' },
    fantasma: { name: 'Giz Fantasma', icon: '👻', color: '#b9c6de', desc: 'A branca atravessa a primeira bola que encontrar.' },
    trovao: { name: 'Giz Trovão', icon: '⚡', color: '#f2e04a', desc: 'Esta tacada sai com 80% a mais de força.' },
    triplo: { name: 'Giz Triplo', icon: '🔱', color: '#57c4a5', desc: 'Dispara duas brancas-fantasma extras em leque. Elas somem no fim da tacada.' },
    pulo: { name: 'Giz Pulo', icon: '🦘', color: '#b98a4a', desc: 'A branca salta por cima das primeiras bolas no caminho.' },
    fome: { name: 'Giz da Fome', icon: '🕳️', color: '#7a4fc0', desc: 'Nesta tacada, as caçapas puxam as bolas que passarem por perto.' },
    tempo: { name: 'Giz do Tempo', icon: '⏪', color: '#5aa0e0', instant: true, desc: 'Uso imediato: desfaz a última tacada (posições, pontos e tacada gasta).' },
    ouro: { name: 'Giz Dourado', icon: '🪙', color: '#e0a92a', desc: 'Nesta tacada, cada bola encaçapada rende +2 moedas.' },
    gigante: { name: 'Giz Gigante', icon: '🐘', color: '#9aa3b0', desc: 'A branca fica enorme e pesada durante a tacada.' },
    terremoto: { name: 'Giz Terremoto', icon: '🌋', color: '#c2452f', instant: true, desc: 'Uso imediato: sacode a mesa inteira sem gastar tacada. O que cair, pontua.' },
  };
  D.CHALK_IDS = Object.keys(D.CHALKS);
  D.CHALK_PRICE = 3;

  // ---------- Tacos (escolha inicial) ----------
  D.CUES = {
    boteco: { name: 'Taco do Boteco', icon: '🪵', desc: 'O de sempre, meio torto. Equilibrado.', perk: '7 tacadas por mesa.', shots: 7, colors: ['#c9995a', '#5b3a1e'] },
    marreta: { name: 'Taco Marreta', icon: '🔨', desc: 'Pesa uma tonelada.', perk: '+35% de força. Guia de mira mais curta.', shots: 7, power: 1.35, guide: -1, colors: ['#8d8f98', '#3c3f4a'] },
    precisao: { name: 'Taco de Mestre', icon: '🎓', desc: 'Leve, reto, metido a besta.', perk: 'Guia longa com ricochete. −15% de força.', shots: 7, power: 0.85, guide: 1, colors: ['#e6d3a8', '#263a5e'] },
    dourado: { name: 'Taco Dourado', icon: '👑', desc: 'Dinheiro chama dinheiro.', perk: 'Começa com 10 moedas. 6 tacadas por mesa.', shots: 6, coins: 10, colors: ['#e7c14b', '#7a5412'],
      lock: 'Vença o Ato 1 para liberar.', need: 1 },
    maldito: { name: 'Taco Maldito', icon: '🦴', desc: 'Achado atrás do freezer.', perk: 'Começa com um amuleto raro e uma Bola 8 Maldita. Metas 15% maiores.', shots: 7, cursed: true, target: 1.15, colors: ['#d9d4c5', '#5a1f2a'],
      lock: 'Vença o Ato 2 para liberar.', need: 2 },
    vidro: { name: 'Taco de Vidro', icon: '🔮', desc: 'Lindo. Frágil. Arrogante.', perk: '×1,5 em toda tacada. Só 5 tacadas por mesa.', shots: 5, xmult: 1.5, colors: ['#a8e4ee', '#3f7f96'],
      lock: 'Vença uma noite inteira para liberar.', need: 3 },
  };
  D.CUE_IDS = Object.keys(D.CUES);

  // ---------- Esquisitices de mesa ----------
  D.MODS = {
    pinball: { name: 'Pinball', icon: '🕹️', desc: 'Três rebatedores no meio da mesa. Cada rebatida vale +5 pontos.', hard: 0 },
    portais: { name: 'Portais', icon: '🌀', desc: 'Dois portais ligados: o que entra num, sai no outro.', hard: 0 },
    dourada: { name: 'Caçapa Dourada', icon: '🌟', desc: 'A cada tacada, uma caçapa brilha: bolas que caírem nela valem o dobro dos pontos.', hard: -1 },
    gelo: { name: 'Mesa de Gelo', icon: '🧊', desc: 'Feltro congelado: as bolas quase não param.', hard: 1 },
    lama: { name: 'Feltro Molhado', icon: '💧', desc: 'Poças de cerveja derramada freiam as bolas.', hard: 1 },
    vento: { name: 'Ventilador', icon: '🌪️', desc: 'O ventilador de teto empurra as bolas. A direção muda a cada tacada.', hard: 1 },
    paredes: { name: 'Engradados', icon: '📦', desc: 'Alguém largou engradados em cima da mesa.', hard: 1 },
    helice: { name: 'Hélice', icon: '⚙️', desc: 'Uma hélice gira na mesa durante a tacada e rebate o que encostar.', hard: 1 },
    tampas: { name: 'Tampinhas', icon: '🍾', desc: 'A cada tacada, duas caçapas ficam tampadas.', hard: 2 },
    miudas: { name: 'Caçapas Miúdas', icon: '🤏', desc: 'Caçapas 20% menores.', hard: 2 },
    buraco: { name: 'Buraco Negro', icon: '⚫', desc: 'Um buraco negro na mesa engole o que chegar perto. Bolas engolidas pontuam com +0,5 de multiplicador.', hard: 1 },
    inclinada: { name: 'Mesa Torta', icon: '📉', desc: 'Um pé está mais curto: as bolas puxam para um lado.', hard: 1 },
    escuro: { name: 'Apagão', icon: '🕯️', desc: 'Faltou luz. Só dá para ver perto da branca e das bolas em movimento.', hard: 2 },
  };
  D.MOD_POOL = ['pinball', 'portais', 'dourada', 'gelo', 'lama', 'vento', 'paredes', 'helice', 'tampas', 'miudas', 'buraco', 'inclinada'];

  // ---------- Chefes ----------
  D.BOSSES = {
    lourival: { act: 0, name: 'Seu Lourival', title: 'O Dono do Bar', icon: '🧔', mods: ['tampas'], lids: 3,
      desc: 'A casa fecha cedo: três caçapas tampadas a cada tacada.' },
    neblina: { act: 0, name: 'Dona Neblina', title: 'A Senhora do Apagão', icon: '👵', mods: ['escuro'],
      desc: 'Apagão: a mesa fica às escuras.' },
    tiao: { act: 1, name: 'Tião Tornado', title: 'O Ventilador Humano', icon: '🌬️', mods: ['vento', 'helice'], wind: 1.7,
      desc: 'Vendaval dobrado e uma hélice no meio da mesa.' },
    viuva: { act: 1, name: 'A Viúva do Feltro', title: 'Luto Fechado', icon: '🕷️', mods: ['gelo'], noEven: true,
      desc: 'Luto: bolas de número par não valem ponto nenhum. E a mesa é de gelo.' },
    tinhoso: { act: 2, name: 'O Tinhoso', title: 'Credor das Almas', icon: '😈', mods: ['buraco', 'dourada'], debt: 0.1,
      desc: 'Dívida eterna: cada tacada sem encaçapar aumenta a meta em 10%. Há um buraco negro na mesa.' },
    espelho: { act: 2, name: 'O Outro Você', title: 'Reflexo no Fundo do Copo', icon: '🪞', mods: ['portais', 'miudas'], halfFirst: true, target: 0.75,
      desc: 'Só a segunda bola em diante pontua em cada tacada: a primeira vale zero. Em troca, a meta é 25% menor.' },
  };

  // ---------- Atos e metas ----------
  D.ACTS = [
    { name: 'Ato 1 — O Boteco', felt: '#2f8a57', feltDark: '#1f6a42', wood: '#8a5a2e', woodDark: '#4e2f16', floorA: '#3a2a22', floorB: '#57413a', light: '#ffdf9c', bg: '#140d0a', metal: '#c9a44a', tempo: 96 },
    { name: 'Ato 2 — O Porão', felt: '#2c63a8', feltDark: '#1d467d', wood: '#5a4636', woodDark: '#2a2019', floorA: '#22262e', floorB: '#343b47', light: '#b9d6ff', bg: '#090b10', metal: '#9aa7b8', tempo: 104 },
    { name: 'Ato 3 — O Além', felt: '#a32f3f', feltDark: '#74202e', wood: '#2f2430', woodDark: '#140e16', floorA: '#1a0f22', floorB: '#33173a', light: '#ffb07a', bg: '#07030a', metal: '#e0b24a', tempo: 112 },
  ];
  D.TARGETS = [80, 120, 190, 320, 480, 760, 1100, 1600, 2400];
  D.DIFFS = {
    facil: { name: 'De leve', mul: 0.75, desc: 'Metas 25% menores.' },
    normal: { name: 'Na moral', mul: 1, desc: 'Como a casa manda.' },
    dificil: { name: 'Valendo a conta', mul: 1.35, desc: 'Metas 35% maiores.' },
  };
  D.TABLE_NAMES = ['Mesa do Canto', 'Mesa da Janela', 'Mesa Bamba', 'Mesa dos Fundos', 'Mesa do Jukebox', 'Mesa Manchada', 'Mesa do Balcão', 'Mesa 13', 'Mesa do Gato', 'Mesa Sem Dono', 'Mesa do Corredor', 'Mesa da Sinuca de Bico'];

  D.TIPS = [
    'Mais de uma bola na mesma tacada vira combo: cada bola extra dá +1 no multiplicador.',
    'Encaçapar de tabela ou de carambola rende +0,5 no multiplicador.',
    'Tacadas seguidas com bola acendem a sequência: +0,5 por nível.',
    'Sobrou tacada? Cada uma vira moeda no fim da mesa.',
    'Toque num amuleto ou giz para ler o que ele faz.',
    'O efeito (bolinha no canto) faz a branca seguir ou voltar depois da batida.',
    'Segure o botão ⏩ para acelerar as bolas.',
    'Encaçapar a branca corta a tacada pela metade e apaga a sequência.',
  ];
})(typeof window !== 'undefined' ? window : globalThis);
