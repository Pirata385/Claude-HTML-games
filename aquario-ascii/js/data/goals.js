// Água-Tinta — goal chain, achievements and bottle messages (owner D). Pure data (§9.2–9.4).
// Strings: goal.<id> (description, {n} etc. from params), ach.<id>.name / ach.<id>.desc, msg.<id>.title / msg.<id>.body.
(function (AQ) {
  'use strict';

  // Goal = {id, type, params, reward:{coins?, pearls?, unlock?}}. Three are active at once (the first three not done,
  // in chain order). Counter goals count from activation (progress.goalBase); collection goals are absolute.
  function g(id, type, params, reward) { return { id: id, type: type, params: params || {}, reward: reward }; }
  var chain = [
    g('g01', 'catch', { n: 1 }, { coins: 20 }),
    g('g02', 'keep', { n: 1 }, { coins: 15 }),
    g('g03', 'feed', { n: 1 }, { coins: 10 }),
    g('g04', 'buy', { cat: 'gear', n: 1 }, { pearls: 1 }),
    g('g05', 'discover', { n: 5 }, { coins: 50 }),
    g('g06', 'collectTill', { n: 1 }, { coins: 20 }),
    g('g07', 'unlockZone', { zone: 'recife' }, { pearls: 2 }),
    g('g08', 'catchRarity', { rarity: 'R', n: 1 }, { coins: 100 }),
    g('g09', 'decorTank', { n: 3 }, { coins: 80 }),
    g('g10', 'fishInAquarium', { n: 10 }, { coins: 150 }),
    g('g11', 'catchAt', { phase: 'noite', n: 1 }, { coins: 60 }),
    g('g12', 'unlockZone', { zone: 'kelp' }, { pearls: 3 }),
    g('g13', 'tanks', { n: 2 }, { coins: 200 }),
    g('g14', 'breed', { n: 1 }, { pearls: 2 }),
    g('g15', 'trophy', { n: 1 }, { coins: 250 }),
    g('g16', 'stars', { n: 3 }, { pearls: 3 }),
    g('g17', 'unlockZone', { zone: 'mar' }, { pearls: 5 }),
    g('g18', 'catchIn', { weather: 'tempestade', n: 1 }, { coins: 400 }),
    g('g19', 'messages', { n: 3 }, { pearls: 3 }),
    g('g20', 'sighting', { id: 'baleia' }, { coins: 500 }),
    g('g21', 'catchSpecies', { sp: 'marlim' }, { pearls: 5 }),
    g('g22', 'unlockZone', { zone: 'abismo' }, { pearls: 5 }),
    g('g23', 'catchSpecies', { sp: 'celacanto' }, { pearls: 10 }),
    g('g24', 'stars', { n: 4 }, { unlock: 'perola' }),
    g('g25', 'ending', {}, { unlock: 'paperTheme' }),
    g('g26', 'completion', { pct: 100 }, { pearls: 20 }),
    g('g27', 'dense', { n: 5 }, { pearls: 10 }),
    g('g28', 'stars', { n: 5 }, { pearls: 25 })
  ];

  // Ach = {id, type, params, reward:{pearls}}. Types:
  //   stat {key, n, gt?}   state.stats[key] ≥ n (or > n with gt)
  //   catchSpecies {sp}    caught at least once
  //   catchSize {size}     any species of that size caught
  //   completion {pct}     notebook completion ≥ pct (0..100)
  //   dense {n}            dense specimens caught ≥ n
  //   depth {m}            progress.maxDepthM ≥ m
  //   ending {}            progress.ending
  function a(id, type, params, pearls) { return { id: id, type: type, params: params || {}, reward: { pearls: pearls } }; }
  var achievements = [
    a('primeira_fisgada', 'stat', { key: 'bites', n: 1 }, 1),
    a('linha_partida', 'stat', { key: 'snaps', n: 1 }, 1),
    a('paciencia', 'stat', { key: 'longestFight', n: 60, gt: true }, 2),
    a('coracao_mole', 'stat', { key: 'released', n: 10 }, 2),
    a('comerciante', 'stat', { key: 'sold', n: 50 }, 2),
    a('tinta_densa', 'dense', { n: 1 }, 3),
    a('colecionador', 'completion', { pct: 50 }, 3),
    a('enciclopedia', 'completion', { pct: 100 }, 10),
    a('gigante', 'catchSize', { size: 'XL' }, 3),
    a('noite_adentro', 'stat', { key: 'nightCatches', n: 10 }, 2),
    a('tempestade_perfeita', 'stat', { key: 'stormRares', n: 1 }, 3),
    a('mao_leve', 'stat', { key: 'jelliesClean', n: 5 }, 2),
    a('tipografia', 'catchSpecies', { sp: 'tipografo' }, 3),
    a('ermitao', 'catchSpecies', { sp: 'ermitao' }, 2),
    a('tres_coracoes', 'catchSpecies', { sp: 'polvo' }, 2),
    a('fazendeiro_do_mar', 'stat', { key: 'bred', n: 10 }, 3),
    a('bilheteria_cheia', 'stat', { key: 'tillCollected', n: 10000 }, 3),
    a('abissal', 'depth', { m: 1500 }, 3),
    a('frenesi', 'stat', { key: 'frenzyBest', n: 3 }, 2),
    a('fim_da_tinta', 'ending', {}, 5)
  ];

  // Msg = {id, unlock?, hint?}. Found in order m1..m8 (AQ.game.foundMessage).
  var messages = [
    { id: 'm1', hint: 'cavalo' },
    { id: 'm2', hint: 'ermitao' },
    { id: 'm3', hint: 'tipografo', unlock: 'papel' },
    { id: 'm4', hint: 'marlim' },
    { id: 'm5', hint: 'celacanto' },
    { id: 'm6', hint: 'caravela' },
    { id: 'm7' },
    { id: 'm8', hint: 'tinteira' }
  ];

  function index(arr) { var m = Object.create(null); arr.forEach(function (x) { m[x.id] = x; }); return m; }
  var G = index(chain), A = index(achievements), M = index(messages);

  AQ.goals = {
    chain: chain,
    achievements: achievements,
    messages: messages,
    get: function (id) { return G[id] || null; },
    ach: function (id) { return A[id] || null; },
    msg: function (id) { return M[id] || null; },
    ACTIVE: 3
  };
})(window.AQ);
