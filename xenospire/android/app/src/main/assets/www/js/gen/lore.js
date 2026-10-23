// The Curator: intro slides, per-floor commentary built from real fight
// stats, loom remarks and epitaphs. All lines are PT-BR templates.
(function (XS) {
  'use strict';

  const INTRO = [
    'Ano 9.999.999. As estrelas estão se apagando, uma a uma.',
    'No vazio entre as galáxias flutua a XENOSPIRE: uma torre sem topo, feita de andares-arena empilhados até o infinito.',
    'Seu zelador, o CURADOR, convoca seres de todos os cantos do universo. Cada andar, uma luta. Cada vitória, um andar acima.',
    'No coração da torre, o TEAR tece poderes novos com fios de realidade. Nenhum poder se repete. Nenhum mesmo.',
    'Dizem que quem chegar ao topo poderá reescrever o destino de sua estrela natal. O Curador garante que o topo está logo ali.',
  ];

  const FLOOR_INTRO = {
    duel: [
      'Andar {n}. {foe} veio de {world} só para isso. Não decepcione.',
      'Bem-vindo ao andar {n}. O ar aqui é opcional; a luta, não.',
      '{foe} jura que gosta de {likes}. Use isso como quiser.',
      'Andar {n}: {theme}. Limpei o chão hoje cedo. Tente não sujar muito.',
      'Seu oponente quer {motive}. Você quer subir. Alguém vai se frustrar.',
      'Formulário 7-B preenchido. Pode começar a bater em {foe}.',
    ],
    melee: [
      'Luta livre! Todos contra todos. Eu adoro quando a papelada se resolve sozinha.',
      'Andar {n}: vários seres, uma só saída. Para cima.',
      'Ninguém aqui é seu amigo. Nem eu. Principalmente eu.',
    ],
    guardian: [
      'Um Guardião. Ele está aqui desde antes de mim, e eu estou aqui desde sempre.',
      'O Guardião do Andar {n} não fala. Ele só cresce quando apanha. Boa sorte.',
      'Cuidado: o Guardião tem quatro poderes e nenhuma paciência.',
    ],
  };

  const VICTORY = [
    'Você usou "{power}" {casts} vezes. O Tear está lisonjeado.',
    '{voxels} voxels destruídos. Vou mandar a conta para {world}.',
    '{foe} foi desmontado em {time} segundos. Anotado no Livro Grande.',
    'Nenhuma queda! O chão agradece a confiança.',
    'Vitória! Ninguém esperava. Bem, eu esperava. Um pouco.',
    'Andar {n} concluído. Faltam só infinitos andares.',
    'Bonito. Brutal, mas bonito. Assim que a torre gosta.',
  ];
  const VICTORY_FALLS = ['Você caiu {falls} vezes e ainda venceu. Persistência é um tipo de talento.'];

  const LOOM = [
    'O Tear zumbe. Fios novos, recém-tecidos, ainda quentes.',
    'Três poderes. Escolha com sabedoria, ou pelo menos com estilo.',
    'O Tear perguntou de você. Eu disse que você estava ocupado apanhando.',
    'Fios de estrelas mortas. Ótimos para destruir chão.',
  ];

  const EPITAPHS = [
    'Aqui jaz {name}, que subiu {n} andares e caiu com estilo.',
    '{name} chegou ao andar {n}. O topo continua logo ali.',
    '{name}: derrotado por {foe} e por uma escolha questionável de poderes.',
    '{name} veio de {world} para reescrever o destino. Reescreveu só o próprio.',
    'Em memória de {name}, que gostava de {likes}. A torre não.',
  ];

  const TITLE_TIPS = [
    'Dica do Curador: cair da torre dói. No corpo e no orgulho.',
    'Dica do Curador: arraste o botão de um poder para mirar com precisão.',
    'Dica do Curador: paredes quebram. Inimigos também.',
    'Dica do Curador: um poder antigo pode ser Reforçado no Tear.',
    'Dica do Curador: núcleos de energia brilhantes explodem. Use isso.',
    'Dica do Curador: cada semente gera a mesma escalada. Compartilhe as boas.',
    'Dica do Curador: telegrafias vermelhas no chão significam "saia daí".',
  ];

  const SUDDEN = ['A torre está impaciente! O chão vai ceder.', 'Tempo esgotado. A arena está desmoronando!'];

  function fill(str, vars) {
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : '…'));
  }

  function floorIntro(rng, type, vars) { return fill(rng.pick(FLOOR_INTRO[type] || FLOOR_INTRO.duel), vars); }

  // Pick a line that the stats can actually back up.
  function victory(rng, vars) {
    const pool = VICTORY.filter((l) => {
      if (l.includes('{casts}')) return vars.casts >= 3 && vars.power;
      if (l.includes('{voxels}')) return vars.voxels >= 25;
      if (l.includes('Nenhuma queda')) return vars.falls === 0;
      if (l.includes('{time}')) return vars.time != null;
      return true;
    });
    if (vars.falls >= 2) pool.push(...VICTORY_FALLS);
    return fill(rng.pick(pool), vars);
  }

  XS.Lore = {
    INTRO, TITLE_TIPS, SUDDEN,
    floorIntro, victory,
    loom: (rng) => rng.pick(LOOM),
    epitaph: (rng, vars) => fill(rng.pick(EPITAPHS), vars),
    fill,
  };
})(globalThis.XS = globalThis.XS || {});
