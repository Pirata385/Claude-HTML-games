/* Mutatrix: bancos de palavras e textos em português brasileiro. Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});

  // ---------------------------------------------------------------- nomes de cobaias
  const SUBJECT_NAMES = {
    comum: ['Bolota', 'Pipoca', 'Nhoque', 'Paçoca', 'Cocada', 'Feijão', 'Quindim', 'Brigadeiro', 'Jujuba', 'Farofa', 'Pastel', 'Torresmo', 'Pudim', 'Biscoito', 'Coxinha', 'Pitoco', 'Fubá', 'Tapioca', 'Bolinho', 'Rabanete', 'Chuchu', 'Moranga', 'Dendê', 'Gergelim', 'Pamonha', 'Canjica', 'Sagu', 'Bisnaga', 'Quiabo', 'Caju', 'Pitanga', 'Jabuticaba', 'Maxixe', 'Cuscuz', 'Requeijão', 'Goiabada', 'Mungunzá', 'Polvilho', 'Cajuzinho', 'Bem-Casado'],
    rato: ['Queijinho', 'Ratatui', 'Bigodinho', 'Roquefort', 'Cheddar', 'Gorgonzola', 'Ricota', 'Provolone'],
    robo: ['Parafuso', 'Rebimboca', 'Gaxeta', 'Bielinha', 'Engrenildo', 'Transistor', 'Rolamento', 'Arruela', 'Vela de Ignição', 'Carburador'],
    planta: ['Samambaia', 'Clorofila', 'Begônia', 'Hortelã', 'Manjericão', 'Alecrim', 'Avenca', 'Jiboia', 'Orquídea', 'Costela-de-Adão'],
    ameba: ['Gotinha', 'Melequinha', 'Bolha', 'Gelatina', 'Mingau', 'Geleia', 'Gosminha', 'Flã', 'Pudinzinho', 'Catarrinho'],
  };
  const TITLES_M = ['Seu', 'Doutor', 'Professor', 'Sargento', 'Barão', 'Capitão', 'Mestre', 'Visconde', 'Comendador'];
  const TITLES_F = ['Dona', 'Doutora', 'Professora', 'Madame', 'Duquesa', 'Baronesa', 'Sargenta', 'Viscondessa', 'Comendadora'];
  const TRAITS = [
    'de temperamento duvidoso', 'com alergia a segunda-feira', 'fã de novela das seis', 'que coleciona tampinhas',
    'que dorme de olho aberto', 'com histórico de fugas', 'que já trabalhou no circo', 'com medo de pombos',
    'que adora bossa nova', 'de apetite inexplicável', 'que ronca em Si bemol', 'com mania de limpeza',
    'que acredita em horóscopo', 'que nunca perdeu um bingo', 'com um passado misterioso', 'que odeia o horário de verão',
    'que fala dormindo', 'com vocação para a política', 'que se acha muito bonito', 'que guarda rancor de jalecos',
  ];
  const ROBOT_MODELS = ['RX', 'MK', 'BX', 'ZT', 'K9', 'VX', 'T3', 'Q7'];

  // ---------------------------------------------------------------- apelidos de cepas
  const VIRUS_NOUNS = [
    { w: 'Soluço', g: 'm' }, { w: 'Espirro', g: 'm' }, { w: 'Arrepio', g: 'm' }, { w: 'Tremelique', g: 'm' },
    { w: 'Faniquito', g: 'm' }, { w: 'Chilique', g: 'm' }, { w: 'Piripaque', g: 'm' }, { w: 'Calafrio', g: 'm' },
    { w: 'Fricote', g: 'm' }, { w: 'Treco', g: 'm' }, { w: 'Bafafá', g: 'm' }, { w: 'Siricutico', g: 'm' },
    { w: 'Quiproquó', g: 'm' }, { w: 'Rebuliço', g: 'm' }, { w: 'Furdunço', g: 'm' }, { w: 'Borogodó', g: 'm' },
    { w: 'Febre', g: 'f' }, { w: 'Coceira', g: 'f' }, { w: 'Tosse', g: 'f' }, { w: 'Gripe', g: 'f' },
    { w: 'Comichão', g: 'f' }, { w: 'Pane', g: 'f' }, { w: 'Birra', g: 'f' }, { w: 'Brotoeja', g: 'f' },
    { w: 'Gastura', g: 'f' }, { w: 'Lambança', g: 'f' }, { w: 'Zica', g: 'f' }, { w: 'Muvuca', g: 'f' },
    { w: 'Bagunça', g: 'f' }, { w: 'Ziquizira', g: 'f' }, { w: 'Pereba', g: 'f' }, { w: 'Coqueluche', g: 'f' },
  ];
  const VIRUS_ADJS = [
    { m: 'Estelar', f: 'Estelar' }, { m: 'Saltitante', f: 'Saltitante' }, { m: 'Borbulhante', f: 'Borbulhante' },
    { m: 'Fosforescente', f: 'Fosforescente' }, { m: 'Galopante', f: 'Galopante' }, { m: 'Cintilante', f: 'Cintilante' },
    { m: 'Gelatinoso', f: 'Gelatinosa' }, { m: 'Turbinado', f: 'Turbinada' }, { m: 'Atômico', f: 'Atômica' },
    { m: 'Desengonçado', f: 'Desengonçada' }, { m: 'Faceiro', f: 'Faceira' }, { m: 'Melódico', f: 'Melódica' },
    { m: 'Espevitado', f: 'Espevitada' }, { m: 'Pegajoso', f: 'Pegajosa' }, { m: 'Rodopiante', f: 'Rodopiante' },
    { m: 'Supersônico', f: 'Supersônica' }, { m: 'Abissal', f: 'Abissal' }, { m: 'Nebuloso', f: 'Nebulosa' },
    { m: 'Tropical', f: 'Tropical' }, { m: 'Jururu', f: 'Jururu' }, { m: 'Fuleiro', f: 'Fuleira' },
    { m: 'Psicodélico', f: 'Psicodélica' }, { m: 'Radiante', f: 'Radiante' }, { m: 'Trepidante', f: 'Trepidante' },
    { m: 'Ultravioleta', f: 'Ultravioleta' }, { m: 'Marombeiro', f: 'Marombeira' }, { m: 'Enxerido', f: 'Enxerida' },
    { m: 'Dengoso', f: 'Dengosa' }, { m: 'Sideral', f: 'Sideral' }, { m: 'Tinhoso', f: 'Tinhosa' },
  ];

  // ---------------------------------------------------------------- voz da Mutatrix
  const QUIPS = {
    welcome: [
      'Bom dia, doutor. Hoje é um ótimo dia para desafiar a natureza.',
      'Sistemas aquecidos. Ética em modo de espera.',
      'Bem-vindo de volta. Senti falta de alguém para culpar.',
      'Tubos limpos, reagentes frescos, bom senso vencido. Vamos lá.',
    ],
    pickHost: [
      'Escolha uma cobaia. Todas assinaram o termo de consentimento. Mais ou menos.',
      'A câmara está vazia, e eu odeio silêncio.',
      'Rato, robô, planta ou ameba. Nenhuma resposta errada, só consequências.',
    ],
    newSubject: [
      'Cobaia acomodada. Ela parece confiar em você. Coitada.',
      'Nova cobaia registrada. Ficha arquivada na pasta "Ainda Normal".',
      'Bem-vinda à câmara. O cardápio de hoje é mutação ao molho de incerteza.',
      'Cobaia pronta. Ela olhou para mim. Eu não gostei.',
    ],
    compose: [
      'Escolha o capsídeo, encaixe os reagentes e gire os mostradores. Eu cuido do resto.',
      'Mais Virulência, mais espetáculo. Mais Caos, mais surpresa. Mais os dois, mais papelada.',
      'Uma pitada de Caos nunca matou ninguém. Estatisticamente, quase ninguém.',
    ],
    synth: [
      'Sintetizando. Por favor, mantenha os dedos longe dos tubos.',
      'Centrífuga a todo vapor. Se ouvir um apito, era para ouvir.',
      'Costurando nucleotídeos. Ponto cruz, para durar.',
      'Processando. Isso vai doer, mas não em mim.',
      'Misturando, sacudindo, pedindo desculpas antecipadas.',
    ],
    vial: [
      'Cepa pronta. Arraste a seringa até a cobaia ou aperte Injetar.',
      'Frasco cheio. A cobaia está fingindo que não viu.',
      'Pronto. Recomendo não cheirar.',
    ],
    inject: [
      'Injeção aplicada. Agora é esperar e anotar.',
      'Picadinha rápida. A cobaia nem sentiu. Sentiu sim.',
      'Dose administrada. Que comece o espetáculo.',
    ],
    reject: [
      'Rejeitado. A cobaia espirrou o vírus de volta, com muita classe.',
      'O sistema imunológico dela venceu esta rodada. Aplausos relutantes.',
      'Rejeição total. Ela simplesmente não estava a fim.',
      'Nada aconteceu. Fora o espirro. O espirro foi impressionante.',
    ],
    inofensiva: [
      'Mutação inofensiva. Fofinha, até.',
      'Nada perigoso. Só esquisito o bastante para uma foto.',
      'Inofensivo. Fico quase decepcionada.',
    ],
    bizarra: [
      'Ora, ora. Isso não estava no livro.',
      'Bizarro. Vou registrar como "interessante" para não assustar o comitê.',
      'Eu já vi muita coisa, e isso não é uma delas.',
    ],
    perigosa: [
      'Mutação perigosa. Recomendo dar um passo para trás. Dois.',
      'Atenção: a cobaia agora tem meios de se vingar.',
      'Perigoso. Ainda bem que o vidro é temperado. Era.',
    ],
    destrutiva: [
      'ALERTA. Isso vai sair caro.',
      'Destrutiva. Avise o seguro. E a família.',
      'Protocolo de emergência ativado. O protocolo é gritar.',
    ],
    synergy: [
      'Sinergia detectada. As mutações estão conversando entre si.',
      'Combinação inédita. Os temas se deram bem demais.',
      'Sinergia. É como um dueto, mas biológico e preocupante.',
    ],
    warn60: [
      'Instabilidade em 60 por cento. A cobaia está tremendo, e eu também.',
      'Aviso: estrutura genética rangendo como escada de madeira.',
    ],
    warn85: [
      'Instabilidade crítica. Mais uma dose e ela pode virar história.',
      'Zona vermelha. Não tenho certeza de que a câmara aguenta.',
    ],
    collapse: [
      'Colapso. Registrando hora do óbito. E da festa.',
      'Bom, isso aconteceu. Vou buscar o esfregão.',
      'A ciência agradece o sacrifício. A faxineira, não.',
    ],
    deliver: [
      'Encomenda despachada. Furos para respirar incluídos.',
      'Cliente satisfeito, créditos na conta, consciência no bolso.',
      'Mais uma obra-prima vendida. Eu deveria cobrar comissão.',
    ],
    shelf: [
      'Conservada em formol aromatizado. Fica linda na prateleira.',
      'Mais uma peça para a coleção. O laboratório está virando museu.',
    ],
    retire: [
      'Aposentadoria aprovada. O sítio da Vó Gertrudes tem jardim e wi-fi.',
      'Foi viver no campo. Dizem que lá ninguém aplica injeção.',
    ],
    stabilize: [
      'Estabilizador aplicado. Ela suspirou aliviada. Eu acho.',
      'Calmante genético injetado. Instabilidade em queda.',
    ],
    noCredits: [
      'Créditos insuficientes. A ciência é cara, e você é pobre.',
      'Sem verba. Talvez um contrato ajude.',
    ],
    buy: [
      'Compra registrada. Já estou instalando, sem ler as instruções.',
      'Excelente aquisição. Quase tão boa quanto eu.',
    ],
    repair: [
      'Laboratório consertado. Até a próxima catástrofe.',
      'Tudo novo de novo. Por enquanto.',
    ],
    event: [
      'Evento destrutivo em andamento. Mantenha a calma e o jaleco.',
      'Ninguém entra em pânico. Exceto eu.',
    ],
    idle: [
      'Sabia que a ameba média tem mais iniciativa que o comitê de ética?',
      'Lembrete: o código da cepa pode ser compartilhado. A culpa também.',
      'Se uma cepa der certo, anote o código. Se der errado, anote também.',
      'Os contratos pagam melhor que a vida acadêmica. Não é difícil.',
      'Dica: cada espécie gosta de alguns temas e odeia outros.',
      'A Vó Gertrudes mandou dizer que o sítio tem vaga.',
      'Estou ouvindo bossa nova há quarenta e oito horas. Ajuda a pensar.',
      'Gire a cobaia arrastando. Ela adora. Mentira, ela tolera.',
    ],
  };

  // ---------------------------------------------------------------- falas das cobaias falantes
  const SPEECH = [
    'Isso é legal? Parece ilegal.', 'Eu exijo um advogado.', 'Quanto pagam de insalubridade aqui?',
    'Alguém viu meu outro olho?', 'Hoje acordei me sentindo meio vírus.', 'Sou seu experimento, não seu amigo.',
    'Tem wi-fi nesta câmara?', 'A comida aqui é de laboratório mesmo.', 'Eu era normal, sabia?',
    'Mais uma dose, doutor. Pela ciência.', 'Já posso ir pra casa?', 'Sinto algo novo crescendo. De novo.',
    'Qual é o meu nome científico mesmo?', 'Me tira daqui que eu te dou cinco estrelas.', 'Isso vai sair na revista?',
    'Cuidado com essa seringa, viu?', 'Sou mutante, mas tenho sentimentos.', 'Será que esse pedaço é meu mesmo?',
    'Me chama de espécime raro.', 'Vou contar tudo para o sindicato.', 'Bonito esse jaleco. Combina com a culpa.',
    'Eu vejo cores novas. Muitas.', 'Essa música de novo?', 'Ninguém aqui bate na porta?',
    'Eu tenho direito a um telefonema.', 'Se eu brilhar, é de propósito.', 'Hoje eu tô me sentindo plural.',
  ];

  // ---------------------------------------------------------------- clientes e cartas
  const CLIENT_FIRST = [
    { w: 'Zuleica', g: 'f' }, { w: 'Cleide', g: 'f' }, { w: 'Josenildo', g: 'm' }, { w: 'Waldisney', g: 'm' },
    { w: 'Creuza', g: 'f' }, { w: 'Tarcísio', g: 'm' }, { w: 'Valdirene', g: 'f' }, { w: 'Clodoaldo', g: 'm' },
    { w: 'Rosicleide', g: 'f' }, { w: 'Edinaldo', g: 'm' }, { w: 'Marivalda', g: 'f' }, { w: 'Gildásio', g: 'm' },
    { w: 'Jucelino', g: 'm' }, { w: 'Lucineide', g: 'f' }, { w: 'Raimunda', g: 'f' }, { w: 'Severino', g: 'm' },
    { w: 'Genésio', g: 'm' }, { w: 'Dalvanira', g: 'f' }, { w: 'Osvaldo', g: 'm' }, { w: 'Ivonete', g: 'f' },
    { w: 'Agripino', g: 'm' }, { w: 'Zilda', g: 'f' }, { w: 'Belarmino', g: 'm' }, { w: 'Francineide', g: 'f' },
    { w: 'Juvenal', g: 'm' }, { w: 'Iolanda', g: 'f' }, { w: 'Epaminondas', g: 'm' }, { w: 'Cremilda', g: 'f' },
    { w: 'Anacleto', g: 'm' }, { w: 'Sebastiana', g: 'f' },
  ];
  const CLIENT_LAST = ['da Silva', 'Pereira', 'do Bairro', 'das Couves', 'Bigode', 'Trovão', 'Fumaça', 'Vassoura', 'dos Anjos', 'Pimenta', 'Cascudo', 'Tremoço', 'Formiga', 'Bacurau', 'Jacaré', 'Calango', 'Mandacaru', 'Sabiá', 'Pirulito', 'Quebra-Galho'];

  // themes: temas preferidos; hosts: espécies preferidas; mild: evita mutações graves.
  const PROFESSIONS = [
    { m: 'Cartomante', f: 'Cartomante', themes: ['cosmico', 'sombrio', 'cristalino'], motives: ['Minhas cartas andam previsíveis demais. Preciso de um ajudante que veja além.', 'O tarô disse que você me venderia algo esquisito. O tarô nunca erra.'] },
    { m: 'Chef Experimental', f: 'Chef Experimental', themes: ['acucarado', 'igneo', 'vegetal'], motives: ['Quero um ingrediente vivo para o meu menu degustação. Ninguém vai comer, é só para a foto.', 'Meu restaurante precisa de um mascote que combine com espuma de beterraba.'] },
    { m: 'Dono de Circo', f: 'Dona de Circo', themes: ['musical', 'cosmico', 'eletrico'], motives: ['O público cansou de malabarista. Quero uma atração que faça criança chorar de alegria.', 'Nosso domador fugiu com o leão. Preciso de algo que se dome sozinho.'] },
    { m: 'Síndico de Prédio', f: 'Síndica de Prédio', themes: ['magnetico', 'osseo', 'vegetal'], motives: ['Preciso de um segurança para a portaria. Que assuste, mas não suje o hall.', 'O condomínio aprovou, por um voto, a compra de um mascote. Não me decepcione.'] },
    { m: 'Influenciador Digital', f: 'Influenciadora Digital', themes: ['musical', 'acucarado', 'cristalino'], mild: true, motives: ['Meus seguidores querem conteúdo novo. Algo fofo, brilhante e que viralize até amanhã.', 'Preciso de um bichinho para a dancinha da semana. Tem que ser fotogênico.'] },
    { m: 'Colecionador Excêntrico', f: 'Colecionadora Excêntrica', themes: [], motives: ['Tenho de tudo na minha coleção, menos isso que vou pedir agora.', 'Meu cofre tem espaço para mais uma raridade. Uma bem estranha.'] },
    { m: 'Tecladista de Forró Eletrônico', f: 'Tecladista de Forró Eletrônico', themes: ['musical', 'eletrico'], motives: ['Nosso sanfoneiro fugiu. Precisamos de alguém com ritmo no sangue, ou no que tiver.', 'A banda precisa de um efeito especial vivo para o show de São João.'] },
    { m: 'Secretário de Cultura de Itapiruçu', f: 'Secretária de Cultura de Itapiruçu', themes: ['vegetal', 'aquatico'], mild: true, motives: ['A cidade quer um mascote para a Festa da Colheita. Precisa sair bem na foto com o prefeito.', 'Itapiruçu do Norte merece um símbolo vivo. O de Itapiruçu do Sul é um sapo.'] },
    { m: 'Pesquisador Rival', f: 'Pesquisadora Rival', themes: [], hard: true, motives: ['Aposto que você não consegue fazer isso. Se conseguir, eu pago. E fico com raiva.', 'Meu laboratório falhou nisso dezessete vezes. Duvido que o seu acerte.'] },
    { m: 'Neto da Vó Gertrudes', f: 'Neta da Vó Gertrudes', themes: ['acucarado', 'vegetal', 'musical'], mild: true, motives: ['A vó quer companhia no sítio. Nada que morda, por favor, que ela tem dentadura.', 'Quero um bichinho de estimação para levar à escola. Sem explodir, por favor.'] },
    { m: 'Presidente do Clube do Terror', f: 'Presidenta do Clube do Terror', themes: ['sombrio', 'osseo', 'gasoso'], motives: ['Nossa casa mal-assombrada precisa de um morador novo. Quanto mais arrepiante, melhor.', 'O trem fantasma do parque perdeu a graça. Precisamos de algo que dê pesadelo de verdade.'] },
    { m: 'Engenheiro de Usina', f: 'Engenheira de Usina', themes: ['eletrico', 'magnetico', 'igneo'], motives: ['A usina precisa de alguém que aguente a pressão. Literalmente.', 'Preciso de um assistente à prova de choque. O último virou poeira.'] },
    { m: 'Aquarista', f: 'Aquarista', themes: ['aquatico', 'cristalino'], motives: ['Meu aquário está sem graça. Quero um peixe. Ou algo que finja ser.', 'Os peixes do meu aquário estão entediados. Preciso de um colega de tanque.'] },
    { m: 'Astronauta Aposentado', f: 'Astronauta Aposentada', themes: ['cosmico', 'gasoso', 'magnetico'], motives: ['Sinto falta do espaço. Me traga algo que lembre o vazio sideral.', 'Quero um companheiro que entenda a solidão de orbitar a Terra.'] },
    { m: 'Carnavalesco de Escola de Samba', f: 'Carnavalesca de Escola de Samba', themes: ['musical', 'acucarado', 'igneo'], motives: ['O carro alegórico precisa de um destaque que brilhe, dance e não tenha medo de altura.', 'Nosso enredo é sobre a ciência. Precisamos de uma prova viva na avenida.'] },
  ];
  const GREETINGS = ['Prezado laboratório,', 'Caríssimo cientista,', 'Olá, doutor,', 'A quem possa interessar,', 'Ilustríssimo laboratório,', 'Oi, tudo bem? Então,'];
  const CLOSINGS = ['Pago bem e não faço perguntas.', 'Aguardo ansiosamente. Ou nervosamente.', 'Por favor, embale com cuidado e com furos para respirar.', 'Sem devolução, sem reclamação.', 'Se der errado, eu nunca escrevi esta carta.', 'Mande junto o manual de instruções, se houver.', 'Desde já, obrigado. Ou obrigada. Tanto faz.'];
  const DELIVERY_HAPPY = ['É exatamente o que eu sonhei. E olha que meus sonhos são estranhos.', 'Perfeito! Vou mandar fazer um quadro.', 'Superou as expectativas. Até as mais duvidosas.', 'Impecável. Já indiquei vocês para três amigos.'];
  const DELIVERY_OK = ['Serve. Não é bem o que imaginei, mas serve.', 'Recebido. Vamos ver no que dá.', 'Cumpre o combinado. Nada mais, nada menos.', 'Aceito, com uma sobrancelha levantada.'];

  const RETIRE = [
    '{c} foi morar no Sítio da Vó Gertrudes. Manda cartões-postais de vez em quando.',
    '{c} se aposentou no campo. Hoje cuida da horta e assusta as galinhas.',
    '{c} partiu para o sítio. A Vó Gertrudes já tricotou um casaquinho sob medida.',
  ];

  const HINTS = {
    start: 'Toque numa cobaia para colocá-la na câmara. Cada espécie aceita temas diferentes.',
    compose: 'Encaixe reagentes na fita genética. Cada reagente puxa mutações do seu tema.',
    vial: 'Arraste a seringa até a cobaia, ou use o botão Injetar.',
    observe: 'Mais doses empilham mutações e instabilidade. Aos 100 por cento, ela colapsa.',
    contracts: 'Abra os Contratos: clientes pagam bem por cobaias com mutações específicas.',
  };

  const HELP = [
    { t: 'O laboratório', p: 'Você opera a Mutatrix, uma máquina que fabrica vírus capazes de mutar seres vivos. Escolha uma cobaia (rato, robô biomecânico, planta ou ameba), crie um vírus e injete. Cada vírus causa de uma a quatro mutações.' },
    { t: 'Criando vírus', p: 'O capsídeo define o tipo de mutação mais provável: partes novas, mudanças no corpo ou comportamentos. Os reagentes da fita genética definem os temas, e a potência de cada um aumenta sua influência. Virulência deixa tudo mais forte e grave; Caos traz temas inesperados. A semente muda o resultado; a mesma receita com a mesma semente gera sempre o mesmo vírus.' },
    { t: 'Classes de mutação', p: 'Inofensivas são só estranhas. Bizarras são muito estranhas. Perigosas atacam o vidro da câmara de tempos em tempos. Destrutivas causam um desastre no laboratório na hora em que surgem e deixam danos para consertar.' },
    { t: 'Instabilidade', p: 'Cada mutação soma instabilidade. Temas que a espécie adora pesam menos; temas que ela odeia pesam mais e podem ser rejeitados. Combinações de temas formam sinergias, que podem acalmar ou agitar a cobaia. Aos 100 por cento, ela colapsa de forma espetacular, e você recebe créditos pela bizarrice acumulada.' },
    { t: 'Contratos', p: 'Clientes excêntricos pedem cobaias com características específicas. Quando a cobaia cumpre os requisitos, entregue pelo quadro de contratos. Bônus opcionais pagam a mais. Contratos dão créditos e reputação, e a reputação libera itens melhores na loja.' },
    { t: 'Prateleira e Mutapédia', p: 'Cobaias que você quiser guardar podem ser conservadas em potes na prateleira do fundo. A Mutapédia registra cada mutação descoberta por espécie, as sinergias e os colapsos. Marcos de descoberta dão recompensas.' },
    { t: 'Códigos de cepa', p: 'Todo vírus tem um código. Copie para guardar ou compartilhar, e cole na máquina para recriar a mesma cepa.' },
    { t: 'Atalhos', p: 'Espaço: sintetizar ou injetar. 1 a 6: escolher encaixe. C: Mutapédia. K: contratos. L: loja. P: foto. F: tela cheia. Esc: pausa. Arraste a cobaia para girá-la.' },
  ];

  MX.Words = {
    SUBJECT_NAMES, TITLES_M, TITLES_F, TRAITS, ROBOT_MODELS,
    VIRUS_NOUNS, VIRUS_ADJS, QUIPS, SPEECH,
    CLIENT_FIRST, CLIENT_LAST, PROFESSIONS, GREETINGS, CLOSINGS, DELIVERY_HAPPY, DELIVERY_OK,
    RETIRE, HINTS, HELP,
  };
  if (typeof module === 'object' && module.exports) module.exports = MX.Words;
})(typeof window !== 'undefined' ? window : globalThis);
