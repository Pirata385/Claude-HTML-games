/* Mutatrix: dados do jogo (temas, capsídeos, espécies, arquétipos de mutação, sinergias, colapsos, loja). Lógica pura. */
(function (root) {
  'use strict';
  const MX = root.MX || (root.MX = {});

  // ---------------------------------------------------------------- temas
  // A ordem importa: o índice (1..12) entra no código compartilhável das cepas.
  const THEMES = [
    {
      id: 'igneo', name: 'Ígneo', adj: { ms: 'Ígneo', fs: 'Ígnea', mp: 'Ígneos', fp: 'Ígneas' },
      comp: ['de Brasa', 'de Lava', 'de Fornalha', 'de Pavio Curto'],
      color: '#ef7d57', color2: '#ffcd75', particle: 'fire', partName: 'faíscas de brasa', danger: 'fireball', event: 'incendio',
      bias: { parte: 1, corpo: 1, comportamento: 1.1 }, start: true,
      flavor: ['Tudo ao redor cheira levemente a churrasco de domingo.', 'A temperatura da câmara subiu três graus e meio.', 'O termômetro pediu demissão.', 'Há fumaça, mas ninguém sabe de onde vem.'],
    },
    {
      id: 'aquatico', name: 'Aquático', adj: { ms: 'Aquático', fs: 'Aquática', mp: 'Aquáticos', fp: 'Aquáticas' },
      comp: ['de Maré', 'de Aquário', 'de Poça', 'das Profundezas'],
      color: '#41a6f6', color2: '#73eff7', particle: 'bubble', partName: 'bolhas', danger: 'acid', event: 'inundacao',
      bias: { parte: 1.2, corpo: 1, comportamento: 0.9 }, start: true,
      flavor: ['Pinga. Sempre pinga.', 'Um leve cheiro de maresia tomou conta do laboratório.', 'O chão da câmara ficou escorregadio sem motivo aparente.', 'Às vezes faz um barulho de onda quebrando.'],
    },
    {
      id: 'eletrico', name: 'Elétrico', adj: { ms: 'Elétrico', fs: 'Elétrica', mp: 'Elétricos', fp: 'Elétricas' },
      comp: ['de Faísca', 'de Tomada', 'de Alta Voltagem', 'de Curto-Circuito'],
      color: '#ffe066', color2: '#fff7c2', particle: 'spark', partName: 'faíscas elétricas', danger: 'zap', event: 'blecaute',
      bias: { parte: 0.9, corpo: 0.9, comportamento: 1.3 }, start: true,
      flavor: ['Os pelos do braço de quem chega perto ficam em pé.', 'As lâmpadas piscam em código Morse quando a cobaia respira.', 'O rádio do laboratório passou a pegar uma estação da Bulgária.', 'Cheiro de tomada queimada, mas no bom sentido.'],
    },
    {
      id: 'vegetal', name: 'Vegetal', adj: { ms: 'Vegetal', fs: 'Vegetal', mp: 'Vegetais', fp: 'Vegetais' },
      comp: ['de Jardim', 'de Samambaia', 'de Horta', 'de Mato Alto'],
      color: '#38b764', color2: '#a7f070', particle: 'leaf', partName: 'esporos e folhinhas', danger: 'thorn', event: 'trepadeiras',
      bias: { parte: 1.3, corpo: 1, comportamento: 0.7 }, start: true,
      flavor: ['Brotou um trevo de quatro folhas no prato giratório.', 'Faz fotossíntese nas horas vagas.', 'Um leve aroma de terra molhada pairou no ar.', 'Os vasos de planta do laboratório parecem estar com ciúmes.'],
    },
    {
      id: 'osseo', name: 'Ósseo', adj: { ms: 'Ósseo', fs: 'Óssea', mp: 'Ósseos', fp: 'Ósseas' },
      comp: ['de Cálcio', 'de Tutano', 'de Esqueleto', 'de Fêmur'],
      color: '#efe3c8', color2: '#bba98a', particle: 'bone', partName: 'lascas de osso', danger: 'bone', event: 'terremoto',
      bias: { parte: 1.3, corpo: 1.1, comportamento: 0.6 }, start: true,
      flavor: ['Range como porta velha quando se mexe.', 'O cálcio da região inteira foi requisitado.', 'Dá para ouvir os ossos estalando de longe.', 'Um cachorro na rua começou a latir sem parar.'],
    },
    {
      id: 'musical', name: 'Musical', adj: { ms: 'Musical', fs: 'Musical', mp: 'Musicais', fp: 'Musicais' },
      comp: ['de Vibrafone', 'de Bossa Nova', 'de Serenata', 'de Pandeiro'],
      color: '#ff77a8', color2: '#8a5cc9', particle: 'note', partName: 'notas musicais', danger: 'sound', event: 'onda',
      bias: { parte: 0.8, corpo: 0.8, comportamento: 1.5 }, start: true,
      flavor: ['Tudo vem acompanhado de uma trilha sonora discreta.', 'Cada movimento soa como uma nota de vibrafone.', 'Afinado em Ré maior, segundo o diapasão.', 'Os vizinhos pediram bis.'],
    },
    {
      id: 'cosmico', name: 'Cósmico', adj: { ms: 'Cósmico', fs: 'Cósmica', mp: 'Cósmicos', fp: 'Cósmicas' },
      comp: ['de Nebulosa', 'de Meteoro', 'de Outra Galáxia', 'de Buraco de Minhoca'],
      color: '#8a5cc9', color2: '#29366f', particle: 'star', partName: 'poeira de estrela', danger: 'star', event: 'buraco',
      bias: { parte: 1, corpo: 1, comportamento: 1.2 }, start: false,
      flavor: ['Há pontinhos de estrela onde antes havia só cobaia.', 'Parece saber coisas sobre o universo que preferia não saber.', 'Ao fundo, um zumbido de rádio de outra galáxia.', 'A gravidade ao redor ficou meio preguiçosa.'],
    },
    {
      id: 'cristalino', name: 'Cristalino', adj: { ms: 'Cristalino', fs: 'Cristalina', mp: 'Cristalinos', fp: 'Cristalinas' },
      comp: ['de Quartzo', 'de Lustre', 'de Geodo', 'de Vitral'],
      color: '#73eff7', color2: '#e6fdff', particle: 'shard', partName: 'cristaizinhos', danger: 'shard', event: 'cristais',
      bias: { parte: 1.3, corpo: 1.1, comportamento: 0.6 }, start: false,
      flavor: ['Tilinta como lustre de vó a cada passo.', 'Refrata a luz da luminária em pequenos arco-íris.', 'Brilha. Brilha muito. Brilha demais.', 'Fica lindo contra a luz e péssimo de abraçar.'],
    },
    {
      id: 'sombrio', name: 'Sombrio', adj: { ms: 'Sombrio', fs: 'Sombria', mp: 'Sombrios', fp: 'Sombrias' },
      comp: ['de Porão', 'de Meia-Noite', 'de Breu', 'de Assombração'],
      color: '#4a3a6b', color2: '#5d275d', particle: 'shadow', partName: 'fiapos de sombra', danger: 'claw', event: 'sombras',
      bias: { parte: 1.1, corpo: 0.9, comportamento: 1.1 }, start: false,
      flavor: ['A luz da câmara parece ter medo de chegar perto.', 'Sussurros em latim ruim saem de algum lugar.', 'A sombra da cobaia às vezes vai para o lado errado.', 'Ninguém gosta de ficar sozinho com isso à noite.'],
    },
    {
      id: 'gasoso', name: 'Gasoso', adj: { ms: 'Gasoso', fs: 'Gasosa', mp: 'Gasosos', fp: 'Gasosas' },
      comp: ['de Vapor', 'de Neblina', 'de Arroto', 'de Gás Hilariante'],
      color: '#a7f070', color2: '#e2ffc0', particle: 'puff', partName: 'nuvenzinhas verdes', danger: 'puff', event: 'nevoa',
      bias: { parte: 0.8, corpo: 1.2, comportamento: 1.2 }, start: false,
      flavor: ['Exala um vapor esverdeado com cheiro de bala de menta.', 'Flutua um pouquinho depois do almoço.', 'Os alarmes de fumaça estão confusos.', 'Arrota em intervalos regulares, com elegância.'],
    },
    {
      id: 'magnetico', name: 'Magnético', adj: { ms: 'Magnético', fs: 'Magnética', mp: 'Magnéticos', fp: 'Magnéticas' },
      comp: ['de Ímã', 'de Bússola', 'de Limalha', 'de Polo Norte'],
      color: '#b13e53', color2: '#3b5dc9', particle: 'iron', partName: 'limalha de ferro', danger: 'tool', event: 'imas',
      bias: { parte: 1, corpo: 1.2, comportamento: 1 }, start: false,
      flavor: ['Os clipes de papel do laboratório migraram em sua direção.', 'A bússola do estagiário agora aponta para cá.', 'Grudou na geladeira duas vezes hoje.', 'Atrai tampinhas de garrafa e olhares curiosos.'],
    },
    {
      id: 'acucarado', name: 'Açucarado', adj: { ms: 'Açucarado', fs: 'Açucarada', mp: 'Açucarados', fp: 'Açucaradas' },
      comp: ['de Quermesse', 'de Pudim', 'de Algodão-Doce', 'de Brigadeiro'],
      color: '#ffaad4', color2: '#fff1d6', particle: 'sprinkle', partName: 'confeitos coloridos', danger: 'syrup', event: 'granulado',
      bias: { parte: 1, corpo: 1.2, comportamento: 1 }, start: false,
      flavor: ['Tem gosto de pudim, segundo um estagiário que não deveria ter provado.', 'As formigas do prédio estão organizando uma excursão.', 'Solta um aroma de algodão-doce de quermesse.', 'Brilha como cobertura de bolo de aniversário.'],
    },
  ];

  const DANGER_TEXT = {
    igneo: 'Cospe bolas de fogo no vidro da câmara de tempos em tempos.',
    aquatico: 'Esguicha um líquido ácido que corrói o vidro.',
    eletrico: 'Solta descargas elétricas capazes de derrubar um disjuntor.',
    vegetal: 'Lança espinhos com uma pontaria assustadora.',
    osseo: 'Dispara lascas de osso como dardos.',
    musical: 'Emite agudos capazes de trincar vidro temperado.',
    cosmico: 'Arremessa minúsculas estrelas cadentes contra as paredes.',
    cristalino: 'Atira estilhaços de cristal afiados como bisturi.',
    sombrio: 'Garras de sombra arranham o vidro durante a noite. E durante o dia.',
    gasoso: 'Solta baforadas tóxicas que embaçam e mancham a câmara.',
    magnetico: 'Puxa ferramentas da bancada e as arremessa contra o vidro.',
    acucarado: 'Cospe calda quente e grudenta. Cheira bem, queima mal.',
  };

  // ---------------------------------------------------------------- eventos destrutivos (um por tema)
  const EVENTS = {
    incendio: { name: 'Incêndio de Bancada', dur: 5.5, damage: 40, desc: 'Labaredas lamberam a bancada. O extintor finalmente saiu da caixa.' },
    inundacao: { name: 'Inundação Relâmpago', dur: 6, damage: 45, desc: 'A água subiu até os joelhos e desceu pelo ralo levando três canetas.' },
    blecaute: { name: 'Blecaute Geral', dur: 5, damage: 35, desc: 'Todas as luzes do prédio apagaram. Só a cobaia brilhava, satisfeita.' },
    trepadeiras: { name: 'Selva Instantânea', dur: 6, damage: 35, desc: 'Trepadeiras tomaram as paredes. Um macaco imaginário foi avistado.' },
    terremoto: { name: 'Terremoto de Ossos', dur: 4.5, damage: 50, desc: 'O chão tremeu e choveu osso do teto. O sismógrafo pediu férias.' },
    onda: { name: 'Onda Sonora Estilhaçante', dur: 4.5, damage: 45, desc: 'Um agudo perfeito estilhaçou vidros, potes e o orgulho do tenor do terceiro andar.' },
    buraco: { name: 'Miniburaco Negro', dur: 6, damage: 60, desc: 'Um buraco negro do tamanho de uma laranja engoliu papéis, clipes e uma segunda-feira inteira.' },
    cristais: { name: 'Cristalização do Laboratório', dur: 5.5, damage: 40, desc: 'Cristais brotaram das paredes. Lindo, caro de remover.' },
    sombras: { name: 'Sombras Famintas', dur: 5.5, damage: 40, desc: 'Sombras vivas comeram a luz das lâmpadas e um sanduíche de mortadela.' },
    nevoa: { name: 'Névoa Psicodélica', dur: 6, damage: 25, desc: 'Uma névoa colorida encheu a sala. Todos viram cores que não existem.' },
    imas: { name: 'Tempestade Magnética', dur: 5, damage: 45, desc: 'Ferramentas voaram pela sala e grudaram na câmara. A chave inglesa ainda está lá.' },
    granulado: { name: 'Chuva de Granulado', dur: 5.5, damage: 30, desc: 'Choveu granulado colorido. A faxina vai levar uma semana. As formigas agradecem.' },
  };

  // ---------------------------------------------------------------- capsídeos
  const CAPSIDS = [
    { id: 'icosaedro', name: 'Icosaedro', desc: 'O clássico. Vinte faces, nenhuma surpresa. Quase nenhuma.', bias: { parte: 1, corpo: 1, comportamento: 1 }, sev: 0, chaos: 0, stab: 1, partScale: 1, start: true },
    { id: 'helice', name: 'Hélice', desc: 'Espiralado e inquieto. Prefere mexer no comportamento.', bias: { parte: 0.6, corpo: 0.7, comportamento: 1.9 }, sev: 0, chaos: 5, stab: 1, partScale: 1, start: true },
    { id: 'bacteriofago', name: 'Bacteriófago', desc: 'Parece um módulo lunar com pernas. Adora acrescentar partes.', bias: { parte: 2.1, corpo: 0.6, comportamento: 0.5 }, sev: 0.05, chaos: 0, stab: 1, partScale: 1, start: true },
    { id: 'gota', name: 'Gota', desc: 'Gentil e estável. Mutações mais brandas, instabilidade menor.', bias: { parte: 1, corpo: 1, comportamento: 1 }, sev: -0.35, chaos: 0, stab: 0.75, partScale: 0.9, start: true },
    { id: 'envelopado', name: 'Envelopado', desc: 'Embrulhado numa membrana gordurosa. Mexe no corpo inteiro.', bias: { parte: 0.6, corpo: 2.1, comportamento: 0.7 }, sev: 0, chaos: 0, stab: 1, partScale: 1, start: false },
    { id: 'estrela', name: 'Estrela', desc: 'Cinco pontas, zero modéstia. Partes maiores e mais numerosas.', bias: { parte: 1.7, corpo: 0.8, comportamento: 0.8 }, sev: 0.1, chaos: 0, stab: 1.05, partScale: 1.35, start: false },
    { id: 'fractal', name: 'Fractal', desc: 'Cada pedaço dele é um vírus menor. O Caos sobe sozinho.', bias: { parte: 1, corpo: 1, comportamento: 1 }, sev: 0.1, chaos: 35, stab: 1.1, partScale: 1, start: false },
    { id: 'cubo', name: 'Cubo Impossível', desc: 'Tem mais arestas do que a geometria permite. Atrai desastres.', bias: { parte: 1, corpo: 1, comportamento: 1 }, sev: 0.45, chaos: 10, stab: 1.2, partScale: 1.1, destroy: 1, start: false },
  ];

  // ---------------------------------------------------------------- espécies
  const HOSTS = [
    {
      id: 'rato', name: 'Rato de Laboratório', short: 'Rato', cost: 10, tol: 1.0, skin: 'fur',
      likes: ['musical', 'acucarado', 'vegetal'], dislikes: ['aquatico', 'sombrio'],
      desc: 'Pequeno, curioso e com um currículo extenso em ciência. Tolerância média.',
    },
    {
      id: 'robo', name: 'Robô Biomecânico', short: 'Robô', cost: 25, tol: 0.8, skin: 'metal',
      likes: ['eletrico', 'magnetico', 'cristalino'], dislikes: ['aquatico', 'vegetal'],
      desc: 'Metade engrenagem, metade coração pulsante. Aguenta mais doses que os outros.',
    },
    {
      id: 'planta', name: 'Planta', short: 'Planta', cost: 8, tol: 1.1, skin: 'leaf',
      likes: ['vegetal', 'aquatico', 'acucarado'], dislikes: ['igneo', 'sombrio'],
      desc: 'Uma samambaia de bulbo simpático que nunca reclama. Por enquanto.',
    },
    {
      id: 'ameba', name: 'Ameba', short: 'Ameba', cost: 5, tol: 1.3, skin: 'gel',
      likes: ['aquatico', 'gasoso', 'cosmico'], dislikes: ['osseo', 'eletrico'],
      desc: 'Uma gota de gelatina com opinião própria. Barata, porém instável.',
    },
  ];

  // ---------------------------------------------------------------- classes de mutação
  const SEVS = [
    { id: 'inofensiva', name: 'Inofensiva', instab: 8, biz: 5, color: '#38b764' },
    { id: 'bizarra', name: 'Bizarra', instab: 15, biz: 12, color: '#8a5cc9' },
    { id: 'perigosa', name: 'Perigosa', instab: 22, biz: 18, color: '#ef7d57' },
    { id: 'destrutiva', name: 'Destrutiva', instab: 30, biz: 26, color: '#b13e53' },
  ];

  // ---------------------------------------------------------------- arquétipos
  // g: gênero e número do substantivo (ms, fs, mp, fp) para concordar o adjetivo do tema.
  // {c} = nome da cobaia, {n} = quantidade, {pat} = estampa, {part} = partículas do tema.
  const ARCH = [
    // ---- partes
    { id: 'olhos', group: 'parte', noun: 'Olhos Extras', g: 'mp', part: 'eye', count: [2, 5], themes: ['cosmico', 'sombrio', 'cristalino'], sev: 0, desc: ['{c} ganhou {n} olhos novos, que agora discordam entre si sobre o que estão vendo.', 'Brotaram {n} olhos em lugares pouco convencionais. Todos piscam fora de sincronia.'] },
    { id: 'olhao', group: 'parte', noun: 'Olho Gigante', g: 'ms', part: 'bigeye', count: [1, 1], themes: ['cosmico', 'sombrio'], sev: 0.05, desc: ['Um único olho enorme se abriu e encara fixamente quem estiver segurando a prancheta.', 'O olho novo de {c} é do tamanho de um pires e tem pupila de cabra.'] },
    { id: 'tentaculos', group: 'parte', noun: 'Tentáculos', g: 'mp', part: 'tentacle', count: [2, 4], themes: ['aquatico', 'sombrio', 'cosmico'], sev: 0.1, desc: ['{n} tentáculos saíram de {c} e já tentam abrir a tampa da câmara.', 'Tentáculos ondulantes, {n} ao todo, que dão tchauzinho para as visitas.'] },
    { id: 'asas', group: 'parte', noun: 'Asas', g: 'fp', part: 'wing', count: [2, 2], themes: ['gasoso', 'cosmico', 'acucarado', 'eletrico'], sev: 0, desc: ['Um par de asas surgiu nas costas. Ainda não voam, mas fazem muito vento.', '{c} agora tem asas e uma autoestima consideravelmente maior.'] },
    { id: 'chifres', group: 'parte', noun: 'Chifres', g: 'mp', part: 'horn', count: [1, 3], themes: ['osseo', 'igneo', 'sombrio'], sev: 0.1, desc: ['Chifres curvos despontaram da cabeça e deram a {c} um ar de vilão de novela.', '{n} chifres pontudos. O estagiário já usou um como cabide.'] },
    { id: 'espinhos', group: 'parte', noun: 'Espinhos', g: 'mp', part: 'spikes', count: [6, 12], themes: ['osseo', 'vegetal', 'cristalino'], sev: 0.2, desc: ['O corpo de {c} se cobriu de espinhos. Carinho, só com luvas de solda.', 'Espinhos por todo lado, como um cacto que decidiu ser ouriço.'] },
    { id: 'antenas', group: 'parte', noun: 'Antenas', g: 'fp', part: 'antenna', count: [2, 3], themes: ['eletrico', 'cosmico', 'magnetico'], sev: -0.1, desc: ['Antenas finas com bolinhas na ponta. Captam rádio AM e fofoca.', '{n} antenas surgiram e agora sintonizam um programa de auditório em mono.'] },
    { id: 'boca', group: 'parte', noun: 'Boca Extra', g: 'fs', part: 'mouth', count: [1, 2], themes: ['sombrio', 'acucarado', 'musical'], sev: 0.1, desc: ['Uma boca nova se abriu na lateral e não para de comentar o clima.', 'A boca extra tem dentes demais e opinião demais.'] },
    { id: 'cauda', group: 'parte', noun: 'Cauda Extra', g: 'fs', part: 'tail', count: [1, 2], themes: ['igneo', 'aquatico', 'eletrico'], sev: -0.05, desc: ['Uma cauda adicional brotou e balança de alegria, sem motivo algum.', '{c} ganhou mais uma cauda, que parece ter vontade própria.'] },
    { id: 'bracinhos', group: 'parte', noun: 'Bracinhos', g: 'mp', part: 'arms', count: [2, 4], themes: ['musical', 'magnetico', 'acucarado'], sev: -0.1, desc: ['{n} bracinhos minúsculos surgiram e acenam para todo mundo como em desfile.', 'Bracinhos curtos demais para alcançar qualquer coisa útil, mas ótimos para aplaudir.'] },
    { id: 'cristais', group: 'parte', noun: 'Cristais', g: 'mp', part: 'crystals', count: [3, 6], themes: ['cristalino', 'cosmico', 'eletrico'], sev: 0, desc: ['Cristais facetados cresceram nas costas e refratam a luz em arco-íris.', 'Brotaram {n} cristais que zumbem quando alguém fala alto.'] },
    { id: 'flores', group: 'parte', noun: 'Flores', g: 'fp', part: 'flowers', count: [3, 6], themes: ['vegetal', 'acucarado', 'musical'], sev: -0.2, desc: ['{c} floresceu. Literalmente. {n} flores se abriram de uma vez.', 'Flores coloridas surgiram e atraem abelhas que nem existem nesta região.'] },
    { id: 'cogumelos', group: 'parte', noun: 'Cogumelos', g: 'mp', part: 'mushrooms', count: [2, 5], themes: ['vegetal', 'sombrio', 'gasoso'], sev: 0, desc: ['Uma pequena colônia de cogumelos se instalou nas costas e já elegeu síndico.', '{n} cogumelos brotaram. Não, não pode comer.'] },
    { id: 'barbatanas', group: 'parte', noun: 'Barbatanas', g: 'fp', part: 'fin', count: [1, 3], themes: ['aquatico', 'cristalino'], sev: -0.05, desc: ['Barbatanas surgiram. {c} agora nada no seco com muita convicção.', 'As barbatanas novas abanam como se o laboratório fosse um aquário.'] },
    { id: 'carapaca', group: 'parte', noun: 'Carapaça', g: 'fs', part: 'shell', count: [1, 1], themes: ['osseo', 'cristalino', 'magnetico'], sev: 0, desc: ['Uma carapaça de placas cobriu as costas. Parece uma tartaruga que fez academia.', 'A carapaça nova é resistente a impactos e a críticas.'] },
    { id: 'juba', group: 'parte', noun: 'Juba', g: 'fs', part: 'mane', count: [1, 1], themes: ['igneo', 'eletrico', 'musical'], sev: -0.05, desc: ['Uma juba volumosa cresceu ao redor da cabeça. Está sempre ao vento, mesmo sem vento.', '{c} agora ostenta uma juba digna de vocalista de banda de rock.'] },
    { id: 'crista', group: 'parte', noun: 'Crista', g: 'fs', part: 'crest', count: [1, 1], themes: ['igneo', 'aquatico', 'musical'], sev: -0.05, desc: ['Uma crista recortada surgiu no topo, como a de um galo que leu ficção científica.', 'A crista nova muda de tom conforme o humor.'] },
    { id: 'guelras', group: 'parte', noun: 'Guelras', g: 'fp', part: 'gills', count: [1, 1], themes: ['aquatico', 'gasoso'], sev: -0.05, desc: ['Guelras se abriram nas laterais. {c} respira melhor debaixo d’água do que de mau humor.', 'As guelras fazem um barulhinho de chaleira quando abrem.'] },
    { id: 'chamine', group: 'parte', noun: 'Chaminé', g: 'fs', part: 'chimney', count: [1, 1], themes: ['igneo', 'gasoso', 'magnetico'], sev: 0.05, desc: ['Uma chaminé de tijolinhos surgiu nas costas e solta fumaça a cada pensamento.', 'A chaminé nova funciona. Ninguém sabe o que está sendo queimado lá dentro.'] },
    { id: 'helice', group: 'parte', noun: 'Hélice', g: 'fs', part: 'propeller', count: [1, 1], themes: ['gasoso', 'eletrico', 'magnetico'], sev: -0.05, desc: ['Uma hélice brotou no topo e gira sem parar, como chapéu de festa junina futurista.', 'A hélice gira mais rápido sempre que alguém chega perto.'] },
    { id: 'altofalante', group: 'parte', noun: 'Alto-Falante', g: 'ms', part: 'speaker', count: [1, 1], themes: ['musical', 'eletrico'], sev: 0, desc: ['Um alto-falante orgânico cresceu no peito e toca o que {c} estiver pensando.', 'O alto-falante novo tem graves impressionantes para um órgão biológico.'] },
    { id: 'lampada', group: 'parte', noun: 'Cogumelos-Lâmpada', g: 'mp', part: 'lamp', count: [1, 3], themes: ['eletrico', 'cosmico', 'vegetal'], sev: -0.1, desc: ['Cogumelos que acendem como lâmpadas de mesa. Economizam energia, gastam sanidade.', '{n} cogumelos luminosos surgiram e já servem de abajur.'] },
    { id: 'cabeca', group: 'parte', noun: 'Segunda Cabeça', g: 'fs', part: 'head2', count: [1, 1], themes: ['sombrio', 'musical', 'cosmico'], sev: 0.15, desc: ['Uma segunda cabeça brotou. As duas já discutem sobre quem manda.', 'A cabeça extra tem personalidade própria e um sotaque esquisito.'] },
    { id: 'pelos', group: 'parte', noun: 'Pelos Absurdos', g: 'mp', part: 'hair', count: [1, 1], themes: ['eletrico', 'acucarado', 'igneo'], sev: -0.1, desc: ['Os pelos cresceram meio metro em uma hora. {c} parece um espanador de luxo.', 'Uma cabeleira longa e ondulada surgiu. Precisa de condicionador industrial.'] },
    { id: 'presas', group: 'parte', noun: 'Presas', g: 'fp', part: 'fangs', count: [1, 1], themes: ['sombrio', 'osseo', 'igneo'], sev: 0.35, desc: ['Presas afiadas surgiram. {c} sorri muito mais do que antes, e isso preocupa.', 'As presas novas brilham sob a luz da luminária.'] },
    { id: 'ferrao', group: 'parte', noun: 'Ferrão', g: 'ms', part: 'stinger', count: [1, 1], themes: ['eletrico', 'sombrio', 'gasoso'], sev: 0.35, desc: ['Um ferrão comprido surgiu na traseira. Pinga algo que corrói a bancada.', 'O ferrão novo vibra quando alguém se aproxima com a prancheta.'] },
    // ---- corpo
    { id: 'gigante', group: 'corpo', noun: 'Gigantismo', g: 'ms', body: 'giant', themes: ['osseo', 'cosmico', 'vegetal'], sev: 0.05, desc: ['{c} cresceu bastante. A câmara ficou apertada e o ego também.', 'Agora é uma versão bem maior de si. Come em dobro e ocupa o triplo.'] },
    { id: 'nanismo', group: 'corpo', noun: 'Nanismo', g: 'ms', body: 'tiny', themes: ['cristalino', 'acucarado', 'magnetico'], sev: -0.1, desc: ['{c} encolheu. Cabe numa xícara de café, e já tentou entrar numa.', 'Virou miniatura. Os estagiários estão encantados.'] },
    { id: 'cor', group: 'corpo', noun: 'Recoloração', g: 'fs', body: 'color', themes: ['acucarado', 'musical', 'igneo', 'aquatico', 'vegetal'], sev: -0.2, desc: ['A cor mudou por completo. {c} agora combina com as cortinas da sala da diretoria.', 'Uma cor nova tomou o corpo inteiro, do focinho ao último átomo.'] },
    { id: 'padrao', group: 'corpo', noun: 'Estampa', g: 'fs', body: 'pattern', themes: ['musical', 'acucarado', 'eletrico'], sev: -0.15, desc: ['Surgiram {pat} pelo corpo, como se {c} tivesse saído de uma loja de tecidos.', 'O corpo agora é decorado com {pat}. Elegante demais para um experimento.'] },
    { id: 'transparencia', group: 'corpo', noun: 'Transparência', g: 'fs', body: 'clear', themes: ['aquatico', 'cristalino', 'gasoso'], sev: 0, desc: ['O corpo de {c} ficou translúcido. Dá para ver o almoço sendo digerido.', 'O corpo ficou transparente como gelatina de festa.'] },
    { id: 'brilho', group: 'corpo', noun: 'Bioluminescência', g: 'fs', body: 'glow', themes: ['cosmico', 'eletrico', 'aquatico'], sev: -0.1, desc: ['O corpo passou a brilhar no escuro. Ótimo para economizar na conta de luz.', 'Brilha suavemente, como um vaga-lume que estudou iluminação de palco.'] },
    { id: 'metal', group: 'corpo', noun: 'Metalização', g: 'fs', body: 'metal', themes: ['magnetico', 'eletrico', 'cristalino'], sev: 0, desc: ['A pele virou metal polido. Ecoa quando batem nela.', 'O corpo de {c} metalizou e agora reflete as próprias caretas.'] },
    { id: 'pedra', group: 'corpo', noun: 'Petrificação Parcial', g: 'fs', body: 'stone', themes: ['osseo', 'cristalino', 'sombrio'], sev: 0.1, desc: ['Partes do corpo viraram pedra. {c} se move com a graça de uma estátua de praça.', 'Petrificou pela metade. A outra metade está bastante preocupada.'] },
    { id: 'balao', group: 'corpo', noun: 'Inflação', g: 'fs', body: 'balloon', themes: ['gasoso', 'acucarado'], sev: 0.05, desc: ['{c} inflou como um balão de festa e agora quica levemente.', 'Cheio de ar, redondo e com risco moderado de estourar.'] },
    { id: 'esticado', group: 'corpo', noun: 'Alongamento', g: 'ms', body: 'stretch', themes: ['magnetico', 'musical', 'vegetal'], sev: 0, desc: ['O corpo esticou como massa de pastel. Comprido, mas ainda simpático.', '{c} se alongou, como se tivesse sido puxado por dois lados ao mesmo tempo.'] },
    { id: 'achatado', group: 'corpo', noun: 'Achatamento', g: 'ms', body: 'squash', themes: ['osseo', 'magnetico', 'gasoso'], sev: 0, desc: ['O corpo achatou, como se {c} tivesse passado a noite debaixo de uma enciclopédia.', 'Largo e baixinho. Ótimo para servir de peso de papel.'] },
    // ---- comportamento
    { id: 'flutuar', group: 'comportamento', noun: 'Levitação', g: 'fs', beh: 'float', themes: ['gasoso', 'cosmico', 'magnetico'], sev: 0, desc: ['{c} começou a flutuar alguns centímetros acima do prato. Desafia a física e o bom senso.', 'Levita suavemente, como quem não tem boleto para pagar.'] },
    { id: 'saltitar', group: 'comportamento', noun: 'Saltitância', g: 'fs', beh: 'hop', themes: ['eletrico', 'acucarado', 'musical'], sev: -0.1, desc: ['Não para de saltitar. Parece ter tomado três cafés seguidos.', '{c} quica pelo prato como uma bolinha de pingue-pongue.'] },
    { id: 'dancar', group: 'comportamento', noun: 'Dança Compulsiva', g: 'fs', beh: 'dance', themes: ['musical', 'eletrico', 'acucarado'], sev: -0.1, desc: ['{c} começou a dançar. O passinho é questionável, a energia é inegável.', 'Dança sem parar, sempre um pouco fora do ritmo da música.'] },
    { id: 'cantar', group: 'comportamento', noun: 'Canto Lírico', g: 'ms', beh: 'sing', themes: ['musical', 'cristalino', 'aquatico'], sev: -0.15, desc: ['{c} canta. Afinado. Em italiano. Ninguém sabe onde aprendeu.', 'Solta notas melodiosas que entram no ritmo do rádio do laboratório.'] },
    { id: 'falar', group: 'comportamento', noun: 'Fala Articulada', g: 'fs', beh: 'talk', themes: ['sombrio', 'musical', 'cosmico'], sev: 0, desc: ['{c} começou a falar. Tem opiniões fortes sobre a decoração do laboratório.', 'Fala pelos cotovelos, mesmo sem ter cotovelos.'] },
    { id: 'soluco', group: 'comportamento', noun: 'Soluço Crônico', g: 'ms', beh: 'hiccup', themes: ['gasoso', 'aquatico', 'acucarado'], sev: -0.1, desc: ['Soluça bolhas de sabão em intervalos irregulares.', '{c} soluça. Cada soluço solta uma bolha e um pedido de desculpas.'] },
    { id: 'clones', group: 'comportamento', noun: 'Mitose Parcial', g: 'fs', beh: 'clones', themes: ['cosmico', 'aquatico', 'vegetal'], sev: 0.1, desc: ['{n} miniaturas de {c} agora orbitam ao redor do original, como luas fofas.', 'Pequenas cópias de {c} giram em volta, imitando cada movimento.'] },
    { id: 'teleporte', group: 'comportamento', noun: 'Teletransporte', g: 'ms', beh: 'teleport', themes: ['cosmico', 'sombrio', 'eletrico'], sev: 0.1, desc: ['{c} some e reaparece em outro canto da câmara sem aviso prévio.', 'Teletransporta-se por curtas distâncias, sempre para longe da seringa.'] },
    { id: 'teto', group: 'comportamento', noun: 'Gravidade Invertida', g: 'fs', beh: 'ceiling', themes: ['cosmico', 'magnetico', 'gasoso'], sev: 0.05, desc: ['Para {c}, o chão agora é o teto. Fica de cabeça para baixo, muito à vontade.', 'A gravidade se inverteu só para {c}. O resto do laboratório segue normal.'] },
    { id: 'emitir', group: 'comportamento', noun: 'Emanação', g: 'fs', beh: 'emit', themes: ['igneo', 'aquatico', 'eletrico', 'vegetal', 'osseo', 'musical', 'cosmico', 'cristalino', 'sombrio', 'gasoso', 'magnetico', 'acucarado'], sev: -0.05, desc: ['{c} passou a soltar {part} o tempo todo, como uma máquina de efeitos especiais.', 'Uma nuvem constante de {part} acompanha cada movimento.'] },
    { id: 'tremor', group: 'comportamento', noun: 'Vibração Constante', g: 'fs', beh: 'vibrate', themes: ['eletrico', 'magnetico', 'musical'], sev: 0, desc: ['{c} vibra como um celular esquecido em cima da mesa.', 'Treme sem parar. Ótimo para bater vitamina.'] },
    { id: 'laser', group: 'comportamento', noun: 'Olhar Laser', g: 'ms', beh: 'laser', themes: ['igneo', 'eletrico', 'cosmico'], sev: 0.35, desc: ['Os olhos de {c} agora disparam raios laser. O vidro da câmara já tem marcas.', 'Um olhar fulminante, no sentido literal da palavra.'] },
    { id: 'giro', group: 'comportamento', noun: 'Rodopio', g: 'ms', beh: 'spin', themes: ['gasoso', 'musical', 'magnetico'], sev: 0, desc: ['{c} rodopia como pião em festa junina.', 'Gira sem parar e nunca fica com tontura.'] },
  ];

  const PATTERNS = [
    { id: 'listras', name: 'listras' }, { id: 'bolinhas', name: 'bolinhas' },
    { id: 'xadrez', name: 'quadradinhos de xadrez' }, { id: 'zigue', name: 'zigue-zagues' },
  ];

  // ---------------------------------------------------------------- sinergias
  const SYNERGIES = [
    { id: 'arroto', a: 'igneo', b: 'gasoso', name: 'Arroto Flamejante', instab: 6, desc: 'Cada arroto vira uma labareda. Divertido em festas, péssimo em bibliotecas.' },
    { id: 'dj', a: 'musical', b: 'eletrico', name: 'DJ Sináptico', instab: -4, desc: 'Os neurônios viraram mesa de som. Há batidas eletrônicas saindo dos poros.' },
    { id: 'xilofone', a: 'osseo', b: 'musical', name: 'Xilofone Costelar', instab: -5, desc: 'As costelas tocam escalas quando alguém passa a mão.' },
    { id: 'pomar', a: 'vegetal', b: 'acucarado', name: 'Pomar Glicêmico', instab: -6, desc: 'Brotam frutinhas cristalizadas. Quem faz dieta, mantenha distância.' },
    { id: 'vazio', a: 'cosmico', b: 'sombrio', name: 'Vazio Contemplativo', instab: 8, desc: 'Encara o nada. O nada encara de volta. Ambos parecem satisfeitos.' },
    { id: 'curto', a: 'aquatico', b: 'eletrico', name: 'Curto-Circuito Úmido', instab: 12, desc: 'Água e eletricidade juntas numa cobaia só. O disjuntor já fez as malas.' },
    { id: 'sino', a: 'cristalino', b: 'musical', name: 'Sino de Cristal', instab: -4, desc: 'Ressoa como um sino de catedral a cada movimento.' },
    { id: 'sauna', a: 'igneo', b: 'aquatico', name: 'Sauna Ambulante', instab: 4, desc: 'Solta vapor quente sem parar. Os óculos de todo mundo embaçaram.' },
    { id: 'bobina', a: 'magnetico', b: 'eletrico', name: 'Bobina Viva', instab: 6, desc: 'Gera campo eletromagnético suficiente para apagar fitas cassete.' },
    { id: 'jardim', a: 'vegetal', b: 'sombrio', name: 'Jardim Noturno', instab: -3, desc: 'Flores que só se abrem no escuro e cochicham segredos.' },
    { id: 'prisma', a: 'cosmico', b: 'cristalino', name: 'Prisma Astral', instab: -5, desc: 'Projeta constelações nas paredes. O planetário da cidade ficou com inveja.' },
    { id: 'algodao', a: 'gasoso', b: 'acucarado', name: 'Algodão-Doce Atmosférico', instab: -4, desc: 'Exala nuvens de algodão-doce. Tecnicamente comestíveis. Não comam.' },
    { id: 'armario', a: 'osseo', b: 'sombrio', name: 'Esqueleto no Armário', instab: 5, desc: 'Ganhou um ar assombrado. Dá sustos em quem abre as gavetas.' },
    { id: 'vitral', a: 'igneo', b: 'cristalino', name: 'Vitral Incandescente', instab: 3, desc: 'Os cristais derreteram em vitrais coloridos e quentinhos.' },
    { id: 'pantano', a: 'aquatico', b: 'vegetal', name: 'Pântano Portátil', instab: -6, desc: 'Carrega o próprio microecossistema, com sapos imaginários.' },
    { id: 'bussola', a: 'magnetico', b: 'cosmico', name: 'Bússola Galáctica', instab: -3, desc: 'Aponta sempre para uma estrela que ninguém consegue achar no mapa.' },
  ];

  // ---------------------------------------------------------------- colapsos
  const COLLAPSES = [
    { id: 'confete', name: 'Explosão de Confete Gosmento', w: 1.2, themes: { acucarado: 2, musical: 1.5 }, hosts: {}, desc: '{c} explodiu numa chuva de confete e gosma. Foi bonito. Foi nojento. Foi ciência.' },
    { id: 'derretimento', name: 'Derretimento', w: 1, themes: { igneo: 2.5, aquatico: 1.5 }, hosts: { ameba: 1.6 }, desc: '{c} derreteu numa poça colorida que ainda borbulha de vez em quando.' },
    { id: 'ascensao', name: 'Ascensão', w: 0.8, themes: { cosmico: 2, gasoso: 2.5 }, hosts: {}, desc: '{c} subiu pelo teto envolto em luz e nunca mais foi visto. Deixou um leve cheiro de lavanda.' },
    { id: 'fuga', name: 'Fuga pelo Duto', w: 0.8, themes: { sombrio: 2, eletrico: 1.3 }, hosts: { rato: 2.2 }, desc: '{c} fugiu pelo duto de ventilação. Dizem que hoje vive no porão e cobra aluguel dos outros ratos.' },
    { id: 'petrificacao', name: 'Petrificação Total', w: 0.8, themes: { osseo: 2.5, cristalino: 2 }, hosts: {}, desc: '{c} virou uma estátua tão bonita que ganhou lugar de honra na prateleira.' },
    { id: 'fusao', name: 'Fusão com a Mutatrix', w: 0.6, themes: { magnetico: 2.5, eletrico: 1.5 }, hosts: { robo: 2 }, desc: '{c} se fundiu à Mutatrix. A máquina ganhou um tentáculo e parece mais feliz.' },
    { id: 'implosao', name: 'Implosão Cósmica', w: 0.7, themes: { cosmico: 2.5, sombrio: 2 }, hosts: {}, desc: '{c} implodiu num pontinho de matéria escura do tamanho de um grão de feijão.' },
    { id: 'florescimento', name: 'Florescimento Total', w: 0.8, themes: { vegetal: 3, acucarado: 1.3 }, hosts: { planta: 2.2 }, desc: '{c} floresceu tanto que virou um canteiro. O jardineiro do prédio pediu uma muda.' },
    { id: 'curto', name: 'Curto-Circuito Final', w: 0.7, themes: { eletrico: 2.5, magnetico: 1.5 }, hosts: { robo: 2.5 }, desc: '{c} entrou em curto, soltou fumaça e desmontou em peças. O manual não cobria esta situação.' },
    { id: 'mitose', name: 'Mitose Infinita', w: 0.8, themes: { aquatico: 1.8, cosmico: 1.3 }, hosts: { ameba: 2.5 }, desc: '{c} se dividiu em dezenas de cópias que estouraram feito bolhas de sabão.' },
  ];

  // ---------------------------------------------------------------- loja
  // effect: { type, value } aplicado por MX.Economy.applyItem.
  const SHOP = [
    { id: 'slot4', cat: 'maquina', name: 'Quarto Encaixe Genético', desc: 'Mais um espaço na fita. Mais reagentes, mais mutações por dose.', price: 180, rep: 0, effect: { type: 'slots', value: 4 } },
    { id: 'slot5', cat: 'maquina', name: 'Quinto Encaixe Genético', desc: 'A fita fica comprida o suficiente para dar uma volta no pescoço.', price: 420, rep: 3, need: 'slot4', effect: { type: 'slots', value: 5 } },
    { id: 'slot6', cat: 'maquina', name: 'Sexto Encaixe Genético', desc: 'O limite físico da Mutatrix. Ou o limite do bom senso.', price: 850, rep: 8, need: 'slot5', effect: { type: 'slots', value: 6 } },
    { id: 'analisador2', cat: 'maquina', name: 'Analisador Espectral', desc: 'Antes de sintetizar, mostra a classe e o grupo de cada mutação.', price: 220, rep: 1, effect: { type: 'analyzer', value: 2 } },
    { id: 'analisador3', cat: 'maquina', name: 'Analisador Profético', desc: 'Revela exatamente quais mutações a cepa vai causar. Quase trapaça.', price: 650, rep: 6, need: 'analisador2', effect: { type: 'analyzer', value: 3 } },
    { id: 'blindada', cat: 'maquina', name: 'Câmara Blindada', desc: 'Vidro triplo com laminado de grafeno. Consertos custam metade.', price: 380, rep: 3, effect: { type: 'armored', value: 1 } },
    { id: 'estabilizador', cat: 'consumivel', name: 'Estabilizador', desc: 'Uma dose de calmante genético. Reduz 25 pontos de instabilidade.', price: 35, rep: 0, repeat: true, effect: { type: 'stabilizer', value: 1 } },
    { id: 'cap_envelopado', cat: 'capsideo', name: 'Capsídeo Envelopado', desc: 'Mexe no corpo inteiro: cor, tamanho, estampa, textura.', price: 150, rep: 0, effect: { type: 'capsid', value: 'envelopado' } },
    { id: 'cap_estrela', cat: 'capsideo', name: 'Capsídeo Estrela', desc: 'Partes maiores e mais numerosas. Para quem gosta de exagero.', price: 230, rep: 2, effect: { type: 'capsid', value: 'estrela' } },
    { id: 'cap_fractal', cat: 'capsideo', name: 'Capsídeo Fractal', desc: 'Caos embutido. Resultados imprevisíveis, inclusive para a máquina.', price: 320, rep: 4, effect: { type: 'capsid', value: 'fractal' } },
    { id: 'cap_cubo', cat: 'capsideo', name: 'Cubo Impossível', desc: 'Mutações graves e desastres frequentes. Recomendado para quem tem seguro.', price: 450, rep: 6, effect: { type: 'capsid', value: 'cubo' } },
    { id: 'tema_cosmico', cat: 'reagente', name: 'Reagente Cósmico', desc: 'Poeira de meteoro em frasco. Estrelas, olhos e levitação.', price: 140, rep: 0, effect: { type: 'theme', value: 'cosmico' } },
    { id: 'tema_gasoso', cat: 'reagente', name: 'Reagente Gasoso', desc: 'Vapor engarrafado. Balões, névoas e arrotos.', price: 120, rep: 0, effect: { type: 'theme', value: 'gasoso' } },
    { id: 'tema_acucarado', cat: 'reagente', name: 'Reagente Açucarado', desc: 'Calda concentrada de quermesse. Fofo, grudento e perigosamente feliz.', price: 120, rep: 1, effect: { type: 'theme', value: 'acucarado' } },
    { id: 'tema_cristalino', cat: 'reagente', name: 'Reagente Cristalino', desc: 'Pó de geodo. Brilho, cristais e sinos.', price: 150, rep: 1, effect: { type: 'theme', value: 'cristalino' } },
    { id: 'tema_sombrio', cat: 'reagente', name: 'Reagente Sombrio', desc: 'Breu destilado à meia-noite. Para experimentos de gosto duvidoso.', price: 170, rep: 2, effect: { type: 'theme', value: 'sombrio' } },
    { id: 'tema_magnetico', cat: 'reagente', name: 'Reagente Magnético', desc: 'Limalha com personalidade. Atração, metal e tempestades.', price: 170, rep: 3, effect: { type: 'theme', value: 'magnetico' } },
    { id: 'prateleira2', cat: 'decoracao', name: 'Prateleira Extra', desc: 'Mais quatro potes para conservar suas obras-primas.', price: 120, rep: 0, effect: { type: 'shelf', value: 8 } },
    { id: 'prateleira3', cat: 'decoracao', name: 'Estante de Museu', desc: 'Doze potes ao todo. O laboratório vira um museu de horrores fofos.', price: 260, rep: 4, need: 'prateleira2', effect: { type: 'shelf', value: 12 } },
    { id: 'dec_cartaz', cat: 'decoracao', name: 'Cartaz "Mute com Responsabilidade"', desc: 'Propaganda institucional impressa em risografia. Ninguém segue.', price: 60, rep: 0, effect: { type: 'decor', value: 'cartaz' } },
    { id: 'dec_luminaria', cat: 'decoracao', name: 'Luminária de Lava', desc: 'Bolhas lentas e hipnóticas. Ajuda a pensar em ideias perigosas.', price: 90, rep: 0, effect: { type: 'decor', value: 'luminaria' } },
    { id: 'dec_tapete', cat: 'decoracao', name: 'Tapete de Hexágonos', desc: 'Combina com tudo, principalmente com manchas de reagente.', price: 70, rep: 0, effect: { type: 'decor', value: 'tapete' } },
    { id: 'dec_radio', cat: 'decoracao', name: 'Rádio Valvulado Turquesa', desc: 'Deixa a bossa do laboratório mais quentinha. Literalmente: as válvulas esquentam.', price: 110, rep: 1, effect: { type: 'decor', value: 'radio' } },
    { id: 'dec_samambaia', cat: 'decoracao', name: 'Samambaia de Estimação', desc: 'Uma planta comum, sem mutações. Por enquanto.', price: 50, rep: 0, effect: { type: 'decor', value: 'samambaia' } },
    { id: 'dec_relogio', cat: 'decoracao', name: 'Relógio Atômico de Parede', desc: 'Marca a hora com precisão de um bilionésimo de segundo. Está sempre atrasado.', price: 80, rep: 0, effect: { type: 'decor', value: 'relogio' } },
  ];

  const SHOP_CATS = [
    { id: 'maquina', name: 'Máquina' }, { id: 'capsideo', name: 'Capsídeos' }, { id: 'reagente', name: 'Reagentes' },
    { id: 'consumivel', name: 'Consumíveis' }, { id: 'decoracao', name: 'Decoração' },
  ];

  // Marcos da Mutapédia: ao atingir N descobertas, o jogador recebe uma recompensa única.
  const MILESTONES = [
    { n: 10, credits: 100, text: '10 descobertas: bolsa de pesquisa de 100 créditos.' },
    { n: 25, stabilizers: 3, text: '25 descobertas: três Estabilizadores de cortesia.' },
    { n: 50, credits: 250, decor: 'trofeu', text: '50 descobertas: Troféu de Cientista Excêntrico e 250 créditos.' },
    { n: 100, credits: 500, text: '100 descobertas: verba extraordinária de 500 créditos.' },
    { n: 160, credits: 1000, decor: 'trofeu_ouro', text: '160 descobertas: Troféu Dourado e 1000 créditos.' },
  ];

  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

  MX.Data = {
    THEMES, THEME: byId(THEMES), DANGER_TEXT, EVENTS,
    CAPSIDS, CAPSID: byId(CAPSIDS),
    HOSTS, HOST: byId(HOSTS),
    SEVS, SEV: byId(SEVS),
    ARCH, ARCHS: byId(ARCH), PATTERNS,
    SYNERGIES, SYNERGY: byId(SYNERGIES),
    COLLAPSES, COLLAPSE: byId(COLLAPSES),
    SHOP, SHOP_ITEM: byId(SHOP), SHOP_CATS, MILESTONES,
    GROUPS: ['parte', 'corpo', 'comportamento'],
    GROUP_NAME: { parte: 'Parte nova', corpo: 'Corpo', comportamento: 'Comportamento' },
  };
  if (typeof module === 'object' && module.exports) module.exports = MX.Data;
})(typeof window !== 'undefined' ? window : globalThis);
