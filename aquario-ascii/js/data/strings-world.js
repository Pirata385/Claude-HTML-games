// Água-Tinta — world strings (owner B): sp.* sighting.* zone.* phase.* weather.* kind.* behavior.*
// sp.<id>.name / sp.<id>.flavor are localized; sp.<id>.pt is the pt-BR name in both languages (for the bestiary,
// which shows the Portuguese name in small text when the UI is in English).
(function (AQ) {
  'use strict';

  // id: [pt name, en name, pt flavour, en flavour]
  var SP = {
    manjuba: ['Manjuba', 'Anchovy',
      'Mil manjubas, um só pensamento: virar à esquerda.',
      'A thousand anchovies, one single thought: turn left.'],
    tainha: ['Tainha', 'Mullet',
      'Pula fora d\'água só para conferir se o céu ainda está lá.',
      'Leaps out of the water just to check the sky is still there.'],
    siri: ['Siri-azul', 'Blue crab',
      'Anda de lado para nunca dar as costas a ninguém.',
      'Walks sideways so it never has to turn its back on anyone.'],
    camarao: ['Camarão', 'Shrimp',
      'Nada para trás com muita convicção.',
      'Swims backwards with great conviction.'],
    baiacu: ['Baiacu', 'Pufferfish',
      'Quando contrariado, vira uma bola de opiniões espinhosas.',
      'When crossed, it turns into a ball of prickly opinions.'],
    arraia: ['Arraia', 'Stingray',
      'Enterra-se na areia e deixa só os olhos de fora. A cauda fica de lembrete.',
      'Buries itself in the sand and leaves only its eyes out. The tail stays as a reminder.'],
    agulha: ['Peixe-agulha', 'Needlefish',
      'Uma agulha com pressa e nenhuma linha.',
      'A needle in a hurry, with no thread.'],
    cavalo: ['Cavalo-marinho', 'Seahorse',
      'Quem carrega os filhotes é o pai. Ele não reclama — muito.',
      'The father carries the babies. He doesn\'t complain — much.'],
    ermitao: ['Ermitão-de-garrafa', 'Bottle hermit crab',
      'Trocou a concha por uma garrafa. Diz que a vista é melhor.',
      'Swapped its shell for a bottle. Says the view is better.'],
    tipografo: ['Peixe-tipógrafo', 'Typefish',
      'Escrito por alguém, em algum lugar. Ainda procura o fim da frase.',
      'Written by someone, somewhere. Still looking for the end of the sentence.'],
    palhaco: ['Peixe-palhaço', 'Clownfish',
      'Mora numa anêmona e paga o aluguel com piadas.',
      'Lives in an anemone and pays the rent in jokes.'],
    cirurgiao: ['Peixe-cirurgião', 'Surgeonfish',
      'Leva um bisturi na cauda e nenhum diploma na parede.',
      'Carries a scalpel on its tail and no diploma on the wall.'],
    papagaio: ['Peixe-papagaio', 'Parrotfish',
      'Come coral e devolve areia. A praia agradece.',
      'Eats coral and gives back sand. The beach says thanks.'],
    moreia: ['Moreia', 'Moray eel',
      'Abre e fecha a boca o dia inteiro. É só respiração. Quase sempre.',
      'Opens and closes its mouth all day. It\'s just breathing. Almost always.'],
    lagosta: ['Lagosta', 'Spiny lobster',
      'Armadura completa, antenas de radar e nenhum senso de humor.',
      'Full armour, radar antennae and no sense of humour.'],
    leao: ['Peixe-leão', 'Lionfish',
      'Lindo, venenoso e convidado por ninguém.',
      'Beautiful, venomous and invited by no one.'],
    polvo: ['Polvo', 'Octopus',
      'Oito braços, três corações e zero paciência para anzóis.',
      'Eight arms, three hearts and zero patience for hooks.'],
    sargo: ['Sargo', 'Sheepshead bream',
      'Tem dentes de gente e sorri para ninguém.',
      'Has human teeth and smiles at no one.'],
    cavalinha: ['Cavalinha', 'Mackerel',
      'Listras de tigre, coragem de sardinha.',
      'Tiger stripes, sardine courage.'],
    lula: ['Lula', 'Squid',
      'Some numa nuvem de tinta quando a conversa fica séria.',
      'Vanishes in a cloud of ink when the conversation gets serious.'],
    escorpiao: ['Peixe-escorpião', 'Scorpionfish',
      'Parece uma pedra. Pense duas vezes antes de sentar.',
      'Looks like a rock. Think twice before sitting down.'],
    congro: ['Congro', 'Conger eel',
      'Uma enguia que levou a sério a vida noturna.',
      'An eel that took nightlife seriously.'],
    garoupa: ['Garoupa', 'Grouper',
      'Vive décadas na mesma toca e conhece cada anzol pelo nome.',
      'Lives for decades in the same den and knows every hook by name.'],
    aranha: ['Caranguejo-aranha', 'Spider crab',
      'Pernas para dar e vender. Ela não vende.',
      'Legs to spare and to sell. She isn\'t selling.'],
    aguaviva: ['Água-viva', 'Moon jelly',
      'Noventa e cinco por cento água, cinco por cento mistério.',
      'Ninety-five percent water, five percent mystery.'],
    voador: ['Peixe-voador', 'Flying fish',
      'Achou o mar pequeno demais e resolveu tentar o céu.',
      'Found the sea too small and decided to try the sky.'],
    dourado: ['Dourado', 'Mahi-mahi',
      'Brilha como moeda nova e briga como troco errado.',
      'Shines like a new coin and fights like the wrong change.'],
    atum: ['Atum', 'Tuna',
      'Nunca para de nadar. Nem para pensar.',
      'Never stops swimming. Not even to think.'],
    caravela: ['Caravela-portuguesa', 'Portuguese man o\' war',
      'Não é uma água-viva: é uma república inteira navegando junta.',
      'Not a jellyfish: a whole republic sailing together.'],
    lua: ['Peixe-lua', 'Ocean sunfish',
      'Pesa uma tonelada e passa o dia tomando sol de lado.',
      'Weighs a ton and spends the day sunbathing on its side.'],
    manta: ['Raia-manta', 'Manta ray',
      'Voa debaixo d\'água sem pedir licença à gravidade.',
      'Flies underwater without asking gravity for permission.'],
    martelo: ['Tubarão-martelo', 'Hammerhead shark',
      'Enxerga em panorâmica. Você com certeza está no quadro.',
      'Sees in panorama. You are definitely in the picture.'],
    marlim: ['Marlim-azul', 'Blue marlin',
      'O velho do mar ainda conta essa história — e ela cresce a cada vez.',
      'The old man of the sea still tells this story — and it grows every time.'],
    machado: ['Peixe-machado', 'Hatchetfish',
      'Acende a barriga para não fazer sombra. Esconde-se acendendo a luz.',
      'Lights up its belly so it casts no shadow. Hides by turning the light on.'],
    vibora: ['Peixe-víbora', 'Viperfish',
      'Dentes grandes demais para a própria boca. Ele não liga.',
      'Teeth too big for its own mouth. It doesn\'t care.'],
    isopode: ['Isópode-gigante', 'Giant isopod',
      'Um tatuzinho de jardim que levou a dieta muito a sério.',
      'A garden pill bug that took its diet far too seriously.'],
    diabo: ['Peixe-diabo', 'Anglerfish',
      'Leva a própria lanterna. Quem chega perto para ver a luz vira jantar.',
      'Brings its own lantern. Whoever comes close to see the light becomes dinner.'],
    vampira: ['Lula-vampira', 'Vampire squid',
      'Não suga sangue. Só tem uma capa e uma péssima reputação.',
      'Doesn\'t drink blood. It just has a cape and a terrible reputation.'],
    atolla: ['Água-viva-atolla', 'Atolla jellyfish',
      'Quando atacada, acende um alarme — e algo maior sempre vem ver.',
      'When attacked, it sounds an alarm of light — and something bigger always comes to look.'],
    pelicano: ['Enguia-pelicano', 'Gulper eel',
      'Uma boca enorme com um rabo pendurado.',
      'A huge mouth with a tail hanging off it.'],
    celacanto: ['Celacanto', 'Coelacanth',
      'Dado como extinto há 66 milhões de anos. Ninguém avisou a ele.',
      'Declared extinct 66 million years ago. Nobody told it.'],
    tinteira: ['Lula-Tinteira', 'Inkwell Squid',
      'Dizem que foi ela quem escreveu o mar. Cada onda é uma linha da sua letra.',
      'They say she wrote the sea. Every wave is a line of her handwriting.']
  };

  var SIGHT = {
    baleia: ['Baleia-jubarte', 'Humpback whale',
      'Canta músicas que duram meia hora. Ninguém tem coragem de interromper.',
      'Sings songs that last half an hour. Nobody dares to interrupt.'],
    golfinhos: ['Golfinhos', 'Dolphins',
      'Acompanham o barco só para ver se você sabe pescar.',
      'They follow the boat just to see whether you know how to fish.'],
    tartaruga: ['Tartaruga-verde', 'Green turtle',
      'Já atravessou o oceano duas vezes. Hoje está só de passagem.',
      'Has crossed the ocean twice. Today it\'s just passing through.']
  };

  var pt = {}, en = {}, id;
  for (id in SP) {
    var a = SP[id];
    pt['sp.' + id + '.name'] = a[0]; en['sp.' + id + '.name'] = a[1];
    pt['sp.' + id + '.flavor'] = a[2]; en['sp.' + id + '.flavor'] = a[3];
    pt['sp.' + id + '.pt'] = a[0]; en['sp.' + id + '.pt'] = a[0];
  }
  for (id in SIGHT) {
    var b = SIGHT[id];
    pt['sighting.' + id + '.name'] = b[0]; en['sighting.' + id + '.name'] = b[1];
    pt['sighting.' + id + '.flavor'] = b[2]; en['sighting.' + id + '.flavor'] = b[3];
    pt['sighting.' + id + '.pt'] = b[0]; en['sighting.' + id + '.pt'] = b[0];
  }

  AQ.i18n.add('pt-BR', pt);
  AQ.i18n.add('en', en);

  AQ.i18n.add('pt-BR', {
    zone: {
      baia: { name: 'Baía Rasa', short: 'Baía', desc: 'Águas mornas e rasas, capim-marinho e areia clara.' },
      recife: { name: 'Recife', short: 'Recife', desc: 'Coral, anêmonas e tocas entre as pedras.' },
      kelp: { name: 'Floresta de Kelp', short: 'Kelp', desc: 'Talos que dançam, pedras grandes e grutas escuras.' },
      mar: { name: 'Mar Aberto', short: 'Mar', desc: 'Água azul sem fundo à vista, cardumes e ondas grandes.' },
      abismo: { name: 'Abismo', short: 'Abismo', desc: 'Escuridão, neve marinha e fontes quentes no fundo.' },
      depth: { surface: 'superfície', mid: 'meia-água', bottom: 'fundo', deep: 'fundo profundo' }
    },
    phase: { amanhecer: 'Amanhecer', dia: 'Dia', entardecer: 'Entardecer', noite: 'Noite', any: 'qualquer hora' },
    weather: { limpo: 'Limpo', nublado: 'Nublado', chuva: 'Chuva', tempestade: 'Tempestade', any: 'qualquer tempo' },
    kind: { fish: 'Peixe', crustacean: 'Crustáceo', cephalopod: 'Cefalópode', jelly: 'Água-viva', eel: 'Enguia',
      ray: 'Raia', shark: 'Tubarão', odd: 'Esquisito' },
    behavior: { school: 'Cardume', dart: 'Disparada', cruise: 'Cruzeiro', lurk: 'Emboscada', drift: 'Deriva',
      crawl: 'Rasteja', burrow: 'Enterrado', hover: 'Pairando', leap: 'Saltador', ambient: 'De passagem' },
    sp: {
      habitat: { sand: 'areia', plants: 'plantas', rocks: 'pedras', coral: 'coral', cave: 'grutas', open: 'água aberta' },
      light: { day: 'luz do dia', dim: 'luz fraca', night: 'escuro' },
      diet: { prey: 'presa', grazer: 'pastador', filter: 'filtrador', predator: 'predador' }
    }
  });

  AQ.i18n.add('en', {
    zone: {
      baia: { name: 'Shallow Bay', short: 'Bay', desc: 'Warm, shallow water, seagrass and pale sand.' },
      recife: { name: 'Reef', short: 'Reef', desc: 'Coral, anemones and dens between the rocks.' },
      kelp: { name: 'Kelp Forest', short: 'Kelp', desc: 'Swaying stalks, big boulders and dark caves.' },
      mar: { name: 'Open Sea', short: 'Sea', desc: 'Blue water with no bottom in sight, schools and big waves.' },
      abismo: { name: 'Abyss', short: 'Abyss', desc: 'Darkness, marine snow and hot vents on the floor.' },
      depth: { surface: 'surface', mid: 'mid-water', bottom: 'bottom', deep: 'deep bottom' }
    },
    phase: { amanhecer: 'Dawn', dia: 'Day', entardecer: 'Dusk', noite: 'Night', any: 'any time' },
    weather: { limpo: 'Clear', nublado: 'Cloudy', chuva: 'Rain', tempestade: 'Storm', any: 'any weather' },
    kind: { fish: 'Fish', crustacean: 'Crustacean', cephalopod: 'Cephalopod', jelly: 'Jelly', eel: 'Eel',
      ray: 'Ray', shark: 'Shark', odd: 'Oddity' },
    behavior: { school: 'Schooling', dart: 'Darting', cruise: 'Cruising', lurk: 'Lurking', drift: 'Drifting',
      crawl: 'Crawling', burrow: 'Burrowing', hover: 'Hovering', leap: 'Leaping', ambient: 'Passing by' },
    sp: {
      habitat: { sand: 'sand', plants: 'plants', rocks: 'rocks', coral: 'coral', cave: 'caves', open: 'open water' },
      light: { day: 'daylight', dim: 'dim light', night: 'darkness' },
      diet: { prey: 'prey', grazer: 'grazer', filter: 'filter feeder', predator: 'predator' }
    }
  });
})(window.AQ);
