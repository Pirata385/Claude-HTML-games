// Água-Tinta — UI strings (owner E): ui.* hud.* settings.* tut.* note.* credits.* rarity.* size.* common.*
// (plus debug.error, used by AQ.scenes). Each entry is [pt-BR, en] so both languages always have the same keys.
// Canvas-drawn strings (credits.*, ui.title.subtitle, ui.ending.*) stay inside the atlas charset (no — … →).
(function (AQ) {
  'use strict';

  var S = {};
  function group(prefix, obj) {
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      var v = obj[k], key = prefix ? prefix + '.' + k : k;
      if (Array.isArray(v)) S[key] = v;
      else group(key, v);
    }
  }

  // ------------------------------------------------------------------ common, rarity, size
  group('common', {
    ok: ['OK', 'OK'],
    cancel: ['Cancelar', 'Cancel'],
    close: ['Fechar', 'Close'],
    back: ['Voltar', 'Back'],
    yes: ['Sim', 'Yes'],
    no: ['Não', 'No'],
    'continue': ['Continuar', 'Continue'],
    confirm: ['Confirmar', 'Confirm'],
    on: ['Ligado', 'On'],
    off: ['Desligado', 'Off'],
    auto: ['Auto', 'Auto'],
    none: ['Nenhum', 'None'],
    remove: ['Remover', 'Remove'],
    locked: ['Bloqueado', 'Locked'],
    unknown: ['???', '???'],
    coins: { one: ['{n} moeda', '{n} coin'], other: ['{n} moedas', '{n} coins'] },
    pearls: { one: ['{n} pérola', '{n} pearl'], other: ['{n} pérolas', '{n} pearls'] }
  });
  group('rarity', {
    C: ['Comum', 'Common'], U: ['Incomum', 'Uncommon'], R: ['Raro', 'Rare'], L: ['Lendário', 'Legendary']
  });
  group('size', {
    XS: ['Minúsculo', 'Tiny'], S: ['Pequeno', 'Small'], M: ['Médio', 'Medium'], L: ['Grande', 'Large'],
    XL: ['Enorme', 'Huge'], XXL: ['Colossal', 'Colossal']
  });
  group('debug', { error: ['Erro em {where} (veja o console)', 'Error in {where} (see the console)'] });

  // ------------------------------------------------------------------ ui: shared bits
  group('ui', {
    listSep: [', ', ', '],
    unit: { cm: ['{n} cm', '{n} cm'], kg: ['{n} kg', '{n} kg'], m: ['{n} m', '{n} m'] },
    time: { dh: ['{d} d {h} h', '{d} d {h} h'], hm: ['{h} h {m} min', '{h} h {m} min'], m: ['{m} min', '{m} min'], s: ['{s} s', '{s} s'] },
    title: {
      name: ['Água-Tinta', 'Água-Tinta'],
      subtitle: ['pesca e aquário em ascii', 'fishing and aquarium in ascii'],
      'continue': ['Continuar', 'Continue'],
      newGame: ['Novo jogo', 'New game'],
      settings: ['Configurações', 'Settings'],
      credits: ['Créditos', 'Credits'],
      gamesMenu: ['Menu de jogos', 'Games menu'],
      version: ['v{v}', 'v{v}'],
      lang: ['Idioma', 'Language'],
      confirmNewTitle: ['Começar de novo?', 'Start over?'],
      confirmNewBody: ['Já existe um jogo salvo. Um novo jogo substitui o progresso atual (um backup é guardado).',
        'There is a saved game. A new game replaces your current progress (a backup is kept).'],
      confirmNewOk: ['Novo jogo', 'New game']
    },
    tank: {
      name: ['Tanque {n}', 'Tank {n}'],
      short: ['T{n}', 'T{n}'],
      title: ['Escolha o tanque', 'Choose a tank'],
      usage: ['{used}/{cap}', '{used}/{cap}'],
      full: ['sem espaço', 'no room'],
      fits: ['cabe', 'fits'],
      current: ['atual', 'current'],
      fishCount: { one: ['{n} peixe', '{n} fish'], other: ['{n} peixes', '{n} fish'] },
      cantFit: ['Este peixe não cabe em nenhum tanque.', 'This fish does not fit in any tank.']
    }
  });

  // ------------------------------------------------------------------ ui.toast
  group('ui.toast', {
    saveInvalid: ['Save inválido — um backup foi guardado.', 'Invalid save — a backup was kept.'],
    quality: ['Qualidade ajustada: {preset}', 'Quality adjusted: {preset}'],
    newSpecies: ['+1 espécie no Caderno: {name}', '+1 species in the Notebook: {name}'],
    seen: ['Avistado: {name}', 'Spotted: {name}'],
    sighting: ['Avistamento: {name}!', 'Sighting: {name}!'],
    sold: ['Vendido: {name} por {amount}', 'Sold: {name} for {amount}'],
    kept: ['{name} foi para o {tank}', '{name} went to {tank}'],
    released: ['{name} voltou ao mar. Sorte +5%', '{name} swam home. Luck +5%'],
    record: ['Novo recorde: {name}, {len}', 'New record: {name}, {len}'],
    goal: ['Meta cumprida: {name}', 'Goal complete: {name}'],
    achievement: ['Conquista: {name}', 'Achievement: {name}'],
    zoneUnlocked: ['Nova água liberada: {zone}', 'New water unlocked: {zone}'],
    stars: ['O aquário agora tem {stars}', 'The aquarium now has {stars}'],
    paper: ['Tema Papel desbloqueado', 'Paper theme unlocked'],
    collected: ['Bilheteria: +{amount}', 'Ticket booth: +{amount}'],
    tillEmpty: ['A bilheteria está vazia por enquanto.', 'The ticket booth is empty for now.'],
    bred: ['Nasceu um filhote de {name}!', 'A baby {name} was born!'],
    producedPearl: ['A ostra fez {n} pérola(s).', 'The oyster made {n} pearl(s).'],
    producedBait: ['Os camarões do tanque renderam {n} iscas.', 'Your tank shrimp gave {n} baits.'],
    fed: ['{tank} alimentado.', '{tank} fed.'],
    feedNo: ['Moedas insuficientes para alimentar.', 'Not enough coins to feed.'],
    hungry: ['{tank} está com fome.', '{tank} is hungry.'],
    predatorWarn: ['{predator} está de olho em {prey} no {tank}…', '{predator} is eyeing {prey} in {tank}…'],
    predation: ['{predator} comeu {prey} no {tank}. Alimente os tanques!', '{predator} ate {prey} in {tank}. Keep the tanks fed!'],
    frenzy: ['Frenesi! Os pássaros estão mergulhando!', 'Frenzy! The birds are diving!'],
    frenzyEnd: ['O frenesi passou.', 'The frenzy is over.'],
    legendary: ['Algo enorme se move nas profundezas…', 'Something huge moves in the deep…'],
    bought: ['Comprado: {name}', 'Bought: {name}'],
    deniedCoins: ['Moedas insuficientes.', 'Not enough coins.'],
    deniedPearls: ['Pérolas insuficientes.', 'Not enough pearls.'],
    deniedReq: ['Ainda não disponível.', 'Not available yet.'],
    deniedMaxed: ['Já está no máximo.', 'Already maxed out.'],
    baitOut: ['A isca acabou — voltando para {name}.', 'Out of bait — back to {name}.'],
    baitEquipped: ['Isca: {name}', 'Bait: {name}'],
    early: ['Cedo demais! O peixe se assustou.', 'Too early! The fish got spooked.'],
    late: ['Tarde demais — ele largou a isca.', 'Too late — it let go of the bait.'],
    escape: ['Escapou!', 'It got away!'],
    waited: ['Você esperou até {time} ({phase}).', 'You waited until {time} ({phase}).'],
    imported: ['Save importado.', 'Save imported.'],
    copied: ['Copiado para a área de transferência.', 'Copied to the clipboard.'],
    copyFail: ['Não deu para copiar — selecione o texto e copie à mão.', 'Could not copy — select the text and copy it by hand.'],
    reset: ['Save apagado. Um novo começo.', 'Save erased. A fresh start.'],
    fullscreenFail: ['Tela cheia indisponível neste navegador.', 'Fullscreen is not available in this browser.'],
    noFit: ['Nenhum tanque tem espaço para ele.', 'No tank has room for it.'],
    moved: ['{name} foi para o {tank}', '{name} moved to {tank}'],
    renamed: ['Agora se chama {name}.', 'Now called {name}.'],
    message: ['Uma garrafa! "{title}"', 'A bottle! "{title}"'],
    tutorialSkipped: ['Tutorial pulado.', 'Tutorial skipped.'],
    tutorialDone: ['Pronto! O mar é seu.', 'All set! The sea is yours.'],
    light: ['Luz do {tank}: {mode}', '{tank} light: {mode}'],
    legendaryEscaped: ['Ela voltará enquanto as condições durarem.', 'It will return while the conditions hold.'],
    sellNo: ['Não foi possível vender.', 'Could not sell.']
  });

  // ------------------------------------------------------------------ ui.catch / ui.fish / cards
  group('ui.catch', {
    title: ['Na linha!', 'On the line!'],
    'new': ['NOVO!', 'NEW!'],
    trophy: ['Troféu!', 'Trophy!'],
    dense: ['Tinta Densa', 'Dense Ink'],
    record: ['Recorde: {len}', 'Record: {len}'],
    recordNew: ['Novo recorde!', 'New record!'],
    keep: ['Guardar', 'Keep'],
    keepSub: ['{tank} {used}/{cap}', '{tank} {used}/{cap}'],
    keepNone: ['sem espaço', 'no room'],
    keepNo: ['não pode ficar', 'cannot stay'],
    sell: ['Vender', 'Sell'],
    release: ['Soltar', 'Release'],
    releaseSub: ['+5% sorte', '+5% luck'],
    measures: ['{len} · {kg}', '{len} · {kg}'],
    otherTank: ['outro tanque', 'other tank'],
    keysHint: ['Atalhos: 1 · 2 · 3', 'Shortcuts: 1 · 2 · 3']
  });
  group('ui.fish', {
    title: ['Ficha', 'Fish card'],
    origin: ['Pescado em {zone}, {date}', 'Caught in {zone}, {date}'],
    born: ['Nascido aqui, {date}', 'Born here, {date}'],
    juvenile: ['Filhote · {pct} crescido', 'Juvenile · {pct} grown'],
    happy: ['Felicidade', 'Happiness'],
    factor: {
      food: ['Comida', 'Food'], space: ['Espaço', 'Space'], habitat: ['Habitat', 'Habitat'], light: ['Luz', 'Light'],
      harmony: ['Convivência', 'Harmony'], quality: ['Água', 'Water']
    },
    likes: ['Gosta de: {list}', 'Likes: {list}'],
    value: ['Valor de venda: {price}', 'Sale value: {price}'],
    move: ['Mover', 'Move'],
    sell: ['Vender', 'Sell'],
    release: ['Soltar', 'Release'],
    rename: ['Renomear', 'Rename'],
    renameLabel: ['Apelido', 'Nickname'],
    renameSave: ['Salvar', 'Save'],
    releaseTitle: ['Soltar {name}?', 'Release {name}?'],
    releaseBody: ['Ele volta para o mar. Não dá para desfazer.', 'It goes back to the sea. This cannot be undone.'],
    sellTitle: ['Vender {name}?', 'Sell {name}?'],
    sellBody: ['Você recebe {price}.', 'You get {price}.'],
    gone: ['Este peixe não está mais aqui.', 'This fish is no longer here.'],
    habitat: {
      sand: ['areia', 'sand'], plants: ['plantas', 'plants'], rocks: ['pedras', 'rocks'], coral: ['coral', 'coral'],
      cave: ['grutas', 'caves'], open: ['água aberta', 'open water']
    },
    light: { day: ['luz forte', 'bright light'], dim: ['luz fraca', 'dim light'], night: ['escuro', 'darkness'] },
    dense: ['Tinta Densa', 'Dense Ink'],
    trophy: ['Troféu', 'Trophy'],
    bred: ['nascido no aquário', 'aquarium-born']
  });
  group('ui.zone', {
    depth: ['Profundidade: até {max}', 'Depth: down to {max}'],
    now: ['Agora: {time} · {phase} · {weather}', 'Now: {time} · {phase} · {weather}'],
    forecast: ['Previsão: {list}', 'Forecast: {list}'],
    species: ['Espécies: {n}/{total}', 'Species: {n}/{total}'],
    bestNow: ['Bons agora', 'Good right now'],
    bestNone: ['Nada conhecido para estas condições… ainda.', 'Nothing known for these conditions… yet.'],
    fish: ['Pescar', 'Fish'],
    wait: ['Esperar até…', 'Wait until…'],
    waitTitle: ['Esperar até', 'Wait until'],
    locked: ['Bloqueada', 'Locked'],
    requires: ['Para pescar aqui:', 'To fish here:'],
    luck: ['Sorte: +{pct}', 'Luck: +{pct}']
  });
  group('ui.bait', {
    title: ['Isca', 'Bait'],
    count: ['x{n}', 'x{n}'],
    infinite: ['sem fim', 'endless'],
    lure: ['artificial · permanente', 'lure · permanent'],
    use: ['Usar', 'Use'],
    inUse: ['em uso', 'in use'],
    none: ['acabou', 'none left'],
    buyHint: ['Compre mais iscas na Loja.', 'Buy more bait in the Shop.']
  });
  group('ui.decor', {
    title: ['Decorar o {tank}', 'Decorate {tank}'],
    slot: ['Espaço {n}', 'Slot {n}'],
    empty: ['vazio', 'empty'],
    pick: ['Escolha um espaço, depois uma peça.', 'Pick a slot, then a piece.'],
    owned: ['x{n}', 'x{n}'],
    none: ['Nenhuma decoração guardada. Compre na Loja.', 'No decor in storage. Buy some in the Shop.'],
    attract: ['+{pct} atração', '+{pct} appeal'],
    remove: ['Tirar', 'Take out'],
    place: ['Colocar', 'Place'],
    tags: { rocks: ['pedras', 'rocks'], plants: ['plantas', 'plants'], coral: ['coral', 'coral'], cave: ['gruta', 'cave'], sand: ['areia', 'sand'] }
  });
  group('ui.offline', {
    title: ['Enquanto você esteve fora', 'While you were away'],
    away: ['Ausente por {time}', 'Away for {time}'],
    coins: ['Bilheteria: +{amount}', 'Ticket booth: +{amount}'],
    pearls: ['Ostras: +{n} pérola(s)', 'Oysters: +{n} pearl(s)'],
    capped: ['O cofre encheu. Um cofre maior guarda mais tempo.', 'The safe filled up. A bigger safe holds more time.'],
    nothing: ['O mar ficou quieto.', 'The sea stayed quiet.'],
    calm: ['Os peixes esperaram por você. Ninguém se foi.', 'The fish waited for you. Nobody was lost.'],
    ok: ['Ótimo', 'Great'],
    goAquarium: ['Ver aquário', 'See aquarium']
  });

  // ------------------------------------------------------------------ ui.shop
  group('ui.shop', {
    title: ['Venda do Seu Zé', 'Seu Zé\'s Store'],
    tab: { gear: ['Equipamento', 'Gear'], bait: ['Iscas', 'Bait'], boat: ['Barco', 'Boat'], aquarium: ['Aquário', 'Aquarium'], decor: ['Decoração', 'Decor'] },
    buy: ['Comprar', 'Buy'],
    free: ['grátis', 'free'],
    maxed: ['máximo', 'maxed'],
    owned: ['você tem', 'owned'],
    have: ['tem {n}', 'have {n}'],
    stored: ['guardado: {n}', 'in storage: {n}'],
    requires: ['Requer: {list}', 'Requires: {list}'],
    current: ['Atual: {name}', 'Current: {name}'],
    tierLabel: ['{name}', '{name}'],
    forTank: ['Para o', 'For'],
    pack: ['pacote com {n}', 'pack of {n}'],
    permanent: ['permanente', 'permanent'],
    tankNew: ['Novo tanque ({n}º)', 'New tank (#{n})'],
    stars: ['{n} estrelas', '{n} stars'],
    unlocks: ['Libera: {zone}', 'Unlocks: {zone}'],
    empty: ['Nada à venda aqui por enquanto.', 'Nothing for sale here yet.'],
    stat: {
      cast: ['Arremesso', 'Cast'], window: ['Fisgada', 'Strike window'], St: ['Firmeza', 'Steering'],
      Ls: ['Força', 'Strength'], maxLen: ['Alcance', 'Reach'], snapGrace: ['Folga', 'Grace'],
      reelSpeed: ['Recolhe', 'Reel'], riseRate: ['Reação', 'Response'], hookClass: ['Anzol', 'Hook'],
      radius: ['Luz', 'Light'], cap: ['Capacidade', 'Capacity'], filter: ['Filtro', 'Filter'], hours: ['Cofre', 'Safe']
    },
    deny: {
      coins: ['Faltam moedas', 'Need more coins'], pearls: ['Faltam pérolas', 'Need more pearls'],
      req: ['Requisito pendente', 'Requirement missing'], maxed: ['Já está no máximo', 'Already maxed']
    },
    feeder: ['Alimentador automático', 'Auto-feeder'],
    hoursVal: ['{n} h', '{n} h']
  });

  // ------------------------------------------------------------------ ui.bestiary
  group('ui.bestiary', {
    title: ['Caderno de Campo', 'Field Notebook'],
    completion: ['{n}/{total} ({pct})', '{n}/{total} ({pct})'],
    tab: { sightings: ['Avist.', 'Sight.'], messages: ['Msg', 'Msg'] },
    tabFull: { sightings: ['Avistamentos', 'Sightings'], messages: ['Mensagens', 'Messages'] },
    unknown: ['???', '???'],
    seen: ['(visto)', '(seen)'],
    caught: ['x{n}', 'x{n}'],
    record: ['Recorde: {len} · {kg}', 'Record: {len} · {kg}'],
    recordDate: ['em {date}', 'on {date}'],
    counts: ['Pescados {caught} · Guardados {kept} · Vendidos {sold} · Soltos {released}',
      'Caught {caught} · Kept {kept} · Sold {sold} · Released {released}'],
    dense: ['Tinta Densa: {v}', 'Dense Ink: {v}'],
    band: { surface: ['superfície', 'surface'], mid: ['meia-água', 'mid-water'], bottom: ['fundo', 'bottom'] },
    where: ['{zone} · {band}', '{zone} · {band}'],
    hintTime: ['Hora: {list}', 'Time: {list}'],
    hintWeather: ['Tempo: {list}', 'Weather: {list}'],
    hintBait: ['Isca preferida: {list}', 'Favourite bait: {list}'],
    anyTime: ['qualquer hora', 'any time'],
    anyWeather: ['qualquer tempo', 'any weather'],
    hidden: ['Pesque um (ou ache uma garrafa) para saber mais.', 'Catch one (or find a bottle) to learn more.'],
    sightingSeen: ['Avistado em {date}', 'Spotted on {date}'],
    sightingNot: ['Ainda não avistado.', 'Not spotted yet.'],
    messageNot: ['Garrafa ainda não encontrada.', 'Bottle not found yet.'],
    pick: ['Escolha uma ficha.', 'Pick an entry.'],
    nonCatch: ['não pescável', 'not catchable'],
    alsoEn: ['em inglês: {name}', 'in Portuguese: {name}'],
    legend: ['Lendário', 'Legendary']
  });

  // ------------------------------------------------------------------ ui.goals
  group('ui.goals', {
    title: ['Metas', 'Goals'],
    active: ['Em andamento', 'In progress'],
    done: ['Cumpridas', 'Completed'],
    achievements: ['Conquistas', 'Achievements'],
    progress: ['{cur}/{max}', '{cur}/{max}'],
    reward: ['Recompensa: {list}', 'Reward: {list}'],
    allDone: ['Todas as metas cumpridas. O mar agradece.', 'Every goal is done. The sea thanks you.'],
    count: ['{n}/{total}', '{n}/{total}'],
    locked: ['???', '???'],
    unlock: { perola: ['Pérola Negra à venda', 'Black Pearl on sale'], paperTheme: ['Tema Papel', 'Paper theme'], papel: ['Isca de papel', 'Paper bait'] },
    tabGoals: ['Metas', 'Goals'],
    tabAch: ['Conquistas', 'Achievements']
  });

  // ------------------------------------------------------------------ ui.pause / saveio / confirm / note / credits / ending
  group('ui.pause', {
    title: ['Pausa', 'Paused'],
    'continue': ['Continuar', 'Continue'],
    settings: ['Configurações', 'Settings'],
    bestiary: ['Caderno', 'Notebook'],
    map: ['Voltar ao mapa', 'Back to map'],
    title2: ['Tela inicial', 'Title screen'],
    gamesMenu: ['Menu de jogos', 'Games menu']
  });
  group('ui.saveio', {
    title: ['Exportar / importar', 'Export / import'],
    exportLabel: ['Guarde este texto para levar seu progresso a outro lugar:', 'Keep this text to take your progress elsewhere:'],
    copy: ['Copiar', 'Copy'],
    download: ['Baixar arquivo', 'Download file'],
    importLabel: ['Cole aqui um save exportado:', 'Paste an exported save here:'],
    'import': ['Importar', 'Import'],
    file: ['Abrir arquivo', 'Open file'],
    err: {
      format: ['Formato inválido.', 'Invalid format.'],
      checksum: ['O texto está incompleto ou foi alterado.', 'The text is incomplete or was changed.'],
      json: ['Save corrompido.', 'Corrupted save.'],
      shape: ['Isto não parece um save do Água-Tinta.', 'This does not look like an Água-Tinta save.'],
      future: ['Este save é de uma versão mais nova do jogo.', 'This save is from a newer version of the game.'],
      migrate: ['Não foi possível converter este save.', 'Could not convert this save.']
    },
    confirmTitle: ['Importar este save?', 'Import this save?'],
    confirmBody: ['O progresso atual será substituído (um backup é guardado).', 'Your current progress will be replaced (a backup is kept).'],
    exportTab: ['Exportar', 'Export'],
    importTab: ['Importar', 'Import']
  });
  group('ui.confirm', {
    resetTitle: ['Apagar o save?', 'Erase the save?'],
    resetBody: ['Todo o progresso será apagado. As configurações ficam.', 'All progress will be erased. Settings are kept.'],
    resetOk: ['Apagar…', 'Erase…'],
    reset2Title: ['Tem certeza mesmo?', 'Are you really sure?'],
    reset2Body: ['Não dá para desfazer. Os tanques voltam a ficar vazios.', 'This cannot be undone. The tanks will be empty again.'],
    reset2Ok: ['Apagar tudo', 'Erase everything'],
    wait: ['Espere… {n}', 'Wait… {n}']
  });
  group('ui.note', {
    tap: ['toque para continuar', 'tap to continue'],
    message: ['Mensagem na garrafa', 'Message in a bottle'],
    story: ['Bilhete', 'Note']
  });
  group('ui.credits', { title: ['Créditos', 'Credits'] });
  group('ui.ending', { skip: ['Pular', 'Skip'] });

  // ------------------------------------------------------------------ hud
  group('hud', {
    map: ['Mapa', 'Map'],
    aquarium: ['Aquário', 'Aquarium'],
    shop: ['Loja', 'Shop'],
    bestiary: ['Caderno', 'Notebook'],
    goals: ['Metas', 'Goals'],
    back: ['Mapa', 'Map'],
    pause: ['Pausar', 'Pause'],
    bait: ['Isca: {name} x{n}', 'Bait: {name} x{n}'],
    baitInf: ['Isca: {name}', 'Bait: {name}'],
    baitShort: ['{name} x{n}', '{name} x{n}'],
    retrieve: ['Recolher', 'Retrieve'],
    reel: ['Molinete (segure para recolher)', 'Reel (hold to reel in)'],
    clock: ['{time} · {phase} · {weather}', '{time} · {phase} · {weather}'],
    wallet: ['{coins} moedas, {pearls} pérolas', '{coins} coins, {pearls} pearls'],
    tank: ['Tanque {n}/{total}', 'Tank {n}/{total}'],
    feed: ['Alimentar', 'Feed'],
    feedFree: ['grátis', 'free'],
    decorate: ['Decorar', 'Decorate'],
    light: ['Luz: {mode}', 'Light: {mode}'],
    lightMode: { day: ['Dia', 'Day'], dim: ['Penumbra', 'Dim'], night: ['Noite', 'Night'] },
    contemplate: ['Contemplar', 'Contemplate'],
    contemplateExit: ['toque para voltar', 'tap to return'],
    till: ['Bilheteria', 'Tickets'],
    prevTank: ['Tanque anterior', 'Previous tank'],
    nextTank: ['Próximo tanque', 'Next tank'],
    saved: ['salvo', 'saved'],
    aquariumTitle: ['AQUÁRIO', 'AQUARIUM'],
    happy: ['{face} {pct}', '{face} {pct}'],
    usage: ['{used}/{cap}', '{used}/{cap}'],
    starsAria: ['{n} estrelas', '{n} stars'],
    baitName: {
      massa: ['massa', 'dough'], minhoca: ['minhoca', 'worm'], camarao: ['camarão', 'shrimp'], lula: ['lula', 'squid'],
      luminosa: ['luminosa', 'glow bait'], colher: ['colher', 'spoon'], jig: ['jig', 'jig'], papel: ['papel', 'paper'],
      perola: ['Pérola Negra', 'Black Pearl']
    }
  });

  // ------------------------------------------------------------------ settings
  group('settings', {
    title: ['Configurações', 'Settings'],
    sec: { sound: ['Som', 'Sound'], video: ['Imagem', 'Display'], controls: ['Controles', 'Controls'], game: ['Jogo', 'Game'] },
    lang: ['Idioma', 'Language'],
    langPt: ['Português (BR)', 'Português (BR)'],
    langEn: ['English', 'English'],
    volMaster: ['Volume geral', 'Master volume'],
    volMusic: ['Música', 'Music'],
    volSfx: ['Efeitos', 'Effects'],
    volAmbience: ['Ambiente', 'Ambience'],
    quality: ['Qualidade', 'Quality'],
    q: { auto: ['Auto', 'Auto'], high: ['Alta', 'High'], medium: ['Média', 'Medium'], low: ['Baixa', 'Low'] },
    motionStyle: ['Movimento', 'Motion'],
    ms: { fluid: ['Fluido', 'Fluid'], grid: ['Grade clássica', 'Classic grid'] },
    reducedMotion: ['Reduzir movimento', 'Reduce motion'],
    rm: { auto: ['Auto', 'Auto'], on: ['Sim', 'Yes'], off: ['Não', 'No'] },
    glyphSize: ['Tamanho do glifo', 'Glyph size'],
    uiScale: ['Escala da interface', 'Interface scale'],
    highContrast: ['Alto contraste', 'High contrast'],
    theme: ['Tema', 'Theme'],
    th: { noite: ['Noite', 'Night'], papel: ['Papel', 'Paper'], papelLocked: ['Papel (termine a história)', 'Paper (finish the story)'] },
    haptics: ['Vibração', 'Vibration'],
    showFps: ['Mostrar FPS', 'Show FPS'],
    hints: ['Dicas de controle', 'Control hints'],
    handedness: ['Mão', 'Hand'],
    hand: { right: ['Destra', 'Right'], left: ['Canhota', 'Left'] },
    assists: ['Assistências', 'Assists'],
    autoSteer: ['Vara automática', 'Auto rod'],
    wideWindows: ['Janelas amplas', 'Wide windows'],
    fullscreen: ['Tela cheia', 'Fullscreen'],
    fsEnter: ['Entrar', 'Enter'],
    fsExit: ['Sair', 'Exit'],
    tutorial: ['Tutorial', 'Tutorial'],
    tutorialSkip: ['Pular', 'Skip'],
    tutorialDone: ['concluído', 'done'],
    save: ['Save', 'Save'],
    'export': ['Exportar', 'Export'],
    'import': ['Importar', 'Import'],
    reset: ['Apagar save…', 'Erase save…'],
    na: ['(sem suporte)', '(not supported)']
  });

  // ------------------------------------------------------------------ tutorial hints (input-specific variants)
  group('tut', {
    cast: {
      touch: ['Arraste para trás e solte para lançar', 'Drag back and release to cast'],
      mouse: ['Clique, arraste para trás e solte', 'Click, drag back and release'],
      keyboard: ['← → para mirar, segure Espaço', '← → to aim, hold Space'],
      gamepad: ['Mire com o direcional, segure A', 'Aim with the stick, hold A']
    },
    sink: ['A isca afunda…', 'The bait sinks…'],
    wait: ['Espere o peixe chegar perto…', 'Let the fish come closer…'],
    nibble: ['Ainda não… espere a mordida.', 'Not yet… wait for the bite.'],
    strike: {
      touch: ['AGORA! Toque.', 'NOW! Tap.'],
      mouse: ['AGORA! Clique.', 'NOW! Click.'],
      keyboard: ['AGORA! Espaço.', 'NOW! Space.'],
      gamepad: ['AGORA! Aperte A.', 'NOW! Press A.']
    },
    reel: {
      touch: ['Segure (@) para recolher', 'Hold (@) to reel in'],
      mouse: ['Segure o botão do mouse para recolher', 'Hold the mouse button to reel in'],
      keyboard: ['Segure Espaço para recolher', 'Hold Space to reel in'],
      gamepad: ['Segure A para recolher', 'Hold A to reel in']
    },
    tension: ['mantenha no meio', 'keep it in the middle'],
    steer: {
      touch: ['Puxe a vara para o outro lado!  arraste -->', 'Pull the rod the other way!  drag -->'],
      mouse: ['Puxe a vara para o outro lado!  mouse -->', 'Pull the rod the other way!  mouse -->'],
      keyboard: ['Puxe a vara para o outro lado!  segure D -->', 'Pull the rod the other way!  hold D -->'],
      gamepad: ['Puxe a vara para o outro lado!  direcional -->', 'Pull the rod the other way!  stick -->']
    },
    keep: ['Guarde seu primeiro peixe no aquário.', 'Keep your first fish in the aquarium.'],
    goAquarium: ['Seu peixe está esperando. Volte ao mapa.', 'Your fish is waiting. Head back to the map.'],
    goAquariumMap: ['Seu peixe está esperando. Abra o Aquário.', 'Your fish is waiting. Open the Aquarium.'],
    card: ['Toque num peixe para ver a ficha.', 'Tap a fish to see its card.'],
    feed: ['Alimente o tanque — a primeira é grátis.', 'Feed the tank — the first one is free.'],
    till: ['Toque na Bilheteria para recolher as moedas.', 'Tap the ticket booth to collect the coins.']
  });

  // ------------------------------------------------------------------ story notes (§9.5)
  group('note', {
    intro: ['Querida, o aquário é seu agora. Os tanques estão vazios — e o mar, cheio.',
      'Dear, the aquarium is yours now. The tanks are empty — and the sea is full.'],
    firstCatch: ['Todo aquário começa com um peixe pequeno.', 'Every aquarium starts with a small fish.'],
    aquarium: ['Peixe bem alimentado é peixe contente. Luz certa e um cantinho para se esconder — e as visitas pagam a entrada.',
      'A well-fed fish is a happy fish. The right light and a place to hide — and visitors will pay to see them.'],
    recife: ['No Recife os peixes correm de lado. Vara firme, sempre para o lado contrário.',
      'On the Reef the fish run sideways. Hold the rod firm, always to the other side.'],
    kelp: ['Na Floresta de Kelp eles fogem para as pedras. Não deixe chegarem lá.',
      'In the Kelp Forest they flee to the rocks. Do not let them get there.'],
    mar: ['No Mar Aberto o peixe pula. Quando ele sair da água, solte o molinete.',
      'In the Open Sea the fish jump. When one leaves the water, let go of the reel.'],
    abismo: ['No Abismo só vê quem leva luz. E algumas coisas brilham sozinhas.',
      'In the Abyss, only those who bring light can see. And some things glow on their own.'],
    stars4: ['Quatro estrelas, querida! A receita da Pérola Negra está com o Seu Zé: uma pérola por noite de tempestade.',
      'Four stars, dear! Seu Zé has the Black Pearl recipe: one pearl for each stormy night.'],
    ending: ['Toda tinta volta para o mar. Obrigada por devolver a minha.', 'All ink returns to the sea. Thank you for returning mine.'],
    sign: { iara: ['— Vó Iara', '— Grandma Iara'], i: ['— I.', '— I.'] }
  });

  // ------------------------------------------------------------------ credits (also drawn on canvas: atlas charset only)
  group('credits', {
    title: ['AGUA-TINTA', 'AGUA-TINTA'],
    subtitle: ['pesca e aquario em ascii', 'fishing and aquarium in ascii'],
    l1: ['uma historia de Vo Iara', 'a story by Grandma Iara'],
    h2: ['feito por', 'made by'],
    l2: ['cinco agentes de tinta e um diretor', 'five ink agents and a director'],
    h3: ['desenho dos peixes', 'fish drawings'],
    l3: ['caracteres ASCII, um por um', 'ASCII characters, one by one'],
    h4: ['tipografia', 'typeface'],
    l4: ['JetBrains Mono, licenca SIL OFL 1.1', 'JetBrains Mono, SIL OFL 1.1 license'],
    h5: ['som', 'sound'],
    l5: ['Web Audio, sem nenhum arquivo', 'Web Audio, not a single file'],
    h6: ['agradecimentos', 'thanks'],
    l6: ['a quem solta os peixes pequenos', 'to everyone who lets the small fish go'],
    end: ['obrigada por jogar', 'thank you for playing']
  });

  var pt = {}, en = {};
  for (var k in S) { pt[k] = S[k][0]; en[k] = S[k][1]; }
  AQ.i18n.add('pt-BR', pt);
  AQ.i18n.add('en', en);
})(window.AQ);
